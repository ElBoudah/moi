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
// Endormissement et réveils nocturnes : des paliers, comme un agenda de sommeil clinique. Personne ne sait
// s'il a mis 22 ou 31 minutes ; ce qui compte est la tendance et l'efficacité du sommeil.
export const SLEEP_PRESETS = [0, 10, 20, 30, 45, 60, 90];
export const SLEEP_FIELDS = ['onsetMin', 'awakeMin'];
export const NOTE_MAX = 140;
const TIMES = ['bed', 'wake'];

export const isSliderValue = v => Number.isInteger(v) && v >= 0 && v <= 10;
export const isSleepMinutes = v => Number.isInteger(v) && v >= 0 && v <= 600;
export const isNote = v => typeof v === 'string' && v.length <= NOTE_MAX;
export function emptyDay() { return { bed: null, wake: null, onsetMin: null, awakeMin: null, clarity: null, mood: null, pleasure: null, drive: null, note: null }; }
export function isEmptyDay(day) { return [...TIMES, ...SLEEP_FIELDS, ...SLIDERS, 'note'].every(f => day[f] === null || day[f] === undefined); }

const nullOr = (v, pred) => v === null || v === undefined || pred(v);

export const suiviSchema = {
  key: 'moi.suivi',
  version: 2,
  empty: () => ({ version: 2, days: {} }),
  validate(raw) {
    const fail = error => ({ ok: false, error });
    if (!raw || typeof raw !== 'object') return fail('Document Suivi invalide.');
    if (![1, 2].includes(raw.version)) return fail(`Version Suivi inconnue (${raw.version}).`);
    if (!raw.days || typeof raw.days !== 'object' || Array.isArray(raw.days)) return fail('Liste de jours manquante.');
    for (const [k, d] of Object.entries(raw.days)) {
      if (!isDayKey(k)) return fail(`Clé de jour invalide (${k}).`);
      if (!d || typeof d !== 'object') return fail(`Jour mal formé (${k}).`);
      for (const f of TIMES) if (!nullOr(d[f], isTime)) return fail(`Heure ${f} invalide le ${k}.`);
      for (const f of SLEEP_FIELDS) if (!nullOr(d[f], isSleepMinutes)) return fail(`Valeur ${f} invalide le ${k}.`);
      for (const f of SLIDERS) if (!nullOr(d[f], isSliderValue)) return fail(`Valeur ${f} invalide le ${k}.`);
      if (!nullOr(d.note, isNote)) return fail(`Note invalide le ${k} (${NOTE_MAX} caractères au plus).`);
    }
    return { ok: true, doc: raw };
  },
  migrations: {
    // v1 → v2 : endormissement, réveils nocturnes et note, à null.
    1: doc => ({
      version: 2,
      days: Object.fromEntries(Object.entries(doc.days).map(([k, d]) => [k, { ...emptyDay(), ...d }])),
    }),
  },
};
