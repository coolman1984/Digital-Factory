/* Digital Factory — Plant EG-01 live twin engine.
   A unit-level model of the whole fictional plant: raw-material warehouse, two SMT lines, a board supermarket, two
   assembly lines (TVs and smartphones), burn-in, final QC, packing, palletizing, finished goods, shipping, AGVs,
   forklifts, people, energy, orders and an AI layer that predicts and recommends. Every unit carries a serial and its
   genealogy. Pure model: no DOM, deterministic random numbers. All data is simulated.
   Coordinates are metres: x east, z south. Time is plant seconds since midnight. */
(function (root) {
  'use strict';

  /* ---------------- helpers ---------------- */
  function mulberry(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const ema = (p, v, k) => p + (v - p) * k;
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const pad = (n, w) => String(n).padStart(w, '0');
  const clock = t => `${pad(Math.floor(t / 3600) % 24, 2)}:${pad(Math.floor(t / 60) % 60, 2)}`;
  const clockS = t => `${clock(t)}:${pad(Math.floor(t) % 60, 2)}`;
  const mins = s => {
    if (!isFinite(s)) return '—';
    s = Math.max(0, Math.round(s));
    return s >= 3600 ? `${Math.floor(s / 3600)} h ${pad(Math.floor(s / 60) % 60, 2)} min` : `${Math.floor(s / 60)}:${pad(s % 60, 2)} min`;
  };
  function polyLen(p) { let L = 0; for (let i = 1; i < p.length; i++) L += dist(p[i - 1], p[i]); return L; }
  function polyAt(p, s) {
    for (let i = 1; i < p.length; i++) {
      const d = dist(p[i - 1], p[i]);
      if (s <= d || i === p.length - 1) {
        const k = d ? clamp(s / d, 0, 1) : 0;
        return [p[i - 1][0] + (p[i][0] - p[i - 1][0]) * k, p[i - 1][1] + (p[i][1] - p[i - 1][1]) * k, Math.atan2(p[i][1] - p[i - 1][1], p[i][0] - p[i - 1][0])];
      }
      s -= d;
    }
    return [p[0][0], p[0][1], 0];
  }

  const START = 9 * 3600 + 12 * 60;      // 09:12, shift A runs 06:00–14:00
  const SHIFT_START = 6 * 3600, SHIFT_END = 14 * 3600;
  const HIST = 180;                      // samples per telemetry series (one every 5 plant seconds = 15 min)

  /* ---------------- plant definition ---------------- */
  // machine kinds drive the 3D model, the sensors and the power draw (kW: run, idle, down)
  const KIND = {
    loader:   { w: 1.4, d: 1.5, h: 1.5, kw: [1.2, 0.6, 0.2] },
    printer:  { w: 1.6, d: 1.7, h: 1.6, kw: [3.5, 1.4, 0.3] },
    spi:      { w: 1.3, d: 1.5, h: 1.6, kw: [2.2, 1.0, 0.3] },
    mounter:  { w: 2.0, d: 2.2, h: 1.6, kw: [6.5, 2.4, 0.4] },
    reflow:   { w: 5.6, d: 1.6, h: 1.5, kw: [48, 30, 2] },
    aoi:      { w: 1.3, d: 1.5, h: 1.6, kw: [2.2, 1.0, 0.3] },
    unloader: { w: 1.4, d: 1.5, h: 1.5, kw: [1.2, 0.6, 0.2] },
    robot:    { w: 3.2, d: 2.6, h: 1.1, kw: [4.5, 1.2, 0.2] },
    bench:    { w: 3.0, d: 2.4, h: 1.0, kw: [0.8, 0.4, 0.1] },
    bond:     { w: 2.6, d: 2.2, h: 1.7, kw: [5.5, 2.0, 0.3] },
    fct:      { w: 3.0, d: 2.4, h: 1.9, kw: [3.0, 1.5, 0.3] },
    burnin:   { w: 20, d: 18, h: 2.4, kw: [0, 4, 1] },     // the TVs and phones inside draw the power
    qc:       { w: 4.0, d: 3.2, h: 2.4, kw: [4.0, 2.0, 0.3] },
    packer:   { w: 4.4, d: 3.0, h: 2.0, kw: [6.0, 2.0, 0.3] },
    palletizer: { w: 4.0, d: 4.0, h: 2.6, kw: [7.5, 1.5, 0.3] },
    repair:   { w: 2.6, d: 1.6, h: 1.0, kw: [0.6, 0.3, 0.1] }
  };

  // lines: stations in flow order; t = cycle seconds (1x real time); slots > 1 = parallel (ovens, racks)
  const LINES = [
    { id: 'L1', name: 'SMT Line 1', sub: 'Main boards', z: 10, x0: 37, gap: 2.0, product: 'main',
      st: [['Loader', 'loader', 6], ['Printer', 'printer', 10.5], ['SPI', 'spi', 10], ['Mounter A', 'mounter', 11.5], ['Mounter B', 'mounter', 11.5],
           ['Reflow', 'reflow', 11.5, 20], ['AOI', 'aoi', 10], ['Unloader', 'unloader', 6]] },
    { id: 'L2', name: 'SMT Line 2', sub: 'Power boards', z: 20, x0: 37, gap: 2.4, product: 'power',
      st: [['Loader', 'loader', 8], ['Printer', 'printer', 20], ['SPI', 'spi', 18], ['Mounter C', 'mounter', 34],
           ['Reflow', 'reflow', 34, 8], ['AOI', 'aoi', 20], ['Unloader', 'unloader', 8]] },
    { id: 'L3', name: 'Final Assembly A', sub: 'TVs', z: 34, x0: 38, gap: 8.2, product: 'tv',
      st: [['Panel load', 'robot', 34], ['Board fit', 'bench', 37], ['Screw robot', 'robot', 32], ['Back cover', 'bench', 36], ['Function test', 'fct', 35]] },
    { id: 'L4', name: 'Final Assembly B', sub: 'Smartphones', z: 45, x0: 38, gap: 8.8, product: 'phone',
      st: [['Housing fit', 'bench', 20], ['Board fit', 'bench', 21], ['Display bond', 'bond', 20], ['Screw robot', 'robot', 18], ['Function test', 'fct', 21]] }
  ];

  const PEOPLE = [
    ['Mona Adel', 'Operator', 'L3-Boardfit'], ['Karim Fathy', 'Operator', 'L3-Backcover'], ['Hana Samir', 'Operator', 'L4-Housingfit'],
    ['Omar Nabil', 'Operator', 'L4-Boardfit'], ['Salma Hany', 'Operator', 'L5-QC'], ['Youssef Ali', 'Operator', 'L5-Packing'],
    ['Nour Ehab', 'Line leader', 'L3'], ['Tamer Reda', 'Line leader', 'SMT'], ['Laila Mostafa', 'Rework', 'REWORK'],
    ['Eng. Sara Kamal', 'Technician', 'SHOP'], ['Eng. Mahmoud Saad', 'Technician', 'SHOP'], ['Ahmed Fouad', 'Forklift', 'FL-1'], ['Rania Gamal', 'Forklift', 'FL-2']
  ];

  const ORDERS = [
    ['SO-7714', 'Domestic retail', 'tv', 96, 10 * 3600 + 30 * 60],
    ['EX-2210', 'Export · Gulf', 'phone', 320, 11 * 3600 + 15 * 60],
    ['SO-7720', 'Domestic retail', 'phone', 200, 12 * 3600],
    ['EX-2214', 'Export · East Africa', 'tv', 160, 13 * 3600 + 10 * 60],
    ['SO-7731', 'E-commerce hub', 'phone', 240, 13 * 3600 + 45 * 60],
    ['EX-2219', 'Export · Europe', 'tv', 120, 15 * 3600]
  ];

  const SCENARIOS = [
    { id: 'bearing', title: 'Bearing wear on Mounter B', area: 'SMT Line 1', agent: 'Maintenance',
      what: 'The spindle bearing on Mounter B starts to wear. Vibration climbs.', chain: 'Mounter B → SMT Line 1 → main-board supermarket → both assembly lines → orders' },
    { id: 'agv', title: 'AGV breaks down mid-route', area: 'Logistics', agent: 'Logistics',
      what: 'AGV-03 stops on the main aisle with a drive fault while carrying a load.', chain: 'AGV-03 → its open mission → the line waiting for it' },
    { id: 'lot', title: 'Bad panel lot reaches the TV line', area: 'Final Assembly A', agent: 'Quality',
      what: 'A supplier lot of TV panels has a pixel defect. Final QC starts failing TVs.', chain: 'Panel lot → TVs built with it → Final QC → rework → order' },
    { id: 'reflow', title: 'Reflow oven drifts hot', area: 'SMT Line 2', agent: 'Quality',
      what: 'Zone 5 on the Line 2 oven drifts +9 °C. Solder defects start at AOI.', chain: 'Oven zone 5 → solder joints → AOI rejects → power-board supply' },
    { id: 'inbound', title: 'Panel truck delayed 3 hours', area: 'Supply chain', agent: 'Planning',
      what: 'The inbound truck with TV panels is held at the port gate.', chain: 'Inbound truck → panel stock → Final Assembly A → TV orders' },
    { id: 'power', title: 'Grid voltage dip', area: 'Utilities', agent: 'Energy',
      what: 'An 18% voltage dip for 400 ms trips the SMT lines and both ovens.', chain: 'Grid → SMT lines and ovens → boards in the ovens → supermarket' },
    { id: 'rush', title: 'Rush order: +240 phones by 12:30', area: 'Planning', agent: 'Planning',
      what: 'A customer adds 240 smartphones due at 12:30.', chain: 'New order → Final Assembly B capacity → packing → shipping dock' },
    { id: 'absent', title: 'Operator called away', area: 'Final Assembly A', agent: 'Planning',
      what: 'The Back cover operator on the TV line is called to another task.', chain: 'Back cover station → TV line takt → TV orders' }
  ];

  /* ---------------- factory ---------------- */
  function create(opts = {}) {
    const R = mulberry(opts.seed || 20261020);
    const rnd = (a, b) => a + R() * (b - a);
    const pick = arr => arr[Math.floor(R() * arr.length)];
    const listeners = [];
    const emit = (type, data) => { for (const fn of listeners) fn(type, data); };

    const P = {
      t: START, speed: 1, paused: false, seq: 0,
      stations: [], byId: {}, lines: {}, segs: [], bufs: {}, sm: { main: [], power: [] },
      agvs: [], forklifts: [], people: [], techs: [], inbound: [], trucks: [], orders: [], pallets: [], fgSlots: [],
      units: new Set(), archive: new Map(), archiveOrder: [], events: [], alarms: [], preds: [], recs: [], audit: [],
      kpi: {}, hist: { t: [], kw: [], tph: [], oee: [], wip: [] }, scen: {}, energy: { kwh: 0, peak: 0 },
      made: { main: 0, power: 0, tv: 0, phone: 0, packedTv: 0, packedPhone: 0 },
      base: { tv: 186, phone: 342 },                   // units packed before the model started (06:00 → warm start)
      rejects: { aoi: 0, fct: 0, qc: 0, smtRepair: [], rework: [] },
      saved: 0, nodes: [], edges: [], layout: {}, leads: []
    };

    /* ----- events, audit, alarms ----- */
    function log(src, msg, level = 'info', ref) {
      const e = { id: ++P.seq, t: P.t, time: clock(P.t), src, msg, level, ref };
      P.events.unshift(e); if (P.events.length > 160) P.events.pop();
      emit('event', e);
      return e;
    }
    function audit(who, action, detail) {
      P.audit.unshift({ time: clock(P.t), who, action, detail }); if (P.audit.length > 60) P.audit.pop();
      emit('audit');
    }
    const alarmMap = new Map();
    function alarm(key, on, o) {
      const a = alarmMap.get(key);
      if (on && !a) {
        const n = Object.assign({ key, id: ++P.seq, t: P.t, time: clock(P.t), state: 'active', prio: 3 }, o);
        alarmMap.set(key, n); P.alarms.unshift(n);
        log(n.area || 'PLC', n.msg, n.prio <= 1 ? 'crit' : n.prio === 2 ? 'warn' : 'info', n.ref);
        emit('alarms');
      } else if (!on && a) {
        alarmMap.delete(key); P.alarms = P.alarms.filter(x => x !== a);
        emit('alarms');
      } else if (on && a && o && o.msg && a.msg !== o.msg) a.msg = o.msg;
    }

    /* ----- units and genealogy ----- */
    const SNP = { main: 'MB', power: 'PB', tv: 'TV', phone: 'PH' };
    let snSeq = 41820;
    function unit(type, extra) {
      const u = Object.assign({ id: ++P.seq, sn: `${SNP[type]}26-${pad(++snSeq, 6)}`, type, born: P.t, steps: [], parts: {}, defect: null, loc: null }, extra);
      P.units.add(u);
      return u;
    }
    function archive(u) {
      P.units.delete(u);
      P.archive.set(u.sn, u); P.archiveOrder.push(u.sn);
      if (P.archiveOrder.length > 4000) P.archive.delete(P.archiveOrder.shift());
    }
    function stepRec(u, st, extra) {
      const s = Object.assign({ st: st.id, name: st.name, line: st.line, t0: P.t, t1: null }, extra);
      u.steps.push(s); return s;
    }
    function findUnit(sn) {
      sn = String(sn).trim().toUpperCase();
      for (const u of P.units) if (u.sn === sn) return u;
      if (P.archive.has(sn)) return P.archive.get(sn);
      for (const u of P.units) for (const k in u.parts) if (u.parts[k] && u.parts[k].sn === sn) return u.parts[k];
      for (const u of P.archive.values()) for (const k in u.parts) if (u.parts[k] && u.parts[k].sn === sn) return u.parts[k];
      return null;
    }

    /* ----- buffers (line-side stock, warehouse, supermarket) ----- */
    function buf(id, o) {
      const b = Object.assign({ id, qty: 0, cap: 100, rop: 30, batch: 60, items: null, lots: null, pending: 0, rate: 0, used: 0, mission: null, node: null }, o);
      P.bufs[id] = b; return b;
    }
    function take(b, n) {
      if (b.items) { if (b.items.length < n) return null; b.used += n; return b.items.splice(0, n); }
      if (b.lots) {
        if (b.qty < n) return null;
        let lot = b.lots[0];
        while (lot && lot.qty <= 0) { b.lots.shift(); lot = b.lots[0]; }
        if (!lot) return null;
        lot.qty -= n; b.qty -= n; b.used += n;
        if (lot.qty <= 0) b.lots.shift();
        return [lot.id];
      }
      if (b.qty < n) return null;
      b.qty -= n; b.used += n; return [true];
    }
    const level = b => b.items ? b.items.length : b.qty;

    /* ----- layout: lines and stations ----- */
    for (const L of LINES) {
      const line = { id: L.id, name: L.name, sub: L.sub, product: L.product, z: L.z, stations: [], speed: 1, stopped: false, made: 0, good: 0,
        oee: 0.86, avail: 0.92, perf: 0.95, qual: 0.99, tph: 0, state: 'run', since: 0, changeover: 0, prodOverride: null };
      let x = L.x0;
      L.st.forEach(([name, kind, cyc, slots], i) => {
        const K = KIND[kind];
        const id = `${L.id}-${name.replace(/\W+/g, '')}`;
        const s = {
          id, name, line: L.id, kind, idx: i, x: x + K.w / 2, z: L.z, w: K.w, d: K.d, h: K.h, base: cyc, slots: slots || 1,
          procs: [], out: null, state: 'idle', since: 0, why: '', health: rnd(86, 99), degrade: 0, repair: 0, tech: null,
          counters: { run: 0, idle: 0, starved: 0, blocked: 0, down: 0, made: 0, bad: 0, std: 0 }, sens: {}, hist: {}, kwNow: 0, speedMul: 1,
          needs: [], manual: kind === 'bench', operator: null, mtbf: kind === 'reflow' ? 9e9 : rnd(9, 20) * 3600, fault: null
        };
        x += K.w + L.gap;
        P.stations.push(s); P.byId[id] = s; line.stations.push(s);
      });
      P.lines[L.id] = line;
    }
    // Test & Pack (L5) and support stations, placed by hand
    const L5 = { id: 'L5', name: 'Test & Pack', sub: 'All products', product: 'mix', stations: [], speed: 1, stopped: false, made: 0, good: 0, oee: 0.87, avail: 0.93, perf: 0.95, qual: 0.995, tph: 0, state: 'run' };
    P.lines.L5 = L5;
    function extra(id, name, kind, x, z, base, slots, line = 'L5', o) {
      const K = KIND[kind];
      const s = Object.assign({ id, name, line, kind, idx: 0, x, z, w: K.w, d: K.d, h: K.h, base, slots: slots || 1, procs: [], out: null, state: 'idle', since: 0, why: '',
        health: rnd(86, 99), degrade: 0, repair: 0, tech: null, counters: { run: 0, idle: 0, starved: 0, blocked: 0, down: 0, made: 0, bad: 0, std: 0 }, sens: {}, hist: {},
        kwNow: 0, speedMul: 1, needs: [], manual: false, operator: null, mtbf: rnd(12, 24) * 3600, fault: null }, o);
      P.stations.push(s); P.byId[id] = s; if (P.lines[line]) P.lines[line].stations.push(s);
      return s;
    }
    const BURN = extra('L5-Burnin', 'Burn-in', 'burnin', 109, 40, 0, 0);
    const QC = extra('L5-QC', 'Final QC', 'qc', 112, 58.5, 11, 1, 'L5', { manual: true });
    const PACK = extra('L5-Packing', 'Packing', 'packer', 100, 58.5, 10, 1, 'L5', { manual: true });
    const PAL = extra('L5-Palletizer', 'Palletizer', 'palletizer', 88, 58.5, 6, 1);
    const SMTREP = extra('SMT-Repair', 'SMT repair bench', 'repair', 79, 22.5, 300, 1, 'SUP', { manual: true, mtbf: 9e9 });
    const REWORK = extra('REWORK', 'Rework bench', 'repair', 94, 49.5, 240, 2, 'SUP', { manual: true, mtbf: 9e9 });
    BURN.idx = 0; QC.idx = 1; PACK.idx = 2; PAL.idx = 3;

    // burn-in rack slots: three TV rows (12 each) and two phone rows (24 each)
    BURN.rack = [];
    for (let r = 0; r < 3; r++) for (let i = 0; i < 12; i++) BURN.rack.push({ kind: 'tv', x: 101 + i * 1.45, z: 32 + r * 3.4, u: null, row: r });
    for (let r = 0; r < 2; r++) for (let i = 0; i < 24; i++) BURN.rack.push({ kind: 'phone', x: 101 + i * 0.72, z: 43.5 + r * 2.6, u: null, row: 3 + r });
    BURN.slots = BURN.rack.length;
    const AGE = { tv: 18 * 60, phone: 10 * 60 };

    /* ----- conveyors (segments with a drawn path) ----- */
    function seg(from, to, path, speed, pitch) {
      const s = { id: `${from ? from.id : 'SRC'}>${to ? to.id : 'SINK'}`, from, to, path, len: polyLen(path), speed, pitch, items: [], moving: true };
      P.segs.push(s);
      if (from) from.outSeg = s;
      if (to) (to.inSegs = to.inSegs || []).push(s);
      return s;
    }
    const exitPt = s => [s.x + s.w / 2, s.z];
    const entryPt = s => [s.x - s.w / 2, s.z];
    for (const id of ['L1', 'L2', 'L3', 'L4']) {
      const st = P.lines[id].stations;
      const isSmt = id === 'L1' || id === 'L2';
      for (let i = 0; i < st.length - 1; i++) seg(st[i], st[i + 1], [exitPt(st[i]), entryPt(st[i + 1])], isSmt ? 0.32 : 0.28, isSmt ? 0.36 : 1.5);
    }
    const L3 = P.lines.L3.stations, L4 = P.lines.L4.stations;
    const tvOut = seg(L3[L3.length - 1], BURN, [exitPt(L3[L3.length - 1]), [92, 34], [92, 38.5], [98.5, 38.5]], 0.6, 1.5);
    const phOut = seg(L4[L4.length - 1], BURN, [exitPt(L4[L4.length - 1]), [92, 45], [92, 41.5], [98.5, 41.5]], 0.6, 0.6);
    const burnOut = seg(BURN, QC, [[119.5, 49.5], [119.5, 58.5], [QC.x + QC.w / 2 + 0.2, 58.5]], 0.5, 0.9);
    // QC sits east of Packing: the flow runs west along z = 58.5
    burnOut.path[2] = [QC.x + QC.w / 2, 58.5]; burnOut.len = polyLen(burnOut.path);
    const qcOut = seg(QC, PACK, [[QC.x - QC.w / 2, 58.5], [PACK.x + PACK.w / 2, 58.5]], 0.45, 0.9);
    const packOut = seg(PACK, PAL, [[PACK.x - PACK.w / 2, 58.5], [PAL.x + PAL.w / 2, 58.5]], 0.45, 0.8);
    // these segments run east → west, so their entry/exit are mirrored
    QC.flip = PACK.flip = PAL.flip = true;

    /* ----- materials: line-side stock and the warehouse ----- */
    const st = (line, name) => P.byId[`${line}-${name.replace(/\W+/g, '')}`];
    const lotId = () => `PL-${2200 + Math.floor(rnd(0, 6))}${pad(Math.floor(rnd(0, 99)), 2)}`;
    const RM = {
      pcbMain: buf('RM:pcbMain', { label: 'Bare PCBs · main', qty: 1800, cap: 2400, unit: 'pcs' }),
      pcbPower: buf('RM:pcbPower', { label: 'Bare PCBs · power', qty: 900, cap: 1600, unit: 'pcs' }),
      reel: buf('RM:reel', { label: 'Component reels', qty: 420, cap: 600, unit: 'reels' }),
      panel: buf('RM:panel', { label: 'TV panels', qty: 0, cap: 640, unit: 'pcs', lots: [] }),
      cover: buf('RM:cover', { label: 'TV back covers', qty: 560, cap: 900, unit: 'pcs' }),
      housing: buf('RM:housing', { label: 'Phone housings', qty: 1500, cap: 2400, unit: 'pcs' }),
      display: buf('RM:display', { label: 'Phone displays', qty: 1400, cap: 2400, unit: 'pcs' }),
      carton: buf('RM:carton', { label: 'Cartons', qty: 1200, cap: 2000, unit: 'pcs' })
    };
    for (let i = 0; i < 3; i++) { const id = lotId(); RM.panel.lots.push({ id, qty: 140, supplier: pick(['Supplier A', 'Supplier B']) }); RM.panel.qty += 140; }
    Object.values(RM).forEach(b => { b.rm = true; });

    // line-side buffers: where they are consumed, how much an AGV brings
    const LS = {};
    function ls(key, stn, mat, o) {
      const b = buf(`LS:${key}`, Object.assign({ station: stn.id, mat, line: stn.line }, o));
      LS[key] = b; return b;
    }
    ls('L1pcb', st('L1', 'Loader'), 'pcbMain', { label: 'Bare PCBs', qty: 70, cap: 120, rop: 40, batch: 80, src: 'RM:pcbMain', unit: 'pcs' });
    ls('L2pcb', st('L2', 'Loader'), 'pcbPower', { label: 'Bare PCBs', qty: 40, cap: 80, rop: 22, batch: 50, src: 'RM:pcbPower', unit: 'pcs' });
    ls('L1reelA', st('L1', 'Mounter A'), 'reel', { label: 'Feeder reels', qty: 100, cap: 100, rop: 25, batch: 75, src: 'RM:reel', unit: '% reel', per: 0.06 });
    ls('L1reelB', st('L1', 'Mounter B'), 'reel', { label: 'Feeder reels', qty: 70, cap: 100, rop: 25, batch: 75, src: 'RM:reel', unit: '% reel', per: 0.06 });
    ls('L2reelC', st('L2', 'Mounter C'), 'reel', { label: 'Feeder reels', qty: 85, cap: 100, rop: 25, batch: 75, src: 'RM:reel', unit: '% reel', per: 0.1 });
    ls('L3panel', st('L3', 'Panel load'), 'panel', { label: 'TV panels', qty: 0, cap: 24, rop: 8, batch: 16, src: 'RM:panel', unit: 'pcs', lots: [] });
    ls('L3main', st('L3', 'Board fit'), 'main', { label: 'Main boards', items: [], cap: 40, rop: 14, batch: 26, src: 'SM:main', unit: 'boards' });
    ls('L3power', st('L3', 'Board fit'), 'power', { label: 'Power boards', items: [], cap: 40, rop: 14, batch: 26, src: 'SM:power', unit: 'boards' });
    ls('L3cover', st('L3', 'Back cover'), 'cover', { label: 'Back covers', qty: 30, cap: 60, rop: 18, batch: 40, src: 'RM:cover', unit: 'pcs' });
    ls('L4housing', st('L4', 'Housing fit'), 'housing', { label: 'Housings', qty: 80, cap: 160, rop: 45, batch: 110, src: 'RM:housing', unit: 'pcs' });
    ls('L4main', st('L4', 'Board fit'), 'main', { label: 'Main boards', items: [], cap: 60, rop: 22, batch: 36, src: 'SM:main', unit: 'boards' });
    ls('L4display', st('L4', 'Display bond'), 'display', { label: 'Displays', qty: 90, cap: 160, rop: 45, batch: 110, src: 'RM:display', unit: 'pcs' });
    ls('L5carton', PACK, 'carton', { label: 'Cartons', qty: 80, cap: 160, rop: 45, batch: 110, src: 'RM:carton', unit: 'pcs' });
    LS.L3panel.lots.push({ id: RM.panel.lots[0].id, qty: 14 }); LS.L3panel.qty = 14;
    RM.panel.lots[0].qty -= 14; RM.panel.qty -= 14;
    const SM = {
      main: buf('SM:main', { label: 'Main boards', items: P.sm.main, cap: 160, unit: 'boards', sm: true }),
      power: buf('SM:power', { label: 'Power boards', items: P.sm.power, cap: 120, unit: 'boards', sm: true })
    };

    // what each station needs to start a unit
    st('L1', 'Loader').needs = [{ b: LS.L1pcb, n: 1 }];
    st('L2', 'Loader').needs = [{ b: LS.L2pcb, n: 1 }];
    st('L1', 'Mounter A').needs = [{ b: LS.L1reelA, n: 0.06, frac: true }];
    st('L1', 'Mounter B').needs = [{ b: LS.L1reelB, n: 0.06, frac: true }];
    st('L2', 'Mounter C').needs = [{ b: LS.L2reelC, n: 0.1, frac: true }];
    st('L3', 'Panel load').needs = [{ b: LS.L3panel, n: 1, as: 'panelLot' }];
    st('L3', 'Board fit').needs = [{ b: LS.L3main, n: 1, as: 'main' }, { b: LS.L3power, n: 1, as: 'power' }];
    st('L3', 'Back cover').needs = [{ b: LS.L3cover, n: 1 }];
    st('L4', 'Housing fit').needs = [{ b: LS.L4housing, n: 1 }];
    st('L4', 'Board fit').needs = [{ b: LS.L4main, n: 1, as: 'main' }];
    st('L4', 'Display bond').needs = [{ b: LS.L4display, n: 1 }];
    PACK.needs = [{ b: LS.L5carton, n: 1 }];

    // operators at the manual stations
    PEOPLE.forEach(([name, role, at], i) => {
      const p = { id: 'P' + (i + 1), name, role, at, x: 0, z: 0, tx: 0, tz: 0, path: null, busy: null, state: 'working' };
      P.people.push(p);
      const s = P.byId[at];
      if (s) { s.operator = p; p.x = s.x; p.z = s.z + s.d / 2 + 0.8; }
      if (role === 'Technician') { p.home = [92 + P.techs.length * 2, 9]; p.x = p.home[0]; p.z = p.home[1]; P.techs.push(p); p.state = 'available'; }
      if (role === 'Line leader') { p.x = at === 'L3' ? 62 : 60; p.z = at === 'L3' ? 39.5 : 15; }
      if (role === 'Rework') { p.x = REWORK.x; p.z = REWORK.z + 1.5; REWORK.operator = p; }
    });
    SMTREP.operator = { name: 'Tamer Reda', role: 'Line leader' };

    /* ----- AGV aisle network ----- */
    const AISLES = [
      { a: [29, 15], b: [84, 15] }, { a: [29, 27.5], b: [92, 27.5] }, { a: [29, 39.5], b: [90, 39.5] }, { a: [29, 53], b: [110, 53] },
      { a: [29, 4], b: [29, 58] }
    ];
    const nodes = P.nodes, edges = P.edges;
    const nodeAt = (x, z) => {
      let n = nodes.find(n => Math.abs(n.x - x) < 0.05 && Math.abs(n.z - z) < 0.05);
      if (!n) { n = { id: nodes.length, x, z, adj: [] }; nodes.push(n); }
      return n;
    };
    // intersections first, then stop points projected onto their aisle
    const aislePts = AISLES.map(() => []);
    AISLES.forEach((A, i) => AISLES.forEach((B, j) => {
      if (i >= j) return;
      const ah = A.a[1] === A.b[1], bh = B.a[1] === B.b[1];
      if (ah === bh) return;
      const H = ah ? A : B, V = ah ? B : A;
      const x = V.a[0], z = H.a[1];
      if (x >= Math.min(H.a[0], H.b[0]) - 0.01 && x <= Math.max(H.a[0], H.b[0]) + 0.01 && z >= Math.min(V.a[1], V.b[1]) - 0.01 && z <= Math.max(V.a[1], V.b[1]) + 0.01) {
        aislePts[i].push([x, z]); aislePts[j].push([x, z]);
      }
    }));
    const STOPS = {};
    function stop(key, x, z) {
      // attach (x, z) to the nearest aisle with a perpendicular spur
      let best = null;
      AISLES.forEach((A, i) => {
        const h = A.a[1] === A.b[1];
        const px = h ? clamp(x, Math.min(A.a[0], A.b[0]), Math.max(A.a[0], A.b[0])) : A.a[0];
        const pz = h ? A.a[1] : clamp(z, Math.min(A.a[1], A.b[1]), Math.max(A.a[1], A.b[1]));
        const d = Math.hypot(px - x, pz - z);
        if (!best || d < best.d) best = { d, i, px, pz };
      });
      aislePts[best.i].push([best.px, best.pz]);
      STOPS[key] = { x, z, ax: best.px, az: best.pz };
    }
    stop('RM:pcbMain', 26.5, 10); stop('RM:pcbPower', 26.5, 16); stop('RM:reel', 26.5, 22); stop('RM:panel', 26.5, 32);
    stop('RM:cover', 26.5, 38); stop('RM:housing', 26.5, 44); stop('RM:display', 26.5, 46); stop('RM:carton', 26.5, 50);
    stop('SM:main', 73, 12.6); stop('SM:power', 73, 17.4);
    for (const b of Object.values(LS)) {
      const s = P.byId[b.station];
      const side = s.line === 'L1' ? -1 : 1;
      const z = s.line === 'L1' ? s.z + s.d / 2 + 0.9 : s.line === 'L2' ? s.z - s.d / 2 - 0.9 : s.line === 'L3' ? s.z - s.d / 2 - 1.1 : s.line === 'L4' ? s.z - s.d / 2 - 1.1 : 54.6;
      stop(b.id, s.x + (b.mat === 'power' ? 0.9 : b.mat === 'main' && s.line === 'L3' ? -0.9 : 0), z);
      b.node = b.id; void side;
    }
    for (let i = 0; i < 6; i++) stop('PARK' + (i + 1), 33 + i * 2.4, 56.4);
    AISLES.forEach((A, i) => {
      const h = A.a[1] === A.b[1];
      const pts = aislePts[i].concat([A.a, A.b]).sort((p, q) => h ? p[0] - q[0] : p[1] - q[1]);
      let prev = null;
      for (const p of pts) {
        const n = nodeAt(p[0], p[1]);
        if (prev && prev !== n) { const w = Math.hypot(prev.x - n.x, prev.z - n.z); prev.adj.push([n.id, w]); n.adj.push([prev.id, w]); edges.push([prev.id, n.id]); }
        prev = n;
      }
    });
    for (const k in STOPS) {
      const S = STOPS[k], a = nodeAt(S.ax, S.az), n = nodeAt(S.x, S.z);
      if (a !== n) { const w = Math.hypot(a.x - n.x, a.z - n.z); a.adj.push([n.id, w]); n.adj.push([a.id, w]); edges.push([a.id, n.id]); }
      S.node = n.id;
    }
    function route(fromId, toId) {
      const D = new Float64Array(nodes.length).fill(Infinity), prev = new Int32Array(nodes.length).fill(-1), done = new Uint8Array(nodes.length);
      D[fromId] = 0;
      for (;;) {
        let u = -1, best = Infinity;
        for (let i = 0; i < nodes.length; i++) if (!done[i] && D[i] < best) { best = D[i]; u = i; }
        if (u < 0 || u === toId) break;
        done[u] = 1;
        for (const [v, w] of nodes[u].adj) if (D[u] + w < D[v]) { D[v] = D[u] + w; prev[v] = u; }
      }
      const path = []; for (let v = toId; v >= 0; v = prev[v]) { path.unshift([nodes[v].x, nodes[v].z]); if (v === fromId) break; }
      return path;
    }
    const nearestNode = (x, z) => nodes.reduce((m, n) => (Math.hypot(n.x - x, n.z - z) < Math.hypot(m.x - x, m.z - z) ? n : m), nodes[0]).id;

    /* ----- AGVs and missions ----- */
    for (let i = 0; i < 6; i++) {
      const home = STOPS['PARK' + (i + 1)];
      const n = nodes[home.node];
      P.agvs.push({ id: `AGV-0${i + 1}`, x: n.x, z: n.z, h: 0, node: n.id, path: null, s: 0, len: 0, v: 0, battery: rnd(48, 96), mission: null, phase: 'idle',
        load: null, state: 'idle', km: rnd(4, 18), fault: null, home: home.node, waitT: 0 });
    }
    const missions = [];
    function createMission(b, prio, reason) {
      if (b.mission) return b.mission;
      const src = P.bufs[b.src];
      const m = { id: 'M' + (++P.seq), buf: b, src, qty: b.batch, prio: prio || 1, reason: reason || 'Kanban', created: P.t, agv: null, eta: null };
      missions.push(m); b.mission = m; b.pending = b.batch;
      return m;
    }
    function dispatch() {
      // rank open missions by how soon the line runs out
      const open = missions.filter(m => !m.agv).sort((a, b) => (b.prio - a.prio) || (runway(a.buf) - runway(b.buf)));
      for (const m of open) {
        const free = P.agvs.filter(a => !a.mission && !a.fault && (a.phase === 'charging' ? a.battery > 45 : a.battery > 22));
        if (!free.length) break;
        const sn = STOPS[m.src.id] ? STOPS[m.src.id].node : STOPS['RM:carton'].node;
        let best = null;
        for (const a of free) {
          const d = Math.hypot(nodes[a.node].x - nodes[sn].x, nodes[a.node].z - nodes[sn].z) + (a.path ? 6 : 0);
          if (!best || d < best.d) best = { a, d };
        }
        assign(best.a, m);
      }
    }
    function assign(a, m) {
      m.agv = a; a.mission = m; a.phase = 'toPick'; a.idleT = 0;
      drive(a, STOPS[m.src.id].node);
      const L = polyLen(a.path) + polyLen(route(STOPS[m.src.id].node, STOPS[m.buf.id].node));
      m.eta = P.t + L / 1.3 + 40;
    }
    function drive(a, toNode) {
      const from = a.path ? nearestNode(a.x, a.z) : a.node;
      a.path = route(from, toNode); a.path.unshift([a.x, a.z]);
      a.len = polyLen(a.path); a.s = 0; a.target = toNode; a.waitT = 0;
    }
    function agvStep(a, dt) {
      if (a.fault) { a.v = 0; a.state = 'fault'; return; }
      if (a.waitT > 0) { a.waitT -= dt; a.v = 0; return; }
      if (a.path) {
        const vmax = a.load ? 1.1 : 1.4;
        // slow behind another AGV on the same spot (simple spacing)
        let blocked = false;
        a.idleT = 0;
        for (const o of P.agvs) if (o !== a && o.path && !o.fault && Math.hypot(o.x - a.x, o.z - a.z) < 1.8) {
          const ahead = (o.x - a.x) * Math.cos(a.h) + (o.z - a.z) * Math.sin(a.h) > 0.4;
          if (ahead && o.v < a.v + 0.05 && o.id > a.id) blocked = true;
        }
        if (P.scen.agvNext && a.load && a.s > 8) { trigger('agv'); return; }
        a.v = blocked ? 0 : ema(a.v, vmax, Math.min(1, dt * 1.6));
        a.s = Math.min(a.len, a.s + a.v * dt);
        const p = polyAt(a.path, a.s);
        a.x = p[0]; a.z = p[1]; a.h = p[2];
        a.km += a.v * dt / 1000;
        a.battery = Math.max(0, a.battery - dt * (a.load ? 0.0105 : 0.0075));
        a.state = a.load ? 'carrying' : 'moving';
        if (a.s >= a.len - 0.01) { a.node = a.target; a.path = null; a.v = 0; arrived(a); }
      } else if (a.phase === 'charging') {
        a.battery = Math.min(100, a.battery + dt * 0.12); a.state = 'charging';
        if (a.battery > 92) { a.phase = 'idle'; a.state = 'idle'; log('AGV', `${a.id} charged to ${Math.round(a.battery)}%`); }
      } else {
        a.state = 'idle'; a.battery = Math.max(0, a.battery - dt * 0.001);
        // never sit on a pick or drop point: go back to the parking bay (and charge there)
        a.idleT = (a.idleT || 0) + dt;
        if (a.idleT > 12 && a.node !== a.home && !a.mission) { a.idleT = 0; a.phase = 'toCharge'; drive(a, a.home); }
        if (a.node === a.home && a.battery < 70 && !a.mission) a.phase = 'charging';
      }
    }
    function arrived(a) {
      const m = a.mission;
      if (a.phase === 'toPick' && m) {
        const n = Math.min(m.qty, level(m.src));
        if (n <= 0) { a.waitT = 20; a.phase = 'toPick'; drive(a, STOPS[m.src.id].node); return; }
        a.loadSrc = m.src.id;
        if (m.src.items) { a.load = { items: m.src.items.splice(0, n), qty: n, label: m.buf.label, mat: m.buf.mat }; a.load.items.forEach(u => { u.loc = { k: 'agv', a }; }); }
        else if (m.src.lots) {
          const lots = []; let left = n;
          while (left > 0 && m.src.lots.length) { const L = m.src.lots[0]; const k = Math.min(left, L.qty); lots.push({ id: L.id, qty: k }); L.qty -= k; left -= k; if (L.qty <= 0) m.src.lots.shift(); }
          m.src.qty -= n; a.load = { lots, qty: n, label: m.buf.label, mat: m.buf.mat };
        } else { m.src.qty -= Math.ceil(m.buf.per ? n / 25 : n); a.load = { qty: n, label: m.buf.label, mat: m.buf.mat }; }
        a.phase = 'toDrop'; a.waitT = 9;
        drive(a, STOPS[m.buf.id].node);
      } else if (a.phase === 'toDrop' && m) {
        const b = m.buf, L = a.load || { qty: 0 };
        if (b.items) { b.items.push(...(L.items || [])); (L.items || []).forEach(u => { u.loc = { k: 'ls', b }; u.steps.push({ st: b.station, name: 'Delivered by ' + a.id, line: b.line, t0: P.t, t1: P.t, ok: true, note: `To ${P.byId[b.station].name} line-side` }); }); }
        else if (b.lots) { for (const l of L.lots || []) { const last = b.lots[b.lots.length - 1]; if (last && last.id === l.id) last.qty += l.qty; else b.lots.push({ id: l.id, qty: l.qty }); } b.qty += L.qty; }
        else b.qty = Math.min(b.cap, b.qty + L.qty);
        a.load = null; a.waitT = 8; b.pending = 0; b.mission = null; b.deliveries = (b.deliveries || 0) + 1;
        missions.splice(missions.indexOf(m), 1);
        a.mission = null; a.phase = 'idle';
        if (m.prio > 1 || m.watched) log('AGV', `${a.id} delivered ${L.qty} ${b.label.toLowerCase()} to ${P.byId[b.station].name} (${P.lines[b.line] ? P.lines[b.line].name : b.line})`, 'info', b.station);
        if (m.onDone) m.onDone();
        if (a.battery < 30) { a.phase = 'toCharge'; drive(a, a.home); }
      } else if (a.phase === 'toCharge') { a.phase = a.battery < 70 ? 'charging' : 'idle'; }
    }

    /* ----- forklifts: palletizer → finished goods → trucks ----- */
    // finished-goods rack: four rows of 12 bays
    for (let r = 0; r < 4; r++) for (let i = 0; i < 12; i++) P.fgSlots.push({ x: 36 + i * 2.6, z: 62 + r * 4, p: null, row: r });
    const DOCKS = [{ id: 'Dock 1', x: 40, z: 80, truck: null }, { id: 'Dock 2', x: 52, z: 80, truck: null }, { id: 'Dock 3', x: 64, z: 80, truck: null }];
    P.docks = DOCKS;
    for (let i = 0; i < 2; i++) P.forklifts.push({ id: `FL-${i + 1}`, x: 70 - i * 6, z: 58, h: Math.PI, path: null, s: 0, len: 0, v: 0, job: null, load: null, state: 'idle', driver: P.people.find(p => p.at === `FL-${i + 1}`) });
    // finished-goods lanes run east–west between the rack rows; the cross aisle at x = 67.5 joins them
    const LANES = [60, 64, 68, 72, 76, 78.4];
    const laneOf = z => LANES.reduce((m, l) => (Math.abs(l - z) < Math.abs(m - z) ? l : m), 60);
    function flRoute(a, b) {
      const la = laneOf(a[1]), lb = laneOf(b[1]);
      const pts = [a, [a[0], la]];
      if (la !== lb) pts.push([67.5, la], [67.5, lb]);
      pts.push([b[0], lb], b);
      return pts.filter((p, i) => !i || dist(p, pts[i - 1]) > 0.01);
    }
    function flGo(f, to) { f.path = flRoute([f.x, f.z], to); f.len = polyLen(f.path); f.s = 0; }
    function flStep(f, dt) {
      if (f.path) {
        f.v = ema(f.v, f.load ? 1.2 : 1.8, Math.min(1, dt * 2));
        f.s = Math.min(f.len, f.s + f.v * dt);
        const p = polyAt(f.path, f.s); f.x = p[0]; f.z = p[1]; f.h = p[2];
        f.state = f.load ? 'carrying' : 'moving';
        if (f.s >= f.len - 0.01) { f.path = null; f.v = 0; f.wait = 6; }
        return;
      }
      if (f.wait > 0) { f.wait -= dt; return; }
      const j = f.job;
      if (!j) {
        // next job: a truck at a dock waiting for pallets beats storing a new pallet
        const tr = P.trucks.find(t => t.state === 'loading' && t.need > t.claimed && P.pallets.some(p => p.where === 'fg' && p.product === t.product && !p.claimed));
        const pal = tr && P.pallets.filter(p => p.where === 'fg' && p.product === tr.product && !p.claimed).sort((a, b) => a.built - b.built)[0];
        if (tr && pal) { pal.claimed = true; tr.claimed += pal.units.length; f.job = { kind: 'load', pallet: pal, truck: tr, phase: 'toPallet' }; flGo(f, [pal.slot.x, pal.slot.z - 1.6]); return; }
        const fresh = P.pallets.find(p => p.where === 'pickup' && !p.claimed);
        if (fresh) {
          const slot = P.fgSlots.find(s => !s.p);
          if (slot) { fresh.claimed = true; slot.p = fresh; f.job = { kind: 'store', pallet: fresh, slot, phase: 'toPallet' }; flGo(f, [fresh.x, 60.2]); return; }
        }
        f.state = 'idle';
        return;
      }
      if (j.phase === 'toPallet') {
        f.load = j.pallet; j.pallet.where = 'fork'; j.pallet.claimed = true;
        if (j.kind === 'store') { j.phase = 'toSlot'; flGo(f, [j.slot.x, j.slot.z - 1.6]); }
        else { j.pallet.slot.p = null; j.phase = 'toTruck'; flGo(f, [j.truck.dock.x, 78.4]); }
      } else if (j.phase === 'toSlot') {
        j.pallet.where = 'fg'; j.pallet.slot = j.slot; j.pallet.claimed = false; j.pallet.x = j.slot.x; j.pallet.z = j.slot.z; f.load = null; f.job = null;
      } else if (j.phase === 'toTruck') {
        const tr = j.truck; tr.pallets.push(j.pallet); j.pallet.where = 'truck'; j.pallet.truck = tr; tr.loaded += j.pallet.units.length;
        j.pallet.units.forEach(u => { u.order = tr.order.id; u.truck = tr.id; u.shippedAt = P.t; });
        f.load = null; f.job = null;
        if (tr.loaded >= tr.need) truckDepart(tr);
      }
    }

    /* ----- orders and trucks ----- */
    ORDERS.forEach(([id, customer, product, qty, due]) => P.orders.push({ id, customer, product, qty, due, shipped: 0, state: 'open', truck: null, risk: 0, eta: null }));
    let truckSeq = 0;
    function truckArrive(o) {
      const dock = DOCKS.find(d => !d.truck);
      if (!dock) return false;
      const tr = { id: 'TRK-' + (310 + (++truckSeq)), order: o, product: o.product, need: o.qty - o.shipped, loaded: 0, claimed: 0, pallets: [], dock, state: 'arriving', k: 0, arrived: P.t };
      dock.truck = tr; o.truck = tr; o.state = 'loading'; P.trucks.push(tr);
      log('Dock', `${tr.id} at ${dock.id} for ${o.id} (${o.customer}) · ${tr.need} ${o.product === 'tv' ? 'TVs' : 'phones'}`, 'info');
      return true;
    }
    function truckDepart(tr) {
      if (tr.state === 'leaving') return;
      tr.state = 'leaving'; tr.k = 1;
      const o = tr.order; o.shipped += tr.loaded;
      const late = P.t > o.due;
      o.state = o.shipped >= o.qty ? (late ? 'late' : 'shipped') : 'partial';
      o.shippedAt = P.t;
      log('Dock', `${tr.id} left ${tr.dock.id} · ${o.id} ${o.state === 'shipped' ? 'shipped on time' : o.state === 'late' ? `shipped ${mins(P.t - o.due)} late` : 'part-shipped'} · ${tr.loaded} units`, late ? 'warn' : 'info');
    }
    function inboundSchedule() {
      // panels and other materials arrive on trucks at the west receiving doors
      P.inbound = [
        { id: 'IN-881', mat: 'panel', qty: 320, at: START + 40 * 60, door: 0, state: 'due' },
        { id: 'IN-882', mat: 'mix', qty: 0, at: START + 25 * 60, door: 1, state: 'due' },
        { id: 'IN-883', mat: 'panel', qty: 320, at: START + 2.4 * 3600, door: 0, state: 'due' },
        { id: 'IN-884', mat: 'mix', qty: 0, at: START + 2.1 * 3600, door: 1, state: 'due' }
      ];
    }
    inboundSchedule();
    function inboundStep(dt) {
      for (const tr of P.inbound) {
        if (tr.state === 'due' && P.t >= tr.at) { tr.state = 'unloading'; tr.k = 0; log('Receiving', `${tr.id} at receiving door ${tr.door + 1} · ${tr.mat === 'panel' ? tr.qty + ' TV panels' : 'PCBs, reels, covers, housings, displays, cartons'}`); }
        if (tr.state === 'unloading') {
          tr.k += dt / 600;
          if (tr.k >= 1) {
            tr.state = 'done';
            if (tr.mat === 'panel') {
              const lot = (P.scen.lot && !P.scen.lot.injected) ? P.scen.lot.lot : lotId();
              RM.panel.lots.push({ id: lot, qty: tr.qty, supplier: pick(['Supplier A', 'Supplier B']) }); RM.panel.qty += tr.qty;
              if (P.scen.lot && !P.scen.lot.injected) P.scen.lot.injected = true;
            } else {
              RM.pcbMain.qty += 900; RM.pcbPower.qty += 400; RM.reel.qty += 160; RM.cover.qty += 300; RM.housing.qty += 700; RM.display.qty += 700; RM.carton.qty += 600;
              for (const b of Object.values(RM)) if (!b.lots) b.qty = Math.min(b.cap, b.qty);
            }
            log('Receiving', `${tr.id} received into the raw-material warehouse`);
          }
        }
      }
    }

    // the plant keeps running past today's list: new orders arrive, and raw material is re-ordered before it runs out
    const CUSTOMERS = { tv: ['Domestic retail', 'Export · Gulf', 'Export · East Africa', 'Export · Europe', 'Hotel project'], phone: ['Domestic retail', 'E-commerce hub', 'Export · Gulf', 'Operator channel', 'Export · North Africa'] };
    let ordSeq = 7740, inSeq = 885;
    function replenish() {
      for (const prod of ['tv', 'phone']) {
        const open = P.orders.filter(o => o.product === prod && (o.state === 'open' || o.state === 'loading'));
        if (open.length >= 2) continue;
        const last = P.orders.filter(o => o.product === prod).reduce((m, o) => Math.max(m, o.due), P.t);
        const qty = prod === 'tv' ? 8 * Math.round(rnd(9, 12)) : 40 * Math.round(rnd(3, 5));
        const due = Math.max(last, P.t + 90 * 60) + Math.round(rnd(55, 80)) * 60;
        const id = (R() < 0.5 ? 'SO-' : 'EX-') + (++ordSeq);
        P.orders.push({ id, customer: pick(CUSTOMERS[prod]), product: prod, qty, due, shipped: 0, state: 'open', truck: null, risk: 0 });
        log('ERP', `New order ${id} · ${qty} ${prod === 'tv' ? 'TVs' : 'phones'} · due ${clock(due)}`);
      }
      // keep the order list readable: drop orders shipped more than two hours ago
      P.orders = P.orders.filter(o => !(o.shippedAt && P.t - o.shippedAt > 7200 && o.state !== 'open' && o.state !== 'loading'));
      const due = mat => P.inbound.some(t => t.mat === mat && (t.state === 'due' || t.state === 'unloading'));
      if (RM.panel.qty < 360 && !due('panel')) { P.inbound.push({ id: 'IN-' + (++inSeq), mat: 'panel', qty: 320, at: P.t + 40 * 60, door: 0, state: 'due' }); log('SCM', `Panel truck IN-${inSeq} booked · arrives ${clock(P.t + 40 * 60)}`); }
      const low = ['pcbMain', 'pcbPower', 'cover', 'housing', 'display', 'carton', 'reel'].some(k => RM[k].qty < RM[k].cap * 0.3);
      if (low && !due('mix')) { P.inbound.push({ id: 'IN-' + (++inSeq), mat: 'mix', qty: 0, at: P.t + 35 * 60, door: 1, state: 'due' }); log('SCM', `Material truck IN-${inSeq} booked · arrives ${clock(P.t + 35 * 60)}`); }
      P.inbound = P.inbound.filter(t => t.state !== 'done' || P.t - t.at < 3600);
    }

    /* ----- stations ----- */
    function cycleOf(s, u) {
      let c = s.kind === 'reflow' ? s.base * s.slots : s.base;
      if (s === PACK) c = u && u.type === 'tv' ? 20 : 7;
      if (s === QC) c = u && u.type === 'tv' ? 14 : 7;
      if (s === PAL) c = u && u.type === 'tv' ? 7 : 2.6;
      const line = P.lines[s.line];
      const sp = line ? line.speed : 1;
      const wear = s.health < 55 ? 1 + (55 - s.health) / 90 : 1;
      return c * wear * s.speedMul / sp * (1 + (R() - 0.2) * 0.14);
    }
    // the standard (ideal) time for one unit at a station, used for the performance part of OEE
    function stdCycle(s, u) {
      if (s === PACK) return u && u.type === 'tv' ? 20 : 7;
      if (s === QC) return u && u.type === 'tv' ? 14 : 7;
      if (s === PAL) return u && u.type === 'tv' ? 7 : 2.6;
      return s.base;
    }
    function setState(s, st, why) {
      if (s.state !== st || s.why !== why) { s.state = st; s.since = P.t; s.why = why || ''; }
    }
    function canStart(s) {
      for (const n of s.needs) {
        if (n.frac) { if (n.b.qty < n.n) return n.b; continue; }
        if (level(n.b) < n.n) return n.b;
      }
      return null;
    }
    function consume(s, u) {
      for (const n of s.needs) {
        if (n.frac) { n.b.qty = Math.max(0, n.b.qty - n.n); n.b.used += n.n; continue; }
        const got = take(n.b, n.n);
        if (n.as === 'main' || n.as === 'power') { u.parts[n.as] = got[0]; got[0].usedIn = u.sn; got[0].usedAt = P.t; }
        else if (n.as === 'panelLot') u.lot = got[0];
      }
    }
    // a station hands a finished unit forward: to its out-segment, a sink, or burn-in
    function handOff(s, u) {
      if (s.outSeg) {
        const sg = s.outSeg, last = sg.items[sg.items.length - 1];
        if (last && last.s < sg.pitch) return false;
        sg.items.push({ u, s: 0 }); u.loc = { k: 'seg', seg: sg };
        return true;
      }
      if (s.line === 'L1' || s.line === 'L2') {
        // the unloader racks boards into the supermarket (or the line's override product when Line 2 runs main boards)
        const lane = u.type === 'main' ? SM.main : SM.power;
        if (lane.items.length >= lane.cap) return false;
        lane.items.push(u); u.loc = { k: 'sm', lane: u.type };
        P.made[u.type]++;
        return true;
      }
      if (s === PAL) return palletize(u);
      return true;
    }
    function newUnitAt(s) {
      // the first station of each line creates the unit from raw material
      const line = P.lines[s.line];
      if (s.line === 'L1' || s.line === 'L2') {
        const prod = line.prodOverride || line.product;
        return unit(prod, { line: s.line, panelPos: P.seq % 2 });
      }
      if (s.line === 'L3') return unit('tv', { line: 'L3', model: 'TV-55 UHD' });
      if (s.line === 'L4') return unit('phone', { line: 'L4', model: 'Phone X6' });
      return null;
    }
    function stationStep(s, dt) {
      const line = P.lines[s.line];
      // repairs, planned stops and faults
      if (s.state === 'down' || s.state === 'maint') {
        s.counters.down += dt;
        if (s.tech && s.tech.state === 'repairing') {
          s.repair -= dt;
          if (s.repair <= 0) finishRepair(s);
        }
        return;
      }
      if (s.micro > 0) {
        s.micro -= dt; s.counters.down += dt;
        if (s.micro <= 0) { s.micro = 0; setState(s, 'idle'); }
        return;
      }
      if (s.state === 'changeover') { s.counters.down += dt; s.co -= dt; if (s.co <= 0) setState(s, 'idle'); return; }
      if ((line && (line.stopped || line.tripped)) || s.tripped) { setState(s, 'idle', line && line.tripped ? 'Tripped (power)' : 'Line stopped'); s.counters.idle += dt; return; }

      // short stops: jams, feeder changes, vision retries (they are most of the lost time on a real line)
      const smt = s.line === 'L1' || s.line === 'L2';
      if (s.procs.length && s.kind !== 'reflow' && R() < dt / (smt ? 2600 : s.manual ? 1500 : 1200)) {
        s.micro = smt ? rnd(12, 55) : rnd(20, 80); s.stops = (s.stops || 0) + 1;
        setState(s, 'micro', pick(s.kind === 'mounter' ? ['Pick error · nozzle retry', 'Feeder splice', 'Vision recognition retry'] : s.manual ? ['Operator waiting for help', 'Part fit issue'] : ['Jam at infeed', 'Sensor blocked', 'Vision retry']));
        return;
      }
      // random failures from wear (rare at good health)
      if (s.mtbf < 9e8 && s.procs.length && !s.degrade) {
        const hz = dt / s.mtbf * (s.health < 40 ? 30 : s.health < 60 ? 4 : 1);
        if (R() < hz) return fail(s, s.health < 40 ? 'Worn part failed' : pick(['Servo overload', 'Sensor fault', 'Jam cleared by operator', 'Vacuum loss']), s.health < 40 ? 2400 : rnd(240, 900));
      }
      if (s.degrade > 0) {
        s.health = Math.max(0, s.health - s.degrade * dt);
        if (s.health <= 22) return fail(s, s.failWhy || 'Bearing seized', s.failRepair || 2100);
      }

      // finish processing
      let busy = false;
      for (let i = s.procs.length - 1; i >= 0; i--) {
        const p = s.procs[i];
        if (p.left > 0) { p.left -= dt; busy = true; continue; }
        if (!p.done) { p.done = true; finishUnit(s, p.u, p); }
        if (p.reject) { s.procs.splice(i, 1); continue; }
        if (handOff(s, p.u)) { if (p.rec) p.rec.t1 = P.t; s.procs.splice(i, 1); s.counters.made++; s.counters.std += stdCycle(s, p.u); }
      }
      const blocked = s.procs.some(p => p.done && !p.reject);

      // start new units while there is a free slot
      let starvedBy = null;
      if (s !== BURN) {
        while (s.procs.length < s.slots) {
          let u = null;
          if (s.inSegs) {
            const sg = s.inSegs.find(g => g.items.length && g.items[0].s >= g.len - 0.02);
            if (!sg) break;
            const need = canStart(s); if (need) { starvedBy = need; break; }
            u = sg.items.shift().u;
          } else if (s.idx === 0 && line && s.line !== 'L5' && s.line !== 'SUP') {
            const need = canStart(s); if (need) { starvedBy = need; break; }
            if (s.line === 'L1' || s.line === 'L2') {
              const lane = (line.prodOverride || line.product) === 'main' ? SM.main : SM.power;
              if (lane.items.length + 24 >= lane.cap) { starvedBy = 'kanban'; break; }
            }
            u = newUnitAt(s);
          } else break;
          consume(s, u);
          const rec = stepRec(u, s);
          s.procs.push({ u, left: cycleOf(s, u), rec });
          u.loc = { k: 'st', st: s };
          busy = true;
        }
      } else burnStep(s, dt);

      if (s === BURN) return;
      if (blocked && !busy) setState(s, 'blocked', 'Outfeed full');
      else if (busy) setState(s, s.health < 55 ? 'warn' : 'run', s.health < 55 ? 'Running slow (wear)' : '');
      else if (starvedBy === 'kanban') setState(s, 'idle', 'Supermarket full (Kanban)');
      else if (starvedBy) setState(s, 'starved', `Waiting for ${starvedBy.label.toLowerCase()}`);
      else setState(s, 'idle', 'Waiting for units');
      const c = s.counters;
      if (s.state === 'run' || s.state === 'warn') c.run += dt; else if (s.state === 'blocked') c.blocked += dt; else if (s.state === 'starved') c.starved += dt; else c.idle += dt;
    }
    function burnStep(s, dt) {
      // accept from the TV and phone infeeds into free rack slots; release when aged
      for (const sg of s.inSegs) {
        const head = sg.items[0];
        if (!head || head.s < sg.len - 0.02) continue;
        const slot = s.rack.find(r => !r.u && r.kind === head.u.type);
        if (!slot) continue;
        sg.items.shift();
        slot.u = head.u; head.u.loc = { k: 'rack', slot }; head.u.agedFrom = P.t;
        stepRec(head.u, s, { slot: s.rack.indexOf(slot) + 1 });
      }
      let n = 0;
      for (const r of s.rack) {
        if (!r.u) continue; n++;
        const u = r.u;
        if (P.t - u.agedFrom >= AGE[u.type] && !u.agedOk) {
          u.agedOk = true;
          const rec = u.steps[u.steps.length - 1]; rec.t1 = P.t; rec.ok = true;
          rec.note = u.type === 'tv' ? 'Burn-in 18 min · white field, 45 °C' : 'Burn-in 10 min · battery cycle';
        }
        if (u.agedOk) {
          const sg = s.outSeg, last = sg.items[sg.items.length - 1];
          if (!last || last.s >= sg.pitch) { sg.items.push({ u, s: 0 }); u.loc = { k: 'seg', seg: sg }; r.u = null; }
        }
      }
      s.load = n;
      setState(s, n ? 'run' : 'idle');
      s.counters[n ? 'run' : 'idle'] += dt;
    }

    // inspection outcomes and genealogy notes
    function finishUnit(s, u, p) {
      const rec = p.rec; rec.ok = true;
      if (s.kind === 'printer') rec.note = `Paste ${s.sens.paste ? s.sens.paste.toFixed(1) : '24.8'} °C · squeegee ${s.sens.press ? s.sens.press.toFixed(1) : '5.4'} kg`;
      if (s.kind === 'spi') { u.spi = s.sens.vol || 99; rec.note = `Paste volume ${u.spi.toFixed(0)}%`; }
      if (s.kind === 'mounter') rec.note = `${s.name} · ${Math.round(rnd(380, 520))} parts placed`;
      if (s.kind === 'reflow') { u.peak = s.sens.peak || 245; rec.note = `Peak ${u.peak.toFixed(1)} °C · TAL ${Math.round(rnd(58, 72))} s`; }
      if (s.kind === 'aoi') {
        const drift = Math.max(0, (u.peak || 245) - 248) * 0.05 + Math.max(0, Math.abs((u.spi || 100) - 100) - 8) * 0.01;
        const pBad = 0.008 + drift + (s.line === 'L1' ? 0 : 0.004);
        if (R() < pBad) {
          const code = (u.peak || 0) > 249 ? 'Solder bridge' : pick(['Solder bridge', 'Missing component', 'Tombstone', 'Insufficient solder']);
          u.defect = { code, at: s.id, cause: (u.peak || 0) > 249 ? `Reflow peak ${u.peak.toFixed(1)} °C (limit 248 °C)` : 'Random' };
          rec.ok = false; rec.note = `${code} · rejected to repair`; p.reject = true; s.counters.bad++; P.rejects.aoi++;
          u.loc = { k: 'repair', st: SMTREP }; P.rejects.smtRepair.push({ u, t: P.t });
        } else rec.note = 'Pass · 1,284 joints checked';
      }
      if (s.kind === 'fct') {
        const lotBad = u.type === 'tv' && P.scen.lot && P.scen.lot.lot === u.lot && !P.scen.lot.quarantined;
        const pixel = lotBad && R() < 0.3;
        const bad = pixel || R() < 0.006 + ((u.parts.main && u.parts.main.repaired) ? 0.02 : 0);
        if (bad) {
          u.defect = pixel ? { code: 'Dead pixel cluster', at: s.id, cause: `Panel lot ${u.lot}` } : { code: u.type === 'tv' ? 'No backlight' : 'No RF signal', at: s.id, cause: 'Connector not seated' };
          if (pixel) P.scen.lot.fails = (P.scen.lot.fails || 0) + 1;
          rec.ok = false; rec.note = `${u.defect.code} · sent to rework`; p.reject = true; s.counters.bad++; P.rejects.fct++; toRework(u);
        } else rec.note = u.type === 'tv' ? 'HDMI, Wi-Fi, audio, power: pass' : 'RF, camera, audio, battery: pass';
      }
      if (s === QC) {
        const lotBad = u.type === 'tv' && P.scen.lot && P.scen.lot.lot === u.lot && !P.scen.lot.quarantined;
        const bad = R() < (lotBad ? 0.42 : 0.004);
        if (bad) {
          u.defect = { code: u.type === 'tv' ? 'Dead pixel cluster' : 'Display mura', at: s.id, cause: lotBad ? `Panel lot ${u.lot}` : 'Random' };
          rec.ok = false; rec.note = `${u.defect.code} · sent to rework`; p.reject = true; s.counters.bad++; P.rejects.qc++; toRework(u);
          if (lotBad) P.scen.lot.fails = (P.scen.lot.fails || 0) + 1;
        } else rec.note = u.type === 'tv' ? 'Camera check: uniformity, colour, dead pixels: pass' : 'Camera check: display, cosmetics: pass';
      }
      if (s.kind === 'bench' || s.kind === 'robot' || s.kind === 'bond') {
        if (s.name === 'Board fit') rec.note = u.type === 'tv' ? `Main ${u.parts.main.sn} · power ${u.parts.power.sn}` : `Main board ${u.parts.main.sn}`;
        if (s.name === 'Panel load') rec.note = `Panel lot ${u.lot}`;
        if (s.name === 'Screw robot') rec.note = `${u.type === 'tv' ? 12 : 6} screws · torque ${rnd(0.42, 0.48).toFixed(2)} N·m`;
        if (s.name === 'Display bond') rec.note = `Bond line ${rnd(0.18, 0.22).toFixed(2)} mm · cure 8 s`;
        if (s.operator) rec.by = s.operator.name;
      }
      if (s === PACK) { u.packed = P.t; P.leads.push(P.t - u.born); if (P.leads.length > 40) P.leads.shift(); rec.note = u.type === 'tv' ? 'Carton, foam, manual, remote' : 'Gift box, charger, manual'; if (u.type === 'tv') P.made.packedTv++; else P.made.packedPhone++; }
      if (s.operator && !rec.by) rec.by = s.operator.name;
    }
    function toRework(u) { u.loc = { k: 'repair', st: REWORK }; P.rejects.rework.push({ u, t: P.t }); }
    function repairsStep() {
      // SMT repair: fix and return boards to the supermarket; rework: back into final QC
      const sm = P.rejects.smtRepair;
      if (sm.length && P.t - sm[0].t > 360) {
        const { u } = sm.shift();
        const ok = R() < 0.82;
        u.steps.push({ st: SMTREP.id, name: 'SMT repair', line: 'SMT', t0: P.t - 120, t1: P.t, ok, note: ok ? `Repaired: ${u.defect.code.toLowerCase()} · re-inspected` : 'Not repairable · scrapped' });
        if (ok) { u.repaired = true; const lane = u.type === 'main' ? SM.main : SM.power; lane.items.push(u); u.loc = { k: 'sm', lane: u.type }; }
        else { u.scrap = true; u.loc = null; archive(u); }
      }
      const rw = P.rejects.rework;
      if (rw.length && P.t - rw[0].t > 280) {
        const sg = burnOut, last = sg.items[sg.items.length - 1];
        if (!last || last.s >= sg.pitch) {
          const { u } = rw.shift();
          u.steps.push({ st: REWORK.id, name: 'Rework', line: 'L5', t0: P.t - 240, t1: P.t, ok: true, by: 'Laila Mostafa', note: u.defect.cause.startsWith('Panel lot') ? 'Panel replaced from a good lot' : 'Reseated connector · retest' });
          if (u.defect.cause.startsWith('Panel lot')) u.lot = (LS.L3panel.lots[0] || { id: 'PL-220100' }).id;
          u.reworked = true; u.defect = null;
          sg.items.push({ u, s: sg.len * 0.55 }); sg.items.sort((a, b) => b.s - a.s); u.loc = { k: 'seg', seg: sg };
        }
      }
      SMTREP.load = sm.length; REWORK.load = rw.length;
      SMTREP.state = sm.length ? 'run' : 'idle'; REWORK.state = rw.length ? 'run' : 'idle';
    }

    /* ----- pallets ----- */
    let palletSeq = 5120;
    function palletize(u) {
      let p = P.pallets.find(x => x.where === 'build' && x.product === u.type);
      if (!p) {
        if (P.pallets.filter(y => y.where === 'pickup').length >= 4) return false;
        p = { id: 'PAL-' + (++palletSeq), product: u.type, units: [], where: 'build', x: PAL.x - 3.6, z: 58.5 + (u.type === 'tv' ? -1.6 : 1.6), cap: u.type === 'tv' ? 8 : 40, built: null };
        P.pallets.push(p);
      }
      p.units.push(u); u.pallet = p.id; u.loc = { k: 'pallet', p };
      const rec = u.steps[u.steps.length - 1]; rec.note = `${p.id} · position ${p.units.length} of ${p.cap}`;
      if (p.units.length >= p.cap) {
        p.where = 'pickup'; p.built = P.t;
        const used = P.pallets.filter(x => x !== p && x.where === 'pickup').map(x => x.x);
        p.x = [74.2, 71.8, 69.4, 76.6].find(x => !used.some(v => Math.abs(v - x) < 0.5)) || 74.2; p.z = 61.7;
        log('Pack', `${p.id} complete · ${p.cap} ${p.product === 'tv' ? 'TVs' : 'phones'} · stretch-wrapped`); }
      return true;
    }

    /* ----- failures, maintenance, technicians ----- */
    function fail(s, why, repair) {
      if (s.state === 'down') return;
      s.procs.forEach(p => { p.left += 1; });
      setState(s, 'down', why); s.fault = { why, at: P.t, repair }; s.repair = repair; s.degrade = 0;
      alarm(`${s.id}.DOWN`, true, { prio: 1, area: P.lines[s.line] ? P.lines[s.line].name : 'Plant', msg: `${s.name} stopped · ${why}`, ref: s.id });
      sendTech(s);
    }
    function sendTech(s) {
      const t = P.techs.find(x => x.state === 'available');
      if (!t) { s.tech = null; return; }
      t.state = 'walking'; t.job = s; s.tech = t;
      const a = nearestNode(t.x, t.z), b = nearestNode(s.x, s.z + s.d);
      t.path = route(a, b); t.path.unshift([t.x, t.z]); t.path.push([s.x + 0.6, s.z + s.d / 2 + 0.9]); t.len = polyLen(t.path); t.s = 0;
      log('CMMS', `${t.name} dispatched to ${s.name} (${P.lines[s.line] ? P.lines[s.line].name : ''})`, 'info', s.id);
    }
    function finishRepair(s) {
      const t = s.tech;
      const planned = s.state === 'maint';
      s.health = rnd(96, 99.5); s.fault = null; s.tech = null; s.failWhy = null; s.repairs = (s.repairs || 0) + 1;
      setState(s, 'idle');
      alarm(`${s.id}.DOWN`, false); alarm(`${s.id}.HEALTH`, false);
      log('CMMS', `${s.name} back in production after ${planned ? 'planned' : 'unplanned'} repair`, 'info', s.id);
      if (t) {
        t.state = 'returning'; t.job = null;
        const a = nearestNode(t.x, t.z); t.path = route(a, nearestNode(t.home[0], t.home[1])); t.path.unshift([t.x, t.z]); t.path.push(t.home); t.len = polyLen(t.path); t.s = 0;
      }
      if (s.onRepaired) { const f = s.onRepaired; s.onRepaired = null; f(); }
    }
    function peopleStep(dt) {
      for (const t of P.techs) {
        if (t.path) {
          t.s = Math.min(t.len, t.s + 1.35 * dt);
          const p = polyAt(t.path, t.s); t.x = p[0]; t.z = p[1]; t.h = p[2];
          if (t.s >= t.len - 0.01) {
            t.path = null;
            if (t.state === 'walking') { t.state = 'repairing'; log('CMMS', `${t.name} on site at ${t.job.name}`, 'info', t.job.id); }
            else if (t.state === 'returning') t.state = 'available';
          }
        }
        if (t.state === 'available') {
          const waiting = P.stations.find(s => (s.state === 'down' || s.state === 'maint') && !s.tech);
          if (waiting) sendTech(waiting);
        }
      }
    }

    /* ----- sensors (per machine kind) ----- */
    function sensors(s, dt) {
      const on = s.state === 'run' || s.state === 'warn';
      const wear = 100 - s.health;
      const S = s.sens;
      const n = (a) => (R() - 0.5) * a;
      if (s.kind === 'mounter') {
        S.vib = on ? 1.4 + wear * 0.055 + (wear > 40 ? wear * 0.02 : 0) + n(0.25) : 0.12 + n(0.04);
        S.vac = on ? -78 + wear * 0.06 + n(1.2) : -12;
        S.cph = on ? Math.round(52000 / (cycleOf(s) / s.base) * (0.97 + n(0.04))) : 0;
        S.temp = 38 + wear * 0.12 + (on ? 4 : 0) + n(0.4);
      } else if (s.kind === 'reflow') {
        const hot = P.scen.reflow && P.scen.reflow.line === s.line && !P.scen.reflow.fixed ? P.scen.reflow.drift : 0;
        const dip = P.lines[s.line].tripped ? -40 : 0;
        S.zones = [150, 170, 185, 200, 228 + hot, 248, 236, 140].map((z, i) => z + (i === 4 ? 0 : hot * 0.25) + dip * (i < 7 ? 1 : 0.3) + n(1.2));
        S.peak = Math.max(...S.zones.slice(4, 7)) - 1.5 + n(0.6);
        S.o2 = 820 + n(60); S.conv = 0.82 + n(0.01);
        S.temp = S.peak;
      } else if (s.kind === 'printer') {
        S.press = 5.4 + n(0.12); S.paste = 24.6 + n(0.3); S.temp = S.paste;
      } else if (s.kind === 'spi') {
        S.vol = 99 + n(4); S.temp = 26 + n(0.3);
      } else if (s.kind === 'aoi') {
        const tot = s.counters.made + s.counters.bad;
        S.ppm = tot ? Math.round(s.counters.bad / tot * 1e6) : 0; S.temp = 27 + n(0.3);
      } else if (s.kind === 'robot' || s.kind === 'palletizer') {
        S.torque = on ? 0.45 + n(0.02) + wear * 0.002 : 0; S.temp = 34 + wear * 0.15 + (on ? 6 : 0) + n(0.5); S.vib = on ? 0.8 + wear * 0.03 + n(0.1) : 0.05;
      } else if (s.kind === 'fct' || s.kind === 'qc') {
        S.temp = 28 + n(0.4);
      } else S.temp = 26 + n(0.4);
      const K = KIND[s.kind].kw;
      s.kwNow = (s.state === 'run' || s.state === 'warn' ? K[0] : s.state === 'down' || s.state === 'maint' ? K[2] : K[1]) * (1 + n(0.04));
      if (s === BURN) { const tv = BURN.rack.filter(r => r.u && r.kind === 'tv').length; s.kwNow = K[1] + tv * 0.11 + ((s.load || 0) - tv) * 0.008; }
    }
    function record(s) {
      const H = s.hist, S = s.sens;
      const push = (k, v) => { if (v === undefined || v === null || !isFinite(v)) return; (H[k] = H[k] || []).push(+v.toFixed(2)); if (H[k].length > HIST) H[k].shift(); };
      push('vib', S.vib); push('temp', S.temp); push('kw', s.kwNow); push('peak', S.peak); push('vac', S.vac); push('health', s.health);
    }

    /* ----- KPIs, OEE ----- */
    const win = [];   // 30-minute rolling window of per-line counters
    function kpis() {
      const k = P.kpi;
      const tv = P.base.tv + P.made.packedTv, ph = P.base.phone + P.made.packedPhone;
      const el = (P.t - SHIFT_START) / 3600;
      const planTv = Math.round(95 * 0.82 * el), planPh = Math.round(164 * 0.82 * el);
      k.tv = tv; k.phone = ph; k.planTv = planTv; k.planPh = planPh; k.units = tv + ph; k.plan = planTv + planPh;
      // line OEE from the last 30 minutes of station counters (bottleneck station)
      const snap = {}; for (const id in P.lines) { const L = P.lines[id]; const b = id === 'L5' ? PACK : L.stations.reduce((m, s) => (s.kind === 'reflow' || s.kind === 'burnin' ? 0 : s.base) > m.base ? s : m, L.stations[0]); snap[id] = { run: b.counters.run, down: b.counters.down + b.counters.starved + b.counters.blocked, made: b.counters.made, std: b.counters.std, bad: L.stations.reduce((a, s) => a + s.counters.bad, 0), base: b.base }; }
      win.push({ t: P.t, snap }); while (win.length && P.t - win[0].t > 1800) win.shift();
      const w0 = win[0];
      let oeeW = 0, rateW = 0;
      for (const id in P.lines) {
        const L = P.lines[id], a = snap[id], b = w0.snap[id];
        const run = a.run - b.run, lost = a.down - b.down, made = a.made - b.made, bad = a.bad - b.bad, span = Math.max(1, P.t - w0.t);
        if (span < 120) continue;
        const avail = clamp(run / Math.max(1, run + lost), 0, 1);
        const perf = clamp((a.std - b.std) / Math.max(1, run), 0, 1);
        const qual = made ? clamp(1 - bad / Math.max(1, made), 0, 1) : 1;
        L.avail = ema(L.avail, avail, 0.2); L.perf = ema(L.perf, perf, 0.2); L.qual = ema(L.qual, qual, 0.2);
        L.oee = L.avail * L.perf * L.qual;
        L.tph = made / span * 3600;
        const r = 3600 / a.base; oeeW += L.oee * r; rateW += r;
        const down = L.stations.find(s => s.state === 'down' || s.state === 'maint');
        const starved = L.stations[0].state === 'starved' || L.stations.some(s => s.state === 'starved');
        L.state = L.tripped ? 'tripped' : down ? 'down' : L.stations.some(s => s.state === 'changeover') ? 'changeover' : starved ? 'starved' : L.stations.some(s => s.state === 'warn' || s.state === 'micro') ? 'warn' : 'run';
      }
      if (rateW) k.oee = oeeW / rateW;
      const fctT = P.stations.filter(s => s.kind === 'fct' || s === QC).reduce((a, s) => a + s.counters.made + s.counters.bad, 0);
      const fctB = P.stations.filter(s => s.kind === 'fct' || s === QC).reduce((a, s) => a + s.counters.bad, 0);
      k.fpy = fctT ? 1 - fctB / fctT : 0.99;
      let wip = 0; for (const u of P.units) if (!u.packed && u.type !== 'main' && u.type !== 'power') wip++;
      k.wip = wip; k.boards = SM.main.items.length + SM.power.items.length; k.kw = P.stations.reduce((a, s) => a + s.kwNow, 0) + P.util.kw;
      k.agvBusy = P.agvs.filter(a => a.mission).length;
      const shipped = P.orders.filter(o => o.state === 'shipped' || o.state === 'late' || o.state === 'partial');
      k.otif = shipped.length ? shipped.filter(o => o.state === 'shipped').length / shipped.length : 1;
      k.alarms = P.alarms.length;
      k.lead = leadTime();
      // end-of-shift forecast from the current packing rate
      const rem = Math.max(0, (SHIFT_END - P.t) / 3600);
      const rate = (P.lines.L3.tph || 80) + (P.lines.L4.tph || 140);
      const risk = P.stations.filter(s => s.state === 'down' || s.degrade > 0).length;
      k.fcst = Math.round(k.units + rate * rem * (1 - 0.04 * risk));
      k.planEnd = Math.round((95 + 164) * 0.82 * (SHIFT_END - SHIFT_START) / 3600);
      k.prob = clamp(0.5 + (k.fcst - k.planEnd) / (k.planEnd * 0.06), 0.02, 0.98);
      const h = P.hist;
      h.t.push(P.t); h.kw.push(Math.round(k.kw)); h.tph.push(Math.round(rate)); h.oee.push(+(k.oee || 0.85).toFixed(3)); h.wip.push(k.wip);
      for (const key in h) if (h[key].length > HIST) h[key].shift();
    }
    function leadTime() { return P.leads.length ? P.leads.reduce((a, b) => a + b, 0) / P.leads.length : 0; }

    /* ----- utilities and energy ----- */
    P.util = { kw: 0, assets: [
      { id: 'UTIL-TX', name: 'Transformer T1', x: 104, z: 8, kind: 'transformer', kw: 0 },
      { id: 'UTIL-AIR1', name: 'Compressor 1', x: 110, z: 8, kind: 'compressor', kw: 0 },
      { id: 'UTIL-AIR2', name: 'Compressor 2', x: 114.5, z: 8, kind: 'compressor', kw: 0 },
      { id: 'UTIL-CH1', name: 'Chiller 1', x: 120, z: 9, kind: 'chiller', kw: 0 },
      { id: 'UTIL-CH2', name: 'Chiller 2', x: 120, z: 15.5, kind: 'chiller', kw: 0 }
    ] };
    function utilStep() {
      const pneu = P.stations.filter(s => (s.state === 'run' || s.state === 'warn') && /mounter|robot|packer|palletizer|printer/.test(s.kind)).length;
      const hour = (P.t / 3600) % 24, amb = 30 + 7 * Math.sin((hour - 9) / 24 * Math.PI * 2 + 0.6);
      P.util.ambient = amb;
      const A = P.util.assets;
      A[1].kw = 52 + pneu * 3.1 + (R() - 0.5) * 3; A[2].kw = pneu > 9 ? 38 + (pneu - 9) * 2.6 : 8;
      A[3].kw = 90 + (amb - 28) * 6 + (R() - 0.5) * 4; A[4].kw = amb > 33 ? 60 + (amb - 33) * 8 : 18;
      A[0].kw = 0; // losses folded into the others
      P.util.kw = A.reduce((a, x) => a + x.kw, 0) + 64; // + lighting and offices
    }

    /* ----- the AI layer: predictions and recommendations ----- */
    function runway(b) {
      const lvl = level(b) + (b.mission && b.mission.agv ? 0 : 0);
      return b.rate > 1e-4 ? lvl / b.rate : Infinity;
    }
    const recs = new Map();
    function rec(key, o) {
      if (!o) { if (recs.has(key)) { recs.delete(key); emit('recs'); } return; }
      const prev = recs.get(key);
      if (prev && prev.dismissed) return;
      const r = Object.assign({ key, t: P.t, time: clock(P.t) }, prev && { t: prev.t, time: prev.time }, o);
      if (!prev) log('AI', `${o.agent} agent: ${o.title}`, o.level === 'crit' ? 'crit' : o.level === 'warn' ? 'warn' : 'info', o.ref);
      recs.set(key, r);
    }
    function think() {
      // consumption rates (units per second, smoothed)
      for (const b of Object.values(P.bufs)) {
        const used = b.used - (b._u || 0); b._u = b.used;
        b.rate = ema(b.rate, used / 2, 0.08);
      }
      // 1. line-side runway against AGV arrival
      for (const b of Object.values(LS)) {
        const rw = runway(b);
        const s = P.byId[b.station];
        const m = b.mission;
        const stuck = m && m.agv && m.agv.fault;
        const eta = m ? (m.agv && !stuck ? Math.max(0, (m.eta || P.t) - P.t) : 300) : Infinity;
        if (m && (!m.agv || stuck) && rw < 420 && rw < eta + 60) {
          rec('rw:' + b.id, { agent: 'Logistics', level: rw < 180 ? 'crit' : 'warn', ref: s.id,
            title: `${s.name} (${P.lines[s.line].name}) runs out of ${b.label.toLowerCase()} in ${mins(rw)}`,
            body: stuck ? `${m.agv.id} is stopped with a fault while carrying this delivery. Send another AGV with a fresh batch from ${m.src.label.toLowerCase()}; the stuck load goes back to stock when ${m.agv.id} is recovered.` : `All AGVs are busy. The next free AGV arrives in about ${mins(eta)}, after the station stops. Pre-empt the lowest-priority mission to deliver now.`,
            actions: [{ id: 'expedite:' + b.id, label: 'Deliver now' }, { id: 'focus:' + s.id, label: 'Show station' }] });
        } else rec('rw:' + b.id, null);
      }
      // 2. machine health: remaining useful life
      for (const s of P.stations) {
        if (s.degrade > 0 && s.state !== 'down') {
          const rul = (s.health - 22) / s.degrade;
          alarm(`${s.id}.HEALTH`, true, { prio: 2, area: P.lines[s.line].name, msg: `${s.name} ${s.kind === 'mounter' ? 'spindle vibration' : 'condition'} rising · failure predicted in ${mins(rul)}`, ref: s.id });
          if (!s.planned) rec('rul:' + s.id, { agent: 'Maintenance', level: rul < 600 ? 'crit' : 'warn', ref: s.id,
            title: `${s.name} on ${P.lines[s.line].name} will fail in about ${mins(rul)}`,
            body: `Vibration ${s.sens.vib ? s.sens.vib.toFixed(1) : '—'} mm/s and rising (bearing wear signature, 94% match). Plan an 8-minute bearing change now: the main-board supermarket (${SM.main.items.length} boards) covers it. A failure means about 35 minutes down and both assembly lines starving.`,
            actions: [{ id: 'planRepair:' + s.id, label: 'Plan repair now' }, { id: 'focus:' + s.id, label: 'Show machine' }] });
        } else rec('rul:' + s.id, null);
      }
      // 3. supermarket runway when a line is not feeding it
      for (const lane of ['main', 'power']) {
        const b = SM[lane];
        const feeders = ['L1', 'L2'].filter(id => (P.lines[id].prodOverride || P.lines[id].product) === lane);
        const fed = feeders.some(id => P.lines[id].state === 'run' || P.lines[id].state === 'warn');
        const demand = lane === 'main' ? (P.lines.L3.state !== 'down' ? 95 : 0) + (P.lines.L4.state !== 'down' ? 164 : 0) : 95;
        const lineSide = lane === 'main' ? LS.L3main.items.length + LS.L4main.items.length : LS.L3power.items.length;
        const rw = (b.items.length + lineSide) / Math.max(1e-6, demand / 3600);
        b.rw = rw; b.lineSide = lineSide;
        const plannedOk = feeders.some(id => P.lines[id].tripped || P.lines[id].stations.some(x => x.state === 'maint' && x.repair < rw * 0.6) || P.lines[id].stations.some(x => x.state === 'changeover' || x.micro > 0));
        if (!fed && !plannedOk && rw < 2400) {
          const users = lane === 'main' ? 'both assembly lines' : 'Final Assembly A';
          rec('sm:' + lane, { agent: 'Planning', level: rw < 900 ? 'crit' : 'warn', ref: 'SM:' + lane,
            title: `${users[0].toUpperCase() + users.slice(1)} run out of ${b.label.toLowerCase()} in ${mins(rw)}`,
            body: lane === 'main' ? `SMT Line 1 is not feeding the supermarket (${b.items.length} boards in the supermarket and ${lineSide} at the lines; ${Math.round(demand)} an hour needed). Switch SMT Line 2 to main boards: a 4-minute changeover, then about 100 boards an hour. Power boards on hand cover ${mins(SM.power.items.length / (95 / 3600))}.` : `SMT Line 2 is not feeding power boards (${b.items.length} left).`,
            actions: lane === 'main' && !P.lines.L2.prodOverride ? [{ id: 'switchL2', label: 'Switch Line 2 to main boards' }, { id: 'focus:SM:main', label: 'Show supermarket' }] : [{ id: 'focus:SM:' + lane, label: 'Show supermarket' }] });
        } else rec('sm:' + lane, null);
        alarm('SM.' + lane, b.items.length < 20 && rw < 900, { prio: 2, area: 'Supermarket', msg: `${b.label} supermarket low · ${b.items.length} boards`, ref: 'SM:' + lane });
      }
      if (P.lines.L2.prodOverride && P.lines.L1.state === 'run' && SM.main.items.length > 90) {
        rec('switchBack', { agent: 'Planning', level: 'info', ref: 'L2-Loader', title: 'SMT Line 1 is back · return Line 2 to power boards', body: `Main boards are recovering (${SM.main.items.length} in the supermarket). Power boards left: ${SM.power.items.length}.`, actions: [{ id: 'switchBack', label: 'Switch Line 2 back' }] });
      } else rec('switchBack', null);
      // 4. quality drift at AOI with its root cause
      const aoi2 = P.byId['L2-AOI'], r2 = P.byId['L2-Reflow'];
      if (P.scen.reflow && !P.scen.reflow.fixed && P.scen.reflow.drift > 3) {
        alarm('L2-AOI.REJ', true, { prio: 3, area: 'SMT Line 2', msg: `AOI reject rate rising · solder bridges`, ref: 'L2-AOI' });
        rec('reflow', { agent: 'Quality', level: 'warn', ref: r2.id, title: 'Solder bridges up on SMT Line 2 · cause found: oven zone 5',
          body: `AOI rejects on power boards are ${Math.max(3, Math.round(P.scen.reflow.drift / 2.2))}× normal. Rejected boards all passed zone 5 at ${r2.sens.zones ? r2.sens.zones[4].toFixed(0) : '—'} °C, ${P.scen.reflow.drift.toFixed(0)} °C above setpoint (correlation 0.93). Correct the zone-5 setpoint; no stop needed.`,
          actions: [{ id: 'fixReflow', label: 'Correct zone 5 setpoint' }, { id: 'focus:' + r2.id, label: 'Show oven' }] });
      } else { rec('reflow', null); alarm('L2-AOI.REJ', false); }
      void aoi2;
      // 5. bad panel lot traced from final QC
      const L = P.scen.lot;
      if (L && L.injected && !L.quarantined && (L.fails || 0) >= 2) {
        alarm('QC.LOT', true, { prio: 2, area: 'Final Assembly A', msg: `TVs failing the screen test · dead pixels · lot ${L.lot}`, ref: 'L3-Functiontest' });
        const inLine = [...P.units].filter(u => u.type === 'tv' && u.lot === L.lot && !u.packed).length;
        rec('lot', { agent: 'Quality', level: 'crit', ref: 'L3-Functiontest', title: `TV panel lot ${L.lot} is failing the screen test`,
          body: `${L.fails} TVs failed with dead-pixel clusters at the function test and final QC; every one carries panel lot ${L.lot}. ${inLine} TVs with this lot are still in the line and ${level(LS.L3panel)} panels sit at Panel load. Quarantine the lot: stop using it and pull the next lot from the warehouse.`,
          actions: [{ id: 'quarantine', label: `Quarantine lot ${L.lot}` }, { id: 'focus:L3-Functiontest', label: 'Show the test station' }] });
      } else { rec('lot', null); alarm('QC.LOT', false); }
      // 6. orders at risk
      for (const o of P.orders) {
        if (o.state !== 'open' && o.state !== 'loading') { rec('ord:' + o.id, null); continue; }
        const rate = (o.product === 'tv' ? P.lines.L3.tph : P.lines.L4.tph) || 1;
        const fg = P.pallets.filter(p => p.product === o.product && (p.where === 'fg' || p.where === 'pickup' || p.where === 'fork') && !p.truck).reduce((a, p) => a + p.units.length, 0);
        const earlier = P.orders.filter(x => x !== o && x.product === o.product && (x.state === 'open' || x.state === 'loading') && x.due < o.due).reduce((a, x) => a + x.qty - x.shipped, 0);
        const need = Math.max(0, earlier + o.qty - o.shipped - (o.truck ? o.truck.loaded : 0) - fg);
        const ready = P.t + need / rate * 3600 + 22 * 60;   // + burn-in, QC, packing, loading
        o.eta = ready; o.risk = ready > o.due ? (ready - o.due) : 0;
        const LN = o.product === 'tv' ? 'L3' : 'L4';
        if (o.risk > 120 && o.due - P.t < 3.5 * 3600 && !P.lines[LN].boosted) {
          const tvL = o.product === 'tv';
          const fast = P.t + need / (rate * 1.1) * 3600 + 22 * 60;
          const fixes = fast <= o.due;
          rec('ord:' + o.id, { agent: 'Planning', level: o.risk > 1200 ? 'crit' : 'warn', ref: 'ORD:' + o.id,
            title: `Order ${o.id} (${o.customer}) will be about ${mins(o.risk)} late`,
            body: `${o.qty - o.shipped} ${tvL ? 'TVs' : 'phones'} due at ${clock(o.due)}, behind ${earlier} for earlier orders. At ${Math.round(rate)} an hour the last pallet is ready at ${clock(ready)}. Running ${P.lines[LN].name} at 110% ${fixes ? `ships it on time (ready ${clock(fast)})` : `cuts the delay to ${mins(fast - o.due)}; agree a split delivery for the rest`}; the twin keeps first-pass yield above 99% at that speed.`,
            actions: [{ id: 'boost:' + LN, label: `Run ${P.lines[LN].name} at 110%` }, { id: 'focus:ORD:' + o.id, label: 'Show order' }] });
        } else rec('ord:' + o.id, null);
      }
      // 7. bottleneck note when an operator is away
      if (P.scen.absent && !P.scen.absent.fixed) {
        const s = P.byId['L3-Backcover'];
        rec('absent', { agent: 'Planning', level: 'warn', ref: s.id, title: 'Back cover is now the TV line bottleneck',
          body: `Without its operator the station runs at about ${Math.round(s.base * s.speedMul)} s a TV against a 37 s takt; the line loses about ${Math.round(95 - 3600 / (s.base * s.speedMul))} TVs an hour. Laila Mostafa (rework) is certified on this station and the rework queue is ${P.rejects.rework.length}.`,
          actions: [{ id: 'cover', label: 'Move Laila to Back cover' }, { id: 'focus:' + s.id, label: 'Show station' }] });
      } else rec('absent', null);
      // 8. AGV fault
      for (const a of P.agvs) alarm(a.id + '.FAULT', !!a.fault, { prio: 2, area: 'Logistics', msg: `${a.id} stopped · ${a.fault || ''}`, ref: a.id });
      for (const a of P.agvs) if (a.battery < 15 && !a.fault) alarm(a.id + '.BATT', true, { prio: 4, area: 'Logistics', msg: `${a.id} battery ${Math.round(a.battery)}%`, ref: a.id }); else alarm(a.id + '.BATT', false);
      // station alarms (starved or blocked for a while)
      for (const s of P.stations) {
        const long = P.t - s.since;
        alarm(`${s.id}.MS`, s.state === 'micro' && long > 60, { prio: 4, area: P.lines[s.line] ? P.lines[s.line].name : 'Plant', msg: `${s.name}: ${s.why.toLowerCase()}`, ref: s.id });
        alarm(`${s.id}.STV`, s.state === 'starved' && long > 45, { prio: 3, area: P.lines[s.line] ? P.lines[s.line].name : 'Plant', msg: `${s.name}: ${s.why.toLowerCase()}`, ref: s.id });
        alarm(`${s.id}.BLK`, s.state === 'blocked' && long > 300 && s.idx > 0, { prio: 4, area: P.lines[s.line] ? P.lines[s.line].name : 'Plant', msg: `${s.name}: outfeed blocked`, ref: s.id });
      }
      P.recs = [...recs.values()].sort((a, b) => ({ crit: 0, warn: 1, info: 2 }[a.level] - { crit: 0, warn: 1, info: 2 }[b.level]) || a.t - b.t);
      // predictions summary for the plant panel (what happens next if nobody acts)
      P.preds = [];
      for (const b of Object.values(LS)) {
        const rw = runway(b);
        const m = b.mission, ok = (m && m.agv && !m.agv.fault && (!m.eta || m.eta - P.t < rw)) || (!m && level(b) > b.rop);
        if (rw < 900 && !ok) P.preds.push({ key: b.id, ref: b.id, text: `${P.byId[b.station].name} runs out of ${b.label.toLowerCase()}`, sub: `${P.lines[P.byId[b.station].line].name} · ${m ? (m.agv ? m.agv.id + ' late' : 'waiting for an AGV') : 'no delivery planned'}`, eta: rw, covered: false });
      }
      for (const lane of ['main', 'power']) {
        const feeders = ['L1', 'L2'].filter(id => (P.lines[id].prodOverride || P.lines[id].product) === lane);
        const fed = feeders.some(id => P.lines[id].state === 'run' || P.lines[id].state === 'warn');
        if (!fed && SM[lane].rw < 3600) P.preds.push({ key: 'SM:' + lane, ref: 'SM:' + lane, text: `${SM[lane].label} run out for assembly`, sub: `Board supermarket · ${feeders.map(id => P.lines[id].name).join(', ')} not feeding`, eta: SM[lane].rw, covered: false });
      }
      for (const o of P.orders) if ((o.state === 'open' || o.state === 'loading') && o.risk > 120 && o.due - P.t < 3.5 * 3600) P.preds.push({ key: 'ORD:' + o.id, ref: 'ORD:' + o.id, text: `Order ${o.id} ships late`, sub: `${o.customer} · due ${clock(o.due)}, ready ${clock(o.eta)}`, eta: Math.max(0, o.due - P.t), delay: o.risk, covered: false, late: true });
      for (const s of P.stations) if (s.degrade > 0 && s.state !== 'down') P.preds.push({ key: s.id, ref: s.id, text: `${s.name} fails`, sub: `${P.lines[s.line].name} · bearing wear`, eta: (s.health - 22) / s.degrade, covered: !!s.planned });
      const panelCover = (RM.panel.qty + level(LS.L3panel)) / (95 / 3600);
      const nextPanels = P.inbound.find(t => t.mat === 'panel' && t.state === 'due');
      if (panelCover < 3 * 3600 && (!nextPanels || nextPanels.at - P.t > panelCover)) P.preds.push({ key: 'RM:panel', ref: 'RM:panel', text: 'TV panels run out', sub: `Raw-material warehouse · next truck ${nextPanels ? clock(nextPanels.at) : 'not booked'}`, eta: panelCover, covered: false });
      P.preds.sort((a, b) => a.eta - b.eta);
      emit('recs');
    }

    /* ----- actions (from the AI cards or the operator) ----- */
    function apply(id, who = 'You') {
      const [k, arg] = id.split(/:(.+)/);
      if (k === 'focus') return emit('focus', arg);
      recs.delete(id.startsWith('planRepair') ? 'rul:' + arg : id);
      if (k === 'expedite') {
        const b = P.bufs[arg]; const m = b.mission;
        if (m && m.agv && m.agv.fault) { const dead = m.agv; dead.mission = null; dead.phase = 'idle'; dead.path = null; m.agv = null; }
        if (m && !m.agv) {
          m.prio = 3; m.watched = true;
          // pre-empt: take the AGV with the least urgent mission that has not picked up yet
          let a = P.agvs.filter(x => !x.fault && x.mission && x.phase === 'toPick').sort((x, y) => runway(y.mission.buf) - runway(x.mission.buf))[0];
          if (a) { const old = a.mission; old.agv = null; a.mission = null; assign(a, m); log('AI', `Logistics agent re-assigned ${a.id} from ${old.buf.label.toLowerCase()} to ${b.label.toLowerCase()} for ${P.byId[b.station].name}`); }
          else dispatch();
        }
        audit(who, 'Expedited delivery', `${b.label} to ${P.byId[b.station].name}`);
        P.saved += 60000;
      } else if (k === 'planRepair') {
        const s = P.byId[arg]; if (!s || s.state === 'down') return;
        s.planned = true; s.degrade = 0;
        audit(who, 'Planned repair', `${s.name} bearing change now (8 min) instead of failure`);
        log('CMMS', `Work order WO-${4811 + P.seq % 80} approved · ${s.name} bearing change`, 'info', s.id);
        setState(s, 'maint', 'Planned bearing change'); s.repair = 480; s.procs.forEach(p => { p.left += 1; });
        alarm(`${s.id}.HEALTH`, false);
        sendTech(s);
        s.onRepaired = () => { s.planned = false; P.saved += 1600000; log('AI', `Breakdown avoided on ${s.name}: about 35 minutes of downtime and EGP 1.6M protected`, 'info', s.id); emit('toast', { msg: `Breakdown avoided on ${s.name}. About EGP 1.6M protected.`, level: 'success' }); };
      } else if (k === 'switchL2') {
        const l2 = P.lines.L2; l2.prodOverride = 'main';
        audit(who, 'Product changeover', 'SMT Line 2 → main boards');
        log('MES', 'SMT Line 2 changeover to main boards started (4 min)', 'info', 'L2-Loader');
        l2.stations.forEach(s => { setState(s, 'changeover', 'Changeover to main boards'); s.co = 240; });
        const pcbB = LS.L2pcb; pcbB.src = 'RM:pcbMain'; pcbB.label = 'Bare PCBs (main)';
      } else if (k === 'switchBack') {
        const l2 = P.lines.L2; l2.prodOverride = null;
        l2.stations.forEach(s => { setState(s, 'changeover', 'Changeover to power boards'); s.co = 240; });
        LS.L2pcb.src = 'RM:pcbPower'; LS.L2pcb.label = 'Bare PCBs';
        audit(who, 'Product changeover', 'SMT Line 2 → power boards'); log('MES', 'SMT Line 2 back to power boards', 'info', 'L2-Loader');
      } else if (k === 'fixReflow') {
        if (P.scen.reflow) { P.scen.reflow.fixed = true; P.saved += 240000; }
        audit(who, 'Corrected setpoint', 'SMT Line 2 oven zone 5 back to 228 °C');
        log('AI', 'Quality agent: oven zone 5 setpoint corrected on SMT Line 2', 'info', 'L2-Reflow');
        emit('toast', { msg: 'Oven zone 5 corrected. Solder defects back to normal.', level: 'success' });
      } else if (k === 'quarantine') {
        const L = P.scen.lot; if (!L) return;
        L.quarantined = true;
        const held = LS.L3panel.lots.filter(l => l.id === L.lot).reduce((a, l) => a + l.qty, 0) + RM.panel.lots.filter(l => l.id === L.lot).reduce((a, l) => a + l.qty, 0);
        LS.L3panel.lots = LS.L3panel.lots.filter(l => l.id !== L.lot); LS.L3panel.qty = LS.L3panel.lots.reduce((a, l) => a + l.qty, 0);
        RM.panel.lots = RM.panel.lots.filter(l => l.id !== L.lot); RM.panel.qty = RM.panel.lots.reduce((a, l) => a + l.qty, 0);
        if (LS.L3panel.qty < LS.L3panel.rop && !LS.L3panel.mission) createMission(LS.L3panel, 3, 'Quarantine replacement');
        audit(who, 'Quarantined lot', `${L.lot} · ${held} panels blocked · supplier claim raised`);
        log('QMS', `Lot ${L.lot} quarantined · ${held} panels blocked · supplier claim raised`, 'warn', 'L3-Panelload');
        P.saved += 380000;
        emit('toast', { msg: `Lot ${L.lot} quarantined. ${held} bad panels kept off the line.`, level: 'success' });
      } else if (k === 'boost') {
        const L = P.lines[arg]; L.speed = 1.1; L.boosted = true;
        audit(who, 'Raised line speed', `${L.name} 100% → 110%`);
        log('MES', `${L.name} speed raised to 110% to protect the order`, 'info', L.stations[0].id);
      } else if (k === 'cover') {
        const s = P.byId['L3-Backcover']; s.speedMul = 1; if (P.scen.absent) P.scen.absent.fixed = true;
        const laila = P.people.find(p => p.name === 'Laila Mostafa'); if (laila) { laila.x = s.x; laila.z = s.z + s.d / 2 + 0.8; s.operator = laila; }
        audit(who, 'Moved operator', 'Laila Mostafa from rework to Back cover');
        log('MES', 'Laila Mostafa now at Back cover · TV line back to takt', 'info', s.id);
      } else if (k === 'speed') {
        P.speed = +arg;
      }
      thinkSoon = true;
      emit('recs');
    }
    let thinkSoon = false;
    const timers = [];
    function setTimeout0(fn, sec) { timers.push({ at: P.t + sec, fn }); }

    /* ----- scenarios (drills) ----- */
    function trigger(id) {
      const sc = SCENARIOS.find(s => s.id === id);
      if (sc) audit('You', 'Started drill', sc.title);
      if (id === 'bearing') {
        const s = P.byId['L1-MounterB']; if (s.state === 'down' || s.degrade) return;
        s.health = Math.min(s.health, 74); s.degrade = 0.03; s.failWhy = 'Spindle bearing seized'; s.failRepair = 2100;
        log('IoT', 'Mounter B (SMT Line 1) vibration trend changed slope', 'warn', s.id);
      } else if (id === 'agv') {
        const a = P.agvs.find(x => x.load && x.path && !x.fault);
        if (!a) { P.scen.agvNext = true; log('AGV', 'Drill armed: the next loaded AGV on the aisle will fault'); return; }
        delete P.scen.agvNext;
        a.fault = 'Drive motor overcurrent'; a.v = 0;
        log('AGV', `${a.id} stopped on the aisle · drive motor overcurrent`, 'crit', a.id);
        const m = a.mission;
        setTimeout0(() => {
          if (m && a.phase === 'toPick') { m.agv = null; a.mission = null; log('AI', `Logistics agent re-assigned ${m.buf.label.toLowerCase()} for ${P.byId[m.buf.station].name} to the next free AGV`); dispatch(); }
          else if (m) log('AI', `Logistics agent: ${a.id} holds ${a.load ? a.load.qty + ' ' + a.load.label.toLowerCase() : 'no load'}; recovery requested from the AGV vendor hotline`);
        }, 4);
        setTimeout0(() => {
          a.fault = null;
          if (a.load && !a.mission) { const src = P.bufs[a.loadSrc]; if (src) { if (src.items) src.items.push(...(a.load.items || [])); else src.qty += a.load.qty; } a.load = null; }
          if (!a.path && !a.mission) { a.phase = 'toCharge'; drive(a, a.home); }
          log('AGV', `${a.id} recovered and back in service`);
        }, 420);
      } else if (id === 'lot') {
        // the bad lot goes straight to the line-side stock at Panel load
        const lot = 'PL-2207' + pad(Math.floor(rnd(10, 99)), 2);
        P.scen.lot = { lot, injected: true, fails: 0 };
        LS.L3panel.lots.unshift({ id: lot, qty: 12 }); LS.L3panel.qty += 12;
        RM.panel.lots.unshift({ id: lot, qty: 120, supplier: 'Supplier B' }); RM.panel.qty += 120;
        log('Receiving', `Panel lot ${lot} released to Final Assembly A`, 'info', 'L3-Panelload');
      } else if (id === 'reflow') {
        P.scen.reflow = { line: 'L2', drift: 0, fixed: false, rising: true };
        log('IoT', 'SMT Line 2 oven zone 5 drifting above setpoint', 'warn', 'L2-Reflow');
      } else if (id === 'inbound') {
        const tr = P.inbound.find(t => t.mat === 'panel' && t.state === 'due');
        if (tr) { tr.at += 3 * 3600; log('SCM', `${tr.id} (TV panels) held at the port gate · ETA ${clock(tr.at)}`, 'warn'); }
        P.scen.inbound = { tr };
        const cover = (RM.panel.qty + level(LS.L3panel)) / (95 / 3600);
        rec('inbound', { agent: 'Planning', level: cover < 3 * 3600 ? 'crit' : 'warn', ref: 'RM:panel', title: `TV panels cover ${mins(cover)}; the truck is 3 hours late`,
          body: `Panel stock (warehouse ${RM.panel.qty} + line-side ${level(LS.L3panel)}) runs out at ${clock(P.t + cover)}. Book the alternative carrier: panels arrive in 70 minutes for EGP 18k extra, against about EGP 420k of lost TV output.`,
          actions: [{ id: 'expediteTruck', label: 'Book alternative carrier' }, { id: 'focus:RM:panel', label: 'Show warehouse' }] });
      } else if (id === 'power') {
        ['L1', 'L2'].forEach(l => { P.lines[l].tripped = true; });
        alarm('GRID.DIP', true, { prio: 1, area: 'Utilities', msg: 'Grid voltage dip 18% for 400 ms · SMT lines tripped', ref: 'UTIL-TX' });
        const inOven = ['L1-Reflow', 'L2-Reflow'].reduce((a, i) => a + P.byId[i].procs.length, 0);
        log('EMS', `Voltage dip · ${inOven} boards were inside the ovens and are held for re-inspection`, 'crit', 'UTIL-TX');
        log('AI', 'Energy agent: restarting SMT Line 1, then Line 2 after 60 s, to avoid an inrush peak');
        setTimeout0(() => { P.lines.L1.tripped = false; log('EMS', 'SMT Line 1 restarted'); }, 90);
        setTimeout0(() => { P.lines.L2.tripped = false; alarm('GRID.DIP', false); log('EMS', 'SMT Line 2 restarted · both lines running'); P.saved += 220000; }, 150);
      } else if (id === 'rush') {
        P.orders.push({ id: 'EX-2231', customer: 'Export · Gulf (rush)', product: 'phone', qty: 240, due: Math.max(P.t + 3 * 3600, 12.5 * 3600), shipped: 0, state: 'open', truck: null, risk: 0 });
        P.orders.sort((a, b) => a.due - b.due);
        log('ERP', 'Rush order EX-2231 · 240 phones · added to today', 'warn');
      } else if (id === 'absent') {
        const s = P.byId['L3-Backcover']; s.speedMul = 1.55; P.scen.absent = { fixed: false };
        log('MES', `${s.operator ? s.operator.name : 'Operator'} called away from Back cover · team leader covering at reduced pace`, 'warn', s.id);
      }
      thinkSoon = true;
      emit('scenario', id);
    }

    /* ----- main step ----- */
    let acc1 = 0, acc2 = 0, acc5 = 0;
    function step(dt) {
      P.t += dt;
      for (let i = timers.length - 1; i >= 0; i--) if (timers[i].at <= P.t) { const f = timers[i].fn; timers.splice(i, 1); f(); }
      if (P.scen.reflow && !P.scen.reflow.fixed) P.scen.reflow.drift = Math.min(9, P.scen.reflow.drift + dt * 0.03);
      if (P.scen.reflow && P.scen.reflow.fixed) { P.scen.reflow.drift = Math.max(0, P.scen.reflow.drift - dt * 0.2); if (P.scen.reflow.drift <= 0) delete P.scen.reflow; }
      // conveyors move first, from the head of each segment
      for (const sg of P.segs) {
        const v = sg.speed * (P.lines[sg.from && sg.from.line] ? P.lines[sg.from.line].speed : 1);
        for (let i = 0; i < sg.items.length; i++) {
          const it = sg.items[i];
          const lim = i === 0 ? sg.len : sg.items[i - 1].s - sg.pitch;
          it.s = Math.max(it.s, Math.min(lim, it.s + v * dt));
        }
      }
      for (const s of P.stations) if (s !== SMTREP && s !== REWORK) stationStep(s, dt);
      repairsStep();
      for (const a of P.agvs) agvStep(a, dt);
      for (const f of P.forklifts) flStep(f, dt);
      peopleStep(dt);
      inboundStep(dt);
      // trucks: arrive for orders an hour before due; drive in and out
      for (const o of P.orders) if (o.state === 'open' && P.t >= o.due - 75 * 60) truckArrive(o);
      for (const tr of P.trucks) {
        if (tr.state === 'arriving') { tr.k = Math.min(1, tr.k + dt / 40); if (tr.k >= 1) tr.state = 'loading'; }
        else if (tr.state === 'leaving') { tr.k = Math.max(0, tr.k - dt / 40); if (tr.k <= 0) tr.state = 'gone'; }
        else if (tr.state === 'loading' && P.t > tr.order.due + 20 * 60 && tr.loaded > 0) truckDepart(tr);
      }
      for (const tr of P.trucks) if (tr.state === 'gone' && tr.dock.truck === tr) tr.dock.truck = null;
      P.trucks = P.trucks.filter(t => t.state !== 'gone');
      // archive shipped units occasionally
      acc1 += dt; acc2 += dt; acc5 += dt;
      if (acc1 >= 1) {
        acc1 = 0;
        // Kanban: line-side stock at or below its reorder point creates an AGV mission
        for (const b of Object.values(LS)) if (level(b) <= b.rop && !b.mission) createMission(b, 1, 'Kanban');
        dispatch();
        for (const s of P.stations) sensors(s, 1);
        utilStep();
        for (const p of P.pallets) if (p.where === 'truck' && p.truck && p.truck.state === 'gone') { p.where = 'shipped'; p.units.forEach(archive); }
        P.pallets = P.pallets.filter(p => p.where !== 'shipped');
        P.energy.kwh += (P.kpi.kw || 0) / 3600;
        if (Math.floor(P.t) % 30 === 0) replenish();
      }
      if (acc2 >= 2 || thinkSoon) { acc2 = 0; thinkSoon = false; think(); }
      if (acc5 >= 5) { acc5 = 0; kpis(); for (const s of P.stations) record(s); }
    }

    function run(realDt) {
      if (P.paused) return;
      let left = realDt * P.speed;
      const h = P.speed > 8 ? 0.25 : 0.1;
      let n = 0;
      while (left > 1e-6 && n < 400) { const d = Math.min(h, left); step(d); left -= d; n++; }
      emit('tick');
    }

    // warm start: run the plant for 55 minutes so every line, buffer and rack is naturally full
    P.t = START - 55 * 60;
    for (const L of ['L3', 'L4']) {
      // seed the line-side boards from the supermarket's opening stock
      const lane = LS[L + 'main'];
      for (let i = 0; i < (L === 'L3' ? 22 : 34); i++) { const b = unit('main', { line: 'L1', born: P.t - 3600 - i * 30 }); b.steps.push({ st: 'L1-AOI', name: 'AOI', line: 'L1', t0: b.born, t1: b.born + 300, ok: true, note: 'Pass' }); b.loc = { k: 'ls', b: lane }; lane.items.push(b); }
    }
    for (let i = 0; i < 24; i++) { const b = unit('power', { line: 'L2', born: P.t - 3600 - i * 40 }); b.steps.push({ st: 'L2-AOI', name: 'AOI', line: 'L2', t0: b.born, t1: b.born + 300, ok: true, note: 'Pass' }); b.loc = { k: 'ls', b: LS.L3power }; LS.L3power.items.push(b); }
    for (let i = 0; i < 140; i++) { const b = unit('main', { line: 'L1', born: P.t - 1800 - i * 13 }); b.steps.push({ st: 'L1-AOI', name: 'AOI', line: 'L1', t0: b.born, t1: b.born + 300, ok: true, note: 'Pass' }); b.loc = { k: 'sm' }; SM.main.items.push(b); }
    for (let i = 0; i < 70; i++) { const b = unit('power', { line: 'L2', born: P.t - 1800 - i * 30 }); b.steps.push({ st: 'L2-AOI', name: 'AOI', line: 'L2', t0: b.born, t1: b.born + 300, ok: true, note: 'Pass' }); b.loc = { k: 'sm' }; SM.power.items.push(b); }
    // a few finished pallets already in the warehouse
    for (let i = 0; i < 6; i++) {
      const tv = i % 2 === 0, p = { id: 'PAL-' + (++palletSeq), product: tv ? 'tv' : 'phone', units: [], where: 'fg', cap: tv ? 8 : 40, built: P.t - 3000 + i * 300 };
      for (let j = 0; j < p.cap; j++) { const u = unit(tv ? 'tv' : 'phone', { born: P.t - 7000, packed: P.t - 3200 }); u.steps.push({ st: 'L5-Packing', name: 'Packing', line: 'L5', t0: u.packed, t1: u.packed, ok: true, note: 'Packed before 08:20' }); u.pallet = p.id; u.loc = { k: 'pallet', p }; p.units.push(u); }
      const slot = P.fgSlots[i * 3 + 1]; slot.p = p; p.slot = slot; p.x = slot.x; p.z = slot.z;
      P.pallets.push(p);
    }
    P.made.packedTv = 0; P.made.packedPhone = 0;
    while (P.t < START) step(0.5);
    P.events.length = 0; P.audit.length = 0; recs.clear(); alarmMap.clear(); P.alarms = [];
    for (const s of P.stations) { s.hist = {}; for (let i = 0; i < 40; i++) { sensors(s, 1); record(s); } }
    for (let i = 0; i < 24; i++) kpis();
    log('MES', 'Shift A running · Plant EG-01 · 5 lines, 6 AGVs, 2 forklifts, 13 people on the floor');
    think();

    P.layout = {
      AISLES, STOPS, DOCKS,
      ZONES: [
        { id: 'rm', name: 'Raw-material warehouse', x0: 2, z0: 3, x1: 25.5, z1: 53, view: [14, 28, 58] },
        { id: 'smt', name: 'SMT hall', x0: 33, z0: 4, x1: 84, z1: 25, view: [56, 15, 52] },
        { id: 'fa', name: 'Assembly hall', x0: 33, z0: 29.5, x1: 92, z1: 50.5, view: [62, 40, 60] },
        { id: 'tp', name: 'Test & pack', x0: 94, z0: 29, x1: 124, z1: 62, view: [106, 47, 50] },
        { id: 'fg', name: 'Finished goods and docks', x0: 32, z0: 57, x1: 80, z1: 78, view: [54, 68, 56] },
        { id: 'util', name: 'Utilities', x0: 100, z0: 3, x1: 125, z1: 20, view: [112, 12, 36] },
        { id: 'shop', name: 'Maintenance shop', x0: 89, z0: 3, x1: 98, z1: 14, view: [93, 8, 22] }
      ],
      W: 128, D: 80
    };

    const api = {
      P, SCENARIOS, KIND, STOPS, LINES, clock, clockS, mins,
      on(fn) { listeners.push(fn); },
      run, step, trigger, apply, findUnit, route, level,
      get t() { return P.t; },
      setSpeed(v) { P.speed = v; P.paused = v === 0; emit('speed'); },
      fastForward(sec) { const h = 0.25; for (let i = 0; i < sec / h; i++) step(h); emit('tick'); emit('recs'); },
      dismiss(key) { const r = recs.get(key); if (r) { r.dismissed = true; P.recs = P.recs.filter(x => x.key !== key); emit('recs'); } },
      ack(key) { const a = alarmMap.get(key); if (a) { a.state = 'ack'; emit('alarms'); } },
      bufs: P.bufs, LS, RM, SM, BURN, QC, PACK, PAL, SMTREP, REWORK, missions,
      expediteTruck() {}
    };
    // the alternative carrier for the inbound drill
    const _apply = apply;
    api.apply = (id, who) => {
      if (id === 'expediteTruck') {
        const tr = P.scen.inbound && P.scen.inbound.tr;
        if (tr) { tr.at = P.t + 70 * 60; tr.state = 'due'; }
        recs.delete('inbound'); P.saved += 400000;
        audit(who || 'You', 'Booked alternative carrier', 'TV panels arrive in 70 min · EGP 18k extra');
        log('SCM', `Alternative carrier booked · TV panels due ${clock(P.t + 70 * 60)}`, 'info');
        emit('recs'); return;
      }
      return _apply(id, who);
    };
    return api;
  }

  const PlantEngine = { create, SCENARIOS, clock, clockS, mins };
  if (typeof module !== 'undefined' && module.exports) module.exports = PlantEngine;
  else root.PlantEngine = PlantEngine;
})(typeof window !== 'undefined' ? window : globalThis);
