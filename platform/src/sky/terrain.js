// Procedural topography for the plan view: seeded value noise + marching squares. Pure; no tiles, no network.
import { mulberry32 } from './sim.js';

export function noiseField(seed, n = 72, octaves = 4) {
  const rng = mulberry32(seed ^ 0x9e3779b9);
  const G = 17;
  const lattice = Array.from({ length: G * G }, () => rng());
  const L = (x, y) => lattice[((y % G) + G) % G * G + ((x % G) + G) % G];
  const smooth = (t) => t * t * (3 - 2 * t);
  const value = (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), fx = smooth(x - xi), fy = smooth(y - yi);
    const a = L(xi, yi), b = L(xi + 1, yi), c = L(xi, yi + 1), d = L(xi + 1, yi + 1);
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  };
  const field = new Float32Array(n * n);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    let v = 0, amp = 1, freq = 3 / n, norm = 0;
    for (let o = 0; o < octaves; o++) { v += amp * value(i * freq + o * 5.3, j * freq + o * 2.1); norm += amp; amp *= 0.5; freq *= 2; }
    field[j * n + i] = v / norm;
  }
  return { n, field };
}

// Returns line segments [x1,y1,x2,y2] in grid units for the iso-level.
export function marchingSquares({ n, field }, level) {
  const segs = [];
  const at = (i, j) => field[j * n + i];
  const lerp = (a, b) => (level - a) / (b - a || 1e-9);
  for (let j = 0; j < n - 1; j++) for (let i = 0; i < n - 1; i++) {
    const a = at(i, j), b = at(i + 1, j), c = at(i + 1, j + 1), d = at(i, j + 1);
    const idx = (a > level ? 8 : 0) | (b > level ? 4 : 0) | (c > level ? 2 : 0) | (d > level ? 1 : 0);
    if (idx === 0 || idx === 15) continue;
    const T = [i + lerp(a, b), j], R = [i + 1, j + lerp(b, c)], B = [i + lerp(d, c), j + 1], Lf = [i, j + lerp(a, d)];
    const add = (p, q) => segs.push([p[0], p[1], q[0], q[1]]);
    switch (idx) {
      case 1: case 14: add(Lf, B); break;
      case 2: case 13: add(B, R); break;
      case 3: case 12: add(Lf, R); break;
      case 4: case 11: add(T, R); break;
      case 5: add(Lf, T); add(B, R); break;
      case 6: case 9: add(T, B); break;
      case 7: case 8: add(Lf, T); break;
      case 10: add(T, R); add(Lf, B); break;
    }
  }
  return segs;
}

export function contours(seed, levels = 11, n = 72) {
  const f = noiseField(seed, n);
  let lo = Infinity, hi = -Infinity;
  for (const v of f.field) { if (v < lo) lo = v; if (v > hi) hi = v; }
  return { n, lo, hi, levels: Array.from({ length: levels }, (_, k) => {
    const level = lo + (hi - lo) * (k + 1) / (levels + 1);
    return { level, index: k, segs: marchingSquares(f, level) };
  }) };
}
