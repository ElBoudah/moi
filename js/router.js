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

// Redirection : remplace l'entrée d'historique au lieu d'en ajouter une, sinon le bouton
// retour du téléphone retombe sur l'URL de départ, qui redirige à nouveau, sans fin.
export function replaceRoute(route) { location.replace(routeHash(route)); }

export function onRoute(fn) {
  const fire = () => fn(parseRoute(location.hash));
  window.addEventListener('hashchange', fire);
  fire();
}
