// Tests for the dashboard demo's sample data (src/demo-data.js) and its page
// (render.js). Run with: npm test   (Node's built-in test runner; no network)
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { content } from '../src/content.js';
import {
  CLASSES,
  CSV_COLUMNS,
  SOURCE,
  confidenceBins,
  filterEvents,
  hourlyBuckets,
  makeEvents,
  nextEvent,
  sortEvents,
  summarize,
  toCsv,
} from '../src/demo-data.js';
import { renderDemoBody, renderDemoHead } from '../src/render.js';

const NOW = Date.UTC(2026, 9, 21, 15, 30, 0);
const events = makeEvents(NOW);

test('the same seed gives the same events, newest first', () => {
  assert.deepEqual(makeEvents(NOW), events);
  assert.equal(events.length, 96);
  for (let i = 1; i < events.length; i++) assert.ok(events[i - 1].time >= events[i].time);
  assert.equal(new Set(events.map((e) => e.id)).size, events.length);
});

test('every event is marked simulated and is within the last 24 hours', () => {
  for (const e of events) {
    assert.equal(e.source, SOURCE);
    assert.match(e.id, /^SIM-\d{4}$/);
    assert.ok(e.time <= NOW && e.time > NOW - 24 * 3600 * 1000);
    assert.ok(e.confidence > 0 && e.confidence < 1);
    assert.ok(e.cls in CLASSES);
  }
});

test('drones never match ADS-B, and the model is less sure about drones', () => {
  const drones = events.filter((e) => e.cls === 'drone');
  assert.ok(drones.length > 5);
  assert.ok(drones.every((e) => e.adsb === 'none'));
  const avg = (xs) => xs.reduce((n, e) => n + e.confidence, 0) / xs.length;
  assert.ok(avg(drones) < avg(events.filter((e) => e.cls === 'aircraft')));
});

test('filters combine: class, ADS-B, time range and text', () => {
  const only = filterEvents(events, { cls: 'drone' }, NOW);
  assert.ok(only.length && only.every((e) => e.cls === 'drone'));
  assert.equal(filterEvents(events, { cls: 'drone', adsb: 'match' }, NOW).length, 0);
  const hour = filterEvents(events, { hours: 1 }, NOW);
  assert.ok(hour.every((e) => e.time >= NOW - 3600 * 1000));
  assert.ok(hour.length < events.length);
  const one = events[10];
  assert.ok(filterEvents(events, { q: one.id.toLowerCase() }, NOW).some((e) => e.id === one.id));
  assert.equal(filterEvents(events, { q: 'no such thing' }, NOW).length, 0);
  assert.equal(filterEvents(events, { q: '  ' }, NOW).length, events.length);
});

test('sorting is stable, reversible and does not change the input', () => {
  const copy = [...events];
  const up = sortEvents(events, 'confidence', 'asc');
  const down = sortEvents(events, 'confidence', 'desc');
  assert.deepEqual(events, copy);
  for (let i = 1; i < up.length; i++) assert.ok(up[i - 1].confidence <= up[i].confidence);
  for (let i = 1; i < down.length; i++) assert.ok(down[i - 1].confidence >= down[i].confidence);
  assert.deepEqual(sortEvents(events, 'nonsense', 'desc'), sortEvents(events, 'time', 'desc'));
});

test('summary, hourly buckets and confidence bins add up', () => {
  const s = summarize(events);
  assert.equal(s.total, 96);
  assert.equal(s.aircraft + s.drone, 96);
  assert.equal(s.noAdsb, events.filter((e) => e.adsb === 'none').length);
  const buckets = hourlyBuckets(events, NOW, 24);
  assert.equal(buckets.length, 24);
  assert.equal(buckets.reduce((n, b) => n + b.aircraft + b.drone, 0), 96);
  for (let i = 1; i < buckets.length; i++) assert.equal(buckets[i].start - buckets[i - 1].start, 3600 * 1000);
  const bins = confidenceBins(events, 5);
  assert.equal(bins.reduce((n, b) => n + b.aircraft + b.drone, 0), 96);
});

test('CSV has a header, one row per event, and neutralises formulas', () => {
  const csv = toCsv(events.slice(0, 3));
  const lines = csv.trim().split('\n');
  assert.equal(lines[0], CSV_COLUMNS.join(','));
  assert.equal(lines.length, 4);
  assert.match(lines[1], /^SIM-\d{4},\d{4}-\d\d-\d\dT.*,simulated$/);
  const evil = [{ ...events[0], id: '=HYPERLINK("x")' }];
  assert.match(toCsv(evil).split('\n')[1], /^"'=HYPERLINK/);
});

test('a replayed event is new, simulated and numbered on', () => {
  const e = nextEvent(NOW, 97);
  assert.equal(e.id, 'SIM-0097');
  assert.equal(e.source, SOURCE);
  assert.ok(Math.abs(e.time - NOW) < 1000);
});

test('the page says SIMULATED up front and lists every system state', () => {
  const html = renderDemoBody(content);
  assert.match(content.demo.banner, /^SIMULATED/);
  assert.ok(html.includes(content.demo.banner.replace(/&/g, '&amp;')) || html.includes('SIMULATED'));
  assert.match(html, /role="note"/);
  for (const t of content.demo.tabs) assert.match(html, new RegExp(`data-view="${t.id}"`));
  for (const row of content.demo.system.rows) assert.ok(html.includes(row.name), row.name);
  assert.match(html, /class="rc-grid"/); // the measured results are on the Analytics tab
  assert.match(renderDemoHead(content), /<title>Dashboard demo \| Varn<\/title>/);
});

test('the system status uses only the known states', () => {
  const ok = ['Verified', 'Measured', 'Testing', 'Simulated', 'Not connected', 'Pending'];
  for (const row of content.demo.system.rows) assert.ok(ok.includes(row.state), `${row.name}: ${row.state}`);
});
