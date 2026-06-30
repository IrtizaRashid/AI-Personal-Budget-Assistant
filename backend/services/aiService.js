// AI service — powered by local Ollama.
import { config } from '../config/env.js';

// Attempt to close truncated JSON so partial responses don't hard-fail.
const repairJSON = (raw) => {
  let s = raw.trim();
  // Remove trailing comma before repair
  s = s.replace(/,\s*$/, '');
  const opens = (s.match(/\{/g) || []).length - (s.match(/\}/g) || []).length;
  const arrOpens = (s.match(/\[/g) || []).length - (s.match(/\]/g) || []).length;
  s += ']'.repeat(Math.max(0, arrOpens)) + '}'.repeat(Math.max(0, opens));
  return s;
};

const extractJSON = (raw) => {
  if (!raw || typeof raw !== 'string') throw new Error('Empty response from AI');

  const candidates = [
    raw.replace(/^```(?:json)?\s*/im, '').replace(/\s*```\s*$/im, '').trim(),
    raw.trim(),
  ];

  for (const c of candidates) {
    try { return JSON.parse(c); } catch { /* try next */ }
    try { return JSON.parse(repairJSON(c)); } catch { /* try next */ }
  }

  const jsonMatch = raw.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
  if (jsonMatch) {
    try { return JSON.parse(jsonMatch[1]); } catch { /* fall through */ }
    try { return JSON.parse(repairJSON(jsonMatch[1])); } catch { /* fall through */ }
  }

  throw new Error('AI returned invalid JSON that could not be repaired.');
};

// Shared fetch helper
const ollamaFetch = async (body) => {
  const url = `${config.ollama.baseUrl}/api/chat`;
  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error('Cannot reach Ollama. Make sure Ollama is running on localhost:11434.');
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Ollama error ${res.status}: ${body}`);
  }
  return res;
};

// JSON-output call — used by intent classifier and recommendation engine.
export const geminiChat = async (systemPrompt, userContent, temperature = 0) => {
  const res = await ollamaFetch({
    model: config.ollama.model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent },
    ],
    stream: false,
    format: 'json',
    options: { temperature, num_predict: 400, num_thread: 8 },
  });

  let data;
  try { data = await res.json(); }
  catch { data = { message: { content: await res.text().catch(() => '') } }; }

  const raw = data?.message?.content ?? '';
  const parsed = extractJSON(raw);
  if (!parsed || typeof parsed !== 'object') throw new Error('AI response was not a valid JSON object.');
  return parsed;
};

// Plain-text call — used by the Universal Query Engine for natural-language answers.
// Returns a raw string, not JSON.
export const geminiText = async (systemPrompt, userContent, temperature = 0.3) => {
  const res = await ollamaFetch({
    model: config.ollama.model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent },
    ],
    stream: false,
    options: { temperature, num_predict: 1200, num_thread: 8 },
  });

  let data;
  try { data = await res.json(); }
  catch { data = { message: { content: '' } }; }

  return (data?.message?.content ?? '').trim();
};
