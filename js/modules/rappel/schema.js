export const KINDS = { fait: 'Fait', idee: 'Idée' };
export const normKind = k => (KINDS[k] ? k : 'fait');

const isStr = v => typeof v === 'string';
const isNum = v => Number.isFinite(v);
const nullOrNum = v => v === null || isNum(v);

export const rappelSchema = {
  key: 'moi.rappel',
  version: 1,
  empty: () => ({ version: 1, items: [] }),
  validate(raw) {
    const fail = error => ({ ok: false, error });
    if (!raw || typeof raw !== 'object') return fail('Document Rappel invalide.');
    if (raw.version !== 1) return fail(`Version Rappel inconnue (${raw.version}).`);
    if (!Array.isArray(raw.items)) return fail('Liste de fiches manquante.');
    const ids = new Set();
    for (const it of raw.items) {
      if (!it || typeof it !== 'object') return fail('Fiche mal formée.');
      if (!isStr(it.id)) return fail('Fiche sans identifiant.');
      if (ids.has(it.id)) return fail(`Identifiant de fiche en double (${it.id}).`);
      ids.add(it.id);
      if (!isStr(it.title) || !it.title.trim()) return fail(`Titre manquant (${it.id}).`);
      if (!isStr(it.content) || !it.content.trim()) return fail(`Contenu manquant (${it.id}).`);
      if (!KINDS[it.kind]) return fail(`Genre inconnu (${it.id}).`);
      if (!isNum(it.createdAt)) return fail(`createdAt invalide (${it.id}).`);
      if (!nullOrNum(it.lastReview)) return fail(`lastReview invalide (${it.id}).`);
      if (it.lastReview !== null && (!isNum(it.S) || !isNum(it.D))) return fail(`S ou D manquant sur une fiche révisée (${it.id}).`);
      if (!nullOrNum(it.S) || !nullOrNum(it.D)) return fail(`S ou D invalide (${it.id}).`);
      if (!Number.isInteger(it.reps) || it.reps < 0) return fail(`reps invalide (${it.id}).`);
      if (!Number.isInteger(it.lapses) || it.lapses < 0) return fail(`lapses invalide (${it.id}).`);
      if (!Array.isArray(it.lastQuestions) || !it.lastQuestions.every(isStr)) return fail(`Dernières questions invalides (${it.id}).`);
    }
    return { ok: true, doc: raw };
  },
  migrations: {},
};
