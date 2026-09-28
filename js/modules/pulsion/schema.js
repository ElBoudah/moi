import { isDayKey } from '../../core/dates.js';

// Une seule dimension par acte : sa nature. Pas d'issue, pas d'intervalle, pas de compteur.
export const NATURES = {
  contenu: { label: 'Seul, avec contenu', rank: 3, css: 'var(--nat-contenu)' },
  sans: { label: 'Seul, sans contenu', rank: 2, css: 'var(--nat-sans)' },
  partenaire: { label: 'Avec partenaire', rank: 1, css: 'var(--nat-partenaire)' },
};
export const NATURE_ORDER = ['contenu', 'sans', 'partenaire'];
export const URGE_ANCHORS = ['aucune', 'présente, je peux faire autre chose', "envahissante, je ne pense qu'à ça"];
export const TAG_MAX = 30;

const isUrge = v => Number.isInteger(v) && v >= 0 && v <= 10;
const isMinutes = v => Number.isInteger(v) && v >= 0 && v <= 1440;
const isId = v => typeof v === 'string' || Number.isFinite(v);
const isStr = v => typeof v === 'string';
const nullOr = (v, pred) => v === null || v === undefined || pred(v);

// Déclencheurs libres : rognés, dédoublonnés sans tenir compte de la casse, 30 caractères au plus.
export function normTags(list) {
  const out = [], seen = new Set();
  for (const raw of Array.isArray(list) ? list : []) {
    const t = String(raw ?? '').trim().replace(/\s+/g, ' ').slice(0, TAG_MAX);
    const k = t.toLowerCase();
    if (!t || seen.has(k)) continue;
    seen.add(k);
    out.push(t);
  }
  return out;
}

export function emptyDay() { return { urge: null }; }
export function isEmptyDay(d) { return (d.urge ?? null) === null; }

function validateEvent(e, v) {
  if (!e || typeof e !== 'object') return 'Acte mal formé.';
  if (!isId(e.id) || typeof e.ts !== 'string') return `Acte mal formé (${e.id ?? '?'}).`;
  if (!isDayKey(e.day)) return `Jour invalide sur un acte (${e.id}).`;
  if (!NATURES[e.nature]) return `Nature inconnue (${e.nature}).`;
  if (v === 1) { if (!nullOr(e.trigger, isStr)) return `Déclencheur invalide (${e.id}).`; }
  else if (!Array.isArray(e.triggers) || !e.triggers.every(isStr)) return `Déclencheurs invalides (${e.id}).`;
  return null;
}

function validateEpisode(p) {
  if (!p || typeof p !== 'object') return 'Épisode mal formé.';
  if (!isId(p.id) || typeof p.ts !== 'string') return `Épisode mal formé (${p.id ?? '?'}).`;
  if (!isDayKey(p.day)) return `Jour invalide sur un épisode (${p.id}).`;
  if (!isUrge(p.intensity)) return `Intensité invalide (${p.id}).`;
  if (!Array.isArray(p.triggers) || !p.triggers.every(isStr)) return `Déclencheurs invalides (${p.id}).`;
  if (typeof p.exposed !== 'boolean') return `Contenu vu invalide (${p.id}).`;
  return null;
}

export const pulsionSchema = {
  key: 'moi.pulsion',
  version: 2,
  empty: () => ({ version: 2, days: {}, events: [], episodes: [] }),
  validate(raw) {
    const fail = error => ({ ok: false, error });
    if (!raw || typeof raw !== 'object') return fail('Document Pulsion invalide.');
    if (![1, 2].includes(raw.version)) return fail(`Version Pulsion inconnue (${raw.version}).`);
    if (!raw.days || typeof raw.days !== 'object' || Array.isArray(raw.days)) return fail('Liste de jours manquante.');
    if (!Array.isArray(raw.events)) return fail("Liste d'actes manquante.");
    if (raw.version === 2 && !Array.isArray(raw.episodes)) return fail("Liste d'épisodes manquante.");
    for (const [k, d] of Object.entries(raw.days)) {
      if (!isDayKey(k)) return fail(`Clé de jour invalide (${k}).`);
      if (!d || typeof d !== 'object') return fail(`Jour mal formé (${k}).`);
      if (!nullOr(d.urge, isUrge)) return fail(`Valeur urge invalide le ${k}.`);
      if (!nullOr(d.checksMin, isMinutes)) return fail(`Valeur checksMin invalide le ${k}.`); // héritage v1, plus saisi
    }
    for (const e of raw.events) { const err = validateEvent(e, raw.version); if (err) return fail(err); }
    if (raw.version === 2) for (const p of raw.episodes) { const err = validateEpisode(p); if (err) return fail(err); }
    return { ok: true, doc: raw };
  },
  migrations: {
    // v1 → v2 : le déclencheur unique devient une liste de tags, les épisodes apparaissent.
    1: doc => ({
      version: 2,
      days: doc.days,
      events: doc.events.map(({ trigger, ...e }) => ({ ...e, triggers: trigger ? [trigger] : [] })),
      episodes: [],
    }),
  },
};
