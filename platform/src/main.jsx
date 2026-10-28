import React, { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  ArrowUpRight, Briefcase, Download, FlaskConical, FolderKanban, Grid3x3, LayoutGrid, Orbit,
  RefreshCw, Search, Server, Sparkles, X, CornerDownLeft,
} from 'lucide-react';
import Earth from './earth/Earth.jsx';
import { formatLat, formatLon } from './earth/sun.js';
import { EVIDENCE } from './records.js';
import { Mark, Signal, cx, utcTime } from './ui.jsx';
import { useApiHealth, useKaggleSync, useGitHub, useSiteCheck, KAGGLE_TONE, KAGGLE_LABEL } from './data/live.js';
import { useRecords, exportRecords } from './data/store.js';
import Overview from './pages/Overview.jsx';
import Projects, { PROJECT_TABS } from './pages/Projects.jsx';
import Research, { RESEARCH_TABS } from './pages/Research.jsx';
import Business, { BUSINESS_TABS } from './pages/Business.jsx';
import Systems from './pages/Systems.jsx';
import Assistant from './pages/Assistant.jsx';
import './styles.css';

const Sky = lazy(() => import('./sky/Sky.jsx'));

// Three layers: Command (what is happening), Operations (the work), Intelligence (help deciding).
const ROUTES = [
  { id: 'overview', label: 'Overview', icon: LayoutGrid, key: '1', group: 'Command' },
  { id: 'projects', label: 'Projects', icon: FolderKanban, key: '2', group: 'Operations', tabs: PROJECT_TABS },
  { id: 'research', label: 'Research', icon: FlaskConical, key: '3', group: 'Operations', tabs: RESEARCH_TABS },
  { id: 'business', label: 'Business', icon: Briefcase, key: '4', group: 'Operations', tabs: BUSINESS_TABS },
  { id: 'systems', label: 'Systems', icon: Server, key: '5', group: 'Technical' },
  { id: 'assistant', label: 'Assistant', icon: Sparkles, key: '6', group: 'Intelligence', badge: 'Early' },
];
// Links from the previous layout keep working.
const LEGACY = { results: 'research/results', runs: 'research/runs', models: 'research/models', datasets: 'research/datasets', system: 'systems' };

function parseHash() {
  let [page, tab] = location.hash.replace(/^#\/?/, '').split('/');
  if (LEGACY[page]) [page, tab] = LEGACY[page].split('/');
  return ROUTES.some((r) => r.id === page) ? { page, tab: tab || null } : { page: 'overview', tab: null };
}

function useReducedMotion() {
  const q = '(prefers-reduced-motion: reduce)';
  const [v, setV] = useState(() => matchMedia(q).matches);
  useEffect(() => { const m = matchMedia(q); const on = () => setV(m.matches); m.addEventListener('change', on); return () => m.removeEventListener('change', on); }, []);
  return v;
}

const API_LABEL = { online: 'Online', offline: 'Unreachable', checking: 'Checking' };
const syncedWhen = (iso) => iso ? iso.replace('T', ' ').replace('Z', ' UTC') : '—';

/* ───────────── Rail ───────────── */
function Rail({ page, go, api, onPalette }) {
  let lastGroup = null;
  return <nav className="rail" aria-label="Command Center">
    <a className="rail-brand" href="#/overview" onClick={(e) => { e.preventDefault(); go('overview'); }}>
      <Mark/><span className="rail-word">VARN</span>
    </a>
    <button className="rail-search" onClick={onPalette} aria-label="Open command menu">
      <Search size={14}/><span>Go to…</span><kbd>⌘K</kbd>
    </button>
    <ul className="rail-list">
      {ROUTES.map((r) => {
        const Icon = r.icon, on = page === r.id;
        const head = r.group !== lastGroup ? (lastGroup = r.group) : null;
        return <React.Fragment key={r.id}>
          {head && <li className="rail-group" aria-hidden="true">{head}</li>}
          <li><a href={`#/${r.id}`} className={cx('rail-item', on && 'on')} aria-current={on ? 'page' : undefined}
            onClick={(e) => { e.preventDefault(); go(r.id); }}>
            <Icon size={16} strokeWidth={1.6}/><span>{r.label}</span>{r.badge ? <em className="rail-badge">{r.badge}</em> : <kbd>{r.key}</kbd>}
          </a></li>
        </React.Fragment>;
      })}
      <li className="sky-li"><a href="#sky" className="rail-item"><Orbit size={16} strokeWidth={1.6}/><span>Sky</span></a></li>
    </ul>
    <button className="rail-status" onClick={() => go('systems')} title="API health">
      <Signal state={api.state}/>
      <span className="rail-status-text"><strong>API {API_LABEL[api.state].toLowerCase()}</strong>
        <small>{api.latency != null ? `${api.latency} ms · ` : ''}{utcTime(api.checkedAt)}</small></span>
    </button>
  </nav>;
}

/* ───────────── Inspector (contextual) ───────────── */
function SourceText({ text, highlight }) {
  const firstHit = useRef(null);
  const pre = useRef(null);
  // Scroll only the text box itself; scrollIntoView would also scroll overflow-hidden
  // ancestors (the full-screen window) and shift the whole interface.
  useEffect(() => {
    const box = pre.current, hit = firstHit.current;
    if (box) box.scrollTop = hit ? Math.max(0, hit.offsetTop - box.clientHeight / 2) : 0;
  }, [text, highlight]);
  let marked = false;
  const h = highlight?.toLowerCase();
  return <pre className="evidence" ref={pre}>{text.split('\n').map((line, i) => {
    const hit = h && line.toLowerCase().includes(h);
    const ref = hit && !marked ? (marked = true, firstHit) : undefined;
    return <span key={i} ref={ref} className={cx('ev-line', hit && 'hit')}><span className="ev-n">{i + 1}</span>{line || ' '}</span>;
  })}</pre>;
}

function Inspector({ item, onClose }) {
  const ref = useRef(null);
  useEffect(() => { ref.current?.focus({ preventScroll: true }); }, [item]);
  if (!item) return null;
  const shell = (eyebrow, title, children, mono) => <aside className="inspector glass" role="dialog" aria-label={title} tabIndex={-1} ref={ref}
    onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}>
    <header className="insp-head"><div><p className="eyebrow">{eyebrow}</p><h2 className={cx(mono && 'mono-title')}>{title}</h2></div>
      <button className="icon-btn" onClick={onClose} aria-label="Close panel"><X size={16}/></button></header>
    {children}
  </aside>;
  if (item.type === 'kaggle') {
    const k = item.kernel;
    return shell('Kaggle · auto-synced', k.ref, <>
      <dl className="facts">
        <div><dt>Status</dt><dd><Signal state={KAGGLE_TONE(k.status)}/>{KAGGLE_LABEL(k.status)}</dd></div>
        {k.error && <div><dt>Error</dt><dd className="mono">{k.error}</dd></div>}
        <div><dt>Last change</dt><dd className="mono">{syncedWhen(item.changedAt)}</dd></div>
        <div><dt>Notebook</dt><dd><a className="link" href={k.url} target="_blank" rel="noreferrer">Open on Kaggle <ArrowUpRight size={12}/></a></dd></div>
      </dl>
      <div className="insp-src"><span className="label">report.md from the run output</span><span className="mono">platform/public/data/kaggle.json</span></div>
      <SourceText text={k.report_md || 'No report.md in this run’s output.'}/>
    </>, true);
  }
  if (item.type === 'doc') {
    const d = item.doc;
    return shell(`Document · ${d.area}`, d.title, <>
      <div className="insp-src"><span className="label">Source file</span><a className="link mono" href={d.url} target="_blank" rel="noreferrer">{d.path} <ArrowUpRight size={12}/></a></div>
      <SourceText text={d.text} highlight={item.highlight}/>
    </>);
  }
  let body = null, src = item.src, title = item.title;
  if (item.type === 'model') { const m = item.model; title = m.name; src = m.src;
    body = <><p className="insp-lede">{m.summary}</p><dl className="facts">{m.facts.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl></>; }
  if (item.type === 'dataset') { const d = item.dataset; title = d.name; src = d.src;
    body = <><p className="insp-lede">{d.role}</p><dl className="facts">
      <div><dt>Images</dt><dd className="mono">{d.images.toLocaleString('en-US')}</dd></div>
      <div><dt>Instances</dt><dd className="mono">{d.instances ?? 'Not reported'}</dd></div>
      <div><dt>Classes</dt><dd>{d.classes}</dd></div>
      <div><dt>Cleaning</dt><dd>{d.note}</dd></div>
      <div><dt>Caveat</dt><dd>{d.caveat}</dd></div></dl></>; }
  return shell('Evidence', title, <>
    {body}
    <div className="insp-src"><span className="label">Source file</span><span className="mono">platform/evidence/{src}</span></div>
    <SourceText text={EVIDENCE[src] ?? ''} highlight={item.highlight}/>
  </>);
}

/* ───────────── Command menu ───────────── */
function Palette({ open, onClose, go, actions }) {
  const [q, setQ] = useState('');
  const [i, setI] = useState(0);
  const input = useRef(null);
  const items = useMemo(() => [
    ...ROUTES.flatMap((r) => [
      { id: r.id, label: r.label, hint: `${r.group} · ${r.key}`, icon: r.icon, run: () => go(r.id) },
      ...(r.tabs || []).map(([t, l]) => ({ id: `${r.id}/${t}`, label: `${r.label} › ${l}`, hint: r.group, icon: r.icon, run: () => go(`${r.id}/${t}`) })),
    ]),
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
  const [route, setRoute] = useState(parseHash);
  const [api, check] = useApiHealth();
  const kaggle = useKaggleSync();
  const [gh, reloadGh] = useGitHub();
  const [site, checkSite] = useSiteCheck();
  const store = useRecords();
  const [inspect, setInspect] = useState(null);
  const [palette, setPalette] = useState(false);
  const [earth, setEarth] = useState('loading');
  const [view, setView] = useState(null);
  const [grid, setGrid] = useState(() => { try { return localStorage.getItem('varn.cc.grid') !== '0'; } catch { return true; } });
  const reduced = useReducedMotion();
  const { page, tab } = route;
  const current = ROUTES.find((r) => r.id === page);

  useEffect(() => { try { localStorage.setItem('varn.cc.grid', grid ? '1' : '0'); } catch { /* storage unavailable */ } }, [grid]);
  useEffect(() => { const on = () => setRoute(parseHash()); addEventListener('hashchange', on); return () => removeEventListener('hashchange', on); }, []);
  useEffect(() => { document.title = `${current.label} · VARN`; }, [current]);

  const go = useCallback((path) => {
    setInspect(null);
    if (location.hash !== `#/${path}`) location.hash = `/${path}`;
    const [p, t] = path.split('/');
    setRoute({ page: p, tab: t || null });
  }, []);
  const setTab = useCallback((t) => go(`${page}/${t}`), [go, page]);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPalette((v) => !v); return; }
      if (e.target.closest('input, textarea, select, [contenteditable]') || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'Escape') { setInspect(null); return; }
      const r = ROUTES.find((x) => x.key === e.key); if (r && !palette) go(r.id);
    };
    addEventListener('keydown', onKey); return () => removeEventListener('keydown', onKey);
  }, [go, palette]);

  const actions = useMemo(() => [
    { id: 'check', label: 'Check all systems', hint: 'Action', icon: RefreshCw, run: () => { check(); checkSite(); reloadGh(); } },
    { id: 'export', label: 'Export my records (JSON)', hint: 'Action', icon: Download, run: () => exportRecords(store.db) },
    { id: 'grid', label: grid ? 'Hide graticule' : 'Show graticule', hint: 'Action', icon: Grid3x3, run: () => setGrid((g) => !g) },
    { id: 'sky', label: 'Open Sky view', hint: 'Separate view', icon: Orbit, run: () => { location.hash = 'sky'; } },
  ], [check, checkSite, reloadGh, store.db, grid]);

  const mode = page === 'overview' ? 'overview' : inspect ? 'inspect' : 'work';
  const props = { go, open: setInspect, tab, setTab, store, gh, api, kaggle, site };
  const body = {
    overview: <Overview {...props} db={store.db}/>,
    projects: <Projects {...props}/>,
    research: <Research {...props} sync={kaggle}/>,
    business: <Business {...props}/>,
    systems: <Systems {...props} check={check} checkSite={checkSite} reloadGh={reloadGh} earth={earth}/>,
    assistant: <Assistant {...props}/>,
  }[page];

  return <div className={cx('cc', `mode-${mode}`, `page-${page}`, `earth-${earth}`)}>
    <div className="earth-layer">
      {earth !== 'unsupported' && <Earth mode={mode} grid={grid} reducedMotion={reduced} onStatus={setEarth} onView={setView}/>}
      <div className="earth-fallback" aria-hidden="true"/>
      <div className="earth-shade" aria-hidden="true"/>
    </div>

    <div className="window">
      <Rail page={page} go={go} api={api} onPalette={() => setPalette(true)}/>
      <div className="pane">
        <div className="fog" aria-hidden="true"/>
        <header className="pane-bar">
          <p className="crumb"><span>{current.group}</span><i>/</i><strong>{current.label}</strong>
            {tab && current.tabs && <><i>/</i><span>{current.tabs.find(([t]) => t === tab)?.[1]}</span></>}</p>
          <div className="pills">
            <button className={cx('pill', grid && 'on')} onClick={() => setGrid(!grid)} aria-pressed={grid} title="Show the 15° graticule on the planet"><Grid3x3 size={13}/>Graticule</button>
            <a className="pill" href="#sky"><Orbit size={13}/>Sky view<ArrowUpRight size={12}/></a>
          </div>
        </header>
        <main className="stage" key={page}>{body}</main>
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
