const logger = require('../utils/logger');
const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');
const User = require('../models/User');
const Ride = require('../models/Ride');
const Bid = require('../models/Bid');
const { haversineDistance } = require('../utils/geo');

const onlineDrivers = {};
const BID_TTL_MS = 30000;
const bidTimers = {};

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
    logger.info(`Socket connected: ${socket.user.email} (${socket.user.role})`);

    if (socket.user.role === 'admin') {
      socket.join('admin-room');
    }

    if (socket.user.role === 'driver' && socket.user.isDriverVerified) {
      onlineDrivers[socket.user.id] = { socketId: socket.id, lat: null, lng: null, updatedAt: Date.now() };
      io.emit('drivers:online', Object.keys(onlineDrivers).length);
    }

    socket.on('driver:ready', async () => {
      if (socket.user.role !== 'driver') return;
      try {
        const pendingRides = await Ride.findAll({
          where: { status: 'pending', driverId: null },
          attributes: ['id', 'pickupLat', 'pickupLng', 'pickupAddress', 'dropoffLat', 'dropoffLng', 'dropoffAddress', 'distance', 'passengerOffer', 'createdAt'],
          order: [['createdAt', 'DESC']],
          limit: 50,
        });
        for (const ride of pendingRides) {
          socket.emit('ride:available', {
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

    socket.on('join:ride', async (rideId) => {
      logger.debug(`${socket.user.email} joining room ride:${rideId}`);
      socket.join(`ride:${rideId}`);
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
            socket.emit('new:offer', {
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

    socket.on('leave:ride', (rideId) => {
      socket.leave(`ride:${rideId}`);
    });

    socket.on('location:update', async (data) => {
      const { rideId, lat, lng } = data;
      if (lat == null || lng == null) return;

      if (socket.user.role === 'driver') {
        if (rideId) {
          onlineDrivers[`${socket.user.id}:${rideId}`] = { lat, lng, updatedAt: Date.now() };
          try {
            await Ride.update({ driverLat: lat, driverLng: lng }, { where: { id: rideId, driverId: socket.user.id } });
          } catch { /* best-effort */ }

          io.to(`ride:${rideId}`).emit('driver:location', { lat, lng });

          try {
            const ride = await Ride.findByPk(rideId, { attributes: ['id', 'status', 'pickupLat', 'pickupLng'] });
            if (ride && ride.status === 'accepted') {
               const distanceToPickup = haversineDistance(lat, lng, ride.pickupLat, ride.pickupLng) * 1000;
               if (distanceToPickup <= 200) {
                 ride.status = 'arrived';
                await ride.save();
                logger.info(`Ride ${rideId} auto-arrived — driver within ${Math.round(distanceToPickup)}m of pickup`);
                io.to(`ride:${rideId}`).emit('ride:status', { rideId, status: 'arrived' });
              }
            }
          } catch { /* best-effort */ }
        }

        onlineDrivers[socket.user.id] = { socketId: socket.id, lat, lng, updatedAt: Date.now() };
        try {
          await User.update({ currentLat: lat, currentLng: lng, lastActiveAt: new Date() }, { where: { id: socket.user.id } });
        } catch { /* best-effort */ }
      }

      if (socket.user.role === 'passenger' && rideId) {
        try {
          await Ride.update({ passengerLat: lat, passengerLng: lng }, { where: { id: rideId, passengerId: socket.user.id } });
        } catch { /* best-effort */ }
        io.to(`ride:${rideId}`).emit('passenger:location', { lat, lng, userId: socket.user.id });
      }
    });

    // Driver submits a bid on a ride
    socket.on('driver:offer', async (data) => {
      if (socket.user.role !== 'driver') return;
      const { rideId, amount } = data;
      if (!rideId || !amount || amount <= 0) {
        socket.emit('offer:error', { message: 'Invalid bid amount.' });
        return;
      }

      try {
        const ride = await Ride.findByPk(rideId, { attributes: ['id', 'status', 'passengerId', 'pickupLat', 'pickupLng'] });
        if (!ride || ride.status !== 'pending') {
          socket.emit('offer:error', { message: 'This ride is no longer accepting offers.' });
          return;
        }

        const activeDriverRide = await Ride.findOne({
          where: {
            driverId: socket.user.id,
            status: { [Op.in]: ['accepted', 'arrived', 'in_progress'] },
          },
        });
        if (activeDriverRide) {
          socket.emit('offer:error', { message: 'You already have an active ride.' });
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
              io.to(`ride:${rideId}`).emit('offer:expired', payload);
              // Also notify the driver directly via their latest known socket
              const driverInfo = onlineDrivers[driverId];
              if (driverInfo) {
                io.to(driverInfo.socketId).emit('offer:expired', payload);
              }
              logger.info(`Bid ${bid.id} expired for ride ${rideId}`);
            }
          } catch { /* best-effort */ }
        }, BID_TTL_MS);

        if (!bidTimers[rideId]) bidTimers[rideId] = {};
        bidTimers[rideId][bid.id] = timer;

        const roomSockets = io.sockets.adapter.rooms.get(`ride:${rideId}`);
        const roomSize = roomSockets ? roomSockets.size : 0;
        logger.info(`Emitting new:offer for ride ${rideId}, bid ${bid.id}, amount ${amount} to room ride:${rideId} (${roomSize} sockets in room)`);
        io.to(`ride:${rideId}`).emit('new:offer', {
          bidId: bid.id,
          rideId,
          driverId: socket.user.id,
          driverName: socket.user.name,
          driverPhoto: socket.user.profilePhoto,
          amount: parseFloat(amount),
          expiresAt,
        });

        socket.emit('offer:sent', { bidId: bid.id, amount: parseFloat(amount), expiresAt });
        logger.info(`Driver ${socket.user.email} bid ${amount} on ride ${rideId}`);
      } catch (err) {
        logger.error(`Bid error: ${err.message}`);
        socket.emit('offer:error', { message: 'Failed to submit offer.' });
      }
    });

    // Passenger accepts an offer via socket (lightweight, triggers REST for security)
    socket.on('accept:offer', async (data) => {
      if (socket.user.role !== 'passenger') return;
      const { bidId } = data;
      if (!bidId) return;
      socket.emit('accept:redirect', { bidId });
    });

    socket.on('disconnect', () => {
      logger.info(`Socket disconnected: ${socket.user.email}`);
      // Clear bid timers for this driver
      for (const rideId of Object.keys(bidTimers)) {
        for (const bidId of Object.keys(bidTimers[rideId])) {
          // This is best-effort; timers will resolve on their own
        }
      }
      for (const key of Object.keys(onlineDrivers)) {
        if (key.startsWith(`${socket.user.id}:`)) {
          delete onlineDrivers[key];
        }
      }
      if (onlineDrivers[socket.user.id]) {
        delete onlineDrivers[socket.user.id];
        io.emit('drivers:online', Object.keys(onlineDrivers).length);
      }
    });
  });
}

function getOnlineDrivers() {
  return onlineDrivers;
}

function getIO() {
  return _io;
}

module.exports = { setupSocketHandlers, getOnlineDrivers, getIO };
