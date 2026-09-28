import { isDayKey } from '../../core/dates.js';

// Une seule dimension par acte : sa nature. Pas d'issue, pas d'intervalle, pas de compteur.
export const NATURES = {
  contenu: { label: 'Seul, avec contenu', rank: 3, css: 'var(--nat-contenu)' },
  sans: { label: 'Seul, sans contenu', rank: 2, css: 'var(--nat-sans)' },
  partenaire: { label: 'Avec partenaire', rank: 1, css: 'var(--nat-partenaire)' },
};
export const NATURE_ORDER = ['contenu', 'sans', 'partenaire'];
export const TRIGGERS = ['Fatigue', 'Ennui', 'Seul le soir', 'Stress / conflit', 'Sans raison claire', 'Autre'];
export const CHECK_PRESETS = [0, 5, 10, 20, 30, 60];
export const URGE_ANCHORS = ['aucune', 'présente, je peux faire autre chose', "envahissante, je ne pense qu'à ça"];

const isUrge = v => Number.isInteger(v) && v >= 0 && v <= 10;
const isMinutes = v => Number.isInteger(v) && v >= 0 && v <= 1440;
const isId = v => typeof v === 'string' || Number.isFinite(v);
const nullOr = (v, pred) => v === null || v === undefined || pred(v);

export function emptyDay() { return { urge: null, checksMin: null }; }
export function isEmptyDay(d) { return (d.urge ?? null) === null && (d.checksMin ?? null) === null; }

export const pulsionSchema = {
  key: 'moi.pulsion',
  version: 1,
  empty: () => ({ version: 1, days: {}, events: [] }),
  validate(raw) {
    const fail = error => ({ ok: false, error });
    if (!raw || typeof raw !== 'object') return fail('Document Pulsion invalide.');
    if (raw.version !== 1) return fail(`Version Pulsion inconnue (${raw.version}).`);
    if (!raw.days || typeof raw.days !== 'object' || Array.isArray(raw.days)) return fail('Liste de jours manquante.');
    if (!Array.isArray(raw.events)) return fail("Liste d'actes manquante.");
    for (const [k, d] of Object.entries(raw.days)) {
      if (!isDayKey(k)) return fail(`Clé de jour invalide (${k}).`);
      if (!d || typeof d !== 'object') return fail(`Jour mal formé (${k}).`);
      if (!nullOr(d.urge, isUrge)) return fail(`Valeur urge invalide le ${k}.`);
      if (!nullOr(d.checksMin, isMinutes)) return fail(`Valeur checksMin invalide le ${k}.`);
    }
    for (const e of raw.events) {
      if (!e || typeof e !== 'object') return fail('Acte mal formé.');
      if (!isId(e.id) || typeof e.ts !== 'string') return fail(`Acte mal formé (${e.id ?? '?'}).`);
      if (!isDayKey(e.day)) return fail(`Jour invalide sur un acte (${e.id}).`);
      if (!NATURES[e.nature]) return fail(`Nature inconnue (${e.nature}).`);
      if (!(e.trigger === null || e.trigger === undefined || typeof e.trigger === 'string')) return fail(`Déclencheur invalide (${e.id}).`);
    }
    return { ok: true, doc: raw };
  },
  migrations: {},
};
