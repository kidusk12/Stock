# API Contract: Multi-Branch Stock Management System (Version 5)

**Owner:** Makda (Backend API) | **Version:** v0.5 DRAFT (includes Week 2) | **Date:** 15 October 2026
**Source:** SRS (October 2026), Team Plan, Kidus's decisions K1-K7, the review comments on v0.1, the Team Decisions T1-T9 (Kidus, team lead), the answers from Melat (M1, M2) and Hemen (H1-H6 and his three requests), and a check of the repo (`dev` branch, 15 October 2026).
Items marked **(proposed)** are my suggestions where nothing has been decided. Items marked **(TBC)** need an answer from the named person.

This file lives at `docs/api-contract.md`.

**Change process.** The contract changes only by pull request. A change that touches a **data field** needs Kidus's approval. A change to a request or response used by a screen needs Hemen's or Melat's approval. **Week 2 shapes** were planned to lock on Friday 9 October 2026. They lock when Kidus, Hemen and Melat have approved them and Kidus has answered his open questions (K-A to K-I in section 13). Silence means agreement. Kidus makes the final call on anything still open. Items that belong to Week 3 or 4 are filled in when those weeks start.

---

## 0. What changed in v0.5

Everything from v0.1 to v0.4 stays (see the change log in 12.1). Nothing in a request or response shape changed in this version. v0.5 does four things:

| # | Change | Source |
|---|---|---|
| 1 | **Week 2 is fully included.** Section 6 has the complete Week 2 contract: shared rules (6.0), company settings, stock, notifications, purchase orders, sales, adjustments, audit log, transfers (6.1 to 6.9), 13 acceptance scenarios for the Friday check (6.10), and the map from API fields to database fields (6.11). | Team Plan Week 2 |
| 2 | **Build status added** (12.2): what exists in the repo today for every part of the contract, which branches are not merged, and where the code differs from the contract. | Repo check, 15 Oct |
| 3 | **`GET /api/health` added** to the contract (section 3). The code and the README return `{ "data": { "status": "ok" } }`, which does not follow the plain-object rule, so the contract fixes the shape and the code must follow. | Repo check |
| 4 | **Open items refreshed** (section 13): the repo findings are listed as actions R1 to R6, and one new item for Hemen (H9). | Repo check |

---

## 1. Global rules

### 1.1 Base URL and format
- All endpoints start with `/api`. Requests and responses are JSON (`Content-Type: application/json`), except file uploads (`multipart/form-data`) and CSV downloads (`text/csv`).
- Field names are **camelCase**.
- Every record has an integer `id` (auto-increment). Foreign keys are named `<entity>Id` (`branchId`, `productId`, `userId`).
- Records that can change have `createdAt` and `updatedAt`. They are returned on every record and are not repeated in the examples.

### 1.2 Authentication
- Every endpoint except `POST /api/auth/login` needs the header `Authorization: Bearer <token>`.
- The token carries `userId`, `role` and `branchId`. The server checks permissions on every request. Hiding a button in the UI does not count.
- **On every request the server also loads the user from the database** and checks that the account is active. A user who was deactivated is blocked on their next request, even if their token has not expired. The server uses the user's current role and branch from the database, not the values inside the token.

### 1.3 Roles
| Role value | Name | Branch scope |
|---|---|---|
| `ADMIN` | Admin | All branches, full control |
| `BRANCH_MANAGER` | Branch Manager | Own branch only |
| `STAFF` | Staff (storekeeper and cashier duties) | Own branch only |
| `AUDITOR` | Auditor | All branches, **read-only** |

**Branch rule:** for `BRANCH_MANAGER` and `STAFF`, any `branchId` in the request must be their own branch, otherwise `403 FORBIDDEN`. If they leave an optional `branchId` out, the server uses their own. Exception: transfers involve two branches (see 6.9).

**Auditor rule:** one middleware rejects every `POST`, `PUT`, `PATCH` and `DELETE` from an `AUDITOR` with `403 FORBIDDEN`. Only two exceptions: `POST /api/auth/change-password` and `POST /api/auth/logout`.

### 1.4 Error format (one shape for every error)
```json
{
  "error": {
    "code": "INSUFFICIENT_STOCK",
    "message": "Not enough stock for product 12 at branch 1.",
    "details": [{ "field": "items[0].quantity", "productId": 12, "available": 5, "requested": 8 }]
  }
}
```
- `code` is stable and in English. **The frontend maps `code` to a translation key** to show Amharic or English text. `message` is for developers and logs only.
- `details` is optional. Every entry has a `field`. The other keys are **numbers and codes the frontend can use directly**, so it never has to read English text:

| Error code | Keys in each `details` entry |
|---|---|
| `INSUFFICIENT_STOCK` | `field`, `productId`, `available`, `requested`. One entry for **every** short item, not only the first. For an adjustment or a shipment, `requested` is the amount that would be taken out (a positive number). |
| `OVER_RECEIVE` | `field`, `itemId`, `remaining`, `requested` |
| `RETURN_EXCEEDS_SOLD` | `field`, `saleItemId`, `returnable`, `requested` |
| `VALIDATION_ERROR` | `field`, `rule` (`required`, `invalid`, `min`, `max`, `too_short`, `too_long`, `duplicate`, `inactive`, `must_be_negative`), and `issue` (an English hint for developers only) **(proposed `rule` values, H8)** |
- **Session rule for the frontend (confirmed by Hemen):** log the user out only when `code` is `UNAUTHENTICATED` or `ACCOUNT_DISABLED`. Do not log out on `INVALID_CREDENTIALS` or `WRONG_CURRENT_PASSWORD`, and do not treat every 401 as "session expired".

| HTTP | Code | Meaning |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Missing or invalid input |
| 400 | `WRONG_CURRENT_PASSWORD` | Current password is wrong (change-password only) |
| 400 | `INVALID_QUANTITY` | The stock service rejected a quantity (zero, more than 2 decimals, or wrong sign for the movement type). The API validates first, so the frontend normally sees `VALIDATION_ERROR` instead. |
| 401 | `UNAUTHENTICATED` | No token, bad token or expired token |
| 401 | `INVALID_CREDENTIALS` | Wrong username or password (login only) |
| 403 | `FORBIDDEN` | Logged in, but role or branch is not allowed |
| 403 | `ACCOUNT_DISABLED` | User is deactivated (at login, or on the next request after deactivation) |
| 404 | `NOT_FOUND` | Record does not exist |
| 404 | `PRODUCT_NOT_FOUND` | Barcode lookup found nothing |
| 409 | `DUPLICATE_SKU` | SKU already used |
| 409 | `DUPLICATE_BARCODE` | Barcode already used |
| 409 | `DUPLICATE_VALUE` | Other unique field already used (username, etc.) |
| 409 | `INVALID_STATUS` | Action not allowed in the current status |
| 422 | `INSUFFICIENT_STOCK` | Stock would go negative (thrown by `applyMovement`) |
| 422 | `OVER_RECEIVE` | Receiving more than ordered |
| 422 | `RETURN_EXCEEDS_SOLD` | Return quantity above sold minus already returned |
| 500 | `SERVER_ERROR` | Unexpected bug |

### 1.5 Conventions
- **One name for amounts:** `quantity` everywhere. Related names: `receivedQuantity`, `returnedQuantity`, `minQuantity`, `maxQuantity`, `totalQuantity`. The only exception is the stock movement record, which keeps Kidus's stored names `quantityChange` and `quantityAfter` (see 6.3).
- **One shape for "who did it":** an object `{ "id": 2, "name": "Abel Tesfaye" }` (`name` is the user's full name). Used for `createdBy` and for step fields such as `approvedBy`, `shippedBy`, each with a matching `...At` timestamp. Filters still use `?userId=`.
- **Dates and times:** the database and every response use ISO 8601 UTC, e.g. `2026-10-05T09:30:00Z`. The frontend shows times in Ethiopia time (UTC+3), converted to the Ethiopian calendar for display.
- **Date filters and "today":** a date sent as `YYYY-MM-DD` means that day in **Ethiopia time** (from 00:00 to 23:59:59 at UTC+3). The server converts it to UTC. "Today" on the dashboard also means today in Ethiopia time. Ethiopia has no daylight saving, so nothing seasonal applies.
- **Money:** JSON numbers in birr with 2 decimals, e.g. `125.50`.
- **Pagination:** lists accept `?page=1&limit=20` (default 20, max 100) and return:
  ```json
  { "data": [ ... ], "page": 1, "limit": 20, "total": 134 }
  ```
- **Search:** `?q=` searches the text fields named in each endpoint.
- **Sorting:** `?sort=field` or `?sort=-field` for descending. Allowed fields are listed in 1.9. Default sort is stated per endpoint.
- **Response shapes:** a single record is a plain object. A list is `{ data, page, limit, total }`. See 1.9.
- **Stable values:** every enum value (role, status, type, reason, audit action) and every error `code` is a stable `UPPER_SNAKE_CASE` string. The frontend builds translation keys directly from them (for example `status.po.${status}` and `errors.${code}`). Adding, renaming or removing a value needs the same approval as a data-field change.
- **Deactivate, not delete:** users, branches, products, suppliers and categories are never deleted. Use `isActive: false`. Lists return active records by default. Add `?includeInactive=true` to see all.
- **Stock is never written directly.** Every stock change goes through the stock service `applyMovement` (see 1.7). Endpoints below that change stock say so.

### 1.6 Permissions table (final, Team Decision T2)
**This table is the single source of truth for the "Who" of every endpoint.** "Own" means the user's own branch only. Where Manager or Staff is "Yes" on a branch-bound action, it also applies to their own branch only. In the endpoint sections, `A` = Admin, `M` = Branch Manager, `S` = Staff, `U` = Auditor.

| Action | Admin | Manager | Staff | Auditor |
|---|---|---|---|---|
| Company settings, VAT/TOT type and rate | Yes | No | No | No |
| Users and roles | Yes | No | No | No |
| Branches | Yes | No | No | No |
| Create / edit products and prices, categories | Yes | No | No | No |
| Suppliers | Yes | Yes | No | No |
| CSV import | Yes | No | No | No |
| Set minimum stock level (per product, per branch) | Yes | Own | No | No |
| Create purchase order | Yes | Yes | Yes | No |
| Approve / reject purchase order | Yes | Own | No | No |
| Receive goods | Yes | Yes | Yes | No |
| Sales and invoices | Yes | Yes | Yes | No |
| Customer returns (create) | Yes | Yes | Yes | No |
| Mark a return as refunded | Yes | Yes | Yes | No |
| Stock adjustments (create) | Yes | Yes | Yes | No |
| Request a transfer (destination branch) | Yes | Yes | Yes | No |
| Approve / reject transfer (source branch) | Yes | Own | No | No |
| Ship transfer (source) / receive transfer (destination) | Yes | Yes | Yes | No |
| View stock, movements, adjustments | Yes | Own | Own | All, read-only |
| Reports | Yes | Own | No | All, read-only |
| Audit log | Yes | Own | No | All, read-only |
| Low-stock notifications | Yes | Own | No | No |
| Dashboard, change own password | Yes | Yes | Yes | Yes |

**Not covered by the team table. I applied these proposals and listed them in section 13 for confirmation:**
- **Reading reference data** (branches, categories, products): all roles, because forms, filters and the sales screen need it. Reading suppliers: A, M, S, because Staff pick a supplier when they create a PO.
- **Viewing purchase orders, transfers, returns, and the sales list and invoices:** A (all), M (own), S (own). The Auditor gets no access, matching the "No" for sales and invoices.
- **Notifications and the low-stock page** follow the row "Low-stock notifications": A, M (own).

### 1.7 Stock service (Kidus, `backend/src/services/stockService.js`)
Every endpoint that changes stock calls:
```
applyMovement({ productId, branchId, quantity, type, reason, referenceType, referenceId, userId }, tx)
  ->  { movementId, quantityBefore, quantityAfter, lowStockAlert }
```
- **`quantity` is signed** (decided by the code). Positive adds stock, negative removes it. It cannot be 0 and has at most 2 decimals.
- **The sign must match `type`:** `OPENING_STOCK`, `PURCHASE_RECEIPT`, `CUSTOMER_RETURN` and `TRANSFER_IN` must be positive. `SALE` and `TRANSFER_OUT` must be negative. `ADJUSTMENT` may be either.
- **`tx` is the caller's transaction.** Always pass it, so the stock change and the record (sale, PO, transfer) commit or roll back together.
- It locks the stock row (`SELECT ... FOR UPDATE`), so two sales cannot both take the last unit. It writes the stock movement, and it creates the low-stock notification when the rule in 6.4 applies. **The API never creates notifications itself.**
- If stock would go negative it throws `INSUFFICIENT_STOCK` (422). Its message contains the available quantity, but **not** the `details` array in 1.4. The API therefore checks stock first for all items (see 6.6) and builds `details` itself.
- `referenceType` values used by the API: `SALE`, `PURCHASE_ORDER`, `TRANSFER`, `ADJUSTMENT`, `RETURN`. `referenceId` is the id of that record.
- Movement `type` values: `OPENING_STOCK`, `PURCHASE_RECEIPT`, `SALE`, `CUSTOMER_RETURN`, `ADJUSTMENT`, `TRANSFER_OUT`, `TRANSFER_IN`.

### 1.8 Stock rows exist for every product and branch
- When a **product** is created, the server creates a stock row with `quantity` 0 for **every branch**.
- When a **branch** is created, it gets a stock row with `quantity` 0 for **every product**.
- Both happen in the same transaction as the create. So `GET /api/stock` always returns a row for each product and branch, and stock lookups never return "no row".

### 1.9 Response shapes and sorting

**Response shapes (confirmed):**

| Case | Shape |
|---|---|
| One record (`GET /api/products/:id`, `POST` create, `PATCH` update) | The plain object, with no wrapper |
| Action on a record (`approve`, `reject`, `ship`, `receive`, `refund`) | The updated record as a plain object |
| A list (any `GET` of many records) | `{ "data": [ ... ], "page": 1, "limit": 20, "total": 134 }` |
| A list with an extra summary | The same list shape plus extra top-level keys: `unreadCount` on notifications, `totals` on reports |
| A report or dashboard | A plain object (the dashboard) or the list shape with `totals` (reports) |
| A simple confirmation (logout, change password, mark notification read) | `{ "success": true }` |
| Any error | `{ "error": { ... } }` (see 1.4) |

All lists use the list shape, including branches and categories. Their default `limit` is **100**, so the whole list normally arrives on one page. Every other list defaults to 20. The maximum is 100.

**Sorting.** `?sort=field` sorts ascending and `?sort=-field` sorts descending. A field that is not allowed returns `400 VALIDATION_ERROR`.

| List | Allowed `sort` fields | Default |
|---|---|---|
| Products | `name`, `sku`, `sellingPrice` | `name` |
| Suppliers | `name` | `name` |
| Users | `fullName` | `fullName` |
| Branches, categories | `name` | `name` |
| Stock, low stock, consolidated stock | none | `productName` |
| Every other list (movements, POs, sales, adjustments, transfers, returns, audit log, notifications) | none | `-createdAt` (newest first) |

---

## 2. Endpoint overview

"Who" follows the permissions table in 1.6. **(p)** marks a proposal for something the table does not cover.

| # | Method | URL | Who | Week |
|---|---|---|---|---|
| 0 | GET | `/api/health` | Anyone | 1 |
| 1 | POST | `/api/auth/login` | Anyone | 1 |
| 2 | GET | `/api/auth/me` | All | 1 |
| 3 | POST | `/api/auth/change-password` | All | 1 |
| 4 | POST | `/api/auth/logout` | All | 1 |
| 5 | GET, POST | `/api/users` | A | 1 |
| 6 | GET, PATCH | `/api/users/:id` | A | 1 |
| 7 | POST | `/api/users/:id/reset-password` | A | 1 |
| 8 | GET, POST | `/api/branches` | GET all (p), POST A | 1 |
| 9 | GET, PATCH | `/api/branches/:id` | GET all (p), PATCH A | 1 |
| 10 | GET, POST | `/api/categories` | GET all (p), POST A | 1 |
| 11 | PATCH | `/api/categories/:id` | A | 1 |
| 12 | GET, POST | `/api/suppliers` | GET A, M, S (p), POST A, M | 1 |
| 13 | GET, PATCH | `/api/suppliers/:id` | GET A, M, S (p), PATCH A, M | 1 |
| 14 | GET, POST | `/api/products` | GET all (p), POST A | 1 |
| 15 | GET, PATCH | `/api/products/:id` | GET all (p), PATCH A | 1 |
| 16 | GET | `/api/products/by-barcode/:barcode` | A, M, S | 1 |
| 17 | GET, PUT | `/api/settings/company` | A | 2 |
| 18 | GET | `/api/stock` | A, M own, S own, U all | 2 |
| 19 | GET | `/api/stock/consolidated` | A, U | 2 |
| 20 | PUT | `/api/stock/:branchId/:productId/thresholds` | A, M own | 2 |
| 21 | GET | `/api/stock-movements` | A, M own, S own, U all | 2 |
| 22 | GET, POST | `/api/purchase-orders` | GET A, M own, S own (p), POST A, M, S | 2 |
| 23 | GET | `/api/purchase-orders/:id` | A, M own, S own (p) | 2 |
| 24 | POST | `/api/purchase-orders/:id/approve`, `/reject` | A, M own | 2 |
| 25 | POST | `/api/purchase-orders/:id/receive` | A, M, S | 2 |
| 26 | GET, POST | `/api/sales` | A, M, S | 2 |
| 27 | GET | `/api/sales/:id` (invoice) | A, M, S | 2 |
| 28 | GET, POST | `/api/adjustments` | GET A, M own, S own, U all; POST A, M, S | 2 |
| 29 | GET, POST | `/api/transfers` | GET A, M own, S own (p); POST A, M, S (destination) | 2 |
| 30 | GET | `/api/transfers/:id` | A, M own, S own (p) | 2 |
| 31 | POST | `/api/transfers/:id/approve`, `/reject` | A, M (source) | 2 |
| 32 | POST | `/api/transfers/:id/ship` (source), `/receive` (destination) | A, M, S | 2 |
| 33 | GET | `/api/notifications` | A, M own | 2 |
| 34 | POST | `/api/notifications/:id/read`, `/api/notifications/read-all` | A, M own | 2 |
| 35 | GET | `/api/low-stock` | A, M own | 2 |
| 36 | GET | `/api/audit-logs` | A, M own, U all | 2-3 |
| 37 | GET | `/api/dashboard` | All (role-based) | 3 |
| 38 | GET | `/api/reports/stock`, `/sales`, `/movements` | A, M own, U all | 3 |
| 39 | POST | `/api/sales/:id/returns` | A, M, S | 3 |
| 40 | GET | `/api/returns`, `/api/returns/:id` | A, M own, S own (p) | 3 |
| 41 | PATCH | `/api/returns/:id/refund` | A, M, S | 3 |
| 42 | GET, POST | `/api/import/products/template`, `/api/import/products?dryRun=` | A | 3 |

**Scope rule:** `ADMIN` and `AUDITOR` may read any branch they have access to (filter with `?branchId=`). `BRANCH_MANAGER` and `STAFF` always get their own branch only.

---

## 3. Authentication (Week 1)

### GET /api/health
**Purpose:** Check that the server is running. No token needed.
Success (200): `{ "status": "ok" }`. This is a plain object like every other single record (1.9).
**Today the code and the README return `{ "data": { "status": "ok" } }`.** Both must change to match this contract. Nothing in the frontend depends on it yet.

### POST /api/auth/login
**Purpose:** Log in with username and password.
**Who:** Anyone (no token).

Request:
```json
{ "username": "kidus", "password": "secret123" }
```
Success (200):
```json
{
  "token": "<jwt>",
  "expiresAt": "2026-10-06T09:30:00Z",
  "user": {
    "id": 1,
    "username": "kidus",
    "fullName": "Kidus Bekele",
    "role": "ADMIN",
    "branchId": null,
    "branchName": null
  }
}
```
- `branchId` is `null` for Admin and Auditor. The frontend uses `role` and `branchId` for the sidebar.
- Token lifetime: 8 hours. There are no refresh tokens and none will be built (decided, T5).

Errors: `400 VALIDATION_ERROR`, `401 INVALID_CREDENTIALS`, `403 ACCOUNT_DISABLED`.

### GET /api/auth/me
**Purpose:** Return the current user (same `user` object as login). Used to restore a session after reload.
Errors: `401 UNAUTHENTICATED`.

### POST /api/auth/change-password
**Who:** All roles, including Auditor.
Request: `{ "currentPassword": "old", "newPassword": "newSecret456" }`
Success (200): `{ "success": true }`
Errors:
- `400 WRONG_CURRENT_PASSWORD`: the current password is wrong. This is **not** a 401, so the frontend does not log the user out.
- `400 VALIDATION_ERROR`: new password under 8 characters (decided, T5).

### POST /api/auth/logout
**Purpose:** Tells the server the user logged out. The server writes `USER_LOGOUT` to the audit log. The frontend then deletes the token. Tokens are stateless.
Success (200): `{ "success": true }`

---

## 4. Users (Week 1)

All user endpoints: **Admin only**.

### GET /api/users
Query: `?q=` (username or full name), `?role=`, `?branchId=`, `?includeInactive=true`, `?page`, `?limit`. Default sort: `fullName`.
Success (200): paginated list of:
```json
{ "id": 2, "username": "abel", "fullName": "Abel Tesfaye", "role": "STAFF",
  "branchId": 1, "branchName": "Bole Branch", "isActive": true }
```
The password hash is never returned.

### POST /api/users
Request:
```json
{ "username": "abel", "fullName": "Abel Tesfaye", "password": "temp12345",
  "role": "STAFF", "branchId": 1 }
```
- `branchId` is required for `BRANCH_MANAGER` and `STAFF`, and must be `null` or omitted for `ADMIN` and `AUDITOR`.

Success (201): the user object.
Errors: `400 VALIDATION_ERROR`, `409 DUPLICATE_VALUE` (username taken), `404 NOT_FOUND` (branch).

### GET /api/users/:id
Success (200): the user object. Errors: `404 NOT_FOUND`.

### PATCH /api/users/:id
Request (any of): `{ "fullName", "role", "branchId", "isActive" }`
- `isActive: false` deactivates the user. A deactivated user cannot log in. An Admin cannot deactivate their own account.

Success (200): the updated user. Errors: `400`, `404`, `409 DUPLICATE_VALUE`.

### POST /api/users/:id/reset-password
Request: `{ "newPassword": "temp12345" }`. Success (200): `{ "success": true }`.

---

## 5. Master data (Week 1)

**Write access:** Admin only for branches, categories and products (price is company-wide). Suppliers: Admin and Branch Manager. **Read access** (proposed, see section 13): all roles for branches, categories and products; A, M, S for suppliers. CSV import is Admin only (section 10).

### 5.1 Branches
Fields (from Kidus): `id`, `name`, `code`, `address`, `phone`, `isActive`, `createdAt`, `updatedAt`.

`GET /api/branches` Query: `?q=`, `?includeInactive=true`. Uses the standard list shape. The default `limit` is 100, so the whole list normally arrives on one page.
```json
{ "id": 1, "name": "Bole Branch", "code": "BOLE", "address": "Bole, Addis Ababa",
  "phone": "+251911000000", "isActive": true }
```
`POST /api/branches` Request: `{ "name", "code", "address", "phone" }` (`name` required). Success 201.
- **Side effect:** creates a stock row with `quantity` 0 for every product (see 1.8).

`GET /api/branches/:id`, `PATCH /api/branches/:id` (any field, including `isActive`).
Errors: `400`, `404`, `409 DUPLICATE_VALUE`.

### 5.2 Categories
`GET /api/categories` Query: `?q=`, `?includeInactive=true`. Same list shape, default `limit` 100.
```json
{ "id": 3, "name": "Beverages", "isActive": true }
```
`POST /api/categories` Request: `{ "name" }`. `PATCH /api/categories/:id` Request: `{ "name", "isActive" }`.
Errors: `400`, `404`, `409 DUPLICATE_VALUE`.

### 5.3 Suppliers
Fields (from Kidus): `id`, `name`, `contactName`, `phone`, `tin`, `address`, `isActive`, `createdAt`, `updatedAt`.

**Who:** read A, M, S **(proposed)**; create and edit **A, M** (company-wide, not limited to a branch).

`GET /api/suppliers` Query: `?q=` (name, TIN), `?includeInactive=true`, `?page`, `?limit`.
```json
{ "id": 5, "name": "Habesha Wholesale", "contactName": "Dawit", "phone": "+251911223344",
  "tin": "0012345678", "address": "Merkato, Addis Ababa", "isActive": true }
```
`POST /api/suppliers` Request: `{ "name", "contactName", "phone", "tin", "address" }` (`name` required).
`GET /api/suppliers/:id`, `PATCH /api/suppliers/:id`.
Errors: `400`, `404`.

### 5.4 Products

Product object:
```json
{
  "id": 12, "name": "Coca-Cola 500ml", "sku": "BEV-0012", "barcode": "6161100010123",
  "categoryId": 3, "categoryName": "Beverages", "unit": "bottle",
  "costPrice": 18.00, "sellingPrice": 25.00, "isActive": true
}
```

**`sellingPrice` includes tax** (VAT or TOT, whichever the company uses). The system never adds tax on top of it (see 6.6).

**`costPrice` is hidden from Staff** **(proposed, N7)**. For a Staff user the server leaves `costPrice` out of every product and stock response, and also `stockValue`. Admin, Manager and Auditor receive them.

#### GET /api/products
**Who:** All roles (read) **(proposed)**.
Query: `?q=` (name, SKU or barcode), `?categoryId=`, `?includeInactive=true`, `?branchId=`, `?page`, `?limit`. Default sort: `name`.
- When `branchId` is given (or implied for Manager and Staff), each product also has `"quantity": 40`, the stock in that branch. This lets the sales screen show availability.

#### GET /api/products/by-barcode/:barcode
**Purpose:** Barcode scan on sales, receiving and transfer screens.
**Who:** A, M, S. Query: `?branchId=` (defaults to own branch).
Success (200): product object including `quantity` for the branch. The response was confirmed by Hemen (H4).
Errors: `404 PRODUCT_NOT_FOUND` (the frontend shows the "product not found" message). Inactive products also return `PRODUCT_NOT_FOUND`.

#### POST /api/products
**Who:** Admin.
Request:
```json
{ "name": "Coca-Cola 500ml", "sku": "BEV-0012", "barcode": "6161100010123",
  "categoryId": 3, "unit": "bottle", "costPrice": 18.00, "sellingPrice": 25.00 }
```
Required: `name`, `sku`, `categoryId`, `unit`, `costPrice`, `sellingPrice`. `barcode` optional **(proposed)**. Prices must be 0 or more.
Success (201): product object.
- **Side effect:** creates a stock row with `quantity` 0 for every branch (see 1.8).

Errors: `400 VALIDATION_ERROR`, `404 NOT_FOUND` (category), `409 DUPLICATE_SKU`, `409 DUPLICATE_BARCODE`.

#### GET /api/products/:id
Success (200): product object. Errors: `404`.

#### PATCH /api/products/:id
**Who:** Admin. Request: any product field, including `isActive`.
Success (200): updated product. Errors: `400`, `404`, `409 DUPLICATE_SKU`, `409 DUPLICATE_BARCODE`.
Price changes are written to the audit log with old and new values.

---

## 6. Core features (Week 2)

**Status: DRAFT, to be locked when Kidus approves.** This section is written so that you can build each endpoint from it without guessing: who may call it, what is checked, what happens in the database, what comes back and which errors are possible. Section 6.10 lists the scenarios that must pass on the Week 2 Friday check. Section 6.11 maps every API field to the database field.

### 6.0 Overview and shared rules

**Endpoint groups and who builds them.** The Team Plan gives Makda purchase orders, sales and company settings, and gives Kidus the transfer logic, alerts, adjustments and audit logging. The contract exposes all of them. **Proposal (N9):** Kidus writes the service functions (logic and transactions). Makda writes the routes, validation, permission checks and response mapping around them.

| Group | Endpoints | Builds (proposed) | Depends on |
|---|---|---|---|
| Company settings | 6.1 | Makda | none |
| Stock reads and thresholds | 6.2, 6.3 | Makda | none |
| Purchase orders | 6.5 | Makda | `applyMovement` (done) |
| Sales and invoices | 6.6 | Makda | `applyMovement` (done) |
| Adjustments | 6.7 | Makda routes, Kidus logic | `OPENING_STOCK` reason in the database (K-K) |
| Notifications, low stock | 6.4 | Makda routes | `applyMovement` creates the rows (done) |
| Audit log read | 6.8 | Makda route, Kidus writer | Kidus's audit interface (K-J) |
| Transfers | 6.9 | Makda routes, Kidus logic | `applyMovement` (done) |

**Shared rules for every Week 2 endpoint:**
1. **Order of checks:** `authenticate`, then the Auditor write block, then the role (1.6), then the branch, then input validation, then business rules, then the database write. The first check that fails decides the error.
2. **One transaction per write.** Use `prisma.$transaction` and pass `tx` to `applyMovement`. If anything throws, everything rolls back, including the invoice counter.
3. **Numbers:** quantities in requests are above 0 with at most 2 decimals (adjustments are signed and not 0). Money has 2 decimals, rounded half up. Convert database `Decimal` values to JSON numbers.
4. **Item lines:** at least 1 line. The same `productId` twice in one request is rejected with `400 VALIDATION_ERROR`, `rule: duplicate` **(proposed, N12)**.
5. **Inactive records:** an inactive product, supplier or branch cannot be used in a new PO, sale, adjustment or transfer. Return `400 VALIDATION_ERROR`, `rule: inactive`. An unknown id returns `404 NOT_FOUND`.
6. **Status changes** (approve, ship, receive and so on) check the current status first and return `409 INVALID_STATUS` if the action is not allowed. Lock the row with `SELECT ... FOR UPDATE` before checking, so two people cannot do the same action twice.
7. **Audit:** every important write creates an audit entry with the action names in 6.8. The interface to call is Kidus's (K-J).
8. **Response shape:** follow 1.9 (plain object, or list shape). Add the `createdBy` style objects and names from 1.5.

### 6.1 Company settings (T1)
**Who:** Admin only, for both read and change (1.6). Other roles read the company name, address and TIN from the invoice (`GET /api/sales/:id`).

#### GET /api/settings/company
Success (200):
```json
{ "companyName": "ABC Trading PLC", "address": "Bole, Addis Ababa", "phone": "+251911000000",
  "tin": "0012345678", "taxType": "VAT", "taxRate": 15,
  "defaultTaxRates": { "VAT": 15, "TOT": 2 }, "updatedAt": "2026-10-05T09:30:00Z" }
```

#### PUT /api/settings/company
Request (all fields below are sent every time, because `PUT` replaces the editable fields):
```json
{ "companyName": "ABC Trading PLC", "address": "Bole, Addis Ababa", "phone": "+251911000000",
  "tin": "0012345678", "taxType": "TOT", "taxRate": 2 }
```
- `companyName` is required (1 to 150 characters). `address`, `phone` and `tin` are optional and can be `null` or empty. `tin` is at most 20 characters and is not checked for format **(proposed)**.
- `taxType` is `VAT` or `TOT`. `taxRate` is a **percentage number** from 0 to 100 with at most 2 decimals (the database stores it as a fraction, so the API divides by 100 when saving and multiplies by 100 when returning).
- `defaultTaxRates` is read only and is ignored if sent. `nextInvoiceNumber` is never exposed and never changed through the API.
- A change affects **only future sales**. Old invoices keep the `taxType` and `taxRate` they were created with.

Success (200): the settings object above. Errors: `400 VALIDATION_ERROR`, `403 FORBIDDEN`.
Audit: not logged in this version (no matching action name yet, K-F).

### 6.2 Stock (read and thresholds)
**The stock row for a product and branch always exists** (1.8), even with quantity 0.

#### GET /api/stock
**Who:** A (all branches), M and S (own branch), U (all, read only).
Query: `?branchId=`, `?productId=`, `?categoryId=`, `?q=` (product name, SKU or barcode), `?lowOnly=true`, `?page`, `?limit`. Default sort: `productName`.
```json
{ "branchId": 1, "branchName": "Bole Branch", "productId": 12, "productName": "Coca-Cola 500ml",
  "sku": "BEV-0012", "categoryName": "Beverages",
  "quantity": 40, "minQuantity": 10, "maxQuantity": 100, "costPrice": 18.00, "stockValue": 720.00 }
```
- `stockValue` = `quantity` × `costPrice`, rounded to 2 decimals. `costPrice` and `stockValue` are left out for Staff (5.4, N7).
- **`minQuantity` of 0 means "no minimum set"** (decision from the stock service: alerts only happen when the minimum is above 0). `maxQuantity` is `null` when not set.
- **`lowOnly=true`** returns only rows where `minQuantity` is above 0 and `quantity` is at or below `minQuantity`.
- For Admin and Auditor without `branchId`, rows of all branches are returned (one row per product and branch).
- For Manager and Staff, `branchId` is always their own. Another branch returns `403 FORBIDDEN`.

#### GET /api/stock/consolidated
**Who:** A, U. Total per product across active branches. Query: `?q=`, `?categoryId=`, `?page`, `?limit`. Default sort: `productName`.
```json
{ "productId": 12, "productName": "Coca-Cola 500ml", "sku": "BEV-0012", "totalQuantity": 120,
  "branches": [ { "branchId": 1, "branchName": "Bole", "quantity": 40 },
                { "branchId": 2, "branchName": "Piassa", "quantity": 80 } ] }
```

#### PUT /api/stock/:branchId/:productId/thresholds
**Who:** A, M (own branch). Sets the minimum, and optionally the maximum, for one product in one branch.
Request: `{ "minQuantity": 10, "maxQuantity": 100 }`
- `minQuantity` is required, 0 or more, at most 2 decimals. **0 clears the minimum.**
- `maxQuantity` is optional. `null` clears it. If given, it must be at least `minQuantity`.
- Does not change `quantity` and does not create a notification. The alert state is handled by the stock service on the next stock change. The low-stock list (6.4) is calculated live, so it shows the product at once.

Success (200): the stock row. Errors: `400 VALIDATION_ERROR` (`rule: min` or `max`), `403`, `404 NOT_FOUND` (branch or product).
Audit: not logged in this version.

### 6.3 Stock movements (read only)
**Who:** A (all branches), M and S (own branch), U (all, read only).

#### GET /api/stock-movements
Query: `?productId=`, `?branchId=`, `?type=`, `?from=`, `?to=`, `?page`, `?limit`. Default sort: `-createdAt`.
Fields from Kidus: `id`, `productId`, `branchId`, `type`, `quantityChange`, `quantityAfter`, `referenceType`, `referenceId`, `reason`, `userId`, `createdAt`. The API adds `productName`, `branchName` and `createdBy`.
```json
{ "id": 901, "productId": 12, "productName": "Coca-Cola 500ml", "branchId": 1, "branchName": "Bole Branch",
  "type": "SALE", "quantityChange": -2, "quantityAfter": 38,
  "referenceType": "SALE", "referenceId": 301, "reason": null,
  "createdBy": { "id": 2, "name": "Abel Tesfaye" }, "createdAt": "2026-10-05T09:30:00Z" }
```
- `quantityChange` is the signed change. `quantityAfter` is the stock after the change. These are the only two names that do not use `quantity` (confirmed by Hemen, H5).
- Movements are never created or changed through the API. Only `applyMovement` writes them.
- `from` and `to` are Ethiopia-time days (1.5).

### 6.4 Notifications and low stock

**Low-stock rule (K7, as built in the stock service).** When a minimum is set (above 0) and a stock change that **removes** stock makes `quantity` drop to or below `minQuantity`, **one** `LOW_STOCK` notification is created automatically. No further notification is created for that product and branch until `quantity` goes above `minQuantity` again and later drops again. A minimum of 0 never alerts. The API does not create notifications. It only reads them.

#### GET /api/notifications
**Who:** A (all branches) and M (own branch). Staff and Auditor: no access (T2).
Query: `?unread=true`, `?branchId=` (Admin only), `?page`, `?limit`. Default sort: `-createdAt`. Default `limit` is 20.
```json
{ "data": [ { "id": 7, "type": "LOW_STOCK", "branchId": 1, "branchName": "Bole Branch", "productId": 12,
    "productName": "Coca-Cola 500ml", "quantity": 8, "minQuantity": 10,
    "isRead": false, "createdAt": "2026-10-05T09:30:00Z" } ],
  "unreadCount": 3, "page": 1, "limit": 20, "total": 12 }
```
- `quantity` and `minQuantity` are the values **at the moment of the alert**, not the current stock.
- `unreadCount` counts all unread notifications this user may see (not only the current page). The bell reads it. Melat's screen reloads every 60 seconds (no push).

#### POST /api/notifications/:id/read and POST /api/notifications/read-all
**Who:** A, M (own branch). Success (200): `{ "success": true }`. A Manager cannot mark another branch's notification: `403 FORBIDDEN`. Unknown id: `404 NOT_FOUND`.
`read-all` marks every notification this user may see.

#### GET /api/low-stock
**Who:** A (all branches), M (own branch). Query: `?branchId=` (Admin only), `?categoryId=`, `?page`, `?limit`. Default sort: `productName`.
Items where `minQuantity` is above 0 and `quantity` is at or below `minQuantity`, calculated live from stock (it does not depend on notifications).
```json
{ "branchId": 1, "branchName": "Bole Branch", "productId": 12, "productName": "Coca-Cola 500ml",
  "quantity": 8, "minQuantity": 10, "maxQuantity": 100, "suggestedReorderQuantity": 92 }
```
`suggestedReorderQuantity` = `maxQuantity - quantity` if `maxQuantity` is set, otherwise `2 × minQuantity - quantity`.

### 6.5 Purchase orders (T3)

**Statuses and actions:**

| Action | Endpoint | Who | From status | To status | Stock effect |
|---|---|---|---|---|---|
| Create | `POST /api/purchase-orders` | A, M, S (own branch) | (new) | `PENDING_APPROVAL` | none |
| Approve | `POST /api/purchase-orders/:id/approve` | A, M (own branch) | `PENDING_APPROVAL` | `APPROVED` | none |
| Reject | `POST /api/purchase-orders/:id/reject` | A, M (own branch) | `PENDING_APPROVAL` | `REJECTED` | none |
| Receive (Week 2: everything) | `POST /api/purchase-orders/:id/receive` | A, M, S (own branch) | `APPROVED` | `RECEIVED` | stock added |
| Receive part (Week 3) | same | same | `APPROVED` or `PARTIALLY_RECEIVED` | `PARTIALLY_RECEIVED` or `RECEIVED` | stock added |

A Manager or Admin may approve a PO they created themselves (decided, T3). `REJECTED` and `RECEIVED` are final.

PO object:
```json
{ "id": 40, "poNumber": "PO-000040", "supplierId": 5, "supplierName": "Habesha Wholesale",
  "branchId": 1, "branchName": "Bole Branch", "status": "PENDING_APPROVAL", "totalCost": 1800.00,
  "note": "Weekly drinks order",
  "items": [ { "id": 81, "productId": 12, "productName": "Coca-Cola 500ml", "sku": "BEV-0012",
               "quantity": 100, "receivedQuantity": 0, "unitCost": 18.00 } ],
  "createdBy": { "id": 2, "name": "Abel Tesfaye" }, "createdAt": "2026-10-05T09:30:00Z",
  "approvedBy": null, "approvedAt": null,
  "rejectedBy": null, "rejectedAt": null, "rejectReason": null }
```
- `quantity` is the ordered quantity. `receivedQuantity` is how much has arrived so far. `totalCost` is calculated (sum of `quantity` × `unitCost`, 2 decimals) and is not stored.
- Exactly one of the pairs `approvedBy/approvedAt` and `rejectedBy/rejectedAt` is filled after a decision. `rejectReason` is filled only for a rejection with a reason.

#### POST /api/purchase-orders
**Who:** A, M, S. For M and S, `branchId` must be their own branch (default if left out). A must send `branchId`.
```json
{ "supplierId": 5, "branchId": 1, "note": "Weekly drinks order",
  "items": [ { "productId": 12, "quantity": 100, "unitCost": 18.00 } ] }
```
Validation: `supplierId` and `branchId` are active and exist. `items` has at least 1 line. Each `productId` is active and appears once. `quantity` above 0. `unitCost` 0 or more. `note` at most 500 characters.
Steps (one transaction): create the PO with status `PENDING_APPROVAL`, create the items, set `poNumber` to `PO-` plus the id padded to 6 digits. **PO numbers are unique and increasing, but gaps are allowed** (unlike invoice numbers).
Success (201): the PO object.
Errors: `400 VALIDATION_ERROR`, `403 FORBIDDEN`, `404 NOT_FOUND` (supplier, branch or product).

#### GET /api/purchase-orders
**Who:** A (all branches), M and S (own branch) **(proposed, N2)**. Auditor: no access.
Query: `?status=`, `?supplierId=`, `?branchId=` (Admin only), `?from=`, `?to=`, `?q=` (PO number), `?page`, `?limit`. Default sort: `-createdAt`. The list leaves out `items` and adds `itemCount`.

#### GET /api/purchase-orders/:id
Success (200): the full PO object. Errors: `403` (other branch), `404`.

#### POST /api/purchase-orders/:id/approve and /reject
**Who:** A, M (own branch). Staff: `403`.
Reject request: `{ "reason": "Price too high" }` (optional, at most 300 characters). Approve has no body.
Steps: lock the PO, check the status is `PENDING_APPROVAL` (else `409 INVALID_STATUS`), save the status, user and time. Audit: `PO_APPROVED` (a `PO_REJECTED` name is still open, K-F).
Success (200): the updated PO. Errors: `403`, `404`, `409 INVALID_STATUS`.

#### POST /api/purchase-orders/:id/receive
**Who:** A, M, S (own branch). **Changes stock.**
Week 2 request: **no body.** The server receives everything that is still outstanding on every line. In Week 3 this endpoint also accepts:
```json
{ "items": [ { "itemId": 81, "quantity": 60 } ] }
```
until then, a request with `items` returns `400 VALIDATION_ERROR`.
Steps, all in ONE transaction:
1. Lock the PO row. If the status is not `APPROVED` (Week 3: or `PARTIALLY_RECEIVED`), return `409 INVALID_STATUS`.
2. For each item with outstanding quantity (`quantity - receivedQuantity` above 0), sorted by `productId`: call `applyMovement({ type: 'PURCHASE_RECEIPT', quantity: +outstanding, referenceType: 'PURCHASE_ORDER', referenceId: po.id, productId, branchId: po.branchId, userId }, tx)` and set `receivedQuantity` to the ordered quantity.
3. Set the PO status to `RECEIVED`. Audit: `PO_RECEIVED`.

Success (200): the updated PO, status `RECEIVED`, every `receivedQuantity` equal to `quantity`.
Errors: `403`, `404`, `409 INVALID_STATUS` (not approved, already received, or rejected), `422 OVER_RECEIVE` (Week 3, with `details` as in 1.4).
**Receiving does not change the product's `costPrice`** (proposed, N10). Only the Admin changes prices.

### 6.6 Sales and invoices (T1)

#### POST /api/sales
**Who:** A, M, S. For M and S, `branchId` must be their own (default if left out). A must send `branchId`. **Changes stock.**
Request:
```json
{ "branchId": 1, "customerName": "Almaz",
  "items": [ { "productId": 12, "quantity": 2 }, { "productId": 15, "quantity": 1 } ] }
```
- `customerName` is optional (at most 100 characters). **Prices come from the server** (the product's current `sellingPrice`, which already includes tax). The client never sends prices or totals.
- Validation: `branchId` active and allowed. `items` has at least 1 line. Each product is active and appears once. `quantity` above 0, at most 2 decimals.

**Steps, in this order:**
1. **Validate and check permissions** (shared rule 1).
2. **Load the products** with their current `sellingPrice`. Unknown id: `404`. Inactive: `400` with `rule: inactive`.
3. **Check stock for every line first** (a plain read, no writes). If any line is short, stop and return `422 INSUFFICIENT_STOCK` with **one `details` entry for every short line**. Nothing is saved and no invoice number is used.
4. **Open the transaction.** Lock the company settings row (`SELECT ... FOR UPDATE`) and read `nextInvoiceNumber`, `taxType` and `taxRate`. Set `invoiceNumber` = `INV-` plus the number padded to 6 digits. Increase `nextInvoiceNumber` by 1.
5. **Calculate:** `lineTotal` = `unitPrice` × `quantity`, rounded to 2 decimals. `total` = the sum of the `lineTotal` values. `taxAmount` = `total × taxRate / (100 + taxRate)` rounded to 2 decimals. `netAmount` = `total - taxAmount`.
6. **Save** the sale and its items. The sale stores `taxType`, `taxRate`, `taxAmount` and `netAmount`, so later setting changes never change it.
7. **Take the stock:** for each line, sorted by `productId`, call `applyMovement({ type: 'SALE', quantity: -quantity, referenceType: 'SALE', referenceId: sale.id, productId, branchId, userId }, tx)`. This locks the stock row. If another sale took the stock between step 3 and now, this throws `INSUFFICIENT_STOCK`, **everything rolls back including the invoice counter**, and the API returns `422` with `details` for that line.
8. **Commit.** Low-stock notifications were already created by `applyMovement`. Write the audit entry `SALE_CREATED`.

**No gaps in invoice numbers:** the counter is increased inside the same transaction as the sale. If anything fails, the increase is rolled back and the next sale gets the same number. The company settings row is locked for the length of a sale, so sales are processed one at a time company-wide. That is fine at this scale.
Locking order is always settings row first, then stock rows by ascending `productId`, which prevents deadlocks.

Success (201):
```json
{
  "id": 301, "invoiceNumber": "INV-000045", "branchId": 1, "branchName": "Bole Branch",
  "customerName": "Almaz",
  "createdBy": { "id": 2, "name": "Abel Tesfaye" },
  "items": [ { "id": 410, "productId": 12, "productName": "Coca-Cola 500ml", "quantity": 2,
               "unitPrice": 25.00, "lineTotal": 50.00 } ],
  "netAmount": 43.48, "taxType": "VAT", "taxRate": 15, "taxAmount": 6.52, "total": 50.00,
  "createdAt": "2026-10-05T09:30:00Z"
}
```
- The cashier on the invoice is `createdBy.name`.

**Tax rule (T1).** Selling prices **include** the tax. The system never adds tax on top.
- `taxAmount` = `total × taxRate / (100 + taxRate)`, rounded to 2 decimals. It is calculated once on the invoice total, not per line, so rounding does not drift.
- **Example, VAT 15%:** total 1,150.00 gives `taxAmount` 150.00 (1,150 × 15 / 115) and `netAmount` 1,000.00. The customer pays 1,150.00.
- **Example, TOT 2%:** total 1,020.00 gives `taxAmount` 20.00 (1,020 × 2 / 102) and `netAmount` 1,000.00.

**Invoice print fields (confirmed by Hemen, H3):** company name, address and TIN; invoice number; date; branch; cashier (`createdBy.name`); customer name; the items (name, quantity, `unitPrice`, `lineTotal`); `netAmount`, `taxType`, `taxRate`, `taxAmount` and `total`. All of them come from `GET /api/sales/:id`, which includes `company`.

**Sales cart (confirmed, Hemen request 2).** Staff cannot read the company settings, so the cart does not know the tax rate. The cart shows only the **total** (the sum of price × quantity from the product lookup). After the sale, the screen shows `netAmount`, `taxAmount` and `total` from the sale response. If a price changed between the scan and the sale, the server uses the current price, so the screen must show the amounts from the response and not the cart.

Errors: `400 VALIDATION_ERROR`, `403 FORBIDDEN`, `404 NOT_FOUND`, `422 INSUFFICIENT_STOCK`. Example of the stock error:
```json
{ "error": { "code": "INSUFFICIENT_STOCK", "message": "Not enough stock for 1 item.",
  "details": [ { "field": "items[0].quantity", "productId": 12, "available": 1, "requested": 2 } ] } }
```

#### GET /api/sales
**Who:** A (all branches), M and S (own branch). Auditor: no access (T2).
Query: `?branchId=` (Admin only), `?from=`, `?to=`, `?invoiceNumber=`, `?createdBy=` (user id), `?page`, `?limit`. Default sort: `-createdAt`. Items are omitted in the list, and `itemCount` is added instead.

#### GET /api/sales/:id
The same object as the POST response, plus the company block for printing and `returnedQuantity` per item (used by the returns screen):
```json
{ "...": "...", "items": [ { "id": 410, "quantity": 2, "returnedQuantity": 0, "...": "..." } ],
  "company": { "companyName": "ABC Trading PLC", "address": "Bole, Addis Ababa", "tin": "0012345678" } }
```
Errors: `403` (other branch), `404`.

### 6.7 Stock adjustments
**Who:** A, M, S (own branch), for every reason including `OPENING_STOCK` (T2, T7). **Changes stock.**

#### POST /api/adjustments
```json
{ "branchId": 1, "productId": 12, "quantity": -3, "reason": "DAMAGE", "note": "Dropped in storage" }
```
- `quantity` is **signed**: negative removes stock, positive adds it. It cannot be 0 and has at most 2 decimals.
- `reason` is required: `DAMAGE`, `EXPIRY`, `LOSS`, `RECOUNT`, `OTHER`, `OPENING_STOCK`. `note` is optional (at most 300 characters).
- **Sign rules (proposed, N11):** `DAMAGE`, `EXPIRY` and `LOSS` must be negative. `OPENING_STOCK` must be positive. `RECOUNT` and `OTHER` may be either. A wrong sign returns `400 VALIDATION_ERROR`, `rule: must_be_negative` or `min`.

Steps (one transaction): create the adjustment record, then call `applyMovement` with type `ADJUSTMENT` (or `OPENING_STOCK` when the reason is `OPENING_STOCK`), `reason` set to the adjustment reason, `referenceType: 'ADJUSTMENT'`, `referenceId` the adjustment id. Audit: `ADJUSTMENT_CREATED`.
**Needs a database change first:** `OPENING_STOCK` is not yet in the `AdjustmentReason` enum (K-K).

Success (201):
```json
{ "id": 15, "branchId": 1, "branchName": "Bole Branch", "productId": 12, "productName": "Coca-Cola 500ml",
  "quantity": -3, "reason": "DAMAGE", "note": "Dropped in storage",
  "createdBy": { "id": 2, "name": "Abel Tesfaye" }, "createdAt": "2026-10-05T09:30:00Z" }
```
Errors: `400 VALIDATION_ERROR`, `403`, `404`, `422 INSUFFICIENT_STOCK` (for a negative adjustment larger than the stock; `details` as in 1.4, `requested` is the positive amount).

#### GET /api/adjustments
**Who:** A (all branches), M and S (own branch), U (all, read only). Query: `?branchId=`, `?productId=`, `?reason=`, `?from=`, `?to=`, `?page`, `?limit`. Default sort: `-createdAt`.

### 6.8 Audit log
**Who:** A and U (all branches, U read only), M (own branch only, decided T9). Staff: no access. Read only, with no endpoint to change or delete entries.

#### GET /api/audit-logs
Query: `?userId=`, `?entityType=`, `?entityId=`, `?productId=` (shorthand for `entityType=PRODUCT` plus `entityId=`), `?action=`, `?branchId=` (Admin and Auditor only; Manager is always limited to their own branch), `?from=`, `?to=`, `?page`, `?limit`. Default sort: `-createdAt`.
Fields from Kidus: `id`, `userId`, `action`, `entityType`, `entityId`, `branchId`, `oldValue`, `newValue` (both JSON), `createdAt`. The API adds `createdBy` and `branchName` (`null` when `branchId` is `null`).
```json
{ "id": 5001, "createdBy": { "id": 2, "name": "Abel Tesfaye" }, "action": "SALE_CREATED",
  "entityType": "SALE", "entityId": 301, "branchId": 1, "branchName": "Bole Branch",
  "oldValue": null, "newValue": { "invoiceNumber": "INV-000045", "total": 50.00 },
  "createdAt": "2026-10-05T09:30:00Z" }
```
Entity types (K4): `USER`, `PRODUCT`, `SUPPLIER`, `BRANCH`, `PO`, `SALE`, `RETURN`, `ADJUSTMENT`, `TRANSFER`, `IMPORT`.
Action names (K4): `USER_CREATED`, `USER_UPDATED`, `USER_LOGOUT`, `PRODUCT_CREATED`, `PRODUCT_UPDATED`, `PRICE_CHANGED`, `SUPPLIER_UPDATED`, `BRANCH_UPDATED`, `STOCK_MOVEMENT`, `PO_CREATED`, `PO_APPROVED`, `PO_RECEIVED`, `SALE_CREATED`, `RETURN_CREATED`, `RETURN_REFUNDED`, `ADJUSTMENT_CREATED`, `TRANSFER_REQUESTED`, `TRANSFER_APPROVED`, `TRANSFER_SHIPPED`, `TRANSFER_RECEIVED`, `IMPORT_CONFIRMED`.
Not in the list yet: `PO_REJECTED`, `TRANSFER_REJECTED`. **(Open, K-F)**
Every Week 2 write in this section creates one entry (for the endpoint's action name above), inside the same transaction. **(Interface: K-J.)**

### 6.9 Transfers
Statuses: `REQUESTED`, `APPROVED`, `REJECTED`, `SHIPPED`, `RECEIVED`.
**Direction:** the branch that **needs** stock requests it. `toBranchId` is the requester (destination). `fromBranchId` is the branch that sends stock (source). Stock **leaves the source when shipped** and **joins the destination when received**. While `SHIPPED` it is in transit and belongs to neither branch.

| Action | Endpoint | Who | From status | To status | Stock effect |
|---|---|---|---|---|---|
| Request | `POST /api/transfers` | A, M, S of the **destination** branch | (new) | `REQUESTED` | none |
| Approve | `POST /api/transfers/:id/approve` | A, M of the **source** branch | `REQUESTED` | `APPROVED` | none |
| Reject | `POST /api/transfers/:id/reject` | A, M of the **source** branch | `REQUESTED` | `REJECTED` | none |
| Ship | `POST /api/transfers/:id/ship` | A, M, S of the **source** branch | `APPROVED` | `SHIPPED` | source stock removed (`TRANSFER_OUT`) |
| Receive | `POST /api/transfers/:id/receive` | A, M, S of the **destination** branch | `SHIPPED` | `RECEIVED` | destination stock added (`TRANSFER_IN`) |

Who is final (T2). Staff cannot approve or reject. `REJECTED` and `RECEIVED` are final. There is no cancel in this version. Admin may act for either branch.

Transfer object:
```json
{ "id": 9, "fromBranchId": 2, "fromBranchName": "Piassa", "toBranchId": 1, "toBranchName": "Bole",
  "status": "REQUESTED", "note": "Urgent",
  "items": [ { "productId": 12, "productName": "Coca-Cola 500ml", "quantity": 30 } ],
  "requestedBy": { "id": 2, "name": "Abel Tesfaye" }, "requestedAt": "2026-10-05T09:30:00Z",
  "approvedBy": null, "approvedAt": null,
  "rejectedBy": null, "rejectedAt": null, "rejectReason": null,
  "shippedBy": null, "shippedAt": null,
  "receivedBy": null, "receivedAt": null }
```
Each step fills its own pair when it happens. Approve and reject never both fill.

#### POST /api/transfers
```json
{ "fromBranchId": 2, "toBranchId": 1, "note": "Urgent",
  "items": [ { "productId": 12, "quantity": 30 } ] }
```
Validation: both branches active, and `fromBranchId` is not `toBranchId`. M and S: `toBranchId` must be their own. At least 1 line, each product active and once, `quantity` above 0. `note` at most 300 characters. Stock is **not** checked at request time.
Success (201): the transfer object. Errors: `400`, `403`, `404`.

#### GET /api/transfers
**Who:** A (all), M and S (own branch, as source or destination) **(proposed, N2)**. Auditor: no access.
Query: `?status=`, `?direction=incoming|outgoing` (relative to the user's branch), `?branchId=` (Admin), `?from=`, `?to=`, `?page`, `?limit`. Default sort: `-createdAt`. The list leaves out `items` and adds `itemCount`; `GET /api/transfers/:id` returns the items.

#### GET /api/transfers/:id
Success (200): the transfer object. Errors: `403`, `404`.

#### Action endpoints (approve, reject, ship, receive)
Request body: empty, except reject, which accepts `{ "reason": "Not enough stock" }` (optional, at most 300 characters).
Steps: lock the transfer, check the status (else `409 INVALID_STATUS`), check the branch rule in the table, then:
- **ship:** in one transaction, for each item sorted by `productId`, `applyMovement({ type: 'TRANSFER_OUT', quantity: -quantity, referenceType: 'TRANSFER', referenceId: transfer.id, branchId: fromBranchId, ... }, tx)`. The status becomes `SHIPPED`. Before that, check all items and return one `INSUFFICIENT_STOCK` `details` entry per short item.
- **receive:** in one transaction, `applyMovement({ type: 'TRANSFER_IN', quantity: +quantity, branchId: toBranchId, ... }, tx)` for each item, then status `RECEIVED`.
- **approve, reject:** save the status, user and time (and the reason for reject).

Success (200): the updated transfer. Errors: `403`, `404`, `409 INVALID_STATUS`, `422 INSUFFICIENT_STOCK` (ship only).
Audit: `TRANSFER_REQUESTED`, `TRANSFER_APPROVED`, `TRANSFER_SHIPPED`, `TRANSFER_RECEIVED` (rejection name open, K-F). A low-stock notification for the source is created by `applyMovement` after shipping.

### 6.10 Week 2 acceptance scenarios (the Friday check)
Run these against the real backend with the seed accounts (`admin`, `manager`, `staff`, `auditor`, all on the branch `MAIN` except admin and auditor). Create a second branch and a few products first. Every scenario must pass. The team rule is that a feature is done only when it works end to end and a teammate has tested it.

| # | Scenario | Expected result |
|---|---|---|
| 1 | Admin sets `taxType` TOT and `taxRate` 2. Staff calls `GET /api/settings/company`. | Save works (200). Staff gets `403 FORBIDDEN`. |
| 2 | Staff creates a PO (supplier, 2 products). Staff then calls approve. | PO is `PENDING_APPROVAL`. Staff approve returns `403`. |
| 3 | Manager approves it, then Staff calls receive. | Status `RECEIVED`. Stock rose by the ordered quantities. Movements of type `PURCHASE_RECEIPT` exist with `referenceType` `PURCHASE_ORDER`. A second receive returns `409 INVALID_STATUS`. |
| 4 | Create another PO, Manager rejects it with a reason, then someone receives it. | Status `REJECTED` with `rejectReason`. Receive returns `409 INVALID_STATUS`. Stock is unchanged. |
| 5 | With VAT 15%, sell items totalling 1,150.00. | `201`, `invoiceNumber` `INV-00000N`, `taxAmount` 150.00, `netAmount` 1,000.00, `total` 1,150.00. Stock fell by the quantities sold. |
| 6 | Sell more than the stock of one item (and a valid second item). | `422 INSUFFICIENT_STOCK` with `details` for the short item only. No sale, no stock change. **The next successful sale gets the next number with no gap.** |
| 7 | Two Staff sell the **last unit** at the same time. | One `201`, one `422`. Stock is 0, never negative. Invoice numbers are still consecutive. |
| 8 | Manager sets `minQuantity` 10 on a product. Sell until stock is 8. Sell once more. Receive stock to 20, then sell down to 9. | Exactly **one** `LOW_STOCK` notification after the first drop, none after the second sale, and a **new** one after stock went above 10 and dropped again. Manager sees them. Staff calls the notifications endpoint and gets `403`. |
| 9 | Staff creates an adjustment of -3 `DAMAGE`, then one of +5 `OPENING_STOCK`. Auditor tries to create one. | Both work, with the right movement types. Auditor gets `403`. An adjustment that makes stock negative returns `422`. |
| 10 | Branch Piassa to Bole transfer: Bole Staff requests. Bole Staff tries to approve. Piassa Manager approves. Piassa Staff ships. Bole Staff receives. | Staff approve returns `403`. After ship, Piassa stock fell. After receive, Bole stock rose. Status ends `RECEIVED`. Shipping a transfer with too little stock returns `422`. |
| 11 | Barcode lookup, then a sale using the product it returned. | Lookup returns the product with `quantity`. The sale works. An unknown barcode returns `404 PRODUCT_NOT_FOUND`. |
| 12 | Open the audit log as Admin, Manager and Staff. | Admin sees every event of scenarios 1 to 11. Manager sees only their branch. Staff gets `403`. |
| 13 | Admin deactivates the Staff user. Staff calls any endpoint with the old token. Auditor sends any `POST`. | Staff gets `403 ACCOUNT_DISABLED` on the next request. Auditor gets `403 FORBIDDEN`. Auditor `GET /api/stock` works. |

### 6.11 Implementation notes: API fields to database fields
Based on `backend/prisma/schema.prisma` on `dev` (15 October 2026). If the schema changes, this table must change with it.

**For every resource:** ids and foreign keys keep their names. `Decimal` columns become JSON numbers. `createdAt` and every other time field are returned as ISO 8601 UTC. A "who did it" column such as `createdById` becomes `{ id, name }` with `name` the user's `fullName`. Names such as `branchName` and `productName` come from a join.

| Resource | API field | Database field | Note |
|---|---|---|---|
| Stock | `minQuantity` | `BranchStock.minQty` | 0 means no minimum |
| Stock | `maxQuantity` | `BranchStock.maxQty` | `null` when not set |
| Stock | (not exposed) | `BranchStock.lowStockAlerted` | internal flag of the stock service |
| Movement | `quantityChange`, `quantityAfter` | same names | `createdBy` from `userId` |
| Adjustment | `quantity` | `Adjustment.quantityChange` | signed |
| PO | `createdBy`, `approvedBy`, `rejectedBy` | `createdById`, `approvedById`, `rejectedById` | with `...At` times |
| PO | `rejectReason` | `PurchaseOrder.rejectReason` | |
| PO | `branchId` | `PurchaseOrder.branchId` | the receiving branch |
| PO | `totalCost` | not stored | sum of `orderedQty` × `unitCost` |
| PO item | `quantity` | `PurchaseOrderItem.orderedQty` | |
| PO item | `receivedQuantity` | `PurchaseOrderItem.receivedQty` | |
| Sale | `netAmount` | `Sale.subtotal` | |
| Sale | `taxRate` | `Sale.taxRate` | stored as a fraction (0.15), returned as a percentage (15) |
| Sale | `createdBy` | `Sale.createdById` | the cashier |
| Sale item | `returnedQuantity` | `SaleItem.returnedQty` | |
| Return | `refundAmount`, `refundStatus`, `refundedBy`, `refundedAt`, `reason` | same names (`refundedById`) | |
| Transfer | `requestedBy`, `requestedAt` | `requestedById`, `createdAt` | `createdAt` is the request time |
| Transfer | `approvedBy`, `rejectedBy`, `shippedBy`, `receivedBy` | the `...ById` columns | with `...At` times |
| Transfer | `rejectReason` | `Transfer.rejectReason` | |
| Settings | `taxRate` | `CompanySetting.taxRate` | fraction in the database, percentage in the API |
| Settings | (not exposed) | `CompanySetting.nextInvoiceNumber` | the locked invoice counter |
| Notification | `minQuantity` | `Notification.minQty` | |

---

## 7. Dashboard (Week 3, DRAFT)

### GET /api/dashboard
**Who:** All roles. Returns data matching the user's role. Optional `?branchId=` for Admin.
```json
{
  "role": "BRANCH_MANAGER",
  "widgets": {
    "stockValue": 125000.00,
    "salesToday": { "count": 14, "total": 8200.50 },
    "lowStockItems": [ { "productId": 12, "productName": "...", "quantity": 8, "minQuantity": 10 } ],
    "pendingApprovals": { "purchaseOrders": 2, "transfers": 1 },
    "transfersInTransit": 1,
    "pendingRefunds": { "count": 3, "totalAmount": 450.00 }
  }
}
```
Widgets by role (from the SRS):

| Role | Widgets |
|---|---|
| Admin | `stockValue`, `salesSummary`, `branchComparison`, `lowStockCount`, `pendingRefunds`, `recentActivity` |
| Branch Manager | `stockValue`, `salesToday`, `lowStockItems`, `pendingApprovals`, `transfersInTransit`, `pendingRefunds` |
| Staff | `salesToday` (count, total), `expectedPurchaseOrders`, `pendingTransfers` (`lowStockItems` removed: Staff have no low-stock access, see N3) |
| Auditor | `recentAuditActivity`, `recentAdjustments` |

`pendingRefunds` is the number and total amount of returns that are still `PENDING_REFUND` (agreed with Hemen). **Hemen sends the exact shapes of every widget at the start of Week 3 (H1)**, and this section is finalized then. Until then the examples are drafts.

---

## 8. Reports and CSV export (Week 3, DRAFT)

**Who:** A (all branches), M (own branch), U (all branches, read only). Staff: no access (decided, T8). Staff use the dashboard.
Common query: `?branchId=`, `?productId=`, `?from=`, `?to=`, `?page`, `?limit`, `?format=json|csv` (default `json`).

| Endpoint | Rows contain |
|---|---|
| `GET /api/reports/stock` | product, SKU, branch, quantity, cost price, stock value |
| `GET /api/reports/sales` | invoice number, date, branch, cashier (`createdBy`), net, tax, total |
| `GET /api/reports/movements` | date, product, branch, type, quantity change, reference, user, reason |

Response for `json`: `{ "data": [...], "totals": { ... }, "page", "limit", "total" }`.
`format=csv`: returns `text/csv; charset=utf-8` **with a UTF-8 BOM**, so Amharic opens correctly in Excel. It exports **all rows matching the current filters** (not only one page) **(proposed)**. The columns above are confirmed by Hemen for now (H2). He confirms filters and sorting in Week 3.

---

## 9. Customer returns (Week 3, DRAFT) (T4)

A return records items and quantities linked to the original invoice, with an optional reason. The system works out the refund amount. Staff pay the customer **outside the system** and then mark the return as refunded. There are no payment methods and no accounting.

Return object:
```json
{ "id": 4, "saleId": 301, "invoiceNumber": "INV-000045", "branchId": 1, "branchName": "Bole Branch",
  "items": [ { "saleItemId": 410, "productName": "Coca-Cola 500ml", "quantity": 1,
               "unitPrice": 25.00, "lineTotal": 25.00 } ],
  "reason": "Damaged on delivery",
  "refundAmount": 25.00, "refundStatus": "PENDING_REFUND",
  "createdBy": { "id": 2, "name": "Abel Tesfaye" }, "createdAt": "2026-10-05T10:10:00Z",
  "refundedBy": null, "refundedAt": null }
```
- `refundStatus` is `PENDING_REFUND` when created and `REFUNDED` after staff mark it.
- `refundAmount` = the sum of (returned `quantity` × `unitPrice` on the **original invoice**). `unitPrice` already includes tax, so the refund is the price the customer paid. The server calculates it. The client never sends it.

### POST /api/sales/:id/returns
**Who:** A, M, S (own branch). **Changes stock** through `applyMovement` (type `CUSTOMER_RETURN`), linked to the original sale.
```json
{ "items": [ { "saleItemId": 410, "quantity": 1 } ], "reason": "Damaged on delivery" }
```
`reason` is optional. Success (201): the return object with `refundStatus` `PENDING_REFUND`.
Errors: `404`, `422 RETURN_EXCEEDS_SOLD` (quantity above sold minus already returned), `400`, `403`.

### GET /api/returns
**Who:** A (all), M and S (own branch) **(proposed)**.
Query: `?branchId=`, `?saleId=`, `?refundStatus=PENDING_REFUND|REFUNDED`, `?from=`, `?to=`, `?page`, `?limit`. Default sort: `-createdAt`.
`?refundStatus=PENDING_REFUND` gives the list of returns still unpaid, so a manager can see them.

### GET /api/returns/:id
Success (200): the return object. Errors: `403`, `404`.

### PATCH /api/returns/:id/refund
**Purpose:** Staff mark that they paid the customer.
**Who:** A, M, S (own branch).
Request: empty body. Success (200): the updated return with `refundStatus` `REFUNDED`, and `refundedBy` and `refundedAt` filled.
Errors: `403`, `404`, `409 INVALID_STATUS` (already `REFUNDED`).
Writes `RETURN_REFUNDED` to the audit log. Stock is not changed again.

---

## 10. CSV import of products (Week 3, DRAFT, first to be cut)

**Who:** Admin only (decided, T7; this changes SRS FR-IMP-01, which said Admin and Branch Manager). The import is **stateless**: the server stores nothing between the preview and the import. The frontend sends the **same file twice**: first with `dryRun=true` (preview), then with `dryRun=false` (import).

### GET /api/import/products/template
Downloads the CSV template (`text/csv`). Columns **(proposed)**: `sku, name, barcode, category, unit, costPrice, sellingPrice, openingQuantity`.

### POST /api/import/products?dryRun=true|false
Request: `multipart/form-data` with field `file` and optional field `branchId`. `dryRun` is required.
- `branchId` is required when any row has `openingQuantity` above 0.
- Checks on every row: missing required fields, duplicate SKU or barcode (inside the file or already in the system), invalid numbers, unknown category name (categories are not created automatically) **(proposed)**.

**`dryRun=true`**: nothing is saved. Success (200):
```json
{ "dryRun": true, "totalRows": 120, "validRows": 117, "invalidRows": 3,
  "rows": [ { "row": 5, "valid": false, "data": { "sku": "BEV-0012", "name": "..." },
              "errors": [ { "field": "sku", "code": "DUPLICATE_SKU", "message": "SKU already exists" } ] } ] }
```
**`dryRun=false`**: the file is validated again and the **valid rows are imported**. Invalid rows are skipped. Success (200):
```json
{ "dryRun": false, "imported": 117, "skipped": 3,
  "skippedRows": [ { "row": 5, "errors": [ { "field": "sku", "code": "DUPLICATE_SKU" } ] } ] }
```
- Each imported product gets stock rows for every branch (see 1.8).
- Rows with `openingQuantity` above 0 create `OPENING_STOCK` movements in the chosen branch.
- Because the file is validated again on import, the result can differ from the preview if data changed in between. The frontend should show the final `imported` and `skipped` numbers.

Errors: `400 VALIDATION_ERROR` (no file, unreadable file, missing `dryRun`, missing `branchId`), `403`.

---

## 11. Rules that apply to every endpoint (checklist for the Week 4 permission audit)

1. Token is required, and the user must be active.
2. Role is checked against the tables above.
3. Branch is checked for Manager and Staff.
4. Auditor is blocked from every write.
5. Input is validated before touching the database.
6. Stock changes only through `applyMovement`.
7. Every important write creates an audit log entry.

---

## 12. Change log and build status

### 12.1 Change log
| Version | Date | Change | Agreed by |
|---|---|---|---|
| v0.1 | 5 Oct 2026 | First draft | n/a |
| v0.2 | 7 Oct 2026 | Kidus's decisions K1-K7 applied. Review changes 1-9 applied: one name `quantity`, one `{ id, name }` shape for who did it, `WRONG_CURRENT_PASSWORD` as 400, PO approval in Week 2, stateless CSV import, locked invoice counter, `OPENING_STOCK` reason, approval and lock rules, Markdown in the repo. | Pending: Kidus (data fields), Hemen, Melat |
| v0.3 | 8 Oct 2026 | Team Decisions T1-T9 applied (see section 0). Tax included in price, final permissions table, return refunds, `USER_LOGOUT` and `RETURN_REFUNDED`, CSV import Admin only. | Pending: Kidus (data fields), Hemen, Melat. Week 2 lock planned Fri 9 Oct. |
| v0.4 | 10 Oct 2026 | Melat's answers (M1 screen needs, M2 status labels) and Hemen's answers (H1 to H6 and three requests) applied (see section 0). Error `details` with numbers, response shapes, names and `itemCount`, sorting rules, `entityId` filter, `defaultTaxRates`, `pendingRefunds`. | Pending: Kidus (data fields). Hemen and Melat answered their items in v0.4. On 15 Oct the Week 2 section (6) was developed and updated from Kidus's code, still as v0.4. |
| v0.5 | 15 Oct 2026 | Week 2 included in full. Build status added from a repo check (12.2). `GET /api/health` added. Open items refreshed. No request or response shape changed. | Pending: Kidus (data fields), Hemen, Melat |

### 12.2 Build status (repo check of `dev`, 15 October 2026)
This table shows what exists in the code today. It is a snapshot. Anyone who merges a pull request should update the row.

| Area | Contract | In `dev` | Notes |
|---|---|---|---|
| Backend skeleton, error handler, auth middleware | 1.1 to 1.4 | **Built** (Kidus) | `AppError`, `asyncHandler`, `authenticate`, `requireRole`, `blockAuditorWrites`, `assertBranchAccess`. |
| `GET /api/health` | 3 | Built, **differs** | Returns a `data` wrapper (see section 3). |
| Auth: login, me, change password, logout | 3 | **Built, matches** (Kidus) | Tests exist. Logout does not write `USER_LOGOUT` yet (needs K-J). |
| Users | 4 | **Built, matches** (Kidus) | Tests exist. Audit writes are TODO (K-J). The list ignores `?sort=` and always sorts by `fullName`. |
| Stock service `applyMovement` and the two stock-row helpers | 1.7, 1.8 | **Built** (Kidus) | Tests exist. Error has no `details`, so the API checks stock first (6.6). |
| Database schema, migration, seed | 6.11 | **Built** (Kidus) | One branch (`MAIN`) and four test users. `OPENING_STOCK` is missing from `AdjustmentReason` (K-K). |
| Branches, categories, suppliers, products | 5 | **Not built** | Week 1 leftovers. The Week 1 check (login and product CRUD end to end) is **not met yet**: login works, product CRUD does not. `routes.js` has the products line commented out with Hemen's name (see R3). |
| Company settings | 6.1 | Not built | |
| Stock reads, movements, thresholds | 6.2, 6.3 | Not built | |
| Notifications, low stock | 6.4 | Not built | The stock service already creates the notification rows. |
| Purchase orders | 6.5 | Not built | |
| Sales and invoices | 6.6 | Not built | |
| Adjustments | 6.7 | Not built | Blocked by K-K. |
| Audit writer and audit log read | 6.8 | Not built | `middleware/audit.js` does not exist (K-J). |
| Transfers | 6.9 | Not built | Owner decision N9. |
| Dashboard, reports, returns, CSV | 7 to 10 | Not started | Week 3. |
| Frontend: app shell, role sidebar, i18n, API client with mock mode, login | n/a | **Built** (Hemen) | Runs in mock mode by default (`VITE_USE_MOCK=true`). The API client already follows the contract (plain objects, list shape, logout only on `UNAUTHENTICATED` and `ACCOUNT_DISABLED`). |
| Frontend: Ethiopian date, birr formatter, real login form | n/a | Built, **not in `dev`** | On `feature/app-shell` and `feature/backend-auth` only (see R4). |
| Frontend: management screens (Melat) | n/a | Not in the repo | Only the screen list (M1) and status labels (M2) exist. |
| This contract, `docs/API_CONTRACT.md` | n/a | **Not in `dev`** | On `feature/api-contract` (v1 to v4 as four commits). No merge into `dev` was found. |

**Branches that are not merged into `dev`:**

| Branch | Contains | Note |
|---|---|---|
| `feature/api-contract` | Contract v1 to v4 (Makda) | Needs review and merge (R1). |
| `feature/backend-auth` | Backend scaffolding and auth (Makda), plus Hemen's frontend commits | Has its **own initial migration** next to Kidus's, and its own copies of the auth and error files. Must not be merged as it is (R2). |
| `feature/app-shell` | Hemen's Ethiopian date, birr formatter and login commits from 10 October | Needs a pull request into `dev` (R4). |
| `feature/stock-service` | The stock service (Kidus) | Its content is already in `dev` through the backend skeleton pull request. |

---

## 13. What is still missing (open decisions)

The items below wait for a person or for the week they belong to. Items for Week 3 and 4 are filled in when those weeks start.

### Resolved so far
- **Hemen:** H2 (report columns, for now), H3 (invoice fields), H4 (barcode response), H5 (`quantityChange`, `quantityAfter`), H6 (logout rule), and his three requests (error `details` numbers, sales cart, response shapes).
- **Melat:** M1 (changes A, B and C applied) and M2 (status values match the contract).
- **Team and Kidus:** T1 to T9 and K1 to K7.
- **Answered by Kidus's code and schema** (Kidus: please confirm): K-A (signed `quantity`), K-B (`referenceType` passed by the caller), K-C (minimum 0 means none), K-D and K-E (reject reason and separate reject columns), K-G (tax and refund columns). K-I is no longer blocking: the API checks stock first and builds the `details`. Details are in 1.7, 6.2, 6.4, 6.5 and 6.9.
- **Confirmed by the repo check:** the auth and users code matches the contract (12.2).

### Repo actions found on 15 October
| # | Action | Who |
|---|---|---|
| R1 | **Get the contract into `dev`.** `docs/API_CONTRACT.md` exists only on `feature/api-contract`. Open or refresh the pull request, add the v5 commit, and ask Kidus, Hemen and Melat to review. | Makda |
| R2 | **Do not merge `feature/backend-auth`.** It has a second initial migration (`20261010154704_init`) next to Kidus's (`20261012055914_init`), its own `AppError` and Prisma helper files, and Hemen's frontend commits. Two initial migrations break `prisma migrate`. Start new branches from `dev` for the remaining work, and delete or archive this one. | Makda |
| R3 | **Who builds products** (and the other Week 1 leftovers: branches, categories, suppliers)? `routes.js` shows products with Hemen's name, the Team Plan gives them to Makda. Without them, sales, purchase orders and transfers cannot be built or tested. | Team lead |
| R4 | **Open a pull request for `feature/app-shell`** so the Ethiopian date, birr formatter and real login form reach `dev`. | Hemen |
| R5 | **Create `middleware/audit.js`.** `auth` and `users` already have TODO comments waiting for it. Every Week 2 write needs it (K-J). | Kidus |
| R6 | **Fix the health check** to return `{ "status": "ok" }` in the code and the README. | Kidus or Makda |

### Still open for Kidus
| # | Question |
|---|---|
| K-F | Audit: add `PO_REJECTED` and `TRANSFER_REJECTED`? Also `STOCK_MOVEMENT` has no matching entity type, and movements already have their own history. Keep it? Company settings and stock thresholds are not audited in this version. Melat needs the final list of action names to write translations. |
| K-H | **Company settings.** Where do the defaults VAT 15 and TOT 2 live? The seed sets one row with VAT 15% and nothing for TOT. I return them read only as `defaultTaxRates` (6.1), which needs a place to store or define them. The schema also has a `phone` field, which the settings screen can use. |
| K-J | **Audit interface for Week 2.** What function do my services call to write an audit entry, and with which arguments (`userId`, `action`, `entityType`, `entityId`, `branchId`, `oldValue`, `newValue`, `tx`)? This is the same as R5. |
| K-K | **Database change needed before adjustments.** `OPENING_STOCK` is missing from the `AdjustmentReason` enum. Please add it with a migration. |

### Open for the team (Kidus has the final call)
| # | Gap | My proposal (already applied above) |
|---|---|---|
| N1 | The table says Branches, Products and Categories are "No" for everyone but Admin, and Suppliers "No" for Staff. But Staff and Manager need to read products (sales), branches (transfer requests, filters) and suppliers (choosing a supplier on a PO). | The table means **manage**. All roles can **read** branches, categories and products. A, M, S can read suppliers. Melat's screens already assume this. |
| N2 | The table lists create and action rows only. Who may **view** purchase orders, transfers and returns, and the sales list? | A all, M own, S own. The Auditor has no access. Melat's screens already assume this. |
| N3 | The SRS Staff dashboard has a `lowStockItems` widget, but T2 says Staff have no low-stock notifications. | Removed from the Staff dashboard. Melat's screens already assume this. |
| N4 | `OPENING_STOCK` is an adjustment reason, and the table lets Staff create adjustments, so Staff can enter opening stock. | Allow it. Please confirm this is intended, because it lets Staff add stock. |
| N5 | A user deactivated during a session is blocked on the next request (T5). Which error? | `403 ACCOUNT_DISABLED`, and the frontend logs out on it. Confirmed by Hemen (H6) and built in `auth.js`. |
| N6 | Do the sales report and the dashboard sales totals subtract refunded returns? | Not in the first version. Reports show sales as invoiced, and returns are shown separately. |
| N7 | **Cost price for Staff** (Melat's question). The server would send `costPrice` and `stockValue` to Staff on products and stock. | Leave them out of responses for Staff (see 5.4). |
| N8 | **Screens with no owner in the Team Plan.** Stock overview (S5, with a sidebar item in `menu.js`), Users (S13) and Company settings (S14). Melat offers S13 and S14 if Hemen takes more on in Week 3. | Team lead assigns an owner. |
| N9 | **Who writes the Week 2 routes for transfers, adjustments, notifications, low stock and the audit log?** The Team Plan gives Kidus the logic but not the Express routes. | Kidus writes the service functions. Makda writes routes, validation, permission checks and response mapping. If Makda is behind, Kidus takes the transfer routes. |
| N10 | Does receiving a PO update the product's `costPrice` from the PO's `unitCost`? | No. Only the Admin changes prices. |
| N11 | Should adjustment reasons control the sign? | `DAMAGE`, `EXPIRY`, `LOSS` must be negative. `OPENING_STOCK` must be positive. `RECOUNT` and `OTHER` may be either. |
| N12 | The same product twice in one sale, PO or transfer: merge or reject? | Reject with `VALIDATION_ERROR`, `rule: duplicate`. |

### For Hemen
| # | Item |
|---|---|
| H1 | Exact dashboard shapes for every widget, **at the start of Week 3**. `pendingRefunds` is agreed. |
| H2 | Report filters and sorting, **in Week 3**. The columns are agreed for now. |
| H7 | **Menu:** add a Stock item (`/stock`) in `menu.js` for Admin, Manager, Staff and Auditor, or tell Melat where the stock overview should live. |
| H8 | Validation error `details` carry a `rule` code next to `field` (`required`, `invalid`, `min`, `max`, `too_short`, `too_long`, `duplicate`, `inactive`, `must_be_negative`), so you can translate them (see 1.4). The current backend code sends `field` and `issue` only, so it needs a small change. Is this list enough? |
| H9 | **New.** Add `INVALID_QUANTITY` (400) to `lib/errorMessages.js`. It is in the contract error table now, and the frontend does not know it yet. |

### For Melat
| # | Item |
|---|---|
| M3 | The stock badge: a `minQuantity` of **0** means "no minimum" (the database default and the stock service rule), so treat 0 like `null` and show no badge. Your M2 file only mentions `null`. |
| M4 | POs and transfers now return `rejectReason` (6.5, 6.9), so the reason box in the reject dialogs stays. |

### Waiting for the week they belong to
- **Week 3:** Hemen's dashboard shapes and report filters (above); the CSV import template columns and the report CSV export approach (all rows, UTF-8 with BOM), which are proposed in sections 8 and 10 and are confirmed when the feature starts.
- **Week 3 (Melat):** the final Amharic labels. These are text only and not part of this contract. Audit action translations wait for K-F.

### SRS changes that follow from these decisions (for Kidus's Week 4 SRS update, not the contract)
- **FR-IMP-01:** change "Admin and Branch Manager" to "Admin".
- **FR-SAL-04 and Section 3.6:** selling prices include VAT or TOT, and the tax is worked out from the price. Replace the example (1,000 + 150 = 1,150) with: a total of 1,150 includes 150 of VAT.
- **Product selling price:** state that it includes tax.
- **New requirement** for the refund check on customer returns: refund amount, status, mark as refunded, pending list.
- **PO approval** is built together with purchase orders, not as a later extra.
