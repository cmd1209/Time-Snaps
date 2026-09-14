import { Card } from './Card';
import { CalendarInputRow } from '../types';

interface CalendarInputCardProps {
  rows: CalendarInputRow[];
  isLoading: boolean;
  onAddRow: () => void;
  onRemoveRow: (id: string) => void;
  onChangeRow: (id: string, nextUrl: string) => void;
  onResolveRow: (id: string) => void;
  onSubmit: () => void;
}

export function CalendarInputCard({
  rows,
  isLoading,
  onAddRow,
  onRemoveRow,
  onChangeRow,
  onResolveRow,
  onSubmit
}: CalendarInputCardProps) {
  return (
    <Card
      title="Calendar URLs"
      subtitle="Paste one public calendar URL per field. The app will normalize webcal to https and try to detect the calendar name."
      actions={
        <button type="button" className="secondary-button" onClick={onAddRow}>
          + Add Calendar
        </button>
      }
    >
      <form
        className="url-form"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <div className="calendar-input-list">
          {rows.map((row, index) => (
            <article className="calendar-input-row" key={row.id}>
              <div className="calendar-input-row__header">
                <strong>Calendar {index + 1}</strong>
                {rows.length > 1 ? (
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => onRemoveRow(row.id)}
                    aria-label={`Remove calendar ${index + 1}`}
                  >
                    Remove
                  </button>
                ) : null}
              </div>

              <label className="field">
                <span>Public calendar URL</span>
                <input
                  type="url"
                  value={row.url}
                  onChange={(inputEvent) => onChangeRow(row.id, inputEvent.target.value)}
                  onPaste={() => {
                    window.setTimeout(() => onResolveRow(row.id), 0);
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
                <div>
                  <span className="calendar-preview__label">Normalized URL</span>
                  <code>{row.normalizedUrl ?? 'Not normalized yet'}</code>
                </div>
                {row.previewError ? <p className="calendar-preview__error">{row.previewError}</p> : null}
              </div>
            </article>
          ))}
        </div>

        <button type="submit" disabled={isLoading}>
          {isLoading ? 'Loading...' : 'Load Calendars'}
        </button>
      </form>
    </Card>
  );
}
