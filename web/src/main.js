// Home page behaviour. The page is complete static HTML: everything here is an
// enhancement, and nothing waits for it. There is no scroll-jacking: content is
// visible as soon as it is in the page.
import { afterLoad, initGfx } from './gfx.js';
import { initMotion, motion } from './motion.js';
import { initReveal } from './reveal.js';
import { initNavMenu } from './nav-menu.js';
import { initScrollSpy } from './scrollspy.js';
import { initAnchors } from './anchors.js';
import { initHeader, initPoster, initProcess } from './home-fx.js';

initMotion();
initReveal();
initNavMenu();
initScrollSpy();
initAnchors();
initHeader();
initProcess();
initPoster();
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
