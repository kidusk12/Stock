const { asyncHandler } = require('../../middleware/errorHandler');
const authService = require('./auth.service');

const login = asyncHandler(async (req, res) => {
  const result = await authService.login(req.body);
  res.json(result);
});

const me = asyncHandler(async (req, res) => {
  const user = await authService.getCurrentUser(req.user.userId);
  res.json(user);
});

module.exports = { login, me };