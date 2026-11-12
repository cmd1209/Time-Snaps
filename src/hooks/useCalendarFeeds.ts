import { useEffect, useMemo, useState } from 'react';
import type { CalendarEvent, SavedCalendar } from '../types';
import { loadCalendar } from '../utils/calendar';

interface FeedResult {
  events: CalendarEvent[];
  error: string | null;
}
interface FeedState {
  scope: string;
  results: Record<string, FeedResult>;
  refreshedAt: Date | null;
}

export function useCalendarFeeds(calendars: SavedCalendar[], refreshToken: number, active: boolean) {
  const scope = JSON.stringify([refreshToken, calendars.map(calendar => [calendar.id, calendar.calendar_url])]);
  const [state, setState] = useState<FeedState>({ scope: '', results: {}, refreshedAt: null });

  useEffect(() => {
    if (!active || (state.scope === scope && state.refreshedAt)) return;
    let cancelled = false;
    setState({ scope, results: {}, refreshedAt: null });
    void Promise.all(calendars.map(async calendar => {
      let result: FeedResult;
      try {
        const feed = await loadCalendar(calendar.calendar_url);
        result = { events: feed.events.map(event => ({ ...event, calendarId: calendar.id, calendarName: calendar.name })), error: null };
      } catch (error) {
        result = { events: [], error: error instanceof Error ? error.message : 'Unable to load calendar.' };
      }
      if (!cancelled) setState(current => ({ ...current, results: { ...current.results, [calendar.id]: result } }));
    })).then(() => {
      if (!cancelled) setState(current => ({ ...current, refreshedAt: new Date() }));
    });
    return () => { cancelled = true; };
    // Names and colors use live metadata; only feed URLs, membership, and Refresh reload data.
  }, [active, scope]);

  const current = state.scope === scope;
  const events = useMemo(() => current ? calendars.flatMap(calendar => state.results[calendar.id]?.events ?? []) : [], [current, calendars, state.results]);
  const errors = current ? calendars.flatMap(calendar => state.results[calendar.id]?.error ? [{ id: calendar.id, name: calendar.name, message: state.results[calendar.id].error! }] : []) : [];
  return {
    events,
    errors,
    loading: calendars.length > 0 && (!current || !state.refreshedAt),
    refreshedAt: current ? state.refreshedAt : null,
  };
}
