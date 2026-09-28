// Precache + cache d'abord, rafraîchissement en arrière-plan. Le nom du cache vient de APP_VERSION :
// incrémenter js/version.js à chaque déploiement, sinon l'ancienne version reste servie.
import { APP_VERSION } from './js/version.js';

const CACHE_NAME = `moi-${APP_VERSION}`;
const ASSETS = [
  './', './index.html', './style.css', './manifest.webmanifest',
  './js/version.js', './js/app.js', './js/router.js',
  './js/core/dates.js', './js/core/stats.js', './js/core/store.js', './js/core/chart.js', './js/core/backup.js',
  './js/core/migrate-legacy.js', './js/core/ui.js', './js/core/defer.js', './js/core/resume.js',
  './js/modules/settings/schema.js', './js/modules/settings/views/home.js', './js/modules/rappel/presets.js',
  './js/modules/suivi/schema.js', './js/modules/suivi/queries.js', './js/modules/suivi/ops.js',
  './js/modules/suivi/views/day.js', './js/modules/suivi/views/data.js',
  './js/modules/pulsion/schema.js', './js/modules/pulsion/queries.js', './js/modules/pulsion/ops.js', './js/modules/pulsion/views/home.js',
  './js/modules/tests/schema.js',
  './js/modules/challenge/schema.js', './js/modules/challenge/queries.js', './js/modules/challenge/ops.js', './js/modules/challenge/views/home.js',
  './js/modules/tests/queries.js', './js/modules/tests/ops.js', './js/modules/tests/stage.js',
  './js/modules/tests/catalog/index.js', './js/modules/tests/catalog/pvt.js', './js/modules/tests/catalog/phq8.js',
  './js/modules/tests/views/home.js', './js/modules/tests/views/run.js',
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
