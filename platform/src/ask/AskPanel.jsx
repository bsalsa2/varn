import React, { useCallback, useEffect, useRef, useState } from 'react';
import { MessageSquareText, X, Send, Play, LogIn, Loader2 } from 'lucide-react';
import './ask.css';
import { createClient } from './client.js';
import { askHost } from './host.js';
import { validateCommands } from '../../worker/src/allowlist.js';
import { isBriefing } from '../../worker/src/intent.js';
import { historyFrom } from './history.js';

export const DISCLAIMER = "AI assistant. It can be wrong. Answers come from the app's data; sources shown.";
const client = createClient({ base: import.meta.env.VITE_ASK_URL });

let nextId = 1;
const mk = (m) => ({ id: nextId++, ...m });

function Sources({ ids, cited }) {
  const [open, setOpen] = useState(null);
  if (!ids || !ids.length) return null;
  return (
    <div className="ask-src">
      <ul>{ids.map((id) => (
        <li key={id}><button type="button" aria-expanded={open === id} onClick={() => setOpen(open === id ? null : id)}>{id}</button></li>
      ))}</ul>
      {open ? <p className="ask-srctext">{cited?.[open] || `Computed in code from the app's live data (${open}).`}</p> : null}
    </div>
  );
}

export function CommandChip({ msg, onRun, onDismiss, canRun }) {
  const cmds = msg.commands || [msg.command];
  return (
    <div className="ask-cmd">
      <p>{msg.say}</p>
      <div className="ask-cmdrow">
        {cmds.map((c, i) => <React.Fragment key={c + i}>{i ? <span className="ask-then" aria-hidden="true">then</span> : null}<code>{c}</code></React.Fragment>)}
        {msg.state === 'ran' ? <span className="ask-done">Ran</span> : msg.state === 'dismissed' ? <span className="ask-done">Dismissed</span> : (
          <>
            <button type="button" className="ask-run" onClick={() => onRun(msg)} disabled={!canRun} aria-describedby={canRun ? undefined : `why-${msg.id}`}><Play size={13} aria-hidden="true" /> {cmds.length > 1 ? `Run ${cmds.length} steps` : 'Run'}</button>
            <button type="button" className="ask-quiet" onClick={() => onDismiss(msg)}>Dismiss</button>
          </>
        )}
      </div>
      {!canRun && !msg.state ? <p id={`why-${msg.id}`} className="ask-note">Commands run on the Earth view. Open it, then press Run.</p> : null}
      {msg.output ? <pre className="ask-out" aria-label="Command output">{msg.output.map((l) => l.t).join('\n')}</pre> : null}
    </div>
  );
}

export function Bubble({ msg, onRun, onDismiss, canRun }) {
  if (msg.role === 'user') return <div className="ask-msg ask-user"><p>{msg.text}</p></div>;
  if (msg.type === 'command') return <div className="ask-msg ask-ai"><CommandChip msg={msg} onRun={onRun} onDismiss={onDismiss} canRun={canRun} /></div>;
  return (
    <div className={`ask-msg ask-ai${msg.error ? ' ask-error' : ''}`}>
      <p>{msg.error ? <strong>Problem: </strong> : null}{msg.text}</p>
      {msg.type === 'raw' ? (
        <details><summary>Raw results</summary>
          <pre className="ask-out">{JSON.stringify({ results: msg.results, facts: msg.facts, diag: msg.diag }, null, 2)}</pre>
        </details>
      ) : null}
      <Sources ids={msg.sources} cited={msg.cited} />
    </div>
  );
}

export default function AskPanel() {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState('');
  const [pw, setPw] = useState('');
  const [signedIn, setSignedIn] = useState(client.signedIn);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [hasEarth, setHasEarth] = useState(askHost.has('earth'));
  const btn = useRef(null), input = useRef(null), pwInput = useRef(null), log = useRef(null);

  useEffect(() => askHost.subscribe(() => setHasEarth(askHost.has('earth'))), []);

  // Ctrl+J toggles; Escape closes and gives focus back to the button.
  useEffect(() => {
    const on = (e) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'j') { e.preventDefault(); setOpen((v) => !v); }
      else if (e.key === 'Escape' && open) { setOpen(false); btn.current?.focus(); }
    };
    addEventListener('keydown', on);
    return () => removeEventListener('keydown', on);
  }, [open]);

  useEffect(() => { if (open) (signedIn ? input : pwInput).current?.focus(); }, [open, signedIn]);
  useEffect(() => { const el = log.current; if (el) el.scrollTop = el.scrollHeight; }, [msgs, busy]);

  const add = useCallback((m) => setMsgs((l) => [...l, mk(m)]), []);
  const patch = useCallback((id, p) => setMsgs((l) => l.map((m) => (m.id === id ? { ...m, ...p } : m))), []);

  async function login(e) {
    e.preventDefault();
    if (!pw || busy) return;
    setBusy(true); setNote('');
    const r = await client.login(pw);
    setPw(''); setBusy(false);
    if (r.ok) { setSignedIn(true); setNote(''); } else setNote(r.message || 'Could not sign in.');
  }

  async function send(e) {
    e.preventDefault();
    const q = text.trim();
    if (!q || busy) return;
    const history = historyFrom(msgs);                      // what was said before this question
    setText(''); setBusy(true);
    add({ role: 'user', text: q });
    const live = await askHost.snapshot(undefined, { briefing: isBriefing(q) });
    const r = await client.ask(q, live, history);
    setBusy(false);
    if (r.response) {
      const a = r.response;
      if (a.type === 'command') {
        const v = validateCommands(Array.isArray(a.commands) ? a.commands : [a.command]);     // checked again here before it is ever shown as runnable
        add(v.ok ? { role: 'ai', type: 'command', commands: v.commands, kind: v.kind, say: a.say } : { role: 'ai', error: true, text: 'The assistant proposed something that is not allowed, so it was dropped.' });
      } else add({ role: 'ai', type: a.type, text: a.text, sources: a.sources, cited: a.cited, results: a.results, facts: a.facts, diag: a.diag });
      return;
    }
    if (r.error === 'unauthorized') { setSignedIn(false); setNote('Your session ended. Sign in again.'); return; }
    add({ role: 'ai', error: true, text: r.message || 'The assistant is unavailable right now.' });
  }

  async function run(m) {
    patch(m.id, { state: 'ran' });
    const out = [];
    let ok = true;
    for (const c of m.commands) {                                  // in order, one click; stops at the first step that fails
      const r = await askHost.run(c);
      if (m.commands.length > 1) out.push({ t: `> ${c}` });
      out.push(...r.lines);
      if (!r.ok) { ok = false; break; }
    }
    patch(m.id, { state: ok ? 'ran' : undefined, output: out });
  }

  const canRun = (m) => m.kind === 'view' || hasEarth;

  return (
    <div className={`ask${open ? ' ask-open' : ''}`}>
      <button ref={btn} type="button" className="ask-fab" onClick={() => setOpen(true)} aria-expanded={open} aria-controls="ask-panel" aria-label="Ask the assistant (Ctrl+J)" title="Ask (Ctrl+J)" tabIndex={open ? -1 : 0}>
        <MessageSquareText size={18} aria-hidden="true" /><span>Ask</span>
      </button>
      <section id="ask-panel" className="ask-panel" role="dialog" aria-modal="false" aria-label="Ask the assistant" aria-hidden={!open} inert={!open}>
        <header>
          <h2>Ask</h2>
          <button type="button" className="ask-x" onClick={() => { setOpen(false); btn.current?.focus(); }} aria-label="Close assistant"><X size={16} aria-hidden="true" /></button>
        </header>
        <p className="ask-label">{DISCLAIMER}</p>

        {!signedIn ? (
          <form className="ask-login" onSubmit={login}>
            <label htmlFor="ask-pw">Password</label>
            <input id="ask-pw" ref={pwInput} type="password" autoComplete="off" value={pw} onChange={(e) => setPw(e.target.value)} maxLength={256} />
            <button type="submit" className="ask-run" disabled={busy || !pw}>{busy ? <Loader2 size={14} className="ask-spin" aria-hidden="true" /> : <LogIn size={14} aria-hidden="true" />} Sign in</button>
            {note ? <p className="ask-note" role="alert">{note}</p> : null}
            <p className="ask-note">Private assistant. You stay signed in until you reload or 8 hours pass.</p>
          </form>
        ) : (
          <>
            <div className="ask-log" ref={log} role="log" aria-live="polite" aria-label="Conversation">
              {msgs.length === 0 ? (
                <div className="ask-empty">
                  <p>Try: "Brief me on what's on screen", "How strong was the biggest quake?", "Fly to Kyiv", "What did v3 score on held-out Svanstrom videos?"</p>
                </div>
              ) : msgs.map((m) => <Bubble key={m.id} msg={m} onRun={run} onDismiss={(x) => patch(x.id, { state: 'dismissed' })} canRun={canRun(m)} />)}
              {busy ? <p className="ask-msg ask-ai ask-wait"><Loader2 size={14} className="ask-spin" aria-hidden="true" /> Thinking…</p> : null}
            </div>
            <form className="ask-compose" onSubmit={send}>
              <label htmlFor="ask-q" className="ask-sr">Your question</label>
              <input id="ask-q" ref={input} value={text} onChange={(e) => setText(e.target.value)} maxLength={300} placeholder="Ask about the data, or say what to show" autoComplete="off" />
              <button type="submit" className="ask-send" disabled={busy || !text.trim()} aria-label="Send"><Send size={16} aria-hidden="true" /></button>
              <span className="ask-count" aria-hidden="true">{text.length}/300</span>
            </form>
            {note ? <p className="ask-note" role="alert">{note}</p> : null}
          </>
        )}
      </section>
    </div>
  );
}
