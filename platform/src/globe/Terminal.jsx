import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { execute, complete, PROMPT } from './commands.js';

const MAX_LINES = 700;
const store = {
  read(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } },
  write(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* private mode: keep going without it */ } },
};

/** UTC clock in its own component so a ticking second never re-renders the terminal. */
function Clock() {
  const [t, setT] = useState(() => new Date());
  useEffect(() => { const id = setInterval(() => setT(new Date()), 1000); return () => clearInterval(id); }, []);
  return <time dateTime={t.toISOString()}>{t.toISOString().slice(0, 10)} {t.toISOString().slice(11, 19)}Z</time>;
}

export default function Terminal({ ctx, open, onClose }) {
  const [lines, setLines] = useState([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const inputRef = useRef(null), bodyRef = useRef(null);
  const memRef = useRef(null);
  const hist = useRef({ items: store.read('varn.term.history', []), at: -1, draft: '' });
  const stick = useRef(true);

  if (!memRef.current) memRef.current = { list: null, marks: store.read('varn.term.marks', {}), history: hist.current.items, watch: null };

  const push = useCallback((t, c = '') => setLines((l) => { const n = [...l, { t, c }]; return n.length > MAX_LINES ? n.slice(-MAX_LINES) : n; }), []);
  const io = useMemo(() => ({ print: push, clear: () => setLines([]) }), [push]);
  const full = useMemo(() => ({
    ...ctx, mem: memRef.current, now: Date.now, emit: push,
    saveMarks: (m) => store.write('varn.term.marks', m),
  }), [ctx, push]);

  // The banner is printed once, the first time the terminal opens in this page.
  const booted = useRef(false);
  useEffect(() => {
    if (!open || booted.current) return;
    booted.current = true;
    const id = Math.random().toString(16).slice(2, 6).toUpperCase();
    [['VARN OPEN-SOURCE INTELLIGENCE TERMINAL', 'head'], ['UNCLASSIFIED // PUBLIC DATA ONLY', 'ok'], [`session ${id} · all data is public and shown with its own timestamps`, 'dim'], ['', ''],
      ['brief      situation summary from live feeds', ''], ['quakes     earthquakes (USGS)        fires    wildfires (NASA)', ''], ['fly <place> go to a location            help     all commands', '']].forEach(([t, c]) => push(t, c));
    push('');
  }, [open, push]);

  useEffect(() => { if (open) inputRef.current?.focus(); }, [open]);
  useEffect(() => { const b = bodyRef.current; if (b && stick.current) b.scrollTop = b.scrollHeight; }, [lines, busy]);
  useEffect(() => () => { memRef.current?.watch?.stop(); }, []);

  const onScroll = () => { const b = bodyRef.current; stick.current = b.scrollHeight - b.scrollTop - b.clientHeight < 40; };

  const submit = async () => {
    const line = input.trim();
    if (busy) { push('still working on the previous command …', 'dim'); return; }
    setInput(''); hist.current.at = -1;
    if (!line) return;
    push(`${PROMPT} ${line}`, 'cmd');
    if (hist.current.items[hist.current.items.length - 1] !== line) hist.current.items.push(line);
    hist.current.items.splice(0, Math.max(0, hist.current.items.length - 200));
    store.write('varn.term.history', hist.current.items);
    stick.current = true;
    setBusy(true);
    try { await execute(line, full, io); } finally { setBusy(false); inputRef.current?.focus(); }
  };

  const onKey = (e) => {
    const h = hist.current;
    if (e.key === 'Enter') { e.preventDefault(); submit(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); if (h.at === -1) h.draft = input; h.at = Math.min(h.items.length - 1, h.at + 1); setInput(h.items[h.items.length - 1 - h.at] ?? ''); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); h.at = Math.max(-1, h.at - 1); setInput(h.at === -1 ? h.draft : h.items[h.items.length - 1 - h.at]); }
    else if (e.key === 'Tab') {
      e.preventDefault();
      const { options, replace } = complete(input);
      if (options.length === 1) setInput(`${replace(options[0])} `);
      else if (options.length > 1) { push(`${PROMPT} ${input}`, 'cmd'); push(options.join('   '), 'dim'); const common = options.reduce((a, b) => { let i = 0; while (i < a.length && a[i] === b[i]) i++; return a.slice(0, i); }); if (common) setInput(replace(common)); }
    }
    else if (e.key === 'l' && e.ctrlKey) { e.preventDefault(); setLines([]); }
    else if (e.key === 'c' && e.ctrlKey && busy) { push('^C (the request keeps running in the background)', 'dim'); }
    else if (e.key === '`' || e.key === 'Escape') { e.preventDefault(); if (e.key === '`') onClose(); else inputRef.current?.blur(); }
  };

  return <section className={`e-term ${open ? 'open' : ''}`} aria-label="Command terminal" aria-hidden={!open} onClick={(e) => { if (window.getSelection()?.toString() === '') inputRef.current?.focus(); e.stopPropagation(); }}>
    <header className="t-head">
      <div className="t-class"><i/>UNCLASSIFIED // PUBLIC DATA ONLY<span><Clock/></span></div>
      <div className="t-title"><strong>VARN</strong> OPEN-SOURCE INTELLIGENCE TERMINAL
        <button className="e-x" onClick={onClose} aria-label="Close terminal" tabIndex={open ? 0 : -1}><X size={14}/></button></div>
    </header>
    <div className="t-body" ref={bodyRef} onScroll={onScroll} role="log" aria-live="polite">
      {lines.map((l, i) => <div key={i} className={`t-line ${l.c}`}>{l.t || ' '}</div>)}
      {busy && <div className="t-line dim t-busy">working<span>…</span></div>}
    </div>
    <label className="t-input">
      <span className="t-prompt">{PROMPT}</span>
      <input ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={onKey} spellCheck={false} autoComplete="off" autoCapitalize="off" autoCorrect="off"
        aria-label="Command" placeholder={lines.length < 12 ? 'type a command: help' : ''} tabIndex={open ? 0 : -1}/>
    </label>
  </section>;
}
