// Écritures différées des curseurs. Une PWA mise en arrière-plan ou fermée tue le JS
// immédiatement : une écriture en attente serait perdue. D'où flushDeferred, que app.js
// branche sur visibilitychange, pagehide et chaque changement de route.
const pending = new Map();
let timer = null;

export function deferWrite(key, fn, ms = 350) {
  pending.set(key, fn);
  clearTimeout(timer);
  timer = setTimeout(flushDeferred, ms);
}

export function flushDeferred() {
  clearTimeout(timer);
  timer = null;
  const fns = [...pending.values()];
  pending.clear();
  for (const fn of fns) fn();
}
