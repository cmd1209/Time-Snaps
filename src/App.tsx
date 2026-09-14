import { useEffect, useMemo, useRef, useState } from 'react';
import { Card } from './components/Card';
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
  const [settingsOpen, setSettingsOpen] = useState(false);
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
        setSettingsOpen(data.length === 0);
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

  return (
    <main className="app-shell">
      <header className="app-header viewer-header">
        <div><p className="eyebrow">Your time, at a glance</p><h1>Time Snaps</h1></div>
        <details className="account-menu">
          <summary>Account</summary>
          <div className="account-panel">
            <p>{email}</p>
            <button type="button" className="secondary-button" disabled={saving} onClick={() => void onLogout()}>Log out</button>
          </div>
        </details>
      </header>
      {logoutError && <p role="alert">{logoutError}</p>}

      <div className="layout-grid">
        <Card title={selectedCalendar?.name ?? 'Your calendars'}>
          <div className="calendar-toolbar">
            <label className="field">
              <span>Saved calendar</span>
              <select value={selectedCalendarId} disabled={restoring || saving || restoreFailed || !savedCalendars.length} onChange={event => setSelectedCalendarId(event.target.value)}>
                <option value="" disabled>{restoring ? 'Loading saved calendars...' : 'No saved calendars yet'}</option>
                {savedCalendars.map(calendar => <option key={calendar.id} value={calendar.id}>{calendar.name}</option>)}
              </select>
            </label>
            <button type="button" className="secondary-button" disabled={!selectedCalendarId || isLoading || saving || restoring || restoreFailed} onClick={() => {
              if (selectedCalendar) void loadRows([{ url: selectedCalendar.calendar_url }]);
            }}>{isLoading ? 'Refreshing...' : 'Refresh'}</button>
          </div>
          <div className="calendar-feedback" role="status">
            {restoring ? 'Loading saved calendars...' : isLoading ? 'Fetching the latest events...' : lastRefreshed ? `Last refreshed at ${lastRefreshed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : !savedCalendars.length && !restoreFailed ? 'Add your first calendar in settings below.' : null}
          </div>
          {statusTone === 'error' && <p className="calendar-preview__error" role="alert">{statusMessage}</p>}
          {restoreFailed && <div role="alert"><p>{saveMessage}</p><button type="button" onClick={() => setRestoreAttempt(n => n + 1)}>Retry saved calendars</button></div>}
        </Card>

        <details className="calendar-settings" open={settingsOpen} onToggle={event => setSettingsOpen(event.currentTarget.open)}>
          <summary>Calendar settings <span>Add, edit or remove calendars</span></summary>
          <CalendarInputCard
            rows={calendarRows} isLoading={isLoading} disabled={restoring || saving || restoreFailed}
            saving={saving} saveMessage={restoring ? 'Loading saved calendars...' : saveMessage}
            onSave={handleSave} onAddRow={handleAddRow} onRemoveRow={handleRemoveRow}
            onChangeRow={handleChangeRow} onResolveRow={handleResolveRow}
          />
        </details>

        {selectedCalendarId && <>
          <SummaryCard count={visibleEvents.length} minutes={timedMinutes(visibleEvents)} from={range.from} to={range.to} onRangeChange={(from, to) => setRange({ from, to })} />
          <EventListCard key={selectedCalendarId} events={visibleEvents} loading={isLoading} emptyMessage={statusTone === 'error' ? 'Events could not be loaded. Try refreshing this calendar.' : range.from && range.to && range.from > range.to ? 'Choose a valid date range above.' : events.length ? 'No events in this date range. Try All dates or choose another range.' : 'This calendar has no events to display.'} />
        </>}
      </div>
    </main>
  );
}
