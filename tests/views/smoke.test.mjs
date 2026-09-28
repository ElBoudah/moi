// Smoke test des vues sans navigateur : un root minimal (innerHTML, querySelector inerte),
// des stores en mémoire, et on vérifie que chaque écran se rend avec ses blocs attendus.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Store } from '../../js/core/store.js';
import { suiviSchema } from '../../js/modules/suivi/schema.js';
import { pulsionSchema } from '../../js/modules/pulsion/schema.js';
import { testsSchema } from '../../js/modules/tests/schema.js';
import { settingsSchema } from '../../js/modules/settings/schema.js';
import * as suiviDay from '../../js/modules/suivi/views/day.js';
import * as suiviData from '../../js/modules/suivi/views/data.js';
import { memoryStorage, fakeNow, fakeId, resetFakes } from '../fixtures/helpers.mjs';

export function fakeRoot() {
  return { innerHTML: '', querySelector: () => ({ classList: { toggle() {} } }), querySelectorAll: () => [] };
}

export function makeCtx() {
  resetFakes();
  const storage = memoryStorage();
  const schemas = { settings: settingsSchema, suivi: suiviSchema, pulsion: pulsionSchema, tests: testsSchema };
  const stores = Object.fromEntries(Object.entries(schemas).map(([n, s]) => [n, new Store(storage, s, { now: fakeNow, makeId: fakeId })]));
  for (const s of Object.values(stores)) s.load();
  stores.suivi.commit(d => { d.days['2026-09-19'] = { bed: '23:30', wake: '07:00', clarity: 6, mood: 5, pleasure: 4, drive: 7 }; });
  stores.pulsion.commit(d => {
    d.days['2026-09-19'] = { urge: 4, checksMin: 10 };
    d.events.push({ id: 'e1', day: '2026-09-19', ts: '2026-09-19T22:00:00.000Z', nature: 'contenu', trigger: 'Fatigue' });
  });
  const notices = [];
  return {
    stores, schemas, storage, notices,
    navigate: () => {}, notice: m => notices.push(m), today: () => '2026-09-20',
    applyTheme: () => {}, version: '0.0.0', getBundle: () => '{}',
  };
}

test('Suivi jour : sommeil, quatre curseurs ancrés, navigateur de jour', () => {
  const root = fakeRoot(), ctx = makeCtx();
  suiviDay.render(root, ctx);
  assert.match(root.innerHTML, /data-time="bed"/);
  assert.equal((root.innerHTML.match(/data-range="/g) || []).length, 4);
  assert.match(root.innerHTML, /brouillard, je relis trois fois/);
  assert.match(root.innerHTML, /data-daynav="1"[^>]*disabled/);
  assert.equal(typeof root.oninput, 'function');
});

test('Suivi données : bloc 7 jours, quatre courbes avec repère d\'acte, bouton bilan', () => {
  const root = fakeRoot(), ctx = makeCtx();
  suiviData.render(root, ctx);
  assert.match(root.innerHTML, /1\/7 jours loggés/);
  assert.equal((root.innerHTML.match(/<svg/g) || []).length, 4);
  assert.equal((root.innerHTML.match(/stroke="var\(--nat-contenu\)"/g) || []).length, 4);
  assert.match(root.innerHTML, /data-copy/);
  assert.match(root.innerHTML, /7 h 30/);
});

test('Pulsion : protocole, pression, checks, trois natures, courbe avec repère, derniers actes', async () => {
  const { render } = await import('../../js/modules/pulsion/views/home.js');
  const root = fakeRoot(), ctx = makeCtx();
  render(root, ctx);
  assert.match(root.innerHTML, /Protocole 10 minutes/);
  assert.match(root.innerHTML, /data-range="urge"/);
  assert.match(root.innerHTML, /data-chips="checksMin"/);
  assert.equal((root.innerHTML.match(/data-nature="/g) || []).length, 3);
  assert.equal((root.innerHTML.match(/<svg/g) || []).length, 1);
  assert.match(root.innerHTML, /stroke="var\(--nat-contenu\)"/);
  assert.match(root.innerHTML, /seul, avec contenu · fatigue/);
  assert.match(root.innerHTML, /Copier le bilan pulsion/);
});
