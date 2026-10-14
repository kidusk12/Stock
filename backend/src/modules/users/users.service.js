const bcrypt = require('bcryptjs');
const prisma = require('../../config/db');
const { AppError } = require('../../middleware/errors');

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

const validationError = (message, field, issue) =>
  new AppError(400, 'VALIDATION_ERROR', message, [{ field, issue }]);

// A bad id in the URL is treated like a missing record
function parseId(value) {
  const id = Number(value);
  if (!Number.isInteger(id) || id < 1) throw new AppError(404, 'NOT_FOUND', 'User not found');
  return id;
}

function parsePagination({ page = '1', limit = '20' } = {}) {
  const p = Number(page);
  const l = Number(limit);
  if (!Number.isInteger(p) || p < 1 || !Number.isInteger(l) || l < 1 || l > 100) {
    throw validationError('Invalid pagination', 'page', 'page must be 1 or more and limit between 1 and 100');
  }
  return { page: p, limit: l };
}

// Contract: branchId is required for BRANCH_MANAGER and STAFF, and must be null for ADMIN and AUDITOR
function checkBranchRule(role, branchId) {
  const hasBranch = branchId !== null && branchId !== undefined;
  if (BRANCH_ROLES.includes(role) && !hasBranch) {
    throw validationError('Branch is required for this role', 'branchId', 'required for BRANCH_MANAGER and STAFF');
  }
  if (!BRANCH_ROLES.includes(role) && hasBranch) {
    throw validationError('This role cannot have a branch', 'branchId', 'must be null for ADMIN and AUDITOR');
  }
}

async function assertBranchExists(branchId) {
  const branch = await prisma.branch.findUnique({ where: { id: branchId }, select: { id: true } });
  if (!branch) throw new AppError(404, 'NOT_FOUND', 'Branch not found');
}

// GET /api/users
async function list(query = {}) {
  const { page, limit } = parsePagination(query);

  const where = {};
  if (query.includeInactive !== 'true') where.isActive = true;
  if (query.role) {
    if (!ROLES.includes(query.role)) throw validationError('Invalid role', 'role', 'unknown role');
    where.role = query.role;
  }
  if (query.branchId) {
    const branchId = Number(query.branchId);
    if (!Number.isInteger(branchId)) throw validationError('Invalid branchId', 'branchId', 'must be a number');
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
      skip: (page - 1) * limit,
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
// TODO (Kidus): write USER_CREATED to the audit log once middleware/audit.js exists.
async function create({ username, fullName, password, role, branchId = null }) {
  checkBranchRule(role, branchId);
  if (branchId !== null) await assertBranchExists(branchId);

  const passwordHash = await bcrypt.hash(password, 10);
  try {
    const user = await prisma.user.create({
      data: { username, fullName, passwordHash, role, branchId },
      include: withBranch,
    });
    return toUser(user);
  } catch (e) {
    if (e.code === 'P2002') throw new AppError(409, 'DUPLICATE_VALUE', 'Username is already taken');
    throw e;
  }
}

// PATCH /api/users/:id   (any of: fullName, role, branchId, isActive)
// TODO (Kidus): write USER_UPDATED to the audit log once middleware/audit.js exists.
async function update(idParam, changes, actingUserId) {
  const id = parseId(idParam);
  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) throw new AppError(404, 'NOT_FOUND', 'User not found');

  if (changes.isActive === false && id === actingUserId) {
    throw validationError('You cannot deactivate your own account', 'isActive', 'not allowed on your own account');
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

  const user = await prisma.user.update({ where: { id }, data, include: withBranch });
  return toUser(user);
}

// POST /api/users/:id/reset-password
async function resetPassword(idParam, newPassword) {
  const id = parseId(idParam);
  const existing = await prisma.user.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw new AppError(404, 'NOT_FOUND', 'User not found');

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({ where: { id }, data: { passwordHash } });
}

module.exports = { list, getById, create, update, resetPassword };