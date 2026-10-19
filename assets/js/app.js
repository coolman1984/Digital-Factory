/* Digital Factory — Command Center UI */
(function () {
  'use strict';
  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));
  const fmt = n => Math.round(n).toLocaleString('en-US');
  const pct = (v, d = 1) => (v * 100).toFixed(d) + '%';
  const money = n => n >= 1e6 ? 'EGP ' + (n / 1e6).toFixed(2) + 'M' : n >= 1e3 ? 'EGP ' + Math.round(n / 1e3) + 'k' : 'EGP ' + Math.round(n);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const COLORS = { run: '#34d399', warn: '#fbbf24', down: '#f87171', maint: '#a78bfa', idle: '#4f8cff' };
  const STATE_LABEL = { run: 'Running', warn: 'Warning', down: 'Down', maint: 'Maintenance' };

  if (/[?&]embed=1/.test(location.search)) document.body.classList.add('embed');

  let view = 'twin';
  let selected = null;     // selected station id (twin)
  let selMachine = null;   // selected machine id (maintenance)

  /* ================= ROUTER ================= */
  function route() {
    let h = (location.hash || '#twin').slice(1);
    if (h === 'copilot') { openCopilot(true); h = 'twin'; }
    if (!$('#view-' + h)) h = 'twin';
    view = h;
    $$('.view').forEach(v => v.hidden = v.id !== 'view-' + h);
    $$('.sidenav a[data-view]').forEach(a => a.classList.toggle('active', a.dataset.view === h));
    if (h === 'maintenance') renderMachines(true);
    if (h === 'simulator') runSim();
    if (h === 'quality') renderPareto();
  }
  addEventListener('hashchange', route);

  /* ================= KPIs ================= */
  function renderKpis() {
    const S = Sim.state;
    const oee = S.oee;
    const kO = $('#kOee'); kO.textContent = pct(oee);
    kO.style.color = oee >= 0.85 ? 'var(--green)' : oee >= 0.75 ? 'var(--amber)' : 'var(--red)';
    $('#kOeeS').textContent = oee >= 0.85 ? 'World-class ≥ 85% ✓' : oee >= 0.75 ? 'Below world-class (85%)' : '⚠ Line stoppage impact';
    const u = Sim.unitsToday(), p = Sim.planToday();
    $('#kUnits').textContent = fmt(u);
    const d = (u / p - 1) * 100;
    $('#kUnitsS').innerHTML = `Plan ${fmt(p)} · <span class="${d >= 0 ? 'c-green' : 'c-red'}">${d >= 0 ? '+' : ''}${d.toFixed(1)}%</span>`;
    $('#kTph').textContent = fmt(S.tph);
    $('#kFpy').textContent = pct(S.fpy);
    $('#kFpy').style.color = S.fpy > 0.985 ? '' : 'var(--amber)';
    $('#kEnergy').textContent = (S.kw / Math.max(1, S.tph)).toFixed(2) + ' kWh';
    $('#kKw').textContent = fmt(S.kw) + ' kW now · ' + S.tariff;
    $('#kAlerts').textContent = S.alerts;
    $('#kSaved').innerHTML = `<span class="c-green">${money(S.saved)}</span> saved today`;
    $('#clock').textContent = Sim.clock();
    const open = S.insights.filter(i => i.level === 'warn' || i.level === 'crit').length;
    const b = $('#badgeMaint'); b.hidden = !S.workOrders.some(w => w.status === 'Awaiting approval' || w.status === 'Emergency repair');
  }

  /* ================= FLOOR (digital twin canvas) ================= */
  const floor = $('#floor');
  let hit = [];
  function drawFloor(t) {
    const { ctx, w, h } = Charts.fit(floor);
    const S = Sim.state;
    ctx.clearRect(0, 0, w, h);
    const small = w < 640;
    const labelW = small ? 92 : Math.min(190, w * 0.19);
    const aisleX = labelW + 10, x0 = aisleX + 26, x1 = w - 14;
    const top = 8, bottomH = 54;
    const laneH = (h - top - bottomH) / S.lines.length;
    hit = [];

    // AGV aisle (vertical + bottom)
    ctx.strokeStyle = 'rgba(34,211,238,0.25)'; ctx.setLineDash([6, 6]); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(aisleX, top + 10); ctx.lineTo(aisleX, h - 26); ctx.lineTo(x1, h - 26); ctx.stroke(); ctx.setLineDash([]);
    // warehouse
    ctx.fillStyle = 'rgba(79,140,255,0.1)'; ctx.strokeStyle = 'rgba(79,140,255,0.45)';
    roundRect(ctx, 8, h - 46, labelW - 4, 36, 8); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#9fb2d4'; ctx.font = `600 ${small ? 10 : 11.5}px Inter, system-ui, sans-serif`;
    ctx.fillText('▣ Warehouse B', 16, h - 24);

    S.lines.forEach((l, li) => {
      const yc = top + laneH * li + laneH * 0.52;
      const X = f => x0 + f * (x1 - x0);
      // lane background
      ctx.fillStyle = li % 2 ? 'rgba(255,255,255,0.012)' : 'rgba(255,255,255,0.025)';
      ctx.fillRect(0, top + laneH * li, w, laneH);
      // label
      const blocked = l.stations.some(s => s.state === 'down' || s.state === 'maint') || l.starved;
      ctx.fillStyle = '#e8f0ff'; ctx.font = `700 ${small ? 11 : 13}px Inter, system-ui, sans-serif`;
      ctx.fillText(small ? l.id + ' ' + l.name.replace('Final Assembly', 'Assy').replace('SMT Line ', 'SMT ') : l.name, 12, yc - (small ? 6 : 8));
      ctx.fillStyle = '#6a7fa6'; ctx.font = `${small ? 9.5 : 11}px Inter, system-ui, sans-serif`;
      if (!small) ctx.fillText(l.sub, 12, yc + 7);
      const oc = l.oee >= 0.85 ? COLORS.run : l.oee >= 0.6 ? COLORS.warn : COLORS.down;
      ctx.fillStyle = oc; ctx.font = `700 ${small ? 10 : 11.5}px JetBrains Mono, Consolas, monospace`;
      ctx.fillText(`OEE ${Math.round(l.oee * 100)}%`, 12, yc + (small ? 8 : 22));
      if (!small) { ctx.fillStyle = '#9fb2d4'; ctx.fillText(`${Math.round(l.tph)}/h`, 92, yc + 22); }

      // conveyor
      ctx.strokeStyle = 'rgba(120,170,255,0.18)'; ctx.lineWidth = 10; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(X(0), yc); ctx.lineTo(X(1), yc); ctx.stroke();
      ctx.strokeStyle = blocked ? 'rgba(248,113,113,0.35)' : 'rgba(34,211,238,0.5)'; ctx.lineWidth = 2;
      ctx.setLineDash([3, 9]); ctx.lineDashOffset = blocked ? 0 : -t * 40;
      ctx.beginPath(); ctx.moveTo(X(0), yc); ctx.lineTo(X(1), yc); ctx.stroke(); ctx.setLineDash([]); ctx.lineCap = 'butt';

      // material bin
      if (l.material !== null) {
        const bx = X(0) - 4, bw = 8, bh = Math.min(30, laneH * 0.5), by = yc - bh - 10;
        ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(bx, by, bw, bh);
        ctx.fillStyle = l.material < 30 ? COLORS.down : l.material < 55 ? COLORS.warn : COLORS.run;
        ctx.fillRect(bx, by + bh * (1 - l.material / 100), bw, bh * l.material / 100);
      }

      // units
      for (const u of l.units) {
        const ux = X(Math.min(1, u.x)), uy = yc + (u.out ? u.out * laneH * 0.42 : 0);
        ctx.globalAlpha = u.out ? Math.max(0, 1 - u.out) : 1;
        ctx.fillStyle = u.flagged ? COLORS.down : '#cfe8ff';
        ctx.shadowColor = u.flagged ? COLORS.down : '#22d3ee'; ctx.shadowBlur = 8;
        ctx.fillRect(ux - 4, uy - 4, 8, 8);
        ctx.shadowBlur = 0; ctx.globalAlpha = 1;
      }

      // stations
      const n = l.stations.length;
      const bw = Math.min(small ? 34 : 70, ((x1 - x0) / n) * 0.74), bh = Math.min(small ? 28 : 38, laneH * 0.52);
      for (const s of l.stations) {
        const sx = X(s.x), c = COLORS[s.state];
        const rx = sx - bw / 2, ry = yc - bh / 2;
        const pulse = s.state === 'down' ? 0.5 + 0.5 * Math.sin(t * 8) : s.state === 'warn' ? 0.5 + 0.5 * Math.sin(t * 4) : 0;
        ctx.shadowColor = c; ctx.shadowBlur = 6 + pulse * 22;
        ctx.fillStyle = 'rgba(12,20,38,0.92)'; roundRect(ctx, rx, ry, bw, bh, 7); ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = c; ctx.lineWidth = s.id === selected ? 2.6 : 1.4;
        ctx.stroke();
        if (s.id === selected) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; roundRect(ctx, rx - 4, ry - 4, bw + 8, bh + 8, 9); ctx.stroke(); }
        // LED
        ctx.fillStyle = c; ctx.beginPath(); ctx.arc(rx + bw - 7, ry + 7, 3, 0, 7); ctx.fill();
        // health bar
        if (s.machine) {
          ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(rx + 5, ry + bh - 7, bw - 10, 3);
          ctx.fillStyle = s.health > 75 ? COLORS.run : s.health > 50 ? COLORS.warn : COLORS.down;
          ctx.fillRect(rx + 5, ry + bh - 7, (bw - 10) * s.health / 100, 3);
        }
        // label
        ctx.fillStyle = '#c9d6ee'; ctx.font = `600 ${small ? 8.5 : 10}px Inter, system-ui, sans-serif`;
        const lbl = shortName(s.name, bw, ctx);
        ctx.fillText(lbl, sx - ctx.measureText(lbl).width / 2, ry + bh / 2 + 2);
        if (s.state === 'down') {
          ctx.fillStyle = COLORS.down; ctx.font = '800 12px Inter, sans-serif';
          ctx.fillText('STOPPED', sx - ctx.measureText('STOPPED').width / 2, ry - 6);
        } else if (s.state === 'maint') {
          ctx.fillStyle = COLORS.maint; ctx.font = '800 11px Inter, sans-serif';
          ctx.fillText('PLANNED', sx - ctx.measureText('PLANNED').width / 2, ry - 6);
        } else if (s.state === 'warn' && s.machine && s.degrade > 0) {
          ctx.fillStyle = COLORS.warn; ctx.font = '700 10.5px JetBrains Mono, monospace';
          const r = `RUL ${Math.round(Sim.rulHours(s))}h`;
          ctx.fillText(r, sx - ctx.measureText(r).width / 2, ry - 6);
        }
        hit.push({ x: rx - 4, y: ry - 4, w: bw + 8, h: bh + 8, id: s.id });
      }
      if (l.starved) {
        ctx.fillStyle = COLORS.down; ctx.font = '800 11px Inter, sans-serif';
        ctx.fillText('STARVED · NO MATERIAL', X(0.02), yc - bh / 2 - 6);
      }
      l._y = yc; l._x0 = X(0);
    });

    // AGVs
    for (const a of S.agvs) {
      let ax, ay;
      if (a.task) {
        const l = Sim.line(a.task.line);
        const k = a.task.k < 0.5 ? a.task.k * 2 : (1 - a.task.k) * 2; // go & return
        const wx = labelW - 10, wy = h - 26;
        const p1 = { x: aisleX, y: wy }, p2 = { x: aisleX, y: l._y + 18 }, p3 = { x: l._x0 - 10, y: l._y + 18 };
        const d1 = Math.hypot(p1.x - wx, 0), d2 = Math.abs(p2.y - p1.y), d3 = Math.abs(p3.x - p2.x), D = d1 + d2 + d3;
        let s = k * D;
        if (s < d1) { ax = wx + s; ay = wy; }
        else if ((s -= d1) < d2) { ax = aisleX; ay = wy - s * Math.sign(wy - p2.y); }
        else { s -= d2; ax = aisleX + s; ay = p2.y; }
      } else {
        const p = a.p < 0.5 ? a.p * 2 : (1 - a.p) * 2;
        ax = aisleX + p * (x1 - aisleX); ay = h - 26;
      }
      const pri = a.task && a.task.priority;
      ctx.shadowColor = pri ? '#fbbf24' : '#22d3ee'; ctx.shadowBlur = pri ? 16 : 10;
      ctx.fillStyle = pri ? '#fbbf24' : '#22d3ee';
      roundRect(ctx, ax - 9, ay - 6, 18, 12, 3); ctx.fill(); ctx.shadowBlur = 0;
      ctx.fillStyle = '#05080f'; ctx.font = '700 7px sans-serif'; ctx.fillText('AGV', ax - 7.5, ay + 2.5);
      if (!small || pri) { ctx.fillStyle = pri ? '#fbbf24' : '#6a7fa6'; ctx.font = '600 9.5px JetBrains Mono, monospace'; ctx.fillText(a.id, ax - 16, ay - 10); }
    }
  }
  function shortName(name, bw, ctx) {
    if (ctx.measureText(name).width < bw - 8) return name;
    const map = { 'Mounter A': 'MNT-A', 'Mounter B': 'MNT-B', 'Mounter C': 'MNT-C', 'Function test': 'FCT', 'Screw robot': 'SCRW', 'Back cover': 'COVER',
      'Panel load': 'PANEL', 'Board fit': 'BOARD', 'Housing fit': 'HOUSE', 'Display bond': 'BOND', 'Palletizer': 'PLTZ', 'Final QC': 'QC', 'Unloader': 'UNLD',
      'Loader': 'LOAD', 'Printer': 'PRNT', 'Reflow': 'RFLW', 'Burn-in': 'BURN', 'Packing': 'PACK' };
    return map[name] || name.slice(0, 4);
  }
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  floor.addEventListener('click', e => {
    const r = floor.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    const s = hit.find(b => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h);
    if (s) selectStation(s.id);
  });
  floor.addEventListener('mousemove', e => {
    const r = floor.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    floor.style.cursor = hit.some(b => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) ? 'pointer' : 'default';
  });

  function selectStation(id, quiet) {
    selected = id; renderStation(true);
    if (!quiet && innerWidth < 1280) $('#stationCard').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  function findStation(id) { return Sim.allStations().find(s => s.id === id); }

  function renderStation(rebuild) {
    const s = selected && findStation(selected);
    if (!s) return;
    const l = Sim.line(s.line);
    $('#stName').textContent = `${s.name} · ${l.name}`;
    const tag = $('#stState'); tag.className = 'state-tag ' + s.state; tag.textContent = STATE_LABEL[s.state];
    if (rebuild || !$('#stVib')) {
      $('#stBody').innerHTML = `
        <div class="small faint">Health score</div>
        <div class="health-bar"><i id="stHealth"></i></div>
        <div class="st-metrics">
          <div class="m"><div class="k-l">Vibration</div><div class="mv" id="stVibV">-</div></div>
          <div class="m"><div class="k-l">Temperature</div><div class="mv" id="stTempV">-</div></div>
          <div class="m"><div class="k-l">Cycle time</div><div class="mv" id="stCycV">-</div></div>
          <div class="m"><div class="k-l">${s.machine ? 'Remaining life' : 'Line OEE'}</div><div class="mv" id="stRulV">-</div></div>
        </div>
        <div class="small faint">Vibration · live (mm/s)</div>
        <canvas class="spark" id="stVib"></canvas>
        <div class="i-a" style="display:flex;gap:8px;margin-top:10px">
          ${s.machine ? '<button class="btn sm" id="stToMaint">Open in Maintenance →</button>' : ''}
          <button class="btn sm" id="stAsk">🤖 Ask about this</button>
        </div>`;
      const tm = $('#stToMaint'); if (tm) tm.onclick = () => { selMachine = s.id; location.hash = 'maintenance'; };
      $('#stAsk').onclick = () => { openCopilot(true); ask(`How is ${s.name} on ${l.name} doing?`); };
    }
    const hb = $('#stHealth'); hb.style.width = s.health + '%';
    hb.style.background = s.health > 75 ? 'var(--green)' : s.health > 50 ? 'var(--amber)' : 'var(--red)';
    $('#stVibV').textContent = s.vib.toFixed(2);
    $('#stTempV').textContent = s.temp.toFixed(1) + '°';
    $('#stCycV').textContent = s.cycle ? s.cycle.toFixed(1) + 's' : '—';
    $('#stRulV').textContent = s.machine ? (s.state === 'down' ? '0 h' : fmt(Sim.rulHours(s)) + ' h') : pct(l.oee, 0);
    $('#stRulV').className = 'mv ' + (s.machine && Sim.rulHours(s) < 200 ? 'c-red' : '');
    Charts.line($('#stVib'), [{ data: s.hist.vib.slice(-60), color: '#22d3ee', fill: true, dot: true, glow: true }], { min: 0, max: Math.max(8, ...s.hist.vib.slice(-60)), threshold: { v: 7.1, color: '#f87171' } });
  }

  /* ================= INSIGHTS ================= */
  function renderInsights() {
    const list = Sim.state.insights;
    const html = list.length ? list.map(i => `
      <div class="insight ${i.level}" data-id="${i.id}">
        <div class="i-t"><span>${i.icon || '💡'}</span><span>${esc(i.title)}</span><span class="conf">${esc(i.conf || '')}</span></div>
        <div class="i-b">${esc(i.body)}</div>
        ${i.actions.length ? `<div class="i-a">${i.actions.map(a => `<button class="btn sm ${a.primary ? 'primary' : ''}" data-act="${a.key}" data-id="${i.id}">${esc(a.label)}</button>`).join('')}</div>` : ''}
        <div class="i-meta">${i.time} · AI engine</div>
      </div>`).join('') : '<p class="faint small" style="padding:4px">All lines nominal. The AI is watching 31 machines and 2,400 signals.</p>';
    $('#insights').innerHTML = html;
    $('#eRecs') && renderEnergyRecs();
  }
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const key = b.dataset.act, id = +b.dataset.id;
    const ins = Sim.state.insights.find(i => i.id === id);
    if (key === 'inspect') { if (ins && ins.station) { location.hash = 'twin'; selectStation(ins.station); } return; }
    if (key === 'quality') { location.hash = 'quality'; return; }
    if (key === 'energy') { location.hash = 'energy'; return; }
    b.disabled = true; b.textContent = '✓ Executing…';
    Sim.act(id, key);
  });

  /* ================= EVENTS & TOASTS ================= */
  function addEvent(e) {
    const el = document.createElement('div');
    el.className = 'ev';
    const c = e.level === 'crit' ? 'c-red' : e.level === 'warn' ? 'c-amber' : e.src === 'AI' ? 'c-violet' : 'c-cyan';
    el.innerHTML = `<span class="faint">${e.time}</span><span class="src ${c}">${esc(e.src)}</span><span>${esc(e.msg)}</span>`;
    const list = $('#events'); list.prepend(el);
    while (list.children.length > 40) list.lastChild.remove();
  }
  function toast(msg, level) {
    const el = document.createElement('div'); el.className = 'toast ' + (level || '');
    el.textContent = msg; $('#toasts').append(el);
    setTimeout(() => { el.style.transition = 'opacity .4s'; el.style.opacity = 0; setTimeout(() => el.remove(), 450); }, 4600);
  }

  /* ================= MAINTENANCE ================= */
  function renderMachines(rebuild) {
    const ms = Sim.machines().slice().sort((a, b) => a.health - b.health);
    if (!selMachine) selMachine = ms[0].id;
    const box = $('#machines');
    if (rebuild || box.children.length !== ms.length) {
      box.innerHTML = ms.map(m => `<div class="mach" data-mid="${m.id}"><div class="mn"></div><div class="ml"></div><div class="health-bar"><i></i></div><div class="mr"><span class="faint">RUL</span><b class="rul"></b></div></div>`).join('');
    }
    // keep DOM order stable once built; update content
    Array.from(box.children).forEach(el => {
      const m = ms.find(x => x.id === el.dataset.mid);
      const l = Sim.line(m.line);
      el.classList.toggle('sel', m.id === selMachine);
      el.querySelector('.mn').innerHTML = `${esc(m.name)} <span class="state-tag ${m.state}" style="float:right;padding:2px 7px;font-size:9.5px">${STATE_LABEL[m.state]}</span>`;
      el.querySelector('.ml').textContent = `${l.name} · ${m.vib.toFixed(1)} mm/s · ${m.temp.toFixed(0)}°C`;
      const bar = el.querySelector('.health-bar i');
      bar.style.width = m.health + '%';
      bar.style.background = m.health > 75 ? 'var(--green)' : m.health > 50 ? 'var(--amber)' : 'var(--red)';
      const r = Sim.rulHours(m);
      const rul = el.querySelector('.rul');
      rul.textContent = m.state === 'down' ? 'FAILED' : r > 2000 ? '> 2,000 h' : fmt(r) + ' h';
      rul.className = 'rul ' + (m.state === 'down' || r < 100 ? 'c-red' : r < 800 ? 'c-amber' : 'c-green');
    });
    renderVib();
  }
  $('#machines').addEventListener('click', e => {
    const el = e.target.closest('.mach'); if (!el) return;
    selMachine = el.dataset.mid; renderMachines();
  });
  function renderVib() {
    const m = findStation(selMachine); if (!m) return;
    const l = Sim.line(m.line);
    $('#mSelName').textContent = `${m.name} · ${l.name}`;
    const r = Sim.rulHours(m);
    const tag = $('#mSelRul');
    tag.className = 'state-tag ' + (m.state === 'down' ? 'down' : r < 100 ? 'down' : r < 800 ? 'warn' : 'run');
    tag.textContent = m.state === 'down' ? 'Failed' : 'RUL ' + (r > 2000 ? '> 2,000 h' : fmt(r) + ' h');
    const data = m.hist.vib.slice(-90);
    // forecast: extrapolate trend of the last 20 points
    const k = data.slice(-20), slope = k.length > 1 ? (k[k.length - 1] - k[0]) / (k.length - 1) : 0;
    const last = data[data.length - 1] || 0;
    const fc = [last];
    const steps = 30;
    for (let i = 1; i <= steps; i++) fc.push(Math.min(9.5, last + Math.max(slope, 0.002) * i * (m.degrade > 0 ? 1.3 : 1)));
    Charts.line($('#vibChart'), [
      { data, color: '#22d3ee', fill: true, glow: true, dot: true },
      { data: fc, color: '#a78bfa', dash: [5, 5], offset: data.length - 1 }
    ], { min: 0, max: 10, n: data.length + steps, threshold: { v: 7.1, color: '#f87171', label: 'ISO 10816 alarm 7.1' }, grid: true, yFmt: v => v.toFixed(0), pad: { l: 22, r: 8, t: 12, b: 8 } });
  }
  function renderWorkOrders() {
    const base = [
      { id: 'WO-4791', title: 'Nozzle cleaning · Mounter A (L1)', status: 'Scheduled 16:00', level: 'info' },
      { id: 'WO-4788', title: 'Reflow fan bearing · SMT Line 2 (RUL ≈ 1,100 h)', status: 'Next PM window', level: 'warn' },
      { id: 'WO-4772', title: 'Torque calibration · Screw robot (L3)', status: 'Completed', level: 'ok' }
    ];
    const all = Sim.state.workOrders.concat(base);
    $('#workOrders').innerHTML = all.map(w => `<div class="wo"><span class="id">${w.id}</span><span>${esc(w.title)}</span><span class="state-tag ${w.level === 'crit' ? 'down' : w.level === 'warn' ? 'warn' : w.level === 'ok' ? 'run' : 'maint'}">${esc(w.status)}</span></div>`).join('');
  }

  /* ================= AI VISION ================= */
  const vision = $('#vision');
  const DEFECTS = ['Solder bridge', 'Missing component', 'Tombstone', 'Misalignment', 'Insufficient solder'];
  let board = null, boardNo = 24817, detections = [];
  function newBoard() {
    const S = Sim.state;
    const lineId = boardNo % 2 ? 'L2' : 'L1';
    const l = Sim.line(lineId);
    const parts = [];
    // ICs
    for (let i = 0; i < 4; i++) parts.push({ type: 'ic', x: 0.08 + i * 0.19 + Math.random() * 0.03, y: 0.18 + Math.random() * 0.08, w: 0.11 + Math.random() * 0.04, h: 0.16 + Math.random() * 0.05 });
    // passives in rows
    for (let r = 0; r < 3; r++) for (let c = 0; c < 9; c++) parts.push({ type: 'p', x: 0.08 + c * 0.095, y: 0.56 + r * 0.12, w: 0.035, h: 0.02, rot: (r + c) % 3 === 0 });
    parts.push({ type: 'cap', x: 0.86, y: 0.16, r: 0.04 });
    const p = Math.min(0.85, 0.22 * l.defectMult);
    const defs = [];
    if (Math.random() < p) {
      const solderHot = S.active.solder && lineId === 'L2';
      const type = solderHot ? (Math.random() < 0.8 ? 'Solder bridge' : 'Insufficient solder') : DEFECTS[Math.floor(Math.random() * DEFECTS.length)];
      const cands = parts.filter(q => type === 'Solder bridge' ? q.type === 'ic' : q.type === 'p');
      const target = cands[Math.floor(Math.random() * cands.length)];
      target.defect = type;
      defs.push({ type, part: target, conf: (95 + Math.random() * 4.6).toFixed(1) });
      if (Math.random() < 0.25 && type !== 'Solder bridge') {
        const t2 = parts.filter(q => q.type === 'p' && !q.defect)[Math.floor(Math.random() * 20)];
        if (t2) { t2.defect = 'Misalignment'; defs.push({ type: 'Misalignment', part: t2, conf: (93 + Math.random() * 5).toFixed(1) }); }
      }
    }
    board = { no: boardNo++, line: lineId, parts, defs, t: 0, ms: (11 + Math.random() * 6).toFixed(1), counted: false };
  }
  function drawVision(dt) {
    if (!board) newBoard();
    board.t += dt;
    const { ctx, w, h } = Charts.fit(vision);
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#03060c'; ctx.fillRect(0, 0, w, h);
    const T_IN = 0.6, T_SCAN = 1.6, T_HOLD = 1.6, T_OUT = 0.5, TOTAL = T_IN + T_SCAN + T_HOLD + T_OUT;
    const bt = board.t;
    const BW = Math.min(w * 0.74, (h - 70) * 1.6), BH = BW / 1.6;
    let bx = (w - BW) / 2;
    if (bt < T_IN) bx += (1 - ease(bt / T_IN)) * w;
    else if (bt > TOTAL - T_OUT) bx -= ease((bt - (TOTAL - T_OUT)) / T_OUT) * w;
    const by = (h - BH) / 2 + 18;
    // board
    ctx.fillStyle = '#0b4d2c'; roundRect(ctx, bx, by, BW, BH, 10); ctx.fill();
    ctx.strokeStyle = '#13703f'; ctx.lineWidth = 2; ctx.stroke();
    // traces
    ctx.strokeStyle = 'rgba(214,180,90,0.35)'; ctx.lineWidth = 1.2;
    for (let i = 0; i < 16; i++) { const y = by + BH * (0.1 + i * 0.053); ctx.beginPath(); ctx.moveTo(bx + 10, y); ctx.lineTo(bx + BW * (0.3 + (i * 37 % 60) / 100), y); ctx.lineTo(bx + BW * (0.35 + (i * 37 % 60) / 100), y + 12); ctx.stroke(); }
    // mounting holes
    ctx.fillStyle = '#c9b26a'; [[0.03, 0.05], [0.97, 0.05], [0.03, 0.93], [0.97, 0.93]].forEach(([u, v]) => { ctx.beginPath(); ctx.arc(bx + BW * u, by + BH * v, 5, 0, 7); ctx.fill(); });
    for (const p of board.parts) drawPart(ctx, p, bx, by, BW, BH);
    // scan
    const scanK = clamp01((bt - T_IN) / T_SCAN);
    if (bt > T_IN && bt < T_IN + T_SCAN) {
      const sx = bx + BW * scanK;
      const g = ctx.createLinearGradient(sx - 60, 0, sx, 0); g.addColorStop(0, 'rgba(34,211,238,0)'); g.addColorStop(1, 'rgba(34,211,238,0.35)');
      ctx.fillStyle = g; ctx.fillRect(sx - 60, by - 6, 60, BH + 12);
      ctx.strokeStyle = '#22d3ee'; ctx.lineWidth = 2; ctx.shadowColor = '#22d3ee'; ctx.shadowBlur = 14;
      ctx.beginPath(); ctx.moveTo(sx, by - 8); ctx.lineTo(sx, by + BH + 8); ctx.stroke(); ctx.shadowBlur = 0;
    }
    // detections
    for (const d of board.defs) {
      const p = d.part;
      if (bt < T_IN || scanK < p.x + 0.02) continue;
      const pad = 8;
      const px = bx + BW * p.x - pad, py = by + BH * p.y - pad;
      const pw = (p.w ? BW * p.w : BW * p.r * 2) + pad * 2, ph = (p.h ? BH * p.h : BW * p.r * 2) + pad * 2;
      ctx.strokeStyle = '#f87171'; ctx.lineWidth = 2; ctx.shadowColor = '#f87171'; ctx.shadowBlur = 10;
      ctx.strokeRect(px, py, pw, ph); ctx.shadowBlur = 0;
      const lbl = `${d.type} ${d.conf}%`;
      ctx.font = '700 11px Inter, sans-serif'; const tw = ctx.measureText(lbl).width + 10;
      ctx.fillStyle = '#f87171'; ctx.fillRect(px, py - 18, tw, 17);
      ctx.fillStyle = '#1a0606'; ctx.fillText(lbl, px + 5, py - 5.5);
    }
    // HUD
    const done = scanK >= 1;
    ctx.font = '600 12px JetBrains Mono, Consolas, monospace';
    ctx.fillStyle = '#9fb2d4'; ctx.fillText(`BOARD #${board.line}-${board.no}`, 14, 22);
    ctx.fillText(`model: df-vision-v4 · ${board.ms} ms`, 14, 40);
    if (done) {
      const fail = board.defs.length > 0;
      const tx = fail ? `✕ REJECT → rework (${board.defs.length})` : '✓ PASS';
      ctx.font = '800 15px Inter, sans-serif';
      const tw = ctx.measureText(tx).width + 20;
      ctx.fillStyle = fail ? 'rgba(248,113,113,0.18)' : 'rgba(52,211,153,0.16)';
      ctx.strokeStyle = fail ? '#f87171' : '#34d399';
      roundRect(ctx, w - tw - 14, 10, tw, 30, 8); ctx.fill(); ctx.stroke();
      ctx.fillStyle = fail ? '#f87171' : '#34d399'; ctx.fillText(tx, w - tw - 4, 30);
      if (!board.counted) {
        board.counted = true;
        $('#qMs').textContent = board.ms + ' ms';
        board.defs.forEach(d => {
          Sim.state.defects[d.type] = (Sim.state.defects[d.type] || 0) + 1;
          const el = document.createElement('div'); el.className = 'det';
          el.innerHTML = `<span class="faint">${Sim.clock()}</span><span>${board.line} #${board.no} · <b class="c-red">${d.type}</b></span><span class="c-cyan">${d.conf}%</span>`;
          $('#detections').prepend(el);
          while ($('#detections').children.length > 30) $('#detections').lastChild.remove();
        });
        if (board.defs.length) renderPareto();
      }
    }
    // corner brackets
    ctx.strokeStyle = 'rgba(34,211,238,0.5)'; ctx.lineWidth = 2;
    [[10, 10, 1, 1], [w - 10, 10, -1, 1], [10, h - 10, 1, -1], [w - 10, h - 10, -1, -1]].forEach(([x, y, sx, sy]) => {
      ctx.beginPath(); ctx.moveTo(x, y + 22 * sy); ctx.lineTo(x, y); ctx.lineTo(x + 22 * sx, y); ctx.stroke();
    });
    if (bt >= TOTAL) newBoard();
  }
  function drawPart(ctx, p, bx, by, BW, BH) {
    const x = bx + BW * p.x, y = by + BH * p.y;
    if (p.type === 'ic') {
      const w = BW * p.w, h = BH * p.h;
      ctx.fillStyle = '#c0c4cc';
      const pins = 7;
      for (let i = 0; i < pins; i++) {
        const py = y + 4 + i * (h - 8) / (pins - 1);
        ctx.fillRect(x - 6, py - 1.5, 6, 3); ctx.fillRect(x + w, py - 1.5, 6, 3);
      }
      if (p.defect === 'Solder bridge') { ctx.fillStyle = '#e3e6ea'; ctx.fillRect(x + w, y + 4 + (h - 8) / (pins - 1) * 2 - 1.5, 6, (h - 8) / (pins - 1) + 3); }
      ctx.fillStyle = '#16181d'; ctx.fillRect(x, y, w, h);
      ctx.fillStyle = '#2a2e36'; ctx.beginPath(); ctx.arc(x + 7, y + 7, 2.5, 0, 7); ctx.fill();
      ctx.fillStyle = '#5d6573'; ctx.font = '9px monospace'; ctx.fillText('DF' + Math.round(p.x * 999), x + 6, y + h - 6);
    } else if (p.type === 'p') {
      const w = BW * p.w, h = BH * p.h * 1.4;
      ctx.fillStyle = '#c9b26a'; ctx.fillRect(x - 3, y - 1, 5, h + 2); ctx.fillRect(x + w - 2, y - 1, 5, h + 2);
      if (p.defect === 'Missing component') return;
      ctx.save();
      let ox = 0, oy = 0, rot = 0, sc = 1;
      if (p.defect === 'Misalignment') { ox = w * 0.35; oy = h * 0.6; rot = 0.35; }
      if (p.defect === 'Tombstone') { sc = 0.45; rot = 0; }
      if (p.defect === 'Insufficient solder') { ctx.fillStyle = '#0b4d2c'; ctx.fillRect(x + w - 2, y, 5, h); }
      ctx.translate(x + w / 2 + ox, y + h / 2 + oy); ctx.rotate(rot);
      ctx.fillStyle = p.rot ? '#3b2f22' : '#1d2129';
      ctx.fillRect(-w / 2 * sc, -h / 2, w * sc, h);
      ctx.fillStyle = '#b8bcc4'; ctx.fillRect(-w / 2 * sc, -h / 2, 3, h); ctx.fillRect(w / 2 * sc - 3, -h / 2, 3, h);
      ctx.restore();
    } else if (p.type === 'cap') {
      const r = BW * p.r;
      ctx.fillStyle = '#2b3a55'; ctx.beginPath(); ctx.arc(x + r, y + r, r, 0, 7); ctx.fill();
      ctx.strokeStyle = '#8aa0c8'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = '#8aa0c8'; ctx.fillRect(x + r * 0.4, y + r * 0.9, r * 1.2, r * 0.2);
    }
  }
  const ease = k => 1 - Math.pow(1 - clamp01(k), 3);
  const clamp01 = k => Math.max(0, Math.min(1, k));

  function renderPareto() {
    const d = Sim.state.defects;
    const arr = Object.entries(d).sort((a, b) => b[1] - a[1]);
    const max = arr[0][1], tot = arr.reduce((a, [, v]) => a + v, 0);
    $('#pareto').innerHTML = arr.map(([k, v]) => `<div class="pb"><div class="row"><span>${k}</span><span class="mono">${v} · ${Math.round(v / tot * 100)}%</span></div><div class="bar"><i style="width:${v / max * 100}%"></i></div></div>`).join('');
    $('#qCaught').textContent = fmt(tot);
  }

  /* ================= WHAT-IF SIMULATOR ================= */
  const REQ = { L1: 0.80, L2: 0.72, L3: 0.86, L4: 0.78, L5: 0.75 };
  function model(o) {
    const over = Math.max(0, o.speed - 100);
    const A = (o.pdm ? 0.93 : 0.855) - over * 0.0022;
    const P = 0.95 - Math.max(0, 100 - o.speed) * 0.001;
    const Q = (o.vision ? 0.992 : 0.974) - over * 0.0011;
    const oee = A * P * Q;
    const hours = o.shifts * 7.5;
    const lines = Sim.state.lines.map(l => {
      const cap = l.rate * (o.speed / 100) * hours * oee;
      const req = l.rate * 15 * REQ[l.id] * (o.demand / 100);
      return { id: l.id, name: l.name, cap, req };
    });
    const req = lines.reduce((a, l) => a + l.req, 0);
    const out = lines.reduce((a, l) => a + Math.min(l.cap, l.req), 0);
    const kwhU = 1.18 * (o.energy ? 0.9 : 1);
    const scrap = out * (1 - Q);
    const cost = (o.shifts * 380000 + out * kwhU * 2.2 * 1.0 + scrap * 1800) / Math.max(1, out);
    const bottleneck = lines.slice().sort((a, b) => a.cap / a.req - b.cap / b.req)[0];
    return { oee, lines, req, out, otd: out / req, cost, mwh: out * kwhU / 1000, co2: out * kwhU * 0.47 / 1000, scrap, bottleneck, kwhU };
  }
  function simInputs() {
    return { demand: +$('#sDemand').value, shifts: +$('#sShifts').value, speed: +$('#sSpeed').value, pdm: $('#tPdm').checked, vision: $('#tVision').checked, energy: $('#tEnergy').checked };
  }
  function runSim() {
    const o = simInputs();
    $('#vDemand').textContent = o.demand + '%';
    $('#vShifts').textContent = o.shifts;
    $('#vSpeed').textContent = o.speed + '%';
    const r = model(o), b = model(Object.assign({}, o, { pdm: false, vision: false, energy: false }));
    const usingDF = o.pdm || o.vision || o.energy;
    const delta = (a, c, good, f) => {
      if (!usingDF || Math.abs(a - c) < 1e-9) return '<span class="faint">baseline</span>';
      const better = good === 'up' ? a > c : a < c;
      return `<span class="${better ? 'c-green' : 'c-red'}">${a > c ? '▲' : '▼'} ${f(Math.abs(a - c))}</span> <span class="faint">vs. without DF</span>`;
    };
    const kp = [
      ['Plant OEE', pct(r.oee), delta(r.oee, b.oee, 'up', v => (v * 100).toFixed(1) + ' pts')],
      ['Output / day', fmt(r.out), delta(r.out, b.out, 'up', fmt)],
      ['On-time delivery', pct(Math.min(1, r.otd)), delta(r.otd, b.otd, 'up', v => (v * 100).toFixed(1) + ' pts')],
      ['Cost / unit', 'EGP ' + r.cost.toFixed(1), delta(r.cost, b.cost, 'down', v => 'EGP ' + v.toFixed(1))],
      ['Scrap & rework / day', fmt(r.scrap), delta(r.scrap, b.scrap, 'down', fmt)],
      ['Energy / day', r.mwh.toFixed(1) + ' MWh', delta(r.mwh / r.out, b.mwh / b.out, 'down', v => (v * 1e6).toFixed(0) + ' Wh/unit')]
    ];
    $('#simKpis').innerHTML = kp.map(([l, v, d]) => `<div class="sk"><div class="k-l">${l}</div><div class="v">${v}</div><div class="d">${d}</div></div>`).join('');
    const max = Math.max(...r.lines.map(l => Math.max(l.cap, l.req))) * 1.08;
    $('#capBars').innerHTML = r.lines.map(l => {
      const ok = l.cap >= l.req, c = ok ? (l.cap / l.req < 1.05 ? 'var(--amber)' : 'var(--green)') : 'var(--red)';
      return `<div class="cb"><span>${l.name}${l.id === r.bottleneck.id ? ' <b class="c-amber">⚑</b>' : ''}</span><div class="track"><div class="fill" style="width:${l.cap / max * 100}%;background:${c}"></div><div class="req" style="left:${l.req / max * 100}%"></div></div><span class="num">${fmt(l.cap)}</span></div>`;
    }).join('') + '<div class="small faint" style="padding-left:2px">Bar = capacity · white marker = required · ⚑ = bottleneck</div>';
    const v = $('#simVerdict');
    if (r.otd >= 0.995) { v.className = 'state-tag run'; v.textContent = 'Plan achievable'; }
    else if (r.otd >= 0.95) { v.className = 'state-tag warn'; v.textContent = 'At risk'; }
    else { v.className = 'state-tag down'; v.textContent = 'Not achievable'; }
    const bn = r.bottleneck, short = r.lines.filter(l => l.cap < l.req);
    let adv;
    if (!short.length) {
      const head = Math.min(...r.lines.map(l => l.cap / l.req)) - 1;
      adv = `<b>Plan is achievable</b> with ${(head * 100).toFixed(0)}% headroom on the tightest line (${bn.name}).`;
      if (usingDF) adv += ` Digital Factory adds <b>+${fmt(r.out - b.out > 0 ? Math.max(0, Math.min(r.lines.reduce((a, l) => a + l.cap, 0) - b.lines.reduce((a, l) => a + l.cap, 0), 1e9)) : 0)} units/day</b> of capacity — roughly the output of a new line, without new equipment.`;
    } else {
      const gap = short.reduce((a, l) => a + (l.req - l.cap), 0);
      adv = `<b>Shortfall of ${fmt(gap)} units/day</b>, driven by ${short.map(l => l.name).join(', ')}. `;
      if (o.shifts < 3) adv += `Recommendation: add a <b>targeted 3rd shift on ${short.map(l => l.id).join(' + ')} only</b> instead of the whole plant — saves ≈ EGP ${fmt((5 - short.length) * 76000)}/day vs. plant-wide overtime.`;
      else if (o.speed < 110) adv += `Recommendation: raise takt on ${bn.name} to 108% — the twin shows quality stays above 98.5%.`;
      else adv += `Recommendation: this demand needs a capacity investment on ${bn.name}; the twin can size it before you spend.`;
      if (!usingDF) adv += ' <br><span class="faint">Tip: switch the Digital Factory toggles on to see how much of the gap AI closes on its own.</span>';
    }
    $('#simAdvice').innerHTML = '🤖 ' + adv;
  }
  $$('.sim-controls input').forEach(i => i.addEventListener('input', runSim));
  $$('[data-preset]').forEach(b => b.addEventListener('click', () => {
    const p = b.dataset.preset;
    const set = (id, v) => { $(id).value = v; };
    if (p === 'ramadan') { set('#sDemand', 135); set('#sShifts', 2); set('#sSpeed', 100); $('#tPdm').checked = $('#tVision').checked = $('#tEnergy').checked = true; }
    if (p === 'export') { set('#sDemand', 120); set('#sShifts', 2); set('#sSpeed', 100); $('#tPdm').checked = $('#tVision').checked = $('#tEnergy').checked = true; }
    if (p === 'legacy') { $('#tPdm').checked = $('#tVision').checked = $('#tEnergy').checked = false; }
    runSim();
  }));

  /* ================= ENERGY ================= */
  function renderEnergy() {
    const S = Sim.state;
    const data = S.kwHist.slice();
    Charts.line($('#kwChart'), [{ data, color: '#4f8cff', fill: true, glow: true, dot: true }], {
      min: 500, max: 1300, grid: true, yFmt: v => Math.round(v) + '', threshold: { v: 1100, color: '#f87171', label: 'Contract limit 1,100 kW' }, pad: { l: 34, r: 8, t: 12, b: 8 }
    });
    const tg = $('#tariff');
    tg.className = 'state-tag ' + (S.tariff === 'Peak' ? 'down' : S.tariff.startsWith('Peak') ? 'warn' : 'run');
    tg.textContent = S.tariff + ' tariff';
    const areas = S.lines.map(l => [l.name, l.kwNow]).concat([['Utilities (air, chillers, HVAC)', S.utilNow]]);
    const max = Math.max(...areas.map(a => a[1])) * 1.1;
    $('#eBars').innerHTML = areas.map(([n, v]) => `<div class="cb"><span>${n}</span><div class="track"><div class="fill" style="width:${v / max * 100}%;background:${n.startsWith('Util') && S.active.peak ? 'var(--red)' : 'linear-gradient(90deg,#22d3ee,#4f8cff)'}"></div></div><span class="num">${fmt(v)} kW</span></div>`).join('');
    const kwh = 21800 + S.energyKwh;
    const kp = [
      ['Energy today', (kwh / 1000).toFixed(1) + ' MWh'],
      ['Per unit', (S.kw / Math.max(1, S.tph)).toFixed(2) + ' kWh'],
      ['CO₂ today', (kwh * 0.47 / 1000).toFixed(1) + ' t'],
      ['Cost today', money(kwh * 2.2)],
      ['vs. last month', '<span class="c-green">▼ 8.4%</span>'],
      ['Peak demand', fmt(Math.max(...S.kwHist)) + ' kW']
    ];
    $('#eKpis').innerHTML = kp.map(([l, v]) => `<div class="sk"><div class="k-l">${l}</div><div class="v" style="font-size:20px">${v}</div></div>`).join('');
  }
  function renderEnergyRecs() {
    const S = Sim.state;
    const dyn = S.insights.filter(i => i.scenario === 'peak' || (i.title || '').startsWith('Peak demand'));
    const stat = [
      { level: 'info', icon: '🌡️', title: 'Reflow ovens idle-heating during breaks', body: 'Auto-setback to 180 °C during the 30-min lunch break saves ≈ 410 kWh/day with zero warm-up penalty.', conf: 'EGP 27k / month', actions: [] },
      { level: 'info', icon: '💨', title: 'Compressed-air leak suspected · Zone C', body: 'Night baseline flow up 11% since last week — ultrasonic check recommended on header C-3.', conf: 'EGP 12k / month', actions: [] }
    ];
    $('#eRecs').innerHTML = dyn.concat(stat).map(i => `<div class="insight ${i.level}"><div class="i-t"><span>${i.icon}</span><span>${esc(i.title)}</span><span class="conf">${esc(i.conf || '')}</span></div><div class="i-b">${esc(i.body)}</div>${i.actions.length ? `<div class="i-a">${i.actions.filter(a => a.key !== 'energy').map(a => `<button class="btn sm ${a.primary ? 'primary' : ''}" data-act="${a.key}" data-id="${i.id}">${esc(a.label)}</button>`).join('')}</div>` : ''}</div>`).join('');
  }

  /* ================= COPILOT ================= */
  const chat = $('#chat');
  const CHIPS = ['Summarize this shift', 'Why is OEE not higher?', 'What should we fix first?', 'Can we handle +20% demand?', 'Where are we losing quality?', 'لخّصلي الوردية 🇪🇬'];
  $('#chips').innerHTML = CHIPS.map(c => `<button class="chip">${c}</button>`).join('');
  $('#chips').addEventListener('click', e => { const c = e.target.closest('.chip'); if (c) ask(c.textContent); });
  $('#chatForm').addEventListener('submit', e => { e.preventDefault(); const v = $('#chatInput').value.trim(); if (v) { ask(v); $('#chatInput').value = ''; } });
  function openCopilot(open) {
    const d = $('#copilot');
    const o = open === undefined ? !d.classList.contains('open') : open;
    d.classList.toggle('open', o); d.setAttribute('aria-hidden', !o);
    if (o && !chat.children.length) bot(`<b>Ahlan! I'm your production copilot.</b><br>I read live data from every line, machine and AI model in the plant. Ask me anything — in English or Arabic.`, 'connected · 5 lines · 31 machines · 2,400 signals');
    if (o) setTimeout(() => $('#chatInput').focus({ preventScroll: true }), 300);
  }
  $('#btnCopilot').onclick = () => openCopilot();
  $('#closeCopilot').onclick = () => openCopilot(false);
  function user(t) { const m = document.createElement('div'); m.className = 'msg user'; m.textContent = t; chat.append(m); chat.scrollTop = chat.scrollHeight; }
  function bot(html, src, rtl) {
    const m = document.createElement('div'); m.className = 'msg bot';
    if (rtl) { m.dir = 'rtl'; m.style.textAlign = 'right'; }
    m.innerHTML = html + (src ? `<div class="src" dir="ltr">⛁ ${src}</div>` : '');
    chat.append(m); chat.scrollTop = chat.scrollHeight;
  }
  function ask(q) {
    user(q);
    const t = document.createElement('div'); t.className = 'msg bot'; t.innerHTML = '<span class="typing"><i></i><i></i><i></i></span>';
    chat.append(t); chat.scrollTop = chat.scrollHeight;
    setTimeout(() => { t.remove(); const a = answer(q); bot(a.html, a.src, a.rtl); }, 650 + Math.random() * 500);
  }
  function worstLine() { return Sim.state.lines.slice().sort((a, b) => a.oee - b.oee)[0]; }
  function lineIssues(l) {
    const out = [];
    l.stations.forEach(s => {
      if (s.state === 'down') out.push(`<b>${s.name}</b> is stopped`);
      else if (s.state === 'maint') out.push(`<b>${s.name}</b> is in a planned maintenance stop`);
      else if (s.state === 'warn') out.push(`<b>${s.name}</b> is running slow (cycle ${s.cycle.toFixed(1)} s vs. ${(3600 / l.rate).toFixed(1)} s target)`);
    });
    if (l.starved) out.push('the line is <b>starved of material</b>');
    if (l.defectMult > 1.5) out.push(`defect rate is <b>${l.defectMult.toFixed(1)}× normal</b>`);
    return out;
  }
  function answer(q) {
    const S = Sim.state, s = q.toLowerCase();
    const arabic = /[؀-ۿ]/.test(q);
    const u = Sim.unitsToday(), p = Sim.planToday();
    const crit = S.insights.filter(i => i.level === 'crit' || i.level === 'warn');
    if (arabic) {
      const wl = worstLine();
      if (/ليه|لماذا|كفاءة|oee|بطء|واقف/.test(s)) {
        const iss = lineIssues(wl);
        return { rtl: true, src: 'MES · PLC · محرك الذكاء الاصطناعي', html: `<b>أقل خط كفاءة دلوقتي هو ${wl.name}</b> بـ OEE ${pct(wl.oee, 0)}.<br>${iss.length ? 'السبب: ' + iss.map(x => x.replace(/<\/?b>/g, '')).join('، ') + '.' : 'مفيش أعطال حالياً — الفرق جاي من سرعة التشغيل.'}<br>توصيتي: ${crit.length ? 'نفّذ التوصية المفتوحة في لوحة الـ AI insights فوراً.' : 'نراجع زمن الدورة على أبطأ ماكينة في الخط.'}` };
      }
      if (/أولوية|اصلح|أصلح|الأول|نبدأ/.test(s)) {
        return { rtl: true, src: 'CMMS · Vision AI · EMS', html: `<b>أهم ٣ حاجات النهارده:</b><ul><li>${S.active.bearing ? 'تغيير رولمان Mounter B في خط SMT 1 قبل ما يقف (توفير ≈ ١٫٦ مليون جنيه)' : 'مروحة فرن الـ Reflow في خط SMT 2 — صحتها ٦٣٪، نجدول صيانتها في الـ PM الجاية'}</li><li>${S.active.solder ? 'معايرة ضغط الطابعة في خط SMT 2 — عيوب اللحام زادت ٤ أضعاف' : 'تسرب هواء مضغوط محتمل في Zone C (≈ ١٢ ألف جنيه/شهر)'}</li><li>جدولة الكمبريسور رقم ٣ برّه وقت الذروة (≈ ٤١ ألف جنيه/شهر)</li></ul>` };
      }
      return { rtl: true, src: 'MES · CMMS · Vision AI · EMS', html: `<b>ملخص الوردية لحد الساعة ${Sim.clock()}:</b><ul><li>الإنتاج: <b>${fmt(u)}</b> وحدة مقابل خطة ${fmt(p)} (${u >= p ? 'سابقين' : 'متأخرين'} ${Math.abs((u / p - 1) * 100).toFixed(1)}٪)</li><li>كفاءة المصنع OEE: <b>${pct(S.oee)}</b> — والجودة من أول مرة: <b>${pct(S.fpy)}</b></li><li>الذكاء الاصطناعي اتعامل مع <b>${S.alerts}</b> تنبيه، ووفّر <b>${money(S.saved)}</b> النهارده</li><li>${crit.length ? 'محتاج قرارك دلوقتي: ' + crit[0].title : 'مفيش حاجة محتاجة قرارك دلوقتي ✅'}</li></ul>` };
    }
    // English intents
    const stMatch = s.match(/how is (.+) on (.+) doing/);
    if (stMatch) {
      const stn = Sim.allStations().find(x => s.includes(x.name.toLowerCase()) && s.includes(Sim.line(x.line).name.toLowerCase()));
      if (stn) {
        const l = Sim.line(stn.line);
        const r = Sim.rulHours(stn);
        return { src: `${l.id} PLC · vibration sensor · RUL model`, html: `<b>${stn.name} (${l.name})</b> is <b>${STATE_LABEL[stn.state].toLowerCase()}</b>. Health ${Math.round(stn.health)}/100, vibration ${stn.vib.toFixed(2)} mm/s (alarm at 7.1), temperature ${stn.temp.toFixed(1)} °C.${stn.machine ? `<br>Predicted remaining useful life: <b>${stn.state === 'down' ? '0 h — failed' : fmt(r) + ' h'}</b>.` : ''}${stn.degrade > 0 ? '<br>⚠ The vibration trend is accelerating — I recommend approving the scheduled repair.' : ''}` };
      }
    }
    if (/summar|shift|report|brief|status/.test(s)) {
      const best = S.lines.slice().sort((a, b) => b.oee - a.oee)[0], wl = worstLine();
      return { src: 'MES · CMMS · Vision AI · EMS', html: `<b>Shift A summary · ${Sim.clock()}</b><ul><li>Output <b>${fmt(u)}</b> units vs. plan ${fmt(p)} (<span class="${u >= p ? 'c-green' : 'c-red'}">${u >= p ? '+' : ''}${((u / p - 1) * 100).toFixed(1)}%</span>)</li><li>Plant OEE <b>${pct(S.oee)}</b> · FPY <b>${pct(S.fpy)}</b></li><li>Best line: ${best.name} (${pct(best.oee, 0)}) · Weakest: ${wl.name} (${pct(wl.oee, 0)})</li><li>AI handled <b>${S.alerts}</b> alerts · <b class="c-green">${money(S.saved)}</b> saved so far today</li><li>${crit.length ? '⚠ Needs your decision: <b>' + esc(crit[0].title) + '</b>' : '✅ Nothing needs your decision right now.'}</li></ul>` };
    }
    if (/oee|slow|why|drop|down|stop|perform/.test(s)) {
      const wl = worstLine(), iss = lineIssues(wl);
      const loss = (0.85 - S.oee) * 100;
      return { src: `${wl.id} PLC · MES · AI root-cause`, html: `Plant OEE is <b>${pct(S.oee)}</b>${loss > 0 ? ` — ${loss.toFixed(1)} pts below world-class` : ' — above world-class 🎯'}.<br>The biggest drag is <b>${wl.name}</b> at ${pct(wl.oee, 0)} OEE${iss.length ? ', because ' + iss.join(' and ') : ''}.<br>${iss.length ? 'Action: ' + (crit[0] ? `approve “${esc(crit[0].title)}” in AI insights.` : 'already in hand — the line is recovering.') : 'No active faults — the remaining gap is micro-stops. I can rank them by station if you want.'}` };
    }
    if (/fix|first|priorit|focus|week|top/.test(s)) {
      const items = [];
      if (S.active.bearing) items.push(['Mounter B bearing (SMT Line 1)', 'Failure predicted — approve the 14:00 repair', 1600000]);
      if (S.active.solder) items.push(['Printer pressure (SMT Line 2)', 'Solder-bridge defects 4× normal — one-click recalibration', 240000]);
      if (S.active.peak) items.push(['Compressor #3 schedule', 'Peak-tariff spike — stagger by 20 min', 41000]);
      items.push(['Reflow fan · SMT Line 2', 'Health 63/100 — book into next PM window', 520000]);
      items.push(['Compressed-air leak · Zone C', 'Ultrasonic check on header C-3', 12000]);
      items.push(['Lunch-break oven setback', 'Auto-lower reflow to 180 °C during breaks', 27000]);
      items.sort((a, b) => b[2] - a[2]);
      return { src: 'CMMS · Vision AI · EMS · cost model', html: `<b>Top priorities, ranked by money at risk:</b><ol style="margin:6px 0;padding-left:18px">${items.slice(0, 4).map(i => `<li><b>${i[0]}</b> — ${i[1]} <span class="c-green">(${money(i[2])})</span></li>`).join('')}</ol>` };
    }
    if (/demand|capacity|\+|more|order|peak|season|export|handle/.test(s)) {
      const m = s.match(/(\d{1,3})\s*%/); const d = m ? 100 + +m[1] : 120;
      const r = model({ demand: d, shifts: 2, speed: 100, pdm: true, vision: true, energy: true });
      const r0 = model({ demand: d, shifts: 2, speed: 100, pdm: false, vision: false, energy: false });
      const short = r.lines.filter(l => l.cap < l.req);
      return { src: 'Digital twin · what-if engine', html: `I simulated <b>${d}% demand</b> on the twin:<ul><li>With Digital Factory: on-time delivery <b>${pct(Math.min(1, r.otd))}</b>, OEE ${pct(r.oee)}</li><li>Without it: on-time delivery <b>${pct(Math.min(1, r0.otd))}</b></li><li>${short.length ? `Bottleneck: <b>${short.map(l => l.name).join(', ')}</b> — a targeted 3rd shift there closes the gap.` : 'No line is short — <b>no extra shift needed</b>. 🎯'}</li></ul><a href="#simulator">Open the What-If simulator →</a>` };
    }
    if (/quality|defect|yield|fpy|scrap|reject/.test(s)) {
      const top = Object.entries(S.defects).sort((a, b) => b[1] - a[1]);
      const tot = top.reduce((a, [, v]) => a + v, 0);
      const wl = S.lines.slice().sort((a, b) => a.fpyNow - b.fpyNow)[0];
      return { src: 'Vision AI · AOI · functional test', html: `Plant first-pass yield is <b>${pct(S.fpy)}</b>. Lowest: <b>${wl.name}</b> (${pct(wl.fpyNow)}).<br>Top defects today: ${top.slice(0, 3).map(([k, v]) => `<b>${k}</b> ${Math.round(v / tot * 100)}%`).join(', ')}.<br>${S.active.solder ? 'Root cause on Line 2 is printer squeegee pressure drift — one-click fix available.' : 'Pattern analysis: bridges cluster on fine-pitch ICs — stencil aperture review recommended.'} <a href="#quality">Open AI Quality →</a>` };
    }
    if (/energy|power|kw|electric|co2|carbon|bill/.test(s)) {
      return { src: 'EMS · smart meters', html: `Plant draw is <b>${fmt(S.kw)} kW</b> (${S.tariff} tariff) · <b>${(S.kw / S.tph).toFixed(2)} kWh/unit</b>.<br>Biggest consumers: utilities ${fmt(S.utilNow)} kW and SMT Line 1 reflow.<br>Open savings identified: ≈ <b>EGP 80k/month</b> (peak staggering, oven setback, air leak). <a href="#energy">Open Energy →</a>` };
    }
    if (/maint|machine|health|fail|bearing|rul/.test(s)) {
      const ms = Sim.machines().slice().sort((a, b) => Sim.rulHours(a) - Sim.rulHours(b)).slice(0, 3);
      return { src: 'IoT sensors · RUL model', html: `<b>Machines closest to failure:</b><ul>${ms.map(m => `<li>${m.name} (${Sim.line(m.line).name}) — health ${Math.round(m.health)}, RUL <b>${m.state === 'down' ? 'failed' : fmt(Sim.rulHours(m)) + ' h'}</b></li>`).join('')}</ul><a href="#maintenance">Open Maintenance →</a>` };
    }
    return { src: 'copilot', html: `I can answer questions about output, OEE, quality, machines, energy and capacity. Try: <i>“Why is OEE not higher?”</i> or <i>“Can we handle +25% demand?”</i>` };
  }

  /* ================= PRESENTER ================= */
  $('#btnPresenter').onclick = () => { $('#presenter').hidden = !$('#presenter').hidden; };
  $('#closePresenter').onclick = () => { $('#presenter').hidden = true; };
  $$('#presenter .sc').forEach(b => b.addEventListener('click', () => { Sim.trigger(b.dataset.sc); toast('Scenario started: ' + b.textContent.trim(), ''); }));
  $('#autoplay').addEventListener('change', e => Sim.setAutoplay(e.target.checked));
  $('#resetSim').onclick = () => { Sim.reset(); $('#events').innerHTML = ''; $('#detections').innerHTML = ''; toast('Plant reset', ''); };
  addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT') return;
    if (e.key === 'c' || e.key === 'C') openCopilot();
    if (e.key === 'p' || e.key === 'P') $('#presenter').hidden = !$('#presenter').hidden;
    if (e.key === 'Escape') { openCopilot(false); $('#presenter').hidden = true; }
    const views = ['twin', 'maintenance', 'quality', 'simulator', 'energy'];
    if (/^[1-5]$/.test(e.key)) location.hash = views[+e.key - 1];
  });

  /* ================= WIRING ================= */
  Sim.on(e => {
    if (e.type === 'log') addEvent(e);
    else if (e.type === 'toast') toast(e.msg, e.level);
    else if (e.type === 'insight' || e.type === 'resolve' || e.type === 'reset') { renderInsights(); if (e.type === 'reset') { renderWorkOrders(); renderPareto(); } }
    else if (e.type === 'workorders') renderWorkOrders();
  });
  let acc = 0, acc2 = 0, t = 0;
  Sim.on(e => {
    if (e.type !== 'tick') return;
    t += e.dt; acc += e.dt; acc2 += e.dt;
    if (view === 'twin') drawFloor(t);
    if (view === 'quality') drawVision(e.dt);
    if (acc > 0.25) {
      acc = 0; renderKpis();
      if (view === 'twin') renderStation();
      if (view === 'quality') $('#qInspected').textContent = fmt(1840 + Sim.line('L1').produced + Sim.line('L2').produced);
    }
    if (acc2 > 1) {
      acc2 = 0;
      if (view === 'maintenance') renderMachines();
      if (view === 'energy') { renderEnergy(); renderEnergyRecs(); }
    }
  });

  Sim.start();
  renderInsights(); renderWorkOrders(); renderPareto();
  route();
  selectStation('L1-MounterB', true);
})();
