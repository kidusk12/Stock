const { validationError } = require('../middleware/validate');

const MAX_LIMIT = 100;

// Reads one query value: not sent (or empty) gives the default; anything else must be a whole number of 1 or more.
function wholeNumber(value, fallback, field) {
  if (value === undefined || value === '') return fallback;
  const n = Number(value);
  if (!Number.isInteger(n)) {
    throw validationError(`Invalid ${field}`, field, 'invalid', 'must be a whole number');
  }
  if (n < 1) {
    throw validationError(`Invalid ${field}`, field, 'min', 'must be 1 or more');
  }
  return n;
}

// ONE pagination rule for every list (contract 1.5 and 1.9).
// Usage: const { page, limit, skip } = parsePagination(req.query);
//        branches and categories: parsePagination(req.query, { defaultLimit: 100 })
// Gives: findMany({ skip, take: limit }) and the response { data, page, limit, total }.
function parsePagination(query = {}, { defaultLimit = 20 } = {}) {
  const page = wholeNumber(query.page, 1, 'page');
  const limit = wholeNumber(query.limit, defaultLimit, 'limit');
  if (limit > MAX_LIMIT) {
    throw validationError('Invalid limit', 'limit', 'max', `must be ${MAX_LIMIT} or less`);
  }
  return { page, limit, skip: (page - 1) * limit };
}

module.exports = { parsePagination, MAX_LIMIT };