const express = require('express');
const { authenticate } = require('../middleware/auth');
const {
  getNotifications,
  markAsRead,
  markAllAsRead,
  getUnreadCount,
  deleteNotification,
} = require('../controllers/notificationController');

const router = express.Router();

router.use(authenticate);

router.get('/', getNotifications);

router.get('/unread-count', getUnreadCount);

router.patch('/:id/read', markAsRead);

router.post('/read-all', markAllAsRead);

router.delete('/:id', deleteNotification);

module.exports = router;
