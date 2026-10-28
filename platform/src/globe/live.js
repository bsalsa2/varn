// Fast-changing values (altitude, cursor, tile queue) live outside React state. The globe writes
// them freely; subscribed components are told at most ~8 times a second, so zooming and tile
// loading never trigger a storm of full-UI re-renders.
export function createLive(initial) {
  let value = { ...initial };
  const subs = new Set();
  let timer = 0, dirty = false;
  const flush = () => { timer = 0; if (!dirty) return; dirty = false; value = { ...value }; subs.forEach((f) => f()); };
  return {
    get: () => value,
    set(patch) {
      let changed = false;
      for (const k in patch) if (value[k] !== patch[k]) { value[k] = patch[k]; changed = true; }
      if (!changed) return;
      dirty = true;
      if (!timer) timer = setTimeout(flush, 120);
    },
    subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
  };
}
