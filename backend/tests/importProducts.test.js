require('dotenv').config();
const request = require('supertest');
const bcrypt = require('bcryptjs');
const app = require('../src/app');
const prisma = require('../src/config/db');

jest.setTimeout(120000);
const stamp = Date.now();
const prefix = `CSV Import Test ${stamp}`;
const URL = '/api/import/products';
const ids = {};
const tokens = {};
const userIds = [];
const branchIds = [];
const categoryIds = [];
const productIds = [];
const importedProductIds = [];
const movementIds = [];
const auditIds = [];

const bearer = (token) => ({ Authorization: `Bearer ${token}` });
const upload = (token, dryRun, csv, branchId) => {
  let req = request(app).post(`${URL}?dryRun=${dryRun}`).set(bearer(token));
  if (branchId !== undefined) req = req.field('branchId', String(branchId));
  return req.attach('file', Buffer.from(csv, 'utf8'), { filename: 'products.csv', contentType: 'text/csv' });
};

async function createUser(label, role, branchId) {
  const user = await prisma.user.create({ data: {
    username: `test-import-${label}-${stamp}`,
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
  ids.branch = (await prisma.branch.create({ data: { name: `${prefix} Branch`, code: `IM${stamp}` } })).id;
  branchIds.push(ids.branch);
  await createUser('admin', 'ADMIN', null);
  await createUser('manager', 'BRANCH_MANAGER', ids.branch);
  const category = await prisma.category.create({ data: { name: `${prefix} Category` } });
  categoryIds.push(category.id);
  ids.category = category.id;
  const duplicate = await prisma.product.create({ data: {
    name: `${prefix} Existing`, sku: `IM-EXIST-${stamp}`, unit: 'piece', costPrice: 1, sellingPrice: 2,
  } });
  productIds.push(duplicate.id);
  ids.existingSku = duplicate.sku;
});

afterAll(async () => {
  await prisma.auditLog.deleteMany({ where: { id: { in: auditIds } } });
  await prisma.stockMovement.deleteMany({ where: { id: { in: movementIds } } });
  await prisma.notification.deleteMany({ where: { productId: { in: importedProductIds } } });
  await prisma.branchStock.deleteMany({ where: { productId: { in: importedProductIds } } });
  await prisma.product.deleteMany({ where: { id: { in: [...productIds, ...importedProductIds] } } });
  await prisma.category.deleteMany({ where: { id: { in: categoryIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.branch.deleteMany({ where: { id: { in: branchIds } } });
  await prisma.$disconnect();
});

test('template downloads the required CSV header and is Admin-only', async () => {
  const template = await request(app).get(`${URL}/template`).set(bearer(tokens.admin));
  expect(template.status).toBe(200);
  expect(template.headers['content-type']).toContain('text/csv');
  expect(template.text.charCodeAt(0)).toBe(0xfeff);
  expect(template.text.trim()).toBe('sku,name,barcode,category,unit,costPrice,sellingPrice,openingQuantity');
  expect((await request(app).get(`${URL}/template`).set(bearer(tokens.manager))).status).toBe(403);
});

test('dry run changes nothing; confirming the same file imports valid rows, skips invalid rows and records opening stock', async () => {
  const csv = [
    'sku,name,barcode,category,unit,costPrice,sellingPrice,openingQuantity',
    `IM-NEW-${stamp},New Product,,${prefix} Category,box,2.25,4.5,5`,
    `IM-BAD-${stamp},Bad Product,,Missing Category,box,nope,4,0`,
    '',
  ].join('\r\n');

  const preview = await upload(tokens.admin, 'true', csv, ids.branch);
  expect(preview.status).toBe(200);
  expect(preview.body).toMatchObject({ dryRun: true, totalRows: 2, validRows: 1, invalidRows: 1 });
  expect(preview.body.rows[1].errors.map((error) => error.field)).toEqual(expect.arrayContaining(['costPrice', 'category']));
  expect(await prisma.product.findUnique({ where: { sku: `IM-NEW-${stamp}` } })).toBeNull();
  expect(await prisma.branchStock.count({ where: { product: { sku: `IM-NEW-${stamp}` } } })).toBe(0);

  const confirmed = await upload(tokens.admin, 'false', csv, ids.branch);
  expect(confirmed.status).toBe(200);
  expect(confirmed.body).toMatchObject({ dryRun: false, imported: 1, skipped: 1 });
  expect(confirmed.body.skippedRows[0].errors.map((error) => error.field)).toEqual(expect.arrayContaining(['costPrice', 'category']));

  const product = await prisma.product.findUnique({ where: { sku: `IM-NEW-${stamp}` } });
  expect(product).toMatchObject({ name: 'New Product', categoryId: ids.category });
  importedProductIds.push(product.id);
  expect(await prisma.branchStock.count({ where: { productId: product.id } })).toBe(await prisma.branch.count());
  const stock = await prisma.branchStock.findUnique({ where: { productId_branchId: { productId: product.id, branchId: ids.branch } } });
  expect(stock.quantity.toNumber()).toBe(5);
  const movement = await prisma.stockMovement.findMany({ where: { productId: product.id, type: 'OPENING_STOCK' } });
  expect(movement).toHaveLength(1);
  expect(movement[0].quantityChange.toNumber()).toBe(5);
  movementIds.push(movement[0].id);
  const audit = await prisma.auditLog.findMany({ where: { action: 'IMPORT_CONFIRMED', newValue: { path: ['productIds'], array_contains: [product.id] } } });
  expect(audit).toHaveLength(1);
  auditIds.push(audit[0].id);
});

test('checks existing duplicate SKUs and requires dryRun and branchId for opening stock', async () => {
  const csv = [
    'sku,name,barcode,category,unit,costPrice,sellingPrice,openingQuantity',
    `${ids.existingSku},Duplicate,,${prefix} Category,piece,1,2,1`,
  ].join('\n');
  const missingBranch = await upload(tokens.admin, 'true', csv, undefined);
  expect(missingBranch.status).toBe(400);
  expect(missingBranch.body.error.details[0].field).toBe('branchId');

  const noDryRun = await request(app).post(URL).set(bearer(tokens.admin)).attach('file', Buffer.from(csv), 'products.csv');
  expect(noDryRun.status).toBe(400);
  const preview = await upload(tokens.admin, 'true', csv, ids.branch);
  expect(preview.status).toBe(200);
  expect(preview.body.rows[0].errors[0]).toMatchObject({ field: 'sku', code: 'DUPLICATE_SKU' });
});

test('import writes are blocked for non-Admin roles', async () => {
  const csv = 'sku,name,barcode,category,unit,costPrice,sellingPrice,openingQuantity\n';
  expect((await upload(tokens.manager, 'true', csv, ids.branch)).status).toBe(403);
  expect((await request(app).get(`${URL}/template`)).status).toBe(401);
});
