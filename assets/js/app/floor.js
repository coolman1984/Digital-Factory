/* Digital Factory — live plant floor canvas + station panel. Colours come from the kit palette (DF.P). */
(function () {
  'use strict';
  const { $, P, fmt, pct, esc, STATE_LABEL, STATE_CHIP } = DF;
  const floor = $('#floor');
  let hit = [];
  const CODE = { r: 'run', w: 'warn', d: 'down', m: 'maint' };

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  const SHORT = { 'Mounter A': 'MNT-A', 'Mounter B': 'MNT-B', 'Mounter C': 'MNT-C', 'Function test': 'FCT', 'Screw robot': 'SCRW', 'Back cover': 'COVER',
    'Panel load': 'PANEL', 'Board fit': 'BOARD', 'Housing fit': 'HOUSE', 'Display bond': 'BOND', 'Palletizer': 'PLTZ', 'Final QC': 'QC', 'Unloader': 'UNLD',
    'Loader': 'LOAD', 'Printer': 'PRNT', 'Reflow': 'RFLW', 'Burn-in': 'BURN', 'Packing': 'PACK' };
  const shortName = (name, bw, ctx) => ctx.measureText(name).width < bw - 10 ? name : (SHORT[name] || name.slice(0, 4));

  DF.drawFloor = function (t) {
    const { ctx, w, h } = Charts.fit(floor);
    const S = Sim.state;
    const snap = DF.replay != null ? S.history[DF.replay] : null;
    const states = snap ? snap.st : null;
    ctx.clearRect(0, 0, w, h);
    const small = w < 640;
    const font = `Inter, "Segoe UI", system-ui, sans-serif`;
    const labelW = small ? 92 : Math.min(190, w * 0.19);
    const aisleX = labelW + 10, x0 = aisleX + 26, x1 = w - 14;
    const top = 6, bottomH = 54;
    const laneH = (h - top - bottomH) / S.lines.length;
    hit = [];
    let si = 0;

    // blueprint ground: the website's drawing grid, lanes split by hairlines instead of fills
    ctx.strokeStyle = P.border; ctx.lineWidth = 1; ctx.globalAlpha = 0.55;
    ctx.beginPath();
    for (let gx = aisleX + 0.5; gx < w; gx += 24) { ctx.moveTo(gx, 0); ctx.lineTo(gx, h); }
    for (let gy = 0.5; gy < h; gy += 24) { ctx.moveTo(aisleX, gy); ctx.lineTo(w, gy); }
    ctx.stroke(); ctx.globalAlpha = 1;
    ctx.strokeStyle = P.borderStrong; ctx.setLineDash([6, 6]); ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(aisleX, top + 10); ctx.lineTo(aisleX, h - 26); ctx.lineTo(x1, h - 26); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = P.surface; ctx.strokeStyle = P.text2; ctx.lineWidth = 1.2;
    ctx.fillRect(6, h - 46, labelW - 2, 36); ctx.strokeRect(6.5, h - 45.5, labelW - 3, 35);
    ctx.fillStyle = P.text2; ctx.font = `600 ${small ? 11 : 12.5}px ${font}`;
    ctx.fillText('Warehouse B', 18, h - 23);

    S.lines.forEach((l, li) => {
      const yc = top + laneH * li + laneH * 0.56;
      const X = f => x0 + f * (x1 - x0);
      if (li) { ctx.strokeStyle = P.border; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, Math.round(top + laneH * li) + 0.5); ctx.lineTo(w, Math.round(top + laneH * li) + 0.5); ctx.stroke(); }
      const lineSnap = snap ? snap.lines[li] : null;
      const lineOee = lineSnap ? lineSnap.oee : l.oee;
      const halted = lineSnap ? lineSnap.halted : (l.stopped || l.paused || l.starved);
      ctx.fillStyle = P.text; ctx.font = `800 ${small ? 11.5 : 14}px ${font}`;
      ctx.fillText(small ? l.id + ' ' + l.sub : l.name, 12, yc - (small ? 6 : 10));
      if (!small) { ctx.fillStyle = P.text3; ctx.font = `500 12px ${font}`; ctx.fillText(l.sub, 12, yc + 6); }
      // ISA-101: OEE in ink while normal, coloured only below benchmark
      ctx.fillStyle = lineOee >= 0.85 ? P.text : lineOee >= 0.6 ? P.warningText : P.dangerText;
      ctx.font = `700 ${small ? 11 : 12.5}px ${font}`;
      ctx.fillText(`OEE ${Math.round(lineOee * 100)}%`, 12, yc + (small ? 9 : 24));
      if (!small) { ctx.fillStyle = P.text2; ctx.font = `500 12.5px ${font}`; ctx.fillText(`${Math.round(lineSnap ? lineSnap.tph : l.tph)}/h`, 86, yc + 24); }
      if (!small && l.speed !== 1 && !snap) { ctx.fillStyle = P.brandText; ctx.font = `700 12.5px ${font}`; ctx.fillText(`${Math.round(l.speed * 100)}%`, 136, yc + 24); }

      // the conveyor as a drawing: two rails with the belt running between them
      const bh = Math.min(small ? 24 : 40, laneH * 0.5), railY = yc + bh / 2;
      ctx.strokeStyle = P.text; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(X(0), railY + 0.5); ctx.lineTo(X(1), railY + 0.5); ctx.moveTo(X(0), railY + 6.5); ctx.lineTo(X(1), railY + 6.5); ctx.stroke();
      ctx.strokeStyle = halted ? P.danger : P.text2; ctx.lineWidth = 1.2;
      ctx.setLineDash([2, 6]); ctx.lineDashOffset = halted || snap ? 0 : -t * 40 * l.speed;
      ctx.beginPath(); ctx.moveTo(X(0), railY + 3.5); ctx.lineTo(X(1), railY + 3.5); ctx.stroke(); ctx.setLineDash([]);

      if (l.material !== null) {
        const bx = X(0) - 4, bw = 8, mh = Math.min(30, laneH * 0.5), by = railY - mh;
        ctx.strokeStyle = P.text2; ctx.lineWidth = 1; ctx.strokeRect(bx + 0.5, by + 0.5, bw - 1, mh - 1);
        ctx.fillStyle = l.material < 30 ? P.danger : l.material < 55 ? P.warning : P.text2;
        ctx.fillRect(bx + 2, by + 2 + (mh - 4) * (1 - l.material / 100), bw - 4, (mh - 4) * l.material / 100);
      }

      const n = l.stations.length;
      const bw = Math.min(small ? 26 : 74, ((x1 - x0) / n) * (small ? 0.62 : 0.74));
      if (!snap) for (const u of l.units) {
        const ux = X(Math.min(1, u.x)), uy = railY - 5 + (u.out ? u.out * laneH * 0.42 : 0);
        ctx.globalAlpha = u.out ? Math.max(0, 1 - u.out) : 1;
        ctx.fillStyle = u.flagged ? P.danger : P.brand2;
        ctx.fillRect(ux - 5, uy - 3, 10, 6);
        ctx.globalAlpha = 1;
      }

      for (const s of l.stations) {
        const state = states ? CODE[states[si]] || 'run' : s.state; si++;
        const sx = X(s.x), c = P.state[state] || P.success;
        const rx = Math.round(sx - bw / 2) + 0.5, ry = Math.round(railY - bh) + 0.5;
        const normal = state === 'run';
        ctx.fillStyle = P.surface; ctx.fillRect(rx, ry, bw, bh);
        ctx.strokeStyle = normal ? P.text : c; ctx.lineWidth = normal ? 1.4 : 2; ctx.strokeRect(rx, ry, bw, bh);
        // andon light above the station; it blinks only while the state is abnormal
        const blink = snap || normal || state === 'maint' ? 1 : state === 'down' ? 0.45 + 0.55 * (Math.sin(t * 8) > 0) : 0.55 + 0.45 * Math.sin(t * 4);
        ctx.globalAlpha = blink; ctx.fillStyle = c; ctx.beginPath(); ctx.arc(sx, ry - 7, 3.4, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
        if (s.machine) {
          ctx.fillStyle = P.surface3; ctx.fillRect(rx + 6, ry + bh - 8, bw - 12, 3);
          ctx.fillStyle = s.health > 75 ? P.text2 : s.health > 50 ? P.warning : P.danger;
          ctx.fillRect(rx + 6, ry + bh - 8, (bw - 12) * s.health / 100, 3);
        }
        if (s.id === DF.selected) {
          // the website's reticle: four corner brackets around the selected station
          const m = 6, k = 9, L = rx - m, T = ry - m, R = rx + bw + m, B = ry + bh + m;
          ctx.strokeStyle = P.brand2; ctx.lineWidth = 2; ctx.beginPath();
          ctx.moveTo(L, T + k); ctx.lineTo(L, T); ctx.lineTo(L + k, T); ctx.moveTo(R - k, T); ctx.lineTo(R, T); ctx.lineTo(R, T + k);
          ctx.moveTo(L, B - k); ctx.lineTo(L, B); ctx.lineTo(L + k, B); ctx.moveTo(R - k, B); ctx.lineTo(R, B); ctx.lineTo(R, B - k); ctx.stroke();
        }
        if (bw >= 40) {
          ctx.fillStyle = P.text; ctx.font = `600 11px ${font}`;
          const lbl = shortName(s.name, bw, ctx);
          ctx.fillText(lbl, sx - ctx.measureText(lbl).width / 2, ry + bh / 2 + (s.machine ? 1 : 4));
        }
        let tag = null;
        if (state === 'down') tag = 'Stopped';
        else if (state === 'maint') tag = 'Planned work';
        else if (!snap && state === 'warn' && s.machine && s.degrade > 0) tag = `Fails in ~${Math.round(Sim.rulHours(s))} h`;
        if (tag) {
          ctx.font = `700 ${small ? 10.5 : 12}px ${font}`;
          const tw = ctx.measureText(tag).width, tx = Math.max(aisleX + 4, Math.min(w - tw - 12, sx - tw / 2 - 5)), ty = ry - 31;
          ctx.fillStyle = P.surface; ctx.fillRect(tx, ty, tw + 10, 17);
          ctx.fillStyle = state === 'down' ? P.dangerText : state === 'maint' ? P.indigo : P.warningText; ctx.fillText(tag, tx + 5, ty + 12.5);
        }
        hit.push({ x: rx - 6, y: ry - 14, w: bw + 12, h: bh + 20, id: s.id });
      }
      if (!snap && (l.starved || l.stopped || l.paused)) {
        ctx.fillStyle = P.dangerText; ctx.font = `700 12px ${font}`;
        ctx.fillText(l.starved ? 'No material' : l.paused ? 'Restarting' : 'Stopped by operator', X(0.02), railY + 22);
      }
      l._y = railY; l._x0 = X(0);
    });

    if (!snap) for (const a of S.agvs) {
      let ax, ay;
      if (a.task) {
        const l = Sim.line(a.task.line);
        const k = a.task.k < 0.5 ? a.task.k * 2 : (1 - a.task.k) * 2;
        const wx = labelW - 10, wy = h - 26;
        const p2 = { x: aisleX, y: l._y + 16 }, p3 = { x: l._x0 - 10, y: l._y + 16 };
        const d1 = Math.abs(aisleX - wx), d2 = Math.abs(p2.y - wy), d3 = Math.abs(p3.x - p2.x), D = d1 + d2 + d3;
        let s = k * D;
        if (s < d1) { ax = wx + s; ay = wy; }
        else if ((s -= d1) < d2) { ax = aisleX; ay = wy - s * Math.sign(wy - p2.y); }
        else { s -= d2; ax = aisleX + s; ay = p2.y; }
      } else {
        const p = a.p < 0.5 ? a.p * 2 : (1 - a.p) * 2;
        ax = aisleX + p * (x1 - aisleX); ay = h - 26;
      }
      const pri = a.task && a.task.priority;
      ctx.fillStyle = pri ? P.warning : P.brand;
      roundRect(ctx, ax - 10, ay - 7, 20, 14, 3); ctx.fill();
      ctx.fillStyle = pri ? '#111' : '#fff'; ctx.font = `800 7px ${font}`; ctx.fillText('AGV', ax - 7.5, ay + 2.5);
      if (!small || pri) { ctx.fillStyle = pri ? P.warningText : P.text2; ctx.font = `600 11px ${font}`; ctx.fillText(a.id, ax - 17, ay - 11); }
    }
    if (snap) {
      ctx.fillStyle = P.warningText; ctx.font = `700 13px ${font}`;
      const s = `Replay · ${snap.clock}`; ctx.fillText(s, w - ctx.measureText(s).width - 16, 18);
    }
  };

  floor.addEventListener('click', e => {
    const r = floor.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    const s = hit.find(b => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h);
    if (s) DF.selectStation(s.id);
  });
  floor.addEventListener('mousemove', e => {
    const r = floor.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    floor.style.cursor = hit.some(b => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) ? 'pointer' : 'default';
  });

  const find = id => Sim.allStations().find(s => s.id === id);
  DF.selectStation = function (id, quiet) {
    DF.selected = id; DF.renderStation(true);
    if (!quiet && innerWidth < 1200) $('#stationCard').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };
  DF.renderStation = function (rebuild) {
    const s = find(DF.selected); if (!s) return;
    const l = Sim.line(s.line);
    $('#stName').textContent = `${s.name} · ${l.name}`;
    const tag = $('#stState'); tag.className = 'chip ' + STATE_CHIP[s.state]; tag.textContent = STATE_LABEL[s.state];
    if (rebuild || !$('#stVib')) {
      $('#stBody').innerHTML = `
        <div class="small muted">Health score</div>
        <div class="health-bar"><i id="stHealth"></i></div>
        <div class="st-metrics">
          <div class="m"><div class="kpi-label">Vibration</div><div class="mv" id="stVibV">-</div></div>
          <div class="m"><div class="kpi-label">Temperature</div><div class="mv" id="stTempV">-</div></div>
          <div class="m"><div class="kpi-label">Cycle time</div><div class="mv" id="stCycV">-</div></div>
          <div class="m"><div class="kpi-label">${s.machine ? 'Remaining life' : 'Line OEE'}</div><div class="mv" id="stRulV">-</div></div>
        </div>
        <canvas class="spark" id="stVib" aria-label="Vibration trend"></canvas>
        <div class="row-gap mt-sm">
          ${s.machine ? `<button type="button" class="btn btn-secondary btn-sm" id="stToMaint">Machine health</button>` : ''}
          <button type="button" class="btn btn-secondary btn-sm" id="stAsk">${DF.icon('sparkles')}Ask copilot</button>
        </div>`;
      const tm = $('#stToMaint'); if (tm) tm.onclick = () => { DF.selMachine = s.id; DF.go('maintenance'); };
      $('#stAsk').onclick = () => { DF.openCopilot(true); DF.ask(`How is ${s.name} on ${l.name} doing?`); };
    }
    const hb = $('#stHealth'); hb.style.width = s.health + '%';
    hb.style.background = s.health > 75 ? 'var(--success)' : s.health > 50 ? 'var(--warning)' : 'var(--danger)';
    $('#stVibV').textContent = s.vib.toFixed(2) + ' mm/s';
    $('#stTempV').textContent = s.temp.toFixed(1) + ' °C';
    $('#stCycV').textContent = s.cycle ? s.cycle.toFixed(1) + ' s' : '—';
    const r = Sim.rulHours(s);
    $('#stRulV').textContent = s.machine ? (s.state === 'down' ? '0 h' : (r > 2000 ? '> 2,000' : fmt(r)) + ' h') : pct(l.oee, 0);
    $('#stRulV').className = 'mv ' + (s.machine && r < 200 ? 'danger-text' : '');
    const d = s.hist.vib.slice(-60);
    Charts.line($('#stVib'), [{ data: d, color: P.brand2, fill: true, dot: true }], { min: 0, max: Math.max(8, ...d), threshold: { v: 7.1, color: P.danger } });
  };
})();
