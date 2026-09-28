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
import { mindSchema } from '../../js/modules/mind/schema.js';
import { rappelSchema } from '../../js/modules/rappel/schema.js';
import * as suiviDay from '../../js/modules/suivi/views/day.js';
import * as suiviData from '../../js/modules/suivi/views/data.js';
import { memoryStorage, fakeNow, fakeId, resetFakes } from '../fixtures/helpers.mjs';

export function fakeRoot() {
  // Élément inerte récursif : classList, champs de formulaire, sous-requêtes, écouteurs.
  const el = { innerHTML: '', textContent: '', style: {}, classList: { toggle() {}, add() {}, remove() {} }, provider: {}, model: {}, apiKey: {},
    addEventListener() {}, removeEventListener() {} };
  el.querySelector = () => el;
  el.querySelectorAll = () => [];
  return { innerHTML: '', querySelector: () => el, querySelectorAll: () => [], addEventListener() {} };
}

export function makeCtx() {
  resetFakes();
  const storage = memoryStorage();
  const schemas = { settings: settingsSchema, suivi: suiviSchema, pulsion: pulsionSchema, challenge: challengeSchema, tests: testsSchema, mind: mindSchema, rappel: rappelSchema };
  const stores = Object.fromEntries(Object.entries(schemas).map(([n, s]) => [n, new Store(storage, s, { now: fakeNow, makeId: fakeId })]));
  for (const s of Object.values(stores)) s.load();
  stores.suivi.commit(d => { d.days['2026-09-19'] = { bed: '23:30', wake: '07:00', onsetMin: 0, awakeMin: 0, clarity: 6, mood: 5, pleasure: 4, drive: 7, note: null }; });
  stores.pulsion.commit(d => {
    d.days['2026-09-19'] = { urge: 4 };
    d.events.push({ id: 'e1', day: '2026-09-19', ts: '2026-09-19T22:00:00.000Z', nature: 'contenu', triggers: ['Fatigue'] });
    d.episodes.push({ id: 'p1', day: '2026-09-18', ts: '2026-09-18T18:00:00.000Z', intensity: 5, triggers: ['Image accidentelle'], exposed: true });
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
  assert.match(root.innerHTML, /data-chips="onsetMin"/);
  assert.match(root.innerHTML, /data-chips="awakeMin"/);
  assert.match(root.innerHTML, /data-note/);
  assert.match(root.innerHTML, /0\/140/);
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
  assert.match(root.innerHTML, /dormi 7 h 30/);
  assert.match(root.innerHTML, /efficacité 100 %/);
});

test('Pulsion : protocole, épisode, pression, trois natures, courbe avec repère et point creux, heures, derniers actes', async () => {
  const { render } = await import('../../js/modules/pulsion/views/home.js');
  const root = fakeRoot(), ctx = makeCtx();
  render(root, ctx);
  assert.match(root.innerHTML, /Protocole 10 minutes/);
  assert.match(root.innerHTML, /data-episode/);
  assert.match(root.innerHTML, /data-range="urge"/);
  assert.equal(root.innerHTML.includes('checksMin'), false);
  assert.equal((root.innerHTML.match(/data-nature="/g) || []).length, 3);
  assert.equal((root.innerHTML.match(/<svg/g) || []).length, 1);
  assert.match(root.innerHTML, /stroke="var\(--nat-contenu\)"/);
  assert.match(root.innerHTML, /<circle[^>]*fill="none"/); // point creux du jour d'épisode
  assert.match(root.innerHTML, /class="hours"/);
  assert.match(root.innerHTML, /seul, avec contenu · fatigue/);
  assert.match(root.innerHTML, /Image accidentelle/);
  assert.match(root.innerHTML, /Copier le bilan pulsion/);
  assert.equal(root.innerHTML.includes('Tu décides à'), false);
  // Un épisode qui vient d'être noté : la ligne « tu décides à » vient du document, pas d'un état d'écran.
  ctx.stores.pulsion.commit(d => { d.episodes.push({ id: 'p2', day: ctx.today(), ts: new Date().toISOString(), intensity: 6, triggers: [], exposed: false }); });
  render(root, ctx);
  assert.match(root.innerHTML, /Tu décides à/);
});

test('Pulsion : enregistrer un acte referme le brouillon dès le redessin déclenché par le store', async () => {
  const { render } = await import('../../js/modules/pulsion/views/home.js');
  const root = fakeRoot(), ctx = makeCtx();
  render(root, ctx);
  root.onclick({ target: { closest: sel => (sel === '[data-nature]' ? { dataset: { nature: 'sans' } } : null) } });
  assert.match(root.innerHTML, /data-save/);
  let seen = null;
  ctx.stores.pulsion.subscribe(() => { render(root, ctx); seen = root.innerHTML; });
  root.onclick({ target: { closest: sel => (sel === '[data-save]' ? {} : null) } });
  assert.equal(ctx.stores.pulsion.doc.events.length, 2);
  assert.equal(seen.includes('data-save'), false);
  assert.equal((root.innerHTML.match(/data-nature="/g) || []).length, 3);
});

test('Réglages : apparence, LLM, une ligne par module, backup, version, sections conditionnelles', async () => {
  const { render } = await import('../../js/modules/settings/views/home.js');
  const root = fakeRoot(), ctx = makeCtx();
  render(root, ctx);
  assert.equal((root.innerHTML.match(/data-theme-pref="/g) || []).length, 3);
  assert.match(root.innerHTML, /name="apiKey"/);
  assert.equal((root.innerHTML.match(/data-export="/g) || []).length, 6); // suivi, pulsion, challenge, tests, mind, rappel
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

test('Mind accueil : document vide puis arbre de test', async () => {
  const { render } = await import('../../js/modules/mind/views/home.js');
  const { makeDoc } = await import('../mind/fixtures.mjs');
  const root = fakeRoot(), ctx = makeCtx();
  render(root, ctx);
  assert.match(root.innerHTML, /Rien ne pèse en ce moment/);
  assert.match(root.innerHTML, /Aucun thème/);
  assert.match(root.innerHTML, /id="fab"/);
  ctx.stores.mind.replace(makeDoc());
  render(root, ctx);
  assert.match(root.innerHTML, /data-go="papa"/);
  assert.equal((root.innerHTML.match(/data-done="/g) || []).length, 4);
  assert.match(root.innerHTML, /Relations<\/span><\/span>\s*<span class="row-aside">3 sujets/);
  assert.match(root.innerHTML, /data-nav="tree"/);
  assert.match(root.innerHTML, /data-nav="settings"/);
});

test('Mind fiche : fil d\'Ariane, poids, actions du sous-arbre, journal agrégé, bandeau posé', async () => {
  const { render } = await import('../../js/modules/mind/views/subject.js');
  const { makeDoc } = await import('../mind/fixtures.mjs');
  const root = fakeRoot(), ctx = makeCtx();
  ctx.stores.mind.replace(makeDoc());
  ctx.route = { tab: 'mind', view: 's', id: 'papa' };
  render(root, ctx);
  assert.match(root.innerHTML, /data-go="relations">Relations</);
  assert.match(root.innerHTML, /Poids 3 sur 3/);
  assert.equal((root.innerHTML.match(/data-done="/g) || []).length, 2); // e-papa-3 et e-com-1
  assert.match(root.innerHTML, /Fait : Lui demander comment il va/);
  assert.match(root.innerHTML, /data-compose/);
  ctx.route = { tab: 'mind', view: 's', id: 'vacances' };
  render(root, ctx);
  assert.match(root.innerHTML, /Posé depuis/);
  assert.match(root.innerHTML, /data-resume/);
  ctx.route = { tab: 'mind', view: 's', id: 'nope' };
  render(root, ctx);
  assert.match(root.innerHTML, /Sujet introuvable/);
});

test('Mind recherche et vue d\'ensemble', async () => {
  const search = await import('../../js/modules/mind/views/search.js');
  const tree = await import('../../js/modules/mind/views/tree.js');
  const { makeDoc } = await import('../mind/fixtures.mjs');
  const root = fakeRoot(), ctx = makeCtx();
  ctx.stores.mind.replace(makeDoc());
  search.render(root, ctx);
  assert.match(root.innerHTML, /class="search-input"/);
  tree.render(root, ctx);
  assert.match(root.innerHTML, /Vue d'ensemble/);
  assert.match(root.innerHTML, /data-go="relations"/);
  assert.match(root.innerHTML, /data-toggle="papa"/);
  assert.match(root.innerHTML, /Afficher les sujets posés/);
  assert.equal(root.innerHTML.includes('data-go="moi"'), false);
});

test('Réglages : section Sujets posés quand le store Mind existe', async () => {
  const { render } = await import('../../js/modules/settings/views/home.js');
  const { makeDoc } = await import('../mind/fixtures.mjs');
  const root = fakeRoot(), ctx = makeCtx();
  ctx.stores.mind.replace(makeDoc());
  render(root, ctx);
  assert.match(root.innerHTML, /Sujets posés/);
  assert.match(root.innerHTML, /data-mind="moi"/);
  assert.match(root.innerHTML, /data-mind="vacances"/);
  assert.equal((root.innerHTML.match(/data-export="/g) || []).length, 6); // suivi, pulsion, challenge, tests, mind, rappel
});

test('Rappel accueil : bibliothèque vide, puis dues et nouvelles, puis « réviser quand même »', async () => {
  const { render } = await import('../../js/modules/rappel/views/home.js');
  const { addItems, recordReview } = await import('../../js/modules/rappel/ops.js');
  const root = fakeRoot(), ctx = makeCtx();
  render(root, ctx);
  assert.match(root.innerHTML, /bibliothèque est vide/i);
  addItems(ctx.stores.rappel, [{ kind: 'fait', title: 'A', content: 'a.' }, { kind: 'idee', title: 'B', content: 'b.' }], Date.now() - 10 * 86400000);
  render(root, ctx);
  assert.match(root.innerHTML, /0 due · 2 nouvelles/);
  assert.match(root.innerHTML, /data-review/);
  recordReview(ctx.stores.rappel, 'id1', 4, 'Q', Date.now());
  recordReview(ctx.stores.rappel, 'id2', 4, 'Q', Date.now());
  render(root, ctx);
  assert.match(root.innerHTML, /0 due · 0 nouvelle/);
  assert.match(root.innerHTML, /data-anyway/);
  assert.equal(root.innerHTML.includes('data-review'), false);
});

test('Rappel bibliothèque et capture', async () => {
  const library = await import('../../js/modules/rappel/views/library.js');
  const capture = await import('../../js/modules/rappel/views/capture.js');
  const { addItems, recordReview } = await import('../../js/modules/rappel/ops.js');
  const root = fakeRoot(), ctx = makeCtx();
  library.render(root, ctx);
  assert.match(root.innerHTML, /Aucune fiche/);
  addItems(ctx.stores.rappel, [{ kind: 'fait', title: 'A <b>', content: 'a.' }, { kind: 'idee', title: 'B', content: 'b.' }], Date.now());
  recordReview(ctx.stores.rappel, 'id1', 3, 'Q', Date.now());
  library.render(root, ctx);
  assert.match(root.innerHTML, /2 fiches/);
  assert.match(root.innerHTML, /A &lt;b&gt;/);
  assert.match(root.innerHTML, /R \d+ % · S/);
  assert.match(root.innerHTML, /nouveau/);
  capture.render(root, ctx);
  assert.match(root.innerHTML, /data-count="auto"/);
  assert.match(root.innerHTML, /data-extract/);
  assert.match(root.innerHTML, /data-manual/);
});

test('Rappel révision : sans session renvoie à l\'accueil ; sans clé API, erreur lisible et boutons', async () => {
  const review = await import('../../js/modules/rappel/views/review.js');
  const { addItems } = await import('../../js/modules/rappel/ops.js');
  const root = fakeRoot(), ctx = makeCtx();
  const nav = []; ctx.navigate = r => nav.push(r); ctx.replace = r => nav.push({ replace: true, ...r }); ctx.onLeave = () => {};
  review.render(root, ctx);
  assert.deepEqual(nav, [{ replace: true, tab: 'rappel' }]); // remplacement : le bouton retour ne retombe pas sur une révision vide
  addItems(ctx.stores.rappel, [{ kind: 'fait', title: 'A', content: 'a.' }], Date.now());
  review.startReview(ctx, ['id1']);
  assert.deepEqual(nav.at(-1), { tab: 'rappel', view: 'review' });
  review.render(root, ctx);
  assert.match(root.innerHTML, /1 \/ 1/);
  assert.match(root.innerHTML, /data-stop/); // Arrêter disponible dès le chargement
  await new Promise(r => setTimeout(r, 20));
  assert.match(root.innerHTML, /Aucune clé API/);
  assert.match(root.innerHTML, /data-retry/);
  assert.match(root.innerHTML, /data-stop/);
  assert.equal(ctx.stores.rappel.doc.items[0].reps, 0);
});

test('Rappel capture : l\'ajout à la main active le bouton dès que titre et contenu sont saisis', async () => {
  const { render } = await import('../../js/modules/rappel/views/capture.js');
  const el = { innerHTML: '', textContent: '', disabled: null, style: {}, classList: { toggle() {}, add() {}, remove() {} },
    toggleAttribute(name, force) { if (name === 'disabled') el.disabled = force; }, addEventListener() {}, removeEventListener() {} };
  el.querySelector = () => el; el.querySelectorAll = () => [];
  const root = { innerHTML: '', querySelector: () => el, querySelectorAll: () => [], addEventListener() {} };
  const ctx = makeCtx();
  render(root, ctx);
  root.onclick({ target: { closest: sel => (sel === '[data-manual]' ? {} : null) } });
  assert.match(root.innerHTML, /data-add disabled/);
  root.oninput({ target: { closest: sel => (sel === '[data-title]' ? { dataset: { title: '0' }, value: 'Titre' } : null) } });
  assert.equal(el.disabled, true); // contenu encore vide
  root.oninput({ target: { closest: sel => (sel === '[data-content]' ? { dataset: { content: '0' }, value: 'Un savoir.' } : null) } });
  assert.equal(el.disabled, false);
  assert.match(el.textContent, /Ajouter 1 fiche/);
  // Le store notifie pendant l'ajout : l'écran doit déjà être revenu au dump quand il se redessine.
  let seenDuringNotify = null;
  ctx.stores.rappel.subscribe(() => { render(root, ctx); seenDuringNotify = root.innerHTML; });
  root.onclick({ target: { closest: sel => (sel === '[data-add]' ? {} : null) } });
  assert.equal(ctx.stores.rappel.doc.items.length, 1);
  assert.equal(ctx.stores.rappel.doc.items[0].title, 'Titre');
  assert.equal(seenDuringNotify.includes('data-add'), false);
  assert.match(root.innerHTML, /1 fiche ajoutée/);
  assert.match(root.innerHTML, /data-dump/);
  assert.deepEqual(ctx.notices, ['1 fiche ajoutée à la bibliothèque.']);
});

test('Rappel révision : Réessayer après un échec de correction relance la correction avec la réponse', async () => {
  const review = await import('../../js/modules/rappel/views/review.js');
  const { addItems } = await import('../../js/modules/rappel/ops.js');
  const root = fakeRoot(), ctx = makeCtx();
  ctx.navigate = () => {}; ctx.replace = () => {}; ctx.onLeave = () => {};
  ctx.stores.settings.commit(d => { d.llm.apiKey = 'k'; });
  addItems(ctx.stores.rappel, [{ kind: 'fait', title: 'A', content: 'a.' }], Date.now());
  const bodies = [];
  let gradeCalls = 0;
  const savedFetch = globalThis.fetch;
  globalThis.fetch = async (url, opts) => {
    const prompt = JSON.parse(opts.body).messages[0].content;
    bodies.push(prompt);
    if (prompt.includes('RÉPONSE DE L\'ÉTUDIANT')) { gradeCalls += 1; if (gradeCalls === 1) return { ok: false, status: 400, json: async () => ({ error: { message: 'boum' } }) }; /* non retentée : la vue passe en erreur tout de suite */ return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: '{"verdict":"good","explication":"Oui."}' } }] }) }; }
    return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: '{"question":"Quand ?"}' } }] }) };
  };
  try {
    review.startReview(ctx, ['id1']);
    review.render(root, ctx);
    await new Promise(r => setTimeout(r, 20));
    assert.match(root.innerHTML, /Quand \?/);
    root.oninput({ target: { closest: sel => (sel === '[data-answer]' ? { value: 'ma réponse' } : null) } });
    root.onclick({ target: { closest: sel => (sel === '[data-submit]' ? {} : null) } });
    await new Promise(r => setTimeout(r, 20));
    assert.match(root.innerHTML, /La correction a échoué/);
    assert.match(root.innerHTML, /boum/);
    root.onclick({ target: { closest: sel => (sel === '[data-retry]' ? {} : null) } });
    await new Promise(r => setTimeout(r, 20));
    assert.equal(gradeCalls, 2);
    assert.match(bodies.at(-1), /ma réponse/);
    assert.match(root.innerHTML, /Verdict retenu/);
  } finally { globalThis.fetch = savedFetch; }
});
