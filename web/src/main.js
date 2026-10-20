import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { initHeaderAutoHide, initNavMenu } from './nav-menu.js';

const root = document.documentElement;
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
// The pinned story needs this much room; keep in step with .story--pinned in styles.css.
const STORY_PIN_QUERY = '(min-width: 901px) and (min-height: 650px)';

if (!reduceMotion) root.classList.add('js-motion');
// Everything below decides once, at load, whether to animate. If the visitor
// turns on "reduce motion" while the page is open, start over without it.
window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener?.('change', (e) => e.matches && location.reload());

// Software rendering (no GPU, e.g. some low-power laptops and VMs): frosted
// glass over moving canvases costs most of each frame there, so it is turned
// off (styles.css: .low-gfx). The check needs a WebGL context, which is too
// slow for startup, so it runs after load (see the mount viewer below) and is
// remembered for the next page view.
const GFX_KEY = 'varn-gfx';
try {
  if (localStorage.getItem(GFX_KEY) === 'soft') root.classList.add('low-gfx');
} catch {}

// Looping CSS animations (radar sweeps, pulsing dots, the ticker) keep the
// browser repainting every frame even when they are far off screen, which
// costs phones and slow laptops battery and smoothness. Pause everything
// inside a section while it is out of view.
if (!reduceMotion && 'IntersectionObserver' in window) {
  const io = new IntersectionObserver(
    (entries) => entries.forEach((e) => e.target.classList.toggle('is-offscreen', !e.isIntersecting)),
    { rootMargin: '100px 0px' }
  );
  document.querySelectorAll('main section, .ticker').forEach((el) => io.observe(el));
}

// ---------------------------------------------------------------------------
// Scroll progress bar (cheap: one custom property per frame).
// ---------------------------------------------------------------------------
{
  const bar = document.getElementById('progress');
  let ticking = false;
  const update = () => {
    ticking = false;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    bar?.style.setProperty('--p', max > 0 ? Math.min(1, window.scrollY / max).toFixed(4) : '0');
  };
  window.addEventListener(
    'scroll',
    () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    },
    { passive: true }
  );
  update();
}

// Split text for reveals. The element keeps its text for screen readers via
// aria-label; the pieces are hidden from them.
function splitChars(el) {
  const text = el.textContent;
  el.textContent = '';
  const out = [];
  for (const ch of text) {
    const span = document.createElement('span');
    span.className = 'ch';
    span.setAttribute('aria-hidden', 'true');
    span.textContent = ch === ' ' ? '\u00a0' : ch;
    el.append(span);
    out.push(span);
  }
  return out;
}
// A CSS colour (custom properties and color-mix included) as rgb(), which
// GSAP can tween. Browsers report color-mix results as color(srgb 0-1 ...).
function cssColor(value) {
  const probe = document.createElement('i');
  probe.style.color = value;
  document.body.append(probe);
  const c = getComputedStyle(probe).color;
  probe.remove();
  const n = (c.match(/[\d.]+/g) || ['0', '0', '0']).slice(0, 3).map(Number);
  const rgb = c.startsWith('color(') ? n.map((v) => Math.round(v * 255)) : n.map(Math.round);
  return `rgb(${rgb.join(', ')})`;
}
function splitWords(el) {
  const text = el.textContent.trim();
  el.setAttribute('aria-label', text);
  el.textContent = '';
  const out = [];
  text.split(/\s+/).forEach((word, i, all) => {
    const wrap = document.createElement('span');
    wrap.className = 'sw';
    wrap.setAttribute('aria-hidden', 'true');
    const inner = document.createElement('span');
    inner.className = 'sw-in';
    inner.textContent = word;
    wrap.append(inner);
    el.append(wrap);
    if (i < all.length - 1) el.append(' ');
    out.push(inner);
  });
  return out;
}

// ---------------------------------------------------------------------------
// Liquid-glass refraction: only Chromium renders SVG filters inside
// backdrop-filter. Safari and Firefox parse the rule but drop the whole
// backdrop, so gate it on a Chromium-only API and keep plain blur elsewhere.
// ---------------------------------------------------------------------------
if (
  !root.classList.contains('low-gfx') &&
  'userAgentData' in navigator &&
  window.CSS?.supports?.('backdrop-filter', 'url(#sn-liquid) blur(1px)')
) {
  root.classList.add('has-refraction');
}

// ---------------------------------------------------------------------------
// Nav: tucks away while you read down the page, comes back when you scroll
// up. Highlights the section you're in.
// ---------------------------------------------------------------------------
initHeaderAutoHide();

const navLinks = [...document.querySelectorAll('.nav-link')].filter((l) => l.getAttribute('href').startsWith('#'));
const sectionFor = new Map(
  navLinks.map((link) => [document.querySelector(link.getAttribute('href')), link]).filter(([s]) => s)
);
// The "About me" card sits under the Status link.
const statusLink = sectionFor.get(document.getElementById('status'));
if (statusLink) sectionFor.set(document.getElementById('build'), statusLink);
{
  const visible = new Set();
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => (e.isIntersecting ? visible.add(e.target) : visible.delete(e.target)));
      const current = [...sectionFor.keys()].find((s) => visible.has(s));
      navLinks.forEach((l) => l.removeAttribute('aria-current'));
      if (current) sectionFor.get(current).setAttribute('aria-current', 'true');
    },
    { rootMargin: '-45% 0px -50% 0px' }
  );
  sectionFor.forEach((_, section) => section && io.observe(section));
}

// Move focus with in-page links so keyboard and screen reader users land
// where the page scrolled to.
// Smooth scrolling is done here rather than with CSS scroll-behavior: the CSS
// version also animates the jump to a #section when arriving from another
// page, and ScrollTrigger's refresh on load cuts that short at the top.
document.addEventListener('click', (e) => {
  const link = e.target.closest('a[href^="#"]');
  if (!link || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const hash = link.getAttribute('href');
  const target = hash.length > 1 && document.getElementById(decodeURIComponent(hash.slice(1)));
  if (!target) return;
  e.preventDefault();
  target.scrollIntoView({ behavior: reduceMotion || hash === '#main' ? 'auto' : 'smooth' });
  if (location.hash !== hash) history.pushState(null, '', hash);
  if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
  target.focus({ preventScroll: true });
});

// ---------------------------------------------------------------------------
// Micro-interactions (fine pointers only).
// ---------------------------------------------------------------------------
if (finePointer && !reduceMotion) {
  // Magnetic buttons: drift toward the cursor, spring back on leave.
  document.querySelectorAll('.magnetic').forEach((btn) => {
    btn.addEventListener('pointermove', (e) => {
      const r = btn.getBoundingClientRect();
      btn.style.setProperty('--mx', `${((e.clientX - (r.left + r.width / 2)) * 0.3).toFixed(1)}px`);
      btn.style.setProperty('--my', `${((e.clientY - (r.top + r.height / 2)) * 0.3).toFixed(1)}px`);
    });
    btn.addEventListener('pointerleave', () => {
      btn.style.setProperty('--mx', '0px');
      btn.style.setProperty('--my', '0px');
    });
  });
}

if (finePointer) {
  // Glass: the light follows the cursor; the panel tilts when motion is OK.
  document.querySelectorAll('.tilt').forEach((card) => {
    let raf = 0;
    card.addEventListener('pointermove', (e) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const r = card.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width;
        const py = (e.clientY - r.top) / r.height;
        card.style.setProperty('--mx', `${(px * 100).toFixed(1)}%`);
        card.style.setProperty('--my', `${(py * 100).toFixed(1)}%`);
        if (!reduceMotion) {
          card.classList.add('is-tilting');
          card.style.setProperty('--rx', `${((0.5 - py) * 6).toFixed(2)}deg`);
          card.style.setProperty('--ry', `${((px - 0.5) * 8).toFixed(2)}deg`);
        }
      });
    });
    card.addEventListener('pointerleave', () => {
      cancelAnimationFrame(raf);
      card.classList.remove('is-tilting');
      card.style.setProperty('--rx', '0deg');
      card.style.setProperty('--ry', '0deg');
    });
  });
}

// ---------------------------------------------------------------------------
// Count-up for the cost numbers: "$10,000s" counts from $0 to $10,000s.
// ---------------------------------------------------------------------------
function countUp(el, duration = 1.6) {
  const m = /^(\D*)([\d,]+(?:\.\d+)?)(.*)$/.exec(el.dataset.count || '');
  if (!m) return;
  const [, pre, num, post] = m;
  const target = parseFloat(num.replace(/,/g, ''));
  const decimals = (num.split('.')[1] || '').length;
  const fmt = (v) =>
    pre + v.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) + post;
  const state = { v: 0 };
  el.textContent = fmt(0);
  gsap.to(state, {
    v: target,
    duration,
    ease: 'expo.out',
    onUpdate: () => (el.textContent = fmt(state.v)),
    onComplete: () => (el.textContent = el.dataset.count),
  });
}

// ---------------------------------------------------------------------------
// Scroll story (GSAP + ScrollTrigger). Skipped entirely for reduced motion:
// the page is complete and readable without it.
// ---------------------------------------------------------------------------
if (!reduceMotion) {
  gsap.registerPlugin(ScrollTrigger);
  const ease = 'expo.out';

  // ---- Hero entrance. Opacity starts just above zero so the browser still
  // counts the headline as painted immediately (keeps LCP fast).
  // The headline is split into one span per letter for the entrance. Screen
  // readers get the whole sentence from a visually hidden copy instead (an
  // aria-label on a plain span is not allowed and is often ignored).
  const heroTitle = document.querySelector('.hero-title');
  if (heroTitle) {
    const said = document.createElement('span');
    said.className = 'sr-only';
    said.textContent = heroTitle.textContent.replace(/\s+/g, ' ').trim();
    heroTitle.querySelectorAll('.line').forEach((line) => line.setAttribute('aria-hidden', 'true'));
    heroTitle.append(said);
  }
  // On a slow connection the hero has usually been on screen, readable, for a
  // while before this script runs; hiding it to replay the entrance would
  // read as a glitch. So the entrance only plays on a quick start.
  if (performance.now() < 1500) {
    const heroChars = [...document.querySelectorAll('.hero-title .line-in')].flatMap(splitChars);
    gsap.from(heroChars, { yPercent: 110, rotate: 6, opacity: 0.01, duration: 1.5, ease, stagger: 0.035, delay: 0.2 });
    gsap.from('[data-hero]', { y: 28, opacity: 0.01, duration: 1.6, ease, stagger: 0.08, delay: 0.45, clearProps: 'transform' });
  }

  // ---- Hero exit: the copy and the lens recede.
  // On phones the hero is taller than the screen, so the fade waits until its
  // bottom edge is on screen; starting at 'top top' greyed out text people
  // were still reading. fromTo keeps the entrance tween's half-faded opacity
  // from being recorded as the starting point.
  const heroTl = gsap.timeline({
    scrollTrigger: { trigger: '.hero', start: 'clamp(bottom bottom)', end: 'bottom top', scrub: 0.8 },
  });
  heroTl
    .to('.hero-inner', { y: -90, opacity: 0, ease: 'power1.in' }, 0)
    .fromTo('.hero-foot', { opacity: 1 }, { opacity: 0, ease: 'none', immediateRender: false }, 0);

  // ---- 01 The math: words light up as you read; the numbers count.
  const lit = gsap.utils.toArray('.math-statement .w--hi');
  if (lit.length) {
    gsap.fromTo(
      lit,
      { color: cssColor('var(--dim)') },
      {
        color: cssColor('var(--varn-text)'),
        stagger: 0.1,
        ease: 'none',
        scrollTrigger: { trigger: '.math-statement', start: 'top 82%', end: 'bottom 45%', scrub: 0.6 },
      }
    );
  }
  document.querySelectorAll('[data-count]').forEach((el, i) => {
    ScrollTrigger.create({
      trigger: el,
      start: 'top 90%',
      once: true,
      onEnter: () => gsap.delayedCall(i * 0.12, () => countUp(el)),
    });
  });

  // ---- Section headings rise in.
  gsap.utils.toArray('.section-head').forEach((head) => {
    const h = head.querySelector('.h-section');
    const words = h ? splitWords(h) : [];
    const others = [...head.children].filter((c) => c !== h && !c.hasAttribute('data-reveal'));
    const tl = gsap.timeline({ scrollTrigger: { trigger: head, start: 'top 86%' } });
    tl.from(others, { y: 30, opacity: 0, duration: 1.2, ease, stagger: 0.08 }, 0);
    if (words.length) tl.from(words, { yPercent: 115, duration: 1.4, ease, stagger: 0.07 }, 0.1);
  });

  // ---- Generic float-up reveals.
  gsap.utils.toArray('[data-reveal]').forEach((el) => {
    gsap.from(el, {
      y: 56,
      opacity: 0,
      duration: 1.6,
      ease,
      clearProps: 'transform', // hand transforms back to CSS (glass tilt)
      scrollTrigger: { trigger: el, start: 'top 90%' },
    });
  });

  gsap.to('.how-stage .stage-steel', {
    yPercent: 30,
    ease: 'none',
    scrollTrigger: { trigger: '.how', start: 'top bottom', end: 'bottom top', scrub: true },
  });

  // ---- Story: pinned. Scrolling steps through the five stages; the scene,
  // rail and text follow. The pin only runs where the pinned panel fits on
  // screen; on phones, short windows and with reduced motion (or no JS) the
  // steps stay a plain readable list (styles.css: .story without
  // .story--pinned). gsap.matchMedia re-checks on resize and rotation and
  // undoes the pin when the window stops matching.
  const story = document.getElementById('story');
  if (story) {
    const steps = [...story.querySelectorAll('.story-step')];
    const scenes = [...story.querySelectorAll('.scene')];
    const dots = [...story.querySelectorAll('.rail-dot')];
    const lines = [...story.querySelectorAll('.rail-line')];
    const counter = document.getElementById('story-step');
    const n = steps.length;
    let current = -1;
    const show = (i) => {
      if (i === current) return;
      current = i;
      steps.forEach((el, k) => el.classList.toggle('is-active', k === i));
      scenes.forEach((el, k) => {
        // Re-trigger the scene's CSS animation each time it becomes active.
        if (k === i) {
          el.classList.remove('is-active');
          void el.offsetWidth;
        }
        el.classList.toggle('is-active', k === i);
      });
      dots.forEach((el, k) => {
        el.classList.toggle('is-active', k === i);
        el.classList.toggle('is-done', k < i);
      });
      if (counter) counter.textContent = `0${i + 1} / 0${n}`;
    };
    gsap.matchMedia().add(STORY_PIN_QUERY, () => {
      story.classList.add('story--pinned');
      ScrollTrigger.create({
        trigger: '.story-pin',
        start: 'top top',
        end: () => `+=${Math.round(window.innerHeight * 0.75 * n)}`,
        pin: true,
        anticipatePin: 1,
        onUpdate: (self) => {
          const p = self.progress;
          show(Math.min(n - 1, Math.floor(p * n * 0.9999)));
          lines.forEach((line, k) => {
            const f = Math.min(1, Math.max(0, p * n - (k + 0.5)));
            line.firstElementChild.style.setProperty('--fill', f.toFixed(3));
          });
        },
      });
      // The device floats in as the section arrives.
      gsap.from('.story-device', {
        y: 80,
        opacity: 0,
        rotationX: 10,
        transformPerspective: 1100,
        duration: 1.6,
        ease,
        clearProps: 'transform',
        scrollTrigger: { trigger: '.story', start: 'top 70%' },
      });
      return () => story.classList.remove('story--pinned');
    });
  }

  // ---- Label cards float up in sequence.
  gsap.from('.label-card', {
    y: 80,
    opacity: 0,
    duration: 1.5,
    ease,
    stagger: 0.14,
    clearProps: 'transform',
    scrollTrigger: { trigger: '.label-grid', start: 'top 85%' },
  });

  // ---- Status: rows reveal one after another.
  ScrollTrigger.batch('.status-row', {
    start: 'top 92%',
    once: true,
    onEnter: (rows) =>
      gsap.from(rows, { x: -24, opacity: 0, duration: 1.2, ease, stagger: 0.06, clearProps: 'transform' }),
  });

  // ---- 04 About: the orb drifts behind the glass, so the glass bends it.
  gsap.fromTo(
    '.build-orb',
    { yPercent: 30, xPercent: 8 },
    {
      yPercent: -25,
      xPercent: -6,
      ease: 'none',
      scrollTrigger: { trigger: '.build', start: 'top bottom', end: 'bottom top', scrub: true },
    }
  );

  // ---- 05 Roadmap: the line draws itself and lights each phase.
  const track = document.querySelector('.roadmap-track');
  const phases = gsap.utils.toArray('.phase');
  gsap.fromTo(
    track,
    { '--draw': 0 },
    {
      '--draw': 1,
      ease: 'none',
      scrollTrigger: {
        trigger: track,
        start: 'top 78%',
        end: 'bottom 55%',
        scrub: 0.6,
        onUpdate: (self) =>
          phases.forEach((p, i) => p.classList.toggle('is-lit', self.progress >= (i / Math.max(1, phases.length - 1)) * 0.98)),
      },
    }
  );
  gsap.from(phases, {
    y: 50,
    opacity: 0,
    duration: 1.5,
    ease,
    stagger: 0.12,
    clearProps: 'transform',
    scrollTrigger: { trigger: track, start: 'top 84%' },
  });

  // Closing: the mark rises out of the dark above the last line.
  gsap.fromTo(
    '#outro-lens',
    { y: 80, opacity: 0.01 },
    { y: 0, opacity: 1, ease: 'none', scrollTrigger: { trigger: '.outro', start: 'top bottom', end: 'center bottom', scrub: 0.8 } }
  );
  gsap.from('.closing', {
    y: 40,
    opacity: 0,
    duration: 1.8,
    ease,
    scrollTrigger: { trigger: '.outro', start: 'top 70%' },
  });

  // Web fonts change line lengths; re-measure once they are in.
  // Re-measure once fonts change line breaks, but only if they are still
  // loading at page load: an extra refresh costs a long frame on slow phones.
  addEventListener(
    'load',
    () => document.fonts && document.fonts.status !== 'loaded' && document.fonts.ready.then(() => ScrollTrigger.refresh()),
    { once: true }
  );
} else {
  document.querySelectorAll('.phase').forEach((p) => p.classList.add('is-lit'));
}

// ---------------------------------------------------------------------------
// Real footage (when content.js has it) plays muted, unless motion is off.
// ---------------------------------------------------------------------------
const footage = document.querySelector('.hero-video');
if (footage) {
  if (reduceMotion) footage.controls = true;
  else footage.play().catch(() => (footage.controls = true));
}

// ---------------------------------------------------------------------------
// Lazy pieces: never on the critical path.
// ---------------------------------------------------------------------------
const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 200));
const afterLoad = (fn) => {
  if (document.readyState === 'complete') idle(fn, { timeout: 1500 });
  else window.addEventListener('load', () => idle(fn, { timeout: 1500 }), { once: true });
};
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
// The WebGL 2 renderer's name, or null without WebGL 2.
function webgl2Renderer() {
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    if (!gl) return null;
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    const renderer = String(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return renderer;
  } catch {
    return null;
  }
}
const SOFTWARE_GL = /swiftshader|llvmpipe|softpipe|software|basic render/i;

afterLoad(() => {
  const renderer = webgl2Renderer();
  const soft = renderer !== null && SOFTWARE_GL.test(renderer);
  root.classList.toggle('low-gfx', soft);
  if (soft) root.classList.remove('has-refraction');
  try {
    if (soft) localStorage.setItem(GFX_KEY, 'soft');
    else localStorage.removeItem(GFX_KEY);
  } catch {}
  const stage = document.getElementById('mount-stage');
  const forced = new URLSearchParams(location.search).get('gl') === 'any';
  if (!stage || renderer === null || (soft && !forced)) return;
  const parts = [...document.querySelectorAll('.mount-parts li')];
  whenNear(stage, () =>
    import('./mount.js')
      .then(({ createMount }) =>
        createMount({
          container: stage,
          url: new URL('models/pantilt.bin', document.baseURI).href,
          reduceMotion,
          finePointer,
          onTooSlow: () => stage.classList.remove('is-ready'),
        })
      )
      .then((mount) => {
        stage.classList.add('is-ready');
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
          li.addEventListener('pointerdown', (e) => (lastType = e.pointerType));
          li.addEventListener('pointerenter', (e) => e.pointerType === 'mouse' && show(i));
          li.addEventListener('pointerleave', (e) => e.pointerType === 'mouse' && show(-1));
          li.addEventListener('click', () => lastType !== 'mouse' && show(current === i ? -1 : i));
        });
      })
      .catch((err) => console.warn('[varn] mount viewer unavailable, keeping the still.', err))
  );
});

initNavMenu();
