import { test } from 'node:test';
import assert from 'node:assert/strict';
import { askLLM, extractJSON, humanError, llmQuestion, llmGrade, llmExtract } from '../../js/modules/rappel/llm.js';
import { item } from './schema.test.mjs';

const llm = { provider: 'gemini', apiKey: 'k', model: 'gemini-3.5-flash', baseUrl: '' };
const noWait = async () => {};
const openaiReply = text => async () => ({ ok: true, status: 200, json: async () => ({ choices: [{ message: { content: text } }] }) });

test('extractJSON tolère les blocs de code et le texte autour', () => {
  assert.deepEqual(extractJSON('Voici :\n```json\n{"question": "Q ?"}\n```'), { question: 'Q ?' });
  assert.deepEqual(extractJSON('[{"a":1}] merci'), [{ a: 1 }]);
  assert.throws(() => extractJSON('pas de json'), /JSON/);
});

test('humanError : sans clé, message vers Réglages', () => {
  assert.match(humanError(new Error('NO_KEY')), /Aucune clé API/);
  assert.equal(humanError(new Error('boom')), 'boom');
  assert.equal(humanError(null), 'Erreur inconnue');
});

test('askLLM refuse sans clé, sans appel réseau', async () => {
  let called = 0;
  await assert.rejects(askLLM({ ...llm, apiKey: '' }, 'p', 100, { fetchFn: async () => { called += 1; } }), /NO_KEY/);
  assert.equal(called, 0);
});

test('chemin OpenAI-compatible : URL, en-tête Bearer, contenu', async () => {
  const calls = [];
  const fetchFn = async (url, opts) => { calls.push({ url, opts }); return openaiReply('{"question":"Quand ?"}')(); };
  const q = await llmQuestion(llm, item(), 'restitution', { fetchFn, wait: noWait });
  assert.equal(q, 'Quand ?');
  assert.equal(calls[0].url, 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions');
  assert.equal(calls[0].opts.headers.Authorization, 'Bearer k');
  assert.equal(JSON.parse(calls[0].opts.body).model, 'gemini-3.5-flash');
});

test('chemin Anthropic : en-têtes et blocs de texte', async () => {
  const calls = [];
  const fetchFn = async (url, opts) => { calls.push({ url, opts }); return { ok: true, status: 200, json: async () => ({ stop_reason: 'end_turn', content: [{ type: 'text', text: '{"verdict":"good","explication":"Juste."}' }] }) }; };
  const r = await llmGrade({ ...llm, provider: 'anthropic', model: 'claude-haiku-4-5' }, item(), 'Q ?', 'R.', 'restitution', { fetchFn, wait: noWait });
  assert.deepEqual(r, { verdict: 'good', explication: 'Juste.' });
  assert.equal(calls[0].url, 'https://api.anthropic.com/v1/messages');
  assert.equal(calls[0].opts.headers['x-api-key'], 'k');
  assert.equal(calls[0].opts.headers['anthropic-version'], '2023-06-01');
});

test('429 : deux reprises puis message de débit ; 503 persistant : message de surcharge', async () => {
  let n = 0;
  const flaky = async () => { n += 1; return n < 3 ? { ok: false, status: 429, json: async () => ({}) } : openaiReply('{"question":"Q"}')(); };
  assert.equal(await llmQuestion(llm, item(), 'restitution', { fetchFn: flaky, wait: noWait }), 'Q');
  assert.equal(n, 3);
  const always429 = async () => ({ ok: false, status: 429, json: async () => ({}) });
  await assert.rejects(llmQuestion(llm, item(), 'restitution', { fetchFn: always429, wait: noWait }), /débit/i);
  const always503 = async () => ({ ok: false, status: 503, json: async () => ({}) });
  await assert.rejects(llmQuestion(llm, item(), 'restitution', { fetchFn: always503, wait: noWait }), /surchargé/i);
});

test('réponses inexploitables : pas de JSON, champ manquant, réponse vide', async () => {
  await assert.rejects(llmQuestion(llm, item(), 'restitution', { fetchFn: openaiReply('Désolé.'), wait: noWait }), /JSON/);
  await assert.rejects(llmQuestion(llm, item(), 'restitution', { fetchFn: openaiReply('{"x":1}'), wait: noWait }), /Question manquante/);
  await assert.rejects(llmGrade(llm, item(), 'Q', 'R', 'restitution', { fetchFn: openaiReply('{"explication":"…"}'), wait: noWait }), /Verdict manquant/);
  const empty = async () => ({ ok: true, status: 200, json: async () => ({ choices: [] }) });
  await assert.rejects(llmQuestion(llm, item(), 'restitution', { fetchFn: empty, wait: noWait }), /vide/i);
  const err = async () => ({ ok: false, status: 400, json: async () => ({ error: { message: 'clé invalide' } }) });
  await assert.rejects(llmQuestion(llm, item(), 'restitution', { fetchFn: err, wait: noWait }), /clé invalide/);
});

test('llmExtract normalise les fiches : genre inconnu → fait, vides écartées, tableau exigé', async () => {
  const out = await llmExtract(llm, 'dump', 'auto', { fetchFn: openaiReply('[{"kind":"concept","title":"A","content":"a."},{"kind":"fait","title":"","content":"x"},{"title":"B","content":"b."}]'), wait: noWait });
  assert.deepEqual(out, [{ kind: 'fait', title: 'A', content: 'a.' }, { kind: 'fait', title: 'B', content: 'b.' }]);
  await assert.rejects(llmExtract(llm, 'dump', 3, { fetchFn: openaiReply('{"kind":"fait"}'), wait: noWait }), /Format inattendu/);
});
