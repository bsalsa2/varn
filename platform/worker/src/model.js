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
  const finish = msg ? res?.choices?.[0]?.finish_reason ?? null : null;
  const shape = `keys=${Object.keys(res || {}).slice(0, 8).join('|')};text=${text.length}ch;tool_calls=${calls.length};finish=${finish}`;
  return { text, toolCalls: calls, usage: res?.usage || res?.result?.usage || null, shape };
}

/** Some chat templates (Mistral v0.2) have no system role: fold the system text into the first user message. */
export function foldSystem(messages) {
  if (messages[0]?.role !== 'system') return messages;
  const [sys, ...rest] = messages; const i = rest.findIndex((m) => m.role === 'user');
  if (i === -1) return rest;
  return rest.map((m, k) => (k === i ? { ...m, content: `${sys.content}\n\n${m.content}` } : m));
}

/** Gemini REST body from our chat messages: system text becomes systemInstruction, same-role neighbours merge, assistant -> model. */
export function geminiBody(messages, maxTokens, model) {
  const system = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n');
  const contents = [];
  for (const m of messages) {
    if (m.role === 'system') continue;
    const role = m.role === 'assistant' ? 'model' : 'user';
    const last = contents[contents.length - 1];
    if (last && last.role === role) last.parts[0].text += `\n\n${m.content}`; else contents.push({ role, parts: [{ text: String(m.content) }] });
  }
  if (contents[0]?.role === 'model') contents.unshift({ role: 'user', parts: [{ text: '(start)' }] });
  const generationConfig = { maxOutputTokens: maxTokens, temperature: 0, responseMimeType: 'application/json' };
  // Thinking is slow and eats the output budget: switch it off (2.5) or to the lowest level (3 and later).
  if (/gemini-2\.5-flash/.test(model)) generationConfig.thinkingConfig = { thinkingBudget: 0 };
  else if (/gemini-([3-9]|\d{2,})/.test(model)) generationConfig.thinkingConfig = { thinkingLevel: 'minimal' };
  return { systemInstruction: { parts: [{ text: system }] }, contents, generationConfig };
}

export function normaliseGemini(res) {
  const cand = res?.candidates?.[0];
  const text = (cand?.content?.parts || []).map((p) => (typeof p.text === 'string' ? p.text : '')).join('');
  const u = res?.usageMetadata;
  return { text, toolCalls: [], usage: u ? { prompt_tokens: u.promptTokenCount, completion_tokens: u.candidatesTokenCount } : null, shape: `gemini;text=${text.length}ch;finish=${cand?.finishReason ?? null}` };
}

/** Stable Flash models (not image/audio/preview) from Google's models.list result, best first: newest, full before lite. */
export function rankGeminiModels(list) {
  const rank = (name) => { const m = /^models\/gemini-(\d+(?:\.\d+)?)-flash(-lite)?$/.exec(name); return m ? [parseFloat(m[1]), m[2] ? 0 : 1] : null; };
  return (list?.models || []).filter((m) => (m.supportedGenerationMethods || []).includes('generateContent'))
    .map((m) => ({ name: m.name.replace(/^models\//, ''), r: rank(m.name) })).filter((x) => x.r)
    .sort((x, y) => y.r[0] - x.r[0] || y.r[1] - x.r[1]).map((x) => x.name);
}
export const pickGeminiModel = (list) => rankGeminiModels(list)[0] ?? null;

let discovered = null;   // remembered for the life of the Worker instance

export function makeRunModel(env, fetchFn = fetch) {
  // Gemini API (the owner's own key, set as a Worker secret). Plain-JSON protocol, same checks as every other model.
  if (env.GEMINI_API_KEY) {
    const headers = { 'content-type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY };
    const synthetic = (status, st) => ({ ok: false, status, json: async () => ({ error: { status: st } }) });
    const post = (model, body) => fetchFn(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST', headers, body: JSON.stringify(body), signal: AbortSignal.timeout(15000),
    }).catch((e) => (e?.name === 'TimeoutError' || e?.name === 'AbortError' ? synthetic(524, 'TIMEOUT') : synthetic(599, 'NETWORK')));    // too slow counts like an overload
    const call = async (model, messages) => {
      const body = geminiBody(messages, MAX_OUTPUT_TOKENS, model);
      const r = await post(model, body);
      if (r.status === 400 && body.generationConfig.thinkingConfig) {   // this model rejects the thinking setting: try once without it
        delete body.generationConfig.thinkingConfig;
        return post(model, body);
      }
      return r;
    };
    const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
    const overloaded = (r) => [429, 500, 503, 504, 524, 599].includes(r.status);          // 429: that model's free quota is used up; others have their own
    const run = async ({ messages }) => {
      let model = env.GEMINI_MODEL || discovered || 'gemini-2.5-flash';
      let r = await call(model, messages);
      let ranked = null, last = model;
      const models = async () => (ranked ??= await fetchFn('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200', { headers, signal: AbortSignal.timeout(10000) })
        .then(async (l) => (l.ok ? rankGeminiModels(await l.json()) : [])).catch(() => []));
      if (r.status === 404 && !env.GEMINI_MODEL) {                      // the default name is gone: ask Google what this key can use
        const pick = (await models())[0];
        if (pick) { discovered = pick; model = pick; r = await call(pick, messages); }
      }
      if (overloaded(r) && r.status !== 524 && r.status !== 429) { await sleep(800); r = await call(model, messages); }  // one quick retry on the same model (not after a timeout)
      if (overloaded(r) && !env.GEMINI_MODEL) {                         // still busy: try the next-best models, once each
        for (const alt of (await models()).filter((m) => m !== model).slice(0, 2)) {
          last = alt; r = await call(alt, messages);
          if (!overloaded(r)) { if (r.ok) discovered = alt; break; }
        }
      }
      if (!r.ok) {                                                      // never include the key, the question or the body text in errors
        let st = ''; try { st = String((await r.json())?.error?.status || '').replace(/[^A-Z_]/g, '').slice(0, 30); } catch { /* no body */ }
        throw new Error(`gemini ${r.status}${st ? ' ' + st : ''} @${last}`);
      }
      return normaliseGemini(await r.json());
    };
    run.textProtocol = true;
    return run;
  }
  // Our own fine-tuned model: a LoRA adapter on an open base model, talking in the plain-JSON protocol (no native tools).
  if (env.ASK_LORA) {
    const base = env.ASK_BASE_MODEL || '@cf/mistral/mistral-7b-instruct-v0.2-lora';
    const run = async ({ messages }) => normalise(await env.AI.run(base, { messages: foldSystem(messages), max_tokens: MAX_OUTPUT_TOKENS, temperature: 0, lora: env.ASK_LORA }));
    run.textProtocol = true;
    return run;
  }
  return async function runModel({ messages }) {
    const res = await env.AI.run(MODEL, {
      messages, max_tokens: MAX_OUTPUT_TOKENS, temperature: 0,
      chat_template_kwargs: { enable_thinking: false },     // Gemma 4's thinking mode would eat the output budget before the answer
      tools: TOOL_SPECS.map((t) => ({ type: 'function', function: t })),
    });
    return normalise(res);
  };
}

/** True when Workers AI says the free daily allocation is used up (error 3036, HTTP 429) or capacity is out (3040). */
export const isAllowanceError = (e) => !/^gemini/.test(String(e?.message)) && /\b(3036|3040|429)\b|daily free allocation|out of capacity/i.test(String(e?.message || e));
