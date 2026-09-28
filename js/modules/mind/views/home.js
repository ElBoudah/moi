// Accueil Mind : ce qui pèse, à faire, thèmes ; plat quelle que soit la profondeur de l'arbre.
import * as q from '../queries.js';
import { escapeHtml, openSheet, closeSheet, notice } from '../../../core/ui.js';
import { weightDots, pathLabel } from './helpers.js';
import { createSubject, completeAction } from '../ops.js';

const goSubject = (ctx, id) => ctx.navigate({ tab: 'mind', view: 's', id });

function subjectRow(doc, s) {
  return `<button type="button" class="row" data-go="${escapeHtml(s.id)}">
    ${weightDots(s.weight)}
    <span class="row-main">
      <span class="row-title">${escapeHtml(s.title)}</span>
      <span class="row-sub">${escapeHtml(pathLabel(doc, s.id))}</span>
    </span>
  </button>`;
}

function actionRow(doc, e) {
  const s = q.subjectById(doc, e.subjectId);
  // Pas de <label> : un tap sur le texte doit naviguer, pas cocher.
  return `<div class="row">
    <input type="checkbox" class="check" data-done="${escapeHtml(e.id)}" aria-label="Fait : ${escapeHtml(e.content)}">
    <button type="button" class="row-main" data-go="${escapeHtml(s.id)}">
      <span class="row-title">${escapeHtml(e.content)}</span>
      <span class="row-sub">${escapeHtml(s.title)}</span>
    </button>
  </div>`;
}

function themeRow(doc, s) {
  const n = q.activeCount(doc, s.id);
  return `<button type="button" class="row" data-go="${escapeHtml(s.id)}">
    <span class="row-main"><span class="row-title">${escapeHtml(s.title)}</span></span>
    <span class="row-aside">${n} sujet${n > 1 ? 's' : ''}</span>
  </button>`;
}

export function render(root, ctx) {
  const store = ctx.stores.mind;
  const doc = store.doc;
  const weighing = q.weighing(doc);
  const actions = q.openActions(doc);
  const roots = q.roots(doc);

  root.innerHTML = `
    <section class="section">
      <h2 class="section-title">Ce qui pèse</h2>
      ${weighing.length ? weighing.map(s => subjectRow(doc, s)).join('') : '<p class="empty">Rien ne pèse en ce moment.</p>'}
    </section>
    <section class="section">
      <h2 class="section-title">À faire</h2>
      ${actions.length ? actions.map(e => actionRow(doc, e)).join('') : "<p class=\"empty\">Rien à faire pour l'instant.</p>"}
    </section>
    <section class="section">
      <h2 class="section-title">Thèmes</h2>
      ${roots.length ? roots.map(s => themeRow(doc, s)).join('') : '<p class="empty">Aucun thème. Le bouton + crée ton premier sujet, à la racine ou sous un thème.</p>'}
    </section>
    <div class="footer-icons">
      <button type="button" data-nav="tree" aria-label="Vue d'ensemble">☰</button>
      <button type="button" data-nav="search" aria-label="Rechercher">🔍</button>
      <button type="button" data-nav="settings" aria-label="Réglages">⚙</button>
    </div>
    <button type="button" class="fab" id="fab" aria-label="Nouveau sujet">+</button>
  `;

  root.onclick = e => {
    const go = e.target.closest('[data-go]');
    if (go && !e.target.closest('input')) { e.preventDefault(); goSubject(ctx, go.dataset.go); return; }
    const nav = e.target.closest('[data-nav]');
    if (nav) { ctx.navigate(nav.dataset.nav === 'settings' ? { tab: 'settings' } : { tab: 'mind', view: nav.dataset.nav }); return; }
    if (e.target.closest('#fab')) openNewSubjectSheet(store, ctx);
  };
  root.onchange = e => {
    const box = e.target.closest('[data-done]');
    if (box && box.checked) {
      const id = box.dataset.done;
      setTimeout(() => { try { completeAction(store, id); notice('Fait.'); } catch (err) { notice(err.message); } }, 150);
    }
  };
}

export function openNewSubjectSheet(store, ctx, defaultParentId = null) {
  const doc = store.doc;
  const parents = q.activeSubjectsByPath(doc);
  const selected = defaultParentId ?? q.roots(doc)[0]?.id ?? '';
  const sheet = openSheet(`
    <h2>Nouveau sujet</h2>
    <form id="new-subject">
      <input type="text" name="title" placeholder="Titre" autocomplete="off" required>
      <select name="parent">
        <option value=""${selected === '' ? ' selected' : ''}>— À la racine (nouveau thème) —</option>
        ${parents.map(p => `<option value="${escapeHtml(p.id)}"${p.id === selected ? ' selected' : ''}>${escapeHtml(q.pathTitles(doc, p.id).join(' › '))}</option>`).join('')}
      </select>
      <div class="sheet-actions">
        <button type="button" class="btn-text" data-cancel>Annuler</button>
        <button type="submit" class="btn">Créer</button>
      </div>
    </form>
  `);
  sheet.querySelector('[data-cancel]').onclick = closeSheet;
  sheet.querySelector('form').onsubmit = e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      const s = createSubject(store, { title: fd.get('title'), parentId: fd.get('parent') || null });
      closeSheet();
      goSubject(ctx, s.id);
    } catch (err) { notice(err.message); }
  };
}
