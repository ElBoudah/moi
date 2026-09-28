import { test } from 'node:test';
import assert from 'node:assert/strict';
import { suiviSchema, SLIDERS, ANCHORS, emptyDay, isEmptyDay, isSliderValue } from '../../js/modules/suivi/schema.js';

test('document vide, jour vide, ancres', () => {
  assert.deepEqual(suiviSchema.empty(), { version: 1, days: {} });
  assert.deepEqual(emptyDay(), { bed: null, wake: null, clarity: null, mood: null, pleasure: null, drive: null });
  assert.equal(isEmptyDay(emptyDay()), true);
  assert.equal(isEmptyDay({ ...emptyDay(), mood: 0 }), false);
  for (const f of SLIDERS) assert.equal(ANCHORS[f].length, 3);
});

test('isSliderValue accepte 0..10 entiers', () => {
  assert.equal(isSliderValue(0), true);
  assert.equal(isSliderValue(10), true);
  assert.equal(isSliderValue(11), false);
  assert.equal(isSliderValue(5.5), false);
  assert.equal(isSliderValue(null), false);
});

test('validate accepte un document correct et refuse les jours mal formés', () => {
  const ok = { version: 1, days: { '2026-09-20': { bed: '23:30', wake: '07:10', clarity: 6, mood: null, pleasure: 4, drive: 7 } } };
  assert.equal(suiviSchema.validate(ok).ok, true);
  const bad = (patch, key = '2026-09-20') => suiviSchema.validate({ version: 1, days: { [key]: { ...ok.days['2026-09-20'], ...patch } } });
  assert.match(bad({ clarity: 12 }).error, /clarity/);
  assert.match(bad({ bed: '25:00' }).error, /bed/);
  assert.match(bad({}, '2026-02-30').error, /jour/i);
  assert.equal(suiviSchema.validate({ version: 1, days: [] }).ok, false);
  assert.equal(suiviSchema.validate({ version: 1, days: { '2026-09-20': null } }).ok, false);
  assert.equal(suiviSchema.validate({ version: 3, days: {} }).ok, false);
});
