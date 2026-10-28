// OpenStreetMap building footprints from vector tiles (OpenMapTiles schema, served by OpenFreeMap).
// This file is plain JS with no Cesium or DOM, so the decoding rules can be tested on their own.
//
// What the source gives us: a footprint polygon plus `render_height` / `render_min_height` in metres,
// derived upstream from OSM `height`, `building:levels` and `min_height` tags. It does NOT give roof
// shapes or facade detail, so buildings are drawn as plain extruded footprints.
import Pbf from 'pbf';
import { VectorTile } from '@mapbox/vector-tile';

export const TILEJSON_URL = 'https://tiles.openfreemap.org/planet';
export const BUILDING_ZOOM = 14;                       // deepest zoom OpenFreeMap serves; ~2.4 km tiles at mid latitudes
export const MAX_PER_TILE = 4500;                      // keeps a dense city tile affordable on an ordinary laptop
export const MAX_HEIGHT_M = 900;

export const tileOf = (lat, lon, z = BUILDING_ZOOM) => {
  const n = 2 ** z, rad = (lat * Math.PI) / 180;
  const x = Math.floor(((lon + 180) / 360) * n);
  const y = Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n);
  return { z, x: Math.min(n - 1, Math.max(0, x)), y: Math.min(n - 1, Math.max(0, y)) };
};

export const tileCentre = ({ z, x, y }) => {
  const n = 2 ** z, lon = ((x + 0.5) / n) * 360 - 180;
  const lat = (Math.atan(Math.sinh(Math.PI * (1 - (2 * (y + 0.5)) / n))) * 180) / Math.PI;
  return { lat, lon };
};

const ringArea = (ring) => {                         // planar shoelace in degrees: only used to rank buildings
  let a = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) a += (ring[j][0] + ring[i][0]) * (ring[j][1] - ring[i][1]);
  return Math.abs(a / 2);
};
const open = (ring) => {                             // GeoJSON repeats the first point at the end; Cesium does not want it
  const r = ring.slice();
  if (r.length > 1 && r[0][0] === r[r.length - 1][0] && r[0][1] === r[r.length - 1][1]) r.pop();
  return r;
};

/** Height in metres and whether it came from a mapped value. */
export function heightOf(p) {
  const num = (v) => { const n = typeof v === 'string' ? parseFloat(v) : v; return Number.isFinite(n) ? n : null; };
  const h = num(p.render_height) ?? num(p.height);
  if (h != null && h > 0) return { height: Math.min(MAX_HEIGHT_M, h), mapped: true };
  const lv = num(p['building:levels']);
  if (lv != null && lv > 0) return { height: Math.min(MAX_HEIGHT_M, lv * 3.2), mapped: true };
  return { height: 6, mapped: false };               // unmapped: a plain low-rise default, counted so the UI can say so
}

/**
 * Decode one tile into building shapes.
 * Returns { buildings: [{ id, outer: [[lon,lat]…], holes: [[[lon,lat]…]…], height, minHeight, mapped }], total, dropped }.
 */
export function decodeBuildings(buffer, { z, x, y }) {
  const tile = new VectorTile(new Pbf(buffer));
  const layer = tile.layers.building;
  const out = [];
  let total = 0;
  if (!layer) return { buildings: out, total, dropped: 0 };
  for (let i = 0; i < layer.length; i++) {
    const f = layer.feature(i);
    total++;
    const p = f.properties || {};
    if (p.hide_3d === true || p.hide_3d === 'true' || p.hide_3d === 1) continue;   // the whole-building outline that its parts replace
    const g = f.toGeoJSON(x, y, z).geometry;
    const polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
    const { height, mapped } = heightOf(p);
    const minHeight = Math.max(0, Number(p.render_min_height) || 0);
    if (minHeight >= height) continue;
    polys.forEach((rings, k) => {
      const outer = open(rings[0] || []);
      if (outer.length < 3) return;
      out.push({
        id: `${f.id ?? i}:${k}`, outer, holes: rings.slice(1).map(open).filter((r) => r.length >= 3),
        height, minHeight, mapped, area: ringArea(outer),
      });
    });
  }
  const dropped = Math.max(0, out.length - MAX_PER_TILE);
  if (dropped) out.sort((a, b) => b.area - a.area).length = MAX_PER_TILE;        // keep the biggest footprints
  return { buildings: out, total, dropped };
}

/** Subtle, deterministic variation so a block does not read as one grey slab. Returns [r,g,b] 0..1. */
export function shade(id, height) {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) { h ^= id.charCodeAt(i); h = Math.imul(h, 16777619); }
  const v = ((h >>> 0) % 1000) / 1000;
  const tall = Math.min(1, height / 120);
  const base = 0.72 - 0.05 * tall + (v - 0.5) * 0.10;       // taller buildings read slightly cooler and darker
  return [base + 0.02 - 0.03 * tall, base - 0.01, base - 0.04 + 0.03 * tall];
}
