# Moi — plan 2 : Challenge et Tests

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter à l'app Moi les onglets Challenge (un challenge actif à la fois, bande de cases, aucune analyse) et Tests (catalogue enfichable avec PVT-B et PHQ-8, passation plein écran adossée au routeur, historique et courbes), sans toucher aux onglets existants.

**Architecture:** Chaque module suit le patron du plan 1 : `schema.js` (clé, version, validation), `queries.js` (lectures pures), `ops.js` (mutations validées), `views/*.js` (`render(root, ctx)`). Les tests du catalogue sont des fichiers qui exportent un descripteur ; une **scène** (`stage.js`) leur fournit l'écran plein, les minuteurs et les écouteurs, et sait tout nettoyer d'un coup. La coquille gagne un crochet `ctx.onLeave(fn)` appelé à chaque changement de route, pour que quitter une passation (bouton retour compris) nettoie ses minuteurs.

**Tech Stack:** HTML, CSS, modules JavaScript natifs (ES2022), `node --test` (Node 24, zéro dépendance npm).

**Spec:** `docs/superpowers/specs/2026-09-28-moi-fusion-design.md`, sections 4.3 (Challenge) et 4.4 (Tests). Le plan 1 (`docs/superpowers/plans/2026-09-28-moi-1-socle-suivi-pulsion.md`) décrit le socle réutilisé.

## Global Constraints

- Aucune dépendance npm, aucune étape de build. Chemins relatifs partout.
- Identifiants en anglais, interface et messages en français.
- Aucune notification, aucun compteur de retard, aucune série, aucun rappel « à faire ». Aucun rouge nouveau.
- Clés : `moi.challenge` (nouvelle), `moi.tests` (schéma déjà en place depuis le plan 1). Version de schéma 1.
- Challenge : un seul actif à la fois ; cible `{ daily: true }` ou `{ perWeek: 1..7 }` ; durées 14, 30, 60 ; `done` ne contient que des jours de la période, jamais dans le futur ; clôture automatique au chargement quand la période est écoulée.
- Tests : PVT-B (3 min, intervalle 1 à 4 s, faux départ avant stimulus ou sous 100 ms, lapse au-dessus de 355 ms) et PHQ-8 (8 items 0..3, bandes 0-4 minimal, 5-9 léger, 10-14 modéré, 15-19 modérément sévère, 20-24 sévère, avertissement si la dernière passation date de moins de 14 jours, phrase pour un score ≥ 15). Runs historiques `span`, `corsi`, `sdmt`, `fluence` conservés et affichés dans l'historique avec un libellé de repli.
- L'enregistrement d'un run n'a lieu qu'au bouton « Enregistrer » de l'écran de résultat. Quitter avant n'enregistre rien.
- Les tests se lancent avec `npm test` et passent tous avant chaque commit. Les vues sont couvertes par le smoke test Node (`tests/views/smoke.test.mjs`), la vérification sur téléphone reste à faire par Noah.
- Commits en français, terminés par `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`. Identité git locale déjà réglée.
- `APP_VERSION` passe à `1.1.0` et `sw.js` liste les nouveaux fichiers (tâche 8).

## Review Focus

1. Créer un challenge alors qu'un autre est en cours doit être refusé sans rien écrire. Test dans la tâche 3.
2. Basculer un jour hors période, dans le futur, ou sur un challenge clos doit être refusé. Test dans la tâche 3.
3. Un challenge dont la période s'est écoulée pendant que l'app était fermée est clos au chargement et passe dans la liste des passés. Test dans la tâche 3 (`autoClose`).
4. Quitter une passation en cours (bouton Quitter ou retour du téléphone) arrête tous les minuteurs et n'enregistre rien. Tests dans la tâche 7 (`createStage.clearAll`) et la tâche 6 (le PVT n'appelle `onDone` qu'à l'écran de résultat).
5. Un PHQ-8 lancé moins de 14 jours après le précédent affiche l'avertissement de recouvrement, sans bloquer. Test dans la tâche 6.

## Structure des fichiers

```
js/modules/challenge/schema.js       challengeSchema, DURATIONS, isTarget, targetLabel
js/modules/challenge/queries.js      endDay, isActive, active, past, periodKeys, dayStrip, weekBounds, weekCount, dayNumber, doneCount
js/modules/challenge/ops.js          createChallenge, toggleDone, stopChallenge, autoClose
js/modules/challenge/views/home.js   challenge actif ou formulaire + passés ; vue « c » (passé, lecture seule)
js/modules/tests/queries.js          runsOf, lastRun, history
js/modules/tests/ops.js              addRun
js/modules/tests/stage.js            createStage(root, { onQuit })
js/modules/tests/catalog/pvt.js      pvtMetrics, descripteur PVT-B
js/modules/tests/catalog/phq8.js     PHQ_ITEMS, PHQ_OPTIONS, phqBand, phqMetrics, overlapWarning, descripteur PHQ-8
js/modules/tests/catalog/index.js    CATALOG, testById, summaryFor (libellés de repli)
js/modules/tests/views/home.js       cartes, courbes, historique
js/modules/tests/views/run.js        passation
js/app.js                            SCHEMAS + MODULES + onLeave + autoClose
style.css                            bande de cases, scène de test
sw.js, js/version.js, README.md
tests/challenge/*.test.mjs  tests/tests/*.test.mjs  tests/views/smoke.test.mjs
```

---

### Task 1 : schéma Challenge

**Files:**
- Create: `js/modules/challenge/schema.js`, `tests/challenge/schema.test.mjs`

**Interfaces:**
- Consumes: `isDayKey` (`js/core/dates.js`).
- Produces: `DURATIONS = [14, 30, 60]`, `isTarget(target)`, `targetLabel(target)`, `challengeSchema` (clé `moi.challenge`, doc `{ version: 1, challenges: [{ id, title, target, startDay, days, endedAt, done }] }`).

- [ ] **Step 1 : test**

`tests/challenge/schema.test.mjs` :

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { challengeSchema, DURATIONS, isTarget, targetLabel } from '../../js/modules/challenge/schema.js';

const ok = () => ({ version: 1, challenges: [
  { id: 'c1', title: 'Cardio', target: { perWeek: 3 }, startDay: '2026-09-01', days: 30, endedAt: null, done: { '2026-09-02': true } },
  { id: 'c0', title: 'Lecture', target: { daily: true }, startDay: '2026-07-01', days: 14, endedAt: '2026-07-14T23:59:59.000Z', done: {} },
] });

test('constantes, cibles, libellés', () => {
  assert.deepEqual(DURATIONS, [14, 30, 60]);
  assert.equal(isTarget({ daily: true }), true);
  assert.equal(isTarget({ perWeek: 7 }), true);
  assert.equal(isTarget({ perWeek: 0 }), false);
  assert.equal(isTarget({ perWeek: 2.5 }), false);
  assert.equal(isTarget({ daily: true, perWeek: 3 }), false);
  assert.equal(isTarget(null), false);
  assert.equal(targetLabel({ daily: true }), 'tous les jours');
  assert.equal(targetLabel({ perWeek: 1 }), '1 fois par semaine');
  assert.equal(targetLabel({ perWeek: 3 }), '3 fois par semaine');
  assert.deepEqual(challengeSchema.empty(), { version: 1, challenges: [] });
});

test('validate accepte un document correct et refuse les challenges mal formés', () => {
  assert.equal(challengeSchema.validate(ok()).ok, true);
  const bad = patch => { const d = ok(); Object.assign(d.challenges[0], patch); return challengeSchema.validate(d); };
  assert.match(bad({ title: '  ' }).error, /titre/i);
  assert.match(bad({ target: { perWeek: 9 } }).error, /cible/i);
  assert.match(bad({ days: 21 }).error, /durée/i);
  assert.match(bad({ startDay: '2026-02-30' }).error, /jour/i);
  assert.match(bad({ done: { hier: true } }).error, /done/i);
  assert.match(bad({ done: { '2026-09-02': false } }).error, /done/i);
  assert.match(bad({ endedAt: 5 }).error, /endedAt/);
  assert.equal(challengeSchema.validate({ version: 1, challenges: [null] }).ok, false);
  assert.equal(challengeSchema.validate({ version: 2, challenges: [] }).ok, false);
  const dup = ok(); dup.challenges[1].id = 'c1';
  assert.match(challengeSchema.validate(dup).error, /identifiant/i);
});
```

- [ ] **Step 2 : lancer, échec attendu**

Run: `npm test`
Expected: FAIL, module introuvable.

- [ ] **Step 3 : implémentation**

`js/modules/challenge/schema.js` :

```js
import { isDayKey } from '../../core/dates.js';

export const DURATIONS = [14, 30, 60];

export function isTarget(t) {
  if (!t || typeof t !== 'object') return false;
  const keys = Object.keys(t);
  if (keys.length !== 1) return false;
  if (t.daily === true) return true;
  return Number.isInteger(t.perWeek) && t.perWeek >= 1 && t.perWeek <= 7;
}

export function targetLabel(t) {
  return t.daily ? 'tous les jours' : `${t.perWeek} fois par semaine`;
}

export const challengeSchema = {
  key: 'moi.challenge',
  version: 1,
  empty: () => ({ version: 1, challenges: [] }),
  validate(raw) {
    const fail = error => ({ ok: false, error });
    if (!raw || typeof raw !== 'object') return fail('Document Challenge invalide.');
    if (raw.version !== 1) return fail(`Version Challenge inconnue (${raw.version}).`);
    if (!Array.isArray(raw.challenges)) return fail('Liste de challenges manquante.');
    const ids = new Set();
    for (const c of raw.challenges) {
      if (!c || typeof c !== 'object') return fail('Challenge mal formé.');
      if (typeof c.id !== 'string') return fail('Challenge sans identifiant.');
      if (ids.has(c.id)) return fail(`Identifiant de challenge en double (${c.id}).`);
      ids.add(c.id);
      if (typeof c.title !== 'string' || !c.title.trim()) return fail(`Titre manquant (${c.id}).`);
      if (!isTarget(c.target)) return fail(`Cible invalide (${c.id}).`);
      if (!DURATIONS.includes(c.days)) return fail(`Durée invalide (${c.id}).`);
      if (!isDayKey(c.startDay)) return fail(`Jour de début invalide (${c.id}).`);
      if (!(c.endedAt === null || typeof c.endedAt === 'string')) return fail(`endedAt invalide (${c.id}).`);
      if (!c.done || typeof c.done !== 'object' || Array.isArray(c.done)) return fail(`Liste done invalide (${c.id}).`);
      for (const [k, v] of Object.entries(c.done)) {
        if (!isDayKey(k) || v !== true) return fail(`Entrée done invalide (${c.id}, ${k}).`);
      }
    }
    return { ok: true, doc: raw };
  },
  migrations: {},
};
```

- [ ] **Step 4 : lancer, succès**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5 : commit**

```bash
git add js/modules/challenge/schema.js tests/challenge/schema.test.mjs
git commit -m "Ajoute le schéma Challenge

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2 : lectures Challenge

**Files:**
- Create: `js/modules/challenge/queries.js`, `tests/challenge/queries.test.mjs`

**Interfaces:**
- Consumes: `addDays`, `diffDays`, `parseKey` (`js/core/dates.js`).
- Produces: `endDay(c)`, `isActive(c, todayKey)`, `active(doc, todayKey) -> c | null`, `past(doc, todayKey)` (du plus récent au plus ancien), `periodKeys(c)`, `dayStrip(c, todayKey) -> [{ day, state }]` avec `state ∈ done | missed | today | future | off`, `weekBounds(todayKey) -> { from, to }` (lundi à dimanche), `weekCount(c, todayKey)`, `dayNumber(c, todayKey)`, `doneCount(c)`.

- [ ] **Step 1 : test**

`tests/challenge/queries.test.mjs` :

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { endDay, isActive, active, past, periodKeys, dayStrip, weekBounds, weekCount, dayNumber, doneCount } from '../../js/modules/challenge/queries.js';

const c = () => ({ id: 'c1', title: 'Cardio', target: { perWeek: 3 }, startDay: '2026-09-01', days: 14, endedAt: null, done: { '2026-09-02': true, '2026-09-08': true } });

test('endDay, isActive, active, past', () => {
  assert.equal(endDay(c()), '2026-09-14');
  assert.equal(isActive(c(), '2026-09-14'), true);
  assert.equal(isActive(c(), '2026-09-15'), false);
  assert.equal(isActive({ ...c(), endedAt: '2026-09-05T10:00:00.000Z' }, '2026-09-06'), false);
  const doc = { version: 1, challenges: [{ ...c(), id: 'old', startDay: '2026-07-01', endedAt: '2026-07-14T23:59:59.000Z' }, c()] };
  assert.equal(active(doc, '2026-09-10').id, 'c1');
  assert.equal(active(doc, '2026-09-20'), null);
  assert.deepEqual(past(doc, '2026-09-20').map(x => x.id), ['c1', 'old']);
  assert.deepEqual(past(doc, '2026-09-10').map(x => x.id), ['old']);
});

test('periodKeys et dayStrip', () => {
  const keys = periodKeys(c());
  assert.equal(keys.length, 14);
  assert.equal(keys[0], '2026-09-01');
  assert.equal(keys[13], '2026-09-14');
  const strip = dayStrip(c(), '2026-09-08');
  const byDay = Object.fromEntries(strip.map(s => [s.day, s.state]));
  assert.equal(byDay['2026-09-01'], 'missed');
  assert.equal(byDay['2026-09-02'], 'done');
  assert.equal(byDay['2026-09-08'], 'done');
  assert.equal(byDay['2026-09-09'], 'future');
  assert.equal(dayStrip(c(), '2026-09-07').find(s => s.day === '2026-09-07').state, 'today');
  // challenge arrêté le 05/09 : les jours suivants sont « off »
  const stopped = { ...c(), endedAt: '2026-09-05T10:00:00.000Z' };
  const s2 = Object.fromEntries(dayStrip(stopped, '2026-09-20').map(s => [s.day, s.state]));
  assert.equal(s2['2026-09-05'], 'missed');
  assert.equal(s2['2026-09-06'], 'off');
});

test('semaine du lundi au dimanche, compte de la semaine, numéro du jour, total', () => {
  assert.deepEqual(weekBounds('2026-09-09'), { from: '2026-09-07', to: '2026-09-13' }); // mercredi
  assert.deepEqual(weekBounds('2026-09-13'), { from: '2026-09-07', to: '2026-09-13' }); // dimanche
  assert.deepEqual(weekBounds('2026-09-07'), { from: '2026-09-07', to: '2026-09-13' }); // lundi
  assert.equal(weekCount(c(), '2026-09-09'), 1); // 08/09 dans la semaine, 02/09 non
  assert.equal(dayNumber(c(), '2026-09-01'), 1);
  assert.equal(dayNumber(c(), '2026-09-09'), 9);
  assert.equal(dayNumber(c(), '2026-12-01'), 14);
  assert.equal(doneCount(c()), 2);
});
```

- [ ] **Step 2 : lancer, échec attendu**

Run: `npm test`
Expected: FAIL.

- [ ] **Step 3 : implémentation**

`js/modules/challenge/queries.js` :

```js
// Lectures pures sur le document Challenge.
import { addDays, diffDays, parseKey } from '../../core/dates.js';

export function endDay(c) { return addDays(c.startDay, c.days - 1); }

export function isActive(c, todayKey) { return c.endedAt === null && todayKey <= endDay(c); }

export function active(doc, todayKey) { return doc.challenges.find(c => isActive(c, todayKey)) ?? null; }

export function past(doc, todayKey) {
  return doc.challenges.filter(c => !isActive(c, todayKey)).sort((a, b) => b.startDay.localeCompare(a.startDay));
}

export function periodKeys(c) { return Array.from({ length: c.days }, (_, i) => addDays(c.startDay, i)); }

// États d'une case : fait, pas fait (passé), aujourd'hui (pas encore fait), à venir, hors période (arrêt anticipé).
export function dayStrip(c, todayKey) {
  const stopDay = c.endedAt ? c.endedAt.slice(0, 10) : null;
  return periodKeys(c).map(day => {
    let state;
    if (c.done[day]) state = 'done';
    else if (stopDay && day > stopDay) state = 'off';
    else if (day > todayKey) state = 'future';
    else if (day === todayKey) state = 'today';
    else state = 'missed';
    return { day, state };
  });
}

export function weekBounds(todayKey) {
  const dow = (parseKey(todayKey).getDay() + 6) % 7; // lundi = 0
  const from = addDays(todayKey, -dow);
  return { from, to: addDays(from, 6) };
}

export function weekCount(c, todayKey) {
  const { from, to } = weekBounds(todayKey);
  return periodKeys(c).filter(d => d >= from && d <= to && c.done[d]).length;
}

export function dayNumber(c, todayKey) {
  return Math.min(c.days, Math.max(1, diffDays(c.startDay, todayKey) + 1));
}

export function doneCount(c) { return periodKeys(c).filter(d => c.done[d]).length; }
```

- [ ] **Step 4 : lancer, succès**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5 : commit**

```bash
git add js/modules/challenge/queries.js tests/challenge/queries.test.mjs
git commit -m "Ajoute les lectures Challenge : période, bande de cases, semaine courante

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3 : opérations Challenge

**Files:**
- Create: `js/modules/challenge/ops.js`, `tests/challenge/ops.test.mjs`

**Interfaces:**
- Consumes: `Store` (`js/core/store.js`), `challengeSchema`, `DURATIONS`, `isTarget` (tâche 1), `active`, `isActive`, `endDay` (tâche 2), `isDayKey`.
- Produces: `createChallenge(store, { title, target, days }, todayKey) -> c`, `toggleDone(store, id, day, todayKey)`, `stopChallenge(store, id, nowIso)`, `autoClose(store, todayKey) -> nombre clos`.

- [ ] **Step 1 : test**

`tests/challenge/ops.test.mjs` :

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Store } from '../../js/core/store.js';
import { challengeSchema } from '../../js/modules/challenge/schema.js';
import { createChallenge, toggleDone, stopChallenge, autoClose } from '../../js/modules/challenge/ops.js';
import { active } from '../../js/modules/challenge/queries.js';
import { memoryStorage, fakeNow, fakeId, resetFakes } from '../fixtures/helpers.mjs';

function newStore() {
  resetFakes();
  const store = new Store(memoryStorage(), challengeSchema, { now: fakeNow, makeId: fakeId });
  store.load();
  return store;
}

test('createChallenge valide, démarre aujourd\'hui, refuse un second actif', () => {
  const store = newStore();
  const c = createChallenge(store, { title: ' Cardio ', target: { perWeek: 3 }, days: 30 }, '2026-09-20');
  assert.deepEqual(c, { id: 'id1', title: 'Cardio', target: { perWeek: 3 }, startDay: '2026-09-20', days: 30, endedAt: null, done: {} });
  assert.throws(() => createChallenge(store, { title: 'Lecture', target: { daily: true }, days: 14 }, '2026-09-20'), /déjà en cours/i);
  assert.equal(store.doc.challenges.length, 1);
  assert.throws(() => createChallenge(newStore(), { title: '', target: { daily: true }, days: 14 }, '2026-09-20'), /titre/i);
  assert.throws(() => createChallenge(newStore(), { title: 'x', target: { perWeek: 8 }, days: 14 }, '2026-09-20'), /cible/i);
  assert.throws(() => createChallenge(newStore(), { title: 'x', target: { daily: true }, days: 21 }, '2026-09-20'), /durée/i);
});

test('toggleDone bascule un jour de la période, jamais hors période, futur ou clos', () => {
  const store = newStore();
  const c = createChallenge(store, { title: 'Cardio', target: { daily: true }, days: 14 }, '2026-09-20');
  let n = 0; store.subscribe(() => { n += 1; });
  toggleDone(store, c.id, '2026-09-20', '2026-09-22');
  toggleDone(store, c.id, '2026-09-21', '2026-09-22');
  assert.deepEqual(store.doc.challenges[0].done, { '2026-09-20': true, '2026-09-21': true });
  toggleDone(store, c.id, '2026-09-20', '2026-09-22');
  assert.deepEqual(store.doc.challenges[0].done, { '2026-09-21': true });
  assert.equal(n, 3);
  assert.throws(() => toggleDone(store, c.id, '2026-09-23', '2026-09-22'), /futur/i);
  assert.throws(() => toggleDone(store, c.id, '2026-09-19', '2026-09-22'), /période/i);
  assert.throws(() => toggleDone(store, c.id, '2026-10-05', '2026-10-06'), /terminé|période/i);
  assert.throws(() => toggleDone(store, 'nope', '2026-09-21', '2026-09-22'), /introuvable/i);
  stopChallenge(store, c.id, '2026-09-22T10:00:00.000Z');
  assert.equal(store.doc.challenges[0].endedAt, '2026-09-22T10:00:00.000Z');
  assert.throws(() => toggleDone(store, c.id, '2026-09-21', '2026-09-22'), /terminé/i);
  assert.throws(() => stopChallenge(store, c.id, '2026-09-22T11:00:00.000Z'), /terminé/i);
  assert.equal(active(store.doc, '2026-09-22'), null);
});

test('autoClose clôt les challenges dont la période est écoulée, une seule fois', () => {
  const store = newStore();
  createChallenge(store, { title: 'Cardio', target: { daily: true }, days: 14 }, '2026-09-01');
  assert.equal(autoClose(store, '2026-09-14'), 0);
  assert.equal(store.doc.challenges[0].endedAt, null);
  let n = 0; store.subscribe(() => { n += 1; });
  assert.equal(autoClose(store, '2026-09-15'), 1);
  assert.equal(store.doc.challenges[0].endedAt, '2026-09-14T23:59:59.000Z');
  assert.equal(autoClose(store, '2026-09-16'), 0);
  assert.equal(n, 1);
  assert.equal(active(store.doc, '2026-09-16'), null);
});
```

- [ ] **Step 2 : lancer, échec attendu**

Run: `npm test`
Expected: FAIL.

- [ ] **Step 3 : implémentation**

`js/modules/challenge/ops.js` :

```js
import { isDayKey } from '../../core/dates.js';
import { DURATIONS, isTarget } from './schema.js';
import { active, isActive, endDay } from './queries.js';

function find(store, id) {
  const c = store.doc.challenges.find(x => x.id === id);
  if (!c) throw new Error('Challenge introuvable.');
  return c;
}

export function createChallenge(store, { title, target, days }, todayKey) {
  const t = (title ?? '').trim();
  if (!t) throw new Error('Le titre ne peut pas être vide.');
  if (!isTarget(target)) throw new Error('Cible invalide.');
  if (!DURATIONS.includes(days)) throw new Error('Durée invalide.');
  if (active(store.doc, todayKey)) throw new Error('Un challenge est déjà en cours.');
  return store.commit(doc => {
    const c = { id: store.makeId(), title: t, target, startDay: todayKey, days, endedAt: null, done: {} };
    doc.challenges.push(c);
    return c;
  });
}

export function toggleDone(store, id, day, todayKey) {
  const c = find(store, id);
  if (!isActive(c, todayKey)) throw new Error('Ce challenge est terminé.');
  if (!isDayKey(day) || day < c.startDay || day > endDay(c)) throw new Error('Jour hors période.');
  if (day > todayKey) throw new Error('Pas dans le futur.');
  store.commit(() => { if (c.done[day]) delete c.done[day]; else c.done[day] = true; });
}

export function stopChallenge(store, id, nowIso) {
  const c = find(store, id);
  if (!isActive(c, nowIso.slice(0, 10))) throw new Error('Ce challenge est terminé.');
  store.commit(() => { c.endedAt = nowIso; });
}

// Un challenge dont la période s'est écoulée pendant que l'app était fermée se clôt au chargement.
export function autoClose(store, todayKey) {
  const toClose = store.doc.challenges.filter(c => c.endedAt === null && todayKey > endDay(c));
  if (!toClose.length) return 0;
  store.commit(() => { for (const c of toClose) c.endedAt = `${endDay(c)}T23:59:59.000Z`; });
  return toClose.length;
}
```

- [ ] **Step 4 : lancer, succès**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5 : commit**

```bash
git add js/modules/challenge/ops.js tests/challenge/ops.test.mjs
git commit -m "Ajoute les opérations Challenge : création, bascule d'un jour, arrêt, clôture automatique

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4 : écran Challenge et branchement

**Files:**
- Create: `js/modules/challenge/views/home.js`
- Modify: `js/app.js`, `style.css`, `tests/views/smoke.test.mjs`

**Interfaces:**
- Consumes: tâches 1 à 3 ; `escapeHtml`, `frShort` ; `ctx` du plan 1.
- Produces: `render(root, ctx)` pour les vues `home` et `c` (challenge passé, `ctx.route.id`). `app.js` : store `challenge` dans `SCHEMAS`, module `challenge` dans `MODULES`, `autoClose` au chargement et au changement de jour.

- [ ] **Step 1 : smoke test**

Dans `tests/views/smoke.test.mjs`, ajouter `challengeSchema` aux schémas de `makeCtx` (import `../../js/modules/challenge/schema.js`, entrée `challenge: challengeSchema` dans l'objet `schemas`), et ajouter :

```js
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
```

Note : `makeCtx` doit rendre `route` assignable ; s'il l'expose déjà comme propriété simple, rien à changer.

- [ ] **Step 2 : lancer, échec attendu**

Run: `npm test`
Expected: FAIL, vue introuvable.

- [ ] **Step 3 : vue**

`js/modules/challenge/views/home.js` :

```js
// Challenge : un seul actif, une bande de cases, aucun compteur de retard, aucune analyse.
import { frShort } from '../../../core/dates.js';
import { escapeHtml } from '../../../core/ui.js';
import { DURATIONS, targetLabel } from '../schema.js';
import { active, past, endDay, dayStrip, weekCount, dayNumber, doneCount } from '../queries.js';
import { createChallenge, toggleDone, stopChallenge } from '../ops.js';

function stripHtml(c, todayKey, editable) {
  return `<div class="strip">${dayStrip(c, todayKey).map(s =>
    editable && (s.state === 'done' || s.state === 'missed' || s.state === 'today')
      ? `<button type="button" class="cell ${s.state}" data-toggle="${s.day}" aria-label="${escapeHtml(frShort(s.day))}"></button>`
      : `<span class="cell ${s.state}" aria-label="${escapeHtml(frShort(s.day))}"></span>`).join('')}</div>
    <div class="tiny">${escapeHtml(frShort(c.startDay))} → ${escapeHtml(frShort(endDay(c)))}</div>`;
}

function activeHtml(c, t) {
  const week = c.target.daily ? '' : ` · cette semaine : ${weekCount(c, t)} / ${c.target.perWeek}`;
  return `
    <div class="card">
      <div class="card-title">${escapeHtml(c.title)}</div>
      <div class="tiny">jour ${dayNumber(c, t)} sur ${c.days} · ${escapeHtml(targetLabel(c.target))}${week}</div>
    </div>
    <button type="button" class="btn btn-big${c.done[t] ? ' done' : ''}" data-toggle="${t}">${c.done[t] ? '✓ Fait aujourd\'hui' : 'Fait aujourd\'hui'}</button>
    <div class="card">${stripHtml(c, t, true)}</div>
    <p class="note">Un tap sur une case passée la bascule. Rien d'autre à compter.</p>
    <button type="button" class="btn-text" data-stop>Arrêter ce challenge</button>`;
}

function formHtml(doc, t) {
  const list = past(doc, t);
  return `
    <div class="card">
      <div class="card-title">Nouveau challenge</div>
      <form id="new-challenge">
        <label class="field"><span class="tl">Titre</span><input type="text" name="title" placeholder="Cardio, lecture, sans écran après 22 h…" autocomplete="off" required></label>
        <label class="field"><span class="tl">Cible</span>
          <select name="target">
            <option value="daily">Tous les jours</option>
            ${[1, 2, 3, 4, 5, 6, 7].map(n => `<option value="${n}"${n === 3 ? ' selected' : ''}>${n} fois par semaine</option>`).join('')}
          </select></label>
        <label class="field"><span class="tl">Durée</span>
          <select name="days">${DURATIONS.map(d => `<option value="${d}"${d === 30 ? ' selected' : ''}>${d} jours</option>`).join('')}</select></label>
        <div class="sheet-actions"><button type="submit" class="btn">Commencer aujourd'hui</button></div>
      </form>
    </div>
    <div class="label">Passés</div>
    ${list.length ? list.map(c => `<button type="button" class="row" data-go="${escapeHtml(c.id)}">
        <span class="row-main"><span class="row-title">${escapeHtml(c.title)}</span>
        <span class="row-sub">${escapeHtml(frShort(c.startDay))} → ${escapeHtml(frShort(endDay(c)))} · ${escapeHtml(targetLabel(c.target))}</span></span>
        <span class="row-aside">${doneCount(c)} faits / ${c.days} jours</span>
      </button>`).join('') : '<p class="empty">Aucun challenge passé.</p>'}`;
}

function pastHtml(c, t) {
  return `
    <nav class="crumbs"><button type="button" class="btn-text" data-back>‹ Challenges</button></nav>
    <div class="card">
      <div class="card-title">${escapeHtml(c.title)}</div>
      <div class="tiny">${escapeHtml(targetLabel(c.target))} · ${doneCount(c)} faits / ${c.days} jours</div>
    </div>
    <div class="card">${stripHtml(c, t, false)}</div>`;
}

export function render(root, ctx) {
  const t = ctx.today();
  const store = ctx.stores.challenge;
  const doc = store.doc;
  const route = ctx.route;

  if (route?.view === 'c') {
    const c = doc.challenges.find(x => x.id === route.id);
    root.innerHTML = c ? pastHtml(c, t) : '<p class="empty">Challenge introuvable.</p><button type="button" class="btn-text" data-back>‹ Challenges</button>';
    root.onclick = e => { if (e.target.closest('[data-back]')) ctx.navigate({ tab: 'challenge' }); };
    return;
  }

  const c = active(doc, t);
  root.innerHTML = c ? activeHtml(c, t) : formHtml(doc, t);

  root.onclick = e => {
    const tg = e.target.closest('[data-toggle]');
    if (tg && c) { try { toggleDone(store, c.id, tg.dataset.toggle, t); } catch (err) { ctx.notice(err.message); } return; }
    if (e.target.closest('[data-stop]') && c) {
      if (confirm('Arrêter ce challenge ? Les jours faits sont conservés.')) { stopChallenge(store, c.id, new Date().toISOString()); ctx.notice('Arrêté.'); }
      return;
    }
    const go = e.target.closest('[data-go]');
    if (go) ctx.navigate({ tab: 'challenge', view: 'c', id: go.dataset.go });
  };

  const form = root.querySelector('#new-challenge');
  if (form) form.onsubmit = e => {
    e.preventDefault();
    const fd = new FormData(form);
    const tv = fd.get('target');
    const target = tv === 'daily' ? { daily: true } : { perWeek: Number(tv) };
    try { createChallenge(store, { title: fd.get('title'), target, days: Number(fd.get('days')) }, t); ctx.notice('C\'est parti.'); }
    catch (err) { ctx.notice(err.message); }
  };
}
```

- [ ] **Step 4 : styles**

Ajouter à la fin de `style.css` :

```css
/* Challenge : bande de cases */
.strip { display: grid; grid-template-columns: repeat(auto-fill, minmax(26px, 1fr)); gap: 6px; margin-bottom: 8px; }
.cell { display: block; aspect-ratio: 1; border-radius: 7px; border: 1px solid var(--line); background: var(--card2); padding: 0; }
.cell.done { background: var(--accent); border-color: var(--accent); }
.cell.today { border-color: var(--accent); border-width: 2px; }
.cell.future, .cell.off { opacity: 0.35; }
.btn-big { padding: 20px; font-size: 1.1rem; margin-bottom: 10px; }
.btn-big.done { background: var(--accent-soft); color: var(--fg); }
.crumbs { margin-bottom: 10px; }
```

- [ ] **Step 5 : app.js**

Dans `js/app.js` :

1. Après `import { testsSchema } from './modules/tests/schema.js';`, ajouter :

```js
import { challengeSchema } from './modules/challenge/schema.js';
import { autoClose } from './modules/challenge/ops.js';
```

2. Après `import * as pulsionHome from './modules/pulsion/views/home.js';`, ajouter :

```js
import * as challengeHome from './modules/challenge/views/home.js';
```

3. Remplacer la ligne `SCHEMAS` par :

```js
export const SCHEMAS = { settings: settingsSchema, suivi: suiviSchema, pulsion: pulsionSchema, challenge: challengeSchema, tests: testsSchema };
```

4. Dans `MODULES`, après la ligne `pulsion:`, ajouter :

```js
  challenge: { label: 'Challenge', stores: ['challenge'], views: { home: challengeHome.render, c: challengeHome.render } },
```

et dans l'entrée `settings`, remplacer `stores: ['settings', 'suivi', 'pulsion', 'tests']` par `stores: ['settings', 'suivi', 'pulsion', 'challenge', 'tests']`.

5. Juste après `applyTheme(stores.settings.doc.theme);`, ajouter :

```js
  autoClose(stores.challenge, today());
```

6. Remplacer `watchDayChange({ today, onChange: () => { dailyBackups(); if (route) draw(); } });` par :

```js
  watchDayChange({ today, onChange: () => { autoClose(stores.challenge, today()); dailyBackups(); if (route) draw(); } });
```

- [ ] **Step 6 : lancer, succès**

Run: `node --check js/app.js && npm test`
Expected: PASS, smoke test Challenge compris.

- [ ] **Step 7 : commit**

```bash
git add js/modules/challenge js/app.js style.css tests/views/smoke.test.mjs
git commit -m "Ajoute l'onglet Challenge : un actif à la fois, bande de cases, passés en lecture seule

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5 : lectures et opérations Tests

**Files:**
- Create: `js/modules/tests/queries.js`, `js/modules/tests/ops.js`, `tests/tests/queries.test.mjs`

**Interfaces:**
- Consumes: `testsSchema` (plan 1), `Store`.
- Produces: `runsOf(doc, testId)` (du plus ancien au plus récent), `lastRun(doc, testId) -> run | null`, `history(doc, n = 12)` (du plus récent au plus ancien) ; `addRun(store, testId, metrics, todayKey, { notify = true } = {}) -> run`.

- [ ] **Step 1 : test**

`tests/tests/queries.test.mjs` :

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Store } from '../../js/core/store.js';
import { testsSchema } from '../../js/modules/tests/schema.js';
import { runsOf, lastRun, history } from '../../js/modules/tests/queries.js';
import { addRun } from '../../js/modules/tests/ops.js';
import { memoryStorage, fakeNow, fakeId, resetFakes } from '../fixtures/helpers.mjs';

const doc = { version: 1, runs: [
  { id: 2, ts: '2026-09-14T09:10:00.000Z', day: '2026-09-14', test: 'span', metrics: { span: 5 } },
  { id: 1, ts: '2026-09-07T09:00:00.000Z', day: '2026-09-07', test: 'pvt', metrics: { median: 260 } },
  { id: 3, ts: '2026-09-14T09:00:00.000Z', day: '2026-09-14', test: 'pvt', metrics: { median: 250 } },
] };

test('runsOf, lastRun, history', () => {
  assert.deepEqual(runsOf(doc, 'pvt').map(r => r.id), [1, 3]);
  assert.equal(lastRun(doc, 'pvt').id, 3);
  assert.equal(lastRun(doc, 'phq8'), null);
  assert.deepEqual(history(doc, 2).map(r => r.id), [2, 3]);
  assert.deepEqual(history(doc).map(r => r.id), [2, 3, 1]);
});

test('addRun enregistre un run daté, avec ou sans notification', () => {
  resetFakes();
  const store = new Store(memoryStorage(), testsSchema, { now: fakeNow, makeId: fakeId });
  store.load();
  let n = 0; store.subscribe(() => { n += 1; });
  const r = addRun(store, 'pvt', { median: 240 }, '2026-09-20');
  assert.deepEqual(r, { id: 'id1', ts: '2026-09-20T10:01:00.000Z', day: '2026-09-20', test: 'pvt', metrics: { median: 240 } });
  assert.equal(n, 1);
  addRun(store, 'phq8', { score: 3 }, '2026-09-20', { notify: false });
  assert.equal(n, 1);
  assert.equal(store.doc.runs.length, 2);
  assert.throws(() => addRun(store, 'pvt', null, '2026-09-20'), /métriques/i);
});
```

- [ ] **Step 2 : lancer, échec attendu**

Run: `npm test`
Expected: FAIL.

- [ ] **Step 3 : implémentation**

`js/modules/tests/queries.js` :

```js
// Lectures pures sur le document Tests.
export function runsOf(doc, testId) {
  return doc.runs.filter(r => r.test === testId).sort((a, b) => a.ts.localeCompare(b.ts));
}

export function lastRun(doc, testId) {
  const runs = runsOf(doc, testId);
  return runs.length ? runs[runs.length - 1] : null;
}

export function history(doc, n = 12) {
  return [...doc.runs].sort((a, b) => b.ts.localeCompare(a.ts)).slice(0, n);
}
```

`js/modules/tests/ops.js` :

```js
// L'enregistrement d'un run est le seul écrit du module : il n'a lieu qu'au bouton final d'une passation.
export function addRun(store, testId, metrics, todayKey, { notify = true } = {}) {
  if (!metrics || typeof metrics !== 'object') throw new Error('Métriques manquantes.');
  return store.commit(doc => {
    const run = { id: store.makeId(), ts: store.now(), day: todayKey, test: testId, metrics };
    doc.runs.push(run);
    return run;
  }, { notify });
}
```

- [ ] **Step 4 : lancer, succès**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5 : commit**

```bash
git add js/modules/tests/queries.js js/modules/tests/ops.js tests/tests/queries.test.mjs
git commit -m "Ajoute les lectures et l'enregistrement des runs de tests

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6 : catalogue — PVT-B, PHQ-8, index

**Files:**
- Create: `js/modules/tests/catalog/pvt.js`, `js/modules/tests/catalog/phq8.js`, `js/modules/tests/catalog/index.js`, `tests/tests/catalog.test.mjs`

**Interfaces:**
- Consumes: `median`, `mean` (`js/core/stats.js`), `daysBetween` (`js/core/dates.js`). La **scène** (tâche 7) expose : `el` (conteneur central), `title(t)`, `timer(t)`, `body(html)`, `timeout(fn, ms) -> h`, `clearTimeout(h)`, `interval(fn, ms) -> h`, `raf(fn) -> h`, `cancelRaf(h)`, `listen(target, event, fn)`, `clearAll()`, `result(title, lines, onSave)`.
- Produces: descripteur de test `{ id, label, subtitle, note?, run(stage, onDone, { lastRun }), summary(run) -> string, chart: { title, value(run) -> number | null } }`. `pvtMetrics(rts, falseStarts)`, `PHQ_ITEMS`, `PHQ_OPTIONS`, `phqBand(score)`, `phqMetrics(answers)`, `overlapWarning(daysSince) -> string | null`. `CATALOG`, `testById(id)`, `summaryFor(run)`.

- [ ] **Step 1 : test**

`tests/tests/catalog.test.mjs` :

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pvtMetrics, pvt } from '../../js/modules/tests/catalog/pvt.js';
import { PHQ_ITEMS, PHQ_OPTIONS, phqBand, phqMetrics, overlapWarning, phq8 } from '../../js/modules/tests/catalog/phq8.js';
import { CATALOG, testById, summaryFor } from '../../js/modules/tests/catalog/index.js';

// Scène factice : enregistre sans exécuter.
function fakeStage() {
  const el = { innerHTML: '', querySelector: () => el, querySelectorAll: () => [], addEventListener() {}, removeEventListener() {}, classList: { add() {}, remove() {} }, textContent: '' };
  const s = { el, titles: [], timers: [], intervals: [], listeners: [], cleared: 0, results: [],
    title: t => s.titles.push(t), timer: () => {}, body: html => { el.innerHTML = html; },
    timeout: (fn, ms) => { s.timers.push({ fn, ms }); return s.timers.length; }, clearTimeout: () => {},
    interval: (fn, ms) => { s.intervals.push({ fn, ms }); return 1; }, raf: () => 1, cancelRaf: () => {},
    listen: (target, ev, fn) => s.listeners.push({ ev, fn }), clearAll: () => { s.cleared += 1; },
    result: (title, lines, onSave) => s.results.push({ title, lines, onSave }) };
  return s;
}

test('pvtMetrics : médiane, lapses, faux départs, vitesse', () => {
  const m = pvtMetrics([250, 300, 400, 200.4], 2);
  assert.equal(m.n, 4);
  assert.equal(m.median, 275);
  assert.equal(m.mean, 288);
  assert.equal(m.lapses, 1);
  assert.equal(m.falseStarts, 2);
  assert.equal(m.speed, 3.71);
  assert.deepEqual(pvtMetrics([], 3), { n: 0, median: null, mean: null, lapses: 0, falseStarts: 3, speed: null });
});

test('PVT : écran d\'accueil, puis démarrage arme un minuteur et un intervalle, sans onDone', () => {
  const stage = fakeStage();
  let saved = null;
  pvt.run(stage, m => { saved = m; }, { lastRun: null });
  assert.match(stage.el.innerHTML, /Commencer/);
  assert.equal(stage.listeners.length, 1);
  stage.listeners[0].fn(); // tap sur Commencer
  assert.equal(stage.intervals.length, 1);
  assert.ok(stage.timers.length >= 1);
  const isi = stage.timers.find(t => t.ms >= 1000 && t.ms <= 4000);
  assert.ok(isi, 'un intervalle inter-stimulus entre 1 et 4 s est armé');
  assert.equal(saved, null);
  assert.equal(stage.results.length, 0);
  assert.equal(pvt.summary({ metrics: { median: 250, lapses: 2, n: 40 } }), 'PVT 250 ms · 2 lapses');
  assert.equal(pvt.chart.value({ metrics: { median: 250 } }), 250);
});

test('PHQ-8 : items, bandes, métriques, avertissement de recouvrement', () => {
  assert.equal(PHQ_ITEMS.length, 8);
  assert.deepEqual(PHQ_OPTIONS.map(o => o[1]), [0, 1, 2, 3]);
  assert.equal(phqBand(4), 'minimal');
  assert.equal(phqBand(5), 'léger');
  assert.equal(phqBand(14), 'modéré');
  assert.equal(phqBand(15), 'modérément sévère');
  assert.equal(phqBand(20), 'sévère');
  assert.deepEqual(phqMetrics([0, 1, 2, 3, 0, 1, 2, 3]), { score: 12, band: 'modéré', items: [0, 1, 2, 3, 0, 1, 2, 3] });
  assert.equal(overlapWarning(null), null);
  assert.equal(overlapWarning(14), null);
  assert.match(overlapWarning(9), /9 jours/);
  assert.equal(phq8.summary({ metrics: { score: 12, band: 'modéré' } }), 'PHQ-8 12/24 · modéré');
});

test('PHQ-8 : la passation enchaîne les huit questions et ne rend le résultat qu\'à la fin', () => {
  const stage = fakeStage();
  let saved = null;
  phq8.run(stage, m => { saved = m; }, { lastRun: { ts: new Date(Date.now() - 5 * 864e5).toISOString() } });
  assert.match(stage.el.innerHTML, /Commencer/);
  assert.match(stage.el.innerHTML, /5 jours/);
  stage.listeners[0].fn();
  assert.match(stage.el.innerHTML, new RegExp(PHQ_ITEMS[0].slice(0, 20)));
  assert.equal(stage.results.length, 0);
  assert.equal(saved, null);
});

test('catalogue : deux tests, identifiants uniques, libellés de repli', () => {
  assert.deepEqual(CATALOG.map(t => t.id), ['pvt', 'phq8']);
  assert.equal(testById('pvt').label.startsWith('PVT-B'), true);
  assert.equal(testById('nope'), undefined);
  assert.equal(summaryFor({ test: 'span', metrics: { span: 6, correct: 4, trials: 5 } }), 'Empan inversé 6 · 4/5 essais');
  assert.equal(summaryFor({ test: 'corsi', metrics: { span: 5, correct: 3, trials: 4 } }), 'Corsi 5 · 3/4 essais');
  assert.equal(summaryFor({ test: 'sdmt', metrics: { correct: 40, errors: 1 } }), 'Substitution 40 corrects · 1 err.');
  assert.equal(summaryFor({ test: 'fluence', metrics: { sem: 20, pho: 15 } }), 'Fluence 20 / 15');
  assert.equal(summaryFor({ test: 'phq', metrics: { score: 6, band: 'léger' } }), 'PHQ-8 6/24 · léger');
  assert.equal(summaryFor({ test: 'inconnu', metrics: {} }), 'inconnu');
});
```

Note : les runs historiques de PHQ-8 portent `test: 'phq'` (ancienne app) alors que le catalogue utilise `phq8`. `summaryFor` traite `phq` comme repli, et le catalogue PHQ-8 lit ses runs sous les deux identifiants (voir `runsOfAny` dans l'index).

- [ ] **Step 2 : lancer, échec attendu**

Run: `npm test`
Expected: FAIL.

- [ ] **Step 3 : PVT-B**

`js/modules/tests/catalog/pvt.js` :

```js
// PVT-B : 3 minutes, intervalle 1 à 4 s, lapse au-dessus de 355 ms, faux départ avant stimulus ou sous 100 ms.
// Les valeurs absolues incluent la latence de l'écran tactile : comparables à soi-même seulement.
import { median, mean } from '../../../core/stats.js';

const DURATION_MS = 180000;
const LAPSE_MS = 355;
const round2 = v => Math.round(v * 100) / 100;

export function pvtMetrics(rts, falseStarts) {
  const n = rts.length;
  const lapses = rts.filter(r => r > LAPSE_MS).length;
  const speed = n ? round2(mean(rts.map(r => 1000 / r))) : null;
  return { n, median: n ? Math.round(median(rts)) : null, mean: n ? Math.round(mean(rts)) : null, lapses, falseStarts, speed };
}

function mmss(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function start(stage, onDone) {
  const rts = [];
  let falseStarts = 0, onset = null, isi = null, raf = null, done = false;
  const end = performance.now() + DURATION_MS;
  stage.body('<div class="stim" data-stim><span class="counter mono" data-cnt></span></div><div class="flash" data-flash></div>');
  const stim = stage.el.querySelector('[data-stim]');
  const cnt = stage.el.querySelector('[data-cnt]');
  const flash = stage.el.querySelector('[data-flash]');
  const tick = () => stage.timer(mmss(end - performance.now()));
  stage.interval(tick, 250);
  tick();

  function schedule() {
    onset = null; cnt.textContent = ''; stim.classList.remove('on');
    if (performance.now() >= end) { finish(); return; }
    isi = stage.timeout(() => {
      onset = performance.now(); stim.classList.add('on');
      const loop = () => { if (onset === null) return; cnt.textContent = Math.round(performance.now() - onset); raf = stage.raf(loop); };
      loop();
    }, 1000 + Math.random() * 3000);
  }

  function onTap() {
    if (done) return;
    if (onset === null) {
      falseStarts++; stage.clearTimeout(isi);
      flash.textContent = 'trop tôt';
      stage.timeout(() => { if (!done) flash.textContent = ''; }, 700);
      schedule();
      return;
    }
    const rt = performance.now() - onset;
    stage.cancelRaf(raf); onset = null; stim.classList.remove('on');
    if (rt < 100) { falseStarts++; flash.textContent = 'trop tôt'; }
    else { rts.push(rt); cnt.textContent = Math.round(rt); flash.textContent = ''; }
    stage.timeout(() => { if (!done) { flash.textContent = ''; schedule(); } }, 900);
  }
  stage.listen(stage.el, 'pointerdown', onTap);

  function finish() {
    done = true;
    const m = pvtMetrics(rts, falseStarts);
    stage.result('PVT-B terminé', [
      `Médiane : <b>${m.median ?? '—'} ms</b>`,
      `Lapses (> ${LAPSE_MS} ms) : <b>${m.lapses}</b> sur ${m.n}`,
      `Faux départs : <b>${m.falseStarts}</b>`,
      `Vitesse moyenne (1/RT) : <b>${m.speed ?? '—'}</b>`,
    ], () => onDone(m));
  }
  schedule();
}

export const pvt = {
  id: 'pvt',
  label: 'PVT-B — attention soutenue',
  subtitle: "3 min · hebdomadaire · effet d'apprentissage quasi nul",
  note: "Les valeurs absolues incluent la latence de l'écran tactile : elles ne se comparent pas à des normes publiées, seulement à tes propres runs.",
  run(stage, onDone) {
    stage.title('PVT-B');
    stage.body('<div class="stage-title">Attention soutenue — 3 min</div>'
      + "<div class=\"stage-body\">Un compteur se déclenche à intervalles irréguliers. Tape l'écran dès qu'il apparaît, le plus vite possible — mais pas avant, sinon c'est un faux départ. Téléphone en main, sans distraction.</div>"
      + '<button type="button" class="btn stage-btn" data-go>Commencer</button>');
    stage.listen(stage.el.querySelector('[data-go]'), 'click', () => start(stage, onDone));
  },
  summary: r => `PVT ${r.metrics.median ?? '—'} ms · ${r.metrics.lapses} lapses`,
  chart: { title: 'Médiane, ms — plus bas = mieux', value: r => (Number.isFinite(r.metrics.median) ? r.metrics.median : null) },
};
```

- [ ] **Step 4 : PHQ-8**

`js/modules/tests/catalog/phq8.js` :

```js
// PHQ-8 : 8 items, 0 à 3 chacun, total 0 à 24. C'est le PHQ-9 privé de son 9e item, une question de
// risque clinique qui n'a pas sa place dans un outil sans clinicien derrière. Fenêtre de deux semaines,
// d'où l'espacement mensuel recommandé.
import { daysBetween } from '../../../core/dates.js';

export const PHQ_ITEMS = [
  "Peu d'intérêt ou de plaisir à faire les choses",
  'Te sentir triste, déprimé ou désespéré',
  "Difficultés à t'endormir ou à rester endormi, ou au contraire dormir trop",
  "Te sentir fatigué ou avoir peu d'énergie",
  "Peu d'appétit ou manger trop",
  "Avoir une mauvaise opinion de toi-même, ou le sentiment d'être un raté, ou d'avoir déçu tes proches",
  'Difficultés à te concentrer, par exemple pour lire ou suivre quelque chose',
  "Parler ou bouger si lentement que les autres l'ont remarqué — ou au contraire être agité au point de bouger beaucoup plus que d'habitude",
];
export const PHQ_OPTIONS = [['Jamais', 0], ['Plusieurs jours', 1], ['Plus de la moitié du temps', 2], ['Presque tous les jours', 3]];

export function phqBand(score) {
  if (score <= 4) return 'minimal';
  if (score <= 9) return 'léger';
  if (score <= 14) return 'modéré';
  if (score <= 19) return 'modérément sévère';
  return 'sévère';
}

export function phqMetrics(answers) {
  const score = answers.reduce((a, b) => a + b, 0);
  return { score, band: phqBand(score), items: answers };
}

export function overlapWarning(daysSince) {
  if (daysSince === null || daysSince === undefined || daysSince >= 14) return null;
  return `Dernière passation il y a ${daysSince} jours. Les items portent sur deux semaines : deux mesures rapprochées se recouvrent et ne sont pas indépendantes.`;
}

function ask(stage, i, answers, onDone) {
  if (i >= PHQ_ITEMS.length) {
    const m = phqMetrics(answers);
    const lines = [
      `Score : <b>${m.score} / 24</b>`,
      `Sévérité : <b>${m.band}</b>`,
      '<span class="tiny">Seuils : 5 léger · 10 modéré · 15 modérément sévère · 20 sévère</span>',
    ];
    if (m.score >= 15) lines.push("<span class=\"warn\">Un score dans cette zone, ou qui monte sur deux passations de suite, n'est plus une question de protocole : c'est un chiffre à montrer à un médecin.</span>");
    stage.result('PHQ-8 terminé', lines, () => onDone(m));
    return;
  }
  stage.timer(`${i + 1} / ${PHQ_ITEMS.length}`);
  stage.body(`<div class="qtext">${PHQ_ITEMS[i]}</div>`
    + `<div class="qopts">${PHQ_OPTIONS.map(([l, v]) => `<button type="button" data-v="${v}">${l}</button>`).join('')}</div>`
    + (i > 0 ? '<button type="button" class="btn btn-ghost stage-btn" data-back>Question précédente</button>' : ''));
  for (const b of stage.el.querySelectorAll('[data-v]')) b.onclick = () => ask(stage, i + 1, answers.concat(Number(b.dataset.v)), onDone);
  const back = stage.el.querySelector('[data-back]');
  if (back && i > 0) back.onclick = () => ask(stage, i - 1, answers.slice(0, -1), onDone);
}

export const phq8 = {
  id: 'phq8',
  label: 'PHQ-8 — humeur',
  subtitle: '8 items · deux dernières semaines · mensuel',
  legacyIds: ['phq'],
  run(stage, onDone, { lastRun = null } = {}) {
    stage.title('PHQ-8');
    const ds = lastRun ? daysBetween(lastRun.ts, new Date().toISOString()) : null;
    const warn = overlapWarning(ds);
    stage.body('<div class="stage-title">Humeur — 8 items</div>'
      + '<div class="stage-body">Sur les <b>deux dernières semaines</b>, à quelle fréquence as-tu été gêné par chacun de ces problèmes ? Réponds au plus juste, sans réfléchir longtemps.</div>'
      + (warn ? `<div class="warn">${warn}</div>` : '')
      + '<button type="button" class="btn stage-btn" data-go>Commencer</button>');
    stage.listen(stage.el.querySelector('[data-go]'), 'click', () => ask(stage, 0, [], onDone));
  },
  summary: r => `PHQ-8 ${r.metrics.score}/24 · ${r.metrics.band}`,
  chart: { title: 'Score /24 — plus bas = mieux', value: r => (Number.isFinite(r.metrics.score) ? r.metrics.score : null) },
};
```

- [ ] **Step 5 : index**

`js/modules/tests/catalog/index.js` :

```js
// Catalogue des tests proposés : retirer un test = retirer une ligne ; en ajouter = un fichier.
import { pvt } from './pvt.js';
import { phq8 } from './phq8.js';
import { runsOf } from '../queries.js';

export const CATALOG = [pvt, phq8];

export function testById(id) { return CATALOG.find(t => t.id === id); }

// Un test peut avoir été enregistré sous un ancien identifiant (phq → phq8).
export function idsOf(t) { return [t.id, ...(t.legacyIds ?? [])]; }

export function runsOfAny(doc, t) {
  return idsOf(t).flatMap(id => runsOf(doc, id)).sort((a, b) => a.ts.localeCompare(b.ts));
}

// Libellés de repli pour les runs historiques hors catalogue.
const LEGACY = {
  span: m => `Empan inversé ${m.span} · ${m.correct}/${m.trials} essais`,
  corsi: m => `Corsi ${m.span} · ${m.correct}/${m.trials} essais`,
  sdmt: m => `Substitution ${m.correct} corrects · ${m.errors} err.`,
  fluence: m => `Fluence ${m.sem} / ${m.pho}`,
  phq: m => `PHQ-8 ${m.score}/24 · ${m.band}`,
};

export function summaryFor(run) {
  const t = CATALOG.find(x => idsOf(x).includes(run.test));
  if (t) return t.summary(run);
  const f = LEGACY[run.test];
  return f ? f(run.metrics) : run.test;
}
```

- [ ] **Step 6 : lancer, succès**

Run: `npm test`
Expected: PASS.

- [ ] **Step 7 : commit**

```bash
git add js/modules/tests/catalog tests/tests/catalog.test.mjs
git commit -m "Ajoute le catalogue de tests : PVT-B, PHQ-8, libellés de repli

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7 : scène, écrans Tests, crochet onLeave

**Files:**
- Create: `js/modules/tests/stage.js`, `js/modules/tests/views/home.js`, `js/modules/tests/views/run.js`, `tests/tests/stage.test.mjs`
- Modify: `js/app.js`, `style.css`, `tests/views/smoke.test.mjs`

**Interfaces:**
- Consumes: tâches 5 et 6 ; `sparkline`, `frShort`, `hhmm`, `relativeDays`, `escapeHtml` ; `ctx`.
- Produces: `createStage(root, { onQuit })` ; vues `home` et `run` ; `ctx.onLeave(fn)` dans `app.js` (appelé une fois au prochain changement de route, puis oublié).

- [ ] **Step 1 : tests**

`tests/tests/stage.test.mjs` :

```js
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
```

Dans `tests/views/smoke.test.mjs`, remplacer `fakeRoot` par une version dont les éléments factices sont récursifs :

```js
export function fakeRoot() {
  // Élément inerte récursif : classList, champs de formulaire, sous-requêtes, écouteurs.
  const el = { innerHTML: '', textContent: '', classList: { toggle() {}, add() {}, remove() {} }, provider: {}, model: {}, apiKey: {},
    addEventListener() {}, removeEventListener() {} };
  el.querySelector = () => el;
  el.querySelectorAll = () => [];
  return { innerHTML: '', querySelector: () => el, querySelectorAll: () => [] };
}
```

et ajouter :

```js
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
```

- [ ] **Step 2 : lancer, échec attendu**

Run: `npm test`
Expected: FAIL.

- [ ] **Step 3 : scène**

`js/modules/tests/stage.js` :

```js
// Scène de passation : écran plein, minuteurs et écouteurs suivis, nettoyage d'un coup.
// Un test n'arme jamais un setTimeout brut : tout passe par la scène, qui sait tout arrêter
// quand on quitte (bouton Quitter ou retour du téléphone).
// Appels explicites : une référence détachée à requestAnimationFrame lève « Illegal invocation » dans certains navigateurs.
const RAF = fn => (globalThis.requestAnimationFrame ? requestAnimationFrame(fn) : setTimeout(fn, 16));
const CAF = h => (globalThis.cancelAnimationFrame ? cancelAnimationFrame(h) : clearTimeout(h));

export function createStage(root, { onQuit } = {}) {
  root.innerHTML = `<div class="stage">
    <div class="stage-top">
      <span data-stage-label></span>
      <span class="mono" data-stage-timer></span>
      <button type="button" class="btn btn-ghost stage-quit" data-stage-quit>Quitter</button>
    </div>
    <div class="stage-mid" data-stage-mid></div>
  </div>`;
  const q = sel => root.querySelector(sel);
  const timers = new Set(), intervals = new Set(), rafs = new Set(), listeners = [];

  const stage = {
    el: q('[data-stage-mid]'),
    title(t) { q('[data-stage-label]').textContent = t; },
    timer(t) { q('[data-stage-timer]').textContent = t; },
    body(html) { stage.el.innerHTML = html; },
    timeout(fn, ms) { const h = setTimeout(() => { timers.delete(h); fn(); }, ms); timers.add(h); return h; },
    clearTimeout(h) { clearTimeout(h); timers.delete(h); },
    interval(fn, ms) { const h = setInterval(fn, ms); intervals.add(h); return h; },
    raf(fn) { const h = RAF(() => { rafs.delete(h); fn(); }); rafs.add(h); return h; },
    cancelRaf(h) { CAF(h); rafs.delete(h); },
    listen(target, ev, fn) { target.addEventListener(ev, fn); listeners.push([target, ev, fn]); },
    clearAll() {
      for (const h of timers) clearTimeout(h); timers.clear();
      for (const h of intervals) clearInterval(h); intervals.clear();
      for (const h of rafs) CAF(h); rafs.clear();
      for (const [t, e, f] of listeners) t.removeEventListener(e, f); listeners.length = 0;
    },
    result(title, lines, onSave) {
      stage.clearAll();
      stage.timer('');
      q('[data-stage-quit]').classList.add('hidden');
      stage.body(`<div class="stage-title">${title}</div><div class="res">${lines.join('<br>')}</div>`
        + '<button type="button" class="btn stage-btn" data-save>Enregistrer</button>');
      stage.el.querySelector('[data-save]').onclick = onSave;
    },
  };
  q('[data-stage-quit]').onclick = () => { stage.clearAll(); onQuit?.(); };
  return stage;
}
```

- [ ] **Step 4 : vues**

`js/modules/tests/views/home.js` :

```js
// Tests : une carte par test du catalogue, courbe à partir du deuxième run, historique tous tests.
import { frShort, hhmm } from '../../../core/dates.js';
import { sparkline } from '../../../core/chart.js';
import { escapeHtml } from '../../../core/ui.js';
import { CATALOG, runsOfAny, summaryFor } from '../catalog/index.js';
import { history } from '../queries.js';

function chartHtml(runs, chart) {
  if (runs.length === 0) return '<div class="chart-empty">Courbe à partir du 2ᵉ run.</div>';
  if (runs.length === 1) return '<div class="chart-empty">1 run enregistré — la courbe démarre au prochain.</div>';
  const values = runs.map(chart.value);
  const nums = values.filter(v => v !== null);
  if (!nums.length) return '<div class="chart-empty">Pas de valeur exploitable.</div>';
  return `<div class="chart-hd"><span class="tiny">${escapeHtml(chart.title)}</span></div>
    ${sparkline({ values, min: null, max: null })}
    <div class="chart-ft tiny"><span>${escapeHtml(frShort(runs[0].day))}</span><span class="mono">${Math.round(Math.min(...nums))}–${Math.round(Math.max(...nums))}</span><span>${escapeHtml(frShort(runs[runs.length - 1].day))}</span></div>`;
}

function card(doc, t) {
  const runs = runsOfAny(doc, t);
  const last = runs.length ? runs[runs.length - 1] : null;
  return `<div class="card">
    <div class="card-title">${escapeHtml(t.label)}</div>
    <div class="tiny">${escapeHtml(t.subtitle)}</div>
    <div class="tiny" style="margin-top:8px">${last ? `Dernier : ${escapeHtml(frShort(last.day))} ${escapeHtml(hhmm(last.ts))} — ${escapeHtml(t.summary(last))}` : 'Jamais lancé'}</div>
    <div class="chart">${chartHtml(runs, t.chart)}</div>
    ${t.note ? `<p class="note">${escapeHtml(t.note)}</p>` : ''}
    <button type="button" class="btn" style="margin-top:12px" data-run="${escapeHtml(t.id)}">Lancer</button>
  </div>`;
}

export function render(root, ctx) {
  const doc = ctx.stores.tests.doc;
  const runs = history(doc, 12);
  root.innerHTML = `
    <p class="note" style="margin:6px 0 14px">Instruments de mesure, pas d'entraînement. Toujours au même créneau horaire, même état caféine. Seule la tendance sur plusieurs semaines veut dire quelque chose.</p>
    ${CATALOG.map(t => card(doc, t)).join('')}
    <div class="label">Historique</div>
    <div class="card evlist">${runs.length
      ? runs.map(r => `<span class="tiny">${escapeHtml(frShort(r.day))} ${escapeHtml(hhmm(r.ts))}</span> — ${escapeHtml(summaryFor(r))}`).join('<br>')
      : '<span class="tiny">Aucun run enregistré.</span>'}</div>
  `;
  root.onclick = e => {
    const b = e.target.closest('[data-run]');
    if (b) ctx.navigate({ tab: 'tests', view: 'run', id: b.dataset.run });
  };
}
```

`js/modules/tests/views/run.js` :

```js
// Passation : la scène occupe l'écran, la route porte l'identifiant du test, quitter nettoie tout.
import { createStage } from '../stage.js';
import { testById, runsOfAny } from '../catalog/index.js';
import { addRun } from '../ops.js';

export function render(root, ctx) {
  const test = testById(ctx.route?.id);
  if (!test) {
    root.innerHTML = '<p class="empty">Test inconnu.</p><button type="button" class="btn-text" data-back>‹ Tests</button>';
    root.onclick = () => ctx.navigate({ tab: 'tests' });
    return;
  }
  const back = () => ctx.navigate({ tab: 'tests' });
  const stage = createStage(root, { onQuit: back });
  ctx.onLeave(() => stage.clearAll());
  const runs = runsOfAny(ctx.stores.tests.doc, test);
  const lastRun = runs.length ? runs[runs.length - 1] : null;
  test.run(stage, metrics => {
    // notify:false : la notification rerendrait cette vue avant que le changement de route soit traité.
    addRun(ctx.stores.tests, test.id, metrics, ctx.today(), { notify: false });
    back();
  }, { lastRun });
}
```

- [ ] **Step 5 : app.js et styles**

Dans `js/app.js` :

1. Après `import * as challengeHome from './modules/challenge/views/home.js';`, ajouter :

```js
import * as testsHome from './modules/tests/views/home.js';
import * as testsRun from './modules/tests/views/run.js';
```

2. Dans `MODULES`, après la ligne `challenge:`, ajouter :

```js
  tests: { label: 'Tests', stores: ['tests'], views: { home: testsHome.render, run: testsRun.render } },
```

3. Remplacer la ligne `let route = null;` par :

```js
  let route = null;
  let leave = null; // nettoyage de la vue courante, appelé une fois au prochain changement de route
```

4. Dans la définition de `ctx`, ajouter la propriété `onLeave: fn => { leave = fn; },` juste avant `get route()`.

5. Dans le handler `onRoute`, remplacer :

```js
    flushDeferred();
    route = r;
```

par :

```js
    flushDeferred();
    leave?.();
    leave = null;
    route = r;
```

Ajouter à la fin de `style.css` :

```css
/* Tests : cartes et scène de passation */
.chart { margin-top: 12px; border-top: 1px solid var(--line); padding-top: 10px; }
.chart-hd { display: flex; justify-content: space-between; margin-bottom: 2px; }
.chart-ft { display: flex; justify-content: space-between; margin-top: 3px; }
.stage { position: fixed; inset: 0; z-index: 30; background: var(--bg); display: flex; flex-direction: column;
  padding: calc(env(safe-area-inset-top) + 14px) var(--pad) calc(env(safe-area-inset-bottom) + 14px); }
.stage-top { display: flex; justify-content: space-between; align-items: center; gap: 10px; font-size: 0.8rem; color: var(--muted); min-height: 32px; }
.stage-quit { width: auto; padding: 6px 12px; font-size: 0.8rem; }
.stage-mid { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; gap: 14px; }
.stage-title { font-size: 1.1rem; font-weight: 600; }
.stage-body { font-size: 0.92rem; color: var(--muted); line-height: 1.6; max-width: 340px; }
.stage-btn { max-width: 300px; }
.counter { font-size: 3rem; letter-spacing: -0.02em; color: var(--c-drive); }
.stim { width: 120px; height: 120px; border-radius: 50%; border: 2px solid var(--line); display: flex; align-items: center; justify-content: center; }
.stim.on { border-color: var(--c-drive); background: color-mix(in srgb, var(--c-drive) 12%, transparent); }
.flash { font-size: 0.95rem; color: var(--c-drive); min-height: 22px; }
.qtext { font-size: 1rem; line-height: 1.45; max-width: 340px; }
.qopts { display: flex; flex-direction: column; gap: 8px; width: 100%; max-width: 320px; }
.qopts button { background: var(--card); border: 1px solid var(--line); color: var(--fg); border-radius: 12px; padding: 14px 16px; text-align: left; }
.res { font-size: 0.92rem; color: var(--muted); line-height: 1.7; text-align: left; max-width: 340px; }
.res b { color: var(--fg); font-weight: 500; }
.warn { font-size: 0.85rem; color: var(--c-drive); line-height: 1.5; max-width: 340px; }
```

- [ ] **Step 6 : lancer, succès**

Run: `node --check js/app.js && npm test`
Expected: PASS.

- [ ] **Step 7 : commit**

```bash
git add js/modules/tests js/app.js style.css tests/tests/stage.test.mjs tests/views/smoke.test.mjs
git commit -m "Ajoute l'onglet Tests : scène de passation, cartes, courbes, historique

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 8 : service worker, version, README

**Files:**
- Modify: `sw.js`, `js/version.js`, `README.md`

- [ ] **Step 1 : assets et version**

Dans `sw.js`, après la ligne `'./js/modules/tests/schema.js',`, ajouter :

```js
  './js/modules/challenge/schema.js', './js/modules/challenge/queries.js', './js/modules/challenge/ops.js', './js/modules/challenge/views/home.js',
  './js/modules/tests/queries.js', './js/modules/tests/ops.js', './js/modules/tests/stage.js',
  './js/modules/tests/catalog/index.js', './js/modules/tests/catalog/pvt.js', './js/modules/tests/catalog/phq8.js',
  './js/modules/tests/views/home.js', './js/modules/tests/views/run.js',
```

Dans `js/version.js`, passer `APP_VERSION` à `'1.1.0'`.

- [ ] **Step 2 : vérifier la liste**

Run:

```bash
node --input-type=module -e "
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
const sw = readFileSync('sw.js','utf8');
const assets = [...sw.matchAll(/'(\.\/[^']+)'/g)].map(m => m[1]).filter(a => a !== './');
const walk = d => readdirSync(d).flatMap(f => { const p = d + '/' + f; return statSync(p).isDirectory() ? walk(p) : [p]; });
const served = walk('./js').filter(p => p.endsWith('.js'));
const missing = assets.filter(a => !existsSync(a)), unlisted = served.filter(p => !assets.includes(p));
console.log('manquants', missing, 'non listés', unlisted); if (missing.length || unlisted.length) process.exit(1);
"
```

Expected: `manquants [] non listés []`.

- [ ] **Step 3 : README**

Dans `README.md`, remplacer la première phrase du paragraphe d'introduction par :

```
Suivi (sommeil et état du jour), Pulsion (protocole et actes), Challenge (une activité à l'essai sur 14, 30 ou 60 jours), Tests (PVT-B et PHQ-8), et bientôt Mind et Rappel.
```

- [ ] **Step 4 : suite et commit**

Run: `npm test`
Expected: PASS.

```bash
git add sw.js js/version.js README.md
git commit -m "Passe en 1.1.0 : Challenge et Tests servis hors ligne

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

Puis, par Noah : `git push`, et sur le téléphone vérifier que la nouvelle version se charge (Réglages affiche « Moi 1.1.0 »), lancer un PVT-B et le quitter en cours par le bouton retour (rien ne doit s'enregistrer), lancer un PHQ-8 jusqu'à Enregistrer, créer un challenge et cocher aujourd'hui.
