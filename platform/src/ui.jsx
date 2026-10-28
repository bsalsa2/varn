// Shared pieces of the Command Center's visual system.
import React from 'react';

export const cx = (...c) => c.filter(Boolean).join(' ');
export const utcTime = (d) => d ? d.toISOString().slice(11, 16) + ' UTC' : '—';
export const money = (n, cur = 'USD') => (n == null || Number.isNaN(n) ? '—' : new Intl.NumberFormat('en-US', { style: 'currency', currency: cur, maximumFractionDigits: 2 }).format(n));

export function Mark() {
  return <svg className="mark" viewBox="0 0 42 42" aria-hidden="true"><path d="M7 31 17.2 9h7.5L35 31h-8.1l-6-13.1L14.8 31Z" fill="currentColor"/><path d="M17.2 25.2h9.1l2.2 5.8H14.8Z" fill="var(--bg)"/></svg>;
}

export function Signal({ state }) { return <span className={`signal ${state}`} aria-hidden="true"/>; }

export function Sheet({ eyebrow, title, desc, children, aside, tabs }) {
  return <section className="sheet enter">
    <header className="sheet-head">
      <div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1>{desc && <p className="sheet-desc">{desc}</p>}</div>
      {aside}
    </header>
    {tabs}
    <div className="sheet-body">{children}</div>
  </section>;
}

export function Tabs({ items, value, onChange, label }) {
  return <div className="tabs" role="tablist" aria-label={label}>
    {items.map(([id, text, count]) => <button key={id} role="tab" aria-selected={value === id} className={cx('tab', value === id && 'on')} onClick={() => onChange(id)}>
      {text}{count != null && <span className="tab-count">{count}</span>}
    </button>)}
  </div>;
}

export function Panel({ title, meta, action, children, className, style }) {
  return <section className={cx('panel glass', className)} style={style}>
    {(title || action) && <header className="panel-head"><h2>{title}</h2>{meta && <span className="label">{meta}</span>}{action}</header>}
    {children}
  </section>;
}

export function Empty({ title, children, action }) {
  return <div className="empty"><strong>{title}</strong>{children && <p>{children}</p>}{action}</div>;
}

export function Bar({ value }) { return <span className="bar" aria-hidden="true"><i style={{ '--w': `${Math.max(0, Math.min(1, value)) * 100}%` }}/></span>; }

/** A one-line form: fields side by side, submit on Enter. */
export function QuickForm({ fields, submit = 'Add', onSubmit }) {
  return <form className="qform" onSubmit={(e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.currentTarget));
    if (!String(data[fields[0].name] || '').trim()) return;
    onSubmit(data); e.currentTarget.reset(); e.currentTarget.elements[0]?.focus({ preventScroll: true });
  }}>
    {fields.map((f) => f.options
      ? <label key={f.name} className={cx('field', f.wide && 'wide')}><span>{f.label}</span>
        <select name={f.name} defaultValue={f.value ?? f.options[0][0]}>{f.options.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select></label>
      : <label key={f.name} className={cx('field', f.wide && 'wide')}><span>{f.label}</span>
        <input name={f.name} type={f.type || 'text'} placeholder={f.placeholder} step={f.step} min={f.min} defaultValue={f.value} required={f.required}/></label>)}
    <button className="btn primary sm" type="submit">{submit}</button>
  </form>;
}
