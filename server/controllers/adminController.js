const User = require('../models/User');
const Ride = require('../models/Ride');
const SOSAlert = require('../models/SOSAlert');
const DriverDocument = require('../models/DriverDocument');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/AppError');
const { Op } = require('sequelize');
const logger = require('../utils/logger');
const { fileToUrl } = require('../utils/geo');

exports.getStats = catchAsync(async (req, res, next) => {
  const [totalUsers, totalRides, totalRevenue, pendingVerifications, activeSOS] = await Promise.all([
    User.count(),
    Ride.count(),
    Ride.sum('fare', { where: { status: 'completed' } }) || 0,
    User.count({ where: { isDriverVerified: false, role: 'driver' } }),
    SOSAlert.count({ where: { status: 'active' } }),
  ]);

  const userBreakdown = await User.findAll({
    attributes: ['role', [User.sequelize.fn('COUNT', User.sequelize.col('id')), 'count']],
    group: ['role'],
    raw: true,
  });

  const rideBreakdown = await Ride.findAll({
    attributes: ['status', [Ride.sequelize.fn('COUNT', Ride.sequelize.col('id')), 'count']],
    group: ['status'],
    raw: true,
  });

  res.status(200).json({
    success: true,
    data: {
      stats: {
        totalUsers,
        totalRides,
        totalRevenue,
        pendingVerifications,
        activeSOS,
      },
      userBreakdown,
      rideBreakdown,
    },
  });
});

exports.getUsers = catchAsync(async (req, res, next) => {
  const { role, search, page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;

  const where = {};
  if (role) where.role = role;
  if (search) {
    where[Op.or] = [
      { name: { [Op.iLike]: `%${search}%` } },
      { email: { [Op.iLike]: `%${search}%` } },
    ];
  }

  const { count, rows } = await User.findAndCountAll({
    where,
    limit: parseInt(limit),
    offset: parseInt(offset),
    order: [['createdAt', 'DESC']],
  });

  res.status(200).json({
    success: true,
    data: {
      users: rows,
      total: count,
      pages: Math.ceil(count / limit),
      currentPage: parseInt(page),
    },
  });
});

exports.suspendUser = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const user = await User.findByPk(id);
  if (!user) return next(new AppError('User not found.', 404));
  if (user.id === req.user.id) return next(new AppError('You cannot suspend yourself.', 400));

  user.isSuspended = !user.isSuspended;
  await user.save();

  res.status(200).json({
    success: true,
    data: { isSuspended: user.isSuspended },
    message: user.isSuspended ? 'User suspended.' : 'User activated.',
  });
});

exports.getAllRides = catchAsync(async (req, res, next) => {
  const { status, search, page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;

  const where = {};
  if (status) where.status = status;
  if (search) {
    where[Op.or] = [
      { pickupAddress: { [Op.iLike]: `%${search}%` } },
      { dropoffAddress: { [Op.iLike]: `%${search}%` } },
    ];
  }

  const { count, rows } = await Ride.findAndCountAll({
    where,
    limit: parseInt(limit),
    offset: parseInt(offset),
    order: [['createdAt', 'DESC']],
  });

  const userIds = new Set();
  rows.forEach(r => { if (r.passengerId) userIds.add(r.passengerId); if (r.driverId) userIds.add(r.driverId); });

  const userMap = {};
  if (userIds.size > 0) {
    const users = await User.findAll({
      where: { id: { [Op.in]: [...userIds] } },
      attributes: ['id', 'name', 'email', 'phone', 'profilePhoto', 'role'],
    });
    users.forEach(u => { userMap[u.id] = u; });
  }

  const rides = rows.map(r => ({
    ...r.toJSON(),
    passenger: r.passengerId ? userMap[r.passengerId] || null : null,
    driver: r.driverId ? userMap[r.driverId] || null : null,
  }));

  res.status(200).json({
    success: true,
    data: {
      rides,
      total: count,
      pages: Math.ceil(count / limit),
      currentPage: parseInt(page),
    },
  });
});

exports.getRideById = catchAsync(async (req, res, next) => {
  const ride = await Ride.findByPk(req.params.id);
  if (!ride) return next(new AppError('Ride not found.', 404));

  let driver = null;
  let passenger = null;

  if (ride.driverId) {
    driver = await User.findByPk(ride.driverId, { attributes: ['id', 'name', 'phone', 'email', 'profilePhoto'] });
    if (driver) {
      driver = driver.toJSON();
      const profileDoc = await DriverDocument.findOne({
        where: { userId: ride.driverId, documentType: 'profile_photo' },
      });
      driver.profilePhoto = profileDoc ? fileToUrl(profileDoc.filePath) : null;
    }
  }

  passenger = await User.findByPk(ride.passengerId, { attributes: ['id', 'name', 'email', 'profilePhoto'] });
  if (passenger) {
    passenger = passenger.toJSON();
    passenger.selfiePath = ride.selfiePath ? fileToUrl(ride.selfiePath) : null;
  }

  res.status(200).json({ success: true, data: { ride, driver, passenger } });
});

exports.getActivities = catchAsync(async (req, res, next) => {
  const [cancelledRides, sosAlerts] = await Promise.all([
    Ride.findAll({
      where: { status: 'cancelled' },
      limit: 10,
      order: [['cancelledAt', 'DESC']],
    }),
    SOSAlert.findAll({
      limit: 10,
      order: [['createdAt', 'DESC']],
    }),
  ]);

  const userIds = new Set();
  cancelledRides.forEach((r) => { if (r.passengerId) userIds.add(r.passengerId); });
  sosAlerts.forEach((s) => { if (s.userId) userIds.add(s.userId); });

  const users = await User.findAll({
    where: { id: { [Op.in]: [...userIds] } },
    attributes: ['id', 'name'],
  });
  const userMap = {};
  users.forEach((u) => { userMap[u.id] = u.name; });

  const activities = [
    ...cancelledRides.map((r) => ({
      type: 'CANCELLATION',
      message: `Ride cancelled by ${userMap[r.passengerId] || 'user'}`,
      date: r.cancelledAt,
      severity: 'warn',
    })),
    ...sosAlerts.map((s) => ({
      type: 'SOS_ALERT',
      message: `SOS alert triggered by ${userMap[s.userId] || 'user'}`,
      date: s.createdAt,
      severity: 'critical',
    })),
  ].sort((a, b) => new Date(b.date) - new Date(a.date));

  res.status(200).json({
    success: true,
    data: { activities },
  });
});
