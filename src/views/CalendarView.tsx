import type { CSSProperties } from 'react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import type { CalendarEvent, SavedCalendar } from '../types';
import { calendarDays, eventStart, eventsOnDay, layoutDayEvents, moveCalendarDate } from '../utils/calendarLayout';
import type { CalendarMode } from '../utils/calendarLayout';
import { localDateKey } from '../utils/eventView';
import { formatDateTime, formatMinutes } from '../utils/format';
import { calendarColor, calendarTextColor } from '../utils/calendarColor';
import { useCalendarFeeds } from '../hooks/useCalendarFeeds';

interface Props {
  active: boolean;
  calendars: SavedCalendar[];
  refreshToken: number;
  restoring: boolean;
  restoreError: string | null;
  onLoadingChange: (loading: boolean) => void;
  onSettings: () => void;
}

const HOUR_HEIGHT = 56;
const time = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' });
const fullDay = new Intl.DateTimeFormat(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const eventTime = (event: CalendarEvent) => event.isAllDay ? 'All day' : eventStart(event) ? time.format(eventStart(event)!) : 'Date unavailable';
const eventKey = (event: CalendarEvent, index: number) => `${event.calendarId}-${event.uid}-${event.start}-${index}`;

export function CalendarView({ active, calendars, refreshToken, restoring, restoreError, onLoadingChange, onSettings }: Props) {
  const { events, errors, loading: feedsLoading, refreshedAt } = useCalendarFeeds(calendars, refreshToken, active && !restoring && !restoreError);
  const loading = restoring || feedsLoading;
  const refreshStatus = restoring ? 'Loading saved calendars...' : loading ? 'Fetching events from all calendars...' : refreshedAt ? `Last refreshed at ${refreshedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : null;
  const calendarForEvent = (event: CalendarEvent) => calendars.find(calendar => calendar.id === event.calendarId);
  const eventStyle = (event: CalendarEvent): CSSProperties => {
    const calendar = calendarForEvent(event);
    return { background: calendarColor(calendar?.color, calendars.findIndex(item => item.id === event.calendarId)), color: calendarTextColor(calendar?.color) };
  };
  const [mode, setMode] = useState<CalendarMode>('week');
  const [date, setDate] = useState(() => new Date());
  const [today, setToday] = useState(() => new Date());
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const timeline = useRef<HTMLDivElement>(null);
  const dialogId = useId();
  const days = useMemo(() => calendarDays(date, mode), [date, mode]);
  const dailyEvents = useMemo(() => days.map(day => eventsOnDay(events, day)), [days, events]);
  const undated = useMemo(() => events.filter(event => !eventStart(event)), [events]);
  const visibleEvents = useMemo(() => [...new Set(dailyEvents.flat())], [dailyEvents]);
  const todayKey = localDateKey(today);
  const dateKey = localDateKey(date);
  const monthName = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' });
  const periodLabel = mode === 'month' ? monthName.format(date) : mode === 'day' ? fullDay.format(date) : `${new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(days[0])} – ${new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(days[6])}`;

  useEffect(() => {
    const timer = window.setInterval(() => setToday(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (active && timeline.current) timeline.current.scrollTop = 7 * HOUR_HEIGHT;
  }, [active, mode, dateKey]);

  // Closing when the data changes prevents details from an earlier calendar remaining open.
  useEffect(() => { dialog.current?.close(); }, [events]);

  useEffect(() => { onLoadingChange(loading); }, [loading, onLoadingChange]);

  function openEvent(event: CalendarEvent) {
    setSelectedEvent(event);
    dialog.current?.showModal();
  }

  function eventButton(event: CalendarEvent, index: number, compact: boolean) {
    return <button type="button" key={eventKey(event, index)} className={`calendar-event ${compact ? 'calendar-event--compact' : ''}`} style={eventStyle(event)}
      onClick={() => openEvent(event)} title={`${event.title} · ${calendarForEvent(event)?.name ?? event.calendarName} · ${eventTime(event)}`} aria-label={`${event.title}, ${calendarForEvent(event)?.name ?? event.calendarName}, ${eventTime(event)}, ${event.start ? formatDateTime(event.start) : 'date unavailable'}`}>
      {!compact && <span className="calendar-event__time">{eventTime(event)}</span>}
      <span className="calendar-event__title">{event.title}</span>
    </button>;
  }

  return <section aria-labelledby="calendar-heading" className="min-w-0">
    <h1 id="calendar-heading" className="text-xxl font-medium">Calendar</h1>
    <div role="status" className="mb-6 mt-1 text-xs text-muted">{refreshStatus}</div>
    {restoreError ? <p role="alert" className="text-error">{restoreError} Open Settings to retry loading saved calendars.</p> : !calendars.length ? <div className="card p-6"><p>Save a calendar in Settings to see your tracked time.</p><button type="button" onClick={onSettings}>Open Settings</button></div> : <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2" aria-label="All calendars">
          {calendars.map((calendar, index) => <span key={calendar.id} className="flex min-w-0 items-center gap-2 text-xs text-muted">
            <span className="size-2.5 shrink-0 rounded-full" style={{ background: calendarColor(calendar.color, index) }} aria-hidden="true" />
            {calendar.name}
          </span>)}
        </div>
        <div className="calendar-mode flex gap-1 rounded-xl p-1" role="group" aria-label="Calendar view">
          {(['month', 'week', 'day'] as const).map(value => <button type="button" key={value} aria-pressed={mode === value} onClick={() => setMode(value)} className="px-4 py-2 text-sm">{value === 'month' ? 'Month' : value === 'week' ? 'Week' : 'Day'}</button>)}
        </div>
      </div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="m-0 text-lg font-semibold" aria-live="polite">{periodLabel}</h2>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="secondary-button" onClick={() => setDate(new Date())}>Today</button>
          <button type="button" className="ghost-button flex min-h-11 min-w-11 items-center justify-center" aria-label={`Previous ${mode}`} onClick={() => setDate(current => moveCalendarDate(current, mode, -1))}><ChevronLeft size={20} aria-hidden="true" /></button>
          <button type="button" className="ghost-button flex min-h-11 min-w-11 items-center justify-center" aria-label={`Next ${mode}`} onClick={() => setDate(current => moveCalendarDate(current, mode, 1))}><ChevronRight size={20} aria-hidden="true" /></button>
          <label className="sr-only" htmlFor={`${dialogId}-date`}>Go to date</label>
          <input id={`${dialogId}-date`} type="date" className="calendar-date-input" value={dateKey} onChange={event => {
            if (event.target.value) setDate(new Date(`${event.target.value}T12:00:00`));
          }} />
        </div>
      </div>
      {errors.map(error => <p key={error.id} role="alert" className="text-sm text-error">{error.name}: {error.message} Use Refresh to retry.</p>)}
      {loading ? <p role="status" className="text-sm text-muted">Loading calendar events...</p> : <p className="mb-3 text-xs text-muted" role="status">{visibleEvents.length} {visibleEvents.length === 1 ? 'event' : 'events'} in this view{errors.length ? ' · Some calendars could not be loaded.' : visibleEvents.length === 0 ? '. Use the date controls to explore another period.' : ''}</p>}
      <div className="calendar-board overflow-hidden rounded-2xl border border-solid border-line" aria-busy={loading}>
        <div className="overflow-x-auto" tabIndex={0} role="region" aria-label={`${mode === 'month' ? 'Month' : mode === 'week' ? 'Week' : 'Day'} calendar. Events open details.`}>
          {mode === 'month' ? <div className="min-w-[630px]">
            <div className="grid grid-cols-7 border-0 border-b border-solid border-line">
              {days.slice(0, 7).map(day => <div key={localDateKey(day)} className="px-3 py-3 text-xs font-medium text-muted">{new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(day)}</div>)}
            </div>
            <div className="grid grid-cols-7">
              {days.map((day, index) => <section key={localDateKey(day)} aria-label={fullDay.format(day)} className={`calendar-month-cell min-w-0 p-2 ${day.getMonth() !== date.getMonth() ? 'calendar-month-cell--outside' : ''}`}>
                <button type="button" aria-label={`Show ${fullDay.format(day)}`} aria-current={localDateKey(day) === todayKey ? 'date' : undefined} className="calendar-day-number mb-2 flex size-8 items-center justify-center p-0 text-sm" onClick={() => { setDate(day); setMode('day'); }}>{day.getDate()}</button>
                <div className="grid gap-1">{dailyEvents[index].map((event, eventIndex) => eventButton(event, eventIndex, false))}</div>
              </section>)}
            </div>
          </div> : <div className={mode === 'week' ? 'min-w-[740px]' : 'min-w-[280px]'} style={{ '--calendar-columns': days.length, '--calendar-hour-height': `${HOUR_HEIGHT}px` } as CSSProperties}>
            <div className="calendar-time-grid border-0 border-b border-solid border-line">
              <div aria-hidden="true" />
              {days.map(day => <button type="button" key={localDateKey(day)} className="calendar-day-heading flex flex-col items-center gap-1 p-3" onClick={() => { setDate(day); setMode('day'); }} aria-label={`Show ${fullDay.format(day)}`} aria-current={localDateKey(day) === todayKey ? 'date' : undefined}>
                <span className="text-xs">{new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(day)}</span><span className="text-xl font-semibold">{day.getDate()}</span>
              </button>)}
            </div>
            <div className="calendar-time-grid border-0 border-b border-solid border-line">
              <div className="px-1 py-3 text-center text-[10px] text-muted">All day</div>
              {days.map((day, index) => <div key={localDateKey(day)} className="calendar-all-day min-w-0 p-1.5">{dailyEvents[index].filter(event => event.isAllDay).map((event, eventIndex) => eventButton(event, eventIndex, true))}</div>)}
            </div>
            <div ref={timeline} className="calendar-timeline max-h-[640px] overflow-y-auto" tabIndex={0} role="region" aria-label="Hourly timeline">
              <div className="calendar-time-grid">
                <div className="relative" style={{ height: 24 * HOUR_HEIGHT }} aria-hidden="true">{Array.from({ length: 24 }, (_, hour) => <span key={hour} className="absolute right-2 text-[10px] text-muted" style={{ top: hour * HOUR_HEIGHT + 2 }}>{`${String(hour).padStart(2, '0')}:00`}</span>)}</div>
                {days.map(day => <div key={localDateKey(day)} className="calendar-time-column relative min-w-0" style={{ height: 24 * HOUR_HEIGHT }} aria-label={fullDay.format(day)}>
                  {layoutDayEvents(events, day).map((placement, index) => <button type="button" key={eventKey(placement.event, index)} className="calendar-event calendar-event--timed absolute" style={{ ...eventStyle(placement.event), top: placement.start / 60 * HOUR_HEIGHT, height: (placement.end - placement.start) / 60 * HOUR_HEIGHT, left: `calc(${placement.column / placement.columns * 100}% + 2px)`, width: `calc(${100 / placement.columns}% - 4px)` }}
                    onClick={() => openEvent(placement.event)} title={`${placement.event.title} · ${calendarForEvent(placement.event)?.name ?? placement.event.calendarName} · ${eventTime(placement.event)}`} aria-label={`${placement.event.title}, ${calendarForEvent(placement.event)?.name ?? placement.event.calendarName}, ${formatDateTime(placement.event.start)}${placement.event.end ? ` to ${formatDateTime(placement.event.end)}` : ''}`}>
                    <span className="calendar-event__title">{placement.event.title}</span>
                    <span className="calendar-event__time">{eventTime(placement.event)}</span>
                  </button>)}
                </div>)}
              </div>
            </div>
          </div>}
        </div>
      </div>
      {undated.length > 0 && <section className="mt-4" aria-label="Events without a date"><h3 className="text-sm font-medium">Date unavailable</h3><div className="flex flex-wrap gap-2">{undated.map((event, index) => eventButton(event, index, true))}</div></section>}
      <p className="mt-3 text-xs text-muted">Times use your local time zone. Select an event to see its details.</p>
    </>}
    <dialog ref={dialog} className="calendar-event-dialog w-[min(520px,calc(100vw-32px))] max-h-[85dvh] overflow-y-auto p-6 [overflow-wrap:anywhere]" aria-labelledby={`${dialogId}-title`} onClose={() => setSelectedEvent(null)}>
      <div className="flex items-start justify-between gap-4"><h2 id={`${dialogId}-title`} className="m-0 text-xl font-semibold">{selectedEvent?.title}</h2><button type="button" className="ghost-button flex min-h-11 min-w-11 shrink-0 items-center justify-center" aria-label="Close event details" autoFocus onClick={() => dialog.current?.close()}><X size={20} aria-hidden="true" /></button></div>
      {selectedEvent && <dl className="calendar-event-details grid grid-cols-1 gap-4 text-sm">
        <div><dt>Calendar</dt><dd>{calendarForEvent(selectedEvent)?.name ?? selectedEvent.calendarName}</dd></div>
        <div><dt>Start</dt><dd>{selectedEvent.isAllDay && eventStart(selectedEvent) ? `${fullDay.format(eventStart(selectedEvent)!)} · All day` : selectedEvent.start ? formatDateTime(selectedEvent.start) : 'Date unavailable'}</dd></div>
        {!selectedEvent.isAllDay && selectedEvent.end && <div><dt>End</dt><dd>{formatDateTime(selectedEvent.end)}</dd></div>}
        {!selectedEvent.isAllDay && <div><dt>Duration</dt><dd>{selectedEvent.durationMinutes === null ? 'Unavailable' : formatMinutes(selectedEvent.durationMinutes)}</dd></div>}
        {selectedEvent.location && <div><dt>Location</dt><dd>{selectedEvent.location}</dd></div>}
        {selectedEvent.description && <div><dt>Description</dt><dd className="whitespace-pre-wrap">{selectedEvent.description}</dd></div>}
      </dl>}
    </dialog>
  </section>;
}
