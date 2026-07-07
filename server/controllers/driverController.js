const User = require('../models/User');
const Review = require('../models/Review');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/AppError');
const { fileToUrl } = require('../utils/geo');

exports.getPublicProfile = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const user = await User.findByPk(id);
  if (!user) return next(new AppError('Driver not found.', 404));
  if (user.role !== 'driver') return next(new AppError('Requested user is not a driver.', 400));

  const reviews = await Review.findAll({ where: { driverId: id } });
  const rating = reviews.length > 0 
    ? (reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length).toFixed(1)
    : 'No ratings yet';

  res.status(200).json({
    success: true,
    data: {
      name: user.name,
      profilePhoto: user.profilePhoto ? fileToUrl(user.profilePhoto) : null,
      phone: user.phone,
      rating,
      reviewCount: reviews.length,
    },
  });
});
