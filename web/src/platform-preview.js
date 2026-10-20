// The dashboard preview on the home page. Everything it draws is SIMULATED
// sample data from demo-data.js, the same generator the full demo uses, so the
// two always agree. Nothing here was detected by a camera. The Analytics tab
// is static HTML from the build and shows the measured results, kept apart.
import { confidenceBins, filterEvents, hourlyBuckets, makeEvents, sortEvents, summarize } from './demo-data.js';
import { adsbText, classPill, esc, hourlyChart, meter, plural, when, wireTip } from './demo-ui.js';
import './demo.css';
import './preview.css';

const $ = (sel, root) => root.querySelector(sel);
const $$ = (sel, root) => [...root.querySelectorAll(sel)];

function fillOverview(root, events) {
  const recent = filterEvents(events, { hours: 24 }, Date.now());
  const s = summarize(recent);
  const tile = (label, value, note, cls = '') =>
    `<div class="pv-kpi ${cls}"><p class="mono pv-kpi-k">${esc(label)}</p><p class="pv-kpi-v">${value}</p><p class="pv-kpi-n">${esc(note)}</p></div>`;
  $('[data-pv="kpis"]', root).innerHTML =
    tile('Events', s.total, 'simulated, 24 hours') +
    tile('Aircraft', s.aircraft, 'model label', 'pv-kpi--aircraft') +
    tile('Possible drones', s.drone, 'model label', 'pv-kpi--drone') +
    tile('No ADS-B match', s.noAdsb, 'simulated');

  const buckets = hourlyBuckets(events, Date.now(), 24);
  const total = buckets.reduce((n, b) => n + b.aircraft + b.drone, 0);
  const host = $('[data-pv="hourly"]', root);
  host.innerHTML = hourlyChart(buckets, {
    label: `Simulated events per hour over the last 24 hours, ${total} in all. The full demo has the same numbers as a table.`,
  });
  wireTip(host, buckets);

  $('[data-pv="latest"]', root).innerHTML = sortEvents(recent, 'time', 'desc')
    .slice(0, 5)
    .map(
      (e) => `<li class="pv-row">${classPill(e.cls)}<span class="mono pv-row-time">${when(e.time)}</span><span class="mono pv-row-conf">${e.confidence.toFixed(2)}</span></li>`
    )
    .join('');
}

function fillBins(root, events) {
  const bins = confidenceBins(filterEvents(events, { hours: 24 }, Date.now()), 5);
  const max = Math.max(1, ...bins.flatMap((b) => [b.aircraft, b.drone]));
  const label = (b) => `${b.from.toFixed(1)}–${b.to.toFixed(1)}`;
  $('[data-pv="bins"]', root).innerHTML = `<div class="db" role="img" aria-label="Simulated confidence of events, in five bands. ${esc(
    bins.map((b) => `${label(b)}: ${b.aircraft} aircraft, ${b.drone} possible drones`).join('; ')
  )}.">${bins
    .map(
      (b) => `<div class="db-group"><div class="db-bars"><i class="dc-seg dc-seg--aircraft" style="--h:${(b.aircraft / max) * 100}" data-n="${b.aircraft}"></i><i class="dc-seg dc-seg--drone" style="--h:${(b.drone / max) * 100}" data-n="${b.drone}"></i></div><span class="mono db-x">${label(b)}</span></div>`
    )
    .join('')}</div>`;
}

function fillEvents(root, events) {
  const rows = sortEvents(events, 'time', 'desc')
    .slice(0, 7)
    .map(
      (e) => `<tr>
        <th scope="row" class="mono">${esc(e.id)}</th>
        <td class="mono">${when(e.time)}</td>
        <td>${classPill(e.cls)}</td>
        <td class="is-num"><span class="mono">${e.confidence.toFixed(2)}</span>${meter(e.confidence)}</td>
        <td>${adsbText(e.adsb)}</td>
      </tr>`
    )
    .join('');
  $('[data-pv="events"]', root).innerHTML = `<table class="demo-table pv-events"><caption class="sr-only">Seven of ${plural(events.length, 'simulated event', 'simulated events')}, newest first</caption><thead><tr><th scope="col">ID</th><th scope="col">Time</th><th scope="col">Class</th><th scope="col" class="is-num">Confidence</th><th scope="col">ADS-B (sim.)</th></tr></thead><tbody>${rows}</tbody></table>`;
}

// Tabs: the links to the full demo become a real tablist once the preview is
// alive. Arrow keys, Home and End move between tabs; the panel changes with a
// short fade. Clicking never changes the address or stacks listeners.
function wireTabs(root) {
  const list = $('.pv-tabs', root);
  const tabs = $$('.pv-tab', list);
  const panels = new Map($$('[data-pv-panel]', root).map((p) => [p.dataset.pvPanel, p]));
  list.setAttribute('role', 'tablist');
  $$('li', list).forEach((li) => li.setAttribute('role', 'presentation'));
  tabs.forEach((tab) => {
    const id = tab.dataset.pvTab;
    const panel = panels.get(id);
    tab.id = `pv-tab-${id}`;
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-controls', panel.id);
    panel.setAttribute('role', 'tabpanel');
    panel.setAttribute('aria-labelledby', tab.id);
    panel.removeAttribute('aria-label');
    panel.tabIndex = 0;
  });

  const select = (id, { focus = false } = {}) => {
    tabs.forEach((tab) => {
      const on = tab.dataset.pvTab === id;
      tab.setAttribute('aria-selected', String(on));
      tab.tabIndex = on ? 0 : -1;
      tab.removeAttribute('aria-current');
      if (on && focus) tab.focus();
    });
    panels.forEach((panel, key) => {
      const on = key === id;
      if (on && panel.hidden) {
        panel.hidden = false;
        panel.classList.remove('is-in');
        void panel.offsetWidth; // restart the fade
        panel.classList.add('is-in');
      } else if (!on) {
        panel.hidden = true;
        panel.classList.remove('is-in');
      }
    });
  };

  list.addEventListener('click', (e) => {
    const tab = e.target.closest('.pv-tab');
    if (!tab || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    select(tab.dataset.pvTab);
  });
  list.addEventListener('keydown', (e) => {
    const i = tabs.indexOf(document.activeElement);
    if (i < 0) return;
    const to = { ArrowRight: (i + 1) % tabs.length, ArrowLeft: (i - 1 + tabs.length) % tabs.length, Home: 0, End: tabs.length - 1 }[e.key];
    if (to === undefined) return;
    e.preventDefault();
    select(tabs[to].dataset.pvTab, { focus: true });
  });
  select('overview');
}

export function createPreview(root) {
  if (!root || root.dataset.ready) return; // one preview, one set of listeners
  root.dataset.ready = 'true';
  const events = makeEvents(Date.now());
  fillOverview(root, events);
  fillEvents(root, events);
  fillBins(root, events);
  wireTabs(root);
  $('[data-pv="loading"]', root)?.remove();
  root.classList.add('is-live');
}
