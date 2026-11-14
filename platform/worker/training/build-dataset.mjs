// node training/build-dataset.mjs [--n 4000] [--seed 1] [--out training/out]
// Writes train.jsonl (chat records for fine-tuning) and eval.json (the fixed test set, held-out paraphrases/places/facts).
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { build, toTrainingRecord, goldOf } from './data.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const facts = JSON.parse(fs.readFileSync(path.join(here, '../../src/data/facts.json'), 'utf8'));
const records = JSON.parse(fs.readFileSync(path.join(here, '../../src/data/records.json'), 'utf8'));
const out = path.resolve(here, '..', arg('out', 'training/out'));
fs.mkdirSync(out, { recursive: true });

const n = Number(arg('n', 4000)), seed = Number(arg('seed', 1));
const train = build({ n, seed, facts, records });
fs.writeFileSync(path.join(out, 'train.jsonl'), train.map((e) => JSON.stringify(toTrainingRecord(e))).join('\n') + '\n');
const evalSet = build({ n: 120, seed: 777, facts, records, heldOut: true });
fs.writeFileSync(path.join(out, 'eval.json'), JSON.stringify(evalSet.map((e) => ({ id: e.id, kind: e.kind, question: e.question, live: e.live, history: e.history, expect: e.expect, textProtocol: e.textProtocol, prompt: e.messages.slice(0, 2 + (e.history?.length || 0)), gold: goldOf(e) })), null, 1));
if (process.argv.includes('--gz')) {                       // the committed copy the Kaggle notebook downloads
  const data = path.join(here, 'data'); fs.mkdirSync(data, { recursive: true });
  const gz = (f) => zlib.gzipSync(fs.readFileSync(path.join(out, f)), { level: 9, mtime: 0 });
  fs.writeFileSync(path.join(data, 'train.jsonl.gz'), gz('train.jsonl')); fs.writeFileSync(path.join(data, 'eval.json.gz'), gz('eval.json'));
}
const count = (xs) => xs.reduce((a, e) => ({ ...a, [e.kind]: (a[e.kind] || 0) + 1 }), {});
console.log(`train: ${train.length} examples`, count(train));
console.log(`eval:  ${evalSet.length} cases (held out)`, count(evalSet));
console.log(`wrote ${out}`);
