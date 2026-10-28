import React, { useState } from 'react';
import { ArrowUpRight, Check, Trash2, Download } from 'lucide-react';
import { Sheet, Tabs, QuickForm, Empty, Signal, cx } from '../ui.jsx';
import { plan, blobUrl } from '../data/repo.js';
import { daysUntil } from '../data/store.js';
import { ago } from '../data/live.js';

const PROJECTS = [['general', 'General'], ...plan.tracks.map((t) => [`track-${t.id}`, `Track ${t.id} · ${t.title}`])];
const projectName = (id) => PROJECTS.find(([k]) => k === id)?.[1] ?? 'General';

function dueText(due, done) {
  if (!due) return null;
  const d = daysUntil(due);
  if (done) return <span className="due">{due}</span>;
  if (d < 0) return <span className="due overdue">{due} · {-d} d overdue</span>;
  if (d === 0) return <span className="due soon">Today</span>;
  if (d <= 7) return <span className="due soon">{due} · in {d} d</span>;
  return <span className="due">{due}</span>;
}

function Tasks({ store }) {
  const { db, add, addMany, update, remove } = store;
  const [show, setShow] = useState('open');
  const tasks = [...db.tasks].sort((a, b) => (a.status === 'done') - (b.status === 'done') || (a.due || '9999').localeCompare(b.due || '9999'));
  const list = tasks.filter((t) => show === 'all' || (show === 'open' ? t.status !== 'done' : t.status === 'done'));
  const imported = new Set(db.tasks.filter((t) => t.source === plan.path).map((t) => t.title));
  const missing = plan.milestone.items.filter((i) => !imported.has(i.text));
  return <div className="block">
    <div className="block-head"><h2>Your tasks</h2>
      <Tabs label="Task filter" value={show} onChange={setShow} items={[['open', 'Open', db.tasks.filter((t) => t.status !== 'done').length], ['done', 'Done', db.tasks.filter((t) => t.status === 'done').length], ['all', 'All']]}/>
    </div>
    <QuickForm onSubmit={(d) => add('tasks', { title: d.title.trim(), project: d.project, due: d.due || null, priority: d.priority, status: 'todo' })} fields={[
      { name: 'title', label: 'Task', placeholder: 'What needs to happen next?', wide: true },
      { name: 'project', label: 'Project', options: PROJECTS },
      { name: 'due', label: 'Due', type: 'date' },
      { name: 'priority', label: 'Priority', options: [['normal', 'Normal'], ['high', 'High']] },
    ]}/>
    {list.length ? <ul className="tasks">{list.map((t) => <li key={t.id} className={cx('task', t.status === 'done' && 'done', t.priority === 'high' && 'high')}>
      <button className="check" role="checkbox" aria-checked={t.status === 'done'} aria-label={`Mark “${t.title}” ${t.status === 'done' ? 'not done' : 'done'}`}
        onClick={() => update('tasks', t.id, { status: t.status === 'done' ? 'todo' : 'done', doneAt: t.status === 'done' ? null : new Date().toISOString().slice(0, 10) })}>{t.status === 'done' && <Check size={12}/>}</button>
      <span className="task-main"><strong>{t.title}</strong><small>{projectName(t.project)}{t.source ? ` · from ${t.source}` : ''}{t.priority === 'high' ? ' · high priority' : ''}</small></span>
      {dueText(t.due, t.status === 'done')}
      <button className="icon-btn sm" onClick={() => remove('tasks', t.id)} aria-label={`Delete “${t.title}”`}><Trash2 size={13}/></button>
    </li>)}</ul>
      : <Empty title={db.tasks.length ? 'Nothing here' : 'No tasks yet'}>
        {db.tasks.length ? 'Switch the filter to see the rest.' : 'Add one above, or start from the plan’s current milestone.'}
      </Empty>}
    {missing.length > 0 && <button className="btn ghost sm import" onClick={() => addMany('tasks', missing.map((i) => ({ title: i.text, project: 'track-A', status: i.done ? 'done' : 'todo', due: null, priority: 'normal', source: plan.path })))}>
      <Download size={13}/>Add the {missing.length} milestone step{missing.length === 1 ? '' : 's'} from the plan as tasks</button>}
    <p className="store-note">Tasks are saved in this browser only. Export them from Business.</p>
  </div>;
}

function Roadmap() {
  return <div className="block">
    <div className="block-head"><h2>Roadmap</h2><a className="link-btn" href={blobUrl(plan.path)} target="_blank" rel="noreferrer">{plan.path} · updated {plan.updated} <ArrowUpRight size={12}/></a></div>
    <ol className="phases">{plan.phases.map((p) => <li key={p.n} className={cx('phase', p.n === plan.current.n && 'current', p.n < plan.current.n && 'past')}>
      <span className="phase-n mono">{p.n}</span>
      <strong>{p.title}</strong>
      <small>{p.n === plan.current.n ? 'Current · ' : ''}Exit: {p.exit}</small>
    </li>)}</ol>
  </div>;
}

function Milestone() {
  const done = plan.milestone.items.filter((i) => i.done).length;
  return <div className="block">
    <div className="block-head"><h2>Current milestone</h2><span className="label">{done} / {plan.milestone.items.length} checked in the plan</span></div>
    <p className="ms-title">{plan.milestone.title}</p>
    <ul className="checklist">{plan.milestone.items.map((i) => <li key={i.text} className={cx(i.done && 'done')}><span className="check static" aria-hidden="true">{i.done && <Check size={12}/>}</span>{i.text}</li>)}</ul>
    <p className="store-note">Ticked in the document, not here: edit §13 of {plan.path} to update it.</p>
  </div>;
}

function TracksBlock() {
  return <div className="block">
    <div className="block-head"><h2>First-year tracks</h2><span className="label">Oct 2026 – Oct 2027 target</span></div>
    <div className="track-cards">{plan.tracks.map((t) => <details key={t.id} className="track-card">
      <summary><span className="track-id mono">{t.id}</span><strong>{t.title}</strong><small>{t.target}</small></summary>
      <ul>{t.items.map((x) => <li key={x}>{x}</li>)}</ul>
    </details>)}</div>
  </div>;
}

function Issues({ gh }) {
  return <div className="block">
    <div className="block-head"><h2>GitHub issues</h2><a className="link-btn" href="https://github.com/bsalsa2/varn/issues" target="_blank" rel="noreferrer">Open on GitHub <ArrowUpRight size={12}/></a></div>
    {gh.state === 'ready' ? (gh.issues.length ? <ul className="rows">{gh.issues.map((i) => <li key={i.n}><a href={i.url} target="_blank" rel="noreferrer">
      <span className="mono row-k">#{i.n}</span><span className="row-main"><strong>{i.title}</strong><small>{i.labels.join(' · ') || 'No labels'} · updated {ago(i.at)}</small></span><ArrowUpRight size={13}/></a></li>)}</ul>
      : <Empty title="No open issues"/>)
      : <p className="empty-line"><Signal state={gh.state === 'loading' ? 'checking' : 'offline'}/> {gh.state === 'loading' ? 'Loading from GitHub…' : gh.error}</p>}
  </div>;
}

export const PROJECT_TABS = [['plan', 'Plan'], ['tasks', 'Tasks'], ['issues', 'Issues']];

export default function Projects({ tab, setTab, store, gh }) {
  const t = PROJECT_TABS.some(([id]) => id === tab) ? tab : 'plan';
  const open = store.db.tasks.filter((x) => x.status !== 'done').length;
  return <Sheet eyebrow="Operations / Projects" title="Projects"
    desc="Where VARN is on its roadmap, what the current milestone needs, and the tasks and deadlines that get it there."
    tabs={<Tabs label="Projects" value={t} onChange={setTab} items={[['plan', 'Plan'], ['tasks', 'Tasks', open], ['issues', 'Issues', gh.issues.length]]}/>}>
    {t === 'plan' && <><Roadmap/><Milestone/><TracksBlock/></>}
    {t === 'tasks' && <Tasks store={store}/>}
    {t === 'issues' && <Issues gh={gh}/>}
  </Sheet>;
}
