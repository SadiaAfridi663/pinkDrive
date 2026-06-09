const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const http = require('http');
const { Server } = require('socket.io');

dotenv.config();

const path = require('path');
const connectDatabases = require('./config');
const { createTransporter } = require('./config/mail');
const errorMiddleware = require('./middleware/errorMiddleware');
const logger = require('./utils/logger');
const { setupSocketHandlers } = require('./sockets');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: process.env.CLIENT_URL, credentials: true },
});

async function start() {
  try {
    await Promise.all([connectDatabases(), createTransporter()]);
  } catch (err) {
    logger.error(`Init error: ${err.message}`);
  }

  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  const morgan = require('morgan');
  if (process.env.NODE_ENV === 'development') {
    app.use(morgan('dev'));
  }

  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { success: false, message: 'Too many requests, please try again later.' },
  });
  app.use('/api/auth', limiter);

  app.get('/api/health', (req, res) => {
    res.json({ success: true, message: 'PinkDrive API is running' });
  });

  const authRoutes = require('./routes/auth');
  const driverVerificationRoutes = require('./routes/driverVerification');
  const rideRoutes = require('./routes/rides');
  app.use('/api/auth', authRoutes);
  app.use('/api/driver-verification', driverVerificationRoutes);
  app.use('/api/rides', rideRoutes);

  const serviceAreaRoutes = require('./routes/serviceAreas');
  app.use('/api/service-areas', serviceAreaRoutes);

  const sosRoutes = require('./routes/sos');
  app.use('/api/sos', sosRoutes);

  const adminRoutes = require('./routes/admin');
  app.use('/api/admin', adminRoutes);

  app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
  app.use(errorMiddleware);

  setupSocketHandlers(io);

  const PORT = process.env.PORT || 5000;

  if (process.env.NODE_ENV !== 'test') {
    server.listen(PORT, () => {
      logger.info(`Server running on port ${PORT} in ${process.env.NODE_ENV} mode`);
    });
  }
}

start();

module.exports = app;
