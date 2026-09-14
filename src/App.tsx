import { useMemo, useRef, useState } from 'react';
import { CalendarInputCard } from './components/CalendarInputCard';
import { EventListCard } from './components/EventListCard';
import { SampleEventCard } from './components/SampleEventCard';
import { StatusCard } from './components/StatusCard';
import { SummaryCard } from './components/SummaryCard';
import { CalendarEvent, CalendarInputRow, CalendarLoadItem, CalendarSummary, LoadMode, StatusTone } from './types';
import { loadCalendar, loadCalendarPreview, summarizeEvents } from './utils/calendar';

const EMPTY_SUMMARY: CalendarSummary = {
  totalCalendars: 0,
  totalEvents: 0,
  totalTrackedMinutes: 0,
  earliestStart: null,
  latestEnd: null
};

export default function App() {
  const nextRowId = useRef(2);
  const [calendarRows, setCalendarRows] = useState<CalendarInputRow[]>([
    {
      id: 'calendar-1',
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

  const summary = useMemo(() => summarizeEvents(events), [events]);

  function createEmptyRow(): CalendarInputRow {
    const id = `calendar-${nextRowId.current}`;
    nextRowId.current += 1;

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

  function updateRow(rowId: string, updater: (row: CalendarInputRow) => CalendarInputRow) {
    setCalendarRows((currentRows) => currentRows.map((row) => (row.id === rowId ? updater(row) : row)));
  }

  function handleAddRow() {
    setCalendarRows((currentRows) => [...currentRows, createEmptyRow()]);
  }

  function handleRemoveRow(rowId: string) {
    setCalendarRows((currentRows) => {
      const nextRows = currentRows.filter((row) => row.id !== rowId);
      return nextRows.length > 0 ? nextRows : [createEmptyRow()];
    });
  }

  function handleChangeRow(rowId: string, nextUrl: string) {
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

  async function handleResolveRow(rowId: string) {
    const targetRow = calendarRows.find((row) => row.id === rowId);
    const nextUrl = targetRow?.url.trim() ?? '';

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
    setIsLoading(true);
    setStatusTone('loading');
    setStatusMessage('Loading calendar feeds...');
    setLoadMode(null);

    try {
      const filledRows = calendarRows.filter((row) => row.url.trim());

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
      const message = error instanceof Error ? error.message : 'Unexpected calendar loading error.';

      setEvents([]);
      setCalendarLoads([]);
      setStatusTone('error');
      setStatusMessage(message);
      setLoadMode(null);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <p className="eyebrow">Local-first proof of concept</p>
        <h1>Time Snaps</h1>
        <p className="lede">
          Test whether one or more public iCloud calendar feeds can be converted from <code>webcal://</code>, fetched,
          parsed, and displayed as a basis for later time tracking and billing work.
        </p>
      </header>

      <div className="layout-grid">
        <CalendarInputCard
          rows={calendarRows}
          isLoading={isLoading}
          onAddRow={handleAddRow}
          onRemoveRow={handleRemoveRow}
          onChangeRow={handleChangeRow}
          onResolveRow={handleResolveRow}
          onSubmit={handleSubmit}
        />

        <StatusCard statusTone={statusTone} statusMessage={statusMessage} activeMode={loadMode} calendarLoads={calendarLoads} />
        <SummaryCard summary={events.length ? summary : EMPTY_SUMMARY} />
        <SampleEventCard event={events[0] ?? null} />
        <EventListCard events={events} />
      </div>
    </main>
  );
}
