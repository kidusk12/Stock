const express = require('express');
const { z } = require('zod');
const controller = require('./adjustments.controller');
const { requireRole, assertBranchAccess } = require('../../middleware/auth');
const { validate } = require('../../middleware/validate');

// K-K decided: no OPENING_STOCK reason
const REASONS = ['DAMAGE', 'EXPIRY', 'LOSS', 'RECOUNT', 'OTHER'];

// Signed quantity: negative removes stock, positive adds it. Not 0, at most 2 decimals
// (the database column is Decimal(12,2)). The sign rule per reason is checked in the service.
const quantity = z
  .number()
  .min(-9999999999.99)
  .max(9999999999.99)
  .refine((v) => v !== 0, { message: 'cannot be 0' })
  .refine((v) => Math.round(v * 100) / 100 === v, { message: 'at most 2 decimal places' });

const createSchema = z.object({
  branchId: z.number().int().positive().optional(), // Admin must send it; Manager and Staff default to their own
  productId: z.number().int().positive(),
  quantity,
  reason: z.enum(REASONS),
  note: z.string().trim().max(300).nullable().optional(),
});

// Contract 6.0, rule 1: authenticate, Auditor block, role, BRANCH, then validation.
// This runs before validate(), so Manager or Staff sending another branch gets 403, not 400.
const checkBranch = (req, res, next) => {
  const branchId = req.body && req.body.branchId;
  if (req.user.role !== 'ADMIN' && Number.isInteger(branchId) && branchId > 0) {
    assertBranchAccess(req.user, branchId);
  }
  next();
};

const router = express.Router();

// Read: Admin, Manager (own), Staff (own) and the Auditor (all branches, read-only)
router.get('/', requireRole('ADMIN', 'BRANCH_MANAGER', 'STAFF', 'AUDITOR'), controller.list);

// Create: Admin, Manager and Staff. The Auditor never writes (the global rule answers 403 first).
router.post('/', requireRole('ADMIN', 'BRANCH_MANAGER', 'STAFF'), checkBranch, validate(createSchema), controller.create);

module.exports = router;