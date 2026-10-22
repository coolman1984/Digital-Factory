/* Digital Factory — Live plant, the AI agent crew.
   Eight agents watch the plant and the enterprise layer. Each one owns a domain, says what it sees (evidence with the
   numbers behind it), forms options, and simulates every option on a fast forecast of the plant before it recommends
   one ("simulate before act"). The forecast is a flow model of the six main lines and everything that feeds them:
   line rates, PBA, chassis, back-cover, open-cell and carton stock, the feeding lines, repairs and predicted failures,
   changeovers, staffing, inbound deliveries and the orders due. Agents negotiate when their goals collide, and act on
   their own only when the user sets them to Auto and the action is reversible. Every step is logged.
   Pure model: no DOM. All data simulated. */
(function (root) {
  'use strict';

  const AGENTS = [
    { id: 'maint', name: 'Maintenance agent', dept: 'pe', role: 'Predicts failures from vibration, temperature and health trends; picks the cheapest repair window; checks technicians and spare parts.' },
    { id: 'quality', name: 'Quality agent', dept: 'quality', role: 'Runs SPC with Nelson rules on process signals, traces defects to a machine, a lot or a firmware through genealogy, and contains them.' },
    { id: 'aps', name: 'Scheduling agent', dept: 'planning', role: 'Forecasts every order against the lines, re-sequences or re-balances lines when an order is at risk, and weighs overtime and changeovers.' },
    { id: 'material', name: 'Material agent', dept: 'scm', role: 'Projects the runway of every store and line-side stock against inbound deliveries and the milk-run timetable; resolves shortages.' },
    { id: 'logistics', name: 'Logistics agent', dept: 'scm', role: 'Dispatches AGVs, milk runs and forklifts; sends hot runs; watches docks and vehicle faults.' },
    { id: 'energy', name: 'Energy agent', dept: 'pe', role: 'Forecasts the 15-minute demand peak against the 4,000 kW contract and shaves it without touching takt.' },
    { id: 'people', name: 'People agent', dept: 'hr', role: 'Matches certified operators to stations, covers absences, approves overtime within policy.' },
    { id: 'service', name: 'Service agent', dept: 'svc', role: 'Balances spare parts for customers against production needs.' },
    { id: 'safety', name: 'Safety and vision agent', dept: 'ehs', role: 'Watches the camera feeds with AI vision: people, vehicles, forklift near misses and missing PPE. Feeds the andon and keeps the safety log with a still of each incident.' }
  ];
  const OWNER = { Maintenance: 'maint', Quality: 'quality', Planning: 'aps', Logistics: 'logistics', Energy: 'energy', Service: 'service', HR: 'people' };

  function create(E, X) {
    const P = E.P, MODELS = E.MODELS, SIZE = E.SIZE, level = E.level;
    const A = {
      AGENTS: AGENTS.map(a => Object.assign({ autonomy: a.id === 'logistics' || a.id === 'energy' || a.id === 'safety' ? 'auto' : 'approve', acted: 0, signals: 0 }, a)),
      feed: [], cards: new Map(), decided: [], incidents: [], stats: { decisions: 0, auto: 0, simulated: 0, saved: 0 }
    };
    const agent = id => A.AGENTS.find(a => a.id === id);
    const mainLines = () => Object.values(P.lines).filter(L => L.kind === 'main');
    const num = v => Math.round(v).toLocaleString('en-US');
    function say(id, text, level = 'info', ref) {
      const a = agent(id); const e = { t: P.t, time: E.clock(P.t), agent: a.name, id, text, level, ref };
      A.feed.unshift(e); if (A.feed.length > 120) A.feed.pop();
      E.emit('agentFeed', e); return e;
    }

    /* ---------------- the forecast: a flow model of the plant ---------------- */
    const H = 120;          // minutes ahead
    const LAG = 25;         // minutes from LCM input to packed (conveyors, test, 20 min aging, packing)
    const crewOf = L => { const ms = L.stations.filter(s => s.manual); if (!ms.length) return 1; let k = 1; for (const s of ms) k = Math.min(k, s.crew.filter(p => p.present).length / s.staff); return k < 1 ? Math.max(0.55, k) : 1; };
    function downLeft(L) {
      let t = 0;
      for (const s of L.stations) {
        if (s.state === 'down') t = Math.max(t, (s.tech && s.tech.state === 'repairing' ? Math.max(0, s.repair) : (s.repair || 1500) + 240) / 60);
        else if (s.state === 'maint') t = Math.max(t, Math.max(0, s.repair) / 60);
        else if (s.state === 'changeover') t = Math.max(t, Math.max(0, s.co) / 60);
      }
      if (L.tripped) t = Math.max(t, 3);
      return t;
    }
    const failAt = L => { let f = null; for (const s of L.stations) if (s.degrade > 0 && s.state !== 'down' && !s.planned) { const m = (s.health - 22) / s.degrade / 60; if (!f || m < f.at) f = { at: m, dur: (s.failRepair || 2100) / 60 + 5, st: s.id }; } return f; };
    function snapshot(h = H) {
      const S = { t: P.t, h, lines: {}, feed: {}, stock: {}, fg: {}, orders: [], inbound: [] };
      for (const L of mainLines()) {
        const m = L.model, sz = SIZE(m), n = L.id.slice(2);
        const LC = P.lines['LCM' + n];
        S.lines[L.id] = { id: L.id, model: m, sz, rate: 3600 / MODELS[m].takt * 0.9 * L.speed * crewOf(L) / 60, down: Math.max(downLeft(L), downLeft(LC)), fail: failAt(L) || failAt(LC), out: 0, curve: [] };
      }
      for (const L of Object.values(P.lines)) {
        if (L.kind === 'smd') S.feed[L.id] = { code: 'PBA-' + SIZE(L.model), rate: 5.4, down: downLeft(L), fail: failAt(L) };
        else if (L.kind === 'press') S.feed[L.id] = { code: 'CHS-' + L.size, rate: 3.2, down: downLeft(L), fail: failAt(L) };
      }
      for (const s of P.lines.INJ.stations) S.feed[s.id] = { code: s.part, rate: 60 / s.base * s.batchOut, down: s.state === 'down' || s.state === 'maint' ? Math.max(0, s.repair || 1500) / 60 : s.state === 'changeover' ? Math.max(0, s.co) / 60 : 0, fail: null };
      const add = (code, q) => { S.stock[code] = (S.stock[code] || 0) + q; };
      for (const b of Object.values(P.bufs)) {
        if (!b.code || b.id.startsWith('SVC:') || b.id.startsWith('WIP:')) continue;
        if (/^(PBA|CHS|BC|OC|CTN)-/.test(b.code)) add(b.code, level(b));
      }
      for (const m of Object.keys(MODELS)) S.fg[m] = X.fgQty(m);
      for (const o of P.orders) if ((o.state === 'open' || o.state === 'loading') && o.due - P.t < h * 60) S.orders.push({ id: o.id, model: o.model, need: o.qty - o.shipped - (o.truck ? o.truck.loaded : 0), due: (o.due - P.t) / 60, value: MODELS[o.model].price });
      for (const p of X.po) if (p.status === 'In transit' && /^(OC|CTN)-/.test(p.code) && (p.eta - P.t) / 60 < h) S.inbound.push({ code: p.code, qty: p.qty, at: Math.max(0, (p.eta - P.t) / 60) + (p.src === 'import' ? 15 : 8) });
      // what is already between LCM input and packing finishes in the first LAG minutes
      for (const L of mainLines()) S.lines[L.id].pipe = (L.tph || 0) / 60;
      return S;
    }
    const clone = S => JSON.parse(JSON.stringify(S));
    const unitMargin = m => { const c = MODELS[m].cost; return MODELS[m].price - c.mat - c.lab - c.ovh; };
    // run the flow model; mods change the snapshot: downs, failures avoided, changeovers, speed, staff, supply
    function forecast(mods = {}, S0) {
      const S = clone(S0 || snapshot());
      for (const d of mods.down || []) { const t = S.lines[d.id] || S.feed[d.id]; if (t) { t.extra = t.extra || []; t.extra.push([d.at || 0, (d.at || 0) + d.dur]); } }
      for (const id of mods.noFail || []) { const t = S.lines[id] || S.feed[id]; if (t) t.fail = null; }
      for (const c of mods.co || []) { const t = S.lines[c.id]; if (t) { t.coAt = c.at || 0; t.coDur = c.dur; t.coModel = c.model; } }
      for (const c of mods.smd || []) { const t = S.feed[c.id]; if (t) { t.coAt = c.at || 0; t.coDur = c.dur; t.coCode = c.code; } }
      for (const r of mods.rate || []) { const t = S.lines[r.id]; if (t) t.rate *= r.k; }
      for (const r of mods.supply || []) S.inbound.push(r);
      for (const r of mods.unblock || []) S.stock[r.code] = (S.stock[r.code] || 0) + r.qty;
      for (const r of mods.take || []) S.stock[r.code] = Math.max(0, (S.stock[r.code] || 0) - r.qty);
      const isDown = (t, m) => (m < t.down) || (t.fail && m >= t.fail.at && m < t.fail.at + t.fail.dur) || (t.extra && t.extra.some(([a, b]) => m >= a && m < b)) || (t.coAt !== undefined && m >= t.coAt && m < t.coAt + t.coDur);
      const assembled = {}; for (const id in S.lines) assembled[id] = [];
      let late = 0, lateUnits = 0, revDelayed = 0, packed = 0, starvedMin = 0, margin = 0;
      const HZ = S.h || H;
      const lateList = [];
      const curve = [];
      for (let m = 0; m < HZ; m++) {
        for (const r of S.inbound) if (r.at >= m && r.at < m + 1) S.stock[r.code] = (S.stock[r.code] || 0) + r.qty;
        for (const id in S.feed) { const f = S.feed[id]; if (isDown(f, m)) continue; const code = f.coCode && m >= f.coAt + f.coDur ? f.coCode : f.code; S.stock[code] = (S.stock[code] || 0) + f.rate; }
        // each model's lines share the materials they need this minute
        const byModel = {};
        for (const id in S.lines) { const t = S.lines[id]; const model = t.coModel && m >= t.coAt + t.coDur ? t.coModel : t.model; (byModel[model] = byModel[model] || []).push([t, isDown(t, m) ? 0 : t.rate]); }
        for (const model in byModel) {
          const sz = SIZE(model), need = byModel[model].reduce((a, x) => a + x[1], 0); if (!need) { byModel[model].forEach(([t]) => assembled[t.id].push(0)); continue; }
          const codes = ['PBA-' + sz, 'CHS-' + sz, 'BC-' + sz, 'OC-' + sz, 'CTN-' + sz];
          let k = 1; for (const c of codes) k = Math.min(k, (S.stock[c] || 0) / need);
          k = Math.max(0, Math.min(1, k)); if (k < 0.99) starvedMin += 1;
          for (const c of codes) S.stock[c] = Math.max(0, (S.stock[c] || 0) - need * k);
          for (const [t, r] of byModel[model]) { const q = r * k; assembled[t.id].push(q); t.model2 = model; }
        }
        // packed: the pipeline first, then what was assembled LAG minutes ago
        let pk = 0;
        for (const id in S.lines) { const t = S.lines[id]; const q = m < LAG ? t.pipe : (assembled[id][m - LAG] || 0); t.out += q; pk += q; margin += q * unitMargin(t.model2 || t.model); S.fg[t.model2 || t.model] = (S.fg[t.model2 || t.model] || 0) + q; }
        packed += pk;
        for (const o of S.orders) if (!o.done && o.due <= m + 1) {
          o.done = true; const have = Math.min(S.fg[o.model] || 0, o.need); S.fg[o.model] -= have;
          if (have < o.need - 0.5) { late++; lateUnits += o.need - have; revDelayed += (o.need - have) * o.value; lateList.push(o.id); }
        }
        if (m % (HZ / 12) === HZ / 12 - 1) curve.push(Math.round(packed));
      }
      A.stats.simulated++;
      return { h: HZ, packed: Math.round(packed), margin, late, lateUnits: Math.round(lateUnits), revDelayed, starvedMin, curve, lateList, byLine: Object.fromEntries(Object.values(S.lines).map(t => [t.id, Math.round(t.out)])) };
    }
    A.forecast = forecast; A.snapshot = snapshot;

    /* ---------------- evidence helpers ---------------- */
    function trend(arr, n = 60) {
      const a = (arr || []).slice(-n); if (a.length < 8) return null;
      const N = a.length, mx = (N - 1) / 2, my = a.reduce((s, v) => s + v, 0) / N;
      let sxy = 0, sxx = 0, syy = 0; a.forEach((v, i) => { sxy += (i - mx) * (v - my); sxx += (i - mx) ** 2; syy += (v - my) ** 2; });
      const slope = sxy / sxx, r2 = syy ? (sxy * sxy) / (sxx * syy) : 0;
      return { slope, r2, last: a[N - 1], mean: my };
    }
    // SPC: control limits from a golden run of the normal process (captured at start), Nelson rules on the latest samples
    const BASE = {};
    function limits(key, arr) {
      if (BASE[key]) return BASE[key];
      const a = (arr || []).filter(v => v > 0); if (a.length < 25) return null;
      const mu = a.reduce((s, v) => s + v, 0) / a.length;
      return (BASE[key] = { mu, sd: Math.sqrt(a.reduce((s, v) => s + (v - mu) ** 2, 0) / a.length) || 1e-6 });
    }
    limits('IM10:press', P.byId.IM10.hist.press);
    for (const L of Object.values(P.lines)) if (L.kind === 'press') { const ov = L.stations.find(x => x.kind === 'oven'); if (ov) limits(ov.id + ':temp', ov.hist.temp); }
    A.limits = limits;
    function spc(arr0, key) {
      const a = (arr0 || []).filter(v => v > 0), lim = limits(key, a); if (!lim || a.length < 20) return null;
      const { mu, sd } = lim;
      const recent = a.slice(-20), rules = [];
      if (recent.some(v => Math.abs(v - mu) > 3 * sd)) rules.push('Rule 1: a point beyond 3σ');
      let run = 0, side = 0, best = 0; for (const v of a.slice(-15)) { const sg = Math.sign(v - mu); if (sg === side) run++; else { side = sg; run = 1; } best = Math.max(best, run); } if (best >= 9) rules.push('Rule 2: 9 points on one side of the mean');
      let tr = 0, bt = 0; const r = a.slice(-10); for (let i = 1; i < r.length; i++) { if (Math.sign(r[i] - r[i - 1]) === Math.sign(r[1] - r[0])) tr++; else tr = 0; bt = Math.max(bt, tr); } if (bt >= 5) rules.push('Rule 3: 6 points trending');
      let two = 0; for (const v of a.slice(-3)) if (Math.abs(v - mu) > 2 * sd) two++; if (two >= 2) rules.push('Rule 5: 2 of 3 beyond 2σ');
      return { mu, sd, ucl: mu + 3 * sd, lcl: mu - 3 * sd, rules, last: a[a.length - 1] };
    }
    A.spc = spc;
    const smooth = (a, k = 5) => (a || []).map((_, i, x) => { const w = x.slice(Math.max(0, i - k + 1), i + 1); return w.reduce((p, v) => p + v, 0) / w.length; });
    const lane = m => level(E.STORE.PBA['PBA-' + SIZE(m)]) + mainLines().filter(L => L.model === m).reduce((a, L) => a + L.ls.PBA.items.length, 0);
    const useRate = m => mainLines().filter(L => L.model === m).reduce((a, L) => a + 3600 / MODELS[m].takt, 0);

    /* ---------------- options for each kind of decision ---------------- */
    // every option: label, the engine action (or null), the forecast mods, the direct cost, and whether it can be undone
    function optionsFor(r, S) {
      const [kind, arg] = r.key.split(/:(.+)/);
      const o = [];
      if (kind === 'rul') {
        const s = P.byId[arg], L = P.lines[s.line], f = failAt(L);
        const id = L.kind === 'smd' || L.kind === 'press' ? L.id : L.id;
        o.push({ id: 'planRepair:' + arg, label: 'Repair now (8 min)', mods: { noFail: [id], down: [{ id, at: 0, dur: 8 }] }, cost: 9000, reversible: true, note: 'Technician and a bearing from stores' });
        const win = f ? Math.max(5, Math.floor(f.at * 0.6)) : 20;
        const risk = f ? Math.min(0.9, win / f.at * 0.35) : 0.1;
        o.push({ id: `agent:repairAt:${arg}:${win}`, label: `Repair in ${win} min, when the PBA lane is fuller`, mods: { noFail: [id], down: [{ id, at: win, dur: 8 }] }, cost: 9000 + Math.round(risk * 38000), reversible: true, note: `Failure risk before then: ${Math.round(risk * 100)}% (priced in)` });
        o.push({ id: null, label: 'Run to failure', mods: {}, cost: 38000, reversible: false, note: 'Unplanned stop of about 35 min, a damaged spindle and scrap boards' });
      } else if (kind === 'pba') {
        const act = (r.actions || []).find(a => a.id.startsWith('switchSmd'));
        if (act) { const [, lid, m] = act.id.split(':'); o.push({ id: act.id, label: act.label, mods: { smd: [{ id: lid, at: 0, dur: 10, code: 'PBA-' + SIZE(m) }] }, cost: 4000, reversible: true, note: '10-minute changeover' }); }
        o.push({ id: null, label: 'Wait for the SMD repair', mods: {}, cost: 0, reversible: true });
      } else if (kind === 'rw' || kind === 'src') {
        // the station stops for the gap between its runway and the next delivery
        const b = P.bufs[arg], rw = b ? E.runway(b) / 60 : 0;
        const m = /about (\d+):(\d+) min/.exec(r.body || ''), eta = m ? +m[1] + m[2] / 60 : 8;
        const tgt = b ? (/^LCM/.test(b.line) ? 'ML' + b.line.slice(3) : b.line) : null;
        const gap = (t, cyc) => (tgt && t > rw ? [{ id: tgt, at: rw, dur: t - rw + cyc }] : []);
        const act = (r.actions || []).find(a => !a.id.startsWith('focus'));
        if (act) o.push({ id: act.id, label: act.label, mods: { down: gap(2.5, 0) }, cost: 600, reversible: true, note: 'One AGV trip, about 2–3 min' });
        o.push({ id: null, label: kind === 'src' ? 'Wait for the source to refill' : 'Wait for the next delivery', mods: { down: gap(kind === 'src' ? 15 : eta, 1.5) }, cost: 0, reversible: true, note: kind === 'src' ? 'The feeding line or supplier must recover first' : `Next delivery in about ${Math.round(eta)} min` });
      } else if (kind === 'shot' || kind === 'coat' || kind === 'sw') {
        const act = (r.actions || []).find(a => !a.id.startsWith('focus'));
        const lines = kind === 'sw' ? ['ML1', 'ML2'] : ['ML4', 'ML5'];
        o.push({ id: act && act.id, label: act ? act.label : 'Contain', mods: kind === 'shot' ? {} : {}, cost: kind === 'sw' ? 6000 : 15000, reversible: true, note: 'Stops the defects at the source', defectsAvoided: kind === 'sw' ? 70 : 40 });
        o.push({ id: null, label: 'Keep running and sort at final QA', mods: { rate: lines.map(id => ({ id, k: kind === 'sw' ? 0.82 : 0.9 })) }, cost: kind === 'sw' ? 52000 : 34000, reversible: true, note: 'Rework cost and escape risk rise' });
      } else if (kind === 'absent') {
        o.push({ id: 'moveOps', label: 'Move 6 operators from line 6 and 2 h overtime', mods: { rate: [{ id: 'ML3', k: 1 / 0.65 }, { id: 'ML6', k: 0.98 }] }, cost: 1700, reversible: true, note: 'Line 6 runs below plan, so its spare operators cost it little' });
        o.push({ id: null, label: 'Run line 3 short-staffed', mods: {}, cost: 0, reversible: true });
      } else if (kind === 'erp.oc65') {
        o.push({ id: 'erp:oc65:bonded', label: 'Release 1,200 panels from the bonded warehouse', mods: { supply: [{ code: 'OC-65', qty: 1200, at: 120 }] }, cost: 38000, reversible: false });
        o.push({ id: 'erp:oc65:replan', label: 'Move main line 5 to UHD 55', mods: { co: [{ id: 'ML5', at: 0, dur: 15, model: 'M55' }] }, cost: 12000, reversible: true });
        o.push({ id: null, label: 'Wait for the container', mods: {}, cost: 0, reversible: true });
      } else if (kind === 'erp.ctn55') {
        o.push({ id: 'erp:ctn:backup', label: 'Order 1,500 from the backup vendor', mods: { supply: [{ code: 'CTN-55', qty: 1500, at: 78 }] }, cost: 13500, reversible: false });
        o.push({ id: 'erp:ctn:concession', label: 'Release the blocked lot under concession', mods: { unblock: [{ code: 'CTN-55', qty: X.cartonBlk ? X.cartonBlk.qty : 0 }] }, cost: 4000, reversible: false, note: 'Small transit-damage risk' });
        o.push({ id: null, label: 'Wait for the vendor truck', mods: {}, cost: 0, reversible: true });
      } else if (kind === 'erp.field') {
        const need = X.fieldOrder ? X.fieldOrder.lines[0].qty - level(E.STORE.SVC['PBA-55']) : 40;
        o.push({ id: 'erp:field:take', label: `Take ${need} boards from production`, mods: { take: [{ code: 'PBA-55', qty: need }] }, cost: 0, reversible: false, note: 'Customers served today' });
        o.push({ id: 'erp:field:smd3', label: 'Run SMD 3 on PBA 55 for 30 min', mods: { smd: [{ id: 'SMD3', at: 0, dur: 10, code: 'PBA-55' }] }, cost: 6000, reversible: true });
        o.push({ id: null, label: 'Ship to service centres tomorrow', mods: {}, cost: 25000, reversible: true, note: 'Customer complaints and service-level penalty' });
      } else if (kind === 'agent.energy') {
        o.push({ id: 'agent:shave', label: 'Stage compressor 3 off and raise chiller 2 setpoint for 30 min', mods: {}, cost: 0, reversible: true, kwSaved: 190 });
        o.push({ id: null, label: 'Accept the peak', mods: {}, cost: Math.round(Math.max(0, (A.energy ? A.energy.peak : 4000) - 4000) * 180), reversible: true, note: 'Demand charge for the month' });
      } else if (kind === 'agent.aps') {
        const lid = arg;
        o.push({ id: 'boost:' + lid, label: `Raise ${P.lines[lid].name} to 108%`, mods: { rate: [{ id: lid, k: 1.08 }] }, cost: 2500, reversible: true, note: 'Slightly higher micro-stop rate' });
        o.push({ id: null, label: 'Re-promise the order (split delivery)', mods: {}, cost: 0, reversible: true });
      } else {
        const act = (r.actions || []).find(a => !a.id.startsWith('focus'));
        if (act) o.push({ id: act.id, label: act.label, mods: {}, cost: 0, reversible: true });
        o.push({ id: null, label: 'Do nothing', mods: {}, cost: 0, reversible: true });
      }
      // simulate each option against the same snapshot
      for (const op of o) op.f = forecast(op.mods, S);
      // score = direct cost + contribution lost against the best option + a share of revenue that slips + starvation
      const top = Math.max(...o.map(op => op.f.margin));
      for (const op of o) {
        op.lost = Math.round(top - op.f.margin);
        op.score = op.cost + op.lost + op.f.revDelayed * 0.08 + op.f.starvedMin * 300 + (op.defectsAvoided ? -op.defectsAvoided * 650 : 0) + (op.kwSaved ? -op.kwSaved * 180 : 0);
      }
      return o;
    }

    /* ---------------- evidence and reasoning for each decision ---------------- */
    function evidenceFor(r) {
      const [kind, arg] = r.key.split(/:(.+)/);
      const ev = [], why = [], talk = [];
      if (kind === 'rul') {
        const s = P.byId[arg], t = trend(smooth(s.hist.vib), 60), th = trend(s.hist.health, 60), L = P.lines[s.line];
        const rul = (s.health - 22) / s.degrade / 60;
        ev.push({ label: 'Spindle vibration', value: `${(s.sens.vib || 0).toFixed(2)} mm/s`, series: s.hist.vib, limit: 4.5 });
        ev.push({ label: 'Health', value: `${s.health.toFixed(0)}%`, series: s.hist.health });
        ev.push({ label: 'Remaining useful life', value: `${Math.round(rul)} min (${Math.round(rul * 0.82)}–${Math.round(rul * 1.2)})` });
        const freeTech = P.techs.filter(x => x.state === 'available').length;
        ev.push({ label: 'Technicians free', value: `${freeTech} of ${P.techs.length}` }, { label: 'Spindle bearings in stores', value: '3 (MRO-BRG-6204)' });
        why.push(`Vibration rises ${t ? Math.max(0, t.slope * 12).toFixed(2) : '?'} mm/s a minute, the bearing-wear signature (94% match with past spindle failures).`);
        why.push(`Health falls ${(s.degrade * 60).toFixed(1)} points a minute (linear fit R² ${th ? th.r2.toFixed(2) : '?'}); failure is expected at 22%.`);
        if (L.kind === 'smd') {
          const m = L.model, ln = lane(m), cover = ln / (useRate(m) / 60);
          talk.push({ from: 'Maintenance agent', text: `I want to stop ${s.name} on ${L.name} for 8 minutes.` });
          talk.push({ from: 'Scheduling agent', text: `PBA ${SIZE(m)} stock covers ${Math.round(cover)} minutes of main lines ${mainLines().filter(x => x.model === m).map(x => x.id.slice(2)).join(' and ')}. ${cover > 12 ? 'An 8-minute stop now is safe.' : 'Wait until the lane is fuller.'}` });
          talk.push({ from: 'Material agent', text: 'Bare PCBs for this line are on the next milk-run lap; no impact.' });
        }
      } else if (kind === 'shot') {
        const s = P.byId.IM10, c = spc(s.hist.press, 'IM10:press');
        ev.push({ label: 'Injection pressure', value: `${num(s.sens.press || 0)} bar`, series: s.hist.press, limit: c ? c.lcl : undefined });
        ev.push({ label: 'Cavity fill', value: `${(s.sens.fill || 0).toFixed(1)}%` });
        if (c) why.push(`SPC on IM10 pressure: mean ${num(c.mu)} bar, LCL ${num(c.lcl)}. ${c.rules.length ? 'Nelson ' + c.rules.join('; ') : 'No Nelson rule has fired yet, but the mean is drifting down'}.`);
        why.push(`Genealogy: every TV rejected for a short shot carries a back-cover lot from IM10 (${P.scen.shortshot ? P.scen.shortshot.lots.size : 0} lots).`);
        talk.push({ from: 'Quality agent', text: 'Hold the IM10 lots and move the mould to IM20.' }, { from: 'Scheduling agent', text: 'IM20 needs 40 minutes for the mould change; the injection supermarket covers BC-65 for about that long.' });
      } else if (kind === 'coat') {
        const ov = P.byId[(P.scen.coating && P.scen.coating.line || 'PR4') + '-Coating'], c = spc(ov.hist.temp, ov.id + ':temp');
        ev.push({ label: 'Cure temperature', value: `${(ov.sens.temp || 0).toFixed(1)} °C`, series: ov.hist.temp, limit: 190 });
        if (c) why.push(`SPC on the oven: mean ${c.mu.toFixed(1)} °C, LCL ${c.lcl.toFixed(1)} °C. ${c.rules.length ? 'Nelson ' + c.rules.join('; ') : 'Below the 190 °C cure window'}.`);
        why.push('Every chassis that peeled at final QA was coated in this oven during the drop.');
      } else if (kind === 'sw') {
        const S = P.scen.software;
        ev.push({ label: 'Firmware on PBA 55 writers', value: P.sw['PBA-55'].version }, { label: 'Function-test fails with it', value: num(S ? S.fails : 0) });
        why.push(`All HDMI-CEC fails share firmware ${S ? S.bad : ''}; boards with ${S ? S.good : ''} pass. Released by PE today (ECN).`);
        talk.push({ from: 'Quality agent', text: 'Roll back the writers and re-flash the boards in stock.' }, { from: 'Maintenance agent', text: 'Writers can switch image without stopping the SMD lines.' });
      } else if (kind === 'pba') {
        const m = arg, ln = lane(m);
        ev.push({ label: `PBA ${SIZE(m)} on hand`, value: `${num(ln)} boards` }, { label: 'Main-line use', value: `${num(useRate(m))} an hour` });
        why.push('The SMD line that makes these boards is stopped; the supermarket will run dry before it restarts.');
      } else if (kind === 'erp.oc65') {
        ev.push({ label: 'OC-65 on hand', value: num(level(E.STORE.IMP['OC-65'])) }, { label: 'Container', value: 'Held at port · customs, 5 days' });
        why.push('Lines 4 and 5 use about 260 open cells an hour; the next container is 5 days away.');
        talk.push({ from: 'Material agent', text: '1,200 panels sit in the bonded warehouse; customs release takes 2 hours.' }, { from: 'Scheduling agent', text: 'Or move line 5 to UHD 55: QLED 65 orders slip, UHD 55 orders are pulled in.' }, { from: 'Finance', text: 'Bonded release costs EGP 38k; a slipped QLED 65 order delays about EGP 2.6M of revenue.' });
      } else if (kind === 'agent.energy') {
        ev.push({ label: '15-minute average now', value: `${num(A.energy.avg)} kW`, series: P.hist.kw, limit: 4000 }, { label: 'Forecast peak', value: `${num(A.energy.peak)} kW` }, { label: 'Contract limit', value: '4,000 kW' });
        why.push('Chillers and compressors are rising with the afternoon heat; cushions and injection run at full load.');
      } else if (kind === 'agent.aps') {
        ev.push({ label: 'Orders at risk', value: (A.apsLate || []).join(', ') || '—' });
        why.push('The forecast of the next two hours finds this order short at its due time.');
      } else if (kind === 'erp.ctn55') {
        const lsQ = Object.values(E.LS).filter(b => b.code === 'CTN-55').reduce((a, b) => a + level(b), 0);
        ev.push({ label: 'CTN-55 usable', value: `${num(level(E.STORE.LOC['CTN-55']) + lsQ)} cartons` }, { label: 'Blocked by IQC', value: `${num(X.cartonBlk ? X.cartonBlk.qty : 0)} (crush −18%)` }, { label: 'Use, UHD 55 lines', value: `${num(useRate('M55'))} an hour` }, { label: 'Vendor truck', value: '3 h late' });
        talk.push({ from: 'Logistics agent', text: 'The backup vendor can deliver 1,500 in about 70 minutes.' }, { from: 'Quality agent', text: 'A concession is acceptable with corner protectors, but crush strength is 18% low: some transit damage is likely.' }, { from: 'Scheduling agent', text: 'Either way lines 1 and 2 keep running; waiting starves packing within the hour.' });
      } else if (kind === 'erp.field') {
        ev.push({ label: 'Service store PBA-55', value: `${num(level(E.STORE.SVC['PBA-55']))} boards` }, { label: 'Service centres waiting', value: `${num(X.fieldOrder ? X.fieldOrder.lines[0].qty : 0)} boards` }, { label: 'Production lane PBA-55', value: `${num(lane('M55'))} boards` });
        talk.push({ from: 'Service agent', text: 'Customers have been without a TV for days; the service level is at risk.' }, { from: 'Scheduling agent', text: 'Taking the boards leaves main lines 1 and 2 enough cover until SMD 1 and 2 refill the lane.' });
      } else if (kind === 'absent') {
        const ms = P.lines.ML3.stations.filter(x => x.manual), need = ms.reduce((a, x) => a + x.staff, 0), have = ms.reduce((a, x) => a + x.crew.filter(q => q.present).length, 0);
        ev.push({ label: 'Operators on line 3', value: `${have} of ${need}` }, { label: 'Line 3 output', value: `${num(P.lines.ML3.tph)} an hour` }, { label: 'Line 6 against plan', value: `${(P.lines.ML6.oee * 100).toFixed(0)}% OEE` });
        talk.push({ from: 'People agent', text: 'Six operators on line 6 hold the certificates for line 3 stations.' }, { from: 'Scheduling agent', text: 'Line 6 can give them up with little loss; line 3 gains far more.' });
      } else if (kind === 'rw' || kind === 'src') {
        const b = P.bufs[arg];
        if (b) ev.push({ label: `${b.code} at the station`, value: `${num(level(b))} left` }, { label: 'Runway', value: E.mins(E.runway(b)) }, { label: 'Source', value: `${num(level(P.bufs[b.src] || { qty: 0, lots: [] }))} at ${(P.bufs[b.src] || {}).label || b.src}` });
      }
      if (!why.length && r.body) why.push(r.body);
      return { ev, why, talk };
    }

    /* ---------------- the agents' own detectors ---------------- */
    A.energy = { avg: 0, peak: 0 };
    function detect() {
      // energy: 15-minute average and its forecast
      const kw = P.hist.kw.slice(-180); const avg = kw.reduce((a, b) => a + b, 0) / Math.max(1, kw.length);
      const tr = trend(kw, 60); const peak = avg + (tr ? Math.max(0, tr.slope) * 180 : 0);
      A.energy = { avg, peak };
      const shaving = P.shave && P.t < P.shave.until;
      // only a real rise counts: a clear upward trend, or an average already close to the contract; and not again
      // within 30 minutes of the last shave unless the average itself is at the limit
      const real = (tr && tr.r2 > 0.3 && tr.slope > 0) || avg > 3900;
      const rested = !P.shave || P.t - P.shave.until > 1800 || avg > 3950;
      if (!shaving && real && rested && peak > 3960) E.rec('agent.energy', { agent: 'Energy', level: peak > 4040 ? 'crit' : 'warn', ref: 'UTIL-CH2', title: `Demand peak forecast ${num(peak)} kW against the 4,000 kW contract`, body: 'Shave the peak with utilities only; takt does not change.', actions: [{ id: 'agent:shave', label: 'Shave the peak' }, { id: 'focus:UTIL-CH2', label: 'Show chillers' }] });
      else E.rec('agent.energy', null);
      // scheduling: orders at risk in the next two hours
      const base = forecast();
      A.base = base; A.apsLate = base.lateList;
      const risk = base.lateList.map(id => P.orders.find(o => o.id === id)).filter(Boolean)[0];
      if (risk && !P.recs.some(x => x.key.startsWith('erp.') || x.key.startsWith('rul') || x.key.startsWith('pba'))) {
        const L = mainLines().filter(x => x.model === risk.model).sort((a, b) => a.speed - b.speed)[0];
        if (L && L.speed < 1.08) E.rec('agent.aps:' + L.id, { agent: 'Planning', level: 'warn', ref: L.stations[0].id, title: `Order ${risk.id} (${num(risk.qty)} × ${MODELS[risk.model].name}) is forecast short at ${E.clock(risk.due)}`, body: `${base.lateUnits} TVs short over the next two hours.`, actions: [{ id: 'boost:' + L.id, label: `Raise ${L.name} to 108%` }, { id: 'focus:' + L.stations[0].id, label: 'Show line' }] });
      } else for (const L of mainLines()) E.rec('agent.aps:' + L.id, null);
    }

    /* ---------------- decision cards: evidence, options, simulation, recommendation ---------------- */
    function card(r) {
      const prev = A.cards.get(r.key);
      if (prev && P.t - prev.at < 90 && prev.title === r.title) return prev;
      // material decisions look across the rest of the shift; everything else over the next two hours
      const S = snapshot(/^(erp\.oc65|erp\.ctn55|erp\.mrp)/.test(r.key) ? 480 : H);
      const opts = optionsFor(r, S);
      const best = opts.slice().sort((a, b) => a.score - b.score)[0];
      const owner = OWNER[r.agent] || (r.dept === 'svc' ? 'service' : r.dept === 'scm' ? 'material' : 'aps');
      const ex = evidenceFor(r);
      const st = r.key.startsWith('rul') && P.byId[r.key.slice(4)];
      const conf = st ? Math.min(0.97, 0.6 + (trend(st.hist.health, 60) || { r2: 0.5 }).r2 * 0.37) : r.key.startsWith('agent.energy') ? 0.82 : 0.9;
      // a decision an agent already took on its own stays taken while the same situation lasts (its title counts down)
      const c = { key: r.key, at: P.t, title: r.title, trigger: `${r.time} · ${r.title}`, level: r.level, owner, agentName: agent(owner).name, options: opts, best, evidence: ex.ev, why: ex.why, talk: ex.talk, confidence: conf, h: S.h, base: opts.find(o => o.id === null) || opts[opts.length - 1] };
      if (prev) for (const k of ['autoAt', 'veto', 'decided', 'autoDoneAt']) c[k] = prev[k];
      c.autoDone = !!(prev && prev.autoDone && P.t - (prev.autoDoneAt || 0) < 900);
      A.cards.set(r.key, c);
      if (!prev) {
        say(owner, `${r.title}. Simulated ${opts.length} option${opts.length > 1 ? 's' : ''} over the next ${S.h / 60} h; recommending: ${best.label}.`, r.level === 'crit' ? 'crit' : 'warn', r.ref);
        A.stats.decisions++;
      }
      // autonomy: act alone only when allowed and the recommended action can be undone
      const ag = agent(owner);
      if (ag.autonomy === 'auto' && best.id && best.reversible && !c.autoDone) {
        c.autoDone = true; c.autoDoneAt = P.t;
        decide(c, best, `${ag.name} (Auto)`, 'auto');
        say(owner, `Acted on my own (Auto): ${best.label}. Logged as ${c.decided.audit}.`, 'info', r.ref);
      }
      // risk-based interruption: on Approve, a person is asked only when it matters. A low-cost, reversible,
      // non-urgent recommendation goes ahead after two minutes unless someone vetoes it
      else if (ag.autonomy === 'approve' && best.id && best.reversible && best.cost <= 10000 && r.level !== 'crit' && !c.veto && !c.decided && !c.autoAt) {
        c.autoAt = P.t + 120;
        say(owner, `Low risk and reversible: I will go ahead with "${best.label}" at ${E.clock(c.autoAt)} unless someone vetoes it.`, 'info', r.ref);
      }
      return c;
    }
    // every decision, by a person or an agent, is applied by the plant's own deterministic action and gets an audit ID
    function decide(c, op, who, how) {
      const n0 = P.audit.length, top = P.audit[0];
      if (op.id) E.apply(op.id, who); else E.dismiss(c.key);
      const fresh = P.audit[0] !== top || P.audit.length !== n0;
      const a = fresh ? P.audit[0] : E.audit(who, op.id ? op.label : 'Chose to wait', c.title);
      c.decided = { by: who, label: op.label, audit: a.id, t: P.t, how };
      const ag = agent(c.owner); if (how !== 'person') { ag.acted++; A.stats.auto++; }
      A.decided.unshift({ key: c.key, title: c.title, agent: c.agentName, label: op.label, by: who, how, audit: a.id, time: E.clock(P.t), packed: op.f.packed, late: op.f.late, recommended: op === c.best, h: c.h });
      if (A.decided.length > 20) A.decided.pop();
      return c.decided;
    }
    A.decide = (c, op, who = 'You', how = 'person') => decide(c, op, who, how);
    A.veto = key => { const c = A.cards.get(key); if (!c) return; c.veto = true; c.autoAt = null; E.audit('You', 'Vetoed an automatic approval', `${c.best.label} · ${c.title}`); say(c.owner, `Vetoed: I will wait for a person to decide on "${c.title}".`, 'warn'); };
    A.card = r => card(r);
    function refresh() {
      for (const r of P.recs) card(r);
      for (const c of A.cards.values()) if (c.autoAt && P.t >= c.autoAt && !c.veto && !c.decided && P.recs.some(r => r.key === c.key)) {
        decide(c, c.best, `${c.agentName} (low risk, not vetoed)`, 'risk');
        say(c.owner, `Went ahead with "${c.best.label}" after two minutes without a veto. Logged as ${c.decided.audit}.`, 'info');
      }
      for (const k of [...A.cards.keys()]) if (!P.recs.some(r => r.key === k)) A.cards.delete(k);
      // signals each agent is watching (for the crew roster)
      const st = P.stations.length;
      A.AGENTS.find(a => a.id === 'maint').signals = st * 4;
      A.AGENTS.find(a => a.id === 'quality').signals = P.stations.filter(s => /fct|qa|aoi|ict|lighting|injection|oven/.test(s.kind)).length * 6;
      A.AGENTS.find(a => a.id === 'aps').signals = P.orders.filter(o => o.state === 'open' || o.state === 'loading').length + mainLines().length * 10;
      A.AGENTS.find(a => a.id === 'material').signals = Object.keys(P.bufs).length;
      A.AGENTS.find(a => a.id === 'logistics').signals = P.agvs.length + P.tuggers.length + P.forklifts.length + P.docks.length;
      A.AGENTS.find(a => a.id === 'energy').signals = P.util.assets.length + st;
      A.AGENTS.find(a => a.id === 'people').signals = P.people.length;
      A.AGENTS.find(a => a.id === 'service').signals = X.svc.orders.length + 9;
      A.AGENTS.find(a => a.id === 'safety').signals = P.people.length + P.agvs.length + P.tuggers.length + P.forklifts.length;
    }

    /* ---------------- actions only the agents take ---------------- */
    E.ext('agent', (arg, who) => {
      const [k, a, b] = arg.split(':');
      if (k === 'repairAt') {
        const id = a, min = +b;
        E.audit(who, 'Scheduled repair', `${P.byId[id].name} in ${min} min`);
        say('maint', `Repair of ${P.byId[id].name} scheduled at ${E.clock(P.t + min * 60)}; the technician is reserved.`, 'info', id);
        E.later(min * 60, () => E.apply('planRepair:' + id, 'Maintenance agent (scheduled)'));
        E.rec('rul:' + id, null);
        P.byId[id].planned = true;
        E.workOrder(P.byId[id], 'Predictive', 'Spindle bearing change (vibration trend)', 2, { status: 'Scheduled', due: P.t + min * 60, by: who });
      } else if (k === 'shave') {
        P.shave = { until: P.t + 1800, assets: { 'UTIL-AIR3': 0.1, 'UTIL-CH2': 0.6, 'UTIL-BLR': 0.85 } };
        E.audit(who, 'Peak shaved', 'Compressor 3 staged off, chiller 2 setpoint +2 °C, boiler low fire for 30 min');
        say('energy', 'Peak shaving on for 30 minutes: about 190 kW off the demand without touching takt.', 'info', 'UTIL-CH2');
        E.rec('agent.energy', null); P.saved += Math.round(Math.max(0, Math.min(190, A.energy.peak - 3810)) * 180);   // the demand charge actually avoided
      }
    });
    // a drill makes the crew re-forecast at once
    E.on((t, d) => {
      if (t === 'drill') say('aps', 'A disruption started; re-forecasting the next two hours.', 'info');
    });

    /* ---------------- safety incidents from the camera feeds ---------------- */
    let incSeq = 310;
    A.incident = o => {
      const i = Object.assign({ id: 'INC-' + (++incSeq), t: P.t, time: E.clock(P.t) }, o);
      A.incidents.unshift(i); if (A.incidents.length > 12) A.incidents.pop();
      agent('safety').acted++;
      say('safety', `${i.cam}: ${i.text}`, 'warn');
      return i;
    };

    /* ---------------- scheduling drafts: re-plans simulated over eight hours, published only by a person ---------------- */
    let draftsAt = -1e9, draftsCache = null;
    function drafts(force) {
      if (!force && draftsCache && P.t - draftsAt < 60) return draftsCache;
      const S = snapshot(240), f0 = forecast({}, S);
      const ML = mainLines(), models = [...new Set(ML.map(L => L.model))];
      const outOf = (f, m) => ML.filter(L => L.model === m).reduce((a, L) => a + (f.byLine[L.id] || 0), 0);
      const due = m => S.orders.filter(o => o.model === m).reduce((a, o) => a + o.need, 0);
      const cover = m => (S.fg[m] || 0) + outOf(f0, m) - due(m);
      const byCover = models.slice().sort((a, b) => cover(a) - cover(b));
      const target = byCover[0], spare = byCover.filter(m => m !== target && ML.filter(L => L.model === m).length > 0).pop();
      const slow = ML.filter(L => L.model === target).sort((a, b) => a.speed - b.speed)[0];
      const give = spare ? ML.filter(L => L.model === spare).sort((a, b) => (a.oee || 0) - (b.oee || 0))[0] : null;
      const list = [{ id: 'live', name: 'Live plan', note: 'What the lines run now', mods: {}, acts: [], cost: 0, co: 0 }];
      if (slow && slow.speed < 1.08) list.push({ id: 'A', name: `Draft A · ${slow.name} to 108%`, note: `More ${MODELS[target].name}, the model with the least cover`, mods: { rate: [{ id: slow.id, k: 1.08 }] }, acts: [['boost', slow.id]], cost: 5000, co: 0 });
      if (give) list.push({ id: 'B', name: `Draft B · ${give.name} to ${MODELS[target].name}`, note: `${give.name} leaves ${MODELS[spare].name} (most cover) after a 15-minute changeover`, mods: { co: [{ id: give.id, at: 0, dur: 15, model: target }] }, acts: [['co', give.id, target]], cost: 12000, co: 1 });
      if (list.length === 3) list.push({ id: 'AB', name: 'Draft C · both', note: 'Speed and changeover together', mods: { rate: list[1].mods.rate, co: list[2].mods.co }, acts: list[1].acts.concat(list[2].acts), cost: 17000, co: 1 });
      for (const d of list) { d.f = d.id === 'live' ? f0 : forecast(d.mods, S); }
      // a plan is worth what it ships on time: lost TVs at a flat contribution, revenue that slips, cost and changeovers
      const top = Math.max(...list.map(d => d.f.packed));
      for (const d of list) d.score = d.cost + (top - d.f.packed) * 1500 + d.f.revDelayed * 0.08 + d.co * 3000;
      const best = list.slice().sort((a, b) => a.score - b.score)[0];
      draftsCache = { list, best, target, at: P.t, h: 240 }; draftsAt = P.t;
      return draftsCache;
    }
    A.drafts = drafts;
    A.publish = (id, who = 'You') => {
      const D = drafts(); const d = D.list.find(x => x.id === id); if (!d || id === 'live') return;
      for (const a of d.acts) { if (a[0] === 'boost') E.apply('boost:' + a[1], who); else if (a[0] === 'co') E.changeover(+a[1].slice(2), a[2], who); }
      const au = E.audit(who, 'Published a plan', `${d.name} · forecast ${num(d.f.packed)} TVs in 4 h, ${d.f.late} late (live plan: ${num(D.list[0].f.packed)}, ${D.list[0].f.late} late)`);
      say('aps', `${d.name} is now the live plan (${au.id}). Re-forecasting.`, 'info');
      draftsCache = null; return au;
    };

    /* ---------------- ask the crew: answers from plant data ---------------- */
    function ask(q) {
      const s = q.toLowerCase();
      const k = P.kpi, base = A.base || forecast();
      const lineM = s.match(/(?:main\s*)?line\s*(\d)|ml\s*(\d)/), lid = lineM ? 'ML' + (lineM[1] || lineM[2]) : null;
      const refs = [];
      if (/summary|shift|handover|ملخص|الوردية/.test(s)) {
        const worst = Object.values(P.lines).filter(L => L.kind === 'main').sort((a, b) => a.oee - b.oee)[0];
        const loss = P.stations.slice().sort((a, b) => (b.counters.down + b.counters.starved) - (a.counters.down + a.counters.starved)).slice(0, 3);
        refs.push('line:' + worst.id, ...loss.map(x => 'st:' + x.id));
        return { text: `Shift so far: ${num(k.units)} TVs packed against a plan of ${num(k.plan)} (${k.units >= k.plan ? '+' : ''}${num(k.units - k.plan)}). Main-line OEE ${(k.oee * 100).toFixed(1)}%, lowest on ${worst.name} (${(worst.oee * 100).toFixed(0)}%). Biggest losses: ${loss.map(x => `${x.name} on ${P.lines[x.line] ? P.lines[x.line].name : x.line} (${Math.round((x.counters.down + x.counters.starved) / 60)} min stopped or starved)`).join('; ')}. The forecast for the next two hours: ${num(base.packed)} TVs, ${base.late} order${base.late === 1 ? '' : 's'} at risk. ${P.audit.length} decisions taken, ${A.stats.auto} by agents on Auto.`, refs };
      }
      if (/late|risk|order|تأخير|طلب/.test(s)) {
        refs.push(...base.lateList.map(id => 'order:' + id));
        return { text: base.late ? `${base.late} order${base.late > 1 ? 's are' : ' is'} forecast short in the next two hours: ${base.lateList.join(', ')} (${num(base.lateUnits)} TVs, EGP ${(base.revDelayed / 1e6).toFixed(1)}M delayed). Open Decisions for the options the Scheduling agent simulated.` : `No order is forecast late in the next two hours. ${num(base.packed)} TVs will be packed; finished goods cover every truck due.`, refs };
      }
      if (lid && P.lines[lid]) {
        const L = P.lines[lid]; const bott = L.stations.slice().sort((a, b) => (b.counters.down + b.counters.starved + b.counters.blocked) - (a.counters.down + a.counters.starved + a.counters.blocked))[0];
        const low = Object.values(L.ls).filter(b => level(b) <= b.rop).map(b => b.code);
        refs.push('line:' + lid, 'st:' + bott.id);
        return { text: `${L.name} builds ${MODELS[L.model].name} at ${num(L.tph)} an hour, OEE ${(L.oee * 100).toFixed(0)}% (availability ${(L.avail * 100).toFixed(0)}%, performance ${(L.perf * 100).toFixed(0)}%, quality ${(L.qual * 100).toFixed(1)}%). It is ${{ run: 'running', down: 'stopped', starved: 'starved', blocked: 'blocked' }[L.state] || L.state}. The station losing most time is ${bott.name}. ${low.length ? `Line-side stock at or below reorder point: ${low.join(', ')}.` : 'Line-side stock is above every reorder point.'} Forecast: ${num(base.byLine[lid] || 0)} TVs in the next two hours.`, refs };
      }
      if (/oee|loss|خسائر|الفعالية/.test(s)) {
        const ls = Object.values(P.lines).filter(L => L.kind === 'main').map(L => `${L.name} ${(L.oee * 100).toFixed(0)}%`).join(', ');
        return { text: `Main-line OEE ${(k.oee * 100).toFixed(1)}%: ${ls}. Open GMES · lines and select a line for its loss tree.`, refs };
      }
      if (/pba|stock|material|shortage|مخزون|خامات/.test(s)) {
        const rows = Object.values(E.LS).filter(b => b.rate > 1e-4).map(b => ({ b, rw: level(b) / b.rate })).sort((a, b) => a.rw - b.rw).slice(0, 4);
        refs.push(...rows.map(x => 'buf:' + x.b.id));
        return { text: `Shortest runways: ${rows.map(x => `${x.b.code} at ${P.byId[x.b.station].name} (${P.lines[x.b.line].name}) ${Math.round(x.rw / 60)} min`).join('; ')}. Every one has a milk-run lap or AGV planned unless the Material agent says otherwise.`, refs };
      }
      if (/safety|vision|camera|near miss|ppe|سلامة|كاميرا/.test(s)) {
        const last = A.incidents.filter(i => P.t - i.t < 3600);
        return { text: last.length ? `${last.length} safety event${last.length > 1 ? 's' : ''} from the cameras in the last hour: ${last.slice(0, 4).map(i => `${i.time} ${i.cam}, ${i.text}`).join('; ')}. Each has a still in the AI agents tab.` : 'No safety event from the cameras in the last hour. Turn on Cameras in the 3D factory to watch the AI vision live.', refs };
      }
      if (/energy|power|kw|peak|طاقة|كهرباء/.test(s)) return { text: `Plant demand ${num(k.kw)} kW; 15-minute average ${num(A.energy.avg)} kW, forecast peak ${num(A.energy.peak)} kW against the 4,000 kW contract. ${P.shave && P.t < P.shave.until ? 'Peak shaving is on.' : ''}`, refs: ['util:UTIL-CH1'] };
      return { text: 'Ask about the shift summary, a line (for example “why is line 3 slow”), orders at risk, OEE, material shortages, energy or safety. Answers come from the live plant data and the two-hour forecast, with links.', refs };
    }
    A.ask = ask;

    let lastMin = -1;
    E.on(t => {
      if (t !== 'second') return;
      const mn = Math.floor(P.t / 60);
      if (mn === lastMin) return; lastMin = mn;
      if (mn % 2 === 0) detect();
      refresh();
    });
    detect(); refresh();
    A.setAutonomy = (id, v) => { const a = agent(id); if (a) { a.autonomy = v; E.audit('You', 'Agent autonomy', `${a.name}: ${v === 'auto' ? 'Auto' : v === 'approve' ? 'Approve' : 'Advise'}`); say(id, `Autonomy set to ${v === 'auto' ? 'Auto: I act on reversible decisions and report' : v === 'approve' ? 'Approve: a person decides; low-risk reversible steps go ahead after two minutes unless vetoed' : 'Advise: I only inform'}.`); } };
    A.OWNER = OWNER;
    return A;
  }

  const PlantAgents = { create, AGENTS };
  if (typeof module !== 'undefined' && module.exports) module.exports = PlantAgents;
  else root.PlantAgents = PlantAgents;
})(typeof window !== 'undefined' ? window : globalThis);
