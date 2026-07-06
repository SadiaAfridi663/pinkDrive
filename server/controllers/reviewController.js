const { Op } = require('sequelize');
const Review = require('../models/Review');
const Ride = require('../models/Ride');
const SharedTrip = require('../models/SharedTrip');
const TripRequest = require('../models/TripRequest');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');
const logger = require('../utils/logger');
const { getIO } = require('../sockets');
const Notification = require('../models/Notification');

exports.createReview = catchAsync(async (req, res, next) => {
  const { rideId, tripRequestId, reviewedId, rating, comment } = req.body;

  if (!reviewedId || !rating) {
    return next(new AppError('Reviewed user and rating are required.', 400));
  }

  if (rating < 1 || rating > 5) {
    return next(new AppError('Rating must be between 1 and 5.', 400));
  }

  if (req.user.id === reviewedId) {
    return next(new AppError('You cannot review yourself.', 400));
  }

  if (rideId) {
    const ride = await Ride.findByPk(rideId);
    if (!ride) return next(new AppError('Ride not found.', 404));
    if (ride.passengerId !== req.user.id && ride.driverId !== req.user.id) {
      return next(new AppError('You were not part of this ride.', 403));
    }
    if (ride.status !== 'completed') {
      return next(new AppError('Ride must be completed before reviewing.', 400));
    }

    const existing = await Review.findOne({ where: { rideId, reviewerId: req.user.id } });
    if (existing) return next(new AppError('You have already reviewed this ride.', 400));
  }

  if (tripRequestId) {
    const tripReq = await TripRequest.findByPk(tripRequestId);
    if (!tripReq) return next(new AppError('Trip request not found.', 404));
    if (tripReq.passengerId !== req.user.id) {
      return next(new AppError('You were not part of this trip request.', 403));
    }
    const existing = await Review.findOne({ where: { tripRequestId, reviewerId: req.user.id } });
    if (existing) return next(new AppError('You have already reviewed this trip.', 400));
  }

  const review = await Review.create({
    rideId: rideId || null,
    tripRequestId: tripRequestId || null,
    reviewerId: req.user.id,
    reviewedId,
    rating: parseInt(rating, 10),
    comment: comment || null,
  });

  logger.info(`Review ${review.id} created by ${req.user.email} for user ${reviewedId}, rating: ${rating}`);

  try {
    await Notification.create({
      userId: reviewedId,
      type: 'new_review',
      title: 'New Review',
      message: `${req.user.name} gave you ${rating} star${rating > 1 ? 's' : ''}${comment ? ': "' + comment.slice(0, 50) + '"' : ''}`,
      data: { reviewId: review.id, reviewerId: req.user.id, rating },
    });
  } catch { /* best-effort */ }

  const io = getIO();
  if (io) {
    io.to(`user:${reviewedId}`).emit('notification:new', {
      type: 'new_review',
      title: 'New Review',
      message: `${req.user.name} gave you ${rating} stars.`,
    });
  }

  res.status(201).json({
    success: true,
    data: { review },
    message: 'Review submitted.',
  });
});

exports.getDriverReviews = catchAsync(async (req, res, next) => {
  const { driverId } = req.params;

  const reviews = await Review.findAll({
    where: { reviewedId: driverId },
    order: [['createdAt', 'DESC']],
    limit: 50,
  });

  const reviewerIds = [...new Set(reviews.map((r) => r.reviewerId))];
  const User = require('../models/User');
  const reviewers = reviewerIds.length > 0 ? await User.findAll({
    where: { id: reviewerIds },
    attributes: ['id', 'name', 'profilePhoto'],
  }) : [];
  const reviewerMap = Object.fromEntries(reviewers.map((r) => [r.id, r]));

  const data = reviews.map((r) => ({
    ...r.toJSON(),
    reviewerName: reviewerMap[r.reviewerId]?.name,
    reviewerPhoto: reviewerMap[r.reviewerId]?.profilePhoto,
  }));

  const stats = reviews.length > 0 ? {
    averageRating: Math.round((reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) * 10) / 10,
    totalReviews: reviews.length,
    distribution: [1, 2, 3, 4, 5].map((n) => ({
      stars: n,
      count: reviews.filter((r) => r.rating === n).length,
    })),
  } : { averageRating: 0, totalReviews: 0, distribution: [] };

  res.status(200).json({ success: true, data: { reviews: data, stats } });
});

exports.getMyReviews = catchAsync(async (req, res, next) => {
  const reviews = await Review.findAll({
    where: { reviewerId: req.user.id },
    order: [['createdAt', 'DESC']],
    limit: 50,
  });

  const reviewedIds = [...new Set(reviews.map((r) => r.reviewedId))];
  const User = require('../models/User');
  const reviewed = reviewedIds.length > 0 ? await User.findAll({
    where: { id: reviewedIds },
    attributes: ['id', 'name', 'profilePhoto'],
  }) : [];
  const reviewedMap = Object.fromEntries(reviewed.map((r) => [r.id, r]));

  const data = reviews.map((r) => ({
    ...r.toJSON(),
    reviewedName: reviewedMap[r.reviewedId]?.name,
    reviewedPhoto: reviewedMap[r.reviewedId]?.profilePhoto,
  }));

  res.status(200).json({ success: true, data: { reviews: data } });
});

exports.getMyRatings = catchAsync(async (req, res, next) => {
  const reviews = await Review.findAll({
    where: { reviewedId: req.user.id },
  });

  const stats = reviews.length > 0 ? {
    averageRating: Math.round((reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) * 10) / 10,
    totalReviews: reviews.length,
    distribution: [1, 2, 3, 4, 5].map((n) => ({
      stars: n,
      count: reviews.filter((r) => r.rating === n).length,
    })),
  } : { averageRating: 0, totalReviews: 0, distribution: [] };

  res.status(200).json({ success: true, data: { stats } });
});
