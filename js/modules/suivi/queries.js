// Lectures pures sur le document Suivi. Aucune mutation, aucun DOM.
import { addDays, frShort, hm, toMin } from '../../core/dates.js';
import { pack, sd, pm, fmt } from '../../core/stats.js';
import { SLIDERS, LABELS } from './schema.js';

// Durée = (lever - coucher) modulo 24 h : gère le passage de minuit sans cas particulier.
export function durMin(day) {
  const b = toMin(day.bed), w = toMin(day.wake);
  if (b === null || w === null) return null;
  return (w - b + 1440) % 1440;
}

// Coucher recentré sur 18 h, sinon 23 h 50 et 00 h 10 seraient à 23 h d'écart au lieu de 20 min.
export function bedShift(bed) {
  const b = toMin(bed);
  return b === null ? null : (b - 1080 + 1440) % 1440;
}

export function windowKeys(todayKey, win) {
  const keys = [];
  for (let i = win - 1; i >= 0; i--) keys.push(addDays(todayKey, -i));
  return keys;
}

export function stats(doc, win, todayKey) {
  const keys = windowKeys(todayKey, win);
  const series = Object.fromEntries(SLIDERS.map(f => [f, []]));
  const dur = [], beds = [];
  let logged = 0, nights = 0;
  for (const k of keys) {
    const d = doc.days[k];
    if (!d) { SLIDERS.forEach(f => series[f].push(null)); dur.push(null); continue; }
    logged++;
    const du = durMin(d);
    if (du !== null) nights++;
    dur.push(du);
    const bs = bedShift(d.bed);
    if (bs !== null) beds.push(bs);
    SLIDERS.forEach(f => series[f].push(Number.isInteger(d[f]) ? d[f] : null));
  }
  return {
    keys, logged, nights,
    dur: pack(dur), bedSD: sd(beds),
    series, packs: Object.fromEntries(SLIDERS.map(f => [f, pack(series[f])])),
  };
}

export function bilan(doc, todayKey) {
  const s = stats(doc, 7, todayKey);
  const dur = s.dur.m == null ? '—' : hm(s.dur.m) + (s.dur.sd == null ? '' : ` ± ${Math.round(s.dur.sd)} min`);
  const reg = s.bedSD == null ? '—' : `± ${Math.round(s.bedSD)} min`;
  const lines = [
    `SUIVI ${frShort(addDays(todayKey, -6))} → ${frShort(todayKey)}`,
    `Jours loggés : ${s.logged}/7`,
    `Sommeil : ${s.nights} nuits · durée ${dur} · régularité du coucher ${reg}`,
  ];
  for (const f of SLIDERS) {
    const p = s.packs[f];
    lines.push(`${LABELS[f]} : ${pm(p.m, p.sd, '/10')} · variation j/j ${fmt(p.v)}`);
  }
  return lines.join('\n');
}
