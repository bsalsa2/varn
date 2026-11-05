// The last few chat messages, so "yes" after an offer makes sense. Validated strictly: the browser may send at most 4
// short plain-text messages and nothing else.
export const MAX_HISTORY = 4;
export function validateHistory(h) {
  if (h == null) return { ok: true, value: [] };
  if (!Array.isArray(h) || h.length > MAX_HISTORY) return { ok: false, error: 'history: too long' };
  const out = [];
  for (const m of h) {
    if (!m || typeof m !== 'object' || Object.keys(m).some((k) => !['role', 'text'].includes(k))) return { ok: false, error: 'history: bad message' };
    if (!['user', 'assistant'].includes(m.role) || typeof m.text !== 'string' || !m.text.trim() || m.text.length > (m.role === 'user' ? 300 : 700)) return { ok: false, error: 'history: bad message' };
    out.push({ role: m.role, content: m.text.trim() });
  }
  return { ok: true, value: out };
}
