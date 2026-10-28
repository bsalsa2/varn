// Imagery provider that serves relief-shading tiles computed from AWS Terrain Tiles.
import { UrlTemplateImageryProvider, WebMercatorTilingScheme, Credit } from 'cesium';
import { TERRAIN } from './sources.js';
import { exaggerationFor, metersPerPixel } from './hillshade.js';
import { ask, inFlight } from './tileWorker.js';

const MAX_IN_FLIGHT = 12;

export function createHillshadeProvider() {
  const provider = new UrlTemplateImageryProvider({
    url: TERRAIN.url, tilingScheme: new WebMercatorTilingScheme(), maximumLevel: TERRAIN.maxLevel,
    tileWidth: 256, tileHeight: 256, credit: new Credit(TERRAIN.credit),
  });
  provider.requestImage = (x, y, level) => {
    if (inFlight() >= MAX_IN_FLIGHT) return undefined;           // Cesium asks again shortly: keeps the queue short while flying
    return ask({ type: 'shade', z: level, x, y, mpp: metersPerPixel(level, y), exaggeration: exaggerationFor(level) }).then((r) => r.image);
  };
  return provider;
}
