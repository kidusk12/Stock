// backend/src/modules/categories/categories.routes.js
const express = require('express');
const { z } = require('zod');
const { validate } = require('../../middleware/validate');
const { requireRole } = require('../../middleware/auth');
const ctrl = require('./categories.controller');

const router = express.Router();

const createSchema = z.object({ name: z.string().trim().min(1).max(100) });
const updateSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  isActive: z.boolean().optional(),
}).refine((v) => Object.keys(v).length > 0, { message: 'At least one field required' });

router.get('/', ctrl.list);
router.get('/:id', ctrl.get);
router.post('/', requireRole('ADMIN'), validate(createSchema), ctrl.create);
router.patch('/:id', requireRole('ADMIN'), validate(updateSchema), ctrl.update);

module.exports = router;