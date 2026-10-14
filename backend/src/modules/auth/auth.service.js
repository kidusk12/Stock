const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../../config/db');
const { AppError } = require('../../middleware/errors');

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '12h';

// Verifies username + password, returns a signed JWT and the user profile.
async function login({ username, password }) {
  if (!username || !password) {
    throw new AppError(400, 'Username and password are required');
  }

  const user = await prisma.user.findUnique({
    where: { username },
    include: { branch: { select: { id: true, name: true, code: true } } },
  });

  // Same error for unknown user and wrong password — do not leak which one failed
  const invalid = new AppError(401, 'Invalid username or password');

  if (!user) throw invalid;
  if (!user.isActive) throw new AppError(403, 'Account is disabled');

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) throw invalid;

  const token = jwt.sign(
    {
      userId: user.id,
      username: user.username,
      role: user.role,
      branchId: user.branchId,
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );

  return {
    token,
    user: {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      role: user.role,
      branchId: user.branchId,
      branch: user.branch,
    },
  };
}

// Used by GET /api/auth/me — returns the current user fresh from the DB
async function getCurrentUser(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { branch: { select: { id: true, name: true, code: true } } },
  });
  if (!user || !user.isActive) throw new AppError(404, 'User not found');
  return {
    id: user.id,
    username: user.username,
    fullName: user.fullName,
    role: user.role,
    branchId: user.branchId,
    branch: user.branch,
  };
}

module.exports = { login, getCurrentUser };