// Talks to Workers AI and turns whatever shape comes back into { text, toolCalls, usage }.
// The response format could not be tested against the live service in development, so this reads both shapes the
// Cloudflare docs show (flat `tool_calls[{name, arguments}]` and OpenAI-style `choices[0].message.tool_calls`).
import { MODEL, MAX_OUTPUT_TOKENS } from './budget.js';
import { TOOL_SPECS } from './live.js';

const toArgs = (a) => { if (a && typeof a === 'object') return a; try { const j = JSON.parse(a || '{}'); return j && typeof j === 'object' ? j : {}; } catch { return {}; } };

export function normalise(res) {
  const msg = res?.choices?.[0]?.message;
  const calls = (res?.tool_calls || msg?.tool_calls || []).map((c, i) => ({
    id: c.id || `call_${i}`, name: c.name || c.function?.name, arguments: toArgs(c.arguments ?? c.function?.arguments),
  })).filter((c) => typeof c.name === 'string');
  const text = typeof res?.response === 'string' ? res.response : typeof msg?.content === 'string' ? msg.content : typeof res?.result?.response === 'string' ? res.result.response : '';
  return { text, toolCalls: calls, usage: res?.usage || res?.result?.usage || null };
}

export function makeRunModel(env) {
  return async function runModel({ messages }) {
    const res = await env.AI.run(MODEL, {
      messages, max_tokens: MAX_OUTPUT_TOKENS, temperature: 0,
      tools: TOOL_SPECS.map((t) => ({ type: 'function', function: t })),
    });
    return normalise(res);
  };
}

/** True when Workers AI says the free daily allocation is used up (error 3036, HTTP 429) or capacity is out (3040). */
export const isAllowanceError = (e) => /\b(3036|3040|429)\b|daily free allocation|out of capacity/i.test(String(e?.message || e));
