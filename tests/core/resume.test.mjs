import { test } from 'node:test';
import assert from 'node:assert/strict';
import { watchDayChange } from '../../js/core/resume.js';

test('watchDayChange appelle onChange au retour au premier plan seulement si le jour a changé', () => {
  const listeners = {};
  const doc = { visibilityState: 'visible', addEventListener: (ev, fn) => { listeners[ev] = fn; } };
  let day = '2026-09-20';
  const calls = [];
  watchDayChange({ today: () => day, onChange: d => calls.push(d), doc });
  listeners.visibilitychange();
  assert.deepEqual(calls, []);
  day = '2026-09-21';
  listeners.visibilitychange();
  assert.deepEqual(calls, ['2026-09-21']);
  listeners.visibilitychange();
  assert.deepEqual(calls, ['2026-09-21']); // pas de rappel tant que le jour ne rechange pas
  doc.visibilityState = 'hidden';
  day = '2026-09-22';
  listeners.visibilitychange();
  assert.deepEqual(calls, ['2026-09-21']); // passage en arrière-plan : rien
});
