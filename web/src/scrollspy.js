// Marks the nav link for the part of the page you are reading. Each section
// that belongs under a link says so with data-spy="<link's #id>". The band is
// a thin line across the screen: the section under it is the current one.
export function initScrollSpy() {
  const links = [...document.querySelectorAll('.nav-link')].filter((l) => l.getAttribute('href').startsWith('#'));
  const sections = [...document.querySelectorAll('[data-spy]')];
  if (!links.length || !sections.length || !('IntersectionObserver' in window)) return;
  const under = new Set();
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => (e.isIntersecting ? under.add(e.target) : under.delete(e.target)));
      const current = sections.find((s) => under.has(s));
      links.forEach((l) => {
        if (current && l.getAttribute('href') === `#${current.dataset.spy}`) l.setAttribute('aria-current', 'true');
        else l.removeAttribute('aria-current');
      });
    },
    { rootMargin: '-35% 0px -64% 0px' }
  );
  sections.forEach((s) => io.observe(s));
}
