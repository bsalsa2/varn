// The globe itself, with no React in it. Everything that changes many times a second (camera,
// tile queue, cursor) is written to a `live` store; layers report their state through callbacks.
import {
  CesiumWidget, ContextLimits, ImageryLayer, UrlTemplateImageryProvider, SingleTileImageryProvider, ArcGisMapServerImageryProvider,
  EllipsoidTerrainProvider, BoundingSphere, HeadingPitchRange, RequestScheduler, sampleTerrain,
  Cartesian2, Cartesian3, Cartographic, Color, Credit, Ion, JulianDate, Math as CMath, Rectangle,
  ScreenSpaceEventHandler, ScreenSpaceEventType, createWorldTerrainAsync, createGooglePhotorealistic3DTileset, createOsmBuildingsAsync, GoogleMaps,
  PointPrimitiveCollection, NearFarScalar,
} from 'cesium';
import { BASE, LABELS, OVERLAYS, GIBS_CREDIT, UPGRADES, TERRAIN, gibsUrl, resolveOverlay } from './sources.js';
import { createTerrain } from './terrain.js';
import { createHillshadeProvider } from './hillshadeLayer.js';
import { createGrade } from './grade.js';
import { createLive } from './live.js';
import { subsolarPoint } from '../earth/sun.js';

Ion.defaultAccessToken = UPGRADES.ionToken;
if (UPGRADES.googleKey) GoogleMaps.defaultApiKey = UPGRADES.googleKey;
// Tile hosts: enough parallel requests for fast zooms without starving each other.
Object.assign(RequestScheduler.requestsByServer, {
  'services.arcgisonline.com:443': 32, 'gibs.earthdata.nasa.gov:443': 20, 's3.amazonaws.com:443': 10,
});
RequestScheduler.maximumRequests = 60;
export const HAS_3D = !!(UPGRADES.googleKey || UPGRADES.ionToken);

const R = 6371000;
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export const homeView = () => ({ lon: subsolarPoint().lon - 58, lat: 16, height: 21000000 });

/** Cesium never retries a failed tile unless asked, so one dropped request would leave a soft patch for good. */
function armRetry(provider, stats) {
  provider.errorEvent?.addEventListener((err) => {
    if ((err.timesRetried ?? 0) < 3) err.retry = true; else stats.failed++;
  });
}

export function createEngine({ host, credits, onLost, onLayer, onPick, onMoveStart, onViewChange }) {
  const params = new URLSearchParams(location.search);
  const fixedQuality = params.has('fixed') || params.has('debug');
  const dpr = window.devicePixelRatio || 1;
  const live = createLive({ height: null, heading: 0, pitch: -90, lat: 0, lon: 0, loading: 0, cursor: null, quality: 'full', failed: 0 });
  const stats = { failed: 0 };
  const layers = {};
  const want = { satellite: true, terrain: true, labels: false, daynight: true, clouds: false, weather: false, eo: null, buildings: HAS_3D };

  const widget = new CesiumWidget(host, {
    baseLayer: false, terrainProvider: new EllipsoidTerrainProvider(), creditContainer: credits,
    requestRenderMode: true, maximumRenderTimeChange: Infinity, shouldAnimate: false,
    showRenderLoopErrors: false, useBrowserRecommendedResolution: false,
  });
  const { scene, camera } = widget;
  const globe = scene.globe;
  const baseRatio = Math.min(dpr, 2);                          // render up to 2× device pixels
  widget.resolutionScale = baseRatio / dpr;
  scene.msaaSamples = dpr < 1.5 ? 4 : 1;                       // MSAA on standard screens; FXAA on dense ones
  scene.postProcessStages.fxaa.enabled = scene.msaaSamples === 1;

  scene.backgroundColor = Color.fromCssColorString('#05070a');
  globe.baseColor = Color.fromCssColorString('#0e1b2a');
  globe.showGroundAtmosphere = true;
  globe.dynamicAtmosphereLighting = true;
  globe.dynamicAtmosphereLightingFromSun = true;
  globe.depthTestAgainstTerrain = true;
  globe.maximumScreenSpaceError = 1.5;
  globe.tileCacheSize = 600;
  globe.preloadAncestors = true;
  globe.preloadSiblings = true;
  globe.loadingDescendantLimit = 24;
  scene.skyAtmosphere.show = true;
  if (scene.skyBox) scene.skyBox.show = false;               // a near-black sky: photographs from orbit show no stars
  if (scene.sun) scene.sun.show = false;
  if (scene.moon) scene.moon.show = false;
  scene.fog.enabled = true;
  scene.fog.minimumBrightness = 0.55;                          // distant ground fades to haze, never to black
  scene.highDynamicRange = false;
  const grade = createGrade(scene);

  const ctl = scene.screenSpaceCameraController;
  ctl.minimumZoomDistance = 30;
  ctl.maximumZoomDistance = 60000000;
  ctl.inertiaSpin = 0.92; ctl.inertiaTranslate = 0.92; ctl.inertiaZoom = 0.84;
  ctl.enableCollisionDetection = true;

  /* Day and night: every transition is a smooth function of altitude, never a hard switch. Shading
     from the real sun fades in between 0.9 and 7 thousand km; the city-lights layer fades in from
     2 to 9 thousand km; haze never darkens the night side, so the imagery is readable everywhere. */
  function applyLighting() {
    const on = want.daynight;
    globe.enableLighting = on;
    globe.lightingFadeOutDistance = R + 0.9e6;
    globe.lightingFadeInDistance = R + 7e6;
    globe.nightFadeOutDistance = 1e10;
    globe.nightFadeInDistance = 2e10;
    updateFades();
  }
  function updateFades() {
    if (!layers.night) return;
    const h = camera.positionCartographic.height;
    const a = want.daynight ? smooth(2e6, 9e6, h) : 0;
    layers.night.alpha = a;
    layers.night.show = a > 0.003;
  }

  widget.clock.currentTime = JulianDate.now();
  camera.setView({ destination: Cartesian3.fromDegrees(homeView().lon, homeView().lat, homeView().height) });

  // The planet is never blank: bundled NASA Blue Marble underneath everything.
  SingleTileImageryProvider.fromUrl(BASE.blueMarble.url, { credit: new Credit(BASE.blueMarble.credit) })
    .then((p) => { if (!widget.isDestroyed()) { layers.fallback = widget.imageryLayers.addImageryProvider(p, 0); scene.requestRender(); } })
    .catch(() => {});

  /* ── live readouts ── */
  const readCamera = () => {
    const c = camera.positionCartographic;
    live.set({ height: c.height, lat: CMath.toDegrees(c.latitude), lon: CMath.toDegrees(c.longitude), heading: CMath.toDegrees(camera.heading), pitch: CMath.toDegrees(camera.pitch) });
    updateFades();
  };
  camera.percentageChanged = 0.01;
  const offChanged = camera.changed.addEventListener(readCamera);
  // Repaint whenever the tile queue changes: in request-render mode the last sharp tiles could
  // otherwise arrive after the final frame and leave the view soft.
  const offLoad = globe.tileLoadProgressEvent.addEventListener((n) => { live.set({ loading: n, failed: stats.failed }); scene.requestRender(); });
  const offStart = camera.moveStart.addEventListener(() => onMoveStart?.());
  let diving = false, autoTilted = false, metaTimer = 0;
  const screenCentre = () => new Cartesian2(scene.canvas.clientWidth / 2, scene.canvas.clientHeight / 2);
  const offEnd = camera.moveEnd.addEventListener(() => {
    readCamera();
    const h = camera.positionCartographic.height;
    if (h > 60000) autoTilted = false;
    // Like Google Earth: diving in with the wheel eases the view toward the horizon once, near the ground.
    if (!autoTilted && diving && h < 9000 && h > 200 && CMath.toDegrees(camera.pitch) < -78 && !reduceMotion()) {
      autoTilted = true; diving = false;
      orbitCentre({ pitch: CMath.toRadians(-52), duration: 1.4 });
    }
    clearTimeout(metaTimer);
    metaTimer = setTimeout(() => {
      if (camera.positionCartographic.height > 400000) { onViewChange?.(null); return; }
      const centre = globe.pick(camera.getPickRay(screenCentre()), scene);
      if (!centre) return;
      const g = Cartographic.fromCartesian(centre);
      onViewChange?.({ lat: CMath.toDegrees(g.latitude), lon: CMath.toDegrees(g.longitude) });
    }, 450);
  });
  readCamera();

  const handler = new ScreenSpaceEventHandler(scene.canvas);
  let raf = 0, lastMove = null;
  handler.setInputAction((m) => {
    lastMove = m.endPosition;
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      const p = camera.pickEllipsoid(lastMove, globe.ellipsoid);
      if (!p) { live.set({ cursor: null }); return; }
      const g = Cartographic.fromCartesian(p);
      const lat = CMath.toDegrees(g.latitude), lon = CMath.toDegrees(g.longitude), c = live.get().cursor;
      if (!c || Math.abs(c.lat - lat) > 1e-4 || Math.abs(c.lon - lon) > 1e-4) live.set({ cursor: { lat, lon } });
    });
  }, ScreenSpaceEventType.MOUSE_MOVE);
  handler.setInputAction((delta) => { diving = delta > 0; }, ScreenSpaceEventType.WHEEL);
  handler.setInputAction((c) => {
    const hit = scene.pick(c.position);
    if (hit?.id?.item) { onPick?.({ marker: hit.id.item, set: hit.id.set, x: c.position.x, y: c.position.y }); return; }
    const p = globe.pick(camera.getPickRay(c.position), scene);
    if (!p) { onPick?.(null); return; }
    const g = Cartographic.fromCartesian(p);
    onPick?.({ lat: CMath.toDegrees(g.latitude), lon: CMath.toDegrees(g.longitude), height: g.height, x: c.position.x, y: c.position.y, meta: 'loading' });
  }, ScreenSpaceEventType.LEFT_CLICK);

  const sunTimer = setInterval(() => { if (window.__freezeTime) return; widget.clock.currentTime = JulianDate.now(); scene.requestRender(); }, 60000);
  const onResize = () => scene.requestRender();
  addEventListener('resize', onResize);

  /* ── a graphics fault is reported, not left as a frozen or garbled frame ── */
  const canvas = scene.canvas;
  const lost = (e) => { e?.preventDefault?.(); onLost?.('The graphics context was lost (the browser or GPU reset it).'); };
  canvas.addEventListener('webglcontextlost', lost);
  const offRenderError = scene.renderError.addEventListener((_, error) => onLost?.(`The globe hit a rendering error: ${error?.message || error}`));

  /* ── quality governor: if the machine can't hold ~30 fps while moving, quality steps down, once and in order ── */
  let last = 0, window_ = [], step = 0, cooldown = 0;
  const steps = [
    () => { if (scene.msaaSamples > 1) { scene.msaaSamples = 1; scene.postProcessStages.fxaa.enabled = true; return 'AA simplified'; } return null; },
    () => { widget.resolutionScale = Math.max(0.6, widget.resolutionScale * 0.8); return 'resolution reduced'; },
    () => { globe.maximumScreenSpaceError = 2.2; return 'detail target relaxed'; },
    () => { widget.resolutionScale = Math.max(0.5, widget.resolutionScale * 0.8); return 'resolution reduced'; },
  ];
  const offPost = scene.postRender.addEventListener(() => {
    if (fixedQuality) return;
    const now = performance.now();
    if (last) { const dt = now - last; if (dt < 250) window_.push(dt); }
    last = now;
    if (window_.length < 60) return;
    const avg = window_.reduce((a, b) => a + b, 0) / window_.length;
    window_ = [];
    if (now < cooldown || avg < 34) return;
    while (step < steps.length) {
      const did = steps[step++]();
      if (did) { cooldown = now + 4000; live.set({ quality: 'adjusted' }); scene.requestRender(); break; }
    }
  });

  /* ── camera helpers ── */
  function orbitCentre({ rangeFactor = 1, pitch, heading, duration = 1 }) {
    const centre = globe.pick(camera.getPickRay(screenCentre()), scene);
    if (!centre) return false;
    const range = Math.max(80, Cartesian3.distance(camera.positionWC, centre) * rangeFactor);
    camera.flyToBoundingSphere(new BoundingSphere(centre, 0), { offset: new HeadingPitchRange(heading ?? camera.heading, pitch ?? camera.pitch, range), duration });
    return true;
  }
  const dur = (s) => (reduceMotion() ? 0 : s);
  const fly = (opts) => camera.flyTo({ duration: dur(2.2), ...opts });

  /* ── layers ── */
  function esriProvider() {
    const plain = () => new UrlTemplateImageryProvider({ url: BASE.esri.url, maximumLevel: BASE.esri.maximumLevel, credit: new Credit(BASE.esri.credit) });
    // Cesium's ArcGIS provider reads the service's real zoom levels and discards Esri's identical
    // "data not yet available" tiles, so the sharpest real tile stays on screen. Plain tiles if the
    // service description can't be read.
    return ArcGisMapServerImageryProvider.fromUrl(BASE.esri.service, { token: BASE.esri.token, enablePickFeatures: false, maximumLevel: BASE.esri.maximumLevel })
      .catch(() => plain()).then((p) => { armRetry(p, stats); return p; });
  }

  function setSatellite(on) {
    want.satellite = on;
    if (on && !layers.esri) {
      onLayer?.('satellite', { status: 'loading' });
      layers.esri = widget.imageryLayers.add(ImageryLayer.fromProviderAsync(esriProvider()), layers.fallback ? 1 : 0);
      fetch(BASE.esri.url.replace('{z}', '1').replace('{y}', '0').replace('{x}', '0'))
        .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); onLayer?.('satellite', { status: 'on', error: null }); })
        .catch((e) => onLayer?.('satellite', { status: 'error', error: `Esri World Imagery unavailable (${e.message}); showing NASA Blue Marble.` }));
    }
    if (layers.esri) layers.esri.show = on;
    if (!on) onLayer?.('satellite', { status: 'off' });
    scene.requestRender();
  }

  function setLabels(on) {
    want.labels = on;
    if (on && !layers.labels) {
      const p = new UrlTemplateImageryProvider({ url: LABELS.url, maximumLevel: LABELS.maximumLevel, credit: new Credit(LABELS.credit) });
      armRetry(p, stats);
      layers.labels = widget.imageryLayers.addImageryProvider(p);
    }
    if (layers.labels) { layers.labels.show = on; widget.imageryLayers.raiseToTop(layers.labels); }
    scene.requestRender();
  }

  function setDayNight(on) {
    want.daynight = on;
    if (on && !layers.night && !layers.nightPending) {
      layers.nightPending = true;
      SingleTileImageryProvider.fromUrl('/earth/night-lights-warm-2k.webp', { credit: new Credit('City lights: NASA Earth at Night (public domain)') }).then((p) => {
        layers.nightPending = false;
        if (widget.isDestroyed() || layers.night) return;
        layers.night = widget.imageryLayers.addImageryProvider(p);
        layers.night.dayAlpha = 0; layers.night.nightAlpha = 1; layers.night.brightness = 2.6; layers.night.gamma = 0.8;
        if (layers.labels) widget.imageryLayers.raiseToTop(layers.labels);
        updateFades(); scene.requestRender();
      }).catch(() => { layers.nightPending = false; });
    }
    applyLighting();
    scene.requestRender();
  }

  let terrainOn = null;
  function setTerrain(on) {
    want.terrain = on;
    if (on !== terrainOn) {
      terrainOn = on;
      const aws = () => createTerrain({ onError: () => onLayer?.('terrain', { status: 'error', error: 'Elevation tiles are not loading; the surface may look flat.' }) });
      if (!on) globe.terrainProvider = new EllipsoidTerrainProvider();
      else {
        globe.terrainProvider = aws();
        // With a Cesium ion token: Cesium World Terrain, with normals for sun shading and a water mask.
        if (UPGRADES.ionToken) createWorldTerrainAsync({ requestVertexNormals: true, requestWaterMask: true })
          .then((t) => { if (!widget.isDestroyed() && want.terrain) { globe.terrainProvider = t; scene.requestRender(); } }).catch(() => {});
      }
      onLayer?.('terrain', { status: on ? 'on' : 'off', error: null });
    }
    // Relief shading from the same elevation data: what makes mountains look solid under the imagery.
    if (on && !layers.hill) {
      const hp = createHillshadeProvider();
      armRetry(hp, stats);
      layers.hill = widget.imageryLayers.add(new ImageryLayer(hp), layers.esri ? widget.imageryLayers.indexOf(layers.esri) + 1 : undefined);
    }
    if (layers.hill) layers.hill.show = on;
    scene.requestRender();
  }

  /** Photorealistic tiles when Google (directly or through Cesium ion) answers; otherwise extruded OSM buildings on the satellite imagery. */
  async function loadBuildings() {
    const why = [];
    try {
      const ts = await createGooglePhotorealistic3DTileset({ key: UPGRADES.googleKey || undefined, onlyUsingWithGoogleGeocoder: !!UPGRADES.googleKey }, { maximumScreenSpaceError: 8 });
      return { tileset: ts, source: 'Google Photorealistic 3D Tiles', replacesGlobe: true };
    } catch (e) { why.push(`Google 3D Tiles: ${e.message || e}`); }
    if (UPGRADES.ionToken) {
      try { return { tileset: await createOsmBuildingsAsync(), source: 'Cesium OSM Buildings', replacesGlobe: false }; }
      catch (e) { why.push(`OSM Buildings: ${e.message || e}`); }
    }
    throw new Error(why.join(' · '));
  }
  function showBuildings() {
    if (!layers.tiles) return;
    layers.tiles.show = want.buildings;
    globe.show = !(want.buildings && layers.tilesReplace);          // photoreal tiles carry their own imagery and terrain
    scene.requestRender();
  }
  function setBuildings(on) {
    want.buildings = on;
    if (!HAS_3D) return;
    if (on && !layers.tiles && !layers.tilesPending) {
      layers.tilesPending = true;
      onLayer?.('buildings', { status: 'loading', error: null });
      loadBuildings().then(({ tileset, source, replacesGlobe }) => {
        if (widget.isDestroyed()) return;
        layers.tiles = scene.primitives.add(tileset); layers.tilesReplace = replacesGlobe;
        tileset.tileFailed?.addEventListener((err) => { onLayer?.('buildings', { status: 'on', source, error: `Some 3D tiles failed to load (${err.message || 'request error'})` }); });
        showBuildings();
        onLayer?.('buildings', { status: 'on', source, error: null });
      }).catch((e) => { onLayer?.('buildings', { status: 'error', error: `3D buildings unavailable (${e.message || e})`, off: true }); })
        .finally(() => { layers.tilesPending = false; });
    }
    showBuildings();
  }

  /* ── vector markers (earthquakes, fire incidents, events) ── */
  const markerSets = {};
  function setMarkers(name, items, styleOf) {
    markerSets[name]?.coll && scene.primitives.remove(markerSets[name].coll);
    delete markerSets[name];
    if (items?.length) {
      const coll = scene.primitives.add(new PointPrimitiveCollection());
      for (const it of items) {
        const st = styleOf(it);
        coll.add({
          position: Cartesian3.fromDegrees(it.lon, it.lat, 0), pixelSize: st.size, color: Color.fromCssColorString(st.color).withAlpha(0.9),
          outlineColor: Color.BLACK.withAlpha(0.65), outlineWidth: 1.5, id: { set: name, item: it },
          scaleByDistance: new NearFarScalar(1.5e5, 1.5, 2.5e7, 0.55),
          disableDepthTestDistance: 5e6,                                // visible over terrain up close; globe still hides the far side
        });
      }
      markerSets[name] = { coll, items };
    }
    scene.requestRender();
  }
  const markerCount = (name) => markerSets[name]?.items.length ?? 0;

  const overlayWanted = (key) => ({ clouds: want.clouds, weather: want.weather }[key] ?? want.eo === key);
  const aborters = {};
  function setOverlay(key, on) {
    if (key === 'clouds' || key === 'weather') want[key] = on; else want.eo = on ? key : (want.eo === key ? null : want.eo);
    // Only one earth-observation layer at a time: hide the others.
    for (const k of ['fires', 'vegetation', 'nightLights']) if (layers[k]) layers[k].show = want.eo === k;
    const have = layers[key];
    if (have) have.show = on;
    if (!on) { onLayer?.(key, { status: 'off' }); aborters[key]?.abort(); layers[`${key}Pending`] = false; }
    if (on && !have && !layers[`${key}Pending`]) {
      layers[`${key}Pending`] = true;
      onLayer?.(key, { status: 'loading', error: null });
      const ctlr = aborters[key] = new AbortController();
      resolveOverlay(key, ctlr.signal).then((found) => {
        layers[`${key}Pending`] = false;
        if (widget.isDestroyed() || ctlr.signal.aborted) return;
        if (!found) { onLayer?.(key, { status: 'error', error: 'Unavailable: NASA GIBS did not return this layer for any recent date.', off: true }); return; }
        const o = OVERLAYS[key];
        const p = new UrlTemplateImageryProvider({ url: gibsUrl(found.id, found.level, found.ext, found.time), maximumLevel: found.level, credit: new Credit(GIBS_CREDIT) });
        armRetry(p, stats);
        const layer = widget.imageryLayers.addImageryProvider(p);
        layer.alpha = o.alpha;
        if (key === 'clouds') { layer.brightness = 1.05; layer.contrast = 1.15; }
        layers[key] = layer;
        layer.show = overlayWanted(key);                       // the user may have switched it off while it was loading
        if (layers.labels) widget.imageryLayers.raiseToTop(layers.labels);
        onLayer?.(key, { status: 'on', time: found.time, id: found.id });
        scene.requestRender();
      });
    }
    scene.requestRender();
  }

  /* ── public camera actions ── */
  async function flyToPlace(lat, lon, range, pitchDeg = -42) {
    let ground = 0;
    try {
      const tp = globe.terrainProvider;
      if (!(tp instanceof EllipsoidTerrainProvider)) {
        const [c] = await Promise.race([sampleTerrain(tp, 11, [Cartographic.fromDegrees(lon, lat)]), new Promise((_, r) => setTimeout(r, 1500))]);
        ground = Number.isFinite(c?.height) ? c.height : 0;
      }
    } catch { /* fall back to sea level */ }
    camera.flyToBoundingSphere(new BoundingSphere(Cartesian3.fromDegrees(lon, lat, ground), 0), { offset: new HeadingPitchRange(0, CMath.toRadians(pitchDeg), range), duration: dur(2.6) });
  }
  const api = {
    widget, scene, camera, live, layers, want, stats,
    info: () => ({ webgl2: !!scene.context.webgl2, maxTexture: ContextLimits.maximumTextureSize, msaa: scene.msaaSamples, ratio: dpr * widget.resolutionScale, quality: live.get().quality }),
    setSatellite, setLabels, setDayNight, setTerrain, setBuildings, setOverlay, flyToPlace, setMarkers, markerCount,
    view() {
      const p = camera.pickEllipsoid(screenCentre(), globe.ellipsoid), g = p && Cartographic.fromCartesian(p);
      return { ...live.get(), centre: g ? { lat: CMath.toDegrees(g.latitude), lon: CMath.toDegrees(g.longitude) } : null, want: { ...want }, sun: subsolarPoint() };
    },
    flyTo: (lat, lon, h) => fly({ destination: Cartesian3.fromDegrees(lon, lat, h) }),
    flyToRectangle: (w, s, e, n) => fly({ destination: Rectangle.fromDegrees(w, s, e, n) }),
    home() { const h = homeView(); fly({ destination: Cartesian3.fromDegrees(h.lon, h.lat, h.height), orientation: { heading: 0, pitch: -CMath.PI_OVER_TWO, roll: 0 } }); },
    zoom(factor) {
      if (orbitCentre({ rangeFactor: factor, duration: dur(0.6) })) return;
      const c = camera.positionCartographic;
      fly({ destination: Cartesian3.fromRadians(c.longitude, c.latitude, Math.max(60, Math.min(40000000, c.height * factor))), orientation: { heading: camera.heading, pitch: camera.pitch, roll: 0 }, duration: dur(0.6) });
    },
    tilt(toFlat) { orbitCentre({ pitch: CMath.toRadians(toFlat ? -90 : -45), duration: dur(1.1) }); },
    northUp() { orbitCentre({ heading: 0, duration: dur(0.8) }); },
    destroy() {
      clearInterval(sunTimer); clearTimeout(metaTimer); cancelAnimationFrame(raf);
      removeEventListener('resize', onResize);
      canvas.removeEventListener('webglcontextlost', lost);
      offChanged(); offLoad(); offStart(); offEnd(); offRenderError(); offPost();
      Object.values(aborters).forEach((a) => a.abort());
      Object.keys(markerSets).forEach((k) => setMarkers(k, null));
      handler.destroy();
      if (!widget.isDestroyed()) widget.destroy();
    },
  };
  // ?debug exposes the globe to the test harness (camera placement, brightness checks, frozen clock).
  if (params.has('debug')) {
    window.__varnWidget = widget; window.__fromDeg = Cartesian3.fromDegrees; window.__engine = api; window.__grade = grade;
    window.__setTime = (iso) => { window.__freezeTime = true; widget.clock.currentTime = JulianDate.fromIso8601(iso); scene.requestRender(); };
  }
  applyLighting();
  return api;
}

export { TERRAIN };
