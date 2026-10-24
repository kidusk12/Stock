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

// A mistake by the caller. Uses the existing VALIDATION_ERROR code (no new error code needed).
const clientError = (res, status, message) =>
  res.status(status).json({ error: { code: 'VALIDATION_ERROR', message } });

const messageOf = (err) => String((err && err.message) || '');

// Final error handler. Must be added last in app.js.
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  if (err instanceof AppError) {
    const error = { code: err.code, message: err.message };
    if (err.details) error.details = err.details;
    return res.status(err.status).json({ error });
  }

  // Body-parser errors are caused by the caller, so they are never a 500
  if (err.type === 'entity.parse.failed') {
    return clientError(res, 400, 'Request body is not valid JSON');
  }
  if (err.type === 'entity.too.large') {
    return clientError(res, 413, 'Request body is too large');
  }
  if ([400, 413, 415].includes(err.status) && err.expose) {
    return clientError(res, err.status, 'Request could not be read');
  }

  // A number too big for its database column, for example an id with 20 digits in the URL
  if (
    (err.name === 'PrismaClientKnownRequestError' && err.code === 'P2020') ||
    /unable to fit integer value|value out of range/i.test(messageOf(err))
  ) {
    return clientError(res, 400, 'A number is out of range');
  }

  // Text with a null byte (\u0000): PostgreSQL cannot store it
  if (/0x00|null byte|invalid byte sequence/i.test(messageOf(err))) {
    return clientError(res, 400, 'Text contains an invalid character');
  }

  console.error(err);
  res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Something went wrong' } });
};

module.exports = { AppError, asyncHandler, notFound, errorHandler };