// WebGL 2 planet renderer shared by the Command Center backdrop and the Sky satellite descent.
// One full-screen triangle and the analytic sphere shader in shader.js; no 3D library.
import { VERT, FRAG } from './shader.js';

const RAD = Math.PI / 180;
export const DAY_SRC = (w) => (w > 1100 ? '/earth/blue-marble-4k.webp' : '/earth/blue-marble-2k.webp');
export const LIGHTS_SRC = '/earth/night-lights-2k.webp';

export function loadImage(src) {
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

export const sunVector = ({ lat, lon }) => [Math.cos(lat * RAD) * Math.cos(lon * RAD), Math.cos(lat * RAD) * Math.sin(lon * RAD), Math.sin(lat * RAD)];

/**
 * Returns null when WebGL 2 is unavailable. Otherwise { ready, draw, resize, dispose }.
 * draw() takes CSS-px geometry; the caller decides the drawing-buffer scale through resize(dpr).
 */
export function createEarthRenderer(canvas, { onLost } = {}) {
  const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, powerPreference: 'low-power' });
  if (!gl) return null;
  let program;
  try {
    program = gl.createProgram();
    gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERT));
    gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) || 'link failed');
  } catch (err) {
    console.warn('[earth]', err);
    return null;
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

  let dpr = 1;
  const lost = (e) => { e.preventDefault(); onLost?.(); };
  canvas.addEventListener('webglcontextlost', lost);

  const ready = Promise.all([loadImage(DAY_SRC(innerWidth * Math.min(devicePixelRatio || 1, 2))), loadImage(LIGHTS_SRC)])
    .then(([day, lights]) => { texture(gl, day, 0); texture(gl, lights, 1); });

  return {
    ready,
    resize(maxDpr) {
      dpr = Math.min(devicePixelRatio || 1, maxDpr);
      const w = Math.round(canvas.clientWidth * dpr), h = Math.round(canvas.clientHeight * dpr);
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      gl.viewport(0, 0, w, h);
      return dpr;
    },
    /** cx, cy, r in CSS px (cy from the top); viewLat/viewLon in degrees; sun as a unit vector. */
    draw({ cx, cy, r, viewLat, viewLon, roll = 0, sun, dim = 0, grid = 0, reveal = 1 }) {
      const h = canvas.clientHeight;
      gl.uniform3f(U.uSun, sun[0], sun[1], sun[2]);
      gl.uniform2f(U.uRes, canvas.width, canvas.height);
      gl.uniform2f(U.uCenter, cx * dpr, (h - cy) * dpr);
      gl.uniform1f(U.uRadius, r * dpr);
      gl.uniform2f(U.uView, viewLat * RAD, viewLon * RAD);
      gl.uniform1f(U.uRoll, roll);
      gl.uniform1f(U.uDim, dim);
      gl.uniform1f(U.uGrid, grid);
      gl.uniform1f(U.uReveal, reveal);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
    dispose() {
      canvas.removeEventListener('webglcontextlost', lost);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    },
  };
}
