import { isDayKey } from '../../core/dates.js';

const isId = v => typeof v === 'string' || Number.isFinite(v);

export const testsSchema = {
  key: 'moi.tests',
  version: 1,
  empty: () => ({ version: 1, runs: [] }),
  validate(raw) {
    const fail = error => ({ ok: false, error });
    if (!raw || typeof raw !== 'object') return fail('Document de tests invalide.');
    if (raw.version !== 1) return fail(`Version de tests inconnue (${raw.version}).`);
    if (!Array.isArray(raw.runs)) return fail('Liste de runs manquante.');
    for (const r of raw.runs) {
      if (!r || typeof r !== 'object') return fail('Run mal formé.');
      if (!isId(r.id) || typeof r.ts !== 'string' || !isDayKey(r.day) || typeof r.test !== 'string'
        || !r.metrics || typeof r.metrics !== 'object') return fail(`Run mal formé (${r.id ?? '?'}).`);
    }
    return { ok: true, doc: raw };
  },
  migrations: {},
};
