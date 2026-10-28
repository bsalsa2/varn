// Satellite basemap for VARN Sky: tiled imagery on a 2D canvas, plus a WebGL descent from orbit.
//
// Imagery (both free, no key, loaded by the viewer's browser):
//   detail  Sentinel-2 cloudless 2016 by EOX, CC BY 4.0. Cloud-free composite, ~10 m per pixel.
//   today   NASA GIBS, VIIRS (Suomi NPP) corrected-reflectance true colour for one UTC day.
//           Real clouds and weather from that day; ~250–500 m per pixel.
// Nothing here is a live view of the site: the date of every layer is shown next to it.
import { TILE, project, unproject, worldSize, globeRadiusFor } from './geo.js';
import { createEarthRenderer, sunVector } from '../earth/renderer.js';
import { subsolarPoint } from '../earth/sun.js';

export const LAYERS = {
  detail: {
    name: 'Sentinel-2 cloudless', short: 'Detail', maxNative: 15, ext: 'jpg',
    when: () => '2016 composite, cloud-free',
    url: (z, x, y) => `https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless_3857/default/g/${z}/${y}/${x}.jpg`,
    credit: 'Sentinel-2 cloudless – s2maps.eu by EOX IT Services GmbH (contains modified Copernicus Sentinel data 2016 & 2017), CC BY 4.0',
  },
  today: {
    name: 'NASA VIIRS true colour', short: 'Daily', maxNative: 9, ext: 'jpg',
    when: (date) => `${date} (UTC day)`,
    url: (z, x, y, date) => `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_SNPP_CorrectedReflectance_TrueColor/default/${date}/GoogleMapsCompatible_Level9/${z}/${y}/${x}.jpg`,
    credit: 'NASA EOSDIS GIBS, VIIRS (Suomi NPP) Corrected Reflectance',
  },
};

/** Yesterday in UTC: the most recent day with a complete VIIRS composite. */
export function latestDay(now = new Date()) { return new Date(now.getTime() - 86400000).toISOString().slice(0, 10); }
export function shiftDay(date, days) { return new Date(Date.parse(`${date}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10); }

const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const GLOBE_OUT = 4.6, GLOBE_GONE = 5.6;   // zoom range where the globe hands over to tiles
const MAX_ZOOM = 17, MIN_ZOOM = 1.4;

class TileCache {
  constructor(onLoad, limit = 600) { this.map = new Map(); this.onLoad = onLoad; this.limit = limit; this.active = 0; this.queue = []; this.ok = 0; this.failed = 0; }
  get(key, url) {
    let e = this.map.get(key);
    if (e) { this.map.delete(key); this.map.set(key, e); return e; }   // LRU touch
    e = { status: 'queued', img: null, t: 0, url };
    this.map.set(key, e);
    this.queue.push(e);
    this.pump();
    if (this.map.size > this.limit) for (const [k, v] of this.map) { if (v.status !== 'loading') { this.map.delete(k); if (this.map.size <= this.limit) break; } }
    return e;
  }
  pump() {
    while (this.active < 8 && this.queue.length) {
      const e = this.queue.shift();
      if (e.status !== 'queued') continue;
      e.status = 'loading'; this.active++;
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => { e.status = 'ok'; e.img = img; e.t = performance.now(); this.ok++; this.active--; this.onLoad(); this.pump(); };
      img.onerror = () => { e.status = 'err'; this.failed++; this.active--; this.onLoad(); this.pump(); };
      img.src = e.url;
    }
  }
  /** Drop queued requests that are no longer on screen (called each draw before requesting). */
  resetQueue() { for (const e of this.queue) if (e.status === 'queued') { e.status = 'stale'; } this.queue = []; for (const [k, v] of this.map) if (v.status === 'stale') this.map.delete(k); }
}

export class SatelliteMap {
  constructor({ mapCanvas, globeCanvas, site, onChange, reducedMotion }) {
    this.map = mapCanvas; this.ctx = mapCanvas.getContext('2d');
    this.globeCanvas = globeCanvas;
    this.site = site;
    this.onChange = onChange;
    this.reduced = reducedMotion;
    this.cam = { lat: site.lat, lon: site.lon, zoom: 13.6 };
    this.layer = 'detail';
    this.compare = false;
    this.divider = 0.62;
    this.date = latestDay();
    this.loupe = null;            // { x, y } in CSS px while Shift is held
    this.dirty = true;
    this.descent = null;
    this.cache = new TileCache(() => { this.dirty = true; });
    this.globe = null;
    this.globeReady = false;
    this.sun = subsolarPoint();
  }

  ensureGlobe() {
    if (this.globe !== null || !this.globeCanvas) return;
    this.globe = createEarthRenderer(this.globeCanvas) || false;
    if (this.globe) this.globe.ready.then(() => { this.globeReady = true; this.dirty = true; }).catch(() => { this.globe = false; });
  }

  /** Fly in from orbit to the site. Reduced motion jumps straight to the end. */
  descend(now = performance.now()) {
    this.cam = { lat: this.site.lat, lon: this.site.lon, zoom: this.reduced ? 13.6 : MIN_ZOOM + 0.4 };
    this.descent = this.reduced ? null : { t0: now, dur: 5200, from: this.cam.zoom, to: 13.6 };
    this.ensureGlobe();
    this.dirty = true;
  }
  stopDescent() { this.descent = null; }
  recenter() { this.cam.lat = this.site.lat; this.cam.lon = this.site.lon; this.dirty = true; }

  setLayer(id) { this.layer = id; this.compare = false; this.dirty = true; this.onChange?.(); }
  setCompare(on) { this.compare = on; this.dirty = true; this.onChange?.(); }
  setDate(d) { this.date = d; this.dirty = true; this.onChange?.(); }

  /** Screen row of the camera centre: a little high on phones, where panels fill the bottom. */
  midY(w, h) { return w < 760 ? h * 0.52 : h / 2; }

  /** Screen position (CSS px) of a lat/lon under the current camera. */
  toScreen(lat, lon, w, h) {
    const [cx, cy] = project(this.cam.lat, this.cam.lon, this.cam.zoom);
    const [x, y] = project(lat, lon, this.cam.zoom);
    let dx = x - cx; const s = worldSize(this.cam.zoom);
    if (dx > s / 2) dx -= s; else if (dx < -s / 2) dx += s;
    return [w / 2 + dx, this.midY(w, h) + (y - cy)];
  }
  toLatLon(px, py, w, h) {
    const [cx, cy] = project(this.cam.lat, this.cam.lon, this.cam.zoom);
    return unproject(cx + px - w / 2, cy + py - this.midY(w, h), this.cam.zoom);
  }
  panBy(dx, dy) {
    const [cx, cy] = project(this.cam.lat, this.cam.lon, this.cam.zoom);
    const [lat, lon] = unproject(cx - dx, cy - dy, this.cam.zoom);
    this.cam.lat = lat; this.cam.lon = lon; this.descent = null; this.dirty = true;
  }
  /** Zoom by dz keeping the ground under (px, py) fixed. */
  zoomAt(dz, px, py, w, h) {
    const [lat, lon] = this.toLatLon(px, py, w, h);
    this.cam.zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, this.cam.zoom + dz));
    const [ax, ay] = project(lat, lon, this.cam.zoom);
    const [clat, clon] = unproject(ax - (px - w / 2), ay - (py - this.midY(w, h)), this.cam.zoom);
    this.cam.lat = clat; this.cam.lon = clon; this.descent = null; this.dirty = true;
  }

  status() {
    return { ok: this.cache.ok, failed: this.cache.failed, loading: this.cache.active + this.cache.queue.length, zoom: this.cam.zoom, globe: this.globeVisible ?? 0 };
  }

  /** Called every animation frame while the satellite view is shown. Returns true if it drew. */
  frame(now, w, h, dpr) {
    if (this.descent) {
      const u = Math.min(1, (now - this.descent.t0) / this.descent.dur);
      this.cam.zoom = this.descent.from + (this.descent.to - this.descent.from) * easeInOut(u);
      this.cam.lat = this.site.lat; this.cam.lon = this.site.lon;
      if (u >= 1) this.descent = null;
      this.dirty = true;
    }
    const W = Math.round(w * dpr), H = Math.round(h * dpr);
    if (this.map.width !== W || this.map.height !== H) { this.map.width = W; this.map.height = H; this.dirty = true; }
    if (!this.dirty) return false;
    this.dirty = false;

    const z = this.cam.zoom;
    const globeAlpha = this.globe && this.globeReady ? Math.max(0, Math.min(1, (GLOBE_GONE - z) / (GLOBE_GONE - GLOBE_OUT))) : 0;
    this.globeVisible = globeAlpha;

    const ctx = this.ctx;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#0B0F14'; ctx.fillRect(0, 0, w, h);
    this.cache.resetQueue();
    if (globeAlpha < 1) {
      if (this.compare) {
        const split = Math.round(w * this.divider);
        this.drawLayer(ctx, 'detail', z, w, h);
        ctx.save(); ctx.beginPath(); ctx.rect(split, 0, w - split, h); ctx.clip();
        this.drawLayer(ctx, 'today', z, w, h);
        ctx.restore();
      } else this.drawLayer(ctx, this.layer, z, w, h);
      if (this.loupe) this.drawLoupe(ctx, w, h);
    }
    // Grade the imagery toward VARN's charcoal so overlays stay legible.
    const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.2, w / 2, h / 2, Math.max(w, h) * 0.75);
    g.addColorStop(0, 'rgba(11,15,20,0.08)'); g.addColorStop(1, 'rgba(11,15,20,0.62)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);

    if (this.globe && this.globeCanvas) {
      this.globeCanvas.style.opacity = String(globeAlpha);
      if (globeAlpha > 0) {
        this.globe.resize(1.5);
        const [sx, sy] = this.toScreen(this.site.lat, this.site.lon, w, h);
        this.globe.draw({ cx: sx, cy: sy, r: globeRadiusFor(this.cam.lat, z), viewLat: this.cam.lat, viewLon: this.cam.lon, sun: sunVector(this.sun), reveal: 1, grid: 0.12 });
      }
    }
    // Keep animating while tiles are fading in.
    if (this.fading) this.dirty = true;
    return true;
  }

  drawLayer(ctx, id, zoom, w, h, anchor = null) {
    const L = LAYERS[id];
    const zi = Math.max(1, Math.min(L.maxNative, Math.round(zoom)));
    const scale = 2 ** (zoom - zi);
    // Anchor: a lat/lon that must land on a given screen point (the loupe uses this).
    const [alat, alon, ax, ay] = anchor ?? [this.cam.lat, this.cam.lon, w / 2, this.midY(w, h)];
    const [wx, wy] = project(alat, alon, zi);
    const n = 2 ** zi, size = TILE * scale;
    const x0 = Math.floor((wx - ax / scale) / TILE), x1 = Math.floor((wx + (w - ax) / scale) / TILE);
    const y0 = Math.max(0, Math.floor((wy - ay / scale) / TILE)), y1 = Math.min(n - 1, Math.floor((wy + (h - ay) / scale) / TILE));
    const tiles = [];
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) tiles.push([tx, ty, (tx + 0.5 - wx / TILE) ** 2 + (ty + 0.5 - wy / TILE) ** 2]);
    tiles.sort((a, b) => a[2] - b[2]);
    const now = performance.now();
    let fading = false;
    for (const [tx, ty] of tiles) {
      const x = ax + (tx * TILE - wx) * scale, y = ay + (ty * TILE - wy) * scale;
      const wrapX = ((tx % n) + n) % n;
      const e = this.tile(id, zi, wrapX, ty);
      const fade = e.status === 'ok' ? Math.min(1, (now - e.t) / 260) : 0;
      if (fade < 1) {
        // Until the tile arrives (and while it fades in), show the best loaded ancestor.
        for (let k = 1; k <= 6 && zi - k >= 1; k++) {
          const p = this.peek(id, zi - k, wrapX >> k, ty >> k);
          if (p?.status === 'ok') {
            const sub = TILE / 2 ** k;
            ctx.drawImage(p.img, (wrapX % 2 ** k) * sub, (ty % 2 ** k) * sub, sub, sub, x, y, size + 0.5, size + 0.5);
            break;
          }
        }
      }
      if (fade > 0) { ctx.globalAlpha = fade; ctx.drawImage(e.img, x, y, size + 0.5, size + 0.5); ctx.globalAlpha = 1; }
      if (fade > 0 && fade < 1) fading = true;
    }
    this.fading = fading;
    // Keep a coarse ancestor level warm so panning and zooming out never show black.
    if (zi > 4) for (let ty = y0 >> 3; ty <= y1 >> 3; ty++) for (let tx = x0 >> 3; tx <= x1 >> 3; tx++) this.tile(id, zi - 3, ((tx % (n >> 3)) + (n >> 3)) % (n >> 3), ty);
  }

  key(id, z, x, y) { return `${id}/${id === 'today' ? this.date : ''}/${z}/${x}/${y}`; }
  tile(id, z, x, y) { return this.cache.get(this.key(id, z, x, y), LAYERS[id].url(z, x, y, this.date)); }
  peek(id, z, x, y) { return this.cache.map.get(this.key(id, z, x, y)); }

  drawLoupe(ctx, w, h) {
    const { x, y } = this.loupe, R = Math.min(120, Math.min(w, h) * 0.16);
    const [lat, lon] = this.toLatLon(x, y, w, h);
    ctx.save();
    ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = '#0B0F14'; ctx.fillRect(x - R, y - R, 2 * R, 2 * R);
    const id = this.compare ? (x > w * this.divider ? 'today' : 'detail') : this.layer;
    this.drawLayer(ctx, id, Math.min(MAX_ZOOM + 2, this.cam.zoom + 2), w, h, [lat, lon, x, y]);
    const rim = ctx.createRadialGradient(x, y, R * 0.75, x, y, R);
    rim.addColorStop(0, 'rgba(255,255,255,0)'); rim.addColorStop(1, 'rgba(255,255,255,0.16)');
    ctx.fillStyle = rim; ctx.fillRect(x - R, y - R, 2 * R, 2 * R);
    ctx.restore();
    ctx.strokeStyle = 'rgba(244,243,239,0.75)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(x, y, R + 4, 0, Math.PI * 2); ctx.stroke();
    ctx.font = '500 11px "DM Mono", ui-monospace, monospace'; ctx.fillStyle = 'rgba(244,243,239,0.9)'; ctx.textAlign = 'center';
    ctx.fillText('×4', x, y + R - 10); ctx.textAlign = 'left';
  }

  dispose() { this.globe?.dispose?.(); }
}
