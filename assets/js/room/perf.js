/* Digital Factory — the performance views of the command room, on Plant EG-01: leadership (plant health, the six
   main lines, value today, where time went), maintenance (machine health, condition trends, technicians and SAP PM work
   orders), quality (SPC with Nelson rules, defects, 8D nonconformance reports, rejects) and energy (demand against the
   4,000 kW contract, power by area, loads). Simulated data. */
(function () {
  'use strict';
  const { $, $$, esc, fmt, pct, link, toRef, stChip, tag, html } = DF;
  const mins = s => DF.E.mins(s), clock = t => DF.E.clock(t);
  const seg = (sel, fn) => $$(sel + ' .seg').forEach(b => { b.onclick = () => { $$(sel + ' .seg').forEach(x => { x.classList.toggle('active', x === b); x.setAttribute('aria-pressed', String(x === b)); }); fn(b); }; });
  const mains = () => Object.values(DF.P.lines).filter(L => L.kind === 'main');
  const stats = (el, rows) => html(el, rows.map(([v, l, s, c]) => `<div class="stat"><b class="${c || ''}">${esc(v)}</b><span>${esc(l)}</span><small>${esc(s)}</small></div>`).join(''));
  const timeAxis = () => ({ min: DF.P.hist.t[0], max: DF.P.hist.t[DF.P.hist.t.length - 1], fmt: t => clock(t), name: 'Time' });

  /* ================= leadership ================= */
  function healthParts() {
    const P = DF.P, k = P.kpi, open = P.alarms.filter(a => !(a.shelvedTo > P.t));
    const wear = P.stations.filter(s => s.degrade > 0 && s.state !== 'down').length, down = P.stations.filter(s => s.state === 'down').length;
    const base = DF.AG.base, due = P.orders.filter(o => (o.state === 'open' || o.state === 'loading') && o.due - P.t < 7200).length;
    const parts = [
      ['OEE', Math.min(30, (k.oee || 0) / 0.85 * 30), 30, pct(k.oee || 0)],
      ['First-pass yield', Math.max(0, Math.min(20, ((k.fpy || 0) - 0.95) / 0.05 * 20)), 20, pct(k.fpy || 0, 2)],
      ['Alarms', Math.max(0, 20 - 5 * open.filter(a => a.prio <= 2).length - open.length), 20, `${open.length} open`],
      ['Machine risk', Math.max(0, 15 - 5 * wear - 5 * down), 15, `${wear} wearing · ${down} stopped`],
      ['Orders', due ? 15 * (1 - (base ? base.late : 0) / due) : 15, 15, base && base.late ? `${base.late} of ${due} short` : 'all covered']
    ];
    return { parts, score: Math.round(parts.reduce((a, p) => a + p[1], 0)) };
  }
  DF.healthScore = () => healthParts().score;
  function health() {
    const { parts, score } = healthParts();
    $('#health').textContent = score;
    html($('#healthParts'), parts.map(([n, v, max, s]) => `<div class="pt"><span>${esc(n)} · <span class="muted">${esc(s)}</span></span><b>${Math.round(v)} / ${max}</b>${Viz.meter(v / max, v / max < 0.5 ? 'bad' : v / max < 0.8 ? 'warn' : '')}</div>`).join(''));
  }
  function leadership() {
    const P = DF.P, M = DF.E.MODELS, X = DF.X;
    health();
    html($('#league'), `<thead><tr><th>Line</th><th>State</th><th class="num">TVs / h</th><th class="num">OEE</th><th class="num">A</th><th class="num">P</th><th class="num">Q</th></tr></thead><tbody>${mains().sort((a, b) => a.oee - b.oee).map(L => `<tr><td>${link('line:' + L.id, L.name)}<small>${esc(M[L.model].name)}</small></td><td>${stChip(L.state)}</td><td class="num">${fmt(L.tph)}</td><td class="num ${L.oee < 0.7 ? 'bad' : L.oee < 0.8 ? 'warn' : ''}">${pct(L.oee)}</td><td class="num">${pct(L.avail, 0)}</td><td class="num">${pct(L.perf, 0)}</td><td class="num">${pct(L.qual, 1)}</td></tr>`).join('')}</tbody>`);
    const f = X.finance();
    html($('#value'), [['Revenue shipped', f.revenue, ''], ['Contribution', f.margin, f.margin >= 0 ? 'pos' : 'neg'], ['Value from decisions', f.saved, 'pos'], ['Rework and scrap', -(f.rework || 0), f.rework ? 'neg' : ''], ['Inventory on the floor', f.total, '']].map(([l, v, c]) => `<div class="m"><span>${esc(l)}</span><b class="${c}">${esc(X.egp(v))}</b></div>`).join(''));
    const H = P.hist;
    if (H.t.length > 2) Viz.chart($('#oeeTrend'), { height: 200, label: 'Main-line OEE', x: timeAxis(), y: { min: 0.5, max: 1, fmt: v => Math.round(v * 100) + '%' }, rules: [{ y: 0.85, label: 'Benchmark 85%', cls: 'ok' }], series: [{ label: 'OEE', cls: 'c1', pts: H.t.map((t, i) => [t, H.oee[i]]), end: true, endLabel: pct(H.oee[H.oee.length - 1]) }] });
    const el = $('#approvals'), w = DF.waiting();
    if (!(el.contains(document.activeElement) && document.activeElement.closest('.cs-btns'))) html(el, w.length ? w.map(c => DF.Dec.card(c, { decide: true })).join('') : '<p class="empty">No decision waits for a person.</p>');
    // where time went: minutes stopped, short-stopped, in changeover or planned work, per line
    const lost = s => { const rs = Object.assign({}, s.rs || {}); if (['down', 'maint', 'micro', 'changeover'].includes(s.state)) { const k = s.state + '|' + (s.why || ''); rs[k] = (rs[k] || 0) + (P.t - s.since); } return Object.entries(rs).filter(([k]) => /^(down|maint|micro|changeover)\|/.test(k)).reduce((a, [, v]) => a + v, 0); };
    const items = Object.values(P.lines).filter(L => L.kind !== 'cushion').map(L => ({ k: L.kind === 'injection' ? 'Injection' : L.id, v: Math.round(L.stations.reduce((a, s) => a + lost(s), 0) / 60), tip: L.name })).map(it => Object.assign(it, { cls: it.v > 30 ? 'bad' : it.v > 10 ? 'warn' : 'c1' }));
    Viz.columns($('#losses'), { items, label: 'Minutes lost per line', unit: 'min', height: 190, series: 'stopped, short stops, changeover, planned work' });
  }
  DF.onView('leadership', leadership);

  /* ================= maintenance ================= */
  let mFilter = 'risk', mSel = null;
  function machines() {
    const P = DF.P;
    let list = P.stations.filter(s => s.line !== 'SUP');
    if (mFilter === 'risk') list = list.filter(s => s.degrade > 0 || s.state === 'down' || s.state === 'maint' || s.health < 70).sort((a, b) => (b.degrade > 0) - (a.degrade > 0) || a.health - b.health).slice(0, 24);
    else if (mFilter === 'smd') list = list.filter(s => s.line.startsWith('SMD') && /mounter|reflow|printer|writer/.test(s.kind));
    else if (mFilter === 'inj') list = list.filter(s => s.line === 'INJ');
    else list = list.filter(s => s.line.startsWith('ML') && !s.manual);
    if (!mSel || !P.byId[mSel]) mSel = list[0] ? list[0].id : 'SMD4-MounterB';
    const el = $('#machines');
    if (!el.contains(document.activeElement)) html(el, list.length ? list.map(s => {
      const rul = s.degrade > 0 && s.state !== 'down' ? (s.health - 22) / s.degrade : null;
      return `<button type="button" class="mach ${s.id === mSel ? 'sel' : ''}" data-mach="${esc(s.id)}" aria-pressed="${s.id === mSel}"><span class="mn">${esc(s.name)}${stChip(s.state)}</span><span class="ml">${esc(P.lines[s.line] ? P.lines[s.line].name : s.line)}</span>${Viz.meter(s.health / 100, s.health < 40 ? 'bad' : s.health < 70 ? 'warn' : '')}<span class="mr"><span>Health <b>${Math.round(s.health)}</b></span><span>${rul != null ? `fails in <b>${esc(mins(rul))}</b>` : s.sens && s.sens.vib != null ? `<b>${s.sens.vib.toFixed(1)}</b> mm/s` : `<b>${(s.kwNow || 0).toFixed(0)}</b> kW`}</span></span></button>`;
    }).join('') : '<p class="empty">No machine at risk: none wears faster than normal and none is stopped.</p>');
    const s = P.byId[mSel], H = s.hist || {};
    const key = H.vib && H.vib.length > 3 ? 'vib' : s.kind === 'injection' ? 'press' : (s.kind === 'oven' || s.kind === 'reflow') ? 'temp' : 'health';
    const lim = key === 'vib' ? [{ y: 4.5, label: 'Alarm 4.5 mm/s', cls: 'warn' }, { y: 7.1, label: 'Zone D 7.1 mm/s', cls: 'bad' }] : key === 'temp' && s.kind === 'oven' ? [{ y: 190, label: 'Cure 190 °C', cls: 'warn' }] : key === 'health' ? [{ y: 22, label: 'Failure 22%', cls: 'bad' }] : [];
    const unit = { vib: 'mm/s', press: 'bar', temp: '°C', health: '%' }[key];
    $('#vibS').innerHTML = `${link('st:' + s.id, s.name)} · ${esc(P.lines[s.line] ? P.lines[s.line].name : '')} · ${{ vib: 'vibration, RMS velocity (ISO 10816 zones)', press: 'injection pressure', temp: 'temperature', health: 'health index' }[key]}`;
    html($('#vibChip'), s.degrade > 0 ? tag('warn', 'Wearing') : stChip(s.state));
    const v = H[key] || [], t0 = P.t - (v.length - 1) * 5;
    if (v.length > 2) Viz.chart($('#vibChart'), { height: 200, label: `${s.name} ${unit}`, x: { min: t0, max: P.t, fmt: t => clock(t), name: 'Time' }, y: { unit, min: key === 'health' ? 0 : undefined, max: key === 'health' ? 100 : undefined }, rules: lim, series: [{ label: s.name, cls: 'c1', pts: v.map((x, i) => [t0 + i * 5, x]), end: true, endLabel: (+v[v.length - 1]).toFixed(1) + ' ' + unit }] });
    else html($('#vibChart'), '<p class="empty">No trend recorded yet.</p>');
    html($('#techs'), P.techs.map(t => `<div class="rw"><span>${esc(t.name)}</span><span class="v">${t.state === 'available' ? 'Available' : t.state === 'repairing' ? 'Repairing' : t.state === 'walking' ? 'On the way' : 'Returning'}</span><small>${t.job ? link('st:' + t.job.id, t.job.name) + ' · ' + esc(P.lines[t.job.line] ? P.lines[t.job.line].name : '') : 'Maintenance shop'}</small></div>`).join(''));
    html($('#workOrders'), `<thead><tr><th>Order</th><th>Machine</th><th>Type</th><th>Status</th><th class="num">Due</th></tr></thead><tbody>${P.wo.slice().sort((a, b) => (a.status === 'Completed') - (b.status === 'Completed') || (a.due || 0) - (b.due || 0)).slice(0, 14).map(w => `<tr><td class="num">${esc(w.id)}</td><td>${P.byId[w.st] ? link('st:' + w.st, P.byId[w.st].name) : esc(w.st)}<small>${esc(w.why || '')}</small></td><td>${esc(w.type)}</td><td>${w.status === 'Completed' ? tag('', 'Completed') : w.status === 'In progress' ? tag('maint', 'In progress') : tag('', w.status)}</td><td class="num">${w.due ? esc(clock(w.due)) : '—'}</td></tr>`).join('')}</tbody>`);
  }
  seg('#machFilter', b => { mFilter = b.dataset.f; mSel = null; machines(); });
  document.addEventListener('click', e => { const b = e.target.closest('[data-mach]'); if (b) { mSel = b.dataset.mach; b.blur(); machines(); } });
  DF.onView('maintenance', machines);

  /* ================= quality ================= */
  const SIG = [
    ['IM10:press', 'IM10 injection pressure (65" back covers)', 'IM10', 'press', 'bar'],
    ['PR4-Coating:temp', 'Press line 4 coating oven, cure temperature', 'PR4-Coating', 'temp', '°C'],
    ['SMD4-MounterB:vib', 'SMD line 4 Mounter B, spindle vibration', 'SMD4-MounterB', 'vib', 'mm/s'],
    ['SMD1-Reflow:peak', 'SMD line 1 reflow, peak temperature', 'SMD1-Reflow', 'peak', '°C'],
    ['IM03:press', 'IM03 injection pressure (43" back covers)', 'IM03', 'press', 'bar']
  ];
  const spcSel = $('#spcSel');
  spcSel.innerHTML = SIG.map(s => `<option value="${s[0]}">${esc(s[1])}</option>`).join('');
  spcSel.onchange = () => quality();
  function quality() {
    const P = DF.P, X = DF.X, q = X.quality();
    stats($('#qKpis'), [[pct(q.fpy || 0, 2), 'First-pass yield', 'function test and final QA', q.fpy < 0.97 ? 'neg' : ''], [fmt(q.dppm), 'Defects per million', 'at the test and inspection stations'], [fmt(q.holds), 'Holds', 'lots and blocked stock'], [fmt(q.rework), 'TVs to rework', `${fmt(q.smtRepair)} boards to PBA repair`], [fmt(q.iqcOpen), 'Incoming lots in inspection', `${fmt(q.iqcDone)} accepted today`]]);
    const sg = SIG.find(s => s[0] === spcSel.value) || SIG[0], st = P.byId[sg[2]], v = (st.hist[sg[3]] || []).filter(x => x > 0);
    const c = DF.AG.spc(v, sg[0]);
    if (v.length > 2) {
      const t0 = P.t - (v.length - 1) * 5;
      Viz.chart($('#pchart'), { height: 220, label: sg[1], x: { min: t0, max: P.t, fmt: t => clock(t), name: 'Time' }, y: { unit: sg[4], fmt: v => (Math.abs(v) >= 100 ? fmt(v) : v.toFixed(1)) }, rules: c ? [{ y: c.ucl, label: 'UCL', cls: 'bad' }, { y: c.mu, label: 'Mean' }, { y: c.lcl, label: 'LCL', cls: 'bad' }] : [], series: [{ label: st.name, cls: 'c1', pts: v.map((x, i) => [t0 + i * 5, x]), end: true, endLabel: (+v[v.length - 1]).toFixed(1) }] });
    }
    $('#spcRules').innerHTML = c ? (c.rules.length ? `<span class="neg">${esc(c.rules.join(' · '))}</span>` : `In control: mean ${c.mu.toFixed(1)} ${esc(sg[4])}, limits ${c.lcl.toFixed(1)}–${c.ucl.toFixed(1)}. No Nelson rule fired.`) : 'Collecting the normal-process samples for the control limits.';
    const par = Object.entries(X.pareto).map(([k, n]) => { const [code, sid] = k.split('|'); return { code, sid, n }; }).sort((a, b) => b.n - a.n).slice(0, 8);
    const mx = par.length ? par[0].n : 1;
    html($('#pareto'), par.length ? `<div class="pareto">${par.map(p => `<div class="pb"><span>${esc(p.code)} <span class="muted">· ${P.byId[p.sid] ? link('st:' + p.sid, `${P.byId[p.sid].name}, ${P.lines[P.byId[p.sid].line].name}`) : esc(p.sid)}</span></span><b>${fmt(p.n)}</b>${Viz.meter(p.n / mx)}</div>`).join('')}</div>` : '<p class="empty">No defect found yet this shift.</p>');
    html($('#ncr'), `<thead><tr><th>NCR</th><th>Defect</th><th>Step</th><th class="num">Count</th><th>Cause</th></tr></thead><tbody>${X.ncr.slice(0, 10).map(n => `<tr><td class="num">${esc(n.id)}</td><td>${esc(n.code)}<small>${P.byId[n.ref] ? esc(P.byId[n.ref].name) : ''}</small></td><td>${n.step >= 7 ? tag('', 'Closed') : tag(n.step < 3 ? 'warn' : '', X.D8[n.step])}</td><td class="num">${fmt(n.count)}</td><td>${esc(n.cause)}</td></tr>`).join('') || '<tr><td colspan="5" class="muted">No nonconformance report open. One opens when a defect repeats, or a drill starts one.</td></tr>'}</tbody>`);
    const rj = P.rejects.rework.slice(-12).reverse();
    html($('#rejects'), rj.map(r => `<li class="warn"><time>${esc(clock(r.t))}</time><span class="src">Reject</span><span>${link('unit:' + r.u.sn, r.u.sn)} · ${esc(r.u.defect ? r.u.defect.code : 'Reworked')}${r.u.defect && P.byId[r.u.defect.at] ? ' · ' + esc(P.byId[r.u.defect.at].name) + ', ' + esc(P.lines[P.byId[r.u.defect.at].line].name) : ''}</span></li>`).join('') || '<li><span></span><span></span><span class="muted">No reject yet this shift.</span></li>');
  }
  DF.onView('quality', quality);

  /* ================= energy ================= */
  function energy() {
    const P = DF.P, A = DF.AG.energy, k = P.kpi, H = P.hist;
    const tvs = Math.max(1, P.made.tv);
    stats($('#eKpis'), [[fmt(k.kw) + ' kW', 'Plant now', `outside air ${P.util.ambient.toFixed(1)} °C`], [fmt(A.avg) + ' kW', '15-minute average', 'what the utility bills'], [fmt(A.peak) + ' kW', 'Forecast peak', 'contract 4,000 kW', A.peak > 4000 ? 'neg' : ''], [fmt(P.energy.kwh) + ' kWh', 'Energy since 09:12', `${(P.energy.kwh / tvs).toFixed(1)} kWh a TV packed`], [P.shave && P.t < P.shave.until ? 'On' : 'Off', 'Peak shaving', P.shave && P.t < P.shave.until ? 'until ' + clock(P.shave.until) : 'utilities only, takt unchanged']]);
    html($('#tariff'), A.peak > 4000 ? tag('bad', 'Above contract') : A.peak > 3900 ? tag('warn', 'Near contract') : tag('', 'Inside contract'));
    if (H.t.length > 2) Viz.chart($('#kwChart'), { height: 220, label: 'Plant power, kW', x: timeAxis(), y: { unit: 'kW' }, rules: [{ y: 4000, label: 'Contract 4,000 kW', cls: 'bad' }], series: [{ label: 'Plant', cls: 'c1', pts: H.t.map((t, i) => [t, H.kw[i]]), end: true, endLabel: fmt(H.kw[H.kw.length - 1]) + ' kW' }] });
    const by = k2 => P.stations.filter(s => P.lines[s.line] && P.lines[s.line].kind === k2).reduce((a, s) => a + (s.kwNow || 0), 0);
    const items = [['Main lines', by('main')], ['LCM', by('lcm')], ['SMD', by('smd')], ['Injection', by('injection')], ['Press and coating', by('press')], ['Cushions', by('cushion')], ['Utilities', P.util.kw - 380], ['Lighting, offices, IT', 380]].map(([kk, v]) => ({ k: kk, v: Math.round(v), cls: 'c1' }));
    Viz.columns($('#intervals'), { items, label: 'Power by area, kW', unit: 'kW', height: 200, series: 'now' });
    const loads = P.util.assets.map(a => ({ ref: 'util:' + a.id, name: a.name, kw: a.kw, sub: 'Utilities' })).concat(P.stations.slice().sort((a, b) => (b.kwNow || 0) - (a.kwNow || 0)).slice(0, 8).map(s => ({ ref: 'st:' + s.id, name: s.name, kw: s.kwNow || 0, sub: P.lines[s.line] ? P.lines[s.line].name : '' }))).sort((a, b) => b.kw - a.kw).slice(0, 12);
    const mx = loads.length ? loads[0].kw : 1;
    html($('#loads'), loads.map(l => `<div class="rw"><span>${link(l.ref, l.name)}</span><span class="v">${fmt(l.kw)} kW</span><small>${esc(l.sub)}</small>${Viz.meter(l.kw / mx)}</div>`).join(''));
  }
  DF.onView('energy', energy);
})();
