// Test helper: encodes a tiny Mapbox Vector Tile (building layer) so decoding can be tested without a network.
import Pbf from 'pbf';

const zz = (n) => (n << 1) ^ (n >> 31);
function ringCommands(ring) {                          // ring: [[px,py]…] open, tile coordinates
  const cmds = [], first = ring[0];
  cmds.push((1 << 3) | 1, zz(first[0]), zz(first[1]));
  cmds.push(((ring.length - 1) << 3) | 2);       // LineTo: id 2, count in the high bits
  let [cx, cy] = first;
  for (let i = 1; i < ring.length; i++) { cmds.push(zz(ring[i][0] - cx), zz(ring[i][1] - cy)); [cx, cy] = ring[i]; }
  cmds.push((1 << 3) | 7);                     // ClosePath: id 7, count 1
  return cmds;
}
const signedArea = (r) => { let a = 0; for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += (r[j][0] - r[i][0]) * (r[j][1] + r[i][1]); return a / 2; };

/** features: [{ id, rings: [outer, ...holes] in tile px (0..extent), props: {…} }] */
export function encodeBuildingTile(features, extent = 4096) {
  const keys = [], values = [];
  const idx = (arr, v, same) => { let i = arr.findIndex((x) => same(x, v)); if (i < 0) { arr.push(v); i = arr.length - 1; } return i; };
  const pbf = new Pbf();
  pbf.writeMessage(3, (_, p) => {
    p.writeVarintField(15, 2);
    p.writeStringField(1, 'building');
    features.forEach((f, n) => p.writeMessage(2, (__, fp) => {
      fp.writeVarintField(1, f.id ?? n + 1);
      const tags = [];
      for (const [k, v] of Object.entries(f.props || {})) { tags.push(idx(keys, k, (a, b) => a === b), idx(values, v, (a, b) => a === b)); }
      fp.writePackedVarint(2, tags);
      fp.writeVarintField(3, 3);
      const geom = [];
      f.rings.forEach((r, i) => {                       // exterior and holes wind in opposite directions
        const wantPositive = i === 0;
        const ring = (signedArea(r) > 0) === wantPositive ? r : r.slice().reverse();
        geom.push(...ringCommands(ring));
      });
      fp.writePackedVarint(4, geom);
    }, null));
    keys.forEach((k) => p.writeStringField(3, k));
    values.forEach((v) => p.writeMessage(4, (val, vp) => {
      if (typeof v === 'string') vp.writeStringField(1, v);
      else if (typeof v === 'boolean') vp.writeBooleanField(7, v);
      else if (Number.isInteger(v)) vp.writeVarintField(5, v);
      else vp.writeDoubleField(3, v);
    }, null));
    p.writeVarintField(5, extent);
  }, null);
  return pbf.finish();
}
