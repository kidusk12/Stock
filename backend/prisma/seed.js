// Run with: npm run seed
// Place this file at backend/prisma/seed.js
// Creates the minimum needed to log in and test every role.
// Demo data (products, stock, sales) comes later.
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function upsertUser({ username, password, fullName, role, branchId }) {
  const passwordHash = await bcrypt.hash(password, 10);
  return prisma.user.upsert({
    where: { username },
    update: {},
    create: { username, passwordHash, fullName, role, branchId },
  });
}

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

  // One user per role. Admin and Auditor have no branch (they see all branches).
  await upsertUser({ username: 'admin', password: 'Admin123!', fullName: 'System Admin', role: 'ADMIN', branchId: null });
  await upsertUser({ username: 'manager', password: 'Manager123!', fullName: 'Branch Manager', role: 'BRANCH_MANAGER', branchId: branch.id });
  await upsertUser({ username: 'staff', password: 'Staff123!', fullName: 'Branch Staff', role: 'STAFF', branchId: branch.id });
  await upsertUser({ username: 'auditor', password: 'Auditor123!', fullName: 'Auditor', role: 'AUDITOR', branchId: null });

  console.log('Seed complete. Test accounts:');
  console.log('  admin    / Admin123!    (ADMIN, all branches)');
  console.log('  manager  / Manager123!  (BRANCH_MANAGER, MAIN)');
  console.log('  staff    / Staff123!    (STAFF, MAIN)');
  console.log('  auditor  / Auditor123!  (AUDITOR, all branches, read-only)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());