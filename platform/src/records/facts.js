// Turns records into short, citable facts for a later "Ask" panel. This only prepares data:
// nothing here calls a model or the network. One sentence per fact; every fact carries its source
// and the test set it belongs to (null when it is about no test set).
const LABEL = { 'M-v3': 'v3', 'M-run1': 'run1', 'M-run2': 'run2', 'M-run3': 'run3', 'M-run4': 'run4', 'M-run5': 'run5' };
const stop = (s) => String(s).replace(/\.\s*$/, '');
const sentences = (s) => String(s).split(/(?<=\.)\s+(?=[A-Z])/).map((x) => x.trim()).filter(Boolean);

export function buildFacts(data) {
  const label = (id) => LABEL[id] || (data.models.find((m) => m.id === id)?.title ?? id);
  const facts = [];
  const add = (id, text, rec, test_set_id = null) =>
    facts.push({ id, text, source: rec.source, source_line: rec.source_line, test_set_id, record_id: rec.id });

  for (const e of data.evaluations) {
    const who = label(e.model_id) + (e.variant ? ` ${e.variant}` : '');
    const where = `${e.test_set_id}${e.condition ? ` (${e.condition})` : ''}`;
    const name = e.unit ? `"${e.class ? `${e.class} ` : ''}${e.metric_name}"` : `${e.metric_name}${e.class ? ` for the ${e.class} class` : ''}`;
    add(`F-${e.id}`, e.unit
      ? `On ${where}, ${who} had ${name} in ${e.value} of frames.`
      : `On ${where}, ${who} scored ${e.value} ${name}.`, e, e.test_set_id);
  }
  for (const m of data.models) {
    const s = (m.attributes || []).find((a) => a.label === 'Status');
    if (s) add(`F-${m.id}-status`, `${label(m.id)} has the status "${s.value}".`, m);
  }
  for (const x of data.experiments) {
    if (x.verdict) add(`F-${x.id}-verdict`, `The verdict recorded for ${label(x.model_ids[0])} is "${stop(x.verdict)}".`, x);
  }
  for (const d of data.datasets.filter((d) => String(d.kind).startsWith('test_set'))) {
    sentences(d.summary).forEach((t, i) => add(`F-${d.id}-def${i + 1}`, `${d.id}: ${t}`, d, d.id));
    d.caveats.flatMap(sentences).forEach((t, i) => add(`F-${d.id}-limit${i + 1}`, `${d.id}: ${t}`, d, d.id));
  }
  for (const g of data.gaps) add(`F-${g.id}`, stop(g.summary) + '.', g);
  return facts;
}
