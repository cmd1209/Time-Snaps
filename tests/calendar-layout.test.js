import test from 'node:test';
import assert from 'node:assert/strict';
import { addDays, calendarDays, eventsOnDay, layoutDayEvents, moveCalendarDate } from '../src/utils/calendarLayout.ts';

process.env.TZ = 'Europe/Berlin';
const date = value => new Date(`${value}T12:00:00`);
const key = value => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
const event = (uid, start, end, overrides = {}) => ({ uid, start, end, title: uid, calendarName: 'Work', sourceUrl: '', description: '', location: '', durationMinutes: null, isAllDay: false, ...overrides });

test('weeks start on Monday, including a Sunday across a year boundary', () => {
  const days = calendarDays(date('2027-01-03'), 'week');
  assert.equal(key(days[0]), '2026-12-28');
  assert.equal(key(days[6]), '2027-01-03');
  assert.equal(days.length, 7);
});

test('month grids contain every date and complete Monday-to-Sunday weeks', () => {
  for (const [month, count] of [['2026-02-12', 28], ['2026-03-12', 31], ['2028-02-12', 29]]) {
    const anchor = date(month);
    const days = calendarDays(anchor, 'month');
    assert.equal(days[0].getDay(), 1);
    assert.equal(days.at(-1).getDay(), 0);
    assert.equal(days.length % 7, 0);
    assert.equal(days.filter(day => day.getMonth() === anchor.getMonth()).length, count);
  }
});

test('navigation uses calendar dates across DST and avoids month-end overflow', () => {
  assert.equal(key(moveCalendarDate(date('2026-01-31'), 'month', 1)), '2026-02-01');
  assert.equal(key(moveCalendarDate(date('2026-03-28'), 'week', 1)), '2026-04-04');
  assert.equal(key(moveCalendarDate(date('2026-03-29'), 'day', -1)), '2026-03-28');
  assert.equal(addDays(date('2026-03-28'), 1).getHours(), 0);
  assert.deepEqual(calendarDays(date('2026-11-12'), 'day').map(key), ['2026-11-12']);
});

test('overnight events appear on both dates and stop at an exclusive midnight end', () => {
  const overnight = event('overnight', '2026-11-12T23:00:00+01:00', '2026-11-13T02:00:00+01:00');
  const midnightEnd = event('midnight', '2026-11-12T22:00:00+01:00', '2026-11-13T00:00:00+01:00');
  assert.deepEqual(eventsOnDay([overnight, midnightEnd], date('2026-11-13')), [overnight]);
  const first = layoutDayEvents([overnight], date('2026-11-12'))[0];
  const next = layoutDayEvents([overnight], date('2026-11-13'))[0];
  assert.deepEqual([first.start, first.end], [1380, 1440]);
  assert.deepEqual([next.start, next.end], [0, 120]);
});

test('overlap groups allocate separate lanes and reuse a lane for touching entries', () => {
  const entries = [
    event('a', '2026-11-12T09:00:00+01:00', '2026-11-12T10:00:00+01:00'),
    event('b', '2026-11-12T09:30:00+01:00', '2026-11-12T11:00:00+01:00'),
    event('c', '2026-11-12T10:00:00+01:00', '2026-11-12T10:30:00+01:00'),
    event('d', '2026-11-12T12:00:00+01:00', '2026-11-12T13:00:00+01:00'),
  ];
  const layout = layoutDayEvents(entries, date('2026-11-12'));
  assert.deepEqual(layout.map(item => [item.column, item.columns]), [[0, 2], [1, 2], [0, 2], [0, 1]]);
});

test('all-day spans are exclusive and never placed in the hourly timeline', () => {
  const allDay = event('all-day', '2026-11-12T00:00:00+01:00', '2026-11-14T00:00:00+01:00', { isAllDay: true });
  assert.equal(eventsOnDay([allDay], date('2026-11-13')).length, 1);
  assert.equal(eventsOnDay([allDay], date('2026-11-14')).length, 0);
  assert.deepEqual(layoutDayEvents([allDay], date('2026-11-12')), []);
});

test('missing ends stay visible and undated events cannot leak into a calendar date', () => {
  const entries = [event('undated', null, null), event('invalid', 'invalid', null), event('instant', '2026-11-12T10:00:00+01:00', null)];
  const layout = layoutDayEvents(entries, date('2026-11-12'));
  assert.equal(layout.length, 1);
  assert.equal(layout[0].event.uid, 'instant');
  assert.equal(layout[0].start, 600);
  assert.ok(layout[0].end > layout[0].start);
});

test('an event without an end uses its recorded duration across midnight', () => {
  const entry = event('duration', '2026-11-12T23:00:00+01:00', null, { durationMinutes: 120 });
  assert.deepEqual(layoutDayEvents([entry], date('2026-11-13')).map(item => [item.start, item.end]), [[0, 60]]);
});
