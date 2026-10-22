/* Digital Factory — the plant mimic and the detail panel of the command room.
   The mimic is a live plan view of Plant EG-01 drawn from the same engine as the 3D plant: halls, aisles, every
   station of the six main lines and of the LCM, SMD, injection, press and cushion lines, the conveyors and the TVs on
   them, stores and line-side stock, AGVs, milk-run trains, forklifts, people, finished goods, docks, trucks and utilities.
   ISA-101 grammar: the normal plant is grey; colour appears only where something is not normal. Overlays switch the
   encoding (status, flow, stock, energy, people). Pan with drag, zoom with the wheel, pinch or the buttons.
   The detail panel explains whatever is selected, with links onward and a deep link to the same object in 3D.
   Canvas 2D; the same information is reachable without a pointer through the value stream and the detail panel. */
(function () {
  'use strict';
  const { $, $$, esc, icon, fmt, pct, link, toRef, stChip, STATE, html } = DF;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, k) => a + (b - a) * k;
  const KINDN = { loader: 'Magazine loader', unloader: 'Magazine unloader', printer: 'Solder paste printer', spi: 'Solder paste inspection', mounter: 'Pick-and-place mounter', reflow: 'Reflow oven, 8 zones', aoi: 'Automated optical inspection', writer: 'Software download (firmware writer)', ict: 'In-circuit and function test', lcmload: 'Open-cell loading robot', blu: 'Backlight assembly (manual)', bond: 'Module bonding', lighting: 'Lighting test', robot: 'Robot cell', bench: 'Manual workstation', fct: 'Function test', aging: 'Aging rack, 20 minutes powered', wb: 'White-balance camera', qa: 'Final QA booth', packer: 'Packing station', palletizer: 'Palletizing robot', injection: 'Injection moulding machine', press: 'Stamping press', oven: 'Powder-coating oven', subassy: 'Chassis sub-assembly (manual)', cushion: 'EPS cushion moulding', repair: 'Repair bench' };
  DF.KINDN = KINDN;
  // words drawn on the canvas follow the page language, like the rest of the page
  const tt = s => (window.DFI18N && DFI18N.ar() && DFI18N.t(s)) || s;
  function polyAt(p, s) {
    for (let i = 1; i < p.length; i++) {
      const d = Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]);
      if (s <= d || i === p.length - 1) { const k = d ? clamp(s / d, 0, 1) : 0; return [p[i - 1][0] + (p[i][0] - p[i - 1][0]) * k, p[i - 1][1] + (p[i][1] - p[i - 1][1]) * k]; }
      s -= d;
    }
    return p[0];
  }

  /* ================= the mimic ================= */
  function createFloor(canvas) {
    const ctx = canvas.getContext('2d');
    const C = {};
    function palette() {
      const cs = getComputedStyle(document.documentElement), v = n => cs.getPropertyValue(n).trim();
      Object.assign(C, {
        bg: v('--bg'), surface: v('--surface'), s2: v('--surface-2'), s3: v('--surface-3'), border: v('--border'), strong: v('--border-strong'),
        text: v('--text'), text2: v('--text-2'), text3: v('--text-3'), brand: v('--brand-2'), warn: v('--warning'), bad: v('--danger'), maint: v('--indigo'),
        font: (v('--font') || 'Inter, system-ui, sans-serif') + ", 'IBM Plex Sans Arabic'"
      });
    }
    palette();
    addEventListener('themechange', () => requestAnimationFrame(palette));

    const PW = 264, PD = 168, CX = PW / 2, CZ = PD / 2;
    const view = { cx: CX, cz: CZ, scale: 4, fit: 4, W: 0, H: 0, dpr: 1 };
    let overlay = 'status', selected = null, hoverRef = null;
    const listeners = [];
    const emit = (t, d) => listeners.forEach(f => f(t, d));
    const smooth = new WeakMap();

    function resize() {
      const r = canvas.getBoundingClientRect();
      const dpr = Math.min(2, devicePixelRatio || 1);
      view.W = Math.max(200, r.width); view.H = Math.max(160, r.height); view.dpr = dpr;
      canvas.width = Math.round(view.W * dpr); canvas.height = Math.round(view.H * dpr);
      const fit = Math.min(view.W / (PW + 8), view.H / (PD + 10));
      if (Math.abs(view.scale - view.fit) < 1e-6 || !view.init) { view.scale = fit; view.cx = CX; view.cz = CZ; }
      view.fit = fit; view.init = true;
    }
    if ('ResizeObserver' in window) new ResizeObserver(resize).observe(canvas); else addEventListener('resize', resize);
    resize();

    const SX = x => (x - view.cx) * view.scale + view.W / 2;
    const SZ = z => (z - view.cz) * view.scale + view.H / 2;
    const WX = px => (px - view.W / 2) / view.scale + view.cx;
    const WZ = pz => (pz - view.H / 2) / view.scale + view.cz;
    function rrect(x, y, w, h, r) {
      r = Math.max(0, Math.min(r, w / 2, h / 2));
      ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
    }
    const alpha = (hex, a) => {
      if (!hex) return `rgba(0,0,0,${a})`;
      if (hex.startsWith('rgb')) return hex.replace(/rgba?\(([^)]+)\)/, (m, inner) => `rgba(${inner.split(',').slice(0, 3).join(',')},${a})`);
      const h = hex.replace('#', ''); const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
      return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
    };
    const stColor = st => (st === 'down' || st === 'tripped' ? C.bad : st === 'maint' || st === 'changeover' ? C.maint : st === 'warn' || st === 'starved' || st === 'micro' || st === 'blocked' ? C.warn : null);
    function ease(obj, x, z, dt, speed) {
      let r = smooth.get(obj);
      if (!r || speed > 6 || Math.hypot(r.x - x, r.z - z) > 6) { r = { x, z }; smooth.set(obj, r); return r; }
      const k = 1 - Math.exp(-dt * 14);
      r.x = lerp(r.x, x, k); r.z = lerp(r.z, z, k);
      return r;
    }
    let hits = [];
    const hit = (ref, x0, z0, x1, z1) => hits.push([ref, x0, z0, x1, z1]);
    const level = b => (b.items ? b.items.length : b.qty);

    let lastT = performance.now(), t = 0;
    function draw(P, o = {}) {
      if (!P) return;
      const now = performance.now(), dt = Math.min(0.1, (now - lastT) / 1000); lastT = now; t += dt;
      const speed = o.speed || 1, live = !o.replay;
      const { W, H, dpr } = view, s = view.scale;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
      hits = [];
      const L = P.layout;
      const fs = clamp(s * 2.2, 10, 13);
      ctx.textBaseline = 'middle';

      // halls
      for (const zn of L.ZONES) {
        rrect(SX(zn.x0), SZ(zn.z0), (zn.x1 - zn.x0) * s, (zn.z1 - zn.z0) * s, 5);
        ctx.fillStyle = C.surface; ctx.fill(); ctx.lineWidth = 1; ctx.strokeStyle = C.border; ctx.stroke();
      }
      // aisles
      ctx.strokeStyle = alpha(C.text3, 0.16); ctx.lineWidth = Math.max(1, s * 2.4); ctx.lineCap = 'butt';
      for (const A of L.AISLES) { ctx.beginPath(); ctx.moveTo(SX(A.a[0]), SZ(A.a[1])); ctx.lineTo(SX(A.b[0]), SZ(A.b[1])); ctx.stroke(); }
      for (const zn of L.ZONES) hit('zone:' + zn.id, zn.x0, zn.z0, zn.x1, zn.z1);

      // conveyors and the units on them
      const showUnits = s > 2.2;
      for (const sg of P.segs) {
        const dens = sg.items.length / Math.max(1, sg.len / sg.pitch);
        ctx.strokeStyle = overlay === 'flow' && dens > 0.85 ? C.warn : C.strong;
        ctx.lineWidth = Math.max(1, s * 0.45);
        ctx.beginPath(); sg.path.forEach((p, i) => (i ? ctx.lineTo(SX(p[0]), SZ(p[1])) : ctx.moveTo(SX(p[0]), SZ(p[1])))); ctx.stroke();
        if (!showUnits) continue;
        for (const it of sg.items) {
          const at = polyAt(sg.path, it.s);
          const r = live ? ease(it.u, at[0], at[1], dt, speed) : { x: at[0], z: at[1] };
          const w = Math.max(1.5, (it.u.type === 'tv' ? 1.2 : it.u.type === 'lcm' ? 1 : 0.35) * s);
          ctx.fillStyle = it.u.defect ? C.bad : overlay === 'flow' ? C.brand : C.text2;
          ctx.fillRect(SX(r.x) - w / 2, SZ(r.z) - w / 2, w, w);
        }
      }

      // stations
      const maxKw = 60;
      for (const st of P.stations) {
        const x0 = st.x - st.w / 2, z0 = st.z - st.d / 2;
        const px = SX(x0), pz = SZ(z0), pw = Math.max(2, st.w * s), ph = Math.max(2, st.d * s);
        const tripped = st.state === 'idle' && P.lines[st.line] && P.lines[st.line].tripped;
        const state = tripped ? 'tripped' : st.state;
        const col = stColor(state);
        let fill = C.s3, stroke = C.strong, lw = 1;
        if (overlay === 'energy') fill = alpha(C.brand, 0.06 + 0.7 * Math.sqrt(clamp((st.kwNow || 0) / maxKw, 0, 1)));
        else if (col && overlay !== 'people') { fill = alpha(col, state === 'down' || state === 'tripped' ? 0.24 : 0.17); stroke = col; lw = 1.5; }
        rrect(px, pz, pw, ph, Math.min(3, s * 0.4));
        ctx.fillStyle = fill; ctx.fill();
        if (state === 'maint' || state === 'changeover') ctx.setLineDash([4, 3]);
        ctx.lineWidth = lw; ctx.strokeStyle = stroke; ctx.stroke(); ctx.setLineDash([]);
        // aging racks fill with TVs
        if (st.kind === 'aging' && st.rack) { const k = clamp(st.rack.length / st.slots, 0, 1); ctx.fillStyle = alpha(C.text3, 0.35); ctx.fillRect(px + 1, pz + ph - Math.max(2, ph * 0.3), (pw - 2) * k, Math.max(2, ph * 0.3) - 1); }
        if (st.degrade > 0 && st.state !== 'down' && st.state !== 'maint') { ctx.fillStyle = C.warn; ctx.beginPath(); ctx.arc(px + pw - 2, pz + 2, Math.max(2.5, s * 0.5), 0, 7); ctx.fill(); }
        if (st.loto) { ctx.strokeStyle = C.maint; ctx.lineWidth = 2; ctx.strokeRect(px - 2, pz - 2, pw + 4, ph + 4); }
        if (state === 'down' || state === 'tripped') {
          const pulse = 0.55 + 0.45 * Math.sin(t * 5);
          ctx.strokeStyle = alpha(C.bad, live && !DF.reduce ? pulse : 0.9); ctx.lineWidth = 2; rrect(px - 3, pz - 3, pw + 6, ph + 6, 4); ctx.stroke();
        }
        if (s > 9 && pw > 26) {
          ctx.fillStyle = col && overlay === 'status' ? C.text : C.text2; ctx.font = `500 ${Math.min(11, s * 0.8)}px ${C.font}`; ctx.textAlign = 'center';
          const sn = tt(st.name), nm = sn.length * 5.6 > pw + 14 ? sn.split(' ')[0] : sn;
          ctx.fillText(nm, px + pw / 2, pz - 6);
        }
        hit('st:' + st.id, x0 - 0.3, z0 - 0.3, x0 + st.w + 0.3, z0 + st.d + 0.3);
      }
      // line names, always inside the line's own hall, in the first free place: in front of the first station, after the last
      // one, or else above (or, when the top row has no room, below) the first station, the same side for every line of a hall,
      // so a name never crosses a wall, an aisle, another line or another name
      const lf = clamp(s * 1.7, 9, 13), taken = [];
      ctx.font = `700 ${lf}px ${C.font}`; ctx.textBaseline = 'middle';
      const named = Object.values(P.lines).filter(Ln => Ln.kind !== 'injection' && Ln.kind !== 'cushion' && Ln.stations.length);
      const lbl = Ln => (Ln.kind === 'main' ? Ln.id : Ln.kind === 'lcm' ? 'LCM ' + Ln.id.slice(3) : Ln.kind === 'smd' ? 'SMD ' + Ln.id.slice(3) : Ln.kind === 'press' ? 'PR ' + Ln.id.slice(2) : Ln.id);
      const plan = named.map(Ln => {
        const st0 = Ln.stations[0], stN = Ln.stations[Ln.stations.length - 1], t = lbl(Ln), tw = ctx.measureText(t).width;
        const zn = L.ZONES.find(z => st0.x >= z.x0 && st0.x <= z.x1 && st0.z >= z.z0 && st0.z <= z.z1);
        const x0 = zn ? SX(zn.x0) + 4 : -Infinity, x1 = zn ? SX(zn.x1) - 4 : Infinity, start = SX(st0.x - st0.w / 2) - 3, end = SX(stN.x + stN.w / 2) + 3;
        // after the last station only where no conveyor carries on (LCM lines cross into the main lines, main lines end at the palletizer)
        const where = start - tw >= x0 ? 'before' : (Ln.kind === 'smd' || Ln.kind === 'press') && end + tw <= x1 ? 'after' : 'stack';
        const up = SZ(st0.z - st0.d / 2) - lf * 0.6 - 2, down = SZ(st0.z + st0.d / 2) + lf * 0.6 + 2;
        return { Ln, st0, t, tw, zn, x0, start, end, where, up, down, top: zn ? SZ(zn.z0) + lf * 0.6 + 3 : -Infinity };
      });
      taken.length = 0;
      const below = new Set(plan.filter(q => q.where === 'stack' && q.up < q.top).map(q => q.zn));
      for (const q of plan) {
        if (!(s > 2.4 || q.Ln.kind === 'main')) continue;
        const col = stColor(q.Ln.state) || C.text2, y = SZ(q.st0.z);
        ctx.fillStyle = col;
        if (q.where === 'before') { ctx.textAlign = 'right'; ctx.fillText(q.t, q.start, y); taken.push([q.start - q.tw, y - lf / 2, q.start, y + lf / 2]); }
        else if (q.where === 'after') { ctx.textAlign = 'left'; ctx.fillText(q.t, q.end, y); taken.push([q.end, y - lf / 2, q.end + q.tw, y + lf / 2]); }
        else {
          const lx = Math.max(q.x0, q.start + 3), ly = below.has(q.zn) ? q.down : q.up;
          taken.push([lx - 2, ly - lf / 2, lx + q.tw + 2, ly + lf / 2]);
          ctx.fillStyle = C.surface; ctx.fillRect(lx - 2, ly - lf * 0.55, q.tw + 4, lf * 1.1);
          ctx.fillStyle = col; ctx.textAlign = 'left'; ctx.fillText(q.t, lx, ly);
        }
      }
      for (const q of plan) { const x = q.st0.x - q.st0.w / 2 - 1; hit('line:' + q.Ln.id, x - 6, q.st0.z - 1.6, x, q.st0.z + 1.6); }
      ctx.textBaseline = 'middle';

      // stores, silos and line-side stock: fill gauges at their place on the floor
      const gauge = (ref, x, z, w, h, k, low, out) => {
        const px = SX(x - w / 2), pz = SZ(z - h / 2), pw = Math.max(2, w * s), ph = Math.max(2, h * s);
        ctx.fillStyle = C.s2; ctx.fillRect(px, pz, pw, ph);
        ctx.fillStyle = out ? C.bad : low ? C.warn : overlay === 'stock' ? C.brand : alpha(C.text3, 0.7); ctx.fillRect(px, pz + ph * (1 - k), pw, ph * k);
        ctx.strokeStyle = out ? C.bad : low ? C.warn : C.strong; ctx.lineWidth = 1; ctx.strokeRect(px + 0.5, pz + 0.5, pw - 1, ph - 1);
        hit(ref, x - w / 2 - 0.4, z - h / 2 - 0.4, x + w / 2 + 0.4, z + h / 2 + 0.4);
      };
      for (const id in L.POS) {
        const b = P.bufs[id]; if (!b) continue;
        const [x, z] = L.POS[id], lv = level(b), k = clamp(lv / Math.max(1, b.cap), 0, 1);
        const ls = id.startsWith('LS:');
        const low = ls ? lv <= b.rop * 0.5 && b.rop > 0 : (b.rw !== undefined && b.rw < 2700) || k < 0.12;
        if (ls) gauge('buf:' + id, x, z, 0.9, 1.6, k, low, lv < 1 && b.rop > 0);
        else gauge('buf:' + id, x, z, id.startsWith('SILO') ? 3.2 : 4.4, 3.2, k, low, lv < 1);
      }
      // finished goods bays
      for (const sl of P.fgSlots) {
        const w = Math.max(1.5, 2.2 * s);
        if (sl.p) { ctx.fillStyle = overlay === 'stock' ? C.brand : alpha(C.text3, 0.6); ctx.fillRect(SX(sl.x) - w / 2, SZ(sl.z) - w / 2, w, w); }
        else if (s > 3) { ctx.strokeStyle = C.border; ctx.lineWidth = 1; ctx.strokeRect(SX(sl.x) - w / 2, SZ(sl.z) - w / 2, w, w); }
      }
      // shipping docks and trucks
      for (const d of P.docks || []) {
        ctx.strokeStyle = C.strong; ctx.lineWidth = 1; ctx.strokeRect(SX(d.x - 3), SZ(d.z - 3), 3 * s, 6 * s);
        const tr = d.truck;
        if (tr) {
          const late = tr.order && P.t > tr.order.due;
          rrect(SX(d.x - 1), SZ(d.z - 2.4), 9 * s, 4.8 * s, 2);
          ctx.fillStyle = late ? alpha(C.bad, 0.2) : C.s3; ctx.fill(); ctx.strokeStyle = late ? C.bad : C.strong; ctx.stroke();
          const lf = clamp((tr.loaded || 0) / Math.max(1, tr.need), 0, 1);
          ctx.fillStyle = alpha(C.text3, 0.8); ctx.fillRect(SX(d.x - 0.6), SZ(d.z + 1.8), 8.2 * s * lf, 0.9 * s);
          hit('order:' + tr.order.id, d.x - 1, d.z - 2.4, d.x + 8, d.z + 2.4);
        }
      }
      // inbound trucks at the import and vendor doors
      for (const tr of P.inbound || []) {
        if (tr.state !== 'unloading' || !tr.dock) continue;
        const dk = tr.dock, w = dk.side === 'w' ? 8 : 4.6, h = dk.side === 'w' ? 4.6 : 8;
        const x = dk.side === 'w' ? dk.x - 8 : dk.x - 2.3, z = dk.side === 'w' ? dk.z - 2.3 : dk.z - 8;
        rrect(SX(x), SZ(z), w * s, h * s, 2); ctx.fillStyle = C.s3; ctx.fill(); ctx.strokeStyle = C.strong; ctx.lineWidth = 1; ctx.stroke();
        hit('inbound:' + tr.id, x, z, x + w, z + h);
      }
      // utilities
      for (const a of P.util.assets) {
        const w = 5, x0 = a.x - w / 2, z0 = a.z - w / 2;
        rrect(SX(x0), SZ(z0), w * s, w * s, 3);
        const shaved = P.shave && P.t < P.shave.until && P.shave.assets[a.id] !== undefined;
        ctx.fillStyle = overlay === 'energy' ? alpha(C.brand, 0.1 + Math.min(0.65, a.kw / 400)) : C.s3; ctx.fill();
        ctx.strokeStyle = shaved ? C.maint : C.strong; ctx.lineWidth = shaved ? 1.6 : 1; ctx.stroke();
        if (s > 6) { ctx.fillStyle = C.text2; ctx.font = `600 ${Math.min(11, s * 0.9)}px ${C.font}`; ctx.textAlign = 'center'; ctx.fillText(Math.round(a.kw) + ' kW', SX(a.x), SZ(a.z)); }
        hit('util:' + a.id, x0, z0, x0 + w, z0 + w);
      }

      // vehicles: AGVs (with routes in the flow overlay), milk-run trains, forklifts
      const veh = (a, ref, len, wid, cls) => {
        const r = live ? ease(a, a.x, a.z, dt, speed) : { x: a.x, z: a.z };
        if (a.path && (overlay === 'flow' || selected === ref)) {
          ctx.strokeStyle = alpha(a.fault ? C.bad : C.brand, 0.5); ctx.lineWidth = 1.5; ctx.setLineDash([4, 4]);
          ctx.beginPath(); ctx.moveTo(SX(r.x), SZ(r.z));
          let acc = 0; for (let i = 1; i < a.path.length; i++) { acc += Math.hypot(a.path[i][0] - a.path[i - 1][0], a.path[i][1] - a.path[i - 1][1]); if (acc > a.s) ctx.lineTo(SX(a.path[i][0]), SZ(a.path[i][1])); }
          ctx.stroke(); ctx.setLineDash([]);
        }
        ctx.save(); ctx.translate(SX(r.x), SZ(r.z)); ctx.rotate(a.h || 0);
        const lw = Math.max(5, len * s), ww = Math.max(3.5, wid * s);
        rrect(-lw / 2, -ww / 2, lw, ww, 2);
        ctx.fillStyle = a.fault ? C.bad : cls === 'tug' && overlay === 'flow' ? C.brand : C.surface; ctx.fill();
        ctx.strokeStyle = a.fault ? C.bad : a.battery < 15 ? C.warn : C.text2; ctx.lineWidth = 1.3; ctx.stroke();
        if (a.load) { ctx.fillStyle = C.text2; ctx.fillRect(-lw * 0.25, -ww * 0.25, lw * 0.5, ww * 0.5); }
        ctx.restore();
        hit(ref, r.x - Math.max(1.4, len / 2), r.z - 1.4, r.x + Math.max(1.4, len / 2), r.z + 1.4);
      };
      for (const a of P.agvs) veh(a, 'agv:' + a.id, 1.6, 1.1, 'agv');
      for (const a of P.tuggers) veh(a, 'tug:' + a.id, 6, 1.2, 'tug');
      for (const a of P.forklifts) veh(a, 'fl:' + a.id, 2.2, 1.2, 'fl');

      // people: dots when zoomed in or in the people overlay
      const showPeople = overlay === 'people';
      if (showPeople || s > 6) for (const p of P.people) {
        if (!p.present || p.rides) continue;
        const r = live ? ease(p, p.x, p.z, dt, speed) : { x: p.x, z: p.z };
        const rad = Math.max(1.6, s * (showPeople ? 0.5 : 0.32));
        ctx.beginPath(); ctx.arc(SX(r.x), SZ(r.z), rad, 0, 7);
        ctx.fillStyle = showPeople ? (p.role === 'Technician' ? C.maint : p.cover ? C.warn : C.brand) : C.text3; ctx.fill();
        if (showPeople) hit('person:' + p.id, r.x - 0.8, r.z - 0.8, r.x + 0.8, r.z + 0.8);
      }
      if (showPeople) for (const st of P.stations) if (st.manual && st.crew && st.crew.some(q => !q.present)) {
        ctx.strokeStyle = C.warn; ctx.lineWidth = 2; ctx.setLineDash([3, 3]); rrect(SX(st.x - st.w / 2) - 3, SZ(st.z - st.d / 2) - 3, st.w * s + 6, st.d * s + 6, 4); ctx.stroke(); ctx.setLineDash([]);
      }

      // never on a wall or an aisle
      // never on a wall or an aisle; a name too long for its hall is shortened to its first word, or left out
      ctx.font = `600 ${fs}px ${C.font}`; ctx.textBaseline = 'middle';
      for (const zn of L.ZONES) {
        const room = (zn.x1 - zn.x0) * s - 12;
        // the full name, then its first word, in the first corner of the hall (top right, top left, bottom right, bottom left)
        // that no line name uses; when every corner is taken the name is left out rather than covering a line
        const full = tt(zn.name), hy = fs * 0.6;
        for (const name of [full, full.split(/[ ,،]/)[0]]) {
          const tw = ctx.measureText(name).width; if (tw > room) continue;
          const spots = [[SX(zn.x1) - 5 - tw, SZ(zn.z0) + 4 + hy], [SX(zn.x0) + 5, SZ(zn.z0) + 4 + hy], [SX(zn.x1) - 5 - tw, SZ(zn.z1) - 4 - hy], [SX(zn.x0) + 5, SZ(zn.z1) - 4 - hy]];
          const at = spots.find(([x, y]) => !taken.some(r => x - 3 < r[2] && x + tw + 3 > r[0] && y - hy < r[3] && y + hy > r[1]));
          if (!at) continue;
          ctx.fillStyle = C.surface; ctx.fillRect(at[0] - 3, at[1] - hy, tw + 6, hy * 2);
          ctx.fillStyle = C.text3; ctx.textAlign = 'left'; ctx.fillText(name, at[0], at[1]);
          break;
        }
      }

      // selection and hover outlines
      for (const [ref, cls] of [[hoverRef, 'hover'], [selected, 'sel']]) {
        if (!ref) continue;
        let h = hits.find(x => x[0] === ref);
        if (!h && ref.startsWith('line:') && P.lines[ref.slice(5)]) {
          const ss = P.lines[ref.slice(5)].stations; if (ss.length) h = [ref, Math.min(...ss.map(q => q.x - q.w / 2)), Math.min(...ss.map(q => q.z - q.d / 2)), Math.max(...ss.map(q => q.x + q.w / 2)), Math.max(...ss.map(q => q.z + q.d / 2))];
        }
        if (!h || ref.startsWith('zone:') && cls === 'hover') continue;
        rrect(SX(h[1]) - 3, SZ(h[2]) - 3, (h[3] - h[1]) * s + 6, (h[4] - h[2]) * s + 6, 5);
        ctx.strokeStyle = cls === 'sel' ? C.brand : alpha(C.text, 0.4); ctx.lineWidth = cls === 'sel' ? 2.5 : 1.5; ctx.stroke();
      }
      if (o.replay) {
        ctx.fillStyle = alpha(C.warn, 0.92); ctx.font = `700 12px ${C.font}`; ctx.textAlign = 'left';
        rrect(10, 10, 158, 26, 13); ctx.fill(); ctx.fillStyle = '#111'; ctx.fillText(`${tt('Replay')} · ${DF.E.clockS(P.t)}`, 22, 23.5);
      }
    }

    /* where a ref sits on the plan */
    function posOf(P, ref) {
      if (!ref) return null;
      const i = ref.indexOf(':'), k = ref.slice(0, i), id = ref.slice(i + 1);
      if (k === 'st' && P.byId[id]) return [P.byId[id].x, P.byId[id].z];
      if (k === 'line' && P.lines[id]) { const ss = P.lines[id].stations; const m = ss[Math.floor(ss.length / 2)]; return m ? [m.x, m.z] : null; }
      if (k === 'buf') { const p = P.layout.POS[id]; if (p) return p; const b = P.bufs[id]; if (b && b.station && P.byId[b.station]) return [P.byId[b.station].x, P.byId[b.station].z]; return null; }
      if (k === 'agv' || k === 'tug' || k === 'fl') { const a = P.agvs.concat(P.tuggers, P.forklifts).find(x => x.id === id); return a ? [a.x, a.z] : null; }
      if (k === 'util') { const a = P.util.assets.find(x => x.id === id); return a ? [a.x, a.z] : null; }
      if (k === 'order') { const o = P.orders.find(x => x.id === id); if (o && o.truck && o.truck.dock) return [o.truck.dock.x, o.truck.dock.z]; return [234, 82]; }
      if (k === 'zone') { const z = P.layout.ZONES.find(x => x.id === id); return z ? [(z.x0 + z.x1) / 2, (z.z0 + z.z1) / 2] : null; }
      if (k === 'person') { const p = P.people.find(x => x.id === id); return p ? [p.x, p.z] : null; }
      return null;
    }

    /* pointer: hover, select, pan, zoom, pinch */
    const pick = (px, pz) => {
      const x = WX(px), z = WZ(pz);
      let best = null, area = Infinity;
      for (const h of hits) if (x >= h[1] && x <= h[3] && z >= h[2] && z <= h[4]) { const a = (h[3] - h[1]) * (h[4] - h[2]); if (a < area) { area = a; best = h[0]; } }
      return best;
    };
    const pointers = new Map();
    let drag = null, moved = false, pinch0 = null;
    canvas.addEventListener('pointerdown', e => {
      canvas.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, [e.offsetX, e.offsetY]);
      if (pointers.size === 2) { const [a, b] = [...pointers.values()]; pinch0 = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), s: view.scale }; }
      drag = { x: e.offsetX, y: e.offsetY, cx: view.cx, cz: view.cz }; moved = false;
    });
    canvas.addEventListener('pointermove', e => {
      if (pointers.has(e.pointerId)) pointers.set(e.pointerId, [e.offsetX, e.offsetY]);
      if (pointers.size === 2 && pinch0) {
        const [a, b] = [...pointers.values()]; const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
        zoomAt((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, pinch0.s * d / Math.max(1, pinch0.d) / view.scale); moved = true; return;
      }
      if (drag && pointers.size === 1) {
        const dx = e.offsetX - drag.x, dy = e.offsetY - drag.y;
        if (Math.abs(dx) + Math.abs(dy) > 4) moved = true;
        if (moved) { view.cx = drag.cx - dx / view.scale; view.cz = drag.cz - dy / view.scale; canvas.style.cursor = 'grabbing'; }
        return;
      }
      let r = pick(e.offsetX, e.offsetY);
      if (r && r.startsWith('zone:')) r = null;
      if (r !== hoverRef) hoverRef = r;
      canvas.style.cursor = r ? 'pointer' : 'grab';
      emit('tip', r ? { ref: r, x: e.clientX, y: e.clientY } : null);
    });
    const end = e => {
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinch0 = null;
      if (drag && !moved && e.type === 'pointerup') emit('select', pick(e.offsetX, e.offsetY));
      if (pointers.size === 0) drag = null;
      canvas.style.cursor = hoverRef ? 'pointer' : 'grab';
    };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);
    canvas.addEventListener('pointerleave', () => { hoverRef = null; emit('tip', null); });
    canvas.addEventListener('wheel', e => { e.preventDefault(); zoomAt(e.offsetX, e.offsetY, Math.exp(-e.deltaY * 0.0015)); }, { passive: false });
    canvas.addEventListener('dblclick', () => fit());
    function zoomAt(px, pz, k) {
      const x = WX(px), z = WZ(pz);
      view.scale = clamp(view.scale * k, view.fit * 0.8, view.fit * 12);
      view.cx = x - (px - view.W / 2) / view.scale; view.cz = z - (pz - view.H / 2) / view.scale;
    }
    function fit() { view.scale = view.fit; view.cx = CX; view.cz = CZ; }
    function focus(P, ref, zoom = 4) {
      const p = posOf(P, ref); if (!p) return;
      if (ref.startsWith('zone:')) return zone(ref.slice(5));
      view.scale = clamp(view.fit * zoom, view.fit, view.fit * 12); view.cx = p[0]; view.cz = p[1];
    }
    function zone(id) {
      const Z = id && DF.P.layout.ZONES.find(x => x.id === id);
      if (!Z) return fit();
      view.scale = clamp(Math.min(view.W / (Z.x1 - Z.x0 + 6), view.H / (Z.z1 - Z.z0 + 6)), view.fit, view.fit * 12);
      view.cx = (Z.x0 + Z.x1) / 2; view.cz = (Z.z0 + Z.z1) / 2;
    }
    return {
      draw, posOf, fit, focus, zone,
      zoom: k => zoomAt(view.W / 2, view.H / 2, k),
      on(fn) { listeners.push(fn); },
      setOverlay(o) { overlay = o; }, get overlay() { return overlay; },
      select(r) { selected = r; }
    };
  }

  /* ================= shared pieces of the panels ================= */
  const kv = rows => `<dl class="kv">${rows.filter(Boolean).map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${v}</dd></div>`).join('')}</dl>`;
  const sect = (title, body, note = '') => (body ? `<section class="insp-sec"><h4>${esc(title)}${note ? ` <small class="muted">· ${esc(note)}</small>` : ''}</h4>${body}</section>` : '');
  const bar = (k, cls = '') => Viz.meter(k, cls);
  const list = rows => (rows.length ? `<ul class="list">${rows.map(([a, b]) => `<li><span>${a}</span><span>${b}</span></li>`).join('')}</ul>` : '');
  const evRows = evs => (evs.length ? `<ol class="events small-ev">${evs.map(e => `<li class="${esc(e.level)}"><time>${esc(e.time)}</time><span class="src">${esc(e.src)}</span><span>${esc(e.msg)}</span></li>`).join('')}</ol>` : '');
  Object.assign(DF, { kv, sect, bar, list });
  const mins = s => DF.E.mins(s), clock = t => DF.E.clock(t);
  const lineOf = id => DF.P.lines[id];
  const unitLink = u => (u ? link('unit:' + u.sn, u.sn) : '—');
  const acts = (ref, extra = '') => `<div class="acts">${extra}<a class="btn btn-secondary btn-sm" href="plant.html#${esc(ref)}"><span data-icon="layers"></span>Open in 3D</a><button type="button" class="btn btn-secondary btn-sm" data-ask="${esc(ref)}"><span data-icon="sparkles"></span>Ask the copilot</button></div>`;
  // decisions that concern this object, as links into the agents view
  function decisionsFor(ref) {
    const P = DF.P, id = ref.slice(ref.indexOf(':') + 1);
    const rs = P.recs.filter(r => r.ref && (toRef(r.ref) === ref || r.ref === id));
    return rs.length ? sect('Waiting for a decision', rs.map(r => `<p class="small dec-l">${link('card:' + r.key, r.title)}<br><span class="muted">${esc(r.agent)} agent · ${esc(r.time)}</span></p>`).join('')) : '';
  }

  /* ================= the detail panels ================= */
  function plantNow() {
    const P = DF.P, k = P.kpi, M = DF.E.MODELS;
    const mains = Object.values(P.lines).filter(L => L.kind === 'main');
    const down = P.stations.filter(s => s.state === 'down' || s.state === 'maint');
    const preds = P.preds.slice().sort((a, b) => a.eta - b.eta).filter(p => !p.covered).slice(0, 3);
    return `<div class="plant-now"><p class="kind">Nothing selected</p><h3>The plant now</h3>
      <ul class="list">${mains.map(L => `<li><span>${link('line:' + L.id, L.name)} <small class="muted">${esc(M[L.model].name)}</small></span><span>${stChip(L.state)} · ${fmt(L.tph)}/h</span></li>`).join('')}</ul>
      <p style="margin-top:12px"><b>${fmt(k.units)}</b> TVs packed against a plan of ${fmt(k.plan)}. Forecast ${fmt(k.fcst)} by 14:00 against ${fmt(k.planEnd)}.</p>
      <p>${down.length ? `Stopped or in planned work: ${down.slice(0, 4).map(s => link('st:' + s.id, `${s.name} (${lineOf(s.line) ? lineOf(s.line).name : s.line})`)).join(', ')}${down.length > 4 ? ` and ${down.length - 4} more` : ''}.` : 'No machine is stopped.'}</p>
      <p>${preds.length ? `Next if nobody acts: ${preds.map(p => `${esc(p.text)} in <b>${esc(mins(p.eta))}</b>`).join('; ')}.` : 'No stock-out or failure expected: every line-side stock has its next milk run or AGV planned.'}</p>
      <p class="small muted">Select anything on the mimic or a step of the value stream. ${fmt(k.wip)} TVs in process · ${fmt(P.agvs.length)} AGVs, ${fmt(P.tuggers.length)} milk-run trains, ${fmt(P.forklifts.length)} forklifts.</p></div>`;
  }
  function sensors(s) {
    const S = s.sens || {}, H = s.hist || {}, rows = [];
    if (S.vib != null) rows.push(['Vibration', `${S.vib.toFixed(2)} <small>mm/s</small>`]);
    if (s.kind === 'reflow' && S.peak != null) rows.push(['Peak temperature', `${S.peak.toFixed(1)} <small>°C · limit 248</small>`]);
    else if (S.temp != null) rows.push([s.kind === 'oven' ? 'Cure temperature' : s.kind === 'injection' ? 'Barrel' : 'Temperature', `${S.temp.toFixed(1)} <small>°C</small>`]);
    if (s.kind === 'injection') rows.push(['Injection pressure', `${fmt(S.press || 0)} <small>bar</small>`], ['Cavity fill', `${(S.fill || 0).toFixed(1)} <small>%</small>`], ['Mould', `${esc(s.part)} <small>${esc(s.mold)} · ${fmt(s.shots || 0)} shots</small>`]);
    if (s.kind === 'mounter' && S.cph) rows.push(['Placements', `${fmt(S.cph)} <small>an hour</small>`]);
    if (s.kind === 'press' && S.tonnage) rows.push(['Tonnage', `${fmt(S.tonnage)} <small>t</small>`]);
    if (s.kind === 'cushion' && S.steam) rows.push(['Steam', `${S.steam.toFixed(2)} <small>bar</small>`]);
    if (s.kind === 'aging') rows.push(['TVs ageing', `${fmt((s.rack || []).length)} <small>of ${s.slots}</small>`]);
    if (s.kind === 'writer') rows.push(['Firmware', esc(DF.P.sw['PBA-' + lineOf(s.line).model.slice(1)].version)]);
    if (s.kind === 'oven') rows.push(['Parts in the oven', `${fmt(s.procs.length)} <small>of ${s.slots}</small>`]);
    rows.push(['Power', `${(s.kwNow || 0).toFixed(1)} <small>kW</small>`]);
    const key = H.vib && H.vib.length > 3 ? 'vib' : s.kind === 'injection' && H.press ? 'press' : (s.kind === 'oven' || s.kind === 'reflow') && H.temp ? 'temp' : 'kw';
    const lim = key === 'vib' ? 4.5 : key === 'temp' && s.kind === 'oven' ? 190 : undefined;
    const lab = { vib: 'Vibration, mm/s', press: 'Injection pressure, bar', temp: 'Temperature, °C', kw: 'Power, kW' }[key];
    return kv(rows) + (H[key] && H[key].length > 3 ? `<p class="small muted spark-l">${lab} · last ${Math.round(H[key].length / 2)} min</p><div class="spark-wide">${Viz.spark(H[key], { w: 320, h: 56, limit: lim })}</div>` : '');
  }
  function lossesHere(s) {
    const P = DF.P, rs = Object.assign({}, s.rs || {});
    if (['down', 'maint', 'micro', 'changeover', 'starved', 'blocked'].includes(s.state)) { const k = s.state + '|' + (s.why || ''); rs[k] = (rs[k] || 0) + (P.t - s.since); }
    const top = Object.entries(rs).sort((a, b) => b[1] - a[1]).slice(0, 5);
    return list(top.map(([k, v]) => { const [st, why] = k.split('|'); return [`${stChip(st)}<br><small class="muted">${esc(why || '—')}</small>`, `${(v / 60).toFixed(1)} min`]; }));
  }
  function docsHere(s) {
    const P = DF.P, X = DF.X, L = lineOf(s.line), rows = [];
    const o = L && X.pp.find(p => p.line === L.id && p.status !== 'TECO');
    if (o) rows.push(['SAP PP production order', `${esc(o.id)} · ${fmt(X.ppProgress(o))} of ${fmt(o.qty)}`]);
    for (const w of P.wo.filter(w => w.st === s.id).slice(0, 3)) rows.push([`SAP PM ${esc(w.id)}`, `${esc(w.type)} · ${esc(w.status)}`]);
    for (const n of X.ncr.filter(n => n.ref === s.id).slice(0, 2)) rows.push([`SAP QM ${esc(n.id)}`, `${esc(n.code)} · ${esc(X.D8[n.step])}`]);
    for (const a of P.audit.filter(a => a.detail && a.detail.includes(s.name) && (!L || a.detail.includes(L.name))).slice(0, 2)) rows.push([`Decision ${esc(a.id)}`, `${esc(a.action)} · ${esc(a.who)}`]);
    return list(rows);
  }
  function stationPanel(s) {
    const P = DF.P, L = lineOf(s.line);
    const prev = L && L.stations[L.stations.indexOf(s) - 1], next = L && L.stations[L.stations.indexOf(s) + 1];
    const state = s.state === 'idle' && L && L.tripped ? 'tripped' : s.state;
    const rul = s.state === 'down' ? `<span class="bad">failed</span> <small>${s.tech ? (s.tech.state === 'repairing' ? 'repair ' + esc(mins(Math.max(0, s.repair))) + ' left' : 'technician on the way') : 'waiting for a technician'}</small>` : s.state === 'maint' ? `planned work <small>${esc(mins(Math.max(0, s.repair)))} left</small>` : s.degrade > 0 ? `<span class="bad">${esc(mins((s.health - 22) / s.degrade))}</span>` : s.health < 60 ? '<span class="warn">service soon</span>' : 'none this shift';
    const feeds = (s.needs || []).map(n => { const b = n.b, lv = DF.E.level(b); return [link('buf:' + b.id, b.label), `${fmt(lv)} · ${b.rate > 1e-4 ? 'lasts ' + esc(mins(lv / b.rate)) : 'not used now'}`]; });
    const crew = (s.crew || []).map(p => [esc(p.name), p.present ? (p.cover ? 'covering' : 'present') : '<span class="warn">absent</span>']);
    if (s.tech) crew.push([esc(s.tech.name), 'technician']);
    return `<p class="kind">${esc(KINDN[s.kind] || s.kind)} · ${L ? link('line:' + L.id, L.name) : 'Support'}</p><h3>${esc(s.name)}</h3>
      <p>${stChip(state, s.why)} <span class="muted small">for ${esc(mins(P.t - s.since))}</span></p>
      ${kv([['Done today', `${fmt(s.counters.made)} <small>${s.counters.bad ? fmt(s.counters.bad) + ' rejected' : 'no rejects'}</small>`], ['Health', `${Math.round(s.health)} <small>/ 100</small>`], ['Failure forecast', rul], ['Speed', `${Math.round(100 / (s.speedMul || 1))}% <small>of rated</small>`], L && L.bn === s && ['Constraint', 'sets the line output'], s.loto && ['Lockout', `by ${esc(s.loto.by)}`]])}
      ${decisionsFor('st:' + s.id)}
      ${sect('Live signals', sensors(s))}
      ${sect('Time lost here', lossesHere(s), 'by reason code')}
      ${sect('Fed by', list(feeds))}
      ${sect('Documents', docsHere(s), 'SAP and decisions')}
      ${sect('People', list(crew))}
      ${sect('Linked to', list([prev && ['Upstream', link('st:' + prev.id, prev.name)], next && ['Downstream', link('st:' + next.id, next.name)]].filter(Boolean)))}
      ${acts('st:' + s.id, `<a class="btn btn-secondary btn-sm" href="#control" data-hmi-open="${esc(s.id)}"><span data-icon="settings"></span>HMI</a>`)}`;
  }
  function linePanel(L) {
    const P = DF.P, X = DF.X, M = DF.E.MODELS, n = L.id.replace(/\D/g, '');
    const o = X.pp.find(p => p.line === L.id && p.status !== 'TECO');
    const feeders = L.kind === 'main' ? ['LCM' + n, 'SMD' + n, 'CUS' + n].map(lineOf).filter(Boolean).map(f => [link('line:' + f.id, f.name), `${stChip(f.state)} · ${fmt(f.tph)}/h`]) : [];
    const ls = L.ls ? Object.values(L.ls).map(b => { const lv = DF.E.level(b); return [link('buf:' + b.id, b.label), `${fmt(lv)} / ${fmt(b.cap)} ${bar(lv / b.cap, lv <= b.rop * 0.5 ? 'warn' : '')}`]; }) : [];
    const sub = L.kind === 'press' ? `Chassis ${L.size}"` : L.model && M[L.model] ? M[L.model].name : 'Back covers and stands';
    return `<p class="kind">${esc(sub)} · ${L.stations.length} station${L.stations.length > 1 ? 's' : ''}</p><h3>${esc(L.name)}</h3><p>${stChip(L.state)} <span class="muted small">${fmt(L.tph)} an hour</span></p>
      ${L.kind !== 'injection' ? kv([['OEE', pct(L.oee || 0)], ['Availability', pct(L.avail || 0, 0)], ['Performance', pct(L.perf || 0, 0)], ['Quality', pct(L.qual || 0)], ['Speed', Math.round((L.speed || 1) * 100) + '%'], o && ['SAP order', `${esc(o.id)} <small>${fmt(X.ppProgress(o))} of ${fmt(o.qty)}</small>`]]) : ''}
      ${decisionsFor('line:' + L.id)}
      ${sect('Lines feeding it', list(feeders))}
      ${sect('Line-side stock', list(ls))}
      ${sect('Stations', list(L.stations.map(s => [link('st:' + s.id, s.name) + (L.bn === s ? ' <small class="muted">· constraint</small>' : ''), stChip(s.state)])))}
      ${acts('line:' + L.id, L.kind === 'main' ? '<a class="btn btn-secondary btn-sm" href="#control"><span data-icon="settings"></span>Control</a>' : '')}`;
  }
  function bufPanel(id) {
    const P = DF.P, X = DF.X, E = DF.E, b = P.bufs[id]; if (!b) return '';
    const lv = E.level(b), store = id.split(':')[0];
    const lots = b.lots && b.lots.length ? list(b.lots.slice(0, 6).map(l => [esc(l.id), `${fmt(l.qty)} ${esc(b.unit || 'pcs')}${P.holds.has(l.id) ? ' · <span class="bad">on hold</span>' : ''}`])) : '';
    const items = b.items && b.items.length ? `<p class="sns">${b.items.slice(-6).reverse().map(unitLink).join(' ')}${b.items.length > 6 ? ` +${fmt(b.items.length - 6)}` : ''}</p>` : '';
    if (id.startsWith('LS:')) {
      const st = P.byId[b.station], m = b.mission, rw = E.runway(b);
      return `<p class="kind">Line-side stock · ${link('st:' + st.id, st.name)} · ${esc(lineOf(st.line).name)}</p><h3>${esc(b.label)}</h3>
        ${kv([['On hand', `${fmt(lv)} <small>/ ${fmt(b.cap)}</small>`], ['Lasts', isFinite(rw) ? esc(mins(rw)) : 'not used now'], b.rop > 0 && ['Reorder at', fmt(b.rop)], ['Brought by', b.feed === 'agv' ? 'AGV' : b.feed === 'conveyor' ? 'conveyor from the cushion machine' : 'milk run ' + esc(b.feed)], b.src !== 'conv' && P.bufs[b.src] && ['Comes from', link('buf:' + b.src, P.bufs[b.src].label)]])}
        <div class="meter-row">${Viz.meter(lv / Math.max(1, b.cap), lv <= b.rop * 0.5 ? 'warn' : '')}</div>
        ${decisionsFor('buf:' + id)}
        ${sect('Delivery', m ? list([['Mission', `${esc(m.id)} · ${esc(m.reason || 'Kanban')}`], ['Vehicle', m.veh ? link('agv:' + m.veh.id, m.veh.id) : 'waiting for a free AGV']]) : b.pending ? `<p class="small">On the next milk-run lap: ${fmt(b.pending)} planned.</p>` : '<p class="small muted">No delivery needed yet.</p>')}
        ${sect('Lots here', lots)}${sect('Boards here', items)}${acts('buf:' + id)}`;
    }
    const label = { IMP: 'Import warehouse', LOC: 'Local-vendor supermarket', INJ: 'Injection supermarket', PRS: 'Chassis supermarket', PBA: 'PBA supermarket', SVC: 'Service-parts store', SILO: 'Silo', HALL: 'Hall store', WIP: 'Work in process' }[store] || 'Store';
    const mt = E.MAT[b.code];
    const pos = X.po.filter(p => p.code === b.code && p.status !== 'Closed').slice(0, 4).map(p => [esc('PO ' + p.id), `${fmt(p.qty)} · ${esc(p.status)}${p.eta - P.t > 86400 ? ` · in ${Math.round((p.eta - P.t) / 86400)} days` : ' · ETA ' + esc(clock(p.eta))}`]);
    const users = Object.values(E.LS).filter(x => x.src === id).map(x => [link('buf:' + x.id, `${P.byId[x.station].name} · ${lineOf(x.line).name}`), `${fmt(E.level(x))} line-side`]);
    return `<p class="kind">${esc(label)}${mt && mt.vendor ? ' · ' + esc(mt.vendor) : ''}</p><h3>${esc(b.label || b.code)}</h3>
      ${kv([['On hand', `${fmt(lv)} <small>/ ${fmt(b.cap)} ${esc(b.unit || 'pcs')}</small>`], ['Used today', fmt(b.used)], b.rw && isFinite(b.rw) && ['Covers', esc(mins(b.rw))], mt && ['Value', esc(X.egp(lv * mt.price))], mt && mt.lt && ['Lead time', `${mt.lt} days`]])}
      <div class="meter-row">${Viz.meter(lv / Math.max(1, b.cap), lv / b.cap < 0.12 ? 'warn' : '')}</div>
      ${decisionsFor('buf:' + id)}
      ${sect('Purchase orders', list(pos))}${sect('Feeds', list(users))}${sect('Lots', lots)}${sect('Newest boards', items)}${acts('buf:' + id)}`;
  }
  function vehPanel(a) {
    const P = DF.P;
    if (a.kind === 'tugger') {
      const pl = a.plan;
      return `<p class="kind">Milk-run train · ${esc(a.routeName)}</p><h3>${esc(a.id)}</h3><p>${stChip(a.fault ? 'down' : a.path ? 'run' : 'idle', a.fault || (a.path ? (a.phase === 'picking' ? 'Picking' : a.phase === 'delivering' ? 'Delivering' : 'Returning') : 'Waiting for its timetable'))}</p>
        ${kv([['Laps today', fmt(a.laps)], ['Last lap', esc(mins(a.lapLen))], ['Driven', `${a.km.toFixed(1)} <small>km</small>`], ['Driver', esc(a.driver ? a.driver.name : '—')]])}
        ${sect('This lap', pl ? list(pl.loads.map(l => [link('buf:' + l.b.id, `${l.b.code} → ${P.byId[l.b.station].name}`), l.got ? fmt(l.got.qty) + ' loaded' : fmt(l.need) + ' to pick'])) : '<p class="small muted">Starts every 12 minutes, or earlier when a stop is urgent.</p>')}
        ${acts('tug:' + a.id)}`;
    }
    if (a.kind === 'forklift') {
      const j = a.job;
      return `<p class="kind">Forklift · ${a.role === 'fg' ? 'finished goods and docks' : 'silos and hall stores'}</p><h3>${esc(a.id)}</h3><p>${stChip(a.path ? 'run' : 'idle', j ? (j.kind === 'store' ? 'Storing a pallet' : `Loading ${j.truck.id}`) : a.mission ? 'Refilling ' + a.mission.buf.label.toLowerCase() : 'Waiting')}</p>
        ${kv([['Driver', esc(a.driver ? a.driver.name : '—')], ['Driven', `${a.km.toFixed(1)} <small>km</small>`], j && j.truck && ['Order', link('order:' + j.truck.order.id, j.truck.order.id)]])}${acts('fl:' + a.id)}`;
    }
    const m = a.mission;
    return `<p class="kind">Automated guided vehicle · PBA boards</p><h3>${esc(a.id)}</h3><p>${stChip(a.fault ? 'down' : a.state === 'idle' ? 'idle' : 'run', a.fault || (a.state === 'idle' ? 'Parked' : a.load ? 'Carrying' : 'Driving'))}</p>
      ${kv([['Battery', `${Math.round(a.battery)}%`], ['Driven today', `${a.km.toFixed(1)} <small>km</small>`], m && ['Brings', `${fmt(m.qty)} × ${esc(m.buf.code)}`], m && ['To', link('st:' + m.buf.station, P.byId[m.buf.station].name)], m && ['Why', esc(m.reason || 'Kanban')], m && m.eta && ['Arrives', esc(clock(m.eta))]])}
      ${acts('agv:' + a.id)}`;
  }
  function orderPanel(o) {
    const P = DF.P, X = DF.X, M = DF.E.MODELS;
    const st = o.state === 'shipped' ? 'Shipped' : o.state === 'late' ? 'Shipped late' : o.state === 'partial' ? 'Part-shipped' : o.state === 'loading' ? 'Loading' : 'Open';
    const risk = DF.AG.base && DF.AG.base.lateList.includes(o.id);
    return `<p class="kind">${esc(o.customer)} · ${esc(o.channel || '')}</p><h3>Order ${esc(o.id)}</h3>
      <p>${DF.tag(o.state === 'late' || o.state === 'partial' ? 'bad' : risk ? 'warn' : '', risk ? 'Forecast short' : st)}</p>
      ${kv([['Quantity', `${fmt(o.qty)} <small>${esc(M[o.model].name)}</small>`], ['Due', esc(clock(o.due))], ['Shipped', fmt(o.shipped)], ['Value', esc(X.egp(o.value || o.qty * M[o.model].price))], o.truck && ['Truck', `${esc(o.truck.id)} <small>${esc(o.truck.dock.id)}</small>`], o.truck && ['Loaded', `${fmt(o.truck.loaded)} <small>of ${fmt(o.truck.need)}</small>`], o.atp && ['ATP at entry', o.atp.ok ? 'confirmed' : '<span class="warn">short</span>']])}
      ${o.truck ? `<div class="meter-row">${Viz.meter(o.truck.loaded / Math.max(1, o.truck.need))}</div>` : ''}
      ${acts('order:' + o.id)}`;
  }
  function utilPanel(a) {
    const P = DF.P, shaved = P.shave && P.t < P.shave.until && P.shave.assets[a.id] !== undefined;
    return `<p class="kind">Utilities</p><h3>${esc(a.name)}</h3><p>${stChip(shaved ? 'maint' : 'run', shaved ? 'Staged down for peak shaving' : 'On')}</p>
      ${kv([['Power now', `${Math.round(a.kw)} <small>kW</small>`], ['Outside air', `${P.util.ambient.toFixed(1)} <small>°C</small>`], ['Plant total', `${fmt(P.kpi.kw)} <small>kW</small>`], ['Contract', '4,000 <small>kW</small>']])}
      <div class="spark-wide">${Viz.spark(P.hist.kw, { w: 320, h: 56, limit: 4000 })}</div>
      ${acts('util:' + a.id, '<a class="btn btn-secondary btn-sm" href="#energy"><span data-icon="live"></span>Energy</a>')}`;
  }
  function zonePanel(z) {
    const P = DF.P;
    const sts = P.stations.filter(s => s.x >= z.x0 && s.x <= z.x1 && s.z >= z.z0 && s.z <= z.z1);
    const lines = [...new Set(sts.map(s => s.line))].map(lineOf).filter(Boolean);
    const down = sts.filter(s => s.state === 'down' || s.state === 'maint');
    return `<p class="kind">Area of Plant EG-01</p><h3>${esc(z.name)}</h3>
      ${kv([['Machines', fmt(sts.length)], ['Stopped', fmt(down.length)], ['Power', `${fmt(sts.reduce((a, s) => a + (s.kwNow || 0), 0))} <small>kW</small>`]])}
      ${sect('Lines here', list(lines.map(L => [link('line:' + L.id, L.name), `${stChip(L.state)} · ${fmt(L.tph)}/h`])) || '<p class="small muted">Stores, vehicles and docks: select one on the mimic.</p>')}
      ${acts('zone:' + z.id)}`;
  }
  function personPanel(p) {
    const P = DF.P, st = P.byId[p.at];
    return `<p class="kind">${esc(p.role)}</p><h3>${esc(p.name)}</h3>
      ${kv([['Where', st ? link('st:' + st.id, st.name) : lineOf(p.at) ? link('line:' + p.at, lineOf(p.at).name) : 'Maintenance shop'], ['Present', p.present ? (p.cover ? 'yes · covering' : 'yes') : '<span class="warn">absent today</span>'], p.level && ['Skill level', ['', '', 'I · in training', 'L · with help', 'U · certified', 'O · can train'][p.level]], p.role === 'Technician' && ['Doing', esc(p.state || '—')]])}`;
  }
  function inboundPanel(t) {
    return `<p class="kind">${t.area === 'IMP' ? 'Import container' : 'Vendor truck'}</p><h3>${esc(t.id)}</h3>
      ${kv([['Status', t.state === 'unloading' ? `Unloading at ${esc(t.dock.id)}` : t.state === 'due' ? `Due ${esc(clock(t.at))}` : 'Received'], ['Unloaded', Math.round(Math.min(1, t.k) * 100) + '%'], t.po && ['PO', esc(t.po)]])}
      ${sect('Load', list(t.lines.map(l => [link('buf:' + DF.E.MAT[l.code].store + ':' + l.code, l.code), fmt(l.qty)])))}`;
  }

  let F = null;
  function renderInspector(force) {
    const el = $('#inspBody'); if (!el || DF.view !== 'command') return;
    if (!force && el.contains(document.activeElement) && document.activeElement !== el) return;
    const P = DF.P, r = DF.sel;
    let out = '';
    if (r) {
      const i = r.indexOf(':'), k = r.slice(0, i), id = r.slice(i + 1);
      if (k === 'st' && P.byId[id]) out = stationPanel(P.byId[id]);
      else if (k === 'line' && P.lines[id]) out = linePanel(P.lines[id]);
      else if (k === 'buf') out = bufPanel(id);
      else if (k === 'agv' || k === 'tug' || k === 'fl') { const a = P.agvs.concat(P.tuggers, P.forklifts).find(x => x.id === id); if (a) out = vehPanel(a); }
      else if (k === 'order') { const o = P.orders.find(x => x.id === id); if (o) out = orderPanel(o); }
      else if (k === 'util') { const a = P.util.assets.find(x => x.id === id); if (a) out = utilPanel(a); }
      else if (k === 'zone') { const z = P.layout.ZONES.find(x => x.id === id); if (z) out = zonePanel(z); }
      else if (k === 'person') { const p = P.people.find(x => x.id === id); if (p) out = personPanel(p); }
      else if (k === 'inbound') { const t = P.inbound.find(x => x.id === id); if (t) out = inboundPanel(t); }
    }
    if (!out) out = plantNow();
    if (r) out = `<button type="button" class="link-btn small back-l" data-clear>← The plant now</button>` + out;
    html(el, out);
    if (typeof Theme !== 'undefined') Theme.icons(el);
  }
  DF.renderInspector = renderInspector;

  DF.select = function (ref, o = {}) {
    DF.sel = ref || null;
    if (F) F.select(DF.sel);
    if (F && o.focus && ref) F.focus(DF.P, ref, ref.startsWith('line:') ? 2.2 : 4);
    renderInspector(true);
    if (DF.vstream) DF.vstream();
    if (o.scroll && matchMedia('(max-width: 1200px)').matches) $('#insp').scrollIntoView({ behavior: DF.reduce ? 'auto' : 'smooth', block: 'start' });
  };

  /* ================= wiring ================= */
  const LEGEND = {
    status: '<span><i></i>Normal</span><span><i class="warn"></i>Slow, starved or blocked</span><span><i class="bad"></i>Stopped</span><span><i class="maint"></i>Planned work or changeover</span><span><i class="dot"></i>Wearing</span>',
    flow: '<span><i class="flow"></i>TVs, modules and boards on conveyors, vehicle routes</span><span><i class="warn"></i>Conveyor nearly full</span>',
    stock: '<span><i class="flow"></i>Stock in stores, line-side and finished goods</span><span><i class="warn"></i>Low</span><span><i class="bad"></i>Empty</span>',
    energy: '<span><i class="flow"></i>Darker means more kW</span><span>Utilities show kW now</span>',
    people: '<span><i class="flow round"></i>Operators</span><span><i class="maint round"></i>Technicians</span><span><i class="warn"></i>Station short of people</span>'
  };
  const legend = () => html($('#floorLegend'), LEGEND[F ? F.overlay : 'status']);
  DF.initMimic = function () {
    const cv = $('#floor'); if (!cv) return;
    F = createFloor(cv); DF.floor = F;
    const zs = $('#zoneSel');
    zs.innerHTML = '<option value="">Whole plant</option>' + DF.P.layout.ZONES.map(z => `<option value="${z.id}">${esc(z.name)}</option>`).join('');
    zs.onchange = () => F.zone(zs.value);
    $$('[data-zoom]').forEach(b => { b.onclick = () => (b.dataset.zoom === 'fit' ? (F.fit(), zs.value = '') : F.zoom(b.dataset.zoom === 'in' ? 1.4 : 1 / 1.4)); });
    $$('#ovl .seg').forEach(b => {
      b.onclick = () => { $$('#ovl .seg').forEach(x => { x.classList.toggle('active', x === b); x.setAttribute('aria-pressed', String(x === b)); }); F.setOverlay(b.dataset.ovl); legend(); };
    });
    F.on((t, d) => {
      if (t === 'select') DF.select(d && !d.startsWith('zone:') ? d : d);
      if (t === 'tip') {
        if (!d) return Viz.hideTip();
        const P = DF.P, r = d.ref, i = r.indexOf(':'), k = r.slice(0, i), id = r.slice(i + 1);
        let rows = [];
        if (k === 'st' && P.byId[id]) { const s = P.byId[id]; rows = [{ value: STATE[s.state] || s.state, label: s.why || KINDN[s.kind] || '', cls: 'cm' }]; if (s.sens && s.sens.vib) rows.push({ value: s.sens.vib.toFixed(1) + ' mm/s', label: 'vibration', cls: 'cm' }); }
        else if (k === 'buf' && P.bufs[id]) { const b = P.bufs[id], lv = DF.E.level(b); rows = [{ value: fmt(lv) + ' / ' + fmt(b.cap), label: b.unit || 'pcs', cls: 'cm' }]; const rw = DF.E.runway(b); if (isFinite(rw)) rows.push({ value: mins(rw), label: 'runway', cls: 'cm' }); }
        else if (k === 'line' && P.lines[id]) { const L = P.lines[id]; rows = [{ value: STATE[L.state] || L.state, label: fmt(L.tph) + ' an hour', cls: 'cm' }]; }
        else if (k === 'agv') { const a = P.agvs.find(x => x.id === id); if (a) rows = [{ value: a.fault ? 'Fault' : a.state, label: a.mission ? a.mission.buf.label : 'no mission', cls: a.fault ? 'bad' : 'cm' }, { value: Math.round(a.battery) + '%', label: 'battery', cls: 'cm' }]; }
        else if (k === 'util') { const a = P.util.assets.find(x => x.id === id); if (a) rows = [{ value: Math.round(a.kw) + ' kW', label: 'now', cls: 'cm' }]; }
        else if (k === 'order') { const o = P.orders.find(x => x.id === id); if (o && o.truck) rows = [{ value: `${fmt(o.truck.loaded)} / ${fmt(o.truck.need)}`, label: 'loaded', cls: 'cm' }]; }
        Viz.showTip(d.x, d.y, DF.refName(r), rows);
      }
    });
    legend();
  };
  DF.drawMimic = function () { if (F) F.draw(DF.P, { speed: DF.P.speed, replay: DF.replaying && DF.replaying() }); };

  // clicks anywhere in the room: refs open the command room's detail panel, units open their genealogy
  document.addEventListener('click', e => {
    const r = e.target.closest('[data-ref]');
    if (r) {
      const ref = r.dataset.ref;
      if (ref.startsWith('card:') || ref.startsWith('case:')) { if (DF.openCase) DF.openCase(ref.slice(5)); return; }
      if (ref.startsWith('unit:')) { DF.go('rootcause'); setTimeout(() => DF.trace && DF.trace(ref.slice(5)), 30); return; }
      if (ref.startsWith('dept:')) return;
      if (DF.view !== 'command') DF.go('command');
      DF.select(ref, { focus: true, scroll: true });
      return;
    }
    if (e.target.closest('[data-clear]')) { DF.select(null); if (F) F.fit(); return; }
    const ask = e.target.closest('[data-ask]');
    if (ask && window.Copilot) { Copilot.open(`Tell me about ${DF.refName(ask.dataset.ask)}: its state, what is driving it and what you would do.`); return; }
    const hm = e.target.closest('[data-hmi-open]');
    if (hm) DF.hmiTarget = hm.dataset.hmiOpen;
  });
})();
