/* Digital Factory — command room intelligence: the shift forecast (Monte Carlo on forks of the twin), the agent crew,
   the case board, policy, ledger and memory, the case dialog, predictions, root cause and genealogy, the what-if lab
   and the drills. Simulated data. */
(function () {
  'use strict';
  const { $, $$, esc, icon, fmt, pct, money, signed, link, html, clamp } = DF;
  const PE = window.PlantEngine;
  const T = window.Twin;
  const A = window.Agents;
  const seg = (sel, b) => $$(sel).forEach(x => { x.classList.toggle('active', x === b); x.setAttribute('aria-pressed', String(x === b)); });

  /* ---------------- the shift forecast: futures to 14:00 ---------------- */
  const erf = x => { const s = Math.sign(x); x = Math.abs(x); const t = 1 / (1 + 0.3275911 * x); return s * (1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x)); };
  const Phi = z => 0.5 * (1 + erf(z / Math.SQRT2));
  const planAt = t => Math.round((95 + 164) * 0.82 * Math.max(0, t - T.E.SHIFT_START) / 3600);
  DF.planAt = planAt;
  let FC = null, fcBusy = false, fcWall = 0;
  DF.forecastNow = function () {
    const P = DF.world(), k = P.kpi, plan = k.planEnd || planAt(T.E.SHIFT_END);
    if (P.t >= T.E.SHIFT_END - 60) return { sim: false, prob: k.units >= plan ? 1 : 0, p10: k.units, p50: k.units, p90: k.units, plan, done: true };
    if (FC && !DF.replay) {
      const S = FC.o.S.packed, b = FC.units0;
      const p10 = b + S.p10, p50 = b + S.p50, p90 = b + S.p90, mean = b + S.mean;
      const sd = Math.max(4, (p90 - p10) / 2.563);
      return { sim: true, n: FC.res.seeds, prob: clamp(1 - Phi((plan - mean) / sd), 0.01, 0.99), p10, p50, p90, mean, plan, at: FC.at, ms: FC.res.ms };
    }
    return { sim: false, prob: k.prob || 0.5, p10: (k.fcst || 0) * 0.97, p50: k.fcst || 0, p90: (k.fcst || 0) * 1.03, plan };
  };
  // a stop, a repair, a drill or a decision changes the end of the shift: play the futures again soon after it
  let evTimer = null, evWall = 0;
  T.on(t => {
    if (t !== 'fault' && t !== 'repaired' && t !== 'scenario' && t !== 'action') return;
    clearTimeout(evTimer);
    evTimer = setTimeout(() => { if (Date.now() - evWall > 12000) { evWall = Date.now(); DF.runForecast(true); } }, 2500);
  });
  DF.runForecast = async function (force) {
    const P = T.E.P;
    if (fcBusy || DF.replay || T.paused || T.catching) return;
    const horizon = T.E.SHIFT_END - P.t;
    if (horizon < 600) return;
    if (!force && FC && (Date.now() - fcWall < 45000 || (P.t - FC.at < 300 && Date.now() - fcWall < 150000))) return;
    fcBusy = true; fcWall = Date.now();
    const units0 = P.kpi.units, at = P.t;
    $('#fcRun') && ($('#fcRun').disabled = true);
    try {
      const res = await T.whatif({ horizon, seeds: 6, sample: 300, options: [{ id: 'none', label: 'As planned', cmds: [] }] });
      FC = { res, o: res.options[0], units0, at };
    } catch (e) { console.warn('forecast', e); }
    fcBusy = false;
    if ($('#fcRun')) $('#fcRun').disabled = false;
    DF.refresh();
  };

  /* ---------------- agents ---------------- */
  const AUT = { advise: 'Advise only', approve: 'Ask first', auto: 'Auto' };
  const AUT_S = { advise: 'Advise', approve: 'Ask first', auto: 'Auto' };
  function crew() {
    const el = $('#crew'); if (el.contains(document.activeElement)) return;
    html(el, A.S.agents.map(a => {
      const open = A.S.cases.find(c => c.agent === a.id && c.state !== 'closed');
      const last = open && open.steps[open.steps.length - 1];
      return `<article class="card agent ${/Waiting/.test(a.status) ? 'waiting' : ''}">
        <div class="ah"><div><h3>${esc(a.name)}</h3><small>${esc(a.scope)}</small></div><span class="cs-chip ${/Waiting/.test(a.status) ? 'warn' : /Watching/.test(a.status) ? '' : 'info'}">${/Simulating|Investigating|Verifying/.test(a.status) ? '<i class="cs-spin"></i>' : ''}${esc(a.status)}</span></div>
        <div class="seg-tabs sm" role="group" aria-label="${esc(a.name)} autonomy">${['advise', 'approve', 'auto'].map(l => `<button type="button" class="seg ${a.autonomy === l ? 'active' : ''}" aria-pressed="${a.autonomy === l}" data-aut="${a.id}:${l}" ${a.locked ? 'disabled' : ''}>${AUT_S[l]}</button>`).join('')}</div>
        ${a.locked ? `<p class="muted small" style="margin:0">${a.meta ? 'Checks every plan; it does not act on the plant itself.' : 'Locked to Auto: it may slow a robot, never speed one up.'}</p>` : ''}
        <p class="now">${open ? `<b>${link('case:' + open.id, open.id)}</b> ${esc(open.title)}${last ? ` · <span>${esc(last.title)}</span>` : ''}` : a.last ? esc(a.last) : 'Watching the plant.'}</p>
        <div class="rec"><div><b>${fmt(a.cases)}</b>cases</div><div><b>${a.verified ? Math.round(a.accurate / a.verified * 100) + '%' : '—'}</b>verified right</div><div><b>${money(a.value)}</b>value</div></div>
      </article>`;
    }).join(''));
  }
  let caseFilter = 'open';
  function board() {
    const el = $('#board');
    if (el.contains(document.activeElement) && document.activeElement.closest('.cs-dec')) return;
    let list = A.S.cases;
    if (caseFilter === 'open') list = list.filter(c => c.state !== 'closed');
    else if (caseFilter === 'waiting') list = list.filter(c => c.state === 'awaiting' || c.state === 'advise');
    else if (caseFilter === 'closed') list = list.filter(c => c.state === 'closed');
    html(el, list.slice(0, 30).map(c => CaseUI.card(c, { decide: true })).join('') || `<p class="empty">${caseFilter === 'open' ? 'No open cases. Start a drill to watch the crew work one.' : 'No cases in this filter yet.'}</p>`);
    if (typeof Theme !== 'undefined') Theme.icons(el);
  }
  function policy() {
    const el = $('#policy'); if (el._h) return;
    const NAME = { expedite: 'Expedite an AGV delivery', manualFetch: 'Fetch material by hand', planRepair: 'Planned repair now', derate: 'Derate a machine', dispatchTech: 'Dispatch a technician', switchL2: 'Changeover SMT Line 2', switchBack: 'Changeover back', slowAssembly: 'Slow the assembly lines', fixReflow: 'Correct an oven setpoint', stopInspect: 'Stop a line to inspect', quarantine: 'Quarantine a lot', inspectLot: '100% incoming inspection', boost: 'Line to 110%', split: 'Split a delivery', prioritize: 'Re-sequence orders', cover: 'Move an operator', leaderCover: 'Line leader covers', expediteTruck: 'Alternative carrier', restart: 'Staggered restart', restartAll: 'Restart everything at once', stagger: 'Stagger utility loads', precool: 'Pre-cool chillers', reflowProfile: 'Lower the reflow profile', safeSpeed: 'Robot to safe speed' };
    html(el, `<thead><tr><th>Action</th><th>At most</th><th>Risk</th></tr></thead><tbody>${Object.entries(A.POLICY).filter(([k]) => k !== 'none').map(([k, p]) => `<tr><td>${esc(NAME[k] || k)}<small>${esc(p.note)}</small></td><td><span class="pol-${p.max}">${esc(AUT[p.max])}</span></td><td>${esc(p.risk)}</td></tr>`).join('')}</tbody>`);
  }
  function ledger() {
    const el = $('#ledger');
    const rows = A.S.ledger.slice(0, 40);
    html(el, `<thead><tr><th>Time</th><th>Case</th><th>Decision</th><th>By</th><th>Rule</th><th class="num">Predicted</th><th>Verified</th></tr></thead><tbody>${rows.map(l => {
      const c = A.caseById(l.case), o = c && c.outcome;
      return `<tr><td class="num">${esc(l.time)}</td><td>${link('case:' + l.case, l.case)}<small>${esc(l.agent)}</small></td><td>${esc(l.action)}${l.rationale ? `<small>${esc(l.rationale)}</small>` : ''}</td><td>${esc(l.by)}</td><td>${esc(l.policy)}</td><td class="num">${l.predicted ? signed(l.predicted, money) : '—'}${l.confidence ? `<small>${Math.round(l.confidence * 100)}% sure</small>` : ''}</td><td>${o ? `<span class="st ${o.ok === false ? 'bad' : o.ok ? '' : 'warn'}"><i></i>${esc(o.verdict)}</span>` : c && c.state === 'verifying' ? '<span class="muted">Checking…</span>' : '—'}</td></tr>`;
    }).join('') || '<tr><td colspan="7" class="muted">No decisions yet this shift.</td></tr>'}</tbody>`);
  }
  function memory() {
    html($('#memory'), A.S.memory.slice(0, 18).map(m => `<li>${m.live ? '<em>Today</em>' : ''}<b>${esc(m.title)}</b><span>${esc(m.id)} · ${esc(m.when)} · ${esc(m.cause || '')}${m.fix ? ' → ' + esc(m.fix) : ''}. ${esc(m.outcome || '')}</span></li>`).join(''));
  }
  DF.onView('agents', () => { crew(); board(); policy(); ledger(); memory(); });
  document.addEventListener('click', e => {
    const a = e.target.closest('[data-aut]');
    if (a) { const [id, l] = a.dataset.aut.split(':'); A.setAutonomy(id, l); DF.toast(`${A.agent(id).name}: ${AUT[l]}`, 'info'); setTimeout(crew, 60); return; }
    const f = e.target.closest('#caseFilter .seg');
    if (f) { caseFilter = f.dataset.f; seg('#caseFilter .seg', f); board(); }
  });

  /* ---------------- the case dialog ---------------- */
  let dlgCase = null;
  const dlg = $('#caseDlg'), dlgB = $('#caseDlgB');
  function renderCase() {
    const c = dlgCase && A.caseById(dlgCase);
    if (!c) return;
    if (dlgB.contains(document.activeElement) && document.activeElement.closest('.cs-dec, .cs-opts')) return;
    $('#caseDlgT').textContent = c.title;
    html(dlgB, CaseUI.detail(c, { noTitle: true }) + `<div class="cs-actions">${c.chain && c.chain.length ? `<button type="button" class="btn btn-secondary btn-sm" data-chain="${esc(c.id)}"><span data-icon="layers"></span>Show the cause path on the mimic</button>` : ''}<a class="btn btn-secondary btn-sm" href="plant.html"><span data-icon="layers"></span>Open the 3D plant</a><button type="button" class="btn btn-secondary btn-sm" data-ask-case="${esc(c.id)}"><span data-icon="sparkles"></span>Ask the copilot</button></div>`);
    if (typeof Theme !== 'undefined') Theme.icons(dlgB);
  }
  DF.openCase = function (id) {
    if (!A.caseById(id)) { DF.toast(`Case ${id} is not in this shift`, 'info'); return; }
    dlgCase = id; dlgB._h = null;
    renderCase();
    if (!dlg.open) { if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', ''); }
    dlgB.scrollTop = 0;
  };
  $('#caseDlgX').onclick = () => dlg.close();
  dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });
  dlg.addEventListener('close', () => { dlgCase = null; });
  CaseUI.bind(dlgB, (op) => { DF.toast(op === 'approve' ? 'Approved: the agent acts now and verifies the outcome' : 'Rejected and written to the ledger', op === 'approve' ? 'success' : 'info'); setTimeout(renderCase, 120); });
  CaseUI.bind($('#needs'), op => { DF.toast(op === 'approve' ? 'Approved: the agent acts now and verifies the outcome' : 'Rejected and written to the ledger', op === 'approve' ? 'success' : 'info'); setTimeout(() => DF.renderCases(), 120); });
  CaseUI.bind($('#board'), () => setTimeout(board, 120));
  CaseUI.bind($('#approvals'), () => setTimeout(() => DF.refresh(true), 120));
  document.addEventListener('click', e => {
    const ch = e.target.closest('[data-chain]');
    if (ch) { const c = A.caseById(ch.dataset.chain); dlg.open && dlg.close(); DF.go('command'); DF.showChain(c); return; }
    const ak = e.target.closest('[data-ask-case]');
    if (ak && window.Copilot) { const c = A.caseById(ak.dataset.askCase); dlg.open && dlg.close(); Copilot.open(`Explain case ${c.id} (${c.title}): the evidence, the options the agent simulated and whether you agree with its recommendation.`); }
  });
  DF.showChain = function (c) {
    if (!DF.floor) return;
    DF.floor.setChain(c && c.chain && c.chain.length ? c.chain : null);
    if (c && c.chain && c.chain[0]) DF.select(c.chain[0], { focus: true });
    DF.toast(c ? `Cause path of ${c.id} on the mimic: 1 is the cause` : 'Cause path cleared', 'info');
  };
  A.on(t => { if (dlg.open && (t === 'change' || t === 'step' || t === 'awaiting' || t === 'closed' || t === 'acted')) renderCase(); });

  /* ---------------- predictions ---------------- */
  function predict() {
    const P = DF.world(), f = DF.forecastNow();
    const H = P.hist, n = H.t.length;
    const actual = H.t.map((t, i) => [t, H.packed[i]]);
    const end = T.E.SHIFT_END, t0 = n ? H.t[0] : P.t - 900;
    const series = [{ key: 'act', label: 'Packed so far', cls: 'ck', pts: actual, end: true, endLabel: fmt(P.kpi.units) }];
    const bands = [];
    if (FC && !DF.replay) {
      const s = FC.o.series, b = FC.units0;
      const pts = [[FC.at, b]].concat(s.t.map((t, i) => [FC.at + t, b + s.packed[i]]));
      series.push({ key: 'fc', label: 'Futures, mean', cls: 'c1', pts, dash: true, end: true, endLabel: `${fmt(f.p50)} P50` });
      bands.push({ cls: 'c1', label: 'Futures P10–P90', pts: [[FC.at, b, b]].concat(s.t.map((t, i) => [FC.at + t, b + s.packedLo[i], b + s.packedHi[i]])) });
    }
    series.push({ key: 'plan', label: 'Plan', cls: 'cm', pts: [[t0, planAt(t0)], [end, planAt(end)]], dash: true, end: true, endLabel: `Plan ${fmt(f.plan)}` });
    Viz.chart($('#fcChart'), { label: 'Packed units: actual and simulated futures to the end of the shift', height: 280, x: { min: t0, max: end, fmt: t => PE.clock(t), name: 'Time' }, y: { fmt: v => Viz.compact(v), unit: 'units' }, series, bands, marks: [{ x: P.t, label: 'now' }] });
    $('#fcS').textContent = FC ? `Packed units. ${FC.res.seeds} futures played from ${PE.clock(FC.at)} to 14:00 in ${(FC.res.ms / 1000).toFixed(1)} s on background workers` : 'Packed units. The first futures are being played…';
    html($('#fcNums'), [
      DF.stat(Math.round(f.prob * 100) + '%', 'Chance to hit plan', f.sim ? `from the spread of ${f.n} futures` : 'estimate from the current rate', f.prob < 0.5 ? 'bad' : f.prob < 0.8 ? 'warn' : 'ok'),
      DF.stat(fmt(f.p10), 'P10 at 14:00', '9 in 10 futures do better'),
      DF.stat(fmt(f.p50), 'P50 at 14:00', `plan ${fmt(f.plan)}`),
      DF.stat(fmt(f.p90), 'P90 at 14:00', '1 in 10 futures do better'),
      DF.stat(FC ? fmt(Object.values(FC.o.faults).length) : '—', 'Machines that fault in some future', FC && Object.values(FC.o.faults).length ? Object.values(FC.o.faults).sort((a, b) => b.p - a.p).slice(0, 2).map(x => `${esc(x.name)} ${Math.round(x.p * 100)}%`).join(' · ') : 'none in the futures')
    ].join(''));
    // remaining useful life
    const rot = P.stations.filter(s => (s.kind === 'mounter' || s.kind === 'robot' || s.kind === 'palletizer') && s.hist.vib && s.hist.vib.length > 10);
    const rul = rot.map(s => {
      const run = s.hist.vib.slice(-44).filter(v => v > 0.6).slice(-36), r = A.linreg(run, 5 / 60);
      const left = Math.max(0, 7.1 - (s.sens.vib || r.last)), sl = r.slope;
      const p50 = sl > 0.004 && r.r2 > 0.3 ? left / sl : Infinity;
      const p10 = sl > 0.004 && r.r2 > 0.3 ? left / (sl + 1.64 * r.se) : Infinity;
      return { s, vib: s.sens.vib || 0, trend: sl * 60, p50, p10 };
    }).sort((a, b) => a.p50 - b.p50);
    html($('#rul'), `<thead><tr><th>Machine</th><th class="num">Vibration</th><th class="num">Trend</th><th class="num">Life to zone D</th><th>State</th></tr></thead><tbody>${rul.map(r => `<tr><td>${link('st:' + r.s.id, r.s.name)}<small>${esc(P.lines[r.s.line].name)}</small></td><td class="num">${r.vib.toFixed(2)}<small>mm/s</small></td><td class="num">${r.trend > 0 ? '+' : ''}${r.trend.toFixed(2)}<small>per hour</small></td><td class="num">${isFinite(r.p50) ? PE.mins(r.p50 * 60) + `<small>P10 ${PE.mins(r.p10 * 60)}</small>` : '<span class="muted">No wear trend</span>'}</td><td>${DF.stChip(r.s.state)}</td></tr>`).join('')}</tbody>`);
    // orders
    const open = P.orders.filter(o => o.state === 'open' || o.state === 'loading');
    html($('#ordRisk'), open.map(o => {
      const late = o.risk || 0, slack = o.due - (o.eta || o.due);
      return `<div class="rw"><span>${link('order:' + o.id, o.id)} <span class="muted small">${esc(o.customer)} · ${fmt(o.qty)} ${o.product === 'tv' ? 'TVs' : 'phones'}</span></span><span class="v ${late > 300 ? 'neg' : ''}">${late > 60 ? PE.mins(late) + ' late' : PE.mins(Math.max(0, slack)) + ' spare'}</span>${Viz.meter(clamp((o.eta - P.t) / Math.max(60, o.due - P.t), 0, 1), late > 1800 ? 'bad' : late > 300 ? 'warn' : '')}<small>Due ${esc(PE.clock(o.due))} · ready about ${esc(PE.clock(o.eta || o.due))}</small></div>`;
    }).join('') || '<p class="empty">No open orders.</p>');
    // runway
    const bufs = Object.values(P.bufs).filter(b => (b.station || b.sm || b.id === 'RM:panel'));
    const rws = bufs.map(b => ({ b, lv: T.E.level(b), rw: b.sm ? b.rw : T.E.runway(b) })).sort((a, b) => (a.rw || 1e9) - (b.rw || 1e9)).slice(0, 10);
    html($('#runway'), `<thead><tr><th>Buffer</th><th class="num">Level</th><th class="num">Runway</th><th>Next delivery</th></tr></thead><tbody>${rws.map(({ b, lv, rw }) => `<tr><td>${link('buf:' + b.id, b.label)}<small>${esc(b.station ? P.byId[b.station].name : b.sm ? 'Supermarket' : 'Warehouse')}</small></td><td class="num">${fmt(lv)}<small>of ${fmt(b.cap)}</small></td><td class="num ${isFinite(rw) && rw < 600 ? 'neg' : ''}">${isFinite(rw) ? PE.mins(rw) : '—'}</td><td>${b.mission ? (b.mission.agv ? `${esc(b.mission.agv.id)}${b.mission.agv.fault ? ' (faulted)' : ''} · ${esc(PE.clock(b.mission.eta || P.t))}` : 'Waiting for an AGV') : b.id === 'RM:panel' ? (() => { const n = P.inbound.find(t => t.mat === 'panel' && t.state === 'due'); return n ? `Truck ${esc(n.id)} · ${esc(PE.clock(n.at))}${n.delayed ? ' (delayed)' : ''}` : 'Not booked'; })() : '<span class="muted">Above reorder point</span>'}</td></tr>`).join('')}</tbody>`);
    // demand
    const En = P.energy, k = clamp(En.proj / (En.contract * 1.15), 0, 1), left = Math.max(0, 900 - En.iSec);
    html($('#demand'), `<div class="demand-now"><p class="big">${fmt(En.proj)}<small>kW projected · contract ${fmt(En.contract)} kW</small></p>
      <div class="gauge" role="img" aria-label="Projected demand ${fmt(En.proj)} kW against a contract of ${fmt(En.contract)} kW"><i class="${En.proj > En.contract ? 'bad' : En.proj > En.contract * 0.95 ? 'warn' : ''}" style="width:${(k * 100).toFixed(1)}%"></i><em style="left:${(1 / 1.15 * 100).toFixed(1)}%"></em></div>
      <p class="muted small" style="margin:0">${PE.mins(left)} left in this interval · ${esc(En.tariff)} tariff at EGP ${En.price.toFixed(2)} per kWh · ${En.over > 0 ? `<b class="neg">${fmt(En.over)} kW over the contract today</b>` : 'no demand charge today'}</p></div>`);
  }
  DF.onView('predict', predict);
  document.addEventListener('click', e => { if (e.target.closest('#fcRun')) { DF.toast('Playing the shift forward in background workers…', 'info'); DF.runForecast(true); } });

  /* ---------------- root cause ---------------- */
  let rcSel = null;
  function rootcause() {
    const cs = A.S.cases.filter(c => c.diagnosis || (c.chain && c.chain.length));
    if (!rcSel || !A.caseById(rcSel)) rcSel = (cs.find(c => c.state !== 'closed') || cs[0] || {}).id || null;
    const rl = $('#rcList');
    if (!rl.contains(document.activeElement)) html(rl, cs.slice(0, 30).map(c => `<button type="button" class="rc-item ${c.id === rcSel ? 'sel' : ''}" data-rc="${esc(c.id)}" aria-pressed="${c.id === rcSel}"><b>${esc(c.title)}</b><span>${esc(c.id)} · ${esc(CaseUI.agentName(c.agent))} · ${esc(PE.clock(c.created))} · ${esc((CaseUI.STATE[c.state] || [c.state])[0])}</span></button>`).join('') || '<p class="empty">No diagnosed cases yet. Start a drill: the agent writes its cause path here.</p>');
    const c = rcSel && A.caseById(rcSel);
    if (!c) { html($('#rcPath'), ''); html($('#rcBody'), ''); return; }
    $('#rcPathS').textContent = c.diagnosis ? `Cause: ${c.diagnosis.cause}` : 'From the first cause to what it reaches';
    html($('#rcPath'), (c.chain || []).map((r, i) => `<li><span class="node ${i === 0 ? 'cause' : ''}" style="--i:${i}"><small>${i === 0 ? 'Cause' : 'Reaches'}</small>${link(r, DF.refName(r))}</span></li>`).join(''));
    html($('#rcBody'), `${c.diagnosis ? `<p class="cs-dtext" style="margin-top:12px">${esc(c.diagnosis.text || '')}${c.diagnosis.confidence ? ` <b>${Math.round(c.diagnosis.confidence * 100)}% confidence.</b>` : ''}</p>` : ''}
      ${CaseUI.evidence(c)}
      <section class="cs-sec"><h4>How the agent got here <small>${c.steps.length} steps</small></h4>${CaseUI.trace(c)}</section>
      <div class="cs-actions" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px"><button type="button" class="btn btn-secondary btn-sm" data-chain="${esc(c.id)}">Show on the mimic</button><button type="button" class="btn btn-secondary btn-sm" data-open-case="${esc(c.id)}">Open the case</button></div>`);
    if (typeof Theme !== 'undefined') Theme.icons($('#rcBody'));
  }
  DF.onView('rootcause', rootcause);
  function trace(sn) {
    const r = A.TOOLS.genealogy({ serial: sn });
    $('#genIn').value = sn;
    if (r.error) { html($('#genOut'), `<p class="empty">${esc(r.error)}.</p>`); return; }
    html($('#genOut'), `<div class="gen"><p><b>${esc(r.serial)}</b> · ${esc(r.model || r.type)} · started ${esc(r.born)}${r.lot ? ` · panel lot <b>${esc(r.lot)}</b>` : ''}${r.pallet ? ` · pallet ${esc(r.pallet)}` : ''}${r.order ? ` · order ${link('order:' + r.order, r.order)}` : ''}</p>
      ${Object.keys(r.parts).length ? `<p class="small muted">Parts: ${Object.entries(r.parts).map(([k, v]) => `${esc(k)} ${v ? `<button type="button" class="lnk" data-sn="${esc(v)}">${esc(v)}</button>` : '—'}`).join(' · ')}</p>` : ''}
      <ol class="steps">${r.steps.map(s => `<li class="${s.ok ? '' : 'bad'}"><time>${esc(s.at)}</time><span>${esc(s.station)}${s.by ? ` <span class="muted">· ${esc(s.by)}</span>` : ''}</span><span class="muted">${esc(s.note || (s.ok ? 'Pass' : 'Fail'))}</span></li>`).join('')}</ol></div>`);
  }
  DF.trace = trace;
  $('#genForm').addEventListener('submit', e => { e.preventDefault(); const v = $('#genIn').value.trim(); if (v) trace(v); });
  $('#genLatest').onclick = () => {
    const P = T.E.P;
    const rows = [...P.aoiLog.L1, ...P.aoiLog.L2].filter(r => !r.ok).concat(P.testLog.filter(r => !r.ok)).sort((a, b) => b.t - a.t);
    if (rows[0]) trace(rows[0].sn); else html($('#genOut'), '<p class="empty">No rejects yet this shift.</p>');
  };
  document.addEventListener('click', e => {
    const r = e.target.closest('[data-rc]'); if (r) { rcSel = r.dataset.rc; $('#rcList')._h = null; rootcause(); return; }
    const s = e.target.closest('[data-sn]'); if (s) { if (DF.view !== 'rootcause') DF.go('rootcause'); setTimeout(() => trace(s.dataset.sn), 20); }
  });

  /* ---------------- what-if lab ---------------- */
  const LAB = [
    ['Lines', 'boost:L3', 'Final Assembly A to 110%', 'More TVs, more energy, small quality risk'],
    ['Lines', 'boost:L4', 'Final Assembly B to 110%', 'More phones for the export orders'],
    ['Lines', 'slowAssembly', 'Both assembly lines to 88%', 'Stretches board stock when SMT is short'],
    ['Lines', 'switchL2', 'SMT Line 2 changeover to main boards', '4-minute changeover, then main boards'],
    ['Maintenance', 'planRepair:L1-MounterB', 'Planned bearing change on Mounter B now', 'An 8-minute stop instead of a failure later'],
    ['Maintenance', 'derate:L1-MounterB', 'Derate Mounter B to 85%', 'Slower wear, slower line'],
    ['Energy', 'stagger', 'Hold Compressor 2 and Chiller 2 for 20 min', 'Shaves the 15-minute demand peak'],
    ['Energy', 'precool', 'Pre-cool the chillers for 3 hours', 'Spends energy now to save in the heat'],
    ['Test', 'stop:L2', 'Stop SMT Line 2', 'See what a stop costs downstream']
  ];
  let branch = null;      // { snap, t, k, actual: cmds } when the time machine branches from the past
  DF.branchFrom = function (b) { branch = b; DF.go('simulator'); labForm(); };
  function labForm() {
    const fs = $('#labOpts');
    let h = '<legend>Options to compare with doing nothing (up to 3)</legend>';
    let g = '';
    if (branch) h += `<p class="grp">From the past</p><label><input type="checkbox" value="__actual" checked><span>What actually happened<small>Every command people and agents gave after ${esc(PE.clockS(branch.t))}, replayed</small></span></label>`;
    for (const [grp, id, label, sub] of LAB) { if (grp !== g) { g = grp; h += `<p class="grp">${esc(grp)}</p>`; } h += `<label><input type="checkbox" value="${esc(id)}"><span>${esc(label)}<small>${esc(sub)}</small></span></label>`; }
    fs.innerHTML = h;
    $('#labFrom').innerHTML = branch ? `From <b>${esc(PE.clockS(branch.t))}</b> in the past (time machine) · <button type="button" class="lnk" id="labLive">use the live plant</button>` : 'From the live plant, now';
  }
  labForm();
  $('#labOpts').addEventListener('change', e => {
    const on = $$('#labOpts input:checked');
    if (on.length > 3) { e.target.checked = false; DF.toast('Up to three options at a time', 'info'); }
  });
  document.addEventListener('click', e => { if (e.target.closest('#labLive')) { branch = null; labForm(); } });
  let labRes = null, labBusy = false;
  $('#labRun').onclick = async () => {
    if (labBusy) return;
    const ids = $$('#labOpts input:checked').map(x => x.value);
    if (!ids.length) { DF.toast('Choose at least one option to compare with doing nothing', 'info'); return; }
    const opts = [{ id: 'none', label: 'Do nothing', cmds: [] }].concat(ids.map(id => id === '__actual'
      ? { id: 'actual', label: 'What actually happened', cmds: branch.actual }
      : { id, label: LAB.find(x => x[1] === id)[2], cmds: [{ type: 'apply', id }] }));
    labBusy = true; $('#labRun').disabled = true; $('#labRun').lastChild.textContent = 'Playing futures…';
    $('#labOutS').textContent = `Playing ${opts.length} options × ${$('#labSeeds').value} futures…`;
    $('#view-simulator .lab-out').classList.add('busy');
    try {
      const req = { horizon: +$('#labH2').value, seeds: +$('#labSeeds').value, options: opts };
      if (branch) req.snap = structuredClone(branch.snap);
      labRes = await T.whatif(req);
      labRes.fromT = branch ? branch.t : T.E.P.t;
    } catch (err) { DF.toast('The futures could not run: ' + err.message, 'error'); }
    labBusy = false; $('#labRun').disabled = false; $('#labRun').lastChild.textContent = 'Play the futures';
    $('#view-simulator .lab-out').classList.remove('busy');
    lab();
  };
  function lab() {
    if (!labRes) return;
    const r = labRes, base = r.options.find(o => o.id === 'none');
    const cls = ['cm', 'c1', 'c2', 'c3', 'c4'];
    const H = r.horizon;
    const series = r.options.map((o, i) => ({ key: o.id, label: o.label, cls: cls[i], pts: o.series.t.map((t, j) => [t, o.series.packed[j]]), dash: o.id === 'none', end: true, endLabel: fmt(o.S.packed.mean) }));
    const bands = r.options.filter(o => o.id !== 'none').map((o, i) => ({ cls: cls[i + 1], pts: o.series.t.map((t, j) => [t, o.series.packedLo[j], o.series.packedHi[j]]) }));
    Viz.chart($('#labChart'), { label: 'Units packed in the simulated futures for each option', height: 280, x: { min: 0, max: H, fmt: t => '+' + Math.round(t / 60) + ' min', name: 'Minutes ahead' }, y: { min: 0, fmt: v => Viz.compact(v), unit: 'units' }, series, bands });
    const best = r.options.filter(o => o.id !== 'none').sort((a, b) => b.S.value.mean - a.S.value.mean)[0];
    const d = (o, k) => o.S[k].mean - base.S[k].mean;
    $('#labOutS').textContent = `${r.options.length} options × ${r.seeds} futures from ${PE.clockS(r.fromT)}, ${Math.round(H / 60)} min ahead, played in ${(r.ms / 1000).toFixed(1)} s. Lines are the mean; bands are P10–P90.`;
    const v = $('#labVerdict');
    const clear = best && best.S.value.mean - base.S.value.mean > 2500 && best.winRate >= 0.6;
    v.className = 'chip ' + (clear ? 'chip-success' : 'chip-neutral');
    v.textContent = best ? (clear ? `Best: ${best.label}` : 'No clear winner over doing nothing') : '—';
    html($('#labTable'), `<thead><tr><th>Option</th><th class="num">Value vs doing nothing</th><th class="num">Better in</th><th class="num">Packed</th><th class="num">Late</th><th class="num">Down</th><th class="num">Peak kW</th><th class="num">Energy</th></tr></thead><tbody>${r.options.map((o, i) => `<tr class="${o === best ? 'best' : ''}">
      <td><span class="vz-legend" style="margin:0"><span><i class="vz-lk ${cls[i]}${o.id === 'none' ? ' dash' : ''}"></i>${esc(o.label)}</span></span></td>
      <td class="num">${o.id === 'none' ? 'Baseline' : `${signed(o.S.value.mean - base.S.value.mean, money)}<small>P10–P90 ${signed(o.S.value.p10 - base.S.value.mean, money)} to ${signed(o.S.value.p90 - base.S.value.mean, money)}</small>`}</td>
      <td class="num">${o.id === 'none' ? '—' : Math.round(o.winRate * 100) + '%'}</td>
      <td class="num">${fmt(o.S.packed.mean)}${o.id === 'none' ? '' : `<small>${signed(d(o, 'packed'))}</small>`}</td>
      <td class="num">${fmt(o.S.lateMin.mean)} min</td><td class="num">${fmt(o.S.downMin.mean)} min</td><td class="num">${fmt(o.S.kwPeak.mean)}</td><td class="num">${money(o.S.energyCost.mean + o.S.demandCost.mean)}</td></tr>`).join('')}</tbody>`);
  }
  DF.onView('simulator', () => { lab(); });

  /* ---------------- drills ---------------- */
  const started = {};
  function drills() {
    const el = $('#scenarios'), P = T.E.P;
    if (el.contains(document.activeElement) && !el._h) return;
    html(el, T.E.SCENARIOS.map(sc => {
      const at = started[sc.id];
      const c = at != null ? A.S.cases.find(x => x.agent === sc.agent && x.created >= at - 5) : null;
      const running = c && c.state !== 'closed';
      return `<article class="card sc ${running ? 'running' : ''}">
        <div><h3>${esc(sc.title)}</h3><p class="area">${esc(sc.area)} · ${esc(CaseUI.agentName(sc.agent))}</p></div>
        <p>${esc(sc.what)}</p>
        <p class="chain"><b>Knock-on path:</b> ${esc(sc.chain)}</p>
        ${c ? `<p class="live-case">${link('case:' + c.id, c.id)} · ${esc((CaseUI.STATE[c.state] || [c.state])[0])}${c.state === 'closed' && c.outcome ? ' · ' + esc(c.outcome.verdict) : ''}</p>` : at != null ? '<p class="live-case muted">Started. The agents detect it from the plant\'s data, not from the drill.</p>' : ''}
        <button type="button" class="btn ${running ? 'btn-secondary' : 'btn-primary'} btn-sm" data-drill="${esc(sc.id)}"><span data-icon="play"></span>${at != null ? 'Run again' : 'Start drill'}</button>
      </article>`;
    }).join(''));
    if (typeof Theme !== 'undefined') Theme.icons(el);
    void P;
  }
  DF.onView('scenarios', drills);
  document.addEventListener('click', async e => {
    const d = e.target.closest('[data-drill]');
    if (d) {
      const sc = T.E.SCENARIOS.find(s => s.id === d.dataset.drill);
      started[sc.id] = T.E.P.t;
      const ok = await T.trigger(sc.id, 'You');
      DF.toast(ok ? `Drill started: ${sc.title}. Watch the ${CaseUI.agentName(sc.agent).toLowerCase()} pick it up.` : `${sc.title}: not possible right now (already running or the machine is down)`, ok ? 'info' : 'warning');
      drills(); return;
    }
    if (e.target.closest('#ff10')) { T.fastForward(600); DF.toast('Skipped 10 plant minutes', 'info'); return; }
    if (e.target.closest('#resetSim')) {
      const ok = await DF.confirm({ title: 'Start a new shift?', yes: 'New shift', html: '<p>The plant goes back to 09:12 with full buffers, and the agents\' cases and ledger are cleared in every open tab.</p>' });
      if (ok) T.reset();
    }
  });
})();
