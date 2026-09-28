// Fournisseurs LLM : Gemini, Mistral, Groq et « autre » passent par un endpoint OpenAI-compatible,
// Anthropic a son propre format. Données seules ; la couche réseau vit dans llm.js (plan 4).
export const PRESETS = {
  gemini: { label: 'Gemini (Google)', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', defaultModel: 'gemini-3.5-flash', keyUrl: 'https://aistudio.google.com/app/apikey' },
  mistral: { label: 'Mistral', baseUrl: 'https://api.mistral.ai/v1', defaultModel: 'mistral-small-latest', keyUrl: 'https://console.mistral.ai/' },
  groq: { label: 'Groq', baseUrl: 'https://api.groq.com/openai/v1', defaultModel: 'llama-3.3-70b-versatile', keyUrl: 'https://console.groq.com/keys' },
  anthropic: { label: 'Anthropic (Claude)', baseUrl: 'https://api.anthropic.com/v1', defaultModel: 'claude-haiku-4-5', keyUrl: 'https://console.anthropic.com/' },
  custom: { label: 'Autre (OpenAI-compatible)', baseUrl: '', defaultModel: '', keyUrl: '' },
};
