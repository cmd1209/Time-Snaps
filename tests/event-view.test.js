import test from 'node:test';
import assert from 'node:assert/strict';
import { filterEvents, groupEventsByDay, localDateKey, timedMinutes } from '../src/utils/eventView.ts';

process.env.TZ = 'Europe/Berlin';
const event = (uid, start, overrides = {}) => ({ uid, start, end: null, title: uid, calendarName: 'Test', sourceUrl: '', description: '', location: '', durationMinutes: 60, isAllDay: false, ...overrides });
const previous = event('previous', '2026-09-13T12:00:00Z');
// This is September 14 in the viewer's time zone, despite its UTC date.
const midnight = event('midnight', '2026-09-13T23:30:00Z');
const evening = event('evening', '2026-09-14T20:00:00Z');
const undated = event('undated', null);

test('date range is inclusive and uses local dates rather than UTC dates', () => {
  assert.equal(localDateKey(midnight.start), '2026-09-14');
  assert.deepEqual(filterEvents([previous, midnight, evening, undated], '2026-09-14', '2026-09-14').map(e => e.uid), ['midnight', 'evening']);
});
test('all dates retains undated entries; partial and reversed ranges behave predictably', () => {
  const events = [previous, midnight, undated];
  assert.equal(filterEvents(events, '', '').length, 3);
  assert.deepEqual(filterEvents(events, '', '2026-09-13'), [previous]);
  assert.deepEqual(filterEvents(events, '2026-09-14', ''), [midnight]);
  assert.deepEqual(filterEvents(events, '2026-09-15', '2026-09-14'), []);
});
test('groups days chronologically with events in time order and undated entries last', () => {
  const groups = groupEventsByDay([undated, evening, midnight, previous]);
  assert.deepEqual(groups.map(([day]) => day), ['2026-09-13', '2026-09-14', '']);
  assert.deepEqual(groups[1][1].map(e => e.uid), ['midnight', 'evening']);
});
test('timed duration excludes all-day events and missing durations', () => {
  assert.equal(timedMinutes([previous, event('all-day', null, { isAllDay: true, durationMinutes: 1440 }), event('missing', null, { durationMinutes: null })]), 60);
});
