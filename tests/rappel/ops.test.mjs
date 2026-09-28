import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Store } from '../../js/core/store.js';
import { rappelSchema } from '../../js/modules/rappel/schema.js';
import { addItems, updateItem, deleteItem, recordReview } from '../../js/modules/rappel/ops.js';
import { memoryStorage, fakeNow, fakeId, resetFakes } from '../fixtures/helpers.mjs';

const T = 1758000000000;
function newStore() {
  resetFakes();
  const store = new Store(memoryStorage(), rappelSchema, { now: fakeNow, makeId: fakeId });
  store.load();
  return store;
}

test('addItems normalise, écarte les vides, ignore un genre inconnu', () => {
  const store = newStore();
  const added = addItems(store, [
    { kind: 'idee', title: ' A ', content: ' a. ' },
    { kind: 'concept', title: 'B', content: 'b.' },
    { kind: 'fait', title: '', content: 'x' },
    { kind: 'fait', title: 'C', content: '   ' },
  ], T);
  assert.deepEqual(added.map(i => [i.id, i.title, i.content, i.kind]), [['id1', 'A', 'a.', 'idee'], ['id2', 'B', 'b.', 'fait']]);
  assert.deepEqual(added[0], { id: 'id1', kind: 'idee', title: 'A', content: 'a.', createdAt: T, lastReview: null, S: null, D: null, reps: 0, lapses: 0, lastQuestions: [] });
  assert.equal(store.doc.items.length, 2);
  assert.deepEqual(addItems(store, [], T), []);
});

test('updateItem et deleteItem', () => {
  const store = newStore();
  addItems(store, [{ kind: 'fait', title: 'A', content: 'a.' }], T);
  updateItem(store, 'id1', { title: ' A2 ', content: 'a2.', kind: 'idee' });
  assert.deepEqual([store.doc.items[0].title, store.doc.items[0].content, store.doc.items[0].kind], ['A2', 'a2.', 'idee']);
  assert.throws(() => updateItem(store, 'id1', { title: '', content: 'x', kind: 'fait' }), /titre/i);
  assert.throws(() => updateItem(store, 'nope', { title: 'x', content: 'x', kind: 'fait' }), /introuvable/i);
  deleteItem(store, 'id1');
  assert.equal(store.doc.items.length, 0);
  assert.throws(() => deleteItem(store, 'id1'), /introuvable/i);
});

test('recordReview applique FSRS tout de suite et garde trois questions', () => {
  const store = newStore();
  addItems(store, [{ kind: 'idee', title: 'A', content: 'a.' }], T);
  let n = 0; store.subscribe(() => { n += 1; });
  const r1 = recordReview(store, 'id1', 3, 'Q1', T + 1000);
  assert.equal(r1.reps, 1);
  assert.equal(r1.lastReview, T + 1000);
  assert.ok(r1.S > 0);
  assert.equal(n, 1);
  recordReview(store, 'id1', 3, 'Q2', T + 86400000, { notify: false });
  recordReview(store, 'id1', 1, 'Q3', T + 2 * 86400000, { notify: false });
  const r4 = recordReview(store, 'id1', 4, 'Q4', T + 3 * 86400000, { notify: false });
  assert.equal(n, 1);
  assert.deepEqual(r4.lastQuestions, ['Q2', 'Q3', 'Q4']);
  assert.equal(r4.reps, 4);
  assert.equal(r4.lapses, 1);
  assert.throws(() => recordReview(store, 'id1', 5, 'Q', T), /verdict/i);
  assert.throws(() => recordReview(store, 'nope', 3, 'Q', T), /introuvable/i);
});
