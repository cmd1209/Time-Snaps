import { colorPickerValue } from '../utils/calendarColor';
import { Card } from './Card';
import { CalendarInputRow } from '../types';

interface CalendarInputCardProps {
  rows: CalendarInputRow[];
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
        {rows.map((row, index) => (
          <form className="calendar-input-row p-3.5" key={row.id} onSubmit={event => { event.preventDefault(); onSave(row.id); }}>
            <div className="mb-3 flex items-center justify-between gap-3">
              <strong>Calendar {index + 1}</strong>
                <button
                  type="button"
                  className="ghost-button"
                  disabled={disabled} onClick={() => onRemoveRow(row.id)}
                  aria-label={`Remove calendar ${index + 1}`}
                >
                  {pendingCalendar?.id === row.id && pendingCalendar.action === 'remove' ? 'Removing...' : 'Remove'}
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

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-sm">
                <span>Calendar color</span>
                <input type="color" className="h-9 w-12 cursor-pointer rounded border border-solid border-line bg-control p-1"
                  aria-label={`Color for ${row.calendarName ?? `Calendar ${index + 1}`}`}
                  disabled={disabled} value={colorPickerValue(row.color, index)}
                  onChange={event => onChangeColor(row.id, event.target.value)} />
              </label>
              <span className="text-xs text-muted">{row.color ?? 'Default palette'}</span>
              {row.color && <button type="button" className="ghost-button text-xs" disabled={disabled} onClick={() => onChangeColor(row.id, null)}>Use default</button>}
            </div>
            <div className="calendar-preview mt-3 grid grid-cols-1 gap-2.5">
              <div>
                <span className="calendar-preview__label mb-1 block">Calendar name</span>
                <strong>
                  {row.isResolving
                    ? 'Detecting...'
                    : row.calendarName ?? (row.previewError ? 'Could not detect name' : 'Waiting for URL')}
                </strong>
              </div>
              {row.previewError ? <p className="calendar-preview__error">{row.previewError}</p> : null}
            </div>
            <div className="mt-4">
              <button type="submit" disabled={disabled || row.isResolving || !row.url.trim()}>
                {pendingCalendar?.id === row.id && pendingCalendar.action === 'save' ? 'Saving...' : 'Save calendar'}
              </button>
              {rowMessages[row.id] && <p role="status">{rowMessages[row.id]}</p>}
            </div>
          </form>
        ))}
      </div>

      <p className="hint">Save each calendar separately. Remove takes effect immediately in Time Snaps and does not delete the calendar from Apple.</p>
    </Card>
  );
}
