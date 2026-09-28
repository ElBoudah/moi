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
