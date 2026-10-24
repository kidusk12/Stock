const express = require('express');
const { requireRole } = require('../../middleware/auth');
const controller = require('./importProducts.controller');

const router = express.Router();
router.get('/products/template', requireRole('ADMIN'), controller.template);
router.post('/products', requireRole('ADMIN'), controller.create);

module.exports = router;
