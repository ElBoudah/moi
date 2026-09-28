// Lectures pures sur le document Suivi. Aucune mutation, aucun DOM.
import { addDays, frShort, hm, toMin } from '../../core/dates.js';
import { pack, sd, pm, fmt, mean } from '../../core/stats.js';
import { SLIDERS, LABELS } from './schema.js';

// Temps au lit = (lever - coucher) modulo 24 h : gère le passage de minuit sans cas particulier.
export function durMin(day) {
  const b = toMin(day.bed), w = toMin(day.wake);
  if (b === null || w === null) return null;
  return (w - b + 1440) % 1440;
}

// Temps dormi = temps au lit moins endormissement moins réveils nocturnes.
// Sans aucun des deux, la nuit n'est pas mesurée : null, jamais « 100 % ».
export function sleepMin(day) {
  const d = durMin(day);
  if (d === null) return null;
  if (day.onsetMin == null && day.awakeMin == null) return null;
  return Math.max(0, d - (day.onsetMin ?? 0) - (day.awakeMin ?? 0));
}

// Efficacité du sommeil : la variable centrale des approches comportementales de l'insomnie.
export function efficiency(day) {
  const d = durMin(day), slept = sleepMin(day);
  if (d === null || d === 0 || slept === null) return null;
  return slept / d;
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
  const dur = [], sleep = [], effs = [], beds = [];
  let logged = 0, nights = 0;
  for (const k of keys) {
    const d = doc.days[k];
    if (!d) { SLIDERS.forEach(f => series[f].push(null)); dur.push(null); sleep.push(null); continue; }
    logged++;
    const du = durMin(d);
    if (du !== null) nights++;
    dur.push(du);
    sleep.push(sleepMin(d));
    const e = efficiency(d);
    if (e !== null) effs.push(e);
    const bs = bedShift(d.bed);
    if (bs !== null) beds.push(bs);
    SLIDERS.forEach(f => series[f].push(Number.isInteger(d[f]) ? d[f] : null));
  }
  return {
    keys, logged, nights,
    dur: pack(dur), sleep: pack(sleep), eff: mean(effs), bedSD: sd(beds),
    series, packs: Object.fromEntries(SLIDERS.map(f => [f, pack(series[f])])),
  };
}

export function notesLines(doc, keys) {
  const out = [];
  for (const k of keys) {
    const d = doc.days[k];
    if (d && d.note) out.push(`  ${frShort(k)} : ${d.note.replace(/\s+/g, ' ')}`);
  }
  return out.length ? ['Notes :', ...out] : [];
}

export function bilan(doc, todayKey) {
  const s = stats(doc, 7, todayKey);
  const bed = s.dur.m == null ? '—' : hm(s.dur.m) + (s.dur.sd == null ? '' : ` ± ${Math.round(s.dur.sd)} min`);
  const slept = s.sleep.m == null ? '—' : hm(s.sleep.m);
  const eff = s.eff == null ? '—' : `${Math.round(s.eff * 100)} %`;
  const reg = s.bedSD == null ? '—' : `± ${Math.round(s.bedSD)} min`;
  const lines = [
    `SUIVI ${frShort(addDays(todayKey, -6))} → ${frShort(todayKey)}`,
    `Jours loggés : ${s.logged}/7`,
    `Sommeil : ${s.nights} nuits · au lit ${bed} · dormi ${slept} · efficacité ${eff} · régularité du coucher ${reg}`,
  ];
  for (const f of SLIDERS) {
    const p = s.packs[f];
    lines.push(`${LABELS[f]} : ${pm(p.m, p.sd, '/10')} · variation j/j ${fmt(p.v)}`);
  }
  return lines.concat(notesLines(doc, s.keys)).join('\n');
}
