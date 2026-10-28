import test from 'node:test';
import assert from 'node:assert/strict';
import { hillshade, exaggerationFor, metersPerPixel } from './hillshade.js';

const N = 64;
const cone = () => { const h = new Float32Array(N * N); for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) h[y * N + x] = Math.max(0, 600 - 28 * Math.hypot(x - 32, y - 32)); return h; };
const px = (img, x, y) => { const o = (y * N + x) * 4; return { r: img[o], a: img[o + 3] }; };

test('level ground is left clear', () => {
  const img = hillshade(new Float32Array(N * N), N, 10);
  assert.equal(px(img, 20, 20).a, 0);
});

test('the north-west face of a hill is lit and the south-east face is in shadow', () => {
  const img = hillshade(cone(), N, 10, { exaggeration: 2 });
  const nw = px(img, 26, 26), se = px(img, 38, 38);
  assert.equal(nw.r, 255, 'lit slope is white');
  assert.ok(nw.a > 20, 'lit slope has visible highlight');
  assert.equal(se.r, 0, 'shaded slope is black');
  assert.ok(se.a > 80, 'shaded slope has visible shadow');
});

test('a hill is symmetric about the light axis: NE and SW faces are about equally dim', () => {
  const img = hillshade(cone(), N, 10, { exaggeration: 2 });
  const ne = px(img, 38, 26), sw = px(img, 26, 38);
  assert.ok(Math.abs(ne.a - sw.a) < 12, `${ne.a} vs ${sw.a}`);
});

test('exaggeration is stronger from orbit than up close', () => {
  assert.ok(exaggerationFor(4) > exaggerationFor(12) && exaggerationFor(14) === 1.2 && exaggerationFor(0) === 8);
});

test('metres per pixel follow web mercator', () => {
  assert.ok(Math.abs(metersPerPixel(10, 512) - 152.87) < 1);      // equator at z10
});
