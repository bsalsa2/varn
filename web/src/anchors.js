// Move focus with in-page links so keyboard and screen reader users land where
// the page scrolled to. The fixed header is accounted for by scroll-padding-top
// in styles.css.
import { motion } from './motion.js';

export function initAnchors() {
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
}
