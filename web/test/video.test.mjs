// The command center demo video on the Demo page.
import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { content } from '../src/content.js';
import { demoTranscript, renderDemoBody } from '../src/render.js';

const v = content.demo.video;
const pub = (p) => fileURLToPath(new URL(`../public/${p.replace(/^\.\//, '')}`, import.meta.url));
const html = renderDemoBody(content);
const start = html.indexOf('<section class="demo-video"');
const section = html.slice(start, html.indexOf('</section>', start));
const videoTag = section.slice(section.indexOf('<video'), section.indexOf('>', section.indexOf('<video')) + 1);
const text = (s) => s.replace(/<[^>]+>/g, ' ').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/\s+/g, ' ');

test('the video section is on the Demo page under its heading', () => {
  assert.ok(start >= 0, 'section present');
  assert.match(section, /<h2[^>]*>Command center demo<\/h2>/);
});

test('the video file exists and is under 12 MB', () => {
  const file = pub(v.src);
  assert.ok(existsSync(file), v.src);
  assert.ok(statSync(file).size < 12 * 1024 * 1024, `${statSync(file).size} bytes`);
});

test('the video has a poster image that exists', () => {
  assert.match(videoTag, / poster="\.\/video\/[^"]+\.webp"/);
  assert.ok(existsSync(pub(v.poster)), v.poster);
});

test('the video has an English captions track that is not on by default', () => {
  assert.match(section, /<track kind="captions" src="\.\/video\/[^"]+\.vtt" srclang="en" label="English" \/>/);
  assert.doesNotMatch(section, /<track[^>]*\bdefault\b/);
  const vtt = readFileSync(pub(v.captions), 'utf8');
  assert.match(vtt, /^WEBVTT/);
});

test('the video does not autoplay, loads nothing up front and has controls', () => {
  assert.doesNotMatch(videoTag, /\bautoplay\b/);
  assert.match(videoTag, /\bcontrols\b/);
  assert.match(videoTag, /preload="none"/);
  assert.match(videoTag, /\bplaysinline\b/);
  assert.match(videoTag, /aria-label="[^"]+"/);
});

test('every line of the transcript is visible text in a collapsible section', () => {
  assert.match(section, /<details[^>]*>\s*<summary>Transcript and description<\/summary>/);
  const lines = demoTranscript(v);
  assert.ok(lines.length > 3, 'transcript has lines');
  const page = text(section);
  for (const line of lines) assert.ok(page.includes(line.replace(/\s+/g, ' ')), line);
});

test('the caption says it shows no real Varn detections', () => {
  assert.match(section, /<figcaption[^>]*>[^<]*It uses public data and shows no real Varn detections\.[^<]*<\/figcaption>/);
});

test('no placeholder text reaches the captions or the transcript', () => {
  const vtt = readFileSync(pub(v.captions), 'utf8');
  for (const s of [vtt, demoTranscript(v).join('\n')]) assert.doesNotMatch(s, /to be confirmed|not captioned yet/i);
});

test('the video files are not also at the repository root', () => {
  for (const f of ['varn-command-center-demo.mp4', 'varn-command-center-captions.vtt', 'varn-command-center-transcript.txt'])
    assert.equal(existsSync(fileURLToPath(new URL(`../../${f}`, import.meta.url))), false, f);
});
