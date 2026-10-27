// VARN Sky simulator. Pure, seeded, deterministic. No DOM, no network.
// Everything the Sky view shows in SIM mode is computed here.

export const LABELS = {
  matched: 'Aircraft (matched to ADS-B)',
  unmatched: 'Aircraft (unmatched)',
  drone: 'Drone (candidate)',
  unknown: 'Unknown',
};
export const KINDS = Object.keys(LABELS);
export const SCENE_DURATION = 600; // seconds
export const ADSB_GATE_DEG = 1.0;

const D2R = Math.PI / 180;
const R2D = 180 / Math.PI;

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function rng() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const wrap360 = (a) => ((a % 360) + 360) % 360;

// Great-circle angle between two az/el directions, degrees.
export function angularSeparation(a, b) {
  const e1 = a.el * D2R, e2 = b.el * D2R, dA = (a.az - b.az) * D2R;
  const c = Math.sin(e1) * Math.sin(e2) + Math.cos(e1) * Math.cos(e2) * Math.cos(dA);
  return Math.acos(Math.min(1, Math.max(-1, c))) * R2D;
}

const range = (rng, lo, hi) => lo + rng() * (hi - lo);

function makePath(kind, rng) {
  if (kind === 'matched' || kind === 'unmatched') {
    const az0 = range(rng, 0, 360);
    const sweep = (rng() < 0.5 ? -1 : 1) * range(rng, 50, 150);
    const elLo = range(rng, 2, 8), elHi = range(rng, 18, 72);
    return { az0, sweep, elLo, elHi, wobble: 0, freq: 0, phase: 0 };
  }
  if (kind === 'drone') {
    return {
      az0: range(rng, 0, 360), sweep: range(rng, -25, 25),
      elLo: range(rng, 4, 10), elHi: range(rng, 10, 26),
      wobble: range(rng, 4, 9), freq: range(rng, 2.5, 5), phase: range(rng, 0, Math.PI * 2),
    };
  }
  return { az0: range(rng, 0, 360), sweep: range(rng, -12, 12), elLo: range(rng, 10, 40), elHi: 0, wobble: 0, freq: 0, phase: 0, elDrift: range(rng, -6, 6) };
}

function pathAt(kind, p, u) {
  if (kind === 'unknown') return { az: wrap360(p.az0 + p.sweep * u), el: p.elLo + p.elDrift * u };
  const el = p.elLo + (p.elHi - p.elLo) * Math.sin(Math.PI * u);
  const wob = p.wobble ? p.wobble * Math.sin(p.freq * Math.PI * 2 * u + p.phase) : 0;
  const elWob = p.wobble ? 0.35 * p.wobble * Math.cos(p.freq * 1.7 * Math.PI * 2 * u + p.phase) : 0;
  return { az: wrap360(p.az0 + p.sweep * u + wob), el: Math.max(0.5, el + elWob) };
}

// A synthetic ADS-B report for a matched aircraft: the true path plus a small, slowly varying offset.
function adsbAt(track, t) {
  const pos = track.sample(t);
  if (!pos) return null;
  const o = track.adsbOffset;
  return { az: wrap360(pos.az + o * Math.cos(t / 37)), el: pos.el + o * Math.sin(t / 29) };
}

export function evaluateMatch(track, step = 5) {
  if (track.kind !== 'matched' && track.kind !== 'unmatched') {
    const dur = Math.round(track.t1 - track.t0);
    if (track.kind === 'drone') {
      const rate = meanRate(track);
      return { status: 'none', reason: `No ADS-B within ${ADSB_GATE_DEG.toFixed(1)}° gate; low, irregular path (mean ${rate.toFixed(2)}°/s)` };
    }
    return { status: 'none', reason: `No ADS-B within ${ADSB_GATE_DEG.toFixed(1)}° gate; ${dur} s track too short to classify` };
  }
  if (track.kind === 'unmatched') return { status: 'none', reason: `Aircraft-like path, but no ADS-B report within ${ADSB_GATE_DEG.toFixed(1)}° gate` };
  const seps = [];
  for (let t = track.t0; t <= track.t1; t += step) {
    const a = adsbAt(track, t), p = track.sample(t);
    if (a && p) seps.push(angularSeparation(a, p));
  }
  seps.sort((x, y) => x - y);
  const median = seps[Math.floor(seps.length / 2)];
  const ok = median <= ADSB_GATE_DEG;
  return {
    status: ok ? 'matched' : 'none', callsign: track.callsign, median, samples: seps.length,
    reason: `Median ${median.toFixed(2)}° from ADS-B ${track.callsign} (gate ${ADSB_GATE_DEG.toFixed(1)}°, ${seps.length} samples)`,
  };
}

export function angularRate(track, t, h = 0.5) {
  const a = track.sample(Math.max(track.t0, t - h)), b = track.sample(Math.min(track.t1, t + h));
  if (!a || !b) return 0;
  const dt = Math.min(track.t1, t + h) - Math.max(track.t0, t - h);
  return dt > 0 ? angularSeparation(a, b) / dt : 0;
}

function meanRate(track) {
  let sum = 0, n = 0;
  for (let t = track.t0 + 1; t < track.t1 - 1; t += 2) { sum += angularRate(track, t); n++; }
  return n ? sum / n : 0;
}

const MIX = ['matched', 'drone', 'matched', 'unknown', 'unmatched', 'matched', 'drone', 'unknown', 'matched', 'matched', 'unmatched', 'drone', 'unknown', 'matched'];

export function generateScene(seed = 1729) {
  const rng = mulberry32(seed);
  const node = { boresightAz: Math.round(range(rng, 100, 220)), boresightEl: Math.round(range(rng, 28, 42)), fov: 64 };
  const tracks = MIX.map((kind, i) => {
    const dur = kind === 'unknown' ? range(rng, 25, 70) : kind === 'drone' ? range(rng, 90, 220) : range(rng, 150, 320);
    const t0 = i < 5 ? range(rng, 0, 40) : range(rng, 0, SCENE_DURATION - dur);
    const p = makePath(kind, rng);
    const track = {
      id: `S-${String(i + 1).padStart(3, '0')}`, kind, label: LABELS[kind], t0, t1: t0 + dur,
      callsign: kind === 'matched' ? `SIM${100 + Math.floor(rng() * 900)}` : null,
      adsbOffset: kind === 'matched' ? range(rng, 0.08, 0.45) : 0,
      sample(t) { if (t < this.t0 || t > this.t1) return null; return pathAt(kind, p, (t - this.t0) / (this.t1 - this.t0)); },
    };
    track.sample = track.sample.bind(track);
    return track;
  });
  for (const tr of tracks) tr.match = evaluateMatch(tr);
  return { mode: 'sim', seed, duration: SCENE_DURATION, epoch: null, node, tracks };
}

export function inFov(node, pos) {
  return angularSeparation({ az: node.boresightAz, el: node.boresightEl }, pos) <= node.fov / 2;
}

// Snapshot of the scene at time t: visible tracks with computed values.
export function stateAt(scene, t) {
  const visible = [];
  for (const tr of scene.tracks) {
    const pos = tr.sample(t);
    if (!pos) continue;
    visible.push({ track: tr, az: pos.az, el: pos.el, rate: angularRate(tr, t), inFov: scene.node ? inFov(scene.node, pos) : false });
  }
  return visible;
}

export function summarize(visible) {
  const counts = Object.fromEntries(KINDS.map((k) => [k, 0]));
  for (const v of visible) counts[v.track.kind]++;
  return { total: visible.length, ...counts };
}

// Projection: az/el to the polar dome. Zenith at centre, horizon at radius r. North up, east right.
export function domeXY(az, el, cx, cy, r) {
  const rr = r * (90 - Math.max(0, Math.min(90, el))) / 90;
  return [cx + rr * Math.sin(az * D2R), cy - rr * Math.cos(az * D2R)];
}

// Samples of a track (for export / trails), every `step` seconds.
export function sampleTrack(track, step = 1) {
  const out = [];
  for (let t = track.t0; t <= track.t1 + 1e-9; t += step) {
    const p = track.sample(t);
    if (p) out.push({ t: +t.toFixed(2), az: +p.az.toFixed(3), el: +p.el.toFixed(3) });
  }
  return out;
}
