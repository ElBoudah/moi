// Lectures pures sur un document. Aucune mutation, aucun DOM.

export function subjectById(doc, id) {
  return doc.subjects.find(s => s.id === id);
}

function byOrder(a, b) {
  return a.order - b.order || a.createdAt.localeCompare(b.createdAt);
}

export function children(doc, parentId, { includeRested = false } = {}) {
  return doc.subjects
    .filter(s => s.parentId === parentId && (includeRested || s.restedAt === null))
    .sort(byOrder);
}

export function roots(doc) {
  return children(doc, null);
}

export function ancestors(doc, id) {
  const out = [];
  let cur = subjectById(doc, id);
  while (cur && cur.parentId !== null) {
    cur = subjectById(doc, cur.parentId);
    if (!cur) break;
    out.unshift(cur);
  }
  return out;
}

export function descendantIds(doc, id) {
  const out = [];
  const stack = [id];
  while (stack.length) {
    const cur = stack.pop();
    for (const s of doc.subjects) {
      if (s.parentId === cur) { out.push(s.id); stack.push(s.id); }
    }
  }
  return out;
}

export function isActive(doc, id) {
  const s = subjectById(doc, id);
  if (!s || s.restedAt !== null) return false;
  return ancestors(doc, id).every(a => a.restedAt === null);
}

export function lastUpdatedAt(doc, id) {
  let max = subjectById(doc, id)?.createdAt ?? '';
  for (const e of doc.entries) {
    if (e.subjectId === id && e.createdAt > max) max = e.createdAt;
  }
  return max;
}

export function weighing(doc) {
  return doc.subjects
    .filter(s => s.parentId !== null && s.weight > 0 && isActive(doc, s.id))
    .sort((a, b) => b.weight - a.weight || lastUpdatedAt(doc, a.id).localeCompare(lastUpdatedAt(doc, b.id)));
}

export function openActions(doc, rootId = null) {
  const scope = rootId === null ? null : new Set([rootId, ...descendantIds(doc, rootId)]);
  return doc.entries
    .filter(e => e.type === 'action' && e.doneAt === null
      && (scope === null || scope.has(e.subjectId))
      && isActive(doc, e.subjectId))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function displayDate(e) {
  return e.type === 'action' && e.doneAt ? e.doneAt : e.createdAt;
}

export function journal(doc, id) {
  return doc.entries
    .filter(e => e.subjectId === id && !(e.type === 'action' && e.doneAt === null))
    .sort((a, b) => displayDate(b).localeCompare(displayDate(a)));
}

// Journal du sous-arbre : toutes les entrées du sujet, plus pensées / décisions / actions faites
// de ses descendants (leurs changements de poids ne remontent pas, pour ne pas polluer).
export function journalTree(doc, id) {
  const below = new Set(descendantIds(doc, id));
  return doc.entries
    .filter(e => {
      if (e.type === 'action' && e.doneAt === null) return false;
      if (e.subjectId === id) return true;
      return below.has(e.subjectId) && e.type !== 'weight';
    })
    .sort((a, b) => displayDate(b).localeCompare(displayDate(a)));
}

// Chemin de `toId` sous `fromId`, ancêtre strict ou égal : « Papa › Communication ». Vide si égal.
export function relativePathLabel(doc, fromId, toId) {
  if (fromId === toId) return '';
  const chain = [...ancestors(doc, toId), subjectById(doc, toId)].filter(Boolean);
  const start = chain.findIndex(s => s.id === fromId);
  return chain.slice(start + 1).map(s => s.title).join(' › ');
}

export function activeCount(doc, id) {
  return descendantIds(doc, id).filter(d => isActive(doc, d)).length;
}

export function restedSubjects(doc) {
  return doc.subjects
    .filter(s => s.restedAt !== null)
    .sort((a, b) => b.restedAt.localeCompare(a.restedAt));
}

export function normalize(str) {
  return str.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

export function search(doc, query) {
  const nq = normalize(query);
  if (!nq) return [];
  return doc.subjects
    .filter(s => normalize(s.title).includes(nq))
    .sort((a, b) => a.title.localeCompare(b.title, 'fr'));
}

export function pathTitles(doc, id) {
  return [...ancestors(doc, id), subjectById(doc, id)].filter(Boolean).map(s => s.title);
}

export function moveTargets(doc, id) {
  const excluded = new Set([id, ...descendantIds(doc, id)]);
  return doc.subjects
    .filter(s => !excluded.has(s.id) && isActive(doc, s.id))
    .sort((a, b) => pathTitles(doc, a.id).join(' › ').localeCompare(pathTitles(doc, b.id).join(' › '), 'fr'));
}

export function activeSubjectsByPath(doc) {
  return doc.subjects
    .filter(s => isActive(doc, s.id))
    .sort((a, b) => pathTitles(doc, a.id).join(' › ').localeCompare(pathTitles(doc, b.id).join(' › '), 'fr'));
}
