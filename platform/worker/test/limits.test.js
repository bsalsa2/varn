import test from 'node:test';
import assert from 'node:assert/strict';
import { rateCheck, loginState, loginFailed, loginSucceeded, reserve, settle, dayKey, RATE, LOGIN } from '../src/limits.js';
import { estimateQuestion, actualCost, cost } from '../src/budget.js';

const store = () => { const m = new Map(); return { get: async (k) => structuredClone(m.get(k)), put: async (k, v) => { m.set(k, structuredClone(v)); }, delete: async (k) => { m.delete(k); } }; };
const T = Date.UTC(2026, 10, 5, 12, 0, 0);

test('rate: 10 a minute per IP, then blocked until the oldest request ages out', async () => {
  const s = store();
  for (let i = 0; i < RATE.limit; i++) assert.equal((await rateCheck(s, T + i * 100)).ok, true);
  const r = await rateCheck(s, T + 1500);
  assert.equal(r.ok, false); assert.ok(r.retryAfterMs > 0 && r.retryAfterMs <= 60000);
  assert.equal((await rateCheck(s, T + 61_000)).ok, true);
});

test('login: 5 wrong tries lock the IP for 15 minutes, then it opens again', async () => {
  const s = store();
  for (let i = 0; i < 4; i++) assert.equal((await loginFailed(s, T + i * 1000)).blocked, false);
  assert.equal((await loginState(s, T + 5000)).blocked, false);
  const f = await loginFailed(s, T + 5000);
  assert.equal(f.blocked, true); assert.equal(f.retryAfterMs, LOGIN.blockMs);
  assert.equal((await loginState(s, T + 60_000)).blocked, true);
  assert.equal((await loginState(s, T + 5000 + LOGIN.blockMs - 1)).blocked, true);
  assert.equal((await loginState(s, T + 5000 + LOGIN.blockMs)).blocked, false);
});

test('login: failures older than 15 minutes do not count, and success clears them', async () => {
  const s = store();
  for (let i = 0; i < 4; i++) await loginFailed(s, T + i);
  assert.equal((await loginFailed(s, T + LOGIN.windowMs + 10)).blocked, false);     // the first four aged out
  await loginSucceeded(s);
  for (let i = 0; i < 4; i++) assert.equal((await loginFailed(s, T + 2 * LOGIN.windowMs + i)).blocked, false);
});

test('daily: the question cap stops at the cap', async () => {
  const s = store(); const cfg = { questionCap: 3, budget: 8000 };
  for (let i = 0; i < 3; i++) assert.equal((await reserve(s, T, 100, cfg)).ok, true);
  const r = await reserve(s, T, 100, cfg);
  assert.deepEqual([r.ok, r.reason], [false, 'questions']);
});

test('daily: the Neuron budget refuses a question that would pass it, and settling gives unused Neurons back', async () => {
  const s = store(); const cfg = { questionCap: 60, budget: 1000 };
  const a = await reserve(s, T, 600, cfg); assert.equal(a.ok, true);
  assert.deepEqual([(await reserve(s, T, 600, cfg)).ok], [false]);
  await settle(s, a.key, 600, 100);                                     // the question really cost 100
  assert.equal((await reserve(s, T, 600, cfg)).ok, true);
});

test('daily: counters are per UTC day and reset at 00:00 UTC', async () => {
  const s = store(); const cfg = { questionCap: 1, budget: 8000 };
  assert.equal((await reserve(s, Date.UTC(2026, 10, 5, 23, 59), 10, cfg)).ok, true);
  assert.equal((await reserve(s, Date.UTC(2026, 10, 5, 23, 59), 10, cfg)).ok, false);
  assert.equal((await reserve(s, Date.UTC(2026, 10, 6, 0, 0), 10, cfg)).ok, true);
  assert.equal(dayKey(Date.UTC(2026, 10, 6, 0, 0)), '2026-11-06');
});

test('budget: a worst-case question reserves a sensible number of Neurons and the default day fits dozens of them', () => {
  const est = estimateQuestion('x'.repeat(4500));
  assert.ok(est > 50 && est < 400, String(est));
  assert.ok(Math.floor(8000 / est) >= 25);
  assert.ok(Math.abs(cost(1_000_000, 0) - 9091) < 1e-6 && Math.abs(cost(0, 1_000_000) - 27273) < 1e-6);
  assert.ok(actualCost({ usage: { prompt_tokens: 1000, completion_tokens: 100 } }) < est);
  assert.ok(actualCost({ messages: [{ content: 'hi' }], output: 'ok' }) > 0);
});
