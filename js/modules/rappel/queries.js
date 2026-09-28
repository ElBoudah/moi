// Lectures pures : file de révision, palier, lignes de bibliothèque. Aucun cap, aucun compteur de retard.
import { retrievability, daysBetween, RETENTION } from './fsrs.js';

export function retrievabilityOf(item, nowMs) {
  return item.lastReview ? retrievability(daysBetween(item.lastReview, nowMs), item.S) : null;
}

const byR = nowMs => (a, b) => retrievabilityOf(a, nowMs) - retrievabilityOf(b, nowMs);

export function reviewQueue(items, nowMs) {
  const due = items.filter(i => i.lastReview && retrievabilityOf(i, nowMs) <= RETENTION + 1e-9).sort(byR(nowMs)).map(i => i.id);
  const fresh = items.filter(i => !i.lastReview).sort((a, b) => a.createdAt - b.createdAt).map(i => i.id);
  return { due, fresh };
}

export function anywayQueue(items, nowMs) {
  return items.filter(i => i.lastReview).sort(byR(nowMs)).map(i => i.id);
}

// Restitution pour tout le monde ; explication pour une idée révisée dont la stabilité dépasse 7 jours.
export function tierOf(item) {
  return item.kind === 'idee' && item.lastReview && item.S >= 7 ? 'explication' : 'restitution';
}

export function libraryRows(items, nowMs) {
  return items
    .map(item => ({ item, r: retrievabilityOf(item, nowMs) }))
    .sort((a, b) => {
      if (a.r === null && b.r === null) return b.item.createdAt - a.item.createdAt;
      if (a.r === null) return 1;
      if (b.r === null) return -1;
      return a.r - b.r;
    });
}

export function itemById(items, id) { return items.find(i => i.id === id); }
