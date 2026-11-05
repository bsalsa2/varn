// The last couple of exchanges, sent with each question so a reply like "Yes" has something to refer to.
// Text only: no data, no results, nothing the model produced beyond the words the user already saw.
export function historyFrom(msgs, maxMessages = 4) {
  const out = [];
  for (const m of msgs || []) {
    if (m.role === 'user' && m.text) out.push({ role: 'user', text: String(m.text).slice(0, 300) });
    else if (m.role === 'ai' && m.type === 'command' && m.commands) out.push({ role: 'assistant', text: `${m.say || ''} (I proposed: ${m.commands.join(', then ')})`.trim().slice(0, 700) });
    else if (m.role === 'ai' && !m.error && m.text) out.push({ role: 'assistant', text: String(m.text).slice(0, 700) });
  }
  return out.slice(-maxMessages);
}
