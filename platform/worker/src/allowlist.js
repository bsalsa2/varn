// The only commands the assistant may propose. VIEW-ONLY: they move the camera, switch a layer, list items or open a
// view. Nothing here writes, watches, saves, clears or runs checks. Shared by the Worker (validates what the model
// proposes) and the browser (validates again before anything runs). allowlist.test.js proves every verb below exists
// in the terminal and that the layer, window and category names match the app's own tables.
export const LAYERS = ['sat', 'satellite', 'terrain', 'labels', 'daynight', 'night', 'clouds', 'weather', 'rain', 'fires', 'thermal',
  'vegetation', 'ndvi', 'nightlights', 'lights', 'buildings', '3d'];
export const WINDOWS = ['hour', 'day', 'week', 'month'];
export const EVENT_CATS = ['wildfires', 'volcanoes', 'severeStorms', 'floods', 'landslides', 'seaLakeIce', 'drought', 'dustHaze',
  'tempExtremes', 'snow', 'waterColor', 'manmade', 'earthquakes', 'all'];
export const VIEWS = ['earth', 'sky', 'records'];
export const NO_ARG = ['home', 'tilt', 'north', 'brief', 'sun', 'imagery'];
export const TERMINAL_VERBS = ['fly', 'layers', 'quakes', 'fires', 'events', 'go', ...NO_ARG];

const PLACE = /^[\p{L}\p{N} .,'’-]{1,60}$/u;
const COORD = /^(-?\d{1,3}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)$/;
const BAD = /[\u0000-\u001f\u007f;|&$`<>{}\\]/;
const int = (s, lo, hi) => (/^\d{1,3}$/.test(s) && +s >= lo && +s <= hi ? +s : null);

/** -> { ok: true, command, kind: 'terminal' | 'view' } or { ok: false, reason }. `command` is the normalised line to run. */
export function validateCommand(raw) {
  if (typeof raw !== 'string') return { ok: false, reason: 'command must be text' };
  const line = raw.trim().replace(/\s+/g, ' ');
  if (!line || line.length > 80) return { ok: false, reason: 'empty or too long' };
  if (BAD.test(line)) return { ok: false, reason: 'characters not allowed' };
  const [verb, ...rest] = line.split(' ');
  const v = verb.toLowerCase();
  let arg = rest.join(' ');

  if (NO_ARG.includes(v)) return rest.length ? { ok: false, reason: `${v} takes no arguments` } : { ok: true, command: v, kind: 'terminal' };

  if (v === 'view') return VIEWS.includes(arg.toLowerCase()) ? { ok: true, command: `view ${arg.toLowerCase()}`, kind: 'view' } : { ok: false, reason: `view must be one of ${VIEWS.join(', ')}` };

  if (v === 'fly') {
    arg = arg.replace(/^"(.*)"$/, '$1');
    const c = COORD.exec(arg);
    if (c) return Math.abs(+c[1]) <= 90 && Math.abs(+c[2]) <= 180 ? { ok: true, command: `fly ${+c[1]}, ${+c[2]}`, kind: 'terminal' } : { ok: false, reason: 'coordinates out of range' };
    if (!PLACE.test(arg) || !/\p{L}/u.test(arg)) return { ok: false, reason: 'fly needs a place name or lat, lon' };
    return { ok: true, command: arg.includes(' ') ? `fly "${arg}"` : `fly ${arg}`, kind: 'terminal' };
  }

  if (v === 'layers') {
    if (!rest.length) return { ok: true, command: 'layers', kind: 'terminal' };
    const [name, state, extra] = rest;
    if (extra !== undefined || !LAYERS.includes(name.toLowerCase())) return { ok: false, reason: 'unknown layer' };
    if (!state || !/^(on|off)$/i.test(state)) return { ok: false, reason: 'say on or off' };
    return { ok: true, command: `layers ${name.toLowerCase()} ${state.toLowerCase()}`, kind: 'terminal' };
  }

  if (v === 'quakes') {
    if (rest.length > 2) return { ok: false, reason: 'too many arguments' };
    const out = ['quakes'];
    for (const a of rest) {
      if (WINDOWS.includes(a.toLowerCase())) out.push(a.toLowerCase());
      else if (/^\d(\.\d)?$/.test(a)) out.push(a);
      else return { ok: false, reason: `unexpected "${a}"` };
    }
    return { ok: true, command: out.join(' '), kind: 'terminal' };
  }

  if (v === 'fires') {
    if (!rest.length) return { ok: true, command: 'fires', kind: 'terminal' };
    const d = rest.length === 1 ? int(rest[0], 1, 30) : null;
    return d ? { ok: true, command: `fires ${d}`, kind: 'terminal' } : { ok: false, reason: 'fires takes days from 1 to 30' };
  }

  if (v === 'events') {
    if (rest.length > 2) return { ok: false, reason: 'too many arguments' };
    const out = ['events'];
    if (rest[0]) { const c = EVENT_CATS.find((x) => x.toLowerCase() === rest[0].toLowerCase()); if (!c) return { ok: false, reason: 'unknown event category' }; out.push(c); }
    if (rest[1]) { const d = int(rest[1], 1, 30); if (!d) return { ok: false, reason: 'days must be 1 to 30' }; out.push(d); }
    return { ok: true, command: out.join(' '), kind: 'terminal' };
  }

  if (v === 'go') {
    const n = rest.length === 1 ? int(rest[0], 1, 100) : null;
    return n ? { ok: true, command: `go ${n}`, kind: 'terminal' } : { ok: false, reason: 'go takes an item number' };
  }

  return { ok: false, reason: `"${verb}" is not an allowed command` };
}

/**
 * A short sequence of allowlisted commands the human runs with ONE click, in order (for example `quakes day` then `go 1`).
 * Every command is validated on its own; one bad command rejects the whole sequence. At most 3. A `view` switch must stand alone.
 * -> { ok: true, commands, kind } or { ok: false, reason }
 */
export function validateCommands(list) {
  if (!Array.isArray(list) || list.length < 1 || list.length > 3) return { ok: false, reason: 'give 1 to 3 commands' };
  const out = [];
  for (const raw of list) {
    const v = validateCommand(raw);
    if (!v.ok) return { ok: false, reason: `"${String(raw).slice(0, 40)}": ${v.reason}` };
    out.push(v);
  }
  if (out.some((v) => v.kind === 'view') && out.length > 1) return { ok: false, reason: 'a view switch must be on its own' };
  return { ok: true, commands: out.map((v) => v.command), kind: out[0].kind };
}
