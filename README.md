# Time Snaps

Small React + TypeScript + Vite app for fetching, parsing, and displaying public Apple/iCloud calendar feeds with `ical.js`.

## Run locally

```bash
npm install
npm run dev
```

Paste a public iCloud calendar sharing URL (`webcal://...` or `https://...`), let the app detect its name, save it, then select it from the saved-calendar dropdown. Add more fields for multiple feeds.

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

Use **Save Calendars** after additions, URL edits, or removals (including removing the final calendar). Saving validates public Apple URLs, upserts rows with stable IDs, then deletes removed IDs. These are two requests, not a transaction: if a request fails, the app reports an incomplete save and keeps edits available for retry. **Refresh** fetches fresh events for the selected calendar.

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

After login or refresh, the first saved calendar loads automatically. Use the **Saved calendars** dropdown to load another calendar's events, or **Refresh** to fetch updates. Switching calendars clears the previous results and ignores late responses from earlier selections. The dropdown uses saved metadata; editing the URL fields does not change it until **Save Calendars** succeeds. Calendar management is available under the collapsible **Calendar settings** section.

## Calendar viewer

The main view shows the selected calendar, a refresh indicator, and events grouped by day in chronological order. Calendar URLs, adding/removing calendars, and saving changes live in **Calendar settings**, which opens automatically for an account with no saved calendars. The account menu contains email and logout.

The date range defaults to **All dates**; use **This month** or set From/To dates to narrow it. Both endpoints are inclusive and match the event's start date in the viewer's local time zone. Events without a start date appear only with All dates. Event count and timed duration reflect the filtered list; all-day events are excluded from timed duration. Expand **Event details** for descriptions and locations. Raw feed URLs, JSON, and fetch diagnostics are no longer part of the event view.

Check date filtering and grouping with `node --test tests/event-view.test.js` (Node 22.18+).

## Editing styles with Tailwind

Tailwind CSS v4 is installed through `@tailwindcss/vite` in `vite.config.ts`. Run `npm run dev` and edit React `className` values to see changes locally. The existing CSS still works; this is an incremental styling setup.

Good starting points:

- `src/components/Card.tsx`: shared card heading, color, and header spacing.
- `src/components/EventListCard.tsx`: event duration badge.
- `src/styles.css`: the `@theme` block at the top defines the shared colors. Change `--color-accent` to change the main button color. Tokens also expose utilities such as `bg-accent`, `bg-accent-soft`, `text-muted`, and `border-line`.

For example, change `gap-3` to `gap-4` for more spacing, or `bg-accent-soft` to `bg-emerald-100` for a green duration badge. For responsive spacing, try `p-4 sm:p-6`. Use complete class names in source code so Tailwind can detect them.

Existing styles are in `@layer components`, allowing Tailwind utilities to override them. Tailwind's Preflight reset is intentionally omitted to preserve the app's current headings, form controls, and native details markers. When styling a new border with utilities, include `border-solid` as well as `border` and a color. No separate Tailwind configuration file or PostCSS dependency is needed.

The TypeScript build regenerates the existing `vite.config.js` from `vite.config.ts`; edit the TypeScript source. Test locally before pushing `main` yourself to trigger Vercel.
