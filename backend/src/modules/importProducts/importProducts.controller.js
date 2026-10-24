const fs = require('node:fs/promises');
const { formidable } = require('formidable');
const { asyncHandler } = require('../../middleware/errors');
const importService = require('./importProducts.service');

const template = (req, res) => {
  res.status(200)
    .set('Content-Type', 'text/csv; charset=utf-8')
    .set('Content-Disposition', 'attachment; filename="product-import-template.csv"')
    .send(importService.TEMPLATE);
};

const create = asyncHandler(async (req, res) => {
  const dryRun = req.query.dryRun;
  if (dryRun !== 'true' && dryRun !== 'false') {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'dryRun must be true or false', details: [{ field: 'dryRun', rule: 'required', issue: 'use true or false' }] } });
    return;
  }

  let parsed;
  try {
    const form = formidable({ maxFileSize: 5 * 1024 * 1024, maxFiles: 1, allowEmptyFiles: false, multiples: false });
    parsed = await form.parse(req);
  } catch {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid or unreadable CSV upload', details: [{ field: 'file', rule: 'invalid', issue: 'upload one readable CSV file' }] } });
    return;
  }

  const [fields, files] = parsed;
  const file = Array.isArray(files.file) ? files.file[0] : files.file;
  try {
    res.status(200).json(await importService.importProducts(file, fields.branchId, req.user, dryRun === 'true'));
  } finally {
    if (file?.filepath) await fs.unlink(file.filepath).catch(() => {});
  }
});

module.exports = { template, create };
