// Move focus with in-page links so keyboard and screen reader users land where
// the page scrolled to. The fixed header is accounted for by scroll-padding-top
// in styles.css.
import { motion } from './motion.js';

// "#top" only means "scroll to the top"; it is not a place worth putting in the
// address bar (or reloading into), so it is kept out of the URL.
const dropHash = () => history.replaceState(null, '', location.pathname + location.search);

export function initAnchors() {
  if (location.hash === '#top') dropHash();
  document.addEventListener('click', (e) => {
    const link = e.target.closest('a[href^="#"]');
    if (!link || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const hash = link.getAttribute('href');
    const target = hash.length > 1 && document.getElementById(decodeURIComponent(hash.slice(1)));
    if (!target) return;
    e.preventDefault();
    target.scrollIntoView({ behavior: motion.paused || hash === '#main' ? 'auto' : 'smooth' });
    if (hash === '#top') {
      if (location.hash) dropHash();
    } else if (location.hash !== hash) history.pushState(null, '', hash);
    if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
  });
}
