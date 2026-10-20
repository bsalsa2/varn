// Dashboard demo (demo.html). Everything this file draws is SIMULATED sample
// data from demo-data.js: nothing here was detected by a camera. The measured
// results, the system status and the definitions are static HTML from the
// build (render.js), not drawn here.
import { initNavMenu } from './nav-menu.js';
import { initMotion } from './motion.js';
import { afterLoad, initGfx } from './gfx.js';
import { initReveal } from './reveal.js';
import {
  ADSB,
  CLASSES,
  clock,
  confidenceBins,
  filterEvents,
  hourlyBuckets,
  makeEvents,
  nextEvent,
  sortEvents,
  summarize,
  toCsv,
} from './demo-data.js';
import './demo.css';

initMotion();
initReveal();
afterLoad(initGfx);
initNavMenu();

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const slot = (name) => $(`[data-slot="${name}"]`);

const PAGE = 15; // rows per "Show more"
const VIEWS = $$('.demo-view').map((v) => v.dataset.view);
const now0 = Date.now();
let events = makeEvents(now0);
let replayCount = 0;

const state = {
  view: 'overview',
  q: '',
  cls: 'all',
  adsb: 'all',
  hours: '24',
  sort: { key: 'time', dir: 'desc' },
  shown: PAGE,
  open: null, // id of the event in the drawer
};

// ---- Small pieces ---------------------------------------------------------
const clsShape = (cls) => `<span class="shape shape--${cls === 'drone' ? 'drone' : 'aircraft'}" aria-hidden="true"></span>`;
const adsbShape = (adsb) => (adsb === 'none' ? '<span class="shape shape--no-adsb" aria-hidden="true"></span>' : '');
const classPill = (cls) =>
  `<span class="status-pill status-pill--${cls === 'drone' ? 'drone' : 'aircraft'} mono">${clsShape(cls)}${esc(CLASSES[cls])}</span>`;
const adsbText = (adsb) => `<span class="demo-adsb">${adsbShape(adsb)}${esc(ADSB[adsb])}</span>`;
const dayWord = (t) => {
  const d = new Date(t);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return 'today';
  const y = new Date(today);
  y.setDate(y.getDate() - 1);
  return d.toDateString() === y.toDateString() ? 'yesterday' : d.toLocaleDateString();
};
const when = (t) => `${clock(t)} <span class="demo-day">${esc(dayWord(t))}</span>`;
const meter = (v) => `<span class="demo-meter" aria-hidden="true"><i style="--v:${Math.round(v * 100)}"></i></span>`;
const hourLabel = (t) => `${String(new Date(t).getHours()).padStart(2, '0')}:00`;
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

// ---- Overview ---------------------------------------------------------------
function visible24() {
  return filterEvents(events, { hours: 24 }, Date.now());
}

function renderKpis() {
  const s = summarize(visible24());
  const tile = (label, value, note, cls = '') =>
    `<div class="demo-kpi ${cls}"><p class="mono demo-kpi-k">${esc(label)}</p><p class="demo-kpi-v">${value}</p><p class="demo-kpi-n">${esc(note)}</p></div>`;
  slot('kpis').innerHTML =
    tile('Events', s.total, 'simulated, last 24 hours') +
    tile('Aircraft', s.aircraft, 'model label: aircraft', 'demo-kpi--aircraft') +
    tile('Possible drones', s.drone, 'model label: drone', 'demo-kpi--drone') +
    tile('No ADS-B match', s.noAdsb, 'drones and some aircraft');
}

function hourlyChart(buckets, { label, showAxis = true } = {}) {
  const max = Math.max(1, ...buckets.map((b) => b.aircraft + b.drone));
  const top = Math.max(4, Math.ceil(max / 2) * 2);
  const cols = buckets
    .map((b, i) => {
      const total = b.aircraft + b.drone;
      const seg = (n, cls) => (n ? `<i class="dc-seg dc-seg--${cls}" style="--h:${((n / top) * 100).toFixed(2)}"></i>` : '');
      return `<div class="dc-col" data-i="${i}">${total ? `<div class="dc-stack">${seg(b.drone, 'drone')}${seg(b.aircraft, 'aircraft')}</div>` : ''}</div>`;
    })
    .join('');
  const ticks = [0, top / 2, top].map((v) => `<span style="--y:${(v / top) * 100}">${v}</span>`).join('');
  const last = buckets.length - 1;
  const xs = buckets
    .map((b, i) => (i % 6 === 0 || i === last ? `<span style="--x:${i}">${i === last ? 'now' : hourLabel(b.start)}</span>` : ''))
    .join('');
  return `<div class="dc" role="img" aria-label="${esc(label)}">
      <div class="dc-y mono" aria-hidden="true">${ticks}</div>
      <div class="dc-plot" style="--n:${buckets.length}" aria-hidden="true">${cols}</div>
      ${showAxis ? `<div class="dc-x mono" style="--n:${buckets.length}" aria-hidden="true">${xs}</div>` : ''}
      <div class="dc-tip mono" hidden></div>
    </div>`;
}

function wireTip(root, buckets) {
  const plot = $('.dc-plot', root);
  const tip = $('.dc-tip', root);
  if (!plot || !tip) return;
  const show = (col) => {
    const b = buckets[Number(col.dataset.i)];
    tip.innerHTML = `<b>${esc(hourLabel(b.start))}</b><br>${plural(b.aircraft, 'aircraft', 'aircraft')} · ${plural(b.drone, 'possible drone', 'possible drones')}`;
    tip.hidden = false;
    const c = col.getBoundingClientRect();
    const r = root.getBoundingClientRect();
    tip.style.left = `${Math.min(Math.max(c.left - r.left + c.width / 2, 70), r.width - 70)}px`;
  };
  plot.addEventListener('pointerover', (e) => {
    const col = e.target.closest('.dc-col');
    if (col) show(col);
  });
  plot.addEventListener('pointerleave', () => (tip.hidden = true));
}

function renderHourly() {
  const buckets = hourlyBuckets(events, Date.now(), 24);
  const total = buckets.reduce((n, b) => n + b.aircraft + b.drone, 0);
  const host = slot('hourly');
  host.innerHTML = hourlyChart(buckets, { label: `Simulated events per hour over the last 24 hours, ${total} in all. The same numbers are in the table below.` });
  wireTip(host, buckets);
  slot('hourly-table').innerHTML = `<table class="demo-table"><thead><tr><th scope="col">Hour</th><th scope="col">Aircraft</th><th scope="col">Possible drones</th></tr></thead><tbody>${[...buckets]
    .reverse()
    .map((b) => `<tr><th scope="row">${esc(hourLabel(b.start))}</th><td class="mono">${b.aircraft}</td><td class="mono">${b.drone}</td></tr>`)
    .join('')}</tbody></table>`;
}

function renderLatest() {
  const top = sortEvents(visible24(), 'time', 'desc').slice(0, 6);
  slot('latest').innerHTML = top
    .map(
      (e) => `<li><button type="button" class="demo-row demo-row--${e.cls}" data-open="${esc(e.id)}">
        <span class="demo-row-main">${classPill(e.cls)}<span class="mono demo-row-time">${when(e.time)} · ${e.duration}s</span></span>
        <span class="demo-row-conf"><span class="mono">${e.confidence.toFixed(2)}</span>${meter(e.confidence)}</span>
      </button></li>`
    )
    .join('');
}

// ---- Events ---------------------------------------------------------------
const COLUMNS = [
  { key: 'id', label: 'ID' },
  { key: 'time', label: 'Time' },
  { key: 'cls', label: 'Class' },
  { key: 'confidence', label: 'Confidence', num: true },
  { key: 'duration', label: 'Duration', num: true },
  { key: 'adsb', label: 'ADS-B (sim.)' },
];

function filtered() {
  return sortEvents(filterEvents(events, state, Date.now()), state.sort.key, state.sort.dir);
}

function renderEvents() {
  const all = filtered();
  const shown = all.slice(0, state.shown);
  const head = COLUMNS.map((c) => {
    const on = state.sort.key === c.key;
    const aria = on ? (state.sort.dir === 'asc' ? 'ascending' : 'descending') : 'none';
    return `<th scope="col" aria-sort="${aria}" class="${c.num ? 'is-num' : ''}"><button type="button" class="demo-sort mono" data-sort="${c.key}">${esc(c.label)}<span class="demo-sort-mark" aria-hidden="true">${on ? (state.sort.dir === 'asc' ? '▲' : '▼') : ''}</span></button></th>`;
  }).join('');
  const body = shown
    .map(
      (e) => `<tr data-id="${esc(e.id)}">
        <th scope="row"><button type="button" class="demo-id mono" data-open="${esc(e.id)}">${esc(e.id)}</button></th>
        <td class="mono">${when(e.time)}</td>
        <td>${classPill(e.cls)}</td>
        <td class="is-num"><span class="mono">${e.confidence.toFixed(2)}</span>${meter(e.confidence)}</td>
        <td class="is-num mono">${e.duration}s</td>
        <td>${adsbText(e.adsb)}</td>
      </tr>`
    )
    .join('');
  slot('events').innerHTML = all.length
    ? `<table class="demo-table demo-table--events"><caption class="sr-only">Simulated events, ${all.length} matching</caption><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`
    : `<div class="demo-empty"><p><b>No events match.</b></p><p>Try a different search or a wider time range.</p><button type="button" class="demo-btn" data-reset>Clear filters</button></div>`;
  $('#events-count').textContent = all.length
    ? `Showing ${shown.length} of ${all.length} simulated events`
    : 'Showing 0 simulated events';
  $('#more').hidden = shown.length >= all.length;
  $('#export').disabled = !all.length;
  $('#export').textContent = all.length ? `Export ${all.length} as CSV` : 'Export CSV';
  $('#export-note').hidden = true; // the note described the previous filter
}

function resetFilters() {
  Object.assign(state, { q: '', cls: 'all', adsb: 'all', hours: '24', shown: PAGE });
  $('#f-q').value = '';
  $('#f-cls').value = 'all';
  $('#f-adsb').value = 'all';
  $('#f-hours').value = '24';
  renderEvents();
}

function download(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ---- Analytics ---------------------------------------------------------------
function renderBins() {
  const bins = confidenceBins(visible24(), 5);
  const max = Math.max(1, ...bins.flatMap((b) => [b.aircraft, b.drone]));
  const label = (b) => `${b.from.toFixed(1)}–${b.to.toFixed(1)}`;
  slot('bins').innerHTML = `<div class="db" role="img" aria-label="Simulated confidence of events, in five bands. ${esc(
    bins.map((b) => `${label(b)}: ${b.aircraft} aircraft, ${b.drone} possible drones`).join('; ')
  )}.">${bins
    .map(
      (b) => `<div class="db-group"><div class="db-bars">
        <i class="dc-seg dc-seg--aircraft" style="--h:${(b.aircraft / max) * 100}" data-n="${b.aircraft}"></i>
        <i class="dc-seg dc-seg--drone" style="--h:${(b.drone / max) * 100}" data-n="${b.drone}"></i></div>
        <span class="mono db-x">${label(b)}</span></div>`
    )
    .join('')}</div>`;
}

// ---- Detail drawer -------------------------------------------------------------
const drawer = $('#drawer');
let returnFocus = null;

function renderDrawer() {
  const list = filtered();
  const i = list.findIndex((e) => e.id === state.open);
  const e = events.find((x) => x.id === state.open);
  if (!e) return;
  const field = (k, v) => `<div><dt class="mono">${esc(k)}</dt><dd>${v}</dd></div>`;
  slot('drawer').innerHTML = `
    <header class="demo-drawer-head">
      <div><p class="mono demo-badge">SIMULATED EVENT</p><h2 id="drawer-title">${esc(e.id)}</h2></div>
      <button type="button" class="demo-icon" data-close aria-label="Close details"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 3l10 10M13 3L3 13"/></svg></button>
    </header>
    <p class="demo-drawer-class">${classPill(e.cls)}</p>
    <dl class="demo-fields">
      ${field('Time', `${when(e.time)}`)}
      ${field('Model confidence', `<span class="mono">${e.confidence.toFixed(2)}</span> ${meter(e.confidence)}`)}
      ${field('Duration', `<span class="mono">${e.duration} s</span>`)}
      ${field('Flight data (ADS-B, simulated)', adsbText(e.adsb))}
      ${field('Camera pointing', `<span class="mono">pan ${e.pan.toFixed(1)}°, tilt ${e.tilt.toFixed(1)}°</span>`)}
      ${field('Source', '<span class="mono">Simulated: generated in your browser</span>')}
    </dl>
    <p class="demo-drawer-note">This record is sample data generated in your browser. No camera saw this event, there is no snapshot, and the model never labeled it. The label and the ADS-B result are made up for the demo.</p>
    <footer class="demo-drawer-foot">
      <button type="button" class="demo-btn" data-step="-1" ${i <= 0 ? 'disabled' : ''}>&larr; Newer in list</button>
      <button type="button" class="demo-btn" data-step="1" ${i < 0 || i >= list.length - 1 ? 'disabled' : ''}>Older in list &rarr;</button>
    </footer>`;
}

function openEvent(id, from) {
  state.open = id;
  if (from) returnFocus = from;
  renderDrawer();
  if (!drawer.open) drawer.showModal();
  $('[data-close]', drawer)?.focus();
}
drawer.addEventListener('click', (e) => {
  if (e.target === drawer) drawer.close(); // the backdrop
  else if (e.target.closest('[data-close]')) drawer.close();
  else {
    const step = e.target.closest('[data-step]');
    if (!step) return;
    const list = filtered();
    const next = list[list.findIndex((x) => x.id === state.open) + Number(step.dataset.step)];
    if (next) {
      state.open = next.id;
      renderDrawer();
      $(`[data-step="${step.dataset.step}"]:not([disabled])`, drawer)?.focus() || $('[data-close]', drawer).focus();
    }
  }
});
drawer.addEventListener('close', () => {
  state.open = null;
  if (returnFocus && document.contains(returnFocus)) returnFocus.focus();
  returnFocus = null;
});

// ---- Views and routing -------------------------------------------------------
const TITLES = { overview: 'Overview', events: 'Events', analytics: 'Analytics', system: 'System' };

function show(view, { focus = false } = {}) {
  if (!VIEWS.includes(view)) view = 'overview';
  state.view = view;
  $$('.demo-view').forEach((v) => (v.hidden = v.dataset.view !== view));
  $$('.demo-tab').forEach((a) => {
    if (a.dataset.view === view) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  document.title = `${TITLES[view]} · Dashboard demo | Varn`;
  if (view !== 'overview' && replayTimer) stopReplay(); // nothing keeps running out of sight
  if (focus) $(`#h-${view}`)?.focus({ preventScroll: false });
}

function route(focus) {
  const view = location.hash.slice(1);
  show(VIEWS.includes(view) ? view : 'overview', { focus });
}
addEventListener('hashchange', () => route(true));

// ---- Replay: new simulated events arrive one by one -----------------------------
let replayTimer = 0;
function stopReplay() {
  clearInterval(replayTimer);
  replayTimer = 0;
  const b = $('#replay');
  b.classList.remove('is-on');
  b.textContent = 'Replay simulated feed';
}
function startReplay() {
  if (replayTimer) return; // never two timers
  const b = $('#replay');
  b.classList.add('is-on');
  b.textContent = 'Stop replay';
  let sent = 0;
  replayTimer = setInterval(() => {
    const n = events.length + 1;
    const e = nextEvent(Date.now(), n, 7 + replayCount++);
    events.unshift(e);
    renderAll();
    $('#live').textContent = `New simulated event ${e.id}: ${CLASSES[e.cls]}`;
    if (++sent >= 8) stopReplay();
  }, 1600);
}

// ---- Wiring ---------------------------------------------------------------------
function renderAll() {
  renderKpis();
  renderHourly();
  renderLatest();
  renderEvents();
  renderBins();
}

document.addEventListener('click', (e) => {
  const open = e.target.closest('[data-open]');
  if (open) return openEvent(open.dataset.open, open);
  const sort = e.target.closest('[data-sort]');
  if (sort) {
    const key = sort.dataset.sort;
    state.sort = state.sort.key === key ? { key, dir: state.sort.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: key === 'time' || key === 'confidence' || key === 'duration' ? 'desc' : 'asc' };
    renderEvents();
    $(`[data-sort="${key}"]`)?.focus();
  }
  if (e.target.closest('[data-reset]')) resetFilters();
});
$('#more').addEventListener('click', () => {
  const before = state.shown;
  state.shown += PAGE;
  renderEvents();
  // Keep keyboard users at the first new row.
  $$('.demo-events-wrap tbody tr')[before]?.querySelector('button')?.focus();
});
$('#f-reset').addEventListener('click', resetFilters);
const onFilter = () => {
  state.q = $('#f-q').value;
  state.cls = $('#f-cls').value;
  state.adsb = $('#f-adsb').value;
  state.hours = $('#f-hours').value;
  state.shown = PAGE;
  renderEvents();
};
['#f-cls', '#f-adsb', '#f-hours'].forEach((s) => $(s).addEventListener('change', onFilter));
$('#f-q').addEventListener('input', onFilter);
$('#export').addEventListener('click', () => {
  const rows = filtered();
  const note = $('#export-note');
  try {
    if (!rows.length) throw new Error('empty');
    download('varn-simulated-events.csv', toCsv(rows), 'text/csv;charset=utf-8');
    note.textContent = `Exported ${plural(rows.length, 'simulated event', 'simulated events')} as varn-simulated-events.csv.`;
    note.className = 'mono demo-note is-ok';
  } catch {
    note.textContent = 'The export did not work in this browser. Nothing was saved.';
    note.className = 'mono demo-note is-bad';
  }
  note.hidden = false;
});
$('#replay').addEventListener('click', () => (replayTimer ? stopReplay() : startReplay()));
document.addEventListener('visibilitychange', () => document.hidden && replayTimer && stopReplay());
addEventListener('pagehide', () => stopReplay());

// Polite announcements for the replay.
const live = document.createElement('p');
live.id = 'live';
live.className = 'sr-only';
live.setAttribute('role', 'status');
live.setAttribute('aria-live', 'polite');
document.body.append(live);

try {
  renderAll();
  route(false);
  $('#demo-status').hidden = true;
} catch (err) {
  console.warn('[varn] demo failed to start', err);
  $('#demo-status').textContent = 'The demo could not start in this browser. The measured results and system status are still shown below.';
  $('#demo-status').classList.add('is-bad');
  $('#view-analytics').hidden = false;
}
