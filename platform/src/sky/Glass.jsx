// Liquid glass: backdrop blur + saturation, edge refraction via an SVG feDisplacementMap (Chromium),
// inner light edge, pointer-following specular, grain, depth shadow. Degrades to frosted or solid panels.
import React, { forwardRef, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';

let mapUrl = null;
// Displacement map: neutral grey in the middle, an outward-pointing vector field in a band at the edges.
function edgeMap() {
  if (mapUrl || typeof document === 'undefined') return mapUrl;
  const N = 128, cv = document.createElement('canvas'); cv.width = cv.height = N;
  const g = cv.getContext('2d'), img = g.createImageData(N, N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const u = (x + 0.5) / N, v = (y + 0.5) / N;
    const dx = u < 0.5 ? u : 1 - u, dy = v < 0.5 ? v : 1 - v;
    const band = (d) => { const k = Math.max(0, 1 - d / 0.16); return k * k * (3 - 2 * k); };
    const nx = (u < 0.5 ? -1 : 1) * band(dx), ny = (v < 0.5 ? -1 : 1) * band(dy);
    const i = (y * N + x) * 4;
    img.data[i] = 128 + nx * 127; img.data[i + 1] = 128 + ny * 127; img.data[i + 2] = 128; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  mapUrl = cv.toDataURL();
  return mapUrl;
}

export function refractionSupported() {
  if (typeof window === 'undefined' || !window.CSS?.supports) return false;
  const ua = navigator.userAgent;
  return CSS.supports('backdrop-filter', 'url(#x) blur(2px)') && /Chrome|Chromium|Edg\//.test(ua) && !/Firefox/.test(ua);
}

export const Glass = forwardRef(function Glass({ as: Tag = 'div', refract = false, strength = 34, className = '', style, children, ...rest }, outerRef) {
  const ref = useRef(null);
  const id = 'lg' + useId().replace(/[^a-zA-Z0-9]/g, '');
  const [size, setSize] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = ref.current; if (!el) return;
    const ro = new ResizeObserver(([e]) => { const b = e.borderBoxSize?.[0]; setSize({ w: Math.round(b ? b.inlineSize : el.offsetWidth), h: Math.round(b ? b.blockSize : el.offsetHeight) }); });
    ro.observe(el); return () => ro.disconnect();
  }, []);
  useEffect(() => { if (typeof outerRef === 'function') outerRef(ref.current); else if (outerRef) outerRef.current = ref.current; });
  const onPointerMove = (e) => {
    const r = ref.current.getBoundingClientRect();
    ref.current.style.setProperty('--mx', `${e.clientX - r.left}px`);
    ref.current.style.setProperty('--my', `${e.clientY - r.top}px`);
    ref.current.style.setProperty('--spec', '1');
  };
  const onPointerLeave = () => ref.current.style.setProperty('--spec', '0');
  const on = refract && size.w > 0;
  const bf = on ? `url(#${id}) blur(12px) saturate(165%) brightness(1.04)` : undefined;
  return <Tag ref={ref} className={`glass ${on ? 'is-refracting' : ''} ${className}`} style={{ ...style, ...(bf ? { backdropFilter: bf } : null) }}
    onPointerMove={onPointerMove} onPointerLeave={onPointerLeave} {...rest}>
    {on && <svg className="glass-defs" width="0" height="0" aria-hidden="true" focusable="false">
      <filter id={id} x="0" y="0" width={size.w} height={size.h} filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
        <feImage href={edgeMap()} x="0" y="0" width={size.w} height={size.h} preserveAspectRatio="none" result="map" />
        <feDisplacementMap in="SourceGraphic" in2="map" scale={strength} xChannelSelector="R" yChannelSelector="G" />
      </filter>
    </svg>}
    <span className="glass-spec" aria-hidden="true" />
    <span className="glass-grain" aria-hidden="true" />
    {children}
  </Tag>;
});

// Critically-damped-ish spring for a single number. Returns the animated value.
export function useSpring(target, { stiffness = 260, damping = 26, disabled = false } = {}) {
  const [val, setVal] = useState(target);
  const s = useRef({ x: target, v: 0, raf: 0 });
  useEffect(() => {
    if (disabled) { s.current.x = target; s.current.v = 0; setVal(target); return; }
    let last = performance.now();
    const tick = (now) => {
      const dt = Math.min(0.032, (now - last) / 1000); last = now;
      const st = s.current, f = -stiffness * (st.x - target) - damping * st.v;
      st.v += f * dt; st.x += st.v * dt;
      if (Math.abs(st.x - target) < 0.3 && Math.abs(st.v) < 0.3) { st.x = target; st.v = 0; setVal(target); return; }
      setVal(st.x); st.raf = requestAnimationFrame(tick);
    };
    cancelAnimationFrame(s.current.raf); s.current.raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(s.current.raf);
  }, [target, stiffness, damping, disabled]);
  return val;
}
