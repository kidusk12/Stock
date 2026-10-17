const { Prisma } = require('@prisma/client');
const prisma = require('../../config/db');
const { AppError } = require('../../middleware/errors');
const { assertBranchAccess } = require('../../middleware/auth');

const MOVEMENT_TYPES = [
  'OPENING_STOCK',
  'PURCHASE_RECEIPT',
  'SALE',
  'CUSTOMER_RETURN',
  'ADJUSTMENT',
  'TRANSFER_OUT',
  'TRANSFER_IN',
];

const withProduct = { product: { select: { name: true, sku: true, costPrice: true } } };

const validationError = (message, field, issue) =>
  new AppError(400, 'VALIDATION_ERROR', message, [{ field, issue }]);

function parseIntParam(value, field) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) {
    throw validationError(`Invalid ${field}`, field, 'must be a positive whole number');
  }
  return n;
}

// A bad id in the URL is treated like a missing record
function parseIdOr404(value, message) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) throw new AppError(404, 'NOT_FOUND', message);
  return n;
}

function parsePagination({ page = '1', limit = '20' } = {}) {
  const p = Number(page);
  const l = Number(limit);
  if (!Number.isInteger(p) || p < 1 || !Number.isInteger(l) || l < 1 || l > 100) {
    throw validationError('Invalid pagination', 'page', 'page must be 1 or more and limit between 1 and 100');
  }
  return { page: p, limit: l };
}

// Scope rule (contract 1.5): Admin and Auditor may read any branch (filter with ?branchId=).
// Manager and Staff always get their own branch; asking for another one is 403.
// Returns a branch id to filter by, or null for "all branches".
function resolveBranchScope(user, requested) {
  if (requested !== undefined && requested !== '') {
    const branchId = parseIntParam(requested, 'branchId');
    assertBranchAccess(user, branchId);
    return branchId;
  }
  return user.role === 'ADMIN' || user.role === 'AUDITOR' ? null : user.branchId;
}

// "2026-10-05" means that day in Ethiopia time (UTC+3). Returns the UTC moment the day starts.
function startOfEthiopiaDay(value, field) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw validationError(`Invalid ${field}`, field, 'use the format YYYY-MM-DD');
  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const utc = new Date(Date.UTC(y, m - 1, d));
  if (utc.getUTCFullYear() !== y || utc.getUTCMonth() !== m - 1 || utc.getUTCDate() !== d) {
    throw validationError(`Invalid ${field}`, field, 'not a real calendar date');
  }
  return new Date(utc.getTime() - 3 * 60 * 60 * 1000);
}

// The stock row from the contract (section 6.2)
const toStockRow = (row) => ({
  branchId: row.branchId,
  productId: row.productId,
  productName: row.product.name,
  sku: row.product.sku,
  quantity: row.quantity.toNumber(),
  minQuantity: row.minQty.gt(0) ? row.minQty.toNumber() : null, // 0 means "not set"
  maxQuantity: row.maxQty ? row.maxQty.toNumber() : null,
  costPrice: row.product.costPrice.toNumber(),
  stockValue: row.quantity.times(row.product.costPrice).toDecimalPlaces(2).toNumber(),
});

const nameOrSku = (q) => [
  { name: { contains: q, mode: 'insensitive' } },
  { sku: { contains: q, mode: 'insensitive' } },
];

// GET /api/stock
async function listStock(user, query = {}) {
  const { page, limit } = parsePagination(query);
  const branchId = resolveBranchScope(user, query.branchId);

  const where = {};
  if (branchId !== null) where.branchId = branchId;
  if (query.productId !== undefined && query.productId !== '') {
    where.productId = parseIntParam(query.productId, 'productId');
  }
  if (query.q) where.product = { OR: nameOrSku(query.q) };
  if (query.lowOnly === 'true') {
    // Prisma cannot compare two columns, so the low rows are found with one small SQL query
    const low = await prisma.$queryRaw`
      SELECT "id" FROM "BranchStock" WHERE "minQty" > 0 AND "quantity" <= "minQty"`;
    where.id = { in: low.map((r) => r.id) };
  }

  const [rows, total] = await Promise.all([
    prisma.branchStock.findMany({
      where,
      include: withProduct,
      orderBy: [{ product: { name: 'asc' } }, { branchId: 'asc' }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.branchStock.count({ where }),
  ]);

  return { data: rows.map(toStockRow), page, limit, total };
}

// GET /api/stock/consolidated   (Admin and Auditor only; the route checks the role)
async function consolidated(query = {}) {
  const { page, limit } = parsePagination(query);
  const where = query.q ? { OR: nameOrSku(query.q) } : {};

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        name: true,
        stocks: {
          orderBy: { branchId: 'asc' },
          select: { branchId: true, quantity: true, branch: { select: { name: true } } },
        },
      },
    }),
    prisma.product.count({ where }),
  ]);

  const data = products.map((p) => ({
    productId: p.id,
    productName: p.name,
    totalQuantity: p.stocks.reduce((sum, s) => sum.plus(s.quantity), new Prisma.Decimal(0)).toNumber(),
    branches: p.stocks.map((s) => ({
      branchId: s.branchId,
      branchName: s.branch.name,
      quantity: s.quantity.toNumber(),
    })),
  }));

  return { data, page, limit, total };
}

// PUT /api/stock/:branchId/:productId/thresholds   (Admin, or Manager for their own branch)
// Body: { minQuantity, maxQuantity? }. maxQuantity omitted = unchanged, null = cleared.
// TODO (Kidus): write the change (old and new values) to the audit log once middleware/audit.js exists.
async function setThresholds(user, branchIdParam, productIdParam, body) {
  const branchId = parseIdOr404(branchIdParam, 'Branch not found');
  const productId = parseIdOr404(productIdParam, 'Product not found');
  assertBranchAccess(user, branchId); // a Manager gets 403 for another branch

  const key = { productId_branchId: { productId, branchId } };
  const row = await prisma.branchStock.findUnique({ where: key });
  if (!row) {
    // Stock rows should always exist (contract 1.8); only create one if the product and branch are real
    const [branch, product] = await Promise.all([
      prisma.branch.findUnique({ where: { id: branchId }, select: { id: true } }),
      prisma.product.findUnique({ where: { id: productId }, select: { id: true } }),
    ]);
    if (!branch) throw new AppError(404, 'NOT_FOUND', 'Branch not found');
    if (!product) throw new AppError(404, 'NOT_FOUND', 'Product not found');
  }

  const min = new Prisma.Decimal(body.minQuantity);
  let max = row ? row.maxQty : null;
  if (body.maxQuantity !== undefined) {
    max = body.maxQuantity === null ? null : new Prisma.Decimal(body.maxQuantity);
  }
  if (max !== null && max.lt(min)) {
    throw validationError('maxQuantity must be at least minQuantity', 'maxQuantity', 'must be at least minQuantity');
  }

  const data = { minQty: min, maxQty: max };
  // If the stock is not low any more, re-arm the low-stock alert
  const quantity = row ? row.quantity : new Prisma.Decimal(0);
  if (min.lte(0) || quantity.gt(min)) data.lowStockAlerted = false;

  const updated = await prisma.branchStock.upsert({
    where: key,
    create: { productId, branchId, ...data },
    update: data,
    include: withProduct,
  });
  return toStockRow(updated);
}

// GET /api/stock-movements   (read only, newest first)
async function listMovements(user, query = {}) {
  const { page, limit } = parsePagination(query);
  const branchId = resolveBranchScope(user, query.branchId);

  const where = {};
  if (branchId !== null) where.branchId = branchId;
  if (query.productId !== undefined && query.productId !== '') {
    where.productId = parseIntParam(query.productId, 'productId');
  }
  if (query.type) {
    if (!MOVEMENT_TYPES.includes(query.type)) throw validationError('Invalid type', 'type', 'unknown movement type');
    where.type = query.type;
  }
  if (query.from || query.to) {
    where.createdAt = {};
    if (query.from) where.createdAt.gte = startOfEthiopiaDay(query.from, 'from');
    if (query.to) {
      // the whole "to" day counts, so stop at the start of the next Ethiopia day
      where.createdAt.lt = new Date(startOfEthiopiaDay(query.to, 'to').getTime() + 24 * 60 * 60 * 1000);
    }
  }

  const [rows, total] = await Promise.all([
    prisma.stockMovement.findMany({
      where,
      include: {
        product: { select: { name: true } },
        user: { select: { id: true, fullName: true } },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.stockMovement.count({ where }),
  ]);

  const data = rows.map((m) => ({
    id: m.id,
    productId: m.productId,
    productName: m.product.name,
    branchId: m.branchId,
    type: m.type,
    quantityChange: m.quantityChange.toNumber(),
    quantityAfter: m.quantityAfter.toNumber(),
    referenceType: m.referenceType,
    referenceId: m.referenceId,
    reason: m.reason,
    createdBy: { id: m.user.id, name: m.user.fullName },
    createdAt: m.createdAt,
  }));

  return { data, page, limit, total };
}

module.exports = { listStock, consolidated, setThresholds, listMovements };