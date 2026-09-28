// Capture : brain dump extrait par le LLM (nombre de fiches réglable), collage structuré importé sans appel, ajout à la main.
import { escapeHtml } from '../../../core/ui.js';
import { KINDS } from '../schema.js';
import { parseStructured } from '../parse.js';
import { llmExtract, humanError } from '../llm.js';
import { addItems } from '../ops.js';
import { subTabs } from './home.js';

const COUNTS = ['auto', 1, 3, 5, 8];
// État d'écran : le texte reste en place après extraction, pour relancer avec un autre nombre.
let text = '', count = 'auto', proposals = null, busy = false, error = null, added = null;
let mounted = false;

function proposalCard(p, i) {
  return `<div class="card prop${p.included ? '' : ' off'}">
    <div class="prop-head">
      <input type="checkbox" class="check" data-include="${i}"${p.included ? ' checked' : ''} aria-label="Inclure">
      <select data-kind="${i}">${Object.entries(KINDS).map(([k, v]) => `<option value="${k}"${k === p.kind ? ' selected' : ''}>${v}</option>`).join('')}</select>
      <input type="text" data-title="${i}" value="${escapeHtml(p.title)}" placeholder="Titre court">
    </div>
    <textarea data-content="${i}" rows="3" placeholder="Le savoir lui-même — référence de correction">${escapeHtml(p.content)}</textarea>
  </div>`;
}

export function render(root, ctx) {
  mounted = true;
  ctx.onLeave?.(() => { mounted = false; });
  const store = ctx.stores.rappel;
  const selected = proposals ? proposals.filter(p => p.included && p.title.trim() && p.content.trim()).length : 0;

  root.innerHTML = `${subTabs('capture')}
    ${proposals ? `
      <p class="tiny mono">Proposition — corrige, décoche, puis ajoute</p>
      ${proposals.map(proposalCard).join('')}
      <div class="rowbtns"><button type="button" class="btn btn-ghost" data-cancel>Annuler</button><button type="button" class="btn" data-add${selected ? '' : ' disabled'}>Ajouter ${selected} fiche${selected > 1 ? 's' : ''}</button></div>`
    : `
      <p class="rappel-lead">Tu sors d'un documentaire, d'un chapitre, d'un cours ? Vide ce que tu retiens, l'app en tire des fiches, tu valides.</p>
      <textarea data-dump rows="9" placeholder="Brain dump libre, ou juste un sujet. Un collage déjà structuré Titre / Contenu est importé sans appel.">${escapeHtml(text)}</textarea>
      ${error ? `<p class="tiny warn">${escapeHtml(error)}</p>` : ''}
      ${added ? `<p class="tiny mono">${escapeHtml(added)}</p>` : ''}
      <div class="srow small"><span class="tiny">Fiches</span><div class="chips">${COUNTS.map(c => `<button type="button" class="chip${count === c ? ' on' : ''}" data-count="${c}">${c}</button>`).join('')}</div></div>
      <div class="rowbtns">
        <button type="button" class="btn btn-ghost" data-manual>Ajouter à la main</button>
        <button type="button" class="btn" data-extract${busy || text.trim().length < 2 ? ' disabled' : ''}>${busy ? 'Extraction…' : 'Extraire'}</button>
      </div>`}`;

  const rerender = () => { if (mounted) render(root, ctx); };

  async function extract() {
    error = null; added = null;
    const local = parseStructured(text);
    if (local.length) { proposals = local.map(p => ({ ...p, included: true })); return rerender(); }
    busy = true; rerender();
    try {
      const out = await llmExtract(ctx.stores.settings.doc.llm, text.trim(), count);
      proposals = out.map(p => ({ ...p, included: true }));
      if (!proposals.length) { proposals = null; error = "Le modèle n'a produit aucune fiche exploitable."; }
    } catch (e) { error = `L'extraction a échoué. ${humanError(e)}`; }
    busy = false; rerender();
  }

  root.oninput = e => {
    const d = e.target.closest('[data-dump]');
    if (d) { text = d.value; root.querySelector('[data-extract]')?.toggleAttribute('disabled', busy || text.trim().length < 2); return; }
    if (!proposals) return;
    const t = e.target.closest('[data-title]'); if (t) proposals[Number(t.dataset.title)].title = t.value;
    const c = e.target.closest('[data-content]'); if (c) proposals[Number(c.dataset.content)].content = c.value;
  };
  root.onchange = e => {
    if (!proposals) return;
    const k = e.target.closest('[data-kind]'); if (k) proposals[Number(k.dataset.kind)].kind = k.value;
    const inc = e.target.closest('[data-include]'); if (inc) { proposals[Number(inc.dataset.include)].included = inc.checked; rerender(); }
  };
  root.onclick = e => {
    const cnt = e.target.closest('[data-count]');
    if (cnt) { count = cnt.dataset.count === 'auto' ? 'auto' : Number(cnt.dataset.count); return rerender(); }
    if (e.target.closest('[data-extract]') && !busy && text.trim().length >= 2) return void extract();
    if (e.target.closest('[data-manual]')) { proposals = [{ included: true, kind: 'fait', title: '', content: '' }]; error = null; added = null; return rerender(); }
    if (e.target.closest('[data-cancel]')) { proposals = null; return rerender(); }
    if (e.target.closest('[data-add]')) {
      const items = addItems(store, proposals.filter(p => p.included), Date.now());
      proposals = null; text = '';
      added = `${items.length} fiche${items.length > 1 ? 's' : ''} ajoutée${items.length > 1 ? 's' : ''} à la bibliothèque.`;
      return; // le store notifie, l'écran se rerend
    }
  };
}
