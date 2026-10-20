const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../../config/db');
const { AppError } = require('../../middleware/errors');

const withBranch = { branch: { select: { name: true } } };

// The user object from the API contract (same shape for login and /me)
const toUser = (u) => ({
  id: u.id,
  username: u.username,
  fullName: u.fullName,
  role: u.role,
  branchId: u.branchId,
  branchName: u.branch ? u.branch.name : null,
});

const validation = (details) => new AppError(400, 'VALIDATION_ERROR', 'Invalid input', details);

// POST /api/auth/login  ->  { token, expiresAt, user }
async function login({ username, password } = {}) {
  const details = [];
  if (!username) details.push({ field: 'username', issue: 'Username is required' });
  if (!password) details.push({ field: 'password', issue: 'Password is required' });
  if (details.length) throw validation(details);

  const user = await prisma.user.findUnique({ where: { username }, include: withBranch });

  // Same error for unknown user and wrong password: do not leak which one failed
  const invalid = new AppError(401, 'INVALID_CREDENTIALS', 'Invalid username or password');
  if (!user) throw invalid;
  if (!user.isActive) throw new AppError(403, 'ACCOUNT_DISABLED', 'Account is disabled');

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) throw invalid;

  const token = jwt.sign(
    { userId: user.id, username: user.username, role: user.role, branchId: user.branchId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
  );
  const expiresAt = new Date(jwt.decode(token).exp * 1000).toISOString();

  return { token, expiresAt, user: toUser(user) };
}

// GET /api/auth/me  ->  the user object, fresh from the database
async function getCurrentUser(userId) {
  const user = await prisma.user.findUnique({ where: { id: userId }, include: withBranch });
  if (!user) throw new AppError(401, 'UNAUTHENTICATED', 'Login required');
  if (!user.isActive) throw new AppError(403, 'ACCOUNT_DISABLED', 'Account is disabled');
  return toUser(user);
}

// POST /api/auth/change-password  ->  { success: true }
// Contract: new password under 8 characters is 400 VALIDATION_ERROR; wrong current password is 400 WRONG_CURRENT_PASSWORD.
async function changePassword(userId, { currentPassword, newPassword } = {}) {
  const details = [];
  if (!currentPassword) details.push({ field: 'currentPassword', issue: 'Current password is required' });
  if (!newPassword) details.push({ field: 'newPassword', issue: 'New password is required' });
  else if (newPassword.length < 8) details.push({ field: 'newPassword', issue: 'Must be at least 8 characters' });
  if (details.length) throw validation(details);

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError(401, 'UNAUTHENTICATED', 'Login required');

  const ok = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!ok) throw new AppError(400, 'WRONG_CURRENT_PASSWORD', 'Current password is incorrect');

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });
  return { success: true };
}

module.exports = { login, getCurrentUser, changePassword };