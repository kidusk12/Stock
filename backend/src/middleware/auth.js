const jwt = require('jsonwebtoken');
const { AppError } = require('./errors');

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.warn('WARNING: JWT_SECRET is not set in .env');
}

// Verifies the Bearer token and attaches { userId, role, branchId } to req.user
const authenticate = (req, res, next) => {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return next(new AppError(401, 'Missing or invalid Authorization header'));
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = {
      userId: payload.userId,
      role: payload.role,
      branchId: payload.branchId,
      username: payload.username,
    };
    next();
  } catch (err) {
    next(new AppError(401, 'Invalid or expired token'));
  }
};

// Role gate: requireRole('ADMIN', 'BRANCH_MANAGER')
const requireRole = (...roles) => (req, res, next) => {
  if (!req.user) return next(new AppError(401, 'Not authenticated'));
  if (!roles.includes(req.user.role)) {
    return next(new AppError(403, 'Insufficient permissions'));
  }
  next();
};

module.exports = { authenticate, requireRole };