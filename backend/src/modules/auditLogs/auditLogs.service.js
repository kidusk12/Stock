const prisma = require('../../config/db');
const { AppError } = require('../../middleware/errors');
const { assertBranchAccess } = require('../../middleware/auth');
const { validationError } = require('../../middleware/validate');
const { parsePagination } = require('../../utils/pagination');
const { dateRangeFilter } = require('../../utils/dates');
const { parseIntParam } = require('../../utils/params');
const { AUDIT_ENTITY_TYPES, AUDIT_ACTIONS } = require('../../middleware/audit');

const toAuditLog = (row) => ({
  id: row.id,
  userId: row.userId,
  action: row.action,
  entityType: row.entityType,
  entityId: row.entityId,
  branchId: row.branchId,
  branchName: row.branch?.name || null,
  oldValue: row.oldValue,
  newValue: row.newValue,
  createdBy: { id: row.user.id, name: row.user.fullName },
  createdAt: row.createdAt,
});

async function auditEntityIdsForProduct(productId) {
  const [purchaseOrders, sales, returns, adjustments, transfers] = await Promise.all([
    prisma.purchaseOrder.findMany({ where: { items: { some: { productId } } }, select: { id: true } }),
    prisma.sale.findMany({ where: { items: { some: { productId } } }, select: { id: true } }),
    prisma.saleReturn.findMany({ where: { items: { some: { productId } } }, select: { id: true } }),
    prisma.adjustment.findMany({ where: { productId }, select: { id: true } }),
    prisma.transfer.findMany({ where: { items: { some: { productId } } }, select: { id: true } }),
  ]);
  return {
    poIds: purchaseOrders.map(({ id }) => id),
    saleIds: sales.map(({ id }) => id),
    returnIds: returns.map(({ id }) => id),
    adjustmentIds: adjustments.map(({ id }) => id),
    transferIds: transfers.map(({ id }) => id),
  };
}

async function listAuditLogs(user, query = {}) {
  const { page, limit, skip } = parsePagination(query);
  const where = {};

  if (query.branchId !== undefined && query.branchId !== '') {
    const branchId = parseIntParam(query.branchId, 'branchId');
    assertBranchAccess(user, branchId);
    where.branchId = branchId;
  } else if (user.role !== 'ADMIN' && user.role !== 'AUDITOR') {
    where.branchId = user.branchId;
  }
  if (query.userId !== undefined && query.userId !== '') where.userId = parseIntParam(query.userId, 'userId');
  if (query.entityId !== undefined && query.entityId !== '') where.entityId = parseIntParam(query.entityId, 'entityId');
  if (query.entityType) {
    if (!AUDIT_ENTITY_TYPES.includes(query.entityType)) throw validationError('Invalid entityType', 'entityType', 'invalid', 'unknown entity type');
    where.entityType = query.entityType;
  }
  if (query.action) {
    if (!Object.values(AUDIT_ACTIONS).includes(query.action)) throw validationError('Invalid action', 'action', 'invalid', 'unknown action');
    where.action = query.action;
  }
  if (query.productId !== undefined && query.productId !== '') {
    const productId = parseIntParam(query.productId, 'productId');
    const product = await prisma.product.findUnique({ where: { id: productId }, select: { id: true } });
    if (!product) throw new AppError(404, 'NOT_FOUND', 'Product not found');
    const ids = await auditEntityIdsForProduct(productId);
    where.OR = [
      { entityType: 'PRODUCT', entityId: productId },
      { entityType: 'PO', entityId: { in: ids.poIds } },
      { entityType: 'SALE', entityId: { in: ids.saleIds } },
      { entityType: 'RETURN', entityId: { in: ids.returnIds } },
      { entityType: 'ADJUSTMENT', entityId: { in: ids.adjustmentIds } },
      { entityType: 'TRANSFER', entityId: { in: ids.transferIds } },
    ];
  }
  const createdAt = dateRangeFilter(query);
  if (createdAt) where.createdAt = createdAt;

  const [rows, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: { user: { select: { id: true, fullName: true } }, branch: { select: { name: true } } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip,
      take: limit,
    }),
    prisma.auditLog.count({ where }),
  ]);
  return { data: rows.map(toAuditLog), page, limit, total };
}

module.exports = { listAuditLogs };
