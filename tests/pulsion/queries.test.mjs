import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stats, marks, lastEvents, bilan } from '../../js/modules/pulsion/queries.js';

const doc = { version: 1,
  days: { '2026-09-17': { urge: 3, checksMin: 10 }, '2026-09-19': { urge: 7, checksMin: 15 }, '2026-09-20': { urge: 4, checksMin: 0 } },
  events: [
    { id: 'a', day: '2026-09-19', ts: '2026-09-19T22:00:00.000Z', nature: 'sans', trigger: 'Ennui' },
    { id: 'b', day: '2026-09-19', ts: '2026-09-19T23:30:00.000Z', nature: 'contenu', trigger: 'Fatigue' },
    { id: 'c', day: '2026-09-20', ts: '2026-09-20T21:00:00.000Z', nature: 'partenaire', trigger: null },
    { id: 'd', day: '2026-09-01', ts: '2026-09-01T21:00:00.000Z', nature: 'contenu', trigger: 'Ennui' },
  ] };

test('stats sur 7 jours', () => {
  const s = stats(doc, 7, '2026-09-20');
  assert.deepEqual(s.series.urge, [null, null, null, 3, null, 7, 4]);
  assert.equal(s.urge.n, 3);
  assert.equal(s.urgeMax, 7);
  assert.equal(s.evenings4, 2);
  assert.equal(s.checksVol, 25);
  assert.equal(s.checksDays, 2);
  assert.deepEqual(s.byNature.contenu.map(e => e.id), ['b']);
  assert.deepEqual(s.byNature.partenaire.map(e => e.id), ['c']);
});

test('marks garde la nature la plus lourde du jour', () => {
  assert.deepEqual(marks(doc), { '2026-09-19': 'contenu', '2026-09-20': 'partenaire', '2026-09-01': 'contenu' });
});

test('lastEvents du plus récent au plus ancien', () => {
  assert.deepEqual(lastEvents(doc, 3).map(e => e.id), ['c', 'b', 'a']);
});

test('bilan pulsion', () => {
  const lines = bilan(doc, '2026-09-20').split('\n');
  assert.equal(lines[0], 'PULSION 14/09 → 20/09');
  assert.equal(lines[1], 'Pression : 4,7 ± 2,1/10 · max 7 · soirs ≥4 : 2');
  assert.equal(lines[2], 'Checks : 25 min sur 2 jour(s)');
  assert.equal(lines[3], 'Actes 7 j :');
  assert.equal(lines[4], '  Seul, avec contenu : 19/09 (fatigue)');
  assert.equal(lines[5], '  Seul, sans contenu : 19/09 (ennui)');
  assert.equal(lines[6], '  Avec partenaire : 20/09');
  assert.equal(bilan({ version: 1, days: {}, events: [] }, '2026-09-20').split('\n').at(-1), '  aucun');
});
