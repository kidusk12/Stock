const jwt = require('jsonwebtoken');
const prisma = require('../utils/prisma');
const AppError = require('../utils/AppError');

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.warn('WARNING: JWT_SECRET is not set in .env');
}

// Verifies the Bearer token, then loads the user from the DB
// so role, branchId and isActive are always fresh.
const authenticate = async (req, res, next) => {
  try {
    const header = req.headers.authorization || '';
    const [scheme, token] = header.split(' ');

    if (scheme !== 'Bearer' || !token) {
      throw new AppError(401, 'UNAUTHENTICATED', 'Missing or invalid Authorization header');
    }

    let payload;
    try {
      payload = jwt.verify(token, JWT_SECRET);
    } catch (e) {
      throw new AppError(401, 'UNAUTHENTICATED', 'Invalid or expired token');
    }

    const user = await prisma.user.findUnique({ where: { id: payload.userId } });

    if (!user) {
      throw new AppError(401, 'UNAUTHENTICATED', 'Invalid or expired token');
    }
    if (!user.isActive) {
      throw new AppError(403, 'ACCOUNT_DISABLED', 'Account is disabled');
    }

    req.user = {
      userId: user.id,
      username: user.username,
      role: user.role,
      branchId: user.branchId,
    };
    next();
  } catch (err) {
    next(err);
  }
};

const authorize = (...roles) => (req, res, next) => {
  if (!req.user) return next(new AppError(401, 'UNAUTHENTICATED', 'Not authenticated'));
  if (!roles.includes(req.user.role)) {
    return next(new AppError(403, 'FORBIDDEN', 'Insufficient permissions'));
  }
  next();
};

// Auditor read-only: reject writes except change-password and logout.
// Applied per-route after authenticate(), so req.user is always set by then.
const auditorReadOnly = (req, res, next) => {
  if (!req.user) return next();
  if (req.user.role !== 'AUDITOR') return next();

  const method = req.method.toUpperCase();
  const path = req.originalUrl || req.url;
  const isWrite = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
  const allowed = path.endsWith('/auth/change-password') || path.endsWith('/auth/logout');

  if (isWrite && !allowed) {
    return next(new AppError(403, 'FORBIDDEN', 'Auditor role is read-only'));
  }
  next();
};

module.exports = { authenticate, authorize, auditorReadOnly };