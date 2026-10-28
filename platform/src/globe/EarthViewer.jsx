import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  CesiumWidget, ImageryLayer, UrlTemplateImageryProvider, SingleTileImageryProvider, ArcGisMapServerImageryProvider,
  EllipsoidTerrainProvider, BoundingSphere, HeadingPitchRange, RequestScheduler, sampleTerrain,
  Cartesian2, Cartesian3, Cartographic, Color, Credit, Ion, JulianDate, Math as CMath, Rectangle,
  ScreenSpaceEventHandler, ScreenSpaceEventType, createWorldTerrainAsync, createGooglePhotorealistic3DTileset, GoogleMaps,
} from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import { Layers, Plus, Minus, Globe2, LocateFixed, Search, X, Copy, Loader2, Navigation2, Box } from 'lucide-react';
import { BASE, LABELS, TERRAIN, OVERLAYS, GIBS_CREDIT, UPGRADES, gibsUrl, resolveOverlay } from './sources.js';
import { createTerrain } from './terrain.js';
import { createHillshadeProvider } from './hillshadeLayer.js';
import { parseCoords, searchPlaces, searchGoogle, imageryMetadata } from './lookup.js';
import { subsolarPoint } from '../earth/sun.js';
import './globe.css';

Ion.defaultAccessToken = UPGRADES.ionToken;
if (UPGRADES.googleKey) GoogleMaps.defaultApiKey = UPGRADES.googleKey;
// Tile hosts that handle many parallel requests well; the default of 18 per host slows fast zooms.
Object.assign(RequestScheduler.requestsByServer, {
  'services.arcgisonline.com:443': 36, 's3.amazonaws.com:443': 24, 'gibs.earthdata.nasa.gov:443': 24,
});
const HAS_3D = !!(UPGRADES.googleKey || UPGRADES.ionToken);

const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const fmt = (v, pos, neg, d = 4) => `${Math.abs(v).toFixed(d)}°${v >= 0 ? pos : neg}`;
const fmtLat = (v, d) => fmt(v, 'N', 'S', d);
const fmtLon = (v, d) => fmt(v, 'E', 'W', d);
function fmtAlt(m) {
  if (m == null) return '—';
  if (m >= 100000) return `${Math.round(m / 1000).toLocaleString('en-US')} km`;
  if (m >= 1000) return `${(m / 1000).toFixed(1)} km`;
  return `${Math.round(m)} m`;
}
const cadenceTag = { daily: 'Daily', 'half-hourly': 'Every 30 min', '8-day composite': '8-day' };

/**
 * Move the camera around the point at the centre of the screen: change range, tilt or heading
 * while keeping that point centred. Returns false when the centre is off the globe.
 */
function orbitCentre(widget, { rangeFactor = 1, pitch, heading, duration = 1 }) {
  const { scene, camera } = widget;
  const centre = scene.globe.pick(camera.getPickRay(new Cartesian2(scene.canvas.clientWidth / 2, scene.canvas.clientHeight / 2)), scene);
  if (!centre) return false;
  const range = Math.max(80, Cartesian3.distance(camera.positionWC, centre) * rangeFactor);
  camera.flyToBoundingSphere(new BoundingSphere(centre, 0), {
    offset: new HeadingPitchRange(heading ?? camera.heading, pitch ?? camera.pitch, range), duration,
  });
  return true;
}

function homeView() {
  const sun = subsolarPoint();
  // West of the sun, so the day/night line crosses the visible disc.
  return { lon: sun.lon - 58, lat: 16, height: 21000000 };
}

export default function EarthViewer() {
  const host = useRef(null), creditsRef = useRef(null);
  const w = useRef(null);                       // { widget, layers: {...}, handler }
  const [fatal, setFatal] = useState(null);
  const [ui, setUi] = useState({ satellite: true, terrain: true, labels: false, daynight: true, clouds: false, weather: false, eo: null, buildings: HAS_3D });
  const [state, setState] = useState({});       // per-layer: { status, time, error }
  const [panel, setPanel] = useState(false);
  const [loading, setLoading] = useState(0);
  const [cam, setCam] = useState({ height: null, heading: 0, pitch: -90 });
  const [cursor, setCursor] = useState(null);
  const [meta, setMeta] = useState(null);
  const [pick, setPick] = useState(null);
  const [q, setQ] = useState('');
  const [results, setResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [notice, setNotice] = useState('');
  const uiRef = useRef(ui); uiRef.current = ui;
  const setLayerState = useCallback((k, v) => setState((s) => ({ ...s, [k]: { ...s[k], ...v } })), []);
  const flash = useCallback((m) => { setNotice(m); setTimeout(() => setNotice((x) => (x === m ? '' : x)), 5000); }, []);

  /* ── create the globe ── */
  useEffect(() => {
    let widget;
    try {
      widget = new CesiumWidget(host.current, {
        baseLayer: false,
        terrainProvider: new EllipsoidTerrainProvider(),
        creditContainer: creditsRef.current,
        requestRenderMode: true, maximumRenderTimeChange: Infinity,
        // Full device resolution: rendering at CSS pixels made imagery soft on Retina and 4K screens.
        useBrowserRecommendedResolution: false,
        msaaSamples: 4,
        shouldAnimate: false,
      });
    } catch (err) {
      setFatal(`This browser could not start the 3D globe (${err?.message || 'WebGL unavailable'}).`);
      return undefined;
    }
    const { scene } = widget;
    const globe = scene.globe;
    scene.backgroundColor = Color.fromCssColorString('#05070a');
    globe.baseColor = Color.fromCssColorString('#0b1622');
    globe.showGroundAtmosphere = true;
    globe.dynamicAtmosphereLighting = true;
    globe.dynamicAtmosphereLightingFromSun = true;
    globe.depthTestAgainstTerrain = true;
    // Sharper tiles sooner: finer detail target, a bigger cache, neighbours preloaded.
    widget.resolutionScale = Math.min(1, 2 / (devicePixelRatio || 1));
    globe.maximumScreenSpaceError = 1.33;
    globe.tileCacheSize = 1000;
    globe.preloadAncestors = true;
    globe.preloadSiblings = true;
    globe.loadingDescendantLimit = 40;
    scene.postProcessStages.fxaa.enabled = true;
    scene.skyAtmosphere.show = true;
    // No star field: the brief asks for a near-black sky, and photos from orbit show none.
    if (scene.skyBox) scene.skyBox.show = false;
    if (scene.sun) scene.sun.show = false;
    if (scene.moon) scene.moon.show = false;
    scene.fog.enabled = true;
    scene.highDynamicRange = false;
    const ctl = scene.screenSpaceCameraController;
    ctl.minimumZoomDistance = 30;
    ctl.maximumZoomDistance = 60000000;
    // A longer glide after a flick or scroll, closer to how Google Earth moves.
    ctl.inertiaSpin = 0.93; ctl.inertiaTranslate = 0.93; ctl.inertiaZoom = 0.86;
    ctl.enableCollisionDetection = true;
    scene.fog.density = 2.4e-4;
    widget.clock.currentTime = JulianDate.now();

    const layers = {};
    // Always-present fallback: NASA Blue Marble, bundled with the site, so the planet is never blank.
    SingleTileImageryProvider.fromUrl(BASE.blueMarble.url, { credit: new Credit(BASE.blueMarble.credit) })
      .then((p) => { if (!widget.isDestroyed()) { layers.fallback = widget.imageryLayers.addImageryProvider(p, 0); scene.requestRender(); } })
      .catch(() => {});

    const home = homeView();
    widget.camera.setView({ destination: Cartesian3.fromDegrees(home.lon, home.lat, home.height) });

    // Loading indicator from the tile queue.
    // Request-render mode only repaints on demand, so repaint whenever the tile queue changes:
    // otherwise the last sharp tiles can arrive after the final frame and the view stays soft.
    const offLoad = globe.tileLoadProgressEvent.addEventListener((n) => { setLoading(n); scene.requestRender(); });
    // Camera readout and imagery date at the view centre.
    let metaCtl = null, metaTimer = 0;
    const readCamera = () => {
      const c = widget.camera.positionCartographic;
      // Sun-driven haze and fog only from orbit; near the ground they would darken the imagery
      // to night colours wherever it is evening, just as the shading eases off there.
      const orbital = uiRef.current.daynight && c.height > 1.5e6;
      if (globe.dynamicAtmosphereLighting !== orbital) { globe.dynamicAtmosphereLighting = orbital; scene.requestRender(); }
      // The city-lights layer is opaque black between the lights. Cesium shows it wherever the sun
      // is down, at any distance, so close up it would hide the imagery at night. Orbit only.
      if (layers.night && layers.night.show !== orbital) { layers.night.show = orbital; scene.requestRender(); }
      setCam({ height: c.height, lat: CMath.toDegrees(c.latitude), lon: CMath.toDegrees(c.longitude),
        heading: CMath.toDegrees(widget.camera.heading), pitch: CMath.toDegrees(widget.camera.pitch) });
    };
    widget.camera.percentageChanged = 0.02;
    const offChanged = widget.camera.changed.addEventListener(readCamera);
    // The location popover is pinned to a screen point, so close it once the view moves.
    const offStart = widget.camera.moveStart.addEventListener(() => setPick(null));
    let diving = false, autoTilted = false;
    const offEnd = widget.camera.moveEnd.addEventListener(() => {
      readCamera();
      // Like Google Earth: diving in with the scroll wheel eases the view toward the horizon once,
      // close to the ground, so terrain and the skyline read in 3D.
      const h = widget.camera.positionCartographic.height;
      if (h > 60000) autoTilted = false;
      if (!autoTilted && diving && h < 9000 && h > 200 && CMath.toDegrees(widget.camera.pitch) < -78 && !reduceMotion()) {
        autoTilted = true; diving = false;
        orbitCentre(widget, { pitch: CMath.toRadians(-52), duration: 1.4 });
      }
      clearTimeout(metaTimer);
      metaTimer = setTimeout(() => {
        const c = widget.camera.positionCartographic;
        if (c.height > 400000) { setMeta(null); return; }
        const centre = scene.globe.pick(widget.camera.getPickRay(new Cartesian2(scene.canvas.clientWidth / 2, scene.canvas.clientHeight / 2)), scene);
        if (!centre) return;
        const g = Cartographic.fromCartesian(centre);
        metaCtl?.abort(); metaCtl = new AbortController();
        imageryMetadata(CMath.toDegrees(g.latitude), CMath.toDegrees(g.longitude), metaCtl.signal)
          .then((m) => setMeta(m ? { ...m, ok: true } : { ok: false }))
          .catch((e) => { if (e.name !== 'AbortError') setMeta({ ok: false }); });
      }, 450);
    });
    readCamera();

    // Cursor coordinates (hidden off the globe) and click-to-inspect.
    const handler = new ScreenSpaceEventHandler(scene.canvas);
    let raf = 0, last = null;
    handler.setInputAction((m) => {
      last = m.endPosition;
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const p = widget.camera.pickEllipsoid(last, globe.ellipsoid);
        if (!p) { setCursor(null); return; }
        const g = Cartographic.fromCartesian(p);
        setCursor({ lat: CMath.toDegrees(g.latitude), lon: CMath.toDegrees(g.longitude) });
      });
    }, ScreenSpaceEventType.MOUSE_MOVE);
    handler.setInputAction((delta) => { diving = delta > 0; }, ScreenSpaceEventType.WHEEL);
    handler.setInputAction((c) => {
      const p = globe.pick(widget.camera.getPickRay(c.position), scene);
      if (!p) { setPick(null); return; }
      const g = Cartographic.fromCartesian(p);
      setPick({ lat: CMath.toDegrees(g.latitude), lon: CMath.toDegrees(g.longitude), height: g.height, x: c.position.x, y: c.position.y, meta: 'loading' });
    }, ScreenSpaceEventType.LEFT_CLICK);

    // Keep the sun current: re-light once a minute.
    const sunTimer = setInterval(() => { widget.clock.currentTime = JulianDate.now(); scene.requestRender(); }, 60000);
    // Re-render while tiles are still arriving (request-render mode otherwise sleeps).
    const onResize = () => scene.requestRender();
    addEventListener('resize', onResize);

    const layersRef = layers;
    w.current = { widget, layers, handler };
    if (import.meta.env.DEV || new URLSearchParams(location.search).has("debug")) window.__varnWidget = widget;
    return () => {
      clearInterval(sunTimer); clearTimeout(metaTimer); metaCtl?.abort(); cancelAnimationFrame(raf);
      removeEventListener('resize', onResize);
      offLoad(); offChanged(); offStart(); offEnd();
      handler.destroy();
      layersRef.hillProvider?.destroyWorkers?.();
      widget.destroy();
      w.current = null;
    };
  }, []);

  /* ── base imagery, labels, day/night, terrain ── */
  useEffect(() => {
    const ctx = w.current; if (!ctx) return;
    const { widget, layers } = ctx;
    if (ui.satellite && !layers.esri) {
      setLayerState('satellite', { status: 'loading' });
      // Cesium's ArcGIS provider reads the service's real zoom levels (to 23) and discards Esri's
      // "map data not yet available" placeholder tiles, so the sharpest real tile stays on screen.
      // If the service description can't be read, plain tiles are used instead.
      const fallback = () => new UrlTemplateImageryProvider({ url: BASE.esri.url, maximumLevel: BASE.esri.maximumLevel, credit: new Credit(BASE.esri.credit) });
      const layer = ImageryLayer.fromProviderAsync(
        ArcGisMapServerImageryProvider.fromUrl(BASE.esri.service, { token: BASE.esri.token, enablePickFeatures: false, maximumLevel: BASE.esri.maximumLevel })
          .catch(() => fallback()),
      );
      layers.esri = widget.imageryLayers.add(layer, layers.fallback ? 1 : 0);
      // Confirm with one real tile rather than assuming success.
      fetch(BASE.esri.url.replace('{z}', '1').replace('{y}', '0').replace('{x}', '0'))
        .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); setLayerState('satellite', { status: 'on' }); })
        .catch((e) => setLayerState('satellite', { status: 'error', error: `Esri World Imagery unavailable (${e.message}); showing NASA Blue Marble.` }));
    }
    if (layers.esri) layers.esri.show = ui.satellite;
    if (!ui.satellite) setLayerState('satellite', { status: 'off' });

    if (ui.labels && !layers.labels) {
      const p = new UrlTemplateImageryProvider({ url: LABELS.url, maximumLevel: LABELS.maximumLevel, credit: new Credit(LABELS.credit) });
      layers.labels = widget.imageryLayers.addImageryProvider(p);
    }
    if (layers.labels) { layers.labels.show = ui.labels; widget.imageryLayers.raiseToTop(layers.labels); }

    const g = widget.scene.globe;
    g.enableLighting = ui.daynight;
    g.dynamicAtmosphereLighting = ui.daynight && widget.camera.positionCartographic.height > 1.5e6;
    // The real terminator and city lights show from orbit; close to the ground (under ~1,500 km)
    // shading eases off so imagery stays readable at any hour. Distances are from Earth's centre.
    const R = 6371000;
    g.lightingFadeOutDistance = R + 1.5e6;
    g.lightingFadeInDistance = R + 5e6;
    // The ground atmosphere would also paint the night side black from afar, hiding the city
    // lights; keep its night darkening out of range so the shading alone defines night.
    g.nightFadeOutDistance = 1e10;
    g.nightFadeInDistance = 2e10;
    if (ui.daynight && !layers.night) {
      SingleTileImageryProvider.fromUrl('/earth/night-lights-warm-2k.webp', { credit: new Credit('City lights: NASA Earth at Night (public domain)') }).then((p) => {
        if (widget.isDestroyed() || layers.night) return;
        layers.night = widget.imageryLayers.addImageryProvider(p);
        layers.night.dayAlpha = 0; layers.night.nightAlpha = 1; layers.night.brightness = 2.6; layers.night.gamma = 0.8;
        layers.night.show = widget.camera.positionCartographic.height > 1.5e6;
        window.__varnNight = true;
        if (layers.labels) widget.imageryLayers.raiseToTop(layers.labels);
        widget.scene.requestRender();
      }).catch(() => {});
    }
    if (layers.night) layers.night.show = ui.daynight && widget.camera.positionCartographic.height > 1.5e6;

    if (ui.terrain !== ctx.terrainOn) {
      ctx.terrainOn = ui.terrain;
      const aws = () => createTerrain({ onError: () => setLayerState('terrain', { status: 'error', error: 'Elevation tiles are not loading; the surface may look flat.' }) });
      if (!ui.terrain) widget.scene.globe.terrainProvider = new EllipsoidTerrainProvider();
      else if (UPGRADES.ionToken) {
        // With a Cesium ion token: Cesium World Terrain, with normals for sun shading and a water mask.
        widget.scene.globe.terrainProvider = aws();
        createWorldTerrainAsync({ requestVertexNormals: true, requestWaterMask: true })
          .then((t) => { if (!widget.isDestroyed() && uiRef.current.terrain) { widget.scene.globe.terrainProvider = t; widget.scene.requestRender(); } })
          .catch(() => {});
      } else widget.scene.globe.terrainProvider = aws();
      setLayerState('terrain', { status: ui.terrain ? 'on' : 'off', error: null });
    }
    // Relief shading from the same elevation data: what makes mountains look solid under the imagery.
    if (ui.terrain && !layers.hill) {
      const hp = createHillshadeProvider();
      layers.hillProvider = hp;
      layers.hill = widget.imageryLayers.add(new ImageryLayer(hp), layers.esri ? widget.imageryLayers.indexOf(layers.esri) + 1 : undefined);
    }
    if (layers.hill) layers.hill.show = ui.terrain;
    widget.scene.requestRender();
  }, [ui.satellite, ui.labels, ui.daynight, ui.terrain, setLayerState]);

  /* ── Photorealistic 3D buildings and terrain (only with a configured key; see README) ── */
  useEffect(() => {
    const ctx = w.current; if (!ctx || !HAS_3D) return;
    const { widget, layers } = ctx;
    if (ui.buildings && !layers.tiles && !layers.tilesPending) {
      layers.tilesPending = true;
      setLayerState('buildings', { status: 'loading', error: null });
      createGooglePhotorealistic3DTileset({ key: UPGRADES.googleKey || undefined, onlyUsingWithGoogleGeocoder: !!UPGRADES.googleKey }, { maximumScreenSpaceError: 12 })
        .then((ts) => {
          if (widget.isDestroyed()) return;
          layers.tiles = widget.scene.primitives.add(ts);
          ts.show = uiRef.current.buildings;
          widget.scene.globe.show = !ts.show;       // the tiles carry their own imagery and terrain
          setLayerState('buildings', { status: 'on' });
          widget.scene.requestRender();
        })
        .catch((e) => { setLayerState('buildings', { status: 'error', error: `3D tiles unavailable (${e.message || e})` }); setUi((u) => ({ ...u, buildings: false })); })
        .finally(() => { layers.tilesPending = false; });
    }
    if (layers.tiles) { layers.tiles.show = ui.buildings; widget.scene.globe.show = !ui.buildings; }
    widget.scene.requestRender();
  }, [ui.buildings, setLayerState]);

  /* ── NASA GIBS overlays (clouds, weather, one earth-observation layer) ── */
  useEffect(() => {
    const ctx = w.current; if (!ctx) return undefined;
    const { widget, layers } = ctx;
    const wanted = { clouds: ui.clouds, weather: ui.weather, fires: ui.eo === 'fires', vegetation: ui.eo === 'vegetation', nightLights: ui.eo === 'nightLights' };
    const ctl = new AbortController();
    for (const [key, on] of Object.entries(wanted)) {
      const have = layers[key];
      if (have) have.show = on;
      if (on && !have && !layers[`${key}Pending`]) {
        layers[`${key}Pending`] = true;
        setLayerState(key, { status: 'loading', error: null });
        resolveOverlay(key, ctl.signal).then((found) => {
          layers[`${key}Pending`] = false;
          if (widget.isDestroyed()) return;
          if (!found) {
            // Switch it back off so the panel never shows an unavailable layer as active.
            setLayerState(key, { status: 'error', error: 'Unavailable: NASA GIBS did not return this layer for any recent date.' });
            setUi((u) => (key === 'clouds' || key === 'weather' ? { ...u, [key]: false } : u.eo === key ? { ...u, eo: null } : u));
            return;
          }
          const o = OVERLAYS[key];
          const p = new UrlTemplateImageryProvider({ url: gibsUrl(found.id, found.level, found.ext, found.time), maximumLevel: found.level, credit: new Credit(GIBS_CREDIT) });
          const layer = widget.imageryLayers.addImageryProvider(p);
          layer.alpha = o.alpha;
          if (key === 'clouds') { layer.brightness = 1.05; layer.contrast = 1.15; }
          layers[key] = layer;
          const u = uiRef.current;     // the user may have switched it off while it was loading
          layer.show = { clouds: u.clouds, weather: u.weather }[key] ?? u.eo === key;
          if (layers.labels) widget.imageryLayers.raiseToTop(layers.labels);
          setLayerState(key, { status: 'on', time: found.time, id: found.id });
          widget.scene.requestRender();
        });
      }
      if (!on && have) setLayerState(key, { status: 'off' });
    }
    widget.scene.requestRender();
    return () => ctl.abort();
  }, [ui.clouds, ui.weather, ui.eo, setLayerState]);

  /* ── click inspector: imagery date at the point ── */
  useEffect(() => {
    if (!pick || pick.meta !== 'loading') return undefined;
    const ctl = new AbortController();
    imageryMetadata(pick.lat, pick.lon, ctl.signal)
      .then((m) => setPick((p) => (p && p.lat === pick.lat ? { ...p, meta: m || 'none' } : p)))
      .catch((e) => { if (e.name !== 'AbortError') setPick((p) => (p && p.lat === pick.lat ? { ...p, meta: 'error' } : p)); });
    return () => ctl.abort();
  }, [pick]);

  /* ── camera helpers ── */
  const fly = useCallback((opts) => {
    const ctx = w.current; if (!ctx) return;
    ctx.widget.camera.flyTo({ duration: reduceMotion() ? 0 : 2.2, ...opts });
  }, []);
  const flyTo = useCallback((lat, lon, height) => fly({ destination: Cartesian3.fromDegrees(lon, lat, height) }), [fly]);
  /** Arrive like Google Earth: centred on the place, looking in at an angle, clear of terrain. */
  const flyToPlace = useCallback(async (lat, lon, range, pitchDeg = -42) => {
    const ctx = w.current; if (!ctx) return;
    const { widget } = ctx;
    let ground = 0;
    try {
      const tp = widget.scene.globe.terrainProvider;
      if (!(tp instanceof EllipsoidTerrainProvider)) {
        const [c] = await Promise.race([sampleTerrain(tp, 11, [Cartographic.fromDegrees(lon, lat)]), new Promise((_, r) => setTimeout(r, 1500))]);
        ground = Number.isFinite(c?.height) ? c.height : 0;
      }
    } catch { /* fall back to sea level */ }
    widget.camera.flyToBoundingSphere(new BoundingSphere(Cartesian3.fromDegrees(lon, lat, ground), 0), {
      offset: new HeadingPitchRange(0, CMath.toRadians(pitchDeg), range), duration: reduceMotion() ? 0 : 2.6,
    });
  }, []);
  const zoom = (factor) => {
    const ctx = w.current; if (!ctx) return;
    const { widget } = ctx;
    if (!orbitCentre(widget, { rangeFactor: factor, duration: reduceMotion() ? 0 : 0.6 })) {
      const c = widget.camera.positionCartographic;
      const h = Math.max(60, Math.min(40000000, c.height * factor));
      fly({ destination: Cartesian3.fromRadians(c.longitude, c.latitude, h), orientation: { heading: widget.camera.heading, pitch: widget.camera.pitch, roll: 0 }, duration: reduceMotion() ? 0 : 0.6 });
    }
  };
  const tilted = cam.pitch > -75;
  const toggleTilt = () => { const ctx = w.current; if (ctx) orbitCentre(ctx.widget, { pitch: CMath.toRadians(tilted ? -90 : -45), duration: reduceMotion() ? 0 : 1.1 }); };
  const northUp = () => { const ctx = w.current; if (ctx) orbitCentre(ctx.widget, { heading: 0, duration: reduceMotion() ? 0 : 0.8 }); };
  const goHome = () => { const h = homeView(); setPick(null); flyTo(h.lat, h.lon, h.height); };
  const locate = () => {
    if (!navigator.geolocation) { flash('This browser cannot share its location.'); return; }
    navigator.geolocation.getCurrentPosition(
      (p) => flyToPlace(p.coords.latitude, p.coords.longitude, 3500),
      (e) => flash(e.code === 1 ? 'Location permission was declined.' : 'Your location could not be determined.'),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 },
    );
  };

  const submitSearch = async (e) => {
    e.preventDefault();
    const text = q.trim(); if (!text) return;
    const c = parseCoords(text);
    if (c) { setResults(null); flyToPlace(c.lat, c.lon, 5000); return; }
    setSearching(true); setResults(null);
    try {
      const rows = UPGRADES.googleKey ? await searchGoogle(text, UPGRADES.googleKey) : await searchPlaces(text);
      setResults(rows);
      if (rows.length === 1) choose(rows[0]);
    } catch (err) { setResults([]); flash(`Search failed: ${err.message}`); }
    finally { setSearching(false); }
  };
  const choose = (r) => {
    setResults(null); setQ(r.name.split(',')[0]);
    // Size the view from the place's extent: countries top-down, cities and smaller at an angle.
    const [s, n, wv, ev] = r.bbox || [r.lat, r.lat, r.lon, r.lon];
    const km = Math.hypot((n - s) * 111, (ev - wv) * 111 * Math.cos(CMath.toRadians(r.lat)));
    if (km > 600) fly({ destination: Rectangle.fromDegrees(wv, s, ev, n) });
    else flyToPlace(r.lat, r.lon, Math.max(1800, km * 1000 * 1.25), km > 60 ? -60 : -40);
  };

  useEffect(() => {
    const onKey = (e) => {
      if (e.target.closest('input, textarea, select')) { if (e.key === 'Escape') e.target.blur(); return; }
      if (e.key === '/') { e.preventDefault(); document.getElementById('earth-search')?.focus(); }
      else if (e.key === 'Escape') { setPick(null); setPanel(false); setResults(null); }
      else if (e.key === 'h') goHome();
      else if (e.key === 'l') setPanel((v) => !v);
    };
    addEventListener('keydown', onKey); return () => removeEventListener('keydown', onKey);
  });

  /* ── status line ── */
  const sat = state.satellite || {};
  const activeOverlays = Object.keys(OVERLAYS).filter((k) => state[k]?.status === 'on' && (k === 'clouds' ? ui.clouds : k === 'weather' ? ui.weather : ui.eo === k));
  let source;
  if (!ui.satellite || sat.status === 'error') source = <><b>{BASE.blueMarble.name}</b> · static composite, ~10 km</>;
  else if (cam.height != null && cam.height > 400000) source = <><b>{BASE.esri.name}</b> · periodic basemap mosaic, many capture dates</>;
  else if (meta?.ok) source = <><b>{BASE.esri.name}</b> · captured {meta.date || 'date not reported'}{meta.res ? ` · ${meta.res} m` : ''}{meta.source ? ` · ${meta.source}` : ''}</>;
  else source = <><b>{BASE.esri.name}</b> · periodic basemap{meta && !meta.ok ? ' · capture date unavailable here' : ''}</>;

  if (fatal) return <div className="earth earth-fatal"><p>{fatal}</p></div>;

  return <div className="earth">
    <div ref={host} className="earth-canvas" />

    <header className="e-top">
      <a className="e-mark" href="#" aria-label="VARN" onClick={(e) => { e.preventDefault(); goHome(); }}>
        <svg viewBox="0 0 42 42" aria-hidden="true"><path d="M7 31 17.2 9h7.5L35 31h-8.1l-6-13.1L14.8 31Z" fill="currentColor"/><path d="M17.2 25.2h9.1l2.2 5.8H14.8Z" fill="#05070a"/></svg>
        <span>VARN</span>
      </a>
      <form className="e-search glassy" onSubmit={submitSearch} role="search">
        <Search size={15} aria-hidden="true"/>
        <input id="earth-search" value={q} onChange={(e) => { setQ(e.target.value); if (!e.target.value) setResults(null); }}
          placeholder="Search a place, address or lat, lon" aria-label="Search places or coordinates" autoComplete="off"/>
        {searching ? <Loader2 size={15} className="spin"/> : q && <button type="button" className="e-clear" onClick={() => { setQ(''); setResults(null); }} aria-label="Clear search"><X size={14}/></button>}
        {results && <ul className="e-results" role="listbox">
          {results.length ? results.map((r, i) => <li key={i}><button type="button" onClick={() => choose(r)}><strong>{r.name.split(',')[0]}</strong><small>{r.name.split(',').slice(1).join(',').trim() || r.type}</small></button></li>)
            : <li className="e-none">No places found.</li>}
          <li className="e-attrib">{UPGRADES.googleKey ? 'Search: Google Geocoding' : 'Search © OpenStreetMap contributors (Nominatim)'}</li>
        </ul>}
      </form>
    </header>

    <div className="e-controls" role="group" aria-label="Map controls">
      <button className={`e-btn ${panel ? 'on' : ''}`} onClick={() => setPanel((v) => !v)} aria-expanded={panel} aria-controls="e-layers" title="Layers (L)"><Layers size={17}/></button>
      <span className="e-gap"/>
      <button className="e-btn" onClick={() => zoom(0.45)} title="Zoom in" aria-label="Zoom in"><Plus size={17}/></button>
      <button className="e-btn" onClick={() => zoom(2.2)} title="Zoom out" aria-label="Zoom out"><Minus size={17}/></button>
      <button className={`e-btn ${tilted ? 'on' : ''}`} onClick={toggleTilt} title={tilted ? 'Top-down view' : 'Tilt to 3D'} aria-pressed={tilted} aria-label="Toggle 3D tilt"><Box size={17}/></button>
      <button className="e-btn e-compass" onClick={northUp} title="North up" aria-label={`Heading ${Math.round((cam.heading + 360) % 360)} degrees; reset to north`}>
        <Navigation2 size={16} style={{ transform: `rotate(${-cam.heading}deg)` }}/></button>
      <button className="e-btn" onClick={goHome} title="Whole Earth (H)" aria-label="Return to whole Earth"><Globe2 size={17}/></button>
      <button className="e-btn" onClick={locate} title="My location" aria-label="Fly to my location"><LocateFixed size={17}/></button>
    </div>

    {panel && <section id="e-layers" className="e-layers glassy" aria-label="Layers">
      <header><h2>Layers</h2><button className="e-x" onClick={() => setPanel(false)} aria-label="Close layers"><X size={14}/></button></header>
      <Row label="Satellite" sub={sat.status === 'error' ? sat.error : 'Esri World Imagery · basemap, updated periodically'} tag="Basemap" on={ui.satellite} st={sat.status} onToggle={() => setUi((u) => ({ ...u, satellite: !u.satellite }))}/>
      <Row label="Terrain" sub={state.terrain?.error || `${TERRAIN.name} · elevation ${TERRAIN.resolution}`} tag="Static" on={ui.terrain} st={state.terrain?.status} onToggle={() => setUi((u) => ({ ...u, terrain: !u.terrain }))}/>
      <Row label="Labels" sub="Countries, borders, cities and places · Esri" tag="Basemap" on={ui.labels} onToggle={() => setUi((u) => ({ ...u, labels: !u.labels }))}/>
      <Row label="Day / night" sub="Real sun position now, shown from orbit · city lights: NASA" tag="Live" on={ui.daynight} onToggle={() => setUi((u) => ({ ...u, daynight: !u.daynight }))}/>
      <Row label="3D buildings" tag="Key needed" disabled={!HAS_3D} on={ui.buildings} st={state.buildings?.status}
        sub={!HAS_3D ? 'Photorealistic 3D cities need a Google Maps Platform key or Cesium ion token. Not configured.'
          : state.buildings?.error || `Google Photorealistic 3D Tiles${UPGRADES.googleKey ? '' : ' via Cesium ion'} · replaces the flat imagery while on`}
        onToggle={() => setUi((u) => ({ ...u, buildings: !u.buildings }))}/>
      <OverlayRow k="clouds" on={ui.clouds} st={state.clouds} onToggle={() => setUi((u) => ({ ...u, clouds: !u.clouds }))}/>
      <OverlayRow k="weather" on={ui.weather} st={state.weather} onToggle={() => setUi((u) => ({ ...u, weather: !u.weather }))}/>
      <div className="e-sub">Earth observation</div>
      {['fires', 'vegetation', 'nightLights'].map((k) => <OverlayRow key={k} k={k} on={ui.eo === k} st={state[k]} radio
        onToggle={() => setUi((u) => ({ ...u, eo: u.eo === k ? null : k }))}/>)}
      <p className="e-note">Basemaps are mosaics of images captured at different times; daily and half-hourly layers show the time of the data shown. Nothing here is live video.</p>
    </section>}

    {pick && <div className="e-pop glassy" style={{ left: Math.min(pick.x + 14, innerWidth - 300), top: Math.min(pick.y + 14, innerHeight - 200) }} role="dialog" aria-label="Location">
      <header><strong>Location</strong><button className="e-x" onClick={() => setPick(null)} aria-label="Close"><X size={13}/></button></header>
      <dl>
        <div><dt>Latitude</dt><dd>{fmtLat(pick.lat, 6)}</dd></div>
        <div><dt>Longitude</dt><dd>{fmtLon(pick.lon, 6)}</dd></div>
        {ui.terrain && <div><dt>Elevation</dt><dd>{Math.round(pick.height)} m <small>(terrain model)</small></dd></div>}
        {ui.satellite && <div><dt>Imagery</dt><dd>{pick.meta === 'loading' ? 'Checking capture date…' : pick.meta === 'error' || pick.meta === 'none' ? 'Capture date not available' : <>{pick.meta.date || 'date n/a'}{pick.meta.res ? ` · ${pick.meta.res} m` : ''}{pick.meta.source ? ` · ${pick.meta.source}` : ''}</>}</dd></div>}
      </dl>
      <button className="e-copy" onClick={() => { navigator.clipboard?.writeText(`${pick.lat.toFixed(6)}, ${pick.lon.toFixed(6)}`).then(() => flash('Coordinates copied'), () => flash('Clipboard blocked by the browser')); }}><Copy size={12}/>Copy coordinates</button>
    </div>}

    <footer className="e-status">
      <p className="e-source">{source}</p>
      {activeOverlays.map((k) => <p key={k} className="e-source">{OVERLAYS[k].name} · NASA GIBS · {state[k].time.length > 10 ? state[k].time.replace('T', ' ').replace('Z', ' UTC') : state[k].time} · {cadenceTag[OVERLAYS[k].cadence] || OVERLAYS[k].cadence}</p>)}
      <p className="e-meta">
        {loading > 0 ? <span className="e-loading"><Loader2 size={11} className="spin"/>Loading imagery · {loading} tile{loading === 1 ? '' : 's'}</span> : <span>Imagery loaded</span>}
        <i/>Altitude {fmtAlt(cam.height)}
        {cursor && <><i/>{fmtLat(cursor.lat, 4)} {fmtLon(cursor.lon, 4)}</>}
      </p>
      <div ref={creditsRef} className="e-credits"/>
    </footer>

    {notice && <div className="e-toast" role="status">{notice}</div>}
  </div>;
}

function Row({ label, sub, tag, on, st, onToggle, radio, disabled }) {
  return <button className={`e-row ${on ? 'on' : ''} ${disabled ? 'off' : ''}`} role={radio ? 'radio' : 'switch'} aria-checked={on} aria-disabled={disabled || undefined} onClick={disabled ? undefined : onToggle}>
    <span className={`e-sw ${radio ? 'radio' : ''}`} aria-hidden="true"/>
    <span className="e-row-main"><strong>{label}{tag && <em>{tag}</em>}</strong><small className={st === 'error' ? 'err' : ''}>{sub}</small></span>
    {on && st === 'loading' && <Loader2 size={13} className="spin"/>}
  </button>;
}

function OverlayRow({ k, on, st = {}, onToggle, radio }) {
  const o = OVERLAYS[k];
  const when = st.time ? (st.time.length > 10 ? st.time.replace('T', ' ').replace('Z', ' UTC') : st.time) : null;
  const sub = st.status === 'error' && !on ? st.error : st.status === 'loading' ? 'Finding the latest available data…'
    : `${o.name} · NASA GIBS · ${o.resolution}${when ? ` · ${when}` : ''}`;
  return <Row label={o.label} sub={sub} tag={cadenceTag[o.cadence] || o.cadence} on={on} st={on ? st.status : undefined} onToggle={onToggle} radio={radio}/>;
}
