import { useId } from 'react';
import type { CalendarEvent } from '../types';
import { dashboardDays, formatHours } from '../utils/dashboard';
import { CalendarDonutChart, type DonutCalendar } from './CalendarDonutChart';
import { ChartLineGlow, chartAreaOpacity, chartDotRadius, chartLineWidth } from './ChartLineStyle';

interface ActivityCalendar extends DonutCalendar { dailyHours: number[] }

export function RecentActivity({ events, now, unavailable, calendars }: { events: CalendarEvent[]; now: Date; unavailable: boolean; calendars: ActivityCalendar[] }) {
  const chartId = useId().replace(/:/g, '');
  const days = dashboardDays(events, now);
  const total = calendars.reduce((sum, calendar) => sum + calendar.hours, 0);
  const dateLabel = (date: Date) => date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const width = 880, height = 240, left = 38, right = 12, top = 12, bottom = 31;
  const plotWidth = width - left - right, plotHeight = height - top - bottom;
  const maximum = Math.max(0, ...calendars.flatMap(calendar => calendar.dailyHours));
  const ceiling = Math.max(0.5, Math.ceil(maximum * 2) / 2);
  const x = (index: number) => left + index / (days.length - 1) * plotWidth;
  const y = (hours: number) => top + (1 - hours / ceiling) * plotHeight;
  const areas = [...calendars].sort((a, b) => b.hours - a.hours);
  const activeAreas = areas.filter(calendar => calendar.hours > 0);
  return <section className="card mb-6 min-w-0 p-5 sm:p-6" aria-label="Last 30 days of scheduled hours across all calendars">
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
      <h3 className="m-0 text-sm font-medium text-ink">Last 30 Days · All calendars</h3>
      <span className="text-xs text-muted">{unavailable ? '—' : `${formatHours(total)} Hrs.`}</span>
    </div>
    {unavailable ? <p className="m-0 text-sm text-muted">Activity is unavailable until all calendars load successfully.</p> : <>
      <div className="grid min-w-0 gap-6 md:grid-cols-2 md:items-center">
        <div className="min-w-0">
          <h4 className="m-0 mb-3 text-xs font-medium text-muted">Hours by saved calendar</h4>
          <ul className="m-0 list-none space-y-2 p-0">
            {calendars.map(calendar => <li key={calendar.id} className="flex min-w-0 items-center gap-3 rounded-lg border border-solid border-line px-3 py-2 text-xs">
              <span className="h-3 w-3 shrink-0 rounded-sm" style={{ background: calendar.color }} aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate" title={calendar.name}>{calendar.name}</span>
              <span className="shrink-0 tabular-nums text-muted">{formatHours(calendar.hours)} Hrs.</span>
              <span className="w-10 shrink-0 text-right tabular-nums text-muted">{total ? `${Math.round(calendar.hours / total * 100)}%` : '0%'}</span>
            </li>)}
          </ul>
        </div>
        <CalendarDonutChart calendars={calendars} />
      </div>
      <h4 className="m-0 mb-3 mt-6 text-xs font-medium text-muted">Daily activity by calendar</h4>
      <div className="max-w-full overflow-x-auto">
        <svg className="block h-auto min-w-[600px] w-full text-muted" viewBox={`0 0 ${width} ${height}`} role="img" aria-labelledby={`${chartId}-title`}>
          <title id={`${chartId}-title`}>Overlapping daily scheduled hours for every saved calendar over the last 30 days. Exact values are available in the daily hours table below.</title>
          <defs>{activeAreas.map((calendar, index) => <ChartLineGlow key={calendar.id} id={`${chartId}-line-glow-${index}`} color={calendar.color} x={-20} y={-20} width={width + 40} height={height + 40} />)}</defs>
          {[0, 1, 2, 3, 4].map(tick => {
            const value = ceiling * tick / 4;
            return <g key={tick}>
              <line x1={left} x2={width - right} y1={y(value)} y2={y(value)} stroke="currentColor" strokeOpacity="0.18" strokeDasharray={tick ? '5 4' : undefined} />
              <text x={left - 8} y={y(value) + 4} textAnchor="end" fill="currentColor" fontSize="11">{formatHours(value)}</text>
            </g>;
          })}
          {[0, 9, 19, 29].map(index => <text key={index} x={x(index)} y={height - 8} textAnchor={index === 0 ? 'start' : index === 29 ? 'end' : 'middle'} fill="currentColor" fontSize="11">{index === 29 ? 'Today' : dateLabel(days[index].date)}</text>)}
          {total > 0 ? <>
            {activeAreas.map(calendar => {
              const points = calendar.dailyHours.map((hours, index) => `${x(index)} ${y(hours)}`);
              return <path key={calendar.id} d={`M ${points.join(' L ')} L ${x(days.length - 1)} ${y(0)} L ${x(0)} ${y(0)} Z`} fill={calendar.color} fillOpacity={chartAreaOpacity} />;
            })}
            {activeAreas.map((calendar, index) => {
              const points = calendar.dailyHours.map((hours, dayIndex) => `${x(dayIndex)} ${y(hours)}`);
              const line = `M ${points.join(' L ')}`;
              return <g key={calendar.id}>
                <title>{`${calendar.name}: ${formatHours(calendar.hours)} hours in the last 30 days`}</title>
                <path d={line} fill="none" stroke={calendar.color} strokeWidth={chartLineWidth} strokeLinejoin="round" filter={`url(#${chartId}-line-glow-${index})`} />
                {calendar.dailyHours.map((hours, dayIndex) => <circle key={days[dayIndex].date.getTime()} cx={x(dayIndex)} cy={y(hours)} r={chartDotRadius} fill={calendar.color}><title>{`${calendar.name}, ${dateLabel(days[dayIndex].date)}: ${formatHours(hours)} hours`}</title></circle>)}
              </g>;
            })}
          </> : <text x={width / 2} y={height / 2} textAnchor="middle" fill="currentColor" fontSize="14">No hours in this period</text>}
        </svg>
      </div>
      <details className="mt-3 text-xs text-muted">
        <summary className="w-fit">Daily hours</summary>
        <div className="mt-3 max-w-full overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <caption className="mb-2 text-left">Scheduled hours per calendar for each day</caption>
            <thead><tr><th className="p-2">Day</th>{calendars.map(calendar => <th className="p-2" key={calendar.id}>{calendar.name}</th>)}<th className="p-2">Total</th></tr></thead>
            <tbody>{days.map((day, index) => <tr key={day.date.getTime()} className="border-0 border-t border-solid border-line"><th className="whitespace-nowrap p-2 font-normal">{dateLabel(day.date)}</th>{calendars.map(calendar => <td className="p-2 tabular-nums" key={calendar.id}>{formatHours(calendar.dailyHours[index])}</td>)}<td className="p-2 tabular-nums">{formatHours(day.hours)}</td></tr>)}</tbody>
          </table>
        </div>
      </details>
    </>}
  </section>;
}
