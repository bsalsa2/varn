// The bridge between the assistant panel and the views. The Earth and Sky views register themselves here (private
// builds only); the panel reads a summary from them and, when the human clicks Run, executes an approved command.
import { execute } from '../globe/commands.js';
import * as feeds from '../globe/feeds.js';
import { validateCommand } from '../../worker/src/allowlist.js';
import { buildLive } from './summary.js';

const slots = new Map();
const subs = new Set();
const notify = () => subs.forEach((f) => f());
const mem = { list: null, marks: {}, history: [], watch: null };      // the assistant's own list memory, so "go 3" works after "quakes"
const meta = { quakes: null, events: null };

const tracked = {
  ...feeds,
  fetchQuakes: async (o) => { const r = await feeds.fetchQuakes(o); meta.quakes = { window: r.window, minMag: r.minMag, fetched: r.fetched }; return r; },
  fetchEvents: async (o) => { const r = await feeds.fetchEvents(o); meta.events = { category: r.category, days: r.days, fetched: r.fetched }; return r; },
};

export const askHost = {
  register(name, impl) { slots.set(name, impl); notify(); return () => { if (slots.get(name) === impl) { slots.delete(name); notify(); } }; },
  has: (name) => slots.has(name),
  subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },

  /** What is on screen, as the small schema the Worker accepts. Never throws; missing parts are left out. */
  async snapshot(now = Date.now()) {
    const earth = slots.get('earth'), sky = slots.get('sky');
    const input = { now };
    if (earth) {
      try { input.view = earth.ctx.engine.view(); input.layers = earth.ctx.layers.list(); } catch { /* leave out */ }
      const list = mem.list;
      if (list?.kind === 'quake' && meta.quakes) input.quakes = { ...meta.quakes, items: list.items };
      else {
        try { const r = await feeds.fetchQuakes({ window: 'day', minMag: 2.5 }); input.quakes = { window: 'day', minMag: 2.5, fetched: r.fetched, items: r.items }; } catch { /* leave out */ }
      }
      if (list?.kind === 'event' && meta.events) input.events = { ...meta.events, items: list.items };
    }
    if (sky) { try { input.sim = sky.sim(); } catch { /* leave out */ } }
    return buildLive(input);
  },

  /** Runs one approved command. It is validated again here, so even a bug elsewhere cannot run something off the allowlist. */
  async run(command) {
    const v = validateCommand(command);
    if (!v.ok) return { ok: false, lines: [{ t: `Not allowed: ${v.reason}`, c: 'warn' }] };
    if (v.kind === 'view') {
      const hash = { earth: '', sky: '#sky', records: '#records' }[v.command.split(' ')[1]];
      location.hash = hash;                                  // Root listens for hashchange; '' (Earth) leaves a bare '#'
      return { ok: true, lines: [{ t: `Opened ${v.command.split(' ')[1]}.`, c: 'ok' }] };
    }
    const earth = slots.get('earth');
    if (!earth) return { ok: false, lines: [{ t: 'Commands run on the Earth view. Open it first.', c: 'warn' }] };
    const lines = [];
    const io = { print: (t, c = '') => lines.push({ t: String(t), c }), clear: () => {} };
    try { await execute(v.command, { ...earth.ctx, feeds: tracked, mem, now: Date.now, emit: io.print, saveMarks: () => {} }, io); }
    catch (e) { lines.push({ t: `Error: ${e.message}`, c: 'err' }); }
    return { ok: true, lines: lines.slice(0, 40) };
  },
};
