const { asyncHandler } = require('../../middleware/errors');
const authService = require('./auth.service');

const login = asyncHandler(async (req, res) => {
  const result = await authService.login(req.body);
  res.json({ data: result });
});

const me = asyncHandler(async (req, res) => {
  const user = await authService.getCurrentUser(req.user.userId);
  res.json({ data: user });
});

module.exports = { login, me };