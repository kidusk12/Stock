const { Prisma } = require('@prisma/client');
const prisma = require('../../config/db');
const { AppError } = require('../../middleware/errors');
const { assertBranchAccess } = require('../../middleware/auth');
const { validationError } = require('../../middleware/validate');
const { writeAudit, AUDIT_ACTIONS } = require('../../middleware/audit');
const { applyMovement } = require('../../services/stockService');
const { parsePagination } = require('../../utils/pagination');
const { dateRangeFilter } = require('../../utils/dates');
const { parseIntParam, parseIdOr404 } = require('../../utils/params');

const D = (value) => new Prisma.Decimal(value);
const money = (value) => value.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

const returnInclude = {
  sale: { select: { invoiceNumber: true } },
  branch: { select: { name: true } },
  createdBy: { select: { id: true, fullName: true } },
  refundedBy: { select: { id: true, fullName: true } },
  items: { orderBy: { id: 'asc' }, include: { product: { select: { name: true } } } },
};

function toReturn(record) {
  return {
    id: record.id,
    returnNumber: `RET-${String(record.id).padStart(6, '0')}`,
    saleId: record.saleId,
    invoiceNumber: record.sale.invoiceNumber,
    branchId: record.branchId,
    branchName: record.branch.name,
    items: record.items.map((item) => ({
      saleItemId: item.saleItemId,
      productName: item.product.name,
      quantity: item.quantity.toNumber(),
      unitPrice: item.unitPrice.toNumber(),
      lineTotal: item.lineTotal.toNumber(),
    })),
    reason: record.reason,
    refundAmount: record.refundAmount.toNumber(),
    refundStatus: record.refundStatus,
    createdBy: { id: record.createdBy.id, name: record.createdBy.fullName },
    createdAt: record.createdAt,
    refundedBy: record.refundedBy ? { id: record.refundedBy.id, name: record.refundedBy.fullName } : null,
    refundedAt: record.refundedAt,
  };
}

function parseUniqueItems(items) {
  const seen = new Set();
  items.forEach((item, index) => {
    if (seen.has(item.saleItemId)) {
      throw validationError('A sale item appears more than once', `items[${index}].saleItemId`, 'duplicate', 'each sale item may appear once');
    }
    seen.add(item.saleItemId);
  });
}

async function createReturn(user, saleIdParam, body) {
  const saleId = parseIdOr404(saleIdParam, 'Sale not found');
  parseUniqueItems(body.items);

  const originalSale = await prisma.sale.findUnique({ where: { id: saleId }, select: { id: true, branchId: true } });
  if (!originalSale) throw new AppError(404, 'NOT_FOUND', 'Sale not found');
  assertBranchAccess(user, originalSale.branchId);

  const saleItemIds = body.items.map((item) => item.saleItemId).sort((a, b) => a - b);
  return prisma.$transaction(async (tx) => {
    // Serialize returns for the same sale lines so concurrent requests cannot over-return.
    const locked = await tx.$queryRaw`
      SELECT "id" FROM "SaleItem"
      WHERE "saleId" = ${saleId} AND "id" IN (${Prisma.join(saleItemIds)})
      ORDER BY "id" FOR UPDATE`;
    if (locked.length !== saleItemIds.length) throw new AppError(404, 'NOT_FOUND', 'Sale item not found');

    const sale = await tx.sale.findUnique({
      where: { id: saleId },
      include: { branch: { select: { name: true } }, items: { include: { product: { select: { name: true } } } } },
    });
    if (!sale) throw new AppError(404, 'NOT_FOUND', 'Sale not found');
    assertBranchAccess(user, sale.branchId);

    const saleItems = new Map(sale.items.map((item) => [item.id, item]));
    const lines = body.items.map((requested, index) => {
      const item = saleItems.get(requested.saleItemId);
      if (!item) throw new AppError(404, 'NOT_FOUND', 'Sale item not found');
      const quantity = D(requested.quantity);
      const available = item.quantity.minus(item.returnedQty);
      if (quantity.gt(available)) {
        throw new AppError(422, 'RETURN_EXCEEDS_SOLD', 'Returned quantity exceeds the quantity sold minus previous returns', [{
          field: `items[${index}].quantity`,
          saleItemId: item.id,
          sold: item.quantity.toNumber(),
          alreadyReturned: item.returnedQty.toNumber(),
          available: available.toNumber(),
          requested: quantity.toNumber(),
        }]);
      }
      const lineTotal = money(quantity.mul(item.unitPrice));
      return { item, quantity, lineTotal };
    });
    const refundAmount = money(lines.reduce((total, line) => total.plus(line.lineTotal), D(0)));

    const created = await tx.saleReturn.create({
      data: {
        saleId,
        branchId: sale.branchId,
        reason: body.reason || null,
        refundAmount,
        createdById: user.userId,
        items: { create: lines.map(({ item, quantity, lineTotal }) => ({
          saleItemId: item.id,
          productId: item.productId,
          quantity,
          unitPrice: item.unitPrice,
          lineTotal,
        })) },
      },
    });

    for (const { item, quantity } of lines) {
      await tx.saleItem.update({ where: { id: item.id }, data: { returnedQty: { increment: quantity } } });
      await applyMovement({
        productId: item.productId,
        branchId: sale.branchId,
        quantity: quantity.toFixed(2),
        type: 'CUSTOMER_RETURN',
        reason: body.reason || null,
        referenceType: 'RETURN',
        referenceId: created.id,
        userId: user.userId,
      }, tx);
    }

    await writeAudit({
      userId: user.userId,
      action: AUDIT_ACTIONS.RETURN_CREATED,
      entityType: 'RETURN',
      entityId: created.id,
      branchId: sale.branchId,
      oldValue: null,
      newValue: {
        saleId,
        invoiceNumber: sale.invoiceNumber,
        refundAmount: refundAmount.toNumber(),
        refundStatus: 'PENDING_REFUND',
        reason: body.reason || null,
        items: lines.map(({ item, quantity }) => ({ saleItemId: item.id, productId: item.productId, quantity: quantity.toNumber() })),
      },
    }, tx);

    const record = await tx.saleReturn.findUnique({ where: { id: created.id }, include: returnInclude });
    return toReturn(record);
  }, { timeout: 20000 });
}

function branchScope(user, query) {
  if (query.branchId !== undefined && query.branchId !== '') {
    const branchId = parseIntParam(query.branchId, 'branchId');
    assertBranchAccess(user, branchId);
    return branchId;
  }
  return user.role === 'ADMIN' ? undefined : user.branchId;
}

async function listReturns(user, query = {}) {
  const { page, limit, skip } = parsePagination(query);
  const where = {};
  const branchId = branchScope(user, query);
  if (branchId !== undefined) where.branchId = branchId;
  if (query.saleId !== undefined && query.saleId !== '') where.saleId = parseIntParam(query.saleId, 'saleId');
  if (query.refundStatus) {
    if (!['PENDING_REFUND', 'REFUNDED'].includes(query.refundStatus)) {
      throw validationError('Invalid refundStatus', 'refundStatus', 'invalid', 'unknown refund status');
    }
    where.refundStatus = query.refundStatus;
  }
  const createdAt = dateRangeFilter(query);
  if (createdAt) where.createdAt = createdAt;

  const [rows, total] = await Promise.all([
    prisma.saleReturn.findMany({ where, include: returnInclude, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip, take: limit }),
    prisma.saleReturn.count({ where }),
  ]);
  return { data: rows.map(toReturn), page, limit, total };
}

async function getReturn(user, idParam) {
  const id = parseIdOr404(idParam, 'Return not found');
  const record = await prisma.saleReturn.findUnique({ where: { id }, include: returnInclude });
  if (!record) throw new AppError(404, 'NOT_FOUND', 'Return not found');
  assertBranchAccess(user, record.branchId);
  return toReturn(record);
}

async function markRefunded(user, idParam) {
  const id = parseIdOr404(idParam, 'Return not found');
  const initial = await prisma.saleReturn.findUnique({ where: { id }, select: { id: true, branchId: true } });
  if (!initial) throw new AppError(404, 'NOT_FOUND', 'Return not found');
  assertBranchAccess(user, initial.branchId);

  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "SaleReturn" WHERE "id" = ${id} FOR UPDATE`;
    const record = await tx.saleReturn.findUnique({ where: { id }, include: returnInclude });
    if (!record) throw new AppError(404, 'NOT_FOUND', 'Return not found');
    assertBranchAccess(user, record.branchId);
    if (record.refundStatus !== 'PENDING_REFUND') throw new AppError(409, 'INVALID_STATUS', 'This return has already been refunded');

    const updated = await tx.saleReturn.update({
      where: { id },
      data: { refundStatus: 'REFUNDED', refundedById: user.userId, refundedAt: new Date() },
      include: returnInclude,
    });
    await writeAudit({
      userId: user.userId,
      action: AUDIT_ACTIONS.RETURN_REFUNDED,
      entityType: 'RETURN',
      entityId: id,
      branchId: record.branchId,
      oldValue: { refundStatus: record.refundStatus },
      newValue: { refundStatus: updated.refundStatus, refundAmount: updated.refundAmount.toNumber() },
    }, tx);
    return toReturn(updated);
  }, { timeout: 20000 });
}

module.exports = { createReturn, listReturns, getReturn, markRefunded };
