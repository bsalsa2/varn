import React, { Suspense, lazy, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';

// The Command Center is the Earth. Sky (the detector's all-sky view) stays at #sky.
const EarthViewer = lazy(() => import('./globe/EarthViewer.jsx'));
const Sky = lazy(() => import('./sky/Sky.jsx'));

const Blank = () => <div style={{ position: 'fixed', inset: 0, background: '#05070a' }}/>;

function Root() {
  const [hash, setHash] = useState(location.hash);
  useEffect(() => { const on = () => setHash(location.hash); addEventListener('hashchange', on); return () => removeEventListener('hashchange', on); }, []);
  return <Suspense fallback={<Blank/>}>{hash === '#sky' ? <Sky/> : <EarthViewer/>}</Suspense>;
}

createRoot(document.getElementById('root')).render(<Root/>);
