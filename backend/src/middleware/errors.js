// Central errors. Every route throws AppError(status, code, message, details?)
// and errorHandler sends it. Format (contract 1.4):
// { "error": { "code": "...", "message": "...", "details": [...] } }
class AppError extends Error {
  constructor(status, code, message, details = null) {
    super(message);
    this.status = status;
    this.statusCode = status; // kept so older code that reads statusCode still works
    this.code = code;
    this.details = details;
  }
}

// Wraps async route handlers so thrown errors reach the error middleware
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// 404 for unmatched routes
const notFound = (req, res, next) => {
  next(new AppError(404, 'NOT_FOUND', `Not found: ${req.method} ${req.originalUrl}`));
};

// Final error handler. Must be added last in app.js.
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  if (err instanceof AppError) {
    const error = { code: err.code, message: err.message };
    if (err.details) error.details = err.details;
    return res.status(err.status).json({ error });
  }
  if (err.type === 'entity.parse.failed') {
    return res
      .status(400)
      .json({ error: { code: 'VALIDATION_ERROR', message: 'Request body is not valid JSON' } });
  }
  console.error(err);
  res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Something went wrong' } });
};

module.exports = { AppError, asyncHandler, notFound, errorHandler };