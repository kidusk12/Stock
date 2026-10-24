const express = require('express');
const { z } = require('zod');
const controller = require('./users.controller');
const { requireRole } = require('../../middleware/auth');
const { validate } = require('../../middleware/validate');

const router = express.Router();

// Contract section 4: only these three roles can be created. ADMIN is refused on create.
const createRoleSchema = z.enum(['BRANCH_MANAGER', 'STAFF', 'AUDITOR']);
// On update ADMIN is accepted as a value so the screen can send the whole object back.
// The service refuses a real change to or from ADMIN.
const roleSchema = z.enum(['ADMIN', 'BRANCH_MANAGER', 'STAFF', 'AUDITOR']);
const branchIdSchema = z.number().int().positive().nullable();

// bcrypt only reads the first 72 bytes, and a very long password makes hashing slow
const passwordSchema = z
  .string()
  .min(8, 'must be at least 8 characters')
  .max(72, 'must be at most 72 characters');

const createSchema = z.object({
  username: z.string().trim().min(3).max(50).regex(/^\S+$/, 'must not contain spaces'),
  fullName: z.string().trim().min(1).max(100),
  password: passwordSchema,
  role: createRoleSchema,
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
  newPassword: passwordSchema,
});

// Contract section 4: every user endpoint is Admin only.
router.use(requireRole('ADMIN'));

router.get('/', controller.list);
router.post('/', validate(createSchema), controller.create);
router.get('/:id', controller.getById);
router.patch('/:id', validate(updateSchema), controller.update);
router.post('/:id/reset-password', validate(resetPasswordSchema), controller.resetPassword);

module.exports = router;