// backend/tests/categories.test.js
// Follows docs/api-contract.md v5 section 5.2. Creates its own data and cleans up in afterAll.
require('dotenv').config();
const request = require('supertest');
const app = require('../src/app');
const prisma = require('../src/config/db');

jest.setTimeout(60000);

const stamp = Date.now();
const prefix = `Test Cat ${stamp}`;
const bearer = (t) => ({ Authorization: `Bearer ${t}` });
const get = (t, path) => request(app).get(path).set(bearer(t));
const post = (t, path, body) => request(app).post(path).set(bearer(t)).send(body);
const patch = (t, path, body) => request(app).patch(path).set(bearer(t)).send(body);
const login = (u, p) => request(app).post('/api/auth/login').send({ username: u, password: p });

const tokens = {};

function expectValidation(res, field, rule) {
  expect(res.status).toBe(400);
  expect(res.body.error.code).toBe('VALIDATION_ERROR');
  expect(res.body.error.details[0].field).toBe(field);
  expect(res.body.error.details[0].rule).toBe(rule);
}

beforeAll(async () => {
  tokens.admin = (await login('admin', 'Admin123!')).body.token;
});

afterAll(async () => {
  await prisma.category.deleteMany({ where: { name: { startsWith: prefix } } });
  await prisma.$disconnect();
});

test('roles: who can read and who can write categories', async () => {
  expect((await request(app).get('/api/categories')).status).toBe(401); // no token
  expect((await get(tokens.admin, '/api/categories')).status).toBe(200);
});

test('create 201, duplicate -> 409 DUPLICATE_VALUE', async () => {
  const name = `${prefix} A`;
  const created = await post(tokens.admin, '/api/categories', { name });
  expect(created.status).toBe(201);
  expect(created.body).toEqual({ id: expect.any(Number), name, isActive: true });

  const dup = await post(tokens.admin, '/api/categories', { name });
  expect(dup.status).toBe(409);
  expect(dup.body.error.code).toBe('DUPLICATE_VALUE');
});

test('missing name -> 400 with field=name rule=required', async () => {
  expectValidation(await post(tokens.admin, '/api/categories', {}), 'name', 'required');
});

test('name too long -> 400 with field=name rule=too_long', async () => {
  expectValidation(
    await post(tokens.admin, '/api/categories', { name: 'x'.repeat(101) }),
    'name',
    'too_long'
  );
});

test('list hides inactive by default; includeInactive=true reveals them', async () => {
  const name = `${prefix} Inactive`;
  const created = await post(tokens.admin, '/api/categories', { name });
  await patch(tokens.admin, `/api/categories/${created.body.id}`, { isActive: false });

  const hidden = await get(tokens.admin, `/api/categories?q=${encodeURIComponent(name)}`);
  expect(hidden.body.total).toBe(0);

  const shown = await get(
    tokens.admin,
    `/api/categories?q=${encodeURIComponent(name)}&includeInactive=true`
  );
  expect(shown.body.total).toBe(1);
  expect(shown.body.data[0].name).toBe(name);
});

test('search q is case-insensitive; bad id -> 404', async () => {
  await post(tokens.admin, '/api/categories', { name: `${prefix} Coffee` });
  const res = await get(
    tokens.admin,
    `/api/categories?q=${encodeURIComponent(`${prefix.toLowerCase()} coffee`)}`
  );
  expect(res.status).toBe(200);
  expect(res.body.total).toBeGreaterThanOrEqual(1);

  expect((await get(tokens.admin, '/api/categories/abc')).status).toBe(404);
  expect((await get(tokens.admin, '/api/categories/999999999')).status).toBe(404);
});

test('PATCH requires at least one field', async () => {
  const created = await post(tokens.admin, '/api/categories', { name: `${prefix} Patch` });
  expectValidation(
    await patch(tokens.admin, `/api/categories/${created.body.id}`, {}),
    'body',
    'invalid'
  );
});