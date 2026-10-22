/* Digital Factory — the intelligence views of the command room, on Plant EG-01: the nine AI agents and their
   decisions, predictions from the two-hour flow forecast, root cause and genealogy, the what-if lab with the
   Scheduling agent's drafts, and the nine drills. Simulated data. */
(function () {
  'use strict';
  const { $, $$, esc, icon, fmt, pct, link, toRef, stChip, tag, html } = DF;
  const mins = s => DF.E.mins(s), clock = t => DF.E.clock(t);
  const seg = (sel, fn) => $$(sel + ' .seg').forEach(b => { b.onclick = () => { $$(sel + ' .seg').forEach(x => { x.classList.toggle('active', x === b); x.setAttribute('aria-pressed', String(x === b)); }); fn(b); }; });

  /* ================= the decision dialog ================= */
  const dlg = $('#caseDlg');
  let openKey = null;
  DF.openCase = function (key) {
    const AG = DF.AG, c = AG.cards.get(key);
    openKey = key;
    if (c) { $('#caseDlgT').textContent = c.title; $('#caseDlgB').innerHTML = DF.Dec.detail(c); }
    else {
      const d = AG.decided.find(x => x.key === key);
      $('#caseDlgT').textContent = d ? d.title : 'Decision';
      $('#caseDlgB').innerHTML = d ? `<p class="cs-who">${esc(d.agent)} · ${esc(d.time)}</p><div class="cs-verify ok"><p><b>Decided</b> · ${esc(d.label)} · ${esc(d.by)} · ${esc(d.audit)}</p><p class="quiet">Forecast with this choice: ${fmt(d.packed)} TVs packed in ${Math.round(d.h / 60)} h, ${d.late} order${d.late === 1 ? '' : 's'} late.${d.recommended ? ' It was the recommended option.' : ''}</p></div>` : '<p>This decision is closed: the situation that raised it has passed.</p>';
    }
    if (typeof Theme !== 'undefined') Theme.icons($('#caseDlgB'));
    if (!dlg.open) dlg.showModal();
  };
  $('#caseDlgX').onclick = () => dlg.close();
  dlg.addEventListener('close', () => { openKey = null; });
  dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });

  /* ================= agents ================= */
  const AUT = { advise: 'Advise', approve: 'Approve', auto: 'Auto' };
  function crew() {
    const AG = DF.AG, el = $('#crew');
    if (el.contains(document.activeElement)) return;
    html(el, AG.AGENTS.map(a => {
      const wait = DF.waiting().filter(c => c.owner === a.id).length;
      const last = AG.feed.find(e => e.id === a.id);
      return `<article class="card agent ${wait ? 'waiting' : ''}"><div class="ah"><div><h3>${esc(a.name)}</h3><small>${esc(a.role)}</small></div>${wait ? tag('warn', wait + ' waiting') : ''}</div>
        <div class="seg-tabs sm" role="group" aria-label="Autonomy of the ${esc(a.name)}">${Object.keys(AUT).map(k => `<button type="button" class="seg ${a.autonomy === k ? 'active' : ''}" aria-pressed="${a.autonomy === k}" data-aut="${a.id}" data-v="${k}">${AUT[k]}</button>`).join('')}</div>
        <p class="now">${last ? `<b>${esc(last.time)}</b> ${esc(last.text)}` : 'Watching. Nothing to report.'}</p>
        <div class="rec"><div><b>${fmt(a.signals)}</b>signals</div><div><b>${fmt(a.acted)}</b>acted alone</div><div><b>${AUT[a.autonomy]}</b>autonomy</div></div></article>`;
    }).join(''));
  }
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-aut]'); if (!b) return;
    DF.AG.setAutonomy(b.dataset.aut, b.dataset.v);
    DF.toast(`${DF.AG.AGENTS.find(a => a.id === b.dataset.aut).name}: ${AUT[b.dataset.v]}. Logged.`, 'info');
    b.blur(); crew();
  });
  function board() {
    const AG = DF.AG, el = $('#board');
    const w = DF.waiting(), done = [...AG.cards.values()].filter(c => c.decided);
    $('#boardN').textContent = w.length;
    if (el.contains(document.activeElement) && document.activeElement.closest('.cs-btns')) return;
    html(el, w.length || done.length ? w.map(c => DF.Dec.card(c, { decide: true })).concat(done.map(c => DF.Dec.card(c))).join('') : '<p class="empty">No decision open. Start a drill and watch an agent detect it, simulate the options and recommend one.</p>');
    if (typeof Theme !== 'undefined') Theme.icons(el);
  }
  function feed() {
    html($('#agentFeed'), DF.AG.feed.slice(0, 40).map(e => `<li class="${esc(e.level)}"><time>${esc(e.time)}</time><span class="src">${esc(e.agent.replace(' agent', ''))}</span><span>${esc(e.text)}${e.ref ? ' ' + link(toRef(e.ref), '›') : ''}</span></li>`).join('') || '<li><span></span><span></span><span class="muted">The crew has not said anything yet.</span></li>');
  }
  function ledger() {
    const D = DF.AG.decided;
    html($('#ledger'), `<thead><tr><th>Time</th><th>Decision</th><th>Chosen</th><th>By</th><th class="num">Forecast</th><th>Audit</th></tr></thead><tbody>${D.map(d => `<tr><td class="num">${esc(d.time)}</td><td>${esc(d.title)}<small>${esc(d.agent)}</small></td><td>${esc(d.label)}${d.recommended ? '<small>recommended</small>' : '<small>not the recommendation</small>'}</td><td>${esc(d.by)}</td><td class="num">${fmt(d.packed)}<small>TVs · ${d.late} late</small></td><td class="num">${esc(d.audit)}</td></tr>`).join('') || '<tr><td colspan="6" class="muted">Nothing decided yet.</td></tr>'}</tbody>`);
  }
  const ASKS = ['Shift summary', 'Why is line 3 slow?', 'Which orders are at risk?', 'Material shortages', 'OEE by line', 'Energy peak', 'Safety events'];
  html($('#askChips'), ASKS.map(q => `<button type="button" class="btn btn-secondary btn-sm" data-askq="${esc(q)}">${esc(q)}</button>`).join(''));
  function ask(q) {
    const r = DF.AG.ask(q);
    html($('#askOut'), `<p class="ask-out"><b>${esc(q)}</b><br>${esc(r.text)}</p>${r.refs && r.refs.length ? `<p class="small">${r.refs.map(x => link(toRef(x))).join(' · ')}</p>` : ''}`);
  }
  $('#askForm').addEventListener('submit', e => { e.preventDefault(); const q = $('#askIn').value.trim(); if (q) ask(q); });
  document.addEventListener('click', e => { const b = e.target.closest('[data-askq]'); if (b) { $('#askIn').value = b.dataset.askq; ask(b.dataset.askq); } });
  function incidents() {
    html($('#incidentsList'), DF.AG.incidents.map(i => `<li class="warn"><time>${esc(i.time)}</time><span class="src">${esc(i.cam || 'Camera')}</span><span>${esc(i.text)}</span></li>`).join('') || '<li><span></span><span></span><span class="muted">No safety event from the cameras. The vision runs in the 3D plant.</span></li>');
  }
  DF.onView('agents', () => {
    crew(); board(); feed(); ledger(); incidents();
    if (openKey && dlg.open && !dlg.contains(document.activeElement)) DF.openCase(openKey);
  });

  /* ================= predictions ================= */
  function predict(force) {
    const P = DF.P, AG = DF.AG, k = P.kpi, M = DF.E.MODELS;
    const f = force === 'run' ? AG.forecast() : AG.base || AG.forecast();
    const planRate = Object.values(P.lines).filter(L => L.kind === 'main').reduce((a, L) => a + 3600 / M[L.model].takt * 0.82, 0);
    const step = f.h / f.curve.length;
    const fc = [[0, k.units]].concat(f.curve.map((v, i) => [(i + 1) * step, k.units + v]));
    const plan = [[0, k.plan], [f.h, k.plan + planRate * f.h / 60]];
    Viz.chart($('#fcChart'), { height: 260, label: 'TVs packed this shift: forecast and plan for the next two hours', x: { min: 0, max: f.h, fmt: v => clock(P.t + v * 60), name: 'Time' }, y: { fmt: v => Viz.compact(v), unit: 'TVs' },
      series: [{ label: 'Forecast', cls: 'c1', pts: fc, end: true, endLabel: fmt(fc[fc.length - 1][1]) }, { label: 'Plan', cls: 'c3', dash: true, pts: plan, end: true, endLabel: 'plan ' + fmt(plan[1][1]) }] });
    html($('#fcNums'), [[fmt(f.packed), 'TVs in the next 2 h', `plan pace ${fmt(planRate * 2)}`], [fmt(k.fcst), `Forecast at ${clock(k.shiftEnd || 14 * 3600)}`, `plan ${fmt(k.planEnd)}`], [Math.round((k.prob || 0) * 100) + '%', 'Chance to hit plan', `forecast against the ${clock(k.shiftEnd || 14 * 3600)} plan`], [fmt(f.late), 'Orders short', f.late ? f.lateList.join(', ') : 'every truck covered'], [fmt(f.starvedMin), 'Minutes short of material', 'summed over the models']].map(([v, l, s]) => `<div class="stat"><b>${esc(v)}</b><span>${esc(l)}</span><small>${esc(s)}</small></div>`).join(''));
    $('#fcS').textContent = `TVs packed on the six main lines. Flow forecast run at ${clock(P.t)}; ${fmt(AG.stats.simulated)} forecasts so far today.`;
    // remaining useful life
    const wear = P.stations.filter(s => s.degrade > 0 && s.state !== 'down').map(s => ({ s, rul: (s.health - 22) / s.degrade })).sort((a, b) => a.rul - b.rul);
    const low = P.stations.filter(s => !(s.degrade > 0)).sort((a, b) => a.health - b.health).slice(0, Math.max(0, 5 - wear.length));
    html($('#rul'), `<thead><tr><th>Machine</th><th class="num">Health</th><th class="num">Vibration</th><th class="num">Fails in</th><th>Plan</th></tr></thead><tbody>${wear.map(({ s, rul }) => `<tr><td>${link('st:' + s.id, s.name)}<small>${esc(P.lines[s.line].name)}</small></td><td class="num">${Math.round(s.health)}</td><td class="num">${s.sens.vib != null ? s.sens.vib.toFixed(1) + ' mm/s' : '—'}</td><td class="num ${rul < 1200 ? 'bad' : 'warn'}">${esc(mins(rul))}</td><td>${s.planned ? tag('', 'Repair planned') : tag('warn', 'Not planned')}</td></tr>`).concat(low.map(s => `<tr><td>${link('st:' + s.id, s.name)}<small>${esc(P.lines[s.line] ? P.lines[s.line].name : '')}</small></td><td class="num">${Math.round(s.health)}</td><td class="num">${s.sens.vib != null ? s.sens.vib.toFixed(1) + ' mm/s' : '—'}</td><td class="num">no trend</td><td>${tag('', 'Watch')}</td></tr>`)).join('')}</tbody>`);
    // orders
    const open = P.orders.filter(o => (o.state === 'open' || o.state === 'loading') && o.due - P.t < f.h * 60).sort((a, b) => a.due - b.due);
    html($('#ordRisk'), open.length ? open.slice(0, 8).map(o => { const r = f.lateList.includes(o.id); return `<div class="rw ${r ? 'bad' : ''}"><span>${link('order:' + o.id, o.id)} · ${fmt(o.qty)} × ${esc(M[o.model].name)}</span><span class="v">${r ? 'short' : 'covered'}</span><small>${esc(o.customer)} · due ${esc(clock(o.due))}${o.truck ? ` · ${fmt(o.truck.loaded)} of ${fmt(o.truck.need)} loaded at ${esc(o.truck.dock.id)}` : ''}</small></div>`; }).join('') : '<p class="empty">No truck due in the next two hours.</p>');
    // runway
    const rows = Object.values(DF.E.LS).filter(b => b.feed !== 'conveyor').map(b => ({ b, rw: DF.E.runway(b) })).filter(x => isFinite(x.rw)).sort((a, b) => a.rw - b.rw).slice(0, 10);
    html($('#runway'), `<thead><tr><th>Material</th><th class="num">On hand</th><th class="num">Lasts</th><th>Next delivery</th></tr></thead><tbody>${rows.map(({ b, rw }) => `<tr><td>${link('buf:' + b.id, b.code)}<small>${esc(P.byId[b.station].name)} · ${esc(P.lines[b.line].name)}</small></td><td class="num">${fmt(DF.E.level(b))}</td><td class="num ${rw < 600 ? 'bad' : rw < 1200 ? 'warn' : ''}">${esc(mins(rw))}</td><td>${b.mission ? (b.mission.veh ? `${esc(b.mission.veh.id)} on its way` : 'AGV requested') : b.pending ? `${fmt(b.pending)} on the next lap` : b.feed === 'agv' ? 'AGV at reorder point' : 'milk run ' + esc(b.feed)}</td></tr>`).join('')}</tbody>`);
    // power
    const E = AG.energy;
    html($('#demand'), `<div class="demand-now"><p class="big">${fmt(E.avg)}<small>kW · 15-minute average</small></p>
      <div class="gauge" aria-hidden="true"><i class="${E.peak > 4000 ? 'bad' : E.peak > 3900 ? 'warn' : ''}" style="width:${Math.min(100, E.avg / 45).toFixed(1)}%"></i><em style="left:${(4000 / 45).toFixed(1)}%"></em></div>
      <p class="small">Forecast peak <b>${fmt(E.peak)} kW</b> against the 4,000 kW contract. ${P.shave && P.t < P.shave.until ? `Peak shaving on until ${esc(clock(P.shave.until))}.` : E.peak > 3960 ? 'The Energy agent will shave it with utilities only.' : 'No action needed.'}</p></div>`);
  }
  $('#fcRun').onclick = () => { predict('run'); DF.toast('Forecast run on the live plant.', 'info'); };
  DF.onView('predict', predict);

  /* ================= root cause and genealogy ================= */
  const CHAIN = { rul: 'bearing', shot: 'shortshot', coat: 'coating', sw: 'software', 'erp.oc65': 'container', 'erp.ctn55': 'carton', absent: 'absent', 'erp.field': 'field' };
  let rcSel = null;
  function problems() {
    const P = DF.P, X = DF.X, out = [];
    for (const r of P.recs) out.push({ id: 'rec:' + r.key, title: r.title, sub: `${r.agent} agent · ${r.time}`, r });
    for (const n of X.ncr.filter(n => n.step < 7)) out.push({ id: 'ncr:' + n.id, title: `${n.id} · ${n.code}`, sub: `${X.D8[n.step]} · ${n.count} defect${n.count === 1 ? '' : 's'}`, n });
    for (const s of P.stations.filter(s => s.state === 'down')) out.push({ id: 'st:' + s.id, title: `${s.name} stopped`, sub: `${P.lines[s.line] ? P.lines[s.line].name : ''} · ${s.why || ''}`, s });
    if (P.alarms.some(a => a.key === 'GRID.DIP')) out.push({ id: 'grid', title: 'Grid voltage dip', sub: 'Utilities · SMD lines and coating ovens tripped', sc: 'power' });
    return out;
  }
  function rootcause() {
    const P = DF.P, X = DF.X, list = problems();
    if (!list.find(x => x.id === rcSel)) rcSel = list[0] ? list[0].id : null;
    const el = $('#rcList');
    if (!el.contains(document.activeElement)) html(el, list.length ? list.map(x => `<button type="button" class="rc-item ${x.id === rcSel ? 'sel' : ''}" data-rc="${esc(x.id)}" aria-pressed="${x.id === rcSel}"><b>${esc(x.title)}</b><span>${esc(x.sub)}</span></button>`).join('') : '<p class="empty">No open problem. Start a drill to see a cause traced through the plant.</p>');
    const it = list.find(x => x.id === rcSel);
    if (!it) { html($('#rcPath'), ''); html($('#rcBody'), ''); return; }
    let nodes = [], body = '';
    const scId = it.sc || (it.r && CHAIN[it.r.key.split(':')[0]]) || (it.n && it.n.scen);
    const sc = scId && DF.E.SCENARIOS.find(s => s.id === scId);
    if (sc) nodes = sc.chain.split(' → ').map((t, i) => ({ t, ref: i === 0 && it.r ? toRef(it.r.ref) : null }));
    else if (it.r) {
      const ref = toRef(it.r.ref), b = P.bufs[it.r.ref];
      if (b && b.station) nodes = [{ t: b.code + ' at ' + P.byId[b.station].name, ref }, { t: P.lines[b.line].name, ref: 'line:' + b.line }, { t: 'TVs packed' }, { t: 'Orders' }];
      else if (b) nodes = [{ t: b.label || b.code, ref }, { t: 'Main lines using it' }, { t: 'Orders' }];
      else { const s = P.byId[it.r.ref]; nodes = [{ t: s ? s.name : it.r.title, ref }, s && P.lines[s.line] ? { t: P.lines[s.line].name, ref: 'line:' + s.line } : null, { t: 'TVs packed' }, { t: 'Orders' }].filter(Boolean); }
    } else if (it.n) { const s = P.byId[it.n.ref]; nodes = [{ t: it.n.code }, s ? { t: s.name, ref: 'st:' + s.id } : null, it.n.line && P.lines[it.n.line] ? { t: P.lines[it.n.line].name, ref: 'line:' + it.n.line } : null, { t: 'Rework and final QA' }].filter(Boolean); }
    else if (it.s) { const s = it.s, L = P.lines[s.line]; nodes = [{ t: s.name, ref: 'st:' + s.id }, L ? { t: L.name, ref: 'line:' + L.id } : null, L && L.kind !== 'main' ? { t: 'Main lines it feeds' } : null, { t: 'TVs packed' }].filter(Boolean); }
    html($('#rcPath'), nodes.map((n, i) => `<li><span class="node ${i === 0 ? 'cause' : ''}" style="--i:${i}"><small>${i === 0 ? 'First cause' : 'Step ' + (i + 1)}</small>${n.ref ? link(n.ref, n.t) : `<b>${esc(n.t)}</b>`}</span></li>`).join(''));
    $('#rcPathS').textContent = sc ? `${sc.title} · ${sc.area}` : 'From the first cause to what it reaches';
    if (it.r) { const c = DF.AG.cards.get(it.r.key); body = `<p class="small">${esc(it.r.body || '')}</p>${c ? `<p class="small">${esc(c.agentName)} recommends <b>${esc(c.best.label)}</b>. ${link('card:' + c.key, 'Open the decision')}</p>` : ''}`; }
    else if (it.n) body = DF.kv([['Owner', esc(it.n.owner)], ['Step', esc(X.D8[it.n.step])], ['Cause', esc(it.n.cause)], ['Action', esc(it.n.action)], ['Defects', fmt(it.n.count)], ['Opened', esc(clock(it.n.opened))]]);
    else if (it.s) body = DF.kv([['State', stChip(it.s.state, it.s.why)], ['Technician', it.s.tech ? esc(it.s.tech.name) : 'not yet'], ['Repair left', it.s.repair > 0 ? esc(mins(it.s.repair)) : '—']]);
    else if (sc) body = `<p class="small">${esc(sc.what)}</p>`;
    html($('#rcBody'), body);
  }
  document.addEventListener('click', e => { const b = e.target.closest('[data-rc]'); if (b) { rcSel = b.dataset.rc; rootcause(); } });
  const PART = { smps: 'Power board', bc: 'Back cover', chs: 'Chassis', std: 'Stand', cus: 'Cushion', ctn: 'Carton', acc: 'Accessories', oc: 'Open cell', blu: 'Backlight', pcb: 'Bare PCB' };
  DF.trace = function (sn) {
    const P = DF.P, M = DF.E.MODELS, u = DF.E.findUnit(sn);
    $('#genIn').value = sn;
    if (!u) { html($('#genOut'), `<p class="empty">No TV, module or board with serial ${esc(sn)} in today's records.</p>`); return; }
    const name = u.type === 'tv' ? 'TV' : u.type === 'lcm' ? 'Panel module (LCM)' : 'Main board (PBA)';
    const sub = p => (p ? `<li><span>${link('unit:' + p.sn, p.sn)}</span><span>${p.type === 'pba' ? `Main board · ${esc(P.lines[p.line] ? P.lines[p.line].name : p.line)} · firmware ${esc(p.sw || '—')}` : `Panel module · ${esc(P.lines[p.line] ? P.lines[p.line].name : '')}`}</span></li>` : '');
    const lots = Object.entries(u.lots || {}).map(([k, l]) => `<li><span>${esc(PART[k] || k)}</span><span>lot ${esc(l)}${P.holds.has(l) ? ' · <b class="neg">on hold</b>' : ''}</span></li>`).join('');
    html($('#genOut'), `<div class="gen"><h3 class="h4">${esc(name)} ${esc(u.sn)}</h3><p class="small muted">${esc(M[u.model] ? M[u.model].name : '')} · started ${esc(clock(u.born))}${u.order ? ` · order ${link('order:' + u.order, u.order)}` : ''}${u.usedIn ? ` · built into ${link('unit:' + u.usedIn, u.usedIn)}` : ''}</p>
      ${u.defect ? `<p>${tag('bad', u.defect.code)} found at ${P.byId[u.defect.at] ? link('st:' + u.defect.at, P.byId[u.defect.at].name) : esc(u.defect.at)} · ${esc(u.defect.cause || '')}</p>` : ''}
      <ol class="steps">${u.steps.map(s => `<li class="${s.ok === false ? 'bad' : ''}"><time>${esc(clock(s.t0))}</time><span>${P.byId[s.st] ? link('st:' + s.st, s.name) : esc(s.name)}${s.note ? ` <small class="muted">· ${esc(s.note)}</small>` : ''}</span><span class="muted small">${s.t1 ? Math.max(1, Math.round(s.t1 - s.t0)) + ' s' : 'now'}</span></li>`).join('')}</ol>
      ${u.parts && (u.parts.lcm || u.parts.pba) ? `<h4 class="sub-h">Sub-assemblies</h4><ul class="list plain">${sub(u.parts.lcm)}${sub(u.parts.pba)}</ul>` : ''}
      ${lots ? `<h4 class="sub-h">Material lots</h4><ul class="list plain">${lots}</ul>` : ''}</div>`);
  };
  $('#genForm').addEventListener('submit', e => { e.preventDefault(); const v = $('#genIn').value.trim(); if (v) DF.trace(v); });
  $('#genLatest').onclick = () => { const P = DF.P; for (let i = P.archiveOrder.length - 1; i >= 0; i--) { const u = P.archive.get(P.archiveOrder[i]); if (u && u.type === 'tv') return DF.trace(u.sn); } const u = [...P.units].reverse().find(x => x.type === 'tv'); if (u) DF.trace(u.sn); };
  $('#genReject').onclick = () => { const r = DF.P.rejects.rework[DF.P.rejects.rework.length - 1]; if (r) DF.trace(r.u.sn); else html($('#genOut'), '<p class="empty">No reject yet this shift.</p>'); };
  DF.onView('rootcause', rootcause);

  /* ================= what-if lab ================= */
  function labOptions() {
    const P = DF.P, M = DF.E.MODELS, mains = Object.values(P.lines).filter(L => L.kind === 'main');
    const D = DF.AG.drafts(), tgt = D.target;
    const o = [];
    for (const L of mains) if (L.speed < 1.08) o.push({ id: 'boost:' + L.id, grp: 'Speed', label: `${L.name} to 108%`, sub: `${M[L.model].name} · a little more output, a few more short stops`, mods: { rate: [{ id: L.id, k: 1.08 }] }, run: () => DF.E.apply('boost:' + L.id, 'You') });
    for (const L of mains) if (L.model !== tgt) o.push({ id: 'co:' + L.id, grp: 'Changeover', label: `${L.name} to ${M[tgt].name}`, sub: `from ${M[L.model].name} · 15 minutes · ${M[tgt].name} has the least cover`, mods: { co: [{ id: L.id, at: 0, dur: 15, model: tgt }] }, run: () => DF.E.changeover(+L.id.slice(2), tgt, 'You') });
    const wear = P.stations.filter(s => s.degrade > 0 && !s.planned && s.state !== 'down');
    if (wear.length) o.push({ id: 'fix', grp: 'Maintenance', label: 'Repair the wearing machines now', sub: wear.map(s => s.name).join(', ') + ' · 8 minutes each', mods: { noFail: [...new Set(wear.map(s => P.lines[s.line].kind === 'lcm' ? 'ML' + s.line.slice(3) : s.line))], down: wear.map(s => ({ id: P.lines[s.line].kind === 'lcm' ? 'ML' + s.line.slice(3) : s.line, at: 0, dur: 8 })) } });
    o.push({ id: 'smd4', grp: 'What if it breaks', label: 'SMD line 4 stops for 35 minutes', sub: 'a mounter failure: no PBA boards from it', mods: { down: [{ id: 'SMD4', at: 0, dur: 35 }] } });
    o.push({ id: 'im10', grp: 'What if it breaks', label: 'IM10 stops for 40 minutes', sub: 'a mould change on a 65" back-cover machine', mods: { down: [{ id: 'IM10', at: 0, dur: 40 }] } });
    o.push({ id: 'pr4', grp: 'What if it breaks', label: 'Press line 4 stops for 30 minutes', sub: 'no 65" chassis sets', mods: { down: [{ id: 'PR4', at: 0, dur: 30 }] } });
    o.push({ id: 'staff3', grp: 'What if it breaks', label: 'Main line 3 short of 8 operators', sub: 'manual stations at about 65%', mods: { rate: [{ id: 'ML3', k: 0.65 }] } });
    return o;
  }
  let labList = [], labRes = null;
  function labBuild() {
    const fs = $('#labOpts'), was = new Set($$('#labOpts input:checked').map(i => i.value));
    labList = labOptions();
    let grp = '', h = '<legend>Compare with the live plan (up to 3)</legend>';
    for (const op of labList) { if (op.grp !== grp) { grp = op.grp; h += `<p class="grp">${esc(grp)}</p>`; } h += `<label><input type="checkbox" value="${esc(op.id)}" ${was.has(op.id) ? 'checked' : ''}><span>${esc(op.label)}<small>${esc(op.sub)}</small></span></label>`; }
    fs.innerHTML = h;
    $('#labFrom').textContent = `From the live plant at ${clock(DF.P.t)}`;
  }
  $('#labOpts').addEventListener('change', e => {
    const on = $$('#labOpts input:checked');
    if (on.length > 3) { e.target.checked = false; DF.toast('Up to three options at a time.', 'info'); }
  });
  function labRun() {
    const ids = $$('#labOpts input:checked').map(i => i.value);
    if (!ids.length) { DF.toast('Choose at least one option to compare.', 'info'); return; }
    const h = +$('#labH2').value, S = DF.AG.snapshot(h);
    const live = { id: 'live', label: 'Live plan', f: DF.AG.forecast({}, S) };
    const ops = ids.map(id => labList.find(o => o.id === id)).filter(Boolean).map(o => Object.assign({}, o, { f: DF.AG.forecast(o.mods, S) }));
    labRes = { live, ops, h, at: DF.P.t };
    labShow();
  }
  function labShow() {
    if (!labRes) return;
    const { live, ops, h } = labRes, all = [live].concat(ops), P = DF.P;
    const best = ops.slice().sort((a, b) => (b.f.packed - b.f.late * 300) - (a.f.packed - a.f.late * 300))[0];
    const step = h / live.f.curve.length;
    Viz.chart($('#labChart'), { height: 260, label: 'TVs packed in the forecast, per option', x: { min: 0, max: h, fmt: v => clock(labRes.at + v * 60), name: 'Time' }, y: { min: 0, unit: 'TVs' },
      series: all.map((o, i) => ({ label: o.label, cls: o === live ? 'c4' : 'c' + Math.min(3, i), dash: o === live, pts: [[0, 0]].concat(o.f.curve.map((v, j) => [(j + 1) * step, v])), end: true, endLabel: fmt(o.f.packed) })) });
    html($('#labTable'), `<thead><tr><th>Option</th><th class="num">TVs packed</th><th class="num">vs live</th><th class="num">Late orders</th><th class="num">Revenue delayed</th><th class="num">Short of material</th><th><span class="sr-only">Apply</span></th></tr></thead><tbody>${all.map(o => { const d = o.f.packed - live.f.packed; return `<tr class="${o === best ? 'best' : ''}"><td>${esc(o.label)}</td><td class="num">${fmt(o.f.packed)}</td><td class="num ${d > 0 ? 'pos' : d < 0 ? 'neg' : ''}">${o === live ? '—' : (d > 0 ? '+' : '') + fmt(d)}</td><td class="num">${o.f.late}</td><td class="num">${esc(DF.X.egp(o.f.revDelayed))}</td><td class="num">${fmt(o.f.starvedMin)} min</td><td>${o.run ? `<button type="button" class="btn btn-secondary btn-sm" data-labgo="${esc(o.id)}">Apply</button>` : ''}</td></tr>`; }).join('')}</tbody>`);
    const d = best.f.packed - live.f.packed;
    $('#labVerdict').textContent = best.run ? `Best: ${best.label}` : d < 0 ? `Worst case costs ${fmt(-d)} TVs` : `Best: ${best.label}`;
    $('#labOutS').textContent = `${all.length} forecasts over ${h / 60} h from ${clock(labRes.at)}${P.t - labRes.at > 120 ? ' · the plant has moved on, simulate again' : ''}`;
  }
  $('#labRun').onclick = labRun;
  document.addEventListener('click', async e => {
    const b = e.target.closest('[data-labgo]'); if (!b || !labRes) return;
    const o = labRes.ops.find(x => x.id === b.dataset.labgo); if (!o || !o.run) return;
    if (await DF.confirm({ title: o.label, html: `<p>Forecast with it: <b>${fmt(o.f.packed)}</b> TVs in ${labRes.h / 60} h against ${fmt(labRes.live.f.packed)} on the live plan, ${o.f.late} late order${o.f.late === 1 ? '' : 's'}. It goes to the audit trail with your name.</p>`, yes: 'Apply' })) {
      o.run(); DF.toast(`${o.label}: done. Logged as ${DF.P.audit[0].id}.`, 'success'); labBuild(); DF.refresh(true);
    }
  });
  function drafts(force) {
    const D = DF.AG.drafts(force), M = DF.E.MODELS;
    $('#draftS').textContent = `${M[D.target].name} has the least cover against the orders due. Simulated over ${D.h / 60} hours at ${clock(D.at)}. Only a person publishes a draft.`;
    const live = D.list[0];
    html($('#drafts'), `<thead><tr><th>Draft</th><th class="num">TVs in 4 h</th><th class="num">vs live</th><th class="num">Late orders</th><th class="num">Cost</th><th><span class="sr-only">Publish</span></th></tr></thead><tbody>${D.list.map(d => `<tr class="${d === D.best ? 'best' : ''}"><td>${esc(d.name)}${d === D.best ? ' <b class="pos">· best</b>' : ''}<small>${esc(d.note)}</small></td><td class="num">${fmt(d.f.packed)}</td><td class="num">${d === live ? '—' : (d.f.packed >= live.f.packed ? '+' : '') + fmt(d.f.packed - live.f.packed)}</td><td class="num">${d.f.late}</td><td class="num">${esc(DF.X.egp(d.cost))}</td><td>${d.id === 'live' ? '' : `<button type="button" class="btn btn-secondary btn-sm" data-publish="${esc(d.id)}">Publish</button>`}</td></tr>`).join('')}</tbody>`);
  }
  $('#draftRun').onclick = () => drafts(true);
  document.addEventListener('click', async e => {
    const b = e.target.closest('[data-publish]'); if (!b) return;
    const D = DF.AG.drafts(), d = D.list.find(x => x.id === b.dataset.publish); if (!d) return;
    if (await DF.confirm({ title: `Publish ${d.name}`, html: `<p>${esc(d.note)}. Forecast: <b>${fmt(d.f.packed)}</b> TVs in 4 h, ${d.f.late} late (live plan: ${fmt(D.list[0].f.packed)}, ${D.list[0].f.late} late). The lines change now.</p>`, yes: 'Publish' })) {
      const au = DF.AG.publish(d.id, 'You'); DF.toast(`${d.name} is the live plan. Logged as ${au.id}.`, 'success'); drafts(true); labBuild(); DF.refresh(true);
    }
  });
  DF.onView('simulator', force => {
    if (force || !$('#labOpts input')) labBuild();
    // the first visit compares two ready-made options, so the page never opens empty
    if (!labRes) { const pre = [labList.find(o => o.grp === 'Speed'), labList.find(o => o.id === 'smd4')].filter(Boolean); pre.forEach(o => { const i = $(`#labOpts input[value="${CSS.escape(o.id)}"]`); if (i) i.checked = true; }); labRun(); }
    if (force) drafts(); else if (labRes) labShow();
  });

  /* ================= drills ================= */
  const TARGET = { bearing: 'st:SMD4-MounterB', shortshot: 'st:IM10', coating: 'st:PR4-Coating', software: 'st:SMD1-SWdownload', container: 'buf:IMP:OC-65', carton: 'buf:LOC:CTN-55', absent: 'line:ML3', field: 'buf:SVC:PBA-55', power: 'util:UTIL-TX1' };
  const started = {};
  function scenarios() {
    const el = $('#scenarios'); if (el.contains(document.activeElement)) return;
    html(el, DF.E.SCENARIOS.map(s => {
      const on = started[s.id], dec = DF.P.recs.find(r => CHAIN[r.key.split(':')[0]] === s.id || (s.id === 'power' && r.ref === 'UTIL-TX1'));
      return `<article class="card sc ${on ? 'running' : ''}"><div><h3>${esc(s.title)}</h3><p class="area">${esc(s.area)} · ${esc(s.agent)} agent</p></div><p>${esc(s.what)}</p><p class="chain"><b>Chain:</b> ${esc(s.chain)}</p>
        ${on ? `<p class="live-case">Started ${esc(clock(on))} · watch ${link(TARGET[s.id])}${dec ? ` · ${link('card:' + dec.key, 'decision waiting')}` : ''}</p>` : ''}
        <button type="button" class="btn ${on ? 'btn-secondary' : 'btn-primary'}" data-drill="${esc(s.id)}"><span data-icon="play"></span>${on ? 'Run again' : 'Start drill'}</button></article>`;
    }).join(''));
    if (typeof Theme !== 'undefined') Theme.icons(el);
  }
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-drill]'); if (!b) return;
    const s = DF.E.SCENARIOS.find(x => x.id === b.dataset.drill);
    DF.E.trigger(s.id); started[s.id] = DF.P.t;
    DF.toast(`Drill started: ${s.title}. The agents will pick it up within a minute.`, 'info');
    scenarios();
  });
  $('#ff10').onclick = () => { DF.E.fastForward(600); DF.toast('Skipped 10 plant minutes.', 'info'); DF.refresh(true); };
  DF.startedDrills = started;
  DF.onView('scenarios', scenarios);
})();
