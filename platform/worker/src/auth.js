// Password check and signed session tokens. Web Crypto only, so the same code runs in the Worker and in Node tests.
// Password hash format:  pbkdf2-sha256:<iterations>:<salt, base64url>:<hash, base64url>
// Session token format:  <payload, base64url JSON {v,iat,exp}>.<HMAC-SHA256 signature, base64url>
const enc = new TextEncoder();
export const MAX_ITERATIONS = 100000;          // the Workers runtime refuses more than this for PBKDF2 (see README)
export const SESSION_SECONDS = 8 * 3600;

export const b64u = {
  enc: (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''),
  dec: (s) => { const t = String(s).replace(/-/g, '+').replace(/_/g, '/'); const bin = atob(t + '='.repeat((4 - (t.length % 4)) % 4)); return Uint8Array.from(bin, (c) => c.charCodeAt(0)); },
};

/** Compares every byte even when lengths differ; never returns early on the first mismatch. */
export function constantTimeEqual(a, b) {
  const x = a instanceof Uint8Array ? a : enc.encode(String(a)), y = b instanceof Uint8Array ? b : enc.encode(String(b));
  let diff = x.length ^ y.length;
  const n = Math.max(x.length, y.length);
  for (let i = 0; i < n; i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

async function pbkdf2(password, salt, iterations) {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256));
}

export async function hashPassword(password, { iterations = MAX_ITERATIONS, salt } = {}) {
  if (!Number.isInteger(iterations) || iterations < 1 || iterations > MAX_ITERATIONS) throw new Error(`iterations must be 1 to ${MAX_ITERATIONS}`);
  const s = salt ?? crypto.getRandomValues(new Uint8Array(16));
  return `pbkdf2-sha256:${iterations}:${b64u.enc(s)}:${b64u.enc(await pbkdf2(password, s, iterations))}`;
}

export function parseHash(stored) {
  const p = String(stored || '').split(':');
  if (p.length !== 4 || p[0] !== 'pbkdf2-sha256') return null;
  const iterations = Number(p[1]);
  if (!Number.isInteger(iterations) || iterations < 1 || iterations > MAX_ITERATIONS) return null;
  try { const salt = b64u.dec(p[2]), hash = b64u.dec(p[3]); return salt.length >= 8 && hash.length === 32 ? { iterations, salt, hash } : null; } catch { return null; }
}

/** False for a wrong password and for a missing or malformed stored hash. Always does the full PBKDF2 work. */
export async function verifyPassword(password, stored) {
  const parsed = parseHash(stored);
  if (typeof password !== 'string' || password.length === 0 || password.length > 256) { await pbkdf2('x', new Uint8Array(16), MAX_ITERATIONS); return false; }
  if (!parsed) { await pbkdf2(password, new Uint8Array(16), MAX_ITERATIONS); return false; }
  return constantTimeEqual(await pbkdf2(password, parsed.salt, parsed.iterations), parsed.hash);
}

const hmacKey = (secret, usages) => crypto.subtle.importKey('raw', typeof secret === 'string' ? enc.encode(secret) : secret, { name: 'HMAC', hash: 'SHA-256' }, false, usages);

export async function signToken(secret, nowMs, ttlSeconds = SESSION_SECONDS) {
  const iat = Math.floor(nowMs / 1000);
  const payload = b64u.enc(enc.encode(JSON.stringify({ v: 1, iat, exp: iat + ttlSeconds })));
  const sig = await crypto.subtle.sign('HMAC', await hmacKey(secret, ['sign']), enc.encode(payload));
  return `${payload}.${b64u.enc(sig)}`;
}

/** -> { ok: true, exp } or { ok: false, reason }. Signature is checked before the payload is trusted. */
export async function verifyToken(secret, token, nowMs) {
  if (typeof token !== 'string' || token.length > 400 || (token.match(/\./g) || []).length !== 1) return { ok: false, reason: 'malformed' };
  const [payload, sig] = token.split('.');
  let sigBytes; try { sigBytes = b64u.dec(sig); } catch { return { ok: false, reason: 'malformed' }; }
  const good = await crypto.subtle.verify('HMAC', await hmacKey(secret, ['verify']), sigBytes, enc.encode(payload));
  if (!good) return { ok: false, reason: 'bad_signature' };
  let p; try { p = JSON.parse(new TextDecoder().decode(b64u.dec(payload))); } catch { return { ok: false, reason: 'malformed' }; }
  if (p?.v !== 1 || !Number.isInteger(p.exp) || !Number.isInteger(p.iat)) return { ok: false, reason: 'malformed' };
  if (Math.floor(nowMs / 1000) >= p.exp) return { ok: false, reason: 'expired' };
  if (p.iat > Math.floor(nowMs / 1000) + 60) return { ok: false, reason: 'malformed' };
  return { ok: true, exp: p.exp };
}
