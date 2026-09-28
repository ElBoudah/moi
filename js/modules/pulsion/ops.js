import { isDayKey } from '../../core/dates.js';
import { deferWrite } from '../../core/defer.js';
import { NATURES, emptyDay, isEmptyDay } from './schema.js';

const isUrge = v => Number.isInteger(v) && v >= 0 && v <= 10;
const isMinutes = v => Number.isInteger(v) && v >= 0 && v <= 1440;

export function setDayField(store, dayKey, field, value) {
  if (!isDayKey(dayKey)) throw new Error(`Jour invalide (${dayKey}).`);
  const v = value === undefined ? null : value;
  if (field === 'urge') { if (!(v === null || isUrge(v))) throw new Error('Valeur de pression invalide.'); }
  else if (field === 'checksMin') { if (!(v === null || isMinutes(v))) throw new Error('Valeur de checks invalide.'); }
  else throw new Error(`Champ inconnu (${field}).`);
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
export function addEvent(store, { nature, trigger, day }, todayKey) {
  if (!NATURES[nature]) throw new Error(`Nature inconnue (${nature}).`);
  if (!isDayKey(day)) throw new Error(`Jour invalide (${day}).`);
  if (day > todayKey) throw new Error('Un acte ne peut pas être dans le futur.');
  const t = nature === 'partenaire' ? null : (trigger ?? '').trim();
  if (nature !== 'partenaire' && !t) throw new Error('Déclencheur manquant.');
  return store.commit(doc => {
    const e = { id: store.makeId(), day, ts: store.now(), nature, trigger: t };
    doc.events.push(e);
    return e;
  });
}
