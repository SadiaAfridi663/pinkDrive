const Notification = require('../models/Notification');
const { getIO } = require('../sockets');
const { SERVER_EVENTS, ROOMS } = require('../sockets/events');
const logger = require('./logger');

/**
 * Create a Notification record + emit it via Socket.IO to the user's room.
 * Silently fails so callers don't need try/catch.
 */
async function notify(userId, { type, title, message, data }) {
  try {
    const record = await Notification.create({ userId, type, title, message, data });
    const io = getIO();
    if (io) {
      io.to(ROOMS.USER(userId)).emit(SERVER_EVENTS.NOTIFICATION_NEW, {
        id: record.id,
        type,
        title,
        message,
        data: data || null,
        createdAt: record.createdAt || new Date().toISOString(),
      });
    }
  } catch (err) {
    logger.warn(`notify: failed for user ${userId} (${type}): ${err.message}`);
  }
}

/**
 * Notify multiple users at once.
 */
async function notifyMany(userIds, payload) {
  await Promise.allSettled(userIds.map(id => notify(id, payload)));
}

module.exports = { notify, notifyMany };
