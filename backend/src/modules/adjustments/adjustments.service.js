const { Prisma } = require('@prisma/client');
const prisma = require('../../config/db');
const { AppError } = require('../../middleware/errors');
const { assertBranchAccess } = require('../../middleware/auth');
const { validationError } = require('../../middleware/validate'); // shared builder
const { writeAudit, AUDIT_ACTIONS } = require('../../middleware/audit'); // shared audit writer
const { applyMovement } = require('../../services/stockService'); // the only place stock changes
const { parsePagination } = require('../../utils/pagination'); // shared pagination rule
const { dateRangeFilter } = require('../../utils/dates'); // shared Ethiopia-day parser
const { parseIntParam } = require('../../utils/params'); // shared id helper

const D = (value) => new Prisma.Decimal(value);

// K-K decided: no OPENING_STOCK reason. Starting stock comes from the seed script.
const REASONS = ['DAMAGE', 'EXPIRY', 'LOSS', 'RECOUNT', 'OTHER'];
// N11 (proposed in the contract): these reasons can only remove stock. RECOUNT and OTHER may be either.
const MUST_REMOVE = ['DAMAGE', 'EXPIRY', 'LOSS'];

const adjustmentInclude = {
  branch: { select: { name: true } },
  product: { select: { name: true } },
  user: { select: { id: true, fullName: true } },
};

// The adjustment object from the contract (6.7). Field map (6.11): quantity is quantityChange.
function toAdjustment(a) {
  return {
    id: a.id,
    branchId: a.branchId,
    branchName: a.branch.name,
    productId: a.productId,
    productName: a.product.name,
    quantity: a.quantityChange.toNumber(),
    reason: a.reason,
    note: a.note,
    createdBy: { id: a.user.id, name: a.user.fullName },
    createdAt: a.createdAt,
  };
}

// 422 with one detail (same shape as sales and transfers); requested is the positive amount taken out
const insufficientStock = (details) =>
  new AppError(
    422,
    'INSUFFICIENT_STOCK',
    `Not enough stock for ${details.length} item${details.length === 1 ? '' : 's'}.`,
    details
  );

// Admin must send branchId. Manager and Staff always use their own branch (default if left out;
// another branch is 403).
function resolveBranchId(user, requested) {
  const sent = requested !== undefined && requested !== null;
  if (user.role === 'ADMIN') {
    if (!sent) throw validationError('branchId is required', 'branchId', 'required', 'Admin must send branchId');
    return requested;
  }
  if (sent) assertBranchAccess(user, requested);
  return user.branchId;
}

// POST /api/adjustments   (Admin, Manager, Staff; changes stock)
async function createAdjustment(user, body) {
  const branchId = resolveBranchId(user, body.branchId);
  const { productId, reason } = body;
  const quantity = D(body.quantity); // signed: negative removes stock, positive adds it

  // Input rule (N11): DAMAGE, EXPIRY and LOSS must be negative
  if (MUST_REMOVE.includes(reason) && quantity.gt(0)) {
    throw validationError(`${reason} must remove stock`, 'quantity', 'must_be_negative', 'must be negative for DAMAGE, EXPIRY and LOSS');
  }

  // Business rules: records must exist (404) and be active (400, rule inactive)
  const branch = await prisma.branch.findUnique({ where: { id: branchId }, select: { id: true, isActive: true } });
  if (!branch) throw new AppError(404, 'NOT_FOUND', 'Branch not found');
  if (!branch.isActive) throw validationError('Branch is inactive', 'branchId', 'inactive', 'branch is not active');

  const product = await prisma.product.findUnique({ where: { id: productId }, select: { id: true, isActive: true } });
  if (!product) throw new AppError(404, 'NOT_FOUND', 'Product not found');
  if (!product.isActive) throw validationError('Product is inactive', 'productId', 'inactive', 'product is not active');

  return prisma.$transaction(
    async (tx) => {
      const adjustment = await tx.adjustment.create({
        data: {
          branchId,
          productId,
          quantityChange: quantity,
          reason,
          note: body.note || null,
          userId: user.userId,
        },
        include: adjustmentInclude,
      });

      try {
        await applyMovement(
          {
            productId,
            branchId,
            quantity: quantity.toFixed(2),
            type: 'ADJUSTMENT',
            reason, // the movement keeps the adjustment reason
            referenceType: 'ADJUSTMENT',
            referenceId: adjustment.id,
            userId: user.userId,
          },
          tx
        );
      } catch (e) {
        // A negative adjustment larger than the stock: report it and roll the adjustment back
        if (e instanceof AppError && e.code === 'INSUFFICIENT_STOCK') {
          const row = await tx.branchStock.findUnique({
            where: { productId_branchId: { productId, branchId } },
            select: { quantity: true },
          });
          throw insufficientStock([
            {
              field: 'quantity',
              productId,
              available: row ? row.quantity.toNumber() : 0,
              requested: quantity.abs().toNumber(),
            },
          ]);
        }
        throw e;
      }

      await writeAudit(
        {
          userId: user.userId,
          action: AUDIT_ACTIONS.ADJUSTMENT_CREATED,
          entityType: 'ADJUSTMENT',
          entityId: adjustment.id,
          branchId,
          oldValue: null,
          newValue: { productId, quantity: quantity.toNumber(), reason },
        },
        tx
      );

      return toAdjustment(adjustment);
    },
    { timeout: 20000 }
  );
}

// GET /api/adjustments   (Admin and Auditor: all branches; Manager and Staff: own branch)
async function listAdjustments(user, query = {}) {
  const { page, limit, skip } = parsePagination(query);

  const where = {};
  if (query.branchId !== undefined && query.branchId !== '') {
    const branchId = parseIntParam(query.branchId, 'branchId');
    assertBranchAccess(user, branchId); // Manager and Staff get 403 for another branch
    where.branchId = branchId;
  } else if (user.role !== 'ADMIN' && user.role !== 'AUDITOR') {
    where.branchId = user.branchId;
  }
  if (query.productId !== undefined && query.productId !== '') {
    where.productId = parseIntParam(query.productId, 'productId');
  }
  if (query.reason) {
    if (!REASONS.includes(query.reason)) throw validationError('Invalid reason', 'reason', 'invalid', 'unknown reason');
    where.reason = query.reason;
  }
  const createdAt = dateRangeFilter(query); // from and to are Ethiopia-time days
  if (createdAt) where.createdAt = createdAt;

  const [rows, total] = await Promise.all([
    prisma.adjustment.findMany({
      where,
      include: adjustmentInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip,
      take: limit,
    }),
    prisma.adjustment.count({ where }),
  ]);

  return { data: rows.map(toAdjustment), page, limit, total };
}

module.exports = { createAdjustment, listAdjustments };