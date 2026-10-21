/* Digital Factory — builds a sample shift for the presentation's time-window review, off the main thread.
   Runs the live-plant model (engine, enterprise layer, agents) from 09:12 to 14:30 plant time with the recorder on:
   a normal morning, then the drills in PlantRecorder.STORY; the plant manager approves each recommendation a few
   minutes after the agent raises it. Posts progress, then the recording. Simulated data. */
importScripts('engine.js', 'erp.js', 'agents.js', 'recorder.js');
self.onmessage = function (e) {
  const until = (e.data && e.data.until) || 14.5 * 3600;
  try {
    const E = PlantEngine.create(), X = PlantERP.create(E), A = PlantAgents.create(E, X);
    const rec = PlantRecorder.create(E, X, A, { source: 'sample' });
    const P = E.P, story = PlantRecorder.STORY.slice(), t0 = P.t, approveAfter = 4 * 60, stepS = 20;
    const firstDrill = story.length ? story[0].at : until;
    const seen = new Map(), approved = new Set();
    let lastPost = 0;
    while (P.t < until) {
      while (story.length && P.t >= story[0].at) E.trigger(story.shift().drill);
      E.fastForward(stepS);
      // the plant manager approves the agents' recommendations for the drills, a few minutes after they are first raised
      if (P.t >= firstDrill) for (const c of A.cards.values()) {
        if (!seen.has(c.key)) seen.set(c.key, P.t);
        if (approved.has(c.key) || c.autoDone || !c.best || !c.best.id || !/^(rul|shot|coat|sw|absent)/.test(c.key)) continue;
        if (P.t - seen.get(c.key) < approveAfter) continue;
        approved.add(c.key); E.apply(c.best.id, 'Plant manager');
      }
      if (P.t - lastPost > 600) { lastPost = P.t; self.postMessage({ progress: (P.t - t0) / (until - t0), clock: E.clock(P.t) }); }
    }
    self.postMessage({ done: true, rec: rec.snapshot() });
  } catch (err) { self.postMessage({ error: String(err && err.message ? err.message : err) }); }
};
