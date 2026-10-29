// Pure helper, kept apart from sources.js so it can be tested without the Vite environment.
/** How old resolved overlay data is, in words: "today", "2 days old", "3 h 40 min old". `time` is a GIBS date or ISO time. */
export function describeAge(time, now = Date.now()) {
  if (!time) return '';
  const at = time.length > 10 ? Date.parse(time) : Date.parse(`${time}T00:00:00Z`);
  if (!Number.isFinite(at)) return '';
  const ms = Math.max(0, now - at);
  if (time.length <= 10) { const d = Math.floor(ms / 86400e3); return d <= 0 ? 'today' : `${d} day${d === 1 ? '' : 's'} old`; }
  const m = Math.round(ms / 60e3);
  return m < 60 ? `${m} min old` : `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min old`;
}

