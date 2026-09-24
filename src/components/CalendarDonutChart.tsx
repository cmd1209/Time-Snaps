import { useId } from 'react';
import { formatHours } from '../utils/dashboard';

export interface DonutCalendar { id: string; name: string; color: string; hours: number }

export function CalendarDonutChart({ calendars }: { calendars: DonutCalendar[] }) {
  const chartId = useId().replace(/:/g, '');
  const total = calendars.reduce((sum, calendar) => sum + calendar.hours, 0);
  let angle = -Math.PI / 2;
  const slices = calendars.filter(calendar => calendar.hours > 0).map(calendar => {
    const start = angle;
    angle += calendar.hours / total * Math.PI * 2;
    const end = angle;
    const point = (radians: number) => [100 + 84 * Math.cos(radians), 100 + 84 * Math.sin(radians)];
    const [startX, startY] = point(start);
    const [endX, endY] = point(end);
    return {
      ...calendar,
      path: `M 100 100 L ${startX} ${startY} A 84 84 0 ${end - start > Math.PI ? 1 : 0} 1 ${endX} ${endY} Z`,
    };
  });

  return <div className="flex min-w-0 flex-col items-center justify-center">
    {total > 0 ? <svg className="block aspect-square w-full max-w-[360px]" viewBox="0 0 200 200" role="img" aria-labelledby={`${chartId}-title`}>
      <title id={`${chartId}-title`}>Share of scheduled hours by saved calendar in the last 30 days, with {formatHours(total)} total hours</title>
      <defs>{slices.map((slice, index) => <filter key={slice.id} id={`${chartId}-glow-${index}`} x="-20" y="-20" width="240" height="240" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
        <feGaussianBlur in="SourceAlpha" stdDeviation="10" result="blur" />
        <feFlood floodColor={slice.color} floodOpacity="0.7" result="tint" />
        <feComposite in="tint" in2="blur" operator="in" result="glow" />
        <feMerge><feMergeNode in="glow" /><feMergeNode in="SourceGraphic" /></feMerge>
      </filter>)}</defs>
      {slices.length === 1
        ? <circle cx="100" cy="100" r="84" fill={slices[0].color} filter={`url(#${chartId}-glow-0)`}><title>{`${slices[0].name}: ${formatHours(slices[0].hours)} hours, 100%`}</title></circle>
        : slices.map((slice, index) => <path key={slice.id} d={slice.path} fill={slice.color} filter={`url(#${chartId}-glow-${index})`}><title>{`${slice.name}: ${formatHours(slice.hours)} hours, ${Math.round(slice.hours / total * 100)}%`}</title></path>)}
      <circle cx="100" cy="100" r="48" fill="var(--color-page)" aria-hidden="true" />
      <text x="100" y="99" textAnchor="middle" fill="var(--color-ink)" fontSize="20" fontWeight="700" aria-hidden="true">{formatHours(total)}</text>
      <text x="100" y="117" textAnchor="middle" fill="var(--color-muted)" fontSize="11" aria-hidden="true">Hrs. total</text>
    </svg> : <div className="flex aspect-square w-full max-w-[360px] items-center justify-center rounded-full border-2 border-solid border-line text-center text-xs text-muted">No hours in this period</div>}
  </div>;
}
