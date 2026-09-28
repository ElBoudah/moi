import { test } from 'node:test';
import assert from 'node:assert/strict';
import { testsSchema } from '../../js/modules/tests/schema.js';

test('le document vide de tests est valide', () => {
  assert.deepEqual(testsSchema.empty(), { version: 1, runs: [] });
  assert.equal(testsSchema.validate(testsSchema.empty()).ok, true);
});

test('validate accepte les runs historiques (id numérique) et refuse les runs mal formés', () => {
  const run = { id: 1726000000000, ts: '2026-09-10T20:00:00.000Z', day: '2026-09-10', test: 'pvt', metrics: { median: 250 } };
  assert.equal(testsSchema.validate({ version: 1, runs: [run] }).ok, true);
  assert.equal(testsSchema.validate({ version: 1, runs: [{ ...run, day: '2026-13-01' }] }).ok, false);
  assert.equal(testsSchema.validate({ version: 1, runs: [{ ...run, metrics: null }] }).ok, false);
  assert.equal(testsSchema.validate({ version: 1, runs: [{ ...run, test: 3 }] }).ok, false);
  assert.equal(testsSchema.validate({ version: 1, runs: null }).ok, false);
});
