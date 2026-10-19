const { Prisma } = require('@prisma/client');
const prisma = require('../../config/db');
const { AppError } = require('../../middleware/errors');
const { assertBranchAccess } = require('../../middleware/auth');
const { parsePagination } = require('../../utils/pagination');
const { dateRangeFilter } = require('../../utils/dates');
const { applyMovement } = require('../../services/stockService');

const D = (v) => new Prisma.Decimal(v);
const n = (v) => (v == null ? null : new Prisma.Decimal(v).toNumber());
const fail = (status, code, message, details) => new AppError(status, code, message, details);
const validation = (field, rule = 'invalid', issue = rule) =>
  fail(400, 'VALIDATION_ERROR', 'Invalid input', [{ field, rule, issue }]);
const uniqueLines = (items = []) => {
  if (!Array.isArray(items) || items.length < 1) throw validation('items', 'required', 'at least one item is required');
  const seen = new Set();
  for (let i = 0; i < items.length; i += 1) {
    const item = items[i];
    if (seen.has(item.productId)) throw validation(`items[${i}].productId`, 'duplicate', 'product appears more than once');
    seen.add(item.productId);
    if (!Number.isFinite(item.quantity) || item.quantity <= 0 || D(item.quantity).decimalPlaces() > 2) {
      throw validation(`items[${i}].quantity`, 'invalid', 'must be greater than zero with at most 2 decimals');
    }
  }
};
const positiveId = (value, field = 'id') => {
  const id = Number(value);
  if (!Number.isInteger(id) || id < 1) throw fail(404, 'NOT_FOUND', `${field} not found`);
  return id;
};
const actorSelect = { id: true, fullName: true };
const actor = (u) => (u ? { id: u.id, name: u.fullName } : null);
const audit = (tx, userId, action, entityType, entityId, branchId, oldValue = undefined, newValue = undefined) =>
  tx.auditLog.create({ data: { userId, action, entityType, entityId, branchId, oldValue, newValue } });

function branchScope(user, requested, { required = false, own = true } = {}) {
  if (user.role === 'ADMIN') {
    const id = requested == null || requested === '' ? null : positiveId(requested, 'Branch');
    if (required && id == null) throw validation('branchId', 'required');
    return id;
  }
  if (user.role === 'AUDITOR') {
    const id = requested == null || requested === '' ? null : positiveId(requested, 'Branch');
    return id;
  }
  if (!user.branchId) throw fail(403, 'FORBIDDEN', 'User has no assigned branch');
  if (requested != null && requested !== '') assertBranchAccess(user, positiveId(requested, 'Branch'));
  if (own) return user.branchId;
  return requested == null || requested === '' ? user.branchId : Number(requested);
}

async function activeBranch(tx, id) {
  const branch = await tx.branch.findUnique({ where: { id } });
  if (!branch) throw fail(404, 'NOT_FOUND', 'Branch not found');
  if (!branch.isActive) throw validation('branchId', 'inactive', 'branch is inactive');
  return branch;
}
async function activeProduct(tx, id, field = 'productId') {
  const product = await tx.product.findUnique({ where: { id } });
  if (!product) throw fail(404, 'NOT_FOUND', 'Product not found');
  if (!product.isActive) throw validation(field, 'inactive', 'product is inactive');
  return product;
}
function toPo(row) {
  return {
    id: row.id, poNumber: row.poNumber, supplierId: row.supplierId, supplierName: row.supplier?.name,
    branchId: row.branchId, branchName: row.branch?.name, status: row.status,
    totalCost: row.items?.reduce((sum, i) => sum.plus(i.orderedQty.times(i.unitCost)), D(0)).toDecimalPlaces(2).toNumber(),
    note: row.note, items: row.items?.map((i) => ({ id: i.id, productId: i.productId, productName: i.product.name, sku: i.product.sku,
      quantity: i.orderedQty.toNumber(), receivedQuantity: i.receivedQty.toNumber(), unitCost: i.unitCost.toNumber() })),
    createdBy: actor(row.createdBy), createdAt: row.createdAt, approvedBy: actor(row.approvedBy), approvedAt: row.approvedAt,
    rejectedBy: actor(row.rejectedBy), rejectedAt: row.rejectedAt, rejectReason: row.rejectReason,
    updatedAt: row.updatedAt,
  };
}
const poInclude = { supplier: true, branch: true, items: { include: { product: { select: { name: true, sku: true } } } },
  createdBy: { select: actorSelect }, approvedBy: { select: actorSelect }, rejectedBy: { select: actorSelect } };
function toSale(row, user) {
  return { id: row.id, invoiceNumber: row.invoiceNumber, branchId: row.branchId, branchName: row.branch?.name,
    customerName: row.customerName, items: row.items?.map((i) => ({ id: i.id, productId: i.productId, productName: i.product.name,
      sku: i.product.sku, quantity: i.quantity.toNumber(), returnedQuantity: i.returnedQty?.toNumber() ?? 0,
      returnableQuantity: i.quantity.minus(i.returnedQty ?? D(0)).toNumber(), unitPrice: i.unitPrice.toNumber(), lineTotal: i.lineTotal.toNumber() })),
    netAmount: row.subtotal.toNumber(), taxType: row.taxType, taxRate: row.taxRate.times(100).toNumber(),
    taxAmount: row.taxAmount.toNumber(), total: row.total.toNumber(), createdBy: actor(row.createdBy), createdAt: row.createdAt };
}
const saleInclude = { branch: true, createdBy: { select: actorSelect }, items: { include: { product: { select: { name: true, sku: true } } } } };

async function getCompanySettings() {
  const s = await prisma.companySetting.findUnique({ where: { id: 1 } });
  if (!s) throw fail(500, 'SERVER_ERROR', 'Company settings have not been initialized');
  return { companyName: s.companyName, address: s.address, phone: s.phone, tin: s.tin, taxType: s.taxType,
    taxRate: s.taxRate.times(100).toNumber(), defaultTaxRates: { VAT: 15, TOT: 2 }, updatedAt: s.updatedAt };
}
async function updateCompanySettings(body, userId) {
  const before = await prisma.companySetting.findUnique({ where: { id: 1 } });
  if (!before) throw fail(500, 'SERVER_ERROR', 'Company settings have not been initialized');
  const updated = await prisma.$transaction(async (tx) => {
    const next = await tx.companySetting.update({ where: { id: 1 }, data: {
      companyName: body.companyName, address: body.address ?? null, phone: body.phone ?? null, tin: body.tin ?? null,
      taxType: body.taxType, taxRate: D(body.taxRate).div(100),
    } });
    await audit(tx, userId, 'SETTINGS_UPDATED', 'COMPANY_SETTING', 1, null,
      { companyName: before.companyName, taxType: before.taxType, taxRate: before.taxRate.times(100).toNumber() },
      { companyName: next.companyName, taxType: next.taxType, taxRate: next.taxRate.times(100).toNumber() });
    return next;
  });
  return { companyName: updated.companyName, address: updated.address, phone: updated.phone, tin: updated.tin,
    taxType: updated.taxType, taxRate: updated.taxRate.times(100).toNumber(), defaultTaxRates: { VAT: 15, TOT: 2 }, updatedAt: updated.updatedAt };
}

async function createPurchaseOrder(user, body) {
  const branchId = branchScope(user, body.branchId, { required: user.role === 'ADMIN' });
  await activeBranch(prisma, branchId);
  const supplier = await prisma.supplier.findUnique({ where: { id: body.supplierId } });
  if (!supplier) throw fail(404, 'NOT_FOUND', 'Supplier not found');
  if (!supplier.isActive) throw validation('supplierId', 'inactive', 'supplier is inactive');
  uniqueLines(body.items);
  for (const line of body.items) await activeProduct(prisma, line.productId);
  const row = await prisma.$transaction(async (tx) => {
    const po = await tx.purchaseOrder.create({ data: { poNumber: 'PENDING', supplierId: body.supplierId, branchId,
      note: body.note ?? null, createdById: user.userId } });
    await tx.purchaseOrder.update({ where: { id: po.id }, data: { poNumber: `PO-${String(po.id).padStart(6, '0')}` } });
    await tx.purchaseOrderItem.createMany({ data: body.items.map((i) => ({ purchaseOrderId: po.id, productId: i.productId,
      orderedQty: D(i.quantity), unitCost: D(i.unitCost) })) });
    await audit(tx, user.userId, 'PO_CREATED', 'PO', po.id, branchId, undefined, { supplierId: body.supplierId, status: 'PENDING_APPROVAL' });
    return tx.purchaseOrder.findUnique({ where: { id: po.id }, include: poInclude });
  });
  return toPo(row);
}
async function listPurchaseOrders(user, query) {
  const { page, limit, skip } = parsePagination(query);
  const branchId = branchScope(user, query.branchId);
  const where = { ...(branchId == null ? {} : { branchId }), ...(query.status ? { status: query.status } : {}),
    ...(query.supplierId ? { supplierId: positiveId(query.supplierId, 'Supplier') } : {}),
    ...(query.q ? { poNumber: { contains: query.q, mode: 'insensitive' } } : {}),
    ...(dateRangeFilter(query) ? { createdAt: dateRangeFilter(query) } : {}) };
  const [rows, total] = await Promise.all([prisma.purchaseOrder.findMany({ where, include: { ...poInclude, items: { select: { id: true, orderedQty: true, unitCost: true } } },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip, take: limit }), prisma.purchaseOrder.count({ where })]);
  return { data: rows.map((r) => ({ ...toPo({ ...r, items: undefined }), itemCount: r.items.length,
    totalCost: r.items.reduce((sum, item) => sum.plus(item.orderedQty.times(item.unitCost)), D(0)).toDecimalPlaces(2).toNumber() })), page, limit, total };
}
async function getPurchaseOrder(user, id) {
  const row = await prisma.purchaseOrder.findUnique({ where: { id: positiveId(id, 'Purchase order') }, include: poInclude });
  if (!row) throw fail(404, 'NOT_FOUND', 'Purchase order not found');
  assertBranchAccess(user, row.branchId);
  if (user.role === 'AUDITOR') throw fail(403, 'FORBIDDEN', 'Auditors cannot view purchase orders');
  return toPo(row);
}
async function changePoStatus(user, id, action, reason) {
  const poId = positiveId(id, 'Purchase order');
  const result = await prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw`SELECT "id" FROM "PurchaseOrder" WHERE "id" = ${poId} FOR UPDATE`;
    if (!locked.length) throw fail(404, 'NOT_FOUND', 'Purchase order not found');
    const po = await tx.purchaseOrder.findUnique({ where: { id: poId }, include: poInclude });
    assertBranchAccess(user, po.branchId);
    if (po.status !== 'PENDING_APPROVAL') throw fail(409, 'INVALID_STATUS', 'Purchase order is not pending approval');
    const now = new Date();
    const data = action === 'approve' ? { status: 'APPROVED', approvedById: user.userId, approvedAt: now }
      : { status: 'REJECTED', rejectedById: user.userId, rejectedAt: now, rejectReason: reason || null };
    const updated = await tx.purchaseOrder.update({ where: { id: poId }, data, include: poInclude });
    await audit(tx, user.userId, action === 'approve' ? 'PO_APPROVED' : 'PO_REJECTED', 'PO', poId, po.branchId,
      { status: po.status }, { status: updated.status, reason: reason || null });
    return updated;
  });
  return toPo(result);
}
async function receivePurchaseOrder(user, id, items) {
  const poId = positiveId(id, 'Purchase order');
  if (!Array.isArray(items) || !items.length) throw validation('items', 'required');
  const updated = await prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw`SELECT "id" FROM "PurchaseOrder" WHERE "id" = ${poId} FOR UPDATE`;
    if (!locked.length) throw fail(404, 'NOT_FOUND', 'Purchase order not found');
    const po = await tx.purchaseOrder.findUnique({ where: { id: poId }, include: { ...poInclude } });
    assertBranchAccess(user, po.branchId);
    if (!['APPROVED', 'PARTIALLY_RECEIVED'].includes(po.status)) throw fail(409, 'INVALID_STATUS', 'Purchase order cannot be received in its current status');
    const lineById = new Map(po.items.map((line) => [line.id, line]));
    for (const [idx, item] of items.entries()) {
      const line = lineById.get(Number(item.id ?? item.itemId));
      if (!line) throw fail(404, 'NOT_FOUND', `Purchase order item ${item.id ?? item.itemId} not found`);
      const qty = D(item.quantity);
      const remaining = line.orderedQty.minus(line.receivedQty);
      if (!qty.gt(0) || qty.decimalPlaces() > 2) throw validation(`items[${idx}].quantity`, 'invalid');
      if (qty.gt(remaining)) throw fail(422, 'OVER_RECEIVE', 'Received quantity exceeds the outstanding amount', [
        { field: `items[${idx}].quantity`, itemId: line.id, remaining: remaining.toNumber(), requested: qty.toNumber() },
      ]);
      await tx.purchaseOrderItem.update({ where: { id: line.id }, data: { receivedQty: { increment: qty } } });
      await applyMovement({ productId: line.productId, branchId: po.branchId, quantity: qty.toNumber(), type: 'PURCHASE_RECEIPT',
        referenceType: 'PURCHASE_ORDER', referenceId: po.id, userId: user.userId }, tx);
    }
    const refreshedItems = await tx.purchaseOrderItem.findMany({ where: { purchaseOrderId: poId } });
    const complete = refreshedItems.every((i) => i.receivedQty.gte(i.orderedQty));
    const any = refreshedItems.some((i) => i.receivedQty.gt(0));
    const status = complete ? 'RECEIVED' : any ? 'PARTIALLY_RECEIVED' : 'APPROVED';
    const next = await tx.purchaseOrder.update({ where: { id: poId }, data: { status }, include: poInclude });
    await audit(tx, user.userId, 'PO_RECEIVED', 'PO', poId, po.branchId, { status: po.status }, { status });
    return next;
  });
  return toPo(updated);
}

async function createSale(user, body) {
  const branchId = branchScope(user, body.branchId, { required: user.role === 'ADMIN' });
  await activeBranch(prisma, branchId);
  uniqueLines(body.items);
  const products = new Map();
  const short = [];
  for (const line of body.items) {
    const product = await activeProduct(prisma, line.productId, `items[${body.items.indexOf(line)}].productId`);
    products.set(line.productId, product);
    const stock = await prisma.branchStock.findUnique({ where: { productId_branchId: { productId: line.productId, branchId } } });
    const available = stock?.quantity ?? D(0);
    if (available.lt(line.quantity)) short.push({ field: `items[${body.items.indexOf(line)}].quantity`, productId: line.productId,
      available: available.toNumber(), requested: line.quantity });
  }
  if (short.length) throw fail(422, 'INSUFFICIENT_STOCK', 'Not enough stock for one or more products', short);
  const row = await prisma.$transaction(async (tx) => {
    const settingsRows = await tx.$queryRaw`SELECT "id" FROM "CompanySetting" WHERE "id" = 1 FOR UPDATE`;
    if (!settingsRows.length) throw fail(500, 'SERVER_ERROR', 'Company settings have not been initialized');
    const settings = await tx.companySetting.findUnique({ where: { id: 1 } });
    const total = body.items.reduce((sum, i) => sum.plus(products.get(i.productId).sellingPrice.times(i.quantity).toDecimalPlaces(2)), D(0)).toDecimalPlaces(2);
    const tax = total.times(settings.taxRate).div(D(1).plus(settings.taxRate)).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
    const sale = await tx.sale.create({ data: { invoiceNumber: `INV-${String(settings.nextInvoiceNumber).padStart(6, '0')}`,
      branchId, customerName: body.customerName ?? null, createdById: user.userId,
      total, subtotal: total.minus(tax), taxType: settings.taxType, taxRate: settings.taxRate, taxAmount: tax,
      items: { create: body.items.map((i) => ({ productId: i.productId, quantity: D(i.quantity),
        unitPrice: products.get(i.productId).sellingPrice, lineTotal: products.get(i.productId).sellingPrice.times(i.quantity).toDecimalPlaces(2) })) } } });
    await tx.companySetting.update({ where: { id: 1 }, data: { nextInvoiceNumber: { increment: 1 } } });
    for (const line of [...body.items].sort((a, b) => a.productId - b.productId)) {
      try {
        await applyMovement({ productId: line.productId, branchId, quantity: -line.quantity, type: 'SALE', referenceType: 'SALE',
          referenceId: sale.id, userId: user.userId }, tx);
      } catch (e) {
        if (e.code === 'INSUFFICIENT_STOCK') throw fail(422, 'INSUFFICIENT_STOCK', e.message,
          [{ field: `items[${body.items.indexOf(line)}].quantity`, productId: line.productId,
            available: Math.max(0, (await tx.branchStock.findUnique({ where: { productId_branchId: { productId: line.productId, branchId } } })).quantity.toNumber()), requested: line.quantity }]);
        throw e;
      }
    }
    await audit(tx, user.userId, 'SALE_CREATED', 'SALE', sale.id, branchId, undefined, { invoiceNumber: sale.invoiceNumber, total: total.toNumber() });
    return tx.sale.findUnique({ where: { id: sale.id }, include: saleInclude });
  });
  return toSale(row, user);
}
async function listSales(user, query) {
  if (user.role === 'AUDITOR') throw fail(403, 'FORBIDDEN', 'Auditors cannot view sales');
  const { page, limit, skip } = parsePagination(query);
  const branchId = branchScope(user, query.branchId);
  const where = { ...(branchId == null ? {} : { branchId }), ...(query.createdBy ? { createdById: positiveId(query.createdBy, 'User') } : {}),
    ...(query.invoiceNumber ? { invoiceNumber: { contains: query.invoiceNumber, mode: 'insensitive' } } : {}),
    ...(dateRangeFilter(query) ? { createdAt: dateRangeFilter(query) } : {}) };
  const [rows, total] = await Promise.all([prisma.sale.findMany({ where, include: saleInclude, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip, take: limit }), prisma.sale.count({ where })]);
  return { data: rows.map((r) => { const { items, ...sale } = toSale(r, user); return { ...sale, itemCount: items.length }; }), page, limit, total };
}
async function getSale(user, id) {
  if (user.role === 'AUDITOR') throw fail(403, 'FORBIDDEN', 'Auditors cannot view sales');
  const row = await prisma.sale.findUnique({ where: { id: positiveId(id, 'Sale') }, include: saleInclude });
  if (!row) throw fail(404, 'NOT_FOUND', 'Sale not found');
  assertBranchAccess(user, row.branchId);
  const settings = await prisma.companySetting.findUnique({ where: { id: 1 } });
  return { ...toSale(row, user), company: settings ? { companyName: settings.companyName, address: settings.address, tin: settings.tin } : null };
}

function toReturn(row) {
  return { id: row.id, saleId: row.saleId, invoiceNumber: row.sale?.invoiceNumber, branchId: row.branchId, branchName: row.branch?.name,
    items: row.items?.map((i) => ({ saleItemId: i.saleItemId, productId: i.productId, productName: i.product.name,
      quantity: i.quantity.toNumber(), unitPrice: i.unitPrice.toNumber(), lineTotal: i.lineTotal.toNumber() })), reason: row.reason,
    refundAmount: row.refundAmount.toNumber(), refundStatus: row.refundStatus, createdBy: actor(row.createdBy), createdAt: row.createdAt,
    refundedBy: actor(row.refundedBy), refundedAt: row.refundedAt };
}
const returnInclude = { sale: true, branch: true, createdBy: { select: actorSelect }, refundedBy: { select: actorSelect },
  items: { include: { product: { select: { name: true } } } } };
async function createReturn(user, saleId, body) {
  const result = await prisma.$transaction(async (tx) => {
    const sid = positiveId(saleId, 'Sale');
    const locked = await tx.$queryRaw`SELECT "id" FROM "Sale" WHERE "id" = ${sid} FOR UPDATE`;
    if (!locked.length) throw fail(404, 'NOT_FOUND', 'Sale not found');
    const sale = await tx.sale.findUnique({ where: { id: sid }, include: { branch: true, items: true } });
    assertBranchAccess(user, sale.branchId);
    if (!Array.isArray(body.items) || !body.items.length) throw validation('items', 'required');
    const seen = new Set();
    const resultItems = [];
    for (const [idx, input] of body.items.entries()) {
      const saleItemId = positiveId(input.saleItemId, `items[${idx}].saleItemId`);
      if (seen.has(saleItemId)) throw validation(`items[${idx}].saleItemId`, 'duplicate');
      seen.add(saleItemId);
      const item = sale.items.find((i) => i.id === saleItemId);
      if (!item) throw fail(404, 'NOT_FOUND', 'Sale item not found');
      const qty = D(input.quantity);
      if (!qty.gt(0) || qty.decimalPlaces() > 2) throw validation(`items[${idx}].quantity`);
      const remaining = item.quantity.minus(item.returnedQty);
      if (qty.gt(remaining)) throw fail(422, 'RETURN_EXCEEDS_SOLD', 'Return exceeds the quantity sold',
        [{ field: `items[${idx}].quantity`, saleItemId, returnable: remaining.toNumber(), requested: qty.toNumber() }]);
      resultItems.push({ item, qty, lineTotal: item.unitPrice.times(qty).toDecimalPlaces(2) });
    }
    const refund = resultItems.reduce((sum, i) => sum.plus(i.lineTotal), D(0)).toDecimalPlaces(2);
    const ret = await tx.saleReturn.create({ data: { saleId: sale.id, branchId: sale.branchId, reason: body.reason ?? null,
      refundAmount: refund, createdById: user.userId, items: { create: resultItems.map(({ item, qty, lineTotal }) => ({
        saleItemId: item.id, productId: item.productId, quantity: qty, unitPrice: item.unitPrice, lineTotal })) } } });
    for (const { item, qty } of resultItems) {
      await tx.saleItem.update({ where: { id: item.id }, data: { returnedQty: { increment: qty } } });
      await applyMovement({ productId: item.productId, branchId: sale.branchId, quantity: qty.toNumber(), type: 'CUSTOMER_RETURN',
        referenceType: 'RETURN', referenceId: ret.id, userId: user.userId }, tx);
    }
    await audit(tx, user.userId, 'RETURN_CREATED', 'RETURN', ret.id, sale.branchId, undefined, { saleId: sale.id, refundAmount: refund.toNumber() });
    return tx.saleReturn.findUnique({ where: { id: ret.id }, include: returnInclude });
  });
  return toReturn(result);
}
async function listReturns(user, query) {
  if (user.role === 'AUDITOR') throw fail(403, 'FORBIDDEN', 'Auditors cannot view returns');
  const { page, limit, skip } = parsePagination(query);
  const branchId = branchScope(user, query.branchId);
  const where = { ...(branchId == null ? {} : { branchId }), ...(query.saleId ? { saleId: positiveId(query.saleId, 'Sale') } : {}),
    ...(query.refundStatus ? { refundStatus: query.refundStatus } : {}), ...(dateRangeFilter(query) ? { createdAt: dateRangeFilter(query) } : {}) };
  const [rows, total] = await Promise.all([prisma.saleReturn.findMany({ where, include: returnInclude, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip, take: limit }), prisma.saleReturn.count({ where })]);
  return { data: rows.map(toReturn), page, limit, total };
}
async function getReturn(user, id) {
  if (user.role === 'AUDITOR') throw fail(403, 'FORBIDDEN', 'Auditors cannot view returns');
  const row = await prisma.saleReturn.findUnique({ where: { id: positiveId(id, 'Return') }, include: returnInclude });
  if (!row) throw fail(404, 'NOT_FOUND', 'Return not found');
  assertBranchAccess(user, row.branchId);
  return toReturn(row);
}
async function markRefunded(user, id) {
  const updated = await prisma.$transaction(async (tx) => {
    const rid = positiveId(id, 'Return');
    const locked = await tx.$queryRaw`SELECT "id" FROM "SaleReturn" WHERE "id" = ${rid} FOR UPDATE`;
    if (!locked.length) throw fail(404, 'NOT_FOUND', 'Return not found');
    const row = await tx.saleReturn.findUnique({ where: { id: rid } });
    assertBranchAccess(user, row.branchId);
    if (row.refundStatus !== 'PENDING_REFUND') throw fail(409, 'INVALID_STATUS', 'Return has already been refunded');
    const next = await tx.saleReturn.update({ where: { id: rid }, data: { refundStatus: 'REFUNDED', refundedById: user.userId, refundedAt: new Date() }, include: returnInclude });
    await audit(tx, user.userId, 'RETURN_REFUNDED', 'RETURN', rid, row.branchId, { refundStatus: row.refundStatus }, { refundStatus: next.refundStatus });
    return next;
  });
  return toReturn(updated);
}

async function createAdjustment(user, body) {
  const branchId = branchScope(user, body.branchId, { required: user.role === 'ADMIN' });
  await activeBranch(prisma, branchId);
  await activeProduct(prisma, body.productId);
  const quantity = D(body.quantityChange);
  if (!quantity.isFinite() || quantity.isZero() || quantity.decimalPlaces() > 2) throw validation('quantityChange');
  const negativeReasons = ['DAMAGE', 'EXPIRY', 'LOSS'];
  if (negativeReasons.includes(body.reason) && !quantity.isNegative()) throw validation('quantityChange', 'must_be_negative');
  if (body.reason === 'OPENING_STOCK' && !quantity.isPositive()) throw validation('quantityChange', 'min', 'opening stock must be positive');
  const row = await prisma.$transaction(async (tx) => {
    const created = await tx.adjustment.create({ data: { branchId, productId: body.productId, quantityChange: quantity, reason: body.reason,
      note: body.note ?? null, userId: user.userId } });
    try {
      await applyMovement({ productId: body.productId, branchId, quantity: quantity.toNumber(), type: body.reason === 'OPENING_STOCK' ? 'OPENING_STOCK' : 'ADJUSTMENT', reason: body.reason,
        referenceType: 'ADJUSTMENT', referenceId: created.id, userId: user.userId }, tx);
    } catch (error) {
      if (error.code === 'INSUFFICIENT_STOCK') {
        const stock = await tx.branchStock.findUnique({ where: { productId_branchId: { productId: body.productId, branchId } } });
        throw fail(422, 'INSUFFICIENT_STOCK', error.message, [{ field: 'quantity', productId: body.productId,
          available: stock?.quantity.toNumber() ?? 0, requested: Math.abs(quantity.toNumber()) }]);
      }
      throw error;
    }
    await audit(tx, user.userId, 'ADJUSTMENT_CREATED', 'ADJUSTMENT', created.id, branchId, undefined,
      { productId: body.productId, quantityChange: quantity.toNumber(), reason: body.reason });
    return tx.adjustment.findUnique({ where: { id: created.id }, include: { product: true, user: { select: actorSelect }, branch: true } });
  });
  return { id: row.id, branchId, branchName: row.branch.name, productId: row.productId, productName: row.product.name,
    quantity: row.quantityChange.toNumber(), reason: row.reason, note: row.note, createdBy: actor(row.user), createdAt: row.createdAt };
}
async function listAdjustments(user, query) {
  const { page, limit, skip } = parsePagination(query);
  const branchId = branchScope(user, query.branchId);
  const where = { ...(branchId == null ? {} : { branchId }), ...(query.productId ? { productId: positiveId(query.productId, 'Product') } : {}),
    ...(query.reason ? { reason: query.reason } : {}),
    ...(query.userId ? { userId: positiveId(query.userId, 'User') } : {}), ...(dateRangeFilter(query) ? { createdAt: dateRangeFilter(query) } : {}) };
  const [rows, total] = await Promise.all([prisma.adjustment.findMany({ where, include: { product: true, branch: true, user: { select: actorSelect } },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip, take: limit }), prisma.adjustment.count({ where })]);
  return { data: rows.map((r) => ({ id: r.id, branchId: r.branchId, branchName: r.branch.name, productId: r.productId,
    productName: r.product.name, quantity: r.quantityChange.toNumber(), reason: r.reason, note: r.note, createdBy: actor(r.user), createdAt: r.createdAt })), page, limit, total };
}

function toTransfer(r) {
  return { id: r.id, fromBranchId: r.fromBranchId, fromBranchName: r.fromBranch?.name, toBranchId: r.toBranchId, toBranchName: r.toBranch?.name,
    status: r.status, note: r.note, items: r.items?.map((i) => ({ productId: i.productId, productName: i.product.name, quantity: i.quantity.toNumber() })),
    requestedBy: actor(r.requestedBy), requestedAt: r.createdAt, approvedBy: actor(r.approvedBy), approvedAt: r.approvedAt,
    rejectedBy: actor(r.rejectedBy), rejectedAt: r.rejectedAt, rejectReason: r.rejectReason, shippedBy: actor(r.shippedBy), shippedAt: r.shippedAt,
    receivedBy: actor(r.receivedBy), receivedAt: r.receivedAt };
}
const transferInclude = { fromBranch: true, toBranch: true, items: { include: { product: { select: { name: true } } } },
  requestedBy: { select: actorSelect }, approvedBy: { select: actorSelect }, rejectedBy: { select: actorSelect },
  shippedBy: { select: actorSelect }, receivedBy: { select: actorSelect } };
async function createTransfer(user, body) {
  const fromBranchId = positiveId(body.fromBranchId, 'Source branch');
  const toBranchId = positiveId(body.toBranchId, 'Destination branch');
  if (fromBranchId === toBranchId) throw validation('toBranchId', 'invalid', 'source and destination must differ');
  if (user.role !== 'ADMIN' && user.branchId !== toBranchId) throw fail(403, 'FORBIDDEN', 'A transfer request must target your own branch');
  await activeBranch(prisma, fromBranchId); await activeBranch(prisma, toBranchId); uniqueLines(body.items);
  for (const item of body.items) await activeProduct(prisma, item.productId);
  const row = await prisma.$transaction(async (tx) => {
    const t = await tx.transfer.create({ data: { fromBranchId, toBranchId, note: body.note ?? null, requestedById: user.userId,
      items: { create: body.items.map((i) => ({ productId: i.productId, quantity: D(i.quantity) })) } }, include: transferInclude });
    await audit(tx, user.userId, 'TRANSFER_REQUESTED', 'TRANSFER', t.id, toBranchId, undefined, { fromBranchId, toBranchId });
    return t;
  });
  return toTransfer(row);
}
async function listTransfers(user, query) {
  if (user.role === 'AUDITOR') throw fail(403, 'FORBIDDEN', 'Auditors cannot view transfers');
  const { page, limit, skip } = parsePagination(query);
  const branchId = branchScope(user, query.branchId);
  const where = { ...(branchId == null ? {} : { OR: [{ fromBranchId: branchId }, { toBranchId: branchId }] }),
    ...(query.status ? { status: query.status } : {}), ...(dateRangeFilter(query) ? { createdAt: dateRangeFilter(query) } : {}) };
  if (query.direction && branchId != null) where[query.direction === 'incoming' ? 'toBranchId' : 'fromBranchId'] = branchId;
  const [rows, total] = await Promise.all([prisma.transfer.findMany({ where, include: { ...transferInclude, items: { select: { id: true } } },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip, take: limit }), prisma.transfer.count({ where })]);
  return { data: rows.map((r) => ({ ...toTransfer({ ...r, items: undefined }), itemCount: r.items.length })), page, limit, total };
}
async function getTransfer(user, id) {
  if (user.role === 'AUDITOR') throw fail(403, 'FORBIDDEN', 'Auditors cannot view transfers');
  const row = await prisma.transfer.findUnique({ where: { id: positiveId(id, 'Transfer') }, include: transferInclude });
  if (!row) throw fail(404, 'NOT_FOUND', 'Transfer not found');
  assertBranchAccess(user, row.fromBranchId); assertBranchAccess(user, row.toBranchId);
  return toTransfer(row);
}
async function actOnTransfer(user, id, action, reason) {
  const tid = positiveId(id, 'Transfer');
  const row = await prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw`SELECT "id" FROM "Transfer" WHERE "id" = ${tid} FOR UPDATE`;
    if (!locked.length) throw fail(404, 'NOT_FOUND', 'Transfer not found');
    const current = await tx.transfer.findUnique({ where: { id: tid }, include: transferInclude });
    const sourceSide = ['approve', 'reject', 'ship'].includes(action);
    assertBranchAccess(user, sourceSide ? current.fromBranchId : current.toBranchId);
    if (action === 'approve' || action === 'reject') {
      if (!['ADMIN', 'BRANCH_MANAGER'].includes(user.role)) throw fail(403, 'FORBIDDEN', 'Only Admin or source Branch Manager may approve transfers');
      if (current.status !== 'REQUESTED') throw fail(409, 'INVALID_STATUS', 'Transfer is not awaiting approval');
    }
    if (action === 'ship' && current.status !== 'APPROVED') throw fail(409, 'INVALID_STATUS', 'Transfer is not approved');
    if (action === 'receive' && current.status !== 'SHIPPED') throw fail(409, 'INVALID_STATUS', 'Transfer is not in transit');
    if (action === 'ship') {
      const shortages = [];
      for (const [idx, item] of [...current.items].sort((a, b) => a.productId - b.productId).entries()) {
        const stock = await tx.branchStock.findUnique({ where: { productId_branchId: { productId: item.productId, branchId: current.fromBranchId } } });
        const available = stock?.quantity ?? D(0);
        if (available.lt(item.quantity)) shortages.push({ field: `items[${idx}].quantity`, productId: item.productId,
          available: available.toNumber(), requested: item.quantity.toNumber() });
      }
      if (shortages.length) throw fail(422, 'INSUFFICIENT_STOCK', 'Not enough stock for one or more transfer items', shortages);
    }
    if (action === 'ship') for (const item of [...current.items].sort((a, b) => a.productId - b.productId)) {
      await applyMovement({ productId: item.productId, branchId: current.fromBranchId, quantity: -item.quantity.toNumber(), type: 'TRANSFER_OUT',
        referenceType: 'TRANSFER', referenceId: tid, userId: user.userId }, tx);
    }
    if (action === 'receive') for (const item of [...current.items].sort((a, b) => a.productId - b.productId)) {
      await applyMovement({ productId: item.productId, branchId: current.toBranchId, quantity: item.quantity.toNumber(), type: 'TRANSFER_IN',
        referenceType: 'TRANSFER', referenceId: tid, userId: user.userId }, tx);
    }
    const data = action === 'approve' ? { status: 'APPROVED', approvedById: user.userId, approvedAt: new Date() }
      : action === 'reject' ? { status: 'REJECTED', rejectedById: user.userId, rejectedAt: new Date(), rejectReason: reason ?? null }
      : action === 'ship' ? { status: 'SHIPPED', shippedById: user.userId, shippedAt: new Date() }
      : { status: 'RECEIVED', receivedById: user.userId, receivedAt: new Date() };
    const next = await tx.transfer.update({ where: { id: tid }, data, include: transferInclude });
    const actionName = { approve: 'TRANSFER_APPROVED', reject: 'TRANSFER_REJECTED', ship: 'TRANSFER_SHIPPED', receive: 'TRANSFER_RECEIVED' }[action];
    await audit(tx, user.userId, actionName, 'TRANSFER', tid, sourceSide ? current.fromBranchId : current.toBranchId,
      { status: current.status }, { status: next.status, reason: reason ?? null });
    return next;
  });
  return toTransfer(row);
}

async function listNotifications(user, query) {
  if (!['ADMIN', 'BRANCH_MANAGER'].includes(user.role)) throw fail(403, 'FORBIDDEN', 'Notifications are unavailable for this role');
  const branchId = branchScope(user, query.branchId);
  const where = { ...(branchId == null ? {} : { branchId }) };
  const { page, limit, skip } = parsePagination(query);
  if (query.unread === 'true') where.isRead = false;
  const [rows, total, unreadCount] = await Promise.all([prisma.notification.findMany({ where, include: { branch: true, product: true },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip, take: limit }), prisma.notification.count({ where }), prisma.notification.count({ where: { ...(branchId == null ? {} : { branchId }), isRead: false } })]);
  return { data: rows.map((r) => ({ id: r.id, type: r.type, branchId: r.branchId, branchName: r.branch.name, productId: r.productId,
    productName: r.product.name, quantity: r.quantity.toNumber(), minQuantity: r.minQty.toNumber(), isRead: r.isRead, createdAt: r.createdAt })), page, limit, total, unreadCount };
}
async function markNotificationRead(user, id) {
  if (!['ADMIN', 'BRANCH_MANAGER'].includes(user.role)) throw fail(403, 'FORBIDDEN', 'Notifications are unavailable for this role');
  const row = await prisma.notification.findUnique({ where: { id: positiveId(id, 'Notification') } });
  if (!row) throw fail(404, 'NOT_FOUND', 'Notification not found');
  assertBranchAccess(user, row.branchId);
  await prisma.notification.update({ where: { id: row.id }, data: { isRead: true } });
  return { success: true };
}
async function markAllNotificationsRead(user, query) {
  if (!['ADMIN', 'BRANCH_MANAGER'].includes(user.role)) throw fail(403, 'FORBIDDEN', 'Notifications are unavailable for this role');
  const branchId = branchScope(user, query.branchId);
  await prisma.notification.updateMany({ where: { isRead: false, ...(branchId == null ? {} : { branchId }) }, data: { isRead: true } });
  return { success: true };
}
async function lowStock(user, query) {
  if (!['ADMIN', 'BRANCH_MANAGER'].includes(user.role)) throw fail(403, 'FORBIDDEN', 'Low stock is unavailable for this role');
  const { page, limit, skip } = parsePagination(query);
  const branchId = branchScope(user, query.branchId);
  const where = { minQty: { gt: 0 }, product: { isActive: true }, branch: { isActive: true }, ...(branchId == null ? {} : { branchId }) };
  const rows = await prisma.branchStock.findMany({ where, include: { product: true, branch: true }, orderBy: [{ product: { name: 'asc' } }, { branchId: 'asc' }] });
  const filtered = rows.filter((r) => r.quantity.lte(r.minQty));
  const data = filtered.slice(skip, skip + limit).map((r) => ({ branchId: r.branchId, branchName: r.branch.name, productId: r.productId,
    productName: r.product.name, sku: r.product.sku, quantity: r.quantity.toNumber(), minQuantity: r.minQty.toNumber(),
    maxQuantity: n(r.maxQty), suggestedReorder: Math.max(0, (r.maxQty ?? r.minQty.times(2)).minus(r.quantity).toNumber()) }));
  return { data, page, limit, total: filtered.length };
}

async function listAuditLogs(user, query) {
  if (!['ADMIN', 'BRANCH_MANAGER', 'AUDITOR'].includes(user.role)) throw fail(403, 'FORBIDDEN', 'You cannot view audit logs');
  const { page, limit, skip } = parsePagination(query);
  let branchId = branchScope(user, query.branchId);
  const where = { ...(branchId == null ? {} : { branchId }), ...(query.userId ? { userId: positiveId(query.userId, 'User') } : {}),
    ...(query.action ? { action: query.action } : {}), ...(query.entityType ? { entityType: query.entityType } : {}),
    ...(dateRangeFilter(query) ? { createdAt: dateRangeFilter(query) } : {}) };
  if (query.entityId) where.entityId = positiveId(query.entityId, 'Entity');
  if (query.productId) { where.entityType = 'PRODUCT'; where.entityId = positiveId(query.productId, 'Product'); }
  const [rows, total] = await Promise.all([prisma.auditLog.findMany({ where, include: { user: { select: actorSelect }, branch: true },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip, take: limit }), prisma.auditLog.count({ where })]);
  return { data: rows.map((r) => ({ id: r.id, userId: r.userId, createdBy: actor(r.user), action: r.action, entityType: r.entityType,
    entityId: r.entityId, branchId: r.branchId, branchName: r.branch?.name ?? null, oldValue: r.oldValue, newValue: r.newValue, createdAt: r.createdAt })), page, limit, total };
}

async function dashboard(user, query) {
  const branchId = branchScope(user, user.role === 'ADMIN' ? query.branchId : undefined);
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - 3 * 60 * 60 * 1000);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  const stockWhere = { ...(branchId == null ? {} : { branchId }), branch: { isActive: true }, product: { isActive: true } };
  const [stock, salesAgg, salesCount, lows, pendingPos, pendingTransfers, inTransit, refunds, auditRows, adjustments] = await Promise.all([
    prisma.branchStock.findMany({ where: stockWhere, include: { product: { select: { costPrice: true } } } }),
    prisma.sale.aggregate({ where: { ...(branchId == null ? {} : { branchId }), createdAt: { gte: start, lt: end } }, _sum: { total: true } }),
    prisma.sale.count({ where: { ...(branchId == null ? {} : { branchId }), createdAt: { gte: start, lt: end } } }),
    prisma.branchStock.findMany({ where: { ...stockWhere, minQty: { gt: 0 } }, include: { branch: true, product: true } }),
    prisma.purchaseOrder.count({ where: { ...(branchId == null ? {} : { branchId }), status: 'PENDING_APPROVAL' } }),
    prisma.transfer.count({ where: { ...(branchId == null ? {} : { OR: [{ fromBranchId: branchId }, { toBranchId: branchId }] }), status: 'REQUESTED' } }),
    prisma.transfer.count({ where: { ...(branchId == null ? {} : { OR: [{ fromBranchId: branchId }, { toBranchId: branchId }] }), status: 'SHIPPED' } }),
    prisma.saleReturn.aggregate({ where: { ...(branchId == null ? {} : { branchId }), refundStatus: 'PENDING_REFUND' }, _count: { id: true }, _sum: { refundAmount: true } }),
    ['ADMIN', 'AUDITOR'].includes(user.role) ? prisma.auditLog.findMany({ where: { ...(branchId == null ? {} : { branchId }) }, include: { user: { select: actorSelect } }, orderBy: { createdAt: 'desc' }, take: 8 }) : Promise.resolve([]),
    user.role === 'AUDITOR' ? prisma.adjustment.findMany({ where: { ...(branchId == null ? {} : { branchId }) }, include: { product: true }, orderBy: { createdAt: 'desc' }, take: 8 }) : Promise.resolve([]),
  ]);
  const lowItems = lows.filter((r) => r.quantity.lte(r.minQty)).map((r) => ({ productId: r.productId, productName: r.product.name,
    branchId: r.branchId, branchName: r.branch.name, quantity: r.quantity.toNumber(), minQuantity: r.minQty.toNumber() }));
  const stockValue = stock.reduce((sum, r) => sum.plus(r.quantity.times(r.product.costPrice)), D(0)).toDecimalPlaces(2).toNumber();
  const widgets = { stockValue, salesToday: { count: salesCount, total: n(salesAgg._sum.total) ?? 0 }, lowStockItems: lowItems,
    lowStockCount: lowItems.length, pendingApprovals: { purchaseOrders: pendingPos, transfers: pendingTransfers }, transfersInTransit: inTransit,
    pendingRefunds: { count: refunds._count.id, totalAmount: n(refunds._sum.refundAmount) ?? 0 }, recentActivity: auditRows.map((r) => ({ id: r.id, action: r.action, user: actor(r.user), createdAt: r.createdAt })),
    recentAdjustments: adjustments.map((r) => ({ id: r.id, productName: r.product.name, quantity: r.quantityChange.toNumber(), reason: r.reason, createdAt: r.createdAt })) };
  if (user.role === 'STAFF') return { role: user.role, widgets: { salesToday: widgets.salesToday,
    expectedPurchaseOrders: await prisma.purchaseOrder.count({ where: { branchId: user.branchId, status: { in: ['APPROVED', 'PARTIALLY_RECEIVED'] } } }),
    pendingTransfers: await prisma.transfer.count({ where: { toBranchId: user.branchId, status: { in: ['REQUESTED', 'APPROVED', 'SHIPPED'] } } }) } };
  if (user.role === 'AUDITOR') return { role: user.role, widgets: { recentAuditActivity: auditRows.map((r) => ({ id: r.id, userId: r.userId,
    user: actor(r.user), action: r.action, entityType: r.entityType, entityId: r.entityId, branchId: r.branchId, createdAt: r.createdAt })), recentAdjustments: widgets.recentAdjustments } };
  if (user.role === 'BRANCH_MANAGER') return { role: user.role, widgets: { stockValue, salesToday: widgets.salesToday,
    lowStockItems: lowItems, pendingApprovals: widgets.pendingApprovals, transfersInTransit: inTransit, pendingRefunds: widgets.pendingRefunds } };
  const branches = await prisma.branch.findMany({ where: { isActive: true }, select: { id: true, name: true } });
  return { role: user.role, widgets: { stockValue, salesSummary: widgets.salesToday, branchComparison: branches.map((b) => ({ branchId: b.id, branchName: b.name,
      stockValue: stock.filter((r) => r.branchId === b.id).reduce((sum, r) => sum + r.quantity.times(r.product.costPrice).toNumber(), 0) })), lowStockCount: lowItems.length,
    pendingRefunds: widgets.pendingRefunds, recentActivity: widgets.recentActivity,
  } };
}

async function reportStock(user, query) {
  if (user.role === 'STAFF') throw fail(403, 'FORBIDDEN', 'Staff cannot view reports');
  const { page, limit, skip } = parsePagination(query);
  const branchId = branchScope(user, query.branchId);
  const where = { ...(branchId == null ? {} : { branchId }), ...(query.productId ? { productId: positiveId(query.productId, 'Product') } : {}),
    branch: { isActive: true }, product: { isActive: true } };
  const rows = await prisma.branchStock.findMany({ where, include: { product: true, branch: true }, orderBy: [{ product: { name: 'asc' } }, { branchId: 'asc' }] });
  const all = rows.map((r) => ({ productId: r.productId, productName: r.product.name, sku: r.product.sku, unit: r.product.unit,
    branchId: r.branchId, branchName: r.branch.name, quantity: r.quantity.toNumber(), costPrice: r.product.costPrice.toNumber(),
    sellingPrice: r.product.sellingPrice.toNumber(), stockValue: r.quantity.times(r.product.costPrice).toDecimalPlaces(2).toNumber() }));
  return { data: all.slice(skip, skip + limit), page, limit, total: all.length,
    totals: { quantity: all.reduce((a, r) => a + r.quantity, 0), stockValue: all.reduce((a, r) => a + r.stockValue, 0) } };
}
async function reportSales(user, query) {
  if (user.role === 'STAFF') throw fail(403, 'FORBIDDEN', 'Staff cannot view reports');
  const { page, limit, skip } = parsePagination(query);
  const branchId = branchScope(user, query.branchId);
  const where = { ...(branchId == null ? {} : { branchId }), ...(dateRangeFilter(query) ? { createdAt: dateRangeFilter(query) } : {}) };
  const [rows, total, agg] = await Promise.all([prisma.sale.findMany({ where, include: saleInclude, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip, take: limit }), prisma.sale.count({ where }), prisma.sale.aggregate({ where, _sum: { total: true, taxAmount: true, subtotal: true } })]);
  return { data: rows.map((r) => toSale(r, user)), page, limit, total, totals: { total: n(agg._sum.total) ?? 0, taxAmount: n(agg._sum.taxAmount) ?? 0, subtotal: n(agg._sum.subtotal) ?? 0 } };
}
async function reportMovements(user, query) {
  if (user.role === 'STAFF') throw fail(403, 'FORBIDDEN', 'Staff cannot view reports');
  const { page, limit, skip } = parsePagination(query);
  const branchId = branchScope(user, query.branchId);
  const where = { ...(branchId == null ? {} : { branchId }), ...(query.productId ? { productId: positiveId(query.productId, 'Product') } : {}),
    ...(dateRangeFilter(query) ? { createdAt: dateRangeFilter(query) } : {}) };
  const [rows, total] = await Promise.all([prisma.stockMovement.findMany({ where, include: { product: true, branch: true, user: { select: actorSelect } }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip, take: limit }), prisma.stockMovement.count({ where })]);
  return { data: rows.map((r) => ({ id: r.id, productId: r.productId, productName: r.product.name, sku: r.product.sku,
    branchId: r.branchId, branchName: r.branch.name, type: r.type, quantityChange: r.quantityChange.toNumber(), quantityAfter: r.quantityAfter.toNumber(),
    referenceType: r.referenceType, referenceId: r.referenceId, reason: r.reason, createdBy: actor(r.user), createdAt: r.createdAt })), page, limit, total };
}

module.exports = { getCompanySettings, updateCompanySettings, createPurchaseOrder, listPurchaseOrders, getPurchaseOrder, changePoStatus,
  receivePurchaseOrder, createSale, listSales, getSale, createReturn, listReturns, getReturn, markRefunded, createAdjustment,
  listAdjustments, createTransfer, listTransfers, getTransfer, actOnTransfer, listNotifications, markNotificationRead,
  markAllNotificationsRead, lowStock, listAuditLogs, dashboard, reportStock, reportSales, reportMovements };
