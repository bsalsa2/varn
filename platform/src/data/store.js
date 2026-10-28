// Records the founder enters: tasks, budget lines, suppliers, hiring plans, document links.
// They live in this browser's localStorage only. The site is public, so nothing here is sent
// anywhere; Export / Import moves the data between browsers.
import { useCallback, useEffect, useState } from 'react';

const KEY = 'varn.cc.records.v1';
export const COLLECTIONS = ['tasks', 'budget', 'suppliers', 'hires', 'links'];
const empty = () => Object.fromEntries(COLLECTIONS.map((c) => [c, []]));

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (!raw || typeof raw !== 'object') return empty();
    return { ...empty(), ...Object.fromEntries(COLLECTIONS.map((c) => [c, Array.isArray(raw[c]) ? raw[c] : []])) };
  } catch { return empty(); }
}

export const newId = () => Math.random().toString(36).slice(2, 10);
export const today = () => new Date().toISOString().slice(0, 10);

export function useRecords() {
  const [db, setDb] = useState(load);
  const [saved, setSaved] = useState(true);
  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(db)); setSaved(true); } catch { setSaved(false); }
  }, [db]);
  useEffect(() => {   // keep two open tabs in step
    const on = (e) => { if (e.key === KEY) setDb(load()); };
    addEventListener('storage', on); return () => removeEventListener('storage', on);
  }, []);
  const add = useCallback((c, rec) => setDb((d) => ({ ...d, [c]: [...d[c], { id: newId(), created: today(), ...rec }] })), []);
  const addMany = useCallback((c, recs) => setDb((d) => ({ ...d, [c]: [...d[c], ...recs.map((r) => ({ id: newId(), created: today(), ...r }))] })), []);
  const update = useCallback((c, id, patch) => setDb((d) => ({ ...d, [c]: d[c].map((r) => (r.id === id ? { ...r, ...patch } : r)) })), []);
  const remove = useCallback((c, id) => setDb((d) => ({ ...d, [c]: d[c].filter((r) => r.id !== id) })), []);
  const replace = useCallback((next) => setDb({ ...empty(), ...Object.fromEntries(COLLECTIONS.map((c) => [c, Array.isArray(next?.[c]) ? next[c] : []])) }), []);
  return { db, saved, add, addMany, update, remove, replace };
}

export function exportRecords(db) {
  const blob = new Blob([JSON.stringify({ format: 'varn-command-center', version: 1, exported: new Date().toISOString(), ...db }, null, 2)], { type: 'application/json' });
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `varn-records-${today()}.json` });
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export function importRecords(file) {
  return file.text().then((t) => {
    const j = JSON.parse(t);
    if (j?.format !== 'varn-command-center') throw new Error('Not a VARN Command Center export');
    return j;
  });
}

/** Days from today to an ISO date (negative = past). */
export function daysUntil(iso) {
  if (!iso) return null;
  const d = Date.parse(`${iso}T00:00:00`), t = Date.parse(`${today()}T00:00:00`);
  return Math.round((d - t) / 86400000);
}
