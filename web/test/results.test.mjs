// Tests for the Results charts (render.js) and their checks (check-content.mjs).
// Run with: npm test   (Node's built-in test runner; no network)
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { content } from '../src/content.js';
import { resultsSection } from '../src/render.js';

const webRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const sample = {
  heading: 'Results so far',
  tag: 'MEASURED · RECORDED VIDEO',
  sample: '43 videos',
  charts: [
    {
      kind: 'aircraft',
      title: 'Aircraft wrongly called a drone',
      unit: 'Share of aircraft frames. Lower is better.',
      bars: [
        { label: 'All aircraft', value: 7.5, detail: '798 of 10,657 frames' },
        { label: 'Military jets', value: 10.8, part: true },
      ],
    },
    { kind: 'drone', title: 'Drones labeled correctly', unit: 'Share of drone clips.', bars: [{ label: 'Drone clips', value: 14.9 }] },
  ],
  caveats: ['Recorded video only.'],
  source: 'Model v2, 43 videos.',
};
const html = resultsSection(sample, () => 6);

test('each bar is drawn at its value on a 0-100 scale', () => {
  const widths = [...html.matchAll(/class="rc-bar" style="--v:([\d.]+)"/g)].map((m) => Number(m[1]));
  assert.deepEqual(widths, [7.5, 10.8, 14.9]);
});

test('every value is printed as text in the chart and again in the table', () => {
  for (const v of ['7.5%', '10.8%', '14.9%']) {
    assert.equal(html.split(`>${v}<`).length - 1, 2, `${v} should appear in the chart and the table`);
  }
});

test('breakdown rows, colours, caveats and source are rendered', () => {
  assert.match(html, /class="rc-row rc-row--part"/);
  assert.match(html, /rc-panel--aircraft/);
  assert.match(html, /rc-panel--drone/);
  assert.match(html, /What this test does not show/);
  assert.match(html, /Recorded video only\./);
  assert.match(html, /Model v2, 43 videos\./);
  assert.match(html, /<th scope="rowgroup" colspan="3"/);
});

test('text is escaped', () => {
  const out = resultsSection({ ...sample, charts: [{ ...sample.charts[1], title: '<b>x</b>' }] }, () => 1);
  assert.doesNotMatch(out, /<b>x<\/b>/);
  assert.match(out, /&lt;b&gt;x&lt;\/b&gt;/);
});

test('the section is hidden until there are charts', () => {
  assert.equal(resultsSection({ ...sample, charts: [] }, () => 1), '');
  assert.equal(resultsSection(undefined, () => 1), '');
});

test('the published content renders bars that match its numbers', () => {
  const out = resultsSection(content.results, () => 1);
  const expected = content.results.charts.flatMap((ch) => ch.bars.map((b) => b.value));
  const widths = [...out.matchAll(/class="rc-bar" style="--v:([\d.]+)"/g)].map((m) => Number(m[1]));
  assert.deepEqual(widths, expected);
});

// Runs check-content.mjs on a copy of content.js with one edit applied.
function checkWith(edit) {
  const dir = mkdtempSync(join(tmpdir(), 'varn-check-'));
  try {
    copyFileSync(join(webRoot, 'src', 'config.js'), join(dir, 'config.js'));
    const src = readFileSync(join(webRoot, 'src', 'content.js'), 'utf8');
    const changed = edit(src);
    assert.notEqual(changed, src, 'the edit should change content.js');
    writeFileSync(join(dir, 'content.js'), changed);
    return spawnSync(process.execPath, [join(webRoot, 'scripts', 'check-content.mjs'), join(dir, 'content.js')], {
      cwd: '/',
      encoding: 'utf8',
      env: { ...process.env, GITHUB_ACTIONS: '' },
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('the check accepts the published content', () => {
  const r = checkWith((s) => s.replace("heading: 'Results so far'", "heading: 'Results so far '"));
  assert.equal(r.status, 0, r.stdout + r.stderr);
});

test('the check refuses a value written as text or outside 0-100', () => {
  const asText = checkWith((s) => s.replace('value: 7.5,', "value: '7.5%',"));
  assert.equal(asText.status, 1);
  assert.match(asText.stdout, /plain number from 0 to 100/);
  const tooBig = checkWith((s) => s.replace('value: 7.5,', 'value: 750,'));
  assert.equal(tooBig.status, 1);
});

test('the check refuses numbers without a source', () => {
  const r = checkWith((s) => s.replace(/source: 'Model v2, 43 real-world videos[^']*'/, "source: ''"));
  assert.equal(r.status, 1);
  assert.match(r.stdout, /results\.source is empty/);
});

test('the check refuses an unknown chart kind', () => {
  const r = checkWith((s) => s.replace(/kind: 'drone',(\s*title: 'Drones labeled correctly')/, "kind: 'bird',$1"));
  assert.equal(r.status, 1);
  assert.match(r.stdout, /Use 'aircraft' or 'drone'/);
});
