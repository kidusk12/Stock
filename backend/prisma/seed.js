// Run with: npm run seed
// Place this file at backend/prisma/seed.js
// Creates the minimum needed to log in. Demo data (products, stock, sales) comes later.
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  // The single company settings row (id = 1)
  await prisma.companySetting.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      companyName: 'Demo Company',
      address: 'Addis Ababa',
      taxType: 'VAT',
      taxRate: 0.15,
      nextInvoiceNumber: 1,
    },
  });

  const branch = await prisma.branch.upsert({
    where: { code: 'MAIN' },
    update: {},
    create: { name: 'Main Branch', code: 'MAIN', address: 'Addis Ababa' },
  });

  const passwordHash = await bcrypt.hash('Admin123!', 10);
  await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      passwordHash,
      fullName: 'System Admin',
      role: 'ADMIN',
      branchId: null, // Admin sees all branches
    },
  });

  console.log(`Seed complete: admin / Admin123!  (branch ${branch.code})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());