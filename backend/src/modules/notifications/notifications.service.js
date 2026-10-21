const prisma = require('../../config/db');
const { AppError } = require('../../middleware/errors');
const { validationError } = require('../../middleware/validate');
const { parsePagination } = require('../../utils/pagination');
const { parseIntParam } = require('../../utils/params');
const { assertBranchAccess } = require('../../middleware/auth');

const notificationInclude = {
  branch: { select: { name: true } },
  product: { select: { name: true } },
};

function toNotification(notification) {
  return {
    id: notification.id,
    type: notification.type,
    branchId: notification.branchId,
    branchName: notification.branch.name,
    productId: notification.productId,
    productName: notification.product.name,
    quantity: notification.quantity.toNumber(),
    minQuantity: notification.minQty.toNumber(),
    isRead: notification.isRead,
    createdAt: notification.createdAt,
  };
}

function notificationScope(user, query = {}) {
  const where = {};

  if (user.role === 'ADMIN') {
    if (query.branchId !== undefined && query.branchId !== '') {
      where.branchId = parseIntParam(query.branchId, 'branchId');
    }
    return where;
  }

  // The routes restrict this module to Admin and Branch Manager.
  const ownBranchId = user.branchId;

  if (query.branchId !== undefined && query.branchId !== '') {
    const requestedBranchId = parseIntParam(query.branchId, 'branchId');
    assertBranchAccess(user, requestedBranchId);
    where.branchId = requestedBranchId;
  } else {
    where.branchId = ownBranchId;
  }

  return where;
}

// GET /api/notifications
async function listNotifications(user, query = {}) {
  const { page, limit, skip } = parsePagination(query);
  const where = notificationScope(user, query);

  if (query.unread !== undefined && query.unread !== '') {
    if (query.unread !== 'true') {
      throw validationError(
        'Invalid unread filter',
        'unread',
        'invalid',
        'unread must be true when supplied'
      );
    }

    where.isRead = false;
  }

  const unreadWhere = {
    ...notificationScope(user, query),
    isRead: false,
  };

  const [rows, total, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      include: notificationInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip,
      take: limit,
    }),
    prisma.notification.count({ where }),
    prisma.notification.count({ where: unreadWhere }),
  ]);

  return {
    data: rows.map(toNotification),
    unreadCount,
    page,
    limit,
    total,
  };
}

// POST /api/notifications/:id/read
async function markNotificationRead(user, rawId) {
  const id = parseIntParam(rawId, 'id');

  const notification = await prisma.notification.findUnique({
    where: { id },
    select: { id: true, branchId: true },
  });

  if (!notification) {
    throw new AppError(404, 'NOT_FOUND', 'Notification not found');
  }

  if (
    user.role !== 'ADMIN' &&
    notification.branchId !== user.branchId
  ) {
    throw new AppError(
      403,
      'FORBIDDEN',
      'You cannot access notifications from another branch'
    );
  }

  await prisma.notification.update({
    where: { id },
    data: { isRead: true },
  });

  return { success: true };
}

// POST /api/notifications/read-all
async function markAllNotificationsRead(user) {
  const where =
    user.role === 'ADMIN'
      ? { isRead: false }
      : { branchId: user.branchId, isRead: false };

  await prisma.notification.updateMany({
    where,
    data: { isRead: true },
  });

  return { success: true };
}

// GET /api/low-stock
async function listLowStock(user, query = {}) {
  const { page, limit, skip } = parsePagination(query);

  let branchId;

  if (user.role === 'ADMIN') {
    if (query.branchId !== undefined && query.branchId !== '') {
      branchId = parseIntParam(query.branchId, 'branchId');
    }
  } else {
    branchId = user.branchId;

    if (query.branchId !== undefined && query.branchId !== '') {
      const requestedBranchId = parseIntParam(
        query.branchId,
        'branchId'
      );
      assertBranchAccess(user, requestedBranchId);
      branchId = requestedBranchId;
    }
  }

  const where = {
    minQty: { gt: 0 },
    product: { isActive: true },
  };

  if (branchId !== undefined) {
    where.branchId = branchId;
  }

  if (query.categoryId !== undefined && query.categoryId !== '') {
    where.product = {
      ...where.product,
      categoryId: parseIntParam(query.categoryId, 'categoryId'),
    };
  }

  // Prisma's normal where filters cannot compare two columns directly.
  // Fetch the configured stock rows, then apply quantity <= minQty in JS.
  const rows = await prisma.branchStock.findMany({
    where,
    include: {
      branch: { select: { name: true } },
      product: { select: { id: true, name: true, sku: true } },
    },
  });

  const lowStockRows = rows
    .filter((row) => row.quantity.toNumber() <= row.minQty.toNumber())
    .map((row) => {
      const quantity = row.quantity.toNumber();
      const minQuantity = row.minQty.toNumber();
      const maxQuantity =
        row.maxQty === null ? null : row.maxQty.toNumber();

      return {
        branchId: row.branchId,
        branchName: row.branch.name,
        productId: row.productId,
        productName: row.product.name,
        sku: row.product.sku,
        quantity,
        minQuantity,
        maxQuantity,
        suggestedReorderQuantity:
          maxQuantity !== null
            ? Math.max(0, maxQuantity - quantity)
            : Math.max(0, 2 * minQuantity - quantity),
      };
    })
    .sort(
      (a, b) =>
        a.productName.localeCompare(b.productName) ||
        a.branchName.localeCompare(b.branchName)
    );

  const total = lowStockRows.length;

  return {
    data: lowStockRows.slice(skip, skip + limit),
    page,
    limit,
    total,
  };
}

module.exports = {
  listNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  listLowStock,
};
