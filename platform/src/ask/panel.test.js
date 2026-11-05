// Renders the panel with the real components (Vite's SSR loader) and checks the contract: the label, the controls,
// the command chip, source chips, plus contrast, text size, reduced motion and the 390px layout rules in the CSS.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import React from 'react';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { renderToStaticMarkup } from 'react-dom/server';

const ROOT = new URL('../../', import.meta.url).pathname;
const CSS = fs.readFileSync(new URL('./ask.css', import.meta.url), 'utf8');
let server, mod;
before(async () => {
  server = await createServer({ root: ROOT, configFile: false, plugins: [react()], server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom', logLevel: 'silent', optimizeDeps: { noDiscovery: true, include: [] } });
  mod = await server.ssrLoadModule('/src/ask/AskPanel.jsx');
});
after(async () => { await server?.close(); });

const text = (h) => h.replace(/<[^>]+>/g, ' ').replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ' ');
const h = (C, props) => renderToStaticMarkup(React.createElement(C, props));

test('panel: the exact label is always visible and the button names the shortcut', () => {
  const html = h(mod.default);
  assert.equal(mod.DISCLAIMER, "AI assistant. It can be wrong. Answers come from the app's data; sources shown.");
  assert.ok(text(html).includes(mod.DISCLAIMER));
  assert.match(html, /aria-label="Ask the assistant \(Ctrl\+J\)"/);
  assert.match(html, /role="dialog"[^>]*aria-label="Ask the assistant"/);
});

test('panel: closed means hidden from keyboard and screen readers; signed out shows only a password form', () => {
  const html = h(mod.default);
  assert.match(html, /aria-hidden="true"/); assert.match(html, /inert=""/);
  assert.match(html, /<input id="ask-pw"[^>]*type="password"[^>]*autoComplete="off"|<input id="ask-pw"[^>]*type="password"/);
  assert.doesNotMatch(html, /id="ask-q"/);                              // no question box until signed in
  assert.match(text(html), /Private assistant/);
});

test('command chip: shows the command, a Run button and Dismiss; the human decides', () => {
  const html = h(mod.CommandChip, { msg: { id: 1, say: 'Show the fire layer.', command: 'layers fires on', kind: 'terminal' }, canRun: true, onRun() {}, onDismiss() {} });
  assert.match(html, /<code>layers fires on<\/code>/); assert.match(html, /class="ask-run"/); assert.match(html, />Dismiss</);
  assert.doesNotMatch(html, /disabled/);
  const off = h(mod.CommandChip, { msg: { id: 2, say: 'x', command: 'layers fires on', kind: 'terminal' }, canRun: false, onRun() {}, onDismiss() {} });
  assert.match(off, /disabled/); assert.match(text(off), /Commands run on the Earth view/);
  const done = h(mod.CommandChip, { msg: { id: 3, say: 'x', command: 'home', kind: 'terminal', state: 'ran', output: [{ t: 'ACK  home' }] }, canRun: true, onRun() {}, onDismiss() {} });
  assert.doesNotMatch(done, /class="ask-run"/); assert.match(text(done), /Ran/); assert.match(text(done), /ACK home/);
});

test('bubbles: answers show source chips; raw results are tucked in a disclosure; errors are labelled in words', () => {
  const ans = h(mod.Bubble, { msg: { id: 1, role: 'ai', type: 'answer', text: 'v3 scored 0.063.', sources: ['F-R-v3-T-svan-1195-mAP50', 'get_quake_summary'], cited: {} }, canRun: true });
  assert.match(ans, /<button type="button" aria-expanded="false">F-R-v3-T-svan-1195-mAP50<\/button>/); assert.match(ans, />get_quake_summary</);
  const raw = h(mod.Bubble, { msg: { id: 2, role: 'ai', type: 'raw', text: "I couldn't verify an answer (x), so here are the raw results.", results: [{ tool: 'get_quake_summary', count: 5 }], facts: [] }, canRun: true });
  assert.match(raw, /<details><summary>Raw results<\/summary>/); assert.match(raw, /get_quake_summary/);
  assert.match(h(mod.Bubble, { msg: { id: 3, role: 'ai', error: true, text: 'Limit reached for today.' }, canRun: true }), /<strong>Problem: <\/strong>Limit reached for today\./);
  assert.match(h(mod.Bubble, { msg: { id: 4, role: 'user', text: 'hello' }, canRun: true }), /ask-user/);
});

const lum = (hex) => { const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const tok = (n) => new RegExp(`--${n}:\\s*(#[0-9a-fA-F]{6})`).exec(CSS)[1];
const over = (fg, bg, a) => { const f = [1, 3, 5].map((i) => parseInt(fg.slice(i, i + 2), 16)), b = [1, 3, 5].map((i) => parseInt(bg.slice(i, i + 2), 16)); return '#' + f.map((v, i) => Math.round(v * a + b[i] * (1 - a)).toString(16).padStart(2, '0')).join(''); };

test('contrast: text is at least 4.5:1 on the glass, even over a pure-white map', () => {
  // worst case: the panel's charcoal scrim over a white backdrop, and the assistant bubble's white tint on top of that
  const scrim = +/--glass:\s*rgba\(11, 15, 20, ([\d.]+)\)/.exec(CSS)[1], tint = +/\.ask-ai \{[^}]*background: rgba\(255, 255, 255, ([\d.]+)\)/.exec(CSS)[1];
  const glass = over(tok('ink'), '#ffffff', scrim), bubble = over('#ffffff', glass, tint);
  for (const bg of [glass, bubble, '#0f151c', '#1b2630', tok('night')]) for (const fg of ['bone', 'fog', 'sage']) {
    assert.ok(ratio(tok(fg), bg) >= 4.5, `${fg} on ${bg}: ${ratio(tok(fg), bg).toFixed(2)}`);
  }
  assert.ok(ratio(tok('ink'), tok('bone')) >= 4.5);                       // dark text on the bone user bubble and Run button
});

test('text size: nothing under 12px', () => {
  const sizes = [...CSS.matchAll(/font:\s*(?:\d{3}\s+)?(\d+(?:\.\d+)?)px/g)].map((m) => +m[1]).concat([...CSS.matchAll(/font-size:\s*(\d+(?:\.\d+)?)px/g)].map((m) => +m[1]));
  assert.ok(sizes.length >= 10); assert.ok(Math.min(...sizes) >= 12, `smallest ${Math.min(...sizes)}px`);
});

test('accessibility rules exist: focus ring, reduced motion, reduced transparency, 390px layout', () => {
  assert.match(CSS, /\.ask :focus-visible \{ outline: 2px solid/);
  assert.match(CSS, /@media \(prefers-reduced-motion: reduce\)[\s\S]*transition: none/);
  assert.match(CSS, /@media \(prefers-reduced-transparency: reduce\)[\s\S]*backdrop-filter: none/);
  assert.match(CSS, /@media \(max-width: 480px\)[\s\S]*width: calc\(100vw - 24px\)/);
  assert.match(CSS, /width: min\(420px, calc\(100vw - 32px\)\)/);
});

test('shortcut: Ctrl+J toggles and Escape closes (wired in the component)', () => {
  const src = fs.readFileSync(new URL('./AskPanel.jsx', import.meta.url), 'utf8');
  assert.match(src, /e\.ctrlKey \|\| e\.metaKey/); assert.match(src, /key\.toLowerCase\(\) === 'j'/); assert.match(src, /e\.key === 'Escape'/);
});

test('cascade: buttons that sit on a bone background set their own dark text with enough specificity', () => {
  // `.ask button { color: inherit }` has specificity (0,1,1); a bare `.ask-run` (0,1,0) would lose and paint bone text on a bone button.
  for (const cls of ['ask-run', 'ask-send']) {
    assert.match(CSS, new RegExp(`^\\.ask \\.${cls} \\{[^}]*background: var\\(--bone\\)[^}]*color: var\\(--ink\\)|^\\.ask \\.${cls} \\{[^}]*color: var\\(--ink\\)`, 'm'), cls);
    assert.doesNotMatch(CSS, new RegExp(`^\\.${cls} \\{`, 'm'), `${cls} must be scoped under .ask`);
  }
});

test('cascade: no doubled selectors, and the button gets its glass background (a doubled `.ask .ask .ask-fab` matched nothing and left a white button)', () => {
  assert.doesNotMatch(CSS, /\.ask \.ask [.\w]/);
  assert.match(CSS, /^\.ask \.ask-fab, \.ask-panel \{\s*background: var\(--glass\)/m);
});
