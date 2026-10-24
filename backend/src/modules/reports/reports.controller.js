const { asyncHandler } = require('../../middleware/errors');
const reportsService = require('./reports.service');

const report = (type) => asyncHandler(async (req, res) => {
  const result = await reportsService.getReport(type, req.user, req.query);
  if (result.format === 'csv') {
    res.status(200)
      .set('Content-Type', 'text/csv; charset=utf-8')
      .set('Content-Disposition', `attachment; filename="${type}-report.csv"`)
      .send(result.csv);
    return;
  }
  res.json(result);
});

module.exports = { stock: report('stock'), sales: report('sales'), movements: report('movements') };
