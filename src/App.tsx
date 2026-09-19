import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, ChevronDown } from 'lucide-react';
import { AppNavigation } from './components/AppNavigation';
import { Dashboard } from './views/Dashboard';
import { supabase } from './lib/supabase';
import { AccountMenu } from './components/AccountMenu';
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
  const alive = useRef(true);
  const [restoring, setRestoring] = useState(true);
  const [restoreFailed, setRestoreFailed] = useState(false);
  const [colorEnabled, setColorEnabled] = useState(false);
  const [pendingCalendar, setPendingCalendar] = useState<{ id: string; action: 'save' | 'remove' } | null>(null);
  const saving = pendingCalendar !== null;
  const mutationPending = useRef(false);
  const [rowMessages, setRowMessages] = useState<Record<string, string>>({});
  const [saveMessage, setSaveMessage] = useState('');
  const [restoreAttempt, setRestoreAttempt] = useState(0);
  const [view, setView] = useState<'dashboard' | 'details' | 'settings'>('dashboard');
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
        let supportsColor = true;
        let result = await supabase!.from('calendars')
          .select('id,name,calendar_url,color').eq('user_id', userId).order('created_at');
        // Keep the existing app usable until the optional color migration is applied.
        if (result.error?.code === '42703' && result.error.message.includes('color')) {
          supportsColor = false;
          const fallback = await supabase!.from('calendars')
            .select('id,name,calendar_url').eq('user_id', userId).order('created_at');
          result = fallback.error ? fallback : { ...fallback, data: fallback.data.map(row => ({ ...row, color: null })) };
        }
        const { data, error } = result;
        if (cancelled) return;
        if (error) throw error;
        setColorEnabled(supportsColor);
        setSaveMessage('');
        setSavedCalendars(data);
        setSelectedCalendarId(data[0]?.id ?? '');
        setView(data.length === 0 ? 'settings' : 'dashboard');
        setCalendarRows(data.length ? data.map(row => ({
          ...createEmptyRow(), id: row.id, url: row.calendar_url,
          normalizedUrl: row.calendar_url, calendarName: row.name, color: row.color
        })) : [createEmptyRow()]);
      } catch (error) {
        if (cancelled) return;
        setRestoreFailed(true);
        setSaveMessage(error && typeof error === 'object' && 'message' in error ? String(error.message) : 'Could not load saved calendars. Please retry.');
      } finally { if (!cancelled) setRestoring(false); }
    }
    void restore();
    return () => { cancelled = true; };
  }, [userId, restoreAttempt]);
  const [calendarRows, setCalendarRows] = useState<CalendarInputRow[]>([
    {
      id: crypto.randomUUID(),
      color: null,
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

  // Metadata-only edits do not need to fetch the selected feed again.
  const selectedCalendarUrl = savedCalendars.find(calendar => calendar.id === selectedCalendarId)?.calendar_url;
  useEffect(() => {
    if (selectedCalendarUrl) void loadRows([{ url: selectedCalendarUrl }]);
    else {
      loadRequest.current += 1;
      setEvents([]);
      setLastRefreshed(null);
      setIsLoading(false);
      setStatusTone('idle');
      setStatusMessage('');
    }
  }, [selectedCalendarUrl, selectedCalendarId]);

  const visibleEvents = useMemo(() => filterEvents(events, range.from, range.to), [events, range]);
  const selectedCalendar = savedCalendars.find(calendar => calendar.id === selectedCalendarId);

  function createEmptyRow(): CalendarInputRow {
    const id = crypto.randomUUID();

    return {
      id,
      color: null,
      url: '',
      normalizedUrl: null,
      calendarName: null,
      previewMode: null,
      previewError: null,
      isResolving: false
    };
  }

  function setRowMessage(rowId: string, message: string) {
    setRowMessages(current => ({ ...current, [rowId]: message }));
  }

  async function handleSave(rowId: string) {
    const row = calendarRows.find(calendar => calendar.id === rowId);
    if (!row || mutationPending.current || restoring || restoreFailed || row.isResolving) return;
    mutationPending.current = true;
    setPendingCalendar({ id: rowId, action: 'save' });
    setRowMessage(rowId, '');
    try {
      const url = new URL(row.url.trim().replace(/^webcal:\/\//, 'https://'));
      if (url.protocol !== 'https:' || url.username || url.password || url.port ||
          !/^(?:p\d+-)?(?:calendars|caldav)\.icloud\.com$/.test(url.hostname) ||
          !url.pathname.startsWith('/published/') || url.search || url.hash) {
        throw new Error('Save only public Apple/iCloud sharing URLs.');
      }
      const calendar = { id: row.id, user_id: userId, name: row.calendarName ?? 'Unnamed Calendar', calendar_url: url.href, color: row.color };
      let canSaveColor = colorEnabled;
      if (!canSaveColor && row.color !== null) {
        // Retry after the SQL update without losing the user's unsaved color.
        const { error } = await supabase!.from('calendars').select('color').limit(0);
        if (error) {
          if (error.code === '42703' || error.code === 'PGRST204') {
            throw new Error('Custom colors need the database update first. Run 002_calendar_color.sql in Supabase, then save this calendar again.');
          }
          throw error;
        }
        if (!alive.current) return;
        canSaveColor = true;
        setColorEnabled(true);
      }
      const { color: _color, ...withoutColor } = calendar;
      const query = supabase!.from('calendars')
        .upsert(canSaveColor ? calendar : withoutColor, { onConflict: 'id' });
      const { data, error } = await (canSaveColor
        ? query.select('id,name,calendar_url,color').single()
        : query.select('id,name,calendar_url').single());
      if (error) throw error;
      if (!alive.current) return;
      const saved: SavedCalendar = { ...data, color: 'color' in data ? data.color as string | null : null };
      setSavedCalendars(current => current.some(item => item.id === rowId)
        ? current.map(item => item.id === rowId ? saved : item)
        : [...current, saved]);
      setSelectedCalendarId(current => current || rowId);
      setRowMessage(rowId, 'Calendar saved.');
    } catch (error) {
      if (alive.current) setRowMessage(rowId, `Not saved. ${error && typeof error === 'object' && 'message' in error ? String(error.message) : 'Please retry.'} Your edits are still here.`);
    } finally {
      mutationPending.current = false;
      if (alive.current) setPendingCalendar(null);
    }
  }

  function updateRow(rowId: string, updater: (row: CalendarInputRow) => CalendarInputRow) {
    setCalendarRows((currentRows) => currentRows.map((row) => (row.id === rowId ? updater(row) : row)));
  }

  function handleAddRow() {
    setCalendarRows(currentRows => [...currentRows, createEmptyRow()]);
  }

  async function handleRemoveRow(rowId: string) {
    if (mutationPending.current || restoring || restoreFailed) return;
    mutationPending.current = true;
    setPendingCalendar({ id: rowId, action: 'remove' });
    setRowMessage(rowId, '');
    try {
      if (savedCalendars.some(calendar => calendar.id === rowId)) {
        const { error } = await supabase!.from('calendars').delete().eq('user_id', userId).eq('id', rowId);
        if (error) throw error;
      }
      if (!alive.current) return;
      const remaining = savedCalendars.filter(calendar => calendar.id !== rowId);
      setSavedCalendars(remaining);
      setSelectedCalendarId(current => current === rowId ? remaining[0]?.id ?? '' : current);
      setCalendarRows(current => {
        const next = current.filter(row => row.id !== rowId);
        return next.length ? next : [createEmptyRow()];
      });
    } catch (error) {
      if (alive.current) setRowMessage(rowId, `Could not remove calendar. ${error && typeof error === 'object' && 'message' in error ? String(error.message) : 'Please retry.'}`);
    } finally {
      mutationPending.current = false;
      if (alive.current) setPendingCalendar(null);
    }
  }

  function handleChangeColor(rowId: string, color: string | null) {
    if (color !== null && !/^#[0-9a-f]{6}$/i.test(color)) return;
    setRowMessage(rowId, 'Unsaved changes.');
    updateRow(rowId, row => ({ ...row, color }));
  }

  function handleChangeRow(rowId: string, nextUrl: string) {
    setRowMessage(rowId, 'Unsaved changes.');
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

    if (targetRow?.normalizedUrl && !targetRow.previewError && nextUrl.replace(/^webcal:\/\//, 'https://') === targetRow.normalizedUrl) return;
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
    <div className="min-h-screen text-ink">
      <a href="#main-content" className="skip-link">Skip to content</a>
      <header className="mx-auto grid max-w-[1240px] grid-cols-1 gap-5 px-4 pb-6 pt-4 lg:grid-cols-[1fr_auto] lg:items-center lg:px-6 lg:pt-8">
        <img src="/assets/logo.svg" className="mx-auto h-[49px] w-[152px] lg:order-2 lg:mx-0" alt="Time Snaps — Your time at a glance" />
        <div className="flex min-w-0 items-center justify-between gap-4 lg:justify-start">
          <p className="m-0 min-w-0 text-2xl font-light tracking-tight lg:order-2">Hi, <strong className="font-semibold [overflow-wrap:anywhere]">{email.split('@')[0] || 'there'}</strong></p>
          <AccountMenu key={userId} userId={userId} email={email} disabled={saving} onLogout={onLogout} />
        </div>
      </header>
      <div className="mx-auto grid max-w-[1240px] grid-cols-1 gap-4 px-4 lg:grid-cols-[184px_minmax(0,1fr)] lg:gap-6 lg:px-6">
        <AppNavigation view={view} onViewChange={setView} onRefresh={refreshCalendars} refreshing={isLoading} refreshDisabled={!selectedCalendarId || isLoading || saving || restoring || restoreFailed} />
        <main id="main-content" tabIndex={-1} className="min-w-0 pb-[calc(112px+env(safe-area-inset-bottom))] lg:pb-12 [overflow-wrap:anywhere]">
          <div className="mb-4 flex min-w-0 flex-wrap items-center justify-between gap-3">
            <label className="header-calendar relative flex min-w-0 w-fit max-w-full items-center gap-2 px-0.5 py-1.5">
              <CalendarDays size={24} aria-hidden="true" />
              <span className="sr-only">Selected calendar</span>
              <span className="relative min-w-0 max-w-[min(360px,calc(100vw-100px))]">
                {/* Size the native select from its selected label, not its widest option. */}
                <span aria-hidden="true" className="invisible block overflow-hidden whitespace-nowrap pr-7">
                  {selectedCalendar?.name ?? (restoring ? 'Loading calendars...' : 'No saved calendars')}
                </span>
                <select className="absolute inset-0 h-full min-w-0 w-full" value={selectedCalendarId} disabled={restoring || saving || restoreFailed || !savedCalendars.length} onChange={event => setSelectedCalendarId(event.target.value)}>
                  <option value="" disabled>{restoring ? 'Loading calendars...' : 'No saved calendars'}</option>
                  {savedCalendars.map(calendar => <option value={calendar.id} key={calendar.id}>{calendar.name}</option>)}
                </select>
              </span>
              <ChevronDown size={24} aria-hidden="true" className="absolute right-0.5 pointer-events-none" />
            </label>
          </div>
          {logoutError && <p role="alert" className="text-sm text-error">{logoutError}</p>}
          {restoreFailed && <div role="alert" className="mb-4"><p>{saveMessage}</p><button type="button" onClick={() => setRestoreAttempt(n => n + 1)}>Retry saved calendars</button></div>}
          {statusTone === 'error' && <p className="mb-4 text-sm text-error" role="alert">{statusMessage}</p>}

          <div role="status" className="mb-4 text-xs text-muted">
            {restoring ? 'Loading saved calendars...' : isLoading ? 'Fetching the latest events...' : lastRefreshed ? `Last refreshed at ${lastRefreshed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : null}
          </div>
          <div hidden={view !== 'dashboard'}>
            <Dashboard calendars={savedCalendars} selectedId={selectedCalendarId} events={events} loading={isLoading} failed={statusTone === 'error'} refreshToken={refreshToken} />
          </div>

          <section hidden={view !== 'details'} aria-labelledby="details-heading">
            <h2 id="details-heading" className="mb-4 mt-0 text-lg font-medium">Details</h2>
            {selectedCalendarId ? <div className="grid min-w-0 grid-cols-1 gap-4" aria-label="Selected calendar events">
              <div><h2 className="m-0 text-lg font-medium">Calendar events</h2><p className="m-0 mt-1 text-sm text-muted">{selectedCalendar?.name} · Date filters below apply to this event list.</p></div>
              <SummaryCard count={visibleEvents.length} minutes={timedMinutes(visibleEvents)} from={range.from} to={range.to} onRangeChange={(from, to) => setRange({ from, to })} />
              <EventListCard key={selectedCalendarId} events={visibleEvents} loading={isLoading} emptyMessage={statusTone === 'error' ? 'Events could not be loaded. Try refreshing this calendar.' : range.from && range.to && range.from > range.to ? 'Choose a valid date range above.' : events.length ? 'No events in this date range. Try All dates or choose another range.' : 'This calendar has no events to display.'} />
            </div> : <p className="py-8 text-sm text-muted">Save a calendar in Calendar Settings to see its details.</p>}
          </section>

          <section hidden={view !== 'settings'} aria-label="Calendar settings">
            <h2 className="mb-5 mt-0 text-lg font-medium">Calendar Settings</h2>
            <CalendarInputCard
              rows={calendarRows} disabled={restoring || saving || restoreFailed}
              pendingCalendar={pendingCalendar} colorEnabled={restoring || colorEnabled} rowMessages={rowMessages}
              onSave={handleSave} onAddRow={handleAddRow} onRemoveRow={handleRemoveRow}
              onChangeRow={handleChangeRow} onChangeColor={handleChangeColor} onResolveRow={handleResolveRow}
            />
            {selectedCalendarId && <button type="button" className="secondary-button mt-4" onClick={() => setView('dashboard')}>Back to Dashboard</button>}
          </section>
        </main>
      </div>
    </div>
  );
}
