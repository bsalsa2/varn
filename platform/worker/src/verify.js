// Checks on a model's final answer. If any check fails the caller returns the raw tool results instead of the answer.
import { numbersIn } from '../../src/records/ledger.js';

export const NO_DATA = "I don't have that.";
const WORDS = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, hundred: 100, thousand: 1000, million: 1e6 };
const num = (s) => Number(String(s).replace(/[,%]/g, ''));

/** Every number that may appear in an answer: those in tool outputs, in the facts shown to the model, and in the question. */
export function allowedNumbers(...sources) {
  const set = new Set();
  for (const src of sources) {
    const text = typeof src === 'string' ? src : JSON.stringify(src);
    for (const n of numbersIn(text)) set.add(num(n));
    for (const w of text.toLowerCase().match(/\b[a-z]+\b/g) || []) if (w in WORDS) set.add(WORDS[w]);      // a source that says "Three" allows "three" and 3
  }
  return set;
}
const decimals = (x) => (String(x).split('.')[1] || '').length;
/** True when n is a source number, or that number rounded to fewer decimals (1234.6 may be written 1235; 6.14 may be written 6.1). */
export function matchesSource(n, a) {
  if (Math.abs(a - n) < 1e-9) return true;
  for (let k = 0; k < decimals(a); k++) if (Math.abs(Number(a.toFixed(k)) - n) < 1e-9) return true;
  return false;
}
export function numbersInAnswer(text) {
  const out = numbersIn(text).map(num);
  for (const w of String(text).toLowerCase().match(/\b[a-z]+\b/g) || []) if (w in WORDS) out.push(WORDS[w]);
  return out;
}

/** Reads the model's JSON even when it adds a sentence around it or wraps it in a code fence. */
export function parseFinal(text) {
  if (typeof text !== 'string') return null;
  const t = text.trim().replace(/^```(?:json)?\s*|\s*```$/g, '');
  const tryParse = (x) => { try { const j = JSON.parse(x); return j && typeof j === 'object' && !Array.isArray(j) ? j : null; } catch { return null; } };
  const whole = tryParse(t);
  if (whole) return whole;
  for (let start = t.indexOf('{'); start !== -1 && start < t.length; start = t.indexOf('{', start + 1)) {      // first balanced {...} that parses
    let depth = 0, inStr = false, esc = false;
    for (let i = start; i < t.length; i++) {
      const ch = t[i];
      if (inStr) { if (esc) esc = false; else if (ch === '\\') esc = true; else if (ch === '"') inStr = false; continue; }
      if (ch === '"') inStr = true; else if (ch === '{') depth++; else if (ch === '}' && --depth === 0) { const j = tryParse(t.slice(start, i + 1)); if (j && typeof j.type === 'string') return j; break; }
    }
  }
  return null;
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
  for (const n of numbersInAnswer(text)) if (![...ctx.allowed].some((a) => matchesSource(n, a))) return bad(`number ${n} is not in the tool results or facts`);
  if (ctx.simLabelled && !/\bSIM\b/.test(text)) return bad('simulated tracks must be labelled SIM');
  return { ok: true, answer: { type: 'answer', text, sources: [...new Set(answer.sources)] } };
}
