import { Card } from './Card';
import { CalendarInputRow } from '../types';

interface CalendarInputCardProps {
  rows: CalendarInputRow[];
  isLoading: boolean;
  disabled: boolean;
  saving: boolean;
  saveMessage: string;
  onSave: () => void;
  onAddRow: () => void;
  onRemoveRow: (id: string) => void;
  onChangeRow: (id: string, nextUrl: string) => void;
  onResolveRow: (id: string, pastedUrl?: string) => void;
}

export function CalendarInputCard({
  rows,
  isLoading,
  disabled,
  saving,
  saveMessage,
  onSave,
  onAddRow,
  onRemoveRow,
  onChangeRow,
  onResolveRow
}: CalendarInputCardProps) {
  return (
    <Card
      title="Manage calendars"
      subtitle="Add a public Apple calendar URL, or update and remove an existing calendar."
      actions={
        <button type="button" className="secondary-button" disabled={disabled || isLoading} onClick={onAddRow}>
          + Add Calendar
        </button>
      }
    >
      <form
        className="url-form"
        onSubmit={(event) => {
          event.preventDefault();
          onSave();
        }}
      >
        <div className="calendar-input-list">
          {rows.map((row, index) => (
            <article className="calendar-input-row" key={row.id}>
              <div className="calendar-input-row__header">
                <strong>Calendar {index + 1}</strong>
                  <button
                    type="button"
                    className="ghost-button"
                    disabled={disabled || isLoading} onClick={() => onRemoveRow(row.id)}
                    aria-label={`Remove calendar ${index + 1}`}
                  >
                    Remove
                  </button>
              </div>

              <label className="field">
                <span>Public calendar URL</span>
                <input
                  disabled={disabled || isLoading}
                  type="url"
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

              <div className="calendar-preview">
                <div>
                  <span className="calendar-preview__label">Calendar name</span>
                  <strong>
                    {row.isResolving
                      ? 'Detecting...'
                      : row.calendarName ?? (row.previewError ? 'Could not detect name' : 'Waiting for URL')}
                  </strong>
                </div>
                {row.previewError ? <p className="calendar-preview__error">{row.previewError}</p> : null}
              </div>
            </article>
          ))}
        </div>

        <button type="submit" disabled={disabled || isLoading || rows.some(row => row.isResolving)}>{saving ? 'Saving...' : 'Save calendars'}</button>
        <p className="hint">Changes, including removals, take effect when you save. This does not delete calendars from Apple.</p>
        {saveMessage && <p role="status">{saveMessage}</p>}
      </form>
    </Card>
  );
}
