// backend/src/modules/suppliers/suppliers.controller.js
const svc = require('./suppliers.service');
const { asyncHandler } = require('../../middleware/errors');
const { parseIdOr404 } = require('../../utils/params');

exports.list = asyncHandler(async (req, res) => {
  res.json(await svc.listSuppliers(req.query));
});

exports.get = asyncHandler(async (req, res) => {
  res.json(await svc.getSupplier(parseIdOr404(req.params.id, 'Supplier not found')));
});

exports.create = asyncHandler(async (req, res) => {
  res.status(201).json(await svc.createSupplier(req.body));
});

exports.update = asyncHandler(async (req, res) => {
  res.json(await svc.updateSupplier(parseIdOr404(req.params.id, 'Supplier not found'), req.body));
});