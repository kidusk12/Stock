const { asyncHandler } = require('../../middleware/errors');
const { writeAudit, AUDIT_ACTIONS } = require('../../middleware/audit');
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
// The server writes USER_LOGOUT to the audit log (contract section 3).
const logout = asyncHandler(async (req, res) => {
  await writeAudit({
    userId: req.user.userId,
    action: AUDIT_ACTIONS.USER_LOGOUT,
    entityType: 'USER',
    entityId: req.user.userId,
    branchId: req.user.branchId,
  });
  res.json({ success: true });
});

const changePassword = asyncHandler(async (req, res) => {
  await authService.changePassword(req.user.userId, req.body);
  res.json({ success: true });
});

module.exports = { login, me, logout, changePassword };