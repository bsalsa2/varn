import test from 'node:test';
import assert from 'node:assert/strict';
import { placeFrom, solarTime, sunState } from './inspect.js';
import { describeAge } from './freshness.js';

test('placeFrom builds a short title and a regional subtitle', () => {
  const p = placeFrom({ name: 'Griffith Park', address: { city: 'Los Angeles', state: 'California', country: 'United States' } });
  assert.deepEqual(p, { title: 'Griffith Park', subtitle: 'Los Angeles, California, United States' });
  assert.deepEqual(placeFrom({ address: { village: 'Tiny', state: 'X', country: 'Y' } }), { title: 'Tiny', subtitle: 'X, Y' });
});
test('placeFrom returns null where the geocoder knows nothing', () => {
  assert.equal(placeFrom(null), null);
  assert.equal(placeFrom({ error: 'Unable to geocode' }), null);
});
test('solar time follows longitude and wraps', () => {
  const noonUtc = Date.parse('2026-06-21T12:00:00Z');
  assert.equal(solarTime(0, noonUtc), '12:00');
  assert.equal(solarTime(90, noonUtc), '18:00');
  assert.equal(solarTime(-180, noonUtc), '00:00');
  assert.equal(solarTime(165, noonUtc), '23:00');
});
test('sunState: overhead is daylight, antipode is night', () => {
  const sun = { lat: 10, lon: 20 };
  assert.equal(sunState(10, 20, sun, 0).phase, 'daylight');
  assert.equal(sunState(-10, -160, sun, 0).phase, 'night');
});
test('describeAge words daily dates and 30-minute timestamps', () => {
  const now = Date.parse('2026-10-29T12:00:00Z');
  assert.equal(describeAge('2026-10-29', now), 'today');
  assert.equal(describeAge('2026-10-27', now), '2 days old');
  assert.equal(describeAge('2026-10-28', now), '1 day old');
  assert.equal(describeAge('2026-10-29T08:20:00Z', now), '3 h 40 min old');
  assert.equal(describeAge('2026-10-29T11:30:00Z', now), '30 min old');
  assert.equal(describeAge('', now), '');
});
