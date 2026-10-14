// Centralized error handler.
// Every error leaves in the contract format:
//   { error: { code, message, details } }
const { Prisma } = require('@prisma/client');
const AppError = require('../utils/AppError');

// Wrap async route handlers so thrown errors reach the error middleware
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// 404 for unmatched routes
const notFound = (req, res, next) => {
  next(new AppError(404, 'NOT_FOUND', `Not found: ${req.method} ${req.originalUrl}`));
};

// Convert any error into the contract shape and send it.
function errorHandler(err, req, res, next) {
  if (err instanceof AppError) {
    return res.status(err.status).json({
      error: {
        code: err.code,
        message: err.message,
        ...(err.details ? { details: err.details } : {}),
      },
    });
  }

  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Invalid JSON body' },
    });
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      const target = Array.isArray(err.meta?.target) ? err.meta.target : [];
      let code = 'DUPLICATE_VALUE';
      if (target.includes('sku')) code = 'DUPLICATE_SKU';
      else if (target.includes('barcode')) code = 'DUPLICATE_BARCODE';
      return res.status(409).json({
        error: { code, message: 'Duplicate value' },
      });
    }
    if (err.code === 'P2025') {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Record not found' },
      });
    }
  }

  console.error(err);
  return res.status(500).json({
    error: { code: 'SERVER_ERROR', message: 'Internal server error' },
  });
}

module.exports = { asyncHandler, notFound, errorHandler, AppError };