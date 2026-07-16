const logger = require('../utils/logger');
const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');
const User = require('../models/User');
const Ride = require('../models/Ride');
const Bid = require('../models/Bid');
const { haversineDistance } = require('../utils/geo');
const { CLIENT_EVENTS, SERVER_EVENTS, ROOMS } = require('./events');

const onlineDrivers = {};
const BID_TTL_MS = 10000;
const bidTimers = {};
const driverTimerMap = {};

let _io = null;

function setupSocketHandlers(io) {
  _io = io;
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.query.token;
      if (!token) return next(new Error('Authentication required'));
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findByPk(decoded.id);
      if (!user) return next(new Error('User not found'));
      socket.user = user;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', async (socket) => {
    try {
      logger.info(`Socket connected: ${socket.user.email} (${socket.user.role})`);

      socket.join(ROOMS.USER(socket.user.id));
      if (socket.user.role === 'admin') {
        socket.join(ROOMS.ADMIN);
      }
      if (socket.user.role === 'passenger') {
        socket.join(ROOMS.PASSENGER(socket.user.id));
      }
      if (socket.user.role === 'driver') {
        socket.join(ROOMS.DRIVER(socket.user.id));
      }

    if (socket.user.role === 'driver' && socket.user.isDriverVerified) {
      onlineDrivers[socket.user.id] = { socketId: socket.id, lat: null, lng: null, updatedAt: Date.now() };
      io.emit(SERVER_EVENTS.DRIVERS_ONLINE, Object.keys(onlineDrivers).length);
    }

    socket.on(CLIENT_EVENTS.DRIVER_READY, async () => {
      if (socket.user.role !== 'driver' || !socket.user.isDriverVerified) return;
      try {
        const SharedTrip = require('../models/SharedTrip');
        const activeShared = await SharedTrip.findOne({
          where: { driverId: socket.user.id, status: { [Op.in]: ['active', 'full', 'in_progress'] } },
        });
        if (activeShared) {
          logger.info(`Driver ${socket.user.email} has active shared trip — skipping ride requests`);
          return;
        }

        const pendingRides = await Ride.findAll({
          where: { status: 'pending', driverId: null },
          attributes: ['id', 'pickupLat', 'pickupLng', 'pickupAddress', 'dropoffLat', 'dropoffLng', 'dropoffAddress', 'distance', 'passengerOffer', 'createdAt'],
          order: [['createdAt', 'DESC']],
          limit: 50,
        });
        for (const ride of pendingRides) {
          socket.emit(SERVER_EVENTS.RIDE_AVAILABLE, {
            rideId: ride.id,
            pickupLat: ride.pickupLat,
            pickupLng: ride.pickupLng,
            pickupAddress: ride.pickupAddress,
            dropoffLat: ride.dropoffLat,
            dropoffLng: ride.dropoffLng,
            dropoffAddress: ride.dropoffAddress,
            distance: ride.distance,
            passengerOffer: ride.passengerOffer,
            createdAt: ride.createdAt,
          });
        }
        if (pendingRides.length > 0) {
          logger.info(`Sent ${pendingRides.length} pending ride(s) to ${socket.user.email}`);
        }
      } catch (err) {
        logger.error(`driver:ready error for ${socket.user.email}: ${err.message}`);
      }
    });

    socket.on(CLIENT_EVENTS.JOIN_RIDE, async (rideId) => {
      logger.debug(`${socket.user.email} joining room ride:${rideId}`);
      socket.join(ROOMS.RIDE(rideId));
      try {
        const activeBids = await Bid.findAll({
          where: { rideId, status: 'active', expiresAt: { [Op.gt]: new Date() } },
        });
        logger.debug(`Found ${activeBids.length} active bid(s) for room ride:${rideId}`);
        if (activeBids.length > 0) {
          const driverIds = [...new Set(activeBids.map((b) => b.driverId))];
          const drivers = await User.findAll({
            where: { id: driverIds },
            attributes: ['id', 'name', 'profilePhoto'],
          });
          const driverMap = Object.fromEntries(drivers.map((d) => [d.id, d]));
          for (const bid of activeBids) {
            const driver = driverMap[bid.driverId];
            socket.emit(SERVER_EVENTS.NEW_OFFER, {
              bidId: bid.id,
              rideId: bid.rideId,
              driverId: bid.driverId,
              driverName: driver?.name,
              driverPhoto: driver?.profilePhoto,
              amount: parseFloat(bid.amount),
              expiresAt: bid.expiresAt,
            });
          }
          logger.info(`Sent ${activeBids.length} existing bid(s) for ride ${rideId} to ${socket.user.email}`);
        } else {
          logger.info(`No active bids to backfill for ride ${rideId} for ${socket.user.email}`);
        }
      } catch (err) {
        logger.error(`join:ride backlog error for ride ${rideId}: ${err.message}`);
      }
    });

    socket.on(CLIENT_EVENTS.LEAVE_RIDE, (rideId) => {
      socket.leave(ROOMS.RIDE(rideId));
    });

    socket.on(CLIENT_EVENTS.LOCATION_UPDATE, async (data) => {
      const { rideId, lat, lng } = data;
      if (lat == null || lng == null) return;

      if (socket.user.role === 'driver') {
        // ─── Private ride location ──────────────────────────────
        if (rideId) {
          onlineDrivers[`${socket.user.id}:${rideId}`] = { lat, lng, updatedAt: Date.now() };
          try {
            await Ride.update({ driverLat: lat, driverLng: lng }, { where: { id: rideId, driverId: socket.user.id } });
          } catch { /* best-effort */ }

          io.to(ROOMS.RIDE(rideId)).emit(SERVER_EVENTS.DRIVER_LOCATION, { lat, lng });

          try {
            const ride = await Ride.findByPk(rideId, { attributes: ['id', 'status', 'pickupLat', 'pickupLng'] });
            if (ride && ride.status === 'accepted') {
              const distanceToPickup = haversineDistance(lat, lng, ride.pickupLat, ride.pickupLng) * 1000;
              if (distanceToPickup <= 200) {
                ride.status = 'arrived';
                await ride.save();
                logger.info(`Ride ${rideId} auto-arrived — driver within ${Math.round(distanceToPickup)}m of pickup`);
                io.to(ROOMS.RIDE(rideId)).emit(SERVER_EVENTS.RIDE_STATUS, { rideId, status: 'arrived' });
              }
            }
          } catch { /* best-effort */ }
        }

        // ─── Shared trip location ───────────────────────────────
        try {
          const SharedTrip = require('../models/SharedTrip');
          const activeSharedTrip = await SharedTrip.findOne({
            where: { driverId: socket.user.id, status: { [Op.in]: ['active', 'full', 'in_progress'] } },
          });
          if (activeSharedTrip) {
            await activeSharedTrip.update({ driverLat: lat, driverLng: lng });
            io.to(ROOMS.TRIP(activeSharedTrip.id)).emit(SERVER_EVENTS.DRIVER_LOCATION, {
              tripId: activeSharedTrip.id, lat, lng,
            });
          }
        } catch { /* best-effort */ }

        onlineDrivers[socket.user.id] = { socketId: socket.id, lat, lng, updatedAt: Date.now() };
        try {
          await User.update({ currentLat: lat, currentLng: lng, lastActiveAt: new Date() }, { where: { id: socket.user.id } });
        } catch { /* best-effort */ }
      }

      if (socket.user.role === 'passenger') {
        if (rideId) {
          // ─── Private ride passenger location ──────────────────────
          try {
            await Ride.update({ passengerLat: lat, passengerLng: lng }, { where: { id: rideId, passengerId: socket.user.id } });
          } catch { /* best-effort */ }
          io.to(ROOMS.RIDE(rideId)).emit(SERVER_EVENTS.PASSENGER_LOCATION, { lat, lng, userId: socket.user.id });
        } else {
          // ─── Shared trip passenger location ───────────────────────
          try {
            const TripRequest = require('../models/TripRequest');
            const activeRequest = await TripRequest.findOne({
              where: { passengerId: socket.user.id, status: { [Op.in]: ['accepted', 'driver_arriving'] } },
            });
            if (activeRequest) {
              io.to(ROOMS.TRIP(activeRequest.tripId)).emit(SERVER_EVENTS.PASSENGER_LOCATION, {
                lat, lng, userId: socket.user.id, tripId: activeRequest.tripId,
              });
            }
          } catch { /* best-effort */ }
        }
      }
    });

    // Driver submits a bid on a ride
    socket.on(CLIENT_EVENTS.DRIVER_OFFER, async (data) => {
      if (socket.user.role !== 'driver') return;
      if (!socket.user.isDriverVerified) {
        socket.emit(SERVER_EVENTS.OFFER_ERROR, { message: 'Your driver account has not been verified yet.' });
        return;
      }
      const { rideId, amount } = data;
      if (!rideId || !amount || amount <= 0) {
        socket.emit(SERVER_EVENTS.OFFER_ERROR, { message: 'Invalid bid amount.' });
        return;
      }

      try {
        const ride = await Ride.findByPk(rideId, { attributes: ['id', 'status', 'passengerId', 'pickupLat', 'pickupLng'] });
        if (!ride || ride.status !== 'pending') {
          socket.emit(SERVER_EVENTS.OFFER_ERROR, { message: 'This ride is no longer accepting offers.' });
          return;
        }

        const activeDriverRide = await Ride.findOne({
          where: {
            driverId: socket.user.id,
            status: { [Op.in]: ['accepted', 'arrived', 'in_progress'] },
          },
        });
        if (activeDriverRide) {
          socket.emit(SERVER_EVENTS.OFFER_ERROR, { message: 'You already have an active ride.' });
          return;
        }

        const SharedTrip = require('../models/SharedTrip');
        const activeSharedTrip = await SharedTrip.findOne({
          where: { driverId: socket.user.id, status: { [Op.in]: ['active', 'full', 'in_progress'] } },
        });
        if (activeSharedTrip) {
          socket.emit(SERVER_EVENTS.OFFER_ERROR, { message: 'You have an active shared trip. Cancel it first to accept private rides.' });
          return;
        }

        const Wallet = require('../models/Wallet');
        const { isDebtLocked, MAX_COMMISSION_DEBT } = require('../utils/commission');
        const driverWallet = await Wallet.findOne({ where: { userId: socket.user.id } });
        if (driverWallet && isDebtLocked(driverWallet)) {
          socket.emit(SERVER_EVENTS.OFFER_ERROR, { message: `Your account has outstanding commission dues of ${parseFloat(driverWallet.commissionDue).toFixed(0)} PKR. Please recharge your wallet to continue receiving rides.` });
          return;
        }

        const expiresAt = new Date(Date.now() + BID_TTL_MS);
        const driverId = socket.user.id;
        const bid = await Bid.create({
          rideId,
          driverId,
          amount: parseFloat(amount),
          status: 'active',
          expiresAt,
        });
        logger.info(`Bid ${bid.id} created for ride ${rideId} by driver ${driverId}, amount ${amount}`);

        // Schedule expiry
        const timer = setTimeout(async () => {
          try {
            const current = await Bid.findByPk(bid.id);
            if (current && current.status === 'active') {
              current.status = 'expired';
              await current.save();
              const payload = { bidId: bid.id, rideId };
              io.to(ROOMS.RIDE(rideId)).emit(SERVER_EVENTS.OFFER_EXPIRED, payload);
              // Also notify the driver directly via their latest known socket
              const driverInfo = onlineDrivers[driverId];
              if (driverInfo) {
                io.to(driverInfo.socketId).emit(SERVER_EVENTS.OFFER_EXPIRED, payload);
              }
              logger.info(`Bid ${bid.id} expired for ride ${rideId}`);
            }
          } catch { /* best-effort */ }
        }, BID_TTL_MS);

        if (!bidTimers[rideId]) bidTimers[rideId] = {};
        bidTimers[rideId][bid.id] = timer;
        if (!driverTimerMap[driverId]) driverTimerMap[driverId] = [];
        driverTimerMap[driverId].push(timer);

        const roomSockets = io.sockets.adapter.rooms.get(ROOMS.RIDE(rideId));
        const roomSize = roomSockets ? roomSockets.size : 0;
        logger.info(`Emitting new:offer for ride ${rideId}, bid ${bid.id}, amount ${amount} to room ride:${rideId} (${roomSize} sockets in room)`);
        io.to(ROOMS.RIDE(rideId)).emit(SERVER_EVENTS.NEW_OFFER, {
          bidId: bid.id,
          rideId,
          driverId: socket.user.id,
          driverName: socket.user.name,
          driverPhoto: socket.user.profilePhoto,
          amount: parseFloat(amount),
          expiresAt,
        });

        socket.emit(SERVER_EVENTS.OFFER_SENT, { bidId: bid.id, amount: parseFloat(amount), expiresAt });
        logger.info(`Driver ${socket.user.email} bid ${amount} on ride ${rideId}`);
      } catch (err) {
        logger.error(`Bid error: ${err.message}`);
        socket.emit(SERVER_EVENTS.OFFER_ERROR, { message: 'Failed to submit offer.' });
      }
    });

    // Passenger accepts an offer via socket (lightweight, triggers REST for security)
    socket.on(CLIENT_EVENTS.ACCEPT_OFFER, async (data) => {
      if (socket.user.role !== 'passenger') return;
      const { bidId } = data;
      if (!bidId) return;
      socket.emit(SERVER_EVENTS.ACCEPT_REDIRECT, { bidId });
    });

    // Notifications — join driver/passenger rooms for targeted events
    socket.on(CLIENT_EVENTS.JOIN_USER, () => {
      socket.join(ROOMS.USER(socket.user.id));
    });

    // Driver listening for trip requests
    socket.on(CLIENT_EVENTS.TRIP_LISTEN, () => {
      if (socket.user.role === 'driver') {
        socket.join(ROOMS.DRIVER(socket.user.id));
        logger.info(`Driver ${socket.user.email} listening for trip requests`);
      }
    });

    // Passenger listening for trip updates
    socket.on(CLIENT_EVENTS.TRIP_PASSENGER_LISTEN, () => {
      if (socket.user.role === 'passenger') {
        socket.join(ROOMS.PASSENGER(socket.user.id));
      }
    });

    // Join/leave shared trip room for real-time updates
    socket.on(CLIENT_EVENTS.JOIN_TRIP, (tripId) => {
      socket.join(ROOMS.TRIP(tripId));
    });

    socket.on(CLIENT_EVENTS.LEAVE_TRIP, (tripId) => {
      socket.leave(ROOMS.TRIP(tripId));
    });

    socket.on('disconnect', () => {
      try {
        logger.info(`Socket disconnected: ${socket.user.email}`);
        // Clear bid timers for this driver
        const timers = driverTimerMap[socket.user.id];
        if (timers) {
          for (const t of timers) clearTimeout(t);
          delete driverTimerMap[socket.user.id];
        }
        // Clean up bidTimers entries
        for (const rideId of Object.keys(bidTimers)) {
          for (const bidId of Object.keys(bidTimers[rideId])) {
            // Timer cleared above; remove stale entries
          }
        }
        for (const key of Object.keys(onlineDrivers)) {
          if (key.startsWith(`${socket.user.id}:`)) {
            delete onlineDrivers[key];
          }
        }
        if (onlineDrivers[socket.user.id]) {
          delete onlineDrivers[socket.user.id];
          io.emit(SERVER_EVENTS.DRIVERS_ONLINE, Object.keys(onlineDrivers).length);
        }
      } catch (err) {
        logger.error(`Disconnect handler error: ${err.message}`);
      }
    });
    } catch (err) {
      logger.error(`Connection handler error for ${socket.user?.email}: ${err.message}`);
    }
  });
}

function getOnlineDrivers() {
  return onlineDrivers;
}

function getIO() {
  return _io;
}

module.exports = { setupSocketHandlers, getOnlineDrivers, getIO };
