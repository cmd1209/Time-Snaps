export type LoadMode = 'direct' | 'proxy';

export type StatusTone = 'idle' | 'loading' | 'success' | 'error';

export interface CalendarInputRow {
  id: string;
  color: string | null;
  url: string;
  normalizedUrl: string | null;
  calendarName: string | null;
  previewMode: LoadMode | null;
  previewError: string | null;
  isResolving: boolean;
}

export interface CalendarEvent {
  calendarName: string;
  sourceUrl: string;
  uid: string;
  title: string;
  description: string;
  location: string;
  start: string | null;
  end: string | null;
  durationMinutes: number | null;
  isAllDay: boolean;
}

export interface CalendarSummary {
  totalCalendars: number;
  totalEvents: number;
  totalTrackedMinutes: number;
  earliestStart: string | null;
  latestEnd: string | null;
}

export interface CalendarLoadItem {
  sourceUrl: string;
  normalizedUrl: string;
  calendarName: string | null;
  events: CalendarEvent[];
  mode: LoadMode | null;
  error: string | null;
}

export interface LoadResult {
  calendarName: string;
  sourceUrl: string;
  normalizedUrl: string;
  events: CalendarEvent[];
  sourceText: string;
  mode: LoadMode;
}

export interface CalendarPreviewResult {
  calendarName: string;
  normalizedUrl: string;
  mode: LoadMode;
}

export interface SavedCalendar {
  id: string;
  color: string | null;
  name: string;
  calendar_url: string;
}
