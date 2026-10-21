// backend/src/modules/products/products.service.js
const prisma = require('../../config/db');
const { AppError } = require('../../middleware/errors');
const { parsePagination } = require('../../utils/pagination');
const { parseSort } = require('../../utils/sort');
const { assertBranchAccess } = require('../../middleware/auth');
const { createStockRowsForProduct } = require('../../services/stockService');

const SORT_FIELDS = ['name', 'sku', 'sellingPrice', 'id'];

// N7: Staff never see costPrice.
function mapProduct(row, user, quantity) {
  const out = {
    id: row.id,
    name: row.name,
    sku: row.sku,
    barcode: row.barcode,
    categoryId: row.categoryId,
    categoryName: row.category?.name ?? null,
    unit: row.unit,
    costPrice: row.costPrice.toNumber(),
    sellingPrice: row.sellingPrice.toNumber(),
    isActive: row.isActive,
  };
  if (user.role === 'STAFF') delete out.costPrice;
  if (quantity !== undefined) out.quantity = Number(quantity);
  return out;
}

// Which branch applies for quantities?
//   Admin/Auditor: only when ?branchId= is passed
//   Manager/Staff: always their own branch (must match; else 403)
function resolveBranchId(req) {
  const role = req.user.role;
  const q = req.query.branchId;
  if (role === 'ADMIN' || role === 'AUDITOR') {
    if (q === undefined || q === '') return null;
    const n = Number(q);
    if (!Number.isInteger(n) || n < 1) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid branchId', [
        { field: 'branchId', rule: 'invalid', issue: 'must be a positive whole number' },
      ]);
    }
    return n;
  }
  // Manager/Staff: force own branch, reject ?branchId pointing elsewhere
  if (q !== undefined && q !== '') {
    const n = Number(q);
    if (!Number.isInteger(n) || n < 1) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid branchId', [
        { field: 'branchId', rule: 'invalid', issue: 'must be a positive whole number' },
      ]);
    }
    assertBranchAccess(req.user, n);
    return n;
  }
  return req.user.branchId ?? null;
}

async function listProducts(req) {
  const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 100 });
  const includeInactive = req.query.includeInactive === 'true';
  const orderBy = parseSort(req.query.sort, SORT_FIELDS, [{ name: 'asc' }]);

  const where = {};
  if (!includeInactive) where.isActive = true;
  if (req.query.categoryId) {
    const cid = Number(req.query.categoryId);
    if (!Number.isInteger(cid) || cid < 1) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid categoryId', [
        { field: 'categoryId', rule: 'invalid', issue: 'must be a positive whole number' },
      ]);
    }
    where.categoryId = cid;
  }
  if (req.query.q) {
    where.OR = [
      { name: { contains: req.query.q, mode: 'insensitive' } },
      { sku: { contains: req.query.q, mode: 'insensitive' } },
      { barcode: { contains: req.query.q, mode: 'insensitive' } },
    ];
  }

  const branchId = resolveBranchId(req);

  const [total, rows] = await prisma.$transaction([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      orderBy,
      skip,
      take: limit,
      include: {
        category: true,
        ...(branchId ? { stocks: { where: { branchId } } } : {}),
      },
    }),
  ]);

  const data = rows.map((r) => {
    const qty = branchId ? r.stocks?.[0]?.quantity?.toNumber() ?? 0 : undefined;
    return mapProduct(r, req.user, qty);
  });

  return { data, page, limit, total };
}

async function getProduct(req, id) {
  const row = await prisma.product.findUnique({ where: { id }, include: { category: true } });
  if (!row) throw new AppError(404, 'PRODUCT_NOT_FOUND', 'Product not found');

  let quantity;
  const branchId = resolveBranchId(req);
  if (branchId) {
    const s = await prisma.branchStock.findUnique({
      where: { productId_branchId: { productId: id, branchId } },
    });
    quantity = s?.quantity?.toNumber() ?? 0;
  }
  return mapProduct(row, req.user, quantity);
}

async function getByBarcode(req, barcode) {
  const row = await prisma.product.findUnique({ where: { barcode }, include: { category: true } });
  if (!row || !row.isActive) {
    throw new AppError(404, 'PRODUCT_NOT_FOUND', 'Product not found');
  }

  let quantity;
  const branchId = resolveBranchId(req);
  if (branchId) {
    const s = await prisma.branchStock.findUnique({
      where: { productId_branchId: { productId: row.id, branchId } },
    });
    quantity = s?.quantity?.toNumber() ?? 0;
  }
  return mapProduct(row, req.user, quantity);
}

async function createProduct(data) {
  const category = await prisma.category.findUnique({ where: { id: data.categoryId } });
  if (!category || !category.isActive) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Category must exist and be active', [
      { field: 'categoryId', rule: 'invalid', issue: 'category not found or inactive' },
    ]);
  }

  try {
    const created = await prisma.$transaction(async (tx) => {
      const p = await tx.product.create({ data, include: { category: true } });
      await createStockRowsForProduct(p.id, tx);
      return p;
    });
    return mapProduct(created, { role: 'ADMIN' });
  } catch (e) {
    if (e.code === 'P2002') {
      const target = [].concat(e.meta?.target ?? []);
      if (target.includes('sku')) {
        throw new AppError(409, 'DUPLICATE_SKU', 'SKU is already used');
      }
      if (target.includes('barcode')) {
        throw new AppError(409, 'DUPLICATE_BARCODE', 'Barcode is already used');
      }
      throw new AppError(409, 'DUPLICATE_VALUE', 'Duplicate value');
    }
    throw e;
  }
}

async function updateProduct(id, data) {
  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing) throw new AppError(404, 'PRODUCT_NOT_FOUND', 'Product not found');

  if (data.categoryId !== undefined) {
    const category = await prisma.category.findUnique({ where: { id: data.categoryId } });
    if (!category || !category.isActive) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Category must exist and be active', [
        { field: 'categoryId', rule: 'invalid', issue: 'category not found or inactive' },
      ]);
    }
  }

  try {
    const updated = await prisma.product.update({
      where: { id },
      data,
      include: { category: true },
    });
    return mapProduct(updated, { role: 'ADMIN' });
  } catch (e) {
    if (e.code === 'P2002') {
      const target = [].concat(e.meta?.target ?? []);
      if (target.includes('sku')) {
        throw new AppError(409, 'DUPLICATE_SKU', 'SKU is already used');
      }
      if (target.includes('barcode')) {
        throw new AppError(409, 'DUPLICATE_BARCODE', 'Barcode is already used');
      }
      throw new AppError(409, 'DUPLICATE_VALUE', 'Duplicate value');
    }
    throw e;
  }
}

module.exports = { listProducts, getProduct, getByBarcode, createProduct, updateProduct };