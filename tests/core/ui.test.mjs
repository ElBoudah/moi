import { test } from 'node:test';
import assert from 'node:assert/strict';
import { escapeHtml, sliderHtml, chipsHtml, dayNavHtml } from '../../js/core/ui.js';

test('escapeHtml neutralise les caractères spéciaux', () => {
  assert.equal(escapeHtml(`<a href="x">&'</a>`), '&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;');
});

test('sliderHtml : valeur vide affichée « — », poignée au milieu, trois ancres', () => {
  const h = sliderHtml({ field: 'mood', label: 'Humeur', value: null, anchors: ['a', 'b', 'c'], cls: 'c-mood' });
  assert.match(h, /data-out="mood">—</);
  assert.match(h, /value="5"/);
  assert.match(h, /data-range="mood"/);
  assert.equal((h.match(/<span>[abc]<\/span>/g) || []).length, 3);
  assert.match(sliderHtml({ field: 'mood', label: 'Humeur', value: 7, anchors: ['a', 'b', 'c'] }), /data-out="mood">7</);
});

test('chipsHtml marque le preset choisi ou la valeur libre', () => {
  const h = chipsHtml({ field: 'checksMin', options: [0, 5, 10], value: 5 });
  assert.match(h, /data-chip="5" class="chip on"|class="chip on" data-chip="5"/);
  assert.match(h, /data-chip="other"/);
  const free = chipsHtml({ field: 'checksMin', options: [0, 5, 10], value: 7 });
  assert.match(free, /class="chip on" data-chip="other"/);
  assert.equal(chipsHtml({ field: 'x', options: [1], value: null, other: false }).includes('other'), false);
});

test('dayNavHtml désactive le jour suivant sur aujourd\'hui', () => {
  assert.match(dayNavHtml('2026-09-20', '2026-09-20'), /data-daynav="1"[^>]*disabled/);
  assert.equal(/data-daynav="1"[^>]*disabled/.test(dayNavHtml('2026-09-19', '2026-09-20')), false);
});
