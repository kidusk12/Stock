// Follows docs/api-contract.md v5, sections 4 and 6.8. Creates its own branch and users and deletes them at the end.
require('dotenv').config();
const request = require('supertest');
const app = require('../src/app');
const prisma = require('../src/config/db');

jest.setTimeout(60000);

const stamp = Date.now();
const prefix = `test-uaudit-${stamp}`;
let counter = 0;
let branch;
let admin; // { token, id }
const createdIds = [];

const bearer = (token) => ({ Authorization: `Bearer ${token}` });
const adminPost = (path, body) => request(app).post(path).set(bearer(admin.token)).send(body);
const adminPatch = (path, body) => request(app).patch(path).set(bearer(admin.token)).send(body);

const entriesFor = (entityId, action) =>
  prisma.auditLog.findMany({ where: { entityType: 'USER', entityId, action }, orderBy: { id: 'asc' } });
const createdCount = () => prisma.auditLog.count({ where: { userId: admin.id, action: 'USER_CREATED' } });

async function newUser(overrides = {}) {
  const res = await adminPost('/api/users', {
    username: `${prefix}-${++counter}`,
    fullName: 'Users Audit Test',
    password: 'Temp12345',
    role: 'STAFF',
    branchId: branch.id,
    ...overrides,
  });
  expect(res.status).toBe(201);
  createdIds.push(res.body.id);
  return res.body;
}

beforeAll(async () => {
  branch = await prisma.branch.create({ data: { name: `Test UAudit Branch ${stamp}`, code: `TUA${stamp}` } });
  const res = await request(app).post('/api/auth/login').send({ username: 'admin', password: 'Admin123!' });
  admin = { token: res.body.token, id: res.body.user.id };
});

afterAll(async () => {
  await prisma.auditLog.deleteMany({ where: { entityType: 'USER', entityId: { in: createdIds } } });
  await prisma.user.deleteMany({ where: { username: { startsWith: prefix } } });
  await prisma.branch.delete({ where: { id: branch.id } });
  await prisma.$disconnect();
});

test('creating a user writes USER_CREATED with the actor, entity, branch and new values, and no password', async () => {
  const user = await newUser();

  const entries = await entriesFor(user.id, 'USER_CREATED');
  expect(entries).toHaveLength(1);
  const entry = entries[0];
  expect(entry.userId).toBe(admin.id); // the Admin who did it, not the new user
  expect(entry.entityType).toBe('USER');
  expect(entry.entityId).toBe(user.id);
  expect(entry.branchId).toBe(branch.id);
  expect(entry.oldValue).toBeNull();
  expect(entry.newValue).toEqual({
    username: user.username,
    fullName: 'Users Audit Test',
    role: 'STAFF',
    branchId: branch.id,
    isActive: true,
  });
  expect(JSON.stringify(entry.newValue).toLowerCase()).not.toContain('password');
});

test('updating a user writes USER_UPDATED with only the fields that changed', async () => {
  const user = await newUser();

  const res = await adminPatch(`/api/users/${user.id}`, { fullName: 'Renamed Person' });
  expect(res.status).toBe(200);

  const entries = await entriesFor(user.id, 'USER_UPDATED');
  expect(entries).toHaveLength(1);
  expect(entries[0].userId).toBe(admin.id);
  expect(entries[0].branchId).toBe(branch.id);
  expect(entries[0].oldValue).toEqual({ fullName: 'Users Audit Test' });
  expect(entries[0].newValue).toEqual({ fullName: 'Renamed Person' });
});

test('a PATCH that changes nothing writes no audit entry', async () => {
  const user = await newUser();

  const res = await adminPatch(`/api/users/${user.id}`, { fullName: 'Users Audit Test', isActive: true });
  expect(res.status).toBe(200);
  expect(await entriesFor(user.id, 'USER_UPDATED')).toHaveLength(0);
});

test('changing a user to Admin logs the role change and the cleared branch', async () => {
  const user = await newUser();

  const res = await adminPatch(`/api/users/${user.id}`, { role: 'ADMIN' });
  expect(res.status).toBe(200);
  expect(res.body.branchId).toBeNull();

  const entries = await entriesFor(user.id, 'USER_UPDATED');
  expect(entries).toHaveLength(1);
  expect(entries[0].oldValue).toEqual({ role: 'STAFF', branchId: branch.id });
  expect(entries[0].newValue).toEqual({ role: 'ADMIN', branchId: null });
  expect(entries[0].branchId).toBeNull(); // the user's branch after the change
});

test('deactivating a user logs isActive from true to false', async () => {
  const user = await newUser();

  const res = await adminPatch(`/api/users/${user.id}`, { isActive: false });
  expect(res.status).toBe(200);

  const entries = await entriesFor(user.id, 'USER_UPDATED');
  expect(entries).toHaveLength(1);
  expect(entries[0].oldValue).toEqual({ isActive: true });
  expect(entries[0].newValue).toEqual({ isActive: false });
});

test('a failed create writes no audit entry', async () => {
  const user = await newUser();
  const before = await createdCount();

  const duplicate = await adminPost('/api/users', {
    username: user.username,
    fullName: 'Duplicate',
    password: 'Temp12345',
    role: 'STAFF',
    branchId: branch.id,
  });
  expect(duplicate.status).toBe(409);

  const shortPassword = await adminPost('/api/users', {
    username: `${prefix}-never`,
    fullName: 'Never Created',
    password: 'short',
    role: 'STAFF',
    branchId: branch.id,
  });
  expect(shortPassword.status).toBe(400);

  expect(await createdCount()).toBe(before);
  expect(await prisma.user.findUnique({ where: { username: `${prefix}-never` } })).toBeNull();
});