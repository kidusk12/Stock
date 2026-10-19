const { Prisma } = require('@prisma/client');
const prisma = require('../../config/db');
const { AppError } = require('../../middleware/errors');
const { applyMovement, createStockRowsForProduct } = require('../../services/stockService');

function parseCsv(text) {
  const source = String(text || '').replace(/^\uFEFF/, '');
  const rows = [];
  let row = [], field = '', quoted = false;
  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i];
    if (quoted) {
      if (ch === '"' && source[i + 1] === '"') { field += '"'; i += 1; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"' && field.length === 0) quoted = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && source[i + 1] === '\n') i += 1;
      row.push(field); field = '';
      if (row.some((value) => value.trim() !== '')) rows.push(row);
      row = [];
    } else field += ch;
  }
  if (quoted) throw new Error('Unclosed quoted field');
  if (field.length || row.length) { row.push(field); if (row.some((value) => value.trim() !== '')) rows.push(row); }
  if (!rows.length) throw new Error('CSV is empty');
  const headers = rows.shift().map((h) => h.trim());
  if (new Set(headers).size !== headers.length || headers.some((h) => !h)) throw new Error('CSV headers must be unique and non-empty');
  return rows.map((values) => Object.fromEntries(headers.map((header, i) => [header, (values[i] ?? '').trim()])));
}

const importError = (field, code, message) => ({ field, code, message });
function numberField(value, field, errors, { required = false } = {}) {
  if (value === '' && !required) return 0;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || Math.round(n * 100) / 100 !== n) {
    errors.push(importError(field, 'VALIDATION_ERROR', 'Enter a non-negative number with at most two decimals'));
    return null;
  }
  return n;
}

async function previewOrImport(fileBuffer, { dryRun, branchId, userId }) {
  let parsed;
  try { parsed = parseCsv(fileBuffer.toString('utf8')); }
  catch (e) { throw new AppError(400, 'VALIDATION_ERROR', `Unreadable CSV: ${e.message}`, [{ field: 'file', rule: 'invalid', issue: e.message }]); }
  const requiredHeaders = ['sku', 'name', 'category', 'unit', 'costPrice', 'sellingPrice'];
  const headers = Object.keys(parsed[0] || {});
  const missing = requiredHeaders.filter((h) => !headers.includes(h));
  if (missing.length) throw new AppError(400, 'VALIDATION_ERROR', 'CSV is missing required columns',
    missing.map((field) => ({ field, rule: 'required', issue: 'missing CSV column' })));

  const seenSku = new Set(), seenBarcode = new Set();
  const rows = [];
  let hasOpening = false;
  for (let index = 0; index < parsed.length; index += 1) {
    const data = parsed[index];
    const errors = [];
    const rowNo = index + 2;
    const sku = data.sku;
    const name = data.name;
    const barcode = data.barcode || null;
    if (!sku) errors.push(importError('sku', 'VALIDATION_ERROR', 'SKU is required'));
    if (!name) errors.push(importError('name', 'VALIDATION_ERROR', 'Name is required'));
    if (!data.category) errors.push(importError('category', 'VALIDATION_ERROR', 'Category is required'));
    if (!data.unit) errors.push(importError('unit', 'VALIDATION_ERROR', 'Unit is required'));
    const costPrice = numberField(data.costPrice, 'costPrice', errors, { required: true });
    const sellingPrice = numberField(data.sellingPrice, 'sellingPrice', errors, { required: true });
    const openingQuantity = numberField(data.openingQuantity, 'openingQuantity', errors);
    if (openingQuantity > 0) hasOpening = true;
    let categoryId = null;
    if (data.category) {
      const category = await prisma.category.findFirst({ where: { name: { equals: data.category, mode: 'insensitive' } } });
      if (!category) errors.push(importError('category', 'NOT_FOUND', 'Category was not found'));
      else if (!category.isActive) errors.push(importError('category', 'VALIDATION_ERROR', 'Category is inactive'));
      else categoryId = category.id;
    }
    if (sku && seenSku.has(sku.toLowerCase())) errors.push(importError('sku', 'DUPLICATE_SKU', 'SKU is repeated in the file'));
    if (sku) seenSku.add(sku.toLowerCase());
    if (barcode && seenBarcode.has(barcode)) errors.push(importError('barcode', 'DUPLICATE_BARCODE', 'Barcode is repeated in the file'));
    if (barcode) seenBarcode.add(barcode);
    if (sku && await prisma.product.findUnique({ where: { sku }, select: { id: true } })) errors.push(importError('sku', 'DUPLICATE_SKU', 'SKU already exists'));
    if (barcode && await prisma.product.findUnique({ where: { barcode }, select: { id: true } })) errors.push(importError('barcode', 'DUPLICATE_BARCODE', 'Barcode already exists'));
    rows.push({ row: rowNo, valid: errors.length === 0, data: { sku, name, barcode, category: data.category, categoryId,
      unit: data.unit, costPrice, sellingPrice, openingQuantity }, errors });
  }
  let importBranchId = null;
  if (hasOpening) {
    importBranchId = Number(branchId);
    if (!Number.isInteger(importBranchId) || importBranchId < 1) throw new AppError(400, 'VALIDATION_ERROR', 'branchId is required for opening quantities',
      [{ field: 'branchId', rule: 'required', issue: 'select a branch for opening stock' }]);
    const branch = await prisma.branch.findUnique({ where: { id: importBranchId } });
    if (!branch || !branch.isActive) throw new AppError(400, 'VALIDATION_ERROR', 'Branch is unknown or inactive',
      [{ field: 'branchId', rule: 'invalid', issue: 'branch must exist and be active' }]);
  }
  if (dryRun) return { dryRun: true, totalRows: rows.length, validRows: rows.filter((r) => r.valid).length,
    invalidRows: rows.filter((r) => !r.valid).length, rows };

  let imported = 0;
  const skippedRows = rows.filter((r) => !r.valid).map(({ row, errors }) => ({ row, errors }));
  for (const row of rows.filter((r) => r.valid)) {
    try {
      await prisma.$transaction(async (tx) => {
        const product = await tx.product.create({ data: { name: row.data.name, sku: row.data.sku, barcode: row.data.barcode,
          categoryId: row.data.categoryId, unit: row.data.unit, costPrice: new Prisma.Decimal(row.data.costPrice), sellingPrice: new Prisma.Decimal(row.data.sellingPrice) } });
        await createStockRowsForProduct(product.id, tx);
        if (row.data.openingQuantity > 0) await applyMovement({ productId: product.id, branchId: importBranchId,
          quantity: row.data.openingQuantity, type: 'OPENING_STOCK', referenceType: 'IMPORT', referenceId: product.id, userId }, tx);
        await tx.auditLog.create({ data: { userId, action: 'IMPORT_CONFIRMED', entityType: 'IMPORT', entityId: product.id,
          branchId: importBranchId, newValue: { sku: product.sku, openingQuantity: row.data.openingQuantity } } });
      });
      imported += 1;
    } catch (e) {
      const duplicateCode = e.code === 'P2002' ? (String(e.meta?.target).includes('barcode') ? 'DUPLICATE_BARCODE' : 'DUPLICATE_SKU') : null;
      skippedRows.push({ row: row.row, errors: [importError(duplicateCode === 'DUPLICATE_BARCODE' ? 'barcode' : 'sku',
        duplicateCode || 'VALIDATION_ERROR', duplicateCode ? 'Value already exists' : 'Row could not be imported')] });
    }
  }
  return { dryRun: false, imported, skipped: skippedRows.length, skippedRows };
}

module.exports = { previewOrImport };
