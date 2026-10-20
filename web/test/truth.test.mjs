// Guards for what the site claims. These fail if wording drifts back to
// something the repository cannot back up. Run with: npm test
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { content } from '../src/content.js';
import { renderBody, renderDemoBody, renderPrivacyBody } from '../src/render.js';

const home = renderBody(content);
const demo = renderDemoBody(content);
const privacy = renderPrivacyBody(content);
const text = (html) => html.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ');
const readme = readFileSync(fileURLToPath(new URL('../../README.md', import.meta.url)), 'utf8');

test('the hero leads with the demo and the measured results', () => {
  assert.equal(content.hero.demo.href, './demo.html');
  assert.equal(content.hero.results.href, '#results');
  assert.match(home, /class="hero-actions"[\s\S]*demo\.html[\s\S]*#results/);
});

test('no claim that the model reliably tells drones from aircraft', () => {
  const all = text(home) + text(demo);
  assert.doesNotMatch(all, /tells drones from aircraft/i);
  assert.match(content.hero.sub, /weak at drones/i);
});

test('no uncited industry price comparison', () => {
  const all = text(home);
  assert.doesNotMatch(all, /\$10,000s|tens of thousands|Typical detection system/i);
  assert.match(content.math.statsNote, /not a capability|nothing about capability/i);
  assert.match(content.math.stats[0].value, /~\$113/);
  assert.match(content.hero.cost, /before the computer/);
});

test('the two published v2 numbers keep their units and are marked not comparable', () => {
  const [aircraft, drone] = content.results.charts;
  assert.match(aircraft.unit, /aircraft frames/);
  assert.equal(aircraft.bars[0].value, 7.5);
  assert.equal(aircraft.bars[0].detail, '798 of 10,657 frames');
  assert.match(drone.unit, /drone clips/);
  assert.equal(drone.bars[0].value, 14.9);
  assert.match(drone.bars[0].detail, /number of drone clips is not listed/i);
  assert.ok(content.results.caveats.some((c) => /different units/i.test(c)));
});

test('the demo states SIMULATED on the page, in the sidebar and in the data', () => {
  assert.match(content.demo.banner, /^SIMULATED/);
  assert.match(demo, /SIMULATED DEMO/);
  assert.doesNotMatch(demo, /Confirmed aircraft/);
});

test('no fake live telemetry is rendered in the static markup', () => {
  assert.doesNotMatch(home, /FPS|LINK WI-FI|>TRACKING</);
  const lens = readFileSync(fileURLToPath(new URL('../src/hero-lens.js', import.meta.url)), 'utf8');
  assert.doesNotMatch(lens, /stamp\(|clockBase/);
  const sensor = readFileSync(fileURLToPath(new URL('../src/sensor.js', import.meta.url)), 'utf8');
  assert.doesNotMatch(sensor, /FPS/);
});

test('the privacy page matches how the site is actually run', () => {
  const p = text(privacy);
  assert.match(p, /GitHub Pages/);
  assert.doesNotMatch(p, /Netlify/);
  assert.match(p, /Formspree/);
  assert.doesNotMatch(p, /doesn't collect personal information/);
  const pages = readFileSync(fileURLToPath(new URL('../../.github/workflows/pages.yml', import.meta.url)), 'utf8');
  assert.match(pages, /GitHub Pages/i);
});

test('the README describes the same classes as the site', () => {
  assert.doesNotMatch(readme, /aircraft and birds/i);
  assert.match(readme, /drones and aircraft/i);
});
