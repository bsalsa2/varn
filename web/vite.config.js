import { defineConfig } from 'vite';
import { content } from './src/content.js';
import { fileURLToPath } from 'node:url';
import { renderHead, renderBody, renderPrivacyHead, renderPrivacyBody, renderContactHead, renderContactBody, renderDemoHead, renderDemoBody, renderResearchHead, renderResearchBody, renderAboutHead, renderAboutBody } from './src/render.js';

// Renders src/content.js into index.html at build time, so the page is
// plain static HTML (fast, readable without JavaScript, good for search).
const varnContent = () => ({
  name: 'varn-content',
  transformIndexHtml(html) {
    return html
      .replace('<!--varn:head-->', renderHead(content))
      .replace('<!--varn:body-->', renderBody(content))
      .replace('<!--varn:privacy-head-->', renderPrivacyHead(content))
      .replace('<!--varn:privacy-body-->', renderPrivacyBody(content))
      .replace('<!--varn:contact-head-->', renderContactHead(content))
      .replace('<!--varn:contact-body-->', renderContactBody(content))
      .replace('<!--varn:demo-head-->', renderDemoHead(content))
      .replace('<!--varn:demo-body-->', renderDemoBody(content))
      .replace('<!--varn:research-head-->', renderResearchHead(content))
      .replace('<!--varn:research-body-->', renderResearchBody(content))
      .replace('<!--varn:about-head-->', renderAboutHead(content))
      .replace('<!--varn:about-body-->', renderAboutBody(content));
  },
});

// CSS files that lazy chunks need (directly, or through a chunk they import).
// Those are loaded by link at run time, so the inliner must leave them intact.
function lazyCss(bundle) {
  const chunks = new Map(Object.values(bundle).filter((c) => c.type === 'chunk').map((c) => [c.fileName, c]));
  const css = new Set();
  const seen = new Set();
  const visit = (c) => {
    if (!c || seen.has(c.fileName)) return;
    seen.add(c.fileName);
    (c.viteMetadata?.importedCss || []).forEach((f) => css.add(f));
    (c.imports || []).forEach((f) => visit(chunks.get(f)));
  };
  chunks.forEach((c) => c.isDynamicEntry && visit(c));
  return css;
}

// Inlines the (small) stylesheet into index.html so the first paint doesn't
// wait on a second request.
const inlineCss = () => ({
  name: 'varn-inline-css',
  apply: 'build',
  enforce: 'post',
  generateBundle(_, bundle) {
    const pages = Object.values(bundle).filter((f) => f.fileName.endsWith('.html'));
    for (const [name, file] of Object.entries(bundle)) {
      if (!name.endsWith('.css')) continue;
      const tag = new RegExp(`<link[^>]*href="[^"]*${file.fileName.split('/').pop()}"[^>]*>`);
      const users = pages.filter((p) => tag.test(p.source));
      if (!users.length) continue;
      // URLs inside the CSS are relative to its own folder (assets/); rebase
      // them so they still resolve once the CSS lives in index.html.
      const dir = file.fileName.includes('/') ? file.fileName.replace(/[^/]+$/, '') : '';
      const css = String(file.source).replace(
        /url\((['"]?)\.\/(?!\/)/g,
        (_, q) => `url(${q}./${dir}`
      );
      for (const page of users) page.source = page.source.replace(tag, () => `<style>${css}</style>`);
      // Lazy chunks (hero lens, radar, sensor, 3D viewer) still list this file
      // as a dependency to preload, and Vite rejects the import if it 404s.
      // `vite preview` hides that by answering every unknown path with
      // index.html, so leave an empty file behind rather than deleting it.
      // Unless a lazy chunk (the home page's dashboard preview) needs the file
      // too: that one is loaded by link at run time, so it keeps its content.
      // (The home page already carries its own sheet, so that one is still blanked.)
      const lazyUsers = lazyCss(bundle).has(file.fileName) && !users.some((p) => p.fileName === 'index.html') ? [file] : [];
      if (!lazyUsers.length) file.source = '/* inlined into each page */\n';
    }
  },
});

// Preloads the fonts the first screen needs (display, body, buttons, labels),
// so text does not reflow when they arrive.
const preloadFonts = () => ({
  name: 'varn-preload-fonts',
  apply: 'build',
  transformIndexHtml: {
    order: 'post',
    handler(html, ctx) {
      const wanted = ['space-grotesk-latin-300-normal', 'space-grotesk-latin-500-normal', 'inter-latin-400-normal', 'geist-mono-latin-400-normal'];
      const files = Object.keys(ctx.bundle || {}).filter(
        (f) => f.endsWith('.woff2') && wanted.some((w) => f.includes(w))
      );
      return files.map((f) => ({
        tag: 'link',
        attrs: { rel: 'preload', href: `./${f}`, as: 'font', type: 'font/woff2', crossorigin: '' },
        injectTo: 'head',
      }));
    },
  },
});

// Relative base so the build works on any host, at the domain root or under
// a sub-path.
export default defineConfig({
  base: './',
  // graphite.css (shared brand tokens) lives in ../brain/dashboard
  server: { fs: { allow: ['..'] } },
  plugins: [varnContent(), preloadFonts(), inlineCss()],
  build: {
    outDir: 'dist',
    target: 'es2020',
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        privacy: fileURLToPath(new URL('./privacy.html', import.meta.url)),
        contact: fileURLToPath(new URL('./contact.html', import.meta.url)),
        demo: fileURLToPath(new URL('./demo.html', import.meta.url)),
        research: fileURLToPath(new URL('./research.html', import.meta.url)),
        about: fileURLToPath(new URL('./about.html', import.meta.url)),
        field: fileURLToPath(new URL('./field.html', import.meta.url)),
      },
    },
    // three.js lives in its own lazy-loaded chunk; it is big by nature.
    chunkSizeWarningLimit: 700,
  },
});
