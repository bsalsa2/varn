// Checks src/content.js before every build, so a typo or a missing field
// shows up as a clear message (pointing at the line) instead of a broken
// page or a confusing build error. Run it on its own with: npm run check
//
// On GitHub, messages also appear as annotations on the pull request.

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const webRoot = join(here, '..');
const file = process.argv[2] ? join(process.cwd(), process.argv[2]) : join(webRoot, 'src', 'content.js');
const shownPath = relative(join(webRoot, '..'), file);
const inCI = !!process.env.GITHUB_ACTIONS;
const source = existsSync(file) ? readFileSync(file, 'utf8') : '';
const lines = source.split('\n');

const errors = [];
const warnings = [];

// Best guess at the line a value lives on, for friendlier messages.
function lineOf(value) {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  const needle = value.trim().slice(0, 40);
  const i = lines.findIndex((l) => l.includes(needle));
  return i >= 0 ? i + 1 : undefined;
}
// Line of `needle` at or after the line containing `anchor`.
function lineAfter(anchor, needle) {
  const start = lines.findIndex((l) => l.includes(anchor));
  if (start < 0) return undefined;
  const i = lines.findIndex((l, n) => n >= start && l.includes(needle));
  return i >= 0 ? i + 1 : undefined;
}
const err = (msg, line) => errors.push({ msg, line });
const warn = (msg, line) => warnings.push({ msg, line });

function print(list, level) {
  for (const { msg, line } of list) {
    const where = line ? `${shownPath}:${line}` : shownPath;
    if (inCI) console.log(`::${level} file=${shownPath}${line ? `,line=${line}` : ''}::${msg}`);
    console.log(`  ${level === 'error' ? 'ERROR' : 'warning'}  ${where}\n           ${msg}`);
  }
}

function finish() {
  if (warnings.length) {
    console.log(`\ncontent.js: ${warnings.length} warning(s)`);
    print(warnings, 'warning');
  }
  if (errors.length) {
    console.log(`\ncontent.js: ${errors.length} problem(s) to fix before the site can build`);
    print(errors, 'error');
    console.log('\nNothing was published. Fix the line(s) above and commit again.\n');
    process.exit(1);
  }
}

// ---- 1. Is it valid JavaScript? -------------------------------------------
if (!existsSync(file)) {
  err(`File not found: ${shownPath}`);
  finish();
}
const syntax = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
if (syntax.status !== 0) {
  const out = syntax.stderr || '';
  const line = Number((out.match(/:(\d+)\s*\n/) || [])[1]) || undefined;
  const reason = (out.match(/SyntaxError: (.*)/) || [])[1] || 'the file could not be read';
  err(
    `Typo: ${reason}. Usual causes: a missing comma at the end of the line above, ` +
      `a missing quote, or an apostrophe inside 'single quotes' (wrap that text in backticks instead).`,
    line
  );
  finish();
}

// ---- 2. Does it have everything the page needs? ---------------------------
let content;
try {
  ({ content } = await import(pathToFileURL(file).href));
} catch (e) {
  err(`Could not load the file: ${e.message}`);
  finish();
}
if (!content || typeof content !== 'object') {
  err('The file must export `content` (the first line should be: export const content = {).');
  finish();
}

const get = (path) => path.split('.').reduce((o, k) => (o == null ? o : o[k]), content);

function text(path, value = get(path)) {
  if (typeof value !== 'string' || !value.trim()) {
    const simple = !/\.\d+\./.test(path); // list items: no reliable line to point at
    err(`${path} is missing or empty.`, simple ? lineOf(path.split('.').pop() + ':') : undefined);
    return false;
  }
  return true;
}

function list(path, { min = 1 } = {}) {
  const value = get(path);
  if (!Array.isArray(value)) {
    err(`${path} should be a list in [square brackets].`);
    return [];
  }
  if (value.length < min) err(`${path} needs at least ${min} item(s).`);
  return value;
}

// Anchors that exist on each page. Links written as "#id" point at the home
// page; "./research.html#id" and friends point at those pages.
const pageIds = {
  home: ['top', 'process', 'platform', 'research', 'close'],
  'research.html': ['methodology', 'story', 'results', 'models', 'limits', 'labels', 'hardware', 'math', 'how', 'mount', 'validation', 'tested', 'status', 'roadmap', 'references'],
  'about.html': ['build'],
};

function link(path, value = get(path)) {
  if (!text(path, value)) return;
  if (value.startsWith('#')) {
    if (!pageIds.home.includes(value.slice(1)))
      err(`${path} points to "${value}", which isn't a section on the home page. Use one of: ${pageIds.home.map((s) => '#' + s).join(', ')}.`, lineOf(value));
  } else if (value.startsWith('http://')) {
    warn(`${path} uses http://. Prefer https:// so browsers don't warn visitors.`, lineOf(value));
  } else if (/^\.\/([\w-]+\.html)?(#[\w-]+)?$/.test(value)) {
    const [page, hash] = value.slice(2).split('#');
    if (page && !existsSync(join(webRoot, page)))
      err(`${path} points to "${value}", but there's no such page in web/.`, lineOf(value));
    const ids = page ? pageIds[page] : pageIds.home;
    if (hash && ids && !ids.includes(hash))
      err(`${path} points to "${value}", but ${page || 'the home page'} has no section "${hash}". Use one of: ${ids.map((s) => '#' + s).join(', ')}.`, lineOf(value));
  } else if (!/^(https:\/\/|mailto:)/.test(value)) {
    err(`${path} should start with https://, mailto:, #, or ./page.html (got "${value}").`, lineOf(value));
  }
}

function publicFile(path, value = get(path)) {
  if (!value || /^https:\/\//.test(value)) return;
  if (!existsSync(join(webRoot, 'public', value)))
    err(`${path} is "${value}", but there's no file at web/public/${value}. Upload it there first.`, lineOf(value));
}

const gc = get('analytics.goatcounter');
if (gc && !/^[a-z0-9-]+$/.test(gc))
  err(`analytics.goatcounter should be just your GoatCounter code, like 'varn' (lowercase letters, numbers, dashes), not "${gc}".`, lineOf(gc));

text('meta.title');
text('meta.description');
link('meta.url');

text('nav.brand');
list('nav.links').forEach((l, i) => {
  text(`nav.links.${i}.label`, l?.label);
  link(`nav.links.${i}.href`, l?.href);
});

['eyebrow', 'headline', 'sub', 'status'].forEach((k) => text(`hero.${k}`));
text('nav.cta.label');
link('nav.cta.href');
text('hero.demo.label');
link('hero.demo.href');
text('hero.results.label');
link('hero.results.href');
text('platform.concept.alt');
text('platform.concept.caption');
publicFile('platform.concept.src');
publicFile('platform.concept.small');
// The concept picture is a CAD render of planned hardware, and must say so.
if (!/CONCEPT RENDER/.test(get('platform.concept.caption') || '') || !/UNBUILT/i.test(get('platform.concept.caption') || ''))
  err('platform.concept.caption must say the picture is a concept render of unbuilt hardware.', lineOf('caption:'));
if (!/RESEARCH PROTOTYPE/.test(get('hero.status') || '') || !/PENDING/.test(get('hero.status') || ''))
  err('hero.status must say it is a research prototype and that hardware validation is pending.', lineOf('status:'));

// The three home sections after the hero.
list('process.stages', { min: 3 }).forEach((st, i) => {
  ['name', 'text', 'status'].forEach((k) => text(`process.stages.${i}.${k}`, st?.[k]));
  if (!['tested', 'pending'].includes(st?.state)) err(`process.stages.${i}.state must be 'tested' or 'pending'.`, lineOf(st?.name));
});
if (get('process.stages.2.state') !== 'pending')
  err('The last process stage (Validate) must stay "pending" until real hardware validation exists.', lineOf('Validate'));
if (get('process.note')) text('process.note');
link('process.link.href');
text('platform.heading');
text('platform.banner');
if (!/^SIMULATED/.test(get('platform.banner') || '') || get('platform.badge') !== 'SIMULATED')
  err('platform.banner must start with SIMULATED and platform.badge must be exactly SIMULATED.', lineOf('banner:'));
link('platform.cta.href');
list('platform.tabs', { min: 4 }).forEach((t, i) => {
  text(`platform.tabs.${i}.id`, t?.id);
  text(`platform.tabs.${i}.label`, t?.label);
});
text('snapshot.heading');
text('snapshot.intro');
if (get('snapshot.disclaimer') !== 'Recorded-video evaluation only. Physical hardware validation pending.')
  err('snapshot.disclaimer must read exactly "Recorded-video evaluation only. Physical hardware validation pending."', lineOf('disclaimer:'));
text('snapshot.notComparable');
link('snapshot.link.href');
text('close.heading');
text('close.text');
text('close.disclosure');
text('close.copyright');
// The research snapshot repeats numbers published in `results`, which stay the
// one source: the page reads them from there, and these must match.
{
  const charts = get('results.charts') || [];
  const val = (kind) => charts.find((ch) => ch?.kind === kind)?.bars?.[0]?.value;
  for (const [i, f] of (get('snapshot.figures') || []).entries()) {
    if (f?.kind !== 'drone' && f?.kind !== 'aircraft') continue;
    if (f.number !== val(f.kind) || f.value !== `${val(f.kind)}%`)
      err(`snapshot.figures.${i} says ${f.value}, but results has ${val(f.kind)}%. They must match.`, lineOf(f.label));
  }
}
if (get('researchPage')) {
  ['title', 'description', 'heading', 'intro'].forEach((k) => text(`researchPage.${k}`));
  list('researchPage.sections').forEach((sec, i) => {
    text(`researchPage.sections.${i}.id`, sec?.id);
    if (!pageIds['research.html'].includes(sec?.id)) err(`researchPage.sections.${i}.id "${sec?.id}" is not a section of the research page.`, lineOf(sec?.id));
  });
  text('researchPage.hardware.costNote');
  // The parts cost must keep saying what it leaves out, and that it is not performance.
  if (!/excludes the computer/i.test(get('researchPage.hardware.costNote') || '') || !/not evidence of performance/i.test(get('researchPage.hardware.costNote') || ''))
    err('researchPage.hardware.costNote must say the cost excludes the computer and is not evidence of performance.', lineOf('costNote:'));
  list('researchPage.references.items').forEach((it, i) => link(`researchPage.references.items.${i}.href`, it?.href));
}
if (get('about')) {
  ['title', 'heading', 'contactText'].forEach((k) => text(`about.${k}`));
  link('about.contactCta.href');
}
if (get('footer.legal')) list('footer.legal').forEach((l, i) => link(`footer.legal.${i}.href`, l?.href));

const footage = get('hero.footage');
if (footage && footage.video) {
  publicFile('hero.footage.video');
  publicFile('hero.footage.poster');
  if (!footage.caption || !footage.caption.trim())
    err('hero.footage.caption is empty. Say what the clip shows before it goes on the page.', lineAfter('footage:', 'caption:'));
}

text('math.body');
if (get('math.stats') && !get('math.statsNote'))
  err('math.stats compares prices, so math.statsNote must say it is a price comparison only, not a capability comparison.', lineOf('stats:'));
if (get('math.statsNote') !== undefined) text('math.statsNote');
if (get('math.useCases')) {
  text('math.useCases.tag');
  text('math.useCases.text');
}
if (get('math.statement') !== undefined) {
  if (text('math.statement') && (get('math.statement').match(/\[/g) || []).length !== (get('math.statement').match(/\]/g) || []).length)
    err('math.statement has an unmatched [ or ]. Put [square brackets] around the words to light up.', lineOf('statement:'));
}
if (get('math.stats') !== undefined) {
  list('math.stats').forEach((s, i) => {
    text(`math.stats.${i}.label`, s?.label);
    text(`math.stats.${i}.value`, s?.value);
  });
}

text('how.heading');
text('story.heading');
text('story.intro');
if (get('story.hint') !== undefined) text('story.hint');
list('story.stages').forEach((st, i) => {
  ['number', 'title', 'fact', 'body'].forEach((k) => text(`story.stages.${i}.${k}`, st?.[k]));
});
for (const path of ['story.device', 'story.note']) {
  const v = get(path);
  if (typeof v !== 'string' || !/\bSAMPLE\b/.test(v)) err(`${path} must contain the word SAMPLE: the story panel is a simulation.`, lineOf('story:'));
}
if (get('ticker')) list('ticker').forEach((t, i) => text(`ticker.${i}`, t));
if (get('tested')) {
  text('tested.heading');
  list('tested.columns').forEach((col, i) => {
    ['tag', 'title'].forEach((k) => text(`tested.columns.${i}.${k}`, col?.[k]));
    list(`tested.columns.${i}.items`).forEach((it, j) => text(`tested.columns.${i}.items.${j}`, it));
  });
}
text('labels.heading');
text('labels.note');
list('labels.items').forEach((it, i) => {
  if (!['aircraft', 'drone', 'no-adsb'].includes(it?.kind)) err(`labels.items.${i}.kind must be 'aircraft', 'drone' or 'no-adsb'.`, lineOf('labels:'));
  ['title', 'shape', 'rule'].forEach((k) => text(`labels.items.${i}.${k}`, it?.[k]));
});
text('how.note');
// Sample and preview content must say so.
for (const path of ['how.sensor.label', 'how.radar.label', 'how.radar.caption']) {
  const v = get(path);
  if (typeof v === 'string' && !/\bSAMPLE\b/.test(v))
    err(`${path} shows simulated content, so it must contain the word SAMPLE.`, lineOf(v));
}
// Brand voice: Varn only watches. These words never appear on the page.
for (const word of ['missile', 'kill', 'strike', 'defeat']) {
  const i = lines.findIndex((l) => !/^\s*\/\//.test(l) && new RegExp(`\\b${word}`, 'i').test(l));
  if (i >= 0) err(`"${word}" is off-brand: Varn is detection only. Reword this line.`, i + 1);
}
if (get('how.sensor')) {
  text('how.sensor.label');
  text('how.sensor.caption');
}
if (get('how.mount')) {
  text('how.mount.label');
  text('how.mount.caption');
  list('how.mount.parts').forEach((p, i) => {
    text(`how.mount.parts.${i}.name`, p?.name);
    text(`how.mount.parts.${i}.text`, p?.text);
  });
}

if (get('limits')) {
  text('limits.heading');
  list('limits.items').forEach((it, i) => {
    text(`limits.items.${i}.tag`, it?.tag);
    text(`limits.items.${i}.text`, it?.text);
  });
}

text('status.heading');
const LABELS = ['DONE', 'IN PROGRESS', 'NEXT'];
const counts = { DONE: 0, 'IN PROGRESS': 0, NEXT: 0 };
list('status.items').forEach((it, i) => {
  if (!text(`status.items.${i}.text`, it?.text)) return;
  if (!LABELS.includes(it?.label)) {
    err(
      `Status item ${i + 1} has label "${it?.label}". Use exactly 'DONE', 'IN PROGRESS', or 'NEXT' (capital letters).`,
      lineOf(it.text)
    );
  } else counts[it.label]++;
});

const results = get('results');
if (results && Array.isArray(results.items))
  err('results.items has been replaced by results.charts (bars on a 0 to 100% scale). See the comment above results in content.js.', lineAfter('results:', 'items:'));
if (results && Array.isArray(results.charts) && results.charts.length) {
  text('results.heading');
  results.charts.forEach((ch, i) => {
    text(`results.charts.${i}.title`, ch?.title);
    text(`results.charts.${i}.unit`, ch?.unit);
    if (!['aircraft', 'drone'].includes(ch?.kind))
      err(`results.charts.${i}.kind is "${ch?.kind}". Use 'aircraft' or 'drone'.`, lineOf(ch?.title));
    list(`results.charts.${i}.bars`).forEach((b, j) => {
      text(`results.charts.${i}.bars.${j}.label`, b?.label);
      const v = b?.value;
      if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > 100)
        err(
          `results.charts.${i}.bars.${j}.value should be a plain number from 0 to 100, like 7.5 for 7.5% (got ${JSON.stringify(v)}).`,
          lineOf(b?.label)
        );
      if (b?.detail !== undefined) text(`results.charts.${i}.bars.${j}.detail`, b.detail);
    });
  });
  if (results.caveats !== undefined) list('results.caveats').forEach((_, i) => text(`results.caveats.${i}`));
  if (!results.source || !results.source.trim())
    err('results has numbers but results.source is empty. Say how and when they were measured.', lineAfter('results:', 'source:'));
}

text('build.heading');
text('build.body');
if (get('build.quote') !== undefined) text('build.quote');

if (get('privacy')) {
  ['title', 'updated', 'intro', 'contactText'].forEach((k) => text(`privacy.${k}`));
  list('privacy.sections').forEach((sec, i) => {
    text(`privacy.sections.${i}.heading`, sec?.heading);
    text(`privacy.sections.${i}.text`, sec?.text);
    if (sec?.link) link(`privacy.sections.${i}.link.href`, sec.link.href);
  });
}

text('roadmap.heading');
if (get('roadmap.intro') !== undefined) text('roadmap.intro');
list('roadmap.phases').forEach((p, i) => {
  ['phase', 'title', 'body'].forEach((k) => text(`roadmap.phases.${i}.${k}`, p?.[k]));
});
text('roadmap.closing');

if (get('sister')) {
  ['label', 'name', 'linkLabel'].forEach((k) => text(`sister.${k}`));
  link('sister.href');
}

if (get('contact')) {
  ['kicker', 'title', 'description', 'heading', 'intro', 'nameLabel', 'emailLabel', 'messageLabel', 'submitLabel', 'sendingLabel', 'successText', 'mailtoText', 'errorText'].forEach((k) => text(`contact.${k}`));
  const ep = get('contact.endpoint');
  if (ep && !/^https:\/\//.test(ep)) err(`contact.endpoint must start with https:// (got "${ep}").`, lineOf(ep));
}

text('footer.brand');
list('footer.links').forEach((l, i) => {
  text(`footer.links.${i}.label`, l?.label);
  link(`footer.links.${i}.href`, l?.href);
});
text('footer.contactLabel');
if (text('footer.email') && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(get('footer.email')))
  err(`footer.email doesn't look like an email address.`, lineOf(get('footer.email')));

// ---- 3. House rules: no placeholders, no emoji ----------------------------
(function walk(value, path) {
  if (typeof value === 'string') {
    if (/lorem ipsum|\bTODO\b|\bTBD\b|\bxxx\b/i.test(value))
      err(`${path} still has placeholder text: "${value.slice(0, 60)}".`, lineOf(value));
    if (/\p{Extended_Pictographic}/u.test(value))
      warn(`${path} contains an emoji; the site style avoids them.`, lineOf(value));
  } else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) walk(v, path ? `${path}.${k}` : k);
  }
})(content, '');

// ---- 4. Site settings: the contact address must be a real one --------------
// Only a warning: the site still builds, but the footer and privacy page
// would show the placeholder address.
const configFile = join(webRoot, 'src', 'config.js');
if (existsSync(configFile) && /CONTACT_EMAIL\s*=\s*['"][^'"]*@example\.(com|org|net)['"]/.test(readFileSync(configFile, 'utf8')))
  warn('web/src/config.js still has the placeholder CONTACT_EMAIL; set your real contact address.');

finish();
console.log(
  `content.js OK: ${counts.DONE} done, ${counts['IN PROGRESS']} in progress, ${counts.NEXT} next` +
    (results?.charts?.length ? `, ${results.charts.reduce((n, ch) => n + (ch?.bars?.length || 0), 0)} result(s)` : '') +
    (footage?.video ? ', real footage on' : '')
);
