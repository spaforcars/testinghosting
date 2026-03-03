# Spa for Cars Platform (CMS + Dashboards + Alerts)

This project now includes:
- Website content integration hooks for a headless CMS (Sanity by default).
- Operations dashboard (`/#/dashboard`) for lead/service tracking.
- Admin dashboard (`/#/admin`) for notification controls and audit visibility.
- Enquiry pipeline APIs with alert emails via Resend.
- Supabase-first data/auth/RBAC architecture.

## Architecture
- Frontend: React + Vite
- API: Vercel serverless routes (`/api/*`)
- Data/Auth: Supabase
- CMS: Sanity (with adapter for future external CMS swap)
- Email alerts: Resend

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

## Cron Retry
`vercel.json` includes:
- `/api/cron/retry-notifications` every 5 minutes.

Set `CRON_SECRET` and send `x-cron-secret` header from your scheduler if you want extra protection.

## Local Run
```bash
npm install
npm run build
npm run dev
```

## Notes
- Form submissions from Contact, Booking, Fleet, and Auto Repair now go through `/api/enquiries`.
- Enquiry emails are non-blocking: submission succeeds even if email fails.
- Failed notifications are retried by cron and tracked in `notification_events`.
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
