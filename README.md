<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1lkdpAoJ23UfuZ4f9RK-g5B8SCuaKKiUT

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set server-side environment variables for Netlify Functions:
   - `GEMINI_API_KEY`
   - `NETLIFY_DATABASE_URL` (or `NETLIFY_DATABASE_URL_UNPOOLED`)
   - `FAMLY_EMAIL`, `FAMLY_PASSWORD`, `FAMLY_CHILD_ID` (for the Famly import cron)
   - `FAMLY_TZ` (optional, default: `Europe/London`)
   - `FAMLY_MILK_UNIT` (optional, `oz` or `ml`, default: `oz`)
   - `FAMLY_INSTALLATION_ID`, `FAMLY_PLATFORM`, `FAMLY_VERSION` (optional override headers)
3. Run the app locally with Netlify Functions:
   `npx netlify dev`

## Famly import cron

Netlify runs `netlify/functions/famly-cron.js` on a weekday schedule (`0 18 * * 1-5`, 18:00 UTC) to pull BM + milk events from Famly
and insert new rows into `activity_logs`. You can manually invoke it locally with:

`/.netlify/functions/famly-cron?date=YYYY-MM-DD`

`date` also accepts ISO datetimes (for example `2026-02-11T09:30:00Z`), which are normalized to the configured `FAMLY_TZ` day.
