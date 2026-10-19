// Follows docs/api-contract.md v5, section 6.8 and K-J. Creates its own user and branch and deletes them at the end.
require('dotenv').config();
const bcrypt = require('bcryptjs');
const prisma = require('../src/config/db');
const { writeAudit, AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } = require('../src/middleware/audit');

jest.setTimeout(60000);

const stamp = Date.now();
let user;
let branch;

const count = () => prisma.auditLog.count({ where: { userId: user.id } });

beforeAll(async () => {
  user = await prisma.user.create({
    data: {
      username: `test-audit-${stamp}`,
      passwordHash: await bcrypt.hash('Test12345', 10),
      fullName: 'Audit Test',
      role: 'ADMIN',
    },
  });
  branch = await prisma.branch.create({ data: { name: `Test Audit Branch ${stamp}`, code: `TAU${stamp}` } });
});

afterAll(async () => {
  await prisma.auditLog.deleteMany({ where: { userId: user.id } });
  await prisma.user.delete({ where: { id: user.id } });
  await prisma.branch.delete({ where: { id: branch.id } });
  await prisma.$disconnect();
});

test('writes an entry with all fields, including old and new JSON values', async () => {
  const row = await writeAudit({
    userId: user.id,
    action: AUDIT_ACTIONS.SALE_CREATED,
    entityType: 'SALE',
    entityId: 301,
    branchId: branch.id,
    oldValue: { total: 40 },
    newValue: { invoiceNumber: 'INV-000045', total: 50 },
  });

  const saved = await prisma.auditLog.findUnique({ where: { id: row.id } });
  expect(saved.userId).toBe(user.id);
  expect(saved.action).toBe('SALE_CREATED');
  expect(saved.entityType).toBe('SALE');
  expect(saved.entityId).toBe(301);
  expect(saved.branchId).toBe(branch.id);
  expect(saved.oldValue).toEqual({ total: 40 });
  expect(saved.newValue).toEqual({ invoiceNumber: 'INV-000045', total: 50 });
  expect(saved.createdAt).toBeInstanceOf(Date);
});

test('entityId, branchId, oldValue and newValue are null when not given', async () => {
  const row = await writeAudit({ userId: user.id, action: AUDIT_ACTIONS.USER_LOGOUT, entityType: 'USER' });
  const saved = await prisma.auditLog.findUnique({ where: { id: row.id } });
  expect(saved.entityId).toBeNull();
  expect(saved.branchId).toBeNull();
  expect(saved.oldValue).toBeNull();
  expect(saved.newValue).toBeNull();
});

test('dates inside the values are saved as text', async () => {
  const row = await writeAudit({
    userId: user.id,
    action: AUDIT_ACTIONS.USER_UPDATED,
    entityType: 'USER',
    newValue: { changedAt: new Date('2026-10-05T09:30:00Z'), isActive: false },
  });
  const saved = await prisma.auditLog.findUnique({ where: { id: row.id } });
  expect(saved.newValue).toEqual({ changedAt: '2026-10-05T09:30:00.000Z', isActive: false });
});

test('an unknown action, an unknown entity type or a bad user id is rejected and nothing is written', async () => {
  const before = await count();

  await expect(writeAudit({ userId: user.id, action: 'NOT_AN_ACTION', entityType: 'USER' })).rejects.toThrow('unknown action');
  await expect(writeAudit({ userId: user.id, action: AUDIT_ACTIONS.USER_LOGOUT, entityType: 'NOPE' })).rejects.toThrow('unknown entityType');
  await expect(writeAudit({ userId: 'abc', action: AUDIT_ACTIONS.USER_LOGOUT, entityType: 'USER' })).rejects.toThrow('userId');

  expect(await count()).toBe(before);
});

test('the entry is part of the caller transaction: kept on commit, gone on rollback', async () => {
  const before = await count();

  await prisma.$transaction(async (tx) => {
    await writeAudit({ userId: user.id, action: AUDIT_ACTIONS.USER_CREATED, entityType: 'USER' }, tx);
  });
  expect(await count()).toBe(before + 1);

  await expect(
    prisma.$transaction(async (tx) => {
      await writeAudit({ userId: user.id, action: AUDIT_ACTIONS.USER_CREATED, entityType: 'USER' }, tx);
      throw new Error('boom');
    })
  ).rejects.toThrow('boom');
  expect(await count()).toBe(before + 1);
});

test('if the audit write fails, the action before it is rolled back too', async () => {
  const code = `TAR${stamp}`;

  await expect(
    prisma.$transaction(async (tx) => {
      await tx.branch.create({ data: { name: `Test Audit Rollback ${stamp}`, code } });
      // 999999999 is not a real user, so the audit write fails
      await writeAudit({ userId: 999999999, action: AUDIT_ACTIONS.BRANCH_UPDATED, entityType: 'BRANCH' }, tx);
    })
  ).rejects.toThrow();

  expect(await prisma.branch.findUnique({ where: { code } })).toBeNull();
});

test('the action and entity type lists contain every name from contract 6.8', () => {
  const actions = [
    'USER_CREATED', 'USER_UPDATED', 'USER_LOGOUT', 'PRODUCT_CREATED', 'PRODUCT_UPDATED', 'PRICE_CHANGED',
    'SUPPLIER_UPDATED', 'BRANCH_UPDATED', 'STOCK_MOVEMENT', 'PO_CREATED', 'PO_APPROVED', 'PO_RECEIVED',
    'SALE_CREATED', 'RETURN_CREATED', 'RETURN_REFUNDED', 'ADJUSTMENT_CREATED', 'TRANSFER_REQUESTED',
    'TRANSFER_APPROVED', 'TRANSFER_SHIPPED', 'TRANSFER_RECEIVED', 'IMPORT_CONFIRMED',
  ];
  actions.forEach((name) => expect(AUDIT_ACTIONS[name]).toBe(name));

  const entityTypes = ['USER', 'PRODUCT', 'SUPPLIER', 'BRANCH', 'PO', 'SALE', 'RETURN', 'ADJUSTMENT', 'TRANSFER', 'IMPORT'];
  entityTypes.forEach((name) => expect(AUDIT_ENTITY_TYPES).toContain(name));
});