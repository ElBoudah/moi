// Scène de passation : écran plein, minuteurs et écouteurs suivis, nettoyage d'un coup.
// Un test n'arme jamais un setTimeout brut : tout passe par la scène, qui sait tout arrêter
// quand on quitte (bouton Quitter ou retour du téléphone).
// Appels explicites : une référence détachée à requestAnimationFrame lève « Illegal invocation » dans certains navigateurs.
const RAF = fn => (globalThis.requestAnimationFrame ? requestAnimationFrame(fn) : setTimeout(fn, 16));
const CAF = h => (globalThis.cancelAnimationFrame ? cancelAnimationFrame(h) : clearTimeout(h));

export function createStage(root, { onQuit } = {}) {
  root.innerHTML = `<div class="stage">
    <div class="stage-top">
      <span data-stage-label></span>
      <span class="mono" data-stage-timer></span>
      <button type="button" class="btn btn-ghost stage-quit" data-stage-quit>Quitter</button>
    </div>
    <div class="stage-mid" data-stage-mid></div>
  </div>`;
  const q = sel => root.querySelector(sel);
  const timers = new Set(), intervals = new Set(), rafs = new Set(), listeners = [];

  const stage = {
    el: q('[data-stage-mid]'),
    title(t) { q('[data-stage-label]').textContent = t; },
    timer(t) { q('[data-stage-timer]').textContent = t; },
    body(html) { stage.el.innerHTML = html; },
    timeout(fn, ms) { const h = setTimeout(() => { timers.delete(h); fn(); }, ms); timers.add(h); return h; },
    clearTimeout(h) { clearTimeout(h); timers.delete(h); },
    interval(fn, ms) { const h = setInterval(fn, ms); intervals.add(h); return h; },
    raf(fn) { const h = RAF(() => { rafs.delete(h); fn(); }); rafs.add(h); return h; },
    cancelRaf(h) { CAF(h); rafs.delete(h); },
    listen(target, ev, fn) { target.addEventListener(ev, fn); listeners.push([target, ev, fn]); },
    clearAll() {
      for (const h of timers) clearTimeout(h); timers.clear();
      for (const h of intervals) clearInterval(h); intervals.clear();
      for (const h of rafs) CAF(h); rafs.clear();
      for (const [t, e, f] of listeners) t.removeEventListener(e, f); listeners.length = 0;
    },
    result(title, lines, onSave) {
      stage.clearAll();
      stage.timer('');
      q('[data-stage-quit]').classList.add('hidden');
      stage.body(`<div class="stage-title">${title}</div><div class="res">${lines.join('<br>')}</div>`
        + '<button type="button" class="btn stage-btn" data-save>Enregistrer</button>');
      stage.el.querySelector('[data-save]').onclick = onSave;
    },
  };
  q('[data-stage-quit]').onclick = () => { stage.clearAll(); onQuit?.(); };
  return stage;
}
