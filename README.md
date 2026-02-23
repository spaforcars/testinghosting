<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/92eac545-23fa-4ad8-af8f-3d0609825cc2

## Run Locally

**Prerequisites:**  Node.js

1. Install dependencies: `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app: `npm run dev`

## Deploy on Vercel

This app is configured for Vercel deployment. The Express API routes have been converted to serverless functions in the `api/` folder.

1. Import the project from [GitHub](https://github.com/RealBhupesh/Spa4CarMVP)
2. Add environment variables in Vercel Dashboard (Settings → Environment Variables):
   - `STRIPE_SECRET_KEY` – for payment processing
   - `EMAIL_USER` and `EMAIL_PASS` – for gift card emails (optional; works in mock mode without them)
3. Deploy – Vercel will auto-detect the Vite build and API routes
