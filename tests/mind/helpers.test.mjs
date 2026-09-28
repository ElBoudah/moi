import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeDoc } from './fixtures.mjs';
import { weightDots, pathLabel, TYPE_LABEL } from '../../js/modules/mind/views/helpers.js';

test('weightDots rend trois points ou un tiret', () => {
  assert.equal(weightDots(2), '<span class="dots" aria-label="Poids 2 sur 3">●●○</span>');
  assert.equal(weightDots(0), '<span class="dots dots-none" aria-label="Sans poids">—</span>');
});

test('pathLabel joint les ancêtres', () => {
  const doc = makeDoc();
  assert.equal(pathLabel(doc, 'communication'), 'Relations › Papa');
  assert.equal(pathLabel(doc, 'relations'), '');
  assert.deepEqual(Object.keys(TYPE_LABEL), ['thought', 'action', 'decision']);
});
