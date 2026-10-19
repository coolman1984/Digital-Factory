/* Digital Factory — performance views: leadership, maintenance (with acoustic AI), AI vision quality, energy, what-if. */
(function () {
  'use strict';
  const { $, $$, fmt, pct, money, esc, icon, P, STATE_LABEL, STATE_CHIP } = DF;
  const acousticRng = DFRng.stream('acoustic');
  const visionRng = DFRng.stream('vision');

  /* ---------------- leadership ---------------- */
  const SIX_LOSSES = [
    ['breakdown', 'Breakdowns'],
    ['setupAdjust', 'Setup / adjust'],
    ['minorStop', 'Minor stops'],
    ['reducedSpeed', 'Reduced speed'],
    ['starvation', 'Waiting / starvation'],
    ['operatorStop', 'Operator stops'],
    ['startupRejects', 'Startup rejects'],
    ['productionRejects', 'Production rejects']
  ];
  function renderLineLosses(lines) {
    const box = $('#lineLosses');
    if (!box) return;
    box.innerHTML = lines.map(l => {
      const ls = l.ledger.losses;
      const tot = Object.values(ls).reduce((a, b) => a + b, 0) || 1;
      const c = l.oeeComponents || { A: 0, P: 0, Q: 0 };
      return `<div class="loss-line"><div class="row"><b>${esc(l.name)}</b><span class="muted small">A ${pct(c.A, 0)} · P ${pct(c.P, 0)} · Q ${pct(c.Q, 0)}</span></div><div class="loss-bars">${SIX_LOSSES.map(([k, label]) => `<div class="pb"><div class="row"><span>${label}</span><span class="muted">${fmt(ls[k])} s</span></div><div class="bar"><i style="width:${Math.min(100, ls[k] / tot * 100)}%"></i></div></div>`).join('')}</div></div>`;
    }).join('');
  }
  const PILLARS = [
    ['Connected machines and data foundation', 35, 80],
    ['Digital twin from warehouse to shipping', 15, 45],
    ['AI agents for quality', 20, 70],
    ['AI agents for production', 15, 60],
    ['AI agents for logistics', 25, 55],
    ['Safety (EHS) AI', 10, 50],
    ['Robotics readiness', 20, 30]
  ];
  function drawScore(score) {
    const c = $('#scoreRing'), { ctx, w, h } = Charts.fit(c);
    ctx.clearRect(0, 0, w, h);
    const r = Math.min(w, h) / 2 - 12, cx = w / 2, cy = h / 2;
    ctx.lineWidth = 16; ctx.lineCap = 'round';
    ctx.strokeStyle = P.surface3; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = score >= 80 ? P.success : score >= 60 ? P.warning : P.danger;
    ctx.beginPath(); ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * score / 100); ctx.stroke();
  }
  DF.renderLeadership = function (rebuild) {
    const S = Sim.state;
    const score = Sim.healthScore();
    drawScore(score);
    $('#scoreVal').textContent = score;
    $('#scoreNote').textContent = score >= 80 ? 'Healthy. No decision needed right now.' : score >= 60 ? 'Attention: open alarms or machine risk are pulling the score down.' : 'Action needed: a line is stopped or at high risk.';
    const f = DF.drawForecast($('#fcChart'));
    const ch = $('#fcChip'); ch.textContent = Math.round(f.prob * 100) + '% chance';
    ch.className = 'chip ' + (f.prob >= 0.8 ? 'chip-success' : f.prob >= 0.5 ? 'chip-warning' : 'chip-danger');
    const waiting = S.insights.filter(i => i.level !== 'ok' && i.actions && i.actions.some(a => a.primary)).sort((a, b) => (b.risk || 0) - (a.risk || 0));
    // a zero is printed in ink; green and red only once there is money saved or at risk
    const atRisk = waiting.reduce((a, i) => a + (i.risk || 0), 0);
    $('#mSaved').textContent = money(S.saved); $('#mSaved').className = S.saved > 0 ? 'ok-text' : '';
    $('#mRisk').textContent = money(atRisk); $('#mRisk').className = atRisk > 0 ? 'danger-text' : '';
    $('#mActions').textContent = S.agents.reduce((a, g) => a + g.actions, 0);
    $('#approvals').innerHTML = waiting.length ? waiting.map(i => {
      const a = i.actions.find(x => x.primary); const ag = i.agent ? Sim.agent(i.agent) : null;
      return `<div class="appr"><div><b>${esc(i.title)}</b><span>${ag ? esc(ag.name) + ' · ' : ''}${i.time}</span>${i.risk ? `<div class="val">${money(i.risk)} at stake</div>` : ''}</div><button type="button" class="btn btn-primary btn-sm" data-act="${a.key}" data-id="${i.id}">${esc(a.label)}</button></div>`;
    }).join('') : '<div class="empty-row">Nothing is waiting for you. The agents are handling routine work.</div>';
    $('#league').innerHTML = `<tr><th>Line</th><th>Status</th><th>OEE</th><th>Yield</th><th>Units / h</th></tr>` + S.lines.slice().sort((a, b) => b.oee - a.oee).map(l => {
      const halted = l.stopped || l.paused || l.starved || l.stations.some(s => s.state === 'down');
      const warn = l.stations.some(s => s.state === 'warn' || s.state === 'maint');
      return `<tr><td><b>${esc(l.name)}</b><div class="small muted">${esc(l.sub)}</div></td><td><span class="chip ${halted ? 'chip-danger' : warn ? 'chip-warning' : 'chip-success'}">${halted ? 'Interrupted' : warn ? 'Attention' : 'Running'}</span></td><td class="num"><div style="display:flex;gap:8px;align-items:center">${pct(l.oee, 0)}<div class="mini-bar"><i style="width:${l.oee * 100}%"></i></div></div></td><td class="num">${pct(l.fpyNow)}</td><td class="num">${fmt(l.tph)}</td></tr>`;
    }).join('');
    renderLineLosses(S.lines);
    if (rebuild || !$('#readiness').children.length) {
      $('#readiness').innerHTML = PILLARS.map(([n, now, pilot]) => `<div class="rd"><div class="row"><b>${esc(n)}</b><span class="muted">${now}% → <b class="hl">${pilot}%</b></span></div><div class="bar"><i class="pilot" style="width:${pilot}%"></i><i class="now" style="width:${now}%"></i></div></div>`).join('') +
        `<small>Grey: assumed starting point. Blue: target after the 12-week pilot. To be replaced by a joint assessment on site.</small>`;
    }
    Charts.line($('#oeeTrend'), [{ data: S.oeeHist.map(v => v * 100), color: P.brand2, fill: true, dot: true }], { min: 50, max: 100, grid: true, yFmt: v => Math.round(v) + '%', threshold: { v: 85, color: P.success, label: 'Benchmark 85%' }, pad: { l: 36, r: 8, t: 12, b: 8 } });
  };

  /* ---------------- maintenance ---------------- */
  DF.renderMachines = function (rebuild) {
    const ms = Sim.machines().slice().sort((a, b) => a.health - b.health);
    if (!DF.selMachine) DF.selMachine = ms[0].id;
    const box = $('#machines');
    if (rebuild || box.children.length !== ms.length) box.innerHTML = ms.map(m => `<button type="button" class="mach" data-mid="${m.id}"><div class="mn"></div><div class="ml"></div><div class="health-bar"><i></i></div><div class="mr"><span class="muted">Remaining life</span><b class="rul"></b></div></button>`).join('');
    Array.from(box.children).forEach(el => {
      const m = ms.find(x => x.id === el.dataset.mid);
      el.classList.toggle('sel', m.id === DF.selMachine);
      el.querySelector('.mn').innerHTML = `${esc(m.name)} <span class="chip ${STATE_CHIP[m.state]}" style="height:20px;font-size:10.5px">${STATE_LABEL[m.state]}</span>`;
      el.querySelector('.ml').textContent = `${Sim.line(m.line).name} · ${m.vib.toFixed(1)} mm/s · ${m.temp.toFixed(0)} °C`;
      const bar = el.querySelector('.health-bar i');
      bar.style.width = m.health + '%';
      bar.style.background = m.health > 75 ? 'var(--success)' : m.health > 50 ? 'var(--warning)' : 'var(--danger)';
      const r = Sim.rulHours(m), rul = el.querySelector('.rul');
      rul.textContent = m.state === 'down' ? 'Failed' : r > 2000 ? '> 2,000 h' : fmt(r) + ' h';
      rul.className = 'rul ' + (m.state === 'down' || r < 100 ? 'danger-text' : r < 800 ? '' : 'ok-text');
    });
    renderVib();
  };
  $('#machines').addEventListener('click', e => { const el = e.target.closest('.mach'); if (el) { DF.selMachine = el.dataset.mid; DF.renderMachines(); } });
  function renderVib() {
    const m = Sim.allStations().find(s => s.id === DF.selMachine); if (!m) return;
    $('#mSelName').textContent = `${m.name} · ${Sim.line(m.line).name}`;
    const r = Sim.rulHours(m), tag = $('#mSelRul');
    tag.className = 'chip ' + (m.state === 'down' || r < 100 ? 'chip-danger' : r < 800 ? 'chip-warning' : 'chip-success');
    tag.textContent = m.state === 'down' ? 'Failed' : 'Remaining life ' + (r > 2000 ? '> 2,000 h' : fmt(r) + ' h');
    const data = m.hist.vib.slice(-90), k = data.slice(-20);
    const slope = k.length > 1 ? (k[k.length - 1] - k[0]) / (k.length - 1) : 0, last = data[data.length - 1] || 0;
    const fc = [last]; for (let i = 1; i <= 30; i++) fc.push(Math.min(9.5, last + Math.max(slope, 0.002) * i * (m.degrade > 0 ? 1.3 : 1)));
    Charts.line($('#vibChart'), [{ data, color: P.brand2, fill: true, dot: true }, { data: fc, color: P.indigo, dash: [5, 5], offset: data.length - 1 }],
      { min: 0, max: 10, n: data.length + 30, threshold: { v: 7.1, color: P.danger, label: 'ISO 10816 alarm 7.1' }, grid: true, yFmt: v => v.toFixed(0), pad: { l: 22, r: 8, t: 12, b: 8 } });
  }
  // acoustic AI: a scrolling spectrogram of the selected machine's sound
  const ac = $('#acoustic'); let acImg = null;
  DF.drawAcoustic = function () {
    const { ctx, w, h } = Charts.fit(ac);
    const m = Sim.allStations().find(s => s.id === DF.selMachine); if (!m) return;
    const dpr = ac.width / Math.max(1, w);
    const bins = 48, bh = h / bins, wear = (100 - m.health) / 100, defect = m.degrade > 0 || m.health < 70;
    const idle = m.state === 'down' || m.state === 'maint';
    const fresh = !acImg || acImg.w !== ac.width || acImg.id !== m.id;
    if (fresh) { acImg = { w: ac.width, id: m.id }; ctx.fillStyle = P.dark ? '#0B0E14' : '#F7F8FA'; ctx.fillRect(0, 0, w, h); }
    // a new machine (or first view) fills the whole window at once, then it scrolls
    for (let col = fresh ? Math.ceil(w / 2) : 1; col > 0; col--) {
    const img = ctx.getImageData(Math.round(2 * dpr), 0, ac.width - Math.round(2 * dpr), ac.height);
    ctx.putImageData(img, 0, 0);
    for (let b = 0; b < bins; b++) {
      const f = 1 - b / bins;
      let e = 0.08 + acousticRng.range(0, 0.08);
      if (!idle) {
        e += Math.exp(-((f - 0.12) ** 2) / 0.002) * 0.7 + Math.exp(-((f - 0.24) ** 2) / 0.002) * 0.4;
        if (defect) e += Math.exp(-((f - 0.7) ** 2) / 0.004) * (0.25 + wear * 1.6) * (0.6 + acousticRng.range(0, 0.4));
      }
      e = Math.min(1, e);
      const c = e > 0.6 ? `rgba(255,176,32,${e})` : `rgba(33,137,255,${Math.min(1, e * 1.4)})`;
      ctx.fillStyle = P.dark ? '#0B0E14' : '#F7F8FA'; ctx.fillRect(w - 2, b * bh, 2, bh + 1);
      ctx.fillStyle = c; ctx.fillRect(w - 2, b * bh, 2, bh + 1);
    }
    }
    const chip = $('#acChip');
    chip.textContent = idle ? 'machine stopped' : defect ? 'bearing defect frequency detected' : 'normal sound';
    chip.className = 'chip ' + (idle ? 'chip-neutral' : defect ? 'chip-warning' : 'chip-success');
  };
  addEventListener('themechange', () => { acImg = null; });
  DF.renderWorkOrders = function () {
    const base = [
      { id: 'WO-4791', title: 'Nozzle cleaning · Mounter A (L1)', status: 'Scheduled 16:00', level: 'info' },
      { id: 'WO-4788', title: 'Reflow fan bearing · SMT Line 2 (about 1,100 h left)', status: 'Next planned window', level: 'warn' },
      { id: 'WO-4772', title: 'Torque calibration · Screw robot (L3)', status: 'Completed', level: 'ok' }
    ];
    const chip = l => l === 'crit' ? 'chip-danger' : l === 'warn' ? 'chip-warning' : l === 'ok' ? 'chip-success' : 'chip-info';
    $('#workOrders').innerHTML = Sim.state.workOrders.concat(base).map(w => `<div class="wo"><span class="id">${w.id}</span><span>${esc(w.title)}</span><span class="chip ${chip(w.level)}">${esc(w.status)}</span></div>`).join('');
  };

  /* ---------------- AI vision ---------------- */
  const vision = $('#vision');
  const DEFECTS = ['Solder bridge', 'Missing component', 'Tombstone', 'Misalignment', 'Insufficient solder'];
  let board = null, boardNo = 24817;
  const ease = k => 1 - Math.pow(1 - Math.max(0, Math.min(1, k)), 3);
  const clamp01 = k => Math.max(0, Math.min(1, k));
  function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function newBoard() {
    const S = Sim.state, lineId = boardNo % 2 ? 'L2' : 'L1', l = Sim.line(lineId), parts = [];
    for (let i = 0; i < 4; i++) parts.push({ type: 'ic', x: 0.08 + i * 0.19 + visionRng.range(0, 0.03), y: 0.18 + visionRng.range(0, 0.08), w: 0.11 + visionRng.range(0, 0.04), h: 0.16 + visionRng.range(0, 0.05) });
    for (let r = 0; r < 3; r++) for (let c = 0; c < 9; c++) parts.push({ type: 'p', x: 0.08 + c * 0.095, y: 0.56 + r * 0.12, w: 0.035, h: 0.02, rot: (r + c) % 3 === 0 });
    parts.push({ type: 'cap', x: 0.86, y: 0.16, r: 0.04 });
    const defs = [];
    if (visionRng.chance(Math.min(0.85, 0.22 * l.defectMult))) {
      const hot = S.active.solder && lineId === 'L2';
      const type = hot ? (visionRng.chance(0.8) ? 'Solder bridge' : 'Insufficient solder') : DEFECTS[visionRng.int(DEFECTS.length)];
      const cands = parts.filter(q => type === 'Solder bridge' ? q.type === 'ic' : q.type === 'p');
      const target = cands[visionRng.int(cands.length)];
      target.defect = type; defs.push({ type, part: target, conf: (95 + visionRng.range(0, 4.6)).toFixed(1) });
    }
    board = { no: boardNo++, line: lineId, parts, defs, t: 0, ms: (11 + visionRng.range(0, 6)).toFixed(1), counted: false };
  }
  function drawPart(ctx, p, bx, by, BW, BH) {
    const x = bx + BW * p.x, y = by + BH * p.y;
    if (p.type === 'ic') {
      const w = BW * p.w, h = BH * p.h, pins = 7;
      ctx.fillStyle = '#c0c4cc';
      for (let i = 0; i < pins; i++) { const py = y + 4 + i * (h - 8) / (pins - 1); ctx.fillRect(x - 6, py - 1.5, 6, 3); ctx.fillRect(x + w, py - 1.5, 6, 3); }
      if (p.defect === 'Solder bridge') { ctx.fillStyle = '#e3e6ea'; ctx.fillRect(x + w, y + 4 + (h - 8) / (pins - 1) * 2 - 1.5, 6, (h - 8) / (pins - 1) + 3); }
      ctx.fillStyle = '#16181d'; ctx.fillRect(x, y, w, h);
      ctx.fillStyle = '#5d6573'; ctx.font = '9px monospace'; ctx.fillText('DF' + Math.round(p.x * 999), x + 6, y + h - 6);
    } else if (p.type === 'p') {
      const w = BW * p.w, h = BH * p.h * 1.4;
      ctx.fillStyle = '#c9b26a'; ctx.fillRect(x - 3, y - 1, 5, h + 2); ctx.fillRect(x + w - 2, y - 1, 5, h + 2);
      if (p.defect === 'Missing component') return;
      ctx.save();
      let ox = 0, oy = 0, rot = 0, sc = 1;
      if (p.defect === 'Misalignment') { ox = w * 0.35; oy = h * 0.6; rot = 0.35; }
      if (p.defect === 'Tombstone') sc = 0.45;
      if (p.defect === 'Insufficient solder') { ctx.fillStyle = '#0b4d2c'; ctx.fillRect(x + w - 2, y, 5, h); }
      ctx.translate(x + w / 2 + ox, y + h / 2 + oy); ctx.rotate(rot);
      ctx.fillStyle = p.rot ? '#3b2f22' : '#1d2129'; ctx.fillRect(-w / 2 * sc, -h / 2, w * sc, h);
      ctx.fillStyle = '#b8bcc4'; ctx.fillRect(-w / 2 * sc, -h / 2, 3, h); ctx.fillRect(w / 2 * sc - 3, -h / 2, 3, h);
      ctx.restore();
    } else {
      const r = BW * p.r;
      ctx.fillStyle = '#2b3a55'; ctx.beginPath(); ctx.arc(x + r, y + r, r, 0, 7); ctx.fill();
      ctx.strokeStyle = '#8aa0c8'; ctx.lineWidth = 2; ctx.stroke();
    }
  }
  DF.drawVision = function (dt) {
    if (!board) newBoard();
    board.t += dt;
    const { ctx, w, h } = Charts.fit(vision);
    ctx.fillStyle = '#0B0E14'; ctx.fillRect(0, 0, w, h);
    const T_IN = 0.6, T_SCAN = 1.6, T_HOLD = 1.6, T_OUT = 0.5, TOTAL = T_IN + T_SCAN + T_HOLD + T_OUT, bt = board.t;
    const BW = Math.min(w * 0.74, (h - 70) * 1.6), BH = BW / 1.6;
    let bx = (w - BW) / 2;
    if (bt < T_IN) bx += (1 - ease(bt / T_IN)) * w; else if (bt > TOTAL - T_OUT) bx -= ease((bt - (TOTAL - T_OUT)) / T_OUT) * w;
    const by = (h - BH) / 2 + 18;
    ctx.fillStyle = '#0b4d2c'; rr(ctx, bx, by, BW, BH, 10); ctx.fill(); ctx.strokeStyle = '#13703f'; ctx.lineWidth = 2; ctx.stroke();
    ctx.strokeStyle = 'rgba(214,180,90,0.35)'; ctx.lineWidth = 1.2;
    for (let i = 0; i < 16; i++) { const y = by + BH * (0.1 + i * 0.053); ctx.beginPath(); ctx.moveTo(bx + 10, y); ctx.lineTo(bx + BW * (0.3 + (i * 37 % 60) / 100), y); ctx.lineTo(bx + BW * (0.35 + (i * 37 % 60) / 100), y + 12); ctx.stroke(); }
    for (const p of board.parts) drawPart(ctx, p, bx, by, BW, BH);
    const scanK = clamp01((bt - T_IN) / T_SCAN);
    if (bt > T_IN && bt < T_IN + T_SCAN) {
      const sx = bx + BW * scanK, g = ctx.createLinearGradient(sx - 60, 0, sx, 0);
      g.addColorStop(0, 'rgba(33,137,255,0)'); g.addColorStop(1, 'rgba(33,137,255,0.35)');
      ctx.fillStyle = g; ctx.fillRect(sx - 60, by - 6, 60, BH + 12);
      ctx.strokeStyle = '#4DA3FF'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(sx, by - 8); ctx.lineTo(sx, by + BH + 8); ctx.stroke();
    }
    for (const d of board.defs) {
      const p = d.part; if (bt < T_IN || scanK < p.x + 0.02) continue;
      const pad = 8, px = bx + BW * p.x - pad, py = by + BH * p.y - pad;
      const pw = (p.w ? BW * p.w : BW * p.r * 2) + pad * 2, ph = (p.h ? BH * p.h : BW * p.r * 2) + pad * 2;
      ctx.strokeStyle = '#FF5A5F'; ctx.lineWidth = 2; ctx.strokeRect(px, py, pw, ph);
      const lbl = `${d.type} ${d.conf}%`; ctx.font = '700 11px Inter, sans-serif'; const tw = ctx.measureText(lbl).width + 10;
      ctx.fillStyle = '#FF5A5F'; ctx.fillRect(px, py - 18, tw, 17); ctx.fillStyle = '#fff'; ctx.fillText(lbl, px + 5, py - 5.5);
    }
    ctx.font = '600 12px Inter, sans-serif'; ctx.fillStyle = '#B6BDC9';
    ctx.fillText(`Board ${board.line}-${board.no}`, 16, 24); ctx.fillText(`Vision model v4 · ${board.ms} ms`, 16, 42);
    if (scanK >= 1) {
      const fail = board.defs.length > 0, tx = fail ? 'Reject · sent to rework' : 'Pass';
      ctx.font = '800 14px Inter, sans-serif'; const tw = ctx.measureText(tx).width + 22;
      ctx.fillStyle = fail ? 'rgba(255,90,95,0.18)' : 'rgba(52,199,123,0.18)'; ctx.strokeStyle = fail ? '#FF5A5F' : '#34C77B';
      rr(ctx, w - tw - 14, 10, tw, 30, 15); ctx.fill(); ctx.stroke();
      ctx.fillStyle = fail ? '#FF5A5F' : '#34C77B'; ctx.fillText(tx, w - tw - 3, 30);
      if (!board.counted) {
        board.counted = true;
        $('#qMs').textContent = board.ms + ' ms';
        board.defs.forEach(d => {
          Sim.state.defects[d.type] = (Sim.state.defects[d.type] || 0) + 1;
          const el = document.createElement('div'); el.className = 'det';
          el.innerHTML = `<span class="muted">${Sim.clock()}</span><span>${board.line} #${board.no} · <b class="danger-text">${d.type}</b></span><span>${d.conf}%</span>`;
          $('#detections').prepend(el);
          while ($('#detections').children.length > 30) $('#detections').lastChild.remove();
        });
        if (board.defs.length) DF.renderPareto();
      }
    }
    if (bt >= TOTAL) newBoard();
  };
  DF.renderPareto = function () {
    const arr = Object.entries(Sim.state.defects).sort((a, b) => b[1] - a[1]);
    const max = arr[0][1], tot = arr.reduce((a, [, v]) => a + v, 0);
    $('#pareto').innerHTML = arr.map(([k, v]) => `<div class="pb"><div class="row"><span>${k}</span><span>${v} · ${Math.round(v / tot * 100)}%</span></div><div class="bar"><i style="width:${v / max * 100}%"></i></div></div>`).join('');
    $('#qCaught').textContent = fmt(tot);
  };

  /* ---------------- energy ---------------- */
  DF.renderEnergy = function () {
    const S = Sim.state;
    Charts.line($('#kwChart'), [{ data: S.kwHist.slice(), color: P.brand2, fill: true, dot: true }], { min: 500, max: 1300, grid: true, yFmt: v => Math.round(v), threshold: { v: 1100, color: P.danger, label: 'Contract limit 1,100 kW' }, pad: { l: 36, r: 8, t: 12, b: 8 } });
    const tg = $('#tariff'); tg.textContent = S.tariff + ' tariff';
    tg.className = 'chip ' + (S.tariff === 'Peak' ? 'chip-danger' : S.tariff.startsWith('Peak') ? 'chip-warning' : 'chip-success');
    const areas = S.lines.map(l => [l.name, l.kwNow]).concat([['Utilities (air, chillers, HVAC)', S.utilNow]]);
    const max = Math.max(...areas.map(a => a[1])) * 1.1;
    $('#eBars').innerHTML = areas.map(([n, v]) => `<div class="cb"><span>${n}</span><div class="track"><div class="fill" style="width:${v / max * 100}%;background:${n.startsWith('Util') && (S.active.peak || S.active.heat) ? 'var(--danger)' : 'var(--brand)'}"></div></div><span class="num">${fmt(v)} kW</span></div>`).join('');
    const kwh = 21800 + S.energyKwh;
    $('#eKpis').innerHTML = [['Energy today', (kwh / 1000).toFixed(1) + ' MWh'], ['Per unit', (S.kw / Math.max(1, S.tph)).toFixed(2) + ' kWh'], ['CO₂ today', (kwh * 0.47 / 1000).toFixed(1) + ' t'], ['Cost today', money(kwh * 2.2)], ['Ambient', S.ambient + ' °C'], ['Peak demand', fmt(Math.max(...S.kwHist)) + ' kW']]
      .map(([l, v]) => `<div class="mk"><div class="kpi-label">${l}</div><div class="v">${v}</div></div>`).join('');
    const dyn = S.insights.filter(i => i.agent === 'energy');
    const stat = [
      { level: 'info', agent: 'energy', icon: 'clock', title: 'Reflow ovens heat during breaks', body: 'Lowering ovens to 180 °C during the 30-minute lunch break saves about 410 kWh a day with no warm-up penalty.', conf: 'EGP 27k / month', actions: [] },
      { level: 'info', agent: 'energy', icon: 'alert', title: 'Compressed-air leak suspected · Zone C', body: 'Night-time air flow is up 11% since last week. An ultrasonic check on header C-3 is recommended.', conf: 'EGP 12k / month', actions: [] }
    ];
    $('#eRecs').innerHTML = dyn.concat(stat).map(i => DF.insightHtml(i, { skip: ['energy'] })).join('');
  };

  /* ---------------- what-if ---------------- */
  const whatIfCache = new Map();
  let whatIfWorker, whatIfSeq = 0;
  const pendingWhatIf = new Map();

  function whatIfRunOptions(o) {
    const hours = o.shifts * 7.5;
    const common = { hours, maxSteps: 4200, lineSpeed: o.speed / 100 };
    return Object.assign({ seedSalt: 0x77686174, pdm: o.pdm, vision: o.vision, energy: o.energy }, common);
  }

  function runWhatIfShift(opt) {
    const key = Sim.shiftSimCacheKey(opt);
    if (whatIfCache.has(key)) return Promise.resolve(whatIfCache.get(key));
    if (typeof Worker === 'undefined' || typeof window === 'undefined') {
      const r = Sim.runShiftSimulationCached(opt);
      whatIfCache.set(key, r);
      return Promise.resolve(r);
    }
    return new Promise((resolve, reject) => {
      if (!whatIfWorker) {
        whatIfWorker = new Worker('assets/js/sim-worker.js');
        whatIfWorker.onmessage = (ev) => {
          const { id, result, error } = ev.data;
          const pending = pendingWhatIf.get(id);
          if (!pending) return;
          pendingWhatIf.delete(id);
          if (error) pending.reject(new Error(error));
          else {
            whatIfCache.set(pending.key, result);
            pending.resolve(result);
          }
        };
        whatIfWorker.onerror = (err) => {
          pendingWhatIf.forEach(p => p.reject(err));
          pendingWhatIf.clear();
        };
      }
      const id = ++whatIfSeq;
      pendingWhatIf.set(id, { resolve, reject, key });
      whatIfWorker.postMessage({ id, opt });
    });
  }

  function modelFromRun(r, o) {
    const lines = r.lines.map(l => ({
      id: l.id, name: l.name,
      cap: l.good,
      req: Sim.dailyRequirement(l.id, o.demand)
    }));
    const req = lines.reduce((a, l) => a + l.req, 0);
    const out = lines.reduce((a, l) => a + Math.min(l.cap, l.req), 0);
    const kwhU = 1.18 * (o.energy ? 0.9 : 1);
    const scrap = r.scrap;
    const cost = (o.shifts * 380000 + out * kwhU * 2.2 + scrap * 1800) / Math.max(1, out);
    const bottleneck = lines.slice().sort((a, b) => a.cap / a.req - b.cap / b.req)[0];
    return { oee: r.oee, lines, req, out, otd: out / req, cost, mwh: out * kwhU / 1000, scrap, bottleneck };
  }

  function model(o) {
    const r = Sim.runShiftSimulationCached(whatIfRunOptions(o));
    return modelFromRun(r, o);
  }

  async function modelAsync(o) {
    const r = await runWhatIfShift(whatIfRunOptions(o));
    return modelFromRun(r, o);
  }

  DF.model = model;
  DF.whatIfRunOptions = whatIfRunOptions;
  DF.runWhatIfShift = runWhatIfShift;
  const inputs = () => ({ demand: +$('#sDemand').value, shifts: +$('#sShifts').value, speed: +$('#sSpeed').value, pdm: $('#tPdm').checked, vision: $('#tVision').checked, energy: $('#tEnergy').checked });
  let simRunToken = 0;
  DF.runSim = async function () {
    const o = inputs();
    const token = ++simRunToken;
    $('#vDemand').textContent = o.demand + '%'; $('#vShifts').textContent = o.shifts; $('#vSpeed').textContent = o.speed + '%';
    const baseOpt = whatIfRunOptions(Object.assign({}, o, { pdm: false, vision: false, energy: false }));
    const [rShift, bShift] = await Promise.all([
      runWhatIfShift(whatIfRunOptions(o)),
      runWhatIfShift(baseOpt)
    ]);
    if (token !== simRunToken) return;
    const r = modelFromRun(rShift, o);
    const b = modelFromRun(bShift, Object.assign({}, o, { pdm: false, vision: false, energy: false }));
    const usingDF = o.pdm || o.vision || o.energy;
    const delta = (a, c, good, f) => {
      if (!usingDF || Math.abs(a - c) < 1e-9) return '<span class="muted">baseline</span>';
      const better = good === 'up' ? a > c : a < c;
      return `<span class="${better ? 'ok-text' : 'danger-text'}">${a > c ? '▲' : '▼'} ${f(Math.abs(a - c))}</span> <span class="muted">vs. without</span>`;
    };
    $('#simKpis').innerHTML = [
      ['Plant OEE', pct(r.oee), delta(r.oee, b.oee, 'up', v => (v * 100).toFixed(1) + ' pts')],
      ['Output / day', fmt(r.out), delta(r.out, b.out, 'up', fmt)],
      ['On-time delivery', pct(Math.min(1, r.otd)), delta(r.otd, b.otd, 'up', v => (v * 100).toFixed(1) + ' pts')],
      ['Cost / unit', 'EGP ' + r.cost.toFixed(1), delta(r.cost, b.cost, 'down', v => 'EGP ' + v.toFixed(1))],
      ['Scrap and rework / day', fmt(r.scrap), delta(r.scrap, b.scrap, 'down', fmt)],
      ['Energy / day', r.mwh.toFixed(1) + ' MWh', delta(r.mwh / r.out, b.mwh / b.out, 'down', v => (v * 1e6).toFixed(0) + ' Wh/unit')]
    ].map(([l, v, d]) => `<div class="mk"><div class="kpi-label">${l}</div><div class="v">${v}</div><div class="d">${d}</div></div>`).join('');
    const max = Math.max(...r.lines.map(l => Math.max(l.cap, l.req))) * 1.08;
    $('#capBars').innerHTML = r.lines.map(l => {
      const c = l.cap >= l.req ? (l.cap / l.req < 1.05 ? 'var(--warning)' : 'var(--success)') : 'var(--danger)';
      return `<div class="cb"><span>${l.name}${l.id === r.bottleneck.id ? ' <b style="color:var(--warning)">· bottleneck</b>' : ''}</span><div class="track"><div class="fill" style="width:${l.cap / max * 100}%;background:${c}"></div><div class="req" style="left:${l.req / max * 100}%"></div></div><span class="num">${fmt(l.cap)}</span></div>`;
    }).join('') + '<div class="small muted">Bar: capacity. Dark marker: required.</div>';
    const v = $('#simVerdict');
    if (r.otd >= 0.995) { v.className = 'chip chip-success'; v.textContent = 'Plan achievable'; }
    else if (r.otd >= 0.95) { v.className = 'chip chip-warning'; v.textContent = 'At risk'; }
    else { v.className = 'chip chip-danger'; v.textContent = 'Not achievable'; }
    const short = r.lines.filter(l => l.cap < l.req);
    let adv;
    if (!short.length) {
      const head = Math.min(...r.lines.map(l => l.cap / l.req)) - 1;
      adv = `<b>The plan is achievable</b> with ${(head * 100).toFixed(0)}% headroom on the tightest line (${r.bottleneck.name}).`;
      if (usingDF) adv += ` Digital Factory adds <b>${fmt(Math.max(0, r.lines.reduce((a, l) => a + l.cap, 0) - b.lines.reduce((a, l) => a + l.cap, 0)))} units a day</b> of capacity without new equipment.`;
    } else {
      adv = `<b>Short by ${fmt(short.reduce((a, l) => a + (l.req - l.cap), 0))} units a day</b> on ${short.map(l => l.name).join(', ')}. `;
      if (o.shifts < 3) adv += `Recommendation: add a <b>third shift on ${short.map(l => l.id).join(' and ')} only</b>, not the whole plant. That saves about EGP ${fmt((5 - short.length) * 76000)} a day against plant-wide overtime.`;
      else if (o.speed < 110) adv += `Recommendation: raise takt on ${r.bottleneck.name} to 108%. The twin shows yield stays above 98.5%.`;
      else adv += `This demand needs more capacity on ${r.bottleneck.name}. The twin can size it before you invest.`;
      if (!usingDF) adv += ' Turn the Digital Factory switches on to see how much of the gap AI closes by itself.';
    }
    $('#simAdvice').innerHTML = `${icon('sparkles')}<p>${adv}</p>`;
  };
  let simDebounce;
  const scheduleSim = () => { clearTimeout(simDebounce); simDebounce = setTimeout(DF.runSim, 280); };
  $$('.sim-controls input').forEach(i => i.addEventListener('input', scheduleSim));
  $$('[data-preset]').forEach(b => b.addEventListener('click', () => {
    const p = b.dataset.preset;
    if (p === 'peak') { $('#sDemand').value = 135; $('#sShifts').value = 2; $('#sSpeed').value = 100; $('#tPdm').checked = $('#tVision').checked = $('#tEnergy').checked = true; }
    if (p === 'export') { $('#sDemand').value = 120; $('#sShifts').value = 2; $('#sSpeed').value = 100; $('#tPdm').checked = $('#tVision').checked = $('#tEnergy').checked = true; }
    if (p === 'legacy') { $('#tPdm').checked = $('#tVision').checked = $('#tEnergy').checked = false; }
    DF.runSim();
  }));
})();
