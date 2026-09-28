// Schéma Mind : repris de mind/js/store.js (validateDoc), document vide sans thème de départ.
export const ENTRY_TYPES = ['thought', 'decision', 'action', 'weight'];
const SCHEMA_VERSION = 1;

const isStr = v => typeof v === 'string';
const isIsoOrNull = v => v === null || isStr(v);

export function validateDoc(raw) {
  const fail = error => ({ ok: false, error });
  if (!raw || typeof raw !== 'object') return fail("Le fichier n'est pas un document valide.");
  if (!Number.isInteger(raw.version) || raw.version < 1 || raw.version > SCHEMA_VERSION) {
    return fail(`Version de fichier inconnue (${raw.version}).`);
  }
  if (!Array.isArray(raw.subjects) || !Array.isArray(raw.entries)) return fail("Listes de sujets ou d'entrées manquantes.");

  const ids = new Set();
  for (const s of raw.subjects) {
    if (!s || typeof s !== 'object') return fail('Sujet mal formé.');
    if (!isStr(s.id) || !isStr(s.title) || !isStr(s.intent) || !isStr(s.createdAt)
      || !(s.parentId === null || isStr(s.parentId)) || !isIsoOrNull(s.restedAt)
      || !Number.isInteger(s.order)) return fail(`Sujet mal formé (${s.id ?? '?'}).`);
    if (!Number.isInteger(s.weight) || s.weight < 0 || s.weight > 3) return fail(`Poids invalide sur « ${s.title} ».`);
    if (s.parentId === null && s.weight !== 0) return fail(`Un thème (racine) doit avoir un poids de 0 (« ${s.title} »).`);
    if (ids.has(s.id)) return fail(`Identifiant de sujet en double (${s.id}).`);
    ids.add(s.id);
  }
  for (const s of raw.subjects) {
    if (s.parentId !== null && !ids.has(s.parentId)) return fail(`Parent introuvable pour « ${s.title} ».`);
  }
  for (const s of raw.subjects) {
    const seen = new Set([s.id]);
    let cur = s;
    while (cur.parentId !== null) {
      if (seen.has(cur.parentId)) return fail(`Cycle détecté autour de « ${s.title} ».`);
      seen.add(cur.parentId);
      cur = raw.subjects.find(x => x.id === cur.parentId);
    }
  }
  const eids = new Set();
  for (const e of raw.entries) {
    if (!e || typeof e !== 'object') return fail('Entrée mal formée.');
    if (!isStr(e.id) || !isStr(e.content) || !isStr(e.createdAt) || !isIsoOrNull(e.doneAt)) return fail(`Entrée mal formée (${e.id ?? '?'}).`);
    if (!ENTRY_TYPES.includes(e.type)) return fail(`Type d'entrée inconnu (${e.type}).`);
    if (!ids.has(e.subjectId)) return fail(`Sujet introuvable pour une entrée (${e.id}).`);
    if (eids.has(e.id)) return fail(`Identifiant d'entrée en double (${e.id}).`);
    eids.add(e.id);
  }
  return { ok: true, doc: raw };
}

export const mindSchema = {
  key: 'moi.mind',
  version: SCHEMA_VERSION,
  empty: () => ({ version: SCHEMA_VERSION, subjects: [], entries: [] }),
  validate: validateDoc,
  migrations: {},
};
