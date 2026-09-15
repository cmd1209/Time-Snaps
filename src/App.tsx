import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, CircleGauge, Settings, RefreshCcw, LogOut } from 'lucide-react';
import { Dashboard } from './views/Dashboard';
import { supabase } from './lib/supabase';
import { CalendarInputCard } from './components/CalendarInputCard';
import { EventListCard } from './components/EventListCard';
import { SummaryCard } from './components/SummaryCard';
import { CalendarEvent, CalendarInputRow, CalendarLoadItem, StatusTone, SavedCalendar } from './types';
import { filterEvents, timedMinutes } from './utils/eventView';
import { loadCalendar, loadCalendarPreview } from './utils/calendar';

interface AppProps { userId: string; email: string; onLogout: () => Promise<void>; logoutError: string }

export default function App({ userId, email, onLogout, logoutError }: AppProps) {
  const [savedCalendars, setSavedCalendars] = useState<SavedCalendar[]>([]);
  const [selectedCalendarId, setSelectedCalendarId] = useState('');
  const loadRequest = useRef(0);
  const savedIds = useRef<string[]>([]);
  const alive = useRef(true);
  const [restoring, setRestoring] = useState(true);
  const [restoreFailed, setRestoreFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [restoreAttempt, setRestoreAttempt] = useState(0);
  const [view, setView] = useState<'dashboard' | 'settings'>('dashboard');
  const [refreshToken, setRefreshToken] = useState(0);
  const [range, setRange] = useState({ from: '', to: '' });
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; loadRequest.current += 1; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function restore() {
      setRestoring(true);
      setRestoreFailed(false);
      try {
        const { data, error } = await supabase!.from('calendars')
          .select('id,name,calendar_url').eq('user_id', userId).order('created_at');
        if (cancelled) return;
        if (error) throw error;
        setSaveMessage('');
        setSavedCalendars(data);
        setSelectedCalendarId(data[0]?.id ?? '');
        setView(data.length === 0 ? 'settings' : 'dashboard');
        savedIds.current = data.map(row => row.id);
        setCalendarRows(data.length ? data.map(row => ({
          ...createEmptyRow(), id: row.id, url: row.calendar_url,
          normalizedUrl: row.calendar_url, calendarName: row.name
        })) : [createEmptyRow()]);
      } catch (error) {
        if (cancelled) return;
        setRestoreFailed(true);
        setSaveMessage(error instanceof Error ? error.message : 'Could not load saved calendars. Please retry.');
      } finally { if (!cancelled) setRestoring(false); }
    }
    void restore();
    return () => { cancelled = true; };
  }, [userId, restoreAttempt]);
  const [calendarRows, setCalendarRows] = useState<CalendarInputRow[]>([
    {
      id: crypto.randomUUID(),
      url: '',
      normalizedUrl: null,
      calendarName: null,
      previewMode: null,
      previewError: null,
      isResolving: false
    }
  ]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [statusTone, setStatusTone] = useState<StatusTone>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Restore the first saved calendar automatically; selecting another fetches its events.
  useEffect(() => {
    const selected = savedCalendars.find(calendar => calendar.id === selectedCalendarId);
    if (selected) void loadRows([{ url: selected.calendar_url }]);
  }, [savedCalendars, selectedCalendarId]);

  const visibleEvents = useMemo(() => filterEvents(events, range.from, range.to), [events, range]);
  const selectedCalendar = savedCalendars.find(calendar => calendar.id === selectedCalendarId);

  function createEmptyRow(): CalendarInputRow {
    const id = crypto.randomUUID();

    return {
      id,
      url: '',
      normalizedUrl: null,
      calendarName: null,
      previewMode: null,
      previewError: null,
      isResolving: false
    };
  }

  async function handleSave() {
    if (saving || restoring || restoreFailed || isLoading || calendarRows.some(row => row.isResolving)) return;
    setSaving(true);
    setSaveMessage('');
    try {
      const rows = calendarRows.filter(row => row.url.trim()).map(row => {
        const url = new URL(row.url.trim().replace(/^webcal:\/\//, 'https://'));
        if (url.protocol !== 'https:' || url.username || url.password || url.port ||
            !/^(?:p\d+-)?(?:calendars|caldav)\.icloud\.com$/.test(url.hostname) ||
            !url.pathname.startsWith('/published/') || url.search || url.hash) {
          throw new Error('Save only public Apple/iCloud sharing URLs.');
        }
        return { id: row.id, user_id: userId, name: row.calendarName ?? 'Unnamed Calendar', calendar_url: url.href };
      });
      const remaining = new Set(rows.map(row => row.id));
      const removed = savedIds.current.filter(id => !remaining.has(id));
      // Save first so a failed write never deletes existing calendars. Stable IDs make retries safe.
      if (rows.length) {
        const { error } = await supabase!.from('calendars').upsert(rows, { onConflict: 'id' });
        if (error) throw error;
        savedIds.current = [...new Set([...savedIds.current, ...remaining])];
      }
      if (!alive.current) return;
      if (removed.length) {
        const { error } = await supabase!.from('calendars').delete().eq('user_id', userId).in('id', removed);
        if (error) throw error;
      }
      if (!alive.current) return;
      savedIds.current = [...remaining];
      setSavedCalendars(rows);
      setSelectedCalendarId(current => remaining.has(current) ? current : rows[0]?.id ?? '');
      if (!rows.length) {
        loadRequest.current += 1;
        setEvents([]);
        setLastRefreshed(null);
        setIsLoading(false);
        setStatusTone('idle');
        setStatusMessage('No saved calendars. Add a public calendar URL to get started.');
      }
      setSaveMessage(`Saved ${rows.length} calendar(s).`);
    } catch (error) {
      if (alive.current) setSaveMessage(`Save incomplete. ${error instanceof Error ? error.message : 'Please retry.'} Your edits are still here; retry Save Calendars.`);
    } finally { if (alive.current) setSaving(false); }
  }

  function updateRow(rowId: string, updater: (row: CalendarInputRow) => CalendarInputRow) {
    setCalendarRows((currentRows) => currentRows.map((row) => (row.id === rowId ? updater(row) : row)));
  }

  function handleAddRow() {
    setSaveMessage('Unsaved changes.');
    setCalendarRows((currentRows) => [...currentRows, createEmptyRow()]);
  }

  function handleRemoveRow(rowId: string) {
    setSaveMessage('Unsaved changes.');
    setCalendarRows((currentRows) => {
      const nextRows = currentRows.filter((row) => row.id !== rowId);
      return nextRows.length > 0 ? nextRows : [createEmptyRow()];
    });
  }

  function handleChangeRow(rowId: string, nextUrl: string) {
    setSaveMessage('Unsaved changes.');
    updateRow(rowId, (row) => ({
      ...row,
      url: nextUrl,
      normalizedUrl: null,
      calendarName: null,
      previewMode: null,
      previewError: null,
      isResolving: false
    }));
  }

  async function handleResolveRow(rowId: string, pastedUrl?: string) {
    const targetRow = calendarRows.find((row) => row.id === rowId);
    const nextUrl = (pastedUrl ?? targetRow?.url ?? '').trim();

    if (!nextUrl) {
      updateRow(rowId, (row) => ({
        ...row,
        normalizedUrl: null,
        calendarName: null,
        previewMode: null,
        previewError: null,
        isResolving: false
      }));
      return;
    }

    updateRow(rowId, (row) => ({
      ...row,
      isResolving: true,
      previewError: null
    }));

    try {
      const preview = await loadCalendarPreview(nextUrl);

      setCalendarRows((currentRows) =>
        currentRows.map((row) => {
          // Ignore stale responses after the user edits the field again.
          if (row.id !== rowId || row.url.trim() !== nextUrl) {
            return row;
          }

          return {
            ...row,
            normalizedUrl: preview.normalizedUrl,
            calendarName: preview.calendarName,
            previewMode: preview.mode,
            previewError: null,
            isResolving: false
          };
        })
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not resolve calendar details.';

      setCalendarRows((currentRows) =>
        currentRows.map((row) => {
          if (row.id !== rowId || row.url.trim() !== nextUrl) {
            return row;
          }

          return {
            ...row,
            normalizedUrl: null,
            calendarName: null,
            previewMode: null,
            previewError: message,
            isResolving: false
          };
        })
      );
    }
  }

  async function loadRows(rows: { url: string }[]) {
    const requestId = ++loadRequest.current;
    const isCurrent = () => alive.current && requestId === loadRequest.current;
    setEvents([]);
    setIsLoading(true);
    setStatusTone('loading');
    setStatusMessage('Loading calendar feeds...');
    setLastRefreshed(null);

    try {
      const filledRows = rows.filter((row) => row.url.trim());

      if (filledRows.length === 0) {
        throw new Error('Paste at least one public iCloud calendar URL first.');
      }

      const results = await Promise.all(
        filledRows.map(async (row): Promise<CalendarLoadItem> => {
          try {
            const result = await loadCalendar(row.url);
            return {
              sourceUrl: result.sourceUrl,
              normalizedUrl: result.normalizedUrl,
              calendarName: result.calendarName,
              events: result.events,
              mode: result.mode,
              error: null
            };
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Unexpected calendar loading error.';
            return {
              sourceUrl: row.url,
              normalizedUrl: row.url,
              calendarName: null,
              events: [],
              mode: null,
              error: message
            };
          }
        })
      );

      if (!isCurrent()) return;
      const nextEvents = results.flatMap((result) => result.events);
      const successfulLoads = results.filter((result) => !result.error);
      const failedLoads = results.length - successfulLoads.length;

      setEvents(nextEvents);

      if (successfulLoads.length === 0) {
        setStatusTone('error');
        setStatusMessage(results[0]?.error ?? 'Unable to load this calendar. Please try refreshing.');
        return;
      }

      setLastRefreshed(new Date());
      setStatusTone(failedLoads > 0 ? 'error' : 'success');
      setStatusMessage(
        failedLoads > 0
          ? `Loaded ${successfulLoads.length} calendar(s); ${failedLoads} failed.`
          : `Loaded ${successfulLoads.length} calendar(s) and ${nextEvents.length} event(s) successfully.`
      );
    } catch (error) {
      if (!isCurrent()) return;
      const message = error instanceof Error ? error.message : 'Unexpected calendar loading error.';

      setEvents([]);
      setStatusTone('error');
      setStatusMessage(message);
      setLastRefreshed(null);
    } finally {
      if (isCurrent()) setIsLoading(false);
    }
  }

  function refreshCalendars() {
    if (!selectedCalendar || isLoading) return;
    setRefreshToken(value => value + 1);
    void loadRows([{ url: selectedCalendar.calendar_url }]);
  }

  return (
    <div className="min-h-screen bg-white text-zinc-950">
      <header className="bg-dashboard-header text-white">
        <div className="mx-auto max-w-[1240px] px-5 pb-4 pt-6 sm:pt-8">
          <div className="flex items-start justify-between gap-4">
            <div><h1 className="m-0 text-2xl font-semibold tracking-tight sm:text-3xl">Time Snaps</h1><p className="m-0 mt-1 text-sm">Your time, at a glance</p></div>
            <details className="relative shrink-0">
              <summary className="flex size-9 list-none items-center justify-center rounded-full bg-cyan-100 text-sm font-medium text-cyan-700 [&::-webkit-details-marker]:hidden" aria-label="Account menu">{email.slice(0, 1).toUpperCase() || 'A'}</summary>
              <div className="account-panel text-ink">
                <p>{email}</p>
                <button type="button" className="secondary-button flex items-center gap-2" disabled={saving} onClick={() => void onLogout()}><LogOut size={16} aria-hidden="true" />Log out</button>
              </div>
            </details>
          </div>
          <nav className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3 text-sm" aria-label="Calendar navigation">
            <label className="flex max-w-full min-w-0 items-center gap-2">
              <CalendarDays size={18} aria-hidden="true" className="shrink-0" />
              <span className="sr-only">Selected calendar</span>
              <select className="max-w-[min(70vw,320px)] min-w-0 cursor-pointer border-0 bg-transparent py-2 text-sm text-white" value={selectedCalendarId} disabled={restoring || saving || restoreFailed || !savedCalendars.length} onChange={event => setSelectedCalendarId(event.target.value)}>
                <option value="" disabled className="bg-white text-zinc-900">{restoring ? 'Loading calendars...' : 'No saved calendars'}</option>
                {savedCalendars.map(calendar => <option className="bg-white text-zinc-900" value={calendar.id} key={calendar.id}>{calendar.name}</option>)}
              </select>
            </label>
            <button type="button" onClick={() => setView('dashboard')} aria-current={view === 'dashboard' ? 'page' : undefined} className={`flex items-center gap-2 rounded-md px-2 py-2 text-sm text-white hover:bg-white/15 ${view === 'dashboard' ? 'bg-white/15' : 'bg-transparent'}`}><CircleGauge size={18} aria-hidden="true" />Dashboard</button>
            <button type="button" onClick={() => setView('settings')} aria-current={view === 'settings' ? 'page' : undefined} className={`flex items-center gap-2 rounded-md px-2 py-2 text-sm text-white hover:bg-white/15 ${view === 'settings' ? 'bg-white/15' : 'bg-transparent'}`}><Settings size={18} aria-hidden="true" />Calendar Settings</button>
            <button type="button" onClick={refreshCalendars} disabled={!selectedCalendarId || isLoading || saving || restoring || restoreFailed} className="flex items-center gap-2 rounded-md bg-transparent px-2 py-2 text-sm text-white hover:bg-white/15"><RefreshCcw size={18} aria-hidden="true" className={isLoading ? 'motion-safe:animate-spin' : ''} />{isLoading ? 'Refreshing...' : 'Refresh'}</button>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-[1240px] px-5 pb-16 pt-6 [overflow-wrap:anywhere]">
        {logoutError && <p role="alert" className="text-sm text-red-700">{logoutError}</p>}
        {restoreFailed && <div role="alert" className="mb-4"><p>{saveMessage}</p><button type="button" onClick={() => setRestoreAttempt(n => n + 1)}>Retry saved calendars</button></div>}
        {statusTone === 'error' && <p className="mb-4 text-sm text-red-700" role="alert">{statusMessage}</p>}
        <div role="status" className="mb-4 text-xs text-zinc-500">
          {restoring ? 'Loading saved calendars...' : isLoading ? 'Fetching the latest events...' : lastRefreshed ? `Last refreshed at ${lastRefreshed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : null}
        </div>

        <div hidden={view !== 'dashboard'}>
          <Dashboard calendars={savedCalendars} selectedId={selectedCalendarId} events={events} loading={isLoading} failed={statusTone === 'error'} refreshToken={refreshToken} />
          {selectedCalendarId && <section className="mt-12 grid min-w-0 grid-cols-1 gap-4" aria-label="Selected calendar events">
            <div><h2 className="m-0 text-lg font-medium">Calendar events</h2><p className="m-0 mt-1 text-sm text-zinc-500">{selectedCalendar?.name} · Date filters below apply to this event list.</p></div>
            <SummaryCard count={visibleEvents.length} minutes={timedMinutes(visibleEvents)} from={range.from} to={range.to} onRangeChange={(from, to) => setRange({ from, to })} />
            <EventListCard key={selectedCalendarId} events={visibleEvents} loading={isLoading} emptyMessage={statusTone === 'error' ? 'Events could not be loaded. Try refreshing this calendar.' : range.from && range.to && range.from > range.to ? 'Choose a valid date range above.' : events.length ? 'No events in this date range. Try All dates or choose another range.' : 'This calendar has no events to display.'} />
          </section>}
        </div>

        <section hidden={view !== 'settings'} aria-label="Calendar settings">
          <h2 className="mb-5 mt-0 text-lg font-medium">Calendar Settings</h2>
          <CalendarInputCard
            rows={calendarRows} isLoading={isLoading} disabled={restoring || saving || restoreFailed}
            saving={saving} saveMessage={restoring ? 'Loading saved calendars...' : saveMessage}
            onSave={handleSave} onAddRow={handleAddRow} onRemoveRow={handleRemoveRow}
            onChangeRow={handleChangeRow} onResolveRow={handleResolveRow}
          />
          {selectedCalendarId && <button type="button" className="secondary-button mt-4" onClick={() => setView('dashboard')}>Back to Dashboard</button>}
        </section>
      </main>
    </div>
  );
}
