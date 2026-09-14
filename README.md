# Time Snaps

Small React + TypeScript + Vite app for fetching, parsing, and displaying public Apple/iCloud calendar feeds with `ical.js`.

## Run locally

```bash
npm install
npm run dev
```

Paste a public iCloud calendar sharing URL (`webcal://...` or `https://...`), let the app detect its name, then select **Load Calendars**. Add more fields for multiple feeds.

The browser first tries the feed directly. If that fails (for example because of CORS), it posts the URL to `/api/calendar`. Locally, the existing Vite development proxy handles this request. On Vercel, `api/calendar.js` handles it as a Node function.

## Deploy on Vercel

Deploy the repository root, including the `api` directory, through the existing GitHub-connected Vercel project:

- Framework preset: Vite
- Build command: `npm run build`
- Output directory: `dist`
- No environment variables or additional dependencies are required.

Push the changes to the branch connected to Vercel to trigger its deployment. Uploading only `dist` will not deploy the calendar function. `npm run preview` also does not run Vercel functions.

The public endpoint accepts only HTTPS public feeds under `/published/` on iCloud calendar hosts (`calendars.icloud.com`, `caldav.icloud.com`, and their `pXX-` variants). It validates redirect destinations, allows up to three redirects, times out after ten seconds, limits feeds to 3 MB, and returns `Cache-Control: no-store`. It does not require or store Apple passwords.

## Verify

```bash
node --test tests/calendar.test.js
npm run build
```

After deployment, paste a public Apple calendar URL and load it. Verify the detected name, event list, and summary. When the direct fetch is blocked by CORS, the Network panel should show a successful POST to `/api/calendar`. An ordinary GET to that endpoint should return 405, not 404.

## Current limits

- Calendars must be publicly shared. Anyone with the feed URL can access the published data.
- Calendar URLs and events remain in browser memory and reset on refresh. Authentication and saved calendars through Supabase are a later step.
- Repeating event definitions are parsed but not expanded into individual occurrences.
- Apple can still return unavailable, revoked, or slow feeds; the app shows an error for each failed calendar.
