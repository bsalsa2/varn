// Canvas renderer for the dome and plan views. Draws one frame from (scene, t); returns hit targets.
import { domeXY, wrap360 } from './sim.js';
import { contours } from './terrain.js';

export const C = { charcoal: '#0B0F14', night: '#111820', steel: '#4B5B6B', fog: '#A7B3BD', bone: '#F4F3EF', sage: '#7A8B7E', ink: '#17212B', amber: '#E0A84A' };
export const KIND_STYLE = {
  matched: { color: C.bone, shape: 'disc' },
  unmatched: { color: C.fog, shape: 'ring' },
  drone: { color: C.amber, shape: 'diamond' },
  unknown: { color: C.sage, shape: 'square' },
};
const D2R = Math.PI / 180;
const rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };

export function layoutFor(w, h) {
  const mobile = w < 760;
  if (mobile) { const r = Math.min(w * 0.4, h * 0.21); return { cx: w / 2, cy: 160 + r, r, mobile }; }
  const r = Math.min(h * 0.43, (w - 120) * 0.4);
  return { cx: w * 0.56, cy: h * 0.48, r, mobile };
}

export function glyph(ctx, shape, x, y, s, color, lw = 1.6) {
  ctx.fillStyle = color; ctx.strokeStyle = color; ctx.lineWidth = lw;
  ctx.beginPath();
  if (shape === 'disc') { ctx.arc(x, y, s, 0, Math.PI * 2); ctx.fill(); }
  else if (shape === 'ring') { ctx.arc(x, y, s, 0, Math.PI * 2); ctx.stroke(); }
  else if (shape === 'diamond') { ctx.moveTo(x, y - s * 1.3); ctx.lineTo(x + s * 1.3, y); ctx.lineTo(x, y + s * 1.3); ctx.lineTo(x - s * 1.3, y); ctx.closePath(); ctx.fill(); }
  else { ctx.rect(x - s, y - s, s * 2, s * 2); ctx.stroke(); }
}

// Points on the sky at angular radius rho around (az0, el0): the node's field-of-view boundary.
function capRing(az0, el0, rho, n = 96) {
  const lat1 = el0 * D2R, lon1 = az0 * D2R, d = rho * D2R, out = [];
  for (let k = 0; k <= n; k++) {
    const b = (k / n) * Math.PI * 2;
    const lat2 = Math.asin(Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(b));
    const lon2 = lon1 + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(lat1), Math.cos(d) - Math.sin(lat1) * Math.sin(lat2));
    out.push({ az: wrap360(lon2 / D2R), el: Math.max(0, lat2 / D2R) });
  }
  return out;
}

function background(ctx, w, h, cx, cy, r) {
  ctx.fillStyle = C.charcoal; ctx.fillRect(0, 0, w, h);
  const g = ctx.createRadialGradient(cx, cy, r * 0.05, cx, cy, Math.max(w, h) * 0.8);
  g.addColorStop(0, rgba(C.ink, 1)); g.addColorStop(0.45, rgba(C.night, 1)); g.addColorStop(1, rgba(C.charcoal, 1));
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
}

function watermark(ctx, w, h) {
  ctx.save();
  ctx.font = '600 13px "Space Grotesk", Inter, sans-serif';
  ctx.fillStyle = rgba(C.bone, 0.05);
  ctx.translate(w / 2, h / 2); ctx.rotate(-0.32);
  for (let y = -h; y < h; y += 120) for (let x = -w; x < w; x += 360) ctx.fillText('SIMULATION · NOT REAL DETECTIONS', x + ((y / 120) % 2) * 180, y);
  ctx.restore();
  ctx.font = '600 12px "Space Grotesk", Inter, sans-serif';
  ctx.fillStyle = rgba(C.bone, 0.7); ctx.textAlign = 'right';
  ctx.fillText('SIMULATION: not real detections', w - 16, h - 12);
  ctx.textAlign = 'left';
}

function trailFor(track, t, len, step) {
  const pts = [];
  for (let s = Math.max(track.t0, t - len); s <= t; s += step) { const p = track.sample(s); if (p) pts.push(p); }
  const now = track.sample(t); if (now) pts.push(now);
  return pts;
}

export function drawFrame(ctx, f) {
  const { w, h, view } = f;
  const L = layoutFor(w, h);
  const hits = [];
  if (view === 'plan') drawPlan(ctx, f, L, hits); else drawDome(ctx, f, L, hits);
  if (f.mode === 'sim') watermark(ctx, w, h);
  return { hits, layout: L };
}

function emphasis(f, id) { return id === f.selectedId ? 2 : (id === f.hoverId ? 1 : 0); }

function drawDome(ctx, f, L, hits) {
  const { w, h, scene, t, visible, quality } = f;
  const { cx, cy, r } = L;
  background(ctx, w, h, cx, cy, r);
  // horizon disc
  const disc = ctx.createRadialGradient(cx, cy - r * 0.2, r * 0.1, cx, cy, r);
  disc.addColorStop(0, rgba(C.steel, 0.22)); disc.addColorStop(1, rgba(C.steel, 0.05));
  ctx.fillStyle = disc; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
  // elevation rings 0/30/60, zenith 90
  ctx.lineWidth = 1;
  for (const el of [0, 30, 60]) {
    ctx.strokeStyle = rgba(C.fog, el === 0 ? 0.55 : 0.2);
    ctx.beginPath(); ctx.arc(cx, cy, r * (90 - el) / 90, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.fillStyle = rgba(C.fog, 0.6); ctx.beginPath(); ctx.arc(cx, cy, 1.6, 0, Math.PI * 2); ctx.fill();
  ctx.font = '500 12px Inter, sans-serif'; ctx.fillStyle = rgba(C.fog, 0.85);
  for (const el of [0, 30, 60, 90]) { const rr = r * (90 - el) / 90; ctx.fillText(`${el}°`, cx + 5, cy - rr + (el === 90 ? -6 : 14)); }
  // azimuth ticks + cardinal labels
  for (let a = 0; a < 360; a += 5) {
    const major = a % 30 === 0, s = Math.sin(a * D2R), c = Math.cos(a * D2R);
    const r0 = r + 3, r1 = r + (major ? 11 : a % 10 === 0 ? 7 : 4);
    ctx.strokeStyle = rgba(C.fog, major ? 0.7 : 0.3);
    ctx.beginPath(); ctx.moveTo(cx + r0 * s, cy - r0 * c); ctx.lineTo(cx + r1 * s, cy - r1 * c); ctx.stroke();
    if (major && a % 90 !== 0) { ctx.font = '500 12px Inter, sans-serif'; ctx.fillStyle = rgba(C.fog, 0.8); ctx.textAlign = 'center'; ctx.fillText(String(a), cx + (r + 24) * s, cy - (r + 24) * c + 4); }
  }
  ctx.font = '600 15px "Space Grotesk", Inter, sans-serif'; ctx.fillStyle = C.bone; ctx.textAlign = 'center';
  for (const [lbl, a] of [['N', 0], ['E', 90], ['S', 180], ['W', 270]]) ctx.fillText(lbl, cx + (r + 26) * Math.sin(a * D2R), cy - (r + 26) * Math.cos(a * D2R) + 5);
  ctx.textAlign = 'left';
  // node field of view
  if (scene?.node) {
    const ring = capRing(scene.node.boresightAz, scene.node.boresightEl, scene.node.fov / 2).map((p) => domeXY(p.az, p.el, cx, cy, r));
    ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.clip();
    ctx.beginPath(); ring.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath();
    const [bx, by] = domeXY(scene.node.boresightAz, scene.node.boresightEl, cx, cy, r);
    const g = ctx.createRadialGradient(bx, by, 0, bx, by, r * 0.55);
    g.addColorStop(0, rgba(C.sage, 0.26)); g.addColorStop(1, rgba(C.sage, 0.06));
    ctx.fillStyle = g; ctx.fill();
    ctx.setLineDash([4, 5]); ctx.strokeStyle = rgba(C.sage, 0.85); ctx.lineWidth = 1.2; ctx.stroke(); ctx.setLineDash([]);
    ctx.restore();
    ctx.strokeStyle = rgba(C.sage, 0.95); ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.arc(bx, by, 6, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(bx, by); ctx.setLineDash([2, 4]); ctx.strokeStyle = rgba(C.sage, 0.5); ctx.stroke(); ctx.setLineDash([]);
    ctx.font = '600 12px Inter, sans-serif'; ctx.fillStyle = C.bone; ctx.fillText('NODE VIEW', bx + 10, by - 6);
    ctx.font = '500 12px Inter, sans-serif'; ctx.fillStyle = rgba(C.fog, 0.95);
    ctx.fillText(`${scene.node.boresightAz}° / ${scene.node.boresightEl}° · ${scene.node.fov}° FOV`, bx + 10, by + 9);
  }
  // tracks
  const len = quality === 'low' ? 30 : 50, step = quality === 'low' ? 2 : 0.5;
  for (const v of visible) {
    const st = KIND_STYLE[v.track.kind], em = emphasis(f, v.track.id);
    const dim = f.selectedId && em === 0 ? 0.45 : 1;
    const pts = trailFor(v.track, t, len, step).map((p) => domeXY(p.az, p.el, cx, cy, r));
    for (let i = 1; i < pts.length; i++) {
      const a = (i / pts.length) ** 1.6;
      ctx.strokeStyle = rgba(st.color, a * 0.75 * dim); ctx.lineWidth = 1 + a * (em ? 2 : 1.2);
      ctx.beginPath(); ctx.moveTo(pts[i - 1][0], pts[i - 1][1]); ctx.lineTo(pts[i][0], pts[i][1]); ctx.stroke();
    }
    const [x, y] = domeXY(v.az, v.el, cx, cy, r);
    drawMarker(ctx, f, v, x, y, st, em, dim);
    hits.push({ id: v.track.id, x, y });
  }
}

function drawMarker(ctx, f, v, x, y, st, em, dim) {
  if (em) {
    ctx.strokeStyle = rgba(C.bone, em === 2 ? 0.9 : 0.55); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(x, y, em === 2 ? 15 : 12, 0, Math.PI * 2); ctx.stroke();
    if (em === 2 && f.reducedMotion !== true) {
      const p = (f.now / 1400) % 1;
      ctx.strokeStyle = rgba(C.bone, 0.35 * (1 - p)); ctx.beginPath(); ctx.arc(x, y, 15 + p * 14, 0, Math.PI * 2); ctx.stroke();
    }
  }
  ctx.globalAlpha = dim;
  glyph(ctx, st.shape, x, y, em ? 5.5 : 4.5, st.color);
  ctx.font = `${em ? 600 : 500} 12px Inter, sans-serif`;
  ctx.fillStyle = em ? C.bone : rgba(C.fog, 0.9);
  const tag = v.track.match?.status === 'matched' ? `${v.track.id} · ${v.track.match.callsign}` : v.track.id;
  ctx.fillText(tag, x + 10, y - 8);
  if (em === 2) { ctx.fillStyle = st.color; ctx.fillText(v.track.label, x + 10, y + 7); }
  ctx.globalAlpha = 1;
}

let terrainCache = null;
function terrainLayer(w, h, R, seed, dpr) {
  const key = `${w}x${h}:${R}:${seed}:${dpr}`;
  if (terrainCache?.key === key) return terrainCache.canvas;
  const cv = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(Math.ceil(2 * R * dpr), Math.ceil(2 * R * dpr)) : Object.assign(document.createElement('canvas'), { width: Math.ceil(2 * R * dpr), height: Math.ceil(2 * R * dpr) });
  const g = cv.getContext('2d'); g.scale(dpr, dpr);
  const n = 84, data = contours(seed, 12, n), s = (2 * R) / (n - 1);
  for (const lv of data.levels) {
    const major = lv.index % 4 === 3;
    g.strokeStyle = rgba(major ? C.fog : C.steel, major ? 0.42 : 0.38 + lv.index * 0.012);
    g.lineWidth = major ? 1.1 : 0.8;
    g.beginPath();
    for (const [x1, y1, x2, y2] of lv.segs) { g.moveTo(x1 * s, y1 * s); g.lineTo(x2 * s, y2 * s); }
    g.stroke();
  }
  terrainCache = { key, canvas: cv };
  return cv;
}

function drawPlan(ctx, f, L, hits) {
  const { w, h, scene, t, visible, quality, dpr } = f;
  const { cx, cy, r } = L;
  background(ctx, w, h, cx, cy, r);
  ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.clip();
  ctx.fillStyle = rgba(C.night, 0.9); ctx.fillRect(cx - r, cy - r, 2 * r, 2 * r);
  ctx.drawImage(terrainLayer(w, h, Math.round(r), scene?.seed ?? 7, dpr), cx - r, cy - r, 2 * r, 2 * r);
  const vg = ctx.createRadialGradient(cx, cy, r * 0.6, cx, cy, r); vg.addColorStop(0, 'rgba(11,15,20,0)'); vg.addColorStop(1, 'rgba(11,15,20,0.85)');
  ctx.fillStyle = vg; ctx.fillRect(cx - r, cy - r, 2 * r, 2 * r);
  // node horizontal field of view
  if (scene?.node) {
    const a0 = (scene.node.boresightAz - scene.node.fov / 2 - 90) * D2R, a1 = (scene.node.boresightAz + scene.node.fov / 2 - 90) * D2R;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, r, a0, a1); ctx.closePath();
    ctx.fillStyle = rgba(C.sage, 0.14); ctx.fill(); ctx.setLineDash([4, 5]); ctx.strokeStyle = rgba(C.sage, 0.8); ctx.stroke(); ctx.setLineDash([]);
  }
  ctx.restore();
  // range rings (terrain scale)
  ctx.lineWidth = 1;
  [1, 2, 3].forEach((km) => { ctx.strokeStyle = rgba(C.fog, km === 3 ? 0.55 : 0.22); ctx.beginPath(); ctx.arc(cx, cy, (r * km) / 3, 0, Math.PI * 2); ctx.stroke(); ctx.font = '500 12px Inter, sans-serif'; ctx.fillStyle = rgba(C.fog, 0.85); ctx.fillText(`${km} km`, cx + 5, cy - (r * km) / 3 + 14); });
  ctx.font = '600 15px "Space Grotesk", Inter, sans-serif'; ctx.fillStyle = C.bone; ctx.textAlign = 'center';
  for (const [lbl, a] of [['N', 0], ['E', 90], ['S', 180], ['W', 270]]) ctx.fillText(lbl, cx + (r + 22) * Math.sin(a * D2R), cy - (r + 22) * Math.cos(a * D2R) + 5);
  ctx.textAlign = 'left';
  // node
  ctx.fillStyle = C.bone; ctx.beginPath(); ctx.arc(cx, cy, 4, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = rgba(C.bone, 0.5); ctx.beginPath(); ctx.arc(cx, cy, 9, 0, Math.PI * 2); ctx.stroke();
  ctx.font = '600 12px Inter, sans-serif'; ctx.fillText('NODE', cx + 13, cy + 4);
  // bearings only: a passive sensor knows direction, not distance
  const len = quality === 'low' ? 30 : 50, step = quality === 'low' ? 2 : 0.5;
  for (const v of visible) {
    const st = KIND_STYLE[v.track.kind], em = emphasis(f, v.track.id);
    const dim = f.selectedId && em === 0 ? 0.45 : 1;
    const s = Math.sin(v.az * D2R), c = Math.cos(v.az * D2R);
    ctx.strokeStyle = rgba(st.color, (em ? 0.7 : 0.32) * dim); ctx.lineWidth = em ? 1.4 : 1;
    ctx.beginPath(); ctx.moveTo(cx + 12 * s, cy - 12 * c); ctx.lineTo(cx + r * s, cy - r * c); ctx.stroke();
    const trail = trailFor(v.track, t, len, step);
    for (let i = 1; i < trail.length; i++) {
      const a = (i / trail.length) ** 1.6, rr = r + 6;
      ctx.strokeStyle = rgba(st.color, a * 0.8 * dim); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(cx + rr * Math.sin(trail[i - 1].az * D2R), cy - rr * Math.cos(trail[i - 1].az * D2R)); ctx.lineTo(cx + rr * Math.sin(trail[i].az * D2R), cy - rr * Math.cos(trail[i].az * D2R)); ctx.stroke();
    }
    const x = cx + (r + 6) * s, y = cy - (r + 6) * c;
    drawMarker(ctx, f, v, x, y, st, em, dim);
    hits.push({ id: v.track.id, x, y });
  }
  ctx.font = '500 12px Inter, sans-serif'; ctx.fillStyle = rgba(C.fog, 0.9); ctx.textAlign = 'center';
  ctx.fillText('Bearings only: a passive camera measures direction, not distance. Terrain is procedural.', cx, cy + r + 46);
  ctx.textAlign = 'left';
}
