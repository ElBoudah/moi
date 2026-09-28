// Catalogue des tests proposés : retirer un test = retirer une ligne ; en ajouter = un fichier.
import { pvt } from './pvt.js';
import { phq8 } from './phq8.js';
import { runsOf } from '../queries.js';

export const CATALOG = [pvt, phq8];

export function testById(id) { return CATALOG.find(t => t.id === id); }

// Un test peut avoir été enregistré sous un ancien identifiant (phq → phq8).
export function idsOf(t) { return [t.id, ...(t.legacyIds ?? [])]; }

export function runsOfAny(doc, t) {
  return idsOf(t).flatMap(id => runsOf(doc, id)).sort((a, b) => a.ts.localeCompare(b.ts));
}

// Libellés de repli pour les runs historiques hors catalogue.
const LEGACY = {
  span: m => `Empan inversé ${m.span} · ${m.correct}/${m.trials} essais`,
  corsi: m => `Corsi ${m.span} · ${m.correct}/${m.trials} essais`,
  sdmt: m => `Substitution ${m.correct} corrects · ${m.errors} err.`,
  fluence: m => `Fluence ${m.sem} / ${m.pho}`,
  phq: m => `PHQ-8 ${m.score}/24 · ${m.band}`,
};

export function summaryFor(run) {
  const t = CATALOG.find(x => idsOf(x).includes(run.test));
  if (t) return t.summary(run);
  const f = LEGACY[run.test];
  return f ? f(run.metrics) : run.test;
}
