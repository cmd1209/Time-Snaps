import { useId } from 'react';
import type { DashboardMonth } from '../utils/dashboard';
import { formatHours } from '../utils/dashboard';
import { ChartLineGlow, chartAreaOpacity, chartDotRadius, chartLineWidth } from './ChartLineStyle';

export interface ChartSeries { id: string; name: string; color: string; values: number[] }
interface Props { months: DashboardMonth[]; series: ChartSeries[] }

export function DashboardCharts({ months, series }: Props) {
  const id = useId().replace(/:/g, '');
  const width = 560, height = 300, left = 44, right = 12, top = 20, bottom = 42;
  const plotWidth = width - left - right, plotHeight = height - top - bottom;
  const maximum = Math.max(1, ...months.map((_, i) => series.reduce((sum, item) => sum + item.values[i], 0)));
  const ceiling = Math.ceil(maximum / 4) * 4;
  const y = (value: number) => top + plotHeight * (1 - value / ceiling);
  const step = plotWidth / months.length;
  const x = (i: number) => left + step * (i + 0.5);
  const comparisonSeries = [...series].sort((a, b) => b.values.reduce((sum, value) => sum + value, 0) - a.values.reduce((sum, value) => sum + value, 0));
  const grid = () => <>
    {[0, 1, 2, 3, 4].map(tick => {
      const value = ceiling * tick / 4;
      return <g key={tick}>
        <line x1={left} x2={width - right} y1={y(value)} y2={y(value)} stroke="currentColor" strokeOpacity="0.18" strokeDasharray={tick ? '5 4' : undefined} />
        <text x={left - 8} y={y(value) + 4} textAnchor="end" fill="currentColor" fontSize="11">{formatHours(value)}</text>
      </g>;
    })}
    {months.map((month, i) => <text key={month.key} x={x(i)} y={height - 16} textAnchor="middle" fill="currentColor" fontSize="11">{month.label}</text>)}
  </>;
  return <>
    <div className="grid min-w-0 grid-cols-1 gap-5 lg:grid-cols-2">
      <section className="card min-w-0 rounded-xl p-4 sm:p-6">
        <h3 className="m-0 text-sm font-medium text-ink">Monthly hours</h3>
        <svg className="mt-4 block h-auto w-full overflow-visible text-ink" viewBox={`0 0 ${width} ${height}`} role="img" aria-labelledby={`${id}-bars`}>
          <title id={`${id}-bars`}>Stacked monthly scheduled hours. Exact values are available in the chart data table below.</title>
          {grid()}
          {months.map((month, i) => {
            let sum = 0;
            return <g key={month.key}>{series.map(item => {
              const value = item.values[i];
              sum += value;
              return <rect key={item.id} x={x(i) - Math.min(10, step / 4)} y={y(sum)} width={Math.min(20, step / 2)} height={plotHeight * value / ceiling} fill={item.color} rx="3"><title>{`${item.name}, ${month.fullLabel}: ${formatHours(value)} hours`}</title></rect>;
            })}</g>;
          })}
        </svg>
      </section>
      <section className="card min-w-0 rounded-xl p-4 sm:p-6">
        <h3 className="m-0 text-sm font-medium text-ink">Calendar comparison</h3>
        <svg className="mt-4 block h-auto w-full overflow-visible text-ink" viewBox={`0 0 ${width} ${height}`} role="img" aria-labelledby={`${id}-lines`}>
          <title id={`${id}-lines`}>Monthly scheduled hours for each calendar. Exact values are available in the chart data table below.</title>
          <defs>{comparisonSeries.map((item, index) => <ChartLineGlow key={item.id} id={`${id}-line-glow-${index}`} color={item.color} x={-20} y={-20} width={width + 40} height={height + 40} />)}</defs>
          {grid()}
          {comparisonSeries.map(item => <path key={item.id} d={`M ${item.values.map((value, i) => `${x(i)} ${y(value)}`).join(' L ')} L ${x(months.length - 1)} ${y(0)} L ${x(0)} ${y(0)} Z`} fill={item.color} fillOpacity={chartAreaOpacity} />)}
          {comparisonSeries.map((item, index) => <g key={item.id}>
            <polyline points={item.values.map((value, i) => `${x(i)},${y(value)}`).join(' ')} fill="none" stroke={item.color} strokeWidth={chartLineWidth} strokeLinejoin="round" filter={`url(#${id}-line-glow-${index})`} />
            {item.values.map((value, i) => <circle key={months[i].key} cx={x(i)} cy={y(value)} r={chartDotRadius} fill={item.color}><title>{`${item.name}, ${months[i].fullLabel}: ${formatHours(value)} hours`}</title></circle>)}
          </g>)}
        </svg>
      </section>
    </div>
    <details className="mt-3 text-sm text-muted">
      <summary className="w-fit">View chart data</summary>
      <div className="mt-3 max-w-full overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm">
          <caption className="mb-2 text-left">Scheduled hours by month</caption>
          <thead><tr><th className="p-2">Month</th>{series.map(item => <th className="p-2" key={item.id}>{item.name}</th>)}</tr></thead>
          <tbody>{months.map((month, i) => <tr key={month.key} className="border-0 border-t border-solid border-line"><th className="p-2 font-normal">{month.fullLabel}</th>{series.map(item => <td className="p-2 tabular-nums" key={item.id}>{formatHours(item.values[i])}</td>)}</tr>)}</tbody>
        </table>
      </div>
    </details>
  </>;
}
