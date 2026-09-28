// Bibliothèque : de la plus urgente à la plus solide, dépliage, modification, suppression en deux taps.
import { escapeHtml } from '../../../core/ui.js';
import { KINDS } from '../schema.js';
import { libraryRows } from '../queries.js';
import { updateItem, deleteItem } from '../ops.js';
import { subTabs } from './home.js';

let openId = null, editId = null, confirmId = null; // état d'écran

const badge = kind => `<span class="badge">${escapeHtml(KINDS[kind] ?? 'Fait')}</span>`;
const rStat = (item, r) => (r === null ? 'nouveau' : `R ${Math.round(r * 100)} % · S ${item.S < 1 ? item.S.toFixed(1) : Math.round(item.S)} j`);

function detail(item) {
  return `<div class="lib-detail">
    <p>${escapeHtml(item.content)}</p>
    <p class="tiny mono">${item.reps || 0} passage${(item.reps || 0) > 1 ? 's' : ''} · ${item.lapses || 0} oubli${(item.lapses || 0) > 1 ? 's' : ''}${item.lastReview ? ` · dernier : ${new Date(item.lastReview).toLocaleDateString('fr-FR')}` : ''}</p>
    <div class="sheet-actions">
      <button type="button" class="btn-text" data-edit="${escapeHtml(item.id)}">Modifier</button>
      <button type="button" class="btn-text" data-delete="${escapeHtml(item.id)}">${confirmId === item.id ? 'Confirmer la suppression' : 'Supprimer'}</button>
    </div>
  </div>`;
}

function editor(item) {
  return `<form class="lib-detail" data-edit-form="${escapeHtml(item.id)}">
    <label class="field"><span class="tl">Genre</span><select name="kind">${Object.entries(KINDS).map(([k, v]) => `<option value="${k}"${k === item.kind ? ' selected' : ''}>${v}</option>`).join('')}</select></label>
    <label class="field"><span class="tl">Titre</span><input type="text" name="title" value="${escapeHtml(item.title)}"></label>
    <label class="field"><span class="tl">Contenu</span><textarea name="content" rows="4">${escapeHtml(item.content)}</textarea></label>
    <div class="sheet-actions"><button type="button" class="btn-text" data-cancel-edit>Annuler</button><button type="submit" class="btn">Enregistrer</button></div>
  </form>`;
}

export function render(root, ctx) {
  const store = ctx.stores.rappel;
  const rows = libraryRows(store.doc.items, Date.now());
  root.innerHTML = `${subTabs('library')}
    ${rows.length ? `<p class="tiny mono">${rows.length} fiche${rows.length > 1 ? 's' : ''} · classées de la plus urgente à la plus solide</p>` : "<p class=\"empty\">Aucune fiche pour l'instant. La bibliothèque se remplit depuis « Capturer ».</p>"}
    ${rows.map(({ item, r }) => `<div class="card lib-item">
      <button type="button" class="lib-head" data-open="${escapeHtml(item.id)}">
        <span class="lib-title">${badge(item.kind)}${escapeHtml(item.title)}</span>
        <span class="tiny mono">${rStat(item, r)}</span>
      </button>
      ${openId === item.id ? (editId === item.id ? editor(item) : detail(item)) : ''}
    </div>`).join('')}`;

  root.onclick = e => {
    const open = e.target.closest('[data-open]');
    if (open) { openId = openId === open.dataset.open ? null : open.dataset.open; editId = null; confirmId = null; return render(root, ctx); }
    const ed = e.target.closest('[data-edit]');
    if (ed) { editId = ed.dataset.edit; return render(root, ctx); }
    if (e.target.closest('[data-cancel-edit]')) { editId = null; return render(root, ctx); }
    const del = e.target.closest('[data-delete]');
    if (del) {
      if (confirmId !== del.dataset.delete) { confirmId = del.dataset.delete; return render(root, ctx); }
      try { deleteItem(store, del.dataset.delete); openId = null; confirmId = null; ctx.notice('Supprimé.'); } catch (err) { ctx.notice(err.message); }
    }
  };
  root.onsubmit = e => {
    const form = e.target.closest('[data-edit-form]');
    if (!form) return;
    e.preventDefault();
    const fd = new FormData(form);
    try { updateItem(store, form.dataset.editForm, { title: fd.get('title'), content: fd.get('content'), kind: fd.get('kind') }); editId = null; ctx.notice('Enregistré.'); }
    catch (err) { ctx.notice(err.message); }
  };
}
