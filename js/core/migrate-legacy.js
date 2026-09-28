// Reprise en place des données de l'ancienne app Suivi (même origine GitHub Pages,
// donc même localStorage). Les anciennes clés ne sont jamais effacées.
import { isDayKey, isTime } from './dates.js';

export const LEGACY_SUIVI_KEY = 'suivi_v1';
export const LEGACY_TESTS_KEY = 'suivi_tests_v1';

// Les événements d'avant la v1.2 de Suivi portaient un champ "type".
export function natureOf(e) {
  if (e.nature) return e.nature;
  if (e.type === 'rechute') return 'contenu';
  if (e.type === 'solo') return 'sans';
  return null; // "resistee" : plus une catégorie
}

const slider = v => (Number.isInteger(v) && v >= 0 && v <= 10 ? v : null);
const time = v => (isTime(v) ? v : null);
const minutes = v => (Number.isInteger(v) && v >= 0 && v <= 1440 ? v : null);
const isId = v => typeof v === 'string' || Number.isFinite(v);
const isObj = v => v && typeof v === 'object' && !Array.isArray(v);

export function convertLegacy(suiviRaw, testsRaw) {
  const out = { suivi: null, pulsion: null, tests: null };
  if (isObj(suiviRaw)) {
    const suivi = { version: 1, days: {} };
    const pulsion = { version: 1, days: {}, events: [] };
    for (const [k, d] of Object.entries(isObj(suiviRaw.days) ? suiviRaw.days : {})) {
      if (!isDayKey(k) || !isObj(d)) continue;
      const sd = { bed: time(d.bed), wake: time(d.wake), clarity: slider(d.clarity), mood: slider(d.mood), pleasure: null, drive: slider(d.elan) };
      if (Object.values(sd).some(v => v !== null)) suivi.days[k] = sd;
      const pd = { urge: slider(d.urge), checksMin: minutes(d.checksMin) };
      if (pd.urge !== null || pd.checksMin !== null) pulsion.days[k] = pd;
    }
    for (const e of Array.isArray(suiviRaw.events) ? suiviRaw.events : []) {
      if (!isObj(e)) continue;
      const nature = natureOf(e);
      if (!nature || !isDayKey(e.day)) continue;
      pulsion.events.push({
        id: isId(e.id) ? e.id : `${e.day}-${pulsion.events.length}`,
        day: e.day,
        ts: typeof e.ts === 'string' ? e.ts : `${e.day}T12:00:00.000Z`,
        nature,
        trigger: typeof e.trigger === 'string' && e.trigger ? e.trigger : null,
      });
    }
    out.suivi = suivi;
    out.pulsion = pulsion;
  }
  if (isObj(testsRaw) && Array.isArray(testsRaw.runs)) {
    out.tests = { version: 1, runs: testsRaw.runs.filter(r => isObj(r) && isId(r.id) && typeof r.ts === 'string'
      && isDayKey(r.day) && typeof r.test === 'string' && isObj(r.metrics)) };
  }
  return out;
}

export function hasLegacy(storage) {
  return storage.getItem(LEGACY_SUIVI_KEY) !== null || storage.getItem(LEGACY_TESTS_KEY) !== null;
}

export function isFresh(storage, keys) {
  return keys.every(k => storage.getItem(k) === null);
}

function readJson(storage, key) {
  try { return JSON.parse(storage.getItem(key)); } catch { return null; }
}

export function migrateLegacy(storage, stores) {
  const converted = convertLegacy(readJson(storage, LEGACY_SUIVI_KEY), readJson(storage, LEGACY_TESTS_KEY));
  const done = [];
  for (const name of ['suivi', 'pulsion', 'tests']) {
    if (converted[name] && stores[name]) { stores[name].replace(converted[name]); done.push(name); }
  }
  return done;
}
