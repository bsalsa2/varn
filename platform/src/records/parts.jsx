import React from 'react';
import { href, groupByTestSet, modelsWithoutResults } from './model.js';

// A pointer to the exact ledger line. Every number on a Records page sits next to one of these
// (or is itself a link to the list it was counted from).
export function SrcChip({ src, line }) {
  return (
    <a className="src" href={href.source(src, line)} data-src={src} data-line={line} aria-label={`Source: ledger section ${src}, line ${line}`}>
      {src}<span aria-hidden="true"> · </span>L{line}
    </a>
  );
}

export function Num({ src, line, children }) {
  return <span className="rec-num" data-src={src} data-line={line}><b className="v">{children}</b><SrcChip src={src} line={line} /></span>;
}

// A count derived from records.json. It links to the list it counts, so it is never an orphan.
export function Count({ to, children }) {
  return <a className="rec-num rec-count" data-src="records.json" href={to} title="Counted from records.json">{children}</a>;
}

export const RecLink = ({ id, text }) => <a className="rid" href={href.record(id)}>{text || id}</a>;

export function Caveats({ items, title = 'Caveats' }) {
  if (!items || !items.length) return null;
  return (
    <div className="cav">
      {title ? <p className="cav-t">{title}</p> : null}
      <ul>{items.map((c, i) => <li key={i}>{c}</li>)}</ul>
    </div>
  );
}

export function Block({ title, src, line, children, id }) {
  const hid = id || `b-${String(title).toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  return (
    <section className="block" aria-labelledby={hid}>
      <header><h2 id={hid}>{title}</h2>{src ? <SrcChip src={src} line={line} /> : null}</header>
      {children}
    </section>
  );
}

export const Empty = ({ title, children }) => <div className="empty" role="note"><p className="empty-t">{title}</p>{children ? <p>{children}</p> : null}</div>;

export function Quote({ idx, src, line }) {
  const l = idx.ledger.line(line);
  return (
    <figure className="quote">
      <blockquote><span className="ln">L{line}</span>{l ? l.text.replace(/^\* /, '') : ''}</blockquote>
      <figcaption>Copied by hand into the ledger, section {src}. <a href={href.source(src, line)}>Open the ledger lines</a></figcaption>
    </figure>
  );
}

function Pair({ e, idx }) {
  const others = (e.compared_with || []).map((id) => idx.get(id)).filter(Boolean);
  if (!others.length) return null;
  return <p className="pair">Beside {others.map((o, i) => <React.Fragment key={o.id}>{i ? ', ' : ''}<RecLink id={o.id} text={`${idx.label(o.model_id, o.variant)} ${o.value}`} /></React.Fragment>)} in the ledger, same test set.</p>;
}

export function EvalTable({ rows, idx, caption }) {
  return (
    <table className="rtable">
      <caption className="sr-only">{caption}</caption>
      <thead><tr><th scope="col">Model</th><th scope="col">Metric</th><th scope="col">Value</th><th scope="col">Notes</th></tr></thead>
      <tbody>
        {rows.map((e) => (
          <tr key={e.id}>
            <td data-label="Model"><RecLink id={e.model_id} text={idx.label(e.model_id, e.variant)} /></td>
            <td data-label="Metric">
              <a className="metric" href={href.record(e.id)}>{e.metric_name}</a>
              {e.class ? <span className="dim"> · {e.class}</span> : null}
              {e.unit ? <span className="unit">{e.unit}</span> : null}
            </td>
            <td data-label="Value" className="val"><Num src={e.source} line={e.source_line}>{e.value}</Num></td>
            <td data-label="Notes">
              <ul className="notes">{e.caveats.map((c, i) => <li key={i}>{c}</li>)}</ul>
              <Pair e={e} idx={idx} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// One test set and every result the ledger holds for it. Nothing from another test set can appear here.
export function ResultGroup({ group, idx, hideMissing = false, level = 2 }) {
  const ts = group.testSet;
  const H = `h${level}`;
  const missing = modelsWithoutResults(ts.id, idx);
  return (
    <section className="rg" aria-labelledby={`rg-${ts.id}`}>
      <header className="rg-head">
        <H id={`rg-${ts.id}`}><RecLink id={ts.id} /> <span className="rg-title">{ts.title}</span></H>
        <SrcChip src={ts.source} line={ts.source_line} />
      </header>
      <p className="rg-sum">{ts.summary}</p>
      <Caveats items={ts.caveats} title="Limits of this test set" />
      {group.tables.map((t) => (
        <div className="rg-table" key={t.source}>
          <h3 className="rg-sec">{t.source} {idx.ledger.byId[t.source].title}</h3>
          {t.blocks.map((b) => (
            <div key={b.condition || 'none'}>
              {b.condition ? <p className="cond">Condition: {b.condition}</p> : null}
              <EvalTable rows={b.rows} idx={idx} caption={`Results on ${ts.id}${b.condition ? `, ${b.condition}` : ''}, in ledger order`} />
            </div>
          ))}
        </div>
      ))}
      {hideMissing ? null : (
        missing.length
          ? <p className="missing">No result in the ledger on this test set for: {missing.map((m, i) => <React.Fragment key={m.id}>{i ? ', ' : ''}<RecLink id={m.id} text={idx.label(m.id)} /></React.Fragment>)}.</p>
          : null
      )}
    </section>
  );
}

export const groupsFor = (evals, idx) => groupByTestSet(evals, idx);
