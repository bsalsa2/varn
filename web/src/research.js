// Research page behaviour. Like the home page it is complete static HTML; this
// only adds the step explainer, the simulated views and the 3D mount viewer.
import { afterLoad, initGfx } from './gfx.js';
import { initMotion, motion } from './motion.js';
import { initReveal } from './reveal.js';
import { initNavMenu } from './nav-menu.js';
import { initAnchors } from './anchors.js';
import { initStory } from './story.js';
import { whenNear } from './lazy.js';
import './research.css';

const reduceMotion = motion.reduced;
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

initMotion();
initReveal();
initNavMenu();
initAnchors();
initStory();

// The simulated views start collapsed. Open them when a link points into them.
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

// ---------------------------------------------------------------------------
// Lazy pieces: never on the critical path.
// ---------------------------------------------------------------------------
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
