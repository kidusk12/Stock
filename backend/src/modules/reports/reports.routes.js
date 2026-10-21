const express = require('express');
const { requireRole } = require('../../middleware/auth');
const controller = require('./reports.controller');

const router = express.Router();
const REPORT_ROLES = ['ADMIN', 'BRANCH_MANAGER', 'AUDITOR'];
router.get('/stock', requireRole(...REPORT_ROLES), controller.stock);
router.get('/sales', requireRole(...REPORT_ROLES), controller.sales);
router.get('/movements', requireRole(...REPORT_ROLES), controller.movements);

module.exports = router;
