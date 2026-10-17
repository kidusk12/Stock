// Needs the seeded users (npm run seed): admin / Admin123!
// Follows docs/api-contract.md sections 6.2 and 6.3. Creates its own data and deletes it at the end.
require('dotenv').config();
const request = require('supertest');
const bcrypt = require('bcryptjs');
const app = require('../src/app');
const prisma = require('../src/config/db');
const { applyMovement } = require('../src/services/stockService');

jest.setTimeout(60000);

const stamp = Date.now();
const prefix = `Test Stock ${stamp}`; // product names for p1 and p2 start with this
const listQ = `q=${encodeURIComponent(prefix)}`; // finds only p1 and p2 (never p3 or seeded data)

const ids = {};
const tokens = {};
const userIds = [];

const bearer = (token) => ({ Authorization: `Bearer ${token}` });
const get = (token, path) => request(app).get(path).set(bearer(token));
const put = (token, path, body) => request(app).put(path).set(bearer(token)).send(body);
const login = (username, password) => request(app).post('/api/auth/login').send({ username, password });

// "Ethiopia date" (UTC+3) as YYYY-MM-DD, moved by some hours
const ethiopiaDate = (offsetHours = 0) =>
  new Date(Date.now() + (3 + offsetHours) * 60 * 60 * 1000).toISOString().slice(0, 10);

async function createUser(label, role, branchId) {
  const user = await prisma.user.create({
    data: {
      username: `test-stock-${label}-${stamp}`,
      passwordHash: await bcrypt.hash('Test12345', 10),
      fullName: `Stock Test ${label}`,
      role,
      branchId,
    },
  });
  userIds.push(user.id);
  tokens[label] = (await login(user.username, 'Test12345')).body.token;
  return user;
}

beforeAll(async () => {
  const a = await prisma.branch.create({ data: { name: `${prefix} Branch A`, code: `TSA${stamp}` } });
  const b = await prisma.branch.create({ data: { name: `${prefix} Branch B`, code: `TSB${stamp}` } });
  ids.branchA = a.id;
  ids.branchB = b.id;

  const p1 = await prisma.product.create({
    data: { name: `${prefix} P1`, sku: `TS-${stamp}-1`, unit: 'piece', costPrice: 10, sellingPrice: 15 },
  });
  const p2 = await prisma.product.create({
    data: { name: `${prefix} P2`, sku: `TS-${stamp}-2`, unit: 'piece', costPrice: 20.5, sellingPrice: 30 },
  });
  const p3 = await prisma.product.create({
    data: { name: `Thr ${stamp}`, sku: `TS-${stamp}-3`, unit: 'piece', costPrice: 5, sellingPrice: 8 },
  });
  ids.p1 = p1.id;
  ids.p2 = p2.id;
  ids.p3 = p3.id;

  // p1 has a minimum of 5 in both branches; the others have none
  await prisma.branchStock.createMany({
    data: [
      { productId: ids.p1, branchId: ids.branchA, minQty: 5 },
      { productId: ids.p1, branchId: ids.branchB, minQty: 5 },
      { productId: ids.p2, branchId: ids.branchA },
      { productId: ids.p3, branchId: ids.branchA },
    ],
  });

  const manager = await createUser('manager', 'BRANCH_MANAGER', ids.branchA);
  await createUser('staff', 'STAFF', ids.branchA);
  await createUser('auditor', 'AUDITOR', null);
  ids.managerId = manager.id;
  tokens.admin = (await login('admin', 'Admin123!')).body.token;

  // Quantities go through the stock service, so movement rows exist too
  const move = (productId, branchId, quantity, type, extra = {}) =>
    applyMovement({ productId, branchId, quantity, type, userId: manager.id, ...extra });
  await move(ids.p1, ids.branchA, 12, 'OPENING_STOCK');
  await move(ids.p1, ids.branchA, -2, 'SALE', { referenceType: 'SALE', referenceId: 999 }); // p1 in A = 10
  await move(ids.p1, ids.branchB, 3, 'OPENING_STOCK'); // p1 in B = 3 (low: minimum is 5)
  await move(ids.p2, ids.branchA, 4.5, 'OPENING_STOCK');
  await move(ids.p3, ids.branchA, 3, 'OPENING_STOCK');
});

afterAll(async () => {
  const productIds = [ids.p1, ids.p2, ids.p3];
  await prisma.notification.deleteMany({ where: { productId: { in: productIds } } });
  await prisma.stockMovement.deleteMany({ where: { productId: { in: productIds } } });
  await prisma.branchStock.deleteMany({ where: { productId: { in: productIds } } });
  await prisma.product.deleteMany({ where: { id: { in: productIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.branch.deleteMany({ where: { id: { in: [ids.branchA, ids.branchB] } } });
  await prisma.$disconnect();
});

test('roles: who can use which stock endpoint', async () => {
  expect((await request(app).get('/api/stock')).status).toBe(401);

  expect((await get(tokens.staff, '/api/stock/consolidated')).status).toBe(403);
  expect((await get(tokens.manager, '/api/stock/consolidated')).status).toBe(403);
  expect((await get(tokens.auditor, `/api/stock/consolidated?${listQ}`)).status).toBe(200);

  const url = `/api/stock/${ids.branchA}/${ids.p3}/thresholds`;
  const staff = await put(tokens.staff, url, { minQuantity: 1 });
  expect(staff.status).toBe(403);
  expect(staff.body.error.code).toBe('FORBIDDEN');
  const auditor = await put(tokens.auditor, url, { minQuantity: 1 });
  expect(auditor.status).toBe(403);
  expect(auditor.body.error.code).toBe('FORBIDDEN');
});

test('GET /api/stock returns the contract fields, stockValue, and null for a minimum of 0', async () => {
  const res = await get(tokens.admin, `/api/stock?${listQ}`);
  expect(res.status).toBe(200);
  expect(res.body.total).toBe(3);

  const p1a = res.body.data.find((r) => r.productId === ids.p1 && r.branchId === ids.branchA);
  expect(p1a).toEqual({
    branchId: ids.branchA,
    productId: ids.p1,
    productName: `${prefix} P1`,
    sku: `TS-${stamp}-1`,
    quantity: 10,
    minQuantity: 5,
    maxQuantity: null,
    costPrice: 10,
    stockValue: 100,
  });

  const p2a = res.body.data.find((r) => r.productId === ids.p2);
  expect(p2a.quantity).toBe(4.5);
  expect(p2a.minQuantity).toBeNull();
  expect(p2a.costPrice).toBe(20.5);
  expect(p2a.stockValue).toBe(92.25);
});

test('GET /api/stock filters by branch and by product', async () => {
  const byBranch = await get(tokens.admin, `/api/stock?${listQ}&branchId=${ids.branchA}`);
  expect(byBranch.body.total).toBe(2);
  byBranch.body.data.forEach((r) => expect(r.branchId).toBe(ids.branchA));

  const byProduct = await get(tokens.admin, `/api/stock?productId=${ids.p1}`);
  expect(byProduct.body.total).toBe(2);
  byProduct.body.data.forEach((r) => expect(r.productId).toBe(ids.p1));
});

test('Manager and Staff only see their own branch; Admin and Auditor see all', async () => {
  for (const label of ['manager', 'staff']) {
    const own = await get(tokens[label], `/api/stock?${listQ}`);
    expect(own.status).toBe(200);
    expect(own.body.total).toBe(2);
    own.body.data.forEach((r) => expect(r.branchId).toBe(ids.branchA));

    const other = await get(tokens[label], `/api/stock?${listQ}&branchId=${ids.branchB}`);
    expect(other.status).toBe(403);
    expect(other.body.error.code).toBe('FORBIDDEN');
  }

  const auditor = await get(tokens.auditor, `/api/stock?${listQ}`);
  expect(auditor.body.total).toBe(3);
});

test('lowOnly returns only rows with a minimum set and quantity at or below it', async () => {
  const res = await get(tokens.admin, `/api/stock?${listQ}&lowOnly=true`);
  expect(res.status).toBe(200);
  expect(res.body.total).toBe(1);
  expect(res.body.data[0].productId).toBe(ids.p1);
  expect(res.body.data[0].branchId).toBe(ids.branchB);
  expect(res.body.data[0].quantity).toBe(3);
});

test('pagination works and bad parameters are 400 VALIDATION_ERROR', async () => {
  const first = await get(tokens.admin, `/api/stock?${listQ}&limit=2`);
  expect(first.body.data).toHaveLength(2);
  expect(first.body.total).toBe(3);
  expect(first.body.page).toBe(1);
  expect(first.body.limit).toBe(2);

  const second = await get(tokens.admin, `/api/stock?${listQ}&limit=2&page=2`);
  expect(second.body.data).toHaveLength(1);

  for (const bad of ['limit=101', 'page=0', 'branchId=abc', 'productId=abc']) {
    const res = await get(tokens.admin, `/api/stock?${bad}`);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  }
});

test('GET /api/stock/consolidated totals each product across branches', async () => {
  const res = await get(tokens.admin, `/api/stock/consolidated?${listQ}`);
  expect(res.status).toBe(200);
  expect(res.body.total).toBe(2);

  const [first, second] = res.body.data;
  expect(first.productId).toBe(ids.p1);
  expect(first.productName).toBe(`${prefix} P1`);
  expect(first.totalQuantity).toBe(13);
  expect(first.branches).toEqual([
    { branchId: ids.branchA, branchName: `${prefix} Branch A`, quantity: 10 },
    { branchId: ids.branchB, branchName: `${prefix} Branch B`, quantity: 3 },
  ]);
  expect(second.productId).toBe(ids.p2);
  expect(second.totalQuantity).toBe(4.5);
});

test('PUT thresholds: set, keep max when omitted, clear max with null, 0 means not set', async () => {
  const url = `/api/stock/${ids.branchA}/${ids.p3}/thresholds`;

  const set = await put(tokens.admin, url, { minQuantity: 6, maxQuantity: 50 });
  expect(set.status).toBe(200);
  expect(set.body.productId).toBe(ids.p3);
  expect(set.body.branchId).toBe(ids.branchA);
  expect(set.body.quantity).toBe(3);
  expect(set.body.minQuantity).toBe(6);
  expect(set.body.maxQuantity).toBe(50);

  const keep = await put(tokens.admin, url, { minQuantity: 7 });
  expect(keep.body.minQuantity).toBe(7);
  expect(keep.body.maxQuantity).toBe(50);

  const clear = await put(tokens.admin, url, { minQuantity: 7, maxQuantity: null });
  expect(clear.body.maxQuantity).toBeNull();

  const manager = await put(tokens.manager, url, { minQuantity: 2 });
  expect(manager.status).toBe(200);
  expect(manager.body.minQuantity).toBe(2);

  const zero = await put(tokens.admin, url, { minQuantity: 0 });
  expect(zero.status).toBe(200);
  expect(zero.body.minQuantity).toBeNull();
});

test('PUT thresholds resets the low-stock alert only when the stock is no longer low', async () => {
  const url = `/api/stock/${ids.branchA}/${ids.p3}/thresholds`;
  const key = { productId_branchId: { productId: ids.p3, branchId: ids.branchA } };
  const flag = async () => (await prisma.branchStock.findUnique({ where: key })).lowStockAlerted;

  await prisma.branchStock.update({ where: key, data: { minQty: 5, lowStockAlerted: true } });

  await put(tokens.admin, url, { minQuantity: 5 }); // quantity 3 is still at or below 5
  expect(await flag()).toBe(true);

  await put(tokens.admin, url, { minQuantity: 2 }); // quantity 3 is above 2
  expect(await flag()).toBe(false);
});

test('PUT thresholds rejects bad input, other branches and unknown records', async () => {
  const url = `/api/stock/${ids.branchA}/${ids.p3}/thresholds`;

  const bad = [
    { minQuantity: 8, maxQuantity: 5 }, // max below min
    { minQuantity: -1 },
    { minQuantity: 1.234 }, // more than 2 decimals
    {}, // minQuantity missing
  ];
  for (const body of bad) {
    const res = await put(tokens.admin, url, body);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  }

  const otherBranch = await put(tokens.manager, `/api/stock/${ids.branchB}/${ids.p1}/thresholds`, { minQuantity: 1 });
  expect(otherBranch.status).toBe(403);
  expect(otherBranch.body.error.code).toBe('FORBIDDEN');

  const unknownBranch = await put(tokens.admin, `/api/stock/999999999/${ids.p3}/thresholds`, { minQuantity: 1 });
  expect(unknownBranch.status).toBe(404);
  const unknownProduct = await put(tokens.admin, `/api/stock/${ids.branchA}/999999999/thresholds`, { minQuantity: 1 });
  expect(unknownProduct.status).toBe(404);
  const badId = await put(tokens.admin, `/api/stock/abc/${ids.p3}/thresholds`, { minQuantity: 1 });
  expect(badId.status).toBe(404);
});

test('GET /api/stock-movements returns the contract fields, newest first', async () => {
  const res = await get(tokens.admin, `/api/stock-movements?productId=${ids.p1}&branchId=${ids.branchA}`);
  expect(res.status).toBe(200);
  expect(res.body.total).toBe(2);

  expect(res.body.data[0]).toMatchObject({
    productId: ids.p1,
    productName: `${prefix} P1`,
    branchId: ids.branchA,
    type: 'SALE',
    quantityChange: -2,
    quantityAfter: 10,
    referenceType: 'SALE',
    referenceId: 999,
    reason: null,
    createdBy: { id: ids.managerId, name: 'Stock Test manager' },
  });
  expect(res.body.data[0].createdAt).toBeTruthy();
  expect(res.body.data[1].type).toBe('OPENING_STOCK');
});

test('movements filters: type, Ethiopia-time dates, and bad values', async () => {
  const base = `/api/stock-movements?productId=${ids.p1}`;

  const sales = await get(tokens.admin, `${base}&type=SALE`);
  expect(sales.body.total).toBe(1);

  const today = ethiopiaDate();
  const sameDay = await get(tokens.admin, `${base}&from=${today}&to=${today}`);
  expect(sameDay.body.total).toBe(3);

  expect((await get(tokens.admin, `${base}&from=${ethiopiaDate(24)}`)).body.total).toBe(0);
  expect((await get(tokens.admin, `${base}&to=${ethiopiaDate(-24)}`)).body.total).toBe(0);

  for (const bad of ['type=NOPE', 'from=abc', 'to=2026-13-45']) {
    const res = await get(tokens.admin, `${base}&${bad}`);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  }
});

test('movements are limited to the own branch for Manager and Staff', async () => {
  const base = `/api/stock-movements?productId=${ids.p1}`;

  for (const label of ['manager', 'staff']) {
    const own = await get(tokens[label], base);
    expect(own.status).toBe(200);
    expect(own.body.total).toBe(2);
    own.body.data.forEach((m) => expect(m.branchId).toBe(ids.branchA));

    const other = await get(tokens[label], `${base}&branchId=${ids.branchB}`);
    expect(other.status).toBe(403);
    expect(other.body.error.code).toBe('FORBIDDEN');
  }

  const auditor = await get(tokens.auditor, base);
  expect(auditor.body.total).toBe(3);
});