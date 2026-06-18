const { Op } = require('sequelize');
const User = require('../models/User');
const Ride = require('../models/Ride');
const Dispute = require('../models/Dispute');
const Debt = require('../models/Debt');
const Wallet = require('../models/Wallet');
const Transaction = require('../models/Transaction');
const DriverDocument = require('../models/DriverDocument');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');
const logger = require('../utils/logger');
const { reverseGeocodeBoth, haversineDistance, fileToUrl, isPointInPolygon } = require('../utils/geo');
const ServiceArea = require('../models/ServiceArea');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { getOnlineDrivers, getIO } = require('../sockets');
const {
  sendRideReceiptToPassenger,
  sendPaymentConfirmation,
  sendRefundNotification,
  sendDriverRideCompleted,
} = require('../services/receiptService');

const RIDE_STATUS_FLOW = ['pending', 'accepted', 'arrived', 'in_progress', 'completed'];
const FARE_PER_KM = 50;

exports.createRide = catchAsync(async (req, res, next) => {
  const { pickupLat, pickupLng, dropoffLat, dropoffLng, selfiePath, paymentMethod } = req.body;

  if (!pickupLat || !pickupLng || !dropoffLat || !dropoffLng) {
    return next(new AppError('Pickup and drop-off locations are required.', 400));
  }

  if (!selfiePath) {
    return next(new AppError('Selfie is required before requesting a ride.', 400));
  }

  const passenger = await User.findByPk(req.user.id);
  if (passenger.outstandingDebt > 0) {
    return next(new AppError('You have an outstanding debt. Please clear it before requesting a new ride.', 400));
  }
  if (passenger.restriction === 'suspended' || passenger.restriction === 'banned') {
    return next(new AppError('Your account is restricted. Contact support.', 403));
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

  const activeAreas = await ServiceArea.findAll({ where: { isActive: true } });
  if (activeAreas.length > 0) {
    const inServiceArea = activeAreas.some((a) =>
      isPointInPolygon(pickupLat, pickupLng, a.coordinates),
    );
    if (!inServiceArea) {
      return next(new AppError('Pickup location is outside our service area.', 400));
    }
  }

  const [pickupAddress, dropoffAddress] = await reverseGeocodeBoth(pickupLat, pickupLng, dropoffLat, dropoffLng);

  const distance = haversineDistance(pickupLat, pickupLng, dropoffLat, dropoffLng);
  const fare = Math.round(distance * FARE_PER_KM * 100) / 100;

  const ride = await Ride.create({
    passengerId: req.user.id,
    pickupLat,
    pickupLng,
    pickupAddress,
    dropoffLat,
    dropoffLng,
    dropoffAddress,
    selfiePath,
    distance,
    fare,
    paymentMethod: paymentMethod || 'cash',
    paymentStatus: 'pending',
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

exports.uploadTempSelfie = catchAsync(async (req, res, next) => {
  if (!req.file) {
    return next(new AppError('Selfie image is required.', 400));
  }
  res.status(200).json({
    success: true,
    data: { selfiePath: fileToUrl(req.file.path) },
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

  let driver = null;
  if (ride.driverId) {
    driver = await User.findByPk(ride.driverId, {
      attributes: ['id', 'name', 'phone'],
    });
    const profileDoc = await DriverDocument.findOne({
      where: { userId: ride.driverId, documentType: 'profile_photo' },
    });
    if (driver) {
      driver = driver.toJSON();
      driver.profilePhoto = profileDoc ? fileToUrl(profileDoc.filePath) : null;
    }
  }

  const passenger = await User.findByPk(ride.passengerId, {
    attributes: ['id', 'name'],
  });

  let passengerJson = null;
  if (passenger) {
    passengerJson = passenger.toJSON();
    passengerJson.selfiePath = ride.selfiePath ? fileToUrl(ride.selfiePath) : null;
  }

  res.status(200).json({
    success: true,
    data: { ride, driver, passenger: passengerJson },
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

  const onlineDrivers = getOnlineDrivers();
  const driverOnline = onlineDrivers[req.user.id];
  const dLat = driverOnline?.lat ?? driver.currentLat;
  const dLng = driverOnline?.lng ?? driver.currentLng;

  ride.driverId = req.user.id;
  ride.status = 'accepted';
  ride.startedAt = new Date();
  ride.driverLat = dLat != null ? dLat : null;
  ride.driverLng = dLng != null ? dLng : null;
  await ride.save();

  const io = getIO();
  if (io) {
    io.to(`ride:${ride.id}`).emit('ride:status', { rideId: ride.id, status: 'accepted' });
    if (ride.driverLat != null && ride.driverLng != null) {
      io.to(`ride:${ride.id}`).emit('driver:location', { lat: ride.driverLat, lng: ride.driverLng });
    }
  }

  const profileDoc = await DriverDocument.findOne({
    where: { userId: req.user.id, documentType: 'profile_photo' },
  });

  const driverJson = driver.toJSON();
  driverJson.profilePhoto = profileDoc ? fileToUrl(profileDoc.filePath) : null;

  const passenger = await User.findByPk(ride.passengerId, { attributes: ['id', 'name'] });
  let passengerJson = null;
  if (passenger) {
    passengerJson = passenger.toJSON();
    passengerJson.selfiePath = ride.selfiePath ? fileToUrl(ride.selfiePath) : null;
  }

  logger.info(`Ride ${ride.id} accepted by driver ${req.user.email}`);

  res.status(200).json({
    success: true,
    data: { ride, driver: driverJson, passenger: passengerJson },
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

  let targetStatus = status;
  let checkoutUrl = null;

  if (status === 'completed' && ride.paymentMethod === 'cash') {
    targetStatus = 'awaiting_payment';
  }

  if (status === 'completed' && ride.paymentMethod === 'wallet') {
    targetStatus = 'completed';
    const passengerWallet = await Wallet.findOne({ where: { userId: ride.passengerId } });
    if (passengerWallet && parseFloat(passengerWallet.balance) >= parseFloat(ride.fare)) {
      passengerWallet.balance = parseFloat(passengerWallet.balance) - parseFloat(ride.fare);
      await passengerWallet.save();

      await Transaction.create({
        userId: ride.passengerId,
        type: 'ride_payment',
        amount: ride.fare,
        direction: 'debit',
        description: `Ride payment (${ride.id.slice(0, 8)}...)`,
        referenceId: ride.id,
        referenceType: 'ride',
        status: 'completed',
      });

      if (ride.driverId) {
        const driverWallet = await Wallet.findOne({ where: { userId: ride.driverId } });
        if (driverWallet) {
          driverWallet.balance = parseFloat(driverWallet.balance) + parseFloat(ride.fare);
          await driverWallet.save();
        } else {
          await Wallet.create({ userId: ride.driverId, balance: parseFloat(ride.fare) });
        }

        await Transaction.create({
          userId: ride.driverId,
          type: 'ride_earnings',
          amount: ride.fare,
          direction: 'credit',
          description: `Ride earnings (${ride.id.slice(0, 8)}...)`,
          referenceId: ride.id,
          referenceType: 'ride',
          status: 'completed',
        });
      }

      ride.paymentStatus = 'paid';
      logger.info(`Wallet payment processed for ride ${ride.id}: ${ride.fare} PKR`);
      sendRideReceiptToPassenger(ride.id);
      sendDriverRideCompleted(ride.id);
    } else {
      targetStatus = 'payment_dispute';
      await Dispute.create({
        rideId: ride.id,
        reportedBy: req.user.id,
        disputeType: 'digital_payment_failure',
        description: 'Insufficient wallet balance.',
        status: 'open',
      });
      logger.warn(`Insufficient wallet balance for ride ${ride.id}`);
    }
  }

  if (status === 'completed' && ride.paymentMethod === 'stripe') {
    targetStatus = 'awaiting_payment';
    try {
      const amount = parseFloat(ride.fare);
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        mode: 'payment',
        client_reference_id: ride.id,
        customer_email: req.user.email,
        line_items: [{
          price_data: {
            currency: 'pkr',
            product_data: { name: 'PinkDrive Ride', description: `${ride.pickupAddress || ''} → ${ride.dropoffAddress || ''}` },
            unit_amount: Math.round(amount * 100),
          },
          quantity: 1,
        }],
        success_url: `${process.env.CLIENT_URL}/payment/result?session_id={CHECKOUT_SESSION_ID}&status=success`,
        cancel_url: `${process.env.CLIENT_URL}/payment/result?status=cancelled`,
      });
      ride.stripeSessionId = session.id;
      checkoutUrl = session.url;
      logger.info(`Auto Stripe session created for completed ride ${ride.id}`);
    } catch (err) {
      logger.error(`Stripe auto-charge failed for ride ${ride.id}:`, err.message);
    }
  }

  if (status === 'completed' && !['cash', 'wallet', 'stripe'].includes(ride.paymentMethod)) {
    targetStatus = 'completed';
  }

  ride.status = targetStatus;
  if (targetStatus === 'completed') ride.completedAt = new Date();
  await ride.save();

  const io = getIO();
  if (io) {
    io.to(`ride:${ride.id}`).emit('ride:status', { rideId: ride.id, status: targetStatus, checkoutUrl });
  }

  logger.info(`Ride ${ride.id} status updated to ${targetStatus} by driver ${req.user.email}`);

  res.status(200).json({
    success: true,
    data: { ride, checkoutUrl },
    message: targetStatus === 'awaiting_payment'
      ? 'Ride completed. Awaiting payment confirmation from passenger.'
      : checkoutUrl
        ? 'Ride completed. Proceed to payment.'
        : `Ride status updated to "${targetStatus}".`,
  });
});

exports.confirmPayment = catchAsync(async (req, res, next) => {
  const ride = await Ride.findByPk(req.params.id);
  if (!ride) return next(new AppError('Ride not found.', 404));
  if (ride.driverId !== req.user.id) {
    return next(new AppError('Only the assigned driver can confirm payment.', 403));
  }
  if (ride.status !== 'awaiting_payment') {
    return next(new AppError('Ride is not awaiting payment confirmation.', 400));
  }

  ride.paymentStatus = 'paid';
  ride.status = 'completed';
  ride.completedAt = new Date();
  await ride.save();

  const io = getIO();
  if (io) {
    io.to(`ride:${ride.id}`).emit('ride:status', { rideId: ride.id, status: 'completed' });
  }

  logger.info(`Payment confirmed for ride ${ride.id} by driver ${req.user.email}`);

  sendRideReceiptToPassenger(ride.id);
  sendDriverRideCompleted(ride.id);

  res.status(200).json({ success: true, message: 'Payment confirmed. Ride completed.' });
});

exports.acknowledgePayment = catchAsync(async (req, res, next) => {
  const ride = await Ride.findByPk(req.params.id);
  if (!ride) return next(new AppError('Ride not found.', 404));
  if (ride.passengerId !== req.user.id) {
    return next(new AppError('Only the passenger can acknowledge payment.', 403));
  }
  if (ride.status !== 'awaiting_payment') {
    return next(new AppError('Ride is not awaiting payment confirmation.', 400));
  }

  ride.paymentStatus = 'paid';
  ride.status = 'completed';
  ride.completedAt = new Date();
  await ride.save();

  const io = getIO();
  if (io) {
    io.to(`ride:${ride.id}`).emit('ride:status', { rideId: ride.id, status: 'completed' });
  }

  logger.info(`Payment acknowledged for ride ${ride.id} by passenger ${req.user.email}`);

  sendRideReceiptToPassenger(ride.id);
  sendDriverRideCompleted(ride.id);

  res.status(200).json({ success: true, message: 'Payment acknowledged. Ride completed.' });
});

exports.reportIssue = catchAsync(async (req, res, next) => {
  const { disputeType, description } = req.body;

  if (!disputeType) {
    return next(new AppError('Dispute type is required.', 400));
  }

  const validTypes = ['passenger_refused_payment', 'partial_payment', 'driver_extra_fare', 'driver_false_claim', 'passenger_false_claim'];
  if (!validTypes.includes(disputeType)) {
    return next(new AppError(`Invalid dispute type. Must be one of: ${validTypes.join(', ')}`, 400));
  }

  const ride = await Ride.findByPk(req.params.id);
  if (!ride) return next(new AppError('Ride not found.', 404));
  if (ride.passengerId !== req.user.id && ride.driverId !== req.user.id) {
    return next(new AppError('Only the ride passenger or driver can report an issue.', 403));
  }

  if (!['awaiting_payment', 'in_progress', 'accepted'].includes(ride.status)) {
    return next(new AppError('Cannot report issue for this ride status.', 400));
  }

  const dispute = await Dispute.create({
    rideId: ride.id,
    reportedBy: req.user.id,
    disputeType,
    description: description || '',
    status: 'open',
  });

  ride.status = 'payment_dispute';
  await ride.save();

  const io = getIO();
  if (io) {
    io.to(`ride:${ride.id}`).emit('ride:status', { rideId: ride.id, status: 'payment_dispute' });
  }

  logger.info(`Dispute ${dispute.id} filed for ride ${ride.id} by ${req.user.email}`);

  res.status(201).json({
    success: true,
    data: { dispute },
    message: 'Issue reported. Admin will review shortly.',
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

  if (ride.paymentStatus === 'paid' && ride.stripeSessionId) {
    try {
      await stripe.refunds.create({ payment_intent: ride.stripeSessionId });
      ride.paymentStatus = 'refunded';
      logger.info(`Refund issued for ride ${ride.id}`);
      sendRefundNotification(ride.id, ride.fare);
    } catch (err) {
      logger.error(`Refund failed for ride ${ride.id}:`, err.message);
    }
  }

  await ride.save();

  const io = getIO();
  if (io) {
    io.to(`ride:${ride.id}`).emit('ride:status', { rideId: ride.id, status: 'cancelled' });
  }

  logger.info(`Ride ${ride.id} cancelled by passenger ${req.user.email}`);

  res.status(200).json({
    success: true,
    message: 'Ride cancelled.',
  });
});

exports.getRideHistory = catchAsync(async (req, res, next) => {
  const rides = await Ride.findAll({
    where: {
      [Op.and]: [
        {
          [Op.or]: [
            { passengerId: req.user.id },
            { driverId: req.user.id },
          ],
        },
        {
          [Op.or]: [
            { status: 'completed' },
            { status: 'cancelled' },
            { status: 'payment_dispute' },
          ],
        },
      ],
    },
    order: [['createdAt', 'DESC']],
    limit: 50,
  });

  const driverIds = [...new Set(rides.map((r) => r.driverId).filter(Boolean))];
  const passengerIds = [...new Set(rides.map((r) => r.passengerId).filter(Boolean))];
  const [drivers, passengers] = await Promise.all([
    User.findAll({ where: { id: driverIds }, attributes: ['id', 'name', 'phone'] }),
    User.findAll({ where: { id: passengerIds }, attributes: ['id', 'name'] }),
  ]);
  const driverMap = Object.fromEntries(drivers.map((d) => [d.id, d]));
  const passengerMap = Object.fromEntries(passengers.map((p) => [p.id, p]));

  const data = rides.map((r) => ({
    ...r.toJSON(),
    driver: r.driverId ? driverMap[r.driverId] || null : null,
    passenger: r.passengerId ? passengerMap[r.passengerId] || null : null,
  }));

  res.status(200).json({ success: true, data: { rides: data } });
});

exports.getRideById = catchAsync(async (req, res, next) => {
  const ride = await Ride.findByPk(req.params.id);
  if (!ride) return next(new AppError('Ride not found.', 404));
  if (ride.passengerId !== req.user.id && ride.driverId !== req.user.id) {
    return next(new AppError('Unauthorized.', 403));
  }

  let driver = null;
  let passenger = null;
  if (ride.driverId) {
    driver = await User.findByPk(ride.driverId, { attributes: ['id', 'name', 'phone'] });
    const profileDoc = await DriverDocument.findOne({
      where: { userId: ride.driverId, documentType: 'profile_photo' },
    });
    if (driver) {
      driver = driver.toJSON();
      driver.profilePhoto = profileDoc ? fileToUrl(profileDoc.filePath) : null;
    }
  }
  passenger = await User.findByPk(ride.passengerId, { attributes: ['id', 'name'] });
  if (passenger) {
    passenger = passenger.toJSON();
    passenger.selfiePath = ride.selfiePath ? fileToUrl(ride.selfiePath) : null;
  }

  res.status(200).json({ success: true, data: { ride, driver, passenger } });
});

exports.updateDriverLocation = catchAsync(async (req, res, next) => {
  const { lat, lng } = req.body;
  if (lat == null || lng == null) {
    return next(new AppError('Latitude and longitude are required.', 400));
  }

  const ride = await Ride.findByPk(req.params.id);
  if (!ride) return next(new AppError('Ride not found.', 404));
  if (ride.driverId !== req.user.id) {
    return next(new AppError('Only the assigned driver can update location.', 403));
  }

  ride.driverLat = lat;
  ride.driverLng = lng;
  await ride.save();

  res.status(200).json({ success: true, message: 'Location updated.' });
});

exports.getNearbyDrivers = catchAsync(async (req, res, next) => {
  const { lat, lng, radius } = req.query;
  if (!lat || !lng) {
    return next(new AppError('Latitude and longitude are required.', 400));
  }

  const maxDist = parseFloat(radius) || 10;
  const centerLat = parseFloat(lat);
  const centerLng = parseFloat(lng);

  const drivers = await Ride.findAll({
    where: {
      driverId: { [Op.ne]: null },
      status: { [Op.notIn]: ['completed', 'cancelled'] },
    },
    attributes: ['driverId'],
  });
  const busyDriverIds = new Set(drivers.map((r) => r.driverId));

  const activeDriverIds = Object.keys(getOnlineDrivers());

  const available = await User.findAll({
    where: {
      id: activeDriverIds,
      role: 'driver',
      isDriverVerified: true,
      currentLat: { [Op.ne]: null },
      currentLng: { [Op.ne]: null },
    },
    attributes: ['id', 'name', 'currentLat', 'currentLng', 'lastActiveAt'],
  });

  const nearby = available.filter((d) => {
    if (busyDriverIds.has(d.id)) return false;
    const dist = haversineDistance(centerLat, centerLng, d.currentLat, d.currentLng);
    return dist <= maxDist;
  }).map((d) => ({
    id: d.id,
    name: d.name,
    lat: d.currentLat,
    lng: d.currentLng,
    lastActiveAt: d.lastActiveAt,
  }));

  res.status(200).json({ success: true, data: { drivers: nearby } });
});
