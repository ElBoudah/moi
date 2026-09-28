export function memoryStorage(initial = {}) {
  const m = new Map(Object.entries(initial));
  return {
    getItem: k => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: k => m.delete(k),
    _map: m,
  };
}

let tick = 0;
let idc = 0;
export function resetFakes() { tick = 0; idc = 0; }
export function fakeNow() { tick += 1; return `2026-09-20T10:${String(tick).padStart(2, '0')}:00.000Z`; }
export function fakeId() { idc += 1; return `id${idc}`; }
