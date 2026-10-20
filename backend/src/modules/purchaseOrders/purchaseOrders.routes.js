const express = require('express');
const { z } = require('zod');
const controller = require('./purchaseOrders.controller');
const prisma = require('../../config/db');
const { AppError, asyncHandler } = require('../../middleware/errors');
const { requireRole, assertBranchAccess } = require('../../middleware/auth');
const { validate } = require('../../middleware/validate');
const { parseIdOr404 } = require('../../utils/params');

// Quantities: above 0, at most 2 decimal places.
const quantity = z
  .number()
  .positive()
  .max(9999999999.99)
  .refine((v) => Math.round(v * 100) / 100 === v, {
    message: 'at most 2 decimal places',
  });

// Unit cost: 0 or more, at most 2 decimal places.
const unitCost = z
  .number()
  .min(0)
  .max(9999999999.99)
  .refine((v) => Math.round(v * 100) / 100 === v, {
    message: 'at most 2 decimal places',
  });

// POST /api/purchase-orders
const createSchema = z.object({
  supplierId: z.number().int().positive(),
  branchId: z.number().int().positive().optional(),
  note: z.string().trim().max(500).nullable().optional(),
  items: z
    .array(
      z.object({
        productId: z.number().int().positive(),
        quantity,
        unitCost,
      })
    )
    .min(1),
});

// POST /api/purchase-orders/:id/reject
// The entire body and the reason are optional.
const rejectSchema = z
  .object({
    reason: z.string().trim().max(300).nullable().optional(),
  })
  .optional();

const router = express.Router();

// For create: branch authorization must run before request validation.
// Admin must send branchId; Manager and Staff use their own branch.
const checkCreateBranch = (req, res, next) => {
  const branchId = req.body && req.body.branchId;

  if (
    req.user.role !== 'ADMIN' &&
    Number.isInteger(branchId) &&
    branchId > 0
  ) {
    assertBranchAccess(req.user, branchId);
  }

  next();
};

// Resolve the PO and check branch access before validating the request
// body or performing the requested action.
const checkPOBranch = asyncHandler(async (req, res, next) => {
  const id = parseIdOr404(req.params.id, 'Purchase order not found');

  const po = await prisma.purchaseOrder.findUnique({
    where: { id },
    select: { id: true, branchId: true },
  });

  if (!po) {
    throw new AppError(404, 'NOT_FOUND', 'Purchase order not found');
  }

  assertBranchAccess(req.user, po.branchId);
  next();
});

// Read access: Admin and Auditor can read all branches;
// Manager and Staff are limited to their own branch.
router.get(
  '/',
  requireRole('ADMIN', 'AUDITOR', 'BRANCH_MANAGER', 'STAFF'),
  controller.list
);

router.get(
  '/:id',
  requireRole('ADMIN', 'AUDITOR', 'BRANCH_MANAGER', 'STAFF'),
  controller.getById
);

// Create: Admin, Manager and Staff. Auditor cannot write.
router.post(
  '/',
  requireRole('ADMIN', 'BRANCH_MANAGER', 'STAFF'),
  checkCreateBranch,
  validate(createSchema),
  controller.create
);

// Approve: Admin and Manager.
router.post(
  '/:id/approve',
  requireRole('ADMIN', 'BRANCH_MANAGER'),
  checkPOBranch,
  controller.approve
);

// Reject: Admin and Manager; optional reason up to 300 characters.
router.post(
  '/:id/reject',
  requireRole('ADMIN', 'BRANCH_MANAGER'),
  checkPOBranch,
  validate(rejectSchema),
  controller.reject
);

// Receive: Admin, Manager and Staff. Partial receiving is not supported.
router.post(
  '/:id/receive',
  requireRole('ADMIN', 'BRANCH_MANAGER', 'STAFF'),
  checkPOBranch,
  controller.receive
);

module.exports = router;