/* Digital Factory — plant simulation engine.
   Pure model: no DOM. The UI subscribes with Sim.on(fn) and reads Sim.state. */
(function (g) {
  'use strict';

  const SIM_SPEED = 20;            // simulated seconds per real second
  const START = 9 * 3600 + 12 * 60; // 09:12
  const HIST = 120;                // telemetry points kept per series
  const DOWNTIME_COST_HR = 355000; // EGP per hour of lost output (illustrative)

  const rnd = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const ema = (prev, v, k) => prev + (v - prev) * k;

  const LINE_DEFS = [
    { id: 'L1', name: 'SMT Line 1', sub: 'Main boards', rate: 180, kw: 210, fpy: 0.988, inspect: 'AOI',
      stations: ['Loader', 'Printer', 'SPI', 'Mounter A', 'Mounter B', 'Reflow', 'AOI', 'Unloader'] },
    { id: 'L2', name: 'SMT Line 2', sub: 'Power boards', rate: 220, kw: 165, fpy: 0.991, inspect: 'AOI',
      stations: ['Loader', 'Printer', 'SPI', 'Mounter C', 'Reflow', 'AOI', 'Unloader'] },
    { id: 'L3', name: 'Final Assembly A', sub: '55" TV', rate: 92, kw: 88, fpy: 0.993, inspect: 'Function test', material: 'Back covers',
      stations: ['Panel load', 'Board fit', 'Screw robot', 'Back cover', 'Function test'] },
    { id: 'L4', name: 'Final Assembly B', sub: '27" Monitor', rate: 118, kw: 72, fpy: 0.994, inspect: 'Function test',
      stations: ['Stand fit', 'Board fit', 'Screw robot', 'Calibration', 'Function test'] },
    { id: 'L5', name: 'Test & Pack', sub: 'All products', rate: 205, kw: 124, fpy: 0.997, inspect: 'Final QC',
      stations: ['Burn-in', 'Final QC', 'Packing', 'Palletizer'] }
  ];
  const UTIL_KW = 245; // compressors, chillers, HVAC
  const MACHINE_KINDS = ['Printer', 'Mounter', 'Reflow', 'Screw robot', 'Burn-in', 'Palletizer', 'Calibration', 'SPI', 'AOI'];

  const listeners = [];
  const emit = e => listeners.forEach(fn => fn(e));

  let S; // state
  let insightSeq = 0;

  function makeStation(line, name, i, n) {
    const isMachine = MACHINE_KINDS.some(k => name.startsWith(k));
    const health = rnd(84, 99);
    const st = {
      id: `${line.id}-${name.replace(/\W+/g, '')}`, name, line: line.id, idx: i,
      x: 0.07 + 0.86 * (i / (n - 1)),
      state: 'run', machine: isMachine, health,
      vibBase: rnd(1.1, 2.2), tempBase: name.startsWith('Reflow') ? rnd(238, 246) : rnd(36, 48),
      vib: 0, temp: 0, cycle: 3600 / line.rate,
      degrade: 0, hist: { vib: [], temp: [], cycle: [] }
    };
    return st;
  }

  function reset() {
    insightSeq = 0;
    S = {
      t: START, real: 0, saved: 0, alerts: 0, energyKwh: 0, unitsBase: 2390,
      tariff: 'Standard', utilKw: UTIL_KW, utilExtra: 0,
      oee: 0.864, tph: 0, fpy: 0.99, kw: 0,
      kwHist: [], oeeHist: [],
      active: {}, insights: [], workOrders: [], timers: [],
      defects: { 'Solder bridge': 9, 'Missing component': 5, 'Tombstone': 3, 'Misalignment': 7, 'Insufficient solder': 4, 'Scratch / cosmetic': 2 },
      agvs: [
        { id: 'AGV-01', p: 0.05, speed: 0.035, task: null },
        { id: 'AGV-02', p: 0.45, speed: 0.03, task: null },
        { id: 'AGV-03', p: 0.75, speed: 0.032, task: null }
      ],
      lines: LINE_DEFS.map(d => {
        const line = Object.assign({}, d, {
          units: [], spawnAcc: 0, produced: 0, good: 0, defectMult: 1,
          oee: rnd(0.84, 0.9), perf: rnd(0.93, 0.97), availBase: rnd(0.9, 0.935), tph: d.rate * 0.95, fpyNow: d.fpy,
          matName: d.material, material: d.material ? 78 : null, starved: false
        });
        line.stations = d.stations.map((n, i) => makeStation(line, n, i, d.stations.length));
        return line;
      })
    };
    // pre-fill visual units so the floor looks busy immediately
    for (const l of S.lines) for (let x = 0.02; x < 0.98; x += rnd(0.07, 0.12)) l.units.push({ x, defect: false, flagged: false, out: 0 });
    // one machine already showing mild wear — gives the maintenance view a realistic spread
    const reflow = st('L2', 'Reflow'); reflow.health = 63;
    // warm up telemetry history
    for (let i = 0; i < HIST; i++) tick(0.25, true);
    S.real = 0;
    emit({ type: 'reset' });
    log('MES', 'Shift A running · 5 lines · plan 5,870 units / shift', 'info');
  }

  function line(id) { return S.lines.find(l => l.id === id); }
  function st(lineId, name) { return line(lineId).stations.find(s => s.name === name); }
  function allStations() { return S.lines.flatMap(l => l.stations); }
  function machines() { return allStations().filter(s => s.machine); }

  function clock(t = S.t) {
    const h = Math.floor(t / 3600) % 24, m = Math.floor(t / 60) % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
  function log(src, msg, level = 'info') { emit({ type: 'log', time: clock(), src, msg, level }); }
  function toast(msg, level = 'ok') { emit({ type: 'toast', msg, level }); }
  function later(sec, fn) { S.timers.push({ at: S.real + sec, fn }); }

  function insight(o) {
    const ins = Object.assign({ id: ++insightSeq, time: clock(), level: 'info', actions: [] }, o);
    S.insights.unshift(ins); S.insights = S.insights.slice(0, 12);
    if (ins.level === 'crit' || ins.level === 'warn') S.alerts++;
    emit({ type: 'insight', insight: ins });
    return ins;
  }
  function resolve(id, replacement) {
    S.insights = S.insights.filter(i => i.id !== id);
    emit({ type: 'resolve', id });
    if (replacement) insight(replacement);
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
    S.t += warm ? 0 : dts;

    // timers
    if (!warm) {
      const due = S.timers.filter(t => t.at <= S.real);
      S.timers = S.timers.filter(t => t.at > S.real);
      due.forEach(t => t.fn());
    }

    let tphSum = 0, oeeW = 0, fpyW = 0, rateSum = 0, kw = 0;
    for (const l of S.lines) {
      // station health & telemetry
      let blocked = false, slow = false;
      for (const s of l.stations) {
        if (s.degrade > 0 && s.state !== 'down' && s.state !== 'maint') s.health = clamp(s.health - s.degrade * dt, 0, 100);
        const wear = 100 - s.health;
        s.vib = s.state === 'down' || s.state === 'maint' ? rnd(0.05, 0.2) : s.vibBase + wear * 0.065 + rnd(-0.18, 0.18) + (wear > 30 ? rnd(0, wear * 0.012) : 0);
        s.temp = s.state === 'down' ? ema(s.temp || s.tempBase, s.tempBase * 0.7, 0.02) : s.tempBase + wear * 0.12 + rnd(-0.6, 0.6);
        const busy = s.state === 'run' || s.state === 'warn';
        s.cycle = busy ? (3600 / l.rate) * (1 + (s.state === 'warn' ? 0.16 : 0) + rnd(-0.03, 0.03)) : 0;
        if (s.state === 'down' || s.state === 'maint') blocked = true;
        if (s.state === 'warn') slow = true;
        if (!warm || Math.random() < 0.6) {
          s.hist.vib.push(+s.vib.toFixed(2)); s.hist.temp.push(+s.temp.toFixed(1)); s.hist.cycle.push(+s.cycle.toFixed(1));
          for (const k in s.hist) if (s.hist[k].length > HIST) s.hist[k].shift();
        }
      }
      // material
      if (l.material !== null) {
        l.material = clamp(l.material - dt * (S.active.material ? 1.6 : 0.25), 0, 100);
        if (l.material < 40 && !S.active.material && !l.restocking) routineRestock(l);
        l.starved = l.material <= 0;
      }
      const avail = blocked || l.starved ? 0 : 1;
      const perf = slow ? 0.8 : l.perf + rnd(-0.01, 0.01);
      const defectRate = (1 - l.fpy) * l.defectMult;
      const q = 1 - defectRate;
      const inst = avail * l.availBase * perf * q;
      l.oee = ema(l.oee, inst, warm ? 0.05 : Math.min(1, dt * 0.18));
      l.fpyNow = ema(l.fpyNow, q, Math.min(1, dt * 0.3));
      const tph = l.rate * avail * l.availBase * perf;
      l.tph = ema(l.tph, tph, Math.min(1, dt * 0.4));
      if (!warm) { const made = tph * dts / 3600; l.produced += made; l.good += made * q; }
      tphSum += l.tph; oeeW += l.oee * l.rate; fpyW += l.fpyNow * l.rate; rateSum += l.rate;
      l.kwNow = l.kw * (avail ? 1 : 0.42) * rnd(0.97, 1.03);
      kw += l.kwNow;

      // visual units
      flow(l, dt, blocked || l.starved, defectRate);
    }
    S.utilExtra = ema(S.utilExtra, S.active.peak ? 230 : 0, Math.min(1, dt * 0.5));
    const utilNow = (S.utilKw + S.utilExtra) * rnd(0.98, 1.02);
    kw += utilNow; S.utilNow = utilNow;
    S.kw = kw; S.tph = tphSum; S.oee = oeeW / rateSum; S.fpy = fpyW / rateSum;
    if (!warm) S.energyKwh += kw * dts / 3600;

    // AGVs
    for (const a of S.agvs) {
      if (a.task) {
        a.task.k = clamp(a.task.k + dt / a.task.dur, 0, 1);
        if (a.task.k >= 1) { const done = a.task.done; a.task = null; done && done(); }
      } else a.p = (a.p + a.speed * dt) % 1;
    }

    S._histAcc = (S._histAcc || 0) + dt;
    if (S._histAcc >= 1 || warm) {
      S._histAcc = 0;
      S.kwHist.push(Math.round(kw)); S.oeeHist.push(S.oee);
      if (S.kwHist.length > HIST) S.kwHist.shift();
      if (S.oeeHist.length > HIST) S.oeeHist.shift();
    }

    if (!warm) watchdogs();
  }

  function flow(l, dt, stopped, defectRate) {
    const v = 0.055 * (l.rate / 160) ** 0.3;
    const gap = 0.045;
    const down = l.stations.filter(s => s.state === 'down' || s.state === 'maint').map(s => s.x).sort((a, b) => a - b);
    const insp = l.stations.find(s => s.name === l.inspect);
    l.units.sort((a, b) => b.x - a.x);
    for (let i = 0; i < l.units.length; i++) {
      const u = l.units[i];
      if (u.flagged) { u.out += dt * 1.6; continue; }
      let limit = 1.06;
      if (i > 0) { const ahead = l.units.slice(0, i).find(o => !o.flagged); if (ahead) limit = ahead.x - gap; }
      const block = down.find(x => x > u.x - 0.001);
      if (block !== undefined) limit = Math.min(limit, block - 0.03);
      if (l.starved) limit = Math.min(limit, u.x);
      const nx = Math.min(u.x + v * dt, limit);
      if (insp && u.x < insp.x && nx >= insp.x && u.defect) { u.flagged = true; u.x = insp.x; S.lastFlag = { line: l.id, t: S.real }; continue; }
      u.x = Math.max(u.x, nx);
    }
    l.units = l.units.filter(u => u.x < 1.04 && u.out < 1);
    // spawn
    if (!l.starved) {
      l.spawnAcc += dt;
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
    agv.task = { line: l.id, k: 0, dur: 7, routine: true, done: () => { l.material = 100; l.restocking = false; log('AGV', `${agv.id} delivered ${l.matName.toLowerCase()} to ${l.name}`, 'info'); } };
    log('AGV', `${agv.id} dispatched → ${l.name} (routine replenishment)`, 'info');
  }

  /* ---------------- watchdogs: AI reacting to state ---------------- */
  function watchdogs() {
    // Bearing degradation
    const mb = st('L1', 'Mounter B');
    const b = S.active.bearing;
    if (b) {
      if (!b.alerted && mb.health < 72) {
        b.alerted = true; mb.state = 'warn';
        b.ins = insight({
          level: 'warn', icon: '⚙️', conf: '94% confidence', station: mb.id,
          title: 'Bearing failure predicted · Mounter B',
          body: `Spindle bearing vibration ${mb.vib.toFixed(1)} mm/s and rising (+${Math.round((mb.vib / mb.vibBase - 1) * 100)}% vs. baseline). Remaining useful life ≈ ${Math.round(rulHours(mb))} h. Replace during the 14:00 shift change: 25-min planned stop instead of ~4.5 h unplanned breakdown.`,
          actions: [{ key: 'schedule', label: 'Schedule repair at 14:00', primary: true }, { key: 'inspect', label: 'Show machine' }],
          scenario: 'bearing'
        });
        S.workOrders.unshift({ id: 'WO-' + (4810 + S.workOrders.length), title: 'Replace spindle bearing · Mounter B (L1)', status: 'Awaiting approval', level: 'warn', mid: mb.id });
        emit({ type: 'workorders' });
        log('AI', 'Mounter B: anomaly score 0.93 → RUL model triggered', 'warn');
      }
      if (b.alerted && !b.scheduled && mb.health <= 30 && mb.state !== 'down') {
        mb.state = 'down';
        if (b.ins) resolve(b.ins.id);
        insight({
          level: 'crit', icon: '🛑', station: mb.id, conf: 'event',
          title: 'Mounter B stopped · SMT Line 1 down',
          body: 'Spindle bearing seized. The AI flagged this ≈ 40 h in advance but the warning was not actioned. Estimated unplanned repair: 4.5 h · ≈ 810 boards lost.',
          actions: [{ key: 'inspect', label: 'Show machine' }]
        });
        log('PLC', 'L1 Mounter B — E-STOP · servo overload', 'crit');
        toast('🛑 SMT Line 1 stopped — Mounter B bearing seized', 'crit');
        const wo = S.workOrders.find(w => w.mid === mb.id && w.status !== 'Completed');
        if (wo) { wo.status = 'Emergency repair'; wo.level = 'crit'; emit({ type: 'workorders' }); }
        later(22, () => {
          mb.health = 98; mb.degrade = 0; mb.state = 'run'; delete S.active.bearing;
          if (wo) { wo.status = 'Completed'; wo.level = 'ok'; emit({ type: 'workorders' }); }
          log('MES', 'L1 Mounter B restored after unplanned repair', 'info');
          toast('SMT Line 1 back online after unplanned repair', 'ok');
        });
      }
    }
    // Solder drift → defects detected
    const sd = S.active.solder;
    if (sd && !sd.alerted && S.real - sd.at > 5) {
      sd.alerted = true;
      sd.ins = insight({
        level: 'warn', icon: '🔬', conf: 'correlation 0.91',
        title: 'Solder-bridge defects up 4.2× · SMT Line 2',
        body: 'Root cause found: stencil-printer squeegee pressure drifted 5.2 → 6.8 kg over 40 min. Recommended: auto-recalibrate to 5.5 kg and run a stencil wipe. No line stop needed.',
        actions: [{ key: 'applyFix', label: 'Apply fix now', primary: true }, { key: 'quality', label: 'Open AI Quality' }],
        scenario: 'solder'
      });
      log('AI', 'Vision: bridge cluster on L2, pads U14/U15 — correlated with printer pressure', 'warn');
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
      log('IoT', 'L1 Mounter B: vibration RMS trending up', 'info');
    },
    solder() {
      if (S.active.solder) return;
      const l = line('L2'); l.defectMult = 4.2;
      st('L2', 'AOI').state = 'warn';
      S.active.solder = { at: S.real };
      log('AOI', 'L2 AOI: reject rate rising', 'info');
    },
    material() {
      if (S.active.material) return;
      const l = line('L3'); l.material = Math.min(l.material, 26);
      S.active.material = { at: S.real };
      later(3, () => {
        const ins = insight({
          level: 'info', icon: '📦', conf: 'autonomous action',
          title: 'Back covers run out on Final Assembly A in 14 min',
          body: 'Consumption is 18% above plan (larger batch released by MES). AI has already dispatched AGV-02 from Warehouse B — ETA 4 min. No action needed.',
          actions: []
        });
        log('AI', 'Shortage forecast L3 → AGV-02 auto-dispatched', 'info');
        // cancel any routine run to L3 and send AGV-02 on a priority mission
        S.agvs.forEach(a => { if (a.task && a.task.line === 'L3') a.task = null; });
        const agv = S.agvs[1];
        line('L3').restocking = true;
        agv.task = { line: 'L3', k: 0, dur: 9, priority: true, done: () => {
            line('L3').material = 100; delete S.active.material; line('L3').restocking = false;
            resolve(ins.id, { level: 'ok', icon: '✅', title: 'Stoppage avoided on Final Assembly A', body: 'AGV-02 delivered 120 back covers. Line never stopped — zero human intervention.', conf: 'resolved' });
            toast('✅ Material delivered autonomously — Line 3 never stopped', 'ok');
            log('AGV', 'AGV-02 delivered back covers to Final Assembly A', 'info');
          } };
      });
    },
    peak() {
      if (S.active.peak) return;
      S.active.peak = { at: S.real }; S.tariff = 'Peak';
      later(4, () => {
        S.active.peak.ins = insight({
          level: 'warn', icon: '⚡', conf: 'forecast 15 min',
          title: 'Peak-tariff demand spike · 1,180 kW',
          body: 'Chillers and compressor #3 started together during the peak tariff window. Recommended: stagger compressor #3 by 20 min and shift chiller pre-cooling to off-peak. ≈ EGP 41k / month saved, zero output impact.',
          actions: [{ key: 'applyEnergy', label: 'Apply energy schedule', primary: true }, { key: 'energy', label: 'Open Energy' }],
          scenario: 'peak'
        });
      });
      log('EMS', 'Plant demand rising — compressor #3 + chiller start', 'info');
    },
    breakdown() {
      const sr = st('L4', 'Screw robot');
      if (sr.state !== 'run') return;
      sr.state = 'down';
      log('PLC', 'L4 Screw robot — torque fault, cell stopped', 'crit');
      insight({
        level: 'crit', icon: '🛠️', conf: 'diagnosis 88%', station: sr.id,
        title: 'Screw robot jam · Final Assembly B',
        body: 'Copilot diagnosis: torque sensor drift (same signature as 3 past events). Spare part in store A-14. Technician Eng. Mahmoud notified with the repair guide — ETA 6 min.',
        actions: [{ key: 'inspect', label: 'Show machine' }]
      });
      toast('🛠️ Screw robot fault on Line 4 — technician auto-dispatched', 'crit');
      later(14, () => { sr.state = 'run'; log('MES', 'L4 Screw robot back in production (14 min)', 'info'); toast('Line 4 restored — fix time 14 min vs. 55 min average', 'ok'); });
    }
  };

  function act(id, key) {
    const ins = S.insights.find(i => i.id === id);
    if (key === 'schedule' && S.active.bearing) {
      const b = S.active.bearing, mb = st('L1', 'Mounter B');
      b.scheduled = true; mb.degrade = 0;
      const wo = S.workOrders.find(w => w.mid === mb.id && w.status !== 'Completed');
      if (wo) { wo.status = 'Scheduled 14:00'; wo.level = 'info'; emit({ type: 'workorders' }); }
      resolve(id, { level: 'info', icon: '🗓️', title: 'Repair scheduled · Mounter B', body: 'Work order approved. Bearing kit reserved, technician Eng. Sara assigned. Line keeps running at reduced speed until the shift change.', conf: 'planned' });
      log('CMMS', `${wo ? wo.id : 'WO'} approved — bearing kit reserved from store B-07`, 'info');
      later(6, () => { mb.state = 'maint'; log('CMMS', 'Planned stop: Mounter B bearing replacement', 'info'); });
      later(13, () => {
        mb.state = 'run'; mb.health = 99; delete S.active.bearing;
        S.saved += 1600000;
        if (wo) { wo.status = 'Completed'; wo.level = 'ok'; emit({ type: 'workorders' }); }
        S.insights.filter(i => i.title.startsWith('Repair scheduled')).forEach(i => resolve(i.id));
        insight({ level: 'ok', icon: '✅', title: 'Breakdown avoided · Mounter B', body: 'Bearing replaced in a 25-min planned stop. 4.5 h unplanned downtime avoided · ≈ 810 boards protected · ≈ EGP 1.6M saved.', conf: 'resolved' });
        toast('✅ Breakdown avoided — ≈ EGP 1.6M saved on one prediction', 'ok');
      });
    } else if (key === 'applyFix' && S.active.solder) {
      const l = line('L2');
      const pr = st('L2', 'Printer');
      pr.state = 'warn';
      resolve(id);
      log('AI', 'L2 Printer: pressure set 6.8 → 5.5 kg · stencil wipe', 'info');
      later(3, () => {
        l.defectMult = 1; pr.state = 'run'; st('L2', 'AOI').state = 'run'; delete S.active.solder;
        S.saved += 240000;
        insight({ level: 'ok', icon: '✅', title: 'Yield restored · SMT Line 2', body: 'First-pass yield back to 99.1%. ≈ 140 boards/day of rework avoided · ≈ EGP 240k saved this week.', conf: 'resolved' });
        toast('✅ Yield restored on SMT Line 2 — fixed in 3 minutes, without stopping', 'ok');
      });
    } else if (key === 'applyEnergy' && S.active.peak) {
      resolve(id);
      delete S.active.peak; S.tariff = 'Peak (optimised)';
      S.saved += 41000;
      log('EMS', 'Compressor #3 staggered +20 min · chiller pre-cool shifted', 'info');
      insight({ level: 'ok', icon: '🌱', title: 'Peak demand flattened', body: 'Demand back under 960 kW without touching output. ≈ EGP 41k/month and 9 t CO₂/yr saved.', conf: 'resolved' });
      toast('🌱 Energy schedule applied — peak flattened, output unchanged', 'ok');
      later(30, () => { if (!S.active.peak) S.tariff = 'Standard'; });
    }
    emit({ type: 'acted', id, key, insight: ins });
  }

  /* ---------------- autoplay story ---------------- */
  const STORY = [[8, 'material'], [18, 'bearing'], [75, 'solder'], [120, 'peak'], [150, 'breakdown']];
  const CYCLE = 190;
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
    SIM_SPEED, DOWNTIME_COST_HR,
    get state() { return S; },
    on(fn) { listeners.push(fn); },
    start() { if (!S) reset(); running = true; last = 0; requestAnimationFrame(loop); },
    reset() { reset(); lastStoryT = -1; },
    trigger(name) { scenarios[name] && scenarios[name](); },
    act, clock, line, st, machines, allStations, rulHours,
    setAutoplay(v) { autoplay = v; },
    get autoplay() { return autoplay; },
    unitsToday() { return Math.round(S.unitsBase + S.lines.reduce((a, l) => a + l.produced, 0)); },
    planToday() { const elapsed = (S.t - 6 * 3600) / 3600; return Math.round(S.lines.reduce((a, l) => a + l.rate, 0) * 0.9 * elapsed); }
  };
})(window);
