const prisma = require('../../config/db');
const { assertBranchAccess } = require('../../middleware/auth');
const { validationError } = require('../../middleware/validate');
const { parsePagination } = require('../../utils/pagination');
const { dateRangeFilter } = require('../../utils/dates');
const { parseIntParam } = require('../../utils/params');

function resolveScope(user, query) {
  if (query.branchId !== undefined && query.branchId !== '') {
    const branchId = parseIntParam(query.branchId, 'branchId');
    assertBranchAccess(user, branchId);
    return branchId;
  }
  return user.role === 'ADMIN' || user.role === 'AUDITOR' ? null : user.branchId;
}

function resolveFormat(query) {
  const format = query.format || 'json';
  if (format !== 'json' && format !== 'csv') {
    throw validationError('Invalid format', 'format', 'invalid', 'must be json or csv');
  }
  return format;
}

function optionalProductId(query) {
  if (query.productId === undefined || query.productId === '') return undefined;
  return parseIntParam(query.productId, 'productId');
}

function csvCell(value) {
  const text = value === null || value === undefined ? '' : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

function toCsv(headers, rows) {
  return `\uFEFF${[headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n')}\r\n`;
}

const CSV_TEXT = {
  en: {
    stock: ['Product Name', 'SKU', 'Branch', 'Unit', 'Quantity', 'Cost Price (ETB)', 'Selling Price (ETB)', 'Valuation (ETB)'],
    movements: ['Date', 'Product', 'Branch', 'Movement Type', 'Qty Change', 'Qty After', 'Reference', 'Logged By', 'Reason'],
    sales: ['Invoice #', 'Date', 'Branch', 'Cashier', 'Net (ETB)', 'Tax (ETB)', 'Total Amount (ETB)'],
  },
  am: {
    stock: ['የምርት ስም', 'SKU ኮድ', 'ቅርንጫፍ', 'መለኪያ', 'ብዛት', 'የግዢ ዋጋ (ብር)', 'የመሸጫ ዋጋ (ብር)', 'የክምችት ግምት (ብር)'],
    movements: ['ቀን', 'ምርት', 'ቅርንጫፍ', 'የእንቅስቃሴ ዓይነት', 'የብዛት ለውጥ', 'ቀሪ ብዛት', 'ማጣቀሻ', 'የመዘገበው', 'ምክንያት'],
    sales: ['የደረሰኝ ቁጥር', 'ቀን', 'ቅርንጫፍ', 'ገንዘብ ተቀባይ', 'የተጣራ መጠን (ብር)', 'ግብር (ብር)', 'ጠቅላላ ክፍያ (ብር)'],
  },
};

const AM_MOVEMENT_TYPES = {
  OPENING_STOCK: 'የመጀመሪያ ክምችት', PURCHASE_RECEIPT: 'የግዢ ዕቃ ተቀባይነት',
  SALE: 'ሽያጭ', CUSTOMER_RETURN: 'የደንበኛ ተመላሽ', ADJUSTMENT: 'ማስተካከያ',
  TRANSFER_OUT: 'ወደ ውጭ ዝውውር', TRANSFER_IN: 'ወደ ውስጥ ዝውውር',
};
const AM_REASONS = {
  DAMAGE: 'ብልሽት', EXPIRY: 'ጊዜው ያለፈበት', LOSS: 'ኪሳራ/ስርቆት',
  RECOUNT: 'የቆጠራ ልዩነት', OPENING_STOCK: 'የመጀመሪያ ክምችት', OTHER: 'ሌላ',
};

function formatEthiopianDate(value, language) {
  const parts = new Intl.DateTimeFormat(language === 'am' ? 'am-ET' : 'en-ET', {
    calendar: 'ethiopic', timeZone: 'Africa/Addis_Ababa', year: 'numeric', month: 'long', day: 'numeric',
  }).formatToParts(value);
  const date = Object.fromEntries(parts.filter(({ type }) => ['day', 'month', 'year'].includes(type)).map(({ type, value: part }) => [type, part]));
  return language === 'am'
    ? `${date.month} ${date.day} ቀን ${date.year} ዓ.ም`
    : `${date.month} ${date.day}, ${date.year}`;
}

async function stockReport(user, query = {}) {
  const branchId = resolveScope(user, query);
  const productId = optionalProductId(query);
  const where = { product: { isActive: true }, branch: { isActive: true } };
  if (branchId !== null) where.branchId = branchId;
  if (productId !== undefined) where.productId = productId;
  const rows = await prisma.branchStock.findMany({
    where,
    include: { product: true, branch: { select: { id: true, name: true } } },
    orderBy: [{ product: { name: 'asc' } }, { branchId: 'asc' }],
  });
  const data = rows.map((row) => {
    const quantity = row.quantity.toNumber();
    const costPrice = row.product.costPrice.toNumber();
    return {
      productId: row.productId,
      name: row.product.name,
      sku: row.product.sku,
      branchId: row.branchId,
      branchName: row.branch.name,
      unit: row.product.unit,
      quantity,
      costPrice,
      sellingPrice: row.product.sellingPrice.toNumber(),
      valuation: row.quantity.times(row.product.costPrice).toDecimalPlaces(2).toNumber(),
    };
  });
  const totals = { totalValuation: data.reduce((sum, row) => sum + row.valuation, 0) };
  return { data, totals, total: data.length };
}

async function salesReport(user, query = {}) {
  const branchId = resolveScope(user, query);
  const productId = optionalProductId(query);
  const where = {};
  if (branchId !== null) where.branchId = branchId;
  if (productId !== undefined) where.items = { some: { productId } };
  const createdAt = dateRangeFilter(query);
  if (createdAt) where.createdAt = createdAt;

  const rows = await prisma.sale.findMany({
    where,
    include: { branch: { select: { name: true } }, createdBy: { select: { id: true, fullName: true } } },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
  });
  const data = rows.map((sale) => ({
    id: sale.id,
    invoiceNumber: sale.invoiceNumber,
    createdAt: sale.createdAt,
    branchId: sale.branchId,
    branchName: sale.branch.name,
    cashier: sale.createdBy.fullName,
    createdBy: { id: sale.createdBy.id, name: sale.createdBy.fullName },
    net: sale.subtotal.toNumber(),
    tax: sale.taxAmount.toNumber(),
    total: sale.total.toNumber(),
  }));
  const totals = {
    totalSales: data.reduce((sum, row) => sum + row.total, 0),
    totalTax: data.reduce((sum, row) => sum + row.tax, 0),
    invoiceCount: data.length,
  };
  return { data, totals, total: data.length };
}

async function movementsReport(user, query = {}) {
  const branchId = resolveScope(user, query);
  const productId = optionalProductId(query);
  const where = {};
  if (branchId !== null) where.branchId = branchId;
  if (productId !== undefined) where.productId = productId;
  const createdAt = dateRangeFilter(query);
  if (createdAt) where.createdAt = createdAt;

  const rows = await prisma.stockMovement.findMany({
    where,
    include: {
      product: { select: { name: true } },
      branch: { select: { name: true } },
      user: { select: { fullName: true } },
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
  });
  const data = rows.map((movement) => ({
    id: movement.id,
    date: movement.createdAt,
    branchId: movement.branchId,
    branchName: movement.branch.name,
    productId: movement.productId,
    productName: movement.product.name,
    type: movement.type,
    quantityChange: movement.quantityChange.toNumber(),
    quantityAfter: movement.quantityAfter.toNumber(),
    reference: movement.referenceType && movement.referenceId !== null
      ? `${movement.referenceType} #${movement.referenceId}`
      : movement.referenceType,
    user: movement.user.fullName,
    reason: movement.reason,
  }));
  const totals = { movementCount: data.length, quantityChange: data.reduce((sum, row) => sum + row.quantityChange, 0) };
  return { data, totals, total: data.length };
}

async function getReport(type, user, query = {}) {
  const format = resolveFormat(query);
  const language = query.lang === 'am' ? 'am' : 'en';
  const { page, limit, skip } = parsePagination(query);
  const result = await ({ stock: stockReport, sales: salesReport, movements: movementsReport })[type](user, query);

  if (format === 'csv') {
    let headers;
    let rows;
    if (type === 'stock') {
      headers = CSV_TEXT[language].stock;
      rows = result.data.map((row) => [row.name, row.sku, row.branchName, row.unit, row.quantity, row.costPrice, row.sellingPrice, row.valuation]);
    } else if (type === 'sales') {
      headers = CSV_TEXT[language].sales;
      rows = result.data.map((row) => [row.invoiceNumber, formatEthiopianDate(row.createdAt, language), row.branchName, row.cashier, row.net, row.tax, row.total]);
    } else {
      headers = CSV_TEXT[language].movements;
      rows = result.data.map((row) => [
        formatEthiopianDate(row.date, language), row.productName, row.branchName,
        language === 'am' ? AM_MOVEMENT_TYPES[row.type] || row.type : row.type,
        row.quantityChange, row.quantityAfter, row.reference, row.user,
        language === 'am' ? AM_REASONS[row.reason] || row.reason : row.reason,
      ]);
    }
    return { format, csv: toCsv(headers, rows) };
  }

  const pagedData = result.data.slice(skip, skip + limit);
  return { data: pagedData, totals: result.totals, page, limit, total: result.total };
}

module.exports = { getReport, toCsv };
