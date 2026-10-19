const { asyncHandler } = require('../../middleware/errors');
const svc = require('./core.service');
const productImport = require('./import.service');

const call = (fn) => asyncHandler(async (req, res) => {
  const value = await fn(req);
  res.json(value);
});
const listCsv = (res, result, columns) => {
  const escape = (value) => {
    let s = value == null ? '' : value instanceof Date ? value.toISOString() : String(value);
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return `"${s.replace(/"/g, '""')}"`;
  };
  const rows = [columns.map((c) => escape(c.label)).join(','), ...result.data.map((row) => columns.map((c) => escape(c.value(row))).join(','))];
  res.type('text/csv; charset=utf-8').send(`\uFEFF${rows.join('\r\n')}`);
};
const allReportRows = async (fn, user, query) => {
  const first = await fn(user, { ...query, page: 1, limit: 100 });
  const pages = Math.ceil(first.total / first.limit);
  const data = [...first.data];
  for (let page = 2; page <= pages; page += 1) data.push(...(await fn(user, { ...query, page, limit: 100 })).data);
  return { ...first, data };
};

exports.settingsGet = call(() => svc.getCompanySettings());
exports.settingsPut = call((req) => svc.updateCompanySettings(req.body, req.user.userId));
exports.poCreate = asyncHandler(async (req, res) => res.status(201).json(await svc.createPurchaseOrder(req.user, req.body)));
exports.poList = call((req) => svc.listPurchaseOrders(req.user, req.query));
exports.poGet = call((req) => svc.getPurchaseOrder(req.user, req.params.id));
exports.poApprove = call((req) => svc.changePoStatus(req.user, req.params.id, 'approve'));
exports.poReject = call((req) => svc.changePoStatus(req.user, req.params.id, 'reject', req.body.reason));
exports.poReceive = call((req) => svc.receivePurchaseOrder(req.user, req.params.id, req.body.items));
exports.saleCreate = asyncHandler(async (req, res) => res.status(201).json(await svc.createSale(req.user, req.body)));
exports.saleList = call((req) => svc.listSales(req.user, req.query));
exports.saleGet = call((req) => svc.getSale(req.user, req.params.id));
exports.returnCreate = asyncHandler(async (req, res) => res.status(201).json(await svc.createReturn(req.user, req.params.id, req.body)));
exports.returnList = call((req) => svc.listReturns(req.user, req.query));
exports.returnGet = call((req) => svc.getReturn(req.user, req.params.id));
exports.returnRefund = call((req) => svc.markRefunded(req.user, req.params.id));
exports.adjustmentCreate = asyncHandler(async (req, res) => res.status(201).json(await svc.createAdjustment(req.user, req.body)));
exports.adjustmentList = call((req) => svc.listAdjustments(req.user, req.query));
exports.transferCreate = asyncHandler(async (req, res) => res.status(201).json(await svc.createTransfer(req.user, req.body)));
exports.transferList = call((req) => svc.listTransfers(req.user, req.query));
exports.transferGet = call((req) => svc.getTransfer(req.user, req.params.id));
exports.transferAction = (action) => call((req) => svc.actOnTransfer(req.user, req.params.id, action, req.body?.reason));
exports.notificationsList = call((req) => svc.listNotifications(req.user, req.query));
exports.notificationRead = call((req) => svc.markNotificationRead(req.user, req.params.id));
exports.notificationsReadAll = call((req) => svc.markAllNotificationsRead(req.user, req.query));
exports.lowStock = call((req) => svc.lowStock(req.user, req.query));
exports.auditLogs = call((req) => svc.listAuditLogs(req.user, req.query));
exports.dashboard = call((req) => svc.dashboard(req.user, req.query));
exports.reportStock = asyncHandler(async (req, res) => {
  const result = req.query.format === 'csv' ? await allReportRows(svc.reportStock, req.user, req.query) : await svc.reportStock(req.user, req.query);
  if (req.query.format === 'csv') return listCsv(res, result, [
    { label: 'productId', value: (r) => r.productId }, { label: 'productName', value: (r) => r.productName },
    { label: 'sku', value: (r) => r.sku }, { label: 'unit', value: (r) => r.unit }, { label: 'branchId', value: (r) => r.branchId },
    { label: 'branchName', value: (r) => r.branchName }, { label: 'quantity', value: (r) => r.quantity },
    { label: 'costPrice', value: (r) => r.costPrice }, { label: 'sellingPrice', value: (r) => r.sellingPrice },
    { label: 'stockValue', value: (r) => r.stockValue },
  ]);
  res.json(result);
});
exports.reportSales = asyncHandler(async (req, res) => {
  const result = req.query.format === 'csv' ? await allReportRows(svc.reportSales, req.user, req.query) : await svc.reportSales(req.user, req.query);
  if (req.query.format === 'csv') return listCsv(res, result, [
    { label: 'invoiceNumber', value: (r) => r.invoiceNumber }, { label: 'branchId', value: (r) => r.branchId },
    { label: 'branchName', value: (r) => r.branchName }, { label: 'customerName', value: (r) => r.customerName },
    { label: 'netAmount', value: (r) => r.netAmount }, { label: 'taxType', value: (r) => r.taxType },
    { label: 'taxRate', value: (r) => r.taxRate }, { label: 'taxAmount', value: (r) => r.taxAmount },
    { label: 'total', value: (r) => r.total }, { label: 'createdAt', value: (r) => r.createdAt },
  ]);
  res.json(result);
});
exports.reportMovements = asyncHandler(async (req, res) => {
  const result = req.query.format === 'csv' ? await allReportRows(svc.reportMovements, req.user, req.query) : await svc.reportMovements(req.user, req.query);
  if (req.query.format === 'csv') return listCsv(res, result, [
    { label: 'productId', value: (r) => r.productId }, { label: 'productName', value: (r) => r.productName },
    { label: 'sku', value: (r) => r.sku }, { label: 'branchId', value: (r) => r.branchId },
    { label: 'branchName', value: (r) => r.branchName }, { label: 'type', value: (r) => r.type },
    { label: 'quantityChange', value: (r) => r.quantityChange }, { label: 'quantityAfter', value: (r) => r.quantityAfter },
    { label: 'referenceType', value: (r) => r.referenceType }, { label: 'referenceId', value: (r) => r.referenceId },
    { label: 'createdBy', value: (r) => r.createdBy?.name }, { label: 'createdAt', value: (r) => r.createdAt },
  ]);
  res.json(result);
});

exports.importTemplate = asyncHandler(async (req, res) => {
  res.type('text/csv; charset=utf-8').send('\uFEFFsku,name,barcode,category,unit,costPrice,sellingPrice,openingQuantity\r\n');
});
exports.importProducts = asyncHandler(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'A CSV file is required',
    details: [{ field: 'file', rule: 'required', issue: 'select a CSV file' }] } });
  if (!['true', 'false'].includes(req.query.dryRun)) return res.status(400).json({ error: { code: 'VALIDATION_ERROR',
    message: 'dryRun must be true or false', details: [{ field: 'dryRun', rule: 'required', issue: 'set dryRun=true or false' }] } });
  res.json(await productImport.previewOrImport(req.file.buffer, { dryRun: req.query.dryRun === 'true', branchId: req.body.branchId, userId: req.user.userId }));
});
