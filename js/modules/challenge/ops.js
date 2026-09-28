import { isDayKey } from '../../core/dates.js';
import { DURATIONS, isTarget } from './schema.js';
import { active, isActive, endDay } from './queries.js';

function find(store, id) {
  const c = store.doc.challenges.find(x => x.id === id);
  if (!c) throw new Error('Challenge introuvable.');
  return c;
}

export function createChallenge(store, { title, target, days }, todayKey) {
  const t = (title ?? '').trim();
  if (!t) throw new Error('Le titre ne peut pas être vide.');
  if (!isTarget(target)) throw new Error('Cible invalide.');
  if (!DURATIONS.includes(days)) throw new Error('Durée invalide.');
  if (active(store.doc, todayKey)) throw new Error('Un challenge est déjà en cours.');
  return store.commit(doc => {
    const c = { id: store.makeId(), title: t, target, startDay: todayKey, days, endedAt: null, done: {} };
    doc.challenges.push(c);
    return c;
  });
}

export function toggleDone(store, id, day, todayKey) {
  const c = find(store, id);
  if (!isActive(c, todayKey)) throw new Error('Ce challenge est terminé.');
  if (!isDayKey(day) || day < c.startDay || day > endDay(c)) throw new Error('Jour hors période.');
  if (day > todayKey) throw new Error('Pas dans le futur.');
  store.commit(() => { if (c.done[day]) delete c.done[day]; else c.done[day] = true; });
}

export function stopChallenge(store, id, nowIso) {
  const c = find(store, id);
  if (!isActive(c, nowIso.slice(0, 10))) throw new Error('Ce challenge est terminé.');
  store.commit(() => { c.endedAt = nowIso; });
}

// Un challenge dont la période s'est écoulée pendant que l'app était fermée se clôt au chargement.
export function autoClose(store, todayKey) {
  const toClose = store.doc.challenges.filter(c => c.endedAt === null && todayKey > endDay(c));
  if (!toClose.length) return 0;
  store.commit(() => { for (const c of toClose) c.endedAt = `${endDay(c)}T23:59:59.000Z`; });
  return toClose.length;
}
