const jwt = require('jsonwebtoken');
const prisma = require('../config/db');
const { AppError, asyncHandler } = require('./errors');

// Verifies the Bearer token, then loads the user from the database on EVERY request.
// A deactivated user is blocked at once, and the current role and branch from the
// database are used, not the ones inside the token (contract 1.2).
// Sets req.user = { userId, username, role, branchId }.
const authenticate = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    throw new AppError(401, 'UNAUTHENTICATED', 'Login required');
  }

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    throw new AppError(401, 'UNAUTHENTICATED', 'Session expired or invalid');
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { id: true, username: true, role: true, branchId: true, isActive: true },
  });
  if (!user) throw new AppError(401, 'UNAUTHENTICATED', 'Account not found');
  if (!user.isActive) throw new AppError(403, 'ACCOUNT_DISABLED', 'Account is disabled');

  req.user = { userId: user.id, username: user.username, role: user.role, branchId: user.branchId };
  next();
});

// Role gate: router.post('/', requireRole('ADMIN', 'BRANCH_MANAGER'), handler)
const requireRole = (...roles) => (req, res, next) => {
  if (!req.user) return next(new AppError(401, 'UNAUTHENTICATED', 'Login required'));
  if (!roles.includes(req.user.role)) {
    return next(new AppError(403, 'FORBIDDEN', 'You do not have permission to do this'));
  }
  next();
};

// Auditor rule (contract 1.3): an AUDITOR can never write.
// Mount it once in routes.js, after authenticate and after the auth routes.
const WRITE_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];
const blockAuditorWrites = (req, res, next) => {
  if (req.user && req.user.role === 'AUDITOR' && WRITE_METHODS.includes(req.method)) {
    return next(new AppError(403, 'FORBIDDEN', 'Auditor accounts are read-only'));
  }
  next();
};

// Admin and Auditor can reach every branch; Manager and Staff only their own.
function canAccessBranch(user, branchId) {
  if (user.role === 'ADMIN' || user.role === 'AUDITOR') return true;
  return user.branchId === Number(branchId);
}

// Use inside a service or controller: throws 403 if the user may not touch this branch.
function assertBranchAccess(user, branchId) {
  if (!canAccessBranch(user, branchId)) {
    throw new AppError(403, 'FORBIDDEN', 'You can only access your own branch');
  }
}

module.exports = {
  authenticate,
  requireRole,
  blockAuditorWrites,
  canAccessBranch,
  assertBranchAccess,
};