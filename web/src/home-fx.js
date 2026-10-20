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
