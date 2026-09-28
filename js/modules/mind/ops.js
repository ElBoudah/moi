// Opérations Mind : les méthodes du Store de la V1, devenues des fonctions sur le Store générique.
import * as q from './queries.js';

function subject(store, id) {
  const s = q.subjectById(store.doc, id);
  if (!s) throw new Error(`Sujet introuvable (${id}).`);
  return s;
}

function entry(store, id) {
  const e = store.doc.entries.find(x => x.id === id);
  if (!e) throw new Error(`Entrée introuvable (${id}).`);
  return e;
}

function nextOrder(store, parentId) {
  return q.children(store.doc, parentId, { includeRested: true }).reduce((m, s) => Math.max(m, s.order), 0) + 1;
}

function cleanTitle(title) {
  const t = (title ?? '').trim();
  if (!t) throw new Error('Le titre ne peut pas être vide.');
  return t;
}

export function createSubject(store, { title, parentId = null }) {
  const t = cleanTitle(title);
  if (parentId !== null && !q.subjectById(store.doc, parentId)) throw new Error('Parent introuvable.');
  return store.commit(doc => {
    const s = { id: store.makeId(), parentId, title: t, intent: '', weight: 0, order: nextOrder(store, parentId), createdAt: store.now(), restedAt: null };
    doc.subjects.push(s);
    return s;
  });
}

export function renameSubject(store, id, title) {
  const t = cleanTitle(title);
  const s = subject(store, id);
  store.commit(() => { s.title = t; });
}

export function setIntent(store, id, intent) {
  const s = subject(store, id);
  store.commit(() => { s.intent = intent ?? ''; }, { notify: false });
}

export function setWeight(store, id, weight) {
  if (!Number.isInteger(weight) || weight < 0 || weight > 3) throw new Error('Poids invalide.');
  const s = subject(store, id);
  if (s.parentId === null) throw new Error("Un thème (racine) n'a pas de poids.");
  if (s.weight === weight) return;
  store.commit(doc => {
    s.weight = weight;
    const now = store.now();
    // Une seule entrée de poids par jour : la dernière valeur du jour écrase la précédente.
    const lastToday = doc.entries
      .filter(e => e.subjectId === id && e.type === 'weight' && e.createdAt.slice(0, 10) === now.slice(0, 10))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .at(-1);
    if (lastToday) { lastToday.content = String(weight); lastToday.createdAt = now; }
    else doc.entries.push({ id: store.makeId(), subjectId: id, type: 'weight', content: String(weight), createdAt: now, doneAt: null });
  });
}

export function moveSubject(store, id, newParentId) {
  const s = subject(store, id);
  if (newParentId === id) throw new Error('Un sujet ne peut pas être déplacé dans lui-même.');
  if (newParentId !== null) {
    if (q.descendantIds(store.doc, id).includes(newParentId)) throw new Error('Impossible de déplacer un sujet dans un de ses descendants.');
    const target = subject(store, newParentId);
    if (!q.isActive(store.doc, target.id)) throw new Error('La cible est un sujet posé.');
  }
  const newOrder = nextOrder(store, newParentId);
  store.commit(() => {
    s.parentId = newParentId;
    s.order = newOrder;
    if (newParentId === null) s.weight = 0;
  });
}

export function restSubject(store, id, lastWord = '') {
  const s = subject(store, id);
  const word = (lastWord ?? '').trim();
  store.commit(doc => {
    if (word) doc.entries.push({ id: store.makeId(), subjectId: id, type: 'thought', content: word, createdAt: store.now(), doneAt: null });
    s.restedAt = store.now();
  });
}

export function resumeSubject(store, id) {
  const s = subject(store, id);
  store.commit(() => { s.restedAt = null; });
}

export function deletionImpact(store, id) {
  subject(store, id);
  const ids = new Set([id, ...q.descendantIds(store.doc, id)]);
  return { subjects: ids.size, entries: store.doc.entries.filter(e => ids.has(e.subjectId)).length };
}

export function deleteSubject(store, id) {
  const impact = deletionImpact(store, id);
  const ids = new Set([id, ...q.descendantIds(store.doc, id)]);
  store.commit(doc => {
    doc.subjects = doc.subjects.filter(s => !ids.has(s.id));
    doc.entries = doc.entries.filter(e => !ids.has(e.subjectId));
  });
  return impact;
}

export function addEntry(store, subjectId, type, content) {
  if (!['thought', 'decision', 'action'].includes(type)) throw new Error(`Type d'entrée non autorisé (${type}).`);
  const c = (content ?? '').trim();
  if (!c) throw new Error('Le contenu ne peut pas être vide.');
  subject(store, subjectId);
  return store.commit(doc => {
    const e = { id: store.makeId(), subjectId, type, content: c, createdAt: store.now(), doneAt: null };
    doc.entries.push(e);
    return e;
  });
}

export function updateEntry(store, id, content) {
  const c = (content ?? '').trim();
  if (!c) throw new Error('Le contenu ne peut pas être vide.');
  const e = entry(store, id);
  store.commit(() => { e.content = c; });
}

export function deleteEntry(store, id) {
  entry(store, id);
  store.commit(doc => { doc.entries = doc.entries.filter(x => x.id !== id); });
}

export function completeAction(store, id) {
  const e = entry(store, id);
  if (e.type !== 'action') throw new Error("Cette entrée n'est pas une action.");
  if (e.doneAt !== null) throw new Error('Action déjà faite.');
  store.commit(() => { e.doneAt = store.now(); });
}
