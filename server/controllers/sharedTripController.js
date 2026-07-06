const { Op } = require('sequelize');
const User = require('../models/User');
const SharedTrip = require('../models/SharedTrip');
const TripRequest = require('../models/TripRequest');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');
const logger = require('../utils/logger');
const { reverseGeocode, haversineDistance, distanceToLineSegment, fileToUrl } = require('../utils/geo');
const { getIO } = require('../sockets');

const ROUTE_CORRIDOR_KM = 5;

exports.createTrip = catchAsync(async (req, res, next) => {
  const { pickupLat, pickupLng, dropoffLat, dropoffLng, departureTime, availableSeats, pricePerSeat, paymentMethod } = req.body;

  if (!pickupLat || !pickupLng || !dropoffLat || !dropoffLng || !departureTime || !availableSeats || !pricePerSeat) {
    return next(new AppError('All fields are required: pickup, dropoff, departure time, seats, price.', 400));
  }

  const activeRide = await SharedTrip.findOne({
    where: { driverId: req.user.id, status: { [Op.in]: ['active'] } },
  });
  if (activeRide) {
    return next(new AppError('You already have an active shared trip. Complete or cancel it first.', 400));
  }

  const activePrivate = await require('../models/Ride').findOne({
    where: { driverId: req.user.id, status: { [Op.in]: ['accepted', 'arrived', 'in_progress'] } },
  });
  if (activePrivate) {
    return next(new AppError('You are currently on a private ride. Complete it first.', 400));
  }

  const pickupAddress = await reverseGeocode(pickupLat, pickupLng);
  await new Promise((r) => setTimeout(r, 1100));
  const dropoffAddress = await reverseGeocode(dropoffLat, dropoffLng);

  const trip = await SharedTrip.create({
    driverId: req.user.id,
    pickupLat,
    pickupLng,
    pickupAddress,
    dropoffLat,
    dropoffLng,
    dropoffAddress,
    departureTime: new Date(departureTime),
    availableSeats: parseInt(availableSeats, 10),
    pricePerSeat: parseFloat(pricePerSeat),
    paymentMethod: paymentMethod || 'cash',
    status: 'active',
  });

  logger.info(`SharedTrip created: ${trip.id} by driver ${req.user.email}, seats: ${availableSeats}, price: ${pricePerSeat}`);

  const io = getIO();
  if (io) {
    const driver = await User.findByPk(req.user.id, { attributes: ['id', 'name', 'profilePhoto'] });
    io.emit('trip:created', {
      tripId: trip.id,
      driverId: req.user.id,
      driverName: driver?.name,
      driverPhoto: driver?.profilePhoto,
      pickupLat: trip.pickupLat,
      pickupLng: trip.pickupLng,
      pickupAddress: trip.pickupAddress,
      dropoffLat: trip.dropoffLat,
      dropoffLng: trip.dropoffLng,
      dropoffAddress: trip.dropoffAddress,
      departureTime: trip.departureTime,
      availableSeats: trip.availableSeats,
      pricePerSeat: parseFloat(trip.pricePerSeat),
      paymentMethod: trip.paymentMethod,
    });
  }

  res.status(201).json({
    success: true,
    data: { trip },
    message: 'Shared trip created. Waiting for passengers.',
  });
});

exports.getAvailableTrips = catchAsync(async (req, res, next) => {
  const { lat, lng } = req.query;

  const trips = await SharedTrip.findAll({
    where: { status: 'active', departureTime: { [Op.gte]: new Date() } },
    order: [['departureTime', 'ASC']],
  });

  const driverIds = [...new Set(trips.map((t) => t.driverId))];
  const drivers = driverIds.length > 0 ? await User.findAll({
    where: { id: driverIds },
    attributes: ['id', 'name', 'profilePhoto'],
  }) : [];
  const driverMap = Object.fromEntries(drivers.map((d) => [d.id, d]));

  let matching = trips;
  if (lat && lng) {
    const pLat = parseFloat(lat);
    const pLng = parseFloat(lng);
    if (!isNaN(pLat) && !isNaN(pLng)) {
      matching = trips.filter((t) => {
        const dist = distanceToLineSegment(pLat, pLng, t.pickupLat, t.pickupLng, t.dropoffLat, t.dropoffLng);
        return dist <= ROUTE_CORRIDOR_KM;
      });
    }
  }

  const data = matching.map((t) => {
    const driver = driverMap[t.driverId];
    return {
      ...t.toJSON(),
      driverName: driver?.name,
      driverPhoto: driver?.profilePhoto ? fileToUrl(driver.profilePhoto) : null,
    };
  });

  res.status(200).json({ success: true, data: { trips: data } });
});

exports.getMyTrips = catchAsync(async (req, res, next) => {
  const trips = await SharedTrip.findAll({
    where: { driverId: req.user.id },
    order: [['createdAt', 'DESC']],
  });

  res.status(200).json({ success: true, data: { trips } });
});

exports.getMyRequests = catchAsync(async (req, res, next) => {
  const requests = await TripRequest.findAll({
    where: { passengerId: req.user.id },
    include: [{ model: SharedTrip, as: 'trip', attributes: ['id', 'pickupAddress', 'dropoffAddress', 'departureTime', 'pricePerSeat'] }],
    order: [['createdAt', 'DESC']],
  });

  res.status(200).json({ success: true, data: { requests } });
});

exports.requestJoin = catchAsync(async (req, res, next) => {
  const { tripId } = req.params;
  const { pickupLat, pickupLng, dropoffLat, dropoffLng } = req.body;

  if (!pickupLat || !pickupLng || !dropoffLat || !dropoffLng) {
    return next(new AppError('Pickup and dropoff locations are required.', 400));
  }

  const trip = await SharedTrip.findByPk(tripId);
  if (!trip) return next(new AppError('Trip not found.', 404));
  if (trip.status !== 'active') return next(new AppError('This trip is no longer accepting requests.', 400));
  if (trip.availableSeats < 1) return next(new AppError('No seats available on this trip.', 400));
  if (trip.driverId === req.user.id) return next(new AppError('You cannot request your own trip.', 400));

  try {
    const activeReq = await TripRequest.findOne({
      where: { passengerId: req.user.id, tripId, status: 'pending' },
    });
    if (activeReq) return next(new AppError('You already have a pending request for this trip.', 400));
  } catch { /* best-effort */ }

  const distToRoute = distanceToLineSegment(pickupLat, pickupLng, trip.pickupLat, trip.pickupLng, trip.dropoffLat, trip.dropoffLng);
  if (distToRoute > ROUTE_CORRIDOR_KM) {
    return next(new AppError('Your pickup location is not along this trip\'s route.', 400));
  }

  const pickupAddress = await reverseGeocode(pickupLat, pickupLng);
  await new Promise((r) => setTimeout(r, 1100));
  const dropoffAddress = await reverseGeocode(dropoffLat, dropoffLng);

  const request = await TripRequest.create({
    tripId,
    passengerId: req.user.id,
    pickupLat,
    pickupLng,
    pickupAddress,
    dropoffLat,
    dropoffLng,
    dropoffAddress,
    status: 'pending',
  });

  logger.info(`TripRequest ${request.id} created for trip ${tripId} by passenger ${req.user.email}`);

  const io = getIO();
  if (io) {
    const passenger = await User.findByPk(req.user.id, {
      attributes: ['id', 'name', 'profilePhoto'],
    });
    io.to(`driver:${trip.driverId}`).emit('trip:request:new', {
      requestId: request.id,
      tripId,
      passengerId: req.user.id,
      passengerName: passenger?.name,
      passengerPhoto: passenger?.profilePhoto ? fileToUrl(passenger.profilePhoto) : null,
      pickupLat,
      pickupLng,
      pickupAddress,
      dropoffLat,
      dropoffLng,
      dropoffAddress,
      createdAt: request.createdAt,
    });
  }

  res.status(201).json({
    success: true,
    data: { request },
    message: 'Request sent to driver.',
  });
});

exports.getTripRequests = catchAsync(async (req, res, next) => {
  const { tripId } = req.params;

  const trip = await SharedTrip.findByPk(tripId);
  if (!trip) return next(new AppError('Trip not found.', 404));
  if (trip.driverId !== req.user.id) return next(new AppError('Unauthorized.', 403));

  const requests = await TripRequest.findAll({
    where: { tripId, status: 'pending' },
    order: [['createdAt', 'DESC']],
  });

  const passengerIds = [...new Set(requests.map((r) => r.passengerId))];
  const passengers = passengerIds.length > 0 ? await User.findAll({
    where: { id: passengerIds },
    attributes: ['id', 'name', 'profilePhoto', 'phone'],
  }) : [];
  const passengerMap = Object.fromEntries(passengers.map((p) => [p.id, p]));

  const data = requests.map((r) => {
    const p = passengerMap[r.passengerId];
    return {
      ...r.toJSON(),
      passengerName: p?.name,
      passengerPhoto: p?.profilePhoto ? fileToUrl(p.profilePhoto) : null,
      passengerPhone: p?.phone,
    };
  });

  res.status(200).json({ success: true, data: { requests: data } });
});

exports.acceptRequest = catchAsync(async (req, res, next) => {
  const { requestId } = req.params;

  const request = await TripRequest.findByPk(requestId);
  if (!request) return next(new AppError('Request not found.', 404));
  if (request.status !== 'pending') return next(new AppError('Request is no longer pending.', 400));

  const trip = await SharedTrip.findByPk(request.tripId);
  if (!trip) return next(new AppError('Trip not found.', 404));
  if (trip.driverId !== req.user.id) return next(new AppError('Unauthorized.', 403));
  if (trip.status !== 'active') return next(new AppError('Trip is no longer active.', 400));
  if (trip.availableSeats < 1) return next(new AppError('No seats available.', 400));

  request.status = 'accepted';
  await request.save();

  trip.availableSeats = trip.availableSeats - 1;
  if (trip.availableSeats <= 0) {
    trip.availableSeats = 0;
    trip.status = 'full';
  }
  await trip.save();

  logger.info(`TripRequest ${request.id} accepted for trip ${trip.id}. Seats left: ${trip.availableSeats}`);

  const io = getIO();
  if (io) {
    const driver = await User.findByPk(req.user.id, { attributes: ['id', 'name', 'profilePhoto'] });
    io.to(`passenger:${request.passengerId}`).emit('trip:request:accepted', {
      requestId: request.id,
      tripId: trip.id,
      driverName: driver?.name,
      driverPhoto: driver?.profilePhoto ? fileToUrl(driver.profilePhoto) : null,
      pickupAddress: request.pickupAddress,
      dropoffAddress: request.dropoffAddress,
      departureTime: trip.departureTime,
    });

    io.emit('trip:seats:update', {
      tripId: trip.id,
      availableSeats: trip.availableSeats,
      status: trip.status,
    });
  }

  res.status(200).json({
    success: true,
    data: { request, trip },
    message: 'Passenger accepted. Seats updated.',
  });
});

exports.declineRequest = catchAsync(async (req, res, next) => {
  const { requestId } = req.params;
  const { reason } = req.body;

  const request = await TripRequest.findByPk(requestId);
  if (!request) return next(new AppError('Request not found.', 404));
  if (request.status !== 'pending') return next(new AppError('Request is no longer pending.', 400));

  const trip = await SharedTrip.findByPk(request.tripId);
  if (!trip) return next(new AppError('Trip not found.', 404));
  if (trip.driverId !== req.user.id) return next(new AppError('Unauthorized.', 403));

  request.status = 'declined';
  request.declineReason = reason || null;
  await request.save();

  logger.info(`TripRequest ${request.id} declined for trip ${trip.id}. Reason: ${reason || 'none'}`);

  const io = getIO();
  if (io) {
    io.to(`passenger:${request.passengerId}`).emit('trip:request:declined', {
      requestId: request.id,
      tripId: trip.id,
      reason: reason || null,
    });
  }

  res.status(200).json({
    success: true,
    message: 'Request declined.',
  });
});

exports.cancelTrip = catchAsync(async (req, res, next) => {
  const { tripId } = req.params;

  const trip = await SharedTrip.findByPk(tripId);
  if (!trip) return next(new AppError('Trip not found.', 404));
  if (trip.driverId !== req.user.id) return next(new AppError('Unauthorized.', 403));
  if (trip.status !== 'active') return next(new AppError('Trip is not active.', 400));

  trip.status = 'cancelled';
  await trip.save();

  await TripRequest.update(
    { status: 'cancelled' },
    { where: { tripId, status: 'pending' } },
  );

  const io = getIO();
  if (io) {
    io.emit('trip:cancelled', { tripId });
  }

  logger.info(`SharedTrip ${tripId} cancelled by driver ${req.user.email}`);

  res.status(200).json({ success: true, message: 'Trip cancelled.' });
});
