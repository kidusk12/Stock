# Multi-Branch Stock Management System

Web-based stock management for multi-branch businesses in Ethiopia.
Amharic / English, Ethiopian calendar, birr, VAT.

## Team
Kidus (lead, database and stock engine) · Makda (backend API) · Melat (UI/UX, frontend) · Hemen (frontend)

## Tech stack
React + Vite + Tailwind CSS · Node.js + Express · Prisma ORM · PostgreSQL · JWT

## Prerequisites
- Node.js 20 or newer
- PostgreSQL 15 or newer (running locally)
- Git

## Setup

### 1. Create the database
Create an empty PostgreSQL database named `stockdb` (pgAdmin or `createdb stockdb`).

### 2. Backend
```
cd backend
cp .env.example .env        # then edit DATABASE_URL and JWT_SECRET
npm install
npx prisma migrate dev      # creates the tables
npm run seed                # creates the first admin user and a branch
npm run dev                 # http://localhost:4000/api/health
```

### 3. Frontend (second terminal)
```
cd frontend
cp .env.example .env
npm install
npm run dev                 # http://localhost:5173
```

The frontend shows a placeholder page. The backend health check is at http://localhost:4000/api/health and should return {"data":{"status":"ok"}}.

## Test account (from seed)
- username: `admin`
- password: `Admin123!`  (change after first login)

## Git workflow
- `main` always works. Never commit directly to it.
- Branch names: `feature/sales-screen`, `fix/invoice-total`
- Open a pull request; another teammate reviews it before merging
- Small commits, merged at least every 1-2 days
- Pull from `main` before starting work each day
- Migrations in `backend/prisma/migrations` are committed. Never edit the database by hand.

## Project rules
1. Only `backend/src/services/stockService.js` changes stock quantities.
2. Permissions are enforced on the server, not just hidden in the UI.
3. No hard-coded text in the UI. Use translation keys (`t('sales.total')`).
4. The API contract (`docs/API_CONTRACT.md`) changes only by agreement.

## Folder guide
- `backend/src/modules/<feature>/` : each feature has `*.routes.js`, `*.controller.js`, `*.service.js`
- `backend/src/middleware/` : auth, permissions, validation, errors, audit
- `frontend/src/features/<feature>/` : screens for each feature
- `frontend/src/components/` : shared UI pieces
- `frontend/src/i18n/` : `en.json` and `am.json` (Hemen)
- `docs/` : SRS, API contract, permissions table, ERD, team plan
