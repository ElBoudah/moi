import { test } from 'node:test';
import assert from 'node:assert/strict';
import { settingsSchema, THEMES } from '../../js/modules/settings/schema.js';
import { PRESETS } from '../../js/modules/rappel/presets.js';

test('le document vide est valide et sur le preset Gemini', () => {
  const doc = settingsSchema.empty();
  assert.equal(settingsSchema.validate(doc).ok, true);
  assert.equal(doc.theme, 'system');
  assert.equal(doc.lastTab, 'suivi');
  assert.equal(doc.llm.provider, 'gemini');
  assert.equal(doc.llm.model, PRESETS.gemini.defaultModel);
  assert.equal(doc.llm.apiKey, '');
  assert.deepEqual(THEMES, ['system', 'light', 'dark']);
});

test('validate refuse thème, fournisseur ou champs mal formés', () => {
  const ok = settingsSchema.empty();
  assert.equal(settingsSchema.validate({ ...ok, theme: 'sepia' }).ok, false);
  assert.equal(settingsSchema.validate({ ...ok, llm: { ...ok.llm, provider: 'openai' } }).ok, false);
  assert.equal(settingsSchema.validate({ ...ok, llm: { ...ok.llm, apiKey: 12 } }).ok, false);
  assert.equal(settingsSchema.validate({ ...ok, lastTab: null }).ok, false);
  assert.equal(settingsSchema.validate({ ...ok, version: 2 }).ok, false);
  assert.equal(settingsSchema.validate(null).ok, false);
});
