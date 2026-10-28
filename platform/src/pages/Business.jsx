import React, { useRef, useState } from 'react';
import { ArrowUpRight, Trash2, Download, Upload, FileText } from 'lucide-react';
import { Sheet, Tabs, QuickForm, Empty, money, cx } from '../ui.jsx';
import { documents, bom, bomTotal, bomPath, blobUrl, supplierOf } from '../data/repo.js';
import { exportRecords, importRecords } from '../data/store.js';

export const BUSINESS_TABS = [['documents', 'Documents'], ['budget', 'Budget'], ['suppliers', 'Suppliers'], ['hiring', 'Hiring']];

function Del({ onClick, label }) { return <button className="icon-btn sm" onClick={onClick} aria-label={label}><Trash2 size={13}/></button>; }

function Documents({ store, open }) {
  const { db, add, remove } = store;
  return <>
    <div className="block">
      <div className="block-head"><h2>In the repository</h2><span className="label">{documents.length} documents</span></div>
      <ul className="rows">{documents.map((d) => <li key={d.path}><button onClick={() => open({ type: 'doc', doc: d })}>
        <FileText size={14} className="row-icon"/><span className="row-main"><strong>{d.title}</strong><small>{d.area} · {d.path} · {d.words.toLocaleString('en-US')} words</small></span><ArrowUpRight size={13}/></button></li>)}</ul>
    </div>
    <div className="block">
      <div className="block-head"><h2>Your links</h2><span className="label">Private to this browser</span></div>
      <QuickForm onSubmit={(d) => add('links', { title: d.title.trim(), url: d.url.trim(), area: d.area })} fields={[
        { name: 'title', label: 'Title', placeholder: 'Grant application draft', wide: true },
        { name: 'url', label: 'Link', type: 'url', placeholder: 'https://…' },
        { name: 'area', label: 'Area', options: [['Company', 'Company'], ['Research', 'Research'], ['Finance', 'Finance'], ['Legal', 'Legal'], ['Hiring', 'Hiring']] },
      ]}/>
      {db.links.length ? <ul className="rows">{db.links.map((l) => <li key={l.id} className="row-edit"><a href={l.url} target="_blank" rel="noreferrer">
        <span className="row-main"><strong>{l.title}</strong><small>{l.area} · {l.url}</small></span><ArrowUpRight size={13}/></a><Del onClick={() => remove('links', l.id)} label={`Delete ${l.title}`}/></li>)}</ul>
        : <Empty title="No links yet">Keep pointers to documents that live elsewhere: drives, applications, contracts.</Empty>}
    </div>
  </>;
}

function Budget({ store }) {
  const { db, add, addMany, remove } = store;
  const sum = (k) => db.budget.filter((b) => b.kind === k).reduce((s, b) => s + (Number(b.amount) || 0), 0);
  const fromBom = db.budget.some((b) => b.source === bomPath);
  const byCat = Object.entries(db.budget.reduce((m, b) => ({ ...m, [b.category]: (m[b.category] || 0) + (Number(b.amount) || 0) }), {})).sort((a, b) => b[1] - a[1]);
  return <div className="block">
    <div className="budget-top">
      <div className="kpi"><span className="label">Planned</span><strong className="mono">{money(sum('planned'))}</strong></div>
      <div className="kpi"><span className="label">Spent</span><strong className="mono">{money(sum('spent'))}</strong></div>
      <div className="kpi"><span className="label">Lines</span><strong className="mono">{db.budget.length}</strong></div>
      {byCat.length > 0 && <div className="kpi wide"><span className="label">By category</span><span className="cats">{byCat.slice(0, 4).map(([c, v]) => <span key={c}>{c} <b className="mono">{money(v)}</b></span>)}</span></div>}
    </div>
    <QuickForm onSubmit={(d) => add('budget', { item: d.item.trim(), category: d.category, kind: d.kind, amount: Number(d.amount) || 0, date: d.date || null })} fields={[
      { name: 'item', label: 'Item', placeholder: 'Raspberry Pi 4 for the node', wide: true },
      { name: 'category', label: 'Category', options: [['Hardware', 'Hardware'], ['Compute', 'Compute'], ['Software', 'Software'], ['Data', 'Data'], ['Travel', 'Travel'], ['Legal', 'Legal'], ['Other', 'Other']] },
      { name: 'kind', label: 'Type', options: [['planned', 'Planned'], ['spent', 'Spent']] },
      { name: 'amount', label: 'USD', type: 'number', step: '0.01', min: '0', placeholder: '0.00' },
      { name: 'date', label: 'Date', type: 'date' },
    ]}/>
    {db.budget.length ? <table className="table compact">
      <thead><tr><th>Item</th><th>Category</th><th>Type</th><th>Date</th><th className="num">Amount</th><th/></tr></thead>
      <tbody>{db.budget.map((b) => <tr key={b.id} className="static"><td>{b.item}{b.source && <small className="muted"> · {b.source}</small>}</td><td className="muted">{b.category}</td>
        <td><span className={cx('chip', b.kind === 'spent' && 'ok')}>{b.kind === 'spent' ? 'Spent' : 'Planned'}</span></td><td className="mono muted">{b.date || '—'}</td>
        <td className="num mono">{money(b.amount)}</td><td className="num"><Del onClick={() => remove('budget', b.id)} label={`Delete ${b.item}`}/></td></tr>)}</tbody>
    </table> : <Empty title="No budget lines yet">Add planned and actual spending above.</Empty>}
    {!fromBom && <button className="btn ghost sm import" onClick={() => addMany('budget', bom.filter((r) => r.cost).map((r) => ({ item: `${r.part}${r.qty > 1 ? ` ×${r.qty}` : ''}`, category: 'Hardware', kind: 'planned', amount: r.cost, date: null, source: bomPath })))}>
      <Download size={13}/>Add the prototype BOM from {bomPath} ({money(bomTotal)} across {bom.filter((r) => r.cost).length} priced parts)</button>}
  </div>;
}

function Suppliers({ store }) {
  const { db, add, addMany, remove } = store;
  const known = new Set(db.suppliers.map((s) => s.name));
  const fromBom = Object.entries(bom.reduce((m, r) => { const h = supplierOf(r.link); if (h) (m[h] ||= []).push(r.part); return m; }, {})).filter(([h]) => !known.has(h));
  return <div className="block">
    <QuickForm onSubmit={(d) => add('suppliers', { name: d.name.trim(), url: d.url.trim() || null, supplies: d.supplies.trim(), status: d.status })} fields={[
      { name: 'name', label: 'Supplier', placeholder: 'adafruit.com', wide: true },
      { name: 'supplies', label: 'Supplies', placeholder: 'Servos, brackets' },
      { name: 'url', label: 'Link', type: 'url', placeholder: 'https://…' },
      { name: 'status', label: 'Status', options: [['candidate', 'Candidate'], ['ordered', 'Ordered from'], ['preferred', 'Preferred']] },
    ]}/>
    {db.suppliers.length ? <table className="table compact">
      <thead><tr><th>Supplier</th><th>Supplies</th><th>Status</th><th/></tr></thead>
      <tbody>{db.suppliers.map((s) => <tr key={s.id} className="static"><td>{s.url ? <a className="link" href={s.url} target="_blank" rel="noreferrer">{s.name}</a> : s.name}</td><td className="muted">{s.supplies}</td>
        <td><span className={cx('chip', s.status === 'preferred' && 'ok')}>{({ candidate: 'Candidate', ordered: 'Ordered from', preferred: 'Preferred' })[s.status] || s.status}</span></td>
        <td className="num"><Del onClick={() => remove('suppliers', s.id)} label={`Delete ${s.name}`}/></td></tr>)}</tbody>
    </table> : <Empty title="No suppliers yet"/>}
    {fromBom.length > 0 && <button className="btn ghost sm import" onClick={() => addMany('suppliers', fromBom.map(([h, parts]) => ({ name: h, url: `https://${h}/`, supplies: parts.join(', '), status: 'candidate', source: bomPath })))}>
      <Download size={13}/>Add the {fromBom.length} vendors linked in {bomPath} as candidates</button>}
  </div>;
}

function Hiring({ store }) {
  const { db, add, update, remove } = store;
  return <div className="block">
    <QuickForm onSubmit={(d) => add('hires', { role: d.role.trim(), when: d.when.trim(), kind: d.kind, status: 'idea', why: d.why.trim() })} fields={[
      { name: 'role', label: 'Role', placeholder: 'Embedded engineer (part-time)', wide: true },
      { name: 'kind', label: 'Type', options: [['mentor', 'Mentor / advisor'], ['part-time', 'Part-time'], ['full-time', 'Full-time'], ['contract', 'Contract']] },
      { name: 'when', label: 'When', placeholder: 'After Phase 4' },
      { name: 'why', label: 'Why', placeholder: 'What it unblocks' },
    ]}/>
    {db.hires.length ? <ul className="rows">{db.hires.map((h) => <li key={h.id} className="row-edit"><div className="row-static">
      <span className="row-main"><strong>{h.role}</strong><small>{h.kind} · {h.when || 'timing open'}{h.why ? ` · ${h.why}` : ''}</small></span>
      <select className="mini-select" value={h.status} onChange={(e) => update('hires', h.id, { status: e.target.value })} aria-label={`Status of ${h.role}`}>
        <option value="idea">Idea</option><option value="planned">Planned</option><option value="searching">Searching</option><option value="filled">Filled</option></select></div>
      <Del onClick={() => remove('hires', h.id)} label={`Delete ${h.role}`}/></li>)}</ul>
      : <Empty title="No hiring plans yet">The plan’s Track C starts with mentors and advisors; roles can be added as they become real.</Empty>}
  </div>;
}

export default function Business({ tab, setTab, store, open }) {
  const t = BUSINESS_TABS.some(([id]) => id === tab) ? tab : 'documents';
  const file = useRef(null);
  const [msg, setMsg] = useState('');
  const counts = { documents: documents.length + store.db.links.length, budget: store.db.budget.length, suppliers: store.db.suppliers.length, hiring: store.db.hires.length };
  return <Sheet eyebrow="Operations / Business" title="Business"
    desc="Documents, budget, suppliers and hiring plans. Repository documents are read from GitHub; everything you add stays in this browser."
    aside={<div className="store-actions">
      <button className="btn ghost sm" onClick={() => exportRecords(store.db)}><Download size={13}/>Export</button>
      <button className="btn ghost sm" onClick={() => file.current?.click()}><Upload size={13}/>Import</button>
      <input ref={file} type="file" accept="application/json" hidden onChange={(e) => {
        const f = e.target.files?.[0]; e.target.value = '';
        if (f) importRecords(f).then((j) => { store.replace(j); setMsg('Imported'); }).catch((err) => setMsg(err.message));
      }}/>
      <small>{msg || (store.saved ? 'Saved in this browser only' : 'Browser storage is blocked; changes will be lost')}</small>
    </div>}
    tabs={<Tabs label="Business" value={t} onChange={setTab} items={BUSINESS_TABS.map(([id, l]) => [id, l, counts[id]])}/>}>
    {t === 'documents' && <Documents store={store} open={open}/>}
    {t === 'budget' && <Budget store={store}/>}
    {t === 'suppliers' && <Suppliers store={store}/>}
    {t === 'hiring' && <Hiring store={store}/>}
  </Sheet>;
}
