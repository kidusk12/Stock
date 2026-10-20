// Follows docs/api-contract.md v5, section 6.7 (K-K decided: no OPENING_STOCK reason).
// Creates its own branches, products, stock and users and deletes them at the end.
// Needs the seeded admin (npm run seed).
require('dotenv').config();
const request = require('supertest');
const bcrypt = require('bcryptjs');
const app = require('../src/app');
const prisma = require('../src/config/db');
const { applyMovement } = require('../src/services/stockService');

jest.setTimeout(120000);

const stamp = Date.now();
const prefix = `Adjustments Test ${stamp}`;
const URL = '/api/adjustments';
const ids = {};
const tokens = {};
const userIds = [];
const productIds = [];
const adjustmentIds = [];

const bearer = (token) => ({ Authorization: `Bearer ${token}` });
const get = (token, path) => request(app).get(path).set(bearer(token));
const post = (token, path, body) => request(app).post(path).set(bearer(token)).send(body);
const login = (username, password) => request(app).post('/api/auth/login').send({ username, password });

// "Ethiopia date" (UTC+3) as YYYY-MM-DD, moved by some hours
const ethiopiaDate = (offsetHours = 0) =>
  new Date(Date.now() + (3 + offsetHours) * 60 * 60 * 1000).toISOString().slice(0, 10);

// A 400 must be a VALIDATION_ERROR whose first detail has this field and rule (contract 1.4)
function expectValidation(res, field, rule) {
  expect(res.status).toBe(400);
  expect(res.body.error.code).toBe('VALIDATION_ERROR');
  expect(res.body.error.details[0].field).toBe(field);
  expect(res.body.error.details[0].rule).toBe(rule);
}

function expectError(res, status, code) {
  expect(res.status).toBe(status);
  expect(res.body.error.code).toBe(code);
}

// Posts an adjustment and remembers its id, so the cleanup can delete it
async function adjust(token, body) {
  const res = await post(token, URL, body);
  if (res.status === 201) adjustmentIds.push(res.body.id);
  return res;
}

const stockOf = async (productId, branchId) =>
  (await prisma.branchStock.findUnique({ where: { productId_branchId: { productId, branchId } } })).quantity.toNumber();

async function createUser(label, role, branchId) {
  const user = await prisma.user.create({
    data: {
      username: `test-adjust-${label}-${stamp}`,
      passwordHash: await bcrypt.hash('Test12345', 10),
      fullName: `Adjustments Test ${label}`,
      role,
      branchId,
    },
  });
  userIds.push(user.id);
  ids[`${label}Id`] = user.id;
  tokens[label] = (await login(user.username, 'Test12345')).body.token;
  return user;
}

async function createProduct(label, extra = {}) {
  const product = await prisma.product.create({
    data: {
      name: `${prefix} ${label}`,
      sku: `ADT-${stamp}-${label}`,
      unit: 'piece',
      costPrice: 1,
      sellingPrice: 2,
      ...extra,
    },
  });
  productIds.push(product.id);
  ids[`p${label}`] = product.id;
  return product;
}

beforeAll(async () => {
  const branch = async (letter, extra = {}) =>
    (await prisma.branch.create({ data: { name: `${prefix} Branch ${letter}`, code: `AD${letter}${stamp}`, ...extra } })).id;
  ids.A = await branch('A');
  ids.B = await branch('B');
  ids.C = await branch('C', { isActive: false });

  await createUser('managerA', 'BRANCH_MANAGER', ids.A);
  await createUser('staffA', 'STAFF', ids.A);
  await createUser('managerB', 'BRANCH_MANAGER', ids.B);
  await createUser('auditor', 'AUDITOR', null);
  tokens.admin = (await login('admin', 'Admin123!')).body.token;

  for (const label of ['Main', 'Short', 'Race', 'InB']) await createProduct(label);
  await createProduct('Inactive', { isActive: false });

  // Quantities go through the stock service, so the movement history is real
  const load = (productId, branchId, quantity) =>
    applyMovement({ productId, branchId, quantity, type: 'OPENING_STOCK', userId: ids.managerAId });
  await load(ids.pMain, ids.A, 20);
  await load(ids.pShort, ids.A, 3);
  await load(ids.pRace, ids.A, 1);
  await load(ids.pInB, ids.B, 10);
});

afterAll(async () => {
  await prisma.auditLog.deleteMany({
    where: { OR: [{ entityType: 'ADJUSTMENT', entityId: { in: adjustmentIds } }, { userId: { in: userIds } }] },
  });
  await prisma.adjustment.deleteMany({ where: { id: { in: adjustmentIds } } });
  await prisma.notification.deleteMany({ where: { productId: { in: productIds } } });
  await prisma.stockMovement.deleteMany({ where: { productId: { in: productIds } } });
  await prisma.branchStock.deleteMany({ where: { productId: { in: productIds } } });
  await prisma.product.deleteMany({ where: { id: { in: productIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.branch.deleteMany({ where: { id: { in: [ids.A, ids.B, ids.C] } } });
  await prisma.$disconnect();
});

test('an anonymous user is blocked; the Auditor reads adjustments but can never write', async () => {
  const body = { branchId: ids.A, productId: ids.pMain, quantity: -1, reason: 'DAMAGE' };
  expect((await request(app).get(URL)).status).toBe(401);
  expect((await request(app).post(URL).send(body)).status).toBe(401);

  expectError(await post(tokens.auditor, URL, body), 403, 'FORBIDDEN');
  expect((await get(tokens.auditor, URL)).status).toBe(200);
  expect(await prisma.adjustment.count({ where: { userId: (await prisma.user.findUnique({ where: { username: `test-adjust-auditor-${stamp}` } })).id } })).toBe(0);
});

test('a negative adjustment returns the contract object, removes stock, and writes the movement and audit entry', async () => {
  const before = await stockOf(ids.pMain, ids.A);

  const res = await adjust(tokens.staffA, {
    productId: ids.pMain,
    quantity: -3,
    reason: 'DAMAGE',
    note: '  Dropped in storage  ',
  }); // Staff may create adjustments (T2); the branch defaults to their own
  expect(res.status).toBe(201);
  expect(res.body).toMatchObject({
    branchId: ids.A,
    branchName: `${prefix} Branch A`,
    productId: ids.pMain,
    productName: `${prefix} Main`,
    quantity: -3,
    reason: 'DAMAGE',
    note: 'Dropped in storage',
    createdBy: { id: ids.staffAId, name: 'Adjustments Test staffA' },
  });
  expect(res.body.createdAt).toBeTruthy();
  expect(res.body).not.toHaveProperty('userId');
  expect(await stockOf(ids.pMain, ids.A)).toBe(before - 3);

  const saved = await prisma.adjustment.findUnique({ where: { id: res.body.id } });
  expect(saved.quantityChange.toNumber()).toBe(-3);
  expect(saved.userId).toBe(ids.staffAId);

  const movements = await prisma.stockMovement.findMany({
    where: { referenceType: 'ADJUSTMENT', referenceId: res.body.id },
  });
  expect(movements).toHaveLength(1);
  expect(movements[0]).toMatchObject({ type: 'ADJUSTMENT', reason: 'DAMAGE', branchId: ids.A, userId: ids.staffAId });
  expect(movements[0].quantityChange.toNumber()).toBe(-3);
  expect(movements[0].quantityAfter.toNumber()).toBe(before - 3);

  const audit = await prisma.auditLog.findMany({ where: { entityType: 'ADJUSTMENT', entityId: res.body.id } });
  expect(audit).toHaveLength(1);
  expect(audit[0].action).toBe('ADJUSTMENT_CREATED');
  expect(audit[0].userId).toBe(ids.staffAId);
  expect(audit[0].branchId).toBe(ids.A);
  expect(audit[0].oldValue).toBeNull();
  expect(audit[0].newValue).toEqual({ productId: ids.pMain, quantity: -3, reason: 'DAMAGE' });

  // The note is optional
  const noNote = await adjust(tokens.managerA, { productId: ids.pMain, quantity: -1, reason: 'EXPIRY' });
  expect(noNote.status).toBe(201);
  expect(noNote.body.note).toBeNull();
});

test('RECOUNT and OTHER may add or remove stock, with two decimals', async () => {
  const before = await stockOf(ids.pMain, ids.A);

  const up = await adjust(tokens.managerA, { productId: ids.pMain, quantity: 5, reason: 'RECOUNT' });
  expect(up.status).toBe(201);
  expect(up.body.quantity).toBe(5);
  expect(await stockOf(ids.pMain, ids.A)).toBe(before + 5);

  const down = await adjust(tokens.staffA, { productId: ids.pMain, quantity: -2.5, reason: 'OTHER' });
  expect(down.status).toBe(201);
  expect(down.body.quantity).toBe(-2.5);
  expect(await stockOf(ids.pMain, ids.A)).toBe(before + 2.5);

  const upOther = await adjust(tokens.managerA, { productId: ids.pMain, quantity: 0.25, reason: 'OTHER' });
  expect(upOther.status).toBe(201);
  expect(await stockOf(ids.pMain, ids.A)).toBe(before + 2.75);

  const movement = await prisma.stockMovement.findFirst({
    where: { referenceType: 'ADJUSTMENT', referenceId: up.body.id },
  });
  expect(movement).toMatchObject({ type: 'ADJUSTMENT', reason: 'RECOUNT' });
  expect(movement.quantityChange.toNumber()).toBe(5);
});

test('DAMAGE, EXPIRY and LOSS must be negative, and OPENING_STOCK is not a reason', async () => {
  const before = await stockOf(ids.pMain, ids.A);

  for (const reason of ['DAMAGE', 'EXPIRY', 'LOSS']) {
    expectValidation(await adjust(tokens.managerA, { productId: ids.pMain, quantity: 2, reason }), 'quantity', 'must_be_negative');
  }
  expectValidation(await adjust(tokens.managerA, { productId: ids.pMain, quantity: 5, reason: 'OPENING_STOCK' }), 'reason', 'invalid');
  expectValidation(await adjust(tokens.managerA, { productId: ids.pMain, quantity: -1, reason: 'NOPE' }), 'reason', 'invalid');

  expect(await stockOf(ids.pMain, ids.A)).toBe(before); // nothing changed
});

test('validation gives the right field and rule', async () => {
  const ok = { productId: ids.pMain, quantity: -1, reason: 'RECOUNT' };
  const bad = (override) => adjust(tokens.managerA, { ...ok, ...override });

  expectValidation(await bad({ quantity: 0 }), 'quantity', 'invalid');
  expectValidation(await bad({ quantity: 1.234 }), 'quantity', 'invalid');
  expectValidation(await bad({ quantity: 'abc' }), 'quantity', 'invalid');
  expectValidation(await bad({ quantity: undefined }), 'quantity', 'required');
  expectValidation(await bad({ reason: undefined }), 'reason', 'required');
  expectValidation(await bad({ productId: undefined }), 'productId', 'required');
  expectValidation(await bad({ note: 'x'.repeat(301) }), 'note', 'too_long');
  expectValidation(await adjust(tokens.admin, ok), 'branchId', 'required'); // Admin must send branchId
});

test('unknown and inactive branches and products are rejected', async () => {
  const ok = { productId: ids.pMain, quantity: -1, reason: 'RECOUNT' };

  expectError(await adjust(tokens.managerA, { ...ok, productId: 999999999 }), 404, 'NOT_FOUND');
  expectValidation(await adjust(tokens.managerA, { ...ok, productId: ids.pInactive }), 'productId', 'inactive');

  expectError(await adjust(tokens.admin, { ...ok, branchId: 999999999 }), 404, 'NOT_FOUND');
  expectValidation(await adjust(tokens.admin, { ...ok, branchId: ids.C }), 'branchId', 'inactive');
});

test('a negative adjustment larger than the stock is 422, and nothing is saved', async () => {
  const adjustments = () => prisma.adjustment.count({ where: { productId: ids.pShort } });
  const movements = () => prisma.stockMovement.count({ where: { productId: ids.pShort, type: 'ADJUSTMENT' } });

  const res = await adjust(tokens.managerA, { productId: ids.pShort, quantity: -5, reason: 'LOSS' });
  expectError(res, 422, 'INSUFFICIENT_STOCK');
  expect(res.body.error.message).toBe('Not enough stock for 1 item.');
  expect(res.body.error.details).toEqual([{ field: 'quantity', productId: ids.pShort, available: 3, requested: 5 }]);
  expect(await adjustments()).toBe(0);
  expect(await movements()).toBe(0);
  expect(await stockOf(ids.pShort, ids.A)).toBe(3);

  // Taking exactly what is there works; the next unit is 422
  const exact = await adjust(tokens.managerA, { productId: ids.pShort, quantity: -3, reason: 'EXPIRY' });
  expect(exact.status).toBe(201);
  expect(await stockOf(ids.pShort, ids.A)).toBe(0);

  const empty = await adjust(tokens.managerA, { productId: ids.pShort, quantity: -0.01, reason: 'LOSS' });
  expectError(empty, 422, 'INSUFFICIENT_STOCK');
  expect(empty.body.error.details).toEqual([{ field: 'quantity', productId: ids.pShort, available: 0, requested: 0.01 }]);
  expect(await adjustments()).toBe(1);
});

test('two simultaneous removals of the last unit: one succeeds, one is 422', async () => {
  const body = { productId: ids.pRace, quantity: -1, reason: 'DAMAGE' };
  const results = await Promise.all([adjust(tokens.managerA, body), adjust(tokens.staffA, body)]);
  expect(results.map((r) => r.status).sort((x, y) => x - y)).toEqual([201, 422]);

  const failed = results.find((r) => r.status === 422);
  expect(failed.body.error.code).toBe('INSUFFICIENT_STOCK');
  expect(failed.body.error.details).toEqual([{ field: 'quantity', productId: ids.pRace, available: 0, requested: 1 }]);
  expect(await stockOf(ids.pRace, ids.A)).toBe(0);
  expect(await prisma.adjustment.count({ where: { productId: ids.pRace } })).toBe(1);
});

test('Manager and Staff adjust only their own branch; Admin chooses the branch', async () => {
  const ok = { productId: ids.pInB, quantity: -1, reason: 'DAMAGE' };

  // The branch is checked before the body, so a bad body for another branch is still 403
  expectError(await adjust(tokens.managerA, { branchId: ids.B, productId: ids.pInB }), 403, 'FORBIDDEN');
  expectError(await adjust(tokens.managerA, { ...ok, branchId: ids.B }), 403, 'FORBIDDEN');
  expectError(await adjust(tokens.staffA, { ...ok, branchId: ids.B }), 403, 'FORBIDDEN');
  expect(await stockOf(ids.pInB, ids.B)).toBe(10);

  const own = await adjust(tokens.managerB, ok); // branchId left out: their own
  expect(own.status).toBe(201);
  expect(own.body.branchId).toBe(ids.B);
  expect(await stockOf(ids.pInB, ids.B)).toBe(9);

  const admin = await adjust(tokens.admin, { ...ok, branchId: ids.B });
  expect(admin.status).toBe(201);
  expect(admin.body).toMatchObject({ branchId: ids.B, branchName: `${prefix} Branch B`, createdBy: { name: 'System Admin' } });
  expect(await stockOf(ids.pInB, ids.B)).toBe(8);
});

test('GET /api/adjustments: scope per role, newest first, filters, and validation', async () => {
  const countA = await prisma.adjustment.count({ where: { branchId: ids.A } });
  const countB = await prisma.adjustment.count({ where: { branchId: ids.B } });
  expect(countA).toBeGreaterThan(5);
  expect(countB).toBeGreaterThan(1);

  // Manager and Staff see their own branch; another branch is 403
  for (const label of ['managerA', 'staffA']) {
    const res = await get(tokens[label], `${URL}?limit=100`);
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(countA);
    expect(res.body.page).toBe(1);
    expect(res.body.limit).toBe(100);
    res.body.data.forEach((row) => expect(row.branchId).toBe(ids.A));
    expectError(await get(tokens[label], `${URL}?branchId=${ids.B}`), 403, 'FORBIDDEN');
  }
  expect((await get(tokens.managerB, `${URL}?limit=100`)).body.total).toBe(countB);

  // Admin and Auditor see every branch, or one with ?branchId=
  for (const label of ['admin', 'auditor']) {
    expect((await get(tokens[label], `${URL}?branchId=${ids.A}&limit=100`)).body.total).toBe(countA);
    expect((await get(tokens[label], `${URL}?branchId=${ids.B}&limit=100`)).body.total).toBe(countB);
    const all = await get(tokens[label], `${URL}?limit=100`);
    expect(all.body.total).toBeGreaterThanOrEqual(countA + countB);
  }

  // Newest first, and the object has no raw user id
  const list = await get(tokens.admin, `${URL}?branchId=${ids.A}&limit=100`);
  const times = list.body.data.map((row) => Date.parse(row.createdAt));
  expect(times).toEqual([...times].sort((x, y) => y - x));
  expect(list.body.data[0]).toMatchObject({ branchName: `${prefix} Branch A` });
  expect(list.body.data[0]).not.toHaveProperty('userId');

  // Filters: product, reason, Ethiopia-time dates
  const mainCount = await prisma.adjustment.count({ where: { branchId: ids.A, productId: ids.pMain } });
  const byProduct = await get(tokens.admin, `${URL}?branchId=${ids.A}&productId=${ids.pMain}&limit=100`);
  expect(byProduct.body.total).toBe(mainCount);
  byProduct.body.data.forEach((row) => expect(row.productId).toBe(ids.pMain));

  const damageCount = await prisma.adjustment.count({ where: { branchId: ids.A, reason: 'DAMAGE' } });
  const byReason = await get(tokens.admin, `${URL}?branchId=${ids.A}&reason=DAMAGE&limit=100`);
  expect(byReason.body.total).toBe(damageCount);
  byReason.body.data.forEach((row) => expect(row.reason).toBe('DAMAGE'));

  const today = ethiopiaDate();
  expect((await get(tokens.admin, `${URL}?branchId=${ids.A}&from=${today}&to=${today}&limit=100`)).body.total).toBe(countA);
  expect((await get(tokens.admin, `${URL}?branchId=${ids.A}&from=${ethiopiaDate(24)}`)).body.total).toBe(0);

  expectValidation(await get(tokens.admin, `${URL}?reason=NOPE`), 'reason', 'invalid');
  expectValidation(await get(tokens.admin, `${URL}?reason=OPENING_STOCK`), 'reason', 'invalid');
  expectValidation(await get(tokens.admin, `${URL}?productId=abc`), 'productId', 'invalid');
  expectValidation(await get(tokens.admin, `${URL}?branchId=abc`), 'branchId', 'invalid');
  expectValidation(await get(tokens.admin, `${URL}?from=abc`), 'from', 'invalid');
  expectValidation(await get(tokens.admin, `${URL}?limit=101`), 'limit', 'max');
});