import assert from 'node:assert/strict';
import { test } from 'node:test';
import { content } from '../src/content.js';
import { renderAboutBody, renderBody, renderResearchBody, renderDemoBody } from '../src/render.js';

const text = (html) => html.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ');
const pages = { home: renderBody(content), research: renderResearchBody(content), about: renderAboutBody(content), demo: renderDemoBody(content) };

test('every supporter has a name, what they contributed and the date they agreed in writing', () => {
  for (const s of content.about.supporters) {
    assert.ok(s.name && s.name.trim(), 'name');
    assert.ok(s.contributed && s.contributed.trim(), `${s.name}: contributed`);
    assert.match(s.agreedOn ?? '', /^\d{4}-\d{2}-\d{2}$/, `${s.name}: agreedOn must be a YYYY-MM-DD date`);
    assert.equal(s.logo, undefined, `${s.name}: text only, no logos`);
  }
});

test('no supporters section appears until there is a real supporter', () => {
  const t = text(pages.about);
  if (content.about.supporters.length === 0) {
    assert.doesNotMatch(pages.about, /id="supporters"/);
    assert.doesNotMatch(t, /\bSupporters\b/);
  } else {
    assert.match(pages.about, /id="supporters"/);
    for (const s of content.about.supporters) assert.ok(t.includes(s.name));
  }
});

test('the built-with list is described as a fact about my build, not a sponsorship', () => {
  assert.match(text(pages.about), /not a sponsorship or an endorsement/);
  assert.ok(content.about.builtWith.length >= 1);
});

test('no page claims to be trusted by, sponsored by or partnered with anyone', () => {
  for (const [name, html] of Object.entries(pages)) {
    assert.doesNotMatch(text(html), /trusted by|sponsored by|official partner|in partnership with/i, name);
  }
});
