/* Digital Factory — background worker that plays what-if futures on copies of the Plant EG-01 twin. */
/* global importScripts, PlantEngine, WhatIf */
importScripts('engine.js', 'whatif.js');
self.onmessage = e => {
  const { id, snap, req, parts } = e.data;
  try {
    const t0 = Date.now();
    const results = WhatIf.runParts(PlantEngine, snap, req, parts);
    self.postMessage({ id, results, ms: Date.now() - t0 });
  } catch (err) {
    self.postMessage({ id, error: String(err && err.stack || err) });
  }
};
