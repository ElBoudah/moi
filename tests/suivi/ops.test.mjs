import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Store } from '../../js/core/store.js';
import { suiviSchema } from '../../js/modules/suivi/schema.js';
import { setDayField, setDayFieldSoon, flushPending } from '../../js/modules/suivi/ops.js';
import { memoryStorage, fakeNow, fakeId, resetFakes } from '../fixtures/helpers.mjs';

function newStore() {
  resetFakes();
  const storage = memoryStorage();
  const store = new Store(storage, suiviSchema, { now: fakeNow, makeId: fakeId });
  store.load();
  return { store, storage };
}

test('setDayField crée le jour, valide, et supprime un jour redevenu vide', () => {
  const { store, storage } = newStore();
  let notified = 0;
  store.subscribe(() => { notified += 1; });
  setDayField(store, '2026-09-20', 'mood', 7);
  assert.equal(store.doc.days['2026-09-20'].mood, 7);
  assert.equal(store.doc.days['2026-09-20'].bed, null);
  assert.equal(JSON.parse(storage.getItem('moi.suivi')).days['2026-09-20'].mood, 7);
  assert.equal(notified, 0);
  setDayField(store, '2026-09-20', 'bed', '23:00');
  setDayField(store, '2026-09-20', 'bed', null);
  setDayField(store, '2026-09-20', 'mood', null);
  assert.equal(store.doc.days['2026-09-20'], undefined);
});

test('setDayField refuse champ, valeur ou jour invalides', () => {
  const { store } = newStore();
  assert.throws(() => setDayField(store, '2026-09-20', 'sleepQ', 3), /champ/i);
  assert.throws(() => setDayField(store, '2026-09-20', 'mood', 11), /valeur/i);
  assert.throws(() => setDayField(store, '2026-09-20', 'bed', '9h'), /heure/i);
  assert.throws(() => setDayField(store, '2026-13-01', 'mood', 1), /jour/i);
  assert.deepEqual(store.doc.days, {});
});

test('setDayFieldSoon diffère, flushPending persiste tout de suite', async () => {
  const { store, storage } = newStore();
  setDayFieldSoon(store, '2026-09-20', 'clarity', 4);
  assert.equal(storage.getItem('moi.suivi').includes('clarity'), false);
  flushPending();
  assert.equal(JSON.parse(storage.getItem('moi.suivi')).days['2026-09-20'].clarity, 4);
  setDayFieldSoon(store, '2026-09-20', 'clarity', 5);
  setDayFieldSoon(store, '2026-09-20', 'clarity', 6);
  await new Promise(r => setTimeout(r, 400));
  assert.equal(JSON.parse(storage.getItem('moi.suivi')).days['2026-09-20'].clarity, 6);
});
