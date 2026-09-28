import { test } from 'node:test';
import assert from 'node:assert/strict';
import { natureOf, convertLegacy, hasLegacy, isFresh, migrateLegacy } from '../../js/core/migrate-legacy.js';
import { Store } from '../../js/core/store.js';
import { suiviSchema } from '../../js/modules/suivi/schema.js';
import { pulsionSchema } from '../../js/modules/pulsion/schema.js';
import { testsSchema } from '../../js/modules/tests/schema.js';
import { memoryStorage, fakeNow, fakeId, resetFakes } from '../fixtures/helpers.mjs';

const legacy = { days: {
  '2026-09-18': { bed: '23:30', wake: '07:00', sleepQ: 6, cardioMin: 30, readMin: 10, medMin: null, clarity: 7, mood: 6, elan: 5, urge: 3, checksMin: 10, acts: ['atelier'], note: 'x' },
  '2026-09-19': { bed: null, wake: null, sleepQ: 4, cardioMin: 0, readMin: null, medMin: null, clarity: null, mood: null, elan: null, urge: null, checksMin: null, acts: null, note: null },
  '2026-09-20': { bed: '9h', wake: '07:10', clarity: 12, mood: 5.5, elan: 8, urge: 2, checksMin: -3, cardio: true, focus: true, sleep: 7 },
  '2026-02-30': { mood: 5 },
}, events: [
  { id: 1726000000000, day: '2026-09-18', ts: '2026-09-18T22:00:00.000Z', nature: 'contenu', trigger: 'Fatigue' },
  { id: 1725000000000, day: '2026-09-10', ts: '2026-09-10T22:00:00.000Z', type: 'rechute', trigger: 'Ennui' },
  { id: 1724000000000, day: '2026-09-09', ts: '2026-09-09T22:00:00.000Z', type: 'solo', trigger: null },
  { id: 1723000000000, day: '2026-09-08', ts: '2026-09-08T22:00:00.000Z', type: 'resistee', trigger: 'Ennui' },
  { id: 1722000000000, day: 'hier', ts: '2026-09-07T22:00:00.000Z', nature: 'contenu', trigger: 'Ennui' },
  { id: 1721000000000, day: '2026-09-06', ts: '2026-09-06T22:00:00.000Z', nature: 'autre', trigger: null },
  null,
] };
const legacyTests = { runs: [
  { id: 1, ts: '2026-09-14T09:00:00.000Z', day: '2026-09-14', test: 'pvt', metrics: { median: 250 } },
  { id: 2, ts: '2026-09-14T09:10:00.000Z', day: '2026-09-14', test: 'span', metrics: { span: 5 } },
  { id: 3, ts: 'x', day: 'nope', test: 'pvt', metrics: {} },
] };

test('natureOf lit nature puis type', () => {
  assert.equal(natureOf({ nature: 'sans' }), 'sans');
  assert.equal(natureOf({ type: 'rechute' }), 'contenu');
  assert.equal(natureOf({ type: 'solo' }), 'sans');
  assert.equal(natureOf({ type: 'resistee' }), null);
  assert.equal(natureOf({ nature: 'autre' }), null); // une nature inconnue ne doit jamais faire planter la reprise
});

test('convertLegacy sépare Suivi et Pulsion, ignore ce qui est invalide', () => {
  const { suivi, pulsion, tests } = convertLegacy(legacy, legacyTests);
  assert.equal(suiviSchema.validate(suivi).ok, true);
  assert.equal(pulsionSchema.validate(pulsion).ok, true);
  assert.equal(testsSchema.validate(tests).ok, true);
  assert.deepEqual(suivi.days['2026-09-18'], { bed: '23:30', wake: '07:00', clarity: 7, mood: 6, pleasure: null, drive: 5 });
  assert.equal(suivi.days['2026-09-19'], undefined); // sleepQ et cardio seuls : rien à reprendre
  assert.deepEqual(suivi.days['2026-09-20'], { bed: null, wake: '07:10', clarity: null, mood: null, pleasure: null, drive: 8 });
  assert.equal(suivi.days['2026-02-30'], undefined);
  assert.equal(pulsion.version, 2);
  assert.deepEqual(pulsion.days, { '2026-09-18': { urge: 3, checksMin: 10 }, '2026-09-20': { urge: 2 } });
  assert.deepEqual(pulsion.episodes, []);
  assert.deepEqual(pulsion.events.map(e => [e.day, e.nature, e.triggers]), [
    ['2026-09-18', 'contenu', ['Fatigue']], ['2026-09-10', 'contenu', ['Ennui']], ['2026-09-09', 'sans', []],
  ]);
  assert.equal(pulsion.events[0].id, 1726000000000);
  assert.deepEqual(tests.runs.map(r => r.test), ['pvt', 'span']);
});

test('convertLegacy sans données renvoie des null', () => {
  assert.deepEqual(convertLegacy(null, null), { suivi: null, pulsion: null, tests: null });
  assert.deepEqual(convertLegacy({}, undefined).suivi, { version: 1, days: {} });
  assert.deepEqual(convertLegacy({}, undefined).pulsion, { version: 2, days: {}, events: [], episodes: [] });
});

test('hasLegacy, isFresh et migrateLegacy remplacent les stores', () => {
  resetFakes();
  const storage = memoryStorage({ suivi_v1: JSON.stringify(legacy), suivi_tests_v1: '{pas du json' });
  assert.equal(hasLegacy(storage), true);
  assert.equal(isFresh(storage, ['moi.suivi', 'moi.pulsion', 'moi.tests']), true);
  const stores = {
    suivi: new Store(storage, suiviSchema, { now: fakeNow, makeId: fakeId }),
    pulsion: new Store(storage, pulsionSchema, { now: fakeNow, makeId: fakeId }),
    tests: new Store(storage, testsSchema, { now: fakeNow, makeId: fakeId }),
  };
  for (const s of Object.values(stores)) s.load();
  assert.equal(isFresh(storage, ['moi.suivi']), false);
  assert.deepEqual(migrateLegacy(storage, stores), ['suivi', 'pulsion']);
  assert.equal(Object.keys(stores.suivi.doc.days).length, 2);
  assert.equal(stores.pulsion.doc.events.length, 3);
  assert.deepEqual(stores.tests.doc.runs, []);
  assert.equal(storage.getItem('suivi_v1') !== null, true); // jamais effacé
  assert.equal(hasLegacy(memoryStorage()), false);
});
