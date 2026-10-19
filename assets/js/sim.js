/* Digital Factory — plant simulation engine.
   Pure model, no DOM. The UI subscribes with Sim.on(fn) and reads Sim.state.
   Models: lines and stations, alarms (ISA-18.2 style) grouped into incidents, six AI agents with an autonomy level,
   line control with an audit trail, forecasts, scenarios, and a history buffer for the time machine. All data is simulated. */
(function (g) {
  'use strict';

  const SIM_SPEED = 20;              // simulated seconds per real second
  const START = 9 * 3600 + 12 * 60;  // 09:12, shift A runs 06:00–14:00
  const SHIFT_END = 14 * 3600;
  const HIST = 120;                  // telemetry points per series
  const TIMELINE = 900;              // time-machine snapshots (one per real second)

  const rnd = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const ema = (prev, v, k) => prev + (v - prev) * k;

  const LINE_DEFS = [
    { id: 'L1', name: 'SMT Line 1', sub: 'Main boards', rate: 180, kw: 210, fpy: 0.988, inspect: 'AOI',
      stations: ['Loader', 'Printer', 'SPI', 'Mounter A', 'Mounter B', 'Reflow', 'AOI', 'Unloader'] },
    { id: 'L2', name: 'SMT Line 2', sub: 'Power boards', rate: 220, kw: 165, fpy: 0.991, inspect: 'AOI',
      stations: ['Loader', 'Printer', 'SPI', 'Mounter C', 'Reflow', 'AOI', 'Unloader'] },
    { id: 'L3', name: 'Final Assembly A', sub: 'TVs', rate: 92, kw: 88, fpy: 0.993, inspect: 'Function test', material: 'Back covers',
      stations: ['Panel load', 'Board fit', 'Screw robot', 'Back cover', 'Function test'] },
    { id: 'L4', name: 'Final Assembly B', sub: 'Smartphones', rate: 150, kw: 72, fpy: 0.994, inspect: 'Function test',
      stations: ['Housing fit', 'Board fit', 'Display bond', 'Screw robot', 'Function test'] },
    { id: 'L5', name: 'Test & Pack', sub: 'All products', rate: 205, kw: 124, fpy: 0.997, inspect: 'Final QC',
      stations: ['Burn-in', 'Final QC', 'Packing', 'Palletizer'] }
  ];
  const UTIL_KW = 245;
  const MACHINE_KINDS = ['Printer', 'Mounter', 'Reflow', 'Screw robot', 'Burn-in', 'Palletizer', 'Display bond', 'SPI', 'AOI'];

  const AGENT_DEFS = [
    { id: 'maint', name: 'Maintenance agent', icon: 'settings', scope: 'Machine health, work orders, spare parts', autonomy: 'approve' },
    { id: 'quality', name: 'Quality agent', icon: 'eye', scope: 'Vision AI, AOI, process parameters', autonomy: 'approve' },
    { id: 'logistics', name: 'Logistics agent', icon: 'box', scope: 'Line-side stock, AGVs, warehouse', autonomy: 'auto' },
    { id: 'energy', name: 'Energy agent', icon: 'chart', scope: 'Demand, tariffs, HVAC, compressed air', autonomy: 'approve' },
    { id: 'planner', name: 'Planning agent', icon: 'calendar', scope: 'Schedule, orders, capacity', autonomy: 'approve' },
    { id: 'safety', name: 'Safety agent', icon: 'shield', scope: 'People, robots, EHS', autonomy: 'auto', locked: true }
  ];

  const SCENARIOS = [
    { id: 'bearing', icon: 'settings', title: 'Bearing wear on Mounter B', area: 'SMT Line 1', agent: 'maint',
      what: 'A spindle bearing starts to wear. Vibration rises slowly.', ai: 'Predicts the failure about 40 hours ahead and plans the repair into the shift change.' },
    { id: 'solder', icon: 'eye', title: 'Solder paste drift', area: 'SMT Line 2', agent: 'quality',
      what: 'Printer pressure drifts. Solder-bridge defects jump.', ai: 'Finds the root cause in the process data and recalibrates the printer without stopping the line.' },
    { id: 'material', icon: 'box', title: 'Back covers running low', area: 'Final Assembly A', agent: 'logistics',
      what: 'A larger batch consumes line-side stock faster than planned.', ai: 'Sends an AGV on its own before the line starves.' },
    { id: 'peak', icon: 'chart', title: 'Peak-tariff demand spike', area: 'Utilities', agent: 'energy',
      what: 'Chillers and a compressor start together in the peak tariff window.', ai: 'Staggers the loads and flattens the peak with no effect on output.' },
    { id: 'breakdown', icon: 'alert', title: 'Sudden robot fault', area: 'Final Assembly B', agent: 'maint',
      what: 'A screw robot stops with a torque fault. Alarms flood in.', ai: 'Collapses the alarm flood into one incident and sends the right technician with the right part.' },
    { id: 'safety', icon: 'shield', title: 'Person inside a robot cell', area: 'Final Assembly B', agent: 'safety',
      what: 'Vision AI sees a hand reaching into the screw robot cell.', ai: 'Slows the robot to safe speed in under a second and files a near-miss report.' },
    { id: 'supplier', icon: 'calendar', title: 'Panel shipment delayed 18 h', area: 'Supply chain', agent: 'planner',
      what: 'The vessel carrying TV panels is held at port.', ai: 'Re-sequences the plan: TV volume moves to tomorrow, a smartphone export order is pulled forward.' },
    { id: 'heat', icon: 'sun', title: 'Heat wave this afternoon', area: 'Whole plant', agent: 'energy',
      what: 'Ambient temperature forecast at 41 °C. Chillers and reflow ovens drift.', ai: 'Pre-cools the plant in the off-peak window and adjusts the reflow profile before defects appear.' },
    { id: 'power', icon: 'refresh', title: 'Grid voltage dip', area: 'SMT lines', agent: 'energy',
      what: 'An 18% voltage dip for 400 ms trips the SMT lines.', ai: 'Holds boards in the ovens for re-inspection and restarts lines one by one to avoid a power surge.' },
    { id: 'surge', icon: 'sparkles', title: 'New export order +20%', area: 'Planning', agent: 'planner',
      what: 'A large order arrives for the next three weeks.', ai: 'Simulates the plan on the twin and proposes a targeted third shift on the bottleneck only.' }
  ];

  const listeners = [];
  const emit = e => listeners.forEach(fn => fn(e));

  let S, seq = 0;

  function makeStation(line, name, i, n) {
    return {
      id: `${line.id}-${name.replace(/\W+/g, '')}`, name, line: line.id, idx: i,
      x: 0.07 + 0.86 * (i / (n - 1)),
      state: 'run', machine: MACHINE_KINDS.some(k => name.startsWith(k)), health: rnd(84, 99),
      vibBase: rnd(1.1, 2.2), tempBase: name.startsWith('Reflow') ? rnd(238, 246) : rnd(36, 48),
      vib: 0, temp: 0, cycle: 3600 / line.rate, degrade: 0, hist: { vib: [], temp: [], cycle: [] }
    };
  }

  function reset() {
    seq = 0;
    S = {
      t: START, real: 0, saved: 0, energyKwh: 0, unitsBase: 2390,
      tariff: 'Standard', utilKw: UTIL_KW, utilExtra: 0, ambient: 31,
      oee: 0.864, tph: 0, fpy: 0.99, kw: 0, kwHist: [], oeeHist: [],
      active: {}, insights: [], workOrders: [], timers: [], audit: [], history: [],
      alarms: [], incidents: [], alarmStats: { raised: 0, suppressed: 0, chatter: 0 },
      defects: { 'Solder bridge': 9, 'Missing component': 5, 'Tombstone': 3, 'Misalignment': 7, 'Insufficient solder': 4, 'Scratch / cosmetic': 2 },
      agvs: [
        { id: 'AGV-01', p: 0.05, speed: 0.035, task: null },
        { id: 'AGV-02', p: 0.45, speed: 0.03, task: null },
        { id: 'AGV-03', p: 0.75, speed: 0.032, task: null }
      ],
      agents: AGENT_DEFS.map(d => Object.assign({}, d, { status: 'watching', log: [], actions: 0, value: 0 })),
      lines: LINE_DEFS.map(d => {
        const line = Object.assign({}, d, {
          units: [], spawnAcc: 0, produced: 0, good: 0, defectMult: 1, speed: 1, stopped: false, paused: false,
          oee: rnd(0.84, 0.9), perf: rnd(0.93, 0.97), availBase: rnd(0.9, 0.935), tph: d.rate * 0.88, fpyNow: d.fpy,
          matName: d.material, material: d.material ? 78 : null, starved: false
        });
        line.stations = d.stations.map((n, i) => makeStation(line, n, i, d.stations.length));
        return line;
      })
    };
    for (const l of S.lines) for (let x = 0.02; x < 0.98; x += rnd(0.07, 0.12)) l.units.push({ x, defect: false, flagged: false, out: 0 });
    st('L2', 'Reflow').health = 63;
    for (let i = 0; i < HIST; i++) tick(0.25, true);
    S.real = 0;
    S.agents.forEach(a => think(a.id, 'Online. Watching ' + a.scope.toLowerCase() + '.', true));
    raise('L2-Printer.PAPER', { prio: 4, area: 'L2', tag: 'PRN.PAPER', msg: 'Printer cleaning paper roll low' });
    emit({ type: 'reset' });
    log('MES', `Shift A running · 5 lines · plan ${planAt(SHIFT_END).toLocaleString('en-US')} units this shift`, 'info');
  }

  const line = id => S.lines.find(l => l.id === id);
  const st = (lineId, name) => line(lineId).stations.find(s => s.name === name);
  const allStations = () => S.lines.flatMap(l => l.stations);
  const machines = () => allStations().filter(s => s.machine);
  const agent = id => S.agents.find(a => a.id === id);

  function clock(t = S.t) {
    const h = Math.floor(t / 3600) % 24, m = Math.floor(t / 60) % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
  function log(src, msg, level = 'info') { emit({ type: 'log', time: clock(), src, msg, level }); }
  function toast(msg, level = 'success') { emit({ type: 'toast', msg, level }); }
  function later(sec, fn) { S.timers.push({ at: S.real + sec, fn }); }
  function audit(who, action, detail) {
    S.audit.unshift({ time: clock(), who, action, detail });
    S.audit = S.audit.slice(0, 60);
    emit({ type: 'audit' });
  }
  function think(id, text, quiet) {
    const a = agent(id); if (!a) return;
    a.log.unshift({ time: clock(), text });
    a.log = a.log.slice(0, 14);
    if (!quiet) emit({ type: 'agents' });
  }
  function agentStatus(id, status) { const a = agent(id); if (a) { a.status = status; emit({ type: 'agents' }); } }

  /* ---------------- alarms (ISA-18.2 style) ---------------- */
  function raise(key, o) {
    if (S.alarms.some(a => a.key === key && a.state !== 'cleared')) return null;
    const a = Object.assign({ id: ++seq, key, state: 'active', time: clock(), real: S.real, prio: 3, incident: null, shelved: 0 }, o);
    S.alarms.unshift(a);
    S.alarmStats.raised++;
    emit({ type: 'alarms' });
    return a;
  }
  function clearAlarm(key) {
    S.alarms.forEach(a => { if (a.key === key && a.state !== 'cleared') { a.state = 'cleared'; a.clearedReal = S.real; } });
    emit({ type: 'alarms' });
  }
  function incident(o) {
    const inc = Object.assign({ id: ++seq, time: clock(), open: true, members: [] }, o);
    S.incidents.unshift(inc);
    S.incidents = S.incidents.slice(0, 12);
    emit({ type: 'alarms' });
    return inc;
  }
  // a station stop floods the line: upstream blocked, downstream starved, then knock-on alarms
  function cascade(stn, inc) {
    const l = line(stn.line);
    const keys = [];
    l.stations.forEach((s, i) => {
      if (s === stn) return;
      const up = i < stn.idx;
      keys.push([`${s.id}.${up ? 'BLK' : 'STV'}`, { prio: 3, area: l.id, tag: s.name.toUpperCase().replace(/\s/g, '') + (up ? '.BLOCKED' : '.STARVED'), msg: `${s.name}: ${up ? 'outfeed blocked' : 'no infeed'}` }]);
    });
    keys.push([`${l.id}.TPH`, { prio: 2, area: l.id, tag: 'LINE.THROUGHPUT', msg: `${l.name} throughput below target` }]);
    keys.push(['L5.INFEED', { prio: 3, area: 'L5', tag: 'TEST.INFEED', msg: 'Test & Pack infeed below plan' }]);
    keys.push([`${l.id}.ORDER`, { prio: 2, area: 'MES', tag: 'ORDER.4471', msg: 'Order 4471 delivery at risk' }]);
    keys.push([`${l.id}.AGV`, { prio: 4, area: 'AGV', tag: 'AGV.ROUTE', msg: `AGV route congested at ${l.id}` }]);
    keys.forEach(([k, o], n) => later(0.3 + n * 0.25, () => {
      const a = raise(k, Object.assign(o, { incident: inc.id }));
      if (a) inc.members.push(k);
      emit({ type: 'alarms' });
    }));
    return keys.map(k => k[0]);
  }
  function closeIncident(inc, members) {
    if (!inc) return;
    inc.open = false; inc.closed = clock();
    (members || []).concat(inc.members, [inc.rootKey]).forEach(k => clearAlarm(k));
    emit({ type: 'alarms' });
  }

  /* ---------------- insights + agent autonomy ---------------- */
  function insight(o) {
    const ins = Object.assign({ id: ++seq, time: clock(), level: 'info', actions: [] }, o);
    S.insights.unshift(ins);
    S.insights = S.insights.slice(0, 14);
    emit({ type: 'insight', insight: ins });
    const a = ins.agent && agent(ins.agent);
    if (a && ins.autoKey) {
      if (a.autonomy === 'auto') {
        agentStatus(a.id, 'acting');
        think(a.id, 'Autonomy is set to Auto and this action is inside my guardrails. Executing.');
        later(2.4, () => { if (S.insights.some(i => i.id === ins.id)) act(ins.id, ins.autoKey, a.name); });
      } else if (a.autonomy === 'approve') {
        agentStatus(a.id, 'waiting');
        think(a.id, 'Recommendation ready. Waiting for your approval.');
      } else {
        agentStatus(a.id, 'watching');
        think(a.id, 'Advice published. No action taken (autonomy: Advise).');
      }
    }
    return ins;
  }
  function resolve(id, replacement) {
    S.insights = S.insights.filter(i => i.id !== id);
    emit({ type: 'resolve', id });
    if (replacement) insight(replacement);
  }
  function done(agentId, value) {
    const a = agent(agentId); if (!a) return;
    a.actions++; a.value += value || 0; a.status = 'watching';
    emit({ type: 'agents' });
  }

  function rulHours(s) {
    if (s.state === 'down') return 0;
    if (s.degrade > 0) return Math.max(0, (s.health - 30) / s.degrade * 1.1); // compressed demo timescale
    return Math.round((s.health - 30) * 34);
  }

  /* ---------------- simulation step ---------------- */
  function tick(dt, warm) {
    S.real += dt;
    const dts = dt * SIM_SPEED;
    if (!warm) S.t += dts;

    if (!warm) {
      const due = S.timers.filter(t => t.at <= S.real);
      S.timers = S.timers.filter(t => t.at > S.real);
      due.forEach(t => t.fn());
    }

    let tphSum = 0, oeeW = 0, fpyW = 0, rateSum = 0, kw = 0;
    for (const l of S.lines) {
      let blocked = false, slow = false;
      for (const s of l.stations) {
        if (s.degrade > 0 && s.state !== 'down' && s.state !== 'maint') s.health = clamp(s.health - s.degrade * dt, 0, 100);
        const wear = 100 - s.health;
        const idle = s.state === 'down' || s.state === 'maint' || l.stopped || l.paused;
        s.vib = idle ? rnd(0.05, 0.2) : s.vibBase + wear * 0.065 + rnd(-0.18, 0.18) + (wear > 30 ? rnd(0, wear * 0.012) : 0);
        const heat = s.name === 'Reflow' && S.active.heat && !S.active.heat.fixed ? 3.2 : 0;
        s.temp = s.state === 'down' ? ema(s.temp || s.tempBase, s.tempBase * 0.7, 0.02) : s.tempBase + wear * 0.12 + heat + rnd(-0.6, 0.6);
        const busy = !idle && (s.state === 'run' || s.state === 'warn');
        s.cycle = busy ? (3600 / (l.rate * l.speed)) * (1 + (s.state === 'warn' ? 0.16 : 0) + rnd(-0.03, 0.03)) : 0;
        if (s.state === 'down' || s.state === 'maint') blocked = true;
        if (s.state === 'warn') slow = true;
        if (!warm || Math.random() < 0.6) {
          s.hist.vib.push(+s.vib.toFixed(2)); s.hist.temp.push(+s.temp.toFixed(1)); s.hist.cycle.push(+s.cycle.toFixed(1));
          for (const k in s.hist) if (s.hist[k].length > HIST) s.hist[k].shift();
        }
      }
      if (l.material !== null) {
        l.material = clamp(l.material - dt * (S.active.material ? 1.6 : 0.25), 0, 100);
        if (l.material < 40 && !S.active.material && !l.restocking) routineRestock(l);
        l.starved = l.material <= 0;
      }
      const halted = blocked || l.starved || l.stopped || l.paused;
      const avail = halted ? 0 : 1;
      const perf = slow ? 0.8 : l.perf + rnd(-0.01, 0.01);
      const over = Math.max(0, l.speed - 1);
      const defectRate = (1 - l.fpy) * l.defectMult * (1 + over * 6) * (S.active.heat && !S.active.heat.fixed && /L1|L2/.test(l.id) ? 1.8 : 1);
      const q = 1 - defectRate;
      l.oee = ema(l.oee, avail * l.availBase * perf * q, warm ? 0.05 : Math.min(1, dt * 0.18));
      l.fpyNow = ema(l.fpyNow, q, Math.min(1, dt * 0.3));
      const tph = l.rate * l.speed * avail * l.availBase * perf;
      l.tph = ema(l.tph, tph, Math.min(1, dt * 0.4));
      if (!warm) { const made = tph * dts / 3600; l.produced += made; l.good += made * q; }
      tphSum += l.tph; oeeW += l.oee * l.rate; fpyW += l.fpyNow * l.rate; rateSum += l.rate;
      l.kwNow = l.kw * (avail ? (0.85 + 0.15 * l.speed) : 0.42) * rnd(0.97, 1.03);
      kw += l.kwNow;
      flow(l, dt, halted, defectRate);
    }
    const heatLoad = S.active.heat ? (S.active.heat.fixed ? 60 : 150) : 0;
    S.utilExtra = ema(S.utilExtra, (S.active.peak ? 230 : 0) + heatLoad, Math.min(1, dt * 0.5));
    const utilNow = (S.utilKw + S.utilExtra) * rnd(0.98, 1.02);
    kw += utilNow; S.utilNow = utilNow;
    S.kw = kw; S.tph = tphSum; S.oee = oeeW / rateSum; S.fpy = fpyW / rateSum;
    if (!warm) S.energyKwh += kw * dts / 3600;

    for (const a of S.agvs) {
      if (a.task) {
        a.task.k = clamp(a.task.k + dt / a.task.dur, 0, 1);
        if (a.task.k >= 1) { const fin = a.task.done; a.task = null; fin && fin(); }
      } else a.p = (a.p + a.speed * dt) % 1;
    }

    S._histAcc = (S._histAcc || 0) + dt;
    if (S._histAcc >= 1 || warm) {
      S._histAcc = 0;
      S.kwHist.push(Math.round(kw)); S.oeeHist.push(S.oee);
      if (S.kwHist.length > HIST) S.kwHist.shift();
      if (S.oeeHist.length > HIST) S.oeeHist.shift();
      if (!warm) snapshot();
    }
    if (!warm) { watchdogs(); housekeeping(); }
  }

  function snapshot() {
    S.history.push({
      real: S.real, clock: clock(), oee: S.oee, tph: S.tph, fpy: S.fpy, kw: S.kw, units: unitsToday(),
      alarms: S.alarms.filter(a => a.state !== 'cleared').length,
      st: allStations().map(s => s.state[0]).join(''),
      lines: S.lines.map(l => ({ oee: l.oee, tph: l.tph, halted: l.stopped || l.paused || l.starved }))
    });
    if (S.history.length > TIMELINE) S.history.shift();
  }

  function housekeeping() {
    S.alarms = S.alarms.filter(a => !(a.state === 'cleared' && S.real - a.clearedReal > 25));
    S.alarms.forEach(a => { if (a.shelved && a.shelved < S.real) a.shelved = 0; });
    // a nuisance alarm that chatters: the AI suppresses it instead of distracting the operator
    S._chat = (S._chat || 0) + 1;
    if (S._chat % 900 === 0) { S.alarmStats.chatter++; S.alarmStats.suppressed++; emit({ type: 'alarms' }); }
  }

  function flow(l, dt, stopped, defectRate) {
    const v = 0.055 * (l.rate / 160) ** 0.3 * l.speed;
    const gap = 0.045;
    const down = l.stations.filter(s => s.state === 'down' || s.state === 'maint').map(s => s.x).sort((a, b) => a - b);
    const insp = l.stations.find(s => s.name === l.inspect);
    l.units.sort((a, b) => b.x - a.x);
    for (let i = 0; i < l.units.length; i++) {
      const u = l.units[i];
      if (u.flagged) { u.out += dt * 1.6; continue; }
      if (l.stopped || l.paused) continue;
      let limit = 1.06;
      if (i > 0) { const ahead = l.units.slice(0, i).find(o => !o.flagged); if (ahead) limit = ahead.x - gap; }
      const block = down.find(x => x > u.x - 0.001);
      if (block !== undefined) limit = Math.min(limit, block - 0.03);
      if (l.starved) limit = Math.min(limit, u.x);
      const nx = Math.min(u.x + v * dt, limit);
      if (insp && u.x < insp.x && nx >= insp.x && u.defect) { u.flagged = true; u.x = insp.x; continue; }
      u.x = Math.max(u.x, nx);
    }
    l.units = l.units.filter(u => u.x < 1.04 && u.out < 1);
    if (!l.starved && !l.stopped && !l.paused) {
      l.spawnAcc += dt * l.speed;
      const every = 1.05 * (160 / l.rate) ** 0.5;
      const first = l.units.filter(u => !u.flagged).reduce((m, u) => Math.min(m, u.x), 9);
      if (l.spawnAcc >= every && first > gap) {
        l.spawnAcc = 0;
        l.units.push({ x: 0, defect: Math.random() < Math.min(0.6, defectRate * 9), flagged: false, out: 0 });
      }
    }
  }

  function routineRestock(l) {
    const agv = S.agvs.find(a => !a.task);
    if (!agv) return;
    l.restocking = true;
    agv.task = { line: l.id, k: 0, dur: 7, done: () => { l.material = 100; l.restocking = false; log('AGV', `${agv.id} delivered ${l.matName.toLowerCase()} to ${l.name}`); } };
    log('AGV', `${agv.id} dispatched to ${l.name} (routine replenishment)`);
  }

  /* ---------------- watchdogs: the AI reacting to the plant ---------------- */
  function watchdogs() {
    const mb = st('L1', 'Mounter B');
    const b = S.active.bearing;
    if (b) {
      if (!b.alerted && mb.health < 72) {
        b.alerted = true; mb.state = 'warn';
        const rul = Math.round(rulHours(mb));
        raise('L1-MounterB.VIB', { prio: 2, area: 'L1', tag: 'MNT-B.SPINDLE.VIB', msg: `Mounter B spindle vibration rising · predicted failure in ${rul} h` });
        think('maint', `Mounter B vibration ${mb.vib.toFixed(1)} mm/s, +${Math.round((mb.vib / mb.vibBase - 1) * 100)}% against its own baseline.`);
        think('maint', 'Signature matches spindle-bearing wear pattern B-14 (94% match).');
        think('maint', `Remaining useful life ≈ ${rul} h. Next planned window: 14:00 shift change. Spare kit in store B-07.`);
        b.ins = insight({
          agent: 'maint', autoKey: 'schedule', level: 'warn', icon: 'settings', conf: '94% confidence', station: mb.id, risk: 1600000,
          title: 'Bearing failure predicted · Mounter B',
          body: `Spindle bearing vibration ${mb.vib.toFixed(1)} mm/s and rising. Remaining useful life about ${rul} h. Replace it at the 14:00 shift change: a 25-minute planned stop instead of a 4.5-hour breakdown.`,
          actions: [{ key: 'schedule', label: 'Schedule repair at 14:00', primary: true }, { key: 'inspect', label: 'Show machine' }],
          scenario: 'bearing'
        });
        S.workOrders.unshift({ id: 'WO-' + (4810 + S.workOrders.length), title: 'Replace spindle bearing · Mounter B (L1)', status: 'Awaiting approval', level: 'warn', mid: mb.id });
        emit({ type: 'workorders' });
        log('AI', 'Mounter B anomaly score 0.93 · remaining-life model triggered', 'warn');
      }
      if (b.alerted && !b.scheduled && mb.health <= 30 && mb.state !== 'down') {
        mb.state = 'down';
        if (b.ins) resolve(b.ins.id);
        clearAlarm('L1-MounterB.VIB');
        const inc = incident({ title: 'SMT Line 1 stopped · Mounter B bearing seized', area: 'L1', rootKey: 'L1-MounterB.STOP', confidence: 0.97, cause: 'Spindle bearing seized (predicted about 40 h earlier, warning not actioned)' });
        raise('L1-MounterB.STOP', { prio: 1, area: 'L1', tag: 'MNT-B.ESTOP', msg: 'Mounter B emergency stop · servo overload', incident: inc.id });
        const members = cascade(mb, inc);
        insight({
          agent: 'maint', level: 'crit', icon: 'alert', station: mb.id, conf: 'event', risk: 1600000,
          title: 'Mounter B stopped · SMT Line 1 down',
          body: 'The spindle bearing seized. The AI flagged it about 40 hours earlier, but the warning was not actioned. Estimated unplanned repair: 4.5 h, about 810 boards lost.',
          actions: [{ key: 'inspect', label: 'Show machine' }, { key: 'alarms', label: 'Open alarms' }]
        });
        think('maint', 'Failure confirmed. Emergency work order raised. Technician Eng. Sara dispatched with kit B-07.');
        log('PLC', 'L1 Mounter B emergency stop · servo overload', 'crit');
        toast('SMT Line 1 stopped: Mounter B bearing seized', 'error');
        const wo = S.workOrders.find(w => w.mid === mb.id && w.status !== 'Completed');
        if (wo) { wo.status = 'Emergency repair'; wo.level = 'crit'; emit({ type: 'workorders' }); }
        later(22, () => {
          mb.health = 98; mb.degrade = 0; mb.state = 'run'; delete S.active.bearing;
          closeIncident(inc, members);
          if (wo) { wo.status = 'Completed'; wo.level = 'ok'; emit({ type: 'workorders' }); }
          done('maint', 0);
          log('MES', 'L1 Mounter B restored after unplanned repair');
          toast('SMT Line 1 back online after unplanned repair', 'info');
        });
      }
    }
    const sd = S.active.solder;
    if (sd && !sd.alerted && S.real - sd.at > 5) {
      sd.alerted = true;
      raise('L2-AOI.REJ', { prio: 3, area: 'L2', tag: 'AOI.REJECT.RATE', msg: 'AOI reject rate 4.2× baseline' });
      think('quality', 'Solder-bridge rejects on L2 up 4.2× in 40 min, clustered on pads U14/U15.');
      think('quality', 'Correlating with 212 process signals… printer squeegee pressure drifted 5.2 → 6.8 kg (r = 0.91).');
      sd.ins = insight({
        agent: 'quality', autoKey: 'applyFix', level: 'warn', icon: 'eye', conf: 'correlation 0.91', risk: 240000,
        title: 'Solder-bridge defects up 4.2× · SMT Line 2',
        body: 'Root cause found: printer squeegee pressure drifted from 5.2 to 6.8 kg over 40 minutes. Recommended: recalibrate to 5.5 kg and run a stencil wipe. No line stop needed.',
        actions: [{ key: 'applyFix', label: 'Apply fix now', primary: true }, { key: 'rootcause', label: 'See root cause' }],
        scenario: 'solder'
      });
      log('AI', 'Vision: bridge cluster on L2 pads U14/U15, correlated with printer pressure', 'warn');
    }
  }

  /* ---------------- scenarios ---------------- */
  const scenarios = {
    bearing() {
      if (S.active.bearing) return;
      const mb = st('L1', 'Mounter B');
      if (mb.state !== 'run') return;
      mb.health = Math.min(mb.health, 88); mb.degrade = 1.05;
      S.active.bearing = { at: S.real };
      think('maint', 'Mounter B vibration trend changed slope. Watching closely.');
      log('IoT', 'L1 Mounter B vibration trending up');
    },
    solder() {
      if (S.active.solder) return;
      line('L2').defectMult = 4.2;
      st('L2', 'AOI').state = 'warn';
      S.active.solder = { at: S.real };
      log('AOI', 'L2 AOI reject rate rising');
    },
    material() {
      if (S.active.material) return;
      const l = line('L3'); l.material = Math.min(l.material, 26);
      S.active.material = { at: S.real };
      later(3, () => {
        raise('L3.MAT', { prio: 3, area: 'L3', tag: 'LINESIDE.COVERS', msg: 'Back covers below 30 minutes of stock' });
        think('logistics', 'Back-cover consumption 18% above plan. Stock covers 14 min.');
        think('logistics', 'AGV-02 nearest and free. Warehouse B pick list created.');
        const ins = insight({
          agent: 'logistics', level: 'info', icon: 'box', conf: 'autonomous', risk: 180000,
          title: 'Back covers run out on Final Assembly A in 14 min',
          body: 'Consumption is 18% above plan because MES released a larger batch. AGV-02 is already on its way from Warehouse B, ETA 4 min. No action needed.'
        });
        audit('Logistics agent', 'Dispatched AGV-02', 'Priority delivery of 120 back covers to Final Assembly A');
        agentStatus('logistics', 'acting');
        S.agvs.forEach(a => { if (a.task && a.task.line === 'L3') a.task = null; });
        const agv = S.agvs[1];
        line('L3').restocking = true;
        agv.task = { line: 'L3', k: 0, dur: 9, priority: true, done: () => {
          line('L3').material = 100; delete S.active.material; line('L3').restocking = false;
          clearAlarm('L3.MAT');
          resolve(ins.id, { agent: 'logistics', level: 'ok', icon: 'checkCircle', title: 'Stoppage avoided on Final Assembly A', body: 'AGV-02 delivered 120 back covers. The line never stopped and nobody had to intervene.', conf: 'resolved' });
          done('logistics', 180000); S.saved += 180000;
          toast('Material delivered automatically. Line 3 never stopped.', 'success');
          log('AGV', 'AGV-02 delivered back covers to Final Assembly A');
        } };
      });
    },
    peak() {
      if (S.active.peak) return;
      S.active.peak = { at: S.real }; S.tariff = 'Peak';
      later(4, () => {
        raise('UTIL.PEAK', { prio: 2, area: 'UTIL', tag: 'EMS.DEMAND', msg: 'Plant demand approaching contract limit' });
        think('energy', 'Chiller 2 and compressor #3 started together inside the peak tariff window.');
        think('energy', 'Forecast: 1,180 kW within 15 min. Contract limit 1,100 kW.');
        S.active.peak.ins = insight({
          agent: 'energy', autoKey: 'applyEnergy', level: 'warn', icon: 'chart', conf: 'forecast 15 min', risk: 41000,
          title: 'Peak-tariff demand spike · 1,180 kW forecast',
          body: 'Stagger compressor #3 by 20 minutes and move chiller pre-cooling off-peak. About EGP 41k per month saved, with no effect on output.',
          actions: [{ key: 'applyEnergy', label: 'Apply energy schedule', primary: true }, { key: 'energy', label: 'Open energy' }],
          scenario: 'peak'
        });
      });
      log('EMS', 'Plant demand rising: compressor #3 and chiller start');
    },
    breakdown() {
      const sr = st('L4', 'Screw robot');
      if (sr.state !== 'run') return;
      sr.state = 'down';
      const inc = incident({ title: 'Final Assembly B stopped · screw robot torque fault', area: 'L4', rootKey: 'L4-Screwrobot.TRQ', confidence: 0.88, cause: 'Torque sensor drift (same signature as 3 past events)' });
      raise('L4-Screwrobot.TRQ', { prio: 1, area: 'L4', tag: 'SCRW.TORQUE.FAULT', msg: 'Screw robot torque fault · cell stopped', incident: inc.id });
      const members = cascade(sr, inc);
      log('PLC', 'L4 screw robot torque fault, cell stopped', 'crit');
      think('maint', 'Torque fault on L4 screw robot. Signature matches 3 past events: torque sensor drift.');
      think('maint', 'Spare sensor in store A-14. Eng. Mahmoud is closest (2 min). Repair guide attached.');
      insight({
        agent: 'maint', level: 'crit', icon: 'alert', conf: 'diagnosis 88%', station: sr.id, risk: 380000,
        title: 'Screw robot fault · Final Assembly B',
        body: 'The alarm flood was collapsed into one incident. Diagnosis: torque sensor drift, the same signature as 3 past events. Spare part in store A-14. Eng. Mahmoud notified with the repair guide, ETA 6 min.',
        actions: [{ key: 'alarms', label: 'Open alarms', primary: true }, { key: 'inspect', label: 'Show machine' }]
      });
      audit('Maintenance agent', 'Dispatched technician', 'Eng. Mahmoud · torque sensor kit A-14 · repair guide RG-207');
      toast('Robot fault on Line 4: technician dispatched automatically', 'error');
      later(14, () => {
        sr.state = 'run'; closeIncident(inc, members); done('maint', 0);
        log('MES', 'L4 screw robot back in production after 14 min');
        toast('Line 4 restored in 14 min (average for this fault: 55 min)', 'success');
      });
    },
    safety() {
      if (S.active.safety) return;
      const sr = st('L4', 'Screw robot'); const l = line('L4');
      if (sr.state === 'down') return;
      S.active.safety = { at: S.real, prevSpeed: l.speed };
      raise('L4.SAFETY', { prio: 1, area: 'L4', tag: 'CELL3.PERSON', msg: 'Person detected inside robot cell · Final Assembly B' });
      think('safety', 'Camera 4B: hand detected inside screw-robot envelope, 0.6 m from tool.');
      sr.state = 'warn'; l.speed = 0.55;
      think('safety', 'Robot slowed to collaborative speed in 0.4 s. Supervisor notified.');
      audit('Safety agent', 'Reduced robot speed to safe level', 'Final Assembly B screw robot · person in cell · 0.4 s response');
      const ins = insight({
        agent: 'safety', level: 'crit', icon: 'shield', conf: 'vision 97%', station: sr.id,
        title: 'Person inside robot cell · Final Assembly B',
        body: 'Vision AI saw a hand reach into the screw-robot cell. The robot was slowed to safe speed in 0.4 s and the line supervisor was alerted. A near-miss report is being prepared.'
      });
      toast('Safety: robot slowed in 0.4 s, person detected in cell', 'warning');
      later(8, () => {
        sr.state = 'run'; l.speed = S.active.safety.prevSpeed; delete S.active.safety;
        clearAlarm('L4.SAFETY');
        resolve(ins.id, { agent: 'safety', level: 'ok', icon: 'shield', title: 'Near-miss closed · Final Assembly B', body: 'The person left the cell and the robot returned to full speed. The near-miss report was filed with the video clip, and a training reminder was assigned.', conf: 'resolved' });
        done('safety', 0);
        audit('Safety agent', 'Filed near-miss report', 'NM-0193 with 12 s video clip · training reminder assigned');
      });
    },
    supplier() {
      if (S.active.supplier) return;
      S.active.supplier = { at: S.real };
      raise('SCM.PANELS', { prio: 2, area: 'SCM', tag: 'INBOUND.PANELS', msg: 'TV panel shipment delayed 18 h' });
      think('planner', 'Inbound TV panels delayed 18 h. Line-side and warehouse stock covers 5.2 h of Final Assembly A.');
      think('planner', 'Simulated 6 re-sequencing options on the twin. Best: move 900 TV units to tomorrow, pull forward export order EX-2210 (smartphones).');
      S.active.supplier.ins = insight({
        agent: 'planner', autoKey: 'resequence', level: 'warn', icon: 'calendar', conf: '6 plans simulated', risk: 450000,
        title: 'TV panel shipment delayed 18 h',
        body: 'Stock covers 5.2 hours of TV assembly. Best plan from the twin: move 900 TV units to tomorrow and pull forward smartphone export order EX-2210. Both lines stay busy and no delivery date is missed.',
        actions: [{ key: 'resequence', label: 'Approve new plan', primary: true }, { key: 'simulator', label: 'Open what-if' }],
        scenario: 'supplier'
      });
      log('SCM', 'Carrier notice: TV panel shipment held at port, ETA +18 h', 'warn');
    },
    heat() {
      if (S.active.heat) return;
      S.active.heat = { at: S.real }; S.ambient = 41;
      raise('ENV.HEAT', { prio: 3, area: 'UTIL', tag: 'AMBIENT.FORECAST', msg: 'Ambient 41 °C forecast · reflow zone 5 drifting +3 °C' });
      think('energy', 'Weather feed: 41 °C at 13:00. Chiller load will exceed 92%.');
      think('quality', 'Reflow zone 5 on L1 and L2 already +3 °C. Bridge risk rises in about 40 min.');
      S.active.heat.ins = insight({
        agent: 'energy', autoKey: 'applyHeat', level: 'warn', icon: 'sun', conf: 'forecast 2 h', risk: 310000,
        title: 'Heat wave · act before defects appear',
        body: 'Pre-cool the hall now while power is off-peak, and lower the reflow zone-5 setpoint by 3 °C on L1 and L2. This avoids an expected defect rise and a chiller trip this afternoon.',
        actions: [{ key: 'applyHeat', label: 'Apply heat plan', primary: true }, { key: 'energy', label: 'Open energy' }],
        scenario: 'heat'
      });
    },
    power() {
      if (S.active.power) return;
      S.active.power = { at: S.real };
      const inc = incident({ title: 'Grid voltage dip · SMT lines tripped', area: 'SMT', rootKey: 'GRID.DIP', confidence: 0.99, cause: 'Utility voltage dip of 18% for 400 ms' });
      raise('GRID.DIP', { prio: 1, area: 'UTIL', tag: 'GRID.VOLTAGE', msg: 'Voltage dip 18% for 400 ms', incident: inc.id });
      ['L1', 'L2'].forEach(id => { line(id).paused = true; raise(id + '.TRIP', { prio: 2, area: id, tag: 'LINE.TRIP', msg: `${line(id).name} tripped on undervoltage`, incident: inc.id }); inc.members.push(id + '.TRIP'); });
      think('energy', 'Voltage dip detected. SMT lines tripped; UPS held the controllers.');
      think('quality', '38 boards were inside reflow ovens during the dip. Flagged for 100% re-inspection.');
      think('energy', 'Restarting lines one by one, 20 s apart, to avoid an inrush peak.');
      audit('Energy agent', 'Staggered restart', 'L1 then L2, 20 s apart · 38 boards held for re-inspection');
      insight({ agent: 'energy', level: 'crit', icon: 'refresh', conf: 'event',
        title: 'Voltage dip · SMT lines restarting safely',
        body: '38 boards that were in the ovens are held for re-inspection. Lines restart one by one to avoid a demand spike. Expected loss: 9 minutes instead of 40.' });
      toast('Grid dip: SMT lines restarting one by one', 'warning');
      later(5, () => { line('L1').paused = false; log('EMS', 'L1 restarted'); });
      later(7, () => { line('L2').paused = false; log('EMS', 'L2 restarted'); });
      later(9, () => { closeIncident(inc); delete S.active.power; done('energy', 220000); S.saved += 220000; toast('Both SMT lines running again. 31 minutes of downtime avoided.', 'success'); });
    },
    surge() {
      if (S.active.surge) return;
      S.active.surge = { at: S.real };
      think('planner', 'New export order: +20% volume for 3 weeks.');
      think('planner', 'Twin result: Final Assembly A becomes the bottleneck on day 2. A third shift on L3 only closes the gap.');
      S.active.surge.ins = insight({
        agent: 'planner', autoKey: 'acceptPlan', level: 'info', icon: 'sparkles', conf: 'simulated on twin',
        title: 'Export order +20% · plan ready',
        body: 'The twin shows Final Assembly A is the only bottleneck. A third shift on that line alone delivers the order on time and costs far less than plant-wide overtime.',
        actions: [{ key: 'acceptPlan', label: 'Accept plan', primary: true }, { key: 'simulator', label: 'Open what-if' }],
        scenario: 'surge'
      });
    }
  };

  function act(id, key, who) {
    who = who || 'You';
    const ins = S.insights.find(i => i.id === id);
    if (key === 'schedule' && S.active.bearing) {
      const b = S.active.bearing, mb = st('L1', 'Mounter B');
      b.scheduled = true; mb.degrade = 0;
      const wo = S.workOrders.find(w => w.mid === mb.id && w.status !== 'Completed');
      if (wo) { wo.status = 'Scheduled 14:00'; wo.level = 'info'; emit({ type: 'workorders' }); }
      audit(who, 'Approved repair', `${wo ? wo.id : 'Work order'} · Mounter B bearing at 14:00`);
      resolve(id, { agent: 'maint', level: 'info', icon: 'calendar', title: 'Repair scheduled · Mounter B', body: 'Work order approved. Bearing kit reserved and Eng. Sara assigned. The line keeps running at reduced speed until the shift change.', conf: 'planned' });
      think('maint', 'Repair approved. Kit B-07 reserved, Eng. Sara assigned.');
      log('CMMS', `${wo ? wo.id : 'WO'} approved · bearing kit reserved from store B-07`);
      later(6, () => { mb.state = 'maint'; clearAlarm('L1-MounterB.VIB'); log('CMMS', 'Planned stop: Mounter B bearing replacement'); });
      later(13, () => {
        mb.state = 'run'; mb.health = 99; delete S.active.bearing;
        S.saved += 1600000; done('maint', 1600000);
        if (wo) { wo.status = 'Completed'; wo.level = 'ok'; emit({ type: 'workorders' }); }
        S.insights.filter(i => i.title.startsWith('Repair scheduled')).forEach(i => resolve(i.id));
        insight({ agent: 'maint', level: 'ok', icon: 'checkCircle', title: 'Breakdown avoided · Mounter B', body: 'Bearing replaced in a 25-minute planned stop. 4.5 hours of unplanned downtime avoided, about 810 boards protected, about EGP 1.6M saved.', conf: 'resolved' });
        toast('Breakdown avoided: about EGP 1.6M saved by one prediction', 'success');
      });
    } else if (key === 'applyFix' && S.active.solder) {
      const l = line('L2'), pr = st('L2', 'Printer');
      pr.state = 'warn';
      resolve(id);
      audit(who, 'Recalibrated printer', 'SMT Line 2 · squeegee pressure 6.8 → 5.5 kg · stencil wipe');
      log('AI', 'L2 printer pressure set 6.8 → 5.5 kg · stencil wipe');
      later(3, () => {
        l.defectMult = 1; pr.state = 'run'; st('L2', 'AOI').state = 'run'; delete S.active.solder;
        clearAlarm('L2-AOI.REJ');
        S.saved += 240000; done('quality', 240000);
        insight({ agent: 'quality', level: 'ok', icon: 'checkCircle', title: 'Yield restored · SMT Line 2', body: 'First-pass yield is back to 99.1%. About 140 boards a day of rework avoided, about EGP 240k saved this week.', conf: 'resolved' });
        toast('Yield restored on SMT Line 2 in 3 minutes, without stopping', 'success');
      });
    } else if (key === 'applyEnergy' && S.active.peak) {
      resolve(id);
      delete S.active.peak; S.tariff = 'Peak (optimised)';
      clearAlarm('UTIL.PEAK');
      S.saved += 41000; done('energy', 41000);
      audit(who, 'Applied energy schedule', 'Compressor #3 staggered +20 min · chiller pre-cool moved off-peak');
      insight({ agent: 'energy', level: 'ok', icon: 'checkCircle', title: 'Peak demand flattened', body: 'Demand is back under 960 kW with no effect on output. About EGP 41k a month and 9 t of CO₂ a year saved.', conf: 'resolved' });
      toast('Energy schedule applied: peak flattened, output unchanged', 'success');
      later(30, () => { if (!S.active.peak) S.tariff = 'Standard'; });
    } else if (key === 'applyHeat' && S.active.heat) {
      resolve(id);
      S.active.heat.fixed = true;
      audit(who, 'Applied heat plan', 'Pre-cool started · reflow zone 5 setpoint −3 °C on L1 and L2');
      clearAlarm('ENV.HEAT');
      S.saved += 310000; done('energy', 310000);
      insight({ agent: 'energy', level: 'ok', icon: 'checkCircle', title: 'Plant ready for the heat wave', body: 'Pre-cooling is running off-peak and the reflow profile has been adjusted. Expected defect rise and chiller trip avoided.', conf: 'resolved' });
      toast('Heat plan applied before any defect appeared', 'success');
      later(40, () => { delete S.active.heat; S.ambient = 31; });
    } else if (key === 'resequence' && S.active.supplier) {
      resolve(id);
      clearAlarm('SCM.PANELS');
      S.saved += 450000; done('planner', 450000);
      audit(who, 'Approved new plan', 'Move 900 TV units to tomorrow · pull forward EX-2210 on Final Assembly B');
      insight({ agent: 'planner', level: 'ok', icon: 'checkCircle', title: 'Plan updated · no delivery missed', body: 'MES and the warehouse have the new sequence. Both assembly lines stay busy and customer dates hold.', conf: 'resolved' });
      toast('New plan approved: no line idle, no delivery missed', 'success');
      later(20, () => { delete S.active.supplier; });
    } else if (key === 'acceptPlan' && S.active.surge) {
      resolve(id);
      done('planner', 0);
      audit(who, 'Accepted capacity plan', 'Targeted third shift on Final Assembly A for 3 weeks');
      toast('Plan accepted: third shift on Final Assembly A only', 'success');
      later(20, () => { delete S.active.surge; });
    }
    emit({ type: 'acted', id, key, insight: ins });
  }

  /* ---------------- control (with audit trail) ---------------- */
  function control(lineId, patch, who) {
    const l = line(lineId); if (!l) return;
    const before = { speed: l.speed, stopped: l.stopped };
    if (patch.speed !== undefined) l.speed = clamp(patch.speed, 0.8, 1.15);
    if (patch.stopped !== undefined) l.stopped = !!patch.stopped;
    const parts = [];
    if (patch.speed !== undefined && before.speed !== l.speed) parts.push(`speed ${Math.round(before.speed * 100)}% → ${Math.round(l.speed * 100)}%`);
    if (patch.stopped !== undefined && before.stopped !== l.stopped) parts.push(l.stopped ? 'stopped' : 'started');
    if (parts.length) {
      audit(who || 'You', 'Changed ' + l.name, parts.join(' · '));
      log('CTRL', `${l.name}: ${parts.join(' · ')}`, l.stopped ? 'warn' : 'info');
      if (l.stopped) raise(l.id + '.MANUAL', { prio: 3, area: l.id, tag: 'LINE.MANUAL.STOP', msg: `${l.name} stopped by operator` });
      else clearAlarm(l.id + '.MANUAL');
    }
    emit({ type: 'control' });
  }
  // what the twin expects if a change is applied (shown before "Apply")
  function preview(lineId, speed) {
    const l = line(lineId);
    const fpyAt = s => 1 - (1 - l.fpy) * (1 + Math.max(0, s - 1) * 6);
    return {
      tph: l.rate * speed * l.availBase * l.perf, tphNow: l.rate * l.speed * l.availBase * l.perf,
      fpy: fpyAt(speed), fpyNow: fpyAt(l.speed),
      kw: l.kw * (0.85 + 0.15 * speed), kwNow: l.kw * (0.85 + 0.15 * l.speed)
    };
  }

  /* ---------------- forecasts ---------------- */
  function unitsToday() { return Math.round(S.unitsBase + S.lines.reduce((a, l) => a + l.produced, 0)); }
  function planAt(t) { return Math.round(S.lines.reduce((a, l) => a + l.rate, 0) * 0.86 * (t - 6 * 3600) / 3600); }
  function forecast() {
    const remH = Math.max(0, (SHIFT_END - S.t) / 3600);
    const risks = S.alarms.filter(a => a.state !== 'cleared' && a.prio <= 2).length + machines().filter(m => m.degrade > 0).length;
    const units = unitsToday();
    const rate = S.lines.reduce((a, l) => a + (l.stopped ? 0 : l.rate * l.speed * l.availBase * l.perf), 0);
    const p50 = units + rate * remH * (1 - 0.012 * risks);
    const spread = rate * remH * (0.025 + 0.02 * risks);
    const plan = planAt(SHIFT_END);
    const sigma = Math.max(1, spread / 1.28);
    const z = (p50 - plan) / sigma;
    const prob = 1 / (1 + Math.exp(-1.7 * z));
    return { remH, units, p50, p10: p50 - spread, p90: p50 + rate * remH * 0.025, plan, prob, risks, rate };
  }
  function failureRisk(m) {
    if (m.state === 'down') return 1;
    if (m.degrade > 0) return clamp(24 / Math.max(1, rulHours(m)), 0.05, 0.99);
    return clamp((100 - m.health) / 420, 0.004, 0.25);
  }
  function healthScore() {
    const open = S.alarms.filter(a => a.state !== 'cleared');
    const p1 = open.filter(a => a.prio === 1).length, p2 = open.filter(a => a.prio === 2).length;
    const machineRisk = machines().reduce((a, m) => a + failureRisk(m), 0) / machines().length;
    return Math.round(clamp(S.oee / 0.9 * 70 + (S.fpy - 0.95) * 400 - p1 * 9 - p2 * 3 - machineRisk * 60, 0, 100));
  }

  /* ---------------- autoplay story ---------------- */
  const STORY = [[8, 'material'], [18, 'bearing'], [75, 'solder'], [112, 'peak'], [140, 'safety'], [165, 'supplier'], [195, 'breakdown']];
  const CYCLE = 240;
  let autoplay = true, lastStoryT = -1;
  function story() {
    if (!autoplay) return;
    const t = S.real % CYCLE, prev = lastStoryT; lastStoryT = t;
    for (const [at, sc] of STORY) {
      const crossed = prev <= t ? (prev < at && t >= at) : (t >= at || prev < at);
      if (crossed) scenarios[sc]();
    }
  }

  /* ---------------- loop ---------------- */
  let last = 0, running = false;
  function loop(ts) {
    if (!running) return;
    const dt = last ? Math.min(0.1, (ts - last) / 1000) : 0.016;
    last = ts;
    tick(dt);
    story();
    emit({ type: 'tick', dt });
    requestAnimationFrame(loop);
  }

  g.Sim = {
    SIM_SPEED, SCENARIOS, SHIFT_END,
    get state() { return S; },
    on(fn) { listeners.push(fn); },
    start() { if (!S) reset(); running = true; last = 0; requestAnimationFrame(loop); },
    reset() { reset(); lastStoryT = -1; },
    trigger(name) { if (scenarios[name]) { audit('You', 'Started scenario', (SCENARIOS.find(s => s.id === name) || {}).title || name); scenarios[name](); } },
    act, control, preview, clock, line, st, machines, allStations, rulHours, agent,
    forecast, failureRisk, healthScore, unitsToday, planToday: () => planAt(S.t), planAt,
    setAutonomy(id, level) {
      const a = agent(id); if (!a || a.locked) return;
      a.autonomy = level;
      audit('You', 'Changed autonomy', `${a.name} → ${level === 'auto' ? 'Auto (within guardrails)' : level === 'approve' ? 'Ask for approval' : 'Advise only'}`);
      think(id, `Autonomy changed to ${level === 'auto' ? 'Auto' : level === 'approve' ? 'Ask for approval' : 'Advise only'}.`);
    },
    ackAlarm(id) {
      const a = S.alarms.find(x => x.id === id); if (!a || a.state !== 'active') return;
      a.state = 'ack'; audit('You', 'Acknowledged alarm', `${a.tag} · ${a.msg}`); emit({ type: 'alarms' });
    },
    ackAll() {
      const n = S.alarms.filter(a => a.state === 'active').length;
      S.alarms.forEach(a => { if (a.state === 'active') a.state = 'ack'; });
      if (n) audit('You', 'Acknowledged all alarms', n + ' alarms');
      emit({ type: 'alarms' });
    },
    shelve(id) {
      const a = S.alarms.find(x => x.id === id); if (!a) return;
      a.shelved = S.real + 60; audit('You', 'Shelved alarm for 20 min', a.tag); emit({ type: 'alarms' });
    },
    setAutoplay(v) { autoplay = v; },
    get autoplay() { return autoplay; }
  };
})(window);
