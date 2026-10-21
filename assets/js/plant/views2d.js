/* Digital Factory — Live plant, the 2D views: GMES boards for every line, SAP and the data flow, S&OP, MRP, the
   departments and the decisions inbox. Each view reads the engine (floor) and the enterprise layer (offices) and is
   redrawn about once a second; packets on the data-flow diagram move every frame. Shared helpers for the page live
   here too. All data is simulated. */
(function () {
  'use strict';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const icon = n => (typeof Icons !== 'undefined' ? Icons.get(n) : '');
  const fmt = n => Math.round(n).toLocaleString('en-US');
  const pct = (v, d = 1) => (v * 100).toFixed(d) + '%';
  const STATE = { run: 'Running', warn: 'Running slow', idle: 'Idle', starved: 'Starved', blocked: 'Blocked', down: 'Stopped', maint: 'Planned maintenance', micro: 'Short stop', changeover: 'Changeover', tripped: 'Tripped' };
  const SCLS = st => (st === 'down' || st === 'tripped' ? 'bad' : st === 'maint' ? 'maint' : st === 'warn' || st === 'starved' || st === 'micro' || st === 'changeover' ? 'warn' : '');
  const chip = (st, why) => `<span class="st ${SCLS(st)}"><i></i>${esc(STATE[st] || st)}${why ? ` · ${esc(why)}` : ''}</span>`;
  const link = (ref, text) => `<button type="button" class="lnk" data-ref="${esc(ref)}">${esc(text)}</button>`;
  const bar = (k, cls = '') => `<span class="bar ${cls}"><i style="width:${Math.max(0, Math.min(100, k * 100)).toFixed(1)}%"></i></span>`;
  // focus targets used by recommendations ('focus:<arg>') → a selectable reference
  function refFromFocus(a) {
    if (!a) return null;
    if (/^(IMP|LOC|INJ|PRS|PBA|SVC|SILO|HALL|LS|WIP):/.test(a)) return 'buf:' + a;
    if (a.startsWith('AGV')) return 'agv:' + a;
    if (a.startsWith('UTIL')) return 'util:' + a;
    if (a.startsWith('mrp:') || a === 'sop' || a.startsWith('order:') || a.startsWith('svc:')) return a;
    return 'st:' + a;
  }
  function recCards(list, X) {
    if (!list.length) return '';
    return list.map(r => {
      const dept = X ? X.DEPTS.find(d => d.id === (r.dept || X.deptOf(r.agent))) : null;
      return `<article class="rec ${r.level}"><p class="rec-who">${esc(dept ? dept.name : r.agent + ' agent')} · ${r.time}</p><h4>${esc(r.title)}</h4><p>${esc(r.body)}</p>
      <div class="rec-act">${(r.actions || []).map((a, i) => `<button type="button" class="btn btn-sm ${i === 0 && !a.id.startsWith('focus') ? 'btn-primary' : 'btn-secondary'}" data-key="${esc(a.id)}" ${a.id.startsWith('focus') ? `data-ref="${esc(refFromFocus(a.id.slice(6)))}"` : `data-act="${esc(a.id)}"`}>${esc(a.label)}</button>`).join('')}
      <button type="button" class="btn btn-sm btn-ghost" data-dismiss="${esc(r.key)}" data-key="x-${esc(r.key)}">Dismiss</button></div></article>`;
    }).join('');
  }
  const H = { esc, icon, fmt, pct, STATE, SCLS, chip, link, bar, refFromFocus, recCards };

  /* small SVG charts */
  function lineChart(series, o = {}) {
    // series: [{ v: [...], cls, dash, bars }]; x labels in o.labels
    const w = o.w || 640, h = o.h || 220, pl = 46, pr = 12, pt = 12, pb = 26;
    const all = series.flatMap(s => s.v);
    const hi = Math.max(1, ...all) * 1.08, n = series[0].v.length;
    const X = i => pl + (i + 0.5) * (w - pl - pr) / n, Y = v => pt + (h - pt - pb) * (1 - v / hi);
    const bw = (w - pl - pr) / n * 0.56;
    let g = '';
    for (let k = 0; k <= 4; k++) { const v = hi * k / 4, y = Y(v); g += `<line x1="${pl}" x2="${w - pr}" y1="${y}" y2="${y}" class="gl"/><text x="${pl - 6}" y="${y + 4}" class="ax" text-anchor="end">${v >= 1000 ? Math.round(v / 1000) + 'k' : Math.round(v)}</text>`; }
    (o.labels || []).forEach((l, i) => { g += `<text x="${X(i)}" y="${h - 8}" class="ax" text-anchor="middle">${esc(l)}</text>`; });
    for (const s of series) {
      if (s.bars) g += s.v.map((v, i) => `<rect x="${X(i) - bw / 2}" y="${Y(v)}" width="${bw}" height="${Math.max(0, Y(0) - Y(v))}" rx="2" class="${s.cls}"><title>${esc(s.name)} ${esc(o.labels ? o.labels[i] : '')}: ${fmt(v)}</title></rect>`).join('');
      else g += `<path d="${s.v.map((v, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)} ${Y(v).toFixed(1)}`).join('')}" class="${s.cls}${s.dash ? ' dash' : ''}"/>` + s.v.map((v, i) => `<circle cx="${X(i)}" cy="${Y(v)}" r="2.6" class="${s.cls}"><title>${esc(s.name)} ${esc(o.labels ? o.labels[i] : '')}: ${fmt(v)}</title></circle>`).join('');
    }
    return `<svg class="chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(o.label || 'Chart')}">${g}</svg>`;
  }

  function createViews(root, E, X, ui) {
    const P = E.P, { mins, clock } = E;
    const MODELS = E.MODELS;
    const line = id => P.lines[id];
    const state = { mode: null, sopModel: 'all', sopScen: X.sop.approved || 'chase', mrpCode: 'OC-65', sapSel: null };
    const level = E.level;
    const kind = k => Object.values(P.lines).filter(L => L.kind === k);
    const lsCls = b => { const lv = level(b); return lv <= 0 ? 'bad' : lv <= b.rop * 0.5 ? 'warn' : ''; };

    /* ---------------- GMES: every line on one board ---------------- */
    function cell(s) { return `<button type="button" class="cell ${SCLS(s.state)} ${s.state === 'idle' || s.state === 'blocked' ? 'off' : ''}" data-ref="st:${esc(s.id)}" title="${esc(s.name)} · ${esc(STATE[s.state] || s.state)}${s.why ? ' · ' + esc(s.why) : ''}"><span>${esc(s.name)}</span></button>`; }
    function feeder(L, label) {
      if (!L) return '';
      return `<button type="button" class="fd ${SCLS(L.state)}" data-ref="line:${L.id}"><span>${esc(label)}</span><b>${fmt(L.tph)}/h</b><small>${esc(STATE[L.state] || L.state)}</small></button>`;
    }
    function gmes() {
      const mains = kind('main');
      const k = P.kpi;
      const rows = mains.map((L, i) => {
        const n = i + 1, o = X.pp.find(p => p.line === L.id && p.status !== 'TECO');
        const done = o ? X.ppProgress(o) : 0;
        const ls = Object.entries(L.ls).map(([key, b]) => `<button type="button" class="lsb ${lsCls(b)}" data-ref="buf:${b.id}" title="${esc(b.label)} · ${fmt(level(b))} of ${fmt(b.cap)}"><span>${key}</span>${bar(level(b) / b.cap, lsCls(b))}</button>`).join('');
        return `<article class="gl-row">
          <header><button type="button" class="lnk ttl" data-ref="line:${L.id}">${esc(L.name)}</button><span class="mdl">${esc(MODELS[L.model].name)}</span>${chip(L.state)}</header>
          <div class="gl-nums"><div><b>${fmt(L.tph)}</b><small>TVs an hour</small></div><div><b>${pct(L.oee, 0)}</b><small>OEE</small></div><div><b>${fmt(done)}</b><small>of ${fmt(o ? o.qty : 0)} · order ${esc(o ? o.id : '—')}</small></div></div>
          <div class="chain">${L.stations.map(cell).join('<i class="ar" aria-hidden="true"></i>')}</div>
          <div class="gl-feed">${feeder(line('LCM' + n), `LCM line ${n}`)}${feeder(line('SMD' + n), `SMD ${n} · PBA ${line('SMD' + n).model.slice(1)}`)}${feeder(line('CUS' + n), `Cushion ${n}`)}<div class="lss">${ls}</div></div>
        </article>`;
      }).join('');
      const inj = P.lines.INJ.stations.map(s => `<button type="button" class="tile ${SCLS(s.state)}" data-ref="st:${s.id}"><b>${esc(s.id)}</b><span>${esc(s.part)}${s.spare ? ' · spare' : ''}</span><small>${esc(STATE[s.state] || s.state)}</small></button>`).join('');
      const press = kind('press').map(L => {
        const k2 = L.id.slice(2), st = L.stations;
        return `<tr><td>${link('line:' + L.id, L.name)}<small>Chassis ${L.size}"</small></td>${st.map(s => `<td>${link('st:' + s.id, s.name)}<small class="${SCLS(s.state)}">${esc(STATE[s.state] || s.state)}${s.kind === 'oven' ? ` · ${(s.sens.temp || 0).toFixed(0)} °C` : ''}</small></td>`).join('')}<td>${fmt(level(P.bufs[`WIP:PR${k2}:stamped`]))} · ${fmt(level(P.bufs[`WIP:PR${k2}:coated`]))}<small>stamped · coated</small></td></tr>`;
      }).join('');
      const store = (st, title) => `<div class="stc"><h4>${esc(title)}</h4>${Object.values(E.STORE[st]).map(b => { const k3 = level(b) / b.cap; return `<button type="button" class="srow" data-ref="buf:${b.id}"><span>${esc(b.code)}</span>${bar(k3, k3 < 0.12 ? 'bad' : k3 < 0.25 ? 'warn' : '')}<b>${fmt(level(b))}</b></button>`; }).join('')}</div>`;
      const veh = [...P.tuggers.map(t => [`tug:${t.id}`, t.id, t.routeName, t.plan ? `lap ${t.laps + 1} · ${t.plan.loads.length} drops` : 'waiting for its timetable']), ...P.agvs.map(a => [`agv:${a.id}`, a.id, 'PBA boards', a.fault ? 'fault' : a.mission ? `${a.mission.qty} × ${a.mission.buf.code} to ${P.byId[a.mission.buf.station].name} (${line(a.mission.buf.line).name})` : 'parked']), ...P.forklifts.map(f => [`fl:${f.id}`, f.id, f.role === 'fg' ? 'Finished goods' : 'Silos and halls', f.job ? (f.job.kind === 'store' ? 'storing a pallet' : 'loading ' + f.job.truck.id) : f.mission ? 'refilling ' + f.mission.buf.label.toLowerCase() : 'waiting'])];
      const docks = P.docks.map(d => `<li><b>${esc(d.id)}</b><span>${d.truck ? `${link('truck:' + d.truck.id, d.truck.id)} · ${fmt(d.truck.loaded)}/${fmt(d.truck.need)} × ${esc(MODELS[d.truck.model].name)} · order ${esc(d.truck.order.id)}` : 'free'}</span></li>`).join('');
      return `<header class="vh"><div><h2>GMES · shop floor</h2><p>${mains.filter(L => L.state === 'run' || L.state === 'warn').length} of 6 main lines running · ${fmt(k.units)} TVs packed against a plan of ${fmt(k.plan)} · OEE ${pct(k.oee || 0, 0)} · ${P.alarms.length} alarms</p></div></header>
        <section class="vs2"><h3>Main assembly lines and the sub-lines that feed them</h3><div class="gl-list">${rows}</div></section>
        <section class="vs2 two"><div><h3>Injection moulding · 20 machines</h3><div class="tiles">${inj}</div></div>
          <div><h3>Press, coating and sub-assembly</h3><table class="tbl"><thead><tr><th>Line</th><th>Press</th><th>Coating oven</th><th>Sub-assembly</th><th>WIP</th></tr></thead><tbody>${press}</tbody></table></div></section>
        <section class="vs2"><h3>Stores and supermarkets</h3><div class="stores">${store('IMP', 'Import warehouse')}${store('LOC', 'Local-vendor supermarket')}${store('INJ', 'Injection supermarket')}${store('PRS', 'Chassis supermarket')}${store('PBA', 'PBA supermarket (boards)')}${store('SVC', 'Service-parts store')}</div></section>
        <section class="vs2 two"><div><h3>Milk runs, AGVs and forklifts</h3><ul class="li">${veh.map(([r, id, what, now]) => `<li>${link(r, id)}<span>${esc(what)} · ${esc(now)}</span></li>`).join('')}</ul></div><div><h3>Shipping docks</h3><ul class="li">${docks}</ul></div></section>`;
    }

    /* ---------------- SAP and the data flow ---------------- */
    const NODES = (() => {
      const N = {};
      const col = (ids, x, y0, gap, w, h, grp) => ids.forEach(([id, t, s], i) => { N[id] = { id, t, s, x, y: y0 + i * gap, w, h, grp }; });
      col([['d:sales', 'Sales'], ['d:planning', 'Planning'], ['d:scm', 'SCM'], ['d:finance', 'Finance'], ['d:quality', 'Quality'], ['d:pe', 'PE'], ['d:bom', 'BOM team'], ['d:svc', 'SVC'], ['d:hr', 'HR']], 16, 22, 62, 128, 44, 'dept');
      col([['SAP-SD', 'SAP SD', 'Sales, delivery'], ['SOP', 'S&OP', 'Demand, supply'], ['SAP-PP', 'SAP PP', 'Orders, MRP'], ['SAP-MM', 'SAP MM', 'Purchasing, stock'], ['SAP-QM', 'SAP QM', 'Inspection'], ['SAP-FICO', 'SAP FI/CO', 'Finance'], ['SAP-PM', 'SAP PM', 'Maintenance']], 270, 40, 76, 150, 52, 'sap');
      col([['GMES', 'GMES', 'Every line'], ['WMS', 'WMS', 'Stores, AGVs'], ['PLM', 'PLM', 'BOM, firmware'], ['HR', 'HR system', 'Attendance']], 540, 70, 128, 140, 56, 'int');
      col([['f:main', 'Main lines 1–6'], ['f:lcm', 'LCM lines'], ['f:smd', 'SMD and PBA'], ['f:inj', 'Injection'], ['f:press', 'Press and coating'], ['f:cus', 'Cushions'], ['f:stores', 'Stores and milk runs'], ['f:docks', 'Docks and trucks']], 800, 22, 70, 170, 46, 'floor');
      return N;
    })();
    const EDGES = [['d:sales', 'SAP-SD'], ['d:svc', 'SAP-SD'], ['d:planning', 'SOP'], ['d:planning', 'SAP-PP'], ['d:scm', 'SAP-MM'], ['d:finance', 'SAP-FICO'], ['d:quality', 'SAP-QM'], ['d:pe', 'SAP-PM'], ['d:pe', 'PLM'], ['d:bom', 'PLM'], ['d:hr', 'HR'],
      ['SOP', 'SAP-PP'], ['SAP-SD', 'SAP-PP'], ['SAP-PP', 'SAP-MM'], ['SAP-MM', 'SAP-QM'], ['SAP-SD', 'SAP-FICO'], ['SAP-MM', 'SAP-FICO'],
      ['SAP-PP', 'GMES'], ['SAP-QM', 'GMES'], ['SAP-PM', 'GMES'], ['SAP-MM', 'WMS'], ['SAP-SD', 'WMS'], ['PLM', 'GMES'], ['HR', 'SAP-FICO'],
      ['GMES', 'f:main'], ['GMES', 'f:lcm'], ['GMES', 'f:smd'], ['GMES', 'f:inj'], ['GMES', 'f:press'], ['GMES', 'f:cus'], ['WMS', 'f:stores'], ['WMS', 'f:docks'], ['GMES', 'WMS']];
    const DEPT_OF_SYS = { 'SAP-SD': 'd:sales', SOP: 'd:planning', 'SAP-PP': 'd:planning', 'SAP-MM': 'd:scm', 'SAP-QM': 'd:quality', 'SAP-FICO': 'd:finance', 'SAP-PM': 'd:pe', PLM: 'd:pe', HR: 'd:hr' };
    function floorOf(m) {
      const r = m.ref || '', ln = m.line || (P.byId[r] ? P.byId[r].line : '');
      if (r.startsWith('order:') || r.startsWith('svc:')) return 'f:docks';
      if (/^(IMP|LOC|INJ|PRS|PBA|SVC|SILO|HALL|LS):/.test(r)) return 'f:stores';
      if (ln.startsWith('ML')) return 'f:main'; if (ln.startsWith('LCM')) return 'f:lcm'; if (ln.startsWith('SMD')) return 'f:smd';
      if (ln === 'INJ' || /^IM\d/.test(r)) return 'f:inj'; if (ln.startsWith('PR')) return 'f:press'; if (ln.startsWith('CUS')) return 'f:cus';
      return null;
    }
    const center = id => { const n = NODES[id]; return [n.x + n.w / 2, n.y + n.h / 2]; };
    const pk = [];   // packets on the diagram
    E.on((t, m) => {
      if (t !== 'msg' || state.mode !== 'sap' || pk.length > 70) return;
      const path = [];
      const f = NODES[m.from] ? m.from : null, to = NODES[m.to] ? m.to : null; if (!f || !to) return;
      const fl = floorOf(m);
      if (fl && (m.from === 'GMES' || m.from === 'WMS')) path.push(fl);
      else if (DEPT_OF_SYS[m.from] && !fl && Math.random() < 0.5) path.push(DEPT_OF_SYS[m.from]);
      path.push(f, to);
      if (fl && (m.to === 'GMES' || m.to === 'WMS') && path[0] !== fl) path.push(fl);
      pk.push({ path: path.map(center), t: 0, dur: 0.9 * (path.length - 1), m });
    });
    function sapDiagram() {
      const rect = n => `<g class="nd ${n.grp}" data-node="${n.id}"><rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="10"/><text x="${n.x + 12}" y="${n.y + (n.s ? 22 : n.h / 2 + 5)}" class="nt">${esc(n.t)}</text>${n.s ? `<text x="${n.x + 12}" y="${n.y + 40}" class="ns">${esc(n.s)}</text>` : ''}<text x="${n.x + n.w - 10}" y="${n.y + (n.s ? 22 : n.h / 2 + 5)}" class="nc" text-anchor="end" data-count="${n.id}"></text></g>`;
      const edge = ([a, b]) => { const A = center(a), B = center(b); const mx = (A[0] + B[0]) / 2; return `<path class="ed" d="M${A[0]} ${A[1]} C${mx} ${A[1]} ${mx} ${B[1]} ${B[0]} ${B[1]}"/>`; };
      const heads = [['Offices', 16], ['SAP', 270], ['Integration', 540], ['Shop floor', 800]].map(([t, x]) => `<text x="${x}" y="12" class="hd">${t}</text>`).join('');
      return `<svg class="flow" viewBox="0 0 990 600" role="img" aria-label="Data flow between the offices, SAP, GMES and the shop floor">${heads}${EDGES.map(edge).join('')}${Object.values(NODES).map(rect).join('')}<g id="pk"></g></svg>`;
    }
    function sap() {
      const so = P.orders.filter(o => o.state === 'open' || o.state === 'loading').slice(0, 8);
      const po = X.po.filter(p => p.status !== 'Closed').sort((a, b) => a.eta - b.eta).slice(0, 8);
      const pp = X.pp.filter(p => p.status !== 'TECO' && line(p.line) && line(p.line).kind === 'main');
      const log = X.msgs.slice(0, 16).map(m => `<tr><td>${esc(m.time)}</td><td><b>${esc(m.from)}</b> → ${esc(m.to)}</td><td>${esc(m.type)}${m.mvt ? ` <span class="mvt">${esc(m.mvt)}</span>` : ''}</td><td>${m.ref ? link(m.ref.includes(':') ? (m.ref.startsWith('order:') || m.ref.startsWith('mrp:') || m.ref.startsWith('svc:') ? m.ref : 'buf:' + m.ref) : 'st:' + m.ref, m.text) : esc(m.text)}</td></tr>`).join('');
      return `<header class="vh"><div><h2>SAP and the data flow</h2><p>Every confirmation, goods movement, order and release travels through GMES to SAP and back. ${Math.round(X.stats.perMin)} messages a simulated minute.</p></div></header>
        <section class="vs2 flowwrap">${state.sapSvg || ''}</section>
        <section class="vs2"><h3>Live message log <span>newest first</span></h3><table class="tbl log"><thead><tr><th>Time</th><th>From → to</th><th>Message</th><th>Content</th></tr></thead><tbody>${log}</tbody></table>
          <p class="mvts"><b>Movement types:</b> <span class="mvt">101</span> goods receipt from production or a PO · <span class="mvt">261</span> issue to production (backflush) · <span class="mvt">311</span> transfer to line side · <span class="mvt">321</span> quality release · <span class="mvt">344</span> block · <span class="mvt">343</span> release from block · <span class="mvt">601</span> goods issue for delivery</p></section>
        <section class="vs2 three">
          <div><h3>Sales orders (SD)</h3><table class="tbl"><thead><tr><th>Order</th><th>Qty</th><th>Due</th><th>ATP</th></tr></thead><tbody>${so.map(o => `<tr><td>${link('order:' + o.id, o.id)}<small>${esc(o.customer)}</small></td><td>${fmt(o.qty)}<small>${esc(MODELS[o.model].name)}</small></td><td>${clock(o.due)}</td><td class="${o.atp && !o.atp.ok ? 'warn' : ''}">${o.state === 'loading' ? 'Loading' : o.atp && o.atp.ok ? 'Confirmed' : 'Short'}</td></tr>`).join('')}</tbody></table></div>
          <div><h3>Purchase orders (MM)</h3><table class="tbl"><thead><tr><th>PO</th><th>Material</th><th>ETA</th><th>Status</th></tr></thead><tbody>${po.map(p => `<tr><td>${link('po:' + p.id, p.id)}<small>${esc(p.vendor)}</small></td><td>${fmt(p.qty)}<small>${esc(p.code)}</small></td><td>${p.eta - P.t > 86400 ? `in ${Math.round((p.eta - P.t) / 86400)} d` : clock(p.eta)}</td><td class="${p.status === 'Held at port' ? 'bad' : ''}">${esc(p.status)}</td></tr>`).join('')}</tbody></table></div>
          <div><h3>Production orders (PP)</h3><table class="tbl"><thead><tr><th>Order</th><th>Line</th><th>Done</th></tr></thead><tbody>${pp.map(o => `<tr><td>${esc(o.id)}<small>${esc(MODELS[o.item] ? MODELS[o.item].name : o.item)}</small></td><td>${link('line:' + o.line, line(o.line).name)}</td><td>${fmt(X.ppProgress(o))}<small>of ${fmt(o.qty)}</small></td></tr>`).join('')}</tbody></table></div>
        </section>`;
    }
    function tickSap(dt) {
      const g = root.querySelector('#pk'); if (!g) { pk.length = 0; return; }
      let html = '';
      for (let i = pk.length - 1; i >= 0; i--) {
        const p = pk[i]; p.t += dt / p.dur; if (p.t >= 1) { pk.splice(i, 1); continue; }
        const n = p.path.length - 1, h = Math.min(n - 1, Math.floor(p.t * n)), k = p.t * n - h;
        const a = p.path[h], b = p.path[h + 1], mx = (a[0] + b[0]) / 2;
        // follow the same cubic as the edge
        const u = 1 - k, x = u * u * u * a[0] + 3 * u * u * k * mx + 3 * u * k * k * mx + k * k * k * b[0], y = u * u * u * a[1] + 3 * u * u * k * a[1] + 3 * u * k * k * b[1] + k * k * k * b[1];
        html += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4.5" class="pkt"/>`;
      }
      g.innerHTML = html;
    }
    function sapCounts() {
      const c = {};
      for (const m of X.msgs.slice(0, 120)) { c[m.from] = (c[m.from] || 0) + 1; c[m.to] = (c[m.to] || 0) + 1; const f = floorOf(m); if (f) c[f] = (c[f] || 0) + 1; }
      root.querySelectorAll('[data-count]').forEach(t => { const v = c[t.dataset.count]; t.textContent = v ? fmt(v) : ''; });
    }

    /* ---------------- S&OP ---------------- */
    function sop() {
      const S = X.sop, r = S.results[state.sopScen];
      const ms = state.sopModel === 'all' ? Object.keys(MODELS) : [state.sopModel];
      const sum = key => S.weeks.map((_, i) => ms.reduce((a, m) => a + r.models[m][key][i], 0));
      const chart = lineChart([{ name: 'Production', v: sum('prod'), cls: 'c-prod', bars: true }, { name: 'Demand', v: sum('demand'), cls: 'c-dem' }, { name: 'Capacity, no overtime', v: sum('cap'), cls: 'c-cap', dash: true }], { labels: S.weeks, label: 'Demand, production and capacity by week' });
      const invChart = lineChart([{ name: 'Finished-goods stock', v: sum('inv'), cls: 'c-inv' }, { name: 'Lost sales', v: sum('short'), cls: 'c-short', bars: true }], { labels: S.weeks, h: 150, label: 'Stock and lost sales by week' });
      const steps = S.steps.map((t, i) => `<li class="${i < S.step ? 'done' : i === S.step ? 'now' : ''}"><b>${i + 1}</b><span>${esc(t)}</span></li>`).join('');
      const card = sc => {
        const t = S.results[sc.id].tot, on = state.sopScen === sc.id, appr = S.approved === sc.id;
        return `<article class="scn ${on ? 'on' : ''}"><button type="button" class="scn-pick" data-scen="${sc.id}" aria-pressed="${on}"><h4>${esc(sc.name)}${appr ? ' <span class="tag">Approved plan</span>' : ''}</h4><p>${esc(sc.what)}</p></button>
          <dl class="kv"><div><dt>Service level</dt><dd class="${t.service < 0.95 ? 'warn' : ''}">${pct(t.service)}</dd></div><div><dt>Lost TVs</dt><dd>${fmt(t.lost)}</dd></div><div><dt>Overtime</dt><dd>${fmt(t.otH)} line-hours</dd></div><div><dt>Margin, 12 weeks</dt><dd>${X.egp(t.margin)}</dd></div><div><dt>Stock</dt><dd>${t.invDays.toFixed(1)} days of sales</dd></div></dl>
          ${S.step >= 3 && S.approved !== sc.id ? `<button type="button" class="btn btn-primary btn-sm" data-act="erp:sop:${sc.id}">Approve ${esc(sc.name)}</button>` : ''}</article>`;
      };
      const tbl = `<table class="tbl wk"><thead><tr><th></th>${S.weeks.map(w => `<th>${w}</th>`).join('')}</tr></thead><tbody>${[['Demand', 'demand'], ['Production', 'prod'], ['Stock at week end', 'inv'], ['Lost sales', 'short']].map(([t, k]) => `<tr><td>${t}</td>${sum(k).map(v => `<td class="${k === 'short' && v > 0 ? 'bad' : ''}">${fmt(v)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
      return `<header class="vh"><div><h2>S&amp;OP · sales and operations plan</h2><p>Twelve weeks of demand by model against six main lines. Sales brings the forecast, Planning and SCM the supply, Finance the money, and the plant leader approves one plan. The approved plan becomes the master schedule in SAP PP and drives MRP.</p></div></header>
        <section class="vs2"><ol class="steps">${steps}</ol>${S.step < 3 ? `<button type="button" class="btn btn-secondary btn-sm" data-act="erp:step">Complete step ${S.step + 1}</button>` : S.step === 3 ? '<p class="quiet">Executive meeting: approve one of the three plans below.</p>' : `<p class="quiet">Approved at ${clock(S.approvedAt)}: <b>${esc(S.scenarios.find(s => s.id === S.approved).name)}</b>. Master schedule released to SAP PP; MRP ran.</p>`}</section>
        <section class="vs2"><div class="scns">${S.scenarios.map(card).join('')}</div></section>
        <section class="vs2"><div class="segrow"><h3>${esc(S.scenarios.find(s => s.id === state.sopScen).name)} plan</h3><div class="seg" role="group" aria-label="Model">${[['all', 'All models'], ...Object.values(MODELS).map(m => [m.id, m.name])].map(([id, t]) => `<button type="button" data-sopm="${id}" aria-pressed="${state.sopModel === id}">${esc(t)}</button>`).join('')}</div></div>
          <p class="legend2"><span><i class="c-prod"></i>Production</span><span><i class="c-dem"></i>Demand</span><span><i class="c-cap"></i>Capacity without overtime</span></p>${chart}
          <p class="legend2"><span><i class="c-inv"></i>Finished-goods stock</span><span><i class="c-short"></i>Lost sales</span></p>${invChart}${tbl}</section>`;
    }

    /* ---------------- MRP ---------------- */
    function mrp() {
      const R = X.mrp, rows = Object.values(R.rows);
      const sel = R.rows[state.mrpCode] || rows[0];
      const exc = R.exc;
      const excFor = c => exc.filter(e => e.code === c);
      const list = ['import', 'local'].map(src => `<div class="ml"><h4>${src === 'import' ? 'Imported' : 'Local vendors'}</h4>${rows.filter(r => r.src === src).map(r => { const e = excFor(r.code); const lv = e.some(x => x.level === 'crit') ? 'bad' : e.length ? 'info' : ''; return `<button type="button" class="mi ${r.code === sel.code ? 'on' : ''}" data-mrp="${esc(r.code)}" aria-pressed="${r.code === sel.code}"><span>${esc(r.code)}</span>${e.length ? `<i class="${lv}">${e.length}</i>` : ''}</button>`; }).join('')}</div>`).join('');
      const W = R.weeks;
      const rowsT = [['Gross requirements', sel.gross], ['Scheduled receipts (open POs)', sel.sched], ['Planned order receipts', sel.planned], ['Projected available', sel.proj], ['Planned order releases', sel.release]];
      const table = `<table class="tbl wk md"><thead><tr><th>${esc(sel.unit === 'kg' ? 'kg' : 'pieces')}</th><th>Now</th>${W.map(w => `<th>${w}</th>`).join('')}</tr></thead><tbody>${rowsT.map(([t, v], i) => `<tr><td>${t}</td><td>${i === 3 ? fmt(sel.onHand) : ''}</td>${v.map(x => `<td class="${i === 3 ? (x < 0 ? 'bad' : x < sel.ss ? 'warn' : '') : ''}">${x ? fmt(x) : '·'}</td>`).join('')}</tr>`).join('')}<tr class="ss"><td>Safety stock</td><td></td>${W.map(() => `<td>${fmt(sel.ss)}</td>`).join('')}</tr></tbody></table>`;
      const chart = lineChart([{ name: 'Gross requirements', v: sel.gross, cls: 'c-dem', bars: true }, { name: 'Projected available', v: sel.proj.map(v => Math.max(0, v)), cls: 'c-prod' }, { name: 'Safety stock', v: W.map(() => sel.ss), cls: 'c-cap', dash: true }], { labels: W, h: 170, label: 'Requirements and projected stock' });
      const mps = `<table class="tbl wk"><thead><tr><th>Model</th>${W.map(w => `<th>${w}</th>`).join('')}</tr></thead><tbody>${Object.values(MODELS).map(m => `<tr><td>${esc(m.name)}</td>${X.mps[m.id].map(v => `<td>${fmt(v)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
      const excList = exc.length ? `<ul class="li exc">${exc.map(e => `<li class="${e.level}"><span><b>${esc(e.kind)}</b> · ${esc(e.text)}</span><div>${e.act ? `<button type="button" class="btn btn-sm ${e.level === 'crit' ? 'btn-primary' : 'btn-secondary'}" data-act="${esc(e.act.id)}">${esc(e.act.label)}</button>` : ''}<button type="button" class="btn btn-sm btn-ghost" data-mrp="${esc(e.code)}">Open</button></div></li>`).join('')}</ul>` : '<p class="quiet">No exception messages.</p>';
      return `<header class="vh"><div><h2>MRP · material requirements</h2><p>The master schedule from the approved S&amp;OP plan, exploded through every bill of materials (TV → panel module → open cell and backlight; main board → bare PCB; back cover → resin; chassis → steel coil, paint and brackets; cushion → EPS), netted against stock and open purchase orders and offset by each vendor's lead time. Last run ${clock(R.t)}.</p></div><button type="button" class="btn btn-secondary btn-sm" data-act="erp:mrp">${icon('refresh')}Run MRP now</button></header>
        <section class="vs2"><h3>Master production schedule <span>TVs a week, from S&amp;OP (${esc(X.sop.scenarios.find(s => s.id === X.sop.approved).name)})</span></h3>${mps}</section>
        <section class="vs2 mrpgrid"><nav class="mlist" aria-label="Materials">${list}</nav>
          <div><div class="mh"><h3>${esc(sel.code)} · ${esc(sel.name)}</h3>${sel.held ? `<span class="st bad"><i></i>${esc(sel.held.reason)}</span>` : ''}</div>
          <dl class="kv kv4"><div><dt>Vendor</dt><dd>${esc(sel.vendor)}</dd></div><div><dt>Lead time</dt><dd>${sel.lt} days</dd></div><div><dt>Lot size</dt><dd>${fmt(sel.lot)} ${esc(sel.unit)}</dd></div><div><dt>On hand</dt><dd>${fmt(sel.plant)} in the plant · ${fmt(sel.wh)} in the warehouses</dd></div><div><dt>Used by</dt><dd>${sel.pegs.map(m => esc(MODELS[m].name)).join(', ')}</dd></div><div><dt>Plant stock</dt><dd>${link('buf:' + (E.MAT[sel.code].store) + ':' + sel.code, 'Show in the plant')}</dd></div></dl>
          ${table}${chart}${excFor(sel.code).map(e => e.act ? `<button type="button" class="btn btn-primary btn-sm" data-act="${esc(e.act.id)}">${esc(e.act.label)}</button>` : '').join(' ')}</div></section>
        <section class="vs2"><h3>Exception messages <span>${exc.length}</span></h3>${excList}</section>`;
    }

    /* ---------------- departments ---------------- */
    function depts() {
      const k = P.kpi, f = X.finance();
      const open = P.orders.filter(o => o.state === 'open' || o.state === 'loading');
      const chainA = [['d:sales', 'Sales', `${open.length} open orders`], ['sop', 'S&OP and MPS', X.sop.scenarios.find(s => s.id === X.sop.approved).name + ' plan'], ['mode:mrp', 'MRP', `${X.mrp.exc.length} exceptions`], ['d:scm', 'Purchasing', `${X.po.filter(p => p.status === 'In transit').length} deliveries on the way`], ['zone:imp', 'Stores', `lowest cover ${pct(Math.min(...Object.values(E.STORE.IMP).concat(Object.values(E.STORE.LOC)).map(b2 => level(b2) / b2.cap)), 0)}`], ['zone:main', 'Production', `${fmt(k.tph)} TVs an hour`], ['d:quality', 'Quality', `FPY ${pct(k.fpy || 0.99)}`], ['zone:fg', 'Shipping', `${P.trucks.length} trucks at the docks`], ['d:finance', 'Finance', `${X.egp(f.revenue)} invoiced today`]];
      const chain = chainA.map(([ref, t, s]) => `<li><button type="button" class="ch" ${ref.startsWith('mode:') ? `data-mode="${ref.slice(5)}"` : `data-ref="${ref.startsWith('d:') ? 'dept:' + ref.slice(2) : ref}"`}><b>${esc(t)}</b><small>${esc(s)}</small></button></li>`).join('');
      const cards = X.DEPTS.map(d => {
        const now = X.deptNow(d.id);
        return `<article class="dc"><header><button type="button" class="lnk ttl" data-ref="dept:${d.id}">${esc(d.name)}</button>${now.recs ? `<b class="badge">${now.recs}</b>` : ''}</header>
          <p class="who">${esc(d.head)} · ${fmt(X.deptStaff(d.id))} people · ${d.systems.map(esc).join(', ')}</p><p class="owns">${esc(d.owns)}</p>
          <dl class="mini">${now.kpis.map(([a, b]) => `<div><dt>${esc(a)}</dt><dd>${esc(b)}</dd></div>`).join('')}</dl></article>`;
      }).join('');
      return `<header class="vh"><div><h2>Departments working as one</h2><p>Order to cash and plan to produce, end to end. Each department works in its own system; SAP and GMES keep them on the same numbers. Select a department to see its people, numbers, decisions and messages.</p></div></header>
        <section class="vs2"><h3>From the customer's order to the invoice</h3><ol class="chainx">${chain}</ol></section>
        <section class="vs2"><div class="dcs">${cards}</div></section>`;
    }

    /* ---------------- decisions ---------------- */
    function decisions() {
      const by = {};
      for (const r of P.recs) { const d = r.dept || X.deptOf(r.agent); (by[d] = by[d] || []).push(r); }
      const groups = X.DEPTS.filter(d => by[d.id]).map(d => `<section class="vs2"><h3>${esc(d.name)} <span>${by[d.id].length}</span></h3><div class="recs">${recCards(by[d.id], X)}</div></section>`).join('');
      const log = P.audit.slice(0, 20).map(a => `<tr><td>${esc(a.time)}</td><td>${esc(a.who)}</td><td><b>${esc(a.action)}</b><small>${esc(a.detail)}</small></td></tr>`).join('');
      return `<header class="vh"><div><h2>Decisions</h2><p>Every department's open decisions in one inbox: the floor agents (maintenance, logistics, quality, planning) and the offices (MRP, S&amp;OP, purchasing, service). Each card says what happens if nobody acts and what each option costs. ${X.egp(P.saved)} of output protected by decisions so far.</p></div></header>
        ${groups || '<section class="vs2"><p class="quiet">Nothing waiting. Start a drill from the 3D factory to see the departments respond.</p></section>'}
        <section class="vs2"><h3>Decision log</h3>${log ? `<table class="tbl"><thead><tr><th>Time</th><th>Who</th><th>Decision</th></tr></thead><tbody>${log}</tbody></table>` : '<p class="quiet">No decision taken yet.</p>'}</section>`;
    }

    /* ---------------- dispatch ---------------- */
    let last = '';
    function render(force) {
      const m = state.mode; if (!m || m === '3d') return;
      if (m === 'sap' && !state.sapSvg) state.sapSvg = sapDiagram();
      const html = m === 'gmes' ? gmes() : m === 'sap' ? sap() : m === 'sop' ? sop() : m === 'mrp' ? mrp() : m === 'depts' ? depts() : decisions();
      if (m === 'sap') {
        // keep the diagram node (its packets animate every frame); replace the rest
        if (!root.querySelector('svg.flow') || force) { root.innerHTML = html; last = ''; }
        else { const keep = root.querySelector('.flowwrap'); const tmp = document.createElement('div'); tmp.innerHTML = html; tmp.querySelector('.flowwrap').replaceWith(keep); root.replaceChildren(...tmp.childNodes); }
        sapCounts(); last = root.innerHTML;
      } else if (html !== last || force) {
        const focusKey = document.activeElement && root.contains(document.activeElement) ? (document.activeElement.dataset.key || document.activeElement.dataset.ref || document.activeElement.dataset.act || document.activeElement.dataset.mrp || document.activeElement.dataset.scen) : null;
        root.innerHTML = html; last = html;
        if (focusKey) { const el = [...root.querySelectorAll('button')].find(b => [b.dataset.key, b.dataset.ref, b.dataset.act, b.dataset.mrp, b.dataset.scen].includes(focusKey)); if (el) el.focus(); }
      }
      if (window.Theme) Theme.icons(root);
    }
    root.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.scen) { state.sopScen = b.dataset.scen; render(true); return; }
      if (b.dataset.sopm) { state.sopModel = b.dataset.sopm; render(true); return; }
      if (b.dataset.mrp) { state.mrpCode = b.dataset.mrp; render(true); ui.select('mrp:' + b.dataset.mrp, { fly: false }); return; }
    });
    return {
      state, H,
      setMode(m) { state.mode = m; last = ''; if (m !== 'sap') pk.length = 0; render(true); },
      render, tick(dt) { if (state.mode === 'sap') tickSap(dt); },
      showMrp(code) { state.mrpCode = code; }
    };
  }

  window.PlantViews = { create: createViews, H, lineChart };
})();
