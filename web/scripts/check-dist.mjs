// Checks the built site (web/dist): every file a page or script points at
// exists, every in-page link lands on a real id, and the search basics hold
// (sitemap, one h1, short descriptions, canonical addresses). Run after
// `npm run build`.
//
// Why: `vite preview` answers unknown paths with index.html, so a missing
// asset can pass every local test and still 404 on a real static host (that is
// how a deleted stylesheet once stopped the lazy-loaded views from starting).
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { content } from '../src/content.js';

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

// ---- search basics
const base = content.meta.url;
const rel = (p) => relative(dist, p).split('\\').join('/');
// Where a page is expected to live on the site: index.html is the root.
const expectedUrl = (p) => (rel(p) === 'index.html' ? new URL(base).href : new URL(rel(p), base).href);
const attr = (tag, name) => tag.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1];
const unescape = (v) => v.replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

for (const page of pages) {
  const html = readFileSync(page, 'utf8');
  const h1s = (html.match(/<h1[\s>]/g) || []).length;
  if (h1s !== 1) bad(page, `has ${h1s} <h1> elements, expected exactly 1`);

  const desc = html.match(/<meta[^>]*\bname="description"[^>]*>/)?.[0];
  if (desc) {
    const len = unescape(attr(desc, 'content') || '').length;
    if (len > 160) bad(page, `meta description is ${len} characters, the limit is 160`);
  }

  const canon = html.match(/<link[^>]*\brel="canonical"[^>]*>/)?.[0];
  if (canon) {
    const href = unescape(attr(canon, 'href') || '');
    if (href !== expectedUrl(page)) bad(page, `canonical is "${href}", expected "${expectedUrl(page)}"`);
  }

  // Organization / WebSite markup belongs on the home page only, and must parse.
  const ld = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  if (rel(page) !== 'index.html' && ld.length) bad(page, 'has JSON-LD, which is meant for the home page only');
  if (rel(page) === 'index.html') {
    if (ld.length !== 1) bad(page, `has ${ld.length} JSON-LD blocks, expected 1`);
    else {
      try {
        const types = JSON.parse(ld[0][1])['@graph'].map((n) => n['@type']);
        for (const t of ['Organization', 'WebSite']) if (!types.includes(t)) bad(page, `JSON-LD has no ${t}`);
      } catch (e) {
        bad(page, `JSON-LD is not valid JSON (${e.message})`);
      }
    }
  }
}

// Sitemap: exists, and lists only real, indexable pages at their canonical address.
const sitemapFile = join(dist, 'sitemap.xml');
if (!existsSync(sitemapFile)) problems.push('sitemap.xml is missing from the build');
else {
  const locs = [...readFileSync(sitemapFile, 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  const byUrl = new Map(pages.map((p) => [expectedUrl(p), p]));
  if (!locs.length) problems.push('sitemap.xml lists no pages');
  if (new Set(locs).size !== locs.length) problems.push('sitemap.xml lists a page more than once');
  for (const loc of locs) {
    const page = byUrl.get(loc);
    if (!page) problems.push(`sitemap.xml lists ${loc}, which is not a page in the build`);
    else if (/<meta[^>]*\bname="robots"[^>]*noindex/.test(readFileSync(page, 'utf8'))) bad(page, 'is noindex but listed in sitemap.xml');
    else if (!/<link[^>]*\brel="canonical"/.test(readFileSync(page, 'utf8'))) bad(page, 'is listed in sitemap.xml but has no canonical link');
  }
  for (const f of ['field.html', '404.html']) if (locs.includes(expectedUrl(join(dist, f)))) problems.push(`sitemap.xml must not list ${f}`);
  // Every page that is not noindex should be in the sitemap.
  for (const [url, page] of byUrl) {
    if (!locs.includes(url) && !/<meta[^>]*\bname="robots"[^>]*noindex/.test(readFileSync(page, 'utf8'))) bad(page, 'is indexable but missing from sitemap.xml');
  }
}
const robots = join(dist, 'robots.txt');
if (!existsSync(robots) || !readFileSync(robots, 'utf8').includes(`Sitemap: ${new URL('sitemap.xml', base).href}`)) problems.push('robots.txt does not point at the sitemap');

if (problems.length) {
  console.error(`check:dist found ${problems.length} problem(s):\n` + problems.map((p) => '  - ' + p).join('\n'));
  process.exit(1);
}
console.log(`check:dist: ${pages.length} pages and ${scripts.length} scripts checked, every file and in-page link resolves, sitemap, h1, description and canonical checks pass.`);
