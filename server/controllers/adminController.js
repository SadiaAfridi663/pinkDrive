const User = require('../models/User');
const Ride = require('../models/Ride');
const Dispute = require('../models/Dispute');
const Debt = require('../models/Debt');
const SOSAlert = require('../models/SOSAlert');
const DriverDocument = require('../models/DriverDocument');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/AppError');
const { Op } = require('sequelize');
const logger = require('../utils/logger');
const { fileToUrl } = require('../utils/geo');
const { sendDisputeUpdate } = require('../services/receiptService');

exports.getStats = catchAsync(async (req, res, next) => {
  const [totalUsers, totalRides, totalRevenue, pendingVerifications, activeSOS, openDisputes] = await Promise.all([
    User.count(),
    Ride.count(),
    Ride.sum('fare', { where: { status: 'completed' } }) || 0,
    User.count({ where: { isDriverVerified: false, role: 'driver' } }),
    SOSAlert.count({ where: { status: 'active' } }),
    Dispute.count({ where: { status: ['open', 'under_review'] } }),
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
        openDisputes,
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

exports.getUserById = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const user = await User.findByPk(id);
  if (!user) return next(new AppError('User not found.', 404));

  let documents = [];
  if (user.role === 'driver') {
    const docs = await DriverDocument.findAll({
      where: { userId: id },
      order: [['createdAt', 'DESC']],
    });
    documents = docs.map((d) => {
      const json = d.toJSON();
      json.filePath = fileToUrl(json.filePath);
      return json;
    });
  }

  res.status(200).json({
    success: true,
    data: { user, documents },
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

exports.getPaymentStats = catchAsync(async (req, res, next) => {
  const stripePaid = parseFloat(await Ride.sum('fare', {
    where: { paymentMethod: 'stripe', paymentStatus: 'paid', status: 'completed' },
  }) || 0);
  const cashTotal = parseFloat(await Ride.sum('fare', {
    where: { paymentMethod: 'cash', status: 'completed' },
  }) || 0);
  const pendingPayments = await Ride.count({
    where: { paymentMethod: 'stripe', paymentStatus: 'pending' },
  });
  const failedPayments = await Ride.count({
    where: { paymentMethod: 'stripe', paymentStatus: 'failed' },
  });
  const stripeCount = await Ride.count({
    where: { paymentMethod: 'stripe', paymentStatus: 'paid' },
  });
  const cashCount = await Ride.count({
    where: { paymentMethod: 'cash', status: 'completed' },
  });

  const recentStripePayments = await Ride.findAll({
    where: { paymentMethod: 'stripe', paymentStatus: 'paid' },
    order: [['updatedAt', 'DESC']],
    limit: 20,
  });

  const userIds = new Set();
  recentStripePayments.forEach(r => {
    if (r.passengerId) userIds.add(r.passengerId);
    if (r.driverId) userIds.add(r.driverId);
  });
  const users = await User.findAll({ where: { id: { [Op.in]: [...userIds] } }, attributes: ['id', 'name'] });
  const userMap = {};
  users.forEach(u => { userMap[u.id] = u.name; });

  const recent = recentStripePayments.map(r => ({
    ...r.toJSON(),
    passengerName: userMap[r.passengerId] || 'Unknown',
    driverName: r.driverId ? userMap[r.driverId] || 'Unknown' : null,
  }));

  res.status(200).json({
    success: true,
    data: {
      stats: {
        stripeRevenue: stripePaid,
        cashRevenue: cashTotal,
        totalRevenue: stripePaid + cashTotal,
        stripeCount,
        cashCount,
        pendingPayments,
        failedPayments,
      },
      recentPayments: recent,
    },
  });
});

exports.getAllRides = catchAsync(async (req, res, next) => {
  const { status, paymentStatus, search, page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;

  const where = {};
  if (status) where.status = status;
  if (paymentStatus) where.paymentStatus = paymentStatus;
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

exports.getDisputes = catchAsync(async (req, res, next) => {
  const { status, page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;

  const where = {};
  if (status) where.status = status;

  const { count, rows } = await Dispute.findAndCountAll({
    where,
    limit: parseInt(limit),
    offset: parseInt(offset),
    order: [['createdAt', 'DESC']],
  });

  const rideIds = [...new Set(rows.map((d) => d.rideId))];
  const userIds = new Set();
  rows.forEach((d) => { if (d.reportedBy) userIds.add(d.reportedBy); });

  const [rides, users] = await Promise.all([
    Ride.findAll({ where: { id: rideIds } }),
    User.findAll({ where: { id: { [Op.in]: [...userIds] } }, attributes: ['id', 'name', 'email'] }),
  ]);

  const rideMap = {};
  rides.forEach((r) => { rideMap[r.id] = r; });
  const userMap = {};
  users.forEach((u) => { userMap[u.id] = u; });

  const disputes = rows.map((d) => ({
    ...d.toJSON(),
    ride: rideMap[d.rideId] || null,
    reportedByUser: userMap[d.reportedBy] || null,
  }));

  res.status(200).json({
    success: true,
    data: { disputes, total: count, pages: Math.ceil(count / limit), currentPage: parseInt(page) },
  });
});

exports.getDisputeById = catchAsync(async (req, res, next) => {
  const dispute = await Dispute.findByPk(req.params.id);
  if (!dispute) return next(new AppError('Dispute not found.', 404));

  const [ride, reportedByUser] = await Promise.all([
    Ride.findByPk(dispute.rideId),
    User.findByPk(dispute.reportedBy, { attributes: ['id', 'name', 'email', 'role'] }),
  ]);

  let passenger = null;
  let driver = null;
  if (ride) {
    if (ride.passengerId) passenger = await User.findByPk(ride.passengerId, { attributes: ['id', 'name', 'email', 'role', 'outstandingDebt', 'restriction'] });
    if (ride.driverId) driver = await User.findByPk(ride.driverId, { attributes: ['id', 'name', 'email', 'role'] });
  }

  res.status(200).json({
    success: true,
    data: { dispute, ride, passenger, driver, reportedByUser },
  });
});

exports.resolveDispute = catchAsync(async (req, res, next) => {
  const { action, adminNote, debtAmount } = req.body;

  if (!action || !['approve_claim', 'reject_claim', 'add_debt', 'escalate'].includes(action)) {
    return next(new AppError('Valid action is required: approve_claim, reject_claim, add_debt, escalate.', 400));
  }

  const dispute = await Dispute.findByPk(req.params.id);
  if (!dispute) return next(new AppError('Dispute not found.', 404));

  const ride = await Ride.findByPk(dispute.rideId);
  if (!ride) return next(new AppError('Ride not found.', 404));

  let status;
  let resolution;

  switch (action) {
    case 'approve_claim':
      status = 'resolved_approved';
      resolution = 'Claim approved in favor of the reporter.';
      if (debtAmount && parseFloat(debtAmount) > 0) {
        await Debt.create({
          passengerId: ride.passengerId,
          rideId: ride.id,
          amount: parseFloat(debtAmount),
          reason: dispute.disputeType,
          status: 'pending',
        });
        await User.update(
          { outstandingDebt: User.sequelize.literal(`COALESCE(outstandingDebt, 0) + ${parseFloat(debtAmount)}`) },
          { where: { id: ride.passengerId } },
        );
        resolution += ` Debt of ${parseFloat(debtAmount)} PKR recorded.`;
      }
      break;

    case 'reject_claim':
      status = 'resolved_rejected';
      resolution = 'Claim rejected. No action taken.';
      break;

    case 'add_debt':
      status = 'resolved_approved';
      if (!debtAmount || parseFloat(debtAmount) <= 0) {
        return next(new AppError('Debt amount is required for add_debt action.', 400));
      }
      await Debt.create({
        passengerId: ride.passengerId,
        rideId: ride.id,
        amount: parseFloat(debtAmount),
        reason: dispute.disputeType,
        status: 'pending',
      });
      await User.update(
        { outstandingDebt: User.sequelize.literal(`COALESCE(outstandingDebt, 0) + ${parseFloat(debtAmount)}`) },
        { where: { id: ride.passengerId } },
      );
      resolution = `Debt of ${parseFloat(debtAmount)} PKR added to passenger account.`;
      break;

    case 'escalate':
      status = 'escalated';
      resolution = 'Dispute escalated for further review.';
      break;

    default:
      return next(new AppError('Invalid action.', 400));
  }

  dispute.status = status;
  dispute.resolution = resolution;
  dispute.adminNote = adminNote || '';
  dispute.resolvedBy = req.user.id;
  dispute.resolvedAt = new Date();
  await dispute.save();

  logger.info(`Dispute ${dispute.id} resolved with action ${action} by admin ${req.user.email}`);

  sendDisputeUpdate(dispute);

  res.status(200).json({
    success: true,
    data: { dispute },
    message: `Dispute ${action === 'escalate' ? 'escalated' : 'resolved'}.`,
  });
});

exports.overridePaymentStatus = catchAsync(async (req, res, next) => {
  const { paymentStatus } = req.body;

  if (!paymentStatus || !['pending', 'paid', 'failed', 'refunded'].includes(paymentStatus)) {
    return next(new AppError('Valid payment status is required.', 400));
  }

  const ride = await Ride.findByPk(req.params.id);
  if (!ride) return next(new AppError('Ride not found.', 404));

  ride.paymentStatus = paymentStatus;
  await ride.save();

  logger.info(`Payment status for ride ${ride.id} overridden to ${paymentStatus} by admin ${req.user.email}`);

  res.status(200).json({
    success: true,
    data: { ride },
    message: `Payment status updated to "${paymentStatus}".`,
  });
});

exports.clearDebt = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const debt = await Debt.findByPk(id);
  if (!debt) return next(new AppError('Debt not found.', 404));

  debt.status = 'cleared';
  debt.clearedAt = new Date();
  await debt.save();

  const user = await User.findByPk(debt.passengerId);
  if (user) {
    const newDebt = Math.max(0, parseFloat(user.outstandingDebt) - parseFloat(debt.amount));
    user.outstandingDebt = newDebt;
    await user.save();
  }

  res.status(200).json({ success: true, message: 'Debt cleared.' });
});

exports.updateUserRestriction = catchAsync(async (req, res, next) => {
  const { restriction } = req.body;

  if (!restriction || !['none', 'warning', 'suspended', 'banned'].includes(restriction)) {
    return next(new AppError('Valid restriction is required: none, warning, suspended, banned.', 400));
  }

  const user = await User.findByPk(req.params.id);
  if (!user) return next(new AppError('User not found.', 404));

  user.restriction = restriction;
  if (restriction === 'warning') {
    user.warningCount = (user.warningCount || 0) + 1;
  }
  await user.save();

  res.status(200).json({
    success: true,
    data: { restriction: user.restriction, warningCount: user.warningCount },
    message: `User restriction set to "${restriction}".`,
  });
});
