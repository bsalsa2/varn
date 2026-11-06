// Counting rules, written against a tiny async store so they can be tested without Cloudflare.
// In production the store is a SQLite-backed Durable Object (see do.js): one per IP for rate and login attempts,
// and one global for the day's questions and Neuron budget. Durable Objects are on the Workers Free plan (SQLite
// backend only); KV is not used because its free tier allows only 1,000 writes a day.
export const RATE = { limit: 10, windowMs: 60_000 };
export const LOGIN = { maxFails: 5, windowMs: 15 * 60_000, blockMs: 15 * 60_000 };
export const dayKey = (now) => new Date(now).toISOString().slice(0, 10);          // resets at 00:00 UTC, like Workers AI

export async function rateCheck(store, now, { limit, windowMs } = RATE) {
  const hits = ((await store.get('rate')) || []).filter((t) => now - t < windowMs);
  if (hits.length >= limit) { await store.put('rate', hits); return { ok: false, retryAfterMs: windowMs - (now - hits[0]) }; }
  hits.push(now); await store.put('rate', hits);
  return { ok: true };
}

export async function loginState(store, now) {
  const s = (await store.get('login')) || { fails: [], blockedUntil: 0 };
  return s.blockedUntil > now ? { blocked: true, retryAfterMs: s.blockedUntil - now } : { blocked: false };
}
export async function loginFailed(store, now, cfg = LOGIN) {
  const s = (await store.get('login')) || { fails: [], blockedUntil: 0 };
  s.fails = s.fails.filter((t) => now - t < cfg.windowMs); s.fails.push(now);
  if (s.fails.length >= cfg.maxFails) { s.blockedUntil = now + cfg.blockMs; s.fails = []; }
  await store.put('login', s);
  return s.blockedUntil > now ? { blocked: true, retryAfterMs: s.blockedUntil - now } : { blocked: false, left: cfg.maxFails - s.fails.length };
}
export async function loginSucceeded(store) { await store.delete('login'); }

/** Reserve a worst-case estimate before the model runs. Refuses when the day's question cap or Neuron budget would be passed. */
export async function reserve(store, now, estimate, { questionCap, budget }) {
  const key = `day:${dayKey(now)}`;
  const d = (await store.get(key)) || { q: 0, neurons: 0 };
  if (d.q + 1 > questionCap) return { ok: false, reason: 'questions', used: d.q, cap: questionCap };
  if (d.neurons + estimate > budget) return { ok: false, reason: 'budget', used: Math.round(d.neurons), budget };
  d.q += 1; d.neurons += estimate;
  await store.put(key, d);
  return { ok: true, key, reserved: estimate, questions: d.q, neurons: Math.round(d.neurons) };
}
export async function settle(store, key, reserved, actual) {
  const d = (await store.get(key)) || { q: 0, neurons: 0 };
  d.neurons = Math.max(0, d.neurons - reserved + actual);
  await store.put(key, d);
  return { neurons: Math.round(d.neurons) };
}
