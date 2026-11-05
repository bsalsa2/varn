import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { build, toTrainingRecord, isHeldOut, KINDS, P } from '../training/data.js';
import { scoreModel, oracle, checkCase } from '../training/score.js';
import { prepare } from '../src/ask.js';
import { validateCommands } from '../src/allowlist.js';
import { FACTS } from './helpers.js';

const RECORDS = JSON.parse(fs.readFileSync(new URL('../../src/data/records.json', import.meta.url), 'utf8'));
const mk = (o) => build({ facts: FACTS, records: RECORDS, ...o });

test('data: seeded and repeatable', () => {
  assert.deepEqual(mk({ n: 60, seed: 5 }), mk({ n: 60, seed: 5 }));
  assert.notDeepEqual(mk({ n: 60, seed: 5 }).map((e) => e.question), mk({ n: 60, seed: 6 }).map((e) => e.question));
});

test('data: every kind of behaviour is present, and no conversation is repeated', () => {
  const ex = mk({ n: 600, seed: 1 });
  assert.equal(ex.length, 600);
  for (const [k] of KINDS) assert.ok(ex.some((e) => e.kind === k), k);
  assert.equal(new Set(ex.map((e) => JSON.stringify([e.question, e.live, e.history]))).size, ex.length);
});

test('data: each conversation is well formed and uses the production prompt', () => {
  for (const e of mk({ n: 300, seed: 2 })) {
    assert.equal(e.messages[0].role, 'system');
    const p = prepare({ question: e.question, live: e.live, facts: FACTS, history: e.history });
    assert.equal(e.messages[0].content, p.messages[0].content, `${e.id}: prompt differs from production`);
    const calls = e.messages.filter((m) => m.tool_calls).map((m) => m.tool_calls[0].id), results = e.messages.filter((m) => m.role === 'tool').map((m) => m.tool_call_id);
    for (const id of results) assert.ok(calls.includes(id), `${e.id}: tool result without a call`);
    const last = e.messages.at(-1);
    if (last.tool_calls) { const a = JSON.parse(last.tool_calls[0].function.arguments); assert.equal(last.tool_calls[0].function.name, 'propose_command'); assert.equal(validateCommands(a.commands).ok, true); assert.ok(a.say); }
    else { const j = JSON.parse(last.content); assert.equal(j.type, 'answer'); assert.ok(Array.isArray(j.sources)); }
    const rec = toTrainingRecord(e); assert.equal(rec.tools.length, 6); assert.ok(rec.tools.every((t) => t.type === 'function'));
  }
});

test('data: the evaluation set shares no question, paraphrase, place or fact with training', () => {
  const tr = mk({ n: 1500, seed: 1 }), ev = mk({ n: 120, seed: 777, heldOut: true });
  const trainQ = new Set(tr.map((e) => e.question));
  assert.deepEqual(ev.filter((e) => trainQ.has(e.question)).map((e) => e.question), []);
  for (const k of Object.keys(P)) assert.ok(P[k].length >= 4, k);                 // 2 paraphrases are held out of each list
  for (const e of tr.filter((x) => x.kind === 'fact')) assert.equal(isHeldOut(e.expect.source), false, 'a held-out fact leaked into training');
  for (const e of ev.filter((x) => x.kind === 'fact')) assert.equal(isHeldOut(e.expect.source), true);
  const places = (xs) => new Set(xs.filter((e) => e.expect.commands?.[0]?.startsWith('fly ')).map((e) => e.expect.commands[0]));
  for (const p of places(ev)) assert.ok(!places(tr).has(p), `place ${p} in both`);
});

test('score: the oracle (gold behaviour) passes every case, so the test set and scorer agree', async () => {
  const ev = mk({ n: 120, seed: 777, heldOut: true });
  const cases = ev.map((e) => ({ id: e.id, kind: e.kind, question: e.question, live: e.live, history: e.history, expect: e.expect, gold: e.messages.slice(e.messages.findLastIndex((m) => m.role === 'user') + 1) }));
  const r = await scoreModel({ cases, makeModel: oracle, facts: FACTS });
  assert.deepEqual(r.failures, []);
  assert.equal(r.passRate, 1); assert.equal(r.rawRate, 0);
  assert.ok(Object.keys(r.byKind).length >= 7);
});

test('score: a model that never answers properly scores near zero; wrong commands and figures fail', async () => {
  const ev = mk({ n: 60, seed: 777, heldOut: true });
  const cases = ev.map((e) => ({ id: e.id, kind: e.kind, question: e.question, live: e.live, history: e.history, expect: e.expect, gold: [] }));
  const r = await scoreModel({ cases, makeModel: () => async () => ({ text: 'I am not sure.', toolCalls: [], usage: null }), facts: FACTS });
  assert.ok(r.passRate < 0.15, String(r.passRate));                               // only the refusals (screened before the model) can pass
  assert.equal(checkCase({ expect: { type: 'command', commands: ['quakes day', 'go 1'] } }, { type: 'command', commands: ['quakes day'] }), false);
  assert.equal(checkCase({ expect: { type: 'answer', mustMention: ['27'] } }, { type: 'answer', text: 'There are 26.', sources: [] }), false);
  assert.equal(checkCase({ expect: { type: 'answer', mustMention: ['27'] } }, { type: 'raw', text: '27' }), false);
  assert.equal(checkCase({ expect: { type: 'answer', exact: "I don't have that." } }, { type: 'answer', text: "I don't have that." }), true);
});
