const prisma = require('../../config/db');
const { AppError } = require('../../middleware/errors');
const { assertBranchAccess } = require('../../middleware/auth');
const { validationError } = require('../../middleware/validate'); // shared builder
const { writeAudit, AUDIT_ACTIONS } = require('../../middleware/audit'); // shared audit writer
const { applyMovement } = require('../../services/stockService'); // the only place stock changes
const { parsePagination } = require('../../utils/pagination'); // shared pagination rule
const { dateRangeFilter } = require('../../utils/dates'); // shared Ethiopia-day parser
const { D, money } = require('../../utils/decimal'); // shared money helpers

const saleInclude = {
  branch: { select: { name: true } },
  createdBy: { select: { id: true, fullName: true } },
  items: { orderBy: { id: 'asc' }, include: { product: { select: { name: true } } } },
};

function parseIntParam(value, field) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) {
    throw validationError(`Invalid ${field}`, field, 'invalid', 'must be a positive whole number');
  }
  return n;
}

const insufficientStock = (details) =>
  new AppError(
    422,
    'INSUFFICIENT_STOCK',
    `Not enough stock for ${details.length} item${details.length === 1 ? '' : 's'}.`,
    details
  );

// The sale object from the contract (6.6). Field map (6.11): netAmount is Sale.subtotal,
// taxRate is stored as a fraction (0.15) and returned as a percentage (15).
function toSale(sale, { withReturned = false } = {}) {
  return {
    id: sale.id,
    invoiceNumber: sale.invoiceNumber,
    branchId: sale.branchId,
    branchName: sale.branch.name,
    customerName: sale.customerName,
    createdBy: { id: sale.createdBy.id, name: sale.createdBy.fullName },
    items: sale.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      productName: item.product.name,
      quantity: item.quantity.toNumber(),
      ...(withReturned ? { returnedQuantity: item.returnedQty.toNumber() } : {}),
      unitPrice: item.unitPrice.toNumber(),
      lineTotal: item.lineTotal.toNumber(),
    })),
    netAmount: sale.subtotal.toNumber(),
    taxType: sale.taxType,
    taxRate: sale.taxRate.times(100).toNumber(),
    taxAmount: sale.taxAmount.toNumber(),
    total: sale.total.toNumber(),
    createdAt: sale.createdAt,
  };
}

// Admin must send branchId. Manager and Staff always sell from their own branch (default if left out;
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

// POST /api/sales   (contract 6.6, steps 1 to 8)
async function createSale(user, body) {
  // Step 1: permissions and input
  const branchId = resolveBranchId(user, body.branchId);
  const { items } = body;

  const seen = new Set();
  items.forEach((item, i) => {
    if (seen.has(item.productId)) {
      throw validationError('A product appears twice', `items[${i}].productId`, 'duplicate', 'each product may appear once');
    }
    seen.add(item.productId);
  });

  const branch = await prisma.branch.findUnique({ where: { id: branchId }, select: { id: true, isActive: true } });
  if (!branch) throw new AppError(404, 'NOT_FOUND', 'Branch not found');
  if (!branch.isActive) throw validationError('Branch is inactive', 'branchId', 'inactive', 'branch is not active');

  // Step 2: load the products. Prices come from the server, never from the client.
  const products = await prisma.product.findMany({
    where: { id: { in: items.map((i) => i.productId) } },
    select: { id: true, sellingPrice: true, isActive: true },
  });
  const productById = new Map(products.map((p) => [p.id, p]));
  items.forEach((item, i) => {
    const product = productById.get(item.productId);
    if (!product) throw new AppError(404, 'NOT_FOUND', 'Product not found');
    if (!product.isActive) {
      throw validationError('Product is inactive', `items[${i}].productId`, 'inactive', 'product is not active');
    }
  });

  // Step 3: check the stock of every line first (plain read, no writes). Nothing is saved
  // and no invoice number is used when a line is short.
  const stockRows = await prisma.branchStock.findMany({
    where: { branchId, productId: { in: items.map((i) => i.productId) } },
    select: { productId: true, quantity: true },
  });
  const availableByProduct = new Map(stockRows.map((r) => [r.productId, r.quantity]));
  const shortLines = [];
  items.forEach((item, i) => {
    const available = availableByProduct.get(item.productId) || D(0);
    if (available.lt(D(item.quantity))) {
      shortLines.push({
        field: `items[${i}].quantity`,
        productId: item.productId,
        available: available.toNumber(),
        requested: item.quantity,
      });
    }
  });
  if (shortLines.length > 0) throw insufficientStock(shortLines);

  return prisma.$transaction(
    async (tx) => {
      // Step 4: lock the company settings row, read the counter, tax type and rate
      const [settings] = await tx.$queryRaw`
        SELECT "nextInvoiceNumber", "taxType", "taxRate"
        FROM "CompanySetting" WHERE "id" = 1 FOR UPDATE`;
      if (!settings) throw new Error('Company settings row (id = 1) is missing. Run the seed.');

      const invoiceNumber = `INV-${String(settings.nextInvoiceNumber).padStart(6, '0')}`;
      await tx.companySetting.update({
        where: { id: 1 },
        data: { nextInvoiceNumber: settings.nextInvoiceNumber + 1 },
      });

      // Step 5: calculate. Prices include tax; tax is calculated once on the invoice total.
      const lines = items.map((item, i) => {
        const unitPrice = productById.get(item.productId).sellingPrice;
        const quantity = D(item.quantity);
        return { index: i, productId: item.productId, quantity, unitPrice, lineTotal: money(unitPrice.times(quantity)) };
      });
      const total = lines.reduce((sum, l) => sum.plus(l.lineTotal), D(0));
      const ratePercent = D(settings.taxRate).times(100); // 0.15 becomes 15
      const taxAmount = money(total.times(ratePercent).div(D(100).plus(ratePercent)));
      const netAmount = total.minus(taxAmount);

      // Step 6: save the sale and its items. The sale keeps its own tax type and rate.
      const sale = await tx.sale.create({
        data: {
          invoiceNumber,
          branchId,
          customerName: body.customerName || null,
          createdById: user.userId,
          subtotal: netAmount,
          taxType: settings.taxType,
          taxRate: D(settings.taxRate),
          taxAmount,
          total,
          items: {
            create: lines.map((l) => ({
              productId: l.productId,
              quantity: l.quantity,
              unitPrice: l.unitPrice,
              lineTotal: l.lineTotal,
            })),
          },
        },
        include: saleInclude,
      });

      // Step 7: take the stock, lines sorted by productId (locks the stock rows in a fixed order).
      // If another sale took the stock since step 3, everything rolls back, including the counter.
      const sorted = [...lines].sort((a, b) => a.productId - b.productId);
      for (const line of sorted) {
        try {
          await applyMovement(
            {
              productId: line.productId,
              branchId,
              quantity: line.quantity.negated().toFixed(2),
              type: 'SALE',
              referenceType: 'SALE',
              referenceId: sale.id,
              userId: user.userId,
            },
            tx
          );
        } catch (e) {
          if (e instanceof AppError && e.code === 'INSUFFICIENT_STOCK') {
            const row = await tx.branchStock.findUnique({
              where: { productId_branchId: { productId: line.productId, branchId } },
              select: { quantity: true },
            });
            throw insufficientStock([
              {
                field: `items[${line.index}].quantity`,
                productId: line.productId,
                available: row ? row.quantity.toNumber() : 0,
                requested: line.quantity.toNumber(),
              },
            ]);
          }
          throw e;
        }
      }

      // Step 8: the audit entry is saved in the same transaction
      await writeAudit(
        {
          userId: user.userId,
          action: AUDIT_ACTIONS.SALE_CREATED,
          entityType: 'SALE',
          entityId: sale.id,
          branchId,
          oldValue: null,
          newValue: { invoiceNumber, total: total.toNumber() },
        },
        tx
      );

      return toSale(sale);
    },
    { timeout: 20000 }
  );
}

// GET /api/sales   (Admin: all branches; Manager and Staff: own branch; the route blocks the Auditor)
// Items are left out of the list and itemCount is added instead.
async function listSales(user, query = {}) {
  const { page, limit, skip } = parsePagination(query);

  const where = {};
  if (query.branchId !== undefined && query.branchId !== '') {
    const branchId = parseIntParam(query.branchId, 'branchId');
    assertBranchAccess(user, branchId); // Manager and Staff get 403 for another branch
    where.branchId = branchId;
  } else if (user.role !== 'ADMIN' && user.role !== 'AUDITOR') {
    // Admin and Auditor see all branches; Manager and Staff default to their own
    where.branchId = user.branchId;
  }
  if (query.invoiceNumber) where.invoiceNumber = { contains: query.invoiceNumber, mode: 'insensitive' };
  if (query.createdBy !== undefined && query.createdBy !== '') {
    where.createdById = parseIntParam(query.createdBy, 'createdBy');
  }
  const createdAt = dateRangeFilter(query); // from and to are Ethiopia-time days
  if (createdAt) where.createdAt = createdAt;

  const [rows, total] = await Promise.all([
    prisma.sale.findMany({
      where,
      include: {
        branch: { select: { name: true } },
        createdBy: { select: { id: true, fullName: true } },
        _count: { select: { items: true } },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip,
      take: limit,
    }),
    prisma.sale.count({ where }),
  ]);

  const data = rows.map((sale) => {
    const { items, ...summary } = toSale({ ...sale, items: [] });
    return { ...summary, itemCount: sale._count.items };
  });

  return { data, page, limit, total };
}

// GET /api/sales/:id   (the sale, plus returnedQuantity per item and the company block for printing)
async function getSale(user, idParam) {
  const id = Number(idParam);
  if (!Number.isInteger(id) || id < 1) throw new AppError(404, 'NOT_FOUND', 'Sale not found');

  const sale = await prisma.sale.findUnique({ where: { id }, include: saleInclude });
  if (!sale) throw new AppError(404, 'NOT_FOUND', 'Sale not found');
  assertBranchAccess(user, sale.branchId); // 403 for another branch

  const company = await prisma.companySetting.findUnique({
    where: { id: 1 },
    select: { companyName: true, address: true, tin: true },
  });

  return { ...toSale(sale, { withReturned: true }), company };
}

module.exports = { createSale, listSales, getSale };