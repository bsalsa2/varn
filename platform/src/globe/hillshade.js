// Relief shading from elevation, as a transparent overlay: shadows are black with alpha, sun-lit
// slopes are white with a lower alpha. Laid over satellite imagery this reads as real relief,
// the way a mountain looks under low morning light. Pure maths so it can be tested.

const D2R = Math.PI / 180;

/** Heights in metres (row 0 = north). Returns RGBA bytes for an n×n overlay. */
export function hillshade(heights, n, metersPerPixel, { exaggeration = 1.3, azimuth = 315, altitude = 45 } = {}) {
  const az = azimuth * D2R, alt = altitude * D2R;
  // Unit vector toward the light: x east, y north, z up.
  const lx = Math.sin(az) * Math.cos(alt), ly = Math.cos(az) * Math.cos(alt), lz = Math.sin(alt);
  const flat = lz;                                      // brightness of level ground
  const out = new Uint8ClampedArray(n * n * 4);
  const at = (x, y) => heights[(y < 0 ? 0 : y >= n ? n - 1 : y) * n + (x < 0 ? 0 : x >= n ? n - 1 : x)];
  const k = exaggeration / (8 * metersPerPixel);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const a = at(x - 1, y - 1), b = at(x, y - 1), c = at(x + 1, y - 1);
      const d = at(x - 1, y), f = at(x + 1, y);
      const g = at(x - 1, y + 1), h = at(x, y + 1), i = at(x + 1, y + 1);
      const dzdx = ((c + 2 * f + i) - (a + 2 * d + g)) * k;        // rise toward the east
      const dzdn = ((a + 2 * b + c) - (g + 2 * h + i)) * k;        // rise toward the north (rows run south)
      const shade = (lz - dzdx * lx - dzdn * ly) / Math.sqrt(1 + dzdx * dzdx + dzdn * dzdn);
      const o = (y * n + x) * 4;
      if (shade < flat) {
        out[o + 3] = Math.min(0.62, ((flat - shade) / flat) * 0.85) * 255;           // shadow: black
      } else {
        out[o] = out[o + 1] = out[o + 2] = 255;
        out[o + 3] = Math.min(0.26, ((shade - flat) / (1 - flat)) * 0.5) * 255;      // sunlit: white
      }
    }
  }
  return out;
}

/** Stronger exaggeration from orbit, where real slopes are far too gentle to see. */
export const exaggerationFor = (level) => Math.min(8, 1.2 + Math.max(0, 14 - level) * 0.7);

/** Ground metres per pixel of a 256 px web-mercator tile row. */
export function metersPerPixel(level, y) {
  const lat = Math.atan(Math.sinh(Math.PI * (1 - (2 * (y + 0.5)) / 2 ** level)));
  return (156543.03392804097 * Math.cos(lat)) / 2 ** level;
}
