// Writes dist/sitemap.xml after `vite build` (npm runs this as "postbuild").
// It lists the pages search engines should index. field.html (noindex upload
// tool) and 404.html are left out on purpose. Addresses follow meta.url in
// src/content.js, the same value the canonical links use.
import { existsSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { content } from '../src/content.js';

const SITEMAP_PAGES = ['index.html', 'research.html', 'about.html', 'demo.html', 'contact.html', 'privacy.html'];

// The home page is the site root; every other page is its own file.
const pageUrl = (file, base = content.meta.url) => (file === 'index.html' ? new URL(base).href : new URL(file, base).href);

const dist = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const missing = SITEMAP_PAGES.filter((f) => !existsSync(join(dist, f)));
if (missing.length) {
  console.error(`sitemap: ${missing.join(', ')} not in dist/. Run "vite build" first.`);
  process.exit(1);
}

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${SITEMAP_PAGES.map((f) => `  <url><loc>${pageUrl(f)}</loc></url>`).join('\n')}
</urlset>
`;
writeFileSync(join(dist, 'sitemap.xml'), xml);
console.log(`sitemap: wrote dist/sitemap.xml (${SITEMAP_PAGES.length} pages)`);
