import type { CalendarEvent } from '../types';

export interface DashboardMonth { key: string; label: string; fullLabel: string }

export function dashboardMonths(now: Date, count = 6): DashboardMonth[] {
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - count + 1 + index, 1);
    return {
      key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
      label: date.toLocaleDateString(undefined, { month: 'short' }),
      fullLabel: date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
    };
  });
}

export function dashboardStats(events: CalendarEvent[], months: DashboardMonth[], now: Date) {
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  weekStart.setDate(weekStart.getDate() - (weekStart.getDay() + 6) % 7);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);
  const byMonth = months.map(() => 0);
  let total = 0, currentMonth = 0, currentWeek = 0;
  for (const event of events) {
    if (event.isAllDay || event.durationMinutes === null || !Number.isFinite(event.durationMinutes) || event.durationMinutes < 0) continue;
    const hours = event.durationMinutes / 60;
    total += hours;
    if (!event.start) continue;
    const start = new Date(event.start);
    if (start >= monthStart && start < monthEnd) currentMonth += hours;
    if (start >= weekStart && start < weekEnd) currentWeek += hours;
    const key = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`;
    const index = months.findIndex(month => month.key === key);
    if (index !== -1) byMonth[index] += hours;
  }
  return { total, currentMonth, currentWeek, monthlyAverage: months.length ? byMonth.reduce((a, b) => a + b, 0) / months.length : 0, byMonth };
}

export function formatHours(hours: number): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(hours);
}
