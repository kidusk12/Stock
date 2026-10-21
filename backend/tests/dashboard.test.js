require('dotenv').config();
const request = require('supertest');
const bcrypt = require('bcryptjs');
const app = require('../src/app');
const prisma = require('../src/config/db');

jest.setTimeout(120000);
const stamp = Date.now();
const prefix = `Dashboard Test ${stamp}`;
const URL = '/api/dashboard';
const ids = {};
const tokens = {};
const userIds = [];
const productIds = [];
const saleIds = [];
const branchStockIds = [];
const transferIds = [];
const returnIds = [];
const adjustmentIds = [];
const auditIds = [];
let adminBaseline;

const bearer = (token) => ({ Authorization: `Bearer ${token}` });
const get = (token, path = URL) => request(app).get(path).set(bearer(token));

async function createUser(label, role, branchId) {
  const user = await prisma.user.create({ data: {
    username: `test-dashboard-${label}-${stamp}`,
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
  ids.branchA = (await prisma.branch.create({ data: { name: `${prefix} A`, code: `DHA${stamp}` } })).id;
  ids.branchB = (await prisma.branch.create({ data: { name: `${prefix} B`, code: `DHB${stamp}` } })).id;
  await createUser('managerA', 'BRANCH_MANAGER', ids.branchA);
  await createUser('staffA', 'STAFF', ids.branchA);
  await createUser('admin', 'ADMIN', null);
  await createUser('auditor', 'AUDITOR', null);

  adminBaseline = (await get(tokens.admin)).body.widgets;

  const product = await prisma.product.create({ data: {
    name: `${prefix} Product`, sku: `DH-${stamp}`, unit: 'piece', costPrice: 4, sellingPrice: 10,
  } });
  productIds.push(product.id);
  ids.product = product.id;

  const stocks = await prisma.branchStock.createMany({ data: [
    { productId: product.id, branchId: ids.branchA, quantity: 2, minQty: 3 },
    { productId: product.id, branchId: ids.branchB, quantity: 20, minQty: 5 },
  ] });
  void stocks;
  branchStockIds.push(...(await prisma.branchStock.findMany({ where: { productId: product.id }, select: { id: true } })).map(({ id }) => id));

  const saleA = await prisma.sale.create({ data: {
    invoiceNumber: `DH-A-${stamp}`, branchId: ids.branchA, createdById: ids.staffA,
    subtotal: 10, taxType: 'VAT', taxRate: 0.15, taxAmount: 1.5, total: 11.5, createdAt: new Date(),
    items: { create: [{ productId: product.id, quantity: 1, unitPrice: 11.5, lineTotal: 11.5 }] },
  } });
  const saleB = await prisma.sale.create({ data: {
    invoiceNumber: `DH-B-${stamp}`, branchId: ids.branchB, createdById: ids.managerA,
    subtotal: 5, taxType: 'VAT', taxRate: 0.15, taxAmount: 0.75, total: 5.75, createdAt: new Date(),
    items: { create: [{ productId: product.id, quantity: 0.5, unitPrice: 11.5, lineTotal: 5.75 }] },
  } });
  saleIds.push(saleA.id, saleB.id);
  ids.saleA = saleA.id;

  const pendingReturn = await prisma.saleReturn.create({ data: {
    saleId: saleA.id, branchId: ids.branchA, refundAmount: 5, createdById: ids.staffA,
  } });
  returnIds.push(pendingReturn.id);

  const incoming = await prisma.transfer.create({ data: {
    fromBranchId: ids.branchB, toBranchId: ids.branchA, status: 'SHIPPED', requestedById: ids.staffA,
  } });
  const approval = await prisma.transfer.create({ data: {
    fromBranchId: ids.branchA, toBranchId: ids.branchB, status: 'REQUESTED', requestedById: ids.staffA,
  } });
  transferIds.push(incoming.id, approval.id);

  const adjustment = await prisma.adjustment.create({ data: {
    branchId: ids.branchA, productId: product.id, quantityChange: -1, reason: 'DAMAGE', userId: ids.staffA,
  } });
  adjustmentIds.push(adjustment.id);
  const audit = await prisma.auditLog.create({ data: {
    userId: ids.staffA, branchId: ids.branchA, action: 'SALE_CREATED', entityType: 'SALE', entityId: saleA.id,
    newValue: { invoiceNumber: saleA.invoiceNumber, total: 11.5 },
  } });
  auditIds.push(audit.id);
});

afterAll(async () => {
  await prisma.auditLog.deleteMany({ where: { id: { in: auditIds } } });
  await prisma.adjustment.deleteMany({ where: { id: { in: adjustmentIds } } });
  await prisma.saleReturn.deleteMany({ where: { id: { in: returnIds } } });
  await prisma.saleItem.deleteMany({ where: { saleId: { in: saleIds } } });
  await prisma.sale.deleteMany({ where: { id: { in: saleIds } } });
  await prisma.transfer.deleteMany({ where: { id: { in: transferIds } } });
  await prisma.branchStock.deleteMany({ where: { id: { in: branchStockIds } } });
  await prisma.product.deleteMany({ where: { id: { in: productIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.branch.deleteMany({ where: { id: { in: [ids.branchA, ids.branchB] } } });
  await prisma.$disconnect();
});

test('returns each role’s contract widgets and scopes branch data correctly', async () => {
  const manager = await get(tokens.managerA);
  expect(manager.status).toBe(200);
  expect(manager.body.role).toBe('BRANCH_MANAGER');
  expect(manager.body.widgets).toMatchObject({
    stockValue: 8,
    salesToday: { count: 1, total: 11.5 },
    lowStockCount: 1,
    lowStockItems: [{ productId: ids.product, quantity: 2, minQuantity: 3 }],
    pendingApprovals: { purchaseOrders: 0, transfers: 1 },
    transfersInTransit: 1,
    pendingRefunds: { count: 1, totalAmount: 5 },
  });

  const staff = await get(tokens.staffA);
  expect(staff.status).toBe(200);
  expect(staff.body.role).toBe('STAFF');
  expect(staff.body.widgets.salesToday).toEqual({ count: 1, total: 11.5 });
  expect(staff.body.widgets).toHaveProperty('expectedPurchaseOrders');
  expect(staff.body.widgets).toHaveProperty('pendingTransfers');
  expect(staff.body.widgets.pendingTransfers).toEqual(expect.arrayContaining([
    expect.objectContaining({ transferNumber: `TRF-${String(transferIds[0]).padStart(6, '0')}` }),
  ]));
  expect(staff.body.widgets).not.toHaveProperty('lowStockItems');

  const admin = await get(tokens.admin);
  expect(admin.status).toBe(200);
  expect(admin.body.role).toBe('ADMIN');
  expect(admin.body.widgets.stockValue).toBeCloseTo(adminBaseline.stockValue + 88, 2);
  expect(admin.body.widgets.salesSummary.count).toBe(adminBaseline.salesSummary.count + 2);
  expect(admin.body.widgets.salesSummary.total).toBeCloseTo(adminBaseline.salesSummary.total + 17.25, 2);
  expect(admin.body.widgets.lowStockCount).toBe(adminBaseline.lowStockCount + 1);
  expect(admin.body.widgets.pendingRefunds.count).toBe(adminBaseline.pendingRefunds.count + 1);
  expect(admin.body.widgets.pendingRefunds.totalAmount).toBeCloseTo(adminBaseline.pendingRefunds.totalAmount + 5, 2);
  expect(admin.body.widgets.branchComparison).toEqual(expect.arrayContaining([
    { branchId: ids.branchA, branchName: `${prefix} A`, total: 11.5 },
    { branchId: ids.branchB, branchName: `${prefix} B`, total: 5.75 },
  ]));
  const selectedBranch = await get(tokens.admin, `${URL}?branchId=${ids.branchA}`);
  expect(selectedBranch.status).toBe(200);
  expect(selectedBranch.body.widgets.salesSummary).toEqual({ count: 1, total: 11.5 });
  expect(selectedBranch.body.widgets.branchComparison).toHaveLength(1);

  const auditor = await get(tokens.auditor);
  expect(auditor.status).toBe(200);
  expect(auditor.body.role).toBe('AUDITOR');
  expect(auditor.body.widgets.recentAuditActivity[0]).toMatchObject({ action: 'SALE_CREATED', entityType: 'SALE', createdBy: { id: ids.staffA, name: `${prefix} staffA` } });
  expect(auditor.body.widgets.recentAdjustments[0]).toMatchObject({ productName: `${prefix} Product`, quantity: -1, reason: 'DAMAGE' });
  expect(Object.keys(auditor.body.widgets).sort()).toEqual(['recentAdjustments', 'recentAuditActivity']);
});

test('rejects a Manager selecting another branch and requires a valid Admin branch id', async () => {
  const wrongBranch = await get(tokens.managerA, `${URL}?branchId=${ids.branchB}`);
  expect(wrongBranch.status).toBe(403);
  expect(wrongBranch.body.error.code).toBe('FORBIDDEN');
  const malformed = await get(tokens.admin, `${URL}?branchId=bad`);
  expect(malformed.status).toBe(400);
  expect(malformed.body.error.code).toBe('VALIDATION_ERROR');
});
