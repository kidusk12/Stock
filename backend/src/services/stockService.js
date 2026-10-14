// Owner: Kidus. THE ONLY place in the app that changes stock quantities.
// Place this file at backend/src/services/stockService.js
//
// Usage:
//   const { applyMovement } = require('../services/stockService');
//
//   // on its own (opens its own transaction):
//   await applyMovement({ productId, branchId, quantity: -2, type: 'SALE', referenceType: 'SALE', referenceId: sale.id, userId });
//
//   // inside the caller's transaction (so the sale and the stock change commit together):
//   await prisma.$transaction(async (tx) => {
//     const sale = await tx.sale.create({ ... });
//     await applyMovement({ ... }, tx);
//   });
//
// Rules enforced here:
//   - quantity is signed: positive adds stock, negative removes stock, never zero, max 2 decimals
//   - the sign must match the movement type (a SALE can only remove, a PURCHASE_RECEIPT can only add,
//     an ADJUSTMENT can do either)
//   - the stock row is locked (SELECT ... FOR UPDATE) so two simultaneous sales cannot both take the last unit
//   - stock can never go below zero (throws INSUFFICIENT_STOCK, status 422)
//   - the quantity update and the stock_movements row are saved in ONE transaction
//   - low-stock alert (K7): one notification when stock drops to or below the minimum; no more until
//     stock goes back above the minimum

const { Prisma } = require('@prisma/client');
const prisma = require('../utils/prisma'); // adjust the path if the shared Prisma client lives elsewhere
const AppError = require('../utils/AppError'); // AppError(status, code, message)

const D = (value) => new Prisma.Decimal(value);

// +1 = must add stock, -1 = must remove stock, 0 = either
const SIGN_BY_TYPE = {
  OPENING_STOCK: 1,
  PURCHASE_RECEIPT: 1,
  CUSTOMER_RETURN: 1,
  TRANSFER_IN: 1,
  SALE: -1,
  TRANSFER_OUT: -1,
  ADJUSTMENT: 0,
};

function parseQuantity(value) {
  let q;
  try {
    q = D(value);
  } catch {
    throw new AppError(400, 'INVALID_QUANTITY', 'Quantity must be a number');
  }
  if (!q.isFinite() || q.isZero()) {
    throw new AppError(400, 'INVALID_QUANTITY', 'Quantity must be a non-zero number');
  }
  if (q.decimalPlaces() > 2) {
    throw new AppError(400, 'INVALID_QUANTITY', 'Quantity can have at most 2 decimal places');
  }
  return q;
}

async function run(tx, input) {
  const { productId, branchId, quantity, type, reason = null, referenceType = null, referenceId = null, userId } = input;

  if (!Number.isInteger(productId) || !Number.isInteger(branchId) || !Number.isInteger(userId)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'productId, branchId and userId must be integers');
  }
  const sign = SIGN_BY_TYPE[type];
  if (sign === undefined) {
    throw new AppError(400, 'INVALID_TYPE', `Unknown movement type: ${type}`);
  }

  const change = parseQuantity(quantity);
  if (sign === 1 && change.isNegative()) {
    throw new AppError(400, 'INVALID_QUANTITY', `${type} must add stock (positive quantity)`);
  }
  if (sign === -1 && change.isPositive()) {
    throw new AppError(400, 'INVALID_QUANTITY', `${type} must remove stock (negative quantity)`);
  }

  // Safety net: a stock row (quantity 0) should already exist for every product x branch (K6).
  // createMany + skipDuplicates is atomic and does nothing when the row is already there.
  try {
    await tx.branchStock.createMany({ data: [{ productId, branchId }], skipDuplicates: true });
  } catch (e) {
    if (e.code === 'P2003') throw new AppError(404, 'NOT_FOUND', 'Product or branch not found');
    throw e;
  }

  // Lock this stock row until the transaction ends.
  const rows = await tx.$queryRaw`
    SELECT "id", "quantity", "minQty", "lowStockAlerted"
    FROM "BranchStock"
    WHERE "productId" = ${productId} AND "branchId" = ${branchId}
    FOR UPDATE`;
  const row = rows[0];

  const before = D(row.quantity);
  const min = D(row.minQty);
  const after = before.plus(change);

  if (after.isNegative()) {
    throw new AppError(422, 'INSUFFICIENT_STOCK', `Not enough stock. Available: ${before.toFixed(2)}`);
  }

  // Low-stock alert (K7). Only when a minimum is set (> 0) and only after a decrease.
  let alerted = row.lowStockAlerted;
  let alertCreated = false;
  if (min.gt(0) && after.lte(min)) {
    if (change.isNegative() && !alerted) {
      alerted = true;
      alertCreated = true;
    }
  } else if (alerted) {
    alerted = false; // stock is back above the minimum: re-arm the alert
  }

  await tx.branchStock.update({
    where: { id: row.id },
    data: { quantity: after, lowStockAlerted: alerted },
  });

  const movement = await tx.stockMovement.create({
    data: {
      productId,
      branchId,
      type,
      quantityChange: change,
      quantityAfter: after,
      referenceType,
      referenceId,
      reason,
      userId,
    },
  });

  if (alertCreated) {
    await tx.notification.create({
      data: { type: 'LOW_STOCK', branchId, productId, quantity: after, minQty: min },
    });
  }

  return {
    movementId: movement.id,
    quantityBefore: before.toNumber(),
    quantityAfter: after.toNumber(),
    lowStockAlert: alertCreated,
  };
}

// Pass `tx` to join the caller's transaction; otherwise a new one is opened.
async function applyMovement(input, tx) {
  if (tx) return run(tx, input);
  return prisma.$transaction((t) => run(t, input));
}

// K6: a new product gets a quantity-0 stock row in every branch.
// Call this inside the same transaction that creates the product.
async function createStockRowsForProduct(productId, tx = prisma) {
  const branches = await tx.branch.findMany({ select: { id: true } });
  if (branches.length === 0) return;
  await tx.branchStock.createMany({
    data: branches.map((b) => ({ productId, branchId: b.id })),
    skipDuplicates: true,
  });
}

// K6: a new branch gets a quantity-0 stock row for every product.
// Call this inside the same transaction that creates the branch.
async function createStockRowsForBranch(branchId, tx = prisma) {
  const products = await tx.product.findMany({ select: { id: true } });
  if (products.length === 0) return;
  await tx.branchStock.createMany({
    data: products.map((p) => ({ productId: p.id, branchId })),
    skipDuplicates: true,
  });
}

module.exports = { applyMovement, createStockRowsForProduct, createStockRowsForBranch };