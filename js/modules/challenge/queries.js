// Lectures pures sur le document Challenge.
import { addDays, diffDays, parseKey } from '../../core/dates.js';

export function endDay(c) { return addDays(c.startDay, c.days - 1); }

export function isActive(c, todayKey) { return c.endedAt === null && todayKey <= endDay(c); }

export function active(doc, todayKey) { return doc.challenges.find(c => isActive(c, todayKey)) ?? null; }

export function past(doc, todayKey) {
  return doc.challenges.filter(c => !isActive(c, todayKey)).sort((a, b) => b.startDay.localeCompare(a.startDay));
}

export function periodKeys(c) { return Array.from({ length: c.days }, (_, i) => addDays(c.startDay, i)); }

// États d'une case : fait, pas fait (passé), aujourd'hui (pas encore fait), à venir, hors période (arrêt anticipé).
export function dayStrip(c, todayKey) {
  const stopDay = c.endedAt ? c.endedAt.slice(0, 10) : null;
  return periodKeys(c).map(day => {
    let state;
    if (c.done[day]) state = 'done';
    else if (stopDay && day > stopDay) state = 'off';
    else if (day > todayKey) state = 'future';
    else if (day === todayKey) state = 'today';
    else state = 'missed';
    return { day, state };
  });
}

export function weekBounds(todayKey) {
  const dow = (parseKey(todayKey).getDay() + 6) % 7; // lundi = 0
  const from = addDays(todayKey, -dow);
  return { from, to: addDays(from, 6) };
}

export function weekCount(c, todayKey) {
  const { from, to } = weekBounds(todayKey);
  return periodKeys(c).filter(d => d >= from && d <= to && c.done[d]).length;
}

export function dayNumber(c, todayKey) {
  return Math.min(c.days, Math.max(1, diffDays(c.startDay, todayKey) + 1));
}

export function doneCount(c) { return periodKeys(c).filter(d => c.done[d]).length; }
