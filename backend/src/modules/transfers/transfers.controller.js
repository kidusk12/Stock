const { asyncHandler } = require('../../middleware/errors');
const transferService = require('./transfers.service');

// Contract 6.9: POST create returns 201 with the transfer object directly (no { data } wrapper);
// the list returns { data, page, limit, total }; every other endpoint returns the transfer directly.

const create = asyncHandler(async (req, res) => {
  const transfer = await transferService.createTransfer(req.user, req.body);
  res.status(201).json(transfer);
});

const list = asyncHandler(async (req, res) => {
  const result = await transferService.listTransfers(req.user, req.query);
  res.json(result);
});

const getById = asyncHandler(async (req, res) => {
  const transfer = await transferService.getTransfer(req.user, req.params.id);
  res.json(transfer);
});

const approve = asyncHandler(async (req, res) => {
  const transfer = await transferService.approveTransfer(req.user, req.params.id);
  res.json(transfer);
});

const reject = asyncHandler(async (req, res) => {
  const transfer = await transferService.rejectTransfer(req.user, req.params.id, req.body);
  res.json(transfer);
});

const ship = asyncHandler(async (req, res) => {
  const transfer = await transferService.shipTransfer(req.user, req.params.id);
  res.json(transfer);
});

const receive = asyncHandler(async (req, res) => {
  const transfer = await transferService.receiveTransfer(req.user, req.params.id, req.body);
  res.json(transfer);
});

module.exports = { create, list, getById, approve, reject, ship, receive };
