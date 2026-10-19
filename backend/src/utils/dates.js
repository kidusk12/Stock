const { validationError } = require('../middleware/validate');

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const ETHIOPIA_OFFSET = 3 * HOUR; // Ethiopia is UTC+3 all year (no daylight saving)

// "2026-10-05" means that day in Ethiopia time. Returns the UTC moment that day starts
// (2026-10-04T21:00:00Z). Throws 400 VALIDATION_ERROR, rule invalid, for a bad value.
function startOfEthiopiaDay(value, field) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value));
  if (!match) throw validationError(`Invalid ${field}`, field, 'invalid', 'use the format YYYY-MM-DD');
  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const utc = new Date(Date.UTC(y, m - 1, d));
  if (utc.getUTCFullYear() !== y || utc.getUTCMonth() !== m - 1 || utc.getUTCDate() !== d) {
    throw validationError(`Invalid ${field}`, field, 'invalid', 'not a real calendar date');
  }
  return new Date(utc.getTime() - ETHIOPIA_OFFSET);
}

// Turns ?from= and ?to= (YYYY-MM-DD, Ethiopia days) into a Prisma date filter, or undefined when
// neither is sent. The whole "to" day counts, so it stops at the start of the next Ethiopia day.
// Usage: const createdAt = dateRangeFilter(req.query); if (createdAt) where.createdAt = createdAt;
function dateRangeFilter({ from, to } = {}) {
  const filter = {};
  if (from) filter.gte = startOfEthiopiaDay(from, 'from');
  if (to) filter.lt = new Date(startOfEthiopiaDay(to, 'to').getTime() + DAY);
  return Object.keys(filter).length > 0 ? filter : undefined;
}

module.exports = { startOfEthiopiaDay, dateRangeFilter };