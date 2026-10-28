import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeBuildings, heightOf, tileOf, tileCentre, shade, MAX_PER_TILE } from './buildingsData.js';
import { encodeBuildingTile } from './mvtFixture.js';

const sq = (x, y, s) => [[x, y], [x + s, y], [x + s, y + s], [x, y + s]];
const T = { z: 14, x: 2800, y: 6540 };

test('tile maths round-trips a coordinate into its own tile', () => {
  const t = tileOf(34.0522, -118.2437);
  assert.deepEqual(t, { z: 14, x: 2810, y: 6542 });
  const c = tileCentre(t);
  assert.deepEqual(tileOf(c.lat, c.lon), t);
});

test('heights: mapped values win, levels are 3.2 m, unmapped falls back and says so', () => {
  assert.deepEqual(heightOf({ render_height: 42 }), { height: 42, mapped: true });
  assert.deepEqual(heightOf({ height: '18.5' }), { height: 18.5, mapped: true });
  assert.deepEqual(heightOf({ 'building:levels': 5 }), { height: 16, mapped: true });
  assert.deepEqual(heightOf({}), { height: 6, mapped: false });
  assert.equal(heightOf({ render_height: 99999 }).height, 900);
});

test('decodes footprints, heights, min heights and holes; skips hide_3d and degenerate shapes', () => {
  const buf = encodeBuildingTile([
    { id: 1, rings: [sq(100, 100, 200)], props: { render_height: 60, render_min_height: 0 } },
    { id: 2, rings: [sq(1000, 1000, 400), sq(1100, 1100, 100)], props: { render_height: 25 } },           // courtyard hole
    { id: 3, rings: [sq(2000, 2000, 100)], props: { render_height: 30, hide_3d: true } },                 // replaced by its parts
    { id: 4, rings: [sq(2500, 2500, 100)], props: { render_height: 10, render_min_height: 12 } },         // min >= height
    { id: 5, rings: [sq(3000, 3000, 100)], props: {} },                                                   // unmapped
  ]);
  const r = decodeBuildings(buf, T);
  assert.equal(r.total, 5);
  const byId = Object.fromEntries(r.buildings.map((b) => [b.id.split(':')[0], b]));
  assert.deepEqual(Object.keys(byId).sort(), ['1', '2', '5']);
  assert.equal(byId[1].height, 60); assert.equal(byId[1].mapped, true);
  assert.equal(byId[2].holes.length, 1); assert.equal(byId[2].holes[0].length, 4);
  assert.equal(byId[5].mapped, false);
  // geometry lands inside the tile's lon/lat box and has no repeated closing vertex
  const lons = byId[1].outer.map((p) => p[0]), lonW = (T.x / 2 ** 14) * 360 - 180, lonE = ((T.x + 1) / 2 ** 14) * 360 - 180;
  assert.ok(Math.min(...lons) > lonW && Math.max(...lons) < lonE);
  assert.equal(byId[1].outer.length, 4);
});

test('a tile with no building layer or an empty one decodes to nothing', () => {
  assert.equal(decodeBuildings(encodeBuildingTile([]), T).buildings.length, 0);
});

test('dense tiles are capped, keeping the biggest footprints', () => {
  const feats = [];
  for (let i = 0; i < MAX_PER_TILE + 50; i++) feats.push({ id: i + 1, rings: [sq(10 + (i % 60) * 60, 10 + Math.floor(i / 60) * 60, i < 3 ? 50 : 20)], props: { render_height: 10 } });
  const r = decodeBuildings(encodeBuildingTile(feats), T);
  assert.equal(r.buildings.length, MAX_PER_TILE);
  assert.equal(r.dropped, 50);
  assert.ok(r.buildings.slice(0, 3).every((b) => b.area >= r.buildings[10].area));
});

test('shade is deterministic, bounded and varies', () => {
  const a = shade('x:0', 10), b = shade('x:0', 10), c = shade('y:1', 10);
  assert.deepEqual(a, b); assert.notDeepEqual(a, c);
  [...a, ...c, ...shade('z', 400)].forEach((v) => assert.ok(v > 0.4 && v < 1));
});
