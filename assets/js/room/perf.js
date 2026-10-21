/* Digital Factory — command room performance views: leadership (health, OEE by line, value, losses), maintenance
   (health, vibration against ISO 10816 zones, technicians, work orders), quality (p-chart, pareto, lots, rejects) and
   energy (power, 15-minute demand intervals, loads). Simulated data; EGP figures use the sample cost model. */
(function () {
  'use strict';
  const { $, $$, esc, fmt, pct, money, signed, link, html, clamp } = DF;
  const PE = window.PlantEngine;
  const T = window.Twin;
  const A = window.Agents;
  const seg = (sel, b) => $$(sel).forEach(x => { x.classList.toggle('active', x === b); x.setAttribute('aria-pressed', String(x === b)); });
  const lineOf = (P, s) => (P.lines[s.line] ? P.lines[s.line].name : 'Support');

  /* ---------------- plant health ---------------- */
  DF.health = function (P) {
    const k = P.kpi;
    const live = P.alarms.filter(a => !(a.shelvedTo > P.t));
    const urgent = live.filter(a => a.prio <= 2).length;
    const worn = P.stations.filter(s => s.degrade > 0 && s.state !== 'down').length, down = P.stations.filter(s => s.state === 'down').length;
    const open = P.orders.filter(o => o.state === 'open' || o.state === 'loading'), late = open.filter(o => o.risk > 300).length;
    const parts = [
      { k: 'OEE', w: 30, v: clamp((k.oee || 0) / 0.85, 0, 1), txt: pct(k.oee || 0) },
      { k: 'First-pass yield', w: 20, v: clamp(((k.fpy || 0.99) - 0.95) / 0.04, 0, 1), txt: pct(k.fpy || 0) },
      { k: 'Alarms', w: 15, v: clamp(1 - urgent * 0.25 - P.alarmStats.rate10 / 20, 0, 1), txt: `${live.length} active · ${P.alarmStats.rate10} in 10 min` },
      { k: 'Machine risk', w: 15, v: clamp(1 - worn * 0.3 - down * 0.45, 0, 1), txt: `${worn} wearing · ${down} stopped` },
      { k: 'Orders on time', w: 20, v: open.length ? 1 - late / open.length : 1, txt: `${open.length - late} of ${open.length}` }
    ];
    const score = Math.round(parts.reduce((a, p) => a + p.w * p.v, 0));
    return { score, parts };
  };

  /* ---------------- leadership ---------------- */
  function leadership() {
    const E = DF.E(), P = E.P, W = E.W, k = P.kpi;
    const h = DF.health(P);
    DF.tween($('#health'), h.score, v => String(Math.round(v)));
    html($('#healthParts'), h.parts.map(p => `<div class="pt"><span>${esc(p.k)} <span class="muted">· weight ${p.w}</span></span><b>${esc(p.txt)}</b>${Viz.meter(p.v, p.v < 0.5 ? 'bad' : p.v < 0.8 ? 'warn' : 'ok')}</div>`).join(''));
    html($('#league'), `<thead><tr><th>Line</th><th class="num">OEE</th><th class="num">Avail.</th><th class="num">Perf.</th><th class="num">Quality</th><th class="num">Per hour</th><th>State</th></tr></thead><tbody>${['L1', 'L2', 'L3', 'L4', 'L5'].map(id => P.lines[id]).sort((a, b) => b.oee - a.oee).map(L => `<tr><td>${link('line:' + L.id, L.name)}<small>${esc(L.sub)}</small></td><td class="num">${pct(L.oee)}</td><td class="num">${pct(L.avail)}</td><td class="num">${pct(L.perf)}</td><td class="num">${pct(L.qual, 2)}</td><td class="num">${fmt(L.tph)}</td><td>${DF.stChip(L.stopped ? 'stopped' : L.state)}</td></tr>`).join('')}</tbody>`);
    const waiting = A.waiting();
    const atStake = waiting.reduce((a, c) => a + Math.max(0, c.value || 0), 0);
    const S = W.stats;
    html($('#value'), `<div class="stats">${[
      DF.stat(money(A.S.value), 'Agent decisions, verified', `${A.S.agents.reduce((a, g) => a + g.actions, 0)} actions`, A.S.value > 0 ? 'ok' : ''),
      DF.stat(money(atStake), 'Waiting for a decision', `${waiting.length} case${waiting.length === 1 ? '' : 's'}`, atStake ? 'warn' : ''),
      DF.stat(money(P.energy.cost), 'Energy today', `${fmt(P.energy.kwh)} kWh`),
      DF.stat(money(S.demandCost), 'Demand charge today', S.demandCost ? 'over the contract' : 'none', S.demandCost ? 'bad' : ''),
      DF.stat(money(S.scrapCost + S.repairCost + S.smtRepairs * T.E.COST.smtRepair), 'Scrap and repairs today', `${fmt(S.failures)} breakdown${S.failures === 1 ? '' : 's'}`),
      DF.stat(fmt(S.lateOrders), 'Orders shipped late', `${fmt(S.shipped)} shipped`, S.lateOrders ? 'bad' : '')
    ].join('')}</div>`);
    const H = P.hist;
    Viz.chart($('#oeeTrend'), { label: 'Plant OEE, last 15 minutes', height: 220, x: { min: H.t[0] || P.t - 900, max: H.t[H.t.length - 1] || P.t, fmt: t => PE.clock(t), name: 'Time' }, y: { min: 0.6, max: 1, fmt: v => Math.round(v * 100) + '%' }, series: [{ key: 'oee', label: 'Plant OEE', cls: 'c1', pts: H.t.map((t, i) => [t, H.oee[i]]), area: true, end: true, endLabel: pct(k.oee || 0) }], rules: [{ y: 0.85, label: 'Benchmark 85%', cls: 'ink' }], legend: false });
    const ap = $('#approvals');
    if (!(ap.contains(document.activeElement) && document.activeElement.closest('.cs-dec'))) html(ap, waiting.slice().sort((a, b) => (b.value || 0) - (a.value || 0)).map(c => CaseUI.card(c, { decide: true, noLast: true })).join('') || '<p class="empty">No decision waits. The agents act on their own only inside their autonomy and the plant policy.</p>');
    // where time went: at each line's constraint station since 09:12; machines stopped anywhere on the line in the label
    const rows = ['L1', 'L2', 'L3', 'L4', 'L5'].map(id => {
      const L = P.lines[id];
      const b = id === 'L5' ? P.byId['L5-Packing'] : L.stations.reduce((m, s) => ((s.kind === 'reflow' || s.kind === 'burnin' ? 0 : s.base) > m.base ? s : m), L.stations[0]);
      return { L, down: b.counters.down / 60, starved: b.counters.starved / 60, blocked: b.counters.blocked / 60, b, lineDown: (W.stats.downSec[id] || 0) / 60 };
    });
    const mx = Math.max(10, ...rows.map(r => r.down + r.starved + r.blocked));
    html($('#losses'), `<div class="pareto">${rows.map(r => `<div class="pb"><span>${link('line:' + r.L.id, r.L.name)} <span class="muted small">· at ${esc(r.b.name)}${r.lineDown >= 0.5 ? ` · machines stopped ${fmt(r.lineDown)} min on this line` : ''}</span></span><b>${fmt(r.down + r.starved + r.blocked)} min</b>
      <span class="stack" role="img" aria-label="${esc(r.L.name)}: ${fmt(r.down)} min stopped, ${fmt(r.starved)} min starved, ${fmt(r.blocked)} min blocked">${[['down', r.down, 'c2'], ['starved', r.starved, 'c4'], ['blocked', r.blocked, 'c1']].map(([k, v, c]) => v > 0.05 ? `<i class="${c}" style="width:${(v / mx * 100).toFixed(2)}%"></i>` : '').join('')}</span></div>`).join('')}</div>
      <p class="vz-legend"><span><i class="vz-bk" style="background:var(--vz-2)"></i>Stopped</span><span><i class="vz-bk" style="background:var(--vz-4)"></i>Starved of material</span><span><i class="vz-bk" style="background:var(--vz-1)"></i>Blocked downstream</span></p>`);
  }
  DF.onView('leadership', leadership);

  /* ---------------- maintenance ---------------- */
  let mSel = 'L1-MounterB';
  const MK = ['printer', 'spi', 'mounter', 'reflow', 'aoi', 'robot', 'bond', 'fct', 'qc', 'packer', 'palletizer'];
  function rulOf(s) {
    if (!s.hist.vib || s.hist.vib.length < 12) return null;
    const run = s.hist.vib.slice(-44).filter(v => v > 0.6).slice(-36), r = A.linreg(run, 5 / 60);
    if (r.slope < 0.004 || r.r2 < 0.3) return { r, p50: Infinity };
    return { r, p50: Math.max(0, 7.1 - r.last) / r.slope };
  }
  function maintenance() {
    const P = DF.world();
    const list = P.stations.filter(s => MK.includes(s.kind));
    const el = $('#machines');
    if (!el.contains(document.activeElement) || document.activeElement.classList.contains('mach')) {
      const focusId = document.activeElement && document.activeElement.dataset && document.activeElement.dataset.mach;
      html(el, list.map(s => {
        const R = rulOf(s);
        const hv = s.health / 100;
        return `<button type="button" class="mach ${s.id === mSel ? 'sel' : ''}" data-mach="${esc(s.id)}" aria-pressed="${s.id === mSel}"><span class="mn">${esc(s.name)}${DF.stChip(s.state)}</span><span class="ml">${esc(lineOf(P, s))} · ${esc(DF.KINDN[s.kind] || s.kind)}</span>${Viz.meter(hv, hv < 0.5 ? 'bad' : hv < 0.75 ? 'warn' : '')}<span class="mr"><span>Health <b>${Math.round(s.health)}</b></span>${s.sens.vib != null ? `<span><b>${s.sens.vib.toFixed(1)}</b> mm/s</span>` : `<span>${(s.kwNow || 0).toFixed(1)} kW</span>`}${R && isFinite(R.p50) ? `<span>Life <b>${PE.mins(R.p50 * 60)}</b></span>` : ''}</span></button>`;
      }).join(''));
      if (focusId) { const f = el.querySelector(`[data-mach="${CSS.escape(focusId)}"]`); if (f) f.focus(); }
    }
    const s = P.byId[mSel] || list[0];
    $('#vibH').textContent = s.hist.vib ? `${s.name} vibration` : `${s.name} power`;
    const H = s.hist, ts = H.t || [];
    if (H.vib && H.vib.length > 3) {
      const R = rulOf(s), pts = ts.map((t, i) => [t, H.vib[i]]);
      const series = [{ key: 'vib', label: 'Measured', cls: 'ck', pts, end: true, endLabel: (s.sens.vib || 0).toFixed(1) + ' mm/s' }];
      let xmax = ts[ts.length - 1] || P.t;
      if (R && isFinite(R.p50) && R.p50 < 240) {
        const t1 = xmax + R.p50 * 60;
        series.push({ key: 'fc', label: 'Trend to zone D', cls: 'c1', dash: true, pts: [[xmax, R.r.last], [t1, 7.1]] });
        xmax = Math.max(xmax, t1);
      }
      Viz.chart($('#vibChart'), { label: `${s.name} vibration with ISO 10816 zones`, height: 220, x: { min: ts[0] || P.t - 900, max: xmax, fmt: t => PE.clock(t) }, y: { min: 0, max: Math.max(8, ...H.vib) * 1.05, fmt: v => v.toFixed(1), unit: 'mm/s' }, series, rules: [{ y: 4.5, label: 'Zone C 4.5', cls: 'warn', legend: 'Alarm limits' }, { y: 7.1, label: 'Zone D 7.1', cls: 'bad' }] });
      $('#vibS').textContent = R && isFinite(R.p50) ? `Rising ${(R.r.slope * 60).toFixed(2)} mm/s per hour (r² ${R.r.r2.toFixed(2)}): about ${PE.mins(R.p50 * 60)} to zone D` : 'RMS velocity, mm/s · no wear trend';
      html($('#vibChip'), DF.stChip(s.state));
    } else {
      Viz.chart($('#vibChart'), { label: `${s.name} power`, height: 220, x: { min: ts[0] || P.t - 900, max: ts[ts.length - 1] || P.t, fmt: t => PE.clock(t) }, y: { min: 0, fmt: v => v.toFixed(1), unit: 'kW' }, series: [{ key: 'kw', label: 'Power', cls: 'c1', pts: ts.map((t, i) => [t, (H.kw || [])[i]]), area: true, end: true }], legend: false });
      $('#vibS').textContent = 'No vibration sensor on this machine; power draw instead (kW)';
      html($('#vibChip'), DF.stChip(s.state));
    }
    html($('#techs'), P.techs.map(t => `<div class="rw"><b>${esc(t.name)}</b><span class="v">${esc(t.state)}</span>${t.job ? `<small>Working on ${link('st:' + (P.byId[t.job] ? t.job : ''), P.byId[t.job] ? P.byId[t.job].name : t.job)}</small>` : '<small>In the maintenance shop</small>'}</div>`).join(''));
    const wo = P.events.filter(e => e.src === 'CMMS' || /work order|WO-/i.test(e.msg)).slice(0, 12);
    html($('#workOrders'), wo.map(e => `<li><time>${esc(e.time)}</time><span class="src">${esc(e.src)}</span><span>${esc(e.msg)}</span></li>`).join('') || '<li><span></span><span></span><span class="muted">No work orders yet this shift.</span></li>');
  }
  DF.onView('maintenance', maintenance);
  document.addEventListener('click', e => { const m = e.target.closest('[data-mach]'); if (m) { mSel = m.dataset.mach; maintenance(); } });

  /* ---------------- quality ---------------- */
  let pLine = 'L1';
  const P0 = { L1: 0.012, L2: 0.016 };
  function binomTail(k, n, p) { let term = Math.pow(1 - p, n), cdf = 0; for (let i = 0; i < k; i++) { cdf += term; term *= (n - i) / (i + 1) * p / (1 - p); } return Math.max(0, 1 - cdf); }
  function quality() {
    const E = DF.E(), P = E.P, W = E.W, k = P.kpi, R = P.rejects;
    html($('#qKpis'), [
      DF.stat(pct(k.fpy || 0), 'First-pass yield', 'Function test and final QC', (k.fpy || 1) < 0.97 ? 'bad' : (k.fpy || 1) < 0.985 ? 'warn' : ''),
      DF.stat(fmt(k.aoiPpm || 0), 'AOI rejects, ppm', 'Both SMT lines'),
      DF.stat(fmt(R.aoi), 'Boards to SMT repair', `${fmt(R.smtRepair.length)} in the queue`),
      DF.stat(fmt(R.fct + R.qc), 'Units failed at test', `${fmt(R.rework.length)} at the rework bench`),
      DF.stat(money(W.stats.scrapCost), 'Scrap today', `${fmt(W.stats.scrap)} units`)
    ].join(''));
    // p-chart: subgroups of 40 boards
    const rows = P.aoiLog[pLine], n = 40, pts = [];
    for (let end = rows.length; end - n >= 0; end -= n) { const g = rows.slice(end - n, end); pts.unshift([g[g.length - 1].t, g.filter(r => !r.ok).length / n]); }
    const p0 = P0[pLine], ucl = p0 + 3 * Math.sqrt(p0 * (1 - p0) / n);
    const last = pts[pts.length - 1];
    Viz.chart($('#pchart'), { label: `AOI reject share per 40 boards on ${P.lines[pLine].name}`, height: 230, x: { min: pts.length ? pts[0][0] : P.t - 1800, max: pts.length ? Math.max(pts[pts.length - 1][0], pts[0][0] + 60) : P.t, fmt: t => PE.clock(t) }, y: { min: 0, max: Math.max(ucl * 1.6, ...pts.map(p => p[1])) , fmt: v => (v * 100).toFixed(1) + '%' },
      series: [{ key: 'p', label: 'Reject share', cls: last && last[1] > ucl ? 'c2' : 'c1', pts, end: true, endLabel: last ? (last[1] * 100).toFixed(1) + '%' : '' }],
      rules: [{ y: ucl, label: `UCL ${(ucl * 100).toFixed(1)}%`, cls: 'bad', legend: 'Upper control limit' }, { y: p0, label: `Centre ${(p0 * 100).toFixed(1)}%`, cls: 'ink' }] });
    // pareto of defect codes
    const codes = {};
    [...P.aoiLog.L1, ...P.aoiLog.L2].filter(r => !r.ok).forEach(r => { codes[r.code] = (codes[r.code] || 0) + 1; });
    P.testLog.filter(r => !r.ok).forEach(r => { const c = r.code || 'Test fail'; codes[c] = (codes[c] || 0) + 1; });
    const list = Object.entries(codes).sort((a, b) => b[1] - a[1]), mx = list.length ? list[0][1] : 1, tot = list.reduce((a, x) => a + x[1], 0);
    html($('#pareto'), list.length ? `<div class="pareto">${list.slice(0, 8).map(([c, v]) => `<div class="pb"><span>${esc(c)}</span><b>${fmt(v)} <span class="muted small">· ${Math.round(v / tot * 100)}%</span></b>${Viz.meter(v / mx, 'brand')}</div>`).join('')}</div>` : '<p class="empty">No defects logged yet in the recent window.</p>');
    // lots
    const ta = A.TOOLS.test_analysis({ minutes: 40 });
    html($('#lots'), `<thead><tr><th>Panel lot</th><th class="num">Tested</th><th class="num">Failed</th><th class="num">Rate</th><th>Chance by luck</th></tr></thead><tbody>${ta.byLot.map(l => { const pv = binomTail(l.failed, l.tested, 0.012); return `<tr><td>${esc(l.lot)}</td><td class="num">${fmt(l.tested)}</td><td class="num">${fmt(l.failed)}</td><td class="num">${pct(l.rate)}</td><td>${l.failed ? (pv < 0.002 ? `<span class="st bad"><i></i>${pv < 1e-4 ? '< 0.01%' : (pv * 100).toFixed(2) + '%'} · not luck</span>` : `<span class="st"><i></i>${(pv * 100).toFixed(1)}%</span>`) : '—'}</td></tr>`; }).join('') || '<tr><td colspan="5" class="muted">No TVs tested in the last 40 minutes.</td></tr>'}</tbody>`);
    const rej = [...P.aoiLog.L1.map(r => Object.assign({ at: 'L1-AOI' }, r)), ...P.aoiLog.L2.map(r => Object.assign({ at: 'L2-AOI' }, r)), ...P.testLog].filter(r => !r.ok).sort((a, b) => b.t - a.t).slice(0, 14);
    html($('#rejects'), rej.map(r => `<li class="warn"><time>${esc(PE.clock(r.t))}</time><span class="src">${esc(P.byId[r.at] ? P.byId[r.at].name : r.at)}</span><span>${esc(r.code || 'Fail')} · <button type="button" class="lnk" data-sn="${esc(r.sn)}">${esc(r.sn)}</button>${r.lot ? ` · lot ${esc(r.lot)}` : ''}</span></li>`).join('') || '<li><span></span><span></span><span class="muted">No rejects yet.</span></li>');
  }
  DF.onView('quality', quality);
  document.addEventListener('click', e => { const b = e.target.closest('#pLine .seg'); if (b) { pLine = b.dataset.l; seg('#pLine .seg', b); quality(); } });

  /* ---------------- energy ---------------- */
  function energy() {
    const E = DF.E(), P = E.P, W = E.W, En = P.energy, k = P.kpi;
    html($('#eKpis'), [
      DF.stat(fmt(k.kw || 0) + ' kW', 'Power now', `${esc(En.tariff)} tariff · EGP ${En.price.toFixed(2)}/kWh`),
      DF.stat(fmt(En.proj) + ' kW', 'This 15-min interval', `projected · contract ${fmt(En.contract)} kW`, En.proj > En.contract ? 'bad' : En.proj > En.contract * 0.95 ? 'warn' : ''),
      DF.stat(fmt(En.kwh) + ' kWh', 'Energy today', money(En.cost)),
      DF.stat(money(W.stats.demandCost), 'Demand charge today', En.over ? `${fmt(En.over)} kW over the contract` : 'none'),
      DF.stat((k.kwhUnit || 0).toFixed(2), 'kWh per unit', 'assembly output'),
      DF.stat((P.util.ambient || 0).toFixed(1) + ' °C', 'Ambient', P.util.heatTarget ? 'heat wave' : 'normal day', P.util.heatTarget ? 'warn' : '')
    ].join(''));
    html($('#tariff'), `<span class="st ${En.tariff === 'Peak' ? 'warn' : ''}"><i></i>${esc(En.tariff)} tariff</span>`);
    const H = P.hist;
    Viz.chart($('#kwChart'), { label: 'Plant power, last 15 minutes', height: 230, x: { min: H.t[0] || P.t - 900, max: H.t[H.t.length - 1] || P.t, fmt: t => PE.clock(t) }, y: { min: 0, max: Math.max(En.contract * 1.1, ...H.kw) * 1.04, fmt: v => fmt(v), unit: 'kW' }, series: [{ key: 'kw', label: 'Plant power', cls: 'c1', pts: H.t.map((t, i) => [t, H.kw[i]]), area: true, end: true, endLabel: fmt(k.kw || 0) + ' kW' }], rules: [{ y: En.contract, label: `Contract ${En.contract} kW`, cls: 'bad', legend: 'Contract demand' }] });
    const iv = En.avgHist.slice(-24), n0 = En.iNo - iv.length;
    Viz.columns($('#intervals'), { label: '15-minute average demand per interval', height: 200, unit: 'kW', series: 'average', fmt: v => fmt(v), items: iv.map((v, i) => ({ k: PE.clock((n0 + i) * 900), v, cls: v > En.contract ? 'bad' : v > En.contract * 0.95 ? 'warn' : 'c1' })).concat([{ k: 'now', v: Math.round(En.proj), cls: En.proj > En.contract ? 'bad' : 'cm', tip: 'projected, this interval' }]), rule: { y: En.contract, label: `Contract ${En.contract} kW`, cls: 'bad' } });
    const loads = P.util.assets.filter(a => a.kind !== 'transformer').map(a => ({ ref: 'util:' + a.id, name: a.name, kw: a.kw, sub: a.forced > P.t ? 'Forced on' : a.defer > P.t ? 'Start held' : a.on === false ? 'Off' : 'On' }))
      .concat(P.stations.slice().sort((a, b) => b.kwNow - a.kwNow).slice(0, 5).map(s => ({ ref: 'st:' + s.id, name: s.name, kw: s.kwNow, sub: lineOf(P, s) })));
    const mx = Math.max(1, ...loads.map(l => l.kw));
    html($('#loads'), loads.map(l => `<div class="rw"><span>${link(l.ref, l.name)} <span class="muted small">· ${esc(l.sub)}</span></span><span class="v">${fmt(l.kw)} kW</span>${Viz.meter(l.kw / mx, 'brand')}</div>`).join(''));
  }
  DF.onView('energy', energy);
})();
