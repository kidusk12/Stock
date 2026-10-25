# Multi-Branch Stock Management System

A web application that helps businesses with several shops or warehouses in Ethiopia keep track of their stock. Every branch has its own quantities, every change is recorded with who made it and why, and managers are warned before a product runs out.

It replaces paper records and spreadsheets, and it is built for the local setting: the interface works in **Amharic and English**, dates can be shown in the **Ethiopian calendar**, amounts are in **birr**, and invoices work with **VAT or turnover tax (TOT)**.

## Meet the team

| Name | Student ID | Position | Contribution |
|---|---|---|---|
| Kidus Kidanewold | ctc-6808-26 | Backend Developer | Team lead, database design, stock engine, backend |
| Hemen Solomon | ctc-1248-26 | Backend Developer | Backend API and API integration |
| Makda Solomon | ctc-867-26 | Full Stack Developer | Frontend integration, API contract |
| Melat Worku | ctc-875-26 | Frontend Developer | UI/UX design, frontend |
| Kenzo Stacy | ctc-4900-26 | Frontend Developer | Testing, responsive web interface |

## What the system does

- **Login and roles:** four roles (Admin, Branch Manager, Staff, Auditor). Managers and Staff work only inside their own branch. The Auditor can read everything but change nothing.
- **Master data:** branches, categories, suppliers and products with barcodes. CSV import of products.
- **Stock:** quantity per product per branch, minimum levels, a low-stock list and notifications, and a full history of every stock movement.
- **Purchasing:** purchase orders with Branch Manager approval, and goods receiving that adds stock.
- **Sales:** sales with tax included in the price, sequential invoice numbers with no gaps, a printable invoice, and customer returns with a refund check.
- **Stock adjustments** with a mandatory reason (damage, expiry, loss, recount, other).
- **Transfers between branches:** request, approve or reject, ship, receive. Stock leaves the source when shipped and joins the destination when received.
- **Audit log:** a permanent record of important actions that the application cannot edit or delete.
- **Dashboard and reports** that depend on the user's role.
- **Barcode scanner input** (USB scanners), and an **Amharic / English** interface with the Ethiopian calendar and birr formatting.

### Design highlights
- **One engine for stock.** Only `backend/src/services/stockService.js` changes stock quantities. Each change is written together with its movement record in one database transaction, and the stock row is locked, so two people can never sell the same last unit.
- **Permissions are enforced on the server**, never only in the interface.
- **Prices include tax.** The tax type and rate are set by the Admin in the company settings.
- **No deleting.** Users, branches, products and suppliers are deactivated, so old records stay valid.

## Tech stack

React + Vite + Tailwind CSS · Node.js + Express · Prisma ORM · PostgreSQL · JWT authentication

## Getting started

**Requirements:** Node.js 20 or newer, PostgreSQL 15 or newer, Git.

**1. Create the database.** Create an empty PostgreSQL database named `stockdb`.

**2. Backend**
```
cd backend
cp .env.example .env        # then set DATABASE_URL and JWT_SECRET
npm install
npx prisma migrate dev      # creates the tables
npm run seed                # creates the demo data and test accounts
npm run dev                 # http://localhost:4000/api/health
```

**3. Frontend** (second terminal)
```
cd frontend
cp .env.example .env        # set VITE_USE_MOCK=false to use the real backend
npm install
npm run dev                 # http://localhost:5173
```

**Demo accounts** (created by the seed; change them for any real use):

| Username | Password | Role |
|---|---|---|
| admin | Admin123! | Admin (all branches) |
| manager | Manager123! | Branch Manager (Main Branch) |
| staff | Staff123! | Staff (Main Branch) |
| auditor | Auditor123! | Auditor (read only, all branches) |

The seed also creates a second branch, categories, suppliers, and 25 products with starting stock.

**Running the tests:** `npm test` inside `backend` (the test files run one at a time, because they share one database).

## Testing

The system was tested for security, performance and data integrity on 23 to 24 October 2026, using a separate test database. The full results, including the failures we found and what was fixed, are in [`docs/TEST_REPORT.md`](docs/TEST_REPORT.md). The main results:

| Area | What we did | Result |
|---|---|---|
| Access control | 46 endpoints tried with no token, a fake token and each of the four roles (276 checks) | 0 failures, no server errors |
| Cross-branch attacks | Staff and Managers of one branch tried to read, change, approve or ship records of another branch (52 checks) | All refused |
| Authentication | Forged, tampered and unsigned tokens; stored passwords; deactivated user's token | All forged tokens rejected, passwords hashed with bcrypt, deactivated users blocked at once |
| Brute force | 30 wrong passwords in a row | No limit existed, so a login rate limiter was added; the repeat test gave 10 refusals then blocked |
| Injection and XSS | SQL injection strings in search, sort and URLs; script tags in names; review of all raw SQL | Safe. All raw queries use bound parameters, scripts are shown as plain text |
| Bad input | 18 wrong-type and extreme payloads on sales; 6 MB and 20,000-row CSV files | All rejected cleanly (CSV of 20,000 rows checked in under 1 second) |
| Concurrency | 20 users selling the last unit; 100 simultaneous sales; the same return, receipt, approval or shipment sent 10 times; a tax rate change during 30 sales | No overselling, no duplicate or missing invoice numbers, each action applied once |
| Load | 10, 50 and 100 users for 2 minutes | 0% errors; 95% of requests under 104 ms, 112 ms and 228 ms |
| Stress | 150 users for 90 seconds | 0% errors, but slower than our 1 second target (95th percentile 2 to 3 seconds) |
| Spike | 5 users, then 150, then back to 5 | 0% errors, recovered without a restart |
| Soak | 50 users for 30 minutes (43,372 requests) | No crash; 2 failed requests (0.005%) |
| Automated suite | 22 Jest test files, 211 tests | 210 passing in the last recorded run. The one failure is a test-design problem, not a security problem, and its fix is prepared |

### Known limitations
- Response times grow as the data grows, especially the reports. A test with a very large data set has not been run yet.
- One Node process was the limit on the test laptop (between 100 and 150 users). For production, run several processes.
- The login token is kept in the browser's `localStorage`.
- Importing a CSV does not yet block cells that start with `=`, `+`, `-` or `@`.
- Usernames are case-sensitive, and the category changes are not yet written to the audit log.
- Some security fixes were written after the test run and are still being verified. The report lists them.

### Notes for deployment
- Set `NODE_ENV=production`, a strong random `JWT_SECRET`, `CORS_ORIGIN`, and the frontend `VITE_API_URL`.
- Behind a proxy, set `app.set('trust proxy', 1)`.
- Use HTTPS, a database user with limited rights, and regular backups.
- Keep a written recovery procedure for the Admin account, because the Admin password cannot be reset through the API.

## Project structure

```
backend/   Express API, Prisma schema and migrations, tests
  src/modules/<feature>/   routes, controller and service for each feature
  src/middleware/          authentication, permissions, validation, errors, audit
  src/services/            stockService.js, the only code that changes stock
frontend/  React app (screens, components, translations in src/i18n)
docs/      SRS, API contract, test report
```

## Documents

- [`docs/srs.md`](docs/srs.md): software requirements specification
- `docs/api-contract.md`: the API contract every endpoint follows
