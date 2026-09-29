# EduManage Pro - School Student Admission & Fee Management System

A production-grade, full-stack School Admission and Fee Management System built with **React.js**, **Node.js + Express.js + TypeScript**, **Prisma ORM**, and **MySQL 8 (MariaDB)**.

---

## 1. System Technology Stack

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS v4, Lucide React, Recharts, Axios, Sonner, Canvas Confetti.
- **Backend**: Node.js, Express.js, TypeScript, Prisma ORM 5.22.0.
- **Database**: MySQL 8 / MariaDB 10.11 (Native relational schema with foreign keys, transactions, and composite indexes).
- **Authentication**: JWT access tokens (24h) + refresh tokens (7d), bcrypt password hashing.
- **PDF Generation**: Backend PDFKit vector rendering for signed A4 receipts.
- **Email Dispatch**: Nodemailer with SMTP delivery and database audit logging.
- **Online Payments**: Razorpay integration with server-side HMAC-SHA256 cryptographic signature verification.

---

## 2. Default Demo User Accounts

| Role | Username / Email | Password | Assigned Permissions |
| :--- | :--- | :--- | :--- |
| **Super Admin** | `superadmin` / `admin@greenwoodhigh.edu` | `Admin@123` | Full administrative, financial, staff, and system settings access |
| **Principal** | `principal` / `principal@greenwoodhigh.edu` | `Admin@123` | Academic approvals, student directory, fee overviews, audit reports |
| **Accountant** | `accountant` / `accountant@greenwoodhigh.edu` | `Admin@123` | Fee collections, receipt generation, PDF downloads, financial ledgers |
| **Admission Staff** | `admission_staff` / `admission@greenwoodhigh.edu` | `Staff@123` | Multi-step student enrollments, document verification, class assignments |
| **Staff Member** | `staff_user` / `staff@greenwoodhigh.edu` | `Staff@123` | Student directory & general academic view |

*Note: The login page includes 1-click test buttons for each role to immediately test role-based access control (RBAC).*

---

## 3. Database Schema Overview (MySQL + Prisma)

- **`User`**: Authentication credentials, roles (`SUPER_ADMIN`, `PRINCIPAL`, `ACCOUNTANT`, `ADMISSION_STAFF`, `STAFF`), status.
- **`AcademicYear`**: Academic sessions (e.g. `2026-27`) with active flag and archiving.
- **`Class` & `Section`**: Classes (Nursery - Grade 12) with sections (A, B, C) and seating capacities.
- **`Student` & `Parent`**: Comprehensive student demographic dossier, Aadhaar/national ID, blood group, address, emergency contact, linked to primary parent/guardian.
- **`StudentAcademicRecord`**: Relational bridge mapping student to an academic year, class, section, and roll number.
- **`StudentDocument`**: Verification records for Birth Certificates, Aadhaar copies, Transfer Certificates.
- **`FeeType`**: Configurable fee heads (`Tuition Fee`, `Admission Fee`, `Annual Development Fee`, `Exam Fee`, `Computer Fee`, `Transport Fee`).
- **`FeeStructure` & `FeeStructureItem`**: Class-wise annual and monthly billing matrices.
- **`StudentFee`**: Individual student billing ledger with net amount, paid amount, remaining amount, due dates, and statuses (`PAID`, `PARTIAL`, `PENDING`, `OVERDUE`).
- **`Payment` & `PaymentItem`**: Multi-item fee collection transactions with atomic Prisma transactions.
- **`Receipt`**: Official digital receipts (`REC-YYYY-000001`) with previous balance, amount paid, and remaining balance.
- **`EmailLog`**: Email dispatch ledger recording recipient, receipt reference, status, and error logs.
- **`Notification`**: Broadcast and user-specific alerts for fee overdues and new admissions.
- **`AuditLog`**: Immutable activity trail recording user, action, module, changed records, IP address, and timestamp.
- **`SchoolSettings`**: Institution profile, affiliation number, principal name, and receipt footer disclaimer.

---

## 4. Key REST API Endpoints

### Authentication
- `POST /api/auth/login`: Authenticates credentials, returns JWT access and refresh tokens.
- `GET /api/auth/me`: Fetches active authenticated user profile.
- `POST /api/auth/refresh`: Issues new JWT access token from refresh token.
- `POST /api/auth/change-password`: Updates user password.

### Dashboard & Analytics
- `GET /api/dashboard/stats`: Returns 6 key metric cards, collection velocity trends, payment method breakdowns, recent payments, and recent admissions.

### Academic Structure
- `GET /api/academic-years`: List all academic sessions.
- `POST /api/academic-years`: Create new academic session (Super Admin).
- `PUT /api/academic-years/:id/activate`: Set session as active.
- `GET /api/classes`: List classes with sections and student headcounts.
- `POST /api/classes`: Create class.
- `POST /api/classes/:classId/sections`: Add section to class.

### Student Admissions & Profiles
- `POST /api/admissions`: Multi-step enrollment creating student, parent, academic record, documents, and auto-generated initial fee ledger.
- `GET /api/students`: Filterable student list (search, class, section, feeStatus, status, pagination).
- `GET /api/students/:id`: Complete dossier including personal info, parent details, fee schedule, payment history, and documents.
- `PUT /api/students/:id`: Update student information.
- `PUT /api/students/:id/status`: Update status (`ACTIVE`, `INACTIVE`, `ALUMNI`, `WITHDRAWN`).

### Fee Management & Collection
- `GET /api/fee-types`: List fee heads.
- `POST /api/fee-types`: Create fee head.
- `GET /api/fee-structures`: List class fee structures.
- `POST /api/fee-structures`: Create/update class fee structure.
- `POST /api/fees/generate-monthly`: Automated batch fee generator for active students (with duplicate check).
- `GET /api/fees/pending`: Receivable aging list with overdue days calculation.

### Payments & Receipts
- `POST /api/payments`: Atomic transaction that records payment, creates payment items, settles student fee balances, generates receipt `REC-YYYY-000001`, and writes audit log.
- `GET /api/payments`: Transaction history with filters (date range, method, status, class).
- `POST /api/payments/online/create-order`: Initializes Razorpay payment order.
- `POST /api/payments/online/verify`: Cryptographically verifies Razorpay signature, settles fee, generates receipt, and emails PDF.
- `GET /api/receipts/:id`: Fetches complete receipt layout data.
- `GET /api/receipts/:id/pdf`: Downloads signed A4 PDF generated via PDFKit.
- `POST /api/receipts/:id/email`: Dispatches receipt PDF via Nodemailer and records EmailLog.

### Reports & Administration
- `GET /api/reports/daily-collection`: Date-specific collection breakdown with instrument distribution.
- `GET /api/reports/monthly-collection`: 12-month annual collection velocity report.
- `GET /api/reports/class-wise-collection`: Class-by-class billing vs collection realization rates.
- `GET /api/staff`: Staff list with assigned roles.
- `POST /api/staff`: Create new staff account.
- `PUT /api/staff/:id/status`: Deactivate/activate staff account.
- `PUT /api/staff/:id/reset-password`: Reset staff password.
- `GET /api/settings`: Institutional profile and receipt branding.
- `PUT /api/settings`: Update school profile.
- `GET /api/audit-logs`: Searchable immutable system audit logs.

---

## 5. Development & Production Commands

### Database Setup & Migration
```bash
# Push Prisma schema to MySQL
npx prisma db push

# Generate Prisma Client
npx prisma generate

# Seed initial database with roles, classes, fee structures, and sample students
npx tsx prisma/seed.ts
```

### Running the Application
```bash
# Start full-stack server (Node.js + Express + Vite dev middleware) on port 3000
npm run dev

# Build frontend and production assets
npm run build

# Start production server
npm start
```
