import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pulsionSchema, NATURES, NATURE_ORDER, TRIGGERS, emptyDay, isEmptyDay } from '../../js/modules/pulsion/schema.js';

test('constantes et document vide', () => {
  assert.deepEqual(NATURE_ORDER, ['contenu', 'sans', 'partenaire']);
  assert.equal(NATURES.contenu.rank > NATURES.sans.rank && NATURES.sans.rank > NATURES.partenaire.rank, true);
  assert.equal(TRIGGERS.length, 6);
  assert.deepEqual(pulsionSchema.empty(), { version: 1, days: {}, events: [] });
  assert.deepEqual(emptyDay(), { urge: null, checksMin: null });
  assert.equal(isEmptyDay({ urge: null, checksMin: 0 }), false);
});

test('validate accepte un document correct, ids numériques compris', () => {
  const doc = { version: 1,
    days: { '2026-09-20': { urge: 4, checksMin: 20 } },
    events: [{ id: 1726000000000, day: '2026-09-19', ts: '2026-09-19T22:00:00.000Z', nature: 'contenu', trigger: 'Fatigue' },
             { id: 'e2', day: '2026-09-20', ts: '2026-09-20T22:00:00.000Z', nature: 'partenaire', trigger: null }] };
  assert.equal(pulsionSchema.validate(doc).ok, true);
});

test('validate refuse jours et événements mal formés', () => {
  const base = pulsionSchema.empty();
  const ev = { id: 'e', day: '2026-09-19', ts: '2026-09-19T22:00:00.000Z', nature: 'sans', trigger: 'Ennui' };
  assert.match(pulsionSchema.validate({ ...base, days: { '2026-09-20': { urge: 11, checksMin: null } } }).error, /urge/);
  assert.match(pulsionSchema.validate({ ...base, days: { '2026-09-20': { urge: null, checksMin: -1 } } }).error, /checks/);
  assert.match(pulsionSchema.validate({ ...base, events: [{ ...ev, nature: 'resistee' }] }).error, /nature/i);
  assert.match(pulsionSchema.validate({ ...base, events: [{ ...ev, day: '2026-02-30' }] }).error, /jour/i);
  assert.match(pulsionSchema.validate({ ...base, events: [{ ...ev, trigger: 3 }] }).error, /déclencheur/i);
  assert.equal(pulsionSchema.validate({ ...base, events: null }).ok, false);
  assert.equal(pulsionSchema.validate({ ...base, version: 2 }).ok, false);
});
