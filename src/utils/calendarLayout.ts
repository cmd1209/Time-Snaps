import type { CalendarEvent } from '../types';

export type CalendarMode = 'month' | 'week' | 'day';

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

export function calendarDays(date: Date, mode: CalendarMode): Date[] {
  if (mode === 'day') return [startOfDay(date)];
  const first = mode === 'month' ? new Date(date.getFullYear(), date.getMonth(), 1) : startOfDay(date);
  const monday = addDays(first, -((first.getDay() + 6) % 7));
  const count = mode === 'week' ? 7 : Math.ceil((((first.getDay() + 6) % 7) + new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()) / 7) * 7;
  return Array.from({ length: count }, (_, index) => addDays(monday, index));
}

export function moveCalendarDate(date: Date, mode: CalendarMode, direction: number): Date {
  return mode === 'month' ? new Date(date.getFullYear(), date.getMonth() + direction, 1) : addDays(date, direction * (mode === 'week' ? 7 : 1));
}

export function eventStart(event: CalendarEvent): Date | null {
  if (!event.start) return null;
  const date = new Date(event.start);
  return Number.isNaN(date.getTime()) ? null : date;
}

function eventEnd(event: CalendarEvent, start: Date): Date {
  const end = event.end ? new Date(event.end) : null;
  if (end && end > start) return end;
  if (event.isAllDay) return addDays(start, 1);
  return new Date(start.getTime() + Math.max(0, event.durationMinutes ?? 0) * 60_000);
}

export function eventsOnDay(events: CalendarEvent[], day: Date): CalendarEvent[] {
  const from = startOfDay(day).getTime();
  const to = addDays(day, 1).getTime();
  return events.filter(event => {
    const start = eventStart(event);
    if (!start) return false;
    const end = eventEnd(event, start).getTime();
    return start.getTime() < to && (end > from || (start.getTime() >= from && end === start.getTime()));
  }).sort((a, b) => Number(b.isAllDay) - Number(a.isAllDay) || eventStart(a)!.getTime() - eventStart(b)!.getTime());
}

export interface EventPlacement {
  event: CalendarEvent;
  start: number;
  end: number;
  column: number;
  columns: number;
}

// Clip overnight entries to each local day, then assign lanes to overlapping groups.
export function layoutDayEvents(events: CalendarEvent[], day: Date): EventPlacement[] {
  const dayStart = startOfDay(day);
  const dayEnd = addDays(day, 1);
  const placements = eventsOnDay(events, day).filter(event => !event.isAllDay).map(event => {
    const startDate = eventStart(event)!;
    const endDate = eventEnd(event, startDate);
    const start = startDate < dayStart ? 0 : startDate.getHours() * 60 + startDate.getMinutes();
    const end = endDate >= dayEnd ? 1440 : endDate.getHours() * 60 + endDate.getMinutes();
    return { event, start, end: Math.min(1440, Math.max(start + 20, end)), column: 0, columns: 1 };
  }).sort((a, b) => a.start - b.start || b.end - a.end);

  let group: EventPlacement[] = [];
  let laneEnds: number[] = [];
  let groupEnd = -1;
  const finishGroup = () => { group.forEach(item => { item.columns = laneEnds.length; }); };
  for (const placement of placements) {
    if (placement.start >= groupEnd) {
      finishGroup();
      group = [];
      laneEnds = [];
    }
    const freeLane = laneEnds.findIndex(end => end <= placement.start);
    placement.column = freeLane === -1 ? laneEnds.length : freeLane;
    laneEnds[placement.column] = placement.end;
    group.push(placement);
    groupEnd = Math.max(...laneEnds);
  }
  finishGroup();
  return placements;
}
