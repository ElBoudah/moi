import { isDayKey } from '../../core/dates.js';
import { deferWrite } from '../../core/defer.js';
import { NATURES, normTags, emptyDay, isEmptyDay } from './schema.js';

const isUrge = v => Number.isInteger(v) && v >= 0 && v <= 10;

export function setDayField(store, dayKey, field, value) {
  if (!isDayKey(dayKey)) throw new Error(`Jour invalide (${dayKey}).`);
  const v = value === undefined ? null : value;
  if (field !== 'urge') throw new Error(`Champ inconnu (${field}).`);
  if (!(v === null || isUrge(v))) throw new Error('Valeur de pression invalide.');
  store.commit(doc => {
    const day = { ...emptyDay(), ...(doc.days[dayKey] ?? {}) };
    day[field] = v;
    if (isEmptyDay(day)) delete doc.days[dayKey];
    else doc.days[dayKey] = day;
  }, { notify: false });
}

export function setDayFieldSoon(store, dayKey, field, value) {
  deferWrite(`pulsion:${dayKey}:${field}`, () => setDayField(store, dayKey, field, value));
}

// Append-only : un acte s'enregistre, ne se modifie pas, ne se supprime pas depuis l'interface.
export function addEvent(store, { nature, triggers, day }, todayKey) {
  if (!NATURES[nature]) throw new Error(`Nature inconnue (${nature}).`);
  if (!isDayKey(day)) throw new Error(`Jour invalide (${day}).`);
  if (day > todayKey) throw new Error('Un acte ne peut pas être dans le futur.');
  const tags = nature === 'partenaire' ? [] : normTags(triggers);
  return store.commit(doc => {
    const e = { id: store.makeId(), day, ts: store.now(), nature, triggers: tags };
    doc.events.push(e);
    return e;
  });
}

// Un épisode est l'envie saisie sur le vif : intensité, déclencheurs, contenu vu ou non. Jamais de ratio avec les actes.
export function addEpisode(store, { intensity, triggers = [], exposed = false }, todayKey) {
  if (!isUrge(intensity)) throw new Error('Intensité invalide.');
  if (!isDayKey(todayKey)) throw new Error(`Jour invalide (${todayKey}).`);
  return store.commit(doc => {
    const p = { id: store.makeId(), day: todayKey, ts: store.now(), intensity, triggers: normTags(triggers), exposed: exposed === true };
    doc.episodes.push(p);
    return p;
  });
}
