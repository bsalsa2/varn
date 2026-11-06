// Scores any model on the held-out evaluation set by running it through the real Worker pipeline (runAsk): the same prompt,
// tools, allowlist and answer checker as production. A model "passes" a case only if the pipeline accepts its answer
// AND it is the right behaviour (the right command, the right figure, a refusal when needed).
import { runAsk } from '../src/ask.js';

export function checkCase(c, res) {
  const e = c.expect;
  if (e.type === 'command') return res.type === 'command' && JSON.stringify(res.commands) === JSON.stringify(e.commands);
  if (res.type !== 'answer') return false;                                   // raw fallbacks and commands do not pass an answer case
  if (e.exact !== undefined) return res.text === e.exact;
  if (e.source && !(res.sources || []).includes(e.source)) return false;
  return (e.mustMention || []).every((s) => res.text.includes(s));
}

/** makeModel(case) -> runModel({messages}) ; facts = the Worker's bundled facts. */
export async function scoreModel({ cases, makeModel, facts }) {
  const byKind = {}; let pass = 0, raw = 0, plain = 0, calls = 0, neurons = 0;
  const failures = [];
  for (const c of cases) {
    let n = 0; const m = makeModel(c); const counted = Object.assign(async (a) => { n++; return m(a); }, { textProtocol: m.textProtocol });
    const r = await runAsk({ question: c.question, live: c.live, history: c.history, facts, runModel: counted });
    const res = r.response || { type: 'error' };
    const ok = !!r.response && checkCase(c, res);
    calls += n; neurons += r.neurons || 0;
    if (res.type === 'raw') raw++;
    if (res.type === 'answer' && /couldn't produce an answer/.test(res.text)) plain++;
    byKind[c.kind] = byKind[c.kind] || { pass: 0, total: 0 }; byKind[c.kind].total++;
    if (ok) { pass++; byKind[c.kind].pass++; } else failures.push({ id: c.id, kind: c.kind, question: c.question, got: res.type === 'command' ? res.commands : String(res.text || res.type).slice(0, 120) });
  }
  const total = cases.length;
  return { total, passRate: pass / total, rawRate: raw / total, noAnswerRate: plain / total, avgModelCalls: calls / total, estNeuronsPerQuestion: neurons / total, byKind, failures };
}

/** A model that replays the gold behaviour of each case. It must score 100%; that proves the test set and scorer are consistent. */
export const oracle = (c) => {
  const turns = c.gold.filter((m) => m.role === 'assistant'); let i = 0;
  const run = async () => {
    const t = turns[Math.min(i++, turns.length - 1)];
    return t.tool_calls ? { text: '', toolCalls: t.tool_calls.map((x) => ({ id: x.id, name: x.function.name, arguments: JSON.parse(x.function.arguments) })), usage: null }
      : { text: t.content, toolCalls: [], usage: null };
  };
  run.textProtocol = c.textProtocol === true;                    // gold written in the plain-JSON protocol replays as text
  return run;
};
