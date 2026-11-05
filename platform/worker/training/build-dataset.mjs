// node training/build-dataset.mjs [--n 4000] [--seed 1] [--out training/out]
// Writes train.jsonl (chat records for fine-tuning) and eval.json (the fixed test set, held-out paraphrases/places/facts).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build, toTrainingRecord } from './data.js';

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
fs.writeFileSync(path.join(out, 'eval.json'), JSON.stringify(evalSet.map(({ id, kind, question, live, history, expect, messages }) => ({ id, kind, question, live, history, expect, gold: messages.slice(messages.findLastIndex((m) => m.role === 'user') + 1) })), null, 1));
const count = (xs) => xs.reduce((a, e) => ({ ...a, [e.kind]: (a[e.kind] || 0) + 1 }), {});
console.log(`train: ${train.length} examples`, count(train));
console.log(`eval:  ${evalSet.length} cases (held out)`, count(evalSet));
console.log(`wrote ${out}`);
