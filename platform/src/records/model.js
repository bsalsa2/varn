// Pure helpers behind the Records pages: routes, links, indexes and grouping.
// Nothing here touches React, the DOM or the network, so node:test can run it directly.

export const BASE = '#records';
const enc = encodeURIComponent;

export const href = {
  overview: () => BASE,
  results: (testSetId) => (testSetId ? `${BASE}/results/${enc(testSetId)}` : `${BASE}/results`),
  research: () => `${BASE}/research`,
  record: (id) => `${BASE}/research/${enc(id)}`,
  source: (section, line) => `${BASE}/source/${enc(section)}${line ? `/${line}` : ''}`,
};

export function parseRoute(hash) {
  const h = String(hash || '');
  if (h !== BASE && !h.startsWith(`${BASE}/`)) return { page: 'none' };
  const parts = h.slice(BASE.length).split('/').filter(Boolean).map((p) => { try { return decodeURIComponent(p); } catch { return p; } });
  const [a, b, c] = parts;
  if (!a) return { page: 'overview' };
  if (a === 'results') return parts.length <= 2 ? { page: 'results', testSetId: b || null } : { page: 'notfound' };
  if (a === 'research') return parts.length === 1 ? { page: 'research' } : parts.length === 2 ? { page: 'record', id: b } : { page: 'notfound' };
  if (a === 'source' && b && parts.length <= 3) {
    const line = c === undefined ? null : Number(c);
    return c !== undefined && !Number.isInteger(line) ? { page: 'notfound' } : { page: 'source', section: b, line };
  }
  return { page: 'notfound' };
}

export const isTestSet = (d) => String(d.kind).startsWith('test_set');

export function buildIndex(data) {
  const byId = new Map();
  for (const c of ['models', 'experiments', 'datasets', 'evaluations', 'gaps', 'notes']) for (const r of data[c]) byId.set(r.id, { ...r, collection: c });
  const get = (id) => byId.get(id) || null;
  const push = (m, k, v) => { if (!m.has(k)) m.set(k, []); m.get(k).push(v); };

  const evalsByTestSet = new Map(), evalsByModel = new Map(), evalsByExperiment = new Map();
  for (const e of data.evaluations) { push(evalsByTestSet, e.test_set_id, e); push(evalsByModel, e.model_id, e); push(evalsByExperiment, e.experiment_id, e); }

  const experimentsByModel = new Map(), experimentsByDataset = new Map(), experimentsByTestSet = new Map(), modelsByDataset = new Map(), childrenOf = new Map();
  for (const x of data.experiments) {
    x.model_ids.forEach((m) => push(experimentsByModel, m, x));
    x.dataset_ids.forEach((d) => push(experimentsByDataset, d, x));
    x.test_set_ids.forEach((t) => push(experimentsByTestSet, t, x));
  }
  for (const m of data.models) (m.trained_on || []).forEach((d) => push(modelsByDataset, d, m));
  for (const d of data.datasets) if (d.derived_from) push(childrenOf, d.derived_from, d);
  const citing = (section, line) => [...byId.values()].filter((r) => r.source === section && (line == null || r.source_line === line));

  const label = (modelId, variant) => {
    const m = get(modelId);
    const short = m ? m.id.replace(/^M-/, '') : modelId;
    return variant ? `${short} ${variant}` : short;
  };
  const counts = {
    models: data.models.length,
    experiments: data.experiments.length,
    datasets: data.datasets.filter((d) => d.kind === 'dataset').length,
    testSets: data.datasets.filter((d) => d.kind === 'test_set').length,
    testSetSlices: data.datasets.filter((d) => d.kind === 'test_set_slice').length,
    results: data.evaluations.length,
    testSetsWithResults: evalsByTestSet.size,
    gaps: data.gaps.length,
  };
  return { data, get, byId, evalsByTestSet, evalsByModel, evalsByExperiment, experimentsByModel, experimentsByDataset, experimentsByTestSet, modelsByDataset, childrenOf, citing, label, counts };
}

// Results are grouped by test set, then by the ledger section they came from, then by condition.
// Rows keep the ledger's order. They are never sorted by value and never ranked.
export function groupByTestSet(evals, idx) {
  const order = idx.data.datasets.filter(isTestSet).map((d) => d.id);
  const sets = new Map();
  for (const e of evals) { if (!sets.has(e.test_set_id)) sets.set(e.test_set_id, []); sets.get(e.test_set_id).push(e); }
  return [...sets.keys()].sort((a, b) => order.indexOf(a) - order.indexOf(b)).map((id) => ({ testSet: idx.get(id), tables: tablesFor(sets.get(id)) }));
}

function tablesFor(evals) {
  const bySource = new Map();
  for (const e of evals) { if (!bySource.has(e.source)) bySource.set(e.source, []); bySource.get(e.source).push(e); }
  return [...bySource.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([source, rows]) => {
    const conditions = [...new Set(rows.map((r) => r.condition || ''))];
    return { source, blocks: conditions.map((c) => ({ condition: c || null, rows: rows.filter((r) => (r.condition || '') === c) })) };
  });
}

// Models with no result on a test set. The ledger being silent is shown, never filled.
export function modelsWithoutResults(testSetId, idx) {
  const have = new Set((idx.evalsByTestSet.get(testSetId) || []).map((e) => e.model_id));
  return idx.data.models.filter((m) => !have.has(m.id));
}

// Latest by run number. The ledger has no per-result dates (only "Oct 2026"), so run order is the only order.
export function latestExperiment(idx) {
  const runs = idx.data.experiments.filter((x) => /^X-run\d+$/.test(x.id));
  return runs.sort((a, b) => Number(b.id.slice(5)) - Number(a.id.slice(5)))[0] || null;
}
