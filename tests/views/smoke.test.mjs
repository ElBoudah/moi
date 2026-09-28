// Smoke test des vues sans navigateur : un root minimal (innerHTML, querySelector inerte),
// des stores en mémoire, et on vérifie que chaque écran se rend avec ses blocs attendus.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Store } from '../../js/core/store.js';
import { suiviSchema } from '../../js/modules/suivi/schema.js';
import { pulsionSchema } from '../../js/modules/pulsion/schema.js';
import { testsSchema } from '../../js/modules/tests/schema.js';
import { settingsSchema } from '../../js/modules/settings/schema.js';
import { challengeSchema } from '../../js/modules/challenge/schema.js';
import * as suiviDay from '../../js/modules/suivi/views/day.js';
import * as suiviData from '../../js/modules/suivi/views/data.js';
import { memoryStorage, fakeNow, fakeId, resetFakes } from '../fixtures/helpers.mjs';

export function fakeRoot() {
  // Élément inerte récursif : classList, champs de formulaire, sous-requêtes, écouteurs.
  const el = { innerHTML: '', textContent: '', classList: { toggle() {}, add() {}, remove() {} }, provider: {}, model: {}, apiKey: {},
    addEventListener() {}, removeEventListener() {} };
  el.querySelector = () => el;
  el.querySelectorAll = () => [];
  return { innerHTML: '', querySelector: () => el, querySelectorAll: () => [] };
}

export function makeCtx() {
  resetFakes();
  const storage = memoryStorage();
  const schemas = { settings: settingsSchema, suivi: suiviSchema, pulsion: pulsionSchema, challenge: challengeSchema, tests: testsSchema };
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

test('Réglages : apparence, LLM, une ligne par module, backup, version, sections conditionnelles', async () => {
  const { render } = await import('../../js/modules/settings/views/home.js');
  const root = fakeRoot(), ctx = makeCtx();
  render(root, ctx);
  assert.equal((root.innerHTML.match(/data-theme-pref="/g) || []).length, 3);
  assert.match(root.innerHTML, /name="apiKey"/);
  assert.equal((root.innerHTML.match(/data-export="/g) || []).length, 4); // suivi, pulsion, challenge, tests
  assert.match(root.innerHTML, /data-cloud-restore/);
  assert.match(root.innerHTML, /cloud non configuré/);
  assert.match(root.innerHTML, /Moi 0\.0\.0/);
  assert.equal(root.innerHTML.includes('Ancienne app Suivi'), false);
  assert.equal(root.innerHTML.includes('Données illisibles'), false);
  ctx.storage.setItem('suivi_v1', '{}');
  ctx.stores.tests.corrupt = '{x';
  render(root, ctx);
  assert.match(root.innerHTML, /Ancienne app Suivi/);
  assert.match(root.innerHTML, /data-recover="tests"/);
});

test('Challenge : formulaire sans actif, écran actif avec bande, passé en lecture seule', async () => {
  const { render } = await import('../../js/modules/challenge/views/home.js');
  const { createChallenge, stopChallenge } = await import('../../js/modules/challenge/ops.js');
  const root = fakeRoot(), ctx = makeCtx();
  render(root, ctx);
  assert.match(root.innerHTML, /name="title"/);
  assert.match(root.innerHTML, /Aucun challenge passé/);
  const c = createChallenge(ctx.stores.challenge, { title: 'Cardio <3', target: { perWeek: 3 }, days: 14 }, '2026-09-20');
  render(root, ctx);
  assert.match(root.innerHTML, /Cardio &lt;3/);
  assert.match(root.innerHTML, /jour 1 sur 14/);
  assert.match(root.innerHTML, /3 fois par semaine/);
  assert.equal((root.innerHTML.match(/class="cell /g) || []).length, 14);
  assert.match(root.innerHTML, /data-toggle="2026-09-20"/);
  assert.match(root.innerHTML, /data-stop/);
  stopChallenge(ctx.stores.challenge, c.id, '2026-09-20T12:00:00.000Z');
  render(root, ctx);
  assert.match(root.innerHTML, /data-go="id1"/);
  assert.match(root.innerHTML, /0 faits \/ 14 jours/);
  ctx.route = { tab: 'challenge', view: 'c', id: 'id1' };
  render(root, ctx);
  assert.match(root.innerHTML, /Cardio &lt;3/);
  assert.equal(root.innerHTML.includes('data-toggle'), false);
});

test('Tests : cartes du catalogue, dernier run, courbe à partir du deuxième run, historique avec repli', async () => {
  const { render } = await import('../../js/modules/tests/views/home.js');
  const root = fakeRoot(), ctx = makeCtx();
  ctx.stores.tests.commit(d => { d.runs.push(
    { id: 1, ts: '2026-09-07T09:00:00.000Z', day: '2026-09-07', test: 'pvt', metrics: { median: 260, lapses: 1, n: 40 } },
    { id: 2, ts: '2026-09-14T09:00:00.000Z', day: '2026-09-14', test: 'pvt', metrics: { median: 250, lapses: 0, n: 41 } },
    { id: 3, ts: '2026-09-14T09:10:00.000Z', day: '2026-09-14', test: 'span', metrics: { span: 5, correct: 3, trials: 4 } },
    { id: 4, ts: '2026-08-01T09:10:00.000Z', day: '2026-08-01', test: 'phq', metrics: { score: 6, band: 'léger' } },
  ); });
  render(root, ctx);
  assert.equal((root.innerHTML.match(/data-run="/g) || []).length, 2);
  assert.match(root.innerHTML, /PVT 250 ms · 0 lapses/);
  assert.equal((root.innerHTML.match(/<svg/g) || []).length, 1); // PVT a deux runs, PHQ-8 un seul
  assert.match(root.innerHTML, /1 run enregistré/);
  assert.match(root.innerHTML, /Empan inversé 5 · 3\/4 essais/);
  assert.match(root.innerHTML, /PHQ-8 6\/24 · léger/);
});

test('Tests : la passation enregistre un run à Enregistrer et nettoie en quittant', async () => {
  const { render } = await import('../../js/modules/tests/views/run.js');
  const root = fakeRoot(), ctx = makeCtx();
  let leave = null;
  ctx.onLeave = fn => { leave = fn; };
  const nav = []; ctx.navigate = r => nav.push(r);
  ctx.route = { tab: 'tests', view: 'run', id: 'phq8' };
  render(root, ctx);
  assert.equal(typeof leave, 'function');
  assert.match(root.innerHTML, /Quitter/);
  leave();
  ctx.route = { tab: 'tests', view: 'run', id: 'nope' };
  render(root, ctx);
  assert.match(root.innerHTML, /Test inconnu/);
  assert.equal(ctx.stores.tests.doc.runs.length, 0);
});

test('Tests : rerendre la passation nettoie la scène précédente', async () => {
  const { render } = await import('../../js/modules/tests/views/run.js');
  const removed = [];
  const el = { innerHTML: '', textContent: '', classList: { toggle() {}, add() {}, remove() {} }, addEventListener() {}, removeEventListener: (ev) => removed.push(ev) };
  el.querySelector = () => el; el.querySelectorAll = () => [];
  const root = { innerHTML: '', querySelector: () => el, querySelectorAll: () => [] };
  const ctx = makeCtx();
  ctx.onLeave = () => {};
  ctx.route = { tab: 'tests', view: 'run', id: 'phq8' };
  render(root, ctx);
  assert.deepEqual(removed, []);
  render(root, ctx);
  assert.deepEqual(removed, ['click']); // l'écouteur « Commencer » de la première scène est retiré
});
