const { asyncHandler } = require('../../middleware/errors');
const salesService = require('./sales.service');

// Contract 6.6: POST returns 201 with the sale object directly (no { data } wrapper);
// the list returns { data, page, limit, total }; GET by id returns the sale directly.

const createSale = asyncHandler(async (req, res) => {
  const sale = await salesService.createSale(req.user, req.body);
  res.status(201).json(sale);
});

const listSales = asyncHandler(async (req, res) => {
  const result = await salesService.listSales(req.user, req.query);
  res.json(result);
});

const getSale = asyncHandler(async (req, res) => {
  const sale = await salesService.getSale(req.user, req.params.id);
  res.json(sale);
});

module.exports = { createSale, listSales, getSale };