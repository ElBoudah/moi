// Sparkline SVG : une série avec trous, une échelle fixe (0-10) ou automatique,
// des repères verticaux. Rendu en chaîne, aucun DOM.
const num = v => v !== null && v !== undefined && Number.isFinite(v);

export function sparkline({ values, min = 0, max = 10, marks = [], hollowDots = [], color = 'var(--accent)', width = 280, height = 56, pad = 6, grid = null, dots = null, emptyText = 'pas encore de données' }) {
  const vals = values.filter(num);
  if (!vals.length) return `<div class="chart-empty">${emptyText}</div>`;
  const auto = min === null || max === null;
  let lo = min, hi = max;
  if (auto) {
    lo = Math.min(...vals); hi = Math.max(...vals);
    if (hi === lo) { lo -= 1; hi += 1; }
    const m = (hi - lo) * 0.18; lo -= m; hi += m;
  }
  const n = values.length;
  const x = i => (n < 2 ? width / 2 : pad + (i / (n - 1)) * (width - 2 * pad));
  const y = v => height - pad - ((v - lo) / (hi - lo)) * (height - 2 * pad);
  const showDots = dots ?? n <= 30;

  let path = '', gap = true, dotsSvg = '';
  values.forEach((v, i) => {
    if (!num(v)) { gap = true; return; }
    const X = x(i).toFixed(1), Y = y(v).toFixed(1);
    path += `${gap ? 'M' : 'L'}${X} ${Y} `;
    if (showDots) dotsSvg += `<circle cx="${X}" cy="${Y}" r="2.4" fill="${color}"/>`;
    gap = false;
  });
  const gridLines = grid ?? (auto ? [] : [min, (min + max) / 2, max]);
  const gridSvg = gridLines.map(g => `<line x1="${pad}" x2="${width - pad}" y1="${y(g).toFixed(1)}" y2="${y(g).toFixed(1)}" class="chart-grid"/>`).join('');
  const marksSvg = marks.filter(m => m.i >= 0 && m.i < n).map(m => {
    const X = x(m.i).toFixed(1);
    return `<line x1="${X}" x2="${X}" y1="${pad}" y2="${height - pad}" stroke="${m.color}" stroke-width="1.6" opacity=".85"${m.dashed ? ' stroke-dasharray="2 2"' : ''}/>`;
  }).join('');
  // Points creux : un jour marqué sans valeur sur la courbe (épisode sans acte, par exemple). Posés en bas si la valeur manque.
  const hollowSvg = hollowDots.filter(m => m.i >= 0 && m.i < n).map(m => {
    const v = num(values[m.i]) ? values[m.i] : lo;
    return `<circle cx="${x(m.i).toFixed(1)}" cy="${y(v).toFixed(1)}" r="3.2" fill="none" stroke="${m.color}" stroke-width="1.6"/>`;
  }).join('');
  return `<svg class="spark" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">${gridSvg}${marksSvg}${hollowSvg}<path d="${path.trim()}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>${dotsSvg}</svg>`;
}
