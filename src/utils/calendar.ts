import ICAL from 'ical.js';
import { CalendarEvent, CalendarPreviewResult, CalendarSummary, LoadMode, LoadResult } from '../types';

export function normalizeCalendarUrl(input: string): string {
  const trimmed = input.trim();

  if (!trimmed) {
    throw new Error('Paste a public iCloud calendar URL first.');
  }

  if (trimmed.startsWith('webcal://')) {
    return `https://${trimmed.slice('webcal://'.length)}`;
  }

  if (trimmed.startsWith('https://') || trimmed.startsWith('http://')) {
    return trimmed;
  }

  throw new Error('URL must start with webcal://, https://, or http://');
}

async function fetchCalendarDirect(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      Accept: 'text/calendar, text/plain;q=0.9, */*;q=0.8'
    }
  });

  if (!response.ok) {
    throw new Error(`Calendar request failed with ${response.status} ${response.statusText}.`);
  }

  return response.text();
}

async function fetchCalendarViaProxy(url: string): Promise<string> {
  const response = await fetch('/api/calendar', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ url })
  });

  if (!response.ok) {
    let message =
      response.status === 404
        ? 'Calendar endpoint not found at /api/calendar. Deploy the complete project to Vercel, or run npm run dev locally.'
        : `Proxy request failed with ${response.status}.`;

    try {
      const data = (await response.json()) as { error?: string };
      if (data.error) {
        message = data.error;
      }
    } catch {
      // Keep the fallback message if the response is not JSON.
    }

    throw new Error(message);
  }

  return response.text();
}

async function fetchCalendarSource(url: string): Promise<{ sourceText: string; mode: LoadMode }> {
  try {
    const sourceText = await fetchCalendarDirect(url);
    return { sourceText, mode: 'direct' };
  } catch (error) {
    try {
      const sourceText = await fetchCalendarViaProxy(url);
      return { sourceText, mode: 'proxy' };
    } catch (proxyError) {
      const directMessage = error instanceof Error ? error.message : 'Unknown direct fetch error.';
      const proxyMessage = proxyError instanceof Error ? proxyError.message : 'Unknown proxy fetch error.';

      if (proxyMessage === directMessage) {
        throw proxyError;
      }

      throw new Error(`${directMessage} Proxy retry also failed: ${proxyMessage}`);
    }
  }
}

function toIsoString(value: ICAL.Time | null | undefined): string | null {
  if (!value) {
    return null;
  }

  return value.toJSDate().toISOString();
}

function getDurationMinutes(start: ICAL.Time | null | undefined, end: ICAL.Time | null | undefined): number | null {
  if (!start || !end) {
    return null;
  }

  const durationMs = end.toJSDate().getTime() - start.toJSDate().getTime();
  return durationMs >= 0 ? Math.round(durationMs / 60000) : null;
}

function getCalendarName(root: ICAL.Component): string {
  const preferredName =
    root.getFirstPropertyValue('x-wr-calname') ||
    root.getFirstPropertyValue('name') ||
    root.getFirstPropertyValue('calscale');

  if (typeof preferredName === 'string' && preferredName.trim()) {
    return preferredName.trim();
  }

  return 'Unnamed Calendar';
}

function parseCalendarSource(sourceText: string): { root: ICAL.Component; calendarName: string } {
  let jcalData: unknown;

  try {
    jcalData = ICAL.parse(sourceText);
  } catch {
    throw new Error('Calendar data could not be parsed as valid ICS/iCalendar text.');
  }

  const root = new ICAL.Component(jcalData as ReturnType<typeof ICAL.parse>);
  const calendarName = getCalendarName(root);

  return { root, calendarName };
}

export async function loadCalendarPreview(url: string): Promise<CalendarPreviewResult> {
  const normalizedUrl = normalizeCalendarUrl(url);
  const { sourceText, mode } = await fetchCalendarSource(normalizedUrl);
  const { calendarName } = parseCalendarSource(sourceText);

  return { calendarName, normalizedUrl, mode };
}

export async function loadCalendar(url: string): Promise<LoadResult> {
  const normalizedUrl = normalizeCalendarUrl(url);
  const { sourceText, mode } = await fetchCalendarSource(normalizedUrl);
  const parsedCalendar = parseCalendarEvents(sourceText, normalizedUrl);

  return { ...parsedCalendar, sourceText, sourceUrl: normalizedUrl, normalizedUrl, mode };
}

export function parseCalendarEvents(sourceText: string, sourceUrl: string): Omit<LoadResult, 'sourceText' | 'mode' | 'sourceUrl' | 'normalizedUrl'> {
  const { root, calendarName } = parseCalendarSource(sourceText);
  const vevents = root.getAllSubcomponents('vevent');

  const events = vevents
    .map((component) => {
      const event = new ICAL.Event(component);
      const start = event.startDate ?? null;
      const end = event.endDate ?? null;

      return {
        calendarName,
        sourceUrl,
        uid: event.uid || 'missing-uid',
        title: event.summary || '(Untitled event)',
        description: event.description || '',
        location: event.location || '',
        start: toIsoString(start),
        end: toIsoString(end),
        durationMinutes: getDurationMinutes(start, end),
        isAllDay: Boolean(start?.isDate)
      };
    })
    .sort((left, right) => {
      if (!left.start && !right.start) {
        return 0;
      }

      if (!left.start) {
        return 1;
      }

      if (!right.start) {
        return -1;
      }

      return right.start.localeCompare(left.start);
    });

  return { calendarName, events };
}

export function summarizeEvents(events: CalendarEvent[]): CalendarSummary {
  const datedStarts = events.map((event) => event.start).filter((value): value is string => Boolean(value));
  const datedEnds = events.map((event) => event.end).filter((value): value is string => Boolean(value));
  const uniqueCalendars = new Set(events.map((event) => `${event.calendarName}|${event.sourceUrl}`));

  return {
    totalCalendars: uniqueCalendars.size,
    totalEvents: events.length,
    totalTrackedMinutes: events.reduce((total, event) => total + (event.durationMinutes ?? 0), 0),
    earliestStart: datedStarts.length ? [...datedStarts].sort()[0] : null,
    latestEnd: datedEnds.length ? [...datedEnds].sort().at(-1) ?? null : null
  };
}

export function describeLoadMode(mode: LoadMode): string {
  return mode === 'direct'
    ? 'Loaded directly from the public URL in the browser.'
    : 'Loaded through the calendar server after the browser request failed.';
}
