// backend/src/modules/suppliers/suppliers.routes.js
const express = require('express');
const { z } = require('zod');
const { validate } = require('../../middleware/validate');
const { requireRole } = require('../../middleware/auth');
const ctrl = require('./suppliers.controller');

const router = express.Router();

// Contract 5.3: Admin + Branch Manager can write; Staff can read (they pick a supplier for a PO);
// Auditor gets 403 on everything (also enforced by blockAuditorWrites at mount).
const READ_ROLES = ['ADMIN', 'BRANCH_MANAGER', 'STAFF'];
const WRITE_ROLES = ['ADMIN', 'BRANCH_MANAGER'];

const createSchema = z.object({
  name: z.string().trim().min(1).max(150),
  contactName: z.string().trim().max(150).optional(),
  phone: z.string().trim().max(30).optional(),
  tin: z.string().trim().max(50).optional(),
  address: z.string().trim().max(255).optional(),
});

const updateSchema = createSchema
  .partial()
  .extend({ isActive: z.boolean().optional() })
  .refine((v) => Object.keys(v).length > 0, {
    message: 'At least one field required',
  });

router.get('/', requireRole(...READ_ROLES), ctrl.list);
router.get('/:id', requireRole(...READ_ROLES), ctrl.get);
router.post('/', requireRole(...WRITE_ROLES), validate(createSchema), ctrl.create);
router.patch('/:id', requireRole(...WRITE_ROLES), validate(updateSchema), ctrl.update);

module.exports = router;