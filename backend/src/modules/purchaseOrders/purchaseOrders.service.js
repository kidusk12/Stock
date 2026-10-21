const crypto = require('crypto');
const { Prisma } = require('@prisma/client');
const prisma = require('../../config/db');
const { AppError } = require('../../middleware/errors');
const { assertBranchAccess } = require('../../middleware/auth');
const { validationError } = require('../../middleware/validate'); // shared builder
const { writeAudit, AUDIT_ACTIONS } = require('../../middleware/audit'); // shared audit writer
const { applyMovement } = require('../../services/stockService'); // the only place stock changes
const { parsePagination } = require('../../utils/pagination'); // shared pagination rule
const { dateRangeFilter } = require('../../utils/dates'); // shared Ethiopia-day parser
const { parseIntParam, parseIdOr404 } = require('../../utils/params'); // shared id helpers

const D = (value) => new Prisma.Decimal(value);
// Money: 2 decimals, rounded half up (contract 6.0, rule 3)
const money = (decimal) => decimal.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

const STATUSES = ['PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'PARTIALLY_RECEIVED', 'RECEIVED'];

const poInclude = {
  supplier: { select: { name: true } },
  branch: { select: { name: true } },
  createdBy: { select: { id: true, fullName: true } },
  approvedBy: { select: { id: true, fullName: true } },
  rejectedBy: { select: { id: true, fullName: true } },
  items: { orderBy: { id: 'asc' }, include: { product: { select: { name: true, sku: true } } } },
};

const userRef = (user) => (user ? { id: user.id, name: user.fullName } : null);

// The PO object from the contract (6.5). Field map (6.11): quantity is orderedQty,
// receivedQuantity is receivedQty, totalCost is calculated and not stored.
function toPO(po) {
  const totalCost = money(po.items.reduce((sum, i) => sum.plus(i.orderedQty.times(i.unitCost)), D(0)));
  return {
    id: po.id,
    poNumber: po.poNumber,
    supplierId: po.supplierId,
    supplierName: po.supplier.name,
    branchId: po.branchId,
    branchName: po.branch.name,
    status: po.status,
    totalCost: totalCost.toNumber(),
    note: po.note,
    items: po.items.map((i) => ({
      id: i.id,
      productId: i.productId,
      productName: i.product.name,
      sku: i.product.sku,
      quantity: i.orderedQty.toNumber(),
      receivedQuantity: i.receivedQty.toNumber(),
      unitCost: i.unitCost.toNumber(),
    })),
    createdBy: userRef(po.createdBy),
    createdAt: po.createdAt,
    approvedBy: userRef(po.approvedBy),
    approvedAt: po.approvedAt,
    rejectedBy: userRef(po.rejectedBy),
    rejectedAt: po.rejectedAt,
    rejectReason: po.rejectReason,
  };
}

const invalidStatus = (status) => new AppError(409, 'INVALID_STATUS', `This purchase order is ${status}.`);

// Locks the PO row until the transaction ends (contract 6.0, rule 6)
async function lockPO(tx, id) {
  const [row] = await tx.$queryRaw`SELECT "status" FROM "PurchaseOrder" WHERE "id" = ${id} FOR UPDATE`;
  return row;
}

// Loads a PO for an action: unknown id is 404, another branch is 403
async function loadForAction(user, idParam) {
  const id = parseIdOr404(idParam, 'Purchase order not found');
  const po = await prisma.purchaseOrder.findUnique({ where: { id }, select: { id: true, branchId: true } });
  if (!po) throw new AppError(404, 'NOT_FOUND', 'Purchase order not found');
  assertBranchAccess(user, po.branchId);
  return po;
}

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

// POST /api/purchase-orders
async function createPurchaseOrder(user, body) {
  const branchId = resolveBranchId(user, body.branchId);
  const { supplierId, items } = body;

  const seen = new Set();
  items.forEach((item, i) => {
    if (seen.has(item.productId)) {
      throw validationError('A product appears twice', `items[${i}].productId`, 'duplicate', 'each product may appear once');
    }
    seen.add(item.productId);
  });

  // Business rules: every record must exist (404) and be active (400, rule inactive)
  const supplier = await prisma.supplier.findUnique({ where: { id: supplierId }, select: { id: true, isActive: true } });
  if (!supplier) throw new AppError(404, 'NOT_FOUND', 'Supplier not found');
  if (!supplier.isActive) throw validationError('Supplier is inactive', 'supplierId', 'inactive', 'supplier is not active');

  const branch = await prisma.branch.findUnique({ where: { id: branchId }, select: { id: true, isActive: true } });
  if (!branch) throw new AppError(404, 'NOT_FOUND', 'Branch not found');
  if (!branch.isActive) throw validationError('Branch is inactive', 'branchId', 'inactive', 'branch is not active');

  const products = await prisma.product.findMany({
    where: { id: { in: items.map((i) => i.productId) } },
    select: { id: true, isActive: true },
  });
  const productById = new Map(products.map((p) => [p.id, p]));
  items.forEach((item, i) => {
    const product = productById.get(item.productId);
    if (!product) throw new AppError(404, 'NOT_FOUND', 'Product not found');
    if (!product.isActive) {
      throw validationError('Product is inactive', `items[${i}].productId`, 'inactive', 'product is not active');
    }
  });

  return prisma.$transaction(
    async (tx) => {
      // poNumber is required and unique, so create with a temporary number, then set the real one
      const created = await tx.purchaseOrder.create({
        data: {
          poNumber: `TMP-${crypto.randomUUID()}`,
          supplierId,
          branchId,
          note: body.note || null,
          createdById: user.userId,
          items: {
            create: items.map((item) => ({
              productId: item.productId,
              orderedQty: D(item.quantity),
              unitCost: D(item.unitCost),
            })),
          },
        },
        select: { id: true },
      });

      // PO numbers are unique and increasing; gaps are allowed (contract 6.5)
      const po = await tx.purchaseOrder.update({
        where: { id: created.id },
        data: { poNumber: `PO-${String(created.id).padStart(6, '0')}` },
        include: poInclude,
      });

      const result = toPO(po);
      await writeAudit(
        {
          userId: user.userId,
          action: AUDIT_ACTIONS.PO_CREATED,
          entityType: 'PO',
          entityId: po.id,
          branchId,
          oldValue: null,
          newValue: {
            poNumber: po.poNumber,
            supplierId,
            totalCost: result.totalCost,
            itemCount: result.items.length,
          },
        },
        tx
      );
      return result;
    },
    { timeout: 20000 }
  );
}

// GET /api/purchase-orders   (Admin: all branches; Manager and Staff: own branch; the route blocks the Auditor)
// The list leaves out items and adds itemCount (items are loaded only to calculate totalCost).
async function listPurchaseOrders(user, query = {}) {
  const { page, limit, skip } = parsePagination(query);

  const where = {};
  if (query.branchId !== undefined && query.branchId !== '') {
    const branchId = parseIntParam(query.branchId, 'branchId');
    assertBranchAccess(user, branchId); // Manager and Staff get 403 for another branch
    where.branchId = branchId;
  } else if (
    user.role !== 'ADMIN' &&
    user.role !== 'AUDITOR'
  ) {
    where.branchId = user.branchId;
  }
  if (query.status) {
    if (!STATUSES.includes(query.status)) throw validationError('Invalid status', 'status', 'invalid', 'unknown status');
    where.status = query.status;
  }
  if (query.supplierId !== undefined && query.supplierId !== '') {
    where.supplierId = parseIntParam(query.supplierId, 'supplierId');
  }
  if (query.q) where.poNumber = { contains: query.q, mode: 'insensitive' };
  const createdAt = dateRangeFilter(query); // from and to are Ethiopia-time days
  if (createdAt) where.createdAt = createdAt;

  const [rows, total] = await Promise.all([
    prisma.purchaseOrder.findMany({
      where,
      include: poInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip,
      take: limit,
    }),
    prisma.purchaseOrder.count({ where }),
  ]);

  const data = rows.map((po) => {
    const { items, ...summary } = toPO(po);
    return { ...summary, itemCount: items.length };
  });

  return { data, page, limit, total };
}

// GET /api/purchase-orders/:id
async function getPurchaseOrder(user, idParam) {
  const id = parseIdOr404(idParam, 'Purchase order not found');
  const po = await prisma.purchaseOrder.findUnique({ where: { id }, include: poInclude });
  if (!po) throw new AppError(404, 'NOT_FOUND', 'Purchase order not found');
  assertBranchAccess(user, po.branchId); // 403 for another branch
  return toPO(po);
}

// The optional reject reason: at most 300 characters; empty means no reason
function cleanReason(input) {
  if (input === undefined || input === null) return null;
  if (typeof input !== 'string') throw validationError('Invalid reason', 'reason', 'invalid', 'must be text');
  const reason = input.trim();
  if (reason.length > 300) throw validationError('Reason is too long', 'reason', 'too_long', 'at most 300 characters');
  return reason || null;
}

// Approve and reject: load (404), branch (403), input (400), then lock the row and check the status (409)
async function decide(user, idParam, decision, reasonInput) {
  const po = await loadForAction(user, idParam);
  const reason = decision === 'REJECTED' ? cleanReason(reasonInput) : null;

  return prisma.$transaction(async (tx) => {
    const row = await lockPO(tx, po.id);
    if (row.status !== 'PENDING_APPROVAL') throw invalidStatus(row.status);

    const approved = decision === 'APPROVED';
    const updated = await tx.purchaseOrder.update({
      where: { id: po.id },
      data: approved
        ? { status: 'APPROVED', approvedById: user.userId, approvedAt: new Date() }
        : { status: 'REJECTED', rejectedById: user.userId, rejectedAt: new Date(), rejectReason: reason },
      include: poInclude,
    });

    await writeAudit(
      {
        userId: user.userId,
        action: approved ? AUDIT_ACTIONS.PO_APPROVED : AUDIT_ACTIONS.PO_REJECTED,
        entityType: 'PO',
        entityId: po.id,
        branchId: po.branchId,
        oldValue: { status: 'PENDING_APPROVAL' },
        newValue: approved ? { status: 'APPROVED' } : { status: 'REJECTED', reason },
      },
      tx
    );
    return toPO(updated);
  });
}

// POST /api/purchase-orders/:id/approve   (no body)
const approvePurchaseOrder = (user, idParam) => decide(user, idParam, 'APPROVED');

// POST /api/purchase-orders/:id/reject   (optional body { reason })
const rejectPurchaseOrder = (user, idParam, body) => decide(user, idParam, 'REJECTED', (body || {}).reason);

// POST /api/purchase-orders/:id/receive   (optional items body for partial receiving)
async function receivePurchaseOrder(user, idParam, body) {
  const po = await loadForAction(user, idParam);
  const requestedItems = body?.items;

  return prisma.$transaction(
    async (tx) => {
      // Lock the PO so concurrent receive attempts cannot exceed any outstanding line.
      const row = await lockPO(tx, po.id);
      if (!['APPROVED', 'PARTIALLY_RECEIVED'].includes(row.status)) throw invalidStatus(row.status);

      // Fixed ordering keeps stock-row lock acquisition deterministic.
      const items = await tx.purchaseOrderItem.findMany({
        where: { purchaseOrderId: po.id },
        orderBy: [{ productId: 'asc' }, { id: 'asc' }],
      });
      const itemsById = new Map(items.map((item) => [item.id, item]));
      let linesToReceive;
      if (requestedItems === undefined) {
        linesToReceive = items.map((item) => ({ item, quantity: item.orderedQty.minus(item.receivedQty) }))
          .filter(({ quantity }) => quantity.gt(0));
      } else {
        linesToReceive = requestedItems.map((requested, index) => {
          const item = itemsById.get(requested.itemId);
          if (!item) {
            throw validationError('Item does not belong to this purchase order', `items[${index}].itemId`, 'invalid', 'unknown purchase order item');
          }
          return { item, quantity: D(requested.quantity), inputIndex: index };
        });
      }

      // Validate every line before writing any stock movement. The transaction also guarantees
      // a later movement failure rolls all received quantities and audits back together.
      const overReceived = linesToReceive.flatMap(({ item, quantity, inputIndex }) => {
        const outstanding = item.orderedQty.minus(item.receivedQty);
        if (quantity.gt(outstanding)) {
          return [{
            field: `items[${inputIndex ?? items.findIndex((line) => line.id === item.id)}].quantity`,
            itemId: item.id,
            remaining: outstanding.toNumber(),
            requested: quantity.toNumber(),
          }];
        }
        return [];
      });
      if (overReceived.length) {
        throw new AppError(422, 'OVER_RECEIVE', 'Received quantity exceeds the remaining quantity on one or more purchase order lines.', overReceived);
      }

      for (const { item, quantity } of linesToReceive) {
        if (!quantity.gt(0)) continue;

        await applyMovement(
          {
            productId: item.productId,
            branchId: po.branchId,
            quantity: quantity.toFixed(2),
            type: 'PURCHASE_RECEIPT',
            referenceType: 'PURCHASE_ORDER',
            referenceId: po.id,
            userId: user.userId,
          },
          tx
        );
        await tx.purchaseOrderItem.update({
          where: { id: item.id },
          data: { receivedQty: item.receivedQty.plus(quantity) },
        });
      }

      const updatedItems = await tx.purchaseOrderItem.findMany({ where: { purchaseOrderId: po.id } });
      const complete = updatedItems.every((item) => item.receivedQty.gte(item.orderedQty));
      const newStatus = complete ? 'RECEIVED' : 'PARTIALLY_RECEIVED';
      // Product costPrice remains unchanged on receipt (contract 6.5).
      const updated = await tx.purchaseOrder.update({
        where: { id: po.id },
        data: { status: newStatus },
        include: poInclude,
      });

      await writeAudit(
        {
          userId: user.userId,
          action: AUDIT_ACTIONS.PO_RECEIVED,
          entityType: 'PO',
          entityId: po.id,
          branchId: po.branchId,
          oldValue: { status: row.status },
          newValue: {
            status: newStatus,
            items: linesToReceive.map(({ item, quantity }) => ({ itemId: item.id, quantityReceived: quantity.toNumber() })),
          },
        },
        tx
      );
      return toPO(updated);
    },
    { timeout: 20000 }
  );
}

module.exports = {
  createPurchaseOrder,
  listPurchaseOrders,
  getPurchaseOrder,
  approvePurchaseOrder,
  rejectPurchaseOrder,
  receivePurchaseOrder,
};
