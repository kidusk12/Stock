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
  const token = tokenStore.get() || ''
  const username = token.replace('mock-', '')
  return db.users.find((u) => u.username === username) || db.users[0]
}

export async function mockRequest(method, path, { body, params } = {}) {
  await delay()
  const db = loadDb()
  const currentUser = getCurrentUser(db)

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
    return currentUser
  }

  if (method === 'POST' && path === '/auth/change-password') {
    if (!body?.currentPassword || !body?.newPassword) fail(400, 'VALIDATION_ERROR', 'All fields required')
    return { success: true }
  }

  if (method === 'POST' && path === '/auth/logout') {
    return { success: true }
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
  if (method === 'GET' && path === '/products') {
    const q = String(params?.q ?? '').toLowerCase()
    const categoryId = params?.categoryId ? Number(params.categoryId) : null
    const branchId = params?.branchId ? Number(params.branchId) : (currentUser.branchId || null)
    const page = Number(params?.page) || 1
    const limit = Number(params?.limit) || 20

    let rows = db.products.map((p) => {
      const branchRows = db.branchStock.filter((s) => s.productId === p.id)
      const targetStock = branchId ? branchRows.find((s) => s.branchId === branchId) : null
      const totalQty = branchRows.reduce((sum, s) => sum + s.quantity, 0)
      const currentQty = targetStock ? targetStock.quantity : totalQty
      const minQty = targetStock ? targetStock.minQuantity : 0
      const maxQty = targetStock ? targetStock.maxQuantity : 0

      return {
        ...p,
        quantity: currentQty,
        minQuantity: minQty,
        maxQuantity: maxQty,
        branchStocks: branchRows.map(bs => {
          const br = db.branches.find(b => b.id === bs.branchId)
          return { ...bs, branchName: br?.name || `Branch ${bs.branchId}` }
        }),
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
    const code = byBarcode[1]
    const p = db.products.find((x) => x.barcode === code || x.sku.toLowerCase() === code.toLowerCase())
    if (!p) fail(404, 'PRODUCT_NOT_FOUND', 'No product found with this barcode')
    
    const branchId = currentUser.branchId || 1
    const stock = db.branchStock.find((s) => s.productId === p.id && s.branchId === branchId)
    return {
      ...p,
      quantity: stock ? stock.quantity : 0,
      minQuantity: stock ? stock.minQuantity : 0,
    }
  }

  if (method === 'POST' && path === '/products') {
    if (!body?.name || !body?.sku || !body?.sellingPrice) {
      fail(400, 'VALIDATION_ERROR', 'Name, SKU and selling price are required')
    }
    if (db.products.some((x) => x.sku.toLowerCase() === body.sku.toLowerCase())) {
      fail(409, 'DUPLICATE_SKU', 'SKU already exists')
    }
    if (body.barcode && db.products.some((x) => x.barcode === body.barcode)) {
      fail(409, 'DUPLICATE_BARCODE', 'Barcode already exists')
    }

    const cat = db.categories.find(c => c.id === Number(body.categoryId))
    const newId = db.products.length ? Math.max(...db.products.map(p => p.id)) + 1 : 1
    const newProd = {
      id: newId,
      name: body.name,
      sku: body.sku,
      barcode: body.barcode || null,
      categoryId: body.categoryId ? Number(body.categoryId) : 1,
      categoryName: cat?.name || 'General',
      unit: body.unit || 'piece',
      costPrice: Number(body.costPrice) || 0,
      sellingPrice: Number(body.sellingPrice) || 0,
      isActive: true,
    }

    db.products.push(newProd)

    // Initialize branch stock for each branch
    db.branches.forEach(b => {
      db.branchStock.push({
        branchId: b.id,
        productId: newId,
        quantity: b.id === (currentUser.branchId || 1) ? (Number(body.openingStock) || 0) : 0,
        minQuantity: Number(body.minQuantity) || 10,
        maxQuantity: Number(body.maxQuantity) || 100,
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

  // ---------------- SALES & POS ----------------
  if (method === 'GET' && path === '/sales') {
    const branchId = params?.branchId ? Number(params.branchId) : (currentUser.branchId || null)
    const page = Number(params?.page) || 1
    const limit = Number(params?.limit) || 20
    const filtered = db.sales.filter((s) => !branchId || s.branchId === branchId)
    return { data: filtered.slice((page - 1) * limit, page * limit), page, limit, total: filtered.length }
  }

  if (method === 'POST' && path === '/sales') {
    const branchId = currentUser.branchId || 1
    const items = body?.items || []
    if (!items.length) fail(400, 'VALIDATION_ERROR', 'Sale must have at least one item')

    // Check stock for each item
    for (const item of items) {
      const stock = db.branchStock.find((s) => s.branchId === branchId && s.productId === item.productId)
      const available = stock ? stock.quantity : 0
      if (available < item.quantity) {
        fail(422, 'INSUFFICIENT_STOCK', `Not enough stock for product ${item.productId}`, [
          { field: 'items', productId: item.productId, available, requested: item.quantity }
        ])
      }
    }

    // Deduct stock & create movement records
    const newItems = []
    let totalAmount = 0

    items.forEach((item, idx) => {
      const p = db.products.find(x => x.id === item.productId)
      const stock = db.branchStock.find(s => s.branchId === branchId && s.productId === item.productId)
      stock.quantity -= Number(item.quantity)
      
      const lineTotal = Number(item.quantity) * Number(p.sellingPrice)
      totalAmount += lineTotal
      newItems.push({
        id: idx + 1,
        productId: p.id,
        productName: p.name,
        sku: p.sku,
        quantity: Number(item.quantity),
        unitPrice: Number(p.sellingPrice),
        total: lineTotal
      })

      // Add movement
      db.movements.unshift({
        id: Date.now() + idx,
        date: new Date().toISOString(),
        branchId,
        branchName: db.branches.find(b => b.id === branchId)?.name || 'Branch',
        productId: p.id,
        productName: p.name,
        type: 'SALE',
        quantityChange: -Number(item.quantity),
        quantityAfter: stock.quantity,
        reason: `INV-2026-${db.settings.nextInvoiceNumber}`,
        user: currentUser.fullName
      })

      // Low stock check
      if (stock.minQuantity > 0 && stock.quantity <= stock.minQuantity) {
        db.notifications.unshift({
          id: Date.now() + idx + 100,
          branchId,
          productId: p.id,
          productName: p.name,
          type: 'LOW_STOCK',
          currentStock: stock.quantity,
          minQuantity: stock.minQuantity,
          message: `Stock for ${p.name} is now ${stock.quantity}, below minimum ${stock.minQuantity}`,
          isRead: false,
          createdAt: new Date().toISOString()
        })
      }
    })

    const taxRate = db.settings.taxRate || 0.15
    const subtotal = totalAmount / (1 + taxRate)
    const tax = totalAmount - subtotal
    const invNumber = `INV-2026-${db.settings.nextInvoiceNumber++}`

    const saleRecord = {
      id: db.sales.length ? Math.max(...db.sales.map(s => s.id)) + 1 : 1,
      invoiceNumber: invNumber,
      branchId,
      branchName: db.branches.find(b => b.id === branchId)?.name || 'Branch',
      customerName: body.customerName || 'Walk-in Customer (የቀን ደንበኛ)',
      customerTin: body.customerTin || '',
      subtotal: Math.round(subtotal * 100) / 100,
      tax: Math.round(tax * 100) / 100,
      total: Math.round(totalAmount * 100) / 100,
      createdAt: new Date().toISOString(),
      createdById: currentUser.id,
      createdByName: currentUser.fullName,
      items: newItems,
    }

    db.sales.unshift(saleRecord)

    db.auditLogs.unshift({
      id: Date.now() + 50,
      timestamp: new Date().toISOString(),
      user: currentUser.fullName,
      action: 'SALE_COMPLETED',
      branch: saleRecord.branchName,
      details: `Completed sale ${invNumber} total ${saleRecord.total} ETB`
    })

    saveDb(db)
    return saleRecord
  }

  // ---------------- RETURNS ----------------
  if (method === 'GET' && path === '/returns') {
    const branchId = params?.branchId ? Number(params.branchId) : (currentUser.branchId || null)
    const filtered = db.returns.filter((r) => !branchId || r.branchId === branchId)
    return { data: filtered, page: 1, limit: 50, total: filtered.length }
  }

  if (method === 'POST' && path === '/returns') {
    const sale = db.sales.find(s => s.id === Number(body.saleId) || s.invoiceNumber === body.invoiceNumber)
    if (!sale) fail(404, 'NOT_FOUND', 'Invoice not found')

    const branchId = sale.branchId
    let refundTotal = 0
    const returnItems = []

    body.items.forEach((item, idx) => {
      const saleItem = sale.items.find(si => si.productId === Number(item.productId))
      if (!saleItem || item.quantity > saleItem.quantity) {
        fail(422, 'RETURN_EXCEEDS_SOLD', 'Return quantity cannot exceed quantity sold')
      }
      const lineVal = item.quantity * saleItem.unitPrice
      refundTotal += lineVal
      returnItems.push({
        id: idx + 1,
        saleItemId: saleItem.id,
        productId: saleItem.productId,
        productName: saleItem.productName,
        quantity: Number(item.quantity),
        unitPrice: saleItem.unitPrice,
        total: lineVal
      })

      // Put stock back
      const stock = db.branchStock.find(s => s.branchId === branchId && s.productId === saleItem.productId)
      if (stock) {
        stock.quantity += Number(item.quantity)
        db.movements.unshift({
          id: Date.now() + idx,
          date: new Date().toISOString(),
          branchId,
          branchName: sale.branchName,
          productId: saleItem.productId,
          productName: saleItem.productName,
          type: 'CUSTOMER_RETURN',
          quantityChange: Number(item.quantity),
          quantityAfter: stock.quantity,
          reason: `RET for ${sale.invoiceNumber}`,
          user: currentUser.fullName
        })
      }
    })

    const returnRec = {
      id: db.returns.length ? Math.max(...db.returns.map(r => r.id)) + 1 : 1,
      returnNumber: `RET-2026-${100 + db.returns.length}`,
      saleId: sale.id,
      invoiceNumber: sale.invoiceNumber,
      branchId,
      branchName: sale.branchName,
      refundAmount: refundTotal,
      refundStatus: 'PENDING_REFUND',
      reason: body.reason || 'Customer Return',
      createdAt: new Date().toISOString(),
      createdById: currentUser.id,
      createdByName: currentUser.fullName,
      items: returnItems
    }

    db.returns.unshift(returnRec)
    saveDb(db)
    return returnRec
  }

  const refundMatch = path.match(/^\/returns\/(\d+)\/refund$/)
  if (method === 'PATCH' && refundMatch) {
    const id = Number(refundMatch[1])
    const ret = db.returns.find(r => r.id === id)
    if (!ret) fail(404, 'NOT_FOUND', 'Return record not found')
    ret.refundStatus = 'REFUNDED'
    ret.refundedAt = new Date().toISOString()
    ret.refundedById = currentUser.id
    ret.refundedByName = currentUser.fullName
    saveDb(db)
    return ret
  }

  // ---------------- PURCHASE ORDERS ----------------
  if (method === 'GET' && path === '/purchase-orders') {
    const branchId = params?.branchId ? Number(params.branchId) : (currentUser.branchId || null)
    const filtered = db.purchaseOrders.filter((po) => !branchId || po.branchId === branchId)
    return { data: filtered, page: 1, limit: 50, total: filtered.length }
  }

  if (method === 'POST' && path === '/purchase-orders') {
    const branchId = Number(body.branchId) || currentUser.branchId || 1
    const supp = db.suppliers.find(s => s.id === Number(body.supplierId))
    const br = db.branches.find(b => b.id === branchId)
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
  if (method === 'PATCH' && poApproveMatch) {
    const id = Number(poApproveMatch[1])
    const po = db.purchaseOrders.find(p => p.id === id)
    if (!po) fail(404, 'NOT_FOUND', 'Purchase order not found')
    po.status = 'APPROVED'
    po.approvedById = currentUser.id
    po.approvedByName = currentUser.fullName
    po.approvedAt = new Date().toISOString()
    saveDb(db)
    return po
  }

  const poRejectMatch = path.match(/^\/purchase-orders\/(\d+)\/reject$/)
  if (method === 'PATCH' && poRejectMatch) {
    const id = Number(poRejectMatch[1])
    const po = db.purchaseOrders.find(p => p.id === id)
    if (!po) fail(404, 'NOT_FOUND', 'Purchase order not found')
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
    const id = Number(poReceiveMatch[1])
    const po = db.purchaseOrders.find(p => p.id === id)
    if (!po) fail(404, 'NOT_FOUND', 'Purchase order not found')
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
    const branchId = params?.branchId ? Number(params.branchId) : (currentUser.branchId || null)
    const filtered = db.transfers.filter((t) => !branchId || t.fromBranchId === branchId || t.toBranchId === branchId)
    return { data: filtered, page: 1, limit: 50, total: filtered.length }
  }

  if (method === 'POST' && path === '/transfers') {
    const fromBranch = db.branches.find(b => b.id === Number(body.fromBranchId))
    const toBranch = db.branches.find(b => b.id === Number(body.toBranchId))
    if (!fromBranch || !toBranch) fail(400, 'VALIDATION_ERROR', 'Branches required')

    const items = (body.items || []).map((item, idx) => {
      const p = db.products.find(x => x.id === Number(item.productId))
      return {
        id: idx + 1,
        productId: p?.id || item.productId,
        productName: p?.name || 'Item',
        sku: p?.sku || '',
        quantity: Number(item.quantity) || 1,
      }
    })

    const newTransfer = {
      id: db.transfers.length ? Math.max(...db.transfers.map(t => t.id)) + 1 : 1,
      transferNumber: `TRF-2026-${100 + db.transfers.length}`,
      fromBranchId: fromBranch.id,
      fromBranchName: fromBranch.name,
      toBranchId: toBranch.id,
      toBranchName: toBranch.name,
      status: 'REQUESTED',
      createdAt: new Date().toISOString(),
      requestedById: currentUser.id,
      requestedByName: currentUser.fullName,
      items
    }

    db.transfers.unshift(newTransfer)
    saveDb(db)
    return newTransfer
  }

  const trfApprove = path.match(/^\/transfers\/(\d+)\/approve$/)
  if (method === 'PATCH' && trfApprove) {
    const id = Number(trfApprove[1])
    const trf = db.transfers.find(t => t.id === id)
    if (!trf) fail(404, 'NOT_FOUND', 'Transfer not found')
    trf.status = 'APPROVED'
    trf.approvedById = currentUser.id
    trf.approvedByName = currentUser.fullName
    saveDb(db)
    return trf
  }

  const trfShip = path.match(/^\/transfers\/(\d+)\/ship$/)
  if (method === 'POST' && trfShip) {
    const id = Number(trfShip[1])
    const trf = db.transfers.find(t => t.id === id)
    if (!trf) fail(404, 'NOT_FOUND', 'Transfer not found')

    // Check source stock & deduct
    trf.items.forEach((item) => {
      const stock = db.branchStock.find(s => s.branchId === trf.fromBranchId && s.productId === item.productId)
      if (!stock || stock.quantity < item.quantity) {
        fail(422, 'INSUFFICIENT_STOCK', `Source branch has insufficient stock for ${item.productName}`)
      }
      stock.quantity -= item.quantity

      db.movements.unshift({
        id: Date.now() + item.id,
        date: new Date().toISOString(),
        branchId: trf.fromBranchId,
        branchName: trf.fromBranchName,
        productId: item.productId,
        productName: item.productName,
        type: 'TRANSFER_OUT',
        quantityChange: -item.quantity,
        quantityAfter: stock.quantity,
        reason: `${trf.transferNumber} to ${trf.toBranchName}`,
        user: currentUser.fullName
      })
    })

    trf.status = 'SHIPPED'
    trf.shippedById = currentUser.id
    trf.shippedByName = currentUser.fullName
    trf.shippedAt = new Date().toISOString()
    saveDb(db)
    return trf
  }

  const trfReceive = path.match(/^\/transfers\/(\d+)\/receive$/)
  if (method === 'POST' && trfReceive) {
    const id = Number(trfReceive[1])
    const trf = db.transfers.find(t => t.id === id)
    if (!trf) fail(404, 'NOT_FOUND', 'Transfer not found')

    // Add to destination stock
    trf.items.forEach((item) => {
      let stock = db.branchStock.find(s => s.branchId === trf.toBranchId && s.productId === item.productId)
      if (!stock) {
        stock = { branchId: trf.toBranchId, productId: item.productId, quantity: 0, minQuantity: 10, maxQuantity: 100 }
        db.branchStock.push(stock)
      }
      stock.quantity += item.quantity

      db.movements.unshift({
        id: Date.now() + item.id,
        date: new Date().toISOString(),
        branchId: trf.toBranchId,
        branchName: trf.toBranchName,
        productId: item.productId,
        productName: item.productName,
        type: 'TRANSFER_IN',
        quantityChange: item.quantity,
        quantityAfter: stock.quantity,
        reason: `${trf.transferNumber} from ${trf.fromBranchName}`,
        user: currentUser.fullName
      })
    })

    trf.status = 'RECEIVED'
    trf.receivedById = currentUser.id
    trf.receivedByName = currentUser.fullName
    trf.receivedAt = new Date().toISOString()
    saveDb(db)
    return trf
  }

  // ---------------- ADJUSTMENTS ----------------
  if (method === 'GET' && path === '/adjustments') {
    const branchId = params?.branchId ? Number(params.branchId) : (currentUser.branchId || null)
    const filtered = db.adjustments.filter((a) => !branchId || a.branchId === branchId)
    return { data: filtered, page: 1, limit: 50, total: filtered.length }
  }

  if (method === 'POST' && path === '/adjustments') {
    const branchId = Number(body.branchId) || currentUser.branchId || 1
    const p = db.products.find(x => x.id === Number(body.productId))
    if (!p) fail(404, 'NOT_FOUND', 'Product not found')

    let change = Number(body.quantityChange)
    if (isNaN(change) || change === 0) fail(400, 'VALIDATION_ERROR', 'Quantity change cannot be 0')

    // Enforce reasons sign rules (Contract N11)
    if (['DAMAGE', 'EXPIRY', 'LOSS'].includes(body.reason) && change > 0) {
      change = -change
    } else if (body.reason === 'OPENING_STOCK' && change < 0) {
      change = Math.abs(change)
    }

    const stock = db.branchStock.find(s => s.branchId === branchId && s.productId === p.id)
    if (stock && (stock.quantity + change < 0)) {
      fail(422, 'INSUFFICIENT_STOCK', 'Stock cannot go below 0')
    }

    if (stock) stock.quantity += change

    const adj = {
      id: db.adjustments.length ? Math.max(...db.adjustments.map(a => a.id)) + 1 : 1,
      branchId,
      branchName: db.branches.find(b => b.id === branchId)?.name || 'Branch',
      productId: p.id,
      productName: p.name,
      quantityChange: change,
      reason: body.reason,
      notes: body.notes || '',
      createdAt: new Date().toISOString(),
      createdById: currentUser.id,
      createdByName: currentUser.fullName,
    }

    db.adjustments.unshift(adj)

    db.movements.unshift({
      id: Date.now(),
      date: new Date().toISOString(),
      branchId,
      branchName: adj.branchName,
      productId: p.id,
      productName: p.name,
      type: 'ADJUSTMENT',
      quantityChange: change,
      quantityAfter: stock ? stock.quantity : 0,
      reason: body.reason,
      user: currentUser.fullName
    })

    saveDb(db)
    return adj
  }

  // ---------------- NOTIFICATIONS & LOW STOCK ----------------
  if (method === 'GET' && path === '/notifications') {
    const branchId = currentUser.branchId || null
    const notifs = db.notifications.filter(n => !branchId || n.branchId === branchId)
    const unreadCount = notifs.filter(n => !n.isRead).length
    return { data: notifs, unreadCount }
  }

  if (method === 'PATCH' && path === '/notifications/read-all') {
    db.notifications.forEach(n => { n.isRead = true })
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
  if (method === 'GET' && path === '/branches') {
    return { data: db.branches }
  }
  if (method === 'POST' && path === '/branches') {
    const newBr = { id: db.branches.length + 1, ...body, isActive: true }
    db.branches.push(newBr)
    saveDb(db)
    return newBr
  }

  if (method === 'GET' && path === '/categories') {
    return { data: db.categories }
  }
  if (method === 'POST' && path === '/categories') {
    const newCat = { id: db.categories.length + 1, name: body.name, isActive: true }
    db.categories.push(newCat)
    saveDb(db)
    return newCat
  }

  if (method === 'GET' && path === '/suppliers') {
    return { data: db.suppliers }
  }
  if (method === 'POST' && path === '/suppliers') {
    const newSupp = { id: db.suppliers.length + 1, ...body, isActive: true }
    db.suppliers.push(newSupp)
    saveDb(db)
    return newSupp
  }

  if (method === 'GET' && path === '/users') {
    return { data: db.users }
  }
  if (method === 'POST' && path === '/users') {
    const br = db.branches.find(b => b.id === Number(body.branchId))
    const newUser = {
      id: db.users.length + 1,
      username: body.username,
      fullName: body.fullName,
      role: body.role,
      branchId: body.branchId ? Number(body.branchId) : null,
      branchName: br?.name || null,
      isActive: true
    }
    db.users.push(newUser)
    saveDb(db)
    return newUser
  }

  if (method === 'GET' && path === '/audit-logs') {
    return { data: db.auditLogs }
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