// Guards for what the site claims. These fail if wording drifts back to
// something the repository cannot back up. Run with: npm test
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { content } from '../src/content.js';
import { renderAboutBody, renderHead, renderBody, renderDemoBody, renderPrivacyBody, renderResearchBody } from '../src/render.js';

const home = renderBody(content);
const research = renderResearchBody(content);
const about = renderAboutBody(content);
const demo = renderDemoBody(content);
const privacy = renderPrivacyBody(content);
const text = (html) => html.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ');
const readme = readFileSync(fileURLToPath(new URL('../../README.md', import.meta.url)), 'utf8');

test('the hero carries the required copy, both calls to action and the prototype status', () => {
  const t = text(home);
  assert.match(t, /Watch\s+the sky\./);
  assert.match(t, /Exploring a camera-based approach to observing and logging objects in the sky\./);
  assert.match(t, /RESEARCH PROTOTYPE · HARDWARE VALIDATION PENDING/);
  assert.equal(content.hero.demo.href, './demo.html');
  assert.equal(content.hero.results.href, './research.html#results');
  assert.match(home, /class="hero-actions[\s\S]*demo\.html[\s\S]*research\.html#results/);
});

test('the CAD picture is a labelled concept render, not in the hero', () => {
  assert.match(text(home), /CONCEPT RENDER · UNBUILT HARDWARE/);
  assert.match(content.platform.concept.alt, /Not a photograph/);
  assert.doesNotMatch(home.slice(home.indexOf('id="top"'), home.indexOf('id="process"')), /<img/);
});

test('navigation is Platform, Research, About and the demo button', () => {
  assert.deepEqual(content.nav.links.map((l) => l.label), ['Platform', 'Research', 'About']);
  assert.equal(content.nav.cta.label, 'Explore Demo');
});

test('the home page has five parts and keeps detail on the research page', () => {
  for (const id of ['top', 'process', 'platform', 'research', 'close']) assert.match(home, new RegExp(`id="${id}"`));
  assert.doesNotMatch(text(home), /\$113|bill of materials/i);
  assert.match(research, /\$113\.20/);
  for (const id of ['methodology', 'results', 'models', 'hardware', 'validation', 'roadmap', 'references', 'story', 'status', 'limits'])
    assert.match(research, new RegExp(`id="${id}"`));
  assert.match(text(about), /Braden/);
});

test('the process keeps validation pending', () => {
  const last = content.process.stages.at(-1);
  assert.equal(last.state, 'pending');
  assert.match(text(home), /Pending · needs the physical node/);
});

test('the research snapshot shows the weak drone result with its units and the required disclaimer', () => {
  const t = text(home);
  assert.match(t, /14\.9%/);
  assert.match(t, /7\.5%/);
  assert.match(t, /Per clip/);
  assert.match(t, /Per frame/);
  assert.match(t, /not directly comparable/);
  assert.match(t, /Recorded-video evaluation only\. Physical hardware validation pending\./);
  assert.doesNotMatch(t, /v3 (results|scored|achieves)/i);
});

test('the dashboard preview is marked SIMULATED', () => {
  assert.match(home, /SIMULATED/);
  assert.match(home, /class="sim-badge/);
  assert.match(content.platform.banner, /^SIMULATED/);
});

test('no claim that the model reliably tells drones from aircraft', () => {
  const all = text(home) + text(demo) + text(research);
  assert.doesNotMatch(all, /tells drones from aircraft/i);
});

test('no uncited industry price comparison, and the parts cost keeps its exclusions', () => {
  const all = text(home) + text(research);
  assert.doesNotMatch(all, /\$10,000s|tens of thousands|Typical detection system/i);
  assert.match(content.math.statsNote, /not a capability|nothing about capability/i);
  assert.match(content.math.stats[0].value, /~\$113/);
  assert.match(content.researchPage.hardware.costNote, /excludes the computer/);
  assert.match(content.researchPage.hardware.costNote, /not evidence of performance/);
});

test('old section links still land on the research page', () => {
  assert.match(renderHead(content), /research\.html#/);
  for (const id of ['story', 'results', 'status', 'how']) assert.match(research, new RegExp(`id="${id}"`));
});

test('the snapshot numbers match the published results', () => {
  for (const f of content.snapshot.figures.filter((x) => x.number !== null)) {
    const chart = content.results.charts.find((c) => c.kind === f.kind);
    assert.equal(f.number, chart.bars[0].value);
  }
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

test('the demo states SIMULATED on the page, in the top bar and in the data', () => {
  assert.match(content.demo.banner, /^SIMULATED/);
  assert.match(demo, /state-tag--simulated[^>]*>[\s\S]*Simulated data/);
  assert.match(demo, /Not connected/);
  assert.doesNotMatch(demo, /Confirmed aircraft/);
});

test('no fake live telemetry is rendered in the static markup', () => {
  assert.doesNotMatch(home, /FPS|LINK WI-FI|>TRACKING</);
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
