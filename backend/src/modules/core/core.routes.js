const express = require('express');
const { z } = require('zod');
const { requireRole } = require('../../middleware/auth');
const { validate } = require('../../middleware/validate');
const { AppError } = require('../../middleware/errors');
const c = require('./core.controller');

const router = express.Router();
const parseMultipart = (req, res, next) => {
  const type = req.headers['content-type'] || '';
  const match = type.match(/^multipart\/form-data\s*;\s*boundary=(?:"([^"]+)"|([^;]+))/i);
  if (!match) return next(new AppError(400, 'VALIDATION_ERROR', 'Expected multipart/form-data', [{ field: 'file', rule: 'invalid', issue: 'use a CSV multipart upload' }]));
  const boundary = Buffer.from(`--${(match[1] || match[2]).trim()}`);
  const chunks = []; let size = 0; let tooLarge = false;
  req.on('data', (chunk) => { size += chunk.length; if (size > 5 * 1024 * 1024 + 65536) tooLarge = true; else if (!tooLarge) chunks.push(chunk); });
  req.on('end', () => {
    try {
      if (tooLarge) throw new Error('Upload exceeds the 5 MB limit');
      const body = Buffer.concat(chunks); const fields = {}; let cursor = 0; let files = 0;
      while ((cursor = body.indexOf(boundary, cursor)) !== -1) {
        cursor += boundary.length;
        if (body.subarray(cursor, cursor + 2).toString() === '--') break;
        if (body.subarray(cursor, cursor + 2).toString() === '\r\n') cursor += 2;
        const headerEnd = body.indexOf(Buffer.from('\r\n\r\n'), cursor);
        if (headerEnd < 0) throw new Error('Malformed multipart headers');
        const headers = body.subarray(cursor, headerEnd).toString('utf8');
        const disposition = headers.match(/content-disposition:\s*form-data;[^\r\n]*name="([^"]+)"(?:;\s*filename="([^"]*)")?/i);
        if (!disposition) throw new Error('Multipart field name is required');
        const dataStart = headerEnd + 4;
        const nextBoundary = body.indexOf(Buffer.concat([Buffer.from('\r\n'), boundary]), dataStart);
        if (nextBoundary < 0) throw new Error('Malformed multipart field');
        const value = body.subarray(dataStart, nextBoundary);
        if (disposition[2] !== undefined) {
          files += 1;
          if (files > 1 || disposition[1] !== 'file' || value.length > 5 * 1024 * 1024 || !disposition[2].toLowerCase().endsWith('.csv')) throw new Error('Only one CSV file up to 5 MB is accepted');
          const mime = headers.match(/content-type:\s*([^\r\n]+)/i);
          req.file = { buffer: value, originalname: disposition[2], mimetype: mime?.[1] || 'application/octet-stream' };
        } else fields[disposition[1]] = value.toString('utf8');
        cursor = nextBoundary + 2;
      }
      req.body = fields; next();
    } catch (error) { next(new AppError(400, 'VALIDATION_ERROR', error.message, [{ field: 'file', rule: 'invalid', issue: error.message }])); }
  });
};
const qty = z.number().positive().max(9999999999.99).refine((v) => Math.round(v * 100) / 100 === v, 'at most 2 decimal places');
const money = z.number().min(0).max(9999999999.99).refine((v) => Math.round(v * 100) / 100 === v, 'at most 2 decimal places');
const lineItems = z.array(z.object({ productId: z.number().int().positive(), quantity: qty }).strict()).min(1);
const poCreate = z.object({ supplierId: z.number().int().positive(), branchId: z.number().int().positive().optional(), note: z.string().max(500).nullable().optional(),
  items: z.array(z.object({ productId: z.number().int().positive(), quantity: qty, unitCost: money }).strict()).min(1) }).strict();
const saleCreate = z.object({ branchId: z.number().int().positive().optional(), customerName: z.string().max(100).nullable().optional(), items: lineItems }).strict();
const transferCreate = z.object({ fromBranchId: z.number().int().positive(), toBranchId: z.number().int().positive(), note: z.string().max(300).nullable().optional(), items: lineItems }).strict();
const settingUpdate = z.object({ companyName: z.string().trim().min(1).max(150), address: z.string().max(255).nullable().optional(),
  phone: z.string().max(50).nullable().optional(), tin: z.string().max(20).nullable().optional(), taxType: z.enum(['VAT', 'TOT']),
  taxRate: z.number().min(0).max(100).refine((v) => Math.round(v * 100) / 100 === v) }).strict();
const adjustment = z.object({ branchId: z.number().int().positive().optional(), productId: z.number().int().positive(),
  quantity: z.number().finite().refine((v) => v !== 0 && Math.round(v * 100) / 100 === v),
  reason: z.enum(['OPENING_STOCK', 'DAMAGE', 'EXPIRY', 'LOSS', 'RECOUNT', 'OTHER']), note: z.string().max(300).nullable().optional() })
  .strict().transform((b) => ({ ...b, quantityChange: b.quantity }));
const returnCreate = z.object({ items: z.array(z.object({ saleItemId: z.number().int().positive(), quantity: qty }).strict()).min(1),
  reason: z.string().max(300).nullable().optional() }).strict();
const actionReason = z.object({ reason: z.string().max(300).optional() }).strict();
const receive = z.object({ items: z.array(z.object({ id: z.number().int().positive(), quantity: qty }).strict()).min(1) }).strict();

router.get('/settings/company', requireRole('ADMIN'), c.settingsGet);
router.put('/settings/company', requireRole('ADMIN'), validate(settingUpdate), c.settingsPut);

router.route('/purchase-orders').get(requireRole('ADMIN', 'BRANCH_MANAGER', 'STAFF'), c.poList)
  .post(requireRole('ADMIN', 'BRANCH_MANAGER', 'STAFF'), validate(poCreate), c.poCreate);
router.get('/purchase-orders/:id', requireRole('ADMIN', 'BRANCH_MANAGER', 'STAFF'), c.poGet);
router.post('/purchase-orders/:id/approve', requireRole('ADMIN', 'BRANCH_MANAGER'), c.poApprove);
router.post('/purchase-orders/:id/reject', requireRole('ADMIN', 'BRANCH_MANAGER'), validate(actionReason), c.poReject);
router.post('/purchase-orders/:id/receive', requireRole('ADMIN', 'BRANCH_MANAGER', 'STAFF'), validate(receive), c.poReceive);

router.route('/sales').get(requireRole('ADMIN', 'BRANCH_MANAGER', 'STAFF'), c.saleList)
  .post(requireRole('ADMIN', 'BRANCH_MANAGER', 'STAFF'), validate(saleCreate), c.saleCreate);
router.get('/sales/:id', requireRole('ADMIN', 'BRANCH_MANAGER', 'STAFF'), c.saleGet);
router.post('/sales/:id/returns', requireRole('ADMIN', 'BRANCH_MANAGER', 'STAFF'), validate(returnCreate), c.returnCreate);
router.get('/returns', requireRole('ADMIN', 'BRANCH_MANAGER', 'STAFF'), c.returnList);
router.get('/returns/:id', requireRole('ADMIN', 'BRANCH_MANAGER', 'STAFF'), c.returnGet);
router.patch('/returns/:id/refund', requireRole('ADMIN', 'BRANCH_MANAGER', 'STAFF'), c.returnRefund);

router.route('/adjustments').get(requireRole('ADMIN', 'BRANCH_MANAGER', 'STAFF', 'AUDITOR'), c.adjustmentList)
  .post(requireRole('ADMIN', 'BRANCH_MANAGER', 'STAFF'), validate(adjustment), c.adjustmentCreate);

router.route('/transfers').get(requireRole('ADMIN', 'BRANCH_MANAGER', 'STAFF'), c.transferList)
  .post(requireRole('ADMIN', 'BRANCH_MANAGER', 'STAFF'), validate(transferCreate), c.transferCreate);
router.get('/transfers/:id', requireRole('ADMIN', 'BRANCH_MANAGER', 'STAFF'), c.transferGet);
router.post('/transfers/:id/approve', requireRole('ADMIN', 'BRANCH_MANAGER'), c.transferAction('approve'));
router.post('/transfers/:id/reject', requireRole('ADMIN', 'BRANCH_MANAGER'), validate(actionReason), c.transferAction('reject'));
router.post('/transfers/:id/ship', requireRole('ADMIN', 'BRANCH_MANAGER', 'STAFF'), c.transferAction('ship'));
router.post('/transfers/:id/receive', requireRole('ADMIN', 'BRANCH_MANAGER', 'STAFF'), c.transferAction('receive'));

router.get('/notifications', requireRole('ADMIN', 'BRANCH_MANAGER'), c.notificationsList);
router.post('/notifications/read-all', requireRole('ADMIN', 'BRANCH_MANAGER'), c.notificationsReadAll);
router.post('/notifications/:id/read', requireRole('ADMIN', 'BRANCH_MANAGER'), c.notificationRead);
router.get('/low-stock', requireRole('ADMIN', 'BRANCH_MANAGER'), c.lowStock);
router.get('/audit-logs', requireRole('ADMIN', 'BRANCH_MANAGER', 'AUDITOR'), c.auditLogs);
router.get('/dashboard', c.dashboard);
router.get('/reports/stock', requireRole('ADMIN', 'BRANCH_MANAGER', 'AUDITOR'), c.reportStock);
router.get('/reports/sales', requireRole('ADMIN', 'BRANCH_MANAGER', 'AUDITOR'), c.reportSales);
router.get('/reports/movements', requireRole('ADMIN', 'BRANCH_MANAGER', 'AUDITOR'), c.reportMovements);
router.get('/import/products/template', requireRole('ADMIN'), c.importTemplate);
router.post('/import/products', requireRole('ADMIN'), parseMultipart, c.importProducts);

module.exports = router;
