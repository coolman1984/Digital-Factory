/* Digital Factory — Live plant flight recorder.
   Keeps the whole shift as it happens so the presentation can review any time window later: one frame of the plant
   readouts every plant minute, and every event, agent message, decision card (with the options the agent simulated) and
   audit entry, each stamped with plant time. Pure model: no DOM, so it also runs inside the sample-shift worker.
   The page saves the recording to this browser (localStorage "df-rec"); nothing leaves the browser. Simulated data. */
(function (root) {
  'use strict';

  const CAP = { frames: 1500, events: 6000, feed: 1500, audit: 800, cards: 400 };
  const r3 = v => (isFinite(v) ? Math.round(v * 1000) / 1000 : 0);

  function create(E, X, A, opts = {}) {
    const P = E.P;
    const R = {
      v: 1, kind: 'plant', source: opts.source || 'live', session: Date.now(), seed: opts.seed || null,
      from: P.t, to: P.t, frames: [], events: [], feed: [], audit: [], cards: []
    };
    const push = (arr, x, cap) => { arr.push(x); if (arr.length > cap) arr.splice(0, arr.length - cap); };

    function frame() {
      const k = P.kpi || {};
      const mains = Object.values(P.lines).filter(L => L.kind === 'main');
      push(R.frames, {
        t: Math.round(P.t), units: Math.round(k.units || 0), plan: Math.round(k.plan || 0), planEnd: Math.round(k.planEnd || 0),
        fcst: Math.round(k.fcst || 0), prob: r3(k.prob), oee: r3(k.oee), fpy: r3(k.fpy), kw: Math.round(k.kw || 0), otif: r3(k.otif),
        alarms: P.alarms.length, p1: P.alarms.filter(a => a.prio <= 1).length, saved: Math.round(P.saved || 0),
        revenue: Math.round((X && X.fin && X.fin.revenue) || 0), decisions: A ? A.stats.decisions : 0, auto: A ? A.stats.auto : 0,
        recs: (P.recs || []).length,
        lines: mains.map(L => ({ id: L.id, name: L.name, model: L.model, oee: r3(L.oee), tph: Math.round(L.tph || 0), state: L.state }))
      }, CAP.frames);
      R.to = P.t;
    }

    let lastFrame = -1e9;
    const cardSeen = new Map();
    function tick() {
      if (P.t - lastFrame >= 60) { lastFrame = P.t; frame(); }
      R.to = P.t;
      // decision cards: the options the agent simulated and what it recommended
      // an agent re-checks an open decision every 90 s; keep one entry per decision unless its recommendation changes
      if (A && A.cards) for (const c of A.cards.values()) {
        if (c._rec) continue;
        c._rec = true;
        const last = cardSeen.get(c.key);
        if (last && last.best === (c.best && c.best.label) && P.t - last.t < 1800) continue;
        cardSeen.set(c.key, { t: P.t, best: c.best && c.best.label });
        push(R.cards, {
          t: Math.round(c.at), key: c.key, title: c.title, agent: c.agentName, confidence: r3(c.confidence), why: c.why || '',
          best: c.best ? c.best.label : '', auto: !!c.autoDone,
          options: (c.options || []).map(o => ({ label: o.label, cost: Math.round(o.cost || 0), note: o.note || '', score: isFinite(o.score) ? Math.round(o.score) : null }))
        }, CAP.cards);
      }
    }

    E.on((type, d) => {
      if (type === 'event' && d) push(R.events, { t: Math.round(d.t), src: d.src, msg: d.msg, level: d.level || 'info', ref: d.ref || null }, CAP.events);
      else if (type === 'agentFeed' && d) push(R.feed, { t: Math.round(d.t), agent: d.agent, text: d.text, level: d.level || 'info' }, CAP.feed);
      else if (type === 'audit') { const a = P.audit[0]; if (a) push(R.audit, { t: Math.round(P.t), who: a.who, action: a.action, detail: a.detail || '' }, CAP.audit); }
      else if (type === 'tick') tick();
    });
    frame();

    return {
      R, tick, frame,
      // a plain copy for storage or a postMessage
      snapshot() { tick(); return JSON.parse(JSON.stringify(R)); }
    };
  }

  // the story used by "Build a sample shift": a normal morning, a bearing failure building on SMD 4 after 12:30,
  // a short-shot problem on IM10 at 13:20, the plant manager approving the agents' recommendations a few minutes later
  const STORY = [
    { at: 12 * 3600 + 35 * 60, drill: 'bearing' },
    { at: 13 * 3600 + 20 * 60, drill: 'shortshot' }
  ];

  const PlantRecorder = { create, STORY };
  if (typeof module !== 'undefined' && module.exports) module.exports = PlantRecorder;
  else root.PlantRecorder = PlantRecorder;
})(typeof window !== 'undefined' ? window : globalThis);
