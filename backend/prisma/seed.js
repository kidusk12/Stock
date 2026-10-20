// Run with: npm run seed
// Place this file at backend/prisma/seed.js
// Creates the accounts, two branches, categories, suppliers, 25 products and real opening stock.
// Safe to run again: it never overwrites existing records, and opening stock is loaded only once.
require('dotenv').config();
const bcrypt = require('bcryptjs');
const prisma = require('../src/config/db'); // the shared client, the same one the stock service uses
const { applyMovement, createStockRowsForBranch } = require('../src/services/stockService');

async function upsertUser({ username, password, fullName, role, branchId }) {
  const passwordHash = await bcrypt.hash(password, 10);
  return prisma.user.upsert({
    where: { username },
    update: {},
    create: { username, passwordHash, fullName, role, branchId },
  });
}

// EAN-13 barcode: 12 digits plus the check digit
function ean13(base12) {
  const sum = base12.split('').reduce((s, d, i) => s + Number(d) * (i % 2 === 0 ? 1 : 3), 0);
  return base12 + ((10 - (sum % 10)) % 10);
}

const CATEGORIES = [
  { name: 'Beverages', code: 'BEV' },
  { name: 'Food', code: 'FOD' },
  { name: 'Household', code: 'HOM' },
  { name: 'Personal Care', code: 'PRC' },
  { name: 'Stationery', code: 'STA' },
];

const SUPPLIERS = [
  { name: 'Addis Beverages Distribution', contactName: 'Dawit Alemu', phone: '+251911000001', tin: '0012345671', address: 'Kality, Addis Ababa' },
  { name: 'Habesha Foods Wholesale', contactName: 'Hanna Bekele', phone: '+251911000002', tin: '0012345672', address: 'Merkato, Addis Ababa' },
  { name: 'Merkato Household Supplies', contactName: 'Samuel Girma', phone: '+251911000003', tin: '0012345673', address: 'Merkato, Addis Ababa' },
  { name: 'Selam Stationery Import', contactName: 'Selam Tadesse', phone: '+251911000004', tin: '0012345674', address: 'Piassa, Addis Ababa' },
];

// cost and price are in birr; price INCLUDES tax. main / bole are the opening quantities
// in each branch (0 = nothing in stock). min / max are the thresholds for both branches.
// Low on purpose: Coca-Cola in BOLE, Sunflower Oil and Body Lotion in MAIN. Out of stock: Toilet Paper in BOLE.
const PRODUCTS = [
  { cat: 'BEV', name: 'Coca-Cola 500ml', unit: 'bottle', cost: 18, price: 25, main: 60, bole: 6, min: 10, max: 120 },
  { cat: 'BEV', name: 'Sprite 500ml', unit: 'bottle', cost: 18, price: 25, main: 48, bole: 36, min: 10, max: 120 },
  { cat: 'BEV', name: 'Mineral Water 1L', unit: 'bottle', cost: 12, price: 18, main: 90, bole: 70, min: 20, max: 200 },
  { cat: 'BEV', name: 'Orange Juice 1L', unit: 'box', cost: 55, price: 75, main: 24, bole: 18, min: 6, max: 60 },
  { cat: 'BEV', name: 'Ethiopian Coffee Beans 250g', unit: 'pack', cost: 140, price: 190, main: 30, bole: 22, min: 8, max: 60 },
  { cat: 'BEV', name: 'Black Tea 100 Bags', unit: 'box', cost: 60, price: 85, main: 28, bole: 15, min: 6, max: 50 },
  { cat: 'FOD', name: 'Teff Flour 5kg', unit: 'pack', cost: 420, price: 520, main: 20, bole: 14, min: 5, max: 40 },
  { cat: 'FOD', name: 'Sunflower Oil 1L', unit: 'bottle', cost: 150, price: 195, main: 8, bole: 25, min: 10, max: 60 },
  { cat: 'FOD', name: 'Pasta 500g', unit: 'pack', cost: 45, price: 65, main: 55, bole: 40, min: 12, max: 100 },
  { cat: 'FOD', name: 'White Sugar', unit: 'kg', cost: 85, price: 110, main: 80.5, bole: 45.25, min: 20, max: 150 },
  { cat: 'FOD', name: 'Iodized Salt 1kg', unit: 'pack', cost: 18, price: 28, main: 70, bole: 50, min: 15, max: 120 },
  { cat: 'FOD', name: 'Red Lentils', unit: 'kg', cost: 95, price: 125, main: 40, bole: 32.5, min: 10, max: 80 },
  { cat: 'FOD', name: 'Biscuits Family Pack', unit: 'pack', cost: 22, price: 32, main: 65, bole: 52, min: 15, max: 120 },
  { cat: 'HOM', name: 'Laundry Detergent 1kg', unit: 'pack', cost: 130, price: 175, main: 26, bole: 20, min: 6, max: 50 },
  { cat: 'HOM', name: 'Dish Soap 500ml', unit: 'bottle', cost: 55, price: 80, main: 34, bole: 28, min: 8, max: 70 },
  { cat: 'HOM', name: 'Bleach 1L', unit: 'bottle', cost: 40, price: 60, main: 30, bole: 24, min: 8, max: 60 },
  { cat: 'HOM', name: 'Toilet Paper 4 Rolls', unit: 'pack', cost: 70, price: 95, main: 30, bole: 0, min: 12, max: 80 },
  { cat: 'HOM', name: 'Candles 6 Pack', unit: 'pack', cost: 30, price: 45, main: 40, bole: 35, min: 10, max: 80 },
  { cat: 'PRC', name: 'Bath Soap Bar', unit: 'piece', cost: 20, price: 30, main: 100, bole: 80, min: 25, max: 200 },
  { cat: 'PRC', name: 'Toothpaste 100ml', unit: 'piece', cost: 48, price: 70, main: 45, bole: 38, min: 10, max: 90 },
  { cat: 'PRC', name: 'Shampoo 400ml', unit: 'bottle', cost: 120, price: 165, main: 22, bole: 17, min: 6, max: 45 },
  { cat: 'PRC', name: 'Body Lotion 400ml', unit: 'bottle', cost: 135, price: 185, main: 4, bole: 15, min: 5, max: 40 },
  { cat: 'STA', name: 'Exercise Book 40 Pages', unit: 'piece', cost: 15, price: 25, main: 150, bole: 120, min: 40, max: 300 },
  { cat: 'STA', name: 'Ballpoint Pen Blue', unit: 'piece', cost: 5, price: 10, main: 200, bole: 160, min: 50, max: 400 },
  { cat: 'STA', name: 'A4 Paper Ream 500', unit: 'ream', cost: 280, price: 360, main: 25, bole: 18, min: 6, max: 50 },
];

async function main() {
  // The single company settings row (id = 1). Prices include VAT (15%).
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

  const main = await prisma.branch.upsert({
    where: { code: 'MAIN' },
    update: {},
    create: { name: 'Main Branch', code: 'MAIN', address: 'Addis Ababa' },
  });
  const bole = await prisma.branch.upsert({
    where: { code: 'BOLE' },
    update: {},
    create: { name: 'Bole Branch', code: 'BOLE', address: 'Bole, Addis Ababa' },
  });

  // One user per role. Admin and Auditor have no branch (they see all branches).
  const admin = await upsertUser({ username: 'admin', password: 'Admin123!', fullName: 'System Admin', role: 'ADMIN', branchId: null });
  await upsertUser({ username: 'manager', password: 'Manager123!', fullName: 'Branch Manager', role: 'BRANCH_MANAGER', branchId: main.id });
  await upsertUser({ username: 'staff', password: 'Staff123!', fullName: 'Branch Staff', role: 'STAFF', branchId: main.id });
  await upsertUser({ username: 'auditor', password: 'Auditor123!', fullName: 'Auditor', role: 'AUDITOR', branchId: null });

  // Categories (name is unique)
  const categoryIds = {};
  for (const c of CATEGORIES) {
    const category = await prisma.category.upsert({ where: { name: c.name }, update: {}, create: { name: c.name } });
    categoryIds[c.code] = category.id;
  }

  // Suppliers (name is not unique in the schema, so look it up first)
  for (const s of SUPPLIERS) {
    const exists = await prisma.supplier.findFirst({ where: { name: s.name } });
    if (!exists) await prisma.supplier.create({ data: s });
  }

  // Products (sku is unique). The serial number is shared by SKU and barcode.
  const products = [];
  for (let i = 0; i < PRODUCTS.length; i += 1) {
    const p = PRODUCTS[i];
    const sku = `${p.cat}-${String(i + 1).padStart(4, '0')}`;
    const barcode = ean13(`616110${String(1001 + i).padStart(6, '0')}`);
    const product = await prisma.product.upsert({
      where: { sku },
      update: {},
      create: {
        name: p.name,
        sku,
        barcode,
        categoryId: categoryIds[p.cat],
        unit: p.unit,
        costPrice: p.cost,
        sellingPrice: p.price, // includes tax
      },
    });
    products.push({ product, data: p });
  }

  // Contract 1.8: a stock row (quantity 0) for every product in every branch
  await createStockRowsForBranch(main.id);
  await createStockRowsForBranch(bole.id);

  // Thresholds, then opening stock through the stock service so the movement history is real.
  // Opening stock is loaded only if that product has no OPENING_STOCK movement in that branch yet.
  let movements = 0;
  for (const { product, data } of products) {
    for (const [branch, quantity] of [[main, data.main], [bole, data.bole]]) {
      await prisma.branchStock.update({
        where: { productId_branchId: { productId: product.id, branchId: branch.id } },
        data: { minQty: data.min, maxQty: data.max },
      });

      if (quantity <= 0) continue; // quantity stays 0: out of stock
      const loaded = await prisma.stockMovement.findFirst({
        where: { productId: product.id, branchId: branch.id, type: 'OPENING_STOCK' },
        select: { id: true },
      });
      if (loaded) continue;

      await applyMovement({
        productId: product.id,
        branchId: branch.id,
        quantity,
        type: 'OPENING_STOCK',
        reason: 'Opening stock (seed)',
        userId: admin.id,
      });
      movements += 1;
    }
  }

  console.log(`Seed complete: 2 branches, ${CATEGORIES.length} categories, ${SUPPLIERS.length} suppliers, ${PRODUCTS.length} products, ${movements} new opening-stock movements.`);
  console.log('Test accounts:');
  console.log('  admin    / Admin123!    (ADMIN, all branches)');
  console.log('  manager  / Manager123!  (BRANCH_MANAGER, MAIN)');
  console.log('  staff    / Staff123!    (STAFF, MAIN)');
  console.log('  auditor  / Auditor123!  (AUDITOR, all branches, read-only)');
  console.log('Low stock on purpose: Coca-Cola (BOLE), Sunflower Oil (MAIN), Body Lotion (MAIN). Out of stock: Toilet Paper (BOLE).');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());