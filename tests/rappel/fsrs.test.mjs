import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RETENTION, retrievability, intervalDays, applyReview, daysBetween } from '../../js/modules/rappel/fsrs.js';
import { retrievabilityOf, reviewQueue, anywayQueue, tierOf, libraryRows, itemById } from '../../js/modules/rappel/queries.js';
import { item } from './schema.test.mjs';

const DAY = 86400000;
const T = 1758000000000;

test('FSRS : premier passage, rappel, oubli, intervalle', () => {
  assert.equal(RETENTION, 0.9);
  const first = applyReview(item(), 3, T);
  assert.equal(first.reps, 1);
  assert.equal(first.lapses, 0);
  assert.equal(first.lastReview, T);
  assert.ok(first.S > 0 && first.D >= 1 && first.D <= 10);
  const later = applyReview(item({ ...first }), 3, T + 3 * DAY);
  assert.ok(later.S > first.S, 'un rappel réussi augmente la stabilité');
  assert.equal(later.reps, 2);
  const forgot = applyReview(item({ ...later }), 1, T + 10 * DAY);
  assert.ok(forgot.S < later.S, 'un oubli réduit la stabilité');
  assert.equal(forgot.lapses, 1);
  assert.ok(Math.abs(retrievability(intervalDays(later.S), later.S) - RETENTION) < 1e-9, "l'intervalle ramène à la rétention cible");
  assert.equal(retrievability(0, 5), 1);
  assert.equal(daysBetween(T, T + DAY), 1);
  assert.equal(daysBetween(T + DAY, T), 0);
});

test('file de révision : dues par rétrievabilité croissante, puis nouvelles par création ; sans cap', () => {
  const items = [
    item({ id: 'new2', createdAt: T + 2 }),
    item({ id: 'solid', lastReview: T, S: 100, D: 5, reps: 3 }),
    item({ id: 'weak', lastReview: T, S: 1, D: 5, reps: 3 }),
    item({ id: 'mid', lastReview: T, S: 5, D: 5, reps: 3 }),
    item({ id: 'new1', createdAt: T + 1 }),
  ];
  const now = T + 6 * DAY;
  const q = reviewQueue(items, now);
  assert.deepEqual(q.due, ['weak', 'mid']);
  assert.deepEqual(q.fresh, ['new1', 'new2']);
  assert.deepEqual(anywayQueue(items, now), ['weak', 'mid', 'solid']);
  assert.equal(retrievabilityOf(items[0], now), null);
  assert.ok(retrievabilityOf(items[1], now) > 0.9);
  assert.equal(itemById(items, 'mid').id, 'mid');
  assert.equal(itemById(items, 'nope'), undefined);
  const rows = libraryRows(items, now);
  assert.deepEqual(rows.map(r => r.item.id), ['weak', 'mid', 'solid', 'new2', 'new1']);
  assert.equal(rows[3].r, null);
});

test('palier : restitution pour un fait ou une fiche jeune, explication pour une idée stable', () => {
  assert.equal(tierOf(item({ kind: 'fait', lastReview: T, S: 50, D: 5 })), 'restitution');
  assert.equal(tierOf(item({ kind: 'idee' })), 'restitution');
  assert.equal(tierOf(item({ kind: 'idee', lastReview: T, S: 6.9, D: 5 })), 'restitution');
  assert.equal(tierOf(item({ kind: 'idee', lastReview: T, S: 7, D: 5 })), 'explication');
});
