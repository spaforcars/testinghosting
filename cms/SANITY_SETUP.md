# Sanity CMS Setup Guide

This project is configured so website content is fully editable from Sanity.

## 1) Create or use your Sanity project

Use the project you own in [https://www.sanity.io/manage](https://www.sanity.io/manage).
Copy:
- `Project ID`
- `Dataset` (usually `production`)

## 2) Configure Studio env

Create `cms/studio/.env`:

```env
VITE_SANITY_PROJECT_ID=your_project_id
VITE_SANITY_DATASET=production
```

## 3) Configure website env (root `.env`)

```env
CMS_PROVIDER=sanity
VITE_SANITY_PROJECT_ID=your_project_id
VITE_SANITY_DATASET=production
SANITY_PROJECT_ID=your_project_id
SANITY_DATASET=production
SANITY_API_TOKEN=your_editor_or_admin_token
```

Important:
- Use an **Editor/Admin** token if you want to run seed/write operations.
- A Viewer token can read content but cannot create/update docs.

## 4) Start Studio

From project root:

```bash
npm run studio
```

Studio runs at `http://localhost:3333`.

## 5) Seed all CMS docs (recommended)

From project root:

```bash
npm run cms:seed
```

This creates/updates singleton documents used by the site:
- Site Settings
- Navigation Config
- Home Page
- Services Page
- Pricing Page
- Fleet Page
- Gallery Page
- About Page
- FAQ Page
- Contact Page
- Auto Repair Page
- Gift Cards Page

## 6) Run website

```bash
npm run dev
```

Website: `http://localhost:3000`

## What is now CMS-controlled

- Header/footer links and booking CTA
- Business info, contact, service notice
- Home page sections and images
- Services list (add/remove/edit services, prices, durations, features, images)
- Pricing page copy and highlighted service
- Fleet page content
- FAQ entries
- Contact page copy/map
- About page content and image
- Gallery before/after items
- Auto Repair page content
- Gift Cards page copy, benefits, and preset amounts
- Promo placements by slot/schedule

## Common issues

### `Not authorized / request pending approval`
Your logged-in account is not approved for that Sanity project. Approve/invite it in Manage -> Members.

### `Missing Sanity project ID`
`cms/studio/.env` is missing or wrong. Set `VITE_SANITY_PROJECT_ID` and restart Studio.

### Website shows fallback/blank content
- Check root `.env` values for `SANITY_PROJECT_ID`, `SANITY_DATASET`, `SANITY_API_TOKEN`
- Restart `npm run dev`
- Run `npm run cms:seed`

### CORS errors
In Sanity Manage -> API -> CORS origins, add:
- `http://localhost:3000`
- `http://localhost:3333`
