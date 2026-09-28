import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pvtMetrics, pvt } from '../../js/modules/tests/catalog/pvt.js';
import { PHQ_ITEMS, PHQ_OPTIONS, phqBand, phqMetrics, overlapWarning, phq8 } from '../../js/modules/tests/catalog/phq8.js';
import { CATALOG, testById, summaryFor } from '../../js/modules/tests/catalog/index.js';

// Scène factice : enregistre sans exécuter.
function fakeStage() {
  const el = { innerHTML: '', querySelector: () => el, querySelectorAll: () => [], addEventListener() {}, removeEventListener() {}, classList: { add() {}, remove() {} }, textContent: '' };
  const s = { el, titles: [], timers: [], intervals: [], listeners: [], cleared: 0, results: [],
    title: t => s.titles.push(t), timer: () => {}, body: html => { el.innerHTML = html; },
    timeout: (fn, ms) => { s.timers.push({ fn, ms }); return s.timers.length; }, clearTimeout: () => {},
    interval: (fn, ms) => { s.intervals.push({ fn, ms }); return 1; }, raf: () => 1, cancelRaf: () => {},
    listen: (target, ev, fn) => s.listeners.push({ ev, fn }), clearAll: () => { s.cleared += 1; },
    result: (title, lines, onSave) => s.results.push({ title, lines, onSave }) };
  return s;
}

test('pvtMetrics : médiane, lapses, faux départs, vitesse', () => {
  const m = pvtMetrics([250, 300, 400, 200.4], 2);
  assert.equal(m.n, 4);
  assert.equal(m.median, 275);
  assert.equal(m.mean, 288);
  assert.equal(m.lapses, 1);
  assert.equal(m.falseStarts, 2);
  assert.equal(m.speed, 3.71);
  assert.deepEqual(pvtMetrics([], 3), { n: 0, median: null, mean: null, lapses: 0, falseStarts: 3, speed: null });
});

test('PVT : écran d\'accueil, puis démarrage arme un minuteur et un intervalle, sans onDone', () => {
  const stage = fakeStage();
  let saved = null;
  pvt.run(stage, m => { saved = m; }, { lastRun: null });
  assert.match(stage.el.innerHTML, /Commencer/);
  assert.equal(stage.listeners.length, 1);
  stage.listeners[0].fn(); // tap sur Commencer
  assert.equal(stage.intervals.length, 1);
  assert.ok(stage.timers.length >= 1);
  const isi = stage.timers.find(t => t.ms >= 1000 && t.ms <= 4000);
  assert.ok(isi, 'un intervalle inter-stimulus entre 1 et 4 s est armé');
  assert.equal(saved, null);
  assert.equal(stage.results.length, 0);
  assert.equal(pvt.summary({ metrics: { median: 250, lapses: 2, n: 40 } }), 'PVT 250 ms · 2 lapses');
  assert.equal(pvt.chart.value({ metrics: { median: 250 } }), 250);
});

test('PHQ-8 : items, bandes, métriques, avertissement de recouvrement', () => {
  assert.equal(PHQ_ITEMS.length, 8);
  assert.deepEqual(PHQ_OPTIONS.map(o => o[1]), [0, 1, 2, 3]);
  assert.equal(phqBand(4), 'minimal');
  assert.equal(phqBand(5), 'léger');
  assert.equal(phqBand(14), 'modéré');
  assert.equal(phqBand(15), 'modérément sévère');
  assert.equal(phqBand(20), 'sévère');
  assert.deepEqual(phqMetrics([0, 1, 2, 3, 0, 1, 2, 3]), { score: 12, band: 'modéré', items: [0, 1, 2, 3, 0, 1, 2, 3] });
  assert.equal(overlapWarning(null), null);
  assert.equal(overlapWarning(14), null);
  assert.match(overlapWarning(9), /9 jours/);
  assert.equal(phq8.summary({ metrics: { score: 12, band: 'modéré' } }), 'PHQ-8 12/24 · modéré');
});

test('PHQ-8 : la passation enchaîne les huit questions et ne rend le résultat qu\'à la fin', () => {
  const stage = fakeStage();
  let saved = null;
  phq8.run(stage, m => { saved = m; }, { lastRun: { ts: new Date(Date.now() - 5 * 864e5).toISOString() } });
  assert.match(stage.el.innerHTML, /Commencer/);
  assert.match(stage.el.innerHTML, /5 jours/);
  stage.listeners[0].fn();
  assert.match(stage.el.innerHTML, new RegExp(PHQ_ITEMS[0].slice(0, 20)));
  assert.equal(stage.results.length, 0);
  assert.equal(saved, null);
});

test('catalogue : deux tests, identifiants uniques, libellés de repli', () => {
  assert.deepEqual(CATALOG.map(t => t.id), ['pvt', 'phq8']);
  assert.equal(testById('pvt').label.startsWith('PVT-B'), true);
  assert.equal(testById('nope'), undefined);
  assert.equal(summaryFor({ test: 'span', metrics: { span: 6, correct: 4, trials: 5 } }), 'Empan inversé 6 · 4/5 essais');
  assert.equal(summaryFor({ test: 'corsi', metrics: { span: 5, correct: 3, trials: 4 } }), 'Corsi 5 · 3/4 essais');
  assert.equal(summaryFor({ test: 'sdmt', metrics: { correct: 40, errors: 1 } }), 'Substitution 40 corrects · 1 err.');
  assert.equal(summaryFor({ test: 'fluence', metrics: { sem: 20, pho: 15 } }), 'Fluence 20 / 15');
  assert.equal(summaryFor({ test: 'phq', metrics: { score: 6, band: 'léger' } }), 'PHQ-8 6/24 · léger');
  assert.equal(summaryFor({ test: 'inconnu', metrics: {} }), 'inconnu');
});
