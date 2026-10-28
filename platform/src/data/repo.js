// What the repository itself says: the master plan, the project documents, the prototype BOM.
// Imported as text at build time, so every number traces to a committed file.
import planText from '../../../docs/MASTER_PLAN.md?raw';
import bomText from '../../../bom.csv?raw';

const REPO = 'https://github.com/bsalsa2/varn';
export const blobUrl = (path) => `${REPO}/blob/main/${path}`;

function section(md, heading) {
  const i = md.indexOf(heading);
  if (i < 0) return '';
  const rest = md.slice(i + heading.length);
  const next = rest.search(/\n## /);
  return next < 0 ? rest : rest.slice(0, next);
}
const bullets = (text) => text.split('\n').filter((l) => /^- /.test(l)).map((l) => l.replace(/^- /, '').replace(/\*\*/g, '').trim());

function parsePlan(md) {
  const updated = /\*\*Last updated:\*\*\s*(\S+)/.exec(md)?.[1] ?? null;
  const phases = [...md.matchAll(/### Phase (\d+) — (.+)\n([\s\S]*?)\*\*Exit condition:\*\*\s*(.+)/g)]
    .map((m) => ({ n: +m[1], title: m[2].trim(), body: m[3].replace(/\s+/g, ' ').trim(), exit: m[4].trim() }));
  const tracks = [...md.matchAll(/### Track ([A-Z]) — (.+)\n([\s\S]*?)\*\*Target:\*\*\s*(.+)/g)]
    .map((m) => ({ id: m[1], title: m[2].trim(), items: bullets(m[3]), target: m[4].trim() }));
  const ms = section(md, '## 13. Immediate Next Milestone');
  const milestone = {
    title: /\*\*(.+?)\*\*/.exec(ms)?.[1] ?? 'Immediate next milestone',
    items: [...ms.matchAll(/- \[( |x)\] (.+)/g)].map((m) => ({ done: m[1] === 'x', text: m[2].trim() })),
  };
  const decisions = section(md, '## 15. Decision Log').split('\n')
    .map((l) => /^\| (\d{4}-\d{2}-\d{2}) \| (.+?) \| (.+?) \|$/.exec(l)).filter(Boolean)
    .map((m) => ({ date: m[1], decision: m[2], reason: m[3] }));
  // The plan's "Immediate next milestone" is Phase 1's work, so Phase 1 is current until the doc says otherwise.
  const current = phases.find((p) => /reproducible/i.test(p.title) && /repeatable|reproduc/i.test(milestone.title)) ?? phases[0];
  return { updated, phases, tracks, milestone, decisions, current, path: 'docs/MASTER_PLAN.md' };
}
export const plan = parsePlan(planText);

// Documents in the repository (titles from their first heading).
const docFiles = import.meta.glob(['../../../docs/*.md', '../../../training/*.md', '../../../hardware/README.md', '../../../brain/README.md', '../../../README.md'], { query: '?raw', import: 'default', eager: true });
export const documents = Object.entries(docFiles).map(([p, text]) => {
  const path = p.replace(/^(\.\.\/)+/, '');
  const title = /^#\s+(.+)$/m.exec(text)?.[1]?.replace(/[*_`]/g, '').trim() || path;
  const area = path.startsWith('training') ? 'Research' : path.startsWith('hardware') ? 'Hardware' : path.startsWith('brain') ? 'Software' : path === 'README.md' ? 'Company' : 'Company';
  return { path, title, area, words: text.split(/\s+/).length, text, url: blobUrl(path) };
}).sort((a, b) => a.area.localeCompare(b.area) || a.title.localeCompare(b.title));

function splitCsv(line) {
  const out = []; let cur = '', q = false;
  for (const ch of line) {
    if (ch === '"') q = !q; else if (ch === ',' && !q) { out.push(cur); cur = ''; } else cur += ch;
  }
  out.push(cur); return out.map((s) => s.trim());
}
const bomRows = bomText.trim().split('\n');
const bomHead = splitCsv(bomRows[0]);
export const bom = bomRows.slice(1).map((l) => Object.fromEntries(splitCsv(l).map((v, i) => [bomHead[i], v])))
  .map((r) => ({ part: r.part, qty: Number(r.quantity) || 1, purpose: r.purpose, cost: r.est_cost_usd === '' ? null : Number(r.est_cost_usd), link: r.link || null }));
export const bomTotal = bom.reduce((s, r) => s + (r.cost ?? 0), 0);
export const bomPath = 'bom.csv';

export function supplierOf(link) {
  try { return new URL(link).hostname.replace(/^www\./, ''); } catch { return null; }
}
