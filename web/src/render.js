// Turns src/content.js into static HTML at build time (see vite.config.js).
// The page ships as plain HTML, so it is readable before any JavaScript runs.
//
// Design: Varn brand system v1.0 (brand/). Charcoal and bone, steel-blue
// accents, angular geometry. Status colours appear only for what the sensor
// sees; amber is the one alert colour.

import { MARK_PATH, MARK_SMALL_PATH, MARK_VIEWBOX, WORDMARK_PATH, WORDMARK_VIEWBOX } from './logo.js';

const esc = (s) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const isExternal = (href) => /^https?:\/\//.test(href);
const linkAttrs = (href) =>
  isExternal(href) ? ` href="${esc(href)}" target="_blank" rel="noopener"` : ` href="${esc(href)}"`;

const pad2 = (n) => String(n).padStart(2, '0');

// The Varn mark: two angled blades and a short inner blade (brand/varn_mark.svg).
// `size` is its width; it is about half as tall. Below 24 px wide the inner
// blade can't stay separate, so it uses the simplified small mark.
const mark = (size, cls = 'mark') =>
  `<svg class="${cls}" width="${size}" height="${Math.round((size * 194) / 391.5)}" viewBox="${MARK_VIEWBOX}" aria-hidden="true"><path class="mark-ink" d="${size < 24 ? MARK_SMALL_PATH : MARK_PATH}"/></svg>`;

// VARN in Space Grotesk, as outlines, so it never depends on a loaded font.
const wordmark = () =>
  `<svg class="wordmark" viewBox="${WORDMARK_VIEWBOX}" aria-hidden="true"><path d="${WORDMARK_PATH}"/></svg>`;

const ARROW_UR = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5 11L11 5M6 5h5v5" /></svg>';
const ARROW_DN = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3v10M4 9l4 4 4-4" /></svg>';

const STATUS_KINDS = { DONE: 'done', 'IN PROGRESS': 'progress', NEXT: 'next' };

// Section label, e.g. "02  How it works", over a hairline.
const kicker = (n, text, id = '', tag = 'p') =>
  `<${tag} class="kicker mono"${id ? ` id="${id}"` : ''}><span class="kicker-n" aria-hidden="true">${pad2(n)}</span><span class="kicker-label">${esc(text)}</span></${tag}>`;

// Animation control (WCAG 2.2.2): main.js reveals these and wires them to
// motion.js; they stay hidden for visitors who have asked for reduced motion.
const motionButton = () =>
  `<button class="motion-btn" type="button" data-motion hidden>Pause animation</button>`;

// Status: colour always travels with a shape and a word.
// circle = confirmed aircraft, square = possible drone, ring = no ADS-B match.
const STATUS = {
  aircraft: 'Confirmed aircraft',
  drone: 'Possible drone',
  'no-adsb': 'No ADS-B match',
};
const statusPill = (kind) =>
  `<span class="status-pill status-pill--${kind} mono"><span class="shape shape--${kind}" aria-hidden="true"></span>${esc(STATUS[kind] || STATUS.aircraft)}</span>`;

// "A [b c] d" -> words, with the bracketed ones marked bright.
function litWords(statement) {
  const out = [];
  String(statement)
    .split(/(\[[^\]]*\])/)
    .forEach((chunk) => {
      const bright = chunk.startsWith('[') && chunk.endsWith(']');
      chunk
        .replace(/^\[|\]$/g, '')
        .split(/\s+/)
        .filter(Boolean)
        .forEach((w) => out.push(`<span class="w${bright ? ' w--hi' : ''}">${esc(w)}</span>`));
    });
  return out.join(' ');
}

// The headline, broken after its first word ("Watch / the sky.") so it sits
// on two lines like the brand board.
const headline = (h) => {
  const [first, ...rest] = String(h).trim().split(/\s+/);
  return [first, rest.join(' ')]
    .filter(Boolean)
    .map((line) => `<span class="line">${esc(line)}</span>`)
    .join(' ');
};

// ---- Hero ---------------------------------------------------------------------

// Sighting card. Placeholder values, so it always carries SAMPLE.
// hero-lens.js cycles it through the three statuses along with the lens.
const sightingCard = (hero) => {
  const c = hero.card || {};
  const kind = STATUS[c.status] ? c.status : 'aircraft';
  return `
      <aside class="sighting panel" id="sighting" aria-label="Sample sighting card">
        <div class="sighting-top">
          <span class="status-pill status-pill--${kind} mono" data-card="pill"><span class="shape shape--${kind}" aria-hidden="true"></span><span data-card="pill-text">${esc(STATUS[kind])}</span></span>
          <span class="sample-tag mono">${esc(c.label || 'SAMPLE')}</span>
        </div>
        <div class="sighting-head">
          <span class="sighting-title">Sighting</span>
          <span class="mono sighting-time" data-card="time">${esc(c.time || '')}</span>
        </div>
        <dl class="sighting-grid mono">
          <div><dt>CLASS</dt><dd data-card="class">${esc(c.class || '')}</dd></div>
          <div><dt>CONF</dt><dd data-card="conf">${esc(c.conf || '')}</dd></div>
          <div><dt>ADS-B</dt><dd class="sighting-adsb sighting-adsb--${kind}" data-card="adsb">${esc(c.adsb || '')}</dd></div>
        </dl>
        <p class="sighting-caption">${esc(hero.caption)}</p>
      </aside>`;
};

// The lens: a simulated sky view (hero-lens.js draws into the canvas).
// Without JavaScript it is simply the Split mark in a circle.
const heroLens = () => `
      <div class="lens" id="lens">
        ${mark(250, 'mark lens-mark')}
        <canvas class="lens-canvas" id="lens-canvas" aria-hidden="true"></canvas>
        <span class="lens-tag mono">SAMPLE · SIMULATED SKY</span>
      </div>`;

// Real footage, once it exists (see hero.footage in content.js). main.js
// starts playback only for visitors who haven't turned off motion.
const heroFootage = (f) => `
      <figure class="footage panel">
        <video class="hero-video" muted loop playsinline preload="metadata"${f.poster ? ` poster="${esc(f.poster)}"` : ''} aria-label="${esc(f.caption)}">
          <source src="${esc(f.video)}" />
        </video>
        <figcaption class="hud-caption">${esc(f.caption)}</figcaption>
      </figure>`;

// ---- How it works ----------------------------------------------------------------

// Simulated camera view. Boxes and readouts are animated by sensor.js; the
// static markup is a complete, sensible still on its own.
const sensorBlock = (s) => `
      <figure class="sensor panel" id="sensor">
        <div class="sensor-head">
          <span class="mono sensor-label"><span class="live-dot" aria-hidden="true"></span>${esc(s.label)}</span>
          ${motionButton()}
        </div>
        <div class="frame" id="sensor-frame" role="img" aria-label="Simulated camera view: a drone locked in a bold amber box near the centre, and an aircraft in a thin green box higher up.">
          <div class="frame-sky" data-sensor="sky"></div>
          <div class="frame-grid" data-sensor="grid"></div>
          <div class="frame-ring" aria-hidden="true"></div>
          <div class="det det--drone is-locked" data-sensor="drone" style="--x:58%;--y:30%">
            <span class="det-label mono">DRONE <b data-sensor="drone-conf">0.91</b></span>
            <svg class="det-obj" viewBox="0 0 40 24" aria-hidden="true"><path d="M8 12h24M14 9h12v6H14z" /><path d="M2 6h12M26 6h12" /><path d="M8 6v6M32 6v6" /></svg>
          </div>
          <div class="det det--aircraft" data-sensor="aircraft" style="--x:22%;--y:24%">
            <span class="det-label mono">AIRCRAFT <b data-sensor="air-conf">0.64</b></span>
            <svg class="det-obj" viewBox="0 0 40 24" aria-hidden="true"><path d="M4 12h32M20 12l-8-9M20 12l-8 9M34 12l3-5M34 12l3 5" /></svg>
          </div>
          <div class="frame-bar mono">
            <span data-sensor="pan">PAN 092.5°</span>
            <span data-sensor="tilt">TILT 47.0°</span>
            <span class="frame-state"><span class="state-dot" aria-hidden="true"></span>SIMULATED</span>
          </div>
        </div>
        <figcaption class="sensor-caption">${esc(s.caption)}</figcaption>
      </figure>`;

// Simulated radar-style plot. radar.js draws it; without JavaScript the
// browser shows the static picture inside the canvas instead.
const radarBlock = (r) => `
      <figure class="radar panel" id="radar">
        <div class="sensor-head">
          <span class="mono sensor-label">${esc(r.label)}</span>
          ${motionButton()}
        </div>
        <canvas class="radar-canvas" role="img" aria-label="Simulated plot: a slow sweep over range rings, with a sample aircraft (circle) crossing and a sample possible drone (square) loitering."><svg class="radar-still" viewBox="-100 -100 200 200" aria-hidden="true"><g fill="none" stroke="#4b5b6b" stroke-opacity=".7"><circle r="94"/><circle r="62"/><circle r="31"/><path d="M-94 0H94M0-94V94" stroke-opacity=".5"/></g><circle cx="-60" cy="-30" r="3" fill="#7a8b7e"/><text x="-52" y="-36" fill="#a7b3bd" font-size="8" font-family="monospace">AIRCRAFT</text><rect x="28" y="14" width="6" height="6" fill="#e0a84a"/><text x="38" y="12" fill="#a7b3bd" font-size="8" font-family="monospace">DRONE?</text></svg></canvas>
        <figcaption class="sensor-caption">${esc(r.caption)}</figcaption>
      </figure>`;

// Pan-tilt mount: a still image first, replaced by a live 3D view (mount.js).
const mountBlock = (m) => `
      <figure class="mount panel" id="mount">
        <div class="mount-view">
          <div class="mount-stage" id="mount-stage">
            <img class="mount-still" src="./models/pantilt-still.webp" width="900" height="760" loading="lazy" decoding="async"
              alt="3D render of the Varn pan-tilt mount from its CAD files: a base holding the pan servo, a yoke on top, and a camera arm between the yoke's uprights." />
          </div>
          <div class="mount-controls" role="group" aria-label="Turn the 3D model" hidden>
            <button class="ctl-btn" type="button" data-turn="-0.3">Turn left</button>
            <button class="ctl-btn" type="button" data-turn="0.3">Turn right</button>
            <button class="ctl-btn" type="button" data-turn="0">Reset view</button>
            ${motionButton()}
          </div>
        </div>
        <figcaption class="mount-info">
          <p class="mono mount-label"><span class="node-dot" aria-hidden="true"></span>${esc(m.label)}</p>
          <ul class="mount-parts">
            ${m.parts
              .map(
                (p, i) =>
                  `<li data-part="${i}"><span class="mono mount-part-name">${esc(p.name)}</span><p>${esc(p.text)}</p></li>`
              )
              .join('')}
          </ul>
          <p class="mount-caption">${esc(m.caption)}</p>
        </figcaption>
      </figure>`;

// Accuracy results: rendered only once there are measured numbers.
// Each chart is one measurement as bars on a shared 0-100% scale, so a small
// number looks small and a weak one looks weak. Every value is printed as
// text (no hover needed), and the same numbers sit in a plain table below.
const pct = (v) => `${Number(v)}%`;
const resultBar = (b) => `
          <li class="rc-row${b.part ? ' rc-row--part' : ''}">
            <div class="rc-row-head"><span class="rc-label">${esc(b.label)}</span><span class="rc-value mono">${esc(pct(b.value))}</span></div>
            <div class="rc-track" aria-hidden="true"><span class="rc-bar" style="--v:${Number(b.value)}"></span></div>
            ${b.detail ? `<p class="rc-detail">${esc(b.detail)}</p>` : ''}
          </li>`;
const resultChart = (ch, i) => `
      <figure class="rc-panel rc-panel--${ch.kind === 'drone' ? 'drone' : 'aircraft'} panel" aria-labelledby="rc-title-${i}">
        <figcaption class="rc-cap">
          <h3 class="rc-title" id="rc-title-${i}"><span class="shape shape--${ch.kind === 'drone' ? 'drone' : 'aircraft'}" aria-hidden="true"></span>${esc(ch.title)}</h3>
          <p class="rc-unit">${esc(ch.unit)}</p>
        </figcaption>
        <ul class="rc-bars">${ch.bars.map(resultBar).join('')}
        </ul>
        <div class="rc-axis mono" aria-hidden="true"><span>0%</span><span>50%</span><span>100%</span></div>
      </figure>`;
const resultTable = (charts) => `
      <details class="rc-table">
        <summary class="mono">Show the numbers as a table</summary>
        <div class="rc-table-wrap" tabindex="0" role="region" aria-label="Results as a table">
          <table>
            <thead><tr><th scope="col">Group</th><th scope="col">Result</th><th scope="col">Notes</th></tr></thead>${charts
              .map(
                (ch) => `
            <tbody>
              <tr><th scope="rowgroup" colspan="3" class="rc-table-group">${esc(ch.title)} <span>${esc(ch.unit)}</span></th></tr>${ch.bars
                .map(
                  (b) => `
              <tr><th scope="row">${esc(b.label)}</th><td class="mono">${esc(pct(b.value))}</td><td>${b.detail ? esc(b.detail) : ''}</td></tr>`
                )
                .join('')}
            </tbody>`
              )
              .join('')}
          </table>
        </div>
      </details>`;
export const resultsSection = (r, next) => {
  if (!r || !Array.isArray(r.charts) || r.charts.length === 0) return '';
  const caveats = Array.isArray(r.caveats) ? r.caveats : [];
  return `
  <section class="results section" id="results" aria-labelledby="results-title" data-spy="results">
    <div class="wrap">
      <header class="section-head">
        ${kicker(next(), r.kicker || 'Recorded video test')}
        <h2 class="h-section" id="results-title">${esc(r.heading)}</h2>
        ${r.intro ? `<p class="lede">${esc(r.intro)}</p>` : ''}
      </header>
      ${
        r.tag || r.sample
          ? `<p class="rc-meta mono">${r.tag ? `<span class="rc-tag">${esc(r.tag)}</span>` : ''}${
              r.sample ? `<span class="rc-sample">${esc(r.sample)}</span>` : ''
            }</p>`
          : ''
      }
      <div class="rc-grid">${r.charts.map(resultChart).join('')}
        ${
          caveats.length
            ? `<aside class="rc-caveats" aria-labelledby="rc-caveats-title">
          <h3 class="rc-caveats-title mono" id="rc-caveats-title">What this test does not show</h3>
          <ul>${caveats.map((c) => `<li>${esc(c)}</li>`).join('')}</ul>
        </aside>`
            : ''
        }
      </div>
      ${resultTable(r.charts)}
      <p class="results-source mono">${esc(r.source)}</p>
    </div>
  </section>`;
};

// Known limits: what Varn can't do, stated plainly. Hidden if empty.
const limitsSection = (l, next) => {
  if (!l || !Array.isArray(l.items) || l.items.length === 0) return '';
  return `
  <section class="limits section" id="limits" aria-labelledby="limits-title" data-spy="results">
    <div class="wrap">
      <header class="section-head">
        ${kicker(next(), l.kicker || 'Honest limits')}
        <h2 class="h-section" id="limits-title">${esc(l.heading)}</h2>
      </header>
      <ul class="limits-list">
        ${l.items
          .map(
            (it) => `
        <li class="limit">
          <span class="mono limit-tag">${esc(it.tag)}</span>
          <p>${esc(it.text)}</p>
        </li>`
          )
          .join('')}
      </ul>
    </div>
  </section>`;
};

// ---- Story (step by step) ----------------------------------------------------

// One animated scene per stage. They are pure markup + CSS animation: the
// active scene is switched by story.js when a step is chosen. All values are SAMPLE.
const SCENES = [
  // 01 SEE: range rings, a slow sweep, light arriving. Nothing leaves.
  () => `
        <svg class="sc sc-see" viewBox="0 0 400 300" aria-hidden="true">
          <g class="sc-rings"><circle cx="200" cy="170" r="40"/><circle cx="200" cy="170" r="80"/><circle cx="200" cy="170" r="120"/><circle cx="200" cy="170" r="160"/></g>
          <path class="sc-horizon" d="M0 232H400"/>
          <g class="sc-sweep"><path d="M200 170L200 10" /></g>
          <g class="sc-rays"><path d="M60 24L170 150"/><path d="M200 8L200 138"/><path d="M340 24L230 150"/></g>
          <circle class="sc-eye" cx="200" cy="170" r="9"/>
          <circle class="sc-eye-dot" cx="204" cy="166" r="2.6"/>
          <text class="sc-text" x="200" y="266" text-anchor="middle">RECEIVES LIGHT ONLY</text>
        </svg>`,
  // 02 DETECT: boxes snap onto things, each with class + confidence.
  () => `
        <div class="sc sc-detect" aria-hidden="true">
          <div class="sc-sky"></div>
          <div class="sc-box sc-box--aircraft" style="--x:24%;--y:30%;--d:0.2s"><span class="sc-chip mono"><i class="shape shape--aircraft"></i>AIRCRAFT 0.91</span></div>
          <div class="sc-box sc-box--drone" style="--x:62%;--y:56%;--d:0.7s"><span class="sc-chip mono"><i class="shape shape--drone"></i>DRONE 0.64</span></div>
          <div class="sc-box sc-box--noadsb" style="--x:76%;--y:22%;--d:1.2s"><span class="sc-chip mono"><i class="shape shape--no-adsb"></i>AIRCRAFT 0.78</span></div>
          <div class="sc-scan"></div>
        </div>`,
  // 03 TRACK: the target drifts, the mount follows, the ring settles on it.
  () => `
        <div class="sc sc-track" aria-hidden="true">
          <div class="sc-sky sc-sky--pan"></div>
          <div class="sc-ring"></div>
          <div class="sc-box sc-box--drone sc-box--follow"><span class="sc-chip mono"><i class="shape shape--drone"></i>LOCKED</span></div>
          <div class="sc-readout mono"><span>PAN <b>092.5°</b></span><span>TILT <b>47.0°</b></span><span>CMD <b>P92.5 T47.0</b></span></div>
        </div>`,
  // 04 LOG: rows arrive one by one.
  () => `
        <div class="sc sc-log" aria-hidden="true">
          <div class="sc-row sc-row--head mono"><span>TIME</span><span>CLASS</span><span>CONF</span><span>PAN/TILT</span></div>
          <div class="sc-row mono" style="--d:0.1s"><span>14:32:07Z</span><span><i class="shape shape--aircraft"></i>aircraft</span><span>0.91</span><span>092/47</span></div>
          <div class="sc-row mono" style="--d:0.5s"><span>13:58:41Z</span><span><i class="shape shape--drone"></i>drone</span><span>0.64</span><span>140/31</span></div>
          <div class="sc-row mono" style="--d:0.9s"><span>13:12:19Z</span><span><i class="shape shape--no-adsb"></i>aircraft</span><span>0.78</span><span>061/52</span></div>
          <div class="sc-row sc-row--clear mono" style="--d:1.3s"><span>13:00:00Z</span><span>sky clear</span><span>·</span><span>·</span></div>
        </div>`,
  // 05 CHECK: what the camera saw lines up against what ADS-B says.
  () => `
        <div class="sc sc-check" aria-hidden="true">
          <div class="sc-col"><p class="sc-col-h mono">CAMERA SAW</p>
            <span class="sc-pill status-pill status-pill--aircraft mono" style="--d:0.1s"><i class="shape shape--aircraft"></i>aircraft</span>
            <span class="sc-pill status-pill status-pill--aircraft mono" style="--d:0.5s"><i class="shape shape--aircraft"></i>aircraft</span>
            <span class="sc-pill status-pill status-pill--drone mono" style="--d:0.9s"><i class="shape shape--drone"></i>drone</span></div>
          <svg class="sc-links" viewBox="0 0 80 200" preserveAspectRatio="none"><path d="M0 30C40 30 40 30 80 30" style="--d:0.5s"/><path d="M0 100C40 100 40 100 80 100" style="--d:0.9s;stroke-dasharray:3 5"/></svg>
          <div class="sc-col"><p class="sc-col-h mono">ADS-B SAID</p>
            <span class="sc-pill sc-pill--plain mono" style="--d:0.4s">flight overhead</span>
            <span class="sc-pill sc-pill--plain sc-pill--none mono" style="--d:0.8s">no flight</span>
            <span class="sc-pill sc-pill--plain sc-pill--none mono" style="--d:1.2s">n/a</span></div>
          <div class="sc-result"><span class="status-pill status-pill--aircraft mono"><i class="shape shape--aircraft"></i>Confirmed aircraft</span><span class="status-pill status-pill--no-adsb mono"><i class="shape shape--no-adsb"></i>No ADS-B match</span></div>
        </div>`,
];

const storySection = (st, n) => `
  <section class="story section" id="story" aria-labelledby="story-title" data-spy="story">
    <div class="wrap story-inner">
      <header class="section-head">
        ${kicker(n, st.kicker)}
        <h2 class="h-section" id="story-title">${esc(st.heading)}</h2>
        <p class="lede">${esc(st.intro)}${st.hint ? ` <span class="story-hint">${esc(st.hint)}</span>` : ''}</p>
      </header>
      <div class="story-body">
        <ol class="story-steps">
          ${st.stages
            .map(
              (s, i) => `
          <li class="story-step${i === 0 ? ' is-active' : ''}" data-stage="${i}">
            <h3 class="story-step-head"><span class="mono story-num">${esc(s.number)}</span><span class="story-title">${esc(s.title)}</span></h3>
            <div class="story-panel" id="story-panel-${i}">
              <p class="story-text">${esc(s.body)}</p>
              <p class="mono chip story-fact">${esc(s.fact)}</p>
            </div>
          </li>`
            )
            .join('')}
        </ol>
        <figure class="story-device panel" aria-label="Simulated detection pipeline">
          <div class="device-head">
            <span class="mono device-label"><span class="live-dot" aria-hidden="true"></span>${esc(st.device)}</span>
            <span class="mono device-step" id="story-step" aria-hidden="true">01 / 0${st.stages.length}</span>
          </div>
          <div class="device-screen">
            ${SCENES.slice(0, st.stages.length)
              .map((fn, i) => `<div class="scene${i === 0 ? ' is-active' : ''}" data-scene="${i}">${fn()}</div>`)
              .join('')}
          </div>
          <div class="device-rail" aria-hidden="true">${st.stages
            .map((s, i) => `<span class="rail-dot${i === 0 ? ' is-active' : ''}" data-rail="${i}"></span>`)
            .join('<span class="rail-line"><span></span></span>')}</div>
          <figcaption class="device-note">${esc(st.note)}</figcaption>
        </figure>
      </div>
    </div>
  </section>`;

const labelsSection = (l, n) => `
  <section class="labels section" id="labels" aria-labelledby="labels-title" data-spy="story">
    <div class="wrap labels-inner">
      <header class="section-head">
        ${kicker(n, l.kicker)}
        <h2 class="h-section" id="labels-title">${esc(l.heading)}</h2>
        <p class="lede">${esc(l.intro)}</p>
      </header>
      <ul class="label-grid">
        ${l.items
          .map(
            (it) => `
        <li class="label-card">
          <span class="label-shape label-shape--${it.kind}" aria-hidden="true"><i class="shape shape--${it.kind}"></i></span>
          ${statusPill(it.kind)}
          <p class="mono label-shapename">${esc(it.shape)}</p>
          <p class="label-rule">${esc(it.rule)}</p>
        </li>`
          )
          .join('')}
      </ul>
      <p class="label-note">${esc(l.note)}</p>
    </div>
  </section>`;

// What we've tested: three plain columns near the top. Hidden if empty.
const testedSection = (t) => {
  if (!t || !Array.isArray(t.columns) || !t.columns.length) return '';
  const cols = t.columns
    .map(
      (col) => `
        <div class="tested-col">
          <p class="mono tested-tag">${esc(col.tag)}</p>
          <h3 class="tested-title">${esc(col.title)}</h3>
          <ul class="tested-list">${col.items.map((it) => `<li>${esc(it)}</li>`).join('')}</ul>
        </div>`
    )
    .join('');
  return `
  <section class="tested section" id="tested" aria-labelledby="tested-title" data-spy="top">
    <div class="wrap">
      <h2 class="h-section tested-heading" id="tested-title">${esc(t.heading)}</h2>
      <div class="tested-grid">${cols}</div>
      ${t.link ? `<p class="tested-more"><a href="${esc(t.link.href)}">${esc(t.link.label)} &darr;</a></p>` : ''}
    </div>
  </section>`;
};

const SUN =
  '<svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="5"/><path d="M16 4v4M16 24v4M4 16h4M24 16h4M7.5 7.5l2.8 2.8M21.7 21.7l2.8 2.8M7.5 24.5l2.8-2.8M21.7 10.3l2.8-2.8"/></svg>';

const sisterCard = (s) => `
    <a class="sister"${linkAttrs(s.href)}>
      <span class="sister-mark">${SUN}</span>
      <span class="sister-text">
        <span class="mono sister-label">${esc(s.label)}</span>
        <span class="sister-name">${esc(s.name)}</span>
        ${s.description ? `<span class="sister-desc">${esc(s.description)}</span>` : ''}
      </span>
      <span class="sister-cta">${esc(s.linkLabel)} ${ARROW_UR}</span>
    </a>`;

// GoatCounter visit counter, only when content.js has a code.
const counter = (c) => {
  const code = c.analytics && c.analytics.goatcounter;
  return code
    ? `
    <script data-goatcounter="https://${esc(code)}.goatcounter.com/count" async src="https://gc.zgo.at/count.js"></script>`
    : '';
};

function siteNav(c, { home = true, current = '' } = {}) {
  const pre = home ? '' : './';
  const href = (h) => (h.startsWith('#') ? `${pre}${h}` : h);
  const links = c.nav.links
    .map((l) => {
      const cur = current && l.href === `./${current}` ? ' aria-current="page"' : '';
      return `<li><a class="nav-link" href="${esc(href(l.href))}"${cur}>${esc(l.label)}</a></li>`;
    })
    .join('');
  return `
<header class="site-header" id="top-nav">
  <nav class="nav" aria-label="Primary">
    <a class="brand" href="${home ? '#top' : './'}" aria-label="${esc(c.nav.brand)}, home">
      ${mark(36)}
      ${wordmark()}
    </a>
    <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="nav-menu" aria-label="Open menu"><span></span><span></span></button>
    <ul class="nav-links" id="nav-menu">
      ${links}
      <li class="nav-cta-li"><a class="btn btn--primary btn--sm"${linkAttrs(c.hero.primary.href)}>${esc(c.hero.primary.label)}</a></li>
    </ul>
    <a class="btn btn--primary btn--sm nav-cta"${linkAttrs(c.hero.primary.href)}>${esc(c.hero.primary.label)}</a>
  </nav>
</header>`;
}

export function renderHead(c) {
  const { title, description, url } = c.meta;
  const image = new URL('og-image.png', url).href;
  return `${counter(c)}
    <title>${esc(title)}</title>
    <meta name="description" content="${esc(description)}" />
    <link rel="canonical" href="${esc(url)}" />
    <link rel="icon" href="./favicon-32.png" type="image/png" sizes="32x32" />
    <link rel="apple-touch-icon" href="./apple-touch-icon.png" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Varn Labs" />
    <meta property="og:title" content="${esc(title)}" />
    <meta property="og:description" content="${esc(description)}" />
    <meta property="og:url" content="${esc(url)}" />
    <meta property="og:image" content="${esc(image)}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="Varn: A clear view of your airspace. Passive detection, drones and aircraft." />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${esc(title)}" />
    <meta name="twitter:description" content="${esc(description)}" />
    <meta name="twitter:image" content="${esc(image)}" />`;
}

export function renderBody(c) {
  const { hero, math, how, status, results, limits, build, roadmap, sister } = c;
  const footage = hero.footage && hero.footage.video ? hero.footage : null;

  const facts = hero.facts.map((f) => `<li>${esc(f)}</li>`).join('');

  const stats = (math.stats || [])
    .map(
      (s) => `
        <div class="stat${s.highlight ? ' stat--hi' : ''}">
          <dt class="mono">${esc(s.label)}</dt>
          <dd class="stat-value${/\d/.test(s.value) ? '' : ' stat-value--text'}">${esc(s.value)}</dd>
        </div>`
    )
    .join('');

  const statusRows = status.items
    .map((it) => {
      const kind = STATUS_KINDS[String(it.label).trim().toUpperCase()] || 'next';
      return `
        <li class="status-row status-row--${kind}">
          <span class="status-dot" aria-hidden="true"></span>
          <p>${esc(it.text)}</p>
          <span class="pill pill--${kind} mono">${esc(it.label)}</span>
        </li>`;
    })
    .join('');

  const phases = roadmap.phases
    .map(
      (p, i) => `
        <li class="phase${i === 0 ? ' phase--now' : ''}">
          <span class="phase-node" aria-hidden="true"></span>
          <p class="mono phase-label">${esc(p.phase)}</p>
          <h3 class="phase-title">${esc(p.title)}</h3>
          <p>${esc(p.body)}</p>
        </li>`
    )
    .join('');

  // Sections run in the order a visitor needs them: what it is, how it works,
  // what was measured (and its limits), the hardware, where it stands, and
  // who is behind it. Numbers follow the order on the page.
  let n = 0;
  return `
<a class="skip-link" href="#main">Skip to content</a>
${siteNav(c)}

<main id="main" tabindex="-1">
  <section class="hero" id="top" aria-labelledby="hero-title" data-spy="top">
    <div class="hero-photo" aria-hidden="true"></div>
    <svg class="hero-track" viewBox="0 0 1440 800" preserveAspectRatio="xMidYMin slice" aria-hidden="true">
      <path class="hero-track-line" pathLength="1" d="M700 800 C 720 560, 800 250, 1120 118" />
      <g class="hero-track-frame" transform="translate(1120 118)">
        <path d="M-34 -22v-10h10M24 -32h10v10M34 22v10h-10M-24 32h-10v-10" />
        <circle r="3" />
        <text x="-44" y="-20" text-anchor="end">SAMPLE TRACK</text>
      </g>
    </svg>

    <div class="hero-inner wrap">
      <div class="hero-copy">
        <p class="eyebrow">${esc(hero.eyebrow)}</p>
        <h1 class="hero-title" id="hero-title">${headline(hero.headline)}</h1>
        ${hero.stage ? `<p class="hero-stage-line"><span class="mono hero-stage-label">${esc(hero.stage.label)}</span>${esc(hero.stage.text)}</p>` : ''}
        <p class="hero-sub">${esc(hero.sub)}</p>
        <div class="hero-actions">
          <a class="btn btn--primary btn--lg"${linkAttrs(hero.demo.href)}>
            <span>${esc(hero.demo.label)}</span>${ARROW_UR}
          </a>
          <a class="btn btn--ghost btn--lg" href="${esc(hero.results.href)}">
            <span>${esc(hero.results.label)}</span>${ARROW_DN}
          </a>
          <a class="hero-source"${linkAttrs(hero.source.href)}>${esc(hero.source.label)}${ARROW_UR}</a>
        </div>
        ${hero.cost ? `<p class="hero-note">${esc(hero.cost)}</p>` : ''}
      </div>
      <div class="hero-visual" id="hero-visual">
        ${footage ? heroFootage(footage) : `${heroLens()}${sightingCard(hero)}`}
      </div>
    </div>

    <div class="hero-foot wrap">
      <ul class="hero-facts mono">${facts}</ul>
      ${footage ? '' : `<div class="hero-foot-end">${motionButton()}</div>`}
    </div>
  </section>

  ${testedSection(c.tested)}

  <section class="math section" id="math" aria-labelledby="math-title" data-spy="top">
    <div class="wrap math-inner">
      ${kicker(++n, math.heading, 'math-title', 'h2')}
      ${
        math.statement
          ? `<p class="math-statement">${litWords(math.statement)}</p>`
          : `<p class="math-statement">${litWords(math.body)}</p>`
      }
      ${stats ? `<dl class="stats">${stats}</dl>` : ''}
      ${math.statsNote ? `<p class="stats-note">${esc(math.statsNote)}</p>` : ''}
      ${math.statement ? `<p class="lede">${esc(math.body)}</p>` : ''}
      ${
        math.useCases
          ? `<div class="note">
        <span class="mono note-tag">${esc(math.useCases.tag)}</span>
        <p>${esc(math.useCases.text)}</p>
      </div>`
          : ''
      }
    </div>
  </section>

  ${storySection(c.story, ++n)}
  ${labelsSection(c.labels, ++n)}
  ${resultsSection(results, () => ++n)}
  ${limitsSection(limits, () => ++n)}

  <section class="how section" id="how" aria-labelledby="how-title" data-spy="how">
    <div class="wrap how-inner">
      <header class="section-head">
        ${kicker(++n, how.kicker || 'System')}
        <h2 class="h-section" id="how-title">${esc(how.heading)}</h2>
      </header>
      ${how.summary ? `<p class="lede">${esc(how.summary)}</p>` : ''}
      <details class="fold" id="how-details">
        <summary class="fold-summary"><span>${esc(how.toggle || 'Show the views')}</span></summary>
        <div class="fold-body">
          <div class="how-views">
            ${how.sensor ? sensorBlock(how.sensor) : ''}
            ${how.radar ? radarBlock(how.radar) : ''}
          </div>
          ${how.mount ? mountBlock(how.mount) : ''}
        </div>
      </details>
      <div class="note">
        <span class="mono note-tag">Test range</span>
        <p>${esc(how.note)}</p>
      </div>
    </div>
  </section>

  <section class="status section" id="status" aria-labelledby="status-title" data-spy="status">
    <div class="wrap wrap--mid">
      <header class="section-head">
        ${kicker(++n, status.kicker || 'Where it stands')}
        <h2 class="h-section" id="status-title">${esc(status.heading)}</h2>
      </header>
      <ol class="status-list">${statusRows}</ol>
    </div>
  </section>

  <section class="roadmap section" id="roadmap" aria-labelledby="roadmap-title" data-spy="status">
    <div class="wrap">
      <header class="section-head">
        ${kicker(++n, roadmap.kicker || 'Roadmap')}
        <h2 class="h-section" id="roadmap-title">${esc(roadmap.heading)}</h2>
        ${roadmap.intro ? `<p class="lede">${esc(roadmap.intro)}</p>` : ''}
      </header>
      <ol class="phases">${phases}</ol>
    </div>
  </section>

  <section class="build section" id="build" aria-labelledby="build-title" data-spy="status">
    <div class="wrap wrap--mid">
      <figure class="build-card">
        ${kicker(++n, build.heading, 'build-title', 'h2')}
        <blockquote class="build-body"><p>${esc(build.body)}</p></blockquote>
        ${
          build.quote
            ? `<figcaption class="build-motto"><p>&ldquo;${esc(build.quote)}&rdquo;</p>${
                build.signature ? `<span class="mono">&mdash; ${esc(build.signature)}</span>` : ''
              }</figcaption>`
            : ''
        }
      </figure>
    </div>
  </section>

  <section class="outro" aria-label="Closing statement">
    <div class="wrap wrap--mid">
      ${mark(40, 'mark outro-mark')}
      <p class="closing">${esc(roadmap.closing)}</p>
    </div>
  </section>
</main>

${siteFooter(c, { sister })}`;
}

function siteFooter(c, { from = 'home', sister = null } = {}) {
  const footer = c.footer;
  const links = footer.links
    .filter((l) => !(l.href.includes(`${from}.html`)))
    .map((l) => `<li><a class="u-link"${linkAttrs(l.href)}>${esc(l.label)}</a></li>`)
    .join('');
  return `
<footer class="site-footer">
  <div class="wrap footer-wrap">
    ${sister ? sisterCard(sister) : ''}
    <div class="footer-inner">
      <p class="brand brand--footer">${mark(22)}${wordmark()}<span class="mono footer-labs">${esc(footer.brand)}</span></p>
      <nav aria-label="Footer">
        <ul class="footer-links">
          ${links}
          <li><span class="mono footer-k">${esc(footer.contactLabel)}</span> <a class="u-link"${linkAttrs(`mailto:${footer.email}`)}>${esc(footer.email)}</a></li>
        </ul>
      </nav>
    </div>
  </div>
</footer>`;
}

// ---- Privacy page (privacy.html) -------------------------------------------
export function renderPrivacyHead(c) {
  const url = new URL('privacy.html', c.meta.url).href;
  return `${counter(c)}
    <title>${esc(c.privacy.title)} | Varn</title>
    <meta name="description" content="${esc(c.privacy.intro)}" />
    <link rel="canonical" href="${esc(url)}" />`;
}

export function renderPrivacyBody(c) {
  const p = c.privacy;
  const on = !!(c.analytics && c.analytics.goatcounter);
  const sections = p.sections
    .filter((s) => on || !s.onlyWithAnalytics)
    .map((s) => (on && s.textWithAnalytics ? { ...s, text: s.textWithAnalytics } : s))
    .map(
      (s) => `
        <section class="legal-section">
          <h2 class="mono">${esc(s.heading)}</h2>
          <p>${esc(s.text)}${
            s.link ? ` <a class="u-link"${linkAttrs(s.link.href)}>${esc(s.link.label)}</a>.` : ''
          }</p>
        </section>`
    )
    .join('');
  return `
<a class="skip-link" href="#main">Skip to content</a>
${siteNav(c, { home: false })}

<main id="main" class="legal" tabindex="-1">
  <div class="wrap wrap--narrow">
    <article class="legal-card">
      <p class="mono legal-updated">Updated ${esc(p.updated)}</p>
      <h1 class="legal-title">${esc(p.title)}</h1>
      <p class="legal-intro">${esc(on && p.introWithAnalytics ? p.introWithAnalytics : p.intro)}</p>
      ${sections}
      <section class="legal-section">
        <h2 class="mono">${esc(c.footer.contactLabel)}</h2>
        <p>${esc(p.contactText)} <a class="u-link" href="mailto:${esc(c.footer.email)}">${esc(c.footer.email)}</a>.</p>
      </section>
    </article>
  </div>
</main>
${siteFooter(c, { from: 'privacy' })}`;
}

// ---- Contact page (contact.html) -------------------------------------------
// The form works without JavaScript (posts as an email via mailto:); contact.js
// upgrades it to send through contact.endpoint when one is configured.
export function renderContactHead(c) {
  const url = new URL('contact.html', c.meta.url).href;
  return `${counter(c)}
    <title>${esc(c.contact.title)} | Varn</title>
    <meta name="description" content="${esc(c.contact.description)}" />
    <link rel="canonical" href="${esc(url)}" />`;
}

export function renderContactBody(c) {
  const ct = c.contact;
  // Each field has its own error line, filled in by contact.js (aria-describedby).
  const field = (id, label, input) =>
    `<div class="field"><label class="field-label" for="c-${id}"><span class="mono field-k">${esc(label)}</span></label>${input}<p class="field-error" id="c-${id}-err" hidden></p></div>`;
  return `
<a class="skip-link" href="#main">Skip to content</a>
${siteNav(c, { home: false, current: 'contact.html' })}

<main id="main" class="contact-page" tabindex="-1">
  <section class="contact section" aria-labelledby="contact-title">
    <div class="wrap wrap--mid">
      <header class="section-head">
        ${kicker(1, ct.kicker)}
        <h1 class="h-section" id="contact-title">${esc(ct.heading)}</h1>
        <p class="lede">${esc(ct.intro)} <a class="u-link" href="mailto:${esc(ct.email)}">${esc(ct.email)}</a></p>
      </header>
      <form class="contact-form" id="contact-form" method="post" novalidate
        action="mailto:${esc(ct.email)}" enctype="text/plain"
        data-email="${esc(ct.email)}" data-endpoint="${esc(ct.endpoint || '')}"
        data-sending="${esc(ct.sendingLabel)}" data-success="${esc(ct.successText)}"
        data-mailto="${esc(ct.mailtoText)}" data-error="${esc(ct.errorText)}">
        <div class="field-row">
          ${field('name', ct.nameLabel, '<input id="c-name" name="name" type="text" autocomplete="name" required maxlength="100" aria-describedby="c-name-err" />')}
          ${field('email', ct.emailLabel, '<input id="c-email" name="email" type="email" inputmode="email" autocomplete="email" required maxlength="200" aria-describedby="c-email-err" />')}
        </div>
        ${field('message', ct.messageLabel, '<textarea id="c-message" name="message" rows="6" required minlength="10" maxlength="4000" aria-describedby="c-message-err"></textarea>')}
        <input class="field-trap" type="text" name="company" tabindex="-1" autocomplete="off" aria-hidden="true" />
        <div class="contact-actions">
          <button class="btn btn--primary" type="submit"><span class="btn-label">${esc(ct.submitLabel)}</span>${ARROW_UR}</button>
          ${ct.endpoint ? '' : `<p class="mono contact-note">${esc(ct.mailtoNote)}</p>`}
        </div>
        <p class="contact-status" role="status" aria-live="polite" hidden></p>
      </form>
    </div>
  </section>
</main>
${siteFooter(c, { from: 'contact' })}`;
}

// ---- Dashboard demo (demo.html) ------------------------------------------
// The page is a static shell: tabs, the measured results and the system
// status are plain HTML, and demo.js fills in the simulated views.
const STATE_KINDS = {
  verified: 'verified',
  measured: 'measured',
  testing: 'testing',
  simulated: 'simulated',
  'not connected': 'off',
  pending: 'pending',
};
const statePill = (state) =>
  `<span class="state-tag state-tag--${STATE_KINDS[String(state).toLowerCase()] || 'pending'} mono"><span class="state-shape" aria-hidden="true"></span>${esc(state)}</span>`;

export function renderDemoHead(c) {
  const d = c.demo;
  const url = new URL('demo.html', c.meta.url).href;
  return `${counter(c)}
    <title>${esc(d.title)} | Varn</title>
    <meta name="description" content="${esc(d.description)}" />
    <link rel="canonical" href="${esc(url)}" />
    <meta property="og:title" content="${esc(d.title)} | Varn" />
    <meta property="og:description" content="${esc(d.description)}" />`;
}

export function renderDemoBody(c) {
  const d = c.demo;
  const r = c.results || {};
  const charts = Array.isArray(r.charts) ? r.charts : [];
  const caveats = Array.isArray(r.caveats) ? r.caveats : [];
  const tabs = d.tabs
    .map(
      (t) =>
        `<li><a class="demo-tab" href="#${esc(t.id)}" data-view="${esc(t.id)}"><span class="demo-tab-mark" aria-hidden="true"></span>${esc(t.label)}</a></li>`
    )
    .join('');
  const rows = d.system.rows
    .map(
      (row) => `
          <tr>
            <th scope="row"><span class="mono demo-area">${esc(row.area)}</span>${esc(row.name)}</th>
            <td>${statePill(row.state)}</td>
            <td>${esc(row.text)}</td>
          </tr>`
    )
    .join('');
  const defs = d.definitions.map((x) => `<div><dt>${esc(x.term)}</dt><dd>${esc(x.text)}</dd></div>`).join('');
  const stateLegend = ['Verified', 'Measured', 'Testing', 'Simulated', 'Not connected', 'Pending'].map(statePill).join('');
  return `
<a class="skip-link" href="#main">Skip to content</a>
${siteNav(c, { home: false, current: 'demo.html' })}

<main id="main" class="demo-page" tabindex="-1">
  <div class="wrap demo-wrap">
    <header class="demo-intro">
      ${kicker(1, d.kicker, '', 'p')}
      <h1 class="demo-title" id="demo-title">${esc(d.heading)}</h1>
      <p class="lede">${esc(d.intro)}</p>
    </header>
    <noscript><p class="demo-noscript">${esc(d.noscript)}</p></noscript>
    <p class="demo-status" id="demo-status" role="status">Loading the demo&hellip;</p>

    <div class="demo-app">
      <div class="demo-top">
        <p class="demo-top-title"><span class="demo-top-mark">${mark(22)}</span>Varn dashboard</p>
        <p class="demo-top-state">
          <span class="state-tag state-tag--simulated mono"><span class="state-shape" aria-hidden="true"></span>Simulated data</span>
          <span class="demo-node"><span class="shape shape--no-adsb" aria-hidden="true"></span>Node-01<span class="demo-node-state">Not connected</span></span>
        </p>
      </div>
      <p class="demo-banner" role="note"><span class="state-shape state-shape--sim" aria-hidden="true"></span><span>${esc(d.banner)}</span></p>

    <div class="demo-shell">
      <nav class="demo-side" aria-label="Dashboard views">
        <ul class="demo-tabs">${tabs}</ul>
      </nav>

      <div class="demo-main">
        <section class="demo-view" id="view-overview" data-view="overview" aria-labelledby="h-overview" hidden>
          <header class="demo-view-head">
            <h2 id="h-overview" tabindex="-1">Overview</h2>
            <p class="mono demo-badge">Simulated · last 24 hours</p>
          </header>
          <div class="demo-kpis" data-slot="kpis"></div>
          <div class="demo-cols">
            <section class="demo-plate" aria-labelledby="h-hourly">
              <header class="demo-plate-head">
                <h3 id="h-hourly">Events per hour</h3>
                <div class="demo-legend mono" aria-hidden="true">
                  <span><i class="shape shape--aircraft"></i>Aircraft</span><span><i class="shape shape--drone"></i>Possible drone</span>
                </div>
              </header>
              <div class="demo-chart" data-slot="hourly"></div>
              <details class="demo-table-toggle">
                <summary class="mono">Show as a table</summary>
                <div class="demo-table-wrap" tabindex="0" role="region" aria-label="Events per hour as a table" data-slot="hourly-table"></div>
              </details>
            </section>
            <section class="demo-plate" aria-labelledby="h-latest">
              <header class="demo-plate-head">
                <h3 id="h-latest">Latest events</h3>
                <button class="demo-btn" type="button" id="replay">Replay simulated feed</button>
              </header>
              <ol class="demo-latest" data-slot="latest"></ol>
              <p class="demo-more"><a class="u-link mono" href="#events">All events &rarr;</a></p>
            </section>
          </div>
        </section>

        <section class="demo-view" id="view-events" data-view="events" aria-labelledby="h-events" hidden>
          <header class="demo-view-head">
            <h2 id="h-events" tabindex="-1">Events</h2>
            <p class="mono demo-badge">Simulated · not recorded</p>
          </header>
          <form class="demo-filters" role="search" aria-label="Filter events" onsubmit="return false">
            <label class="demo-field"><span class="mono">Search</span><input type="search" id="f-q" placeholder="ID, class or time" autocomplete="off" /></label>
            <label class="demo-field"><span class="mono">Class</span>
              <select id="f-cls"><option value="all">All</option><option value="aircraft">Aircraft</option><option value="drone">Possible drone</option></select></label>
            <label class="demo-field"><span class="mono">ADS-B</span>
              <select id="f-adsb"><option value="all">All</option><option value="match">ADS-B match</option><option value="none">No ADS-B match</option></select></label>
            <label class="demo-field"><span class="mono">Time</span>
              <select id="f-hours"><option value="24">Last 24 hours</option><option value="6">Last 6 hours</option><option value="1">Last hour</option></select></label>
            <button class="demo-btn" type="button" id="f-reset">Clear</button>
          </form>
          <div class="demo-plate demo-plate--flush">
            <div class="demo-table-wrap demo-events-wrap" tabindex="0" role="region" aria-label="Events table" data-slot="events"></div>
            <footer class="demo-events-foot">
              <p class="mono" id="events-count" role="status" aria-live="polite"></p>
              <div class="demo-foot-actions">
                <button class="demo-btn" type="button" id="more">Show more</button>
                <button class="demo-btn demo-btn--solid" type="button" id="export">Export CSV</button>
              </div>
              <p class="mono demo-note" id="export-note" role="status" hidden></p>
            </footer>
          </div>
        </section>

        <section class="demo-view" id="view-analytics" data-view="analytics" aria-labelledby="h-analytics">
          <header class="demo-view-head">
            <h2 id="h-analytics" tabindex="-1">Analytics</h2>
          </header>
          <div class="demo-section">
            <p class="mono demo-badge demo-badge--measured">${esc(r.tag || 'MEASURED · RECORDED VIDEO')}</p>
            <h3>Measured results</h3>
            <p class="demo-lede">${esc(r.intro || '')} ${r.sample ? `<span class="mono demo-sample">${esc(r.sample)}</span>` : ''}</p>
            <div class="rc-grid">${charts.map(resultChart).join('')}
              ${
                caveats.length
                  ? `<aside class="rc-caveats" aria-labelledby="demo-caveats-title"><h3 class="rc-caveats-title mono" id="demo-caveats-title">What this test does not show</h3><ul>${caveats.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></aside>`
                  : ''
              }
            </div>
            ${charts.length ? resultTable(charts) : ''}
            <p class="results-source mono">${esc(r.source || '')}</p>
          </div>
          <div class="demo-section">
            <p class="mono demo-badge">Simulated · for illustration</p>
            <h3>Model confidence on simulated events</h3>
            <p class="demo-lede">How sure the model reports being, for the sample events. Real confidence values will come from the physical node.</p>
            <div class="demo-chart demo-chart--bins" data-slot="bins"></div>
            <div class="demo-legend mono" aria-hidden="true"><span><i class="shape shape--aircraft"></i>Aircraft</span><span><i class="shape shape--drone"></i>Possible drone</span></div>
          </div>
          <div class="demo-section">
            <h3>Model versions</h3>
            <div class="demo-table-wrap" tabindex="0" role="region" aria-label="Model versions">
              <table class="demo-table">
                <thead><tr><th scope="col">Model</th><th scope="col">Status</th><th scope="col">Evidence</th></tr></thead>
                <tbody>
                  <tr><th scope="row">v2</th><td>${statePill('Measured')}</td><td>Scored on 43 recorded videos. See the measured results above.</td></tr>
                  <tr><th scope="row">v3</th><td>${statePill('Testing')}</td><td>In training, with drone and aircraft classes at 960 px input. No results yet.</td></tr>
                </tbody>
              </table>
            </div>
          </div>
          <div class="demo-section">
            <h3>Definitions</h3>
            <dl class="demo-defs">${defs}</dl>
          </div>
        </section>

        <section class="demo-view" id="view-system" data-view="system" aria-labelledby="h-system">
          <header class="demo-view-head">
            <h2 id="h-system" tabindex="-1">${esc(d.system.heading)}</h2>
          </header>
          <p class="demo-lede">${esc(d.system.intro)}</p>
          <div class="demo-legend demo-legend--states" aria-label="States">${stateLegend}</div>
          <div class="demo-table-wrap" tabindex="0" role="region" aria-label="System status">
            <table class="demo-table demo-table--system">
              <thead><tr><th scope="col">Part</th><th scope="col">State</th><th scope="col">Detail</th></tr></thead>
              <tbody>${rows}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
    </div>
  </div>

  <dialog class="demo-drawer" id="drawer" aria-labelledby="drawer-title">
    <div class="demo-drawer-body" data-slot="drawer"></div>
  </dialog>
</main>
${siteFooter(c, { from: 'demo' })}`;
}
