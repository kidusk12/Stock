// Needs the seeded users (npm run seed): admin / Admin123!
// Tests the single-Admin rule (T1)
require('dotenv').config();
const request = require('supertest');
const app = require('../src/app');
const prisma = require('../src/config/db');

jest.setTimeout(30000);

const stamp = Date.now();
const prefix = `test-admin-rule-${stamp}`;
let branch;
let admin; // { token, id }

const bearer = (token) => ({ Authorization: `Bearer ${token}` });
const login = (username, password) => request(app).post('/api/auth/login').send({ username, password });
const adminPost = (path, body) => request(app).post(path).set(bearer(admin.token)).send(body);
const adminPatch = (path, body) => request(app).patch(path).set(bearer(admin.token)).send(body);

beforeAll(async () => {
  branch = await prisma.branch.create({ data: { name: `Test Branch ${stamp}`, code: `TA${stamp}` } });
  const res = await login('admin', 'Admin123!');
  admin = { token: res.body.token, id: res.body.user.id };
});

afterAll(async () => {
  // Restore admin name if changed
  await prisma.user.update({ where: { id: admin.id }, data: { fullName: 'System Admin' } });
  await prisma.user.deleteMany({ where: { username: { startsWith: prefix } } });
  await prisma.branch.delete({ where: { id: branch.id } });
  await prisma.$disconnect();
});

describe('Single-Admin Rule', () => {
  it('cannot create a new ADMIN with or without a branch', async () => {
    const withBranch = await adminPost('/api/users', {
      username: `${prefix}-admin1`,
      password: 'Temp12345',
      fullName: 'Fake Admin',
      role: 'ADMIN',
      branchId: branch.id
    });
    expect(withBranch.status).toBe(400);
    expect(withBranch.body.error.code).toBe('VALIDATION_ERROR');
    expect(withBranch.body.error.details[0].field).toBe('role');

    const withoutBranch = await adminPost('/api/users', {
      username: `${prefix}-admin2`,
      password: 'Temp12345',
      fullName: 'Fake Admin 2',
      role: 'ADMIN'
    });
    expect(withoutBranch.status).toBe(400);
    expect(withoutBranch.body.error.code).toBe('VALIDATION_ERROR');
    expect(withoutBranch.body.error.details[0].field).toBe('role');
  });

  it('cannot promote a Staff user to ADMIN', async () => {
    const staff = (await adminPost('/api/users', {
      username: `${prefix}-staff`,
      password: 'Temp12345',
      fullName: 'Staff User',
      role: 'STAFF',
      branchId: branch.id
    })).body;

    const res = await adminPatch(`/api/users/${staff.id}`, { role: 'ADMIN' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details[0].field).toBe('role');
  });

  it('cannot change the seeded Admin role', async () => {
    const res = await adminPatch(`/api/users/${admin.id}`, { role: 'STAFF' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details[0].field).toBe('role');
  });

  it('cannot deactivate the seeded Admin', async () => {
    const res = await adminPatch(`/api/users/${admin.id}`, { isActive: false });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details[0].field).toBe('isActive');

    // Admin must still be able to log in
    const loginRes = await login('admin', 'Admin123!');
    expect(loginRes.status).toBe(200);
  });

  it('can change the seeded Admin fullName', async () => {
    const res = await adminPatch(`/api/users/${admin.id}`, { fullName: 'Super Admin' });
    expect(res.status).toBe(200);
    expect(res.body.fullName).toBe('Super Admin');
  });

  it('can patch the seeded Admin with role: ADMIN and no changes', async () => {
    const res = await adminPatch(`/api/users/${admin.id}`, { role: 'ADMIN' });
    expect(res.status).toBe(200);
    expect(res.body.role).toBe('ADMIN');
  });

  it('a Manager still gets 403 on every users endpoint', async () => {
    // Create a manager
    const mgr = (await adminPost('/api/users', {
      username: `${prefix}-mgr`,
      password: 'Temp12345',
      fullName: 'Manager User',
      role: 'BRANCH_MANAGER',
      branchId: branch.id
    })).body;

    const mgrToken = (await login(mgr.username, 'Temp12345')).body.token;

    const getRes = await request(app).get('/api/users').set(bearer(mgrToken));
    expect(getRes.status).toBe(403);

    const postRes = await request(app).post('/api/users').set(bearer(mgrToken)).send({});
    expect(postRes.status).toBe(403);
  });
});