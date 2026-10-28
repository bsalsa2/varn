// Live signals the browser can check by itself, with no keys: the platform API, the public
// GitHub repository (Actions runs, commits, issues), the Kaggle sync file, and the website.
import { useCallback, useEffect, useRef, useState } from 'react';

export const API_URL = 'https://varn-api.varnlabs.workers.dev';
export const REPO_API = 'https://api.github.com/repos/bsalsa2/varn';
export const SITE_URL = 'https://tryvarn.com/';

export function useApiHealth() {
  const [api, setApi] = useState({ state: 'checking', latency: null, checkedAt: null, body: null, error: null });
  const busy = useRef(false);
  const check = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setApi((a) => ({ ...a, busy: true }));
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

// Written by .github/workflows/kaggle-sync.yml; absent until that workflow has run once.
export function useKaggleSync() {
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
export const KAGGLE_TONE = (status) => status === 'COMPLETE' ? 'online' : /RUNNING|QUEUED/.test(status) ? 'checking' : /ERROR|CANCEL|UNREACHABLE/.test(status) ? 'offline' : 'idle';
export const KAGGLE_LABEL = (status) => ({ COMPLETE: 'Complete', RUNNING: 'Running', QUEUED: 'Queued', ERROR: 'Error', UNKNOWN: 'Unknown', UNREACHABLE: 'Unreachable' }[status] ?? status.toLowerCase().replace(/_/g, ' '));

// Public GitHub API: 60 unauthenticated requests per hour per visitor, so results are cached
// for five minutes in this tab.
const CACHE_MS = 5 * 60 * 1000;
async function gh(path) {
  const key = `varn.gh.${path}`;
  try {
    const hit = JSON.parse(sessionStorage.getItem(key) || 'null');
    if (hit && Date.now() - hit.at < CACHE_MS) return hit.data;
  } catch { /* storage unavailable */ }
  const res = await fetch(`${REPO_API}${path}`, { headers: { Accept: 'application/vnd.github+json' } });
  if (res.status === 403 || res.status === 429) throw Object.assign(new Error('GitHub rate limit reached; try again later'), { limited: true });
  if (!res.ok) throw new Error(`GitHub HTTP ${res.status}`);
  const data = await res.json();
  try { sessionStorage.setItem(key, JSON.stringify({ at: Date.now(), data })); } catch { /* storage unavailable */ }
  return data;
}

export function useGitHub() {
  const [s, setS] = useState({ state: 'loading', runs: [], latest: [], commits: [], issues: [], error: null, at: null });
  const load = useCallback(() => {
    setS((x) => ({ ...x, state: x.at ? x.state : 'loading' }));
    Promise.all([gh('/actions/runs?per_page=50'), gh('/commits?sha=main&per_page=12'), gh('/issues?state=open&per_page=30')])
      .then(([runs, commits, issues]) => {
        const all = (runs.workflow_runs || []).map((r) => ({
          id: r.id, name: r.name, status: r.status, conclusion: r.conclusion, event: r.event, branch: r.head_branch,
          at: r.updated_at || r.created_at, url: r.html_url, sha: r.head_sha?.slice(0, 7), title: r.display_title,
        }));
        const seen = new Set();
        const latest = all.filter((r) => r.branch === 'main' && !seen.has(r.name) && seen.add(r.name));
        setS({
          state: 'ready', runs: all, latest,
          commits: (commits || []).map((c) => ({ sha: c.sha.slice(0, 7), message: c.commit.message.split('\n')[0], author: c.commit.author?.name, at: c.commit.author?.date, url: c.html_url })),
          issues: (issues || []).filter((i) => !i.pull_request).map((i) => ({ n: i.number, title: i.title, url: i.html_url, at: i.updated_at, labels: (i.labels || []).map((l) => l.name) })),
          error: null, at: new Date(),
        });
      })
      .catch((err) => setS((x) => ({ ...x, state: err.limited ? 'limited' : 'error', error: err.message, at: new Date() })));
  }, []);
  useEffect(() => { load(); }, [load]);
  return [s, load];
}
export const runTone = (r) => r.status !== 'completed' ? 'checking' : r.conclusion === 'success' ? 'online' : r.conclusion === 'skipped' || r.conclusion === 'neutral' ? 'idle' : 'offline';
export const runLabel = (r) => r.status !== 'completed' ? r.status.replace('_', ' ') : r.conclusion ?? 'done';

// The website answers cross-origin requests opaquely, so this proves it is reachable from this
// browser, not that the page is correct. The label says exactly that.
export function useSiteCheck() {
  const [s, setS] = useState({ state: 'checking', ms: null, at: null });
  const check = useCallback(() => {
    const t0 = performance.now();
    const ctl = new AbortController(); const timer = setTimeout(() => ctl.abort(), 10000);
    fetch(SITE_URL, { mode: 'no-cors', cache: 'no-store', signal: ctl.signal })
      .then(() => setS({ state: 'online', ms: Math.round(performance.now() - t0), at: new Date() }))
      .catch(() => setS({ state: 'offline', ms: null, at: new Date() }))
      .finally(() => clearTimeout(timer));
  }, []);
  useEffect(() => { check(); }, [check]);
  return [s, check];
}

export const ago = (iso) => {
  if (!iso) return '—';
  const s = (Date.now() - Date.parse(iso)) / 1000;
  if (s < 90) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} d ago`;
};
