// Fails (exit 1) when Records could show something the ledger does not support.
// Run by `npm run check:records` and automatically before `npm run build`.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkRecords, format } from '../src/records/rules.js';
import { buildFacts } from '../src/records/facts.js';

// RECORDS_ROOT lets the tests point the script at a temporary copy of the files.
const root = process.env.RECORDS_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

const data = JSON.parse(read('src/data/records.json'));
const problems = checkRecords(data, read('evidence/ledger.md'));

// facts.json must be exactly what `npm run export:facts` would write from the current records
let facts = null;
try { facts = JSON.parse(read('src/data/facts.json')); } catch { problems.push({ rule: 'facts', id: 'facts.json', message: 'missing or unreadable; run `npm run export:facts`' }); }
if (facts && JSON.stringify(facts) !== JSON.stringify(buildFacts(data))) problems.push({ rule: 'facts', id: 'facts.json', message: 'out of date with records.json; run `npm run export:facts`' });

const total = ['models', 'experiments', 'datasets', 'evaluations', 'gaps', 'notes'].reduce((n, c) => n + data[c].length, 0);
if (problems.length) {
  console.error(`check-records: ${problems.length} problem(s) in ${total} records\n${problems.map(format).join('\n')}`);
  process.exit(1);
}
console.log(`check-records: ok (${total} records, ${facts.length} facts, every value found in the ledger)`);
