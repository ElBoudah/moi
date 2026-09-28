import { isDayKey, isTime } from '../../core/dates.js';

export const SLIDERS = ['clarity', 'mood', 'pleasure', 'drive'];
export const LABELS = { clarity: 'Clarté', mood: 'Humeur', pleasure: 'Plaisir', drive: 'Motivation' };
// Trois ancres par curseur (0, 5, 10) : c'est ce qui empêche la valeur de dériver avec le temps.
export const ANCHORS = {
  clarity: ['brouillard, je relis trois fois', 'fonctionnel mais distractible', 'net, une tâche à la fois sans effort'],
  mood: ['au fond', 'neutre', 'léger, envie de rire'],
  pleasure: ['rien ne fait envie ni plaisir', 'quelques moments agréables', "plaisir franc dans ce que j'ai fait"],
  drive: ['rien ne démarre', "je fais ce qu'il faut", 'je démarre sans me pousser'],
};
const TIMES = ['bed', 'wake'];

export const isSliderValue = v => Number.isInteger(v) && v >= 0 && v <= 10;
export function emptyDay() { return { bed: null, wake: null, clarity: null, mood: null, pleasure: null, drive: null }; }
export function isEmptyDay(day) { return [...TIMES, ...SLIDERS].every(f => day[f] === null || day[f] === undefined); }

export const suiviSchema = {
  key: 'moi.suivi',
  version: 1,
  empty: () => ({ version: 1, days: {} }),
  validate(raw) {
    const fail = error => ({ ok: false, error });
    if (!raw || typeof raw !== 'object') return fail('Document Suivi invalide.');
    if (raw.version !== 1) return fail(`Version Suivi inconnue (${raw.version}).`);
    if (!raw.days || typeof raw.days !== 'object' || Array.isArray(raw.days)) return fail('Liste de jours manquante.');
    for (const [k, d] of Object.entries(raw.days)) {
      if (!isDayKey(k)) return fail(`Clé de jour invalide (${k}).`);
      if (!d || typeof d !== 'object') return fail(`Jour mal formé (${k}).`);
      for (const f of TIMES) if (!(d[f] === null || d[f] === undefined || isTime(d[f]))) return fail(`Heure ${f} invalide le ${k}.`);
      for (const f of SLIDERS) if (!(d[f] === null || d[f] === undefined || isSliderValue(d[f]))) return fail(`Valeur ${f} invalide le ${k}.`);
    }
    return { ok: true, doc: raw };
  },
  migrations: {},
};
