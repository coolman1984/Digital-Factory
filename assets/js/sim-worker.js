/* Headless shift runs off the main thread (what-if). */
importScripts('rng.js', 'sim.js');
self.onmessage = function (e) {
  const { id, opt } = e.data;
  try {
    const result = Sim.runShiftSimulation(opt);
    self.postMessage({ id, result });
  } catch (err) {
    self.postMessage({ id, error: String(err && err.message ? err.message : err) });
  }
};
