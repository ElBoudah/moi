// PVT-B : 3 minutes, intervalle 1 à 4 s, lapse au-dessus de 355 ms, faux départ avant stimulus ou sous 100 ms.
// Les valeurs absolues incluent la latence de l'écran tactile : comparables à soi-même seulement.
import { median, mean } from '../../../core/stats.js';

const DURATION_MS = 180000;
const LAPSE_MS = 355;
const round2 = v => Math.round(v * 100) / 100;

export function pvtMetrics(rts, falseStarts) {
  const n = rts.length;
  const lapses = rts.filter(r => r > LAPSE_MS).length;
  const speed = n ? round2(mean(rts.map(r => 1000 / r))) : null;
  return { n, median: n ? Math.round(median(rts)) : null, mean: n ? Math.round(mean(rts)) : null, lapses, falseStarts, speed };
}

function mmss(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function start(stage, onDone) {
  const now = () => (stage.now ? stage.now() : performance.now());
  const rts = [];
  let falseStarts = 0, onset = null, isi = null, wait = null, raf = null, done = false;
  const end = now() + DURATION_MS;
  stage.body('<div class="stim" data-stim><span class="counter mono" data-cnt></span></div><div class="flash" data-flash></div>');
  const stim = stage.el.querySelector('[data-stim]');
  const cnt = stage.el.querySelector('[data-cnt]');
  const flash = stage.el.querySelector('[data-flash]');
  const tick = () => stage.timer(mmss(end - now()));
  stage.interval(tick, 250);
  tick();

  function schedule() {
    onset = null; cnt.textContent = ''; stim.classList.remove('on');
    if (now() >= end) { finish(); return; }
    isi = stage.timeout(() => {
      onset = now(); stim.classList.add('on');
      const loop = () => { if (onset === null) return; cnt.textContent = Math.round(now() - onset); raf = stage.raf(loop); };
      loop();
    }, 1000 + Math.random() * 3000);
  }

  function onTap() {
    if (done) return;
    if (onset === null) {
      // Faux départ : avant le stimulus, ou pendant la fenêtre de retour qui suit une réponse.
      // Annuler les deux minuteurs possibles, sinon deux chaînes de stimulus tournent en parallèle.
      falseStarts++; stage.clearTimeout(isi); stage.clearTimeout(wait);
      flash.textContent = 'trop tôt';
      stage.timeout(() => { if (!done) flash.textContent = ''; }, 700);
      schedule();
      return;
    }
    const rt = now() - onset;
    stage.cancelRaf(raf); onset = null; stim.classList.remove('on');
    if (rt < 100) { falseStarts++; flash.textContent = 'trop tôt'; }
    else { rts.push(rt); cnt.textContent = Math.round(rt); flash.textContent = ''; }
    wait = stage.timeout(() => { if (!done) { flash.textContent = ''; schedule(); } }, 900);
  }
  stage.listen(stage.el, 'pointerdown', onTap);

  function finish() {
    done = true;
    const m = pvtMetrics(rts, falseStarts);
    stage.result('PVT-B terminé', [
      `Médiane : <b>${m.median ?? '—'} ms</b>`,
      `Lapses (> ${LAPSE_MS} ms) : <b>${m.lapses}</b> sur ${m.n}`,
      `Faux départs : <b>${m.falseStarts}</b>`,
      `Vitesse moyenne (1/RT) : <b>${m.speed ?? '—'}</b>`,
    ], () => onDone(m));
  }
  schedule();
}

export const pvt = {
  id: 'pvt',
  label: 'PVT-B — attention soutenue',
  subtitle: "3 min · hebdomadaire · effet d'apprentissage quasi nul",
  note: "Les valeurs absolues incluent la latence de l'écran tactile : elles ne se comparent pas à des normes publiées, seulement à tes propres runs.",
  run(stage, onDone) {
    stage.title('PVT-B');
    stage.body('<div class="stage-title">Attention soutenue — 3 min</div>'
      + "<div class=\"stage-body\">Un compteur se déclenche à intervalles irréguliers. Tape l'écran dès qu'il apparaît, le plus vite possible — mais pas avant, sinon c'est un faux départ. Téléphone en main, sans distraction.</div>"
      + '<button type="button" class="btn stage-btn" data-go>Commencer</button>');
    stage.listen(stage.el.querySelector('[data-go]'), 'click', () => start(stage, onDone));
  },
  summary: r => `PVT ${r.metrics.median ?? '—'} ms · ${r.metrics.lapses} lapses`,
  chart: { title: 'Médiane, ms — plus bas = mieux', value: r => (Number.isFinite(r.metrics.median) ? r.metrics.median : null) },
};
