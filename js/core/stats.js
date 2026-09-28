// Statistiques descriptives sur des séries avec trous (null).

export const mean = a => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);

export function sd(a) {
  if (a.length < 2) return null;
  const m = mean(a);
  return Math.sqrt(a.reduce((s, v) => s + (v - m) * (v - m), 0) / (a.length - 1));
}

// Variation jour à jour : moyenne des écarts absolus entre deux jours CONSÉCUTIFS renseignés.
// 9-2-8-1 et 1-2-8-9 ont le même écart-type, pas la même variation.
export function masd(serie) {
  let s = 0, n = 0;
  for (let i = 1; i < serie.length; i++) {
    if (serie[i] !== null && serie[i - 1] !== null) { s += Math.abs(serie[i] - serie[i - 1]); n++; }
  }
  return n ? s / n : null;
}

export function median(a) {
  if (!a.length) return null;
  const s = [...a].sort((x, y) => x - y), n = s.length;
  return n % 2 ? s[(n - 1) / 2] : Math.round((s[n / 2 - 1] + s[n / 2]) / 2);
}

export const fmt = v => (v == null ? '—' : (Math.round(v * 10) / 10).toString().replace('.', ','));

export const pm = (m, d, unit = '') => (m == null ? '—' : fmt(m) + (d == null ? '' : ' ± ' + fmt(d)) + unit);

export function pack(serie) {
  const val = serie.filter(v => v !== null);
  return { m: mean(val), sd: sd(val), v: masd(serie), n: val.length };
}
