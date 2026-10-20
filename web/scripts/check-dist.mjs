// Checks the built site (web/dist): every file a page or script points at
// exists, and every in-page link lands on a real id. Run after `npm run build`.
//
// Why: `vite preview` answers unknown paths with index.html, so a missing
// asset can pass every local test and still 404 on a real static host (that is
// how a deleted stylesheet once stopped the lazy-loaded views from starting).
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = resolve(dirname(fileURLToPath(import.meta.url)), '..', process.argv[2] || 'dist');
if (!existsSync(dist)) {
  console.error(`No build at ${dist}. Run "npm run build" first.`);
  process.exit(1);
}

const walk = (dir) =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
const files = walk(dist);
const pages = files.filter((f) => f.endsWith('.html'));
const scripts = files.filter((f) => f.endsWith('.js'));
const problems = [];
const bad = (where, msg) => problems.push(`${relative(dist, where)}: ${msg}`);

const idsOf = new Map(pages.map((p) => [p, new Set([...readFileSync(p, 'utf8').matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]))]));

// ---- pages: href / src / url(), and #anchors
for (const page of pages) {
  const html = readFileSync(page, 'utf8');
  for (const m of html.matchAll(/\b(?:href|src)="([^"]*)"/g)) {
    const ref = m[1];
    if (!ref || /^(https?:|mailto:|data:|tel:)/.test(ref)) continue;
    const [path, hash] = ref.split('#');
    const target = path ? resolve(dirname(page), path.split('?')[0]) : page;
    const isDir = path === './' || path === '';
    const file = isDir ? join(path === '' ? page : dist, path === '' ? '' : 'index.html') : target;
    if (!existsSync(file)) bad(page, `"${ref}" points at a file that is not in the build`);
    else if (hash && file.endsWith('.html')) {
      const ids = idsOf.get(file);
      const id = decodeURIComponent(hash);
      // demo.html's #overview, #events... are views the script switches (ids view-*).
      if (!ids?.has(id) && !ids?.has(`view-${id}`)) bad(page, `"${ref}" has no matching id`);
    }
  }
  for (const m of html.matchAll(/url\((['"]?)(\.\/[^)'"]+)\1\)/g)) {
    if (!existsSync(resolve(dirname(page), m[2]))) bad(page, `CSS url(${m[2]}) is not in the build`);
  }
}

// ---- scripts: relative module / asset paths they load
for (const file of scripts) {
  const js = readFileSync(file, 'utf8');
  for (const m of js.matchAll(/["'`](\.{1,2}\/[\w./-]+\.(?:js|css|woff2?|webp|png|svg|bin|json))["'`]/g)) {
    if (!existsSync(resolve(dirname(file), m[1]))) bad(file, `loads "${m[1]}", which is not in the build`);
  }
}
// Loaded by URL at run time, so they never appear as ./paths in the scripts.
for (const f of ['models/pantilt.bin', 'models/pantilt-still.webp']) {
  if (!existsSync(join(dist, f))) problems.push(`${f} is missing from the build`);
}

if (problems.length) {
  console.error(`check:dist found ${problems.length} problem(s):\n` + problems.map((p) => '  - ' + p).join('\n'));
  process.exit(1);
}
console.log(`check:dist: ${pages.length} pages and ${scripts.length} scripts checked, every file and in-page link resolves.`);
