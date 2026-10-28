import React from 'react';
import { ArrowUpRight } from 'lucide-react';
import { Sheet, Signal, Bar, Tabs, cx } from '../ui.jsx';
import { caveats } from '../results.js';
import { models, datasets, roboflow, birdDrone, runs } from '../records.js';
import { KAGGLE_TONE, KAGGLE_LABEL } from '../data/live.js';

const syncedWhen = (iso) => iso ? iso.replace('T', ' ').replace('Z', ' UTC') : '—';
export const RESEARCH_TABS = [['results', 'Results'], ['runs', 'Runs'], ['models', 'Models'], ['datasets', 'Datasets']];

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
  return <>
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
  </>;
}

export function KaggleBlock({ sync, open }) {
  return <div className="block kaggle">
    <div className="block-head"><h2>Kaggle notebooks</h2><span className="label">{sync.state === 'ready' ? `Changed ${syncedWhen(sync.data.changed_at)}` : 'Auto-synced'}</span></div>
    <p className="block-note">Status and report straight from the Kaggle API, synced every 6 hours by a GitHub Action. Not hand-checked; the Results tables are.</p>
    {sync.state === 'ready' ? <div className="kernels">{sync.data.kernels.map((k) => <button key={k.ref} className="kernel" onClick={() => open({ type: 'kaggle', kernel: k, changedAt: sync.data.changed_at })}>
      <span className="mono kernel-ref">{k.ref}</span>
      <span className={cx('chip', k.status === 'COMPLETE' && 'ok', /UNREACHABLE|ERROR/.test(k.status) && 'offline')}><Signal state={KAGGLE_TONE(k.status)}/>{KAGGLE_LABEL(k.status)}</span>
      <span className="kernel-note">{k.error ? `Kaggle said: ${k.error}` : k.report_md ? 'Report available' : 'No report in output'}</span>
      <ArrowUpRight size={15} className="card-arrow"/>
    </button>)}</div>
      : <p className="empty-line">{sync.state === 'loading' ? 'Loading…' : sync.state === 'error' ? 'The synced file could not be read.' : 'Not synced yet. Run “Kaggle sync” once from the repository’s Actions tab.'}</p>}
  </div>;
}

function Runs({ open, sync }) {
  return <>
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
  </>;
}

function Models({ open }) {
  return <>
    <p className="block-note" style={{ marginTop: 26 }}>Models named in the evidence. There is no model registry yet; this list is read from the reports.</p>
    <div className="cards">{models.map((m) => <button key={m.id} className="card" onClick={() => open({ type: 'model', model: m })}>
      <span className="card-top"><span className={cx('chip', m.tone)}><Signal state={m.tone === 'ok' ? 'online' : m.tone === 'pending' ? 'checking' : 'idle'}/>{m.status}</span><ArrowUpRight size={15} className="card-arrow"/></span>
      <strong className="card-title">{m.name}</strong>
      {m.detail && <span className="mono card-sub">{m.detail}</span>}
      <span className="card-body">{m.summary}</span>
      <dl className="card-facts">{m.facts.slice(-2).map(([k, v]) => <div key={k}><dt>{k}</dt><dd className="mono">{v.split(' · ')[0].split(' (')[0]}</dd></div>)}</dl>
    </button>)}</div>
  </>;
}

function Datasets({ open }) {
  return <>
    <p className="block-note" style={{ marginTop: 26 }}>Sets the reports evaluated or trained on. Counts are as reported, after near-duplicate removal.</p>
    <table className="table datasets">
      <thead><tr><th>Dataset</th><th>Role</th><th className="num">Images</th><th className="num">Instances</th><th>Classes</th></tr></thead>
      <tbody>{datasets.map((d) => <tr key={d.id} tabIndex={0} onClick={() => open({ type: 'dataset', dataset: d })} onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.click(); }}>
        <td><strong>{d.name}</strong></td><td className="muted">{d.role}</td>
        <td className="num mono">{d.images.toLocaleString('en-US')}</td><td className="num mono">{d.instances ?? '—'}</td><td className="muted">{d.classes}</td>
      </tr>)}</tbody>
    </table>
  </>;
}

export default function Research({ tab, setTab, open, sync }) {
  const t = RESEARCH_TABS.some(([id]) => id === tab) ? tab : 'results';
  return <Sheet eyebrow="Operations / Research" title="Research"
    desc="Detection models, datasets and evaluation runs. Numbers are hand-copied from Kaggle reports; select any row to read its source."
    aside={t === 'results' ? <div className="callout"><strong>Read each table on its own.</strong> Scores compare only within a table: same test set, the model named on the row.</div> : null}
    tabs={<Tabs label="Research" value={t} onChange={setTab} items={RESEARCH_TABS.map(([id, l]) => [id, l, id === 'runs' ? runs.length : id === 'models' ? models.length : id === 'datasets' ? datasets.length : null])}/>}>
    {t === 'results' && <Results open={open}/>}
    {t === 'runs' && <Runs open={open} sync={sync}/>}
    {t === 'models' && <Models open={open}/>}
    {t === 'datasets' && <Datasets open={open}/>}
  </Sheet>;
}
