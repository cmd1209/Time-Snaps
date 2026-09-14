# Time Snaps

Small local-first proof of concept for testing whether one or more public iCloud calendar URLs can be fetched, parsed, and displayed for later time tracking and billing work.

## Stack

- Vite
- React
- TypeScript
- `ical.js` for ICS parsing

## Run locally

```bash
npm install
npm run dev
```

Then open the local Vite URL shown in the terminal.

## What it does

1. Accepts one or more pasted public calendar URLs such as `webcal://...`
2. Normalizes `webcal://` to `https://`
3. Tries to fetch each ICS feed directly in the browser
4. Falls back to a local Vite dev proxy if the browser request likely fails because of CORS
5. Parses the calendar name and `VEVENT` entries from each ICS feed
6. Displays:
   - connection/status feedback
   - per-calendar load results
   - raw event list
   - calendar name for each event
   - total events
   - total calendars
   - total tracked duration
   - earliest and latest event dates
   - a sample parsed event preview

## Important limitation

Public iCloud calendar feeds may still be blocked or behave inconsistently depending on:

- browser CORS enforcement
- Apple response headers
- whether the shared calendar URL is actually public and valid
- network restrictions on the local machine

The local Vite proxy only works while running this app locally in development. It is not a production backend.
