import test from 'node:test';
import assert from 'node:assert/strict';
import { generateScene, stateAt, angularSeparation, mulberry32, domeXY, LABELS, KINDS, sampleTrack, SCENE_DURATION, angularRate } from './sim.js';
import { marchingSquares, contours, noiseField } from './terrain.js';
import { normalizeSightings, kindFromLabel } from './data.js';

test('rng is deterministic per seed', () => {
  const a = mulberry32(7), b = mulberry32(7), c = mulberry32(8);
  const xs = [a(), a(), a()];
  assert.deepEqual(xs, [b(), b(), b()]);
  assert.notEqual(xs[0], c());
  for (const x of xs) assert.ok(x >= 0 && x < 1);
});

test('scene is deterministic and labels are only the allowed four', () => {
  const s1 = generateScene(1729), s2 = generateScene(1729), s3 = generateScene(42);
  assert.equal(JSON.stringify(stateAt(s1, 123.4).map(v => [v.track.id, v.az, v.el])), JSON.stringify(stateAt(s2, 123.4).map(v => [v.track.id, v.az, v.el])));
  assert.notEqual(JSON.stringify(sampleTrack(s1.tracks[0])), JSON.stringify(sampleTrack(s3.tracks[0])));
  const allowed = new Set(Object.values(LABELS));
  assert.equal(allowed.size, 4);
  for (const tr of s1.tracks) assert.ok(allowed.has(tr.label), tr.label);
  for (const k of KINDS) assert.ok(s1.tracks.some(t => t.kind === k), `has ${k}`);
});

test('positions stay on the sky and inside the track window', () => {
  const s = generateScene(5);
  for (const tr of s.tracks) {
    assert.ok(tr.t0 >= 0 && tr.t1 <= SCENE_DURATION + 1e-9);
    assert.equal(tr.sample(tr.t0 - 1), null);
    for (const p of sampleTrack(tr, 3)) { assert.ok(p.az >= 0 && p.az < 360); assert.ok(p.el >= 0 && p.el <= 90); }
  }
});

test('scrubbing is a pure function of time', () => {
  const s = generateScene(1729);
  const fwd = stateAt(s, 300).map(v => v.az);
  stateAt(s, 10); stateAt(s, 590);
  assert.deepEqual(stateAt(s, 300).map(v => v.az), fwd);
});

test('matching: only matched aircraft carry an ADS-B match, each with a computed reason', () => {
  const s = generateScene(1729);
  for (const tr of s.tracks) {
    assert.ok(tr.match.reason.length > 10);
    if (tr.kind === 'matched') { assert.equal(tr.match.status, 'matched'); assert.ok(tr.match.median <= 1); assert.match(tr.match.reason, /SIM\d{3}/); }
    else assert.equal(tr.match.status, 'none');
  }
});

test('angular geometry', () => {
  assert.ok(Math.abs(angularSeparation({ az: 0, el: 0 }, { az: 90, el: 0 }) - 90) < 1e-9);
  assert.ok(Math.abs(angularSeparation({ az: 10, el: 90 }, { az: 200, el: 90 })) < 1e-6);
  assert.ok(Math.abs(angularSeparation({ az: 359, el: 0 }, { az: 1, el: 0 }) - 2) < 1e-9);
  const [x, y] = domeXY(0, 0, 100, 100, 50); assert.ok(Math.abs(x - 100) < 1e-9 && Math.abs(y - 50) < 1e-9);
  const [x2] = domeXY(90, 0, 100, 100, 50); assert.ok(Math.abs(x2 - 150) < 1e-9);
  const s = generateScene(1729); const tr = s.tracks[0];
  assert.ok(angularRate(tr, (tr.t0 + tr.t1) / 2) > 0);
});

test('marching squares finds a closed contour around a peak', () => {
  const n = 9, field = new Float32Array(n * n);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) field[j * n + i] = -Math.hypot(i - 4, j - 4);
  const segs = marchingSquares({ n, field }, -2.5);
  assert.ok(segs.length >= 8);
  for (const [x1, y1, x2, y2] of segs) { assert.ok(Math.abs(Math.hypot(x1 - 4, y1 - 4) - 2.5) < 0.6); assert.ok(Math.abs(Math.hypot(x2 - 4, y2 - 4) - 2.5) < 0.6); }
  const c = contours(3, 6, 40);
  assert.equal(c.levels.length, 6);
  assert.deepEqual(noiseField(3, 20).field, noiseField(3, 20).field);
});

test('real data: normalises rows, honest null on empty', () => {
  assert.equal(normalizeSightings([]), null);
  assert.equal(normalizeSightings({}), null);
  const s = normalizeSightings([
    { id: 'a', time: '2026-01-01T00:00:00Z', azimuth: 350, elevation: 10, label: 'Drone (candidate)', match_status: 'none' },
    { id: 'a', time: '2026-01-01T00:00:10Z', azimuth: 10, elevation: 20, label: 'Drone (candidate)', match_status: 'none' },
    { id: 'b', time: '2026-01-01T00:00:05Z', azimuth: 90, elevation: 45, label: 'Aircraft (matched to ADS-B)', match_status: 'matched' },
    { id: 'c', time: 'bad', azimuth: 1, elevation: 1 },
  ]);
  assert.equal(s.tracks.length, 2);
  const a = s.tracks.find(t => t.id === 'a');
  assert.equal(a.kind, 'drone');
  const mid = a.sample(5); assert.ok(Math.abs(mid.az - 0) < 1e-6 || Math.abs(mid.az - 360) < 1e-6); assert.equal(mid.el, 15);
  assert.equal(kindFromLabel('Aircraft (unmatched)'), 'unmatched');
  assert.equal(kindFromLabel('hostile'), 'unknown');
});
