// Lectures pures sur le document Pulsion.
import { addDays, frShort } from '../../core/dates.js';
import { pack, pm } from '../../core/stats.js';
import { windowKeys } from '../suivi/queries.js';
import { NATURES, NATURE_ORDER } from './schema.js';

export function stats(doc, win, todayKey) {
  const keys = windowKeys(todayKey, win);
  const inWindow = new Set(keys);
  const urge = [];
  let checksVol = 0, checksDays = 0;
  for (const k of keys) {
    const d = doc.days[k];
    urge.push(d && Number.isInteger(d.urge) ? d.urge : null);
    if (d && Number.isInteger(d.checksMin)) { checksVol += d.checksMin; if (d.checksMin > 0) checksDays++; }
  }
  const vals = urge.filter(v => v !== null);
  const byNature = Object.fromEntries(NATURE_ORDER.map(n => [n, []]));
  for (const e of [...doc.events].sort((a, b) => a.day.localeCompare(b.day) || a.ts.localeCompare(b.ts))) {
    if (inWindow.has(e.day)) byNature[e.nature].push(e);
  }
  return {
    keys, series: { urge }, urge: pack(urge),
    urgeMax: vals.length ? Math.max(...vals) : null,
    evenings4: vals.filter(v => v >= 4).length,
    checksVol, checksDays, byNature,
  };
}

// Un jour peut porter plusieurs actes : on garde le plus lourd pour la couleur du repère.
export function marks(doc) {
  const out = {};
  for (const e of doc.events) {
    const prev = out[e.day];
    if (!prev || NATURES[e.nature].rank > NATURES[prev].rank) out[e.day] = e.nature;
  }
  return out;
}

export function lastEvents(doc, n = 8) {
  return [...doc.events]
    .sort((a, b) => b.day.localeCompare(a.day) || b.ts.localeCompare(a.ts))
    .slice(0, n);
}

export function bilan(doc, todayKey) {
  const s = stats(doc, 7, todayKey);
  const lines = [
    `PULSION ${frShort(addDays(todayKey, -6))} → ${frShort(todayKey)}`,
    `Pression : ${pm(s.urge.m, s.urge.sd, '/10')} · max ${s.urgeMax ?? '—'} · soirs ≥4 : ${s.evenings4}`,
    `Checks : ${s.checksVol} min sur ${s.checksDays} jour(s)`,
    'Actes 7 j :',
  ];
  const natLines = NATURE_ORDER
    .filter(n => s.byNature[n].length)
    .map(n => `  ${NATURES[n].label} : ${s.byNature[n].map(e => frShort(e.day) + (e.trigger ? ` (${e.trigger.toLowerCase()})` : '')).join(', ')}`);
  return lines.concat(natLines.length ? natLines : ['  aucun']).join('\n');
}
