import React, { useMemo } from 'react';
import { ArrowUpRight, CircleAlert, CircleDot, Info, GitCommitHorizontal, Scale, RefreshCw } from 'lucide-react';
import { Panel, Signal, Bar, cx } from '../ui.jsx';
import { attention, nextUp } from '../data/attention.js';
import { plan } from '../data/repo.js';
import { bestVerified } from '../records.js';
import { ago, runTone } from '../data/live.js';

const TONE_ICON = { alert: CircleAlert, warn: CircleDot, info: Info };

function Item({ it, go }) {
  const Icon = TONE_ICON[it.tone] || Info;
  const body = <><Icon size={15} className={`tone-${it.tone}`}/><span className="att-main"><strong>{it.title}</strong><small>{it.detail}</small></span><span className="att-src">{it.src}</span></>;
  return it.href
    ? <a className="att" href={it.href} target="_blank" rel="noreferrer">{body}</a>
    : <button className="att" onClick={() => it.to && go(it.to)}>{body}</button>;
}

export default function Overview({ go, api, gh, kaggle, site, db }) {
  const items = useMemo(() => attention({ api, gh, kaggle, site, db }), [api, gh, kaggle, site, db]);
  const next = useMemo(() => nextUp({ db, gh }), [db, gh]);
  const urgent = items.filter((i) => i.tone !== 'info').length;
  const openTasks = db.tasks.filter((t) => t.status !== 'done');
  const msDone = plan.milestone.items.filter((i) => i.done).length;
  const checks = [api.state === 'online', site.state === 'online', ...gh.latest.map((r) => runTone(r) === 'online')];
  const green = checks.filter(Boolean).length;
  const feed = useMemo(() => [
    ...plan.decisions.map((d) => ({ at: d.date, kind: 'Decision', icon: Scale, text: d.decision, href: null, to: 'projects' })),
    ...gh.commits.slice(0, 8).map((c) => ({ at: c.at, kind: 'Commit', icon: GitCommitHorizontal, text: c.message, href: c.url })),
    ...(kaggle.data?.changed_at ? [{ at: kaggle.data.changed_at, kind: 'Kaggle', icon: RefreshCw, text: `Notebook status changed: ${kaggle.data.kernels.map((k) => `${k.ref.split('/')[1]} ${k.status.toLowerCase()}`).join(', ')}`, to: 'research/runs' }] : []),
  ].sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, 9), [gh.commits, kaggle.data]);
  const dateStr = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  return <div className="overview">
    <header className="ov-head enter">
      <p className="eyebrow"><span>Command</span><i/>{dateStr}</p>
      <h1 className="display">VARN today</h1>
      <p className="ov-sum">
        <b className={cx(urgent ? 'tone-alert' : 'tone-ok')}>{urgent ? `${urgent} need${urgent === 1 ? 's' : ''} attention` : 'Nothing urgent'}</b>
        <i/>Phase {plan.current.n} of {plan.phases.length}: {plan.current.title}
        <i/>{openTasks.length} open task{openTasks.length === 1 ? '' : 's'}{gh.issues.length ? ` · ${gh.issues.length} GitHub issue${gh.issues.length === 1 ? '' : 's'}` : ''}
      </p>
    </header>

    {next.length > 0 && <section className="next enter" style={{ '--d': '60ms' }} aria-label="Next up">
      <span className="label">Next up</span>
      {next.map((n, i) => {
        const inner = <><span className="next-n mono">{i + 1}</span><span className="next-main"><strong>{n.title}</strong><small>{n.why} · {n.src}</small></span><ArrowUpRight size={14}/></>;
        return n.href ? <a key={i} className="next-item" href={n.href} target="_blank" rel="noreferrer">{inner}</a> : <button key={i} className="next-item" onClick={() => go(n.to)}>{inner}</button>;
      })}
    </section>}

    <div className="ov-grid">
      <Panel title="Needs attention" meta={`${items.length} item${items.length === 1 ? '' : 's'}`} className="span-5 enter" style={{ '--d': '100ms' }}>
        <div className="att-list">{items.map((it, i) => <Item key={i} it={it} go={go}/>)}</div>
      </Panel>

      <Panel title="Key metrics" className="span-7 enter" style={{ '--d': '140ms' }}>
        <div className="metrics">
          <button className="metric" onClick={() => go('research')}>
            <span className="label">Best verified</span>
            <span className="metric-v">{bestVerified.metric.toFixed(3)}<em>mAP50</em></span>
            <span className="metric-d">v3 (.pt) · Roboflow clean validation</span>
          </button>
          <button className="metric" onClick={() => go('projects')}>
            <span className="label">Roadmap</span>
            <span className="metric-v">{plan.current.n}<em>of {plan.phases.length}</em></span>
            <span className="metric-d">{plan.current.title}</span>
          </button>
          <button className="metric" onClick={() => go('projects')}>
            <span className="label">Milestone</span>
            <span className="metric-v">{msDone}<em>/ {plan.milestone.items.length} steps</em></span>
            <Bar value={msDone / Math.max(1, plan.milestone.items.length)}/>
            <span className="metric-d">{plan.milestone.title}</span>
          </button>
          <button className="metric" onClick={() => go('systems')}>
            <span className="label">Systems</span>
            <span className="metric-v">{green}<em>/ {checks.length} healthy</em></span>
            <span className="metric-d">API, website and latest CI runs on main</span>
          </button>
        </div>
      </Panel>

      <Panel title="Active projects" meta={`From ${plan.path}`} className="span-7 enter" style={{ '--d': '180ms' }}
        action={<button className="link-btn" onClick={() => go('projects')}>Open projects <ArrowUpRight size={13}/></button>}>
        <div className="tracks">{plan.tracks.map((t) => {
          const mine = openTasks.filter((x) => x.project === `track-${t.id}`).length;
          return <button key={t.id} className="track-row" onClick={() => go('projects')}>
            <span className="track-id mono">{t.id}</span>
            <span className="track-main"><strong>{t.title}</strong><small>{t.target}</small></span>
            <span className="track-meta mono">{mine ? `${mine} open` : `${t.items.length} steps`}</span>
          </button>;
        })}</div>
      </Panel>

      <Panel title="Updates" meta="Decisions, commits, syncs" className="span-5 enter" style={{ '--d': '220ms' }}>
        <ol className="feed">{feed.map((f, i) => {
          const Icon = f.icon;
          const inner = <><Icon size={14}/><span className="feed-main"><strong>{f.text}</strong><small>{f.kind} · {f.at.length <= 10 ? f.at : ago(f.at)}</small></span></>;
          return <li key={i}>{f.href ? <a href={f.href} target="_blank" rel="noreferrer">{inner}</a> : <button onClick={() => f.to && go(f.to)}>{inner}</button>}</li>;
        })}{!feed.length && <li className="muted">Loading…</li>}</ol>
      </Panel>
    </div>
  </div>;
}
