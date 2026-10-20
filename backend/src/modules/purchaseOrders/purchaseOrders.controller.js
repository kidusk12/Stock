const { asyncHandler } = require('../../middleware/errors');
const poService = require('./purchaseOrders.service');

// Contract 6.5: POST create returns 201 with the PO object directly (no { data } wrapper);
// the list returns { data, page, limit, total }; every other endpoint returns the PO directly.

const create = asyncHandler(async (req, res) => {
  const po = await poService.createPurchaseOrder(req.user, req.body);
  res.status(201).json(po);
});

const list = asyncHandler(async (req, res) => {
  const result = await poService.listPurchaseOrders(req.user, req.query);
  res.json(result);
});

const getById = asyncHandler(async (req, res) => {
  const po = await poService.getPurchaseOrder(req.user, req.params.id);
  res.json(po);
});

const approve = asyncHandler(async (req, res) => {
  const po = await poService.approvePurchaseOrder(req.user, req.params.id);
  res.json(po);
});

const reject = asyncHandler(async (req, res) => {
  const po = await poService.rejectPurchaseOrder(req.user, req.params.id, req.body);
  res.json(po);
});

const receive = asyncHandler(async (req, res) => {
  const po = await poService.receivePurchaseOrder(req.user, req.params.id, req.body);
  res.json(po);
});

module.exports = { create, list, getById, approve, reject, receive };