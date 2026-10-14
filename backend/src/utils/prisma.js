// Shared Prisma client — the one instance used by the whole app.
// Kidus's stockService.js imports this exact path.
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

module.exports = prisma;