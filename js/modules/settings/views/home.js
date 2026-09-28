// Réglages : apparence, fournisseur LLM, export/import par module, backup, reprise des anciennes données, données illisibles.
import { escapeHtml, downloadText } from '../../../core/ui.js';
import { moduleExportJson, moduleExportFilename, parseModuleExport, parseBundle, cloudBackup, cloudRestore, cloudStatus } from '../../../core/backup.js';
import { hasLegacy, migrateLegacy } from '../../../core/migrate-legacy.js';
import { THEMES } from '../schema.js';
import { PRESETS } from '../../rappel/presets.js';
import { restedSubjects } from '../../mind/queries.js';
import { pathLabel } from '../../mind/views/helpers.js';
import { formatDate } from '../../../core/dates.js';

export const MODULE_LABELS = { suivi: 'Suivi', pulsion: 'Pulsion', challenge: 'Challenge', tests: 'Tests', mind: 'Mind', rappel: 'Rappel' };
const THEME_LABELS = { system: 'Système', light: 'Clair', dark: 'Sombre' };

const rowBtn = (attr, title, sub) => `<button type="button" class="row" ${attr}>
  <span class="row-main"><span class="row-title">${title}</span><span class="row-sub">${sub}</span></span></button>`;

export function render(root, ctx) {
  const { stores, schemas, storage } = ctx;
  const settings = stores.settings.doc;
  const llm = settings.llm;
  const preset = PRESETS[llm.provider];
  const dataModules = Object.keys(MODULE_LABELS).filter(m => stores[m]);
  const corrupt = Object.entries(stores).filter(([, s]) => s.corrupt);

  root.innerHTML = `
    <section class="section">
      <h2 class="section-title">Apparence</h2>
      <div class="sheet-tabs">${THEMES.map(k => `<button type="button" data-theme-pref="${k}" aria-selected="${k === settings.theme}">${THEME_LABELS[k]}</button>`).join('')}</div>
    </section>

    <section class="section">
      <h2 class="section-title">Fournisseur LLM</h2>
      <form id="llm">
        <label class="field"><span class="tl">Fournisseur</span>
          <select name="provider">${Object.entries(PRESETS).map(([k, v]) => `<option value="${k}"${k === llm.provider ? ' selected' : ''}>${escapeHtml(v.label)}</option>`).join('')}</select></label>
        <label class="field"><span class="tl">Clé API</span>
          <input type="password" name="apiKey" value="${escapeHtml(llm.apiKey)}" placeholder="${preset.keyUrl ? 'À créer sur ' + escapeHtml(preset.keyUrl) : 'Ta clé API'}" autocomplete="off"></label>
        <label class="field"><span class="tl">Modèle</span>
          <input type="text" name="model" value="${escapeHtml(llm.model)}" placeholder="${escapeHtml(preset.defaultModel || 'nom-du-modele')}" autocomplete="off"></label>
        <label class="field${llm.provider === 'custom' ? '' : ' hidden'}" data-baseurl><span class="tl">URL de base (endpoint OpenAI-compatible)</span>
          <input type="url" name="baseUrl" value="${escapeHtml(llm.baseUrl)}" placeholder="https://exemple.com/v1"></label>
        <p class="note">La clé reste dans le stockage local de cet appareil. Elle n'est envoyée qu'au fournisseur choisi, jamais ailleurs, et n'entre dans aucun backup.</p>
        <div class="sheet-actions"><button type="submit" class="btn">Enregistrer</button></div>
      </form>
    </section>

    <section class="section">
      <h2 class="section-title">Données</h2>
      ${dataModules.map(m => `<div class="row">
        <span class="row-main"><span class="row-title">${MODULE_LABELS[m]}</span></span>
        <button type="button" class="btn-text" data-export="${m}">Exporter</button>
        <button type="button" class="btn-text" data-import="${m}">Importer</button>
      </div>`).join('')}
      <input type="file" accept="application/json,.json" hidden>
    </section>

    <section class="section">
      <h2 class="section-title">Backup</h2>
      ${rowBtn('data-cloud-setup', 'Configurer le cloud', 'Backup chiffré quotidien vers un Gist privé')}
      ${rowBtn('data-cloud-restore', 'Restaurer depuis le cloud', 'Remplace tous les modules par le dernier backup')}
      ${rowBtn('data-bundle', 'Télécharger le bundle complet', 'Tous les modules, sans la clé API')}
      <p class="empty">${escapeHtml(cloudStatus(storage))}</p>
    </section>

    ${stores.mind ? `<section class="section">
      <h2 class="section-title">Sujets posés</h2>
      ${restedSubjects(stores.mind.doc).map(s => `<button type="button" class="row" data-mind="${escapeHtml(s.id)}">
        <span class="row-main"><span class="row-title">${escapeHtml(s.title)}</span><span class="row-sub">${escapeHtml(pathLabel(stores.mind.doc, s.id))}</span></span>
        <span class="row-aside">posé le ${escapeHtml(formatDate(s.restedAt))}</span>
      </button>`).join('') || "<p class=\"empty\">Rien de posé pour l'instant.</p>"}
    </section>` : ''}

    ${hasLegacy(storage) ? `<section class="section">
      <h2 class="section-title">Ancienne app Suivi</h2>
      ${rowBtn('data-legacy', 'Reprendre les données Suivi', 'Remplace Suivi, Pulsion et Tests par les anciennes données')}
    </section>` : ''}

    ${corrupt.length ? `<section class="section">
      <h2 class="section-title">Données illisibles</h2>
      ${corrupt.map(([n]) => `<div class="row">
        <span class="row-main"><span class="row-title">${MODULE_LABELS[n] ?? n}</span><span class="row-sub">Document mis de côté au démarrage</span></span>
        <button type="button" class="btn-text" data-recover="${n}">Télécharger</button>
        <button type="button" class="btn-text" data-forget="${n}">Oublier</button>
      </div>`).join('')}
    </section>` : ''}

    <p class="empty">Moi ${escapeHtml(ctx.version)}</p>
  `;

  const form = root.querySelector('#llm');
  form.provider.onchange = () => {
    const p = PRESETS[form.provider.value];
    form.model.value = p.defaultModel;
    form.model.placeholder = p.defaultModel || 'nom-du-modele';
    form.apiKey.placeholder = p.keyUrl ? `À créer sur ${p.keyUrl}` : 'Ta clé API';
    root.querySelector('[data-baseurl]').classList.toggle('hidden', form.provider.value !== 'custom');
  };
  form.onsubmit = e => {
    e.preventDefault();
    const fd = new FormData(form);
    stores.settings.commit(d => {
      d.llm = { provider: fd.get('provider'), apiKey: fd.get('apiKey').trim(), model: fd.get('model').trim(), baseUrl: fd.get('baseUrl').trim() };
    });
    ctx.notice('Enregistré.');
  };

  const fileInput = root.querySelector('input[type="file"]');
  let importTarget = null;
  fileInput.onchange = async () => {
    const file = fileInput.files?.[0];
    fileInput.value = '';
    if (!file || !importTarget) return;
    const m = importTarget;
    try {
      const doc = parseModuleExport(m, await file.text());
      const v = schemas[m].validate(doc);
      if (!v.ok) throw new Error(v.error);
      if (!confirm(`Remplacer toutes les données de ${MODULE_LABELS[m]} par ce fichier ?`)) return;
      stores[m].replace(doc);
      ctx.notice(`${MODULE_LABELS[m]} importé.`);
    } catch (err) { ctx.notice(err.message); }
  };

  async function restoreCloud() {
    if (!confirm('Restaurer depuis le cloud ? Les données actuelles de tous les modules seront remplacées.')) return;
    try {
      const text = await cloudRestore({ storage, ask: m => prompt(m) });
      const { modules, exportedAt } = parseBundle(text, schemas);
      const apiKey = stores.settings.doc.llm.apiKey;
      for (const [name, doc] of Object.entries(modules)) {
        if (name === 'settings') doc.llm.apiKey = apiKey; // la clé locale est conservée
        stores[name].replace(doc);
      }
      ctx.notice(`Restauré depuis le cloud (${(exportedAt || '').slice(0, 10)}).`);
      setTimeout(() => location.reload(), 800);
    } catch (err) { ctx.notice(`Restauration échouée : ${err.message}`); }
  }

  root.onclick = e => {
    const mind = e.target.closest('[data-mind]');
    if (mind) return ctx.navigate({ tab: 'mind', view: 's', id: mind.dataset.mind });
    const pref = e.target.closest('[data-theme-pref]');
    if (pref) { const k = pref.dataset.themePref; stores.settings.commit(d => { d.theme = k; }); ctx.applyTheme(k); return; }
    const ex = e.target.closest('[data-export]');
    if (ex) { const m = ex.dataset.export; return downloadText(moduleExportFilename(m, ctx.today()), moduleExportJson(m, stores[m].doc)); }
    const im = e.target.closest('[data-import]');
    if (im) { importTarget = im.dataset.import; return fileInput.click(); }
    if (e.target.closest('[data-cloud-setup]')) {
      return void cloudBackup({ storage, getJson: ctx.getBundle, todayKey: ctx.today(), ask: m => prompt(m), force: true })
        .then(r => { ctx.notice(r === 'ok' ? 'Cloud configuré — backup poussé.' : `Cloud : ${r}`); stores.settings.commit(() => {}); });
    }
    if (e.target.closest('[data-cloud-restore]')) return void restoreCloud();
    if (e.target.closest('[data-bundle]')) return downloadText(`moi_${ctx.today()}.json`, ctx.getBundle());
    if (e.target.closest('[data-legacy]')) {
      if (!confirm('Remplacer Suivi, Pulsion et Tests par les anciennes données ?')) return;
      const done = migrateLegacy(storage, stores);
      return ctx.notice(done.length ? 'Données Suivi reprises.' : 'Rien à reprendre.');
    }
    const rec = e.target.closest('[data-recover]');
    if (rec) return downloadText(`moi-${rec.dataset.recover}-illisible.json`, stores[rec.dataset.recover].corrupt);
    const forget = e.target.closest('[data-forget]');
    if (forget && confirm('Oublier définitivement ces données illisibles ?')) { stores[forget.dataset.forget].clearCorrupt(); ctx.notice('Oublié.'); }
  };
}
