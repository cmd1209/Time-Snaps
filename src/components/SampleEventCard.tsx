import { Card } from './Card';
import { CalendarEvent } from '../types';

interface SampleEventCardProps {
  event: CalendarEvent | null;
}

export function SampleEventCard({ event }: SampleEventCardProps) {
  return (
    <Card title="Sample Parsed Event" subtitle="Quick shape check for one parsed event object.">
      {event ? <pre className="sample-preview m-0 overflow-auto p-3">{JSON.stringify(event, null, 2)}</pre> : <p className="empty-state">Load a calendar to preview one event.</p>}
    </Card>
  );
}
