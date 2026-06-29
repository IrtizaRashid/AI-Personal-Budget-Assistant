// AI service — powered by local Ollama (qwen2.5:3b).
import { config } from '../config/env.js';

const extractJSON = (raw) => {
  if (!raw || typeof raw !== 'string') throw new Error('Empty response from AI');

  const fenceStripped = raw
    .replace(/^```(?:json)?\s*/im, '')
    .replace(/\s*```\s*$/im, '')
    .trim();

  for (const candidate of [fenceStripped, raw.trim()]) {
    try { return JSON.parse(candidate); } catch { /* try next */ }
  }

  const jsonMatch = raw.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
  if (jsonMatch) {
    try { return JSON.parse(jsonMatch[1]); } catch { /* fall through */ }
  }

  throw new Error('AI returned invalid JSON that could not be repaired.');
};

export const geminiChat = async (systemPrompt, userContent, temperature = 0) => {
  const url = `${config.ollama.baseUrl}/api/chat`;
  let res;

  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: config.ollama.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ],
        stream: false,
        format: 'json',
        options: { temperature, num_predict: 400 },
      }),
      signal: AbortSignal.timeout(120000),
    });
  } catch (err) {
    if (err?.name === 'TimeoutError') throw new Error('Ollama request timed out. Is Ollama running?');
    throw new Error('Cannot reach Ollama. Make sure Ollama is running on localhost:11434.');
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Ollama error ${res.status}: ${body}`);
  }

  const data = await res.json();
  const raw = data?.message?.content ?? '';
  const parsed = extractJSON(raw);

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('AI response was not a valid JSON object.');
  }

  return parsed;
};
