// Web Mercator and sun geometry for the satellite view. Pure functions; no DOM.
import { subsolarPoint } from '../earth/sun.js';

const D2R = Math.PI / 180, R2D = 180 / Math.PI;
export const TILE = 256;
const EARTH_CIRC = 40075016.686;   // metres at the equator

// World pixel coordinates at integer or fractional zoom z.
export const worldSize = (z) => TILE * 2 ** z;
export function project(lat, lon, z) {
  const s = worldSize(z);
  const φ = Math.max(-85.05112878, Math.min(85.05112878, lat)) * D2R;
  return [((lon + 180) / 360) * s, (0.5 - Math.log(Math.tan(Math.PI / 4 + φ / 2)) / (2 * Math.PI)) * s];
}
export function unproject(x, y, z) {
  const s = worldSize(z);
  const lon = (x / s) * 360 - 180;
  const lat = (2 * Math.atan(Math.exp(Math.PI * (1 - 2 * y / s))) - Math.PI / 2) * R2D;
  return [lat, ((lon + 540) % 360) - 180];
}

/** Ground metres per CSS pixel at latitude lat and zoom z. */
export const metersPerPixel = (lat, z) => (EARTH_CIRC * Math.cos(lat * D2R)) / worldSize(z);

/** Globe radius (px) whose centre scale matches Mercator zoom z at latitude lat. */
export const globeRadiusFor = (lat, z) => worldSize(z) / (2 * Math.PI * Math.cos(lat * D2R));

/** Sun azimuth (deg from north, clockwise) and elevation (deg) seen from lat/lon at `date`. */
export function sunAt(lat, lon, date = new Date()) {
  const s = subsolarPoint(date);
  const v = (a, b) => [Math.cos(a * D2R) * Math.cos(b * D2R), Math.cos(a * D2R) * Math.sin(b * D2R), Math.sin(a * D2R)];
  const sun = v(s.lat, s.lon), up = v(lat, lon);
  const east = [-Math.sin(lon * D2R), Math.cos(lon * D2R), 0];
  const north = [-Math.sin(lat * D2R) * Math.cos(lon * D2R), -Math.sin(lat * D2R) * Math.sin(lon * D2R), Math.cos(lat * D2R)];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const el = Math.asin(Math.max(-1, Math.min(1, dot(sun, up)))) * R2D;
  const az = ((Math.atan2(dot(sun, east), dot(sun, north)) * R2D) + 360) % 360;
  return { az, el, subsolar: s };
}

/** A "nice" ring/scale distance in metres whose on-screen size is close to `targetPx`. */
export function niceDistance(mpp, targetPx) {
  const raw = mpp * targetPx;
  const p = 10 ** Math.floor(Math.log10(raw));
  const m = raw / p;
  return (m >= 5 ? 5 : m >= 2 ? 2 : 1) * p;
}
export const fmtDistance = (m) => (m >= 1000 ? `${+(m / 1000).toFixed(m >= 10000 ? 0 : 1)} km` : `${Math.round(m)} m`);
export const fmtLat = (v) => `${Math.abs(v).toFixed(4)}°${v >= 0 ? 'N' : 'S'}`;
export const fmtLon = (v) => `${Math.abs(v).toFixed(4)}°${v >= 0 ? 'E' : 'W'}`;
