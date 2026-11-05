// Builds the small "what is on screen" summary the assistant may see. It keeps counts, magnitudes, ages and fixed
// category names. It has no way to carry a feed title, a place name or a coordinate: those fields are simply never read.
import { solarElevation } from '../globe/commands.js';

const LAYER_KEYS = ['satellite', 'terrain', 'labels', 'daynight', 'clouds', 'weather', 'fires', 'vegetation', 'nightLights', 'buildings'];
const EVENT_KINDS = ['wildfires', 'volcanoes', 'severeStorms', 'floods', 'landslides', 'seaLakeIce', 'drought', 'dustHaze', 'tempExtremes', 'snow', 'waterColor', 'manmade', 'earthquakes'];
const SIM_KINDS = ['matched', 'drone', 'unmatched', 'unknown'];
export const LIMITS = { quakes: 300, events: 200, tracks: 100 };
const fin = Number.isFinite;

export const twilight = (el) => (el > 0 ? 'daylight' : el > -6 ? 'civil twilight' : el > -12 ? 'nautical twilight' : el > -18 ? 'astronomical twilight' : 'night');

function viewPart(view, layerRows) {
  if (!view || !fin(view.height)) return undefined;
  const heading = fin(view.heading) ? ((view.heading % 360) + 360) % 360 : 0;
  let sun = null;
  if (view.centre && fin(view.centre.lat) && fin(view.centre.lon) && view.sun && fin(view.sun.lat) && fin(view.sun.lon)) {
    sun = twilight(solarElevation(view.centre.lat, view.centre.lon, view.sun));       // only the sun's state leaves; the position does not
  }
  const layers = (Array.isArray(layerRows) ? layerRows : []).filter((l) => l && l.on && LAYER_KEYS.includes(l.key)).map((l) => l.key);
  return { alt_km: Math.max(0, view.height / 1000), heading, tilted: fin(view.pitch) ? view.pitch > -80 : false, layers, sun };
}

function quakesPart(q, now) {
  if (!q || !Array.isArray(q.items) || !['hour', 'day', 'week', 'month'].includes(q.window)) return undefined;
  const rows = q.items.filter((i) => i && fin(i.mag) && fin(i.time)).sort((a, b) => b.mag - a.mag);
  const kept = rows.slice(0, LIMITS.quakes);
  return {
    window: q.window, min_mag: fin(q.minMag) ? Math.min(9, Math.max(0, q.minMag)) : 0,
    mags: kept.map((i) => i.mag), ages_min: kept.map((i) => Math.max(0, (now - i.time) / 60000)),
    fetched_age_s: fin(q.fetched) ? Math.max(0, (now - q.fetched) / 1000) : 0, total: rows.length,
  };
}

function eventsPart(e, now) {
  if (!e || !Array.isArray(e.items)) return undefined;
  const category = e.category === 'all' || EVENT_KINDS.includes(e.category) ? e.category : null;
  if (!category || !fin(e.days)) return undefined;
  const kept = e.items.slice(0, LIMITS.events).map((i) => ({ cat: EVENT_KINDS.includes(i?.kind) ? i.kind : 'other', age_h: fin(i?.time) ? Math.max(0, (now - i.time) / 3.6e6) : null }));
  return { category, days: Math.min(30, Math.max(1, e.days)), items: kept, total: e.items.length };
}

function simPart(s) {
  if (!s || !['SIM', 'REAL'].includes(s.mode) || !Array.isArray(s.tracks)) return undefined;
  return { mode: s.mode, tracks: s.tracks.slice(0, LIMITS.tracks).filter((t) => t && SIM_KINDS.includes(t.kind)).map((t) => ({ kind: t.kind, adsb: t.adsb === true })) };
}

/** Inputs are the app's own objects; unknown or malformed parts are left out rather than guessed. */
export function buildLive({ view, layers, quakes, events, sim, now = Date.now() } = {}) {
  const out = {};
  const parts = { view: viewPart(view, layers), quakes: quakesPart(quakes, now), events: eventsPart(events, now), sim: simPart(sim) };
  for (const [k, v] of Object.entries(parts)) if (v) out[k] = v;
  return out;
}
