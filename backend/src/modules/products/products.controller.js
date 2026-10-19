// backend/src/modules/products/products.controller.js
const svc = require('./products.service');
const { AppError, asyncHandler } = require('../../middleware/errors');

function parseIdOr404(raw) {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) throw new AppError(404, 'NOT_FOUND', 'Product not found');
  return n;
}

exports.list = asyncHandler(async (req, res) => {
  res.json(await svc.listProducts(req));
});

exports.get = asyncHandler(async (req, res) => {
  res.json(await svc.getProduct(req, parseIdOr404(req.params.id)));
});

exports.getByBarcode = asyncHandler(async (req, res) => {
  res.json(await svc.getByBarcode(req, req.params.barcode));
});

exports.create = asyncHandler(async (req, res) => {
  res.status(201).json(await svc.createProduct(req.body, req.user.userId));
});

exports.update = asyncHandler(async (req, res) => {
  res.json(await svc.updateProduct(parseIdOr404(req.params.id), req.body, req.user.userId));
});
