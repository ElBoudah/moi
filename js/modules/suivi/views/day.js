// Saisie du soir : sommeil et quatre curseurs ancrés, un jour à la fois.
import { addDays, hm } from '../../../core/dates.js';
import { sliderHtml, dayNavHtml, escapeHtml } from '../../../core/ui.js';
import { SLIDERS, LABELS, ANCHORS, emptyDay } from '../schema.js';
import { durMin } from '../queries.js';
import { setDayField, setDayFieldSoon, flushPending } from '../ops.js';

let selDay = null; // état d'écran, pas une donnée

export function subTabs(current) {
  return `<div class="subtabs">
    <a href="#/suivi" class="${current === 'home' ? 'on' : ''}">Jour</a>
    <a href="#/suivi/data" class="${current === 'data' ? 'on' : ''}">Données</a>
  </div>`;
}

const dayOf = (store, key) => ({ ...emptyDay(), ...(store.doc.days[key] ?? {}) });

export function render(root, ctx) {
  const t = ctx.today();
  if (!selDay || selDay > t) selDay = t;
  const store = ctx.stores.suivi;
  const day = dayOf(store, selDay);

  root.innerHTML = `
    ${subTabs('home')}
    ${dayNavHtml(selDay, t)}
    <div class="label">Sommeil</div>
    <div class="card">
      <div class="timerow">
        <label class="tf"><span class="tl">Coucher (hier soir)</span><input type="time" data-time="bed" value="${escapeHtml(day.bed ?? '')}"></label>
        <label class="tf"><span class="tl">Lever (ce matin)</span><input type="time" data-time="wake" value="${escapeHtml(day.wake ?? '')}"></label>
      </div>
      <div class="srow small"><span class="tiny">Durée</span><span class="mono" data-out="dur">${hm(durMin(day))}</span></div>
    </div>
    <div class="label">État du jour</div>
    ${SLIDERS.map(f => `<div class="card">${sliderHtml({ field: f, label: LABELS[f], value: day[f], anchors: ANCHORS[f], cls: `c-${f}` })}</div>`).join('')}
  `;

  root.onclick = e => {
    const nav = e.target.closest('[data-daynav]');
    if (!nav || nav.disabled) return;
    flushPending();
    const next = addDays(selDay, Number(nav.dataset.daynav));
    if (next <= t) { selDay = next; render(root, ctx); }
  };
  root.oninput = e => {
    const r = e.target.closest('[data-range]');
    if (!r) return;
    const v = Number(r.value);
    setDayFieldSoon(store, selDay, r.dataset.range, v);
    root.querySelector(`[data-out="${r.dataset.range}"]`).textContent = v;
  };
  root.onchange = e => {
    if (e.target.closest('[data-range]')) { flushPending(); return; }
    const ti = e.target.closest('[data-time]');
    if (!ti) return;
    try { setDayField(store, selDay, ti.dataset.time, ti.value || null); } catch (err) { ctx.notice(err.message); }
    root.querySelector('[data-out="dur"]').textContent = hm(durMin(dayOf(store, selDay)));
  };
}
