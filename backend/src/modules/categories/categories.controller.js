// backend/src/modules/categories/categories.controller.js
const svc = require('./categories.service');
const { AppError, asyncHandler } = require('../../middleware/errors');

// A bad id in the URL (abc, 0, negative, undefined) is treated as "not found" — 404, not 500.
function parseIdOr404(raw, message = 'Category not found') {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) throw new AppError(404, 'NOT_FOUND', message);
  return n;
}

exports.list = asyncHandler(async (req, res) => {
  res.json(await svc.listCategories(req.query));
});

exports.get = asyncHandler(async (req, res) => {
  res.json(await svc.getCategory(parseIdOr404(req.params.id)));
});

exports.create = asyncHandler(async (req, res) => {
  res.status(201).json(await svc.createCategory(req.body));
});

exports.update = asyncHandler(async (req, res) => {
  res.json(await svc.updateCategory(parseIdOr404(req.params.id), req.body));
});