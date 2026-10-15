const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../../utils/prisma');
const AppError = require('../../utils/AppError');

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h';

function userToContract(user) {
  return {
    id: user.id,
    username: user.username,
    fullName: user.fullName,
    role: user.role,
    branchId: user.branchId,
    branchName: user.branch ? user.branch.name : null,
  };
}

async function login({ username, password }) {
  if (!username || !password) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Username and password are required');
  }

  const user = await prisma.user.findUnique({
    where: { username },
    include: { branch: { select: { id: true, name: true, code: true } } },
  });

  const invalid = new AppError(401, 'INVALID_CREDENTIALS', 'Invalid username or password');

  if (!user) throw invalid;

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) throw invalid;

  if (!user.isActive) {
    throw new AppError(403, 'ACCOUNT_DISABLED', 'Account is disabled');
  }

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

  const decoded = jwt.decode(token);
  const expiresAt = new Date(decoded.exp * 1000).toISOString();

  return {
    token,
    expiresAt,
    user: userToContract(user),
  };
}

async function getCurrentUser(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { branch: { select: { id: true, name: true, code: true } } },
  });
  if (!user || !user.isActive) {
    throw new AppError(404, 'NOT_FOUND', 'User not found');
  }
  return userToContract(user);
}

module.exports = { login, getCurrentUser };