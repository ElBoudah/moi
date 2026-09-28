import { PRESETS } from '../rappel/presets.js';

export const THEMES = ['system', 'light', 'dark'];
const isStr = v => typeof v === 'string';

export const settingsSchema = {
  key: 'moi.settings',
  version: 1,
  empty: () => ({
    version: 1,
    theme: 'system',
    lastTab: 'suivi',
    llm: { provider: 'gemini', apiKey: '', model: PRESETS.gemini.defaultModel, baseUrl: '' },
  }),
  validate(raw) {
    const fail = error => ({ ok: false, error });
    if (!raw || typeof raw !== 'object') return fail('Réglages invalides.');
    if (raw.version !== 1) return fail(`Version de réglages inconnue (${raw.version}).`);
    if (!THEMES.includes(raw.theme)) return fail('Thème inconnu.');
    if (!isStr(raw.lastTab)) return fail('Onglet mémorisé invalide.');
    const l = raw.llm;
    if (!l || typeof l !== 'object') return fail('Réglages LLM manquants.');
    if (!PRESETS[l.provider]) return fail('Fournisseur LLM inconnu.');
    if (![l.apiKey, l.model, l.baseUrl].every(isStr)) return fail('Réglages LLM mal formés.');
    return { ok: true, doc: raw };
  },
  migrations: {},
};
