import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { generateScene, stateAt, summarize, sampleTrack, LABELS } from './sim.js';
import { normalizeSightings } from './data.js';
import { drawFrame, KIND_STYLE, glyph } from './render.js';
import { Glass, refractionSupported, useSpring } from './Glass.jsx';
import './sky.css';

const SPEEDS = [1, 4, 16];
const KIND_ORDER = { drone: 0, unknown: 1, unmatched: 2, matched: 3 };
const params = new URLSearchParams(typeof location !== 'undefined' ? location.search : '');
const SEED = Number(params.get('seed')) || 1729;

const pad = (n) => String(Math.floor(n)).padStart(2, '0');
const tPlus = (s) => `T+${pad(s / 60)}:${pad(s % 60)}`;
function clockText(scene, t) {
  if (!scene || scene.mode === 'sim') return tPlus(t);
  return new Date((scene.epoch + t) * 1000).toISOString().slice(11, 19) + 'Z';
}
const media = (q) => typeof matchMedia !== 'undefined' && matchMedia(q).matches;

function Glyph({ kind, size = 14 }) {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current, d = devicePixelRatio || 1; c.width = c.height = size * d;
    const g = c.getContext('2d'); g.scale(d, d); const st = KIND_STYLE[kind];
    glyph(g, st.shape, size / 2, size / 2, size * 0.28, st.color, 1.5);
  }, [kind, size]);
  return <canvas ref={ref} className="g" style={{ width: size, height: size }} aria-hidden="true" />;
}

function download(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function sightingRecord(scene, track) {
  const sim = scene.mode === 'sim';
  return {
    notice: sim ? 'SIMULATION: not real detections' : 'REAL: from platform/public/data/sightings.json',
    mode: sim ? 'SIM' : 'REAL', ...(sim ? { seed: scene.seed } : {}),
    id: track.id, label: track.label,
    first_seen: clockText(scene, track.t0), last_seen: clockText(scene, track.t1),
    adsb: { status: track.match.status, callsign: track.match.callsign ?? null, reason: track.match.reason },
    samples: track.points ? track.points.map((p) => ({ t: +p.t.toFixed(2), az: p.az, el: p.el })) : sampleTrack(track, 1),
  };
}
function toCSV(rec) {
  const head = `# ${rec.notice}\n# id=${rec.id}; label=${rec.label}; adsb=${rec.adsb.status}\nmode,id,label,t_s,azimuth_deg,elevation_deg\n`;
  return head + rec.samples.map((s) => [rec.mode, rec.id, `"${rec.label}"`, s.t, s.az, s.el].join(',')).join('\n') + '\n';
}
function summaryText(scene, track, now) {
  const m = scene.mode === 'sim' ? 'SIM' : 'REAL';
  const pos = now ? `az ${now.az.toFixed(1)}°, el ${now.el.toFixed(1)}°, ${now.rate.toFixed(2)}°/s` : 'not in view at current time';
  return `[${m}] ${track.id}: ${track.label}. ${pos}. Seen ${clockText(scene, track.t0)} to ${clockText(scene, track.t1)}. ADS-B: ${track.match.status === 'matched' ? 'matched' : 'no match'} (${track.match.reason}).${m === 'SIM' ? ' SIMULATION: not real detections.' : ''}`;
}

const noteKey = (mode, id) => `varn.sky.note.${mode}.${id}`;
function readNote(mode, id) { try { return localStorage.getItem(noteKey(mode, id)) ?? ''; } catch { return ''; } }
function writeNote(mode, id, v) { try { localStorage.setItem(noteKey(mode, id), v); } catch { /* storage unavailable */ } }

export default function Sky() {
  const [mode, setMode] = useState(params.get('mode') === 'real' ? 'real' : 'sim');
  const [view, setView] = useState(params.get('view') === 'plan' ? 'plan' : 'dome');
  const simScene = useMemo(() => generateScene(SEED), []);
  const [real, setReal] = useState({ status: 'idle', scene: null });
  const scene = mode === 'sim' ? simScene : real.scene;

  const tRef = useRef(Number(params.get('t')) || 96);
  const [tick, setTick] = useState(0); // drives ~10 Hz readouts
  const [playing, setPlaying] = useState(params.get('paused') == null);
  const [speed, setSpeed] = useState(4);
  const [selectedId, setSelectedId] = useState(params.get('select'));
  const [hoverId, setHoverId] = useState(null);
  const [cursor, setCursor] = useState(0);
  const [query, setQuery] = useState('');
  const [palette, setPalette] = useState(false);
  const [quality, setQuality] = useState('high');
  const [toast, setToast] = useState('');
  const [prefs] = useState(() => ({ reducedMotion: media('(prefers-reduced-motion: reduce)'), solid: media('(prefers-reduced-transparency: reduce)') || media('(prefers-contrast: more)') }));
  const canRefract = useMemo(() => refractionSupported() && !prefs.reducedMotion && !prefs.solid, [prefs]);
  const refract = canRefract && quality === 'high';

  const canvasRef = useRef(null), hitsRef = useRef([]), searchRef = useRef(null);
  const live = useRef({});
  live.current = { scene, view, mode, selectedId, hoverId, quality, playing, speed, prefs };

  // REAL mode: read the local file once; honest empty state if it is missing or empty.
  useEffect(() => {
    if (mode !== 'real' || real.status !== 'idle') return;
    setReal({ status: 'loading', scene: null });
    fetch(`${import.meta.env?.BASE_URL ?? '/'}data/sightings.json`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((j) => { const s = normalizeSightings(j); setReal({ status: s ? 'ready' : 'empty', scene: s }); })
      .catch(() => setReal({ status: 'missing', scene: null }));
  }, [mode, real.status]);

  useEffect(() => { tRef.current = mode === 'sim' ? (Number(params.get('t')) || 96) : 0; setSelectedId(params.get('select')); setTick((x) => x + 1); }, [mode, real.scene]);

  // Animation loop: rAF only, paused when hidden, adaptive quality.
  useEffect(() => {
    const cv = canvasRef.current, ctx = cv.getContext('2d');
    let raf = 0, last = performance.now(), slowSince = 0, lastReadout = 0, frames = 0, fpsT = last;
    const perf = (window.__varnSky = { fps: 0, quality: 'high', frameMs: 0, frames: 0 });
    const resize = () => { const d = Math.min(2, devicePixelRatio || 1); cv.width = innerWidth * d; cv.height = innerHeight * d; };
    resize(); addEventListener('resize', resize);
    const frame = (now) => {
      const dt = now - last; last = now;
      const L = live.current, sc = L.scene;
      if (L.playing && sc && dt < 250) {
        tRef.current += (dt / 1000) * L.speed;
        if (tRef.current > sc.duration) tRef.current = 0;
      }
      if (dt > 20 && dt < 250) { slowSince ||= now; if (now - slowSince > 2000 && L.quality === 'high') { setQuality('low'); perf.quality = 'low'; } } else slowSince = 0;
      const d = cv.width / innerWidth; ctx.setTransform(d, 0, 0, d, 0, 0);
      const visible = sc ? stateAt(sc, tRef.current) : [];
      const out = drawFrame(ctx, { w: innerWidth, h: innerHeight, dpr: d, scene: sc, t: tRef.current, visible, selectedId: L.selectedId, hoverId: L.hoverId, quality: L.quality, mode: L.mode, view: L.view, now, reducedMotion: L.prefs.reducedMotion });
      hitsRef.current = out.hits;
      frames++; perf.frames++; perf.frameMs = dt;
      if (now - fpsT > 1000) { perf.fps = Math.round((frames * 1000) / (now - fpsT)); frames = 0; fpsT = now; }
      if (now - lastReadout > 100) { lastReadout = now; setTick((x) => x + 1); }
      raf = requestAnimationFrame(frame);
    };
    const onVis = () => { cancelAnimationFrame(raf); if (!document.hidden) { last = performance.now(); raf = requestAnimationFrame(frame); } };
    document.addEventListener('visibilitychange', onVis);
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); removeEventListener('resize', resize); document.removeEventListener('visibilitychange', onVis); };
  }, []);

  const t = tRef.current;
  const visible = useMemo(() => (scene ? stateAt(scene, t) : []), [scene, tick]); // eslint-disable-line
  const counts = summarize(visible);
  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...visible].filter((v) => !q || `${v.track.id} ${v.track.label} ${v.track.match.callsign ?? ''}`.toLowerCase().includes(q))
      .sort((a, b) => KIND_ORDER[a.track.kind] - KIND_ORDER[b.track.kind] || b.el - a.el);
  }, [visible, query]);
  const selTrack = scene?.tracks.find((x) => x.id === selectedId) ?? null;
  const selNow = selTrack ? visible.find((v) => v.track.id === selTrack.id) : null;
  const cursorId = list[Math.min(cursor, list.length - 1)]?.track.id;

  const flash = (m) => { setToast(m); setTimeout(() => setToast(''), 2200); };
  const jumpTo = useCallback((id) => {
    const tr = scene?.tracks.find((x) => x.id === id); if (!tr) return;
    if (tr.t0 > tRef.current || tr.t1 < tRef.current) tRef.current = tr.t0 + (tr.t1 - tr.t0) * 0.4;
    setSelectedId(id); setTick((x) => x + 1);
  }, [scene]);
  const step = (s) => { if (!scene) return; tRef.current = Math.max(0, Math.min(scene.duration, tRef.current + s)); setTick((x) => x + 1); };
  const exportAs = (fmt) => {
    if (!selTrack) return; const rec = sightingRecord(scene, selTrack);
    const name = `varn-sky-${rec.mode}-${selTrack.id}.${fmt}`;
    if (fmt === 'json') download(name, JSON.stringify(rec, null, 2), 'application/json'); else download(name, toCSV(rec), 'text/csv');
    flash(`Saved ${name}`);
  };
  const copySummary = async () => {
    if (!selTrack) return; const text = summaryText(scene, selTrack, selNow);
    try { await navigator.clipboard.writeText(text); flash('Summary copied'); } catch { flash('Clipboard blocked by the browser'); }
  };

  // keyboard
  useEffect(() => {
    const onKey = (e) => {
      const typing = /INPUT|TEXTAREA/.test(document.activeElement?.tagName);
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPalette((p) => !p); return; }
      if (e.key === 'Escape') { if (palette) setPalette(false); else if (typing) document.activeElement.blur(); else setSelectedId(null); return; }
      if (typing || palette) return;
      const n = list.length;
      if (e.key === 'j' || e.key === 'ArrowDown') { e.preventDefault(); if (selTrack && n) { const i = list.findIndex((v) => v.track.id === selectedId); setSelectedId(list[(i + 1 + n) % n].track.id); } else setCursor((c) => Math.min(n - 1, c + 1)); }
      else if (e.key === 'k' || e.key === 'ArrowUp') { e.preventDefault(); if (selTrack && n) { const i = list.findIndex((v) => v.track.id === selectedId); setSelectedId(list[(Math.max(i, 0) - 1 + n) % n].track.id); } else setCursor((c) => Math.max(0, c - 1)); }
      else if (e.key === 'Enter' && cursorId && !selTrack) setSelectedId(cursorId);
      else if (e.key === ' ') { e.preventDefault(); setPlaying((p) => !p); }
      else if (e.key === '/') { e.preventDefault(); setSelectedId(null); setTimeout(() => searchRef.current?.focus(), 0); }
      else if (e.key === 'ArrowRight' || e.key === '.') step(1);
      else if (e.key === 'ArrowLeft' || e.key === ',') step(-1);
      else if (e.key === 'v') setView((v) => (v === 'dome' ? 'plan' : 'dome'));
    };
    addEventListener('keydown', onKey); return () => removeEventListener('keydown', onKey);
  });

  // canvas pointer: hover + select via hit targets
  const pick = (e) => {
    let best = null, bd = 18 * 18;
    for (const h of hitsRef.current) { const d = (h.x - e.clientX) ** 2 + (h.y - e.clientY) ** 2; if (d < bd) { bd = d; best = h.id; } }
    return best;
  };
  const onCanvasMove = (e) => { const id = pick(e); setHoverId(id); e.currentTarget.style.cursor = id ? 'pointer' : 'default'; };
  const onCanvasClick = (e) => { const id = pick(e); setSelectedId(id); };

  const commands = useMemo(() => {
    const c = [
      { name: `Switch to ${view === 'dome' ? 'plan' : 'dome'} view`, hint: 'V', run: () => setView(view === 'dome' ? 'plan' : 'dome') },
      { name: `Switch to ${mode === 'sim' ? 'REAL' : 'SIM'} mode`, hint: 'mode', run: () => { setMode(mode === 'sim' ? 'real' : 'sim'); setReal((r) => (r.status === 'missing' ? { status: 'idle', scene: null } : r)); } },
      { name: playing ? 'Pause' : 'Play', hint: 'Space', run: () => setPlaying(!playing) },
      ...SPEEDS.map((s) => ({ name: `Speed ×${s}`, hint: 'time', run: () => setSpeed(s) })),
    ];
    if (selTrack) c.push({ name: `Export ${selTrack.id} as JSON`, hint: 'export', run: () => exportAs('json') }, { name: `Export ${selTrack.id} as CSV`, hint: 'export', run: () => exportAs('csv') }, { name: `Copy ${selTrack.id} summary`, hint: 'export', run: copySummary });
    for (const tr of scene?.tracks ?? []) c.push({ name: `Jump to ${tr.id} · ${tr.label}${tr.match.callsign ? ' · ' + tr.match.callsign : ''}`, hint: clockText(scene, tr.t0), run: () => jumpTo(tr.id) });
    return c;
  }, [view, mode, playing, selTrack, scene, jumpTo]); // eslint-disable-line

  const empty = mode === 'real' && real.status !== 'ready';
  const modeTag = mode === 'sim' ? 'SIM' : 'REAL';
  const matchedNow = counts.matched;

  return <div className="sky" data-quality={quality} data-mode={mode}>
    {mode === 'sim' && <div className="sim-strap" role="status">SIMULATION: not real detections</div>}
    <canvas ref={canvasRef} className="stage" onPointerMove={onCanvasMove} onPointerLeave={() => setHoverId(null)} onClick={onCanvasClick}
      role="img" aria-label={`${view === 'dome' ? 'All-sky dome' : 'Plan view'}, ${modeTag}: ${counts.total} objects in view, ${matchedNow} matched to ADS-B.`} />

    <Glass as="header" className="sky-head" refract={refract}>
      <div className="row">
        <a className="wordmark" href="#overview" style={{ color: 'inherit', textDecoration: 'none' }} title="Back to VARN platform">VARN<small>SKY</small></a>
        <div className="mode-pill" role="group" aria-label="Data mode">
          <button aria-pressed={mode === 'sim'} onClick={() => setMode('sim')}>SIM</button>
          <button aria-pressed={mode === 'real'} onClick={() => { setMode('real'); setReal((r) => (r.status === 'missing' ? { status: 'idle', scene: null } : r)); }}>REAL</button>
        </div>
      </div>
      <p className="headline" aria-live="polite">
        {empty ? <>No real sightings loaded</> : <><b className="num">{counts.total}</b> in view · <b className="num">{matchedNow}</b> matched to ADS-B{counts.drone ? <> · <b className="num" style={{ color: 'var(--amber)' }}>{counts.drone}</b> drone cand.</> : null}</>}
      </p>
      <div className="subline">{scene?.node ? <>Node looking {scene.node.boresightAz}° az / {scene.node.boresightEl}° el · {scene.node.fov}° FOV · {modeTag}</> : <>{modeTag} · node pointing not in file</>}</div>
      <div className="legend">
        {Object.keys(LABELS).map((k) => <span key={k}><Glyph kind={k} />{LABELS[k]}<b className="num">{counts[k]}</b></span>)}
      </div>
      <div className="view-toggle" role="group" aria-label="View">
        <button className="chip" aria-pressed={view === 'dome'} onClick={() => setView('dome')}>Sky dome</button>
        <button className="chip" aria-pressed={view === 'plan'} onClick={() => setView('plan')}>Plan</button>
        <button className="chip kbd" onClick={() => setPalette(true)} aria-label="Open command palette">Commands <kbd>Ctrl K</kbd></button>
      </div>
    </Glass>

    {!empty && <MorphPanel refract={refract} reduced={prefs.reducedMotion} detail={!!selTrack}>
      {selTrack ? <Detail key={selTrack.id} scene={scene} track={selTrack} now={selNow} mode={mode} onBack={() => setSelectedId(null)} onExport={exportAs} onCopy={copySummary} toast={toast} />
        : <div className="panel-inner" key="list">
          <div className="panel-title"><h2>In view</h2><span className="num">{modeTag} · {clockText(scene, t)}</span></div>
          <label className="search"><span className="sr-only">Search tracks</span><input ref={searchRef} value={query} onChange={(e) => { setQuery(e.target.value); setCursor(0); }} placeholder="Search id, label, callsign" /><kbd>/</kbd></label>
          <ul className="tracks" role="listbox" aria-label="Tracks in view">
            {list.map((v) => {
              const tr = v.track;
              return <li key={tr.id} role="option" aria-selected={tr.id === cursorId}
                className={`track ${tr.id === cursorId ? 'is-cursor' : ''} ${tr.id === hoverId ? 'is-cursor' : ''}`}
                onMouseEnter={() => setHoverId(tr.id)} onMouseLeave={() => setHoverId(null)} onClick={() => setSelectedId(tr.id)}>
                <Glyph kind={tr.kind} />
                <span className="id">{tr.id}</span>
                <span className="pos num">{v.az.toFixed(0).padStart(3, '0')}° / {v.el.toFixed(0)}°</span>
                <span className="lbl">{tr.label}</span>
                <span className={`match ${tr.match.status === 'matched' ? 'ok' : ''}`}>{tr.match.status === 'matched' ? `ADS-B ${tr.match.callsign}` : 'No ADS-B'}</span>
              </li>;
            })}
            {!list.length && <li className="empty-note">{query ? `Nothing matches “${query}”.` : 'Nothing in view at this moment.'}</li>}
          </ul>
        </div>}
    </MorphPanel>}

    {empty && <Glass className="empty-card" refract={refract} role="status">
      <h2>{real.status === 'loading' ? 'Reading sightings…' : 'No real sightings yet'}</h2>
      <p>REAL mode reads only <code>platform/public/data/sightings.json</code>{real.status === 'empty' ? ', which has no usable rows' : ', which was not found'}. Nothing is simulated here, so the sky stays empty.</p>
      <p>Rows: <code>id, time, azimuth, elevation, label, match_status</code>.</p>
      <button className="chip" onClick={() => setMode('sim')}>Back to SIM</button>
    </Glass>}

    {!empty && <Timeline refract={refract} scene={scene} t={t} playing={playing} speed={speed} onPlay={() => setPlaying((p) => !p)} onSpeed={setSpeed} onStep={step} selectedId={selectedId}
      onScrub={(v) => { tRef.current = v; setTick((x) => x + 1); }} modeTag={modeTag} />}

    {palette && <Palette refract={refract} commands={commands} onClose={() => setPalette(false)} />}
    {params.has('fps') && <div className="perf num" aria-hidden="true">{window.__varnSky?.fps ?? 0} fps · {quality}</div>}
  </div>;
}

function MorphPanel({ detail, refract, reduced, children }) {
  const inner = useRef(null);
  const [h, setH] = useState(0);
  useEffect(() => {
    const el = inner.current; if (!el) return;
    const ro = new ResizeObserver(() => setH(el.scrollHeight)); ro.observe(el); setH(el.scrollHeight);
    return () => ro.disconnect();
  }, [detail]);
  const height = useSpring(h, { disabled: reduced || !h, stiffness: 300, damping: 24 });
  const radius = useSpring(detail ? 22 : 18, { disabled: reduced });
  return <Glass as="aside" className="sky-panel" refract={refract} aria-label={detail ? 'Track detail' : 'Track list'}
    style={{ height: h ? Math.max(40, height) : undefined, borderRadius: radius }}>
    <div ref={inner}>{children}</div>
  </Glass>;
}

function Detail({ scene, track, now, mode, onBack, onExport, onCopy, toast }) {
  const [note, setNote] = useState(() => readNote(mode, track.id));
  const st = KIND_STYLE[track.kind];
  return <div className="panel-inner">
    <div className="detail-head">
      <button className="back" onClick={onBack} aria-label="Back to list (Esc)">←</button>
      <h2>{track.id}</h2>
      <span style={{ marginLeft: 'auto', color: 'var(--fog)', fontSize: 12 }}>{mode === 'sim' ? 'SIM' : 'REAL'}</span>
    </div>
    <div className="detail-label" style={{ color: st.color }}><Glyph kind={track.kind} />{track.label}</div>
    <dl className="stats">
      <div><dt>Azimuth</dt><dd className="num">{now ? now.az.toFixed(1) : '—'}<small>°</small></dd></div>
      <div><dt>Elevation</dt><dd className="num">{now ? now.el.toFixed(1) : '—'}<small>°</small></dd></div>
      <div><dt>Angular rate</dt><dd className="num">{now ? now.rate.toFixed(2) : '—'}<small>°/s</small></dd></div>
      <div><dt>First seen</dt><dd className="num">{clockText(scene, track.t0)}</dd></div>
      <div><dt>Last seen</dt><dd className="num">{clockText(scene, track.t1)}</dd></div>
      <div><dt>In node view</dt><dd>{now ? (scene.node ? (now.inFov ? 'Yes' : 'No') : 'n/a') : 'Not now'}</dd></div>
    </dl>
    <div className="adsb">
      <strong>{track.match.status === 'matched' ? `ADS-B match · ${track.match.callsign}` : 'No ADS-B match'}</strong>
      <p>{track.match.reason}</p>
    </div>
    <div className="notes">
      <label htmlFor="sky-note">Notes (stored in this browser only)</label>
      <textarea id="sky-note" value={note} onChange={(e) => { setNote(e.target.value); writeNote(mode, track.id, e.target.value); }} placeholder="Add a note…" />
    </div>
    <div className="actions">
      <button className="chip" onClick={() => onExport('json')}>Export JSON</button>
      <button className="chip" onClick={() => onExport('csv')}>Export CSV</button>
      <button className="chip" onClick={onCopy}>Copy summary</button>
    </div>
    <div className="toast" role="status">{toast}</div>
  </div>;
}

function Timeline({ scene, t, playing, speed, onPlay, onSpeed, onStep, onScrub, refract, selectedId, modeTag }) {
  const D = scene?.duration ?? 1;
  const tracks = scene?.tracks ?? [];
  const rows = Math.min(7, Math.max(1, tracks.length));
  return <Glass as="footer" className="sky-time" refract={refract} aria-label="Timeline">
    <button className="tbtn step" onClick={() => onStep(-5)} aria-label="Step back 5 seconds">‹</button>
    <button className="tbtn play" onClick={onPlay} aria-label={playing ? 'Pause' : 'Play'}>{playing ? '❚❚' : '▶'}</button>
    <button className="tbtn step" onClick={() => onStep(5)} aria-label="Step forward 5 seconds">›</button>
    <div className="clock num">{clockText(scene, t)}<small>{modeTag} · ×{speed}</small></div>
    <div className="scrub">
      <svg viewBox={`0 0 ${D} ${rows * 4 + 2}`} preserveAspectRatio="none" aria-hidden="true">
        {tracks.map((tr, i) => <rect key={tr.id} x={tr.t0} width={tr.t1 - tr.t0} y={1 + (i % rows) * 4} height={tr.id === selectedId ? 3 : 2}
          fill={KIND_STYLE[tr.kind].color} opacity={tr.id === selectedId ? 1 : 0.5} />)}
      </svg>
      <div className="head" style={{ left: `calc(${(t / D) * 100}% - 1px)` }} />
      <input type="range" min="0" max={D} step="0.1" value={t} onChange={(e) => onScrub(Number(e.target.value))} aria-label="Scrub time" aria-valuetext={clockText(scene, t)} />
    </div>
    <div className="speeds" role="group" aria-label="Playback speed">
      {SPEEDS.map((s) => <button key={s} className="chip" aria-pressed={speed === s} onClick={() => onSpeed(s)}>×{s}</button>)}
    </div>
  </Glass>;
}

function Palette({ commands, onClose, refract }) {
  const [q, setQ] = useState(''); const [i, setI] = useState(0);
  const items = commands.filter((c) => c.name.toLowerCase().includes(q.toLowerCase())).slice(0, 40);
  const run = (c) => { onClose(); c?.run(); };
  return <>
    <div className="scrim-back" onClick={onClose} />
    <Glass className="palette" refract={refract} role="dialog" aria-label="Command palette">
      <input autoFocus value={q} onChange={(e) => { setQ(e.target.value); setI(0); }} placeholder="Type a command or track id…" aria-label="Command"
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setI((x) => Math.min(items.length - 1, x + 1)); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setI((x) => Math.max(0, x - 1)); }
          else if (e.key === 'Enter') run(items[i]);
        }} />
      <ul role="listbox">
        {items.map((c, k) => <li key={c.name} role="option" aria-selected={k === i} onMouseEnter={() => setI(k)} onClick={() => run(c)}><span>{c.name}</span><span>{c.hint}</span></li>)}
        {!items.length && <li><span>No commands match</span><span /></li>}
      </ul>
    </Glass>
  </>;
}
