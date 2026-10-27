// Liquid glass: backdrop blur + saturation, edge refraction via an SVG feDisplacementMap (Chromium),
// inner light edge, pointer-following specular, grain, depth shadow. Degrades to frosted or solid panels.
import React, { forwardRef, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export function refractionSupported() {
  if (typeof window === 'undefined' || !window.CSS?.supports) return false;
  const ua = navigator.userAgent;
  return CSS.supports('backdrop-filter', 'url(#x) blur(2px)') && /Chrome|Chromium|Edg\//.test(ua) && !/Firefox/.test(ua);
}

export const Glass = forwardRef(function Glass({ as: Tag = 'div', refract = false, strength = 70, className = '', style, children, ...rest }, outerRef) {
  const ref = useRef(null);
  const baseId = 'lg' + useId().replace(/[^a-zA-Z0-9]/g, '');
  const [size, setSize] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = ref.current; if (!el) return;
    const ro = new ResizeObserver(([e]) => { const b = e.borderBoxSize?.[0]; const q = (v) => Math.ceil(v / 8) * 8; setSize({ w: q(b ? b.inlineSize : el.offsetWidth), h: q(b ? b.blockSize : el.offsetHeight) }); });
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
  const band = Math.min(26, Math.round(Math.min(size.w, size.h) * 0.18));
  // Chromium caches a resolved backdrop filter; a size-keyed id forces it to pick up the resized map.
  const id = `${baseId}-${size.w}x${size.h}`;
  const bf = on ? `url(#${id}) blur(3px) saturate(170%) brightness(1.08)` : undefined;
  return <Tag ref={ref} className={`glass ${on ? 'is-refracting' : ''} ${className}`} style={{ ...style, ...(bf ? { backdropFilter: bf } : null) }}
    onPointerMove={onPointerMove} onPointerLeave={onPointerLeave} {...rest}>
    {on && createPortal(<svg className="glass-defs" width="0" height="0" aria-hidden="true" focusable="false">
      <filter id={id} x="0" y="0" width={size.w} height={size.h} filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
        {/* Edge field built in-filter (no image to load): neutral grey, outward vectors in a band at each edge, blurred to a smooth falloff. */}
        <feFlood floodColor="rgb(128,128,128)" result="base" />
        <feFlood x="0" y="0" width={band} height={size.h} floodColor="rgb(0,128,128)" result="l" />
        <feFlood x={size.w - band} y="0" width={band} height={size.h} floodColor="rgb(255,128,128)" result="r" />
        <feFlood x="0" y="0" width={size.w} height={band} floodColor="rgb(128,0,128)" result="t" />
        <feFlood x="0" y={size.h - band} width={size.w} height={band} floodColor="rgb(128,255,128)" result="b" />
        <feMerge result="edges"><feMergeNode in="base" /><feMergeNode in="l" /><feMergeNode in="r" /><feMergeNode in="t" /><feMergeNode in="b" /></feMerge>
        <feGaussianBlur in="edges" stdDeviation={band / 2.2} edgeMode="duplicate" result="map" />
        <feDisplacementMap in="SourceGraphic" in2="map" scale={strength} xChannelSelector="R" yChannelSelector="G" />
      </filter>
    </svg>, document.body)}
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
