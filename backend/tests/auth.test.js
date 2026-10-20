// Needs the seeded users (npm run seed): admin / Admin123!, and the branch MAIN
// Follows docs/api-contract.md v5, section 3 (responses have no { data } wrapper).
require('dotenv').config();
const request = require('supertest');
const bcrypt = require('bcryptjs');
const app = require('../src/app');
const prisma = require('../src/config/db');

jest.setTimeout(30000);

const stamp = Date.now();
const tempUserIds = [];

async function createUser(role, branchId = null) {
  const user = await prisma.user.create({
    data: {
      username: `test-auth-${role.toLowerCase()}-${stamp}-${tempUserIds.length}`,
      passwordHash: await bcrypt.hash('Test12345', 10),
      fullName: 'Auth Test',
      role,
      branchId,
    },
  });
  tempUserIds.push(user.id);
  return user;
}

const login = (username, password = 'Test12345') =>
  request(app).post('/api/auth/login').send({ username, password });
const bearer = (token) => ({ Authorization: `Bearer ${token}` });

afterAll(async () => {
  // Logout writes audit entries that point at the test users, so delete those first.
  // Done by name prefix, so leftovers from a failed earlier run are cleaned too.
  await prisma.auditLog.deleteMany({ where: { user: { username: { startsWith: 'test-auth-' } } } });
  await prisma.user.deleteMany({ where: { username: { startsWith: 'test-auth-' } } });
  await prisma.$disconnect();
});

test('health check works', async () => {
  const res = await request(app).get('/api/health');
  expect(res.status).toBe(200);
  expect(res.body.status).toBe('ok');
});

test('login returns token, expiresAt and user; /me returns the same user', async () => {
  const res = await login('admin', 'Admin123!');
  expect(res.status).toBe(200);
  expect(res.body.token).toBeTruthy();
  expect(Date.parse(res.body.expiresAt)).toBeGreaterThan(Date.now());
  expect(res.body.user.role).toBe('ADMIN');
  expect(res.body.user.branchId).toBeNull();
  expect(res.body.user.branchName).toBeNull();

  const me = await request(app).get('/api/auth/me').set(bearer(res.body.token));
  expect(me.status).toBe(200);
  expect(me.body.username).toBe('admin');
});

test('login with a missing password is a 400 VALIDATION_ERROR', async () => {
  const res = await request(app).post('/api/auth/login').send({ username: 'admin' });
  expect(res.status).toBe(400);
  expect(res.body.error.code).toBe('VALIDATION_ERROR');
});

test('wrong password, missing token and bad token use the right codes', async () => {
  const bad = await login('admin', 'nope');
  expect(bad.status).toBe(401);
  expect(bad.body.error.code).toBe('INVALID_CREDENTIALS');

  const none = await request(app).get('/api/auth/me');
  expect(none.status).toBe(401);
  expect(none.body.error.code).toBe('UNAUTHENTICATED');

  const garbage = await request(app).get('/api/auth/me').set(bearer('not-a-real-token'));
  expect(garbage.status).toBe(401);
  expect(garbage.body.error.code).toBe('UNAUTHENTICATED');
});

test('a deactivated user is blocked on the very next request with ACCOUNT_DISABLED', async () => {
  const user = await createUser('STAFF');
  const first = await login(user.username);
  expect(first.status).toBe(200);
  const auth = bearer(first.body.token);
  expect((await request(app).get('/api/auth/me').set(auth)).status).toBe(200);

  await prisma.user.update({ where: { id: user.id }, data: { isActive: false } });

  const after = await request(app).get('/api/auth/me').set(auth);
  expect(after.status).toBe(403);
  expect(after.body.error.code).toBe('ACCOUNT_DISABLED');

  const again = await login(user.username);
  expect(again.status).toBe(403);
  expect(again.body.error.code).toBe('ACCOUNT_DISABLED');
});

test('change password: wrong current is 400, short new is 400, success works', async () => {
  const user = await createUser('STAFF');
  const auth = bearer((await login(user.username)).body.token);
  const change = (body) => request(app).post('/api/auth/change-password').set(auth).send(body);

  const wrong = await change({ currentPassword: 'wrong', newPassword: 'Another1234' });
  expect(wrong.status).toBe(400);
  expect(wrong.body.error.code).toBe('WRONG_CURRENT_PASSWORD');

  const short = await change({ currentPassword: 'Test12345', newPassword: 'short' });
  expect(short.status).toBe(400);
  expect(short.body.error.code).toBe('VALIDATION_ERROR');

  const ok = await change({ currentPassword: 'Test12345', newPassword: 'Another1234' });
  expect(ok.status).toBe(200);
  expect(ok.body).toEqual({ success: true });

  expect((await login(user.username, 'Test12345')).status).toBe(401);
  expect((await login(user.username, 'Another1234')).status).toBe(200);
});

test('logout returns { success: true }', async () => {
  const user = await createUser('STAFF');
  const auth = bearer((await login(user.username)).body.token);
  const res = await request(app).post('/api/auth/logout').set(auth);
  expect(res.status).toBe(200);
  expect(res.body).toEqual({ success: true });
});

test('logout writes a USER_LOGOUT audit entry for the user and their branch', async () => {
  const main = await prisma.branch.findUnique({ where: { code: 'MAIN' } });
  const user = await createUser('STAFF', main.id);
  const auth = bearer((await login(user.username)).body.token);

  const before = await prisma.auditLog.count({ where: { userId: user.id, action: 'USER_LOGOUT' } });
  expect((await request(app).post('/api/auth/logout').set(auth)).status).toBe(200);

  const entries = await prisma.auditLog.findMany({ where: { userId: user.id, action: 'USER_LOGOUT' } });
  expect(entries).toHaveLength(before + 1);
  expect(entries[0].entityType).toBe('USER');
  expect(entries[0].entityId).toBe(user.id);
  expect(entries[0].branchId).toBe(main.id);
});

test('an Auditor can log out and change password, but every other write is 403', async () => {
  const user = await createUser('AUDITOR');
  const auth = bearer((await login(user.username)).body.token);

  expect((await request(app).post('/api/auth/logout').set(auth)).status).toBe(200);

  const change = await request(app)
    .post('/api/auth/change-password')
    .set(auth)
    .send({ currentPassword: 'Test12345', newPassword: 'Another1234' });
  expect(change.status).toBe(200);

  const write = await request(app).post('/api/anything').set(auth).send({});
  expect(write.status).toBe(403);
  expect(write.body.error.code).toBe('FORBIDDEN');

  const read = await request(app).get('/api/anything').set(auth);
  expect(read.status).toBe(404);
});