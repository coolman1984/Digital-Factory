/* Digital Factory — Plant EG-01 twin engine (v2).
   A unit-level model of the whole fictional plant: raw-material warehouse, two SMT lines, a board supermarket, two
   assembly lines (TVs and smartphones), burn-in, final QC, packing, palletizing, finished goods, shipping, AGVs,
   forklifts, people, utilities, energy and orders. Every unit carries a serial and its genealogy.

   v2 design:
   - The whole plant state is one plain object graph, the world W. Behaviour is bound to a world by bind(W), so a
     world can be copied with structuredClone (fork, what-if, save, send to another tab) and keep running.
   - Time advances in fixed steps of STEP plant seconds. The same commands at the same step give the same plant, so
     tabs can follow one another in lockstep and a saved command log replays exactly.
   - The engine models physics and records data (sensors, genealogy, counters, alarms). It does not write advice:
     detection, diagnosis and recommendations belong to the agents (assets/js/agents/).
   Pure model: no DOM, seeded random numbers, no wall clock. All data is simulated.
   Coordinates are metres: x east, z south. Time is plant seconds since midnight. */
(function (root) {
  'use strict';

  const STEP = 0.1;                      // plant seconds per fixed step
  const START = 9 * 3600 + 12 * 60;      // 09:12, shift A runs 06:00–14:00
  const SHIFT_START = 6 * 3600, SHIFT_END = 14 * 3600;
  const HIST = 180;                      // samples per telemetry series (one every 5 plant seconds = 15 min)

  /* ---------------- helpers ---------------- */
  function next(s) {                     // mulberry32 with its state in a plain object, so it clones with the world
    s.a = (s.a + 0x6D2B79F5) | 0;
    let t = Math.imul(s.a ^ (s.a >>> 15), 1 | s.a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
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
  const TAKT = { L3: 37, L4: 21 };       // planned seconds per unit on the assembly lines

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

  // money model for decisions (sample assumptions, EGP; labelled as such wherever shown)
  const COST = {
    margin: { tv: 2400, phone: 900 },     // contribution per packed unit
    lateHour: 18000,                      // penalty and expediting per order-hour late
    unplannedRepair: 45000,               // parts, labour and scrap of a breakdown
    plannedRepair: 6000,
    scrap: { main: 650, power: 420, tv: 3200, phone: 1400 },
    rework: 180,
    smtRepair: 120,                       // repair labour for one AOI reject
    oosBoard: 90,                         // latent-defect risk of a board soldered outside the validated window
    demandKw: 900,                        // per kW above the contract demand
    lineMin: { L1: 3200, L2: 1400, L3: 3800, L4: 2600, L5: 5200 },   // value of one minute of a stopped line (downstream effects included)
    altCarrier: 18000,
    nearMiss: 250000                      // expected cost of a safety incident avoided (risk-weighted)
  };
  const TARIFF = [                        // EGP per kWh by plant hour (sample tariff)
    { from: 0, to: 6, name: 'Off-peak', egp: 1.1 }, { from: 6, to: 11, name: 'Standard', egp: 1.6 },
    { from: 11, to: 14, name: 'Peak', egp: 2.6 }, { from: 14, to: 17, name: 'Standard', egp: 1.6 },
    { from: 17, to: 22, name: 'Peak', egp: 2.6 }, { from: 22, to: 24, name: 'Off-peak', egp: 1.1 }
  ];
  const CONTRACT_KW = 640;                // contracted maximum demand

  const SCENARIOS = [
    { id: 'bearing', title: 'Bearing wear on Mounter B', area: 'SMT Line 1', agent: 'maint',
      what: 'The spindle bearing on Mounter B starts to wear. Vibration climbs.', chain: 'Mounter B → SMT Line 1 → main-board supermarket → both assembly lines → orders' },
    { id: 'agv', title: 'AGV breaks down mid-route', area: 'Logistics', agent: 'logistics',
      what: 'AGV-03 stops on the main aisle with a drive fault while carrying a load.', chain: 'AGV-03 → its open mission → the line waiting for it' },
    { id: 'lot', title: 'Bad panel lot reaches the TV line', area: 'Final Assembly A', agent: 'quality',
      what: 'A supplier lot of TV panels has a pixel defect. Final QC starts failing TVs.', chain: 'Panel lot → TVs built with it → Final QC → rework → order' },
    { id: 'reflow', title: 'Reflow oven drifts hot', area: 'SMT Line 2', agent: 'quality',
      what: 'Zone 5 on the Line 2 oven drifts +9 °C. Solder defects start at AOI.', chain: 'Oven zone 5 → solder joints → AOI rejects → power-board supply' },
    { id: 'robot', title: 'Screw robot faults, alarms flood', area: 'Final Assembly B', agent: 'maint',
      what: 'The phone line screw robot stops with a servo torque fault. Its alarms and the line\'s follow-on alarms flood the screen.', chain: 'Screw robot → Final Assembly B → phone orders' },
    { id: 'inbound', title: 'Panel truck delayed 4 hours', area: 'Supply chain', agent: 'planner',
      what: 'The inbound truck with TV panels is held at the port gate.', chain: 'Inbound truck → panel stock → Final Assembly A → TV orders' },
    { id: 'rush', title: 'Rush order: +240 phones by 12:30', area: 'Planning', agent: 'planner',
      what: 'A customer adds 240 smartphones due at 12:30.', chain: 'New order → Final Assembly B capacity → packing → shipping dock' },
    { id: 'absent', title: 'Operator called away', area: 'Final Assembly A', agent: 'planner',
      what: 'The Back cover operator on the TV line is called to another task.', chain: 'Back cover station → TV line takt → TV orders' },
    { id: 'power', title: 'Grid voltage dip', area: 'Utilities', agent: 'energy',
      what: 'An 18% voltage dip for 400 ms trips the SMT lines and both ovens.', chain: 'Grid → SMT lines and ovens → boards in the ovens → supermarket' },
    { id: 'peak', title: 'Demand spike in the peak tariff', area: 'Utilities', agent: 'energy',
      what: 'Compressor 2 starts and Chiller 2 goes to full load together while the peak tariff is on. Demand heads over the contract.', chain: 'Chiller 2 + Compressor 2 → plant demand → contract limit → demand charge' },
    { id: 'heat', title: 'Heat wave this afternoon', area: 'Whole plant', agent: 'energy',
      what: 'Ambient climbs to 41 °C. Chillers work harder and both reflow ovens drift warm.', chain: 'Ambient → chillers → plant demand; ambient → ovens → solder quality' },
    { id: 'safety', title: 'Person inside a robot cell', area: 'Final Assembly B', agent: 'safety',
      what: 'Vision AI sees an operator reach into the phone line screw robot cell.', chain: 'Person in cell → robot → safe speed → near-miss report' }
  ];

  /* ---------------- the world: layout and initial state ---------------- */
  function world(seed) {
    const rng = { a: seed >>> 0 };
    const R = () => next(rng);
    const rnd = (a, b) => a + R() * (b - a);
    const pick = arr => arr[Math.floor(R() * arr.length)];

    const P = {
      t: START, k: 0, seq: 0,
      stations: [], byId: {}, lines: {}, segs: [], bufs: {}, sm: { main: [], power: [] },
      agvs: [], forklifts: [], people: [], techs: [], inbound: [], trucks: [], orders: [], pallets: [], fgSlots: [],
      units: new Set(), archive: new Map(), archiveOrder: [], events: [], alarms: [], preds: [], audit: [],
      kpi: {}, hist: { t: [], kw: [], tph: [], oee: [], wip: [], packed: [] }, scen: {},
      energy: { kwh: 0, cost: 0, peak: 0, contract: CONTRACT_KW, tariff: 'Standard', price: 1.6, over: 0, iKwh: 0, iSec: 0, iNo: -1, lastAvg: 0, proj: 0, avgHist: [] },
      made: { main: 0, power: 0, tv: 0, phone: 0, packedTv: 0, packedPhone: 0 },
      base: { tv: 186, phone: 342 },                   // units packed before the model started (06:00 → warm start)
      rejects: { aoi: 0, fct: 0, qc: 0, smtRepair: [], rework: [] },
      aoiLog: { L1: [], L2: [] }, testLog: [], cmdLog: [],
      alarmStats: { raised: 0, recent: [], rate10: 0, flood: false, floods: 0, peak10: 0 },
      nodes: [], edges: [], layout: {}, leads: []
    };
    const W = {
      v: 2, seed, rng, P,
      c: { sn: 41820, pal: 5120, truck: 0, ord: 7740, inb: 885, wo: 4811 },
      acc: { a1: 0, a2: 0, a5: 0, sense: false, steps: 0 },
      stats: { downSec: { L1: 0, L2: 0, L3: 0, L4: 0, L5: 0 }, starvedSec: 0, kwh: 0, energyCost: 0, demandCost: 0, scrap: 0, scrapCost: 0, rework: 0,
        failures: 0, lateOrders: 0, lateSec: 0, shipped: 0, stockouts: 0, nearMiss: 0, repairCost: 0, extraCost: 0, oos: 0, smtRepairs: 0 },
      missions: [], timers: [], win: [], alarmMap: new Map(),
      X: {}, G: {}, LS: {}, RM: {}, SM: {}, STOPS: {}, DOCKS: []
    };

    function buf(id, o) {
      const b = Object.assign({ id, qty: 0, cap: 100, rop: 30, batch: 60, items: null, lots: null, pending: 0, rate: 0, used: 0, mission: null, node: null, dry: 0 }, o);
      P.bufs[id] = b; return b;
    }
    function station(o) {
      return Object.assign({ procs: [], out: null, state: 'idle', since: 0, why: '', health: rnd(86, 99), degrade: 0, repair: 0, tech: null,
        counters: { run: 0, idle: 0, starved: 0, blocked: 0, down: 0, made: 0, bad: 0, std: 0 }, sens: {}, hist: {}, kwNow: 0, speedMul: 1,
        needs: [], manual: false, operator: null, fault: null, ctEma: 0, gapEma: 0, lastStart: 0, wearMul: 1, intrusion: null, safe: false }, o);
    }

    /* ----- layout: lines and stations ----- */
    for (const L of LINES) {
      const line = { id: L.id, name: L.name, sub: L.sub, product: L.product, z: L.z, stations: [], speed: 1, stopped: false, made: 0, good: 0,
        oee: 0.86, avail: 0.92, perf: 0.95, qual: 0.99, tph: 0, state: 'run', since: 0, changeover: 0, prodOverride: null, inspect: false };
      let x = L.x0;
      L.st.forEach(([name, kind, cyc, slots], i) => {
        const K = KIND[kind];
        const id = `${L.id}-${name.replace(/\W+/g, '')}`;
        const s = station({ id, name, line: L.id, kind, idx: i, x: x + K.w / 2, z: L.z, w: K.w, d: K.d, h: K.h, base: cyc, slots: slots || 1,
          manual: kind === 'bench', mtbf: kind === 'reflow' ? 9e9 : rnd(40, 90) * 3600 });
        x += K.w + L.gap;
        P.stations.push(s); P.byId[id] = s; line.stations.push(s);
      });
      P.lines[L.id] = line;
    }
    // Test & Pack (L5) and support stations, placed by hand
    P.lines.L5 = { id: 'L5', name: 'Test & Pack', sub: 'All products', product: 'mix', stations: [], speed: 1, stopped: false, made: 0, good: 0, oee: 0.87, avail: 0.93, perf: 0.95, qual: 0.995, tph: 0, state: 'run' };
    function extra(id, name, kind, x, z, base, slots, line = 'L5', o) {
      const K = KIND[kind];
      const s = station(Object.assign({ id, name, line, kind, idx: 0, x, z, w: K.w, d: K.d, h: K.h, base, slots: slots || 1, mtbf: rnd(50, 110) * 3600 }, o));
      P.stations.push(s); P.byId[id] = s; if (P.lines[line]) P.lines[line].stations.push(s);
      return s;
    }
    const X = W.X;
    X.BURN = extra('L5-Burnin', 'Burn-in', 'burnin', 109, 40, 0, 0);
    X.QC = extra('L5-QC', 'Final QC', 'qc', 112, 58.5, 11, 1, 'L5', { manual: true });
    X.PACK = extra('L5-Packing', 'Packing', 'packer', 100, 58.5, 10, 1, 'L5', { manual: true });
    X.PAL = extra('L5-Palletizer', 'Palletizer', 'palletizer', 88, 58.5, 6, 1);
    X.SMTREP = extra('SMT-Repair', 'SMT repair bench', 'repair', 79, 22.5, 300, 1, 'SUP', { manual: true, mtbf: 9e9 });
    X.REWORK = extra('REWORK', 'Rework bench', 'repair', 94, 49.5, 240, 2, 'SUP', { manual: true, mtbf: 9e9 });
    const { BURN, QC, PACK, PAL, SMTREP, REWORK } = X;
    BURN.idx = 0; QC.idx = 1; PACK.idx = 2; PAL.idx = 3;

    // burn-in rack slots: three TV rows (12 each) and two phone rows (24 each)
    BURN.rack = [];
    for (let r = 0; r < 3; r++) for (let i = 0; i < 12; i++) BURN.rack.push({ kind: 'tv', x: 101 + i * 1.45, z: 32 + r * 3.4, u: null, row: r });
    for (let r = 0; r < 2; r++) for (let i = 0; i < 24; i++) BURN.rack.push({ kind: 'phone', x: 101 + i * 0.72, z: 43.5 + r * 2.6, u: null, row: 3 + r });
    BURN.slots = BURN.rack.length;

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
    const L3s = P.lines.L3.stations, L4s = P.lines.L4.stations;
    W.G.tvOut = seg(L3s[L3s.length - 1], BURN, [exitPt(L3s[L3s.length - 1]), [92, 34], [92, 38.5], [98.5, 38.5]], 0.6, 1.5);
    W.G.phOut = seg(L4s[L4s.length - 1], BURN, [exitPt(L4s[L4s.length - 1]), [92, 45], [92, 41.5], [98.5, 41.5]], 0.6, 0.6);
    const burnOut = W.G.burnOut = seg(BURN, QC, [[119.5, 49.5], [119.5, 58.5], [QC.x + QC.w / 2, 58.5]], 0.5, 0.9);
    W.G.qcOut = seg(QC, PACK, [[QC.x - QC.w / 2, 58.5], [PACK.x + PACK.w / 2, 58.5]], 0.45, 0.9);
    W.G.packOut = seg(PACK, PAL, [[PACK.x - PACK.w / 2, 58.5], [PAL.x + PAL.w / 2, 58.5]], 0.45, 0.8);
    void burnOut;
    // these segments run east → west, so their entry/exit are mirrored
    QC.flip = PACK.flip = PAL.flip = true;

    /* ----- materials: line-side stock and the warehouse ----- */
    const st = (line, name) => P.byId[`${line}-${name.replace(/\W+/g, '')}`];
    const lotId = () => `PL-${2200 + Math.floor(rnd(0, 6))}${pad(Math.floor(rnd(0, 99)), 2)}`;
    const RM = W.RM;
    Object.assign(RM, {
      pcbMain: buf('RM:pcbMain', { label: 'Bare PCBs · main', qty: 1800, cap: 2400, unit: 'pcs' }),
      pcbPower: buf('RM:pcbPower', { label: 'Bare PCBs · power', qty: 900, cap: 1600, unit: 'pcs' }),
      reel: buf('RM:reel', { label: 'Component reels', qty: 420, cap: 600, unit: 'reels' }),
      panel: buf('RM:panel', { label: 'TV panels', qty: 0, cap: 640, unit: 'pcs', lots: [] }),
      cover: buf('RM:cover', { label: 'TV back covers', qty: 560, cap: 900, unit: 'pcs' }),
      housing: buf('RM:housing', { label: 'Phone housings', qty: 1500, cap: 2400, unit: 'pcs' }),
      display: buf('RM:display', { label: 'Phone displays', qty: 1400, cap: 2400, unit: 'pcs' }),
      carton: buf('RM:carton', { label: 'Cartons', qty: 1200, cap: 2000, unit: 'pcs' })
    });
    for (let i = 0; i < 2; i++) { const id = lotId(); RM.panel.lots.push({ id, qty: 140, supplier: pick(['Supplier A', 'Supplier B']) }); RM.panel.qty += 140; }
    Object.values(RM).forEach(b => { b.rm = true; });

    const LS = W.LS;
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
    const SM = W.SM;
    SM.main = buf('SM:main', { label: 'Main boards', items: P.sm.main, cap: 160, unit: 'boards', sm: true });
    SM.power = buf('SM:power', { label: 'Power boards', items: P.sm.power, cap: 120, unit: 'boards', sm: true });

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

    // people at their stations
    PEOPLE.forEach(([name, role, at], i) => {
      const p = { id: 'P' + (i + 1), name, role, at, x: 0, z: 0, h: 0, path: null, s: 0, len: 0, busy: null, state: 'working', home: null };
      P.people.push(p);
      const s = P.byId[at];
      if (s) { s.operator = p; p.x = s.x; p.z = s.z + s.d / 2 + 0.8; p.h = -Math.PI / 2; }
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
    const STOPS = W.STOPS;
    function stop(key, x, z) {
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
      const z = s.line === 'L1' ? s.z + s.d / 2 + 0.9 : s.line === 'L2' ? s.z - s.d / 2 - 0.9 : s.line === 'L3' ? s.z - s.d / 2 - 1.1 : s.line === 'L4' ? s.z - s.d / 2 - 1.1 : 54.6;
      stop(b.id, s.x + (b.mat === 'power' ? 0.9 : b.mat === 'main' && s.line === 'L3' ? -0.9 : 0), z);
      b.node = b.id;
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

    /* ----- AGVs ----- */
    for (let i = 0; i < 6; i++) {
      const home = STOPS['PARK' + (i + 1)];
      const n = nodes[home.node];
      P.agvs.push({ id: `AGV-0${i + 1}`, x: n.x, z: n.z, h: 0, node: n.id, path: null, s: 0, len: 0, v: 0, battery: rnd(48, 96), mission: null, phase: 'idle',
        load: null, state: 'idle', km: rnd(4, 18), fault: null, home: home.node, waitT: 0, idleT: 0, target: null });
    }

    /* ----- finished goods, docks, forklifts ----- */
    for (let r = 0; r < 4; r++) for (let i = 0; i < 12; i++) P.fgSlots.push({ x: 36 + i * 2.6, z: 62 + r * 4, p: null, row: r });
    W.DOCKS.push({ id: 'Dock 1', x: 40, z: 80, truck: null }, { id: 'Dock 2', x: 52, z: 80, truck: null }, { id: 'Dock 3', x: 64, z: 80, truck: null });
    P.docks = W.DOCKS;
    for (let i = 0; i < 2; i++) P.forklifts.push({ id: `FL-${i + 1}`, x: 70 - i * 6, z: 58, h: Math.PI, path: null, s: 0, len: 0, v: 0, job: null, load: null, state: 'idle', lift: 0, wait: 0, driver: P.people.find(p => p.at === `FL-${i + 1}`) });

    /* ----- orders, inbound trucks ----- */
    ORDERS.forEach(([id, customer, product, qty, due]) => P.orders.push({ id, customer, product, qty, due, shipped: 0, state: 'open', truck: null, risk: 0, eta: null, prio: 0, split: false }));
    P.inbound = [
      { id: 'IN-881', mat: 'panel', qty: 240, at: START + 40 * 60, door: 0, state: 'due', k: 0 },
      { id: 'IN-882', mat: 'mix', qty: 0, at: START + 25 * 60, door: 1, state: 'due', k: 0 },
      { id: 'IN-883', mat: 'panel', qty: 240, at: START + 2.4 * 3600, door: 0, state: 'due', k: 0 },
      { id: 'IN-884', mat: 'mix', qty: 0, at: START + 2.1 * 3600, door: 1, state: 'due', k: 0 }
    ];

    /* ----- utilities ----- */
    P.util = { kw: 0, ambient: 31, heat: 0, assets: [
      { id: 'UTIL-TX', name: 'Transformer T1', x: 104, z: 8, kind: 'transformer', kw: 0, on: true },
      { id: 'UTIL-AIR1', name: 'Compressor 1', x: 110, z: 8, kind: 'compressor', kw: 0, on: true },
      { id: 'UTIL-AIR2', name: 'Compressor 2', x: 114.5, z: 8, kind: 'compressor', kw: 0, on: false, forced: 0, defer: 0 },
      { id: 'UTIL-CH1', name: 'Chiller 1', x: 120, z: 9, kind: 'chiller', kw: 0, on: true },
      { id: 'UTIL-CH2', name: 'Chiller 2', x: 120, z: 15.5, kind: 'chiller', kw: 0, on: false, forced: 0, defer: 0 }
    ] };

    P.layout = {
      AISLES, STOPS, DOCKS: W.DOCKS,
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
    return W;
  }

  /* ---------------- behaviour, bound to one world ---------------- */
  function bind(W) {
    const P = W.P, LS = W.LS, RM = W.RM, SM = W.SM, STOPS = W.STOPS, DOCKS = W.DOCKS, missions = W.missions, timers = W.timers;
    const { BURN, QC, PACK, PAL, SMTREP, REWORK } = W.X;
    const { tvOut, phOut, burnOut, qcOut, packOut } = W.G;
    const nodes = P.nodes;
    const R = () => next(W.rng);
    const rnd = (a, b) => a + R() * (b - a);
    const pick = arr => arr[Math.floor(R() * arr.length)];
    const listeners = [];
    const emit = (type, data) => { for (const fn of listeners) fn(type, data); };
    const st = (line, name) => P.byId[`${line}-${name.replace(/\W+/g, '')}`];
    const lineName = id => (P.lines[id] ? P.lines[id].name : id === 'SUP' ? 'Support' : 'Plant');
    void tvOut; void phOut; void qcOut; void packOut;

    /* ----- events, audit, alarms ----- */
    function log(src, msg, level = 'info', ref) {
      const e = { id: ++P.seq, t: P.t, time: clock(P.t), src, msg, level, ref };
      P.events.unshift(e); if (P.events.length > 200) P.events.pop();
      emit('event', e);
      return e;
    }
    function audit(who, action, detail, extra) {
      const a = Object.assign({ id: ++P.seq, t: P.t, time: clock(P.t), who, action, detail }, extra);
      P.audit.unshift(a); if (P.audit.length > 120) P.audit.pop();
      emit('audit', a);
      return a;
    }
    function alarm(key, on, o) {
      const map = W.alarmMap, a = map.get(key);
      if (on && !a) {
        const n = Object.assign({ key, id: ++P.seq, t: P.t, time: clock(P.t), state: 'active', prio: 3, shelvedTo: 0, tag: key }, o);
        map.set(key, n); P.alarms.unshift(n);
        const S = P.alarmStats; S.raised++; S.recent.push(P.t);
        log(n.area || 'PLC', n.msg, n.prio <= 1 ? 'crit' : n.prio === 2 ? 'warn' : 'info', n.ref);
        emit('alarms');
      } else if (!on && a) {
        map.delete(key); P.alarms = P.alarms.filter(x => x !== a);
        emit('alarms');
      } else if (on && a && o && o.msg && a.msg !== o.msg) a.msg = o.msg;
    }
    function alarmStats() {
      const S = P.alarmStats;
      while (S.recent.length && P.t - S.recent[0] > 600) S.recent.shift();
      S.rate10 = S.recent.length; S.peak10 = Math.max(S.peak10, S.rate10);
      const flood = S.rate10 > 10;
      if (flood && !S.flood) { S.floods++; S.floodFrom = P.t; log('Alarms', `Alarm flood: ${S.rate10} alarms in 10 minutes (ISA-18.2 limit 10)`, 'warn'); }
      S.flood = flood;
    }

    /* ----- data timers (plain data so they clone with the world) ----- */
    function later(sec, kind, arg) { timers.push({ at: P.t + sec, kind, arg }); }
    const TIMER = {
      agvReassign({ agv }) {
        const a = P.agvs.find(x => x.id === agv); if (!a) return;
        const m = a.mission;
        if (m && a.phase === 'toPick') { m.agv = null; a.mission = null; log('AGV', `Mission for ${m.buf.label.toLowerCase()} at ${P.byId[m.buf.station].name} released from ${a.id} back to dispatch`); dispatch(); }
      },
      agvRecover({ agv }) {
        const a = P.agvs.find(x => x.id === agv); if (!a) return;
        a.fault = null;
        if (a.load && !a.mission) { const src = P.bufs[a.loadSrc]; if (src) { if (src.items) src.items.push(...(a.load.items || [])); else src.qty += a.load.qty; } a.load = null; }
        if (!a.path && !a.mission) { a.phase = 'toCharge'; drive(a, a.home); }
        log('AGV', `${a.id} recovered and back in service`);
      },
      restart({ line, last }) {
        const L = P.lines[line]; if (!L) return;
        L.tripped = false; log('EMS', `${L.name} restarted`, 'info', L.stations[0].id);
        if (last) { alarm('GRID.DIP', false); P.scen.power = null; }
      },
      fetchDone({ buf, who }) {
        const b = P.bufs[buf]; if (!b) return;
        const n = Math.round(b.batch * 0.5);
        if (b.lots) { const src = RM.panel.lots[0]; if (src) { const k = Math.min(n, src.qty); src.qty -= k; RM.panel.qty -= k; b.lots.push({ id: src.id, qty: k }); b.qty += k; } }
        else if (!b.items) { b.qty = Math.min(b.cap, b.qty + n); if (P.bufs[b.src]) P.bufs[b.src].qty -= n; }
        const s = P.byId[b.station]; if (s) s.speedMul = s.fetchMul || 1;
        log('MES', `${who} brought ${n} ${b.label.toLowerCase()} to ${s ? s.name : b.label} by hand`, 'info', b.station);
      },
      stopEnd({ line }) {
        const L = P.lines[line]; if (!L) return;
        L.stopped = false; if (line === 'L2' && P.scen.reflow) P.scen.reflow.fixed = true;
        log('MES', `${L.name} restarted after inspection`, 'info', L.stations[0].id);
      },
      cmd({ cmd }) { exec(cmd); },
      safetyClear({ station }) {
        const s = P.byId[station]; if (!s) return;
        s.intrusion = null; s.safe = false; s.speedMul = s.preSafeMul || 1;
        alarm(`${s.id}.CELL`, false);
        log('Safety', `${s.name}: cell clear · robot back to full speed`, 'info', s.id);
        const p = P.people.find(x => x.name === 'Omar Nabil'); if (p && p.intruding) { p.intruding = false; const o = P.byId[p.at]; if (o) { p.x = o.x; p.z = o.z + o.d / 2 + 0.8; } }
      },
      safetyHazard({ station }) {
        const s = P.byId[station]; if (!s || !s.intrusion || s.safe) return;
        // nobody slowed the robot: the light curtain trips it hard and the near-miss is logged
        W.stats.nearMiss++; fail(s, 'Safety stop · light curtain', 300);
        log('Safety', `${s.name}: light curtain tripped with a person in the cell · near miss`, 'crit', s.id);
      },
      forcedOff({ id }) { const u = P.util.assets.find(x => x.id === id); if (u) { u.forced = 0; } },
      heatEnd() { if (P.util.heatTarget) P.util.heatTarget = 0; }
    };

    /* ----- units and genealogy ----- */
    const SNP = { main: 'MB', power: 'PB', tv: 'TV', phone: 'PH' };
    function unit(type, extra) {
      const u = Object.assign({ id: ++P.seq, sn: `${SNP[type]}26-${pad(++W.c.sn, 6)}`, type, born: P.t, steps: [], parts: {}, defect: null, loc: null }, extra);
      P.units.add(u);
      return u;
    }
    function archive(u) {
      P.units.delete(u);
      P.archive.set(u.sn, u); P.archiveOrder.push(u.sn);
      if (P.archiveOrder.length > 2000) P.archive.delete(P.archiveOrder.shift());
    }
    function stepRec(u, s, extra) {
      const r = Object.assign({ st: s.id, name: s.name, line: s.line, t0: P.t, t1: null }, extra);
      u.steps.push(r); return r;
    }
    function findUnit(sn) {
      sn = String(sn).trim().toUpperCase();
      for (const u of P.units) if (u.sn === sn) return u;
      if (P.archive.has(sn)) return P.archive.get(sn);
      for (const u of P.units) for (const k in u.parts) if (u.parts[k] && u.parts[k].sn === sn) return u.parts[k];
      for (const u of P.archive.values()) for (const k in u.parts) if (u.parts[k] && u.parts[k].sn === sn) return u.parts[k];
      return null;
    }

    /* ----- buffers ----- */
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
    const lotId = () => `PL-${2200 + Math.floor(rnd(0, 6))}${pad(Math.floor(rnd(0, 99)), 2)}`;

    /* ----- routing ----- */
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
    function runway(b) { return b.rate > 1e-4 ? level(b) / b.rate : Infinity; }
    function createMission(b, prio, reason) {
      if (b.mission) return b.mission;
      const src = P.bufs[b.src];
      const m = { id: 'M' + (++P.seq), buf: b, src, qty: b.batch, prio: prio || 1, reason: reason || 'Kanban', created: P.t, agv: null, eta: null, watched: false };
      missions.push(m); b.mission = m; b.pending = b.batch;
      return m;
    }
    function dispatch() {
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
        let blocked = false;
        a.idleT = 0;
        for (const o of P.agvs) if (o !== a && o.path && !o.fault && Math.hypot(o.x - a.x, o.z - a.z) < 1.8) {
          const ahead = (o.x - a.x) * Math.cos(a.h) + (o.z - a.z) * Math.sin(a.h) > 0.4;
          if (ahead && o.v < a.v + 0.05 && o.id > a.id) blocked = true;
        }
        if (P.scen.agvNext && a.load && a.s > 8) { faultAgv(a); return; }
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
        if (m.prio > 1 || m.watched) log('AGV', `${a.id} delivered ${L.qty} ${b.label.toLowerCase()} to ${P.byId[b.station].name} (${lineName(b.line)})`, 'info', b.station);
        if (a.battery < 30) { a.phase = 'toCharge'; drive(a, a.home); }
      } else if (a.phase === 'toCharge') { a.phase = a.battery < 70 ? 'charging' : 'idle'; }
    }
    function faultAgv(a) {
      delete P.scen.agvNext;
      a.fault = 'Drive motor overcurrent'; a.v = 0;
      log('AGV', `${a.id} stopped on the aisle · drive motor overcurrent`, 'crit', a.id);
      later(420, 'agvRecover', { agv: a.id });
    }

    /* ----- forklifts: palletizer → finished goods → trucks ----- */
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
      f.lift = ema(f.lift, f.load ? 1 : 0, Math.min(1, dt * 1.5));
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
        // next job: a truck at a dock waiting for pallets beats storing a new pallet; priority orders first
        const trs = P.trucks.filter(t => t.state === 'loading' && t.need > t.claimed && P.pallets.some(p => p.where === 'fg' && p.product === t.product && !p.claimed))
          .sort((a, b) => (b.order.prio - a.order.prio) || (a.order.due - b.order.due));
        const tr = trs[0];
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
    function truckArrive(o) {
      const dock = DOCKS.find(d => !d.truck);
      if (!dock) return false;
      const tr = { id: 'TRK-' + (310 + (++W.c.truck)), order: o, product: o.product, need: o.qty - o.shipped, loaded: 0, claimed: 0, pallets: [], dock, state: 'arriving', k: 0, arrived: P.t };
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
      W.stats.shipped += tr.loaded;
      if (late) { W.stats.lateOrders++; W.stats.lateSec += P.t - o.due; }
      log('Dock', `${tr.id} left ${tr.dock.id} · ${o.id} ${o.state === 'shipped' ? 'shipped on time' : o.state === 'late' ? `shipped ${mins(P.t - o.due)} late` : 'part-shipped'} · ${tr.loaded} units`, late ? 'warn' : 'info');
      emit('order', o);
    }
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
    const CUSTOMERS = { tv: ['Domestic retail', 'Export · Gulf', 'Export · East Africa', 'Export · Europe', 'Hotel project'], phone: ['Domestic retail', 'E-commerce hub', 'Export · Gulf', 'Operator channel', 'Export · North Africa'] };
    function replenish() {
      for (const prod of ['tv', 'phone']) {
        const open = P.orders.filter(o => o.product === prod && (o.state === 'open' || o.state === 'loading'));
        if (open.length >= 2) continue;
        const last = P.orders.filter(o => o.product === prod).reduce((m, o) => Math.max(m, o.due), P.t);
        const qty = prod === 'tv' ? 8 * Math.round(rnd(9, 12)) : 40 * Math.round(rnd(3, 5));
        const due = Math.max(last, P.t + 90 * 60) + Math.round(rnd(55, 80)) * 60;
        const id = (R() < 0.5 ? 'SO-' : 'EX-') + (++W.c.ord);
        P.orders.push({ id, customer: pick(CUSTOMERS[prod]), product: prod, qty, due, shipped: 0, state: 'open', truck: null, risk: 0, eta: null, prio: 0, split: false });
        log('ERP', `New order ${id} · ${qty} ${prod === 'tv' ? 'TVs' : 'phones'} · due ${clock(due)}`);
      }
      P.orders = P.orders.filter(o => !(o.shippedAt && P.t - o.shippedAt > 7200 && o.state !== 'open' && o.state !== 'loading'));
      const due = mat => P.inbound.some(t => t.mat === mat && (t.state === 'due' || t.state === 'unloading'));
      if (RM.panel.qty < 300 && !due('panel')) { P.inbound.push({ id: 'IN-' + (++W.c.inb), mat: 'panel', qty: 240, at: P.t + 40 * 60, door: 0, state: 'due', k: 0 }); log('SCM', `Panel truck IN-${W.c.inb} booked · arrives ${clock(P.t + 40 * 60)}`); }
      const low = ['pcbMain', 'pcbPower', 'cover', 'housing', 'display', 'carton', 'reel'].some(k => RM[k].qty < RM[k].cap * 0.3);
      if (low && !due('mix')) { P.inbound.push({ id: 'IN-' + (++W.c.inb), mat: 'mix', qty: 0, at: P.t + 35 * 60, door: 1, state: 'due', k: 0 }); log('SCM', `Material truck IN-${W.c.inb} booked · arrives ${clock(P.t + 35 * 60)}`); }
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
      const insp = line && line.inspect && s.idx === 0 ? 1.18 : 1;
      return c * wear * s.speedMul * insp / sp * (1 + (R() - 0.2) * 0.14);
    }
    function stdCycle(s, u) {
      if (s === PACK) return u && u.type === 'tv' ? 20 : 7;
      if (s === QC) return u && u.type === 'tv' ? 14 : 7;
      if (s === PAL) return u && u.type === 'tv' ? 7 : 2.6;
      return s.base;
    }
    function setState(s, state, why) {
      if (s.state !== state || s.why !== why) { s.state = state; s.since = P.t; s.why = why || ''; }
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
    function handOff(s, u) {
      if (s.outSeg) {
        const sg = s.outSeg, last = sg.items[sg.items.length - 1];
        if (last && last.s < sg.pitch) return false;
        sg.items.push({ u, s: 0 }); u.loc = { k: 'seg', seg: sg };
        return true;
      }
      if (s.line === 'L1' || s.line === 'L2') {
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
      const line = P.lines[s.line];
      if (s.line === 'L1' || s.line === 'L2') return unit(line.prodOverride || line.product, { line: s.line, panelPos: P.seq % 2 });
      if (s.line === 'L3') return unit('tv', { line: 'L3', model: 'TV-55 UHD' });
      if (s.line === 'L4') return unit('phone', { line: 'L4', model: 'Phone X6' });
      return null;
    }
    function stationStep(s, dt) {
      const line = P.lines[s.line];
      if (s.state === 'down' || s.state === 'maint') {
        s.counters.down += dt; if (line && W.stats.downSec[s.line] !== undefined) W.stats.downSec[s.line] += dt;
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
      if ((line && (line.stopped || line.tripped)) || s.tripped) { setState(s, 'idle', line && line.tripped ? 'Tripped (power)' : 'Line stopped'); s.counters.idle += dt; if (line && W.stats.downSec[s.line] !== undefined && s.idx === 0) W.stats.downSec[s.line] += dt; return; }

      const smt = s.line === 'L1' || s.line === 'L2';
      if (s.procs.length && s.kind !== 'reflow' && R() < dt / (smt ? 2600 : s.manual ? 1500 : 1200)) {
        s.micro = smt ? rnd(12, 55) : rnd(20, 80); s.stops = (s.stops || 0) + 1;
        setState(s, 'micro', pick(s.kind === 'mounter' ? ['Pick error · nozzle retry', 'Feeder splice', 'Vision recognition retry'] : s.manual ? ['Operator waiting for help', 'Part fit issue'] : ['Jam at infeed', 'Sensor blocked', 'Vision retry']));
        return;
      }
      if (s.mtbf < 9e8 && s.procs.length && !s.degrade) {
        const hz = dt / s.mtbf * (s.health < 40 ? 30 : s.health < 60 ? 4 : 1);
        if (R() < hz) return fail(s, s.health < 40 ? 'Worn part failed' : pick(['Servo overload', 'Sensor fault', 'Jam cleared by operator', 'Vacuum loss']), s.health < 40 ? 2400 : rnd(240, 900));
      }
      if (s.degrade > 0) {
        s.health = Math.max(0, s.health - s.degrade * s.wearMul * dt);
        if (s.health <= 22) return fail(s, s.failWhy || 'Bearing seized', s.failRepair || 2100);
      }

      let busy = false;
      for (let i = s.procs.length - 1; i >= 0; i--) {
        const p = s.procs[i];
        if (p.left > 0) { p.left -= dt; busy = true; continue; }
        if (!p.done) { p.done = true; finishUnit(s, p.u, p); }
        if (p.reject) { s.procs.splice(i, 1); continue; }
        if (handOff(s, p.u)) { if (p.rec) p.rec.t1 = P.t; s.procs.splice(i, 1); s.counters.made++; s.counters.std += stdCycle(s, p.u); }
      }
      const blocked = s.procs.some(p => p.done && !p.reject);

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
          const c = cycleOf(s, u);
          s.procs.push({ u, left: c, tot: c, rec });
          if (s.lastStart) s.gapEma = s.gapEma ? ema(s.gapEma, (P.t - s.lastStart) * (s.slots > 1 ? s.slots : 1), 0.15) : (P.t - s.lastStart);
          s.lastStart = P.t;
          s.ctEma = s.ctEma ? ema(s.ctEma, c / (s.slots > 1 ? s.slots : 1), 0.2) : c;
          u.loc = { k: 'st', st: s };
          busy = true;
        }
      } else burnStep(s, dt);

      if (s === BURN) return;
      if (blocked && !busy) setState(s, 'blocked', 'Outfeed full');
      else if (busy) setState(s, s.safe ? 'warn' : s.health < 55 ? 'warn' : 'run', s.safe ? 'Safe speed (person in cell)' : s.health < 55 ? 'Running slow (wear)' : '');
      else if (starvedBy === 'kanban') setState(s, 'idle', 'Supermarket full (Kanban)');
      else if (starvedBy) { setState(s, 'starved', `Waiting for ${starvedBy.label.toLowerCase()}`); W.stats.starvedSec += dt; if (!starvedBy.dry) { starvedBy.dry = 1; W.stats.stockouts++; } }
      else setState(s, 'idle', 'Waiting for units');
      if (!starvedBy || starvedBy === 'kanban') for (const n of s.needs) n.b.dry = 0;
      const c = s.counters;
      if (s.state === 'run' || s.state === 'warn') c.run += dt; else if (s.state === 'blocked') c.blocked += dt; else if (s.state === 'starved') c.starved += dt; else c.idle += dt;
    }
    const AGE = { tv: 18 * 60, phone: 10 * 60 };
    function burnStep(s) {
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
      s.counters[n ? 'run' : 'idle'] += STEP;
    }

    // inspection outcomes and genealogy notes
    function pushLog(arr, rec, n) { arr.push(rec); if (arr.length > n) arr.shift(); }
    function finishUnit(s, u, p) {
      const rec = p.rec; rec.ok = true;
      const line = P.lines[s.line];
      const fast = line ? Math.max(0, line.speed - 1) : 0;
      if (s.kind === 'printer') { u.paste = s.sens.paste || 24.8; rec.note = `Paste ${u.paste.toFixed(1)} °C · squeegee ${s.sens.press ? s.sens.press.toFixed(1) : '5.4'} kg`; }
      if (s.kind === 'spi') { u.spi = s.sens.vol || 99; rec.note = `Paste volume ${u.spi.toFixed(0)}%`; }
      if (s.kind === 'mounter') { rec.note = `${s.name} · ${Math.round(rnd(380, 520))} parts placed`; u.mounter = s.id; u.vib = s.sens.vib; }
      if (s.kind === 'reflow') {
        u.peak = s.sens.peak || 245; u.z5 = s.sens.zones ? s.sens.zones[4] : 228; rec.note = `Peak ${u.peak.toFixed(1)} °C · TAL ${Math.round(rnd(58, 72))} s`;
        if (Math.abs(u.z5 - 228 + (line.profile || 0)) > 5) { W.stats.oos++; rec.note += ' · zone 5 outside window'; }
      }
      if (s.kind === 'aoi') {
        const drift = Math.max(0, (u.peak || 245) - 248) * 0.03 + Math.max(0, Math.abs((u.z5 || 228) - 228) - 2) * 0.014 + Math.max(0, Math.abs((u.spi || 100) - 100) - 8) * 0.01 + Math.max(0, (u.vib || 1.5) - 4.5) * 0.004;
        const pBad = 0.008 + drift + (s.line === 'L1' ? 0 : 0.004) + fast * 0.03;
        const bad = R() < pBad;
        let code = null;
        if (bad) {
          code = (u.peak || 0) > 249 || (u.z5 || 228) > 231 ? (R() < 0.8 ? 'Solder bridge' : 'Insufficient wetting') : (u.vib || 0) > 4.5 && R() < 0.5 ? 'Misplaced component' : pick(['Solder bridge', 'Missing component', 'Tombstone', 'Insufficient solder']);
          u.defect = { code, at: s.id, t: P.t };
          rec.ok = false; rec.note = `${code} · rejected to repair`; p.reject = true; s.counters.bad++; P.rejects.aoi++;
          u.loc = { k: 'repair', st: SMTREP }; P.rejects.smtRepair.push({ u, t: P.t }); W.stats.smtRepairs++;
        } else rec.note = 'Pass · 1,284 joints checked';
        pushLog(P.aoiLog[s.line], { t: P.t, sn: u.sn, ok: !bad, code, peak: u.peak, z5: u.z5, spi: u.spi, paste: u.paste, mounter: u.mounter, vib: u.vib }, 400);
      }
      if (s.kind === 'fct') {
        const lotBad = u.type === 'tv' && P.scen.lot && P.scen.lot.lot === u.lot && !P.scen.lot.quarantined;
        const pixel = lotBad && R() < 0.3;
        const bad = pixel || R() < 0.006 + ((u.parts.main && u.parts.main.repaired) ? 0.02 : 0) + fast * 0.02;
        if (bad) {
          u.defect = pixel ? { code: 'Dead pixel cluster', at: s.id, t: P.t } : { code: u.type === 'tv' ? 'No backlight' : 'No RF signal', at: s.id, t: P.t };
          rec.ok = false; rec.note = `${u.defect.code} · sent to rework`; p.reject = true; s.counters.bad++; P.rejects.fct++; toRework(u);
        } else rec.note = u.type === 'tv' ? 'HDMI, Wi-Fi, audio, power: pass' : 'RF, camera, audio, battery: pass';
        pushLog(P.testLog, { t: P.t, sn: u.sn, at: s.id, type: u.type, ok: !bad, code: bad ? u.defect.code : null, lot: u.lot || null, main: u.parts.main ? u.parts.main.sn : null }, 400);
      }
      if (s === QC) {
        const lotBad = u.type === 'tv' && P.scen.lot && P.scen.lot.lot === u.lot && !P.scen.lot.quarantined;
        const bad = R() < (lotBad ? 0.42 : 0.004);
        if (bad) {
          u.defect = { code: u.type === 'tv' ? 'Dead pixel cluster' : 'Display mura', at: s.id, t: P.t };
          rec.ok = false; rec.note = `${u.defect.code} · sent to rework`; p.reject = true; s.counters.bad++; P.rejects.qc++; toRework(u);
        } else rec.note = u.type === 'tv' ? 'Camera check: uniformity, colour, dead pixels: pass' : 'Camera check: display, cosmetics: pass';
        pushLog(P.testLog, { t: P.t, sn: u.sn, at: s.id, type: u.type, ok: !bad, code: bad ? u.defect.code : null, lot: u.lot || null, main: u.parts.main ? u.parts.main.sn : null }, 400);
      }
      if (s.kind === 'bench' || s.kind === 'robot' || s.kind === 'bond') {
        if (s.name === 'Board fit') rec.note = u.type === 'tv' ? `Main ${u.parts.main.sn} · power ${u.parts.power.sn}` : `Main board ${u.parts.main.sn}`;
        if (s.name === 'Panel load') {
          rec.note = `Panel lot ${u.lot}`;
          // 100% incoming inspection of a suspect lot catches most bad panels before they are built in
          if (line.inspect && P.scen.lot && P.scen.lot.lot === u.lot && R() < 0.85 * 0.3) {
            const nl = RM.panel.lots.find(l => l.id !== u.lot) || LS.L3panel.lots.find(l => l.id !== u.lot);
            rec.note = `Panel lot ${u.lot} · inspection found dead pixels · swapped for ${nl ? nl.id : 'a good panel'}`;
            if (nl) u.lot = nl.id;
            W.stats.scrap++; W.stats.scrapCost += 900;
          }
        }
        if (s.name === 'Screw robot') rec.note = `${u.type === 'tv' ? 12 : 6} screws · torque ${rnd(0.42, 0.48).toFixed(2)} N·m`;
        if (s.name === 'Display bond') rec.note = `Bond line ${rnd(0.18, 0.22).toFixed(2)} mm · cure 8 s`;
        if (s.operator) rec.by = s.operator.name;
      }
      if (s === PACK) { u.packed = P.t; P.leads.push(P.t - u.born); if (P.leads.length > 40) P.leads.shift(); rec.note = u.type === 'tv' ? 'Carton, foam, manual, remote' : 'Gift box, charger, manual'; if (u.type === 'tv') P.made.packedTv++; else P.made.packedPhone++; }
      if (s.operator && !rec.by) rec.by = s.operator.name;
    }
    function toRework(u) { u.loc = { k: 'repair', st: REWORK }; P.rejects.rework.push({ u, t: P.t }); W.stats.rework++; }
    function repairsStep() {
      const sm = P.rejects.smtRepair;
      if (sm.length && P.t - sm[0].t > 360) {
        const { u } = sm.shift();
        const ok = R() < 0.82;
        u.steps.push({ st: SMTREP.id, name: 'SMT repair', line: 'SMT', t0: P.t - 120, t1: P.t, ok, note: ok ? `Repaired: ${u.defect.code.toLowerCase()} · re-inspected` : 'Not repairable · scrapped' });
        if (ok) { u.repaired = true; const lane = u.type === 'main' ? SM.main : SM.power; lane.items.push(u); u.loc = { k: 'sm', lane: u.type }; }
        else { u.scrap = true; u.loc = null; W.stats.scrap++; W.stats.scrapCost += COST.scrap[u.type] || 500; archive(u); }
      }
      const rw = P.rejects.rework;
      if (rw.length && P.t - rw[0].t > 280) {
        const sg = burnOut, last = sg.items[sg.items.length - 1];
        if (!last || last.s >= sg.pitch) {
          const { u } = rw.shift();
          const panel = u.defect && u.defect.code === 'Dead pixel cluster';
          u.steps.push({ st: REWORK.id, name: 'Rework', line: 'L5', t0: P.t - 240, t1: P.t, ok: true, by: 'Laila Mostafa', note: panel ? 'Panel replaced from a good lot' : 'Reseated connector · retest' });
          if (panel) { u.lot = (LS.L3panel.lots.find(l => !P.scen.lot || l.id !== P.scen.lot.lot) || { id: 'PL-220100' }).id; W.stats.scrapCost += 900; }
          W.stats.extraCost += COST.rework;
          u.reworked = true; u.defect = null;
          sg.items.push({ u, s: sg.len * 0.55 }); sg.items.sort((a, b) => b.s - a.s); u.loc = { k: 'seg', seg: sg };
        }
      }
      SMTREP.load = sm.length; REWORK.load = rw.length;
      SMTREP.state = sm.length ? 'run' : 'idle'; REWORK.state = rw.length ? 'run' : 'idle';
    }

    /* ----- pallets ----- */
    function palletize(u) {
      let p = P.pallets.find(x => x.where === 'build' && x.product === u.type);
      if (!p) {
        if (P.pallets.filter(y => y.where === 'pickup').length >= 4) return false;
        p = { id: 'PAL-' + (++W.c.pal), product: u.type, units: [], where: 'build', x: PAL.x - 3.6, z: 58.5 + (u.type === 'tv' ? -1.6 : 1.6), cap: u.type === 'tv' ? 8 : 40, built: null, claimed: false };
        P.pallets.push(p);
      }
      p.units.push(u); u.pallet = p.id; u.loc = { k: 'pallet', p };
      const rec = u.steps[u.steps.length - 1]; rec.note = `${p.id} · position ${p.units.length} of ${p.cap}`;
      if (p.units.length >= p.cap) {
        p.where = 'pickup'; p.built = P.t;
        const used = P.pallets.filter(x => x !== p && x.where === 'pickup').map(x => x.x);
        p.x = [74.2, 71.8, 69.4, 76.6].find(x => !used.some(v => Math.abs(v - x) < 0.5)) || 74.2; p.z = 61.7;
        log('Pack', `${p.id} complete · ${p.cap} ${p.product === 'tv' ? 'TVs' : 'phones'} · stretch-wrapped`);
      }
      return true;
    }

    /* ----- failures, maintenance, technicians ----- */
    function fail(s, why, repair) {
      if (s.state === 'down') return;
      s.procs.forEach(p => { p.left += 1; });
      setState(s, 'down', why); s.fault = { why, at: P.t, repair }; s.repair = repair; s.degrade = 0;
      W.stats.failures++; W.stats.repairCost += why.startsWith('Safety') ? 0 : repair > 1500 ? COST.unplannedRepair : COST.unplannedRepair * 0.3;
      alarm(`${s.id}.DOWN`, true, { prio: 1, area: lineName(s.line), msg: `${s.name} stopped · ${why}`, ref: s.id, tag: `${s.line}.${s.name.replace(/\W+/g, '').toUpperCase()}.DOWN` });
      emit('fault', s);
      sendTech(s);
    }
    function sendTech(s) {
      const t = P.techs.find(x => x.state === 'available');
      if (!t) { s.tech = null; return; }
      t.state = 'walking'; t.job = s.id; s.tech = t;
      const a = nearestNode(t.x, t.z), b = nearestNode(s.x, s.z + s.d);
      t.path = route(a, b); t.path.unshift([t.x, t.z]); t.path.push([s.x + 0.6, s.z + s.d / 2 + 0.9]); t.len = polyLen(t.path); t.s = 0;
      log('CMMS', `${t.name} dispatched to ${s.name} (${lineName(s.line)})`, 'info', s.id);
    }
    function finishRepair(s) {
      const t = s.tech;
      const planned = s.state === 'maint';
      s.health = rnd(96, 99.5); s.fault = null; s.tech = null; s.failWhy = null; s.repairs = (s.repairs || 0) + 1; s.wearMul = 1; s.speedMul = s.baseMul || 1;
      setState(s, 'idle');
      alarm(`${s.id}.DOWN`, false); alarm(`${s.id}.VIB`, false); alarm(`${s.id}.VIBD`, false);
      for (const k of [...W.alarmMap.keys()]) if (k.startsWith(s.id + '.F')) alarm(k, false);
      log('CMMS', `${s.name} back in production after ${planned ? 'planned' : 'unplanned'} repair`, 'info', s.id);
      if (t) {
        t.state = 'returning'; t.job = null;
        const a = nearestNode(t.x, t.z); t.path = route(a, nearestNode(t.home[0], t.home[1])); t.path.unshift([t.x, t.z]); t.path.push(t.home); t.len = polyLen(t.path); t.s = 0;
      }
      if (s.onRepaired === 'planned') { s.onRepaired = null; s.planned = false; log('CMMS', `Planned repair on ${s.name} complete`, 'info', s.id); }
      emit('repaired', s);
    }
    function peopleStep(dt) {
      for (const t of P.techs) {
        if (t.path) {
          t.s = Math.min(t.len, t.s + 1.35 * dt);
          const p = polyAt(t.path, t.s); t.x = p[0]; t.z = p[1]; t.h = p[2];
          if (t.s >= t.len - 0.01) {
            t.path = null;
            if (t.state === 'walking') { t.state = 'repairing'; const s = P.byId[t.job]; if (s) log('CMMS', `${t.name} on site at ${s.name}`, 'info', s.id); }
            else if (t.state === 'returning') t.state = 'available';
          }
        }
        if (t.state === 'available') {
          const waiting = P.stations.find(s => (s.state === 'down' || s.state === 'maint') && !s.tech);
          if (waiting) sendTech(waiting);
        }
      }
    }

    /* ----- sensors ----- */
    function sensors(s) {
      const on = s.state === 'run' || s.state === 'warn';
      const wear = 100 - s.health;
      const S = s.sens;
      const n = (a) => (R() - 0.5) * a;
      const heat = P.util.heat || 0;
      if (s.kind === 'mounter') {
        S.vib = on ? 1.4 + wear * 0.055 + (wear > 40 ? wear * 0.02 : 0) + n(0.25) : 0.12 + n(0.04);
        S.vac = on ? -78 + wear * 0.06 + n(1.2) : -12;
        S.cph = on ? Math.round(52000 / (cycleOf(s) / s.base) * (0.97 + n(0.04))) : 0;
        S.temp = 38 + wear * 0.12 + (on ? 4 : 0) + heat * 0.3 + n(0.4);
      } else if (s.kind === 'reflow') {
        const hot = P.scen.reflow && P.scen.reflow.line === s.line && !P.scen.reflow.fixed ? P.scen.reflow.drift : 0;
        const amb = heat * 0.35 - (P.lines[s.line].profile || 0);
        const dip = P.lines[s.line].tripped ? -40 : 0;
        S.zones = [150, 170, 185, 200, 228 + hot, 248, 236, 140].map((z, i) => z + (i === 4 ? 0 : hot * 0.25) + amb + dip * (i < 7 ? 1 : 0.3) + n(1.2));
        S.peak = Math.max(...S.zones.slice(4, 7)) - 1.5 + n(0.6);
        S.o2 = 820 + n(60); S.conv = 0.82 + n(0.01);
        S.temp = S.peak;
      } else if (s.kind === 'printer') {
        S.press = 5.4 + n(0.12); S.paste = 24.6 + heat * 0.08 + n(0.3); S.temp = S.paste;
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
      const sp = P.lines[s.line] ? P.lines[s.line].speed : 1;
      s.kwNow = (s.state === 'run' || s.state === 'warn' ? K[0] * (0.7 + 0.3 * sp) : s.state === 'down' || s.state === 'maint' ? K[2] : K[1]) * (1 + n(0.04));
      if (s === BURN) { const tv = BURN.rack.filter(r => r.u && r.kind === 'tv').length; s.kwNow = K[1] + tv * 0.11 + ((s.load || 0) - tv) * 0.008; }
      // condition alarms from the vibration level (ISO 20816 style zones for this machine class)
      if (s.kind === 'mounter' && on) {
        const has = k => W.alarmMap.has(k);
        alarm(`${s.id}.VIB`, (S.vib > 4.5 || (has(`${s.id}.VIB`) && S.vib > 4.1)) && S.vib <= 7.1, { prio: 3, area: lineName(s.line), msg: `${s.name} vibration ${S.vib.toFixed(1)} mm/s · zone C`, ref: s.id, tag: `${s.line}.${s.name.replace(/\W+/g, '').toUpperCase()}.VIB` });
        alarm(`${s.id}.VIBD`, S.vib > 7.1 || (has(`${s.id}.VIBD`) && S.vib > 6.7), { prio: 2, area: lineName(s.line), msg: `${s.name} vibration ${S.vib.toFixed(1)} mm/s · zone D`, ref: s.id });
      }
    }
    function record(s) {
      const H = s.hist, S = s.sens;
      const push = (k, v) => { if (v === undefined || v === null || !isFinite(v)) return; (H[k] = H[k] || []).push(+v.toFixed(3)); if (H[k].length > HIST) H[k].shift(); };
      push('vib', S.vib); push('temp', S.temp); push('kw', s.kwNow); push('peak', S.peak); push('vac', S.vac); push('ct', s.ctEma);
      if (S.zones) push('z5', S.zones[4]);
      (H.t = H.t || []).push(Math.round(P.t)); if (H.t.length > HIST) H.t.shift();
    }

    /* ----- KPIs, OEE ----- */
    function tariffAt(t) {
      if (P.energy.peakOverride && t < P.energy.peakOverride) return TARIFF[2];
      const h = (t / 3600) % 24; return TARIFF.find(x => h >= x.from && h < x.to) || TARIFF[1];
    }
    function kpis() {
      const k = P.kpi;
      const tv = P.base.tv + P.made.packedTv, ph = P.base.phone + P.made.packedPhone;
      const el = (P.t - SHIFT_START) / 3600;
      const planTv = Math.round(95 * 0.82 * el), planPh = Math.round(164 * 0.82 * el);
      k.tv = tv; k.phone = ph; k.planTv = planTv; k.planPh = planPh; k.units = tv + ph; k.plan = planTv + planPh;
      const snap = {};
      for (const id in P.lines) {
        const L = P.lines[id];
        const b = id === 'L5' ? PACK : L.stations.reduce((m, s) => (s.kind === 'reflow' || s.kind === 'burnin' ? 0 : s.base) > m.base ? s : m, L.stations[0]);
        snap[id] = { run: b.counters.run, down: b.counters.down + b.counters.starved + b.counters.blocked, made: b.counters.made, std: b.counters.std, bad: L.stations.reduce((a, s) => a + s.counters.bad, 0), base: b.base };
      }
      W.win.push({ t: P.t, snap }); while (W.win.length && P.t - W.win[0].t > 1800) W.win.shift();
      const w0 = W.win[0];
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
        const starved = L.stations.some(s => s.state === 'starved');
        L.state = L.tripped ? 'tripped' : L.stopped ? 'stopped' : down ? 'down' : L.stations.some(s => s.state === 'changeover') ? 'changeover' : starved ? 'starved' : L.stations.some(s => s.state === 'warn' || s.state === 'micro') ? 'warn' : 'run';
      }
      if (rateW) k.oee = oeeW / rateW;
      const tested = P.stations.filter(s => s.kind === 'fct' || s === QC);
      const fctT = tested.reduce((a, s) => a + s.counters.made + s.counters.bad, 0), fctB = tested.reduce((a, s) => a + s.counters.bad, 0);
      k.fpy = fctT ? 1 - fctB / fctT : 0.99;
      const aoi = P.stations.filter(s => s.kind === 'aoi');
      const aT = aoi.reduce((a, s) => a + s.counters.made + s.counters.bad, 0), aB = aoi.reduce((a, s) => a + s.counters.bad, 0);
      k.aoiPpm = aT ? Math.round(aB / aT * 1e6) : 0;
      let wip = 0; for (const u of P.units) if (!u.packed && u.type !== 'main' && u.type !== 'power') wip++;
      k.wip = wip; k.boards = SM.main.items.length + SM.power.items.length; k.kw = P.stations.reduce((a, s) => a + s.kwNow, 0) + P.util.kw;
      k.agvBusy = P.agvs.filter(a => a.mission).length;
      const shipped = P.orders.filter(o => o.state === 'shipped' || o.state === 'late' || o.state === 'partial');
      k.otif = shipped.length ? shipped.filter(o => o.state === 'shipped').length / shipped.length : 1;
      k.alarms = P.alarms.length;
      k.lead = P.leads.length ? P.leads.reduce((a, b) => a + b, 0) / P.leads.length : 0;
      const rem = Math.max(0, (SHIFT_END - P.t) / 3600);
      const rate = (P.lines.L3.tph || 80) + (P.lines.L4.tph || 140);
      const risk = P.stations.filter(s => s.state === 'down' || s.degrade > 0).length;
      k.fcst = Math.round(k.units + rate * rem * (1 - 0.04 * risk));
      k.planEnd = Math.round((95 + 164) * 0.82 * (SHIFT_END - SHIFT_START) / 3600);
      k.prob = clamp(0.5 + (k.fcst - k.planEnd) / (k.planEnd * 0.06), 0.02, 0.98);
      k.kwhUnit = k.kw / Math.max(1, rate);
      const h = P.hist;
      h.t.push(P.t); h.kw.push(Math.round(k.kw)); h.tph.push(Math.round(rate)); h.oee.push(+(k.oee || 0.85).toFixed(3)); h.wip.push(k.wip); h.packed.push(k.units);
      for (const key in h) if (h[key].length > HIST) h[key].shift();
    }

    /* ----- utilities and energy ----- */
    function utilStep() {
      const pneu = P.stations.filter(s => (s.state === 'run' || s.state === 'warn') && /mounter|robot|packer|palletizer|printer/.test(s.kind)).length;
      const hour = (P.t / 3600) % 24;
      const U = P.util;
      U.heat = ema(U.heat || 0, U.heatTarget || 0, 0.004);
      const amb = 30 + 7 * Math.sin((hour - 9) / 24 * Math.PI * 2 + 0.6) + U.heat;
      U.ambient = amb;
      const A = U.assets;
      const c2need = pneu > 9 || A[2].forced > P.t;
      const ch2need = amb > 33 || A[4].forced > P.t;
      A[2].on = c2need && !(A[2].defer > P.t); A[4].on = ch2need && !(A[4].defer > P.t);
      // targets, then a soft start: motors and compressors ramp to their load over a few minutes
      const precool = U.precool && U.precool.until > P.t ? U.precool : null;
      const tgt = [0,
        52 + pneu * 3.1 + (A[2].on ? 0 : Math.max(0, pneu - 9) * 2.2) + (R() - 0.5) * 3,
        A[2].on ? (A[2].forced > P.t ? 96 : 38 + Math.max(0, pneu - 9) * 2.6) : 6,
        90 + (amb - 28) * 6 * (precool && P.t > U.precool.from + 1200 ? 0.78 : 1) + (precool && P.t < U.precool.from + 1200 ? 34 : 0) + (R() - 0.5) * 4,
        A[4].on ? (A[4].forced > P.t ? 138 : 60 + Math.max(0, amb - 33) * 8) : 16];
      for (let i = 0; i < A.length; i++) { A[i].target = tgt[i]; A[i].kw = A[i].kw ? A[i].kw + (tgt[i] - A[i].kw) * (tgt[i] > A[i].kw ? 0.012 : 0.08) : tgt[i]; }
      U.kw = A.reduce((a, x) => a + x.kw, 0) + 64;
      U.kwTarget = A.reduce((a, x) => a + x.target, 0) + 64;
      const tf = tariffAt(P.t);
      P.energy.tariff = tf.name; P.energy.price = tf.egp;
    }
    // demand is billed on 15-minute average intervals; a new maximum above the contract costs the demand charge
    function energyStep(dt) {
      const En = P.energy, kw = P.kpi.kw || 0;
      const kwh = kw * dt / 3600;
      En.kwh += kwh; En.cost += kwh * En.price;
      W.stats.kwh += kwh; W.stats.energyCost += kwh * En.price;
      if (kw > En.peak) En.peak = kw;
      const no = Math.floor(P.t / 900);
      if (no !== En.iNo) {
        if (En.iNo >= 0 && En.iSec > 0) {
          const avg = En.iKwh * 3600 / En.iSec;
          En.lastAvg = avg; En.avgHist.push(Math.round(avg)); if (En.avgHist.length > 40) En.avgHist.shift();
          const over = Math.max(0, avg - En.contract);
          if (over > En.over) { W.stats.demandCost += (over - En.over) * COST.demandKw; En.over = over; log('EMS', `15-min demand ${Math.round(avg)} kW · ${Math.round(over)} kW over the contract`, 'warn', 'UTIL-TX'); }
        }
        En.iNo = no; En.iKwh = 0; En.iSec = 0;
      }
      En.iKwh += kwh; En.iSec += dt;
      En.proj = (En.iKwh + kw * Math.max(0, 900 - En.iSec) / 3600) * 4;
      alarm('EMS.DEMAND', En.proj > En.contract * 0.98 || (W.alarmMap.has('EMS.DEMAND') && En.proj > En.contract * 0.95), { prio: 2, area: 'Utilities', msg: `15-min demand heading to ${Math.round(En.proj)} kW · contract ${En.contract} kW`, ref: 'UTIL-TX' });
    }

    /* ----- what the plant does next if nobody acts (simple physics projection; the agents run full what-ifs) ----- */
    function sense() {
      for (const b of Object.values(P.bufs)) {
        const used = b.used - (b._u || 0); b._u = b.used;
        b.rate = ema(b.rate, used / 2, 0.08);
      }
      for (const lane of ['main', 'power']) {
        const b = SM[lane];
        const demand = lane === 'main' ? (P.lines.L3.state !== 'down' ? 95 : 0) + (P.lines.L4.state !== 'down' ? 164 : 0) : 95;
        const lineSide = lane === 'main' ? LS.L3main.items.length + LS.L4main.items.length : LS.L3power.items.length;
        b.rw = (b.items.length + lineSide) / Math.max(1e-6, demand / 3600); b.lineSide = lineSide; b.demand = demand;
        alarm('SM.' + lane, b.items.length < 20 && b.rw < 900, { prio: 2, area: 'Supermarket', msg: `${b.label} supermarket low · ${b.items.length} boards`, ref: 'SM:' + lane });
      }
      // order readiness from the current rate (the agents replace this with simulated futures)
      for (const o of P.orders) {
        if (o.state !== 'open' && o.state !== 'loading') continue;
        const rate = (o.product === 'tv' ? P.lines.L3.tph : P.lines.L4.tph) || 1;
        const fg = P.pallets.filter(p => p.product === o.product && (p.where === 'fg' || p.where === 'pickup' || p.where === 'fork') && !p.truck).reduce((a, p) => a + p.units.length, 0);
        const earlier = P.orders.filter(x => x !== o && x.product === o.product && (x.state === 'open' || x.state === 'loading') && (x.prio > o.prio || (x.prio === o.prio && x.due < o.due))).reduce((a, x) => a + x.qty - x.shipped, 0);
        const need = Math.max(0, earlier + o.qty - o.shipped - (o.truck ? o.truck.loaded : 0) - fg);
        o.need = need; o.earlier = earlier;
        o.eta = P.t + need / rate * 3600 + 22 * 60; o.risk = o.eta > o.due ? (o.eta - o.due) : 0;
      }
      // alarms
      const aoi2 = P.byId['L2-AOI'];
      const recent = P.aoiLog.L2.filter(r => P.t - r.t < 900);
      const rate2 = recent.length ? recent.filter(r => !r.ok).length / recent.length : 0;
      alarm('L2-AOI.REJ', recent.length > 20 && rate2 > 0.035, { prio: 3, area: 'SMT Line 2', msg: `AOI reject rate ${(rate2 * 100).toFixed(1)}% · limit 3.5%`, ref: aoi2.id });
      const tests = P.testLog.filter(r => r.type === 'tv' && P.t - r.t < 1800);
      const tvFails = tests.filter(r => !r.ok).length;
      alarm('QC.TVFAIL', tvFails >= 3, { prio: 2, area: 'Final Assembly A', msg: `TV test failures ${tvFails} in 30 min · limit 3`, ref: 'L5-QC' });
      for (const a of P.agvs) alarm(a.id + '.FAULT', !!a.fault, { prio: 2, area: 'Logistics', msg: `${a.id} stopped · ${a.fault || ''}`, ref: a.id });
      for (const a of P.agvs) alarm(a.id + '.BATT', a.battery < 15 && !a.fault, { prio: 4, area: 'Logistics', msg: `${a.id} battery ${Math.round(a.battery)}%`, ref: a.id });
      for (const s of P.stations) {
        const long = P.t - s.since;
        alarm(`${s.id}.MS`, s.state === 'micro' && long > 60, { prio: 4, area: lineName(s.line), msg: `${s.name}: ${s.why.toLowerCase()}`, ref: s.id });
        alarm(`${s.id}.STV`, s.state === 'starved' && long > 45, { prio: 3, area: lineName(s.line), msg: `${s.name}: ${s.why.toLowerCase()}`, ref: s.id });
        alarm(`${s.id}.BLK`, s.state === 'blocked' && long > 300 && s.idx > 0, { prio: 4, area: lineName(s.line), msg: `${s.name}: outfeed blocked`, ref: s.id });
      }
      alarmStats();
      // a short projection for the plant panel
      P.preds = [];
      for (const b of Object.values(LS)) {
        const rw = runway(b), m = b.mission;
        const ok = (m && m.agv && !m.agv.fault && (!m.eta || m.eta - P.t < rw)) || (!m && level(b) > b.rop);
        if (rw < 900 && !ok) P.preds.push({ key: b.id, ref: 'buf:' + b.id, text: `${P.byId[b.station].name} runs out of ${b.label.toLowerCase()}`, sub: `${lineName(P.byId[b.station].line)} · ${m ? (m.agv ? m.agv.id + ' late' : 'waiting for an AGV') : 'no delivery planned'}`, eta: rw });
      }
      for (const lane of ['main', 'power']) {
        const feeders = ['L1', 'L2'].filter(id => (P.lines[id].prodOverride || P.lines[id].product) === lane);
        const fed = feeders.some(id => P.lines[id].state === 'run' || P.lines[id].state === 'warn');
        if (!fed && SM[lane].rw < 3600) P.preds.push({ key: 'SM:' + lane, ref: 'buf:SM:' + lane, text: `${SM[lane].label} run out for assembly`, sub: `Board supermarket · ${feeders.map(id => P.lines[id].name).join(', ')} not feeding`, eta: SM[lane].rw });
      }
      for (const o of P.orders) if ((o.state === 'open' || o.state === 'loading') && o.risk > 120 && o.due - P.t < 3.5 * 3600) P.preds.push({ key: 'ORD:' + o.id, ref: 'order:' + o.id, text: `Order ${o.id} ships late`, sub: `${o.customer} · due ${clock(o.due)}, ready ${clock(o.eta)}`, eta: Math.max(0, o.due - P.t), late: true });
      const panelCover = (RM.panel.qty + level(LS.L3panel)) / (95 / 3600);
      const nextPanels = P.inbound.find(t => t.mat === 'panel' && t.state === 'due');
      P.panelCover = panelCover;
      if (panelCover < 3 * 3600 && (!nextPanels || nextPanels.at - P.t > panelCover)) P.preds.push({ key: 'RM:panel', ref: 'buf:RM:panel', text: 'TV panels run out', sub: `Raw-material warehouse · next truck ${nextPanels ? clock(nextPanels.at) : 'not booked'}`, eta: panelCover });
      P.preds.sort((a, b) => a.eta - b.eta);
      emit('sense');
    }

    /* ----- actions: everything that changes the plant from outside goes through exec ----- */
    const ACTIONS = {
      expedite(arg, who) {
        const b = P.bufs[arg]; if (!b) return false;
        if (!b.mission) createMission(b, 3, 'Expedited');
        const m = b.mission;
        if (m.agv && m.agv.fault) { const dead = m.agv; dead.mission = null; dead.phase = 'idle'; dead.path = null; m.agv = null; }
        m.prio = 3; m.watched = true;
        if (!m.agv) {
          const a = P.agvs.filter(x => !x.fault && x.mission && x.phase === 'toPick' && x.mission !== m).sort((x, y) => runway(y.mission.buf) - runway(x.mission.buf))[0];
          const free = P.agvs.some(x => !x.mission && !x.fault && x.battery > 22);
          if (a && !free) { const old = a.mission; old.agv = null; a.mission = null; assign(a, m); log('AGV', `${a.id} re-assigned from ${old.buf.label.toLowerCase()} to ${b.label.toLowerCase()} for ${P.byId[b.station].name}`); }
          else dispatch();
        }
        audit(who, 'Expedited delivery', `${b.label} to ${P.byId[b.station].name}`);
        return true;
      },
      manualFetch(arg, who) {
        const b = P.bufs[arg]; if (!b) return false;
        const s = P.byId[b.station]; if (s) { s.fetchMul = s.speedMul; s.speedMul = s.speedMul * 1.6; }
        later(360, 'fetchDone', { buf: b.id, who: s && s.operator ? s.operator.name : 'The line leader' });
        audit(who, 'Fetch by hand', `${b.label} to ${s ? s.name : ''} · operator away 6 min`);
        return true;
      },
      planRepair(arg, who) {
        const s = P.byId[arg]; if (!s || s.state === 'down') return false;
        s.planned = true; s.degrade = 0;
        audit(who, 'Planned repair', `${s.name} bearing change now (8 min) instead of failure`);
        log('CMMS', `Work order WO-${++W.c.wo} approved · ${s.name} bearing change`, 'info', s.id);
        setState(s, 'maint', 'Planned bearing change'); s.repair = 480; s.procs.forEach(p => { p.left += 1; });
        alarm(`${s.id}.VIB`, false); alarm(`${s.id}.VIBD`, false);
        W.stats.repairCost += COST.plannedRepair;
        s.onRepaired = 'planned';
        sendTech(s);
        return true;
      },
      derate(arg, who) {
        const s = P.byId[arg]; if (!s) return false;
        s.wearMul = 0.45; s.baseMul = s.speedMul; s.speedMul = s.speedMul / 0.85;
        audit(who, 'Derated machine', `${s.name} to 85% speed · wear slowed`);
        log('MES', `${s.name} derated to 85% speed`, 'info', s.id);
        return true;
      },
      switchL2(arg, who) {
        const l2 = P.lines.L2; if (l2.prodOverride === 'main') return false;
        l2.prodOverride = 'main';
        audit(who, 'Product changeover', 'SMT Line 2 → main boards');
        log('MES', 'SMT Line 2 changeover to main boards started (4 min)', 'info', 'L2-Loader');
        l2.stations.forEach(s => { setState(s, 'changeover', 'Changeover to main boards'); s.co = 240; });
        LS.L2pcb.src = 'RM:pcbMain'; LS.L2pcb.label = 'Bare PCBs (main)';
        return true;
      },
      switchBack(arg, who) {
        const l2 = P.lines.L2; if (!l2.prodOverride) return false;
        l2.prodOverride = null;
        l2.stations.forEach(s => { setState(s, 'changeover', 'Changeover to power boards'); s.co = 240; });
        LS.L2pcb.src = 'RM:pcbPower'; LS.L2pcb.label = 'Bare PCBs';
        audit(who, 'Product changeover', 'SMT Line 2 → power boards'); log('MES', 'SMT Line 2 back to power boards', 'info', 'L2-Loader');
        return true;
      },
      slowAssembly(arg, who) {
        P.lines.L3.speed = 0.88; P.lines.L4.speed = 0.88;
        audit(who, 'Slowed assembly', 'Final Assembly A and B to 88% to stretch board stock');
        return true;
      },
      fixReflow(arg, who) {
        if (!P.scen.reflow) return false;
        P.scen.reflow.fixed = true;
        audit(who, 'Corrected setpoint', 'SMT Line 2 oven zone 5 back to 228 °C');
        log('MES', 'Oven zone 5 setpoint corrected on SMT Line 2', 'info', 'L2-Reflow');
        return true;
      },
      stopInspect(arg, who) {
        const L = P.lines[arg || 'L2']; if (!L) return false;
        L.stopped = true; later(600, 'stopEnd', { line: L.id });
        audit(who, 'Stopped line to inspect', `${L.name} stopped 10 min`);
        log('MES', `${L.name} stopped for a 10-minute inspection`, 'warn', L.stations[0].id);
        return true;
      },
      quarantine(arg, who) {
        const L = P.scen.lot; if (!L) return false;
        L.quarantined = true;
        const held = LS.L3panel.lots.filter(l => l.id === L.lot).reduce((a, l) => a + l.qty, 0) + RM.panel.lots.filter(l => l.id === L.lot).reduce((a, l) => a + l.qty, 0);
        LS.L3panel.lots = LS.L3panel.lots.filter(l => l.id !== L.lot); LS.L3panel.qty = LS.L3panel.lots.reduce((a, l) => a + l.qty, 0);
        RM.panel.lots = RM.panel.lots.filter(l => l.id !== L.lot); RM.panel.qty = RM.panel.lots.reduce((a, l) => a + l.qty, 0);
        if (LS.L3panel.qty < LS.L3panel.rop && !LS.L3panel.mission) createMission(LS.L3panel, 3, 'Quarantine replacement');
        P.lines.L3.inspect = false;
        audit(who, 'Quarantined lot', `${L.lot} · ${held} panels blocked · supplier claim raised`);
        log('QMS', `Lot ${L.lot} quarantined · ${held} panels blocked · supplier claim raised`, 'warn', 'L3-Panelload');
        return true;
      },
      inspectLot(arg, who) {
        if (!P.scen.lot) return false;
        P.lines.L3.inspect = true;
        audit(who, 'Incoming inspection', `100% check of lot ${P.scen.lot.lot} at Panel load · TV line about 15% slower`);
        return true;
      },
      boost(arg, who) {
        const L = P.lines[arg]; if (!L) return false;
        L.speed = 1.1; L.boosted = true;
        audit(who, 'Raised line speed', `${L.name} 100% → 110%`);
        log('MES', `${L.name} speed raised to 110%`, 'info', L.stations[0].id);
        return true;
      },
      speed(arg, who) {
        const [id, v] = String(arg).split('@'); const L = P.lines[id]; if (!L) return false;
        const old = L.speed; L.speed = clamp(+v, 0.5, 1.2); L.boosted = L.speed > 1;
        audit(who, 'Changed line speed', `${L.name} ${Math.round(old * 100)}% → ${Math.round(L.speed * 100)}%`);
        log('MES', `${L.name} speed set to ${Math.round(L.speed * 100)}%`, 'info', L.stations[0].id);
        return true;
      },
      stop(arg, who) { const L = P.lines[arg]; if (!L) return false; L.stopped = true; audit(who, 'Stopped line', L.name); log('MES', `${L.name} stopped by ${who}`, 'warn', L.stations[0].id); return true; },
      start(arg, who) { const L = P.lines[arg]; if (!L) return false; L.stopped = false; audit(who, 'Started line', L.name); log('MES', `${L.name} started by ${who}`, 'info', L.stations[0].id); return true; },
      prioritize(arg, who) {
        const o = P.orders.find(x => x.id === arg); if (!o) return false;
        o.prio = 2; audit(who, 'Re-sequenced order', `${o.id} loaded first`);
        if (o.state === 'open' && o.due - P.t < 2.2 * 3600) truckArrive(o);
        return true;
      },
      split(arg, who) {
        const o = P.orders.find(x => x.id === arg); if (!o || o.split) return false;
        o.split = true;
        const part = Math.round(o.qty * 0.6 / (o.product === 'tv' ? 8 : 40)) * (o.product === 'tv' ? 8 : 40);
        const rest = o.qty - part;
        o.qty = part;
        const n = { id: o.id + '-B', customer: o.customer, product: o.product, qty: rest, due: o.due + 3 * 3600, shipped: 0, state: 'open', truck: null, risk: 0, eta: null, prio: 0, split: true, agreed: true };
        P.orders.push(n); P.orders.sort((a, b) => a.due - b.due);
        audit(who, 'Split delivery', `${o.id}: ${part} on time, ${rest} agreed for ${clock(n.due)}`);
        log('ERP', `${o.id} split: ${part} now, ${rest} as ${n.id} at ${clock(n.due)} (agreed with the customer)`, 'info');
        return true;
      },
      cover(arg, who) {
        const s = P.byId['L3-Backcover']; s.speedMul = 1; if (P.scen.absent) P.scen.absent.fixed = true;
        const laila = P.people.find(p => p.name === 'Laila Mostafa'); if (laila) { laila.x = s.x; laila.z = s.z + s.d / 2 + 0.8; s.operator = laila; REWORK.speedMul = 1.8; }
        audit(who, 'Moved operator', 'Laila Mostafa from rework to Back cover');
        log('MES', 'Laila Mostafa now at Back cover · TV line back to takt', 'info', s.id);
        return true;
      },
      leaderCover(arg, who) {
        const s = P.byId['L3-Backcover']; s.speedMul = 1.22; if (P.scen.absent) P.scen.absent.fixed = true;
        const nour = P.people.find(p => p.name === 'Nour Ehab'); if (nour) { nour.x = s.x + 0.6; nour.z = s.z + s.d / 2 + 0.8; s.operator = nour; }
        audit(who, 'Line leader covers', 'Nour Ehab covers Back cover (about 20% slower)');
        return true;
      },
      expediteTruck(arg, who) {
        const tr = P.inbound.find(t => t.mat === 'panel' && t.state === 'due' && t.delayed);
        if (!tr) return false;
        tr.at = P.t + 70 * 60; tr.delayed = false;
        W.stats.extraCost += COST.altCarrier;
        audit(who, 'Booked alternative carrier', 'TV panels arrive in 70 min · EGP 18k extra');
        log('SCM', `Alternative carrier booked · TV panels due ${clock(tr.at)}`, 'info');
        return true;
      },
      restart(arg, who) {
        const lines = ['L1', 'L2'].filter(l => P.lines[l].tripped);
        if (!lines.length) return false;
        if (arg === 'all') {
          // both ovens and lines at once: the inrush peak can trip the feeder again
          if (R() < 0.45) { log('EMS', 'Inrush peak on simultaneous restart · feeder breaker tripped again', 'crit', 'UTIL-TX'); lines.forEach((l, i) => later(240 + i * 30, 'restart', { line: l, last: i === lines.length - 1 })); W.stats.extraCost += 30000; }
          else lines.forEach((l, i) => later(30, 'restart', { line: l, last: i === lines.length - 1 }));
          audit(who, 'Restarted lines', 'SMT Line 1 and 2 together');
        } else {
          lines.forEach((l, i) => later(40 + i * 60, 'restart', { line: l, last: i === lines.length - 1 }));
          audit(who, 'Staggered restart', 'SMT Line 1 now, Line 2 after 60 s');
        }
        return true;
      },
      stagger(arg, who) {
        const A = P.util.assets;
        A[2].defer = P.t + 20 * 60; A[4].defer = P.t + 20 * 60; A[2].forced = 0; A[4].forced = 0;
        audit(who, 'Staggered loads', 'Compressor 2 and Chiller 2 held 20 min; compressed-air and chilled-water buffers cover it');
        log('EMS', 'Compressor 2 and Chiller 2 start held for 20 min', 'info', 'UTIL-CH2');
        return true;
      },
      precool(arg, who) {
        P.util.precool = { from: P.t, until: P.t + 3 * 3600 };
        audit(who, 'Pre-cooling', 'Chillers run harder now (off the hottest hours) to bank cold');
        return true;
      },
      reflowProfile(arg, who) {
        for (const l of ['L1', 'L2']) P.lines[l].profile = 3;
        audit(who, 'Adjusted reflow profile', 'Both ovens −3 °C for the heat wave');
        log('MES', 'Reflow profiles on both SMT lines lowered 3 °C', 'info', 'L1-Reflow');
        return true;
      },
      safeSpeed(arg, who) {
        const s = P.byId[arg]; if (!s || !s.intrusion) return false;
        s.safe = true; s.preSafeMul = s.speedMul; s.speedMul = s.speedMul * 4;
        audit(who, 'Safe speed', `${s.name} slowed to safe speed · person in cell`);
        log('Safety', `${s.name} at safe speed within 0.4 s · near-miss report NM-${++W.c.wo} filed`, 'warn', s.id);
        return true;
      },
      dispatchTech(arg, who) {
        const s = P.byId[arg]; if (!s || s.state !== 'down') return false;
        s.repair = Math.min(s.repair, 420);
        audit(who, 'Dispatched technician', `${s.name}: technician with spare servo drive and torque kit`);
        log('CMMS', `Work order WO-${++W.c.wo}: ${s.name} servo drive swap · parts picked`, 'info', s.id);
        return true;
      }
    };
    function apply(id, who = 'You') {
      const [k, arg] = String(id).split(/:(.+)/);
      const f = ACTIONS[k];
      if (!f) return false;
      const ok = f(arg, who);
      W.acc.sense = true;
      emit('action', { id, who, ok });
      return ok;
    }

    /* ----- drills ----- */
    function trigger(id, who = 'You') {
      const sc = SCENARIOS.find(s => s.id === id);
      if (!sc) return false;
      audit(who, 'Started drill', sc.title);
      if (id === 'bearing') {
        const s = P.byId['L1-MounterB']; if (s.state === 'down' || s.degrade) return false;
        s.health = Math.min(s.health, 74); s.degrade = 0.03; s.failWhy = 'Spindle bearing seized'; s.failRepair = 2100;
      } else if (id === 'agv') {
        const a = P.agvs.find(x => x.load && x.path && !x.fault);
        if (!a) { P.scen.agvNext = true; log('AGV', 'Drill armed: the next loaded AGV on the aisle will fault'); }
        else { faultAgv(a); later(4, 'agvReassign', { agv: a.id }); }
      } else if (id === 'lot') {
        const lot = 'PL-2207' + pad(Math.floor(rnd(10, 99)), 2);
        P.scen.lot = { lot, injected: true, fails: 0 };
        LS.L3panel.lots.unshift({ id: lot, qty: 12 }); LS.L3panel.qty += 12;
        RM.panel.lots.unshift({ id: lot, qty: 120, supplier: 'Supplier B' }); RM.panel.qty += 120;
        log('Receiving', `Panel lot ${lot} released to Final Assembly A`, 'info', 'L3-Panelload');
      } else if (id === 'reflow') {
        P.scen.reflow = { line: 'L2', drift: 0, fixed: false };
      } else if (id === 'robot') {
        const s = P.byId['L4-Screwrobot'];
        fail(s, 'Servo torque fault', 1500);
        // the follow-on alarms a real cell raises with the fault (an alarm flood)
        const tags = [['F1', 'Servo amplifier alarm 4-12'], ['F2', 'Torque high on axis 3'], ['F3', 'Screw feeder jam'], ['F4', 'Cell door interlock open'], ['F5', 'Vacuum low on gripper'],
          ['F6', 'Cycle time exceeded'], ['F7', 'Robot not in home position'], ['F8', 'Screwdriver count mismatch'], ['F9', 'Upstream conveyor full'], ['F10', 'Part presence lost'], ['F11', 'Safety PLC: stop category 1']];
        tags.forEach(([k, msg], i) => alarm(`${s.id}.${k}`, true, { prio: i < 2 ? 2 : i < 6 ? 3 : 4, area: 'Final Assembly B', msg: `Screw robot: ${msg}`, ref: s.id, tag: `L4.SCREWROBOT.${k}` }));
      } else if (id === 'inbound') {
        const tr = P.inbound.find(t => t.mat === 'panel' && t.state === 'due');
        if (tr) { tr.at += 4 * 3600; tr.delayed = true; log('SCM', `${tr.id} (TV panels) held at the port gate · ETA ${clock(tr.at)}`, 'warn'); }
        P.scen.inbound = { tr: tr ? tr.id : null };
      } else if (id === 'power') {
        ['L1', 'L2'].forEach(l => { P.lines[l].tripped = true; });
        P.scen.power = { at: P.t };
        alarm('GRID.DIP', true, { prio: 1, area: 'Utilities', msg: 'Grid voltage dip 18% for 400 ms · SMT lines tripped', ref: 'UTIL-TX' });
        const inOven = ['L1-Reflow', 'L2-Reflow'].reduce((a, i) => a + P.byId[i].procs.length, 0);
        log('EMS', `Voltage dip · ${inOven} boards were inside the ovens and are held for re-inspection`, 'crit', 'UTIL-TX');
      } else if (id === 'rush') {
        P.orders.push({ id: 'EX-2231', customer: 'Export · Gulf (rush)', product: 'phone', qty: 240, due: Math.max(P.t + 3 * 3600, 12.5 * 3600), shipped: 0, state: 'open', truck: null, risk: 0, eta: null, prio: 0, split: false });
        P.orders.sort((a, b) => a.due - b.due);
        log('ERP', 'Rush order EX-2231 · 240 phones · added to today', 'warn');
      } else if (id === 'absent') {
        const s = P.byId['L3-Backcover']; s.speedMul = 1.55; P.scen.absent = { fixed: false, at: P.t };
        log('MES', `${s.operator ? s.operator.name : 'Operator'} called away from Back cover · team leader covering at reduced pace`, 'warn', s.id);
      } else if (id === 'peak') {
        const A = P.util.assets;
        A[2].forced = P.t + 40 * 60; A[4].forced = P.t + 40 * 60; A[2].defer = 0; A[4].defer = 0;
        if (tariffAt(P.t).name !== 'Peak') P.energy.peakOverride = P.t + 60 * 60;
        log('EMS', 'Chiller 2 and Compressor 2 started together in the peak tariff window', 'warn', 'UTIL-CH2');
      } else if (id === 'heat') {
        P.util.heatTarget = 5.5; later(3 * 3600, 'heatEnd', {});
        log('EMS', 'Weather service: heat wave, 41 °C expected this afternoon', 'warn', 'UTIL-CH1');
      } else if (id === 'safety') {
        const s = P.byId['L4-Screwrobot'];
        s.intrusion = { who: 'Omar Nabil', at: P.t };
        const p = P.people.find(x => x.name === 'Omar Nabil'); if (p) { p.intruding = true; p.x = s.x + 0.4; p.z = s.z + 0.2; }
        alarm(`${s.id}.CELL`, true, { prio: 1, area: 'Final Assembly B', msg: 'Vision AI: person inside the screw robot cell', ref: s.id });
        later(4, 'safetyHazard', { station: s.id });
        later(45, 'safetyClear', { station: s.id });
      }
      W.acc.sense = true;
      emit('scenario', id);
      return true;
    }

    function exec(cmd) {
      let ok = false;
      const who = cmd.who || 'You';
      if (cmd.type === 'apply') ok = apply(cmd.id, who);
      else if (cmd.type === 'trigger') ok = trigger(cmd.id, who);
      else if (cmd.type === 'ack') { const a = W.alarmMap.get(cmd.id); if (a && a.state === 'active') { a.state = 'ack'; audit(who, 'Acknowledged alarm', a.msg); ok = true; } }
      else if (cmd.type === 'ackAll') { let n = 0; for (const a of P.alarms) if (a.state === 'active') { a.state = 'ack'; n++; } if (n) audit(who, 'Acknowledged all alarms', `${n} alarms`); ok = n > 0; }
      else if (cmd.type === 'shelve') { const a = W.alarmMap.get(cmd.id); if (a) { a.shelvedTo = P.t + 20 * 60; audit(who, 'Shelved alarm for 20 min', a.msg); ok = true; } }
      else if (cmd.type === 'at') { timers.push({ at: cmd.at, kind: 'cmd', arg: { cmd: cmd.cmd } }); ok = true; }
      else if (cmd.type === 'note') { audit(who, cmd.action || 'Note', cmd.detail || '', cmd.extra); ok = true; }
      P.cmdLog.push({ k: P.k, t: P.t, type: cmd.type, id: cmd.id, who }); if (P.cmdLog.length > 300) P.cmdLog.shift();
      emit('alarms'); emit('cmd', cmd);
      return ok;
    }

    /* ----- one fixed step ----- */
    function step(dtArg) {
      const dt = dtArg || STEP;
      P.t += dt; P.k++;
      for (let i = timers.length - 1; i >= 0; i--) if (timers[i].at <= P.t) { const tm = timers[i]; timers.splice(i, 1); if (TIMER[tm.kind]) TIMER[tm.kind](tm.arg); }
      if (P.scen.reflow && !P.scen.reflow.fixed) P.scen.reflow.drift = Math.min(9, P.scen.reflow.drift + dt * 0.03);
      if (P.scen.reflow && P.scen.reflow.fixed) { P.scen.reflow.drift = Math.max(0, P.scen.reflow.drift - dt * 0.2); if (P.scen.reflow.drift <= 0) delete P.scen.reflow; }
      for (const sg of P.segs) {
        const v = sg.speed * (P.lines[sg.from && sg.from.line] ? P.lines[sg.from.line].speed : 1) * (sg.from && P.lines[sg.from.line] && (P.lines[sg.from.line].stopped || P.lines[sg.from.line].tripped) ? 0 : 1);
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
      energyStep(dt);
      for (const o of P.orders) if (o.state === 'open' && P.t >= o.due - 75 * 60) truckArrive(o);
      for (const tr of P.trucks) {
        if (tr.state === 'arriving') { tr.k = Math.min(1, tr.k + dt / 40); if (tr.k >= 1) tr.state = 'loading'; }
        else if (tr.state === 'leaving') { tr.k = Math.max(0, tr.k - dt / 40); if (tr.k <= 0) tr.state = 'gone'; }
        else if (tr.state === 'loading' && P.t > tr.order.due + 20 * 60 && tr.loaded > 0) truckDepart(tr);
      }
      for (const tr of P.trucks) if (tr.state === 'gone' && tr.dock.truck === tr) tr.dock.truck = null;
      if (P.trucks.some(t => t.state === 'gone')) P.trucks = P.trucks.filter(t => t.state !== 'gone');
      const A = W.acc;
      A.a1 += dt; A.a2 += dt; A.a5 += dt;
      if (A.a1 >= 1 - 1e-9) {
        A.a1 = 0;
        for (const b of Object.values(LS)) if (level(b) <= b.rop && !b.mission) createMission(b, 1, 'Kanban');
        dispatch();
        for (const s of P.stations) sensors(s);
        utilStep();
        for (const p of P.pallets) if (p.where === 'truck' && p.truck && p.truck.state === 'gone') { p.where = 'shipped'; p.units.forEach(archive); }
        if (P.pallets.some(p => p.where === 'shipped')) P.pallets = P.pallets.filter(p => p.where !== 'shipped');
        if (Math.floor(P.t) % 30 === 0) replenish();
      }
      if (A.a2 >= 2 - 1e-9 || A.sense) { A.a2 = 0; A.sense = false; sense(); }
      if (A.a5 >= 5 - 1e-9) { A.a5 = 0; kpis(); for (const s of P.stations) record(s); }
    }
    function steps(n) { for (let i = 0; i < n; i++) step(); }

    /* ----- what-if helpers ----- */
    function lateness() {
      let n = W.stats.lateOrders, sec = W.stats.lateSec;
      for (const o of P.orders) if ((o.state === 'open' || o.state === 'loading') && P.t > o.due) { n++; sec += P.t - o.due; }
      return { n, sec };
    }
    function metrics() {
      const L = lateness(), S = W.stats;
      return {
        t: P.t, packedTv: P.made.packedTv, packedPhone: P.made.packedPhone, boards: P.made.main + P.made.power,
        downSec: Object.assign({}, S.downSec), starvedSec: S.starvedSec, kwh: S.kwh, energyCost: S.energyCost, demandCost: S.demandCost,
        scrap: S.scrap, scrapCost: S.scrapCost, rework: S.rework, oos: S.oos, smtRepairs: S.smtRepairs, failures: S.failures, repairCost: S.repairCost, extraCost: S.extraCost,
        lateOrders: L.n, lateSec: L.sec, shipped: S.shipped, stockouts: S.stockouts, nearMiss: S.nearMiss, oee: P.kpi.oee || 0, fpy: P.kpi.fpy || 0,
        kwPeak: P.energy.peak, alarms: P.alarmStats.raised, risk: terminalRisk()
      };
    }
    // what a worn machine still costs after the measured window: the breakdown it is heading for
    function terminalRisk() {
      let r = 0;
      for (const s of P.stations) if (s.degrade > 0 && s.state !== 'down' && s.state !== 'maint') {
        const left = (s.health - 22) / (s.degrade * s.wearMul);
        const soon = left < 7200 ? 1 : 7200 / left;
        r += soon * (COST.unplannedRepair + 35 * (COST.lineMin[s.line] || 1500) * 0.5);
      }
      return r;
    }
    function value(m0, m1) {
      // EGP effect of the period between two metric snapshots (higher is better)
      const d = k => (m1[k] || 0) - (m0[k] || 0);
      return d('packedTv') * COST.margin.tv + d('packedPhone') * COST.margin.phone
        - d('lateSec') / 3600 * COST.lateHour - d('energyCost') - d('demandCost') - d('scrapCost') - d('repairCost') - d('extraCost') - d('rework') * COST.rework - d('smtRepairs') * COST.smtRepair - d('oos') * COST.oosBoard - d('nearMiss') * COST.nearMiss - d('risk');
    }

    /* ----- warm start: run the plant for 55 minutes so every line, buffer and rack is naturally full ----- */
    function warm() {
      P.t = START - 55 * 60;
      for (const L of ['L3', 'L4']) {
        const lane = LS[L + 'main'];
        for (let i = 0; i < (L === 'L3' ? 22 : 34); i++) { const b = unit('main', { line: 'L1', born: P.t - 3600 - i * 30, peak: 245, spi: 99 }); b.steps.push({ st: 'L1-AOI', name: 'AOI', line: 'L1', t0: b.born, t1: b.born + 300, ok: true, note: 'Pass' }); b.loc = { k: 'ls', b: lane }; lane.items.push(b); }
      }
      for (let i = 0; i < 24; i++) { const b = unit('power', { line: 'L2', born: P.t - 3600 - i * 40, peak: 245, spi: 99 }); b.steps.push({ st: 'L2-AOI', name: 'AOI', line: 'L2', t0: b.born, t1: b.born + 300, ok: true, note: 'Pass' }); b.loc = { k: 'ls', b: LS.L3power }; LS.L3power.items.push(b); }
      for (let i = 0; i < 140; i++) { const b = unit('main', { line: 'L1', born: P.t - 1800 - i * 13, peak: 245, spi: 99 }); b.steps.push({ st: 'L1-AOI', name: 'AOI', line: 'L1', t0: b.born, t1: b.born + 300, ok: true, note: 'Pass' }); b.loc = { k: 'sm' }; SM.main.items.push(b); }
      for (let i = 0; i < 70; i++) { const b = unit('power', { line: 'L2', born: P.t - 1800 - i * 30, peak: 245, spi: 99 }); b.steps.push({ st: 'L2-AOI', name: 'AOI', line: 'L2', t0: b.born, t1: b.born + 300, ok: true, note: 'Pass' }); b.loc = { k: 'sm' }; SM.power.items.push(b); }
      for (let i = 0; i < 6; i++) {
        const tv = i % 2 === 0, p = { id: 'PAL-' + (++W.c.pal), product: tv ? 'tv' : 'phone', units: [], where: 'fg', cap: tv ? 8 : 40, built: P.t - 3000 + i * 300, claimed: false };
        for (let j = 0; j < p.cap; j++) { const u = unit(tv ? 'tv' : 'phone', { born: P.t - 7000, packed: P.t - 3200 }); u.steps.push({ st: 'L5-Packing', name: 'Packing', line: 'L5', t0: u.packed, t1: u.packed, ok: true, note: 'Packed before 08:20' }); u.pallet = p.id; u.loc = { k: 'pallet', p }; p.units.push(u); }
        const slot = P.fgSlots[i * 3 + 1]; slot.p = p; p.slot = slot; p.x = slot.x; p.z = slot.z;
        P.pallets.push(p);
      }
      P.made.packedTv = 0; P.made.packedPhone = 0;
      while (P.t < START - 1e-6) step(0.5);
      P.t = START; P.k = 0;
      P.base.tv += P.made.packedTv; P.base.phone += P.made.packedPhone; P.made.packedTv = 0; P.made.packedPhone = 0;
      P.events.length = 0; P.audit.length = 0; W.alarmMap.clear(); P.alarms = []; P.cmdLog.length = 0;
      P.alarmStats = { raised: 0, recent: [], rate10: 0, flood: false, floods: 0, peak10: 0 };
      for (const k in W.stats) if (typeof W.stats[k] === 'number') W.stats[k] = 0;
      for (const k in W.stats.downSec) W.stats.downSec[k] = 0;
      P.energy.kwh = 0; P.energy.cost = 0; P.energy.peak = 0; P.energy.over = 0;
      for (const s of P.stations) { s.hist = {}; for (let i = 0; i < 40; i++) { sensors(s); record(s); } }
      for (let i = 0; i < 24; i++) kpis();
      log('MES', 'Shift A running · Plant EG-01 · 5 lines, 6 AGVs, 2 forklifts, 13 people on the floor');
      sense();
    }

    /* ----- clock: real seconds in, fixed plant steps out ----- */
    const clk = { speed: 1, paused: false, acc: 0 };
    function run(realDt, maxSteps = 900) {
      if (clk.paused) return 0;
      clk.acc += realDt * clk.speed;
      let n = Math.floor(clk.acc / STEP + 1e-9);
      if (n > maxSteps) { n = maxSteps; clk.acc = 0; } else clk.acc -= n * STEP;
      for (let i = 0; i < n; i++) step();
      emit('tick', n);
      return n;
    }

    function snapshot(o = {}) {
      // a deep copy of the world; lite drops the shipped-unit archive (what-if runs do not need it)
      if (!o.lite) return structuredClone(W);
      const arch = P.archive, ao = P.archiveOrder, ev = P.events, au = P.audit;
      P.archive = new Map(); P.archiveOrder = []; P.events = []; P.audit = [];
      try { return structuredClone(W); } finally { P.archive = arch; P.archiveOrder = ao; P.events = ev; P.audit = au; }
    }

    const api = {
      W, P, SCENARIOS, KIND, LINES, COST, TARIFF, STEP, START, SHIFT_START, SHIFT_END, TAKT, clock, clockS, mins,
      STOPS, LS, RM, SM, BURN, QC, PACK, PAL, SMTREP, REWORK, missions, bufs: P.bufs,
      on(fn) { listeners.push(fn); return () => { const i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1); }; },
      exec, step, steps, run, warm, findUnit, route, level, runway, metrics, value, lateness, tariffAt, snapshot,
      fork(o = {}) { return bind(snapshot({ lite: o.lite !== false })); },
      reseed(n) { W.rng.a = (W.rng.a ^ Math.imul(n + 1, 0x9E3779B1)) | 0; },
      digest() {
        let h = 0; const mix = v => { h = Math.imul(h ^ (v | 0), 0x01000193) >>> 0; };
        mix(P.k); mix(Math.round(P.t * 10)); mix(P.units.size); mix(P.made.main); mix(P.made.power); mix(P.made.packedTv); mix(P.made.packedPhone); mix(W.rng.a); mix(P.alarms.length);
        for (const a of P.agvs) { mix(Math.round(a.x * 100)); mix(Math.round(a.z * 100)); }
        return h.toString(16);
      },
      get t() { return P.t; },
      get speed() { return clk.speed; }, get paused() { return clk.paused; },
      setSpeed(v) { clk.speed = v || 1; clk.paused = v === 0; emit('speed'); },
      // convenience wrappers (pages call the hub, which records commands; these are for scripts and tests)
      apply: (id, who) => exec({ type: 'apply', id, who }),
      trigger: (id, who) => exec({ type: 'trigger', id, who }),
      ack: key => exec({ type: 'ack', id: key }),
      fastForward(sec) { steps(Math.round(sec / STEP)); emit('tick', 0); emit('sense'); }
    };
    return api;
  }

  function create(opts = {}) { const api = bind(world(opts.seed || 20261020)); api.warm(); return api; }
  function restore(W) { return bind(W); }

  const PlantEngine = { create, restore, SCENARIOS, KIND, LINES, COST, TARIFF, STEP, START, clock, clockS, mins, polyAt, polyLen };
  if (typeof module !== 'undefined' && module.exports) module.exports = PlantEngine;
  else root.PlantEngine = PlantEngine;
})(typeof window !== 'undefined' ? window : globalThis);
