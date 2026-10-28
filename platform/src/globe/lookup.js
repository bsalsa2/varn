import { GoogleGeocoderService, Rectangle, Cartographic, Math as CMath } from 'cesium';

// Search and point lookups: coordinates parsed locally; places from OpenStreetMap Nominatim
// (on submit only, as its usage policy requires); imagery capture dates from Esri's World
// Imagery metadata service.

const D = '(-?\\d+(?:\\.\\d+)?)';
/** "35.06, -118.15", "35.06N 118.15W" → { lat, lon } or null. */
export function parseCoords(text) {
  const t = text.trim().toUpperCase().replace(/°/g, ' ');
  let m = new RegExp(`^${D}\\s*([NS])?[\\s,;]+${D}\\s*([EW])?$`).exec(t);
  if (!m) return null;
  let lat = +m[1], lon = +m[3];
  if (m[2] === 'S') lat = -Math.abs(lat);
  if (m[4] === 'W') lon = -Math.abs(lon);
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  return { lat, lon };
}

export async function searchPlaces(q, signal) {
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&addressdetails=0&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, { signal, headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`Search service answered HTTP ${res.status}`);
  const rows = await res.json();
  return rows.map((r) => ({
    name: r.display_name, type: r.type, lat: +r.lat, lon: +r.lon,
    bbox: r.boundingbox ? r.boundingbox.map(Number) : null,        // [south, north, west, east]
  }));
}

/** Google geocoding, required by Google's terms whenever their 3D tiles are on screen. */
export async function searchGoogle(q, key) {
  const deg = CMath.toDegrees;
  const rows = await new GoogleGeocoderService({ key }).geocode(q);
  return rows.slice(0, 6).map((r) => {
    const d = r.destination;
    if (d instanceof Rectangle) {
      const c = Rectangle.center(d);
      return { name: r.displayName, type: '', lat: deg(c.latitude), lon: deg(c.longitude), bbox: [deg(d.south), deg(d.north), deg(d.west), deg(d.east)] };
    }
    const c = Cartographic.fromCartesian(d);
    return { name: r.displayName, type: '', lat: deg(c.latitude), lon: deg(c.longitude), bbox: null };
  });
}

/**
 * Capture date, resolution and source of the Esri World Imagery under a point. The service
 * has one layer per zoom band; the finest answering layer is the imagery seen when zoomed in.
 */
export async function imageryMetadata(lat, lon, signal) {
  const d = 0.01;
  const params = new URLSearchParams({
    geometry: `${lon},${lat}`, geometryType: 'esriGeometryPoint', sr: '4326', layers: 'all', tolerance: '1',
    mapExtent: `${lon - d},${lat - d},${lon + d},${lat + d}`, imageDisplay: '400,400,96', returnGeometry: 'false', f: 'json',
  });
  const res = await fetch(`https://metadata.maptiles.arcgis.com/arcgis/rest/services/World_Imagery_Metadata/MapServer/identify?${params}`, { signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  const rows = (json.results || []).map((r) => r.attributes || {}).map((a) => {
    const pick = (re) => { const k = Object.keys(a).find((x) => re.test(x)); return k ? a[k] : null; };
    return { date: toDate(pick(/^SRC_DATE2?$|DATE/i)), res: Number(pick(/^SRC_RES$|RES/i)) || null, source: pick(/^NICE_DESC$|^SRC_DESC$|DESC/i), name: pick(/NICE_NAME|NAME/i) };
  }).filter((r) => r.date || r.res);
  if (!rows.length) return null;
  rows.sort((a, b) => (a.res ?? 1e9) - (b.res ?? 1e9));
  return rows[0];
}

function toDate(v) {
  if (v == null || v === '') return null;
  const s = String(v);
  if (/^\d{8}$/.test(s)) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
  if (/^\d{10,13}$/.test(s)) return new Date(Number(s.length === 10 ? s * 1000 : s)).toISOString().slice(0, 10);
  const t = Date.parse(s);
  return Number.isNaN(t) ? null : new Date(t).toISOString().slice(0, 10);
}
