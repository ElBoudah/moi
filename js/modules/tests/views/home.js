// Tests : une carte par test du catalogue, courbe à partir du deuxième run, historique tous tests.
import { frShort, hhmm } from '../../../core/dates.js';
import { sparkline } from '../../../core/chart.js';
import { escapeHtml } from '../../../core/ui.js';
import { CATALOG, runsOfAny, summaryFor } from '../catalog/index.js';
import { history } from '../queries.js';

function chartHtml(runs, chart) {
  if (runs.length === 0) return '<div class="chart-empty">Courbe à partir du 2ᵉ run.</div>';
  if (runs.length === 1) return '<div class="chart-empty">1 run enregistré — la courbe démarre au prochain.</div>';
  const values = runs.map(chart.value);
  const nums = values.filter(v => v !== null);
  if (!nums.length) return '<div class="chart-empty">Pas de valeur exploitable.</div>';
  return `<div class="chart-hd"><span class="tiny">${escapeHtml(chart.title)}</span></div>
    ${sparkline({ values, min: null, max: null })}
    <div class="chart-ft tiny"><span>${escapeHtml(frShort(runs[0].day))}</span><span class="mono">${Math.round(Math.min(...nums))}–${Math.round(Math.max(...nums))}</span><span>${escapeHtml(frShort(runs[runs.length - 1].day))}</span></div>`;
}

function card(doc, t) {
  const runs = runsOfAny(doc, t);
  const last = runs.length ? runs[runs.length - 1] : null;
  return `<div class="card">
    <div class="card-title">${escapeHtml(t.label)}</div>
    <div class="tiny">${escapeHtml(t.subtitle)}</div>
    <div class="tiny" style="margin-top:8px">${last ? `Dernier : ${escapeHtml(frShort(last.day))} ${escapeHtml(hhmm(last.ts))} — ${escapeHtml(t.summary(last))}` : 'Jamais lancé'}</div>
    <div class="chart">${chartHtml(runs, t.chart)}</div>
    ${t.note ? `<p class="note">${escapeHtml(t.note)}</p>` : ''}
    <button type="button" class="btn" style="margin-top:12px" data-run="${escapeHtml(t.id)}">Lancer</button>
  </div>`;
}

export function render(root, ctx) {
  const doc = ctx.stores.tests.doc;
  const runs = history(doc, 12);
  root.innerHTML = `
    <p class="note" style="margin:6px 0 14px">Instruments de mesure, pas d'entraînement. Toujours au même créneau horaire, même état caféine. Seule la tendance sur plusieurs semaines veut dire quelque chose.</p>
    ${CATALOG.map(t => card(doc, t)).join('')}
    <div class="label">Historique</div>
    <div class="card evlist">${runs.length
      ? runs.map(r => `<span class="tiny">${escapeHtml(frShort(r.day))} ${escapeHtml(hhmm(r.ts))}</span> — ${escapeHtml(summaryFor(r))}`).join('<br>')
      : '<span class="tiny">Aucun run enregistré.</span>'}</div>
  `;
  root.onclick = e => {
    const b = e.target.closest('[data-run]');
    if (b) ctx.navigate({ tab: 'tests', view: 'run', id: b.dataset.run });
  };
}
