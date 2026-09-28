// Opérations Rappel. Une révision est enregistrée à chaque validation : arrêter au milieu ne perd rien.
import { normKind } from './schema.js';
import { applyReview } from './fsrs.js';
import { itemById } from './queries.js';

function clean(p) {
  return { kind: normKind(p.kind), title: String(p.title ?? '').trim(), content: String(p.content ?? '').trim() };
}

function find(store, id) {
  const it = itemById(store.doc.items, id);
  if (!it) throw new Error('Fiche introuvable.');
  return it;
}

export function addItems(store, proposals, nowMs) {
  const rows = proposals.map(clean).filter(p => p.title && p.content);
  if (!rows.length) return [];
  return store.commit(doc => rows.map(p => {
    const it = { id: store.makeId(), ...p, createdAt: nowMs, lastReview: null, S: null, D: null, reps: 0, lapses: 0, lastQuestions: [] };
    doc.items.push(it);
    return it;
  }));
}

export function updateItem(store, id, patch) {
  const it = find(store, id);
  const p = clean(patch);
  if (!p.title) throw new Error('Le titre ne peut pas être vide.');
  if (!p.content) throw new Error('Le contenu ne peut pas être vide.');
  store.commit(() => { it.title = p.title; it.content = p.content; it.kind = p.kind; });
}

export function deleteItem(store, id) {
  find(store, id);
  store.commit(doc => { doc.items = doc.items.filter(i => i.id !== id); });
}

export function recordReview(store, id, grade, question, nowMs, { notify = true } = {}) {
  if (![1, 2, 3, 4].includes(grade)) throw new Error('Verdict invalide.');
  const it = find(store, id);
  const fsrs = applyReview(it, grade, nowMs);
  return store.commit(() => {
    Object.assign(it, fsrs);
    it.lastQuestions = [...it.lastQuestions, String(question ?? '')].filter(Boolean).slice(-3);
    return it;
  }, { notify });
}
