/* Digital Factory — intelligence views: AI agents, audit trail, alarms, predictions, root cause, scenarios, control. */
(function () {
  'use strict';
  const { $, $$, fmt, pct, money, esc, icon, P } = DF;
  const STATUS = { watching: ['Watching', 'chip-success'], thinking: ['Thinking', 'chip-info'], waiting: ['Needs approval', 'chip-warning'], acting: ['Acting now', 'chip-info'] };
  const AUT = [['advise', 'Advise'], ['approve', 'Approve'], ['auto', 'Auto']];

  /* ---------------- agents ---------------- */
  DF.renderAgents = function () {
    $('#agents').innerHTML = Sim.state.agents.map(a => {
      const [lbl, chip] = STATUS[a.status];
      return `<div class="card agent ${a.status}">
        <div class="ah"><div><b>${esc(a.name)}</b><small>${esc(a.scope)}</small></div><span class="chip ${chip}">${lbl}</span></div>
        <div class="seg-tabs sm" role="group" aria-label="Autonomy for ${esc(a.name)}">${AUT.map(([k, l]) => `<button type="button" class="seg ${a.autonomy === k ? 'active' : ''}" aria-pressed="${a.autonomy === k}" data-aut="${k}" data-agent="${a.id}" ${a.locked && k !== 'auto' ? 'disabled title="Safety actions are always automatic"' : ''}>${l}</button>`).join('')}</div>
        <div class="thoughts" aria-label="What the agent is thinking">${a.log.map(l => `<div><time>${l.time}</time>${esc(l.text)}</div>`).join('')}</div>
        <div class="stats"><span>Actions today <b>${a.actions}</b></span><span>Value <b>${money(a.value)}</b></span>${a.locked ? '<span class="chip chip-neutral">Always on</span>' : ''}</div>
      </div>`;
    }).join('');
  };
  $('#agents').addEventListener('click', e => {
    const b = e.target.closest('[data-aut]'); if (!b || b.disabled) return;
    Sim.setAutonomy(b.dataset.agent, b.dataset.aut);
    DF.toast(`${Sim.agent(b.dataset.agent).name}: ${b.textContent} mode`, 'info');
  });
  DF.renderAudit = function () {
    const rows = Sim.state.audit;
    const html = `<tr><th>Time</th><th>Who</th><th>Action</th><th>Detail</th></tr>` + (rows.length ? rows.map(r => `<tr><td class="num">${r.time}</td><td><span class="chip ${r.who === 'You' ? 'chip-neutral' : 'chip-info'}">${esc(r.who)}</span></td><td><b>${esc(r.action)}</b></td><td class="muted">${esc(r.detail)}</td></tr>`).join('') : `<tr><td colspan="4" class="muted">No actions yet. Run a scenario or change a setting.</td></tr>`);
    $('#audit').innerHTML = html;
    $('#audit2').innerHTML = html;
  };

  /* ---------------- alarms ---------------- */
  let filter = 'all';
  $('#alarmFilter').addEventListener('click', e => {
    const b = e.target.closest('.seg'); if (!b) return;
    filter = b.dataset.f;
    $$('#alarmFilter .seg').forEach(s => { s.classList.toggle('active', s === b); s.setAttribute('aria-pressed', s === b); });
    DF.renderAlarms();
  });
  $('#ackAll').onclick = () => Sim.ackAll();
  DF.renderAlarms = function () {
    const S = Sim.state;
    const open = S.alarms.filter(a => a.state !== 'cleared');
    $('#aActive').textContent = open.length;
    $('#aUnack').textContent = `${open.filter(a => a.state === 'active').length} not acknowledged`;
    const inc = S.incidents.filter(i => i.open);
    $('#aInc').textContent = inc.length;
    const grouped = inc.reduce((a, i) => a + i.members.length + 1, 0);
    $('#aIncS').textContent = grouped ? `${grouped} alarms → ${inc.length} root cause${inc.length > 1 ? 's' : ''}` : 'alarms grouped by root cause';
    $('#aSupp').textContent = S.alarmStats.suppressed + S.incidents.reduce((a, i) => a + i.members.length, 0);
    $('#aRaised').textContent = S.alarmStats.raised;
    $('#incidents').innerHTML = S.incidents.length ? S.incidents.map(i => `
      <div class="inc ${i.open ? 'open' : ''}">
        <div class="ih"><div><b>${esc(i.title)}</b><div class="small muted">${i.time}${i.closed ? ' – ' + i.closed : ''} · ${i.open ? 'open' : 'resolved'}</div></div><div class="n">${i.members.length + 1}</div></div>
        <p><b>Root cause (${Math.round(i.confidence * 100)}% confidence):</b> ${esc(i.cause)}</p>
        <div class="flow"><span class="chip chip-danger">${i.members.length + 1} alarms</span>${icon('arrowRight')}<span class="chip chip-info">1 incident</span>${icon('arrowRight')}<span class="chip chip-success">1 action</span></div>
      </div>`).join('') : '<div class="empty-row">No incidents. When a machine stops, dozens of alarms can fire within seconds. The AI groups them into one incident with its root cause.</div>';
    let rows = S.alarms.slice().sort((a, b) => (a.state === 'cleared') - (b.state === 'cleared') || a.prio - b.prio || b.real - a.real);
    if (filter === 'p1') rows = rows.filter(a => a.prio <= 2);
    if (filter === 'unack') rows = rows.filter(a => a.state === 'active');
    const stateChip = a => a.state === 'cleared' ? '<span class="chip chip-success">Cleared</span>' : a.shelved ? '<span class="chip chip-neutral">Shelved</span>' : a.state === 'ack' ? '<span class="chip chip-neutral">Acknowledged</span>' : '<span class="chip chip-danger">New</span>';
    $('#alarmTable').innerHTML = `<tr><th>Priority</th><th>Time</th><th>Area</th><th>Alarm</th><th>State</th><th></th></tr>` + (rows.length ? rows.map(a => `
      <tr class="${a.state === 'active' ? 'active-unack' : ''} ${a.shelved ? 'shelved' : ''}">
        <td><span class="prio p${a.prio}">P${a.prio}</span></td><td class="num">${a.time}</td><td>${esc(a.area)}</td>
        <td>${esc(a.msg)}<div class="small muted">${esc(a.tag)}${a.incident ? ' · grouped into incident' : ''}</div></td>
        <td>${stateChip(a)}</td>
        <td><div class="acts">${a.state === 'active' ? `<button type="button" class="btn btn-secondary btn-sm" data-ack="${a.id}">Acknowledge</button>` : ''}${a.state !== 'cleared' && !a.shelved && a.prio >= 3 ? `<button type="button" class="btn btn-ghost btn-sm" data-shelve="${a.id}">Shelve</button>` : ''}</div></td>
      </tr>`).join('') : `<tr><td colspan="6" class="muted">No alarms match this filter.</td></tr>`);
  };
  $('#alarmTable').addEventListener('click', e => { const b = e.target.closest('[data-shelve]'); if (b) Sim.shelve(+b.dataset.shelve); });

  /* ---------------- predictions ---------------- */
  function hoursAxis(ctx, X, h, pad) {
    ctx.fillStyle = P.text3; ctx.font = '11px ' + getComputedStyle(document.body).fontFamily;
    for (let hr = 6; hr <= 14; hr += 2) ctx.fillText(String(hr).padStart(2, '0') + ':00', X(hr) - 14, h - 4);
  }
  DF.drawForecast = function (canvas, opts = {}) {
    const { ctx, w, h } = Charts.fit(canvas);
    ctx.clearRect(0, 0, w, h);
    const S = Sim.state, f = Sim.forecast();
    const now = S.t / 3600;
    const pad = { l: 46, r: 12, t: 12, b: 22 };
    const X = hr => pad.l + (hr - 6) / 8 * (w - pad.l - pad.r);
    const max = Math.max(f.plan, f.p90) * 1.08;
    const Y = v => pad.t + (1 - v / max) * (h - pad.t - pad.b);
    ctx.strokeStyle = P.border; ctx.lineWidth = 1; ctx.fillStyle = P.text3; ctx.font = '11px ' + getComputedStyle(document.body).fontFamily;
    for (let k = 0; k <= 4; k++) { const v = max * k / 4, y = Y(v); ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(w - pad.r, y); ctx.stroke(); ctx.fillText(fmt(v), 2, y + 4); }
    hoursAxis(ctx, X, h, pad);
    // plan
    ctx.strokeStyle = P.text3; ctx.setLineDash([5, 5]); ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(X(6), Y(0)); ctx.lineTo(X(14), Y(f.plan)); ctx.stroke(); ctx.setLineDash([]);
    // actual: 06:00 → start of the session, then the recorded history
    const startHr = (9 * 3600 + 12 * 60) / 3600;
    ctx.strokeStyle = P.brand2; ctx.lineWidth = 3; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(X(6), Y(0)); ctx.lineTo(X(startHr), Y(S.unitsBase));
    const hist = S.history;
    hist.forEach(s => { const [hh, mm] = s.clock.split(':').map(Number); ctx.lineTo(X(hh + mm / 60), Y(s.units)); });
    ctx.lineTo(X(now), Y(f.units)); ctx.stroke();
    // cone
    ctx.fillStyle = P.indigo; ctx.globalAlpha = 0.2;
    ctx.beginPath(); ctx.moveTo(X(now), Y(f.units)); ctx.lineTo(X(14), Y(f.p90)); ctx.lineTo(X(14), Y(f.p10)); ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1;
    ctx.strokeStyle = P.indigo; ctx.setLineDash([6, 5]); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(X(now), Y(f.units)); ctx.lineTo(X(14), Y(f.p50)); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = P.brand2; ctx.beginPath(); ctx.arc(X(now), Y(f.units), 5, 0, 7); ctx.fill();
    ctx.fillStyle = P.text; ctx.font = '700 12px ' + getComputedStyle(document.body).fontFamily;
    ctx.fillText('Now', X(now) - 12, Y(f.units) - 10);
    ctx.fillStyle = P.indigo; const l50 = 'P50 ' + fmt(f.p50); ctx.fillText(l50, Math.min(w - pad.r - ctx.measureText(l50).width, X(14) - ctx.measureText(l50).width - 4), Y(f.p50) - 8);
    return f;
  };
  function chip(el, prob) {
    el.textContent = Math.round(prob * 100) + '% chance to hit plan';
    el.className = 'chip ' + (prob >= 0.8 ? 'chip-success' : prob >= 0.5 ? 'chip-warning' : 'chip-danger');
  }
  DF.renderPredict = function () {
    const f = DF.drawForecast($('#pChart'));
    chip($('#pChip'), f.prob);
    $('#pNums').innerHTML = [['P10 (cautious)', f.p10], ['P50 (expected)', f.p50], ['P90 (optimistic)', f.p90], ['Plan', f.plan]].map(([l, v]) => `<div><b>${fmt(v)}</b><span>${l}</span></div>`).join('');
    const ms = Sim.machines().map(m => ({ m, r: Sim.failureRisk(m) })).sort((a, b) => b.r - a.r).slice(0, 10);
    $('#riskList').innerHTML = ms.map(({ m, r }) => {
      const c = r > 0.5 ? 'var(--danger)' : r > 0.15 ? 'var(--warning)' : 'var(--success)';
      return `<div class="risk"><div><b>${esc(m.name)}</b><small>${esc(Sim.line(m.line).name)} · health ${Math.round(m.health)}</small></div><div class="rb"><i style="width:${Math.max(3, r * 100)}%;background:${c}"></i></div><div class="pc" style="color:${c}">${Math.round(r * 100)}%</div></div>`;
    }).join('');
    const S = Sim.state;
    if (!$('#qf').children.length) $('#qf').innerHTML = S.lines.map(l => `<div class="qf-row"><span>${esc(l.name)}</span><canvas data-q="${l.id}"></canvas><b data-qv="${l.id}"></b></div>`).join('');
    S.lines.forEach(l => {
      const drift = (S.active.solder && l.id === 'L2' ? -0.012 : 0) + (S.active.heat && !S.active.heat.fixed && /L1|L2/.test(l.id) ? -0.006 : 0);
      const pts = Array.from({ length: 13 }, (_, k) => Math.max(0.9, l.fpyNow + drift * k / 4 + Math.sin(k + l.rate) * 0.0008));
      const end = pts[pts.length - 1];
      Charts.line(document.querySelector(`[data-q="${l.id}"]`), [{ data: pts, color: end < 0.985 ? P.warning : P.success, fill: true }], { min: 0.9, max: 1 });
      const el = document.querySelector(`[data-qv="${l.id}"]`); el.textContent = pct(end); el.style.color = end < 0.985 ? 'var(--warning)' : '';
    });
    const base = S.kw, peak = S.active.peak ? 1180 : 0, heat = S.active.heat && !S.active.heat.fixed ? 150 : 0;
    const fc = Array.from({ length: 25 }, (_, k) => base + Math.sin(k / 3) * 18 + (k > 2 && peak ? Math.min(1, (k - 2) / 4) * (peak - base) : 0) + (k > 10 ? heat * Math.min(1, (k - 10) / 6) : 0));
    Charts.line($('#eFc'), [{ data: fc, color: P.brand2, fill: true, dot: false }], { min: 500, max: 1300, grid: true, yFmt: v => Math.round(v), band: [[14, 24, P.dark ? 'rgba(255,176,32,0.08)' : 'rgba(224,138,0,0.08)']], threshold: { v: 1100, color: P.danger, label: 'Contract limit 1,100 kW' }, pad: { l: 36, r: 8, t: 12, b: 8 } });
    const maxF = Math.max(...fc);
    const e = $('#eChip'); e.textContent = maxF > 1100 ? 'Limit breach forecast' : 'Within limit';
    e.className = 'chip ' + (maxF > 1100 ? 'chip-danger' : 'chip-success');
  };

  /* ---------------- root cause ---------------- */
  const CHAINS = {
    solder: { title: 'Solder-bridge defects on SMT Line 2', nodes: [
      ['cause', 'Root cause', 'Printer pressure drift', '5.2 → 6.8 kg'], ['', 'Process', 'More solder paste', 'SPI volume +18%'], ['', 'Defect', 'Solder bridges', 'Pads U14/U15 · 4.2×'],
      ['', 'Detection', 'AOI rejects rise', '+3.1 pts'], ['', 'KPI', 'Yield falls', 'FPY −2.6 pts'], ['impact', 'Impact', 'Rework cost', '≈ EGP 240k / week']],
      evidence: [['Correlation of printer pressure with bridge rate', 'r = 0.91'], ['Signals scanned', '212'], ['Lag between drift and first defect', '11 min'], ['Same pattern in history', '2 events (Aug, Sep)']],
      action: 'Recalibrate squeegee pressure to 5.5 kg and run a stencil wipe. No line stop needed.' },
    bearing: { title: 'Bearing wear on Mounter B', nodes: [
      ['cause', 'Root cause', 'Spindle bearing wear', 'Pattern B-14'], ['', 'Signal', 'Vibration rises', '+150% vs baseline'], ['', 'Process', 'Pick accuracy drops', 'Mis-picks +0.4%'],
      ['', 'KPI', 'Slower cycle', 'Cycle time +16%'], ['', 'Forecast', 'Failure predicted', 'in about 40 h'], ['impact', 'Impact', 'If ignored', '4.5 h down · EGP 1.6M']],
      evidence: [['Match with bearing-wear signature', '94%'], ['Vibration trend slope', '+0.8 mm/s per hour'], ['Temperature rise at spindle', '+3.4 °C'], ['Spare kit in stock', 'Store B-07']],
      action: 'Replace the bearing at the 14:00 shift change: a 25-minute planned stop.' },
    breakdown: { title: 'Robot stop on Final Assembly B', nodes: [
      ['cause', 'Root cause', 'Torque sensor drift', 'Same as 3 past events'], ['', 'Event', 'Torque fault', 'Cell stopped'], ['', 'Line', 'Upstream blocked', '3 stations'],
      ['', 'Line', 'Downstream starved', '2 stations'], ['', 'Plant', 'Test & Pack starved', 'Order 4471 at risk'], ['impact', 'Impact', 'Alarm flood', '12 alarms → 1 incident']],
      evidence: [['Diagnosis confidence', '88%'], ['Alarms grouped', '12'], ['Time to correct technician', '2 min'], ['Repair time vs average', '14 vs 55 min']],
      action: 'Replace the torque sensor from store A-14 using repair guide RG-207.' },
    heat: { title: 'Heat wave risk', nodes: [
      ['cause', 'Root cause', 'Ambient 41 °C', 'Weather forecast'], ['', 'Utility', 'Chiller near limit', 'Load 92%'], ['', 'Process', 'Reflow zone 5 drifts', '+3 °C'],
      ['', 'Defect risk', 'More solder bridges', '×1.8 risk'], ['', 'KPI', 'Yield forecast drops', 'L1 and L2'], ['impact', 'Impact', 'Cost avoided', '≈ EGP 310k']],
      evidence: [['Forecast confidence', '2 h horizon'], ['Chiller trip risk', 'High after 13:00'], ['Reflow drift detected', 'zone 5, both SMT lines'], ['Off-peak window left', '45 min']],
      action: 'Pre-cool the hall now and lower the zone-5 setpoint by 3 °C.' },
    power: { title: 'Grid voltage dip', nodes: [
      ['cause', 'Root cause', 'Grid voltage dip', '18% for 400 ms'], ['', 'Event', 'SMT lines trip', 'L1 and L2'], ['', 'Product', 'Boards in ovens', '38 boards at risk'],
      ['', 'Action', 'Re-inspection', '100% AOI on 38 boards'], ['', 'Action', 'Staggered restart', '20 s apart'], ['impact', 'Impact', 'Downtime avoided', '31 minutes']],
      evidence: [['UPS ride-through', 'Controllers kept state'], ['Inrush peak avoided', '≈ 240 kW'], ['Boards quarantined', '38'], ['Restart time', '9 min instead of 40']],
      action: 'Keep the 38 boards on hold until AOI re-inspection passes.' }
  };
  let rcSel = null;
  DF.renderRootCause = function () {
    const S = Sim.state;
    const live = Object.keys(CHAINS).filter(k => S.active[k] || (k === 'breakdown' && S.incidents.some(i => i.open && i.area === 'L4')));
    const order = [...new Set([DF.rcFocus, ...live, 'solder', 'bearing', 'breakdown', 'heat', 'power'].filter(Boolean))];
    if (!rcSel || DF.rcFocus) { rcSel = order[0]; DF.rcFocus = null; }
    $('#rcTabs').innerHTML = order.map(k => `<button type="button" class="seg ${k === rcSel ? 'active' : ''}" aria-pressed="${k === rcSel}" data-rc="${k}">${live.includes(k) ? '● ' : ''}${CHAINS[k].title.split(' on ')[0].split(' risk')[0]}</button>`).join('');
    const c = CHAINS[rcSel];
    $('#rcTitle').textContent = c.title;
    $('#rcSub').textContent = live.includes(rcSel) ? 'Live analysis from the current plant state' : 'Example from the scenario library · run it to see it live';
    const n = c.nodes.length, W = 190, G = 34, H = 116, w = n * W + (n - 1) * G + 20;
    let svg = `<svg viewBox="0 0 ${w} ${H + 40}" role="img" aria-label="Cause and effect chain">`;
    c.nodes.forEach(([kind, k, t, v], i) => {
      const x = 10 + i * (W + G), y = 20;
      if (i < n - 1) svg += `<path class="rc-edge" d="M${x + W} ${y + H / 2} L${x + W + G} ${y + H / 2}"/>`;
      svg += `<g class="rc-node ${kind}"><rect x="${x}" y="${y}" width="${W}" height="${H}" rx="18"/>
        <text class="k" x="${x + 16}" y="${y + 26}">${esc(k.toUpperCase())}</text>
        <text x="${x + 16}" y="${y + 56}" font-size="15.5" font-weight="700">${esc(t)}</text>
        <text x="${x + 16}" y="${y + 84}" font-size="13" style="fill:var(--text-2)">${esc(v)}</text></g>`;
    });
    $('#rcGraph').innerHTML = svg + '</svg>';
    $('#rcEvidence').innerHTML = c.evidence.map(([a, b]) => `<div class="evi"><span>${esc(a)}</span><b>${esc(b)}</b></div>`).join('');
    const ins = S.insights.find(i => i.scenario === rcSel && i.actions && i.actions.length);
    $('#rcAction').innerHTML = ins ? DF.insightHtml(ins, { skip: ['rootcause'] }) : `<div class="notice notice-info" style="margin:0">${icon('info')}<p>${esc(c.action)}</p></div><button type="button" class="btn btn-primary btn-sm" data-run="${rcSel}">${icon('play')}Run this scenario live</button>`;
  };
  $('#rcTabs').addEventListener('click', e => { const b = e.target.closest('[data-rc]'); if (b) { rcSel = b.dataset.rc; DF.renderRootCause(); } });

  /* ---------------- scenarios ---------------- */
  const started = {};
  DF.renderScenarios = function () {
    const S = Sim.state;
    $('#scenarios').innerHTML = Sim.SCENARIOS.map(s => {
      const running = S.active[s.id] || (started[s.id] && S.real - started[s.id] < 15);
      const ag = Sim.agent(s.agent);
      return `<div class="card sc ${running ? 'running' : ''}">
        <div class="sh"><div><b>${esc(s.title)}</b><small>${esc(s.area)} · ${esc(ag.name)}</small></div></div>
        <p><b>What happens:</b> ${esc(s.what)}</p>
        <p><b>What the AI does:</b> ${esc(s.ai)}</p>
        <button type="button" class="btn ${running ? 'btn-secondary' : 'btn-primary'} btn-sm" data-run="${s.id}" ${running ? 'disabled' : ''}>${icon(running ? 'clock' : 'play')}${running ? 'Running…' : 'Run scenario'}</button>
      </div>`;
    }).join('');
  };
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-run]'); if (!b) return;
    const id = b.dataset.run;
    started[id] = Sim.state.real;
    Sim.trigger(id);
    DF.toast('Scenario started: ' + Sim.SCENARIOS.find(s => s.id === id).title, 'info');
    if (DF.view === 'scenarios' || DF.view === 'rootcause') DF.go('command');
  });
  $('#autoplay').addEventListener('change', e => Sim.setAutoplay(e.target.checked));
  $('#resetSim').onclick = () => { Sim.reset(); $('#events').innerHTML = ''; $('#detections').innerHTML = ''; DF.toast('Plant reset', 'info'); DF.refresh(); };

  /* ---------------- control ---------------- */
  const draft = {};
  let controlPreviewKey = '';
  let controlDebounce;
  const linePreviewHtml = {};
  function previewHtml(l, speed) {
    const p = Sim.preview(l.id, speed);
    const d = (a, b, f, good) => { const diff = a - b; if (Math.abs(diff) < 1e-6) return ''; const ok = good === 'up' ? diff > 0 : diff < 0; return ` <small style="color:${ok ? 'var(--success)' : 'var(--danger)'}">${diff > 0 ? '+' : ''}${f(diff)}</small>`; };
    return `<div><b>${fmt(p.tph)}${d(p.tph, p.tphNow, v => fmt(v), 'up')}</b>units / h</div><div><b>${pct(p.fpy)}${d(p.fpy, p.fpyNow, v => (v * 100).toFixed(1) + ' pts', 'up')}</b>yield</div><div><b>${fmt(p.kw)}${d(p.kw, p.kwNow, v => fmt(v), 'down')}</b>kW</div>`;
  }
  DF.renderControl = function (rebuild, statusOnly, onlyLine) {
    const S = Sim.state;
    const previewKey = statusOnly ? controlPreviewKey : S.lines.map(l => {
      const sp = draft[l.id] !== undefined ? draft[l.id] : l.speed;
      return l.id + ':' + sp.toFixed(3);
    }).join('|');
    const runPreview = !statusOnly && previewKey !== controlPreviewKey;
    if (runPreview) controlPreviewKey = previewKey;
    if (rebuild || $('#controls').children.length !== S.lines.length) {
      controlPreviewKey = '';
      $('#controls').innerHTML = S.lines.map(l => `<div class="card ctrl" data-line="${l.id}">
        <div class="ch"><div><b>${esc(l.name)}</b><small>${esc(l.sub)} · nominal ${l.rate} units/h</small></div><span class="chip" data-cst></span></div>
        <label class="sp"><span>Line speed <b data-cv></b></span><input type="range" min="80" max="115" step="1" data-cr aria-label="Speed for ${esc(l.name)}"></label>
        <div class="pv" data-pv></div>
        <div class="ca"><button type="button" class="btn btn-primary btn-sm" data-apply>Simulate and apply</button><button type="button" class="btn btn-secondary btn-sm" data-stop></button></div>
      </div>`).join('');
    }
    S.lines.forEach(l => {
      const card = document.querySelector(`.ctrl[data-line="${l.id}"]`);
      const sp = draft[l.id] !== undefined ? draft[l.id] : l.speed;
      const r = card.querySelector('[data-cr]');
      if (document.activeElement !== r) r.value = Math.round(sp * 100);
      card.querySelector('[data-cv]').textContent = Math.round(sp * 100) + '%';
      const cacheKey = l.id + ':' + sp.toFixed(3);
      if (runPreview && (!onlyLine || onlyLine === l.id)) {
        linePreviewHtml[cacheKey] = previewHtml(l, sp);
      }
      const pvHtml = linePreviewHtml[cacheKey];
      if (pvHtml) card.querySelector('[data-pv]').innerHTML = pvHtml;
      const halted = l.stopped || l.paused || l.starved || l.stations.some(s => s.state === 'down');
      const c = card.querySelector('[data-cst]');
      c.textContent = l.stopped ? 'Stopped' : halted ? 'Interrupted' : 'Running';
      c.className = 'chip ' + (l.stopped ? 'chip-neutral' : halted ? 'chip-danger' : 'chip-success');
      card.querySelector('[data-stop]').textContent = l.stopped ? 'Start line' : 'Stop line';
      card.querySelector('[data-apply]').disabled = Math.abs(sp - l.speed) < 0.001;
    });
  };
  $('#controls').addEventListener('input', e => {
    const r = e.target.closest('[data-cr]'); if (!r) return;
    draft[r.closest('.ctrl').dataset.line] = +r.value / 100;
    clearTimeout(controlDebounce);
    const lineId = r.closest('.ctrl').dataset.line;
    controlDebounce = setTimeout(() => DF.renderControl(false, false, lineId), 280);
  });
  $('#controls').addEventListener('click', async e => {
    const card = e.target.closest('.ctrl'); if (!card) return;
    const l = Sim.line(card.dataset.line);
    if (e.target.closest('[data-apply]')) {
      const sp = draft[l.id];
      const ok = await DF.confirm({ title: `Change ${l.name} speed to ${Math.round(sp * 100)}%?`, html: `<p>The digital twin expects this result. The change will be written to the audit trail.</p><div class="pv">${previewHtml(l, sp)}</div>` });
      if (ok) { Sim.control(l.id, { speed: sp }, 'You'); delete draft[l.id]; DF.toast(`${l.name} speed set to ${Math.round(sp * 100)}%`, 'success'); }
      DF.renderControl();
    } else if (e.target.closest('[data-stop]')) {
      const stopping = !l.stopped;
      const ok = await DF.confirm({ title: `${stopping ? 'Stop' : 'Start'} ${l.name}?`, html: stopping ? `<p>Output will drop by about <b>${fmt(l.tph)} units per hour</b> while the line is stopped. Downstream lines may run short of material.</p>` : `<p>The line restarts at ${Math.round(l.speed * 100)}% speed.</p>`, yes: stopping ? 'Stop line' : 'Start line' });
      if (ok) { Sim.control(l.id, { stopped: stopping }, 'You'); DF.toast(`${l.name} ${stopping ? 'stopped' : 'started'}`, stopping ? 'warning' : 'success'); }
      DF.renderControl();
    }
  });
})();
