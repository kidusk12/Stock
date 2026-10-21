const request = require('supertest');
const app = require('../src/app');
const prisma = require('../src/config/db'); // if db.js exports { prisma }, use: const { prisma } = require('../src/config/db');

const prefix = `audit-test-${Date.now()}`;
let tokens = {};
let branchId;

async function auditCount() {
  return prisma.auditLog.count();
}

beforeAll(async () => {
  // Login as admin to get token
  const loginRes = await request(app)
    .post('/api/auth/login')
    .send({ username: 'admin', password: 'Admin123!' });

  if (!loginRes.body.token) {
    throw new Error(
      `Admin login failed (status ${loginRes.status}). Make sure the DB is seeded with admin / Admin123!`
    );
  }
  tokens.admin = loginRes.body.token;

  // Get the main branch
  const branch = await prisma.branch.findFirst({ where: { code: 'MAIN' } });
  if (!branch) {
    throw new Error('Branch with code "MAIN" not found. Seed the database first.');
  }
  branchId = branch.id;
});

afterAll(async () => {
  // Clean up users created by this test run
  try {
    await prisma.user.deleteMany({ where: { username: { startsWith: prefix } } });
  } catch (err) {
    // Ignore cleanup errors (e.g. foreign keys from audit logs)
  }
  await prisma.$disconnect();
});

describe('Users audit logs', () => {
  it('a successful create writes an audit entry', async () => {
    const before = await auditCount();

    const res = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${tokens.admin}`)
      .send({
        username: `${prefix}-success`,
        password: 'Password123!',
        fullName: 'Audit Success',
        role: 'STAFF',
        branchId: branchId,
      });

    expect(res.status).toBe(201);

    const after = await auditCount();
    expect(after).toBeGreaterThan(before);
  });

  it('a failed create (short password) writes no user', async () => {
    const res = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${tokens.admin}`)
      .send({
        username: `${prefix}-never`,
        password: 'short', // Fails validation
        fullName: 'Audit Never',
        role: 'STAFF',
        branchId: branchId,
      });

    expect(res.status).toBe(400);

    // The user must NOT be in the database
    const neverUser = await prisma.user.findUnique({
      where: { username: `${prefix}-never` },
    });
    expect(neverUser).toBeNull();
  });
});