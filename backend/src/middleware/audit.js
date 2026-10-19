const prisma = require('../config/db');

// ONE list of audit action names (contract 6.8, K4). Callers use AUDIT_ACTIONS.SALE_CREATED,
// so renaming an action is a one-line change here. PO_REJECTED and TRANSFER_REJECTED are not
// in the contract yet (K-F); add them here when they are approved.
const AUDIT_ACTIONS = Object.freeze({
  USER_CREATED: 'USER_CREATED',
  USER_UPDATED: 'USER_UPDATED',
  USER_LOGOUT: 'USER_LOGOUT',
  PRODUCT_CREATED: 'PRODUCT_CREATED',
  PRODUCT_UPDATED: 'PRODUCT_UPDATED',
  PRICE_CHANGED: 'PRICE_CHANGED',
  SUPPLIER_UPDATED: 'SUPPLIER_UPDATED',
  BRANCH_UPDATED: 'BRANCH_UPDATED',
  STOCK_MOVEMENT: 'STOCK_MOVEMENT',
  PO_CREATED: 'PO_CREATED',
  PO_APPROVED: 'PO_APPROVED',
  PO_RECEIVED: 'PO_RECEIVED',
  SALE_CREATED: 'SALE_CREATED',
  RETURN_CREATED: 'RETURN_CREATED',
  RETURN_REFUNDED: 'RETURN_REFUNDED',
  ADJUSTMENT_CREATED: 'ADJUSTMENT_CREATED',
  TRANSFER_REQUESTED: 'TRANSFER_REQUESTED',
  TRANSFER_APPROVED: 'TRANSFER_APPROVED',
  TRANSFER_SHIPPED: 'TRANSFER_SHIPPED',
  TRANSFER_RECEIVED: 'TRANSFER_RECEIVED',
  IMPORT_CONFIRMED: 'IMPORT_CONFIRMED',
});

// Entity types (contract 6.8, K4)
const AUDIT_ENTITY_TYPES = Object.freeze([
  'USER',
  'PRODUCT',
  'SUPPLIER',
  'BRANCH',
  'PO',
  'SALE',
  'RETURN',
  'ADJUSTMENT',
  'TRANSFER',
  'IMPORT',
]);

// JSON-safe copy of a value. Dates become ISO text. Money and quantities should be passed as
// numbers. undefined leaves the database column empty (NULL).
function toJson(value) {
  if (value === null || value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

// The ONE function every service calls to write an audit entry (K-J).
//
//   await writeAudit({
//     userId: req.user.userId,
//     action: AUDIT_ACTIONS.SALE_CREATED,
//     entityType: 'SALE',
//     entityId: sale.id,
//     branchId: sale.branchId,                  // null when the event belongs to no branch
//     oldValue: null,                           // what it was before (null for a new record)
//     newValue: { invoiceNumber, total },       // what it is now
//   }, tx);                                     // tx = the caller's transaction (optional)
//
// Pass tx so the entry is saved in the SAME transaction as the action: if the audit write
// fails, the whole action rolls back (contract 6.0). Errors are not caught here on purpose.
// A wrong action or entityType is a coding mistake, so it throws a plain Error (a 500).
async function writeAudit(entry, tx = prisma) {
  const { userId, action, entityType, entityId = null, branchId = null, oldValue = null, newValue = null } = entry;

  if (!Number.isInteger(userId)) throw new Error('writeAudit: userId must be a whole number');
  if (!Object.values(AUDIT_ACTIONS).includes(action)) throw new Error(`writeAudit: unknown action "${action}"`);
  if (!AUDIT_ENTITY_TYPES.includes(entityType)) throw new Error(`writeAudit: unknown entityType "${entityType}"`);

  return tx.auditLog.create({
    data: {
      userId,
      action,
      entityType,
      entityId,
      branchId,
      oldValue: toJson(oldValue),
      newValue: toJson(newValue),
    },
  });
}

module.exports = { writeAudit, AUDIT_ACTIONS, AUDIT_ENTITY_TYPES };