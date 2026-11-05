// Renders each Records page to HTML with the real components (Vite's SSR loader, no browser, no new dependencies)
// and checks what a reader would see: the right content, a source on every number, honest empty states.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';

const read = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
const DATA = JSON.parse(read('../data/records.json'));
const LEDGER = read('../../evidence/ledger.md');
const ROOT = new URL('../../', import.meta.url).pathname;

let server, mod, model, ledger;
before(async () => {
  server = await createServer({ root: ROOT, configFile: false, plugins: [react()], server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom', logLevel: 'silent', optimizeDeps: { noDiscovery: true, include: [] } });
  mod = await server.ssrLoadModule('/src/records/RecordsApp.jsx');
  model = await server.ssrLoadModule('/src/records/model.js');
  ledger = await server.ssrLoadModule('/src/records/ledger.js');
});
after(async () => { await server?.close(); });

const page = (hash) => renderToStaticMarkup(React.createElement(mod.default, { hash }));
const text = (html) => html.replace(/<[^>]+>/g, ' ').replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ' ').replace(/ ([,.;:)])/g, '$1').replace(/\( /g, '(');
const ALL = ['#records', '#records/results', '#records/research', '#records/research/M-run3', '#records/research/X-run5', '#records/research/D-svanstrom', '#records/research/T-svan-897', '#records/source/S5/34', '#records/results/T-svan-897'];

test('no page prints undefined, NaN, null or [object Object]', () => {
  for (const h of ALL) {
    const t = text(page(h));
    assert.doesNotMatch(t, /undefined|NaN|\bnull\b|\[object/, h);
  }
});

test('no orphan numbers: every number element names its ledger source', () => {
  const lines = ledger.parseLedger(LEDGER);
  for (const h of ALL) {
    const html = page(h);
    const nums = [...html.matchAll(/<(?:span|a) class="rec-num[^"]*"([^>]*)>/g)];
    for (const m of nums) {
      assert.match(m[1], /data-src="[^"]+"/, `${h}: ${m[0]}`);
      const src = /data-src="([^"]+)"/.exec(m[1])[1];
      if (src !== 'records.json') assert.ok(lines.byId[src], `${h}: unknown source ${src}`);
    }
    // every source chip points at a real ledger section and a line inside it
    for (const m of html.matchAll(/class="src" href="#records\/source\/(S\d+)\/(\d+)"/g)) {
      const sec = lines.byId[m[1]]; const n = Number(m[2]);
      assert.ok(sec && n >= sec.first && n <= sec.last, `${h}: ${m[0]}`);
    }
  }
});

test('Overview: counts come from the records, gaps come from S8, results are labelled by run order', () => {
  const html = page('#records'); const t = text(html);
  assert.match(t, /Records Every model, experiment, dataset and result is a record/);
  const counts = [...html.matchAll(/class="rec-num rec-count"[^>]*>(\d+)</g)].map((m) => Number(m[1]));
  const c = model.buildIndex(DATA).counts;
  assert.deepEqual(counts, [c.models, c.experiments, c.datasets, c.testSets, c.testSetSlices, c.results, c.testSetsWithResults]);
  for (const g of DATA.gaps) { assert.ok(t.includes(g.title), g.id); assert.ok(html.includes(`href="#records/source/S8/${g.source_line}"`), g.id); }
  assert.match(t, /Not verified/);
  assert.match(t, /no date for individual results/);
  assert.match(t, /run5 .*Verdict recorded in the ledger: KEEP v3/);
  assert.match(t, /0\.736/); assert.match(t, /0\.079/);
  assert.match(t, /Results are comparable only when they share a test set/);
  assert.match(t, /T-svan-1195 has 1,195 S4 · L\d+ frames from run 4, and T-svan-897 has 897 S4 · L\d+ frames/);
  assert.match(t, /Varn is detection only/);
});

test('Results: one group per test set, nothing from another test set inside it, never ranked', () => {
  const html = page('#records/results'); const t = text(html);
  const byEval = new Map(DATA.evaluations.map((e) => [e.id, e]));
  const sections = html.split('<section class="rg"').slice(1);
  assert.equal(sections.length, new Set(DATA.evaluations.map((e) => e.test_set_id)).size);
  let rows = 0;
  for (const s of sections) {
    const ts = /id="rg-([^"]+)"/.exec(s)[1];
    const ids = [...s.matchAll(/class="metric" href="#records\/research\/([^"]+)"/g)].map((m) => decodeURIComponent(m[1]));
    assert.ok(ids.length > 0, ts);
    for (const id of ids) { rows++; assert.equal(byEval.get(id).test_set_id, ts, `${id} shown under ${ts}`); }
  }
  assert.equal(rows, DATA.evaluations.length);
  // columns, caveats beside numbers, original precision
  assert.match(html, /<th scope="col">Model<\/th><th scope="col">Metric<\/th><th scope="col">Value<\/th><th scope="col">Notes<\/th>/);
  assert.ok(html.includes('<b class="v">0.800</b>'));
  assert.ok(html.includes('<b class="v">0.0%</b>'));
  assert.match(t, /Limit: v3 was probably trained on this collection, so it flatters v3\./);
  assert.match(t, /Wrong-class numbers count a wrong-class box anywhere in the frame/);
  assert.match(t, /A DIFFERENT split from T-svan-1195/);
  assert.doesNotMatch(t, /\brank(ed|ing)?\b[^.]*\b(1st|first|#1)\b|leaderboard|best model|winner/i);
  assert.match(t, /not ranked/);
  // honest absence
  assert.match(t, /No result in the ledger on this test set for: run1, run2\./);
  assert.match(t, /Not measured/);
  assert.match(t, /No run on Varn's own camera in a real sky\./);
  assert.match(t, /False alarms on empty sky have not been measured\./);
  assert.match(t, /mean average precision at IoU 0\.5/);
});

test('Results: the two Svanstrom sets are separate groups with their own numbers', () => {
  const html = page('#records/results');
  const s1195 = html.split('id="rg-T-svan-1195"')[1].split('<section class="rg"')[0];
  const s897 = html.split('id="rg-T-svan-897"')[1].split('<section class="rg"')[0];
  assert.ok(s1195.includes('0.648') && s1195.includes('0.063') && !s1195.includes('0.736') && !s1195.includes('0.079'));
  assert.ok(s897.includes('0.736') && s897.includes('0.079') && !s897.includes('0.648') && !s897.includes('0.063'));
});

test('Results: a single test set can be opened, and an unknown one says so', () => {
  const t = text(page('#records/results/T-svan-897'));
  assert.match(t, /Results on T-svan-897/); assert.match(t, /0\.736/); assert.doesNotMatch(t, /0\.648/);
  const u = text(page('#records/results/T-nothing'));
  assert.match(u, /No test set called T-nothing/);
  const d = text(page('#records/results/D-roboflow'));
  assert.match(d, /No test set called D-roboflow/);
});

test('Research: models, experiments, datasets and test sets as rows with a source', () => {
  const html = page('#records/research'); const t = text(html);
  for (const r of [...DATA.models, ...DATA.experiments, ...DATA.datasets]) assert.ok(html.includes(`href="#records/research/${r.id}"`), r.id);
  assert.equal([...html.matchAll(/<li><a class="rid"/g)].length, DATA.models.length + DATA.experiments.length + DATA.datasets.length);
  assert.match(t, /Status: |not promoted/);
  assert.match(t, /Verdict: KEEP v3 \(margin -0\.022, limit -0\.020\)/);
  assert.match(t, /License: not checked/);
  assert.match(t, /License: MIT license/);
});

test('Detail: a model shows summary, caveats, source line, and links to related records', () => {
  const html = page('#records/research/M-run3'); const t = text(html);
  assert.match(t, /Model · M-run3/);
  assert.match(t, /Weights ft_best\.pt 6\.31 MB, ONNX 12\.5 MB/);
  assert.match(t, /Optimizer|Settings name ft_lr0\.0005_freeze10/);
  assert.match(t, /Caveats/); assert.match(t, /not promoted after the clip check/);
  assert.match(t, /\* ?M-run3: same data|M-run3: same data, same settings name/);
  assert.ok(html.includes('href="#records/source/S2/'));
  assert.ok(html.includes('href="#records/research/M-v3"'));         // built from
  assert.ok(html.includes('href="#records/research/D-roboflow"'));   // trained on
  assert.ok(html.includes('href="#records/research/X-run3"'));       // experiments
  assert.ok(html.includes('href="#records/research/X-threshold"'));
  assert.match(t, /0\.834/);                                         // its results
});

test('Detail: a dataset links to the experiments that used it', () => {
  const html = page('#records/research/D-svanstrom'); const t = text(html);
  assert.match(t, /CC0 public domain/); assert.match(t, /Daylight only; drones flown within 200 m\./);
  assert.match(t, /Svanstrom, Alonso-Fernandez, Englund \(2021\)/);
  assert.ok(html.includes('href="#records/research/X-run4"') && html.includes('href="#records/research/X-run5"'));
  assert.ok(html.includes('href="#records/research/M-run4"'));
  assert.ok(html.includes('href="#records/research/T-svan-1195"') && html.includes('href="#records/research/T-svan-897"'));
});

test('Detail: an experiment shows its verdict and only its own results', () => {
  const html = page('#records/research/X-run5'); const t = text(html);
  assert.match(t, /Verdict\s+S5/); assert.match(t, /KEEP v3\./);
  assert.match(t, /0\.736/); assert.match(t, /0\.079/);
  assert.doesNotMatch(t, /0\.648/); // run4's held-out set is a different test set
  assert.ok(html.includes('href="#records/research/M-run5"') && html.includes('href="#records/research/D-svanstrom"'));
  const none = text(page('#records/research/X-clips-compare'));
  assert.match(none, /No verdict is recorded in the ledger for this experiment/);
});

test('Detail: a test set lists its results and what it is drawn from; a result is a record too', () => {
  const t = text(page('#records/research/T-svan-897'));
  assert.match(t, /Drawn from/); assert.match(t, /D-svanstrom/); assert.match(t, /0\.736/);
  const r = page('#records/research/R-run5-T-svan-897-mAP50'); const rt = text(r);
  assert.match(rt, /Result · R-run5-T-svan-897-mAP50/); assert.match(rt, /run5 scored 0\.736 mAP50 on T-svan-897\./);
  assert.match(rt, /T-svan-897/); assert.ok(r.includes('href="#records/source/S5/41"'));
  assert.match(rt, /Beside, same test set v3 0\.079 S5 · L41/);
});

test('Detail: an unknown record is an honest empty state', () => {
  const t = text(page('#records/research/R-made-up'));
  assert.match(t, /No record called R-made-up/); assert.match(t, /Nothing to show/);
});

test('Source: the ledger viewer highlights the cited line and lists the records that cite it', () => {
  const html = page('#records/source/S5/34'); const t = text(html);
  assert.match(t, /Ledger S5/); assert.match(t, /Results: mAP50/);
  assert.match(html, /<li id="L34" aria-current="location" class="hit">/);
  assert.match(t, /v3 ?\.pt on T-roboflow-800: 0\.853/);
  assert.match(t, /Records that cite line 34/);
  assert.ok(html.includes('href="#records/research/R-v3.pt-T-roboflow-800-mAP50"'));
  assert.match(text(page('#records/source/S99')), /No ledger section S99/);
});

test('unknown Records addresses say so', () => {
  assert.match(text(page('#records/bogus/path')), /Page not found/);
});

test('keyboard and landmarks: skip link, one h1, labelled navs, current page marked', () => {
  const html = page('#records/results');
  assert.match(html, /<button class="skip"/);
  assert.equal((html.match(/<h1/g) || []).length, 1);
  assert.equal((html.match(/<main /g) || []).length, 1);
  assert.match(html, /<nav aria-label="Records sections"/);
  assert.match(html, /<a href="#records\/results" aria-current="page">Results<\/a>/);
  assert.match(html, /<a href="#sky">Sky<\/a>/); assert.match(html, /<a href="#">Earth<\/a>/);
  assert.match(html, /<main id="records-main" tabindex="-1">/);
});

test('empty data: every page renders honest empty states and does not crash', () => {
  const empty = { models: [], experiments: [], datasets: [], evaluations: [], gaps: [], notes: [] };
  const index = { ...model.buildIndex(empty), ledger: ledger.parseLedger(LEDGER) };
  const view = (route) => text(renderToStaticMarkup(React.createElement(mod.RecordsView, { route, index })));
  const o = view({ page: 'overview' });
  assert.match(o, /No results in the ledger yet/);
  assert.doesNotMatch(o, /NaN|undefined/);
  const r = view({ page: 'results', testSetId: null });
  assert.match(r, /No results in the ledger yet/); assert.match(r, /Not measured/);
  assert.match(view({ page: 'research' }), /Research/);
  assert.match(view({ page: 'record', id: 'M-v3' }), /No record called M-v3/);
});

// ---- the stylesheet: contrast, text size, reduced motion ----
const CSS = read('./records.css');
const lum = (hex) => { const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const token = (name) => new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`).exec(CSS.slice(CSS.indexOf('.rec {')))[1];

test('contrast: every text colour is at least 4.5:1 on every surface it can sit on', () => {
  for (const fg of ['bone', 'fog', 'dim', 'sage']) for (const bg of ['bg', 'panel', 'hit']) {
    assert.ok(ratio(token(fg), token(bg)) >= 4.5, `${fg} on ${bg} = ${ratio(token(fg), token(bg)).toFixed(2)}`);
  }
  // high-contrast override
  const more = CSS.slice(CSS.indexOf('prefers-contrast: more'));
  assert.ok(ratio(/--dim:\s*(#[0-9a-fA-F]{6})/.exec(more)[1], token('panel')) >= 4.5);
});

test('text size: nothing under 12px', () => {
  const sizes = [...CSS.matchAll(/font:\s*(?:\d{3}\s+)?(\d+(?:\.\d+)?)px/g)].map((m) => Number(m[1])).concat([...CSS.matchAll(/font-size:\s*(\d+(?:\.\d+)?)px/g)].map((m) => Number(m[1])));
  assert.ok(sizes.length > 10);
  assert.equal(Math.min(...sizes) >= 12, true, `smallest is ${Math.min(...sizes)}px`);
});

test('motion and focus: reduced-motion rule and a visible focus ring exist', () => {
  assert.match(CSS, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(CSS, /\.rec :focus-visible \{ outline: 2px solid/);
  assert.doesNotMatch(CSS, /@keyframes/);
});
