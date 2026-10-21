/* Digital Factory — live briefing, command-room side.
   Captures the plant as a compact snapshot (schema v1) so the presentation can build its briefing slides from it:
     df-live     the latest snapshot, refreshed every few seconds
     df-moments  a ring of recent snapshots (every 30 s and after every agent decision), to choose a moment from
     df-pinned   the moment pinned for the presentation (the "Send to deck" button, key P)
   Same-origin localStorage, so an open command room or the deck's embedded demo can feed the deck. Simulated data. */
(function () {
  'use strict';
  const { $ } = DF;
  const T = window.Twin, A = window.Agents, PE = window.PlantEngine;
  const KEYS = { live: 'df-live', moments: 'df-moments', pinned: 'df-pinned' };
  const RING = 40;
  const embed = document.body.classList.contains('embed');
  const read = k => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } };
  const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } };
  const lineStatus = L => (L.stopped || L.tripped || L.state === 'down' || L.state === 'starved') ? 'down' : (L.state === 'warn' || L.state === 'changeover' || L.stations.some(s => s.state === 'maint' || s.degrade > 0)) ? 'attn' : 'run';

  DF.capture = function () {
    const P = DF.world(), k = P.kpi, f = DF.forecastNow();
    const open = P.alarms.filter(a => !(a.shelvedTo > P.t));
    const waiting = A.waiting().slice().sort((a, b) => (b.value || 0) - (a.value || 0));
    const rec = c => (c.options || []).find(o => o.id === c.recommended);
    const fpyOf = L => { const t = L.stations.filter(s => s.kind === 'fct' || s.kind === 'aoi' || s.kind === 'qc'); const tot = t.reduce((a, s) => a + s.counters.made + s.counters.bad, 0); return tot ? 1 - t.reduce((a, s) => a + s.counters.bad, 0) / tot : L.qual || 0.99; };
    const rot = P.stations.filter(s => (s.kind === 'mounter' || s.kind === 'robot' || s.kind === 'palletizer') && s.hist.vib && s.hist.vib.length > 10).map(s => {
      const r = A.linreg(s.hist.vib.slice(-44).filter(v => v > 0.6).slice(-36), 5 / 60);
      const hrs = r.slope > 0.004 && r.r2 > 0.3 ? Math.max(0, 7.1 - r.last) / r.slope / 60 : 5000;
      return { name: s.name, line: P.lines[s.line].name, risk: s.state === 'down' ? 1 : Math.max(0, Math.min(0.99, 1 - hrs / 30)), rul: Math.round(hrs), state: s.state };
    }).sort((a, b) => b.risk - a.risk).slice(0, 3);
    return {
      v: 1, src: embed ? 'embed' : 'app', at: Date.now(), clock: PE.clock(P.t), shift: 'A',
      oee: k.oee || 0, fpy: k.fpy || 0, units: k.units || 0, plan: k.plan || 0,
      fc: { prob: f.prob, p10: Math.round(f.p10), p50: Math.round(f.p50), p90: Math.round(f.p90), plan: f.plan },
      alarms: { open: open.length, unack: open.filter(a => a.state === 'active').length, urgent: open.filter(a => a.prio <= 2).length },
      incidents: DF.incidents(P).filter(i => i.open).map(i => ({ title: i.title, cause: i.case && i.case.diagnosis ? i.case.diagnosis.cause : i.first.msg, n: i.members.length + 1, conf: i.case && i.case.diagnosis && i.case.diagnosis.confidence ? i.case.diagnosis.confidence : 0.9 })),
      decisions: waiting.map(c => ({ title: c.title, body: c.diagnosis ? c.diagnosis.text || c.diagnosis.cause : '', agent: CaseUI.agentName(c.agent), risk: Math.max(0, Math.round(c.value || 0)), action: rec(c) ? rec(c).label : '' })),
      resolved: A.S.cases.filter(c => c.state === 'closed' && c.decision && c.outcome && c.outcome.ok).slice(0, 3).map(c => ({ title: c.title, body: c.outcome.verdict })),
      atRisk: waiting.reduce((a, c) => a + Math.max(0, c.value || 0), 0), saved: A.S.value,
      actions: A.S.agents.reduce((a, g) => a + g.actions, 0), health: DF.health(P).score,
      lines: ['L1', 'L2', 'L3', 'L4', 'L5'].map(id => { const L = P.lines[id]; return { id, name: L.name, sub: L.sub, oee: L.oee, fpy: fpyOf(L), tph: Math.round(L.tph || 0), status: lineStatus(L) }; }),
      risks: rot,
      energy: { kw: Math.round(k.kw || 0), tariff: P.energy.tariff, kwhUnit: k.kwhUnit || 0, ambient: P.util.ambient || 0 },
      agents: A.S.agents.map(a => ({ name: a.name, autonomy: a.autonomy, status: a.status }))
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
    if (DF.replay || !T.E || !mayWrite()) return;
    const snap = DF.capture();
    write(KEYS.live, snap);
    if (force || Date.now() - lastMoment > 30000) { lastMoment = Date.now(); remember(snap); }
  }

  /* pin: the live plant, or during a replay the rebuilt moment itself */
  DF.pinMoment = function () {
    const snap = Object.assign({}, DF.capture(), { pinnedAt: Date.now() });
    if (!DF.replay) remember(snap);
    if (!write(KEYS.pinned, snap)) { DF.toast('This browser blocks storage, so the moment could not be sent to the deck.', 'error'); return null; }
    T.exec({ type: 'note', who: 'You', action: 'Pinned moment for the presentation', detail: `Plant at ${snap.clock} · OEE ${(snap.oee * 100).toFixed(1)}% · ${snap.decisions.length} decisions waiting` });
    DF.toast(`Moment ${snap.clock} sent to the presentation briefing`, 'success');
    return snap;
  };
  const btn = $('#pinBtn');
  if (btn) btn.onclick = () => DF.pinMoment();
  // the deck can ask the embedded demo for a pin directly
  addEventListener('message', e => {
    if (e.origin !== location.origin || !e.data || !e.data.dfBrief) return;
    if (e.data.dfBrief === 'pin') { const s = DF.pinMoment(); e.source && e.source.postMessage({ dfBriefPinned: !!s }, location.origin); }
  });
  A.on(t => { if (t === 'acted' || t === 'closed' || t === 'awaiting') { clearTimeout(eventTimer); eventTimer = setTimeout(() => tick(true), 2500); } });
  DF.briefingStart = function () { setInterval(() => tick(false), 4000); setTimeout(() => tick(true), 1500); };
})();
