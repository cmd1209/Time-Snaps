import { Card } from './Card';
import { CalendarSummary } from '../types';
import { formatDateTime, formatMinutes } from '../utils/format';

interface SummaryCardProps {
  summary: CalendarSummary;
}

export function SummaryCard({ summary }: SummaryCardProps) {
  return (
    <Card title="Summary" subtitle="Basic totals for this proof-of-concept load.">
      <div className="summary-grid">
        <div className="summary-item">
          <span className="summary-item__label">Calendars loaded</span>
          <strong>{summary.totalCalendars}</strong>
        </div>
        <div className="summary-item">
          <span className="summary-item__label">Total events</span>
          <strong>{summary.totalEvents}</strong>
        </div>
        <div className="summary-item">
          <span className="summary-item__label">Tracked duration</span>
          <strong>{formatMinutes(summary.totalTrackedMinutes)}</strong>
        </div>
        <div className="summary-item">
          <span className="summary-item__label">Earliest event</span>
          <strong>{formatDateTime(summary.earliestStart)}</strong>
        </div>
        <div className="summary-item">
          <span className="summary-item__label">Latest event</span>
          <strong>{formatDateTime(summary.latestEnd)}</strong>
        </div>
      </div>
    </Card>
  );
}
