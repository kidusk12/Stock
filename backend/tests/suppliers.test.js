// backend/tests/suppliers.test.js
// Follows docs/api-contract.md v5 section 5.3. Self-contained; cleans up in afterAll.
require('dotenv').config();
const request = require('supertest');
const bcrypt = require('bcryptjs');
const app = require('../src/app');
const prisma = require('../src/config/db');

jest.setTimeout(60000);

const stamp = Date.now();
const prefix = `Test Supplier ${stamp}`;
const bearer = (t) => ({ Authorization: `Bearer ${t}` });
const get = (t, path) => request(app).get(path).set(bearer(t));
const post = (t, path, body) => request(app).post(path).set(bearer(t)).send(body);
const patch = (t, path, body) => request(app).patch(path).set(bearer(t)).send(body);
const login = (u, p) => request(app).post('/api/auth/login').send({ username: u, password: p });

const tokens = {};
const userIds = [];
const supplierIds = [];

function expectValidation(res, field, rule) {
  expect(res.status).toBe(400);
  expect(res.body.error.code).toBe('VALIDATION_ERROR');
  expect(res.body.error.details[0].field).toBe(field);
  expect(res.body.error.details[0].rule).toBe(rule);
}

async function createUser(label, role, branchId = null) {
  const user = await prisma.user.create({
    data: {
      username: `test-supplier-${label}-${stamp}`,
      passwordHash: await bcrypt.hash('Test12345', 10),
      fullName: `Supplier Test ${label}`,
      role,
      branchId,
    },
  });
  userIds.push(user.id);
  tokens[label] = (await login(user.username, 'Test12345')).body.token;
  return user;
}

beforeAll(async () => {
  // Defensive cleanup from any prior failed run
  const stale = await prisma.supplier.findMany({
    where: { name: { startsWith: 'Test Supplier' } },
    select: { id: true },
  });
  if (stale.length) {
    await prisma.supplier.deleteMany({ where: { id: { in: stale.map((s) => s.id) } } });
  }

  tokens.admin = (await login('admin', 'Admin123!')).body.token;
  await createUser('manager', 'BRANCH_MANAGER');
  await createUser('staff', 'STAFF');
  await createUser('auditor', 'AUDITOR');
});

afterAll(async () => {
  await prisma.supplier.deleteMany({ where: { name: { startsWith: prefix } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.$disconnect();
});

test('roles: Auditor 403 on everything; Staff read-only; Manager writes; Admin writes', async () => {
  expect((await request(app).get('/api/suppliers')).status).toBe(401);

  // Auditor: 403 on read and write
  expect((await get(tokens.auditor, '/api/suppliers')).status).toBe(403);
  expect((await post(tokens.auditor, '/api/suppliers', { name: `${prefix} Aud` })).status).toBe(403);

  // Staff: read OK, write 403
  expect((await get(tokens.staff, '/api/suppliers')).status).toBe(200);
  expect((await post(tokens.staff, '/api/suppliers', { name: `${prefix} Staff` })).status).toBe(403);

  // Manager: read OK, write OK
  const mgr = await post(tokens.manager, '/api/suppliers', { name: `${prefix} Mgr` });
  expect(mgr.status).toBe(201);
  supplierIds.push(mgr.body.id);

  // Admin: read OK, write OK
  const adm = await post(tokens.admin, '/api/suppliers', { name: `${prefix} Adm` });
  expect(adm.status).toBe(201);
  supplierIds.push(adm.body.id);
});

test('create 201, returns all fields; name required', async () => {
  const payload = {
    name: `${prefix} Full`,
    contactName: 'Jane',
    phone: '+251911000111',
    tin: `TIN-${stamp}`,
    address: 'Addis Ababa',
  };
  const res = await post(tokens.admin, '/api/suppliers', payload);
  expect(res.status).toBe(201);
  expect(res.body).toMatchObject({ ...payload, isActive: true });
  supplierIds.push(res.body.id);

  expectValidation(await post(tokens.admin, '/api/suppliers', {}), 'name', 'required');
  expectValidation(
    await post(tokens.admin, '/api/suppliers', { name: 'x'.repeat(151) }),
    'name',
    'too_long'
  );
});

test('G3: two suppliers with the same name are allowed', async () => {
  const name = `${prefix} Same-Name`;
  const a = await post(tokens.admin, '/api/suppliers', { name });
  const b = await post(tokens.admin, '/api/suppliers', { name });
  expect(a.status).toBe(201);
  expect(b.status).toBe(201);
  supplierIds.push(a.body.id, b.body.id);
});

test('search by name and TIN (case-insensitive)', async () => {
  const tin = `TIN-SEARCH-${stamp}`;
  const created = await post(tokens.admin, '/api/suppliers', {
    name: `${prefix} Search Me`,
    tin,
  });
  supplierIds.push(created.body.id);

  const byName = await get(
    tokens.admin,
    `/api/suppliers?q=${encodeURIComponent(`${prefix.toLowerCase()} search`)}`
  );
  expect(byName.body.total).toBeGreaterThanOrEqual(1);

  const byTin = await get(tokens.admin, `/api/suppliers?q=${encodeURIComponent(tin.toLowerCase())}`);
  expect(byTin.body.total).toBeGreaterThanOrEqual(1);
  expect(byTin.body.data.some((s) => s.tin === tin)).toBe(true);
});

test('isActive toggle hides from default list; includeInactive shows it', async () => {
  const created = await post(tokens.admin, '/api/suppliers', { name: `${prefix} Inactive` });
  supplierIds.push(created.body.id);
  await patch(tokens.admin, `/api/suppliers/${created.body.id}`, { isActive: false });

  const hidden = await get(
    tokens.admin,
    `/api/suppliers?q=${encodeURIComponent(`${prefix} Inactive`)}`
  );
  expect(hidden.body.total).toBe(0);

  const shown = await get(
    tokens.admin,
    `/api/suppliers?q=${encodeURIComponent(`${prefix} Inactive`)}&includeInactive=true`
  );
  expect(shown.body.total).toBe(1);
});

test('bad id -> 404; unknown id -> 404; PATCH requires a field', async () => {
  expect((await get(tokens.admin, '/api/suppliers/abc')).status).toBe(404);
  expect((await get(tokens.admin, '/api/suppliers/999999999')).status).toBe(404);

  const created = await post(tokens.admin, '/api/suppliers', { name: `${prefix} Patch` });
  supplierIds.push(created.body.id);
  expectValidation(
    await patch(tokens.admin, `/api/suppliers/${created.body.id}`, {}),
    'body',
    'invalid'
  );
});