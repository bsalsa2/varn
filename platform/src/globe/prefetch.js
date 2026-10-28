// Warms the browser's HTTP cache with the imagery tiles a zoom is heading toward, so that when
// Cesium asks for them the answer is already local. Nothing here draws anything: it only issues
// ordinary tile requests early, at low priority, for the tiles under the cursor.
import { tileOf } from './buildingsData.js';

const MAX_LEVEL = 19;                  // deeper levels are mostly missing in the basemap: not worth warming
const MAX_PER_CALL = 8, MAX_INFLIGHT = 6, SEEN_CAP = 3000;

export function createPrefetcher(urlOf) {
  const seen = new Set();
  let inflight = 0, issued = 0;

  const warm = (z, x, y) => {
    const n = 2 ** z, xx = ((x % n) + n) % n, yy = Math.min(n - 1, Math.max(0, y));
    const url = urlOf(z, xx, yy), key = `${z}/${xx}/${yy}`;
    if (seen.has(key) || inflight >= MAX_INFLIGHT) return false;
    if (seen.size > SEEN_CAP) seen.clear();
    seen.add(key); inflight++; issued++;
    fetch(url, { mode: 'cors', priority: 'low' }).then((r) => r.blob()).catch(() => seen.delete(key)).finally(() => { inflight--; });
    return true;
  };

  return {
    /** Camera is moving toward (lat, lon) from `heightM`; warm the levels it will want next. */
    ahead(lat, lon, heightM) {
      if (navigator.connection?.saveData) return;
      const mpp = heightM * 0.55 * 0.00144;                         // metres per screen pixel after roughly halving the height
      const level = Math.min(MAX_LEVEL, Math.ceil(Math.log2((156543.03 * Math.cos((lat * Math.PI) / 180)) / Math.max(mpp, 0.05))));
      if (level < 5) return;
      let budget = MAX_PER_CALL;
      for (const z of [level - 1, level]) {                         // the parent first: it is what shows while the sharper tile arrives
        const c = tileOf(lat, lon, z);
        for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) { if (budget <= 0) return; if (warm(z, c.x + dx, c.y + dy)) budget--; }
      }
    },
    stats: () => ({ issued, inflight, remembered: seen.size }),
  };
}
