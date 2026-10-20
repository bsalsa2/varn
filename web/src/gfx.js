// Decides once whether the browser can afford frosted glass. Software
// rendering (no GPU, some VMs and low-power laptops) redraws every blur on the
// CPU each frame, so there the glass becomes solid (styles.css: .low-gfx).
// The answer is remembered for the next visit. Add ?gfx=full to the address to
// keep the glass on anyway (handy for testing), or ?gl=any to force the 3D view.
const root = document.documentElement;
const KEY = 'varn-gfx';
const SOFTWARE_GL = /swiftshader|llvmpipe|softpipe|software|basic render/i;
const forced = new URLSearchParams(location.search).get('gfx') === 'full';

try {
  if (!forced && localStorage.getItem(KEY) === 'soft') root.classList.add('low-gfx');
} catch {}

// The WebGL 2 renderer's name, or null without WebGL 2.
export function webgl2Renderer() {
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    if (!gl) return null;
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    const renderer = String(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return renderer;
  } catch {
    return null;
  }
}

// Run after load, off the critical path.
export function initGfx() {
  const renderer = webgl2Renderer();
  const soft = renderer !== null && SOFTWARE_GL.test(renderer);
  root.classList.toggle('low-gfx', soft && !forced);
  try {
    if (soft && !forced) localStorage.setItem(KEY, 'soft');
    else localStorage.removeItem(KEY);
  } catch {}
  return { renderer, soft };
}

export function afterLoad(fn) {
  const idle = window.requestIdleCallback || ((f) => setTimeout(f, 200));
  if (document.readyState === 'complete') idle(fn, { timeout: 1500 });
  else window.addEventListener('load', () => idle(fn, { timeout: 1500 }), { once: true });
}
