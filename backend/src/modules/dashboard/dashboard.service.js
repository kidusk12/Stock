const { Prisma } = require('@prisma/client');
const prisma = require('../../config/db');
const { AppError } = require('../../middleware/errors');
const { assertBranchAccess } = require('../../middleware/auth');
const { dateRangeFilter } = require('../../utils/dates');
const { parseIntParam } = require('../../utils/params');

function dashboardBranch(user, query) {
  if (user.role === 'ADMIN') {
    return query.branchId !== undefined && query.branchId !== ''
      ? parseIntParam(query.branchId, 'branchId')
      : null;
  }
  if (user.role === 'AUDITOR') return null;
  if (query.branchId !== undefined && query.branchId !== '') {
    const requested = parseIntParam(query.branchId, 'branchId');
    assertBranchAccess(user, requested);
  }
  if (!user.branchId) throw new AppError(403, 'FORBIDDEN', 'This account is not assigned to a branch');
  return user.branchId;
}

function todayRange() {
  const ethiopiaToday = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
  return dateRangeFilter({ from: ethiopiaToday, to: ethiopiaToday });
}

function salesTodayWhere(branchId) {
  const where = { createdAt: todayRange() };
  if (branchId !== null) where.branchId = branchId;
  return where;
}

async function salesToday(branchId) {
  const result = await prisma.sale.aggregate({
    where: salesTodayWhere(branchId),
    _count: { _all: true },
    _sum: { total: true },
  });
  return { count: result._count._all, total: result._sum.total?.toNumber() || 0 };
}

async function stockValue(branchId) {
  const where = { product: { isActive: true }, branch: { isActive: true } };
  if (branchId !== null) where.branchId = branchId;
  const rows = await prisma.branchStock.findMany({ where, select: { quantity: true, product: { select: { costPrice: true } } } });
  const total = rows.reduce((sum, row) => sum.plus(row.quantity.times(row.product.costPrice)), new Prisma.Decimal(0));
  return total.toDecimalPlaces(2).toNumber();
}

async function lowStock(branchId) {
  const where = { minQty: { gt: 0 }, product: { isActive: true }, branch: { isActive: true } };
  if (branchId !== null) where.branchId = branchId;
  const rows = await prisma.branchStock.findMany({
    where,
    include: { product: { select: { name: true } }, branch: { select: { name: true } } },
  });
  return rows.filter((row) => row.quantity.lte(row.minQty)).map((row) => ({
    branchId: row.branchId,
    branchName: row.branch.name,
    productId: row.productId,
    productName: row.product.name,
    quantity: row.quantity.toNumber(),
    minQuantity: row.minQty.toNumber(),
  })).sort((a, b) => a.quantity - b.quantity || a.productName.localeCompare(b.productName));
}

async function pendingRefunds(branchId) {
  const where = { refundStatus: 'PENDING_REFUND' };
  if (branchId !== null) where.branchId = branchId;
  const result = await prisma.saleReturn.aggregate({ where, _count: { _all: true }, _sum: { refundAmount: true } });
  return { count: result._count._all, totalAmount: result._sum.refundAmount?.toNumber() || 0 };
}

async function recentAuditActivity(branchId, limit = 5) {
  const where = branchId === null ? {} : { branchId };
  const rows = await prisma.auditLog.findMany({
    where,
    include: { user: { select: { id: true, fullName: true } }, branch: { select: { name: true } } },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: limit,
  });
  return rows.map((row) => ({
    id: row.id,
    action: row.action,
    entityType: row.entityType,
    entityId: row.entityId,
    branchId: row.branchId,
    branchName: row.branch?.name || null,
    createdBy: { id: row.user.id, name: row.user.fullName },
    createdAt: row.createdAt,
  }));
}

async function recentAdjustments(branchId, limit = 5) {
  const where = branchId === null ? {} : { branchId };
  const rows = await prisma.adjustment.findMany({
    where,
    include: { product: { select: { name: true } }, branch: { select: { name: true } } },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: limit,
  });
  return rows.map((row) => ({
    id: row.id,
    branchId: row.branchId,
    branchName: row.branch.name,
    productId: row.productId,
    productName: row.product.name,
    quantity: row.quantityChange.toNumber(),
    quantityChange: row.quantityChange.toNumber(),
    reason: row.reason,
    createdAt: row.createdAt,
  }));
}

async function branchComparison(branchId) {
  const createdAt = todayRange();
  const where = { createdAt };
  if (branchId !== null) where.branchId = branchId;
  const [branches, sales] = await Promise.all([
    prisma.branch.findMany({ where: { isActive: true, ...(branchId === null ? {} : { id: branchId }) }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    prisma.sale.groupBy({ by: ['branchId'], where, _sum: { total: true } }),
  ]);
  const totals = new Map(sales.map((row) => [row.branchId, row._sum.total?.toNumber() || 0]));
  return branches.map((branch) => ({ branchId: branch.id, branchName: branch.name, total: totals.get(branch.id) || 0 }));
}

async function staffLists(branchId) {
  const [orders, transfers] = await Promise.all([
    prisma.purchaseOrder.findMany({
      where: { branchId, status: { in: ['APPROVED', 'PARTIALLY_RECEIVED'] } },
      select: { id: true, poNumber: true, status: true },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 5,
    }),
    prisma.transfer.findMany({
      where: {
        status: { in: ['REQUESTED', 'APPROVED', 'SHIPPED'] },
        OR: [{ fromBranchId: branchId }, { toBranchId: branchId }],
      },
      select: { id: true, status: true, fromBranchId: true, toBranchId: true, fromBranch: { select: { name: true } }, toBranch: { select: { name: true } } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 5,
    }),
  ]);
  return {
    expectedPurchaseOrders: orders,
    pendingTransfers: transfers.map((transfer) => ({
      id: transfer.id,
      transferNumber: `TRF-${String(transfer.id).padStart(6, '0')}`,
      status: transfer.status,
      fromBranchId: transfer.fromBranchId,
      fromBranchName: transfer.fromBranch.name,
      toBranchId: transfer.toBranchId,
      toBranchName: transfer.toBranch.name,
    })),
  };
}

async function adminWidgets(branchId) {
  const [value, summary, low, refunds, comparison, activity] = await Promise.all([
    stockValue(branchId),
    salesToday(branchId),
    lowStock(branchId),
    pendingRefunds(branchId),
    branchComparison(branchId),
    recentAuditActivity(branchId),
  ]);
  return {
    stockValue: value,
    salesSummary: summary,
    branchComparison: comparison,
    lowStockCount: low.length,
    pendingRefunds: refunds,
    recentActivity: activity,
  };
}

async function managerWidgets(branchId) {
  const [value, sales, low, pendingPOs, pendingTransfers, inTransit, refunds] = await Promise.all([
    stockValue(branchId),
    salesToday(branchId),
    lowStock(branchId),
    prisma.purchaseOrder.count({ where: { branchId, status: 'PENDING_APPROVAL' } }),
    prisma.transfer.count({ where: { fromBranchId: branchId, status: 'REQUESTED' } }),
    prisma.transfer.count({ where: { toBranchId: branchId, status: 'SHIPPED' } }),
    pendingRefunds(branchId),
  ]);
  return {
    stockValue: value,
    salesToday: sales,
    lowStockItems: low.slice(0, 5),
    lowStockCount: low.length,
    pendingApprovals: { purchaseOrders: pendingPOs, transfers: pendingTransfers },
    transfersInTransit: inTransit,
    pendingRefunds: refunds,
  };
}

async function getDashboard(user, query = {}) {
  const branchId = dashboardBranch(user, query);
  let widgets;
  if (user.role === 'ADMIN') {
    widgets = await adminWidgets(branchId);
  } else if (user.role === 'BRANCH_MANAGER') {
    widgets = await managerWidgets(branchId);
  } else if (user.role === 'STAFF') {
    const [sales, lists] = await Promise.all([salesToday(branchId), staffLists(branchId)]);
    widgets = { salesToday: sales, ...lists };
  } else if (user.role === 'AUDITOR') {
    const [activity, adjustments] = await Promise.all([recentAuditActivity(null), recentAdjustments(null)]);
    widgets = { recentAuditActivity: activity, recentAdjustments: adjustments };
  } else {
    throw new AppError(403, 'FORBIDDEN', 'This account cannot view the dashboard');
  }
  return { role: user.role, widgets };
}

module.exports = { getDashboard };
