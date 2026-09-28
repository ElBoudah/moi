import { test } from 'node:test';
import assert from 'node:assert/strict';
import { keyOf, today, addDays, diffDays, isDayKey, toMin, hm, relativeDays, daysBetween, frShort, hhmm, isTime } from '../../js/core/dates.js';

test('keyOf et today produisent AAAA-MM-JJ en heure locale', () => {
  assert.equal(keyOf(new Date(2026, 8, 5)), '2026-09-05');
  assert.equal(today(new Date(2026, 0, 1)), '2026-01-01');
});

test('addDays et diffDays traversent les mois', () => {
  assert.equal(addDays('2026-09-30', 1), '2026-10-01');
  assert.equal(addDays('2026-03-01', -1), '2026-02-28');
  assert.equal(diffDays('2026-09-01', '2026-09-08'), 7);
  assert.equal(diffDays('2026-09-08', '2026-09-01'), -7);
});

test('isDayKey refuse les formes et dates invalides', () => {
  assert.equal(isDayKey('2026-09-05'), true);
  assert.equal(isDayKey('2026-02-30'), false);
  assert.equal(isDayKey('26-09-05'), false);
  assert.equal(isDayKey(null), false);
});

test('toMin, isTime et hm', () => {
  assert.equal(toMin('23:15'), 1395);
  assert.equal(toMin('7:05'), 425);
  assert.equal(toMin('x'), null);
  assert.equal(toMin(null), null);
  assert.equal(isTime('07:05'), true);
  assert.equal(isTime('7h05'), false);
  assert.equal(hm(450), '7 h 30');
  assert.equal(hm(59.7), '1 h 00');
  assert.equal(hm(null), '—');
});

test('daysBetween et relativeDays', () => {
  const now = '2026-09-20T23:00:00.000Z';
  assert.equal(daysBetween('2026-09-17T10:00:00.000Z', now), 3);
  assert.equal(relativeDays('2026-09-20T01:00:00.000Z', now), "aujourd'hui");
  assert.equal(relativeDays('2026-09-19T10:00:00.000Z', now), 'hier');
  assert.equal(relativeDays('2026-09-12T10:00:00.000Z', now), 'il y a 8 j');
});

test('formats français', () => {
  assert.equal(frShort('2026-09-05'), '05/09');
  assert.match(hhmm('2026-09-05T08:07:00'), /^\d{2}:\d{2}$/);
});
