import { api } from './api'

// Contract 5.4. Allowed for Admin, Manager and Staff.
// branchId is optional: when it is left out, the server uses the user's own branch.
// Rejects with ApiError code PRODUCT_NOT_FOUND when the barcode is unknown or the product is inactive.
export const lookupProductByBarcode = (barcode, branchId) =>
  api.get(`/products/by-barcode/${encodeURIComponent(barcode)}`, { branchId })