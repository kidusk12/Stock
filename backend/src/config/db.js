// Single shared Prisma client instance.
// Every module imports from here — never call `new PrismaClient()` elsewhere.
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

module.exports = prisma;