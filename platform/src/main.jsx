import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Activity, AlertTriangle, ArrowDownRight, ArrowUpRight, Bell, Boxes,
  Check, ChevronDown, CircleHelp, Command, Database, ExternalLink,
  Eye, Gauge, GitBranch, HardDrive, Layers3, LayoutDashboard, Menu,
  MoreHorizontal, Network, RadioTower, RefreshCw, Search, Settings2,
  ShieldCheck, SlidersHorizontal, Sparkles, Workflow, X
} from 'lucide-react';
import './styles.css';

const API_URL = 'https://varn-api.varnlabs.workers.dev';
const navGroups = [
  { label: 'WORK', items: [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'activity', label: 'Activity log', icon: Activity },
  ]},
  { label: 'RESEARCH', items: [
    { id: 'models', label: 'Models', icon: Layers3 },
    { id: 'experiments', label: 'Experiments', icon: Workflow },
    { id: 'datasets', label: 'Datasets', icon: Database },
  ]},
  { label: 'PLATFORM', items: [
    { id: 'integrations', label: 'Integrations', icon: Network },
    { id: 'infrastructure', label: 'Infrastructure', icon: Gauge },
  ]},
];

function BrandMark() {
  return <div className="brand-mark" aria-hidden="true"><svg viewBox="0 0 42 42"><path d="M7 31 17.2 9h7.5L35 31h-8.1l-6-13.1L14.8 31Z" fill="currentColor"/><path d="M17.2 25.2h9.1l2.2 5.8H14.8Z" fill="#111315"/></svg></div>;
}

function StatusDot({ tone = 'muted' }) { return <span className={`status-dot ${tone}`} />; }

function EmptyState({ icon: Icon = Boxes, title, body, action }) {
  return <div className="empty-state"><div className="empty-icon"><Icon size={21}/></div><h3>{title}</h3><p>{body}</p>{action && <button className="button secondary" onClick={action.onClick}>{action.label}</button>}</div>;
}

function Overview({ apiState, onCheckApi, apiChecking, onNavigate }) {
  const workspaces = [
    { id: 'models', name: 'Models', description: 'Artifacts, versions, and provenance', count: '0' },
    { id: 'experiments', name: 'Experiments', description: 'Evaluation runs and comparisons', count: '0' },
    { id: 'datasets', name: 'Datasets', description: 'Sources, versions, and quality', count: '0' },
  ];
  return <div className="research-home">
    <section className="research-intro">
      <div>
        <div className="eyebrow"><span className="eyebrow-line"/> VARN / RESEARCH</div>
        <h1>Research workspace</h1>
        <p>Models, data, and evaluations. One place to keep the work traceable.</p>
      </div>
      <div className="connection-brief">
        <span className="connection-brief-label">API</span>
        <span className="connection-brief-state"><StatusDot tone={apiState === 'online' ? 'green' : apiState === 'offline' ? 'red' : 'muted'}/>{apiState === 'online' ? 'Connected' : apiState === 'offline' ? 'Unavailable' : 'Checking'}</span>
        <button className="text-button" onClick={onCheckApi} disabled={apiChecking}>{apiChecking ? 'Checking…' : 'Check connection'}</button>
      </div>
    </section>

    <section className="workspace-section">
      <div className="plain-section-heading"><h2>Workspace</h2><span>0 records</span></div>
      <div className="workspace-list">
        {workspaces.map((item,index)=><button className="workspace-row" key={item.id} onClick={()=>onNavigate(item.id)}>
          <span className="workspace-row-index">0{index+1}</span>
          <span className="workspace-row-main"><strong>{item.name}</strong><small>{item.description}</small></span>
          <span className="workspace-row-count">{item.count}</span>
          <span className="workspace-row-state">Empty</span>
          <span className="workspace-row-arrow">↗</span>
        </button>)}
      </div>
    </section>

    <section className="lower-workspace">
      <div className="lower-section">
        <div className="plain-section-heading"><h2>Connections</h2><button className="text-button" onClick={()=>onNavigate('integrations')}>Manage</button></div>
        <div className="connection-row"><span className="connection-symbol">↗</span><span className="connection-name"><strong>VARN API</strong><small>Platform status endpoint</small></span><span className="connection-state"><StatusDot tone={apiState === 'online' ? 'green' : apiState === 'offline' ? 'red' : 'muted'}/>{apiState === 'online' ? 'Connected' : apiState === 'offline' ? 'Unavailable' : 'Checking'}</span></div>
        <div className="connection-row"><span className="connection-symbol">↳</span><span className="connection-name"><strong>Kaggle</strong><small>Training and notebooks</small></span><span className="connection-state"><StatusDot/>Not connected</span></div>
      </div>
      <div className="lower-section activity-plain">
        <div className="plain-section-heading"><h2>Recent activity</h2><button className="text-button" onClick={()=>onNavigate('activity')}>Open log ↗</button></div>
        <p>No activity yet.</p>
        <small>Recorded imports, model changes, and evaluation runs will appear here.</small>
      </div>
    </section>
    <div className="research-footnote">Early research build <span>·</span> Empty states reflect missing records, not successful evaluations.</div>
  </div>;
}

function Metric({ icon: Icon, label, value, sub, tone }) {
  return <div className="metric-card"><div className="metric-top"><div className="metric-icon"><Icon size={16}/></div><span className="metric-label">{label}</span><MoreHorizontal size={17} className="muted-icon"/></div><div className={`metric-value ${tone}`}>{value}</div><div className="metric-sub"><span className="sub-line"/>{sub}</div></div>;
}

function ServiceRow({ icon: Icon, name, detail, status }) {
  const label = status === 'online' ? 'ONLINE' : status === 'offline' ? 'OFFLINE' : status === 'pending' ? 'PENDING' : 'UNKNOWN';
  return <div className="service-row"><div className="service-icon"><Icon size={16}/></div><div className="service-text"><strong>{name}</strong><span>{detail}</span></div><span className={`status-label ${status}`}><StatusDot tone={status === 'online' ? 'green' : status === 'offline' ? 'red' : 'muted'}/>{label}</span></div>;
}

function SectionPage({ page, onNavigate }) {
  const config = {
    activity: { kicker:'COMMAND / LOGS', title:'Activity log', desc:'A chronological record of platform events and research activity.', icon:Activity, empty:'No activity recorded', body:'Events will appear when connected systems begin reporting real activity.' },
    models: { kicker:'INTELLIGENCE / REGISTRY', title:'Model registry', desc:'Track model artifacts, versions, provenance, and evaluation status.', icon:Layers3, empty:'Your registry is empty', body:'Register a model artifact to start tracking versions and evidence. No models have been added yet.' },
    experiments: { kicker:'INTELLIGENCE / EVALUATION', title:'Experiments', desc:'Compare controlled runs with reproducible configurations and honest results.', icon:Workflow, empty:'No experiments yet', body:'Evaluation runs will appear here when a real training or evaluation pipeline is connected.' },
    datasets: { kicker:'INTELLIGENCE / DATA', title:'Datasets', desc:'Keep datasets, versions, sources, and quality checks organized.', icon:Database, empty:'No datasets registered', body:'Dataset records will be listed here after a source is connected or a dataset is added.' },
    integrations: { kicker:'SYSTEMS / CONNECTIONS', title:'Integrations', desc:'Connect the tools and sources that power VARN research.', icon:Network, empty:'No integrations connected', body:'Connections are not configured yet. Nothing is connected automatically.' },
    infrastructure: { kicker:'SYSTEMS / HEALTH', title:'Infrastructure', desc:'Understand service health, storage, deployment, and runtime configuration.', icon:Gauge, empty:'Infrastructure telemetry unavailable', body:'Only the basic API health endpoint exists today. Other services will show up when implemented.' },
  }[page];
  const Icon = config.icon;
  return <div className="section-page">
    <div className="eyebrow"><span className="eyebrow-line"/>{config.kicker}</div>
    <div className="page-title-row"><div><h1>{config.title}</h1><p>{config.desc}</p></div><div className="page-title-icon"><Icon size={24}/></div></div>
    {page === 'integrations' && <div className="integration-grid">
      <IntegrationCard icon={GitBranch} name="Kaggle" detail="Model training and notebooks" status="Not connected" />
      <IntegrationCard icon={ShieldCheck} name="VARN API" detail="Platform status and service health" status="Basic endpoint available" />
      <IntegrationCard icon={Database} name="Object storage" detail="Model artifacts and dataset files" status="Not configured" />
    </div>}
    <section className="panel page-empty-panel"><EmptyState icon={Icon} title={config.empty} body={config.body} action={page === 'integrations' ? {label:'Check API status',onClick:()=>onNavigate('overview')} : undefined}/></section>
    <div className="honesty-note"><ShieldCheck size={16}/><span><strong>Evidence-first by design.</strong> This workspace does not invent metrics, model versions, event history, or service health.</span></div>
  </div>;
}

function IntegrationCard({icon: Icon,name,detail,status}) {
  return <div className="integration-card"><div className="integration-card-top"><div className="metric-icon"><Icon size={17}/></div><span className="status-label pending"><StatusDot/>NOT CONNECTED</span></div><h3>{name}</h3><p>{detail}</p><div className="integration-status">{status}</div></div>;
}

function App() {
  const [page, setPage] = useState('overview');
  const [apiState, setApiState] = useState('unknown');
  const [apiChecking, setApiChecking] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');

  async function checkApi() {
    setApiChecking(true);
    try {
      const response = await fetch(`${API_URL}/health`, { method: 'GET', cache: 'no-store' });
      if (!response.ok) throw new Error('API returned a non-success status');
      const data = await response.json();
      setApiState(data?.ok === true ? 'online' : 'offline');
    } catch {
      setApiState('offline');
    } finally {
      setApiChecking(false);
    }
  }

  useEffect(() => { checkApi(); }, []);

  const currentTitle = [...navGroups.flatMap(g => g.items)].find(item => item.id === page)?.label ?? 'Overview';
  const choosePage = (id) => { setPage(id); setMobileOpen(false); setQuery(''); setSearchOpen(false); };
  const filteredNav = navGroups.map(group => ({...group, items: group.items.filter(item => item.label.toLowerCase().includes(query.toLowerCase()))})).filter(group => group.items.length);

  return <div className="app-shell">
    {mobileOpen && <button className="mobile-scrim" aria-label="Close menu" onClick={()=>setMobileOpen(false)}/>}
    <aside className={`sidebar ${mobileOpen ? 'mobile-open' : ''}`}>
      <div className="brand-lockup"><BrandMark/><div><span className="brand-name">VARN</span><span className="brand-subtitle">SYSTEMS PLATFORM</span></div><button className="mobile-close icon-button" aria-label="Close menu" onClick={()=>setMobileOpen(false)}><X size={18}/></button></div>
      <div className="sidebar-caption">Research workspace <span>·</span> Early build</div>
      <nav className="main-nav" aria-label="Main navigation">
        {filteredNav.map(group=><div className="nav-group" key={group.label}><div className="nav-group-label">{group.label}</div>{group.items.map(item=>{const Icon=item.icon;return <button key={item.id} className={`nav-item ${page===item.id?'active':''}`} onClick={()=>choosePage(item.id)}><Icon size={17} strokeWidth={1.8}/><span>{item.label}</span>{item.id==='activity'&&<span className="nav-count">0</span>}</button>})}</div>)}
        {filteredNav.length===0&&<div className="nav-no-results">No sections match “{query}”.</div>}
      </nav>
      <div className="sidebar-bottom">
        <div className="sidebar-status-simple"><StatusDot tone={apiState==='online'?'green':apiState==='offline'?'red':'muted'}/><span>API {apiState==='online'?'connected':apiState==='offline'?'unavailable':'checking'}</span><button onClick={checkApi} aria-label="Refresh API status" title="Refresh API status"><RefreshCw size={12} className={apiChecking?'spin':''}/></button></div>
      </div>
    </aside>

    <main className="main-area">
      <header className="topbar">
        <div className="topbar-left"><button className="mobile-menu icon-button" aria-label="Open menu" onClick={()=>setMobileOpen(true)}><Menu size={19}/></button><div className="breadcrumb"><span>VARN</span><span className="crumb-sep">/</span><strong>{currentTitle}</strong></div><span className="environment-pill"><span/>DEV</span></div>
        <div className="topbar-actions">
          <a className="source-link" href="https://github.com/bsalsa2/varn" target="_blank" rel="noreferrer">Source ↗</a>
        </div>
      </header>
      <div className="page-content">
        {page==='overview' ? <Overview apiState={apiState} onCheckApi={checkApi} apiChecking={apiChecking} onNavigate={choosePage}/> : <SectionPage page={page} onNavigate={choosePage}/>}
        <footer className="footer"><span>VARN SYSTEMS PLATFORM <span className="footer-dot">·</span> EARLY ACCESS</span><span>BUILD 0.1.0 <span className="footer-dot">·</span> <a href="https://github.com/bsalsa2/varn" target="_blank" rel="noreferrer">SOURCE <ExternalLink size={10}/></a></span></footer>
      </div>
    </main>
  </div>;
}

createRoot(document.getElementById('root')).render(<App/>);
