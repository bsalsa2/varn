// node training/score.mjs [--eval training/out/eval.json] [--model oracle|never]
// Offline reference runs. To score a real model, supply makeModel(case) -> async ({messages}) => ({ text, toolCalls, usage })
// (see training/README.md); the Kaggle notebook does this with the fine-tuned weights.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scoreModel, oracle } from './score.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const facts = JSON.parse(fs.readFileSync(path.join(here, '../../src/data/facts.json'), 'utf8'));
const cases = JSON.parse(fs.readFileSync(path.resolve(here, '..', arg('eval', 'training/out/eval.json')), 'utf8'));
const models = { oracle, never: () => async () => ({ text: 'I am not sure.', toolCalls: [], usage: null }) };
const m = models[arg('model', 'oracle')];
if (!m) { console.error('model must be oracle or never'); process.exit(1); }
const r = await scoreModel({ cases, makeModel: m, facts });
console.log(JSON.stringify({ ...r, failures: r.failures.slice(0, 5) }, null, 2));
