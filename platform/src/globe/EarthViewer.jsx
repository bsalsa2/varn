import React, { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Math as CMath } from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import { Layers, Plus, Minus, Globe2, LocateFixed, Search, X, Copy, Loader2, Navigation2, Box, RefreshCw, TriangleAlert, SquareTerminal } from 'lucide-react';
import { BASE, TERRAIN, OVERLAYS, UPGRADES } from './sources.js';
import { createEngine, reduceMotion } from './engine.js';
import { createLive } from './live.js';
import { parseCoords, searchPlaces, imageryMetadata, reversePlace } from './lookup.js';
import { placeFrom, sunState } from './inspect.js';
import { describeAge } from './freshness.js';
import { subsolarPoint } from '../earth/sun.js';
import { runChecks, summarize } from './diagnostics.js';
import * as feeds from './feeds.js';
import Terminal from './Terminal.jsx';
import './globe.css';

const fmt = (v, pos, neg, d = 4) => `${Math.abs(v).toFixed(d)}°${v >= 0 ? pos : neg}`;
const fmtLat = (v, d) => fmt(v, 'N', 'S', d);
const fmtLon = (v, d) => fmt(v, 'E', 'W', d);
function fmtAlt(m) {
  if (m == null) return '—';
  if (m >= 100000) return `${Math.round(m / 1000).toLocaleString('en-US')} km`;
  if (m >= 1000) return `${(m / 1000).toFixed(1)} km`;
  return `${Math.round(m)} m`;
}
// Tags describe how often the SOURCE produces data. How old the data on screen is gets its own line (describeAge).
const cadenceTag = { daily: 'Daily', 'half-hourly': '30-min data', '8-day composite': '8-day' };
const idle = createLive({ height: null, heading: 0, pitch: -90, loading: 0, cursor: null, quality: 'full', failed: 0 });
const when = (t) => (t.length > 10 ? t.replace('T', ' ').replace('Z', ' UTC') : t);

/** True only after `value` has been true for `ms`: keeps short loads from flickering an indicator. */
function useDelayed(value, ms) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (!value) { setOn(false); return undefined; }
    const t = setTimeout(() => setOn(true), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return on;
}

/** Subscribe to the engine's live store (updates at most ~8×/s). */
function useLive(engine) {
  const store = engine?.live ?? idle;
  return useSyncExternalStore(store.subscribe, store.get);
}

export default function EarthViewer() {
  const host = useRef(null), creditsRef = useRef(null);
  const [engine, setEngine] = useState(null);
  const [epoch, setEpoch] = useState(0);
  const [fatal, setFatal] = useState(null);
  const [ui, setUi] = useState({ satellite: true, terrain: true, labels: false, daynight: true, clouds: false, weather: false, eo: null, buildings: true });
  const [state, setState] = useState({});
  const [panel, setPanel] = useState(false);
  const [meta, setMeta] = useState(null);
  const [pick, setPick] = useState(null);
  const [q, setQ] = useState('');
  const [results, setResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [notice, setNotice] = useState('');
  const [checks, setChecks] = useState({ list: [], running: false, deep: false });
  const [term, setTerm] = useState(() => location.hash === '#terminal');
  const [markers, setMarkers] = useState({ quakes: 0, incidents: 0 });
  const engRef = useRef(null), stateRef = useRef({}), uiRef = useRef({}), pendingSelect = useRef(null);
  const live = useLive(engine);
  const slowLoad = useDelayed(live.loading > 0, 700);          // brief loads stay silent
  engRef.current = engine; stateRef.current = state; uiRef.current = ui;

  const flash = useCallback((m) => { setNotice(m); setTimeout(() => setNotice((x) => (x === m ? '' : x)), 5000); }, []);
  const layerState = useCallback((k, patch) => {
    setState((s) => ({ ...s, [k]: { ...s[k], ...patch } }));
    // A layer that turns out to be unavailable switches itself off, so the panel never shows it as active.
    if (patch.off) setUi((u) => (['clouds', 'weather', 'buildings', 'satellite'].includes(k) ? { ...u, [k]: false } : u.eo === k ? { ...u, eo: null } : u));
  }, []);

  /* ── start the globe (again, if the graphics context was lost) ── */
  useEffect(() => {
    let eng;
    try {
      eng = createEngine({
        host: host.current, credits: creditsRef.current,
        onLost: (why) => setFatal(why), onLayer: layerState,
        onPick: (p) => setPick(p), onMoveStart: () => setPick(null),
        onViewChange: (c) => {
          if (pendingSelect.current) { setPick({ ...pendingSelect.current, x: innerWidth * 0.58, y: innerHeight * 0.3 }); pendingSelect.current = null; }
          if (!c) { setMeta(null); return; }
          imageryMetadata(c.lat, c.lon).then((m) => setMeta(m ? { ...m, ok: true } : { ok: false })).catch(() => setMeta({ ok: false }));
        },
      });
    } catch (err) {
      setFatal(`This browser could not start the 3D globe (${err?.message || 'WebGL unavailable'}).`);
      return undefined;
    }
    setFatal(null);
    eng.setSatellite(true); eng.setTerrain(true); eng.setDayNight(true);
    eng.setBuildings(true);
    setEngine(eng);
    return () => { eng.destroy(); setEngine(null); };
  }, [epoch, layerState]);

  /* ── apply toggles to the engine ── */
  useEffect(() => { engine?.setSatellite(ui.satellite); }, [engine, ui.satellite]);
  useEffect(() => { engine?.setTerrain(ui.terrain); }, [engine, ui.terrain]);
  useEffect(() => { engine?.setLabels(ui.labels); }, [engine, ui.labels]);
  useEffect(() => { engine?.setDayNight(ui.daynight); }, [engine, ui.daynight]);
  useEffect(() => { engine?.setBuildings(ui.buildings); }, [engine, ui.buildings]);
  useEffect(() => { engine?.setOverlay('clouds', ui.clouds); }, [engine, ui.clouds]);
  useEffect(() => { engine?.setOverlay('weather', ui.weather); }, [engine, ui.weather]);
  useEffect(() => {
    if (!engine) return;
    for (const k of ['fires', 'vegetation', 'nightLights']) engine.setOverlay(k, ui.eo === k);
  }, [engine, ui.eo]);

  /* ── map markers: earthquakes and fire incidents (real feeds; nothing is drawn unless data came back) ── */
  const autoQuakes = useRef(false);                           // true only while the markers are the panel's 24 h / M2.5+ set
  const plot = useCallback((name, items) => {
    engRef.current?.setMarkers(name, items, feeds.styleFor);
    setMarkers((m) => ({ ...m, [name]: items?.length || 0, [`${name}At`]: items?.length ? Date.now() : null }));
  }, []);
  useEffect(() => { setMarkers({ quakes: 0, incidents: 0 }); }, [engine]);

  const prevEo = useRef(null);
  useEffect(() => {
    if (!engine) return undefined;
    let dead = false;
    if (ui.eo === 'fires') {
      feeds.fetchEvents({ category: 'wildfires', days: 30 })
        .then((r) => { if (!dead) plot('incidents', r.items); })
        .catch((e) => { if (!dead) flash(`Fire incidents unavailable: ${e.message}`); });
    } else if (prevEo.current === 'fires') plot('incidents', null);
    prevEo.current = ui.eo;
    return () => { dead = true; };
  }, [engine, ui.eo, plot, flash]);

  const toggleQuakes = useCallback(() => {
    if (markers.quakes) { autoQuakes.current = false; plot('quakes', null); return; }
    feeds.fetchQuakes({ window: 'day', minMag: 2.5 }).then((r) => { autoQuakes.current = true; plot('quakes', r.items); if (!r.items.length) flash('USGS reports no earthquakes of M2.5 or more in the past 24 hours.'); })
      .catch((e) => flash(`Earthquakes unavailable: ${e.message}`));
  }, [markers.quakes, plot, flash]);
  // The USGS feed itself updates about every minute; this view re-reads it every 5 minutes while the panel's set is showing.
  useEffect(() => {
    if (!markers.quakes) return undefined;
    const id = setInterval(() => {
      if (!autoQuakes.current) return;
      feeds.clearFeedCache();
      feeds.fetchQuakes({ window: 'day', minMag: 2.5 }).then((r) => { if (autoQuakes.current) plot('quakes', r.items); }).catch(() => {});
    }, 300000);
    return () => clearInterval(id);
  }, [markers.quakes, plot]);

  /* ── connection checks: a quick one at startup, a full one on demand ── */
  const test = useCallback(async (deep) => {
    setChecks((c) => ({ ...c, running: true, deep: deep || c.deep }));
    try {
      const list = await runChecks({ scene: engine?.scene, deep });
      setChecks({ list, running: false, deep });
    } catch { setChecks((c) => ({ ...c, running: false })); }
  }, [engine]);
  useEffect(() => { if (!engine) return undefined; const t = setTimeout(() => test(false), 2500); return () => clearTimeout(t); }, [engine, test]);
  const health = useMemo(() => summarize(checks.list), [checks.list]);

  /* ── click inspector: place name and imagery date for the clicked point (each asked once per click) ── */
  const pickKey = pick && !pick.marker ? `${pick.lat},${pick.lon}` : null;
  useEffect(() => {
    if (!pickKey) return undefined;
    const ctl = new AbortController(), [lat, lon] = pickKey.split(',').map(Number);
    const patch = (o) => setPick((p) => (p && !p.marker && p.lat === lat && p.lon === lon ? { ...p, ...o } : p));
    imageryMetadata(lat, lon, ctl.signal).then((m) => patch({ meta: m || 'none' })).catch((e) => { if (e.name !== 'AbortError') patch({ meta: 'error' }); });
    reversePlace(lat, lon, ctl.signal).then((r) => patch({ place: placeFrom(r) })).catch((e) => { if (e.name !== 'AbortError') patch({ place: 'error' }); });
    return () => ctl.abort();
  }, [pickKey]);

  /* ── actions ── */
  const tilted = live.pitch > -75;
  const locate = () => {
    if (!navigator.geolocation) { flash('This browser cannot share its location.'); return; }
    navigator.geolocation.getCurrentPosition(
      (p) => engine?.flyToPlace(p.coords.latitude, p.coords.longitude, 3500),
      (e) => flash(e.code === 1 ? 'Location is blocked for this site: allow it in the browser address bar.' : 'Your location could not be determined.'),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 },
    );
  };
  const choose = (r) => {
    setResults(null); setQ(r.name.split(',')[0]);
    // Size the view from the place's extent: countries top-down, cities and smaller at an angle.
    const [s, n, wv, ev] = r.bbox || [r.lat, r.lat, r.lon, r.lon];
    const km = Math.hypot((n - s) * 111, (ev - wv) * 111 * Math.cos(CMath.toRadians(r.lat)));
    if (km > 600) engine?.flyToRectangle(wv, s, ev, n);
    else engine?.flyToPlace(r.lat, r.lon, Math.max(1800, km * 1000 * 1.25), km > 60 ? -60 : -40);
  };
  const submitSearch = async (e) => {
    e.preventDefault();
    const text = q.trim(); if (!text) return;
    const c = parseCoords(text);
    if (c) { setResults(null); engine?.flyToPlace(c.lat, c.lon, 5000); return; }
    setSearching(true); setResults(null);
    try {
      const rows = await searchPlaces(text);
      setResults(rows);
      if (rows.length === 1) choose(rows[0]);
    } catch (err) { setResults([]); flash(`Search failed: ${err.message}`); }
    finally { setSearching(false); }
  };

  /* ── what the terminal may touch ── */
  const layerRows = () => {
    const u = uiRef.current, st = stateRef.current;
    const note = (k, extra = '') => (st[k]?.status === 'error' ? st[k].error : st[k]?.status === 'loading' ? 'loading' : st[k]?.time ? when(st[k].time) : extra);
    return [
      { key: 'satellite', name: 'satellite', on: u.satellite, note: note('satellite', 'Esri World Imagery') },
      { key: 'terrain', name: 'terrain', on: u.terrain, note: note('terrain', 'AWS elevation') },
      { key: 'labels', name: 'labels', on: u.labels, note: 'Esri boundaries and places' },
      { key: 'daynight', name: 'daynight', on: u.daynight, note: 'real sun position' },
      { key: 'buildings', name: 'buildings', on: u.buildings, note: st.buildings?.error || st.buildings?.source || 'appears when zoomed into a city' },
      { key: 'clouds', name: 'clouds', on: u.clouds, note: note('clouds', 'NASA GIBS daily') },
      { key: 'weather', name: 'weather', on: u.weather, note: note('weather', 'NASA IMERG precipitation') },
      { key: 'fires', name: 'fires', on: u.eo === 'fires', note: note('fires', 'NASA GIBS thermal anomalies + EONET incidents') },
      { key: 'vegetation', name: 'vegetation', on: u.eo === 'vegetation', note: note('vegetation', 'MODIS NDVI') },
      { key: 'nightLights', name: 'nightlights', on: u.eo === 'nightLights', note: note('nightLights', 'VIIRS night lights') },
    ];
  };
  const termCtx = useMemo(() => {
    const E = (m, fallback) => (...a) => (engRef.current ? engRef.current[m](...a) : fallback);
    return {
      engine: {
        view: () => engRef.current?.view() ?? { height: null, heading: 0, pitch: -90, loading: 0, failed: 0, quality: 'full', centre: null, sun: { lat: 0, lon: 0 } },
        flyToPlace: E('flyToPlace'), home: E('home'), tilt: E('tilt'), northUp: E('northUp'), markerCount: E('markerCount', 0),
        setMarkers: (name, items) => { if (name === 'quakes') autoQuakes.current = false; plot(name, items); },
      },
      layers: {
        list: layerRows,
        async set(key, on) {
          const flat = { satellite: 'satellite', terrain: 'terrain', labels: 'labels', daynight: 'daynight', buildings: 'buildings', clouds: 'clouds', weather: 'weather' };
          if (flat[key]) setUi((u) => ({ ...u, [flat[key]]: on }));
          else setUi((u) => ({ ...u, eo: on ? key : (u.eo === key ? null : u.eo) }));
          if (!on) return undefined;
          // Wait (briefly) for the layer to say whether data actually arrived.
          for (let i = 0; i < 60; i++) {
            await new Promise((r) => setTimeout(r, 250));
            const st = stateRef.current[key];
            if (st?.status === 'error') return st.error;
            if (st?.status === 'on') return undefined;
            if (!['clouds', 'weather', 'fires', 'vegetation', 'nightLights', 'buildings'].includes(key)) return undefined;
          }
          return 'still loading after 15 s: check Layers › Connections';
        },
      },
      feeds,
      geocode: (text) => searchPlaces(text),
      checks: (deep) => runChecks({ scene: engRef.current?.scene, deep }),
      imagery: (lat, lon) => imageryMetadata(lat, lon),
      select: (item) => { pendingSelect.current = { marker: item, set: item.kind === 'quake' ? 'quakes' : 'incidents' }; },
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plot]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.target.closest('input, textarea, select')) { if (e.key === 'Escape') e.target.blur(); return; }
      if (e.key === '/') { e.preventDefault(); document.getElementById('earth-search')?.focus(); }
      else if (e.key === 'Escape') { setPick(null); setPanel(false); setResults(null); }
      else if (e.key === 'h') engine?.home();
      else if (e.key === 'l') setPanel((v) => !v);
      else if (e.key === '`') { e.preventDefault(); setTerm((v) => !v); }
    };
    addEventListener('keydown', onKey); return () => removeEventListener('keydown', onKey);
  }, [engine]);

  /* ── status line ── */
  const sat = state.satellite || {};
  const activeOverlays = Object.keys(OVERLAYS).filter((k) => state[k]?.status === 'on' && (k === 'clouds' ? ui.clouds : k === 'weather' ? ui.weather : ui.eo === k));
  // Metres per screen pixel for a straight-down view (60° lens); if that is finer than the source resolution, the picture is enlarged, not sharper.
  const screenMpp = live.height != null ? live.height * 0.00144 : null;
  const magnified = !!(meta?.ok && meta.res && screenMpp && screenMpp < Number(meta.res) * 0.6 && live.pitch < -60);
  let source;
  if (!ui.satellite || sat.status === 'error') source = <><b>{BASE.blueMarble.name}</b> · static composite, ~10 km</>;
  else if (live.height != null && live.height > 400000) source = <><b>{BASE.esri.name}</b> · periodic basemap mosaic, many capture dates</>;
  else if (meta?.ok) source = <><b>{BASE.esri.name}</b> · captured {meta.date || 'date not reported'}{meta.res ? ` · ${meta.res} m` : ''}{meta.source ? ` · ${meta.source}` : ''}{magnified ? ' · enlarged beyond the source detail' : ''}</>;
  else source = <><b>{BASE.esri.name}</b> · periodic basemap{meta && !meta.ok ? ' · capture date unavailable here' : ''}</>;

  const problem = health.failed[0] || (sat.status === 'error' && { label: 'Satellite imagery', detail: sat.error });

  if (fatal && !engine) return <div className="earth earth-fatal"><div><p>{fatal}</p><button className="e-restart" onClick={() => setEpoch((n) => n + 1)}><RefreshCw size={14}/>Restart the globe</button></div></div>;

  return <div className={`earth ${term ? 'term-open' : ''}`}>
    <div ref={host} className="earth-canvas" />

    <header className="e-top">
      <a className="e-mark" href="#" aria-label="VARN" onClick={(e) => { e.preventDefault(); engine?.home(); }}>
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
          <li className="e-attrib">Search © OpenStreetMap contributors (Nominatim)</li>
        </ul>}
      </form>
    </header>

    <div className="e-controls" role="group" aria-label="Map controls">
      <button className={`e-btn ${panel ? 'on' : ''}`} onClick={() => setPanel((v) => !v)} aria-expanded={panel} aria-controls="e-layers" title="Layers (L)">
        <Layers size={17}/>{problem && <i className="e-dot" aria-label="A data source is unreachable"/>}</button>
      <button className={`e-btn ${term ? 'on' : ''}`} onClick={() => setTerm((v) => !v)} aria-pressed={term} title="Terminal (`)" aria-label="Toggle command terminal"><SquareTerminal size={17}/></button>
      <span className="e-gap"/>
      <button className="e-btn" onClick={() => engine?.zoom(0.45)} title="Zoom in" aria-label="Zoom in"><Plus size={17}/></button>
      <button className="e-btn" onClick={() => engine?.zoom(2.2)} title="Zoom out" aria-label="Zoom out"><Minus size={17}/></button>
      <button className={`e-btn ${tilted ? 'on' : ''}`} onClick={() => engine?.tilt(tilted)} title={tilted ? 'Top-down view' : 'Tilt to 3D'} aria-pressed={tilted} aria-label="Toggle 3D tilt"><Box size={17}/></button>
      <button className="e-btn e-compass" onClick={() => engine?.northUp()} title="North up" aria-label={`Heading ${Math.round((live.heading + 360) % 360)} degrees; reset to north`}>
        <Navigation2 size={16} style={{ transform: `rotate(${-live.heading}deg)` }}/></button>
      <button className="e-btn" onClick={() => { setPick(null); engine?.home(); }} title="Whole Earth (H)" aria-label="Return to whole Earth"><Globe2 size={17}/></button>
      <button className="e-btn" onClick={locate} title="My location" aria-label="Fly to my location"><LocateFixed size={17}/></button>
    </div>

    {panel && <section id="e-layers" className="e-layers glassy" aria-label="Layers">
      <header><h2>Layers</h2><button className="e-x" onClick={() => setPanel(false)} aria-label="Close layers"><X size={14}/></button></header>
      <Row label="Satellite" sub={sat.status === 'error' ? sat.error : 'Esri World Imagery · a mosaic of many capture dates, updated periodically'} tag="Basemap" on={ui.satellite} st={sat.status} onToggle={() => setUi((u) => ({ ...u, satellite: !u.satellite }))}/>
      <Row label="Terrain" sub={state.terrain?.error || `${TERRAIN.name} · elevation ${TERRAIN.resolution}`} tag="Static" on={ui.terrain} st={state.terrain?.status} onToggle={() => setUi((u) => ({ ...u, terrain: !u.terrain }))}/>
      <Row label="Labels" sub="Countries, borders, cities and places · Esri" tag="Basemap" on={ui.labels} onToggle={() => setUi((u) => ({ ...u, labels: !u.labels }))}/>
      <Row label="Day / night" sub="Sun position from your clock, refreshed each minute · city lights are a static NASA composite" tag="Real time" on={ui.daynight} onToggle={() => setUi((u) => ({ ...u, daynight: !u.daynight }))}/>
      <Row label="3D buildings" tag="Auto" on={ui.buildings} st={state.buildings?.status} sub={buildingsNote(state.buildings)}
        onToggle={() => setUi((u) => ({ ...u, buildings: !u.buildings }))}/>
      <OverlayRow k="clouds" on={ui.clouds} st={state.clouds} onToggle={() => setUi((u) => ({ ...u, clouds: !u.clouds }))}/>
      <OverlayRow k="weather" on={ui.weather} st={state.weather} onToggle={() => setUi((u) => ({ ...u, weather: !u.weather }))}/>
      <Row label="Earthquakes" sub={markers.quakes ? `${markers.quakes} plotted · USGS · fetched ${new Date(markers.quakesAt || Date.now()).toISOString().slice(11, 16)} UTC${autoQuakes.current ? ' · refreshes every 5 min' : ''} · click a marker` : 'USGS Earthquake Hazards Program · past 24 h, M2.5+, re-read every 5 min'} tag="Snapshot" on={markers.quakes > 0} onToggle={toggleQuakes}/>
      <div className="e-sub">Earth observation</div>
      {['fires', 'vegetation', 'nightLights'].map((k) => <OverlayRow key={k} k={k} on={ui.eo === k} st={state[k]} radio extra={k === 'fires' && markers.incidents ? `${markers.incidents} EONET incident marker${markers.incidents === 1 ? '' : 's'}` : ''}
        onToggle={() => setUi((u) => ({ ...u, eo: u.eo === k ? null : k }))}/>)}

      <div className="e-sub e-conn-head">Connections
        <button className="e-test" onClick={() => test(true)} disabled={checks.running}>{checks.running ? <Loader2 size={11} className="spin"/> : <RefreshCw size={11}/>}{checks.deep ? 'Test again' : 'Test all'}</button></div>
      {checks.list.length ? <ul className="e-conn">{checks.list.map((c) => <li key={c.id} className={c.state}>
        <i aria-hidden="true"/><span><strong>{c.label}</strong><small>{c.detail}{c.ms != null ? ` · ${c.ms} ms` : ''}</small></span></li>)}</ul>
        : <p className="e-note">{checks.running ? 'Checking every data source from this browser…' : 'Checks every data source from this browser.'}</p>}
      <p className="e-note">Basemaps are mosaics of images captured at different times; daily and half-hourly layers show the time of the data shown. Nothing here is live video.</p>
    </section>}

    {pick?.marker && <MarkerPop pick={pick} onClose={() => setPick(null)}/>}

    {pick && !pick.marker && <InspectPanel pick={pick} terrain={ui.terrain} satellite={ui.satellite} onClose={() => setPick(null)}
      onCopy={() => navigator.clipboard?.writeText(`${pick.lat.toFixed(6)}, ${pick.lon.toFixed(6)}`).then(() => flash('Coordinates copied'), () => flash('Clipboard blocked by the browser'))}
      onZoom={() => { engine?.flyToPlace(pick.lat, pick.lon, Math.max(1500, (live.height || 20000) * 0.25)); setPick(null); }}/>}

    <footer className="e-status">
      {problem && <p className="e-warn"><TriangleAlert size={12}/>{problem.label} is not reachable{problem.detail ? `: ${problem.detail}` : ''}. Open Layers › Connections.</p>}
      <p className="e-source">{source}</p>
      {activeOverlays.map((k) => <p key={k} className="e-source">{OVERLAYS[k].name} · NASA GIBS · {when(state[k].time)} ({describeAge(state[k].time)}) · {cadenceTag[OVERLAYS[k].cadence] || OVERLAYS[k].cadence}</p>)}
      <p className="e-meta">
        {live.loading > 0 ? (slowLoad ? <span className="e-loading"><Loader2 size={11} className="spin"/>Sharpening imagery · {live.loading} tile{live.loading === 1 ? '' : 's'}{live.failed ? ` · ${live.failed} could not load` : ''}</span> : <span>Imagery loaded</span>)
          : <span>{live.failed ? `Some imagery could not load (${live.failed} tile${live.failed === 1 ? '' : 's'})` : 'Imagery loaded'}</span>}
        <i/>Altitude {fmtAlt(live.height)}
        {live.cursor && <><i/>{fmtLat(live.cursor.lat, 4)} {fmtLon(live.cursor.lon, 4)}</>}
        {live.quality === 'adjusted' && <><i/><span title="This device could not hold a smooth frame rate, so rendering detail was reduced">Quality adjusted for speed</span></>}
      </p>
      <div ref={creditsRef} className="e-credits"/>
    </footer>

    <Terminal ctx={termCtx} open={term} onClose={() => setTerm(false)}/>

    {notice && <div className="e-toast" role="status">{notice}</div>}
    {fatal && engine && <div className="e-lost" role="alertdialog" aria-label="Graphics problem"><TriangleAlert size={18}/><p>{fatal}</p>
      <button className="e-restart" onClick={() => setEpoch((n) => n + 1)}><RefreshCw size={14}/>Restart the globe</button></div>}
  </div>;
}

function buildingsNote(b = {}) {
  if (b.status === 'error') return b.error;
  if (b.status === 'loading') return 'Connecting to the 3D source…';
  const d = b.detail;
  if (!b.source) return 'Appears automatically when zoomed into a city';
  const base = `${b.source} · appears automatically when zoomed into a city`;
  if (b.error) return `${base} · ${b.error}`;
  if (d?.buildings) {
    const est = d.unmapped ? ` · ${Math.round((d.unmapped / (d.mapped + d.unmapped)) * 100)}% use a default height (not mapped in OSM)` : '';
    return `${base} · ${d.buildings.toLocaleString('en-US')} loaded${est}${d.capped ? ' · dense tiles are thinned to the largest footprints' : ''}`;
  }
  return base;
}

function Row({ label, sub, tag, on, st, onToggle, radio, disabled }) {
  return <button className={`e-row ${on ? 'on' : ''} ${disabled ? 'off' : ''}`} role={radio ? 'radio' : 'switch'} aria-checked={on} aria-disabled={disabled || undefined} onClick={disabled ? undefined : onToggle}>
    <span className={`e-sw ${radio ? 'radio' : ''}`} aria-hidden="true"/>
    <span className="e-row-main"><strong>{label}{tag && <em>{tag}</em>}</strong><small className={st === 'error' ? 'err' : ''}>{sub}</small></span>
    {on && st === 'loading' && <Loader2 size={13} className="spin"/>}
  </button>;
}

function OverlayRow({ k, on, st = {}, onToggle, radio, extra }) {
  const o = OVERLAYS[k];
  const sub = st.status === 'error' && !on ? st.error : st.status === 'loading' ? 'Finding the latest available data…'
    : `${o.name} · NASA GIBS · ${o.resolution} · ${st.time ? `newest ${when(st.time)} (${describeAge(st.time)})` : o.schedule}${extra ? ` · ${extra}` : ''}`;
  return <Row label={o.label} sub={sub} tag={cadenceTag[o.cadence] || o.cadence} on={on} st={on ? st.status : undefined} onToggle={onToggle} radio={radio}/>;
}

function InspectPanel({ pick, terrain, satellite, onClose, onCopy, onZoom }) {
  const place = pick.place, sun = sunState(pick.lat, pick.lon, subsolarPoint(), Date.now());
  const title = place === undefined ? 'Locating…' : place?.title || 'Open water or remote area';
  const m = pick.meta;
  return <div className="e-pop e-inspect glassy" style={{ left: Math.max(8, Math.min(pick.x + 14, innerWidth - 310)), top: Math.max(8, Math.min(pick.y + 14, innerHeight - 290)) }} role="dialog" aria-label="Location details">
    <header><div><strong>{title}</strong>{place?.subtitle && <small>{place.subtitle}</small>}</div><button className="e-x" onClick={onClose} aria-label="Close"><X size={13}/></button></header>
    <dl>
      <div><dt>Position</dt><dd>{fmtLat(pick.lat, 5)} {fmtLon(pick.lon, 5)}</dd></div>
      {terrain && <div><dt>Elevation</dt><dd>{Math.round(pick.height)} m <small>terrain model</small></dd></div>}
      {satellite && <div><dt>Imagery</dt><dd>{m === 'loading' ? 'Checking…' : m === 'error' || m === 'none' ? 'Capture date not reported here' : <>{m.date || 'date not reported'}{m.res ? ` · ${m.res} m` : ''}</>}</dd></div>}
      <div><dt>Sun</dt><dd>{sun.phase}, {sun.elevation.toFixed(0)}° <small>solar time {sun.solarTime}</small></dd></div>
    </dl>
    <footer><button className="e-copy" onClick={onCopy}><Copy size={12}/>Copy</button><button className="e-copy" onClick={onZoom}><Plus size={12}/>Zoom here</button></footer>
  </div>;
}

const safeUrl = (u) => { try { const x = new URL(u); return /^https?:$/.test(x.protocol) ? x.href : null; } catch { return null; } };

function MarkerPop({ pick, onClose }) {
  const it = pick.marker, link = safeUrl(it.url);
  const t = Number.isFinite(it.time) ? new Date(it.time).toISOString().replace('T', ' ').slice(0, 16) + ' UTC' : 'not reported';
  return <div className="e-pop glassy" style={{ left: Math.max(8, Math.min(pick.x + 14, innerWidth - 300)), top: Math.max(8, Math.min(pick.y + 14, innerHeight - 240)) }} role="dialog" aria-label={it.title}>
    <header><strong>{it.kind === 'quake' ? `M${it.mag.toFixed(1)} earthquake` : it.category}</strong><button className="e-x" onClick={onClose} aria-label="Close"><X size={13}/></button></header>
    <dl>
      <div><dt>{it.kind === 'quake' ? 'Place' : 'Event'}</dt><dd>{it.title}</dd></div>
      <div><dt>{it.kind === 'quake' ? 'Time' : 'Last update'}</dt><dd>{t}</dd></div>
      <div><dt>Position</dt><dd>{fmtLat(it.lat, 3)} {fmtLon(it.lon, 3)}</dd></div>
      {it.kind === 'quake' && Number.isFinite(it.depthKm) && <div><dt>Depth</dt><dd>{Math.round(it.depthKm)} km</dd></div>}
      {it.kind === 'quake' && it.tsunami && <div><dt>Note</dt><dd>USGS tsunami flag set: see tsunami.gov</dd></div>}
      {it.kind !== 'quake' && it.magnitude != null && <div><dt>Size</dt><dd>{it.magnitude} {it.unit}</dd></div>}
      <div><dt>Source</dt><dd>{it.kind === 'quake' ? 'USGS' : 'NASA EONET'}{link && <> · <a href={link} target="_blank" rel="noreferrer noopener">details</a></>}</dd></div>
    </dl>
  </div>;
}
