// Homepage behaviour. The page is complete static HTML: everything here is an
// enhancement, and nothing waits for it. There is no scroll-driven animation:
// content is visible as soon as it is in the page.
import { afterLoad, initGfx } from './gfx.js';
import { initMotion, motion } from './motion.js';
import { initReveal } from './reveal.js';
import { initNavMenu } from './nav-menu.js';
import { initScrollSpy } from './scrollspy.js';
import { initStory } from './story.js';

const reduceMotion = motion.reduced;
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

initMotion();
initReveal();
initNavMenu();
initScrollSpy();
initStory();

// "Under the hood" starts collapsed. Open it when a link points into it.
{
  const fold = document.getElementById('how-details');
  if (fold) {
    const inside = (hash) => !!hash && (hash === '#how' || fold.querySelector(hash));
    const openFor = (hash) => {
      try {
        if (inside(hash)) fold.open = true;
      } catch {}
    };
    openFor(location.hash);
    addEventListener('hashchange', () => openFor(location.hash));
    document.addEventListener('click', (e) => {
      const a = e.target.closest('a[href^="#"]');
      if (a) openFor(a.getAttribute('href'));
    });
  }
}

// Move focus with in-page links so keyboard and screen reader users land
// where the page scrolled to. The sticky header is accounted for by
// scroll-padding-top in styles.css.
document.addEventListener('click', (e) => {
  const link = e.target.closest('a[href^="#"]');
  if (!link || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const hash = link.getAttribute('href');
  const target = hash.length > 1 && document.getElementById(decodeURIComponent(hash.slice(1)));
  if (!target) return;
  e.preventDefault();
  target.scrollIntoView({ behavior: motion.paused || hash === '#main' ? 'auto' : 'smooth' });
  if (location.hash !== hash) history.pushState(null, '', hash);
  if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
  target.focus({ preventScroll: true });
});

// Real footage (when content.js has it) plays muted, unless animation is off.
const footage = document.querySelector('.hero-video');
if (footage) {
  const sync = () => {
    footage.controls = motion.paused;
    if (motion.paused) footage.pause();
    else footage.play().catch(() => (footage.controls = true));
  };
  sync();
  motion.subscribe(sync);
}

// ---------------------------------------------------------------------------
// Lazy pieces: never on the critical path.
// ---------------------------------------------------------------------------
// Load a module when its element is about to scroll into view.
const whenNear = (el, load) => {
  if (!el) return;
  const io = new IntersectionObserver(
    ([entry]) => {
      if (!entry.isIntersecting) return;
      io.disconnect();
      load();
    },
    { rootMargin: '600px 0px' }
  );
  io.observe(el);
};

// Hero lens: the simulated sky, and the card that follows it.
afterLoad(() => {
  const lens = document.getElementById('lens');
  const canvas = document.getElementById('lens-canvas');
  if (!lens || !canvas) return;
  import('./hero-lens.js')
    .then(({ createLens }) => createLens({ lens, canvas, card: document.getElementById('sighting'), reduceMotion }))
    .catch((err) => console.warn('[varn] hero lens unavailable.', err));
});

// Simulated radar-style plot.
whenNear(document.getElementById('radar'), () =>
  import('./radar.js')
    .then(({ createRadar }) => createRadar({ root: document.getElementById('radar'), reduceMotion }))
    .catch((err) => console.warn('[varn] radar view unavailable.', err))
);

// Simulated sensor view.
whenNear(document.getElementById('sensor'), () =>
  import('./sensor.js')
    .then(({ createSensor }) => createSensor({ root: document.getElementById('sensor'), reduceMotion }))
    .catch((err) => console.warn('[varn] sensor view unavailable.', err))
);

// Pan-tilt mount viewer (three.js). Only hardware-accelerated WebGL 2:
// software renderers would grind the main thread, so they keep the still.
// Add ?gl=any to the URL to force it anyway (handy for testing).
afterLoad(() => {
  const { renderer, soft } = initGfx();
  const stage = document.getElementById('mount-stage');
  const forced = new URLSearchParams(location.search).get('gl') === 'any';
  if (!stage || renderer === null || (soft && !forced)) return;
  const parts = [...document.querySelectorAll('.mount-parts li')];
  const controls = document.querySelector('.mount-controls');
  whenNear(stage, () =>
    import('./mount.js')
      .then(({ createMount }) =>
        createMount({
          container: stage,
          url: new URL('models/pantilt.bin', document.baseURI).href,
          reduceMotion,
          finePointer,
          onTooSlow: () => {
            stage.classList.remove('is-ready');
            stage.removeAttribute('tabindex');
            stage.removeAttribute('role');
            stage.removeAttribute('aria-label');
            if (controls) controls.hidden = true;
            document.querySelectorAll('.mount-parts li').forEach((li) => li.removeAttribute('tabindex'));
          },
        })
      )
      .then((mount) => {
        stage.classList.add('is-ready');
        // Reachable from the keyboard only once there is a model to turn.
        stage.tabIndex = 0;
        stage.setAttribute('role', 'group');
        stage.setAttribute('aria-label', '3D view of the pan-tilt mount. The left and right arrow keys turn it.');
        // Buttons for anyone who cannot or would rather not drag.
        if (controls) {
          controls.hidden = false;
          controls.addEventListener('click', (e) => {
            const b = e.target.closest('[data-turn]');
            if (!b) return;
            const step = Number(b.dataset.turn);
            if (step) mount.turn(step);
            else mount.reset();
          });
        }
        // A mouse highlights a part while hovering its row. Touch can't
        // hover (the browser sends leave right after the tap), so a tap
        // toggles the highlight instead.
        let current = -1;
        let lastType = 'mouse';
        const show = (i) => {
          current = i;
          parts.forEach((el, k) => el.classList.toggle('is-active', k === i));
          mount.setActive(i);
        };
        parts.forEach((li, i) => {
          let before = -1;
          li.addEventListener('pointerdown', (e) => {
            lastType = e.pointerType;
            before = current; // a tap focuses the row first; decide from the state before it
          });
          li.addEventListener('pointerenter', (e) => e.pointerType === 'mouse' && show(i));
          li.addEventListener('pointerleave', (e) => e.pointerType === 'mouse' && show(-1));
          li.addEventListener('click', () => lastType !== 'mouse' && show(before === i ? -1 : i));
          // Keyboard: focusing a part's row highlights it in the model.
          li.tabIndex = 0;
          li.addEventListener('focus', () => li.matches(':focus-visible') && show(i));
          li.addEventListener('blur', () => show(-1));
        });
      })
      .catch((err) => console.warn('[varn] mount viewer unavailable, keeping the still.', err))
  );
});
