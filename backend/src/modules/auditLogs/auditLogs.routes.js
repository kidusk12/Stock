const express = require('express');
const { requireRole } = require('../../middleware/auth');
const controller = require('./auditLogs.controller');

const router = express.Router();
router.get('/', requireRole('ADMIN', 'BRANCH_MANAGER', 'AUDITOR'), controller.list);

module.exports = router;
