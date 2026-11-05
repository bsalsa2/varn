// The rules that keep Records honest. Pure functions: they take the records and the ledger text and
// return a list of problems. scripts/check-records.mjs runs them (and fails the build on any problem);
// rules.test.js proves each rule fires.
import { parseLedger, containsValue, numbersIn } from './ledger.js';

export const COLLECTIONS = ['models', 'experiments', 'datasets', 'evaluations'];
const ALL = [...COLLECTIONS, 'gaps', 'notes'];
const nonEmpty = (s) => typeof s === 'string' && s.trim() !== '';

export function checkRecords(data, ledgerText) {
  const problems = [];
  const bad = (rule, id, message) => problems.push({ rule, id, message });
  const L = parseLedger(ledgerText);

  // ---- shape, ids ----
  const byId = new Map();
  for (const c of ALL) {
    if (!Array.isArray(data[c])) { bad('shape', c, `"${c}" must be a list`); data = { ...data, [c]: [] }; }
    data[c].forEach((r, i) => {
      const id = r && r.id;
      if (!nonEmpty(id)) return bad('id', `${c}[${i}]`, 'record has no id');
      if (byId.has(id)) bad('id', id, `duplicate id "${id}"`);
      byId.set(id, { ...r, _c: c });
    });
  }

  for (const c of ALL) {
    for (const r of data[c]) {
      const id = r.id;
      if (!id) continue;
      const text = c === 'notes' ? r.text : r.summary;
      if (!nonEmpty(text)) bad('summary', id, 'missing plain-language summary');
      if (c !== 'notes' && !nonEmpty(r.title)) bad('title', id, 'missing title');

      // ---- 1. every record names its source, and the source exists ----
      if (!nonEmpty(r.source)) { bad('source', id, 'record has no source'); continue; }
      const sec = L.byId[r.source];
      if (!sec) { bad('source-unknown', id, `source "${r.source}" is not a section of the ledger`); continue; }
      if (!Number.isInteger(r.source_line)) bad('source-line', id, 'record has no source_line');
      else if (r.source_line < sec.first || r.source_line > sec.last) bad('source-line', id, `source_line ${r.source_line} is outside ${r.source} (lines ${sec.first}-${sec.last})`);

      // ---- 2. caveats ----
      if (COLLECTIONS.includes(c)) {
        if (!Array.isArray(r.caveats) || r.caveats.length === 0 || !r.caveats.every(nonEmpty)) bad('caveats', id, 'caveats must be a non-empty list of strings');
      }

      // ---- 3. every number in the words comes from the ledger text of the cited section(s) ----
      const sources = [r.source, ...(r.also_from || [])];
      const extra = sources.filter((s) => !L.byId[s]);
      if (extra.length) bad('source-unknown', id, `also_from names unknown section(s): ${extra.join(', ')}`);
      const pool = sources.map((s) => L.byId[s]?.text || '').join('\n');
      const prose = [r.title, r.summary, r.text, r.verdict, ...(r.caveats || []), ...(r.attributes || []).map((a) => a.value)].filter(Boolean);
      for (const t of prose) for (const n of numbersIn(t)) {
        if (!containsValue(pool, n)) bad('number', id, `number "${n}" in "${String(t).slice(0, 60)}" is not in the ledger text of ${sources.join('+')}`);
      }
      for (const a of r.attributes || []) {
        if (!nonEmpty(a.label) || !nonEmpty(a.value)) bad('attribute', id, 'attribute needs a label and a value');
        else if (!pool.includes(a.value)) bad('attribute', id, `attribute "${a.label}" value "${a.value}" is not in the ledger text of ${sources.join('+')}`);
      }
    }
  }

  // ---- evaluations ----
  const evalById = new Map(data.evaluations.filter((e) => e.id).map((e) => [e.id, e]));
  for (const e of data.evaluations) {
    const id = e.id; if (!id) continue;
    if (!nonEmpty(e.metric_name)) bad('metric', id, 'missing metric_name');
    if (!nonEmpty(e.value)) bad('value', id, 'missing value (store it as the string the ledger prints)');
    if (typeof e.value !== 'string') bad('value', id, 'value must be a string so its precision is kept');
    const sec = L.byId[e.source];
    if (sec && nonEmpty(e.value)) {
      // 4. the value must be in the ledger text under the cited section, and on the cited line
      if (!containsValue(sec.text, e.value)) bad('value-not-in-ledger', id, `value "${e.value}" does not appear in ${e.source}`);
      else {
        const line = L.line(e.source_line);
        if (line && !containsValue(line.text, e.value)) bad('value-not-on-line', id, `value "${e.value}" is not on ledger line ${e.source_line}`);
      }
      if (nonEmpty(e.metric_name) && !sec.text.includes(e.metric_name)) bad('metric-not-in-ledger', id, `metric_name "${e.metric_name}" does not appear in ${e.source}`);
      // S5 prints per-class figures as "drone 0.905", so the pair must be on the cited line
      const line = L.line(e.source_line);
      if (e.class && e.source === 'S5' && line && !line.text.includes(`${e.class} ${e.value}`)) bad('class-not-on-line', id, `"${e.class} ${e.value}" is not on ledger line ${e.source_line}`);
    }
    const model = byId.get(e.model_id), ts = byId.get(e.test_set_id), ex = byId.get(e.experiment_id);
    if (!model || model._c !== 'models') bad('ref', id, `model_id "${e.model_id}" is not a model`);
    if (!nonEmpty(e.test_set_id)) bad('test-set', id, 'evaluation has no test_set_id');
    else if (!ts || !String(ts.kind).startsWith('test_set')) bad('ref', id, `test_set_id "${e.test_set_id}" is not a test set`);
    if (!ex || ex._c !== 'experiments') bad('ref', id, `experiment_id "${e.experiment_id}" is not an experiment`);

    // 5. results are only comparable on the same test set (and the same metric and condition)
    for (const other of e.compared_with || []) {
      const o = evalById.get(other);
      if (!o) { bad('ref', id, `compared_with "${other}" does not exist`); continue; }
      if (o.id === e.id) bad('compare', id, 'an evaluation cannot be compared with itself');
      if (o.test_set_id !== e.test_set_id) bad('compare-test-set', id, `compared with ${o.id}, but test sets differ (${e.test_set_id} vs ${o.test_set_id})`);
      if (o.metric_name !== e.metric_name || (o.class || null) !== (e.class || null)) bad('compare-metric', id, `compared with ${o.id}, but the metric differs`);
      if ((o.condition || null) !== (e.condition || null)) bad('compare-condition', id, `compared with ${o.id}, but the condition differs`);
    }
  }

  // ---- links between records must point somewhere ----
  const need = (id, ref, kind) => {
    const t = byId.get(ref);
    if (!t) return bad('ref', id, `"${ref}" does not exist`);
    if (kind && !kind.includes(t._c)) bad('ref', id, `"${ref}" is a ${t._c} record, expected ${kind.join(' or ')}`);
  };
  for (const m of data.models) { if (m.derived_from) need(m.id, m.derived_from, ['models']); (m.trained_on || []).forEach((d) => need(m.id, d, ['datasets'])); }
  for (const x of data.experiments) {
    (x.model_ids || []).forEach((r) => need(x.id, r, ['models']));
    (x.dataset_ids || []).forEach((r) => need(x.id, r, ['datasets']));
    (x.test_set_ids || []).forEach((r) => need(x.id, r, ['datasets']));
    if (!x.test_set_ids || x.test_set_ids.length === 0) bad('ref', x.id, 'experiment names no test set');
  }
  for (const d of data.datasets) if (d.derived_from) need(d.id, d.derived_from, ['datasets']);
  for (const g of data.gaps) (g.links || []).forEach((r) => need(g.id, r, null));

  return problems;
}

export const format = (p) => `  [${p.rule}] ${p.id}: ${p.message}`;
