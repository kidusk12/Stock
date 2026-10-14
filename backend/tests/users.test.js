// Needs the seeded users (npm run seed): admin / Admin123!
// Follows docs/api-contract.md section 4. Creates its own branch and users, and deletes them at the end.
require('dotenv').config();
const request = require('supertest');
const app = require('../src/app');
const prisma = require('../src/config/db');

jest.setTimeout(30000);

const stamp = Date.now();
const prefix = `test-users-${stamp}`;
let counter = 0;
let branch;
let admin; // { token, id }

const nextName = () => `${prefix}-${++counter}`;
const bearer = (token) => ({ Authorization: `Bearer ${token}` });
const login = (username, password) => request(app).post('/api/auth/login').send({ username, password });

const adminGet = (path) => request(app).get(path).set(bearer(admin.token));
const adminPost = (path, body) => request(app).post(path).set(bearer(admin.token)).send(body);
const adminPatch = (path, body) => request(app).patch(path).set(bearer(admin.token)).send(body);

const newUser = (overrides = {}) =>
  adminPost('/api/users', {
    username: nextName(),
    fullName: 'Users Test',
    password: 'Temp12345',
    role: 'STAFF',
    branchId: branch.id,
    ...overrides,
  });

beforeAll(async () => {
  branch = await prisma.branch.create({ data: { name: `Test Branch ${stamp}`, code: `TU${stamp}` } });
  const res = await login('admin', 'Admin123!');
  admin = { token: res.body.token, id: res.body.user.id };
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { username: { startsWith: prefix } } });
  await prisma.branch.delete({ where: { id: branch.id } });
  await prisma.$disconnect();
});

test('only an Admin can use the users endpoints', async () => {
  const noToken = await request(app).get('/api/users');
  expect(noToken.status).toBe(401);
  expect(noToken.body.error.code).toBe('UNAUTHENTICATED');

  for (const role of ['STAFF', 'BRANCH_MANAGER', 'AUDITOR']) {
    const created = await newUser({ role, branchId: role === 'AUDITOR' ? null : branch.id });
    expect(created.status).toBe(201);
    const token = (await login(created.body.username, 'Temp12345')).body.token;

    const res = await request(app).get('/api/users').set(bearer(token));
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  }
});

test('POST creates a user and never returns the password hash', async () => {
  const res = await newUser({ fullName: 'Abel Test' });
  expect(res.status).toBe(201);
  expect(res.body.fullName).toBe('Abel Test');
  expect(res.body.role).toBe('STAFF');
  expect(res.body.branchId).toBe(branch.id);
  expect(res.body.branchName).toBe(branch.name);
  expect(res.body.isActive).toBe(true);
  expect(res.body).not.toHaveProperty('passwordHash');
  expect(res.body).not.toHaveProperty('password');
});

test('POST rejects bad input with the right codes', async () => {
  const shortPassword = await newUser({ password: 'short' });
  expect(shortPassword.status).toBe(400);
  expect(shortPassword.body.error.code).toBe('VALIDATION_ERROR');

  const missingName = await adminPost('/api/users', { username: nextName(), password: 'Temp12345', role: 'STAFF', branchId: branch.id });
  expect(missingName.status).toBe(400);
  expect(missingName.body.error.code).toBe('VALIDATION_ERROR');

  const staffNoBranch = await newUser({ branchId: null });
  expect(staffNoBranch.status).toBe(400);
  expect(staffNoBranch.body.error.code).toBe('VALIDATION_ERROR');

  const adminWithBranch = await newUser({ role: 'ADMIN' });
  expect(adminWithBranch.status).toBe(400);
  expect(adminWithBranch.body.error.code).toBe('VALIDATION_ERROR');

  const first = await newUser();
  const duplicate = await newUser({ username: first.body.username });
  expect(duplicate.status).toBe(409);
  expect(duplicate.body.error.code).toBe('DUPLICATE_VALUE');

  const unknownBranch = await newUser({ branchId: 999999999 });
  expect(unknownBranch.status).toBe(404);
  expect(unknownBranch.body.error.code).toBe('NOT_FOUND');
});

test('a new user can log in with the password the Admin set', async () => {
  const created = await newUser();
  const res = await login(created.body.username, 'Temp12345');
  expect(res.status).toBe(200);
  expect(res.body.user.branchName).toBe(branch.name);
});

test('GET list is paginated, searchable and hides the hash', async () => {
  const created = await newUser({ fullName: 'Searchable Person' });
  const res = await adminGet(`/api/users?q=${encodeURIComponent(created.body.username)}`);
  expect(res.status).toBe(200);
  expect(res.body.page).toBe(1);
  expect(res.body.limit).toBe(20);
  expect(res.body.total).toBe(1);
  expect(res.body.data[0].username).toBe(created.body.username);
  expect(res.body.data[0]).not.toHaveProperty('passwordHash');

  const byRole = await adminGet(`/api/users?q=${prefix}&role=AUDITOR`);
  expect(byRole.status).toBe(200);
  byRole.body.data.forEach((u) => expect(u.role).toBe('AUDITOR'));
});

test('GET list rejects a bad role and a bad limit', async () => {
  const badRole = await adminGet('/api/users?role=KING');
  expect(badRole.status).toBe(400);
  expect(badRole.body.error.code).toBe('VALIDATION_ERROR');

  const badLimit = await adminGet('/api/users?limit=101');
  expect(badLimit.status).toBe(400);
  expect(badLimit.body.error.code).toBe('VALIDATION_ERROR');
});

test('GET by id returns the user, and 404 for unknown or bad ids', async () => {
  const created = await newUser();
  const ok = await adminGet(`/api/users/${created.body.id}`);
  expect(ok.status).toBe(200);
  expect(ok.body.username).toBe(created.body.username);

  const unknown = await adminGet('/api/users/999999999');
  expect(unknown.status).toBe(404);
  expect(unknown.body.error.code).toBe('NOT_FOUND');

  expect((await adminGet('/api/users/abc')).status).toBe(404);
});

test('PATCH changes fields, clears the branch for an Admin, and rejects an empty body', async () => {
  const created = (await newUser()).body;
  const url = `/api/users/${created.id}`;

  const renamed = await adminPatch(url, { fullName: 'Renamed Person' });
  expect(renamed.status).toBe(200);
  expect(renamed.body.fullName).toBe('Renamed Person');

  expect((await adminPatch(url, {})).status).toBe(400);

  const toAdmin = await adminPatch(url, { role: 'ADMIN' });
  expect(toAdmin.status).toBe(200);
  expect(toAdmin.body.role).toBe('ADMIN');
  expect(toAdmin.body.branchId).toBeNull();
  expect(toAdmin.body.branchName).toBeNull();

  const backWithoutBranch = await adminPatch(url, { role: 'STAFF' });
  expect(backWithoutBranch.status).toBe(400);
  expect(backWithoutBranch.body.error.code).toBe('VALIDATION_ERROR');

  const backOk = await adminPatch(url, { role: 'STAFF', branchId: branch.id });
  expect(backOk.status).toBe(200);
  expect(backOk.body.branchId).toBe(branch.id);

  const unknownBranch = await adminPatch(url, { branchId: 999999999 });
  expect(unknownBranch.status).toBe(404);

  const unknownUser = await adminPatch('/api/users/999999999', { fullName: 'Nobody' });
  expect(unknownUser.status).toBe(404);
});

test('deactivating blocks login and hides the user from the default list', async () => {
  const created = (await newUser()).body;
  const url = `/api/users/${created.id}`;

  const off = await adminPatch(url, { isActive: false });
  expect(off.status).toBe(200);
  expect(off.body.isActive).toBe(false);

  const blocked = await login(created.username, 'Temp12345');
  expect(blocked.status).toBe(403);
  expect(blocked.body.error.code).toBe('ACCOUNT_DISABLED');

  expect((await adminGet(`/api/users?q=${created.username}`)).body.total).toBe(0);
  expect((await adminGet(`/api/users?q=${created.username}&includeInactive=true`)).body.total).toBe(1);
  expect((await adminGet(url)).status).toBe(200);
});

test('an Admin cannot deactivate their own account', async () => {
  const res = await adminPatch(`/api/users/${admin.id}`, { isActive: false });
  expect(res.status).toBe(400);
  expect(res.body.error.code).toBe('VALIDATION_ERROR');

  expect((await adminGet('/api/auth/me')).status).toBe(200);
});

test('reset-password sets a new password the user can log in with', async () => {
  const created = (await newUser()).body;
  const url = `/api/users/${created.id}/reset-password`;

  const short = await adminPost(url, { newPassword: 'short' });
  expect(short.status).toBe(400);
  expect(short.body.error.code).toBe('VALIDATION_ERROR');

  const ok = await adminPost(url, { newPassword: 'Another1234' });
  expect(ok.status).toBe(200);
  expect(ok.body).toEqual({ success: true });

  expect((await login(created.username, 'Temp12345')).status).toBe(401);
  expect((await login(created.username, 'Another1234')).status).toBe(200);

  expect((await adminPost('/api/users/999999999/reset-password', { newPassword: 'Another1234' })).status).toBe(404);
});