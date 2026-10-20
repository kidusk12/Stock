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

const STATUSES = ['REQUESTED', 'APPROVED', 'REJECTED', 'SHIPPED', 'RECEIVED'];

const transferInclude = {
  fromBranch: { select: { name: true } },
  toBranch: { select: { name: true } },
  requestedBy: { select: { id: true, fullName: true } },
  approvedBy: { select: { id: true, fullName: true } },
  rejectedBy: { select: { id: true, fullName: true } },
  shippedBy: { select: { id: true, fullName: true } },
  receivedBy: { select: { id: true, fullName: true } },
  items: { orderBy: { id: 'asc' }, include: { product: { select: { name: true } } } },
};

const userRef = (user) => (user ? { id: user.id, name: user.fullName } : null);

// The transfer object from the contract (6.9). requestedAt is the table's createdAt.
function toTransfer(t) {
  return {
    id: t.id,
    fromBranchId: t.fromBranchId,
    fromBranchName: t.fromBranch.name,
    toBranchId: t.toBranchId,
    toBranchName: t.toBranch.name,
    status: t.status,
    note: t.note,
    items: t.items.map((i) => ({
      productId: i.productId,
      productName: i.product.name,
      quantity: i.quantity.toNumber(),
    })),
    requestedBy: userRef(t.requestedBy),
    requestedAt: t.createdAt,
    approvedBy: userRef(t.approvedBy),
    approvedAt: t.approvedAt,
    rejectedBy: userRef(t.rejectedBy),
    rejectedAt: t.rejectedAt,
    rejectReason: t.rejectReason,
    shippedBy: userRef(t.shippedBy),
    shippedAt: t.shippedAt,
    receivedBy: userRef(t.receivedBy),
    receivedAt: t.receivedAt,
  };
}

const invalidStatus = (status) => new AppError(409, 'INVALID_STATUS', `This transfer is ${status}.`);

// 422 with one detail per short item (same shape as sales)
const insufficientStock = (details) =>
  new AppError(
    422,
    'INSUFFICIENT_STOCK',
    `Not enough stock for ${details.length} item${details.length === 1 ? '' : 's'}.`,
    details
  );

// Locks the transfer row until the transaction ends (contract 6.0, rule 6)
async function lockTransfer(tx, id) {
  const [row] = await tx.$queryRaw`SELECT "status" FROM "Transfer" WHERE "id" = ${id} FOR UPDATE`;
  return row;
}

// The optional reject reason: at most 300 characters; empty means no reason
function cleanReason(input) {
  if (input === undefined || input === null) return null;
  if (typeof input !== 'string') throw validationError('Invalid reason', 'reason', 'invalid', 'must be text');
  const reason = input.trim();
  if (reason.length > 300) throw validationError('Reason is too long', 'reason', 'too_long', 'at most 300 characters');
  return reason || null;
}

// POST /api/transfers   (Admin, Manager or Staff of the DESTINATION branch; stock is not checked now)
async function createTransfer(user, body) {
  const { fromBranchId, toBranchId, items } = body;

  // Manager and Staff: toBranchId must be their own branch (403). Admin may request for any branch.
  if (user.role !== 'ADMIN') assertBranchAccess(user, toBranchId);

  if (fromBranchId === toBranchId) {
    throw validationError('Source and destination must differ', 'toBranchId', 'invalid', 'fromBranchId and toBranchId must be different');
  }

  const seen = new Set();
  items.forEach((item, i) => {
    if (seen.has(item.productId)) {
      throw validationError('A product appears twice', `items[${i}].productId`, 'duplicate', 'each product may appear once');
    }
    seen.add(item.productId);
  });

  // Business rules: records must exist (404) and be active (400, rule inactive)
  const branches = await prisma.branch.findMany({
    where: { id: { in: [fromBranchId, toBranchId] } },
    select: { id: true, isActive: true },
  });
  const branchById = new Map(branches.map((b) => [b.id, b]));
  for (const [field, id] of [['fromBranchId', fromBranchId], ['toBranchId', toBranchId]]) {
    const branch = branchById.get(id);
    if (!branch) throw new AppError(404, 'NOT_FOUND', 'Branch not found');
    if (!branch.isActive) throw validationError('Branch is inactive', field, 'inactive', 'branch is not active');
  }

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

  return prisma.$transaction(async (tx) => {
    const transfer = await tx.transfer.create({
      data: {
        fromBranchId,
        toBranchId,
        note: body.note || null,
        requestedById: user.userId,
        items: { create: items.map((i) => ({ productId: i.productId, quantity: D(i.quantity) })) },
      },
      include: transferInclude,
    });

    await writeAudit(
      {
        userId: user.userId,
        action: AUDIT_ACTIONS.TRANSFER_REQUESTED,
        entityType: 'TRANSFER',
        entityId: transfer.id,
        branchId: toBranchId, // the requesting (destination) branch
        oldValue: null,
        newValue: { fromBranchId, toBranchId, itemCount: items.length },
      },
      tx
    );
    return toTransfer(transfer);
  });
}

// GET /api/transfers   (Admin: all; Manager and Staff: own branch as source or destination; the route blocks the Auditor)
// The list leaves out items and adds itemCount.
async function listTransfers(user, query = {}) {
  const { page, limit, skip } = parsePagination(query);

  // The branch the list is about: ?branchId= (Admin; others get 403 for a branch that is not theirs),
  // otherwise the user's own branch. Admin without ?branchId= sees every branch.
  let scopeBranch = null;
  if (query.branchId !== undefined && query.branchId !== '') {
    scopeBranch = parseIntParam(query.branchId, 'branchId');
    assertBranchAccess(user, scopeBranch);
  } else if (user.role !== 'ADMIN') {
    scopeBranch = user.branchId;
  }

  const where = {};
  if (query.direction) {
    if (!['incoming', 'outgoing'].includes(query.direction)) {
      throw validationError('Invalid direction', 'direction', 'invalid', 'use incoming or outgoing');
    }
    // "Incoming" and "outgoing" are relative to a branch. An Admin has none, so must send ?branchId=.
    if (scopeBranch === null) {
      throw validationError('branchId is required with direction', 'branchId', 'required', 'direction is relative to a branch');
    }
    if (query.direction === 'incoming') where.toBranchId = scopeBranch;
    else where.fromBranchId = scopeBranch;
  } else if (scopeBranch !== null) {
    where.OR = [{ fromBranchId: scopeBranch }, { toBranchId: scopeBranch }];
  }
  if (query.status) {
    if (!STATUSES.includes(query.status)) throw validationError('Invalid status', 'status', 'invalid', 'unknown status');
    where.status = query.status;
  }
  const createdAt = dateRangeFilter(query); // from and to are Ethiopia-time days
  if (createdAt) where.createdAt = createdAt;

  const [rows, total] = await Promise.all([
    prisma.transfer.findMany({
      where,
      include: {
        fromBranch: transferInclude.fromBranch,
        toBranch: transferInclude.toBranch,
        requestedBy: transferInclude.requestedBy,
        approvedBy: transferInclude.approvedBy,
        rejectedBy: transferInclude.rejectedBy,
        shippedBy: transferInclude.shippedBy,
        receivedBy: transferInclude.receivedBy,
        _count: { select: { items: true } },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip,
      take: limit,
    }),
    prisma.transfer.count({ where }),
  ]);

  const data = rows.map((t) => {
    const { items, ...summary } = toTransfer({ ...t, items: [] });
    return { ...summary, itemCount: t._count.items };
  });

  return { data, page, limit, total };
}

// GET /api/transfers/:id   (Admin; Manager and Staff only when their branch is the source or destination)
async function getTransfer(user, idParam) {
  const id = parseIdOr404(idParam, 'Transfer not found');
  const transfer = await prisma.transfer.findUnique({ where: { id }, include: transferInclude });
  if (!transfer) throw new AppError(404, 'NOT_FOUND', 'Transfer not found');
  if (user.role !== 'ADMIN' && user.branchId !== transfer.fromBranchId && user.branchId !== transfer.toBranchId) {
    throw new AppError(403, 'FORBIDDEN', 'You can only access your own branch');
  }
  return toTransfer(transfer);
}

// The four action endpoints. Order of checks: load (404), branch rule (403), input (400),
// then lock the row and check the status (409), then do the work.
//   approve, reject: source branch, from REQUESTED
//   ship:            source branch, from APPROVED   (stock leaves the source)
//   receive:         destination branch, from SHIPPED (stock joins the destination)
const ACTIONS = {
  approve: { status: 'REQUESTED', side: 'source' },
  reject: { status: 'REQUESTED', side: 'source' },
  ship: { status: 'APPROVED', side: 'source' },
  receive: { status: 'SHIPPED', side: 'destination' },
};

async function runAction(user, idParam, action, reasonInput) {
  const spec = ACTIONS[action];

  const id = parseIdOr404(idParam, 'Transfer not found');
  const transfer = await prisma.transfer.findUnique({
    where: { id },
    select: { id: true, fromBranchId: true, toBranchId: true },
  });
  if (!transfer) throw new AppError(404, 'NOT_FOUND', 'Transfer not found');

  // Admin may act for either branch; Manager and Staff only for the branch that owns this step
  const actingBranchId = spec.side === 'source' ? transfer.fromBranchId : transfer.toBranchId;
  assertBranchAccess(user, actingBranchId);

  const reason = action === 'reject' ? cleanReason(reasonInput) : null;

  return prisma.$transaction(
    async (tx) => {
      const row = await lockTransfer(tx, id);
      if (row.status !== spec.status) throw invalidStatus(row.status);

      const now = new Date();
      let data;
      let auditAction;
      let newValue = { status: null };
      let auditBranchId = actingBranchId;

      if (action === 'approve') {
        data = { status: 'APPROVED', approvedById: user.userId, approvedAt: now };
        auditAction = AUDIT_ACTIONS.TRANSFER_APPROVED;
        newValue = { status: 'APPROVED' };
      } else if (action === 'reject') {
        data = { status: 'REJECTED', rejectedById: user.userId, rejectedAt: now, rejectReason: reason };
        auditAction = AUDIT_ACTIONS.TRANSFER_REJECTED;
        newValue = { status: 'REJECTED', reason };
      } else {
        const items = await tx.transferItem.findMany({ where: { transferId: id }, orderBy: { id: 'asc' } });
        // The items sorted by productId, with their position in the request, for a fixed locking order
        const sorted = items.map((item, index) => ({ item, index })).sort((a, b) => a.item.productId - b.item.productId);

        if (action === 'ship') {
          // Check every item first and report one detail per short item
          const stockRows = await tx.branchStock.findMany({
            where: { branchId: transfer.fromBranchId, productId: { in: items.map((i) => i.productId) } },
            select: { productId: true, quantity: true },
          });
          const have = new Map(stockRows.map((r) => [r.productId, r.quantity]));
          const shortLines = [];
          items.forEach((item, i) => {
            const available = have.get(item.productId) || D(0);
            if (available.lt(item.quantity)) {
              shortLines.push({
                field: `items[${i}].quantity`,
                productId: item.productId,
                available: available.toNumber(),
                requested: item.quantity.toNumber(),
              });
            }
          });
          if (shortLines.length > 0) throw insufficientStock(shortLines);

          for (const { item, index } of sorted) {
            try {
              await applyMovement(
                {
                  productId: item.productId,
                  branchId: transfer.fromBranchId,
                  quantity: item.quantity.negated().toFixed(2),
                  type: 'TRANSFER_OUT',
                  referenceType: 'TRANSFER',
                  referenceId: id,
                  userId: user.userId,
                },
                tx
              );
            } catch (e) {
              // Another sale or transfer took the stock after the check: report this item and roll back
              if (e instanceof AppError && e.code === 'INSUFFICIENT_STOCK') {
                const current = await tx.branchStock.findUnique({
                  where: { productId_branchId: { productId: item.productId, branchId: transfer.fromBranchId } },
                  select: { quantity: true },
                });
                throw insufficientStock([
                  {
                    field: `items[${index}].quantity`,
                    productId: item.productId,
                    available: current ? current.quantity.toNumber() : 0,
                    requested: item.quantity.toNumber(),
                  },
                ]);
              }
              throw e;
            }
          }

          data = { status: 'SHIPPED', shippedById: user.userId, shippedAt: now };
          auditAction = AUDIT_ACTIONS.TRANSFER_SHIPPED;
          newValue = { status: 'SHIPPED' };
        } else {
          for (const { item } of sorted) {
            await applyMovement(
              {
                productId: item.productId,
                branchId: transfer.toBranchId,
                quantity: item.quantity.toFixed(2),
                type: 'TRANSFER_IN',
                referenceType: 'TRANSFER',
                referenceId: id,
                userId: user.userId,
              },
              tx
            );
          }

          data = { status: 'RECEIVED', receivedById: user.userId, receivedAt: now };
          auditAction = AUDIT_ACTIONS.TRANSFER_RECEIVED;
          newValue = { status: 'RECEIVED' };
        }
      }

      const updated = await tx.transfer.update({ where: { id }, data, include: transferInclude });

      await writeAudit(
        {
          userId: user.userId,
          action: auditAction,
          entityType: 'TRANSFER',
          entityId: id,
          branchId: auditBranchId,
          oldValue: { status: spec.status },
          newValue,
        },
        tx
      );
      return toTransfer(updated);
    },
    { timeout: 20000 }
  );
}

const approveTransfer = (user, idParam) => runAction(user, idParam, 'approve');
const rejectTransfer = (user, idParam, body) => runAction(user, idParam, 'reject', (body || {}).reason);
const shipTransfer = (user, idParam) => runAction(user, idParam, 'ship');
const receiveTransfer = (user, idParam) => runAction(user, idParam, 'receive');

module.exports = {
  createTransfer,
  listTransfers,
  getTransfer,
  approveTransfer,
  rejectTransfer,
  shipTransfer,
  receiveTransfer,
};