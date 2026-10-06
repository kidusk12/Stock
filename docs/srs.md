# Software Requirements Specification

## Multi-Branch Stock Management System

*with Amharic Localization and Ethiopian Calendar Support*

| Item | Details |
|---|---|
| Project | Multi-Branch Stock Management System |
| Date | October 2026 |
| Team members | Kidus, Makda, Melat, Hemen |

---


# 1. Introduction


## 1.1 Purpose

This document describes the software requirements for the Multi-Branch Stock Management System. It defines what the system must do, how its main functions work, and the qualities it must have. It is the reference for design, development and testing, and the finished system will be checked against it.


## 1.2 About the Project

Many small and medium businesses in Ethiopia that run several shops or warehouses still track stock on paper or in spreadsheets. This causes familiar problems: quantities that do not match what is on the shelf, no clear view of what each branch holds, stock running out without warning, goods moved between branches without a record, and no way to find out who changed what.

The Multi-Branch Stock Management System is a web application that replaces those paper records and spreadsheets. Each branch keeps its own stock; every change in stock is recorded with who made it and why; managers approve purchases and transfers; and the system warns when a product is running low. It is built for the local context: the interface works in Amharic and English, dates can be shown in the Ethiopian calendar, amounts are in birr, and invoices handle VAT or turnover tax (TOT).

Project goals:

- Give every branch an accurate, current view of its stock
- Record every stock change so that quantities can always be explained and traced
- Support the full flow of goods: buying from suppliers, selling to customers, returns, adjustments and transfers between branches
- Warn managers before products run out
- Control who can see and do what through roles and branch restrictions
- Fit the Ethiopian setting with Amharic, the Ethiopian calendar, birr and VAT


## 1.3 Scope

The system is a web-based application that helps companies with one or more branches or warehouses track their products and stock. It covers 18 features:

- 1. Login and role-based access
- 2. Branches, products, categories and suppliers
- 3. Branch stock and the stock movement service
- 4. Purchase orders and goods receiving
- 5. Sales with VAT and printable invoice
- 6. Stock adjustments
- 7. Inter-branch transfers
- 8. Low-stock alerts and notification bell
- 9. Audit log
- 10. USB barcode input
- 11. Amharic/English interface, Ethiopian date, birr
- 12. One dashboard and three reports
- 13. Customer returns
- 14. Purchase order approval by the Branch Manager
- 15. Partial receiving of purchase orders
- 16. Auditor role
- 17. CSV export
- 18. CSV import

Features 1 to 12 form the core system and are built first. Features 13 to 18 are extended features built once the core works end to end.

Out of scope: accounting and payroll, online payment integration, e-commerce storefronts, hardware sensors or automatic counting, native mobile applications, and the items listed in Section 8.2. Invoices produced by the system are printable business invoices; they are not fiscal receipts issued by a certified fiscal (EFD) machine.


## 1.4 Definitions and Abbreviations

| Term | Meaning |
|---|---|
| SKU | Stock Keeping Unit, a unique code identifying a product |
| PO | Purchase Order |
| VAT | Value Added Tax (15%) |
| TOT | Turnover Tax |
| TIN | Taxpayer Identification Number |
| RBAC | Role-Based Access Control |
| JWT | JSON Web Token, used for session authentication |
| CSV | Comma-Separated Values, a plain text table format that opens in Excel |
| Stock movement | A recorded change in stock quantity (receipt, sale, return, adjustment, transfer, opening stock) |
| In transit | A transfer that has been shipped by the source branch but not yet received by the destination |
| Audit log | Permanent record of who did what and when in the system |


## 1.5 Document Overview

Section 2 gives an overall description of the product. Section 3 explains how the system and each function work. Section 4 lists the functional requirements. Section 5 lists non-functional requirements. Section 6 covers external interfaces, Section 7 the main data entities, Section 8 priorities, excluded features and milestones, and Section 9 verification and acceptance.


# 2. Overall Description


## 2.1 Product Perspective

The system is a standalone client-server web application. A React frontend communicates with a Node.js/Express REST API, which stores data in a PostgreSQL database. Companies use it to replace paper records and spreadsheets for stock tracking.


## 2.2 Product Functions (Summary)

- User authentication and role-based access control, including a read-only Auditor role
- Management of branches, products, categories and suppliers
- Branch-level stock tracking where every change is recorded as a stock movement
- Purchase orders with Branch Manager approval, goods receiving and partial receiving
- Sales with VAT or TOT, printable invoices, and customer returns
- Stock adjustments with mandatory reasons
- Inter-branch stock transfers with request, approval, shipping and receiving
- Low-stock alerts, in-app notification bell and a Low Stock page
- Append-only audit trail of all important actions
- USB barcode scanner input
- Amharic/English interface, Ethiopian calendar dates and birr currency
- One role-based dashboard, three reports, CSV export and CSV import


## 2.3 User Classes

| User | Description | Scope |
|---|---|---|
| Admin | Business owner or head office; configures the system and oversees everything | All branches, full control |
| Branch Manager | Manages one branch; approves purchase orders and transfers; sets stock thresholds | Own branch |
| Staff | Daily operations: sales, returns, receiving goods, adjustments and transfer handling (storekeeper and cashier duties) | Own branch |
| Auditor | Reviews logs, movements, adjustments and reports; cannot change any data | Read-only, all branches |


## 2.4 Operating Environment

- Modern web browsers (Chrome, Firefox, Edge) on desktop and tablet; basic support on phone-size screens
- Server running Node.js with a PostgreSQL database, hosted on a cloud platform or locally for the demonstration
- Optional USB barcode scanner; a standard printer for invoices and reports


## 2.5 Design and Implementation Constraints

- Must be completed and fully working within a 4-week development period by a team of four
- Technology stack: React, Tailwind CSS, Node.js, Express, PostgreSQL, Prisma
- Must handle Amharic (Ge'ez) text correctly using Unicode fonts
- All stock changes must pass through the stock movement mechanism, never direct edits


## 2.6 Assumptions and Dependencies

- Users have basic computer skills and a working network connection to the server
- Stock data is entered by staff; the system does not detect physical stock automatically
- A product has a single cost price; stock value is quantity multiplied by cost price
- Third-party libraries (react-i18next, PapaParse, a charting library) remain available


# 3. How the System Works

This section explains each function in plain language: what it does, who uses it, and how it behaves. The detailed, numbered requirements are in Section 4.


## 3.1 The Big Picture

The key idea of the system is that stock is never edited directly. Each branch has a quantity for each product, and that quantity only changes when something happens: goods arrive, a sale is made, a customer returns an item, staff correct a mistake, or stock moves to another branch. Each of these events creates a stock movement, a permanent record that says what changed, by how much, why, who did it and when. Because the quantity and its movement record are always saved together, the numbers can always be explained.

A typical working day looks like this:

1. The Admin has set up the branches, users, products and suppliers.
2. A staff member creates a purchase order for a supplier. The Branch Manager approves it.
3. When the goods arrive, staff receive them against the order. Stock goes up.
4. At the counter, staff scan or search products and make sales. Stock goes down and an invoice is printed.
5. When a product reaches its minimum level, the manager gets a notification and sees it on the Low Stock page.
6. If one branch runs short, it requests stock from another branch. The other branch's manager approves, ships and the first branch confirms receipt.
7. Every action is written to the audit log, and managers, admins and auditors can review dashboards and reports.


## 3.2 Login and Role-Based Access (Features 1 and 16)

Users log in with a username and password. Passwords are never stored as plain text; they are hashed. After a successful login the server issues a signed token (JWT) that the browser sends with every request. The token carries the user's role and branch.

What a user can see and do depends on their role. Admins can do everything in all branches. Branch Managers and Staff work only inside their own branch. Auditors can see the audit log, stock movements, adjustments and reports, but cannot create, change or delete anything. Every rule is checked on the server, so a user cannot get around it by calling the system directly. The Admin creates users, assigns each a role and branch, and can deactivate them. Users can change their own password.


## 3.3 Branches, Products, Categories and Suppliers (Feature 2)

This is the reference data that the rest of the system relies on.

- Branches: each shop or warehouse is a branch, created by the Admin.
- Products: each has a name, SKU (internal code), barcode, category, unit of measure, cost price and selling price. SKU and barcode must be unique. A product that has history is deactivated rather than deleted, so old records stay valid.
- Categories: simple groups used to organize and filter products.
- Suppliers: name, contact, TIN and address.
- Company settings: company name, address, TIN, and whether VAT (15%) or TOT applies. These appear on invoices.

Products can be searched and filtered by name, SKU, barcode or category.


## 3.4 Branch Stock and the Stock Movement Service (Feature 3)

The system keeps a separate quantity for each product in each branch. All changes go through one mechanism, the stock movement service. When a feature needs to change stock, it calls this service with the product, branch, quantity (positive or negative), the type of event and a reference. The service then, in a single database transaction, locks the stock row, refuses the change if it would make the quantity negative, updates the quantity and writes the movement record. If any step fails, nothing is saved.

Movement types are: opening stock, purchase receipt, sale, customer return, adjustment, transfer out and transfer in. Locking the row also means that if two users sell the last unit at the same moment, one succeeds and the other is told there is not enough stock. Users can see stock for one branch or consolidated across all branches, and view the movement history of a product.


## 3.5 Purchase Orders and Receiving (Features 4, 14 and 15)

Purchasing brings new goods into stock.

1. A user creates a purchase order: supplier, receiving branch, products, quantities and unit costs.
2. The order starts as pending approval. A Branch Manager (or Admin) approves or rejects it. Only approved orders can be received.
3. When goods arrive, staff open the order and enter the quantity received for each item.
4. The system adds the received quantities to the branch's stock through the stock movement service.

Receiving can be partial. If a supplier delivers 60 of 100 ordered units, staff enter 60; the order becomes partially received and shows ordered and received quantities. Staff can receive the rest later. The system rejects receiving more than was ordered. When every item is fully received, the order becomes received.


## 3.6 Sales, Invoices and Customer Returns (Features 5 and 13)

At the counter, staff build a sale by searching for products or scanning their barcodes and entering quantities. They may type a customer name. The system checks each item against the branch's stock and refuses the sale if there is not enough.

The system then calculates the subtotal and the tax. For example, a subtotal of 1,000 birr with VAT at 15% gives 150 birr of VAT and a total of 1,150 birr; if the company uses TOT, the TOT rule is applied instead. When the sale is completed, the sale record, the stock deduction and a unique sequential invoice number are saved together. The printable invoice shows the company name and TIN, the invoice number, the date, the items, the tax and the total, and it can be printed or saved as PDF from the browser.

If a customer brings an item back, staff open the original invoice, choose the items and quantities being returned, and confirm. The system does not allow returning more than was sold (minus anything already returned), puts the items back into stock, and links the return to the invoice.


## 3.7 Stock Adjustments (Feature 6)

Adjustments correct stock when reality differs from the records: damaged or expired goods, loss, or a recount. The user picks a product, enters the increase or decrease, and chooses a reason, which is mandatory. The adjustment is applied through the stock movement service, so it is recorded like every other change. Because adjustments can hide losses, the system lists them with product, quantity, reason, user and date so that managers and auditors can review them.


## 3.8 Inter-Branch Transfers (Feature 7)

Transfers move stock from one branch to another with approval and tracking.

1. Branch B requests stock of one or more products from Branch A (status: requested).
2. Branch A's manager approves or rejects the request (approved or rejected).
3. When Branch A ships the goods, the quantity is deducted from Branch A's stock immediately and the transfer is in transit (shipped). Shipping more than the available stock is refused.
4. When Branch B confirms receipt, the quantity is added to Branch B's stock (received).

Deducting at shipping and adding at receiving means goods are never counted in two places or in none. The in-transit state is simply a transfer that has been shipped but not yet received.


## 3.9 Low-Stock Alerts and Notifications (Feature 8)

A manager sets a minimum level (and optionally a maximum) for each product in each branch. After any stock decrease (a sale, adjustment or transfer out), the system compares the new quantity with the minimum. If it is at or below the minimum, it creates a notification for that branch's manager. It does not repeat the notification while the product stays low.

The notification bell in the top bar shows the number of unread notifications and lets the user mark them as read. A Low Stock page lists every product at or below its minimum with a suggested reorder quantity: up to the maximum if one is set, otherwise up to twice the minimum.


## 3.10 Audit Log (Feature 9)

The audit log is a permanent record of important actions. Every stock movement is recorded, and so are changes to users, products, prices, suppliers and branches, and purchase order, sale, return, adjustment, transfer and import actions. Each entry stores the user, the time, the action, the branch, and the old and new values. The application has no way to edit or delete entries. Authorized users can search and filter the log by user, product, date range, action and branch.


## 3.11 USB Barcode Input (Feature 10)

A USB barcode scanner behaves like a keyboard: when it scans a code, it types the digits and presses Enter. The system provides a focused input field on the sale, purchase receipt and transfer screens. When a code is entered, the system looks up the product by barcode and adds it to the current document. If no product matches, it shows a clear "product not found" message. Barcodes can also be typed by hand, so no special hardware is needed to test the system.


## 3.12 Amharic/English, Ethiopian Date and Birr (Feature 11)

Users can switch the whole interface between Amharic and English, and the choice is remembered. All text comes from translation files, so no label is fixed in the code. Dates are stored in the database as standard dates and converted for display in the Ethiopian calendar; for date input, a day, month and year selector is used. Amounts are shown in birr with correct formatting. An Ethiopic Unicode font (such as Noto Sans Ethiopic) ensures Amharic text displays correctly on screen and in printed invoices and reports.


## 3.13 Dashboard, Reports and CSV Export (Features 12 and 17)

After login, each user sees one dashboard whose widgets depend on their role. Admins see total stock value, a sales summary, a branch comparison, the low-stock count and recent activity. Branch Managers see their branch's stock value and sales, low-stock items, pending approvals and transfers in transit. Staff see today's sales and invoice count, a search or scan box, expected purchase orders, pending transfers and the low-stock list. Auditors see recent audit activity and recent adjustments.

There are three reports: stock on hand, sales, and stock movement history. Each can be filtered by date range, branch and product, printed or saved as PDF from the browser, and exported to CSV. The CSV export contains the currently filtered rows and is encoded so that Amharic text opens correctly in Excel.


## 3.14 CSV Import (Feature 18)

CSV import lets an Admin or Branch Manager add many products at once instead of typing each one. The user downloads a CSV template, fills it in (for example from an Excel sheet saved as CSV) and uploads it.

1. The system reads the file and checks every row for missing required fields, duplicate SKU or barcode (within the file or already in the system) and invalid numbers.
2. A preview shows the rows, with problem rows highlighted and the reason shown.
3. After the user confirms, valid rows are imported and invalid rows are skipped and reported.
4. If the file has an opening quantity column, those quantities are recorded as opening stock movements in the chosen branch.


# 4. Functional Requirements

Priority levels: High = required for the core system and must work in the final demonstration. Medium = extended features (13 to 18) and supporting functions, built once the core system works.


## 4.1 User Management, Authentication and Roles (Features 1, 16)

| ID | Requirement | Priority |
|---|---|---|
| FR-AUTH-01 | The system shall allow users to log in with a username and password. | High |
| FR-AUTH-02 | Passwords shall be stored hashed (bcrypt) and sessions secured with JWT. | High |
| FR-AUTH-03 | The Admin shall create, edit and deactivate users and assign one of four roles (Admin, Branch Manager, Staff, Auditor) and a branch. | High |
| FR-AUTH-04 | The system shall restrict Branch Managers and Staff to their assigned branch. Admin and Auditor may access all branches. | High |
| FR-AUTH-05 | The system shall enforce permissions on the server for every request, not only in the interface. | High |
| FR-AUTH-06 | Users shall be able to change their own password and log out. | Medium |
| FR-AUTH-07 | The Auditor role shall be read-only: it may view the audit log, stock movements, adjustments and reports, and every request that creates, changes or deletes data shall be rejected for it. | Medium |


## 4.2 Master Data and Company Settings (Feature 2)

| ID | Requirement | Priority |
|---|---|---|
| FR-PRD-01 | The system shall allow creating, editing and deactivating products with name, SKU, barcode, category, unit of measure, cost price and selling price. | High |
| FR-PRD-02 | The system shall prevent duplicate SKUs and barcodes. | High |
| FR-PRD-03 | Products shall be deactivated, not deleted, so that historical records remain valid. | High |
| FR-PRD-04 | The system shall support searching and filtering products by name, SKU, barcode or category. | High |
| FR-PRD-05 | The system shall manage product categories. | Medium |
| FR-SUP-01 | The system shall allow managing suppliers (name, contact, TIN, address). | High |
| FR-BR-01 | The Admin shall create, edit and deactivate branches or warehouses. | High |
| FR-SET-01 | The Admin shall configure company settings: company name, address, TIN, and whether VAT (15%) or TOT applies to sales. | High |


## 4.3 Branch Stock and Stock Movements (Feature 3)

| ID | Requirement | Priority |
|---|---|---|
| FR-STK-01 | The system shall keep a separate stock quantity for each product in each branch. | High |
| FR-STK-02 | Every change in stock shall be made through the stock movement mechanism and recorded with type (opening stock, purchase receipt, sale, customer return, adjustment, transfer out, transfer in), quantity, reference, reason where applicable, user and time. | High |
| FR-STK-03 | A stock quantity change and its movement record shall be saved in a single database transaction. | High |
| FR-STK-04 | The system shall reject any change that would make a stock quantity negative. | High |
| FR-STK-05 | The system shall show stock consolidated across all branches or filtered by branch. | High |
| FR-STK-06 | Users shall be able to view the movement history of a product. | Medium |


## 4.4 Purchasing and Goods Receiving (Features 4, 14, 15)

| ID | Requirement | Priority |
|---|---|---|
| FR-PUR-01 | Authorized users shall create purchase orders with supplier, receiving branch, items, quantities and unit costs. | High |
| FR-PUR-02 | A purchase order shall have a status: pending approval, approved, rejected, partially received or received. | High |
| FR-PUR-03 | A purchase order shall require approval by a Branch Manager (or Admin) before goods can be received against it. | Medium |
| FR-PUR-04 | Staff shall receive goods against an approved purchase order. | High |
| FR-PUR-05 | Receiving goods shall increase stock in the receiving branch and record a stock movement. | High |
| FR-PUR-06 | The system shall support partial receiving: the received quantity is entered per item, ordered and received quantities are tracked, and the purchase order stays partially received until all items are received. Receiving more than the ordered quantity shall be rejected. | Medium |


## 4.5 Sales, Invoicing and Returns (Features 5, 13)

| ID | Requirement | Priority |
|---|---|---|
| FR-SAL-01 | Staff shall create sales by selecting or scanning products, entering quantities and optionally entering a customer name. | High |
| FR-SAL-02 | The system shall reject sales that exceed available stock in the branch. | High |
| FR-SAL-03 | Completing a sale shall deduct stock and record stock movements in the same transaction as the sale record. | High |
| FR-SAL-04 | The system shall calculate VAT (15%) or TOT according to the company setting and show totals in birr. | High |
| FR-SAL-05 | The system shall assign each invoice a unique sequential number. | High |
| FR-SAL-06 | The system shall generate a printable invoice showing company name, TIN, invoice number, date, items, tax and total. The user may print it or save it as PDF through the browser. | High |
| FR-SAL-07 | Staff shall process customer returns against an original invoice by selecting items and quantities. The returned quantity shall not exceed the quantity sold minus quantities already returned. | Medium |
| FR-SAL-08 | A customer return shall increase stock, record a stock movement and be linked to the original invoice. | Medium |


## 4.6 Stock Adjustments (Feature 6)

| ID | Requirement | Priority |
|---|---|---|
| FR-ADJ-01 | Authorized users shall record stock adjustments (damage, expiry, loss, recount correction, other) that increase or decrease stock, with a mandatory reason. | High |
| FR-ADJ-02 | Each adjustment shall be applied through the stock movement mechanism. | High |
| FR-ADJ-03 | The system shall list adjustments with product, quantity, reason, user and date, so they can be reviewed. | Medium |


## 4.7 Inter-Branch Transfers (Feature 7)

| ID | Requirement | Priority |
|---|---|---|
| FR-TRF-01 | A branch shall be able to request stock of one or more products from another branch. | High |
| FR-TRF-02 | The source branch manager shall approve or reject the request. | High |
| FR-TRF-03 | When the source branch ships an approved transfer, stock shall be deducted from the source and the transfer shall be tracked as in transit. Shipping more than the available stock shall be rejected. | High |
| FR-TRF-04 | The destination branch shall confirm receipt, at which point stock is added to the destination. | High |
| FR-TRF-05 | Each transfer shall have a status: requested, approved, rejected, shipped or received. | High |


## 4.8 Low-Stock Alerts and Notifications (Feature 8)

| ID | Requirement | Priority |
|---|---|---|
| FR-ALT-01 | The Admin or Branch Manager shall set a minimum threshold (and optional maximum) per product per branch. | High |
| FR-ALT-02 | After any stock decrease, the system shall compare the quantity with the minimum and create a notification for the branch manager if it is at or below it. | High |
| FR-ALT-03 | The system shall not create repeated notifications for the same product and branch while it remains below the minimum. | Medium |
| FR-ALT-04 | The system shall show notifications in an in-app notification bell with an unread count and allow marking them as read. | High |
| FR-ALT-05 | A Low Stock page shall list items at or below their minimum with a suggested reorder quantity (up to the maximum if set, otherwise up to twice the minimum). | High |


## 4.9 Audit Trail (Feature 9)

| ID | Requirement | Priority |
|---|---|---|
| FR-AUD-01 | The system shall record every stock movement and every important action (user, product, price, supplier and branch changes; purchase order, sale, return, adjustment and transfer actions; imports) with user, time, action, branch, and old and new values. | High |
| FR-AUD-02 | Audit records shall not be editable or deletable through the application. | High |
| FR-AUD-03 | Authorized users shall search and filter audit records by user, product, date range, action and branch. | High |


## 4.10 Barcode Input (Feature 10)

| ID | Requirement | Priority |
|---|---|---|
| FR-BAR-01 | The system shall accept barcode input from a USB scanner (keyboard emulation) in a focused input field. | High |
| FR-BAR-02 | A scan shall find the product and add it to the current sale, purchase receipt or transfer. | High |
| FR-BAR-03 | If no product matches the barcode, the system shall show a clear "product not found" message. | High |


## 4.11 Localization (Feature 11)

| ID | Requirement | Priority |
|---|---|---|
| FR-LOC-01 | Users shall switch the interface between Amharic and English, and the choice shall be remembered. | High |
| FR-LOC-02 | The system shall display dates in the Ethiopian calendar and accept date input through a day, month and year selector, storing dates as standard dates. | High |
| FR-LOC-03 | Currency shall be displayed in birr with correct formatting. | High |
| FR-LOC-04 | All interface text shall come from translation files so that no label is fixed in the code. | High |


## 4.12 Dashboard, Reports and Export (Features 12, 17)

| ID | Requirement | Priority |
|---|---|---|
| FR-DSH-01 | After login the system shall load a single dashboard whose widgets depend on the user's role. | High |
| FR-DSH-02 | Admin widgets: total stock value, sales summary, branch comparison, low-stock count, recent activity. | High |
| FR-DSH-03 | Branch Manager widgets: branch stock value and sales, low-stock items, pending approvals (purchase orders and transfers), transfers in transit. | High |
| FR-DSH-04 | Staff widgets: today's sales and invoice count, product search or scan box, expected purchase orders, pending transfers, low-stock list. | High |
| FR-DSH-05 | Auditor widgets: recent audit activity and recent adjustments (read-only). | Medium |
| FR-REP-01 | The system shall provide three reports: stock on hand, sales, and stock movement history. | High |
| FR-REP-02 | Reports shall be filterable by date range, branch and product where applicable. | High |
| FR-REP-03 | Reports shall have a print-friendly layout that can be printed or saved as PDF through the browser. | Medium |
| FR-REP-04 | Users shall export the currently filtered report to a CSV file encoded so that Amharic text opens correctly in Excel. | Medium |


## 4.13 CSV Import (Feature 18)

| ID | Requirement | Priority |
|---|---|---|
| FR-IMP-01 | The Admin and Branch Manager shall upload a CSV file of products. | Medium |
| FR-IMP-02 | The system shall validate each row (missing required fields, duplicate SKU or barcode in the file or in the system, invalid numbers) and show a preview with errors highlighted. | Medium |
| FR-IMP-03 | Valid rows shall be imported only after user confirmation; invalid rows shall be skipped and reported. | Medium |
| FR-IMP-04 | If the file contains an opening quantity column, the quantities shall be recorded as opening stock movements in the selected branch. | Medium |
| FR-IMP-05 | The system shall provide a downloadable CSV import template. | Medium |


# 5. Non-Functional Requirements

| ID | Category | Requirement |
|---|---|---|
| NFR-01 | Performance | As a design goal, common pages and searches shall respond within 2 seconds with the demonstration data (several branches and several hundred products). |
| NFR-02 | Security | Passwords hashed; server-side role checks on every request; input validation on all endpoints; database access through Prisma (parameterized queries); output escaping in the interface; the JWT sent in the Authorization header; HTTPS when deployed. |
| NFR-03 | Data Integrity | Stock quantity changes and their movement records shall be written in a single database transaction so they never become inconsistent. |
| NFR-04 | Concurrency | Simultaneous sales or transfers of the same product shall not produce negative stock; the stock mechanism shall lock the affected stock row during the change. |
| NFR-05 | Backup | A database backup script shall be provided and tested. |
| NFR-06 | Usability | The interface shall be simple and consistent; a trained user shall be able to create a sale in under one minute; all screens shall work in Amharic and English. |
| NFR-07 | Compatibility | Responsive design that works on desktop and tablet browsers and remains usable on phone-size screens. |
| NFR-08 | Maintainability | Modular code, separate frontend and backend layers, version control with reviewed pull requests, and a documented API. |
| NFR-09 | Scalability | The design shall allow adding branches, products and users without changes to the code structure. |
| NFR-10 | Auditability | All critical actions shall be traceable to a user and timestamp, with logs protected from modification through the application. |
| NFR-11 | Localization | Ge'ez text shall display correctly using a Unicode font such as Noto Sans Ethiopic, including in printed invoices and reports. |
| NFR-12 | Portability | The system shall run on any platform that supports Node.js and PostgreSQL. |


# 6. External Interface Requirements


## 6.1 User Interface

- Web interface with a shared layout, a sidebar menu filtered by role and a notification bell
- Language toggle, forms with validation messages, searchable tables and charts on the dashboard
- Print-friendly invoice and report layouts


## 6.2 Hardware Interfaces

- USB barcode scanner (keyboard emulation)
- Standard printer for invoices and reports


## 6.3 Software Interfaces

- REST API between frontend and backend using JSON
- PostgreSQL database accessed through Prisma ORM


## 6.4 Communication Interfaces

- HTTP/HTTPS for all client-server communication, with the JWT sent in request headers


# 7. Data Requirements

Main data entities (the detailed schema and ERD are produced during design):

| Entity | Purpose |
|---|---|
| users | Accounts, roles (Admin, Branch Manager, Staff, Auditor) and branch assignments |
| branches | Branches and warehouses |
| products, categories | Product catalog |
| suppliers | Suppliers |
| company_settings | Company name, address, TIN, VAT or TOT setting, invoice numbering |
| branch_stock | Current quantity per product per branch, with minimum and optional maximum thresholds |
| stock_movements | Every change in stock (the source of truth for history) |
| purchase_orders (+ items) | Orders to suppliers, approval status, ordered and received quantities per item |
| sales (+ items) | Sales and their invoices, with an optional customer name |
| sale_returns (+ items) | Customer returns linked to the original sale |
| transfers (+ items) | Inter-branch transfers with status |
| adjustments | Stock adjustments with reason |
| notifications | Low-stock alerts |
| audit_logs | Append-only action history |


# 8. Other Requirements


## 8.1 Priorities and Build Order

Features 1 to 12 are the core system and are completed first. Features 13 to 18 are added once the core works end to end. If time runs short, extended features are cut in the order listed in Section 8.3; core features are never cut.

| # | Feature | Phase | Requirements |
|---|---|---|---|
| 1 | Login and role-based access | Core | FR-AUTH-01 to 06 |
| 2 | Branches, products, categories, suppliers | Core | FR-PRD, FR-SUP, FR-BR, FR-SET |
| 3 | Branch stock and stock movement service | Core | FR-STK-01 to 06 |
| 4 | Purchase orders and receiving | Core | FR-PUR-01, 02, 04, 05 |
| 5 | Sales with VAT and printable invoice | Core | FR-SAL-01 to 06 |
| 6 | Stock adjustments | Core | FR-ADJ-01 to 03 |
| 7 | Inter-branch transfers | Core | FR-TRF-01 to 05 |
| 8 | Low-stock alerts and notification bell | Core | FR-ALT-01 to 05 |
| 9 | Audit log | Core | FR-AUD-01 to 03 |
| 10 | USB barcode input | Core | FR-BAR-01 to 03 |
| 11 | Amharic/English, Ethiopian date, birr | Core | FR-LOC-01 to 04 |
| 12 | One dashboard and three reports | Core | FR-DSH-01 to 04, FR-REP-01, 02 |
| 13 | Customer returns | Extended | FR-SAL-07, 08 |
| 14 | PO approval by Branch Manager | Extended | FR-PUR-03 |
| 15 | Partial receiving | Extended | FR-PUR-06 |
| 16 | Auditor role | Extended | FR-AUTH-07, FR-DSH-05 |
| 17 | CSV export | Extended | FR-REP-04 (and FR-REP-03) |
| 18 | CSV import | Extended | FR-IMP-01 to 05 |


## 8.2 Features Not Included

The following are intentionally not part of this project, to keep the delivery complete and reliable within the time available:

| Feature | Reason |
|---|---|
| FIFO / average cost valuation | Requires cost layers on every sale, transfer and return; high risk of incorrect values. A single cost price is used. |
| Physical stock counts with approval | A full workflow of its own; stock adjustments cover corrections. |
| Supplier returns | Lower value; customer returns are supported. |
| Customer management | Sales accept an optional customer name instead. |
| Phone-camera barcode scanning | Needs HTTPS and real-device testing; USB scanner input is supported. |
| Email alerts | Needs an external mail service; in-app notifications are used. |
| Excel and PDF export libraries | CSV export and the browser's print-to-PDF cover the need. |
| Product images | File storage adds work without functional value. |
| Separate Storekeeper and Cashier roles and separate dashboards per role | Merged into one Staff role and one role-based dashboard. |
| Purchases, transfers, profit and count-variance reports | Reduced to three reports. |


## 8.3 If Time Is Short

Extended features are cut in this order: CSV import, partial receiving, customer returns, PO approval, CSV export. The Auditor role is a permission setting and is kept if possible.


## 8.4 Milestones

| Period | Goal |
|---|---|
| Days 1-2 | Agree database schema, API contract, permissions table, screen list and Git workflow. |
| Week 1 | Foundations: database, stock movement service, authentication and permissions, application shell and translations, master data. |
| Week 2 | Core features: purchasing, sales and invoices, adjustments, transfers, alerts, audit log, barcode input. All 12 core features work end to end. |
| Week 3 | Extended features, dashboard, reports and demonstration data. Feature freeze at the end of the week. |
| Week 4 | Testing by team members on features they did not build, bug fixing, Amharic completion, documentation and demonstration rehearsal. |


## 8.5 Possible Future Enhancements

- FIFO or average cost valuation
- Physical stock counts with reconciliation
- Phone-camera barcode scanning
- Email alerts
- Excel and PDF export
- Supplier returns and customer management
- Offline-first mode with synchronization
- Demand forecasting and automatic reorder suggestions
- Telebirr / CBE Birr payment integration
- Native mobile application
- Batch and expiry-date tracking


# 9. Verification and Acceptance

Each feature is accepted when it works end to end, works in both languages, is enforced on the server, and has been tested by a team member who did not build it. The demonstration uses seeded data: at least three branches, one user for each role, and 200 or more products with sample purchases, sales and transfers.

| # | Acceptance scenario | Requirements |
|---|---|---|
| A1 | A user logs in; a Staff user cannot open an Admin-only page, and the server rejects the same request sent directly. | FR-AUTH-01, 03, 04, 05 |
| A2 | Selling more than the available stock is rejected; a valid sale reduces stock and creates a numbered invoice with correct VAT. | FR-SAL-02 to 06, FR-STK-04 |
| A3 | Two simultaneous sales of the last unit result in one success and one rejection; stock never goes negative. | NFR-03, NFR-04 |
| A4 | A purchase order is approved, partially received twice, and then shows as received; stock increases each time. | FR-PUR-02 to 06 |
| A5 | A transfer is requested, approved, shipped (source stock drops, status in transit) and received (destination stock rises). | FR-TRF-01 to 05 |
| A6 | A sale that brings stock to the minimum creates one notification; the bell and the Low Stock page show it. | FR-ALT-01 to 05 |
| A7 | A customer return cannot exceed the quantity sold; a valid return increases stock. | FR-SAL-07, 08 |
| A8 | Every action above appears in the audit log, which can be filtered and cannot be edited; an Auditor can view but not change anything. | FR-AUD-01 to 03, FR-AUTH-07 |
| A9 | The whole interface switches between Amharic and English; dates show in the Ethiopian calendar and amounts in birr. | FR-LOC-01 to 04 |
| A10 | A report is filtered and exported to CSV that opens correctly in Excel; a CSV file of products is imported with invalid rows highlighted and skipped. | FR-REP-02, 04, FR-IMP-01 to 05 |

