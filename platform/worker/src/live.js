// What the browser may send about the screen, and the read-only tools that summarise it. Strict on purpose:
// unknown keys are rejected, strings come only from fixed lists, numbers are bounded. Feed titles, place names and
// coordinates have no field to travel in, so text hidden inside a feed item cannot reach the model.
import { LAYERS, WINDOWS, EVENT_CATS } from './allowlist.js';

const SUN = ['daylight', 'civil twilight', 'nautical twilight', 'astronomical twilight', 'night'];
const KINDS = ['matched', 'drone', 'unmatched', 'unknown'];
const MAX = { mags: 300, events: 200, tracks: 100 };
const ITEM_CATS = [...EVENT_CATS.filter((c) => c !== 'all'), 'other'];
const isNum = (x, lo, hi) => typeof x === 'number' && Number.isFinite(x) && x >= lo && x <= hi;
const only = (o, keys) => o && typeof o === 'object' && !Array.isArray(o) && Object.keys(o).every((k) => keys.includes(k));
const r1 = (x) => Math.round(x * 10) / 10;

export function validateLive(live) {
  const bad = (why) => ({ ok: false, error: `live: ${why}` });
  if (live == null) return { ok: true, value: {} };
  if (!only(live, ['view', 'quakes', 'events', 'sim'])) return bad('unexpected field');
  const out = {};
  if (live.view != null) {
    const v = live.view;
    if (!only(v, ['alt_km', 'heading', 'tilted', 'layers', 'sun'])) return bad('view: unexpected field');
    if (!isNum(v.alt_km, 0, 400000) || !isNum(v.heading, 0, 360) || typeof v.tilted !== 'boolean') return bad('view: bad value');
    if (!Array.isArray(v.layers) || v.layers.length > 20 || !v.layers.every((l) => LAYERS.includes(l) || ['nightLights', 'daynight'].includes(l))) return bad('view: bad layers');
    if (v.sun != null && !SUN.includes(v.sun)) return bad('view: bad sun');
    out.view = { alt_km: r1(v.alt_km), heading: Math.round(v.heading), tilted: v.tilted, layers: [...v.layers], sun: v.sun ?? null };
  }
  if (live.quakes != null) {
    const q = live.quakes;
    if (!only(q, ['window', 'min_mag', 'mags', 'ages_min', 'fetched_age_s', 'total'])) return bad('quakes: unexpected field');
    if (!WINDOWS.includes(q.window) || !isNum(q.min_mag, 0, 9) || !isNum(q.fetched_age_s, 0, 1e7)) return bad('quakes: bad value');
    if (!Array.isArray(q.mags) || q.mags.length > MAX.mags || !q.mags.every((m) => isNum(m, -2, 10))) return bad('quakes: bad magnitudes');
    if (!Array.isArray(q.ages_min) || q.ages_min.length !== q.mags.length || !q.ages_min.every((a) => isNum(a, 0, 1e6))) return bad('quakes: bad ages');
    // `total` is the real size of the list when the browser had to send only the strongest 300.
    if (q.total != null && !(Number.isInteger(q.total) && q.total >= q.mags.length && q.total <= 100000)) return bad('quakes: bad total');
    out.quakes = { window: q.window, min_mag: q.min_mag, mags: q.mags.map(r1), ages_min: q.ages_min.map(Math.round), fetched_age_s: Math.round(q.fetched_age_s), total: q.total ?? q.mags.length };
  }
  if (live.events != null) {
    const e = live.events;
    if (!only(e, ['category', 'days', 'items', 'total'])) return bad('events: unexpected field');
    if (!EVENT_CATS.includes(e.category) || !isNum(e.days, 1, 30)) return bad('events: bad value');
    if (!Array.isArray(e.items) || e.items.length > MAX.events) return bad('events: too many items');
    for (const it of e.items) if (!only(it, ['cat', 'age_h']) || !ITEM_CATS.includes(it.cat) || !(it.age_h === null || isNum(it.age_h, 0, 1e5))) return bad('events: bad item');
    if (e.total != null && !(Number.isInteger(e.total) && e.total >= e.items.length && e.total <= 100000)) return bad('events: bad total');
    out.events = { category: e.category, days: Math.round(e.days), items: e.items.map((i) => ({ cat: i.cat, age_h: i.age_h === null ? null : r1(i.age_h) })), total: e.total ?? e.items.length };
  }
  if (live.sim != null) {
    const s = live.sim;
    if (!only(s, ['mode', 'tracks']) || !['SIM', 'REAL'].includes(s.mode)) return bad('sim: bad mode');
    if (!Array.isArray(s.tracks) || s.tracks.length > MAX.tracks) return bad('sim: too many tracks');
    for (const t of s.tracks) if (!only(t, ['kind', 'adsb']) || !KINDS.includes(t.kind) || typeof t.adsb !== 'boolean') return bad('sim: bad track');
    out.sim = { mode: s.mode, tracks: s.tracks.map((t) => ({ kind: t.kind, adsb: t.adsb })) };
  }
  return { ok: true, value: out };
}

/* ── read-only tools: counting and arithmetic happen here, in code, never in the model ── */
const none = (tool, note) => ({ tool, available: false, note });

export const TOOLS = {
  get_view_state(live) {
    const v = live.view; if (!v) return none('get_view_state', 'No globe view is open.');
    return { tool: 'get_view_state', available: true, camera_altitude_km: v.alt_km, heading_deg: v.heading, tilted: v.tilted, layers_on: v.layers, sun_state: v.sun, note: 'Position is not shared with the assistant.' };
  },
  get_quake_summary(live) {
    const q = live.quakes; if (!q) return none('get_quake_summary', 'No earthquake list is loaded. Run the quakes command first.');
    const m = q.mags, n = m.length, partial = q.total > n;
    // When only the strongest were sent, a threshold count is exact only above the weakest one sent.
    const atLeast = (t) => (!partial || (n && t > Math.min(...m)) ? m.filter((x) => x >= t).length : null);
    return {
      tool: 'get_quake_summary', available: true, source: 'USGS Earthquake Hazards Program', window: q.window, min_magnitude_requested: q.min_mag,
      count: q.total, strongest: n ? Math.max(...m) : null, count_m4_plus: atLeast(4), count_m5_plus: atLeast(5), count_m6_plus: atLeast(6),
      newest_age_minutes: n ? Math.min(...q.ages_min) : null, oldest_age_minutes: n && !partial ? Math.max(...q.ages_min) : null, data_fetched_seconds_ago: q.fetched_age_s,
      ...(partial ? { note: 'Only the strongest were sent; counts that cannot be exact are null.' } : {}),
    };
  },
  get_event_summary(live) {
    const e = live.events; if (!e) return none('get_event_summary', 'No natural-event list is loaded. Run the fires or events command first.');
    const by = {}; for (const i of e.items) by[i.cat] = (by[i.cat] || 0) + 1;
    const ages = e.items.map((i) => i.age_h).filter((a) => a !== null), partial = e.total > e.items.length;
    return { tool: 'get_event_summary', available: true, source: 'NASA EONET', category_requested: e.category, days: e.days, count: e.total, count_by_category: partial ? null : by, newest_age_hours: ages.length ? Math.min(...ages) : null, ...(partial ? { note: 'Too many to send; the count is exact, the split by category is not available.' } : {}) };
  },
  get_sim_tracks(live) {
    const s = live.sim; if (!s) return none('get_sim_tracks', 'The Sky view is not open, so there are no tracks to count.');
    const by = {}; for (const t of s.tracks) by[t.kind] = (by[t.kind] || 0) + 1;
    return {
      tool: 'get_sim_tracks', available: true, label: s.mode, notice: s.mode === 'SIM' ? 'SIM: simulated tracks, not real detections.' : 'REAL: tracks from the local sightings file.',
      total: s.tracks.length, count_by_kind: by, adsb_matched: s.tracks.filter((t) => t.adsb).length,
    };
  },
};

export const TOOL_SPECS = [
  { name: 'get_view_state', description: 'Camera altitude, heading, which layers are on, sun state. No position.', parameters: { type: 'object', properties: {}, required: [] } },
  { name: 'get_quake_summary', description: 'Counts and strongest magnitude of the loaded USGS earthquake list.', parameters: { type: 'object', properties: {}, required: [] } },
  { name: 'get_event_summary', description: 'Counts by category of the loaded NASA EONET event list.', parameters: { type: 'object', properties: {}, required: [] } },
  { name: 'get_sim_tracks', description: 'Counts of the Sky view tracks. Always carries its SIM or REAL label.', parameters: { type: 'object', properties: {}, required: [] } },
  { name: 'search_facts', description: 'Search the written facts about Varn (models, tests, limits). Returns up to 5.', parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] } },
  { name: 'propose_command', description: 'Propose view-only terminal commands for the human to approve; they run in order with one click. Allowed: fly <place>, layers <name> on|off, quakes [window] [min_mag], fires [days], events [category] [days], go <n>, home, tilt, north, brief, sun, imagery, view earth|sky|records. Give 1 to 3 commands. After quakes, "go 1" flies to the strongest; after fires or events, "go 1" flies to the newest.',
    parameters: { type: 'object', properties: { commands: { type: 'array', items: { type: 'string' } }, say: { type: 'string' } }, required: ['commands', 'say'] } },
];
export const TOOL_NAMES = TOOL_SPECS.map((t) => t.name);
