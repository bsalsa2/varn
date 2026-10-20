import { defineConfig } from 'vite';
import { content } from './src/content.js';
import { fileURLToPath } from 'node:url';
import { renderHead, renderBody, renderPrivacyHead, renderPrivacyBody, renderContactHead, renderContactBody, renderDemoHead, renderDemoBody } from './src/render.js';

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
      .replace('<!--varn:demo-body-->', renderDemoBody(content));
  },
});

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
      file.source = '/* inlined into each page */\n';
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
      const wanted = ['space-grotesk-latin-500-normal', 'inter-latin-400-normal', 'inter-latin-500-normal', 'geist-mono-latin-400-normal', 'geist-mono-latin-500-normal'];
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
        field: fileURLToPath(new URL('./field.html', import.meta.url)),
      },
    },
    // three.js lives in its own lazy-loaded chunk; it is big by nature.
    chunkSizeWarningLimit: 700,
  },
});
