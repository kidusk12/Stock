// backend/src/modules/branches/branches.routes.js
const express = require('express');
const { z } = require('zod');
const { validate } = require('../../middleware/validate');
const { requireRole } = require('../../middleware/auth');
const ctrl = require('./branches.controller');

const router = express.Router();

// G1: the database requires a unique branch code, so the API requires it too.
const codeField = z
  .string()
  .trim()
  .min(1)
  .max(20)
  .regex(/^\S+$/, 'No spaces allowed');

const createSchema = z.object({
  name: z.string().trim().min(1).max(150),
  code: codeField,
  address: z.string().trim().max(255).optional(),
  phone: z.string().trim().max(30).optional(),
});

const updateSchema = z
  .object({
    name: z.string().trim().min(1).max(150).optional(),
    code: codeField.optional(),
    address: z.string().trim().max(255).optional(),
    phone: z.string().trim().max(30).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: 'At least one field required',
  });

router.get('/', ctrl.list);
router.get('/:id', ctrl.get);
router.post('/', requireRole('ADMIN'), validate(createSchema), ctrl.create);
router.patch('/:id', requireRole('ADMIN'), validate(updateSchema), ctrl.update);

module.exports = router;