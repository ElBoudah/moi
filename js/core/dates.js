// Dates : clés de jour "AAAA-MM-JJ" en heure locale, horodatages ISO.

export function keyOf(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function today(now = new Date()) { return keyOf(now); }

export function parseKey(k) {
  const [y, m, d] = k.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(k, n) {
  const dt = parseKey(k);
  dt.setDate(dt.getDate() + n);
  return keyOf(dt);
}

export function diffDays(from, to) {
  return Math.round((parseKey(to) - parseKey(from)) / 864e5);
}

export function isDayKey(k) {
  return typeof k === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(k) && keyOf(parseKey(k)) === k;
}

export function frLong(k) {
  return parseKey(k).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
}

export function frShort(k) {
  return parseKey(k).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
}

export function hhmm(iso) {
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

const dateFmt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' });
export function formatDate(iso) { return dateFmt.format(new Date(iso)); }

export function daysBetween(isoA, isoB) {
  const day = 86_400_000;
  return Math.floor(new Date(isoB).getTime() / day) - Math.floor(new Date(isoA).getTime() / day);
}

export function relativeDays(iso, nowIso = new Date().toISOString()) {
  const d = daysBetween(iso, nowIso);
  if (d <= 0) return "aujourd'hui";
  if (d === 1) return 'hier';
  return `il y a ${d} j`;
}

export function toMin(t) {
  if (typeof t !== 'string') return null;
  const m = t.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]), mi = Number(m[2]);
  if (h > 23 || mi > 59) return null;
  return h * 60 + mi;
}

export function isTime(v) { return typeof v === 'string' && /^\d{2}:\d{2}$/.test(v) && toMin(v) !== null; }

export function hm(mins) {
  if (mins === null || mins === undefined) return '—';
  const r = Math.round(mins);
  return `${Math.floor(r / 60)} h ${String(r % 60).padStart(2, '0')}`;
}
