const fs = require('node:fs/promises');
const { Prisma } = require('@prisma/client');
const prisma = require('../../config/db');
const { AppError } = require('../../middleware/errors');
const { validationError } = require('../../middleware/validate');
const { parseIntParam } = require('../../utils/params');
const { createStockRowsForProduct, applyMovement } = require('../../services/stockService');
const { writeAudit, AUDIT_ACTIONS } = require('../../middleware/audit');
const { parseCsv } = require('./csv');

const TEMPLATE = '\uFEFFsku,name,barcode,category,unit,costPrice,sellingPrice,openingQuantity\r\n';
const OPTIONAL_TEXT = new Set(['barcode', 'category']);

function parseNumber(value, field, row, errors, { required = false } = {}) {
  if (value === '' && !required) return 0;
  if (value === '' && required) {
    errors.push({ field, code: 'REQUIRED', message: `${field} is required` });
    return null;
  }
  if (!/^(?:\d+\.?\d*|\.\d+)$/.test(value)) {
    errors.push({ field, code: 'INVALID_NUMBER', message: `${field} must be a valid non-negative number` });
    return null;
  }
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || Math.round(number * 100) / 100 !== number) {
    errors.push({ field, code: 'INVALID_NUMBER', message: `${field} must be non-negative with at most 2 decimal places` });
    return null;
  }
  if (number > 9999999999.99) {
    errors.push({ field, code: 'INVALID_NUMBER', message: `${field} is too large` });
    return null;
  }
  return number;
}

function validateFields({ row, data }, seen) {
  const errors = [];
  for (const field of ['sku', 'name', 'unit']) {
    if (!data[field]) errors.push({ field, code: 'REQUIRED', message: `${field} is required` });
  }
  if (data.sku && (data.sku.length > 50 || /\s/.test(data.sku))) errors.push({ field: 'sku', code: 'INVALID_SKU', message: 'SKU must be at most 50 characters and contain no spaces' });
  if (data.name.length > 150) errors.push({ field: 'name', code: 'INVALID_NAME', message: 'Name must be at most 150 characters' });
  if (data.unit.length > 20) errors.push({ field: 'unit', code: 'INVALID_UNIT', message: 'Unit must be at most 20 characters' });
  if (data.barcode.length > 50) errors.push({ field: 'barcode', code: 'INVALID_BARCODE', message: 'Barcode must be at most 50 characters' });

  if (data.sku) {
    if (seen.skus.has(data.sku)) errors.push({ field: 'sku', code: 'DUPLICATE_SKU', message: 'SKU is duplicated in this file' });
    seen.skus.add(data.sku);
  }
  if (data.barcode) {
    if (seen.barcodes.has(data.barcode)) errors.push({ field: 'barcode', code: 'DUPLICATE_BARCODE', message: 'Barcode is duplicated in this file' });
    seen.barcodes.add(data.barcode);
  }

  const costPrice = parseNumber(data.costPrice, 'costPrice', row, errors, { required: true });
  const sellingPrice = parseNumber(data.sellingPrice, 'sellingPrice', row, errors, { required: true });
  const openingQuantity = parseNumber(data.openingQuantity, 'openingQuantity', row, errors);
  return {
    row,
    data: { ...data, barcode: data.barcode || null, costPrice, sellingPrice, openingQuantity },
    errors,
  };
}

async function validateRows(text, branchId) {
  const rawRows = parseCsv(text);
  const seen = { skus: new Set(), barcodes: new Set() };
  const rows = rawRows.map((row) => validateFields(row, seen));
  const skus = [...new Set(rows.map((row) => row.data.sku).filter(Boolean))];
  const barcodes = [...new Set(rows.map((row) => row.data.barcode).filter(Boolean))];
  const [existingSkus, existingBarcodes, categories] = await Promise.all([
    skus.length ? prisma.product.findMany({ where: { sku: { in: skus } }, select: { sku: true } }) : [],
    barcodes.length ? prisma.product.findMany({ where: { barcode: { in: barcodes } }, select: { barcode: true } }) : [],
    prisma.category.findMany({ where: { isActive: true }, select: { id: true, name: true } }),
  ]);
  const skuSet = new Set(existingSkus.map((product) => product.sku));
  const barcodeSet = new Set(existingBarcodes.map((product) => product.barcode));
  const categoryByName = new Map(categories.map((category) => [category.name.toLocaleLowerCase(), category]));

  for (const row of rows) {
    if (row.data.sku && skuSet.has(row.data.sku)) row.errors.push({ field: 'sku', code: 'DUPLICATE_SKU', message: 'SKU already exists' });
    if (row.data.barcode && barcodeSet.has(row.data.barcode)) row.errors.push({ field: 'barcode', code: 'DUPLICATE_BARCODE', message: 'Barcode already exists' });
    if (row.data.category) {
      const category = categoryByName.get(row.data.category.toLocaleLowerCase());
      if (!category) row.errors.push({ field: 'category', code: 'UNKNOWN_CATEGORY', message: 'Category does not exist or is inactive' });
      else row.data.categoryId = category.id;
    }
  }

  const needsOpeningBranch = rows.some((row) => row.data.openingQuantity > 0);
  if (needsOpeningBranch && branchId === undefined) {
    throw validationError('branchId is required when importing opening stock', 'branchId', 'required', 'send a branchId for rows with openingQuantity above 0');
  }
  if (needsOpeningBranch) {
    const branch = await prisma.branch.findUnique({ where: { id: branchId }, select: { id: true, isActive: true } });
    if (!branch || !branch.isActive) {
      throw validationError('Opening stock branch must exist and be active', 'branchId', 'invalid', 'branch not found or inactive');
    }
  }

  return rows.map((row) => ({ ...row, valid: row.errors.length === 0 }));
}

function parseBranchId(raw) {
  if (raw === undefined || raw === null || raw === '') return undefined;
  return parseIntParam(String(Array.isArray(raw) ? raw[0] : raw), 'branchId');
}

async function importProducts(file, rawBranchId, user, dryRun) {
  if (!file || !file.filepath) throw validationError('CSV file is required', 'file', 'required', 'send a CSV file in the file field');
  const branchId = parseBranchId(rawBranchId);
  let text;
  try {
    text = await fs.readFile(file.filepath, 'utf8');
  } catch {
    throw validationError('CSV file could not be read', 'file', 'invalid', 'file is unreadable');
  }

  const rows = await validateRows(text, branchId);
  const validRows = rows.filter((row) => row.valid);
  const invalidRows = rows.filter((row) => !row.valid);
  if (dryRun) {
    return {
      dryRun: true,
      totalRows: rows.length,
      validRows: validRows.length,
      invalidRows: invalidRows.length,
      rows: rows.map(({ row, valid, data, errors }) => ({ row, valid, data, errors })),
    };
  }

  const importedProducts = await prisma.$transaction(async (tx) => {
    const created = [];
    for (const row of validRows) {
      const product = await tx.product.create({ data: {
        sku: row.data.sku,
        name: row.data.name,
        barcode: row.data.barcode,
        categoryId: row.data.categoryId || null,
        unit: row.data.unit,
        costPrice: new Prisma.Decimal(row.data.costPrice),
        sellingPrice: new Prisma.Decimal(row.data.sellingPrice),
      } });
      await createStockRowsForProduct(product.id, tx);
      if (row.data.openingQuantity > 0) {
        await applyMovement({
          productId: product.id,
          branchId,
          quantity: row.data.openingQuantity.toFixed(2),
          type: 'OPENING_STOCK',
          reason: 'Opening stock (CSV import)',
          referenceType: 'IMPORT',
          referenceId: null,
          userId: user.userId,
        }, tx);
      }
      created.push(product);
    }
    if (created.length > 0) {
      await writeAudit({
        userId: user.userId,
        action: AUDIT_ACTIONS.IMPORT_CONFIRMED,
        entityType: 'IMPORT',
        branchId: branchId ?? null,
        oldValue: null,
        newValue: { imported: created.length, skipped: invalidRows.length, productIds: created.map((product) => product.id) },
      }, tx);
    }
    return created;
  }, { timeout: 60000 });

  return {
    dryRun: false,
    imported: importedProducts.length,
    skipped: invalidRows.length,
    skippedRows: invalidRows.map(({ row, errors }) => ({ row, errors })),
  };
}

module.exports = { TEMPLATE, importProducts };
