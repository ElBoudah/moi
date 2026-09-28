import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeDoc } from './fixtures.mjs';
import { mindSchema, validateDoc, ENTRY_TYPES } from '../../js/modules/mind/schema.js';
import { Store } from '../../js/core/store.js';
import { memoryStorage, fakeNow, fakeId, resetFakes } from '../fixtures/helpers.mjs';

test('document vide : aucun sujet, aucune entrée', () => {
  assert.deepEqual(mindSchema.empty(), { version: 1, subjects: [], entries: [] });
  assert.equal(mindSchema.key, 'moi.mind');
  assert.deepEqual(ENTRY_TYPES, ['thought', 'decision', 'action', 'weight']);
});

test('validateDoc accepte un document correct', () => {
  assert.equal(validateDoc(makeDoc()).ok, true);
  assert.equal(mindSchema.validate(makeDoc()).ok, true);
});

test('validateDoc refuse les documents incohérents avec un message français', () => {
  assert.equal(validateDoc(null).ok, false);
  assert.equal(validateDoc({ version: 99, subjects: [], entries: [] }).ok, false);
  const dupId = makeDoc(); dupId.subjects[1].id = dupId.subjects[0].id;
  assert.match(validateDoc(dupId).error, /identifiant/i);
  const orphan = makeDoc(); orphan.subjects[1].parentId = 'inexistant';
  assert.match(validateDoc(orphan).error, /parent/i);
  const badEntry = makeDoc(); badEntry.entries[0].subjectId = 'inexistant';
  assert.match(validateDoc(badEntry).error, /sujet/i);
  const cycle = makeDoc(); cycle.subjects.find(s => s.id === 'relations').parentId = 'papa';
  assert.match(validateDoc(cycle).error, /cycle/i);
  const badType = makeDoc(); badType.entries[0].type = 'note';
  assert.match(validateDoc(badType).error, /type/i);
  const badWeight = makeDoc(); badWeight.subjects[1].weight = 7;
  assert.match(validateDoc(badWeight).error, /poids/i);
  const rootWeight = makeDoc(); rootWeight.subjects.find(s => s.id === 'relations').weight = 2;
  assert.match(validateDoc(rootWeight).error, /racine|thème/i);
  assert.equal(validateDoc({ version: 1, subjects: [null], entries: [] }).ok, false);
  assert.equal(validateDoc({ version: 1, subjects: [], entries: [null] }).ok, false);
});

test('le Store générique charge, met de côté un document illisible et importe', () => {
  resetFakes();
  const storage = memoryStorage({ 'moi.mind': '{pas du json' });
  const store = new Store(storage, mindSchema, { now: fakeNow, makeId: fakeId });
  store.load();
  assert.equal(store.doc.subjects.length, 0);
  assert.equal(store.corrupt, '{pas du json');
  store.importJson(JSON.stringify(makeDoc()));
  assert.equal(store.doc.subjects.length, 9);
  assert.throws(() => store.importJson(JSON.stringify({ version: 1, subjects: [], entries: [{ id: 'x' }] })), /entrée|sujet/i);
  assert.equal(store.doc.subjects.length, 9);
});
