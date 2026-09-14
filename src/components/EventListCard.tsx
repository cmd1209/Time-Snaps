import { Card } from './Card';
import { CalendarEvent } from '../types';
import { formatDateTime, formatMinutes } from '../utils/format';
import { groupEventsByDay, localDateKey } from '../utils/eventView';

interface EventListCardProps {
  events: CalendarEvent[];
  loading: boolean;
  emptyMessage: string;
}

function timeLabel(event: CalendarEvent): string {
  if (event.isAllDay) return 'All day';
  if (!event.start) return 'Time not available';
  const time = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' });
  const start = time.format(new Date(event.start));
  if (!event.end) return start;
  const end = localDateKey(event.start) === localDateKey(event.end) ? time.format(new Date(event.end)) : formatDateTime(event.end);
  return `${start} – ${end}`;
}

export function EventListCard({ events, loading, emptyMessage }: EventListCardProps) {
  return (
    <Card title="Events">
      {loading ? <p className="empty-state" role="status">Loading your events...</p> : events.length === 0 ? (
        <p className="empty-state">{emptyMessage}</p>
      ) : (
        <div className="event-days">
          {groupEventsByDay(events).map(([day, dayEvents]) => (
            <section className="event-day" key={day || 'undated'}>
              <h3>{day ? new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(new Date(`${day}T12:00:00`)) : 'Date not available'}</h3>
              <div className="event-list">
                {dayEvents.map((event, index) => (
                  <article className="event-row" key={`${event.uid}-${event.start}-${index}`}>
                    <div className="event-row__top">
                      <div><p className="event-time">{timeLabel(event)}</p><h4>{event.title}</h4></div>
                      {!event.isAllDay && event.durationMinutes !== null && <span className="duration-badge">{formatMinutes(event.durationMinutes)}</span>}
                    </div>
                    {(event.location || event.description) && (
                      <details className="event-details">
                        <summary>Event details</summary>
                        {event.location && <p><strong>Location</strong><br />{event.location}</p>}
                        {event.description && <p className="event-description"><strong>Description</strong><br />{event.description}</p>}
                      </details>
                    )}
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </Card>
  );
}
