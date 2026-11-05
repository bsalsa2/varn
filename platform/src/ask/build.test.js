// The real production build. The public bundle must contain none of the assistant (code, copy, Worker URL, secret names),
// even if someone sets the private flag in their environment; a private build must contain it (so the check can fail).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { scan, MARKERS } from '../../scripts/check-no-ask.mjs';

const ROOT = new URL('../../', import.meta.url).pathname;
const VITE = path.join(ROOT, 'node_modules/vite/bin/vite.js');
const tmp = (n) => fs.mkdtempSync(path.join(os.tmpdir(), `varn-${n}-`));
const build = (out, args = [], env = {}) => spawnSync(process.execPath, [VITE, 'build', '--outDir', out, '--emptyOutDir', ...args], { cwd: ROOT, env: { ...process.env, ...env }, encoding: 'utf8', timeout: 240000 });
const check = (dir) => spawnSync(process.execPath, [path.join(ROOT, 'scripts/check-no-ask.mjs'), dir], { cwd: ROOT, encoding: 'utf8' });
const files = (dir) => { const out = []; const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).forEach((e) => (e.isDirectory() ? (e.name !== 'cesium' && walk(path.join(d, e.name))) : out.push(path.join(d, e.name)))); walk(dir); return out; };

test('public build: contains no assistant code, Worker URL or secrets, even with the flag and URL in the environment', () => {
  const out = tmp('public');
  try {
    const r = build(out, [], { VITE_PRIVATE_ASK: '1', VITE_ASK_URL: 'https://varn-ask.example.workers.dev' });   // a stray environment must not switch it on
    assert.equal(r.status, 0, r.stderr + r.stdout);
    assert.deepEqual(scan(out), []);
    const text = files(out).filter((f) => /\.(js|css|html)$/.test(f)).map((f) => fs.readFileSync(f, 'utf8')).join('\n');
    for (const m of [...MARKERS, 'ask-send', 'Ctrl+J', 'make_password_hash', 'wrangler']) assert.ok(!text.includes(m), `public bundle contains "${m}"`);
    assert.ok(!files(out).some((f) => /Ask|ask-/.test(path.basename(f))), 'an assistant chunk was emitted');
    assert.ok(files(out).some((f) => /RecordsApp/.test(f)), 'the normal app is still there');
    assert.equal(check(out).status, 0);
  } finally { fs.rmSync(out, { recursive: true, force: true }); }
});

test('private build: does include the assistant (so the public check can actually fail), and the check says so', () => {
  const out = tmp('private');
  try {
    const r = build(out, ['--mode', 'private'], { VITE_ASK_URL: 'https://varn-ask.example.workers.dev' });
    assert.equal(r.status, 0, r.stderr + r.stdout);
    const hits = scan(out);
    assert.ok(hits.some((h) => /AI assistant\. It can be wrong/.test(h)), JSON.stringify(hits));
    assert.ok(hits.some((h) => /ask-panel/.test(h)));
    const c = check(out); assert.equal(c.status, 1); assert.match(c.stderr, /contains assistant code/);
  } finally { fs.rmSync(out, { recursive: true, force: true }); }
});
