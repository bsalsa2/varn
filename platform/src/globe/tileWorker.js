// Main-thread side of the elevation worker: one shared worker, promise-based.
let worker = null, seq = 0;
const pending = new Map();

function start() {
  if (worker) return worker;
  worker = new Worker(new URL('./terrainWorker.js', import.meta.url), { type: 'module' });
  worker.onmessage = ({ data }) => {
    const p = pending.get(data.id); if (!p) return;
    pending.delete(data.id);
    data.error ? p.reject(new Error(data.error)) : p.resolve(data);
  };
  worker.onerror = (e) => { for (const p of pending.values()) p.reject(new Error(e.message || 'worker failed')); pending.clear(); };
  return worker;
}

export const inFlight = () => pending.size;
export function ask(message) {
  return new Promise((resolve, reject) => { const id = ++seq; pending.set(id, { resolve, reject }); start().postMessage({ ...message, id }); });
}
