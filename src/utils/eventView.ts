import type { CalendarEvent } from '../types';

export function localDateKey(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function filterEvents(events: CalendarEvent[], from: string, to: string): CalendarEvent[] {
  if (from && to && from > to) return [];
  return events.filter(event => {
    if (!from && !to) return true;
    const day = event.start ? localDateKey(event.start) : '';
    return day !== '' && (!from || day >= from) && (!to || day <= to);
  });
}

export function groupEventsByDay(events: CalendarEvent[]): [string, CalendarEvent[]][] {
  const groups = new Map<string, CalendarEvent[]>();
  for (const event of [...events].sort((a, b) => (b.start ?? 'z').localeCompare(a.start ?? 'z'))) {
    const key = event.start ? localDateKey(event.start) : '';
    groups.set(key, [...(groups.get(key) ?? []), event]);
  }
  return [...groups].sort(([a], [b]) => (b || 'z').localeCompare(a || 'z'));
}

export function timedMinutes(events: CalendarEvent[]): number {
  return events.reduce((sum, event) => sum + (event.isAllDay ? 0 : event.durationMinutes ?? 0), 0);
}
