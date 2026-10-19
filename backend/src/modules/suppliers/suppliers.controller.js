// backend/src/modules/suppliers/suppliers.controller.js
const svc = require('./suppliers.service');
const { AppError, asyncHandler } = require('../../middleware/errors');

function parseIdOr404(raw) {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) throw new AppError(404, 'NOT_FOUND', 'Supplier not found');
  return n;
}

exports.list = asyncHandler(async (req, res) => {
  res.json(await svc.listSuppliers(req.query));
});

exports.get = asyncHandler(async (req, res) => {
  res.json(await svc.getSupplier(parseIdOr404(req.params.id)));
});

exports.create = asyncHandler(async (req, res) => {
  res.status(201).json(await svc.createSupplier(req.body, req.user.userId));
});

exports.update = asyncHandler(async (req, res) => {
  res.json(await svc.updateSupplier(parseIdOr404(req.params.id), req.body, req.user.userId));
});
