import type { CalendarEvent } from '../types';
import { dashboardDays, formatHours } from '../utils/dashboard';

export function RecentActivity({ events, now, unavailable }: { events: CalendarEvent[]; now: Date; unavailable: boolean }) {
  const days = dashboardDays(events, now);
  const maximum = Math.max(1, ...days.map(day => day.hours));
  const dateLabel = (date: Date) => date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return <section className="card mb-6 min-w-0 p-5 sm:p-6" aria-label="Last 30 days of scheduled hours across all calendars">
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
      <h3 className="m-0 text-xs font-normal">Last 30 Days · All calendars</h3>
      <span className="text-xs text-muted">{unavailable ? '—' : `${formatHours(days.reduce((sum, day) => sum + day.hours, 0))} Hrs.`}</span>
    </div>
    {unavailable ? <p className="m-0 text-sm text-muted">Activity is unavailable until all calendars load successfully.</p> : <>
      <div className="flex h-20 items-end gap-1 sm:gap-2" aria-hidden="true">
        {days.map(day => <div key={day.date.getTime()} className="min-w-0 flex-1 rounded-t-sm" title={`${dateLabel(day.date)}: ${formatHours(day.hours)} hours`} style={{ height: `${day.hours ? Math.max(8, day.hours / maximum * 100) : 7}%`, background: day.hours ? 'var(--color-highlight)' : 'var(--color-activity-empty)' }} />)}
      </div>
      <div className="mt-2 flex justify-between text-xs text-muted"><span>{dateLabel(days[0].date)}</span><span>Today</span></div>
      <details className="mt-3 text-xs text-muted">
        <summary className="w-fit">Daily hours</summary>
        <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3">
          {days.map(day => <div key={day.date.getTime()} className="flex flex-wrap justify-between gap-1"><dt>{dateLabel(day.date)}</dt><dd className="m-0 tabular-nums">{formatHours(day.hours)} Hrs.</dd></div>)}
        </dl>
      </details>
    </>}
  </section>;
}
