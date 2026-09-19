import { CalendarDays, CircleGauge, Info, RefreshCcw } from 'lucide-react';

type View = 'dashboard' | 'details' | 'settings';
interface Props {
  view: View;
  onViewChange: (view: View) => void;
  onRefresh: () => void;
  refreshing: boolean;
  refreshDisabled: boolean;
}

const destinations = [
  { view: 'dashboard', label: 'Dashboard', icon: CircleGauge },
  { view: 'details', label: 'Details', icon: Info },
  { view: 'settings', label: 'Calendars', icon: CalendarDays },
] as const;

export function AppNavigation({ view, onViewChange, onRefresh, refreshing, refreshDisabled }: Props) {
  return <nav aria-label="Main navigation" className="app-navigation fixed inset-x-0 bottom-0 z-20 grid grid-cols-4 gap-2 rounded-t-3xl px-4 pt-3 pb-[calc(12px+env(safe-area-inset-bottom))] lg:sticky lg:inset-x-auto lg:bottom-auto lg:top-6 lg:z-10 lg:flex lg:flex-col lg:gap-2 lg:self-start lg:rounded-xl lg:p-3">
    {destinations.map(({ view: destination, label, icon: Icon }) => <button key={destination} type="button" aria-label={label} aria-current={view === destination ? 'page' : undefined} title={label} onClick={() => onViewChange(destination)} className="navigation-button flex min-h-14 w-full items-center justify-center gap-3 px-2 lg:justify-start lg:px-3">
      <Icon size={24} aria-hidden="true" className="shrink-0" />
      <span className="sr-only lg:not-sr-only">{label}</span>
    </button>)}
    <button type="button" aria-label={refreshing ? 'Refreshing calendars' : 'Refresh calendars'} title="Refresh calendars" disabled={refreshDisabled} onClick={onRefresh} className="navigation-button flex min-h-14 w-full items-center justify-center gap-3 px-2 lg:mt-6 lg:justify-start lg:border-0 lg:border-t lg:border-solid lg:border-line lg:rounded-t-none lg:px-3">
      <RefreshCcw size={24} aria-hidden="true" className={`shrink-0 ${refreshing ? 'motion-safe:animate-spin' : ''}`} />
      <span className="sr-only lg:not-sr-only">{refreshing ? 'Refreshing…' : 'Refresh'}</span>
    </button>
  </nav>;
}
