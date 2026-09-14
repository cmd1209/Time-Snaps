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
- Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` before building. Redeploy after changing them.

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
- Calendar names and public URLs are saved per account when you click **Save Calendars**. Events are fetched on demand and remain in memory. Unsaved edits reset on refresh.
- Repeating event definitions are parsed but not expanded into individual occurrences.
- Apple can still return unavailable, revoked, or slow feeds; the app shows an error for each failed calendar.

## Supabase setup

1. Create a Supabase project and enable email/password authentication. Keep email confirmation enabled.
2. In Authentication → URL Configuration, set the Site URL to `https://time-snaps.vercel.app` and allow `https://time-snaps.vercel.app/` and `http://localhost:5173/` as redirect URLs.
3. Run `supabase/migrations/001_create_calendars.sql` once in the SQL Editor for a new project. It has already been applied to the initial project; do not rerun it there.
4. Copy `.env.example` to `.env.local` and enter the project URL and publishable key. Add those same variables in Vercel for Production (and Preview if used). Never use a secret/service-role key here.
5. Run `npm install` and `npm run dev`. Sign up, confirm your email, then log in.

The SDK persists the Supabase session in browser localStorage. Passwords are submitted only to Supabase Auth. Calendar metadata lives in `public.calendars`, protected by ownership RLS; there is no profile table. Public feed URLs are visible to their owner, and the underlying published feed remains public. The public calendar-fetch endpoint remains available without login and does not read the database.

Use **Save Calendars** after additions, URL edits, or removals (including removing the final calendar). Saving validates public Apple URLs, upserts rows with stable IDs, then deletes removed IDs. These are two requests, not a transaction: if a request fails, the app reports an incomplete save and keeps edits available for retry. **Load Calendars** fetches fresh events.

### Account verification

- Sign up and confirm email; check invalid-password feedback.
- Save a calendar, refresh, and verify that both session and saved URL return.
- Update a URL, save, refresh; remove the final calendar, save, refresh.
- Log out and check the viewer disappears; log in again and check saved data returns.
- Use two test accounts to verify ownership, including direct API reads, inserts, updates, and deletes. The integration test below exercises those checks using existing accounts; it never creates accounts or sends email.

```bash
# Set TEST_USER_A_EMAIL, TEST_USER_A_PASSWORD, TEST_USER_B_EMAIL,
# and TEST_USER_B_PASSWORD privately in your shell, then run:
node --env-file=.env.local --test tests/supabase.integration.test.js
```

The integration test creates temporary calendar rows and deletes them afterward. Without the four test-account variables it is skipped.

## Viewing saved calendars

After login or refresh, the first saved calendar loads automatically. Use the **Saved calendars** dropdown to load another calendar's events, or **Refresh selected calendar** to fetch updates. Switching calendars clears the previous results and ignores late responses from earlier selections. The dropdown uses saved metadata; editing the URL fields does not change it until **Save Calendars** succeeds. The existing **Load Calendars** button still loads all filled URL fields together.
