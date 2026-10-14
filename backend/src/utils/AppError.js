// AppError with a machine-readable code, per the contract:
//   new AppError(status, code, message, details)
// Thrown anywhere in the app; caught by middleware/errorHandler.js.
class AppError extends Error {
  constructor(status, code, message, details = null) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
    this.name = 'AppError';
  }
}

module.exports = AppError;