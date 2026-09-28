import { isDayKey } from '../../core/dates.js';

export const DURATIONS = [14, 30, 60];

export function isTarget(t) {
  if (!t || typeof t !== 'object') return false;
  const keys = Object.keys(t);
  if (keys.length !== 1) return false;
  if (t.daily === true) return true;
  return Number.isInteger(t.perWeek) && t.perWeek >= 1 && t.perWeek <= 7;
}

export function targetLabel(t) {
  return t.daily ? 'tous les jours' : `${t.perWeek} fois par semaine`;
}

export const challengeSchema = {
  key: 'moi.challenge',
  version: 1,
  empty: () => ({ version: 1, challenges: [] }),
  validate(raw) {
    const fail = error => ({ ok: false, error });
    if (!raw || typeof raw !== 'object') return fail('Document Challenge invalide.');
    if (raw.version !== 1) return fail(`Version Challenge inconnue (${raw.version}).`);
    if (!Array.isArray(raw.challenges)) return fail('Liste de challenges manquante.');
    const ids = new Set();
    for (const c of raw.challenges) {
      if (!c || typeof c !== 'object') return fail('Challenge mal formé.');
      if (typeof c.id !== 'string') return fail('Challenge sans identifiant.');
      if (ids.has(c.id)) return fail(`Identifiant de challenge en double (${c.id}).`);
      ids.add(c.id);
      if (typeof c.title !== 'string' || !c.title.trim()) return fail(`Titre manquant (${c.id}).`);
      if (!isTarget(c.target)) return fail(`Cible invalide (${c.id}).`);
      if (!DURATIONS.includes(c.days)) return fail(`Durée invalide (${c.id}).`);
      if (!isDayKey(c.startDay)) return fail(`Jour de début invalide (${c.id}).`);
      if (!(c.endedAt === null || typeof c.endedAt === 'string')) return fail(`endedAt invalide (${c.id}).`);
      if (!c.done || typeof c.done !== 'object' || Array.isArray(c.done)) return fail(`Liste done invalide (${c.id}).`);
      for (const [k, v] of Object.entries(c.done)) {
        if (!isDayKey(k) || v !== true) return fail(`Entrée done invalide (${c.id}, ${k}).`);
      }
    }
    return { ok: true, doc: raw };
  },
  migrations: {},
};
