import test from 'node:test';
import assert from 'node:assert/strict';
import { hillshade, exaggerationFor, metersPerPixel, padTile, hillshadeTile } from './hillshade.js';

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

test('tiles shaded with their neighbours match shading of the whole terrain: no seams at tile borders', () => {
  const T = 32, W = T * 3;
  const big = new Float32Array(W * W);
  for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) big[y * W + x] = 500 + 300 * Math.sin(x * 0.21) * Math.cos(y * 0.17) + 4 * x;
  const sub = (tx, ty) => { const t = new Float32Array(T * T); for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) t[y * T + x] = big[(ty * T + y) * W + tx * T + x]; return t; };
  const nb = { nw: sub(0, 0), n: sub(1, 0), ne: sub(2, 0), w: sub(0, 1), e: sub(2, 1), sw: sub(0, 2), s: sub(1, 2), se: sub(2, 2) };
  const tile = hillshadeTile(padTile(sub(1, 1), nb, T), T, 10, { exaggeration: 2 });
  const whole = hillshade(big, W, 10, { exaggeration: 2 });
  let worst = 0;
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) for (let c = 0; c < 4; c++) worst = Math.max(worst, Math.abs(tile[(y * T + x) * 4 + c] - whole[((T + y) * W + T + x) * 4 + c]));
  assert.equal(worst, 0);
  // and without neighbours the edge pixels do differ, which is the seam this prevents
  const alone = hillshadeTile(padTile(sub(1, 1), {}, T), T, 10, { exaggeration: 2 });
  let edgeDiff = 0;
  for (let c = 0; c < 4; c++) edgeDiff = Math.max(edgeDiff, Math.abs(alone[c] - whole[(T * W + T) * 4 + c]));
  assert.ok(edgeDiff > 0);
});
