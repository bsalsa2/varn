// Extruded OpenStreetMap buildings drawn inside the existing Cesium scene (no second engine).
// Tiles around the view centre are fetched, decoded, sat on the terrain and added as one async
// primitive each. Nothing is drawn above BUILDINGS_FROM_M, so the global view stays clean.
import {
  Cartesian2, Cartesian3, Cartographic, Color, ColorGeometryInstanceAttribute, Credit, EllipsoidTerrainProvider, GeometryInstance, Matrix4,
  PerInstanceColorAppearance, PolygonGeometry, PolygonHierarchy, Primitive, Transforms, sampleTerrain, Math as CMath,
} from 'cesium';
import { TILEJSON_URL, BUILDING_ZOOM, tileOf, tileCentre, decodeBuildings, wallColour } from './buildingsData.js';

export const BUILDINGS_FROM_M = 6500;               // buildings appear below this camera height
const PRELOAD_M = 11000;                            // …and start loading (hidden) a little earlier so they are ready
const HIDE_M = BUILDINGS_FROM_M * 1.2;              // hysteresis: no flicker at the threshold
const MAX_TILES = 20, MAX_BUILDINGS = 40000, MAX_PARALLEL = 3, RISE_MS = 650;
export const BUILDINGS_CREDIT = '© OpenStreetMap contributors · building tiles by OpenFreeMap / OpenMapTiles';

const ease = (t) => 1 - (1 - t) ** 3;

export function createBuildings({ scene, globe, camera, creditDisplay, onState }) {
  let enabled = false, shown = false, destroyed = false, pending = 0, tilejson = null, tilejsonErr = null, loading = null;
  let okTiles = 0, failedTiles = 0, building = 0, mappedCount = 0, unmappedCount = 0, capped = 0;
  const tiles = new Map();                          // key -> { primitive, centre, lastUsed, count }
  const inflight = new Map();                       // key -> AbortController
  let timer = 0, riseRaf = 0, riseStart = 0;
  const credit = new Credit(BUILDINGS_CREDIT);

  const report = (extra = {}) => onState?.({
    status: tilejsonErr ? 'error' : enabled ? 'on' : 'off',
    source: 'OpenStreetMap building footprints (extruded)', error: tilejsonErr,
    detail: { tiles: okTiles, buildings: building, mapped: mappedCount, unmapped: unmappedCount, capped, failed: failedTiles }, ...extra,
  });

  async function discover() {
    if (tilejson) return tilejson;
    loading ||= fetch(TILEJSON_URL, { headers: { accept: 'application/json' } })
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((j) => {
        const url = j.tiles?.[0];
        if (!url) throw new Error('no tile URL in the TileJSON');
        tilejson = { url, maxzoom: j.maxzoom ?? BUILDING_ZOOM };
        return tilejson;
      })
      .catch((e) => { tilejsonErr = `Building tiles unreachable (${e.message || 'network error'})`; loading = null; report(); throw e; });
    return loading;
  }

  const keyOf = (t) => `${t.z}/${t.x}/${t.y}`;

  /** Ground heights for each building (lowest of centroid and first vertex), so slopes never leave a building floating. */
  async function groundHeights(list) {
    const tp = globe.terrainProvider;
    if (tp instanceof EllipsoidTerrainProvider) return list.map(() => 0);
    const pts = [];
    for (const b of list) {
      let cx = 0, cy = 0;
      b.outer.forEach(([x, y]) => { cx += x; cy += y; });
      pts.push(Cartographic.fromDegrees(cx / b.outer.length, cy / b.outer.length), Cartographic.fromDegrees(b.outer[0][0], b.outer[0][1]));
    }
    try {
      const res = await Promise.race([sampleTerrain(tp, 14, pts), new Promise((_, rej) => setTimeout(() => rej(new Error('terrain sampling timed out')), 8000))]);
      return list.map((_, i) => {
        const a = res[2 * i].height, b = res[2 * i + 1].height;
        const v = Math.min(Number.isFinite(a) ? a : Infinity, Number.isFinite(b) ? b : Infinity);
        return Number.isFinite(v) ? v : 0;
      });
    } catch { return list.map(() => 0); }
  }

  async function loadTile(t) {
    const key = keyOf(t);
    if (tiles.has(key) || inflight.has(key) || destroyed) return;
    const ctl = new AbortController(); inflight.set(key, ctl); pending++;
    try {
      const tj = await discover();
      const res = await fetch(tj.url.replace('{z}', t.z).replace('{x}', t.x).replace('{y}', t.y), { signal: ctl.signal });
      if (res.status === 404 || res.status === 204) { tiles.set(key, { primitive: null, lastUsed: performance.now(), count: 0 }); evict(); return; }   // ocean / empty tile
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const { buildings, dropped } = decodeBuildings(await res.arrayBuffer(), t);
      if (destroyed || ctl.signal.aborted) return;
      const ground = await groundHeights(buildings);
      if (destroyed || ctl.signal.aborted) return;
      const instances = buildings.map((b, i) => {
        const base = ground[i] - 1;                   // sit 1 m into the ground: hides rounding gaps on slopes
        const [r, g, bl] = wallColour(b);
        const ring = (pts) => pts.map(([lon, lat]) => Cartesian3.fromDegrees(lon, lat));
        return new GeometryInstance({
          geometry: new PolygonGeometry({
            polygonHierarchy: new PolygonHierarchy(ring(b.outer), b.holes.map((h) => new PolygonHierarchy(ring(h)))),
            height: base + b.minHeight, extrudedHeight: base + b.height, vertexFormat: PerInstanceColorAppearance.VERTEX_FORMAT,
          }),
          attributes: { color: ColorGeometryInstanceAttribute.fromColor(new Color(r, g, bl, 1)) },
        });
      });
      let primitive = null;
      if (instances.length) {
        primitive = scene.primitives.add(new Primitive({
          geometryInstances: instances, appearance: new PerInstanceColorAppearance({ translucent: false, closed: true }),
          asynchronous: true, allowPicking: false, releaseGeometryInstances: true, show: shown,
        }));
      }
      const c = tileCentre(t);
      tiles.set(key, { primitive, centre: Cartesian3.fromDegrees(c.lon, c.lat, 0), lastUsed: performance.now(), count: buildings.length, risen: false });
      okTiles++; building += buildings.length; capped += dropped;
      buildings.forEach((b) => { if (b.mapped) mappedCount++; else unmappedCount++; });
      if (primitive && shown) startRise([key]);
      evict(); report(); scene.requestRender();
    } catch (e) {
      if (e.name !== 'AbortError') { failedTiles++; if (!okTiles && failedTiles >= 3) { tilejsonErr = `Building tiles are not loading (${e.message || 'network error'})`; } report(); }
    } finally { inflight.delete(key); pending--; pump(); }
  }

  /* ── which tiles matter, nearest first ── */
  let queue = [];
  function pump() { while (pending < MAX_PARALLEL && queue.length) loadTile(queue.shift()); }

  function update() {
    if (destroyed) return;
    const h = camera.positionCartographic.height;
    if (!enabled || h > PRELOAD_M * 1.5) { setShown(false); return; }
    const centre = centreOfView();
    if (!centre) return;
    const c = tileOf(centre.lat, centre.lon);
    const R = 1;                                     // 3×3 tiles (~7 km square): enough for the view, and bounded memory
    const want = [];
    for (let dx = -R; dx <= R; dx++) for (let dy = -R; dy <= R; dy++) want.push({ z: BUILDING_ZOOM, x: c.x + dx, y: c.y + dy, d: dx * dx + dy * dy });
    want.sort((a, b) => a.d - b.d);
    const now = performance.now();
    want.forEach((t) => { const e = tiles.get(keyOf(t)); if (e) e.lastUsed = now; });
    queue = want.filter((t) => !tiles.has(keyOf(t)) && !inflight.has(keyOf(t)));
    // Anything queued earlier that is no longer wanted is simply dropped; requests in flight are cancelled when far away.
    for (const [k, ctl] of inflight) { if (!want.some((t) => keyOf(t) === k)) ctl.abort(); }
    if (queue.length && !tilejsonErr) discover().then(pump).catch(() => {});
    setShown(h < (shown ? HIDE_M : BUILDINGS_FROM_M));
  }

  function centreOfView() {
    const w = scene.canvas.clientWidth / 2, hgt = scene.canvas.clientHeight / 2;
    const ray = camera.getPickRay(new Cartesian2(w, hgt));
    const hit = ray && globe.pick(ray, scene);
    const g = hit ? Cartographic.fromCartesian(hit) : camera.positionCartographic;
    return { lat: CMath.toDegrees(g.latitude), lon: CMath.toDegrees(g.longitude) };
  }

  function setShown(on) {
    if (on === shown) return;
    shown = on;
    for (const e of tiles.values()) if (e.primitive) e.primitive.show = on;
    if (on) { creditDisplay?.addStaticCredit?.(credit); startRise([...tiles.keys()]); }
    scene.requestRender();
  }

  /** Buildings grow out of the ground instead of popping in: scale about the tile centre, along local up. */
  const rising = new Set();
  function startRise(keys) {
    keys.forEach((k) => { const e = tiles.get(k); if (e?.primitive) { rising.add(k); e.primitive.modelMatrix = scaleUp(e.centre, 0.02); } });
    riseStart = performance.now();
    if (!riseRaf) riseRaf = requestAnimationFrame(stepRise);
  }
  const scaleUp = (centre, s) => {
    const enu = Transforms.eastNorthUpToFixedFrame(centre);
    const inv = Matrix4.inverseTransformation(enu, new Matrix4());
    const S = Matrix4.fromScale(new Cartesian3(1, 1, s), new Matrix4());
    return Matrix4.multiplyTransformation(Matrix4.multiplyTransformation(enu, S, new Matrix4()), inv, new Matrix4());
  };
  function stepRise(now) {
    riseRaf = 0;
    if (destroyed) return;
    const t = Math.min(1, (now - riseStart) / RISE_MS), s = Math.max(0.02, ease(t));
    for (const k of rising) { const e = tiles.get(k); if (e?.primitive) e.primitive.modelMatrix = t >= 1 ? Matrix4.clone(Matrix4.IDENTITY) : scaleUp(e.centre, s); }
    if (t >= 1) rising.clear();
    scene.requestRender();
    if (t < 1) riseRaf = requestAnimationFrame(stepRise);
  }

  function evict() {
    if (tiles.size <= MAX_TILES && building <= MAX_BUILDINGS) return;
    const order = [...tiles.entries()].sort((a, b) => a[1].lastUsed - b[1].lastUsed);
    while (order.length > 9 && (tiles.size > MAX_TILES || building > MAX_BUILDINGS)) {
      const [k, e] = order.shift();
      if (e.primitive) scene.primitives.remove(e.primitive);
      building -= e.count; tiles.delete(k); rising.delete(k);
    }
  }

  const schedule = () => { clearTimeout(timer); timer = setTimeout(update, 220); };

  return {
    setEnabled(on) {
      enabled = on;
      if (on) { tilejsonErr = null; discover().then(() => report(), () => {}); report(); update(); } else { setShown(false); report(); }
    },
    schedule, update,
    stats: () => ({ tiles: tiles.size, shown, buildings: building }),
    destroy() {
      destroyed = true; clearTimeout(timer); cancelAnimationFrame(riseRaf);
      inflight.forEach((c) => c.abort());
      for (const e of tiles.values()) if (e.primitive && !scene.isDestroyed()) scene.primitives.remove(e.primitive);
      tiles.clear();
    },
  };
}
