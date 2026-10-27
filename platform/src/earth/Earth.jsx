import React, { useEffect, useRef } from 'react';
import { VERT, FRAG } from './shader.js';
import { subsolarPoint } from './sun.js';

const RAD = Math.PI / 180;
const DAY_SRC = (w) => (w > 1100 ? '/earth/blue-marble-4k.webp' : '/earth/blue-marble-2k.webp');
const LIGHTS_SRC = '/earth/night-lights-2k.webp';

// Where the planet sits for each state of the interface, in CSS px.
function composition(mode, w, h) {
  const mobile = w < 760;
  if (mobile) {
    if (mode === 'overview') return { r: w * 0.98, cx: w * 0.64, cy: h * 0.2, dim: 0.12, viewLat: -18 };
    return { r: w * 0.95, cx: w * 0.62, cy: h * 0.3, dim: 0.35, viewLat: -18 };
  }
  if (mode === 'overview') {
    const r = Math.max(h * 0.86, w * 0.5);
    return { r, cx: w * 0.76, cy: h + r * 0.34, dim: 0, viewLat: -26 };
  }
  // Behind the frosted pane the planet becomes colour and light rather than detail.
  const r = Math.max(h * 0.78, w * 0.46);
  return { r, cx: w * 0.7, cy: h + r * 0.12, dim: mode === 'inspect' ? 0.45 : 0.25, viewLat: -20 };
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Could not load ${src}`));
    img.src = src;
  });
}

function compile(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src); gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) || 'shader compile failed');
  return s;
}

function texture(gl, img, unit) {
  const t = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0 + unit);
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const aniso = gl.getExtension('EXT_texture_filter_anisotropic');
  if (aniso) gl.texParameterf(gl.TEXTURE_2D, aniso.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(8, gl.getParameter(aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
  return t;
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
    const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, powerPreference: 'low-power', preserveDrawingBuffer: false });
    if (!gl) { onStatus?.('unsupported'); return undefined; }

    let program;
    try {
      program = gl.createProgram();
      gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERT));
      gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAG));
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) || 'link failed');
    } catch (err) {
      console.warn('[earth]', err);
      onStatus?.('unsupported');
      return undefined;
    }
    gl.useProgram(program);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(program, 'aPos');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const U = Object.fromEntries(['uDay', 'uLights', 'uRes', 'uCenter', 'uRadius', 'uView', 'uRoll', 'uSun', 'uDim', 'uGrid', 'uReveal']
      .map((n) => [n, gl.getUniformLocation(program, n)]));
    gl.uniform1i(U.uDay, 0);
    gl.uniform1i(U.uLights, 1);

    let ready = false, disposed = false, raf = 0, lastFrame = 0, lastSun = 0, lastViewReport = 0;
    let sun = subsolarPoint();
    const start = performance.now();
    const pointer = { x: 0, y: 0, sx: 0, sy: 0 };
    let cur = null;          // current (animated) composition
    let reveal = 0;
    let gridAmt = target.current.grid ? 1 : 0;

    const resize = () => {
      const dpr = Math.min(devicePixelRatio || 1, innerWidth < 760 ? 2 : 1.5);
      const w = Math.round(canvas.clientWidth * dpr), h = Math.round(canvas.clientHeight * dpr);
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      gl.viewport(0, 0, w, h);
      return dpr;
    };

    const frame = (now) => {
      raf = 0;
      if (disposed) return;
      const { mode: m, grid: gOn, reducedMotion: still } = target.current;
      const dpr = resize();
      const w = canvas.clientWidth, h = canvas.clientHeight;
      const goal = composition(m, w, h);
      if (!cur) cur = { ...goal };
      const k = still ? 1 : 1 - Math.exp(-(now - (lastFrame || now)) / 420);
      let moving = false;
      for (const key of ['r', 'cx', 'cy', 'dim', 'viewLat']) {
        const delta = goal[key] - cur[key];
        cur[key] += delta * k;
        if (Math.abs(delta) > (key === 'dim' ? 0.002 : 0.4)) moving = true;
      }
      if (ready) reveal = still ? 1 : Math.min(1, reveal + (now - (lastFrame || now)) / 1600);
      gridAmt += ((gOn ? 1 : 0) - gridAmt) * (still ? 1 : Math.min(1, k * 1.4));
      if (Math.abs((gOn ? 1 : 0) - gridAmt) > 0.01) moving = true;
      lastFrame = now;

      if (now - lastSun > 60000) { sun = subsolarPoint(); lastSun = now; }

      // The camera sits west of the sun so the terminator crosses the planet, and drifts
      // ±22° over half an hour. Pointer parallax is a degree or two at most.
      if (!still) { pointer.sx += (pointer.x - pointer.sx) * 0.05; pointer.sy += (pointer.y - pointer.sy) * 0.05; }
      const t = (now - start) / 1000;
      const drift = still ? 0 : Math.sin(t * 2 * Math.PI / 1800) * 22;
      const viewLon = sun.lon - 48 + drift + pointer.sx * 1.6;
      const viewLat = cur.viewLat - pointer.sy * 1.2;

      const sLat = sun.lat * RAD, sLon = sun.lon * RAD;
      gl.uniform3f(U.uSun, Math.cos(sLat) * Math.cos(sLon), Math.cos(sLat) * Math.sin(sLon), Math.sin(sLat));
      gl.uniform2f(U.uRes, canvas.width, canvas.height);
      gl.uniform2f(U.uCenter, (cur.cx + pointer.sx * 10) * dpr, (h - cur.cy + pointer.sy * 6) * dpr);
      gl.uniform1f(U.uRadius, cur.r * dpr);
      gl.uniform2f(U.uView, viewLat * RAD, viewLon * RAD);
      gl.uniform1f(U.uRoll, -0.16);
      gl.uniform1f(U.uDim, cur.dim);
      gl.uniform1f(U.uGrid, gridAmt * 0.11);
      gl.uniform1f(U.uReveal, reveal);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

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
    const onLost = (e) => { e.preventDefault(); onStatus?.('unsupported'); };
    addEventListener('resize', schedule);
    addEventListener('pointermove', onPointer, { passive: true });
    document.addEventListener('visibilitychange', onVisible);
    canvas.addEventListener('webglcontextlost', onLost);

    onStatus?.('loading');
    schedule();
    Promise.all([loadImage(DAY_SRC(innerWidth * Math.min(devicePixelRatio || 1, 2))), loadImage(LIGHTS_SRC)])
      .then(([day, lights]) => {
        if (disposed) return;
        texture(gl, day, 0);
        texture(gl, lights, 1);
        ready = true; lastFrame = 0;
        onStatus?.('ready');
        schedule();
      })
      .catch((err) => { console.warn('[earth]', err); if (!disposed) onStatus?.('failed'); });

    return () => {
      disposed = true;
      if (raf) { cancelAnimationFrame(raf); clearTimeout(raf); }
      removeEventListener('resize', schedule);
      removeEventListener('pointermove', onPointer);
      document.removeEventListener('visibilitychange', onVisible);
      canvas.removeEventListener('webglcontextlost', onLost);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    };
  }, []);

  return <canvas ref={canvasRef} className="earth-canvas" aria-hidden="true" />;
}
