import { ApiError } from './apiError'
import { tokenStore } from './tokenStore'

const delay = (ms = 150) => new Promise((resolve) => setTimeout(resolve, ms))
const fail = (status, code, message, details) => {
  throw new ApiError({ status, code, message, details })
}

const STORAGE_DB_KEY = 'sms_mock_db_v2'

// Initial Seed Data
function getInitialDb() {
  const settings = {
    id: 1,
    companyName: 'Berhan Stock PLC (የብርሃን ስቶክ ኃ/የተ/የግ/ማ)',
    address: 'Bole Sub-City, Woreda 03, Addis Ababa, Ethiopia',
    phone: '+251 11 661 2345',
    tin: '0012345678',
    taxType: 'VAT',
    taxRate: 0.15,
    nextInvoiceNumber: 1042,
  }

  const branches = [
    { id: 1, code: 'BOLE', name: 'Bole Branch (ቦሌ ቅርንጫፍ)', address: 'Bole Road, Addis Ababa', phone: '+251 911 234567', isActive: true },
    { id: 2, code: 'MRK', name: 'Merkato Branch (መርካቶ ቅርንጫፍ)', address: 'Military Tera, Merkato', phone: '+251 911 345678', isActive: true },
    { id: 3, code: 'HAW', name: 'Hawassa Warehouse (ሐዋሳ መጋዘን)', address: 'Industrial Area, Hawassa', phone: '+251 916 456789', isActive: true },
  ]

  const users = [
    { id: 1, username: 'admin', fullName: 'Abebe Kebede (አበበ ከበደ)', role: 'ADMIN', branchId: null, branchName: null, isActive: true },
    { id: 2, username: 'manager', fullName: 'Marta Alemu (ማርታ አለሙ)', role: 'BRANCH_MANAGER', branchId: 1, branchName: 'Bole Branch', isActive: true },
    { id: 3, username: 'staff', fullName: 'Dawit Haile (ዳዊት ኃይሌ)', role: 'STAFF', branchId: 1, branchName: 'Bole Branch', isActive: true },
    { id: 4, username: 'auditor', fullName: 'Yonas Bekele (ዮናስ በቀለ)', role: 'AUDITOR', branchId: null, branchName: null, isActive: true },
  ]

  const categories = [
    { id: 1, name: 'Food & Grains (ምግብ እና እህሎች)', isActive: true },
    { id: 2, name: 'Edible Oils (የምግብ ዘይቶች)', isActive: true },
    { id: 3, name: 'Detergents & Soap (ሳሙናና ማጽጃዎች)', isActive: true },
    { id: 4, name: 'Beverages (መጠጦች)', isActive: true },
    { id: 5, name: 'Stationery (የጽሕፈት መሣሪያዎች)', isActive: true },
  ]

  const suppliers = [
    { id: 1, name: 'Al-Sam PLC (አልሳም ኃ/የተ/የግ/ማ)', contact: 'Mohammed Ahmed', tin: '0098765432', phone: '+251 11 551 1234', address: 'Addis Ababa', isActive: true },
    { id: 2, name: 'East Africa Bottling SC', contact: 'Selamawit Tadesse', tin: '0087654321', phone: '+251 11 442 5678', address: 'Addis Ababa', isActive: true },
    { id: 3, name: 'BGI Ethiopia PLC', contact: 'Girma Wolde', tin: '0076543210', phone: '+251 11 515 9012', address: 'Addis Ababa', isActive: true },
    { id: 4, name: 'Ada Flour Mills', contact: 'Kidus Fekadu', tin: '0065432109', phone: '+251 11 433 1122', address: 'Bishoftu', isActive: true },
  ]

  const products = [
    { id: 1, name: 'Sugar 50kg (ስኳር 50 ኪ.ግ)', sku: 'SUG-50', barcode: '6001001', categoryId: 1, categoryName: 'Food & Grains', unit: 'bag', costPrice: 3000, sellingPrice: 3450, isActive: true },
    { id: 2, name: 'Sunflower Oil 5L (የሱፍ ዘይት 5 ሊትር)', sku: 'OIL-5L', barcode: '6001002', categoryId: 2, categoryName: 'Edible Oils', unit: 'carton', costPrice: 1100, sellingPrice: 1300, isActive: true },
    { id: 3, name: 'Magna Teff 25kg (ማኛ ጤፍ 25 ኪ.ግ)', sku: 'TEF-25', barcode: '6001003', categoryId: 1, categoryName: 'Food & Grains', unit: 'bag', costPrice: 3800, sellingPrice: 4200, isActive: true },
    { id: 4, name: 'Spaghetti Pasta 500g (ፓስታ 500ግ)', sku: 'PAS-500', barcode: '6001004', categoryId: 1, categoryName: 'Food & Grains', unit: 'pack', costPrice: 35, sellingPrice: 45, isActive: true },
    { id: 5, name: 'B29 Laundry Bar Soap (የልብስ ሳሙና)', sku: 'SOA-01', barcode: '6001005', categoryId: 3, categoryName: 'Detergents & Soap', unit: 'piece', costPrice: 20, sellingPrice: 28, isActive: true },
    { id: 6, name: 'Wheat Flour 50kg (የስንዴ ዱቄት 50 ኪ.ግ)', sku: 'FLR-50', barcode: '6001006', categoryId: 1, categoryName: 'Food & Grains', unit: 'bag', costPrice: 2600, sellingPrice: 2950, isActive: true },
    { id: 7, name: 'Ambo Mineral Water 6x1L (አምቦ ውሃ)', sku: 'WAT-1L', barcode: '6001007', categoryId: 4, categoryName: 'Beverages', unit: 'pack', costPrice: 150, sellingPrice: 185, isActive: true },
    { id: 8, name: 'A4 Printing Paper 80gsm (የህትመት ወረቀት)', sku: 'PPR-A4', barcode: '6001008', categoryId: 5, categoryName: 'Stationery', unit: 'ream', costPrice: 450, sellingPrice: 550, isActive: true },
  ]

  // Branch Stocks: branchId_productId -> { quantity, minQuantity, maxQuantity }
  const branchStock = [
    { branchId: 1, productId: 1, quantity: 18, minQuantity: 15, maxQuantity: 60 },
    { branchId: 1, productId: 2, quantity: 45, minQuantity: 20, maxQuantity: 100 },
    { branchId: 1, productId: 3, quantity: 8, minQuantity: 10, maxQuantity: 40 }, // LOW STOCK!
    { branchId: 1, productId: 4, quantity: 340, minQuantity: 50, maxQuantity: 500 },
    { branchId: 1, productId: 5, quantity: 4, minQuantity: 25, maxQuantity: 200 }, // LOW STOCK!
    { branchId: 1, productId: 6, quantity: 22, minQuantity: 15, maxQuantity: 50 },
    { branchId: 1, productId: 7, quantity: 60, minQuantity: 20, maxQuantity: 100 },
    { branchId: 1, productId: 8, quantity: 3, minQuantity: 10, maxQuantity: 50 }, // LOW STOCK!
    // Merkato branch stock
    { branchId: 2, productId: 1, quantity: 50, minQuantity: 20, maxQuantity: 80 },
    { branchId: 2, productId: 2, quantity: 80, minQuantity: 30, maxQuantity: 120 },
    { branchId: 2, productId: 3, quantity: 35, minQuantity: 15, maxQuantity: 60 },
    { branchId: 2, productId: 5, quantity: 150, minQuantity: 40, maxQuantity: 300 },
    // Hawassa warehouse stock
    { branchId: 3, productId: 1, quantity: 200, minQuantity: 50, maxQuantity: 500 },
    { branchId: 3, productId: 2, quantity: 300, minQuantity: 50, maxQuantity: 600 },
    { branchId: 3, productId: 3, quantity: 150, minQuantity: 40, maxQuantity: 300 },
    { branchId: 3, productId: 6, quantity: 180, minQuantity: 50, maxQuantity: 400 },
  ]

  const purchaseOrders = [
    {
      id: 1,
      poNumber: 'PO-2026-001',
      supplierId: 1,
      supplierName: 'Al-Sam PLC',
      branchId: 1,
      branchName: 'Bole Branch',
      totalCost: 150000,
      status: 'APPROVED',
      createdAt: '2026-10-15T08:30:00Z',
      createdById: 3,
      createdByName: 'Dawit Haile',
      approvedById: 2,
      approvedByName: 'Marta Alemu',
      items: [
        { id: 1, productId: 1, productName: 'Sugar 50kg', sku: 'SUG-50', quantity: 50, unitCost: 3000, receivedQuantity: 0 },
      ]
    },
    {
      id: 2,
      poNumber: 'PO-2026-002',
      supplierId: 2,
      supplierName: 'East Africa Bottling SC',
      branchId: 1,
      branchName: 'Bole Branch',
      totalCost: 55000,
      status: 'PARTIALLY_RECEIVED',
      createdAt: '2026-10-14T09:15:00Z',
      createdById: 2,
      createdByName: 'Marta Alemu',
      approvedById: 1,
      approvedByName: 'Abebe Kebede',
      items: [
        { id: 2, productId: 2, productName: 'Sunflower Oil 5L', sku: 'OIL-5L', quantity: 50, unitCost: 1100, receivedQuantity: 30 },
      ]
    },
    {
      id: 3,
      poNumber: 'PO-2026-003',
      supplierId: 4,
      supplierName: 'Ada Flour Mills',
      branchId: 1,
      branchName: 'Bole Branch',
      totalCost: 78000,
      status: 'PENDING_APPROVAL',
      createdAt: '2026-10-18T10:00:00Z',
      createdById: 3,
      createdByName: 'Dawit Haile',
      items: [
        { id: 3, productId: 6, productName: 'Wheat Flour 50kg', sku: 'FLR-50', quantity: 30, unitCost: 2600, receivedQuantity: 0 },
      ]
    }
  ]

  const sales = [
    {
      id: 1,
      invoiceNumber: 'INV-2026-1039',
      branchId: 1,
      branchName: 'Bole Branch',
      customerName: 'Ato Solomon Kebede',
      customerTin: '0023456789',
      subtotal: 10434.78,
      tax: 1565.22,
      total: 12000.00,
      createdAt: '2026-10-17T11:20:00Z',
      createdById: 3,
      createdByName: 'Dawit Haile',
      items: [
        { id: 1, productId: 1, productName: 'Sugar 50kg', sku: 'SUG-50', quantity: 2, unitPrice: 3450, total: 6900 },
        { id: 2, productId: 2, productName: 'Sunflower Oil 5L', sku: 'OIL-5L', quantity: 3, unitPrice: 1300, total: 3900 },
        { id: 3, productId: 7, productName: 'Ambo Mineral Water 6x1L', sku: 'WAT-1L', quantity: 6.48, unitPrice: 185, total: 1200 },
      ]
    },
    {
      id: 2,
      invoiceNumber: 'INV-2026-1040',
      branchId: 1,
      branchName: 'Bole Branch',
      customerName: 'W/ro Bethlehem Tadesse',
      customerTin: '',
      subtotal: 4173.91,
      tax: 626.09,
      total: 4800.00,
      createdAt: '2026-10-18T09:10:00Z',
      createdById: 3,
      createdByName: 'Dawit Haile',
      items: [
        { id: 4, productId: 3, productName: 'Magna Teff 25kg', sku: 'TEF-25', quantity: 1, unitPrice: 4200, total: 4200 },
        { id: 5, productId: 4, productName: 'Spaghetti Pasta 500g', sku: 'PAS-500', quantity: 13.33, unitPrice: 45, total: 600 },
      ]
    },
    {
      id: 3,
      invoiceNumber: 'INV-2026-1041',
      branchId: 1,
      branchName: 'Bole Branch',
      customerName: 'Abera Supermarket',
      customerTin: '0034567890',
      subtotal: 21739.13,
      tax: 3260.87,
      total: 25000.00,
      createdAt: '2026-10-18T13:45:00Z',
      createdById: 3,
      createdByName: 'Dawit Haile',
      items: [
        { id: 6, productId: 2, productName: 'Sunflower Oil 5L', sku: 'OIL-5L', quantity: 15, unitPrice: 1300, total: 19500 },
        { id: 7, productId: 8, productName: 'A4 Printing Paper 80gsm', sku: 'PPR-A4', quantity: 10, unitPrice: 550, total: 5500 },
      ]
    }
  ]

  const returns = [
    {
      id: 1,
      returnNumber: 'RET-2026-001',
      saleId: 1,
      invoiceNumber: 'INV-2026-1039',
      branchId: 1,
      branchName: 'Bole Branch',
      refundAmount: 3450,
      refundStatus: 'PENDING_REFUND',
      reason: 'Packaging damaged by delivery',
      createdAt: '2026-10-17T14:30:00Z',
      createdById: 3,
      createdByName: 'Dawit Haile',
      items: [
        { id: 1, saleItemId: 1, productId: 1, productName: 'Sugar 50kg', quantity: 1, unitPrice: 3450, total: 3450 }
      ]
    }
  ]

  const transfers = [
    {
      id: 1,
      transferNumber: 'TRF-2026-001',
      fromBranchId: 3,
      fromBranchName: 'Hawassa Warehouse',
      toBranchId: 1,
      toBranchName: 'Bole Branch',
      status: 'SHIPPED',
      createdAt: '2026-10-16T10:00:00Z',
      requestedById: 2,
      requestedByName: 'Marta Alemu',
      approvedById: 1,
      approvedByName: 'Abebe Kebede',
      shippedById: 1,
      shippedByName: 'Abebe Kebede',
      items: [
        { id: 1, productId: 1, productName: 'Sugar 50kg', sku: 'SUG-50', quantity: 30 },
        { id: 2, productId: 3, productName: 'Magna Teff 25kg', sku: 'TEF-25', quantity: 20 },
      ]
    },
    {
      id: 2,
      transferNumber: 'TRF-2026-002',
      fromBranchId: 2,
      fromBranchName: 'Merkato Branch',
      toBranchId: 1,
      toBranchName: 'Bole Branch',
      status: 'REQUESTED',
      createdAt: '2026-10-18T11:00:00Z',
      requestedById: 3,
      requestedByName: 'Dawit Haile',
      items: [
        { id: 3, productId: 5, productName: 'B29 Laundry Bar Soap', sku: 'SOA-01', quantity: 50 },
      ]
    }
  ]

  const adjustments = [
    {
      id: 1,
      branchId: 1,
      branchName: 'Bole Branch',
      productId: 5,
      productName: 'B29 Laundry Bar Soap',
      quantityChange: -6,
      reason: 'DAMAGE',
      notes: 'Water leak in storage rack B',
      createdAt: '2026-10-16T15:20:00Z',
      createdById: 2,
      createdByName: 'Marta Alemu'
    },
    {
      id: 2,
      branchId: 1,
      branchName: 'Bole Branch',
      productId: 4,
      productName: 'Spaghetti Pasta 500g',
      quantityChange: 15,
      reason: 'RECOUNT',
      notes: 'Found unopened box behind shelf',
      createdAt: '2026-10-17T09:00:00Z',
      createdById: 3,
      createdByName: 'Dawit Haile'
    }
  ]

  const notifications = [
    {
      id: 1,
      branchId: 1,
      productId: 3,
      productName: 'Magna Teff 25kg',
      type: 'LOW_STOCK',
      currentStock: 8,
      minQuantity: 10,
      message: 'Stock for Magna Teff 25kg is at 8, below minimum level 10.',
      isRead: false,
      createdAt: '2026-10-18T09:10:00Z',
    },
    {
      id: 2,
      branchId: 1,
      productId: 5,
      productName: 'B29 Laundry Bar Soap',
      type: 'LOW_STOCK',
      currentStock: 4,
      minQuantity: 25,
      message: 'Stock for B29 Laundry Bar Soap is at 4, below minimum level 25.',
      isRead: false,
      createdAt: '2026-10-17T15:20:00Z',
    },
    {
      id: 3,
      branchId: 1,
      productId: 8,
      productName: 'A4 Printing Paper 80gsm',
      type: 'LOW_STOCK',
      currentStock: 3,
      minQuantity: 10,
      message: 'Stock for A4 Printing Paper 80gsm is at 3, below minimum level 10.',
      isRead: true,
      createdAt: '2026-10-16T16:00:00Z',
    }
  ]

  const movements = [
    { id: 1, date: '2026-10-10T08:00:00Z', branchId: 1, branchName: 'Bole Branch', productId: 1, productName: 'Sugar 50kg', type: 'OPENING_STOCK', quantityChange: 20, quantityAfter: 20, reason: 'OPENING_STOCK', user: 'Abebe Kebede' },
    { id: 2, date: '2026-10-14T11:00:00Z', branchId: 1, branchName: 'Bole Branch', productId: 2, productName: 'Sunflower Oil 5L', type: 'PURCHASE_RECEIPT', quantityChange: 30, quantityAfter: 48, reason: 'PO-2026-002', user: 'Dawit Haile' },
    { id: 3, date: '2026-10-16T15:20:00Z', branchId: 1, branchName: 'Bole Branch', productId: 5, productName: 'B29 Laundry Bar Soap', type: 'ADJUSTMENT', quantityChange: -6, quantityAfter: 4, reason: 'DAMAGE', user: 'Marta Alemu' },
    { id: 4, date: '2026-10-17T11:20:00Z', branchId: 1, branchName: 'Bole Branch', productId: 1, productName: 'Sugar 50kg', type: 'SALE', quantityChange: -2, quantityAfter: 18, reason: 'INV-2026-1039', user: 'Dawit Haile' },
    { id: 5, date: '2026-10-18T09:10:00Z', branchId: 1, branchName: 'Bole Branch', productId: 3, productName: 'Magna Teff 25kg', type: 'SALE', quantityChange: -1, quantityAfter: 8, reason: 'INV-2026-1040', user: 'Dawit Haile' },
  ]

  const auditLogs = [
    { id: 1, timestamp: '2026-10-18T09:10:00Z', user: 'Dawit Haile', action: 'SALE_COMPLETED', branch: 'Bole Branch', details: 'Completed sale INV-2026-1040 total 4,800.00 ETB' },
    { id: 2, timestamp: '2026-10-17T15:20:00Z', user: 'Marta Alemu', action: 'STOCK_ADJUSTMENT', branch: 'Bole Branch', details: 'Adjusted B29 Laundry Bar Soap by -6 (DAMAGE)' },
    { id: 3, timestamp: '2026-10-16T10:30:00Z', user: 'Abebe Kebede', action: 'TRANSFER_SHIPPED', branch: 'Hawassa Warehouse', details: 'Shipped transfer TRF-2026-001 to Bole Branch' },
    { id: 4, timestamp: '2026-10-15T08:35:00Z', user: 'Marta Alemu', action: 'PO_APPROVED', branch: 'Bole Branch', details: 'Approved purchase order PO-2026-001' },
    { id: 5, timestamp: '2026-10-14T09:00:00Z', user: 'Abebe Kebede', action: 'PRICE_CHANGED', branch: 'All', details: 'Changed Sugar 50kg selling price to 3,450.00 ETB' },
  ]

  return {
    settings,
    branches,
    users,
    categories,
    suppliers,
    products,
    branchStock,
    purchaseOrders,
    sales,
    returns,
    transfers,
    adjustments,
    notifications,
    movements,
    auditLogs
  }
}

function loadDb() {
  try {
    const raw = localStorage.getItem(STORAGE_DB_KEY)
    if (raw) return JSON.parse(raw)
  } catch (err) {
    console.error('Failed to load mock db from localStorage', err)
  }
  const db = getInitialDb()
  saveDb(db)
  return db
}

function saveDb(db) {
  try {
    localStorage.setItem(STORAGE_DB_KEY, JSON.stringify(db))
  } catch (err) {
    console.error('Failed to save mock db to localStorage', err)
  }
}

// Current logged in user from token
function getCurrentUser(db) {
  const token = tokenStore.get()
  if (!token) return null
  const username = token.replace('mock-', '')
  return db.users.find((u) => u.username === username) || null
}

export async function mockRequest(method, path, { body, params } = {}) {
  await delay()
  const db = loadDb()
  const currentUser = getCurrentUser(db)
  const syncLowStockNotification = (branchId, product, stock, timestamp, previousQuantity) => {
    if (!product || !stock) return
    let activeAlerts = db.notifications.filter((notification) => notification.type === 'LOW_STOCK'
      && Number(notification.branchId) === Number(branchId)
      && Number(notification.productId) === Number(product.id)
      && !notification.resolvedAt)
    if (Number(stock.minQuantity) <= 0) {
      activeAlerts.forEach((notification) => { notification.resolvedAt = timestamp })
      return
    }
    const crossedBelowMinimum = previousQuantity !== undefined
      && Number(previousQuantity) > Number(stock.minQuantity)
      && Number(stock.quantity) <= Number(stock.minQuantity)
    if (crossedBelowMinimum) {
      activeAlerts.forEach((notification) => { notification.resolvedAt = timestamp })
      activeAlerts = []
    }
    if (Number(stock.quantity) > Number(stock.minQuantity)) {
      activeAlerts.forEach((notification) => { notification.resolvedAt = timestamp })
      return
    }
    if (activeAlerts.length) {
      activeAlerts[0].currentStock = Number(stock.quantity)
      activeAlerts[0].quantity = Number(stock.quantity)
      return
    }
    const branch = db.branches.find((record) => Number(record.id) === Number(branchId))
    db.notifications.unshift({
      id: Date.now(), branchId: Number(branchId), branchName: branch?.name || '',
      productId: Number(product.id), productName: product.name, type: 'LOW_STOCK',
      currentStock: Number(stock.quantity), quantity: Number(stock.quantity),
      minQuantity: Number(stock.minQuantity), isRead: false, createdAt: timestamp,
    })
  }

  // ---------------- PRODUCT CSV IMPORT ----------------
  if (method === 'GET' && path === '/import/products/template') {
    if (!currentUser) fail(401, 'UNAUTHENTICATED', 'Not logged in')
    if (currentUser.role !== 'ADMIN') fail(403, 'FORBIDDEN', 'Admin role required')
    return 'sku,name,barcode,category,unit,costPrice,sellingPrice,openingQuantity\n'
  }
  if (method === 'POST' && path.startsWith('/import/products')) {
    if (!currentUser) fail(401, 'UNAUTHENTICATED', 'Not logged in')
    if (currentUser.role !== 'ADMIN') fail(403, 'FORBIDDEN', 'Admin role required')
    const dryRunParam = new URLSearchParams(path.split('?')[1] || '').get('dryRun')
    if (!['true', 'false'].includes(dryRunParam)) fail(400, 'VALIDATION_ERROR', 'dryRun is required')
    const file = body?.get?.('file')
    if (!file || typeof file.text !== 'function') fail(400, 'VALIDATION_ERROR', 'CSV file is required')
    const branchId = Number(body.get('branchId')) || null
    const text = await file.text()
    const parseRow = (line) => {
      const fields = []
      let value = ''
      let quoted = false
      for (let i = 0; i < line.length; i += 1) {
        const char = line[i]
        if (char === '"' && quoted && line[i + 1] === '"') { value += '"'; i += 1 }
        else if (char === '"') quoted = !quoted
        else if (char === ',' && !quoted) { fields.push(value); value = '' }
        else value += char
      }
      fields.push(value)
      return fields
    }
    const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => line.trim() !== '')
    if (lines.length < 2) fail(400, 'VALIDATION_ERROR', 'CSV has no product rows')
    const headers = parseRow(lines[0]).map((header) => header.trim())
    const seenSkus = new Set()
    const seenBarcodes = new Set()
    const rows = lines.slice(1).map((line, index) => {
      const values = parseRow(line)
      const data = Object.fromEntries(headers.map((header, i) => [header, values[i]?.trim() || '']))
      const errors = []
      const addError = (field, code) => errors.push({ field, code })
      const sku = data.sku || ''
      const barcode = data.barcode || ''
      const categoryText = (data.category || '').trim().toLowerCase()
      const activeCategories = db.categories.filter((item) => item.isActive !== false)
      const exactCategory = activeCategories.find((item) => item.name.trim().toLowerCase() === categoryText)
      const primaryNameMatches = activeCategories.filter((item) => item.name.split(/\s+\(/, 1)[0].trim().toLowerCase() === categoryText)
      const category = exactCategory || (primaryNameMatches.length === 1 ? primaryNameMatches[0] : null)
      const numbers = ['costPrice', 'sellingPrice', 'openingQuantity'].map((field) => Number(data[field] || 0))
      if (!sku) addError('sku', 'VALIDATION_ERROR')
      else if (db.products.some((product) => product.sku.toLowerCase() === sku.toLowerCase()) || seenSkus.has(sku.toLowerCase())) addError('sku', 'DUPLICATE_SKU')
      if (!data.name) addError('name', 'VALIDATION_ERROR')
      if (barcode && (db.products.some((product) => product.barcode === barcode) || seenBarcodes.has(barcode))) addError('barcode', 'DUPLICATE_BARCODE')
      if (!category) addError('category', 'NOT_FOUND')
      if (!data.unit) addError('unit', 'VALIDATION_ERROR')
      for (const [i, field] of ['costPrice', 'sellingPrice', 'openingQuantity'].entries()) {
        if (!Number.isFinite(numbers[i]) || numbers[i] < 0) addError(field, 'VALIDATION_ERROR')
      }
      if (numbers[2] > 0 && !branchId) addError('branchId', 'VALIDATION_ERROR')
      if (sku) seenSkus.add(sku.toLowerCase())
      if (barcode) seenBarcodes.add(barcode)
      return {
        row: index + 2,
        valid: errors.length === 0,
        data: { ...data, categoryId: category?.id || null, openingQuantity: numbers[2] },
        errors,
      }
    })
    const validRows = rows.filter((row) => row.valid)
    const invalidRows = rows.length - validRows.length
    if (dryRunParam === 'true') return { dryRun: true, totalRows: rows.length, validRows: validRows.length, invalidRows, rows }

    const skippedRows = rows.filter((row) => !row.valid).map(({ row, errors }) => ({ row, errors }))
    validRows.forEach(({ data }) => {
      const productId = Math.max(0, ...db.products.map((product) => product.id)) + 1
      const product = {
        id: productId, name: data.name, sku: data.sku, barcode: data.barcode || null,
        categoryId: data.categoryId, categoryName: db.categories.find((category) => category.id === data.categoryId)?.name,
        unit: data.unit, costPrice: Number(data.costPrice), sellingPrice: Number(data.sellingPrice), isActive: true,
      }
      db.products.push(product)
      db.branches.forEach((branch) => db.branchStock.push({ branchId: branch.id, productId, quantity: 0, minQuantity: 0, maxQuantity: null }))
      if (data.openingQuantity > 0) {
        const stock = db.branchStock.find((row) => row.branchId === branchId && row.productId === productId)
        stock.quantity = data.openingQuantity
        db.movements.unshift({
          id: Date.now() + productId, date: new Date().toISOString(), branchId, branchName: db.branches.find((row) => row.id === branchId)?.name,
          productId, productName: product.name, type: 'OPENING_STOCK', quantityChange: data.openingQuantity,
          quantityAfter: data.openingQuantity, reason: 'CSV_IMPORT', user: currentUser.fullName,
        })
      }
    })
    db.auditLogs.unshift({ id: Date.now(), timestamp: new Date().toISOString(), user: currentUser.fullName, action: 'IMPORT_CONFIRMED', branch: branchId ? db.branches.find((item) => item.id === branchId)?.name : 'All', details: `Imported ${validRows.length} products; skipped ${invalidRows}` })
    saveDb(db)
    return { dryRun: false, imported: validRows.length, skipped: invalidRows, skippedRows }
  }

  // ---------------- AUTH ----------------
  if (method === 'POST' && path === '/auth/login') {
    const username = body?.username?.trim()?.toLowerCase()
    const password = body?.password
    const user = db.users.find((u) => u.username.toLowerCase() === username && u.isActive)
    if (!user || !password) fail(401, 'INVALID_CREDENTIALS', 'Wrong username or password')
    return {
      token: `mock-${user.username}`,
      expiresAt: new Date(Date.now() + 8 * 3600 * 1000).toISOString(),
      user,
    }
  }

  if (method === 'GET' && path === '/auth/me') {
    if (!currentUser) fail(401, 'UNAUTHENTICATED', 'Not logged in')
    if (!currentUser.isActive) fail(403, 'ACCOUNT_DISABLED', 'This account has been deactivated')
    return currentUser
  }

  if (method === 'POST' && path === '/auth/change-password') {
    if (!body?.currentPassword || !body?.newPassword) fail(400, 'VALIDATION_ERROR', 'All fields required')
    return { success: true }
  }

  if (method === 'POST' && path === '/auth/logout') {
    return { success: true }
  }

  if (tokenStore.get() && currentUser && !currentUser.isActive) {
    fail(403, 'ACCOUNT_DISABLED', 'This account has been deactivated')
  }

  if (method === 'PATCH' && path === '/auth/profile') {
    if (!currentUser) fail(401, 'UNAUTHENTICATED', 'Not logged in')
    const idx = db.users.findIndex((u) => u.id === currentUser.id)
    if (idx !== -1) {
      db.users[idx] = {
        ...db.users[idx],
        ...body,
      }
      saveDb(db)
      return db.users[idx]
    }
    return currentUser
  }

  // ---------------- DASHBOARD ----------------
  if (method === 'GET' && path === '/dashboard/stats') {
    const branchId = params?.branchId ? Number(params.branchId) : (currentUser.branchId || null)
    
    // Calculate stock value
    let totalStockVal = 0
    let lowStockCount = 0
    db.products.forEach((p) => {
      const stocks = db.branchStock.filter((s) => s.productId === p.id && (!branchId || s.branchId === branchId))
      stocks.forEach((s) => {
        totalStockVal += (s.quantity * p.costPrice)
        if (s.minQuantity > 0 && s.quantity <= s.minQuantity) {
          lowStockCount++
        }
      })
    })

    // Calculate today's sales
    const todaySales = db.sales
      .filter((s) => !branchId || s.branchId === branchId)
      .reduce((sum, s) => sum + s.total, 0)

    // Calculate pending refunds
    const pendingRefunds = db.returns
      .filter((r) => r.refundStatus === 'PENDING_REFUND' && (!branchId || r.branchId === branchId))
      .reduce((sum, r) => sum + r.refundAmount, 0)

    // Transfers in transit
    const inTransit = db.transfers
      .filter((t) => t.status === 'SHIPPED' && (!branchId || t.toBranchId === branchId || t.fromBranchId === branchId))
      .length

    return {
      totalStockValue: totalStockVal,
      todaySales,
      pendingRefunds,
      lowStockCount,
      inTransitCount: inTransit,
      salesTrend: [
        { month: 'May (ግንቦት)', sales: 340000 },
        { month: 'Jun (ሰኔ)', sales: 420000 },
        { month: 'Jul (ሐምሌ)', sales: 390000 },
        { month: 'Aug (ነሐሴ)', sales: 510000 },
        { month: 'Sep (መስከረም)', sales: 640000 },
        { month: 'Oct (ጥቅምት)', sales: 780000 },
      ],
      salesByBranch: [
        { name: 'Bole Branch', value: 480000, color: '#3b82f6' },
        { name: 'Merkato Branch', value: 520000, color: '#10b981' },
        { name: 'Hawassa Warehouse', value: 284560, color: '#f59e0b' },
      ],
    }
  }

  // ---------------- PRODUCTS ----------------
  if (method === 'GET' && path === '/stock') {
    if (!currentUser) fail(401, 'UNAUTHENTICATED', 'Not logged in')
    const requestedBranch = params?.branchId ? Number(params.branchId) : null
    if (['BRANCH_MANAGER', 'STAFF'].includes(currentUser.role) && requestedBranch && requestedBranch !== currentUser.branchId) {
      fail(403, 'FORBIDDEN', 'Branch access is not allowed')
    }
    const branchId = ['BRANCH_MANAGER', 'STAFF'].includes(currentUser.role) ? currentUser.branchId : requestedBranch
    const productId = params?.productId ? Number(params.productId) : null
    const categoryId = params?.categoryId ? Number(params.categoryId) : null
    const q = String(params?.q ?? '').toLowerCase()
    let rows = db.branchStock.filter((stock) => (!branchId || stock.branchId === branchId) && (!productId || stock.productId === productId))
      .map((stock) => {
        const product = db.products.find((item) => item.id === stock.productId)
        const branch = db.branches.find((item) => item.id === stock.branchId)
        return {
          branchId: stock.branchId, branchName: branch?.name || '', productId: stock.productId,
          productName: product?.name || '', sku: product?.sku || '', categoryName: product?.categoryName || '', unit: product?.unit || '',
          quantity: stock.quantity, minQuantity: stock.minQuantity, maxQuantity: stock.maxQuantity,
          costPrice: product?.costPrice, stockValue: Number((stock.quantity * (product?.costPrice || 0)).toFixed(2)),
        }
      }).filter((row) => (!categoryId || db.products.find((item) => item.id === row.productId)?.categoryId === categoryId)
        && (!q || [row.productName, row.sku, row.categoryName, db.products.find((item) => item.id === row.productId)?.barcode].some((value) => value?.toLowerCase().includes(q)))
        && (!params?.lowOnly || (row.minQuantity > 0 && row.quantity <= row.minQuantity)))
    if (currentUser.role === 'STAFF') rows = rows.map(({ costPrice, stockValue, ...row }) => row)
    const page = Number(params?.page) || 1
    const limit = Number(params?.limit) || 20
    const total = rows.length
    return { data: rows.slice((page - 1) * limit, page * limit), page, limit, total }
  }

  if (method === 'GET' && path === '/stock/consolidated') {
    if (!currentUser) fail(401, 'UNAUTHENTICATED', 'Not logged in')
    if (!['ADMIN', 'AUDITOR'].includes(currentUser.role)) fail(403, 'FORBIDDEN', 'Consolidated stock is not available for this role')
    const categoryId = params?.categoryId ? Number(params.categoryId) : null
    const q = String(params?.q ?? '').toLowerCase()
    let rows = db.products
      .filter((product) => !categoryId || product.categoryId === categoryId)
      .map((product) => {
        const branches = db.branchStock.filter((stock) => stock.productId === product.id && db.branches.some((branch) => branch.id === stock.branchId && branch.isActive !== false))
          .map((stock) => ({ branchId: stock.branchId, branchName: db.branches.find((branch) => branch.id === stock.branchId)?.name || '', quantity: stock.quantity }))
        return { productId: product.id, productName: product.name, sku: product.sku, totalQuantity: branches.reduce((sum, branch) => sum + branch.quantity, 0), branches }
      }).filter((row) => !q || [row.productName, row.sku].some((value) => value?.toLowerCase().includes(q)))
    const page = Number(params?.page) || 1
    const limit = Number(params?.limit) || 20
    const total = rows.length
    rows = rows.slice((page - 1) * limit, page * limit)
    return { data: rows, page, limit, total }
  }

  const thresholdMatch = path.match(/^\/stock\/(\d+)\/(\d+)\/thresholds$/)
  if (method === 'PUT' && thresholdMatch) {
    if (!currentUser) fail(401, 'UNAUTHENTICATED', 'Not logged in')
    const branchId = Number(thresholdMatch[1])
    const productId = Number(thresholdMatch[2])
    if (!['ADMIN', 'BRANCH_MANAGER'].includes(currentUser.role)) fail(403, 'FORBIDDEN', 'You cannot change stock thresholds')
    if (currentUser.role === 'BRANCH_MANAGER' && currentUser.branchId !== branchId) fail(403, 'FORBIDDEN', 'Branch access is not allowed')
    const stock = db.branchStock.find((row) => row.branchId === branchId && row.productId === productId)
    if (!stock) fail(404, 'NOT_FOUND', 'Stock row not found')
    const minimum = Number(body?.minQuantity)
    const maximum = body?.maxQuantity == null || body.maxQuantity === '' ? null : Number(body.maxQuantity)
    if (!Number.isFinite(minimum) || minimum < 0 || Number(minimum.toFixed(2)) !== minimum || (maximum !== null && (!Number.isFinite(maximum) || maximum < minimum || Number(maximum.toFixed(2)) !== maximum))) {
      fail(400, 'VALIDATION_ERROR', 'Maximum quantity must be at least the minimum quantity')
    }
    stock.minQuantity = minimum
    stock.maxQuantity = maximum
    saveDb(db)
    return { ...stock }
  }

  if (method === 'GET' && path === '/stock-movements') {
    if (!currentUser) fail(401, 'UNAUTHENTICATED', 'Not logged in')
    const requestedBranch = params?.branchId ? Number(params.branchId) : null
    if (['BRANCH_MANAGER', 'STAFF'].includes(currentUser.role) && requestedBranch && requestedBranch !== currentUser.branchId) {
      fail(403, 'FORBIDDEN', 'Branch access is not allowed')
    }
    const branchId = ['BRANCH_MANAGER', 'STAFF'].includes(currentUser.role) ? currentUser.branchId : requestedBranch
    const q = String(params?.q ?? '').toLowerCase()
    const productId = params?.productId ? Number(params.productId) : null
    let rows = db.movements.filter((movement) => !branchId || movement.branchId === branchId)
      .map((movement) => ({
        ...movement,
        createdAt: movement.createdAt || movement.date,
        createdBy: movement.createdBy || { name: movement.user || '' },
        referenceType: movement.referenceType || '',
        referenceId: movement.referenceId || null,
      })).filter((movement) => !productId || movement.productId === productId)
    if (q) rows = rows.filter((movement) => [movement.productName, movement.branchName, movement.type, movement.reason, movement.user]
      .some((value) => value?.toLowerCase().includes(q)))
    const type = params?.type
    if (type) rows = rows.filter((movement) => movement.type === type)
    const page = Number(params?.page) || 1
    const limit = Number(params?.limit) || 20
    rows.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    const total = rows.length
    return { data: rows.slice((page - 1) * limit, page * limit), page, limit, total }
  }

  if (method === 'GET' && path === '/products') {
    if (!currentUser) fail(401, 'UNAUTHENTICATED', 'Not logged in')
    const q = String(params?.q ?? '').toLowerCase()
    const categoryId = params?.categoryId ? Number(params.categoryId) : null
    const requestedBranch = params?.branchId ? Number(params.branchId) : null
    if (['BRANCH_MANAGER', 'STAFF'].includes(currentUser.role) && requestedBranch && requestedBranch !== currentUser.branchId) {
      fail(403, 'FORBIDDEN', 'Branch access is not allowed')
    }
    const branchId = ['BRANCH_MANAGER', 'STAFF'].includes(currentUser.role) ? currentUser.branchId : requestedBranch
    const page = Number(params?.page) || 1
    const limit = Number(params?.limit) || 20

    let rows = db.products.filter((p) => params?.includeInactive || p.isActive !== false).map((p) => {
      const branchRows = db.branchStock.filter((s) => s.productId === p.id)
      const targetStock = branchId ? branchRows.find((s) => s.branchId === branchId) : null
      const totalQty = branchRows.reduce((sum, s) => sum + s.quantity, 0)
      const currentQty = targetStock ? targetStock.quantity : totalQty
      const minQty = targetStock ? targetStock.minQuantity : 0

      return {
        ...p,
        ...(branchId ? { quantity: currentQty, minQuantity: minQty } : {}),
        isLowStock: minQty > 0 && currentQty <= minQty
      }
    })

    if (q) {
      rows = rows.filter((x) =>
        [x.name, x.sku, x.barcode || '', x.categoryName].some((v) => v.toLowerCase().includes(q))
      )
    }
    if (categoryId) {
      rows = rows.filter((x) => x.categoryId === categoryId)
    }

    // Role N7: Hide costPrice for staff
    if (currentUser.role === 'STAFF') {
      rows = rows.map(({ costPrice, ...rest }) => rest)
    }

    const total = rows.length
    return { data: rows.slice((page - 1) * limit, page * limit), page, limit, total }
  }

  const byBarcode = path.match(/^\/products\/by-barcode\/(.+)$/)
  if (method === 'GET' && byBarcode) {
    if (!currentUser) fail(401, 'UNAUTHENTICATED', 'Not logged in')
    const code = decodeURIComponent(byBarcode[1])
    const p = db.products.find((x) => x.isActive !== false && (x.barcode === code || x.sku.toLowerCase() === code.toLowerCase()))
    if (!p) fail(404, 'PRODUCT_NOT_FOUND', 'No product found with this barcode')
    const requestedBranchId = params?.branchId ? Number(params.branchId) : null
    if (['BRANCH_MANAGER', 'STAFF'].includes(currentUser.role) && requestedBranchId && requestedBranchId !== currentUser.branchId) fail(403, 'FORBIDDEN', 'Branch access is not allowed')
    const branchId = currentUser.role === 'ADMIN' ? requestedBranchId : currentUser.branchId
    if (!branchId) fail(400, 'VALIDATION_ERROR', 'Branch is required')
    const stock = db.branchStock.find((s) => s.productId === p.id && s.branchId === branchId)
    return {
      ...p,
      quantity: stock ? stock.quantity : 0,
      minQuantity: stock ? stock.minQuantity : 0,
    }
  }

  if (method === 'POST' && path === '/products') {
    if (!currentUser) fail(401, 'UNAUTHENTICATED', 'Not logged in')
    if (currentUser.role !== 'ADMIN') fail(403, 'FORBIDDEN', 'Admin role required')
    if (!body?.name?.trim() || !body?.sku?.trim() || !body?.categoryId || !body?.unit?.trim()
      || body.costPrice === undefined || body.sellingPrice === undefined
      || !Number.isFinite(Number(body.costPrice)) || Number(body.costPrice) < 0
      || !Number.isFinite(Number(body.sellingPrice)) || Number(body.sellingPrice) < 0) {
      fail(400, 'VALIDATION_ERROR', 'Product fields are missing or invalid')
    }
    if (db.products.some((x) => x.sku.toLowerCase() === body.sku.toLowerCase())) {
      fail(409, 'DUPLICATE_SKU', 'SKU already exists')
    }
    if (body.barcode && db.products.some((x) => x.barcode === body.barcode)) {
      fail(409, 'DUPLICATE_BARCODE', 'Barcode already exists')
    }

    const cat = db.categories.find(c => c.id === Number(body.categoryId) && c.isActive !== false)
    if (!cat) fail(404, 'NOT_FOUND', 'Category not found')
    const newId = db.products.length ? Math.max(...db.products.map(p => p.id)) + 1 : 1
    const newProd = {
      id: newId,
      name: body.name.trim(),
      sku: body.sku.trim(),
      barcode: body.barcode || null,
      categoryId: Number(body.categoryId),
      categoryName: cat.name,
      unit: body.unit.trim(),
      costPrice: Number(body.costPrice),
      sellingPrice: Number(body.sellingPrice),
      isActive: true,
    }

    db.products.push(newProd)

    // Product creation initializes zero stock; stock is changed only through movements.
    db.branches.forEach(b => {
      db.branchStock.push({
        branchId: b.id,
        productId: newId,
        quantity: 0,
        minQuantity: 0,
        maxQuantity: null,
      })
    })

    db.auditLogs.unshift({
      id: Date.now(),
      timestamp: new Date().toISOString(),
      user: currentUser.fullName,
      action: 'PRODUCT_CREATED',
      branch: 'All',
      details: `Created product ${newProd.name} (${newProd.sku})`
    })

    saveDb(db)
    return newProd
  }

  const productIdMatch = path.match(/^\/products\/(\d+)$/)
  if (productIdMatch && method === 'GET') {
    if (!currentUser) fail(401, 'UNAUTHENTICATED', 'Not logged in')
    const product = db.products.find((item) => item.id === Number(productIdMatch[1]))
    if (!product || (product.isActive === false && !params?.includeInactive)) fail(404, 'NOT_FOUND', 'Product not found')
    if (currentUser.role === 'STAFF') {
      const { costPrice, ...staffProduct } = product
      return staffProduct
    }
    return product
  }
  if (productIdMatch && method === 'PATCH') {
    if (!currentUser) fail(401, 'UNAUTHENTICATED', 'Not logged in')
    if (currentUser.role !== 'ADMIN') fail(403, 'FORBIDDEN', 'Admin role required')
    const product = db.products.find((item) => item.id === Number(productIdMatch[1]))
    if (!product) fail(404, 'NOT_FOUND', 'Product not found')
    if (body?.name !== undefined && !body.name.trim()) fail(400, 'VALIDATION_ERROR', 'Product name is required')
    if (body?.sku !== undefined && db.products.some((item) => item.id !== product.id && item.sku.toLowerCase() === body.sku.trim().toLowerCase())) fail(409, 'DUPLICATE_SKU', 'SKU already exists')
    if (body?.barcode && db.products.some((item) => item.id !== product.id && item.barcode === body.barcode)) fail(409, 'DUPLICATE_BARCODE', 'Barcode already exists')
    if (body?.categoryId !== undefined) {
      const category = db.categories.find((item) => item.id === Number(body.categoryId) && item.isActive !== false)
      if (!category) fail(404, 'NOT_FOUND', 'Category not found')
      product.categoryName = category.name
      product.categoryId = category.id
    }
    Object.assign(product, body, body?.name !== undefined ? { name: body.name.trim() } : {}, body?.sku !== undefined ? { sku: body.sku.trim() } : {})
    saveDb(db)
    return product
  }

  // ---------------- SALES & POS ----------------
  if (method === 'GET' && path === '/sales') {
    if (!currentUser) fail(401, 'UNAUTHENTICATED', 'Not logged in')
    if (!['ADMIN', 'BRANCH_MANAGER', 'STAFF'].includes(currentUser.role)) fail(403, 'FORBIDDEN', 'Sales access is not allowed')
    const requestedBranchId = params?.branchId ? Number(params.branchId) : null
    if (['BRANCH_MANAGER', 'STAFF'].includes(currentUser.role) && requestedBranchId && requestedBranchId !== currentUser.branchId) fail(403, 'FORBIDDEN', 'Branch access is not allowed')
    const branchId = ['BRANCH_MANAGER', 'STAFF'].includes(currentUser.role) ? currentUser.branchId : requestedBranchId
    const page = Number(params?.page) || 1
    const limit = Number(params?.limit) || 20
    const invoiceQuery = String(params?.invoiceNumber || '').trim().toLowerCase()
    const filtered = db.sales.filter((sale) => {
      if (branchId && sale.branchId !== branchId) return false
      if (invoiceQuery && !sale.invoiceNumber?.toLowerCase().includes(invoiceQuery)) return false
      if (params?.createdBy && Number(sale.createdBy?.id ?? sale.createdById) !== Number(params.createdBy)) return false
      if (params?.from || params?.to) {
        const dateParts = new Intl.DateTimeFormat('en-CA', {
          timeZone: 'Africa/Addis_Ababa', year: 'numeric', month: '2-digit', day: '2-digit',
        }).formatToParts(new Date(sale.createdAt))
        const ethiopiaDate = `${dateParts.find((part) => part.type === 'year')?.value}-${dateParts.find((part) => part.type === 'month')?.value}-${dateParts.find((part) => part.type === 'day')?.value}`
        if (params.from && ethiopiaDate < params.from) return false
        if (params.to && ethiopiaDate > params.to) return false
      }
      return true
    })
    const rows = filtered.map(({ items = [], ...sale }) => ({ ...sale, itemCount: sale.itemCount ?? items.length }))
    return { data: rows.slice((page - 1) * limit, page * limit), page, limit, total: filtered.length }
  }

  const saleDetailMatch = path.match(/^\/sales\/(\d+)$/)
  if (method === 'GET' && saleDetailMatch) {
    if (!currentUser) fail(401, 'UNAUTHENTICATED', 'Not logged in')
    if (!['ADMIN', 'BRANCH_MANAGER', 'STAFF'].includes(currentUser.role)) fail(403, 'FORBIDDEN', 'Sales access is not allowed')
    const sale = db.sales.find((record) => record.id === Number(saleDetailMatch[1]))
    if (!sale) fail(404, 'NOT_FOUND', 'Sale not found')
    if (['BRANCH_MANAGER', 'STAFF'].includes(currentUser.role) && sale.branchId !== currentUser.branchId) fail(403, 'FORBIDDEN', 'Branch access is not allowed')
    return {
      ...sale,
      createdBy: sale.createdBy || { id: sale.createdById, name: sale.createdByName },
      netAmount: sale.netAmount ?? sale.subtotal,
      taxType: sale.taxType || db.settings.taxType,
      taxRate: sale.taxRate ?? Number((db.settings.taxRate * 100).toFixed(2)),
      taxAmount: sale.taxAmount ?? sale.tax,
      items: (sale.items || []).map((item) => ({
        ...item,
        lineTotal: item.lineTotal ?? item.total,
        returnedQuantity: db.returns
          .filter((returnRecord) => returnRecord.saleId === sale.id)
          .flatMap((returnRecord) => returnRecord.items || [])
          .filter((returnItem) => returnItem.productId === item.productId)
          .reduce((total, returnItem) => total + Number(returnItem.quantity || 0), 0),
      })),
      company: {
        companyName: db.settings.companyName,
        address: db.settings.address,
        tin: db.settings.tin,
      },
    }
  }

  if (method === 'POST' && path === '/sales') {
    if (!currentUser) fail(401, 'UNAUTHENTICATED', 'Not logged in')
    if (!['ADMIN', 'BRANCH_MANAGER', 'STAFF'].includes(currentUser.role)) fail(403, 'FORBIDDEN', 'Sales are not allowed')
    if (typeof body?.customerName === 'string' && body.customerName.length > 100) fail(400, 'VALIDATION_ERROR', 'Customer name is too long')
    if (!Array.isArray(body?.items) || body.items.length === 0) fail(400, 'VALIDATION_ERROR', 'Sale must have at least one item')
    const requestedBranchId = body.branchId ? Number(body.branchId) : null
    if (currentUser.role === 'ADMIN' && !requestedBranchId) fail(400, 'VALIDATION_ERROR', 'Branch is required')
    if (['BRANCH_MANAGER', 'STAFF'].includes(currentUser.role) && requestedBranchId && requestedBranchId !== currentUser.branchId) fail(403, 'FORBIDDEN', 'Branch access is not allowed')
    const branchId = currentUser.role === 'ADMIN' ? requestedBranchId : currentUser.branchId
    const branch = db.branches.find((record) => record.id === branchId && record.isActive !== false)
    if (!branch) fail(404, 'NOT_FOUND', 'Branch not found')
    const productIds = body.items.map((item) => Number(item.productId))
    if (new Set(productIds).size !== productIds.length) fail(400, 'VALIDATION_ERROR', 'A product may only appear once')

    const lines = body.items.map((item, index) => {
      const product = db.products.find((record) => record.id === Number(item.productId))
      if (!product) fail(404, 'NOT_FOUND', 'Product not found')
      if (product.isActive === false) fail(400, 'VALIDATION_ERROR', 'Inactive products cannot be sold')
      const quantity = Number(item.quantity)
      if (!Number.isFinite(quantity) || quantity <= 0 || !/^\d+(\.\d{1,2})?$/.test(String(item.quantity))) fail(400, 'VALIDATION_ERROR', 'Quantity must be positive with up to two decimals')
      const stock = db.branchStock.find((row) => row.branchId === branchId && row.productId === product.id)
      return { index, product, quantity, stock, available: stock?.quantity || 0 }
    })
    const shortLines = lines.filter((line) => line.available < line.quantity)
    if (shortLines.length) fail(422, 'INSUFFICIENT_STOCK', 'Not enough stock', shortLines.map((line) => ({ field: `items[${line.index}].quantity`, productId: line.product.id, available: line.available, requested: line.quantity })))

    const now = new Date().toISOString()
    const nextNumber = db.settings.nextInvoiceNumber
    const invoiceNumber = `INV-${String(nextNumber).padStart(6, '0')}`
    let total = 0
    const saleItems = lines.map(({ product, quantity }, index) => {
      const unitPrice = Number(product.sellingPrice)
      const lineTotal = Math.round(unitPrice * quantity * 100) / 100
      total += lineTotal
      return { id: index + 1, productId: product.id, productName: product.name, quantity, unitPrice, lineTotal, returnedQuantity: 0 }
    })
    total = Math.round(total * 100) / 100
    const taxRate = Number((db.settings.taxRate * 100).toFixed(2))
    const taxAmount = Math.round(total * taxRate / (100 + taxRate) * 100) / 100
    const netAmount = Math.round((total - taxAmount) * 100) / 100
    const saleRecord = {
      id: db.sales.length ? Math.max(...db.sales.map((sale) => sale.id)) + 1 : 1,
      invoiceNumber,
      branchId,
      branchName: branch.name,
      customerName: body.customerName?.trim() || null,
      createdBy: { id: currentUser.id, name: currentUser.fullName },
      items: saleItems,
      netAmount,
      taxType: db.settings.taxType,
      taxRate,
      taxAmount,
      total,
      createdAt: now,
    }

    lines.forEach(({ product, quantity, stock }, index) => {
      const previousQuantity = Number(stock.quantity)
      stock.quantity -= quantity
      db.movements.unshift({
        id: Date.now() + index,
        date: now,
        branchId,
        branchName: branch.name,
        productId: product.id,
        productName: product.name,
        type: 'SALE',
        quantityChange: -quantity,
        quantityAfter: stock.quantity,
        reason: invoiceNumber,
        user: currentUser.fullName,
      })
      syncLowStockNotification(branchId, product, stock, now, previousQuantity)
    })

    db.settings.nextInvoiceNumber += 1
    db.sales.unshift(saleRecord)
    db.auditLogs.unshift({ id: Date.now() + 50, timestamp: now, user: currentUser.fullName, action: 'SALE_CREATED', branch: branch.name, details: `Created sale ${invoiceNumber} total ${total} ETB` })
    saveDb(db)
    return saleRecord
  }

  // ---------------- RETURNS ----------------
  if (method === 'GET' && path === '/returns') {
    if (!currentUser) fail(401, 'UNAUTHENTICATED', 'Not logged in')
    if (!['ADMIN', 'BRANCH_MANAGER', 'STAFF'].includes(currentUser.role)) fail(403, 'FORBIDDEN', 'Returns access is not allowed')
    const requestedBranchId = params?.branchId ? Number(params.branchId) : null
    if (['BRANCH_MANAGER', 'STAFF'].includes(currentUser.role) && requestedBranchId && requestedBranchId !== currentUser.branchId) {
      fail(403, 'FORBIDDEN', 'Branch access is not allowed')
    }
    const branchId = ['BRANCH_MANAGER', 'STAFF'].includes(currentUser.role) ? currentUser.branchId : requestedBranchId
    if (params?.refundStatus && !['PENDING_REFUND', 'REFUNDED'].includes(params.refundStatus)) fail(400, 'VALIDATION_ERROR', 'Invalid refund status')
    const page = Number(params?.page) || 1
    const limit = Number(params?.limit) || 20
    if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1 || limit > 100) fail(400, 'VALIDATION_ERROR', 'Invalid pagination')
    const filtered = db.returns.filter((record) => {
      if (branchId && Number(record.branchId) !== branchId) return false
      if (params?.saleId && Number(record.saleId) !== Number(params.saleId)) return false
      if (params?.refundStatus && record.refundStatus !== params.refundStatus) return false
      if (params?.from || params?.to) {
        const parts = new Intl.DateTimeFormat('en-CA', {
          timeZone: 'Africa/Addis_Ababa', year: 'numeric', month: '2-digit', day: '2-digit',
        }).formatToParts(new Date(record.createdAt))
        const returnDate = `${parts.find((part) => part.type === 'year')?.value}-${parts.find((part) => part.type === 'month')?.value}-${parts.find((part) => part.type === 'day')?.value}`
        if (params.from && returnDate < params.from) return false
        if (params.to && returnDate > params.to) return false
      }
      return true
    }).sort((first, second) => new Date(second.createdAt) - new Date(first.createdAt))
    return { data: filtered.slice((page - 1) * limit, page * limit), page, limit, total: filtered.length }
  }

  const saleReturnMatch = path.match(/^\/sales\/(\d+)\/returns$/)
  if (method === 'POST' && saleReturnMatch) {
    if (!currentUser) fail(401, 'UNAUTHENTICATED', 'Not logged in')
    if (!['ADMIN', 'BRANCH_MANAGER', 'STAFF'].includes(currentUser.role)) fail(403, 'FORBIDDEN', 'Sales returns are not allowed')
    const sale = db.sales.find((record) => record.id === Number(saleReturnMatch[1]))
    if (!sale) fail(404, 'NOT_FOUND', 'Invoice not found')
    if (['BRANCH_MANAGER', 'STAFF'].includes(currentUser.role) && sale.branchId !== currentUser.branchId) fail(403, 'FORBIDDEN', 'Branch access is not allowed')
    if (!Array.isArray(body?.items) || body.items.length === 0) fail(400, 'VALIDATION_ERROR', 'At least one return item is required')
    if (body.reason !== undefined && (typeof body.reason !== 'string' || body.reason.length > 300)) fail(400, 'VALIDATION_ERROR', 'Return reason is invalid')
    const productIds = body.items.map((item) => Number(item.productId))
    if (new Set(productIds).size !== productIds.length) fail(400, 'VALIDATION_ERROR', 'A product may only appear once')

    const lines = body.items.map((item, index) => {
      const saleItem = sale.items.find((record) => record.productId === Number(item.productId))
      const quantity = Number(item.quantity)
      if (!saleItem || !Number.isFinite(quantity) || quantity <= 0 || !/^\d+(\.\d{1,2})?$/.test(String(item.quantity))) {
        fail(400, 'VALIDATION_ERROR', 'Return item is invalid', [{ field: `items[${index}]` }])
      }
      const alreadyReturned = db.returns
        .filter((returnRecord) => returnRecord.saleId === sale.id)
        .flatMap((returnRecord) => returnRecord.items || [])
        .filter((returnItem) => returnItem.productId === saleItem.productId)
        .reduce((total, returnItem) => total + Number(returnItem.quantity || 0), 0)
      const returnable = Math.max(0, Number(saleItem.quantity) - alreadyReturned)
      return { index, saleItem, quantity, returnable }
    })
    const overLimit = lines.filter((line) => line.quantity > line.returnable)
    if (overLimit.length) {
      fail(422, 'RETURN_EXCEEDS_SOLD', 'Return quantity is above the remaining returnable quantity', overLimit.map((line) => ({
        field: `items[${line.index}].quantity`, saleItemId: line.saleItem.id, returnable: line.returnable, requested: line.quantity,
      })))
    }
    const branchId = sale.branchId
    const stockRows = lines.map((line) => {
      const stock = db.branchStock.find((record) => record.branchId === branchId && record.productId === line.saleItem.productId)
      if (!stock) fail(404, 'NOT_FOUND', 'Branch stock record not found')
      return { ...line, stock }
    })

    const id = db.returns.length ? Math.max(...db.returns.map((record) => record.id)) + 1 : 1
    const now = new Date().toISOString()
    const returnNumber = `RET-${new Date().getFullYear()}-${String(id).padStart(6, '0')}`
    const returnItems = stockRows.map(({ saleItem, quantity }, index) => ({
      id: index + 1, saleItemId: saleItem.id, productId: saleItem.productId,
      productName: saleItem.productName, quantity, unitPrice: Number(saleItem.unitPrice),
      lineTotal: Number((quantity * Number(saleItem.unitPrice)).toFixed(2)),
    }))
    const refundAmount = Number(returnItems.reduce((total, item) => total + item.lineTotal, 0).toFixed(2))
    const returnRec = {
      id, returnNumber, saleId: sale.id, invoiceNumber: sale.invoiceNumber, branchId,
      branchName: sale.branchName, refundAmount, refundStatus: 'PENDING_REFUND',
      ...(body.reason?.trim() ? { reason: body.reason.trim() } : {}), createdAt: now,
      createdBy: { id: currentUser.id, name: currentUser.fullName }, items: returnItems,
    }

    stockRows.forEach(({ saleItem, quantity, stock }, index) => {
      stock.quantity += quantity
      syncLowStockNotification(branchId, db.products.find((product) => Number(product.id) === Number(saleItem.productId)), stock, now)
      db.movements.unshift({
        id: Date.now() + index, date: now, branchId, branchName: sale.branchName,
        productId: saleItem.productId, productName: saleItem.productName,
        type: 'CUSTOMER_RETURN', quantityChange: quantity, quantityAfter: stock.quantity,
        referenceType: 'RETURN', referenceId: id, reason: `Return for ${sale.invoiceNumber}`,
        user: currentUser.fullName,
      })
    })
    db.returns.unshift(returnRec)
    db.auditLogs.unshift({ id: Date.now() + 100, timestamp: now, user: currentUser.fullName, action: 'RETURN_CREATED', branch: sale.branchName, details: `Created return ${returnNumber} for ${sale.invoiceNumber}` })
    saveDb(db)
    return returnRec
  }

  const refundMatch = path.match(/^\/returns\/(\d+)\/refund$/)
  if (method === 'PATCH' && refundMatch) {
    if (!currentUser) fail(401, 'UNAUTHENTICATED', 'Not logged in')
    if (!['ADMIN', 'BRANCH_MANAGER', 'STAFF'].includes(currentUser.role)) fail(403, 'FORBIDDEN', 'Refund updates are not allowed')
    const id = Number(refundMatch[1])
    const ret = db.returns.find(r => r.id === id)
    if (!ret) fail(404, 'NOT_FOUND', 'Return record not found')
    if (['BRANCH_MANAGER', 'STAFF'].includes(currentUser.role) && ret.branchId !== currentUser.branchId) fail(403, 'FORBIDDEN', 'Branch access is not allowed')
    if (ret.refundStatus === 'REFUNDED') fail(409, 'INVALID_STATUS', 'This return has already been refunded')
    ret.refundStatus = 'REFUNDED'
    ret.refundedAt = new Date().toISOString()
    ret.refundedBy = { id: currentUser.id, name: currentUser.fullName }
    db.auditLogs.unshift({ id: Date.now(), timestamp: ret.refundedAt, user: currentUser.fullName, action: 'RETURN_REFUNDED', branch: ret.branchName, details: `Marked return ${ret.returnNumber} as refunded` })
    saveDb(db)
    return ret
  }

  // ---------------- PURCHASE ORDERS ----------------
  if (method === 'GET' && path === '/purchase-orders') {
    if (!currentUser) fail(401, 'UNAUTHENTICATED', 'Not logged in')
    if (!['ADMIN', 'BRANCH_MANAGER', 'STAFF'].includes(currentUser.role)) fail(403, 'FORBIDDEN', 'Purchase order access is not allowed')
    const requestedBranchId = params?.branchId ? Number(params.branchId) : null
    if (['BRANCH_MANAGER', 'STAFF'].includes(currentUser.role) && requestedBranchId && requestedBranchId !== currentUser.branchId) {
      fail(403, 'FORBIDDEN', 'Branch access is not allowed')
    }
    const branchId = ['BRANCH_MANAGER', 'STAFF'].includes(currentUser.role)
      ? currentUser.branchId
      : requestedBranchId
    const filtered = db.purchaseOrders.filter((po) => !branchId || po.branchId === branchId)
    return { data: filtered, page: 1, limit: 50, total: filtered.length }
  }

  const purchaseOrderDetailMatch = path.match(/^\/purchase-orders\/(\d+)$/)
  if (method === 'GET' && purchaseOrderDetailMatch) {
    if (!currentUser) fail(401, 'UNAUTHENTICATED', 'Not logged in')
    if (!['ADMIN', 'BRANCH_MANAGER', 'STAFF'].includes(currentUser.role)) fail(403, 'FORBIDDEN', 'Purchase order access is not allowed')
    const po = db.purchaseOrders.find((record) => record.id === Number(purchaseOrderDetailMatch[1]))
    if (!po) fail(404, 'NOT_FOUND', 'Purchase order not found')
    if (['BRANCH_MANAGER', 'STAFF'].includes(currentUser.role) && po.branchId !== currentUser.branchId) fail(403, 'FORBIDDEN', 'Branch access is not allowed')
    return po
  }

  if (method === 'POST' && path === '/purchase-orders') {
    if (!currentUser) fail(401, 'UNAUTHENTICATED', 'Not logged in')
    if (!['ADMIN', 'BRANCH_MANAGER', 'STAFF'].includes(currentUser.role)) fail(403, 'FORBIDDEN', 'Purchase order access is not allowed')
    if (currentUser.role === 'ADMIN' && !body?.branchId) fail(400, 'VALIDATION_ERROR', 'Receiving branch is required')
    if (!body?.supplierId) fail(400, 'VALIDATION_ERROR', 'Supplier is required')
    if (!Array.isArray(body?.items) || body.items.length === 0) fail(400, 'VALIDATION_ERROR', 'At least one item is required')
    const requestedBranchId = body.branchId ? Number(body.branchId) : null
    if (['BRANCH_MANAGER', 'STAFF'].includes(currentUser.role) && requestedBranchId && requestedBranchId !== currentUser.branchId) {
      fail(403, 'FORBIDDEN', 'Branch access is not allowed')
    }
    const branchId = currentUser.role === 'ADMIN' ? requestedBranchId : currentUser.branchId
    const supp = db.suppliers.find(s => s.id === Number(body.supplierId))
    if (!supp || supp.isActive === false) fail(404, 'NOT_FOUND', 'Supplier not found')
    const br = db.branches.find(b => b.id === branchId)
    if (!br || br.isActive === false) fail(404, 'NOT_FOUND', 'Branch not found')
    const productIds = body.items.map((item) => Number(item.productId))
    if (new Set(productIds).size !== productIds.length) fail(400, 'VALIDATION_ERROR', 'A product may only appear once')
    for (const item of body.items) {
      const product = db.products.find((record) => record.id === Number(item.productId) && record.isActive !== false)
      if (!product) fail(404, 'NOT_FOUND', 'Product not found')
      if (!Number.isFinite(Number(item.quantity)) || Number(item.quantity) <= 0 || !/^(?:\d+)(?:\.\d{1,2})?$/.test(String(item.quantity))) fail(400, 'VALIDATION_ERROR', 'Quantity must be positive with up to two decimals')
      if (!Number.isFinite(Number(item.unitCost)) || Number(item.unitCost) < 0 || !/^(?:\d+)(?:\.\d{1,2})?$/.test(String(item.unitCost))) fail(400, 'VALIDATION_ERROR', 'Unit cost must be zero or more with up to two decimals')
    }
    let totalCost = 0
    const items = (body.items || []).map((item, idx) => {
      const p = db.products.find(x => x.id === Number(item.productId))
      const cost = Number(item.unitCost) || p?.costPrice || 0
      const qty = Number(item.quantity) || 1
      totalCost += (cost * qty)
      return {
        id: idx + 1,
        productId: p?.id || item.productId,
        productName: p?.name || 'Item',
        sku: p?.sku || '',
        quantity: qty,
        unitCost: cost,
        receivedQuantity: 0,
      }
    })

    const newPo = {
      id: db.purchaseOrders.length ? Math.max(...db.purchaseOrders.map(p => p.id)) + 1 : 1,
      poNumber: `PO-2026-${100 + db.purchaseOrders.length}`,
      supplierId: supp?.id || 1,
      supplierName: supp?.name || 'Supplier',
      branchId,
      branchName: br?.name || 'Branch',
      totalCost,
      status: 'PENDING_APPROVAL',
      createdAt: new Date().toISOString(),
      createdById: currentUser.id,
      createdByName: currentUser.fullName,
      items
    }

    db.purchaseOrders.unshift(newPo)
    saveDb(db)
    return newPo
  }

  const poApproveMatch = path.match(/^\/purchase-orders\/(\d+)\/approve$/)
  if (method === 'POST' && poApproveMatch) {
    if (!currentUser) fail(401, 'UNAUTHENTICATED', 'Not logged in')
    if (!['ADMIN', 'BRANCH_MANAGER'].includes(currentUser.role)) fail(403, 'FORBIDDEN', 'Approval is not allowed')
    const id = Number(poApproveMatch[1])
    const po = db.purchaseOrders.find(p => p.id === id)
    if (!po) fail(404, 'NOT_FOUND', 'Purchase order not found')
    if (currentUser.role === 'BRANCH_MANAGER' && currentUser.branchId !== po.branchId) fail(403, 'FORBIDDEN', 'Branch access is not allowed')
    if (po.status !== 'PENDING_APPROVAL') fail(409, 'INVALID_STATUS', 'Only pending purchase orders can be approved')
    po.status = 'APPROVED'
    po.approvedById = currentUser.id
    po.approvedByName = currentUser.fullName
    po.approvedAt = new Date().toISOString()
    saveDb(db)
    return po
  }

  const poRejectMatch = path.match(/^\/purchase-orders\/(\d+)\/reject$/)
  if (method === 'POST' && poRejectMatch) {
    if (!currentUser) fail(401, 'UNAUTHENTICATED', 'Not logged in')
    if (!['ADMIN', 'BRANCH_MANAGER'].includes(currentUser.role)) fail(403, 'FORBIDDEN', 'Rejection is not allowed')
    const id = Number(poRejectMatch[1])
    const po = db.purchaseOrders.find(p => p.id === id)
    if (!po) fail(404, 'NOT_FOUND', 'Purchase order not found')
    if (currentUser.role === 'BRANCH_MANAGER' && currentUser.branchId !== po.branchId) fail(403, 'FORBIDDEN', 'Branch access is not allowed')
    if (po.status !== 'PENDING_APPROVAL') fail(409, 'INVALID_STATUS', 'Only pending purchase orders can be rejected')
    if (body?.reason && body.reason.length > 300) fail(400, 'VALIDATION_ERROR', 'Rejection reason is too long')
    po.status = 'REJECTED'
    po.rejectReason = body?.reason || 'Rejected by manager'
    po.rejectedById = currentUser.id
    po.rejectedByName = currentUser.fullName
    po.rejectedAt = new Date().toISOString()
    saveDb(db)
    return po
  }

  const poReceiveMatch = path.match(/^\/purchase-orders\/(\d+)\/receive$/)
  if (method === 'POST' && poReceiveMatch) {
    if (!currentUser) fail(401, 'UNAUTHENTICATED', 'Not logged in')
    if (!['ADMIN', 'BRANCH_MANAGER', 'STAFF'].includes(currentUser.role)) fail(403, 'FORBIDDEN', 'Receiving is not allowed')
    const id = Number(poReceiveMatch[1])
    const po = db.purchaseOrders.find(p => p.id === id)
    if (!po) fail(404, 'NOT_FOUND', 'Purchase order not found')
    if (currentUser.role !== 'ADMIN' && currentUser.branchId !== po.branchId) fail(403, 'FORBIDDEN', 'Branch access is not allowed')
    if (po.status !== 'APPROVED' && po.status !== 'PARTIALLY_RECEIVED') {
      fail(409, 'INVALID_STATUS', 'Only approved or partially received POs can be received')
    }

    const receiveItems = body?.items || []
    let allReceived = true

    po.items.forEach((line) => {
      const toReceive = receiveItems.find(ri => ri.id === line.id || ri.productId === line.productId)
      if (toReceive) {
        const qty = Number(toReceive.quantity) || 0
        if (line.receivedQuantity + qty > line.quantity) {
          fail(422, 'OVER_RECEIVE', `Cannot receive more than ordered for ${line.productName}`)
        }
        line.receivedQuantity += qty

        // Add to stock
        const stock = db.branchStock.find(s => s.branchId === po.branchId && s.productId === line.productId)
        if (stock) {
          stock.quantity += qty
          syncLowStockNotification(po.branchId, db.products.find((product) => Number(product.id) === Number(line.productId)), stock, new Date().toISOString())
          db.movements.unshift({
            id: Date.now() + line.id,
            date: new Date().toISOString(),
            branchId: po.branchId,
            branchName: po.branchName,
            productId: line.productId,
            productName: line.productName,
            type: 'PURCHASE_RECEIPT',
            quantityChange: qty,
            quantityAfter: stock.quantity,
            reason: po.poNumber,
            user: currentUser.fullName
          })
        }
      }
      if (line.receivedQuantity < line.quantity) {
        allReceived = false
      }
    })

    po.status = allReceived ? 'RECEIVED' : 'PARTIALLY_RECEIVED'
    saveDb(db)
    return po
  }

  // ---------------- TRANSFERS ----------------
  if (method === 'GET' && path === '/transfers') {
    if (!currentUser) fail(401, 'UNAUTHENTICATED', 'Not logged in')
    if (!['ADMIN', 'BRANCH_MANAGER', 'STAFF'].includes(currentUser.role)) fail(403, 'FORBIDDEN', 'Transfers access is not allowed')
    const isBranchUser = ['BRANCH_MANAGER', 'STAFF'].includes(currentUser.role)
    const requestedBranchId = params?.branchId ? Number(params.branchId) : null
    if (isBranchUser && requestedBranchId && requestedBranchId !== Number(currentUser.branchId)) fail(403, 'FORBIDDEN', 'Branch access is not allowed')
    if (params?.direction && !['incoming', 'outgoing'].includes(params.direction)) fail(400, 'VALIDATION_ERROR', 'Invalid transfer direction')
    if (params?.status && !['REQUESTED', 'APPROVED', 'REJECTED', 'SHIPPED', 'RECEIVED'].includes(params.status)) fail(400, 'VALIDATION_ERROR', 'Invalid transfer status')
    const page = Number(params?.page) || 1
    const limit = Number(params?.limit) || 20
    if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1 || limit > 100) fail(400, 'VALIDATION_ERROR', 'Invalid pagination')
    const parseDate = (value, endOfDay = false) => {
      if (!value) return null
      const date = new Date(`${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}+03:00`)
      return Number.isNaN(date.getTime()) ? null : date
    }
    const fromDate = parseDate(params?.from)
    const toDate = parseDate(params?.to, true)
    if ((params?.from && !fromDate) || (params?.to && !toDate)) fail(400, 'VALIDATION_ERROR', 'Invalid transfer date range')
    const branchId = isBranchUser ? Number(currentUser.branchId) : requestedBranchId
    const filtered = db.transfers.filter((transfer) => {
      const fromBranchId = Number(transfer.fromBranchId)
      const toBranchId = Number(transfer.toBranchId)
      const createdAt = new Date(transfer.requestedAt || transfer.createdAt)
      if (branchId && fromBranchId !== branchId && toBranchId !== branchId) return false
      if (params?.direction === 'incoming' && toBranchId !== Number(currentUser.branchId)) return false
      if (params?.direction === 'outgoing' && fromBranchId !== Number(currentUser.branchId)) return false
      if (params?.status && transfer.status !== params.status) return false
      if (fromDate && createdAt < fromDate) return false
      if (toDate && createdAt > toDate) return false
      return true
    }).sort((a, b) => new Date(b.requestedAt || b.createdAt) - new Date(a.requestedAt || a.createdAt))
    const start = (page - 1) * limit
    const data = filtered.slice(start, start + limit).map(({ items = [], ...transfer }) => ({ ...transfer, requestedAt: transfer.requestedAt || transfer.createdAt, itemCount: items.length }))
    return { data, page, limit, total: filtered.length }
  }

  const trfDetail = path.match(/^\/transfers\/(\d+)$/)
  if (method === 'GET' && trfDetail) {
    if (!currentUser) fail(401, 'UNAUTHENTICATED', 'Not logged in')
    if (!['ADMIN', 'BRANCH_MANAGER', 'STAFF'].includes(currentUser.role)) fail(403, 'FORBIDDEN', 'Transfers access is not allowed')
    const trf = db.transfers.find((transfer) => Number(transfer.id) === Number(trfDetail[1]))
    if (!trf) fail(404, 'NOT_FOUND', 'Transfer not found')
    if (['BRANCH_MANAGER', 'STAFF'].includes(currentUser.role) && ![Number(trf.fromBranchId), Number(trf.toBranchId)].includes(Number(currentUser.branchId))) fail(403, 'FORBIDDEN', 'Branch access is not allowed')
    return { ...trf, requestedAt: trf.requestedAt || trf.createdAt, requestedBy: trf.requestedBy || { id: trf.requestedById, fullName: trf.requestedByName } }
  }

  if (method === 'POST' && path === '/transfers') {
    if (!currentUser) fail(401, 'UNAUTHENTICATED', 'Not logged in')
    if (!['ADMIN', 'BRANCH_MANAGER', 'STAFF'].includes(currentUser.role)) fail(403, 'FORBIDDEN', 'Transfers access is not allowed')
    const fromBranch = db.branches.find(b => b.id === Number(body.fromBranchId))
    const toBranch = db.branches.find(b => b.id === Number(body.toBranchId))
    if (!fromBranch || !toBranch || !fromBranch.isActive || !toBranch.isActive || fromBranch.id === toBranch.id) fail(400, 'VALIDATION_ERROR', 'Active, different branches are required')
    if (['BRANCH_MANAGER', 'STAFF'].includes(currentUser.role) && Number(body.toBranchId) !== Number(currentUser.branchId)) fail(403, 'FORBIDDEN', 'Transfers must be requested for your own branch')
    if (body.note !== undefined && (typeof body.note !== 'string' || body.note.length > 300)) fail(400, 'VALIDATION_ERROR', 'Note must be 300 characters or fewer')
    if (!Array.isArray(body.items) || body.items.length < 1) fail(400, 'VALIDATION_ERROR', 'At least one transfer item is required')
    const seenProducts = new Set()
    const items = body.items.map((item, idx) => {
      const productId = Number(item.productId)
      const quantity = Number(item.quantity)
      const p = db.products.find(x => Number(x.id) === productId && x.isActive !== false)
      if (!p || !Number.isFinite(quantity) || quantity <= 0 || Math.round(quantity * 100) !== quantity * 100 || seenProducts.has(productId)) fail(400, 'VALIDATION_ERROR', 'Transfer items must use active products, unique product IDs, and positive quantities with at most two decimal places')
      seenProducts.add(productId)
      return { id: idx + 1, productId: p.id, productName: p.name, sku: p.sku || '', quantity }
    })

    const now = new Date().toISOString()
    const newTransfer = {
      id: db.transfers.length ? Math.max(...db.transfers.map(t => t.id)) + 1 : 1,
      transferNumber: `TRF-2026-${100 + db.transfers.length}`,
      fromBranchId: fromBranch.id,
      fromBranchName: fromBranch.name,
      toBranchId: toBranch.id,
      toBranchName: toBranch.name,
      status: 'REQUESTED',
      note: body.note?.trim() || undefined,
      createdAt: now,
      requestedAt: now,
      requestedBy: { id: currentUser.id, fullName: currentUser.fullName },
      requestedById: currentUser.id,
      requestedByName: currentUser.fullName,
      items,
    }

    db.transfers.unshift(newTransfer)
    db.auditLogs.unshift({ id: Date.now(), timestamp: now, user: currentUser.fullName, action: 'TRANSFER_REQUESTED', branch: toBranch.name, details: `Requested ${newTransfer.transferNumber} from ${fromBranch.name}` })
    saveDb(db)
    return newTransfer
  }

  const trfApprove = path.match(/^\/transfers\/(\d+)\/approve$/)
  if (method === 'POST' && trfApprove) {
    if (!currentUser) fail(401, 'UNAUTHENTICATED', 'Not logged in')
    if (!['ADMIN', 'BRANCH_MANAGER'].includes(currentUser.role)) fail(403, 'FORBIDDEN', 'Only an admin or source branch manager may approve transfers')
    const id = Number(trfApprove[1])
    const trf = db.transfers.find(t => t.id === id)
    if (!trf) fail(404, 'NOT_FOUND', 'Transfer not found')
    if (currentUser.role === 'BRANCH_MANAGER' && Number(currentUser.branchId) !== Number(trf.fromBranchId)) fail(403, 'FORBIDDEN', 'Only the source branch manager may approve this transfer')
    if (trf.status !== 'REQUESTED') fail(409, 'INVALID_STATUS', 'Only requested transfers may be approved')
    const now = new Date().toISOString()
    trf.status = 'APPROVED'
    trf.approvedAt = now
    trf.approvedBy = { id: currentUser.id, fullName: currentUser.fullName }
    trf.approvedById = currentUser.id
    trf.approvedByName = currentUser.fullName
    db.auditLogs.unshift({ id: Date.now(), timestamp: now, user: currentUser.fullName, action: 'TRANSFER_APPROVED', branch: trf.fromBranchName, details: `Approved ${trf.transferNumber}` })
    saveDb(db)
    return trf
  }

  const trfReject = path.match(/^\/transfers\/(\d+)\/reject$/)
  if (method === 'POST' && trfReject) {
    if (!currentUser) fail(401, 'UNAUTHENTICATED', 'Not logged in')
    if (!['ADMIN', 'BRANCH_MANAGER'].includes(currentUser.role)) fail(403, 'FORBIDDEN', 'Only an admin or source branch manager may reject transfers')
    const trf = db.transfers.find((transfer) => Number(transfer.id) === Number(trfReject[1]))
    if (!trf) fail(404, 'NOT_FOUND', 'Transfer not found')
    if (currentUser.role === 'BRANCH_MANAGER' && Number(currentUser.branchId) !== Number(trf.fromBranchId)) fail(403, 'FORBIDDEN', 'Only the source branch manager may reject this transfer')
    if (trf.status !== 'REQUESTED') fail(409, 'INVALID_STATUS', 'Only requested transfers may be rejected')
    if (body?.reason !== undefined && (typeof body.reason !== 'string' || body.reason.length > 300)) fail(400, 'VALIDATION_ERROR', 'Rejection reason must be 300 characters or fewer')
    const now = new Date().toISOString()
    trf.status = 'REJECTED'
    trf.rejectReason = body?.reason?.trim() || undefined
    trf.rejectedAt = now
    trf.rejectedBy = { id: currentUser.id, fullName: currentUser.fullName }
    db.auditLogs.unshift({ id: Date.now(), timestamp: now, user: currentUser.fullName, action: 'TRANSFER_REJECTED', branch: trf.fromBranchName, details: `Rejected ${trf.transferNumber}${trf.rejectReason ? `: ${trf.rejectReason}` : ''}` })
    saveDb(db)
    return trf
  }

  const trfShip = path.match(/^\/transfers\/(\d+)\/ship$/)
  if (method === 'POST' && trfShip) {
    if (!currentUser) fail(401, 'UNAUTHENTICATED', 'Not logged in')
    if (!['ADMIN', 'BRANCH_MANAGER', 'STAFF'].includes(currentUser.role)) fail(403, 'FORBIDDEN', 'Transfers access is not allowed')
    const id = Number(trfShip[1])
    const trf = db.transfers.find(t => t.id === id)
    if (!trf) fail(404, 'NOT_FOUND', 'Transfer not found')
    if (currentUser.role !== 'ADMIN' && Number(currentUser.branchId) !== Number(trf.fromBranchId)) fail(403, 'FORBIDDEN', 'Only the source branch may ship this transfer')
    if (trf.status !== 'APPROVED') fail(409, 'INVALID_STATUS', 'Only approved transfers may be shipped')

    // Validate every line before applying any stock changes.
    for (const item of trf.items) {
      const stock = db.branchStock.find(s => s.branchId === trf.fromBranchId && s.productId === item.productId)
      if (!stock || stock.quantity < item.quantity) {
        fail(422, 'INSUFFICIENT_STOCK', `Source branch has insufficient stock for ${item.productName}`)
      }
    }
    const now = new Date().toISOString()
    trf.items.forEach((item) => {
      const stock = db.branchStock.find(s => s.branchId === trf.fromBranchId && s.productId === item.productId)
      const previousQuantity = Number(stock.quantity)
      stock.quantity -= item.quantity

      db.movements.unshift({
        id: Date.now() + item.id,
        date: now,
        branchId: trf.fromBranchId,
        branchName: trf.fromBranchName,
        productId: item.productId,
        productName: item.productName,
        type: 'TRANSFER_OUT',
        quantityChange: -item.quantity,
        quantityAfter: stock.quantity,
        reason: `${trf.transferNumber} to ${trf.toBranchName}`,
        referenceType: 'TRANSFER',
        referenceId: trf.id,
        user: currentUser.fullName
      })
      syncLowStockNotification(trf.fromBranchId, db.products.find((product) => Number(product.id) === Number(item.productId)), stock, now, previousQuantity)
    })

    trf.status = 'SHIPPED'
    trf.shippedBy = { id: currentUser.id, fullName: currentUser.fullName }
    trf.shippedAt = now
    trf.shippedById = currentUser.id
    trf.shippedByName = currentUser.fullName
    db.auditLogs.unshift({ id: Date.now(), timestamp: now, user: currentUser.fullName, action: 'TRANSFER_SHIPPED', branch: trf.fromBranchName, details: `Shipped ${trf.transferNumber} to ${trf.toBranchName}` })
    saveDb(db)
    return trf
  }

  const trfReceive = path.match(/^\/transfers\/(\d+)\/receive$/)
  if (method === 'POST' && trfReceive) {
    if (!currentUser) fail(401, 'UNAUTHENTICATED', 'Not logged in')
    if (!['ADMIN', 'BRANCH_MANAGER', 'STAFF'].includes(currentUser.role)) fail(403, 'FORBIDDEN', 'Transfers access is not allowed')
    const id = Number(trfReceive[1])
    const trf = db.transfers.find(t => t.id === id)
    if (!trf) fail(404, 'NOT_FOUND', 'Transfer not found')
    if (currentUser.role !== 'ADMIN' && Number(currentUser.branchId) !== Number(trf.toBranchId)) fail(403, 'FORBIDDEN', 'Only the destination branch may receive this transfer')
    if (trf.status !== 'SHIPPED') fail(409, 'INVALID_STATUS', 'Only shipped transfers may be received')

    // Add to destination stock
    const now = new Date().toISOString()
    trf.items.forEach((item) => {
      let stock = db.branchStock.find(s => s.branchId === trf.toBranchId && s.productId === item.productId)
      if (!stock) {
        stock = { branchId: trf.toBranchId, productId: item.productId, quantity: 0, minQuantity: 10, maxQuantity: 100 }
        db.branchStock.push(stock)
      }
      stock.quantity += item.quantity

      db.movements.unshift({
        id: Date.now() + item.id,
        date: now,
        branchId: trf.toBranchId,
        branchName: trf.toBranchName,
        productId: item.productId,
        productName: item.productName,
        type: 'TRANSFER_IN',
        quantityChange: item.quantity,
        quantityAfter: stock.quantity,
        reason: `${trf.transferNumber} from ${trf.fromBranchName}`,
        referenceType: 'TRANSFER',
        referenceId: trf.id,
        user: currentUser.fullName
      })
      syncLowStockNotification(trf.toBranchId, db.products.find((product) => Number(product.id) === Number(item.productId)), stock, now)
    })

    trf.status = 'RECEIVED'
    trf.receivedBy = { id: currentUser.id, fullName: currentUser.fullName }
    trf.receivedAt = now
    trf.receivedById = currentUser.id
    trf.receivedByName = currentUser.fullName
    db.auditLogs.unshift({ id: Date.now(), timestamp: now, user: currentUser.fullName, action: 'TRANSFER_RECEIVED', branch: trf.toBranchName, details: `Received ${trf.transferNumber} from ${trf.fromBranchName}` })
    saveDb(db)
    return trf
  }

  // ---------------- ADJUSTMENTS ----------------
  if (method === 'GET' && path === '/adjustments') {
    if (!currentUser) fail(401, 'UNAUTHENTICATED', 'Not logged in')
    if (!['ADMIN', 'BRANCH_MANAGER', 'STAFF', 'AUDITOR'].includes(currentUser.role)) fail(403, 'FORBIDDEN', 'Adjustments access is not allowed')
    const requestedBranchId = params?.branchId ? Number(params.branchId) : null
    if (['BRANCH_MANAGER', 'STAFF'].includes(currentUser.role) && requestedBranchId && requestedBranchId !== currentUser.branchId) {
      fail(403, 'FORBIDDEN', 'Branch access is not allowed')
    }
    const branchId = ['BRANCH_MANAGER', 'STAFF'].includes(currentUser.role) ? currentUser.branchId : requestedBranchId
    const validReasons = ['DAMAGE', 'EXPIRY', 'LOSS', 'RECOUNT', 'OTHER', 'OPENING_STOCK']
    if (params?.reason && !validReasons.includes(params.reason)) fail(400, 'VALIDATION_ERROR', 'Invalid adjustment reason')
    const page = Number(params?.page) || 1
    const limit = Number(params?.limit) || 20
    if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1 || limit > 100) fail(400, 'VALIDATION_ERROR', 'Invalid pagination')
    const filtered = db.adjustments.filter((adjustment) => {
      if (branchId && Number(adjustment.branchId) !== branchId) return false
      if (params?.productId && Number(adjustment.productId) !== Number(params.productId)) return false
      if (params?.reason && adjustment.reason !== params.reason) return false
      if (params?.from || params?.to) {
        const parts = new Intl.DateTimeFormat('en-CA', {
          timeZone: 'Africa/Addis_Ababa', year: 'numeric', month: '2-digit', day: '2-digit',
        }).formatToParts(new Date(adjustment.createdAt))
        const adjustmentDate = `${parts.find((part) => part.type === 'year')?.value}-${parts.find((part) => part.type === 'month')?.value}-${parts.find((part) => part.type === 'day')?.value}`
        if (params.from && adjustmentDate < params.from) return false
        if (params.to && adjustmentDate > params.to) return false
      }
      return true
    }).sort((first, second) => new Date(second.createdAt) - new Date(first.createdAt))
    return { data: filtered.slice((page - 1) * limit, page * limit), page, limit, total: filtered.length }
  }

  if (method === 'POST' && path === '/adjustments') {
    if (!currentUser) fail(401, 'UNAUTHENTICATED', 'Not logged in')
    if (!['ADMIN', 'BRANCH_MANAGER', 'STAFF'].includes(currentUser.role)) fail(403, 'FORBIDDEN', 'Adjustment creation is not allowed')
    const requestedBranchId = body?.branchId ? Number(body.branchId) : null
    if (currentUser.role === 'ADMIN' && !requestedBranchId) fail(400, 'VALIDATION_ERROR', 'Branch is required')
    if (['BRANCH_MANAGER', 'STAFF'].includes(currentUser.role) && requestedBranchId && requestedBranchId !== currentUser.branchId) fail(403, 'FORBIDDEN', 'Branch access is not allowed')
    const branchId = currentUser.role === 'ADMIN' ? requestedBranchId : currentUser.branchId
    const branch = db.branches.find((record) => record.id === branchId)
    if (!branch) fail(404, 'NOT_FOUND', 'Branch not found')
    if (branch.isActive === false) fail(400, 'VALIDATION_ERROR', 'Inactive branch cannot be used')
    const p = db.products.find(x => x.id === Number(body?.productId))
    if (!p) fail(404, 'NOT_FOUND', 'Product not found')
    if (p.isActive === false) fail(400, 'VALIDATION_ERROR', 'Inactive product cannot be used')
    const validReasons = ['DAMAGE', 'EXPIRY', 'LOSS', 'RECOUNT', 'OTHER', 'OPENING_STOCK']
    if (!validReasons.includes(body?.reason)) fail(400, 'VALIDATION_ERROR', 'Invalid adjustment reason')
    const quantity = Number(body?.quantity)
    if (!Number.isFinite(quantity) || quantity === 0 || !/^-?\d+(\.\d{1,2})?$/.test(String(body?.quantity))) fail(400, 'VALIDATION_ERROR', 'Quantity must be nonzero with up to two decimal places')
    if (typeof body?.note !== 'undefined' && (typeof body.note !== 'string' || body.note.length > 300)) fail(400, 'VALIDATION_ERROR', 'Note must be at most 300 characters')
    if (['DAMAGE', 'EXPIRY', 'LOSS'].includes(body.reason) && quantity > 0) fail(400, 'VALIDATION_ERROR', 'Quantity must be negative for this reason', [{ field: 'quantity', rule: 'must_be_negative' }])
    if (body.reason === 'OPENING_STOCK' && quantity < 0) fail(400, 'VALIDATION_ERROR', 'Opening stock quantity must be positive', [{ field: 'quantity', rule: 'min', value: 0.01 }])
    const stock = db.branchStock.find((record) => record.branchId === branchId && record.productId === p.id)
    if (!stock) fail(404, 'NOT_FOUND', 'Branch stock record not found')
    if (stock.quantity + quantity < 0) fail(422, 'INSUFFICIENT_STOCK', 'Stock cannot go below zero', [{ field: 'quantity', available: stock.quantity, requested: Math.abs(quantity) }])

    const adj = {
      id: db.adjustments.length ? Math.max(...db.adjustments.map(a => a.id)) + 1 : 1,
      branchId,
      branchName: branch.name,
      productId: p.id,
      productName: p.name,
      quantity,
      reason: body.reason,
      ...(body.note?.trim() ? { note: body.note.trim() } : {}),
      createdAt: new Date().toISOString(),
      createdBy: { id: currentUser.id, name: currentUser.fullName },
    }
    const previousQuantity = Number(stock.quantity)
    stock.quantity += quantity
    syncLowStockNotification(branchId, p, stock, adj.createdAt, previousQuantity)
    db.adjustments.unshift(adj)
    const movementType = body.reason === 'OPENING_STOCK' ? 'OPENING_STOCK' : 'ADJUSTMENT'
    db.movements.unshift({
      id: Date.now(),
      date: adj.createdAt,
      branchId,
      branchName: adj.branchName,
      productId: p.id,
      productName: p.name,
      type: movementType,
      quantityChange: quantity,
      quantityAfter: stock.quantity,
      reason: body.reason,
      referenceType: 'ADJUSTMENT',
      referenceId: adj.id,
      user: currentUser.fullName,
    })
    db.auditLogs.unshift({ id: Date.now() + 1, timestamp: adj.createdAt, user: currentUser.fullName, action: 'ADJUSTMENT_CREATED', branch: branch.name, details: `Adjusted ${p.name} by ${quantity}` })
    saveDb(db)
    return adj
  }

  // ---------------- NOTIFICATIONS & LOW STOCK ----------------
  if (method === 'GET' && path === '/low-stock') {
    if (!currentUser) fail(401, 'UNAUTHENTICATED', 'Not logged in')
    if (!['ADMIN', 'BRANCH_MANAGER'].includes(currentUser.role)) fail(403, 'FORBIDDEN', 'Low-stock access is not allowed')
    const requestedBranch = params?.branchId ? Number(params.branchId) : null
    if (currentUser.role === 'BRANCH_MANAGER' && requestedBranch && requestedBranch !== Number(currentUser.branchId)) {
      fail(403, 'FORBIDDEN', 'Branch access is not allowed')
    }
    const branchId = currentUser.role === 'BRANCH_MANAGER' ? Number(currentUser.branchId) : requestedBranch
    const categoryId = params?.categoryId ? Number(params.categoryId) : null
    const page = Number(params?.page) || 1
    const limit = Number(params?.limit) || 20
    if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1 || limit > 100) fail(400, 'VALIDATION_ERROR', 'Invalid pagination')
    const rows = db.branchStock.filter((stock) => {
      const branch = db.branches.find((record) => Number(record.id) === Number(stock.branchId))
      const product = db.products.find((record) => Number(record.id) === Number(stock.productId))
      return (!branchId || Number(stock.branchId) === branchId)
        && Boolean(branch && branch.isActive !== false)
        && Boolean(product && product.isActive !== false)
        && stock.minQuantity > 0 && stock.quantity <= stock.minQuantity
    })
      .map((stock) => {
        const product = db.products.find((item) => item.id === stock.productId && item.isActive !== false)
        const branch = db.branches.find((item) => item.id === stock.branchId)
        const target = stock.maxQuantity > 0 ? stock.maxQuantity : stock.minQuantity * 2
        return {
          branchId: stock.branchId,
          branchName: branch?.name || '',
          productId: stock.productId,
          productName: product?.name || '',
          sku: product?.sku || '',
          quantity: stock.quantity,
          minQuantity: stock.minQuantity,
          maxQuantity: stock.maxQuantity,
          suggestedReorderQuantity: Math.max(0, target - stock.quantity),
          categoryId: product?.categoryId,
        }
      }).filter((row) => !categoryId || row.categoryId === categoryId)
      .sort((a, b) => a.productName.localeCompare(b.productName))
    const total = rows.length
    return { data: rows.slice((page - 1) * limit, page * limit), page, limit, total }
  }

  if (method === 'GET' && path === '/notifications') {
    if (!currentUser) fail(401, 'UNAUTHENTICATED', 'Not logged in')
    if (!['ADMIN', 'BRANCH_MANAGER'].includes(currentUser.role)) fail(403, 'FORBIDDEN', 'Notification access is not allowed')
    const requestedBranch = params?.branchId ? Number(params.branchId) : null
    if (currentUser.role === 'BRANCH_MANAGER' && requestedBranch && requestedBranch !== Number(currentUser.branchId)) fail(403, 'FORBIDDEN', 'Branch access is not allowed')
    const branchId = currentUser.role === 'BRANCH_MANAGER' ? Number(currentUser.branchId) : requestedBranch
    const checkedAt = new Date().toISOString()
    db.notifications.forEach((notification) => {
      if (notification.resolvedAt) return
      const stock = db.branchStock.find((record) => Number(record.branchId) === Number(notification.branchId) && Number(record.productId) === Number(notification.productId))
      if (!stock || Number(stock.minQuantity) <= 0 || Number(stock.quantity) > Number(stock.minQuantity)) notification.resolvedAt = checkedAt
    })
    saveDb(db)
    const notifs = db.notifications.filter((n) => (!branchId || Number(n.branchId) === branchId) && !n.resolvedAt)
      .map((notification) => ({
        ...notification,
        quantity: notification.currentStock ?? notification.quantity,
        branchName: notification.branchName || db.branches.find((branch) => Number(branch.id) === Number(notification.branchId))?.name || '',
      }))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    const unreadCount = notifs.filter(n => !n.isRead).length
    return { data: notifs, unreadCount }
  }

  if (method === 'POST' && path === '/notifications/read-all') {
    if (!currentUser) fail(401, 'UNAUTHENTICATED', 'Not logged in')
    if (!['ADMIN', 'BRANCH_MANAGER'].includes(currentUser.role)) fail(403, 'FORBIDDEN', 'Notification access is not allowed')
    db.notifications.forEach((notification) => {
      if (!notification.resolvedAt && (currentUser.role === 'ADMIN' || Number(notification.branchId) === Number(currentUser.branchId))) {
        notification.isRead = true
      }
    })
    saveDb(db)
    return { success: true }
  }

  // ---------------- REPORTS ----------------
  if (method === 'GET' && path === '/reports/stock-balance') {
    const branchId = params?.branchId ? Number(params.branchId) : (currentUser.branchId || null)
    const rows = []
    let totalValuation = 0

    db.products.forEach(p => {
      const stocks = db.branchStock.filter(s => s.productId === p.id && (!branchId || s.branchId === branchId))
      stocks.forEach(s => {
        const br = db.branches.find(b => b.id === s.branchId)
        const val = s.quantity * p.costPrice
        totalValuation += val
        rows.push({
          productId: p.id,
          name: p.name,
          sku: p.sku,
          branchName: br?.name || `Branch ${s.branchId}`,
          unit: p.unit,
          quantity: s.quantity,
          costPrice: currentUser.role === 'STAFF' ? undefined : p.costPrice,
          sellingPrice: p.sellingPrice,
          valuation: currentUser.role === 'STAFF' ? undefined : val,
          isLowStock: s.minQuantity > 0 && s.quantity <= s.minQuantity
        })
      })
    })

    return { data: rows, totalValuation }
  }

  if (method === 'GET' && path === '/reports/stock-movement') {
    const branchId = params?.branchId ? Number(params.branchId) : (currentUser.branchId || null)
    const filtered = db.movements.filter(m => !branchId || m.branchId === branchId)
    return { data: filtered }
  }

  if (method === 'GET' && path === '/reports/sales') {
    const branchId = params?.branchId ? Number(params.branchId) : (currentUser.branchId || null)
    const filtered = db.sales.filter(s => !branchId || s.branchId === branchId)
    const summary = filtered.reduce((acc, s) => {
      acc.totalSales += s.total
      acc.totalTax += s.tax
      acc.totalSubtotal += s.subtotal
      acc.invoiceCount++
      return acc
    }, { totalSales: 0, totalTax: 0, totalSubtotal: 0, invoiceCount: 0 })

    return { data: filtered, summary }
  }

  // ---------------- REFERENCE DATA ----------------
  if (path === '/branches' && method === 'GET') {
    if (!currentUser) fail(401, 'UNAUTHENTICATED', 'Not logged in')
    const branches = db.branches.filter((branch) => params?.includeInactive || branch.isActive !== false)
    return { data: branches, page: 1, limit: Number(params?.limit) || 100, total: branches.length }
  }
  if (path === '/branches' && method === 'POST') {
    if (!currentUser) fail(401, 'UNAUTHENTICATED', 'Not logged in')
    if (currentUser.role !== 'ADMIN') fail(403, 'FORBIDDEN', 'Admin role required')
    if (!body?.name?.trim()) fail(400, 'VALIDATION_ERROR', 'Branch name is required')
    if (db.branches.some((branch) => branch.name.toLowerCase() === body.name.trim().toLowerCase()
      || (body.code && branch.code?.toLowerCase() === body.code.trim().toLowerCase()))) {
      fail(409, 'DUPLICATE_VALUE', 'Branch name or code is already used')
    }
    const newBr = {
      id: Math.max(0, ...db.branches.map((branch) => branch.id)) + 1,
      name: body.name.trim(), code: body.code?.trim().toUpperCase() || '',
      address: body.address || '', phone: body.phone || '', isActive: true,
    }
    db.branches.push(newBr)
    // New branches start with an explicit zero-stock row for every existing product.
    db.products.forEach((product) => {
      if (!db.branchStock.some((row) => row.branchId === newBr.id && row.productId === product.id)) {
        db.branchStock.push({ branchId: newBr.id, productId: product.id, quantity: 0, minQuantity: 10, maxQuantity: 100 })
      }
    })
    saveDb(db)
    return newBr
  }
  const branchIdMatch = path.match(/^\/branches\/(\d+)$/)
  if (branchIdMatch && method === 'GET') {
    if (!currentUser) fail(401, 'UNAUTHENTICATED', 'Not logged in')
    const branch = db.branches.find((item) => item.id === Number(branchIdMatch[1]))
    if (!branch || (branch.isActive === false && !params?.includeInactive)) fail(404, 'NOT_FOUND', 'Branch not found')
    return branch
  }
  if (branchIdMatch && method === 'PATCH') {
    if (!currentUser) fail(401, 'UNAUTHENTICATED', 'Not logged in')
    if (currentUser.role !== 'ADMIN') fail(403, 'FORBIDDEN', 'Admin role required')
    const branch = db.branches.find((item) => item.id === Number(branchIdMatch[1]))
    if (!branch) fail(404, 'NOT_FOUND', 'Branch not found')
    if (body?.name !== undefined && !body.name.trim()) fail(400, 'VALIDATION_ERROR', 'Branch name is required')
    const duplicate = db.branches.some((item) => item.id !== branch.id && (
      (body?.name !== undefined && item.name.toLowerCase() === body.name.trim().toLowerCase())
      || (body?.code && item.code?.toLowerCase() === body.code.trim().toLowerCase())
    ))
    if (duplicate) fail(409, 'DUPLICATE_VALUE', 'Branch name or code is already used')
    Object.assign(branch, body, body?.name !== undefined ? { name: body.name.trim() } : {}, body?.code !== undefined ? { code: body.code.trim().toUpperCase() } : {})
    saveDb(db)
    return branch
  }

  if (method === 'GET' && path === '/categories') {
    if (!currentUser) fail(401, 'UNAUTHENTICATED', 'Not logged in')
    const categories = db.categories.filter((category) => params?.includeInactive || category.isActive !== false)
    return { data: categories, page: 1, limit: Number(params?.limit) || 100, total: categories.length }
  }
  if (method === 'POST' && path === '/categories') {
    if (!currentUser) fail(401, 'UNAUTHENTICATED', 'Not logged in')
    if (currentUser.role !== 'ADMIN') fail(403, 'FORBIDDEN', 'Admin role required')
    if (!body?.name?.trim()) fail(400, 'VALIDATION_ERROR', 'Category name is required')
    if (db.categories.some((category) => category.name.toLowerCase() === body.name.trim().toLowerCase())) {
      fail(409, 'DUPLICATE_VALUE', 'Category name is already used')
    }
    const newCat = { id: Math.max(0, ...db.categories.map((category) => category.id)) + 1, name: body.name.trim(), isActive: true }
    db.categories.push(newCat)
    saveDb(db)
    return newCat
  }
  const categoryIdMatch = path.match(/^\/categories\/(\d+)$/)
  if (categoryIdMatch && method === 'GET') {
    if (!currentUser) fail(401, 'UNAUTHENTICATED', 'Not logged in')
    const category = db.categories.find((item) => item.id === Number(categoryIdMatch[1]))
    if (!category || (category.isActive === false && !params?.includeInactive)) fail(404, 'NOT_FOUND', 'Category not found')
    return category
  }
  if (categoryIdMatch && method === 'PATCH') {
    if (!currentUser) fail(401, 'UNAUTHENTICATED', 'Not logged in')
    if (currentUser.role !== 'ADMIN') fail(403, 'FORBIDDEN', 'Admin role required')
    const category = db.categories.find((item) => item.id === Number(categoryIdMatch[1]))
    if (!category) fail(404, 'NOT_FOUND', 'Category not found')
    if (body?.name !== undefined && !body.name.trim()) fail(400, 'VALIDATION_ERROR', 'Category name is required')
    if (body?.name !== undefined && db.categories.some((item) => item.id !== category.id && item.name.toLowerCase() === body.name.trim().toLowerCase())) {
      fail(409, 'DUPLICATE_VALUE', 'Category name is already used')
    }
    Object.assign(category, body, body?.name !== undefined ? { name: body.name.trim() } : {})
    saveDb(db)
    return category
  }

  if (method === 'GET' && path === '/suppliers') {
    if (!currentUser) fail(401, 'UNAUTHENTICATED', 'Not logged in')
    if (!['ADMIN', 'BRANCH_MANAGER', 'STAFF'].includes(currentUser.role)) fail(403, 'FORBIDDEN', 'Supplier access is not allowed')
    const q = params?.q?.trim().toLowerCase()
    const suppliers = db.suppliers.filter((supplier) => (params?.includeInactive || supplier.isActive !== false)
      && (!q || [supplier.name, supplier.tin].some((value) => value?.toLowerCase().includes(q))))
      .map(({ contact, ...supplier }) => ({ ...supplier, contactName: supplier.contactName || contact || '' }))
    return { data: suppliers, page: 1, limit: Number(params?.limit) || 100, total: suppliers.length }
  }
  if (method === 'POST' && path === '/suppliers') {
    if (!currentUser) fail(401, 'UNAUTHENTICATED', 'Not logged in')
    if (!['ADMIN', 'BRANCH_MANAGER'].includes(currentUser.role)) fail(403, 'FORBIDDEN', 'Supplier write access is not allowed')
    if (!body?.name?.trim()) fail(400, 'VALIDATION_ERROR', 'Supplier name is required')
    const newSupp = {
      id: Math.max(0, ...db.suppliers.map((supplier) => supplier.id)) + 1,
      name: body.name.trim(), contactName: body.contactName?.trim() || '',
      phone: body.phone || '', tin: body.tin || '', address: body.address || '', isActive: true,
    }
    db.suppliers.push(newSupp)
    saveDb(db)
    return newSupp
  }
  const supplierIdMatch = path.match(/^\/suppliers\/(\d+)$/)
  if (supplierIdMatch && method === 'GET') {
    if (!currentUser) fail(401, 'UNAUTHENTICATED', 'Not logged in')
    if (!['ADMIN', 'BRANCH_MANAGER'].includes(currentUser.role)) fail(403, 'FORBIDDEN', 'Supplier access is not allowed')
    const supplier = db.suppliers.find((item) => item.id === Number(supplierIdMatch[1]))
    if (!supplier || (supplier.isActive === false && !params?.includeInactive)) fail(404, 'NOT_FOUND', 'Supplier not found')
    const { contact, ...record } = supplier
    return { ...record, contactName: supplier.contactName || contact || '' }
  }
  if (supplierIdMatch && method === 'PATCH') {
    if (!currentUser) fail(401, 'UNAUTHENTICATED', 'Not logged in')
    if (!['ADMIN', 'BRANCH_MANAGER'].includes(currentUser.role)) fail(403, 'FORBIDDEN', 'Supplier write access is not allowed')
    const supplier = db.suppliers.find((item) => item.id === Number(supplierIdMatch[1]))
    if (!supplier) fail(404, 'NOT_FOUND', 'Supplier not found')
    if (body?.name !== undefined && !body.name.trim()) fail(400, 'VALIDATION_ERROR', 'Supplier name is required')
    Object.assign(supplier, body, body?.name !== undefined ? { name: body.name.trim() } : {})
    if (supplier.contactName === undefined && supplier.contact !== undefined) supplier.contactName = supplier.contact
    saveDb(db)
    return supplier
  }

  const userIdMatch = path.match(/^\/users\/(\d+)$/)
  const resetPasswordMatch = path.match(/^\/users\/(\d+)\/reset-password$/)
  if ((method === 'GET' && path === '/users') || (method === 'POST' && path === '/users') || (userIdMatch && ['GET', 'PATCH'].includes(method)) || (resetPasswordMatch && method === 'POST')) {
    if (!currentUser) fail(401, 'UNAUTHENTICATED', 'Not logged in')
    if (currentUser.role !== 'ADMIN') fail(403, 'FORBIDDEN', 'Admin role required')
  }

  if (method === 'GET' && path === '/users') {
    const q = String(params?.q ?? '').trim().toLowerCase()
    let rows = db.users.filter((account) => (params?.includeInactive || account.isActive !== false)
      && (!q || [account.username, account.fullName].some((value) => value?.toLowerCase().includes(q)))
      && (!params?.role || account.role === params.role)
      && (!params?.branchId || account.branchId === Number(params.branchId)))
      .sort((a, b) => a.fullName.localeCompare(b.fullName))
    const page = Number(params?.page) || 1
    const limit = Number(params?.limit) || 20
    const total = rows.length
    rows = rows.slice((page - 1) * limit, page * limit)
    return { data: rows.map(({ password, ...account }) => account), page, limit, total }
  }
  if (method === 'POST' && path === '/users') {
    const allowedRoles = ['BRANCH_MANAGER', 'STAFF', 'AUDITOR']
    if (!body?.username?.trim() || body.username.trim().length > 100 || !body?.fullName?.trim() || body.fullName.trim().length > 150
      || typeof body.password !== 'string' || body.password.length < 8 || !allowedRoles.includes(body.role)) {
      fail(400, 'VALIDATION_ERROR', 'User details are invalid')
    }
    if (db.users.some((account) => account.username.toLowerCase() === body.username.trim().toLowerCase())) {
      fail(409, 'DUPLICATE_VALUE', 'Username is already in use')
    }
    const needsBranch = ['BRANCH_MANAGER', 'STAFF'].includes(body.role)
    const branchId = needsBranch ? Number(body.branchId) : null
    const branch = branchId ? db.branches.find((item) => item.id === branchId && item.isActive !== false) : null
    if (needsBranch && !branch) fail(404, 'NOT_FOUND', 'An active branch is required for this role')
    const newUser = {
      id: Math.max(0, ...db.users.map((account) => account.id)) + 1,
      username: body.username.trim(),
      fullName: body.fullName.trim(),
      role: body.role,
      branchId,
      branchName: branch?.name || null,
      isActive: true,
    }
    db.users.push(newUser)
    db.auditLogs.unshift({ id: Date.now(), timestamp: new Date().toISOString(), user: currentUser.fullName, action: 'USER_CREATED', branch: branch?.name || 'All', details: `Created account ${newUser.username} (${newUser.role})` })
    saveDb(db)
    return newUser
  }
  if (userIdMatch && method === 'GET') {
    const account = db.users.find((item) => item.id === Number(userIdMatch[1]))
    if (!account) fail(404, 'NOT_FOUND', 'User not found')
    const { password, ...safeAccount } = account
    return safeAccount
  }
  if (userIdMatch && method === 'PATCH') {
    const account = db.users.find((item) => item.id === Number(userIdMatch[1]))
    if (!account) fail(404, 'NOT_FOUND', 'User not found')
    if (body?.isActive === false && account.id === currentUser.id) fail(400, 'VALIDATION_ERROR', 'You cannot deactivate your own account')
    const nextRole = body?.role ?? account.role
    const nextFullName = body?.fullName ?? account.fullName
    if (!['ADMIN', 'BRANCH_MANAGER', 'STAFF', 'AUDITOR'].includes(nextRole) || !String(nextFullName).trim() || String(nextFullName).length > 150) {
      fail(400, 'VALIDATION_ERROR', 'User details are invalid')
    }
    if ((account.role === 'ADMIN' && (nextRole !== 'ADMIN' || body?.isActive === false || (body?.branchId !== undefined && body.branchId !== null)))
      || (account.role !== 'ADMIN' && nextRole === 'ADMIN')) {
      fail(400, 'VALIDATION_ERROR', 'The system Admin account is unique and cannot be reassigned or deactivated')
    }
    const needsBranch = ['BRANCH_MANAGER', 'STAFF'].includes(nextRole)
    const nextBranchId = body?.branchId === undefined ? account.branchId : (body.branchId == null || body.branchId === '' ? null : Number(body.branchId))
    const branch = needsBranch && nextBranchId ? db.branches.find((item) => item.id === nextBranchId) : null
    if (needsBranch && !branch) fail(400, 'VALIDATION_ERROR', 'An active branch is required for this role')
    if (needsBranch && body?.branchId !== undefined && branch?.isActive === false) fail(400, 'VALIDATION_ERROR', 'An active branch is required for this role')
    const oldRole = account.role
    Object.assign(account, body, {
      fullName: String(nextFullName).trim(),
      role: nextRole,
      branchId: needsBranch ? nextBranchId : null,
      branchName: branch?.name || null,
    })
    db.auditLogs.unshift({ id: Date.now(), timestamp: new Date().toISOString(), user: currentUser.fullName, action: body?.isActive === undefined ? 'USER_UPDATED' : body.isActive ? 'USER_ACTIVATED' : 'USER_DEACTIVATED', branch: branch?.name || 'All', details: `Updated account ${account.username} (${oldRole} → ${account.role})` })
    saveDb(db)
    const { password, ...safeAccount } = account
    return safeAccount
  }
  if (resetPasswordMatch && method === 'POST') {
    const account = db.users.find((item) => item.id === Number(resetPasswordMatch[1]))
    if (!account) fail(404, 'NOT_FOUND', 'User not found')
    if (typeof body?.newPassword !== 'string' || body.newPassword.length < 8) fail(400, 'VALIDATION_ERROR', 'Password must contain at least 8 characters')
    db.auditLogs.unshift({ id: Date.now(), timestamp: new Date().toISOString(), user: currentUser.fullName, action: 'USER_PASSWORD_RESET', branch: account.branchName || 'All', details: `Reset password for ${account.username}` })
    saveDb(db)
    return { success: true }
  }

  if (method === 'GET' && path === '/audit-logs') {
    return { data: db.auditLogs }
  }

  // Contract 6.1 exposes company settings only to Admin, with tax rates as percentages.
  if ((method === 'GET' || method === 'PUT') && path === '/settings/company') {
    if (currentUser.role !== 'ADMIN') fail(403, 'FORBIDDEN', 'Admin role required')
    if (method === 'GET') {
      const { nextInvoiceNumber, taxRate, ...company } = db.settings
      return {
        ...company,
        taxRate: Number((taxRate * 100).toFixed(2)),
        defaultTaxRates: { VAT: 15, TOT: 2 },
        updatedAt: db.settings.updatedAt || null,
      }
    }
    const { companyName, address, phone, tin, taxType, taxRate } = body || {}
    const rate = Number(taxRate)
    if (!companyName?.trim() || companyName.trim().length > 150 || !['VAT', 'TOT'].includes(taxType)
      || !Number.isFinite(rate) || rate < 0 || rate > 100 || Math.round(rate * 100) !== rate * 100
      || String(tin || '').length > 20) {
      fail(400, 'VALIDATION_ERROR', 'Invalid company settings')
    }
    db.settings = {
      ...db.settings,
      companyName: companyName.trim(),
      address: address ?? '',
      phone: phone ?? '',
      tin: tin ?? '',
      taxType,
      taxRate: rate / 100,
      updatedAt: new Date().toISOString(),
    }
    saveDb(db)
    const { nextInvoiceNumber, taxRate: savedRate, ...company } = db.settings
    return { ...company, taxRate: Number((savedRate * 100).toFixed(2)), defaultTaxRates: { VAT: 15, TOT: 2 } }
  }

  if (method === 'GET' && path === '/settings') {
    return db.settings
  }
  if (method === 'PUT' && path === '/settings') {
    db.settings = { ...db.settings, ...body }
    saveDb(db)
    return db.settings
  }

  return fail(404, 'NOT_FOUND', `No mock handler for ${method} ${path}`)
}
