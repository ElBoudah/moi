// Accueil Rappel : « N dues · M nouvelles », Réviser, ou Réviser quand même. Pas de session, pas de cap.
import { reviewQueue, anywayQueue } from '../queries.js';
import { startReview } from './review.js';

export function subTabs(current) {
  const tab = (view, label) => `<a href="#/rappel${view === 'home' ? '' : '/' + view}" class="${current === view ? 'on' : ''}">${label}</a>`;
  return `<div class="subtabs">${tab('home', 'Réviser')}${tab('capture', 'Capturer')}${tab('library', 'Bibliothèque')}</div>`;
}

const plural = (n, one, many) => `${n} ${n > 1 ? many : one}`;

export function render(root, ctx) {
  const items = ctx.stores.rappel.doc.items;
  const now = Date.now();
  const { due, fresh } = reviewQueue(items, now);
  const anyway = anywayQueue(items, now);
  let body;
  if (!items.length) {
    body = `<div class="card center"><p class="rappel-lead">La bibliothèque est vide.</p><p class="tiny">Passe par « Capturer » : un brain dump de deux minutes suffit pour créer les premières fiches.</p></div>`;
  } else {
    const n = due.length + fresh.length;
    body = `<div class="card center">
      <p class="tiny mono">${plural(due.length, 'due', 'dues')} · ${plural(fresh.length, 'nouvelle', 'nouvelles')}</p>
      <p class="rappel-lead">${n ? `${plural(n, 'fiche', 'fiches')} à réviser.` : "Rien d'urgent aujourd'hui. Reviens demain, ou capture du nouveau."}</p>
      ${n ? '<button type="button" class="btn" data-review>Réviser</button>' : (anyway.length ? '<button type="button" class="btn btn-ghost" data-anyway>Réviser quand même</button>' : '')}
    </div>
    <p class="note">Pas de série, pas de dette : la file du jour est la seule chose visible. Chaque validation est enregistrée tout de suite, tu arrêtes quand tu veux.</p>`;
  }
  root.innerHTML = `${subTabs('home')}${body}`;
  root.onclick = e => {
    if (e.target.closest('[data-review]')) return startReview(ctx, [...due, ...fresh]);
    if (e.target.closest('[data-anyway]')) return startReview(ctx, anyway);
  };
}
