// Helpers d'interface. Les constructeurs de HTML sont purs (testés en Node) ;
// les fonctions DOM ne touchent document qu'à l'appel.
import { frLong } from './dates.js';

export function escapeHtml(str) {
  return String(str)
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

// Curseur 0-10 ancré. Vide : « — » affiché, poignée au milieu, rien d'enregistré tant qu'on ne glisse pas.
export function sliderHtml({ field, label, value, anchors, cls = '' }) {
  const v = value ?? null;
  return `<div class="slider" data-slider="${escapeHtml(field)}">
    <div class="srow"><span>${escapeHtml(label)}</span><span class="mono out" data-out="${escapeHtml(field)}">${v === null ? '—' : v}</span></div>
    <div class="slidewrap"><input type="range" class="range ${escapeHtml(cls)}" min="0" max="10" step="1" value="${v === null ? 5 : v}" data-range="${escapeHtml(field)}" aria-label="${escapeHtml(label)}"></div>
    <div class="anchors"><span>${escapeHtml(anchors[0])}</span><span>${escapeHtml(anchors[1])}</span><span>${escapeHtml(anchors[2])}</span></div>
  </div>`;
}

export function chipsHtml({ field, options, value, other = true }) {
  const v = value ?? null;
  const isPreset = options.includes(v);
  const chip = (val, text, on) => `<button type="button" class="chip${on ? ' on' : ''}" data-chip="${escapeHtml(val)}">${escapeHtml(text)}</button>`;
  return `<div class="chips pick" data-chips="${escapeHtml(field)}">${options.map(o => chip(o, o, v === o)).join('')}${other ? chip('other', '…', v !== null && !isPreset) : ''}</div>`;
}

export function dayNavHtml(dayKey, todayKey) {
  return `<div class="daynav">
    <button type="button" data-daynav="-1" aria-label="Jour précédent">‹</button>
    <span>${escapeHtml(frLong(dayKey))}</span>
    <button type="button" data-daynav="1" aria-label="Jour suivant"${dayKey >= todayKey ? ' disabled' : ''}>›</button>
  </div>`;
}

/* ---------- DOM ---------- */
export function closeSheet() { document.querySelector('.sheet-backdrop')?.remove(); }

export function openSheet(innerHtml) {
  closeSheet();
  const backdrop = document.createElement('div');
  backdrop.className = 'sheet-backdrop';
  backdrop.innerHTML = `<div class="sheet" role="dialog">${innerHtml}</div>`;
  backdrop.addEventListener('click', e => { if (e.target === backdrop) closeSheet(); });
  document.body.appendChild(backdrop);
  backdrop.querySelector('input, textarea, select')?.focus();
  return backdrop.firstElementChild;
}

export function notice(message) {
  document.querySelector('.notice')?.remove();
  const el = document.createElement('div');
  el.className = 'notice';
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2500);
}

export function downloadText(filename, text) {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export function copyText(text) {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);
  return new Promise((resolve, reject) => {
    const ta = document.createElement('textarea');
    ta.value = text; document.body.appendChild(ta); ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    ok ? resolve() : reject(new Error('copie impossible'));
  });
}

export function longPress(element, selector, handler, delayMs = 500) {
  let timer = null, target = null;
  const cancel = () => { clearTimeout(timer); timer = null; target = null; };
  element.addEventListener('pointerdown', e => {
    target = e.target.closest(selector);
    if (!target) return;
    timer = setTimeout(() => { const t = target; cancel(); handler(t); }, delayMs);
  });
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave', 'scroll']) element.addEventListener(ev, cancel, { passive: true });
  element.addEventListener('pointermove', e => { if (timer && (Math.abs(e.movementX) > 6 || Math.abs(e.movementY) > 6)) cancel(); });
  element.addEventListener('contextmenu', e => {
    const t = e.target.closest(selector);
    if (t) { e.preventDefault(); cancel(); handler(t); }
  });
}
