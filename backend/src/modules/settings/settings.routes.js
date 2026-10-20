const express = require('express');
const { z } = require('zod');
const controller = require('./settings.controller');
const { requireRole } = require('../../middleware/auth');
const { validate } = require('../../middleware/validate');

// Percentage from 0 to 100, at most 2 decimals (the database stores a fraction, Decimal(5,4)).
const taxRate = z
  .number()
  .min(0)
  .max(100)
  .refine((v) => Math.round(v * 100) / 100 === v, { message: 'at most 2 decimal places' });

// address, phone and tin may be left out, null or empty (empty is saved as null).
// Max lengths for address and phone are not in the contract; 300 and 30 are my choice.
const optionalText = (max) => z.string().trim().max(max).nullable().optional();

// Unknown keys (defaultTaxRates, nextInvoiceNumber) are dropped by the schema, so they are ignored.
const updateSchema = z.object({
  companyName: z.string().trim().min(1).max(150),
  address: optionalText(300),
  phone: optionalText(30),
  tin: optionalText(20),
  taxType: z.enum(['VAT', 'TOT']),
  taxRate,
});

const router = express.Router();

// Contract 6.0, rule 1: authenticate, Auditor write block, role, then validation.
// Admin only, for both read and change (1.6).
router.get('/company', requireRole('ADMIN'), controller.get);
router.put('/company', requireRole('ADMIN'), validate(updateSchema), controller.update);

module.exports = router;