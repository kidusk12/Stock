// backend/src/modules/branches/branches.controller.js
const svc = require('./branches.service');
const { asyncHandler } = require('../../middleware/errors');
const { parseIdOr404 } = require('../../utils/params');

exports.list = asyncHandler(async (req, res) => {
  res.json(await svc.listBranches(req.query));
});

exports.get = asyncHandler(async (req, res) => {
  res.json(await svc.getBranch(parseIdOr404(req.params.id, 'Branch not found')));
});

exports.create = asyncHandler(async (req, res) => {
  res.status(201).json(await svc.createBranch(req.body));
});

exports.update = asyncHandler(async (req, res) => {
  res.json(await svc.updateBranch(parseIdOr404(req.params.id, 'Branch not found'), req.body));
});