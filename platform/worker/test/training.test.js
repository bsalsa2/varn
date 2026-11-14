import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { build, toTrainingRecord, isHeldOut, KINDS, P, goldOf } from '../training/data.js';
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
    const p = prepare({ question: e.question, live: e.live, facts: FACTS, history: e.history, text: true });
    assert.equal(e.messages[0].content, p.messages[0].content, `${e.id}: prompt differs from production`);
    // plain-JSON protocol: roles strictly alternate after the system message, and every assistant turn is one JSON object
    const roles = e.messages.slice(1).map((m) => m.role);
    roles.forEach((r, i) => assert.equal(r, i % 2 === 0 ? 'user' : 'assistant', `${e.id}: roles do not alternate`));
    for (const m of goldOf(e).filter((x) => x.role === 'assistant')) assert.ok(JSON.parse(m.content).type, `${e.id}: assistant turn is not JSON`);   // earlier history turns are plain text
    const last = JSON.parse(e.messages.at(-1).content);
    if (last.type === 'tool_call') { assert.equal(last.name, 'propose_command'); assert.equal(validateCommands(last.arguments.commands).ok, true); assert.ok(last.arguments.say); }
    else { assert.equal(last.type, 'answer'); assert.ok(Array.isArray(last.sources)); }
    for (const m of e.messages.filter((x) => x.role === 'user' && /^TOOL RESULT /.test(x.content))) assert.match(m.content, /^TOOL RESULT (get_|search_)\w+: \{/);
    const rec = toTrainingRecord(e); assert.equal(rec.tools, undefined); assert.equal(rec.messages, e.messages);
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

for (const textProtocol of [true, false]) test(`score: the oracle (gold behaviour) passes every case, so the test set and scorer agree (${textProtocol ? 'plain-JSON' : 'native-tool'} protocol)`, async () => {
  const ev = mk({ n: 120, seed: 777, heldOut: true, textProtocol });
  const cases = ev.map((e) => ({ id: e.id, kind: e.kind, question: e.question, live: e.live, history: e.history, expect: e.expect, textProtocol: e.textProtocol, gold: goldOf(e) }));
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

test('protocol: a model that asks for tools in plain JSON works end to end, and the native format is unchanged', async () => {
  const { runAsk } = await import('../src/ask.js');
  const { LIVE } = await import('./helpers.js');
  const seq = [{ type: 'tool_call', name: 'get_quake_summary', arguments: {} }, { type: 'answer', text: 'There are 5 earthquakes loaded for the day.', sources: ['get_quake_summary'] }];
  let i = 0; const seen = [];
  const model = Object.assign(async ({ messages }) => { seen.push(messages.map((m) => m.role).join(',')); return { text: JSON.stringify(seq[i++]), toolCalls: [], usage: null }; }, { textProtocol: true });
  const r = await runAsk({ question: 'how many quakes are there', live: LIVE, facts: FACTS, runModel: model });
  assert.equal(r.response.type, 'answer'); assert.deepEqual(seen, ['system,user', 'system,user,assistant,user']);
  const cmd = Object.assign(async () => ({ text: JSON.stringify({ type: 'tool_call', name: 'propose_command', arguments: { commands: ['quakes day', 'go 1'], say: 'Go.' } }), toolCalls: [], usage: null }), { textProtocol: true });
  const c = await runAsk({ question: 'zoom to the strongest earthquake', live: LIVE, facts: FACTS, runModel: cmd });
  assert.deepEqual(c.response.commands, ['quakes day', 'go 1']);
  const bad = Object.assign(async () => ({ text: JSON.stringify({ type: 'tool_call', name: 'propose_command', arguments: { commands: ['watch quakes'], say: 'x' } }), toolCalls: [], usage: null }), { textProtocol: true });
  assert.notEqual((await runAsk({ question: 'watch', live: LIVE, facts: FACTS, runModel: bad })).response.type, 'command');
});

test('protocol: the custom-model path uses the LoRA, folds the system text into the first user message, and needs no tools', async () => {
  const { makeRunModel, foldSystem } = await import('../src/model.js');
  let seen; const env = { ASK_LORA: 'varn-ask-v1', AI: { run: async (model, args) => { seen = { model, args }; return { response: '{"type":"answer","text":"I don\'t have that.","sources":[]}' }; } } };
  const run = makeRunModel(env);
  assert.equal(run.textProtocol, true);
  await run({ messages: [{ role: 'system', content: 'RULES' }, { role: 'user', content: 'hi' }] });
  assert.equal(seen.model, '@cf/mistral/mistral-7b-instruct-v0.2-lora'); assert.equal(seen.args.lora, 'varn-ask-v1');
  assert.deepEqual(seen.args.messages, [{ role: 'user', content: 'RULES\n\nhi' }]); assert.equal(seen.args.tools, undefined);
  assert.deepEqual(foldSystem([{ role: 'user', content: 'a' }]), [{ role: 'user', content: 'a' }]);
  assert.equal(makeRunModel({ AI: { run() {} } }).textProtocol, undefined);          // without ASK_LORA the Gemma path is unchanged
});

test('protocol: chat history is made to alternate and to start with a user message', async () => {
  const { alternate } = await import('../src/ask.js');
  const h = (...r) => r.map((x, i) => ({ role: x, content: String(i) }));
  assert.deepEqual(alternate(h('assistant', 'user', 'assistant')).map((m) => m.role), ['user', 'assistant']);
  assert.deepEqual(alternate(h('user', 'user', 'assistant')).map((m) => m.role), ['user', 'assistant']);
  assert.deepEqual(alternate(h('user')), []);
  assert.deepEqual(alternate([]), []);
});

// ---- Kaggle notebook + committed data ----
import zlib from 'node:zlib';
import { spawnSync } from 'node:child_process';
import { notebook } from '../training/make-notebook.mjs';

test('notebook is valid and its code cells compile as Python', () => {
  assert.equal(notebook.nbformat, 4);
  const code = notebook.cells.filter((c) => c.cell_type === 'code').map((c) => c.source.join(''));
  assert.ok(code.length >= 6);
  const py = spawnSync('python3', ['-I', '-c', 'import sys\nfor i,s in enumerate(__import__("json").load(sys.stdin)): compile(s, "cell%d" % i, "exec")'], { input: JSON.stringify(code), encoding: 'utf8' });
  assert.equal(py.status, 0, py.stderr);
});

test('notebook holds no secrets and never touches the detector', () => {
  const all = JSON.stringify(notebook);
  assert.ok(!/hf_[A-Za-z0-9]{10,}|api[_-]?key\s*=\s*["']\w/i.test(all));
  assert.ok(!/yolo|ultralytics/i.test(all));
});

test('committed notebook and gzipped data match a fresh build', () => {
  const here = new URL('../training/', import.meta.url);
  const nb = JSON.parse(fs.readFileSync(new URL('kaggle/ask_lora.ipynb', here), 'utf8'));
  assert.deepEqual(nb, JSON.parse(JSON.stringify(notebook)));
  const rows = zlib.gunzipSync(fs.readFileSync(new URL('data/train.jsonl.gz', here))).toString().trim().split('\n').map((l) => JSON.parse(l));
  assert.ok(rows.length >= 3000);
  assert.ok(rows.every((r) => Number.isInteger(r.trainFrom) && r.trainFrom >= 2 && r.messages[r.trainFrom]?.role === 'assistant' && !r.tools));
  const ev = JSON.parse(zlib.gunzipSync(fs.readFileSync(new URL('data/eval.json.gz', here))).toString());
  assert.ok(ev.length > 50 && ev.every((c) => c.prompt && c.gold && c.textProtocol));
});
