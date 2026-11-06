// The request handler for varn-ask: a private, login-protected assistant for the VARN command center.
// Cloudflare-specific pieces (counters, model, bundled facts) are passed in as `deps`, so tests can fake them.
//   GET  /health      liveness (no secrets, no CORS)
//   POST /v1/login    { password } -> { token, expires_in }
//   POST /v1/ask      { question, live } with Authorization: Bearer <token> -> answer | command | raw
// Fails closed: a missing secret, an unreachable counter or an exhausted allowance all stop the request before any model call.
// Nothing about a question is logged or stored.
import { verifyPassword, signToken, verifyToken, SESSION_SECONDS } from './auth.js';
import { prepare, runAsk } from './ask.js';
import { shouldRefuse, REFUSAL } from './refuse.js';
import { isAllowanceError } from './model.js';

const DEFAULTS = { DAILY_QUESTION_CAP: 60, NEURON_BUDGET: 8000 };
const origins = (env) => String(env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
const num = (v, d) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : d; };

function reply(body, status, origin, extra = {}) {
  const h = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', vary: 'Origin', ...extra };
  if (origin) { h['access-control-allow-origin'] = origin; h['access-control-allow-headers'] = 'content-type, authorization'; h['access-control-allow-methods'] = 'POST, OPTIONS'; h['access-control-max-age'] = '600'; }
  return new Response(body == null ? null : JSON.stringify(body), { status, headers: h });
}

async function readJson(request, maxBytes) {
  const len = Number(request.headers.get('content-length') || 0);
  if (len > maxBytes) return null;
  if (!/^application\/json\b/i.test(request.headers.get('content-type') || '')) return null;
  const text = await request.text();
  if (text.length > maxBytes) return null;
  try { const j = JSON.parse(text); return j && typeof j === 'object' && !Array.isArray(j) ? j : null; } catch { return null; }
}

async function ipName(request) {
  const ip = request.headers.get('cf-connecting-ip') || 'unknown';
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`varn-ask:${ip}`));
  return 'ip:' + [...new Uint8Array(d)].slice(0, 16).map((b) => b.toString(16).padStart(2, '0')).join('');
}
export async function handle(request, env, deps) {
  const { facts, stub, makeRunModel } = deps;
  {
    const url = new URL(request.url);
    if (url.pathname === '/health' && request.method === 'GET') return reply({ ok: true, service: 'varn-ask' }, 200, null);

    if (!url.pathname.startsWith('/v1/')) return reply({ error: 'not_found' }, 404, null);

    // Only the command center may call this API. No wildcard; a missing or unknown Origin is refused.
    const origin = request.headers.get('origin');
    if (!origin || !origins(env).includes(origin)) return reply({ error: 'forbidden_origin' }, 403, null);
    if (request.method === 'OPTIONS') return reply(null, 204, origin);
    if (request.method !== 'POST') return reply({ error: 'method_not_allowed' }, 405, origin);
    if (!env.ASK_PASSWORD_HASH || !env.ASK_SESSION_SECRET) return reply({ error: 'not_configured', message: 'The assistant is not set up.' }, 503, origin);

    const now = (deps.now || Date.now)();
    try {
      if (url.pathname === '/v1/login') {
        const body = await readJson(request, 1024);
        if (!body || typeof body.password !== 'string') return reply({ error: 'bad_request' }, 400, origin);
        const ip = stub(await ipName(request));
        const st = await ip.loginState(now);
        if (st.blocked) return reply({ error: 'locked', retry_after_s: Math.ceil(st.retryAfterMs / 1000), message: 'Too many wrong passwords. Try again later.' }, 429, origin, { 'retry-after': String(Math.ceil(st.retryAfterMs / 1000)) });
        if (!(await verifyPassword(body.password, env.ASK_PASSWORD_HASH))) {
          const f = await ip.loginFailed(now);
          return f.blocked
            ? reply({ error: 'locked', retry_after_s: Math.ceil(f.retryAfterMs / 1000), message: 'Too many wrong passwords. Try again later.' }, 429, origin, { 'retry-after': String(Math.ceil(f.retryAfterMs / 1000)) })
            : reply({ error: 'bad_credentials', message: 'Wrong password.' }, 401, origin);
        }
        await ip.loginSucceeded();
        return reply({ token: await signToken(env.ASK_SESSION_SECRET, now), expires_in: SESSION_SECONDS }, 200, origin);
      }

      if (url.pathname === '/v1/ask') {
        const m = /^Bearer (\S+)$/.exec(request.headers.get('authorization') || '');
        const t = m ? await verifyToken(env.ASK_SESSION_SECRET, m[1], now) : { ok: false };
        if (!t.ok) return reply({ error: 'unauthorized', message: 'Sign in again.' }, 401, origin);
        const body = await readJson(request, 6000);
        if (!body || typeof body.question !== 'string') return reply({ error: 'bad_request' }, 400, origin);

        const rate = await stub(await ipName(request)).rate(now);
        if (!rate.ok) return reply({ error: 'rate_limited', retry_after_s: Math.ceil(rate.retryAfterMs / 1000), message: 'Too many questions this minute. Wait a moment.' }, 429, origin, { 'retry-after': String(Math.ceil(rate.retryAfterMs / 1000)) });

        if (shouldRefuse(body.question)) return reply({ type: 'answer', text: REFUSAL, sources: [], refused: true }, 200, origin);

        const p = prepare({ question: body.question, live: body.live, facts, history: body.history });
        if (p.error) return reply({ error: p.error, message: p.error === 'bad_question' ? 'Questions are 1 to 300 characters.' : 'The request was not in the expected form.' }, 400, origin);

        const cfg = { questionCap: num(env.DAILY_QUESTION_CAP, DEFAULTS.DAILY_QUESTION_CAP), budget: num(env.NEURON_BUDGET, DEFAULTS.NEURON_BUDGET) };
        const limiter = stub('global');
        const hold = await limiter.reserve(now, p.estimate, cfg);
        if (!hold.ok) return reply({ error: 'limit_reached', message: 'Limit reached for today. It resets at 00:00 UTC.' }, 429, origin);

        let out;
        try { out = await runAsk({ question: body.question, live: body.live, history: body.history, facts, runModel: makeRunModel(env) }); }
        catch (e) {
          await limiter.settle(hold.key, p.estimate, 0).catch(() => {});
          if (isAllowanceError(e)) return reply({ error: 'limit_reached', message: 'Limit reached for today. It resets at 00:00 UTC.' }, 429, origin);
          const code = /^gemini \d{3}( [A-Z_]+)?( @[\w.\-]+)?$/.exec(String(e?.message))?.[0];       // provider status only, so a setup problem is visible
          return reply({ error: 'model_unavailable', message: `The assistant is unavailable right now.${code ? ` (${code})` : ''}` }, 502, origin);
        }
        await limiter.settle(hold.key, p.estimate, out.neurons).catch(() => {});
        return out.error ? reply({ error: out.error }, 400, origin) : reply(out.response, 200, origin);
      }
      return reply({ error: 'not_found' }, 404, origin);
    } catch {
      // The counters could not be read or written: stop rather than run without limits.
      return reply({ error: 'limit_unavailable', message: 'Limits are unavailable. Try again later.' }, 503, origin);
    }
  }
}
