// backend/src/modules/categories/categories.controller.js
const svc = require('./categories.service');
const { asyncHandler } = require('../../middleware/errors');
const { parseIdOr404 } = require('../../utils/params');

exports.list = asyncHandler(async (req, res) => {
  res.json(await svc.listCategories(req.query));
});

exports.get = asyncHandler(async (req, res) => {
  res.json(await svc.getCategory(parseIdOr404(req.params.id, 'Category not found')));
});

exports.create = asyncHandler(async (req, res) => {
  res.status(201).json(await svc.createCategory(req.body));
});

exports.update = asyncHandler(async (req, res) => {
  res.json(await svc.updateCategory(parseIdOr404(req.params.id, 'Category not found'), req.body));
});