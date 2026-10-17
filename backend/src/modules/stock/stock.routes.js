const express = require('express');
const { z } = require('zod');
const controller = require('./stock.controller');
const { requireRole } = require('../../middleware/auth');
const { validate } = require('../../middleware/validate');

// Quantities: 0 or more, at most 2 decimals (the database column is Decimal(12,2))
const quantity = z
  .number()
  .min(0)
  .max(9999999999.99)
  .refine((v) => Math.round(v * 100) / 100 === v, { message: 'at most 2 decimal places' });

const thresholdsSchema = z.object({
  minQuantity: quantity,
  maxQuantity: quantity.nullable().optional(), // omitted = unchanged, null = cleared
});

// ---- /api/stock ----
const router = express.Router();

// All roles may read; the service limits Manager and Staff to their own branch.
router.get('/', controller.listStock);
router.get('/consolidated', requireRole('ADMIN', 'AUDITOR'), controller.consolidated);
router.put(
  '/:branchId/:productId/thresholds',
  requireRole('ADMIN', 'BRANCH_MANAGER'),
  validate(thresholdsSchema),
  controller.setThresholds
);

// ---- /api/stock-movements (read only) ----
const movementsRouter = express.Router();
movementsRouter.get('/', controller.listMovements);

module.exports = router;
module.exports.movementsRouter = movementsRouter;