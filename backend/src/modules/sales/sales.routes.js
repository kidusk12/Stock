const express = require('express');
const { z } = require('zod');
const controller = require('./sales.controller');
const { requireRole, assertBranchAccess } = require('../../middleware/auth');
const { validate } = require('../../middleware/validate');
const { createSchema: createReturnSchema, checkSaleBranch } = require('../returns/returns.routes');
const returnsController = require('../returns/returns.controller');

// Quantity: above 0, at most 2 decimals (the database column is Decimal(12,2))
const quantity = z
  .number()
  .positive()
  .max(9999999999.99)
  .refine((v) => Math.round(v * 100) / 100 === v, { message: 'at most 2 decimal places' });

const createSchema = z.object({
  branchId: z.number().int().positive().optional(), // Admin must send it; Manager and Staff default to their own
  customerName: z.string().trim().max(100).nullable().optional(),
  items: z
    .array(
      z.object({
        productId: z.number().int().positive(),
        quantity,
      })
    )
    .min(1), // the same product twice is checked in the service (rule duplicate)
});

// Contract 6.0, rule 1: authenticate, Auditor block, role, BRANCH, then validation.
// This runs before validate(), so a Manager or Staff sending another branch gets 403, not 400.
const checkBranch = (req, res, next) => {
  const branchId = req.body && req.body.branchId;
  if (req.user.role !== 'ADMIN' && Number.isInteger(branchId) && branchId > 0) {
    assertBranchAccess(req.user, branchId);
  }
  next();
};

const router = express.Router();

// Contract 6.6: Admin, Manager and Staff. The Auditor has no access to sales (T2).
router.use(requireRole('ADMIN', 'BRANCH_MANAGER', 'STAFF'));

router.post('/', checkBranch, validate(createSchema), controller.createSale);
router.post('/:id/returns', checkSaleBranch, validate(createReturnSchema), returnsController.create);
router.get('/', controller.listSales);
router.get('/:id', controller.getSale);

module.exports = router;
