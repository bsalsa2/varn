import fs from 'node:fs';
import { rateCheck, loginState, loginFailed, loginSucceeded, reserve, settle } from '../src/limits.js';
import { hashPassword, b64u } from '../src/auth.js';

export const FACTS = JSON.parse(fs.readFileSync(new URL('../../src/data/facts.json', import.meta.url), 'utf8'));
export const ORIGIN = 'https://varn-command-center.pages.dev';
export const PASSWORD = 'correct horse battery staple';

/** In-memory stand-in for the Durable Objects: same counting code, one store per name. */
export function memLimiter() {
  const stores = new Map();
  const store = (name) => {
    if (!stores.has(name)) stores.set(name, new Map());
    const m = stores.get(name);
    return { get: async (k) => structuredClone(m.get(k)), put: async (k, v) => { m.set(k, structuredClone(v)); }, delete: async (k) => { m.delete(k); } };
  };
  return {
    stores,
    stub: (name) => { const s = store(name); return { rate: (n) => rateCheck(s, n), loginState: (n) => loginState(s, n), loginFailed: (n) => loginFailed(s, n), loginSucceeded: () => loginSucceeded(s), reserve: (n, e, c) => reserve(s, n, e, c), settle: (k, r, a) => settle(s, k, r, a) }; },
  };
}

export async function makeEnv(extra = {}) {
  return {
    ALLOWED_ORIGINS: `${ORIGIN},http://localhost:5173`,
    ASK_PASSWORD_HASH: await hashPassword(PASSWORD, { iterations: 1000 }),
    ASK_SESSION_SECRET: b64u.enc(crypto.getRandomValues(new Uint8Array(32))),
    DAILY_QUESTION_CAP: '60', NEURON_BUDGET: '8000', ...extra,
  };
}

export function req(path, { method = 'POST', body, origin = ORIGIN, token, ip = '203.0.113.7', headers = {} } = {}) {
  const h = { 'content-type': 'application/json', 'cf-connecting-ip': ip, ...headers };
  if (origin) h.origin = origin;
  if (token) h.authorization = `Bearer ${token}`;
  return new Request(`https://varn-ask.example.workers.dev${path}`, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
}

/** A model that plays back a script: each step is { tool, args } or { text } (or { throw }). */
export function scripted(steps, calls = { n: 0, messages: [] }) {
  return Object.assign(async ({ messages }) => {
    calls.messages.push(messages); const s = steps[Math.min(calls.n, steps.length - 1)]; calls.n++;
    if (s.throw) throw new Error(s.throw);
    return s.tool ? { text: '', toolCalls: [{ id: `c${calls.n}`, name: s.tool, arguments: s.args || {} }], usage: null } : { text: s.text, toolCalls: [], usage: s.usage || null };
  }, { calls });
}

export const LIVE = {
  view: { alt_km: 1234.56, heading: 12, tilted: false, layers: ['satellite', 'terrain'], sun: 'daylight' },
  quakes: { window: 'day', min_mag: 2.5, mags: [6.1, 5.2, 4.4, 3.0, 2.6], ages_min: [10, 50, 120, 300, 600], fetched_age_s: 30 },
  events: { category: 'wildfires', days: 30, items: [{ cat: 'wildfires', age_h: 5 }, { cat: 'wildfires', age_h: 20 }, { cat: 'volcanoes', age_h: 2.5 }] },
  sim: { mode: 'SIM', tracks: [{ kind: 'matched', adsb: true }, { kind: 'drone', adsb: false }, { kind: 'drone', adsb: false }, { kind: 'unknown', adsb: false }] },
};
