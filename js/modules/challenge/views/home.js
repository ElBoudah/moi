// Challenge : un seul actif, une bande de cases, aucun compteur de retard, aucune analyse.
import { frShort } from '../../../core/dates.js';
import { escapeHtml } from '../../../core/ui.js';
import { DURATIONS, targetLabel } from '../schema.js';
import { active, past, endDay, dayStrip, weekCount, dayNumber, doneCount } from '../queries.js';
import { createChallenge, toggleDone, stopChallenge } from '../ops.js';

function stripHtml(c, todayKey, editable) {
  return `<div class="strip">${dayStrip(c, todayKey).map(s =>
    editable && (s.state === 'done' || s.state === 'missed' || s.state === 'today')
      ? `<button type="button" class="cell ${s.state}" data-toggle="${s.day}" aria-label="${escapeHtml(frShort(s.day))}"></button>`
      : `<span class="cell ${s.state}" aria-label="${escapeHtml(frShort(s.day))}"></span>`).join('')}</div>
    <div class="tiny">${escapeHtml(frShort(c.startDay))} → ${escapeHtml(frShort(endDay(c)))}</div>`;
}

function activeHtml(c, t) {
  const week = c.target.daily ? '' : ` · cette semaine : ${weekCount(c, t)} / ${c.target.perWeek}`;
  return `
    <div class="card">
      <div class="card-title">${escapeHtml(c.title)}</div>
      <div class="tiny">jour ${dayNumber(c, t)} sur ${c.days} · ${escapeHtml(targetLabel(c.target))}${week}</div>
    </div>
    <button type="button" class="btn btn-big${c.done[t] ? ' done' : ''}" data-toggle="${t}">${c.done[t] ? "✓ Fait aujourd'hui" : "Fait aujourd'hui"}</button>
    <div class="card">${stripHtml(c, t, true)}</div>
    <p class="note">Un tap sur une case passée la bascule. Rien d'autre à compter.</p>
    <button type="button" class="btn-text" data-stop>Arrêter ce challenge</button>`;
}

function formHtml(doc, t) {
  const list = past(doc, t);
  return `
    <div class="card">
      <div class="card-title">Nouveau challenge</div>
      <form id="new-challenge">
        <label class="field"><span class="tl">Titre</span><input type="text" name="title" placeholder="Cardio, lecture, sans écran après 22 h…" autocomplete="off" required></label>
        <label class="field"><span class="tl">Cible</span>
          <select name="target">
            <option value="daily">Tous les jours</option>
            ${[1, 2, 3, 4, 5, 6, 7].map(n => `<option value="${n}"${n === 3 ? ' selected' : ''}>${n} fois par semaine</option>`).join('')}
          </select></label>
        <label class="field"><span class="tl">Durée</span>
          <select name="days">${DURATIONS.map(d => `<option value="${d}"${d === 30 ? ' selected' : ''}>${d} jours</option>`).join('')}</select></label>
        <div class="sheet-actions"><button type="submit" class="btn">Commencer aujourd'hui</button></div>
      </form>
    </div>
    <div class="label">Passés</div>
    ${list.length ? list.map(c => `<button type="button" class="row" data-go="${escapeHtml(c.id)}">
        <span class="row-main"><span class="row-title">${escapeHtml(c.title)}</span>
        <span class="row-sub">${escapeHtml(frShort(c.startDay))} → ${escapeHtml(frShort(endDay(c)))} · ${escapeHtml(targetLabel(c.target))}</span></span>
        <span class="row-aside">${doneCount(c)} faits / ${c.days} jours</span>
      </button>`).join('') : '<p class="empty">Aucun challenge passé.</p>'}`;
}

function pastHtml(c, t) {
  return `
    <nav class="crumbs"><button type="button" class="btn-text" data-back>‹ Challenges</button></nav>
    <div class="card">
      <div class="card-title">${escapeHtml(c.title)}</div>
      <div class="tiny">${escapeHtml(targetLabel(c.target))} · ${doneCount(c)} faits / ${c.days} jours</div>
    </div>
    <div class="card">${stripHtml(c, t, false)}</div>`;
}

export function render(root, ctx) {
  const t = ctx.today();
  const store = ctx.stores.challenge;
  const doc = store.doc;
  const route = ctx.route;

  if (route?.view === 'c') {
    const c = doc.challenges.find(x => x.id === route.id);
    root.innerHTML = c ? pastHtml(c, t) : '<p class="empty">Challenge introuvable.</p><button type="button" class="btn-text" data-back>‹ Challenges</button>';
    root.onclick = e => { if (e.target.closest('[data-back]')) ctx.navigate({ tab: 'challenge' }); };
    return;
  }

  const c = active(doc, t);
  root.innerHTML = c ? activeHtml(c, t) : formHtml(doc, t);

  root.onclick = e => {
    const tg = e.target.closest('[data-toggle]');
    if (tg && c) { try { toggleDone(store, c.id, tg.dataset.toggle, t); } catch (err) { ctx.notice(err.message); } return; }
    if (e.target.closest('[data-stop]') && c) {
      if (confirm('Arrêter ce challenge ? Les jours faits sont conservés.')) { stopChallenge(store, c.id, new Date().toISOString()); ctx.notice('Arrêté.'); }
      return;
    }
    const go = e.target.closest('[data-go]');
    if (go) ctx.navigate({ tab: 'challenge', view: 'c', id: go.dataset.go });
  };

  const form = root.querySelector('#new-challenge');
  if (form) form.onsubmit = e => {
    e.preventDefault();
    const fd = new FormData(form);
    const tv = fd.get('target');
    const target = tv === 'daily' ? { daily: true } : { perWeek: Number(tv) };
    try { createChallenge(store, { title: fd.get('title'), target, days: Number(fd.get('days')) }, t); ctx.notice("C'est parti."); }
    catch (err) { ctx.notice(err.message); }
  };
}
