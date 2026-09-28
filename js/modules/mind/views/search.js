import * as q from '../queries.js';
import { escapeHtml } from '../../../core/ui.js';
import { pathLabel, weightDots } from './helpers.js';

let lastQuery = ''; // état d'écran

function resultRow(doc, s) {
  const rested = s.restedAt !== null ? ' · posé' : '';
  return `<button type="button" class="row" data-go="${escapeHtml(s.id)}">
    ${s.parentId === null ? '' : weightDots(s.weight)}
    <span class="row-main">
      <span class="row-title">${escapeHtml(s.title)}</span>
      <span class="row-sub">${escapeHtml(pathLabel(doc, s.id))}${rested}</span>
    </span>
  </button>`;
}

export function render(root, ctx) {
  const doc = ctx.stores.mind.doc;
  root.innerHTML = `
    <nav class="crumbs"><button type="button" data-home>‹ Mind</button></nav>
    <input type="search" class="search-input" placeholder="Rechercher un sujet" autocomplete="off" value="${escapeHtml(lastQuery)}">
    <div id="results"></div>
  `;
  const input = root.querySelector('input');
  const results = root.querySelector('#results');
  const draw = () => {
    lastQuery = input.value ?? '';
    const found = q.search(doc, lastQuery);
    results.innerHTML = found.map(s => resultRow(doc, s)).join('')
      || (lastQuery.trim() ? '<p class="empty">Aucun sujet ne correspond.</p>' : '');
  };
  input.oninput = draw;
  draw();
  input.focus?.();
  root.onclick = e => {
    if (e.target.closest('[data-home]')) return ctx.navigate({ tab: 'mind' });
    const go = e.target.closest('[data-go]');
    if (go) ctx.navigate({ tab: 'mind', view: 's', id: go.dataset.go });
  };
}
