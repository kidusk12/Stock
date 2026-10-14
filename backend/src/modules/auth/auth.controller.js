const { asyncHandler } = require('../../middleware/errors');
const authService = require('./auth.service');

// Contract section 3: these responses are returned directly, with no { data } wrapper.

const login = asyncHandler(async (req, res) => {
  const result = await authService.login(req.body);
  res.json(result);
});

const me = asyncHandler(async (req, res) => {
  const user = await authService.getCurrentUser(req.user.userId);
  res.json(user);
});

// Tokens are stateless, so logout only confirms; the browser deletes the token.
// TODO (Kidus): write USER_LOGOUT to the audit log once middleware/audit.js exists.
const logout = asyncHandler(async (req, res) => {
  res.json({ success: true });
});

const changePassword = asyncHandler(async (req, res) => {
  await authService.changePassword(req.user.userId, req.body);
  res.json({ success: true });
});

module.exports = { login, me, logout, changePassword };