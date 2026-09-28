/* FSRS — poids par défaut, rétention cible 0.9. Repris de Rappel V1. */
const W = [
  0.4072, 1.1829, 3.1262, 15.4722, 7.2102, 0.5316, 1.0651, 0.0234, 1.616,
  0.1544, 1.0824, 1.9813, 0.0953, 0.2975, 2.2042, 0.2407, 2.9466,
];
const DECAY = -0.5;
const FACTOR = Math.pow(0.9, 1 / DECAY) - 1; // 19/81
export const RETENTION = 0.9;

const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
export const daysBetween = (a, b) => Math.max(0, (b - a) / 86400000);

export const retrievability = (elapsedDays, S) => Math.pow(1 + (FACTOR * elapsedDays) / Math.max(S, 0.01), DECAY);

const initStability = g => Math.max(W[g - 1], 0.1);
const initDifficulty = g => clamp(W[4] - Math.exp(W[5] * (g - 1)) + 1, 1, 10);

function nextDifficulty(d, g) {
  const delta = -W[6] * (g - 3);
  const damped = d + (delta * (10 - d)) / 9;
  const target = initDifficulty(4);
  return clamp(W[7] * target + (1 - W[7]) * damped, 1, 10);
}

function nextRecallStability(d, s, r, g) {
  const hard = g === 2 ? W[15] : 1;
  const easy = g === 4 ? W[16] : 1;
  return s * (1 + Math.exp(W[8]) * (11 - d) * Math.pow(s, -W[9]) * (Math.exp(W[10] * (1 - r)) - 1) * hard * easy);
}

function nextForgetStability(d, s, r) {
  const sf = W[11] * Math.pow(d, -W[12]) * (Math.pow(s + 1, W[13]) - 1) * Math.exp(W[14] * (1 - r));
  return Math.min(sf, s);
}

export const intervalDays = S => (S * (Math.pow(RETENTION, 1 / DECAY) - 1)) / FACTOR;

// Applique une révision (g ∈ 1..4) et retourne le nouvel état FSRS.
export function applyReview(item, g, t) {
  if (!item.lastReview) {
    return { S: initStability(g), D: initDifficulty(g), lastReview: t, reps: 1, lapses: g === 1 ? 1 : 0 };
  }
  const elapsed = daysBetween(item.lastReview, t);
  const r = retrievability(elapsed, item.S);
  const D = nextDifficulty(item.D, g);
  const S = g === 1 ? nextForgetStability(item.D, item.S, r) : nextRecallStability(item.D, item.S, r, g);
  return { S, D, lastReview: t, reps: (item.reps || 0) + 1, lapses: (item.lapses || 0) + (g === 1 ? 1 : 0) };
}
