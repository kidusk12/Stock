import { ApiError } from './apiError'
import { tokenStore } from './tokenStore'

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

  // Lets you test the "session ended" behaviour
  if (method === 'GET' && path === '/_test/unauthenticated') fail(401, 'UNAUTHENTICATED', 'Not logged in')

  return fail(404, 'NOT_FOUND', `No mock for ${method} ${path}`)
}