/* Digital Factory — live briefing, command-room side.
   Captures the plant as a compact snapshot so the presentation can build its briefing slides from it:
     df-live     the latest snapshot, refreshed every few seconds
     df-moments  a ring of recent snapshots (every 30 s and after every event), to choose a moment from
     df-pinned   the moment pinned for the presentation (the "Send to deck" button, key P)
   Same-origin localStorage, so an open command room or the deck's embedded demo can feed the deck. Simulated data. */
(function () {
  'use strict';
  const { $ } = DF;
  const KEYS = { live: 'df-live', moments: 'df-moments', pinned: 'df-pinned' };
  const RING = 40;
  const embed = document.body.classList.contains('embed');
  const read = k => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } };
  const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } };

  const waitingList = S => S.insights.filter(i => i.level !== 'ok' && i.actions && i.actions.some(a => a.primary)).sort((a, b) => (b.risk || 0) - (a.risk || 0));
  const lineStatus = l => (l.stopped || l.paused || l.starved || l.stations.some(s => s.state === 'down')) ? 'down' : l.stations.some(s => s.state === 'warn' || s.state === 'maint') ? 'attn' : 'run';

  DF.capture = function () {
    const S = Sim.state, f = Sim.forecast();
    const open = S.alarms.filter(a => a.state !== 'cleared');
    const waiting = waitingList(S);
    const agentName = id => { const a = id && Sim.agent(id); return a ? a.name : 'AI engine'; };
    return {
      v: 1, src: embed ? 'embed' : 'app', at: Date.now(), clock: Sim.clock(), shift: 'A',
      oee: S.oee, fpy: S.fpy, units: Sim.unitsToday(), plan: Sim.planToday(),
      fc: { prob: f.prob, p10: f.p10, p50: f.p50, p90: f.p90, plan: f.plan },
      alarms: { open: open.length, unack: open.filter(a => a.state === 'active').length, urgent: open.filter(a => a.state === 'active' && a.prio <= 2).length },
      incidents: S.incidents.filter(i => i.open).map(i => ({ title: i.title, cause: i.cause, n: i.members.length + 1, conf: i.confidence })),
      decisions: waiting.map(i => ({ title: i.title, body: i.body, agent: agentName(i.agent), risk: i.risk || 0, action: (i.actions.find(a => a.primary) || {}).label || '' })),
      resolved: S.insights.filter(i => i.level === 'ok').slice(0, 3).map(i => ({ title: i.title, body: i.body })),
      atRisk: waiting.reduce((a, i) => a + (i.risk || 0), 0), saved: S.saved,
      actions: S.agents.reduce((a, g) => a + g.actions, 0), health: Sim.healthScore(),
      lines: S.lines.map(l => ({ id: l.id, name: l.name, sub: l.sub, oee: l.oee, fpy: l.fpyNow, tph: l.tph, status: lineStatus(l) })),
      risks: Sim.machines().map(m => ({ name: m.name, line: Sim.line(m.line).name, risk: Sim.failureRisk(m), rul: Sim.rulHours(m), state: m.state }))
        .sort((a, b) => b.risk - a.risk).slice(0, 3),
      energy: { kw: S.kw, tariff: S.tariff, kwhUnit: S.kw / Math.max(1, S.tph), ambient: S.ambient },
      agents: S.agents.map(a => ({ name: a.name, autonomy: a.autonomy, status: a.status }))
    };
  };

  // an embedded demo stays quiet while a full command room is already feeding the deck
  function mayWrite() {
    if (!embed) return true;
    const live = read(KEYS.live);
    return !live || live.src === 'embed' || Date.now() - live.at > 10000;
  }
  function remember(snap) {
    const ring = (read(KEYS.moments) || []).filter(m => m && m.clock !== snap.clock);
    ring.push(snap);
    write(KEYS.moments, ring.slice(-RING));
  }
  let lastMoment = 0, eventTimer = null;
  function tick(force) {
    if (DF.replay != null || !mayWrite()) return;
    const snap = DF.capture();
    write(KEYS.live, snap);
    if (force || Date.now() - lastMoment > 30000) { lastMoment = Date.now(); remember(snap); }
  }

  /* pin: the live plant, or during a replay the stored moment closest to the replayed minute */
  DF.pinMoment = function () {
    let snap;
    if (DF.replay != null) {
      const clock = Sim.state.history[DF.replay] && Sim.state.history[DF.replay].clock;
      const ring = read(KEYS.moments) || [];
      snap = ring.slice().reverse().find(m => m.clock <= clock) || ring[0];
      if (!snap) { DF.toast('No stored moment for that time yet. Go back to live and pin again.', 'warning'); return null; }
    } else { snap = DF.capture(); remember(snap); }
    snap = Object.assign({}, snap, { pinnedAt: Date.now() });
    if (!write(KEYS.pinned, snap)) { DF.toast('This browser blocks storage, so the moment could not be sent to the deck.', 'error'); return null; }
    Sim.state.audit.unshift({ time: Sim.clock(), who: 'You', action: 'Pinned moment for the presentation', detail: `Plant at ${snap.clock} · OEE ${(snap.oee * 100).toFixed(1)}% · ${snap.decisions.length} decisions waiting` });
    DF.renderAudit && DF.renderAudit();
    DF.toast(`Moment ${snap.clock} sent to the presentation briefing`, 'success');
    return snap;
  };

  const btn = $('#pinBtn');
  if (btn) btn.onclick = () => DF.pinMoment();
  addEventListener('keydown', e => {
    if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName) || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'p' || e.key === 'P') DF.pinMoment();
  });
  // the deck can ask the embedded demo for a pin directly
  addEventListener('message', e => {
    if (e.origin !== location.origin || !e.data || !e.data.dfBrief) return;
    if (e.data.dfBrief === 'pin') { const s = DF.pinMoment(); e.source && e.source.postMessage({ dfBriefPinned: !!s }, location.origin); }
  });

  Sim.on(e => {
    if (e.type === 'insight' || e.type === 'resolve' || e.type === 'acted') { clearTimeout(eventTimer); eventTimer = setTimeout(() => tick(true), 2500); }
  });
  setInterval(() => tick(false), 4000);
  setTimeout(() => tick(true), 1500);
})();
