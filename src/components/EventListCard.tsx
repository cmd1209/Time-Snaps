import { Card } from './Card';
import { CalendarEvent } from '../types';
import { formatDateTime, formatMinutes } from '../utils/format';

interface EventListCardProps {
  events: CalendarEvent[];
}

export function EventListCard({ events }: EventListCardProps) {
  return (
    <Card title="Event List" subtitle="Raw parsed events sorted by start date descending.">
      {events.length === 0 ? (
        <p className="empty-state">No events loaded yet.</p>
      ) : (
        <div className="event-list">
          {events.map((event) => (
            <article className="event-row" key={`${event.sourceUrl}-${event.uid}-${event.start ?? 'no-start'}`}>
              <div className="event-row__top">
                <strong>{event.title}</strong>
                <span>{formatMinutes(event.durationMinutes)}</span>
              </div>
              <div className="event-row__meta">
                <span>Calendar: {event.calendarName}</span>
                <span>Start: {formatDateTime(event.start)}</span>
                <span>End: {formatDateTime(event.end)}</span>
                <span>All day: {event.isAllDay ? 'Yes' : 'No'}</span>
              </div>
              <p className="event-row__source">Source: {event.sourceUrl}</p>
              {event.location ? <p>Location: {event.location}</p> : null}
              {event.description ? <p>Description: {event.description}</p> : null}
            </article>
          ))}
        </div>
      )}
    </Card>
  );
}
