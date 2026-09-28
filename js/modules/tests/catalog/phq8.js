// PHQ-8 : 8 items, 0 à 3 chacun, total 0 à 24. C'est le PHQ-9 privé de son 9e item, une question de
// risque clinique qui n'a pas sa place dans un outil sans clinicien derrière. Fenêtre de deux semaines,
// d'où l'espacement mensuel recommandé.
import { daysBetween } from '../../../core/dates.js';

export const PHQ_ITEMS = [
  "Peu d'intérêt ou de plaisir à faire les choses",
  'Te sentir triste, déprimé ou désespéré',
  "Difficultés à t'endormir ou à rester endormi, ou au contraire dormir trop",
  "Te sentir fatigué ou avoir peu d'énergie",
  "Peu d'appétit ou manger trop",
  "Avoir une mauvaise opinion de toi-même, ou le sentiment d'être un raté, ou d'avoir déçu tes proches",
  'Difficultés à te concentrer, par exemple pour lire ou suivre quelque chose',
  "Parler ou bouger si lentement que les autres l'ont remarqué — ou au contraire être agité au point de bouger beaucoup plus que d'habitude",
];
export const PHQ_OPTIONS = [['Jamais', 0], ['Plusieurs jours', 1], ['Plus de la moitié du temps', 2], ['Presque tous les jours', 3]];

export function phqBand(score) {
  if (score <= 4) return 'minimal';
  if (score <= 9) return 'léger';
  if (score <= 14) return 'modéré';
  if (score <= 19) return 'modérément sévère';
  return 'sévère';
}

export function phqMetrics(answers) {
  const score = answers.reduce((a, b) => a + b, 0);
  return { score, band: phqBand(score), items: answers };
}

export function overlapWarning(daysSince) {
  if (daysSince === null || daysSince === undefined || daysSince >= 14) return null;
  return `Dernière passation il y a ${daysSince} jours. Les items portent sur deux semaines : deux mesures rapprochées se recouvrent et ne sont pas indépendantes.`;
}

function ask(stage, i, answers, onDone) {
  if (i >= PHQ_ITEMS.length) {
    const m = phqMetrics(answers);
    const lines = [
      `Score : <b>${m.score} / 24</b>`,
      `Sévérité : <b>${m.band}</b>`,
      '<span class="tiny">Seuils : 5 léger · 10 modéré · 15 modérément sévère · 20 sévère</span>',
    ];
    if (m.score >= 15) lines.push("<span class=\"warn\">Un score dans cette zone, ou qui monte sur deux passations de suite, n'est plus une question de protocole : c'est un chiffre à montrer à un médecin.</span>");
    stage.result('PHQ-8 terminé', lines, () => onDone(m));
    return;
  }
  stage.timer(`${i + 1} / ${PHQ_ITEMS.length}`);
  stage.body(`<div class="qtext">${PHQ_ITEMS[i]}</div>`
    + `<div class="qopts">${PHQ_OPTIONS.map(([l, v]) => `<button type="button" data-v="${v}">${l}</button>`).join('')}</div>`
    + (i > 0 ? '<button type="button" class="btn btn-ghost stage-btn" data-back>Question précédente</button>' : ''));
  for (const b of stage.el.querySelectorAll('[data-v]')) b.onclick = () => ask(stage, i + 1, answers.concat(Number(b.dataset.v)), onDone);
  const back = stage.el.querySelector('[data-back]');
  if (back && i > 0) back.onclick = () => ask(stage, i - 1, answers.slice(0, -1), onDone);
}

export const phq8 = {
  id: 'phq8',
  label: 'PHQ-8 — humeur',
  subtitle: '8 items · deux dernières semaines · mensuel',
  legacyIds: ['phq'],
  run(stage, onDone, { lastRun = null } = {}) {
    stage.title('PHQ-8');
    const ds = lastRun ? daysBetween(lastRun.ts, new Date().toISOString()) : null;
    const warn = overlapWarning(ds);
    stage.body('<div class="stage-title">Humeur — 8 items</div>'
      + '<div class="stage-body">Sur les <b>deux dernières semaines</b>, à quelle fréquence as-tu été gêné par chacun de ces problèmes ? Réponds au plus juste, sans réfléchir longtemps.</div>'
      + (warn ? `<div class="warn">${warn}</div>` : '')
      + '<button type="button" class="btn stage-btn" data-go>Commencer</button>');
    stage.listen(stage.el.querySelector('[data-go]'), 'click', () => ask(stage, 0, [], onDone));
  },
  summary: r => `PHQ-8 ${r.metrics.score}/24 · ${r.metrics.band}`,
  chart: { title: 'Score /24 — plus bas = mieux', value: r => (Number.isFinite(r.metrics.score) ? r.metrics.score : null) },
};
