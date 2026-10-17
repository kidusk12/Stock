const { asyncHandler } = require('../../middleware/errors');
const stockService = require('./stock.service');

// Contract 6.2 and 6.3: lists return { data, page, limit, total };
// the thresholds endpoint returns the stock row directly, with no { data } wrapper.

const listStock = asyncHandler(async (req, res) => {
  const result = await stockService.listStock(req.user, req.query);
  res.json(result);
});

const consolidated = asyncHandler(async (req, res) => {
  const result = await stockService.consolidated(req.query);
  res.json(result);
});

const setThresholds = asyncHandler(async (req, res) => {
  const row = await stockService.setThresholds(
    req.user,
    req.params.branchId,
    req.params.productId,
    req.body
  );
  res.json(row);
});

const listMovements = asyncHandler(async (req, res) => {
  const result = await stockService.listMovements(req.user, req.query);
  res.json(result);
});

module.exports = { listStock, consolidated, setThresholds, listMovements };