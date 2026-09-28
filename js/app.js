import { APP_VERSION } from './version.js';
import { Store } from './core/store.js';
import { onRoute, navigate, replaceRoute } from './router.js';
import { today } from './core/dates.js';
import { notice, closeSheet, escapeHtml, downloadText } from './core/ui.js';
import { bundleJson, autoBackup, cloudBackup } from './core/backup.js';
import { hasLegacy, isFresh, migrateLegacy } from './core/migrate-legacy.js';
import { flushDeferred } from './core/defer.js';
import { watchDayChange } from './core/resume.js';
import { settingsSchema } from './modules/settings/schema.js';
import { suiviSchema } from './modules/suivi/schema.js';
import { pulsionSchema } from './modules/pulsion/schema.js';
import { testsSchema } from './modules/tests/schema.js';
import { challengeSchema } from './modules/challenge/schema.js';
import { autoClose } from './modules/challenge/ops.js';
import { mindSchema } from './modules/mind/schema.js';
import { rappelSchema } from './modules/rappel/schema.js';
import * as suiviDay from './modules/suivi/views/day.js';
import * as suiviData from './modules/suivi/views/data.js';
import * as pulsionHome from './modules/pulsion/views/home.js';
import * as challengeHome from './modules/challenge/views/home.js';
import * as testsHome from './modules/tests/views/home.js';
import * as testsRun from './modules/tests/views/run.js';
import * as mindHome from './modules/mind/views/home.js';
import * as mindSubject from './modules/mind/views/subject.js';
import * as mindSearch from './modules/mind/views/search.js';
import * as mindTree from './modules/mind/views/tree.js';
import * as rappelHome from './modules/rappel/views/home.js';
import * as rappelReview from './modules/rappel/views/review.js';
import * as rappelCapture from './modules/rappel/views/capture.js';
import * as rappelLibrary from './modules/rappel/views/library.js';
import * as settingsHome from './modules/settings/views/home.js';

export const SCHEMAS = { settings: settingsSchema, suivi: suiviSchema, pulsion: pulsionSchema, challenge: challengeSchema, tests: testsSchema, mind: mindSchema, rappel: rappelSchema };

// Modules affichables : libellé, stores dont une notification rerend l'écran, vues par nom de route.
const MODULES = {
  suivi: { label: 'Suivi', stores: ['suivi', 'pulsion'], views: { home: suiviDay.render, data: suiviData.render } },
  pulsion: { label: 'Pulsion', stores: ['pulsion'], views: { home: pulsionHome.render } },
  challenge: { label: 'Challenge', stores: ['challenge'], views: { home: challengeHome.render, c: challengeHome.render } },
  tests: { label: 'Tests', stores: ['tests'], views: { home: testsHome.render, run: testsRun.render } },
  mind: { label: 'Mind', stores: ['mind'], views: { home: mindHome.render, s: mindSubject.render, search: mindSearch.render, tree: mindTree.render } },
  rappel: { label: 'Rappel', stores: ['rappel'], views: { home: rappelHome.render, review: rappelReview.render, capture: rappelCapture.render, library: rappelLibrary.render } },
  settings: { label: 'Réglages', stores: ['settings', 'suivi', 'pulsion', 'challenge', 'tests', 'mind', 'rappel'], views: { home: settingsHome.render } },
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
  autoClose(stores.challenge, today());

  const getBundle = () => bundleJson(Object.fromEntries(Object.entries(stores).map(([n, s]) => [n, s.doc])));
  const dailyBackups = () => {
    autoBackup({ storage, getJson: getBundle, todayKey: today(), download: downloadText });
    cloudBackup({ storage, getJson: getBundle, todayKey: today() });
  };
  dailyBackups();
  if (navigator.storage?.persist) navigator.storage.persist();

  const view = document.getElementById('view');
  const title = document.getElementById('title');
  const topbtn = document.getElementById('topbtn');
  const tabbar = document.getElementById('tabbar');
  tabbar.innerHTML = TAB_ORDER.map(t => `<button type="button" data-tab="${t}">${escapeHtml(MODULES[t].label)}</button>`).join('');
  tabbar.onclick = e => { const b = e.target.closest('[data-tab]'); if (b) navigate({ tab: b.dataset.tab }); };

  let route = null;
  let leave = null; // nettoyage de la vue courante, appelé une fois au prochain changement de route
  const ctx = { stores, schemas: SCHEMAS, storage, navigate, notice, today, applyTheme, version: APP_VERSION, getBundle, replace: replaceRoute, onLeave: fn => { leave = fn; }, get route() { return route; } };

  function draw() {
    // Un redessin remplace la vue : son nettoyage éventuel (scène de test) doit partir avant.
    leave?.();
    leave = null;
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
      replaceRoute({ tab: MODULES[last] ? last : 'suivi' });
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
  // PWA gardée en mémoire la nuit : au réveil un autre jour, backups du jour et écran rerendu sur la bonne date.
  watchDayChange({ today, onChange: () => { autoClose(stores.challenge, today()); dailyBackups(); if (route) draw(); } });
  if (migrated.length) notice('Données Suivi reprises.');
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js', { type: 'module' }).catch(() => { /* hors ligne indisponible, l'app fonctionne quand même */ });
}

try { main(); } catch (err) {
  console.error(err);
  document.getElementById('view').innerHTML = "<p class=\"empty\">Ce navigateur bloque le stockage local, l'application ne peut pas fonctionner ici.</p>";
}
