const logger = require('../utils/logger');

const errorMiddleware = (err, req, res, _next) => {
  err.statusCode = err.statusCode || 500;

  logger.error(`${err.statusCode} - ${err.message}`, {
    url: req.originalUrl,
    method: req.method,
    stack: err.stack,
  });

  res.status(err.statusCode).json({
    success: false,
    message: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

module.exports = errorMiddleware;
