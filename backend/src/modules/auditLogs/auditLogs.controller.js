const { asyncHandler } = require('../../middleware/errors');
const auditLogsService = require('./auditLogs.service');

const list = asyncHandler(async (req, res) => {
  res.json(await auditLogsService.listAuditLogs(req.user, req.query));
});

module.exports = { list };
