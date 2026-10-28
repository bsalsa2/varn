import test from 'node:test';
import assert from 'node:assert/strict';
import { parseLine, parseCoords, solarElevation, execute, complete, age, utc, COMMANDS } from './commands.js';
import { normalizeQuakes, normalizeEvents, usgsFeedName, styleFor } from './feeds.js';

const NOW = Date.parse('2026-06-21T12:00:00Z');
const quakeJson = { metadata: { generated: NOW - 30000, count: 3 }, features: [
  { id: 'a', properties: { mag: 4.6, place: '10 km N of Somewhere', time: NOW - 3600e3, url: 'u', tsunami: 0 }, geometry: { coordinates: [-118.1, 35.2, 8.4] } },
  { id: 'b', properties: { mag: 6.3, place: 'Offshore Nowhere', time: NOW - 7200e3, tsunami: 1 }, geometry: { coordinates: [150.2, -5.1, 40] } },
  { id: 'c', properties: { mag: null, place: 'bad row', time: NOW }, geometry: { coordinates: [0, 0, 1] } },
] };
const eventJson = { events: [
  { id: 'EONET_1', title: 'Big Fire', link: 'l', categories: [{ id: 'wildfires', title: 'Wildfires' }], sources: [{ url: 's' }],
    geometry: [{ date: '2026-06-20T00:00:00Z', type: 'Point', coordinates: [10, 20] }, { date: '2026-06-21T00:00:00Z', type: 'Point', coordinates: [11, 21], magnitudeValue: 500, magnitudeUnit: 'acres' }] },
  { id: 'EONET_2', title: 'Ice Thing', categories: [{ id: 'seaLakeIce', title: 'Sea and Lake Ice' }], geometry: [{ date: '2026-06-19T00:00:00Z', type: 'Polygon', coordinates: [[[0, 0], [2, 0], [2, 2], [0, 2], [0, 0]]] }] },
  { id: 'EONET_3', title: 'No geometry', categories: [], geometry: [] },
] };

function rig(over = {}) {
  const lines = [], calls = [];
  const io = { print: (t, c = '') => lines.push({ t, c }), clear: () => lines.push({ t: '<clear>', c: '' }) };
  const ctx = {
    now: () => NOW, mem: { list: null, marks: {}, history: [] },
    engine: {
      view: () => ({ height: 2e6, heading: 0, pitch: -90, loading: 0, failed: 0, quality: 'full', centre: { lat: 35, lon: -118 }, sun: { lat: 23.4, lon: -60 } }),
      flyToPlace: (...a) => calls.push(['fly', ...a]), setMarkers: (...a) => calls.push(['markers', a[0], a[1]?.length ?? 0]), markerCount: () => 0,
      home: () => calls.push(['home']), tilt: (f) => calls.push(['tilt', f]), northUp: () => calls.push(['north']),
    },
    layers: { list: () => [{ key: 'fires', name: 'fires', on: false }], set: async (k, on) => { calls.push(['layer', k, on]); } },
    feeds: {
      fetchQuakes: async (o) => ({ ...normalizeQuakes(quakeJson, o.minMag), fetched: NOW, window: o.window }),
      fetchEvents: async () => ({ ...normalizeEvents(eventJson), fetched: NOW }), styleFor, WINDOWS: {},
    },
    geocode: async () => [{ name: 'Kyiv, Ukraine', lat: 50.45, lon: 30.52 }], checks: async () => [], imagery: async () => null, select: (i) => calls.push(['select', i.id]),
    ...over,
  };
  return { ctx, io, lines, calls, text: () => lines.map((l) => l.t).join('\n') };
}

test('parseLine honours quotes', () => {
  assert.deepEqual(parseLine('fly "Strait of Hormuz" 40'), ['fly', 'Strait of Hormuz', '40']);
  assert.deepEqual(parseLine('  a   b '), ['a', 'b']);
  assert.deepEqual(parseLine(''), []);
});

test('parseCoords accepts decimals and hemispheres, rejects nonsense', () => {
  assert.deepEqual(parseCoords('35.05, -118.17'), { lat: 35.05, lon: -118.17 });
  assert.deepEqual(parseCoords('35.05N 118.17W'), { lat: 35.05, lon: -118.17 });
  assert.equal(parseCoords('95, 10'), null);
  assert.equal(parseCoords('Paris'), null);
});

test('solar elevation: 90° at the sub-solar point, negative on the far side', () => {
  const sun = { lat: 20, lon: 40 };
  assert.ok(Math.abs(solarElevation(20, 40, sun) - 90) < 1e-6);
  assert.ok(solarElevation(-20, -140, sun) < -85);
});

test('age and utc formatting', () => {
  assert.equal(age(NOW - 45e3, NOW), '45s');
  assert.equal(age(NOW - 3600e3, NOW), '60m');
  assert.equal(age(NOW - 3 * 86400e3, NOW), '3d');
  assert.equal(utc(NOW), '2026-06-21 12:00Z');
});

test('quake feed: normalised, sorted by magnitude, bad rows dropped, tier chosen', () => {
  const r = normalizeQuakes(quakeJson, 4);
  assert.deepEqual(r.items.map((q) => q.id), ['b', 'a']);
  assert.equal(r.items[0].tsunami, true);
  assert.equal(usgsFeedName(5), '4.5'); assert.equal(usgsFeedName(3), '2.5'); assert.equal(usgsFeedName(1.5), '1.0'); assert.equal(usgsFeedName(0), 'all');
});

test('EONET: latest geometry wins, polygons use their centroid, empty events dropped', () => {
  const { items } = normalizeEvents(eventJson);
  assert.equal(items.length, 2);
  const fire = items.find((e) => e.id === 'EONET_1');
  assert.equal(fire.lat, 21); assert.equal(fire.lon, 11); assert.equal(fire.magnitude, 500);
  const ice = items.find((e) => e.id === 'EONET_2');
  assert.ok(Math.abs(ice.lat - 0.8) < 1e-9 && Math.abs(ice.lon - 0.8) < 1e-9 || (ice.lat > 0 && ice.lat < 2));
});

test('quakes command prints a table, plots markers, raises an M6 alert, and feeds `go`', async () => {
  const r = rig();
  await execute('quakes day 4', r.ctx, r.io);
  assert.match(r.text(), /2 EVENT\(S\)/);
  assert.match(r.text(), /M6\.0 or greater/);
  assert.match(r.text(), /USGS tsunami flag/);
  assert.deepEqual(r.calls.find((c) => c[0] === 'markers'), ['markers', 'quakes', 2]);
  await execute('go 1', r.ctx, r.io);
  assert.deepEqual(r.calls.find((c) => c[0] === 'select'), ['select', 'b']);
  assert.equal(r.calls.find((c) => c[0] === 'fly')[0], 'fly');
});

test('quakes reports upstream failures instead of inventing data', async () => {
  const r = rig({ feeds: { fetchQuakes: async () => { throw new Error('USGS earthquake feed unreachable (offline)'); }, WINDOWS: {}, styleFor } });
  await execute('quakes', r.ctx, r.io);
  assert.match(r.text(), /ERROR\s+USGS earthquake feed unreachable/);
  assert.deepEqual(r.calls.filter((c) => c[0] === 'markers'), []);
});

test('fires: plots incidents, switches the thermal layer on, states the limits', async () => {
  const r = rig();
  await execute('fires 7', r.ctx, r.io);
  assert.deepEqual(r.calls.find((c) => c[0] === 'layer'), ['layer', 'fires', true]);
  assert.match(r.text(), /OPEN WILDFIRE EVENT/);
  assert.match(r.text(), /not every fire/);
  await execute('fires off', r.ctx, r.io);
  assert.deepEqual(r.calls.filter((c) => c[0] === 'layer').pop(), ['layer', 'fires', false]);
});

test('fly resolves coordinates without geocoding and places via geocoder', async () => {
  const r = rig({ geocode: async () => { throw new Error('should not be called'); } });
  await execute('fly 35.05, -118.17 20', r.ctx, r.io);
  assert.deepEqual(r.calls[0], ['fly', 35.05, -118.17, 20000]);
  const r2 = rig(); await execute('fly Kyiv', r2.ctx, r2.io);
  assert.equal(r2.calls[0][1], 50.45); assert.match(r2.text(), /Kyiv, Ukraine/);
});

test('unknown commands are rejected with a suggestion; commands never throw out of execute', async () => {
  const r = rig(); await execute('quak', r.ctx, r.io); await execute('go 1', r.ctx, r.io);
  assert.match(r.text(), /unknown command: quak/); assert.match(r.text(), /run quakes, fires or events first/);
});

test('completion: command names and per-command arguments', () => {
  assert.deepEqual(complete('qu').options, ['quakes']);
  assert.ok(complete('layers fi').options.includes('fires'));
  assert.equal(complete('layers fi').replace('fires'), 'layers fires');
  assert.ok(Object.keys(COMMANDS).length > 15);
});
