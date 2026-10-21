require('dotenv').config();
const request = require('supertest');
const bcrypt = require('bcryptjs');
const app = require('../src/app');
const prisma = require('../src/config/db');

jest.setTimeout(120000);
const stamp = Date.now();
const prefix = `Reports Test ${stamp}`;
const URL = '/api/reports';
const ids = {};
const tokens = {};
const userIds = [];
const productIds = [];
const saleIds = [];
const movementIds = [];
const stockIds = [];

const bearer = (token) => ({ Authorization: `Bearer ${token}` });
const get = (token, path) => request(app).get(path).set(bearer(token));

async function createUser(label, role, branchId) {
  const user = await prisma.user.create({ data: {
    username: `test-reports-${label}-${stamp}`,
    passwordHash: await bcrypt.hash('Test12345', 10),
    fullName: `${prefix} ${label}`,
    role,
    branchId,
  } });
  userIds.push(user.id);
  ids[label] = user.id;
  tokens[label] = (await request(app).post('/api/auth/login').send({ username: user.username, password: 'Test12345' })).body.token;
  return user;
}

beforeAll(async () => {
  ids.branchA = (await prisma.branch.create({ data: { name: `${prefix} A`, code: `RPA${stamp}` } })).id;
  ids.branchB = (await prisma.branch.create({ data: { name: `${prefix} B`, code: `RPB${stamp}` } })).id;
  await createUser('managerA', 'BRANCH_MANAGER', ids.branchA);
  await createUser('managerB', 'BRANCH_MANAGER', ids.branchB);
  await createUser('admin', 'ADMIN', null);
  await createUser('auditor', 'AUDITOR', null);
  await createUser('staff', 'STAFF', ids.branchA);

  const productA = await prisma.product.create({ data: {
    name: `${prefix} Coffee`, sku: `RP-A-${stamp}`, unit: 'box', costPrice: 5, sellingPrice: 10,
  } });
  const productAmharic = await prisma.product.create({ data: {
    name: 'ቡና', sku: `RP-AM-${stamp}`, unit: 'box', costPrice: 2, sellingPrice: 4,
  } });
  productIds.push(productA.id, productAmharic.id);
  ids.productA = productA.id;
  ids.productAmharic = productAmharic.id;

  const stocks = await prisma.branchStock.createMany({ data: [
    { branchId: ids.branchA, productId: productA.id, quantity: 10 },
    { branchId: ids.branchA, productId: productAmharic.id, quantity: 3 },
    { branchId: ids.branchB, productId: productA.id, quantity: 7 },
  ] });
  void stocks;
  const stockRows = await prisma.branchStock.findMany({ where: { productId: { in: productIds } }, select: { id: true } });
  stockIds.push(...stockRows.map(({ id }) => id));

  const saleA = await prisma.sale.create({ data: {
    invoiceNumber: `RP-A-${stamp}`, branchId: ids.branchA, createdById: ids.managerA,
    subtotal: 10, taxType: 'VAT', taxRate: 0.15, taxAmount: 1.5, total: 11.5,
    createdAt: new Date('2026-10-20T21:00:00.000Z'),
    items: { create: [{ productId: productA.id, quantity: 1, unitPrice: 11.5, lineTotal: 11.5 }] },
  } });
  const saleB = await prisma.sale.create({ data: {
    invoiceNumber: `RP-B-${stamp}`, branchId: ids.branchB, createdById: ids.managerB,
    subtotal: 8, taxType: 'VAT', taxRate: 0.15, taxAmount: 1.2, total: 9.2,
    createdAt: new Date('2026-10-21T21:00:00.000Z'),
    items: { create: [{ productId: productAmharic.id, quantity: 2, unitPrice: 4.6, lineTotal: 9.2 }] },
  } });
  saleIds.push(saleA.id, saleB.id);
  ids.saleA = saleA.id;
  ids.saleB = saleB.id;

  const movementA = await prisma.stockMovement.create({ data: {
    productId: productAmharic.id, branchId: ids.branchA, type: 'OPENING_STOCK', quantityChange: 3,
    quantityAfter: 3, referenceType: 'SEED', userId: ids.managerA, createdAt: new Date('2026-10-21T00:00:00.000Z'),
  } });
  const movementB = await prisma.stockMovement.create({ data: {
    productId: productA.id, branchId: ids.branchB, type: 'SALE', quantityChange: -1,
    quantityAfter: 7, referenceType: 'SALE', referenceId: saleB.id, userId: ids.managerB, createdAt: new Date('2026-10-21T01:00:00.000Z'),
  } });
  movementIds.push(movementA.id, movementB.id);
});

afterAll(async () => {
  await prisma.stockMovement.deleteMany({ where: { id: { in: movementIds } } });
  await prisma.branchStock.deleteMany({ where: { id: { in: stockIds } } });
  await prisma.saleItem.deleteMany({ where: { saleId: { in: saleIds } } });
  await prisma.sale.deleteMany({ where: { id: { in: saleIds } } });
  await prisma.product.deleteMany({ where: { id: { in: productIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.branch.deleteMany({ where: { id: { in: [ids.branchA, ids.branchB] } } });
  await prisma.$disconnect();
});

test('JSON reports return contract fields, pagination, summaries and honor branch/product/date filters', async () => {
  const stock = await get(tokens.managerA, `${URL}/stock?limit=1`);
  expect(stock.status).toBe(200);
  expect(stock.body).toMatchObject({ page: 1, limit: 1, total: 2, totals: { totalValuation: 56 } });
  expect(stock.body.data).toHaveLength(1);

  const sales = await get(tokens.admin, `${URL}/sales?productId=${ids.productA}&from=2026-10-21&to=2026-10-21`);
  expect(sales.status).toBe(200);
  expect(sales.body.total).toBe(1);
  expect(sales.body.data[0]).toMatchObject({ invoiceNumber: `RP-A-${stamp}`, branchName: `${prefix} A`, cashier: `${prefix} managerA`, net: 10, tax: 1.5, total: 11.5 });

  const movements = await get(tokens.admin, `${URL}/movements?productId=${ids.productAmharic}&from=2026-10-21&to=2026-10-21`);
  expect(movements.status).toBe(200);
  expect(movements.body.total).toBe(1);
  expect(movements.body.data[0]).toMatchObject({ productName: 'ቡና', type: 'OPENING_STOCK', quantityChange: 3, user: `${prefix} managerA` });
});

test('CSV downloads have a UTF-8 BOM and export every matching row despite pagination parameters', async () => {
  const stock = await get(tokens.admin, `${URL}/stock?branchId=${ids.branchA}&limit=1&format=csv`);
  expect(stock.status).toBe(200);
  expect(stock.headers['content-type']).toContain('text/csv');
  expect(stock.headers['content-type']).toContain('charset=utf-8');
  expect(stock.text.charCodeAt(0)).toBe(0xfeff);
  expect(stock.text).toContain('ቡና');
  expect(stock.text.trim().split('\r\n')).toHaveLength(3); // header plus both filtered rows, not one page

  const sales = await get(tokens.admin, `${URL}/sales?branchId=${ids.branchA}&productId=${ids.productA}&from=2026-10-21&to=2026-10-21&format=csv&limit=1`);
  expect(sales.text.charCodeAt(0)).toBe(0xfeff);
  expect(sales.text.trim().split('\r\n')).toHaveLength(2);
  const movements = await get(tokens.admin, `${URL}/movements?branchId=${ids.branchA}&productId=${ids.productAmharic}&from=2026-10-21&to=2026-10-21&format=csv&limit=1`);
  expect(movements.text.charCodeAt(0)).toBe(0xfeff);
  expect(movements.text.trim().split('\r\n')).toHaveLength(2);
  expect(movements.text).toContain('ቡና');
});

test('Amharic CSV keeps localized labels and Ethiopian dates while exporting all matching rows', async () => {
  const stock = await get(tokens.admin, `${URL}/stock?branchId=${ids.branchA}&format=csv&lang=am&limit=1`);
  expect(stock.status).toBe(200);
  expect(stock.text.charCodeAt(0)).toBe(0xfeff);
  expect(stock.text).toContain('የምርት ስም');
  expect(stock.text.trim().split('\r\n')).toHaveLength(3);

  const movements = await get(tokens.admin, `${URL}/movements?branchId=${ids.branchA}&productId=${ids.productAmharic}&format=csv&lang=am`);
  expect(movements.text).toContain('የእንቅስቃሴ ዓይነት');
  expect(movements.text).toContain('የመጀመሪያ ክምችት');
  expect(movements.text).toContain('ጥቅምት 11 ቀን 2019 ዓ.ም');
});

test('Manager sees own branch only, Auditor can see all branches, and Staff is forbidden', async () => {
  const ownSales = await get(tokens.managerA, `${URL}/sales`);
  expect(ownSales.status).toBe(200);
  expect(ownSales.body.total).toBeGreaterThanOrEqual(1);
  expect(ownSales.body.data.every((sale) => sale.branchId === ids.branchA)).toBe(true);

  const wrongBranch = await get(tokens.managerA, `${URL}/stock?branchId=${ids.branchB}`);
  expect(wrongBranch.status).toBe(403);
  const auditor = await get(tokens.auditor, `${URL}/sales`);
  expect(auditor.status).toBe(200);
  expect(auditor.body.total).toBeGreaterThanOrEqual(2);
  expect(auditor.body.data.some((sale) => sale.branchId === ids.branchB)).toBe(true);
  expect((await get(tokens.staff, `${URL}/stock`)).status).toBe(403);
  expect((await request(app).get(`${URL}/stock`)).status).toBe(401);
});

test('rejects an unsupported report format', async () => {
  const res = await get(tokens.admin, `${URL}/stock?format=xml`);
  expect(res.status).toBe(400);
  expect(res.body.error.code).toBe('VALIDATION_ERROR');
  expect(res.body.error.details[0].field).toBe('format');
});
