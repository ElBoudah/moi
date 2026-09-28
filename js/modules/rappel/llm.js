// Couche LLM interchangeable. Gemini, Mistral, Groq et « autre » passent par l'endpoint
// OpenAI-compatible ; Anthropic a son propre format. Réseau injectable pour les tests.
import { PRESETS } from './presets.js';
import { normKind } from './schema.js';
import { questionPrompt, gradePrompt, extractPrompt } from './prompts.js';

const defaultWait = ms => new Promise(r => setTimeout(r, ms));

// Les tiers gratuits renvoient régulièrement 429 (débit) et 503 (surcharge) : deux reprises avec attente croissante.
export async function fetchJSON(url, options, { tries = 3, fetchFn = globalThis.fetch, wait = defaultWait } = {}) {
  let lastErr = null;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetchFn(url, options);
      if ([429, 503, 529].includes(res.status) && i < tries - 1) { await wait(1200 * Math.pow(2.5, i)); continue; }
      const data = await res.json();
      return { res, data };
    } catch (e) {
      lastErr = e;
      if (i < tries - 1) await wait(1200 * Math.pow(2.5, i));
    }
  }
  throw lastErr || new Error('Réseau indisponible');
}

function statusMessage(res, data) {
  if (res.status === 503 || res.status === 529) return 'Modèle surchargé côté fournisseur (503) malgré 3 tentatives — attends une minute, ou passe sur un modèle plus léger dans Réglages.';
  if (res.status === 429) return 'Limite de débit du tier gratuit atteinte (429) — attends un peu avant de continuer.';
  return data && data.error ? (data.error.message || JSON.stringify(data.error)) : `HTTP ${res.status}`;
}

export async function askLLM(llm, prompt, maxTokens = 1000, opts = {}) {
  if (!llm.apiKey) throw new Error('NO_KEY');
  const preset = PRESETS[llm.provider] || PRESETS.custom;
  const baseUrl = (llm.provider === 'custom' ? llm.baseUrl : preset.baseUrl).replace(/\/+$/, '');
  const model = llm.model || preset.defaultModel;

  if (llm.provider === 'anthropic') {
    const { res, data } = await fetchJSON(`${baseUrl}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': llm.apiKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
      body: JSON.stringify({ model, max_tokens: maxTokens, messages: [{ role: 'user', content: prompt }] }),
    }, opts);
    if (!res.ok) throw new Error(statusMessage(res, data));
    if (data.stop_reason === 'max_tokens') throw new Error('Réponse tronquée (max_tokens)');
    return data.content.filter(b => b.type === 'text').map(b => b.text).join('\n');
  }

  const { res, data } = await fetchJSON(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${llm.apiKey}` },
    body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }] }),
  }, opts);
  if (!res.ok) throw new Error(statusMessage(res, data));
  const choice = data.choices && data.choices[0];
  if (!choice || !choice.message) throw new Error('Réponse vide');
  return choice.message.content || '';
}

export function humanError(e) {
  if (e && e.message === 'NO_KEY') return 'Aucune clé API — renseigne-la dans Réglages.';
  return e && e.message ? e.message : 'Erreur inconnue';
}

export function extractJSON(text) {
  const cleaned = text.replace(/```json|```/g, '').trim();
  const i1 = cleaned.indexOf('{'), i2 = cleaned.indexOf('[');
  const start = i1 === -1 ? i2 : i2 === -1 ? i1 : Math.min(i1, i2);
  if (start === -1) throw new Error('Pas de JSON dans la réponse');
  const isArr = cleaned[start] === '[';
  const end = cleaned.lastIndexOf(isArr ? ']' : '}');
  return JSON.parse(cleaned.slice(start, end + 1));
}

export async function llmQuestion(llm, item, tier, opts = {}) {
  const out = extractJSON(await askLLM(llm, questionPrompt(item, tier), 1000, opts));
  if (!out || typeof out.question !== 'string' || !out.question.trim()) throw new Error('Question manquante');
  return out.question.trim();
}

export async function llmGrade(llm, item, question, answer, tier, opts = {}) {
  const out = extractJSON(await askLLM(llm, gradePrompt(item, question, answer, tier), 1500, opts));
  if (!out || !out.verdict) throw new Error('Verdict manquant');
  return { verdict: String(out.verdict), explication: typeof out.explication === 'string' ? out.explication : '' };
}

export async function llmExtract(llm, dump, count, opts = {}) {
  const out = extractJSON(await askLLM(llm, extractPrompt(dump, count), 4000, opts));
  if (!Array.isArray(out)) throw new Error('Format inattendu');
  return out
    .filter(p => p && typeof p === 'object')
    .map(p => ({ kind: normKind(p.kind), title: String(p.title ?? '').trim(), content: String(p.content ?? '').trim() }))
    .filter(p => p.title && p.content);
}
