// Pulsion : protocole et envie sur le vif, pression du jour, actes datés avec tags libres, données du module.
import { addDays, frShort, hhmm } from '../../../core/dates.js';
import { pm, fmt } from '../../../core/stats.js';
import { sparkline } from '../../../core/chart.js';
import { sliderHtml, dayNavHtml, escapeHtml, copyText, openSheet, closeSheet } from '../../../core/ui.js';
import { NATURES, NATURE_ORDER, URGE_ANCHORS, emptyDay, normTags } from '../schema.js';
import { stats, marks, episodeDays, lastEvents, lastEpisodes, tagFrequencies, hourHistogram, bilan } from '../queries.js';
import { setDayFieldSoon, addEvent, addEpisode } from '../ops.js';
import { eventMarks } from '../../suivi/views/data.js';

// État d'écran : jour sélectionné, fenêtre des courbes, acte en cours de saisie.
let selDay = null;
let win = 14;
let draft = null; // { nature, triggers, day }

const DECIDE_AFTER_MS = 10 * 60 * 1000;
const dayOf = (store, key) => ({ ...emptyDay(), ...(store.doc.days[key] ?? {}) });
const st = (k, v) => `<div class="st"><span class="k">${k}</span><span class="v mono">${v}</span></div>`;
const lower = t => escapeHtml(t.toLowerCase());

// Tags libres : les plus fréquents de l'historique en suggestion, ceux choisis toujours visibles, un + pour créer.
function tagChips(doc, selected) {
  const top = tagFrequencies(doc).slice(0, 8).map(t => t.tag);
  const shown = [...top];
  for (const t of selected) if (!shown.some(x => x.toLowerCase() === t.toLowerCase())) shown.push(t);
  return `<div class="chips" data-tags>${shown.map(t => `<button type="button" class="chip${selected.some(x => x.toLowerCase() === t.toLowerCase()) ? ' on' : ''}" data-tag="${escapeHtml(t)}">${escapeHtml(t)}</button>`).join('')}<button type="button" class="chip" data-tag-add>+</button></div>`;
}

function toggleTag(list, tag) {
  const i = list.findIndex(x => x.toLowerCase() === tag.toLowerCase());
  if (i >= 0) list.splice(i, 1); else list.push(tag);
}

function askTag() {
  const r = prompt('Déclencheur ? (ex : fatigue, au lit, image accidentelle)');
  return r === null ? null : (normTags([r])[0] ?? null);
}

function hoursHtml(list, days, color) {
  const h = hourHistogram(list, days);
  const max = Math.max(1, ...h);
  return `<div class="hours">${h.map((n, i) => `<div class="hour" title="${i} h : ${n}"><div class="bar" style="height:${Math.round((n / max) * 100)}%;background:${color}"></div></div>`).join('')}</div>`;
}

function draftHtml(doc, t) {
  if (!draft) {
    return `<div class="stack">${NATURE_ORDER.map(n => `<button type="button" class="btn btn-nat" data-nature="${n}">
      <span>${escapeHtml(NATURES[n].label)}</span><span class="dot" style="background:${NATURES[n].css}"></span></button>`).join('')}</div>`;
  }
  const withTags = draft.nature !== 'partenaire';
  const yesterday = addDays(t, -1);
  return `<div class="card">
    <div class="srow"><span>${escapeHtml(NATURES[draft.nature].label)}</span><span class="dot" style="background:${NATURES[draft.nature].css}"></span></div>
    ${withTags ? `<div class="tiny">Déclencheurs, si tu les vois</div>${tagChips(doc, draft.triggers)}` : ''}
    <div class="tiny" style="margin-top:12px">Quel jour ?</div>
    <div class="chips pick">
      <button type="button" class="chip${draft.day === t ? ' on' : ''}" data-day="${t}">Aujourd'hui</button>
      <button type="button" class="chip${draft.day === yesterday ? ' on' : ''}" data-day="${yesterday}">Hier</button>
      <input type="date" class="chip${draft.day !== t && draft.day !== yesterday ? ' on' : ''}" data-day-input max="${t}" value="${draft.day}" aria-label="Autre date">
    </div>
    <div class="rowbtns">
      <button type="button" class="btn" data-save>Enregistrer</button>
      <button type="button" class="btn btn-ghost" data-cancel>Annuler</button>
    </div>
  </div>`;
}

function evList(doc) {
  const a = lastEvents(doc, 8);
  if (!a.length) return '<span class="tiny">aucun</span>';
  return a.map(e => `<i style="background:${NATURES[e.nature].css}"></i>${frShort(e.day)} <span class="tiny">${lower(NATURES[e.nature].label)}${e.triggers?.length ? ' · ' + e.triggers.map(lower).join(', ') : ''} · saisi ${escapeHtml(hhmm(e.ts))}</span>`).join('<br>');
}

function episodeList(doc) {
  const a = lastEpisodes(doc, 8);
  if (!a.length) return '<span class="tiny">aucun</span>';
  return a.map(p => `<i class="hollow"></i>${frShort(p.day)} ${escapeHtml(hhmm(p.ts))} <span class="tiny">intensité ${p.intensity}${p.exposed ? ' · contenu vu' : ''}${p.triggers.length ? ' · ' + p.triggers.map(escapeHtml).join(', ') : ''}</span>`).join('<br>');
}

function openEpisodeSheet(store, ctx) {
  const selected = [];
  let exposed = false, intensity = 5;
  const sheet = openSheet(`
    <h2>Envie forte maintenant</h2>
    ${sliderHtml({ field: 'intensity', label: 'Intensité', value: 5, anchors: URGE_ANCHORS })}
    <div class="tiny" style="margin-top:10px">Déclencheurs, si tu les vois</div>
    <div data-tags-wrap>${tagChips(store.doc, selected)}</div>
    <label class="row" style="border:0"><input type="checkbox" class="check" data-exposed> <span class="row-main">Contenu vu</span></label>
    <div class="sheet-actions">
      <button type="button" class="btn-text" data-cancel>Annuler</button>
      <button type="button" class="btn" data-save-episode>Enregistrer</button>
    </div>
  `);
  sheet.oninput = e => { const r = e.target.closest('[data-range]'); if (r) { intensity = Number(r.value); sheet.querySelector('[data-out="intensity"]').textContent = intensity; } };
  sheet.onchange = e => { const x = e.target.closest('[data-exposed]'); if (x) exposed = x.checked; };
  sheet.onclick = e => {
    const tag = e.target.closest('[data-tag]');
    if (tag) { toggleTag(selected, tag.dataset.tag); sheet.querySelector('[data-tags-wrap]').innerHTML = tagChips(store.doc, selected); return; }
    if (e.target.closest('[data-tag-add]')) { const t = askTag(); if (t) { toggleTag(selected, t); sheet.querySelector('[data-tags-wrap]').innerHTML = tagChips(store.doc, selected); } return; }
    if (e.target.closest('[data-cancel]')) return closeSheet();
    if (e.target.closest('[data-save-episode]')) {
      try {
        addEpisode(store, { intensity, triggers: selected, exposed }, ctx.today());
        closeSheet();
        ctx.notice('Noté. Tu décides dans 10 minutes, pas maintenant.');
      } catch (err) { ctx.notice(err.message); }
    }
  };
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
  const epDays = episodeDays(doc);
  const hollow = s.keys.map((k, i) => (epDays.has(k) ? { i, color: 'var(--accent)' } : null)).filter(Boolean);
  // « Tu décides à » : lu dans le document, donc juste dès le redessin qui suit l'enregistrement, et après un rechargement.
  const lastTs = lastEpisodes(doc, 1)[0]?.ts;
  const decideAt = lastTs && Date.now() - new Date(lastTs).getTime() < DECIDE_AFTER_MS
    ? hhmm(new Date(new Date(lastTs).getTime() + DECIDE_AFTER_MS).toISOString()) : null;
  const winDays = new Set(s.keys);

  root.innerHTML = `
    <div class="card protocol">
      <div class="card-title">Protocole 10 minutes</div>
      <ol>
        <li>1. Pas d'interdiction : tu décides dans 10 min, pas maintenant.</li>
        <li>2. Une action physique tout de suite : sortir marcher, pompes, douche, atelier.</li>
        <li>3. S'il y a acte, tu le logges ci-dessous. Sinon, rien à faire.</li>
      </ol>
      ${decideAt ? `<p class="tiny" style="margin-top:8px">Épisode noté. Tu décides à <span class="mono">${decideAt}</span>.</p>` : ''}
      <button type="button" class="btn" style="margin-top:12px" data-episode>Envie forte maintenant</button>
      <p class="note">« Contenu » = tout support pornographique ou érotique, quel que soit le site, l'app ou le format (vidéo, images, reddit, réseaux). Définition fixée à froid — pas renégociable sur le moment.</p>
    </div>

    <div class="label">Pression du jour</div>
    ${dayNavHtml(selDay, t)}
    <div class="card">${sliderHtml({ field: 'urge', label: "Pression de l'envie", value: day.urge, anchors: URGE_ANCHORS })}</div>

    <div class="label">Enregistrer un acte</div>
    ${draftHtml(doc, t)}
    <p class="note">Aucun compteur, aucune remise à zéro : on enregistre une date et une nature, rien d'autre. Ce qui compte se lit sur les courbes, dans les jours qui suivent.</p>

    <div class="label">Données</div>
    <div class="card">
      <div class="chips win">${[14, 30, 90].map(n => `<button type="button" class="chip${win === n ? ' on' : ''}" data-win="${n}">${n} j</button>`).join('')}</div>
      <div class="srow small"><span class="tiny">Pression de l'envie</span><span class="mono tiny">${pm(s.urge.m, s.urge.sd, '/10')} · var ${fmt(s.urge.v)}</span></div>
      ${sparkline({ values: s.series.urge, color: 'var(--accent)', marks: mk, hollowDots: hollow })}
      <div class="lg">${NATURE_ORDER.map(n => `<span><i style="background:${NATURES[n].css}"></i>${escapeHtml(NATURES[n].label)}</span>`).join('')}<span><i class="hollow"></i>épisode</span></div>
      <div class="sep"></div>
      <div class="tiny" style="margin-bottom:4px">Épisodes par heure, sur ${win} j</div>
      ${hoursHtml(doc.episodes ?? [], winDays, 'var(--accent)')}
      <div class="tiny" style="margin:8px 0 4px">Actes par heure, sur ${win} j (saisis le jour même)</div>
      ${hoursHtml(doc.events, winDays, 'var(--nat-contenu)')}
      <div class="hours-axis tiny"><span>0 h</span><span>6 h</span><span>12 h</span><span>18 h</span><span>24 h</span></div>
    </div>
    <div class="card">
      ${st('7 derniers jours', `pression ${pm(s7.urge.m, s7.urge.sd, '/10')} · soirs ≥4 : ${s7.evenings4}`)}
      ${st('Épisodes', s7.episodes.length ? `${s7.episodes.length} · dont ${s7.exposed} avec contenu · intensité ${pm(s7.intensity.m, s7.intensity.sd, '/10')}` : '—')}
      ${NATURE_ORDER.map(n => st(escapeHtml(NATURES[n].label), s7.byNature[n].length
        ? s7.byNature[n].map(e => frShort(e.day) + (e.triggers?.length ? ' · ' + e.triggers.map(lower).join(', ') : '')).join('<br>') : '—')).join('')}
    </div>
    <div class="card">
      <div class="tiny" style="margin-bottom:6px">Derniers épisodes</div>
      <div class="evlist">${episodeList(doc)}</div>
    </div>
    <div class="card">
      <div class="tiny" style="margin-bottom:6px">Derniers actes</div>
      <div class="evlist">${evList(doc)}</div>
    </div>
    <div class="card"><button type="button" class="btn" data-copy>Copier le bilan pulsion</button></div>
  `;

  root.onclick = e => {
    if (e.target.closest('[data-episode]')) return openEpisodeSheet(store, ctx);
    const nav = e.target.closest('[data-daynav]');
    if (nav) { if (!nav.disabled) { const next = addDays(selDay, Number(nav.dataset.daynav)); if (next <= t) { selDay = next; render(root, ctx); } } return; }
    const nat = e.target.closest('[data-nature]');
    if (nat) { draft = { nature: nat.dataset.nature, triggers: [], day: t }; return render(root, ctx); }
    const tag = e.target.closest('[data-tag]');
    if (tag && draft) { toggleTag(draft.triggers, tag.dataset.tag); return render(root, ctx); }
    if (e.target.closest('[data-tag-add]') && draft) { const nt = askTag(); if (nt) toggleTag(draft.triggers, nt); return render(root, ctx); }
    const dayBtn = e.target.closest('[data-day]');
    if (dayBtn) { draft.day = dayBtn.dataset.day; return render(root, ctx); }
    if (e.target.closest('[data-cancel]')) { draft = null; return render(root, ctx); }
    if (e.target.closest('[data-save]')) {
      // Le brouillon est vidé AVANT l'écriture : le store notifie pendant addEvent et l'écran se redessine à ce moment-là.
      const pending = draft;
      draft = null;
      try {
        const ev = addEvent(store, pending, t);
        ctx.notice(ev.nature === 'contenu'
          ? "Enregistré comme donnée. Pas de procès. Prochaine action : protéger le sommeil de ce soir — coucher à l'heure prévue, téléphone hors chambre."
          : 'Enregistré.');
      } catch (err) { draft = pending; ctx.notice(err.message); }
      return render(root, ctx);
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
    if (d && draft && d.value && d.value <= t) { draft.day = d.value; render(root, ctx); }
  };
}
