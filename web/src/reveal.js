// Panels rise into place (a short fade and 16px slide) as they scroll into
// view. It is only decoration: with animation paused or reduced, without
// IntersectionObserver, or without JavaScript, everything is simply there.
export function initReveal() {
  const items = [...document.querySelectorAll('[data-reveal]')];
  if (!items.length || !('IntersectionObserver' in window)) return;
  const io = new IntersectionObserver(
    (entries) =>
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        e.target.classList.add('is-in');
        io.unobserve(e.target);
      }),
    { threshold: 0.12, rootMargin: '0px 0px -6% 0px' }
  );
  items.forEach((el) => io.observe(el));
  document.documentElement.classList.add('reveal-ready');
}
