const logger = require('../utils/logger');
const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');
const User = require('../models/User');
const Ride = require('../models/Ride');
const { haversineDistance } = require('../utils/geo');

const onlineDrivers = {};

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

    socket.on('join:ride', (rideId) => {
      socket.join(`ride:${rideId}`);
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

    socket.on('disconnect', () => {
      logger.info(`Socket disconnected: ${socket.user.email}`);
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
