// Lectures pures sur le document Pulsion.
import { addDays, frShort } from '../../core/dates.js';
import { pack, pm } from '../../core/stats.js';
import { windowKeys } from '../suivi/queries.js';
import { NATURES, NATURE_ORDER } from './schema.js';

const byTs = (a, b) => a.day.localeCompare(b.day) || a.ts.localeCompare(b.ts);
const byTsDesc = (a, b) => b.day.localeCompare(a.day) || b.ts.localeCompare(a.ts);

export function stats(doc, win, todayKey) {
  const keys = windowKeys(todayKey, win);
  const inWindow = new Set(keys);
  const urge = keys.map(k => { const d = doc.days[k]; return d && Number.isInteger(d.urge) ? d.urge : null; });
  const vals = urge.filter(v => v !== null);
  const byNature = Object.fromEntries(NATURE_ORDER.map(n => [n, []]));
  for (const e of [...doc.events].sort(byTs)) if (inWindow.has(e.day)) byNature[e.nature].push(e);
  const episodes = [...(doc.episodes ?? [])].filter(p => inWindow.has(p.day)).sort(byTs);
  return {
    keys, series: { urge }, urge: pack(urge),
    urgeMax: vals.length ? Math.max(...vals) : null,
    evenings4: vals.filter(v => v >= 4).length,
    byNature,
    episodes, exposed: episodes.filter(p => p.exposed).length,
    intensity: pack(episodes.map(p => p.intensity)),
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

export function episodeDays(doc) { return new Set((doc.episodes ?? []).map(p => p.day)); }

export function lastEvents(doc, n = 8) { return [...doc.events].sort(byTsDesc).slice(0, n); }

export function lastEpisodes(doc, n = 8) { return [...(doc.episodes ?? [])].sort(byTsDesc).slice(0, n); }

// Fréquence des tags sur actes et épisodes, insensible à la casse, libellé de la première occurrence.
export function tagFrequencies({ events = [], episodes = [] }) {
  const f = new Map();
  for (const x of [...events, ...episodes]) {
    for (const t of x.triggers ?? []) {
      const k = t.toLowerCase();
      if (!f.has(k)) f.set(k, { tag: t, n: 0 });
      f.get(k).n += 1;
    }
  }
  return [...f.values()].sort((a, b) => b.n - a.n);
}

// Répartition par heure locale : 24 cases.
export function hourHistogram(list) {
  const h = new Array(24).fill(0);
  for (const x of list) h[new Date(x.ts).getHours()] += 1;
  return h;
}

export function bilan(doc, todayKey) {
  const s = stats(doc, 7, todayKey);
  const winEvents = NATURE_ORDER.flatMap(n => s.byNature[n]);
  const tags = tagFrequencies({ events: winEvents, episodes: s.episodes });
  const lines = [
    `PULSION ${frShort(addDays(todayKey, -6))} → ${frShort(todayKey)}`,
    `Pression : ${pm(s.urge.m, s.urge.sd, '/10')} · max ${s.urgeMax ?? '—'} · soirs ≥4 : ${s.evenings4}`,
    s.episodes.length
      ? `Épisodes : ${s.episodes.length} · dont ${s.exposed} avec contenu · intensité ${pm(s.intensity.m, s.intensity.sd, '/10')}`
      : 'Épisodes : aucun',
    `Déclencheurs : ${tags.length ? tags.map(t => `${t.tag} ×${t.n}`).join(', ') : '—'}`,
    'Actes 7 j :',
  ];
  const natLines = NATURE_ORDER
    .filter(n => s.byNature[n].length)
    .map(n => `  ${NATURES[n].label} : ${s.byNature[n].map(e => frShort(e.day) + (e.triggers?.length ? ` (${e.triggers.map(t => t.toLowerCase()).join(', ')})` : '')).join(', ')}`);
  return lines.concat(natLines.length ? natLines : ['  aucun']).join('\n');
}
