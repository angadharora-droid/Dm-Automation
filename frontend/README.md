# Frontend — React Admin Dashboard

React (Vite) admin dashboard for the Instagram automation backend. It shows:

- **Status** — which credentials are configured (booleans only, never values) and whether
  storage is MongoDB or the in-memory fallback
- **Counters** — webhooks received, comments/DMs received, replies/DMs sent, duplicates
  skipped, errors
- **Recent activity** — a live feed of automation events (matched rules, sent replies, errors)
- **Automation rules** — the keyword rules currently loaded on the backend

## Development

```bash
cd frontend
npm install
npm run dev        # Vite dev server on http://localhost:5173
```

The dev server proxies `/api` to `http://localhost:3000`, so run the backend alongside it
(`cd backend && npm run dev`) and leave the "Backend URL" field empty.

## Build

```bash
npm run build      # outputs frontend/dist
```

The backend serves `frontend/dist` at `/dashboard` (same origin — no CORS needed). This is
what the root `Dockerfile` deploys to Railway.

**Hosting it separately instead:** deploy `frontend/dist` to any static host, fill in
**Backend URL** on the page (e.g. `https://your-app.up.railway.app`), and add that static
host's origin to the backend's `ALLOWED_ORIGINS` env var.

## Auth

All data comes from the backend's `/api/dashboard/*` endpoints, authenticated with the
`x-admin-key` header. Enter the backend's `ADMIN_API_KEY` value on the page — it is kept in
this browser tab only (sessionStorage) and never embedded in the build.
