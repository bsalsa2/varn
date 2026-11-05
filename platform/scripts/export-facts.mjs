// Writes src/data/facts.json from src/data/records.json: one short sentence per fact, with its
// source section and test set. It prepares data for a later "Ask" panel; it calls no model and no network.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildFacts } from '../src/records/facts.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const data = JSON.parse(fs.readFileSync(path.join(root, 'src/data/records.json'), 'utf8'));
const facts = buildFacts(data);
fs.writeFileSync(path.join(root, 'src/data/facts.json'), JSON.stringify(facts, null, 2) + '\n');
console.log(`export-facts: wrote ${facts.length} facts to src/data/facts.json`);
