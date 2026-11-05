// Parses evidence/ledger.md into sections and numbered lines. Pure JS (no Vite, no DOM) so the
// UI, the check script and the tests all read the ledger the same way.

const SECTION = /^(S\d+) (.+)$/;

export function parseLedger(text) {
  const rawLines = text.replace(/\r\n/g, '\n').split('\n');
  const lines = rawLines.map((t, i) => ({ n: i + 1, text: t }));
  const sections = [];
  let cur = null;
  for (const l of lines) {
    const m = SECTION.exec(l.text);
    if (m) { cur = { id: m[1], title: m[2], first: l.n, last: l.n, lines: [] }; sections.push(cur); }
    if (cur) { cur.lines.push(l); cur.last = l.n; }
  }
  // trailing blank lines are not part of a section's evidence
  for (const s of sections) {
    while (s.lines.length && s.lines[s.lines.length - 1].text.trim() === '') s.lines.pop();
    s.last = s.lines.length ? s.lines[s.lines.length - 1].n : s.first;
    s.text = s.lines.map((l) => l.text).join('\n');
  }
  const byId = Object.fromEntries(sections.map((s) => [s.id, s]));
  return { lines, sections, byId, line: (n) => lines[n - 1] || null, sectionOfLine: (n) => sections.find((s) => n >= s.first && n <= s.last) || null };
}

// True when `value` appears in `text` as its own token: "0.8" does not match inside "0.85" or "10.8".
export function containsValue(text, value) {
  if (typeof value !== 'string' || value === '') return false;
  const esc = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?<![\\d.,])${esc}(?![\\d]|[.,]\\d)`).test(text);
}

// Numbers in running prose (ids such as T-svan-897 and S5 are not numbers).
const ID = /\b(?:[A-Z]{1,3}-[\w-]*\w|S\d+|(?:run|v)\d+)\b/g;
export function numbersIn(text) {
  return (String(text).replace(ID, ' ').match(/[+-]?\d[\d,]*(?:\.\d+)?%?/g) || []).map((s) => s.replace(/^[+-]/, '').replace(/[,.]$/, ''));
}
