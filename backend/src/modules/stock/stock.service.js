const { Prisma } = require('@prisma/client');
const prisma = require('../../config/db');
const { AppError } = require('../../middleware/errors');
const { assertBranchAccess } = require('../../middleware/auth');
const { validationError } = require('../../middleware/validate'); // shared builder
const { parsePagination } = require('../../utils/pagination'); // shared pagination rule
const { dateRangeFilter } = require('../../utils/dates'); // shared Ethiopia-day parser

const MOVEMENT_TYPES = [
  'OPENING_STOCK',
  'PURCHASE_RECEIPT',
  'SALE',
  'CUSTOMER_RETURN',
  'ADJUSTMENT',
  'TRANSFER_OUT',
  'TRANSFER_IN',
];

const stockInclude = {
  branch: { select: { name: true } },
  product: { select: { name: true, sku: true, costPrice: true, category: { select: { name: true } } } },
};

function parseIntParam(value, field) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) {
    throw validationError(`Invalid ${field}`, field, 'invalid', 'must be a positive whole number');
  }
  return n;
}

// A bad id in the URL is treated like a missing record
function parseIdOr404(value, message) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) throw new AppError(404, 'NOT_FOUND', message);
  return n;
}

// Scope rule (contract 1.3): Admin and Auditor may read any branch (filter with ?branchId=).
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

// The stock row from the contract (section 6.2).
// minQuantity 0 means "no minimum set"; maxQuantity is null when not set.
// Staff do not get costPrice and stockValue (5.4, N7).
function toStockRow(row, user) {
  const result = {
    branchId: row.branchId,
    branchName: row.branch.name,
    productId: row.productId,
    productName: row.product.name,
    sku: row.product.sku,
    categoryName: row.product.category ? row.product.category.name : null,
    quantity: row.quantity.toNumber(),
    minQuantity: row.minQty.toNumber(),
    maxQuantity: row.maxQty ? row.maxQty.toNumber() : null,
  };
  if (user.role !== 'STAFF') {
    result.costPrice = row.product.costPrice.toNumber();
    result.stockValue = row.quantity.times(row.product.costPrice).toDecimalPlaces(2).toNumber();
  }
  return result;
}

// ?q matches product name, SKU and barcode
const searchProduct = (q) => [
  { name: { contains: q, mode: 'insensitive' } },
  { sku: { contains: q, mode: 'insensitive' } },
  { barcode: { contains: q, mode: 'insensitive' } },
];

// Product filters shared by the stock list and the consolidated view.
// Inactive products are hidden unless ?includeInactive=true.
function productFilter(query, includeInactive) {
  const filter = {};
  if (query.q) filter.OR = searchProduct(query.q);
  if (query.categoryId !== undefined && query.categoryId !== '') {
    filter.categoryId = parseIntParam(query.categoryId, 'categoryId');
  }
  if (!includeInactive) filter.isActive = true;
  return filter;
}

// GET /api/stock
async function listStock(user, query = {}) {
  const { page, limit, skip } = parsePagination(query);
  const branchId = resolveBranchScope(user, query.branchId);
  const includeInactive = query.includeInactive === 'true';

  const where = { product: productFilter(query, includeInactive) };
  if (branchId !== null) where.branchId = branchId;
  if (!includeInactive) where.branch = { isActive: true };
  if (query.productId !== undefined && query.productId !== '') {
    where.productId = parseIntParam(query.productId, 'productId');
  }
  if (query.lowOnly === 'true') {
    // Prisma cannot compare two columns, so the low rows are found with one small SQL query
    const low = await prisma.$queryRaw`
      SELECT "id" FROM "BranchStock" WHERE "minQty" > 0 AND "quantity" <= "minQty"`;
    where.id = { in: low.map((r) => r.id) };
  }

  const [rows, total] = await Promise.all([
    prisma.branchStock.findMany({
      where,
      include: stockInclude,
      orderBy: [{ product: { name: 'asc' } }, { branchId: 'asc' }],
      skip,
      take: limit,
    }),
    prisma.branchStock.count({ where }),
  ]);

  return { data: rows.map((row) => toStockRow(row, user)), page, limit, total };
}

// GET /api/stock/consolidated   (Admin and Auditor only; the route checks the role)
// Totals count active branches only (contract 6.2), unless ?includeInactive=true.
async function consolidated(query = {}) {
  const { page, limit, skip } = parsePagination(query);
  const includeInactive = query.includeInactive === 'true';
  const where = productFilter(query, includeInactive);

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      skip,
      take: limit,
      select: {
        id: true,
        name: true,
        sku: true,
        stocks: {
          where: includeInactive ? undefined : { branch: { isActive: true } },
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
    sku: p.sku,
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
// Body: { minQuantity, maxQuantity? }. minQuantity 0 = no minimum.
// maxQuantity omitted = unchanged, null = cleared.
// Only saves the two numbers. Does not change quantity and does not create a notification;
// the alert state is handled by the stock service on the next stock change.
// Not written to the audit log in this version (contract 6.2).
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
    throw validationError('maxQuantity must be at least minQuantity', 'maxQuantity', 'max', 'must be at least minQuantity');
  }

  const data = { minQty: min, maxQty: max };
  const updated = await prisma.branchStock.upsert({
    where: key,
    create: { productId, branchId, ...data },
    update: data,
    include: stockInclude,
  });
  return toStockRow(updated, user);
}

// GET /api/stock-movements   (read only, newest first)
async function listMovements(user, query = {}) {
  const { page, limit, skip } = parsePagination(query);
  const branchId = resolveBranchScope(user, query.branchId);

  const where = {};
  if (branchId !== null) where.branchId = branchId;
  if (query.productId !== undefined && query.productId !== '') {
    where.productId = parseIntParam(query.productId, 'productId');
  }
  if (query.type) {
    if (!MOVEMENT_TYPES.includes(query.type)) {
      throw validationError('Invalid type', 'type', 'invalid', 'unknown movement type');
    }
    where.type = query.type;
  }
  const createdAt = dateRangeFilter(query); // from and to are Ethiopia-time days
  if (createdAt) where.createdAt = createdAt;

  const [rows, total] = await Promise.all([
    prisma.stockMovement.findMany({
      where,
      include: {
        product: { select: { name: true } },
        branch: { select: { name: true } },
        user: { select: { id: true, fullName: true } },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip,
      take: limit,
    }),
    prisma.stockMovement.count({ where }),
  ]);

  const data = rows.map((m) => ({
    id: m.id,
    productId: m.productId,
    productName: m.product.name,
    branchId: m.branchId,
    branchName: m.branch.name,
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