// 3D terrain from AWS Terrain Tiles (Terrarium-encoded PNG elevation, open data, no key).
// Tiles are decoded by a small pool of workers into 65×65 heightmaps; past the source's deepest
// level Cesium refines the parent tile instead of asking for data that does not exist.
import { CustomHeightmapTerrainProvider, WebMercatorTilingScheme, Credit } from 'cesium';
import { TERRAIN } from './sources.js';

const SIZE = 65;
const POOL = Math.max(2, Math.min(4, (navigator.hardwareConcurrency || 4) - 1));

let workers = null, next = 0, seq = 0;
const pending = new Map();
function pool() {
  if (workers) return workers;
  workers = Array.from({ length: POOL }, () => {
    const w = new Worker(new URL('./terrainWorker.js', import.meta.url), { type: 'module' });
    w.onmessage = ({ data }) => {
      const p = pending.get(data.id); if (!p) return;
      pending.delete(data.id);
      data.error ? p.reject(new Error(data.error)) : p.resolve(data.heights);
    };
    return w;
  });
  return workers;
}
function decode(url) {
  return new Promise((resolve, reject) => {
    const id = ++seq;
    pending.set(id, { resolve, reject });
    const ws = pool();
    ws[next++ % ws.length].postMessage({ id, url, size: SIZE });
  });
}

export function createTerrain({ onError } = {}) {
  let failures = 0;
  const provider = new CustomHeightmapTerrainProvider({
    width: SIZE, height: SIZE,
    tilingScheme: new WebMercatorTilingScheme(),
    credit: new Credit(TERRAIN.credit),
    callback: (x, y, level) => {
      if (level > TERRAIN.maxLevel) return undefined;
      return decode(TERRAIN.url.replace('{z}', level).replace('{x}', x).replace('{y}', y))
        .catch((err) => {
          failures++;
          if (failures === 3) onError?.(err);
          return new Float32Array(SIZE * SIZE);           // flat tile rather than a hole
        });
    },
  });
  provider.getTileDataAvailable = (x, y, level) => level <= TERRAIN.maxLevel;
  return provider;
}
