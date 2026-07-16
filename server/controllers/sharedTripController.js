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
const { SERVER_EVENTS, ROOMS } = require('../sockets/events');
const { notify, notifyMany } = require('../utils/notify');
const { holdPayment, capturePayment, releasePayment } = require('../services/sharedPaymentService');

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
    io.emit(SERVER_EVENTS.TRIP_CREATED, {
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
    io.to(ROOMS.DRIVER(trip.driverId)).emit(SERVER_EVENTS.TRIP_REQUEST_NEW, {
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
      io.to(ROOMS.USER(trip.driverId)).emit(SERVER_EVENTS.NOTIFICATION_NEW, {
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
  const { sequelize } = require('../config/db.sql');

  const { request, trip } = await sequelize.transaction(async (t) => {
    const r = await TripRequest.findByPk(requestId, {
      lock: t.LOCK.UPDATE,
      transaction: t,
    });
    if (!r) throw new AppError('Request not found.', 404);
    if (r.status !== 'pending') throw new AppError('Request is no longer pending.', 400);

    const tr = await SharedTrip.findByPk(r.tripId, {
      lock: t.LOCK.UPDATE,
      transaction: t,
    });
    if (!tr) throw new AppError('Trip not found.', 404);
    if (tr.driverId !== req.user.id) throw new AppError('Unauthorized.', 403);
    if (tr.status !== 'active') throw new AppError('Trip is no longer active.', 400);
    if (tr.availableSeats < 1) throw new AppError('No seats available.', 400);

    r.status = 'accepted';
    await r.save({ transaction: t });

    tr.availableSeats = tr.availableSeats - 1;
    if (tr.availableSeats <= 0) {
      tr.availableSeats = 0;
      tr.status = 'full';
    }
    await tr.save({ transaction: t });

    return { request: r, trip: tr };
  });

  logger.info(`TripRequest ${request.id} accepted for trip ${trip.id}. Seats left: ${trip.availableSeats}`);

  const passengerInfo = await User.findByPk(request.passengerId, { attributes: ['id', 'name', 'profilePhoto'] });

  const io = getIO();
  if (io) {
    const driver = await User.findByPk(req.user.id, { attributes: ['id', 'name', 'profilePhoto'] });

    // Notify the accepted passenger
    io.to(ROOMS.PASSENGER(request.passengerId)).emit(SERVER_EVENTS.TRIP_REQUEST_ACCEPTED, {
      requestId: request.id,
      tripId: trip.id,
      driverName: driver?.name,
      driverPhoto: driver?.profilePhoto ? fileToUrl(driver.profilePhoto) : null,
      pickupAddress: request.pickupAddress,
      dropoffAddress: request.dropoffAddress,
      departureTime: trip.departureTime,
    });

    // Notify ALL participants in the trip room that a passenger joined
    io.to(ROOMS.TRIP(trip.id)).emit(SERVER_EVENTS.TRIP_SEATS_UPDATE, {
      tripId: trip.id,
      availableSeats: trip.availableSeats,
      status: trip.status,
    });
    io.to(ROOMS.TRIP(trip.id)).emit(SERVER_EVENTS.PASSENGER_JOINED, {
      tripId: trip.id,
      passengerId: request.passengerId,
      passengerName: passengerInfo?.name,
      passengerPhoto: passengerInfo?.profilePhoto ? fileToUrl(passengerInfo.profilePhoto) : null,
      availableSeats: trip.availableSeats,
    });

    // Global seat update for discovery pages
    io.emit(SERVER_EVENTS.TRIP_SEATS_UPDATE, {
      tripId: trip.id,
      availableSeats: trip.availableSeats,
      status: trip.status,
    });

    // Notification to the accepted passenger
    try {
      await Notification.create({
        userId: request.passengerId,
        type: 'trip_accepted',
        title: 'Shared Trip Request Accepted',
        message: `${driver?.name || 'The driver'} has accepted your request to join the shared trip.`,
        data: { tripId: trip.id, requestId: request.id },
      });
      io.to(ROOMS.USER(request.passengerId)).emit(SERVER_EVENTS.NOTIFICATION_NEW, {
        id: `notif-${Date.now()}`,
        type: 'trip_accepted',
        title: 'Shared Trip Request Accepted',
        message: `${driver?.name || 'The driver'} has accepted your request to join the shared trip.`,
        data: { tripId: trip.id, requestId: request.id },
        createdAt: new Date().toISOString(),
      });
    } catch { /* best-effort */ }

    // Notify other passengers in the trip that someone joined
    try {
      const otherAccepted = await TripRequest.findAll({
        where: { tripId: trip.id, status: 'accepted', passengerId: { [Op.ne]: request.passengerId } },
        attributes: ['passengerId'],
      });
      for (const other of otherAccepted) {
        await Notification.create({
          userId: other.passengerId,
          type: 'passenger_joined',
          title: 'New Passenger Joined',
          message: `${passengerInfo?.name || 'A passenger'} joined this shared trip.`,
          data: { tripId: trip.id, requestId: request.id },
        });
        io.to(ROOMS.USER(other.passengerId)).emit(SERVER_EVENTS.NOTIFICATION_NEW, {
          id: `notif-${Date.now()}-${other.passengerId}`,
          type: 'passenger_joined',
          title: 'New Passenger Joined',
          message: `${passengerInfo?.name || 'A passenger'} joined this shared trip.`,
          data: { tripId: trip.id, requestId: request.id },
          createdAt: new Date().toISOString(),
        });
      }
    } catch { /* best-effort */ }
  }

  // Initiate payment hold for non-cash methods
  holdPayment(request, trip);

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

  // Restore seat count
  trip.availableSeats = trip.availableSeats + 1;
  if (trip.status === 'full') trip.status = 'active';
  await trip.save();

  logger.info(`TripRequest ${request.id} declined for trip ${trip.id}. Seats restored: ${trip.availableSeats}`);

  const io = getIO();
  if (io) {
    io.to(ROOMS.PASSENGER(request.passengerId)).emit(SERVER_EVENTS.TRIP_REQUEST_DECLINED, {
      requestId: request.id,
      tripId: trip.id,
      reason: reason || null,
    });

    // Notify all trip participants about seat update
    io.to(ROOMS.TRIP(trip.id)).emit(SERVER_EVENTS.TRIP_SEATS_UPDATE, {
      tripId: trip.id,
      availableSeats: trip.availableSeats,
      status: trip.status,
    });
    io.emit(SERVER_EVENTS.TRIP_SEATS_UPDATE, {
      tripId: trip.id,
      availableSeats: trip.availableSeats,
      status: trip.status,
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
      io2.to(ROOMS.USER(request.passengerId)).emit(SERVER_EVENTS.NOTIFICATION_NEW, {
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
  const { sequelize } = require('../config/db.sql');

  const trip = await sequelize.transaction(async (t) => {
    const tr = await SharedTrip.findByPk(tripId, {
      lock: t.LOCK.UPDATE,
      transaction: t,
    });
    if (!tr) throw new AppError('Trip not found.', 404);
    if (tr.driverId !== req.user.id) throw new AppError('Unauthorized.', 403);
    if (!['active', 'full'].includes(tr.status)) throw new AppError('Trip cannot be cancelled in its current state.', 400);

    const acceptedCount = await TripRequest.count({
      where: { tripId, status: 'accepted' },
      transaction: t,
    });
    tr.availableSeats = tr.availableSeats + acceptedCount;

    await TripRequest.update(
      { status: 'cancelled' },
      { where: { tripId, status: { [Op.in]: ['pending', 'accepted'] } }, transaction: t },
    );

    tr.status = 'cancelled';
    await tr.save({ transaction: t });

    return tr;
  });

  logger.info(`SharedTrip ${tripId} cancelled by driver ${req.user.email}. Seats restored: ${trip.availableSeats}`);

  const io = getIO();
  if (io) {
    io.to(ROOMS.TRIP(tripId)).emit(SERVER_EVENTS.TRIP_CANCELLED, { tripId, availableSeats: trip.availableSeats });
    io.emit(SERVER_EVENTS.TRIP_CANCELLED, { tripId, availableSeats: trip.availableSeats });
  }

  // Notify all passengers
  try {
    const affected = await TripRequest.findAll({
      where: { tripId },
      attributes: ['passengerId'],
    });
    await notifyMany(affected.map(r => r.passengerId), {
      type: 'trip_cancelled',
      title: 'Shared Trip Cancelled',
      message: 'The driver has cancelled this shared trip.',
      data: { tripId },
    });
  } catch { /* best-effort */ }

  // Release payments for accepted passengers
  try {
    const acceptedRequests = await TripRequest.findAll({
      where: { tripId, status: 'cancelled' },
    });
    for (const req of acceptedRequests) {
      await releasePayment(req, trip);
    }
  } catch { /* best-effort */ }

  res.status(200).json({ success: true, message: 'Trip cancelled.' });
});

/**
 * Passenger cancels their own accepted request (leaves the trip).
 */
exports.leaveTrip = catchAsync(async (req, res, next) => {
  const { tripId } = req.params;
  const { sequelize } = require('../config/db.sql');

  const trip = await sequelize.transaction(async (t) => {
    const tr = await SharedTrip.findByPk(tripId, {
      lock: t.LOCK.UPDATE,
      transaction: t,
    });
    if (!tr) throw new AppError('Trip not found.', 404);
    if (!['active', 'full'].includes(tr.status)) throw new AppError('Trip cannot be left in its current state.', 400);

    const reqRec = await TripRequest.findOne({
      where: { tripId, passengerId: req.user.id, status: 'accepted' },
      lock: t.LOCK.UPDATE,
      transaction: t,
    });
    if (!reqRec) throw new AppError('No active request found for this trip.', 404);

    reqRec.status = 'cancelled';
    await reqRec.save({ transaction: t });

    tr.availableSeats = tr.availableSeats + 1;
    if (tr.status === 'full') tr.status = 'active';
    await tr.save({ transaction: t });

    return { trip: tr, request: reqRec };
  });

  logger.info(`Passenger ${req.user.email} left shared trip ${tripId}. Seats restored: ${trip.availableSeats}`);

  const io = getIO();
  if (io) {
    const passenger = await User.findByPk(req.user.id, { attributes: ['id', 'name'] });

    io.to(ROOMS.TRIP(tripId)).emit(SERVER_EVENTS.PASSENGER_LEFT, {
      tripId,
      passengerId: req.user.id,
      passengerName: passenger?.name,
      availableSeats: trip.availableSeats,
    });
    io.to(ROOMS.TRIP(tripId)).emit(SERVER_EVENTS.TRIP_SEATS_UPDATE, {
      tripId,
      availableSeats: trip.availableSeats,
      status: trip.status,
    });
    io.emit(SERVER_EVENTS.TRIP_SEATS_UPDATE, {
      tripId,
      availableSeats: trip.availableSeats,
      status: trip.status,
    });
  }

  // Notify driver that a passenger left
  notify(trip.driverId, {
    type: 'passenger_left',
    title: 'Passenger Left',
    message: `${req.user.name || 'A passenger'} has left your shared trip.`,
    data: { tripId, passengerId: req.user.id },
  });

  // Release payment hold
  try {
    const cancelledRequest = await TripRequest.findOne({
      where: { tripId, passengerId: req.user.id, status: 'cancelled' },
    });
    if (cancelledRequest) await releasePayment(cancelledRequest, trip);
  } catch { /* best-effort */ }

  res.status(200).json({ success: true, message: 'You have left the shared trip.' });
});

/**
 * Driver removes a passenger from the trip.
 */
exports.removePassenger = catchAsync(async (req, res, next) => {
  const { tripId, passengerId } = req.params;
  const { sequelize } = require('../config/db.sql');

  const trip = await sequelize.transaction(async (t) => {
    const tr = await SharedTrip.findByPk(tripId, {
      lock: t.LOCK.UPDATE,
      transaction: t,
    });
    if (!tr) throw new AppError('Trip not found.', 404);
    if (tr.driverId !== req.user.id) throw new AppError('Unauthorized.', 403);
    if (!['active', 'full'].includes(tr.status)) throw new AppError('Trip cannot be modified in its current state.', 400);

    const reqRec = await TripRequest.findOne({
      where: { tripId, passengerId, status: 'accepted' },
      lock: t.LOCK.UPDATE,
      transaction: t,
    });
    if (!reqRec) throw new AppError('No active request found for this passenger.', 404);

    reqRec.status = 'cancelled';
    await reqRec.save({ transaction: t });

    tr.availableSeats = tr.availableSeats + 1;
    if (tr.status === 'full') tr.status = 'active';
    await tr.save({ transaction: t });

    return { trip: tr, request: reqRec };
  });

  logger.info(`Driver ${req.user.email} removed passenger ${passengerId} from trip ${tripId}. Seats restored: ${trip.availableSeats}`);

  const io = getIO();
  if (io) {
    io.to(ROOMS.TRIP(tripId)).emit(SERVER_EVENTS.PASSENGER_LEFT, {
      tripId,
      passengerId: parseInt(passengerId, 10),
      availableSeats: trip.availableSeats,
    });
    io.to(ROOMS.TRIP(tripId)).emit(SERVER_EVENTS.TRIP_SEATS_UPDATE, {
      tripId,
      availableSeats: trip.availableSeats,
      status: trip.status,
    });
    io.emit(SERVER_EVENTS.TRIP_SEATS_UPDATE, {
      tripId,
      availableSeats: trip.availableSeats,
      status: trip.status,
    });
    io.to(ROOMS.PASSENGER(parseInt(passengerId, 10))).emit(SERVER_EVENTS.PASSENGER_REMOVED, {
      tripId,
      message: 'The driver has removed you from this shared trip.',
    });
  }

  notify(parseInt(passengerId, 10), {
    type: 'passenger_removed',
    title: 'Removed from Shared Trip',
    message: 'The driver has removed you from this shared trip.',
    data: { tripId },
  });

  // Release payment hold
  try {
    const removedRequest = await TripRequest.findOne({
      where: { tripId, passengerId: parseInt(passengerId, 10), status: 'cancelled' },
    });
    if (removedRequest) await releasePayment(removedRequest, trip);
  } catch { /* best-effort */ }

  res.status(200).json({ success: true, message: 'Passenger removed from trip.' });
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

  // Sync TripRequest statuses
  if (status === 'in_progress') {
    // Boarded passengers → in_progress; also catch any remaining accepted (simpler flow)
    await TripRequest.update(
      { status: 'in_progress' },
      { where: { tripId, status: { [Op.in]: ['accepted', 'driver_arriving', 'passenger_boarded'] } } },
    );
  }
  if (status === 'completed') {
    // Complete all active passengers (not yet dropped off)
    await TripRequest.update(
      { status: 'completed' },
      { where: { tripId, status: { [Op.in]: ['accepted', 'driver_arriving', 'passenger_boarded', 'in_progress'] } } },
    );
  }

  const io = getIO();
  if (io) {
    io.to(ROOMS.TRIP(tripId)).emit(SERVER_EVENTS.TRIP_STATUS, { tripId, status, startedAt: trip.startedAt, completedAt: trip.completedAt });

    // Notify each passenger directly in their private room
    const statuses = status === 'in_progress'
      ? ['in_progress']
      : ['completed'];
    const passengerRequests = await TripRequest.findAll({
      where: { tripId, status: { [Op.in]: statuses } },
      attributes: ['passengerId'],
    });
    const notified = new Set();
    for (const req of passengerRequests) {
      if (!notified.has(req.passengerId)) {
        notified.add(req.passengerId);
        io.to(ROOMS.PASSENGER(req.passengerId)).emit(SERVER_EVENTS.TRIP_STATUS, { tripId, status, startedAt: trip.startedAt, completedAt: trip.completedAt });
      }
    }
  }

  // Notify all passengers
  if (status === 'in_progress') {
    try {
      const activePassengers = await TripRequest.findAll({
        where: { tripId, status: 'in_progress' },
        attributes: ['passengerId'],
      });
      await notifyMany(activePassengers.map(r => r.passengerId), {
        type: 'trip_started',
        title: 'Trip Started!',
        message: 'Your shared trip is now in progress. Hang tight!',
        data: { tripId },
      });
    } catch { /* best-effort */ }
  }
  if (status === 'completed') {
    try {
      const completedPassengers = await TripRequest.findAll({
        where: { tripId, status: 'completed' },
        attributes: ['passengerId'],
      });
      await notifyMany(completedPassengers.map(r => r.passengerId), {
        type: 'trip_completed',
        title: 'Trip Completed',
        message: 'Your shared trip has been completed. Thank you for riding!',
        data: { tripId },
      });
    } catch { /* best-effort */ }
  }

  res.status(200).json({ success: true, data: { trip }, message: `Trip ${status}.` });
});

/**
 * Check if all active passengers for a trip have been dropped off.
 */
async function isAllPassengersDropped(tripId) {
  const activeCount = await TripRequest.count({
    where: {
      tripId,
      status: { [Op.in]: ['accepted', 'in_progress', 'passenger_boarded', 'driver_arriving'] },
    },
  });
  return activeCount === 0;
}

exports.driverArriving = catchAsync(async (req, res, next) => {
  const { tripId } = req.params;

  const trip = await SharedTrip.findByPk(tripId);
  if (!trip) return next(new AppError('Trip not found.', 404));
  if (trip.driverId !== req.user.id) return next(new AppError('Unauthorized.', 403));
  if (!['active', 'full'].includes(trip.status)) return next(new AppError('Trip is not in a state where driver can arrive.', 400));

  // Mark all accepted passengers as driver_arriving
  await TripRequest.update(
    { status: 'driver_arriving' },
    { where: { tripId, status: 'accepted' } },
  );

  logger.info(`Driver arriving for trip ${tripId}`);

  const io = getIO();
  if (io) {
    const payload = { tripId, driverId: req.user.id, driverName: req.user.name };
    io.to(ROOMS.TRIP(tripId)).emit(SERVER_EVENTS.DRIVER_ARRIVING, payload);

    // Notify each passenger directly
    const requests = await TripRequest.findAll({
      where: { tripId, status: 'driver_arriving' },
      attributes: ['passengerId'],
    });
    for (const r of requests) {
      io.to(ROOMS.PASSENGER(r.passengerId)).emit(SERVER_EVENTS.DRIVER_ARRIVING, payload);
    }
  }

  // Notify all accepted passengers
  try {
    const accepted = await TripRequest.findAll({
      where: { tripId, status: 'driver_arriving' },
      attributes: ['passengerId'],
    });
    await notifyMany(accepted.map(r => r.passengerId), {
      type: 'driver_arriving',
      title: 'Driver is Arriving',
      message: `${req.user.name || 'Your driver'} is on the way to pick you up!`,
      data: { tripId },
    });
  } catch { /* best-effort */ }

  res.status(200).json({ success: true, message: 'Driver arriving.' });
});

exports.boardPassenger = catchAsync(async (req, res, next) => {
  const { tripId, requestId } = req.params;

  const trip = await SharedTrip.findByPk(tripId);
  if (!trip) return next(new AppError('Trip not found.', 404));
  if (trip.driverId !== req.user.id) return next(new AppError('Unauthorized.', 403));

  const request = await TripRequest.findByPk(requestId);
  if (!request || request.tripId !== tripId) return next(new AppError('Request not found for this trip.', 404));
  if (!['accepted', 'driver_arriving'].includes(request.status)) {
    return next(new AppError('Passenger is not in a boardable state.', 400));
  }

  request.status = 'passenger_boarded';
  request.boardingTime = new Date();
  await request.save();

  logger.info(`Passenger ${request.passengerId} boarded trip ${tripId}`);

  const io = getIO();
  if (io) {
    const payload = { tripId, requestId, passengerId: request.passengerId };
    io.to(ROOMS.TRIP(tripId)).emit(SERVER_EVENTS.PASSENGER_BOARDED, payload);
    io.to(ROOMS.PASSENGER(request.passengerId)).emit(SERVER_EVENTS.PASSENGER_BOARDED, payload);
  }

  notify(request.passengerId, {
    type: 'passenger_boarded',
    title: 'You\'re On Board!',
    message: 'You have boarded the shared trip. Safe travels!',
    data: { tripId, requestId },
  });

  res.status(200).json({ success: true, data: { request }, message: 'Passenger boarded.' });
});

exports.dropoffPassenger = catchAsync(async (req, res, next) => {
  const { tripId, requestId } = req.params;

  const trip = await SharedTrip.findByPk(tripId);
  if (!trip) return next(new AppError('Trip not found.', 404));
  if (trip.driverId !== req.user.id) return next(new AppError('Unauthorized.', 403));

  const request = await TripRequest.findByPk(requestId);
  if (!request || request.tripId !== tripId) return next(new AppError('Request not found for this trip.', 404));
  if (!['passenger_boarded', 'in_progress'].includes(request.status)) {
    return next(new AppError('Passenger is not in a droppable state.', 400));
  }

  request.status = 'dropped_off';
  request.dropoffTime = new Date();
  await request.save();

  logger.info(`Passenger ${request.passengerId} dropped off trip ${tripId}`);

  const io = getIO();
  if (io) {
    const payload = { tripId, requestId, passengerId: request.passengerId };
    io.to(ROOMS.TRIP(tripId)).emit(SERVER_EVENTS.PASSENGER_DROPPED, payload);
    io.to(ROOMS.PASSENGER(request.passengerId)).emit(SERVER_EVENTS.PASSENGER_DROPPED, payload);
  }

  notify(request.passengerId, {
    type: 'passenger_dropped',
    title: 'You\'ve Arrived!',
    message: 'You have been dropped off at your destination. Thank you for riding with PinkDrive!',
    data: { tripId, requestId },
  });

  // Capture payment on dropoff
  capturePayment(request, trip);

  // Auto-complete trip if all passengers have been dropped off
  if (await isAllPassengersDropped(tripId)) {
    trip.status = 'completed';
    trip.completedAt = new Date();
    await trip.save();

    await TripRequest.update(
      { status: 'completed' },
      { where: { tripId, status: 'dropped_off' } },
    );

    if (io) {
      io.to(ROOMS.TRIP(tripId)).emit(SERVER_EVENTS.TRIP_STATUS, {
        tripId, status: 'completed', startedAt: trip.startedAt, completedAt: trip.completedAt,
      });
    }

    // Notify remaining passengers
    try {
      const completed = await TripRequest.findAll({
        where: { tripId, status: 'completed' },
        attributes: ['passengerId'],
      });
      await notifyMany(completed.map(r => r.passengerId), {
        type: 'trip_completed',
        title: 'Trip Completed',
        message: 'Your shared trip has been completed. Thank you for riding!',
        data: { tripId },
      });
    } catch { /* best-effort */ }

    logger.info(`Trip ${tripId} auto-completed — all passengers dropped off.`);
  }

  res.status(200).json({
    success: true,
    data: { request, tripCompleted: trip.status === 'completed' },
    message: trip.status === 'completed' ? 'Passenger dropped off. Trip completed.' : 'Passenger dropped off.',
  });
});

exports.getAcceptedPassengers = catchAsync(async (req, res, next) => {
  const { tripId } = req.params;

  const trip = await SharedTrip.findByPk(tripId);
  if (!trip) return next(new AppError('Trip not found.', 404));
  if (trip.driverId !== req.user.id) return next(new AppError('Unauthorized.', 403));

  const requests = await TripRequest.findAll({
    where: { tripId, status: { [Op.in]: ['accepted', 'in_progress', 'passenger_boarded', 'dropped_off'] } },
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
