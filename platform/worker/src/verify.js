// Checks on a model's final answer. If any check fails the caller returns the raw tool results instead of the answer.
import { numbersIn } from '../../src/records/ledger.js';

export const NO_DATA = "I don't have that.";
const WORDS = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, hundred: 100, thousand: 1000, million: 1e6 };
const num = (s) => Number(String(s).replace(/[,%]/g, ''));

/** Every number that may appear in an answer: those in tool outputs, in the facts shown to the model, and in the question. */
export function allowedNumbers(...sources) {
  const set = new Set();
  for (const src of sources) for (const n of numbersIn(typeof src === 'string' ? src : JSON.stringify(src))) set.add(num(n));
  return set;
}
export function numbersInAnswer(text) {
  const out = numbersIn(text).map(num);
  for (const w of String(text).toLowerCase().match(/\b[a-z]+\b/g) || []) if (w in WORDS) out.push(WORDS[w]);
  return out;
}

export function parseFinal(text) {
  if (typeof text !== 'string') return null;
  const m = text.trim().replace(/^```(?:json)?\s*|\s*```$/g, '');
  try { const j = JSON.parse(m); return j && typeof j === 'object' && !Array.isArray(j) ? j : null; } catch { return null; }
}

/**
 * answer: parsed model JSON. ctx: { factIds:Set, toolsUsed:Set, allowed:Set, simLabelled:boolean }
 * -> { ok: true, answer } or { ok: false, reason }
 */
export function verifyAnswer(answer, ctx) {
  const bad = (reason) => ({ ok: false, reason });
  if (!answer || answer.type !== 'answer') return bad('not an answer');
  if (Object.keys(answer).some((k) => !['type', 'text', 'sources'].includes(k))) return bad('unexpected field');
  if (typeof answer.text !== 'string' || !answer.text.trim() || answer.text.length > 700) return bad('bad text');
  if (!Array.isArray(answer.sources) || answer.sources.length > 8 || !answer.sources.every((s) => typeof s === 'string')) return bad('bad sources');
  if (/https?:\/\/|www\./i.test(answer.text)) return bad('links are not allowed');
  const text = answer.text.trim();
  if (text === NO_DATA) return { ok: true, answer: { type: 'answer', text, sources: [] } };
  if (answer.sources.length === 0) return bad('no sources cited');
  for (const s of answer.sources) if (!ctx.factIds.has(s) && !ctx.toolsUsed.has(s)) return bad(`unknown source "${s}"`);
  for (const n of numbersInAnswer(text)) if (![...ctx.allowed].some((a) => Math.abs(a - n) < 1e-9)) return bad(`number ${n} is not in the tool results or facts`);
  if (ctx.simLabelled && !/\bSIM\b/.test(text)) return bad('simulated tracks must be labelled SIM');
  return { ok: true, answer: { type: 'answer', text, sources: [...new Set(answer.sources)] } };
}
