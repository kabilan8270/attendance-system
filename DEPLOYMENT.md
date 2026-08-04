# Deployment Guide — Attendance Management System

Architecture: **Vercel** (frontend) + **Render** (backend API) + **Supabase** (Postgres + Storage), one HTTPS URL per side, JWT auth between them.

---

## 0. What was actually broken (fixed in this pass)

Your Render backend build/start was failing because **`render.yaml` lived at `backend/render.yaml`**, not the repo root. Render's Blueprint feature only auto-reads `render.yaml` from the repository root by default. In a monorepo like this one, two failure modes follow from that:

- If the service was created via **"New Blueprint"**, Render silently never applied any of the env vars in that file (including the auto-generated `JWT_ACCESS_SECRET`/`JWT_REFRESH_SECRET`). Your code throws on startup if those are missing (`token.service.ts`), so the process would crash immediately after boot.
- If the service was created manually as a **Web Service** without setting **Root Directory = `backend`**, the build command `npm install && npm run build` runs from the repo root, where `package.json` has no `build` script — that fails with `npm error Missing script: "build"`.

**Fix applied:** moved `render.yaml` to the repo root with `rootDir: backend`, so Render builds/starts strictly inside `backend/` and Blueprint env vars actually get created. See "Backend on Render" below for the exact setup steps that go with this file.

Also fixed while in there (all itemized at the end of this doc):
- CORS was `origin: true` (reflects any origin back) + `credentials: true` — replaced with an explicit allowlist off `CLIENT_URL`.
- Removed `backend/.env.production`, which used variable names (`DB_HOST`, `DB_USER`, `DB_PASSWORD`) the code never reads — `DATABASE_URL` is the only thing `config/db.ts` looks at. It was dead and misleading, not a bug in itself, but worth deleting.
- Removed the unused `@supabase/server` dependency from `backend/package.json` (never imported anywhere — `config/supabase.ts` only uses `@supabase/supabase-js`).
- Removed `backend/railway.json` (you're deploying to Render, not Railway — dead config).
- Deleted a stray empty directory literally named `{config,models,controllers,routes,middleware,services,utils,validators}` under `backend/src` — leftover from a `mkdir -p src/{...}` run in a shell that doesn't do brace expansion. Harmless but confusing.

---

## 1. Rotate your secrets first — do this before anything else

Your uploaded project's `.env` and `.env.example` contained live-looking credentials in plaintext: a Supabase DB password, the Supabase **service-role key** (bypasses Row Level Security entirely), and JWT secrets that look hand-picked rather than random. They were correctly `.gitignore`'d, so they're not in your git history — but since they were shared outside your machine, treat them as burned:

1. **Supabase** → Project Settings → Database → reset the database password. Update the `DATABASE_URL` you use in Render with the new password.
2. **Supabase** → Project Settings → API → regenerate the `service_role` key. Update `SUPABASE_SERVICE_ROLE_KEY` in Render.
3. **JWT secrets** — generate two independent random secrets and set them directly in the Render dashboard (do not commit them anywhere):
   ```bash
   node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
   ```
   Run it twice — once for `JWT_ACCESS_SECRET`, once for `JWT_REFRESH_SECRET`. (If you deploy via the Blueprint in this repo, Render will auto-generate these for you instead — see below.)
4. Rotating the JWT secrets invalidates all existing sessions — everyone will need to log in again. That's expected and fine.

---

## 2. Environment variables

### Backend (Render) — set these in the Render dashboard, not in a committed file

| Variable | Example | Notes |
|---|---|---|
| `NODE_ENV` | `production` | |
| `PORT` | `5000` | Render sets its own `PORT` too; the app reads `process.env.PORT` either way |
| `CLIENT_URL` | `https://attendance.redlecare.in,https://attendance-system.vercel.app` | Comma-separated, no trailing slash. Every origin the frontend is served from |
| `DATABASE_URL` | `postgresql://postgres.<ref>:<pwd>@aws-0-<region>.pooler.supabase.com:6543/postgres` | Use Supabase's **Transaction pooler** string (port 6543), not the direct connection — Render's free/starter plans open many short-lived connections and the pooler handles that |
| `SUPABASE_URL` | `https://<ref>.supabase.co` | |
| `SUPABASE_SERVICE_ROLE_KEY` | — | Server-side only, never sent to the frontend |
| `SUPABASE_STORAGE_BUCKET` | `attendance-files` | |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | random 64-byte hex | Auto-generated if deploying via this repo's Blueprint |
| `JWT_ACCESS_EXPIRY` | `15m` | |
| `JWT_REFRESH_EXPIRY` | `30d` | |
| `RATE_LIMIT_WINDOW_MS` / `RATE_LIMIT_MAX` | `900000` / `200` | |

### Frontend (Vercel) — set in Vercel Project Settings → Environment Variables

| Variable | Example |
|---|---|
| `VITE_API_URL` | `https://attendance-api.onrender.com/api` |

Vite inlines `VITE_*` vars at build time, so this must be set in Vercel *before* each build — a change to it requires a redeploy, not just a restart.

---

## 3. Backend on Render

1. Push these changes (including the new root-level `render.yaml`) to your repo.
2. In Render: **New → Blueprint**, point it at this repository. Render will detect `render.yaml` at the root and propose one service, `attendance-api`, scoped to `rootDir: backend`.
3. During Blueprint setup, fill in the `sync: false` values: `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `CLIENT_URL`. Leave `JWT_ACCESS_SECRET`/`JWT_REFRESH_SECRET` on auto-generate.
4. Deploy. Build command: `npm install && npm run build` (runs inside `backend/`). Start command: `npm start` → `node dist/server.js`.
5. Confirm health: `https://<your-service>.onrender.com/health` should return `{"success":true,...}`.

**If you already have a Render service created the old (broken) way:** open its Settings tab and check **Root Directory**. If it's blank, set it to `backend`, then trigger a manual deploy. Either that, or delete the service and redeploy via the Blueprint — the Blueprint route is less error-prone since it also seeds the JWT env vars for you.

Render's free/starter web services spin down after inactivity and cold-start on the next request (10–30s delay). If simultaneous logins from many employees need to avoid that delay, upgrade the plan in `render.yaml` (`plan: starter` → `standard`) — everything else in this guide works the same regardless of plan.

---

## 4. Frontend on Vercel

1. Import the repo into Vercel, set **Root Directory** to `frontend` (same underlying issue as Render — Vercel needs to know which subfolder to build).
2. Framework preset: Vite (auto-detected from `frontend/vercel.json`).
3. Build command: `npm run build` (`tsc -b && vite build`). Output directory: `dist`.
4. Set `VITE_API_URL` env var (see table above) for Production, Preview, and Development environments in Vercel — each can point at a different backend if you want a staging API.
5. `frontend/vercel.json` already rewrites all routes to `index.html` (correct for a client-side-routed SPA) and sets `X-Frame-Options`, `X-Content-Type-Options`, and `Referrer-Policy` headers.
6. If you use a custom domain (`attendance.redlecare.in`), add it in Vercel → Domains, and make sure that exact origin is in the backend's `CLIENT_URL`.

---

## 5. Database — Supabase

- Schema lives in `database/` — run it once against your Supabase Postgres instance (SQL Editor in the Supabase dashboard, or `psql "$DATABASE_URL" -f database/schema.sql`).
- Use the **pooled** connection string (port 6543) for the app's `DATABASE_URL` — it's built for many short-lived serverless/PaaS connections, which is what Render gives you. The direct connection (port 5432) is better reserved for migrations run from your own machine.
- `config/db.ts` already sets `max: 20` pool connections, a 30s idle timeout, and a 5s connection timeout — reasonable defaults for a single Render instance; lower `max` if you scale to multiple instances so you don't exceed Supabase's connection cap.
- `config/supabase.ts` uses the service-role key purely for Storage (face images / profile photos) — RLS on your tables doesn't apply to it, so keep that key server-side only, which it already is.

---

## 6. Build & run commands (reference)

```bash
# Backend
cd backend
npm install
npm run build      # tsc -p tsconfig.json → dist/
npm start          # node dist/server.js

# Frontend
cd frontend
npm install
npm run build       # tsc -b && vite build → dist/
npm run preview     # local prod-mode preview on 127.0.0.1:4173
```

---

## 7. Final folder structure

```
attendance-system/
├── render.yaml              # Render Blueprint (rootDir: backend) — NEW location
├── docker-compose.yml        # local Postgres for dev, optional
├── backend/
│   ├── .env.example
│   ├── Dockerfile
│   ├── src/
│   │   ├── app.ts            # Express app, CORS allowlist, middleware
│   │   ├── server.ts         # entrypoint, DB check, graceful shutdown
│   │   ├── config/           # db.ts, supabase.ts
│   │   ├── controllers/
│   │   ├── routes/
│   │   ├── middleware/       # auth, error handling
│   │   ├── services/         # token, audit, geo, face, notification
│   │   └── utils/
│   └── package.json
├── frontend/
│   ├── .env.example
│   ├── vercel.json
│   ├── public/models/        # face-api.js models
│   └── src/
│       ├── api/client.ts     # axios + token refresh interceptor
│       ├── context/          # Auth, Theme
│       ├── hooks/            # geolocation, face-api models
│       ├── pages/admin/, pages/employee/, pages/auth/
│       └── components/
└── database/                 # schema.sql
```

---

## 8. Production checklist

- [ ] Supabase DB password rotated, Render `DATABASE_URL` updated
- [ ] Supabase service-role key rotated, Render `SUPABASE_SERVICE_ROLE_KEY` updated
- [ ] Fresh random `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` in Render (not reused from any file that's been shared)
- [ ] `render.yaml` deployed as a Blueprint from repo root (or existing service's Root Directory manually set to `backend`)
- [ ] Render `CLIENT_URL` lists every real frontend origin (prod domain + Vercel default domain), no trailing slashes
- [ ] Vercel `VITE_API_URL` points at the live Render URL + `/api`, set for Production
- [ ] `GET /health` on the Render URL returns 200
- [ ] HTTPS everywhere — Render and Vercel both provision this automatically, no action needed as long as you don't hardcode `http://`
- [ ] Custom domain (if any) added in Vercel and matched in `CLIENT_URL`
- [ ] `backend/package-lock.json` regenerated locally (`npm install`) after the `@supabase/server` removal and committed

## 9. Testing checklist

- [ ] Employee login works from the deployed frontend URL (not just localhost)
- [ ] Admin login works
- [ ] A request from an origin **not** in `CLIENT_URL` gets blocked by CORS (verifies the allowlist isn't accidentally wide open again)
- [ ] Token refresh works after the 15-minute access token expires (stay logged in past that mark)
- [ ] Camera-based attendance (face capture) prompts for permission and works — only functions over HTTPS, which both Vercel and Render provide
- [ ] GPS-based attendance prompts for location permission and works — same HTTPS requirement
- [ ] Two different browsers/devices logged in as two different employees simultaneously, both marking attendance, no session collisions
- [ ] Reports/exports (Excel/PDF) generate correctly against production data
- [ ] Mobile Chrome (Android) and desktop Chrome/Edge (Windows) both render the dashboards usably

---

## What's not in this pass

You asked to prioritize unblocking the deploy over feature work, so I didn't touch: PWA manifest/icons/offline support, WebSocket-based real-time attendance push, or dashboard UI/animation polish. Those are all legitimate asks from your original list — happy to do any of them next; the codebase is in good enough shape (React Query, typed API layer, clean route/controller split) that none of them require restructuring first.
