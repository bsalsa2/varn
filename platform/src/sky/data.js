// REAL mode: normalise platform/public/data/sightings.json into the same track model the simulator uses.
// Accepted fields per row: id|track_id, time (ISO or epoch seconds), azimuth, elevation, label, match_status, match_reason, callsign.
import { LABELS, wrap360, angularRate } from './sim.js';

const LABEL_TO_KIND = Object.fromEntries(Object.entries(LABELS).map(([k, v]) => [v.toLowerCase(), k]));

export function kindFromLabel(label = '') {
  const l = String(label).toLowerCase().trim();
  if (LABEL_TO_KIND[l]) return LABEL_TO_KIND[l];
  if (l.includes('drone')) return 'drone';
  if (l.includes('unmatched')) return 'unmatched';
  if (l.includes('aircraft')) return 'matched';
  return 'unknown';
}

const toSeconds = (v) => (typeof v === 'number' ? v : Date.parse(v) / 1000);

function lerpAz(a, b, f) { let d = ((b - a + 540) % 360) - 180; return wrap360(a + d * f); }

export function normalizeSightings(json) {
  const rows = Array.isArray(json) ? json : Array.isArray(json?.sightings) ? json.sightings : [];
  const groups = new Map();
  for (const r of rows) {
    const ts = toSeconds(r.time);
    const az = Number(r.azimuth), el = Number(r.elevation);
    if (!Number.isFinite(ts) || !Number.isFinite(az) || !Number.isFinite(el)) continue;
    const id = String(r.id ?? r.track_id ?? `R-${groups.size + 1}`);
    if (!groups.has(id)) groups.set(id, { rows: [], label: r.label, status: r.match_status, reason: r.match_reason, callsign: r.callsign });
    groups.get(id).rows.push({ ts, az: wrap360(az), el });
  }
  if (!groups.size) return null;
  const epoch = Math.min(...[...groups.values()].flatMap((g) => g.rows.map((x) => x.ts)));
  const tracks = [...groups.entries()].map(([id, g]) => {
    const pts = g.rows.map((x) => ({ t: x.ts - epoch, az: x.az, el: x.el })).sort((a, b) => a.t - b.t);
    const kind = kindFromLabel(g.label);
    const t0 = pts[0].t, t1 = pts[pts.length - 1].t;
    const sample = (t) => {
      if (t < t0 || t > t1) return null;
      let i = 1; while (i < pts.length && pts[i].t < t) i++;
      const a = pts[i - 1], b = pts[Math.min(i, pts.length - 1)];
      const f = b.t > a.t ? (t - a.t) / (b.t - a.t) : 0;
      return { az: lerpAz(a.az, b.az, f), el: a.el + (b.el - a.el) * f };
    };
    const status = String(g.status ?? '').toLowerCase() === 'matched' ? 'matched' : 'none';
    return { id, kind, label: LABELS[kind], t0, t1: Math.max(t1, t0 + 1), callsign: g.callsign ?? null, sample, points: pts,
      match: { status, callsign: g.callsign ?? null, reason: g.reason || (status === 'matched' ? 'Matched in source file (no reason given)' : 'Not matched in source file') } };
  });
  const duration = Math.max(1, ...tracks.map((t) => t.t1));
  return { mode: 'real', epoch, duration, node: null, tracks };
}

export { angularRate };
