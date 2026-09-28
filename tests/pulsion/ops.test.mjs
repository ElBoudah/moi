import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Store } from '../../js/core/store.js';
import { pulsionSchema } from '../../js/modules/pulsion/schema.js';
import { setDayField, addEvent, addEpisode } from '../../js/modules/pulsion/ops.js';
import { memoryStorage, fakeNow, fakeId, resetFakes } from '../fixtures/helpers.mjs';

function newStore() {
  resetFakes();
  const store = new Store(memoryStorage(), pulsionSchema, { now: fakeNow, makeId: fakeId });
  store.load();
  return store;
}

test('setDayField écrit la pression sans notifier, supprime un jour vide, refuse les checks', () => {
  const store = newStore();
  let n = 0; store.subscribe(() => { n += 1; });
  setDayField(store, '2026-09-20', 'urge', 6);
  assert.deepEqual(store.doc.days['2026-09-20'], { urge: 6 });
  assert.equal(n, 0);
  setDayField(store, '2026-09-20', 'urge', null);
  assert.equal(store.doc.days['2026-09-20'], undefined);
  assert.throws(() => setDayField(store, '2026-09-20', 'urge', 11), /valeur/i);
  assert.throws(() => setDayField(store, '2026-09-20', 'checksMin', 5), /champ/i);
});

test('addEvent enregistre un acte daté avec des tags libres, jamais dans le futur', () => {
  const store = newStore();
  const e = addEvent(store, { nature: 'contenu', triggers: [' Fatigue ', 'fatigue', 'Au lit'], day: '2026-09-19' }, '2026-09-20');
  assert.deepEqual(e, { id: 'id1', day: '2026-09-19', ts: '2026-09-20T10:01:00.000Z', nature: 'contenu', triggers: ['Fatigue', 'Au lit'] });
  const noTag = addEvent(store, { nature: 'sans', triggers: [], day: '2026-09-20' }, '2026-09-20');
  assert.deepEqual(noTag.triggers, []);
  const p = addEvent(store, { nature: 'partenaire', triggers: ['Ennui'], day: '2026-09-20' }, '2026-09-20');
  assert.deepEqual(p.triggers, []);
  assert.equal(store.doc.events.length, 3);
  assert.throws(() => addEvent(store, { nature: 'contenu', triggers: [], day: '2026-09-21' }, '2026-09-20'), /futur/i);
  assert.throws(() => addEvent(store, { nature: 'contenu', triggers: [], day: '2026-13-01' }, '2026-09-20'), /jour/i);
  assert.throws(() => addEvent(store, { nature: 'resistee', triggers: [], day: '2026-09-20' }, '2026-09-20'), /nature/i);
  assert.equal(store.doc.events.length, 3);
});

test('addEpisode enregistre une envie sur le vif : intensité, tags, contenu vu', () => {
  const store = newStore();
  let n = 0; store.subscribe(() => { n += 1; });
  const ep = addEpisode(store, { intensity: 7, triggers: ['Au lit'], exposed: true }, '2026-09-20');
  assert.deepEqual(ep, { id: 'id1', day: '2026-09-20', ts: '2026-09-20T10:01:00.000Z', intensity: 7, triggers: ['Au lit'], exposed: true });
  assert.equal(n, 1);
  const ep2 = addEpisode(store, { intensity: 3 }, '2026-09-20');
  assert.deepEqual([ep2.triggers, ep2.exposed], [[], false]);
  assert.equal(store.doc.episodes.length, 2);
  assert.throws(() => addEpisode(store, { intensity: 11 }, '2026-09-20'), /intensité/i);
  assert.throws(() => addEpisode(store, { intensity: 5 }, 'hier'), /jour/i);
  assert.equal(store.doc.episodes.length, 2);
});
