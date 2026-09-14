import { useEffect, useMemo, useRef, useState } from 'react';
import { Card } from './components/Card';
import { supabase } from './lib/supabase';
import { CalendarInputCard } from './components/CalendarInputCard';
import { EventListCard } from './components/EventListCard';
import { SampleEventCard } from './components/SampleEventCard';
import { StatusCard } from './components/StatusCard';
import { SummaryCard } from './components/SummaryCard';
import { CalendarEvent, CalendarInputRow, CalendarLoadItem, CalendarSummary, LoadMode, StatusTone, SavedCalendar } from './types';
import { loadCalendar, loadCalendarPreview, summarizeEvents } from './utils/calendar';

const EMPTY_SUMMARY: CalendarSummary = {
  totalCalendars: 0,
  totalEvents: 0,
  totalTrackedMinutes: 0,
  earliestStart: null,
  latestEnd: null
};

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
  const [calendarLoads, setCalendarLoads] = useState<CalendarLoadItem[]>([]);
  const [statusTone, setStatusTone] = useState<StatusTone>('idle');
  const [statusMessage, setStatusMessage] = useState('Paste a public iCloud calendar URL to detect its name, then load calendars.');
  const [loadMode, setLoadMode] = useState<LoadMode | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Restore the first saved calendar automatically; selecting another fetches its events.
  useEffect(() => {
    const selected = savedCalendars.find(calendar => calendar.id === selectedCalendarId);
    if (selected) void loadRows([{ url: selected.calendar_url }]);
  }, [savedCalendars, selectedCalendarId]);

  const summary = useMemo(() => summarizeEvents(events), [events]);

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
    if (saving || restoring || restoreFailed) return;
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
        setCalendarLoads([]);
        setLoadMode(null);
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

  async function handleSubmit() {
    if (isLoading || saving || restoring || restoreFailed) return;
    setSelectedCalendarId('');
    await loadRows(calendarRows);
  }

  async function loadRows(rows: { url: string }[]) {
    const requestId = ++loadRequest.current;
    const isCurrent = () => alive.current && requestId === loadRequest.current;
    setEvents([]);
    setCalendarLoads([]);
    setIsLoading(true);
    setStatusTone('loading');
    setStatusMessage('Loading calendar feeds...');
    setLoadMode(null);

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

      setCalendarLoads(results);
      setEvents(nextEvents);
      setLoadMode(successfulLoads.length === 1 ? successfulLoads[0].mode : null);

      if (successfulLoads.length === 0) {
        setStatusTone('error');
        setStatusMessage(`All ${results.length} calendar load(s) failed.`);
        return;
      }

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
      setCalendarLoads([]);
      setStatusTone('error');
      setStatusMessage(message);
      setLoadMode(null);
    } finally {
      if (isCurrent()) setIsLoading(false);
    }
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <p className="eyebrow">Public calendar viewer</p>
        <h1>Time Snaps</h1>
        <p className="lede">
          Test whether one or more public iCloud calendar feeds can be converted from <code>webcal://</code>, fetched,
          parsed, and displayed as a basis for later time tracking and billing work.
        </p>
        <p>Signed in as {email}</p>
        <button type="button" className="secondary-button" disabled={saving} onClick={() => void onLogout()}>Log out</button>
        {logoutError && <p role="alert">{logoutError}</p>}
      </header>

      <div className="layout-grid">
        <Card title="Saved calendars" subtitle="Choose a calendar to view its events.">
          <div className="url-form">
            <label className="field">
              <span>Calendar</span>
              <select
                value={selectedCalendarId}
                disabled={restoring || saving || restoreFailed || !savedCalendars.length}
                onChange={event => setSelectedCalendarId(event.target.value)}
              >
                <option value="" disabled>{restoring ? 'Loading saved calendars...' : savedCalendars.length ? 'Select a saved calendar' : 'No saved calendars yet'}</option>
                {savedCalendars.map(calendar => <option key={calendar.id} value={calendar.id}>{calendar.name}</option>)}
              </select>
            </label>
            <button type="button" className="secondary-button" disabled={!selectedCalendarId || isLoading || saving || restoring || restoreFailed} onClick={() => {
              const selected = savedCalendars.find(calendar => calendar.id === selectedCalendarId);
              if (selected) void loadRows([{ url: selected.calendar_url }]);
            }}>{isLoading && selectedCalendarId ? 'Loading events...' : 'Refresh selected calendar'}</button>
          </div>
        </Card>
        <CalendarInputCard
          rows={calendarRows}
          isLoading={isLoading}
          disabled={restoring || saving || restoreFailed}
          saving={saving}
          saveMessage={restoring ? 'Loading saved calendars...' : saveMessage}
          onSave={handleSave}
          onAddRow={handleAddRow}
          onRemoveRow={handleRemoveRow}
          onChangeRow={handleChangeRow}
          onResolveRow={handleResolveRow}
          onSubmit={handleSubmit}
        />

        {restoreFailed && <button type="button" onClick={() => setRestoreAttempt(n => n + 1)}>Retry saved calendars</button>}
        <StatusCard statusTone={statusTone} statusMessage={statusMessage} activeMode={loadMode} calendarLoads={calendarLoads} />
        <SummaryCard summary={events.length ? summary : EMPTY_SUMMARY} />
        <SampleEventCard event={events[0] ?? null} />
        <EventListCard events={events} />
      </div>
    </main>
  );
}
