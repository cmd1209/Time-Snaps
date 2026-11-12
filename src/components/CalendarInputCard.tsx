import { useId, useRef, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { colorPickerValue } from '../utils/calendarColor';
import { Card } from './Card';
import { CalendarTotals } from './CalendarTotals';
import { CalendarInputRow, SavedCalendar } from '../types';

interface CalendarInputCardProps {
  rows: CalendarInputRow[];
  savedCalendars: SavedCalendar[];
  refreshToken: number;
  disabled: boolean;
  pendingCalendar: { id: string; action: 'save' | 'remove' } | null;
  colorEnabled: boolean;
  rowMessages: Record<string, string>;
  onSave: (id: string) => void;
  onAddRow: () => void;
  onRemoveRow: (id: string) => void;
  onChangeRow: (id: string, nextUrl: string) => void;
  onChangeColor: (id: string, color: string | null) => void;
  onResolveRow: (id: string, pastedUrl?: string) => void;
}

export function CalendarInputCard({
  rows,
  savedCalendars,
  refreshToken,
  disabled,
  pendingCalendar,
  colorEnabled,
  rowMessages,
  onSave,
  onAddRow,
  onRemoveRow,
  onChangeRow,
  onChangeColor,
  onResolveRow
}: CalendarInputCardProps) {
  const removeDialog = useRef<HTMLDialogElement>(null);
  const [removal, setRemoval] = useState<{ id: string; name: string } | null>(null);
  const dialogId = useId();

  return (
    <Card
      title="Manage calendars"
      subtitle="Add a public Apple calendar URL, or update and remove an existing calendar."
      actions={
        <button type="button" className="secondary-button" disabled={disabled} onClick={onAddRow}>
          + Add Calendar
        </button>
      }
    >
      {!colorEnabled && <p className="hint" role="status">Custom color saving is not set up yet. Your chosen color will stay here while you finish the database setup.</p>}
      <div className="grid grid-cols-1 gap-3">
        {rows.map((row, index) => {
          const savedCalendar = savedCalendars.find(calendar => calendar.id === row.id);
          const heading = savedCalendar?.name ?? 'New calendar';
          const showNamePreview = !savedCalendar || row.isResolving || (row.calendarName && row.calendarName !== savedCalendar.name);
          return (
          <form className="calendar-input-row p-3.5" key={row.id} onSubmit={event => { event.preventDefault(); onSave(row.id); }}>
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <input type="color" className="h-9 w-9 shrink-0 cursor-pointer rounded border border-solid border-line bg-control p-1"
                  aria-label={`Color for ${row.calendarName ?? heading}`}
                  title={`Color for ${row.calendarName ?? heading}`}
                  disabled={disabled} value={colorPickerValue(row.color, index)}
                  onChange={event => onChangeColor(row.id, event.target.value)} />
                <h3 className="m-0 min-w-0 text-base font-semibold">{heading}</h3>
              </div>
                <button
                  type="button"
                  className="ghost-button flex min-h-11 min-w-11 shrink-0 items-center justify-center"
                  disabled={disabled} onClick={() => {
                    setRemoval({ id: row.id, name: savedCalendar?.name ?? row.calendarName ?? heading });
                    removeDialog.current?.showModal();
                  }}
                  aria-label={pendingCalendar?.id === row.id && pendingCalendar.action === 'remove' ? `Removing ${heading}` : `Remove ${heading}`}
                  title={`Remove ${heading}`}
                >
                  <Trash2 size={20} aria-hidden="true" />
                </button>
            </div>

            <label className="field grid grid-cols-1 gap-2">
              <span>Public calendar URL</span>
              <input
                disabled={disabled}
                type="url"
                required
                value={row.url}
                onChange={(inputEvent) => onChangeRow(row.id, inputEvent.target.value)}
                onPaste={event => {
                  const input = event.currentTarget;
                  window.setTimeout(() => onResolveRow(row.id, input.value), 0);
                }}
                onBlur={() => onResolveRow(row.id)}
                placeholder="webcal://..."
              />
            </label>

            <div className="calendar-preview mt-3 grid grid-cols-1 gap-2.5">
              {showNamePreview && <div>
                <span className="calendar-preview__label mb-1 block">Calendar name</span>
                <strong>
                  {row.isResolving
                    ? 'Detecting...'
                    : row.calendarName ?? (row.previewError ? 'Could not detect name' : 'Waiting for URL')}
                </strong>
              </div>}
              {row.previewError ? <p className="calendar-preview__error">{row.previewError}</p> : null}
            </div>
            <CalendarTotals url={row.normalizedUrl} refreshToken={refreshToken} />
            <div className="mt-4">
              <button type="submit" disabled={disabled || row.isResolving || !row.url.trim()}>
                {pendingCalendar?.id === row.id && pendingCalendar.action === 'save' ? 'Saving...' : 'Save calendar'}
              </button>
              {rowMessages[row.id] && <p role="status">{rowMessages[row.id]}</p>}
            </div>
          </form>
        );
        })}
      </div>

      <dialog ref={removeDialog} className="calendar-remove-dialog w-[min(420px,calc(100vw-48px))] p-6 [overflow-wrap:anywhere]"
        aria-labelledby={`${dialogId}-title`} aria-describedby={`${dialogId}-description`}
        onClose={() => setRemoval(null)}>
        <h2 id={`${dialogId}-title`} className="m-0 text-lg font-semibold">Remove calendar?</h2>
        <p id={`${dialogId}-description`} className="text-sm text-muted">Are you sure you want to remove <strong className="text-ink">{removal?.name}</strong> from Time Snaps? This will not delete it from Apple.</p>
        <div className="mt-5 flex flex-wrap justify-end gap-3">
          <button type="button" className="secondary-button" autoFocus onClick={() => removeDialog.current?.close()}>Cancel</button>
          <button type="button" disabled={disabled || !removal} onClick={() => {
            if (!removal || disabled) return;
            const rowId = removal.id;
            removeDialog.current?.close();
            onRemoveRow(rowId);
          }}>Remove calendar</button>
        </div>
      </dialog>
      <p className="hint">Save each calendar separately. Removing a calendar requires confirmation and does not delete it from Apple.</p>
    </Card>
  );
}
