import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeDoc } from './fixtures.mjs';
import { Store } from '../../js/core/store.js';
import { mindSchema } from '../../js/modules/mind/schema.js';
import * as q from '../../js/modules/mind/queries.js';
import { createSubject, renameSubject, setIntent, setWeight, moveSubject, restSubject, resumeSubject, deletionImpact, deleteSubject, addEntry, updateEntry, deleteEntry, completeAction } from '../../js/modules/mind/ops.js';
import { memoryStorage, fakeNow, fakeId, resetFakes } from '../fixtures/helpers.mjs';

function newStore(doc = makeDoc()) {
  resetFakes();
  const storage = memoryStorage({ 'moi.mind': JSON.stringify(doc) });
  const store = new Store(storage, mindSchema, { now: fakeNow, makeId: fakeId });
  store.load();
  return { store, storage };
}

test('createSubject ajoute un enfant avec le bon order, ou une racine sans thème préalable', () => {
  const { store } = newStore();
  const s = createSubject(store, { title: '  Alice ', parentId: 'relations' });
  assert.equal(s.title, 'Alice');
  assert.equal(s.parentId, 'relations');
  assert.equal(s.order, 3);
  assert.equal(s.weight, 0);
  assert.throws(() => createSubject(store, { title: '   ', parentId: 'relations' }), /titre/i);
  assert.throws(() => createSubject(store, { title: 'X', parentId: 'inexistant' }), /parent/i);
  const { store: empty } = newStore(mindSchema.empty());
  const root = createSubject(empty, { title: 'Relations' });
  assert.equal(root.parentId, null);
  assert.equal(root.order, 1);
  assert.deepEqual(q.roots(empty.doc).map(x => x.id), [root.id]);
});

test('setIntent sauvegarde sans notifier', () => {
  const { store, storage } = newStore();
  let notified = 0;
  store.subscribe(() => { notified += 1; });
  setIntent(store, 'papa', 'Nouvelle intention');
  assert.equal(notified, 0);
  assert.equal(JSON.parse(storage.getItem('moi.mind')).subjects.find(s => s.id === 'papa').intent, 'Nouvelle intention');
});

test('renameSubject et setIntent', () => {
  const { store } = newStore();
  renameSubject(store, 'papa', ' Mon père ');
  setIntent(store, 'papa', 'Retrouver de la complicité.');
  assert.equal(q.subjectById(store.doc, 'papa').title, 'Mon père');
  assert.equal(q.subjectById(store.doc, 'papa').intent, 'Retrouver de la complicité.');
  assert.throws(() => renameSubject(store, 'papa', ''), /titre/i);
});

test('setWeight change le poids et trace une entrée, une seule par jour', () => {
  const { store } = newStore();
  const before = store.doc.entries.length;
  setWeight(store, 'laura', 2);
  assert.equal(q.subjectById(store.doc, 'laura').weight, 2);
  const last = store.doc.entries.at(-1);
  assert.equal(last.type, 'weight');
  assert.equal(last.content, '2');
  setWeight(store, 'laura', 2);
  assert.equal(store.doc.entries.length, before + 1);
  setWeight(store, 'laura', 3);
  const weights = store.doc.entries.filter(e => e.subjectId === 'laura' && e.type === 'weight');
  assert.equal(weights.length, 1);
  assert.equal(weights[0].content, '3');
  setWeight(store, 'job', 3); // e-job-2 date du 18/09, fakeNow du 20/09 : nouvelle entrée
  assert.equal(store.doc.entries.filter(e => e.subjectId === 'job' && e.type === 'weight').length, 2);
  assert.throws(() => setWeight(store, 'relations', 1), /racine|thème/i);
  assert.throws(() => setWeight(store, 'laura', 4), /poids/i);
});

test('moveSubject refuse un descendant, lui-même et une cible posée ; vers la racine remet le poids à 0', () => {
  const { store } = newStore();
  assert.throws(() => moveSubject(store, 'papa', 'communication'), /descendant/i);
  assert.throws(() => moveSubject(store, 'papa', 'papa'), /lui-même/i);
  assert.throws(() => moveSubject(store, 'papa', 'moi'), /posé/i);
  assert.equal(q.subjectById(store.doc, 'papa').parentId, 'relations');
  moveSubject(store, 'laura', 'travail');
  assert.equal(q.subjectById(store.doc, 'laura').parentId, 'travail');
  assert.equal(q.subjectById(store.doc, 'laura').order, 2);
  moveSubject(store, 'papa', null);
  assert.equal(q.subjectById(store.doc, 'papa').parentId, null);
  assert.equal(q.subjectById(store.doc, 'papa').weight, 0);
  assert.equal(q.subjectById(store.doc, 'papa').order, 4);
});

test('restSubject pose et note un dernier mot ; resumeSubject reprend', () => {
  const { store } = newStore();
  restSubject(store, 'papa', ' On en est là. ');
  assert.ok(q.subjectById(store.doc, 'papa').restedAt);
  const last = store.doc.entries.at(-1);
  assert.equal(last.type, 'thought');
  assert.equal(last.content, 'On en est là.');
  resumeSubject(store, 'papa');
  assert.equal(q.subjectById(store.doc, 'papa').restedAt, null);
  const n = store.doc.entries.length;
  restSubject(store, 'papa');
  assert.equal(store.doc.entries.length, n);
});

test('deletionImpact et deleteSubject suppriment le sous-arbre', () => {
  const { store } = newStore();
  assert.deepEqual(deletionImpact(store, 'papa'), { subjects: 3, entries: 6 });
  assert.deepEqual(deleteSubject(store, 'papa'), { subjects: 3, entries: 6 });
  assert.ok(!store.doc.subjects.some(s => ['papa', 'communication', 'vacances'].includes(s.id)));
  assert.ok(!store.doc.entries.some(e => ['papa', 'communication', 'vacances'].includes(e.subjectId)));
  assert.equal(store.doc.subjects.length, 6);
});

test('addEntry crée pensée, décision ou action ouverte', () => {
  const { store } = newStore();
  const a = addEntry(store, 'laura', 'action', ' Proposer une rando ');
  assert.equal(a.content, 'Proposer une rando');
  assert.equal(a.doneAt, null);
  const d = addEntry(store, 'laura', 'decision', 'Je propose une activité, pas un café.');
  assert.equal(d.type, 'decision');
  assert.throws(() => addEntry(store, 'laura', 'weight', '2'), /type/i);
  assert.throws(() => addEntry(store, 'laura', 'thought', '  '), /vide/i);
  assert.throws(() => addEntry(store, 'inexistant', 'thought', 'x'), /sujet/i);
});

test('updateEntry et deleteEntry', () => {
  const { store } = newStore();
  updateEntry(store, 'e-papa-1', ' Corrigé ');
  assert.equal(store.doc.entries.find(e => e.id === 'e-papa-1').content, 'Corrigé');
  assert.throws(() => updateEntry(store, 'e-papa-1', ''), /vide/i);
  deleteEntry(store, 'e-papa-1');
  assert.ok(!store.doc.entries.some(e => e.id === 'e-papa-1'));
  assert.throws(() => deleteEntry(store, 'e-papa-1'), /introuvable/i);
});

test('completeAction remplit doneAt et la fait passer au journal', () => {
  const { store } = newStore();
  completeAction(store, 'e-papa-3');
  const e = store.doc.entries.find(x => x.id === 'e-papa-3');
  assert.ok(e.doneAt);
  assert.ok(!q.openActions(store.doc, 'papa').some(x => x.id === 'e-papa-3'));
  assert.ok(q.journal(store.doc, 'papa').some(x => x.id === 'e-papa-3'));
  assert.throws(() => completeAction(store, 'e-papa-3'), /déjà/i);
  assert.throws(() => completeAction(store, 'e-papa-1'), /action/i);
});
