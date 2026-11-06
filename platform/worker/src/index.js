// varn-ask entry point: wires the handler to Cloudflare (Durable Object counters, Workers AI, bundled read-only facts).
import facts from '../../src/data/facts.json';
import { handle } from './app.js';
import { makeRunModel } from './model.js';
import { Limiter } from './do.js';

export { Limiter };

export default {
  fetch: (request, env) => handle(request, env, {
    facts,
    makeRunModel,
    stub: (name) => env.LIMITER.get(env.LIMITER.idFromName(name)),
  }),
};
