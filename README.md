# Employee Attendance Management System

A complete, production-ready attendance management platform with face-recognition
+ GPS-verified check-in/check-out, dual admin/employee portals, leave & shift
management, reporting, and a modern responsive UI.

**Stack:** React 19 + TypeScript + Vite + Tailwind (frontend) · Node.js + Express +
TypeScript (backend) · PostgreSQL/Supabase (database + storage) · face-api.js
(face recognition + liveness) · JWT auth.

---

## 1. What's included

### Backend (`/backend`)
- 12-table PostgreSQL schema with indexes, constraints, and triggers (`database/schema.sql`)
- Separate Admin and Employee authentication, JWT access + refresh tokens, unlimited simultaneous device sessions
- bcrypt password hashing, forgot/reset/change password, logout & logout-all-devices
- RBAC (`super_admin` / `admin` / `hr`)
- Employee CRUD: add/edit/disable/enable/delete/reset password/enroll face
- Department, Shift, and Holiday management
- Office GPS geofence configuration (lat/lng/radius, supports multiple office locations)
- Attendance check-in/check-out that enforces, **in this order**:
  1. GPS geofence check (Haversine distance against configured office radius)
  2. Face verification: 128-d descriptor match against enrolled employee face, gated by a client-side liveness (blink) check that blocks photo/video/replay spoofing
  3. Late / present / half-day status calculated from shift + working hours
  - If either GPS or face verification fails, **no attendance record is written**
- Leave management: request/approve/reject/cancel, leave balances, auto-marks attendance as "leave" on approval
- Notifications (attendance success, leave approved/rejected, leave added, etc.)
- Reports: Daily/Weekly/Monthly/Yearly/Late/Leave/Attendance-Summary, exportable as Excel (.xlsx) and PDF
- Dashboard analytics endpoints (cards + trend + department breakdown)
- Audit logging on every sensitive action
- Security: Helmet, CORS, rate limiting (strict on login), HPP, parameterized SQL everywhere, RBAC middleware

### Frontend (`/frontend`)
- Two completely separate login flows: Admin/HR and Employee, with a landing chooser page
- Dark mode / light mode, glassmorphism cards, responsive layout, sidebar (desktop) + bottom nav (mobile)
- **Admin dashboard:** stat cards, attendance trend line chart, department bar chart, employee management (add/edit/enable/disable/delete/reset password/enroll face), attendance search & export, leave approvals, shift/holiday/department/office-location management, report generation
- **Employee dashboard:** month summary, leave balance, mark-attendance shortcut
- **Mark Attendance flow:** requests GPS location → live webcam opens → blink-based liveness check → face descriptor captured → submitted to backend for verification → success/failure feedback. Attendance is only recorded if both GPS and face+liveness checks pass server-side.
- Attendance calendar with color-coded statuses (green/red/yellow/orange/blue/teal) and click-to-view day detail
- Leave request submission/cancellation, profile view, change password

---

## 2. Local setup

### Prerequisites
- Node.js 18+
- A PostgreSQL database (Supabase recommended, or local Postgres via the included `docker-compose.yml`)
- A Supabase project with Storage enabled (for face image + profile photo storage)

### Option A — Docker Compose (fastest for local dev)
```bash
docker-compose up -d postgres   # starts Postgres and auto-applies database/schema.sql
cd backend && cp .env.example .env   # fill in Supabase + JWT values, DATABASE_URL already matches docker-compose
npm install
npx ts-node src/utils/seedAdmin.ts
npm run dev
```

### Option B — Manual / Supabase
```bash
cd backend
cp .env.example .env        # fill in DATABASE_URL (Supabase connection string), SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, JWT secrets
npm install
psql "$DATABASE_URL" -f ../database/schema.sql
npx ts-node src/utils/seedAdmin.ts     # creates first super_admin
npm run dev                  # http://localhost:5000
```
Create a Supabase Storage bucket matching `SUPABASE_STORAGE_BUCKET` (default `attendance-files`).

### Frontend
```bash
cd frontend
cp .env.example .env        # set VITE_API_URL to your backend, e.g. http://localhost:5000/api
npm install
# Download face-api.js model weights (one-time, ~15MB) — see frontend/public/models/README.md
npm run dev                  # http://localhost:5173
```

### First-time configuration (as admin, after logging in)
1. Log in with the credentials printed by `seedAdmin.ts`. **Change the password immediately.**
2. Go to **Office Locations** and add at least one location with your office's GPS coordinates and radius — employees cannot check in until this exists.
3. Add **Departments** and **Shifts**.
4. Add **Employees**, assign department/shift, then **enroll each employee's face** (webcam capture, no liveness required for enrollment since it's admin-supervised).
5. Employees can now log in and use **Mark Attendance**.

---

## 3. Deployment

| Layer | Target | Config file |
|---|---|---|
| Frontend | Vercel | `frontend/vercel.json` |
| Backend | Railway | `backend/railway.json` |
| Backend | Render | `backend/render.yaml` |
| Backend | Any Docker host | `backend/Dockerfile` |
| Database + Storage | Supabase | `database/schema.sql` |
| CI | GitHub Actions | `.github/workflows/ci.yml` (builds both apps on push/PR) |

Environment variables to set on your hosting provider mirror `.env.example` in each app.
Set `CLIENT_URL` on the backend to your deployed frontend origin (CORS), and
`VITE_API_URL` on the frontend to your deployed backend's `/api` base URL.

---

## 4. API reference (all endpoints)

All routes are prefixed `/api`. Bearer JWT required unless noted.

**Auth** — `/auth`: `POST /admin/login`, `POST /employee/login`, `POST /refresh`, `POST /logout`, `POST /logout-all` (auth), `POST /forgot-password`, `POST /reset-password`, `POST /change-password` (auth)

**Employees** — `/employees`: `GET /me` (employee), `POST /` `GET /` `GET /:id` `PUT /:id` `PATCH /:id/status` `DELETE /:id` `POST /:id/reset-password` `POST /:id/enroll-face` (admin)

**Attendance** — `/attendance`: `POST /check-in` `POST /check-out` `GET /me` (employee) · `GET /` `POST /override` (admin)

**Departments** — `/departments`: `GET /` (any authenticated) · `POST /` `PUT /:id` `DELETE /:id` (admin)

**Shifts** — `/shifts`: `GET /` (any) · `POST /` `PUT /:id` `DELETE /:id` `POST /assign` (admin)

**Holidays** — `/holidays`: `GET /` (any) · `POST /` `PUT /:id` `DELETE /:id` (admin)

**Office Locations** — `/office-locations`: all admin-only, `GET /` `POST /` `PUT /:id` `DELETE /:id`

**Leaves** — `/leaves`: `POST /` `GET /me` `PATCH /:id/cancel` (employee) · `GET /` `PATCH /:id/approve` `PATCH /:id/reject` `PATCH /:id/admin-cancel` `POST /admin-add` (admin)

**Notifications** — `/notifications`: `GET /` `PATCH /:id/read` `PATCH /read-all` (any authenticated)

**Dashboard** — `/dashboard` (admin only): `GET /summary` `GET /trend` `GET /department-attendance` `GET /period-attendance`

**Reports** — `/reports` (admin only): `GET /attendance?type=daily|weekly|monthly|yearly|late&format=json|pdf|excel`, `GET /leave?format=json|excel`, `GET /attendance-summary?from=&to=&format=json|excel`

---

## 5. Notes on the face recognition & liveness design

- Face enrollment stores a 128-dimensional descriptor (face-api.js `faceRecognitionNet`) plus a reference photo in Supabase Storage.
- At check-in/out, the browser captures a live descriptor and a liveness signal from a **blink-detection challenge** (Eye Aspect Ratio computed from live landmarks over time — a static photo or paused video cannot produce a real blink cycle).
- The backend independently re-verifies both the descriptor similarity (Euclidean distance → similarity score, threshold configurable in `settings` table) and the liveness flag before writing any attendance row. Failing either check blocks the write entirely — there is no client-side-only trust.
- This is a solid baseline anti-spoofing design (photo/simple-video-replay resistant). For higher-assurance production deployments (e.g. sophisticated deepfake/replay attacks), consider pairing this with a dedicated liveness-detection API/SDK or hardware (IR camera) — this is flagged as a possible future hardening step, not included here.

## 6. What's deliberately out of scope for this delivery

- Automated test suites (unit/integration) — not requested, can be added on request
- Multi-tenant / multi-company support — schema is single-tenant
- Email delivery integration (SES/SendGrid) — forgot-password currently returns the token in dev mode only; wire up a mail provider for production
- Push notification delivery (web push / FCM) — notifications are currently in-app/polling only, not device push
