// Quiet motion for the home page. All of it is decoration: content is fully
// visible without it, and every effect stands down when animation is paused
// or the device asks for reduced motion (motion.js).
import { motion } from './motion.js';

// The header is transparent over the hero and becomes dark glass once the
// page has moved. One passive scroll listener, throttled to a frame.
export function initHeader() {
  const header = document.querySelector('.site-header');
  if (!header || header.classList.contains('is-solid')) return;
  let ticking = false;
  const update = () => {
    ticking = false;
    header.classList.toggle('is-scrolled', window.scrollY > 24);
  };
  addEventListener(
    'scroll',
    () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    },
    { passive: true }
  );
  update();
}

// The line through the three stages lights up as each stage reaches the
// reading area. Without JavaScript, or with motion off, the whole line is lit.
export function initProcess() {
  const root = document.getElementById('proc');
  if (!root || !('IntersectionObserver' in window) || motion.paused) return;
  const stages = [...root.querySelectorAll('.proc-stage')];
  root.classList.add('is-animated');
  const lit = new Set();
  const paint = () => {
    root.style.setProperty('--lit', String(lit.size));
    stages.forEach((s, i) => s.classList.toggle('is-lit', lit.has(i)));
  };
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        const i = stages.indexOf(e.target);
        if (e.isIntersecting) lit.add(i); // once lit, a stage stays lit
      });
      // A stage lights once every stage before it has.
      for (let i = stages.length - 1; i > 0; i--) if (lit.has(i)) lit.add(i - 1);
      paint();
    },
    { rootMargin: '0px 0px -30% 0px', threshold: 0.35 }
  );
  stages.forEach((s) => io.observe(s));
  // If the visitor pauses animation later, show the finished line.
  motion.subscribe((paused) => {
    if (!paused) return;
    io.disconnect();
    root.classList.remove('is-animated');
    root.style.removeProperty('--lit');
    stages.forEach((s) => s.classList.remove('is-lit'));
  });
}

// The big shapes: the dashboard frame tilts a few degrees toward the pointer,
// the outlined word behind the approach drifts with scroll, and the two result
// figures count up once when they arrive. Fine pointers only for the tilt; all
// of it stops when animation is paused or reduced.
export function initPoster() {
  const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const pv = document.getElementById('pv');
  if (pv && fine) {
    let raf = 0;
    pv.addEventListener('pointermove', (e) => {
      if (motion.paused || e.pointerType !== 'mouse') return;
      const r = pv.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        pv.style.transform = `perspective(1400px) rotateY(${(x * 5).toFixed(2)}deg) rotateX(${(-y * 4).toFixed(2)}deg)`;
      });
    });
    pv.addEventListener('pointerleave', () => {
      cancelAnimationFrame(raf);
      pv.style.transform = '';
    });
  }

  const ghost = document.querySelector('.proc-ghost');
  if (ghost && !motion.paused) {
    let ticking = false;
    const update = () => {
      ticking = false;
      const r = ghost.parentElement.getBoundingClientRect();
      const t = (innerHeight - r.top) / (innerHeight + r.height);
      ghost.style.setProperty('--gx', `${(-t * 40 + 8).toFixed(1)}vw`);
    };
    addEventListener(
      'scroll',
      () => {
        if (motion.paused || ticking) return;
        ticking = true;
        requestAnimationFrame(update);
      },
      { passive: true }
    );
    update();
  }

  const figs = [...document.querySelectorAll('.snap-value')];
  if (figs.length && 'IntersectionObserver' in window && !motion.paused) {
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          io.unobserve(e.target);
          const el = e.target;
          const final = el.textContent;
          const end = parseFloat(final);
          if (!Number.isFinite(end) || motion.paused) return;
          const dec = (final.split('.')[1] || '').replace(/\D/g, '').length;
          const t0 = performance.now();
          const step = (now) => {
            const k = Math.min(1, (now - t0) / 1500);
            const v = end * (1 - Math.pow(1 - k, 4));
            el.textContent = k < 1 ? `${v.toFixed(dec)}%` : final;
            if (k < 1) requestAnimationFrame(step);
          };
          requestAnimationFrame(step);
        }),
      { threshold: 0.6 }
    );
    figs.forEach((f) => io.observe(f));
  }
}
