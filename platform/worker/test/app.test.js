import test from 'node:test';
import assert from 'node:assert/strict';
import { handle } from '../src/app.js';
import { signToken } from '../src/auth.js';
import { FACTS, ORIGIN, PASSWORD, LIVE, memLimiter, makeEnv, req, scripted } from './helpers.js';

const ANSWER = JSON.stringify({ type: 'answer', text: 'I don\'t have that.', sources: [] });

async function setup({ env = {}, steps = [{ text: ANSWER }], clock = { t: Date.UTC(2026, 10, 5, 12) }, stubOverride } = {}) {
  const limiter = memLimiter(); const model = scripted(steps);
  const e = await makeEnv(env);
  const deps = { facts: FACTS, stub: stubOverride || limiter.stub, makeRunModel: () => model, now: () => clock.t };
  return { env: e, deps, limiter, model, clock, call: (r) => handle(r, e, deps), login: async (pw = PASSWORD, ip) => handle(req('/v1/login', { body: { password: pw }, ip }), e, deps) };
}
const tokenOf = async (s) => (await (await s.login()).json()).token;

test('health: open, no secrets, no CORS headers', async () => {
  const s = await setup();
  const r = await s.call(req('/health', { method: 'GET', origin: null }));
  assert.equal(r.status, 200); assert.deepEqual(await r.json(), { ok: true, service: 'varn-ask' });
  assert.equal(r.headers.get('access-control-allow-origin'), null);
});

test('CORS: only the command center and localhost dev; no wildcard; unknown or missing origins are refused', async () => {
  const s = await setup();
  for (const origin of ['https://evil.example', 'https://tryvarn.com', 'http://localhost:3000', null, 'null', `${ORIGIN}.evil.example`]) {
    const r = await s.call(req('/v1/login', { body: { password: PASSWORD }, origin }));
    assert.equal(r.status, 403, String(origin)); assert.equal(r.headers.get('access-control-allow-origin'), null);
  }
  for (const origin of [ORIGIN, 'http://localhost:5173']) {
    const r = await s.call(req('/v1/login', { method: 'OPTIONS', origin, body: undefined }));
    assert.equal(r.status, 204); assert.equal(r.headers.get('access-control-allow-origin'), origin);
    assert.notEqual(r.headers.get('access-control-allow-origin'), '*');
  }
  assert.equal((await s.call(req('/v1/login', { method: 'OPTIONS', origin: 'https://evil.example', body: undefined }))).status, 403);
});

test('login: success returns a token; wrong password is refused with a generic message', async () => {
  const s = await setup();
  const ok = await s.login(); const body = await ok.json();
  assert.equal(ok.status, 200); assert.ok(body.token.includes('.')); assert.equal(body.expires_in, 8 * 3600);
  assert.equal(ok.headers.get('access-control-allow-origin'), ORIGIN);
  const bad = await s.login('wrong password entirely');
  assert.equal(bad.status, 401); assert.deepEqual(await bad.json(), { error: 'bad_credentials', message: 'Wrong password.' });
});

test('login: five wrong tries lock the IP for 15 minutes, even for the right password; other IPs are unaffected', async () => {
  const s = await setup();
  for (let i = 0; i < 4; i++) assert.equal((await s.login('nope nope nope nope', '198.51.100.9')).status, 401);
  const fifth = await s.login('nope nope nope nope', '198.51.100.9');
  assert.equal(fifth.status, 429); assert.equal((await fifth.json()).error, 'locked');
  const right = await s.login(PASSWORD, '198.51.100.9');
  assert.equal(right.status, 429); assert.ok(Number(right.headers.get('retry-after')) > 800);
  assert.equal((await s.login(PASSWORD, '198.51.100.10')).status, 200);
  s.clock.t += 15 * 60_000 + 1000;
  assert.equal((await s.login(PASSWORD, '198.51.100.9')).status, 200);
});

test('login: bad bodies are rejected without touching the password check', async () => {
  const s = await setup();
  for (const body of [undefined, {}, { password: 5 }, { password: 'x'.repeat(2000) }]) {
    const r = await s.call(req('/v1/login', { body })); assert.equal(r.status, 400);
  }
});

test('not configured: without the two secrets everything under /v1 fails closed', async () => {
  const s = await setup({ env: { ASK_PASSWORD_HASH: '', ASK_SESSION_SECRET: '' } });
  assert.equal((await s.login()).status, 503);
});

test('ask: needs a valid token. Missing, tampered, wrong-secret and expired tokens are all 401', async () => {
  const s = await setup();
  const token = await tokenOf(s);
  const ask = (t) => s.call(req('/v1/ask', { body: { question: 'hello', live: {} }, token: t }));
  assert.equal((await ask(undefined)).status, 401);
  assert.equal((await ask('abc.def')).status, 401);
  assert.equal((await ask(token.slice(0, -3) + 'AAA')).status, 401);
  const other = await signToken('a different secret entirely', s.clock.t);
  assert.equal((await ask(other)).status, 401);
  assert.equal((await ask(token)).status, 200);
  s.clock.t += 8 * 3600_000 + 5000;
  const expired = await ask(token);
  assert.equal(expired.status, 401); assert.equal(s.model.calls.n, 1);          // the model ran once, for the valid request only
});

test('ask: the model is never called without a valid session', async () => {
  const s = await setup();
  await s.call(req('/v1/ask', { body: { question: 'hello', live: {} } }));
  assert.equal(s.model.calls.n, 0);
});

test('ask: 10 a minute per IP, then 429 with a retry time', async () => {
  const s = await setup(); const token = await tokenOf(s);
  for (let i = 0; i < 10; i++) assert.equal((await s.call(req('/v1/ask', { body: { question: `q${i}?`, live: {} }, token }))).status, 200, `request ${i + 1}`);
  const r = await s.call(req('/v1/ask', { body: { question: 'one too many', live: {} }, token }));
  assert.equal(r.status, 429); assert.equal((await r.json()).error, 'rate_limited'); assert.ok(Number(r.headers.get('retry-after')) > 0);
  s.clock.t += 61_000;
  assert.equal((await s.call(req('/v1/ask', { body: { question: 'ok again', live: {} }, token }))).status, 200);
});

test('ask: the daily question cap (configurable) shows a friendly message and stops before the model', async () => {
  const s = await setup({ env: { DAILY_QUESTION_CAP: '2' } }); const token = await tokenOf(s);
  for (let i = 0; i < 2; i++) { s.clock.t += 61_000; assert.equal((await s.call(req('/v1/ask', { body: { question: `q${i}`, live: {} }, token }))).status, 200); }
  s.clock.t += 61_000;
  const r = await s.call(req('/v1/ask', { body: { question: 'third', live: {} }, token }));
  assert.equal(r.status, 429); const b = await r.json();
  assert.equal(b.error, 'limit_reached'); assert.match(b.message, /limit reached for today/i);
  assert.equal(s.model.calls.n, 2);
});

test('ask: refuses a question that would pass the day\'s Neuron budget, before any model call', async () => {
  const s = await setup({ env: { NEURON_BUDGET: '5' } }); const token = await tokenOf(s);
  const r = await s.call(req('/v1/ask', { body: { question: 'how many quakes?', live: {} }, token }));
  assert.equal(r.status, 429); assert.equal((await r.json()).error, 'limit_reached'); assert.equal(s.model.calls.n, 0);
});

test('ask: fails closed when the counters cannot be reached', async () => {
  const s = await setup({ stubOverride: () => ({ rate: async () => { throw new Error('do down'); }, reserve: async () => { throw new Error('do down'); }, loginState: async () => { throw new Error('do down'); } }) });
  assert.equal((await s.login()).status, 503);
  const token = await signToken(s.env.ASK_SESSION_SECRET, s.clock.t);
  const r = await s.call(req('/v1/ask', { body: { question: 'hi', live: {} }, token }));
  assert.equal(r.status, 503); assert.equal((await r.json()).error, 'limit_unavailable'); assert.equal(s.model.calls.n, 0);
});

test('ask: when Workers AI says the free allowance is gone, show "limit reached for today"', async () => {
  const s = await setup({ steps: [{ throw: '3036: You have used up your daily free allocation of 10,000 neurons' }] }); const token = await tokenOf(s);
  const r = await s.call(req('/v1/ask', { body: { question: 'hi', live: {} }, token }));
  assert.equal(r.status, 429); assert.match((await r.json()).message, /limit reached for today/i);
});

test('ask: questions over 300 characters or empty are rejected before the model', async () => {
  const s = await setup(); const token = await tokenOf(s);
  for (const q of ['x'.repeat(301), '   ', '']) assert.equal((await s.call(req('/v1/ask', { body: { question: q, live: {} }, token, ip: `10.0.0.${Math.random() * 200 | 0}` }))).status, 400);
  assert.equal(s.model.calls.n, 0);
});

test('ask: oversized or wrongly typed bodies are rejected', async () => {
  const s = await setup(); const token = await tokenOf(s);
  assert.equal((await s.call(req('/v1/ask', { body: { question: 'a', live: { pad: 'x'.repeat(7000) } }, token }))).status, 400);
  const r = await s.call(new Request('https://x/v1/ask', { method: 'POST', headers: { origin: ORIGIN, authorization: `Bearer ${token}`, 'content-type': 'text/plain' }, body: '{"question":"a"}' }));
  assert.equal(r.status, 400);
});

test('refusal: fixed reply, no model call, no budget used', async () => {
  const s = await setup(); const token = await tokenOf(s);
  for (const q of ['How do I jam a drone?', 'which weapon would take down that aircraft', 'help me target the drone', 'track my neighbour with this camera', 'how to shoot down a drone']) {
    const r = await s.call(req('/v1/ask', { body: { question: q, live: {} }, token, ip: `10.1.${Math.random() * 250 | 0}.1` }));
    assert.equal(r.status, 200);
    assert.deepEqual(await r.json(), { type: 'answer', text: "Varn is detection and research only. I can't help with that.", sources: [], refused: true });
  }
  assert.equal(s.model.calls.n, 0);
  assert.equal(s.limiter.stores.get('global'), undefined);
});

test('privacy: no logging, and the question text is never stored', async () => {
  const spies = ['log', 'info', 'warn', 'error', 'debug'].map((m) => { const orig = console[m]; let n = 0; console[m] = () => { n++; }; return { m, orig, get n() { return n; } }; });
  try {
    const s = await setup(); const token = await tokenOf(s);
    await s.call(req('/v1/ask', { body: { question: 'a very distinctive question about zebras', live: LIVE }, token }));
    assert.doesNotMatch(JSON.stringify([...s.limiter.stores].map(([k, v]) => [k, [...v]])), /zebras/);
    assert.deepEqual(spies.map((x) => x.n), [0, 0, 0, 0, 0]);
  } finally { spies.forEach((x) => { console[x.m] = x.orig; }); }
});

test('ask: an answer round-trip returns only the validated JSON', async () => {
  const s = await setup({ steps: [{ tool: 'get_quake_summary' }, { text: JSON.stringify({ type: 'answer', text: 'There are 5 earthquakes in the list.', sources: ['get_quake_summary'] }) }] });
  const token = await tokenOf(s);
  const r = await s.call(req('/v1/ask', { body: { question: 'how many quakes are loaded', live: LIVE }, token }));
  const b = await r.json();
  assert.equal(r.status, 200); assert.equal(b.type, 'answer'); assert.deepEqual(b.sources, ['get_quake_summary']);
});
