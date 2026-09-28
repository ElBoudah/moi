// Backup en trois couches, une seule implémentation :
// 1) export et import manuels par module ;
// 2) fichier quotidien du bundle complet dans Téléchargements ;
// 3) push quotidien du même bundle, chiffré côté client (PBKDF2 → AES-256-GCM),
//    vers un Gist GitHub privé. Push seul, jamais de synchronisation.
// La config cloud (token, passphrase, gistId) vit dans les clés déjà utilisées par
// les anciennes apps sur cette origine. La clé API LLM n'entre dans aucun backup.
import { migrate } from './store.js';

export const BUNDLE_FORMAT = 'moi-1';
export const GIST_FILE = 'moi.enc.json';
export const LAST_LOCAL_KEY = 'moi.lastLocalBackup';
export const LAST_CLOUD_KEY = 'moi.lastCloudBackup';

/* ---------- Export et import par module ---------- */
export function moduleExportJson(name, doc, nowIso = new Date().toISOString()) {
  return JSON.stringify({ format: `moi-${name}-1`, exportedAt: nowIso, doc }, null, 2);
}

export function moduleExportFilename(name, dayKey) { return `moi-${name}-${dayKey}.json`; }

function parseJson(text) {
  try { return JSON.parse(text); } catch { throw new Error("Le fichier n'est pas du JSON valide."); }
}

export function parseModuleExport(name, text) {
  const parsed = parseJson(text);
  if (!parsed || parsed.format !== `moi-${name}-1` || !parsed.doc) throw new Error(`Ce fichier n'est pas un export ${name}.`);
  return parsed.doc;
}

/* ---------- Bundle global ---------- */
export function bundleJson(docs, nowIso = new Date().toISOString()) {
  const modules = { ...docs };
  if (modules.settings) modules.settings = { ...modules.settings, llm: { ...modules.settings.llm, apiKey: '' } };
  return JSON.stringify({ format: BUNDLE_FORMAT, exportedAt: nowIso, modules }, null, 1);
}

export function parseBundle(text, schemas) {
  const parsed = parseJson(text);
  if (!parsed || parsed.format !== BUNDLE_FORMAT || !parsed.modules || typeof parsed.modules !== 'object') {
    throw new Error("Ce fichier n'est pas un backup Moi (format inconnu).");
  }
  const modules = {}, errors = [];
  for (const [name, schema] of Object.entries(schemas)) {
    const raw = parsed.modules[name];
    if (raw === undefined) continue;
    const v = schema.validate(raw);
    if (!v.ok) { errors.push(`${name} — ${v.error}`); continue; }
    modules[name] = migrate(v.doc, schema);
  }
  if (errors.length) throw new Error(`Backup invalide : ${errors.join(' ; ')}`);
  return { exportedAt: parsed.exportedAt, modules };
}

/* ---------- Chiffrement ---------- */
// Par tranches : étaler un argument par octet fait déborder la pile dès ~125 Ko.
const b64 = buf => {
  const bytes = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
};
const ub64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));

async function deriveKey(pass, salt) {
  const km = await crypto.subtle.importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 150000, hash: 'SHA-256' }, km, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

export async function encryptText(pass, text) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(pass, salt);
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(text));
  return JSON.stringify({ v: 1, kdf: 'PBKDF2-150k', salt: b64(salt), iv: b64(iv), data: b64(ct) });
}

export async function decryptText(pass, packed) {
  const p = JSON.parse(packed);
  const key = await deriveKey(pass, ub64(p.salt));
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: ub64(p.iv) }, key, ub64(p.data));
  return new TextDecoder().decode(pt);
}

/* ---------- Config partagée et API Gist ---------- */
export function cloudConfig(storage, ask = null) {
  let token = storage.getItem('cloud_token');
  let pass = storage.getItem('cloud_pass');
  if ((!token || !pass) && ask) {
    token = (ask('Token GitHub (portée Gists uniquement) :') || '').trim();
    pass = (ask('Passphrase de chiffrement (à noter précieusement !) :') || '').trim();
    if (token && pass) {
      storage.setItem('cloud_token', token);
      storage.setItem('cloud_pass', pass);
      // Nouveau téléphone : réutiliser le gist existant plutôt qu'en créer un vide.
      if (!storage.getItem('cloud_gist')) {
        const gid = (ask("ID d'un gist de backup existant (vide pour en créer un) :") || '').trim();
        if (gid) storage.setItem('cloud_gist', gid);
      }
    }
  }
  return token && pass ? { token, pass, gistId: storage.getItem('cloud_gist') } : null;
}

export async function gistApi(method, path, token, body, fetchFn = globalThis.fetch) {
  const r = await fetchFn(`https://api.github.com${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) throw new Error(`Gist API ${r.status}`);
  return r.json();
}

/* ---------- Push quotidien, best-effort, jamais bloquant ---------- */
let sessionDone = false;
export function resetCloudSession() { sessionDone = false; }

export async function cloudBackup({ storage, getJson, todayKey, ask = null, force = false, fetchFn = globalThis.fetch }) {
  try {
    if (!force && (sessionDone || storage.getItem(LAST_CLOUD_KEY) === todayKey)) return 'déjà fait';
    const cfg = cloudConfig(storage, ask);
    if (!cfg) return 'non configuré';
    const enc = await encryptText(cfg.pass, getJson());
    if (!cfg.gistId) {
      const g = await gistApi('POST', '/gists', cfg.token, {
        description: 'Backups chiffrés PWA (AES-GCM, illisible sans passphrase)',
        public: false, files: { [GIST_FILE]: { content: enc } },
      }, fetchFn);
      storage.setItem('cloud_gist', g.id);
    } else {
      await gistApi('PATCH', `/gists/${cfg.gistId}`, cfg.token, { files: { [GIST_FILE]: { content: enc } } }, fetchFn);
    }
    storage.setItem(LAST_CLOUD_KEY, todayKey);
    sessionDone = true;
    return 'ok';
  } catch (e) {
    return `erreur : ${e.message}`;
  }
}

/* ---------- Restauration : rend le texte déchiffré ---------- */
export async function cloudRestore({ storage, ask = null, fetchFn = globalThis.fetch }) {
  const cfg = cloudConfig(storage, ask);
  if (!cfg) throw new Error('cloud non configuré');
  let gid = cfg.gistId;
  if (!gid) {
    gid = (ask?.("ID du gist de backup (visible dans l'URL du gist) :") || '').trim();
    if (!gid) throw new Error("pas d'ID de gist");
  }
  const g = await gistApi('GET', `/gists/${gid}`, cfg.token, undefined, fetchFn);
  if (!cfg.gistId) storage.setItem('cloud_gist', gid); // mémorisé seulement une fois vérifié
  const f = g.files?.[GIST_FILE];
  if (!f) throw new Error('aucun backup Moi dans ce gist');
  const content = f.truncated ? await (await fetchFn(f.raw_url)).text() : f.content;
  try { return await decryptText(cfg.pass, content); }
  catch { throw new Error('Déchiffrement impossible : passphrase incorrecte ou backup altéré.'); }
}

/* ---------- Fichier quotidien ---------- */
export function autoBackup({ storage, getJson, todayKey, download }) {
  try {
    if (storage.getItem(LAST_LOCAL_KEY) === todayKey) return false;
    download(`moi_${todayKey}.json`, getJson());
    storage.setItem(LAST_LOCAL_KEY, todayKey);
    return true;
  } catch { return false; }
}

export function cloudStatus(storage) {
  const cfg = storage.getItem('cloud_token') && storage.getItem('cloud_pass');
  const last = storage.getItem(LAST_CLOUD_KEY);
  if (!cfg) return 'cloud non configuré';
  return last ? `cloud ✓ dernier push ${last}` : 'cloud configuré, pas encore de push';
}
