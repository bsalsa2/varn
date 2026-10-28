import React, { useMemo, useState } from 'react';
import { Search, ArrowUpRight, Sparkles } from 'lucide-react';
import { Sheet, Panel, cx } from '../ui.jsx';
import { documents, plan } from '../data/repo.js';
import { EVIDENCE, models, datasets } from '../records.js';
import { nextUp } from '../data/attention.js';

// Everything searchable, as { kind, title, text, open }.
function corpus(db) {
  return [
    ...documents.map((d) => ({ kind: 'Document', title: d.title, sub: d.path, text: d.text, open: { type: 'doc', doc: d } })),
    ...Object.entries(EVIDENCE).map(([src, text]) => ({ kind: 'Evidence', title: src, sub: `platform/evidence/${src}`, text, open: { type: 'evidence', src, title: src } })),
    ...models.map((m) => ({ kind: 'Model', title: m.name, sub: m.status, text: `${m.summary} ${m.facts.map((f) => f.join(' ')).join(' ')}`, open: { type: 'model', model: m } })),
    ...datasets.map((d) => ({ kind: 'Dataset', title: d.name, sub: d.role, text: `${d.note} ${d.caveat} ${d.classes}`, open: { type: 'dataset', dataset: d } })),
    ...db.tasks.map((t) => ({ kind: 'Task', title: t.title, sub: t.due ? `Due ${t.due}` : t.status, text: t.title, to: 'projects/tasks' })),
    ...db.budget.map((b) => ({ kind: 'Budget', title: b.item, sub: `${b.category} · ${b.kind}`, text: `${b.item} ${b.category}`, to: 'business/budget' })),
    ...db.suppliers.map((s) => ({ kind: 'Supplier', title: s.name, sub: s.supplies, text: `${s.name} ${s.supplies}`, to: 'business/suppliers' })),
    ...db.hires.map((h) => ({ kind: 'Hiring', title: h.role, sub: h.when, text: `${h.role} ${h.why} ${h.when}`, to: 'business/hiring' })),
    ...db.links.map((l) => ({ kind: 'Link', title: l.title, sub: l.url, text: `${l.title} ${l.url}`, href: l.url })),
  ];
}

function search(items, q) {
  const terms = q.toLowerCase().split(/\s+/).filter((t) => t.length > 1);
  if (!terms.length) return [];
  return items.map((it) => {
    const hay = `${it.title}\n${it.text}`.toLowerCase();
    if (!terms.every((t) => hay.includes(t))) return null;
    const score = terms.reduce((s, t) => s + (it.title.toLowerCase().includes(t) ? 5 : 0) + Math.min(5, hay.split(t).length - 1), 0);
    const at = it.text.toLowerCase().indexOf(terms[0]);
    const snippet = at >= 0 && it.text !== it.title ? it.text.slice(Math.max(0, at - 60), at + 140).replace(/\s+/g, ' ').trim() : '';
    return { ...it, score, snippet, highlight: terms[0] };
  }).filter(Boolean).sort((a, b) => b.score - a.score).slice(0, 12);
}

function Mark({ text, term }) {
  if (!term) return text;
  const i = text.toLowerCase().indexOf(term);
  if (i < 0) return text;
  return <>{text.slice(0, i)}<mark>{text.slice(i, i + term.length)}</mark>{text.slice(i + term.length)}</>;
}

export default function Assistant({ store, gh, go, open }) {
  const [q, setQ] = useState('');
  const items = useMemo(() => corpus(store.db), [store.db]);
  const hits = useMemo(() => search(items, q), [items, q]);
  const next = nextUp({ db: store.db, gh });
  const suggestions = ['mAP50', 'near-duplicate', 'Phase 1', 'servo', 'Kaggle', 'held-out'];
  return <Sheet eyebrow="Intelligence / Assistant" title="Assistant"
    desc="Search everything the Command Center knows. The AI assistant itself is planned, not built; this page says exactly what exists today.">
    <div className="ask">
      <Search size={18}/>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${documents.length} documents, evidence, models, datasets and your records`} aria-label="Search" autoFocus/>
      <span className="label">Local search · not AI</span>
    </div>
    {!q && <div className="suggest">{suggestions.map((s) => <button key={s} className="chip" onClick={() => setQ(s)}>{s}</button>)}</div>}
    {q && <div className="block">
      <div className="block-head"><h2>{hits.length ? `${hits.length} result${hits.length === 1 ? '' : 's'}` : 'No results'}</h2><span className="label">Every word must match</span></div>
      <ul className="rows hits">{hits.map((h, i) => {
        const inner = <><span className="hit-kind label">{h.kind}</span><span className="row-main"><strong><Mark text={h.title} term={h.highlight}/></strong>
          <small>{h.snippet ? <Mark text={`…${h.snippet}…`} term={h.highlight}/> : h.sub}</small></span><ArrowUpRight size={13}/></>;
        return <li key={i}>{h.href ? <a href={h.href} target="_blank" rel="noreferrer">{inner}</a>
          : <button onClick={() => (h.open ? open({ ...h.open, highlight: h.highlight }) : go(h.to))}>{inner}</button>}</li>;
      })}</ul>
    </div>}

    <div className="as-grid">
      <Panel title="What to work on next" meta="Rule-based, not AI">
        <ol className="next-list">{next.map((n, i) => <li key={i}><span className="next-n mono">{i + 1}</span><span className="row-main"><strong>{n.title}</strong><small>{n.why} · {n.src}</small></span></li>)}</ol>
        <p className="store-note">Order: overdue and dated tasks first, then the next unchecked step of “{plan.milestone.title}”, then failing CI.</p>
      </Panel>
      <Panel title={<><Sparkles size={15}/> The VARN assistant</>} meta="Planned">
        <ul className="plan-list">
          <li><strong>Search and answer</strong> across company documents, research reports and your records, citing the file each answer comes from.</li>
          <li><strong>Summarise research</strong>: turn new Kaggle reports into a short, sourced update.</li>
          <li><strong>Prepare reports</strong>: weekly progress against the plan’s current milestone.</li>
          <li><strong>Help decide what is next</strong> using the plan’s decision framework (§10).</li>
        </ul>
        <p className="block-note">Needs first: sign-in in front of this site (Cloudflare Access, free for small teams), private storage for your records instead of this browser, and a model API with a hard spending cap. None of these exist yet, so nothing here calls an AI.</p>
      </Panel>
    </div>
  </Sheet>;
}
