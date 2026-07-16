const { Op } = require('sequelize');
const SOSAlert = require('../models/SOSAlert');
const EmergencyContact = require('../models/EmergencyContact');
const User = require('../models/User');
const Ride = require('../models/Ride');
const Notification = require('../models/Notification');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');
const logger = require('../utils/logger');
const { getIO } = require('../sockets');
const { SERVER_EVENTS, ROOMS } = require('../sockets/events');

exports.triggerSOS = catchAsync(async (req, res, next) => {
  const { rideId, lat, lng } = req.body;

  const alert = await SOSAlert.create({
    userId: req.user.id,
    rideId: rideId || null,
    lat: lat || null,
    lng: lng || null,
    status: 'active',
  });

  let ride = null;
  let passenger = null;
  let contacts = [];

  if (rideId) {
    ride = await Ride.findByPk(rideId);
    if (ride) {
      passenger = await User.findByPk(ride.passengerId, {
        attributes: ['id', 'name', 'email', 'phone'],
      });
    }
  }

  contacts = await EmergencyContact.findAll({
    where: { userId: req.user.id },
    attributes: ['id', 'name', 'phone', 'relationship'],
  });

  const io = getIO();
  if (io) {
    io.to(ROOMS.ADMIN).emit(SERVER_EVENTS.SOS_ALERT, {
      alertId: alert.id,
      userId: req.user.id,
      userName: req.user.name,
      userEmail: req.user.email,
      rideId: ride?.id || null,
      pickupAddress: ride?.pickupAddress || null,
      dropoffAddress: ride?.dropoffAddress || null,
      lat: lat || ride?.passengerLat || ride?.pickupLat || null,
      lng: lng || ride?.passengerLng || ride?.pickupLng || null,
      status: 'active',
      createdAt: alert.createdAt,
      contacts: contacts.map((c) => ({
        name: c.name,
        phone: c.phone,
        relationship: c.relationship,
      })),
    });

    try {
      const admins = await User.findAll({ where: { role: 'admin' }, attributes: ['id'] });
      await Promise.all(admins.map(admin =>
        Notification.create({
          userId: admin.id,
          type: 'sos_alert',
          title: 'SOS Alert',
          message: `${req.user.name} triggered an SOS alert.`,
          data: { alertId: alert.id, userId: req.user.id, rideId: ride?.id || null },
        })
      ));
      io.to(ROOMS.ADMIN).emit(SERVER_EVENTS.NOTIFICATION_NEW, {
        id: `notif-${Date.now()}`,
        type: 'sos_alert',
        title: 'SOS Alert',
        message: `${req.user.name} triggered an SOS alert.`,
        data: { alertId: alert.id, userId: req.user.id, rideId: ride?.id || null },
        createdAt: new Date().toISOString(),
      });
    } catch { /* best-effort */ }
  }

  logger.warn(`SOS triggered by ${req.user.email} (ride: ${rideId || 'none'})`);

  res.status(201).json({
    success: true,
    data: { alert },
    message: 'SOS alert sent. Help is on the way.',
  });
});

exports.resolveAlert = catchAsync(async (req, res, next) => {
  const alert = await SOSAlert.findByPk(req.params.id);
  if (!alert) return next(new AppError('Alert not found.', 404));
  if (alert.status === 'resolved') {
    return next(new AppError('Alert is already resolved.', 400));
  }

  alert.status = 'resolved';
  alert.resolvedBy = req.user.id;
  alert.resolvedAt = new Date();
  await alert.save();

  const io = getIO();
  if (io) {
    io.to(ROOMS.ADMIN).emit(SERVER_EVENTS.SOS_RESOLVED, { alertId: alert.id });
  }

  logger.info(`SOS alert ${alert.id} resolved by ${req.user.email}`);

  res.status(200).json({
    success: true,
    data: { alert },
    message: 'Alert resolved.',
  });
});

exports.getAlerts = catchAsync(async (req, res, next) => {
  const { status } = req.query;
  const where = {};
  if (status) where.status = status;

  const alerts = await SOSAlert.findAll({
    where,
    order: [['createdAt', 'DESC']],
    limit: 100,
  });

  const userIds = [...new Set(alerts.map((a) => a.userId))];
  const users = await User.findAll({
    where: { id: userIds },
    attributes: ['id', 'name', 'email', 'phone'],
  });
  const userMap = Object.fromEntries(users.map((u) => [u.id, u]));

  const data = alerts.map((a) => ({
    ...a.toJSON(),
    user: userMap[a.userId] || null,
  }));

  res.status(200).json({ success: true, data: { alerts: data } });
});

exports.getMyContacts = catchAsync(async (req, res, next) => {
  const contacts = await EmergencyContact.findAll({
    where: { userId: req.user.id },
    order: [['createdAt', 'ASC']],
  });
  res.status(200).json({ success: true, data: { contacts } });
});

exports.addContact = catchAsync(async (req, res, next) => {
  const { name, phone, relationship } = req.body;
  if (!name || !phone) {
    return next(new AppError('Name and phone are required.', 400));
  }

  const count = await EmergencyContact.count({ where: { userId: req.user.id } });
  if (count >= 5) {
    return next(new AppError('Maximum 5 emergency contacts allowed.', 400));
  }

  const contact = await EmergencyContact.create({
    userId: req.user.id,
    name,
    phone,
    relationship: relationship || null,
  });

  res.status(201).json({
    success: true,
    data: { contact },
    message: 'Emergency contact added.',
  });
});

exports.removeContact = catchAsync(async (req, res, next) => {
  const contact = await EmergencyContact.findOne({
    where: { id: req.params.id, userId: req.user.id },
  });
  if (!contact) return next(new AppError('Contact not found.', 404));

  await contact.destroy();
  res.status(200).json({
    success: true,
    message: 'Emergency contact removed.',
  });
});
