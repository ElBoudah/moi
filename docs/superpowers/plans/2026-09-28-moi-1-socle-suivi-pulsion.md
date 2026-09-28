# Moi — plan 1 : socle, Suivi, Pulsion, Réglages, backup, reprise des données

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Une PWA « Moi » déployable sur GitHub Pages, avec la coquille commune (stores, routeur, barre d'onglets, thème, backup, service worker), les onglets Suivi et Pulsion complets, l'écran Réglages, et la reprise en place des données de l'ancienne app Suivi.

**Architecture:** Un store générique (document JSON validé, migrations, abonnement) instancié une fois par module sous une clé `moi.<module>`. Des lectures pures par module. Une vue = `render(root, ctx)` rerendue à chaque notification du store concerné. Routage par fragment `#/<onglet>/<vue>/<id>`. Backup en trois couches (export par module, bundle global chiffré vers Gist, fichier quotidien).

**Tech Stack:** HTML, CSS, modules JavaScript natifs (ES2022), `node --test` (Node 24, zéro dépendance npm), service worker en module, manifest PWA.

**Spec:** `docs/superpowers/specs/2026-09-28-moi-fusion-design.md`

Les plans suivants ajoutent Challenge et Tests (plan 2), Mind (plan 3), Rappel (plan 4). Ce plan crée déjà le schéma du module Tests (sans écran) parce que la reprise des données écrit `moi.tests`.

## Global Constraints

- Aucune dépendance npm, aucune étape de build. `package.json` sert au seul script `npm test`.
- Tout chemin dans le HTML, le manifest et le service worker est relatif (`./x`), jamais absolu : le site vit sous `https://elboudah.github.io/moi/`.
- Identifiants et noms de fonctions en anglais, textes d'interface et messages en français.
- Aucune notification, aucun compteur de jours, aucune série, aucun compteur de retard. Aucun rouge hors des trois natures de Pulsion.
- Clés de stockage : `moi.settings`, `moi.suivi`, `moi.pulsion`, `moi.tests` (plus tard `moi.challenge`, `moi.mind`, `moi.rappel`). Config cloud dans les clés existantes `cloud_token`, `cloud_pass`, `cloud_gist`. Marques : `moi.lastLocalBackup`, `moi.lastCloudBackup`.
- Curseurs : entiers 0..10 ou null. Heures : chaîne `HH:MM` ou null. Jours : clés `AAAA-MM-JJ` en heure locale. Horodatages : ISO.
- Version de schéma courante de chaque module : 1. `APP_VERSION` dans `js/version.js` seul endroit à incrémenter.
- Les tests se lancent avec `npm test` et passent tous avant chaque commit.
- Commits en français, terminés par `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`. Identité git locale du dépôt déjà réglée (ElBoudah, adresse noreply) : ne jamais toucher `git config --global`.

## Review Focus

1. Un curseur glissé puis l'app mise en arrière-plan avant 350 ms : la valeur doit être persistée (flush sur `visibilitychange` et `pagehide`). Test dans la tâche 6 (ops : `flushPending`).
2. Un acte enregistré avec un jour dans le futur ou une clé mal formée doit être refusé sans rien écrire. Test dans la tâche 8.
3. Une ancienne `suivi_v1` avec des jours vides, des valeurs hors plage, des événements sans nature ou de type `resistee` : la reprise doit ignorer ces éléments sans échouer. Test dans la tâche 9.
4. Un bundle cloud dont un seul module est invalide ne doit remplacer aucun store. Test dans la tâche 11.
5. Une mauvaise passphrase à la restauration doit produire une erreur lisible, pas une exception brute. Test dans la tâche 11.

## Structure des fichiers

```
index.html  style.css  manifest.webmanifest  sw.js  icons/  README.md  package.json  .gitignore
js/version.js                 APP_VERSION
js/app.js                     point d'entrée
js/router.js                  parseRoute / routeHash / navigate / onRoute / TABS
js/core/dates.js              clés de jour, formats fr, durées
js/core/stats.js              mean, sd, masd, median, fmt, pm, pack
js/core/store.js              Store générique + migrate
js/core/chart.js              sparkline SVG
js/core/backup.js             exports, bundle, chiffrement, Gist, fichier quotidien
js/core/migrate-legacy.js     reprise de suivi_v1 / suivi_tests_v1
js/core/ui.js                 escapeHtml, sheets, notice, downloadText, longPress, slider/chips/dayNav
js/modules/settings/schema.js
js/modules/settings/views/home.js
js/modules/rappel/presets.js  PRESETS des fournisseurs LLM (données seules, utilisées par Réglages)
js/modules/suivi/schema.js  queries.js  ops.js  views/day.js  views/data.js
js/modules/pulsion/schema.js  queries.js  ops.js  views/home.js
js/modules/tests/schema.js
tests/fixtures/helpers.mjs    memoryStorage, fakeNow, fakeId
tests/core/*.test.mjs  tests/suivi/*.test.mjs  tests/pulsion/*.test.mjs  tests/settings/*.test.mjs
tools/make-icons.mjs
```

---

### Task 1 : squelette, dates

**Files:**
- Create: `package.json`, `js/core/dates.js`, `tests/fixtures/helpers.mjs`, `tests/core/dates.test.mjs`

**Interfaces:**
- Produces: `keyOf(Date)`, `today(now?)`, `parseKey(k)`, `addDays(k, n)`, `diffDays(from, to)`, `isDayKey(k)`, `frLong(k)`, `frShort(k)`, `hhmm(iso)`, `formatDate(iso)`, `daysBetween(isoA, isoB)`, `relativeDays(iso, nowIso?)`, `toMin('HH:MM')`, `hm(mins)`, `isTime(v)`. Fixtures : `memoryStorage(initial)`, `fakeNow()`, `fakeId()`, `resetFakes()`.

- [ ] **Step 1 : package.json et fixtures**

```json
{
  "name": "moi",
  "private": true,
  "type": "module",
  "scripts": { "test": "node --test 'tests/**/*.test.mjs'" }
}
```

`tests/fixtures/helpers.mjs` :

```js
export function memoryStorage(initial = {}) {
  const m = new Map(Object.entries(initial));
  return {
    getItem: k => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: k => m.delete(k),
    _map: m,
  };
}

let tick = 0;
let idc = 0;
export function resetFakes() { tick = 0; idc = 0; }
export function fakeNow() { tick += 1; return `2026-09-20T10:${String(tick).padStart(2, '0')}:00.000Z`; }
export function fakeId() { idc += 1; return `id${idc}`; }
```

- [ ] **Step 2 : test des dates**

`tests/core/dates.test.mjs` :

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { keyOf, today, addDays, diffDays, isDayKey, toMin, hm, relativeDays, daysBetween, frShort, hhmm, isTime } from '../../js/core/dates.js';

test('keyOf et today produisent AAAA-MM-JJ en heure locale', () => {
  assert.equal(keyOf(new Date(2026, 8, 5)), '2026-09-05');
  assert.equal(today(new Date(2026, 0, 1)), '2026-01-01');
});

test('addDays et diffDays traversent les mois', () => {
  assert.equal(addDays('2026-09-30', 1), '2026-10-01');
  assert.equal(addDays('2026-03-01', -1), '2026-02-28');
  assert.equal(diffDays('2026-09-01', '2026-09-08'), 7);
  assert.equal(diffDays('2026-09-08', '2026-09-01'), -7);
});

test('isDayKey refuse les formes et dates invalides', () => {
  assert.equal(isDayKey('2026-09-05'), true);
  assert.equal(isDayKey('2026-02-30'), false);
  assert.equal(isDayKey('26-09-05'), false);
  assert.equal(isDayKey(null), false);
});

test('toMin, isTime et hm', () => {
  assert.equal(toMin('23:15'), 1395);
  assert.equal(toMin('7:05'), 425);
  assert.equal(toMin('x'), null);
  assert.equal(toMin(null), null);
  assert.equal(isTime('07:05'), true);
  assert.equal(isTime('7h05'), false);
  assert.equal(hm(450), '7 h 30');
  assert.equal(hm(59.7), '1 h 00');
  assert.equal(hm(null), '—');
});

test('daysBetween et relativeDays', () => {
  const now = '2026-09-20T23:00:00.000Z';
  assert.equal(daysBetween('2026-09-17T10:00:00.000Z', now), 3);
  assert.equal(relativeDays('2026-09-20T01:00:00.000Z', now), "aujourd'hui");
  assert.equal(relativeDays('2026-09-19T10:00:00.000Z', now), 'hier');
  assert.equal(relativeDays('2026-09-12T10:00:00.000Z', now), 'il y a 8 j');
});

test('formats français', () => {
  assert.equal(frShort('2026-09-05'), '05/09');
  assert.match(hhmm('2026-09-05T08:07:00'), /^\d{2}:\d{2}$/);
});
```

- [ ] **Step 3 : lancer, vérifier l'échec**

Run: `npm test`
Expected: FAIL, module `js/core/dates.js` introuvable.

- [ ] **Step 4 : implémentation**

`js/core/dates.js` :

```js
// Dates : clés de jour "AAAA-MM-JJ" en heure locale, horodatages ISO.

export function keyOf(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function today(now = new Date()) { return keyOf(now); }

export function parseKey(k) {
  const [y, m, d] = k.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(k, n) {
  const dt = parseKey(k);
  dt.setDate(dt.getDate() + n);
  return keyOf(dt);
}

export function diffDays(from, to) {
  return Math.round((parseKey(to) - parseKey(from)) / 864e5);
}

export function isDayKey(k) {
  return typeof k === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(k) && keyOf(parseKey(k)) === k;
}

export function frLong(k) {
  return parseKey(k).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
}

export function frShort(k) {
  return parseKey(k).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
}

export function hhmm(iso) {
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

const dateFmt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' });
export function formatDate(iso) { return dateFmt.format(new Date(iso)); }

export function daysBetween(isoA, isoB) {
  const day = 86_400_000;
  return Math.floor(new Date(isoB).getTime() / day) - Math.floor(new Date(isoA).getTime() / day);
}

export function relativeDays(iso, nowIso = new Date().toISOString()) {
  const d = daysBetween(iso, nowIso);
  if (d <= 0) return "aujourd'hui";
  if (d === 1) return 'hier';
  return `il y a ${d} j`;
}

export function toMin(t) {
  if (typeof t !== 'string') return null;
  const m = t.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]), mi = Number(m[2]);
  if (h > 23 || mi > 59) return null;
  return h * 60 + mi;
}

export function isTime(v) { return typeof v === 'string' && /^\d{2}:\d{2}$/.test(v) && toMin(v) !== null; }

export function hm(mins) {
  if (mins === null || mins === undefined) return '—';
  const r = Math.round(mins);
  return `${Math.floor(r / 60)} h ${String(r % 60).padStart(2, '0')}`;
}
```

- [ ] **Step 5 : lancer, vérifier le succès**

Run: `npm test`
Expected: 6 tests PASS.

- [ ] **Step 6 : commit**

```bash
git add package.json js/core/dates.js tests/
git commit -m "Ajoute le squelette de test et les helpers de dates

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2 : statistiques

**Files:**
- Create: `js/core/stats.js`, `tests/core/stats.test.mjs`

**Interfaces:**
- Produces: `mean(a)`, `sd(a)`, `masd(serie)`, `median(a)`, `fmt(v)`, `pm(m, d, unit)`, `pack(serie) -> { m, sd, v, n }`.

- [ ] **Step 1 : test**

`tests/core/stats.test.mjs` :

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mean, sd, masd, median, fmt, pm, pack } from '../../js/core/stats.js';

test('mean, sd, median sur listes vides ou courtes', () => {
  assert.equal(mean([]), null);
  assert.equal(mean([2, 4]), 3);
  assert.equal(sd([5]), null);
  assert.equal(Math.round(sd([2, 4, 4, 4, 5, 5, 7, 9]) * 1000) / 1000, 2.138);
  assert.equal(median([]), null);
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([4, 1, 3, 2]), 3); // arrondi de 2,5
});

test('masd mesure la variation entre jours consécutifs, trous exclus', () => {
  assert.equal(masd([9, 2, 8, 1]), 7);
  assert.equal(masd([1, 2, 8, 9]), 8 / 3);
  assert.equal(masd([1, null, 3]), null);
  assert.equal(masd([1, 3, null, 7]), 2);
});

test('fmt et pm formatent avec une virgule', () => {
  assert.equal(fmt(null), '—');
  assert.equal(fmt(6.26), '6,3');
  assert.equal(pm(6.26, 1.04, '/10'), '6,3 ± 1/10');
  assert.equal(pm(6, null), '6');
  assert.equal(pm(null, 1), '—');
});

test('pack agrège une série avec trous', () => {
  const p = pack([4, null, 6]);
  assert.equal(p.m, 5);
  assert.equal(p.n, 2);
  assert.equal(p.v, null);
  assert.equal(Math.round(p.sd * 100) / 100, 1.41);
});
```

- [ ] **Step 2 : lancer, échec attendu**

Run: `npm test`
Expected: FAIL, `js/core/stats.js` introuvable.

- [ ] **Step 3 : implémentation**

`js/core/stats.js` :

```js
// Statistiques descriptives sur des séries avec trous (null).

export const mean = a => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);

export function sd(a) {
  if (a.length < 2) return null;
  const m = mean(a);
  return Math.sqrt(a.reduce((s, v) => s + (v - m) * (v - m), 0) / (a.length - 1));
}

// Variation jour à jour : moyenne des écarts absolus entre deux jours CONSÉCUTIFS renseignés.
// 9-2-8-1 et 1-2-8-9 ont le même écart-type, pas la même variation.
export function masd(serie) {
  let s = 0, n = 0;
  for (let i = 1; i < serie.length; i++) {
    if (serie[i] !== null && serie[i - 1] !== null) { s += Math.abs(serie[i] - serie[i - 1]); n++; }
  }
  return n ? s / n : null;
}

export function median(a) {
  if (!a.length) return null;
  const s = [...a].sort((x, y) => x - y), n = s.length;
  return n % 2 ? s[(n - 1) / 2] : Math.round((s[n / 2 - 1] + s[n / 2]) / 2);
}

export const fmt = v => (v == null ? '—' : (Math.round(v * 10) / 10).toString().replace('.', ','));

export const pm = (m, d, unit = '') => (m == null ? '—' : fmt(m) + (d == null ? '' : ' ± ' + fmt(d)) + unit);

export function pack(serie) {
  const val = serie.filter(v => v !== null);
  return { m: mean(val), sd: sd(val), v: masd(serie), n: val.length };
}
```

- [ ] **Step 4 : lancer, succès**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5 : commit**

```bash
git add js/core/stats.js tests/core/stats.test.mjs
git commit -m "Ajoute les statistiques descriptives sur séries à trous

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3 : store générique

**Files:**
- Create: `js/core/store.js`, `tests/core/store.test.mjs`

**Interfaces:**
- Consumes: rien.
- Produces: `class Store(storage, schema, { now, makeId })` avec `load()`, `doc`, `key`, `corrupt`, `corruptKey`, `clearCorrupt()`, `subscribe(fn) -> off`, `commit(mutator, { notify }) -> result`, `exportJson()`, `replace(rawDoc)`, `importJson(text)`, `saveError`, `onSaveError`, `now()`, `makeId()`. `migrate(doc, schema)`. Un **schéma** est `{ key, version, empty(now, makeId), validate(raw) -> { ok: true, doc } | { ok: false, error }, migrations: { [n]: doc => doc } }`.

- [ ] **Step 1 : test**

`tests/core/store.test.mjs` :

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Store, migrate } from '../../js/core/store.js';
import { memoryStorage, fakeNow, fakeId, resetFakes } from '../fixtures/helpers.mjs';

// Schéma jouet : { version, n } ; v1 → v2 ajoute "extra".
const schema = {
  key: 'test.doc',
  version: 2,
  empty: () => ({ version: 2, n: 0, extra: 0 }),
  validate(raw) {
    if (!raw || typeof raw !== 'object') return { ok: false, error: 'Document invalide.' };
    if (![1, 2].includes(raw.version)) return { ok: false, error: `Version inconnue (${raw.version}).` };
    if (!Number.isInteger(raw.n)) return { ok: false, error: 'n manquant.' };
    return { ok: true, doc: raw };
  },
  migrations: { 1: d => ({ ...d, version: 2, extra: 0 }) },
};

function newStore(initial) {
  resetFakes();
  const storage = memoryStorage(initial);
  const store = new Store(storage, schema, { now: fakeNow, makeId: fakeId });
  store.load();
  return { store, storage };
}

test('migrate applique les étapes séquentielles et refuse un trou', () => {
  assert.deepEqual(migrate({ version: 1, n: 3 }, schema), { version: 2, n: 3, extra: 0 });
  assert.deepEqual(migrate({ version: 2, n: 3, extra: 1 }, schema), { version: 2, n: 3, extra: 1 });
  assert.throws(() => migrate({ version: 0, n: 1 }, { ...schema, migrations: {} }), /manquante/);
});

test('load sans données crée le document vide et le sauvegarde', () => {
  const { store, storage } = newStore();
  assert.deepEqual(store.doc, { version: 2, n: 0, extra: 0 });
  assert.equal(JSON.parse(storage.getItem('test.doc')).n, 0);
});

test('load migre un document ancien et le réécrit', () => {
  const { store, storage } = newStore({ 'test.doc': JSON.stringify({ version: 1, n: 5 }) });
  assert.equal(store.doc.extra, 0);
  assert.equal(JSON.parse(storage.getItem('test.doc')).version, 2);
});

test('load met un document illisible de côté et repart à vide', () => {
  const { store, storage } = newStore({ 'test.doc': '{pas du json' });
  assert.equal(store.doc.n, 0);
  assert.equal(store.corrupt, '{pas du json');
  assert.equal(storage.getItem('test.doc.corrupt'), '{pas du json');
  const again = new Store(storage, schema); again.load();
  assert.equal(again.corrupt, '{pas du json');
  again.clearCorrupt();
  assert.equal(again.corrupt, null);
  assert.equal(storage.getItem('test.doc.corrupt'), null);
});

test('commit sauvegarde, notifie, et notify:false reste silencieux', () => {
  const { store, storage } = newStore();
  let calls = 0;
  const off = store.subscribe(() => { calls += 1; });
  const r = store.commit(d => { d.n = 7; return 'ok'; });
  assert.equal(r, 'ok');
  assert.equal(calls, 1);
  assert.equal(JSON.parse(storage.getItem('test.doc')).n, 7);
  store.commit(d => { d.n = 8; }, { notify: false });
  assert.equal(calls, 1);
  off();
  store.commit(d => { d.n = 9; });
  assert.equal(calls, 1);
});

test('un échec de sauvegarde est signalé sans casser la notification', () => {
  const { store, storage } = newStore();
  storage.setItem = () => { throw new Error('QuotaExceededError'); };
  let notified = 0, reported = null;
  store.subscribe(() => { notified += 1; });
  store.onSaveError = m => { reported = m; };
  store.commit(d => { d.n = 1; });
  assert.equal(notified, 1);
  assert.match(reported, /stockage/i);
  assert.match(store.saveError, /stockage/i);
});

test('importJson et replace valident, migrent, remplacent ; sinon ne touchent rien', () => {
  const { store } = newStore();
  let notified = 0;
  store.subscribe(() => { notified += 1; });
  assert.throws(() => store.importJson('{pas du json'), /JSON/);
  assert.throws(() => store.importJson(JSON.stringify({ version: 2 })), /n manquant/);
  assert.equal(notified, 0);
  store.importJson(JSON.stringify({ version: 1, n: 4 }));
  assert.deepEqual(store.doc, { version: 2, n: 4, extra: 0 });
  assert.equal(notified, 1);
  assert.ok(store.exportJson().includes('\n  '));
});
```

- [ ] **Step 2 : lancer, échec attendu**

Run: `npm test`
Expected: FAIL, `js/core/store.js` introuvable.

- [ ] **Step 3 : implémentation**

`js/core/store.js` :

```js
// Store générique : un document JSON validé, persisté à chaque opération.
// Un schéma décrit la clé, la version courante, le document vide, la validation et les migrations.

const defaultNow = () => new Date().toISOString();
const defaultId = () => crypto.randomUUID();

export function migrate(doc, schema) {
  let cur = doc;
  while (cur.version < schema.version) {
    const step = schema.migrations[cur.version];
    if (!step) throw new Error(`Migration ${cur.version} → ${cur.version + 1} manquante.`);
    cur = step(cur);
  }
  return cur;
}

export class Store {
  constructor(storage, schema, { now = defaultNow, makeId = defaultId } = {}) {
    this.storage = storage;
    this.schema = schema;
    this.now = now;
    this.makeId = makeId;
    this._doc = null;
    this.corrupt = null;
    this.saveError = null;
    this.onSaveError = null;
    this._subs = new Set();
  }

  get key() { return this.schema.key; }
  get corruptKey() { return `${this.schema.key}.corrupt`; }
  get doc() { return this._doc; }

  load() {
    this.corrupt = this.storage.getItem(this.corruptKey) ?? null;
    const raw = this.storage.getItem(this.key);
    if (raw === null) {
      this._doc = this.schema.empty(this.now, this.makeId);
      this._save();
      return;
    }
    let parsed;
    try { parsed = JSON.parse(raw); } catch { parsed = undefined; }
    const v = this.schema.validate(parsed);
    if (!v.ok) {
      this.corrupt = raw;
      try { this.storage.setItem(this.corruptKey, raw); } catch { /* stockage indisponible */ }
      this._doc = this.schema.empty(this.now, this.makeId);
      this._save();
      return;
    }
    const before = v.doc.version;
    this._doc = migrate(v.doc, this.schema);
    if (this._doc.version !== before) this._save();
  }

  clearCorrupt() {
    this.commit(() => {
      this.storage.removeItem?.(this.corruptKey);
      this.corrupt = null;
    });
  }

  subscribe(fn) {
    this._subs.add(fn);
    return () => this._subs.delete(fn);
  }

  _save() {
    try {
      this.storage.setItem(this.key, JSON.stringify(this._doc));
      this.saveError = null;
    } catch {
      this.saveError = "Impossible d'enregistrer : stockage plein ou indisponible. Exportez vos données.";
      this.onSaveError?.(this.saveError);
    }
  }

  commit(mutator, { notify = true } = {}) {
    const result = mutator(this._doc);
    this._save();
    if (notify) for (const fn of this._subs) fn(this._doc);
    return result;
  }

  exportJson() { return JSON.stringify(this._doc, null, 2); }

  replace(rawDoc) {
    const v = this.schema.validate(rawDoc);
    if (!v.ok) throw new Error(v.error);
    const doc = migrate(v.doc, this.schema);
    this.commit(() => { this._doc = doc; });
  }

  importJson(text) {
    let parsed;
    try { parsed = JSON.parse(text); } catch { throw new Error("Le fichier n'est pas du JSON valide."); }
    this.replace(parsed);
  }
}
```

- [ ] **Step 4 : lancer, succès**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5 : commit**

```bash
git add js/core/store.js tests/core/store.test.mjs
git commit -m "Ajoute le store générique : validation, migrations, persistance, abonnement

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4 : schémas settings et tests, presets LLM

**Files:**
- Create: `js/modules/rappel/presets.js`, `js/modules/settings/schema.js`, `js/modules/tests/schema.js`, `tests/settings/schema.test.mjs`, `tests/core/tests-schema.test.mjs`

**Interfaces:**
- Consumes: `isDayKey` (tâche 1).
- Produces: `PRESETS` (gemini, mistral, groq, anthropic, custom : `{ label, baseUrl, defaultModel, keyUrl }`) ; `settingsSchema` (clé `moi.settings`, doc `{ version: 1, theme, lastTab, llm: { provider, apiKey, model, baseUrl } }`), `THEMES` ; `testsSchema` (clé `moi.tests`, doc `{ version: 1, runs: [{ id, ts, day, test, metrics }] }`).

- [ ] **Step 1 : tests**

`tests/settings/schema.test.mjs` :

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { settingsSchema, THEMES } from '../../js/modules/settings/schema.js';
import { PRESETS } from '../../js/modules/rappel/presets.js';

test('le document vide est valide et sur le preset Gemini', () => {
  const doc = settingsSchema.empty();
  assert.equal(settingsSchema.validate(doc).ok, true);
  assert.equal(doc.theme, 'system');
  assert.equal(doc.lastTab, 'suivi');
  assert.equal(doc.llm.provider, 'gemini');
  assert.equal(doc.llm.model, PRESETS.gemini.defaultModel);
  assert.equal(doc.llm.apiKey, '');
  assert.deepEqual(THEMES, ['system', 'light', 'dark']);
});

test('validate refuse thème, fournisseur ou champs mal formés', () => {
  const ok = settingsSchema.empty();
  assert.equal(settingsSchema.validate({ ...ok, theme: 'sepia' }).ok, false);
  assert.equal(settingsSchema.validate({ ...ok, llm: { ...ok.llm, provider: 'openai' } }).ok, false);
  assert.equal(settingsSchema.validate({ ...ok, llm: { ...ok.llm, apiKey: 12 } }).ok, false);
  assert.equal(settingsSchema.validate({ ...ok, lastTab: null }).ok, false);
  assert.equal(settingsSchema.validate({ ...ok, version: 2 }).ok, false);
  assert.equal(settingsSchema.validate(null).ok, false);
});
```

`tests/core/tests-schema.test.mjs` :

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { testsSchema } from '../../js/modules/tests/schema.js';

test('le document vide de tests est valide', () => {
  assert.deepEqual(testsSchema.empty(), { version: 1, runs: [] });
  assert.equal(testsSchema.validate(testsSchema.empty()).ok, true);
});

test('validate accepte les runs historiques (id numérique) et refuse les runs mal formés', () => {
  const run = { id: 1726000000000, ts: '2026-09-10T20:00:00.000Z', day: '2026-09-10', test: 'pvt', metrics: { median: 250 } };
  assert.equal(testsSchema.validate({ version: 1, runs: [run] }).ok, true);
  assert.equal(testsSchema.validate({ version: 1, runs: [{ ...run, day: '2026-13-01' }] }).ok, false);
  assert.equal(testsSchema.validate({ version: 1, runs: [{ ...run, metrics: null }] }).ok, false);
  assert.equal(testsSchema.validate({ version: 1, runs: [{ ...run, test: 3 }] }).ok, false);
  assert.equal(testsSchema.validate({ version: 1, runs: null }).ok, false);
});
```

- [ ] **Step 2 : lancer, échec attendu**

Run: `npm test`
Expected: FAIL, modules introuvables.

- [ ] **Step 3 : implémentation**

`js/modules/rappel/presets.js` :

```js
// Fournisseurs LLM : Gemini, Mistral, Groq et « autre » passent par un endpoint OpenAI-compatible,
// Anthropic a son propre format. Données seules ; la couche réseau vit dans llm.js (plan 4).
export const PRESETS = {
  gemini: { label: 'Gemini (Google)', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', defaultModel: 'gemini-3.5-flash', keyUrl: 'https://aistudio.google.com/app/apikey' },
  mistral: { label: 'Mistral', baseUrl: 'https://api.mistral.ai/v1', defaultModel: 'mistral-small-latest', keyUrl: 'https://console.mistral.ai/' },
  groq: { label: 'Groq', baseUrl: 'https://api.groq.com/openai/v1', defaultModel: 'llama-3.3-70b-versatile', keyUrl: 'https://console.groq.com/keys' },
  anthropic: { label: 'Anthropic (Claude)', baseUrl: 'https://api.anthropic.com/v1', defaultModel: 'claude-haiku-4-5', keyUrl: 'https://console.anthropic.com/' },
  custom: { label: 'Autre (OpenAI-compatible)', baseUrl: '', defaultModel: '', keyUrl: '' },
};
```

`js/modules/settings/schema.js` :

```js
import { PRESETS } from '../rappel/presets.js';

export const THEMES = ['system', 'light', 'dark'];
const isStr = v => typeof v === 'string';

export const settingsSchema = {
  key: 'moi.settings',
  version: 1,
  empty: () => ({
    version: 1,
    theme: 'system',
    lastTab: 'suivi',
    llm: { provider: 'gemini', apiKey: '', model: PRESETS.gemini.defaultModel, baseUrl: '' },
  }),
  validate(raw) {
    const fail = error => ({ ok: false, error });
    if (!raw || typeof raw !== 'object') return fail('Réglages invalides.');
    if (raw.version !== 1) return fail(`Version de réglages inconnue (${raw.version}).`);
    if (!THEMES.includes(raw.theme)) return fail('Thème inconnu.');
    if (!isStr(raw.lastTab)) return fail('Onglet mémorisé invalide.');
    const l = raw.llm;
    if (!l || typeof l !== 'object') return fail('Réglages LLM manquants.');
    if (!PRESETS[l.provider]) return fail('Fournisseur LLM inconnu.');
    if (![l.apiKey, l.model, l.baseUrl].every(isStr)) return fail('Réglages LLM mal formés.');
    return { ok: true, doc: raw };
  },
  migrations: {},
};
```

`js/modules/tests/schema.js` :

```js
import { isDayKey } from '../../core/dates.js';

const isId = v => typeof v === 'string' || Number.isFinite(v);

export const testsSchema = {
  key: 'moi.tests',
  version: 1,
  empty: () => ({ version: 1, runs: [] }),
  validate(raw) {
    const fail = error => ({ ok: false, error });
    if (!raw || typeof raw !== 'object') return fail('Document de tests invalide.');
    if (raw.version !== 1) return fail(`Version de tests inconnue (${raw.version}).`);
    if (!Array.isArray(raw.runs)) return fail('Liste de runs manquante.');
    for (const r of raw.runs) {
      if (!r || typeof r !== 'object') return fail('Run mal formé.');
      if (!isId(r.id) || typeof r.ts !== 'string' || !isDayKey(r.day) || typeof r.test !== 'string'
        || !r.metrics || typeof r.metrics !== 'object') return fail(`Run mal formé (${r.id ?? '?'}).`);
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
git add js/modules tests/settings tests/core/tests-schema.test.mjs
git commit -m "Ajoute les schémas settings et tests, et les presets LLM

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5 : schéma Suivi

**Files:**
- Create: `js/modules/suivi/schema.js`, `tests/suivi/schema.test.mjs`

**Interfaces:**
- Consumes: `isDayKey`, `isTime` (tâche 1).
- Produces: `SLIDERS = ['clarity','mood','pleasure','drive']`, `LABELS`, `ANCHORS`, `suiviSchema` (clé `moi.suivi`, doc `{ version: 1, days: { [dayKey]: Day } }`), `emptyDay()`, `isEmptyDay(day)`, `isSliderValue(v)`.

- [ ] **Step 1 : test**

`tests/suivi/schema.test.mjs` :

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { suiviSchema, SLIDERS, ANCHORS, emptyDay, isEmptyDay, isSliderValue } from '../../js/modules/suivi/schema.js';

test('document vide, jour vide, ancres', () => {
  assert.deepEqual(suiviSchema.empty(), { version: 1, days: {} });
  assert.deepEqual(emptyDay(), { bed: null, wake: null, clarity: null, mood: null, pleasure: null, drive: null });
  assert.equal(isEmptyDay(emptyDay()), true);
  assert.equal(isEmptyDay({ ...emptyDay(), mood: 0 }), false);
  for (const f of SLIDERS) assert.equal(ANCHORS[f].length, 3);
});

test('isSliderValue accepte 0..10 entiers', () => {
  assert.equal(isSliderValue(0), true);
  assert.equal(isSliderValue(10), true);
  assert.equal(isSliderValue(11), false);
  assert.equal(isSliderValue(5.5), false);
  assert.equal(isSliderValue(null), false);
});

test('validate accepte un document correct et refuse les jours mal formés', () => {
  const ok = { version: 1, days: { '2026-09-20': { bed: '23:30', wake: '07:10', clarity: 6, mood: null, pleasure: 4, drive: 7 } } };
  assert.equal(suiviSchema.validate(ok).ok, true);
  const bad = (patch, key = '2026-09-20') => suiviSchema.validate({ version: 1, days: { [key]: { ...ok.days['2026-09-20'], ...patch } } });
  assert.match(bad({ clarity: 12 }).error, /clarity/);
  assert.match(bad({ bed: '25:00' }).error, /bed/);
  assert.match(bad({}, '2026-02-30').error, /jour/i);
  assert.equal(suiviSchema.validate({ version: 1, days: [] }).ok, false);
  assert.equal(suiviSchema.validate({ version: 1, days: { '2026-09-20': null } }).ok, false);
  assert.equal(suiviSchema.validate({ version: 3, days: {} }).ok, false);
});
```

- [ ] **Step 2 : lancer, échec attendu**

Run: `npm test`
Expected: FAIL.

- [ ] **Step 3 : implémentation**

`js/modules/suivi/schema.js` :

```js
import { isDayKey, isTime } from '../../core/dates.js';

export const SLIDERS = ['clarity', 'mood', 'pleasure', 'drive'];
export const LABELS = { clarity: 'Clarté', mood: 'Humeur', pleasure: 'Plaisir', drive: 'Motivation' };
// Trois ancres par curseur (0, 5, 10) : c'est ce qui empêche la valeur de dériver avec le temps.
export const ANCHORS = {
  clarity: ['brouillard, je relis trois fois', 'fonctionnel mais distractible', 'net, une tâche à la fois sans effort'],
  mood: ['au fond', 'neutre', 'léger, envie de rire'],
  pleasure: ['rien ne fait envie ni plaisir', 'quelques moments agréables', "plaisir franc dans ce que j'ai fait"],
  drive: ['rien ne démarre', 'je fais ce qu\'il faut', 'je démarre sans me pousser'],
};
const TIMES = ['bed', 'wake'];

export const isSliderValue = v => Number.isInteger(v) && v >= 0 && v <= 10;
export function emptyDay() { return { bed: null, wake: null, clarity: null, mood: null, pleasure: null, drive: null }; }
export function isEmptyDay(day) { return [...TIMES, ...SLIDERS].every(f => day[f] === null || day[f] === undefined); }

export const suiviSchema = {
  key: 'moi.suivi',
  version: 1,
  empty: () => ({ version: 1, days: {} }),
  validate(raw) {
    const fail = error => ({ ok: false, error });
    if (!raw || typeof raw !== 'object') return fail('Document Suivi invalide.');
    if (raw.version !== 1) return fail(`Version Suivi inconnue (${raw.version}).`);
    if (!raw.days || typeof raw.days !== 'object' || Array.isArray(raw.days)) return fail('Liste de jours manquante.');
    for (const [k, d] of Object.entries(raw.days)) {
      if (!isDayKey(k)) return fail(`Clé de jour invalide (${k}).`);
      if (!d || typeof d !== 'object') return fail(`Jour mal formé (${k}).`);
      for (const f of TIMES) if (!(d[f] === null || d[f] === undefined || isTime(d[f]))) return fail(`Heure ${f} invalide le ${k}.`);
      for (const f of SLIDERS) if (!(d[f] === null || d[f] === undefined || isSliderValue(d[f]))) return fail(`Valeur ${f} invalide le ${k}.`);
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
git add js/modules/suivi/schema.js tests/suivi/schema.test.mjs
git commit -m "Ajoute le schéma Suivi : jours, heures, quatre curseurs ancrés

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6 : lectures et opérations Suivi

**Files:**
- Create: `js/core/defer.js`, `js/modules/suivi/queries.js`, `js/modules/suivi/ops.js`, `tests/suivi/queries.test.mjs`, `tests/suivi/ops.test.mjs`

**Interfaces:**
- Consumes: `Store` (tâche 3), `suiviSchema`, `SLIDERS`, `LABELS`, `emptyDay`, `isEmptyDay`, `isSliderValue` (tâche 5), dates et stats.
- Produces: `durMin(day)`, `bedShift(bed)`, `windowKeys(todayKey, win)`, `stats(doc, win, todayKey) -> { keys, logged, nights, dur, bedSD, series, packs }`, `bilan(doc, todayKey) -> string`. Écriture différée commune : `deferWrite(key, fn, ms = 350)`, `flushDeferred()` (`js/core/defer.js`). Ops Suivi : `setDayField(store, dayKey, field, value)` (validation, notify false), `setDayFieldSoon(store, dayKey, field, value)` (différé 350 ms via `deferWrite`), `flushPending()` (alias de `flushDeferred`).

- [ ] **Step 1 : tests**

`tests/suivi/queries.test.mjs` :

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { durMin, bedShift, windowKeys, stats, bilan } from '../../js/modules/suivi/queries.js';

const doc = { version: 1, days: {
  '2026-09-18': { bed: '23:50', wake: '07:20', clarity: 6, mood: 5, pleasure: 4, drive: 6 },
  '2026-09-19': { bed: '00:10', wake: '07:00', clarity: 8, mood: 7, pleasure: null, drive: 4 },
  '2026-09-20': { bed: null, wake: null, clarity: 7, mood: null, pleasure: 6, drive: null },
} };

test('durMin gère le passage de minuit, bedShift recentre sur 18 h', () => {
  assert.equal(durMin({ bed: '23:50', wake: '07:20' }), 450);
  assert.equal(durMin({ bed: '00:10', wake: '07:00' }), 410);
  assert.equal(durMin({ bed: null, wake: '07:00' }), null);
  assert.equal(bedShift('23:50'), 350);
  assert.equal(bedShift('00:10'), 370);
  assert.equal(bedShift(null), null);
});

test('windowKeys liste les jours du plus ancien à aujourd\'hui', () => {
  assert.deepEqual(windowKeys('2026-09-20', 3), ['2026-09-18', '2026-09-19', '2026-09-20']);
});

test('stats sur 7 jours', () => {
  const s = stats(doc, 7, '2026-09-20');
  assert.equal(s.keys.length, 7);
  assert.equal(s.logged, 3);
  assert.equal(s.nights, 2);
  assert.equal(s.dur.m, 430);
  assert.equal(Math.round(s.bedSD), 14);
  assert.deepEqual(s.series.clarity, [null, null, null, null, 6, 8, 7]);
  assert.equal(s.packs.clarity.n, 3);
  assert.equal(s.packs.clarity.v, 1.5);
  assert.equal(s.packs.mood.n, 2);
  assert.equal(s.packs.mood.v, 2);
});

test('bilan est un texte de sept lignes en français', () => {
  const b = bilan(doc, '2026-09-20');
  const lines = b.split('\n');
  assert.equal(lines.length, 7);
  assert.match(lines[0], /^SUIVI 14\/09 → 20\/09$/);
  assert.equal(lines[1], 'Jours loggés : 3/7');
  assert.match(lines[2], /^Sommeil : 2 nuits · durée 7 h 10 ± 28 min · régularité du coucher ± 14 min$/);
  assert.match(lines[3], /^Clarté : 7 ± 1\/10 · variation j\/j 1,5$/);
  assert.match(lines[6], /^Motivation : 5 ± 1,4\/10 · variation j\/j 2$/);
});
```

`tests/suivi/ops.test.mjs` :

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Store } from '../../js/core/store.js';
import { suiviSchema } from '../../js/modules/suivi/schema.js';
import { setDayField, setDayFieldSoon, flushPending } from '../../js/modules/suivi/ops.js';
import { memoryStorage, fakeNow, fakeId, resetFakes } from '../fixtures/helpers.mjs';

function newStore() {
  resetFakes();
  const storage = memoryStorage();
  const store = new Store(storage, suiviSchema, { now: fakeNow, makeId: fakeId });
  store.load();
  return { store, storage };
}

test('setDayField crée le jour, valide, et supprime un jour redevenu vide', () => {
  const { store, storage } = newStore();
  let notified = 0;
  store.subscribe(() => { notified += 1; });
  setDayField(store, '2026-09-20', 'mood', 7);
  assert.equal(store.doc.days['2026-09-20'].mood, 7);
  assert.equal(store.doc.days['2026-09-20'].bed, null);
  assert.equal(JSON.parse(storage.getItem('moi.suivi')).days['2026-09-20'].mood, 7);
  assert.equal(notified, 0);
  setDayField(store, '2026-09-20', 'bed', '23:00');
  setDayField(store, '2026-09-20', 'bed', null);
  setDayField(store, '2026-09-20', 'mood', null);
  assert.equal(store.doc.days['2026-09-20'], undefined);
});

test('setDayField refuse champ, valeur ou jour invalides', () => {
  const { store } = newStore();
  assert.throws(() => setDayField(store, '2026-09-20', 'sleepQ', 3), /champ/i);
  assert.throws(() => setDayField(store, '2026-09-20', 'mood', 11), /valeur/i);
  assert.throws(() => setDayField(store, '2026-09-20', 'bed', '9h'), /heure/i);
  assert.throws(() => setDayField(store, '2026-13-01', 'mood', 1), /jour/i);
  assert.deepEqual(store.doc.days, {});
});

test('setDayFieldSoon diffère, flushPending persiste tout de suite', async () => {
  const { store, storage } = newStore();
  setDayFieldSoon(store, '2026-09-20', 'clarity', 4);
  assert.equal(storage.getItem('moi.suivi').includes('clarity'), false);
  flushPending();
  assert.equal(JSON.parse(storage.getItem('moi.suivi')).days['2026-09-20'].clarity, 4);
  setDayFieldSoon(store, '2026-09-20', 'clarity', 5);
  setDayFieldSoon(store, '2026-09-20', 'clarity', 6);
  await new Promise(r => setTimeout(r, 400));
  assert.equal(JSON.parse(storage.getItem('moi.suivi')).days['2026-09-20'].clarity, 6);
});
```

- [ ] **Step 2 : lancer, échec attendu**

Run: `npm test`
Expected: FAIL.

- [ ] **Step 3 : implémentation**

`js/modules/suivi/queries.js` :

```js
// Lectures pures sur le document Suivi. Aucune mutation, aucun DOM.
import { addDays, frShort, hm, toMin } from '../../core/dates.js';
import { pack, sd, pm, fmt } from '../../core/stats.js';
import { SLIDERS, LABELS } from './schema.js';

// Durée = (lever - coucher) modulo 24 h : gère le passage de minuit sans cas particulier.
export function durMin(day) {
  const b = toMin(day.bed), w = toMin(day.wake);
  if (b === null || w === null) return null;
  return (w - b + 1440) % 1440;
}

// Coucher recentré sur 18 h, sinon 23 h 50 et 00 h 10 seraient à 23 h d'écart au lieu de 20 min.
export function bedShift(bed) {
  const b = toMin(bed);
  return b === null ? null : (b - 1080 + 1440) % 1440;
}

export function windowKeys(todayKey, win) {
  const keys = [];
  for (let i = win - 1; i >= 0; i--) keys.push(addDays(todayKey, -i));
  return keys;
}

export function stats(doc, win, todayKey) {
  const keys = windowKeys(todayKey, win);
  const series = Object.fromEntries(SLIDERS.map(f => [f, []]));
  const dur = [], beds = [];
  let logged = 0, nights = 0;
  for (const k of keys) {
    const d = doc.days[k];
    if (!d) { SLIDERS.forEach(f => series[f].push(null)); dur.push(null); continue; }
    logged++;
    const du = durMin(d);
    if (du !== null) nights++;
    dur.push(du);
    const bs = bedShift(d.bed);
    if (bs !== null) beds.push(bs);
    SLIDERS.forEach(f => series[f].push(Number.isInteger(d[f]) ? d[f] : null));
  }
  return {
    keys, logged, nights,
    dur: pack(dur), bedSD: sd(beds),
    series, packs: Object.fromEntries(SLIDERS.map(f => [f, pack(series[f])])),
  };
}

export function bilan(doc, todayKey) {
  const s = stats(doc, 7, todayKey);
  const dur = s.dur.m == null ? '—' : hm(s.dur.m) + (s.dur.sd == null ? '' : ` ± ${Math.round(s.dur.sd)} min`);
  const reg = s.bedSD == null ? '—' : `± ${Math.round(s.bedSD)} min`;
  const lines = [
    `SUIVI ${frShort(addDays(todayKey, -6))} → ${frShort(todayKey)}`,
    `Jours loggés : ${s.logged}/7`,
    `Sommeil : ${s.nights} nuits · durée ${dur} · régularité du coucher ${reg}`,
  ];
  for (const f of SLIDERS) {
    const p = s.packs[f];
    lines.push(`${LABELS[f]} : ${pm(p.m, p.sd, '/10')} · variation j/j ${fmt(p.v)}`);
  }
  return lines.join('\n');
}
```

`js/modules/suivi/ops.js` :

```js
// Opérations sur le store Suivi. Les curseurs écrivent en différé : un re-rendu
// pendant un glissement détruirait l'élément manipulé et couperait le geste.
import { isDayKey, isTime } from '../../core/dates.js';
import { deferWrite, flushDeferred } from '../../core/defer.js';
import { SLIDERS, emptyDay, isEmptyDay, isSliderValue } from './schema.js';

const TIMES = ['bed', 'wake'];

export function setDayField(store, dayKey, field, value) {
  if (!isDayKey(dayKey)) throw new Error(`Jour invalide (${dayKey}).`);
  const v = value === undefined ? null : value;
  if (SLIDERS.includes(field)) {
    if (!(v === null || isSliderValue(v))) throw new Error(`Valeur invalide pour ${field}.`);
  } else if (TIMES.includes(field)) {
    if (!(v === null || isTime(v))) throw new Error(`Heure invalide pour ${field}.`);
  } else throw new Error(`Champ inconnu (${field}).`);
  store.commit(doc => {
    const day = { ...emptyDay(), ...(doc.days[dayKey] ?? {}) };
    day[field] = v;
    if (isEmptyDay(day)) delete doc.days[dayKey];
    else doc.days[dayKey] = day;
  }, { notify: false });
}

export function setDayFieldSoon(store, dayKey, field, value) {
  deferWrite(`suivi:${dayKey}:${field}`, () => setDayField(store, dayKey, field, value));
}

export const flushPending = flushDeferred;
```

`js/core/defer.js` :

```js
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
```

- [ ] **Step 4 : lancer, succès**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5 : commit**

```bash
git add js/core/defer.js js/modules/suivi tests/suivi
git commit -m "Ajoute les lectures et opérations Suivi : stats, bilan, saisie différée

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7 : schéma Pulsion

**Files:**
- Create: `js/modules/pulsion/schema.js`, `tests/pulsion/schema.test.mjs`

**Interfaces:**
- Consumes: `isDayKey` (tâche 1).
- Produces: `NATURES` (`contenu`, `sans`, `partenaire` : `{ label, rank, css }`), `NATURE_ORDER`, `TRIGGERS`, `CHECK_PRESETS`, `URGE_ANCHORS`, `pulsionSchema` (clé `moi.pulsion`, doc `{ version: 1, days: { [dayKey]: { urge, checksMin } }, events: [{ id, day, ts, nature, trigger }] }`), `emptyDay()`, `isEmptyDay(day)`.

- [ ] **Step 1 : test**

`tests/pulsion/schema.test.mjs` :

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pulsionSchema, NATURES, NATURE_ORDER, TRIGGERS, emptyDay, isEmptyDay } from '../../js/modules/pulsion/schema.js';

test('constantes et document vide', () => {
  assert.deepEqual(NATURE_ORDER, ['contenu', 'sans', 'partenaire']);
  assert.equal(NATURES.contenu.rank > NATURES.sans.rank && NATURES.sans.rank > NATURES.partenaire.rank, true);
  assert.equal(TRIGGERS.length, 6);
  assert.deepEqual(pulsionSchema.empty(), { version: 1, days: {}, events: [] });
  assert.deepEqual(emptyDay(), { urge: null, checksMin: null });
  assert.equal(isEmptyDay({ urge: null, checksMin: 0 }), false);
});

test('validate accepte un document correct, ids numériques compris', () => {
  const doc = { version: 1,
    days: { '2026-09-20': { urge: 4, checksMin: 20 } },
    events: [{ id: 1726000000000, day: '2026-09-19', ts: '2026-09-19T22:00:00.000Z', nature: 'contenu', trigger: 'Fatigue' },
             { id: 'e2', day: '2026-09-20', ts: '2026-09-20T22:00:00.000Z', nature: 'partenaire', trigger: null }] };
  assert.equal(pulsionSchema.validate(doc).ok, true);
});

test('validate refuse jours et événements mal formés', () => {
  const base = pulsionSchema.empty();
  const ev = { id: 'e', day: '2026-09-19', ts: '2026-09-19T22:00:00.000Z', nature: 'sans', trigger: 'Ennui' };
  assert.match(pulsionSchema.validate({ ...base, days: { '2026-09-20': { urge: 11, checksMin: null } } }).error, /urge/);
  assert.match(pulsionSchema.validate({ ...base, days: { '2026-09-20': { urge: null, checksMin: -1 } } }).error, /checks/);
  assert.match(pulsionSchema.validate({ ...base, events: [{ ...ev, nature: 'resistee' }] }).error, /nature/i);
  assert.match(pulsionSchema.validate({ ...base, events: [{ ...ev, day: '2026-02-30' }] }).error, /jour/i);
  assert.match(pulsionSchema.validate({ ...base, events: [{ ...ev, trigger: 3 }] }).error, /déclencheur/i);
  assert.equal(pulsionSchema.validate({ ...base, events: null }).ok, false);
  assert.equal(pulsionSchema.validate({ ...base, version: 2 }).ok, false);
});
```

- [ ] **Step 2 : lancer, échec attendu**

Run: `npm test`
Expected: FAIL.

- [ ] **Step 3 : implémentation**

`js/modules/pulsion/schema.js` :

```js
import { isDayKey } from '../../core/dates.js';

// Une seule dimension par acte : sa nature. Pas d'issue, pas d'intervalle, pas de compteur.
export const NATURES = {
  contenu: { label: 'Seul, avec contenu', rank: 3, css: 'var(--nat-contenu)' },
  sans: { label: 'Seul, sans contenu', rank: 2, css: 'var(--nat-sans)' },
  partenaire: { label: 'Avec partenaire', rank: 1, css: 'var(--nat-partenaire)' },
};
export const NATURE_ORDER = ['contenu', 'sans', 'partenaire'];
export const TRIGGERS = ['Fatigue', 'Ennui', 'Seul le soir', 'Stress / conflit', 'Sans raison claire', 'Autre'];
export const CHECK_PRESETS = [0, 5, 10, 20, 30, 60];
export const URGE_ANCHORS = ['aucune', 'présente, je peux faire autre chose', "envahissante, je ne pense qu'à ça"];

const isUrge = v => Number.isInteger(v) && v >= 0 && v <= 10;
const isMinutes = v => Number.isInteger(v) && v >= 0 && v <= 1440;
const isId = v => typeof v === 'string' || Number.isFinite(v);
const nullOr = (v, pred) => v === null || v === undefined || pred(v);

export function emptyDay() { return { urge: null, checksMin: null }; }
export function isEmptyDay(d) { return (d.urge ?? null) === null && (d.checksMin ?? null) === null; }

export const pulsionSchema = {
  key: 'moi.pulsion',
  version: 1,
  empty: () => ({ version: 1, days: {}, events: [] }),
  validate(raw) {
    const fail = error => ({ ok: false, error });
    if (!raw || typeof raw !== 'object') return fail('Document Pulsion invalide.');
    if (raw.version !== 1) return fail(`Version Pulsion inconnue (${raw.version}).`);
    if (!raw.days || typeof raw.days !== 'object' || Array.isArray(raw.days)) return fail('Liste de jours manquante.');
    if (!Array.isArray(raw.events)) return fail("Liste d'actes manquante.");
    for (const [k, d] of Object.entries(raw.days)) {
      if (!isDayKey(k)) return fail(`Clé de jour invalide (${k}).`);
      if (!d || typeof d !== 'object') return fail(`Jour mal formé (${k}).`);
      if (!nullOr(d.urge, isUrge)) return fail(`Valeur urge invalide le ${k}.`);
      if (!nullOr(d.checksMin, isMinutes)) return fail(`Valeur checksMin invalide le ${k}.`);
    }
    for (const e of raw.events) {
      if (!e || typeof e !== 'object') return fail('Acte mal formé.');
      if (!isId(e.id) || typeof e.ts !== 'string') return fail(`Acte mal formé (${e.id ?? '?'}).`);
      if (!isDayKey(e.day)) return fail(`Jour invalide sur un acte (${e.id}).`);
      if (!NATURES[e.nature]) return fail(`Nature inconnue (${e.nature}).`);
      if (!(e.trigger === null || e.trigger === undefined || typeof e.trigger === 'string')) return fail(`Déclencheur invalide (${e.id}).`);
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
git add js/modules/pulsion/schema.js tests/pulsion/schema.test.mjs
git commit -m "Ajoute le schéma Pulsion : pression, checks, actes par nature

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 8 : lectures et opérations Pulsion

**Files:**
- Create: `js/modules/pulsion/queries.js`, `js/modules/pulsion/ops.js`, `tests/pulsion/queries.test.mjs`, `tests/pulsion/ops.test.mjs`

**Interfaces:**
- Consumes: tâches 1, 2, 3, 7 ; `windowKeys` (tâche 6).
- Produces: `stats(doc, win, todayKey) -> { keys, series: { urge }, urge: pack, urgeMax, evenings4, checksVol, checksDays, byNature }`, `marks(doc) -> { [dayKey]: nature }`, `lastEvents(doc, n)`, `bilan(doc, todayKey)`. Ops : `setDayField(store, dayKey, field, value)`, `setDayFieldSoon(store, dayKey, field, value)` (différé via `deferWrite`), `addEvent(store, { nature, trigger, day }, todayKey) -> event`.

- [ ] **Step 1 : tests**

`tests/pulsion/queries.test.mjs` :

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stats, marks, lastEvents, bilan } from '../../js/modules/pulsion/queries.js';

const doc = { version: 1,
  days: { '2026-09-17': { urge: 3, checksMin: 10 }, '2026-09-19': { urge: 7, checksMin: 15 }, '2026-09-20': { urge: 4, checksMin: 0 } },
  events: [
    { id: 'a', day: '2026-09-19', ts: '2026-09-19T22:00:00.000Z', nature: 'sans', trigger: 'Ennui' },
    { id: 'b', day: '2026-09-19', ts: '2026-09-19T23:30:00.000Z', nature: 'contenu', trigger: 'Fatigue' },
    { id: 'c', day: '2026-09-20', ts: '2026-09-20T21:00:00.000Z', nature: 'partenaire', trigger: null },
    { id: 'd', day: '2026-09-01', ts: '2026-09-01T21:00:00.000Z', nature: 'contenu', trigger: 'Ennui' },
  ] };

test('stats sur 7 jours', () => {
  const s = stats(doc, 7, '2026-09-20');
  assert.deepEqual(s.series.urge, [null, null, null, 3, null, 7, 4]);
  assert.equal(s.urge.n, 3);
  assert.equal(s.urgeMax, 7);
  assert.equal(s.evenings4, 2);
  assert.equal(s.checksVol, 25);
  assert.equal(s.checksDays, 2);
  assert.deepEqual(s.byNature.contenu.map(e => e.id), ['b']);
  assert.deepEqual(s.byNature.partenaire.map(e => e.id), ['c']);
});

test('marks garde la nature la plus lourde du jour', () => {
  assert.deepEqual(marks(doc), { '2026-09-19': 'contenu', '2026-09-20': 'partenaire', '2026-09-01': 'contenu' });
});

test('lastEvents du plus récent au plus ancien', () => {
  assert.deepEqual(lastEvents(doc, 3).map(e => e.id), ['c', 'b', 'a']);
});

test('bilan pulsion', () => {
  const lines = bilan(doc, '2026-09-20').split('\n');
  assert.equal(lines[0], 'PULSION 14/09 → 20/09');
  assert.equal(lines[1], 'Pression : 4,7 ± 2,1/10 · max 7 · soirs ≥4 : 2');
  assert.equal(lines[2], 'Checks : 25 min sur 2 jour(s)');
  assert.equal(lines[3], 'Actes 7 j :');
  assert.equal(lines[4], '  Seul, avec contenu : 19/09 (fatigue)');
  assert.equal(lines[5], '  Seul, sans contenu : 19/09 (ennui)');
  assert.equal(lines[6], '  Avec partenaire : 20/09');
  assert.equal(bilan({ version: 1, days: {}, events: [] }, '2026-09-20').split('\n').at(-1), '  aucun');
});
```

`tests/pulsion/ops.test.mjs` :

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Store } from '../../js/core/store.js';
import { pulsionSchema } from '../../js/modules/pulsion/schema.js';
import { setDayField, addEvent } from '../../js/modules/pulsion/ops.js';
import { memoryStorage, fakeNow, fakeId, resetFakes } from '../fixtures/helpers.mjs';

function newStore() {
  resetFakes();
  const store = new Store(memoryStorage(), pulsionSchema, { now: fakeNow, makeId: fakeId });
  store.load();
  return store;
}

test('setDayField écrit urge et checksMin sans notifier, supprime un jour vide', () => {
  const store = newStore();
  let n = 0; store.subscribe(() => { n += 1; });
  setDayField(store, '2026-09-20', 'urge', 6);
  setDayField(store, '2026-09-20', 'checksMin', 20);
  assert.deepEqual(store.doc.days['2026-09-20'], { urge: 6, checksMin: 20 });
  assert.equal(n, 0);
  setDayField(store, '2026-09-20', 'urge', null);
  setDayField(store, '2026-09-20', 'checksMin', null);
  assert.equal(store.doc.days['2026-09-20'], undefined);
  assert.throws(() => setDayField(store, '2026-09-20', 'urge', 11), /valeur/i);
  assert.throws(() => setDayField(store, '2026-09-20', 'acts', []), /champ/i);
});

test('addEvent enregistre un acte daté, jamais dans le futur', () => {
  const store = newStore();
  const e = addEvent(store, { nature: 'contenu', trigger: 'Fatigue', day: '2026-09-19' }, '2026-09-20');
  assert.deepEqual(e, { id: 'id1', day: '2026-09-19', ts: '2026-09-20T10:01:00.000Z', nature: 'contenu', trigger: 'Fatigue' });
  const p = addEvent(store, { nature: 'partenaire', trigger: 'Ennui', day: '2026-09-20' }, '2026-09-20');
  assert.equal(p.trigger, null);
  assert.equal(store.doc.events.length, 2);
  assert.throws(() => addEvent(store, { nature: 'contenu', trigger: 'Ennui', day: '2026-09-21' }, '2026-09-20'), /futur/i);
  assert.throws(() => addEvent(store, { nature: 'contenu', trigger: 'Ennui', day: '2026-13-01' }, '2026-09-20'), /jour/i);
  assert.throws(() => addEvent(store, { nature: 'contenu', trigger: '', day: '2026-09-20' }, '2026-09-20'), /déclencheur/i);
  assert.throws(() => addEvent(store, { nature: 'resistee', trigger: 'Ennui', day: '2026-09-20' }, '2026-09-20'), /nature/i);
  assert.equal(store.doc.events.length, 2);
});
```

- [ ] **Step 2 : lancer, échec attendu**

Run: `npm test`
Expected: FAIL.

- [ ] **Step 3 : implémentation**

`js/modules/pulsion/queries.js` :

```js
// Lectures pures sur le document Pulsion.
import { addDays, frShort } from '../../core/dates.js';
import { pack, pm } from '../../core/stats.js';
import { windowKeys } from '../suivi/queries.js';
import { NATURES, NATURE_ORDER } from './schema.js';

export function stats(doc, win, todayKey) {
  const keys = windowKeys(todayKey, win);
  const inWindow = new Set(keys);
  const urge = [];
  let checksVol = 0, checksDays = 0;
  for (const k of keys) {
    const d = doc.days[k];
    urge.push(d && Number.isInteger(d.urge) ? d.urge : null);
    if (d && Number.isInteger(d.checksMin)) { checksVol += d.checksMin; if (d.checksMin > 0) checksDays++; }
  }
  const vals = urge.filter(v => v !== null);
  const byNature = Object.fromEntries(NATURE_ORDER.map(n => [n, []]));
  for (const e of [...doc.events].sort((a, b) => a.day.localeCompare(b.day) || a.ts.localeCompare(b.ts))) {
    if (inWindow.has(e.day)) byNature[e.nature].push(e);
  }
  return {
    keys, series: { urge }, urge: pack(urge),
    urgeMax: vals.length ? Math.max(...vals) : null,
    evenings4: vals.filter(v => v >= 4).length,
    checksVol, checksDays, byNature,
  };
}

// Un jour peut porter plusieurs actes : on garde le plus lourd pour la couleur du repère.
export function marks(doc) {
  const out = {};
  for (const e of doc.events) {
    const prev = out[e.day];
    if (!prev || NATURES[e.nature].rank > NATURES[prev].rank) out[e.day] = e.nature;
  }
  return out;
}

export function lastEvents(doc, n = 8) {
  return [...doc.events]
    .sort((a, b) => b.day.localeCompare(a.day) || b.ts.localeCompare(a.ts))
    .slice(0, n);
}

export function bilan(doc, todayKey) {
  const s = stats(doc, 7, todayKey);
  const lines = [
    `PULSION ${frShort(addDays(todayKey, -6))} → ${frShort(todayKey)}`,
    `Pression : ${pm(s.urge.m, s.urge.sd, '/10')} · max ${s.urgeMax ?? '—'} · soirs ≥4 : ${s.evenings4}`,
    `Checks : ${s.checksVol} min sur ${s.checksDays} jour(s)`,
    'Actes 7 j :',
  ];
  const natLines = NATURE_ORDER
    .filter(n => s.byNature[n].length)
    .map(n => `  ${NATURES[n].label} : ${s.byNature[n].map(e => frShort(e.day) + (e.trigger ? ` (${e.trigger.toLowerCase()})` : '')).join(', ')}`);
  return lines.concat(natLines.length ? natLines : ['  aucun']).join('\n');
}
```

`js/modules/pulsion/ops.js` :

```js
import { isDayKey } from '../../core/dates.js';
import { deferWrite } from '../../core/defer.js';
import { NATURES, emptyDay, isEmptyDay } from './schema.js';

const isUrge = v => Number.isInteger(v) && v >= 0 && v <= 10;
const isMinutes = v => Number.isInteger(v) && v >= 0 && v <= 1440;

export function setDayField(store, dayKey, field, value) {
  if (!isDayKey(dayKey)) throw new Error(`Jour invalide (${dayKey}).`);
  const v = value === undefined ? null : value;
  if (field === 'urge') { if (!(v === null || isUrge(v))) throw new Error('Valeur de pression invalide.'); }
  else if (field === 'checksMin') { if (!(v === null || isMinutes(v))) throw new Error('Valeur de checks invalide.'); }
  else throw new Error(`Champ inconnu (${field}).`);
  store.commit(doc => {
    const day = { ...emptyDay(), ...(doc.days[dayKey] ?? {}) };
    day[field] = v;
    if (isEmptyDay(day)) delete doc.days[dayKey];
    else doc.days[dayKey] = day;
  }, { notify: false });
}

export function setDayFieldSoon(store, dayKey, field, value) {
  deferWrite(`pulsion:${dayKey}:${field}`, () => setDayField(store, dayKey, field, value));
}

// Append-only : un acte s'enregistre, ne se modifie pas, ne se supprime pas depuis l'interface.
export function addEvent(store, { nature, trigger, day }, todayKey) {
  if (!NATURES[nature]) throw new Error(`Nature inconnue (${nature}).`);
  if (!isDayKey(day)) throw new Error(`Jour invalide (${day}).`);
  if (day > todayKey) throw new Error('Un acte ne peut pas être dans le futur.');
  const t = nature === 'partenaire' ? null : (trigger ?? '').trim();
  if (nature !== 'partenaire' && !t) throw new Error('Déclencheur manquant.');
  return store.commit(doc => {
    const e = { id: store.makeId(), day, ts: store.now(), nature, trigger: t };
    doc.events.push(e);
    return e;
  });
}
```

- [ ] **Step 4 : lancer, succès**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5 : commit**

```bash
git add js/modules/pulsion tests/pulsion
git commit -m "Ajoute les lectures et opérations Pulsion : stats, repères, bilan, actes datés

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 9 : reprise des données de l'ancienne app Suivi

**Files:**
- Create: `js/core/migrate-legacy.js`, `tests/core/migrate-legacy.test.mjs`

**Interfaces:**
- Consumes: `isDayKey`, `isTime` (tâche 1) ; stores avec `replace(doc)` (tâche 3).
- Produces: `LEGACY_SUIVI_KEY = 'suivi_v1'`, `LEGACY_TESTS_KEY = 'suivi_tests_v1'`, `natureOf(event)`, `convertLegacy(suiviRaw, testsRaw) -> { suivi, pulsion, tests }` (chaque valeur : doc ou null), `hasLegacy(storage)`, `isFresh(storage, keys)`, `migrateLegacy(storage, stores) -> string[]` (noms des modules remplacés).

- [ ] **Step 1 : test**

`tests/core/migrate-legacy.test.mjs` :

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { natureOf, convertLegacy, hasLegacy, isFresh, migrateLegacy } from '../../js/core/migrate-legacy.js';
import { Store } from '../../js/core/store.js';
import { suiviSchema } from '../../js/modules/suivi/schema.js';
import { pulsionSchema } from '../../js/modules/pulsion/schema.js';
import { testsSchema } from '../../js/modules/tests/schema.js';
import { memoryStorage, fakeNow, fakeId, resetFakes } from '../fixtures/helpers.mjs';

const legacy = { days: {
  '2026-09-18': { bed: '23:30', wake: '07:00', sleepQ: 6, cardioMin: 30, readMin: 10, medMin: null, clarity: 7, mood: 6, elan: 5, urge: 3, checksMin: 10, acts: ['atelier'], note: 'x' },
  '2026-09-19': { bed: null, wake: null, sleepQ: 4, cardioMin: 0, readMin: null, medMin: null, clarity: null, mood: null, elan: null, urge: null, checksMin: null, acts: null, note: null },
  '2026-09-20': { bed: '9h', wake: '07:10', clarity: 12, mood: 5.5, elan: 8, urge: 2, checksMin: -3, cardio: true, focus: true, sleep: 7 },
  '2026-02-30': { mood: 5 },
}, events: [
  { id: 1726000000000, day: '2026-09-18', ts: '2026-09-18T22:00:00.000Z', nature: 'contenu', trigger: 'Fatigue' },
  { id: 1725000000000, day: '2026-09-10', ts: '2026-09-10T22:00:00.000Z', type: 'rechute', trigger: 'Ennui' },
  { id: 1724000000000, day: '2026-09-09', ts: '2026-09-09T22:00:00.000Z', type: 'solo', trigger: null },
  { id: 1723000000000, day: '2026-09-08', ts: '2026-09-08T22:00:00.000Z', type: 'resistee', trigger: 'Ennui' },
  { id: 1722000000000, day: 'hier', ts: '2026-09-07T22:00:00.000Z', nature: 'contenu', trigger: 'Ennui' },
  null,
] };
const legacyTests = { runs: [
  { id: 1, ts: '2026-09-14T09:00:00.000Z', day: '2026-09-14', test: 'pvt', metrics: { median: 250 } },
  { id: 2, ts: '2026-09-14T09:10:00.000Z', day: '2026-09-14', test: 'span', metrics: { span: 5 } },
  { id: 3, ts: 'x', day: 'nope', test: 'pvt', metrics: {} },
] };

test('natureOf lit nature puis type', () => {
  assert.equal(natureOf({ nature: 'sans' }), 'sans');
  assert.equal(natureOf({ type: 'rechute' }), 'contenu');
  assert.equal(natureOf({ type: 'solo' }), 'sans');
  assert.equal(natureOf({ type: 'resistee' }), null);
});

test('convertLegacy sépare Suivi et Pulsion, ignore ce qui est invalide', () => {
  const { suivi, pulsion, tests } = convertLegacy(legacy, legacyTests);
  assert.equal(suiviSchema.validate(suivi).ok, true);
  assert.equal(pulsionSchema.validate(pulsion).ok, true);
  assert.equal(testsSchema.validate(tests).ok, true);
  assert.deepEqual(suivi.days['2026-09-18'], { bed: '23:30', wake: '07:00', clarity: 7, mood: 6, pleasure: null, drive: 5 });
  assert.equal(suivi.days['2026-09-19'], undefined); // sleepQ et cardio seuls : rien à reprendre
  assert.deepEqual(suivi.days['2026-09-20'], { bed: null, wake: '07:10', clarity: null, mood: null, pleasure: null, drive: 8 });
  assert.equal(suivi.days['2026-02-30'], undefined);
  assert.deepEqual(pulsion.days, { '2026-09-18': { urge: 3, checksMin: 10 }, '2026-09-20': { urge: 2, checksMin: null } });
  assert.deepEqual(pulsion.events.map(e => [e.day, e.nature, e.trigger]), [
    ['2026-09-18', 'contenu', 'Fatigue'], ['2026-09-10', 'contenu', 'Ennui'], ['2026-09-09', 'sans', null],
  ]);
  assert.equal(pulsion.events[0].id, 1726000000000);
  assert.deepEqual(tests.runs.map(r => r.test), ['pvt', 'span']);
});

test('convertLegacy sans données renvoie des null', () => {
  assert.deepEqual(convertLegacy(null, null), { suivi: null, pulsion: null, tests: null });
  assert.deepEqual(convertLegacy({}, undefined).suivi, { version: 1, days: {} });
});

test('hasLegacy, isFresh et migrateLegacy remplacent les stores', () => {
  resetFakes();
  const storage = memoryStorage({ suivi_v1: JSON.stringify(legacy), suivi_tests_v1: '{pas du json' });
  assert.equal(hasLegacy(storage), true);
  assert.equal(isFresh(storage, ['moi.suivi', 'moi.pulsion', 'moi.tests']), true);
  const stores = {
    suivi: new Store(storage, suiviSchema, { now: fakeNow, makeId: fakeId }),
    pulsion: new Store(storage, pulsionSchema, { now: fakeNow, makeId: fakeId }),
    tests: new Store(storage, testsSchema, { now: fakeNow, makeId: fakeId }),
  };
  for (const s of Object.values(stores)) s.load();
  assert.equal(isFresh(storage, ['moi.suivi']), false);
  assert.deepEqual(migrateLegacy(storage, stores), ['suivi', 'pulsion']);
  assert.equal(Object.keys(stores.suivi.doc.days).length, 2);
  assert.equal(stores.pulsion.doc.events.length, 3);
  assert.deepEqual(stores.tests.doc.runs, []);
  assert.equal(storage.getItem('suivi_v1') !== null, true); // jamais effacé
  assert.equal(hasLegacy(memoryStorage()), false);
});
```

- [ ] **Step 2 : lancer, échec attendu**

Run: `npm test`
Expected: FAIL.

- [ ] **Step 3 : implémentation**

`js/core/migrate-legacy.js` :

```js
// Reprise en place des données de l'ancienne app Suivi (même origine GitHub Pages,
// donc même localStorage). Les anciennes clés ne sont jamais effacées.
import { isDayKey, isTime } from './dates.js';

export const LEGACY_SUIVI_KEY = 'suivi_v1';
export const LEGACY_TESTS_KEY = 'suivi_tests_v1';

// Les événements d'avant la v1.2 de Suivi portaient un champ "type".
export function natureOf(e) {
  if (e.nature) return e.nature;
  if (e.type === 'rechute') return 'contenu';
  if (e.type === 'solo') return 'sans';
  return null; // "resistee" : plus une catégorie
}

const slider = v => (Number.isInteger(v) && v >= 0 && v <= 10 ? v : null);
const time = v => (isTime(v) ? v : null);
const minutes = v => (Number.isInteger(v) && v >= 0 && v <= 1440 ? v : null);
const isId = v => typeof v === 'string' || Number.isFinite(v);
const isObj = v => v && typeof v === 'object' && !Array.isArray(v);

export function convertLegacy(suiviRaw, testsRaw) {
  const out = { suivi: null, pulsion: null, tests: null };
  if (isObj(suiviRaw)) {
    const suivi = { version: 1, days: {} };
    const pulsion = { version: 1, days: {}, events: [] };
    for (const [k, d] of Object.entries(isObj(suiviRaw.days) ? suiviRaw.days : {})) {
      if (!isDayKey(k) || !isObj(d)) continue;
      const sd = { bed: time(d.bed), wake: time(d.wake), clarity: slider(d.clarity), mood: slider(d.mood), pleasure: null, drive: slider(d.elan) };
      if (Object.values(sd).some(v => v !== null)) suivi.days[k] = sd;
      const pd = { urge: slider(d.urge), checksMin: minutes(d.checksMin) };
      if (pd.urge !== null || pd.checksMin !== null) pulsion.days[k] = pd;
    }
    for (const e of Array.isArray(suiviRaw.events) ? suiviRaw.events : []) {
      if (!isObj(e)) continue;
      const nature = natureOf(e);
      if (!nature || !isDayKey(e.day)) continue;
      pulsion.events.push({
        id: isId(e.id) ? e.id : `${e.day}-${pulsion.events.length}`,
        day: e.day,
        ts: typeof e.ts === 'string' ? e.ts : `${e.day}T12:00:00.000Z`,
        nature,
        trigger: typeof e.trigger === 'string' && e.trigger ? e.trigger : null,
      });
    }
    out.suivi = suivi;
    out.pulsion = pulsion;
  }
  if (isObj(testsRaw) && Array.isArray(testsRaw.runs)) {
    out.tests = { version: 1, runs: testsRaw.runs.filter(r => isObj(r) && isId(r.id) && typeof r.ts === 'string'
      && isDayKey(r.day) && typeof r.test === 'string' && isObj(r.metrics)) };
  }
  return out;
}

export function hasLegacy(storage) {
  return storage.getItem(LEGACY_SUIVI_KEY) !== null || storage.getItem(LEGACY_TESTS_KEY) !== null;
}

export function isFresh(storage, keys) {
  return keys.every(k => storage.getItem(k) === null);
}

function readJson(storage, key) {
  try { return JSON.parse(storage.getItem(key)); } catch { return null; }
}

export function migrateLegacy(storage, stores) {
  const converted = convertLegacy(readJson(storage, LEGACY_SUIVI_KEY), readJson(storage, LEGACY_TESTS_KEY));
  const done = [];
  for (const name of ['suivi', 'pulsion', 'tests']) {
    if (converted[name] && stores[name]) { stores[name].replace(converted[name]); done.push(name); }
  }
  return done;
}
```

- [ ] **Step 4 : lancer, succès**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5 : commit**

```bash
git add js/core/migrate-legacy.js tests/core/migrate-legacy.test.mjs
git commit -m "Ajoute la reprise en place des données de l'ancienne app Suivi

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 10 : sparkline SVG

**Files:**
- Create: `js/core/chart.js`, `tests/core/chart.test.mjs`

**Interfaces:**
- Produces: `sparkline({ values, min = 0, max = 10, marks = [], color, width = 280, height = 56, pad = 6, grid = null, dots = null, emptyText }) -> string` HTML. `marks` : `[{ i, color, dashed }]` indices dans `values`. `min: null, max: null` = échelle automatique sur l'étendue avec marge de 18 %.

- [ ] **Step 1 : test**

`tests/core/chart.test.mjs` :

```js
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
```

- [ ] **Step 2 : lancer, échec attendu**

Run: `npm test`
Expected: FAIL.

- [ ] **Step 3 : implémentation**

`js/core/chart.js` :

```js
// Sparkline SVG : une série avec trous, une échelle fixe (0-10) ou automatique,
// des repères verticaux. Rendu en chaîne, aucun DOM.
const num = v => v !== null && v !== undefined && Number.isFinite(v);

export function sparkline({ values, min = 0, max = 10, marks = [], color = 'var(--accent)', width = 280, height = 56, pad = 6, grid = null, dots = null, emptyText = 'pas encore de données' }) {
  const vals = values.filter(num);
  if (!vals.length) return `<div class="chart-empty">${emptyText}</div>`;
  const auto = min === null || max === null;
  let lo = min, hi = max;
  if (auto) {
    lo = Math.min(...vals); hi = Math.max(...vals);
    if (hi === lo) { lo -= 1; hi += 1; }
    const m = (hi - lo) * 0.18; lo -= m; hi += m;
  }
  const n = values.length;
  const x = i => (n < 2 ? width / 2 : pad + (i / (n - 1)) * (width - 2 * pad));
  const y = v => height - pad - ((v - lo) / (hi - lo)) * (height - 2 * pad);
  const showDots = dots ?? n <= 30;

  let path = '', gap = true, dotsSvg = '';
  values.forEach((v, i) => {
    if (!num(v)) { gap = true; return; }
    const X = x(i).toFixed(1), Y = y(v).toFixed(1);
    path += `${gap ? 'M' : 'L'}${X} ${Y} `;
    if (showDots) dotsSvg += `<circle cx="${X}" cy="${Y}" r="2.4" fill="${color}"/>`;
    gap = false;
  });
  const gridLines = grid ?? (auto ? [] : [min, (min + max) / 2, max]);
  const gridSvg = gridLines.map(g => `<line x1="${pad}" x2="${width - pad}" y1="${y(g).toFixed(1)}" y2="${y(g).toFixed(1)}" class="chart-grid"/>`).join('');
  const marksSvg = marks.filter(m => m.i >= 0 && m.i < n).map(m => {
    const X = x(m.i).toFixed(1);
    return `<line x1="${X}" x2="${X}" y1="${pad}" y2="${height - pad}" stroke="${m.color}" stroke-width="1.6" opacity=".85"${m.dashed ? ' stroke-dasharray="2 2"' : ''}/>`;
  }).join('');
  return `<svg class="spark" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">${gridSvg}${marksSvg}<path d="${path.trim()}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>${dotsSvg}</svg>`;
}
```

- [ ] **Step 4 : lancer, succès**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5 : commit**

```bash
git add js/core/chart.js tests/core/chart.test.mjs
git commit -m "Ajoute la sparkline SVG commune

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 11 : backup, export, chiffrement, Gist

**Files:**
- Create: `js/core/backup.js`, `tests/core/backup.test.mjs`

**Interfaces:**
- Consumes: `migrate` (tâche 3), schémas.
- Produces: `BUNDLE_FORMAT = 'moi-1'`, `GIST_FILE = 'moi.enc.json'`, `LAST_LOCAL_KEY = 'moi.lastLocalBackup'`, `LAST_CLOUD_KEY = 'moi.lastCloudBackup'`, `moduleExportJson(name, doc, nowIso)`, `moduleExportFilename(name, dayKey)`, `parseModuleExport(name, text) -> doc brut`, `bundleJson(docs, nowIso)`, `parseBundle(text, schemas) -> { exportedAt, modules }` (validés et migrés, lève une erreur listant chaque module invalide), `encryptText(pass, text)`, `decryptText(pass, packed)`, `cloudConfig(storage, ask)`, `gistApi(method, path, token, body, fetchFn)`, `cloudBackup({ storage, getJson, todayKey, ask, force, fetchFn })`, `cloudRestore({ storage, ask, fetchFn }) -> texte déchiffré`, `resetCloudSession()`, `autoBackup({ storage, getJson, todayKey, download }) -> bool`, `cloudStatus(storage)`.

- [ ] **Step 1 : test**

`tests/core/backup.test.mjs` :

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  moduleExportJson, moduleExportFilename, parseModuleExport, bundleJson, parseBundle,
  encryptText, decryptText, cloudBackup, cloudRestore, resetCloudSession, autoBackup, cloudStatus,
  GIST_FILE, LAST_LOCAL_KEY, LAST_CLOUD_KEY,
} from '../../js/core/backup.js';
import { suiviSchema } from '../../js/modules/suivi/schema.js';
import { pulsionSchema } from '../../js/modules/pulsion/schema.js';
import { settingsSchema } from '../../js/modules/settings/schema.js';
import { memoryStorage } from '../fixtures/helpers.mjs';

const NOW = '2026-09-20T10:00:00.000Z';
const schemas = { suivi: suiviSchema, pulsion: pulsionSchema, settings: settingsSchema };
const docs = () => ({
  suivi: { version: 1, days: { '2026-09-20': { bed: null, wake: null, clarity: 5, mood: null, pleasure: null, drive: null } } },
  pulsion: pulsionSchema.empty(),
  settings: { ...settingsSchema.empty(), llm: { ...settingsSchema.empty().llm, apiKey: 'sk-secret' } },
});

function fakeFetch(gists) {
  return async (url, opts = {}) => {
    const method = opts.method ?? 'GET';
    const id = url.split('/').pop();
    if (method === 'POST') {
      const body = JSON.parse(opts.body);
      gists.g1 = { id: 'g1', files: Object.fromEntries(Object.entries(body.files).map(([k, v]) => [k, { content: v.content, truncated: false }])) };
      return { ok: true, status: 201, json: async () => gists.g1 };
    }
    if (method === 'PATCH') {
      const body = JSON.parse(opts.body);
      for (const [k, v] of Object.entries(body.files)) gists[id].files[k] = { content: v.content, truncated: false };
      return { ok: true, status: 200, json: async () => gists[id] };
    }
    return gists[id] ? { ok: true, status: 200, json: async () => gists[id] } : { ok: false, status: 404, json: async () => ({}) };
  };
}

test('export par module : format, nom de fichier, relecture', () => {
  const text = moduleExportJson('suivi', docs().suivi, NOW);
  const parsed = JSON.parse(text);
  assert.equal(parsed.format, 'moi-suivi-1');
  assert.equal(parsed.exportedAt, NOW);
  assert.equal(moduleExportFilename('suivi', '2026-09-20'), 'moi-suivi-2026-09-20.json');
  assert.deepEqual(parseModuleExport('suivi', text), docs().suivi);
  assert.throws(() => parseModuleExport('pulsion', text), /export pulsion/i);
  assert.throws(() => parseModuleExport('suivi', '{nope'), /JSON/);
});

test('bundleJson embarque tous les modules sans la clé API', () => {
  const b = JSON.parse(bundleJson(docs(), NOW));
  assert.equal(b.format, 'moi-1');
  assert.equal(b.modules.settings.llm.apiKey, '');
  assert.equal(b.modules.suivi.days['2026-09-20'].clarity, 5);
  assert.equal(docs().settings.llm.apiKey, 'sk-secret'); // la source n'est pas modifiée
});

test('parseBundle valide chaque module et refuse tout si un seul est invalide', () => {
  const good = parseBundle(bundleJson(docs(), NOW), schemas);
  assert.equal(good.exportedAt, NOW);
  assert.deepEqual(Object.keys(good.modules).sort(), ['pulsion', 'settings', 'suivi']);
  const broken = JSON.parse(bundleJson(docs(), NOW));
  broken.modules.pulsion.events = [{ id: 'x' }];
  assert.throws(() => parseBundle(JSON.stringify(broken), schemas), /Backup invalide.*pulsion/);
  assert.throws(() => parseBundle(JSON.stringify({ format: 'suivi-export-1' }), schemas), /format/i);
  const partial = parseBundle(JSON.stringify({ format: 'moi-1', exportedAt: NOW, modules: { suivi: docs().suivi } }), schemas);
  assert.deepEqual(Object.keys(partial.modules), ['suivi']);
});

test('chiffrement aller-retour, mauvaise passphrase refusée', async () => {
  const packed = await encryptText('secret', 'bonjour');
  const env = JSON.parse(packed);
  assert.equal(env.v, 1);
  assert.equal(await decryptText('secret', packed), 'bonjour');
  await assert.rejects(decryptText('autre', packed));
});

test('cloudBackup : non configuré, puis création du gist, puis déjà fait, puis force', async () => {
  resetCloudSession();
  const storage = memoryStorage();
  const gists = {};
  const fetchFn = fakeFetch(gists);
  const getJson = () => bundleJson(docs(), NOW);
  assert.equal(await cloudBackup({ storage, getJson, todayKey: '2026-09-20', fetchFn }), 'non configuré');
  const answers = ['tok', 'pass'];
  const ask = () => answers.shift();
  assert.equal(await cloudBackup({ storage, getJson, todayKey: '2026-09-20', ask, force: true, fetchFn }), 'ok');
  assert.equal(storage.getItem('cloud_gist'), 'g1');
  assert.equal(storage.getItem(LAST_CLOUD_KEY), '2026-09-20');
  assert.ok(gists.g1.files[GIST_FILE]);
  assert.equal(await cloudBackup({ storage, getJson, todayKey: '2026-09-20', fetchFn }), 'déjà fait');
  resetCloudSession();
  assert.equal(await cloudBackup({ storage, getJson, todayKey: '2026-09-20', fetchFn }), 'déjà fait');
  assert.equal(await cloudBackup({ storage, getJson, todayKey: '2026-09-21', fetchFn }), 'ok');
  assert.match(cloudStatus(storage), /dernier push 2026-09-21/);
});

test('cloudRestore rend le texte déchiffré, erreur lisible sur mauvaise passphrase', async () => {
  resetCloudSession();
  const storage = memoryStorage({ cloud_token: 'tok', cloud_pass: 'pass' });
  const gists = {};
  const fetchFn = fakeFetch(gists);
  await cloudBackup({ storage, getJson: () => 'payload', todayKey: '2026-09-20', fetchFn, force: true });
  assert.equal(await cloudRestore({ storage, fetchFn }), 'payload');
  storage.setItem('cloud_pass', 'wrong');
  await assert.rejects(cloudRestore({ storage, fetchFn }), /passphrase/i);
  storage.setItem('cloud_gist', 'nope');
  await assert.rejects(cloudRestore({ storage, fetchFn }), /Gist API 404/);
});

test('cloudBackup absorbe une erreur réseau', async () => {
  resetCloudSession();
  const storage = memoryStorage({ cloud_token: 'tok', cloud_pass: 'pass' });
  const r = await cloudBackup({ storage, getJson: () => 'x', todayKey: '2026-09-20', fetchFn: async () => { throw new Error('offline'); } });
  assert.match(r, /^erreur : offline/);
  assert.equal(storage.getItem(LAST_CLOUD_KEY), null);
});

test('autoBackup une fois par jour, jamais bloquant', () => {
  const storage = memoryStorage();
  const calls = [];
  const download = (name, text) => calls.push([name, text]);
  assert.equal(autoBackup({ storage, getJson: () => '{}', todayKey: '2026-09-20', download }), true);
  assert.deepEqual(calls, [['moi_2026-09-20.json', '{}']]);
  assert.equal(storage.getItem(LAST_LOCAL_KEY), '2026-09-20');
  assert.equal(autoBackup({ storage, getJson: () => '{}', todayKey: '2026-09-20', download }), false);
  assert.equal(autoBackup({ storage, getJson: () => { throw new Error('x'); }, todayKey: '2026-09-21', download }), false);
  assert.equal(cloudStatus(memoryStorage()), 'cloud non configuré');
});
```

- [ ] **Step 2 : lancer, échec attendu**

Run: `npm test`
Expected: FAIL.

- [ ] **Step 3 : implémentation**

`js/core/backup.js` :

```js
// Backup en trois couches, une seule implémentation :
// 1) export et import manuels par module ;
// 2) fichier quotidien du bundle complet dans Téléchargements ;
// 3) push quotidien du même bundle, chiffré côté client (PBKDF2 → AES-256-GCM),
//    vers un Gist GitHub privé. Push seul, jamais de synchronisation.
// La config cloud (token, passphrase, gistId) vit dans les clés déjà utilisées par
// les anciennes apps sur cette origine. La clé API LLM n'entre dans aucun backup.
import { migrate } from './store.js';

export const BUNDLE_FORMAT = 'moi-1';
export const GIST_FILE = 'moi.enc.json';
export const LAST_LOCAL_KEY = 'moi.lastLocalBackup';
export const LAST_CLOUD_KEY = 'moi.lastCloudBackup';

/* ---------- Export et import par module ---------- */
export function moduleExportJson(name, doc, nowIso = new Date().toISOString()) {
  return JSON.stringify({ format: `moi-${name}-1`, exportedAt: nowIso, doc }, null, 2);
}

export function moduleExportFilename(name, dayKey) { return `moi-${name}-${dayKey}.json`; }

function parseJson(text) {
  try { return JSON.parse(text); } catch { throw new Error("Le fichier n'est pas du JSON valide."); }
}

export function parseModuleExport(name, text) {
  const parsed = parseJson(text);
  if (!parsed || parsed.format !== `moi-${name}-1` || !parsed.doc) throw new Error(`Ce fichier n'est pas un export ${name}.`);
  return parsed.doc;
}

/* ---------- Bundle global ---------- */
export function bundleJson(docs, nowIso = new Date().toISOString()) {
  const modules = { ...docs };
  if (modules.settings) modules.settings = { ...modules.settings, llm: { ...modules.settings.llm, apiKey: '' } };
  return JSON.stringify({ format: BUNDLE_FORMAT, exportedAt: nowIso, modules }, null, 1);
}

export function parseBundle(text, schemas) {
  const parsed = parseJson(text);
  if (!parsed || parsed.format !== BUNDLE_FORMAT || !parsed.modules || typeof parsed.modules !== 'object') {
    throw new Error('Ce fichier n\'est pas un backup Moi (format inconnu).');
  }
  const modules = {}, errors = [];
  for (const [name, schema] of Object.entries(schemas)) {
    const raw = parsed.modules[name];
    if (raw === undefined) continue;
    const v = schema.validate(raw);
    if (!v.ok) { errors.push(`${name} — ${v.error}`); continue; }
    modules[name] = migrate(v.doc, schema);
  }
  if (errors.length) throw new Error(`Backup invalide : ${errors.join(' ; ')}`);
  return { exportedAt: parsed.exportedAt, modules };
}

/* ---------- Chiffrement ---------- */
const b64 = buf => btoa(String.fromCharCode(...new Uint8Array(buf)));
const ub64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));

async function deriveKey(pass, salt) {
  const km = await crypto.subtle.importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 150000, hash: 'SHA-256' }, km, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

export async function encryptText(pass, text) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(pass, salt);
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(text));
  return JSON.stringify({ v: 1, kdf: 'PBKDF2-150k', salt: b64(salt), iv: b64(iv), data: b64(ct) });
}

export async function decryptText(pass, packed) {
  const p = JSON.parse(packed);
  const key = await deriveKey(pass, ub64(p.salt));
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: ub64(p.iv) }, key, ub64(p.data));
  return new TextDecoder().decode(pt);
}

/* ---------- Config partagée et API Gist ---------- */
export function cloudConfig(storage, ask = null) {
  let token = storage.getItem('cloud_token');
  let pass = storage.getItem('cloud_pass');
  if ((!token || !pass) && ask) {
    token = (ask('Token GitHub (portée Gists uniquement) :') || '').trim();
    pass = (ask('Passphrase de chiffrement (à noter précieusement !) :') || '').trim();
    if (token && pass) { storage.setItem('cloud_token', token); storage.setItem('cloud_pass', pass); }
  }
  return token && pass ? { token, pass, gistId: storage.getItem('cloud_gist') } : null;
}

export async function gistApi(method, path, token, body, fetchFn = globalThis.fetch) {
  const r = await fetchFn(`https://api.github.com${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) throw new Error(`Gist API ${r.status}`);
  return r.json();
}

/* ---------- Push quotidien, best-effort, jamais bloquant ---------- */
let sessionDone = false;
export function resetCloudSession() { sessionDone = false; }

export async function cloudBackup({ storage, getJson, todayKey, ask = null, force = false, fetchFn = globalThis.fetch }) {
  try {
    if (!force && (sessionDone || storage.getItem(LAST_CLOUD_KEY) === todayKey)) return 'déjà fait';
    const cfg = cloudConfig(storage, ask);
    if (!cfg) return 'non configuré';
    const enc = await encryptText(cfg.pass, getJson());
    if (!cfg.gistId) {
      const g = await gistApi('POST', '/gists', cfg.token, {
        description: 'Backups chiffrés PWA (AES-GCM, illisible sans passphrase)',
        public: false, files: { [GIST_FILE]: { content: enc } },
      }, fetchFn);
      storage.setItem('cloud_gist', g.id);
    } else {
      await gistApi('PATCH', `/gists/${cfg.gistId}`, cfg.token, { files: { [GIST_FILE]: { content: enc } } }, fetchFn);
    }
    storage.setItem(LAST_CLOUD_KEY, todayKey);
    sessionDone = true;
    return 'ok';
  } catch (e) {
    return `erreur : ${e.message}`;
  }
}

/* ---------- Restauration : rend le texte déchiffré ---------- */
export async function cloudRestore({ storage, ask = null, fetchFn = globalThis.fetch }) {
  const cfg = cloudConfig(storage, ask);
  if (!cfg) throw new Error('cloud non configuré');
  let gid = cfg.gistId;
  if (!gid) {
    gid = (ask?.("ID du gist de backup (visible dans l'URL du gist) :") || '').trim();
    if (!gid) throw new Error("pas d'ID de gist");
    storage.setItem('cloud_gist', gid);
  }
  const g = await gistApi('GET', `/gists/${gid}`, cfg.token, undefined, fetchFn);
  const f = g.files?.[GIST_FILE];
  if (!f) throw new Error('aucun backup Moi dans ce gist');
  const content = f.truncated ? await (await fetchFn(f.raw_url)).text() : f.content;
  try { return await decryptText(cfg.pass, content); }
  catch { throw new Error('Déchiffrement impossible : passphrase incorrecte ou backup altéré.'); }
}

/* ---------- Fichier quotidien ---------- */
export function autoBackup({ storage, getJson, todayKey, download }) {
  try {
    if (storage.getItem(LAST_LOCAL_KEY) === todayKey) return false;
    download(`moi_${todayKey}.json`, getJson());
    storage.setItem(LAST_LOCAL_KEY, todayKey);
    return true;
  } catch { return false; }
}

export function cloudStatus(storage) {
  const cfg = storage.getItem('cloud_token') && storage.getItem('cloud_pass');
  const last = storage.getItem(LAST_CLOUD_KEY);
  if (!cfg) return 'cloud non configuré';
  return last ? `cloud ✓ dernier push ${last}` : 'cloud configuré, pas encore de push';
}
```

- [ ] **Step 4 : lancer, succès**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5 : commit**

```bash
git add js/core/backup.js tests/core/backup.test.mjs
git commit -m "Ajoute le backup : exports par module, bundle chiffré, Gist, fichier quotidien

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 12 : routeur

**Files:**
- Create: `js/router.js`, `tests/core/router.test.mjs`

**Interfaces:**
- Produces: `TABS = ['suivi','pulsion','challenge','tests','mind','rappel','settings']`, `parseRoute(hash) -> { tab, view, id } | null`, `routeHash(route)`, `navigate(route)`, `onRoute(fn)`.

- [ ] **Step 1 : test**

`tests/core/router.test.mjs` :

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRoute, routeHash, TABS } from '../../js/router.js';

test('parseRoute : onglet, vue, identifiant', () => {
  assert.deepEqual(parseRoute('#/suivi'), { tab: 'suivi', view: 'home', id: undefined });
  assert.deepEqual(parseRoute('#/suivi/data'), { tab: 'suivi', view: 'data', id: undefined });
  assert.deepEqual(parseRoute('#/mind/s/abc%20d'), { tab: 'mind', view: 's', id: 'abc d' });
  assert.deepEqual(parseRoute('#/tests/run/pvt'), { tab: 'tests', view: 'run', id: 'pvt' });
  assert.deepEqual(parseRoute('#/settings'), { tab: 'settings', view: 'home', id: undefined });
  assert.equal(parseRoute(''), null);
  assert.equal(parseRoute('#/'), null);
  assert.equal(parseRoute('#/inconnu'), null);
  assert.equal(TABS.length, 7);
});

test('routeHash est l\'inverse de parseRoute', () => {
  for (const r of [{ tab: 'suivi', view: 'home' }, { tab: 'suivi', view: 'data' }, { tab: 'mind', view: 's', id: 'x/y' }, { tab: 'rappel', view: 'capture' }]) {
    assert.deepEqual(parseRoute(routeHash(r)), { id: undefined, ...r });
  }
  assert.equal(routeHash({ tab: 'pulsion' }), '#/pulsion');
});
```

- [ ] **Step 2 : lancer, échec attendu**

Run: `npm test`
Expected: FAIL.

- [ ] **Step 3 : implémentation**

`js/router.js` :

```js
// Routage par fragment d'URL : #/<onglet>/<vue>/<id>. Le bouton retour du téléphone fonctionne partout.
export const TABS = ['suivi', 'pulsion', 'challenge', 'tests', 'mind', 'rappel', 'settings'];

export function parseRoute(hash) {
  const segs = (hash ?? '').replace(/^#/, '').split('/').filter(Boolean);
  if (!TABS.includes(segs[0])) return null;
  return { tab: segs[0], view: segs[1] ?? 'home', id: segs[2] !== undefined ? decodeURIComponent(segs[2]) : undefined };
}

export function routeHash({ tab, view = 'home', id }) {
  let h = `#/${tab}`;
  if (view !== 'home' || id !== undefined) h += `/${view}`;
  if (id !== undefined) h += `/${encodeURIComponent(id)}`;
  return h;
}

export function navigate(route) { location.hash = routeHash(route); }

export function onRoute(fn) {
  const fire = () => fn(parseRoute(location.hash));
  window.addEventListener('hashchange', fire);
  fire();
}
```

- [ ] **Step 4 : lancer, succès**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5 : commit**

```bash
git add js/router.js tests/core/router.test.mjs
git commit -m "Ajoute le routeur par fragment : onglet, vue, identifiant

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 13 : coquille — ui.js, style.css, index.html, app.js

**Files:**
- Create: `js/version.js`, `js/core/ui.js`, `style.css`, `index.html`, `js/app.js`, `tests/core/ui.test.mjs`

**Interfaces:**
- Consumes: tout ce qui précède.
- Produces: `APP_VERSION` ; `ui.js` : `escapeHtml(str)`, `sliderHtml({ field, label, value, anchors, cls })`, `chipsHtml({ field, options, value, other })`, `dayNavHtml(dayKey, todayKey)`, `openSheet(innerHtml) -> sheetEl`, `closeSheet()`, `notice(message)`, `downloadText(filename, text)`, `copyText(text) -> Promise`, `longPress(element, selector, handler, delayMs)`. `app.js` : registre `MODULES`, `ctx = { stores, schemas, storage, navigate, notice, today, applyTheme, version, getBundle }`, `applyTheme(pref)`. Une vue est `render(root, ctx)`.
- Conventions DOM que les vues respectent : un curseur émet `input` sur `[data-range=<field>]` et affiche sa valeur dans `[data-out=<field>]` ; des chips portent `[data-chips=<field>]` et `[data-chip=<valeur>|other]` ; le navigateur de jour porte `[data-daynav=-1|1]`.

- [ ] **Step 1 : test des helpers purs**

`tests/core/ui.test.mjs` :

```js
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
```

- [ ] **Step 2 : lancer, échec attendu**

Run: `npm test`
Expected: FAIL, `js/core/ui.js` introuvable.

- [ ] **Step 3 : version.js et ui.js**

`js/version.js` :

```js
// Seul endroit à incrémenter à chaque déploiement : nomme le cache du service worker et s'affiche dans Réglages.
export const APP_VERSION = '1.0.0';
```

`js/core/ui.js` :

```js
// Helpers d'interface. Les constructeurs de HTML sont purs (testés en Node) ;
// les fonctions DOM ne touchent document qu'à l'appel.
import { frLong } from './dates.js';

export function escapeHtml(str) {
  return String(str)
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

// Curseur 0-10 ancré. Vide : « — » affiché, poignée au milieu, rien d'enregistré tant qu'on ne glisse pas.
export function sliderHtml({ field, label, value, anchors, cls = '' }) {
  const v = value ?? null;
  return `<div class="slider" data-slider="${escapeHtml(field)}">
    <div class="srow"><span>${escapeHtml(label)}</span><span class="mono out" data-out="${escapeHtml(field)}">${v === null ? '—' : v}</span></div>
    <div class="slidewrap"><input type="range" class="range ${escapeHtml(cls)}" min="0" max="10" step="1" value="${v === null ? 5 : v}" data-range="${escapeHtml(field)}" aria-label="${escapeHtml(label)}"></div>
    <div class="anchors"><span>${escapeHtml(anchors[0])}</span><span>${escapeHtml(anchors[1])}</span><span>${escapeHtml(anchors[2])}</span></div>
  </div>`;
}

export function chipsHtml({ field, options, value, other = true }) {
  const v = value ?? null;
  const isPreset = options.includes(v);
  const chip = (val, text, on) => `<button type="button" class="chip${on ? ' on' : ''}" data-chip="${escapeHtml(val)}">${escapeHtml(text)}</button>`;
  return `<div class="chips pick" data-chips="${escapeHtml(field)}">${options.map(o => chip(o, o, v === o)).join('')}${other ? chip('other', '…', v !== null && !isPreset) : ''}</div>`;
}

export function dayNavHtml(dayKey, todayKey) {
  return `<div class="daynav">
    <button type="button" data-daynav="-1" aria-label="Jour précédent">‹</button>
    <span>${escapeHtml(frLong(dayKey))}</span>
    <button type="button" data-daynav="1" aria-label="Jour suivant"${dayKey >= todayKey ? ' disabled' : ''}>›</button>
  </div>`;
}

/* ---------- DOM ---------- */
export function closeSheet() { document.querySelector('.sheet-backdrop')?.remove(); }

export function openSheet(innerHtml) {
  closeSheet();
  const backdrop = document.createElement('div');
  backdrop.className = 'sheet-backdrop';
  backdrop.innerHTML = `<div class="sheet" role="dialog">${innerHtml}</div>`;
  backdrop.addEventListener('click', e => { if (e.target === backdrop) closeSheet(); });
  document.body.appendChild(backdrop);
  backdrop.querySelector('input, textarea, select')?.focus();
  return backdrop.firstElementChild;
}

export function notice(message) {
  document.querySelector('.notice')?.remove();
  const el = document.createElement('div');
  el.className = 'notice';
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2500);
}

export function downloadText(filename, text) {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export function copyText(text) {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);
  return new Promise((resolve, reject) => {
    const ta = document.createElement('textarea');
    ta.value = text; document.body.appendChild(ta); ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    ok ? resolve() : reject(new Error('copie impossible'));
  });
}

export function longPress(element, selector, handler, delayMs = 500) {
  let timer = null, target = null;
  const cancel = () => { clearTimeout(timer); timer = null; target = null; };
  element.addEventListener('pointerdown', e => {
    target = e.target.closest(selector);
    if (!target) return;
    timer = setTimeout(() => { const t = target; cancel(); handler(t); }, delayMs);
  });
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave', 'scroll']) element.addEventListener(ev, cancel, { passive: true });
  element.addEventListener('pointermove', e => { if (timer && (Math.abs(e.movementX) > 6 || Math.abs(e.movementY) > 6)) cancel(); });
  element.addEventListener('contextmenu', e => {
    const t = e.target.closest(selector);
    if (t) { e.preventDefault(); cancel(); handler(t); }
  });
}
```

- [ ] **Step 4 : lancer, succès**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5 : style.css**

```css
/* Système commun, hérité de Mind : variables clair/sombre, typographie système, une couleur d'accent. */
:root {
  --bg: #f6f5f2; --fg: #23241f; --muted: #7a7a72; --faint: #a8a79f; --line: #e2e0da;
  --accent: #5b7c99; --accent-soft: #dfe7ee; --card: #ffffff; --card2: #f0efeb;
  --c-clarity: #4f9280; --c-mood: #5b7c99; --c-pleasure: #8b78b8; --c-drive: #c48a2e;
  --nat-contenu: #b5564a; --nat-sans: #c48a2e; --nat-partenaire: #4f8f76;
  --radius: 14px; --pad: 16px;
  font-size: 17px;
}
:root:not([data-theme="light"]) { color-scheme: light dark; }
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --bg: #151515; --fg: #ecebe6; --muted: #9a998f; --faint: #6b6b64; --line: #2a2a2a;
    --accent: #8fb3d9; --accent-soft: #23303b; --card: #1d1d1d; --card2: #262626;
    --c-clarity: #7fb7a3; --c-mood: #8ab4d8; --c-pleasure: #ab96d9; --c-drive: #e09f3e;
    --nat-contenu: #d17b6e; --nat-sans: #e09f3e; --nat-partenaire: #7fb7a3;
  }
}
:root[data-theme="dark"] {
  --bg: #151515; --fg: #ecebe6; --muted: #9a998f; --faint: #6b6b64; --line: #2a2a2a;
  --accent: #8fb3d9; --accent-soft: #23303b; --card: #1d1d1d; --card2: #262626;
  --c-clarity: #7fb7a3; --c-mood: #8ab4d8; --c-pleasure: #ab96d9; --c-drive: #e09f3e;
  --nat-contenu: #d17b6e; --nat-sans: #e09f3e; --nat-partenaire: #7fb7a3;
}

* { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
html, body { margin: 0; background: var(--bg); color: var(--fg); }
body { font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; line-height: 1.5; }
button, input, textarea, select { font: inherit; color: inherit; }
button { background: none; border: 0; padding: 0; cursor: pointer; }
a { color: inherit; text-decoration: none; }
.mono { font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace; }
.hidden { display: none !important; }

/* Coquille */
.topbar { position: sticky; top: 0; z-index: 5; display: flex; justify-content: space-between; align-items: center;
  padding: calc(10px + env(safe-area-inset-top)) var(--pad) 8px; background: var(--bg); }
.topbar-title { font-size: 1.15rem; font-weight: 600; letter-spacing: -0.01em; }
.topbar-btn { font-size: 1.3rem; color: var(--muted); padding: 4px 8px; }
.screen { max-width: 640px; margin: 0 auto; padding: 4px var(--pad) calc(96px + env(safe-area-inset-bottom)); }
.tabbar { position: fixed; left: 0; right: 0; bottom: 0; z-index: 5; display: flex; background: var(--bg); border-top: 1px solid var(--line);
  padding: 6px 4px calc(6px + env(safe-area-inset-bottom)); }
.tabbar button { flex: 1; padding: 8px 0; font-size: 0.8rem; color: var(--muted); border-radius: 10px; white-space: nowrap; }
.tabbar button.on { color: var(--accent); font-weight: 600; background: var(--accent-soft); }
.subtabs { display: flex; gap: 6px; margin: 6px 0 14px; }
.subtabs a { flex: 1; text-align: center; padding: 8px 0; border-radius: 999px; font-size: 0.9rem; color: var(--muted); background: var(--card2); }
.subtabs a.on { background: var(--accent-soft); color: var(--fg); font-weight: 600; }

/* Blocs */
.card { background: var(--card); border: 1px solid var(--line); border-radius: var(--radius); padding: 14px var(--pad); margin-bottom: 10px; }
.card-title { font-weight: 600; margin-bottom: 6px; }
.label, .section-title { font-size: 0.74rem; letter-spacing: 0.1em; text-transform: uppercase; color: var(--muted); margin: 16px 0 8px; font-weight: 500; }
.section { margin-bottom: 28px; }
.srow { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; margin-bottom: 8px; }
.srow.small { margin: 12px 0 2px; }
.tiny { font-size: 0.78rem; color: var(--muted); }
.note { font-size: 0.8rem; color: var(--faint); line-height: 1.5; margin: 8px 0 0; }
.empty { color: var(--muted); font-style: italic; padding: 8px 0; }
.sep { height: 1px; background: var(--line); margin: 14px calc(-1 * var(--pad)) 12px; }
.st { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; font-size: 0.88rem; padding: 5px 0; }
.st .k { color: var(--muted); white-space: nowrap; }
.st .v { text-align: right; }
.stack { display: flex; flex-direction: column; gap: 8px; }
.rowbtns { display: flex; gap: 10px; margin-top: 12px; }
.rowbtns .btn { flex: 1; }
.lg { display: flex; gap: 12px; flex-wrap: wrap; font-size: 0.75rem; color: var(--muted); margin-top: 8px; }
.lg i, .evlist i { display: inline-block; width: 9px; height: 9px; border-radius: 50%; margin-right: 5px; }
.evlist { font-size: 0.85rem; line-height: 1.7; }
.dot { width: 11px; height: 11px; border-radius: 50%; flex: none; }

/* Curseurs : zone tactile large, aucun re-rendu pendant le glissement. */
.slidewrap { padding: 6px 0 2px; touch-action: pan-y; }
input[type=range].range { width: 100%; height: 4px; background: var(--line); border-radius: 2px; -webkit-appearance: none; appearance: none; margin: 0; }
input[type=range].range::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 26px; height: 26px; border-radius: 50%; border: none; background: var(--accent); cursor: pointer; }
input[type=range].range::-moz-range-thumb { width: 26px; height: 26px; border-radius: 50%; border: none; background: var(--accent); cursor: pointer; }
.c-clarity::-webkit-slider-thumb { background: var(--c-clarity); } .c-clarity::-moz-range-thumb { background: var(--c-clarity); }
.c-mood::-webkit-slider-thumb { background: var(--c-mood); } .c-mood::-moz-range-thumb { background: var(--c-mood); }
.c-pleasure::-webkit-slider-thumb { background: var(--c-pleasure); } .c-pleasure::-moz-range-thumb { background: var(--c-pleasure); }
.c-drive::-webkit-slider-thumb { background: var(--c-drive); } .c-drive::-moz-range-thumb { background: var(--c-drive); }
.anchors { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 6px; font-size: 0.72rem; color: var(--faint); line-height: 1.3; margin-top: 4px; }
.anchors span:nth-child(2) { text-align: center; }
.anchors span:nth-child(3) { text-align: right; }
.out { min-width: 1.5em; text-align: right; }

/* Chips, navigateur de jour, heures */
.chips { display: flex; flex-wrap: wrap; gap: 8px; margin: 10px 0 0; }
.chip { padding: 8px 12px; border-radius: 9px; font-size: 0.85rem; background: var(--card2); border: 1px solid var(--line); color: var(--muted); }
.chip.on { background: var(--accent-soft); border-color: var(--accent); color: var(--fg); }
.chips.pick { flex-wrap: nowrap; gap: 6px; }
.chips.pick .chip { flex: 1; padding: 10px 0; text-align: center; }
.chips.win { margin: 0 0 12px; }
.chips.win .chip { flex: 1; text-align: center; }
input[type=date].chip { flex: 1.4; padding: 6px 8px; }
.daynav { display: flex; justify-content: space-between; align-items: center; margin: 4px 0 12px; }
.daynav button { background: var(--card); border: 1px solid var(--line); color: var(--muted); border-radius: 9px; padding: 5px 14px; font-size: 1rem; }
.daynav button:disabled { color: var(--line); }
.daynav span { font-size: 0.92rem; text-transform: capitalize; }
.timerow { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.tf { display: flex; flex-direction: column; gap: 5px; }
.tl { font-size: 0.78rem; color: var(--muted); }
input[type=time], input[type=text], input[type=password], input[type=url], select, textarea {
  background: var(--card2); border: 1px solid var(--line); color: var(--fg); border-radius: 9px; padding: 10px; width: 100%; }
input[type=time] { font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace; font-size: 1rem; }
.field { display: flex; flex-direction: column; gap: 5px; margin-bottom: 12px; }

/* Boutons */
.btn { background: var(--accent); color: #fff; border-radius: 12px; padding: 13px 18px; font-weight: 600; width: 100%; }
.btn:disabled { opacity: 0.4; }
.btn-ghost { background: transparent; border: 1px solid var(--line); color: var(--muted); font-weight: 500; }
.btn-nat { background: var(--card); border: 1px solid var(--line); color: var(--fg); display: flex; justify-content: space-between; align-items: center; text-align: left; font-weight: 500; }
.btn-text { color: var(--accent); padding: 10px 4px; }
.btn-quiet { background: var(--accent-soft); color: var(--fg); border-radius: 999px; padding: 10px 16px; }
.protocol ol { margin: 6px 0 0; padding: 0; list-style: none; color: var(--muted); font-size: 0.92rem; }
.protocol li { margin-bottom: 4px; }

/* Listes (Réglages, Mind) */
.row { display: flex; align-items: center; gap: 12px; width: 100%; text-align: left; padding: 12px 0; border-bottom: 1px solid var(--line); min-height: 52px; }
.row:last-of-type { border-bottom: 0; }
.row-main { flex: 1; min-width: 0; }
.row-title { display: block; overflow-wrap: anywhere; }
.row-sub { display: block; font-size: 0.8rem; color: var(--muted); margin-top: 2px; }
.row-aside { color: var(--muted); font-size: 0.85rem; white-space: nowrap; }
.sheet-tabs { display: flex; gap: 8px; margin-bottom: 12px; }
.sheet-tabs button { flex: 1; padding: 10px; border-radius: 999px; background: var(--card2); color: var(--muted); }
.sheet-tabs button[aria-selected="true"] { background: var(--accent-soft); color: var(--fg); font-weight: 600; }
.sheet-actions { display: flex; justify-content: flex-end; gap: 10px; }
.sheet-actions .btn { width: auto; }

/* Feuille glissante, notice, courbes */
.sheet-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.35); display: flex; align-items: flex-end; z-index: 10; }
.sheet { width: 100%; max-width: 640px; margin: 0 auto; background: var(--card); border-radius: var(--radius) var(--radius) 0 0;
  padding: 18px var(--pad) calc(18px + env(safe-area-inset-bottom)); animation: rise 160ms ease-out; }
@keyframes rise { from { transform: translateY(24px); opacity: 0; } to { transform: none; opacity: 1; } }
.sheet h2 { margin: 0 0 12px; font-size: 1.1rem; }
.sheet textarea, .sheet input[type="text"], .sheet select { margin-bottom: 12px; }
.sheet textarea { min-height: 5em; resize: vertical; }
.menu-list { list-style: none; margin: 0; padding: 0; }
.menu-list button { width: 100%; text-align: left; padding: 14px 4px; border-bottom: 1px solid var(--line); font-size: 1.05rem; }
.menu-list li:last-child button { border-bottom: 0; }
.notice { position: fixed; left: 50%; bottom: calc(80px + env(safe-area-inset-bottom)); transform: translateX(-50%);
  background: var(--fg); color: var(--bg); padding: 10px 18px; border-radius: 999px; font-size: 0.9rem; z-index: 20; max-width: 90vw; text-align: center; }
.spark { width: 100%; height: 56px; display: block; }
.chart-grid { stroke: var(--line); stroke-width: 1; }
.chart-empty { height: 56px; display: flex; align-items: center; font-size: 0.8rem; color: var(--muted); }
```

- [ ] **Step 6 : index.html**

```html
<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="theme-color" content="#f6f5f2" media="(prefers-color-scheme: light)">
  <meta name="theme-color" content="#151515" media="(prefers-color-scheme: dark)">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <title>Moi</title>
  <link rel="manifest" href="./manifest.webmanifest">
  <link rel="icon" href="./icons/icon.svg" type="image/svg+xml">
  <link rel="apple-touch-icon" href="./icons/icon-192.png">
  <link rel="stylesheet" href="./style.css">
</head>
<body>
  <header class="topbar">
    <span class="topbar-title" id="title">Moi</span>
    <button type="button" class="topbar-btn" id="topbtn" aria-label="Réglages">⚙</button>
  </header>
  <main id="view" class="screen" aria-live="polite"></main>
  <nav class="tabbar" id="tabbar"></nav>
  <script type="module" src="./js/app.js"></script>
</body>
</html>
```

- [ ] **Step 7 : app.js**

Les vues Suivi, Pulsion et Réglages arrivent aux tâches 14 à 16 ; d'ici là, un rendu provisoire. Les lignes marquées `// T14`, `// T15`, `// T16` sont remplacées par ces tâches.

```js
import { APP_VERSION } from './version.js';
import { Store } from './core/store.js';
import { onRoute, navigate } from './router.js';
import { today } from './core/dates.js';
import { notice, closeSheet, escapeHtml, downloadText } from './core/ui.js';
import { bundleJson, autoBackup, cloudBackup } from './core/backup.js';
import { hasLegacy, isFresh, migrateLegacy } from './core/migrate-legacy.js';
import { flushDeferred } from './core/defer.js';
import { settingsSchema } from './modules/settings/schema.js';
import { suiviSchema } from './modules/suivi/schema.js';
import { pulsionSchema } from './modules/pulsion/schema.js';
import { testsSchema } from './modules/tests/schema.js';

export const SCHEMAS = { settings: settingsSchema, suivi: suiviSchema, pulsion: pulsionSchema, tests: testsSchema };

const soon = label => (root) => { root.innerHTML = `<p class="empty">${escapeHtml(label)} : bientôt.</p>`; };

// Modules affichables : libellé, stores dont une notification rerend l'écran, vues par nom de route.
const MODULES = {
  suivi: { label: 'Suivi', stores: ['suivi', 'pulsion'], views: { home: soon('Suivi'), data: soon('Données') } },        // T14
  pulsion: { label: 'Pulsion', stores: ['pulsion'], views: { home: soon('Pulsion') } },                                    // T15
  settings: { label: 'Réglages', stores: ['settings', 'suivi', 'pulsion', 'tests'], views: { home: soon('Réglages') } }, // T16
};
const TAB_ORDER = ['suivi', 'pulsion', 'challenge', 'tests', 'mind', 'rappel'].filter(t => MODULES[t]);

export function applyTheme(pref) {
  if (pref === 'system') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = pref;
}

function main() {
  const storage = localStorage;
  const fresh = isFresh(storage, ['moi.suivi', 'moi.pulsion', 'moi.tests']);
  const stores = Object.fromEntries(Object.entries(SCHEMAS).map(([n, s]) => [n, new Store(storage, s)]));
  for (const s of Object.values(stores)) { s.load(); s.onSaveError = notice; }
  const migrated = fresh && hasLegacy(storage) ? migrateLegacy(storage, stores) : [];
  applyTheme(stores.settings.doc.theme);

  const getBundle = () => bundleJson(Object.fromEntries(Object.entries(stores).map(([n, s]) => [n, s.doc])));
  autoBackup({ storage, getJson: getBundle, todayKey: today(), download: downloadText });
  cloudBackup({ storage, getJson: getBundle, todayKey: today() });
  if (navigator.storage?.persist) navigator.storage.persist();

  const view = document.getElementById('view');
  const title = document.getElementById('title');
  const topbtn = document.getElementById('topbtn');
  const tabbar = document.getElementById('tabbar');
  tabbar.innerHTML = TAB_ORDER.map(t => `<button type="button" data-tab="${t}">${escapeHtml(MODULES[t].label)}</button>`).join('');
  tabbar.onclick = e => { const b = e.target.closest('[data-tab]'); if (b) navigate({ tab: b.dataset.tab }); };

  let route = null;
  const ctx = { stores, schemas: SCHEMAS, storage, navigate, notice, today, applyTheme, version: APP_VERSION, getBundle, get route() { return route; } };

  function draw() {
    const mod = MODULES[route.tab];
    const render = mod.views[route.view] ?? mod.views.home;
    const isSettings = route.tab === 'settings';
    title.textContent = mod.label;
    topbtn.textContent = isSettings ? '‹' : '⚙';
    topbtn.setAttribute('aria-label', isSettings ? 'Retour' : 'Réglages');
    tabbar.querySelectorAll('[data-tab]').forEach(b => b.classList.toggle('on', b.dataset.tab === route.tab));
    render(view, ctx);
  }
  topbtn.onclick = () => navigate({ tab: route?.tab === 'settings' ? stores.settings.doc.lastTab : 'settings' });

  onRoute(r => {
    if (!r || !MODULES[r.tab]) {
      const last = stores.settings.doc.lastTab;
      navigate({ tab: MODULES[last] ? last : 'suivi' });
      return;
    }
    flushDeferred();
    route = r;
    closeSheet();
    window.scrollTo(0, 0);
    if (r.tab !== 'settings' && stores.settings.doc.lastTab !== r.tab) stores.settings.commit(d => { d.lastTab = r.tab; }, { notify: false });
    draw();
  });
  for (const [name, s] of Object.entries(stores)) s.subscribe(() => { if (route && MODULES[route.tab].stores.includes(name)) draw(); });

  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flushDeferred(); });
  window.addEventListener('pagehide', flushDeferred);
  if (migrated.length) notice('Données Suivi reprises.');
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js', { type: 'module' }).catch(() => { /* hors ligne indisponible, l'app fonctionne quand même */ });
}

try { main(); } catch (err) {
  console.error(err);
  document.getElementById('view').innerHTML = "<p class=\"empty\">Ce navigateur bloque le stockage local, l'application ne peut pas fonctionner ici.</p>";
}
```

- [ ] **Step 8 : vérification à la main**

Run: `python3 -m http.server 8080` puis ouvrir `http://localhost:8080/` dans un navigateur en mode mobile.
Expected: barre à deux onglets (Suivi, Pulsion), titre, icône Réglages qui bascule vers « Réglages : bientôt » et revient ; l'URL suit (`#/suivi`, `#/settings`) ; le bouton retour du navigateur revient à l'onglet précédent. La console signale seulement l'absence de `sw.js` et du manifest (tâche 17).

- [ ] **Step 9 : commit**

```bash
git add js/version.js js/core/ui.js style.css index.html js/app.js tests/core/ui.test.mjs
git commit -m "Ajoute la coquille : helpers d'interface, styles communs, barre d'onglets, point d'entrée

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 14 : vues Suivi (jour, données)

**Files:**
- Create: `js/modules/suivi/views/day.js`, `js/modules/suivi/views/data.js`
- Modify: `js/app.js` (lignes `// T14`)

**Interfaces:**
- Consumes: `sliderHtml`, `dayNavHtml`, `escapeHtml`, `copyText` (tâche 13) ; `SLIDERS`, `LABELS`, `ANCHORS`, `emptyDay` (tâche 5) ; `durMin`, `stats`, `bilan` (tâche 6) ; `setDayField`, `setDayFieldSoon`, `flushPending` (tâche 6) ; `sparkline` (tâche 10) ; `marks` et `NATURES`, `NATURE_ORDER` de Pulsion (tâches 7-8) ; `addDays`, `hm` ; `pm`, `fmt`.
- Produces: `day.render(root, ctx)`, `data.render(root, ctx)`, `subTabs(current)`.

- [ ] **Step 1 : day.js**

```js
// Saisie du soir : sommeil et quatre curseurs ancrés, un jour à la fois.
import { addDays, hm } from '../../../core/dates.js';
import { sliderHtml, dayNavHtml, escapeHtml } from '../../../core/ui.js';
import { SLIDERS, LABELS, ANCHORS, emptyDay } from '../schema.js';
import { durMin } from '../queries.js';
import { setDayField, setDayFieldSoon, flushPending } from '../ops.js';

let selDay = null; // état d'écran, pas une donnée

export function subTabs(current) {
  return `<div class="subtabs">
    <a href="#/suivi" class="${current === 'home' ? 'on' : ''}">Jour</a>
    <a href="#/suivi/data" class="${current === 'data' ? 'on' : ''}">Données</a>
  </div>`;
}

const dayOf = (store, key) => ({ ...emptyDay(), ...(store.doc.days[key] ?? {}) });

export function render(root, ctx) {
  const t = ctx.today();
  if (!selDay || selDay > t) selDay = t;
  const store = ctx.stores.suivi;
  const day = dayOf(store, selDay);

  root.innerHTML = `
    ${subTabs('home')}
    ${dayNavHtml(selDay, t)}
    <div class="label">Sommeil</div>
    <div class="card">
      <div class="timerow">
        <label class="tf"><span class="tl">Coucher (hier soir)</span><input type="time" data-time="bed" value="${escapeHtml(day.bed ?? '')}"></label>
        <label class="tf"><span class="tl">Lever (ce matin)</span><input type="time" data-time="wake" value="${escapeHtml(day.wake ?? '')}"></label>
      </div>
      <div class="srow small"><span class="tiny">Durée</span><span class="mono" data-out="dur">${hm(durMin(day))}</span></div>
    </div>
    <div class="label">État du jour</div>
    ${SLIDERS.map(f => `<div class="card">${sliderHtml({ field: f, label: LABELS[f], value: day[f], anchors: ANCHORS[f], cls: `c-${f}` })}</div>`).join('')}
  `;

  root.onclick = e => {
    const nav = e.target.closest('[data-daynav]');
    if (!nav || nav.disabled) return;
    flushPending();
    const next = addDays(selDay, Number(nav.dataset.daynav));
    if (next <= t) { selDay = next; render(root, ctx); }
  };
  root.oninput = e => {
    const r = e.target.closest('[data-range]');
    if (!r) return;
    const v = Number(r.value);
    setDayFieldSoon(store, selDay, r.dataset.range, v);
    root.querySelector(`[data-out="${r.dataset.range}"]`).textContent = v;
  };
  root.onchange = e => {
    if (e.target.closest('[data-range]')) { flushPending(); return; }
    const ti = e.target.closest('[data-time]');
    if (!ti) return;
    try { setDayField(store, selDay, ti.dataset.time, ti.value || null); } catch (err) { ctx.notice(err.message); }
    root.querySelector('[data-out="dur"]').textContent = hm(durMin(dayOf(store, selDay)));
  };
}
```

- [ ] **Step 2 : data.js**

```js
// Données Suivi : bloc 7 jours, quatre sparklines avec repères d'actes (lecture seule de Pulsion), bilan copiable.
import { hm } from '../../../core/dates.js';
import { pm, fmt } from '../../../core/stats.js';
import { sparkline } from '../../../core/chart.js';
import { escapeHtml, copyText } from '../../../core/ui.js';
import { SLIDERS, LABELS } from '../schema.js';
import { stats, bilan } from '../queries.js';
import { marks } from '../../pulsion/queries.js';
import { NATURES, NATURE_ORDER } from '../../pulsion/schema.js';
import { subTabs } from './day.js';

let win = 14; // état d'écran
const COLORS = { clarity: 'var(--c-clarity)', mood: 'var(--c-mood)', pleasure: 'var(--c-pleasure)', drive: 'var(--c-drive)' };

export function eventMarks(keys, byDay) {
  return keys.map((k, i) => (byDay[k] ? { i, color: NATURES[byDay[k]].css } : null)).filter(Boolean);
}

export function render(root, ctx) {
  const t = ctx.today();
  const doc = ctx.stores.suivi.doc;
  const s7 = stats(doc, 7, t);
  const s = stats(doc, win, t);
  const mk = eventMarks(s.keys, marks(ctx.stores.pulsion.doc));
  const st = (k, v) => `<div class="st"><span class="k">${k}</span><span class="v mono">${v}</span></div>`;
  const dur = s7.dur.m == null ? '—' : hm(s7.dur.m) + (s7.dur.sd == null ? '' : ` ± ${Math.round(s7.dur.sd)} min`);
  const reg = s7.bedSD == null ? '—' : `± ${Math.round(s7.bedSD)} min`;

  root.innerHTML = `
    ${subTabs('data')}
    <div class="card">
      ${st('7 derniers jours', `${s7.logged}/7 jours loggés`)}
      ${st('Sommeil', `${s7.nights} nuits · ${dur}<br>coucher ${reg}`)}
      ${SLIDERS.map(f => st(LABELS[f], `${pm(s7.packs[f].m, s7.packs[f].sd, '/10')} · var ${fmt(s7.packs[f].v)}`)).join('')}
    </div>
    <div class="card">
      <div class="chips win">${[14, 30, 90].map(n => `<button type="button" class="chip${win === n ? ' on' : ''}" data-win="${n}">${n} j</button>`).join('')}</div>
      ${SLIDERS.map((f, i) => `${i ? '<div class="sep"></div>' : ''}
        <div class="srow small"><span class="tiny">${LABELS[f]}</span><span class="mono tiny" style="color:${COLORS[f]}">${pm(s.packs[f].m, s.packs[f].sd, '/10')} · var ${fmt(s.packs[f].v)}</span></div>
        ${sparkline({ values: s.series[f], color: COLORS[f], marks: mk })}`).join('')}
      <p class="note">± = dispersion. « var » = variation moyenne d'un jour au suivant : c'est elle qui mesure la stabilité, pas la moyenne.</p>
      <div class="lg">${NATURE_ORDER.map(n => `<span><i style="background:${NATURES[n].css}"></i>${escapeHtml(NATURES[n].label)}</span>`).join('')}</div>
    </div>
    <div class="card"><button type="button" class="btn" data-copy>Copier le bilan hebdo</button></div>
  `;

  root.onclick = e => {
    const w = e.target.closest('[data-win]');
    if (w) { win = Number(w.dataset.win); render(root, ctx); return; }
    if (e.target.closest('[data-copy]')) {
      copyText(bilan(doc, t)).then(() => ctx.notice('Bilan copié.')).catch(() => ctx.notice('Copie impossible.'));
    }
  };
}
```

- [ ] **Step 3 : brancher dans app.js**

Ajouter les imports après celui de `testsSchema` :

```js
import * as suiviDay from './modules/suivi/views/day.js';
import * as suiviData from './modules/suivi/views/data.js';
```

Remplacer la ligne `// T14` par :

```js
  suivi: { label: 'Suivi', stores: ['suivi', 'pulsion'], views: { home: suiviDay.render, data: suiviData.render } },
```

- [ ] **Step 4 : vérification à la main**

Run: `npm test` (tout passe) puis `python3 -m http.server 8080`.
Expected : sur `#/suivi`, les heures et les quatre curseurs s'enregistrent (recharger la page les retrouve), le glissement ne saute pas, le jour précédent est navigable, le jour suivant est bloqué sur aujourd'hui. Sur `#/suivi/data`, le bloc 7 jours reflète les saisies, les courbes se dessinent, « Copier le bilan hebdo » met sept lignes dans le presse-papier. Mettre l'onglet en arrière-plan juste après un glissement puis recharger : la valeur est là.

- [ ] **Step 5 : commit**

```bash
git add js/modules/suivi/views js/app.js
git commit -m "Ajoute les écrans Suivi : saisie du jour et données

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 15 : vue Pulsion

**Files:**
- Create: `js/modules/pulsion/views/home.js`
- Modify: `js/app.js` (ligne `// T15`)

**Interfaces:**
- Consumes: tâches 7, 8, 10, 13 ; `eventMarks` (tâche 14) ; `addDays`, `frShort`, `hhmm` ; `pm`, `fmt`.
- Produces: `render(root, ctx)`.

- [ ] **Step 1 : home.js**

```js
// Pulsion : protocole, pression et checks du jour, enregistrement d'un acte daté, données du module.
import { addDays, frShort, hhmm } from '../../../core/dates.js';
import { pm, fmt } from '../../../core/stats.js';
import { sparkline } from '../../../core/chart.js';
import { sliderHtml, chipsHtml, dayNavHtml, escapeHtml, copyText } from '../../../core/ui.js';
import { NATURES, NATURE_ORDER, TRIGGERS, CHECK_PRESETS, URGE_ANCHORS, emptyDay } from '../schema.js';
import { stats, marks, lastEvents, bilan } from '../queries.js';
import { setDayField, setDayFieldSoon, addEvent } from '../ops.js';
import { eventMarks } from '../../suivi/views/data.js';

// État d'écran : jour sélectionné, fenêtre des courbes, acte en cours de saisie.
let selDay = null;
let win = 14;
let draft = null; // { nature, trigger, day }

const dayOf = (store, key) => ({ ...emptyDay(), ...(store.doc.days[key] ?? {}) });
const st = (k, v) => `<div class="st"><span class="k">${k}</span><span class="v mono">${v}</span></div>`;

function draftHtml(t) {
  if (!draft) {
    return `<div class="stack">${NATURE_ORDER.map(n => `<button type="button" class="btn btn-nat" data-nature="${n}">
      <span>${escapeHtml(NATURES[n].label)}</span><span class="dot" style="background:${NATURES[n].css}"></span></button>`).join('')}</div>`;
  }
  const needTrigger = draft.nature !== 'partenaire';
  const yesterday = addDays(t, -1);
  return `<div class="card">
    <div class="srow"><span>${escapeHtml(NATURES[draft.nature].label)}</span><span class="dot" style="background:${NATURES[draft.nature].css}"></span></div>
    ${needTrigger ? `<div class="tiny">Déclencheur principal ?</div>
      <div class="chips">${TRIGGERS.map(tr => `<button type="button" class="chip${draft.trigger === tr ? ' on' : ''}" data-trigger="${escapeHtml(tr)}">${escapeHtml(tr)}</button>`).join('')}</div>` : ''}
    <div class="tiny" style="margin-top:12px">Quel jour ?</div>
    <div class="chips pick">
      <button type="button" class="chip${draft.day === t ? ' on' : ''}" data-day="${t}">Aujourd'hui</button>
      <button type="button" class="chip${draft.day === yesterday ? ' on' : ''}" data-day="${yesterday}">Hier</button>
      <input type="date" class="chip${draft.day !== t && draft.day !== yesterday ? ' on' : ''}" data-day-input max="${t}" value="${draft.day}" aria-label="Autre date">
    </div>
    <div class="rowbtns">
      <button type="button" class="btn" data-save${needTrigger && !draft.trigger ? ' disabled' : ''}>Enregistrer</button>
      <button type="button" class="btn btn-ghost" data-cancel>Annuler</button>
    </div>
  </div>`;
}

function evList(doc) {
  const a = lastEvents(doc, 8);
  if (!a.length) return '<span class="tiny">aucun</span>';
  return a.map(e => `<i style="background:${NATURES[e.nature].css}"></i>${frShort(e.day)} <span class="tiny">${escapeHtml(NATURES[e.nature].label.toLowerCase())}${e.trigger ? ' · ' + escapeHtml(e.trigger.toLowerCase()) : ''} · saisi ${frShort(e.ts.slice(0, 10))} ${hhmm(e.ts)}</span>`).join('<br>');
}

export function render(root, ctx) {
  const t = ctx.today();
  if (!selDay || selDay > t) selDay = t;
  const store = ctx.stores.pulsion;
  const doc = store.doc;
  const day = dayOf(store, selDay);
  const s7 = stats(doc, 7, t);
  const s = stats(doc, win, t);
  const mk = eventMarks(s.keys, marks(doc));

  root.innerHTML = `
    <div class="card protocol">
      <div class="card-title">Protocole 10 minutes</div>
      <ol>
        <li>1. Pas d'interdiction : tu décides dans 10 min, pas maintenant.</li>
        <li>2. Une action physique tout de suite : sortir marcher, pompes, douche, atelier.</li>
        <li>3. S'il y a acte, tu le logges ci-dessous. Sinon, rien à faire.</li>
      </ol>
      <p class="note">« Contenu » = tout support pornographique ou érotique, quel que soit le site, l'app ou le format (vidéo, images, reddit, réseaux). Définition fixée à froid — pas renégociable sur le moment.</p>
    </div>

    <div class="label">Aujourd'hui</div>
    ${dayNavHtml(selDay, t)}
    <div class="card">${sliderHtml({ field: 'urge', label: "Pression de l'envie", value: day.urge, anchors: URGE_ANCHORS })}</div>
    <div class="card">
      <div class="srow"><span>Checks — contenu vu, sans acte</span><span class="mono" data-out="checksMin">${day.checksMin == null ? '—' : day.checksMin + ' min'}</span></div>
      ${chipsHtml({ field: 'checksMin', options: CHECK_PRESETS, value: day.checksMin })}
    </div>

    <div class="label">Enregistrer un acte</div>
    ${draftHtml(t)}
    <p class="note">Aucun compteur, aucune remise à zéro : on enregistre une date et une nature, rien d'autre. Ce qui compte se lit sur les courbes, dans les jours qui suivent.</p>

    <div class="label">Données</div>
    <div class="card">
      <div class="chips win">${[14, 30, 90].map(n => `<button type="button" class="chip${win === n ? ' on' : ''}" data-win="${n}">${n} j</button>`).join('')}</div>
      <div class="srow small"><span class="tiny">Pression de l'envie</span><span class="mono tiny">${pm(s.urge.m, s.urge.sd, '/10')} · var ${fmt(s.urge.v)}</span></div>
      ${sparkline({ values: s.series.urge, color: 'var(--accent)', marks: mk })}
      <div class="lg">${NATURE_ORDER.map(n => `<span><i style="background:${NATURES[n].css}"></i>${escapeHtml(NATURES[n].label)}</span>`).join('')}</div>
    </div>
    <div class="card">
      ${st('7 derniers jours', `pression ${pm(s7.urge.m, s7.urge.sd, '/10')} · soirs ≥4 : ${s7.evenings4}`)}
      ${st('Checks', `${s7.checksVol} min · ${s7.checksDays} j`)}
      ${NATURE_ORDER.map(n => st(escapeHtml(NATURES[n].label), s7.byNature[n].length
        ? s7.byNature[n].map(e => frShort(e.day) + (e.trigger ? ' · ' + escapeHtml(e.trigger.toLowerCase()) : '')).join('<br>') : '—')).join('')}
    </div>
    <div class="card">
      <div class="tiny" style="margin-bottom:6px">Derniers actes</div>
      <div class="evlist">${evList(doc)}</div>
    </div>
    <div class="card"><button type="button" class="btn" data-copy>Copier le bilan pulsion</button></div>
  `;

  root.onclick = e => {
    const nav = e.target.closest('[data-daynav]');
    if (nav) { if (!nav.disabled) { const next = addDays(selDay, Number(nav.dataset.daynav)); if (next <= t) { selDay = next; render(root, ctx); } } return; }
    const chip = e.target.closest('[data-chips="checksMin"] [data-chip]');
    if (chip) {
      let v = chip.dataset.chip;
      if (v === 'other') { const r = prompt('Durée en minutes ?', day.checksMin ?? ''); if (r === null) return; v = r; }
      const n = parseInt(v, 10);
      if (!Number.isInteger(n) || n < 0 || n > 1440) { ctx.notice('Durée invalide.'); return; }
      setDayField(store, selDay, 'checksMin', n);
      return render(root, ctx);
    }
    const nat = e.target.closest('[data-nature]');
    if (nat) { draft = { nature: nat.dataset.nature, trigger: null, day: t }; return render(root, ctx); }
    const trig = e.target.closest('[data-trigger]');
    if (trig) { draft.trigger = trig.dataset.trigger; return render(root, ctx); }
    const dayBtn = e.target.closest('[data-day]');
    if (dayBtn) { draft.day = dayBtn.dataset.day; return render(root, ctx); }
    if (e.target.closest('[data-cancel]')) { draft = null; return render(root, ctx); }
    if (e.target.closest('[data-save]')) {
      try {
        const ev = addEvent(store, draft, t);
        draft = null;
        ctx.notice(ev.nature === 'contenu'
          ? 'Enregistré comme donnée. Pas de procès. Prochaine action : protéger le sommeil de ce soir — coucher à l\'heure prévue, téléphone hors chambre.'
          : 'Enregistré.');
      } catch (err) { ctx.notice(err.message); }
      return; // le store notifie, l'écran se rerend
    }
    const w = e.target.closest('[data-win]');
    if (w) { win = Number(w.dataset.win); return render(root, ctx); }
    if (e.target.closest('[data-copy]')) copyText(bilan(doc, t)).then(() => ctx.notice('Bilan copié.')).catch(() => ctx.notice('Copie impossible.'));
  };
  root.oninput = e => {
    const r = e.target.closest('[data-range]');
    if (!r) return;
    const v = Number(r.value);
    setDayFieldSoon(store, selDay, 'urge', v);
    root.querySelector('[data-out="urge"]').textContent = v;
  };
  root.onchange = e => {
    const d = e.target.closest('[data-day-input]');
    if (d && d.value && d.value <= t) { draft.day = d.value; render(root, ctx); }
  };
}
```

- [ ] **Step 2 : brancher dans app.js**

Ajouter l'import :

```js
import * as pulsionHome from './modules/pulsion/views/home.js';
```

Remplacer la ligne `// T15` par :

```js
  pulsion: { label: 'Pulsion', stores: ['pulsion'], views: { home: pulsionHome.render } },
```

- [ ] **Step 3 : vérification à la main**

Run: `npm test` puis `python3 -m http.server 8080`.
Expected : curseur de pression et chips de checks persistants ; choisir « Seul, avec contenu » demande un déclencheur puis un jour ; « Enregistrer » est grisé sans déclencheur ; « Hier » et une date passée sont acceptés, une date future est impossible ; « Avec partenaire » ne demande pas de déclencheur ; l'acte apparaît dans « Derniers actes » avec son jour et son heure de saisie, et comme repère coloré sur la courbe de Pulsion et sur celles de `#/suivi/data`.

- [ ] **Step 4 : commit**

```bash
git add js/modules/pulsion/views js/app.js
git commit -m "Ajoute l'écran Pulsion : protocole, pression, checks, actes datés, données

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 16 : vue Réglages

**Files:**
- Create: `js/modules/settings/views/home.js`
- Modify: `js/app.js` (ligne `// T16`)

**Interfaces:**
- Consumes: `THEMES` (tâche 4), `PRESETS` (tâche 4), backup (tâche 11), migrate-legacy (tâche 9), `ctx.getBundle`, `ctx.applyTheme`, `ctx.schemas`, `ctx.storage`, `ctx.version` (tâche 13).
- Produces: `render(root, ctx)`. Les plans suivants ajoutent leurs modules à `MODULE_LABELS` et, pour Mind, une section « Sujets posés » sous la section Données.

- [ ] **Step 1 : home.js**

```js
// Réglages : apparence, fournisseur LLM, export/import par module, backup, reprise des anciennes données, données illisibles.
import { escapeHtml, downloadText } from '../../../core/ui.js';
import { moduleExportJson, moduleExportFilename, parseModuleExport, parseBundle, cloudBackup, cloudRestore, cloudStatus } from '../../../core/backup.js';
import { hasLegacy, migrateLegacy } from '../../../core/migrate-legacy.js';
import { THEMES } from '../schema.js';
import { PRESETS } from '../../rappel/presets.js';

export const MODULE_LABELS = { suivi: 'Suivi', pulsion: 'Pulsion', challenge: 'Challenge', tests: 'Tests', mind: 'Mind', rappel: 'Rappel' };
const THEME_LABELS = { system: 'Système', light: 'Clair', dark: 'Sombre' };

const rowBtn = (attr, title, sub) => `<button type="button" class="row" ${attr}>
  <span class="row-main"><span class="row-title">${title}</span><span class="row-sub">${sub}</span></span></button>`;

export function render(root, ctx) {
  const { stores, schemas, storage } = ctx;
  const settings = stores.settings.doc;
  const llm = settings.llm;
  const preset = PRESETS[llm.provider];
  const dataModules = Object.keys(MODULE_LABELS).filter(m => stores[m]);
  const corrupt = Object.entries(stores).filter(([, s]) => s.corrupt);

  root.innerHTML = `
    <section class="section">
      <h2 class="section-title">Apparence</h2>
      <div class="sheet-tabs">${THEMES.map(k => `<button type="button" data-theme-pref="${k}" aria-selected="${k === settings.theme}">${THEME_LABELS[k]}</button>`).join('')}</div>
    </section>

    <section class="section">
      <h2 class="section-title">Fournisseur LLM</h2>
      <form id="llm">
        <label class="field"><span class="tl">Fournisseur</span>
          <select name="provider">${Object.entries(PRESETS).map(([k, v]) => `<option value="${k}"${k === llm.provider ? ' selected' : ''}>${escapeHtml(v.label)}</option>`).join('')}</select></label>
        <label class="field"><span class="tl">Clé API</span>
          <input type="password" name="apiKey" value="${escapeHtml(llm.apiKey)}" placeholder="${preset.keyUrl ? 'À créer sur ' + escapeHtml(preset.keyUrl) : 'Ta clé API'}" autocomplete="off"></label>
        <label class="field"><span class="tl">Modèle</span>
          <input type="text" name="model" value="${escapeHtml(llm.model)}" placeholder="${escapeHtml(preset.defaultModel || 'nom-du-modele')}" autocomplete="off"></label>
        <label class="field${llm.provider === 'custom' ? '' : ' hidden'}" data-baseurl><span class="tl">URL de base (endpoint OpenAI-compatible)</span>
          <input type="url" name="baseUrl" value="${escapeHtml(llm.baseUrl)}" placeholder="https://exemple.com/v1"></label>
        <p class="note">La clé reste dans le stockage local de cet appareil. Elle n'est envoyée qu'au fournisseur choisi, jamais ailleurs, et n'entre dans aucun backup.</p>
        <div class="sheet-actions"><button type="submit" class="btn">Enregistrer</button></div>
      </form>
    </section>

    <section class="section">
      <h2 class="section-title">Données</h2>
      ${dataModules.map(m => `<div class="row">
        <span class="row-main"><span class="row-title">${MODULE_LABELS[m]}</span></span>
        <button type="button" class="btn-text" data-export="${m}">Exporter</button>
        <button type="button" class="btn-text" data-import="${m}">Importer</button>
      </div>`).join('')}
      <input type="file" accept="application/json,.json" hidden>
    </section>

    <section class="section">
      <h2 class="section-title">Backup</h2>
      ${rowBtn('data-cloud-setup', 'Configurer le cloud', 'Backup chiffré quotidien vers un Gist privé')}
      ${rowBtn('data-cloud-restore', 'Restaurer depuis le cloud', 'Remplace tous les modules par le dernier backup')}
      ${rowBtn('data-bundle', 'Télécharger le bundle complet', 'Tous les modules, sans la clé API')}
      <p class="empty">${escapeHtml(cloudStatus(storage))}</p>
    </section>

    ${hasLegacy(storage) ? `<section class="section">
      <h2 class="section-title">Ancienne app Suivi</h2>
      ${rowBtn('data-legacy', 'Reprendre les données Suivi', 'Remplace Suivi, Pulsion et Tests par les anciennes données')}
    </section>` : ''}

    ${corrupt.length ? `<section class="section">
      <h2 class="section-title">Données illisibles</h2>
      ${corrupt.map(([n]) => `<div class="row">
        <span class="row-main"><span class="row-title">${MODULE_LABELS[n] ?? n}</span><span class="row-sub">Document mis de côté au démarrage</span></span>
        <button type="button" class="btn-text" data-recover="${n}">Télécharger</button>
        <button type="button" class="btn-text" data-forget="${n}">Oublier</button>
      </div>`).join('')}
    </section>` : ''}

    <p class="empty">Moi ${escapeHtml(ctx.version)}</p>
  `;

  const form = root.querySelector('#llm');
  form.provider.onchange = () => {
    const p = PRESETS[form.provider.value];
    form.model.value = p.defaultModel;
    form.model.placeholder = p.defaultModel || 'nom-du-modele';
    form.apiKey.placeholder = p.keyUrl ? `À créer sur ${p.keyUrl}` : 'Ta clé API';
    root.querySelector('[data-baseurl]').classList.toggle('hidden', form.provider.value !== 'custom');
  };
  form.onsubmit = e => {
    e.preventDefault();
    const fd = new FormData(form);
    stores.settings.commit(d => {
      d.llm = { provider: fd.get('provider'), apiKey: fd.get('apiKey').trim(), model: fd.get('model').trim(), baseUrl: fd.get('baseUrl').trim() };
    });
    ctx.notice('Enregistré.');
  };

  const fileInput = root.querySelector('input[type="file"]');
  let importTarget = null;
  fileInput.onchange = async () => {
    const file = fileInput.files?.[0];
    fileInput.value = '';
    if (!file || !importTarget) return;
    const m = importTarget;
    try {
      const doc = parseModuleExport(m, await file.text());
      const v = schemas[m].validate(doc);
      if (!v.ok) throw new Error(v.error);
      if (!confirm(`Remplacer toutes les données de ${MODULE_LABELS[m]} par ce fichier ?`)) return;
      stores[m].replace(doc);
      ctx.notice(`${MODULE_LABELS[m]} importé.`);
    } catch (err) { ctx.notice(err.message); }
  };

  async function restoreCloud() {
    if (!confirm('Restaurer depuis le cloud ? Les données actuelles de tous les modules seront remplacées.')) return;
    try {
      const text = await cloudRestore({ storage, ask: m => prompt(m) });
      const { modules, exportedAt } = parseBundle(text, schemas);
      const apiKey = stores.settings.doc.llm.apiKey;
      for (const [name, doc] of Object.entries(modules)) {
        if (name === 'settings') doc.llm.apiKey = apiKey; // la clé locale est conservée
        stores[name].replace(doc);
      }
      ctx.notice(`Restauré depuis le cloud (${(exportedAt || '').slice(0, 10)}).`);
      setTimeout(() => location.reload(), 800);
    } catch (err) { ctx.notice(`Restauration échouée : ${err.message}`); }
  }

  root.onclick = e => {
    const pref = e.target.closest('[data-theme-pref]');
    if (pref) { const k = pref.dataset.themePref; stores.settings.commit(d => { d.theme = k; }); ctx.applyTheme(k); return; }
    const ex = e.target.closest('[data-export]');
    if (ex) { const m = ex.dataset.export; return downloadText(moduleExportFilename(m, ctx.today()), moduleExportJson(m, stores[m].doc)); }
    const im = e.target.closest('[data-import]');
    if (im) { importTarget = im.dataset.import; return fileInput.click(); }
    if (e.target.closest('[data-cloud-setup]')) {
      return void cloudBackup({ storage, getJson: ctx.getBundle, todayKey: ctx.today(), ask: m => prompt(m), force: true })
        .then(r => { ctx.notice(r === 'ok' ? 'Cloud configuré — backup poussé.' : `Cloud : ${r}`); stores.settings.commit(() => {}); });
    }
    if (e.target.closest('[data-cloud-restore]')) return void restoreCloud();
    if (e.target.closest('[data-bundle]')) return downloadText(`moi_${ctx.today()}.json`, ctx.getBundle());
    if (e.target.closest('[data-legacy]')) {
      if (!confirm('Remplacer Suivi, Pulsion et Tests par les anciennes données ?')) return;
      const done = migrateLegacy(storage, stores);
      return ctx.notice(done.length ? 'Données Suivi reprises.' : 'Rien à reprendre.');
    }
    const rec = e.target.closest('[data-recover]');
    if (rec) return downloadText(`moi-${rec.dataset.recover}-illisible.json`, stores[rec.dataset.recover].corrupt);
    const forget = e.target.closest('[data-forget]');
    if (forget && confirm('Oublier définitivement ces données illisibles ?')) { stores[forget.dataset.forget].clearCorrupt(); ctx.notice('Oublié.'); }
  };
}
```

Note : `stores.settings.commit(() => {})` après le push cloud sert seulement à rerendre l'écran pour rafraîchir l'état affiché.

- [ ] **Step 2 : brancher dans app.js**

Ajouter l'import :

```js
import * as settingsHome from './modules/settings/views/home.js';
```

Remplacer la ligne `// T16` par :

```js
  settings: { label: 'Réglages', stores: ['settings', 'suivi', 'pulsion', 'tests'], views: { home: settingsHome.render } },
```

Supprimer la constante `soon` devenue inutile.

- [ ] **Step 3 : vérification à la main**

Run: `npm test` puis `python3 -m http.server 8080`.
Expected : les trois thèmes s'appliquent tout de suite et survivent au rechargement ; le formulaire LLM se sauvegarde, la sélection « Autre » révèle l'URL de base ; Exporter Suivi télécharge `moi-suivi-<date>.json` ; Importer ce fichier dans Pulsion est refusé avec « Ce fichier n'est pas un export pulsion. », dans Suivi il demande confirmation puis remplace ; le bundle se télécharge sans clé API ; Configurer le cloud demande token et passphrase puis pousse (vérifier le fichier `moi.enc.json` dans le Gist) ; Restaurer remplace tout et recharge. Pour la reprise : dans la console, `localStorage.setItem('suivi_v1', JSON.stringify({days:{'2026-09-20':{mood:6,urge:3}},events:[]}))`, recharger, la section « Ancienne app Suivi » apparaît et le bouton reprend les données.

- [ ] **Step 4 : commit**

```bash
git add js/modules/settings/views js/app.js
git commit -m "Ajoute l'écran Réglages : apparence, LLM, exports, backup, reprise, données illisibles

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 17 : PWA, icônes, README, déploiement

**Files:**
- Create: `manifest.webmanifest`, `sw.js`, `tools/make-icons.mjs`, `icons/icon.svg`, `icons/icon-192.png`, `icons/icon-512.png`, `README.md`, `.nojekyll`

**Interfaces:**
- Consumes: `APP_VERSION` (tâche 13).

- [ ] **Step 1 : manifest**

`manifest.webmanifest` :

```json
{
  "name": "Moi",
  "short_name": "Moi",
  "description": "Suivi, pulsion, challenge, tests, esprit, rappel : des instruments, pas des compteurs.",
  "lang": "fr",
  "start_url": "./",
  "scope": "./",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#f6f5f2",
  "theme_color": "#5b7c99",
  "icons": [
    { "src": "./icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "./icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },
    { "src": "./icons/icon.svg", "sizes": "any", "type": "image/svg+xml" }
  ]
}
```

- [ ] **Step 2 : service worker en module**

`sw.js` :

```js
// Precache + cache d'abord, rafraîchissement en arrière-plan. Le nom du cache vient de APP_VERSION :
// incrémenter js/version.js à chaque déploiement, sinon l'ancienne version reste servie.
import { APP_VERSION } from './js/version.js';

const CACHE_NAME = `moi-${APP_VERSION}`;
const ASSETS = [
  './', './index.html', './style.css', './manifest.webmanifest',
  './js/version.js', './js/app.js', './js/router.js',
  './js/core/dates.js', './js/core/stats.js', './js/core/store.js', './js/core/chart.js', './js/core/backup.js',
  './js/core/migrate-legacy.js', './js/core/ui.js', './js/core/defer.js',
  './js/modules/settings/schema.js', './js/modules/settings/views/home.js', './js/modules/rappel/presets.js',
  './js/modules/suivi/schema.js', './js/modules/suivi/queries.js', './js/modules/suivi/ops.js',
  './js/modules/suivi/views/day.js', './js/modules/suivi/views/data.js',
  './js/modules/pulsion/schema.js', './js/modules/pulsion/queries.js', './js/modules/pulsion/ops.js', './js/modules/pulsion/views/home.js',
  './js/modules/tests/schema.js',
  './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    caches.match(e.request).then(cached => {
      const fresh = fetch(e.request).then(res => {
        if (res.ok) caches.open(CACHE_NAME).then(c => c.put(e.request, res.clone()));
        return res;
      }).catch(() => cached ?? Response.error());
      return cached || fresh;
    })
  );
});
```

Chaque plan suivant ajoute ses fichiers à `ASSETS`.

- [ ] **Step 3 : icônes**

`icons/icon.svg` :

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect width="100" height="100" rx="22" fill="#5b7c99"/>
  <circle cx="50" cy="38" r="9" fill="#fff"/>
  <path d="M28 76c0-13 10-22 22-22s22 9 22 22" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round"/>
</svg>
```

`tools/make-icons.mjs` (encodeur PNG minimal, aucune dépendance) :

```js
// Génère icons/icon-192.png et icons/icon-512.png : fond arrondi, une tête et des épaules.
// Usage : node tools/make-icons.mjs
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';

const BG = [0x5b, 0x7c, 0x99];
const FG = [0xff, 0xff, 0xff];

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

function render(size) {
  const px = Buffer.alloc(size * size * 4, 0);
  const r = size * 0.22;
  const inRounded = (x, y) => {
    const cx = Math.min(Math.max(x, r), size - r), cy = Math.min(Math.max(y, r), size - r);
    return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
  };
  const head = (x, y) => (x - 0.5 * size) ** 2 + (y - 0.38 * size) ** 2 <= (0.09 * size) ** 2;
  // Épaules : arc de cercle centré sous le bord, épais de 7 %, coupé sous 76 % de hauteur.
  const shoulders = (x, y) => {
    const d = Math.sqrt((x - 0.5 * size) ** 2 + (y - 0.76 * size) ** 2);
    return y <= 0.76 * size && Math.abs(d - 0.22 * size) <= 0.035 * size;
  };
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = (y * size + x) * 4;
    if (!inRounded(x + 0.5, y + 0.5)) continue;
    const fg = head(x + 0.5, y + 0.5) || shoulders(x + 0.5, y + 0.5);
    const [R, G, B] = fg ? FG : BG;
    px[i] = R; px[i + 1] = G; px[i + 2] = B; px[i + 3] = 255;
  }
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) { raw[y * (size * 4 + 1)] = 0; px.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4); }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
  ]);
}

mkdirSync('icons', { recursive: true });
for (const s of [192, 512]) writeFileSync(`icons/icon-${s}.png`, render(s));
console.log('icons/icon-192.png et icons/icon-512.png générés');
```

Run: `node tools/make-icons.mjs`
Expected: deux PNG créés, ouvrables dans un navigateur.

- [ ] **Step 4 : README et .nojekyll**

`.nojekyll` : fichier vide.

`README.md` :

```markdown
# Moi

Une application personnelle, téléphone uniquement, qui regroupe des instruments indépendants :
Suivi (sommeil et état du jour), Pulsion (protocole et actes), et bientôt Challenge, Tests, Mind, Rappel.
Rien ne quitte le téléphone, hormis le backup chiffré vers un Gist privé et, pour Rappel, les appels au fournisseur LLM choisi.

Design : `docs/superpowers/specs/2026-09-28-moi-fusion-design.md`

## Utiliser

Ouvrir https://elboudah.github.io/moi/ sur le téléphone, puis « Ajouter à l'écran d'accueil ».
Au premier lancement sur un téléphone qui avait l'ancienne app Suivi, ses données sont reprises automatiquement.

## Développer

Aucune dépendance. Servir le dossier :

    python3 -m http.server 8080

Tests (Node 24) :

    npm test

## Déployer

Le site est servi par GitHub Pages depuis la racine de la branche `main`.
À chaque changement de fichier servi : incrémenter `APP_VERSION` dans `js/version.js`, ajouter les nouveaux fichiers à `ASSETS` dans `sw.js`, `npm test`, commit, push.

## Sauvegarder ses données

Réglages → Données : un export par module, réimportable dans le même module.
Réglages → Backup : bundle complet téléchargeable ; push quotidien chiffré vers le Gist configuré ; restauration depuis le cloud.
Un fichier `moi_AAAA-MM-JJ.json` est aussi déposé dans Téléchargements au premier lancement de chaque jour.
La clé API LLM n'entre dans aucun backup.
```

- [ ] **Step 5 : vérification à la main**

Run: `npm test` puis `python3 -m http.server 8080`.
Expected : plus aucune erreur console ; l'onglet Application des outils de développement montre le manifest et un service worker actif avec le cache `moi-1.0.0` ; en coupant le réseau, la page se recharge et fonctionne.

- [ ] **Step 6 : commit, dépôt distant, Pages**

```bash
git add manifest.webmanifest sw.js tools icons README.md .nojekyll
git commit -m "Ajoute le manifest, le service worker, les icônes et le README

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

Puis, à faire par Noah (actions externes) : créer le dépôt public `ElBoudah/moi` sur GitHub, `git remote add origin https://github.com/ElBoudah/moi.git`, `git push -u origin main`, Settings → Pages → Deploy from a branch → main / root. Ouvrir https://elboudah.github.io/moi/ sur le téléphone : la notice « Données Suivi reprises » doit apparaître au premier lancement, et `#/suivi/data` doit montrer l'historique de l'ancienne app.
