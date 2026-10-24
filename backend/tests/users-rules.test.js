// Contract v6, section 4: the single Admin rule, and the password length limit.
// Creates its own Auditor users and deletes them at the end. Needs the seeded admin (npm run seed).
require('dotenv').config();
const request = require('supertest');
const app = require('../src/app');
const prisma = require('../src/config/db');

jest.setTimeout(60000);

const stamp = Date.now();
const startedAt = new Date();
const createdIds = [];
let adminToken;
let admin;

const bearer = (token) => ({ Authorization: `Bearer ${token}` });
const login = (username, password) => request(app).post('/api/auth/login').send({ username, password });
const post = (path, body) => request(app).post(path).set(bearer(adminToken)).send(body);
const patch = (path, body) => request(app).patch(path).set(bearer(adminToken)).send(body);

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

async function createAuditor(label) {
  const res = await post('/api/users', {
    username: `test-rules-${label}-${stamp}`,
    fullName: `Rules Test ${label}`,
    password: 'Test12345',
    role: 'AUDITOR',
  });
  expect(res.status).toBe(201);
  createdIds.push(res.body.id);
  return res.body;
}

beforeAll(async () => {
  adminToken = (await login('admin', 'Admin123!')).body.token;
  admin = await prisma.user.findUnique({ where: { username: 'admin' } });
});

afterAll(async () => {
  await prisma.auditLog.deleteMany({
    where: {
      OR: [
        { entityType: 'USER', entityId: { in: createdIds } },
        { userId: { in: createdIds } },
        { entityType: 'USER', entityId: admin.id, createdAt: { gte: startedAt } },
      ],
    },
  });
  await prisma.user.deleteMany({ where: { id: { in: createdIds } } });
  await prisma.$disconnect();
});

test('an Admin cannot be created: 400 on role', async () => {
  const before = await prisma.user.count({ where: { role: 'ADMIN' } });
  const res = await post('/api/users', {
    username: `test-rules-admin-${stamp}`,
    fullName: 'Second Admin',
    password: 'Test12345',
    role: 'ADMIN',
  });
  expectValidation(res, 'role', 'invalid');
  expect(await prisma.user.count({ where: { role: 'ADMIN' } })).toBe(before);
});

test('a user cannot be promoted to Admin: 400 on role', async () => {
  const user = await createAuditor('promote');
  expectValidation(await patch(`/api/users/${user.id}`, { role: 'ADMIN' }), 'role', 'invalid');
  expect((await prisma.user.findUnique({ where: { id: user.id } })).role).toBe('AUDITOR');
});

test('the Admin account cannot be reassigned or deactivated, not even by itself: 403', async () => {
  const branch = await prisma.branch.findFirst();
  const url = `/api/users/${admin.id}`;

  expectError(await patch(url, { role: 'AUDITOR' }), 403, 'FORBIDDEN');
  expectError(await patch(url, { role: 'STAFF', branchId: branch.id }), 403, 'FORBIDDEN');
  expectError(await patch(url, { branchId: branch.id }), 403, 'FORBIDDEN');
  expectError(await patch(url, { isActive: false }), 403, 'FORBIDDEN');

  const saved = await prisma.user.findUnique({ where: { id: admin.id } });
  expect(saved.role).toBe('ADMIN');
  expect(saved.branchId).toBeNull();
  expect(saved.isActive).toBe(true);
});

test('the Admin fullName can change, and fields sent with their current value are ignored', async () => {
  const url = `/api/users/${admin.id}`;
  const original = admin.fullName;

  const same = await patch(url, { fullName: original, role: 'ADMIN', branchId: null, isActive: true });
  expect(same.status).toBe(200);
  expect(same.body).toMatchObject({ role: 'ADMIN', branchId: null, isActive: true, fullName: original });

  const renamed = await patch(url, { fullName: `Renamed Admin ${stamp}` });
  expect(renamed.status).toBe(200);
  expect(renamed.body.fullName).toBe(`Renamed Admin ${stamp}`);

  const restored = await patch(url, { fullName: original });
  expect(restored.status).toBe(200);
  expect(restored.body.fullName).toBe(original);
});

test('the Admin password cannot be reset through the Users endpoint; other users can be', async () => {
  expectError(
    await post(`/api/users/${admin.id}/reset-password`, { newPassword: 'Another1234' }),
    403,
    'FORBIDDEN'
  );
  expect((await login('admin', 'Admin123!')).status).toBe(200); // the password did not change

  const user = await createAuditor('reset');
  const ok = await post(`/api/users/${user.id}/reset-password`, { newPassword: 'Another1234' });
  expect(ok.status).toBe(200);
  expect((await login(user.username, 'Another1234')).status).toBe(200);

  // Other users can still be deactivated and reactivated
  expect((await patch(`/api/users/${user.id}`, { isActive: false })).body.isActive).toBe(false);
  expect((await patch(`/api/users/${user.id}`, { isActive: true })).body.isActive).toBe(true);
});

test('a password over 72 characters is 400, on create and on reset', async () => {
  const tooLong = 'x'.repeat(73);
  expectValidation(
    await post('/api/users', {
      username: `test-rules-long-${stamp}`,
      fullName: 'Long Password',
      password: tooLong,
      role: 'AUDITOR',
    }),
    'password',
    'too_long'
  );

  const user = await createAuditor('long');
  expectValidation(await post(`/api/users/${user.id}/reset-password`, { newPassword: tooLong }), 'newPassword', 'too_long');

  const ok = await post(`/api/users/${user.id}/reset-password`, { newPassword: 'y'.repeat(72) });
  expect(ok.status).toBe(200);
});