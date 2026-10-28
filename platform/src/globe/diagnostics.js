// Connection checks: is every provider the globe depends on reachable and allowed from this
// browser right now? Each check makes a real request and says what happened.
import { ContextLimits } from 'cesium';
import { BASE, LABELS, TERRAIN, OVERLAYS, resolveOverlay } from './sources.js';
import { testTerrain } from './terrain.js';
import { imageryMetadata } from './lookup.js';

const ms = (t0) => Math.round(performance.now() - t0);
const short = (e) => String(e?.message || e).replace(/^TypeError: /, '').slice(0, 90);

async function imageProbe(url) {
  const t0 = performance.now();
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const type = res.headers.get('content-type') || '';
  if (!type.startsWith('image/')) throw new Error(`answered with ${type || 'unknown type'}, not an image`);
  const size = (await res.blob()).size;
  if (size < 200) throw new Error('empty tile');
  return ms(t0);
}
async function localProbe(path, wantType) {
  const t0 = performance.now();
  const res = await fetch(path, { cache: 'no-store' });
  const type = res.headers.get('content-type') || '';
  // A missing file on a single-page host comes back as index.html with status 200.
  if (!res.ok || type.includes('text/html')) throw new Error(res.ok ? 'file missing (got the web page instead)' : `HTTP ${res.status}`);
  if (wantType && !type.includes(wantType)) throw new Error(`unexpected type ${type}`);
  return ms(t0);
}

const ok = (id, label, detail, t) => ({ id, label, state: 'ok', detail, ms: t });
const bad = (id, label, e, state = 'fail') => ({ id, label, state, detail: short(e) });

async function run(id, label, fn, onFail = 'fail') {
  try { const r = await fn(); return ok(id, label, r.detail ?? 'Connected', r.ms); } catch (e) { return bad(id, label, e, onFail); }
}

export function graphicsInfo(scene) {
  const c = scene.context;
  return {
    webgl2: !!c.webgl2, maxTexture: ContextLimits.maximumTextureSize, anisotropy: ContextLimits.maximumTextureFilterAnisotropy,
    float: !!c.floatingPointTexture, msaa: scene.msaaSamples, ratio: scene.pixelRatio ?? 1,
  };
}

/** `deep` also tests the optional providers (NASA GIBS, place search). */
export async function runChecks({ scene, deep = false } = {}) {
  const out = [];
  const checks = [
    run('esri', 'Satellite imagery (Esri)', async () => ({ ms: await imageProbe(BASE.esri.url.replace('{z}', '3').replace('{y}', '3').replace('{x}', '2')) })),
    run('terrain', 'Terrain (AWS elevation)', async () => ({ ms: await testTerrain() })),
    run('cesium', 'Globe engine files', async () => {
      const a = await localProbe('/cesium/Assets/approximateTerrainHeights.json', 'json');
      const b = await localProbe('/cesium/Workers/createVerticesFromHeightmap.js');
      return { ms: Math.max(a, b) };
    }),
    run('fallback', 'Bundled NASA imagery', async () => ({ ms: await localProbe('/earth/blue-marble-4k.webp') })),
    run('capture', 'Imagery capture dates (Esri)', async () => {
      const t0 = performance.now();
      const m = await imageryMetadata(35.05, -118.17);
      if (!m) throw new Error('service answered but returned no capture data');
      return { ms: ms(t0), detail: m.date ? `Latest sample ${m.date}` : 'Connected' };
    }, 'warn'),
    run('labels', 'Place labels (Esri)', async () => ({ ms: await imageProbe(LABELS.url.replace('{z}', '3').replace('{y}', '3').replace('{x}', '2')) }), 'warn'),
  ];
  const results = await Promise.all(checks);
  out.push(...results);

  if (scene) {
    const g = graphicsInfo(scene);
    out.push({ id: 'webgl', label: 'Graphics', state: g.webgl2 ? 'ok' : 'warn',
      detail: `${g.webgl2 ? 'WebGL 2' : 'WebGL 1 (reduced quality)'} · textures to ${g.maxTexture}px · ${g.msaa > 1 ? `${g.msaa}× MSAA` : 'FXAA'}` });
  }
  if (navigator.permissions?.query) {
    try {
      const p = await navigator.permissions.query({ name: 'geolocation' });
      out.push({ id: 'geo', label: 'My location', state: p.state === 'denied' ? 'warn' : 'ok',
        detail: p.state === 'denied' ? 'Blocked for this site: allow location in the browser address bar' : p.state === 'granted' ? 'Allowed' : 'Will ask when you press locate' });
    } catch { /* permission query not supported for geolocation */ }
  }
  if (!window.isSecureContext) out.push({ id: 'secure', label: 'Secure connection', state: 'warn', detail: 'Not HTTPS: location and clipboard are blocked by the browser' });

  if (deep) {
    out.push(...await Promise.all([
      run('gibs', 'NASA GIBS (clouds, weather)', async () => {
        const t0 = performance.now();
        const f = await resolveOverlay('clouds');
        if (!f) throw new Error('no recent imagery returned');
        return { ms: ms(t0), detail: `${OVERLAYS.clouds.name}: ${f.time}` };
      }, 'warn'),
      run('search', 'Place search (OpenStreetMap)', async () => {
        const t0 = performance.now();
        const r = await fetch('https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=London');
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return { ms: ms(t0) };
      }, 'warn'),
    ]));
  }
  return out;
}

export const CRITICAL = ['esri', 'terrain', 'cesium'];
export const summarize = (results) => {
  const failed = results.filter((r) => r.state === 'fail');
  const warned = results.filter((r) => r.state === 'warn');
  return { failed, warned, healthy: !failed.length };
};
export { TERRAIN };
