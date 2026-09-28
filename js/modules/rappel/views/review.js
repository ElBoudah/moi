// Révision : une fiche à la fois, question générée, réponse, correction, verdict ajustable, validation
// enregistrée tout de suite. Arrêter à tout moment ne perd rien. La question suivante se précharge.
import { escapeHtml } from '../../../core/ui.js';
import { KINDS } from '../schema.js';
import { itemById, tierOf } from '../queries.js';
import { applyReview, intervalDays } from '../fsrs.js';
import { llmQuestion, llmGrade, humanError } from '../llm.js';
import { GRADES, gradeFromVerdict } from '../prompts.js';
import { recordReview } from '../ops.js';

let session = null; // { queue, index, phase, question, answer, result, grade, error, reviewed }
let prefetch = {};   // id → Promise | { q }
let mounted = false;

export function startReview(ctx, ids) {
  session = { queue: ids, index: 0, phase: 'loading', question: null, answer: '', result: null, grade: null, error: null, reviewed: 0 };
  prefetch = {};
  ctx.navigate({ tab: 'rappel', view: 'review' });
}

const llmOf = ctx => ctx.stores.settings.doc.llm;
const current = ctx => itemById(ctx.stores.rappel.doc.items, session.queue[session.index]);

function prefetchNext(ctx) {
  const id = session.queue[session.index + 1];
  if (!id || prefetch[id]) return;
  const it = itemById(ctx.stores.rappel.doc.items, id);
  if (!it) return;
  prefetch[id] = llmQuestion(llmOf(ctx), it, tierOf(it)).then(q => { prefetch[id] = { q }; }).catch(() => { delete prefetch[id]; });
}

async function loadQuestion(root, ctx) {
  const it = current(ctx);
  const s = session;
  Object.assign(s, { phase: 'loading', question: null, answer: '', result: null, grade: null, error: null });
  render(root, ctx);
  prefetchNext(ctx);
  try {
    let q = null;
    const cached = prefetch[it.id];
    if (cached && cached.q) q = cached.q;
    else if (cached && typeof cached.then === 'function') { await cached; if (prefetch[it.id]?.q) q = prefetch[it.id].q; }
    if (!q) q = await llmQuestion(llmOf(ctx), it, tierOf(it));
    delete prefetch[it.id];
    if (session === s) { s.phase = 'answer'; s.question = q; }
  } catch (e) {
    if (session === s) { s.phase = 'error'; s.error = `La question n'a pas pu être générée. ${humanError(e)}`; }
  }
  if (mounted && session === s) render(root, ctx);
}

async function submit(root, ctx) {
  const it = current(ctx);
  const s = session;
  s.phase = 'grading';
  render(root, ctx);
  try {
    const result = await llmGrade(llmOf(ctx), it, s.question, s.answer.trim() || '(aucune réponse)', tierOf(it));
    if (session === s) { s.phase = 'feedback'; s.result = result; s.grade = gradeFromVerdict(result.verdict); }
  } catch (e) {
    if (session === s) { s.phase = 'error'; s.error = `La correction a échoué. ${humanError(e)}`; }
  }
  if (mounted && session === s) render(root, ctx);
}

function confirmAndNext(root, ctx) {
  const it = current(ctx);
  // notify:false : cette vue se pilote elle-même, une notification la rerendrait au milieu de la transition.
  recordReview(ctx.stores.rappel, it.id, session.grade, session.question, Date.now(), { notify: false });
  session.reviewed += 1;
  if (session.index + 1 >= session.queue.length) { session.phase = 'done'; return render(root, ctx); }
  session.index += 1;
  loadQuestion(root, ctx);
}

function stop(ctx) { session = null; prefetch = {}; ctx.navigate({ tab: 'rappel' }); }

export function render(root, ctx) {
  if (!session) { ctx.navigate({ tab: 'rappel' }); return; }
  mounted = true;
  ctx.onLeave?.(() => { mounted = false; });
  const s = session;

  if (s.phase === 'done') {
    root.innerHTML = `<div class="card center"><p class="rappel-lead">Terminé.</p><p class="tiny mono">${s.reviewed} fiche${s.reviewed > 1 ? 's' : ''} revue${s.reviewed > 1 ? 's' : ''}</p><button type="button" class="btn" data-stop>Retour</button></div>`;
    root.onclick = e => { if (e.target.closest('[data-stop]')) stop(ctx); };
    return;
  }

  const it = current(ctx);
  if (!it) { stop(ctx); return; }
  const tier = tierOf(it);
  const head = `<div class="srow"><span><span class="badge">${escapeHtml(KINDS[it.kind])}</span><span class="tiny mono">${it.lastReview ? tier : 'premier passage'}</span></span>
    <span class="tiny mono">${s.index + 1} / ${s.queue.length}</span></div>`;

  let body = '';
  if (s.phase === 'loading') body = '<div class="working">Formulation de la question…</div>';
  if (s.phase === 'grading') body = `<p class="rappel-q">${escapeHtml(s.question)}</p><div class="working">Correction…</div>`;
  if (s.phase === 'error') body = `<div class="card center"><p class="tiny warn">${escapeHtml(s.error)}</p><div class="rowbtns"><button type="button" class="btn btn-ghost" data-retry>Réessayer</button><button type="button" class="btn btn-ghost" data-stop>Arrêter</button></div></div>`;
  if (s.phase === 'answer') body = `<p class="rappel-q">${escapeHtml(s.question)}</p>
    <textarea data-answer rows="6" placeholder="Réponds même incertain — une tentative corrigée ancre mieux qu'un blanc.">${escapeHtml(s.answer)}</textarea>
    <div class="rowbtns"><button type="button" class="btn btn-ghost" data-stop>Arrêter</button><button type="button" class="btn" data-submit>Corriger ma réponse</button></div>`;
  if (s.phase === 'feedback') {
    const sim = applyReview(it, s.grade, Date.now());
    const d = intervalDays(sim.S);
    body = `<p class="rappel-q">${escapeHtml(s.question)}</p>
      <div class="card">
        <div class="srow"><span class="stamp g${gradeFromVerdict(s.result.verdict)}">${escapeHtml(GRADES.find(g => g.g === gradeFromVerdict(s.result.verdict))?.label ?? '?')}</span><span class="tiny mono">${escapeHtml(it.title)}</span></div>
        <p>${escapeHtml(s.result.explication || '')}</p>
      </div>
      <p class="tiny mono">Verdict retenu — ajustable</p>
      <div class="verdicts">${GRADES.map(g => `<button type="button" class="chip${s.grade === g.g ? ` on g${g.g}` : ''}" data-grade="${g.g}">${g.label}</button>`).join('')}</div>
      <p class="tiny mono">prochain passage dans ~${d < 1 ? '1 j' : `${Math.round(d)} j`}</p>
      <div class="rowbtns"><button type="button" class="btn btn-ghost" data-stop>Arrêter</button><button type="button" class="btn" data-confirm>${s.index + 1 >= s.queue.length ? 'Valider et terminer' : 'Valider, fiche suivante'}</button></div>`;
  }
  root.innerHTML = head + body;

  root.oninput = e => { const a = e.target.closest('[data-answer]'); if (a) s.answer = a.value; };
  root.onclick = e => {
    if (e.target.closest('[data-stop]')) return stop(ctx);
    if (e.target.closest('[data-retry]')) return void loadQuestion(root, ctx);
    if (e.target.closest('[data-submit]')) return void submit(root, ctx);
    const g = e.target.closest('[data-grade]');
    if (g) { s.grade = Number(g.dataset.grade); return render(root, ctx); }
    if (e.target.closest('[data-confirm]')) return confirmAndNext(root, ctx);
  };

  if (s.phase === 'loading' && s.question === null && !s._started) { s._started = true; loadQuestion(root, ctx); }
}
