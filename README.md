# Pragya Bharti Public School (PBPS) - School Admission & Fee Management System

A production-grade, full-stack School Admission and Fee Management System built with **React.js**, **Node.js + Express.js + TypeScript**, **Prisma ORM**, and **MySQL 8 (MariaDB)**.

---

## 1. Localhost Setup Guide (Step-by-Step)

Follow these steps to run the application on your local development machine (Windows, macOS, or Linux).

### Step 1: Prerequisites
Make sure you have installed on your computer:
- **Node.js** (v18.x or v20+ recommended) & `npm`: [https://nodejs.org](https://nodejs.org)
- **MySQL Server 8.0+** OR **MariaDB 10.5+** (or via XAMPP / WampServer / Docker)

---

### Step 2: Set Up MySQL Database & User
Open your MySQL terminal (or phpMyAdmin / MySQL Workbench) as root:

```bash
mysql -u root -p
```

Run the following SQL commands to create the database and user:

```sql
-- 1. Create the database
CREATE DATABASE IF NOT EXISTS school_management CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 2. Create the dedicated database user
CREATE USER IF NOT EXISTS 'school_user'@'localhost' IDENTIFIED BY 'SchoolPass123!';

-- 3. Grant full permissions to the user on the database
GRANT ALL PRIVILEGES ON school_management.* TO 'school_user'@'localhost';

-- 4. Apply changes
FLUSH PRIVILEGES;

-- 5. Exit MySQL
EXIT;
```

> **Note**: If using MySQL 8 on Windows or default XAMPP root without password, you can alternatively use your existing MySQL credentials (e.g. `mysql://root:yourpassword@localhost:3306/school_management` or `mysql://root:@localhost:3306/school_management`).

---

### Step 3: Configure Environment Variables (`.env`)
In the root directory of your project, create a file named `.env` (or copy from `.env.example`):

```bash
cp .env.example .env
```

Ensure your `.env` contains:
```env
PORT=3000
DATABASE_URL="mysql://school_user:SchoolPass123!@localhost:3306/school_management"

JWT_SECRET="edumanage_jwt_secret_production_key_2026_xyz"
JWT_REFRESH_SECRET="edumanage_refresh_secret_production_key_2026_abc"

RAZORPAY_KEY_ID="rzp_test_school_edu_2026"
RAZORPAY_KEY_SECRET="rzp_test_secret_edu_2026"

SMTP_HOST="smtp.mailtrap.io"
SMTP_PORT=2525
SMTP_USER="smtp_user_example"
SMTP_PASSWORD="smtp_password_example"
SCHOOL_EMAIL="finance@pbps.edu.in"

STORAGE_PATH="./uploads"
VITE_API_URL="/api"
```

---

### Step 4: Install Project Dependencies
Run in your terminal from the project root:

```bash
npm install
```

---

### Step 5: Push Database Schema to MySQL
Prisma reads the schema from `prisma/schema.prisma` and automatically creates all 16 tables, foreign keys, and indexes in your MySQL database:

```bash
# Generate Prisma Client types
npm run prisma:generate

# Push schema directly to MySQL database (creates tables)
npm run prisma:push
```

---

### Step 6: Seed Database with Initial Data
Run the database seed script to populate academic sessions (`2026-27`), all classes (Nursery to 12th) & sections (A, B, C), fee structures, sample students, and default user accounts:

```bash
npm run prisma:seed
```

---

### Step 7: Start the Full-Stack Application
Start the integrated backend Express API + Vite frontend dev server:

```bash
npm run dev
```

Open your browser and navigate to:
**`http://localhost:3000`**

---

## 2. Default Login Accounts (PBPS)

| Role | Username / Email | Password | Assigned Permissions |
| :--- | :--- | :--- | :--- |
| **Super Admin** | `superadmin` / `admin@pbps.edu.in` | `Admin@123` | Full administrative, financial, staff, and system settings access |
| **Principal** | `principal` / `principal@pbps.edu.in` | `Admin@123` | Academic approvals, student directory, fee overviews, audit reports |
| **Accountant** | `accountant` / `accountant@pbps.edu.in` | `Admin@123` | Fee collections, receipt generation, PDF downloads, financial ledgers |
| **Admission Staff** | `admission_staff` / `admission@pbps.edu.in` | `Staff@123` | Multi-step student enrollments, document verification, class assignments |
| **Staff Member** | `staff_user` / `staff@pbps.edu.in` | `Staff@123` | Student directory & general academic view |

*Tip: The login page includes 1-click test buttons for each role to immediately test role-based access control.*

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
