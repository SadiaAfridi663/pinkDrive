const { Op } = require('sequelize');
const User = require('../models/User');
const SharedTrip = require('../models/SharedTrip');
const TripRequest = require('../models/TripRequest');
const Notification = require('../models/Notification');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');
const logger = require('../utils/logger');
const { reverseGeocode, haversineDistance, distanceToLineSegment, fileToUrl } = require('../utils/geo');
const { getIO } = require('../sockets');

const ROUTE_CORRIDOR_KM = 10;

exports.createTrip = catchAsync(async (req, res, next) => {
  const { pickupLat, pickupLng, dropoffLat, dropoffLng, departureTime, availableSeats, pricePerSeat, paymentMethod } = req.body;

  if (!pickupLat || !pickupLng || !dropoffLat || !dropoffLng || !departureTime || !availableSeats || !pricePerSeat) {
    return next(new AppError('All fields are required: pickup, dropoff, departure time, seats, price.', 400));
  }

  const activeRide = await SharedTrip.findOne({
    where: { driverId: req.user.id, status: { [Op.in]: ['active', 'full', 'in_progress'] } },
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
  const { lat, lng, dropoffLat, dropoffLng } = req.query;

  const trips = await SharedTrip.findAll({
    where: { status: 'active', departureTime: { [Op.gte]: new Date() } },
    order: [['departureTime', 'ASC']],
  });

  const driverIds = [...new Set(trips.map((t) => t.driverId))];
  const drivers = driverIds.length > 0 ? await User.findAll({
    where: { id: driverIds },
    attributes: ['id', 'name', 'profilePhoto', 'phone'],
  }) : [];
  const driverMap = Object.fromEntries(drivers.map((d) => [d.id, d]));

  let matching = trips;
  if (lat && lng && dropoffLat && dropoffLng) {
    const pLat = parseFloat(lat);
    const pLng = parseFloat(lng);
    const dLat = parseFloat(dropoffLat);
    const dLng = parseFloat(dropoffLng);
    if (!isNaN(pLat) && !isNaN(pLng) && !isNaN(dLat) && !isNaN(dLng)) {
      logger.info(`Filtering ${trips.length} trips for passenger route ${pLat},${pLng} → ${dLat},${dLng}`);
      matching = trips.filter((t) => {
        const distPickup = distanceToLineSegment(pLat, pLng, t.pickupLat, t.pickupLng, t.dropoffLat, t.dropoffLng);
        const distDropoff = distanceToLineSegment(dLat, dLng, t.pickupLat, t.pickupLng, t.dropoffLat, t.dropoffLng);
        const isMatch = distPickup <= ROUTE_CORRIDOR_KM || distDropoff <= ROUTE_CORRIDOR_KM;
        if (isMatch) logger.info(`Trip ${t.id} matches! Pickup dist: ${distPickup.toFixed(2)}km, dropoff dist: ${distDropoff.toFixed(2)}km`);
        return isMatch;
      });
      logger.info(`Found ${matching.length} matching trips in corridor`);
    } else {
      logger.warn(`Invalid coords: lat=${lat} lng=${lng} dropoffLat=${dropoffLat} dropoffLng=${dropoffLng}`);
    }
  } else {
    logger.warn(`Missing coords — returning all ${trips.length} active trips. lat=${lat} lng=${lng} dropoffLat=${dropoffLat} dropoffLng=${dropoffLng}`);
  }

  const data = matching.map((t) => {
    const driver = driverMap[t.driverId];
    return {
      ...t.toJSON(),
      driverName: driver?.name,
      driverPhoto: driver?.profilePhoto ? fileToUrl(driver.profilePhoto) : null,
      driverPhone: driver?.phone,
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
    include: [{
      model: SharedTrip, as: 'trip',
      attributes: ['id', 'driverId', 'pickupLat', 'pickupLng', 'pickupAddress', 'dropoffLat', 'dropoffLng', 'dropoffAddress', 'departureTime', 'pricePerSeat', 'paymentMethod', 'availableSeats', 'status'],
    }],
    order: [['createdAt', 'DESC']],
  });

  const driverIds = [...new Set(requests.map(r => r.trip?.driverId).filter(Boolean))];
  const drivers = driverIds.length > 0 ? await User.findAll({
    where: { id: driverIds },
    attributes: ['id', 'name', 'profilePhoto', 'phone'],
  }) : [];
  const driverMap = Object.fromEntries(drivers.map(d => [d.id, d]));

  const data = requests.map(r => {
    const json = r.toJSON();
    const driver = json.trip ? driverMap[json.trip.driverId] : null;
    return {
      ...json,
      driverName: driver?.name,
      driverPhoto: driver?.profilePhoto ? fileToUrl(driver.profilePhoto) : null,
      driverPhone: driver?.phone,
    };
  });

  res.status(200).json({ success: true, data: { requests: data } });
});

exports.requestJoin = catchAsync(async (req, res, next) => {
  const { tripId } = req.params;
  const { pickupLat, pickupLng, dropoffLat, dropoffLng } = req.body;

  if (!pickupLat || !pickupLng || !dropoffLat || !dropoffLng) {
    return next(new AppError('Pickup and dropoff locations are required.', 400));
  }

  const Ride = require('../models/Ride');
  const activeRide = await Ride.findOne({
    where: {
      passengerId: req.user.id,
      status: { [Op.ne]: 'completed' },
      cancelledAt: null,
    },
  });
  if (activeRide) {
    return next(new AppError('You already have an active ride. Complete it first.', 400));
  }

  const trip = await SharedTrip.findByPk(tripId);
  if (!trip) return next(new AppError('Trip not found.', 404));
  if (trip.status !== 'active') return next(new AppError('This trip is no longer accepting requests.', 400));
  if (trip.availableSeats < 1) return next(new AppError('No seats available on this trip.', 400));
  if (trip.driverId === req.user.id) return next(new AppError('You cannot request your own trip.', 400));

  try {
    const activeReq = await TripRequest.findOne({
      where: { passengerId: req.user.id, tripId, status: { [Op.in]: ['pending', 'accepted'] } },
    });
    if (activeReq) return next(new AppError('You already have a request for this trip.', 400));
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

    try {
      await Notification.create({
        userId: trip.driverId,
        type: 'trip_request',
        title: 'New Shared Trip Request',
        message: `${passenger?.name || 'A passenger'} wants to join your shared trip.`,
        data: { tripId, requestId: request.id },
      });
      io.to(`user:${trip.driverId}`).emit('notification:new', {
        id: `notif-${Date.now()}`,
        type: 'trip_request',
        title: 'New Shared Trip Request',
        message: `${passenger?.name || 'A passenger'} wants to join your shared trip.`,
        data: { tripId, requestId: request.id },
        createdAt: new Date().toISOString(),
      });
    } catch { /* best-effort */ }
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

    try {
      await Notification.create({
        userId: request.passengerId,
        type: 'trip_accepted',
        title: 'Shared Trip Request Accepted',
        message: `${driver?.name || 'The driver'} has accepted your request to join the shared trip.`,
        data: { tripId: trip.id, requestId: request.id },
      });
      io.to(`user:${request.passengerId}`).emit('notification:new', {
        id: `notif-${Date.now()}`,
        type: 'trip_accepted',
        title: 'Shared Trip Request Accepted',
        message: `${driver?.name || 'The driver'} has accepted your request to join the shared trip.`,
        data: { tripId: trip.id, requestId: request.id },
        createdAt: new Date().toISOString(),
      });
    } catch { /* best-effort */ }
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

  try {
    await Notification.create({
      userId: request.passengerId,
      type: 'trip_declined',
      title: 'Shared Trip Request Declined',
      message: reason ? `The driver declined your request: ${reason}` : 'The driver declined your request to join the shared trip.',
      data: { tripId: trip.id, requestId: request.id, reason },
    });
    const io2 = getIO();
    if (io2) {
      io2.to(`user:${request.passengerId}`).emit('notification:new', {
        id: `notif-${Date.now()}`,
        type: 'trip_declined',
        title: 'Shared Trip Request Declined',
        message: reason ? `The driver declined your request: ${reason}` : 'The driver declined your request to join the shared trip.',
        data: { tripId: trip.id, requestId: request.id, reason },
        createdAt: new Date().toISOString(),
      });
    }
  } catch { /* best-effort */ }

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

const TRIP_STATUS_FLOW = ['active', 'full', 'in_progress', 'completed'];

exports.updateTripStatus = catchAsync(async (req, res, next) => {
  const { tripId } = req.params;
  const { status } = req.body;

  if (!status) return next(new AppError('Status is required.', 400));

  const trip = await SharedTrip.findByPk(tripId);
  if (!trip) return next(new AppError('Trip not found.', 404));
  if (trip.driverId !== req.user.id) return next(new AppError('Unauthorized.', 403));

  const currentIdx = TRIP_STATUS_FLOW.indexOf(trip.status);
  const nextIdx = TRIP_STATUS_FLOW.indexOf(status);
  if (currentIdx === -1 || nextIdx === -1 || nextIdx <= currentIdx) {
    return next(new AppError(`Invalid status transition from ${trip.status} to ${status}.`, 400));
  }

  trip.status = status;
  if (status === 'in_progress' && !trip.startedAt) trip.startedAt = new Date();
  if (status === 'completed') trip.completedAt = new Date();
  await trip.save();

  logger.info(`SharedTrip ${tripId} status updated to ${status} by driver ${req.user.email}`);

  const io = getIO();
  if (io) {
    io.to(`trip:${tripId}`).emit('trip:status', { tripId, status, startedAt: trip.startedAt, completedAt: trip.completedAt });
  }

  res.status(200).json({ success: true, data: { trip }, message: `Trip ${status}.` });
});

exports.getAcceptedPassengers = catchAsync(async (req, res, next) => {
  const { tripId } = req.params;

  const trip = await SharedTrip.findByPk(tripId);
  if (!trip) return next(new AppError('Trip not found.', 404));
  if (trip.driverId !== req.user.id) return next(new AppError('Unauthorized.', 403));

  const requests = await TripRequest.findAll({
    where: { tripId, status: 'accepted' },
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

  res.status(200).json({ success: true, data: { passengers: data } });
});
