// backend/tests/products.test.js
// Follows docs/api-contract.md v5 section 5.4. Self-contained; cleans up in afterAll.
require('dotenv').config();
const request = require('supertest');
const bcrypt = require('bcryptjs');
const app = require('../src/app');
const prisma = require('../src/config/db');

jest.setTimeout(60000);

const stamp = Date.now();
const prefix = `Test Product ${stamp}`;
const bearer = (t) => ({ Authorization: `Bearer ${t}` });
const get = (t, path) => request(app).get(path).set(bearer(t));
const post = (t, path, body) => request(app).post(path).set(bearer(t)).send(body);
const patch = (t, path, body) => request(app).patch(path).set(bearer(t)).send(body);
const login = (u, p) => request(app).post('/api/auth/login').send({ username: u, password: p });

const tokens = {};
const userIds = [];
const productIds = [];
const categoryIds = [];
const branchIds = [];

let catId;
let brA;
let brB;

function expectValidation(res, field, rule) {
  expect(res.status).toBe(400);
  expect(res.body.error.code).toBe('VALIDATION_ERROR');
  expect(res.body.error.details[0].field).toBe(field);
  expect(res.body.error.details[0].rule).toBe(rule);
}

async function createUser(label, role, branchId = null) {
  const user = await prisma.user.create({
    data: {
      username: `test-product-${label}-${stamp}`,
      passwordHash: await bcrypt.hash('Test12345', 10),
      fullName: `Product Test ${label}`,
      role,
      branchId,
    },
  });
  userIds.push(user.id);
  tokens[label] = (await login(user.username, 'Test12345')).body.token;
  return user;
}

beforeAll(async () => {
  // Defensive cleanup from prior failed runs
  const stale = await prisma.product.findMany({
    where: { name: { startsWith: 'Test Product' } },
    select: { id: true },
  });
  if (stale.length) {
    const ids = stale.map((p) => p.id);
    await prisma.branchStock.deleteMany({ where: { productId: { in: ids } } });
    await prisma.stockMovement.deleteMany({ where: { productId: { in: ids } } });
    await prisma.product.deleteMany({ where: { id: { in: ids } } });
  }
  const staleCats = await prisma.category.findMany({
    where: { name: { startsWith: 'Test Cat Product' } },
    select: { id: true },
  });
  if (staleCats.length) {
    await prisma.category.deleteMany({ where: { id: { in: staleCats.map((c) => c.id) } } });
  }

  // Create the fixtures products need
  const cat = await prisma.category.create({ data: { name: `Test Cat Product ${stamp}` } });
  catId = cat.id;
  categoryIds.push(cat.id);

  const a = await prisma.branch.create({ data: { name: `${prefix} Branch A`, code: `TPA${stamp}`.slice(0, 15) } });
  const b = await prisma.branch.create({ data: { name: `${prefix} Branch B`, code: `TPB${stamp}`.slice(0, 15) } });
  brA = a.id;
  brB = b.id;
  branchIds.push(a.id, b.id);

  tokens.admin = (await login('admin', 'Admin123!')).body.token;
  await createUser('manager', 'BRANCH_MANAGER', brA);
  await createUser('staff', 'STAFF', brA);
  await createUser('auditor', 'AUDITOR', null);
});

afterAll(async () => {
  await prisma.branchStock.deleteMany({ where: { productId: { in: productIds } } });
  await prisma.stockMovement.deleteMany({ where: { productId: { in: productIds } } });
  await prisma.product.deleteMany({ where: { id: { in: productIds } } });
  await prisma.category.deleteMany({ where: { id: { in: categoryIds } } });
  await prisma.branch.deleteMany({ where: { id: { in: branchIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.$disconnect();
});

// ─────────────────────────────────────────────────────────────
// ROLES
// ─────────────────────────────────────────────────────────────
test('roles: writes are Admin only; reads open; Auditor blocked on by-barcode', async () => {
  expect((await request(app).get('/api/products')).status).toBe(401);

  for (const label of ['manager', 'staff', 'auditor']) {
    const res = await post(tokens[label], '/api/products', {
      name: `${prefix} ${label}`,
      sku: `TP-${label}-${stamp}`,
      categoryId: catId,
      unit: 'piece',
      costPrice: 1,
      sellingPrice: 2,
    });
    expect(res.status).toBe(403);
  }

  // by-barcode is Admin/Manager/Staff only (Auditor 403)
  expect((await get(tokens.auditor, '/api/products/by-barcode/anything')).status).toBe(403);
});

// ─────────────────────────────────────────────────────────────
// CREATE
// ─────────────────────────────────────────────────────────────
test('create 201, returns contract fields, creates qty-0 row per branch', async () => {
  const payload = {
    name: `${prefix} Coke`,
    sku: `TP-C-${stamp}`,
    barcode: `TP-BC-${stamp}`,
    categoryId: catId,
    unit: 'bottle',
    costPrice: 18,
    sellingPrice: 25,
  };
  const res = await post(tokens.admin, '/api/products', payload);
  expect(res.status).toBe(201);
  expect(res.body).toMatchObject({
    name: payload.name,
    sku: payload.sku,
    barcode: payload.barcode,
    categoryId: catId,
    categoryName: `Test Cat Product ${stamp}`,
    unit: 'bottle',
    costPrice: 18,
    sellingPrice: 25,
    isActive: true,
  });
  productIds.push(res.body.id);

  // K6: one stock row per existing branch, quantity 0
  const rows = await prisma.branchStock.findMany({ where: { productId: res.body.id } });
  const branchCount = await prisma.branch.count();
  expect(rows.length).toBe(branchCount);
  rows.forEach((r) => expect(r.quantity.toNumber()).toBe(0));
});

test('required fields: name, sku, categoryId, unit, costPrice, sellingPrice', async () => {
  const base = {
    name: `${prefix} X`,
    sku: `TP-X-${stamp}`,
    categoryId: catId,
    unit: 'piece',
    costPrice: 1,
    sellingPrice: 2,
  };
  for (const missing of ['name', 'sku', 'categoryId', 'unit', 'costPrice', 'sellingPrice']) {
    const body = { ...base };
    delete body[missing];
    expectValidation(await post(tokens.admin, '/api/products', body), missing, 'required');
  }
});

test('prices: 0 or more, at most 2 decimals', async () => {
  const base = {
    name: `${prefix} Price`,
    sku: `TP-P-${stamp}`,
    categoryId: catId,
    unit: 'piece',
    costPrice: 1,
    sellingPrice: 2,
  };
  expectValidation(
    await post(tokens.admin, '/api/products', { ...base, sellingPrice: -1 }),
    'sellingPrice',
    'min'
  );
  expectValidation(
    await post(tokens.admin, '/api/products', { ...base, costPrice: 1.234 }),
    'costPrice',
    'invalid'
  );
});

test('duplicate sku -> 409 DUPLICATE_SKU; duplicate barcode -> 409 DUPLICATE_BARCODE', async () => {
  const sku = `TP-DUP-SKU-${stamp}`;
  const barcode = `TP-DUP-BC-${stamp}`;
  const base = {
    name: `${prefix} Dup`,
    sku,
    barcode,
    categoryId: catId,
    unit: 'piece',
    costPrice: 1,
    sellingPrice: 2,
  };
  const first = await post(tokens.admin, '/api/products', base);
  expect(first.status).toBe(201);
  productIds.push(first.body.id);

  const dupSku = await post(tokens.admin, '/api/products', {
    ...base,
    barcode: `TP-OTHER-BC-${stamp}`,
  });
  expect(dupSku.status).toBe(409);
  expect(dupSku.body.error.code).toBe('DUPLICATE_SKU');

  const dupBarcode = await post(tokens.admin, '/api/products', {
    ...base,
    sku: `TP-OTHER-SKU-${stamp}`,
  });
  expect(dupBarcode.status).toBe(409);
  expect(dupBarcode.body.error.code).toBe('DUPLICATE_BARCODE');
});

test('inactive or missing category -> 400 on create', async () => {
  const bad = {
    name: `${prefix} BadCat`,
    sku: `TP-BC-${stamp}`,
    categoryId: 999999999,
    unit: 'piece',
    costPrice: 1,
    sellingPrice: 2,
  };
  expectValidation(await post(tokens.admin, '/api/products', bad), 'categoryId', 'invalid');
});

// ─────────────────────────────────────────────────────────────
// READ — roles + costPrice hiding
// ─────────────────────────────────────────────────────────────
test('Staff never receive costPrice; Admin, Manager and Auditor do', async () => {
  const staff = await get(tokens.staff, `/api/products?q=${encodeURIComponent(prefix)}`);
  expect(staff.status).toBe(200);
  expect(staff.body.data.length).toBeGreaterThan(0);
  staff.body.data.forEach((p) => expect(p).not.toHaveProperty('costPrice'));

  for (const label of ['admin', 'manager', 'auditor']) {
    const res = await get(tokens[label], `/api/products?q=${encodeURIComponent(prefix)}`);
    expect(res.status).toBe(200);
    res.body.data.forEach((p) => expect(p.costPrice).toBeDefined());
  }
});

test('quantity: shown for Staff own branch; Admin only with ?branchId=; Manager own branch', async () => {
  const sku = `TP-QTY-${stamp}`;
  const created = await post(tokens.admin, '/api/products', {
    name: `${prefix} Qty`,
    sku,
    categoryId: catId,
    unit: 'piece',
    costPrice: 1,
    sellingPrice: 2,
  });
  productIds.push(created.body.id);

  // Admin without branchId: no quantity
  const adminNoBranch = await get(tokens.admin, `/api/products/${created.body.id}`);
  expect(adminNoBranch.body).not.toHaveProperty('quantity');

  // Admin with branchId=brA: quantity present (0)
  const adminWithBranch = await get(tokens.admin, `/api/products/${created.body.id}?branchId=${brA}`);
  expect(adminWithBranch.body.quantity).toBe(0);

  // Staff: quantity present (own branch)
  const staff = await get(tokens.staff, `/api/products/${created.body.id}`);
  expect(staff.body.quantity).toBe(0);

  // Manager: quantity present
  const mgr = await get(tokens.manager, `/api/products/${created.body.id}`);
  expect(mgr.body.quantity).toBe(0);
});

test('Staff asking for another branch -> 403', async () => {
  const res = await get(tokens.staff, `/api/products?branchId=${brB}`);
  expect(res.status).toBe(403);
});

// ─────────────────────────────────────────────────────────────
// BARCODE LOOKUP
// ─────────────────────────────────────────────────────────────
test('by-barcode: found / not-found / inactive', async () => {
  const barcode = `TP-BC-LOOKUP-${stamp}`;
  const created = await post(tokens.admin, '/api/products', {
    name: `${prefix} Barcode`,
    sku: `TP-BC-LOOKUP-SKU-${stamp}`,
    barcode,
    categoryId: catId,
    unit: 'piece',
    costPrice: 5,
    sellingPrice: 7,
  });
  productIds.push(created.body.id);

  const found = await get(tokens.admin, `/api/products/by-barcode/${barcode}`);
  expect(found.status).toBe(200);
  expect(found.body.id).toBe(created.body.id);

  const missing = await get(tokens.admin, `/api/products/by-barcode/does-not-exist-${stamp}`);
  expect(missing.status).toBe(404);
  expect(missing.body.error.code).toBe('PRODUCT_NOT_FOUND');

  await patch(tokens.admin, `/api/products/${created.body.id}`, { isActive: false });
  const inactive = await get(tokens.admin, `/api/products/by-barcode/${barcode}`);
  expect(inactive.status).toBe(404);
  expect(inactive.body.error.code).toBe('PRODUCT_NOT_FOUND');
});

// ─────────────────────────────────────────────────────────────
// UPDATE
// ─────────────────────────────────────────────────────────────
test('PATCH changes fields; duplicate sku on PATCH -> 409; missing id -> 404', async () => {
  const a = await post(tokens.admin, '/api/products', {
    name: `${prefix} A`,
    sku: `TP-A-${stamp}`,
    categoryId: catId,
    unit: 'piece',
    costPrice: 1,
    sellingPrice: 2,
  });
  const b = await post(tokens.admin, '/api/products', {
    name: `${prefix} B`,
    sku: `TP-B-${stamp}`,
    categoryId: catId,
    unit: 'piece',
    costPrice: 1,
    sellingPrice: 2,
  });
  productIds.push(a.body.id, b.body.id);

  const ok = await patch(tokens.admin, `/api/products/${a.body.id}`, { sellingPrice: 3 });
  expect(ok.status).toBe(200);
  expect(ok.body.sellingPrice).toBe(3);

  const dupSku = await patch(tokens.admin, `/api/products/${b.body.id}`, {
    sku: `TP-A-${stamp}`,
  });
  expect(dupSku.status).toBe(409);
  expect(dupSku.body.error.code).toBe('DUPLICATE_SKU');

  expect((await patch(tokens.admin, '/api/products/abc', { name: 'x' })).status).toBe(404);
});

// ─────────────────────────────────────────────────────────────
// LIST, SORT, PAGING
// ─────────────────────────────────────────────────────────────
test('sort by sku and -sellingPrice; unknown sort -> 400', async () => {
  const s1 = await get(tokens.admin, `/api/products?sort=sku&q=${encodeURIComponent(prefix)}`);
  expect(s1.status).toBe(200);
  const skus = s1.body.data.map((p) => p.sku);
  expect([...skus].sort()).toEqual(skus);

  const s2 = await get(tokens.admin, `/api/products?sort=-sellingPrice&q=${encodeURIComponent(prefix)}`);
  expect(s2.status).toBe(200);
  const prices = s2.body.data.map((p) => p.sellingPrice);
  expect([...prices].sort((a, b) => b - a)).toEqual(prices);

  expectValidation(await get(tokens.admin, '/api/products?sort=bogus'), 'sort', 'invalid');
});

test('paging: limit=2 returns 2 items and the right total', async () => {
  const res = await get(tokens.admin, `/api/products?q=${encodeURIComponent(prefix)}&limit=2`);
  expect(res.status).toBe(200);
  expect(res.body.data.length).toBe(2);
  expect(res.body.total).toBeGreaterThanOrEqual(2);
  expect(res.body.page).toBe(1);
  expect(res.body.limit).toBe(2);
});

test('search q matches name, sku, barcode; inactive hidden unless includeInactive', async () => {
  const sku = `TP-SEARCH-${stamp}`;
  const barcode = `TP-BC-SEARCH-${stamp}`;
  const created = await post(tokens.admin, '/api/products', {
    name: `${prefix} Search`,
    sku,
    barcode,
    categoryId: catId,
    unit: 'piece',
    costPrice: 1,
    sellingPrice: 2,
  });
  productIds.push(created.body.id);

  expect((await get(tokens.admin, `/api/products?q=${sku}`)).body.total).toBeGreaterThanOrEqual(1);
  expect((await get(tokens.admin, `/api/products?q=${barcode}`)).body.total).toBeGreaterThanOrEqual(1);

  await patch(tokens.admin, `/api/products/${created.body.id}`, { isActive: false });
  const hidden = await get(tokens.admin, `/api/products?q=${sku}`);
  expect(hidden.body.total).toBe(0);
  const shown = await get(tokens.admin, `/api/products?q=${sku}&includeInactive=true`);
  expect(shown.body.total).toBeGreaterThanOrEqual(1);
});