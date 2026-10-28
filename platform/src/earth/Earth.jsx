import React, { useEffect, useRef } from 'react';
import { createEarthRenderer, sunVector } from './renderer.js';
import { subsolarPoint } from './sun.js';

// Where the planet sits for each state of the interface, in CSS px.
function composition(mode, w, h) {
  const mobile = w < 760;
  if (mobile) {
    if (mode === 'overview') return { r: w * 0.98, cx: w * 0.64, cy: h * 0.2, dim: 0.12, viewLat: -18 };
    return { r: w * 0.98, cx: w * 0.64, cy: h * 0.2, dim: 0.35, viewLat: -18 };
  }
  if (mode === 'overview') {
    const r = Math.max(h * 0.86, w * 0.5);
    return { r, cx: w * 0.76, cy: h + r * 0.34, dim: 0, viewLat: -26 };
  }
  // Work pages keep the planet exactly where Overview put it and only quiet it down, so
  // changing page never sends it sliding across the screen.
  return { ...composition('overview', w, h), dim: mode === 'inspect' ? 0.45 : 0.22 };
}

/**
 * The planet behind the workspace. Imagery: NASA Blue Marble (day) and NASA Earth at Night
 * (city lights), both public domain. The sun direction is computed for the current UTC time;
 * the view itself is a slow, deliberate camera drift, not a live feed.
 */
export default function Earth({ mode, grid, reducedMotion, onStatus, onView }) {
  const canvasRef = useRef(null);
  const target = useRef({ mode, grid, reducedMotion });
  target.current = { mode, grid, reducedMotion };
  const wake = useRef(() => {});

  useEffect(() => { wake.current(); }, [mode, grid, reducedMotion]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const earth = createEarthRenderer(canvas, { onLost: () => onStatus?.('unsupported') });
    if (!earth) { onStatus?.('unsupported'); return undefined; }

    let ready = false, disposed = false, raf = 0, lastFrame = 0, lastSun = 0, lastViewReport = 0;
    let sun = subsolarPoint();
    const start = performance.now();
    const pointer = { x: 0, y: 0, sx: 0, sy: 0 };
    let cur = null;          // current (animated) composition
    let reveal = 0;
    let gridAmt = target.current.grid ? 1 : 0;

    const frame = (now) => {
      raf = 0;
      if (disposed) return;
      const { mode: m, grid: gOn, reducedMotion: still } = target.current;
      earth.resize(innerWidth < 760 ? 2 : 1.5);
      const w = canvas.clientWidth, h = canvas.clientHeight;
      const goal = composition(m, w, h);
      if (!cur) cur = { ...goal };
      // dt is capped so a throttled or backgrounded tab eases back instead of jumping.
      const dt = Math.min(50, now - (lastFrame || now));
      const k = still ? 1 : 1 - Math.exp(-dt / 420);
      let moving = false;
      for (const key of ['r', 'cx', 'cy', 'dim', 'viewLat']) {
        const delta = goal[key] - cur[key];
        cur[key] += delta * k;
        if (Math.abs(delta) > (key === 'dim' ? 0.002 : 0.4)) moving = true;
      }
      if (ready) reveal = still ? 1 : Math.min(1, reveal + dt / 1600);
      gridAmt += ((gOn ? 1 : 0) - gridAmt) * (still ? 1 : Math.min(1, k * 1.4));
      if (Math.abs((gOn ? 1 : 0) - gridAmt) > 0.01) moving = true;
      lastFrame = now;

      if (now - lastSun > 60000) { sun = subsolarPoint(); lastSun = now; }

      // The camera sits west of the sun so the terminator crosses the planet, and drifts
      // ±22° over half an hour. Pointer parallax turns the camera by a degree at most.
      if (!still) { pointer.sx += (pointer.x - pointer.sx) * 0.05; pointer.sy += (pointer.y - pointer.sy) * 0.05; }
      const t = (now - start) / 1000;
      const drift = still ? 0 : Math.sin(t * 2 * Math.PI / 1800) * 22;
      const viewLon = sun.lon - 48 + drift + pointer.sx * 1.2;
      const viewLat = cur.viewLat - pointer.sy * 0.8;

      earth.draw({ cx: cur.cx, cy: cur.cy, r: cur.r, viewLat, viewLon, roll: -0.16, sun: sunVector(sun), dim: cur.dim, grid: gridAmt * 0.11, reveal });

      if (now - lastViewReport > 1000) { lastViewReport = now; onView?.({ lat: viewLat, lon: viewLon, sun }); }

      const settling = moving || (ready && reveal < 1);
      if (!document.hidden && (!still || settling)) {
        // A slow drift needs ~30 fps at most; transitions run at the display rate.
        if (settling) raf = requestAnimationFrame(frame);
        else raf = setTimeout(() => { raf = requestAnimationFrame(frame); }, 33);
      }
    };

    const schedule = () => { if (!raf && !disposed) raf = requestAnimationFrame(frame); };
    wake.current = schedule;

    const onPointer = (e) => {
      if (target.current.reducedMotion || e.pointerType === 'touch') return;
      pointer.x = (e.clientX / innerWidth) * 2 - 1;
      pointer.y = (e.clientY / innerHeight) * 2 - 1;
    };
    const onVisible = () => { if (!document.hidden) { lastFrame = 0; schedule(); } };
    addEventListener('resize', schedule);
    addEventListener('pointermove', onPointer, { passive: true });
    document.addEventListener('visibilitychange', onVisible);

    onStatus?.('loading');
    schedule();
    earth.ready
      .then(() => { if (disposed) return; ready = true; lastFrame = 0; onStatus?.('ready'); schedule(); })
      .catch((err) => { console.warn('[earth]', err); if (!disposed) onStatus?.('failed'); });

    return () => {
      disposed = true;
      if (raf) { cancelAnimationFrame(raf); clearTimeout(raf); }
      removeEventListener('resize', schedule);
      removeEventListener('pointermove', onPointer);
      document.removeEventListener('visibilitychange', onVisible);
      earth.dispose();
    };
  }, []);

  return <canvas ref={canvasRef} className="earth-canvas" aria-hidden="true" />;
}
