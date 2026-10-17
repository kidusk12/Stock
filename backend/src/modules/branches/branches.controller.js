// backend/src/modules/branches/branches.controller.js
const svc = require('./branches.service');
const { AppError, asyncHandler } = require('../../middleware/errors');

function parseIdOr404(raw) {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) throw new AppError(404, 'NOT_FOUND', 'Branch not found');
  return n;
}

exports.list = asyncHandler(async (req, res) => {
  res.json(await svc.listBranches(req.query));
});

exports.get = asyncHandler(async (req, res) => {
  res.json(await svc.getBranch(parseIdOr404(req.params.id)));
});

exports.create = asyncHandler(async (req, res) => {
  res.status(201).json(await svc.createBranch(req.body));
});

exports.update = asyncHandler(async (req, res) => {
  res.json(await svc.updateBranch(parseIdOr404(req.params.id), req.body));
});