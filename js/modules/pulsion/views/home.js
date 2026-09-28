// Pulsion : protocole, pression et checks du jour, enregistrement d'un acte daté, données du module.
import { addDays, frShort, hhmm } from '../../../core/dates.js';
import { pm, fmt } from '../../../core/stats.js';
import { sparkline } from '../../../core/chart.js';
import { sliderHtml, chipsHtml, dayNavHtml, escapeHtml, copyText } from '../../../core/ui.js';
import { NATURES, NATURE_ORDER, TRIGGERS, CHECK_PRESETS, URGE_ANCHORS, emptyDay } from '../schema.js';
import { stats, marks, lastEvents, bilan } from '../queries.js';
import { setDayField, setDayFieldSoon, addEvent } from '../ops.js';
import { eventMarks } from '../../suivi/views/data.js';

// État d'écran : jour sélectionné, fenêtre des courbes, acte en cours de saisie.
let selDay = null;
let win = 14;
let draft = null; // { nature, trigger, day }

const dayOf = (store, key) => ({ ...emptyDay(), ...(store.doc.days[key] ?? {}) });
const st = (k, v) => `<div class="st"><span class="k">${k}</span><span class="v mono">${v}</span></div>`;

function draftHtml(t) {
  if (!draft) {
    return `<div class="stack">${NATURE_ORDER.map(n => `<button type="button" class="btn btn-nat" data-nature="${n}">
      <span>${escapeHtml(NATURES[n].label)}</span><span class="dot" style="background:${NATURES[n].css}"></span></button>`).join('')}</div>`;
  }
  const needTrigger = draft.nature !== 'partenaire';
  const yesterday = addDays(t, -1);
  return `<div class="card">
    <div class="srow"><span>${escapeHtml(NATURES[draft.nature].label)}</span><span class="dot" style="background:${NATURES[draft.nature].css}"></span></div>
    ${needTrigger ? `<div class="tiny">Déclencheur principal ?</div>
      <div class="chips">${TRIGGERS.map(tr => `<button type="button" class="chip${draft.trigger === tr ? ' on' : ''}" data-trigger="${escapeHtml(tr)}">${escapeHtml(tr)}</button>`).join('')}</div>` : ''}
    <div class="tiny" style="margin-top:12px">Quel jour ?</div>
    <div class="chips pick">
      <button type="button" class="chip${draft.day === t ? ' on' : ''}" data-day="${t}">Aujourd'hui</button>
      <button type="button" class="chip${draft.day === yesterday ? ' on' : ''}" data-day="${yesterday}">Hier</button>
      <input type="date" class="chip${draft.day !== t && draft.day !== yesterday ? ' on' : ''}" data-day-input max="${t}" value="${draft.day}" aria-label="Autre date">
    </div>
    <div class="rowbtns">
      <button type="button" class="btn" data-save${needTrigger && !draft.trigger ? ' disabled' : ''}>Enregistrer</button>
      <button type="button" class="btn btn-ghost" data-cancel>Annuler</button>
    </div>
  </div>`;
}

function evList(doc) {
  const a = lastEvents(doc, 8);
  if (!a.length) return '<span class="tiny">aucun</span>';
  return a.map(e => `<i style="background:${NATURES[e.nature].css}"></i>${frShort(e.day)} <span class="tiny">${escapeHtml(NATURES[e.nature].label.toLowerCase())}${e.trigger ? ' · ' + escapeHtml(e.trigger.toLowerCase()) : ''} · saisi ${frShort(e.ts.slice(0, 10))} ${hhmm(e.ts)}</span>`).join('<br>');
}

export function render(root, ctx) {
  const t = ctx.today();
  if (!selDay || selDay > t) selDay = t;
  const store = ctx.stores.pulsion;
  const doc = store.doc;
  const day = dayOf(store, selDay);
  const s7 = stats(doc, 7, t);
  const s = stats(doc, win, t);
  const mk = eventMarks(s.keys, marks(doc));

  root.innerHTML = `
    <div class="card protocol">
      <div class="card-title">Protocole 10 minutes</div>
      <ol>
        <li>1. Pas d'interdiction : tu décides dans 10 min, pas maintenant.</li>
        <li>2. Une action physique tout de suite : sortir marcher, pompes, douche, atelier.</li>
        <li>3. S'il y a acte, tu le logges ci-dessous. Sinon, rien à faire.</li>
      </ol>
      <p class="note">« Contenu » = tout support pornographique ou érotique, quel que soit le site, l'app ou le format (vidéo, images, reddit, réseaux). Définition fixée à froid — pas renégociable sur le moment.</p>
    </div>

    <div class="label">Aujourd'hui</div>
    ${dayNavHtml(selDay, t)}
    <div class="card">${sliderHtml({ field: 'urge', label: "Pression de l'envie", value: day.urge, anchors: URGE_ANCHORS })}</div>
    <div class="card">
      <div class="srow"><span>Checks — contenu vu, sans acte</span><span class="mono" data-out="checksMin">${day.checksMin == null ? '—' : day.checksMin + ' min'}</span></div>
      ${chipsHtml({ field: 'checksMin', options: CHECK_PRESETS, value: day.checksMin })}
    </div>

    <div class="label">Enregistrer un acte</div>
    ${draftHtml(t)}
    <p class="note">Aucun compteur, aucune remise à zéro : on enregistre une date et une nature, rien d'autre. Ce qui compte se lit sur les courbes, dans les jours qui suivent.</p>

    <div class="label">Données</div>
    <div class="card">
      <div class="chips win">${[14, 30, 90].map(n => `<button type="button" class="chip${win === n ? ' on' : ''}" data-win="${n}">${n} j</button>`).join('')}</div>
      <div class="srow small"><span class="tiny">Pression de l'envie</span><span class="mono tiny">${pm(s.urge.m, s.urge.sd, '/10')} · var ${fmt(s.urge.v)}</span></div>
      ${sparkline({ values: s.series.urge, color: 'var(--accent)', marks: mk })}
      <div class="lg">${NATURE_ORDER.map(n => `<span><i style="background:${NATURES[n].css}"></i>${escapeHtml(NATURES[n].label)}</span>`).join('')}</div>
    </div>
    <div class="card">
      ${st('7 derniers jours', `pression ${pm(s7.urge.m, s7.urge.sd, '/10')} · soirs ≥4 : ${s7.evenings4}`)}
      ${st('Checks', `${s7.checksVol} min · ${s7.checksDays} j`)}
      ${NATURE_ORDER.map(n => st(escapeHtml(NATURES[n].label), s7.byNature[n].length
        ? s7.byNature[n].map(e => frShort(e.day) + (e.trigger ? ' · ' + escapeHtml(e.trigger.toLowerCase()) : '')).join('<br>') : '—')).join('')}
    </div>
    <div class="card">
      <div class="tiny" style="margin-bottom:6px">Derniers actes</div>
      <div class="evlist">${evList(doc)}</div>
    </div>
    <div class="card"><button type="button" class="btn" data-copy>Copier le bilan pulsion</button></div>
  `;

  root.onclick = e => {
    const nav = e.target.closest('[data-daynav]');
    if (nav) { if (!nav.disabled) { const next = addDays(selDay, Number(nav.dataset.daynav)); if (next <= t) { selDay = next; render(root, ctx); } } return; }
    const chip = e.target.closest('[data-chips="checksMin"] [data-chip]');
    if (chip) {
      let v = chip.dataset.chip;
      if (v === 'other') { const r = prompt('Durée en minutes ?', day.checksMin ?? ''); if (r === null) return; v = r; }
      const n = parseInt(v, 10);
      if (!Number.isInteger(n) || n < 0 || n > 1440) { ctx.notice('Durée invalide.'); return; }
      setDayField(store, selDay, 'checksMin', n);
      return render(root, ctx);
    }
    const nat = e.target.closest('[data-nature]');
    if (nat) { draft = { nature: nat.dataset.nature, trigger: null, day: t }; return render(root, ctx); }
    const trig = e.target.closest('[data-trigger]');
    if (trig) { draft.trigger = trig.dataset.trigger; return render(root, ctx); }
    const dayBtn = e.target.closest('[data-day]');
    if (dayBtn) { draft.day = dayBtn.dataset.day; return render(root, ctx); }
    if (e.target.closest('[data-cancel]')) { draft = null; return render(root, ctx); }
    if (e.target.closest('[data-save]')) {
      try {
        const ev = addEvent(store, draft, t);
        draft = null;
        ctx.notice(ev.nature === 'contenu'
          ? "Enregistré comme donnée. Pas de procès. Prochaine action : protéger le sommeil de ce soir — coucher à l'heure prévue, téléphone hors chambre."
          : 'Enregistré.');
      } catch (err) { ctx.notice(err.message); }
      return; // le store notifie, l'écran se rerend
    }
    const w = e.target.closest('[data-win]');
    if (w) { win = Number(w.dataset.win); return render(root, ctx); }
    if (e.target.closest('[data-copy]')) copyText(bilan(doc, t)).then(() => ctx.notice('Bilan copié.')).catch(() => ctx.notice('Copie impossible.'));
  };
  root.oninput = e => {
    const r = e.target.closest('[data-range]');
    if (!r) return;
    const v = Number(r.value);
    setDayFieldSoon(store, selDay, 'urge', v);
    root.querySelector('[data-out="urge"]').textContent = v;
  };
  root.onchange = e => {
    const d = e.target.closest('[data-day-input]');
    if (d && d.value && d.value <= t) { draft.day = d.value; render(root, ctx); }
  };
}
