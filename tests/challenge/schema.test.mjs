import { test } from 'node:test';
import assert from 'node:assert/strict';
import { challengeSchema, DURATIONS, isTarget, targetLabel } from '../../js/modules/challenge/schema.js';

const ok = () => ({ version: 1, challenges: [
  { id: 'c1', title: 'Cardio', target: { perWeek: 3 }, startDay: '2026-09-01', days: 30, endedAt: null, done: { '2026-09-02': true } },
  { id: 'c0', title: 'Lecture', target: { daily: true }, startDay: '2026-07-01', days: 14, endedAt: '2026-07-14T23:59:59.000Z', done: {} },
] });

test('constantes, cibles, libellés', () => {
  assert.deepEqual(DURATIONS, [14, 30, 60]);
  assert.equal(isTarget({ daily: true }), true);
  assert.equal(isTarget({ perWeek: 7 }), true);
  assert.equal(isTarget({ perWeek: 0 }), false);
  assert.equal(isTarget({ perWeek: 2.5 }), false);
  assert.equal(isTarget({ daily: true, perWeek: 3 }), false);
  assert.equal(isTarget(null), false);
  assert.equal(targetLabel({ daily: true }), 'tous les jours');
  assert.equal(targetLabel({ perWeek: 1 }), '1 fois par semaine');
  assert.equal(targetLabel({ perWeek: 3 }), '3 fois par semaine');
  assert.deepEqual(challengeSchema.empty(), { version: 1, challenges: [] });
});

test('validate accepte un document correct et refuse les challenges mal formés', () => {
  assert.equal(challengeSchema.validate(ok()).ok, true);
  const bad = patch => { const d = ok(); Object.assign(d.challenges[0], patch); return challengeSchema.validate(d); };
  assert.match(bad({ title: '  ' }).error, /titre/i);
  assert.match(bad({ target: { perWeek: 9 } }).error, /cible/i);
  assert.match(bad({ days: 21 }).error, /durée/i);
  assert.match(bad({ startDay: '2026-02-30' }).error, /jour/i);
  assert.match(bad({ done: { hier: true } }).error, /done/i);
  assert.match(bad({ done: { '2026-09-02': false } }).error, /done/i);
  assert.match(bad({ endedAt: 5 }).error, /endedAt/);
  assert.equal(challengeSchema.validate({ version: 1, challenges: [null] }).ok, false);
  assert.equal(challengeSchema.validate({ version: 2, challenges: [] }).ok, false);
  const dup = ok(); dup.challenges[1].id = 'c1';
  assert.match(challengeSchema.validate(dup).error, /identifiant/i);
});
