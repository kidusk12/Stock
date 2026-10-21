const { asyncHandler } = require('../../middleware/errors');
const returnsService = require('./returns.service');

const create = asyncHandler(async (req, res) => {
  const record = await returnsService.createReturn(req.user, req.params.id, req.body);
  res.status(201).json(record);
});

const list = asyncHandler(async (req, res) => {
  res.json(await returnsService.listReturns(req.user, req.query));
});

const get = asyncHandler(async (req, res) => {
  res.json(await returnsService.getReturn(req.user, req.params.id));
});

const refund = asyncHandler(async (req, res) => {
  res.json(await returnsService.markRefunded(req.user, req.params.id));
});

module.exports = { create, list, get, refund };
