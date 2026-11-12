import { useEffect, useState } from 'react';
import { loadCalendar } from '../utils/calendar';
import { timedMinutes } from '../utils/eventView';
import { formatMinutes } from '../utils/format';

interface Props {
  url: string | null;
  refreshToken: number;
}

interface Totals {
  url: string;
  refreshToken: number;
  attempt: number;
  count: number;
  minutes: number;
  error: string | null;
}

export function CalendarTotals({ url, refreshToken }: Props) {
  const [totals, setTotals] = useState<Totals | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    void loadCalendar(url).then(result => {
      if (!cancelled) setTotals({ url, refreshToken, attempt, count: result.events.length, minutes: timedMinutes(result.events), error: null });
    }).catch(error => {
      if (!cancelled) setTotals({ url, refreshToken, attempt, count: 0, minutes: 0, error: error instanceof Error ? error.message : 'Unable to load calendar.' });
    });
    return () => { cancelled = true; };
  }, [url, refreshToken, attempt]);

  const current = url && totals?.url === url && totals.refreshToken === refreshToken && totals.attempt === attempt ? totals : null;
  const available = current && !current.error;

  return <div className="mt-4" aria-label="Calendar totals" aria-busy={Boolean(url && !current)}>
    <dl className="overview-totals m-0 flex flex-wrap gap-8">
      <div><dt>Total time</dt><dd>{available ? formatMinutes(current.minutes) : '—'}</dd></div>
      <div><dt>Events</dt><dd>{available ? current.count : '—'}</dd></div>
    </dl>
    {current?.error ? <div role="alert" className="text-sm text-error">
      <p>Could not load totals. {current.error}</p>
      <button type="button" className="ghost-button" onClick={() => setAttempt(value => value + 1)}>Retry totals</button>
    </div> : <p className="hint" role="status">{!url ? 'Add a calendar URL to see totals.' : !current ? 'Loading calendar totals...' : 'All available events. Total time excludes all-day events.'}</p>}
  </div>;
}
