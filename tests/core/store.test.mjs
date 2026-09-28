import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Store, migrate } from '../../js/core/store.js';
import { memoryStorage, fakeNow, fakeId, resetFakes } from '../fixtures/helpers.mjs';

// Schéma jouet : { version, n } ; v1 → v2 ajoute "extra".
const schema = {
  key: 'test.doc',
  version: 2,
  empty: () => ({ version: 2, n: 0, extra: 0 }),
  validate(raw) {
    if (!raw || typeof raw !== 'object') return { ok: false, error: 'Document invalide.' };
    if (![1, 2].includes(raw.version)) return { ok: false, error: `Version inconnue (${raw.version}).` };
    if (!Number.isInteger(raw.n)) return { ok: false, error: 'n manquant.' };
    return { ok: true, doc: raw };
  },
  migrations: { 1: d => ({ ...d, version: 2, extra: 0 }) },
};

function newStore(initial) {
  resetFakes();
  const storage = memoryStorage(initial);
  const store = new Store(storage, schema, { now: fakeNow, makeId: fakeId });
  store.load();
  return { store, storage };
}

test('migrate applique les étapes séquentielles et refuse un trou', () => {
  assert.deepEqual(migrate({ version: 1, n: 3 }, schema), { version: 2, n: 3, extra: 0 });
  assert.deepEqual(migrate({ version: 2, n: 3, extra: 1 }, schema), { version: 2, n: 3, extra: 1 });
  assert.throws(() => migrate({ version: 0, n: 1 }, { ...schema, migrations: {} }), /manquante/);
});

test('load sans données crée le document vide et le sauvegarde', () => {
  const { store, storage } = newStore();
  assert.deepEqual(store.doc, { version: 2, n: 0, extra: 0 });
  assert.equal(JSON.parse(storage.getItem('test.doc')).n, 0);
});

test('load migre un document ancien et le réécrit', () => {
  const { store, storage } = newStore({ 'test.doc': JSON.stringify({ version: 1, n: 5 }) });
  assert.equal(store.doc.extra, 0);
  assert.equal(JSON.parse(storage.getItem('test.doc')).version, 2);
});

test('load met un document illisible de côté et repart à vide', () => {
  const { store, storage } = newStore({ 'test.doc': '{pas du json' });
  assert.equal(store.doc.n, 0);
  assert.equal(store.corrupt, '{pas du json');
  assert.equal(storage.getItem('test.doc.corrupt'), '{pas du json');
  const again = new Store(storage, schema); again.load();
  assert.equal(again.corrupt, '{pas du json');
  again.clearCorrupt();
  assert.equal(again.corrupt, null);
  assert.equal(storage.getItem('test.doc.corrupt'), null);
});

test('commit sauvegarde, notifie, et notify:false reste silencieux', () => {
  const { store, storage } = newStore();
  let calls = 0;
  const off = store.subscribe(() => { calls += 1; });
  const r = store.commit(d => { d.n = 7; return 'ok'; });
  assert.equal(r, 'ok');
  assert.equal(calls, 1);
  assert.equal(JSON.parse(storage.getItem('test.doc')).n, 7);
  store.commit(d => { d.n = 8; }, { notify: false });
  assert.equal(calls, 1);
  off();
  store.commit(d => { d.n = 9; });
  assert.equal(calls, 1);
});

test('un échec de sauvegarde est signalé sans casser la notification', () => {
  const { store, storage } = newStore();
  storage.setItem = () => { throw new Error('QuotaExceededError'); };
  let notified = 0, reported = null;
  store.subscribe(() => { notified += 1; });
  store.onSaveError = m => { reported = m; };
  store.commit(d => { d.n = 1; });
  assert.equal(notified, 1);
  assert.match(reported, /stockage/i);
  assert.match(store.saveError, /stockage/i);
});

test('importJson et replace valident, migrent, remplacent ; sinon ne touchent rien', () => {
  const { store } = newStore();
  let notified = 0;
  store.subscribe(() => { notified += 1; });
  assert.throws(() => store.importJson('{pas du json'), /JSON/);
  assert.throws(() => store.importJson(JSON.stringify({ version: 2 })), /n manquant/);
  assert.equal(notified, 0);
  store.importJson(JSON.stringify({ version: 1, n: 4 }));
  assert.deepEqual(store.doc, { version: 2, n: 4, extra: 0 });
  assert.equal(notified, 1);
  assert.ok(store.exportJson().includes('\n  '));
});
