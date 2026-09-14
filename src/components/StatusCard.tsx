import { Card } from './Card';
import { CalendarLoadItem, LoadMode, StatusTone } from '../types';
import { describeLoadMode } from '../utils/calendar';

interface StatusCardProps {
  statusTone: StatusTone;
  statusMessage: string;
  activeMode: LoadMode | null;
  calendarLoads: CalendarLoadItem[];
}

export function StatusCard({ statusTone, statusMessage, activeMode, calendarLoads }: StatusCardProps) {
  return (
    <Card title="Status" subtitle="Connection and parsing feedback for the current URL.">
      <div className={`status status--${statusTone}`}>
        <strong>{statusMessage}</strong>
        {activeMode ? <p>{describeLoadMode(activeMode)}</p> : null}
      </div>
      {calendarLoads.length > 0 ? (
        <div className="status-list">
          {calendarLoads.map((calendarLoad) => (
            <article className="status-list__item" key={calendarLoad.normalizedUrl}>
              <strong>{calendarLoad.calendarName ?? 'Unresolved calendar'}</strong>
              <p>{calendarLoad.normalizedUrl}</p>
              <p>
                {calendarLoad.error
                  ? `Error: ${calendarLoad.error}`
                  : `${calendarLoad.events.length} event(s) loaded${calendarLoad.mode ? ` via ${calendarLoad.mode}` : ''}.`}
              </p>
            </article>
          ))}
        </div>
      ) : null}
      <p className="hint">
        Public iCloud feeds often fail with browser CORS restrictions. This prototype tries a direct browser request
        first, then falls back to the calendar server.
      </p>
    </Card>
  );
}
