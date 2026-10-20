const express = require('express');
const { z } = require('zod');
const controller = require('./users.controller');
const { requireRole } = require('../../middleware/auth');
const { validate } = require('../../middleware/validate');

const router = express.Router();

const roleSchema = z.enum(['ADMIN', 'BRANCH_MANAGER', 'STAFF', 'AUDITOR']);
const branchIdSchema = z.number().int().positive().nullable();

const createSchema = z.object({
  username: z.string().trim().min(3).max(50).regex(/^\S+$/, 'must not contain spaces'),
  fullName: z.string().trim().min(1).max(100),
  password: z.string().min(8, 'must be at least 8 characters'),
  role: roleSchema,
  branchId: branchIdSchema.optional(),
});

const updateSchema = z
  .object({
    fullName: z.string().trim().min(1).max(100).optional(),
    role: roleSchema.optional(),
    branchId: branchIdSchema.optional(),
    isActive: z.boolean().optional(),
  })
  .refine((body) => Object.keys(body).length > 0, { message: 'Send at least one field to change' });

const resetPasswordSchema = z.object({
  newPassword: z.string().min(8, 'must be at least 8 characters'),
});

// Contract section 4: every user endpoint is Admin only.
router.use(requireRole('ADMIN'));

router.get('/', controller.list);
router.post('/', validate(createSchema), controller.create);
router.get('/:id', controller.getById);
router.patch('/:id', validate(updateSchema), controller.update);
router.post('/:id/reset-password', validate(resetPasswordSchema), controller.resetPassword);

module.exports = router;