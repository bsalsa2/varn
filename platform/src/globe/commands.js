// Command core for the terminal. No DOM and no globals: everything it touches arrives in `ctx`,
// so every command can be tested with stand-ins. Output goes through `io.print(text, cls)`.
//
// ctx = {
//   engine   { view(), flyToPlace(lat, lon, range, pitch), home(), tilt(flat), northUp(), setMarkers(name, items, styleOf), markerCount(name) }
//   layers   { list() -> [{ name, on, note }], set(name, on) -> Promise<string | void> }
//   feeds    { fetchQuakes, fetchEvents, styleFor, WINDOWS, EVENT_CATEGORIES }
//   geocode  (text) -> Promise<[{ name, lat, lon, bbox? }]>
//   checks   (deep) -> Promise<[{ label, state, detail, ms }]>
//   imagery  (lat, lon) -> Promise<{ date, res, source } | null>
//   select   (item) -> void           show an item in the map popover
//   mem      per-session scratch: { list, marks, watch }
//   now      () -> ms
// }
import { WINDOWS, EVENT_CATEGORIES } from './feeds.js';

export const PROMPT = 'VARN ▸';

/* ── formatting ─────────────────────────────────────────── */
export const pad = (s, n) => { s = String(s ?? ''); return s.length >= n ? s.slice(0, n) : s + ' '.repeat(n - s.length); };
export const padL = (s, n) => { s = String(s ?? ''); return s.length >= n ? s.slice(0, n) : ' '.repeat(n - s.length) + s; };
export const utc = (ms, withDate = true) => {
  if (!Number.isFinite(ms)) return '—';
  const d = new Date(ms).toISOString();
  return withDate ? `${d.slice(0, 10)} ${d.slice(11, 16)}Z` : `${d.slice(11, 19)}Z`;
};
export function age(ms, now) {
  if (!Number.isFinite(ms)) return '—';
  const s = Math.max(0, Math.round((now - ms) / 1000));
  if (s < 90) return `${s}s`;
  if (s < 5400) return `${Math.round(s / 60)}m`;
  if (s < 172800) return `${(s / 3600).toFixed(1)}h`;
  return `${Math.round(s / 86400)}d`;
}
export const latlon = (lat, lon, d = 3) => `${Math.abs(lat).toFixed(d)}°${lat >= 0 ? 'N' : 'S'} ${Math.abs(lon).toFixed(d)}°${lon >= 0 ? 'E' : 'W'}`;
export function altitude(m) {
  if (!Number.isFinite(m)) return '—';
  return m >= 100000 ? `${Math.round(m / 1000).toLocaleString('en-US')} km` : m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`;
}

/** Shell-like split: spaces separate words, quotes group them. */
export function parseLine(line) {
  const out = []; let cur = '', q = null, started = false;
  for (const ch of line.trim()) {
    if (q) { if (ch === q) q = null; else cur += ch; }
    else if (ch === '"' || ch === "'") { q = ch; started = true; }
    else if (/\s/.test(ch)) { if (cur || started) { out.push(cur); cur = ''; started = false; } }
    else cur += ch;
  }
  if (cur || started) out.push(cur);
  return out;
}

/** Parses "35.05, -118.17" and "35.05N 118.17W". */
export function parseCoords(text) {
  const m = text.trim().match(/^(-?\d+(?:\.\d+)?)\s*°?\s*([NSns])?\s*[, ]\s*(-?\d+(?:\.\d+)?)\s*°?\s*([EWew])?$/);
  if (!m) return null;
  let lat = parseFloat(m[1]), lon = parseFloat(m[3]);
  if (/s/i.test(m[2] || '')) lat = -Math.abs(lat);
  if (/w/i.test(m[4] || '')) lon = -Math.abs(lon);
  return Math.abs(lat) <= 90 && Math.abs(lon) <= 180 ? { lat, lon } : null;
}

/** Real solar elevation (degrees) at a place, from the subsolar point. */
export function solarElevation(lat, lon, sun) {
  const rad = Math.PI / 180;
  const h = (lon - sun.lon) * rad;
  const s = Math.sin(lat * rad) * Math.sin(sun.lat * rad) + Math.cos(lat * rad) * Math.cos(sun.lat * rad) * Math.cos(h);
  return Math.asin(Math.max(-1, Math.min(1, s))) / rad;
}
const twilight = (el) => (el > 0 ? 'daylight' : el > -6 ? 'civil twilight' : el > -12 ? 'nautical twilight' : el > -18 ? 'astronomical twilight' : 'night');

/* ── layer names the operator can type ───────────────────── */
export const LAYER_ALIASES = { sat: 'satellite', satellite: 'satellite', terrain: 'terrain', labels: 'labels', daynight: 'daynight', night: 'daynight',
  clouds: 'clouds', weather: 'weather', rain: 'weather', fires: 'fires', thermal: 'fires', vegetation: 'vegetation', ndvi: 'vegetation',
  nightlights: 'nightLights', lights: 'nightLights', buildings: 'buildings', '3d': 'buildings' };

const onOff = (v) => (/^(on|1|true|show|yes)$/i.test(v) ? true : /^(off|0|false|hide|no)$/i.test(v) ? false : null);

/* ── tables ─────────────────────────────────────────────── */
function quakeTable(items, now, io, limit = 15) {
  io.print(`${pad('#', 3)} ${pad('MAG', 4)} ${pad('UTC', 17)} ${pad('AGE', 5)} ${padL('DEPTH', 6)}  LOCATION`, 'head');
  items.slice(0, limit).forEach((q, i) => {
    const cls = q.mag >= 6 ? 'err' : q.mag >= 5 ? 'warn' : '';
    io.print(`${pad(i + 1, 3)} ${pad(q.mag.toFixed(1), 4)} ${pad(utc(q.time), 17)} ${pad(age(q.time, now), 5)} ${padL(Number.isFinite(q.depthKm) ? `${Math.round(q.depthKm)} km` : '—', 6)}  ${q.title}${q.tsunami ? '  [USGS tsunami flag]' : ''}`, cls);
  });
  if (items.length > limit) io.print(`… ${items.length - limit} more plotted on the globe`, 'dim');
}
function eventTable(items, now, io, limit = 15) {
  io.print(`${pad('#', 3)} ${pad('UTC', 17)} ${pad('AGE', 5)} ${pad('TYPE', 14)} TITLE`, 'head');
  items.slice(0, limit).forEach((e, i) => io.print(`${pad(i + 1, 3)} ${pad(utc(e.time), 17)} ${pad(age(e.time, now), 5)} ${pad(e.category, 14)} ${e.title}`));
  if (items.length > limit) io.print(`… ${items.length - limit} more plotted on the globe`, 'dim');
}

/* ── commands ───────────────────────────────────────────── */
export const COMMANDS = {};
const add = (name, def) => { COMMANDS[name] = { name, ...def }; (def.aliases || []).forEach((a) => { COMMANDS[a] = COMMANDS[name]; }); };

add('help', {
  summary: 'List commands, or describe one', usage: 'help [command]',
  run(args, ctx, io) {
    const c = args[0] && COMMANDS[args[0].toLowerCase()];
    if (args[0] && !c) { io.print(`no such command: ${args[0]}`, 'err'); return; }
    if (c) { io.print(`${c.name}: ${c.summary}`); io.print(`usage: ${c.usage}`, 'dim'); (c.examples || []).forEach((e) => io.print(`  ${e}`, 'dim')); return; }
    io.print('COMMANDS', 'head');
    const seen = new Set();
    for (const [k, v] of Object.entries(COMMANDS)) { if (seen.has(v) || k !== v.name) continue; seen.add(v); io.print(`  ${pad(v.name, 9)} ${v.summary}`); }
    io.print('');
    io.print('Tab completes · ↑/↓ history · Ctrl+L clears · ` toggles this terminal · Esc leaves the prompt', 'dim');
  },
});

add('status', {
  aliases: ['stat'], summary: 'Camera, sun, layers and rendering state', usage: 'status',
  run(args, ctx, io) {
    const v = ctx.engine.view(), now = ctx.now();
    io.print('STATUS', 'head');
    io.print(`  time        ${utc(now, true).replace('Z', '')}:${String(new Date(now).getUTCSeconds()).padStart(2, '0')} UTC`);
    io.print(`  camera      ${altitude(v.height)} altitude · heading ${Math.round((v.heading + 360) % 360)}° · pitch ${Math.round(v.pitch)}°`);
    if (v.centre) io.print(`  view centre ${latlon(v.centre.lat, v.centre.lon)} · sun ${twilight(solarElevation(v.centre.lat, v.centre.lon, v.sun))} (${solarElevation(v.centre.lat, v.centre.lon, v.sun).toFixed(1)}°)`);
    else io.print('  view centre (centre of screen is not on the Earth)');
    io.print(`  imagery     ${v.loading ? `${v.loading} tile(s) loading` : 'loaded'}${v.failed ? ` · ${v.failed} tile request(s) failed` : ''} · quality ${v.quality}`);
    const on = ctx.layers.list().filter((l) => l.on).map((l) => l.name);
    io.print(`  layers      ${on.length ? on.join(', ') : 'none'}`);
    const marks = ['quakes', 'incidents'].map((k) => [k, ctx.engine.markerCount(k)]).filter(([, n]) => n);
    if (marks.length) io.print(`  markers     ${marks.map(([k, n]) => `${k} ${n}`).join(', ')}`);
    if (ctx.mem.watch) io.print(`  watch       ${ctx.mem.watch.label} every ${ctx.mem.watch.everyS}s`);
  },
});

add('time', {
  aliases: ['utc', 'date'], summary: 'Current time (UTC and local)', usage: 'time',
  run(args, ctx, io) { const n = ctx.now(); io.print(`${new Date(n).toISOString().replace('T', ' ').slice(0, 19)} UTC   ${new Date(n).toString().slice(0, 33)}`); },
});

add('fly', {
  aliases: ['goto', 'loc'], summary: 'Fly to a place name or coordinates', usage: 'fly <place | lat, lon> [altitude_km]',
  examples: ['fly Kyiv', 'fly 35.05, -118.17 20', 'fly "Strait of Hormuz"'],
  async run(args, ctx, io) {
    if (!args.length) { io.print('usage: fly <place | lat, lon> [altitude_km]', 'warn'); return; }
    let alt = null;
    if (args.length > 1 && /^\d+(\.\d+)?$/.test(args[args.length - 1]) && !parseCoords(args.join(' '))) { alt = parseFloat(args.pop()) * 1000; }
    const text = args.join(' ');
    const c = parseCoords(text);
    if (c) { ctx.engine.flyToPlace(c.lat, c.lon, alt || 5000); io.print(`ACK  flying to ${latlon(c.lat, c.lon, 4)}`, 'ok'); return; }
    io.print(`resolving "${text}" …`, 'dim');
    let rows;
    try { rows = await ctx.geocode(text); } catch (e) { io.print(`ERROR  place search unreachable (${e.message || 'network error'}). Coordinates still work: fly 35.05, -118.17`, 'err'); return; }
    if (!rows.length) { io.print(`NO MATCH for "${text}"`, 'warn'); return; }
    const r = rows[0];
    const [s, n, w, e] = r.bbox || [r.lat, r.lat, r.lon, r.lon];
    const km = Math.hypot((n - s) * 111, (e - w) * 111 * Math.cos((r.lat * Math.PI) / 180));
    ctx.engine.flyToPlace(r.lat, r.lon, alt || Math.max(1800, km * 1000 * 1.25), km > 60 ? -60 : -40);
    io.print(`ACK  ${r.name}`, 'ok');
    io.print(`     ${latlon(r.lat, r.lon, 4)}${rows.length > 1 ? ` · ${rows.length - 1} other match(es): ${rows.slice(1, 4).map((x) => x.name.split(',')[0]).join('; ')}` : ''}`, 'dim');
  },
});

add('home', { summary: 'Return to the whole-Earth view', usage: 'home', run(a, ctx, io) { ctx.engine.home(); io.print('ACK  whole Earth', 'ok'); } });
add('tilt', { summary: 'Tilt to a 3D angle, or back top-down', usage: 'tilt [flat]', run(a, ctx, io) { const flat = /^(flat|off|down)$/i.test(a[0] || '') || (!a[0] && ctx.engine.view().pitch > -75); ctx.engine.tilt(flat); io.print(flat ? 'ACK  top-down' : 'ACK  tilted', 'ok'); } });
add('north', { summary: 'Rotate north-up', usage: 'north', run(a, ctx, io) { ctx.engine.northUp(); io.print('ACK  north up', 'ok'); } });

add('layers', {
  aliases: ['layer'], summary: 'List layers, or switch one on/off', usage: 'layers [name on|off]',
  examples: ['layers', 'layers fires on', 'layers clouds off', 'layers buildings on'],
  async run(args, ctx, io) {
    if (!args.length) {
      io.print(`${pad('LAYER', 12)} ${pad('STATE', 6)} NOTE`, 'head');
      ctx.layers.list().forEach((l) => io.print(`${pad(l.name, 12)} ${pad(l.on ? 'ON' : 'off', 6)} ${l.note || ''}`, l.on ? 'ok' : 'dim'));
      return;
    }
    const key = LAYER_ALIASES[args[0].toLowerCase()];
    if (!key) { io.print(`unknown layer "${args[0]}". Try: ${Object.keys(LAYER_ALIASES).join(', ')}`, 'warn'); return; }
    const want = args[1] ? onOff(args[1]) : !ctx.layers.list().find((l) => l.key === key)?.on;
    if (want === null) { io.print('say on or off', 'warn'); return; }
    const msg = await ctx.layers.set(key, want);
    io.print(msg || `ACK  ${key} ${want ? 'on' : 'off'}`, msg ? 'warn' : 'ok');
  },
});

add('quakes', {
  aliases: ['quake', 'eq'], summary: 'Earthquakes from USGS, plotted on the globe', usage: 'quakes [hour|day|week|month] [min_magnitude] | quakes off',
  examples: ['quakes', 'quakes week 4.5', 'quakes day 6', 'quakes off'],
  async run(args, ctx, io) {
    if (/^off$/i.test(args[0] || '')) { ctx.engine.setMarkers('quakes', null); io.print('ACK  earthquake markers cleared', 'ok'); return; }
    let window = 'day', minMag = 2.5;
    for (const a of args) { if (WINDOWS[a.toLowerCase()]) window = a.toLowerCase(); else if (!Number.isNaN(parseFloat(a))) minMag = parseFloat(a); else { io.print(`unknown argument "${a}"`, 'warn'); return; } }
    io.print(`querying USGS (${WINDOWS[window]}, M${minMag}+) …`, 'dim');
    const r = await ctx.feeds.fetchQuakes({ window, minMag });
    const now = ctx.now();
    ctx.mem.list = { kind: 'quake', items: r.items };
    ctx.engine.setMarkers('quakes', r.items, ctx.feeds.styleFor);
    if (!r.items.length) { io.print(`NO EVENTS  M${minMag}+ in the ${WINDOWS[window]}`, 'warn'); return; }
    io.print(`${r.items.length} EVENT(S)  M${minMag}+ · ${WINDOWS[window]} · USGS feed ${r.generated ? `generated ${utc(r.generated, false)}` : ''} · fetched ${utc(r.fetched, false)}`, 'head');
    quakeTable(r.items, now, io);
    const big = r.items.filter((q) => q.mag >= 6);
    if (big.length) io.print(`ALERT  ${big.length} event(s) at M6.0 or greater`, 'err');
    io.print('go <n> flies to an event · quakes off clears the markers', 'dim');
  },
});

add('fires', {
  aliases: ['fire'], summary: 'Wildfire incidents (NASA EONET) + satellite thermal detections', usage: 'fires [days] | fires off',
  examples: ['fires', 'fires 7', 'fires off'],
  async run(args, ctx, io) {
    if (/^off$/i.test(args[0] || '')) { ctx.engine.setMarkers('incidents', null); await ctx.layers.set('fires', false); io.print('ACK  fire markers and thermal layer off', 'ok'); return; }
    const days = parseInt(args[0], 10) > 0 ? Math.min(parseInt(args[0], 10), 365) : 30;
    io.print(`querying NASA EONET (open wildfire events, last ${days} d) …`, 'dim');
    // The raster layer (raw satellite detections) loads alongside the incident markers.
    const raster = ctx.layers.set('fires', true);
    const r = await ctx.feeds.fetchEvents({ category: 'wildfires', days });
    const now = ctx.now();
    ctx.mem.list = { kind: 'event', items: r.items };
    ctx.engine.setMarkers('incidents', r.items, ctx.feeds.styleFor);
    if (!r.items.length) io.print(`NO OPEN WILDFIRE EVENTS reported by EONET in the last ${days} d`, 'warn');
    else { io.print(`${r.items.length} OPEN WILDFIRE EVENT(S) · NASA EONET · fetched ${utc(r.fetched, false)}`, 'head'); eventTable(r.items, now, io); }
    const msg = await raster;
    io.print(msg ? `thermal layer: ${msg}` : 'thermal layer: NASA GIBS detections on (each is a pixel or two: zoom in to a region)', msg ? 'warn' : 'dim');
    io.print('EONET lists notable incidents, not every fire. A thermal detection is a hot pixel, not a confirmed fire.', 'dim');
  },
});

add('events', {
  aliases: ['event', 'eonet'], summary: 'Open natural events (storms, volcanoes, floods…) from NASA EONET', usage: 'events [category|all] [days] | events off',
  examples: ['events', 'events volcanoes', 'events severeStorms 14', `categories: ${Object.keys(EVENT_CATEGORIES).join(', ')}`],
  async run(args, ctx, io) {
    if (/^off$/i.test(args[0] || '')) { ctx.engine.setMarkers('incidents', null); io.print('ACK  event markers cleared', 'ok'); return; }
    let category = 'all', days = 30;
    for (const a of args) { if (/^\d+$/.test(a)) days = Math.min(+a, 365); else category = Object.keys(EVENT_CATEGORIES).find((k) => k.toLowerCase() === a.toLowerCase()) || a; }
    io.print(`querying NASA EONET (${category}, last ${days} d) …`, 'dim');
    const r = await ctx.feeds.fetchEvents({ category, days });
    ctx.mem.list = { kind: 'event', items: r.items };
    ctx.engine.setMarkers('incidents', r.items, ctx.feeds.styleFor);
    if (!r.items.length) { io.print(`NO OPEN EVENTS for "${category}" in the last ${days} d`, 'warn'); return; }
    io.print(`${r.items.length} OPEN EVENT(S) · NASA EONET · fetched ${utc(r.fetched, false)}`, 'head');
    eventTable(r.items, ctx.now(), io);
    io.print('go <n> flies to an event', 'dim');
  },
});

add('go', {
  aliases: ['open'], summary: 'Fly to item N from the last quakes / fires / events list', usage: 'go <n>',
  run(args, ctx, io) {
    const list = ctx.mem.list;
    if (!list?.items?.length) { io.print('nothing to go to: run quakes, fires or events first', 'warn'); return; }
    const n = parseInt(args[0], 10), it = list.items[n - 1];
    if (!it) { io.print(`pick a number from 1 to ${Math.min(list.items.length, 99)}`, 'warn'); return; }
    ctx.engine.flyToPlace(it.lat, it.lon, it.kind === 'quake' ? 350000 : 45000, it.kind === 'quake' ? -60 : -48);
    ctx.select(it);
    io.print(`ACK  ${it.title} · ${latlon(it.lat, it.lon)}`, 'ok');
    if (it.url) io.print(`     source: ${it.url}`, 'dim');
  },
});

add('sun', {
  summary: 'Sub-solar point and sun angle at the view centre', usage: 'sun',
  run(args, ctx, io) {
    const v = ctx.engine.view();
    io.print(`sub-solar point  ${latlon(v.sun.lat, v.sun.lon)}   (the sun is directly overhead here, now)`);
    if (v.centre) { const el = solarElevation(v.centre.lat, v.centre.lon, v.sun); io.print(`at view centre   ${latlon(v.centre.lat, v.centre.lon)}: sun ${el.toFixed(1)}° above the horizon · ${twilight(el)}`); }
  },
});

add('imagery', {
  aliases: ['meta'], summary: 'Capture date and resolution of the imagery at the view centre', usage: 'imagery',
  async run(args, ctx, io) {
    const c = ctx.engine.view().centre;
    if (!c) { io.print('view centre is not on the Earth', 'warn'); return; }
    io.print(`asking Esri about ${latlon(c.lat, c.lon)} …`, 'dim');
    const m = await ctx.imagery(c.lat, c.lon);
    if (!m) io.print('no capture metadata for this location (the basemap is a mosaic; many areas do not report a date)', 'warn');
    else io.print(`captured ${m.date || 'date not reported'}${m.res ? ` · ${m.res} m resolution` : ''}${m.source ? ` · ${m.source}` : ''}`, 'ok');
  },
});

add('mark', {
  summary: 'Save the current view centre as a named bookmark (kept in this browser)', usage: 'mark <name>',
  run(args, ctx, io) {
    const name = args.join(' ').trim(), c = ctx.engine.view().centre;
    if (!name) { io.print('usage: mark <name>', 'warn'); return; }
    if (!c) { io.print('view centre is not on the Earth', 'warn'); return; }
    ctx.mem.marks[name.toLowerCase()] = { name, ...c, height: ctx.engine.view().height };
    ctx.saveMarks?.(ctx.mem.marks);
    io.print(`ACK  saved "${name}" at ${latlon(c.lat, c.lon)}`, 'ok');
  },
});
add('marks', {
  aliases: ['bookmarks'], summary: 'List bookmarks, or fly to one', usage: 'marks [name]',
  run(args, ctx, io) {
    const all = Object.values(ctx.mem.marks);
    if (args.length) {
      const m = ctx.mem.marks[args.join(' ').toLowerCase()];
      if (!m) { io.print(`no bookmark "${args.join(' ')}"`, 'warn'); return; }
      ctx.engine.flyToPlace(m.lat, m.lon, Math.max(1500, (m.height || 20000) * 0.8)); io.print(`ACK  ${m.name}`, 'ok'); return;
    }
    if (!all.length) { io.print('no bookmarks yet: use mark <name>', 'dim'); return; }
    all.forEach((m) => io.print(`${pad(m.name, 24)} ${latlon(m.lat, m.lon)}`));
  },
});

add('check', {
  aliases: ['diag', 'selftest'], summary: 'Test every data source from this browser', usage: 'check [deep]',
  async run(args, ctx, io) {
    io.print('testing connections …', 'dim');
    const rows = await ctx.checks(/deep|all/i.test(args[0] || ''));
    rows.forEach((r) => io.print(`${pad(r.state === 'ok' ? 'OK' : r.state === 'warn' ? 'WARN' : 'FAIL', 5)} ${pad(r.label, 34)} ${r.detail}${r.ms != null ? ` · ${r.ms} ms` : ''}`, r.state === 'ok' ? 'ok' : r.state === 'warn' ? 'warn' : 'err'));
    const bad = rows.filter((r) => r.state === 'fail').length;
    io.print(bad ? `${bad} source(s) unreachable from this browser` : 'all tested sources answered', bad ? 'err' : 'ok');
  },
});

add('brief', {
  summary: 'One-screen situation summary from live public feeds', usage: 'brief',
  async run(args, ctx, io) {
    const now = ctx.now();
    io.print(`SITUATION BRIEF · ${utc(now)} · open sources only`, 'head');
    const [q, f] = await Promise.allSettled([ctx.feeds.fetchQuakes({ window: 'day', minMag: 4.5 }), ctx.feeds.fetchEvents({ category: 'all', days: 7 })]);
    if (q.status === 'fulfilled') {
      const items = q.value.items;
      io.print(`SEISMIC   ${items.length} event(s) M4.5+ in the past 24 h`, items.some((x) => x.mag >= 6) ? 'err' : '');
      items.slice(0, 5).forEach((x) => io.print(`          M${x.mag.toFixed(1)}  ${age(x.time, now)} ago  ${x.title}`, x.mag >= 6 ? 'err' : x.mag >= 5 ? 'warn' : ''));
      ctx.engine.setMarkers('quakes', items, ctx.feeds.styleFor);
    } else io.print(`SEISMIC   unavailable: ${q.reason.message}`, 'warn');
    if (f.status === 'fulfilled') {
      const by = {}; f.value.items.forEach((e) => { by[e.category] = (by[e.category] || 0) + 1; });
      const parts = Object.entries(by).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`);
      io.print(`EVENTS    ${f.value.items.length} open natural event(s), last 7 d${parts.length ? `: ${parts.join(' · ')}` : ''}`);
      ctx.mem.list = { kind: 'event', items: f.value.items };
      ctx.engine.setMarkers('incidents', f.value.items, ctx.feeds.styleFor);
    } else io.print(`EVENTS    unavailable: ${f.reason.message}`, 'warn');
    io.print('sources: USGS, NASA EONET · detail: quakes, events, fires', 'dim');
  },
});

add('watch', {
  summary: 'Poll earthquakes every 2 minutes and report new events', usage: 'watch quakes [min_magnitude] | watch off',
  async run(args, ctx, io) {
    if (/^off$/i.test(args[0] || '')) { ctx.mem.watch?.stop(); ctx.mem.watch = null; io.print('ACK  watch stopped', 'ok'); return; }
    if (!/^quakes?$/i.test(args[0] || '')) { io.print('usage: watch quakes [min_magnitude] | watch off', 'warn'); return; }
    const minMag = parseFloat(args[1]) || 4.5;
    ctx.mem.watch?.stop();
    const seen = new Set();
    let first = true;
    const tick = async () => {
      try {
        const r = await ctx.feeds.fetchQuakes({ window: 'hour', minMag });
        const fresh = r.items.filter((x) => !seen.has(x.id)); r.items.forEach((x) => seen.add(x.id));
        if (!first) fresh.forEach((x) => ctx.emit?.(`NEW  M${x.mag.toFixed(1)}  ${utc(x.time, false)}  ${x.title}`, x.mag >= 6 ? 'err' : 'warn'));
        first = false;
      } catch (e) { ctx.emit?.(`watch: ${e.message}`, 'warn'); }
    };
    await tick();
    const everyS = 120, id = setInterval(tick, everyS * 1000);
    ctx.mem.watch = { label: `quakes M${minMag}+`, everyS, stop: () => clearInterval(id) };
    io.print(`ACK  watching earthquakes M${minMag}+ (past-hour feed, every ${everyS} s). New events print here. watch off to stop.`, 'ok');
  },
});

add('about', {
  aliases: ['sources', 'license'], summary: 'Data sources, limits and what this is not', usage: 'about',
  run(args, ctx, io) {
    io.print('VARN OPEN-SOURCE INTELLIGENCE TERMINAL', 'head');
    io.print('UNCLASSIFIED // PUBLIC DATA ONLY. Not affiliated with any government agency.');
    io.print('');
    [['Imagery', 'Esri World Imagery (a periodic mosaic; capture dates vary by place), NASA Blue Marble'],
      ['Terrain', 'AWS Terrain Tiles (open elevation data)'],
      ['Earth observation', 'NASA GIBS: clouds, precipitation (IMERG), thermal anomalies, NDVI, night lights'],
      ['Earthquakes', 'USGS Earthquake Hazards Program, as published'],
      ['Natural events', 'NASA EONET, as published (notable events, not exhaustive)'],
      ['Places', 'OpenStreetMap Nominatim']].forEach(([k, v]) => io.print(`  ${pad(k, 18)}${v}`));
    io.print('');
    io.print('Everything here is public, may be delayed or incomplete, and is not for safety-of-life decisions.', 'dim');
    io.print('Nothing is simulated: if a source is down you get its error, not made-up data.', 'dim');
  },
});

add('clear', { aliases: ['cls'], summary: 'Clear the screen', usage: 'clear', run(a, ctx, io) { io.clear(); } });
add('history', { summary: 'Show previous commands', usage: 'history', run(a, ctx, io) { (ctx.mem.history || []).slice(-30).forEach((h, i) => io.print(`${pad(i + 1, 3)} ${h}`, 'dim')); } });

/* ── execution and completion ───────────────────────────── */
export async function execute(line, ctx, io) {
  const argv = parseLine(line);
  if (!argv.length) return;
  const cmd = COMMANDS[argv[0].toLowerCase()];
  if (!cmd) {
    const typed = argv[0].toLowerCase(), near = [...new Set(Object.values(COMMANDS).map((c) => c.name))].filter((n) => n.startsWith(typed.slice(0, 2)) || typed.startsWith(n.slice(0, 3))).slice(0, 4);
    io.print(`unknown command: ${argv[0]}${near.length ? ` · did you mean ${near.join(', ')}?` : ''} · help lists commands`, 'err');
    return;
  }
  try { await cmd.run(argv.slice(1), ctx, io); }
  catch (e) { if (e?.name !== 'AbortError') io.print(`ERROR  ${e?.message || e}`, 'err'); }
}

export function complete(line) {
  const m = line.match(/^(\S*)(\s+)?(.*)$/);
  const head = m[1].toLowerCase();
  if (!m[2]) {
    const names = [...new Set(Object.values(COMMANDS).map((c) => c.name))].filter((n) => n.startsWith(head)).sort();
    return { prefix: '', options: names, replace: (o) => o };
  }
  const arg = m[3].toLowerCase();
  const pools = { layers: Object.keys(LAYER_ALIASES), layer: Object.keys(LAYER_ALIASES), quakes: Object.keys(WINDOWS), events: [...Object.keys(EVENT_CATEGORIES), 'all', 'off'], help: Object.keys(COMMANDS), watch: ['quakes', 'off'], tilt: ['flat'], check: ['deep'] };
  const pool = pools[head] || [];
  const last = arg.split(/\s+/).pop();
  const options = pool.filter((o) => o.toLowerCase().startsWith(last)).sort();
  const base = line.slice(0, line.length - last.length);
  return { prefix: base, options, replace: (o) => base + o };
}
