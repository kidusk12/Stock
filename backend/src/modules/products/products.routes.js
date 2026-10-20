// backend/src/modules/products/products.routes.js
const express = require('express');
const { z } = require('zod');
const { validate } = require('../../middleware/validate');
const { requireRole } = require('../../middleware/auth');
const ctrl = require('./products.controller');

const router = express.Router();

// Contract 5.4: reads are open to all roles; writes are Admin only.
const priceRule = z
  .number({ invalid_type_error: 'must be a number' })
  .min(0, 'must be 0 or more')
  .refine((n) => Number.isFinite(n) && Number(n.toFixed(2)) === n, 'at most 2 decimals');

const createSchema = z.object({
  name: z.string().trim().min(1).max(150),
  sku: z.string().trim().min(1).max(50).regex(/^\S+$/, 'No spaces allowed'),
  barcode: z.string().trim().min(1).max(50).nullable().optional(),
  categoryId: z.number().int().positive(),
  unit: z.string().trim().min(1).max(20),
  costPrice: priceRule,
  sellingPrice: priceRule,
});

const updateSchema = z
  .object({
    name: z.string().trim().min(1).max(150).optional(),
    sku: z.string().trim().min(1).max(50).regex(/^\S+$/, 'No spaces allowed').optional(),
    barcode: z.string().trim().min(1).max(50).nullable().optional(),
    categoryId: z.number().int().positive().optional(),
    unit: z.string().trim().min(1).max(20).optional(),
    costPrice: priceRule.optional(),
    sellingPrice: priceRule.optional(),
    isActive: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'At least one field required' });

// Order matters: /by-barcode must come before /:id.
// Contract 5.4 §4.1: by-barcode is Admin, Branch Manager, Staff — Auditor gets 403.
router.get(
  '/by-barcode/:barcode',
  requireRole('ADMIN', 'BRANCH_MANAGER', 'STAFF'),
  ctrl.getByBarcode
);

// Reads open to all roles (including Auditor)
router.get('/', ctrl.list);
router.get('/:id', ctrl.get);

// Writes: Admin only
router.post('/', requireRole('ADMIN'), validate(createSchema), ctrl.create);
router.patch('/:id', requireRole('ADMIN'), validate(updateSchema), ctrl.update);

module.exports = router;