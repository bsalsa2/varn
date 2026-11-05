import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createClient } from './client.js';

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
function fake(handler) { const calls = []; const fn = async (url, init) => { calls.push({ url, init }); return handler(url, init, calls.length); }; fn.calls = calls; return fn; }

test('client: login keeps the token in memory only and asks send it as a bearer token', async () => {
  const f = fake((url) => (url.endsWith('/v1/login') ? json({ token: 'tok.sig', expires_in: 28800 }) : json({ type: 'answer', text: 'ok', sources: [] })));
  const c = createClient({ base: 'https://w.example', fetchImpl: f });
  assert.equal(c.signedIn, false);
  assert.deepEqual(await c.login('pw'), { ok: true }); assert.equal(c.signedIn, true);
  const r = await c.ask('hello', { view: {} });
  assert.equal(r.response.type, 'answer');
  assert.equal(f.calls[1].init.headers.authorization, 'Bearer tok.sig');
  assert.equal(f.calls[0].init.headers.authorization, undefined);
  assert.equal(f.calls[1].init.credentials, 'omit'); assert.equal(f.calls[1].init.cache, 'no-store');
  assert.deepEqual(JSON.parse(f.calls[1].init.body), { question: 'hello', live: { view: {} } });
  await c.ask('yes', {}, [{ role: 'user', text: 'hi' }]);
  assert.deepEqual(JSON.parse(f.calls[2].init.body).history, [{ role: 'user', text: 'hi' }]);
  c.signOut(); assert.equal(c.signedIn, false);
});

test('client: the token is never written to browser storage, a cookie or the URL', () => {
  const code = fs.readFileSync(new URL('./client.js', import.meta.url), 'utf8').replace(/^\s*\/\/.*$/gm, '');
  assert.doesNotMatch(code, /localStorage|sessionStorage|indexedDB|document\.cookie|location\.|history\./);
  const panel = fs.readFileSync(new URL('./AskPanel.jsx', import.meta.url), 'utf8').replace(/^\s*\/\/.*$/gm, '');
  assert.doesNotMatch(panel, /localStorage|sessionStorage|indexedDB|document\.cookie/);
});

test('client: a wrong password reports the Worker\'s message and stays signed out', async () => {
  const c = createClient({ base: 'https://w', fetchImpl: fake(() => json({ error: 'bad_credentials', message: 'Wrong password.' }, 401)) });
  const r = await c.login('nope'); assert.equal(r.ok, false); assert.equal(r.message, 'Wrong password.'); assert.equal(c.signedIn, false);
  const locked = createClient({ base: 'https://w', fetchImpl: fake(() => json({ error: 'locked', message: 'Too many wrong passwords. Try again later.', retry_after_s: 900 }, 429)) });
  const l = await locked.login('nope'); assert.equal(l.retry_after_s, 900); assert.equal(l.status, 429);
});

test('client: a 401 from /v1/ask signs the session out; asking while signed out never calls the network', async () => {
  const f = fake((url) => (url.endsWith('/v1/login') ? json({ token: 't.s' }) : json({ error: 'unauthorized' }, 401)));
  const c = createClient({ base: 'https://w', fetchImpl: f });
  assert.equal((await c.ask('hi', {})).error, 'unauthorized'); assert.equal(f.calls.length, 0);
  await c.login('pw'); const r = await c.ask('hi', {});
  assert.equal(r.error, 'unauthorized'); assert.equal(c.signedIn, false);
});

test('client: network failures and bad replies give a friendly message, not an exception', async () => {
  const down = createClient({ base: 'https://w', fetchImpl: async () => { throw new TypeError('fetch failed'); } });
  assert.match((await down.login('pw')).message, /Could not reach/);
  const junk = createClient({ base: 'https://w', fetchImpl: async () => new Response('<html>', { status: 502 }) });
  const r = await junk.login('pw'); assert.equal(r.ok, false); assert.match(r.message, /unavailable/);
});

test('client: limit and rate messages from the Worker are passed through', async () => {
  const f = fake((url) => (url.endsWith('/v1/login') ? json({ token: 't.s' }) : json({ error: 'limit_reached', message: 'Limit reached for today. It resets at 00:00 UTC.' }, 429)));
  const c = createClient({ base: 'https://w', fetchImpl: f }); await c.login('pw');
  const r = await c.ask('q', {}); assert.match(r.message, /Limit reached for today/); assert.equal(c.signedIn, true);
});
