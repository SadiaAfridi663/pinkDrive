const { Op } = require('sequelize');
const User = require('../models/User');
const Ride = require('../models/Ride');
const Dispute = require('../models/Dispute');
const Debt = require('../models/Debt');
const Wallet = require('../models/Wallet');
const Transaction = require('../models/Transaction');
const DriverDocument = require('../models/DriverDocument');
const Bid = require('../models/Bid');
const Notification = require('../models/Notification');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');
const logger = require('../utils/logger');
const { reverseGeocodeBoth, haversineDistance, fileToUrl, isPointInPolygon, hydrateRideAddresses } = require('../utils/geo');
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
  const { pickupLat, pickupLng, dropoffLat, dropoffLng, selfiePath, paymentMethod, passengerOffer } = req.body;

  if (!pickupLat || !pickupLng || !dropoffLat || !dropoffLng) {
    return next(new AppError('Pickup and drop-off locations are required.', 400));
  }

  if (!selfiePath) {
    return next(new AppError('Selfie is required before requesting a ride.', 400));
  }

  if (!passengerOffer || parseFloat(passengerOffer) <= 0) {
    return next(new AppError('Please enter your offer amount.', 400));
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
    passengerOffer: parseFloat(passengerOffer),
    fare: 0,
    paymentMethod: paymentMethod || 'cash',
    paymentStatus: 'pending',
    status: 'pending',
  });

  logger.info(`Ride created: ${ride.id} by passenger ${req.user.email}, offer: ${passengerOffer} PKR`);

  // Notify nearby drivers
  const io = getIO();
  const onlineDrivers = getOnlineDrivers();
  const onlineIds = Object.keys(onlineDrivers).filter((k) => !k.includes(':'));

  if (onlineIds.length > 0) {
    const drivers = await User.findAll({
      where: {
        id: onlineIds,
        role: 'driver',
        isDriverVerified: true,
      },
      attributes: ['id', 'name'],
    });

    const nearbyDrivers = drivers.filter((d) => {
      const od = onlineDrivers[d.id];
      // Use real-time location from socket if available
      const lat = od?.lat ?? d.currentLat;
      const lng = od?.lng ?? d.currentLng;
      if (lat == null || lng == null) return true; // no location yet — still notify
      const dist = haversineDistance(pickupLat, pickupLng, lat, lng);
      return dist <= 10;
    });

    for (const driver of nearbyDrivers) {
      const socketId = onlineDrivers[driver.id]?.socketId;
      if (socketId) {
        io.to(socketId).emit('ride:available', {
          rideId: ride.id,
          pickupLat,
          pickupLng,
          pickupAddress,
          dropoffLat,
          dropoffLng,
          dropoffAddress,
          distance,
          passengerOffer: parseFloat(passengerOffer),
          passengerName: passenger.name,
          createdAt: ride.createdAt,
        });
      }
    }
  }

  const SharedTrip = require('../models/SharedTrip');
  const availableTrips = await SharedTrip.findAll({
    where: { status: 'active', availableSeats: { [Op.gt]: 0 } },
  });
  const matchingTrips = [];
  for (const trip of availableTrips) {
    const { distanceToLineSegment } = require('../utils/geo');
    const dist = distanceToLineSegment(pickupLat, pickupLng, trip.pickupLat, trip.pickupLng, trip.dropoffLat, trip.dropoffLng);
    if (dist <= 5) {
      const driver = await User.findByPk(trip.driverId, { attributes: ['id', 'name', 'profilePhoto'] });
      matchingTrips.push({
        tripId: trip.id,
        driverName: driver?.name,
        driverPhoto: driver?.profilePhoto ? fileToUrl(driver.profilePhoto) : null,
        pickupAddress: trip.pickupAddress,
        dropoffAddress: trip.dropoffAddress,
        departureTime: trip.departureTime,
        availableSeats: trip.availableSeats,
        pricePerSeat: parseFloat(trip.pricePerSeat),
        distanceToRoute: Math.round(dist * 100) / 100,
      });
    }
  }

  res.status(201).json({
    success: true,
    data: { ride, availableSharedTrips: matchingTrips },
    message: matchingTrips.length > 0
      ? 'Ride requested. Shared trips available along your route!'
      : 'Ride requested. Drivers will be notified.',
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

  await hydrateRideAddresses(ride);

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

  const { isDebtLocked, MAX_COMMISSION_DEBT } = require('../utils/commission');
  const wallet = await Wallet.findOne({ where: { userId: req.user.id } });
  if (wallet && isDebtLocked(wallet)) {
    return res.status(200).json({
      success: true,
      data: {
        rides: [],
        blocked: true,
        message: `Your account has outstanding commission dues of ${parseFloat(wallet.commissionDue).toFixed(0)} PKR. Please recharge your wallet to continue receiving rides.`,
      },
    });
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

  const { isDebtLocked } = require('../utils/commission');
  const wallet = await Wallet.findOne({ where: { userId: req.user.id } });
  if (wallet && isDebtLocked(wallet)) {
    return next(new AppError(`Your account has outstanding commission dues of ${parseFloat(wallet.commissionDue).toFixed(0)} PKR. Please recharge your wallet to continue receiving rides.`, 403));
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

  const SharedTrip = require('../models/SharedTrip');
  const activeTrip = await SharedTrip.findOne({
    where: { driverId: req.user.id, status: { [Op.in]: ['active'] } },
  });
  if (activeTrip) {
    return next(new AppError('You have an active shared trip. Complete or cancel it first.', 400));
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

  try {
    await Notification.create({
      userId: ride.passengerId,
      type: 'ride_status',
      title: 'Ride Accepted',
      message: `${driver?.name || 'A driver'} has accepted your ride and is on the way.`,
      data: { rideId: ride.id, status: 'accepted' },
    });
    if (io) {
      io.to(`user:${ride.passengerId}`).emit('notification:new', {
        id: `notif-${Date.now()}`,
        type: 'ride_status',
        title: 'Ride Accepted',
        message: `${driver?.name || 'A driver'} has accepted your ride.`,
        data: { rideId: ride.id, status: 'accepted' },
        createdAt: new Date().toISOString(),
      });
    }
  } catch { /* best-effort */ }

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

  const { sequelize } = require('../config/db.sql');
  const { calculateCommission } = require('../utils/commission');

  if (status === 'completed') {
    const { platformFee, driverEarning } = calculateCommission(ride.fare);
    ride.platformFee = platformFee;
    ride.driverEarning = driverEarning;

    if (ride.paymentMethod === 'cash') {
      targetStatus = 'awaiting_payment';
    }

    if (ride.paymentMethod === 'wallet') {
      targetStatus = 'completed';
      const t = await sequelize.transaction();
      try {
        const passengerWallet = await Wallet.findOne({ where: { userId: ride.passengerId }, transaction: t });
        if (passengerWallet && parseFloat(passengerWallet.balance) >= parseFloat(ride.fare)) {
          passengerWallet.balance = Math.round((parseFloat(passengerWallet.balance) - parseFloat(ride.fare)) * 100) / 100;
          await passengerWallet.save({ transaction: t });

          await Transaction.create({
            userId: ride.passengerId,
            type: 'ride_payment',
            amount: ride.fare,
            direction: 'debit',
            description: `Ride payment (${ride.id.slice(0, 8)}...)`,
            referenceId: ride.id,
            referenceType: 'ride',
            rideId: ride.id,
            status: 'completed',
          }, { transaction: t });

          if (ride.driverId) {
            let driverWallet = await Wallet.findOne({ where: { userId: ride.driverId }, transaction: t });
            if (!driverWallet) {
              driverWallet = await Wallet.create({ userId: ride.driverId, balance: 0, commissionDue: 0, totalEarnings: 0, totalWithdrawn: 0 }, { transaction: t });
            }
            driverWallet.balance = Math.round((parseFloat(driverWallet.balance) + driverEarning) * 100) / 100;
            driverWallet.totalEarnings = Math.round((parseFloat(driverWallet.totalEarnings) + driverEarning) * 100) / 100;
            await driverWallet.save({ transaction: t });

            await Transaction.create({
              userId: ride.driverId,
              type: 'ride_earnings',
              amount: driverEarning,
              direction: 'credit',
              description: `Ride earnings (${ride.id.slice(0, 8)}...)`,
              referenceId: ride.id,
              referenceType: 'ride',
              rideId: ride.id,
              status: 'completed',
            }, { transaction: t });
          }

          ride.paymentStatus = 'paid';
          await t.commit();
          logger.info(`Wallet payment processed for ride ${ride.id}: fare=${ride.fare}, fee=${platformFee}, driver=${driverEarning}`);
          sendRideReceiptToPassenger(ride.id);
          sendDriverRideCompleted(ride.id);
        } else {
          await t.rollback();
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
      } catch (err) {
        await t.rollback();
        logger.error(`Wallet payment transaction failed for ride ${ride.id}:`, err.message);
        return next(new AppError('Payment processing failed.', 500));
      }
    }

    if (ride.paymentMethod === 'stripe') {
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

    if (!['cash', 'wallet', 'stripe'].includes(ride.paymentMethod)) {
      targetStatus = 'completed';
    }
  }

  ride.status = targetStatus;
  if (targetStatus === 'completed') ride.completedAt = new Date();
  await ride.save();

  const io = getIO();
  if (io) {
    io.to(`ride:${ride.id}`).emit('ride:status', { rideId: ride.id, status: targetStatus, checkoutUrl });
  }

  const statusLabels = {
    arrived: 'Driver has arrived at your pickup location',
    in_progress: 'Your ride is in progress',
    awaiting_payment: 'Ride completed. Payment is pending.',
    completed: 'Ride completed successfully',
  };
  if (statusLabels[targetStatus]) {
    try {
      await Notification.create({
        userId: ride.passengerId,
        type: 'ride_status',
        title: `Ride ${targetStatus.replace(/_/g, ' ')}`,
        message: statusLabels[targetStatus],
        data: { rideId: ride.id, status: targetStatus },
      });
      if (io) {
        io.to(`user:${ride.passengerId}`).emit('notification:new', {
          id: `notif-${Date.now()}`,
          type: 'ride_status',
          title: `Ride ${targetStatus.replace(/_/g, ' ')}`,
          message: statusLabels[targetStatus],
          data: { rideId: ride.id, status: targetStatus },
          createdAt: new Date().toISOString(),
        });
      }
    } catch { /* best-effort */ }
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

  const { sequelize } = require('../config/db.sql');
  const { calculateCommission } = require('../utils/commission');
  const { platformFee, driverEarning } = calculateCommission(ride.fare);

  const t = await sequelize.transaction();
  try {
    ride.platformFee = platformFee;
    ride.driverEarning = driverEarning;
    ride.paymentStatus = 'paid';
    ride.status = 'completed';
    ride.completedAt = new Date();
    await ride.save({ transaction: t });

    if (ride.paymentMethod === 'cash' && ride.driverId) {
      let driverWallet = await Wallet.findOne({ where: { userId: ride.driverId }, transaction: t });
      if (!driverWallet) {
        driverWallet = await Wallet.create({ userId: ride.driverId, balance: 0, commissionDue: 0, totalEarnings: 0, totalWithdrawn: 0 }, { transaction: t });
      }
      driverWallet.commissionDue = Math.round((parseFloat(driverWallet.commissionDue) + platformFee) * 100) / 100;
      driverWallet.totalEarnings = Math.round((parseFloat(driverWallet.totalEarnings) + driverEarning) * 100) / 100;
      await driverWallet.save({ transaction: t });

      await Transaction.create({
        userId: ride.driverId,
        type: 'commission_charge',
        amount: platformFee,
        direction: 'debit',
        description: `Commission on cash ride (${ride.id.slice(0, 8)}...)`,
        rideId: ride.id,
        status: 'completed',
      }, { transaction: t });
    }

    await t.commit();
    logger.info(`Cash payment confirmed for ride ${ride.id}: fare=${ride.fare}, fee=${platformFee}, driver=${driverEarning}`);
  } catch (err) {
    await t.rollback();
    logger.error(`Cash payment confirmation failed for ride ${ride.id}:`, err.message);
    return next(new AppError('Failed to process payment confirmation.', 500));
  }

  const io = getIO();
  if (io) {
    io.to(`ride:${ride.id}`).emit('ride:status', { rideId: ride.id, status: 'completed' });
  }

  try {
    await Notification.create({
      userId: ride.passengerId,
      type: 'ride_status',
      title: 'Payment Confirmed',
      message: 'Your payment has been confirmed. Ride completed.',
      data: { rideId: ride.id, status: 'completed' },
    });
    if (io) {
      io.to(`user:${ride.passengerId}`).emit('notification:new', {
        id: `notif-${Date.now()}`,
        type: 'ride_status',
        title: 'Payment Confirmed',
        message: 'Your payment has been confirmed. Ride completed.',
        data: { rideId: ride.id, status: 'completed' },
        createdAt: new Date().toISOString(),
      });
    }
  } catch { /* best-effort */ }

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

  const { sequelize } = require('../config/db.sql');
  const { calculateCommission } = require('../utils/commission');
  const { platformFee, driverEarning } = calculateCommission(ride.fare);

  const t = await sequelize.transaction();
  try {
    ride.platformFee = platformFee;
    ride.driverEarning = driverEarning;
    ride.paymentStatus = 'paid';
    ride.status = 'completed';
    ride.completedAt = new Date();
    await ride.save({ transaction: t });

    if (ride.paymentMethod === 'cash' && ride.driverId) {
      let driverWallet = await Wallet.findOne({ where: { userId: ride.driverId }, transaction: t });
      if (!driverWallet) {
        driverWallet = await Wallet.create({ userId: ride.driverId, balance: 0, commissionDue: 0, totalEarnings: 0, totalWithdrawn: 0 }, { transaction: t });
      }
      driverWallet.commissionDue = Math.round((parseFloat(driverWallet.commissionDue) + platformFee) * 100) / 100;
      driverWallet.totalEarnings = Math.round((parseFloat(driverWallet.totalEarnings) + driverEarning) * 100) / 100;
      await driverWallet.save({ transaction: t });

      await Transaction.create({
        userId: ride.driverId,
        type: 'commission_charge',
        amount: platformFee,
        direction: 'debit',
        description: `Commission on cash ride (${ride.id.slice(0, 8)}...)`,
        rideId: ride.id,
        status: 'completed',
      }, { transaction: t });
    }

    await t.commit();
    logger.info(`Cash payment acknowledged for ride ${ride.id}: fare=${ride.fare}, fee=${platformFee}, driver=${driverEarning}`);
  } catch (err) {
    await t.rollback();
    logger.error(`Cash payment acknowledgement failed for ride ${ride.id}:`, err.message);
    return next(new AppError('Failed to process payment acknowledgement.', 500));
  }

  const io = getIO();
  if (io) {
    io.to(`ride:${ride.id}`).emit('ride:status', { rideId: ride.id, status: 'completed' });
  }

  try {
    await Notification.create({
      userId: ride.driverId,
      type: 'ride_status',
      title: 'Payment Acknowledged',
      message: 'Passenger has confirmed payment. Ride completed.',
      data: { rideId: ride.id, status: 'completed' },
    });
    if (io) {
      io.to(`user:${ride.driverId}`).emit('notification:new', {
        id: `notif-${Date.now()}`,
        type: 'ride_status',
        title: 'Payment Acknowledged',
        message: 'Passenger has confirmed payment. Ride completed.',
        data: { rideId: ride.id, status: 'completed' },
        createdAt: new Date().toISOString(),
      });
    }
  } catch { /* best-effort */ }

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

const BID_TTL_MS = 30000; // 30 seconds for each bid
const bidTimers = {};

exports.acceptOffer = catchAsync(async (req, res, next) => {
  const { bidId } = req.body;
  if (!bidId) return next(new AppError('Bid ID is required.', 400));

  const bid = await Bid.findByPk(bidId);
  if (!bid) return next(new AppError('Bid not found.', 404));
  if (bid.status !== 'active') return next(new AppError('This bid is no longer active.', 400));
  if (new Date() > new Date(bid.expiresAt)) {
    bid.status = 'expired';
    await bid.save();
    return next(new AppError('This bid has expired.', 400));
  }

  const ride = await Ride.findByPk(bid.rideId);
  if (!ride) return next(new AppError('Ride not found.', 404));
  if (ride.passengerId !== req.user.id) return next(new AppError('Unauthorized.', 403));
  if (ride.status !== 'pending') return next(new AppError('This ride is no longer accepting offers.', 400));

  bid.status = 'accepted';
  await bid.save();

  await Bid.update({ status: 'rejected' }, { where: { rideId: ride.id, id: { [Op.ne]: bidId }, status: 'active' } });

  ride.driverId = bid.driverId;
  ride.fare = bid.amount;
  ride.status = 'accepted';
  ride.startedAt = new Date();
  await ride.save();

  // Clear any pending bid timers for this ride
  if (bidTimers[ride.id]) {
    for (const timer of Object.values(bidTimers[ride.id])) clearTimeout(timer);
    delete bidTimers[ride.id];
  }

  const io = getIO();
  const driver = await User.findByPk(bid.driverId, { attributes: ['id', 'name', 'email', 'phone', 'profilePhoto'] });

  io.to(`ride:${ride.id}`).emit('offer:accepted', {
    rideId: ride.id,
    bidId: bid.id,
    driver: driver ? driver.toJSON() : null,
    fare: bid.amount,
    status: 'accepted',
  });

  try {
    await Notification.create({
      userId: bid.driverId,
      type: 'ride_status',
      title: 'Offer Accepted',
      message: 'Your offer has been accepted! You are now assigned to this ride.',
      data: { rideId: ride.id, bidId: bid.id, status: 'accepted' },
    });
    io.to(`user:${bid.driverId}`).emit('notification:new', {
      id: `notif-${Date.now()}`,
      type: 'ride_status',
      title: 'Offer Accepted',
      message: 'Your offer has been accepted! You are now assigned to this ride.',
      data: { rideId: ride.id, bidId: bid.id, status: 'accepted' },
      createdAt: new Date().toISOString(),
    });
  } catch { /* best-effort */ }

  logger.info(`Offer ${bid.id} accepted for ride ${ride.id}, driver ${bid.driverId}, amount ${bid.amount}`);

  res.status(200).json({
    success: true,
    data: { ride, driver },
    message: 'Offer accepted. Driver is on the way!',
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

  if (ride.driverId) {
    try {
      await Notification.create({
        userId: ride.driverId,
        type: 'ride_status',
        title: 'Ride Cancelled',
        message: 'The passenger has cancelled the ride.',
        data: { rideId: ride.id, status: 'cancelled' },
      });
      if (io) {
        io.to(`user:${ride.driverId}`).emit('notification:new', {
          id: `notif-${Date.now()}`,
          type: 'ride_status',
          title: 'Ride Cancelled',
          message: 'The passenger has cancelled the ride.',
          data: { rideId: ride.id, status: 'cancelled' },
          createdAt: new Date().toISOString(),
        });
      }
    } catch { /* best-effort */ }
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

  await hydrateRideAddresses(ride);

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

exports.getRideBids = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  logger.info(`getRideBids called for ride ${id} by user ${req.user.id}`);
  const activeBids = await Bid.findAll({
    where: { rideId: id, status: 'active', expiresAt: { [Op.gt]: new Date() } },
  });
  logger.info(`getRideBids found ${activeBids.length} active bid(s) for ride ${id}`);
  const driverIds = [...new Set(activeBids.map((b) => b.driverId))];
  const drivers = driverIds.length > 0 ? await User.findAll({
    where: { id: driverIds },
    attributes: ['id', 'name', 'profilePhoto'],
  }) : [];
  const driverMap = Object.fromEntries(drivers.map((d) => [d.id, d]));
  const data = activeBids.map((bid) => {
    const driver = driverMap[bid.driverId];
    return {
      bidId: bid.id,
      rideId: bid.rideId,
      driverId: bid.driverId,
      driverName: driver?.name,
      driverPhoto: driver?.profilePhoto,
      amount: parseFloat(bid.amount),
      expiresAt: bid.expiresAt,
    };
  });
  res.status(200).json({ success: true, data: { bids: data } });
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
