import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseRoute, href, buildIndex, groupByTestSet, modelsWithoutResults, latestExperiment } from './model.js';
import { parseLedger } from './ledger.js';

const read = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
const DATA = JSON.parse(read('../data/records.json'));
const idx = { ...buildIndex(DATA), ledger: parseLedger(read('../../evidence/ledger.md')) };

test('routes: parse and round-trip', () => {
  assert.deepEqual(parseRoute('#records'), { page: 'overview' });
  assert.deepEqual(parseRoute('#records/'), { page: 'overview' });
  assert.deepEqual(parseRoute('#records/results'), { page: 'results', testSetId: null });
  assert.deepEqual(parseRoute('#records/results/T-svan-897'), { page: 'results', testSetId: 'T-svan-897' });
  assert.deepEqual(parseRoute('#records/research'), { page: 'research' });
  assert.deepEqual(parseRoute('#records/research/M-run3'), { page: 'record', id: 'M-run3' });
  assert.deepEqual(parseRoute('#records/source/S5/34'), { page: 'source', section: 'S5', line: 34 });
  assert.deepEqual(parseRoute('#records/source/S5'), { page: 'source', section: 'S5', line: null });
  assert.equal(parseRoute('#records/nope').page, 'notfound');
  assert.equal(parseRoute('#records/source/S5/x').page, 'notfound');
  assert.equal(parseRoute('#sky').page, 'none');
  assert.equal(parseRoute('').page, 'none');
  assert.equal(parseRoute('#recordsX').page, 'none');
  for (const h of [href.overview(), href.results(), href.results('T-clips-42-military_drone'), href.research(), href.record('R-v3.pt-T-roboflow-800-mAP50'), href.source('S5', 34)]) assert.notEqual(parseRoute(h).page, 'notfound', h);
  assert.equal(parseRoute(href.record('R-v3.pt-T-roboflow-800-mAP50')).id, 'R-v3.pt-T-roboflow-800-mAP50');
});

test('counts are derived from the records', () => {
  const c = idx.counts;
  assert.equal(c.models, DATA.models.length);
  assert.equal(c.experiments, DATA.experiments.length);
  assert.equal(c.results, DATA.evaluations.length);
  assert.equal(c.datasets + c.testSets + c.testSetSlices, DATA.datasets.length);
  assert.equal(c.testSetsWithResults, new Set(DATA.evaluations.map((e) => e.test_set_id)).size);
});

test('results are grouped by test set and no group mixes test sets', () => {
  const groups = groupByTestSet(DATA.evaluations, idx);
  assert.equal(new Set(groups.map((g) => g.testSet.id)).size, groups.length);
  let rows = 0;
  for (const g of groups) for (const t of g.tables) for (const b of t.blocks) for (const r of b.rows) { rows++; assert.equal(r.test_set_id, g.testSet.id); }
  assert.equal(rows, DATA.evaluations.length);
  assert.ok(groups.find((g) => g.testSet.id === 'T-svan-1195') && groups.find((g) => g.testSet.id === 'T-svan-897'));
});

test('rows keep the ledger order and are never sorted by value', () => {
  const order = new Map(DATA.evaluations.map((e, i) => [e.id, i]));
  for (const g of groupByTestSet(DATA.evaluations, idx)) for (const t of g.tables) for (const b of t.blocks) {
    const seq = b.rows.map((r) => order.get(r.id));
    assert.deepEqual(seq, [...seq].sort((x, y) => x - y), `${g.testSet.id} ${t.source}`);
  }
  // 0.853 (v3 .pt) is listed before 0.831 (v3 ONNX) because the ledger lists it first, not because it is bigger
  const rf = groupByTestSet(DATA.evaluations, idx).find((g) => g.testSet.id === 'T-roboflow-800').tables[0].blocks[0].rows;
  assert.deepEqual(rf.slice(0, 2).map((r) => r.value), ['0.853', '0.905']);
});

test('the clip test set splits S6 and S7 into separate tables, and S7 by threshold', () => {
  const g = groupByTestSet(DATA.evaluations, idx).find((x) => x.testSet.id === 'T-clips-42');
  assert.deepEqual(g.tables.map((t) => t.source), ['S6', 'S7']);
  assert.deepEqual(g.tables[1].blocks.map((b) => b.condition), ['threshold 0.25', 'threshold 0.35', 'threshold 0.5', 'threshold 0.65', 'threshold 0.8']);
});

test('models with no result on a test set are reported, not filled', () => {
  assert.deepEqual(modelsWithoutResults('T-clips-42', idx).map((m) => m.id), ['M-run1', 'M-run2']);
  assert.ok(modelsWithoutResults('T-svan-897', idx).length > 0);
});

test('relations resolve in both directions', () => {
  assert.deepEqual(idx.experimentsByDataset.get('D-svanstrom').map((x) => x.id), ['X-run4', 'X-run5']);
  assert.ok(idx.modelsByDataset.get('D-svanstrom').some((m) => m.id === 'M-run4'));
  assert.ok(idx.evalsByExperiment.get('X-run5').every((e) => ['M-run5', 'M-v3'].includes(e.model_id)));
  assert.ok(idx.childrenOf.get('T-clips-42').length === 4);
});

test('latest experiment is chosen by run number (the ledger has no per-result dates)', () => {
  assert.equal(latestExperiment(idx).id, 'X-run5');
});
