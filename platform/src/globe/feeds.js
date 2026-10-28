// Public event feeds, fetched straight from the publishers in the browser. No keys, no proxy, no
// invented records: whatever a feed returns is what is shown, with its own timestamps.
//
//   USGS Earthquake Hazards Program  https://earthquake.usgs.gov/earthquakes/feed/
//   NASA EONET v3 (natural events)   https://eonet.gsfc.nasa.gov/docs/v3

export const USGS = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary';
export const EONET = 'https://eonet.gsfc.nasa.gov/api/v3/events';

export const WINDOWS = { hour: 'past hour', day: 'past 24 h', week: 'past 7 days', month: 'past 30 days' };

export const EVENT_CATEGORIES = {
  wildfires: 'Wildfires', volcanoes: 'Volcanoes', severeStorms: 'Severe storms', floods: 'Floods', landslides: 'Landslides',
  seaLakeIce: 'Sea and lake ice', drought: 'Drought', dustHaze: 'Dust and haze', tempExtremes: 'Temperature extremes',
  snow: 'Snow', waterColor: 'Water colour', manmade: 'Manmade', earthquakes: 'Earthquakes',
};

// Identical requests within a minute share one answer: the terminal and the Layers panel often ask together,
// and the publishers ask for polite use of their public feeds.
const TTL = 60000, memo = new Map();
function cached(url, make) {
  const hit = memo.get(url);
  if (hit && Date.now() - hit.at < TTL) return hit.p;
  const p = make();
  memo.set(url, { at: Date.now(), p });
  p.catch(() => memo.delete(url));
  return p;
}
export const clearFeedCache = () => memo.clear();

async function getJson(url, label) {
  let res;
  try { res = await fetch(url, { headers: { accept: 'application/json' } }); }
  catch (e) { if (e.name === 'AbortError') throw e; throw new Error(`${label} unreachable (${e.message || 'network error'})`); }
  if (!res.ok) throw new Error(`${label} answered HTTP ${res.status}`);
  try { return await res.json(); } catch { throw new Error(`${label} returned something that is not JSON`); }
}

/** USGS publishes pre-cut feeds by magnitude floor; pick the smallest feed that still contains `minMag`. */
export function usgsFeedName(minMag = 2.5) {
  const tier = minMag >= 4.5 ? '4.5' : minMag >= 2.5 ? '2.5' : minMag >= 1 ? '1.0' : 'all';
  return tier;
}

export function normalizeQuakes(json, minMag = 0) {
  const feats = Array.isArray(json?.features) ? json.features : [];
  const items = [];
  for (const f of feats) {
    const [lon, lat, depth] = f?.geometry?.coordinates || [];
    const p = f?.properties || {};
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || !Number.isFinite(p.mag) || p.mag < minMag) continue;
    items.push({
      id: f.id, kind: 'quake', lat, lon, depthKm: depth, mag: p.mag,
      title: p.place || 'Unnamed location', time: p.time, url: p.url, tsunami: p.tsunami === 1, alert: p.alert || null, felt: p.felt ?? null,
    });
  }
  items.sort((a, b) => b.mag - a.mag || b.time - a.time);
  return { items, generated: json?.metadata?.generated ?? null, count: json?.metadata?.count ?? items.length };
}

export async function fetchQuakes({ window = 'day', minMag = 2.5 } = {}) {
  if (!WINDOWS[window]) throw new Error(`unknown window "${window}" (use ${Object.keys(WINDOWS).join(', ')})`);
  const url = `${USGS}/${usgsFeedName(minMag)}_${window}.geojson`;
  const json = await cached(url, () => getJson(url, 'USGS earthquake feed'));
  return { ...normalizeQuakes(json, minMag), window, minMag, url, fetched: Date.now(), source: 'USGS Earthquake Hazards Program' };
}

function centroid(ring) {
  const pts = (Array.isArray(ring?.[0]?.[0]) ? ring[0] : ring) || [];
  const v = pts.filter((c) => Number.isFinite(c?.[0]) && Number.isFinite(c?.[1]));
  if (!v.length) return null;
  return [v.reduce((s, c) => s + c[0], 0) / v.length, v.reduce((s, c) => s + c[1], 0) / v.length];
}

export function normalizeEvents(json) {
  const events = Array.isArray(json?.events) ? json.events : [];
  const items = [];
  for (const e of events) {
    const geoms = Array.isArray(e.geometry) ? e.geometry : [];
    const g = geoms[geoms.length - 1];                         // EONET lists geometries oldest to newest
    if (!g) continue;
    const c = g.type === 'Point' ? g.coordinates : centroid(g.coordinates);
    if (!c || !Number.isFinite(c[0]) || !Number.isFinite(c[1])) continue;
    const cat = e.categories?.[0] || {};
    items.push({
      id: e.id, kind: cat.id || 'event', category: cat.title || 'Event', lat: c[1], lon: c[0], title: e.title,
      time: g.date ? Date.parse(g.date) : null, url: e.sources?.[0]?.url || e.link, magnitude: g.magnitudeValue ?? null, unit: g.magnitudeUnit || '',
      closed: e.closed || null, track: geoms.length,
    });
  }
  items.sort((a, b) => (b.time || 0) - (a.time || 0));
  return { items };
}

export async function fetchEvents({ category = 'wildfires', days = 30 } = {}) {
  if (category !== 'all' && !EVENT_CATEGORIES[category]) throw new Error(`unknown category "${category}" (use ${Object.keys(EVENT_CATEGORIES).join(', ')}, all)`);
  const q = new URLSearchParams({ status: 'open', days: String(days) });
  if (category !== 'all') q.set('category', category);
  const url = `${EONET}?${q}`;
  const json = await cached(url, () => getJson(url, 'NASA EONET'));
  return { ...normalizeEvents(json), category, days, url, fetched: Date.now(), source: 'NASA EONET (Earth Observatory Natural Event Tracker)' };
}

/** Marker style by kind: size in px, CSS colour. */
export function styleFor(item) {
  if (item.kind === 'quake') {
    const m = item.mag;
    return { size: Math.max(4, Math.min(22, 3 + m * 2.4)), color: m >= 6 ? '#ff4d3a' : m >= 5 ? '#ff8a3a' : m >= 4 ? '#ffc23a' : '#e9d77a' };
  }
  const colors = { wildfires: '#ff6a2b', volcanoes: '#e04ad0', severeStorms: '#4ad0e0', floods: '#4a8fe0', landslides: '#b08a5a', seaLakeIce: '#bfe6ff', drought: '#d4b06a', dustHaze: '#c9a66b', tempExtremes: '#ff9a9a' };
  return { size: 9, color: colors[item.kind] || '#c9d1d9' };
}
