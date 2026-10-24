const bcrypt = require('bcryptjs');
const prisma = require('../../config/db');
const { AppError } = require('../../middleware/errors');
const { validationError } = require('../../middleware/validate'); // shared builder
const { writeAudit, AUDIT_ACTIONS } = require('../../middleware/audit'); // shared audit writer
const { parsePagination } = require('../../utils/pagination'); // shared pagination rule

const ROLES = ['ADMIN', 'BRANCH_MANAGER', 'STAFF', 'AUDITOR'];
const BRANCH_ROLES = ['BRANCH_MANAGER', 'STAFF']; // these roles must belong to a branch
const withBranch = { branch: { select: { name: true } } };

// The user object from the contract (section 4). The password hash is never returned.
const toUser = (u) => ({
  id: u.id,
  username: u.username,
  fullName: u.fullName,
  role: u.role,
  branchId: u.branchId,
  branchName: u.branch ? u.branch.name : null,
  isActive: u.isActive,
  createdAt: u.createdAt,
  updatedAt: u.updatedAt,
});

// What goes into the audit log about a user. Never the password hash.
const auditFields = (u) => ({
  username: u.username,
  fullName: u.fullName,
  role: u.role,
  branchId: u.branchId,
  isActive: u.isActive,
});

// A bad id in the URL is treated like a missing record
function parseId(value) {
  const id = Number(value);
  if (!Number.isInteger(id) || id < 1) throw new AppError(404, 'NOT_FOUND', 'User not found');
  return id;
}

// Contract: branchId is required for BRANCH_MANAGER and STAFF, and must be null for ADMIN and AUDITOR
function checkBranchRule(role, branchId) {
  const hasBranch = branchId !== null && branchId !== undefined;
  if (BRANCH_ROLES.includes(role) && !hasBranch) {
    throw validationError('Branch is required for this role', 'branchId', 'required', 'required for BRANCH_MANAGER and STAFF');
  }
  if (!BRANCH_ROLES.includes(role) && hasBranch) {
    throw validationError('This role cannot have a branch', 'branchId', 'invalid', 'must be null for ADMIN and AUDITOR');
  }
}

async function assertBranchExists(branchId) {
  const branch = await prisma.branch.findUnique({ where: { id: branchId }, select: { id: true } });
  if (!branch) throw new AppError(404, 'NOT_FOUND', 'Branch not found');
}

// GET /api/users
async function list(query = {}) {
  const { page, limit, skip } = parsePagination(query);

  const where = {};
  if (query.includeInactive !== 'true') where.isActive = true;
  if (query.role) {
    if (!ROLES.includes(query.role)) throw validationError('Invalid role', 'role', 'invalid', 'unknown role');
    where.role = query.role;
  }
  if (query.branchId) {
    const branchId = Number(query.branchId);
    if (!Number.isInteger(branchId)) {
      throw validationError('Invalid branchId', 'branchId', 'invalid', 'must be a number');
    }
    where.branchId = branchId;
  }
  if (query.q) {
    where.OR = [
      { username: { contains: query.q, mode: 'insensitive' } },
      { fullName: { contains: query.q, mode: 'insensitive' } },
    ];
  }

  const [rows, total] = await Promise.all([
    prisma.user.findMany({
      where,
      include: withBranch,
      orderBy: [{ fullName: 'asc' }, { id: 'asc' }],
      skip,
      take: limit,
    }),
    prisma.user.count({ where }),
  ]);

  return { data: rows.map(toUser), page, limit, total };
}

// GET /api/users/:id (also returns deactivated users)
async function getById(idParam) {
  const id = parseId(idParam);
  const user = await prisma.user.findUnique({ where: { id }, include: withBranch });
  if (!user) throw new AppError(404, 'NOT_FOUND', 'User not found');
  return toUser(user);
}

// POST /api/users
// The route only lets BRANCH_MANAGER, STAFF and AUDITOR through (the system has one Admin).
// The user and the USER_CREATED audit entry are saved in one transaction.
async function create({ username, fullName, password, role, branchId = null }, actingUserId) {
  checkBranchRule(role, branchId);
  if (branchId !== null) await assertBranchExists(branchId);

  const passwordHash = await bcrypt.hash(password, 10);
  try {
    return await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { username, fullName, passwordHash, role, branchId },
        include: withBranch,
      });
      await writeAudit(
        {
          userId: actingUserId,
          action: AUDIT_ACTIONS.USER_CREATED,
          entityType: 'USER',
          entityId: user.id,
          branchId: user.branchId,
          oldValue: null,
          newValue: auditFields(user),
        },
        tx
      );
      return toUser(user);
    });
  } catch (e) {
    if (e.code === 'P2002') throw new AppError(409, 'DUPLICATE_VALUE', 'Username is already taken');
    throw e;
  }
}

// PATCH /api/users/:id   (any of: fullName, role, branchId, isActive)
// The change and the USER_UPDATED audit entry are saved in one transaction.
// The entry holds only the fields that really changed; nothing is logged if nothing changed.
async function update(idParam, changes, actingUserId) {
  const id = parseId(idParam);
  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) throw new AppError(404, 'NOT_FOUND', 'User not found');

  if (existing.role === 'ADMIN') {
    // Contract section 4: the Admin account keeps its role, branch and active state.
    // Only fullName can change. A field sent with its current value is ignored.
    const touchesProtected =
      (changes.role !== undefined && changes.role !== existing.role) ||
      (changes.branchId !== undefined && changes.branchId !== existing.branchId) ||
      (changes.isActive !== undefined && changes.isActive !== existing.isActive);
    if (touchesProtected) {
      throw new AppError(403, 'FORBIDDEN', 'The Admin account cannot be reassigned or deactivated');
    }
  } else if (changes.role === 'ADMIN') {
    throw validationError('A user cannot be made Admin', 'role', 'invalid', 'ADMIN cannot be assigned');
  }

  const role = changes.role !== undefined ? changes.role : existing.role;
  let branchId = changes.branchId !== undefined ? changes.branchId : existing.branchId;
  // Changing a user to Admin or Auditor without sending a branch clears the old branch
  if (changes.branchId === undefined && !BRANCH_ROLES.includes(role)) branchId = null;

  checkBranchRule(role, branchId);
  if (branchId !== null && branchId !== existing.branchId) await assertBranchExists(branchId);

  const data = {};
  for (const field of ['fullName', 'role', 'isActive']) {
    if (changes[field] !== undefined) data[field] = changes[field];
  }
  if (branchId !== existing.branchId) data.branchId = branchId;

  // Only the fields whose value really changes go into the audit entry
  const oldValue = {};
  const newValue = {};
  for (const field of Object.keys(data)) {
    if (data[field] !== existing[field]) {
      oldValue[field] = existing[field];
      newValue[field] = data[field];
    }
  }

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.update({ where: { id }, data, include: withBranch });
    if (Object.keys(newValue).length > 0) {
      await writeAudit(
        {
          userId: actingUserId,
          action: AUDIT_ACTIONS.USER_UPDATED,
          entityType: 'USER',
          entityId: id,
          branchId: user.branchId,
          oldValue,
          newValue,
        },
        tx
      );
    }
    return toUser(user);
  });
}

// POST /api/users/:id/reset-password
// The Admin account cannot be reset here: the Admin uses change-password (contract section 4).
// Not audited yet: contract 6.8 has no action name for it.
async function resetPassword(idParam, newPassword, actingUserId) {
  const id = parseId(idParam);
  const existing = await prisma.user.findUnique({ where: { id }, select: { id: true, role: true } });
  if (!existing) throw new AppError(404, 'NOT_FOUND', 'User not found');
  if (existing.role === 'ADMIN') {
    throw new AppError(403, 'FORBIDDEN', 'The Admin password is changed with change-password');
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({ where: { id }, data: { passwordHash } });
}

module.exports = { list, getById, create, update, resetPassword };