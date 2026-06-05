const mongoose = require('mongoose');
const logger = require('../utils/logger');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    logger.info(`MongoDB connected: ${conn.connection.host}`);
  } catch (error) {
    logger.warn(`MongoDB unavailable: ${error.message}. Server will continue without MongoDB.`);
  }
};

module.exports = connectDB;
