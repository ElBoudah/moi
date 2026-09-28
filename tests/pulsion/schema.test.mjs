import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pulsionSchema, NATURES, NATURE_ORDER, URGE_ANCHORS, normTags, emptyDay, isEmptyDay } from '../../js/modules/pulsion/schema.js';
import { migrate } from '../../js/core/store.js';

test('constantes, document vide, tags normalisés', () => {
  assert.deepEqual(NATURE_ORDER, ['contenu', 'sans', 'partenaire']);
  assert.equal(NATURES.contenu.rank > NATURES.sans.rank && NATURES.sans.rank > NATURES.partenaire.rank, true);
  assert.equal(URGE_ANCHORS.length, 3);
  assert.deepEqual(pulsionSchema.empty(), { version: 2, days: {}, events: [], episodes: [] });
  assert.deepEqual(emptyDay(), { urge: null });
  assert.equal(isEmptyDay({ urge: null }), true);
  assert.equal(isEmptyDay({ urge: 0 }), false);
  assert.deepEqual(normTags([' Fatigue ', 'fatigue', '', 'Au lit', 'AU LIT', 'x'.repeat(40)]), ['Fatigue', 'Au lit', 'x'.repeat(30)]);
  assert.deepEqual(normTags(null), []);
});

test('validate accepte un document v2 : actes avec tags, épisodes', () => {
  const doc = { version: 2,
    days: { '2026-09-20': { urge: 4 }, '2026-09-19': { urge: 2, checksMin: 10 } },
    events: [{ id: 1726000000000, day: '2026-09-19', ts: '2026-09-19T22:00:00.000Z', nature: 'contenu', triggers: ['Fatigue', 'Au lit'] },
             { id: 'e2', day: '2026-09-20', ts: '2026-09-20T22:00:00.000Z', nature: 'partenaire', triggers: [] }],
    episodes: [{ id: 'p1', day: '2026-09-20', ts: '2026-09-20T18:00:00.000Z', intensity: 6, triggers: ['Image accidentelle'], exposed: true }] };
  assert.equal(pulsionSchema.validate(doc).ok, true);
});

test('validate refuse jours, actes et épisodes mal formés', () => {
  const base = pulsionSchema.empty();
  const ev = { id: 'e', day: '2026-09-19', ts: '2026-09-19T22:00:00.000Z', nature: 'sans', triggers: ['Ennui'] };
  const ep = { id: 'p', day: '2026-09-19', ts: '2026-09-19T22:00:00.000Z', intensity: 5, triggers: [], exposed: false };
  assert.match(pulsionSchema.validate({ ...base, days: { '2026-09-20': { urge: 11 } } }).error, /urge/);
  assert.match(pulsionSchema.validate({ ...base, events: [{ ...ev, nature: 'resistee' }] }).error, /nature/i);
  assert.match(pulsionSchema.validate({ ...base, events: [{ ...ev, day: '2026-02-30' }] }).error, /jour/i);
  assert.match(pulsionSchema.validate({ ...base, events: [{ ...ev, triggers: 'Ennui' }] }).error, /déclencheur/i);
  assert.match(pulsionSchema.validate({ ...base, episodes: [{ ...ep, intensity: 12 }] }).error, /intensité/i);
  assert.match(pulsionSchema.validate({ ...base, episodes: [{ ...ep, exposed: 'oui' }] }).error, /contenu/i);
  assert.match(pulsionSchema.validate({ ...base, episodes: [{ ...ep, triggers: [3] }] }).error, /déclencheur/i);
  assert.equal(pulsionSchema.validate({ ...base, episodes: null }).ok, false);
  assert.equal(pulsionSchema.validate({ ...base, version: 3 }).ok, false);
});

test('migration 1 → 2 : déclencheur → tags, épisodes vides, anciennes minutes de checks conservées', () => {
  const v1 = { version: 1, days: { '2026-09-19': { urge: 3, checksMin: 10 } },
    events: [{ id: 'a', day: '2026-09-19', ts: '2026-09-19T22:00:00.000Z', nature: 'contenu', trigger: 'Fatigue' },
             { id: 'b', day: '2026-09-18', ts: '2026-09-18T22:00:00.000Z', nature: 'partenaire', trigger: null }] };
  assert.equal(pulsionSchema.validate(v1).ok, true);
  const v2 = migrate(v1, pulsionSchema);
  assert.equal(v2.version, 2);
  assert.deepEqual(v2.events.map(e => e.triggers), [['Fatigue'], []]);
  assert.equal(v2.events[0].trigger, undefined);
  assert.deepEqual(v2.episodes, []);
  assert.deepEqual(v2.days['2026-09-19'], { urge: 3, checksMin: 10 });
  assert.equal(pulsionSchema.validate(v2).ok, true);
});
