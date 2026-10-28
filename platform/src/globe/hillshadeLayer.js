// Imagery provider that serves relief-shading tiles computed from AWS Terrain Tiles.
import { UrlTemplateImageryProvider, WebMercatorTilingScheme, Credit } from 'cesium';
import { TERRAIN } from './sources.js';
import { exaggerationFor, metersPerPixel } from './hillshade.js';

const MAX_IN_FLIGHT = 14;

export function createHillshadeProvider() {
  const provider = new UrlTemplateImageryProvider({
    url: TERRAIN.url, tilingScheme: new WebMercatorTilingScheme(), maximumLevel: TERRAIN.maxLevel,
    tileWidth: 256, tileHeight: 256, credit: new Credit(TERRAIN.credit),
  });
  const workers = Array.from({ length: 2 }, () => new Worker(new URL('./hillshadeWorker.js', import.meta.url), { type: 'module' }));
  const pending = new Map();
  let seq = 0, turn = 0;
  for (const w of workers) {
    w.onmessage = ({ data }) => {
      const p = pending.get(data.id); if (!p) return;
      pending.delete(data.id);
      data.error ? p.reject(new Error(data.error)) : p.resolve(data.image);
    };
  }
  provider.requestImage = (x, y, level) => {
    if (pending.size >= MAX_IN_FLIGHT) return undefined;        // Cesium retries later: keeps the queue short while flying
    return new Promise((resolve, reject) => {
      const id = ++seq;
      pending.set(id, { resolve, reject });
      workers[turn++ % workers.length].postMessage({
        id, url: TERRAIN.url.replace('{z}', level).replace('{x}', x).replace('{y}', y),
        mpp: metersPerPixel(level, y), exaggeration: exaggerationFor(level),
      });
    });
  };
  provider.destroyWorkers = () => workers.forEach((w) => w.terminate());
  return provider;
}
