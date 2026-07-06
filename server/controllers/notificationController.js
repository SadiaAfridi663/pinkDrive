const { Op } = require('sequelize');
const Notification = require('../models/Notification');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');
const logger = require('../utils/logger');

exports.getNotifications = catchAsync(async (req, res, next) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 50;
  const offset = (page - 1) * limit;

  const { count, rows } = await Notification.findAndCountAll({
    where: { userId: req.user.id },
    order: [['createdAt', 'DESC']],
    limit,
    offset,
  });

  const unreadCount = await Notification.count({
    where: { userId: req.user.id, isRead: false },
  });

  res.status(200).json({
    success: true,
    data: {
      notifications: rows,
      unreadCount,
      total: count,
      page,
      totalPages: Math.ceil(count / limit),
    },
  });
});

exports.markAsRead = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  const notification = await Notification.findByPk(id);
  if (!notification) return next(new AppError('Notification not found.', 404));
  if (notification.userId !== req.user.id) return next(new AppError('Unauthorized.', 403));

  notification.isRead = true;
  await notification.save();

  res.status(200).json({ success: true, message: 'Marked as read.' });
});

exports.markAllAsRead = catchAsync(async (req, res, next) => {
  await Notification.update(
    { isRead: true },
    { where: { userId: req.user.id, isRead: false } },
  );

  res.status(200).json({ success: true, message: 'All notifications marked as read.' });
});

exports.getUnreadCount = catchAsync(async (req, res, next) => {
  const count = await Notification.count({
    where: { userId: req.user.id, isRead: false },
  });

  res.status(200).json({ success: true, data: { unreadCount: count } });
});
