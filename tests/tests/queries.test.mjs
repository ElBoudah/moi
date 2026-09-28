import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Store } from '../../js/core/store.js';
import { testsSchema } from '../../js/modules/tests/schema.js';
import { runsOf, lastRun, history } from '../../js/modules/tests/queries.js';
import { addRun } from '../../js/modules/tests/ops.js';
import { memoryStorage, fakeNow, fakeId, resetFakes } from '../fixtures/helpers.mjs';

const doc = { version: 1, runs: [
  { id: 2, ts: '2026-09-14T09:10:00.000Z', day: '2026-09-14', test: 'span', metrics: { span: 5 } },
  { id: 1, ts: '2026-09-07T09:00:00.000Z', day: '2026-09-07', test: 'pvt', metrics: { median: 260 } },
  { id: 3, ts: '2026-09-14T09:00:00.000Z', day: '2026-09-14', test: 'pvt', metrics: { median: 250 } },
] };

test('runsOf, lastRun, history', () => {
  assert.deepEqual(runsOf(doc, 'pvt').map(r => r.id), [1, 3]);
  assert.equal(lastRun(doc, 'pvt').id, 3);
  assert.equal(lastRun(doc, 'phq8'), null);
  assert.deepEqual(history(doc, 2).map(r => r.id), [2, 3]);
  assert.deepEqual(history(doc).map(r => r.id), [2, 3, 1]);
});

test('addRun enregistre un run daté, avec ou sans notification', () => {
  resetFakes();
  const store = new Store(memoryStorage(), testsSchema, { now: fakeNow, makeId: fakeId });
  store.load();
  let n = 0; store.subscribe(() => { n += 1; });
  const r = addRun(store, 'pvt', { median: 240 }, '2026-09-20');
  assert.deepEqual(r, { id: 'id1', ts: '2026-09-20T10:01:00.000Z', day: '2026-09-20', test: 'pvt', metrics: { median: 240 } });
  assert.equal(n, 1);
  addRun(store, 'phq8', { score: 3 }, '2026-09-20', { notify: false });
  assert.equal(n, 1);
  assert.equal(store.doc.runs.length, 2);
  assert.throws(() => addRun(store, 'pvt', null, '2026-09-20'), /métriques/i);
});
