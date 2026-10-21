const request = require('supertest');
const app = require('../src/app');
const prisma = require('../src/lib/prisma'); // <--- Changed path here

const prefix = `audit-test-${Date.now()}`;
let tokens = {};
let branchId;

async function createdCount() {
  return prisma.auditLog.count();
}

beforeAll(async () => {
  // Login as admin to get token
  const loginRes = await request(app)
    .post('/api/auth/login')
    .send({ username: 'admin', password: 'Admin123!' });
  tokens.admin = loginRes.body.token;

  // Get the main branch
  const branch = await prisma.branch.findFirst({ where: { code: 'MAIN' } });
  branchId = branch.id;
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('Users audit logs', () => {
  it('a successful create writes an audit entry', async () => {
    const before = await createdCount();
    
    const res = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${tokens.admin}`)
      .send({
        username: `${prefix}-success`,
        password: 'Password123!',
        fullName: 'Audit Success',
        role: 'STAFF',
        branchId: branchId
      });

    expect(res.status).toBe(201);
    
    const after = await createdCount();
    expect(after).toBe(before + 1);
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
        branchId: branchId
      });

    expect(res.status).toBe(400);
    
    const neverUser = await prisma.user.findUnique({ where: { username: `${prefix}-never` } });
    expect(neverUser).toBeNull();
  });
});