# Spa for Cars Platform (CMS + Dashboards + Alerts)

This project now includes:
- Website content integration hooks for a headless CMS (Sanity by default).
- Operations dashboard (`/#/dashboard`) for lead/service tracking.
- Admin dashboard (`/#/admin`) for notification controls and audit visibility.
- Enquiry pipeline APIs with alert emails via Resend.
- Supabase-first data/auth/RBAC architecture.

## Architecture
- Frontend: React + Vite
- API: Express + `api/` handlers (`server.ts` locally and on Render); optional Vercel serverless only if you deploy `api/` to Vercel (not recommended on Hobby — see below)
- Data/Auth: Supabase
- CMS: Sanity (with adapter for future external CMS swap)
- Email alerts: Resend

## Vercel (static SPA) + Render (API) — recommended for Hobby

Vercel Hobby limits how many **Serverless Functions** one deployment can include. This repository defines **many** `api/**/*.ts` handlers, so deploying `api/` to Vercel can exceed that cap.

**Recommended setup:**

1. **Vercel** — deploy **only the Vite build** (`dist`). The repo includes [`.vercelignore`](.vercelignore) with `api/` so those files are **not** uploaded as Vercel functions.
2. **Render** — create a **Web Service** from the same repo. It runs [`server.ts`](server.ts), which loads routes from `api/` at runtime (same as local `npm run dev`).
3. **Frontend env (Vercel)** — set **`VITE_PUBLIC_API_BASE_URL=https://<your-render-service>.onrender.com`** so all browser calls to `/api/*` resolve to Render (see [`lib/apiClient.ts`](lib/apiClient.ts) `resolveApiUrl`, plus CMS hooks).

**Render notes:**

- **Start command:** `npm run start:render` (uses `tsx`; `tsx` is listed in `dependencies` so production installs on Render include it).
- **CORS:** set `CORS_ALLOWED_ORIGINS` to your Vercel production URL (and preview URLs if you use them), comma-separated.
- **`APP_BASE_URL`:** set to your **Vercel** site URL for correct links in emails and alerts.

**Optional:** you can still use `VITE_DASHBOARD_API_BASE_URL` for a **partial** split (some routes on Vercel, heavy routes on Render) — see the next section. If **all** API traffic goes to Render, `VITE_PUBLIC_API_BASE_URL` alone is enough once every client uses `resolveApiUrl` / `apiRequest`.

## Render + Vercel Dual Hosting (Hobby Plans)
Use this split when hosting the customer-facing website on Vercel Hobby and dashboard/heavy APIs on Render Hobby.

### Route ownership matrix
- **Keep on Vercel (light/public)**
  - `/api/cms/page`
  - `/api/enquiries`
  - `/api/bookings*`
  - `/api/auth/me`
  - `/api/create-payment-intent`
  - `/api/send-gift-card`
- **Move to Render (dashboard/heavy)**
  - `/api/dashboard/*`
  - `/api/reports/*`
  - `/api/ai/*`
  - `/api/cron/*`
  - `/api/leads/bulk-actions`
  - `/api/service-jobs/bulk-actions`
  - `/api/customers/*`

### Frontend API routing
Client URL routing is centralized in `lib/apiClient.ts`:
- `VITE_DASHBOARD_API_BASE_URL` is used for heavy/dashboard route prefixes.
- `VITE_PUBLIC_API_BASE_URL` can optionally force public `/api/*` calls to a fixed origin.
- If unset, requests stay same-origin (default behavior).

### Vercel project (frontend + light APIs)
- Framework: Vite
- Build command: `npm run build`
- Output directory: `dist`
- For **SPA-only on Vercel** (API on Render), keep [`.vercelignore`](.vercelignore) so `api/` is not deployed as functions, and set `VITE_PUBLIC_API_BASE_URL` to your Render URL.
- Keep `vercel.json` rewrites.
- **Hobby plan note:** This repo does **not** define `crons` in `vercel.json`, so Hobby deployments succeed. Vercel Hobby cron scheduling is limited (daily cadence), so run retries/summaries on **Render** (or another external scheduler) for finer intervals.

Required Vercel env variables:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_SANITY_PROJECT_ID`
- `VITE_SANITY_DATASET`
- `VITE_STRIPE_PUBLISHABLE_KEY`
- `VITE_DASHBOARD_API_BASE_URL=https://<your-render-service>.onrender.com`
- `VITE_PUBLIC_API_BASE_URL` (optional)

### Render project (dashboard/heavy APIs)
Create a Render Web Service from this repo:
- Build command: `npm install && npm run build`
- Start command: `npm run start:render`

Required Render env variables:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SANITY_PROJECT_ID`
- `SANITY_DATASET`
- `SANITY_API_TOKEN`
- `CMS_PROVIDER`
- `EXTERNAL_CMS_BASE_URL` (if external CMS mode)
- `EXTERNAL_CMS_TOKEN` (if external CMS mode)
- `RESEND_API_KEY`
- `ALERT_FROM_EMAIL`
- `DEFAULT_ALERT_RECIPIENTS`
- `CRON_SECRET`
- `APP_BASE_URL=https://<your-vercel-domain>`
- `CORS_ALLOWED_ORIGINS=https://<your-vercel-domain>,https://<preview-domain>.vercel.app`

### Cron placement
For dual hosting, prefer scheduling cron on Render for:
- `/api/cron/retry-notifications`
- `/api/cron/daily-ops-summary`

If you keep cron on Vercel, keep `CRON_SECRET` aligned across environments and point cron only to the host that owns those endpoints.

## Key Implemented Routes
- `POST /api/enquiries`
- `GET/POST /api/leads`
- `PATCH /api/leads/:id`
- `GET/POST/PATCH /api/service-jobs`
- `GET /api/clients`
- `GET /api/dashboard/metrics`
- `GET /api/auth/me`
- `GET/POST/PATCH /api/admin/notification-recipients`
- `GET /api/admin/notification-events`
- `GET/PATCH /api/admin/settings`
- `GET /api/admin/audit-logs`
- `POST /api/enquiries/:id/resend-alert`
- `GET /api/cron/retry-notifications`
- `GET /api/cms/page?slug=<page>`

## Database Setup (Supabase)
Run the SQL in:
- `supabase/schema.sql`

This creates:
- enquiries, leads, clients, service_jobs
- user_profiles, role_permissions
- admin_notification_recipients, notification_events
- system_settings, audit_logs

## Sanity Setup
A full Sanity Studio is included in `cms/studio/`.

**Quick start:**
1. Create a project at [sanity.io/manage](https://www.sanity.io/manage)
2. Copy `cms/studio/.env.example` to `cms/studio/.env` and add your `VITE_SANITY_PROJECT_ID` and `VITE_SANITY_DATASET`
3. Run `npm run studio` from the project root
4. Log in at http://localhost:3333

See `cms/SANITY_SETUP.md` for the full setup guide and troubleshooting.

The frontend fetches CMS pages through `/api/cms/page`.

## Environment Variables
Use `.env.example` as baseline.

Important ones:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_PUBLIC_API_BASE_URL` (optional fixed base URL for light/public `/api/*`)
- `VITE_DASHBOARD_API_BASE_URL` (Render base URL for dashboard/heavy routes)
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SANITY_PROJECT_ID`
- `SANITY_DATASET`
- `SANITY_API_TOKEN`
- `CMS_PROVIDER` (`sanity` or `external`)
- `EXTERNAL_CMS_BASE_URL` (required only when `CMS_PROVIDER=external`)
- `EXTERNAL_CMS_TOKEN` (optional bearer token for external CMS)
- `RESEND_API_KEY`
- `ALERT_FROM_EMAIL`
- `DEFAULT_ALERT_RECIPIENTS`
- `APP_BASE_URL`
- `CORS_ALLOWED_ORIGINS` (comma-separated list for Render API, leave empty for open CORS)

## Cron Retry
Scheduled jobs are **not** configured in `vercel.json` (so **Vercel Hobby** can deploy). Run them against your **Render** base URL (or whichever host serves `/api/cron/*`):

- `GET /api/cron/retry-notifications` — e.g. every 15 minutes
- `GET /api/cron/daily-ops-summary` — e.g. hourly

In Render: **New** → **Cron Job** → HTTP GET to  
`https://<your-render-service>.onrender.com/api/cron/retry-notifications` (and the daily-ops URL similarly).

Set `CRON_SECRET` in Render and add header `x-cron-secret: <same value>` on the cron request if your handlers enforce it.

## Local Run
```bash
npm install
npm run build
npm run dev
```

## Cloudflare Tunnel
To expose the local app over a temporary Cloudflare Tunnel:

```bash
npm run dev
```

In a second terminal:

```bash
npm run tunnel
```

`cloudflared` will print a public `https://<random-subdomain>.trycloudflare.com` URL.

If you need emails, booking links, or dashboard links to use that public address, set:

```bash
APP_BASE_URL=https://<random-subdomain>.trycloudflare.com
```

Restart `npm run dev` after changing `APP_BASE_URL`.

To expose the Sanity Studio instead, run:

```bash
npm run tunnel:studio
```

## Notes
- Form submissions from Contact, Booking, Fleet, and Auto Repair now go through `/api/enquiries`.
- Enquiry emails are non-blocking: submission succeeds even if email fails.
- Failed notifications are retried by cron and tracked in `notification_events`.
- In dual-host mode, dashboard/heavy API calls are routed using `VITE_DASHBOARD_API_BASE_URL` from the frontend.
- Public-facing content is CMS-driven:
  - Header/footer navigation and booking CTA (`navigationConfig`)
  - Top bar/footer/site contact info + service notice (`siteSettings`)
  - Home hero, features, service showcase cards, testimonial, gallery, CTA (`homePage`)
  - Services page cards + details (`servicesPage`)
  - Pricing page copy + highlighted service (`pricingPage`)
  - Fleet/FAQ/Contact page content
  - About page content (`aboutPage`)
  - Gallery before/after items (`galleryPage`)
  - Auto repair waitlist page copy (`autoRepairPage`)
  - Gift cards page copy and amount presets (`giftCardsPage`)

## Seed CMS Content
To bootstrap editable Sanity documents in your dataset:
```bash
npm run cms:seed
```

## Dual-host smoke tests and rollback
Smoke tests after deployment:
- Open website pages on Vercel and confirm normal content load.
- Open dashboard/admin views and confirm data loads from Render without CORS errors.
- Verify lead/service job create and update flows.
- Verify notification and cron endpoints execute successfully on the chosen host.

Rollback approach:
- Remove or empty `VITE_DASHBOARD_API_BASE_URL` to route all API calls back to same-origin.
- Redeploy Vercel only (no backend code rollback required for quick recovery).
