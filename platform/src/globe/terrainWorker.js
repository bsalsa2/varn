// One worker for all elevation work, so every AWS Terrarium tile is fetched and decoded once and
// shared between the 3D terrain mesh and the relief shading.
//   { type: 'heights', id, z, x, y, size }                  -> { id, heights: Float32Array(size²) }
//   { type: 'shade',   id, z, x, y, mpp, exaggeration }     -> { id, image: ImageBitmap }
// Requests are served newest first: after a fast zoom, tiles that are no longer on screen wait
// behind the ones that are.
import { padTile, hillshadeTile } from './hillshade.js';

const URL_T = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';
const MAX_ZOOM = 15, CACHE = 140, PARALLEL = 10;
const cache = new Map();            // key -> Promise<Float32Array|null>, in LRU order
const queue = [];                   // pending fetch jobs, newest last
let active = 0;

function pump() {
  while (active < PARALLEL && queue.length) {
    const job = queue.pop();
    active++;
    job().finally(() => { active--; pump(); });
  }
}

function tile(z, x, y) {
  const n = 2 ** z;
  if (y < 0 || y >= n) return Promise.resolve(null);
  x = ((x % n) + n) % n;
  const key = `${z}/${x}/${y}`;
  const hit = cache.get(key);
  if (hit) { cache.delete(key); cache.set(key, hit); return hit; }
  const p = new Promise((resolve) => {
    queue.push(async () => {
      try {
        const res = await fetch(URL_T.replace('{z}', z).replace('{x}', x).replace('{y}', y));
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const bmp = await createImageBitmap(await res.blob());
        const size = bmp.width;
        const ctx = new OffscreenCanvas(size, size).getContext('2d', { willReadFrequently: true });
        ctx.drawImage(bmp, 0, 0);
        const { data } = ctx.getImageData(0, 0, size, size);
        bmp.close();
        const h = new Float32Array(size * size);
        // Terrarium: metres = R*256 + G + B/256 - 32768. Seafloor and lakes are held at 0.
        for (let i = 0; i < h.length; i++) h[i] = Math.max(0, data[i * 4] * 256 + data[i * 4 + 1] + data[i * 4 + 2] / 256 - 32768);
        resolve(h);
      } catch { cache.delete(key); resolve(null); }
    });
    pump();
  });
  cache.set(key, p);
  if (cache.size > CACHE) cache.delete(cache.keys().next().value);
  return p;
}

self.onmessage = async ({ data: m }) => {
  try {
    const z = Math.min(m.z, MAX_ZOOM);
    if (m.type === 'heights') {
      const t = await tile(z, m.x, m.y);
      if (!t) throw new Error('elevation tile unavailable');
      const n = Math.sqrt(t.length), out = new Float32Array(m.size * m.size), step = (n - 1) / (m.size - 1);
      for (let j = 0; j < m.size; j++) for (let i = 0; i < m.size; i++) out[j * m.size + i] = t[Math.round(j * step) * n + Math.round(i * step)];
      self.postMessage({ id: m.id, heights: out }, [out.buffer]);
    } else {
      const [c, nw, n_, ne, w, e, sw, s, se] = await Promise.all([
        tile(z, m.x, m.y), tile(z, m.x - 1, m.y - 1), tile(z, m.x, m.y - 1), tile(z, m.x + 1, m.y - 1),
        tile(z, m.x - 1, m.y), tile(z, m.x + 1, m.y), tile(z, m.x - 1, m.y + 1), tile(z, m.x, m.y + 1), tile(z, m.x + 1, m.y + 1)]);
      if (!c) throw new Error('elevation tile unavailable');
      const size = Math.sqrt(c.length);
      const rgba = hillshadeTile(padTile(c, { nw, n: n_, ne, w, e, sw, s, se }, size), size, m.mpp, { exaggeration: m.exaggeration });
      const image = await createImageBitmap(new ImageData(rgba, size, size));
      self.postMessage({ id: m.id, image }, [image]);
    }
  } catch (err) {
    self.postMessage({ id: m.id, error: String(err?.message || err) });
  }
};
