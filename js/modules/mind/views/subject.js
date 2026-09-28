// Fiche d'un sujet ou d'un thème : fil d'Ariane, poids, intention, à faire, sous-sujets, journal agrégé, composeur, menu.
import * as q from '../queries.js';
import { formatDate, relativeDays, daysBetween, today } from '../../../core/dates.js';
import { escapeHtml, openSheet, closeSheet, notice, downloadText, longPress } from '../../../core/ui.js';
import { moduleExportJson, moduleExportFilename } from '../../../core/backup.js';
import { weightDots, TYPE_LABEL } from './helpers.js';
import { openNewSubjectSheet } from './home.js';
import { setIntent, setWeight, resumeSubject, addEntry, updateEntry, deleteEntry, completeAction, renameSubject, moveSubject, restSubject, deletionImpact, deleteSubject } from '../ops.js';

const JOURNAL_PAGE = 30;
let expandedJournalFor = null; // état d'écran : sujet dont le journal est déplié en entier

const goSubject = (ctx, id) => ctx.navigate({ tab: 'mind', view: 's', id });
const goHome = ctx => ctx.navigate({ tab: 'mind' });

function crumbs(doc, s) {
  const parts = q.ancestors(doc, s.id).map(a => `<button type="button" data-go="${escapeHtml(a.id)}">${escapeHtml(a.title)}</button><span>›</span>`);
  return `<nav class="crumbs"><button type="button" data-home aria-label="Accueil">‹ Mind</button><span>›</span>${parts.join('')}</nav>`;
}

function actionRow(s, e, doc) {
  const owner = q.subjectById(doc, e.subjectId);
  const sub = owner.id === s.id ? '' : `<span class="row-sub">${escapeHtml(owner.title)}</span>`;
  return `<div class="row">
    <input type="checkbox" class="check" data-done="${escapeHtml(e.id)}" aria-label="Fait : ${escapeHtml(e.content)}">
    <span class="row-main"><span class="row-title">${escapeHtml(e.content)}</span>${sub}</span>
  </div>`;
}

function childRow(doc, c, nowIso) {
  return `<button type="button" class="row" data-go="${escapeHtml(c.id)}">
    <span class="row-main"><span class="row-title">${escapeHtml(c.title)}</span></span>
    ${weightDots(c.weight)}
    <span class="row-aside">${relativeDays(q.lastUpdatedAt(doc, c.id), nowIso)}</span>
  </button>`;
}

function journalItem(doc, s, e) {
  let body = escapeHtml(e.content);
  if (e.type === 'weight') body = `Poids → ${escapeHtml(e.content)}`;
  if (e.type === 'action') body = `Fait : ${body}`;
  const origin = e.subjectId === s.id ? '' : `<span class="journal-origin" data-go="${escapeHtml(e.subjectId)}">${escapeHtml(q.relativePathLabel(doc, s.id, e.subjectId))}</span>`;
  return `<li class="journal-item ${e.type}" data-entry="${escapeHtml(e.id)}">
    <span class="journal-date">${formatDate(q.displayDate(e))}</span>
    <span class="journal-body">${origin}<span class="journal-text">${body}</span></span>
  </li>`;
}

export function render(root, ctx) {
  const store = ctx.stores.mind;
  const doc = store.doc;
  const s = q.subjectById(doc, ctx.route?.id);
  if (!s) {
    root.innerHTML = '<p class="empty">Sujet introuvable.</p><button type="button" class="btn-text" data-home>‹ Mind</button>';
    root.onclick = () => goHome(ctx);
    return;
  }
  const nowIso = store.now();
  const isRoot = s.parentId === null;
  const rested = s.restedAt !== null;
  const actions = q.openActions(doc, s.id);
  const kids = q.children(doc, s.id);
  const allEntries = q.journalTree(doc, s.id);
  const showAll = expandedJournalFor === s.id;
  const entries = showAll ? allEntries : allEntries.slice(0, JOURNAL_PAGE);
  const hidden = allEntries.length - entries.length;

  const subjectsSection = `
    <section class="section">
      <h2 class="section-title">Sous-sujets</h2>
      ${kids.map(c => childRow(doc, c, nowIso)).join('') || '<p class="empty">Aucun sous-sujet.</p>'}
      ${rested ? '' : '<button type="button" class="btn-text" data-new-child>+ sous-sujet</button>'}
    </section>`;
  const actionsSection = `
    <section class="section">
      <h2 class="section-title">À faire</h2>
      ${actions.map(e => actionRow(s, e, doc)).join('') || '<p class="empty">Rien à faire.</p>'}
    </section>`;

  root.innerHTML = `
    ${crumbs(doc, s)}
    ${rested ? `<div class="banner"><span>Posé depuis ${daysBetween(s.restedAt, nowIso)} j</span><button type="button" class="btn-quiet" data-resume>Reprendre</button></div>` : ''}
    <h1 class="title">
      <span>${escapeHtml(s.title)}</span>
      ${isRoot ? '' : `<button type="button" class="dots-btn" data-weight aria-label="Changer le poids">${weightDots(s.weight)}</button>`}
    </h1>
    <textarea class="intent" data-intent placeholder="${isRoot ? 'Quelques mots sur ce thème…' : "Ce que je veux, où j'en suis…"}" rows="3">${escapeHtml(s.intent)}</textarea>
    ${isRoot ? subjectsSection + actionsSection : actionsSection + subjectsSection}
    <section class="section">
      <h2 class="section-title">Journal</h2>
      <ul class="journal">${entries.map(e => journalItem(doc, s, e)).join('') || '<li class="empty">Rien encore.</li>'}</ul>
      ${hidden > 0 ? `<button type="button" class="btn-text" data-more-journal>Voir ${hidden} entrée${hidden > 1 ? 's' : ''} de plus</button>` : ''}
    </section>
    <div class="bottom-bar">
      ${rested ? '<span></span>' : '<button type="button" class="btn" data-compose>+ pensée</button>'}
      <button type="button" class="btn-menu" data-menu aria-label="Plus">⋯</button>
    </div>
  `;

  const intent = root.querySelector('[data-intent]');
  const autosize = () => { intent.style.height = 'auto'; intent.style.height = `${intent.scrollHeight}px`; };
  autosize();
  intent.oninput = autosize;
  intent.onblur = () => { if (intent.value !== s.intent) setIntent(store, s.id, intent.value); };

  root.onclick = e => {
    if (e.target.closest('[data-home]')) return goHome(ctx);
    const go = e.target.closest('[data-go]');
    if (go) return goSubject(ctx, go.dataset.go);
    if (e.target.closest('[data-more-journal]')) { expandedJournalFor = s.id; return render(root, ctx); }
    if (e.target.closest('[data-weight]')) return setWeight(store, s.id, (s.weight + 1) % 4);
    if (e.target.closest('[data-resume]')) { resumeSubject(store, s.id); return notice('Repris.'); }
    if (e.target.closest('[data-new-child]')) return openNewSubjectSheet(store, ctx, s.id);
    if (e.target.closest('[data-compose]')) return openComposer(store, s.id);
    if (e.target.closest('[data-menu]')) return openMenu(store, ctx, s);
  };
  root.onchange = e => {
    const box = e.target.closest('[data-done]');
    if (box && box.checked) setTimeout(() => { try { completeAction(store, box.dataset.done); notice('Fait.'); } catch (err) { notice(err.message); } }, 150);
  };

  // L'écouteur d'appui long est posé une seule fois sur root, qui survit aux rendus.
  root._entryMenu = el => openEntryMenu(store, el.dataset.entry);
  if (!root._longPressBound) {
    longPress(root, '[data-entry]', el => root._entryMenu?.(el));
    root._longPressBound = true;
  }
}

function openComposer(store, subjectId, type = 'thought') {
  const placeholder = t => (t === 'action' ? 'Quelque chose que je peux faire…' : t === 'decision' ? 'Ce que je décide…' : 'Ce qui me traverse…');
  const sheet = openSheet(`
    <div class="sheet-tabs" role="tablist">
      ${Object.entries(TYPE_LABEL).map(([k, v]) => `<button type="button" role="tab" data-type="${k}" aria-selected="${k === type}">${v}</button>`).join('')}
    </div>
    <form>
      <textarea name="content" placeholder="${placeholder(type)}"></textarea>
      <div class="sheet-actions">
        <button type="button" class="btn-text" data-cancel>Annuler</button>
        <button type="submit" class="btn">Ajouter</button>
      </div>
    </form>
  `);
  let current = type;
  sheet.querySelector('.sheet-tabs').onclick = e => {
    const b = e.target.closest('[data-type]');
    if (!b) return;
    current = b.dataset.type;
    sheet.querySelectorAll('[data-type]').forEach(x => x.setAttribute('aria-selected', String(x === b)));
    sheet.querySelector('textarea').placeholder = placeholder(current);
  };
  sheet.querySelector('[data-cancel]').onclick = closeSheet;
  sheet.querySelector('form').onsubmit = e => {
    e.preventDefault();
    try { addEntry(store, subjectId, current, new FormData(e.target).get('content')); closeSheet(); }
    catch (err) { notice(err.message); }
  };
}

function openEntryMenu(store, entryId) {
  const e = store.doc.entries.find(x => x.id === entryId);
  if (!e || e.type === 'weight') return;
  const sheet = openSheet(`
    <ul class="menu-list">
      <li><button type="button" data-edit>Modifier</button></li>
      <li><button type="button" data-delete>Supprimer</button></li>
    </ul>
  `);
  sheet.querySelector('[data-edit]').onclick = () => {
    const s2 = openSheet(`
      <form>
        <textarea name="content">${escapeHtml(e.content)}</textarea>
        <div class="sheet-actions">
          <button type="button" class="btn-text" data-cancel>Annuler</button>
          <button type="submit" class="btn">Enregistrer</button>
        </div>
      </form>`);
    s2.querySelector('[data-cancel]').onclick = closeSheet;
    s2.querySelector('form').onsubmit = ev => {
      ev.preventDefault();
      try { updateEntry(store, entryId, new FormData(ev.target).get('content')); closeSheet(); } catch (err) { notice(err.message); }
    };
  };
  sheet.querySelector('[data-delete]').onclick = () => {
    if (confirm('Supprimer cette entrée ?')) { deleteEntry(store, entryId); closeSheet(); }
  };
}

function openMenu(store, ctx, s) {
  const sheet = openSheet(`
    <ul class="menu-list">
      <li><button type="button" data-rename>Renommer</button></li>
      <li><button type="button" data-move>Déplacer</button></li>
      ${s.restedAt === null ? '<li><button type="button" data-rest>Poser</button></li>' : ''}
      <li><button type="button" data-delete>Supprimer</button></li>
    </ul>
  `);
  sheet.querySelector('[data-rename]').onclick = () => {
    const t = prompt('Nouveau titre', s.title);
    if (t === null) return;
    try { renameSubject(store, s.id, t); closeSheet(); } catch (err) { notice(err.message); }
  };
  sheet.querySelector('[data-move]').onclick = () => openMoveSheet(store, s);
  sheet.querySelector('[data-rest]')?.addEventListener('click', () => openRestSheet(store, ctx, s));
  sheet.querySelector('[data-delete]').onclick = () => openDeleteSheet(store, ctx, s);
}

function openMoveSheet(store, s) {
  const doc = store.doc;
  const targets = q.moveTargets(doc, s.id);
  const sheet = openSheet(`
    <h2>Déplacer « ${escapeHtml(s.title)} »</h2>
    <form>
      <select name="parent">
        <option value="">— À la racine (devient un thème) —</option>
        ${targets.map(t => `<option value="${escapeHtml(t.id)}"${t.id === s.parentId ? ' selected' : ''}>${escapeHtml(q.pathTitles(doc, t.id).join(' › '))}</option>`).join('')}
      </select>
      <div class="sheet-actions">
        <button type="button" class="btn-text" data-cancel>Annuler</button>
        <button type="submit" class="btn">Déplacer</button>
      </div>
    </form>
  `);
  sheet.querySelector('[data-cancel]').onclick = closeSheet;
  sheet.querySelector('form').onsubmit = e => {
    e.preventDefault();
    try { moveSubject(store, s.id, new FormData(e.target).get('parent') || null); closeSheet(); notice('Déplacé.'); }
    catch (err) { notice(err.message); }
  };
}

function openRestSheet(store, ctx, s) {
  const sheet = openSheet(`
    <h2>Poser « ${escapeHtml(s.title)} »</h2>
    <p class="empty">Le sujet quitte l'accueil, son histoire reste.</p>
    <form>
      <textarea name="word" placeholder="Un dernier mot ? (optionnel)"></textarea>
      <div class="sheet-actions">
        <button type="button" class="btn-text" data-cancel>Annuler</button>
        <button type="submit" class="btn">Poser</button>
      </div>
    </form>
  `);
  sheet.querySelector('[data-cancel]').onclick = closeSheet;
  sheet.querySelector('form').onsubmit = e => {
    e.preventDefault();
    restSubject(store, s.id, new FormData(e.target).get('word'));
    closeSheet();
    notice('Posé.');
    goHome(ctx);
  };
}

function openDeleteSheet(store, ctx, s) {
  const impact = deletionImpact(store, s.id);
  const parentId = s.parentId;
  const sheet = openSheet(`
    <h2>Supprimer « ${escapeHtml(s.title)} » ?</h2>
    <p class="empty">${impact.subjects} sujet${impact.subjects > 1 ? 's' : ''} et ${impact.entries} entrée${impact.entries > 1 ? 's' : ''} seront supprimés. C'est irréversible.</p>
    <div class="sheet-actions">
      ${impact.entries > 5 ? "<button type=\"button\" class=\"btn-quiet\" data-export>Exporter d'abord</button>" : ''}
      <button type="button" class="btn-text" data-cancel>Annuler</button>
      <button type="button" class="btn" data-confirm>Supprimer</button>
    </div>
  `);
  sheet.querySelector('[data-cancel]').onclick = closeSheet;
  sheet.querySelector('[data-export]')?.addEventListener('click', () => downloadText(moduleExportFilename('mind', today()), moduleExportJson('mind', store.doc)));
  sheet.querySelector('[data-confirm]').onclick = () => {
    deleteSubject(store, s.id);
    closeSheet();
    notice('Supprimé.');
    if (parentId) goSubject(ctx, parentId); else goHome(ctx);
  };
}
