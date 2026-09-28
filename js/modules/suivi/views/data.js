// Données Suivi : bloc 7 jours, quatre sparklines avec repères d'actes (lecture seule de Pulsion), bilan copiable.
import { hm } from '../../../core/dates.js';
import { pm, fmt } from '../../../core/stats.js';
import { sparkline } from '../../../core/chart.js';
import { escapeHtml, copyText } from '../../../core/ui.js';
import { SLIDERS, LABELS } from '../schema.js';
import { stats, bilan } from '../queries.js';
import { marks } from '../../pulsion/queries.js';
import { NATURES, NATURE_ORDER } from '../../pulsion/schema.js';
import { subTabs } from './day.js';

let win = 14; // état d'écran
const COLORS = { clarity: 'var(--c-clarity)', mood: 'var(--c-mood)', pleasure: 'var(--c-pleasure)', drive: 'var(--c-drive)' };

export function eventMarks(keys, byDay) {
  return keys.map((k, i) => (byDay[k] ? { i, color: NATURES[byDay[k]].css } : null)).filter(Boolean);
}

export function render(root, ctx) {
  const t = ctx.today();
  const doc = ctx.stores.suivi.doc;
  const s7 = stats(doc, 7, t);
  const s = stats(doc, win, t);
  const mk = eventMarks(s.keys, marks(ctx.stores.pulsion.doc));
  const st = (k, v) => `<div class="st"><span class="k">${k}</span><span class="v mono">${v}</span></div>`;
  const dur = s7.dur.m == null ? '—' : hm(s7.dur.m) + (s7.dur.sd == null ? '' : ` ± ${Math.round(s7.dur.sd)} min`);
  const slept = s7.sleep.m == null ? '—' : hm(s7.sleep.m);
  const eff = s7.eff == null ? '—' : `${Math.round(s7.eff * 100)} %`;
  const reg = s7.bedSD == null ? '—' : `± ${Math.round(s7.bedSD)} min`;

  root.innerHTML = `
    ${subTabs('data')}
    <div class="card">
      ${st('7 derniers jours', `${s7.logged}/7 jours loggés`)}
      ${st('Sommeil', `${s7.nights} nuits · au lit ${dur}<br>dormi ${slept} · efficacité ${eff}<br>coucher ${reg}`)}
      ${SLIDERS.map(f => st(LABELS[f], `${pm(s7.packs[f].m, s7.packs[f].sd, '/10')} · var ${fmt(s7.packs[f].v)}`)).join('')}
    </div>
    <div class="card">
      <div class="chips win">${[14, 30, 90].map(n => `<button type="button" class="chip${win === n ? ' on' : ''}" data-win="${n}">${n} j</button>`).join('')}</div>
      ${SLIDERS.map((f, i) => `${i ? '<div class="sep"></div>' : ''}
        <div class="srow small"><span class="tiny">${LABELS[f]}</span><span class="mono tiny" style="color:${COLORS[f]}">${pm(s.packs[f].m, s.packs[f].sd, '/10')} · var ${fmt(s.packs[f].v)}</span></div>
        ${sparkline({ values: s.series[f], color: COLORS[f], marks: mk })}`).join('')}
      <p class="note">± = dispersion. « var » = variation moyenne d'un jour au suivant : c'est elle qui mesure la stabilité, pas la moyenne.</p>
      <div class="lg">${NATURE_ORDER.map(n => `<span><i style="background:${NATURES[n].css}"></i>${escapeHtml(NATURES[n].label)}</span>`).join('')}</div>
    </div>
    <div class="card"><button type="button" class="btn" data-copy>Copier le bilan hebdo</button></div>
  `;

  root.onclick = e => {
    const w = e.target.closest('[data-win]');
    if (w) { win = Number(w.dataset.win); render(root, ctx); return; }
    if (e.target.closest('[data-copy]')) {
      copyText(bilan(doc, t)).then(() => ctx.notice('Bilan copié.')).catch(() => ctx.notice('Copie impossible.'));
    }
  };
}
