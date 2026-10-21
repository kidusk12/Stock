const { Prisma } = require('@prisma/client');

// Wraps a raw number, string, or Decimal into a Prisma Decimal.
const D = (value) => new Prisma.Decimal(value);

// Rounds to 2 decimal places, half-up (contract 6.0, rule 3).
const money = (decimal) => decimal.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

module.exports = { D, money };
