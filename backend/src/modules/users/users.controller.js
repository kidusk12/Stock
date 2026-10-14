const { asyncHandler } = require('../../middleware/errors');
const usersService = require('./users.service');

// Contract section 4: a list returns { data, page, limit, total };
// a single user is returned directly, with no { data } wrapper.

const list = asyncHandler(async (req, res) => {
  const result = await usersService.list(req.query);
  res.json(result);
});

const getById = asyncHandler(async (req, res) => {
  const user = await usersService.getById(req.params.id);
  res.json(user);
});

const create = asyncHandler(async (req, res) => {
  const user = await usersService.create(req.body);
  res.status(201).json(user);
});

const update = asyncHandler(async (req, res) => {
  const user = await usersService.update(req.params.id, req.body, req.user.userId);
  res.json(user);
});

const resetPassword = asyncHandler(async (req, res) => {
  await usersService.resetPassword(req.params.id, req.body.newPassword);
  res.json({ success: true });
});

module.exports = { list, getById, create, update, resetPassword };