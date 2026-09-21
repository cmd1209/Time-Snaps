import { formatMinutes } from '../utils/format';
import { localDateKey } from '../utils/eventView';

interface SummaryCardProps {
  count: number;
  minutes: number;
  from: string;
  to: string;
  onRangeChange: (from: string, to: string) => void;
}

export function SummaryCard({ count, minutes, from, to, onRangeChange }: SummaryCardProps) {
  const invalid = Boolean(from && to && from > to);
  function thisMonth() {
    const now = new Date();
    onRangeChange(localDateKey(new Date(now.getFullYear(), now.getMonth(), 1)), localDateKey(new Date(now.getFullYear(), now.getMonth() + 1, 0)));
  }
  return (
    <section className="card min-w-0 p-[18px] [@media(max-width:640px)]:p-3.5 period-card" aria-label="Date range and summary">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2>Your overview</h2>
          <p className="card__subtitle">Events starting in this date range.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="ghost-button" onClick={thisMonth}>This month</button>
          <button type="button" className="ghost-button" onClick={() => onRangeChange('', '')}>All dates</button>
        </div>
      </div>
      <div className="mt-[18px] flex flex-wrap items-end justify-between gap-4">
        <div className="grid min-w-0 flex-[1_1_320px] grid-cols-2 gap-3">
          <label className="field grid min-w-0 grid-cols-1 gap-2"><span>From</span><input type="date" value={from} aria-invalid={invalid} onChange={event => onRangeChange(event.target.value, to)} /></label>
          <label className="field grid min-w-0 grid-cols-1 gap-2"><span>To</span><input type="date" value={to} aria-invalid={invalid} onChange={event => onRangeChange(from, event.target.value)} /></label>
        </div>
        <dl className="overview-totals m-0 flex flex-[0_1_auto] flex-wrap items-center gap-8 [@media(max-width:480px)]:gap-6">
          <div><dt>Events</dt><dd>{count}</dd></div>
          <div><dt>Timed duration</dt><dd>{formatMinutes(minutes)}</dd></div>
        </dl>
      </div>
      {invalid ? <p className="calendar-preview__error" role="alert">The end date must be on or after the start date.</p> : <p className="hint">{!from && !to ? 'Showing all dates. ' : ''}Times use your local time zone. All-day events are excluded from timed duration.</p>}
    </section>
  );
}
