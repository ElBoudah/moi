import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Store } from '../../js/core/store.js';
import { challengeSchema } from '../../js/modules/challenge/schema.js';
import { createChallenge, toggleDone, stopChallenge, autoClose } from '../../js/modules/challenge/ops.js';
import { active } from '../../js/modules/challenge/queries.js';
import { memoryStorage, fakeNow, fakeId, resetFakes } from '../fixtures/helpers.mjs';

function newStore() {
  resetFakes();
  const store = new Store(memoryStorage(), challengeSchema, { now: fakeNow, makeId: fakeId });
  store.load();
  return store;
}

test('createChallenge valide, démarre aujourd\'hui, refuse un second actif', () => {
  const store = newStore();
  const c = createChallenge(store, { title: ' Cardio ', target: { perWeek: 3 }, days: 30 }, '2026-09-20');
  assert.deepEqual(c, { id: 'id1', title: 'Cardio', target: { perWeek: 3 }, startDay: '2026-09-20', days: 30, endedAt: null, done: {} });
  assert.throws(() => createChallenge(store, { title: 'Lecture', target: { daily: true }, days: 14 }, '2026-09-20'), /déjà en cours/i);
  assert.equal(store.doc.challenges.length, 1);
  assert.throws(() => createChallenge(newStore(), { title: '', target: { daily: true }, days: 14 }, '2026-09-20'), /titre/i);
  assert.throws(() => createChallenge(newStore(), { title: 'x', target: { perWeek: 8 }, days: 14 }, '2026-09-20'), /cible/i);
  assert.throws(() => createChallenge(newStore(), { title: 'x', target: { daily: true }, days: 21 }, '2026-09-20'), /durée/i);
});

test('toggleDone bascule un jour de la période, jamais hors période, futur ou clos', () => {
  const store = newStore();
  const c = createChallenge(store, { title: 'Cardio', target: { daily: true }, days: 14 }, '2026-09-20');
  let n = 0; store.subscribe(() => { n += 1; });
  toggleDone(store, c.id, '2026-09-20', '2026-09-22');
  toggleDone(store, c.id, '2026-09-21', '2026-09-22');
  assert.deepEqual(store.doc.challenges[0].done, { '2026-09-20': true, '2026-09-21': true });
  toggleDone(store, c.id, '2026-09-20', '2026-09-22');
  assert.deepEqual(store.doc.challenges[0].done, { '2026-09-21': true });
  assert.equal(n, 3);
  assert.throws(() => toggleDone(store, c.id, '2026-09-23', '2026-09-22'), /futur/i);
  assert.throws(() => toggleDone(store, c.id, '2026-09-19', '2026-09-22'), /période/i);
  assert.throws(() => toggleDone(store, c.id, '2026-10-05', '2026-10-06'), /terminé|période/i);
  assert.throws(() => toggleDone(store, 'nope', '2026-09-21', '2026-09-22'), /introuvable/i);
  stopChallenge(store, c.id, '2026-09-22T10:00:00.000Z');
  assert.equal(store.doc.challenges[0].endedAt, '2026-09-22T10:00:00.000Z');
  assert.throws(() => toggleDone(store, c.id, '2026-09-21', '2026-09-22'), /terminé/i);
  assert.throws(() => stopChallenge(store, c.id, '2026-09-22T11:00:00.000Z'), /terminé/i);
  assert.equal(active(store.doc, '2026-09-22'), null);
});

test('autoClose clôt les challenges dont la période est écoulée, une seule fois', () => {
  const store = newStore();
  createChallenge(store, { title: 'Cardio', target: { daily: true }, days: 14 }, '2026-09-01');
  assert.equal(autoClose(store, '2026-09-14'), 0);
  assert.equal(store.doc.challenges[0].endedAt, null);
  let n = 0; store.subscribe(() => { n += 1; });
  assert.equal(autoClose(store, '2026-09-15'), 1);
  assert.equal(store.doc.challenges[0].endedAt, '2026-09-14T23:59:59.000Z');
  assert.equal(autoClose(store, '2026-09-16'), 0);
  assert.equal(n, 1);
  assert.equal(active(store.doc, '2026-09-16'), null);
});
