import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sparkline } from '../../js/core/chart.js';

test('série vide : message, pas de SVG', () => {
  const h = sparkline({ values: [null, null] });
  assert.match(h, /pas encore de données/);
  assert.equal(h.includes('<svg'), false);
});

test('un trou coupe le trait : deux segments M', () => {
  const h = sparkline({ values: [2, null, 5, 6] });
  const d = h.match(/<path d="([^"]+)"/)[1];
  assert.equal((d.match(/M/g) || []).length, 2);
  assert.equal((d.match(/L/g) || []).length, 1);
  assert.equal((h.match(/<circle/g) || []).length, 3);
  assert.equal((h.match(/class="chart-grid"/g) || []).length, 3);
});

test('repères verticaux et absence de points au-delà de 30 valeurs', () => {
  const values = Array.from({ length: 40 }, (_, i) => i % 10);
  const h = sparkline({ values, marks: [{ i: 3, color: 'red' }, { i: 99, color: 'blue' }, { i: 5, color: 'grey', dashed: true }] });
  assert.equal((h.match(/stroke="red"/g) || []).length, 1);
  assert.equal(h.includes('stroke="blue"'), false);
  assert.match(h, /stroke-dasharray="2 2"/);
  assert.equal(h.includes('<circle'), false);
});

test('échelle automatique : valeurs plates et valeur unique sans NaN', () => {
  for (const values of [[3, 3, 3], [250]]) {
    const h = sparkline({ values, min: null, max: null });
    assert.equal(h.includes('NaN'), false);
    assert.equal(h.includes('chart-grid'), false);
  }
});
