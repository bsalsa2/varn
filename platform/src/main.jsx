import React, { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  ArrowUpRight, Database, FlaskConical, Grid3x3, Layers3,
  Orbit, RefreshCw, Search, Server, Workflow, X, CornerDownLeft,
} from 'lucide-react';
import Earth from './earth/Earth.jsx';
import { formatLat, formatLon } from './earth/sun.js';
import { caveats } from './results.js';
import { EVIDENCE, models, datasets, bestVerified, runOne, pendingRun, roboflow, birdDrone, runs } from './records.js';
import './styles.css';

const Sky = lazy(() => import('./sky/Sky.jsx'));

const API_URL = 'https://varn-api.varnlabs.workers.dev';
const ROUTES = [
  { id: 'overview', label: 'Overview', icon: Orbit, key: '1' },
  { id: 'results', label: 'Results', icon: FlaskConical, key: '2' },
  { id: 'runs', label: 'Runs', icon: Workflow, key: '3' },
  { id: 'models', label: 'Models', icon: Layers3, key: '4' },
  { id: 'datasets', label: 'Datasets', icon: Database, key: '5' },
  { id: 'system', label: 'System', icon: Server, key: '6' },
];
const routeFromHash = () => { const id = location.hash.replace(/^#\/?/, ''); return ROUTES.some((r) => r.id === id) ? id : 'overview'; };
const utcTime = (d) => d ? d.toISOString().slice(11, 16) + ' UTC' : '—';
const cx = (...c) => c.filter(Boolean).join(' ');

function useReducedMotion() {
  const q = '(prefers-reduced-motion: reduce)';
  const [v, setV] = useState(() => matchMedia(q).matches);
  useEffect(() => { const m = matchMedia(q); const on = () => setV(m.matches); m.addEventListener('change', on); return () => m.removeEventListener('change', on); }, []);
  return v;
}

function useApiHealth() {
  const [api, setApi] = useState({ state: 'checking', latency: null, checkedAt: null, body: null, error: null });
  const busy = useRef(false);
  const check = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setApi((a) => ({ ...a, state: a.checkedAt ? a.state : 'checking', busy: true }));
    const t0 = performance.now();
    try {
      const res = await fetch(`${API_URL}/health`, { cache: 'no-store' });
      const latency = Math.round(performance.now() - t0);
      const body = await res.json().catch(() => null);
      const ok = res.ok && body?.ok === true;
      setApi({ state: ok ? 'online' : 'offline', latency, checkedAt: new Date(), body, error: ok ? null : `HTTP ${res.status}` });
    } catch (err) {
      setApi({ state: 'offline', latency: null, checkedAt: new Date(), body: null, error: err?.message || 'Network error' });
    } finally { busy.current = false; }
  }, []);
  useEffect(() => {
    check();
    const id = setInterval(() => { if (!document.hidden) check(); }, 120000);
    return () => clearInterval(id);
  }, [check]);
  return [api, check];
}

const API_LABEL = { online: 'Online', offline: 'Unreachable', checking: 'Checking' };

// Written by .github/workflows/kaggle-sync.yml; absent until that workflow has run once.
function useKaggleSync() {
  const [sync, setSync] = useState({ state: 'loading', data: null });
  useEffect(() => {
    fetch('/data/kaggle.json', { cache: 'no-store' })
      // A missing file comes back as the SPA's index.html (status 200), so check the type too.
      .then((r) => { if (r.status === 404 || !(r.headers.get('content-type') || '').includes('json')) return null; if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((data) => setSync(data?.kernels ? { state: 'ready', data } : { state: 'missing', data: null }))
      .catch(() => setSync({ state: 'error', data: null }));
  }, []);
  return sync;
}
const KAGGLE_TONE = (status) => status === 'COMPLETE' ? 'online' : /RUNNING|QUEUED/.test(status) ? 'checking' : /ERROR|CANCEL|UNREACHABLE/.test(status) ? 'offline' : 'idle';
const KAGGLE_LABEL = (status) => ({ COMPLETE: 'Complete', RUNNING: 'Running', QUEUED: 'Queued', ERROR: 'Error', UNKNOWN: 'Unknown', UNREACHABLE: 'Unreachable' }[status] ?? status.toLowerCase().replace(/_/g, ' '));
const syncedWhen = (iso) => iso ? iso.replace('T', ' ').replace('Z', ' UTC') : '—';

function Mark() {
  return <svg className="mark" viewBox="0 0 42 42" aria-hidden="true"><path d="M7 31 17.2 9h7.5L35 31h-8.1l-6-13.1L14.8 31Z" fill="currentColor"/><path d="M17.2 25.2h9.1l2.2 5.8H14.8Z" fill="var(--bg)"/></svg>;
}

function Signal({ state }) { return <span className={`signal ${state}`} aria-hidden="true"/>; }

/* ───────────── Rail ───────────── */
function Rail({ route, go, api, onPalette }) {
  return <nav className="rail" aria-label="Command Center">
    <a className="rail-brand" href="#/overview" onClick={(e) => { e.preventDefault(); go('overview'); }}>
      <Mark/><span className="rail-word">VARN</span>
    </a>
    <button className="rail-search" onClick={onPalette} aria-label="Open command menu">
      <Search size={14}/><span>Go to…</span><kbd>⌘K</kbd>
    </button>
    <ul className="rail-list">
      {ROUTES.map((r) => { const Icon = r.icon; const on = route === r.id;
        return <li key={r.id}><a href={`#/${r.id}`} className={cx('rail-item', on && 'on')} aria-current={on ? 'page' : undefined}
          onClick={(e) => { e.preventDefault(); go(r.id); }}>
          <Icon size={16} strokeWidth={1.6}/><span>{r.label}</span><kbd>{r.key}</kbd>
        </a></li>; })}
      <li className="sky-li"><a href="#sky" className="rail-item"><Orbit size={16} strokeWidth={1.6}/><span>Sky<span className="lg-only"> view</span></span><ArrowUpRight size={13} className="rail-ext"/></a></li>
    </ul>
    <button className="rail-status" onClick={() => go('system')} title="API health">
      <Signal state={api.state}/>
      <span className="rail-status-text"><strong>API {API_LABEL[api.state].toLowerCase()}</strong>
        <small>{api.latency != null ? `${api.latency} ms · ` : ''}{utcTime(api.checkedAt)}</small></span>
    </button>
  </nav>;
}

/* ───────────── Overview: the planet carries the page ───────────── */
function Overview({ go, api, openInspector }) {
  const cells = [
    { k: 'Best verified', v: bestVerified.metric.toFixed(3), unit: 'mAP50', d: 'v3 (.pt) · Roboflow clean validation', to: 'results' },
    { k: 'Last decision', v: 'Keep v3', d: `Fine-tune run 1 scored ${runOne.metric.toFixed(3)} (${runOne.vsV3})`, to: 'runs' },
    { k: 'In progress', v: pendingRun.name, small: true, d: 'Running · no result recorded yet', to: 'runs' },
  ];
  return <div className="overview">
    <header className="overview-head enter">
      <p className="eyebrow"><span>VARN</span><i/>Command Center<i/>Research build 0.1</p>
      <h1 className="display">Every result<br/>traces to its source.</h1>
      <p className="lede">Detection models, datasets and evaluation runs for VARN's sky-awareness research. Numbers appear here only when a report backs them.</p>
      <div className="overview-actions">
        <button className="btn primary" onClick={() => go('results')}>Open results<ArrowUpRight size={15}/></button>
        <button className="btn ghost" onClick={() => openInspector({ type: 'evidence', src: bestVerified.src, highlight: '0.853', title: 'Where 0.853 comes from' })}>View the evidence</button>
      </div>
    </header>

    <section className="readout glass enter" style={{ '--d': '120ms' }} aria-label="Research readout">
      {cells.map((c) => <button key={c.k} className="readout-cell" onClick={() => go(c.to)}>
        <span className="label">{c.k}</span>
        <span className={cx('readout-value', c.small && 'small')}>{c.v}{c.unit && <em>{c.unit}</em>}</span>
        <span className="readout-detail">{c.d}</span>
      </button>)}
      <button className="readout-cell" onClick={() => go('system')}>
        <span className="label">Platform API</span>
        <span className="readout-value small"><Signal state={api.state}/>{API_LABEL[api.state]}</span>
        <span className="readout-detail">{api.latency != null ? `${api.latency} ms round trip · ` : ''}checked {utcTime(api.checkedAt)}</span>
      </button>
    </section>
  </div>;
}

/* ───────────── Workspace sheet ───────────── */
function Sheet({ eyebrow, title, desc, children, aside }) {
  return <section className="sheet enter">
    <header className="sheet-head">
      <div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1>{desc && <p className="sheet-desc">{desc}</p>}</div>
      {aside}
    </header>
    <div className="sheet-body">{children}</div>
  </section>;
}

function Bar({ value }) { return <span className="bar" aria-hidden="true"><i style={{ '--w': `${value * 100}%` }}/></span>; }

function ScoreTable({ table, extraHead, extraKey, open }) {
  const best = Math.max(...table.rows.map((r) => r.metric));
  return <div className="block">
    <div className="block-head"><h2>{table.title}</h2><span className="label">mAP50</span></div>
    <p className="block-note">{table.detail}</p>
    <table className="table">
      <thead><tr><th>Model</th><th className="num">mAP50</th><th className="bar-col"><span className="sr-only">Scale</span></th><th>{extraHead}</th><th className="src-col">Source</th></tr></thead>
      <tbody>{table.rows.map((r) => <tr key={r.model} tabIndex={0} className={cx(r.metric === best && 'lead')}
        onClick={() => open({ type: 'evidence', src: r.src, highlight: r.metric.toFixed(3).replace(/0$/, ''), title: `${r.model} · ${table.title}` })}
        onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.click(); }}>
        <td>{r.model}</td><td className="num mono">{r.metric.toFixed(3)}</td><td className="bar-col"><Bar value={r.metric}/></td>
        <td className="muted">{r[extraKey]}</td><td className="src-col"><span className="src">{r.src}</span></td>
      </tr>)}</tbody>
    </table>
  </div>;
}

function Results({ open }) {
  return <Sheet eyebrow="Research / Results" title="Results"
    desc="Hand-copied from Kaggle reports for notebook varnlabs/varn-train. Select a row to read the source."
    aside={<div className="callout"><strong>Read each table on its own.</strong> Scores compare only within a table: same test set, the model named on the row.</div>}>
    <ScoreTable table={roboflow} extraHead="vs v3, same set" extraKey="vsV3" open={open}/>
    <div className="block">
      <table className="table compact">
        <thead><tr><th>Roboflow validation, per class</th><th className="num">mAP50-95</th><th className="num">AP50 drone</th><th className="num">AP50 aircraft</th><th className="src-col">Source</th></tr></thead>
        <tbody>{roboflow.detail2.map((r) => <tr key={r.label} tabIndex={0}
          onClick={() => open({ type: 'evidence', src: r.src, highlight: r.map5095, title: `${r.label} · per class` })}
          onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.click(); }}>
          <td>{r.label}</td><td className="num mono">{r.map5095}</td><td className="num mono">{r.drone}</td><td className="num mono">{r.aircraft}</td><td className="src-col"><span className="src">{r.src}</span></td></tr>)}</tbody>
      </table>
      <p className="block-note">{roboflow.pr}.</p>
    </div>
    <ScoreTable table={birdDrone} extraHead="Notes" extraKey="extra" open={open}/>
    <div className="block">
      <div className="block-head"><h2>Caveats</h2></div>
      <ol className="caveats">{caveats.map((c) => <li key={c}>{c}</li>)}</ol>
    </div>
  </Sheet>;
}

function KaggleBlock({ sync, open }) {
  return <div className="block kaggle">
    <div className="block-head"><h2>Kaggle notebooks</h2><span className="label">{sync.state === 'ready' ? `Changed ${syncedWhen(sync.data.changed_at)}` : 'Auto-synced'}</span></div>
    <p className="block-note">Status and report straight from the Kaggle API, synced every 6 hours by a GitHub Action. Not hand-checked; the tables on Results are.</p>
    {sync.state === 'ready' ? <div className="kernels">{sync.data.kernels.map((k) => <button key={k.ref} className="kernel" onClick={() => open({ type: 'kaggle', kernel: k, changedAt: sync.data.changed_at })}>
      <span className="mono kernel-ref">{k.ref}</span>
      <span className={cx('chip', k.status === 'COMPLETE' && 'ok')}><Signal state={KAGGLE_TONE(k.status)}/>{KAGGLE_LABEL(k.status)}</span>
      <span className="kernel-note">{k.error ? `Kaggle said: ${k.error}` : k.report_md ? 'Report available' : 'No report in output'}</span>
      <ArrowUpRight size={15} className="card-arrow"/>
    </button>)}</div>
      : <p className="empty-line">{sync.state === 'loading' ? 'Loading…' : sync.state === 'error' ? 'The synced file could not be read.' : 'Not synced yet. Run “Kaggle sync” once from the repository’s Actions tab.'}</p>}
  </div>;
}

function Runs({ open, sync }) {
  return <Sheet eyebrow="Research / Runs" title="Runs" desc="Every training and scoring run with a recorded report, oldest first.">
    <KaggleBlock sync={sync} open={open}/>
    <div className="block"><div className="block-head"><h2>Recorded runs</h2><span className="label">Hand-copied evidence</span></div></div>
    <ol className="timeline">{runs.map((run, i) => <li key={run.id} className={cx('tl-item', run.pending && 'pending')}>
      <span className="tl-node" aria-hidden="true"/>
      <button className="tl-card" onClick={() => open({ type: 'evidence', src: run.src, highlight: run.pending ? 'running' : 'Verdict', title: run.name })}>
        <span className="tl-meta mono">{String(i + 1).padStart(2, '0')}<i/>{run.pending ? 'Running' : `${run.mode} · ${run.date}`}</span>
        <strong>{run.name}</strong>
        <span className="tl-verdict">{run.pending ? run.config : run.verdict}</span>
        {run.note && <span className="tl-note mono">{run.note}</span>}
        <span className="src">{run.src}</span>
      </button>
    </li>)}</ol>
  </Sheet>;
}

function Models({ open }) {
  return <Sheet eyebrow="Research / Models" title="Models" desc="Models named in the evidence. There is no model registry yet; this list is read from the reports.">
    <div className="cards">{models.map((m) => <button key={m.id} className="card" onClick={() => open({ type: 'model', model: m })}>
      <span className="card-top"><span className={cx('chip', m.tone)}><Signal state={m.tone === 'ok' ? 'online' : m.tone === 'pending' ? 'checking' : 'idle'}/>{m.status}</span><ArrowUpRight size={15} className="card-arrow"/></span>
      <strong className="card-title">{m.name}</strong>
      {m.detail && <span className="mono card-sub">{m.detail}</span>}
      <span className="card-body">{m.summary}</span>
      <dl className="card-facts">{m.facts.slice(-2).map(([k, v]) => <div key={k}><dt>{k}</dt><dd className="mono">{v.split(' · ')[0].split(' (')[0]}</dd></div>)}</dl>
    </button>)}</div>
  </Sheet>;
}

function Datasets({ open }) {
  return <Sheet eyebrow="Research / Datasets" title="Datasets" desc="Sets the reports evaluated or trained on. Counts are as reported, after near-duplicate removal.">
    <table className="table datasets">
      <thead><tr><th>Dataset</th><th>Role</th><th className="num">Images</th><th className="num">Instances</th><th>Classes</th></tr></thead>
      <tbody>{datasets.map((d) => <tr key={d.id} tabIndex={0} onClick={() => open({ type: 'dataset', dataset: d })} onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.click(); }}>
        <td><strong>{d.name}</strong></td><td className="muted">{d.role}</td>
        <td className="num mono">{d.images.toLocaleString('en-US')}</td><td className="num mono">{d.instances ?? '—'}</td><td className="muted">{d.classes}</td>
      </tr>)}</tbody>
    </table>
  </Sheet>;
}

function System({ api, check, earth, sync }) {
  return <Sheet eyebrow="Platform / System" title="System" desc="What this client can verify right now. Nothing on this page is assumed.">
    <div className="sys-grid">
      <div className="sys-panel">
        <div className="block-head"><h2>Platform API</h2><button className="btn ghost sm" onClick={check} disabled={api.busy}><RefreshCw size={13} className={api.busy ? 'spin' : ''}/>Check now</button></div>
        <dl className="facts">
          <div><dt>Status</dt><dd><Signal state={api.state}/>{API_LABEL[api.state]}{api.error && <span className="muted"> · {api.error}</span>}</dd></div>
          <div><dt>Round trip</dt><dd className="mono">{api.latency != null ? `${api.latency} ms` : '—'}</dd></div>
          <div><dt>Last checked</dt><dd className="mono">{api.checkedAt ? api.checkedAt.toISOString().replace('T', ' ').slice(0, 19) + ' UTC' : '—'}</dd></div>
          <div><dt>Endpoint</dt><dd className="mono">{API_URL.replace('https://', '')}/health</dd></div>
        </dl>
        <pre className="raw" aria-label="Raw response">{api.body ? JSON.stringify(api.body, null, 2) : '// no response body'}</pre>
      </div>
      <div className="sys-panel">
        <div className="block-head"><h2>Connections</h2></div>
        <ul className="conn">
          <li><span><strong>Kaggle</strong><small>{sync.state === 'ready' ? `Synced by GitHub Action every 6 h · last change ${syncedWhen(sync.data.changed_at)}` : 'Sync workflow added; it has not run yet'}</small></span>
            {sync.state === 'ready' ? <span className="chip ok"><Signal state="online"/>Synced</span> : <span className="chip muted"><Signal state="idle"/>Not synced</span>}</li>
          <li><span><strong>Object storage</strong><small>Model artifacts and dataset files</small></span><span className="chip muted"><Signal state="idle"/>Not configured</span></li>
          <li><span><strong>Activity log</strong><small>No event source exists yet, so none is shown</small></span><span className="chip muted"><Signal state="idle"/>None</span></li>
        </ul>
        <div className="block-head" style={{ marginTop: 28 }}><h2>Earth imagery</h2></div>
        <dl className="facts">
          <div><dt>Renderer</dt><dd>{{ ready: 'WebGL 2 · loaded', loading: 'Loading imagery…', failed: 'Imagery failed to load', unsupported: 'WebGL 2 unavailable · static fallback' }[earth]}</dd></div>
          <div><dt>Source</dt><dd>NASA Blue Marble and Earth at Night composites (public domain)</dd></div>
          <div><dt>Live?</dt><dd>No. Only the sun angle is current; the view is a slow camera drift.</dd></div>
        </dl>
      </div>
    </div>
  </Sheet>;
}

/* ───────────── Inspector (contextual) ───────────── */
function EvidenceText({ src, highlight }) {
  const text = EVIDENCE[src] ?? '';
  const firstHit = useRef(null);
  const pre = useRef(null);
  // Scroll only the evidence box itself; scrollIntoView would also scroll overflow-hidden
  // ancestors (the full-screen window) and shift the whole interface.
  useEffect(() => {
    const box = pre.current, hit = firstHit.current;
    if (box) box.scrollTop = hit ? Math.max(0, hit.offsetTop - box.clientHeight / 2) : 0;
  }, [src, highlight]);
  let marked = false;
  return <pre className="evidence" ref={pre}>{text.split('\n').map((line, i) => {
    const hit = highlight && line.includes(highlight);
    const ref = hit && !marked ? (marked = true, firstHit) : undefined;
    return <span key={i} ref={ref} className={cx('ev-line', hit && 'hit')}><span className="ev-n">{i + 1}</span>{line || ' '}</span>;
  })}</pre>;
}

function Inspector({ item, onClose }) {
  const ref = useRef(null);
  useEffect(() => { ref.current?.focus({ preventScroll: true }); }, [item]);
  if (!item) return null;
  let title, body, src;
  if (item.type === 'kaggle') { const k = item.kernel;
    return <aside className="inspector glass" role="dialog" aria-label={k.ref} tabIndex={-1} ref={ref} onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}>
      <header className="insp-head"><div><p className="eyebrow">Kaggle · auto-synced</p><h2 className="mono-title">{k.ref}</h2></div>
        <button className="icon-btn" onClick={onClose} aria-label="Close panel"><X size={16}/></button></header>
      <dl className="facts">
        <div><dt>Status</dt><dd><Signal state={KAGGLE_TONE(k.status)}/>{KAGGLE_LABEL(k.status)}</dd></div>
        {k.error && <div><dt>Error</dt><dd className="mono">{k.error}</dd></div>}
        <div><dt>Last change</dt><dd className="mono">{syncedWhen(item.changedAt)}</dd></div>
        <div><dt>Notebook</dt><dd><a className="link" href={k.url} target="_blank" rel="noreferrer">Open on Kaggle <ArrowUpRight size={12}/></a></dd></div>
      </dl>
      <div className="insp-src"><span className="label">report.md from the run output</span><span className="mono">platform/public/data/kaggle.json</span></div>
      <pre className="evidence">{(k.report_md || 'No report.md in this run’s output.').split('\n').map((line, i) => <span key={i} className="ev-line"><span className="ev-n">{i + 1}</span>{line || ' '}</span>)}</pre>
    </aside>; }
  if (item.type === 'evidence') { title = item.title; src = item.src; body = null; }
  if (item.type === 'model') { const m = item.model; title = m.name; src = m.src;
    body = <><p className="insp-lede">{m.summary}</p><dl className="facts">{m.facts.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl></>; }
  if (item.type === 'dataset') { const d = item.dataset; title = d.name; src = d.src;
    body = <><p className="insp-lede">{d.role}</p><dl className="facts">
      <div><dt>Images</dt><dd className="mono">{d.images.toLocaleString('en-US')}</dd></div>
      <div><dt>Instances</dt><dd className="mono">{d.instances ?? 'Not reported'}</dd></div>
      <div><dt>Classes</dt><dd>{d.classes}</dd></div>
      <div><dt>Cleaning</dt><dd>{d.note}</dd></div>
      <div><dt>Caveat</dt><dd>{d.caveat}</dd></div></dl></>; }
  return <aside className="inspector glass" role="dialog" aria-label={title} tabIndex={-1} ref={ref}
    onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}>
    <header className="insp-head"><div><p className="eyebrow">Evidence</p><h2>{title}</h2></div>
      <button className="icon-btn" onClick={onClose} aria-label="Close panel"><X size={16}/></button></header>
    {body}
    <div className="insp-src"><span className="label">Source file</span><span className="mono">platform/evidence/{src}</span></div>
    <EvidenceText src={src} highlight={item.highlight}/>
  </aside>;
}

/* ───────────── Command menu ───────────── */
function Palette({ open, onClose, go, actions }) {
  const [q, setQ] = useState('');
  const [i, setI] = useState(0);
  const input = useRef(null);
  const items = useMemo(() => [
    ...ROUTES.map((r) => ({ id: r.id, label: r.label, hint: `Go · ${r.key}`, icon: r.icon, run: () => go(r.id) })),
    ...actions,
  ].filter((x) => x.label.toLowerCase().includes(q.toLowerCase())), [q, actions, go]);
  useEffect(() => { if (open) { setQ(''); setI(0); setTimeout(() => input.current?.focus({ preventScroll: true }), 0); } }, [open]);
  useEffect(() => setI(0), [q]);
  if (!open) return null;
  const run = (x) => { onClose(); x.run(); };
  return <div className="palette-scrim" onMouseDown={onClose}>
    <div className="palette glass" role="dialog" aria-modal="true" aria-label="Command menu" onMouseDown={(e) => e.stopPropagation()}>
      <div className="palette-input"><Search size={16}/>
        <input ref={input} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Go to a page or run an action" aria-label="Search commands"
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setI((v) => Math.min(items.length - 1, v + 1)); }
            if (e.key === 'ArrowUp') { e.preventDefault(); setI((v) => Math.max(0, v - 1)); }
            if (e.key === 'Enter' && items[i]) run(items[i]);
            if (e.key === 'Escape') onClose();
          }}/><kbd>esc</kbd></div>
      <ul className="palette-list" role="listbox">{items.map((x, n) => { const Icon = x.icon;
        return <li key={x.id} role="option" aria-selected={n === i} className={cx(n === i && 'on')} onMouseEnter={() => setI(n)} onClick={() => run(x)}>
          <Icon size={15} strokeWidth={1.6}/><span>{x.label}</span><small>{x.hint}</small>{n === i && <CornerDownLeft size={13}/>}</li>; })}
        {!items.length && <li className="empty">Nothing matches “{q}”.</li>}</ul>
    </div>
  </div>;
}

/* ───────────── Shell ───────────── */
function CommandCenter() {
  const [route, setRoute] = useState(routeFromHash);
  const [api, check] = useApiHealth();
  const sync = useKaggleSync();
  const [inspect, setInspect] = useState(null);
  const [palette, setPalette] = useState(false);
  const [earth, setEarth] = useState('loading');
  const [view, setView] = useState(null);
  const [grid, setGrid] = useState(() => { try { return localStorage.getItem('varn.cc.grid') !== '0'; } catch { return true; } });
  const reduced = useReducedMotion();

  useEffect(() => { try { localStorage.setItem('varn.cc.grid', grid ? '1' : '0'); } catch { /* storage unavailable */ } }, [grid]);
  useEffect(() => { const on = () => setRoute(routeFromHash()); addEventListener('hashchange', on); return () => removeEventListener('hashchange', on); }, []);
  useEffect(() => { document.title = `${ROUTES.find((r) => r.id === route).label} · VARN`; }, [route]);

  const go = useCallback((id) => { setInspect(null); if (location.hash !== `#/${id}`) location.hash = `/${id}`; setRoute(id); }, []);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPalette((v) => !v); return; }
      if (e.target.closest('input, textarea, [contenteditable]') || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'Escape') { setInspect(null); return; }
      const r = ROUTES.find((x) => x.key === e.key); if (r && !palette) go(r.id);
    };
    addEventListener('keydown', onKey); return () => removeEventListener('keydown', onKey);
  }, [go, palette]);

  const actions = useMemo(() => [
    { id: 'check', label: 'Check API health', hint: 'Action', icon: RefreshCw, run: check },
    { id: 'grid', label: grid ? 'Hide graticule' : 'Show graticule', hint: 'Action', icon: Grid3x3, run: () => setGrid((g) => !g) },
    { id: 'sky', label: 'Open Sky view', hint: 'Separate view', icon: Orbit, run: () => { location.hash = 'sky'; } },
  ], [check, grid]);

  const mode = route === 'overview' ? 'overview' : inspect ? 'inspect' : 'work';
  const page = { results: <Results open={setInspect}/>, runs: <Runs open={setInspect} sync={sync}/>, models: <Models open={setInspect}/>,
    datasets: <Datasets open={setInspect}/>, system: <System api={api} check={check} earth={earth} sync={sync}/> }[route];

  return <div className={cx('cc', `mode-${mode}`, `earth-${earth}`)}>
    <div className="earth-layer">
      {earth !== 'unsupported' && <Earth mode={mode} grid={grid} reducedMotion={reduced} onStatus={setEarth} onView={setView}/>}
      <div className="earth-fallback" aria-hidden="true"/>
      <div className="earth-shade" aria-hidden="true"/>
    </div>

    <div className="window">
      <Rail route={route} go={go} api={api} onPalette={() => setPalette(true)}/>
      <div className="pane">
        <div className="fog" aria-hidden="true"/>
        <header className="pane-bar">
          <p className="crumb"><span>VARN</span><i>/</i><strong>{ROUTES.find((r) => r.id === route).label}</strong></p>
          <div className="pills">
            <button className={cx('pill', grid && 'on')} onClick={() => setGrid(!grid)} aria-pressed={grid} title="Show the 15° graticule on the planet"><Grid3x3 size={13}/>Graticule</button>
            <a className="pill" href="#sky"><Orbit size={13}/>Sky view<ArrowUpRight size={12}/></a>
          </div>
        </header>
        <main className="stage" key={route}>
          {route === 'overview' ? <Overview go={go} api={api} openInspector={setInspect}/> : page}
        </main>
        <Inspector item={inspect} onClose={() => setInspect(null)}/>
      </div>
    </div>

    <footer className="caption" aria-label="About the Earth imagery">
      <span className="caption-row"><b>Earth</b>NASA Blue Marble · Earth at Night<i/>composite imagery, not a live feed</span>
      <span className="caption-row mono">
        {earth === 'failed' ? 'Imagery unavailable' : earth === 'unsupported' ? 'Static render · sun position not current' : view ? <>
          <b>Sun</b>{formatLat(view.sun.lat)} {formatLon(view.sun.lon)}<i/>computed for now<i/><b>View</b>{formatLat(view.lat)} {formatLon(view.lon)}</> : 'Loading imagery…'}
      </span>
    </footer>

    <Palette open={palette} onClose={() => setPalette(false)} go={go} actions={actions}/>
  </div>;
}

function Root() {
  const [hash, setHash] = useState(location.hash);
  useEffect(() => { const on = () => setHash(location.hash); addEventListener('hashchange', on); return () => removeEventListener('hashchange', on); }, []);
  if (hash === '#sky') return <Suspense fallback={<div style={{ position: 'fixed', inset: 0, background: '#0B0F14' }}/>}><Sky/></Suspense>;
  return <CommandCenter/>;
}

createRoot(document.getElementById('root')).render(<Root/>);
