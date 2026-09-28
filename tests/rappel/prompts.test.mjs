import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GRADES, gradeFromVerdict, questionPrompt, gradePrompt, extractPrompt } from '../../js/modules/rappel/prompts.js';
import { item } from './schema.test.mjs';

test('verdicts', () => {
  assert.deepEqual(GRADES.map(g => g.g), [1, 2, 3, 4]);
  assert.equal(gradeFromVerdict('easy'), 4);
  assert.equal(gradeFromVerdict('again'), 1);
  assert.equal(gradeFromVerdict('n\'importe quoi'), 2);
});

test('questionPrompt selon le genre et le palier, avec les dernières questions', () => {
  const fait = questionPrompt(item({ kind: 'fait', title: 'Bataille de Marignan', content: '1515.' }), 'restitution');
  assert.match(fait, /Bataille de Marignan/);
  assert.match(fait, /jamais de QCM/i);
  assert.match(fait, /direction/i);
  assert.match(fait, /nomme son objet/i);
  const idee = questionPrompt(item({ lastQuestions: ['Q1 ?', 'Q2 ?'] }), 'explication');
  assert.match(idee, /pourquoi/i);
  assert.match(idee, /Q1 \?/);
  assert.match(idee, /NE PAS reformuler/);
  assert.equal(questionPrompt(item(), 'restitution').includes('NE PAS reformuler'), false);
  assert.match(fait, /\{"question"/);
});

test('gradePrompt : exactitude pour un fait, compréhension pour une idée, explication ciblée', () => {
  const f = gradePrompt(item({ kind: 'fait' }), 'Quand ?', '1516', 'restitution');
  assert.match(f, /exacte et complète/i);
  assert.match(f, /1516/);
  const i = gradePrompt(item({ kind: 'idee' }), 'En quoi… ?', 'Parce que…', 'explication');
  assert.match(i, /comprise/i);
  assert.match(i, /3 à 5 phrases/);
  assert.match(i, /jamais.*au-delà/i);
  assert.match(i, /\{"verdict"/);
});

test('extractPrompt : nombre demandé ou auto', () => {
  const three = extractPrompt('L\'éternel retour de Nietzsche', 3);
  assert.match(three, /exactement 3 fiches/i);
  assert.match(three, /éternel retour/);
  const auto = extractPrompt('dump', 'auto');
  assert.match(auto, /une idée = une fiche/i);
  assert.match(auto, /"kind"/);
});
