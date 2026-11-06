// Durable Object wrapper around limits.js. SQLite-backed (Workers Free plan). Imported only by the Worker, never by tests.
import { DurableObject } from 'cloudflare:workers';
import { rateCheck, loginState, loginFailed, loginSucceeded, reserve, settle } from './limits.js';

export class Limiter extends DurableObject {
  get store() { const s = this.ctx.storage; return { get: (k) => s.get(k), put: (k, v) => s.put(k, v), delete: (k) => s.delete(k) }; }
  rate(now) { return rateCheck(this.store, now); }
  loginState(now) { return loginState(this.store, now); }
  loginFailed(now) { return loginFailed(this.store, now); }
  loginSucceeded() { return loginSucceeded(this.store); }
  reserve(now, estimate, cfg) { return reserve(this.store, now, estimate, cfg); }
  settle(key, reserved, actual) { return settle(this.store, key, reserved, actual); }
}
