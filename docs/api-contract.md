# API Contract - Multi-Branch Stock Management System

**Version:** v5  
**Status:** Core modules implemented

---

## 1. General Rules

### 1.1 Request & Response Format

- All requests and responses use `application/json`.
- Single records are returned as plain objects: `{ "id": 1, "name": "..." }`.
- Lists are returned as paginated objects: `{ "data": [], "page": 1, "limit": 100, "total": 0 }`.
- Database `Decimal` values (prices, quantities) are returned as **numbers**, not strings.
- Empty fields (like optional addresses) return as `null`.

### 1.2 Authentication & Headers

- All endpoints (except `/api/auth/login` and `/api/health`) require a Bearer token in the header: `Authorization: Bearer <token>`.
- A missing or expired token returns `401 UNAUTHENTICATED`.

### 1.3 Roles & Permissions

- **ADMIN**: Full access to all branches. Can write everything.
- **BRANCH_MANAGER**: Read/write access to their own branch only. Can write suppliers.
- **STAFF**: Read access to their own branch. Can read suppliers. Cannot write products, branches, categories, or suppliers.
- **AUDITOR**: Read-only access to all branches. Any `POST`, `PATCH`, or `PUT` request returns `403 FORBIDDEN`.

### 1.4 Error Format & Validation

All errors return the following JSON structure:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input",
    "details": [
      { "field": "sellingPrice", "rule": "min", "issue": "must be 0 or more" }
    ]
  }
}
```

**Common Error Codes:**

- `VALIDATION_ERROR` (400)
- `UNAUTHENTICATED` (401)
- `FORBIDDEN` (403)
- `NOT_FOUND` (404)
- `DUPLICATE_VALUE` (409)
- `DUPLICATE_SKU` (409)
- `DUPLICATE_BARCODE` (409)
- `PRODUCT_NOT_FOUND` (404)

### 1.5 Pagination, Search & Sorting

- **Pagination:** `?page=1&limit=100`. Default limit is 100.
- **Search:** `?q=text` (case-insensitive).
- **Sorting:** `?sort=name` (ascending) or `?sort=-name` (descending). Adding an invalid sort field returns `400 VALIDATION_ERROR`.

---

## 2. Authentication (Implemented by Kidus)

- `POST /api/auth/login` - Public. Body: `{ "username": "...", "password": "..." }`. Returns `{ "token": "...", "user": { ... } }`.
- `GET /api/auth/me` - Requires token. Returns current user profile.

---

## 3. Users (Implemented by Kidus)

- Admin only for writes. Manages system users.

---

## 4. Stock & Movements (Implemented by Kidus)

- `GET /api/stock`
- `GET /api/stock/consolidated`
- `PUT /api/stock/:branchId/:productId/thresholds`
- `GET /api/stock-movements`

---

## 5. Master Data (Implemented by Hemen)

### 5.1 Branches

**Branch Object:**

```json
{
  "id": 1,
  "name": "Main Branch",
  "code": "MAIN",
  "address": "Addis Ababa",
  "phone": "+251911...",
  "isActive": true
}
```

- `GET /api/branches` - All roles. Query: `q`, `includeInactive`, `sort`, `page`, `limit`.
- `GET /api/branches/:id` - All roles.
- `POST /api/branches` - Admin only. Body: `{ "name": "...", "code": "...", "address": "...", "phone": "..." }`.
  - **Rules:** `code` is required (1-20 chars, no spaces). Duplicate name/code returns `409 DUPLICATE_VALUE`. Creating a branch automatically creates a quantity-0 stock row for every existing product.
- `PATCH /api/branches/:id` - Admin only. Body: Any field including `isActive`.

### 5.2 Categories

**Category Object:**

```json
{ "id": 1, "name": "Beverages", "isActive": true }
```

- `GET /api/categories` - All roles. Query: `q`, `includeInactive`, `sort`, `page`, `limit`.
- `GET /api/categories/:id` - All roles.
- `POST /api/categories` - Admin only. Body: `{ "name": "..." }` (1-100 chars).
- `PATCH /api/categories/:id` - Admin only. Body: `{ "name": "...", "isActive": false }`.

### 5.3 Suppliers

**Supplier Object:**

```json
{
  "id": 1,
  "name": "Supplier Inc",
  "contactName": "John",
  "phone": "...",
  "tin": "12345",
  "address": "...",
  "isActive": true
}
```

- `GET /api/suppliers` - Admin, Branch Manager, Staff. Query: `q` (name or TIN), `includeInactive`, `sort`, `page`, `limit`.
- `GET /api/suppliers/:id` - Admin, Branch Manager, Staff.
- `POST /api/suppliers` - Admin and Branch Manager only. Body: `{ "name": "..." }`. Name is required (1-150 chars). Duplicate names are allowed.
- `PATCH /api/suppliers/:id` - Admin and Branch Manager only.

### 5.4 Products

**Product Object:**

```json
{
  "id": 12,
  "name": "Coca-Cola",
  "sku": "BEV-01",
  "barcode": "123456",
  "categoryId": 3,
  "categoryName": "Beverages",
  "unit": "bottle",
  "costPrice": 18.0,
  "sellingPrice": 25.0,
  "isActive": true
}
```

_Note: `costPrice` is **omitted** entirely for the STAFF role (N7). `quantity` is added only when a branch context applies._

- `GET /api/products` - All roles. Query: `q` (name, sku, barcode), `categoryId`, `branchId`, `includeInactive`, `sort`, `page`, `limit`.
  - **Branch Context:** If `branchId` is provided (Admin/Auditor) or a Staff/Manager makes the request (own branch), a `quantity` field is added to the response.
- `GET /api/products/by-barcode/:barcode` - Admin, Branch Manager, Staff (Auditor gets 403).
- `GET /api/products/:id` - All roles.
- `POST /api/products` - Admin only. Body: `{ "name": "...", "sku": "...", "barcode": "...", "categoryId": 1, "unit": "...", "costPrice": 10, "sellingPrice": 15 }`.
  - **Rules:** `sku` is required (1-50 chars, no spaces). `barcode` is optional. Prices must be 0 or more, max 2 decimals. Duplicate SKU/Barcode returns `409 DUPLICATE_SKU` or `409 DUPLICATE_BARCODE`. Creating a product automatically creates a quantity-0 stock row for every branch.
- `PATCH /api/products/:id` - Admin only.

---

## 12. Build Status

### 12.2 Status Table

| Module / Feature Area       | Owner | Status     | Notes                           |
| --------------------------- | ----- | ---------- | ------------------------------- |
| Auth & Users                | Kidus | ✅ Done    | JWT, roles, blockAuditorWrites  |
| Stock & Movements           | Kidus | ✅ Done    | stockService.js, alerts         |
| Categories                  | Hemen | ✅ Done    | Contract 5.2, tests passing     |
| Branches                    | Hemen | ✅ Done    | Contract 5.1, K6 stock rows     |
| Suppliers                   | Hemen | ✅ Done    | Contract 5.3, TIN search        |
| Products                    | Hemen | ✅ Done    | Contract 5.4, barcode lookup    |
| Audit Log                   | Kidus | ⏳ Pending | Audit calls in services pending |
| Purchases, Sales, Transfers | Kidus | ⏳ Pending |                                 |
