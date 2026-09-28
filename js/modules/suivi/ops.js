// Opérations sur le store Suivi. Les curseurs écrivent en différé : un re-rendu
// pendant un glissement détruirait l'élément manipulé et couperait le geste.
import { isDayKey, isTime } from '../../core/dates.js';
import { deferWrite, flushDeferred } from '../../core/defer.js';
import { SLIDERS, emptyDay, isEmptyDay, isSliderValue } from './schema.js';

const TIMES = ['bed', 'wake'];

export function setDayField(store, dayKey, field, value) {
  if (!isDayKey(dayKey)) throw new Error(`Jour invalide (${dayKey}).`);
  const v = value === undefined ? null : value;
  if (SLIDERS.includes(field)) {
    if (!(v === null || isSliderValue(v))) throw new Error(`Valeur invalide pour ${field}.`);
  } else if (TIMES.includes(field)) {
    if (!(v === null || isTime(v))) throw new Error(`Heure invalide pour ${field}.`);
  } else throw new Error(`Champ inconnu (${field}).`);
  store.commit(doc => {
    const day = { ...emptyDay(), ...(doc.days[dayKey] ?? {}) };
    day[field] = v;
    if (isEmptyDay(day)) delete doc.days[dayKey];
    else doc.days[dayKey] = day;
  }, { notify: false });
}

export function setDayFieldSoon(store, dayKey, field, value) {
  deferWrite(`suivi:${dayKey}:${field}`, () => setDayField(store, dayKey, field, value));
}

export const flushPending = flushDeferred;
