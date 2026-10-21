// WCAG contrast of the site's real colour pairs, computed from the tokens in
// brain/dashboard/graphite.css and src/styles.css (no network, no browser).
// Normal text needs 4.5:1, large text (24px, or 19px bold) 3:1, and the edge
// of a control or a chart mark 3:1.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const read = (p) => readFileSync(fileURLToPath(new URL(p, import.meta.url)), 'utf8');
// The light theme block is not shipped by the site: leave it out of the resolver.
const css = read('../../brain/dashboard/graphite.css').replace(/\[data-theme='light'\]\s*\{[^}]*\}/, '') + '\n' + read('../src/styles.css');

// --- a tiny resolver for the custom properties we use ---------------------------------
const vars = {};
// Later declarations win, like the cascade: styles.css overrides graphite.css.
for (const m of css.matchAll(/(--[\w-]+):\s*([^;]+);/g)) vars[m[1]] = m[2].trim();
const hex = (h) => {
  const n = h.replace('#', '');
  const f = n.length === 3 ? [...n].map((c) => c + c).join('') : n;
  return [0, 2, 4].map((i) => parseInt(f.slice(i, i + 2), 16));
};
function color(value, depth = 0) {
  value = value.trim();
  if (depth > 12) throw new Error(`too deep: ${value}`);
  let m;
  if ((m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value))) return hex(value);
  if ((m = /^var\((--[\w-]+)\)$/.exec(value))) return color(vars[m[1]] ?? (() => { throw new Error(`no ${m[1]}`); })(), depth + 1);
  if ((m = /^color-mix\(in srgb,\s*(.+?)\s+(\d+)%,\s*(.+)\)$/.exec(value))) {
    const a = color(m[1], depth + 1);
    const b = color(m[3], depth + 1);
    const t = Number(m[2]) / 100;
    return a.map((v, i) => v * t + b[i] * (1 - t));
  }
  throw new Error(`cannot resolve ${value}`);
}
const tok = (name) => color(`var(${name})`);
const lum = ([r, g, b]) => {
  const c = [r, g, b].map((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const ratio = (a, b) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
const atLeast = (name, fg, bg, min) => {
  const r = ratio(tok(fg), tok(bg));
  assert.ok(r >= min, `${name}: ${fg} on ${bg} is ${r.toFixed(2)}:1, needs ${min}:1`);
};

const SURFACES = ['--surface-page', '--surface-1', '--surface-2'];

test('body and secondary text reach 4.5:1 on every surface', () => {
  for (const bg of SURFACES) {
    for (const fg of ['--varn-text', '--ink-1', '--ink-2', '--ink-3', '--accent-ink']) atLeast('text', fg, bg, 4.5);
  }
});

test('status colours reach 4.5:1 as text on the surfaces they sit on', () => {
  for (const bg of ['--surface-page', '--surface-1']) {
    for (const fg of ['--aircraft', '--drone', '--no-adsb', '--varn-amber']) atLeast('status', fg, bg, 4.5);
  }
});

test('buttons: bone on steel blue, and charcoal on bone', () => {
  atLeast('primary button', '--accent-on', '--accent', 4.5);
  atLeast('solid button', '--varn-charcoal', '--varn-bone', 4.5);
});

test('large statement text (the dim words) reaches 3:1', () => {
  for (const bg of ['--surface-page']) atLeast('dim words', '--dim', bg, 3);
});

test('control edges and the focus ring reach 3:1', () => {
  for (const bg of ['--surface-page', '--surface-1']) {
    atLeast('control edge', '--line-ui', bg, 3);
    atLeast('focus ring', '--focus', bg, 3);
  }
});

test('chart marks reach 3:1 against the panel they sit on', () => {
  for (const mark of ['--chart-aircraft', '--chart-drone']) atLeast('chart mark', mark, '--surface-1', 3);
});

test('the tokens the design system promises exist', () => {
  for (const name of ['--surface-page', '--surface-1', '--surface-2', '--line', '--r-sm', '--r-md', '--r-lg', '--fs-label', '--w-page', '--section-y', '--dur']) {
    assert.ok(vars[name], `${name} is not defined`);
  }
  // 13px is the smallest text on the site.
  assert.equal(vars['--fs-label'], '0.8125rem');
});

test('text on glass keeps 4.5:1 over the brightest light on the stage (worst case)', () => {
  // The brightest thing under any panel is the steel light on the stage
  // (55% steel over charcoal). A panel adds a 56% charcoal smoke and at most a
  // 12% white sheen on top of it; the real fill is darker than this.
  const mix = (a, b, t) => a.map((v, i) => v * t + b[i] * (1 - t));
  const stageLight = mix(tok('--varn-steel-blue'), tok('--varn-charcoal'), 0.55);
  const smoked = mix(tok('--varn-charcoal'), stageLight, 0.56);
  const worst = mix([255, 255, 255], smoked, 0.12);
  // The orange accent only ever sits on solid black (checked in the palette test), not on glass.
  for (const fg of ['--varn-text', '--ink-1', '--ink-2', '--ink-3', '--drone']) {
    const r = ratio(tok(fg), worst);
    assert.ok(r >= 4.5, `${fg} on worst-case glass is ${r.toFixed(2)}:1`);
  }
  // Sage status text sits in a pill with its own dark ground, not directly on glass.
});

test('the cinematic palette: titanium, ice and secondary text on obsidian, midnight and deep', () => {
  for (const bg of ['--obsidian', '--midnight', '--deep']) {
    for (const fg of ['--text-1', '--text-2', '--titanium', '--ice']) atLeast('palette', fg, bg, 4.5);
  }
  atLeast('ice button text', '--obsidian', '--ice', 4.5);
  atLeast('control edge (steel) on midnight', '--steel', '--midnight', 3);
});
