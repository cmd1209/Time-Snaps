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
    <section className="card period-card" aria-label="Date range and summary">
      <div className="period-toolbar">
        <div>
          <h2>Your overview</h2>
          <p className="card__subtitle">Events starting in this date range.</p>
        </div>
        <div className="button-group">
          <button type="button" className="ghost-button" onClick={thisMonth}>This month</button>
          <button type="button" className="ghost-button" onClick={() => onRangeChange('', '')}>All dates</button>
        </div>
      </div>
      <div className="period-content">
        <div className="date-range">
          <label className="field"><span>From</span><input type="date" value={from} aria-invalid={invalid} onChange={event => onRangeChange(event.target.value, to)} /></label>
          <label className="field"><span>To</span><input type="date" value={to} aria-invalid={invalid} onChange={event => onRangeChange(from, event.target.value)} /></label>
        </div>
        <dl className="overview-totals">
          <div><dt>Events</dt><dd>{count}</dd></div>
          <div><dt>Timed duration</dt><dd>{formatMinutes(minutes)}</dd></div>
        </dl>
      </div>
      {invalid ? <p className="calendar-preview__error" role="alert">The end date must be on or after the start date.</p> : <p className="hint">{!from && !to ? 'Showing all dates. ' : ''}Times use your local time zone. All-day events are excluded from timed duration.</p>}
    </section>
  );
}
