import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStage } from '../../js/modules/tests/stage.js';

function fakeRoot() {
  const el = { innerHTML: '', textContent: '', classList: { add() {}, remove() {} }, onclick: null,
    querySelector: () => el, querySelectorAll: () => [], addEventListener() {}, removeEventListener() {} };
  return { innerHTML: '', querySelector: () => el, _el: el };
}

test('clearAll arrête minuteurs, intervalles et écouteurs', async () => {
  const root = fakeRoot();
  const stage = createStage(root, {});
  let fired = 0;
  stage.timeout(() => { fired += 1; }, 10);
  stage.interval(() => { fired += 1; }, 5);
  stage.raf(() => { fired += 1; });
  const target = { added: 0, removed: 0, addEventListener() { this.added += 1; }, removeEventListener() { this.removed += 1; } };
  stage.listen(target, 'click', () => {});
  assert.equal(target.added, 1);
  stage.clearAll();
  await new Promise(r => setTimeout(r, 40));
  assert.equal(fired, 0);
  assert.equal(target.removed, 1);
});

test('un minuteur écoulé se retire de la liste, result nettoie et branche Enregistrer', async () => {
  const root = fakeRoot();
  const stage = createStage(root, {});
  let fired = 0;
  stage.timeout(() => { fired += 1; }, 5);
  await new Promise(r => setTimeout(r, 20));
  assert.equal(fired, 1);
  let saved = 0;
  stage.result('Fin', ['a', 'b'], () => { saved += 1; });
  assert.match(root._el.innerHTML, /Enregistrer/);
  root._el.onclick();
  assert.equal(saved, 1);
});

test('le bouton Quitter nettoie puis appelle onQuit', () => {
  const root = fakeRoot();
  let quit = 0;
  const stage = createStage(root, { onQuit: () => { quit += 1; } });
  let fired = 0;
  stage.timeout(() => { fired += 1; }, 5);
  root._el.onclick();
  assert.equal(quit, 1);
  return new Promise(r => setTimeout(() => { assert.equal(fired, 0); r(); }, 20));
});
