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
2. Set `VITE_SHEET_ID` in [.env.local](.env.local)
3. Set server-side environment variables for Netlify Functions:
   - `GEMINI_API_KEY`
   - `SERVICE_ACCOUNT_EMAIL`
   - `SERVICE_ACCOUNT_PRIVATE_KEY`
4. Run the app locally with Netlify Functions:
   `npx netlify dev`

## Troubleshooting

* **"The caller does not have permission"**: share the Google Sheet with the service account email from `SERVICE_ACCOUNT_EMAIL`.
* **"Failed to parse activity"**: ensure `GEMINI_API_KEY` is set in Netlify environment variables and the deploy has completed.
