/* Digital Factory — Plant EG-01 enterprise twin: the offices and the systems.
   Sits on top of the shop-floor engine (engine.js) and runs what the offices run: sales orders and the ATP check (SAP SD),
   purchase orders, vendor deliveries and stock (SAP MM), production orders and confirmations (SAP PP), inspection lots
   and holds (SAP QM), revenue, cost and inventory value (SAP FI/CO), the monthly S&OP, the master production schedule,
   MRP, engineering changes and firmware releases (PE and the BOM team), service parts (SVC) and the people (HR).
   Every message between the floor and SAP passes through GMES and is kept, so the views can animate it.
   Pure model: no DOM. All names, customers, vendors and numbers are fictional; the plant is simulated. */
(function (root) {
  'use strict';

  function mulberry(seed) {
    let a = seed >>> 0;
    return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const pad = (n, w) => String(n).padStart(w, '0');
  const egp = v => {
    const a = Math.abs(v), s = v < 0 ? '−' : '';
    return a >= 1e9 ? `${s}EGP ${(a / 1e9).toFixed(2)}B` : a >= 1e6 ? `${s}EGP ${(a / 1e6).toFixed(1)}M` : a >= 1e3 ? `${s}EGP ${Math.round(a / 1e3)}k` : `${s}EGP ${Math.round(a)}`;
  };
  const num = v => Math.round(v).toLocaleString('en-US');

  // ISO week number of a date
  function isoWeek(d) {
    const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const day = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - day);
    const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
    return Math.ceil(((t - y0) / 864e5 + 1) / 7);
  }

  /* ---------------- the organisation ---------------- */
  // departments: who they are, what they own, which systems they work in
  const DEPTS = [
    { id: 'sales', name: 'Sales', head: 'Nadia Fathy', staff: 18, systems: ['SAP-SD'], owns: 'Customers, order book, ATP promises, demand forecast' },
    { id: 'planning', name: 'Planning', head: 'Karim Adel', staff: 8, systems: ['SAP-PP', 'SOP'], owns: 'S&OP, master production schedule, MRP, line loading' },
    { id: 'scm', name: 'SCM · Purchasing and logistics', head: 'Hossam Nabil', staff: 26, systems: ['SAP-MM', 'WMS'], owns: 'Purchase orders, import and local vendors, warehouses, milk runs, AGVs' },
    { id: 'pe', name: 'PE · Production engineering', head: 'Eng. Tarek Samir', staff: 34, systems: ['PLM', 'GMES', 'SAP-PM'], owns: 'Electrical, mechanical and software engineers; machines, jigs, firmware releases, maintenance' },
    { id: 'bom', name: 'BOM team', head: 'Rania Kamal', staff: 6, systems: ['PLM', 'SAP-PP'], owns: 'Bills of materials, engineering-change effectivity, material master' },
    { id: 'quality', name: 'Quality', head: 'Dr. Laila Hassan', staff: 42, systems: ['SAP-QM', 'GMES'], owns: 'IQC on receipts, IPQC on the lines, OQC before shipping, the lab, holds' },
    { id: 'svc', name: 'SVC · Service parts', head: 'Omar Reda', staff: 16, systems: ['SAP-SD', 'SAP-MM'], owns: 'Spare parts for service centres and customers, field-failure feedback' },
    { id: 'hr', name: 'HR', head: 'Mai Lotfy', staff: 9, systems: ['HR'], owns: 'Attendance, skills matrix, overtime, hiring and training' },
    { id: 'finance', name: 'Finance', head: 'Amr Zaki', staff: 12, systems: ['SAP-FICO'], owns: 'Revenue, product cost, inventory value, budgets, approvals' },
    { id: 'production', name: 'Production', head: 'Eng. Youssef Salem', staff: 0, systems: ['GMES'], owns: 'Six main assembly lines and all sub-lines, shifts, output' },
    { id: 'it', name: 'GMES and IT', head: 'Sherif Gamal', staff: 7, systems: ['GMES', 'SAP', 'WMS', 'PLM'], owns: 'GMES, SAP interfaces, networks, data' }
  ];
  // systems and modules that exchange messages
  const SYSTEMS = [
    { id: 'SAP-SD', name: 'SAP SD', sub: 'Sales and delivery', group: 'sap' },
    { id: 'SAP-PP', name: 'SAP PP', sub: 'Production orders, MRP', group: 'sap' },
    { id: 'SAP-MM', name: 'SAP MM', sub: 'Purchasing and stock', group: 'sap' },
    { id: 'SAP-QM', name: 'SAP QM', sub: 'Inspection and holds', group: 'sap' },
    { id: 'SAP-FICO', name: 'SAP FI/CO', sub: 'Finance and costing', group: 'sap' },
    { id: 'SAP-PM', name: 'SAP PM', sub: 'Maintenance orders', group: 'sap' },
    { id: 'SOP', name: 'S&OP', sub: 'Demand and supply plan', group: 'sap' },
    { id: 'GMES', name: 'GMES', sub: 'Shop floor: every line', group: 'floor' },
    { id: 'WMS', name: 'WMS', sub: 'Stores, AGVs, milk runs', group: 'floor' },
    { id: 'PLM', name: 'PLM', sub: 'BOMs, ECNs, firmware', group: 'eng' },
    { id: 'HR', name: 'HR system', sub: 'Attendance and skills', group: 'eng' }
  ];
  const CUSTOMERS = [
    { id: 'C1001', name: 'Northline Retail', ch: 'Retail chain' },
    { id: 'C1002', name: 'Bluepeak Stores', ch: 'Retail chain' },
    { id: 'C1003', name: 'Horizon Electronics', ch: 'Distributor' },
    { id: 'C1004', name: 'Eastgate Trading', ch: 'Export' },
    { id: 'C1005', name: 'Online marketplace', ch: 'E-commerce' },
    { id: 'C1006', name: 'Project sales · hotels', ch: 'B2B projects' }
  ];
  const SVC_CENTRES = ['Service centre North', 'Service centre South', 'Service centre East', 'Repair partner · online', 'Service centre West'];

  function create(E, opts = {}) {
    const P = E.P, MODELS = E.MODELS, MAT = E.MAT, BOM = E.BOM, STORE = E.STORE, SIZE = E.SIZE, level = E.level;
    const R = mulberry(opts.seed || 4242);
    const rnd = (a, b) => a + R() * (b - a);
    const pick = arr => arr[Math.floor(R() * arr.length)];
    const M = Object.keys(MODELS);
    const BOUGHT = Object.keys(MAT).filter(c => MAT[c].src === 'import' || MAT[c].src === 'local');
    const mainLines = () => Object.values(P.lines).filter(L => L.kind === 'main');

    const X = {
      DEPTS, SYSTEMS, CUSTOMERS, msgs: [], msgSeq: 0, po: [], pp: [], iqc: [], ecn: [], blocked: [], svc: { orders: [], shipped: 0, backorders: 0 },
      fin: { revenue: 0, cogs: 0, shipments: 0, units: 0, poValue: 0, scrap: 0, rework: 0, overtime: 0, expedite: 0 },
      t0: P.t, flows: {}, sop: null, mps: null, mrp: null, decisions: [], stats: { perMin: 0 }, block: {}, dec: new Map()
    };
    let soSeq = 5002810, poSeq = 4500918200, ppSeq = 1000452, dlvSeq = 80061400, invSeq = 90044100, svcSeq = 6100340, iqcSeq = 30012800, inSeq = 7310;

    /* ----- messages through GMES ----- */
    // every exchange between the floor, GMES, SAP and the offices is a message; the views draw them as moving packets
    // the interface each message travels on: an SAP IDoc (basic type), an API call, or a posting inside SAP
    const IDOC = {
      'SAP-PP>GMES:Order release': 'LOIPRO01', 'SAP-PP>GMES:Order switch': 'LOIPRO01', 'GMES>SAP-PP:Confirmation': 'CONF21', 'GMES>SAP-PP:Goods receipt': 'WMMBID02',
      'GMES>SAP-MM:Backflush': 'WMMBID02', 'WMS>SAP-MM:Goods receipt': 'WMMBID02', 'WMS>SAP-MM:Transfer': 'WMMBID02', 'WMS>SAP-SD:Goods issue': 'SHPCON',
      'SAP-MM>WMS:Purchase order': 'ORDERS05', 'SAP-PP>SAP-MM:Purchase order': 'ORDERS05', 'SAP-SD>SAP-PP:Sales order': 'ORDERS05', 'SAP-SD>WMS:Delivery': 'DELVRY03',
      'SAP-SD>WMS:Service order': 'DELVRY03', 'SAP-MM>WMS:Transfer': 'WMTOID01', 'SAP-MM>WMS:Stock transfer': 'WMTOID01', 'SAP-MM>WMS:Call-off': 'DELFOR02', 'SAP-SD>SAP-FICO:Billing': 'INVOIC02',
      'PLM>GMES:ECN release': 'ECMMAS', 'PLM>GMES:Firmware': 'DOCMAS', 'HR>SAP-FICO:Overtime': 'CATS (API)', 'GMES>SAP-QM:Defect': 'QM notification (API)',
      'GMES>SAP-PM:Work order': 'PM notification (API)', 'GMES>WMS:Handling unit': 'HU (API)', 'SOP>SAP-PP:MPS release': 'IBP → PIR (API)'
    };
    function msg(from, to, type, text, o) {
      const m = Object.assign({ id: ++X.msgSeq, t: P.t, time: E.clock(P.t), from, to, type, text, idoc: IDOC[`${from}>${to}:${type}`] || 'Posting in SAP' }, o);
      X.msgs.unshift(m); if (X.msgs.length > 400) X.msgs.pop();
      const k = from + '>' + to; X.flows[k] = (X.flows[k] || 0) + 1;
      E.emit('msg', m); return m;
    }
    // high-frequency floor events are summed and sent once a minute, the way GMES batches confirmations
    const acc = {};
    const add = (key, o, n = 1) => { const a = acc[key] || (acc[key] = Object.assign({ n: 0 }, o)); a.n += n; };
    function flush(all) {
      for (const key in acc) {
        const a = acc[key]; if (!all && a.kind !== 'pack') continue;
        delete acc[key]; if (!a.n) continue;
        if (a.kind === 'pack') {
          const L = P.lines[a.line], o = X.pp.find(p => p.line === a.line && p.status !== 'TECO');
          msg('GMES', 'SAP-PP', 'Confirmation', `${L.name} · ${a.n} × ${MODELS[a.model].name} confirmed · goods receipt 101${o ? ' · order ' + o.id : ''}`, { mvt: '101', line: a.line, qty: a.n, ref: a.line + '-Packing' });
        } else if (a.kind === 'gr') {
          msg('GMES', 'SAP-PP', 'Goods receipt', `${a.where} · ${num(a.n)} ${a.code} to stock · 101`, { mvt: '101', line: a.line, qty: a.n, ref: a.ref });
        } else if (a.kind === 'bf') {
          msg('GMES', 'SAP-MM', 'Backflush', `${P.lines[a.line] ? P.lines[a.line].name : a.line} · ${num(a.n)} components consumed · 261`, { mvt: '261', line: a.line, qty: a.n });
        } else if (a.kind === 'flash') {
          msg('PLM', 'GMES', 'Firmware', `${a.n} boards written with ${a.ver} on ${P.lines[a.line].name}`, { line: a.line, ref: a.line + '-SWdownload' });
        }
      }
    }
    E.on((type, d) => {
      if (type === 'unit' && d.kind === 'pack') add('pack:' + d.u.line, { kind: 'pack', line: d.u.line, model: d.u.model });
      else if (type === 'gr') {
        const L = P.lines[d.line];
        const where = L ? L.name : d.line;
        add(`gr:${d.line}:${d.code}`, { kind: 'gr', line: d.line, code: d.code, where, ref: d.st || d.line + '-ICTFCT' }, d.qty);
      } else if (type === 'consume') add('bf:' + d.line, { kind: 'bf', line: d.line }, d.qty >= 1 ? d.qty : 1);
      else if (type === 'swflash') add('fl:' + d.u.line, { kind: 'flash', line: d.u.line, ver: d.version });
      else if (type === 'move') {
        const by = d.by || '';
        msg('WMS', 'SAP-MM', 'Transfer', `${by} delivered ${num(d.qty)} ${d.code} · ${d.from.replace(':', ' ')} → line side · 311`, { mvt: '311', ref: d.to, qty: d.qty });
      } else if (type === 'pallet') msg('GMES', 'WMS', 'Handling unit', `${d.id} built on ${P.lines[d.line].name} · ${d.units.length} × ${MODELS[d.model].name}`, { line: d.line, ref: d.line + '-Palletizer' });
      else if (type === 'ship') onShip(d);
      else if (type === 'truck') msg('SAP-SD', 'WMS', 'Delivery', `Delivery ${d.order.dlv} for ${d.order.id} · ${d.id} at ${d.dock.id} · pick ${num(d.need)} × ${MODELS[d.model].name}`, { ref: 'order:' + d.order.id });
      else if (type === 'received') onReceived(d);
      else if (type === 'defect') {
        const u = d.u; const L = P.lines[u.line];
        msg('GMES', 'SAP-QM', 'Defect', `${u.defect.code} · ${u.sn} at ${d.st.name} (${L ? L.name : u.line}) · ${u.defect.cause}`, { ref: d.st.id, line: u.line });
        X.fin.rework += u.type === 'pba' ? 180 : 420;
      } else if (type === 'swRelease') {
        const ecn = { id: 'ECN-26-' + (130 + X.ecn.length), title: `${d.code} firmware ${d.version}${d.rollback ? ' (rollback)' : ''}`, type: 'Software', by: d.rollback ? 'PE + Quality' : 'PE · electrical / software', state: 'Released', t: P.t, eff: 'Immediate · writers on SMD lines' };
        X.ecn.unshift(ecn);
        msg('PLM', 'GMES', 'ECN release', `${ecn.id} · ${ecn.title} pushed to the PBA writers`, { ref: 'SMD1-SWdownload' });
      } else if (type === 'changeover') {
        const L = d.line;
        const old = X.pp.find(p => p.line === L.id && p.status !== 'TECO');
        if (old) { old.status = 'TECO'; old.closed = P.t; }
        releasePP(L);
        msg('SAP-PP', 'GMES', 'Order switch', `${L.name}: production order for ${d.to.startsWith('M') ? MODELS[d.to].name : d.to} released`, { ref: L.stations[0].id, line: L.id });
      } else if (type === 'event' && d.src === 'CMMS') msg('GMES', 'SAP-PM', 'Work order', d.msg, { ref: d.ref });
      else if (type === 'audit') onAudit();
      else if (type === 'drill') drill(d);
      else if (type === 'second') second();
    });

    /* ----- SD: customers, sales orders, ATP, deliveries, billing ----- */
    const fgQty = m => P.pallets.filter(p => p.model === m && ['fg', 'pickup', 'fork', 'build'].includes(p.where) && !p.svc).reduce((a, p) => a + p.units.length, 0);
    const openQty = m => P.orders.filter(o => o.model === m && (o.state === 'open' || o.state === 'loading')).reduce((a, o) => a + o.qty - o.shipped - (o.truck ? o.truck.loaded : 0), 0);
    const rate = m => {   // TVs an hour, measured on the main lines that build the model
      const ls = mainLines().filter(L => L.model === m);
      return ls.reduce((a, L) => a + (L.tph > 20 ? L.tph : 3600 / MODELS[m].takt * 0.8), 0);
    };
    const lastDue = {};
    function newOrder(m, due, o) {
      const pal = MODELS[m].pallet, r = Math.max(30, rate(m));
      const qty = (o && o.qty) || clamp(Math.round(r * rnd(0.32, 0.6) / pal), 4, 26) * pal;
      const c = (o && o.cust) || pick(CUSTOMERS);
      const so = Object.assign({ id: String(++soSeq), customer: c.name, custId: c.id, channel: c.ch, model: m, qty, due, state: 'open', shipped: 0, created: P.t, value: qty * MODELS[m].price, dlv: String(++dlvSeq) }, o);
      delete so.cust;
      // ATP: finished goods free now plus the production planned before the truck arrives
      const free = Math.max(0, fgQty(m) - openQty(m));
      const plan = Math.round(r * Math.max(0, (due - 50 * 60 - P.t) / 3600));
      so.atp = { free, plan, ok: free + plan >= qty };
      P.orders.push(so); lastDue[m] = Math.max(lastDue[m] || 0, due);
      return so;
    }
    function orderBook() {
      // keep about three hours of production promised, model by model, so finished goods neither pile up nor run dry
      for (const m of M) {
        const r = rate(m); if (r < 1) continue;
        if (openQty(m) < fgQty(m) + r * 3) {
          const gap = Math.max(12 * 60, (lastDue[m] || 0) - P.t);
          const due = Math.max(P.t + 110 * 60, (lastDue[m] || P.t) + rnd(14, 26) * 60);
          void gap;
          const so = newOrder(m, Math.round(due / 60) * 60);
          msg('SAP-SD', 'SAP-PP', 'Sales order', `Order ${so.id} · ${so.customer} · ${num(so.qty)} × ${MODELS[m].name} due ${E.clock(so.due)} · ATP ${so.atp.ok ? 'confirmed' : 'short ' + num(so.qty - so.atp.free - so.atp.plan)}`, { ref: 'order:' + so.id });
          if (!so.atp.ok) E.log('SAP SD', `ATP short for ${so.id}: ${num(so.qty)} × ${MODELS[m].name}, ${num(so.atp.free + so.atp.plan)} available by ${E.clock(so.due)}`, 'warn', 'order:' + so.id);
        }
      }
      // keep the list short: drop orders shipped more than two hours ago
      if (P.orders.length > 70) P.orders = P.orders.filter(o => !(o.shippedAt && P.t - o.shippedAt > 7200) || P.orders.indexOf(o) > P.orders.length - 40);
    }
    function onShip({ order: o, truck: tr }) {
      const m = MODELS[o.model], q = tr.loaded;
      X.fin.revenue += q * m.price; X.fin.cogs += q * (m.cost.mat + m.cost.lab + m.cost.ovh); X.fin.units += q; X.fin.shipments++;
      msg('WMS', 'SAP-SD', 'Goods issue', `${tr.id} left ${tr.dock.id} · delivery ${o.dlv} · ${num(q)} × ${m.name} · 601`, { mvt: '601', ref: 'order:' + o.id, qty: q });
      msg('SAP-SD', 'SAP-FICO', 'Billing', `Invoice ${++invSeq} to ${o.customer} · ${egp(q * m.price)}`, { ref: 'order:' + o.id });
    }

    /* ----- PP: production orders ----- */
    function lineOut(L) {
      if (L.kind === 'main') return L.made;
      const last = L.stations[L.stations.length - 1];
      return last ? last.counters.made : 0;
    }
    function releasePP(L) {
      const item = L.kind === 'main' ? L.model : L.kind === 'lcm' ? 'LCM-' + SIZE(L.model) : L.kind === 'smd' ? 'PBA-' + SIZE(L.model) : L.kind === 'press' ? 'CHS-' + L.size : L.kind === 'cushion' ? 'CUS-' + SIZE(L.model) : null;
      if (!item) return null;
      const takt = L.kind === 'main' || L.kind === 'lcm' || L.kind === 'cushion' ? MODELS[L.model].takt : L.kind === 'smd' ? 11 : 18;
      const qty = Math.round(3600 / takt * 0.82 * 8 / 10) * 10;
      const o = { id: String(++ppSeq), line: L.id, item, qty, base: lineOut(L), start: P.t, status: 'REL' };
      X.pp.push(o); return o;
    }
    for (const L of Object.values(P.lines)) if (['main', 'lcm', 'smd', 'press', 'cushion'].includes(L.kind)) {
      const o = releasePP(L); if (!o) continue;
      // shift A began at 06:00: the order carries what was already made
      const done = L.kind === 'main' ? Math.round(P.base[L.model] / mainLines().filter(x => x.model === L.model).length) : Math.round(o.qty * 0.38);
      o.base -= done; o.start = 6 * 3600;
    }
    X.ppProgress = o => { const L = P.lines[o.line]; const c = (o.status === 'TECO' ? o.final : lineOut(L) - o.base); return Math.max(0, c); };

    /* ----- MM: purchase orders, vendor deliveries and IQC ----- */
    const inTransit = code => X.po.filter(p => p.code === code && (p.status === 'In transit' || p.status === 'Held at port' || p.status === 'At dock')).reduce((a, p) => a + p.qty, 0);
    function placePO(code, qty, eta, why, o) {
      const mt = MAT[code];
      const p = Object.assign({ id: String(++poSeq), code, qty, vendor: mt.vendor, src: mt.src, price: mt.price, value: qty * mt.price, eta, created: P.t, status: 'In transit', why: why || 'Reorder point' }, o);
      const blk = X.block[code];
      if (blk && p.eta < blk.until && !p.air) { p.eta = blk.until; p.status = blk.status || 'In transit'; p.note = blk.reason; }
      X.po.push(p); X.fin.poValue += p.value;
      if (p.eta < P.t + 3 * 86400) schedule(p);
      return p;
    }
    function schedule(p) {
      const imp = p.src === 'import';
      p.truck = { id: imp ? `CNTR-${++inSeq}` : `VND-${++inSeq}`, at: p.eta, area: imp ? 'IMP' : 'LOC', po: 'PO ' + p.id, lines: [{ code: p.code, qty: p.qty, lot: `${p.code.split('-')[0]}${imp ? 'I' : 'L'}-${pad(inSeq, 5)}` }], poRef: p };
      E.receive(p.truck);
    }
    function reschedule(p, eta, status, note) {
      p.eta = eta; if (status) p.status = status; if (note) p.note = note;
      if (p.truck) { p.truck.at = eta; if (p.truck.state === 'due') return; }
      else if (eta < P.t + 3 * 86400) schedule(p);
    }
    function replenish() {
      for (const code of BOUGHT) {
        const b = STORE[MAT[code].store][code]; if (!b) continue;
        const proj = level(b) + inTransit(code), lot = MAT[code].lot;
        if (proj >= b.cap * 0.55) continue;
        if (X.block[code] && X.block[code].noNew && P.t < X.block[code].until) continue;
        const room = b.cap * 0.98 - proj;
        let qty = Math.max(1, Math.floor(room / lot)) * lot; if (qty > room * 1.4) qty = Math.round(room / 100) * 100;
        const imp = MAT[code].src === 'import';
        const p = placePO(code, qty, P.t + (imp ? rnd(45, 100) : rnd(25, 65)) * 60, 'Reorder point (Kanban call-off)');
        msg('SAP-MM', imp ? 'WMS' : 'WMS', 'Call-off', `${imp ? 'Import call-off' : 'Vendor call-off'} PO ${p.id} · ${num(qty)} ${MAT[code].unit === 'kg' ? 'kg ' : ''}${code} · ${p.vendor} · ETA ${E.clock(p.eta)}`, { ref: `${MAT[code].store}:${code}` });
      }
    }
    function onReceived(tr) {
      const p = tr.poRef; if (!p) return;
      p.status = 'Received'; p.received = P.t;
      const l = tr.lines[0];
      const lot = { id: String(++iqcSeq), po: p.id, code: l.code, lot: l.lot, qty: l.qty, vendor: p.vendor, t: P.t, state: 'In inspection', sample: Math.max(5, Math.round(Math.sqrt(l.qty))) };
      X.iqc.unshift(lot); if (X.iqc.length > 60) X.iqc.pop();
      msg('WMS', 'SAP-MM', 'Goods receipt', `${tr.id} unloaded · PO ${p.id} · ${num(l.qty)} ${l.code} · lot ${l.lot} · 101 into quality inspection`, { mvt: '101', ref: `${MAT[l.code].store}:${l.code}` });
      msg('SAP-MM', 'SAP-QM', 'Inspection lot', `IQC lot ${lot.id} · ${l.code} · sample ${lot.sample}`, { ref: `${MAT[l.code].store}:${l.code}` });
      E.later(rnd(6, 14) * 60, () => {
        lot.state = 'Accepted'; lot.done = P.t; p.status = 'Closed';
        msg('SAP-QM', 'SAP-MM', 'Usage decision', `IQC lot ${lot.id} accepted · ${l.code} lot ${l.lot} released to unrestricted · 321`, { mvt: '321', ref: `${MAT[l.code].store}:${l.code}` });
      });
    }
    // opening pipeline: what is already on the road or released from the port this morning
    for (const code of BOUGHT) {
      const b = STORE[MAT[code].store][code]; if (!b) continue;
      const imp = MAT[code].src === 'import';
      if (level(b) < b.cap * 0.8) {
        const lot = MAT[code].lot, room = b.cap * 0.95 - level(b);
        const qty = Math.max(1, Math.floor(room / lot)) * lot;
        placePO(code, Math.min(qty, Math.round(room / 100) * 100 || lot), P.t + rnd(imp ? 20 : 8, imp ? 160 : 110) * 60, 'Weekly schedule line', { created: P.t - rnd(2, 30) * 86400 });
      }
    }

    // blocked stock (quality hold on a store): kept apart so the floor cannot use it
    function blockStock(b, leave, reason) {
      let n = Math.max(0, level(b) - leave); const lots = [];
      while (n > 0 && b.lots.length) {
        const L = b.lots[b.lots.length - 1], k = Math.min(n, L.qty);
        L.qty -= k; b.qty -= k; n -= k; lots.push({ id: L.id, qty: k, src: L.src });
        if (L.qty <= 1e-9) b.lots.pop();
      }
      const blk = { code: b.code, buf: b.id, lots, qty: lots.reduce((a, l) => a + l.qty, 0), reason, t: P.t };
      X.blocked.push(blk); return blk;
    }
    function releaseBlocked(blk) {
      const b = P.bufs[blk.buf];
      for (const l of blk.lots) E.addLot(b, l.id, l.qty, { src: l.src, concession: true });
      X.blocked = X.blocked.filter(x => x !== blk);
    }

    /* ----- QM ----- */
    const insp = () => P.stations.filter(s => s.kind === 'fct' || s.kind === 'qa' || s.kind === 'aoi');
    X.quality = () => {
      const ss = insp();
      const tot = ss.reduce((a, s) => a + s.counters.made + s.counters.bad, 0), bad = ss.reduce((a, s) => a + s.counters.bad, 0);
      const pallets = Math.floor(P.made.tv / 6);
      return { fpy: P.kpi.fpy, dppm: tot ? Math.round(bad / tot * 1e6) : 0, holds: P.holds.size + X.blocked.length, iqcOpen: X.iqc.filter(l => l.state === 'In inspection').length, iqcDone: X.iqc.filter(l => l.state === 'Accepted').length, oqc: Math.floor(pallets / 10), rework: P.rejects.rework.length, smtRepair: P.rejects.smtRepair.length };
    };

    /* ----- PE and BOM: engineering changes ----- */
    X.ecn.push(
      { id: 'ECN-26-118', title: 'QLED 65 back-cover screw torque 0.45 → 0.48 N·m', type: 'Mechanical', by: 'PE · mechanical', state: 'Implemented', t: P.t - 6 * 86400, eff: 'Main lines 4 and 5 · from W' + (isoWeek(new Date()) - 1) },
      { id: 'ECN-26-121', title: 'PBA 55 firmware v3.1.4 (Wi-Fi stability)', type: 'Software', by: 'PE · software', state: 'Released', t: P.t - 5 * 86400, eff: 'SMD 1 and 2 writers' },
      { id: 'ECN-26-124', title: 'UHD 43 carton print: new energy label', type: 'BOM change', by: 'BOM team', state: 'Pending effectivity', t: P.t - 2 * 86400, eff: 'CTN-43 · use up old stock first, then switch' },
      { id: 'ECN-26-127', title: 'Coating oven 4 burner nozzle upgrade', type: 'Electrical', by: 'PE · electrical', state: 'In review', t: P.t - 86400, eff: 'Press line 4 · next planned stop' }
    );
    X.bomVer = { M43: 'v12', M55: 'v18', M65: 'v9', M75: 'v7' };

    /* ----- SVC: service parts ----- */
    const svcCodes = ['PBA-43', 'PBA-55', 'PBA-65', 'PBA-75', 'BC-43', 'BC-55', 'BC-65', 'BC-75', 'ACC'];
    // opening service stock: boards set aside earlier from production
    for (const c of ['PBA-43', 'PBA-55', 'PBA-65', 'PBA-75']) {
      const lane = STORE.PBA[c], svc = STORE.SVC[c], n = Math.min(26, lane.items.length - 60);
      for (let i = 0; i < n; i++) { const u = lane.items.pop(); u.loc = { k: 'store', b: svc }; u.svc = true; svc.items.push(u); }
    }
    function svcOrder(o) {
      const so = Object.assign({ id: String(++svcSeq), centre: pick(SVC_CENTRES), lines: [], t: P.t, state: 'open' }, o);
      if (!o || !o.lines) {
        const n = 1 + Math.floor(R() * 3);
        for (let i = 0; i < n; i++) { const code = pick(svcCodes); so.lines.push({ code, qty: code === 'ACC' ? 2 + Math.floor(R() * 6) : 1 + Math.floor(R() * 3) }); }
      }
      X.svc.orders.unshift(so); if (X.svc.orders.length > 50) X.svc.orders.pop();
      fillSvc(so);
      return so;
    }
    function fillSvc(so) {
      let ok = true;
      for (const l of so.lines) {
        if (l.done) continue;
        const b = STORE.SVC[l.code]; if (!b) { l.done = true; continue; }
        if (level(b) >= l.qty) {
          if (b.items) { const it = b.items.splice(0, l.qty); it.forEach(u => { u.loc = null; u.svcShipped = P.t; u.svcOrder = so.id; }); l.sns = it.map(u => u.sn); } else E.take(b, l.qty);
          l.done = true;
        } else ok = false;
      }
      so.state = ok ? 'shipped' : 'backorder';
      if (ok) { X.svc.shipped++; msg('SAP-SD', 'WMS', 'Service order', `Service order ${so.id} · ${so.centre} · ${so.lines.map(l => `${l.qty} × ${l.code}`).join(', ')} · shipped`, { ref: 'svc:' + so.id }); }
      return ok;
    }
    function svcReplenish() {
      // the service store asks production for parts below its minimum: boards from the PBA supermarket, back covers from injection
      for (const c of svcCodes) {
        const b = STORE.SVC[c]; if (!b) continue;
        const min = b.items ? 18 : c === 'ACC' ? 120 : 60;
        if (level(b) >= min) continue;
        if (b.items) {
          const lane = STORE.PBA[c]; const spare = lane.items.length - 70; if (spare < 10) continue;
          const n = Math.min(24, spare); const it = lane.items.splice(lane.items.length - n, n); it.forEach(u => { u.loc = { k: 'store', b }; u.svc = true; }); b.items.push(...it);
          msg('SAP-MM', 'WMS', 'Transfer', `${n} × ${c} from the PBA supermarket to the service store · 311`, { mvt: '311', ref: b.id });
        } else {
          const src = c === 'ACC' ? STORE.LOC.ACC : STORE.INJ[c]; const n = c === 'ACC' ? 200 : 40;
          if (level(src) < n * 2) continue;
          E.moveLots(src, b, n);
          msg('SAP-MM', 'WMS', 'Transfer', `${n} × ${c} to the service store · 311`, { mvt: '311', ref: b.id });
        }
      }
      for (const so of X.svc.orders) if (so.state === 'backorder') fillSvc(so);
      X.svc.backorders = X.svc.orders.filter(o => o.state === 'backorder').length;
    }

    /* ----- HR ----- */
    X.hr = () => {
      const ops = P.people.filter(p => p.role === 'Operator' || p.role === 'Line leader' || p.role === 'Rework technician');
      const present = ops.filter(p => p.present).length;
      const office = DEPTS.reduce((a, d) => a + d.staff, 0);
      const floor = P.people.length;
      return { floor, office, total: floor + office + 214, present, absent: ops.length - present, ops: ops.length, overtime: X.fin.overtimeH || 0 };
    };
    X.deptStaff = id => id === 'production' ? P.people.filter(p => p.role === 'Operator' || p.role === 'Line leader').length : (DEPTS.find(d => d.id === id) || {}).staff;

    /* ----- FI/CO ----- */
    X.finance = () => {
      let inv = 0, wip = 0, fg = 0;
      for (const b of Object.values(P.bufs)) {
        const mt = MAT[b.code]; if (!mt) continue;
        inv += level(b) * mt.price;
      }
      for (const blk of X.blocked) inv += blk.qty * (MAT[blk.code] ? MAT[blk.code].price : 0);
      for (const p of P.pallets) if (p.where !== 'truck') { const m = MODELS[p.model]; fg += p.units.length * (m.cost.mat + m.cost.lab + m.cost.ovh); }
      for (const u of P.units) if (u.type === 'tv' && !u.packed) wip += MODELS[u.model].cost.mat;
      const f = X.fin;
      return { revenue: f.revenue, cogs: f.cogs, margin: f.revenue - f.cogs, marginPct: f.revenue ? (f.revenue - f.cogs) / f.revenue : 0, inventory: inv, fg, wip, total: inv + fg + wip, poOpen: X.po.filter(p => p.status !== 'Closed' && p.status !== 'Received').reduce((a, p) => a + p.value, 0), rework: f.rework, overtime: f.overtime, expedite: f.expedite, saved: P.saved, units: f.units };
    };

    /* ----- S&OP, MPS and MRP ----- */
    const W0 = isoWeek(new Date());
    const WEEKS = 12, MRPW = 8;
    const wkLabel = i => 'W' + pad(((W0 - 1 + i) % 52) + 1, 2);
    const HOURS = 96;   // two eight-hour shifts, six days
    const OT = 16;      // Saturday overtime, hours per line per week
    // weekly demand by model: the sales forecast with retail promotions
    const BASE = { M43: 9600, M55: 21500, M65: 15800, M75: 6900 };
    const promo = i => { const w = ((W0 - 1 + i) % 52) + 1; return w === 47 ? 1.32 : w === 48 ? 1.42 : w === 51 ? 1.18 : w === 52 ? 0.74 : w === 1 ? 0.86 : 1; };
    const fc = {};
    for (const m of M) fc[m] = Array.from({ length: WEEKS }, (_, i) => Math.round(BASE[m] * promo(i) * (0.94 + R() * 0.12) / 10) * 10);
    const capWeek = (m, ot) => {
      const lines = mainLines().filter(L => L.model === m).length;
      return Math.round(lines * 3600 / MODELS[m].takt * 0.82 * (HOURS + (ot ? OT : 0)));
    };
    const SCEN = [
      { id: 'level', name: 'Level', what: 'Same output every week; stock is built before the promotions and runs down after them.' },
      { id: 'chase', name: 'Chase', what: 'Output follows demand week by week; Saturdays are worked in the peak weeks.' },
      { id: 'constrained', name: 'Supply-constrained', what: 'The open-cell vendor allocates at most 11,500 QLED 65 panels a week; output and promises follow that limit.' }
    ];
    function sopRun(id) {
      const out = { id, weeks: Array.from({ length: WEEKS }, (_, i) => wkLabel(i)), models: {}, tot: { demand: 0, sold: 0, lost: 0, revenue: 0, margin: 0, otH: 0, invAvg: 0, carry: 0 } };
      for (const m of M) {
        const d = fc[m], cap = capWeek(m, false), capOT = capWeek(m, true);
        const avg = d.reduce((a, b) => a + b, 0) / WEEKS;
        let inv = Math.round(avg * 0.3);
        const row = { demand: d, prod: [], inv: [], short: [], ot: [], cap: Array(WEEKS).fill(cap) };
        for (let i = 0; i < WEEKS; i++) {
          let p;
          if (id === 'level') p = Math.min(cap, Math.round(avg / 10) * 10);
          else {
            const target = Math.round(d[Math.min(WEEKS - 1, i + 1)] * 0.5);  // keep half of next week's demand in stock
            p = clamp(d[i] + target - inv, 0, capOT);
            if (id === 'constrained' && m === 'M65') p = Math.min(p, 11500);
          }
          const ot = p > cap ? Math.ceil((p - cap) / (capOT - cap) * OT * mainLines().filter(L => L.model === m).length) : 0;
          const avail = inv + p, sold = Math.min(avail, d[i]);
          inv = avail - sold;
          row.prod.push(Math.round(p)); row.inv.push(Math.round(inv)); row.short.push(Math.round(d[i] - sold)); row.ot.push(ot);
          const mm = MODELS[m], unitCost = mm.cost.mat + mm.cost.lab + mm.cost.ovh;
          out.tot.demand += d[i]; out.tot.sold += sold; out.tot.lost += d[i] - sold; out.tot.revenue += sold * mm.price;
          out.tot.margin += sold * (mm.price - unitCost); out.tot.otH += ot; out.tot.carry += inv * unitCost * 0.005; out.tot.invAvg += inv / WEEKS;
        }
        out.models[m] = row;
      }
      out.tot.margin -= out.tot.otH * 9500 + out.tot.carry;
      out.tot.service = out.tot.sold / out.tot.demand;
      const weekly = out.tot.demand / WEEKS;
      out.tot.invDays = out.tot.invAvg / (weekly / 6);
      return out;
    }
    X.sop = { scenarios: SCEN, results: {}, approved: null, step: 3, steps: ['Demand review · Sales', 'Supply review · Planning and SCM', 'Pre-S&OP · Finance', 'Executive S&OP · plant leader'], weeks: Array.from({ length: WEEKS }, (_, i) => wkLabel(i)), fc };
    for (const s of SCEN) X.sop.results[s.id] = sopRun(s.id);

    // MRP: explode the master schedule through the BOM, net against stock and receipts, offset by lead time
    const usage = (item, code) => { if (item === code) return 1; const b = BOM[item]; if (!b) return 0; let u = 0; for (const [c, q] of b) u += q * usage(c, code); return u; };
    const plantStock = code => {
      let q = 0;
      for (const b of Object.values(P.bufs)) if (b.code === code && !b.items) q += level(b);
      return q;
    };
    X.wh = {};    // stock in the bonded and central warehouses, outside the plant floor
    X.sched = {}; // open purchase-order receipts by week (the long pipeline, beyond today's deliveries)
    for (const code of BOUGHT) {
      const avg = M.reduce((a, m) => a + BASE[m] * usage(m, code), 0);
      const imp = MAT[code].src === 'import', lt = Math.round(MAT[code].lt / 7), lot = MAT[code].lot;
      X.wh[code] = Math.round(avg * (imp ? rnd(0.9, 1.4) : rnd(0.3, 0.6)) / lot) * lot;
      X.sched[code] = Array(MRPW).fill(0);
      X.sched[code].lt = lt;
    }
    X.ss = code => { const avg = M.reduce((a, m) => a + BASE[m] * usage(m, code), 0); return Math.round(avg * (MAT[code].src === 'import' ? 0.8 : 0.35)); };
    X.converted = {};
    function mrpRun() {
      const mps = X.mps;
      const rows = {}, exc = [];
      for (const code of BOUGHT) {
        const mt = MAT[code], lot = mt.lot, ltW = Math.round(mt.lt / 7), ss = X.ss(code);
        const gross = Array.from({ length: MRPW }, (_, w) => Math.round(M.reduce((a, m) => a + mps[m][w] * usage(m, code), 0)));
        const sched = X.sched[code].slice(), planned = Array(MRPW).fill(0), release = Array(MRPW).fill(0), proj = [];
        const onHand = Math.round(plantStock(code) + X.wh[code]);
        let p = onHand;
        const late = [];
        for (let w = 0; w < MRPW; w++) {
          p += sched[w] - gross[w];
          if (p < ss) {
            const q = Math.ceil((ss - p) / lot) * lot;
            planned[w] = q; p += q;
            const rw = w - ltW;
            if (rw >= 0) release[rw] += q; else { release[0] += q; late.push(w); }
          }
          proj.push(Math.round(p));
        }
        const pegs = M.filter(m => usage(m, code) > 0);
        rows[code] = { code, name: mt.name, unit: mt.unit, src: mt.src, vendor: mt.vendor, lt: mt.lt, lot, ss, onHand, plant: Math.round(plantStock(code)), wh: X.wh[code], gross, sched, planned, release, proj, pegs, held: X.block[code] && P.t < X.block[code].until ? X.block[code] : null };
        if (late.length) exc.push({ key: 'late:' + code, code, level: 'crit', kind: 'Expedite', md04: '06', md04t: 'Start date in the past', text: `${code}: needed in ${wkLabel(late[0])} but the ${mt.lt}-day lead time cannot be met`, act: mt.src === 'import' ? { id: 'erp:air:' + code, label: 'Expedite by air' } : { id: 'erp:expedite:' + code, label: 'Expedite vendor' } });
        else if (release[0] > 0 && !X.converted[code]) exc.push({ key: 'conv:' + code, code, level: 'info', kind: 'Convert', md04: '05', md04t: 'Opening date in the past', text: `${code}: planned order of ${num(release[0])} ${mt.unit} must be released this week`, act: { id: 'erp:convert:' + code, label: 'Convert to PO' } });
        if (onHand < ss) exc.push({ key: 'ss:' + code, code, level: 'warn', kind: 'Below safety stock', md04: '96', md04t: 'Stock below safety stock', text: `${code}: ${num(onHand)} on hand against a safety stock of ${num(ss)}`, act: null });
        const max = ss * 3 + lot * 2;
        if (proj[MRPW - 1] > max && proj[0] > max) exc.push({ key: 'excess:' + code, code, level: 'info', kind: 'Excess', md04: '15', md04t: 'Reschedule out', text: `${code}: stock stays above ${num(max)} for eight weeks; push out the next receipt`, act: null });
      }
      X.mrp = { rows, exc, t: P.t, weeks: Array.from({ length: MRPW }, (_, i) => wkLabel(i)) };
      return X.mrp;
    }
    function approve(id, who = 'You') {
      const r = X.sop.results[id]; X.sop.approved = id; X.sop.approvedAt = P.t; X.sop.step = 4;
      X.mps = {}; for (const m of M) X.mps[m] = r.models[m].prod.slice(0, MRPW);
      mrpRun();
      E.audit(who, 'Approved S&OP', `${SCEN.find(s => s.id === id).name} plan · MPS released`);
      msg('SOP', 'SAP-PP', 'MPS release', `S&OP ${SCEN.find(s => s.id === id).name} plan approved · master schedule ${X.mrp.weeks[0]}–${X.mrp.weeks[MRPW - 1]} released`, {});
      msg('SAP-PP', 'SAP-MM', 'MRP run', `MRP run: ${Object.keys(X.mrp.rows).length} materials · ${X.mrp.exc.length} exception messages`, {});
      E.log('SAP PP', `S&OP ${SCEN.find(s => s.id === id).name} approved · MRP ran with ${X.mrp.exc.length} exception messages`);
      E.emit('erp');
    }
    // the plan running today is the one approved at last month's executive meeting
    X.sop.approved = 'chase'; X.sop.approvedAt = P.t - 9 * 86400;
    X.mps = {}; for (const m of M) X.mps[m] = X.sop.results.chase.models[m].prod.slice(0, MRPW);
    // open purchase orders inside the lead time were placed by earlier MRP runs against this plan
    for (const code of BOUGHT) {
      const lot = MAT[code].lot, lt = X.sched[code].lt;
      const upto = ['PCB-55', 'SMPS-65', 'RESIN'].includes(code) ? lt : lt + 1;   // three buyers still have this week's order to place
      for (let w = 0; w < Math.min(MRPW, upto); w++) X.sched[code][w] = Math.round(M.reduce((a, m) => a + X.mps[m][w] * usage(m, code), 0) * rnd(0.98, 1.08) / lot) * lot;
    }
    mrpRun();
    X.sop.step = 1;   // this month's cycle is at the supply review

    /* ----- decisions that belong to the offices ----- */
    function decision(key, o) {
      if (!o) { E.rec('erp.' + key, null); X.dec.delete(key); return; }
      X.dec.set(key, o);
      E.rec('erp.' + key, Object.assign({ agent: o.agent || 'Planning' }, o));
    }
    function drill(id) {
      if (id === 'container') {
        const until = P.t + 5 * 86400;
        X.block['OC-65'] = { until, reason: 'Container held at port · customs inspection', status: 'Held at port', noNew: true };
        for (const p of X.po) if (p.code === 'OC-65' && (p.status === 'In transit')) reschedule(p, until, 'Held at port', 'Customs inspection');
        X.sched['OC-65'][0] = 0;   // this week's receipt slips
        mrpRun();
        msg('SAP-MM', 'SAP-PP', 'Delay', 'Import PO for OC-65 delayed 5 days · held at port', { ref: 'IMP:OC-65' });
        E.log('Import', 'OC-65 container held at the port for customs inspection · 5 days', 'warn', 'IMP:OC-65');
      } else if (id === 'carton') {
        const b = STORE.LOC['CTN-55'];
        const blk = blockStock(b, Math.round(rate('M55') * 0.8), 'IQC: crush strength 18% below spec');
        X.block['CTN-55'] = { until: P.t + 3 * 3600, reason: 'Vendor truck 3 h late', noNew: true };
        for (const p of X.po) if (p.code === 'CTN-55' && p.status === 'In transit') reschedule(p, Math.max(p.eta, P.t) + 3 * 3600, 'In transit', 'Vendor truck 3 h late');
        msg('SAP-QM', 'SAP-MM', 'Block', `CTN-55 lot blocked · ${num(blk.qty)} cartons · crush strength below spec · 344`, { mvt: '344', ref: b.id });
        E.log('IQC', `CTN-55 lot failed crush test · ${num(blk.qty)} cartons blocked · the next vendor truck is 3 h late`, 'warn', b.id);
        X.cartonBlk = blk;
      } else if (id === 'field') {
        const so = svcOrder({ centre: 'Service centres · all regions', lines: [{ code: 'PBA-55', qty: 60 }], urgent: true, field: true });
        X.fieldOrder = so;
        E.log('SVC', `Field failures: ${so.centre} order 60 × PBA-55 · ${so.state === 'backorder' ? 'service stock short' : 'shipped'}`, 'warn', 'SVC:PBA-55');
        X.ecn.unshift({ id: 'FFA-26-031', title: 'Field failure analysis: PBA 55 no-power after 3 weeks', type: 'Field failure', by: 'Quality + PE · electrical', state: 'Analysis', t: P.t, eff: 'Return 10 boards to the lab' });
      }
      E.emit('erp');
    }
    function decisions() {
      // material shortage at the stores that the floor cannot fix
      const oc = STORE.IMP['OC-65'];
      const ocUse = mainLines().filter(L => L.model === 'M65').length * 3600 / MODELS.M65.takt;
      const ocLine = Object.values(P.bufs).filter(b => b.code === 'OC-65' && b.id.startsWith('LS:')).reduce((a, b) => a + level(b), 0);
      if (X.block['OC-65'] && P.t < X.block['OC-65'].until && !X.ocFixed) {
        const rw = ocUse ? (level(oc) + ocLine) / ocUse * 3600 : Infinity;
        decision('oc65', { agent: 'Planning', dept: 'scm', level: rw < 7200 ? 'crit' : 'warn', ref: oc.id, title: `QLED 65 panels run out in ${E.mins(rw)}: the container is held at the port`,
          body: `${num(level(oc) + ocLine)} OC-65 open cells left for ${num(ocUse)} an hour on main lines 4 and 5; the next container is 5 days away. Option 1: release 1,200 panels from the bonded warehouse (customs release 2 h, EGP 38k fees). Option 2: move main line 5 to UHD 55 for the rest of the day (15-minute changeover; QLED 65 orders slip, UHD 55 orders are pulled in).`,
          actions: [{ id: 'erp:oc65:bonded', label: 'Release bonded stock' }, { id: 'erp:oc65:replan', label: 'Move line 5 to UHD 55' }, { id: 'focus:IMP:OC-65', label: 'Show stock' }] });
      } else decision('oc65', null);
      const ctn = STORE.LOC['CTN-55'];
      if (X.cartonBlk && !X.ctnFixed) {
        const use = mainLines().filter(L => L.model === 'M55').length * 3600 / MODELS.M55.takt;
        const lineSide = Object.values(P.bufs).filter(b => b.code === 'CTN-55' && b.id.startsWith('LS:')).reduce((a, b) => a + level(b), 0);
        const rw = use ? (level(ctn) + lineSide) / use * 3600 : Infinity;
        decision('ctn55', { agent: 'Logistics', dept: 'scm', level: rw < 5400 ? 'crit' : 'warn', ref: ctn.id, title: `UHD 55 packing runs out of cartons in ${E.mins(rw)}`,
          body: `IQC blocked ${num(X.cartonBlk.qty)} cartons (crush strength 18% below spec) and the vendor truck is 3 h late. Option 1: order 1,500 from the backup carton vendor (arrives in about 70 min, 9% dearer). Option 2: release the blocked lot under a quality concession with corner protectors (Quality signs off, small transit-damage risk).`,
          actions: [{ id: 'erp:ctn:backup', label: 'Order from backup vendor' }, { id: 'erp:ctn:concession', label: 'Release under concession' }, { id: 'focus:' + ctn.id, label: 'Show stock' }] });
      } else decision('ctn55', null);
      const fo = X.fieldOrder;
      if (fo && fo.state === 'backorder' && !X.fieldFixed) {
        const lane = STORE.PBA['PBA-55'];
        const need = fo.lines[0].qty - level(STORE.SVC['PBA-55']);
        decision('field', { agent: 'Service', dept: 'svc', level: 'warn', ref: 'SVC:PBA-55', title: `Service centres wait for ${fo.lines[0].qty} PBA 55 boards; the service store has ${level(STORE.SVC['PBA-55'])}`,
          body: `Customers are waiting with failed TVs. Option 1: take ${need} boards from the production supermarket now (it holds ${lane.items.length}; main lines 1 and 2 use about 300 an hour, so SMD 1 and 2 refill it in about ${Math.round(need / 3.2)} minutes). Option 2: run SMD 3 on PBA 55 for 30 minutes for the service order (UHD 43 boards cover the change).`,
          actions: [{ id: 'erp:field:take', label: `Take ${need} from production` }, { id: 'erp:field:smd3', label: 'Run SMD 3 for service' }, { id: 'focus:SVC:PBA-55', label: 'Show service store' }] });
      } else decision('field', null);
      // MRP exceptions that need a buyer or a planner
      const crit = X.mrp.exc.filter(e => e.level === 'crit');
      for (const e of crit) decision('mrp:' + e.code, { agent: 'Planning', dept: 'planning', level: 'warn', ref: 'mrp:' + e.code, title: `MRP: ${e.text}`, body: `The approved plan needs more ${e.code} than stock and open orders cover in time. ${MAT[e.code].src === 'import' ? 'Air freight costs about 6 times sea freight for this quantity.' : 'The vendor can split the delivery and send a first truck early.'}`, actions: [e.act, { id: 'focus:mrp:' + e.code, label: 'Open in MRP' }] });
      for (const k of X.dec.keys()) if (k.startsWith('mrp:') && !crit.some(e => 'mrp:' + e.code === k)) decision(k, null);
      // the S&OP cycle waits for the plant leader
      if (X.sop.step === 3 && !X.sop.decided) decision('sop', { agent: 'Planning', dept: 'planning', level: 'info', ref: 'sop', title: `S&OP: approve the plan for ${X.sop.weeks[0]}–${X.sop.weeks[WEEKS - 1]}`, body: `Sales, Planning, SCM and Finance compared three plans. Chase keeps service at ${Math.round(X.sop.results.chase.tot.service * 1000) / 10}% with ${num(X.sop.results.chase.tot.otH)} overtime line-hours; Level saves overtime but loses ${num(X.sop.results.level.tot.lost)} TVs in the promotion weeks.`, actions: [{ id: 'erp:sop:chase', label: 'Approve Chase' }, { id: 'erp:sop:level', label: 'Approve Level' }, { id: 'focus:sop', label: 'Open S&OP' }] });
      else decision('sop', null);
    }
    E.ext('erp', (arg, who) => {
      const [k, a] = arg.split(/:(.+)/);
      if (k === 'oc65') {
        X.ocFixed = true; decision('oc65', null);
        if (a === 'bonded') {
          const p = placePO('OC-65', 1200, P.t + 2 * 3600, 'Bonded-warehouse release', { air: true, extra: 38000 });
          X.wh['OC-65'] = Math.max(0, X.wh['OC-65'] - 1200); X.fin.expedite += 38000;
          E.audit(who, 'Released bonded stock', `1,200 OC-65 · customs release, at the import door ${E.clock(p.eta)}`);
          msg('SAP-MM', 'WMS', 'Stock transfer', `1,200 OC-65 from the bonded warehouse · PO ${p.id} · ETA ${E.clock(p.eta)}`, { ref: 'IMP:OC-65' });
        } else {
          E.changeover(5, 'M55', who);
          E.audit(who, 'Re-planned main line 5', 'QLED 65 → UHD 55 for the rest of the day');
          msg('SAP-PP', 'SAP-SD', 'Re-plan', 'Main line 5 moved to UHD 55 · QLED 65 orders re-promised, UHD 55 orders pulled in', {});
          P.saved += 520000;
        }
      } else if (k === 'ctn') {
        X.ctnFixed = true; decision('ctn55', null);
        if (a === 'backup') {
          const p = placePO('CTN-55', 1500, P.t + 70 * 60, 'Backup vendor', { vendor: 'Backup carton vendor (local)', air: true, value: 1500 * 104 });
          E.audit(who, 'Ordered from backup vendor', `1,500 CTN-55 · ETA ${E.clock(p.eta)} · +9% price`);
          msg('SAP-MM', 'WMS', 'Purchase order', `PO ${p.id} to the backup carton vendor · 1,500 CTN-55 · ETA ${E.clock(p.eta)}`, { ref: 'LOC:CTN-55' });
        } else {
          releaseBlocked(X.cartonBlk);
          E.audit(who, 'Quality concession', `${num(X.cartonBlk.qty)} CTN-55 released with corner protectors`);
          msg('SAP-QM', 'SAP-MM', 'Usage decision', `CTN-55 lot released under concession · corner protectors added · 343`, { mvt: '343', ref: 'LOC:CTN-55' });
        }
        P.saved += 310000;
      } else if (k === 'field') {
        X.fieldFixed = true; decision('field', null);
        const so = X.fieldOrder, svc = STORE.SVC['PBA-55'], need = so.lines[0].qty - level(svc);
        if (a === 'take') {
          const lane = STORE.PBA['PBA-55']; const it = lane.items.splice(lane.items.length - Math.min(need, lane.items.length), need);
          it.forEach(u => { u.loc = { k: 'store', b: svc }; u.svc = true; }); svc.items.push(...it); fillSvc(so);
          E.audit(who, 'Service boards from production', `${it.length} × PBA-55 to the service store`);
          msg('SAP-MM', 'WMS', 'Transfer', `${it.length} × PBA-55 from production to the service store · 311`, { mvt: '311', ref: 'SVC:PBA-55' });
        } else {
          E.apply('switchSmd:SMD3:M55', who);
          E.later(30 * 60, () => { E.apply('switchSmd:SMD3:M43', 'Planning'); });
          X.svcPull = true;
          E.audit(who, 'SMD 3 for service', '30 minutes of PBA 55 for the service order, then back to PBA 43');
        }
        P.saved += 180000;
      } else if (k === 'sop') {
        X.sop.decided = true; decision('sop', null); approve(a, who);
      } else if (k === 'convert') {
        const r = X.mrp.rows[a]; if (!r) return;
        const ltW = Math.round(MAT[a].lt / 7);
        const w = Math.min(MRPW - 1, ltW);
        X.sched[a][w] += r.release[0]; X.converted[a] = true;
        const p = placePO(a, r.release[0], P.t + MAT[a].lt * 86400, 'MRP planned order');
        E.audit(who, 'Converted planned order', `${num(r.release[0])} ${a} · PO ${p.id}`);
        msg('SAP-PP', 'SAP-MM', 'Purchase order', `Planned order converted · PO ${p.id} · ${num(r.release[0])} ${a} · ${MAT[a].vendor}`, { ref: 'mrp:' + a });
        mrpRun();
      } else if (k === 'air' || k === 'expedite') {
        const r = X.mrp.rows[a]; if (!r) return;
        const need = r.planned.find(q => q > 0) || MAT[a].lot;
        X.sched[a][0] += need; X.converted[a] = true;
        const cost = k === 'air' ? need * MAT[a].price * 0.06 : need * MAT[a].price * 0.01;
        X.fin.expedite += cost;
        const p = placePO(a, need, P.t + (k === 'air' ? 3 : 1) * 86400, k === 'air' ? 'Expedite by air' : 'Expedited vendor', { air: true });
        E.audit(who, k === 'air' ? 'Air freight' : 'Expedited vendor', `${num(need)} ${a} · PO ${p.id} · ${egp(cost)}`);
        msg('SAP-MM', 'SAP-PP', 'Expedite', `${num(need)} ${a} expedited · PO ${p.id}`, { ref: 'mrp:' + a });
        if (X.block[a]) X.block[a].until = Math.min(X.block[a].until, P.t + 3 * 86400);
        mrpRun(); decision('mrp:' + a, null);
      } else if (k === 'step') {
        X.sop.step = Math.min(3, X.sop.step + 1);
        E.audit(who, 'S&OP step', X.sop.steps[X.sop.step]);
      } else if (k === 'mrp') { mrpRun(); E.audit(who, 'Ran MRP', `${X.mrp.exc.length} exception messages`); }
      E.emit('erp');
    });

    /* ----- departments: what each one shows right now ----- */
    X.deptNow = id => {
      const k = P.kpi, f = X.finance(), q = X.quality(), h = X.hr();
      const open = P.orders.filter(o => o.state === 'open' || o.state === 'loading');
      const recs = P.recs.filter(r => (r.dept || deptOf(r.agent)) === id).length;
      switch (id) {
        case 'sales': return { kpis: [['Orders on time', Math.round((k.otif || 1) * 100) + '%'], ['Open orders', open.length], ['Open value', egp(open.reduce((a, o) => a + (o.qty - o.shipped) * MODELS[o.model].price, 0))], ['ATP short', open.filter(o => o.atp && !o.atp.ok).length]], recs };
        case 'planning': return { kpis: [['Plan attainment', Math.round(k.units / Math.max(1, k.plan) * 100) + '%'], ['Shift forecast', num(k.fcst || 0)], ['MRP exceptions', X.mrp.exc.length], ['S&OP', X.sop.step > 3 ? 'Approved' : 'Step ' + (X.sop.step + 1) + ' of 4']], recs };
        case 'scm': return { kpis: [['Deliveries on the way', X.po.filter(p => p.status === 'In transit').length], ['Held at port', X.po.filter(p => p.status === 'Held at port').length], ['Milk-run laps', P.tuggers.reduce((a, t) => a + t.laps, 0)], ['AGV missions', E.missions.filter(m => m.veh).length]], recs };
        case 'pe': return { kpis: [['Machines down', P.stations.filter(s => s.state === 'down' || s.state === 'maint').length], ['Technicians busy', P.techs.filter(t => t.state !== 'available').length + ' of ' + P.techs.length], ['Open ECNs', X.ecn.filter(e => e.state !== 'Implemented').length], ['PBA 55 firmware', P.sw['PBA-55'].version]], recs };
        case 'bom': return { kpis: [['Active BOMs', Object.keys(BOM).length], ['Pending effectivity', X.ecn.filter(e => e.state === 'Pending effectivity').length], ['Materials', Object.keys(MAT).length], ['BOM accuracy', '99.6%']], recs };
        case 'quality': return { kpis: [['First-pass yield', ((k.fpy || 0.99) * 100).toFixed(1) + '%'], ['DPPM', num(q.dppm)], ['IQC lots open', q.iqcOpen], ['Holds', q.holds]], recs };
        case 'svc': return { kpis: [['Service orders', X.svc.orders.length], ['Shipped', X.svc.shipped], ['Back orders', X.svc.backorders], ['PBA 55 in store', level(STORE.SVC['PBA-55'])]], recs };
        case 'hr': return { kpis: [['On the floor', h.present + ' of ' + h.ops], ['Absent', h.absent], ['Headcount', num(h.total)], ['Overtime today', (X.fin.overtimeH || 0) + ' h']], recs };
        case 'finance': return { kpis: [['Revenue today', egp(f.revenue)], ['Gross margin', Math.round(f.marginPct * 1000) / 10 + '%'], ['Inventory value', egp(f.total)], ['Protected by decisions', egp(f.saved)]], recs };
        case 'production': return { kpis: [['Packed today', num(k.units || 0)], ['OEE', Math.round((k.oee || 0) * 100) + '%'], ['Lines running', mainLines().filter(L => L.state === 'run' || L.state === 'warn').length + ' of 6'], ['TVs in process', num(k.wip || 0)]], recs };
        case 'it': return { kpis: [['Messages a minute', Math.round(X.stats.perMin)], ['Interfaces up', '11 of 11'], ['Lines online', Object.keys(P.lines).length], ['Last SAP sync', E.clock(X.msgs[0] ? X.msgs[0].t : P.t)]], recs };
      }
      return { kpis: [], recs };
    };
    function deptOf(agent) { return { Logistics: 'scm', Maintenance: 'pe', Planning: 'planning', Quality: 'quality', Service: 'svc', Energy: 'pe', HR: 'hr', Finance: 'finance', Sales: 'sales' }[agent] || 'production'; }
    X.deptOf = deptOf;

    function onAudit() {
      const a = P.audit[0]; if (!a) return;
      if (a.action === 'Moved operators') { X.fin.overtimeH = (X.fin.overtimeH || 0) + 4; X.fin.overtime += 4 * 420; msg('HR', 'SAP-FICO', 'Overtime', '2 operators × 2 h overtime approved on main line 3', {}); }
    }

    /* ----- clock ----- */
    let lastMin = Math.floor(P.t / 60), lastSvc = P.t;
    function second() {
      const mn = Math.floor(P.t / 60);
      if (mn !== lastMin) {
        lastMin = mn;
        flush(mn % 5 === 0); replenish(); orderBook(); svcReplenish(); decisions();
        if (P.t - lastSvc > rnd(420, 900)) { lastSvc = P.t; svcOrder(); }
        { let n = 0; for (const m of X.msgs) { if (P.t - m.t > 600) break; n++; } X.stats.perMin = n / Math.max(1, Math.min(10, (P.t - X.t0) / 60)); }
        if (mn % 15 === 0) mrpRun();
        E.emit('erp');
      }
    }

    // the morning so far: orders already shipped since 06:00, and today's open book
    {
      let t = 6 * 3600 + 40 * 60;
      while (t < P.t - 40 * 60) {
        const m = pick(['M55', 'M55', 'M65', 'M43', 'M65', 'M75']);
        const so = newOrder(m, t, {});
        so.state = R() < 0.92 ? 'shipped' : 'late'; so.shipped = so.qty; so.shippedAt = t + (so.state === 'late' ? rnd(10, 40) * 60 : -rnd(5, 30) * 60);
        X.fin.revenue += so.qty * MODELS[m].price; const mm = MODELS[m]; X.fin.cogs += so.qty * (mm.cost.mat + mm.cost.lab + mm.cost.ovh); X.fin.units += so.qty; X.fin.shipments++;
        t += rnd(16, 30) * 60;
      }
      for (const m of M) lastDue[m] = 0;
      for (const m of M) {
        let due = P.t + rnd(45, 65) * 60;
        const r = rate(m), fg = fgQty(m);
        let promised = 0;
        while (promised < fg + r * 2.6) { const so = newOrder(m, Math.round(due / 60) * 60); promised += so.qty; due += so.qty / Math.max(30, r) * 3600 * rnd(0.9, 1.05); }
      }
    }
    for (let i = 0; i < 14; i++) { svcOrder(); X.svc.orders[0].t = P.t - (14 - i) * rnd(600, 1200); }
    decisions();
    msg('SAP-PP', 'GMES', 'Order release', `${X.pp.filter(p => p.status !== 'TECO').length} production orders released for shift A`, {});

    /* ----- QM: nonconformance reports worked through the 8D steps ----- */
    const D8 = ['D1 Team', 'D2 Describe', 'D3 Contain', 'D4 Root cause', 'D5 Corrective action', 'D6 Verify', 'D7 Prevent recurrence', 'D8 Close'];
    X.D8 = D8; X.ncr = []; let ncrSeq = 2207;
    const recent = {};
    const SCEN_NCR = { shortshot: ['Back cover short shot', 'Worn check ring on IM10', 'Check ring replaced; lots held; mould on IM20'], coating: ['Chassis paint peeling', 'Burner fault on the press line 4 coating oven', 'Burner repaired; under-cured lots held'], software: ['HDMI-CEC handshake fail', 'Firmware v3.2.0 HDMI-CEC handling', 'Writers rolled back; boards re-flashed; release returned to PE'] };
    function openNcr(code, o) {
      let n = X.ncr.find(x => x.code === code && x.step < 7);
      if (!n) { n = Object.assign({ id: 'NCR-' + (++ncrSeq), code, opened: P.t, step: 1, count: 0, owner: 'Quality engineer, final QA', cause: 'Under investigation', action: '—' }, o); X.ncr.unshift(n); if (X.ncr.length > 30) X.ncr.pop(); msg('GMES', 'SAP-QM', 'Defect', `${n.id} opened · ${code}`, { ref: o && o.ref }); }
      return n;
    }
    E.on((type, d) => {
      if (type !== 'defect') return;
      const code = d.u.defect.code, sc = Object.keys(SCEN_NCR).find(k => SCEN_NCR[k][0] === code);
      const r = recent[code] = (recent[code] || []).filter(t => P.t - t < 1800); r.push(P.t);
      if (sc || r.length >= 3) { const n = openNcr(code, { ref: d.st.id, scen: sc, line: d.st.line }); n.count++; n.last = P.t; }
    });
    function ncrStep() {
      for (const n of X.ncr) {
        if (n.step >= 7) continue;
        const age = (P.t - n.opened) / 60;
        if (n.scen) {
          const S = P.scen[n.scen], fixed = S && S.fixed;
          if (n.step < 2 && age > 2) n.step = 2;                                           // contained at final QA: sorting
          if (n.step < 3 && (fixed || P.recs.some(r => ['shot', 'coat', 'sw'].includes(r.key)))) { n.step = 3; n.cause = SCEN_NCR[n.scen][1]; }
          if (fixed && n.step < 4) { n.step = 4; n.action = SCEN_NCR[n.scen][2]; n.fixedAt = P.t; }
          if (n.fixedAt && n.step < 5 && P.t - n.fixedAt > 600) n.step = 5;               // verified: no new fails for 10 min
          if (n.step === 5 && P.t - n.fixedAt > 1800) n.step = 6;
          if (n.step === 6 && P.t - n.fixedAt > 3600) n.step = 7;
        } else {
          if (n.step < 2 && age > 3) n.step = 2;
          if (n.step < 3 && age > 10) { n.step = 3; n.cause = 'Operator handling at the station (5-why)'; }
          if (n.step < 4 && age > 15) { n.step = 4; n.action = 'Work instruction updated; operators re-briefed'; }
          if (n.step < 5 && age > 30 && P.t - n.last > 900) n.step = 5;
          if (n.step === 5 && age > 50) n.step = 6;
          if (n.step === 6 && age > 70) n.step = 7;
        }
      }
    }
    let ncrAcc = 0; E.on(t => { if (t === 'second' && ++ncrAcc % 10 === 0) ncrStep(); });

    /* ----- HR: the skills matrix (ILUO levels and certificate expiry) ----- */
    const hash = s0 => { let h = 2166136261; for (const c of s0) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return (h >>> 0) / 4294967296; };
    for (const p of P.people) if (p.role === 'Operator') {
      const st = P.byId[p.at], u = hash(p.id + p.name);
      p.level = u < 0.12 ? 2 : u < 0.55 ? 3 : 4;                 // I = in training, L = can work with help, U = certified, O = can train others
      p.certExp = Math.round((hash(p.name + p.id) * 420 - 40));    // days until the station certificate expires; negative = expired
      p.cross = st ? Object.values(P.lines).filter(L => L.kind === 'main' && L.id !== st.line && hash(p.id + L.id) < 0.35).map(L => L.id) : [];
    }
    X.skills = line => {
      const L = P.lines[line]; if (!L) return [];
      return L.stations.filter(s => s.manual).map(s => ({ st: s, crew: s.crew.map(p => ({ p, level: p.level || 3, exp: p.certExp, present: p.present, cover: p.cover })) }));
    };

    X.run = mrpRun; X.approve = approve; X.sopRun = sopRun; X.usage = usage; X.egp = egp; X.num = num; X.wkLabel = wkLabel; X.rate = rate; X.fgQty = fgQty;
    return X;
  }

  const PlantERP = { create, DEPTS, SYSTEMS };
  if (typeof module !== 'undefined' && module.exports) module.exports = PlantERP;
  else root.PlantERP = PlantERP;
})(typeof window !== 'undefined' ? window : globalThis);
