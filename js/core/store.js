// Store générique : un document JSON validé, persisté à chaque opération.
// Un schéma décrit la clé, la version courante, le document vide, la validation et les migrations.

const defaultNow = () => new Date().toISOString();
const defaultId = () => crypto.randomUUID();

export function migrate(doc, schema) {
  let cur = doc;
  while (cur.version < schema.version) {
    const step = schema.migrations[cur.version];
    if (!step) throw new Error(`Migration ${cur.version} → ${cur.version + 1} manquante.`);
    cur = step(cur);
  }
  return cur;
}

export class Store {
  constructor(storage, schema, { now = defaultNow, makeId = defaultId } = {}) {
    this.storage = storage;
    this.schema = schema;
    this.now = now;
    this.makeId = makeId;
    this._doc = null;
    this.corrupt = null;
    this.saveError = null;
    this.onSaveError = null;
    this._subs = new Set();
  }

  get key() { return this.schema.key; }
  get corruptKey() { return `${this.schema.key}.corrupt`; }
  get doc() { return this._doc; }

  load() {
    this.corrupt = this.storage.getItem(this.corruptKey) ?? null;
    const raw = this.storage.getItem(this.key);
    if (raw === null) {
      this._doc = this.schema.empty(this.now, this.makeId);
      this._save();
      return;
    }
    let parsed;
    try { parsed = JSON.parse(raw); } catch { parsed = undefined; }
    const v = this.schema.validate(parsed);
    if (!v.ok) {
      this.corrupt = raw;
      try { this.storage.setItem(this.corruptKey, raw); } catch { /* stockage indisponible */ }
      this._doc = this.schema.empty(this.now, this.makeId);
      this._save();
      return;
    }
    const before = v.doc.version;
    this._doc = migrate(v.doc, this.schema);
    if (this._doc.version !== before) this._save();
  }

  clearCorrupt() {
    this.commit(() => {
      this.storage.removeItem?.(this.corruptKey);
      this.corrupt = null;
    });
  }

  subscribe(fn) {
    this._subs.add(fn);
    return () => this._subs.delete(fn);
  }

  _save() {
    try {
      this.storage.setItem(this.key, JSON.stringify(this._doc));
      this.saveError = null;
    } catch {
      this.saveError = "Impossible d'enregistrer : stockage plein ou indisponible. Exportez vos données.";
      this.onSaveError?.(this.saveError);
    }
  }

  commit(mutator, { notify = true } = {}) {
    const result = mutator(this._doc);
    this._save();
    if (notify) for (const fn of this._subs) fn(this._doc);
    return result;
  }

  exportJson() { return JSON.stringify(this._doc, null, 2); }

  replace(rawDoc) {
    const v = this.schema.validate(rawDoc);
    if (!v.ok) throw new Error(v.error);
    const doc = migrate(v.doc, this.schema);
    this.commit(() => { this._doc = doc; });
  }

  importJson(text) {
    let parsed;
    try { parsed = JSON.parse(text); } catch { throw new Error("Le fichier n'est pas du JSON valide."); }
    this.replace(parsed);
  }
}
