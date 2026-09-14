const MAX_FEED_BYTES = 3 * 1024 * 1024;

function calendarUrl(value) {
  if (typeof value !== 'string' || value.length > 4096) throw new Error('Invalid URL.');
  const url = new URL(value.trim().replace(/^webcal:\/\//, 'https://'));
  if (
    url.protocol !== 'https:' || url.username || url.password || url.port ||
    !/^(?:p\d+-)?(?:calendars|caldav)\.icloud\.com$/.test(url.hostname) ||
    !url.pathname.startsWith('/published/') || url.search || url.hash
  ) throw new Error('Unsupported URL.');
  return url;
}

// Vercel runs this Node handler at /api/calendar. No credentials are required.
export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  function fail(status, message) {
    response.statusCode = status;
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify({ error: message }));
  }

  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return fail(405, 'Method not allowed.');
  }

  let target;
  try {
    const body = typeof request.body === 'string' ? JSON.parse(request.body) : request.body;
    target = calendarUrl(body?.url);
  } catch {
    return fail(400, 'Use a public iCloud calendar URL starting with webcal:// or https:// on an iCloud calendars or caldav host.');
  }

  const signal = AbortSignal.timeout(10_000);
  try {
    let upstream;
    // Validate each redirect before fetching it; never follow arbitrary destinations.
    for (let redirects = 0; redirects <= 3; redirects += 1) {
      upstream = await fetch(target, {
        headers: { Accept: 'text/calendar, text/plain;q=0.9' },
        redirect: 'manual', signal
      });
      if (![301, 302, 303, 307, 308].includes(upstream.status)) break;
      await upstream.body?.cancel();
      const location = upstream.headers.get('location');
      if (!location || redirects === 3) return fail(502, 'Calendar redirect could not be followed.');
      try {
        target = calendarUrl(new URL(location, target).href);
      } catch {
        return fail(502, 'Calendar redirected outside supported public iCloud feeds.');
      }
    }

    if (!upstream.ok) {
      await upstream.body?.cancel();
      return fail(502, `iCloud returned ${upstream.status}. Check that the calendar is publicly shared and its URL is current.`);
    }
    if (Number(upstream.headers.get('content-length')) > MAX_FEED_BYTES) {
      await upstream.body?.cancel();
      return fail(413, 'Calendar feed exceeds the 3 MB limit.');
    }

    const chunks = [];
    let bytes = 0;
    if (upstream.body) {
      const reader = upstream.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > MAX_FEED_BYTES) {
          await reader.cancel();
          return fail(413, 'Calendar feed exceeds the 3 MB limit.');
        }
        chunks.push(Buffer.from(value));
      }
    }
    const text = Buffer.concat(chunks).toString('utf8');
    if (!text.trimStart().startsWith('BEGIN:VCALENDAR')) {
      return fail(502, 'iCloud did not return an ICS calendar. Check the public sharing URL.');
    }
    response.statusCode = 200;
    response.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    response.end(text);
  } catch {
    return fail(signal.aborted ? 504 : 502, signal.aborted
      ? 'iCloud took too long to respond. Please try again.'
      : 'Unable to fetch the public iCloud calendar. Please try again.');
  }
}
