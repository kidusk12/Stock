require('dotenv').config();
const request = require('supertest');
const bcrypt = require('bcryptjs');
const app = require('../src/app');
const prisma = require('../src/config/db');

jest.setTimeout(120000);
const stamp = Date.now();
const prefix = `Audit Logs ${stamp}`;
const URL = '/api/audit-logs';
const ids = {};
const tokens = {};
const userIds = [];
const productIds = [];
const saleIds = [];
const auditIds = [];

const bearer = (token) => ({ Authorization: `Bearer ${token}` });
const get = (token, path = URL) => request(app).get(path).set(bearer(token));

async function createUser(label, role, branchId) {
  const user = await prisma.user.create({ data: {
    username: `test-auditlogs-${label}-${stamp}`,
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

async function createLog({ userId, branchId, action, entityType, entityId, createdAt = new Date() }) {
  const row = await prisma.auditLog.create({ data: { userId, branchId, action, entityType, entityId, createdAt, newValue: { test: true } } });
  auditIds.push(row.id);
  return row;
}

beforeAll(async () => {
  ids.branchA = (await prisma.branch.create({ data: { name: `${prefix} A`, code: `ALA${stamp}` } })).id;
  ids.branchB = (await prisma.branch.create({ data: { name: `${prefix} B`, code: `ALB${stamp}` } })).id;
  await createUser('managerA', 'BRANCH_MANAGER', ids.branchA);
  await createUser('managerB', 'BRANCH_MANAGER', ids.branchB);
  await createUser('admin', 'ADMIN', null);
  await createUser('auditor', 'AUDITOR', null);
  await createUser('staff', 'STAFF', ids.branchA);

  const product = await prisma.product.create({ data: {
    name: `${prefix} Product`, sku: `AL-${stamp}`, unit: 'piece', costPrice: 5, sellingPrice: 10,
  } });
  productIds.push(product.id);

  const sale = await prisma.sale.create({ data: {
    invoiceNumber: `AL-${stamp}`, branchId: ids.branchA, createdById: ids.managerA,
    subtotal: 10, taxType: 'VAT', taxRate: 0.15, taxAmount: 0, total: 10,
    items: { create: [{ productId: product.id, quantity: 1, unitPrice: 10, lineTotal: 10 }] },
  } });
  saleIds.push(sale.id);

  ids.productId = product.id;
  ids.saleId = sale.id;
  ids.oldLogId = (await createLog({ userId: ids.managerA, branchId: ids.branchA, action: 'SALE_CREATED', entityType: 'SALE', entityId: sale.id, createdAt: new Date('2026-10-20T21:00:00.000Z') })).id;
  ids.productLogId = (await createLog({ userId: ids.managerA, branchId: ids.branchA, action: 'PRODUCT_UPDATED', entityType: 'PRODUCT', entityId: product.id })).id;
  ids.otherBranchLogId = (await createLog({ userId: ids.managerB, branchId: ids.branchB, action: 'USER_CREATED', entityType: 'USER', entityId: ids.managerB })).id;
});

afterAll(async () => {
  await prisma.auditLog.deleteMany({ where: { OR: [{ id: { in: auditIds } }, { userId: { in: userIds } }] } });
  await prisma.saleItem.deleteMany({ where: { saleId: { in: saleIds } } });
  await prisma.sale.deleteMany({ where: { id: { in: saleIds } } });
  await prisma.product.deleteMany({ where: { id: { in: productIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.branch.deleteMany({ where: { id: { in: [ids.branchA, ids.branchB] } } });
  await prisma.$disconnect();
});

test('lists audit entries with user and branch details, newest first, paginated', async () => {
  const res = await get(tokens.admin, `${URL}?limit=2`);
  expect(res.status).toBe(200);
  expect(res.body).toMatchObject({ page: 1, limit: 2, total: expect.any(Number) });
  expect(res.body.data).toHaveLength(2);
  expect(res.body.data[0]).toMatchObject({ id: expect.any(Number), createdBy: { id: expect.any(Number), name: expect.any(String) }, branchName: expect.any(String) });
  expect(res.body.data[0].createdAt >= res.body.data[1].createdAt).toBe(true);
});

test('supports user, entity type/id, action and Ethiopia-day date filters', async () => {
  const date = '2026-10-21';
  const res = await get(tokens.admin, `${URL}?userId=${ids.managerA}&entityType=SALE&entityId=${ids.saleId}&action=SALE_CREATED&from=${date}&to=${date}`);
  expect(res.status).toBe(200);
  expect(res.body.total).toBe(1);
  expect(res.body.data[0].id).toBe(ids.oldLogId);
  const empty = await get(tokens.admin, `${URL}?entityId=999999999`);
  expect(empty.status).toBe(200);
  expect(empty.body.total).toBe(0);
});

test('productId finds product audit entries and linked sale audit entries', async () => {
  const res = await get(tokens.admin, `${URL}?productId=${ids.productId}`);
  expect(res.status).toBe(200);
  expect(res.body.data.map((entry) => entry.id)).toEqual(expect.arrayContaining([ids.oldLogId, ids.productLogId]));
  expect(res.body.total).toBe(2);
});

test('Manager is limited to own branch and gets 403 when requesting a different branch', async () => {
  const own = await get(tokens.managerA);
  expect(own.status).toBe(200);
  expect(own.body.data.every((entry) => entry.branchId === ids.branchA)).toBe(true);
  const other = await get(tokens.managerA, `${URL}?branchId=${ids.branchB}`);
  expect(other.status).toBe(403);
  expect(other.body.error.code).toBe('FORBIDDEN');
});

test('Auditor can read all branches; Staff and anonymous users cannot read audit logs', async () => {
  const auditor = await get(tokens.auditor);
  expect(auditor.status).toBe(200);
  expect(auditor.body.data.some((entry) => entry.branchId === ids.branchB)).toBe(true);
  expect((await get(tokens.staff)).status).toBe(403);
  expect((await request(app).get(URL)).status).toBe(401);
});

test('rejects malformed filters and validates requested branch access before filtering', async () => {
  const badId = await get(tokens.admin, `${URL}?userId=nope`);
  expect(badId.status).toBe(400);
  expect(badId.body.error.code).toBe('VALIDATION_ERROR');
  const badAction = await get(tokens.admin, `${URL}?action=NO_SUCH_ACTION`);
  expect(badAction.status).toBe(400);
  expect(badAction.body.error.details[0].field).toBe('action');
  const wrongBranch = await get(tokens.managerA, `${URL}?branchId=${ids.branchB}&from=bad-date`);
  expect(wrongBranch.status).toBe(403);
});
