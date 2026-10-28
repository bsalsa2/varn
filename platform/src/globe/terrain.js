// 3D terrain from AWS Terrain Tiles (Terrarium-encoded PNG elevation, open data, no key).
// Each 256 px tile is decoded to a 65×65 heightmap; past the source's deepest level Cesium
// refines the parent tile instead of asking for data that does not exist.
import { CustomHeightmapTerrainProvider, WebMercatorTilingScheme, Credit } from 'cesium';
import { TERRAIN } from './sources.js';

const SIZE = 65;

async function decode(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const bmp = await createImageBitmap(await res.blob());
  const canvas = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(bmp.width, bmp.height) : Object.assign(document.createElement('canvas'), { width: bmp.width, height: bmp.height });
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(bmp, 0, 0);
  const { data, width } = ctx.getImageData(0, 0, bmp.width, bmp.height);
  bmp.close?.();
  const out = new Float32Array(SIZE * SIZE);
  const step = (width - 1) / (SIZE - 1);
  for (let j = 0; j < SIZE; j++) {
    const py = Math.round(j * step);
    for (let i = 0; i < SIZE; i++) {
      const k = (py * width + Math.round(i * step)) * 4;
      // Terrarium: metres = R * 256 + G + B / 256 - 32768. Ocean floor is kept as 0 (sea level)
      // so coastlines read cleanly over imagery instead of showing the seabed.
      out[j * SIZE + i] = Math.max(0, data[k] * 256 + data[k + 1] + data[k + 2] / 256 - 32768);
    }
  }
  return out;
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
