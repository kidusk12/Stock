const { asyncHandler } = require('../../middleware/errors');
const dashboardService = require('./dashboard.service');

const get = asyncHandler(async (req, res) => {
  res.json(await dashboardService.getDashboard(req.user, req.query));
});

module.exports = { get };
