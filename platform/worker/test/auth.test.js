import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { hashPassword, verifyPassword, parseHash, signToken, verifyToken, constantTimeEqual, MAX_ITERATIONS, b64u, SESSION_SECONDS } from '../src/auth.js';
import { makeSecrets, checkPolicy, MIN_LENGTH, putSecret, savePair } from '../tools/make_password_hash.mjs';

const SECRET = b64u.enc(crypto.getRandomValues(new Uint8Array(32)));

test('password: right password verifies, wrong ones do not', async () => {
  const h = await hashPassword('a long enough passphrase', { iterations: 1000 });
  assert.match(h, /^pbkdf2-sha256:1000:[\w-]+:[\w-]+$/);
  assert.equal(await verifyPassword('a long enough passphrase', h), true);
  for (const bad of ['a long enough passphrasE', '', ' a long enough passphrase', 'x'.repeat(300), null, undefined, 42]) assert.equal(await verifyPassword(bad, h), false);
});

test('password: salts are random, so the same password hashes differently', async () => {
  const [a, b] = await Promise.all([hashPassword('same password here', { iterations: 1000 }), hashPassword('same password here', { iterations: 1000 })]);
  assert.notEqual(a, b);
});

test('password: a missing, malformed or over-limit stored hash never verifies', async () => {
  for (const stored of [undefined, '', 'garbage', 'pbkdf2-sha256:1000:AAAA', 'md5:1000:AAAAAAAAAAAAAAAA:AAAA', `pbkdf2-sha256:${MAX_ITERATIONS + 1}:AAAAAAAAAAAAAAAAAAAAAA:${'A'.repeat(43)}`]) {
    assert.equal(await verifyPassword('anything at all', stored), false, String(stored));
  }
  assert.equal(parseHash(`pbkdf2-sha256:${MAX_ITERATIONS + 1}:AAAAAAAAAAAAAAAAAAAAAA:${'A'.repeat(43)}`), null);
  await assert.rejects(() => hashPassword('x', { iterations: MAX_ITERATIONS + 1 }));
});

test('constantTimeEqual', () => {
  assert.equal(constantTimeEqual('abc', 'abc'), true);
  assert.equal(constantTimeEqual('abc', 'abd'), false);
  assert.equal(constantTimeEqual('abc', 'abcd'), false);
  assert.equal(constantTimeEqual(new Uint8Array([1, 2]), new Uint8Array([1, 2])), true);
});

test('token: a fresh token verifies and lasts 8 hours', async () => {
  const now = 1_800_000_000_000;
  const t = await signToken(SECRET, now);
  assert.equal((await verifyToken(SECRET, t, now + 1000)).ok, true);
  assert.equal(SESSION_SECONDS, 8 * 3600);
  assert.equal((await verifyToken(SECRET, t, now + 8 * 3600 * 1000 - 1000)).ok, true);
});

test('token: expires after 8 hours', async () => {
  const now = 1_800_000_000_000;
  const t = await signToken(SECRET, now);
  const r = await verifyToken(SECRET, t, now + 8 * 3600 * 1000 + 1000);
  assert.deepEqual(r, { ok: false, reason: 'expired' });
});

test('token: tampering with payload or signature, or another secret, is rejected', async () => {
  const now = 1_800_000_000_000;
  const t = await signToken(SECRET, now);
  const [p, s] = t.split('.');
  const longer = JSON.parse(new TextDecoder().decode(b64u.dec(p))); longer.exp += 99999;
  const forged = `${b64u.enc(new TextEncoder().encode(JSON.stringify(longer)))}.${s}`;
  assert.equal((await verifyToken(SECRET, forged, now)).reason, 'bad_signature');
  assert.equal((await verifyToken(SECRET, `${p}.${s.slice(0, -2)}AA`, now)).ok, false);
  assert.equal((await verifyToken(b64u.enc(crypto.getRandomValues(new Uint8Array(32))), t, now)).reason, 'bad_signature');
  for (const junk of ['', 'abc', 'a.b.c', `${p}.`, '.', 'x'.repeat(500), null, 7]) assert.equal((await verifyToken(SECRET, junk, now)).ok, false, String(junk));
});

test('token: a signature over a different payload shape is rejected even if validly signed', async () => {
  const bytes = new TextEncoder().encode(JSON.stringify({ v: 2, iat: 1, exp: 99999999999 }));
  const payload = b64u.enc(bytes);
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = b64u.enc(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload)));
  assert.equal((await verifyToken(SECRET, `${payload}.${sig}`, 5000)).reason, 'malformed');
});

test('make_password_hash: enforces 10 characters and yields a hash the Worker accepts', async () => {
  assert.equal(MIN_LENGTH, 10);
  assert.ok(checkPolicy('short one'));
  assert.ok(checkPolicy('123456789'));              // 9
  assert.equal(checkPolicy('1234567890'), null);    // 10
  assert.ok(checkPolicy(' leading space here'));
  await assert.rejects(() => makeSecrets('too short'));
  const s = await makeSecrets('this is a long passphrase');
  assert.equal(await verifyPassword('this is a long passphrase', s.ASK_PASSWORD_HASH), true);
  assert.match(s.ASK_PASSWORD_HASH, new RegExp(`^pbkdf2-sha256:${MAX_ITERATIONS}:`));
  assert.ok(s.ASK_SESSION_SECRET.length >= 43);
  const again = await makeSecrets('this is a long passphrase');
  assert.notEqual(again.ASK_SESSION_SECRET, s.ASK_SESSION_SECRET);
});

test('make_password_hash: never writes the password anywhere and does not echo it', () => {
  const src = fs.readFileSync(new URL('../tools/make_password_hash.mjs', import.meta.url), 'utf8').replace(/^\s*\/\/.*$/gm, '');   // code only, not comments
  assert.doesNotMatch(src, /writeFile|appendFile|createWriteStream|writeSync|clipboard|node:fs|from 'fs'/i);
  assert.match(src, /setRawMode\(true\)/);            // keys are read raw, so nothing is echoed
  assert.match(src, /isTTY/);                          // refuses piped input
  assert.doesNotMatch(src, /\$\{\s*(a|b|password|buf)\s*\}/);   // the password variables are never interpolated into output
});

test('make_password_hash: the command-line part really runs (it used to do nothing on Windows) and refuses piped input', async () => {
  const { spawnSync } = await import('node:child_process');
  const r = spawnSync(process.execPath, [new URL('../tools/make_password_hash.mjs', import.meta.url).pathname], { input: 'x\n', encoding: 'utf8' });
  assert.equal(r.status, 1); assert.match(r.stderr, /Run this in a terminal/);
  assert.equal(r.stdout, '');
  const src = fs.readFileSync(new URL('../tools/make_password_hash.mjs', import.meta.url), 'utf8').replace(/^\s*\/\/.*$/gm, '');
  assert.doesNotMatch(src, /file:\/\/\$\{process\.argv/);          // the comparison that never matched on Windows
  assert.match(src, /pathToFileURL\(path\.resolve\(process\.argv\[1\]\)\)/);
});

test('make_password_hash --put: values go to wrangler through stdin, never through arguments, and are never logged', async () => {
  const s = await makeSecrets('a random 10 pw');
  const calls = [], logs = [];
  const fake = (cmd, args, opts) => { calls.push({ cmd, args, opts }); return { status: 0, stdout: 'Success! Uploaded secret', stderr: '' }; };
  assert.equal(savePair(s, (l) => logs.push(l), fake), true);
  assert.deepEqual(calls.map((c) => c.args), [['wrangler', 'secret', 'put', 'ASK_PASSWORD_HASH'], ['wrangler', 'secret', 'put', 'ASK_SESSION_SECRET']]);
  assert.equal(calls[0].opts.input, s.ASK_PASSWORD_HASH); assert.equal(calls[1].opts.input, s.ASK_SESSION_SECRET);
  for (const v of Object.values(s)) { assert.ok(!calls.some((c) => c.args.join(' ').includes(v))); assert.ok(!logs.join('\n').includes(v)); }
  assert.deepEqual(logs, ['ASK_PASSWORD_HASH: saved to Cloudflare', 'ASK_SESSION_SECRET: saved to Cloudflare']);
});

test('make_password_hash --put: a failure is reported, the value is scrubbed from any error text, and the result is false', async () => {
  const s = await makeSecrets('a random 10 pw'); const logs = [];
  const fake = () => ({ status: 1, stdout: '', stderr: `ERROR bad value ${s.ASK_PASSWORD_HASH}` });
  assert.equal(savePair(s, (l) => logs.push(l), fake), false);
  assert.ok(logs.some((l) => /FAILED/.test(l))); assert.ok(!logs.join('\n').includes(s.ASK_PASSWORD_HASH));
  assert.equal(putSecret('X', 'v', () => ({ status: 0, stdout: 'ok' })).ok, true);
});
