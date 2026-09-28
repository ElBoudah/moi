import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stats, marks, lastEvents, episodeDays, lastEpisodes, tagFrequencies, hourHistogram, bilan } from '../../js/modules/pulsion/queries.js';

// Horodatages en heure locale, pour que la répartition horaire soit testable quel que soit le fuseau.
const local = (y, m, d, h, mi = 0) => new Date(y, m - 1, d, h, mi).toISOString();

const doc = { version: 2,
  days: { '2026-09-17': { urge: 3 }, '2026-09-19': { urge: 7 }, '2026-09-20': { urge: 4 } },
  events: [
    { id: 'a', day: '2026-09-19', ts: local(2026, 9, 19, 22), nature: 'sans', triggers: ['Ennui'] },
    { id: 'b', day: '2026-09-19', ts: local(2026, 9, 19, 23, 30), nature: 'contenu', triggers: ['Fatigue', 'Au lit'] },
    { id: 'c', day: '2026-09-20', ts: local(2026, 9, 20, 21), nature: 'partenaire', triggers: [] },
    { id: 'd', day: '2026-09-01', ts: local(2026, 9, 1, 21), nature: 'contenu', triggers: ['Ennui'] },
  ],
  episodes: [
    { id: 'p1', day: '2026-09-18', ts: local(2026, 9, 18, 18), intensity: 4, triggers: ['Image accidentelle'], exposed: true },
    { id: 'p2', day: '2026-09-20', ts: local(2026, 9, 20, 23), intensity: 7, triggers: ['fatigue', 'au lit'], exposed: false },
    { id: 'p3', day: '2026-09-02', ts: local(2026, 9, 2, 23), intensity: 5, triggers: [], exposed: true },
  ] };

test('stats sur 7 jours : pression, épisodes, actes par nature', () => {
  const s = stats(doc, 7, '2026-09-20');
  assert.deepEqual(s.series.urge, [null, null, null, 3, null, 7, 4]);
  assert.equal(s.urge.n, 3);
  assert.equal(s.urgeMax, 7);
  assert.equal(s.evenings4, 2);
  assert.equal(s.episodes.length, 2);
  assert.equal(s.exposed, 1);
  assert.equal(s.intensity.m, 5.5);
  assert.deepEqual(s.byNature.contenu.map(e => e.id), ['b']);
  assert.deepEqual(s.byNature.partenaire.map(e => e.id), ['c']);
});

test('marks, episodeDays, lastEvents, lastEpisodes', () => {
  assert.deepEqual(marks(doc), { '2026-09-19': 'contenu', '2026-09-20': 'partenaire', '2026-09-01': 'contenu' });
  assert.deepEqual([...episodeDays(doc)].sort(), ['2026-09-02', '2026-09-18', '2026-09-20']);
  assert.deepEqual(lastEvents(doc, 3).map(e => e.id), ['c', 'b', 'a']);
  assert.deepEqual(lastEpisodes(doc, 2).map(e => e.id), ['p2', 'p1']);
});

test('tagFrequencies fusionne actes et épisodes, insensible à la casse, libellé de la première occurrence', () => {
  assert.deepEqual(tagFrequencies(doc), [
    { tag: 'Ennui', n: 2 }, { tag: 'Fatigue', n: 2 }, { tag: 'Au lit', n: 2 }, { tag: 'Image accidentelle', n: 1 },
  ]); // à égalité, ordre de première apparition (tri stable)
  assert.deepEqual(tagFrequencies({ version: 2, days: {}, events: [], episodes: [] }), []);
});

test('hourHistogram compte par heure locale', () => {
  const h = hourHistogram(doc.events);
  assert.equal(h.length, 24);
  assert.equal(h[22], 1);
  assert.equal(h[23], 1);
  assert.equal(h[21], 2);
  assert.equal(h.reduce((a, b) => a + b, 0), 4);
  assert.equal(hourHistogram(doc.episodes)[23], 2);
});

test('bilan pulsion : pression, épisodes, déclencheurs, actes', () => {
  const lines = bilan(doc, '2026-09-20').split('\n');
  assert.equal(lines[0], 'PULSION 14/09 → 20/09');
  assert.equal(lines[1], 'Pression : 4,7 ± 2,1/10 · max 7 · soirs ≥4 : 2');
  assert.equal(lines[2], 'Épisodes : 2 · dont 1 avec contenu · intensité 5,5 ± 2,1/10');
  assert.equal(lines[3], 'Déclencheurs : Fatigue ×2, Au lit ×2, Ennui ×1, Image accidentelle ×1');
  assert.equal(lines[4], 'Actes 7 j :');
  assert.equal(lines[5], '  Seul, avec contenu : 19/09 (fatigue, au lit)');
  assert.equal(lines[6], '  Seul, sans contenu : 19/09 (ennui)');
  assert.equal(lines[7], '  Avec partenaire : 20/09');
  const empty = bilan({ version: 2, days: {}, events: [], episodes: [] }, '2026-09-20').split('\n');
  assert.equal(empty[2], 'Épisodes : aucun');
  assert.equal(empty[3], 'Déclencheurs : —');
  assert.equal(empty.at(-1), '  aucun');
});
