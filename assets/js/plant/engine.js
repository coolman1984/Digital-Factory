/* Digital Factory — Plant EG-01 enterprise twin: the shop floor.
   A unit-level model of a large TV plant: six main assembly lines fed by six LCM lines over conveyors, six SMD lines
   with PBA software download and test, twenty injection machines, six press, coating and sub-assembly lines, six
   cushion (EPS) machines, the import warehouse, the local-vendor supermarket, milk-run trains, AGVs, forklifts,
   finished goods, shipping, the service-parts warehouse and the people. Every TV, panel module and board carries a
   serial and its genealogy; every moulded, pressed or bought part carries a lot. Pure model: no DOM, deterministic
   random numbers. The enterprise layer (SAP, GMES, S&OP, MRP, departments) lives in erp.js. All data is simulated.
   Coordinates are metres: x east, z south. Time is plant seconds since midnight. */
(function (root) {
  'use strict';

  /* ---------------- helpers ---------------- */
  function mulberry(seed) {
    let a = seed >>> 0;
    return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
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
      if (s <= d || i === p.length - 1) { const k = d ? clamp(s / d, 0, 1) : 0; return [p[i - 1][0] + (p[i][0] - p[i - 1][0]) * k, p[i - 1][1] + (p[i][1] - p[i - 1][1]) * k, Math.atan2(p[i][1] - p[i - 1][1], p[i][0] - p[i - 1][0])]; }
      s -= d;
    }
    return [p[0][0], p[0][1], 0];
  }

  const START = 9 * 3600 + 12 * 60, HIST = 180;
  // three eight-hour shifts: A 06–14, B 14–22, C 22–06; the model starts in shift A and hands over on its own
  let SHIFT_START = 6 * 3600, SHIFT_END = 14 * 3600;
  const W = 264, D = 168;

  /* ---------------- products ---------------- */
  // takt in seconds per TV on a main line; prices and standard costs in EGP (sample values)
  const MODELS = {
    M43: { id: 'M43', name: 'UHD 43', inch: 43, takt: 22, pallet: 8, price: 9800, cost: { mat: 6950, lab: 410, ovh: 600 }, w: 0.98, h: 0.57, stand: 'STD-S' },
    M55: { id: 'M55', name: 'UHD 55', inch: 55, takt: 24, pallet: 6, price: 15900, cost: { mat: 11350, lab: 470, ovh: 690 }, w: 1.24, h: 0.71, stand: 'STD-S' },
    M65: { id: 'M65', name: 'QLED 65', inch: 65, takt: 28, pallet: 4, price: 27500, cost: { mat: 19850, lab: 560, ovh: 820 }, w: 1.45, h: 0.83, stand: 'STD-L' },
    M75: { id: 'M75', name: 'QLED 75', inch: 75, takt: 32, pallet: 3, price: 41900, cost: { mat: 30600, lab: 640, ovh: 960 }, w: 1.68, h: 0.96, stand: 'STD-L' }
  };
  const SIZE = m => m.slice(1);   // 'M55' → '55'

  // material master: code → description, unit, where it is bought or made, lead time (days), lot size, standard price (EGP)
  const MAT = {};
  const mat = (code, o) => { MAT[code] = Object.assign({ code, unit: 'pcs' }, o); };
  for (const m of Object.values(MODELS)) {
    const s = m.inch;
    mat('OC-' + s, { name: `Open cell panel ${s}"`, src: 'import', vendor: 'Panel vendor (Asia)', lt: 42, lot: s >= 65 ? 600 : 1200, price: Math.round(m.cost.mat * 0.52), store: 'IMP' });
    mat('BLU-' + s, { name: `Backlight unit kit ${s}"`, src: 'import', vendor: 'BLU vendor (Asia)', lt: 35, lot: s >= 65 ? 600 : 1200, price: Math.round(m.cost.mat * 0.12), store: 'IMP' });
    mat('SMPS-' + s, { name: `Power board (SMPS) ${s}"`, src: 'import', vendor: 'Power vendor (Asia)', lt: 35, lot: 1500, price: Math.round(m.cost.mat * 0.05), store: 'IMP' });
    mat('PCB-' + s, { name: `Bare main board ${s}"`, src: 'local', vendor: 'PCB vendor (local)', lt: 7, lot: 2000, price: 140, store: 'LOC' });
    mat('CTN-' + s, { name: `Carton ${s}"`, src: 'local', vendor: 'Carton vendor (local)', lt: 3, lot: 1000, price: s >= 65 ? 180 : 95, store: 'LOC' });
    mat('LCM-' + s, { name: `Panel module (LCM) ${s}"`, src: 'make', line: 'LCM', lt: 0, price: Math.round(m.cost.mat * 0.68) });
    mat('PBA-' + s, { name: `Main board assembly (PBA) ${s}"`, src: 'make', line: 'SMD', lt: 1, price: Math.round(m.cost.mat * 0.09) });
    mat('BC-' + s, { name: `Back cover ${s}"`, src: 'make', line: 'INJ', lt: 1, price: s >= 65 ? 310 : 190 });
    mat('CHS-' + s, { name: `Back chassis set ${s}"`, src: 'make', line: 'PRS', lt: 1, price: s >= 65 ? 260 : 160 });
    mat('CUS-' + s, { name: `Cushion set ${s}"`, src: 'make', line: 'CUS', lt: 0, price: s >= 65 ? 75 : 45 });
  }
  mat('STD-S', { name: 'Stand set, small', src: 'make', line: 'INJ', lt: 1, price: 70 });
  mat('STD-L', { name: 'Stand set, large', src: 'make', line: 'INJ', lt: 1, price: 110 });
  mat('ACC', { name: 'Accessory kit (remote, cables, manual)', src: 'local', vendor: 'Accessory vendor (local)', lt: 7, lot: 3000, price: 120, store: 'LOC' });
  mat('RESIN', { name: 'ABS/PC resin', unit: 'kg', src: 'import', vendor: 'Resin vendor (Gulf)', lt: 28, lot: 20000, price: 62, store: 'IMP' });
  mat('EPS', { name: 'EPS beads', unit: 'kg', src: 'import', vendor: 'EPS vendor (Gulf)', lt: 28, lot: 8000, price: 75, store: 'IMP' });
  mat('COIL', { name: 'Steel coil SECC', unit: 'kg', src: 'local', vendor: 'Steel vendor (local)', lt: 14, lot: 25000, price: 48, store: 'LOC' });
  mat('PWD', { name: 'Powder paint, black', unit: 'kg', src: 'local', vendor: 'Paint vendor (local)', lt: 7, lot: 2000, price: 160, store: 'LOC' });
  mat('BRK', { name: 'Bracket and nut set', src: 'local', vendor: 'Fastener vendor (local)', lt: 7, lot: 10000, price: 22, store: 'LOC' });

  // bill of materials (single level): what one unit of each item consumes
  const BOM = {};
  for (const m of Object.values(MODELS)) {
    const s = m.inch;
    BOM[m.id] = [['LCM-' + s, 1], ['PBA-' + s, 1], ['SMPS-' + s, 1], ['BC-' + s, 1], ['CHS-' + s, 1], [m.stand, 1], ['CUS-' + s, 1], ['CTN-' + s, 1], ['ACC', 1]];
    BOM['LCM-' + s] = [['OC-' + s, 1], ['BLU-' + s, 1]];
    BOM['PBA-' + s] = [['PCB-' + s, 1]];
    BOM['BC-' + s] = [['RESIN', s >= 65 ? 2.6 : 1.7]];
    BOM['CHS-' + s] = [['COIL', s >= 65 ? 4.1 : 3.0], ['PWD', 0.16], ['BRK', 1]];
    BOM['CUS-' + s] = [['EPS', s >= 65 ? 0.48 : 0.33]];
  }
  BOM['STD-S'] = [['RESIN', 0.55]]; BOM['STD-L'] = [['RESIN', 0.8]];

  // machine kinds: footprint (w along the flow, d across), height, power kW [run, idle, down]
  const KIND = {
    loader: { w: 1.4, d: 1.4, h: 1.5, kw: [1.2, 0.6, 0.2] }, unloader: { w: 1.4, d: 1.4, h: 1.5, kw: [1.2, 0.6, 0.2] },
    printer: { w: 1.6, d: 1.6, h: 1.6, kw: [3.5, 1.4, 0.3] }, spi: { w: 1.3, d: 1.5, h: 1.6, kw: [2.2, 1, 0.3] },
    mounter: { w: 1.9, d: 2.0, h: 1.6, kw: [6.5, 2.4, 0.4] }, reflow: { w: 5.4, d: 1.5, h: 1.5, kw: [44, 28, 2] },
    aoi: { w: 1.3, d: 1.5, h: 1.6, kw: [2.2, 1, 0.3] }, writer: { w: 2.4, d: 1.6, h: 1.7, kw: [2.0, 1.0, 0.2] },
    ict: { w: 2.2, d: 1.6, h: 1.7, kw: [2.5, 1.2, 0.2] }, lcmload: { w: 3.2, d: 2.6, h: 1.6, kw: [4, 1.5, 0.3] },
    blu: { w: 3.0, d: 2.4, h: 1.0, kw: [1, 0.4, 0.1] }, bond: { w: 3.2, d: 2.6, h: 1.8, kw: [6, 2, 0.3] },
    lighting: { w: 3.2, d: 2.6, h: 2.0, kw: [3, 1.2, 0.3] }, robot: { w: 3.2, d: 2.6, h: 1.1, kw: [4.5, 1.2, 0.2] },
    bench: { w: 3.0, d: 2.4, h: 1.0, kw: [0.8, 0.4, 0.1] }, fct: { w: 3.0, d: 2.4, h: 1.9, kw: [3, 1.5, 0.3] },
    aging: { w: 16, d: 4.0, h: 2.2, kw: [0, 4, 1] }, wb: { w: 3.2, d: 2.6, h: 2.3, kw: [3, 1.5, 0.3] },
    qa: { w: 3.4, d: 2.8, h: 2.3, kw: [3, 1.5, 0.3] }, packer: { w: 4.0, d: 2.8, h: 2.0, kw: [6, 2, 0.3] },
    palletizer: { w: 3.6, d: 3.6, h: 2.6, kw: [7.5, 1.5, 0.3] }, injection: { w: 6.2, d: 2.2, h: 2.4, kw: [55, 18, 2] },
    press: { w: 4.6, d: 3.0, h: 4.2, kw: [38, 8, 1] }, oven: { w: 32, d: 2.4, h: 2.6, kw: [90, 50, 3] },
    subassy: { w: 3.0, d: 2.2, h: 1.0, kw: [0.8, 0.4, 0.1] }, cushion: { w: 4.0, d: 3.0, h: 3.2, kw: [30, 10, 1] },
    repair: { w: 2.6, d: 1.6, h: 1.0, kw: [0.6, 0.3, 0.1] }
  };

  const LINE_Z = [48, 62, 76, 90, 104, 118];
  const SMD_Z = [7, 11.5, 16, 20.5, 25, 29.5];
  const PRESS_Z = [131, 137.4, 143.8, 150.2, 156.6, 163];
  const PRESS_SIZE = [43, 55, 55, 65, 65, 75];
  const INJ_PART = ['BC-43', 'BC-43', 'BC-43', 'BC-55', 'BC-55', 'BC-55', 'BC-55', 'BC-55', 'BC-65', 'BC-65', 'BC-65', 'BC-65', 'BC-65', 'BC-75', 'BC-75', 'STD-S', 'STD-S', 'STD-L', 'STD-L', 'BC-55'];
  const INJ_CYCLE = { 'BC-43': 60, 'BC-55': 58, 'BC-65': 64, 'BC-75': 60, 'STD-S': 50, 'STD-L': 52 };
  const INJ_CAV = { 'BC-43': 1, 'BC-55': 1, 'BC-65': 1, 'BC-75': 1, 'STD-S': 4, 'STD-L': 4 };
  const START_MODELS = ['M55', 'M55', 'M43', 'M65', 'M65', 'M75'];
  const SMD_MODELS = ['M55', 'M55', 'M43', 'M65', 'M65', 'M75'];

  const SCENARIOS = [
    { id: 'bearing', title: 'Bearing wear on SMD 4 Mounter B', area: 'SMD hall', agent: 'Maintenance', what: 'The spindle bearing on a mounter of SMD line 4 starts to wear. Vibration climbs.', chain: 'Mounter B → SMD 4 → PBA 65 supermarket → main lines 4 and 5 → orders' },
    { id: 'shortshot', title: 'Short shots on injection machine IM10', area: 'Injection', agent: 'Quality', what: 'A worn check ring makes IM10 mould incomplete 65" back covers. Final QA starts rejecting them.', chain: 'IM10 → back-cover lots → main lines 4 and 5 → final QA → rework' },
    { id: 'coating', title: 'Coating oven temperature drop', area: 'Press & coating', agent: 'Quality', what: 'A burner fault drops the line 4 coating oven 18 °C below its cure temperature.', chain: 'Oven → under-cured chassis → paint adhesion → main lines 4 and 5' },
    { id: 'software', title: 'Faulty software release for PBA 55', area: 'PE · SMD', agent: 'Quality', what: 'PE releases firmware v3.2.0 for the 55" main board. Its HDMI-CEC handling fails the function test.', chain: 'PE release → PBA writers → boards → function test on main lines 1 and 2' },
    { id: 'container', title: 'Open-cell container held at port', area: 'SCM · Import', agent: 'Planning', what: 'The 65" open-cell container is held at the port for 5 days.', chain: 'Import container → OC-65 stock → LCM lines 4 and 5 → main lines 4 and 5 → orders' },
    { id: 'carton', title: 'Local carton vendor late', area: 'SCM · Local', agent: 'Logistics', what: 'The 55" carton truck from the local vendor is 3 hours late.', chain: 'Vendor truck → carton supermarket → packing on main lines 1 and 2' },
    { id: 'absent', title: 'Eight operators absent on main line 3', area: 'HR · Main line 3', agent: 'Planning', what: 'Eight operators did not come in for shift A on main line 3.', chain: 'Attendance → manual stations → line 3 takt → orders' },
    { id: 'field', title: 'Field failures: 55" main boards', area: 'SVC', agent: 'Service', what: 'Service centres report a spike of 55" main-board failures and order 60 spare PBAs.', chain: 'Customers → SVC → spare PBA stock → production PBA supermarket' },
    { id: 'power', title: 'Grid voltage dip', area: 'Utilities', agent: 'Energy', what: 'An 18% voltage dip for 400 ms trips the SMD lines and the coating ovens.', chain: 'Grid → SMD reflow ovens and coating ovens → boards and chassis in the ovens' }
  ];

  function create(opts = {}) {
    const R = mulberry(opts.seed || 20261021);
    const rnd = (a, b) => a + R() * (b - a);
    const pick = arr => arr[Math.floor(R() * arr.length)];
    const listeners = [];
    const emit = (type, data) => { for (const fn of listeners) fn(type, data); };

    const P = {
      t: START, speed: 1, paused: false, seq: 0,
      stations: [], byId: {}, lines: {}, segs: [], bufs: {}, units: new Set(), archive: new Map(), archiveOrder: [],
      walker: null, agvs: [], tuggers: [], forklifts: [], people: [], techs: [], inbound: [], trucks: [], pallets: [], fgSlots: [], orders: [],
      events: [], alarms: [], recs: [], preds: [], audit: [], kpi: {}, hist: { t: [], kw: [], tph: [], oee: [], wip: [] },
      scen: {}, energy: { kwh: 0 }, c0: START, wo: [], woSeq: 4180, audSeq: 30410, snaps: [], shift: { name: 'A', start: 6 * 3600, end: 14 * 3600, off: 0 }, shifts: [], made: { tv: 0, byModel: { M43: 0, M55: 0, M65: 0, M75: 0 } },
      base: { M43: 280, M55: 880, M65: 520, M75: 160 },     // TVs packed between 06:00 and the model start: about the demonstrated 700 an hour after a 30-minute start-up
      rejects: { rework: [], smtRepair: [] }, saved: 0, leads: [], nodes: [], edges: [], layout: {}, sw: {}, holds: new Set(), svc: { orders: [], shipped: 0 }
    };

    /* ----- events, audit, alarms, recommendations ----- */
    function log(src, msg, level = 'info', ref) {
      const e = { id: ++P.seq, t: P.t, time: clock(P.t), src, msg, level, ref };
      P.events.unshift(e); if (P.events.length > 220) P.events.pop();
      emit('event', e); return e;
    }
    // every decision gets an audit ID, the way a regulated plant traces who approved what
    function audit(who, action, detail) { const a = { id: 'AUD-' + (++P.audSeq), t: P.t, time: clock(P.t), who, action, detail }; P.audit.unshift(a); if (P.audit.length > 80) P.audit.pop(); emit('audit', a); return a; }
    const alarmMap = new Map();
    function alarm(key, on, o) {
      const a = alarmMap.get(key);
      if (on && !a) {
        const n = Object.assign({ key, id: ++P.seq, t: P.t, time: clock(P.t), state: 'active', prio: 3 }, o);
        alarmMap.set(key, n); P.alarms.unshift(n);
        log(n.area || 'GMES', n.msg, n.prio <= 1 ? 'crit' : n.prio === 2 ? 'warn' : 'info', n.ref);
      } else if (!on && a) { alarmMap.delete(key); P.alarms = P.alarms.filter(x => x !== a); }
      else if (on && a && o && o.msg) a.msg = o.msg;
    }
    const recs = new Map();
    function rec(key, o) {
      if (!o) { recs.delete(key); return; }
      const prev = recs.get(key);
      if (prev && prev.dismissed) return;
      const r = Object.assign({ key, t: P.t, time: clock(P.t) }, prev && { t: prev.t, time: prev.time }, o);
      if (!prev) log('AI', `${o.agent} agent: ${o.title}`, o.level === 'crit' ? 'crit' : o.level === 'warn' ? 'warn' : 'info', o.ref);
      recs.set(key, r);
    }

    /* ----- units and genealogy ----- */
    const PFX = { tv: 'TV', lcm: 'LM', pba: 'PB' };
    let snSeq = 518200;
    function unit(type, extra) {
      const u = Object.assign({ id: ++P.seq, sn: `${PFX[type]}26${pad(++snSeq, 7)}`, type, born: P.t, steps: [], parts: {}, lots: {}, defect: null, loc: null }, extra);
      P.units.add(u); return u;
    }
    function archive(u) {
      P.units.delete(u); P.archive.set(u.sn, u); P.archiveOrder.push(u.sn);
      if (P.archiveOrder.length > 6000) P.archive.delete(P.archiveOrder.shift());
    }
    function stepRec(u, st, extra) { const s = Object.assign({ st: st.id, name: st.name, line: st.line, t0: P.t, t1: null }, extra); u.steps.push(s); return s; }
    function findUnit(sn) {
      sn = String(sn).trim().toUpperCase();
      for (const u of P.units) if (u.sn === sn) return u;
      if (P.archive.has(sn)) return P.archive.get(sn);
      const scan = it => { for (const u of it) for (const k in u.parts) if (u.parts[k] && u.parts[k].sn === sn) return u.parts[k]; return null; };
      return scan(P.units) || scan(P.archive.values());
    }

    /* ----- buffers: stores, supermarkets, silos, line-side stock ----- */
    // a buffer holds either units (items) or counted lots; every lot keeps where it came from
    function buf(id, o) {
      const b = Object.assign({ id, qty: 0, cap: 100, rop: 30, batch: 60, items: null, lots: [], pending: 0, rate: 0, used: 0, mission: null, code: null }, o);
      if (b.items) b.lots = null;
      P.bufs[id] = b; return b;
    }
    const level = b => (b.items ? b.items.length : b.qty);
    function addLot(b, id, qty, extra) {
      if (b.items) return;
      const last = b.lots[b.lots.length - 1];
      if (last && last.id === id) last.qty += qty; else b.lots.push(Object.assign({ id, qty, t: P.t }, extra));
      b.qty += qty;
    }
    function take(b, n) {
      if (b.items) { if (b.items.length < n) return null; b.used += n; return b.items.splice(0, n); }
      if (b.qty < n - 1e-9) return null;
      const ids = [];
      let left = n;
      while (left > 1e-9 && b.lots.length) {
        const L = b.lots[0];
        if (P.holds.has(L.id)) { b.lots.shift(); b.qty -= L.qty; b.held = (b.held || 0) + L.qty; continue; }
        const k = Math.min(left, L.qty); L.qty -= k; left -= k; ids.push(L.id);
        if (L.qty <= 1e-9) b.lots.shift();
      }
      if (left > 1e-9) { b.qty = b.lots.reduce((a, l) => a + l.qty, 0); return null; }
      b.qty -= n; b.used += n;
      return ids;
    }
    function moveLots(from, to, n) {
      // move n from one counted buffer to another, keeping the lot identities
      let left = Math.min(n, from.qty);
      const moved = [];
      while (left > 1e-9 && from.lots.length) {
        const L = from.lots[0]; const k = Math.min(left, L.qty);
        L.qty -= k; left -= k; from.qty -= k; moved.push({ id: L.id, qty: k, src: L.src });
        if (L.qty <= 1e-9) from.lots.shift();
      }
      for (const m of moved) addLot(to, m.id, m.qty, { src: m.src });
      return moved.reduce((a, m) => a + m.qty, 0);
    }
    let lotSeq = 4100;
    const lotId = (pfx) => `${pfx}-${pad(++lotSeq, 5)}`;

    /* ----- stores (with their racks in 3D) ----- */
    const STORE = { IMP: {}, LOC: {}, INJ: {}, PRS: {}, PBA: {}, SVC: {} };
    const store = (st, code, o) => { const b = buf(`${st}:${code}`, Object.assign({ code, store: st, label: MAT[code].name }, o)); STORE[st][code] = b; return b; };
    for (const s of [43, 55, 65, 75]) {
      store('IMP', 'OC-' + s, { cap: 2400 }); store('IMP', 'BLU-' + s, { cap: 2400 }); store('IMP', 'SMPS-' + s, { cap: 3000 });
      store('LOC', 'PCB-' + s, { cap: 4000 }); store('LOC', 'CTN-' + s, { cap: 2000 });
      store('INJ', 'BC-' + s, { cap: 420 }); store('PRS', 'CHS-' + s, { cap: 420 });
      store('PBA', 'PBA-' + s, { cap: 320, items: [] });
      store('SVC', 'PBA-' + s, { cap: 120, items: [] }); store('SVC', 'BC-' + s, { cap: 200 });
    }
    store('INJ', 'STD-S', { cap: 900 }); store('INJ', 'STD-L', { cap: 600 });
    store('IMP', 'RESIN', { cap: 60000 }); store('IMP', 'EPS', { cap: 24000 });
    store('LOC', 'ACC', { cap: 8000 }); store('LOC', 'COIL', { cap: 80000 }); store('LOC', 'PWD', { cap: 6000 }); store('LOC', 'BRK', { cap: 20000 });
    store('SVC', 'ACC', { cap: 400 });
    // opening stock (lots by vendor)
    const vendLot = code => `${code.split('-')[0]}${MAT[code].src === 'import' ? 'I' : 'L'}`;
    const openQty = { OC: 0.55, BLU: 0.6, SMPS: 0.55, PCB: 0.6, CTN: 0.55, ACC: 0.6, RESIN: 0.6, EPS: 0.6, COIL: 0.55, PWD: 0.6, BRK: 0.6, BC: 0.45, STD: 0.45, CHS: 0.45, PBA: 0 };
    for (const st of ['IMP', 'LOC', 'INJ', 'PRS', 'SVC']) for (const code in STORE[st]) {
      const b = STORE[st][code]; if (b.items) continue;
      const k = st === 'SVC' ? 0.5 : openQty[code.split('-')[0]] || 0.5;
      const q = Math.round(b.cap * k);
      addLot(b, lotId(vendLot(code)), Math.round(q * 0.4), { src: MAT[code].vendor || 'Plant' });
      addLot(b, lotId(vendLot(code)), q - Math.round(q * 0.4), { src: MAT[code].vendor || 'Plant' });
    }
    // silos and hall stores fed by forklifts
    const SILO = {
      RESIN: buf('SILO:RESIN', { code: 'RESIN', label: 'Resin silo · injection', cap: 8000, rop: 3000, batch: 2000, src: 'IMP:RESIN', unit: 'kg' }),
      EPS: buf('SILO:EPS', { code: 'EPS', label: 'EPS bead silo · cushions', cap: 3000, rop: 1100, batch: 800, src: 'IMP:EPS', unit: 'kg' }),
      COIL: buf('HALL:COIL', { code: 'COIL', label: 'Coil store · press', cap: 20000, rop: 7000, batch: 5000, src: 'LOC:COIL', unit: 'kg' }),
      PWD: buf('HALL:PWD', { code: 'PWD', label: 'Powder store · coating', cap: 900, rop: 300, batch: 300, src: 'LOC:PWD', unit: 'kg' }),
      BRK: buf('HALL:BRK', { code: 'BRK', label: 'Bracket store · sub-assembly', cap: 3000, rop: 1000, batch: 1200, src: 'LOC:BRK' })
    };
    for (const b of Object.values(SILO)) { const src = P.bufs[b.src]; moveLots(src, b, b.cap * 0.7); }

    /* ----- lines and stations ----- */
    function station(id, name, line, kind, x, z, o) {
      const K = KIND[kind];
      const s = Object.assign({
        id, name, line, kind, idx: 0, x, z, w: K.w, d: K.d, h: K.h, slots: 1, factor: 1, base: 0, procs: [], state: 'idle', since: 0, why: '',
        health: rnd(86, 99), degrade: 0, repair: 0, tech: null, counters: { run: 0, idle: 0, starved: 0, blocked: 0, down: 0, made: 0, bad: 0, std: 0, brk: 0, pm: 0, co: 0, micro: 0 },
        sens: {}, hist: {}, kwNow: 0, speedMul: 1, needs: [], manual: false, operator: null, staff: 1, mtbf: rnd(14, 30) * 3600, micro: 0
      }, o);
      P.stations.push(s); P.byId[id] = s;
      if (P.lines[line]) P.lines[line].stations.push(s);
      return s;
    }
    function lineRec(id, name, kind, model, o) {
      const L = Object.assign({ id, name, kind, model, stations: [], speed: 1, oee: 0.86, avail: 0.92, perf: 0.95, qual: 0.99, tph: 0, state: 'run', made: 0, tripped: false, co: 0 }, o);
      P.lines[id] = L; return L;
    }
    // flow line builder: stations placed left to right with a gap
    function flowLine(L, x0, z, gap, defs) {
      let x = x0;
      defs.forEach(([name, kind, factor, o], i) => {
        const K = KIND[kind];
        const s = station(`${L.id}-${name.replace(/\W+/g, '')}`, name, L.id, kind, x + K.w / 2, z, Object.assign({ idx: i, factor }, o));
        x += K.w + gap; void s;
      });
      return L;
    }
    const AGE = 20 * 60;
    for (let i = 0; i < 6; i++) {
      const z = LINE_Z[i], m = START_MODELS[i];
      const ML = lineRec(`ML${i + 1}`, `Main line ${i + 1}`, 'main', m, { pair: i });
      flowLine(ML, 112, z, 4.4, [
        ['LCM input', 'robot', 0.84], ['PBA and SMPS', 'bench', 0.95, { manual: true, staff: 2 }], ['Back cover', 'robot', 0.9],
        ['Screw and stand', 'robot', 0.86], ['Function test', 'fct', 0.9], ['Aging', 'aging', 1, { slots: 60, ageing: AGE }],
        ['White balance', 'wb', 0.88], ['Final QA', 'qa', 0.94, { manual: true, staff: 2 }], ['Packing', 'packer', 0.97, { manual: true, staff: 3 }], ['Palletizer', 'palletizer', 0.55]
      ]);
      const LC = lineRec(`LCM${i + 1}`, `LCM line ${i + 1}`, 'lcm', m, { pair: i });
      flowLine(LC, 58, z, 8, [['Open cell load', 'lcmload', 0.82], ['BLU assembly', 'blu', 0.86, { manual: true, staff: 3 }], ['Module bonding', 'bond', 0.88], ['Lighting test', 'lighting', 0.85]]);
      const SM = lineRec(`SMD${i + 1}`, `SMD line ${i + 1}`, 'smd', SMD_MODELS[i], { pair: i });
      flowLine(SM, 112, SMD_Z[i], 1.8, [['Loader', 'loader', 0, { base: 6 }], ['Printer', 'printer', 0, { base: 10 }], ['SPI', 'spi', 0, { base: 9 }], ['Mounter A', 'mounter', 0, { base: 10.5 }],
        ['Mounter B', 'mounter', 0, { base: 10.5 }], ['Mounter C', 'mounter', 0, { base: 10.5 }], ['Reflow', 'reflow', 0, { base: 10.5, slots: 22 }], ['AOI', 'aoi', 0, { base: 9 }], ['Unloader', 'unloader', 0, { base: 6 }]]);
      // PBA: software download and in-circuit / function test
      station(`${SM.id}-SWdownload`, 'SW download', SM.id, 'writer', 153.2, SMD_Z[i], { idx: 9, base: 8, slots: 4 });
      station(`${SM.id}-ICTFCT`, 'ICT and FCT', SM.id, 'ict', 160.5, SMD_Z[i], { idx: 10, base: 9.5 });
      // cushion machine beside packing
      const pk = P.byId[`ML${i + 1}-Packing`];
      lineRec(`CUS${i + 1}`, `Cushion machine ${i + 1}`, 'cushion', m, { pair: i });
      station(`CUS${i + 1}-EPS`, `Cushion machine ${i + 1}`, `CUS${i + 1}`, 'cushion', pk.x - 1, z + 3.6, { base: 84, batchOut: 4 });
    }
    // twenty injection machines in two rows of ten
    const INJ = lineRec('INJ', 'Injection moulding', 'injection', null);
    for (let k = 0; k < 20; k++) {
      const col = k < 10 ? 0 : 1, r = k % 10;
      const part = INJ_PART[k];
      station(`IM${pad(k + 1, 2)}`, `IM${pad(k + 1, 2)}`, 'INJ', 'injection', col ? 33.1 : 10.1, 47 + r * 7.5, { part, base: INJ_CYCLE[part], batchOut: INJ_CAV[part], mold: `MD-${part}-${(k % 3) + 1}`, shots: Math.round(rnd(12000, 90000)), mtbf: rnd(20, 40) * 3600 });
    }
    INJ.stations.find(s => s.id === 'IM20').spare = true;
    // six press, coating and sub-assembly lines
    for (let k = 0; k < 6; k++) {
      const PL = lineRec(`PR${k + 1}`, `Press line ${k + 1}`, 'press', `M${PRESS_SIZE[k]}`, { size: PRESS_SIZE[k] });
      const z = PRESS_Z[k];
      station(`PR${k + 1}-Press`, 'Press', PL.id, 'press', 9.5, z, { idx: 0, factor: 0, base: 14, batchOut: 1 });
      station(`PR${k + 1}-Coating`, 'Coating oven', PL.id, 'oven', 34, z, { idx: 1, factor: 0, base: 15, slots: 96, batchOut: 1 });
      station(`PR${k + 1}-Subassy`, 'Sub-assembly', PL.id, 'subassy', 62, z, { idx: 2, factor: 0, base: 18, batchOut: 1, manual: true, staff: 2 });
      buf(`WIP:PR${k + 1}:stamped`, { label: 'Stamped parts', cap: 140, code: `CHS-${PRESS_SIZE[k]}` });
      buf(`WIP:PR${k + 1}:coated`, { label: 'Coated parts', cap: 140, code: `CHS-${PRESS_SIZE[k]}` });
    }
    // support stations
    const REWORK = station('REWORK', 'Rework benches', 'SUP', 'repair', 192, 126.2, { base: 300, slots: 3, manual: true, mtbf: 9e9 });
    const SMTREP = station('SMTREP', 'PBA repair bench', 'SUP', 'repair', 166, 33, { base: 360, manual: true, mtbf: 9e9 });

    /* ----- needs: what each station consumes ----- */
    const LS = {};    // line-side buffers
    function lsBuf(key, s, code, o) {
      const b = buf(`LS:${key}`, Object.assign({ station: s.id, line: s.line, code, label: MAT[code] ? MAT[code].name : code }, o));
      LS[key] = b; return b;
    }
    for (let i = 1; i <= 6; i++) {
      const ML = P.lines['ML' + i], m = ML.model, s = SIZE(m);
      const st = n => P.byId[`ML${i}-${n}`];
      ML.ls = {
        PBA: lsBuf(`ML${i}:PBA`, st('PBAandSMPS'), 'PBA-' + s, { items: [], cap: 60, rop: 24, batch: 36, src: 'PBA:PBA-' + s, feed: 'agv' }),
        SMPS: lsBuf(`ML${i}:SMPS`, st('PBAandSMPS'), 'SMPS-' + s, { cap: 160, rop: 70, batch: 120, src: 'IMP:SMPS-' + s, feed: 'T' + (i <= 3 ? 1 : 2) }),
        BC: lsBuf(`ML${i}:BC`, st('Backcover'), 'BC-' + s, { cap: 90, rop: 40, batch: 60, src: 'INJ:BC-' + s, feed: 'T' + (i <= 3 ? 1 : 2) }),
        CHS: lsBuf(`ML${i}:CHS`, st('Backcover'), 'CHS-' + s, { cap: 90, rop: 40, batch: 60, src: 'PRS:CHS-' + s, feed: 'T' + (i <= 3 ? 1 : 2) }),
        STD: lsBuf(`ML${i}:STD`, st('Screwandstand'), MODELS[m].stand, { cap: 120, rop: 50, batch: 80, src: 'INJ:' + MODELS[m].stand, feed: 'T' + (i <= 3 ? 1 : 2) }),
        CUS: lsBuf(`ML${i}:CUS`, st('Packing'), 'CUS-' + s, { cap: 60, rop: 0, batch: 0, src: 'conv', feed: 'conveyor' }),
        CTN: lsBuf(`ML${i}:CTN`, st('Packing'), 'CTN-' + s, { cap: 160, rop: 70, batch: 110, src: 'LOC:CTN-' + s, feed: 'T3' }),
        ACC: lsBuf(`ML${i}:ACC`, st('Packing'), 'ACC', { cap: 220, rop: 90, batch: 150, src: 'LOC:ACC', feed: 'T3' })
      };
      st('PBAandSMPS').needs = [{ k: 'PBA', as: 'pba' }, { k: 'SMPS', as: 'smps' }];
      st('Backcover').needs = [{ k: 'BC', as: 'bc' }, { k: 'CHS', as: 'chs' }];
      st('Screwandstand').needs = [{ k: 'STD', as: 'std' }];
      st('Packing').needs = [{ k: 'CUS', as: 'cus' }, { k: 'CTN', as: 'ctn' }, { k: 'ACC', as: 'acc' }];
      for (const n of P.stations.filter(x => x.line === ML.id)) n.needs = n.needs.map(q => Object.assign(q, { b: ML.ls[q.k] }));
      const LC = P.lines['LCM' + i];
      LC.ls = {
        OC: lsBuf(`LCM${i}:OC`, P.byId[`LCM${i}-Opencellload`], 'OC-' + s, { cap: 120, rop: 50, batch: 80, src: 'IMP:OC-' + s, feed: 'T4' }),
        BLU: lsBuf(`LCM${i}:BLU`, P.byId[`LCM${i}-BLUassembly`], 'BLU-' + s, { cap: 120, rop: 50, batch: 80, src: 'IMP:BLU-' + s, feed: 'T4' })
      };
      P.byId[`LCM${i}-Opencellload`].needs = [{ k: 'OC', as: 'oc', b: LC.ls.OC }];
      P.byId[`LCM${i}-BLUassembly`].needs = [{ k: 'BLU', as: 'blu', b: LC.ls.BLU }];
      const SM = P.lines['SMD' + i], ss = SIZE(SM.model);
      SM.ls = { PCB: lsBuf(`SMD${i}:PCB`, P.byId[`SMD${i}-Loader`], 'PCB-' + ss, { cap: 220, rop: 80, batch: 140, src: 'LOC:PCB-' + ss, feed: 'T5' }) };
      P.byId[`SMD${i}-Loader`].needs = [{ k: 'PCB', as: 'pcb', b: SM.ls.PCB }];
    }
    // opening line-side stock from the stores
    for (const b of Object.values(LS)) {
      if (b.src === 'conv') { addLot(b, lotId('CU' + b.line.slice(2)), 30, { src: 'Cushion machine ' + b.line.slice(2) }); continue; }
      const src = P.bufs[b.src];
      if (b.items) continue;
      moveLots(src, b, Math.round(b.cap * rnd(0.55, 0.9)));
    }

    /* ----- conveyors ----- */
    function seg(from, to, path, speed, pitch, o) {
      const s = Object.assign({ id: `${from ? from.id : 'SRC'}>${to ? to.id : 'SINK'}`, from, to, path, len: polyLen(path), speed, pitch, items: [] }, o);
      P.segs.push(s);
      if (from) from.outSeg = s;
      if (to) (to.inSegs = to.inSegs || []).push(s);
      return s;
    }
    const exitPt = s => [s.x + s.w / 2, s.z], entryPt = s => [s.x - s.w / 2, s.z];
    for (const L of Object.values(P.lines)) {
      if (!['main', 'lcm', 'smd'].includes(L.kind)) continue;
      const st = L.stations;
      const smd = L.kind === 'smd';
      for (let i = 0; i < st.length - 1; i++) seg(st[i], st[i + 1], [exitPt(st[i]), entryPt(st[i + 1])], smd ? 0.32 : 0.3, smd ? 0.36 : L.kind === 'lcm' ? 1.6 : 1.7);
    }
    // LCM → main line, over a bridge across the aisle
    for (let i = 1; i <= 6; i++) {
      const a = P.byId[`LCM${i}-Lightingtest`], b = P.byId[`ML${i}-LCMinput`];
      seg(a, b, [exitPt(a), entryPt(b)], 0.35, 1.7, { bridge: [105.8, 108.2] });
    }

    /* ----- aisles, stops and routing ----- */
    const AISLES = [
      { a: [2, 40], b: [262, 40] }, { a: [2, 125], b: [262, 125] },
      { a: [53, 2], b: [53, 166] }, { a: [107, 2], b: [107, 166] }, { a: [204, 2], b: [204, 166] }, { a: [21.5, 40], b: [21.5, 125] },
      { a: [53, 22], b: [107, 22] }, { a: [2, 19], b: [53, 19] }
    ];
    for (const z of [55, 69, 83, 97, 111]) AISLES.push({ a: [53, z], b: [204, z] });
    // the aisles between the finished-goods racks are for the forklift working that row: routing counts them 2.5 times their
    // length, so through traffic keeps to the main aisles around the racks
    for (let r = 0; r < 13; r++) AISLES.push({ a: [204, 49 + r * 6], b: [261, 49 + r * 6], rack: r });
    AISLES.push({ a: [261, 49], b: [261, 121] });
    const nodes = P.nodes, edges = P.edges;
    const nodeAt = (x, z) => { let n = nodes.find(n => Math.abs(n.x - x) < 0.05 && Math.abs(n.z - z) < 0.05); if (!n) { n = { id: nodes.length, x, z, adj: [] }; nodes.push(n); } return n; };
    const aislePts = AISLES.map(() => []);
    const CROSS = new Map();   // aisle crossings, each held by at most one vehicle at a time
    AISLES.forEach((A, i) => AISLES.forEach((B, j) => {
      if (i >= j) return;
      const ah = A.a[1] === A.b[1], bh = B.a[1] === B.b[1]; if (ah === bh) return;
      const H = ah ? A : B, V = ah ? B : A, x = V.a[0], z = H.a[1];
      if (x >= Math.min(H.a[0], H.b[0]) - 0.01 && x <= Math.max(H.a[0], H.b[0]) + 0.01 && z >= Math.min(V.a[1], V.b[1]) - 0.01 && z <= Math.max(V.a[1], V.b[1]) + 0.01) { aislePts[i].push([x, z]); aislePts[j].push([x, z]); CROSS.set(x.toFixed(1) + ',' + z.toFixed(1), { x, z, by: null }); }
    }));
    const STOPS = {};
    function stop(key, x, z) {
      let best = null;
      AISLES.forEach((A, i) => {
        const h = A.a[1] === A.b[1];
        const px = h ? clamp(x, Math.min(A.a[0], A.b[0]), Math.max(A.a[0], A.b[0])) : A.a[0];
        const pz = h ? A.a[1] : clamp(z, Math.min(A.a[1], A.b[1]), Math.max(A.a[1], A.b[1]));
        const d = Math.hypot(px - x, pz - z); if (!best || d < best.d) best = { d, i, px, pz };
      });
      aislePts[best.i].push([best.px, best.pz]);
      STOPS[key] = { x, z, ax: best.px, az: best.pz };
    }
    // where each buffer sits on the floor (used for routing and drawing)
    const POS = {};
    const pos = (id, x, z) => { POS[id] = [x, z]; };
    const impCodes = Object.keys(STORE.IMP), locCodes = Object.keys(STORE.LOC);
    impCodes.forEach((c, k) => pos('IMP:' + c, 7 + (k % 7) * 6.2, k < 7 ? 13 : 25));
    locCodes.forEach((c, k) => pos('LOC:' + c, 60 + (k % 6) * 7.6, k < 6 ? 16 : 28));
    ['BC-43', 'BC-55', 'BC-65', 'BC-75', 'STD-S', 'STD-L'].forEach((c, k) => pos('INJ:' + c, 47, 50 + k * 12));
    ['CHS-43', 'CHS-55', 'CHS-65', 'CHS-75'].forEach((c, k) => pos('PRS:' + c, 76 + k * 7.5, 128.6));
    ['PBA-43', 'PBA-55', 'PBA-65', 'PBA-75'].forEach((c, k) => pos('PBA:' + c, 171 + k * 7.5, 34.4));
    ['PBA-43', 'PBA-55', 'PBA-65', 'PBA-75', 'BC-43', 'BC-55', 'BC-65', 'BC-75', 'ACC'].forEach((c, k) => pos('SVC:' + c, 212 + (k % 5) * 9.5, k < 5 ? 136 : 150));
    pos('SILO:RESIN', 21.5, 43.5); pos('SILO:EPS', 152, 130.5); pos('HALL:COIL', 6, 128.6); pos('HALL:PWD', 20, 128.6); pos('HALL:BRK', 62, 128.6);
    for (const b of Object.values(LS)) {
      const s = P.byId[b.station];
      const off = { PBA: -0.9, SMPS: 0.9, BC: -0.9, CHS: 0.9, STD: 0, CUS: 0, CTN: -1.1, ACC: 1.1, OC: 0, BLU: 0, PCB: 0 }[b.id.split(':')[2]] || 0;
      if (b.id.includes(':PCB')) pos(b.id, s.x - s.w / 2 - 1.6, s.z);
      else if (b.id.includes(':CUS')) pos(b.id, s.x + 1.6, s.z + 2.2);
      else pos(b.id, s.x + off, s.z - s.d / 2 - 1.3);
    }
    for (const id in POS) stop(id, POS[id][0], POS[id][1]);
    for (let i = 0; i < 8; i++) stop('PARK-A' + i, 110 + i * 2.6, 37.2);
    for (let i = 0; i < 6; i++) stop('PARK-F' + i, 207 + i * 3, 122.6);
    for (let i = 0; i < 3; i++) stop('PARK-W' + i, 56 + i * 3, 37.2);
    for (let i = 0; i < 5; i++) stop('PARK-T' + i, 112 + i * 9, 122.6);
    AISLES.forEach((A, i) => {
      const h = A.a[1] === A.b[1];
      const pts = aislePts[i].concat([A.a, A.b]).sort((p, q) => (h ? p[0] - q[0] : p[1] - q[1]));
      let prev = null;
      for (const p of pts) { const n = nodeAt(p[0], p[1]); if (prev && prev !== n) { const w = Math.hypot(prev.x - n.x, prev.z - n.z) * (A.rack != null ? 2.5 : 1); prev.adj.push([n.id, w]); n.adj.push([prev.id, w]); edges.push([prev.id, n.id]); } prev = n; }
    });
    for (const k in STOPS) { const S = STOPS[k], a = nodeAt(S.ax, S.az), n = nodeAt(S.x, S.z); if (a !== n) { const w = Math.hypot(a.x - n.x, a.z - n.z); a.adj.push([n.id, w]); n.adj.push([a.id, w]); edges.push([a.id, n.id]); } S.node = n.id; }
    const nodeDist = new Map();
    function route(fromId, toId) {
      const N = nodes.length, Dd = new Float64Array(N).fill(Infinity), prev = new Int32Array(N).fill(-1), done = new Uint8Array(N);
      Dd[fromId] = 0;
      for (;;) {
        let u = -1, best = Infinity;
        for (let i = 0; i < N; i++) if (!done[i] && Dd[i] < best) { best = Dd[i]; u = i; }
        if (u < 0 || u === toId) break;
        done[u] = 1;
        for (const [v, w] of nodes[u].adj) if (Dd[u] + w < Dd[v]) { Dd[v] = Dd[u] + w; prev[v] = u; }
      }
      const path = []; for (let v = toId; v >= 0; v = prev[v]) { path.unshift([nodes[v].x, nodes[v].z]); if (v === fromId) break; }
      nodeDist.set(fromId + '>' + toId, Dd[toId]);
      return path;
    }
    const nearestNode = (x, z) => { let b = 0, bd = Infinity; for (const n of nodes) { const d = (n.x - x) ** 2 + (n.z - z) ** 2; if (d < bd) { bd = d; b = n.id; } } return b; };

    /* ----- vehicles: AGVs (boards), milk-run trains, forklifts ----- */
    function vehicle(kind, id, park, o) {
      const n = nodes[STOPS[park].node];
      return Object.assign({ kind, id, x: n.x, z: n.z, h: 0, node: n.id, home: n.id, path: null, s: 0, len: 0, v: 0, vmax: kind === 'tugger' ? 1.5 : kind === 'forklift' ? 2.4 : 1.4,
        battery: rnd(55, 96), mission: null, phase: 'idle', load: null, state: 'idle', km: rnd(4, 20), fault: null, waitT: 0, idleT: 0 }, o);
    }
    for (let i = 0; i < 8; i++) P.agvs.push(vehicle('agv', `AGV-${pad(i + 1, 2)}`, 'PARK-A' + i));
    const TROUTE = {
      T1: { name: 'Main lines 1–3', serves: k => /^LS:ML[123]:(SMPS|BC|CHS|STD)$/.test(k) },
      T2: { name: 'Main lines 4–6', serves: k => /^LS:ML[456]:(SMPS|BC|CHS|STD)$/.test(k) },
      T3: { name: 'Packing materials', serves: k => /^LS:ML\d:(CTN|ACC)$/.test(k) },
      T4: { name: 'LCM lines', serves: k => /^LS:LCM\d:(OC|BLU)$/.test(k) },
      T5: { name: 'SMD lines', serves: k => /^LS:SMD\d:PCB$/.test(k) }
    };
    Object.keys(TROUTE).forEach((id, i) => P.tuggers.push(vehicle('tugger', `Milk run ${id}`, 'PARK-T' + i, { route: id, routeName: TROUTE[id].name, carts: 3, laps: 0, plan: null, stopIdx: 0, lapStart: START - rnd(0, 600), lapLen: 1200 })));
    for (let i = 0; i < 9; i++) P.forklifts.push(vehicle('forklift', `FL-${pad(i + 1, 2)}`, i < 6 ? 'PARK-F' + i : 'PARK-W' + (i - 6), { role: i < 6 ? 'fg' : 'wh' }));
    const VEH = () => P.agvs.concat(P.tuggers, P.forklifts);

    function drive(a, toNode, endPt) {
      const from = a.path ? nearestNode(a.x, a.z) : (a.node != null ? a.node : nearestNode(a.x, a.z));
      // a forklift nosed into a pallet slot backs out to the middle of the aisle first
      if (a.slotExit) { a.path = route(nearestNode(a.slotExit[0], a.slotExit[1]), toNode); a.path.unshift(a.slotExit); a.slotExit = null; }
      else a.path = route(from, toNode);
      a.path.unshift([a.x, a.z]);
      if (endPt) { if (Array.isArray(endPt[0])) a.path.push(...endPt); else a.path.push(endPt); }
      a.len = polyLen(a.path); a.s = 0; a.target = toNode; a.waitT = 0; a.idleT = 0;
    }
    function driveTo(a, key) { drive(a, STOPS[key].node); }
    // a parked vehicle turns to lie along the aisle, so it stays out of the traffic lane
    function settle(a, dt) {
      if (a.path || a.node !== a.home) return;
      let d = Math.atan2(Math.sin(-a.h), Math.cos(-a.h)); if (Math.abs(d) > Math.PI / 2) d = Math.atan2(Math.sin(Math.PI - a.h), Math.cos(Math.PI - a.h));
      a.h += clamp(d, -dt * 0.8, dt * 0.8);
    }
    function moveStep(a, dt) {
      if (a.fault) { a.v = 0; a.state = 'fault'; return false; }
      if (a.waitT > 0) { a.waitT -= dt; a.v = 0; return false; }
      if (!a.path) return false;
      // keep a safe gap: stop for any vehicle in this lane ahead closer than the two half-lengths plus a metre.
      // A vehicle standing still in the lane (loading, waiting at a stop) is overtaken on the left once the other lane is clear;
      // when two wait on each other the one with the lower id goes, and nobody waits longer than 20 s
      const ch = Math.cos(a.h), sh = Math.sin(a.h), half = v => (v.kind === 'tugger' ? 2.9 : v.kind === 'forklift' ? 1.3 : v.kind === 'person' ? 0.4 : 0.85);
      const still = o => !o.path || o.waitT > 0 || o.v < 0.05;
      let by = null, byLat = 0, oncL = false, oncR = false;
      a.passT = Math.max(0, (a.passT || 0) - dt);
      // a visitor walking the floor in the 3D view (P.walker) is an obstacle too: vehicles stop for people
      for (const o of P.walker ? VEH().concat(P.walker) : VEH()) {
        if (o === a || Math.abs(o.x - a.x) > 16 || Math.abs(o.z - a.z) > 16) continue;
        const dx = o.x - a.x, dz = o.z - a.z, ahead = dx * ch + dz * sh, lat = -dx * sh + dz * ch;
        if (ahead > -2 && ahead < 14 && Math.abs(lat) > 0.6 && Math.abs(lat) < 3.2) { if (lat < 0) oncL = true; else oncR = true; }
        if (by || a.blockT > 20 || (o.blockBy === a.id && a.id < o.id)) continue;
        // the other vehicle's front, middle and back: a long milk-run train crossing ahead blocks along its whole length
        const oc = Math.cos(o.h) * half(o), os = Math.sin(o.h) * half(o);
        for (const m of [0, 1, -1]) {
          const ex = dx + oc * m, ez = dz + os * m, ah = ex * ch + ez * sh, la = -ex * sh + ez * ch;
          if (ah > 0.2 && ah < half(a) + (m ? 0.3 : half(o)) + 1 && Math.abs(la) < (m ? 0.95 : 1.3)) { by = o; byLat = lat; break; }
        }
      }
      // overtake on the side away from the stopped vehicle: left of the centre line, or further right when it stands on the left
      // (never one that stands at this vehicle's own destination: that one is waited for)
      const end = a.path[a.path.length - 1];
      if (by && still(by) && (a.blockT || 0) > 1.5 && !a.passT && Math.hypot(by.x - end[0], by.z - end[1]) > 4.5) {
        const lane = byLat + (-(a.lx || 0) * sh + (a.lz || 0) * ch) > 0 ? -0.95 : 1.6;
        if (!(lane < 0 ? oncL : oncR)) { a.passT = 9; a.passLane = lane; }
      }
      // an oncoming vehicle while overtaking: back into the own lane and let it by
      if (by && a.passT && Math.cos(by.h - a.h) < -0.5) a.passT = 0;
      // crossings: the vehicle that reaches a crossing first holds it until its body is through; others wait before it
      let hold = false;
      if (!by) {
        const hr = half(a);
        for (const [k, J] of CROSS) if (J.by === a && Math.hypot(J.x - a.x, J.z - a.z) > hr + 2.6) J.by = null;
        let c = 0;
        for (let i = 1; i < a.path.length && c - a.s < hr + 3; i++) {
          c += dist(a.path[i - 1], a.path[i]);
          if (c < a.s - 0.5) continue;
          const J = CROSS.get(a.path[i][0].toFixed(1) + ',' + a.path[i][1].toFixed(1)); if (!J) continue;
          // a holder that has stood still for 6 s, or has stopped for good, no longer holds it, so no two vehicles lock each other
          const o = J.by;
          // (one on the same aisle, ahead or oncoming in its own lane, is handled by the gap and the lanes, not by the crossing)
          if (o && o !== a && o.path && (o.stuckT || 0) < 6 && Math.abs(Math.cos(o.h - a.h)) < 0.7 && Math.hypot(J.x - o.x, J.z - o.z) < half(o) + 2.6) { hold = true; break; }
          J.by = a; break;
        }
        // the place it is going to is taken by a vehicle standing there: wait a few metres short of it, off its way out
        const end = a.path[a.path.length - 1], left = a.len - a.s;
        if (!hold && left < 8 && left > 1.2 && (a.destT || 0) < 90) for (const o of VEH()) if (o !== a && still(o) && Math.hypot(o.x - end[0], o.z - end[1]) < 2.2) { hold = true; a.destT = (a.destT || 0) + dt; break; }
        if (!hold) a.destT = 0;
      }
      a.blockBy = by ? by.id : null;
      a.blockT = by ? (a.blockT || 0) + dt : a.blockT > 20 ? (a.blockT > 24 ? 0 : a.blockT + dt) : 0;
      a.v = by || hold ? 0 : ema(a.v, a.load ? a.vmax * 0.82 : a.vmax, Math.min(1, dt * 1.6));
      a.stuckT = a.v < 0.05 ? (a.stuckT || 0) + dt : 0;
      a.s = Math.min(a.len, a.s + a.v * dt);
      // keep right: vehicles drive 0.9 m right of the aisle centre line, so traffic in opposite directions passes side by side
      // (left while overtaking); the offset fades in after leaving a stop and out before the next one, and eases round corners
      const p = polyAt(a.path, a.s), lane = (a.passT ? a.passLane : 0.9) * clamp(Math.min(a.s, a.len - a.s) / 4, 0, 1), k = Math.min(1, dt * 2.5);
      a.lx = ema(a.lx || 0, -Math.sin(p[2]) * lane, k); a.lz = ema(a.lz || 0, Math.cos(p[2]) * lane, k);
      a.x = p[0] + a.lx; a.z = p[1] + a.lz; a.h = p[2];
      a.km += a.v * dt / 1000;
      if (a.kind === 'agv') a.battery = Math.max(0, a.battery - dt * (a.load ? 0.009 : 0.006));
      a.state = a.load ? 'carrying' : 'moving';
      if (a.s >= a.len - 0.01) { a.node = a.target; a.path = null; a.v = 0; a.lx = a.lz = 0; a.blockT = 0; a.blockBy = null; a.passT = 0; return true; }
      return false;
    }

    // AGV missions: PBA boards from the PBA supermarket to the main lines
    const missions = [];
    function createMission(b, prio, reason) {
      if (b.mission) return b.mission;
      const m = { id: 'M' + (++P.seq), buf: b, code: b.code, src: P.bufs[b.src], qty: b.batch, prio: prio || 1, reason: reason || 'Kanban', created: P.t, veh: null, eta: null, kind: b.feed === 'forklift' ? 'forklift' : 'agv' };
      missions.push(m); b.mission = m; b.pending = (b.pending || 0) + m.qty; return m;
    }
    function runway(b) { return b.rate > 1e-5 ? level(b) / b.rate : Infinity; }
    function dispatch() {
      const open = missions.filter(m => !m.veh).sort((a, b) => (b.prio - a.prio) || (runway(a.buf) - runway(b.buf)));
      for (const m of open) {
        const fleet = m.kind === 'forklift' ? P.forklifts.filter(f => f.role === 'wh') : P.agvs;
        const free = fleet.filter(a => !a.mission && !a.fault && !a.job && (a.kind !== 'agv' || a.battery > 22));
        if (!free.length) continue;
        const sn = STOPS[m.src.id].node;
        let best = null;
        for (const a of free) { const d = Math.hypot(nodes[sn].x - a.x, nodes[sn].z - a.z); if (!best || d < best.d) best = { a, d }; }
        assign(best.a, m);
      }
    }
    function assign(a, m) {
      m.veh = a; a.mission = m; a.phase = 'toPick'; a.idleT = 0;
      driveTo(a, m.src.id);
      m.eta = P.t + (a.len + polyLen(route(STOPS[m.src.id].node, STOPS[m.buf.id].node))) / (a.vmax * 0.85) + 50;
    }
    function missionArrived(a) {
      const m = a.mission; if (!m) return;
      if (a.phase === 'toPick') {
        const n = Math.min(m.qty, level(m.src));
        if (n <= 0) { a.waitT = 30; driveTo(a, m.src.id); return; }
        if (m.src.items) { a.load = { items: m.src.items.splice(0, n), qty: n, code: m.buf.code }; a.load.items.forEach(u => { u.loc = { k: 'veh', a }; }); }
        else { const tmp = { lots: [], qty: 0, items: null }; moveLots(m.src, tmp, n); a.load = { lots: tmp.lots, qty: tmp.qty, code: m.buf.code }; }
        a.loadSrc = m.src.id; a.phase = 'toDrop'; a.waitT = 10;
        driveTo(a, m.buf.id);
        emit('move', { from: m.src.id, to: m.buf.id, code: m.buf.code, qty: n, by: a.id });
      } else if (a.phase === 'toDrop') {
        // after a model changeover the load no longer fits this line: it goes back to the store it came from
        const b = m.code && m.code !== m.buf.code ? m.src : m.buf, L = a.load || { qty: 0 };
        if (b !== m.buf) log('WMS', `${a.id} returned ${m.code} to ${b.label || b.id}: ${P.lines[m.buf.line] ? P.lines[m.buf.line].name : 'the line'} changed model`);
        if (b !== m.buf) { if (b.items) { b.items.push(...(L.items || [])); (L.items || []).forEach(u => { u.loc = { k: 'store', b }; }); } else for (const l of L.lots || []) addLot(b, l.id, l.qty, { src: l.src }); }
        else if (b.items) { b.items.push(...(L.items || [])); (L.items || []).forEach(u => { u.loc = { k: 'ls', b }; u.steps.push({ st: b.station, name: 'Delivered by ' + a.id, line: b.line, t0: P.t, t1: P.t, ok: true, note: `To ${P.byId[b.station].name}, ${P.lines[b.line].name}` }); }); }
        else for (const l of L.lots || []) addLot(b, l.id, l.qty, { src: l.src });
        a.load = null; a.waitT = 8; m.buf.pending = Math.max(0, (m.buf.pending || 0) - m.qty); m.buf.mission = null;
        missions.splice(missions.indexOf(m), 1); a.mission = null; a.phase = 'idle';
        if (m.onDone) m.onDone();
      }
    }
    function agvStep(a, dt) {
      if (a.path) { if (moveStep(a, dt)) { if (a.mission) missionArrived(a); else if (a.phase === 'toPark') a.phase = 'idle'; } return; }
      if (a.waitT > 0) { a.waitT -= dt; return; }
      if (a.fault) { a.state = 'fault'; return; }
      settle(a, dt);
      a.state = a.kind === 'agv' && a.battery < 70 && a.node === a.home ? 'charging' : 'idle';
      if (a.state === 'charging') a.battery = Math.min(100, a.battery + dt * 0.1);
      a.idleT += dt;
      if (a.idleT > 15 && a.node !== a.home && !a.mission) { a.phase = 'toPark'; drive(a, a.home); }
    }

    // milk runs: a train collects for every kanban on its loop that is at or below its reorder point, then delivers
    function tuggerPlan(t) {
      const want = Object.values(LS).filter(b => TROUTE[t.route].serves(b.id) && level(b) + b.pending <= b.rop + (b.cap - b.rop) * 0.25);
      if (!want.length) return null;
      const loads = [];
      for (const b of want) { const need = Math.max(0, b.cap - level(b) - b.pending); if (need > 0) loads.push({ b, code: b.code, src: P.bufs[b.src], need, got: null }); }
      if (!loads.length) return null;
      const pickups = [...new Set(loads.map(l => l.src.id))].sort((a, b) => STOPS[a].z - STOPS[b].z || STOPS[a].x - STOPS[b].x);
      const drops = loads.map(l => l.b.id).sort((a, b) => STOPS[a].z - STOPS[b].z || STOPS[a].x - STOPS[b].x);
      for (const l of loads) l.b.pending = (l.b.pending || 0) + l.need;
      return { loads, stops: pickups.map(id => ({ id, kind: 'pick' })).concat(drops.map(id => ({ id, kind: 'drop' }))), started: P.t };
    }
    function tuggerStep(t, dt) {
      if (t.path) {
        if (!moveStep(t, dt)) return;
        const st = t.plan && t.plan.stops[t.stopIdx];
        if (st) {
          if (st.kind === 'pick') {
            for (const l of t.plan.loads.filter(l => l.src.id === st.id)) { const tmp = { lots: [], qty: 0 }; moveLots(l.src, tmp, Math.min(l.need, l.src.qty)); l.got = tmp; }
            t.load = { qty: t.plan.loads.reduce((a, l) => a + (l.got ? l.got.qty : 0), 0) };
            t.waitT = 25;
          } else {
            const l = t.plan.loads.find(l => l.b.id === st.id);
            if (l && l.got) { const to = l.code !== l.b.code ? l.src : l.b; for (const x of l.got.lots) addLot(to, x.id, x.qty, { src: x.src }); emit('move', { from: l.src.id, to: l.b.id, code: l.b.code, qty: l.got.qty, by: t.id }); }
            if (l) l.b.pending = Math.max(0, (l.b.pending || 0) - l.need);
            t.waitT = 18;
          }
          t.stopIdx++;
        }
        if (t.plan && t.stopIdx >= t.plan.stops.length) {
          t.laps++; t.lapLen = P.t - t.plan.started; t.plan = null; t.load = null; t.phase = 'return'; drive(t, t.home);
        }
        return;
      }
      if (t.waitT > 0) { t.waitT -= dt; t.state = 'stopped'; return; }
      if (t.fault) { t.state = 'fault'; return; }
      if (t.plan && t.stopIdx < t.plan.stops.length) { driveTo(t, t.plan.stops[t.stopIdx].id); t.phase = t.plan.stops[t.stopIdx].kind === 'pick' ? 'picking' : 'delivering'; return; }
      settle(t, dt);
      // the loop starts on its timetable (every 12 minutes) or earlier when a kanban is urgent
      t.state = 'idle';
      const due = P.t - t.lapStart >= 720 || Object.values(LS).some(b => TROUTE[t.route].serves(b.id) && level(b) <= b.rop * 0.6 && !b.pending);
      if (due) { const plan = tuggerPlan(t); t.lapStart = P.t; if (plan) { t.plan = plan; t.stopIdx = 0; } }
    }
    function nextLap(b) {
      const t = P.tuggers.find(t => TROUTE[t.route].serves(b.id)); if (!t) return Infinity;
      if (t.plan) { const st = t.plan.stops.findIndex(s => s.id === b.id); if (st >= t.stopIdx) return 120 + (st - t.stopIdx) * 60; }
      return Math.max(0, 720 - (P.t - t.lapStart)) + 360;
    }

    // warehouse forklifts refill the silos and hall stores; finished-goods forklifts store pallets and load trucks
    // Traffic rules of the finished-goods store, as in a real warehouse: one forklift at a time in each rack aisle, and two
    // loading bays at each dock, 4 m apart. A forklift only takes a job whose row and bay are free, and keeps them until it has
    // driven out of them.
    const DROP_X = 257.8;   // where a forklift sets a pallet down for the truck: clear of the racks and of the dock-side aisle
    const rowZ = r => 49 + r * 6;
    const inRow = (f, r) => f.x > 205.5 && f.x < 259 && Math.abs(f.z - rowZ(r)) < 3.2;
    const bayZ = b => b.dock.z + (b.n ? 2 : -2);
    const atBay = (f, b) => Math.hypot(f.x - DROP_X, f.z - bayZ(b)) < 3;
    const takenRows = f => new Set(P.forklifts.filter(o => o !== f && o.rowLock != null).map(o => o.rowLock));
    // a free bay at this dock, or null
    const freeBay = (f, d) => { const used = P.forklifts.filter(o => o !== f && o.dockLock && o.dockLock.dock === d).map(o => o.dockLock.n); return [0, 1].filter(n => !used.includes(n)).map(n => ({ dock: d, n }))[0] || null; };
    function release(f) {
      const j = f.job;
      if (f.rowLock != null && !inRow(f, f.rowLock) && !(j && ((j.slot && j.slot.row === f.rowLock) || (j.pallet && j.pallet.slot && j.pallet.slot.row === f.rowLock && j.phase === 'toPallet')))) f.rowLock = null;
      if (f.dockLock && !atBay(f, f.dockLock) && !(j && j.truck && j.truck.dock === f.dockLock.dock)) f.dockLock = null;
    }
    function forkliftStep(f, dt) {
      if (f.role === 'wh') { agvStep(f, dt); return; }
      release(f);
      if (f.path) {
        if (!moveStep(f, dt)) return;
        f.waitT = 6; return;
      }
      if (f.waitT > 0) { f.waitT -= dt; return; }
      const j = f.job;
      if (!j) {
        // a palletizer with two finished pallets waiting stops its line: clear it first; a waiting truck takes it straight
        const lineFull = P.pallets.find(p => p.where === 'pickup' && !p.claimed && P.pallets.filter(q => q.where === 'pickup' && q.line === p.line).length >= 2);
        const rows = takenRows(f);
        const loading = P.trucks.filter(t => t.state === 'loading' && t.need > t.claimed && freeBay(f, t.dock));
        const direct = (lineFull && loading.find(t => t.model === lineFull.model)) ? lineFull : !lineFull && P.pallets.find(p => p.where === 'pickup' && !p.claimed && loading.some(t => t.model === p.model && t.need - t.claimed >= p.units.length));
        if (direct) { const tr = loading.find(t => t.model === direct.model); direct.claimed = true; tr.claimed += direct.units.length; f.job = { kind: 'load', pallet: direct, truck: tr, phase: 'toPallet', direct: true }; f.dockLock = freeBay(f, tr.dock); goPoint(f, [direct.x + 1.6, direct.z]); return; }
        const free = p => p.where === 'fg' && !p.claimed && !rows.has(p.slot.row);
        const tr = !lineFull && loading.find(t => P.pallets.some(p => free(p) && p.model === t.model));
        const pal = tr && P.pallets.filter(p => free(p) && p.model === tr.model).sort((a, b) => a.built - b.built)[0];
        if (tr && pal) { pal.claimed = true; tr.claimed += pal.units.length; f.job = { kind: 'load', pallet: pal, truck: tr, phase: 'toPallet' }; f.rowLock = pal.slot.row; f.dockLock = freeBay(f, tr.dock); goSlot(f, pal.slot); return; }
        const fresh = lineFull || P.pallets.find(p => p.where === 'pickup' && !p.claimed);
        if (fresh) { const slot = P.fgSlots.find(s => !s.p && !rows.has(s.row)); if (slot) { fresh.claimed = true; slot.p = fresh; f.job = { kind: 'store', pallet: fresh, slot, phase: 'toPallet' }; f.rowLock = slot.row; goPoint(f, [fresh.x + 1.6, fresh.z]); return; } }
        f.state = 'idle'; f.idleT += dt; settle(f, dt);
        if (f.idleT > 20 && f.node !== f.home) { drive(f, f.home); }
        return;
      }
      f.idleT = 0;
      if (j.phase === 'toPallet') {
        f.load = j.pallet; j.pallet.where = 'fork';
        if (j.kind === 'store') { j.phase = 'toSlot'; goSlot(f, j.slot); }
        else { if (j.pallet.slot) j.pallet.slot.p = null; j.phase = 'toTruck'; goPoint(f, [DROP_X, bayZ(f.dockLock)]); }
      } else if (j.phase === 'toSlot') {
        j.pallet.where = 'fg'; j.pallet.slot = j.slot; j.pallet.claimed = false; j.pallet.x = j.slot.x; j.pallet.z = j.slot.z; f.load = null; f.job = null;
      } else if (j.phase === 'toTruck') {
        const tr = j.truck; tr.pallets.push(j.pallet); j.pallet.where = 'truck'; j.pallet.truck = tr; tr.loaded += j.pallet.units.length;
        j.pallet.units.forEach(u => { u.order = tr.order.id; u.truck = tr.id; u.shippedAt = P.t; });
        f.load = null; f.job = null;
        if (tr.loaded >= tr.need) truckDepart(tr);
      }
    }
    function goPoint(f, pt) { drive(f, nearestNode(pt[0], pt[1]), pt); f.target = nearestNode(pt[0], pt[1]); }
    // into a pallet slot the forklift runs down the aisle to the slot, then turns and noses in, forks to the pallet
    function goSlot(f, slot) { const a = [slot.x, slot.z + 3], n = nearestNode(a[0], a[1]); drive(f, n, [a, [slot.x, slot.z + 1.85]]); f.target = n; f.slotExit = a; }

    /* ----- finished goods, docks, trucks and inbound ----- */
    for (let r = 0; r < 13; r++) for (let i = 0; i < 18; i++) P.fgSlots.push({ x: 210 + i * 2.7, z: 46 + r * 6, p: null, row: r });
    const DOCKS = [52, 65, 78, 91, 104, 117].map((z, i) => ({ id: `Dock ${i + 1}`, x: 264, z, truck: null }));
    const INDOCK = [{ id: 'Import door 1', x: 0, z: 10, side: 'w', area: 'IMP' }, { id: 'Import door 2', x: 0, z: 26, side: 'w', area: 'IMP' },
      { id: 'Vendor door 1', x: 66, z: 0, side: 'n', area: 'LOC' }, { id: 'Vendor door 2', x: 82, z: 0, side: 'n', area: 'LOC' }, { id: 'Vendor door 3', x: 98, z: 0, side: 'n', area: 'LOC' }];
    P.docks = DOCKS; P.indocks = INDOCK;
    let truckSeq = 0;
    function truckArrive(o) {
      const dock = DOCKS.find(d => !d.truck); if (!dock) return false;
      const tr = { id: 'TRK-' + (410 + (++truckSeq)), order: o, model: o.model, need: o.qty - o.shipped, loaded: 0, claimed: 0, pallets: [], dock, state: 'arriving', k: 0, arrived: P.t };
      dock.truck = tr; o.truck = tr; o.state = 'loading'; P.trucks.push(tr);
      log('Shipping', `${tr.id} at ${dock.id} for ${o.id} (${o.customer}) · ${tr.need} × ${MODELS[o.model].name}`);
      emit('truck', tr); return true;
    }
    function truckDepart(tr) {
      if (tr.state === 'leaving') return;
      tr.state = 'leaving'; tr.k = 1;
      const o = tr.order; o.shipped += tr.loaded; const late = P.t > o.due;
      o.state = o.shipped >= o.qty ? (late ? 'late' : 'shipped') : 'partial'; o.shippedAt = P.t;
      log('Shipping', `${tr.id} left ${tr.dock.id} · ${o.id} ${o.state === 'shipped' ? 'shipped on time' : o.state === 'late' ? `shipped ${mins(P.t - o.due)} late` : 'part-shipped'} · ${tr.loaded} TVs`, late ? 'warn' : 'info');
      emit('ship', { order: o, truck: tr });
    }
    // inbound trucks are created by the enterprise layer (purchase orders); the floor unloads them
    function receive(tr) {
      tr.state = tr.state || 'due'; tr.k = 0; tr.id = tr.id || 'IN-' + (++P.seq);
      P.inbound.push(tr);
    }
    function inboundStep(dt) {
      for (const tr of P.inbound) {
        if (tr.state === 'due' && P.t >= tr.at) {
          const dock = INDOCK.find(d => d.area === (tr.area || 'LOC') && !P.inbound.some(x => x !== tr && x.state === 'unloading' && x.dock === d));
          if (!dock) continue;
          tr.dock = dock; tr.state = 'unloading'; tr.k = 0;
          log(dock.area === 'IMP' ? 'Import' : 'Receiving', `${tr.id} at ${dock.id} · ${tr.lines.map(l => `${l.qty.toLocaleString('en-US')} ${MAT[l.code].unit === 'kg' ? 'kg ' : ''}${l.code}`).join(', ')}${tr.po ? ' · ' + tr.po : ''}`);
        }
        if (tr.state === 'unloading') {
          tr.k += dt / (tr.area === 'IMP' ? 900 : 480);
          if (tr.k >= 1) {
            tr.state = 'done'; tr.doneAt = P.t;
            for (const l of tr.lines) { const b = STORE[MAT[l.code].store][l.code]; addLot(b, l.lot || lotId(vendLot(l.code)), l.qty, { src: MAT[l.code].vendor }); { const over = b.qty - b.cap * 1.25; if (over > 0 && b.lots.length) { const last = b.lots[b.lots.length - 1]; const k = Math.min(over, last.qty); last.qty -= k; b.qty -= k; if (last.qty <= 1e-9) b.lots.pop(); } } }
            emit('received', tr);
            log(tr.area === 'IMP' ? 'Import' : 'Receiving', `${tr.id} received into ${tr.area === 'IMP' ? 'the import warehouse' : 'the local-vendor supermarket'}`);
          }
        }
      }
      P.inbound = P.inbound.filter(t => t.state !== 'done' || P.t - t.doneAt < 600);
    }

    /* ----- people ----- */
    const FIRST = ['Mona', 'Karim', 'Hana', 'Omar', 'Salma', 'Youssef', 'Nour', 'Tamer', 'Laila', 'Ahmed', 'Rania', 'Mostafa', 'Dina', 'Hossam', 'Aya', 'Mahmoud', 'Sara', 'Khaled', 'Reem', 'Amr', 'Nada', 'Sherif', 'Yara', 'Hany', 'Mai', 'Walid', 'Eman', 'Tarek', 'Heba', 'Ali'];
    const LAST = ['Adel', 'Fathy', 'Samir', 'Nabil', 'Hany', 'Ali', 'Ehab', 'Reda', 'Mostafa', 'Fouad', 'Gamal', 'Saad', 'Kamal', 'Lotfy', 'Hassan', 'Zaki', 'Salem', 'Farouk'];
    let pSeq = 0;
    const person = (role, at, x, z, o) => { const p = Object.assign({ id: 'P' + (++pSeq), name: `${pick(FIRST)} ${pick(LAST)}`, role, at, x, z, present: true }, o); P.people.push(p); return p; };
    for (const s of P.stations) {
      const n = s.manual ? s.staff : s.kind === 'robot' || s.kind === 'palletizer' || s.kind === 'reflow' || s.kind === 'loader' || s.kind === 'unloader' ? 0 : (s.line.startsWith('SMD') ? (s.kind === 'mounter' && s.name === 'Mounter B' ? 1 : 0) : s.line === 'INJ' ? (Number(s.id.slice(2)) % 4 === 0 ? 1 : 0) : 1);
      s.crew = [];
      for (let k = 0; k < n; k++) s.crew.push(person(s.line === 'SUP' ? 'Rework technician' : 'Operator', s.id, s.x - s.w / 2 + 0.6 + k * 1.1, s.z + s.d / 2 + 0.75));
      if (s.crew[0]) s.operator = s.crew[0];
    }
    for (let i = 1; i <= 6; i++) person('Line leader', 'ML' + i, 150, LINE_Z[i - 1] - 3.2), person('Line leader', 'LCM' + i, 76, LINE_Z[i - 1] - 3.2);
    for (let i = 0; i < 6; i++) { const t = person('Technician', 'SHOP', 158 + i * 1.6, 146, { home: [158 + i * 1.6, 146], state: 'available' }); P.techs.push(t); }
    for (const v of VEH()) v.driver = person(v.kind === 'tugger' ? 'Milk-run driver' : v.kind === 'forklift' ? 'Forklift driver' : 'AGV', v.id, v.x, v.z, { rides: v });
    P.people = P.people.filter(p => p.role !== 'AGV');

    /* ----- station logic ----- */
    const lineModel = s => { const L = P.lines[s.line]; return L && L.model; };
    function taktOf(s) {
      const L = P.lines[s.line];
      if (s.factor && L && L.model) return MODELS[L.model].takt * s.factor;
      return s.base;
    }
    function stdCycle(s) { return s.kind === 'reflow' || s.kind === 'oven' ? s.base : s.slots > 1 && s.kind !== 'aging' ? s.base / s.slots : taktOf(s); }
    function cycleOf(s) {
      let c = taktOf(s);
      if (s.kind === 'reflow' || s.kind === 'oven' || (s.kind === 'writer')) c = s.base * s.slots;
      const L = P.lines[s.line];
      const sp = L ? L.speed : 1;
      const wear = s.health < 55 ? 1 + (55 - s.health) / 90 : 1;
      const crew = s.manual && s.staff ? Math.max(0.5, s.crew.filter(p => p.present).length / s.staff) : 1;
      return c * wear * s.speedMul / sp / (crew < 1 ? Math.max(0.55, crew) : 1) * (1 + (R() - 0.2) * 0.12);
    }
    // stop reasons: time lost per state and reason code, kept for the loss tree and the machine panel
    const LOSS = { down: 1, maint: 1, micro: 1, changeover: 1, starved: 1, blocked: 1 };
    function setState(s, st, why) { if (s.state !== st || s.why !== why) { if (LOSS[s.state] && s.since !== undefined && P.t > s.since) { const k = s.state + '|' + (s.why || ''); (s.rs = s.rs || {})[k] = (s.rs[k] || 0) + (P.t - s.since); } s.state = st; s.since = P.t; s.why = why || ''; } }
    function canStart(s) { for (const n of s.needs) { if (level(n.b) < (n.n || 1)) return n.b; } return null; }
    function consume(s, u) {
      for (const n of s.needs) {
        const got = take(n.b, n.n || 1);
        if (!got) continue;   // the last lot here was just put on hold: nothing usable to record
        if (n.b.items) { u.parts[n.as] = got[0]; got[0].usedIn = u.sn; got[0].usedAt = P.t; P.units.delete(got[0]); }   // a built-in part lives on in u.parts (findUnit looks there)
        else u.lots[n.as] = got[0];
        emit('consume', { code: n.b.code, qty: n.n || 1, st: s.id, line: s.line });
      }
    }
    function handOff(s, u) {
      if (s.outSeg) {
        const sg = s.outSeg, last = sg.items[sg.items.length - 1];
        if (last && last.s < sg.pitch) return false;
        sg.items.push({ u, s: 0 }); u.loc = { k: 'seg', seg: sg }; return true;
      }
      if (s.id.endsWith('ICTFCT')) {
        const lane = STORE.PBA['PBA-' + SIZE(u.model)];
        if (lane.items.length >= lane.cap) return false;
        lane.items.push(u); u.loc = { k: 'store', b: lane }; emit('gr', { code: 'PBA-' + SIZE(u.model), qty: 1, line: s.line });
        return true;
      }
      if (s.kind === 'palletizer') return palletize(s, u);
      return true;
    }
    function newUnitAt(s) {
      const L = P.lines[s.line];
      if (L.kind === 'smd') return unit('pba', { model: L.model, line: L.id, code: 'PBA-' + SIZE(L.model) });
      if (L.kind === 'lcm') return unit('lcm', { model: L.model, line: L.id, code: 'LCM-' + SIZE(L.model) });
      return null;
    }
    function stationStep(s, dt) {
      const L = P.lines[s.line];
      if (s.state === 'down' || s.state === 'maint') { s.counters.down += dt; s.counters[s.state === 'down' ? 'brk' : 'pm'] += dt; if (s.tech && s.tech.state === 'repairing' && !s.loto) { s.repair -= dt; if (s.repair <= 0) finishRepair(s); } return; }
      if (s.micro > 0) { s.micro -= dt; s.counters.down += dt; s.counters.micro += dt; if (s.micro <= 0) { s.micro = 0; setState(s, 'idle'); } return; }
      if (s.state === 'changeover') { s.counters.down += dt; s.counters.co += dt; s.co -= dt; if (s.co <= 0) setState(s, 'idle'); return; }
      if ((L && (L.stopped || L.tripped)) || s.tripped || (s.hold && (s.batchOut || s.kind === 'aging' || !s.procs.length))) { setState(s, 'idle', L && L.tripped ? 'Tripped (power)' : s.hold ? 'Stopped from the HMI' : 'Stopped'); s.counters.idle += dt; return; }
      const flowKinds = s.kind !== 'oven' && s.kind !== 'aging';
      if (s.procs.length && flowKinds && R() < dt / (s.manual ? 1600 : 1300)) {
        s.micro = rnd(15, 70); s.stops = (s.stops || 0) + 1;
        setState(s, 'micro', pick(s.kind === 'mounter' ? ['Pick error · nozzle retry', 'Feeder splice'] : s.kind === 'injection' ? ['Part stuck in mould', 'Robot pick retry'] : s.manual ? ['Operator waiting for help', 'Part fit issue'] : ['Jam at infeed', 'Sensor blocked', 'Vision retry']));
        return;
      }
      if (s.mtbf < 9e8 && s.procs.length && !s.degrade && R() < dt / s.mtbf) return fail(s, pick(['Servo overload', 'Sensor fault', 'Vacuum loss', 'Hydraulic pressure low']), rnd(300, 1200));
      if (s.degrade > 0) { s.health = Math.max(0, s.health - s.degrade * dt); if (s.health <= 22) return fail(s, s.failWhy || 'Bearing seized', s.failRepair || 2100); }

      if (s.batchOut) return batchStep(s, dt);
      if (s.kind === 'aging') return agingStep(s, dt);
      let busy = false;
      for (let i = s.procs.length - 1; i >= 0; i--) {
        const p = s.procs[i];
        if (p.left > 0) { p.left -= dt; busy = true; continue; }
        if (!p.done) { p.done = true; finishUnit(s, p.u, p); }
        if (p.reject) { s.procs.splice(i, 1); continue; }
        if (handOff(s, p.u)) { if (p.rec) p.rec.t1 = P.t; s.procs.splice(i, 1); s.counters.made++; s.counters.std += stdCycle(s); }
      }
      const blocked = s.procs.some(p => p.done && !p.reject);
      if (s.hold) { setState(s, 'idle', 'Stopping: the unit inside finishes first'); count(s, dt); return; }
      let starvedBy = null;
      while (s.procs.length < s.slots) {
        let u = null;
        if (s.inSegs) {
          const sg = s.inSegs.find(g => g.items.length && g.items[0].s >= g.len - 0.02);
          if (!sg) break;
          const need = canStart(s); if (need) { starvedBy = need; break; }
          u = sg.items.shift().u;
          if (L.kind === 'main' && s.idx === 0) {
            // the TV is born here around its panel module
            const lcm = u;
            if (lcm.model !== L.model) { lcm.loc = null; archive(lcm); continue; }
            u = unit('tv', { model: L.model, line: L.id, order: L.order });
            u.parts.lcm = lcm; lcm.usedIn = u.sn; lcm.usedAt = P.t; lcm.loc = null; P.units.delete(lcm);
            emit('unit', { kind: 'start', u });
          }
        } else if (s.idx === 0 && (L.kind === 'smd' || L.kind === 'lcm')) {
          const need = canStart(s); if (need) { starvedBy = need; break; }
          if (L.kind === 'smd') { const lane = STORE.PBA['PBA-' + SIZE(L.model)]; if (lane.items.length + 40 >= lane.cap) { starvedBy = 'kanban'; break; } }
          u = newUnitAt(s);
        } else break;
        consume(s, u);
        const rec = stepRec(u, s);
        s.procs.push({ u, left: cycleOf(s), rec }); u.loc = { k: 'st', st: s };
        busy = true;
      }
      if (blocked && !busy) setState(s, 'blocked', 'Outfeed full');
      else if (busy) setState(s, s.health < 55 ? 'warn' : 'run', s.health < 55 ? 'Running slow (wear)' : '');
      else if (starvedBy === 'kanban') setState(s, 'idle', 'PBA supermarket full (Kanban)');
      else if (starvedBy) setState(s, 'starved', `Waiting for ${(starvedBy.label || starvedBy.code).toLowerCase()}`);
      else setState(s, 'idle', 'Waiting for units');
      count(s, dt);
    }
    function count(s, dt) { const c = s.counters; if (s.state === 'run' || s.state === 'warn') c.run += dt; else if (s.state === 'blocked') c.blocked += dt; else if (s.state === 'starved') c.starved += dt; else c.idle += dt; }

    // batch machines: injection, press, coating, sub-assembly, cushions
    function batchIO(s) {
      if (s.kind === 'injection') return { ins: [[SILO.RESIN, BOM[s.part][0][1] * s.batchOut]], out: STORE.INJ[s.part], code: s.part };
      const k = s.line.slice(2);
      if (s.kind === 'press') return { ins: [[SILO.COIL, BOM['CHS-' + P.lines[s.line].size][0][1]]], out: P.bufs[`WIP:PR${k}:stamped`], code: 'CHS-' + P.lines[s.line].size };
      if (s.kind === 'oven') return { ins: [[P.bufs[`WIP:PR${k}:stamped`], 1], [SILO.PWD, 0.16]], out: P.bufs[`WIP:PR${k}:coated`], code: 'CHS-' + P.lines[s.line].size };
      if (s.kind === 'subassy') return { ins: [[P.bufs[`WIP:PR${k}:coated`], 1], [SILO.BRK, 1]], out: STORE.PRS['CHS-' + P.lines[s.line].size], code: 'CHS-' + P.lines[s.line].size };
      if (s.kind === 'cushion') { const i = s.line.slice(3); const L = P.lines['ML' + i]; return { ins: [[SILO.EPS, BOM['CUS-' + SIZE(L.model)][0][1] * s.batchOut]], out: L.ls.CUS, code: 'CUS-' + SIZE(L.model) }; }
      return null;
    }
    function batchStep(s, dt) {
      const io = batchIO(s);
      let busy = false;
      for (let i = s.procs.length - 1; i >= 0; i--) {
        const p = s.procs[i];
        if (p.left > 0) { p.left -= dt; busy = true; continue; }
        if (level(io.out) + s.batchOut > io.out.cap) { setState(s, 'blocked', 'Store full'); count(s, dt); return; }
        const lot = p.lot;
        const bad = s.kind === 'injection' && P.scen.shortshot && P.scen.shortshot.st === s.id && !P.scen.shortshot.fixed;
        addLot(io.out, lot, s.batchOut, { src: s.name, bad, cure: p.cure });
        if (bad) P.scen.shortshot.lots.add(lot);
        if (p.cure !== undefined && p.cure < 185) { P.scen.coating = P.scen.coating || {}; (P.scen.coating.lots = P.scen.coating.lots || new Set()).add(lot); }
        s.procs.splice(i, 1); s.counters.made += s.batchOut; s.counters.std += stdCycle(s) * s.batchOut / (s.slots > 1 ? 1 : 1);
        if (s.kind === 'injection') s.shots++;
        emit('gr', { code: io.code, qty: s.batchOut, line: s.line, st: s.id });
      }
      let starvedBy = null, full = false;
      while (s.procs.length < s.slots) {
        if (level(io.out) + s.batchOut * (s.procs.length + 1) > io.out.cap) { full = true; break; }
        const miss = io.ins.find(([b, n]) => level(b) < n);
        if (miss) { starvedBy = miss[0]; break; }
        // an under-cured coating lot taints what is built from it, so the peeling shows up on the chassis made from that lot
        const CO = P.scen.coating, bad0 = CO && !CO.fixed && CO.lots;
        let tainted = false;
        for (const [b, n] of io.ins) { const got = take(b, n); if (bad0 && got && got.some(g => typeof g === 'string' && bad0.has(g))) tainted = true; emit('consume', { code: b.code, qty: n, st: s.id, line: s.line }); }
        const cure = s.kind === 'oven' ? (s.sens.temp || 195) : undefined;
        const lot = s.kind === 'injection' ? `${s.id}-${s.part}-${pad(Math.floor(s.shots / 40), 4)}` : s.kind === 'cushion' ? `${s.id.slice(0, 4)}-${SIZE(P.lines['ML' + s.line.slice(3)].model)}-${pad(Math.floor(P.t / 1800), 3)}` : `${s.line}-${s.kind === 'press' ? 'ST' : s.kind === 'oven' ? 'CT' : 'CH'}-${pad(Math.floor(P.t / 1200), 3)}`;
        if (tainted) bad0.add(lot);
        s.procs.push({ left: cycleOf(s), lot, cure });
        if (s.kind !== 'oven' || s.procs.length > s.slots - 1) busy = true; else busy = true;
      }
      if (busy) setState(s, s.health < 55 ? 'warn' : 'run', s.health < 55 ? 'Running slow (wear)' : '');
      else if (full) setState(s, 'idle', 'Store full (Kanban)');
      else if (starvedBy) setState(s, 'starved', `Waiting for ${starvedBy.label.toLowerCase()}`);
      else setState(s, 'idle', '');
      count(s, dt);
    }
    // aging: TVs stand in the loop powered on, then leave in arrival order
    function agingStep(s, dt) {
      s.rack = s.rack || [];
      for (const sg of s.inSegs || []) {
        const head = sg.items[0];
        if (!head || head.s < sg.len - 0.02 || s.rack.length >= s.slots) continue;
        sg.items.shift(); head.u.loc = { k: 'aging', st: s }; head.u.agedFrom = P.t;
        s.rack.push(head.u); stepRec(head.u, s);
      }
      while (s.rack.length && P.t - s.rack[0].agedFrom >= s.ageing) {
        const u = s.rack[0], sg = s.outSeg, last = sg.items[sg.items.length - 1];
        if (last && last.s < sg.pitch) break;
        s.rack.shift(); const r = u.steps[u.steps.length - 1]; r.t1 = P.t; r.ok = true; r.note = '20 min powered, white field and 45 °C chamber';
        sg.items.push({ u, s: 0 }); u.loc = { k: 'seg', seg: sg }; s.counters.made++;
      }
      setState(s, s.rack.length ? 'run' : 'idle'); count(s, dt); s.load = s.rack.length;
    }

    // inspections, software download and genealogy notes
    function finishUnit(s, u, p) {
      const rec = p.rec; rec.ok = true;
      const L = P.lines[s.line];
      if (s.operator && s.manual) rec.by = s.operator.name;
      switch (s.kind) {
        case 'printer': rec.note = `Paste ${(s.sens.paste || 24.8).toFixed(1)} °C · squeegee ${(s.sens.press || 5.4).toFixed(1)} kg`; break;
        case 'spi': u.spi = s.sens.vol || 99; rec.note = `Paste volume ${u.spi.toFixed(0)}%`; break;
        case 'mounter': rec.note = `${s.name} · ${Math.round(rnd(420, 560))} parts placed`; break;
        case 'reflow': u.peak = s.sens.peak || 245; rec.note = `Peak ${u.peak.toFixed(1)} °C · TAL ${Math.round(rnd(58, 72))} s`; break;
        case 'aoi': {
          if (R() < 0.009) { u.defect = { code: pick(['Solder bridge', 'Missing component', 'Tombstone']), at: s.id, cause: 'Random' }; rec.ok = false; rec.note = u.defect.code + ' · to PBA repair'; p.reject = true; s.counters.bad++; u.loc = { k: 'repair', st: SMTREP }; P.rejects.smtRepair.push({ u, t: P.t }); emit('defect', { u, st: s }); }
          else rec.note = 'Pass · 1,862 joints checked';
          break;
        }
        case 'writer': {
          const sw = P.sw['PBA-' + SIZE(u.model)];
          u.sw = sw.version; rec.note = `Firmware ${sw.version} written · checksum OK`; emit('swflash', { u, version: sw.version }); break;
        }
        case 'ict': rec.note = 'ICT 412 nets · FCT boot and interfaces: pass'; break;
        case 'lcmload': rec.note = `Open cell lot ${u.lots.oc}`; break;
        case 'blu': rec.note = `BLU kit lot ${u.lots.blu}`; break;
        case 'bond': rec.note = `Bonding ${rnd(0.18, 0.22).toFixed(2)} mm · cure 9 s`; break;
        case 'lighting': rec.note = `Luminance ${Math.round(rnd(420, 470))} nit · uniformity ${rnd(88, 94).toFixed(0)}%`; break;
        case 'robot': rec.note = s.name === 'LCM input' ? `Panel module ${u.parts.lcm ? u.parts.lcm.sn : ''}` : s.name === 'Back cover' ? `Back cover lot ${u.lots.bc} · chassis lot ${u.lots.chs}` : `${u.model === 'M75' || u.model === 'M65' ? 14 : 10} screws · torque ${rnd(0.42, 0.48).toFixed(2)} N·m · stand lot ${u.lots.std}`; break;
        case 'bench': rec.note = `Main board ${u.parts.pba ? u.parts.pba.sn : ''} (firmware ${u.parts.pba ? u.parts.pba.sw : ''}) · SMPS lot ${u.lots.smps}`; break;
        case 'fct': {
          const swBad = u.parts.pba && P.scen.software && u.parts.pba.sw === P.scen.software.bad && R() < 0.35;
          if (swBad || R() < 0.005) {
            u.defect = swBad ? { code: 'HDMI-CEC handshake fail', at: s.id, cause: `Firmware ${u.parts.pba.sw}` } : { code: pick(['No backlight', 'No Wi-Fi', 'Audio fail']), at: s.id, cause: 'Connector not seated' };
            if (swBad) P.scen.software.fails = (P.scen.software.fails || 0) + 1;
            rec.ok = false; rec.note = u.defect.code + ' · to rework'; p.reject = true; s.counters.bad++; toRework(u); emit('defect', { u, st: s });
          } else rec.note = 'HDMI, USB, Wi-Fi, tuner, audio, power: pass';
          break;
        }
        case 'wb': rec.note = `White point x ${rnd(0.312, 0.314).toFixed(4)} y ${rnd(0.328, 0.330).toFixed(4)} · gamma 2.2`; break;
        case 'qa': {
          const shot = u.lots.bc && P.scen.shortshot && P.scen.shortshot.lots.has(u.lots.bc) && R() < 0.5;
          const coat = u.lots.chs && P.scen.coating && P.scen.coating.lots && !P.scen.coating.fixed && P.scen.coating.lots.has(u.lots.chs) && R() < 0.3;
          if (shot || coat || R() < 0.004) {
            u.defect = shot ? { code: 'Back cover short shot', at: s.id, cause: `Back-cover lot ${u.lots.bc}` } : coat ? { code: 'Chassis paint peeling', at: s.id, cause: `Chassis lot ${u.lots.chs} (under-cured)` } : { code: pick(['Scratch on bezel', 'Gap at back cover']), at: s.id, cause: 'Random' };
            if (shot) P.scen.shortshot.fails = (P.scen.shortshot.fails || 0) + 1;
            if (coat) P.scen.coating.fails = (P.scen.coating.fails || 0) + 1;
            rec.ok = false; rec.note = u.defect.code + ' · to rework'; p.reject = true; s.counters.bad++; toRework(u); emit('defect', { u, st: s });
          } else rec.note = 'Picture, cosmetics, labels and accessories: pass';
          break;
        }
        case 'packer': {
          u.packed = P.t; P.leads.push(P.t - u.born); if (P.leads.length > 60) P.leads.shift();
          rec.note = `Carton lot ${u.lots.ctn} · cushion lot ${u.lots.cus} · accessories lot ${u.lots.acc}`;
          P.made.tv++; P.made.byModel[u.model]++; L.made++;
          emit('unit', { kind: 'pack', u }); break;
        }
      }
    }
    function toRework(u) { u.loc = { k: 'repair', st: REWORK }; P.rejects.rework.push({ u, t: P.t }); }
    function repairsStep() {
      const sm = P.rejects.smtRepair;
      if (sm.length && P.t - sm[0].t > 360) {
        const { u } = sm.shift(); const ok = R() < 0.85;
        u.steps.push({ st: SMTREP.id, name: 'PBA repair', line: 'SUP', t0: P.t - 200, t1: P.t, ok, note: ok ? 'Repaired and re-tested' : 'Scrapped' });
        if (ok) { u.repaired = true; const lane = STORE.PBA[u.code]; lane.items.push(u); u.loc = { k: 'store', b: lane }; } else { u.loc = null; archive(u); }
      }
      const rw = P.rejects.rework;
      if (rw.length && P.t - rw[0].t > 300) {
        const { u } = rw.shift();
        const L = P.lines[u.line]; const qa = P.byId[`${u.line}-FinalQA`]; const sg = P.byId[`${u.line}-Whitebalance`].outSeg;
        const last = sg.items[sg.items.length - 1];
        if (!last || last.s >= sg.pitch) {
          const fix = u.defect.cause.startsWith('Firmware') ? `Re-flashed to ${P.sw['PBA-' + SIZE(u.model)].version}` : u.defect.code.includes('short shot') ? 'Back cover replaced from a good lot' : u.defect.code.includes('paint') ? 'Chassis replaced' : 'Reseated connector · retest';
          u.steps.push({ st: REWORK.id, name: 'Rework', line: 'SUP', t0: P.t - 240, t1: P.t, ok: true, note: fix });
          u.reworked = true; u.defect = null; sg.items.push({ u, s: sg.len * 0.5 }); sg.items.sort((a, b) => b.s - a.s); u.loc = { k: 'seg', seg: sg };
          void L; void qa;
        } else rw.unshift({ u, t: P.t });
      }
      REWORK.load = rw.length; SMTREP.load = sm.length;
      REWORK.state = rw.length ? 'run' : 'idle'; SMTREP.state = sm.length ? 'run' : 'idle';
    }

    /* ----- pallets ----- */
    let palletSeq = 88100;
    function palletize(s, u) {
      const L = P.lines[s.line];
      let p = P.pallets.find(x => x.where === 'build' && x.line === L.id);
      if (p && p.model !== u.model) { p.where = 'pickup'; p.built = P.t; p.x = s.x + 4.4; p.z = s.z - 1.6; }
      p = P.pallets.find(x => x.where === 'build' && x.line === L.id);
      if (!p) {
        if (P.pallets.filter(y => y.where === 'pickup' && y.line === L.id).length >= 2) return false;
        p = { id: 'PAL-' + (++palletSeq), model: u.model, line: L.id, units: [], where: 'build', x: s.x + 2.6, z: s.z + 1.4, cap: MODELS[u.model].pallet, built: null };
        P.pallets.push(p);
      }
      p.units.push(u); u.pallet = p.id; u.loc = { k: 'pallet', p };
      const r = u.steps[u.steps.length - 1]; r.note = `${p.id} · position ${p.units.length} of ${p.cap}`;
      if (p.units.length >= p.cap) {
        p.where = 'pickup'; p.built = P.t;
        const used = P.pallets.filter(x => x !== p && x.where === 'pickup' && x.line === L.id).length;
        p.x = s.x + 4.6; p.z = s.z + (used ? 1.6 : -1.6);
        emit('pallet', p);
      }
      return true;
    }

    /* ----- failures, repairs, technicians ----- */
    function fail(s, why, repair) {
      if (s.state === 'down') return;
      setState(s, 'down', why); s.fault = { why, at: P.t, repair }; s.repair = repair; s.degrade = 0;
      workOrder(s, 'Breakdown', why, 1);
      alarm(`${s.id}.DOWN`, true, { prio: 1, area: P.lines[s.line] ? P.lines[s.line].name : 'Plant', msg: `${s.name} stopped · ${why}`, ref: s.id });
      emit('stateChange', { s, state: 'down' });
      sendTech(s);
    }
    // CMMS work orders: every breakdown, planned and predictive repair is one, from open to completed
    function workOrder(s, type, why, prio, extra) {
      const w = Object.assign({ id: 'WO' + (++P.woSeq), st: s.id, type, why, prio, opened: P.t, status: 'Open', tech: null }, extra);
      P.wo.unshift(w); if (P.wo.length > 60) P.wo.pop(); s.wo = w; return w;
    }
    function sendTech(s) {
      const t = P.techs.find(x => x.state === 'available'); if (!t) { s.tech = null; return; }
      t.state = 'walking'; t.job = s; s.tech = t;
      if (s.wo && s.wo.status !== 'Completed') { s.wo.status = 'In progress'; s.wo.tech = t.name; s.wo.started = P.t; }
      t.path = route(nearestNode(t.x, t.z), nearestNode(s.x, s.z + s.d)); t.path.unshift([t.x, t.z]); t.path.push([s.x + 0.6, s.z + s.d / 2 + 0.9]); t.len = polyLen(t.path); t.s = 0;
      log('CMMS', `${t.name} dispatched to ${s.name} (${P.lines[s.line] ? P.lines[s.line].name : ''})`, 'info', s.id);
    }
    // the preventive plan: a work order that falls due stops its machine for planned work; a technician is dispatched
    function pmDue() {
      for (const w of P.wo) {
        if (w.type !== 'Preventive' || w.status !== 'Scheduled' || !w.due || P.t < w.due) continue;
        const s = P.byId[w.st]; if (!s || s.loto) continue;
        if (s.state === 'down' || s.state === 'maint') { w.due = P.t + 600; continue; }   // busy with a repair: ten minutes later
        w.status = 'Open'; w.opened = P.t; s.wo = w;
        setState(s, 'maint', `Preventive: ${w.why}`); s.repair = 900;
        log('CMMS', `${w.id} preventive work started on ${s.name}${P.lines[s.line] ? ' (' + P.lines[s.line].name + ')' : ''} · ${w.why}`, 'info', s.id);
      }
    }
    function sendHome(t) { t.state = 'returning'; t.job = null; t.path = route(nearestNode(t.x, t.z), nearestNode(t.home[0], t.home[1])); t.path.unshift([t.x, t.z]); t.path.push(t.home); t.len = polyLen(t.path); t.s = 0; }
    function finishRepair(s) {
      const t = s.tech, planned = s.state === 'maint';
      s.health = rnd(96, 99.5); s.fault = null; s.tech = null; s.failWhy = null; s.repairs = (s.repairs || 0) + 1;
      if (s.wo && s.wo.status !== 'Completed') { s.wo.status = 'Completed'; s.wo.closed = P.t; s.wo = null; }
      setState(s, 'idle'); alarm(`${s.id}.DOWN`, false); alarm(`${s.id}.HEALTH`, false);
      log('CMMS', `${s.name} (${P.lines[s.line] ? P.lines[s.line].name : ''}) back in production after ${planned ? 'planned' : 'unplanned'} repair`, 'info', s.id);
      if (t) sendHome(t);
      if (s.onRepaired) { const f = s.onRepaired; s.onRepaired = null; f(); }
      emit('stateChange', { s, state: 'up' });
    }
    function peopleStep(dt) {
      for (const t of P.techs) {
        if (t.path) {
          t.s = Math.min(t.len, t.s + 1.35 * dt); const p = polyAt(t.path, t.s); t.x = p[0]; t.z = p[1]; t.h = p[2];
          if (t.s >= t.len - 0.01) { t.path = null; if (t.state === 'walking') { const j = t.job; if (!j || (j.state !== 'down' && j.state !== 'maint') || j.loto) { if (j && j.tech === t) j.tech = null; sendHome(t); } else { t.state = 'repairing'; log('CMMS', `${t.name} on site at ${j.name}`, 'info', j.id); } } else if (t.state === 'returning') t.state = 'available'; }
        }
        if (t.state === 'available') { const w = P.stations.find(s => (s.state === 'down' || s.state === 'maint') && !s.tech && !s.loto); if (w) sendTech(w); }   // a locked-out machine waits for its lockout to be removed
      }
      for (const p of P.people) if (p.rides) { p.x = p.rides.x; p.z = p.rides.z; }
    }

    /* ----- sensors ----- */
    function sensors(s) {
      const on = s.state === 'run' || s.state === 'warn', wear = 100 - s.health, S = s.sens, n = a => (R() - 0.5) * a;
      if (s.kind === 'mounter') { S.vib = on ? 1.4 + wear * 0.055 + (wear > 40 ? wear * 0.02 : 0) + n(0.25) : 0.12 + n(0.04); S.vac = on ? -78 + wear * 0.06 + n(1.2) : -12; S.cph = on ? Math.round(58000 * (0.97 + n(0.04))) : 0; S.temp = 38 + wear * 0.12 + n(0.4); }
      else if (s.kind === 'reflow') { const dip = P.lines[s.line].tripped ? -40 : 0; S.zones = [150, 170, 185, 200, 228, 248, 236, 140].map(z => z + dip + n(1.2)); S.peak = Math.max(...S.zones.slice(4, 7)) - 1.5 + n(0.6); S.temp = S.peak; }
      else if (s.kind === 'printer') { S.press = 5.4 + n(0.12); S.paste = 24.6 + n(0.3); S.temp = S.paste; }
      else if (s.kind === 'injection') { S.temp = 238 + n(2); S.press = on ? 1150 + n(30) - (P.scen.shortshot && P.scen.shortshot.st === s.id && !P.scen.shortshot.fixed ? 160 : 0) : 0; S.cyc = on ? cycleOf(s) : 0; S.fill = P.scen.shortshot && P.scen.shortshot.st === s.id && !P.scen.shortshot.fixed ? 93 + n(2) : 99.6 + n(0.3); }
      else if (s.kind === 'oven') { const drop = P.scen.coating && P.scen.coating.line === s.line && !P.scen.coating.fixed ? P.scen.coating.drop : 0; S.temp = (P.lines[s.line].tripped ? 140 : 200) - drop + n(1.5); S.load = s.procs.length; }
      else if (s.kind === 'press') { S.tonnage = on ? 260 + n(8) : 0; S.temp = 41 + n(1); S.vib = on ? 2.1 + wear * 0.03 + n(0.2) : 0.1; }
      else if (s.kind === 'cushion') { S.steam = on ? 1.2 + n(0.05) : 0.2; S.temp = 108 + n(2); }
      else if (s.kind === 'aging') { S.temp = 45 + n(0.5); }
      else S.temp = 27 + n(0.5);
      const K = KIND[s.kind].kw;
      s.kwNow = (s.state === 'run' || s.state === 'warn' ? K[0] : s.state === 'down' || s.state === 'maint' ? K[2] : K[1]) * (1 + n(0.04));
      if (s.kind === 'aging') s.kwNow = K[1] + (s.load || 0) * (MODELS[lineModel(s)].inch * 0.0025);
    }
    function record(s) { const H = s.hist, S = s.sens; const push = (k, v) => { if (v === undefined || !isFinite(v)) return; (H[k] = H[k] || []).push(+v.toFixed(2)); if (H[k].length > HIST) H[k].shift(); }; push('vib', S.vib); push('temp', S.temp); push('kw', s.kwNow); push('peak', S.peak); push('health', s.health); push('press', S.press); }

    /* ----- utilities ----- */
    P.util = { kw: 0, ambient: 31, assets: [
      { id: 'UTIL-TX1', name: 'Transformer T1', x: 116, z: 136, kind: 'transformer', kw: 0 }, { id: 'UTIL-TX2', name: 'Transformer T2', x: 116, z: 150, kind: 'transformer', kw: 0 },
      { id: 'UTIL-AIR1', name: 'Compressor 1', x: 126, z: 136, kind: 'compressor', kw: 0 }, { id: 'UTIL-AIR2', name: 'Compressor 2', x: 126, z: 143, kind: 'compressor', kw: 0 }, { id: 'UTIL-AIR3', name: 'Compressor 3', x: 126, z: 150, kind: 'compressor', kw: 0 },
      { id: 'UTIL-CH1', name: 'Chiller 1', x: 138, z: 136, kind: 'chiller', kw: 0 }, { id: 'UTIL-CH2', name: 'Chiller 2', x: 138, z: 146, kind: 'chiller', kw: 0 },
      { id: 'UTIL-BLR', name: 'Steam boiler (cushions)', x: 152, z: 146, kind: 'boiler', kw: 0 }
    ] };
    function utilStep() {
      const pneu = P.stations.filter(s => (s.state === 'run' || s.state === 'warn') && /mounter|robot|packer|palletizer|injection|press/.test(s.kind)).length;
      const hour = (P.t / 3600) % 24, amb = 30 + 7 * Math.sin((hour - 9) / 24 * Math.PI * 2 + 0.6); P.util.ambient = amb;
      const A = P.util.assets;
      A[2].kw = 90 + pneu * 1.6 + (R() - 0.5) * 4; A[3].kw = 90 + pneu * 1.2; A[4].kw = pneu > 60 ? 40 + (pneu - 60) * 2 : 15;
      A[5].kw = 210 + (amb - 28) * 12; A[6].kw = amb > 33 ? 120 + (amb - 33) * 14 : 40; A[7].kw = 60 + P.stations.filter(s => s.kind === 'cushion' && s.state === 'run').length * 22;
      // peak shaving ordered by the energy agent: chosen assets run staged down for a while
      if (P.shave && P.t < P.shave.until) for (const x of A) if (P.shave.assets[x.id] !== undefined) x.kw *= P.shave.assets[x.id];
      P.util.kw = A.reduce((a, x) => a + x.kw, 0) + 380;   // lighting, HVAC for offices, IT
    }

    /* ----- the shift forecast and the chance to hit the plan -----
       Expected output to the end of the shift, and its spread, in three parts:
       1. the next two hours from the agents' flow model (material, known repairs, changeovers, orders), corrected by the
          model's own bias: what each forecast said for its second half hour is checked against what was packed (EWMA);
       2. after that, the flow model's steady rate (rated × 90% performance × crew), with the same correction;
       3. the spread: random breakdowns as a compound Poisson process (count λT with λ = Σ 1/MTBF of the line's stations,
          calibrated to the availability seen this shift; each costing MTTR × rate, repair times
          with a coefficient of variation of 0.6), hour-to-hour performance noise (CV 5% an hour, independent hours), and
          the model's own error (6% of what is left, measured on replays).
       The chance to hit the plan is Φ((forecast − plan) / σ), the normal approximation, kept within 1–99%. */
    const fcHist = [];
    const PLAN_OEE = 0.82, MTTR_H = 0.3, REPAIR_CV = 0.6, PERF_CV = 0.05, MODEL_ERR = 0.06;
    const phi = z => { const t = 1 / (1 + 0.2316419 * Math.abs(z)), d = 0.3989423 * Math.exp(-z * z / 2), p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274)))); return z > 0 ? 1 - p : p; };
    function lineLambda(L) {
      // a main line stops when any of its own stations or its LCM line's stations break (the SMD, press and injection
      // lines feed through supermarkets that ride out a repair, so they count at a quarter)
      const n = L.id.slice(2), own = L.stations.concat((P.lines['LCM' + n] || { stations: [] }).stations), feed = (P.lines['SMD' + n] || { stations: [] }).stations;
      const lam = s => (s.mtbf && s.mtbf < 9e8 ? 3600 / s.mtbf : 0);
      return own.reduce((a, s) => a + lam(s), 0) + 0.25 * feed.reduce((a, s) => a + lam(s), 0);
    }
    function shiftForecast(k, mains, units, rate) {
      const rem = Math.max(0, (SHIFT_END - P.t) / 3600);
      k.oeeShift = k.oeeShift === undefined ? 0.85 : k.oeeShift + ((k.oee || k.oeeShift) - k.oeeShift) * 0.02;
      const rated = mains.reduce((a, L) => a + 3600 / MODELS[L.model].takt * L.speed, 0);
      // the flow model learns its own bias: each forecast's first 30 minutes are checked against what was packed
      const fc = P.fc2 && P.t - P.fc2.at < 120 ? P.fc2 : null;
      // (minutes 30 to 60, past the pipeline the model takes from the current rate), one sample every 5 minutes
      if (fc && fc.curve && fc.curve.length > 5 && P.t - (shiftForecast.last || -1e9) >= 300) { shiftForecast.last = P.t; fcHist.push({ at: P.t, pred: fc.curve[5] - fc.curve[2], u30: null }); }
      for (const e of fcHist) if (e.u30 === null && P.t - e.at >= 1800) e.u30 = units;
      while (fcHist.length && P.t - fcHist[0].at >= 3600) { const e = fcHist.shift(); if (e.pred > 50 && e.u30 !== null) k.fcBias = (k.fcBias || 1) + (clamp((units - e.u30) / e.pred, 0.6, 1.3) - (k.fcBias || 1)) * 0.25; }
      const bias = k.fcBias || 1;
      // capability for the far hours: the flow model's steady rate (rated × 90% × crew) corrected by its bias
      const cap = clamp((fc && fc.nominal ? fc.nominal : rated * 0.9) * bias, rated * 0.45, rated * 0.97);
      k.rateShift = cap;
      // breakdowns: the rate comes from the stations' MTBF, scaled to what the lines actually lost to stops this shift
      const availNow = mains.reduce((a, L) => a + (L.avail || 0.95), 0) / mains.length;
      k.availShift = k.availShift === undefined ? 0.95 : k.availShift + (availNow - k.availShift) * 0.02;
      const lamModel = mains.reduce((a, L) => a + lineLambda(L), 0) / mains.length, lamSeen = Math.max(0.05, (1 - k.availShift) / MTTR_H);
      const lamK = lamModel ? clamp(lamSeen / lamModel, 0.1, 1.5) : 1;
      let varFail = 0;
      for (const L of mains) { const lam = lineLambda(L) * lamK, r = 3600 / MODELS[L.model].takt * L.speed * clamp(k.oeeShift, 0.55, 0.97); varFail += lam * rem * (r * MTTR_H) ** 2 * (1 + REPAIR_CV ** 2); }
      // the near term: the flow model when it is fresh, otherwise the current rate easing back to capability over 45 minutes
      const near = Math.min(rem, 2);
      let nearOut;
      if (fc && fc.curve && fc.curve.length) { const pts = [0].concat(fc.curve), x = near / 2 * (pts.length - 1), i = Math.floor(x), f = x - i; nearOut = (pts[i] + ((pts[i + 1] ?? pts[i]) - pts[i]) * f) * bias; }
      else { const tau = 0.75, w = tau * (1 - Math.exp(-near / tau)); nearOut = rate * w + cap * (near - w); }
      const farOut = cap * Math.max(0, rem - 2);
      const left = Math.max(0, nearOut + farOut);
      k.fcst = Math.round(units + left);
      const sigma = Math.sqrt(varFail + (PERF_CV * cap) ** 2 * rem + (MODEL_ERR * left) ** 2) || 1;
      k.fcSigma = sigma;
      k.prob = rem <= 0 ? (units >= k.planEnd ? 1 : 0) : clamp(phi((k.fcst - k.planEnd) / sigma), 0.01, 0.99);
      k.p10 = Math.round(k.fcst - 1.2816 * sigma); k.p90 = Math.round(k.fcst + 1.2816 * sigma);
    }

    /* ----- KPIs ----- */
    const win = [];
    // the time machine: a compact snapshot every 20 s of machine states, vehicles and readouts, 45 minutes deep
    function snap() {
      P.snaps.push({ t: P.t, st: P.stations.map(s => [s.state, s.why, s.since]), veh: P.agvs.concat(P.tuggers, P.forklifts).map(v => [v.x, v.z, v.h]), kpi: Object.assign({}, P.kpi), alarms: P.alarms.length });
      if (P.snaps.length > 135) P.snaps.shift();
    }
    function kpis() {
      const k = P.kpi;
      const el = (P.t - SHIFT_START) / 3600;
      const mains = Object.values(P.lines).filter(L => L.kind === 'main');
      let today = 0; for (const m in MODELS) today += P.base[m] + P.made.byModel[m];
      // packed this shift: what the day has packed less what the earlier shifts handed over
      const units = today - P.shift.off;
      k.today = today; k.units = units; k.shift = P.shift.name; k.shiftEnd = SHIFT_END;
      // the plan is loaded at demonstrated capacity: each main line's rated rate (3600 / takt) × the plan OEE (PLAN_OEE)
      const planRate = mains.reduce((a, L) => a + 3600 / MODELS[L.model].takt * PLAN_OEE, 0);
      k.planRate = planRate;
      k.plan = Math.round(planRate * el);
      const snap = {};
      for (const id in P.lines) {
        const L = P.lines[id]; if (L.kind === 'injection') continue;
        const b = L.kind === 'main' ? L.stations.reduce((m, s) => (s.kind === 'aging' || s.kind === 'palletizer' ? 0 : s.factor) > m.factor ? s : m, L.stations[1]) : L.kind === 'press' ? L.stations[2] : L.stations.reduce((m, s) => (s.kind === 'reflow' || s.kind === 'oven' ? 0 : taktOf(s)) > (m.kind === 'reflow' ? 0 : taktOf(m)) ? s : m, L.stations[0]);
        L.bn = b;
        snap[id] = { run: b.counters.run, lost: b.counters.down - b.counters.pm + b.counters.starved + b.counters.blocked, made: b.counters.made, std: b.counters.std, bad: L.stations.reduce((a, s) => a + s.counters.bad, 0) };
      }
      win.push({ t: P.t, snap }); while (win.length && P.t - win[0].t > 1800) win.shift();
      const w0 = win[0]; let oW = 0, rW = 0;
      for (const id in snap) {
        const L = P.lines[id], a = snap[id], b = w0.snap[id] || a, span = Math.max(1, P.t - w0.t);
        if (span < 120) continue;
        const run = a.run - b.run, lost = a.lost - b.lost, made = a.made - b.made, bad = a.bad - b.bad;
        L.avail = ema(L.avail, clamp(run / Math.max(1, run + lost), 0, 1), 0.25);
        L.perf = ema(L.perf, clamp((a.std - b.std) / Math.max(1, run), 0, 1), 0.25);
        L.qual = ema(L.qual, made ? clamp(1 - bad / Math.max(1, made), 0, 1) : 1, 0.25);
        L.oee = L.avail * L.perf * L.qual; L.tph = made / span * 3600;
        if (L.kind === 'main') { const r = 3600 / MODELS[L.model].takt; oW += L.oee * r; rW += r; }
      }
      for (const L of Object.values(P.lines)) {
        const sts = L.stations;
        const down = sts.find(s => s.state === 'down' || s.state === 'maint');
        L.state = L.tripped ? 'tripped' : down ? 'down' : sts.some(s => s.state === 'changeover') ? 'changeover' : sts.some(s => s.state === 'starved') ? 'starved' : sts.some(s => s.state === 'warn' || s.state === 'micro') ? 'warn' : sts.every(s => s.state === 'idle' || s.state === 'blocked') ? 'idle' : 'run';
      }
      if (rW) k.oee = oW / rW;
      const insp = P.stations.filter(s => s.kind === 'fct' || s.kind === 'qa');
      const tot = insp.reduce((a, s) => a + s.counters.made + s.counters.bad, 0), bad = insp.reduce((a, s) => a + s.counters.bad, 0);
      // first-pass yield of the TV: the product of the first-pass yields of each test and inspection (rolled throughput yield)
      k.fpy = tot ? insp.reduce((y, s) => { const n = s.counters.made + s.counters.bad; return n ? y * (1 - s.counters.bad / n) : y; }, 1) : 0.992;
      let wip = 0; for (const u of P.units) if (u.type === 'tv' && !u.packed) wip++;
      k.wip = wip; k.lead = P.leads.length ? P.leads.reduce((a, b) => a + b, 0) / P.leads.length : 0;
      k.kw = P.stations.reduce((a, s) => a + s.kwNow, 0) + P.util.kw;
      const shipped = P.orders.filter(o => ['shipped', 'late', 'partial'].includes(o.state));
      k.otif = shipped.length ? shipped.filter(o => o.state === 'shipped').length / shipped.length : 1;
      k.alarms = P.alarms.length;
      const rate = mains.reduce((a, L) => a + (L.tph || 0), 0);
      k.tph = rate;
      k.planEnd = Math.round(planRate * (SHIFT_END - SHIFT_START) / 3600);
      shiftForecast(k, mains, units, rate);
      const h = P.hist; h.t.push(P.t); h.kw.push(Math.round(k.kw)); h.tph.push(Math.round(rate)); h.oee.push(+(k.oee || 0.85).toFixed(3)); h.wip.push(k.wip);
      for (const key in h) if (h[key].length > HIST) h[key].shift();
    }

    /* ----- the shop-floor AI ----- */
    function think() {
      for (const b of Object.values(P.bufs)) { const used = b.used - (b._u || 0); b._u = b.used; b.rate = ema(b.rate, used / 2, 0.08); }
      // 1. line-side stock against the next milk run or AGV
      for (const b of Object.values(LS)) {
        if (b.feed === 'conveyor') continue;
        const rw = runway(b), s = P.byId[b.station], L = P.lines[s.line];
        const eta = b.feed === 'agv' ? (b.mission ? (b.mission.veh && !b.mission.veh.fault ? Math.max(0, b.mission.eta - P.t) : 300) : Infinity) : nextLap(b);
        const src = P.bufs[b.src];
        if (rw < 600 && level(src) < (b.batch || 1)) {
          rec('src:' + b.id, { agent: 'Logistics', level: 'crit', ref: src.id, links: [[src.id, s.id]], title: `${s.name} on ${L.name} runs out of ${b.code} in ${mins(rw)}: the ${src.store === 'PBA' ? 'PBA supermarket' : src.store === 'INJ' ? 'injection supermarket' : src.store === 'PRS' ? 'chassis supermarket' : src.store === 'IMP' ? 'import warehouse' : 'local supermarket'} is empty too`,
            body: `${level(src).toLocaleString('en-US')} ${b.code} left at the source. The feeding line or the supplier is the real problem; see What happens next.`, actions: [{ id: 'focus:' + src.id, label: 'Show the source' }] });
        } else rec('src:' + b.id, null);
        if (rw < 600 && level(src) < (b.batch || 1)) rec('rw:' + b.id, null);
        else if (b.feed === 'agv' && b.mission && rw < 420 && rw < eta + 60) {
          rec('rw:' + b.id, { agent: 'Logistics', level: rw < 180 ? 'crit' : 'warn', ref: s.id, links: [[b.src, s.id]], title: `${s.name} on ${L.name} runs out of ${b.code} in ${mins(rw)}`, body: `The next AGV arrives in about ${mins(eta)}. Pre-empt the least urgent AGV mission to deliver now.`, actions: [{ id: 'expedite:' + b.id, label: 'Deliver now' }, { id: 'focus:' + s.id, label: 'Show station' }] });
        } else if (b.feed !== 'agv' && rw < 360 && rw < eta && level(src) >= b.batch * 0.5) {
          const t = P.tuggers.find(t => TROUTE[t.route].serves(b.id));
          rec('rw:' + b.id, { agent: 'Logistics', level: rw < 150 ? 'crit' : 'warn', ref: s.id, links: [[b.src, s.id]], title: `${s.name} on ${L.name} runs out of ${b.code} in ${mins(rw)}`, body: `Milk run ${t.route} (${t.routeName}) reaches it in about ${mins(eta)}. Send a hot run with an AGV straight from ${src.label}.`, actions: [{ id: 'hot:' + b.id, label: 'Send a hot run' }, { id: 'focus:' + s.id, label: 'Show station' }] });
        } else rec('rw:' + b.id, null);
      }
      // 2. machine wear
      for (const s of P.stations) {
        if (s.degrade > 0 && s.state !== 'down') {
          const rul = (s.health - 22) / s.degrade;
          alarm(`${s.id}.HEALTH`, true, { prio: 2, area: P.lines[s.line].name, msg: `${s.name} vibration rising · failure predicted in ${mins(rul)}`, ref: s.id });
          const lane = STORE.PBA['PBA-' + SIZE(P.lines[s.line].model)];
          if (!s.planned) rec('rul:' + s.id, { agent: 'Maintenance', level: rul < 600 ? 'crit' : 'warn', ref: s.id, title: `${s.name} on ${P.lines[s.line].name} will fail in about ${mins(rul)}`,
            body: `Vibration ${(s.sens.vib || 0).toFixed(1)} mm/s and rising (bearing-wear signature, 94% match). An 8-minute bearing change now is covered by the PBA supermarket (${lane.items.length} boards). A failure stops the line for about 35 minutes and starves the main lines that use these boards.`,
            actions: [{ id: 'planRepair:' + s.id, label: 'Plan repair now' }, { id: 'focus:' + s.id, label: 'Show machine' }] });
        } else rec('rul:' + s.id, null);
      }
      // 3. PBA supply when an SMD line is not feeding
      for (const m of Object.keys(MODELS)) {
        const lane = STORE.PBA['PBA-' + SIZE(m)];
        const users = Object.values(P.lines).filter(L => L.kind === 'main' && L.model === m);
        const demand = users.reduce((a, L) => a + 3600 / MODELS[m].takt, 0);
        const feeders = Object.values(P.lines).filter(L => L.kind === 'smd' && L.model === m);
        const running = feeders.filter(L => L.state !== 'down' && L.state !== 'tripped').length;
        const lineSide = users.reduce((a, L) => a + L.ls.PBA.items.length, 0);
        const rw = demand ? (lane.items.length + lineSide) / (demand / 3600) : Infinity;
        lane.rw = rw;
        // short when a feeder is stopped, or when no SMD line builds this board at all and main lines still need it
        const short = (feeders.length ? running < feeders.length : true) && rw < 2700;
        // a spare SMD line must not be the only one building its own board, or the switch just moves the shortage
        const spare = Object.values(P.lines).filter(L => L.kind === 'smd' && L.model !== m && L.state === 'run' && Object.values(P.lines).filter(x => x.kind === 'smd' && x.model === L.model).length > 1).map(L => ({ L, cover: (STORE.PBA['PBA-' + SIZE(L.model)].items.length) / Math.max(1e-6, Object.values(P.lines).filter(x => x.kind === 'main' && x.model === L.model).length * 3600 / MODELS[L.model].takt / 3600) })).sort((a, b) => b.cover - a.cover)[0];
        if (short && demand) rec('pba:' + m, { agent: 'Planning', level: rw < 900 ? 'crit' : 'warn', ref: lane.id,
          // what the 3D view draws as cause and effect: the stopped SMD machine → the PBA lane → each main line it feeds
          links: feeders.filter(L => L.state === 'down' || L.state === 'tripped').map(L => [(L.stations.find(st => st.state === 'down') || L.stations[0]).id, lane.id]).concat(users.map(L => [lane.id, L.ls.PBA.station])), title: `PBA ${SIZE(m)} runs out for ${users.map(L => L.name).join(' and ')} in ${mins(rw)}`,
          body: `${feeders.filter(L => L.state === 'down').map(L => L.name).join(', ') || 'An SMD line'} is not feeding. ${lane.items.length} boards in the supermarket and ${lineSide} at the lines for ${Math.round(demand)} an hour. ${spare ? `Switch ${spare.L.name} from PBA ${SIZE(spare.L.model)} (stock covers ${mins(spare.cover)}) to PBA ${SIZE(m)}: a 10-minute changeover, then about 340 boards an hour.` : ''}`,
          actions: spare ? [{ id: `switchSmd:${spare.L.id}:${m}`, label: `Switch ${spare.L.name} to PBA ${SIZE(m)}` }, { id: 'focus:' + lane.id, label: 'Show supermarket' }] : [{ id: 'focus:' + lane.id, label: 'Show supermarket' }] });
        else rec('pba:' + m, null);
        alarm('PBA.' + m, lane.items.length < 25 && demand > 0, { prio: 2, area: 'PBA supermarket', msg: `PBA ${SIZE(m)} supermarket low · ${lane.items.length} boards`, ref: lane.id });
      }
      // 4. quality traced to a lot, a machine or a software version
      const S = P.scen;
      if (S.shortshot && !S.shortshot.fixed && (S.shortshot.fails || 0) >= 2) {
        const im = P.byId[S.shortshot.st];
        alarm('QA.SHOT', true, { prio: 2, area: 'Quality', msg: `Back-cover short shots at final QA · all from ${im.name}`, ref: im.id });
        rec('shot', { agent: 'Quality', level: 'crit', ref: im.id, title: `Back-cover short shots traced to ${im.name}`,
          body: `${S.shortshot.fails} TVs failed final QA with incomplete back covers; every one carries a lot from ${im.name} (fill ${(im.sens.fill || 93).toFixed(1)}%, injection pressure down ${Math.round(1150 - (im.sens.press || 990))} bar: check-ring wear). Hold its ${S.shortshot.lots.size} lots, stop ${im.name} for the check ring, and run BC-65 on the spare machine IM20 (40-minute mould change).`,
          actions: [{ id: 'fixShot', label: `Hold lots and move BC-65 to IM20` }, { id: 'focus:' + im.id, label: `Show ${im.name}` }] });
      } else { rec('shot', null); alarm('QA.SHOT', false); }
      if (S.coating && S.coating.line && !S.coating.fixed && (S.coating.fails || 0) >= 2) {
        const ov = P.byId[S.coating.line + '-Coating'];
        alarm('QA.COAT', true, { prio: 2, area: 'Quality', msg: `Chassis paint adhesion failures · ${P.lines[S.coating.line].name} oven`, ref: ov.id });
        rec('coat', { agent: 'Quality', level: 'crit', ref: ov.id, title: `Paint peeling traced to the ${P.lines[S.coating.line].name} coating oven`,
          body: `${S.coating.fails} TVs failed final QA with peeling chassis paint. The oven ran at ${(ov.sens.temp || 182).toFixed(0)} °C against a 200 °C cure. Repair the burner and hold the under-cured chassis lots (${(S.coating.lots || new Set()).size}).`,
          actions: [{ id: 'fixCoat', label: 'Repair burner and hold lots' }, { id: 'focus:' + ov.id, label: 'Show oven' }] });
      } else { rec('coat', null); alarm('QA.COAT', false); }
      if (S.software && !S.software.fixed && (S.software.fails || 0) >= 2) {
        alarm('QA.SW', true, { prio: 2, area: 'Quality', msg: `Function test failures on PBA 55 · firmware ${S.software.bad}`, ref: 'ML1-Functiontest' });
        const bad = [...P.units].filter(u => u.type === 'pba' && u.sw === S.software.bad && !u.usedIn).length;
        rec('sw', { agent: 'Quality', level: 'crit', ref: 'ML1-Functiontest', title: `Firmware ${S.software.bad} fails the function test`,
          body: `${S.software.fails} TVs on main lines 1 and 2 failed HDMI-CEC; every failed board carries firmware ${S.software.bad}, released by PE today. ${bad} boards with it are still in stock. Roll the writers back to ${S.software.good}, re-flash those boards, and send the release back to PE.`,
          actions: [{ id: 'rollback', label: `Roll back to ${S.software.good}` }, { id: 'focus:ML1-Functiontest', label: 'Show function test' }] });
      } else { rec('sw', null); alarm('QA.SW', false); }
      if (S.absent && !S.absent.fixed) {
        const L = P.lines.ML3;
        rec('absent', { agent: 'Planning', level: 'warn', ref: 'ML3-PBAandSMPS', links: [], title: 'Main line 3 is short of 8 operators',
          body: `Manual stations on line 3 run at about ${Math.round(100 * L.stations.filter(s => s.manual).reduce((a, s) => a + s.crew.filter(p => p.present).length, 0) / L.stations.filter(s => s.manual).reduce((a, s) => a + s.staff, 0))}% staffing; the line loses about ${Math.round(3600 / MODELS[L.model].takt * 0.35)} TVs an hour. Main line 6 runs below plan this morning: move 6 certified operators from line 6 and approve 2 hours overtime for 2 more.`,
          actions: [{ id: 'moveOps', label: 'Move 6 operators and approve overtime' }, { id: 'focus:ML3-PBAandSMPS', label: 'Show line 3' }] });
      } else rec('absent', null);
      // 5. station alarms
      for (const s of P.stations) {
        const long = P.t - s.since, area = P.lines[s.line] ? P.lines[s.line].name : 'Plant';
        alarm(`${s.id}.STV`, s.state === 'starved' && long > 60, { prio: 3, area, msg: `${s.name}: ${s.why.toLowerCase()}`, ref: s.id });
        alarm(`${s.id}.MS`, s.state === 'micro' && long > 60, { prio: 4, area, msg: `${s.name}: ${s.why.toLowerCase()}`, ref: s.id });
      }
      for (const a of VEH()) alarm(a.id + '.FAULT', !!a.fault, { prio: 2, area: 'Logistics', msg: `${a.id} stopped · ${a.fault || ''}`, ref: a.id });
      // predictions: what happens next if nobody acts
      P.preds = [];
      for (const b of Object.values(LS)) {
        if (b.feed === 'conveyor') continue;
        const rw = runway(b); const eta = b.feed === 'agv' ? (b.mission && b.mission.veh ? b.mission.eta - P.t : 400) : nextLap(b);
        if (rw < 900 && rw < eta) P.preds.push({ key: b.id, ref: b.id, text: `${P.byId[b.station].name} runs out of ${b.code}`, sub: `${P.lines[b.line].name} · next delivery in ${mins(eta)}`, eta: rw });
      }
      for (const m of Object.keys(MODELS)) { const lane = STORE.PBA['PBA-' + SIZE(m)]; if (lane.rw < 3600 && Object.values(P.lines).some(L => L.kind === 'smd' && L.model === m && L.state === 'down')) P.preds.push({ key: lane.id, ref: lane.id, text: `PBA ${SIZE(m)} runs out for assembly`, sub: 'PBA supermarket · SMD line down', eta: lane.rw }); }
      for (const s of P.stations) if (s.degrade > 0 && s.state !== 'down') P.preds.push({ key: s.id, ref: s.id, text: `${s.name} fails`, sub: `${P.lines[s.line].name} · bearing wear`, eta: (s.health - 22) / s.degrade, covered: !!s.planned });
      emit('think');
    }
    function recsList() {
      return [...recs.values()].filter(r => !r.dismissed).sort((a, b) => ({ crit: 0, warn: 1, info: 2 }[a.level] - { crit: 0, warn: 1, info: 2 }[b.level]) || a.t - b.t);
    }

    /* ----- actions ----- */
    const ext = {};   // handlers registered by the enterprise layer
    function apply(id, who = 'You') {
      const [k, arg] = id.split(/:(.+)/);
      if (k === 'focus') { emit('focus', arg); return; }
      if (ext[k]) { ext[k](arg, who); thinkSoon = true; emit('recs'); return; }
      recs.delete(id);
      if (k === 'expedite') {
        const b = P.bufs[arg], m = b.mission;
        if (m && m.veh && m.veh.fault) { m.veh.mission = null; m.veh = null; }
        if (m && !m.veh) { m.prio = 3; const a = P.agvs.filter(x => !x.fault && x.mission && x.phase === 'toPick').sort((x, y) => runway(y.mission.buf) - runway(x.mission.buf))[0]; if (a) { const old = a.mission; old.veh = null; a.mission = null; assign(a, m); log('AI', `Logistics agent moved ${a.id} to ${b.code} for ${P.byId[b.station].name}`); } }
        audit(who, 'Expedited delivery', `${b.code} to ${P.byId[b.station].name} (${P.lines[b.line].name})`);
      } else if (k === 'hot') {
        const b = P.bufs[arg]; const src = P.bufs[b.src];
        const a = P.agvs.find(x => !x.mission && !x.fault) || P.agvs.filter(x => x.mission && x.phase === 'toPick')[0];
        // one delivery per buffer: a run already on its way is left alone, a waiting one becomes the hot run
        // and never more than fits: what is on the line plus what is already coming (a milk run, for example) stays within capacity
        const room = Math.floor(b.cap - level(b) - (b.mission ? 0 : b.pending || 0));
        if (b.mission && b.mission.veh) { log('AI', `${b.mission.veh.id} is already bringing ${b.code} to ${P.byId[b.station].name}`); }
        else if (room <= 0 && !b.mission) { log('AI', `Enough ${b.code} is already on its way to ${P.byId[b.station].name}`); }
        else if (a && level(src) > 0) {
          if (a.mission) { a.mission.veh = null; a.mission = null; }
          const m = b.mission || { id: 'M' + (++P.seq), buf: b, code: b.code, src, qty: Math.min(b.batch, Math.floor(level(src)), room), created: P.t, veh: null, kind: 'agv' };
          m.prio = 3; m.reason = 'Hot run';
          if (!missions.includes(m)) missions.push(m);
          if (!b.mission) b.pending = (b.pending || 0) + m.qty; b.mission = m;
          m.onDone = () => { b.mission = null; };
          assign(a, m);
          log('AI', `Logistics agent sent ${a.id} on a hot run: ${m.qty} ${b.code} to ${P.byId[b.station].name}`);
          audit(who, 'Hot run', `${b.code} to ${P.byId[b.station].name}`);
        }
      } else if (k === 'planRepair') {
        const s = P.byId[arg]; if (!s || s.state === 'down') return;
        recs.delete('rul:' + arg);
        s.planned = true; s.degrade = 0; setState(s, 'maint', 'Planned bearing change'); s.repair = 480; alarm(`${s.id}.HEALTH`, false);
        if (s.wo && s.wo.status === 'Scheduled') s.wo.status = 'Open'; else workOrder(s, 'Predictive', 'Spindle bearing change (vibration trend)', 2, { by: who });
        audit(who, 'Planned repair', `${s.name} (${P.lines[s.line].name}) bearing change now, 8 min`);
        log('CMMS', `Work order approved · ${s.name} bearing change on ${P.lines[s.line].name}`, 'info', s.id);
        sendTech(s);
        s.onRepaired = () => { s.planned = false; P.saved += 1900000; log('AI', `Breakdown avoided on ${s.name}: about 35 minutes of downtime and EGP 1.9M of output protected`, 'info', s.id); emit('toast', { msg: `Breakdown avoided on ${s.name}. About EGP 1.9M protected.`, level: 'success' }); };
      } else if (k === 'switchSmd') {
        const [lid, m] = arg.split(':'); const L = P.lines[lid];
        const from = L.model; L.model = m; L.ls.PCB.code = 'PCB-' + SIZE(m); L.ls.PCB.src = 'LOC:PCB-' + SIZE(m); L.ls.PCB.label = MAT['PCB-' + SIZE(m)].name;
        // return the old boards to stock; the milk run brings the new ones
        moveLots(L.ls.PCB, STORE.LOC['PCB-' + SIZE(from)], L.ls.PCB.qty); moveLots(STORE.LOC['PCB-' + SIZE(m)], L.ls.PCB, 80);
        L.stations.forEach(s => { if (s.state === 'down' || s.state === 'maint') return; setState(s, 'changeover', `Changeover to PBA ${SIZE(m)}`); s.co = 600; });
        recs.delete('pba:' + m);
        audit(who, 'Product changeover', `${L.name}: PBA ${SIZE(from)} → PBA ${SIZE(m)}`);
        log('GMES', `${L.name} changeover to PBA ${SIZE(m)} started (10 min) · SAP production order re-assigned`, 'info', L.stations[0].id);
        emit('changeover', { line: L, from, to: m });
      } else if (k === 'fixShot') {
        const S = P.scen.shortshot; if (!S) return; S.fixed = true;
        for (const l of S.lots) P.holds.add(l);
        const im = P.byId[S.st];
        setState(im, 'maint', 'Check ring replacement'); im.repair = 1500; sendTech(im);
        im.shots = Math.ceil((im.shots + 1) / 40) * 40;   // good shots after the repair start a new lot, not the held one
        const sp = P.byId.IM20; sp.part = im.part; sp.base = INJ_CYCLE[im.part]; sp.batchOut = INJ_CAV[im.part]; setState(sp, 'changeover', `Mould change to ${im.part}`); sp.co = 2400; sp.mold = `MD-${im.part}-S`;
        audit(who, 'Held lots and moved mould', `${S.lots.size} lots of ${im.name} held · ${im.part} on IM20`);
        log('QMS', `${S.lots.size} back-cover lots from ${im.name} on hold · sorting at the lines`, 'warn', im.id);
        P.saved += 640000; emit('toast', { msg: `${im.name} lots held. Back covers move to IM20 after a 40-minute mould change.`, level: 'success' });
      } else if (k === 'fixCoat') {
        const S = P.scen.coating; if (!S) return; S.fixed = true; for (const l of S.lots || []) P.holds.add(l);
        audit(who, 'Repaired burner, held lots', `${P.lines[S.line].name} oven back to 200 °C`);
        log('QMS', `${(S.lots || new Set()).size} chassis lots on hold · oven back to cure temperature`, 'warn', S.line + '-Coating');
        P.saved += 420000;
      } else if (k === 'rollback') {
        const S = P.scen.software; if (!S) return; S.fixed = true;
        P.sw['PBA-55'] = { version: S.good, released: P.t, by: 'PE (rollback)' };
        let n = 0; for (const u of P.units) if (u.type === 'pba' && u.sw === S.bad && !u.usedIn) { u.sw = S.good; u.steps.push({ st: 'SMD1-SWdownload', name: 'Re-flash', line: 'SMD1', t0: P.t, t1: P.t, ok: true, note: `${S.bad} → ${S.good}` }); n++; }
        audit(who, 'Rolled back firmware', `PBA 55 writers ${S.bad} → ${S.good} · ${n} boards re-flashed`);
        log('GMES', `Writers on SMD 1 and 2 rolled back to ${S.good} · ${n} boards re-flashed in the supermarket`, 'info', 'SMD1-SWdownload');
        emit('swRelease', { code: 'PBA-55', version: S.good, rollback: true }); P.saved += 880000;
      } else if (k === 'moveOps') {
        const S = P.scen.absent; if (!S) return; S.fixed = true;
        const from = P.lines.ML6.stations.filter(s => s.manual).flatMap(s => s.crew.filter(p => p.present)).slice(0, 6);
        const holes = P.lines.ML3.stations.filter(s => s.manual).flatMap(s => s.crew.filter(p => !p.present));
        holes.forEach((p, i) => { p.present = true; const src = from[i]; if (src) { p.cover = src.name; src.present = false; src.movedTo = 'ML3'; } else p.cover = 'Overtime'; });
        audit(who, 'Moved operators', '6 from main line 6 to main line 3 · 2 h overtime for 2');
        log('HR', '6 certified operators moved from main line 6 to line 3 · overtime approved for 2', 'info', 'ML3-PBAandSMPS');
      } else if (k === 'boost') {
        const L = P.lines[arg]; L.speed = 1.08; L.boosted = true;
        audit(who, 'Raised line speed', `${L.name} 100% → 108%`); log('GMES', `${L.name} speed raised to 108%`, 'info', L.stations[0].id);
      }
      thinkSoon = true; emit('recs');
    }

    /* ----- drills ----- */
    const timers = [];
    const later = (sec, fn) => timers.push({ at: P.t + sec, fn });
    function trigger(id, who = 'You') {
      const sc = SCENARIOS.find(s => s.id === id); if (sc) audit(who, 'Started drill', sc.title);
      const S = P.scen;
      // a drill compresses time: the fault started a while ago, so its first parts are already at the lines
      const early = (lines, k) => { for (const n of lines) { const b = P.lines[n].ls[k]; if (b && b.lots && b.lots[0]) return b.lots[0].id; } };
      if (id === 'bearing') { const s = P.byId['SMD4-MounterB']; if (s.state === 'down' || s.degrade) return; s.health = Math.min(s.health, 74); s.degrade = 0.03; s.failWhy = 'Spindle bearing seized'; s.failRepair = 2100; log('IoT', 'SMD line 4 Mounter B vibration trend changed slope', 'warn', s.id); }
      else if (id === 'shortshot') { S.shortshot = { st: 'IM10', lots: new Set(), fails: 0 }; ['ML4', 'ML5'].forEach(n => { const l = early([n], 'BC'); if (l) S.shortshot.lots.add(l); }); for (const u of P.units) if (u.type === 'tv' && !u.packed && u.model === 'M65' && u.lots.bc && R() < 0.6) S.shortshot.lots.add(u.lots.bc); log('IoT', 'IM10 injection pressure dropping · cavity fill below 95%', 'warn', 'IM10'); }
      else if (id === 'coating') { S.coating = Object.assign(S.coating || {}, { line: 'PR4', drop: 18, fixed: false, lots: new Set(), fails: 0 }); ['ML4', 'ML5'].forEach(n => { const l = early([n], 'CHS'); if (l) S.coating.lots.add(l); }); log('IoT', 'Press line 4 coating oven burner fault · temperature falling', 'warn', 'PR4-Coating'); }
      else if (id === 'software') { const cur = P.sw['PBA-55'].version; S.software = { bad: 'v3.2.0', good: cur, fails: 0 }; P.sw['PBA-55'] = { version: 'v3.2.0', released: P.t, by: 'PE · Eng. Hany Samir' }; for (const n of ['ML1', 'ML2']) P.lines[n].ls.PBA.items.slice(0, 14).forEach(u => { u.sw = 'v3.2.0'; }); log('PE', `Firmware v3.2.0 released for PBA 55 · writers on SMD 1 and 2 updated by GMES`, 'info', 'SMD1-SWdownload'); emit('swRelease', { code: 'PBA-55', version: 'v3.2.0' }); }
      else if (id === 'absent') { const st = P.lines.ML3.stations.filter(s => s.manual); let n = 0; for (const s of st) for (const p of s.crew) if (n < 8 && R() < 0.9) { p.present = false; n++; } S.absent = { fixed: false, n }; log('HR', `${n} operators absent on main line 3 (shift A)`, 'warn', 'ML3-PBAandSMPS'); }
      else if (id === 'power') {
        for (let i = 1; i <= 6; i++) { P.lines['SMD' + i].tripped = true; P.lines['PR' + i].tripped = true; }
        alarm('GRID.DIP', true, { prio: 1, area: 'Utilities', msg: 'Grid voltage dip 18% for 400 ms · SMD lines and coating ovens tripped', ref: 'UTIL-TX1' });
        log('AI', 'Energy agent: restarting SMD lines two at a time, 45 s apart, then the coating ovens');
        for (let k = 0; k < 3; k++) later(60 + k * 45, () => { P.lines['SMD' + (k * 2 + 1)].tripped = false; P.lines['SMD' + (k * 2 + 2)].tripped = false; log('EMS', `SMD lines ${k * 2 + 1} and ${k * 2 + 2} restarted`); });
        later(240, () => { for (let i = 1; i <= 6; i++) P.lines['PR' + i].tripped = false; alarm('GRID.DIP', false); log('EMS', 'Coating ovens restarted · all lines running'); P.saved += 260000; });
      }
      else emit('drill', id);   // container, carton, field: handled by the enterprise layer
      thinkSoon = true; emit('scenario', id);
    }

    /* ----- step ----- */
    let thinkSoon = false, acc1 = 0, acc2 = 0, acc5 = 0;
    // the shift handover at 14:00 and 22:00 (and 06:00): the shift's result goes in the log and the record, the next
    // shift starts its own count and its own plan; the forecast's bias samples restart with it
    function handover() {
      const k = P.kpi, names = { A: 'B', B: 'C', C: 'A' };
      const done = { name: P.shift.name, start: SHIFT_START, end: SHIFT_END, units: k.units || 0, plan: k.planEnd || 0, oee: k.oee || 0, fpy: k.fpy || 0 };
      P.shifts.push(done);
      P.shift = { name: names[done.name], start: SHIFT_END, end: SHIFT_END + 8 * 3600, off: k.today || 0 };
      SHIFT_START = P.shift.start; SHIFT_END = P.shift.end;
      fcHist.length = 0; shiftForecast.last = -1e9;
      const gap = done.units - done.plan;
      log('GMES', `Shift ${done.name} closed: ${done.units.toLocaleString('en-US')} TVs packed against a plan of ${done.plan.toLocaleString('en-US')} (${gap >= 0 ? '+' : ''}${gap.toLocaleString('en-US')}) · shift ${P.shift.name} running`, gap >= 0 ? 'info' : 'warn');
      audit('GMES', 'Shift handover', `Shift ${done.name} to shift ${P.shift.name} · ${done.units} of ${done.plan}`);
      emit('shift');
    }
    function step(dt) {
      P.t += dt;
      if (P.t >= SHIFT_END) handover();
      for (let i = timers.length - 1; i >= 0; i--) if (timers[i].at <= P.t) { const f = timers[i].fn; timers.splice(i, 1); f(); }
      for (const sg of P.segs) {
        const v = sg.speed * (sg.from && P.lines[sg.from.line] ? P.lines[sg.from.line].speed : 1);
        for (let i = 0; i < sg.items.length; i++) { const it = sg.items[i]; const lim = i === 0 ? sg.len : sg.items[i - 1].s - sg.pitch; it.s = Math.max(it.s, Math.min(lim, it.s + v * dt)); }
      }
      for (const s of P.stations) if (s !== REWORK && s !== SMTREP) stationStep(s, dt);
      repairsStep();
      for (const a of P.agvs) agvStep(a, dt);
      for (const t of P.tuggers) tuggerStep(t, dt);
      for (const f of P.forklifts) forkliftStep(f, dt);
      peopleStep(dt); inboundStep(dt);
      for (const o of P.orders) if (o.state === 'open' && P.t >= o.due - 50 * 60) truckArrive(o);
      for (const tr of P.trucks) {
        if (tr.state === 'arriving') { tr.k = Math.min(1, tr.k + dt / 40); if (tr.k >= 1) tr.state = 'loading'; }
        else if (tr.state === 'leaving') { tr.k = Math.max(0, tr.k - dt / 40); if (tr.k <= 0) tr.state = 'gone'; }
        else if (tr.state === 'loading' && P.t > tr.order.due + 20 * 60 && tr.loaded > 0) truckDepart(tr);
        else if (tr.state === 'loading' && P.t > tr.order.due + 60 * 60 && !tr.loaded) { const o = tr.order; tr.state = 'leaving'; tr.k = 1; o.truck = null; o.state = 'open'; o.due += 2 * 3600; o.repromised = (o.repromised || 0) + 1; log('Shipping', `${tr.id} left ${tr.dock.id} empty: no ${MODELS[o.model].name} in finished goods · ${o.id} re-promised to ${clock(o.due)}`, 'warn'); }
      }
      for (const tr of P.trucks) if (tr.state === 'gone' && tr.dock.truck === tr) tr.dock.truck = null;
      P.trucks = P.trucks.filter(t => t.state !== 'gone');
      acc1 += dt; acc2 += dt; acc5 += dt;
      if (acc1 >= 1) {
        acc1 = 0;
        for (const b of Object.values(LS)) if (b.feed === 'agv' && E_level(b) <= b.rop && !b.mission) createMission(b, 1, 'Kanban');
        for (const b of Object.values(SILO)) if (level(b) <= b.rop && !b.mission) { b.feed = 'forklift'; createMission(b, 1, 'Silo level'); }
        dispatch();
        for (const s of P.stations) sensors(s);
        utilStep();
        for (const p of P.pallets) if (p.where === 'truck' && p.truck && p.truck.state === 'gone') { p.where = 'shipped'; p.units.forEach(archive); }
        P.pallets = P.pallets.filter(p => p.where !== 'shipped');
        P.energy.kwh += (P.kpi.kw || 0) / 3600;
        emit('second');
      }
      if (acc2 >= 2 || thinkSoon) { acc2 = 0; thinkSoon = false; think(); P.recs = recsList(); pmDue(); }
      if (acc5 >= 5) { acc5 = 0; kpis(); for (const s of P.stations) record(s); if (P.t >= START && P.t - (P.snaps.length ? P.snaps[P.snaps.length - 1].t : 0) >= 20) snap(); }
    }
    const E_level = level;
    function run(realDt) {
      if (P.paused) return;
      let left = realDt * P.speed; const h = P.speed > 8 ? 0.25 : 0.1; let n = 0;
      while (left > 1e-6 && n < 400) { const d = Math.min(h, left); step(d); left -= d; n++; }
      emit('tick');
    }

    /* ----- layout for the view ----- */
    P.layout = {
      W, D, AISLES, STOPS, POS, DOCKS, INDOCK, LINE_Z, SMD_Z, PRESS_Z, TROUTE,
      ZONES: [
        { id: 'imp', name: 'Import warehouse', x0: 2, z0: 2, x1: 50, z1: 35, view: [26, 18, 70] },
        { id: 'loc', name: 'Local-vendor supermarket', x0: 56, z0: 2, x1: 104, z1: 35, view: [80, 18, 70] },
        { id: 'smd', name: 'SMD and PBA hall', x0: 110, z0: 2, x1: 200, z1: 37, view: [150, 18, 90] },
        { id: 'office', name: 'Offices', x0: 207, z0: 2, x1: 262, z1: 37, view: [234, 19, 70] },
        { id: 'inj', name: 'Injection moulding', x0: 2, z0: 42, x1: 50, z1: 122, view: [24, 82, 100] },
        { id: 'lcm', name: 'LCM lines', x0: 56, z0: 42, x1: 104, z1: 122, view: [80, 82, 100] },
        { id: 'main', name: 'Main assembly lines', x0: 110, z0: 42, x1: 201, z1: 122, view: [156, 82, 120] },
        { id: 'fg', name: 'Finished goods and shipping', x0: 207, z0: 42, x1: 262, z1: 122, view: [234, 82, 100] },
        { id: 'press', name: 'Press, coating and sub-assembly', x0: 2, z0: 127, x1: 104, z1: 166, view: [52, 146, 90] },
        { id: 'util', name: 'Utilities, maintenance and QA lab', x0: 110, z0: 127, x1: 201, z1: 166, view: [150, 146, 80] },
        { id: 'svc', name: 'Service-parts warehouse', x0: 207, z0: 127, x1: 262, z1: 166, view: [234, 146, 70] }
      ]
    };

    /* ----- firmware releases (PE) ----- */
    P.sw = { 'PBA-43': { version: 'v2.8.4', released: START - 86400 * 9, by: 'PE' }, 'PBA-55': { version: 'v3.1.4', released: START - 86400 * 5, by: 'PE' }, 'PBA-65': { version: 'v4.0.2', released: START - 86400 * 12, by: 'PE' }, 'PBA-75': { version: 'v4.0.2', released: START - 86400 * 12, by: 'PE' } };

    /* ----- warm start: fifty minutes of running so every line, conveyor and store is naturally full ----- */
    for (const m of Object.keys(MODELS)) {
      const lane = STORE.PBA['PBA-' + SIZE(m)];
      const n = Object.values(P.lines).filter(L => L.kind === 'main' && L.model === m).length * 110;
      for (let i = 0; i < n; i++) { const u = unit('pba', { model: m, line: 'SMD' + (1 + SMD_MODELS.indexOf(m)), code: 'PBA-' + SIZE(m), born: START - 7200 - i * 12, sw: P.sw['PBA-' + SIZE(m)].version }); u.steps.push({ st: 'SMD-AOI', name: 'SMD and PBA test', line: u.line, t0: u.born, t1: u.born + 900, ok: true, note: `Pass · firmware ${u.sw}` }); u.loc = { k: 'store', b: lane }; lane.items.push(u); }
    }
    for (let i = 1; i <= 6; i++) { const L = P.lines['ML' + i]; moveItems(STORE.PBA[L.ls.PBA.code], L.ls.PBA, 40); }
    function moveItems(from, to, n) { const it = from.items.splice(0, n); it.forEach(u => { u.loc = { k: 'ls', b: to }; }); to.items.push(...it); }
    P.t = START - 32 * 60;
    for (const s of P.stations) if (s.kind === 'cushion') s.procs = [];
    // the aging racks are full when the model starts: TVs assembled earlier this shift, ageing in arrival order
    for (const s of P.stations) if (s.kind === 'aging') {
      const L = P.lines[s.line]; s.rack = [];
      for (let i = 0; i < s.slots - 4; i++) {
        const u = unit('tv', { model: L.model, line: L.id, born: P.t - 3000 + i * 10 });
        u.steps.push({ st: L.stations[0].id, name: 'Assembly', line: L.id, t0: u.born, t1: u.born + 1500, ok: true, note: 'Assembled before the model started' });
        u.agedFrom = P.t - AGE + 30 + i * (AGE / s.slots); u.loc = { k: 'aging', st: s }; stepRec(u, s); s.rack.push(u);
      }
    }
    // the coating ovens run around the clock: each starts the morning full of chassis parts
    for (const s of P.stations) if (s.kind === 'oven') for (let i = 0; i < s.slots; i++) s.procs.push({ left: (i + 1) * s.base, lot: `${s.line}-CT-${pad(Math.floor((START - 3600) / 1200), 3)}`, cure: 199 });
    // a coarse step for the first twenty minutes, then the normal one, so the page opens fast
    while (P.t < START - 12 * 60) step(1);
    while (P.t < START) step(0.5);
    P.events.length = 0; P.audit.length = 0; recs.clear(); alarmMap.clear(); P.alarms = [];
    for (const s of P.stations) { s.hist = {}; for (let i = 0; i < 30; i++) { sensors(s); record(s); } }
    for (let i = 0; i < 20; i++) kpis();
    log('GMES', 'Shift A running · Plant EG-01 · 6 main lines, 6 LCM, 6 SMD, 20 injection, 6 press and coating, 6 cushion machines');
    think(); P.recs = recsList();
    // preventive maintenance already planned in SAP PM for the rest of the shift
    [['SMD2-MounterA', 'Nozzle and feeder clean (weekly)', 12.5], ['IM05', 'Mould cooling-circuit flush (monthly)', 13], ['PR3-Press', 'Die lubrication and bolt torque check (weekly)', 13.25], ['ML4-Screwandstand', 'Screwdriver torque calibration (quarterly)', 13.5]].forEach(([id, why, h], i) => {
      if (P.byId[id]) P.wo.push({ id: 'WO' + (4170 + i), st: id, type: 'Preventive', why, prio: 3, opened: SHIFT_START - 86400, status: 'Scheduled', due: h * 3600, tech: null });
    });

    const api = {
      P, MODELS, MAT, BOM, KIND, SCENARIOS, STORE, LS, SILO, missions, SIZE,
      clock, clockS, mins, level, take, addLot, moveLots, lotId, runway,
      on(fn) { listeners.push(fn); }, emit, log, audit, alarm, rec, recs: () => recsList(),
      run, step, trigger, apply, findUnit, route, receive, later, truckArrive, workOrder,
      ext(name, fn) { ext[name] = fn; },
      // machine commands from the HMI; the page checks the interlocks before it calls this
      // ISA-18.2 alarm handling from the command room: acknowledge, acknowledge all, shelve for a while (logged)
      ackAlarm(key, who = 'You') { const a = P.alarms.find(x => x.key === key); if (!a || a.state === 'ack') return; a.state = 'ack'; a.ackBy = who; a.ackAt = P.t; audit(who, 'Acknowledged alarm', a.msg); emit('alarms'); },
      ackAll(who = 'You') { let n = 0; for (const a of P.alarms) if (a.state !== 'ack' && !(a.shelvedTo > P.t)) { a.state = 'ack'; a.ackBy = who; a.ackAt = P.t; n++; } if (n) audit(who, 'Acknowledged all alarms', `${n} alarms`); emit('alarms'); return n; },
      shelveAlarm(key, min = 20, who = 'You') { const a = P.alarms.find(x => x.key === key); if (!a) return; a.shelvedTo = P.t + min * 60; audit(who, 'Shelved alarm', `${a.msg} · ${min} min`); emit('alarms'); },
      hmi(id, cmd, who = 'You') {
        const s = P.byId[id]; if (!s) return;
        const L = P.lines[s.line], where = `${s.name}${L ? ' (' + L.name + ')' : ''}`;
        const say = (what, detail) => { audit(who, what, `${where}${detail ? ' · ' + detail : ''}`); log('HMI', `${what}: ${where}${detail ? ' · ' + detail : ''}`, 'info', s.id); };
        if (cmd === 'stop') { s.hold = true; say('Machine stopped from the HMI'); }
        else if (cmd === 'start') { s.hold = false; if (s.state === 'idle') setState(s, 'idle'); say('Machine started from the HMI'); }
        else if (cmd === 'faster' || cmd === 'slower') { s.speedMul = Math.max(0.92, Math.min(1.2, (s.speedMul || 1) * (cmd === 'faster' ? 0.95 : 1.1))); say('Machine speed changed', `${Math.round(100 / s.speedMul)}% of rated`); }
        else if (cmd === 'loto') { s.hold = true; s.loto = { by: who, at: P.t }; setState(s, 'maint', 'Locked out (LOTO)'); s.repair = 0; say('Lockout-tagout applied', 'electrical and pneumatic energy isolated'); workOrder(s, 'Corrective', 'Inspection under lockout', 3, { status: 'In progress', tech: 'Maintenance on call', by: who }); }
        else if (cmd === 'unloto') { s.loto = null; s.hold = false; if (s.tech) { sendHome(s.tech); s.tech = null; } if (s.wo && s.wo.type === 'Corrective') { s.wo.status = 'Completed'; s.wo.closed = P.t; s.wo = null; } setState(s, 'idle'); say('Lockout removed', 'machine released to production'); }
        thinkSoon = true; emit('hmi', { s, cmd }); emit('recs');
      },
      setSpeed(v) { P.speed = v; P.paused = v === 0; emit('speed'); },
      fastForward(sec) { const h = 0.25; for (let i = 0; i < sec / h; i++) { step(h); if (i % 240 === 239) emit('tick'); } emit('tick'); emit('recs'); },
      dismiss(key) { const r = recs.get(key); if (r) { r.dismissed = true; P.recs = recsList(); emit('recs'); } },
      changeover(lineIdx, model, who = 'You') {
        // a main line changes model: its LCM line and cushion machine follow; line-side stock goes back to the stores
        const ML = P.lines['ML' + lineIdx], LC = P.lines['LCM' + lineIdx], CU = P.lines['CUS' + lineIdx], from = ML.model, s = SIZE(model);
        if (from === model) return;
        for (const k in ML.ls) {
          const b = ML.ls[k]; if (b.feed === 'conveyor') { b.lots = []; b.qty = 0; } else if (b.items) { moveItems(b, STORE.PBA[b.code], b.items.length); } else moveLots(b, P.bufs[b.src], b.qty);
          const code = { PBA: 'PBA-', SMPS: 'SMPS-', BC: 'BC-', CHS: 'CHS-', CUS: 'CUS-', CTN: 'CTN-' }[k];
          if (code) { b.code = code + s; b.label = MAT[b.code].name; if (b.src !== 'conv') b.src = (k === 'PBA' ? 'PBA:' : k === 'SMPS' ? 'IMP:' : k === 'BC' ? 'INJ:' : k === 'CHS' ? 'PRS:' : 'LOC:') + b.code; }
          if (k === 'STD') { b.code = MODELS[model].stand; b.label = MAT[b.code].name; b.src = 'INJ:' + b.code; }
        }
        for (const k in LC.ls) { const b = LC.ls[k]; moveLots(b, P.bufs[b.src], b.qty); b.code = (k === 'OC' ? 'OC-' : 'BLU-') + s; b.label = MAT[b.code].name; b.src = 'IMP:' + b.code; }
        ML.model = model; LC.model = model; CU.model = model;
        for (const st of ML.stations.concat(LC.stations, CU.stations)) { if (st.state === 'down' || st.state === 'maint') continue; setState(st, 'changeover', `Changeover to ${MODELS[model].name}`); st.co = st.line.startsWith('CUS') ? 1200 : 900; }
        audit(who, 'Model changeover', `${ML.name}: ${MODELS[from].name} → ${MODELS[model].name}`);
        log('GMES', `${ML.name}, LCM line ${lineIdx} and cushion machine ${lineIdx}: changeover to ${MODELS[model].name} (15 min)`, 'info', ML.stations[0].id);
        emit('changeover', { line: ML, from, to: model });
      }
    };
    return api;
  }

  const PlantEngine = { create, SCENARIOS, clock, clockS, mins };
  if (typeof module !== 'undefined' && module.exports) module.exports = PlantEngine;
  else root.PlantEngine = PlantEngine;
})(typeof window !== 'undefined' ? window : globalThis);
