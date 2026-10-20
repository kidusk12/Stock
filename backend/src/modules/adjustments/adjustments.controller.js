const { asyncHandler } = require('../../middleware/errors');
const adjustmentService = require('./adjustments.service');

// Contract 6.7: POST returns 201 with the adjustment object directly (no { data } wrapper);
// the list returns { data, page, limit, total }.

const create = asyncHandler(async (req, res) => {
  const adjustment = await adjustmentService.createAdjustment(req.user, req.body);
  res.status(201).json(adjustment);
});

const list = asyncHandler(async (req, res) => {
  const result = await adjustmentService.listAdjustments(req.user, req.query);
  res.json(result);
});

module.exports = { create, list };