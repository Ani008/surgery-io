# Surgery.io

A full-stack dashboard for tracking funded surgery programs. It replaces Excel-based record keeping for an eye hospital: staff upload completed-surgery sheets in batches, the system keeps a live balance against each fund, and reports can be exported for the fund owners.

## Overview

The hospital receives grants that pay for a fixed number of surgeries. Each grant is a **project** with a target count and a per-surgery amount. As surgeries are completed, staff upload an Excel sheet per **batch**. The backend validates the sheet, stores every surgery record, and reduces the project's remaining balance. When the balance reaches zero, the project is marked completed and further uploads are blocked.

## Features

- Role-based access (ADMIN and USER) using JWT, with route-level role checks
- Project management for funded programs: create, edit, delete, and mark as submitted or not submitted to the fund owner (admin only)
- Batch workflow: create a batch, upload its Excel sheet, then attach a ZIP of supporting documents
- Excel validation before import: the number of rows must match the batch's completed count, and uploads are refused for completed projects or batches that already have a sheet
- Transactional import: surgeries, project balance, project status and the batch record are all updated in a single database transaction, so a failed upload leaves no partial data
- Dashboard with progress charts and batch analytics (daily, weekly, monthly, yearly)
- Surgery records table with per-project grouping, plus PDF export
- Download of the original Excel sheet and ZIP for any batch
- API rate limiting (100 requests per 15 minutes per IP)

## Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | React 19, Vite, Tailwind CSS 4, React Router 7, Axios |
| Charts and reports | Chart.js (react-chartjs-2), Recharts, jsPDF with jspdf-autotable |
| Backend | Node.js, Express 5 |
| Database | MySQL with Prisma ORM |
| Auth and security | JSON Web Tokens, role middleware, express-rate-limit, CORS allow-list |
| File handling | Multer (uploads), SheetJS `xlsx` (Excel parsing) |

## Project Structure

```
surgery-io/
  backend/
    app.js                  Express app, CORS, rate limiter, route mounting
    server.js               Entry point
    config/db.js            Prisma client
    controllers/            auth, project, batch, excel, zip, surgery logic
    middleware/             auth (JWT), role, rate limiter, file upload
    routes/                 REST route definitions
    prisma/                 schema.prisma and migrations
  frontend/
    src/
      Pages/                Login, Dashboard, Projects, Surgeries, Upload Excel
      Components/           Layout, sidebar, tables, charts, modals, route guard
      utils/auth.js         Token and role helpers
```

## Data Model

- **Project**: name, unique project code, receipt number, total amount, per-surgery amount, remaining surgery balance, status (`ACTIVE` or `COMPLETED`), submission status
- **Batch**: belongs to a project, with a batch date, completed and incomplete counts, and the stored Excel and ZIP paths
- **Surgery**: one row per operation, linked to a project and a batch (serial number, MRD number, patient details, operated eye, surgery name and category, donor name, date of surgery)
- **User**: role (`ADMIN` or `USER`)

Relations: a Project has many Batches and many Surgeries, and each Surgery belongs to one Batch.

## Getting Started

### Prerequisites

- Node.js 18 or later
- A running MySQL server
- npm

### 1. Clone and install

```bash
git clone https://github.com/Ani008/surgery-io.git
cd surgery-io

cd backend
npm install

cd ../frontend
npm install
```

### 2. Configure the backend

Create `backend/.env`:

```env
DATABASE_URL="mysql://USER:PASSWORD@localhost:3306/surgery_io"
JWT_SECRET="a-long-random-string"
ADMIN_PASSWORD="choose-a-strong-password"
USER_PASSWORD="choose-another-strong-password"
PORT=5000
```

Add your frontend origin to the CORS allow-list in `backend/app.js` if you are not using one of the listed origins.

### 3. Run the database migrations

```bash
cd backend
npx prisma migrate deploy
```

### 4. Start the backend

```bash
cd backend
npm start
```

`npm start` applies pending migrations and then starts the server on the configured port. Run it from the `backend` folder, because uploaded files are written to `backend/uploads/`.

### 5. Configure and start the frontend

Create `frontend/.env`:

```env
VITE_API_URL=http://localhost:5000
```

```bash
cd frontend
npm run dev
```

## Excel Upload Format

The first sheet of the uploaded workbook must contain these column headers:

`Sr No`, `MRD No`, `Patient Name`, `Address`, `Operated Eye`, `Age`, `Sex`, `Date of Surgery`, `Contact No`, `Surgery Name`, `Donor Name`, `Surgery Category`

Dates can be Excel date cells or text in `DD-MM-YYYY` format. `Address` and `Surgery Category` are optional.

## API Overview

All `/api` routes are rate limited. Except for login, routes require an `Authorization: Bearer <token>` header.

| Method | Endpoint | Access | Purpose |
| --- | --- | --- | --- |
| POST | `/api/auth/login` | Public | Log in with a role and password |
| GET | `/api/projects` | Authenticated | List projects |
| POST | `/api/projects` | Admin | Create a project |
| PUT | `/api/projects/:id` | Admin | Update a project and recalculate its balance |
| PATCH | `/api/projects/:id/submission` | Admin | Set submitted or not submitted |
| DELETE | `/api/projects/:id` | Admin | Delete a project |
| POST | `/api/batches/create` | Admin, User | Create a batch for a project |
| POST | `/api/excel/upload/:batchId` | Admin, User | Validate and import a batch's Excel sheet |
| POST | `/api/batches/upload-zip/:batchId` | Admin, User | Attach supporting documents as a ZIP |
| GET | `/api/batches/project/:projectId` | Admin, User | List a project's batches |
| GET | `/api/batches/:batchId/download-excel` | Admin, User | Download the batch's Excel file |
| GET | `/api/batches/:batchId/download-zip` | Admin, User | Download the batch's ZIP file |
| DELETE | `/api/batches/:batchId` | Admin, User | Delete a batch that has no surgeries |
| GET | `/api/batches/analytics` | See note | Completed and incomplete totals by period |
| GET | `/api/surgeries` | Authenticated | List surgery records |
| DELETE | `/api/surgeries/project/:projectId` | Authenticated | Delete a project's surgery records |
| GET | `/api/health` | Public | Health check |

## Design Decisions

- **MongoDB-style flexibility was not needed here.** The data is tabular and financial, and the source material was already Excel sheets, so a relational schema with Prisma migrations and foreign keys fits well.
- **Imports run inside a transaction.** A sheet is either fully imported with the balance updated, or not imported at all.
- **Server-side rules, not just UI rules.** Completed projects, duplicate uploads and row-count mismatches are rejected by the API, so they cannot be bypassed from the client.

## Deployment

The frontend includes a `vercel.json` rewrite so client-side routes work on Vercel. The backend is a standard Node.js service and can be run on any server or VPS behind a reverse proxy such as Nginx, with a process manager such as PM2. If you accept large Excel or ZIP uploads, raise the upload size limit in your reverse proxy as well.

## License

Released under the ISC license.