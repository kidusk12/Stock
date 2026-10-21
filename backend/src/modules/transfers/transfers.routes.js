const express = require('express');
const { z } = require('zod');
const controller = require('./transfers.controller');
const { requireRole, assertBranchAccess } = require('../../middleware/auth');
const { validate } = require('../../middleware/validate');

// Quantity: above 0, at most 2 decimals (the database column is Decimal(12,2))
const quantity = z
  .number()
  .positive()
  .max(9999999999.99)
  .refine((v) => Math.round(v * 100) / 100 === v, { message: 'at most 2 decimal places' });

const createSchema = z.object({
  fromBranchId: z.number().int().positive(), // the branch that sends the stock
  toBranchId: z.number().int().positive(), // the branch that asks for it (the requester)
  note: z.string().trim().max(300).nullable().optional(),
  items: z
    .array(
      z.object({
        productId: z.number().int().positive(),
        quantity,
      })
    )
    .min(1), // the same product twice is checked in the service (rule duplicate)
});

const receiveQuantity = z.number()
  .min(0)
  .max(9999999999.99)
  .refine((value) => Math.round(value * 100) / 100 === value, { message: 'at most 2 decimal places' });
const receiveSchema = z.object({
  items: z.array(z.object({ productId: z.number().int().positive(), quantity: receiveQuantity })).min(1).optional(),
});

// Contract 6.0, rule 1: authenticate, Auditor block, role, BRANCH, then validation.
// For a request, Manager and Staff may only ask for stock for their OWN branch (toBranchId).
// This runs before validate(), so another branch with a bad body is still 403, not 400.
const checkDestinationBranch = (req, res, next) => {
  const toBranchId = req.body && req.body.toBranchId;
  if (req.user.role !== 'ADMIN' && Number.isInteger(toBranchId) && toBranchId > 0) {
    assertBranchAccess(req.user, toBranchId);
  }
  next();
};

const router = express.Router();

// Reads (N2): Admin, Manager, Staff and the Auditor. The Auditor reads every transfer, read-only.
// The service limits Manager and Staff to transfers where their branch is the source or destination.
const canRead = requireRole('ADMIN', 'BRANCH_MANAGER', 'STAFF', 'AUDITOR');
router.get('/', canRead, controller.list);
router.get('/:id', canRead, controller.getById);

// Writes: the Auditor never writes. The global blockAuditorWrites rule already answers 403 before this point.
const canWrite = requireRole('ADMIN', 'BRANCH_MANAGER', 'STAFF');

// Request: Admin, Manager and Staff of the DESTINATION branch
router.post('/', canWrite, checkDestinationBranch, validate(createSchema), controller.create);

// Approve and reject: Admin and Manager of the SOURCE branch. Staff cannot (403).
router.post('/:id/approve', requireRole('ADMIN', 'BRANCH_MANAGER'), controller.approve);
router.post('/:id/reject', requireRole('ADMIN', 'BRANCH_MANAGER'), controller.reject);

// Ship (source branch) and receive (destination branch): Admin, Manager and Staff.
// The service checks that the user belongs to the right branch for that step.
router.post('/:id/ship', canWrite, controller.ship);
router.post('/:id/receive', canWrite, validate(receiveSchema), controller.receive);

module.exports = router;
module.exports.receiveSchema = receiveSchema;
