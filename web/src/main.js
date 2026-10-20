// Home page behaviour. The page is complete static HTML: everything here is an
// enhancement, and nothing waits for it. There is no scroll-jacking: content is
// visible as soon as it is in the page.
import { afterLoad, initGfx } from './gfx.js';
import { initMotion, motion } from './motion.js';
import { initReveal } from './reveal.js';
import { initNavMenu } from './nav-menu.js';
import { initScrollSpy } from './scrollspy.js';
import { initAnchors } from './anchors.js';
import { whenNear } from './lazy.js';
import { initHeader, initProcess } from './home-fx.js';

initMotion();
initReveal();
initNavMenu();
initScrollSpy();
initAnchors();
initHeader();
initProcess();
afterLoad(initGfx);

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

// The dashboard preview (and its styles) load when it is about to be seen.
whenNear(
  document.getElementById('pv'),
  () =>
    import('./platform-preview.js')
      .then(({ createPreview }) => createPreview(document.getElementById('pv')))
      .catch((err) => {
        console.warn('[varn] dashboard preview unavailable.', err);
        const loading = document.querySelector('[data-pv="loading"]');
        if (loading) loading.textContent = 'The simulated preview could not load. The full demo is one click away.';
      }),
  '800px 0px'
);
