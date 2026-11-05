import React from 'react';
import { href, isTestSet, groupByTestSet, latestExperiment } from './model.js';
import { SrcChip, Num, Count, RecLink, Caveats, Block, Empty, Quote, ResultGroup } from './parts.jsx';

const KIND = { model: 'Model', experiment: 'Experiment', dataset: 'Dataset', test_set: 'Test set', test_set_slice: 'Test set · clip group', evaluation: 'Result', gap: 'Known gap', note: 'Note' };
const kindOf = (r) => r.collection === 'datasets' ? KIND[r.kind] : KIND[{ models: 'model', experiments: 'experiment', evaluations: 'evaluation', gaps: 'gap', notes: 'note' }[r.collection]];
const attr = (r, label) => (r.attributes || []).find((a) => a.label === label)?.value;

function RecList({ ids, idx, empty }) {
  const items = ids.map((id) => idx.get(id)).filter(Boolean);
  if (!items.length) return <p className="none">{empty}</p>;
  return <ul className="rel">{items.map((r) => <li key={r.id}><RecLink id={r.id} /><span>{r.title}</span></li>)}</ul>;
}

/* ------------------------------------------------------------------ Overview */
export function Overview({ idx }) {
  const c = idx.counts;
  const latest = latestExperiment(idx);
  const latestEvals = latest ? (idx.evalsByExperiment.get(latest.id) || []).filter((e) => e.metric_name === 'mAP50' && !e.class) : [];
  const clipRun = idx.get('X-clips-compare');
  const latestModel = latest ? latest.model_ids[0] : null;
  const latestClips = clipRun ? (idx.evalsByExperiment.get(clipRun.id) || []).filter((e) => e.model_id === 'M-v3' || e.model_id === latestModel) : [];
  const svan1195 = idx.get('T-svan-1195'), svan897 = idx.get('T-svan-897');
  const svanNote = svan1195 && svan897;
  const notes = ['N-scope', 'N-not-run', 'N-hand-copied'].map((id) => idx.get(id)).filter(Boolean);

  return (
    <>
      <h1>Records</h1>
      <p className="lead">Every model, experiment, dataset and result is a record, and every record points to the line of the evidence ledger it was copied from. If the ledger is silent, the page says so.</p>
      <ul className="scope" aria-label="Scope and honesty notes">
        {notes.map((n) => <li key={n.id}>{n.text} <SrcChip src={n.source} line={n.source_line} /></li>)}
      </ul>

      <Block title="What exists">
        <table className="plain">
          <caption className="sr-only">Record counts</caption>
          <tbody>
            <tr><th scope="row">Models</th><td><Count to={href.research()}>{c.models}</Count></td><td>baseline v3 and the fine-tunes derived from it</td></tr>
            <tr><th scope="row">Experiments</th><td><Count to={href.research()}>{c.experiments}</Count></td><td>runs and checks, each with the model, data and test sets it used</td></tr>
            <tr><th scope="row">Datasets</th><td><Count to={href.research()}>{c.datasets}</Count></td><td>training and evaluation data, with licences as recorded</td></tr>
            <tr><th scope="row">Test sets</th><td><Count to={href.results()}>{c.testSets}</Count></td><td>plus <Count to={href.results()}>{c.testSetSlices}</Count> clip groups, each its own test set</td></tr>
            <tr><th scope="row">Results</th><td><Count to={href.results()}>{c.results}</Count></td><td>across <Count to={href.results()}>{c.testSetsWithResults}</Count> test sets; never ranked across them</td></tr>
          </tbody>
        </table>
        <p className="fine">Counted from the records themselves.</p>
      </Block>

      <Block title="Needs attention">
        <ul className="gaps">
          {idx.data.gaps.map((g) => (
            <li key={g.id} data-kind={g.kind}>
              <p><span className={`tag tag-${g.kind}`}>{g.kind === 'unverified' ? 'Not verified' : 'Open'}</span> <strong>{g.title}</strong></p>
              <p>{g.summary} <SrcChip src={g.source} line={g.source_line} /></p>
              {g.links.length ? <p className="fine">Related: {g.links.map((id, i) => <React.Fragment key={id}>{i ? ', ' : ''}<RecLink id={id} /></React.Fragment>)}</p> : null}
            </li>
          ))}
        </ul>
      </Block>

      <Block title="Most recent results">
        <p className="fine">The ledger has no date for individual results, only the month (see the note above). Recency here means the highest run number, not a timestamp.</p>
        {latest ? (
          <>
            <p><RecLink id={latest.id} /> {latest.title}. Verdict recorded in the ledger: <strong>{latest.verdict}</strong> <SrcChip src={latest.source} line={latest.source_line} /></p>
            {groupByTestSet(latestEvals, idx).map((g) => <ResultGroup key={g.testSet.id} group={g} idx={idx} level={3} hideMissing />)}
            {latestClips.length ? (
              <>
                <p className="fine">Real-clip check for the same run, from the one comparison the ledger holds for it:</p>
                {groupByTestSet(latestClips, idx).map((g) => <ResultGroup key={g.testSet.id} group={g} idx={idx} level={3} hideMissing />)}
              </>
            ) : null}
          </>
        ) : <Empty title="No results in the ledger yet." />}
      </Block>

      <Block title="Read before comparing">
        <p>Results are comparable only when they share a test set.{svanNote ? <> Two Svanstrom held-out sets are different test sets: <RecLink id="T-svan-1195" /> has <Num src={svan1195.source} line={svan1195.source_line}>1,195</Num> frames from run 4, and <RecLink id="T-svan-897" /> has <Num src={svan897.source} line={svan897.source_line}>897</Num> frames from run 5. A score on one says nothing about a score on the other.</> : null}</p>
        <p><a href={href.results()}>Open Results, grouped by test set</a></p>
      </Block>
    </>
  );
}

/* ------------------------------------------------------------------ Results */
export function Results({ idx, testSetId }) {
  const all = groupByTestSet(idx.data.evaluations, idx);
  const metric = idx.get('N-metric');
  const gaps = ['G-real-sky', 'G-empty-sky', 'G-small-test'].map((id) => idx.get(id)).filter(Boolean);

  if (testSetId) {
    const g = all.find((x) => x.testSet.id === testSetId);
    const ts = idx.get(testSetId);
    return (
      <>
        <p className="back"><a href={href.results()}>← All test sets</a></p>
        <h1>Results on {testSetId}</h1>
        {g ? <ResultGroup group={g} idx={idx} /> : (
          <Empty title={ts && isTestSet(ts) ? `No results in the ledger for ${testSetId}.` : `No test set called ${testSetId}.`}>
            {ts && isTestSet(ts) ? 'The test set is defined, but no model has a recorded score on it.' : 'Check the id, or go back to the list of test sets.'}
          </Empty>
        )}
      </>
    );
  }

  return (
    <>
      <h1>Results</h1>
      <p className="lead">One group per test set. Inside a group, rows follow the ledger's order and are not ranked. Numbers from different test sets are never put in one list, because they are not comparable.</p>
      <nav aria-label="Test sets" className="toc">
        <ul>{all.map((g) => <li key={g.testSet.id}><a href={href.results(g.testSet.id)}>{g.testSet.id}</a><span className="dim"> · <Count to={href.results(g.testSet.id)}>{idx.evalsByTestSet.get(g.testSet.id).length}</Count> results</span></li>)}</ul>
      </nav>
      {all.map((g) => <ResultGroup key={g.testSet.id} group={g} idx={idx} />)}

      {all.length === 0 ? <Empty title="No results in the ledger yet.">Results appear here, grouped by test set, as soon as the ledger holds them.</Empty> : null}
      <Block title="Not measured">
        <p>The ledger holds no result for these, so none is shown.</p>
        {gaps.length ? (
          <ul className="gaps">
            {gaps.map((g) => <li key={g.id}><p><strong>{g.title}</strong></p><p>{g.summary} <SrcChip src={g.source} line={g.source_line} /></p></li>)}
          </ul>
        ) : null}
      </Block>
      {metric ? <p className="fine">Metric: {metric.text} <SrcChip src={metric.source} line={metric.source_line} /></p> : null}
    </>
  );
}

/* ------------------------------------------------------------------ Research (list) */
function Rows({ items, meta }) {
  return (
    <ul className="rows">
      {items.map((r) => (
        <li key={r.id}>
          <RecLink id={r.id} />
          <span className="t">{r.title}</span>
          <span className="m">{meta(r)}</span>
          <SrcChip src={r.source} line={r.source_line} />
        </li>
      ))}
    </ul>
  );
}

export function Research({ idx }) {
  const d = idx.data;
  return (
    <>
      <h1>Research</h1>
      <p className="lead">Plain lists of what exists. Open a row to see its summary, caveats, source and the records it links to.</p>
      <Block title="Models"><Rows items={d.models} meta={(r) => attr(r, 'Status')} /></Block>
      <Block title="Experiments"><Rows items={d.experiments} meta={(r) => (r.verdict ? `Verdict: ${r.verdict}` : 'No verdict in the ledger')} /></Block>
      <Block title="Datasets"><Rows items={d.datasets.filter((x) => x.kind === 'dataset')} meta={(r) => `License: ${attr(r, 'License') || 'not recorded'}`} /></Block>
      <Block title="Test sets"><Rows items={d.datasets.filter(isTestSet)} meta={(r) => { const n = (idx.evalsByTestSet.get(r.id) || []).length; return n ? <><Count to={href.results(r.id)}>{n}</Count> results</> : 'no results in the ledger'; }} /></Block>
    </>
  );
}

/* ------------------------------------------------------------------ Research (detail) */
export function Detail({ id, idx }) {
  const r = idx.get(id);
  if (!r) {
    return (
      <>
        <p className="back"><a href={href.research()}>← Research</a></p>
        <h1>No record called {id}</h1>
        <Empty title="Nothing to show.">No record with this id exists. Ids come from the ledger (M-, D-, T-) or are assigned in records.json (X-, R-, G-).</Empty>
      </>
    );
  }
  const col = r.collection;
  const hasSource = r.source && r.source_line;
  const evalsFor = (list) => groupByTestSet(list, idx);

  return (
    <>
      <p className="back"><a href={href.research()}>← Research</a></p>
      <p className="kind">{kindOf(r)} · <span className="mono">{r.id}</span></p>
      <h1>{r.title}</h1>
      <p className="lead">{r.summary || r.text}</p>

      {col === 'evaluations' ? (
        <Block title="This result" src={r.source} line={r.source_line}>
          <dl className="facts">
            <div><dt>Value</dt><dd><Num src={r.source} line={r.source_line}>{r.value}</Num>{r.unit ? <span className="dim"> · {r.unit}</span> : null}</dd></div>
            <div><dt>Metric</dt><dd>{r.metric_name}{r.class ? ` · ${r.class}` : ''}</dd></div>
            <div><dt>Model</dt><dd><RecLink id={r.model_id} text={idx.label(r.model_id, r.variant)} /></dd></div>
            <div><dt>Test set</dt><dd><RecLink id={r.test_set_id} /> · <a href={href.results(r.test_set_id)}>all results on it</a></dd></div>
            {r.condition ? <div><dt>Condition</dt><dd>{r.condition}</dd></div> : null}
            <div><dt>Experiment</dt><dd><RecLink id={r.experiment_id} /></dd></div>
            {(r.compared_with || []).map((id) => idx.get(id)).filter(Boolean).map((o) => (
              <div key={o.id}><dt>Beside, same test set</dt><dd><RecLink id={o.id} text={idx.label(o.model_id, o.variant)} /> <Num src={o.source} line={o.source_line}>{o.value}</Num></dd></div>
            ))}
          </dl>
        </Block>
      ) : null}

      {r.attributes && r.attributes.length ? (
        <Block title="Facts" src={r.source} line={r.source_line}>
          <dl className="facts">{r.attributes.map((a) => <div key={a.label}><dt>{a.label}</dt><dd>{a.value}</dd></div>)}</dl>
        </Block>
      ) : null}

      {col === 'experiments' ? (
        <Block title="Verdict" src={r.source} line={r.source_line}>
          {r.verdict ? <p>{r.verdict}</p> : <p className="none">No verdict is recorded in the ledger for this experiment.</p>}
        </Block>
      ) : null}

      {r.caveats ? (r.caveats.length ? <Block title="Caveats"><Caveats items={r.caveats} title={null} /></Block> : null) : null}

      {hasSource ? (
        <Block title="Source" src={r.source} line={r.source_line}>
          <Quote idx={idx} src={r.source} line={r.source_line} />
          {r.also_from && r.also_from.length ? <p className="fine">Some caveats also draw on: {r.also_from.map((s, i) => <React.Fragment key={s}>{i ? ', ' : ''}<a href={href.source(s)}>{s}</a></React.Fragment>)}.</p> : null}
        </Block>
      ) : null}

      {col === 'models' ? (
        <>
          <Block title="Built from"><RecList ids={r.derived_from ? [r.derived_from] : []} idx={idx} empty="Not derived from another model in the ledger." /></Block>
          <Block title="Trained on"><RecList ids={r.trained_on || []} idx={idx} empty="The ledger does not list training data for this model." /></Block>
          <Block title="Experiments"><RecList ids={(idx.experimentsByModel.get(r.id) || []).map((x) => x.id)} idx={idx} empty="No experiment in the ledger names this model." /></Block>
          <ResultsFor list={idx.evalsByModel.get(r.id) || []} idx={idx} evalsFor={evalsFor} what="this model" />
        </>
      ) : null}

      {col === 'experiments' ? (
        <>
          <Block title="Models"><RecList ids={r.model_ids} idx={idx} empty="None." /></Block>
          <Block title="Training data"><RecList ids={r.dataset_ids} idx={idx} empty="This experiment scores existing weights; the ledger lists no training data for it." /></Block>
          <Block title="Test sets"><RecList ids={r.test_set_ids} idx={idx} empty="None." /></Block>
          <ResultsFor list={idx.evalsByExperiment.get(r.id) || []} idx={idx} evalsFor={evalsFor} what="this experiment" />
        </>
      ) : null}

      {col === 'datasets' && r.kind === 'dataset' ? (
        <>
          <Block title="Models trained on it"><RecList ids={(idx.modelsByDataset.get(r.id) || []).map((m) => m.id)} idx={idx} empty="No model in the ledger was trained on this dataset." /></Block>
          <Block title="Experiments that used it"><RecList ids={(idx.experimentsByDataset.get(r.id) || []).map((x) => x.id)} idx={idx} empty="No experiment in the ledger used this dataset for training." /></Block>
          <Block title="Test sets drawn from it"><RecList ids={(idx.childrenOf.get(r.id) || []).map((x) => x.id)} idx={idx} empty="No test set in the ledger is drawn from this dataset." /></Block>
        </>
      ) : null}

      {col === 'datasets' && isTestSet(r) ? (
        <>
          {r.derived_from ? <Block title="Drawn from"><RecList ids={[r.derived_from]} idx={idx} empty="" /></Block> : null}
          {(idx.childrenOf.get(r.id) || []).length ? <Block title="Groups inside it"><RecList ids={idx.childrenOf.get(r.id).map((x) => x.id)} idx={idx} empty="" /></Block> : null}
          <Block title="Experiments scored on it"><RecList ids={(idx.experimentsByTestSet.get(r.id) || []).map((x) => x.id)} idx={idx} empty="No experiment in the ledger names this test set." /></Block>
          <ResultsFor list={idx.evalsByTestSet.get(r.id) || []} idx={idx} evalsFor={evalsFor} what="this test set" full />
        </>
      ) : null}

      {col === 'gaps' ? (
        <Block title="Related records"><RecList ids={r.links} idx={idx} empty="The ledger links this to no other record." /></Block>
      ) : null}
    </>
  );
}

function ResultsFor({ list, idx, evalsFor, what, full = false }) {
  if (!list.length) return <Block title="Results"><Empty title="No results in the ledger.">{`The ledger holds no recorded score for ${what}.`}</Empty></Block>;
  return (
    <section className="results-for" aria-label="Results">
      <h2 className="sec">Results <span className="dim">· grouped by test set, never mixed</span></h2>
      {evalsFor(list).map((g) => <ResultGroup key={g.testSet.id} group={g} idx={idx} level={3} hideMissing={!full} />)}
    </section>
  );
}

/* ------------------------------------------------------------------ Source (ledger viewer) */
export function Source({ idx, section, line }) {
  const sec = idx.ledger.byId[section];
  if (!sec) {
    return (
      <>
        <p className="back"><a href={href.overview()}>← Records</a></p>
        <h1>No ledger section {section}</h1>
        <Empty title="Nothing to show.">The ledger has sections {idx.ledger.sections.map((s) => s.id).join(', ')}.</Empty>
      </>
    );
  }
  const cited = idx.citing(section, line);
  const inRange = line == null || (line >= sec.first && line <= sec.last);
  const groups = [['models', 'Models'], ['experiments', 'Experiments'], ['datasets', 'Datasets and test sets'], ['evaluations', 'Results'], ['gaps', 'Known gaps'], ['notes', 'Notes']];
  return (
    <>
      <p className="back"><a href={href.overview()}>← Records</a></p>
      <h1>Ledger {sec.id}</h1>
      <p className="lead">{sec.title}</p>
      <p className="fine">platform/evidence/ledger.md, lines {sec.first} to {sec.last}. Copied by hand from Kaggle reports, run logs and a threshold-check notebook; the originals live outside this repository.</p>
      {!inRange ? <Empty title={`Line ${line} is not in ${sec.id}.`}>Showing the whole section instead.</Empty> : null}
      <ol className="ledger" aria-label={`Ledger section ${sec.id}`}>
        {sec.lines.filter((l) => l.text.trim() !== '').map((l) => (
          <li key={l.n} id={`L${l.n}`} aria-current={inRange && l.n === line ? 'location' : undefined} className={inRange && l.n === line ? 'hit' : undefined}>
            <span className="ln">L{l.n}</span><span className="tx">{l.text}</span>
          </li>
        ))}
      </ol>
      <Block title={line && inRange ? `Records that cite line ${line}` : `Records that cite ${sec.id}`}>
        {cited.length === 0 ? <p className="none">No record cites this {line ? 'line' : 'section'}.</p> : (
          <>
            {groups.map(([key, title]) => {
              const items = cited.filter((r) => r.collection === key);
              if (!items.length) return null;
              const many = items.length > 12;
              return (
                <div key={key}>
                  <p className="cav-t">{title} <span className="rec-num" data-src={sec.id} data-line={line && inRange ? line : sec.first}><b className="v">{items.length}</b></span></p>
                  <ul className="chips">{(many ? items.slice(0, 12) : items).map((r) => <li key={r.id}><RecLink id={r.id} /></li>)}{many ? <li className="dim">and <span className="rec-num" data-src={sec.id} data-line={line && inRange ? line : sec.first}><b className="v">{items.length - 12}</b></span> more, all citing this {line && inRange ? 'line' : 'section'}</li> : null}</ul>
                </div>
              );
            })}
          </>
        )}
      </Block>
    </>
  );
}
