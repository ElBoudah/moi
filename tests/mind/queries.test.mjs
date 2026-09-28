import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeDoc } from './fixtures.mjs';
import * as q from '../../js/modules/mind/queries.js';

test('subjectById retourne le sujet ou undefined', () => {
  const doc = makeDoc();
  assert.equal(q.subjectById(doc, 'papa').title, 'Papa');
  assert.equal(q.subjectById(doc, 'nope'), undefined);
});

test('children exclut les posés par défaut et trie par order', () => {
  const doc = makeDoc();
  assert.deepEqual(q.children(doc, 'papa').map(s => s.id), ['communication']);
  assert.deepEqual(q.children(doc, 'papa', { includeRested: true }).map(s => s.id), ['communication', 'vacances']);
  assert.deepEqual(q.children(doc, 'relations').map(s => s.id), ['papa', 'laura']);
});

test('roots retourne les racines actives triées', () => {
  assert.deepEqual(q.roots(makeDoc()).map(s => s.id), ['relations', 'travail']);
});

test('ancestors va de la racine au parent direct', () => {
  const doc = makeDoc();
  assert.deepEqual(q.ancestors(doc, 'communication').map(s => s.id), ['relations', 'papa']);
  assert.deepEqual(q.ancestors(doc, 'relations'), []);
});

test('descendantIds liste tout le sous-arbre sans le sujet lui-même', () => {
  const doc = makeDoc();
  assert.deepEqual(q.descendantIds(doc, 'relations').sort(), ['communication', 'laura', 'papa', 'vacances']);
  assert.deepEqual(q.descendantIds(doc, 'laura'), []);
});

test('isActive tient compte des ancêtres posés', () => {
  const doc = makeDoc();
  assert.equal(q.isActive(doc, 'papa'), true);
  assert.equal(q.isActive(doc, 'vacances'), false);
  assert.equal(q.isActive(doc, 'trail'), false);
  assert.equal(q.isActive(doc, 'moi'), false);
});

test('lastUpdatedAt prend la dernière entrée, sinon la création', () => {
  const doc = makeDoc();
  assert.equal(q.lastUpdatedAt(doc, 'papa'), '2026-09-14T10:00:00.000Z');
  assert.equal(q.lastUpdatedAt(doc, 'relations'), '2026-09-01T10:00:00.000Z');
});

test('weighing : actifs, non racines, poids > 0, tri poids desc puis plus ancien d\'abord', () => {
  const ids = q.weighing(makeDoc()).map(s => s.id);
  // papa 3 ; communication 2 (maj 16/09) et job 2 (maj 18/09) → communication d'abord ; vacances posé, trail inactif, laura 0
  assert.deepEqual(ids, ['papa', 'communication', 'job']);
});

test('openActions sur tout l\'arbre exclut faits, posés et inactifs', () => {
  const ids = q.openActions(makeDoc()).map(e => e.id);
  assert.deepEqual(ids, ['e-job-1', 'e-papa-3', 'e-com-1', 'e-laura-1']);
});

test('openActions sur un sous-arbre inclut le sujet et ses enfants actifs', () => {
  const ids = q.openActions(makeDoc(), 'papa').map(e => e.id);
  assert.deepEqual(ids, ['e-papa-3', 'e-com-1']);
});

test('journal exclut les actions ouvertes, plus récent en haut', () => {
  const ids = q.journal(makeDoc(), 'papa').map(e => e.id);
  assert.deepEqual(ids, ['e-papa-4', 'e-papa-2', 'e-papa-1']);
});

test('journal trie par date affichée : une action faite remonte à sa date de réalisation', () => {
  const doc = makeDoc();
  // e-papa-4 créée le 14/09, faite le 15/09 ; ajoutons une pensée du 14/09 à 12h : elle doit passer SOUS l'action faite le 15
  doc.entries.push({ id: 'e-papa-5', subjectId: 'papa', type: 'thought', content: 'x', createdAt: '2026-09-14T12:00:00.000Z', doneAt: null });
  assert.deepEqual(q.journal(doc, 'papa').map(e => e.id), ['e-papa-4', 'e-papa-5', 'e-papa-2', 'e-papa-1']);
  // et une action créée le 01/09 mais faite le 19/09 passe en tête
  doc.entries.push({ id: 'e-papa-6', subjectId: 'papa', type: 'action', content: 'y', createdAt: '2026-09-01T10:00:00.000Z', doneAt: '2026-09-19T10:00:00.000Z' });
  assert.equal(q.journal(doc, 'papa')[0].id, 'e-papa-6');
});

test('activeCount compte les descendants actifs', () => {
  const doc = makeDoc();
  assert.equal(q.activeCount(doc, 'relations'), 3); // papa, communication, laura
  assert.equal(q.activeCount(doc, 'moi'), 0);
});

test('restedSubjects trie du plus récemment posé au plus ancien', () => {
  assert.deepEqual(q.restedSubjects(makeDoc()).map(s => s.id), ['moi', 'vacances']);
});

test('normalize et search ignorent casse et accents', () => {
  assert.equal(q.normalize('  Élève À '), 'eleve a');
  const doc = makeDoc();
  assert.deepEqual(q.search(doc, 'PAPA').map(s => s.id), ['papa']);
  assert.deepEqual(q.search(doc, 'vacan').map(s => s.id), ['vacances']); // posé inclus
  assert.deepEqual(q.search(doc, ''), []);
});

test('moveTargets exclut le sujet et ses descendants', () => {
  const ids = q.moveTargets(makeDoc(), 'papa').map(s => s.id);
  assert.ok(!ids.includes('papa'));
  assert.ok(!ids.includes('communication'));
  assert.ok(ids.includes('relations'));
  assert.ok(ids.includes('laura'));
  assert.ok(!ids.includes('moi')); // posé
});

test('activeSubjectsByPath liste tous les actifs triés par chemin', () => {
  const ids = q.activeSubjectsByPath(makeDoc()).map(s => s.id);
  assert.deepEqual(ids, ['relations', 'laura', 'papa', 'communication', 'travail', 'job']);
});

test('journalTree agrège le sous-arbre : tout du sujet, sans les poids des enfants, sans les actions ouvertes', () => {
  const doc = makeDoc();
  doc.entries.push(
    { id: 'e-com-2', subjectId: 'communication', type: 'thought', content: 'On a parlé.', createdAt: '2026-09-17T10:00:00.000Z', doneAt: null },
    { id: 'e-com-3', subjectId: 'communication', type: 'weight', content: '2', createdAt: '2026-09-18T10:00:00.000Z', doneAt: null },
  );
  const ids = q.journalTree(doc, 'papa').map(e => e.id);
  // e-com-2 (17/09) entre e-papa-4 (fait 15/09)... non : 17 > 15 donc e-com-2 d'abord ; e-com-3 poids d'un enfant exclu ; e-com-1 et e-vac-1 actions ouvertes exclues
  assert.deepEqual(ids, ['e-com-2', 'e-papa-4', 'e-papa-2', 'e-papa-1']);
  // le poids du sujet lui-même reste visible
  assert.ok(q.journalTree(doc, 'job').map(e => e.id).includes('e-job-2'));
  // un sujet sans descendant : identique à journal
  assert.deepEqual(q.journalTree(doc, 'laura'), q.journal(doc, 'laura'));
});

test('relativePathLabel donne le chemin sous un ancêtre', () => {
  const doc = makeDoc();
  assert.equal(q.relativePathLabel(doc, 'relations', 'communication'), 'Papa › Communication');
  assert.equal(q.relativePathLabel(doc, 'papa', 'communication'), 'Communication');
  assert.equal(q.relativePathLabel(doc, 'papa', 'papa'), '');
});
