import React, { Suspense, lazy, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';

// The Command Center is the Earth. Sky (the detector's all-sky view) stays at #sky; Records lives at #records.
const EarthViewer = lazy(() => import('./globe/EarthViewer.jsx'));
const Sky = lazy(() => import('./sky/Sky.jsx'));
// Records: every model, experiment, dataset and result as a record that cites its evidence (#records).
const Records = lazy(() => import('./records/RecordsApp.jsx'));

const Blank = () => <div style={{ position: 'fixed', inset: 0, background: '#05070a' }}/>;

function Root() {
  const [hash, setHash] = useState(location.hash);
  useEffect(() => { const on = () => setHash(location.hash); addEventListener('hashchange', on); return () => removeEventListener('hashchange', on); }, []);
  return <Suspense fallback={<Blank/>}>{hash === '#sky' ? <Sky/> : hash === '#records' || hash.startsWith('#records/') ? <Records hash={hash}/> : <EarthViewer/>}</Suspense>;
}

createRoot(document.getElementById('root')).render(<Root/>);
