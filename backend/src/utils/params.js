const { AppError } = require('../middleware/errors');
const { validationError } = require('../middleware/validate'); // shared builder

// A query or body number that must be a positive whole number.
// Throws 400 VALIDATION_ERROR with rule invalid (contract 1.4).
function parseIntParam(value, field) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) {
    throw validationError(`Invalid ${field}`, field, 'invalid', 'must be a positive whole number');
  }
  return n;
}

// An id taken from the URL. A bad id is treated like a missing record (404 NOT_FOUND).
function parseIdOr404(value, message) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) throw new AppError(404, 'NOT_FOUND', message);
  return n;
}

module.exports = { parseIntParam, parseIdOr404 };