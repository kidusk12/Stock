// backend/tests/branches.test.js
// Follows docs/api-contract.md v5 section 5.1. Creates its own data and cleans up.
require('dotenv').config();
const request = require('supertest');
const bcrypt = require('bcryptjs');
const app = require('../src/app');
const prisma = require('../src/config/db');

jest.setTimeout(60000);

const stamp = Date.now();
const prefix = `Test Branch ${stamp}`;
const bearer = (t) => ({ Authorization: `Bearer ${t}` });
const get = (t, path) => request(app).get(path).set(bearer(t));
const post = (t, path, body) => request(app).post(path).set(bearer(t)).send(body);
const patch = (t, path, body) => request(app).patch(path).set(bearer(t)).send(body);
const login = (u, p) => request(app).post('/api/auth/login').send({ username: u, password: p });

const tokens = {};
const userIds = [];
const branchIds = [];

function expectValidation(res, field, rule) {
  expect(res.status).toBe(400);
  expect(res.body.error.code).toBe('VALIDATION_ERROR');
  expect(res.body.error.details[0].field).toBe(field);
  expect(res.body.error.details[0].rule).toBe(rule);
}

async function createUser(label, role, branchId = null) {
  const user = await prisma.user.create({
    data: {
      username: `test-branch-${label}-${stamp}`,
      passwordHash: await bcrypt.hash('Test12345', 10),
      fullName: `Branch Test ${label}`,
      role,
      branchId,
    },
  });
  userIds.push(user.id);
  tokens[label] = (await login(user.username, 'Test12345')).body.token;
  return user;
}

beforeAll(async () => {
  tokens.admin = (await login('admin', 'Admin123!')).body.token;
  await createUser('manager', 'BRANCH_MANAGER');
  await createUser('staff', 'STAFF');
  await createUser('auditor', 'AUDITOR');
});

afterAll(async () => {
  await prisma.branchStock.deleteMany({ where: { branchId: { in: branchIds } } });
  await prisma.branch.deleteMany({ where: { id: { in: branchIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.$disconnect();
});

test('roles: reads allowed for all; writes only for Admin', async () => {
  expect((await request(app).get('/api/branches')).status).toBe(401);

  for (const label of ['admin', 'manager', 'staff', 'auditor']) {
    expect((await get(tokens[label], '/api/branches')).status).toBe(200);
  }

  for (const label of ['manager', 'staff', 'auditor']) {
    const res = await post(tokens[label], '/api/branches', {
      name: `${prefix} ${label}`,
      code: `T${label[0].toUpperCase()}${stamp}`.slice(0, 15),
    });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  }
});

test('create 201, code required (G1), no spaces in code, duplicate -> 409 DUPLICATE_VALUE', async () => {
  const code = `TA${stamp}`.slice(0, 15);
  const created = await post(tokens.admin, '/api/branches', { name: `${prefix} A`, code });
  expect(created.status).toBe(201);
  expect(created.body).toMatchObject({
    id: expect.any(Number),
    name: `${prefix} A`,
    code,
    isActive: true,
  });
  branchIds.push(created.body.id);

  // duplicate code -> 409
  const dup = await post(tokens.admin, '/api/branches', { name: `${prefix} Dup`, code });
  expect(dup.status).toBe(409);
  expect(dup.body.error.code).toBe('DUPLICATE_VALUE');

  // duplicate name -> 409
  const dupName = await post(tokens.admin, '/api/branches', {
    name: `${prefix} A`,
    code: `TB${stamp}`.slice(0, 15),
  });
  expect(dupName.status).toBe(409);
  expect(dupName.body.error.code).toBe('DUPLICATE_VALUE');

  // missing code -> 400 required
  expectValidation(
    await post(tokens.admin, '/api/branches', { name: `${prefix} NoCode` }),
    'code',
    'required'
  );

  // code with space -> 400 invalid
  expectValidation(
    await post(tokens.admin, '/api/branches', { name: `${prefix} Spacey`, code: 'BAD CODE' }),
    'code',
    'invalid'
  );
});

test('creating a branch creates one qty-0 stock row per existing product', async () => {
  const before = await prisma.product.count();
  const code = `TK${stamp}`.slice(0, 15);
  const created = await post(tokens.admin, '/api/branches', { name: `${prefix} K6`, code });
  expect(created.status).toBe(201);
  branchIds.push(created.body.id);

  const rows = await prisma.branchStock.findMany({ where: { branchId: created.body.id } });
  expect(rows.length).toBe(before);
  rows.forEach((r) => expect(r.quantity.toNumber()).toBe(0));
});

test('isActive toggle hides from default list; includeInactive shows it', async () => {
  const code = `TI${stamp}`.slice(0, 15);
  const created = await post(tokens.admin, '/api/branches', { name: `${prefix} Inactive`, code });
  branchIds.push(created.body.id);

  await patch(tokens.admin, `/api/branches/${created.body.id}`, { isActive: false });

  const hidden = await get(tokens.admin, `/api/branches?q=${encodeURIComponent(`${prefix} Inactive`)}`);
  expect(hidden.body.total).toBe(0);

  const shown = await get(
    tokens.admin,
    `/api/branches?q=${encodeURIComponent(`${prefix} Inactive`)}&includeInactive=true`
  );
  expect(shown.body.total).toBe(1);
});

test('bad id -> 404; unknown id -> 404; PATCH requires a field', async () => {
  expect((await get(tokens.admin, '/api/branches/abc')).status).toBe(404);
  expect((await get(tokens.admin, '/api/branches/999999999')).status).toBe(404);

  const code = `TP${stamp}`.slice(0, 15);
  const created = await post(tokens.admin, '/api/branches', { name: `${prefix} Patch`, code });
  branchIds.push(created.body.id);
  expectValidation(
    await patch(tokens.admin, `/api/branches/${created.body.id}`, {}),
    'body',
    'invalid'
  );
});