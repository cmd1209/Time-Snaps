import { useEffect, useMemo, useState } from 'react';
import { Plus, X } from 'lucide-react';
import type { CalendarEvent, SavedCalendar } from '../types';
import { loadCalendar } from '../utils/calendar';
import { dashboardMonths, dashboardStats, formatHours } from '../utils/dashboard';
import { calendarColor, calendarTextColor } from '../utils/calendarColor';
import { RecentActivity } from '../components/RecentActivity';
import { DashboardCharts } from '../components/DashboardCharts';

interface Props {
  calendars: SavedCalendar[];
  selectedId: string;
  events: CalendarEvent[];
  loading: boolean;
  failed: boolean;
  refreshToken: number;
}
interface Comparison { url: string; events: CalendarEvent[]; error: string | null }

export function Dashboard({ calendars, selectedId, events, loading, failed, refreshToken }: Props) {
  const [comparisonIds, setComparisonIds] = useState<string[]>([]);
  const [comparisons, setComparisons] = useState<Record<string, Comparison>>({});
  const [comparing, setComparing] = useState(false);
  const [loadedScope, setLoadedScope] = useState('');
  const loadScope = JSON.stringify([selectedId, refreshToken, calendars.map(calendar => [calendar.id, calendar.calendar_url])]);
  const [monthCount, setMonthCount] = useState(6);
  const [now, setNow] = useState(() => new Date());
  // Keep this week's/month's boundaries current for tabs left open overnight.
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  const selected = calendars.find(calendar => calendar.id === selectedId);
  const color = (id: string) => calendarColor(calendars.find(calendar => calendar.id === id)?.color, calendars.findIndex(calendar => calendar.id === id));
  const months = useMemo(() => dashboardMonths(now, monthCount), [now, monthCount]);
  const stats = useMemo(() => dashboardStats(events, months, now), [events, months, now]);
  const extraCalendars = calendars.filter(calendar => comparisonIds.includes(calendar.id) && calendar.id !== selectedId);

  useEffect(() => {
    let cancelled = false;
    const extra = calendars.filter(calendar => calendar.id !== selectedId);
    setComparing(extra.length > 0);
    setComparisons({});
    void Promise.all(extra.map(async calendar => {
      try {
        const result = await loadCalendar(calendar.calendar_url);
        return [calendar.id, { url: calendar.calendar_url, events: result.events, error: null }] as const;
      } catch (error) {
        return [calendar.id, { url: calendar.calendar_url, events: [], error: error instanceof Error ? error.message : 'Unable to load calendar.' }] as const;
      }
    })).then(entries => {
      if (cancelled) return;
      setComparisons(Object.fromEntries(entries));
      setLoadedScope(loadScope);
      setComparing(false);
    });
    return () => { cancelled = true; };
  }, [calendars, selectedId, refreshToken, loadScope]);

  const series = [
    ...(selected && !loading && !failed ? [{ id: selected.id, name: selected.name, color: color(selected.id), values: stats.byMonth }] : []),
    ...extraCalendars.flatMap(calendar => {
      const result = comparisons[calendar.id];
      return loadedScope === loadScope && result && result.url === calendar.calendar_url && !result.error ? [{ id: calendar.id, name: calendar.name, color: color(calendar.id), values: dashboardStats(result.events, months, now).byMonth }] : [];
    })
  ];
  const otherCalendars = calendars.filter(calendar => calendar.id !== selectedId);
  const overviewUnavailable = loading || failed || (otherCalendars.length > 0 && (
    loadedScope !== loadScope || comparing || otherCalendars.some(calendar => {
      const result = comparisons[calendar.id];
      return !result || result.url !== calendar.calendar_url || result.error !== null;
    })
  ));
  const allEvents = useMemo(() => [
    ...events,
    ...calendars.filter(calendar => calendar.id !== selectedId).flatMap(calendar => {
      const result = comparisons[calendar.id];
      return result && result.url === calendar.calendar_url && !result.error ? result.events : [];
    }),
  ], [events, calendars, selectedId, comparisons]);
  const overview = useMemo(() => dashboardStats(allEvents, months, now), [allEvents, months, now]);
  const overviewHours = (value: number) => overviewUnavailable ? '—' : `${formatHours(value)} Hrs.`;
  const selectedMetrics = [
    ['Total Time', stats.total],
    ['Current Month', stats.currentMonth],
    ['Monthly Average', stats.monthlyAverage],
    ['Current Week', stats.currentWeek],
  ] as const;
  const available = calendars.filter(calendar => calendar.id !== selectedId && !comparisonIds.includes(calendar.id));
  const hours = (value: number) => loading || failed ? '—' : `${formatHours(value)} Hrs.`;

  return <section aria-labelledby="dashboard-heading" className="min-w-0">
    <div className="flex flex-wrap items-center justify-between gap-4 border-0 pb-5">
      <h2 id="dashboard-heading" className="m-0 text-lg font-medium">Dashboard</h2>
      <div className="flex min-w-0 flex-wrap items-center gap-2" aria-label="Calendars in chart">
        {selected && <span className="max-w-full rounded-full px-3 py-1.5 text-xs font-medium text-ink" style={{ background: color(selected.id), color: calendarTextColor(selected.color) }}>{selected.name}<span className="sr-only"> (selected calendar)</span></span>}
        {extraCalendars.map(calendar => <button type="button" key={calendar.id} className="flex max-w-full items-center gap-2 rounded-full px-3 py-1.5 text-xs text-zinc-950" style={{ background: color(calendar.id), color: calendarTextColor(calendar.color) }} onClick={() => setComparisonIds(ids => ids.filter(id => id !== calendar.id))} aria-label={`Remove ${calendar.name} from comparison`}>
          <span>{calendar.name}</span><X size={13} aria-hidden="true" className="shrink-0" />
        </button>)}
        {available.length > 0 && <label className="flex items-center gap-1 text-xs text-muted"><Plus size={14} aria-hidden="true" /><span className="sr-only">Add calendar to compare</span><select className="max-w-48 min-w-0 rounded-md px-2 py-1.5 text-xs text-ink" value="" onChange={event => { const id = event.target.value; setComparisonIds(ids => [...ids, id]); }}>
          <option value="" disabled>Compare calendar</option>{available.map(calendar => <option value={calendar.id} key={calendar.id}>{calendar.name}</option>)}
        </select></label>}
      </div>
    </div>
    {!selected ? <p className="py-8 text-sm text-muted">Save a calendar in Calendar Settings to see your dashboard.</p> : <>
      <h3 className="mb-3 mt-0 text-sm font-medium text-muted">All calendars</h3>
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4" aria-label="Statistics across all saved calendars">
        <div className="card min-w-0 p-5 sm:p-6" title="Number of saved calendars across your account.">
          <h3 className="m-0 text-xs font-normal">Calendars</h3>
          <p className="m-0 mt-2 text-2xl font-bold tracking-tight">{calendars.length}</p>
        </div>
        <div className="card min-w-0 p-5 sm:p-6" title="All timed events available across your saved calendars.">
          <h3 className="m-0 text-xs font-normal">Total Time</h3>
          <p className="m-0 mt-2 text-2xl font-bold tracking-tight">{overviewHours(overview.total)}</p>
        </div>
        <div className="card col-span-2 grid min-w-0 grid-cols-2 gap-4 p-5 sm:p-6">
          <div title="Scheduled hours in the full current month."><h3 className="m-0 text-xs font-normal">Current Month</h3><p className="m-0 mt-2 text-2xl font-bold tracking-tight">{overviewHours(overview.currentMonth)}</p></div>
          <div title="Scheduled hours Monday through Sunday."><h3 className="m-0 text-xs font-normal">Current Week</h3><p className="m-0 mt-2 text-2xl font-bold tracking-tight">{overviewHours(overview.currentWeek)}</p></div>
        </div>
      </div>
      <h3 className="mb-3 mt-0 text-sm font-medium text-muted">Selected calendar · {selected.name}</h3>
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4" aria-label={`Statistics for ${selected.name}`}>
        {selectedMetrics.map(([label, value]) => <div key={label} className="card min-w-0 p-5 sm:p-6" title={label === 'Monthly Average' ? `Average over the ${monthCount} displayed months, including zero months.` : undefined}>
          <h4 className="m-0 text-xs font-normal">{label}</h4>
          <p className="m-0 mt-2 text-2xl font-bold tracking-tight">{hours(value)}</p>
        </div>)}
      </div>
      {(loading || comparing || (otherCalendars.length > 0 && loadedScope !== loadScope)) && <p role="status" className="text-sm text-muted">Loading totals across all calendars…</p>}
      {loadedScope === loadScope && otherCalendars.map(calendar => comparisons[calendar.id]?.error && <p key={calendar.id} role="alert" className="text-sm text-error">{calendar.name}: {comparisons[calendar.id].error} All-calendar totals are unavailable. Use Refresh to retry.</p>)}
      <RecentActivity events={allEvents} now={now} unavailable={overviewUnavailable} />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 text-xs text-muted">
        <p className="m-0">Statistics for <strong className="font-medium text-muted">{selected.name}</strong>. Comparisons appear below.</p>
        <label className="flex items-center gap-2">Chart period<select className="rounded-md px-2 py-1 text-xs text-ink" value={monthCount} onChange={event => setMonthCount(Number(event.target.value))}><option value={6}>Last 6 months</option><option value={12}>Last 12 months</option></select></label>
      </div>
      {(loading || comparing) && <p role="status" className="text-sm text-ink">Loading calendar charts...</p>}
      <DashboardCharts months={months} series={series} />
      {!loading && !comparing && series.length > 0 && series.every(item => item.values.every(value => value === 0)) && <p className="text-sm text-muted">No timed events in these months. Try a longer chart period.</p>}
      <p className="mt-4 text-xs leading-relaxed text-muted">Scheduled hours, excluding all-day events. Months and weeks use your local time zone and event start dates. Monthly average includes zero months and the current month. Recurring series are not expanded yet.</p>
    </>}
  </section>;
}
