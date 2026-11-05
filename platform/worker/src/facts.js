// Fact lookup over a read-only copy of platform/src/data/facts.json (bundled at build time; never written).
export const SCOPE_FACT = { id: 'F-SCOPE', text: 'Varn is detection only: a camera finds objects in the sky and labels them drone or aircraft. No jamming or interference.', source: 'S1', source_line: 3, test_set_id: null };
const STOP = new Set('the and for are was were with that this what which when where who how does did can could would should about from into over under than then them they have has had not you your our its any all out per vs show tell give list say'.split(' '));
const words = (s) => String(s).toLowerCase().replace(/[^a-z0-9.%+-]+/g, ' ').split(' ').filter((w) => w.length >= 2 && !STOP.has(w));

/** Simple keyword scoring: each query word counts once per fact, longer words and id matches count more. */
export function scoreFacts(facts, query, n = 8) {
  const q = [...new Set(words(query))];
  if (!q.length) return [];
  const scored = facts.map((f, i) => {
    const text = `${f.text} ${f.test_set_id || ''}`.toLowerCase();
    const idText = String(f.id).toLowerCase();
    let s = 0;
    for (const w of q) { if (text.includes(w)) s += w.length >= 5 ? 2 : 1; if (idText.includes(w)) s += 1; }
    return { f, s, i };
  }).filter((x) => x.s > 0);
  scored.sort((a, b) => b.s - a.s || a.i - b.i);
  return scored.slice(0, n).map((x) => x.f);
}

export const forPrompt = (f) => ({ id: f.id, text: f.text });
