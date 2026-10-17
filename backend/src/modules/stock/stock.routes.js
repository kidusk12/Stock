const express = require('express');
const { z } = require('zod');
const controller = require('./stock.controller');
const { requireRole, assertBranchAccess } = require('../../middleware/auth');
const { validate } = require('../../middleware/validate');

// Quantities: 0 or more, at most 2 decimals (the database column is Decimal(12,2))
const quantity = z
  .number()
  .min(0)
  .max(9999999999.99)
  .refine((v) => Math.round(v * 100) / 100 === v, { message: 'at most 2 decimal places' });

const thresholdsSchema = z.object({
  minQuantity: quantity, // 0 clears the minimum
  maxQuantity: quantity.nullable().optional(), // omitted = unchanged, null = cleared
});

// Contract 6.0, rule 1: authenticate, Auditor block, role, BRANCH, then validation.
// This runs before validate(), so a Manager sending a bad body for another branch gets 403, not 400.
// A bad branch id is left to the service, which answers 404.
const checkBranch = (req, res, next) => {
  const branchId = Number(req.params.branchId);
  if (Number.isInteger(branchId) && branchId > 0) assertBranchAccess(req.user, branchId);
  next();
};

// ---- /api/stock ----
const router = express.Router();

// All roles may read; the service limits Manager and Staff to their own branch.
router.get('/', controller.listStock);
router.get('/consolidated', requireRole('ADMIN', 'AUDITOR'), controller.consolidated);
router.put(
  '/:branchId/:productId/thresholds',
  requireRole('ADMIN', 'BRANCH_MANAGER'),
  checkBranch,
  validate(thresholdsSchema),
  controller.setThresholds
);

// ---- /api/stock-movements (read only) ----
const movementsRouter = express.Router();
movementsRouter.get('/', controller.listMovements);

module.exports = router;
module.exports.movementsRouter = movementsRouter;