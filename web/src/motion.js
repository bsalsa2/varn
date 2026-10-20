// Site-wide animation switch. Anything that keeps moving for more than five
// seconds can be paused (WCAG 2.2.2), and visitors who have asked their device
// for reduced motion start paused and are never offered the button.
//
// CSS reads the classes on <html>: .js-motion while animation is on, and
// .motion-off while it is paused. The looping canvases subscribe instead.
const root = document.documentElement;
const query = window.matchMedia('(prefers-reduced-motion: reduce)');
const listeners = new Set();
let paused = query.matches;

function apply() {
  root.classList.toggle('js-motion', !paused);
  root.classList.toggle('motion-off', paused);
  document.querySelectorAll('[data-motion]').forEach((b) => {
    b.textContent = paused ? 'Play animation' : 'Pause animation';
  });
  listeners.forEach((fn) => fn(paused));
}

export const motion = {
  get paused() {
    return paused;
  },
  // True when the device asks for reduced motion: still pictures only.
  get reduced() {
    return query.matches;
  },
  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  set(next) {
    if (next === paused) return;
    paused = next;
    apply();
  },
  toggle() {
    motion.set(!paused);
  },
};

// Reveals every [data-motion] button (they ship hidden) and wires them up.
export function initMotion() {
  apply();
  query.addEventListener?.('change', (e) => motion.set(e.matches));
  if (query.matches) return;
  document.querySelectorAll('[data-motion]').forEach((b) => {
    b.hidden = false;
    b.addEventListener('click', () => motion.toggle());
  });
}
