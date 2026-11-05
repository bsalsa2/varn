import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { checkRecords } from './rules.js';
import { containsValue, numbersIn, parseLedger } from './ledger.js';
import { buildFacts } from './facts.js';

const read = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
const LEDGER = read('../../evidence/ledger.md');
const DATA = JSON.parse(read('../data/records.json'));
const clone = () => structuredClone(DATA);
const rules = (d) => checkRecords(d, LEDGER).map((p) => p.rule);
const ev = (d, id) => d.evaluations.find((e) => e.id === id);

test('the shipped records pass every rule', () => {
  assert.deepEqual(checkRecords(DATA, LEDGER), []);
});

test('ledger: sections S1 to S9 are found with line numbers', () => {
  const L = parseLedger(LEDGER);
  assert.deepEqual(L.sections.map((s) => s.id), ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'S9']);
  assert.match(L.line(34).text, /^\* v3 \.pt on T-roboflow-800: 0\.853/);
  assert.equal(L.sectionOfLine(34).id, 'S5');
});

test('containsValue matches whole numbers only', () => {
  assert.equal(containsValue('mAP50 0.853 (drone', '0.853'), true);
  assert.equal(containsValue('x 0.85 y', '0.8'), false);
  assert.equal(containsValue('x 10.8% y', '0.8%'), false);
  assert.equal(containsValue('0.800)', '0.800'), true);
  assert.equal(containsValue('3,006,038 parameters', '3,006,038'), true);
  assert.equal(containsValue('', ''), false);
});

test('numbersIn ignores ids but finds real numbers', () => {
  assert.deepEqual(numbersIn('T-svan-897 and run5 and S5 and M-v3'), []);
  assert.deepEqual(numbersIn('1,195 frames, 63.9% and -0.022'), ['1,195', '63.9%', '0.022']);
});

test('rule: a record without a source fails', () => {
  const d = clone(); delete d.models[0].source;
  assert.ok(rules(d).includes('source'));
  const e = clone(); delete e.evaluations[3].source;
  assert.ok(rules(e).includes('source'));
});

test('rule: a source id that is not in the ledger fails', () => {
  const d = clone(); d.datasets[0].source = 'S42';
  assert.ok(rules(d).includes('source-unknown'));
  const e = clone(); e.models[0].also_from = ['S77'];
  assert.ok(rules(e).includes('source-unknown'));
});

test('rule: a source line outside the cited section fails', () => {
  const d = clone(); d.models[0].source_line = 70;
  assert.ok(rules(d).includes('source-line'));
  const e = clone(); delete e.models[0].source_line;
  assert.ok(rules(e).includes('source-line'));
});

test('rule: caveats may never be empty for any record, evaluations included', () => {
  for (const c of ['models', 'experiments', 'datasets', 'evaluations']) {
    const d = clone(); d[c][0].caveats = [];
    assert.ok(rules(d).includes('caveats'), `${c}: empty list`);
    const e = clone(); delete e[c][0].caveats;
    assert.ok(rules(e).includes('caveats'), `${c}: missing`);
    const f = clone(); f[c][0].caveats = ['  '];
    assert.ok(rules(f).includes('caveats'), `${c}: blank string`);
  }
});

test('rule: an evaluation value that is not in its ledger section fails', () => {
  const d = clone(); ev(d, 'R-v3.pt-T-roboflow-800-mAP50').value = '0.999';
  assert.ok(rules(d).includes('value-not-in-ledger'));
});

test('rule: a value from the right section but a different line fails', () => {
  const d = clone(); const e = ev(d, 'R-v3.pt-T-roboflow-800-mAP50'); e.value = '0.255'; // real figure, but from the bird-vs-drone line
  const r = rules(d);
  assert.ok(r.includes('value-not-on-line') && !r.includes('value-not-in-ledger'));
});

test('rule: values keep their original precision as strings', () => {
  assert.equal(ev(DATA, 'R-v3.pt-T-roboflow-800-mAP50-aircraft').value, '0.800');
  assert.equal(ev(DATA, 'R-run3-T-clips-42-rough-score-threshold-0.8').value, '+0.006');
  const d = clone(); ev(d, 'R-v3.pt-T-roboflow-800-mAP50-aircraft').value = 0.8;
  assert.ok(rules(d).includes('value'));
  const e = clone(); ev(e, 'R-v3.pt-T-roboflow-800-mAP50-aircraft').value = '0.8'; // rounded: "0.8" is not the ledger's "0.800"
  assert.ok(rules(e).length > 0);
});

test('rule: metric_name must be the ledger\'s own words', () => {
  const d = clone(); ev(d, 'R-v3.pt-T-roboflow-800-mAP50').metric_name = 'accuracy';
  assert.ok(rules(d).includes('metric-not-in-ledger'));
});

test('rule: per-class figures must sit on the cited line with their class', () => {
  const d = clone(); ev(d, 'R-v3.pt-T-roboflow-800-mAP50-drone').class = 'aircraft';
  assert.ok(rules(d).includes('class-not-on-line'));
});

test('rule: compared values must share a test set', () => {
  // the two Svanstrom held-out sets have different frame counts, so they are different test sets
  const d = clone();
  d.evaluations.find((e) => e.id === 'R-run5-T-svan-897-mAP50').compared_with = ['R-run4-T-svan-1195-mAP50'];
  const found = checkRecords(d, LEDGER).find((p) => p.rule === 'compare-test-set');
  assert.ok(found, 'T-svan-897 vs T-svan-1195 must be rejected');
  assert.match(found.message, /T-svan-897.*T-svan-1195/);
});

test('rule: compared values must also share metric and condition', () => {
  const d = clone();
  ev(d, 'R-run3-T-clips-42-found-aircraft-threshold-0.8').compared_with = ['R-v3-T-clips-42-found-aircraft-threshold-0.5'];
  assert.ok(rules(d).includes('compare-condition'));
  const e = clone();
  ev(e, 'R-run3-T-clips-42-found-aircraft-threshold-0.8').compared_with = ['R-v3-T-clips-42-found-drone-threshold-0.8'];
  assert.ok(rules(e).includes('compare-metric'));
});

test('rule: every pair the data declares really is on one test set', () => {
  const byId = new Map(DATA.evaluations.map((e) => [e.id, e]));
  let pairs = 0;
  for (const e of DATA.evaluations) for (const o of e.compared_with) { pairs++; assert.equal(byId.get(o).test_set_id, e.test_set_id, e.id); }
  assert.ok(pairs > 40);
});

test('rule: a number that is not in the ledger text of the cited section fails', () => {
  const d = clone(); d.models[1].summary += ' It reached 0.91 on an internal set.';
  assert.ok(rules(d).includes('number'));
  const e = clone(); e.datasets[0].attributes[0].value = '9,999';
  assert.ok(rules(e).includes('attribute'));
});

test('rule: links between records must resolve', () => {
  const d = clone(); d.evaluations[0].model_id = 'M-ghost';
  assert.ok(rules(d).includes('ref'));
  const e = clone(); e.experiments[0].test_set_ids = ['T-ghost'];
  assert.ok(rules(e).includes('ref'));
  const f = clone(); f.evaluations[0].test_set_id = 'D-roboflow'; // a dataset is not a test set
  assert.ok(rules(f).includes('ref'));
});

test('rule: ids are unique and summaries are present', () => {
  const d = clone(); d.models[1].id = d.models[0].id;
  assert.ok(rules(d).includes('id'));
  const e = clone(); e.experiments[0].summary = '';
  assert.ok(rules(e).includes('summary'));
});

test('data: four collections, evaluations carry the required fields', () => {
  for (const c of ['models', 'experiments', 'datasets', 'evaluations']) assert.ok(DATA[c].length > 0, c);
  for (const e of DATA.evaluations) {
    for (const k of ['id', 'title', 'summary', 'source', 'caveats', 'model_id', 'test_set_id', 'metric_name', 'value']) assert.ok(e[k] !== undefined && e[k] !== '', `${e.id}.${k}`);
    assert.ok(e.caveats.length > 0, e.id);
  }
});

test('data: the two Svanstrom held-out sets stay separate test sets', () => {
  const a = DATA.datasets.find((d) => d.id === 'T-svan-1195'), b = DATA.datasets.find((d) => d.id === 'T-svan-897');
  assert.ok(a && b && a.id !== b.id);
  assert.match(a.summary, /1,195/); assert.match(b.summary, /897/);
  assert.ok(DATA.evaluations.some((e) => e.test_set_id === 'T-svan-1195') && DATA.evaluations.some((e) => e.test_set_id === 'T-svan-897'));
});

test('data: nothing the ledger calls unverified is stated as fact', () => {
  const g = DATA.gaps.find((x) => x.id === 'G-hypothesis');
  assert.equal(g.kind, 'unverified');
  assert.match(g.summary, /NOT verified/);
});

test('facts: one short sentence each, with id, source and test set; file matches the records', () => {
  const facts = buildFacts(DATA);
  const onDisk = JSON.parse(read('../data/facts.json'));
  assert.deepEqual(onDisk, facts, 'run `npm run export:facts`');
  assert.equal(new Set(facts.map((f) => f.id)).size, facts.length);
  const L = parseLedger(LEDGER);
  for (const f of facts) {
    assert.ok(f.id && f.text && f.source && 'test_set_id' in f, f.id);
    assert.ok(L.byId[f.source], f.id);
    assert.ok(f.text.length <= 260, `${f.id} is too long`);
    assert.equal((f.text.match(/\.(\s|$)/g) || []).length <= 2, true, `${f.id} should be one sentence`);
  }
  for (const e of DATA.evaluations) assert.equal(facts.find((f) => f.id === `F-${e.id}`).test_set_id, e.test_set_id);
});

// ---- the real script, run against a temporary copy of the files ----
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';

const SCRIPT = new URL('../../scripts/check-records.mjs', import.meta.url).pathname;
function runCheck(edit) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'records-check-'));
  fs.mkdirSync(path.join(dir, 'evidence')); fs.mkdirSync(path.join(dir, 'src/data'), { recursive: true });
  const files = { 'evidence/ledger.md': LEDGER, 'src/data/records.json': JSON.stringify(DATA), 'src/data/facts.json': read('../data/facts.json') };
  edit?.(files);
  for (const [f, body] of Object.entries(files)) fs.writeFileSync(path.join(dir, f), body);
  const r = spawnSync(process.execPath, [SCRIPT], { env: { ...process.env, RECORDS_ROOT: dir }, encoding: 'utf8' });
  fs.rmSync(dir, { recursive: true, force: true });
  return r;
}

test('check-records script: passes on the shipped files', () => {
  const r = runCheck();
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /check-records: ok/);
});

test('check-records script: exits 1 when a value is not in the ledger', () => {
  const r = runCheck((f) => { const d = JSON.parse(f['src/data/records.json']); d.evaluations[0].value = '0.999'; f['src/data/records.json'] = JSON.stringify(d); });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /value-not-in-ledger/);
});

test('check-records script: exits 1 when a record loses its caveats', () => {
  const r = runCheck((f) => { const d = JSON.parse(f['src/data/records.json']); d.evaluations[5].caveats = []; f['src/data/records.json'] = JSON.stringify(d); });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /\[caveats\]/);
});

test('check-records script: exits 1 when the ledger changes under the records', () => {
  const r = runCheck((f) => { f['evidence/ledger.md'] = f['evidence/ledger.md'].replace('0.853 (drone', '0.854 (drone'); });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /value-not-in-ledger|value-not-on-line/);
});

test('check-records script: exits 1 when facts.json is stale', () => {
  const r = runCheck((f) => { const x = JSON.parse(f['src/data/facts.json']); x[0].text = 'edited by hand'; f['src/data/facts.json'] = JSON.stringify(x, null, 2) + '\n'; });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /\[facts\]/);
});
