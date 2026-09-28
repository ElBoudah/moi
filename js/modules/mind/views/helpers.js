import * as q from '../queries.js';

export const TYPE_LABEL = { thought: 'Pensée', action: 'Action', decision: 'Décision' };

export function weightDots(weight) {
  if (!weight) return '<span class="dots dots-none" aria-label="Sans poids">—</span>';
  return `<span class="dots" aria-label="Poids ${weight} sur 3">${'●'.repeat(weight)}${'○'.repeat(3 - weight)}</span>`;
}

export function pathLabel(doc, id) {
  return q.ancestors(doc, id).map(s => s.title).join(' › ');
}
