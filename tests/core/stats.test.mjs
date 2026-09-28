import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mean, sd, masd, median, fmt, pm, pack } from '../../js/core/stats.js';

test('mean, sd, median sur listes vides ou courtes', () => {
  assert.equal(mean([]), null);
  assert.equal(mean([2, 4]), 3);
  assert.equal(sd([5]), null);
  assert.equal(Math.round(sd([2, 4, 4, 4, 5, 5, 7, 9]) * 1000) / 1000, 2.138);
  assert.equal(median([]), null);
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([4, 1, 3, 2]), 3); // arrondi de 2,5
});

test('masd mesure la variation entre jours consécutifs, trous exclus', () => {
  assert.equal(masd([9, 2, 8, 1]), 20 / 3);
  assert.equal(masd([1, 2, 8, 9]), 8 / 3);
  assert.equal(masd([1, null, 3]), null);
  assert.equal(masd([1, 3, null, 7]), 2);
});

test('fmt et pm formatent avec une virgule', () => {
  assert.equal(fmt(null), '—');
  assert.equal(fmt(6.26), '6,3');
  assert.equal(pm(6.26, 1.04, '/10'), '6,3 ± 1/10');
  assert.equal(pm(6, null), '6');
  assert.equal(pm(null, 1), '—');
});

test('pack agrège une série avec trous', () => {
  const p = pack([4, null, 6]);
  assert.equal(p.m, 5);
  assert.equal(p.n, 2);
  assert.equal(p.v, null);
  assert.equal(Math.round(p.sd * 100) / 100, 1.41);
});
