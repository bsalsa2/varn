import test from 'node:test';
import assert from 'node:assert/strict';
import { validateCommand, LAYERS, WINDOWS, EVENT_CATS, TERMINAL_VERBS, VIEWS } from '../src/allowlist.js';
import { COMMANDS, LAYER_ALIASES } from '../../src/globe/commands.js';
import { WINDOWS as APP_WINDOWS, EVENT_CATEGORIES } from '../../src/globe/feeds.js';

const ok = (c) => { const r = validateCommand(c); assert.equal(r.ok, true, `${c}: ${r.reason}`); return r; };
const no = (c) => assert.equal(validateCommand(c).ok, false, `should reject: ${JSON.stringify(c)}`);

test('allowlist: every allowed verb is a real terminal command that already exists', () => {
  for (const v of TERMINAL_VERBS) assert.ok(COMMANDS[v], `${v} is not a terminal command`);
});
test('allowlist: layer, window and category names match the app\'s own tables', () => {
  assert.deepEqual([...LAYERS].sort(), Object.keys(LAYER_ALIASES).sort());
  assert.deepEqual([...WINDOWS].sort(), Object.keys(APP_WINDOWS).sort());
  assert.deepEqual([...EVENT_CATS].sort(), [...Object.keys(EVENT_CATEGORIES), 'all'].sort());
});

test('allowlist: accepts the view-only commands', () => {
  for (const c of ['home', 'tilt', 'north', 'brief', 'sun', 'imagery', 'layers', 'layers fires on', 'layers CLOUDS off', 'quakes', 'quakes week', 'quakes day 4.5', 'quakes 5',
    'fires', 'fires 7', 'events', 'events floods', 'events all 14', 'go 3', 'fly Kyiv', 'fly 35.05, -118.17', 'fly Strait of Hormuz', 'fly "Strait of Hormuz"', "fly Cote d'Ivoire", 'view sky', 'view records', 'view earth']) ok(c);
  assert.equal(ok('fly Strait of Hormuz').command, 'fly "Strait of Hormuz"');
  assert.equal(ok('  LAYERS   Fires   ON ').command, 'layers fires on');
  assert.equal(ok('view sky').kind, 'view'); assert.equal(ok('go 3').kind, 'terminal');
});

test('allowlist: rejects everything that writes, watches, saves, clears, checks or chains', () => {
  for (const c of ['watch quakes', 'mark home', 'marks', 'clear', 'check', 'check deep', 'history', 'help', 'about', 'status', 'time', 'open sky', 'goto Kyiv',
    'layers fires', 'layers fires maybe', 'layers nonsense on', 'layers fires on extra', 'quakes -1', 'quakes banana', 'quakes day week hour', 'fires 0', 'fires 31', 'fires x', 'events lava', 'events floods 99',
    'go', 'go 0', 'go 101', 'go x', 'home now', 'view mars', 'view', 'fly', 'fly 123', 'fly 99, 0', 'fly 0, 181',
    'fly Kyiv; clear', 'fly Kyiv && clear', 'fly Kyiv | cat', 'fly `id`', 'fly $(id)', 'home\nclear', 'fly <script>', 'layers fires on > x', 'x'.repeat(81), '', '   ', 'rm -rf /']) no(c);
  for (const bad of [null, undefined, 42, {}, [], ['home']]) no(bad);
});

test('allowlist: nothing in it can target, engage, jam or track anything', () => {
  const all = [...TERMINAL_VERBS, 'view', ...LAYERS, ...EVENT_CATS, ...VIEWS].join(' ');
  assert.doesNotMatch(all, /target|engage|jam|weapon|shoot|track|lock|fire /i);     // 'fires' is the wildfire layer, not a weapon verb
});
