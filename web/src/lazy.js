// Run `load` once, when `el` is about to scroll into view. Nothing below the
// first screen is on the critical path.
export function whenNear(el, load, margin = '600px 0px') {
  if (!el) return;
  if (!('IntersectionObserver' in window)) return load();
  const io = new IntersectionObserver(
    ([entry]) => {
      if (!entry.isIntersecting) return;
      io.disconnect();
      load();
    },
    { rootMargin: margin }
  );
  io.observe(el);
}
