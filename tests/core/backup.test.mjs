import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  moduleExportJson, moduleExportFilename, parseModuleExport, bundleJson, parseBundle,
  encryptText, decryptText, cloudBackup, cloudRestore, resetCloudSession, autoBackup, cloudStatus,
  GIST_FILE, LAST_LOCAL_KEY, LAST_CLOUD_KEY,
} from '../../js/core/backup.js';
import { suiviSchema } from '../../js/modules/suivi/schema.js';
import { pulsionSchema } from '../../js/modules/pulsion/schema.js';
import { settingsSchema } from '../../js/modules/settings/schema.js';
import { memoryStorage } from '../fixtures/helpers.mjs';

const NOW = '2026-09-20T10:00:00.000Z';
const schemas = { suivi: suiviSchema, pulsion: pulsionSchema, settings: settingsSchema };
const docs = () => ({
  suivi: { version: 1, days: { '2026-09-20': { bed: null, wake: null, clarity: 5, mood: null, pleasure: null, drive: null } } },
  pulsion: pulsionSchema.empty(),
  settings: { ...settingsSchema.empty(), llm: { ...settingsSchema.empty().llm, apiKey: 'sk-secret' } },
});

function fakeFetch(gists) {
  return async (url, opts = {}) => {
    const method = opts.method ?? 'GET';
    const id = url.split('/').pop();
    if (method === 'POST') {
      const body = JSON.parse(opts.body);
      gists.g1 = { id: 'g1', files: Object.fromEntries(Object.entries(body.files).map(([k, v]) => [k, { content: v.content, truncated: false }])) };
      return { ok: true, status: 201, json: async () => gists.g1 };
    }
    if (method === 'PATCH') {
      const body = JSON.parse(opts.body);
      for (const [k, v] of Object.entries(body.files)) gists[id].files[k] = { content: v.content, truncated: false };
      return { ok: true, status: 200, json: async () => gists[id] };
    }
    return gists[id] ? { ok: true, status: 200, json: async () => gists[id] } : { ok: false, status: 404, json: async () => ({}) };
  };
}

test('export par module : format, nom de fichier, relecture', () => {
  const text = moduleExportJson('suivi', docs().suivi, NOW);
  const parsed = JSON.parse(text);
  assert.equal(parsed.format, 'moi-suivi-1');
  assert.equal(parsed.exportedAt, NOW);
  assert.equal(moduleExportFilename('suivi', '2026-09-20'), 'moi-suivi-2026-09-20.json');
  assert.deepEqual(parseModuleExport('suivi', text), docs().suivi);
  assert.throws(() => parseModuleExport('pulsion', text), /export pulsion/i);
  assert.throws(() => parseModuleExport('suivi', '{nope'), /JSON/);
});

test('bundleJson embarque tous les modules sans la clé API', () => {
  const b = JSON.parse(bundleJson(docs(), NOW));
  assert.equal(b.format, 'moi-1');
  assert.equal(b.modules.settings.llm.apiKey, '');
  assert.equal(b.modules.suivi.days['2026-09-20'].clarity, 5);
  assert.equal(docs().settings.llm.apiKey, 'sk-secret'); // la source n'est pas modifiée
});

test('parseBundle valide chaque module et refuse tout si un seul est invalide', () => {
  const good = parseBundle(bundleJson(docs(), NOW), schemas);
  assert.equal(good.exportedAt, NOW);
  assert.deepEqual(Object.keys(good.modules).sort(), ['pulsion', 'settings', 'suivi']);
  const broken = JSON.parse(bundleJson(docs(), NOW));
  broken.modules.pulsion.events = [{ id: 'x' }];
  assert.throws(() => parseBundle(JSON.stringify(broken), schemas), /Backup invalide.*pulsion/);
  assert.throws(() => parseBundle(JSON.stringify({ format: 'suivi-export-1' }), schemas), /format/i);
  const partial = parseBundle(JSON.stringify({ format: 'moi-1', exportedAt: NOW, modules: { suivi: docs().suivi } }), schemas);
  assert.deepEqual(Object.keys(partial.modules), ['suivi']);
});

test('chiffrement aller-retour, mauvaise passphrase refusée', async () => {
  const packed = await encryptText('secret', 'bonjour');
  const env = JSON.parse(packed);
  assert.equal(env.v, 1);
  assert.equal(await decryptText('secret', packed), 'bonjour');
  await assert.rejects(decryptText('autre', packed));
});

test('cloudBackup : non configuré, puis création du gist, puis déjà fait, puis force', async () => {
  resetCloudSession();
  const storage = memoryStorage();
  const gists = {};
  const fetchFn = fakeFetch(gists);
  const getJson = () => bundleJson(docs(), NOW);
  assert.equal(await cloudBackup({ storage, getJson, todayKey: '2026-09-20', fetchFn }), 'non configuré');
  const answers = ['tok', 'pass'];
  const ask = () => answers.shift();
  assert.equal(await cloudBackup({ storage, getJson, todayKey: '2026-09-20', ask, force: true, fetchFn }), 'ok');
  assert.equal(storage.getItem('cloud_gist'), 'g1');
  assert.equal(storage.getItem(LAST_CLOUD_KEY), '2026-09-20');
  assert.ok(gists.g1.files[GIST_FILE]);
  assert.equal(await cloudBackup({ storage, getJson, todayKey: '2026-09-20', fetchFn }), 'déjà fait');
  resetCloudSession();
  assert.equal(await cloudBackup({ storage, getJson, todayKey: '2026-09-20', fetchFn }), 'déjà fait');
  assert.equal(await cloudBackup({ storage, getJson, todayKey: '2026-09-21', fetchFn }), 'ok');
  assert.match(cloudStatus(storage), /dernier push 2026-09-21/);
});

test('cloudRestore rend le texte déchiffré, erreur lisible sur mauvaise passphrase', async () => {
  resetCloudSession();
  const storage = memoryStorage({ cloud_token: 'tok', cloud_pass: 'pass' });
  const gists = {};
  const fetchFn = fakeFetch(gists);
  await cloudBackup({ storage, getJson: () => 'payload', todayKey: '2026-09-20', fetchFn, force: true });
  assert.equal(await cloudRestore({ storage, fetchFn }), 'payload');
  storage.setItem('cloud_pass', 'wrong');
  await assert.rejects(cloudRestore({ storage, fetchFn }), /passphrase/i);
  storage.setItem('cloud_gist', 'nope');
  await assert.rejects(cloudRestore({ storage, fetchFn }), /Gist API 404/);
});

test('cloudBackup absorbe une erreur réseau', async () => {
  resetCloudSession();
  const storage = memoryStorage({ cloud_token: 'tok', cloud_pass: 'pass' });
  const r = await cloudBackup({ storage, getJson: () => 'x', todayKey: '2026-09-20', fetchFn: async () => { throw new Error('offline'); } });
  assert.match(r, /^erreur : offline/);
  assert.equal(storage.getItem(LAST_CLOUD_KEY), null);
});

test('autoBackup une fois par jour, jamais bloquant', () => {
  const storage = memoryStorage();
  const calls = [];
  const download = (name, text) => calls.push([name, text]);
  assert.equal(autoBackup({ storage, getJson: () => '{}', todayKey: '2026-09-20', download }), true);
  assert.deepEqual(calls, [['moi_2026-09-20.json', '{}']]);
  assert.equal(storage.getItem(LAST_LOCAL_KEY), '2026-09-20');
  assert.equal(autoBackup({ storage, getJson: () => '{}', todayKey: '2026-09-20', download }), false);
  assert.equal(autoBackup({ storage, getJson: () => { throw new Error('x'); }, todayKey: '2026-09-21', download }), false);
  assert.equal(cloudStatus(memoryStorage()), 'cloud non configuré');
});
