const express = require('express');
const { z } = require('zod');
const prisma = require('../../config/db');
const { AppError, asyncHandler } = require('../../middleware/errors');
const { requireRole, assertBranchAccess } = require('../../middleware/auth');
const { validate } = require('../../middleware/validate');
const controller = require('./returns.controller');

const quantity = z.number()
  .positive()
  .max(9999999999.99)
  .refine((value) => Math.round(value * 100) / 100 === value, { message: 'at most 2 decimal places' });

const createSchema = z.object({
  items: z.array(z.object({ saleItemId: z.number().int().positive(), quantity })).min(1),
  reason: z.string().trim().nullable().optional(),
});

const checkSaleBranch = asyncHandler(async (req, res, next) => {
  const saleId = Number(req.params.id);
  if (!Number.isInteger(saleId) || saleId < 1) throw new AppError(404, 'NOT_FOUND', 'Sale not found');
  const sale = await prisma.sale.findUnique({ where: { id: saleId }, select: { branchId: true } });
  if (!sale) throw new AppError(404, 'NOT_FOUND', 'Sale not found');
  assertBranchAccess(req.user, sale.branchId);
  next();
});

const checkReturnBranch = asyncHandler(async (req, res, next) => {
  const returnId = Number(req.params.id);
  if (!Number.isInteger(returnId) || returnId < 1) throw new AppError(404, 'NOT_FOUND', 'Return not found');
  const record = await prisma.saleReturn.findUnique({ where: { id: returnId }, select: { branchId: true } });
  if (!record) throw new AppError(404, 'NOT_FOUND', 'Return not found');
  assertBranchAccess(req.user, record.branchId);
  next();
});

const router = express.Router();
const RETURN_ROLES = ['ADMIN', 'BRANCH_MANAGER', 'STAFF'];

router.get('/', requireRole(...RETURN_ROLES), controller.list);
router.get('/:id', requireRole(...RETURN_ROLES), controller.get);
router.patch('/:id/refund', requireRole(...RETURN_ROLES), checkReturnBranch, controller.refund);

module.exports = { router, createSchema, checkSaleBranch, RETURN_ROLES };
