# API Contract: Multi-Branch Stock Management System (Version 3)

**Owner:** Makda (Backend API) | **Version:** v0.3 DRAFT | **Date:** 8 October 2026
**Source:** SRS (October 2026), Team Plan, Kidus's decisions K1-K7, the review comments on v0.1, and the Team Decisions T1-T9 (Kidus, team lead).
Items marked **(proposed)** are my suggestions where nothing has been decided. Items marked **(TBC)** need an answer from the named person.

This file lives at `docs/api-contract.md`.

**Change process.** The contract changes only by pull request. A change that touches a **data field** needs Kidus's approval. A change to a request or response used by a screen needs Hemen's or Melat's approval. **Week 2 shapes are to be locked on Friday 9 October 2026** once all three have approved. Each person reads the endpoints for their own area and sends Makda corrections by Friday. Silence means agreement. Kidus makes the final call on anything still open on Thursday night (8 October).

---

## 0. What changed in v0.3

Everything from v0.2 stays (see the change log in section 12). This version applies the Team Decisions T1 to T9.

| #   | Change                                                                                                                                                                                                                                                                                             | Source |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| 1   | **Tax:** selling prices **include** tax. Admin sets `taxType` (VAT or TOT) and `taxRate` in company settings. Defaults VAT 15%, TOT 2%, no rate in code. Sales work the tax out of the price: `taxAmount = total x rate / (100 + rate)`, `netAmount = total - taxAmount`. Nothing is added on top. | T1     |
| 2   | **Permissions:** the team's table is now section 1.6 and is final. Every "Who" in the contract follows it.                                                                                                                                                                                         | T2     |
| 3   | **PO approval:** confirmed. POs start as `PENDING_APPROVAL`, and a Manager or Admin may approve a PO they created.                                                                                                                                                                                 | T3     |
| 4   | **Returns:** new fields `reason`, `refundAmount`, `refundStatus`, `refundedBy`, `refundedAt`. New endpoint `PATCH /api/returns/:id/refund`. New filter `?refundStatus=`.                                                                                                                           | T4     |
| 5   | **Login:** confirmed (8 hours, no refresh, 8 characters). Deactivated users are blocked on their next request. Logout is written to the audit log (`USER_LOGOUT`).                                                                                                                                 | T5     |
| 6   | **Time zone:** confirmed. Stored in UTC. Date filters and "today" use Ethiopia time (UTC+3).                                                                                                                                                                                                       | T6     |
| 7   | **Staff may create adjustments** (including `OPENING_STOCK`). Only Admin creates and edits products. **CSV import is Admin only** (was Admin and Manager).                                                                                                                                         | T7     |
| 8   | **Staff cannot open reports.** Manager sees the audit log of their own branch.                                                                                                                                                                                                                     | T8, T9 |
| 9   | **Effects of the table that differ from v0.2:** Manager may create and edit suppliers. Staff no longer see notifications or the low-stock page. Staff cannot approve or reject transfers. The Auditor has no access to sales, invoices, POs, transfers or returns.                                 | T2     |
| 10  | New audit actions `RETURN_REFUNDED` and `USER_LOGOUT`.                                                                                                                                                                                                                                             | T4, T5 |

---

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

| Role value       | Name                                   | Branch scope                |
| ---------------- | -------------------------------------- | --------------------------- |
| `ADMIN`          | Admin                                  | All branches, full control  |
| `BRANCH_MANAGER` | Branch Manager                         | Own branch only             |
| `STAFF`          | Staff (storekeeper and cashier duties) | Own branch only             |
| `AUDITOR`        | Auditor                                | All branches, **read-only** |

**Branch rule:** for `BRANCH_MANAGER` and `STAFF`, any `branchId` in the request must be their own branch, otherwise `403 FORBIDDEN`. If they leave an optional `branchId` out, the server uses their own. Exception: transfers involve two branches (see 6.9).

**Auditor rule:** one middleware rejects every `POST`, `PUT`, `PATCH` and `DELETE` from an `AUDITOR` with `403 FORBIDDEN`. Only two exceptions: `POST /api/auth/change-password` and `POST /api/auth/logout`.

### 1.4 Error format (one shape for every error)

```json
{
  "error": {
    "code": "INSUFFICIENT_STOCK",
    "message": "Not enough stock for product 12 at branch 1.",
    "details": [
      { "field": "items[0].quantity", "issue": "available 5, requested 8" }
    ]
  }
}
```

- `code` is stable and in English. **The frontend maps `code` to a translation key** to show Amharic or English text. `message` is for developers and logs only.
- `details` is optional. It is used mainly for validation errors.
- **Session rule for the frontend:** log the user out only when `code` is `UNAUTHENTICATED` or `ACCOUNT_DISABLED`. Do not treat every 401 as "session expired".

| HTTP | Code                     | Meaning                                                                   |
| ---- | ------------------------ | ------------------------------------------------------------------------- |
| 400  | `VALIDATION_ERROR`       | Missing or invalid input                                                  |
| 400  | `WRONG_CURRENT_PASSWORD` | Current password is wrong (change-password only)                          |
| 401  | `UNAUTHENTICATED`        | No token, bad token or expired token                                      |
| 401  | `INVALID_CREDENTIALS`    | Wrong username or password (login only)                                   |
| 403  | `FORBIDDEN`              | Logged in, but role or branch is not allowed                              |
| 403  | `ACCOUNT_DISABLED`       | User is deactivated (at login, or on the next request after deactivation) |
| 404  | `NOT_FOUND`              | Record does not exist                                                     |
| 404  | `PRODUCT_NOT_FOUND`      | Barcode lookup found nothing                                              |
| 409  | `DUPLICATE_SKU`          | SKU already used                                                          |
| 409  | `DUPLICATE_BARCODE`      | Barcode already used                                                      |
| 409  | `DUPLICATE_VALUE`        | Other unique field already used (username, etc.)                          |
| 409  | `INVALID_STATUS`         | Action not allowed in the current status                                  |
| 422  | `INSUFFICIENT_STOCK`     | Stock would go negative (thrown by `applyMovement`)                       |
| 422  | `OVER_RECEIVE`           | Receiving more than ordered                                               |
| 422  | `RETURN_EXCEEDS_SOLD`    | Return quantity above sold minus already returned                         |
| 500  | `SERVER_ERROR`           | Unexpected bug                                                            |

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
- **Sorting:** `?sort=field` or `?sort=-field` for descending **(proposed)**. Default sort is stated per endpoint.
- **Deactivate, not delete:** users, branches, products, suppliers and categories are never deleted. Use `isActive: false`. Lists return active records by default. Add `?includeInactive=true` to see all.
- **Stock is never written directly.** Every stock change goes through the stock service `applyMovement` (see 1.7). Endpoints below that change stock say so.

### 1.6 Permissions table (final, Team Decision T2)

**This table is the single source of truth for the "Who" of every endpoint.** "Own" means the user's own branch only. Where Manager or Staff is "Yes" on a branch-bound action, it also applies to their own branch only. In the endpoint sections, `A` = Admin, `M` = Branch Manager, `S` = Staff, `U` = Auditor.

| Action                                                  | Admin | Manager | Staff | Auditor        |
| ------------------------------------------------------- | ----- | ------- | ----- | -------------- |
| Company settings, VAT/TOT type and rate                 | Yes   | No      | No    | No             |
| Users and roles                                         | Yes   | No      | No    | No             |
| Branches                                                | Yes   | No      | No    | No             |
| Create / edit products and prices, categories           | Yes   | No      | No    | No             |
| Suppliers                                               | Yes   | Yes     | No    | No             |
| CSV import                                              | Yes   | No      | No    | No             |
| Set minimum stock level (per product, per branch)       | Yes   | Own     | No    | No             |
| Create purchase order                                   | Yes   | Yes     | Yes   | No             |
| Approve / reject purchase order                         | Yes   | Own     | No    | No             |
| Receive goods                                           | Yes   | Yes     | Yes   | No             |
| Sales and invoices                                      | Yes   | Yes     | Yes   | No             |
| Customer returns (create)                               | Yes   | Yes     | Yes   | No             |
| Mark a return as refunded                               | Yes   | Yes     | Yes   | No             |
| Stock adjustments (create)                              | Yes   | Yes     | Yes   | No             |
| Request a transfer (destination branch)                 | Yes   | Yes     | Yes   | No             |
| Approve / reject transfer (source branch)               | Yes   | Own     | No    | No             |
| Ship transfer (source) / receive transfer (destination) | Yes   | Yes     | Yes   | No             |
| View stock, movements, adjustments                      | Yes   | Own     | Own   | All, read-only |
| Reports                                                 | Yes   | Own     | No    | All, read-only |
| Audit log                                               | Yes   | Own     | No    | All, read-only |
| Low-stock notifications                                 | Yes   | Own     | No    | No             |
| Dashboard, change own password                          | Yes   | Yes     | Yes   | Yes            |

**Not covered by the team table. I applied these proposals and listed them in section 13 for confirmation:**

- **Reading reference data** (branches, categories, products): all roles, because forms, filters and the sales screen need it. Reading suppliers: A, M, S, because Staff pick a supplier when they create a PO.
- **Viewing purchase orders, transfers, returns, and the sales list and invoices:** A (all), M (own), S (own). The Auditor gets no access, matching the "No" for sales and invoices.
- **Notifications and the low-stock page** follow the row "Low-stock notifications": A, M (own).

### 1.7 Stock service (Kidus)

Every endpoint that changes stock calls:

```
applyMovement({ productId, branchId, quantity, type, reason, referenceId, userId })  ->  new quantity
```

- It runs inside the caller's database transaction, locks the stock row, and writes the stock movement.
- If stock would go negative it throws `INSUFFICIENT_STOCK`. The API returns it as `422 INSUFFICIENT_STOCK`.
- Movement `type` values: `OPENING_STOCK`, `PURCHASE_RECEIPT`, `SALE`, `CUSTOMER_RETURN`, `ADJUSTMENT`, `TRANSFER_OUT`, `TRANSFER_IN`.

### 1.8 Stock rows exist for every product and branch

- When a **product** is created, the server creates a stock row with `quantity` 0 for **every branch**.
- When a **branch** is created, it gets a stock row with `quantity` 0 for **every product**.
- Both happen in the same transaction as the create. So `GET /api/stock` always returns a row for each product and branch, and stock lookups never return "no row".

---

## 2. Endpoint overview

"Who" follows the permissions table in 1.6. **(p)** marks a proposal for something the table does not cover.

| #   | Method     | URL                                                             | Who                                                 | Week |
| --- | ---------- | --------------------------------------------------------------- | --------------------------------------------------- | ---- |
| 1   | POST       | `/api/auth/login`                                               | Anyone                                              | 1    |
| 2   | GET        | `/api/auth/me`                                                  | All                                                 | 1    |
| 3   | POST       | `/api/auth/change-password`                                     | All                                                 | 1    |
| 4   | POST       | `/api/auth/logout`                                              | All                                                 | 1    |
| 5   | GET, POST  | `/api/users`                                                    | A                                                   | 1    |
| 6   | GET, PATCH | `/api/users/:id`                                                | A                                                   | 1    |
| 7   | POST       | `/api/users/:id/reset-password`                                 | A                                                   | 1    |
| 8   | GET, POST  | `/api/branches`                                                 | GET all (p), POST A                                 | 1    |
| 9   | GET, PATCH | `/api/branches/:id`                                             | GET all (p), PATCH A                                | 1    |
| 10  | GET, POST  | `/api/categories`                                               | GET all (p), POST A                                 | 1    |
| 11  | PATCH      | `/api/categories/:id`                                           | A                                                   | 1    |
| 12  | GET, POST  | `/api/suppliers`                                                | GET A, M, S (p), POST A, M                          | 1    |
| 13  | GET, PATCH | `/api/suppliers/:id`                                            | GET A, M, S (p), PATCH A, M                         | 1    |
| 14  | GET, POST  | `/api/products`                                                 | GET all (p), POST A                                 | 1    |
| 15  | GET, PATCH | `/api/products/:id`                                             | GET all (p), PATCH A                                | 1    |
| 16  | GET        | `/api/products/by-barcode/:barcode`                             | A, M, S                                             | 1    |
| 17  | GET, PUT   | `/api/settings/company`                                         | A                                                   | 2    |
| 18  | GET        | `/api/stock`                                                    | A, M own, S own, U all                              | 2    |
| 19  | GET        | `/api/stock/consolidated`                                       | A, U                                                | 2    |
| 20  | PUT        | `/api/stock/:branchId/:productId/thresholds`                    | A, M own                                            | 2    |
| 21  | GET        | `/api/stock-movements`                                          | A, M own, S own, U all                              | 2    |
| 22  | GET, POST  | `/api/purchase-orders`                                          | GET A, M own, S own (p), POST A, M, S               | 2    |
| 23  | GET        | `/api/purchase-orders/:id`                                      | A, M own, S own (p)                                 | 2    |
| 24  | POST       | `/api/purchase-orders/:id/approve`, `/reject`                   | A, M own                                            | 2    |
| 25  | POST       | `/api/purchase-orders/:id/receive`                              | A, M, S                                             | 2    |
| 26  | GET, POST  | `/api/sales`                                                    | A, M, S                                             | 2    |
| 27  | GET        | `/api/sales/:id` (invoice)                                      | A, M, S                                             | 2    |
| 28  | GET, POST  | `/api/adjustments`                                              | GET A, M own, S own, U all; POST A, M, S            | 2    |
| 29  | GET, POST  | `/api/transfers`                                                | GET A, M own, S own (p); POST A, M, S (destination) | 2    |
| 30  | GET        | `/api/transfers/:id`                                            | A, M own, S own (p)                                 | 2    |
| 31  | POST       | `/api/transfers/:id/approve`, `/reject`                         | A, M (source)                                       | 2    |
| 32  | POST       | `/api/transfers/:id/ship` (source), `/receive` (destination)    | A, M, S                                             | 2    |
| 33  | GET        | `/api/notifications`                                            | A, M own                                            | 2    |
| 34  | POST       | `/api/notifications/:id/read`, `/api/notifications/read-all`    | A, M own                                            | 2    |
| 35  | GET        | `/api/low-stock`                                                | A, M own                                            | 2    |
| 36  | GET        | `/api/audit-logs`                                               | A, M own, U all                                     | 2-3  |
| 37  | GET        | `/api/dashboard`                                                | All (role-based)                                    | 3    |
| 38  | GET        | `/api/reports/stock`, `/sales`, `/movements`                    | A, M own, U all                                     | 3    |
| 39  | POST       | `/api/sales/:id/returns`                                        | A, M, S                                             | 3    |
| 40  | GET        | `/api/returns`, `/api/returns/:id`                              | A, M own, S own (p)                                 | 3    |
| 41  | PATCH      | `/api/returns/:id/refund`                                       | A, M, S                                             | 3    |
| 42  | GET, POST  | `/api/import/products/template`, `/api/import/products?dryRun=` | A                                                   | 3    |

**Scope rule:** `ADMIN` and `AUDITOR` may read any branch they have access to (filter with `?branchId=`). `BRANCH_MANAGER` and `STAFF` always get their own branch only.

---

## 3. Authentication (Week 1)

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
{
  "id": 2,
  "username": "abel",
  "fullName": "Abel Tesfaye",
  "role": "STAFF",
  "branchId": 1,
  "branchName": "Bole Branch",
  "isActive": true
}
```

The password hash is never returned.

### POST /api/users

Request:

```json
{
  "username": "abel",
  "fullName": "Abel Tesfaye",
  "password": "temp12345",
  "role": "STAFF",
  "branchId": 1
}
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

`GET /api/branches` Query: `?q=`, `?includeInactive=true`. Not paginated by default **(proposed)**, because the list is short.

```json
{
  "id": 1,
  "name": "Bole Branch",
  "code": "BOLE",
  "address": "Bole, Addis Ababa",
  "phone": "+251911000000",
  "isActive": true
}
```

`POST /api/branches` Request: `{ "name", "code", "address", "phone" }` (`name` required). Success 201.

- **Side effect:** creates a stock row with `quantity` 0 for every product (see 1.8).

`GET /api/branches/:id`, `PATCH /api/branches/:id` (any field, including `isActive`).
Errors: `400`, `404`, `409 DUPLICATE_VALUE`.

### 5.2 Categories

`GET /api/categories` Query: `?q=`, `?includeInactive=true`.

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
{
  "id": 5,
  "name": "Habesha Wholesale",
  "contactName": "Dawit",
  "phone": "+251911223344",
  "tin": "0012345678",
  "address": "Merkato, Addis Ababa",
  "isActive": true
}
```

`POST /api/suppliers` Request: `{ "name", "contactName", "phone", "tin", "address" }` (`name` required).
`GET /api/suppliers/:id`, `PATCH /api/suppliers/:id`.
Errors: `400`, `404`.

### 5.4 Products

Product object:

```json
{
  "id": 12,
  "name": "Coca-Cola 500ml",
  "sku": "BEV-0012",
  "barcode": "6161100010123",
  "categoryId": 3,
  "categoryName": "Beverages",
  "unit": "bottle",
  "costPrice": 18.0,
  "sellingPrice": 25.0,
  "isActive": true
}
```

**`sellingPrice` includes tax** (VAT or TOT, whichever the company uses). The system never adds tax on top of it (see 6.6).

#### GET /api/products

**Who:** All roles (read) **(proposed)**.
Query: `?q=` (name, SKU or barcode), `?categoryId=`, `?includeInactive=true`, `?branchId=`, `?page`, `?limit`. Default sort: `name`.

- When `branchId` is given (or implied for Manager and Staff), each product also has `"quantity": 40`, the stock in that branch. This lets the sales screen show availability.

#### GET /api/products/by-barcode/:barcode

**Purpose:** Barcode scan on sales, receiving and transfer screens.
**Who:** A, M, S. Query: `?branchId=` (defaults to own branch).
Success (200): product object including `quantity` for the branch.
Errors: `404 PRODUCT_NOT_FOUND` (the frontend shows the "product not found" message). Inactive products also return `PRODUCT_NOT_FOUND`.

#### POST /api/products

**Who:** Admin.
Request:

```json
{
  "name": "Coca-Cola 500ml",
  "sku": "BEV-0012",
  "barcode": "6161100010123",
  "categoryId": 3,
  "unit": "bottle",
  "costPrice": 18.0,
  "sellingPrice": 25.0
}
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

**Status: DRAFT, to be locked Friday 9 October 2026.**

### 6.1 Company settings (T1)

**Who:** Admin only, for both read and change. Other roles get the company name, address and TIN for printing inside `GET /api/sales/:id`.

`GET /api/settings/company` and `PUT /api/settings/company`.

```json
{
  "companyName": "ABC Trading PLC",
  "address": "Bole, Addis Ababa",
  "tin": "0012345678",
  "taxType": "VAT",
  "taxRate": 15
}
```

- `taxType` is `"VAT"` or `"TOT"`. `taxRate` is a **percentage number**: `15` means 15% **(proposed format, K-H)**.
- **Defaults:** VAT 15 and TOT 2. They are stored as starting values in the settings data. **No tax rate is written in the code.** If the tax rules change, the Admin edits the setting.
- `PUT` requires both `taxType` and `taxRate` (0 to 100). The frontend can pre-fill the default rate when the Admin switches the type.
- Sales use the values saved at the time of the sale. **Each sale stores its own `taxType` and `taxRate`**, so changing the setting never changes old invoices.

Errors: `400 VALIDATION_ERROR`, `403 FORBIDDEN`.

### 6.2 Stock

#### GET /api/stock

**Who:** A (all branches), M and S (own branch), U (all, read only).
Query: `?branchId=`, `?productId=`, `?q=`, `?lowOnly=true`, `?page`, `?limit`.

```json
{
  "branchId": 1,
  "productId": 12,
  "productName": "Coca-Cola 500ml",
  "sku": "BEV-0012",
  "quantity": 40,
  "minQuantity": 10,
  "maxQuantity": 100,
  "costPrice": 18.0,
  "stockValue": 720.0
}
```

- `stockValue` = `quantity` × `costPrice`.
- For Admin and Auditor with no `branchId`, rows for all branches are returned.
- `minQuantity` and `maxQuantity` are `null` until someone sets them **(proposed, K-C)**.
- Because of 1.8, every product and branch pair has a row, even with `quantity` 0.

#### GET /api/stock/consolidated

**Who:** A, U. Total per product across branches.

```json
{
  "productId": 12,
  "productName": "Coca-Cola 500ml",
  "totalQuantity": 120,
  "branches": [{ "branchId": 1, "branchName": "Bole", "quantity": 40 }]
}
```

#### PUT /api/stock/:branchId/:productId/thresholds

**Who:** A, M (own branch). Sets the minimum (and optional maximum) quantity for one product in one branch.
Request: `{ "minQuantity": 10, "maxQuantity": 100 }` (`maxQuantity` optional, must be at least `minQuantity`; send `null` to clear).
Success (200): the stock row. Errors: `400`, `403`, `404`.

### 6.3 Stock movements (read only)

#### GET /api/stock-movements

**Who:** A (all branches), M and S (own branch), U (all, read only).
Query: `?productId=`, `?branchId=`, `?type=`, `?from=`, `?to=`, `?page`, `?limit`. Default sort: `-createdAt`.
Fields from Kidus: `id`, `productId`, `branchId`, `type`, `quantityChange`, `quantityAfter`, `referenceType`, `referenceId`, `reason`, `userId`, `createdAt`. The API adds `productName` and `createdBy`.

```json
{
  "id": 901,
  "productId": 12,
  "productName": "Coca-Cola 500ml",
  "branchId": 1,
  "type": "SALE",
  "quantityChange": -2,
  "quantityAfter": 38,
  "referenceType": "SALE",
  "referenceId": 301,
  "reason": null,
  "createdBy": { "id": 2, "name": "Abel Tesfaye" },
  "createdAt": "2026-10-05T09:30:00Z"
}
```

- `quantityChange` is the signed change (negative for stock out). `quantityAfter` is the stock after the change.
- These two names are the **only exception** to the `quantity` naming rule, because they are the stored column names. Hemen: please confirm you are fine with this.

### 6.4 Notifications and low stock

**Low-stock rule (K7).** A person with permission (A, or M for own branch) sets `minQuantity` per product per branch. When a stock change makes `quantity` drop to **or below** `minQuantity`, the server creates **one** `LOW_STOCK` notification. No further alert is created for that product and branch until `quantity` goes **above** `minQuantity` and drops again. Rows with `minQuantity` `null` never alert.

#### GET /api/notifications

**Who:** A (all branches) and M (own branch). Staff and Auditor: no access (T2). Query: `?unread=true`, `?page`, `?limit`.

```json
{
  "data": [
    {
      "id": 7,
      "type": "LOW_STOCK",
      "branchId": 1,
      "productId": 12,
      "productName": "Coca-Cola 500ml",
      "quantity": 8,
      "minQuantity": 10,
      "isRead": false,
      "createdAt": "2026-10-05T09:30:00Z"
    }
  ],
  "unreadCount": 3,
  "page": 1,
  "limit": 20,
  "total": 12
}
```

The bell reads `unreadCount`.

#### POST /api/notifications/:id/read and POST /api/notifications/read-all

**Who:** A, M (own branch). Success (200): `{ "success": true }`.

#### GET /api/low-stock

**Who:** A (all branches), M (own branch). Same rule as notifications.
Query: `?branchId=`. Items at or below `minQuantity`, calculated live from stock (it does not depend on notifications).

```json
{
  "branchId": 1,
  "productId": 12,
  "productName": "Coca-Cola 500ml",
  "quantity": 8,
  "minQuantity": 10,
  "maxQuantity": 100,
  "suggestedReorderQuantity": 92
}
```

`suggestedReorderQuantity` = `maxQuantity - quantity` if `maxQuantity` is set, otherwise `2 × minQuantity - quantity`.

### 6.5 Purchase orders

Statuses: `PENDING_APPROVAL`, `APPROVED`, `REJECTED`, `PARTIALLY_RECEIVED`, `RECEIVED`.
**Approval is part of Week 2.** Every new PO starts as `PENDING_APPROVAL`. An Admin or the Branch Manager of the PO's branch approves or rejects it. A PO can be received only after it is `APPROVED`. **A Manager or Admin may approve a PO they created themselves** (decided, T3).

PO object:

```json
{
  "id": 40,
  "poNumber": "PO-000040",
  "supplierId": 5,
  "supplierName": "Habesha Wholesale",
  "branchId": 1,
  "status": "PENDING_APPROVAL",
  "totalCost": 1800.0,
  "items": [
    {
      "id": 81,
      "productId": 12,
      "productName": "Coca-Cola 500ml",
      "quantity": 100,
      "receivedQuantity": 0,
      "unitCost": 18.0
    }
  ],
  "createdBy": { "id": 2, "name": "Abel Tesfaye" },
  "createdAt": "2026-10-05T09:30:00Z",
  "approvedBy": null,
  "approvedAt": null,
  "rejectedBy": null,
  "rejectedAt": null
}
```

- `quantity` is the ordered quantity. `receivedQuantity` is how much has arrived so far.
- `approvedBy/approvedAt` or `rejectedBy/rejectedAt` are filled according to the decision, the other pair stays `null`.
- Each receiving is also recorded as a stock movement with user and time.

#### POST /api/purchase-orders

**Who:** A, M, S (own branch).

```json
{
  "supplierId": 5,
  "branchId": 1,
  "items": [{ "productId": 12, "quantity": 100, "unitCost": 18.0 }]
}
```

Success (201): the PO object.
Errors: `400 VALIDATION_ERROR` (quantity must be above 0), `403`, `404`.

#### GET /api/purchase-orders

**Who:** A (all branches), M and S (own branch) **(proposed)**.
Query: `?status=`, `?supplierId=`, `?branchId=`, `?from=`, `?to=`, `?page`, `?limit`. Default sort: `-createdAt`. The `items` array is omitted in the list.

#### GET /api/purchase-orders/:id

Success (200): full PO object.

#### POST /api/purchase-orders/:id/approve and /reject

**Who:** A, M (own branch). Reject request: `{ "reason": "Too expensive" }` (optional **(TBC Kidus: needs a column to store it, otherwise we drop `reason`)**). Only from `PENDING_APPROVAL`, else `409 INVALID_STATUS`.
Success (200): the updated PO.

#### POST /api/purchase-orders/:id/receive

**Who:** A, M, S (own branch). **Changes stock** through `applyMovement` (type `PURCHASE_RECEIPT`), in one transaction.
Request:

```json
{ "items": [{ "itemId": 81, "quantity": 60 }] }
```

- Week 2 (all-or-nothing): `items` may be omitted, and everything remaining is received.
- Week 3 (partial): `quantity` per item is what arrived now. The PO becomes `PARTIALLY_RECEIVED`, then `RECEIVED` when every item is complete.

Success (200): the updated PO.
Errors: `409 INVALID_STATUS` (not `APPROVED` or `PARTIALLY_RECEIVED`), `422 OVER_RECEIVE`, `400`, `403`, `404`.

### 6.6 Sales and invoices

#### POST /api/sales

**Who:** A, M, S (own branch). **Changes stock.** In ONE database transaction the server:

1. locks and increments the invoice counter row (see below),
2. works out the tax from the prices (prices already include tax),
3. saves the sale,
4. deducts stock for each item through `applyMovement` (type `SALE`).

If anything fails, everything is rolled back, **including the invoice counter**, so there are no gaps. Low-stock notifications are created after a successful sale.

**Invoice numbers (K3):** one company-wide sequence, format `INV-` plus 6 digits (`INV-000001`). Assigned from a locked counter row inside the sale transaction, not from a database sequence, because a normal sequence skips numbers when a transaction rolls back.

Request:

```json
{
  "branchId": 1,
  "customerName": "Almaz",
  "items": [{ "productId": 12, "quantity": 2 }]
}
```

- `customerName` is optional.
- **Prices come from the server** (the product's current `sellingPrice`, which already includes tax). The client does not send prices.

Success (201):

```json
{
  "id": 301,
  "invoiceNumber": "INV-000045",
  "branchId": 1,
  "branchName": "Bole Branch",
  "customerName": "Almaz",
  "createdBy": { "id": 2, "name": "Abel Tesfaye" },
  "items": [
    {
      "id": 410,
      "productId": 12,
      "productName": "Coca-Cola 500ml",
      "quantity": 2,
      "unitPrice": 25.0,
      "lineTotal": 50.0
    }
  ],
  "netAmount": 43.48,
  "taxType": "VAT",
  "taxRate": 15,
  "taxAmount": 6.52,
  "total": 50.0,
  "createdAt": "2026-10-05T09:30:00Z"
}
```

- The cashier on the invoice is `createdBy.name`.
- The invoice shows `netAmount`, `taxAmount` and `total`.

**Tax rule (T1).** Selling prices **include** the tax. The system never adds tax on top.

- `total` = the sum of the line prices (`lineTotal`).
- `taxAmount` = `total × taxRate / (100 + taxRate)`, rounded to 2 decimals. It is calculated once on the invoice total, not per line, so rounding does not drift.
- `netAmount` = `total - taxAmount`.
- `taxType` and `taxRate` come from the company settings (6.1) and are saved on the sale.
- **Example, VAT 15%:** total 1,150.00 gives `taxAmount` 150.00 (1,150 × 15 / 115) and `netAmount` 1,000.00. The customer pays 1,150.00.
- **Example, TOT 2%:** total 1,020.00 gives `taxAmount` 20.00 (1,020 × 2 / 102) and `netAmount` 1,000.00.

Errors: `400 VALIDATION_ERROR`, `403`, `404`, `422 INSUFFICIENT_STOCK` (with `details` per item).

#### GET /api/sales

**Who:** A (all branches), M and S (own branch). Auditor: no access (T2).
Query: `?branchId=`, `?from=`, `?to=`, `?invoiceNumber=`, `?page`, `?limit`. Default sort: `-createdAt`. Items omitted in the list.

#### GET /api/sales/:id

Same object as the POST response, plus company fields for printing and `returnedQuantity` per item (used by the returns screen):

```json
{
  "...": "...",
  "items": [{ "id": 410, "quantity": 2, "returnedQuantity": 0, "...": "..." }],
  "company": {
    "companyName": "ABC Trading PLC",
    "address": "...",
    "tin": "0012345678"
  }
}
```

### 6.7 Stock adjustments

#### POST /api/adjustments

**Who:** A, M, S (own branch), for every reason including `OPENING_STOCK` (decided, T2 and T7; the Auditor reviews adjustments). **Changes stock** through `applyMovement`.

```json
{
  "branchId": 1,
  "productId": 12,
  "quantity": -3,
  "reason": "DAMAGE",
  "note": "Dropped in storage"
}
```

- `quantity` is signed: negative decreases stock, positive increases it. It cannot be 0.
- `reason` is required: `DAMAGE`, `EXPIRY`, `LOSS`, `RECOUNT`, `OTHER`, `OPENING_STOCK`. `note` is optional.
- **`OPENING_STOCK`:** `quantity` must be positive. The stock movement is recorded with type `OPENING_STOCK` (not `ADJUSTMENT`). This is how opening stock is entered if CSV import is cut.

Success (201):

```json
{
  "id": 15,
  "branchId": 1,
  "productId": 12,
  "productName": "Coca-Cola 500ml",
  "quantity": -3,
  "reason": "DAMAGE",
  "note": "Dropped in storage",
  "createdBy": { "id": 2, "name": "Abel Tesfaye" },
  "createdAt": "2026-10-05T09:30:00Z"
}
```

Errors: `400 VALIDATION_ERROR` (missing reason, zero quantity, negative `OPENING_STOCK`), `403`, `404`, `422 INSUFFICIENT_STOCK`.

#### GET /api/adjustments

**Who:** A (all branches), M and S (own branch), U (all, read only). Query: `?branchId=`, `?productId=`, `?reason=`, `?from=`, `?to=`, `?page`, `?limit`.

### 6.8 Audit log

#### GET /api/audit-logs

**Who:** A and U (all branches, U read only), M (own branch only, decided T9). Staff: no access. Read only, with no endpoint to change or delete entries.
Query: `?userId=`, `?entityType=`, `?productId=`, `?action=`, `?branchId=`, `?from=`, `?to=`, `?page`, `?limit`. Default sort: `-createdAt`.
Fields from Kidus: `id`, `userId`, `action`, `entityType`, `entityId`, `branchId`, `oldValue`, `newValue` (both JSON), `createdAt`. The API adds `createdBy`.

```json
{
  "id": 5001,
  "createdBy": { "id": 2, "name": "Abel Tesfaye" },
  "action": "SALE_CREATED",
  "entityType": "SALE",
  "entityId": 301,
  "branchId": 1,
  "oldValue": null,
  "newValue": { "invoiceNumber": "INV-000045", "total": 57.5 },
  "createdAt": "2026-10-05T09:30:00Z"
}
```

Entity types (K4): `USER`, `PRODUCT`, `SUPPLIER`, `BRANCH`, `PO`, `SALE`, `RETURN`, `ADJUSTMENT`, `TRANSFER`, `IMPORT`.
Action names (K4): `USER_CREATED`, `USER_UPDATED`, `USER_LOGOUT`, `PRODUCT_CREATED`, `PRODUCT_UPDATED`, `PRICE_CHANGED`, `SUPPLIER_UPDATED`, `BRANCH_UPDATED`, `STOCK_MOVEMENT`, `PO_CREATED`, `PO_APPROVED`, `PO_RECEIVED`, `SALE_CREATED`, `RETURN_CREATED`, `RETURN_REFUNDED`, `ADJUSTMENT_CREATED`, `TRANSFER_REQUESTED`, `TRANSFER_APPROVED`, `TRANSFER_SHIPPED`, `TRANSFER_RECEIVED`, `IMPORT_CONFIRMED`.
Not in the list yet: `PO_REJECTED`, `TRANSFER_REJECTED`. **(TBC Kidus: add them?)**

### 6.9 Transfers

Statuses: `REQUESTED`, `APPROVED`, `REJECTED`, `SHIPPED`, `RECEIVED`.
**Direction:** the branch that **needs** stock requests it. `toBranchId` is the requester (destination). `fromBranchId` is the branch that sends stock (source).

| Action  | Endpoint                          | Who                                   | From status | Stock effect                            |
| ------- | --------------------------------- | ------------------------------------- | ----------- | --------------------------------------- |
| Request | `POST /api/transfers`             | A, M, S of the **destination** branch | (new)       | none                                    |
| Approve | `POST /api/transfers/:id/approve` | A, M of the **source** branch         | `REQUESTED` | none                                    |
| Reject  | `POST /api/transfers/:id/reject`  | A, M of the **source** branch         | `REQUESTED` | none                                    |
| Ship    | `POST /api/transfers/:id/ship`    | A, M, S of the **source** branch      | `APPROVED`  | source stock deducted (`TRANSFER_OUT`)  |
| Receive | `POST /api/transfers/:id/receive` | A, M, S of the **destination** branch | `SHIPPED`   | destination stock added (`TRANSFER_IN`) |

Who is final (T2). Staff cannot approve or reject. Manager approves or rejects only for their own (source) branch.

Transfer object:

```json
{
  "id": 9,
  "fromBranchId": 2,
  "fromBranchName": "Piassa",
  "toBranchId": 1,
  "toBranchName": "Bole",
  "status": "REQUESTED",
  "items": [
    { "productId": 12, "productName": "Coca-Cola 500ml", "quantity": 30 }
  ],
  "requestedBy": { "id": 2, "name": "Abel Tesfaye" },
  "requestedAt": "2026-10-05T09:30:00Z",
  "approvedBy": null,
  "approvedAt": null,
  "rejectedBy": null,
  "rejectedAt": null,
  "shippedBy": null,
  "shippedAt": null,
  "receivedBy": null,
  "receivedAt": null
}
```

Each step fills its own pair when it happens. Approve and reject never fill both.

#### POST /api/transfers

```json
{
  "fromBranchId": 2,
  "toBranchId": 1,
  "items": [{ "productId": 12, "quantity": 30 }]
}
```

Staff and Manager: `toBranchId` must be their own branch. Success (201): the transfer object.
Errors: `400` (same branch, quantity below 1), `403`, `404`.

#### GET /api/transfers

**Who:** A (all), M and S (own branch, as source or destination) **(proposed)**.
Query: `?status=`, `?direction=incoming|outgoing` (relative to the user's branch), `?branchId=`, `?from=`, `?to=`, `?page`, `?limit`. Manager and Staff see transfers where their branch is source or destination.

#### GET /api/transfers/:id

Success (200): the transfer object.

#### Action endpoints (approve, reject, ship, receive)

Request body: empty, except reject, which accepts `{ "reason": "..." }` **(TBC Kidus: needs a column to store it)**. Success (200): the updated transfer.
Errors: `403`, `404`, `409 INVALID_STATUS`, `422 INSUFFICIENT_STOCK` (ship only).
Stock changes use `applyMovement` in one transaction. A low-stock notification is created after shipping if the source drops to or below its minimum.

---

## 7. Dashboard (Week 3, DRAFT)

### GET /api/dashboard

**Who:** All roles. Returns data matching the user's role. Optional `?branchId=` for Admin.

```json
{
  "role": "BRANCH_MANAGER",
  "widgets": {
    "stockValue": 125000.0,
    "salesToday": { "count": 14, "total": 8200.5 },
    "lowStockItems": [
      {
        "productId": 12,
        "productName": "...",
        "quantity": 8,
        "minQuantity": 10
      }
    ],
    "pendingApprovals": { "purchaseOrders": 2, "transfers": 1 },
    "transfersInTransit": 1
  }
}
```

Widgets by role (from the SRS):

| Role           | Widgets                                                                                                                                     |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Admin          | `stockValue`, `salesSummary`, `branchComparison`, `lowStockCount`, `recentActivity`                                                         |
| Branch Manager | `stockValue`, `salesToday`, `lowStockItems`, `pendingApprovals`, `transfersInTransit`                                                       |
| Staff          | `salesToday` (count, total), `expectedPurchaseOrders`, `pendingTransfers` (`lowStockItems` removed: Staff have no low-stock access, see N3) |
| Auditor        | `recentAuditActivity`, `recentAdjustments`                                                                                                  |

Exact shapes: **TBC Hemen (H1)**.

---

## 8. Reports and CSV export (Week 3, DRAFT)

**Who:** A (all branches), M (own branch), U (all branches, read only). Staff: no access (decided, T8). Staff use the dashboard.
Common query: `?branchId=`, `?productId=`, `?from=`, `?to=`, `?page`, `?limit`, `?format=json|csv` (default `json`).

| Endpoint                     | Rows contain                                                          |
| ---------------------------- | --------------------------------------------------------------------- |
| `GET /api/reports/stock`     | product, SKU, branch, quantity, cost price, stock value               |
| `GET /api/reports/sales`     | invoice number, date, branch, cashier (`createdBy`), net, tax, total  |
| `GET /api/reports/movements` | date, product, branch, type, quantity change, reference, user, reason |

Response for `json`: `{ "data": [...], "totals": { ... }, "page", "limit", "total" }`.
`format=csv`: returns `text/csv; charset=utf-8` **with a UTF-8 BOM**, so Amharic opens correctly in Excel. It exports **all rows matching the current filters** (not only one page) **(proposed)**. Exact columns: **TBC Hemen (H2)**.

---

## 9. Customer returns (Week 3, DRAFT) (T4)

A return records items and quantities linked to the original invoice, with an optional reason. The system works out the refund amount. Staff pay the customer **outside the system** and then mark the return as refunded. There are no payment methods and no accounting.

Return object:

```json
{
  "id": 4,
  "saleId": 301,
  "invoiceNumber": "INV-000045",
  "branchId": 1,
  "items": [
    {
      "saleItemId": 410,
      "productName": "Coca-Cola 500ml",
      "quantity": 1,
      "unitPrice": 25.0,
      "lineTotal": 25.0
    }
  ],
  "reason": "Damaged on delivery",
  "refundAmount": 25.0,
  "refundStatus": "PENDING_REFUND",
  "createdBy": { "id": 2, "name": "Abel Tesfaye" },
  "createdAt": "2026-10-05T10:10:00Z",
  "refundedBy": null,
  "refundedAt": null
}
```

- `refundStatus` is `PENDING_REFUND` when created and `REFUNDED` after staff mark it.
- `refundAmount` = the sum of (returned `quantity` × `unitPrice` on the **original invoice**). `unitPrice` already includes tax, so the refund is the price the customer paid. The server calculates it. The client never sends it.

### POST /api/sales/:id/returns

**Who:** A, M, S (own branch). **Changes stock** through `applyMovement` (type `CUSTOMER_RETURN`), linked to the original sale.

```json
{
  "items": [{ "saleItemId": 410, "quantity": 1 }],
  "reason": "Damaged on delivery"
}
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
{
  "dryRun": true,
  "totalRows": 120,
  "validRows": 117,
  "invalidRows": 3,
  "rows": [
    {
      "row": 5,
      "valid": false,
      "data": { "sku": "BEV-0012", "name": "..." },
      "errors": [
        {
          "field": "sku",
          "code": "DUPLICATE_SKU",
          "message": "SKU already exists"
        }
      ]
    }
  ]
}
```

**`dryRun=false`**: the file is validated again and the **valid rows are imported**. Invalid rows are skipped. Success (200):

```json
{
  "dryRun": false,
  "imported": 117,
  "skipped": 3,
  "skippedRows": [
    { "row": 5, "errors": [{ "field": "sku", "code": "DUPLICATE_SKU" }] }
  ]
}
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

## 12. Change log

| Version | Date       | Change                                                                                                                                                                                                                                                                                                  | Agreed by                                                                  |
| ------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| v0.1    | 5 Oct 2026 | First draft                                                                                                                                                                                                                                                                                             | n/a                                                                        |
| v0.2    | 7 Oct 2026 | Kidus's decisions K1-K7 applied. Review changes 1-9 applied: one name `quantity`, one `{ id, name }` shape for who did it, `WRONG_CURRENT_PASSWORD` as 400, PO approval in Week 2, stateless CSV import, locked invoice counter, `OPENING_STOCK` reason, approval and lock rules, Markdown in the repo. | Pending: Kidus (data fields), Hemen, Melat                                 |
| v0.3    | 8 Oct 2026 | Team Decisions T1-T9 applied (see section 0). Tax included in price, final permissions table, return refunds, `USER_LOGOUT` and `RETURN_REFUNDED`, CSV import Admin only.                                                                                                                               | Pending: Kidus (data fields), Hemen, Melat. Week 2 lock planned Fri 9 Oct. |

---

## 13. What is still missing (open decisions)

### Resolved in v0.3

T1 (tax rule), T2 (permissions table), T3 (PO approval), T4 (returns and refunds), T5 (login), T6 (time zone), T7 (Staff adjustments, products, CSV import), T8 (Staff and reports), T9 (Manager and audit log). From v0.2: K1 to K7.

### Still open for Kidus

| #   | Question                                                                                                                                                                                                                                                                                                    |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| K-A | **Is `quantity` in `applyMovement` signed**, or does `type` decide the direction (`SALE` always out, `PURCHASE_RECEIPT` always in)? This decides how the adjustment endpoint calls it.                                                                                                                      |
| K-B | `applyMovement` takes `referenceId` but not `referenceType`. Is `referenceType` derived from `type`?                                                                                                                                                                                                        |
| K-C | What is the default `minQuantity` for new stock rows? I propose `null` (no alert until someone sets it). With 0, a row at quantity 0 would count as low stock.                                                                                                                                              |
| K-D | **Reject reason**: do POs and transfers have a column to store it? If not, I drop `reason` from reject.                                                                                                                                                                                                     |
| K-E | PO and transfer decisions: you listed `approvedBy/At (or rejected)`. I show `approvedBy/At` and `rejectedBy/At` as separate pairs in the API and map them from your columns, but please confirm how rejection is stored.                                                                                    |
| K-F | Audit: add `PO_REJECTED` and `TRANSFER_REJECTED`? Also `STOCK_MOVEMENT` has no matching entity type, and movements already have their own history. Keep it?                                                                                                                                                 |
| K-G | **New columns from T1 and T4.** The sale must store `taxType`, `taxRate`, `taxAmount` and `netAmount` at the time of the sale, so later setting changes do not alter old invoices. The return needs `reason`, `refundAmount`, `refundStatus`, `refundedBy` and `refundedAt`. Please add them to the schema. |
| K-H | **Company settings columns.** `taxType` and `taxRate` (I propose the rate as a percentage number, 15 means 15%). Where do the defaults VAT 15 and TOT 2 live? I assume in the seed data, since no rate may be in the code.                                                                                  |

### New gaps found while applying the T2 table (the team decides; Kidus has the final call)

| #   | Gap                                                                                                                                                                                                                                                                                                | My proposal (already applied above)                                                                                                                                             |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| N1  | The table says Branches, Products and Categories are "No" for everyone but Admin, and Suppliers "No" for Staff. But Staff and Manager need to read products (sales), branches (transfer requests, filters) and suppliers (choosing a supplier on a PO). The Auditor needs names in report filters. | The table means **manage**. All roles can **read** branches, categories and products. A, M, S can read suppliers.                                                               |
| N2  | The table lists create and action rows only. Who may **view** purchase orders, transfers and returns, and the sales list?                                                                                                                                                                          | A all, M own, S own. The Auditor has no access, because the table gives the Auditor "No" on sales and invoices and the Auditor sees activity through reports and the audit log. |
| N3  | The SRS Staff dashboard has a `lowStockItems` widget, but T2 says Staff have no low-stock notifications.                                                                                                                                                                                           | Remove `lowStockItems` from the Staff dashboard.                                                                                                                                |
| N4  | `OPENING_STOCK` is an adjustment reason. The table lets Staff create adjustments, so Staff can enter opening stock.                                                                                                                                                                                | Allow it (decided by the table). Please confirm this is intended, because it lets Staff add stock.                                                                              |
| N5  | A user deactivated during a session is blocked on the next request (T5). Which error?                                                                                                                                                                                                              | `403 ACCOUNT_DISABLED`, and the frontend logs out on it (see 1.4).                                                                                                              |
| N6  | Do the sales report and the dashboard sales totals subtract refunded returns?                                                                                                                                                                                                                      | Not in the first version. Reports show sales as invoiced. Returns are shown separately.                                                                                         |

### From Hemen

| #   | Item                                                                                                                                                                             |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| H1  | Dashboard response shape for each role. Optional new widget: `pendingRefunds` (count of returns with `PENDING_REFUND`) for Manager and Admin, so a manager sees anything unpaid. |
| H2  | Report columns, filters and sorting (see N6 about returns).                                                                                                                      |
| H3  | Invoice print fields. The invoice now shows `netAmount`, `taxAmount` and `total`, with TIN, invoice number, date, branch, cashier and customer name. Please confirm.             |
| H4  | Barcode lookup response (name, price and branch `quantity` are included, so confirm that is enough).                                                                             |
| H5  | Is it fine that movement records keep `quantityChange` and `quantityAfter` (see 6.3)?                                                                                            |
| H6  | The frontend logs out on `UNAUTHENTICATED` and on `ACCOUNT_DISABLED` (see 1.4 and N5). OK?                                                                                       |

### From Melat

| #   | Item                                                                                                                   |
| --- | ---------------------------------------------------------------------------------------------------------------------- |
| M1  | Screen list and the data and actions for each screen, so list endpoints get the right search, filter and sort options. |
| M2  | Status badge values and labels: PO, transfer, and the new return refund status (`PENDING_REFUND`, `REFUNDED`).         |

### SRS changes that follow from these decisions (for Kidus's Week 4 SRS update, not the contract)

- **FR-IMP-01:** change "Admin and Branch Manager" to "Admin".
- **FR-SAL-04 and Section 3.6:** selling prices include VAT or TOT, and the tax is worked out from the price. Replace the example (1,000 + 150 = 1,150) with: a total of 1,150 includes 150 of VAT.
- **Product selling price:** state that it includes tax.
- **New requirement** for the refund check on customer returns: refund amount, status, mark as refunded, pending list.
- **PO approval** is built together with purchase orders, not as a later extra.
