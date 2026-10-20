/* Digital Factory — the AI agent crew of Plant EG-01 (window.Agents).
   Six specialised agents and a plant orchestrator work on the live twin through the plant hub (window.Twin):
     detect   from the plant's own data (vibration trends, p-charts, genealogy, runways, demand), not from the drill that caused it
     investigate with tools (historian, genealogy, CMMS, WMS, ERP, energy meters) and a memory of past cases
     simulate every option on forks of the live plant (several futures each) before recommending one
     decide   within the agent's autonomy and the plant policy; the orchestrator checks conflicts between plans
     act      through the same commands a person uses; every decision goes to the ledger
     verify   after acting: predicted against actual, which builds each agent's track record
   DOM-free. Runs in one tab (Web Lock "df-agents"); other tabs mirror the cases. All data is simulated. */
(function () {
  'use strict';
  const T = window.Twin;
  const listeners = [];
  const emit = (t, d) => listeners.slice().forEach(f => { try { f(t, d); } catch (e) { console.error(e); } });
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
  const fmt = n => Math.round(n).toLocaleString('en-US');
  const egp = n => (n < 0 ? '−' : '') + 'EGP ' + (Math.abs(n) >= 1e6 ? (Math.abs(n) / 1e6).toFixed(2) + 'M' : Math.abs(n) >= 1e3 ? Math.round(Math.abs(n) / 1e3) + 'k' : Math.round(Math.abs(n)));
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  const DEFS = [
    { id: 'maint', name: 'Maintenance agent', short: 'Maintenance', icon: 'settings', scope: 'Machine health, work orders, spare parts, technicians', autonomy: 'approve' },
    { id: 'quality', name: 'Quality agent', short: 'Quality', icon: 'eye', scope: 'AOI, function test, final QC, genealogy, process parameters', autonomy: 'approve' },
    { id: 'logistics', name: 'Logistics agent', short: 'Logistics', icon: 'box', scope: 'Line-side stock, AGV fleet, warehouse', autonomy: 'auto' },
    { id: 'energy', name: 'Energy agent', short: 'Energy', icon: 'live', scope: 'Demand, tariff, chillers, compressed air, grid events', autonomy: 'auto' },
    { id: 'planner', name: 'Planning agent', short: 'Planning', icon: 'calendar', scope: 'Orders, capacity, people, supply', autonomy: 'approve' },
    { id: 'safety', name: 'Safety agent', short: 'Safety', icon: 'shield', scope: 'People near robots, EHS', autonomy: 'auto', locked: true },
    { id: 'orch', name: 'Plant orchestrator', short: 'Orchestrator', icon: 'layers', scope: 'Checks every plan against the others and the plant policy', autonomy: 'auto', locked: true, meta: true }
  ];
  // the plant policy: the most an agent may do on its own for each kind of action (bounded autonomy)
  const POLICY = {
    expedite: { max: 'auto', risk: 'Low · reversible', note: 'Re-prioritising an AGV mission' },
    manualFetch: { max: 'approve', risk: 'Low', note: 'Takes an operator off the line for 6 min' },
    planRepair: { max: 'approve', risk: 'Medium · production stop', note: 'A planned stop changes the shift plan' },
    derate: { max: 'auto', risk: 'Low · reversible', note: 'Slower machine, same product' },
    dispatchTech: { max: 'auto', risk: 'Low', note: 'Sends the technician with the parts kit' },
    switchL2: { max: 'approve', risk: 'Medium · changeover', note: 'Product changeover on SMT Line 2' },
    switchBack: { max: 'approve', risk: 'Medium · changeover', note: 'Product changeover on SMT Line 2' },
    slowAssembly: { max: 'approve', risk: 'Medium · output', note: 'Lowers assembly output' },
    fixReflow: { max: 'approve', risk: 'Medium · process change', note: 'Process parameter inside the validated window' },
    stopInspect: { max: 'approve', risk: 'High · stop', note: 'Stops a line' },
    quarantine: { max: 'approve', risk: 'Medium · supplier claim', note: 'Blocks material, raises a claim' },
    inspectLot: { max: 'approve', risk: 'Low', note: 'Slows the TV line' },
    boost: { max: 'approve', risk: 'Medium · quality and energy', note: 'Line speed up to 110%' },
    split: { max: 'advise', risk: 'Customer commitment', note: 'Needs the customer\'s agreement' },
    prioritize: { max: 'approve', risk: 'Low · other orders move', note: 'Changes the loading order' },
    cover: { max: 'approve', risk: 'Low', note: 'Moves a certified operator' },
    leaderCover: { max: 'approve', risk: 'Low', note: 'Line leader leaves supervision' },
    expediteTruck: { max: 'approve', risk: 'Cost EGP 18k', note: 'Spends money' },
    restart: { max: 'auto', risk: 'Low when staggered', note: 'Restart after a trip' },
    restartAll: { max: 'approve', risk: 'Medium · inrush peak', note: 'Simultaneous restart' },
    stagger: { max: 'auto', risk: 'Low · buffered', note: 'Holds flexible loads 20 min' },
    precool: { max: 'approve', risk: 'Cost · energy', note: 'Spends energy now to save later' },
    reflowProfile: { max: 'approve', risk: 'Medium · process change', note: 'Process parameter inside the validated window' },
    safeSpeed: { max: 'auto', risk: 'Safety · always allowed', note: 'An agent may slow a robot, never speed it up' },
    none: { max: 'auto', risk: '—', note: 'No change' }
  };
  const RANK = { advise: 0, approve: 1, auto: 2 };
  const minLevel = (a, b) => (RANK[a] <= RANK[b] ? a : b);

  // what the crew remembers from earlier shifts (seeded case library; new cases are added as they close)
  const MEMORY = [
    { id: 'INC-0412', when: '14 Aug', kind: 'wear', kindOf: 'mounter', title: 'Mounter B spindle bearing', sig: { slope: 2.0, vib: 3.0 }, cause: 'Spindle bearing wear', fix: 'Bearing changed in an 8-minute planned stop', outcome: 'Failed 3.2 h after onset on the first occurrence (2024), planned since', hours: 3.2 },
    { id: 'INC-0388', when: '02 Jun', kind: 'wear', kindOf: 'mounter', title: 'Mounter C head Z-axis bearing', sig: { slope: 0.3, vib: 2.7 }, cause: 'Z-axis bearing wear', fix: 'Derated to 85% until the weekend stop', outcome: 'Ran 31 h derated, changed at the weekend', hours: 31 },
    { id: 'QN-2291', when: '19 Jul', kind: 'spc', factor: 'z5', title: 'Line 2 oven zone 5 controller drift', cause: 'Zone 5 thermocouple drift', fix: 'Setpoint corrected, thermocouple replaced next stop', outcome: 'Bridges back to baseline in 12 min' },
    { id: 'QN-2304', when: '28 Aug', kind: 'spc', factor: 'vib', title: 'Misplacements from a worn mounter', cause: 'Head vibration', fix: 'Handed to maintenance', outcome: 'Defects stopped after the bearing change' },
    { id: 'SCAR-118', when: '06 May', kind: 'lot', title: 'Panel lot with pixel defects (Supplier B)', cause: 'Supplier lot defect', fix: 'Lot quarantined, 8D with the supplier', outcome: '214 panels returned; no escapes' },
    { id: 'LOG-0921', when: '11 Sep', kind: 'stock', title: 'Back covers ran out during a big batch', cause: 'All AGVs busy at the reorder point', fix: 'Mission pre-empted', outcome: 'No stop' },
    { id: 'EN-0077', when: '22 Jul', kind: 'peak', title: 'Chiller and compressor started together', cause: 'Simultaneous start in the peak window', fix: 'Loads staggered by 20 min', outcome: 'Peak held under contract' },
    { id: 'EN-0081', when: '03 Aug', kind: 'heat', title: 'Afternoon heat wave, 40 °C', cause: 'Ambient', fix: 'Pre-cooled before 11:00, reflow −3 °C', outcome: 'Chillers held, no solder defects' },
    { id: 'PLN-0560', when: '17 Sep', kind: 'order', title: 'Export order at risk after a robot fault', cause: 'Lost hours on Final Assembly B', fix: 'Line at 110% for 2 h', outcome: 'Shipped 6 min early; FPY 99.1%' }
  ];

  const S = {
    agents: DEFS.map(d => Object.assign({}, d, { status: 'Watching', busy: 0, cases: 0, accurate: 0, verified: 0, value: 0, actions: 0, last: '' })),
    cases: [], ledger: [], feed: [], memory: MEMORY.slice(), value: 0, seq: 100, host: false, started: false
  };
  const agent = id => S.agents.find(a => a.id === id);
  const caseById = id => S.cases.find(c => c.id === id);
  const E = () => T.E;
  const P = () => T.E.P;
  const clockOf = t => window.PlantEngine.clock(t);
  const mins = s => window.PlantEngine.mins(s);
  const lc = s => String(s).replace(/^([A-Z])([a-z])/, (m, a, b) => a.toLowerCase() + b);
  const lineName = id => (P().lines[id] ? P().lines[id].name : id);
  const sname = id => (P().byId[id] ? P().byId[id].name : id);
  const uns = (s, k) => `EG-01/${s.line === 'L1' || s.line === 'L2' ? 'SMT' : s.line === 'L5' ? 'TP' : 'FA'}/${s.line}/${s.name.replace(/\W+/g, '')}/${k}`;

  /* ---------------- analytics ---------------- */
  function linreg(ys, dx = 1) {
    const n = ys.length; if (n < 3) return { slope: 0, r2: 0, se: 0, last: ys[n - 1] || 0 };
    let sx = 0, sy = 0, sxx = 0, sxy = 0;
    for (let i = 0; i < n; i++) { const x = i * dx; sx += x; sy += ys[i]; sxx += x * x; sxy += x * ys[i]; }
    const slope = (n * sxy - sx * sy) / Math.max(1e-9, n * sxx - sx * sx), icpt = (sy - slope * sx) / n;
    let ssr = 0, sst = 0; const my = sy / n;
    for (let i = 0; i < n; i++) { const f = icpt + slope * i * dx; ssr += (ys[i] - f) ** 2; sst += (ys[i] - my) ** 2; }
    const se = Math.sqrt(ssr / Math.max(1, n - 2)) / Math.sqrt(Math.max(1e-9, sxx - sx * sx / n));
    return { slope, icpt, r2: sst ? 1 - ssr / sst : 0, se, last: icpt + slope * (n - 1) * dx, sigma: Math.sqrt(ssr / Math.max(1, n - 2)) };
  }
  function pointBiserial(rows, key) {
    const xs = rows.filter(r => isFinite(r[key]));
    if (xs.length < 10) return { r: 0, d: 0 };
    const bad = xs.filter(r => !r.ok).map(r => r[key]), good = xs.filter(r => r.ok).map(r => r[key]);
    if (!bad.length || !good.length) return { r: 0, d: 0 };
    const all = xs.map(r => r[key]), m = mean(all), sd = Math.sqrt(mean(all.map(v => (v - m) ** 2))) || 1e-9;
    const p = bad.length / xs.length;
    return { r: (mean(bad) - mean(good)) / sd * Math.sqrt(p * (1 - p)), d: mean(bad) - mean(good), bad: mean(bad), good: mean(good), nBad: bad.length, nGood: good.length };
  }
  // P(X >= k) for X ~ Binomial(n, p)
  function binomTail(k, n, p) {
    let term = Math.pow(1 - p, n), cdf = 0;
    for (let i = 0; i < k; i++) { cdf += term; term *= (n - i) / (i + 1) * p / (1 - p); }
    return Math.max(0, 1 - cdf);
  }
  const down = (arr, n = 24) => { if (!arr || arr.length <= n) return (arr || []).slice(); const out = []; for (let i = 0; i < n; i++) out.push(arr[Math.round(i * (arr.length - 1) / (n - 1))]); return out; };
  const memoryMatch = (kind, sig) => {
    const cands = S.memory.filter(m => m.kind === kind);
    if (!cands.length) return null;
    const scored = cands.map(m => {
      let sim = 0.7;
      if (sig && m.sig) { const ds = Math.abs((m.sig.slope || 0) - (sig.slope || 0)) / Math.max(0.1, m.sig.slope || 0.1), dv = Math.abs((m.sig.vib || 0) - (sig.vib || 0)) / Math.max(1, m.sig.vib || 1); sim = clamp(1 - 0.35 * ds - 0.4 * dv, 0.3, 0.97); }
      if (sig && sig.factor && m.factor) sim = m.factor === sig.factor ? 0.92 : 0.35;
      if (sig && sig.kindOf && m.kindOf && sig.kindOf !== m.kindOf) sim *= 0.6;
      return { m, sim };
    }).sort((a, b) => b.sim - a.sim);
    return scored[0];
  };

  /* ---------------- tools (also used by the copilot) ---------------- */
  const SPARES = { 'Spindle bearing 6204-2RS': { qty: 2, bin: 'B-14' }, 'Servo drive SD-400': { qty: 1, bin: 'C-03' }, 'Torque sensor kit': { qty: 3, bin: 'C-07' }, 'Thermocouple type K': { qty: 6, bin: 'A-22' }, 'AGV drive motor': { qty: 1, bin: 'D-02' }, 'Vacuum pump seal kit': { qty: 4, bin: 'B-09' } };
  const TOOLS = {
    plant_overview() {
      const p = P(), k = p.kpi;
      return {
        time: clockOf(p.t), shift: 'A (06:00–14:00)', oee: +(k.oee || 0).toFixed(3), packed: k.units, plan: k.plan, forecast: k.fcst, planEnd: k.planEnd, probHitPlan: +(k.prob || 0).toFixed(2), fpy: +(k.fpy || 0).toFixed(4),
        wip: k.wip, kw: Math.round(k.kw || 0), contractKw: p.energy.contract, tariff: p.energy.tariff, activeAlarms: p.alarms.length, alarmRate10min: p.alarmStats.rate10, flood: p.alarmStats.flood,
        lines: Object.values(p.lines).map(l => ({ id: l.id, name: l.name, product: l.sub, state: l.state, oee: +(l.oee || 0).toFixed(3), perHour: Math.round(l.tph || 0), speed: l.speed })),
        openCases: S.cases.filter(c => c.state !== 'closed').map(c => ({ id: c.id, agent: agent(c.agent).short, title: c.title, state: c.state }))
      };
    },
    line_status({ line }) {
      const l = P().lines[line]; if (!l) return { error: 'Unknown line ' + line + '. Lines: L1–L5.' };
      return { id: l.id, name: l.name, product: l.sub, state: l.state, speed: l.speed, oee: +(l.oee || 0).toFixed(3), availability: +(l.avail || 0).toFixed(3), performance: +(l.perf || 0).toFixed(3), quality: +(l.qual || 0).toFixed(4), perHour: Math.round(l.tph || 0),
        stations: l.stations.map(s => ({ id: s.id, name: s.name, state: s.state, why: s.why, cycleS: +(s.ctEma || 0).toFixed(1), health: s.kind === 'mounter' || s.kind === 'robot' ? 'see station' : undefined })) };
    },
    station({ id }) {
      const s = P().byId[id]; if (!s) return { error: 'Unknown station ' + id };
      const H = s.hist, v = H.vib ? linreg(H.vib.slice(-36), 5 / 60) : null;
      return { id: s.id, name: s.name, line: lineName(s.line), kind: s.kind, state: s.state, why: s.why, since: clockOf(s.since), operator: s.operator ? s.operator.name : null,
        sensors: Object.fromEntries(Object.entries(s.sens).filter(([, x]) => typeof x === 'number').map(([k, x]) => [k, +x.toFixed(2)])), zones: s.sens.zones ? s.sens.zones.map(z => Math.round(z)) : undefined,
        vibrationTrendPerHour: v ? +(v.slope * 60).toFixed(2) : undefined, made: s.counters.made, rejected: s.counters.bad, cycleS: +(s.ctEma || 0).toFixed(1), fault: s.fault ? s.fault.why : null, uns: uns(s, '*') };
    },
    history({ id, series = 'vib', minutes = 15 }) {
      const s = P().byId[id]; if (!s) return { error: 'Unknown station ' + id };
      const arr = (s.hist[series] || []).slice(-Math.round(minutes * 12));
      if (!arr.length) return { error: `No ${series} history for ${s.name}` };
      const r = linreg(arr, 5 / 60);
      return { uns: uns(s, series), samples: arr.length, last: arr[arr.length - 1], min: Math.min(...arr), max: Math.max(...arr), mean: +mean(arr).toFixed(2), slopePerMin: +r.slope.toFixed(3), r2: +r.r2.toFixed(2), values: down(arr, 24) };
    },
    alarms() {
      const p = P();
      return { rate10min: p.alarmStats.rate10, flood: p.alarmStats.flood, active: p.alarms.slice(0, 30).map(a => ({ key: a.key, prio: a.prio, msg: a.msg, area: a.area, time: a.time, state: a.state, case: a.case || null })) };
    },
    cases() { return S.cases.slice(0, 20).map(c => ({ id: c.id, agent: agent(c.agent).short, title: c.title, state: c.state, recommended: c.recommended ? (c.options.find(o => o.id === c.recommended) || {}).label : null, value: c.value ? Math.round(c.value) : null })); },
    orders() {
      return P().orders.filter(o => o.state === 'open' || o.state === 'loading' || P().t - (o.shippedAt || 0) < 3600).map(o => ({ id: o.id, customer: o.customer, product: o.product, qty: o.qty, shipped: o.shipped, due: clockOf(o.due), state: o.state, readyEta: o.eta ? clockOf(o.eta) : null, lateMin: o.risk ? Math.round(o.risk / 60) : 0 }));
    },
    stock({ id } = {}) {
      const p = P(), E0 = E();
      const list = Object.values(p.bufs).filter(b => !id || b.id === id).map(b => ({ id: b.id, label: b.label, at: b.station ? sname(b.station) : b.rm ? 'Raw-material warehouse' : 'Supermarket', level: Math.round(E0.level(b)), cap: b.cap, runwayMin: isFinite(E0.runway(b)) ? Math.round(E0.runway(b) / 60) : null, delivery: b.mission ? (b.mission.agv ? `${b.mission.agv.id}${b.mission.agv.fault ? ' (faulted)' : ''} ETA ${clockOf(b.mission.eta || p.t)}` : 'waiting for an AGV') : null }));
      return id ? list[0] || { error: 'Unknown buffer ' + id } : list;
    },
    agv_fleet() { return P().agvs.map(a => ({ id: a.id, state: a.state, battery: Math.round(a.battery), mission: a.mission ? `${a.mission.buf.label} → ${sname(a.mission.buf.station)}` : null, fault: a.fault })); },
    genealogy({ serial }) {
      const u = E().findUnit(serial); if (!u) return { error: 'No unit with serial ' + serial };
      return { serial: u.sn, type: u.type, model: u.model, born: clockOf(u.born), lot: u.lot || null, parts: Object.fromEntries(Object.entries(u.parts || {}).map(([k, v]) => [k, v && v.sn])), pallet: u.pallet || null, order: u.order || null,
        steps: u.steps.map(s => ({ station: s.name, at: clockOf(s.t0), ok: s.ok !== false, by: s.by, note: s.note })) };
    },
    aoi_analysis({ line = 'L2', boards = 120 } = {}) {
      const rows = P().aoiLog[line].slice(-boards);
      const bad = rows.filter(r => !r.ok);
      const f = {};
      for (const k of ['z5', 'peak', 'spi', 'paste', 'vib']) { const pb = pointBiserial(rows, k); f[k] = { r: +pb.r.toFixed(2), rejected: pb.bad && +pb.bad.toFixed(2), passed: pb.good && +pb.good.toFixed(2) }; }
      const codes = {}; bad.forEach(r => { codes[r.code] = (codes[r.code] || 0) + 1; });
      return { line, boards: rows.length, rejected: bad.length, rate: rows.length ? +(bad.length / rows.length).toFixed(4) : 0, factors: f, defects: codes };
    },
    test_analysis({ minutes = 40 } = {}) {
      const p = P(), rows = p.testLog.filter(r => r.type === 'tv' && p.t - r.t < minutes * 60);
      const lots = {};
      rows.forEach(r => { const k = r.lot || '—'; (lots[k] = lots[k] || { lot: k, tested: 0, failed: 0 }); lots[k].tested++; if (!r.ok) lots[k].failed++; });
      return { tested: rows.length, failed: rows.filter(r => !r.ok).length, byLot: Object.values(lots).map(l => Object.assign(l, { rate: +(l.failed / Math.max(1, l.tested)).toFixed(3) })).sort((a, b) => b.rate - a.rate) };
    },
    lot_location({ lot }) {
      const p = P(), E0 = E();
      const line = E0.LS.L3panel.lots.filter(l => l.id === lot).reduce((a, l) => a + l.qty, 0), wh = E0.RM.panel.lots.filter(l => l.id === lot).reduce((a, l) => a + l.qty, 0);
      const wip = [...p.units].filter(u => u.type === 'tv' && u.lot === lot && !u.packed).length, packed = [...p.units].filter(u => u.type === 'tv' && u.lot === lot && u.packed).length;
      return { lot, lineSide: line, warehouse: wh, inProcess: wip, packed };
    },
    spares({ part }) { const s = SPARES[part]; return s ? Object.assign({ part }, s) : { part, qty: 0, note: 'Not stocked; supplier lead time 3 days' }; },
    technicians() { return P().techs.map(t => ({ name: t.name, state: t.state, job: t.job ? sname(t.job) : null })); },
    energy() {
      const p = P();
      return { kw: Math.round(p.kpi.kw || 0), contract: p.energy.contract, tariff: p.energy.tariff, price: p.energy.price, peakToday: Math.round(p.energy.peak), kwhToday: Math.round(p.energy.kwh), costToday: Math.round(p.energy.cost), ambient: +(p.util.ambient || 0).toFixed(1),
        assets: p.util.assets.map(a => ({ id: a.id, name: a.name, kw: Math.round(a.kw), on: a.on !== false })) };
    }
  };

  /* ---------------- cases ---------------- */
  function newCase(o) {
    const c = Object.assign({
      id: 'C-' + (++S.seq), state: 'investigating', created: P().t, updated: P().t, sev: 'warn', steps: [], evidence: [], options: [], refs: [], chain: [],
      diagnosis: null, recommended: null, autonomy: null, decision: null, verify: null, value: 0, sim: null, confidence: null
    }, o);
    S.cases.unshift(c);
    if (S.cases.length > 60) S.cases.length = 60;
    const a = agent(c.agent); a.cases++; a.busy++;
    status(c.agent);
    emit('case', c); sync();
    return c;
  }
  function status(id) {
    const a = agent(id), open = S.cases.filter(c => c.agent === id && c.state !== 'closed');
    const wait = open.filter(c => c.state === 'awaiting').length;
    a.status = wait ? `Waiting for you · ${wait}` : open.some(c => c.state === 'simulating') ? 'Simulating' : open.some(c => c.state === 'investigating') ? 'Investigating' : open.some(c => c.state === 'verifying') ? 'Verifying' : 'Watching';
    a.busy = open.length;
  }
  const pace = c => {
    const sp = Math.max(1, T.speed || 1);
    const urgent = c.eta !== undefined && c.eta < 600;
    return sleep((urgent ? 220 : 620) / Math.sqrt(sp));
  };
  async function waitRunning() { while (T.paused) await sleep(250); }
  function stepOf(c, kind, title, detail, extra) {
    const s = Object.assign({ t: P().t, time: clockOf(P().t), agent: c.agent, kind, title, detail: detail || '' }, extra);
    c.steps.push(s); c.updated = P().t;
    emit('step', { c, s }); sync();
    return s;
  }
  function ctx(c) {
    return {
      async observe(title, detail, extra) { await waitRunning(); stepOf(c, 'observe', title, detail, extra); await pace(c); },
      async tool(name, args, summarize) {
        await waitRunning();
        const r = TOOLS[name](args || {});
        stepOf(c, 'tool', `${name}(${Object.values(args || {}).map(v => JSON.stringify(v)).join(', ')})`, summarize ? summarize(r) : '', { tool: name });
        await pace(c);
        return r;
      },
      async think(title, detail, extra) { await waitRunning(); stepOf(c, 'think', title, detail, extra); await pace(c); },
      async handoff(to, title, detail) { await waitRunning(); stepOf(c, 'handoff', title, detail, { agent: to, from: c.agent }); await pace(c); },
      async memory(kind, sig) {
        await waitRunning();
        const m = memoryMatch(kind, sig);
        stepOf(c, 'memory', m ? `Similar case ${m.m.id} (${m.m.when}) · ${Math.round(m.sim * 100)}% match` : 'No similar case in memory', m ? `${m.m.title}. ${m.m.cause}; ${m.m.fix}. ${m.m.outcome}.` : '');
        await pace(c);
        return m;
      },
      async simulate(options, req) { return simulate(c, options, req); },
      evidence(e) { c.evidence.push(e); sync(); }
    };
  }

  async function simulate(c, options, req = {}) {
    await waitRunning();
    c.state = 'simulating'; status(c.agent);
    const opts = [{ id: 'none', label: 'Do nothing', cmds: [], why: 'The baseline: what the plant does if nobody acts' }].concat(options);
    stepOf(c, 'sim', `Simulating ${opts.length} options × ${req.seeds || 3} futures on forks of the live plant`, `Horizon ${Math.round((req.horizon || 2700) / 60)} min from ${clockOf(P().t)}. Each future shares the present and differs in its random draws (micro-stops, failures, defects).`);
    let res;
    try {
      res = await T.whatif({ horizon: req.horizon || 2700, seeds: req.seeds || 3, options: opts.map(o => ({ id: o.id, label: o.label, cmds: o.cmds })), watch: req.watch || [] });
    } catch (e) {
      stepOf(c, 'think', 'Simulation failed', String(e.message || e)); return null;
    }
    c.sim = { ms: res.ms, horizon: res.horizon, seeds: res.seeds, futures: res.seeds * opts.length, at: res.at };
    c.options = opts.map(o => {
      const r = res.options.find(x => x.id === o.id);
      const pol = POLICY[o.policyKey || (o.cmds[0] ? String(o.cmds[0].id).split(':')[0] : 'none')] || POLICY.none;
      return Object.assign({}, o, {
        policy: o.policyKey || (o.cmds[0] ? String(o.cmds[0].id).split(':')[0] : 'none'), polMax: pol.max, polRisk: pol.risk,
        value: { mean: r.S.value.mean, p10: r.S.value.p10, p90: r.S.value.p90 }, delta: r.delta, winRate: r.winRate, paired: r.paired,
        k: { fpy: r.S.fpy ? r.S.fpy.mean : null, packed: r.S.packed.mean, lateMin: r.S.lateMin.mean, downMin: r.S.downMin.mean, starvedMin: r.S.starvedMin.mean, kwPeak: r.S.kwPeak.mean, energyCost: r.S.energyCost.mean, demandCost: r.S.demandCost.mean, scrapCost: r.S.scrapCost.mean, nearMiss: r.S.nearMiss.mean, failures: r.S.failures.mean },
        faults: r.faults, series: { t: r.series.t, packed: r.series.packed.map(v => Math.round(v)), late: r.series.late, kw: r.series.kw, oee: r.series.oee }
      });
    });
    const base = c.options[0];
    const rows = c.options.map(o => `${o.label}: ${egp(o.value.mean - base.value.mean)} vs doing nothing (P10–P90 ${egp(o.value.p10 - base.value.mean)} to ${egp(o.value.p90 - base.value.mean)})`).slice(1).join(' · ');
    stepOf(c, 'sim', `${c.sim.futures} futures in ${(res.ms / 1000).toFixed(1)} s`, rows, { table: true });
    await pace(c);
    return res;
  }

  /* choose, check with the orchestrator, then act or wait for a person */
  async function decide(c, pick, why, opts = {}) {
    await waitRunning();
    const base = c.options[0];
    // risk-adjusted ranking: a line stop or a changeover has to earn its disruption
    const adj = o => o.value.mean - (/High/.test(o.polRisk || '') ? 6000 : /Medium/.test(o.polRisk || '') ? 1500 : 0);
    let choice = pick || c.options.slice(1).sort((a, b) => adj(b) - adj(a))[0];
    if (!choice) return;
    // an option has to beat doing nothing by a margin the futures agree on, or the agent keeps watching
    if (c.required && !pick) {
      choice = c.options.slice(1).filter(o => !/stop/i.test(o.id)).sort((a, b) => b.value.mean - a.value.mean)[0] || choice;
      stepOf(c, 'think', 'Required by the control plan', c.required + '. The correction is not optional; the futures only choose how.');
    } else if (!pick && (choice.value.mean - base.value.mean < 2500 || choice.winRate < 0.6 || (choice.paired && choice.paired.lo < 500))) {
      c.recommended = 'none'; c.value = 0;
      stepOf(c, 'decide', 'No option beats doing nothing by a clear margin', `Best option "${choice.label}" ${egp(choice.value.mean - base.value.mean)} (ahead in ${Math.round(choice.winRate * 100)}% of futures). The agent keeps watching and reopens the case if it worsens.`);
      close(c, 'Watching: no action needed', null);
      return;
    }
    c.recommended = choice.id;
    const gain = choice.value.mean - base.value.mean;
    c.value = gain;
    c.confidence = c.confidence == null ? clamp(0.5 + choice.winRate * 0.45, 0.5, 0.97) : c.confidence;
    stepOf(c, 'decide', `Recommend: ${choice.label}`, why || `Best expected result across ${c.sim ? c.sim.futures : 0} futures: ${egp(gain)} better than doing nothing, ahead in ${Math.round(choice.winRate * 100)}% of futures.`);
    await pace(c);
    // orchestrator: conflicts with other open plans, then the policy
    const others = S.cases.filter(x => x !== c && x.state !== 'closed' && x.recommended && x.recommended !== 'none');
    const lines = new Set(choice.cmds.map(cm => (String(cm.id).match(/L\d/) || [])[0]).filter(Boolean));
    const clash = others.find(x => (x.options.find(o => o.id === x.recommended) || { cmds: [] }).cmds.some(cm => lines.size && [...lines].some(l => String(cm.id).includes(l))));
    const kwUp = (choice.k.kwPeak || 0) - (base.k.kwPeak || 0);
    const notes = [];
    if (clash) notes.push(`${clash.id} also changes ${[...lines].map(lineName).join(', ')}: sequenced after it`);
    if (kwUp > 8 && P().energy.tariff === 'Peak') notes.push(`Energy agent: +${Math.round(kwUp)} kW in the peak tariff, still under contract`);
    if (choice.cmds.some(cm => String(cm.id).startsWith('boost'))) notes.push(`Quality agent: first-pass yield ${((choice.k.fpy || P().kpi.fpy || 0.99) * 100).toFixed(1)}% at 110% in the simulated futures (now ${((P().kpi.fpy || 0.99) * 100).toFixed(1)}%)`);
    const pol = choice.polMax;
    const ag = agent(c.agent);
    c.autonomy = minLevel(ag.autonomy, pol);
    stepOf(c, 'orch', notes.length ? 'Orchestrator check: ' + notes.length + ' note' + (notes.length > 1 ? 's' : '') : 'Orchestrator check: no conflicts', (notes.join(' · ') ? notes.join(' · ') + ' · ' : '') + `Policy for "${choice.label}": ${pol === 'auto' ? 'may run on its own' : pol === 'approve' ? 'needs a person\'s approval' : 'advice only'} (${choice.polRisk}). ${ag.short} agent autonomy: ${ag.autonomy === 'auto' ? 'Auto' : ag.autonomy === 'approve' ? 'Ask first' : 'Advise only'}.`, { agent: 'orch' });
    await pace(c);
    if (choice.id === 'none') { close(c, 'No action needed', true); return; }
    if (c.autonomy === 'auto' && !opts.forceApproval) return act(c, choice.id, `${ag.name} (Auto within policy)`, 'Within the agent\'s autonomy and the plant policy');
    c.state = c.autonomy === 'advise' ? 'advise' : 'awaiting';
    status(c.agent); emit('awaiting', c); sync();
  }

  async function act(c, optId, who, rationale) {
    const o = c.options.find(x => x.id === optId); if (!o) return;
    c.decision = { opt: optId, label: o.label, by: who, at: P().t, time: clockOf(P().t), rationale: rationale || '' };
    c.state = 'acting'; status(c.agent); sync();
    const ag = agent(c.agent); ag.actions++;
    for (const cm of o.cmds) {
      const cmd = Object.assign({ who: c.agent === 'safety' ? 'Safety agent' : who }, cm); delete cmd.at;
      if (cm.at) await T.exec({ type: 'at', at: P().t + cm.at, cmd, who: cmd.who }); else await T.exec(cmd);
    }
    const entry = { id: 'L-' + (S.ledger.length + 1001), t: P().t, time: clockOf(P().t), case: c.id, agent: ag.name, action: o.label, by: who, rationale: rationale || '', policy: `${o.polMax} · ${o.polRisk}`, predicted: Math.round(o.value.mean - c.options[0].value.mean), confidence: c.confidence };
    S.ledger.unshift(entry);
    T.exec({ type: 'note', who, action: 'Agent decision', detail: `${c.id} · ${o.label}${rationale ? ' · ' + rationale : ''}`, extra: { case: c.id } });
    stepOf(c, 'act', `${o.label} · ${who}`, rationale ? `Reason: ${rationale}` : '');
    c.state = 'verifying'; c.verify = { from: P().t, checks: [], predicted: o.k, base: c.options[0].k, until: P().t + ((PLAYBOOKS[c.kind] && PLAYBOOKS[c.kind].verifyFor) || Math.min(c.sim ? c.sim.horizon : 1800, 1800)) };
    status(c.agent); emit('acted', c); sync();
  }
  function close(c, verdict, ok, extra) {
    c.state = 'closed'; c.closed = P().t; c.outcome = Object.assign({ verdict, ok }, extra);
    const a = agent(c.agent);
    if (c.verify && ok !== null) { a.verified++; if (ok) a.accurate++; }
    if (c.decision && ok) { a.value += c.value || 0; S.value += c.value || 0; }
    S.memory.unshift({ id: c.id, when: 'Today ' + clockOf(c.created), kind: c.kind, kindOf: c.kindOf, factor: c.factor, sig: c.sig, title: c.title, cause: c.diagnosis ? c.diagnosis.cause : '', fix: c.decision ? c.decision.label : 'No action', outcome: verdict, live: true });
    status(c.agent); emit('closed', c); sync();
  }
  // a person (or the copilot after a person's confirmation) decides
  function approve(caseId, optId, rationale, who = 'You') {
    if (!S.host) { T.broadcast({ kind: 'agents-cmd', op: 'approve', caseId, optId, rationale, who }); return; }
    const c = caseById(caseId); if (!c || (c.state !== 'awaiting' && c.state !== 'advise')) return;
    act(c, optId || c.recommended, who, rationale || (optId && optId !== c.recommended ? 'Chose a different option than recommended' : 'Approved as recommended'));
  }
  function reject(caseId, rationale, who = 'You') {
    if (!S.host) { T.broadcast({ kind: 'agents-cmd', op: 'reject', caseId, rationale, who }); return; }
    const c = caseById(caseId); if (!c || c.state === 'closed') return;
    c.decision = { opt: 'none', label: 'Rejected', by: who, at: P().t, time: clockOf(P().t), rationale: rationale || '' };
    S.ledger.unshift({ id: 'L-' + (S.ledger.length + 1001), t: P().t, time: clockOf(P().t), case: c.id, agent: agent(c.agent).name, action: 'Rejected the recommendation', by: who, rationale: rationale || '', policy: '—', predicted: 0 });
    T.exec({ type: 'note', who, action: 'Rejected agent recommendation', detail: `${c.id} · ${rationale || 'no reason given'}` });
    stepOf(c, 'act', `Rejected by ${who}`, rationale ? `Reason: ${rationale}` : '');
    close(c, 'Rejected by a person', null);
  }
  function setAutonomy(id, level, who = 'You') {
    if (!S.host) { T.broadcast({ kind: 'agents-cmd', op: 'autonomy', id, level, who }); return; }
    const a = agent(id); if (!a || a.locked) return;
    a.autonomy = level;
    T.exec({ type: 'note', who, action: 'Changed autonomy', detail: `${a.name} → ${level === 'auto' ? 'Auto (within policy)' : level === 'approve' ? 'Ask first' : 'Advise only'}` });
    sync();
  }

  /* ---------------- verification ---------------- */
  function verifyTick() {
    for (const c of S.cases) {
      if (c.state !== 'verifying' || !c.verify) continue;
      const pb = PLAYBOOKS[c.kind];
      const r = pb && pb.verify ? pb.verify(c) : null;
      if (r && r.done) { stepOf(c, 'verify', r.title, r.detail); close(c, r.title, r.ok, { detail: r.detail }); }
      else if (P().t > c.verify.until + 60) { stepOf(c, 'verify', 'Verification window ended', r && r.detail || ''); close(c, 'Verified at the end of the window', r ? r.ok !== false : true); }
    }
  }

  /* ---------------- detection ---------------- */
  const cool = new Map();          // key → plant time when the key may open a new case
  const open = key => S.cases.find(c => c.key === key && c.state !== 'closed');
  function may(key) { return !open(key) && (cool.get(key) || 0) < P().t; }
  function start(kind, o) {
    const key = o.key; cool.set(key, P().t + (o.cool || 900));
    const c = newCase(Object.assign({ kind, agent: PLAYBOOKS[kind].agent }, o));
    PLAYBOOKS[kind].run(c, ctx(c)).catch(err => { console.error(err); stepOf(c, 'think', 'Investigation stopped', String(err && err.message || err)); close(c, 'Stopped', null); });
    return c;
  }
  const spcBase = { L1: 0.012, L2: 0.016 };
  const memo = { spcHits: { L1: 0, L2: 0 }, takt: {} };
  function detect() {
    const p = P(), E0 = E();
    // maintenance: vibration trend on rotating machines
    for (const s of p.stations) {
      if (!(s.kind === 'mounter' || s.kind === 'robot' || s.kind === 'palletizer')) continue;
      const v = s.hist.vib; if (!v || v.length < 30 || s.state === 'maint' || s.state === 'down') continue;
      const run = v.slice(-40).filter(x => x > 0.6).slice(-30);   // running samples only: a restart is not a trend
      if (run.length < 26) continue;
      const r = linreg(run, 5 / 60);        // per minute
      if (r.slope > 0.035 && r.last > 2.5 && r.r2 > 0.45 && may('wear:' + s.id)) start('wear', { key: 'wear:' + s.id, ref: 'st:' + s.id, station: s.id, title: `${s.name} vibration rising on ${lineName(s.line)}`, sig: { slope: r.slope * 10, vib: r.last }, kindOf: s.kind, sev: 'warn', cool: 3600 });
    }
    for (const s of p.stations) if (s.state === 'down' && s.fault && !s.planned && s.fault.repair > 600 && /servo|vacuum|worn|sensor|torque/i.test(s.fault.why) && may('fault:' + s.id)) start('fault', { key: 'fault:' + s.id, ref: 'st:' + s.id, station: s.id, title: `${s.name} stopped: ${s.fault.why.toLowerCase()}`, sev: 'crit', cool: 1800 });
    // quality: process parameters drifting before defects show (oven zone 5 against its 228 °C setpoint)
    for (const line of ['L1', 'L2']) {
      const z = (p.byId[line + '-Reflow'].hist.z5 || []).slice(-24).filter(v => v > 150);
      if (z.length < 20 || p.lines[line].tripped) continue;
      const dev = mean(z.slice(-8)) - 228 + (p.lines[line].profile || 0), r = linreg(z, 5 / 60);
      if (Math.abs(dev) > 3 && may('spc:' + line)) start('spc', { key: 'spc:' + line, ref: 'st:' + line + '-Reflow', line, mode: 'process', title: `${lineName(line)} oven zone 5 ${dev > 0 ? '+' : ''}${dev.toFixed(1)} °C off setpoint`, sig: { dev, slope: r.slope }, sev: 'warn', cool: 2400 });
    }
    // quality: AOI p-chart per SMT line
    for (const line of ['L1', 'L2']) {
      const rows = p.aoiLog[line].slice(-80);
      if (rows.length < 60) continue;
      const bad = rows.filter(r => !r.ok).length, rate = bad / rows.length, p0 = spcBase[line];
      const ucl = p0 + 3 * Math.sqrt(p0 * (1 - p0) / rows.length);
      memo.spcHits[line] = rate > ucl && bad >= 3 ? memo.spcHits[line] + 1 : 0;
      if (memo.spcHits[line] >= 2 && may('spc:' + line)) start('spc', { key: 'spc:' + line, ref: 'st:' + line + '-AOI', line, title: `AOI rejects out of control on ${lineName(line)}`, sig: { rate, ucl }, sev: 'warn', cool: 2400 });
    }
    // quality: TV test failures clustered on one lot, significant against the normal fail rate (binomial tail)
    {
      const rows = p.testLog.filter(r => r.type === 'tv' && p.t - r.t < 2400), fails = rows.filter(r => !r.ok);
      if (fails.length >= 3) {
        const by = {}; fails.forEach(r => { by[r.lot] = (by[r.lot] || 0) + 1; });
        const [lot, n] = Object.entries(by).sort((a, b) => b[1] - a[1])[0];
        const tested = rows.filter(r => r.lot === lot).length;
        const pv = binomTail(n, tested, 0.012);
        if (lot && lot !== 'null' && n >= 3 && pv < 0.002 && !(p.scen.lot && p.scen.lot.quarantined && p.scen.lot.lot === lot) && may('lot:' + lot)) start('lot', { key: 'lot:' + lot, ref: 'st:L5-QC', lot, pv, title: `TV screen failures cluster on panel lot ${lot}`, sev: 'crit', cool: 3600 });
      }
    }
    // logistics: line-side runway against the next delivery
    for (const b of Object.values(E0.LS)) {
      const rw = E0.runway(b), m = b.mission;
      const stuck = m && m.agv && m.agv.fault;
      const eta = m ? (m.agv && !stuck ? Math.max(0, (m.eta || p.t) - p.t) : 400) : Infinity;
      if (m && (!m.agv || stuck || eta > rw) && rw < 480 && rw < eta + 60 && may('stock:' + b.id)) start('stock', { key: 'stock:' + b.id, ref: 'buf:' + b.id, buf: b.id, title: rw < 30 ? `${sname(b.station)} is out of ${lc(b.label)}` : `${sname(b.station)} runs out of ${lc(b.label)} in ${mins(rw)}`, eta: rw, sev: rw < 180 ? 'crit' : 'warn', cool: 600 });
    }
    for (const a of p.agvs) if (a.fault && a.load && may('agv:' + a.id)) start('agv', { key: 'agv:' + a.id, ref: 'agv:' + a.id, agv: a.id, title: `${a.id} stopped on the aisle with a load`, sev: 'warn', cool: 900 });
    // planning: board supermarket when its feeder line is not running
    {
      const b = E0.SM.main, feeders = ['L1', 'L2'].filter(id => (p.lines[id].prodOverride || p.lines[id].product) === 'main');
      const fed = feeders.some(id => p.lines[id].state === 'run' || p.lines[id].state === 'warn');
      const l1 = p.lines.L1, downSt = l1.stations.find(s => s.state === 'down');
      if (!fed && downSt && downSt.repair > b.rw * 0.4 && b.rw < 2700 && may('boards')) start('boards', { key: 'boards', ref: 'buf:SM:main', title: `Main boards run out for assembly in ${mins(b.rw)}`, eta: b.rw, sev: 'crit', cool: 1800 });
      if (p.lines.L2.prodOverride && p.lines.L1.state === 'run' && b.items.length > 90 && may('switchBack')) start('switchBack', { key: 'switchBack', ref: 'st:L2-Loader', title: 'SMT Line 1 is back: return Line 2 to power boards', sev: 'info', cool: 1800 });
    }
    // planning: orders at risk
    for (const o of p.orders) {
      if ((o.state !== 'open' && o.state !== 'loading') || o.agreed) continue;
      if (o.risk > 600 && o.due - p.t < 3 * 3600 && o.due - p.t > 900 && !p.lines[o.product === 'tv' ? 'L3' : 'L4'].boosted && may('order:' + o.id)) start('order', { key: 'order:' + o.id, ref: 'order:' + o.id, order: o.id, title: `Order ${o.id} (${o.customer}) heading ${mins(o.risk)} late`, sev: o.risk > 1800 ? 'crit' : 'warn', cool: 2700 });
    }
    // planning: a station on an assembly line slower than takt with its operator away
    for (const line of ['L3', 'L4']) {
      for (const s of p.lines[line].stations) {
        const slow = s.gapEma > E0.TAKT[line] * 1.15 && s.speedMul > 1.2 && s.state !== 'down';
        memo.takt[s.id] = slow ? (memo.takt[s.id] || 0) + 1 : 0;
        if (memo.takt[s.id] >= 4 && may('takt:' + s.id)) start('takt', { key: 'takt:' + s.id, ref: 'st:' + s.id, station: s.id, line, title: `${s.name} is now the ${line === 'L3' ? 'TV' : 'phone'} line bottleneck`, sev: 'warn', cool: 2400 });
      }
    }
    // planning: delayed inbound material
    for (const tr of p.inbound) if (tr.delayed && tr.mat === 'panel' && tr.state === 'due' && (p.panelCover || 0) < tr.at - p.t && may('inbound:' + tr.id)) start('inbound', { key: 'inbound:' + tr.id, ref: 'buf:RM:panel', truck: tr.id, title: `TV panels run out before delayed truck ${tr.id}`, eta: p.panelCover, sev: 'crit', cool: 3600 });
    // energy: demand against the contract in the peak tariff, grid trip, heat
    const kw = p.kpi.kw || 0, fkw = kw + Math.max(0, (p.util.kwTarget || 0) - (p.util.kw || 0));
    if ((p.energy.proj > p.energy.contract * 0.97 || fkw > p.energy.contract * 1.0) && may('peak')) start('peak', { key: 'peak', ref: 'util:UTIL-CH2', title: `Demand heading to ${Math.round(fkw)} kW, over the ${p.energy.contract} kW contract`, sev: 'warn', cool: 2400 });
    if ((p.lines.L1.tripped || p.lines.L2.tripped) && may('power')) start('power', { key: 'power', ref: 'util:UTIL-TX', title: 'Grid dip tripped both SMT lines', eta: 60, sev: 'crit', cool: 900 });
    if ((p.util.heatTarget || 0) > 0 && may('heat')) start('heat', { key: 'heat', ref: 'util:UTIL-CH1', title: 'Heat wave: 41 °C expected this afternoon', sev: 'warn', cool: 4 * 3600 });
  }

  // the safety agent does not wait for the detection loop: it reacts inside the frame that shows the person
  function safetyWatch() {
    if (!S.host || !T.E) return;
    for (const s of P().stations) if (s.intrusion && !s.safe && may('safety:' + s.id)) start('safety', { key: 'safety:' + s.id, ref: 'st:' + s.id, station: s.id, title: `Person inside the ${s.name.toLowerCase()} cell on ${lineName(s.line)}`, eta: 1, sev: 'crit', cool: 300 });
  }

  /* ---------------- playbooks ---------------- */
  const opt = (id, label, cmds, why, extra) => Object.assign({ id, label, cmds, why }, extra);
  const PLAYBOOKS = {
    wear: {
      agent: 'maint',
      async run(c, x) {
        const s = P().byId[c.station];
        const h = TOOLS.history({ id: s.id, series: 'vib', minutes: 15 });
        x.evidence({ kind: 'series', label: `${s.name} vibration (mm/s RMS)`, values: h.values, unit: 'mm/s', limit: 4.5, limit2: 7.1 });
        await x.observe(`Vibration ${h.last.toFixed(2)} mm/s and rising ${(h.slopePerMin * 60).toFixed(1)} mm/s per hour`, `Trend test on ${uns(s, 'vib')}: ${h.samples} samples, r² ${h.r2}. Normal band for this mounter is 1.4–2.0 mm/s.`);
        const t = await x.tool('history', { id: s.id, series: 'temp', minutes: 15 }, r => `Spindle temperature ${r.last.toFixed(1)} °C, ${r.slopePerMin > 0 ? '+' : ''}${(r.slopePerMin * 60).toFixed(1)} °C per hour`);
        const vac = await x.tool('history', { id: s.id, series: 'vac', minutes: 15 }, r => `Vacuum ${r.last.toFixed(1)} kPa, ${Math.abs(r.last + 78) < 5 ? 'inside its normal band: no leak signature' : 'drifting'}`);
        void vac;
        const m = await x.memory('wear', c.sig);
        // remaining useful life to zone D (failure seen at about 7.2 mm/s on this machine class)
        const r = linreg((s.hist.vib || []).slice(-44).filter(v => v > 0.6).slice(-36), 5 / 60);
        const left = Math.max(0, 7.2 - r.last), sl = Math.max(1e-4, r.slope);
        const p50 = left / sl, lo = left / (sl + 1.64 * r.se), hi = left / Math.max(1e-4, sl - 1.64 * r.se);   // minutes
        c.diagnosis = { cause: 'Spindle bearing wear', text: `Vibration and temperature rise together while vacuum is stable: the signature of a bearing, not the nozzle or feeder.`, confidence: clamp(0.55 + r.r2 * 0.3 + (m ? m.sim * 0.12 : 0), 0.5, 0.95), rul: { p50, p10: Math.min(lo, p50), p90: Math.max(p50, Math.min(hi, p50 * 3)) } };
        c.chain = ['st:' + s.id, 'line:' + s.line, 'buf:SM:main', 'line:L3', 'line:L4'];
        await x.think(`Diagnosis: spindle bearing wear (${Math.round(c.diagnosis.confidence * 100)}% confidence)`, `${c.diagnosis.text} Remaining life to zone D: about ${mins(p50 * 60)} (P10 ${mins(c.diagnosis.rul.p10 * 60)}, P90 ${mins(c.diagnosis.rul.p90 * 60)}). Temperature trend ${t.slopePerMin > 0 ? 'confirms' : 'does not contradict'} it.`);
        const sp = await x.tool('spares', { part: 'Spindle bearing 6204-2RS' }, r => `${r.qty} in stock, bin ${r.bin}`);
        const tech = await x.tool('technicians', {}, r => r.map(t => `${t.name}: ${t.state}`).join(' · '));
        void sp; void tech;
        const sm = E().SM.main;
        await x.handoff('planner', 'Planning agent: impact if it fails', `A breakdown means about 35 min down. The main-board supermarket (${sm.items.length} boards + ${sm.lineSide || 0} at the lines) covers ${mins(sm.rw)} of assembly demand, so a long stop would starve both assembly lines.`);
        if (c.diagnosis.rul.p10 > 360) {
          await x.think('Not yet actionable', `Remaining life is at least ${mins(c.diagnosis.rul.p10 * 60)} with 90% confidence. The agent keeps watching and plans the change into the next scheduled stop.`);
          close(c, 'Watching: change planned for the next stop', null); return;
        }
        const horizon = clamp(p50 * 60 * 1.35 + 900, 2100, 4500);
        await x.simulate([
          opt('now', 'Plan the bearing change now (8 min)', [{ type: 'apply', id: 'planRepair:' + s.id }], 'Stop now while the supermarket covers it'),
          opt('later', 'Change it in 15 min', [{ at: 900, type: 'apply', id: 'planRepair:' + s.id }], 'Wait for a natural gap'),
          opt('derate', 'Derate to 85% and run on', [{ type: 'apply', id: 'derate:' + s.id }], 'Slows the wear; defers the stop')
        ], { horizon, seeds: 3 });
        await decide(c);
      },
      verify(c) {
        const s = P().byId[c.station], d = c.decision;
        if (s.state === 'down') return { done: true, ok: false, title: `${s.name} failed after the action`, detail: 'The prediction was wrong; added to memory with the outcome.' };
        if (d && d.opt !== 'derate' && s.repairs && s.state !== 'maint' && s.sens.vib < 2.6 && P().t - c.verify.from > 300) {
          const downMin = (P().t - c.verify.from) / 60;
          return { done: true, ok: true, title: `Bearing changed · vibration ${s.sens.vib.toFixed(1)} mm/s`, detail: `Back in production at ${clockOf(P().t)}. Predicted downtime ${c.verify.predicted.downMin.toFixed(0)} min across the plant in the window; the breakdown it replaced would have cost about 35 min.` + (downMin ? '' : '') };
        }
        if (d && d.opt === 'derate' && P().t - c.verify.from > 900) return { done: true, ok: s.state !== 'down', title: `${s.name} running derated · ${s.sens.vib.toFixed(1)} mm/s`, detail: 'Wear rate roughly halved. Schedule the change in the next planned stop.' };
        return null;
      }
    },
    fault: {
      agent: 'maint',
      async run(c, x) {
        const s = P().byId[c.station];
        const group = P().alarms.filter(a => (a.ref === s.id || (a.area === lineName(s.line) && Math.abs(a.t - s.fault.at) < 180)) && Math.abs(a.t - s.fault.at) < 240);
        group.forEach(a => { a.case = c.id; });
        await x.observe(`${s.name} stopped at ${clockOf(s.fault.at)}: ${s.fault.why}`, group.length > 3 ? `${group.length} alarms in ${Math.max(1, Math.round((Math.max(...group.map(a => a.t)) - Math.min(...group.map(a => a.t))) / 60))} min grouped into this one incident. First-out alarm: ${s.name} ${s.fault.why.toLowerCase()}; the rest follow from it (ISA-18.2 flood suppression).` : `Raised by the PLC; CMMS dispatched a technician.`);
        const st = await x.tool('station', { id: s.id }, r => `State ${r.state}, cycle ${r.cycleS} s, ${r.made} made today`);
        void st;
        const part = s.kind === 'robot' ? 'Servo drive SD-400' : s.kind === 'mounter' ? 'Vacuum pump seal kit' : 'Torque sensor kit';
        await x.tool('spares', { part }, r => `${r.part}: ${r.qty} in stock${r.bin ? ', bin ' + r.bin : ''}`);
        await x.tool('technicians', {}, r => r.map(t => `${t.name}: ${t.state}${t.job ? ' at ' + t.job : ''}`).join(' · '));
        c.diagnosis = { cause: s.fault.why, text: s.kind === 'robot' ? 'Servo amplifier alarm with torque high on axis 3: a drive fault, not a mechanical crash (no collision torque spike).' : 'Fault code from the machine controller.', confidence: 0.82 };
        c.chain = ['st:' + s.id, 'line:' + s.line];
        await x.think(`Diagnosis: ${c.diagnosis.cause}`, `${c.diagnosis.text} Standard repair: technician diagnoses on site, then fetches parts (about ${mins(s.repair)}).`);
        await x.handoff('planner', 'Planning agent: line impact', `${lineName(s.line)} produces ${Math.round(P().lines[s.line].tph || 0)} an hour; open orders for this product: ${P().orders.filter(o => o.product === (s.line === 'L4' ? 'phone' : 'tv') && o.state === 'open').map(o => o.id).join(', ') || 'none'}.`);
        await x.simulate([opt('kit', 'Send the technician with the parts kit', [{ type: 'apply', id: 'dispatchTech:' + s.id }], 'Swap the servo drive now: about 7 min')], { horizon: 2400, seeds: 2 });
        await decide(c);
      },
      verify(c) { const s = P().byId[c.station]; if (s.state !== 'down') return { done: true, ok: true, title: `${s.name} running again at ${clockOf(P().t)}`, detail: `Repair took ${mins(P().t - c.verify.from)} after the decision.` }; return null; }
    },
    spc: {
      agent: 'quality',
      async run(c, x) {
        const a = TOOLS.aoi_analysis({ line: c.line, boards: 120 });
        const rows = P().aoiLog[c.line].slice(-120);
        if (c.mode === 'process') {
          const oven0 = P().byId[c.line + '-Reflow'];
          const z0 = TOOLS.history({ id: oven0.id, series: 'z5', minutes: 15 });
          x.evidence({ kind: 'series', label: 'Oven zone 5 temperature (°C), setpoint 228', values: z0.values, unit: '°C', limit: 231 });
          await x.observe(c.title, `Statistical process control on ${uns(oven0, 'zone5')}: ${z0.samples} samples, ${z0.slopePerMin > 0 ? '+' : ''}${(z0.slopePerMin * 60).toFixed(1)} °C per hour. AOI rejects so far ${(a.rate * 100).toFixed(1)}% (normal ${(spcBase[c.line] * 100).toFixed(1)}%): the defects have not caught up yet.`);
        }
        const roll = []; for (let i = 20; i <= rows.length; i += 5) { const w = rows.slice(i - 20, i); roll.push(w.filter(r => !r.ok).length / w.length * 100); }
        x.evidence({ kind: 'series', label: `AOI reject rate, last ${rows.length} boards (%)`, values: down(roll, 24), unit: '%', limit: (spcBase[c.line] + 3 * Math.sqrt(spcBase[c.line] * (1 - spcBase[c.line]) / 80)) * 100 });
        if (c.mode !== 'process') await x.observe(`AOI rejects ${(a.rate * 100).toFixed(1)}% over the last ${a.boards} boards`, `p-chart: normal ${(spcBase[c.line] * 100).toFixed(1)}%, upper control limit ${((spcBase[c.line] + 3 * Math.sqrt(spcBase[c.line] * (1 - spcBase[c.line]) / 80)) * 100).toFixed(1)}%. Defects: ${Object.entries(a.defects).map(([k, n]) => `${k} ${n}`).join(', ')}.`);
        await x.tool('aoi_analysis', { line: c.line, boards: 120 }, r => Object.entries(r.factors).map(([k, f]) => `${{ z5: 'oven zone 5', peak: 'peak temp', spi: 'paste volume', paste: 'paste temp', vib: 'mounter vibration' }[k]} r=${f.r}`).join(' · '));
        const ranked = Object.entries(a.factors).sort((p, q) => Math.abs(q[1].r) - Math.abs(p[1].r));
        let [top, f] = ranked[0];
        if (c.mode === 'process' && (Math.abs(f.r) < 0.15 || top === 'spi' || top === 'paste')) { top = 'z5'; f = a.factors.z5; }
        c.factor = top;
        x.evidence({ kind: 'bars', label: 'Link between each process value and a reject (point-biserial r)', bars: ranked.map(([k, v]) => ({ k: { z5: 'Oven zone 5', peak: 'Oven peak', spi: 'Paste volume', paste: 'Paste temp', vib: 'Mounter vibration' }[k], v: v.r })) });
        if (top === 'vib' && c.mode !== 'process') {
          c.diagnosis = { cause: 'Placement errors from a vibrating mounter', text: 'Rejected boards went through a mounter vibrating above 4.5 mm/s.', confidence: 0.78 };
          await x.think('Diagnosis: the defects come from mounter vibration, not the oven', c.diagnosis.text);
          await x.handoff('maint', 'Handed to the Maintenance agent', 'The mounter case owns the fix; this case closes when the defects stop.');
          close(c, 'Handed to maintenance', true); return;
        }
        const oven = P().byId[c.line + '-Reflow'];
        const z = TOOLS.history({ id: oven.id, series: 'z5', minutes: 15 });
        if (c.mode !== 'process') x.evidence({ kind: 'series', label: 'Oven zone 5 temperature (°C), setpoint 228', values: z.values, unit: '°C', limit: 231 });
        await x.tool('history', { id: oven.id, series: 'z5', minutes: 15 }, r => `Zone 5 at ${r.last.toFixed(1)} °C, ${(r.slopePerMin * 60).toFixed(1)} °C per hour, setpoint 228 °C`);
        const m = await x.memory('spc', { factor: top });
        void m;
        const hot = top === 'z5' || top === 'peak';
        const linked = isFinite(f.rejected) && isFinite(f.passed) && Math.abs(f.r) >= 0.15;
        c.diagnosis = { cause: hot ? (P().scen.reflow ? 'Reflow oven zone 5 drifting hot' : 'Ovens running warm with the ambient') : 'Solder paste deposit',
          text: linked ? `Rejected boards ran ${(f.rejected - f.passed).toFixed(1)} ${hot ? '°C hotter in zone 5' : 'units apart'} than passed boards (r = ${f.r}); paste volume and mounter vibration show no link.` : `Zone 5 is ${(z.last - 228 + (P().lines[c.line].profile || 0)).toFixed(1)} °C off its setpoint. Past cases show solder bridges follow within 15–30 minutes.`,
          confidence: clamp(0.55 + Math.abs(f.r || 0) * 0.6 + (c.mode === 'process' ? 0.15 : 0), 0.6, 0.95) };
        c.chain = ['st:' + oven.id, 'st:' + c.line + '-AOI', 'buf:SM:power', 'line:L3'];
        await x.think(`Root cause: ${c.diagnosis.cause.toLowerCase()} (${Math.round(c.diagnosis.confidence * 100)}%)`, c.diagnosis.text + ' Solder bridges dominate, which is what a hot zone 5 produces.');
        const drift = !!P().scen.reflow;
        await x.simulate([
          drift ? opt('fix', 'Correct the zone 5 setpoint (no stop)', [{ type: 'apply', id: 'fixReflow' }], 'Inside the validated process window')
            : opt('fix', 'Lower both oven profiles 3 °C', [{ type: 'apply', id: 'reflowProfile' }], 'The ovens run warm with the ambient'),
          opt('stop', 'Stop the line 10 min and inspect', [{ type: 'apply', id: 'stopInspect:' + c.line }], 'Conservative: inspect before running on')
        ], { horizon: 2400, seeds: 3 });
        const devNow = mean((oven.hist.z5 || []).slice(-6)) - 228 + (P().lines[c.line].profile || 0);
        if (Math.abs(devNow) > 5) c.required = `Control plan: zone 5 must stay within ±5 °C of its setpoint (now ${devNow > 0 ? '+' : ''}${devNow.toFixed(1)} °C)`;
        await decide(c);
      },
      verify(c) {
        const rows = P().aoiLog[c.line].filter(r => r.t > c.verify.from + 240);
        if (rows.length >= 40) { const rate = rows.filter(r => !r.ok).length / rows.length; return { done: true, ok: rate < 0.035, title: `AOI rejects ${(rate * 100).toFixed(1)}% on the next ${rows.length} boards`, detail: rate < 0.035 ? 'Back inside the control limits.' : 'Still out of control: escalated to the process engineer.' }; }
        return null;
      }
    },
    lot: {
      agent: 'quality',
      async run(c, x) {
        const t = TOOLS.test_analysis({ minutes: 40 });
        x.evidence({ kind: 'bars', label: 'TV test fail rate by panel lot (last 40 min)', bars: t.byLot.slice(0, 5).map(l => ({ k: l.lot, v: l.rate })) });
        await x.observe(`${t.failed} TVs failed the screen test in 40 min`, 'Dead-pixel clusters at the function test and the final QC camera.');
        const lotRow = t.byLot.find(l => l.lot === c.lot) || { rate: 0, failed: 0, tested: 0 };
        const other = t.byLot.filter(l => l.lot !== c.lot);
        const oRate = other.reduce((a, l) => a + l.failed, 0) / Math.max(1, other.reduce((a, l) => a + l.tested, 0));
        await x.tool('test_analysis', { minutes: 40 }, r => r.byLot.slice(0, 4).map(l => `${l.lot}: ${l.failed}/${l.tested} failed`).join(' · '));
        const loc = await x.tool('lot_location', { lot: c.lot }, r => `Lot ${r.lot}: ${r.lineSide} at Panel load, ${r.warehouse} in the warehouse, ${r.inProcess} TVs in process, ${r.packed} packed`);
        await x.memory('lot', null);
        c.diagnosis = { cause: `Panel lot ${c.lot} (Supplier B)`, text: `The failures carry lot ${c.lot}: ${(lotRow.rate * 100).toFixed(0)}% fail rate against ${(oRate * 100).toFixed(1)}% for other lots and about 1.2% normally (binomial p ${c.pv < 1e-4 ? '< 0.0001' : c.pv.toFixed(4)}). The genealogy rules out the boards and the assembly stations.`, confidence: clamp(0.8 + (c.pv < 1e-4 ? 0.15 : 0.08), 0.8, 0.96) };
        c.chain = ['buf:RM:panel', 'buf:LS:L3panel', 'st:L3-Panelload', 'st:L3-Functiontest', 'st:L5-QC', 'st:REWORK'];
        await x.think(`Root cause: panel lot ${c.lot}`, c.diagnosis.text + ` ${loc.lineSide + loc.warehouse} panels of it are still waiting to be built in.`);
        await x.simulate([
          opt('quarantine', `Quarantine lot ${c.lot}`, [{ type: 'apply', id: 'quarantine' }], 'Block it and pull the next lot; raises a supplier claim'),
          opt('inspect', '100% check of the lot at Panel load', [{ type: 'apply', id: 'inspectLot' }], 'Keeps using the lot, catches most bad panels, slows the line')
        ], { horizon: 3000, seeds: 3 });
        await decide(c);
      },
      verify(c) {
        const fails = P().testLog.filter(r => r.t > c.verify.from + 600 && !r.ok && r.lot === c.lot).length;
        if (P().t - c.verify.from > 1500) return { done: true, ok: fails === 0, title: fails ? `${fails} more failures from lot ${c.lot}` : `No new failures from lot ${c.lot} in 25 min`, detail: 'Test FPY tracked against the prediction.' };
        return null;
      }
    },
    stock: {
      agent: 'logistics',
      async run(c, x) {
        const b = P().bufs[c.buf];
        await x.observe(c.title, `${Math.round(E().level(b))} ${b.unit} left, using ${(b.rate * 60).toFixed(1)} a minute.`);
        await x.tool('stock', { id: b.id }, r => `Runway ${r.runwayMin} min · delivery: ${r.delivery || 'none planned'}`);
        await x.tool('agv_fleet', {}, r => r.map(a => `${a.id} ${a.mission ? 'busy' : a.state}`).join(' · '));
        c.chain = ['buf:' + b.id, 'st:' + b.station, 'line:' + b.line];
        c.diagnosis = { cause: 'Delivery later than the runway', text: 'All AGVs are busy or the assigned one is stuck; the next free AGV arrives after the station runs dry.', confidence: 0.9 };
        await x.simulate([
          opt('expedite', 'Pre-empt an AGV and deliver now', [{ type: 'apply', id: 'expedite:' + b.id }], 'Takes the least urgent mission that has not picked up yet'),
          opt('fetch', 'Operator fetches a half batch by hand', [{ type: 'apply', id: 'manualFetch:' + b.id }], 'Operator away 6 min')
        ], { horizon: 1500, seeds: 2 });
        await decide(c);
      },
      verify(c) { const b = P().bufs[c.buf]; if (!b.mission || (b.deliveries && P().t - c.verify.from > 120)) { const s = P().byId[b.station]; return { done: true, ok: s.state !== 'starved', title: s.state === 'starved' ? `${s.name} starved briefly` : `Delivered: ${s.name} never stopped`, detail: `Stock now ${Math.round(E().level(b))} ${b.unit}.` }; } return null; }
    },
    agv: {
      agent: 'logistics',
      async run(c, x) {
        const a = P().agvs.find(v => v.id === c.agv); const m = a.mission;
        await x.observe(`${a.id}: ${a.fault}`, `Carrying ${a.load ? a.load.qty + ' ' + a.load.label.toLowerCase() : 'nothing'}${m ? ' for ' + sname(m.buf.station) : ''}. Vendor recovery takes about 7 min.`);
        await x.tool('agv_fleet', {}, r => r.map(v => `${v.id} ${v.fault ? 'FAULT' : v.mission ? 'busy' : v.state} ${v.battery}%`).join(' · '));
        await x.tool('spares', { part: 'AGV drive motor' }, r => `${r.part}: ${r.qty} in stock`);
        c.chain = ['agv:' + a.id].concat(m ? ['buf:' + m.buf.id, 'st:' + m.buf.station] : []);
        c.diagnosis = { cause: 'Drive motor overcurrent', text: 'The load it carries is the next delivery for a line.', confidence: 0.88 };
        if (!m) { close(c, 'No delivery affected', true); return; }
        await x.simulate([opt('resend', 'Send another AGV with a fresh batch', [{ type: 'apply', id: 'expedite:' + m.buf.id }], 'The stuck load goes back to stock when recovered')], { horizon: 1500, seeds: 2 });
        await decide(c);
      },
      verify(c) { const a = P().agvs.find(v => v.id === c.agv); if (!a.fault || P().t - c.verify.from > 600) return { done: true, ok: true, title: 'Delivery covered by another AGV', detail: a.fault ? `${a.id} still waiting for recovery.` : `${a.id} recovered.` }; return null; }
    },
    boards: {
      agent: 'planner',
      async run(c, x) {
        const b = E().SM.main;
        await x.observe(c.title, `SMT Line 1 is down; ${b.items.length} boards in the supermarket and ${b.lineSide} at the lines; assembly needs ${Math.round(b.demand)} an hour.`);
        await x.tool('line_status', { line: 'L1' }, r => `SMT Line 1: ${r.state}`);
        await x.tool('stock', { id: 'SM:power' }, r => `Power boards: ${r.level} (covers the TV line without Line 2 for a while)`);
        c.chain = ['line:L1', 'buf:SM:main', 'line:L3', 'line:L4'];
        c.diagnosis = { cause: 'Main-board supply stopped', text: 'Both assembly lines use main boards; only SMT Line 1 makes them.', confidence: 0.9 };
        await x.simulate([
          opt('switch', 'Switch SMT Line 2 to main boards', [{ type: 'apply', id: 'switchL2' }], '4-minute changeover, then about 100 boards an hour'),
          opt('slow', 'Slow both assembly lines to 88%', [{ type: 'apply', id: 'slowAssembly' }], 'Stretches the stock')
        ], { horizon: 3000, seeds: 2 });
        await decide(c);
      },
      verify(c) { if (P().t - c.verify.from > 1200) { const st = ['L3', 'L4'].some(l => P().lines[l].state === 'starved'); return { done: true, ok: !st, title: st ? 'An assembly line starved' : 'Assembly kept running', detail: `${E().SM.main.items.length} main boards in the supermarket.` }; } return null; }
    },
    switchBack: {
      agent: 'planner',
      async run(c, x) {
        await x.observe(c.title, `Main boards recovering: ${E().SM.main.items.length} in the supermarket. Power boards: ${E().SM.power.items.length}.`);
        await x.simulate([opt('back', 'Switch Line 2 back to power boards', [{ type: 'apply', id: 'switchBack' }], 'Restores the normal mix')], { horizon: 2400, seeds: 2 });
        await decide(c);
      },
      verify() { return { done: true, ok: true, title: 'Line 2 back on power boards', detail: '' }; }
    },
    order: {
      agent: 'planner',
      async run(c, x) {
        const o = P().orders.find(v => v.id === c.order);
        const L = o.product === 'tv' ? 'L3' : 'L4';
        await x.observe(c.title, `${o.qty - o.shipped} ${o.product === 'tv' ? 'TVs' : 'phones'} due ${clockOf(o.due)}; at the current rate the last pallet is ready ${clockOf(o.eta)}.`);
        await x.tool('orders', {}, r => r.filter(v => v.state === 'open').slice(0, 4).map(v => `${v.id} due ${v.due}${v.lateMin ? ' late ' + v.lateMin + ' min' : ''}`).join(' · '));
        await x.tool('line_status', { line: L }, r => `${r.name}: ${r.perHour}/h at ${Math.round(r.speed * 100)}%`);
        c.chain = ['line:' + L, 'st:L5-Burnin', 'st:L5-Packing', 'order:' + o.id];
        c.diagnosis = { cause: o.earlier ? 'Earlier orders ahead in the queue' : 'Line rate below the plan', text: `${o.earlier || 0} units for earlier orders come first.`, confidence: 0.8 };
        await x.memory('order', null);
        const opts = [opt('boost', `Run ${lineName(L)} at 110%`, [{ type: 'apply', id: 'boost:' + L }], 'More output; checked for quality and energy')];
        if (o.earlier) opts.push(opt('prio', `Load ${o.id} first`, [{ type: 'apply', id: 'prioritize:' + o.id }], 'Other orders move back'));
        opts.push(opt('split', 'Agree a split delivery', [{ type: 'apply', id: 'split:' + o.id }], '60% on time, the rest 3 h later (needs the customer)'));
        await x.simulate(opts, { horizon: clamp(o.due - P().t + 1500, 2400, 6000), seeds: 2 });
        await decide(c);
      },
      verify(c) { const o = P().orders.find(v => v.id === c.order); if (!o) return { done: true, ok: true, title: 'Order closed', detail: '' }; if (o.state === 'shipped' || o.state === 'late' || o.state === 'partial') return { done: true, ok: o.state !== 'late', title: o.state === 'late' ? `${o.id} shipped late` : `${o.id} shipped on time`, detail: `Shipped ${clockOf(o.shippedAt)}, due ${clockOf(o.due)}.` }; return P().t > o.due + 1800 ? { done: true, ok: false, title: `${o.id} not shipped by its due time`, detail: '' } : null; },
      verifyFor: 7200
    },
    takt: {
      agent: 'planner',
      async run(c, x) {
        const s = P().byId[c.station];
        await x.observe(c.title, `${s.name} runs a unit every ${s.gapEma.toFixed(0)} s against a ${E().TAKT[c.line]} s takt.`);
        await x.tool('station', { id: s.id }, r => `Operator: ${r.operator || 'none'} · cycle ${r.cycleS} s`);
        c.chain = ['st:' + s.id, 'line:' + c.line];
        c.diagnosis = { cause: 'Operator away from the station', text: 'The team leader covers at reduced pace.', confidence: 0.85 };
        await x.think('Skills matrix', 'Laila Mostafa (rework) is certified on Back cover; the rework queue is ' + P().rejects.rework.length + '.');
        await x.simulate([
          opt('laila', 'Move Laila Mostafa to Back cover', [{ type: 'apply', id: 'cover' }], 'Certified on the station; rework slows'),
          opt('leader', 'Line leader covers properly', [{ type: 'apply', id: 'leaderCover' }], 'About 20% slower; supervision gap')
        ], { horizon: 2700, seeds: 2 });
        await decide(c);
      },
      verify(c) { const s = P().byId[c.station]; if (P().t - c.verify.from > 600) return { done: true, ok: s.gapEma < E().TAKT[c.line] * 1.12, title: `${s.name} at ${s.gapEma.toFixed(0)} s per unit`, detail: `Takt ${E().TAKT[c.line]} s.` }; return null; }
    },
    inbound: {
      agent: 'planner',
      async run(c, x) {
        const tr = P().inbound.find(v => v.id === c.truck);
        await x.observe(c.title, `Panels cover ${mins(P().panelCover)}; ${tr.id} now arrives ${clockOf(tr.at)}.`);
        await x.tool('stock', { id: 'RM:panel' }, r => `Warehouse: ${r.level} panels`);
        c.chain = ['buf:RM:panel', 'buf:LS:L3panel', 'line:L3'];
        c.diagnosis = { cause: 'Inbound truck held at the port gate', text: 'TV output stops when the panels run out.', confidence: 0.9 };
        await x.simulate([opt('carrier', 'Book the alternative carrier (EGP 18k)', [{ type: 'apply', id: 'expediteTruck' }], 'Panels in 70 min')], { horizon: clamp((P().panelCover || 3600) + 3600, 3600, 10800), seeds: 2 });
        await decide(c);
      },
      verify(c) { if (P().t - c.verify.from > 4800 || P().inbound.every(t => t.id !== c.truck || t.state !== 'due')) { const st = P().lines.L3.stations[0].state === 'starved'; return { done: true, ok: !st, title: st ? 'TV line ran short of panels' : 'Panels arrived before the line ran dry', detail: '' }; } return null; },
      verifyFor: 5400
    },
    peak: {
      agent: 'energy',
      async run(c, x) {
        const e = TOOLS.energy();
        x.evidence({ kind: 'series', label: 'Plant demand (kW), last 15 min', values: down(P().hist.kw.slice(-180), 24), unit: 'kW', limit: P().energy.contract });
        void fmt;
        await x.observe(c.title, `Now ${e.kw} kW and ramping: motors that just started are still coming up to load. This 15-minute interval is heading to ${Math.round(P().energy.proj)} kW. Tariff ${e.tariff} (EGP ${e.price}/kWh); each kW of a new 15-minute maximum above the contract costs EGP 900.`);
        await x.tool('energy', {}, r => r.assets.filter(a => a.kw > 20).map(a => `${a.name} ${a.kw} kW`).join(' · '));
        c.chain = ['util:UTIL-CH2', 'util:UTIL-AIR2', 'util:UTIL-TX'];
        c.diagnosis = { cause: 'Chiller 2 and Compressor 2 started together', text: 'Both are flexible: the chilled-water loop and the air receiver buffer about 20 minutes.', confidence: 0.9 };
        await x.memory('peak', null);
        await x.simulate([opt('stagger', 'Hold Compressor 2 and Chiller 2 for 20 min', [{ type: 'apply', id: 'stagger' }], 'Buffers cover it; no production effect')], { horizon: 2400, seeds: 2 });
        await decide(c);
      },
      verify(c) { if (P().t - c.verify.from > 900) { const kw = Math.max(...P().hist.kw.slice(-60)); return { done: true, ok: kw <= P().energy.contract, title: `Peak held at ${Math.round(kw)} kW`, detail: `Contract ${P().energy.contract} kW.` }; } return null; }
    },
    power: {
      agent: 'energy',
      async run(c, x) {
        await x.observe(c.title, 'An 18% dip for 400 ms. Boards inside the ovens are held for re-inspection.');
        await x.tool('energy', {}, r => `Demand now ${r.kw} kW`);
        c.chain = ['util:UTIL-TX', 'line:L1', 'line:L2', 'buf:SM:main'];
        c.diagnosis = { cause: 'Grid voltage dip', text: 'Restarting both ovens and lines together draws an inrush peak that can trip the feeder again.', confidence: 0.9 };
        await x.simulate([
          opt('staggered', 'Staggered restart: Line 1 now, Line 2 after 60 s', [{ type: 'apply', id: 'restart:staggered' }], 'Keeps the inrush under the breaker limit', { policyKey: 'restart' }),
          opt('all', 'Restart both lines together', [{ type: 'apply', id: 'restart:all' }], 'Faster if it holds', { policyKey: 'restartAll' })
        ], { horizon: 1800, seeds: 3 });
        c.options.forEach(o => { const p = POLICY[o.policyKey || o.policy]; if (p) { o.polMax = p.max; o.polRisk = p.risk; } });
        await decide(c);
      },
      verify(c) { if (!P().lines.L1.tripped && !P().lines.L2.tripped) return { done: true, ok: true, title: 'Both SMT lines running', detail: `Restarted by ${clockOf(P().t)}.` }; return P().t - c.verify.from > 900 ? { done: true, ok: false, title: 'Restart took longer than predicted', detail: '' } : null; }
    },
    heat: {
      agent: 'energy',
      async run(c, x) {
        await x.observe(c.title, `Ambient now ${P().util.ambient.toFixed(1)} °C. Chillers draw more as it rises, and both reflow ovens run warmer.`);
        await x.tool('energy', {}, r => `Chillers ${r.assets.filter(a => /Chiller/.test(a.name)).map(a => a.kw + ' kW').join(' + ')} · contract ${r.contract} kW`);
        await x.handoff('quality', 'Quality agent: oven profiles', 'Both ovens drift about +3 °C at 41 °C ambient; lowering the profiles 3 °C keeps the joints in the window.');
        await x.memory('heat', null);
        c.chain = ['util:UTIL-CH1', 'util:UTIL-CH2', 'st:L1-Reflow', 'st:L2-Reflow'];
        c.diagnosis = { cause: 'Heat wave', text: 'A load and quality risk, not a fault.', confidence: 0.85 };
        await x.simulate([
          opt('both', 'Pre-cool now and lower both oven profiles 3 °C', [{ type: 'apply', id: 'precool' }, { type: 'apply', id: 'reflowProfile' }], 'Cold banked before the peak; joints kept in the window'),
          opt('profile', 'Lower the oven profiles only', [{ type: 'apply', id: 'reflowProfile' }], 'Quality only')
        ], { horizon: 5400, seeds: 3 });
        await decide(c);
      },
      verify(c) { if (P().t - c.verify.from > 1800) return { done: true, ok: Math.max(...P().hist.kw.slice(-120)) <= P().energy.contract * 1.02, title: `Demand ${Math.round(P().kpi.kw)} kW at ${P().util.ambient.toFixed(0)} °C ambient`, detail: '' }; return null; },
      verifyFor: 3600
    },
    safety: {
      agent: 'safety',
      async run(c) {
        const s = P().byId[c.station];
        // act first: this is the one case where the agent does not simulate
        c.options = [{ id: 'safe', label: 'Safe speed now', cmds: [{ type: 'apply', id: 'safeSpeed:' + s.id }], why: 'Allowed at any time by the plant policy', polMax: 'auto', polRisk: POLICY.safeSpeed.risk, value: { mean: 0, p10: 0, p90: 0 }, k: {} }, { id: 'none', label: 'Do nothing', cmds: [], value: { mean: 0, p10: 0, p90: 0 }, k: {} }];
        c.options.reverse();
        c.recommended = 'safe'; c.autonomy = 'auto'; c.confidence = 0.99;
        stepOf(c, 'observe', `Vision AI: ${s.intrusion.who} reaching into the ${s.name.toLowerCase()} cell`, 'Camera 4-B, person pose inside the robot envelope. Response budget 0.4 s.');
        await act(c, 'safe', 'Safety agent (always allowed)', 'Person inside the robot envelope');
        stepOf(c, 'tool', 'notify("Line leader Nour Ehab", "near miss")', 'Near-miss report filed with the camera clip; EHS informed.');
        c.chain = ['st:' + s.id, 'line:' + s.line];
        c.diagnosis = { cause: 'Person inside a robot cell', text: 'The robot was slowed before the light curtain had to stop it.', confidence: 0.99 };
        c.value = window.PlantEngine.COST.nearMiss; sync();
      },
      verify(c) { const s = P().byId[c.station]; if (!s.intrusion) return { done: true, ok: s.state !== 'down', title: s.state === 'down' ? 'Light curtain stop: the response was too late' : 'Cell clear · robot back to full speed', detail: 'No contact. Near-miss report NM filed.' }; return null; }
    }
  };
  PLAYBOOKS.fault.verifyFor = 2400;

  /* ---------------- host election, mirrors and persistence ---------------- */
  let mirrorTimer = null;
  function sync() {
    if (!S.host) return;
    emit('change', S);
    if (mirrorTimer) return;
    mirrorTimer = setTimeout(() => {
      mirrorTimer = null;
      T.broadcast({ kind: 'agents-state', state: slim() });
    }, 250);
  }
  const slim = () => ({ agents: S.agents, cases: S.cases, ledger: S.ledger.slice(0, 80), memory: S.memory.slice(0, 40), value: S.value, seq: S.seq });
  function save() { if (S.host) T.dbPut('agents-v2', Object.assign({ savedAt: Date.now(), k: T.E.P.k }, slim())); }
  async function load() {
    const d = await T.dbGet('agents-v2');
    if (d && T.restored && Math.abs((d.k || 0) - T.E.P.k) < 20000) {
      Object.assign(S, { agents: S.agents.map(a => Object.assign(a, (d.agents || []).find(x => x.id === a.id) || {})), cases: d.cases || [], ledger: d.ledger || [], memory: d.memory || MEMORY.slice(), value: d.value || 0, seq: d.seq || S.seq });
      // investigations that were running when the page closed restart from detection
      S.cases.forEach(c => { if (c.state === 'investigating' || c.state === 'simulating') { c.state = 'closed'; c.outcome = { verdict: 'Interrupted (page closed)', ok: null }; } });
    }
  }
  T.on((type, d) => {
    if (type !== 'bus' || !d) return;
    if (d.kind === 'agents-state' && !S.host) { Object.assign(S, d.state); emit('change', S); }
    if (d.kind === 'agents-cmd' && S.host) {
      if (d.op === 'approve') approve(d.caseId, d.optId, d.rationale, d.who);
      if (d.op === 'reject') reject(d.caseId, d.rationale, d.who);
      if (d.op === 'autonomy') setAutonomy(d.id, d.level, d.who);
    }
  });
  T.on(type => { if (type === 'tick' || type === 'alarms') safetyWatch(); });

  async function startAgents() {
    if (S.started) return; S.started = true;
    await T.ready;
    await load();
    const become = () => {
      S.host = true;
      // investigations that were running in a tab that closed: let detection reopen them
      S.cases.forEach(c => { if (c.state === 'investigating' || c.state === 'simulating' || c.state === 'acting') { c.state = 'closed'; c.outcome = { verdict: 'Interrupted (tab closed)', ok: null }; } });
      setInterval(() => { if (!T.paused && T.E && !T.catching) { try { detect(); verifyTick(); } catch (e) { console.error(e); } } }, 900);
      setInterval(save, 10000);
      addEventListener('pagehide', save);
      sync(); emit('host', true);
    };
    if (navigator.locks && navigator.locks.request) {
      navigator.locks.request('df-agents', () => { become(); return new Promise(() => {}); }).catch(() => become());
    } else become();
  }

  window.Agents = {
    S, DEFS, POLICY, TOOLS, MEMORY, agent, caseById, linreg,
    on(fn) { listeners.push(fn); return () => { const i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1); }; },
    start: startAgents, approve, reject, setAutonomy,
    get host() { return S.host; },
    open: () => S.cases.filter(c => c.state !== 'closed'),
    waiting: () => S.cases.filter(c => c.state === 'awaiting' || c.state === 'advise'),
    egp
  };
})();
