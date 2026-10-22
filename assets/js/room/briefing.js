/* Digital Factory — live briefing, command-room side.
   Captures Plant EG-01 as a compact snapshot (schema v1) so the presentation can build its briefing slides from it:
     df-live     the latest snapshot, refreshed every few seconds
     df-moments  a ring of recent snapshots (every 30 s and after every decision), to choose a moment from
     df-pinned   the moment pinned for the presentation (the "Send to deck" button, key P)
   Same-origin localStorage, so an open command room or the deck's embedded demo can feed the deck. Simulated data. */
(function () {
  'use strict';
  const { $ } = DF;
  const KEYS = { live: 'df-live', moments: 'df-moments', pinned: 'df-pinned' };
  const RING = 40;
  const embed = /[?&]embed=1/.test(location.search);
  const read = k => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } };
  const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } };
  const lineStatus = L => (L.tripped || L.state === 'down' || L.state === 'starved') ? 'down' : (L.state === 'warn' || L.state === 'changeover' || L.stations.some(s => s.state === 'maint' || s.degrade > 0)) ? 'attn' : 'run';

  DF.capture = function () {
    const P = DF.P, E = DF.E, AG = DF.AG, X = DF.X, k = P.kpi, M = E.MODELS;
    const open = P.alarms.filter(a => !(a.shelvedTo > P.t));
    const waiting = DF.waiting();
    const fpyOf = L => { const t = L.stations.filter(s => s.kind === 'fct' || s.kind === 'qa'); const tot = t.reduce((a, s) => a + s.counters.made + s.counters.bad, 0); return tot ? 1 - t.reduce((a, s) => a + s.counters.bad, 0) / tot : L.qual || 0.99; };
    // failure risk in the next 24 hours from the health trend (the 22% failure point)
    const risks = P.stations.filter(s => s.degrade > 0 || s.state === 'down').map(s => {
      const hrs = s.state === 'down' ? 0 : (s.health - 22) / s.degrade / 3600;
      return { name: s.name, line: P.lines[s.line] ? P.lines[s.line].name : '', risk: s.state === 'down' ? 1 : Math.max(0, Math.min(0.99, 1 - hrs / 24)), rul: Math.round(hrs), state: s.state };
    }).concat(P.stations.filter(s => !(s.degrade > 0) && s.state !== 'down').sort((a, b) => a.health - b.health).slice(0, 3).map(s => ({ name: s.name, line: P.lines[s.line] ? P.lines[s.line].name : '', risk: Math.max(0, (70 - s.health) / 200), rul: 5000, state: s.state })))
      .sort((a, b) => b.risk - a.risk).slice(0, 3);
    // open alarms grouped by area; the oldest is the likely first-out
    const groups = {};
    for (const a of open) (groups[a.area || 'Plant'] = groups[a.area || 'Plant'] || []).push(a);
    const incidents = Object.entries(groups).filter(([, l]) => l.some(a => a.prio <= 2)).map(([area, l]) => { l.sort((a, b) => a.t - b.t); return { title: area, cause: l[0].msg, n: l.length, conf: 0.9 }; });
    const f = AG.base || AG.forecast();
    const spread = Math.round((k.planEnd || 0) * 0.02);
    return {
      v: 1, src: embed ? 'embed' : 'app', at: Date.now(), clock: E.clock(P.t), shift: 'A', plant: 'Plant EG-01',
      oee: k.oee || 0, fpy: k.fpy || 0, units: k.units || 0, plan: k.plan || 0,
      fc: { prob: k.prob || 0, p10: k.p10 ?? Math.round((k.fcst || 0) - 1.28 * spread), p50: Math.round(k.fcst || 0), p90: k.p90 ?? Math.round((k.fcst || 0) + 1.28 * spread), plan: k.planEnd || 0 },
      alarms: { open: open.length, unack: open.filter(a => a.state !== 'ack').length, urgent: open.filter(a => a.prio <= 2).length },
      incidents,
      decisions: waiting.map(c => ({ title: c.title, body: (c.why && c.why[0]) || '', agent: c.agentName, risk: Math.max(0, Math.round(c.base && c.best ? (c.best.f.margin - c.base.f.margin) + (c.base.f.revDelayed - c.best.f.revDelayed) * 0.08 : 0)), action: c.best ? c.best.label : '' })),
      resolved: AG.decided.slice(0, 3).map(d => ({ title: d.title, body: `${d.label} · ${d.by} · ${d.audit}` })),
      atRisk: f.revDelayed || 0, saved: P.saved || 0,
      actions: P.audit.length, health: DF.healthScore ? DF.healthScore() : 0,
      lines: Object.values(P.lines).filter(L => L.kind === 'main').map(L => ({ id: L.id, name: L.name, sub: M[L.model].name, oee: L.oee || 0, fpy: fpyOf(L), tph: Math.round(L.tph || 0), status: lineStatus(L) })),
      risks,
      energy: { kw: Math.round(k.kw || 0), tariff: 'Contract 4,000 kW', kwhUnit: P.made.tv ? P.energy.kwh / P.made.tv : 0, ambient: P.util.ambient || 0 },
      agents: AG.AGENTS.map(a => ({ name: a.name, autonomy: a.autonomy, status: waiting.some(c => c.owner === a.id) ? 'waiting' : 'watching' })),
      orders: { open: P.orders.filter(o => o.state === 'open' || o.state === 'loading').length, short: f.late || 0 },
      value: X.finance().revenue
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
    if ((DF.replaying && DF.replaying()) || !mayWrite()) return;
    const snap = DF.capture();
    write(KEYS.live, snap);
    if (force || Date.now() - lastMoment > 30000) { lastMoment = Date.now(); remember(snap); }
  }

  /* pin: the live plant, or during a replay the moment being replayed */
  DF.pinMoment = function () {
    const snap = Object.assign({}, DF.capture(), { pinnedAt: Date.now() });
    if (!(DF.replaying && DF.replaying())) remember(snap);
    if (!write(KEYS.pinned, snap)) { DF.toast('This browser blocks storage, so the moment could not be sent to the deck.', 'error'); return null; }
    DF.E.audit('You', 'Pinned moment for the presentation', `Plant at ${snap.clock} · OEE ${(snap.oee * 100).toFixed(1)}% · ${snap.decisions.length} decisions waiting`);
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
  DF.briefingStart = function () {
    DF.E.on(t => { if (t === 'audit') { clearTimeout(eventTimer); eventTimer = setTimeout(() => tick(true), 2500); } });
    setInterval(() => tick(false), 4000); setTimeout(() => tick(true), 1500);
  };
})();
