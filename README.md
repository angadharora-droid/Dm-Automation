# Instagram DM & Comment Automation

A production-oriented system for automating Instagram comments and DMs through the
**official Meta Instagram Platform API** (the *Instagram API with Instagram Login* flavor,
hosted at `graph.instagram.com`).

**Stack:** React (Vite) frontend · Node.js/Express backend in plain JavaScript · MongoDB.

What it does today:

- Receives and verifies Instagram webhook events (signature-checked)
- Detects new **comments** on your posts/reels
- Detects incoming **DMs**
- **Comment → DM**: when a comment matches a keyword (e.g. `PRICE`), sends the commenter a
  private reply (DM) and optionally a public comment reply
- **DM auto-reply**: replies to incoming DMs based on keyword rules
- Duplicate-event protection (MongoDB-backed), self-reply loop protection, per-user
  throttling, retries/timeouts
- A **React admin dashboard** at `/dashboard` (status, counters, live activity feed, rules)

The automation logic is modular: the rule-based reply generator implements a `ReplyGenerator`
contract, so an AI-backed generator can be plugged in later without touching the Meta
integration.

```
Instagram → Meta Webhook → POST /webhooks/instagram
                             ├─ signature validation (X-Hub-Signature-256)
                             ├─ fast 200 ACK, async processing
                             ├─ CommentAutomationService ─┐
                             └─ DmAutomationService ──────┤
                                                          ├─ idempotency (MongoDB) + throttle + loop guards
                                                          └─ InstagramService → graph.instagram.com
React dashboard ← /api/dashboard/* ← activity log + counters (MongoDB)
```

## Project structure

```
backend/                       # Express API — plain JavaScript (ESM), no build step
  src/
    server.js                  # entry point (Railway PORT handling, Mongo connect, shutdown)
    app.js                     # Express app + composition root (swap implementations here)
    config/
      env.js                   # typed environment access
      automation.config.js     # keyword rules (env-overridable via AUTOMATION_RULES)
    routes/                    # health, webhooks, admin API, dashboard API
    controllers/               # webhook verification/receiving, admin endpoints
    services/
      meta/                    # Meta API client + Instagram operations
      automation/              # comment/DM automation, reply generator, keyword matcher
      events/                  # in-memory fallback stores + reply throttle
      db/                      # MongoDB connect + Mongo-backed idempotency & activity log
    utils/logger.js            # structured logs with secret redaction
  tests/                       # vitest + supertest (no real Meta API or MongoDB needed)
frontend/                      # React (Vite) admin dashboard
  src/                         # App, api client, components
  dist/                        # build output (served by the backend at /dashboard)
Dockerfile                     # builds frontend, runs backend — one Railway service
```

## MongoDB

Set `MONGODB_URI` (MongoDB Atlas, or a Railway MongoDB service) and the backend uses:

- `processed_events` — duplicate-event protection (atomic insert, TTL-expired after 24h);
  correct even across multiple instances
- `activity_log` — dashboard activity feed (TTL-expired after 7 days)
- `dashboard_counters` — counters that survive restarts

**Without `MONGODB_URI` the backend still runs** — it logs a warning and falls back to
in-memory stores (fine for local development; events/counters reset on restart). If the
database is unreachable at startup it also falls back rather than crashing, and the
idempotency store fails open (better one duplicate reply than a dropped customer message).

## Local setup

Backend (terminal 1):

```bash
cd backend
npm install
cp .env.example .env    # then fill in your values
npm run dev             # http://localhost:3000
```

Frontend (terminal 2, optional — for dashboard development):

```bash
cd frontend
npm install
npm run dev             # http://localhost:5173, proxies /api to :3000
```

To use the dashboard without the Vite dev server: `cd frontend && npm run build` once, then
open `http://localhost:3000/dashboard`.

Checks (from `backend/`): `npm test` · `npm run lint` · `npm run format`.

To receive real webhooks locally you need a public HTTPS URL — use a tunnel
(e.g. `ngrok http 3000`) and point the Meta webhook Callback URL at
`https://<tunnel-domain>/webhooks/instagram`.

## Production

```bash
cd frontend && npm run build     # once per frontend change
cd ../backend && npm start       # plain Node — no backend build step
```

The server listens on `process.env.PORT` (falls back to 3000 locally) and binds `0.0.0.0`,
as Railway requires. The root-level `Dockerfile` does both steps automatically.

## Environment variables

All variables live on the **backend** (copy `backend/.env.example` to `backend/.env`).
**Never commit `.env`** (it is git-ignored). The React build needs no env vars.

| Variable | Required | Purpose |
| --- | --- | --- |
| `PORT` | no | HTTP port. Railway injects this automatically — do not set it on Railway. |
| `NODE_ENV` | no | `development` / `production`. |
| `META_APP_ID` | no* | Your Meta app ID (App Dashboard → App settings → Basic). Not used for API calls yet; kept for the future OAuth/token-refresh flow. |
| `META_APP_SECRET` | **yes** | App secret. Used to validate the `X-Hub-Signature-256` webhook signature. Webhook POSTs are rejected without it. |
| `META_VERIFY_TOKEN` | **yes** | A random string **you invent**. Must match the "Verify token" you enter in the Meta App Dashboard webhook configuration. |
| `INSTAGRAM_ACCESS_TOKEN` | **yes** | Instagram User access token for your professional account. Sent as a Bearer header (never in URLs, never logged). |
| `INSTAGRAM_ACCOUNT_ID` | **yes** | Your Instagram professional account ID. Used as the `/{IG_ID}/messages` path segment and for self-message loop protection. |
| `MONGODB_URI` | recommended | MongoDB connection string. Unset = in-memory fallback (resets on restart). |
| `MONGODB_DB` | no | Database name, default `instagram_automation`. |
| `META_API_VERSION` | no | Graph API version, default `v25.0`. |
| `META_GRAPH_BASE_URL` | no | Default `https://graph.instagram.com` (the Instagram Login API host). |
| `ADMIN_API_KEY` | no | Enables the dashboard/admin API when set; those endpoints return 503 when unset. Choose a long random string. |
| `LOG_LEVEL` | no | `debug` / `info` (default) / `warn` / `error`. |
| `REQUEST_TIMEOUT_MS` | no | Outbound Meta API timeout, default 10000. |
| `WEBHOOK_BODY_LIMIT` | no | Request body limit, default `1mb`. |
| `ALLOWED_ORIGINS` | no | Comma-separated CORS allowlist. Only needed when hosting the frontend separately from the backend. |
| `FRONTEND_DIR` | no | Path to the built dashboard. Default: the sibling `../frontend/dist` folder. |
| `AUTOMATION_RULES` | no | JSON override for the keyword rules (see below). |

## Automation rules

Default rules live in [backend/src/config/automation.config.js](backend/src/config/automation.config.js):
comments containing `price`, `info`, `details`, `buy`, or `link` trigger a private reply (DM)
plus a public comment reply; DMs containing `price` / `cost` / `how much` (and the info group)
get a keyword-based reply. Unmatched DMs get **no** automated reply unless you set a fallback.

Override without code changes by setting `AUTOMATION_RULES` to JSON:

```json
{
  "commentRules": [
    {
      "id": "launch-campaign",
      "keywords": ["price", "buy"],
      "action": "private_and_public_reply",
      "dmMessage": "Hi! Thanks for your interest. I'll send you the details.",
      "publicReplyMessage": "Just sent you a DM! 📩",
      "mediaIds": []
    }
  ],
  "dmRules": [
    { "id": "dm-price", "keywords": ["price", "how much"], "reply": "Hi! The price is ..." }
  ],
  "dmFallbackReply": null
}
```

- `action`: `private_reply`, `public_reply`, or `private_and_public_reply`
- `mediaIds`: optional — restrict a rule to specific posts (empty/omitted = all posts)
- Keep reply texts **free of the trigger keywords** — it is one of the loop-protection layers.

### Plugging in AI later

`DmAutomationService` depends only on the `ReplyGenerator` contract
([backend/src/services/automation/reply-generator.js](backend/src/services/automation/reply-generator.js)):

```js
generateReply({ channel, text, senderId }) -> Promise<string|null>  // null = stay silent
```

Implement e.g. `AnthropicReplyGenerator` and swap it for `RuleBasedReplyGenerator` in
`createDefaultServices()` in [backend/src/app.js](backend/src/app.js). Nothing else changes.

## Admin dashboard (React)

Open `https://<your-domain>/dashboard` and enter your `ADMIN_API_KEY`. It shows configuration
status (booleans only — never secret values), storage mode (MongoDB vs in-memory), counters,
a live activity feed (auto-refreshes every 10s), and the loaded rules. See
[frontend/README.md](frontend/README.md) for dashboard development and separate hosting.

Admin helper endpoints (same `x-admin-key` header):

- `GET /api/instagram/account` — verifies your access token works
- `POST /api/instagram/subscribe` — subscribes your account to the `comments` + `messages`
  webhook fields (required one-time setup step, see below)

## Reliability & security measures

- Webhook **signature validation** (`X-Hub-Signature-256`, timing-safe compare) — unsigned or
  mis-signed requests are rejected with 401
- Fast 200 ACK, asynchronous event processing (Meta retries slow responses)
- **Idempotency**: every comment ID / message ID is processed once. MongoDB-backed (atomic
  insert + TTL) when `MONGODB_URI` is set — correct across restarts and multiple instances;
  in-memory fallback otherwise
- **Loop protection**: skips `is_echo` messages, skips events from your own account ID, skips
  comments whose text equals your own reply templates, and throttles sends per user (3/min)
- Timeouts + exponential-backoff retries on 5xx/network errors; Graph rate-limit codes
  (4, 17, 613) and the `X-App-Usage` header are surfaced in logs
- Helmet security headers, JSON body limit, CORS locked down, generic error responses
- Secrets only via env vars; the access token travels in the `Authorization` header only; the
  logger actively redacts secret values (including `MONGODB_URI`) if they ever appear in a line

## Railway deployment

1. Push this project to a GitHub repository (make sure `.env` is not committed).
2. Go to [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub repo** and
   select the repository. (Alternative without GitHub: `npm i -g @railway/cli`, `railway init`,
   `railway up`.)
3. Railway detects the root-level `Dockerfile` (builds the React dashboard, runs the JS
   backend — one service). Keep the service's Root Directory at the repo root, and do **not**
   set `PORT` — Railway injects it.
4. Add a **MongoDB database**: in the same Railway project, **+ New → Database → MongoDB**
   (or use a free MongoDB Atlas cluster). Copy its connection string.
5. In the backend service → **Variables**, add:
   `META_APP_ID`, `META_APP_SECRET`, `META_VERIFY_TOKEN`, `INSTAGRAM_ACCESS_TOKEN`,
   `INSTAGRAM_ACCOUNT_ID`, `MONGODB_URI` (from step 4 — on Railway you can reference the
   Mongo service's variable), `META_API_VERSION=v25.0`, `NODE_ENV=production`, and
   `ADMIN_API_KEY` (recommended, for the dashboard).
6. Deploy, then open **Settings → Networking → Generate Domain** to get your public HTTPS
   domain, e.g. `https://your-app.up.railway.app`.
7. Verify `https://your-app.up.railway.app/health` returns `{"status":"ok"}` and
   `/dashboard` loads the React dashboard.
8. Your Meta webhook **Callback URL** is:

```
https://YOUR-RAILWAY-DOMAIN/webhooks/instagram
```

Optional: in Railway service settings, set the health check path to `/health`.

# Meta Configuration

Everything below happens at [developers.facebook.com](https://developers.facebook.com) in your
app's dashboard. Your setup (Business app + **Instagram** product + connected Instagram
professional account) uses the **Instagram API with Instagram Login** — base URL
`graph.instagram.com`; a Facebook Page is *not* required.

Docs used (verify against these, they are the source of truth):

- Webhooks: <https://developers.facebook.com/docs/instagram-platform/webhooks>
- Messaging: <https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/messaging-api>
- Private replies: <https://developers.facebook.com/docs/instagram-platform/private-replies>
- Comment moderation: <https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/comment-moderation>
- Webhook payloads: <https://developers.facebook.com/docs/graph-api/webhooks/reference/instagram>

### 1. Required permissions (scopes)

| Permission | Why |
| --- | --- |
| `instagram_business_basic` | Base permission: account info, media/comment metadata. Required by everything below. |
| `instagram_business_manage_comments` | Read comment webhooks, reply to comments (`POST /{comment-id}/replies`), and send **private replies** to commenters. |
| `instagram_business_manage_messages` | Receive message webhooks and send DMs (`POST /{IG_ID}/messages`). |

In **Development mode** these work for app-role users (you) without App Review. App Review is
only needed for **Live mode** / arbitrary public users.

### 2. Access token & account ID

1. App Dashboard → **Instagram** → **API setup with Instagram login**.
2. Generate an access token for your connected professional account (grant the three
   permissions above). Long-lived tokens last ~60 days and can be refreshed via
   `GET /refresh_access_token` — refresh automation can be added later.
3. Put the token in `INSTAGRAM_ACCESS_TOKEN` and the account ID shown there in
   `INSTAGRAM_ACCOUNT_ID` (you can cross-check via `GET /api/instagram/account`).

### 3. Webhook configuration (after deploying to Railway)

1. App Dashboard → **Instagram** → **API setup with Instagram login** → **Configure webhooks**
   (or the **Webhooks** product → object type **Instagram**).
2. **Callback URL**: `https://YOUR-RAILWAY-DOMAIN/webhooks/instagram`
3. **Verify token**: exactly the value of your `META_VERIFY_TOKEN` env var.
4. Click **Verify and save** — Meta sends the GET handshake; the backend must already be
   deployed with `META_VERIFY_TOKEN` set for this to succeed.
5. Subscribe to the webhook **fields**: `comments` and `messages`.
6. **Required extra step** — subscribe your account to those fields via the API:
   call `POST https://YOUR-RAILWAY-DOMAIN/api/instagram/subscribe` with header
   `x-admin-key: <your ADMIN_API_KEY>` (this runs Meta's
   `POST /{IG_ID}/subscribed_apps?subscribed_fields=comments,messages` for you).
   Without this, Meta will not deliver events for your account.

### 4. Development-mode testing

While the app is in **Development mode**:

- Webhook events are delivered for the **connected professional account** and app-role users.
- Comment on one of your posts with `PRICE` from a **different** Instagram account that has a
  role on the app (add it under App roles → Instagram testers), and DM your professional
  account from it. Watch the Railway logs and the `/dashboard` activity feed.
- Remember the messaging window: the API can DM a user only **within 24h of their last
  message**; a **private reply** to a comment is allowed **once per comment, within 7 days**.

### 5. App Review & Going Live (later — do not do this until testing is complete)

1. Test everything end-to-end in Development mode first.
2. When ready for real users: App Review → request **Advanced Access** for
   `instagram_business_basic`, `instagram_business_manage_comments`,
   `instagram_business_manage_messages`. You will need screencasts showing the comment→DM and
   DM-reply flows, and your Business verification (already done).
3. Only after approval, switch the app to **Live mode**.
4. This backend never changes app mode or submits anything to Meta automatically.

### Development vs Production

| | Development mode (now) | Live mode (after App Review) |
| --- | --- | --- |
| Who triggers webhooks | Your connected account + app-role testers | Any Instagram user |
| Comment auto-reply / private reply | ✅ works for testers | ✅ works for everyone |
| DM auto-reply | ✅ works for testers | ✅ works for everyone |
| Requirement | App roles only | Advanced Access via App Review + Live mode |

## Current limitations

- Replies only work for **app-role accounts** until App Review + Live mode.
- Without `MONGODB_URI`, idempotency/activity/counters are in-memory (reset on redeploy).
  The per-user reply throttle is in-memory in both modes (single-instance assumption).
- The access token must currently be refreshed manually (~60-day long-lived token).
- One private reply per comment and the 24-hour DM window are **Meta platform rules** — the
  backend logs these failures but cannot bypass them.
- No conversation history, CRM, or AI yet — the interfaces are in place for all three.

## Tests

`cd backend && npm test` — 55 tests covering webhook verification (valid/invalid token),
signed/unsigned webhook POSTs, comment & DM keyword automation, loop guards, duplicate-event
protection, unknown-event handling, the health endpoint, the dashboard API, and the Meta API
client (mocked `fetch` — the suite needs neither real Meta calls nor a running MongoDB).
