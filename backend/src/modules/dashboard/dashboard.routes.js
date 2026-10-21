const express = require('express');
const { requireRole } = require('../../middleware/auth');
const controller = require('./dashboard.controller');

const router = express.Router();
router.get('/', requireRole('ADMIN', 'BRANCH_MANAGER', 'STAFF', 'AUDITOR'), controller.get);

module.exports = router;
