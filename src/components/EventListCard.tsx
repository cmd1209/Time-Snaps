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
        <div className="grid grid-cols-1 gap-7">
          {groupEventsByDay(events).map(([day, dayEvents]) => (
            <section className="event-day min-w-0" key={day || 'undated'}>
              <h3>{day ? new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(new Date(`${day}T12:00:00`)) : 'Date not available'}</h3>
              <div className="grid grid-cols-1 gap-3">
                {dayEvents.map((event, index) => (
                  <article className="event-row p-3.5" key={`${event.uid}-${event.start}-${index}`}>
                    <div className="flex flex-wrap justify-between gap-x-4 gap-y-2">
                      <div><p className="event-time">{timeLabel(event)}</p><h4>{event.title}</h4></div>
                      {!event.isAllDay && event.durationMinutes !== null && <span className="self-start whitespace-nowrap rounded-md bg-accent-soft px-[9px] py-1 text-[0.8rem]">{formatMinutes(event.durationMinutes)}</span>}
                    </div>
                    {(event.location || event.description) && (
                      <details className="event-details mt-3">
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
