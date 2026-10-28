// "What needs attention" and "what to work on next". Plain rules over real signals; no model,
// no scoring that isn't shown. Each item says where it came from.
import { daysUntil } from './store.js';
import { plan } from './repo.js';
import { caveats } from '../results.js';

export function attention({ api, gh, kaggle, site, db }) {
  const out = [];
  if (api.state === 'offline') out.push({ tone: 'alert', title: 'Platform API unreachable', detail: api.error || 'Health check failed', to: 'systems', src: 'Live health check' });
  if (site.state === 'offline') out.push({ tone: 'alert', title: 'tryvarn.com not reachable from this browser', detail: 'Network request failed', to: 'systems', src: 'Live check' });
  for (const r of gh.latest || []) {
    if (r.status === 'completed' && r.conclusion && !['success', 'skipped', 'neutral'].includes(r.conclusion)) {
      out.push({ tone: 'alert', title: `${r.name} ${r.conclusion}`, detail: `Latest run on main · ${r.sha}`, href: r.url, src: 'GitHub Actions' });
    }
  }
  if (gh.state === 'limited') out.push({ tone: 'info', title: 'GitHub data paused', detail: 'Hourly rate limit for this browser reached', to: 'systems', src: 'GitHub API' });
  for (const k of kaggle.data?.kernels || []) {
    if (/ERROR|UNREACHABLE|CANCEL/.test(k.status)) out.push({ tone: 'warn', title: `Kaggle ${k.ref} ${k.status.toLowerCase()}`, detail: k.error ? k.error.slice(0, 90) : 'See Systems', to: 'systems', src: 'Kaggle sync' });
  }
  const open = db.tasks.filter((t) => t.status !== 'done');
  const overdue = open.filter((t) => t.due && daysUntil(t.due) < 0);
  const soon = open.filter((t) => t.due && daysUntil(t.due) >= 0 && daysUntil(t.due) <= 7);
  if (overdue.length) out.push({ tone: 'alert', title: `${overdue.length} task${overdue.length > 1 ? 's' : ''} overdue`, detail: overdue.slice(0, 2).map((t) => t.title).join(' · '), to: 'projects', src: 'Your tasks' });
  if (soon.length) out.push({ tone: 'warn', title: `${soon.length} due this week`, detail: soon.slice(0, 2).map((t) => `${t.title} (${t.due})`).join(' · '), to: 'projects', src: 'Your tasks' });
  if (gh.issues?.length) out.push({ tone: 'info', title: `${gh.issues.length} open GitHub issue${gh.issues.length > 1 ? 's' : ''}`, detail: gh.issues.slice(0, 2).map((i) => `#${i.n} ${i.title}`).join(' · '), to: 'projects', src: 'GitHub issues' });
  out.push({ tone: 'info', title: 'No real-sky evaluation yet', detail: caveats[1], to: 'research', src: 'Research caveats' });
  return out;
}

/** Up to three concrete next actions, most urgent first. */
export function nextUp({ db, gh }) {
  const out = [];
  const open = db.tasks.filter((t) => t.status !== 'done')
    .sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999') || (b.priority === 'high') - (a.priority === 'high'));
  for (const t of open.slice(0, 2)) out.push({ title: t.title, why: t.due ? (daysUntil(t.due) < 0 ? `Overdue since ${t.due}` : `Due ${t.due}`) : 'Your open task', src: 'Your tasks', to: 'projects' });
  const mine = new Set(db.tasks.map((t) => t.title));
  const step = plan.milestone.items.find((i) => !i.done && !mine.has(i.text));
  if (step) out.push({ title: step.text, why: `Next unchecked step of “${plan.milestone.title}”`, src: plan.path, to: 'projects' });
  const failing = (gh.latest || []).find((r) => r.status === 'completed' && r.conclusion === 'failure');
  if (failing && out.length < 3) out.push({ title: `Fix ${failing.name}`, why: 'Latest run on main failed', src: 'GitHub Actions', href: failing.url });
  return out.slice(0, 3);
}
