const logger = require('../utils/logger');

const requestLogger = (req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info(`${req.method} ${req.path} ${res.statusCode} ${duration}ms`, {
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
  });
  next();
};

module.exports = requestLogger;
