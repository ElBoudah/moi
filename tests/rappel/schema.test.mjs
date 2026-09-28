import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rappelSchema, KINDS, normKind } from '../../js/modules/rappel/schema.js';

export const item = (o = {}) => ({ id: 'i1', title: 'Éternel retour', content: 'Nietzsche, Le Gai Savoir §341…', kind: 'idee',
  createdAt: 1758000000000, lastReview: null, S: null, D: null, reps: 0, lapses: 0, lastQuestions: [], ...o });

test('constantes et document vide', () => {
  assert.deepEqual(Object.keys(KINDS), ['fait', 'idee']);
  assert.equal(normKind('idee'), 'idee');
  assert.equal(normKind('concept'), 'fait');
  assert.equal(normKind(undefined), 'fait');
  assert.deepEqual(rappelSchema.empty(), { version: 1, items: [] });
  assert.equal(rappelSchema.key, 'moi.rappel');
});

test('validate accepte une fiche neuve et une fiche révisée, refuse le reste', () => {
  const ok = { version: 1, items: [item(), item({ id: 'i2', lastReview: 1758100000000, S: 3.2, D: 5.1, reps: 2, lapses: 0, lastQuestions: ['q1', 'q2'] })] };
  assert.equal(rappelSchema.validate(ok).ok, true);
  const bad = patch => rappelSchema.validate({ version: 1, items: [item(patch)] });
  assert.match(bad({ title: ' ' }).error, /titre/i);
  assert.match(bad({ content: '' }).error, /contenu/i);
  assert.match(bad({ kind: 'concept' }).error, /genre/i);
  assert.match(bad({ createdAt: 'hier' }).error, /createdAt/);
  assert.match(bad({ lastReview: 1758100000000, S: null }).error, /S/);
  assert.match(bad({ reps: -1 }).error, /reps/);
  assert.match(bad({ lastQuestions: [1] }).error, /questions/i);
  const dup = { version: 1, items: [item(), item()] };
  assert.match(rappelSchema.validate(dup).error, /identifiant/i);
  assert.equal(rappelSchema.validate({ version: 2, items: [] }).ok, false);
  assert.equal(rappelSchema.validate({ version: 1, items: null }).ok, false);
});
