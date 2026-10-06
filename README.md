# Multi-Branch Stock Management System

Web-based stock management for multi-branch businesses in Ethiopia.
Amharic/English, Ethiopian calendar, birr, VAT.

## Team
Kidus (lead, database and stock engine) · Makda (backend) · Melat (UI/UX, frontend) · Hemen (frontend)

## Tech stack
React + Vite + Tailwind · Node.js + Express · Prisma · PostgreSQL · JWT

## Prerequisites
Node.js 20+, PostgreSQL 15+, Git

## Setup
1. Clone the repo
2. Backend:
   cd backend
   cp .env.example .env      (fill in your database URL and secret)
   npm install
   npx prisma migrate dev
   npm run seed
   npm run dev
3. Frontend (new terminal):
   cd frontend
   cp .env.example .env
   npm install
   npm run dev
4. Open http://localhost:5173

## Default test accounts
(list seeded users and roles here once Kidus adds seed data)

## Git workflow
- `main` always works. Never commit directly to it.
- Branch names: `feature/sales-screen`, `fix/invoice-total`
- Open a pull request; another teammate reviews it before merging
- Small commits, merged at least every 1-2 days
- Pull from main before starting work each day

## Rules
- Only `stockService` changes stock quantities
- Permissions are enforced on the server
- No hard-coded text in the UI: use translation keys

## Docs
See the `docs/` folder: API contract, ERD, permissions table, team plan.