// Pure helpers for the location-inspection panel: naming a place from a reverse-geocode answer,
// and honest sun/time facts computed from the coordinates alone.
import { solarElevation } from './commands.js';

/** { title, subtitle } from a Nominatim reverse result, or null when it knows nothing about the spot (open water, remote land). */
export function placeFrom(r) {
  if (!r || r.error) return null;
  const a = r.address || {};
  const local = r.name || a.neighbourhood || a.suburb || a.hamlet || a.village || a.town || a.city_district || a.city || a.county || null;
  const town = a.city || a.town || a.village || a.municipality || null;
  const parts = [town !== local ? town : null, a.state || a.region, a.country].filter(Boolean);
  const subtitle = [...new Set(parts)].join(', ');
  if (!local && !subtitle) return r.display_name ? { title: r.display_name.split(',')[0], subtitle: r.display_name.split(',').slice(1, 3).join(',').trim() } : null;
  return { title: local || subtitle.split(',')[0], subtitle: local ? subtitle : subtitle.split(',').slice(1).join(',').trim() };
}

/** Mean solar time at a longitude (UTC + lon/15 h). It is the sun's clock, not the civil timezone. */
export function solarTime(lon, nowMs = Date.now()) {
  const h = (((new Date(nowMs).getUTCHours() + new Date(nowMs).getUTCMinutes() / 60 + lon / 15) % 24) + 24) % 24;
  return `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.floor((h % 1) * 60)).padStart(2, '0')}`;
}

export function sunState(lat, lon, sun, nowMs) {
  const el = solarElevation(lat, lon, sun);
  const phase = el > 0 ? 'daylight' : el > -6 ? 'civil twilight' : el > -12 ? 'nautical twilight' : el > -18 ? 'astronomical twilight' : 'night';
  return { elevation: el, phase, solarTime: solarTime(lon, nowMs) };
}
