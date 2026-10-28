import React from 'react';
import { ArrowUpRight, RefreshCw } from 'lucide-react';
import { Sheet, Signal, Empty, cx } from '../ui.jsx';
import { API_URL, SITE_URL, ago, runTone, runLabel, KAGGLE_TONE, KAGGLE_LABEL } from '../data/live.js';

const API_LABEL = { online: 'Online', offline: 'Unreachable', checking: 'Checking' };
/* global __BUILD__ */
const BUILD = typeof __BUILD__ !== 'undefined' ? __BUILD__ : { sha: null, at: null };

function Tile({ label, state, value, detail }) {
  return <div className="sys-tile"><span className="label">{label}</span><span className="sys-v"><Signal state={state}/>{value}</span><small>{detail}</small></div>;
}

export default function Systems({ api, check, site, checkSite, gh, reloadGh, kaggle, earth }) {
  const failing = gh.latest.filter((r) => runTone(r) === 'offline');
  const failures = gh.runs.filter((r) => r.status === 'completed' && r.conclusion === 'failure').slice(0, 6);
  const kErr = (kaggle.data?.kernels || []).filter((k) => /ERROR|UNREACHABLE/.test(k.status));
  return <Sheet eyebrow="Technical / Systems" title="Systems"
    desc="Website health, deployments, errors and infrastructure, checked from this browser right now. Nothing on this page is assumed."
    aside={<button className="btn ghost sm" onClick={() => { check(); checkSite(); reloadGh(); }}><RefreshCw size={13}/>Check everything</button>}>
    <div className="sys-tiles">
      <Tile label="Platform API" state={api.state} value={API_LABEL[api.state]} detail={api.latency != null ? `${api.latency} ms round trip` : api.error || '—'}/>
      <Tile label="tryvarn.com" state={site.state} value={site.state === 'online' ? 'Reachable' : site.state === 'offline' ? 'Unreachable' : 'Checking'} detail={site.ms != null ? `${site.ms} ms · status not readable cross-origin` : '—'}/>
      <Tile label="CI on main" state={gh.state !== 'ready' ? (gh.state === 'loading' ? 'checking' : 'idle') : failing.length ? 'offline' : 'online'}
        value={gh.state !== 'ready' ? (gh.state === 'loading' ? 'Loading' : 'Unavailable') : failing.length ? `${failing.length} failing` : 'All passing'} detail={`${gh.latest.length} workflows · latest run each`}/>
      <Tile label="Kaggle sync" state={kaggle.state !== 'ready' ? 'idle' : kErr.length ? 'offline' : 'online'} value={kaggle.state !== 'ready' ? 'Not synced' : kErr.length ? `${kErr.length} unreachable` : 'OK'}
        detail={kaggle.data?.changed_at ? `last change ${ago(kaggle.data.changed_at)}` : 'Runs every 6 h'}/>
    </div>

    <div className="sys-grid">
      <div className="sys-panel">
        <div className="block-head"><h2>Workflows</h2><a className="link-btn" href="https://github.com/bsalsa2/varn/actions" target="_blank" rel="noreferrer">Actions <ArrowUpRight size={12}/></a></div>
        {gh.state === 'ready' ? <ul className="rows">{gh.latest.map((r) => <li key={r.id}><a href={r.url} target="_blank" rel="noreferrer">
          <Signal state={runTone(r)}/><span className="row-main"><strong>{r.name}</strong><small>{runLabel(r)} · {r.event} · {r.sha} · {ago(r.at)}</small></span><ArrowUpRight size={13}/></a></li>)}</ul>
          : <p className="empty-line">{gh.state === 'loading' ? 'Loading from GitHub…' : gh.error}</p>}
        <div className="block-head" style={{ marginTop: 26 }}><h2>Recent failures</h2><span className="label">Last 50 runs, all branches</span></div>
        {failures.length ? <ul className="rows">{failures.map((r) => <li key={r.id}><a href={r.url} target="_blank" rel="noreferrer">
          <Signal state="offline"/><span className="row-main"><strong>{r.name}</strong><small>{r.branch} · {r.title} · {ago(r.at)}</small></span><ArrowUpRight size={13}/></a></li>)}</ul>
          : gh.state === 'ready' ? <Empty title="No failed runs in the last 50"/> : null}
      </div>

      <div className="sys-panel">
        <div className="block-head"><h2>Deployments</h2><span className="label">Each push to main</span></div>
        <p className="block-note">Cloudflare Pages builds this Command Center from every commit to main. Build logs need a Cloudflare token, so they are not shown; the commits are.</p>
        <dl className="facts">
          <div><dt>This build</dt><dd className="mono">{BUILD.sha ? `${BUILD.sha.slice(0, 7)} · ${BUILD.at?.slice(0, 16).replace('T', ' ')} UTC` : 'Local build'}</dd></div>
        </dl>
        {gh.state === 'ready' && <ul className="rows">{gh.commits.slice(0, 7).map((c) => <li key={c.sha}><a href={c.url} target="_blank" rel="noreferrer">
          <span className={cx('mono row-k', BUILD.sha?.startsWith(c.sha) && 'live')}>{c.sha}</span><span className="row-main"><strong>{c.message}</strong><small>{c.author} · {ago(c.at)}{BUILD.sha?.startsWith(c.sha) ? ' · serving now' : ''}</small></span><ArrowUpRight size={13}/></a></li>)}</ul>}

        <div className="block-head" style={{ marginTop: 26 }}><h2>Platform API</h2><button className="btn ghost sm" onClick={check} disabled={api.busy}><RefreshCw size={13} className={api.busy ? 'spin' : ''}/>Check</button></div>
        <dl className="facts">
          <div><dt>Endpoint</dt><dd className="mono">{API_URL.replace('https://', '')}/health</dd></div>
          <div><dt>Last checked</dt><dd className="mono">{api.checkedAt ? api.checkedAt.toISOString().replace('T', ' ').slice(0, 19) + ' UTC' : '—'}</dd></div>
        </dl>
        <pre className="raw" aria-label="Raw response">{api.body ? JSON.stringify(api.body, null, 2) : '// no response body'}</pre>

        <div className="block-head" style={{ marginTop: 26 }}><h2>Connections</h2></div>
        <ul className="conn">
          {(kaggle.data?.kernels || []).map((k) => <li key={k.ref}><span><strong className="mono">{k.ref}</strong><small>{k.error || 'Kaggle notebook'}</small></span><span className={cx('chip', k.status === 'COMPLETE' && 'ok', /ERROR|UNREACHABLE/.test(k.status) && 'offline')}><Signal state={KAGGLE_TONE(k.status)}/>{KAGGLE_LABEL(k.status)}</span></li>)}
          <li><span><strong>Website</strong><small className="mono">{SITE_URL}</small></span><span className="chip"><Signal state={site.state}/>{site.state === 'online' ? 'Reachable' : site.state}</span></li>
          <li><span><strong>Object storage</strong><small>Model artifacts and dataset files</small></span><span className="chip"><Signal state="idle"/>Not configured</span></li>
          <li><span><strong>Earth imagery</strong><small>NASA Blue Marble, rendered in WebGL 2</small></span><span className="chip"><Signal state={earth === 'ready' ? 'online' : earth === 'loading' ? 'checking' : 'idle'}/>{{ ready: 'Loaded', loading: 'Loading', failed: 'Failed', unsupported: 'Static fallback' }[earth]}</span></li>
        </ul>
      </div>
    </div>
  </Sheet>;
}
