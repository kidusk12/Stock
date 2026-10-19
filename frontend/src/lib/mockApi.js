import { ApiError } from './apiError'
import { tokenStore } from './tokenStore'
import { roundMoney } from './money'

const delay = (ms = 250) => new Promise((resolve) => setTimeout(resolve, ms))
const fail = (status, code, message) => {
  throw new ApiError({ status, code, message })
}

// Mock users. Log in with any password.
const USERS = {
  admin: { id: 1, username: 'admin', fullName: 'Abebe Kebede', role: 'ADMIN', branchId: null, branchName: null },
  manager: { id: 2, username: 'manager', fullName: 'Marta Alemu', role: 'BRANCH_MANAGER', branchId: 1, branchName: 'Bole Branch' },
  staff: { id: 3, username: 'staff', fullName: 'Dawit Haile', role: 'STAFF', branchId: 1, branchName: 'Bole Branch' },
  auditor: { id: 4, username: 'auditor', fullName: 'Yonas Bekele', role: 'AUDITOR', branchId: null, branchName: null },
}

// Selling prices INCLUDE tax (contract T1). quantity = stock in the user's branch.
const p = (id, name, sku, barcode, categoryName, unit, costPrice, sellingPrice, quantity) => ({
  id, name, sku, barcode, categoryId: 1, categoryName, unit, costPrice, sellingPrice, isActive: true, quantity,
})
const PRODUCTS = [
  p(1, 'Sugar 50kg', 'SUG-50', '6001001', 'Food', 'bag', 3000, 3500, 17),
  p(2, 'Cooking Oil 5L', 'OIL-5L', '6001002', 'Food', 'carton', 1100, 1300, 50),
  p(3, 'Teff 25kg', 'TEF-25', '6001003', 'Grain', 'bag', 3800, 4200, 40),
  p(4, 'Pasta 500g', 'PAS-500', '6001004', 'Food', 'pack', 35, 45, 300),
  p(5, 'Laundry Soap', 'SOA-01', '6001005', 'Household', 'piece', 20, 28, 0),
]

const BRANCHES = [
  { id: 1, name: 'Bole Branch', code: 'BOLE', address: 'Bole, Addis Ababa', phone: '+251911000000', isActive: true },
  { id: 2, name: 'Piassa Branch', code: 'PIASSA', address: 'Piassa, Addis Ababa', phone: '+251911000001', isActive: true },
]

let lastInvoiceNumber = 44 // the first mock sale gets INV-000045, like the contract example
const currentUser = () => USERS[(tokenStore.get() || '').replace('mock-', '')]

export async function mockRequest(method, path, { body, params } = {}) {
  await delay()

  if (method === 'POST' && path === '/auth/login') {
    const user = USERS[body?.username]
    if (!user || !body?.password) fail(401, 'INVALID_CREDENTIALS', 'Wrong username or password')
    return {
      token: `mock-${user.username}`,
      expiresAt: new Date(Date.now() + 8 * 3600 * 1000).toISOString(),
      user,
    }
  }

  if (method === 'GET' && path === '/auth/me') {
    const user = USERS[(tokenStore.get() || '').replace('mock-', '')]
    if (!user) fail(401, 'UNAUTHENTICATED', 'Not logged in')
    return user
  }

  if (method === 'POST' && path === '/auth/logout') return { success: true }

  if (method === 'GET' && path === '/products') {
    const q = String(params?.q ?? '').toLowerCase()
    const page = Number(params?.page) || 1
    const limit = Number(params?.limit) || 20
    const rows = q
      ? PRODUCTS.filter((x) => [x.name, x.sku, x.barcode].some((v) => v.toLowerCase().includes(q)))
      : PRODUCTS
    return { data: rows.slice((page - 1) * limit, page * limit), page, limit, total: rows.length }
  }

  const byBarcode = path.match(/^\/products\/by-barcode\/(.+)$/)
  if (method === 'GET' && byBarcode) {
    const found = PRODUCTS.find((x) => x.barcode === byBarcode[1])
    if (!found) fail(404, 'PRODUCT_NOT_FOUND', 'No product with this barcode')
    return found
  }

    if (method === 'GET' && path === '/branches') return BRANCHES

  if (method === 'POST' && path === '/sales') {
    const me = currentUser()
    if (!me) fail(401, 'UNAUTHENTICATED', 'Not logged in')
    const items = body?.items
    if (!body?.branchId || !Array.isArray(items) || items.length === 0) {
      fail(400, 'VALIDATION_ERROR', 'branchId and at least one item are required')
    }

    const lines = items.map((item, index) => {
      const product = PRODUCTS.find((x) => x.id === item.productId)
      if (!product) fail(404, 'NOT_FOUND', `Product ${item.productId} not found`)
      if (!Number.isInteger(item.quantity) || item.quantity < 1) {
        fail(400, 'VALIDATION_ERROR', 'Quantity must be at least 1')
      }
      if (item.quantity > product.quantity) {
        throw new ApiError({
          status: 422,
          code: 'INSUFFICIENT_STOCK',
          message: `Not enough stock for product ${product.id}`,
          details: [{ field: `items[${index}].quantity`, issue: `available ${product.quantity}, requested ${item.quantity}` }],
        })
      }
      return { product, quantity: item.quantity }
    })

    // Everything checked: now deduct stock (the mock shares one stock level between branches)
    lines.forEach((line) => {
      line.product.quantity -= line.quantity
    })

    // Prices include tax (contract T1): the tax is worked out of the total, nothing is added on top
    const taxRate = 15
    const saleItems = lines.map((line, i) => ({
      id: 400 + i,
      productId: line.product.id,
      productName: line.product.name,
      quantity: line.quantity,
      unitPrice: line.product.sellingPrice,
      lineTotal: roundMoney(line.product.sellingPrice * line.quantity),
    }))
    const total = roundMoney(saleItems.reduce((sum, i) => sum + i.lineTotal, 0))
    const taxAmount = roundMoney((total * taxRate) / (100 + taxRate))
    lastInvoiceNumber += 1
    const branch = BRANCHES.find((b) => b.id === body.branchId)

    return {
      id: 300 + lastInvoiceNumber,
      invoiceNumber: `INV-${String(lastInvoiceNumber).padStart(6, '0')}`,
      branchId: body.branchId,
      branchName: branch ? branch.name : '',
      customerName: body.customerName || null,
      createdBy: { id: me.id, name: me.fullName },
      items: saleItems,
      netAmount: roundMoney(total - taxAmount),
      taxType: 'VAT',
      taxRate,
      taxAmount,
      total,
      createdAt: new Date().toISOString(),
    }
  }

  // Lets you test the "session ended" behaviour
  if (method === 'GET' && path === '/_test/unauthenticated') fail(401, 'UNAUTHENTICATED', 'Not logged in')

  return fail(404, 'NOT_FOUND', `No mock for ${method} ${path}`)
}