// 3D terrain from AWS Terrain Tiles (Terrarium-encoded PNG elevation, open data, no key).
// Tiles are decoded by the elevation worker into 65×65 heightmaps; past the source's deepest
// level Cesium refines the parent tile instead of asking for data that does not exist.
import { CustomHeightmapTerrainProvider, WebMercatorTilingScheme, Credit } from 'cesium';
import { TERRAIN } from './sources.js';
import { ask } from './tileWorker.js';

const SIZE = 65;

export function createTerrain({ onError } = {}) {
  let failures = 0;
  const provider = new CustomHeightmapTerrainProvider({
    width: SIZE, height: SIZE,
    tilingScheme: new WebMercatorTilingScheme(),
    credit: new Credit(TERRAIN.credit),
    callback: (x, y, level) => {
      if (level > TERRAIN.maxLevel) return undefined;
      return ask({ type: 'heights', z: level, x, y, size: SIZE })
        .then((r) => r.heights)
        .catch((err) => {
          failures++;
          if (failures === 4) onError?.(err);
          return new Float32Array(SIZE * SIZE);           // flat tile rather than a hole
        });
    },
  });
  provider.getTileDataAvailable = (x, y, level) => level <= TERRAIN.maxLevel;
  return provider;
}

/** One real decode through the worker: proves the worker runs and AWS answers. */
export async function testTerrain() {
  const t0 = performance.now();
  const r = await ask({ type: 'heights', z: 4, x: 2, y: 5, size: SIZE });
  if (!(r.heights?.length === SIZE * SIZE)) throw new Error('unexpected elevation data');
  return Math.round(performance.now() - t0);
}
