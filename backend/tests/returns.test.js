require('dotenv').config();
const request = require('supertest');
const bcrypt = require('bcryptjs');
const app = require('../src/app');
const prisma = require('../src/config/db');
const { applyMovement } = require('../src/services/stockService');

jest.setTimeout(120000);

const stamp = Date.now();
const prefix = `Returns Test ${stamp}`;
const ids = {};
const tokens = {};
const userIds = [];
const productIds = [];
const saleIds = [];
const returnIds = [];
let originalSettings;

const bearer = (token) => ({ Authorization: `Bearer ${token}` });
const get = (token, path) => request(app).get(path).set(bearer(token));
const post = (token, path, body) => request(app).post(path).set(bearer(token)).send(body);
const login = (username, password) => request(app).post('/api/auth/login').send({ username, password });

async function createUser(label, role, branchId) {
  const user = await prisma.user.create({
    data: {
      username: `test-return-${label}-${stamp}`,
      passwordHash: await bcrypt.hash('Test12345', 10),
      fullName: `Returns Test ${label}`,
      role,
      branchId,
    },
  });
  userIds.push(user.id);
  tokens[label] = (await login(user.username, 'Test12345')).body.token;
  return user;
}

async function createSale(body) {
  const result = await post(tokens.staff, '/api/sales', body);
  if (result.status === 201) saleIds.push(result.body.id);
  return result;
}

const stockOf = async (productId, branchId) =>
  (await prisma.branchStock.findUnique({ where: { productId_branchId: { productId, branchId } } })).quantity.toNumber();

function expectError(result, status, code) {
  expect(result.status).toBe(status);
  expect(result.body.error.code).toBe(code);
}

function expectValidation(result, field, rule) {
  expect(result.status).toBe(400);
  expect(result.body.error.code).toBe('VALIDATION_ERROR');
  expect(result.body.error.details[0]).toMatchObject({ field, rule });
}

beforeAll(async () => {
  originalSettings = await prisma.companySetting.findUnique({ where: { id: 1 } });
  await prisma.companySetting.update({ where: { id: 1 }, data: { taxType: 'VAT', taxRate: 0.15 } });
  const branchA = await prisma.branch.create({ data: { name: `${prefix} Branch A`, code: `RA${stamp}` } });
  const branchB = await prisma.branch.create({ data: { name: `${prefix} Branch B`, code: `RB${stamp}` } });
  ids.branchA = branchA.id;
  ids.branchB = branchB.id;

  ids.managerA = (await createUser('manager-a', 'BRANCH_MANAGER', ids.branchA)).id;
  tokens.managerA = tokens['manager-a'];
  tokens.manager = tokens['manager-a'];
  ids.staff = (await createUser('staff', 'STAFF', ids.branchA)).id;
  await createUser('manager-b', 'BRANCH_MANAGER', ids.branchB);
  tokens.managerB = tokens['manager-b'];
  await createUser('auditor', 'AUDITOR', null);
  tokens.admin = (await login('admin', 'Admin123!')).body.token;

  const product = await prisma.product.create({
    data: {
      name: `${prefix} Product`,
      sku: `RT-${stamp}`,
      unit: 'piece',
      costPrice: 5,
      sellingPrice: 10.25,
    },
  });
  ids.product = product.id;
  productIds.push(product.id);
  await applyMovement({ productId: ids.product, branchId: ids.branchA, quantity: 20, type: 'OPENING_STOCK', userId: ids.managerA });
  await applyMovement({ productId: ids.product, branchId: ids.branchB, quantity: 20, type: 'OPENING_STOCK', userId: ids.managerA });

  const sale = await createSale({ items: [{ productId: ids.product, quantity: 3 }] });
  expect(sale.status).toBe(201);
  ids.sale = sale.body.id;
  ids.saleItem = sale.body.items[0].id;
});

afterAll(async () => {
  await prisma.auditLog.deleteMany({ where: { OR: [{ entityType: 'RETURN', entityId: { in: returnIds } }, { userId: { in: userIds } }] } });
  await prisma.saleReturnItem.deleteMany({ where: { saleReturnId: { in: returnIds } } });
  await prisma.saleReturn.deleteMany({ where: { id: { in: returnIds } } });
  await prisma.saleItem.deleteMany({ where: { saleId: { in: saleIds } } });
  await prisma.sale.deleteMany({ where: { id: { in: saleIds } } });
  await prisma.notification.deleteMany({ where: { productId: { in: productIds } } });
  await prisma.stockMovement.deleteMany({ where: { productId: { in: productIds } } });
  await prisma.branchStock.deleteMany({ where: { productId: { in: productIds } } });
  await prisma.product.deleteMany({ where: { id: { in: productIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.branch.deleteMany({ where: { id: { in: [ids.branchA, ids.branchB].filter(Boolean) } } });
  if (originalSettings) {
    await prisma.companySetting.update({
      where: { id: 1 },
      data: { taxType: originalSettings.taxType, taxRate: originalSettings.taxRate, nextInvoiceNumber: originalSettings.nextInvoiceNumber },
    });
  }
  await prisma.$disconnect();
});

test('returns increase stock, update the sold quantity, calculate refund from the invoice price and audit atomically', async () => {
  const stockBefore = await stockOf(ids.product, ids.branchA);
  const result = await post(tokens.staff, `/api/sales/${ids.sale}/returns`, {
    items: [{ saleItemId: ids.saleItem, quantity: 2 }],
    reason: 'Damaged on delivery',
  });
  expect(result.status).toBe(201);
  returnIds.push(result.body.id);
  expect(result.body).toMatchObject({
    returnNumber: `RET-${String(result.body.id).padStart(6, '0')}`,
    saleId: ids.sale,
    invoiceNumber: expect.any(String),
    branchId: ids.branchA,
    branchName: `${prefix} Branch A`,
    reason: 'Damaged on delivery',
    refundAmount: 20.5,
    refundStatus: 'PENDING_REFUND',
    createdBy: { id: ids.staff, name: 'Returns Test staff' },
    refundedBy: null,
    items: [{ saleItemId: ids.saleItem, productName: `${prefix} Product`, quantity: 2, unitPrice: 10.25, lineTotal: 20.5 }],
  });
  expect(await stockOf(ids.product, ids.branchA)).toBe(stockBefore + 2);
  expect((await prisma.saleItem.findUnique({ where: { id: ids.saleItem } })).returnedQty.toNumber()).toBe(2);

  const movement = await prisma.stockMovement.findFirst({ where: { referenceType: 'RETURN', referenceId: result.body.id } });
  expect(movement).toMatchObject({ type: 'CUSTOMER_RETURN', reason: 'Damaged on delivery', userId: ids.staff, branchId: ids.branchA });
  expect(movement.quantityChange.toNumber()).toBe(2);
  const audit = await prisma.auditLog.findMany({ where: { entityType: 'RETURN', entityId: result.body.id } });
  expect(audit).toHaveLength(1);
  expect(audit[0]).toMatchObject({ action: 'RETURN_CREATED', userId: ids.staff, branchId: ids.branchA, oldValue: null });
  expect(audit[0].newValue).toMatchObject({ saleId: ids.sale, invoiceNumber: result.body.invoiceNumber, refundAmount: 20.5, refundStatus: 'PENDING_REFUND' });
});

test('rejects quantities above the remaining sold amount and validates the request', async () => {
  const beforeStock = await stockOf(ids.product, ids.branchA);
  const beforeCount = await prisma.saleReturn.count({ where: { saleId: ids.sale } });
  const tooMany = await post(tokens.staff, `/api/sales/${ids.sale}/returns`, { items: [{ saleItemId: ids.saleItem, quantity: 2 }] });
  expectError(tooMany, 422, 'RETURN_EXCEEDS_SOLD');
  expect(tooMany.body.error.details[0]).toMatchObject({ available: 1, requested: 2 });
  expect(await stockOf(ids.product, ids.branchA)).toBe(beforeStock);
  expect(await prisma.saleReturn.count({ where: { saleId: ids.sale } })).toBe(beforeCount);

  expectValidation(await post(tokens.staff, `/api/sales/${ids.sale}/returns`, { items: [] }), 'items', 'min');
  expectValidation(await post(tokens.staff, `/api/sales/${ids.sale}/returns`, { items: [{ saleItemId: ids.saleItem, quantity: 0 }] }), 'items[0].quantity', 'min');
  expectValidation(await post(tokens.staff, `/api/sales/${ids.sale}/returns`, { items: [{ saleItemId: ids.saleItem, quantity: 0.123 }] }), 'items[0].quantity', 'invalid');
  const duplicate = await post(tokens.staff, `/api/sales/${ids.sale}/returns`, { items: [{ saleItemId: ids.saleItem, quantity: 0.25 }, { saleItemId: ids.saleItem, quantity: 0.25 }] });
  expectValidation(duplicate, 'items[1].saleItemId', 'duplicate');
  expectError(await post(tokens.staff, '/api/sales/99999999/returns', { items: [{ saleItemId: ids.saleItem, quantity: 1 }] }), 404, 'NOT_FOUND');
});

test('refund marking is permission checked, audited, and cannot be repeated', async () => {
  const created = await post(tokens.managerA, `/api/sales/${ids.sale}/returns`, { items: [{ saleItemId: ids.saleItem, quantity: 1 }] });
  expect(created.status).toBe(201);
  returnIds.push(created.body.id);
  const movementCount = await prisma.stockMovement.count({ where: { referenceType: 'RETURN', referenceId: created.body.id } });

  const refunded = await request(app).patch(`/api/returns/${created.body.id}/refund`).set(bearer(tokens.staff)).send({});
  expect(refunded.status).toBe(200);
  expect(refunded.body).toMatchObject({ refundStatus: 'REFUNDED', refundedBy: { id: ids.staff, name: 'Returns Test staff' } });
  expect(refunded.body.refundedAt).toBeTruthy();
  expect(await prisma.stockMovement.count({ where: { referenceType: 'RETURN', referenceId: created.body.id } })).toBe(movementCount);
  const audit = await prisma.auditLog.findMany({ where: { entityType: 'RETURN', entityId: created.body.id } });
  expect(audit.map((row) => row.action).sort()).toEqual(['RETURN_CREATED', 'RETURN_REFUNDED']);
  expect(audit.find((row) => row.action === 'RETURN_REFUNDED')).toMatchObject({ userId: ids.staff, branchId: ids.branchA, oldValue: { refundStatus: 'PENDING_REFUND' }, newValue: { refundStatus: 'REFUNDED', refundAmount: 10.25 } });

  expectError(await request(app).patch(`/api/returns/${created.body.id}/refund`).set(bearer(tokens.manager)).send({}), 409, 'INVALID_STATUS');
  expectError(await request(app).patch(`/api/returns/${created.body.id}/refund`).set(bearer(tokens.managerB)).send({}), 403, 'FORBIDDEN');
  expectError(await request(app).patch('/api/returns/99999999/refund').set(bearer(tokens.staff)).send({}), 404, 'NOT_FOUND');
});

test('return reads enforce roles and branch scope and support contract filters and pagination', async () => {
  const own = await get(tokens.staff, `/api/returns?saleId=${ids.sale}&refundStatus=PENDING_REFUND&limit=100`);
  expect(own.status).toBe(200);
  expect(own.body).toMatchObject({ page: 1, limit: 100 });
  expect(own.body.data.length).toBeGreaterThan(0);
  own.body.data.forEach((record) => expect(record.branchId).toBe(ids.branchA));
  expect((await get(tokens.admin, `/api/returns?branchId=${ids.branchA}&saleId=${ids.sale}&refundStatus=PENDING_REFUND&limit=100`)).body.total).toBe(own.body.total);
  expectError(await get(tokens.manager, `/api/returns?branchId=${ids.branchB}`), 403, 'FORBIDDEN');
  expectError(await get(tokens.auditor, '/api/returns'), 403, 'FORBIDDEN');
  expect((await get(tokens.staff, `/api/returns/${own.body.data[0].id}`)).status).toBe(200);
  expectValidation(await get(tokens.admin, '/api/returns?refundStatus=UNKNOWN'), 'refundStatus', 'invalid');
  expectValidation(await get(tokens.admin, '/api/returns?limit=101'), 'limit', 'max');
});

test('Auditor writes are blocked and a wrong-branch manager is rejected before body validation', async () => {
  expectError(await post(tokens.auditor, `/api/sales/${ids.sale}/returns`, { items: [{ saleItemId: ids.saleItem, quantity: 1 }] }), 403, 'FORBIDDEN');
  const wrongBranch = await post(tokens.managerB, `/api/sales/${ids.sale}/returns`, {});
  expectError(wrongBranch, 403, 'FORBIDDEN');
  expectError(await post(tokens.staff, `/api/sales/${ids.sale}/returns`, { items: [{ saleItemId: 99999999, quantity: 1 }] }), 404, 'NOT_FOUND');
});

test('Admin can return an item from a selected sale', async () => {
  const sale = await createSale({ items: [{ productId: ids.product, quantity: 1 }] });
  expect(sale.status).toBe(201);
  const returned = await post(tokens.admin, `/api/sales/${sale.body.id}/returns`, {
    items: [{ saleItemId: sale.body.items[0].id, quantity: 1 }],
  });
  expect(returned.status).toBe(201);
  returnIds.push(returned.body.id);
  expect(returned.body).toMatchObject({ saleId: sale.body.id, branchId: ids.branchA, refundStatus: 'PENDING_REFUND' });
});
