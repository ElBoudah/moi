import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Store } from '../../js/core/store.js';
import { pulsionSchema } from '../../js/modules/pulsion/schema.js';
import { setDayField, addEvent } from '../../js/modules/pulsion/ops.js';
import { memoryStorage, fakeNow, fakeId, resetFakes } from '../fixtures/helpers.mjs';

function newStore() {
  resetFakes();
  const store = new Store(memoryStorage(), pulsionSchema, { now: fakeNow, makeId: fakeId });
  store.load();
  return store;
}

test('setDayField écrit urge et checksMin sans notifier, supprime un jour vide', () => {
  const store = newStore();
  let n = 0; store.subscribe(() => { n += 1; });
  setDayField(store, '2026-09-20', 'urge', 6);
  setDayField(store, '2026-09-20', 'checksMin', 20);
  assert.deepEqual(store.doc.days['2026-09-20'], { urge: 6, checksMin: 20 });
  assert.equal(n, 0);
  setDayField(store, '2026-09-20', 'urge', null);
  setDayField(store, '2026-09-20', 'checksMin', null);
  assert.equal(store.doc.days['2026-09-20'], undefined);
  assert.throws(() => setDayField(store, '2026-09-20', 'urge', 11), /valeur/i);
  assert.throws(() => setDayField(store, '2026-09-20', 'acts', []), /champ/i);
});

test('addEvent enregistre un acte daté, jamais dans le futur', () => {
  const store = newStore();
  const e = addEvent(store, { nature: 'contenu', trigger: 'Fatigue', day: '2026-09-19' }, '2026-09-20');
  assert.deepEqual(e, { id: 'id1', day: '2026-09-19', ts: '2026-09-20T10:01:00.000Z', nature: 'contenu', trigger: 'Fatigue' });
  const p = addEvent(store, { nature: 'partenaire', trigger: 'Ennui', day: '2026-09-20' }, '2026-09-20');
  assert.equal(p.trigger, null);
  assert.equal(store.doc.events.length, 2);
  assert.throws(() => addEvent(store, { nature: 'contenu', trigger: 'Ennui', day: '2026-09-21' }, '2026-09-20'), /futur/i);
  assert.throws(() => addEvent(store, { nature: 'contenu', trigger: 'Ennui', day: '2026-13-01' }, '2026-09-20'), /jour/i);
  assert.throws(() => addEvent(store, { nature: 'contenu', trigger: '', day: '2026-09-20' }, '2026-09-20'), /déclencheur/i);
  assert.throws(() => addEvent(store, { nature: 'resistee', trigger: 'Ennui', day: '2026-09-20' }, '2026-09-20'), /nature/i);
  assert.equal(store.doc.events.length, 2);
});
