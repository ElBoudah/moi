import * as q from '../queries.js';
import { relativeDays } from '../../../core/dates.js';
import { escapeHtml } from '../../../core/ui.js';
import { weightDots } from './helpers.js';

// État d'écran : branches dépliées (les thèmes le sont toujours), affichage des posés.
const expanded = new Set();
let showRested = false;

function node(doc, s, nowIso) {
  const isRoot = s.parentId === null;
  const kids = q.children(doc, s.id, { includeRested: showRested });
  const open = isRoot || expanded.has(s.id);
  const rested = s.restedAt !== null;
  const count = kids.length;
  const toggle = count && !isRoot
    ? `<button type="button" class="tree-toggle" data-toggle="${escapeHtml(s.id)}" aria-expanded="${open}" aria-label="${open ? 'Replier' : 'Déplier'}">▸</button>`
    : (isRoot ? '' : '<span class="tree-toggle"></span>');
  const aside = isRoot
    ? `<span class="row-aside">${count} sujet${count > 1 ? 's' : ''}</span>`
    : `${weightDots(s.weight)}<span class="row-aside">${rested ? 'posé' : relativeDays(q.lastUpdatedAt(doc, s.id), nowIso)}</span>`;
  const children = open && count
    ? `<ul>${kids.map(c => node(doc, c, nowIso)).join('')}</ul>`
    : (!open && count ? `<ul><li class="tree-row"><span class="tree-toggle"></span><button type="button" class="row-main btn-text" data-toggle="${escapeHtml(s.id)}">▸ ${count} sujet${count > 1 ? 's' : ''}</button></li></ul>` : '');
  return `<li class="${isRoot ? 'tree-root' : ''} ${rested ? 'tree-rested' : ''}">
    <div class="tree-row">
      ${toggle}
      <button type="button" class="row-main" data-go="${escapeHtml(s.id)}"><span class="row-title">${escapeHtml(s.title)}</span></button>
      ${aside}
    </div>
    ${children}
  </li>`;
}

export function render(root, ctx) {
  const store = ctx.stores.mind;
  const doc = store.doc;
  const nowIso = store.now();
  const roots = q.children(doc, null, { includeRested: showRested });
  root.innerHTML = `
    <nav class="crumbs"><button type="button" data-home>‹ Mind</button></nav>
    <h1 class="title"><span>Vue d'ensemble</span></h1>
    <ul class="tree">${roots.map(r => node(doc, r, nowIso)).join('') || '<li class="empty">Aucun thème.</li>'}</ul>
    <button type="button" class="btn-text" data-toggle-rested>${showRested ? 'Masquer les sujets posés' : 'Afficher les sujets posés'}</button>
  `;
  root.onclick = e => {
    if (e.target.closest('[data-home]')) return ctx.navigate({ tab: 'mind' });
    const t = e.target.closest('[data-toggle]');
    if (t) {
      const id = t.dataset.toggle;
      if (expanded.has(id)) expanded.delete(id); else expanded.add(id);
      return render(root, ctx);
    }
    if (e.target.closest('[data-toggle-rested]')) { showRested = !showRested; return render(root, ctx); }
    const go = e.target.closest('[data-go]');
    if (go) ctx.navigate({ tab: 'mind', view: 's', id: go.dataset.go });
  };
}
