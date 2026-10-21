// backend/src/modules/products/products.controller.js
const svc = require('./products.service');
const { asyncHandler } = require('../../middleware/errors');
const { parseIdOr404 } = require('../../utils/params');

exports.list = asyncHandler(async (req, res) => {
  res.json(await svc.listProducts(req));
});

exports.get = asyncHandler(async (req, res) => {
  res.json(await svc.getProduct(req, parseIdOr404(req.params.id, 'Product not found')));
});

exports.getByBarcode = asyncHandler(async (req, res) => {
  res.json(await svc.getByBarcode(req, req.params.barcode));
});

exports.create = asyncHandler(async (req, res) => {
  res.status(201).json(await svc.createProduct(req.body));
});

exports.update = asyncHandler(async (req, res) => {
  res.json(await svc.updateProduct(parseIdOr404(req.params.id, 'Product not found'), req.body));
});