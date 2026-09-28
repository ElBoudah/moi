import { test } from 'node:test';
import assert from 'node:assert/strict';
import { durMin, bedShift, sleepMin, efficiency, windowKeys, stats, bilan } from '../../js/modules/suivi/queries.js';

const doc = { version: 2, days: {
  '2026-09-18': { bed: '23:50', wake: '07:20', onsetMin: 30, awakeMin: 15, clarity: 6, mood: 5, pleasure: 4, drive: 6, note: 'Soirée calme' },
  '2026-09-19': { bed: '00:10', wake: '07:00', onsetMin: null, awakeMin: null, clarity: 8, mood: 7, pleasure: null, drive: 4, note: null },
  '2026-09-20': { bed: null, wake: null, onsetMin: 20, awakeMin: null, clarity: 7, mood: null, pleasure: 6, drive: null, note: 'Mal dormi <3' },
} };

test('durMin gère le passage de minuit, bedShift recentre sur 18 h', () => {
  assert.equal(durMin({ bed: '23:50', wake: '07:20' }), 450);
  assert.equal(durMin({ bed: '00:10', wake: '07:00' }), 410);
  assert.equal(durMin({ bed: null, wake: '07:00' }), null);
  assert.equal(bedShift('23:50'), 350);
  assert.equal(bedShift('00:10'), 370);
  assert.equal(bedShift(null), null);
});

test('sleepMin et efficiency : temps au lit moins endormissement et réveils', () => {
  assert.equal(sleepMin(doc.days['2026-09-18']), 405);
  assert.equal(sleepMin(doc.days['2026-09-19']), null); // endormissement et réveils non renseignés : nuit non mesurée
  assert.equal(sleepMin(doc.days['2026-09-20']), null);
  assert.equal(sleepMin({ bed: '23:00', wake: '07:00', onsetMin: 400, awakeMin: 400 }), 0);
  assert.equal(efficiency(doc.days['2026-09-18']), 0.9);
  assert.equal(efficiency(doc.days['2026-09-19']), null);
  assert.equal(efficiency({ bed: '23:00', wake: '07:00', onsetMin: 0, awakeMin: null }), 1); // un seul des deux suffit
  assert.equal(efficiency(doc.days['2026-09-20']), null);
});

test('windowKeys liste les jours du plus ancien à aujourd\'hui', () => {
  assert.deepEqual(windowKeys('2026-09-20', 3), ['2026-09-18', '2026-09-19', '2026-09-20']);
});

test('stats sur 7 jours', () => {
  const s = stats(doc, 7, '2026-09-20');
  assert.equal(s.keys.length, 7);
  assert.equal(s.logged, 3);
  assert.equal(s.nights, 2);
  assert.equal(s.dur.m, 430);
  assert.equal(s.sleep.m, 405);
  assert.equal(s.eff, 0.9);
  assert.equal(Math.round(s.bedSD), 14);
  assert.deepEqual(s.series.clarity, [null, null, null, null, 6, 8, 7]);
  assert.equal(s.packs.clarity.n, 3);
  assert.equal(s.packs.clarity.v, 1.5);
  assert.equal(s.packs.mood.n, 2);
  assert.equal(s.packs.mood.v, 2);
});

test('bilan : sommeil avec efficacité, curseurs, notes datées', () => {
  const b = bilan(doc, '2026-09-20');
  const lines = b.split('\n');
  assert.equal(lines.length, 10);
  assert.match(lines[0], /^SUIVI 14\/09 → 20\/09$/);
  assert.equal(lines[1], 'Jours loggés : 3/7');
  assert.equal(lines[2], 'Sommeil : 2 nuits · au lit 7 h 10 ± 28 min · dormi 6 h 45 · efficacité 90 % · régularité du coucher ± 14 min');
  assert.match(lines[3], /^Clarté : 7 ± 1\/10 · variation j\/j 1,5$/);
  assert.match(lines[6], /^Motivation : 5 ± 1,4\/10 · variation j\/j 2$/);
  assert.equal(lines[7], 'Notes :');
  assert.equal(lines[8], '  18/09 : Soirée calme');
  assert.equal(lines[9], '  20/09 : Mal dormi <3');
  assert.equal(bilan({ version: 2, days: {} }, '2026-09-20').split('\n').length, 7);
  const multi = { version: 2, days: { '2026-09-20': { ...doc.days['2026-09-20'], note: 'ligne 1\nligne 2' } } };
  assert.equal(bilan(multi, '2026-09-20').split('\n').at(-1), '  20/09 : ligne 1 ligne 2');
});
