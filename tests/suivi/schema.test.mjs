import { test } from 'node:test';
import assert from 'node:assert/strict';
import { suiviSchema, SLIDERS, ANCHORS, SLEEP_PRESETS, NOTE_MAX, emptyDay, isEmptyDay, isSliderValue } from '../../js/modules/suivi/schema.js';
import { migrate } from '../../js/core/store.js';

test('document vide, jour vide, ancres', () => {
  assert.deepEqual(suiviSchema.empty(), { version: 2, days: {} });
  assert.deepEqual(emptyDay(), { bed: null, wake: null, onsetMin: null, awakeMin: null, clarity: null, mood: null, pleasure: null, drive: null, note: null });
  assert.deepEqual(SLEEP_PRESETS, [0, 10, 20, 30, 45, 60, 90]);
  assert.equal(NOTE_MAX, 140);
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
  const ok = { version: 2, days: { '2026-09-20': { bed: '23:30', wake: '07:10', onsetMin: 20, awakeMin: null, clarity: 6, mood: null, pleasure: 4, drive: 7, note: 'RAS' } } };
  assert.equal(suiviSchema.validate(ok).ok, true);
  const bad = (patch, key = '2026-09-20') => suiviSchema.validate({ version: 2, days: { [key]: { ...ok.days['2026-09-20'], ...patch } } });
  assert.match(bad({ onsetMin: -5 }).error, /onsetMin/);
  assert.match(bad({ awakeMin: 4.5 }).error, /awakeMin/);
  assert.match(bad({ note: 'x'.repeat(141) }).error, /note/i);
  assert.match(bad({ note: 7 }).error, /note/i);
  assert.match(bad({ clarity: 12 }).error, /clarity/);
  assert.match(bad({ bed: '25:00' }).error, /bed/);
  assert.match(bad({}, '2026-02-30').error, /jour/i);
  assert.equal(suiviSchema.validate({ version: 2, days: [] }).ok, false);
  assert.equal(suiviSchema.validate({ version: 2, days: { '2026-09-20': null } }).ok, false);
  assert.equal(suiviSchema.validate({ version: 3, days: {} }).ok, false);
});

test('migration 1 → 2 : les nouveaux champs arrivent à null, un document v1 reste accepté', () => {
  const v1 = { version: 1, days: { '2026-09-20': { bed: '23:30', wake: '07:10', clarity: 6, mood: 5, pleasure: 4, drive: 7 } } };
  assert.equal(suiviSchema.validate(v1).ok, true);
  const v2 = migrate(v1, suiviSchema);
  assert.equal(v2.version, 2);
  assert.deepEqual(v2.days['2026-09-20'], { bed: '23:30', wake: '07:10', onsetMin: null, awakeMin: null, clarity: 6, mood: 5, pleasure: 4, drive: 7, note: null });
});
