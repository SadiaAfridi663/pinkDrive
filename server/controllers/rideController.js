const { Op } = require('sequelize');
const User = require('../models/User');
const Ride = require('../models/Ride');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');
const logger = require('../utils/logger');

const RIDE_STATUS_FLOW = ['pending', 'accepted', 'arrived', 'in_progress', 'completed'];

exports.createRide = catchAsync(async (req, res, next) => {
  const { pickupLat, pickupLng, pickupAddress, dropoffLat, dropoffLng, dropoffAddress, selfiePath } = req.body;

  if (!pickupLat || !pickupLng || !dropoffLat || !dropoffLng) {
    return next(new AppError('Pickup and drop-off locations are required.', 400));
  }

  const active = await Ride.findOne({
    where: {
      passengerId: req.user.id,
      status: { [Op.ne]: 'completed' },
      cancelledAt: null,
    },
  });
  if (active) {
    return next(new AppError('You already have an active ride.', 400));
  }

  const ride = await Ride.create({
    passengerId: req.user.id,
    pickupLat,
    pickupLng,
    pickupAddress: pickupAddress || '',
    dropoffLat,
    dropoffLng,
    dropoffAddress: dropoffAddress || '',
    selfiePath: selfiePath || null,
    fare: 0,
    status: 'pending',
  });

  logger.info(`Ride created: ${ride.id} by passenger ${req.user.email}`);

  res.status(201).json({
    success: true,
    data: { ride },
    message: 'Ride requested. Waiting for a driver.',
  });
});

exports.uploadSelfie = catchAsync(async (req, res, next) => {
  if (!req.file) {
    return next(new AppError('Selfie image is required.', 400));
  }

  const ride = await Ride.findByPk(req.params.id);
  if (!ride) {
    return next(new AppError('Ride not found.', 404));
  }
  if (ride.passengerId !== req.user.id) {
    return next(new AppError('Unauthorized.', 403));
  }

  ride.selfiePath = req.file.path;
  await ride.save();

  logger.info(`Selfie uploaded for ride ${ride.id}`);

  res.status(200).json({
    success: true,
    data: { ride },
    message: 'Selfie uploaded.',
  });
});

exports.getActiveRide = catchAsync(async (req, res, next) => {
  const where = {
    [Op.or]: [
      { passengerId: req.user.id },
      { driverId: req.user.id },
    ],
    status: { [Op.ne]: 'completed' },
    cancelledAt: null,
  };

  const ride = await Ride.findOne({ where, order: [['createdAt', 'DESC']] });

  if (!ride) {
    return res.status(200).json({ success: true, data: { ride: null } });
  }

  const driver = ride.driverId ? await User.findByPk(ride.driverId, {
    attributes: ['id', 'name', 'phone'],
  }) : null;

  const passenger = await User.findByPk(ride.passengerId, {
    attributes: ['id', 'name'],
  });

  res.status(200).json({
    success: true,
    data: { ride, driver, passenger },
  });
});

exports.getPendingRides = catchAsync(async (req, res, next) => {
  const driver = await User.findByPk(req.user.id);
  if (!driver.isDriverVerified) {
    return next(new AppError('Your driver account has not been verified yet.', 403));
  }

  const rides = await Ride.findAll({
    where: { status: 'pending', driverId: null },
    order: [['createdAt', 'ASC']],
  });

  const passengerIds = [...new Set(rides.map((r) => r.passengerId))];
  const passengers = await User.findAll({
    where: { id: passengerIds },
    attributes: ['id', 'name'],
  });
  const passengerMap = Object.fromEntries(passengers.map((p) => [p.id, p]));

  const data = rides.map((r) => ({
    ...r.toJSON(),
    passenger: passengerMap[r.passengerId] || null,
  }));

  res.status(200).json({ success: true, data: { rides: data } });
});

exports.acceptRide = catchAsync(async (req, res, next) => {
  const driver = await User.findByPk(req.user.id);
  if (!driver.isDriverVerified) {
    return next(new AppError('Your driver account has not been verified yet.', 403));
  }

  const ride = await Ride.findByPk(req.params.id);
  if (!ride || ride.status !== 'pending') {
    return next(new AppError('Ride is no longer available.', 400));
  }

  const active = await Ride.findOne({
    where: {
      driverId: req.user.id,
      status: { [Op.in]: ['accepted', 'arrived', 'in_progress'] },
    },
  });
  if (active) {
    return next(new AppError('You already have an active ride.', 400));
  }

  ride.driverId = req.user.id;
  ride.status = 'accepted';
  ride.startedAt = new Date();
  await ride.save();

  logger.info(`Ride ${ride.id} accepted by driver ${req.user.email}`);

  res.status(200).json({
    success: true,
    data: { ride },
    message: 'Ride accepted. Proceed to pickup.',
  });
});

exports.updateRideStatus = catchAsync(async (req, res, next) => {
  const { status } = req.body;
  if (!RIDE_STATUS_FLOW.includes(status)) {
    return next(new AppError(`Status must be one of: ${RIDE_STATUS_FLOW.join(', ')}`, 400));
  }

  const ride = await Ride.findByPk(req.params.id);
  if (!ride) return next(new AppError('Ride not found.', 404));
  if (ride.driverId !== req.user.id) {
    return next(new AppError('Only the assigned driver can update ride status.', 403));
  }

  const currentIdx = RIDE_STATUS_FLOW.indexOf(ride.status);
  const nextIdx = RIDE_STATUS_FLOW.indexOf(status);
  if (nextIdx <= currentIdx) {
    return next(new AppError(`Cannot move from ${ride.status} to ${status}.`, 400));
  }

  ride.status = status;
  if (status === 'completed') ride.completedAt = new Date();
  await ride.save();

  logger.info(`Ride ${ride.id} status updated to ${status} by driver ${req.user.email}`);

  res.status(200).json({
    success: true,
    data: { ride },
    message: `Ride status updated to "${status}".`,
  });
});

exports.cancelRide = catchAsync(async (req, res, next) => {
  const ride = await Ride.findByPk(req.params.id);
  if (!ride) return next(new AppError('Ride not found.', 404));
  if (ride.passengerId !== req.user.id) {
    return next(new AppError('Only the passenger can cancel their ride.', 403));
  }
  if (['completed', 'cancelled'].includes(ride.status)) {
    return next(new AppError('Ride is already finished.', 400));
  }

  ride.status = 'cancelled';
  ride.cancelledAt = new Date();
  await ride.save();

  logger.info(`Ride ${ride.id} cancelled by passenger ${req.user.email}`);

  res.status(200).json({
    success: true,
    message: 'Ride cancelled.',
  });
});

exports.getRideHistory = catchAsync(async (req, res, next) => {
  const rides = await Ride.findAll({
    where: {
      [Op.or]: [
        { passengerId: req.user.id },
        { driverId: req.user.id },
      ],
      [Op.or]: [
        { status: 'completed' },
        { status: 'cancelled' },
      ],
    },
    order: [['createdAt', 'DESC']],
    limit: 50,
  });

  res.status(200).json({ success: true, data: { rides } });
});
