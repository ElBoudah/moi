import { test } from 'node:test';
import assert from 'node:assert/strict';
import { endDay, isActive, active, past, periodKeys, dayStrip, weekBounds, weekCount, dayNumber, doneCount } from '../../js/modules/challenge/queries.js';

const c = () => ({ id: 'c1', title: 'Cardio', target: { perWeek: 3 }, startDay: '2026-09-01', days: 14, endedAt: null, done: { '2026-09-02': true, '2026-09-08': true } });

test('endDay, isActive, active, past', () => {
  assert.equal(endDay(c()), '2026-09-14');
  assert.equal(isActive(c(), '2026-09-14'), true);
  assert.equal(isActive(c(), '2026-09-15'), false);
  assert.equal(isActive({ ...c(), endedAt: '2026-09-05T10:00:00.000Z' }, '2026-09-06'), false);
  const doc = { version: 1, challenges: [{ ...c(), id: 'old', startDay: '2026-07-01', endedAt: '2026-07-14T23:59:59.000Z' }, c()] };
  assert.equal(active(doc, '2026-09-10').id, 'c1');
  assert.equal(active(doc, '2026-09-20'), null);
  assert.deepEqual(past(doc, '2026-09-20').map(x => x.id), ['c1', 'old']);
  assert.deepEqual(past(doc, '2026-09-10').map(x => x.id), ['old']);
});

test('periodKeys et dayStrip', () => {
  const keys = periodKeys(c());
  assert.equal(keys.length, 14);
  assert.equal(keys[0], '2026-09-01');
  assert.equal(keys[13], '2026-09-14');
  const strip = dayStrip(c(), '2026-09-08');
  const byDay = Object.fromEntries(strip.map(s => [s.day, s.state]));
  assert.equal(byDay['2026-09-01'], 'missed');
  assert.equal(byDay['2026-09-02'], 'done');
  assert.equal(byDay['2026-09-08'], 'done');
  assert.equal(byDay['2026-09-09'], 'future');
  assert.equal(dayStrip(c(), '2026-09-07').find(s => s.day === '2026-09-07').state, 'today');
  // challenge arrêté le 05/09 : les jours suivants sont « off »
  const stopped = { ...c(), endedAt: '2026-09-05T10:00:00.000Z' };
  const s2 = Object.fromEntries(dayStrip(stopped, '2026-09-20').map(s => [s.day, s.state]));
  assert.equal(s2['2026-09-05'], 'missed');
  assert.equal(s2['2026-09-06'], 'off');
});

test('semaine du lundi au dimanche, compte de la semaine, numéro du jour, total', () => {
  assert.deepEqual(weekBounds('2026-09-09'), { from: '2026-09-07', to: '2026-09-13' }); // mercredi
  assert.deepEqual(weekBounds('2026-09-13'), { from: '2026-09-07', to: '2026-09-13' }); // dimanche
  assert.deepEqual(weekBounds('2026-09-07'), { from: '2026-09-07', to: '2026-09-13' }); // lundi
  assert.equal(weekCount(c(), '2026-09-09'), 1); // 08/09 dans la semaine, 02/09 non
  assert.equal(dayNumber(c(), '2026-09-01'), 1);
  assert.equal(dayNumber(c(), '2026-09-09'), 9);
  assert.equal(dayNumber(c(), '2026-12-01'), 14);
  assert.equal(doneCount(c()), 2);
});
