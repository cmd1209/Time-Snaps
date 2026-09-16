import { useEffect, useMemo, useState } from 'react';
import { Plus, X } from 'lucide-react';
import type { CalendarEvent, SavedCalendar } from '../types';
import { loadCalendar } from '../utils/calendar';
import { dashboardMonths, dashboardStats, formatHours } from '../utils/dashboard';
import { calendarColor, calendarTextColor } from '../utils/calendarColor';
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
    const extra = calendars.filter(calendar => comparisonIds.includes(calendar.id) && calendar.id !== selectedId);
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
      setComparing(false);
    });
    return () => { cancelled = true; };
  }, [calendars, comparisonIds, selectedId, refreshToken]);

  const series = [
    ...(selected && !loading && !failed ? [{ id: selected.id, name: selected.name, color: color(selected.id), values: stats.byMonth }] : []),
    ...extraCalendars.flatMap(calendar => {
      const result = comparisons[calendar.id];
      return result && result.url === calendar.calendar_url && !result.error ? [{ id: calendar.id, name: calendar.name, color: color(calendar.id), values: dashboardStats(result.events, months, now).byMonth }] : [];
    })
  ];
  const available = calendars.filter(calendar => calendar.id !== selectedId && !comparisonIds.includes(calendar.id));
  const metrics = [
    ['Total', stats.total, 'All timed events available in this calendar.'],
    ['Current month', stats.currentMonth, 'Scheduled hours in the full current month.'],
    ['Monthly avg.', stats.monthlyAverage, `Average over the ${monthCount} displayed months, including months with no events.`],
    ['Current week', stats.currentWeek, 'Scheduled hours Monday through Sunday.']
  ] as const;

  return <section aria-labelledby="dashboard-heading" className="min-w-0">
    <div className="flex flex-wrap items-center justify-between gap-4 border-0 border-b border-solid border-zinc-200 pb-5">
      <h2 id="dashboard-heading" className="m-0 text-lg font-medium">Dashboard</h2>
      <div className="flex min-w-0 flex-wrap items-center gap-2" aria-label="Calendars in chart">
        {selected && <span className="max-w-full rounded-full px-3 py-1.5 text-xs font-medium text-zinc-950" style={{ background: color(selected.id), color: calendarTextColor(selected.color) }}>{selected.name}<span className="sr-only"> (selected calendar)</span></span>}
        {extraCalendars.map(calendar => <button type="button" key={calendar.id} className="flex max-w-full items-center gap-2 rounded-full px-3 py-1.5 text-xs text-zinc-950" style={{ background: color(calendar.id), color: calendarTextColor(calendar.color) }} onClick={() => setComparisonIds(ids => ids.filter(id => id !== calendar.id))} aria-label={`Remove ${calendar.name} from comparison`}>
          <span>{calendar.name}</span><X size={13} aria-hidden="true" className="shrink-0" />
        </button>)}
        {available.length > 0 && <label className="flex items-center gap-1 text-xs text-zinc-600"><Plus size={14} aria-hidden="true" /><span className="sr-only">Add calendar to compare</span><select className="max-w-48 min-w-0 rounded-md border border-solid border-zinc-200 bg-white px-2 py-1.5 text-xs text-zinc-700" value="" onChange={event => { const id = event.target.value; setComparisonIds(ids => [...ids, id]); }}>
          <option value="" disabled>Compare calendar</option>{available.map(calendar => <option value={calendar.id} key={calendar.id}>{calendar.name}</option>)}
        </select></label>}
      </div>
    </div>
    {!selected ? <p className="py-8 text-sm text-zinc-500">Save a calendar in Calendar Settings to see your dashboard.</p> : <>
      <div className="my-6 grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label={`Statistics for ${selected.name}`}>
        {metrics.map(([label, value, description]) => <div key={label} className="min-w-0 rounded-xl border border-solid border-zinc-200 bg-zinc-50 px-5 py-5 sm:px-6" title={description}>
          <h3 className="m-0 text-sm font-normal text-zinc-700">{label}</h3>
          <p className="m-0 mt-2 text-2xl font-extrabold tracking-tight text-zinc-950 sm:text-3xl">{loading || failed ? '—' : <>{formatHours(value)} <span className="text-lg sm:text-xl">Hours</span></>}</p>
        </div>)}
      </div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 text-xs text-zinc-500">
        <p className="m-0">Statistics for <strong className="font-medium text-zinc-700">{selected.name}</strong>. Comparisons appear in the charts.</p>
        <label className="flex items-center gap-2">Chart period<select className="rounded-md border border-solid border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-700" value={monthCount} onChange={event => setMonthCount(Number(event.target.value))}><option value={6}>Last 6 months</option><option value={12}>Last 12 months</option></select></label>
      </div>
      {(loading || comparing) && <p role="status" className="text-sm text-zinc-500">Loading calendar charts...</p>}
      {extraCalendars.map(calendar => comparisons[calendar.id]?.error && <p key={calendar.id} role="alert" className="text-sm text-red-700">{calendar.name}: {comparisons[calendar.id].error} Use Refresh to retry.</p>)}
      <DashboardCharts months={months} series={series} />
      {!loading && !comparing && series.length > 0 && series.every(item => item.values.every(value => value === 0)) && <p className="text-sm text-zinc-500">No timed events in these months. Try a longer chart period.</p>}
      <p className="mt-4 text-xs leading-relaxed text-zinc-500">Scheduled hours, excluding all-day events. Months and weeks use your local time zone and event start dates. Monthly average includes zero months and the current month. Recurring series are not expanded yet.</p>
    </>}
  </section>;
}
