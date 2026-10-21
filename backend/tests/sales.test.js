// Follows docs/api-contract.md v5, section 6.6. Creates its own branches, products, stock and users and
// deletes them at the end. Needs the seeded admin (npm run seed) and the company settings row.
// It changes the tax setting while it runs and restores the original tax and invoice counter afterwards.
require('dotenv').config();
const request = require('supertest');
const bcrypt = require('bcryptjs');
const app = require('../src/app');
const prisma = require('../src/config/db');
const { applyMovement } = require('../src/services/stockService');

jest.setTimeout(120000);

const stamp = Date.now();
const prefix = `Sales Test ${stamp}`;
const ids = {};
const tokens = {};
const userIds = [];
const productIds = [];
const saleIds = [];
let originalSettings;

const bearer = (token) => ({ Authorization: `Bearer ${token}` });
const get = (token, path) => request(app).get(path).set(bearer(token));
const login = (username, password) => request(app).post('/api/auth/login').send({ username, password });

// Posts a sale and remembers its id, so the cleanup can delete it
async function sell(token, body) {
  const res = await request(app).post('/api/sales').set(bearer(token)).send(body);
  if (res.status === 201) saleIds.push(res.body.id);
  return res;
}

const stockOf = async (productId, branchId) =>
  (await prisma.branchStock.findUnique({ where: { productId_branchId: { productId, branchId } } })).quantity.toNumber();
const counter = async () => (await prisma.companySetting.findUnique({ where: { id: 1 } })).nextInvoiceNumber;
const salesIn = (branchId) => prisma.sale.count({ where: { branchId } });
const invoiceNumber = (invoice) => Number(invoice.slice(4)); // "INV-000045" -> 45

// A 400 must be a VALIDATION_ERROR whose first detail has this field and rule (contract 1.4)
function expectValidation(res, field, rule) {
  expect(res.status).toBe(400);
  expect(res.body.error.code).toBe('VALIDATION_ERROR');
  expect(res.body.error.details[0].field).toBe(field);
  expect(res.body.error.details[0].rule).toBe(rule);
}

// "Ethiopia date" (UTC+3) as YYYY-MM-DD, moved by some hours
const ethiopiaDate = (offsetHours = 0) =>
  new Date(Date.now() + (3 + offsetHours) * 60 * 60 * 1000).toISOString().slice(0, 10);

async function createUser(label, role, branchId) {
  const user = await prisma.user.create({
    data: {
      username: `test-sales-${label}-${stamp}`,
      passwordHash: await bcrypt.hash('Test12345', 10),
      fullName: `Sales Test ${label}`,
      role,
      branchId,
    },
  });
  userIds.push(user.id);
  tokens[label] = (await login(user.username, 'Test12345')).body.token;
  return user;
}

async function createProduct(label, sellingPrice, extra = {}) {
  const product = await prisma.product.create({
    data: {
      name: `${prefix} ${label}`,
      sku: `SLT-${stamp}-${label}`,
      unit: 'piece',
      costPrice: 1,
      sellingPrice,
      ...extra,
    },
  });
  productIds.push(product.id);
  return product;
}

beforeAll(async () => {
  originalSettings = await prisma.companySetting.findUnique({ where: { id: 1 } });
  await prisma.companySetting.update({ where: { id: 1 }, data: { taxType: 'VAT', taxRate: 0.15 } });

  const a = await prisma.branch.create({ data: { name: `${prefix} Branch A`, code: `SLA${stamp}` } });
  const b = await prisma.branch.create({ data: { name: `${prefix} Branch B`, code: `SLB${stamp}` } });
  const c = await prisma.branch.create({ data: { name: `${prefix} Branch C`, code: `SLC${stamp}`, isActive: false } });
  ids.branchA = a.id;
  ids.branchB = b.id;
  ids.branchC = c.id;

  const manager = await createUser('manager', 'BRANCH_MANAGER', ids.branchA);
  const staff = await createUser('staff', 'STAFF', ids.branchA);
  await createUser('managerb', 'BRANCH_MANAGER', ids.branchB);
  await createUser('auditor', 'AUDITOR', null);
  ids.managerId = manager.id;
  ids.staffId = staff.id;
  tokens.admin = (await login('admin', 'Admin123!')).body.token;

  ids.p1 = (await createProduct('P1', 100)).id;
  ids.p2 = (await createProduct('P2', 25.5)).id;
  ids.pInactive = (await createProduct('Inactive', 10, { isActive: false })).id;
  ids.pA = (await createProduct('VAT1150', 1150)).id;
  ids.pB = (await createProduct('TOT1020', 1020)).id;
  ids.pLow1 = (await createProduct('Low1', 10)).id;
  ids.pLow2 = (await createProduct('Low2', 10)).id;
  ids.pRace = (await createProduct('Race', 10)).id;

  // Quantities go through the stock service, so the movement history is real
  const load = (productId, branchId, quantity) =>
    applyMovement({ productId, branchId, quantity, type: 'OPENING_STOCK', userId: manager.id });
  await load(ids.p1, ids.branchA, 50);
  await load(ids.p1, ids.branchB, 5);
  await load(ids.p2, ids.branchA, 50);
  await load(ids.pA, ids.branchA, 5);
  await load(ids.pB, ids.branchA, 5);
  await load(ids.pLow1, ids.branchA, 1);
  await load(ids.pLow2, ids.branchA, 2);
  await load(ids.pRace, ids.branchA, 1);
});

afterAll(async () => {
  await prisma.auditLog.deleteMany({
    where: { OR: [{ entityType: 'SALE', entityId: { in: saleIds } }, { userId: { in: userIds } }] },
  });
  await prisma.saleItem.deleteMany({ where: { saleId: { in: saleIds } } });
  await prisma.sale.deleteMany({ where: { id: { in: saleIds } } });
  await prisma.notification.deleteMany({ where: { productId: { in: productIds } } });
  await prisma.stockMovement.deleteMany({ where: { productId: { in: productIds } } });
  await prisma.branchStock.deleteMany({ where: { productId: { in: productIds } } });
  await prisma.product.deleteMany({ where: { id: { in: productIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.branch.deleteMany({ where: { id: { in: [ids.branchA, ids.branchB, ids.branchC] } } });
  if (originalSettings) {
    await prisma.companySetting.update({
      where: { id: 1 },
      data: {
        taxType: originalSettings.taxType,
        taxRate: originalSettings.taxRate,
        nextInvoiceNumber: originalSettings.nextInvoiceNumber,
      },
    });
  }
  await prisma.$disconnect();
});

test('anonymous users are blocked; Auditor can read but not write (T2)', async () => {
  const body = { items: [{ productId: ids.p1, quantity: 1 }] };

  // No token → 401 on every method
  expect((await request(app).post('/api/sales').send(body)).status).toBe(401);
  expect((await request(app).get('/api/sales')).status).toBe(401);
  expect((await request(app).get('/api/sales/1')).status).toBe(401);

  // Auditor cannot write (T2 rule: POST → 403)
  const post = await request(app).post('/api/sales').set(bearer(tokens.auditor)).send(body);
  expect(post.status).toBe(403);
  expect(post.body.error.code).toBe('FORBIDDEN');

  // Auditor CAN read (T2 rule: GET → 200)
  const list = await get(tokens.auditor, '/api/sales');
  expect(list.status).toBe(200);
  expect(list.body).toHaveProperty('data');

  const detail = await get(tokens.auditor, `/api/sales/1`);
  // Either 200 (found) or 404 (no sale with id 1 yet) — both prove Auditor is not blocked
  expect([200, 404]).toContain(detail.status);
  expect(detail.status).not.toBe(403);
});

test('creates a sale: server prices, tax included, stock taken, movement and audit entry written', async () => {
  const before = await stockOf(ids.p1, ids.branchA);

  const res = await sell(tokens.staff, {
    customerName: '  Almaz  ',
    items: [
      { productId: ids.p1, quantity: 2 },
      { productId: ids.p2, quantity: 1 },
    ],
    price: 1, // the client never sends prices, so this is ignored
  });
  expect(res.status).toBe(201);
  expect(res.body.invoiceNumber).toMatch(/^INV-\d{6}$/);
  expect(res.body).toMatchObject({
    branchId: ids.branchA,
    branchName: `${prefix} Branch A`,
    customerName: 'Almaz',
    createdBy: { id: ids.staffId, name: 'Sales Test staff' },
    netAmount: 196.09,
    taxType: 'VAT',
    taxRate: 15,
    taxAmount: 29.41,
    total: 225.5,
  });
  expect(res.body.items).toEqual([
    { id: expect.any(Number), productId: ids.p1, productName: `${prefix} P1`, quantity: 2, unitPrice: 100, lineTotal: 200 },
    { id: expect.any(Number), productId: ids.p2, productName: `${prefix} P2`, quantity: 1, unitPrice: 25.5, lineTotal: 25.5 },
  ]);
  expect(res.body.createdAt).toBeTruthy();
  expect(res.body).not.toHaveProperty('company');
  expect(res.body.items[0]).not.toHaveProperty('returnedQuantity');

  expect(await stockOf(ids.p1, ids.branchA)).toBe(before - 2);
  const movements = await prisma.stockMovement.findMany({
    where: { productId: ids.p1, branchId: ids.branchA, type: 'SALE' },
  });
  expect(movements).toHaveLength(1);
  expect(movements[0].quantityChange.toNumber()).toBe(-2);
  expect(movements[0].referenceType).toBe('SALE');
  expect(movements[0].referenceId).toBe(res.body.id);
  expect(movements[0].userId).toBe(ids.staffId);

  const audit = await prisma.auditLog.findMany({
    where: { entityType: 'SALE', entityId: res.body.id, action: 'SALE_CREATED' },
  });
  expect(audit).toHaveLength(1);
  expect(audit[0].userId).toBe(ids.staffId);
  expect(audit[0].branchId).toBe(ids.branchA);
  expect(audit[0].oldValue).toBeNull();
  expect(audit[0].newValue).toEqual({ invoiceNumber: res.body.invoiceNumber, total: 225.5 });
});

test('tax is included in the price and calculated once on the total (contract VAT and TOT examples)', async () => {
  const vat = await sell(tokens.staff, { items: [{ productId: ids.pA, quantity: 1 }] });
  expect(vat.status).toBe(201);
  expect(vat.body).toMatchObject({ total: 1150, taxAmount: 150, netAmount: 1000, taxType: 'VAT', taxRate: 15 });

  await prisma.companySetting.update({ where: { id: 1 }, data: { taxType: 'TOT', taxRate: 0.02 } });
  const tot = await sell(tokens.staff, { items: [{ productId: ids.pB, quantity: 1 }] });
  expect(tot.status).toBe(201);
  expect(tot.body).toMatchObject({ total: 1020, taxAmount: 20, netAmount: 1000, taxType: 'TOT', taxRate: 2 });

  // A later setting change never changes an old invoice
  await prisma.companySetting.update({ where: { id: 1 }, data: { taxType: 'VAT', taxRate: 0.15 } });
  const again = await get(tokens.staff, `/api/sales/${tot.body.id}`);
  expect(again.status).toBe(200);
  expect(again.body).toMatchObject({ taxType: 'TOT', taxRate: 2, taxAmount: 20, netAmount: 1000, total: 1020 });
});

test('invoice numbers are consecutive and a failed sale does not use one', async () => {
  const first = await sell(tokens.staff, { items: [{ productId: ids.p2, quantity: 1 }] });
  expect(first.status).toBe(201);

  const counterBefore = await counter();
  const failed = await sell(tokens.staff, { items: [{ productId: ids.pLow1, quantity: 5 }] });
  expect(failed.status).toBe(422);
  expect(await counter()).toBe(counterBefore);

  const second = await sell(tokens.staff, { items: [{ productId: ids.p2, quantity: 1 }] });
  expect(second.status).toBe(201);
  expect(invoiceNumber(second.body.invoiceNumber)).toBe(invoiceNumber(first.body.invoiceNumber) + 1);
});

test('short stock returns 422 with one detail per short line, and nothing is saved', async () => {
  const salesBefore = await salesIn(ids.branchA);
  const counterBefore = await counter();
  const p1Before = await stockOf(ids.p1, ids.branchA);

  const res = await sell(tokens.staff, {
    items: [
      { productId: ids.pLow1, quantity: 5 },
      { productId: ids.pLow2, quantity: 3 },
    ],
  });
  expect(res.status).toBe(422);
  expect(res.body.error.code).toBe('INSUFFICIENT_STOCK');
  expect(res.body.error.message).toBe('Not enough stock for 2 items.');
  expect(res.body.error.details).toEqual([
    { field: 'items[0].quantity', productId: ids.pLow1, available: 1, requested: 5 },
    { field: 'items[1].quantity', productId: ids.pLow2, available: 2, requested: 3 },
  ]);

  // Only the short line is reported; the line with enough stock is not
  const mixed = await sell(tokens.staff, {
    items: [
      { productId: ids.p1, quantity: 1 },
      { productId: ids.pLow1, quantity: 5 },
    ],
  });
  expect(mixed.status).toBe(422);
  expect(mixed.body.error.message).toBe('Not enough stock for 1 item.');
  expect(mixed.body.error.details).toEqual([
    { field: 'items[1].quantity', productId: ids.pLow1, available: 1, requested: 5 },
  ]);

  expect(await salesIn(ids.branchA)).toBe(salesBefore);
  expect(await counter()).toBe(counterBefore);
  expect(await stockOf(ids.p1, ids.branchA)).toBe(p1Before);
  expect(await stockOf(ids.pLow1, ids.branchA)).toBe(1);
});

test('two simultaneous sales of the last unit: one succeeds, one is 422, and only one invoice number is used', async () => {
  const counterBefore = await counter();
  const body = { items: [{ productId: ids.pRace, quantity: 1 }] };

  const results = await Promise.all([sell(tokens.staff, body), sell(tokens.manager, body)]);
  expect(results.map((r) => r.status).sort((x, y) => x - y)).toEqual([201, 422]);

  const failed = results.find((r) => r.status === 422);
  expect(failed.body.error.code).toBe('INSUFFICIENT_STOCK');
  expect(failed.body.error.details).toEqual([
    { field: 'items[0].quantity', productId: ids.pRace, available: 0, requested: 1 },
  ]);

  expect(await stockOf(ids.pRace, ids.branchA)).toBe(0);
  expect(await counter()).toBe(counterBefore + 1); // no gap and no wasted number
  expect(await prisma.saleItem.count({ where: { productId: ids.pRace } })).toBe(1);
});

test('validation gives the right field and rule', async () => {
  const line = { productId: ids.p1, quantity: 1 };

  expectValidation(await sell(tokens.staff, { items: [] }), 'items', 'min');
  expectValidation(await sell(tokens.staff, {}), 'items', 'required');
  expectValidation(await sell(tokens.staff, { items: [{ quantity: 1 }] }), 'items[0].productId', 'required');
  expectValidation(await sell(tokens.staff, { items: [{ productId: ids.p1, quantity: 0 }] }), 'items[0].quantity', 'min');
  expectValidation(await sell(tokens.staff, { items: [{ productId: ids.p1, quantity: 1.234 }] }), 'items[0].quantity', 'invalid');
  expectValidation(await sell(tokens.staff, { items: [{ productId: ids.p1, quantity: 'abc' }] }), 'items[0].quantity', 'invalid');
  expectValidation(await sell(tokens.staff, { customerName: 'x'.repeat(101), items: [line] }), 'customerName', 'too_long');
  expectValidation(await sell(tokens.staff, { items: [line, { productId: ids.p1, quantity: 2 }] }), 'items[1].productId', 'duplicate');
  expectValidation(await sell(tokens.admin, { items: [line] }), 'branchId', 'required'); // Admin must send branchId
});

test('inactive and unknown products and branches are rejected', async () => {
  expectValidation(
    await sell(tokens.staff, { items: [{ productId: ids.pInactive, quantity: 1 }] }),
    'items[0].productId',
    'inactive'
  );

  const unknownProduct = await sell(tokens.staff, { items: [{ productId: 999999999, quantity: 1 }] });
  expect(unknownProduct.status).toBe(404);
  expect(unknownProduct.body.error.code).toBe('NOT_FOUND');

  const line = { productId: ids.p1, quantity: 1 };
  const unknownBranch = await sell(tokens.admin, { branchId: 999999999, items: [line] });
  expect(unknownBranch.status).toBe(404);
  expect(unknownBranch.body.error.code).toBe('NOT_FOUND');

  expectValidation(await sell(tokens.admin, { branchId: ids.branchC, items: [line] }), 'branchId', 'inactive');
});

test('Manager and Staff sell only from their own branch; Admin chooses the branch', async () => {
  const line = { productId: ids.p1, quantity: 1 };

  // The branch is checked before the body, so a bad body for another branch is still 403
  const otherBranchBadBody = await sell(tokens.manager, { branchId: ids.branchB, items: [] });
  expect(otherBranchBadBody.status).toBe(403);
  expect(otherBranchBadBody.body.error.code).toBe('FORBIDDEN');

  const staffOtherBranch = await sell(tokens.staff, { branchId: ids.branchB, items: [line] });
  expect(staffOtherBranch.status).toBe(403);
  expect(staffOtherBranch.body.error.code).toBe('FORBIDDEN');

  const own = await sell(tokens.manager, { branchId: ids.branchA, items: [line] });
  expect(own.status).toBe(201);
  expect(own.body.branchId).toBe(ids.branchA);

  const bBefore = await stockOf(ids.p1, ids.branchB);
  const adminSale = await sell(tokens.admin, { branchId: ids.branchB, items: [line] });
  expect(adminSale.status).toBe(201);
  expect(adminSale.body).toMatchObject({ branchId: ids.branchB, branchName: `${prefix} Branch B` });
  expect(await stockOf(ids.p1, ids.branchB)).toBe(bBefore - 1);
});

test('GET /api/sales: branch scope, itemCount instead of items, newest first, and filters', async () => {
  const total = await salesIn(ids.branchA);
  expect(total).toBeGreaterThan(3);

  const admin = await get(tokens.admin, `/api/sales?branchId=${ids.branchA}&limit=100`);
  expect(admin.status).toBe(200);
  expect(admin.body.total).toBe(total);
  expect(admin.body.page).toBe(1);
  expect(admin.body.limit).toBe(100);
  admin.body.data.forEach((sale) => {
    expect(sale).not.toHaveProperty('items');
    expect(sale.itemCount).toBeGreaterThan(0);
    expect(sale.branchId).toBe(ids.branchA);
  });
  const times = admin.body.data.map((sale) => Date.parse(sale.createdAt));
  expect(times).toEqual([...times].sort((x, y) => y - x));

  // Manager and Staff see their own branch only, and get 403 for another one
  const manager = await get(tokens.manager, '/api/sales?limit=100');
  expect(manager.body.total).toBe(total);
  manager.body.data.forEach((sale) => expect(sale.branchId).toBe(ids.branchA));
  expect((await get(tokens.staff, '/api/sales')).status).toBe(200);
  const otherBranch = await get(tokens.manager, `/api/sales?branchId=${ids.branchB}`);
  expect(otherBranch.status).toBe(403);
  expect(otherBranch.body.error.code).toBe('FORBIDDEN');

  const managerB = await get(tokens.managerb, '/api/sales');
  expect(managerB.body.total).toBe(await salesIn(ids.branchB));
  managerB.body.data.forEach((sale) => expect(sale.branchId).toBe(ids.branchB));

  // Filters: invoice number (partial, any case), cashier, Ethiopia-time dates
  const one = admin.body.data[0];
  const byInvoice = await get(tokens.admin, `/api/sales?invoiceNumber=${one.invoiceNumber.toLowerCase()}`);
  expect(byInvoice.body.total).toBe(1);
  expect(byInvoice.body.data[0].id).toBe(one.id);

  const byCashier = await get(tokens.admin, `/api/sales?branchId=${ids.branchA}&createdBy=${ids.managerId}`);
  expect(byCashier.body.total).toBeGreaterThan(0);
  byCashier.body.data.forEach((sale) => expect(sale.createdBy.id).toBe(ids.managerId));

  const today = ethiopiaDate();
  const sameDay = await get(tokens.admin, `/api/sales?branchId=${ids.branchA}&from=${today}&to=${today}`);
  expect(sameDay.body.total).toBe(total);
  const future = await get(tokens.admin, `/api/sales?branchId=${ids.branchA}&from=${ethiopiaDate(24)}`);
  expect(future.body.total).toBe(0);

  expectValidation(await get(tokens.admin, '/api/sales?limit=101'), 'limit', 'max');
  expectValidation(await get(tokens.admin, '/api/sales?createdBy=abc'), 'createdBy', 'invalid');
  expectValidation(await get(tokens.admin, '/api/sales?from=abc'), 'from', 'invalid');
});

test('GET /api/sales/:id returns the sale with returnedQuantity and the company block, with the branch rule', async () => {
  const created = await sell(tokens.staff, { items: [{ productId: ids.p2, quantity: 2 }] });
  expect(created.status).toBe(201);
  const url = `/api/sales/${created.body.id}`;

  const res = await get(tokens.manager, url);
  expect(res.status).toBe(200);
  expect(res.body).toMatchObject({
    id: created.body.id,
    invoiceNumber: created.body.invoiceNumber,
    branchId: ids.branchA,
    total: 51,
    createdBy: { id: ids.staffId, name: 'Sales Test staff' },
  });
  expect(res.body.items[0]).toMatchObject({ productId: ids.p2, quantity: 2, returnedQuantity: 0 });
  expect(res.body.company).toEqual({
    companyName: originalSettings.companyName,
    address: originalSettings.address,
    tin: originalSettings.tin,
  });

  expect((await get(tokens.admin, url)).status).toBe(200);

  const otherBranch = await get(tokens.managerb, url);
  expect(otherBranch.status).toBe(403);
  expect(otherBranch.body.error.code).toBe('FORBIDDEN');

  // Auditor CAN read any branch's sale detail (T2)
  expect((await get(tokens.auditor, url)).status).toBe(200);

  const unknown = await get(tokens.admin, '/api/sales/999999999');
  expect(unknown.status).toBe(404);
  expect(unknown.body.error.code).toBe('NOT_FOUND');
  expect((await get(tokens.admin, '/api/sales/abc')).status).toBe(404);
});

test('Auditor read access on sales lists and detail across all branches (T2 / N2)', async () => {
  // Create a sale in branch A and a sale in branch B
  const saleA = await sell(tokens.admin, { branchId: ids.branchA, items: [{ productId: ids.p1, quantity: 1 }] });
  expect(saleA.status).toBe(201);
  const saleB = await sell(tokens.admin, { branchId: ids.branchB, items: [{ productId: ids.p1, quantity: 1 }] });
  expect(saleB.status).toBe(201);

  // Auditor GET /api/sales returns 200 and includes sales from both branches
  const allSales = await get(tokens.auditor, '/api/sales?limit=100');
  expect(allSales.status).toBe(200);
  const returnedIds = allSales.body.data.map((s) => s.id);
  expect(returnedIds).toContain(saleA.body.id);
  expect(returnedIds).toContain(saleB.body.id);

  // Auditor GET /api/sales?branchId=<A> returns only branch A
  const branchASales = await get(tokens.auditor, `/api/sales?branchId=${ids.branchA}&limit=100`);
  expect(branchASales.status).toBe(200);
  branchASales.body.data.forEach((sale) => expect(sale.branchId).toBe(ids.branchA));
  expect(branchASales.body.data.some((s) => s.id === saleA.body.id)).toBe(true);
  expect(branchASales.body.data.some((s) => s.id === saleB.body.id)).toBe(false);

  // Auditor GET /api/sales/:id returns 200 with company and returnedQuantity
  const detail = await get(tokens.auditor, `/api/sales/${saleA.body.id}`);
  expect(detail.status).toBe(200);
  expect(detail.body).toHaveProperty('company');
  expect(detail.body.items[0]).toHaveProperty('returnedQuantity');

  // Auditor POST /api/sales still returns 403
  const postRes = await sell(tokens.auditor, { branchId: ids.branchA, items: [{ productId: ids.p1, quantity: 1 }] });
  expect(postRes.status).toBe(403);
  expect(postRes.body.error.code).toBe('FORBIDDEN');

  // Manager and Staff still see only their own branch, and get 403 for another branchId
  const mgrOwn = await get(tokens.manager, '/api/sales');
  expect(mgrOwn.status).toBe(200);
  mgrOwn.body.data.forEach((s) => expect(s.branchId).toBe(ids.branchA));

  const mgrOther = await get(tokens.manager, `/api/sales?branchId=${ids.branchB}`);
  expect(mgrOther.status).toBe(403);
  expect(mgrOther.body.error.code).toBe('FORBIDDEN');

  const staffOther = await get(tokens.staff, `/api/sales?branchId=${ids.branchB}`);
  expect(staffOther.status).toBe(403);
  expect(staffOther.body.error.code).toBe('FORBIDDEN');
});