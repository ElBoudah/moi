let counter = 0;
export const T0 = '2026-09-01T10:00:00.000Z';

export function subject(o = {}) {
  counter += 1;
  return {
    id: o.id ?? `s${counter}`,
    parentId: o.parentId ?? null,
    title: o.title ?? `Sujet ${counter}`,
    intent: o.intent ?? '',
    weight: o.weight ?? 0,
    order: o.order ?? counter,
    createdAt: o.createdAt ?? T0,
    restedAt: o.restedAt ?? null,
  };
}

export function entry(o = {}) {
  counter += 1;
  return {
    id: o.id ?? `e${counter}`,
    subjectId: o.subjectId,
    type: o.type ?? 'thought',
    content: o.content ?? `Entrée ${counter}`,
    createdAt: o.createdAt ?? T0,
    doneAt: o.doneAt ?? null,
  };
}

/**
 * Arbre de test :
 *   relations (racine, order 1)
 *     papa (weight 3)
 *       communication (weight 2)
 *       vacances (weight 1, posé)
 *     laura (weight 0)
 *   travail (racine, order 2)
 *     job (weight 2)
 *   moi (racine, order 3, posé)
 *     trail (weight 1)  ← inactif par héritage
 */
export function makeDoc() {
  counter = 0;
  const subjects = [
    subject({ id: 'relations', title: 'Relations', order: 1 }),
    subject({ id: 'papa', parentId: 'relations', title: 'Papa', weight: 3, order: 1 }),
    subject({ id: 'communication', parentId: 'papa', title: 'Communication', weight: 2, order: 1 }),
    subject({ id: 'vacances', parentId: 'papa', title: 'Vacances', weight: 1, order: 2, restedAt: '2026-09-10T10:00:00.000Z' }),
    subject({ id: 'laura', parentId: 'relations', title: 'Laura', weight: 0, order: 2 }),
    subject({ id: 'travail', title: 'Travail', order: 2 }),
    subject({ id: 'job', parentId: 'travail', title: 'Recherche job', weight: 2, order: 1, createdAt: '2026-09-02T10:00:00.000Z' }),
    subject({ id: 'moi', title: 'Moi', order: 3, restedAt: '2026-09-12T10:00:00.000Z' }),
    subject({ id: 'trail', parentId: 'moi', title: 'Trail', weight: 1, order: 1 }),
  ];
  const entries = [
    entry({ id: 'e-papa-1', subjectId: 'papa', type: 'thought', content: "Je remarque que j'y pense souvent.", createdAt: '2026-09-08T10:00:00.000Z' }),
    entry({ id: 'e-papa-2', subjectId: 'papa', type: 'decision', content: "Je prends l'initiative.", createdAt: '2026-09-12T10:00:00.000Z' }),
    entry({ id: 'e-papa-3', subjectId: 'papa', type: 'action', content: 'Lui proposer une randonnée', createdAt: '2026-09-13T10:00:00.000Z' }),
    entry({ id: 'e-papa-4', subjectId: 'papa', type: 'action', content: 'Lui demander comment il va', createdAt: '2026-09-14T10:00:00.000Z', doneAt: '2026-09-15T10:00:00.000Z' }),
    entry({ id: 'e-com-1', subjectId: 'communication', type: 'action', content: "L'appeler ce week-end", createdAt: '2026-09-16T10:00:00.000Z' }),
    entry({ id: 'e-vac-1', subjectId: 'vacances', type: 'action', content: 'Regarder les dates', createdAt: '2026-09-05T10:00:00.000Z' }),
    entry({ id: 'e-laura-1', subjectId: 'laura', type: 'action', content: 'Envoyer un message', createdAt: '2026-09-17T10:00:00.000Z' }),
    entry({ id: 'e-job-1', subjectId: 'job', type: 'action', content: 'Adapter le CV', createdAt: '2026-09-11T10:00:00.000Z' }),
    entry({ id: 'e-job-2', subjectId: 'job', type: 'weight', content: '2', createdAt: '2026-09-18T10:00:00.000Z' }),
    entry({ id: 'e-trail-1', subjectId: 'trail', type: 'action', content: 'Réserver la salle', createdAt: '2026-09-09T10:00:00.000Z' }),
  ];
  return { version: 1, subjects, entries };
}
