import React, { useEffect, useRef } from 'react';
import './records.css';
import records from '../data/records.json';
import ledgerText from './ledgerText.js';
import { parseLedger } from './ledger.js';
import { buildIndex, parseRoute, href } from './model.js';
import { Overview, Results, Research, Detail, Source } from './pages.jsx';
import { SrcChip } from './parts.jsx';

// Built once: the records and the ledger never change while the page is open.
const ledger = parseLedger(ledgerText);
const idx = { ...buildIndex(records), ledger };

const NAV = [['overview', 'Overview', href.overview()], ['results', 'Results', href.results()], ['research', 'Research', href.research()]];
const ACTIVE = { overview: 'overview', results: 'results', research: 'research', record: 'research', source: 'overview', notfound: 'overview' };

const TITLES = { overview: 'Overview', results: 'Results', research: 'Research', record: 'Record', source: 'Ledger', notfound: 'Not found' };

export function RecordsView({ route, index = idx }) {
  switch (route.page) {
    case 'overview': return <Overview idx={index} />;
    case 'results': return <Results idx={index} testSetId={route.testSetId} />;
    case 'research': return <Research idx={index} />;
    case 'record': return <Detail idx={index} id={route.id} />;
    case 'source': return <Source idx={index} section={route.section} line={route.line} />;
    default:
      return <><h1>Page not found</h1><p className="lead">This Records address does not exist. <a href={href.overview()}>Go to the overview</a>.</p></>;
  }
}

export default function RecordsApp({ hash = '' }) {
  const route = parseRoute(hash);
  const main = useRef(null);
  const first = useRef(true);
  const root = useRef(null);

  useEffect(() => {
    const prev = document.title;
    document.title = `${TITLES[route.page] || 'Records'} · Records · VARN`;
    return () => { document.title = prev; };
  }, [route.page]);

  // New page: back to the top, and move keyboard focus to the content so screen readers announce it.
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (root.current) root.current.scrollTop = 0;
    if (main.current) main.current.focus({ preventScroll: true });
  }, [hash]);

  const active = ACTIVE[route.page];
  const hand = idx.get('N-hand-copied'), scope = idx.get('N-scope');
  return (
    <div className="rec" ref={root} data-page={route.page}>
      <button className="skip" type="button" onClick={() => main.current && main.current.focus()}>Skip to content</button>
      <header className="rec-head">
        <a className="rec-mark" href="#" aria-label="VARN, back to the Earth view">
          <svg viewBox="0 0 42 42" aria-hidden="true"><path d="M7 31 17.2 9h7.5L35 31h-8.1l-6-13.1L14.8 31Z" fill="currentColor" /><path d="M17.2 25.2h9.1l2.2 5.8H14.8Z" fill="#0B0F14" /></svg>
          <span>VARN</span>
        </a>
        <span className="rec-name">Records</span>
        <nav aria-label="Records sections" className="rec-nav">
          {NAV.map(([key, label, to]) => <a key={key} href={to} aria-current={active === key ? 'page' : undefined}>{label}</a>)}
        </nav>
        <nav aria-label="Other views" className="rec-nav rec-other">
          <a href="#">Earth</a>
          <a href="#sky">Sky</a>
        </nav>
      </header>
      <main id="records-main" ref={main} tabIndex={-1}>
        <RecordsView route={route} />
      </main>
      <footer className="rec-foot">
        {[hand, scope].filter(Boolean).map((n) => <p key={n.id}>{n.text} <SrcChip src={n.source} line={n.source_line} /></p>)}
      </footer>
    </div>
  );
}
