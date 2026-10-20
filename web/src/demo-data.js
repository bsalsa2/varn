// Sample data and helpers for the dashboard demo (demo.html).
//
// EVERYTHING HERE IS SIMULATED. Events are generated from a fixed seed, so the
// pattern is the same on every visit, and are dated relative to "now" so the
// demo always looks current. Nothing was detected by a camera. The page says
// so in several places; keep it that way.

export const SOURCE = 'simulated';

// Small seeded generator (mulberry32): the same seed gives the same sequence.
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const CLASSES = {
  aircraft: 'Aircraft',
  drone: 'Possible drone',
};
export const ADSB = {
  match: 'ADS-B match',
  none: 'No ADS-B match',
};

const pad = (n, w = 4) => String(n).padStart(w, '0');

// One simulated event. Drones never broadcast ADS-B, so they are always "none";
// a few aircraft (gliders, no transponder) are too. The model is weaker on
// drones than on aircraft, so drone confidences run lower.
function makeEvent(r, n, time) {
  const drone = r() < 0.24;
  const cls = drone ? 'drone' : 'aircraft';
  const confidence = drone ? 0.4 + r() * 0.5 : 0.62 + r() * 0.36;
  const adsb = drone || r() < 0.16 ? 'none' : 'match';
  return {
    id: `SIM-${pad(n)}`,
    time,
    cls,
    confidence: Math.round(confidence * 100) / 100,
    duration: Math.round((drone ? 2 + r() * 18 : 6 + r() * 54) * 10) / 10,
    adsb,
    pan: Math.round(r() * 1800) / 10,
    tilt: Math.round((10 + r() * 70) * 10) / 10,
    source: SOURCE,
  };
}

// `count` events spread over the 24 hourly buckets ending at `now`, newest first.
export function makeEvents(now, count = 96, seed = 20261021) {
  const r = rng(seed);
  // The window starts at the top of the hour 23 hours ago, so the 24 hourly
  // buckets in the chart cover every event and its total matches the counts.
  const top = new Date(now);
  top.setMinutes(0, 0, 0);
  const from = top.getTime() - 23 * 3600 * 1000;
  // More traffic by day than at night: pick times with a daylight bias.
  const times = [];
  while (times.length < count) {
    const t = from + r() * (now - from);
    const hour = new Date(t).getHours();
    const daylight = hour >= 7 && hour <= 20 ? 1 : 0.25;
    if (r() < daylight) times.push(Math.round(t / 1000) * 1000);
  }
  times.sort((a, b) => b - a);
  // Numbering runs oldest to newest, like a real log.
  return times.map((t, i) => makeEvent(r, count - i, t));
}

// One new event "now", for the replay button. n continues the numbering.
export function nextEvent(now, n, seed = 7) {
  const r = rng(seed + n * 101);
  return makeEvent(r, n, Math.round(now / 1000) * 1000);
}

export const RANGES = { 1: 'Last hour', 6: 'Last 6 hours', 24: 'Last 24 hours' };

// Filter by free text, class, ADS-B status and time range.
export function filterEvents(events, { q = '', cls = 'all', adsb = 'all', hours = 24 } = {}, now = Date.now()) {
  const needle = q.trim().toLowerCase();
  const since = now - Number(hours) * 3600 * 1000;
  return events.filter((e) => {
    if (e.time < since) return false;
    if (cls !== 'all' && e.cls !== cls) return false;
    if (adsb !== 'all' && e.adsb !== adsb) return false;
    if (!needle) return true;
    const hay = [e.id, CLASSES[e.cls], ADSB[e.adsb], clock(e.time), e.confidence.toFixed(2)].join(' ').toLowerCase();
    return hay.includes(needle);
  });
}

const KEYS = {
  time: (e) => e.time,
  cls: (e) => e.cls,
  confidence: (e) => e.confidence,
  duration: (e) => e.duration,
  adsb: (e) => e.adsb,
  id: (e) => e.id,
};
export const SORT_KEYS = Object.keys(KEYS);

// A sorted copy. Ties fall back to time (newest first) so order is stable.
export function sortEvents(events, key = 'time', dir = 'desc') {
  const get = KEYS[key] || KEYS.time;
  const sign = dir === 'asc' ? 1 : -1;
  return [...events].sort((a, b) => {
    const x = get(a);
    const y = get(b);
    if (x < y) return -sign;
    if (x > y) return sign;
    return b.time - a.time;
  });
}

// Counts for the summary cards.
export function summarize(events) {
  const out = { total: events.length, aircraft: 0, drone: 0, noAdsb: 0 };
  for (const e of events) {
    out[e.cls] += 1;
    if (e.adsb === 'none') out.noAdsb += 1;
  }
  return out;
}

// `hours` hourly buckets ending at `now`, oldest first. The last bucket is the
// current, unfinished hour.
export function hourlyBuckets(events, now, hours = 24) {
  const hourMs = 3600 * 1000;
  const end = new Date(now);
  end.setMinutes(0, 0, 0);
  const lastStart = end.getTime();
  const buckets = [];
  for (let i = hours - 1; i >= 0; i--) buckets.push({ start: lastStart - i * hourMs, aircraft: 0, drone: 0 });
  for (const e of events) {
    const idx = Math.floor((e.time - buckets[0].start) / hourMs);
    if (idx >= 0 && idx < hours) buckets[idx][e.cls] += 1;
  }
  return buckets;
}

// Confidence histogram: `bins` equal bins from 0 to 1, per class.
export function confidenceBins(events, bins = 5) {
  const out = Array.from({ length: bins }, (_, i) => ({ from: i / bins, to: (i + 1) / bins, aircraft: 0, drone: 0 }));
  for (const e of events) {
    const i = Math.min(bins - 1, Math.floor(e.confidence * bins));
    out[i][e.cls] += 1;
  }
  return out;
}

export function clock(t) {
  const d = new Date(t);
  return `${pad(d.getHours(), 2)}:${pad(d.getMinutes(), 2)}:${pad(d.getSeconds(), 2)}`;
}

// A cell that starts with = + - @ is run as a formula by spreadsheet apps.
const cell = (v) => {
  const s = String(v);
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

export const CSV_COLUMNS = ['id', 'time_iso', 'class', 'confidence', 'duration_s', 'adsb', 'pan_deg', 'tilt_deg', 'source'];

export function toCsv(events) {
  const rows = events.map((e) =>
    [e.id, new Date(e.time).toISOString(), e.cls, e.confidence, e.duration, e.adsb, e.pan, e.tilt, e.source].map(cell).join(',')
  );
  return [CSV_COLUMNS.join(','), ...rows].join('\n') + '\n';
}
