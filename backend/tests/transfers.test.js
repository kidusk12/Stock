// Follows docs/api-contract.md v5, section 6.9. Creates its own branches, products, stock and users and
// deletes them at the end. Needs the seeded admin (npm run seed).
require('dotenv').config();
const request = require('supertest');
const bcrypt = require('bcryptjs');
const app = require('../src/app');
const prisma = require('../src/config/db');
const { applyMovement } = require('../src/services/stockService');

jest.setTimeout(120000);

const stamp = Date.now();
const prefix = `Transfers Test ${stamp}`;
const T = '/api/transfers';
const ids = {};
const tokens = {};
const userIds = [];
const productIds = [];
const transferIds = [];

const bearer = (token) => ({ Authorization: `Bearer ${token}` });
const get = (token, path) => request(app).get(path).set(bearer(token));
const post = (token, path, body) => request(app).post(path).set(bearer(token)).send(body);
const login = (username, password) => request(app).post('/api/auth/login').send({ username, password });
const line = (productId, quantity) => ({ productId, quantity });

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

// Posts a transfer request and remembers its id, so the cleanup can delete it
async function makeTransfer(token, body) {
  const res = await post(token, T, body);
  if (res.status === 201) transferIds.push(res.body.id);
  return res;
}

// Manager of B (the destination) asks for stock from A (the source)
const fromAtoB = (items, extra = {}) =>
  makeTransfer(tokens.managerB, { fromBranchId: ids.A, toBranchId: ids.B, items, ...extra });

const act = (token, id, action, body = {}) => post(token, `${T}/${id}/${action}`, body);

async function approvedTransfer(items) {
  const created = await fromAtoB(items);
  expect(created.status).toBe(201);
  const approved = await act(tokens.managerA, created.body.id, 'approve');
  expect(approved.status).toBe(200);
  return created.body;
}

const stockOf = async (productId, branchId) =>
  (await prisma.stockMovement.findFirst({ where: { productId, branchId }, select: { id: true } }))
    ? (await prisma.branchStock.findUnique({ where: { productId_branchId: { productId, branchId } } })).quantity.toNumber()
    : 0;
const involving = (branchId) =>
  prisma.transfer.count({ where: { OR: [{ fromBranchId: branchId }, { toBranchId: branchId }] } });

async function createUser(label, role, branchId) {
  const user = await prisma.user.create({
    data: {
      username: `test-transfers-${label}-${stamp}`,
      passwordHash: await bcrypt.hash('Test12345', 10),
      fullName: `Transfers Test ${label}`,
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
      sku: `TRT-${stamp}-${label}`,
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
    (await prisma.branch.create({ data: { name: `${prefix} Branch ${letter}`, code: `TR${letter}${stamp}`, ...extra } })).id;
  ids.A = await branch('A'); // the source in most tests
  ids.B = await branch('B'); // the destination in most tests
  ids.C = await branch('C', { isActive: false });
  ids.D = await branch('D'); // an unrelated branch

  await createUser('managerA', 'BRANCH_MANAGER', ids.A);
  await createUser('staffA', 'STAFF', ids.A);
  await createUser('managerB', 'BRANCH_MANAGER', ids.B);
  await createUser('staffB', 'STAFF', ids.B);
  await createUser('managerD', 'BRANCH_MANAGER', ids.D);
  await createUser('auditor', 'AUDITOR', null);
  tokens.admin = (await login('admin', 'Admin123!')).body.token;

  for (const label of ['Flow', 'List', 'ShortA', 'ShortB', 'Race', 'Notify']) await createProduct(label);
  await createProduct('Inactive', { isActive: false });

  // Quantities go through the stock service, so the movement history is real
  const load = (productId, branchId, quantity) =>
    applyMovement({ productId, branchId, quantity, type: 'OPENING_STOCK', userId: ids.managerAId });
  await load(ids.pFlow, ids.A, 10);
  await load(ids.pFlow, ids.B, 2);
  await load(ids.pList, ids.A, 100);
  await load(ids.pShortA, ids.A, 1);
  await load(ids.pShortB, ids.A, 2);
  await load(ids.pRace, ids.A, 1);
  await load(ids.pNotify, ids.A, 5);
  await prisma.branchStock.update({
    where: { productId_branchId: { productId: ids.pNotify, branchId: ids.A } },
    data: { minQty: 3 },
  });
});

afterAll(async () => {
  await prisma.auditLog.deleteMany({
    where: { OR: [{ entityType: 'TRANSFER', entityId: { in: transferIds } }, { userId: { in: userIds } }] },
  });
  await prisma.transferItem.deleteMany({ where: { transferId: { in: transferIds } } });
  await prisma.transfer.deleteMany({ where: { id: { in: transferIds } } });
  await prisma.notification.deleteMany({ where: { productId: { in: productIds } } });
  await prisma.stockMovement.deleteMany({ where: { productId: { in: productIds } } });
  await prisma.branchStock.deleteMany({ where: { productId: { in: productIds } } });
  await prisma.product.deleteMany({ where: { id: { in: productIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.branch.deleteMany({ where: { id: { in: [ids.A, ids.B, ids.C, ids.D] } } });
  await prisma.$disconnect();
});

test('an anonymous user is blocked; the Auditor reads every transfer but can never write', async () => {
  expect((await request(app).get(T)).status).toBe(401);

  // The Auditor reads the list (all branches) and any single transfer, read-only (N2)
  const t = (await fromAtoB([line(ids.pList, 1)])).body;
  const list = await get(tokens.auditor, `${T}?limit=100`);
  expect(list.status).toBe(200);
  expect(list.body.total).toBe(await prisma.transfer.count());
  expect(list.body.data.some((row) => row.id === t.id)).toBe(true);
  const one = await get(tokens.auditor, `${T}/${t.id}`);
  expect(one.status).toBe(200);
  expect(one.body.id).toBe(t.id);

  // Every write is 403 for the Auditor
  const body = { fromBranchId: ids.A, toBranchId: ids.B, items: [line(ids.pList, 1)] };
  expectError(await post(tokens.auditor, T, body), 403, 'FORBIDDEN');
  for (const action of ['approve', 'reject', 'ship', 'receive']) {
    expectError(await act(tokens.auditor, t.id, action), 403, 'FORBIDDEN');
  }
  expect((await get(tokens.admin, `${T}/${t.id}`)).body.status).toBe('REQUESTED'); // nothing changed
});

test('a request returns the contract object, checks no stock, and writes a TRANSFER_REQUESTED audit entry', async () => {
  const res = await fromAtoB([line(ids.pFlow, 999)], { note: '  Urgent  ' }); // far more than A has: no check now
  expect(res.status).toBe(201);
  expect(res.body).toMatchObject({
    transferNumber: `TRF-${String(res.body.id).padStart(6, '0')}`,
    fromBranchId: ids.A,
    fromBranchName: `${prefix} Branch A`,
    toBranchId: ids.B,
    toBranchName: `${prefix} Branch B`,
    status: 'REQUESTED',
    note: 'Urgent',
    requestedBy: { id: ids.managerBId, name: 'Transfers Test managerB' },
    approvedBy: null,
    approvedAt: null,
    rejectedBy: null,
    rejectedAt: null,
    rejectReason: null,
    shippedBy: null,
    shippedAt: null,
    receivedBy: null,
    receivedAt: null,
  });
  expect(res.body.requestedAt).toBeTruthy();
  expect(res.body.items).toEqual([{ productId: ids.pFlow, productName: `${prefix} Flow`, sku: `TRT-${stamp}-Flow`, quantity: 999 }]);

  expect(await stockOf(ids.pFlow, ids.A)).toBe(10);
  expect(await stockOf(ids.pFlow, ids.B)).toBe(2);
  expect(await prisma.stockMovement.count({ where: { referenceType: 'TRANSFER', referenceId: res.body.id } })).toBe(0);

  const audit = await prisma.auditLog.findMany({ where: { entityType: 'TRANSFER', entityId: res.body.id } });
  expect(audit).toHaveLength(1);
  expect(audit[0].action).toBe('TRANSFER_REQUESTED');
  expect(audit[0].userId).toBe(ids.managerBId);
  expect(audit[0].branchId).toBe(ids.B); // the requesting (destination) branch
  expect(audit[0].oldValue).toBeNull();
  expect(audit[0].newValue).toEqual({ fromBranchId: ids.A, toBranchId: ids.B, itemCount: 1 });
});

test('Manager and Staff can only request for their own destination branch; Admin may request for any', async () => {
  const items = [line(ids.pList, 1)];

  // The branch is checked before the body, so a bad body for another branch is still 403
  expectError(
    await makeTransfer(tokens.managerB, { fromBranchId: ids.B, toBranchId: ids.A, items: [] }),
    403,
    'FORBIDDEN'
  );
  expectError(await makeTransfer(tokens.managerA, { fromBranchId: ids.A, toBranchId: ids.B, items }), 403, 'FORBIDDEN');
  expectError(await makeTransfer(tokens.staffB, { fromBranchId: ids.B, toBranchId: ids.A, items }), 403, 'FORBIDDEN');

  const staff = await makeTransfer(tokens.staffA, { fromBranchId: ids.B, toBranchId: ids.A, items });
  expect(staff.status).toBe(201);
  expect(staff.body.requestedBy.id).toBe(ids.staffAId);

  const admin = await makeTransfer(tokens.admin, { fromBranchId: ids.B, toBranchId: ids.A, items });
  expect(admin.status).toBe(201);
});

test('validation gives the right field and rule', async () => {
  const items = [line(ids.pList, 1)];
  const base = { fromBranchId: ids.A, toBranchId: ids.B, items };
  const bad = (override) => makeTransfer(tokens.managerB, { ...base, ...override });

  expectValidation(await bad({ fromBranchId: undefined }), 'fromBranchId', 'required');
  expectValidation(await bad({ items: [] }), 'items', 'min');
  expectValidation(await bad({ items: undefined }), 'items', 'required');
  expectValidation(await bad({ items: [{ quantity: 1 }] }), 'items[0].productId', 'required');
  expectValidation(await bad({ items: [line(ids.pList, 0)] }), 'items[0].quantity', 'min');
  expectValidation(await bad({ items: [line(ids.pList, 1.234)] }), 'items[0].quantity', 'invalid');
  expectValidation(await bad({ note: 'x'.repeat(301) }), 'note', 'too_long');
  expectValidation(await bad({ items: [line(ids.pList, 1), line(ids.pList, 2)] }), 'items[1].productId', 'duplicate');
  expectValidation(await bad({ fromBranchId: ids.B }), 'toBranchId', 'invalid'); // source and destination must differ
});

test('unknown and inactive branches and products are rejected', async () => {
  const items = [line(ids.pList, 1)];
  const asAdmin = (body) => makeTransfer(tokens.admin, { items, ...body });

  expectError(await asAdmin({ fromBranchId: 999999999, toBranchId: ids.B }), 404, 'NOT_FOUND');
  expectError(await asAdmin({ fromBranchId: ids.A, toBranchId: 999999999 }), 404, 'NOT_FOUND');
  expectValidation(await asAdmin({ fromBranchId: ids.C, toBranchId: ids.B }), 'fromBranchId', 'inactive');
  expectValidation(await asAdmin({ fromBranchId: ids.A, toBranchId: ids.C }), 'toBranchId', 'inactive');

  expectError(await fromAtoB([line(999999999, 1)]), 404, 'NOT_FOUND');
  expectValidation(await fromAtoB([line(ids.pInactive, 1)]), 'items[0].productId', 'inactive');
});

test('full workflow: request, approve, ship, receive, with stock, movements and audit entries at every step', async () => {
  const created = await fromAtoB([line(ids.pFlow, 4)]);
  expect(created.status).toBe(201);
  const id = created.body.id;

  const approved = await act(tokens.managerA, id, 'approve');
  expect(approved.status).toBe(200);
  expect(approved.body.status).toBe('APPROVED');
  expect(approved.body.approvedBy).toEqual({ id: ids.managerAId, name: 'Transfers Test managerA' });
  expect(approved.body.approvedAt).toBeTruthy();
  expect(approved.body.rejectedBy).toBeNull();
  expect(await stockOf(ids.pFlow, ids.A)).toBe(10); // approval changes no stock

  const shipped = await act(tokens.staffA, id, 'ship');
  expect(shipped.status).toBe(200);
  expect(shipped.body.status).toBe('SHIPPED');
  expect(shipped.body.shippedBy).toEqual({ id: ids.staffAId, name: 'Transfers Test staffA' });
  expect(shipped.body.shippedAt).toBeTruthy();
  expect(await stockOf(ids.pFlow, ids.A)).toBe(6); // left the source
  expect(await stockOf(ids.pFlow, ids.B)).toBe(2); // in transit: belongs to neither branch

  const received = await act(tokens.staffB, id, 'receive');
  expect(received.status).toBe(200);
  expect(received.body.status).toBe('RECEIVED');
  expect(received.body.receivedBy).toEqual({ id: ids.staffBId, name: 'Transfers Test staffB' });
  expect(received.body.receivedAt).toBeTruthy();
  expect(await stockOf(ids.pFlow, ids.A)).toBe(6);
  expect(await stockOf(ids.pFlow, ids.B)).toBe(6); // joined the destination

  const moves = await prisma.stockMovement.findMany({
    where: { referenceType: 'TRANSFER', referenceId: id },
    orderBy: { id: 'asc' },
  });
  expect(moves.map((m) => [m.type, m.branchId, m.quantityChange.toNumber()])).toEqual([
    ['TRANSFER_OUT', ids.A, -4],
    ['TRANSFER_IN', ids.B, 4],
  ]);
  expect(moves[0].userId).toBe(ids.staffAId);
  expect(moves[1].userId).toBe(ids.staffBId);

  const audit = await prisma.auditLog.findMany({ where: { entityType: 'TRANSFER', entityId: id }, orderBy: { id: 'asc' } });
  expect(audit.map((a) => [a.action, a.branchId])).toEqual([
    ['TRANSFER_REQUESTED', ids.B],
    ['TRANSFER_APPROVED', ids.A],
    ['TRANSFER_SHIPPED', ids.A],
    ['TRANSFER_RECEIVED', ids.B],
  ]);
  expect(audit[1].oldValue).toEqual({ status: 'REQUESTED' });
  expect(audit[1].newValue).toEqual({ status: 'APPROVED' });
  expect(audit[3].oldValue).toEqual({ status: 'SHIPPED' });
  expect(audit[3].newValue).toEqual({
    status: 'RECEIVED',
    items: [{ productId: ids.pFlow, shippedQuantity: 4, receivedQuantity: 4, discrepancyQuantity: 0 }],
  });
});

test('receiving per-item quantities adds only what arrived and records a visible discrepancy', async () => {
  const sourceBefore = await stockOf(ids.pFlow, ids.A);
  const destinationBefore = await stockOf(ids.pFlow, ids.B);
  const created = await fromAtoB([line(ids.pFlow, 4)]);
  const id = created.body.id;
  expect((await act(tokens.managerA, id, 'approve')).status).toBe(200);
  expect((await act(tokens.staffA, id, 'ship')).status).toBe(200);

  const received = await act(tokens.staffB, id, 'receive', { items: [{ productId: ids.pFlow, quantity: 3 }] });
  expect(received.status).toBe(200);
  expect(received.body.items).toEqual([
    expect.objectContaining({ productId: ids.pFlow, quantity: 4, receivedQuantity: 3, discrepancyQuantity: -1 }),
  ]);
  expect(await stockOf(ids.pFlow, ids.A)).toBe(sourceBefore - 4);
  expect(await stockOf(ids.pFlow, ids.B)).toBe(destinationBefore + 3);

  const movement = await prisma.stockMovement.findFirst({
    where: { referenceType: 'TRANSFER', referenceId: id, type: 'TRANSFER_IN' },
  });
  expect(movement.quantityChange.toNumber()).toBe(3);
  expect(movement.reason).toContain('Receipt discrepancy');
  const audit = await prisma.auditLog.findFirst({ where: { entityType: 'TRANSFER', entityId: id, action: 'TRANSFER_RECEIVED' } });
  expect(audit.newValue.items).toEqual([
    { productId: ids.pFlow, shippedQuantity: 4, receivedQuantity: 3, discrepancyQuantity: -1 },
  ]);
});

test('reject: reason rules, final status, no stock change, TRANSFER_REJECTED audit entry', async () => {
  const first = (await fromAtoB([line(ids.pList, 1)])).body;

  expectValidation(await act(tokens.managerA, first.id, 'reject', { reason: 'x'.repeat(301) }), 'reason', 'too_long');
  expect((await get(tokens.managerA, `${T}/${first.id}`)).body.status).toBe('REQUESTED');

  const rejected = await act(tokens.managerA, first.id, 'reject', { reason: '  Not enough stock  ' });
  expect(rejected.status).toBe(200);
  expect(rejected.body).toMatchObject({
    status: 'REJECTED',
    rejectReason: 'Not enough stock',
    rejectedBy: { id: ids.managerAId, name: 'Transfers Test managerA' },
    approvedBy: null,
    approvedAt: null,
    shippedBy: null,
    receivedBy: null,
  });
  expect(rejected.body.rejectedAt).toBeTruthy();
  expect(await prisma.stockMovement.count({ where: { referenceType: 'TRANSFER', referenceId: first.id } })).toBe(0);

  // REJECTED is final: every action is 409 (each one by the user of the right branch)
  expectError(await act(tokens.managerA, first.id, 'approve'), 409, 'INVALID_STATUS');
  expectError(await act(tokens.managerA, first.id, 'reject'), 409, 'INVALID_STATUS');
  expectError(await act(tokens.managerA, first.id, 'ship'), 409, 'INVALID_STATUS');
  expectError(await act(tokens.managerB, first.id, 'receive'), 409, 'INVALID_STATUS');

  const audit = await prisma.auditLog.findMany({
    where: { entityType: 'TRANSFER', entityId: first.id, action: 'TRANSFER_REJECTED' },
  });
  expect(audit).toHaveLength(1);
  expect(audit[0].branchId).toBe(ids.A);
  expect(audit[0].oldValue).toEqual({ status: 'REQUESTED' });
  expect(audit[0].newValue).toEqual({ status: 'REJECTED', reason: 'Not enough stock' });

  // The reason is optional
  const second = (await fromAtoB([line(ids.pList, 1)])).body;
  const noReason = await act(tokens.managerA, second.id, 'reject');
  expect(noReason.status).toBe(200);
  expect(noReason.body.rejectReason).toBeNull();
});

test('roles and branches on every action; Admin may act for either branch', async () => {
  const t = (await fromAtoB([line(ids.pList, 1)])).body;

  // Approve and reject: Admin or Manager of the SOURCE branch. Staff cannot.
  expectError(await act(tokens.staffA, t.id, 'approve'), 403, 'FORBIDDEN');
  expectError(await act(tokens.staffA, t.id, 'reject'), 403, 'FORBIDDEN');
  expectError(await act(tokens.managerB, t.id, 'approve'), 403, 'FORBIDDEN'); // destination Manager, wrong branch
  expectError(await act(tokens.managerB, t.id, 'reject'), 403, 'FORBIDDEN');
  expectError(await act(tokens.managerD, t.id, 'approve'), 403, 'FORBIDDEN');
  expect((await act(tokens.managerA, t.id, 'approve')).status).toBe(200);

  // Ship: the SOURCE branch (Staff too). The destination and other branches get 403.
  expectError(await act(tokens.staffB, t.id, 'ship'), 403, 'FORBIDDEN');
  expectError(await act(tokens.managerB, t.id, 'ship'), 403, 'FORBIDDEN');
  expectError(await act(tokens.managerD, t.id, 'ship'), 403, 'FORBIDDEN');
  expect((await act(tokens.staffA, t.id, 'ship')).status).toBe(200);

  // Receive: the DESTINATION branch. The source and other branches get 403 (even with the right status).
  expectError(await act(tokens.managerA, t.id, 'receive'), 403, 'FORBIDDEN');
  expectError(await act(tokens.staffA, t.id, 'receive'), 403, 'FORBIDDEN');
  expectError(await act(tokens.managerD, t.id, 'receive'), 403, 'FORBIDDEN');
  expect((await act(tokens.managerB, t.id, 'receive')).status).toBe(200);

  // Admin acts for either branch
  const t2 = (await fromAtoB([line(ids.pList, 1)])).body;
  expect((await act(tokens.admin, t2.id, 'approve')).status).toBe(200);
  expect((await act(tokens.admin, t2.id, 'ship')).status).toBe(200);
  expect((await act(tokens.admin, t2.id, 'receive')).status).toBe(200);

  expectError(await act(tokens.managerA, 999999999, 'approve'), 404, 'NOT_FOUND');
  expectError(await act(tokens.managerA, 'abc', 'ship'), 404, 'NOT_FOUND');
});

test('every action on the wrong status is 409 INVALID_STATUS', async () => {
  const t = (await fromAtoB([line(ids.pList, 1)])).body;

  expectError(await act(tokens.managerA, t.id, 'ship'), 409, 'INVALID_STATUS'); // REQUESTED: not approved yet
  expectError(await act(tokens.managerB, t.id, 'receive'), 409, 'INVALID_STATUS');

  expect((await act(tokens.managerA, t.id, 'approve')).status).toBe(200);
  expectError(await act(tokens.managerA, t.id, 'approve'), 409, 'INVALID_STATUS');
  expectError(await act(tokens.managerA, t.id, 'reject'), 409, 'INVALID_STATUS');
  expectError(await act(tokens.managerB, t.id, 'receive'), 409, 'INVALID_STATUS'); // APPROVED: not shipped yet

  expect((await act(tokens.managerA, t.id, 'ship')).status).toBe(200);
  expectError(await act(tokens.managerA, t.id, 'ship'), 409, 'INVALID_STATUS');
  expectError(await act(tokens.managerA, t.id, 'approve'), 409, 'INVALID_STATUS');

  expect((await act(tokens.managerB, t.id, 'receive')).status).toBe(200);
  expectError(await act(tokens.managerB, t.id, 'receive'), 409, 'INVALID_STATUS'); // RECEIVED is final
});

test('shipping with short stock is 422 with one detail per short item, and nothing changes', async () => {
  const t = await approvedTransfer([line(ids.pShortA, 5), line(ids.pShortB, 3)]);

  const res = await act(tokens.managerA, t.id, 'ship');
  expectError(res, 422, 'INSUFFICIENT_STOCK');
  expect(res.body.error.message).toBe('Not enough stock for 2 items.');
  expect(res.body.error.details).toEqual([
    { field: 'items[0].quantity', productId: ids.pShortA, available: 1, requested: 5 },
    { field: 'items[1].quantity', productId: ids.pShortB, available: 2, requested: 3 },
  ]);
  expect((await get(tokens.managerA, `${T}/${t.id}`)).body.status).toBe('APPROVED');
  expect(await stockOf(ids.pShortA, ids.A)).toBe(1);
  expect(await stockOf(ids.pShortB, ids.A)).toBe(2);
  expect(await prisma.stockMovement.count({ where: { referenceType: 'TRANSFER', referenceId: t.id } })).toBe(0);

  // Only the short item is reported; the item with enough stock is not
  const listBefore = await stockOf(ids.pList, ids.A);
  const mixed = await approvedTransfer([line(ids.pList, 1), line(ids.pShortA, 5)]);
  const mixedRes = await act(tokens.managerA, mixed.id, 'ship');
  expectError(mixedRes, 422, 'INSUFFICIENT_STOCK');
  expect(mixedRes.body.error.message).toBe('Not enough stock for 1 item.');
  expect(mixedRes.body.error.details).toEqual([
    { field: 'items[1].quantity', productId: ids.pShortA, available: 1, requested: 5 },
  ]);
  expect(await stockOf(ids.pList, ids.A)).toBe(listBefore);
});

test('two simultaneous shipments of the last unit: one succeeds, one is 422', async () => {
  const first = await approvedTransfer([line(ids.pRace, 1)]);
  const second = await approvedTransfer([line(ids.pRace, 1)]);

  const results = await Promise.all([
    act(tokens.managerA, first.id, 'ship'),
    act(tokens.staffA, second.id, 'ship'),
  ]);
  expect(results.map((r) => r.status).sort((x, y) => x - y)).toEqual([200, 422]);

  const failed = results.find((r) => r.status === 422);
  expect(failed.body.error.code).toBe('INSUFFICIENT_STOCK');
  expect(failed.body.error.details).toEqual([
    { field: 'items[0].quantity', productId: ids.pRace, available: 0, requested: 1 },
  ]);
  expect(await stockOf(ids.pRace, ids.A)).toBe(0);
  expect(await prisma.stockMovement.count({ where: { productId: ids.pRace, type: 'TRANSFER_OUT' } })).toBe(1);
});

test('shipping creates a low-stock notification for the source branch', async () => {
  const t = await approvedTransfer([line(ids.pNotify, 3)]); // 5 down to 2, at or below the minimum of 3
  expect((await act(tokens.managerA, t.id, 'ship')).status).toBe(200);

  const notifications = await prisma.notification.findMany({ where: { productId: ids.pNotify } });
  expect(notifications).toHaveLength(1);
  expect(notifications[0].type).toBe('LOW_STOCK');
  expect(notifications[0].branchId).toBe(ids.A);
  expect(notifications[0].quantity.toNumber()).toBe(2);
  expect(notifications[0].minQty.toNumber()).toBe(3);
});

test('GET /api/transfers: branch scope, itemCount instead of items, newest first, direction and filters', async () => {
  const total = await involving(ids.A);
  expect(total).toBeGreaterThan(5);

  // Manager and Staff see transfers where their branch is the source or the destination
  const manager = await get(tokens.managerA, `${T}?limit=100`);
  expect(manager.status).toBe(200);
  expect(manager.body.total).toBe(total);
  expect(manager.body.page).toBe(1);
  expect(manager.body.limit).toBe(100);
  manager.body.data.forEach((row) => {
    expect(row).not.toHaveProperty('items');
    expect(row.itemCount).toBeGreaterThan(0);
    expect([row.fromBranchId, row.toBranchId]).toContain(ids.A);
  });
  const times = manager.body.data.map((row) => Date.parse(row.requestedAt));
  expect(times).toEqual([...times].sort((x, y) => y - x));

  expect((await get(tokens.staffB, `${T}?limit=100`)).body.total).toBe(await involving(ids.B));
  expect((await get(tokens.managerD, T)).body.total).toBe(0);
  expectError(await get(tokens.managerA, `${T}?branchId=${ids.B}`), 403, 'FORBIDDEN');

  // Admin: all branches, or one branch with ?branchId=
  const admin = await get(tokens.admin, `${T}?branchId=${ids.A}&limit=100`);
  expect(admin.body.total).toBe(total);

  // direction is relative to a branch
  const outgoing = await prisma.transfer.count({ where: { fromBranchId: ids.A } });
  const incoming = await prisma.transfer.count({ where: { toBranchId: ids.A } });
  const out = await get(tokens.managerA, `${T}?direction=outgoing&limit=100`);
  expect(out.body.total).toBe(outgoing);
  out.body.data.forEach((row) => expect(row.fromBranchId).toBe(ids.A));
  const inc = await get(tokens.admin, `${T}?branchId=${ids.A}&direction=incoming&limit=100`);
  expect(inc.body.total).toBe(incoming);
  inc.body.data.forEach((row) => expect(row.toBranchId).toBe(ids.A));
    // Admin or Auditor with only ?direction=: it is ignored and every transfer is returned (no error)
  const everything = await prisma.transfer.count();
  for (const label of ['admin', 'auditor']) {
    const onlyDirection = await get(tokens[label], `${T}?direction=incoming&limit=100`);
    expect(onlyDirection.status).toBe(200);
    expect(onlyDirection.body.total).toBe(everything);
  }
  // Admin or Auditor with direction and branchId: the direction applies to that branch
  const auditorOut = await get(tokens.auditor, `${T}?branchId=${ids.A}&direction=outgoing&limit=100`);
  expect(auditorOut.body.total).toBe(outgoing);
  expectValidation(await get(tokens.admin, `${T}?direction=sideways`), 'direction', 'invalid');

  // status, dates, pagination
  const rejectedCount = await prisma.transfer.count({
    where: { status: 'REJECTED', OR: [{ fromBranchId: ids.A }, { toBranchId: ids.A }] },
  });
  expect(rejectedCount).toBeGreaterThan(0);
  const rejected = await get(tokens.admin, `${T}?branchId=${ids.A}&status=REJECTED&limit=100`);
  expect(rejected.body.total).toBe(rejectedCount);
  rejected.body.data.forEach((row) => expect(row.status).toBe('REJECTED'));
  expectValidation(await get(tokens.admin, `${T}?status=NOPE`), 'status', 'invalid');

  const today = ethiopiaDate();
  expect((await get(tokens.admin, `${T}?branchId=${ids.A}&from=${today}&to=${today}&limit=100`)).body.total).toBe(total);
  expect((await get(tokens.admin, `${T}?branchId=${ids.A}&from=${ethiopiaDate(24)}`)).body.total).toBe(0);
  expectValidation(await get(tokens.admin, `${T}?from=abc`), 'from', 'invalid');
  expectValidation(await get(tokens.admin, `${T}?limit=101`), 'limit', 'max');
});

test('GET /api/transfers/:id returns the transfer with items; only the two branches and Admin may read it', async () => {
  const t = (await fromAtoB([line(ids.pList, 2)])).body;
  const url = `${T}/${t.id}`;

  for (const label of ['managerA', 'staffA', 'managerB', 'staffB', 'admin']) {
    const res = await get(tokens[label], url);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(t.id);
    expect(res.body.status).toBe('REQUESTED');
    expect(res.body.items).toEqual([{ productId: ids.pList, productName: `${prefix} List`, sku: `TRT-${stamp}-List`, quantity: 2 }]);
  }

  expectError(await get(tokens.managerD, url), 403, 'FORBIDDEN');
  expectError(await get(tokens.admin, `${T}/999999999`), 404, 'NOT_FOUND');
  expectError(await get(tokens.admin, `${T}/abc`), 404, 'NOT_FOUND');
});
