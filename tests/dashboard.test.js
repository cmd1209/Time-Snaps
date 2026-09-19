import test from 'node:test';
import assert from 'node:assert/strict';
import { dashboardDays, dashboardMonths, dashboardStats } from '../src/utils/dashboard.ts';
process.env.TZ = 'Europe/Berlin';
const event = (start, durationMinutes = 60, extra = {}) => ({ start, durationMinutes, isAllDay: false, ...extra });
const now = new Date(2026, 8, 15, 12); // Tuesday

test('chart months cross year boundaries and include empty months', () => {
  assert.deepEqual(dashboardMonths(new Date(2026, 1, 10), 3).map(m => m.key), ['2025-12', '2026-01', '2026-02']);
  const result = dashboardStats([event('2026-09-15T10:00:00Z', 120)], dashboardMonths(now), now);
  assert.deepEqual(result.byMonth, [0, 0, 0, 0, 0, 2]);
  assert.equal(result.monthlyAverage, 2 / 6);
});
test('month and Monday-based week use local dates with exclusive end boundaries', () => {
  const events = [
    event('2026-09-13T21:59:00Z', 60), // Sunday in Berlin
    event('2026-09-13T22:00:00Z', 120), // Monday 00:00
    event('2026-09-20T21:59:00Z', 180), // Sunday 23:59
    event('2026-09-20T22:00:00Z', 240), // following Monday
    event('2026-09-30T22:00:00Z', 300) // October 1
  ];
  const result = dashboardStats(events, dashboardMonths(now), now);
  assert.equal(result.total, 15);
  assert.equal(result.currentMonth, 10);
  assert.equal(result.currentWeek, 5);
});
test('total includes feed history while charts use their window; all-day and invalid durations excluded', () => {
  const result = dashboardStats([
    event('2020-01-01T12:00:00Z', 180), event('2026-09-15T12:00:00Z', 30),
    event('2026-09-15T12:00:00Z', 1440, { isAllDay: true }),
    event(null, null), event(null, -10), event(null, Infinity)
  ], dashboardMonths(now), now);
  assert.equal(result.total, 3.5);
  assert.equal(result.currentMonth, 0.5);
  assert.equal(result.currentWeek, 0.5);
});
test('empty calendar produces zero values rather than NaN', () => {
  const result = dashboardStats([], dashboardMonths(now), now);
  assert.equal(result.total, 0);
  assert.equal(result.monthlyAverage, 0);
  assert.ok(result.byMonth.every(value => value === 0));
});

test('daily activity includes exactly 30 local dates and excludes events outside the window', () => {
  const days = dashboardDays([
    event('2026-08-16T21:59:00Z', 60), // Before first local day
    event('2026-08-16T22:00:00Z', 120), // August 17, local midnight
    event('2026-09-15T21:59:00Z', 30), // Today, 23:59
    event('2026-09-15T22:00:00Z', 60), // Tomorrow
    event('2026-09-15T10:00:00Z', 1440, { isAllDay: true }),
    event('invalid', 60), event(null, 60),
    event('2026-09-15T10:00:00Z', Infinity)
  ], now);
  assert.equal(days.length, 30);
  assert.equal(days[0].date.getDate(), 17);
  assert.equal(days[0].hours, 2);
  assert.equal(days[29].hours, 0.5);
  assert.equal(days.reduce((sum, day) => sum + day.hours, 0), 2.5);
});

test('daily activity keeps local midnights and combines repeated hours across daylight saving', () => {
  const days = dashboardDays([
    event('2026-10-25T00:30:00Z', 60),
    event('2026-10-25T01:30:00Z', 120)
  ], new Date(2026, 9, 26, 12));
  assert.equal(days[28].hours, 3);
  assert.ok(days.every(day => day.date.getHours() === 0));
  assert.equal(new Set(days.map(day => day.date.toDateString())).size, 30);
});
