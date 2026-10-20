// Mobile menu: the toggle button opens the nav links as a dropdown panel.
// The toggle comes before the links in the page, so Tab (and a screen
// reader's swipe) moves from it straight into the open menu.
export function initNavMenu() {
  const nav = document.querySelector('.nav');
  const toggle = document.querySelector('.nav-toggle');
  if (!nav || !toggle) return;
  const isOpen = () => nav.classList.contains('is-open');
  const set = (open) => {
    nav.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  };
  toggle.addEventListener('click', () => set(!isOpen()));
  nav.addEventListener('click', (e) => e.target.closest('a') && set(false));
  document.addEventListener('click', (e) => !nav.contains(e.target) && set(false));
  // Escape closes it and, if focus was in the menu, hands focus back to the
  // toggle instead of dropping it on the page.
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || !isOpen()) return;
    const inside = nav.contains(document.activeElement);
    set(false);
    if (inside) toggle.focus();
  });
  // Tabbing out of the menu closes it. relatedTarget is null when a tap lands
  // on the panel's padding, which must not close it.
  nav.addEventListener('focusout', (e) => e.relatedTarget && !nav.contains(e.relatedTarget) && set(false));
}

// The header tucks away while you read down the page and comes back when you
// scroll up. An open mobile menu keeps it (and its close button) on screen.
export function initHeaderAutoHide() {
  const header = document.getElementById('top-nav');
  if (!header) return;
  let lastY = window.scrollY;
  let raf = 0;
  window.addEventListener(
    'scroll',
    () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const y = window.scrollY;
        const down = y > lastY + 4;
        const up = y < lastY - 4;
        if (down && y > window.innerHeight * 0.6 && !header.querySelector('.nav.is-open')) header.classList.add('is-hidden');
        else if (up || y < 80) header.classList.remove('is-hidden');
        if (down || up) lastY = y;
      });
    },
    { passive: true }
  );
  // Keyboard users always get the nav back.
  header.addEventListener('focusin', () => header.classList.remove('is-hidden'));
}
