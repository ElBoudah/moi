// Saisie du soir : sommeil et quatre curseurs ancrés, un jour à la fois.
import { addDays, hm } from '../../../core/dates.js';
import { sliderHtml, chipsHtml, dayNavHtml, escapeHtml } from '../../../core/ui.js';
import { SLIDERS, LABELS, ANCHORS, SLEEP_PRESETS, NOTE_MAX, emptyDay } from '../schema.js';
import { durMin, sleepMin } from '../queries.js';
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
      <div class="srow small"><span class="tiny">Au lit</span><span class="mono" data-out="dur">${hm(durMin(day))}</span></div>
      <div class="sep"></div>
      <div class="srow" style="margin-bottom:0"><span>Endormi en</span><span class="mono" data-out="onsetMin">${day.onsetMin == null ? '—' : day.onsetMin + ' min'}</span></div>
      ${chipsHtml({ field: 'onsetMin', options: SLEEP_PRESETS, value: day.onsetMin })}
      <div class="srow" style="margin:12px 0 0"><span>Éveillé la nuit</span><span class="mono" data-out="awakeMin">${day.awakeMin == null ? '—' : day.awakeMin + ' min'}</span></div>
      ${chipsHtml({ field: 'awakeMin', options: SLEEP_PRESETS, value: day.awakeMin })}
      <div class="srow small"><span class="tiny">Dormi</span><span class="mono" data-out="sleep">${hm(sleepMin(day))}</span></div>
    </div>
    <div class="label">État du jour</div>
    ${SLIDERS.map(f => `<div class="card">${sliderHtml({ field: f, label: LABELS[f], value: day[f], anchors: ANCHORS[f], cls: `c-${f}` })}</div>`).join('')}
    <div class="label">Journée</div>
    <div class="card">
      <div class="srow" style="margin-bottom:8px"><span>Note du jour</span><span class="tiny">optionnelle</span></div>
      <textarea data-note rows="2" maxlength="${NOTE_MAX}" placeholder="Un événement, un contexte — une phrase suffit.">${escapeHtml(day.note ?? '')}</textarea>
      <div class="cnt tiny" data-out="note-cnt">${(day.note ?? '').length}/${NOTE_MAX}</div>
    </div>
  `;

  root.onclick = e => {
    const nav = e.target.closest('[data-daynav]');
    if (nav) {
      if (nav.disabled) return;
      flushPending();
      const next = addDays(selDay, Number(nav.dataset.daynav));
      if (next <= t) { selDay = next; render(root, ctx); }
      return;
    }
    const chip = e.target.closest('[data-chips] [data-chip]');
    if (!chip) return;
    flushPending(); // une note en attente doit être écrite avant le redessin
    const field = chip.closest('[data-chips]').dataset.chips;
    let v = chip.dataset.chip;
    if (v === 'other') { const r = prompt('Durée en minutes ?', day[field] ?? ''); if (r === null) return; v = r.trim(); }
    const n = v === '' ? null : Number(v);
    if (n !== null && !Number.isInteger(n)) return ctx.notice('Durée invalide.');
    try { setDayField(store, selDay, field, n); } catch (err) { return ctx.notice(err.message); }
    render(root, ctx);
  };
  root.oninput = e => {
    const note = e.target.closest('[data-note]');
    if (note) {
      const v = note.value.slice(0, NOTE_MAX);
      setDayFieldSoon(store, selDay, 'note', v);
      root.querySelector('[data-out="note-cnt"]').textContent = `${v.length}/${NOTE_MAX}`;
      return;
    }
    const r = e.target.closest('[data-range]');
    if (!r) return;
    const v = Number(r.value);
    setDayFieldSoon(store, selDay, r.dataset.range, v);
    root.querySelector(`[data-out="${r.dataset.range}"]`).textContent = v;
  };
  root.onchange = e => {
    if (e.target.closest('[data-range]') || e.target.closest('[data-note]')) { flushPending(); return; }
    const ti = e.target.closest('[data-time]');
    if (!ti) return;
    try { setDayField(store, selDay, ti.dataset.time, ti.value || null); } catch (err) { ctx.notice(err.message); }
    const d = dayOf(store, selDay);
    root.querySelector('[data-out="dur"]').textContent = hm(durMin(d));
    root.querySelector('[data-out="sleep"]').textContent = hm(sleepMin(d));
  };
}
