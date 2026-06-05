const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');

dotenv.config();

const connectDatabases = require('./config');
const { createTransporter } = require('./config/mail');
const errorMiddleware = require('./middleware/errorMiddleware');
const logger = require('./utils/logger');

const path = require('path');
const authRoutes = require('./routes/auth');
const driverVerificationRoutes = require('./routes/driverVerification');
const rideRoutes = require('./routes/rides');

const app = express();

connectDatabases();
createTransporter();

app.use(helmet());
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

app.use('/api/auth', authRoutes);
app.use('/api/driver-verification', driverVerificationRoutes);
app.use('/api/rides', rideRoutes);

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use(errorMiddleware);

const PORT = process.env.PORT || 5000;

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    logger.info(`Server running on port ${PORT} in ${process.env.NODE_ENV} mode`);
  });
}

module.exports = app;
