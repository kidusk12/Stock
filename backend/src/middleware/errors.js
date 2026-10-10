// Centralized error handler. Every route throws AppError and this sends the response.
class AppError extends Error {
  constructor(statusCode, message, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
  }
}

// Wraps async route handlers so thrown errors reach the error middleware
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// 404 for unmatched routes
const notFound = (req, res, next) => {
  next(new AppError(404, `Not found: ${req.method} ${req.originalUrl}`));
};

// Final error handler — must be added last in app.js
const errorHandler = (err, req, res, next) => {
  const status = err.statusCode || 500;
  const payload = {
    error: {
      message: err.message || 'Internal server error',
    },
  };
  if (err.details) payload.error.details = err.details;
  if (status >= 500) console.error(err);
  res.status(status).json(payload);
};

module.exports = { AppError, asyncHandler, notFound, errorHandler };