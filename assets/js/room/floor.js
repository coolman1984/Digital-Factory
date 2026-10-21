/* Digital Factory — the plant mimic: a live plan view of Plant EG-01 drawn from the twin (window.Floor).
   Same coordinates as the 3D plant: every station, conveyor, unit on a conveyor, AGV and its route, forklift, person,
   rack slot, pallet, truck and utility asset is drawn from the engine's world, so the mimic and the 3D view always agree.
   ISA-101 grammar: the normal plant is grey; colour appears only where something is not normal. Overlays switch the
   encoding (status, flow, energy, quality, people). Pan with drag, zoom with the wheel, pinch or the buttons.
   Canvas 2D; the same information is reachable without a pointer through the value stream and the detail panel. */
window.Floor = (function () {
  'use strict';
  const PE = window.PlantEngine;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, k) => a + (b - a) * k;

  function create(canvas, opts = {}) {
    const ctx = canvas.getContext('2d');
    const C = {};                       // colours from the theme tokens
    function palette() {
      const cs = getComputedStyle(document.documentElement), v = n => cs.getPropertyValue(n).trim();
      Object.assign(C, {
        bg: v('--bg'), surface: v('--surface'), s2: v('--surface-2'), s3: v('--surface-3'), border: v('--border'), strong: v('--border-strong'),
        text: v('--text'), text2: v('--text-2'), text3: v('--text-3'), brand: v('--brand-2'), ok: v('--success'), warn: v('--warning'), bad: v('--danger'), maint: v('--indigo'),
        dark: document.documentElement.dataset.theme === 'dark', font: v('--font') || 'Inter, system-ui, sans-serif'
      });
    }
    palette();
    addEventListener('themechange', () => requestAnimationFrame(palette));

    const view = { cx: 64, cz: 41, scale: 8, fit: 8, W: 0, H: 0, dpr: 1 };
    let overlay = 'status', chain = null, selected = null, hoverRef = null, follow = null;
    const listeners = [];
    const emit = (t, d) => listeners.forEach(f => f(t, d));
    const smooth = new WeakMap();       // render positions that ease toward the engine's positions

    function resize() {
      const r = canvas.getBoundingClientRect();
      const dpr = Math.min(2, devicePixelRatio || 1);
      view.W = Math.max(200, r.width); view.H = Math.max(160, r.height); view.dpr = dpr;
      canvas.width = Math.round(view.W * dpr); canvas.height = Math.round(view.H * dpr);
      const fit = Math.min(view.W / 132, view.H / 84);
      if (Math.abs(view.scale - view.fit) < 1e-6 || !view.init) { view.scale = fit; view.cx = 64; view.cz = 41.5; }
      view.fit = fit; view.init = true;
    }
    if ('ResizeObserver' in window) new ResizeObserver(resize).observe(canvas); else addEventListener('resize', resize);
    resize();

    const SX = x => (x - view.cx) * view.scale + view.W / 2;
    const SZ = z => (z - view.cz) * view.scale + view.H / 2;
    const WX = px => (px - view.W / 2) / view.scale + view.cx;
    const WZ = pz => (pz - view.H / 2) / view.scale + view.cz;

    function rrect(x, y, w, h, r) {
      r = Math.min(r, w / 2, h / 2);
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
      if (!r || speed > 6 || Math.hypot(r.x - x, r.z - z) > 4) { r = { x, z }; smooth.set(obj, r); return r; }
      const k = 1 - Math.exp(-dt * 14);
      r.x = lerp(r.x, x, k); r.z = lerp(r.z, z, k);
      return r;
    }

    /* hit areas rebuilt every frame: [ref, x0, z0, x1, z1] in world metres */
    let hits = [];
    const hit = (ref, x0, z0, x1, z1) => hits.push([ref, x0, z0, x1, z1]);

    let lastT = performance.now(), t = 0;
    function draw(P, o = {}) {
      if (!P) return;
      const now = performance.now(), dt = Math.min(0.1, (now - lastT) / 1000); lastT = now; t += dt;
      const speed = o.speed || 1, live = !o.replay;
      const { W, H, dpr } = view, s = view.scale;
      if (follow) { const p = posOf(P, follow); if (p) { view.cx = lerp(view.cx, p[0], 0.08); view.cz = lerp(view.cz, p[1], 0.08); } }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
      hits = [];
      const L = P.layout;
      const fs = clamp(s * 1.25, 10, 13);
      ctx.textBaseline = 'middle';

      // halls, named just above their wall (a name that does not fit is shortened, then left out)
      const SHORT = { rm: 'Warehouse', smt: 'SMT hall', fa: 'Assembly hall', tp: 'Test & pack', fg: 'Finished goods', util: 'Utilities', shop: 'Shop' };
      for (const zn of L.ZONES) {
        rrect(SX(zn.x0), SZ(zn.z0), (zn.x1 - zn.x0) * s, (zn.z1 - zn.z0) * s, 6);
        ctx.fillStyle = C.surface; ctx.fill();
        ctx.lineWidth = 1; ctx.strokeStyle = C.border; ctx.stroke();
      }
      ctx.font = `600 ${fs}px ${C.font}`; ctx.textAlign = 'left'; ctx.fillStyle = C.text3;
      for (const zn of L.ZONES) {
        const room = (zn.x1 - zn.x0) * s - 4;
        const name = ctx.measureText(zn.name).width <= room ? zn.name : ctx.measureText(SHORT[zn.id] || '').width <= room ? SHORT[zn.id] : '';
        if (name) ctx.fillText(name, SX(zn.x0) + 2, SZ(zn.z0) - fs * 0.65);
      }
      // raw-material racks: one bay per material, filled to its stock
      const RMB = Object.values(P.bufs).filter(b => b.rm && L.STOPS[b.id]);
      RMB.forEach((b, i) => {
        const z = 6 + i * 5.6, x0 = 4, w = 19.5, h = 3.4;
        const k = clamp((b.qty || 0) / Math.max(1, b.cap), 0, 1), low = b.id === 'RM:panel' && P.panelCover != null && P.panelCover < 3 * 3600;
        ctx.fillStyle = C.s2; ctx.fillRect(SX(x0), SZ(z), w * s, h * s);
        ctx.fillStyle = low ? alpha(C.warn, 0.55) : alpha(C.text3, 0.45); ctx.fillRect(SX(x0), SZ(z), w * s * k, h * s);
        ctx.strokeStyle = low ? C.warn : C.border; ctx.lineWidth = 1; ctx.strokeRect(SX(x0) + 0.5, SZ(z) + 0.5, w * s - 1, h * s - 1);
        if (s > 5) { ctx.fillStyle = C.text2; ctx.font = `500 ${Math.min(11, s * 1.15)}px ${C.font}`; ctx.textAlign = 'left'; ctx.fillText(b.label, SX(x0) + 4, SZ(z + h / 2)); }
        hit('buf:' + b.id, x0, z, x0 + w, z + h);
      });
      // inbound trucks at the receiving doors
      for (const tr of P.inbound || []) if (tr.state === 'arriving' || tr.state === 'unloading' || tr.state === 'at door') {
        const z = 12 + tr.door * 22;
        rrect(SX(-2.5), SZ(z), 4.2 * s, 3 * s, 3); ctx.fillStyle = C.s3; ctx.fill(); ctx.strokeStyle = C.strong; ctx.stroke();
      }
      // AGV aisles
      ctx.strokeStyle = C.border; ctx.lineWidth = Math.max(1, s * 1.6); ctx.lineCap = 'round';
      for (const A of L.AISLES) { ctx.beginPath(); ctx.moveTo(SX(A.a[0]), SZ(A.a[1])); ctx.lineTo(SX(A.b[0]), SZ(A.b[1])); ctx.stroke(); }

      // conveyors and the units on them
      for (const sg of P.segs) {
        const n = sg.items.length, dens = n / Math.max(1, sg.len / sg.pitch);
        ctx.strokeStyle = overlay === 'flow' ? (dens > 0.8 ? C.warn : C.strong) : C.strong;
        ctx.lineWidth = Math.max(1.5, s * 0.5);
        ctx.beginPath(); sg.path.forEach((p, i) => (i ? ctx.lineTo(SX(p[0]), SZ(p[1])) : ctx.moveTo(SX(p[0]), SZ(p[1])))); ctx.stroke();
        for (const it of sg.items) {
          const at = PE.polyAt(sg.path, it.s);
          const r = live ? ease(it.u, at[0], at[1], dt, speed) : { x: at[0], z: at[1] };
          const big = it.u.type === 'tv', w = (big ? 1.1 : it.u.type === 'phone' ? 0.42 : 0.3) * s;
          ctx.fillStyle = it.u.defect ? C.bad : overlay === 'flow' ? C.brand : C.text2;
          ctx.fillRect(SX(r.x) - w / 2, SZ(r.z) - w / 2, w, w);
        }
      }

      // stations
      const maxKw = Math.max(1, ...P.stations.map(x => x.kwNow || 0));
      for (const st of P.stations) {
        const x0 = st.x - st.w / 2, z0 = st.z - st.d / 2;
        const px = SX(x0), pz = SZ(z0), pw = st.w * s, ph = st.d * s;
        const col = stColor(st.state);
        let fill = C.s3, stroke = C.strong, lw = 1;
        if (overlay === 'energy') { const k = (st.kwNow || 0) / maxKw; fill = alpha(C.brand, 0.08 + 0.6 * Math.sqrt(k)); }
        else if (overlay === 'quality') { const tot = st.counters.made + st.counters.bad; const q = tot ? st.counters.bad / tot : 0; fill = q > 0.03 ? alpha(C.bad, 0.18 + Math.min(0.5, q * 4)) : q > 0.01 ? alpha(C.warn, 0.25) : C.s3; }
        else if (col) { fill = alpha(col, st.state === 'down' || st.state === 'tripped' ? 0.22 : 0.16); stroke = col; lw = 1.6; }
        rrect(px, pz, pw, ph, Math.min(4, s * 0.5));
        ctx.fillStyle = fill; ctx.fill();
        if (st.state === 'maint' || st.state === 'changeover') ctx.setLineDash([4, 3]);
        ctx.lineWidth = lw; ctx.strokeStyle = stroke; ctx.stroke(); ctx.setLineDash([]);
        // a running station shows its cycle progress as a grey hairline: movement without colour
        if ((st.state === 'run' || st.state === 'warn') && st.procs.length && st !== P.byId['L5-Burnin']) {
          const pr = st.procs[0], k = clamp(1 - Math.max(0, pr.left) / (pr.tot || 1), 0, 1);
          ctx.fillStyle = C.text3; ctx.fillRect(px + 2, pz + ph - 3, Math.max(0, (pw - 4) * k), 2);
        }
        // worn machines carry a small amber mark before anything has stopped
        if (st.degrade > 0 && st.state !== 'down' && st.state !== 'maint') { ctx.fillStyle = C.warn; ctx.beginPath(); ctx.arc(px + pw - 4, pz + 4, Math.max(2.5, s * 0.35), 0, 7); ctx.fill(); }
        if (st.state === 'down' || st.state === 'tripped') {
          const pulse = 0.55 + 0.45 * Math.sin(t * 5);
          ctx.strokeStyle = alpha(C.bad, live ? pulse : 0.9); ctx.lineWidth = 2; rrect(px - 3, pz - 3, pw + 6, ph + 6, 6); ctx.stroke();
        }
        if (st.intrusion) { ctx.strokeStyle = C.bad; ctx.lineWidth = 2.5; ctx.setLineDash([3, 3]); rrect(px - 6, pz - 6, pw + 12, ph + 12, 8); ctx.stroke(); ctx.setLineDash([]); }
        if (s > 9 && pw > 30 && st !== P.byId['L5-Burnin']) {
          ctx.fillStyle = col && overlay === 'status' ? C.text : C.text2; ctx.font = `500 ${Math.min(12, s * 0.95)}px ${C.font}`; ctx.textAlign = 'center';
          ctx.fillText(st.name.length * 6 > pw + 18 ? st.name.split(' ')[0] : st.name, px + pw / 2, pz - 7);
        }
        hit('st:' + st.id, x0 - 0.3, z0 - 0.3, x0 + st.w + 0.3, z0 + st.d + 0.3);
      }
      // burn-in racks
      const BURN = P.byId['L5-Burnin'];
      if (BURN && BURN.rack) for (const sl of BURN.rack) {
        const w = (sl.kind === 'tv' ? 1.1 : 0.5) * s;
        ctx.fillStyle = sl.u ? (sl.u.defect ? C.bad : overlay === 'flow' ? C.brand : C.text2) : C.s2;
        ctx.fillRect(SX(sl.x) - w / 2, SZ(sl.z) - w / 2, w, w * (sl.kind === 'tv' ? 0.7 : 1));
      }
      // line names
      ctx.font = `700 ${clamp(s * 1.3, 11, 14)}px ${C.font}`; ctx.textAlign = 'right'; ctx.fillStyle = C.text2;
      for (const id of ['L1', 'L2', 'L3', 'L4']) { const L0 = P.lines[id], st0 = L0.stations[0]; ctx.fillText(id, SX(st0.x - st0.w / 2) - 6, SZ(st0.z)); hit('line:' + id, st0.x - st0.w / 2 - 4, st0.z - 1.5, st0.x - st0.w / 2, st0.z + 1.5); }

      // buffers: supermarket lanes and line-side stock, drawn as fill gauges
      const gauge = (ref, x, z, w, h, k, low) => {
        const px = SX(x - w / 2), pz = SZ(z - h / 2), pw = w * s, ph = h * s;
        ctx.fillStyle = C.s2; ctx.fillRect(px, pz, pw, ph);
        ctx.fillStyle = low ? C.warn : C.text3; ctx.fillRect(px, pz + ph * (1 - k), pw, ph * k);
        ctx.strokeStyle = low ? C.warn : C.strong; ctx.lineWidth = 1; ctx.strokeRect(px + 0.5, pz + 0.5, pw - 1, ph - 1);
        hit(ref, x - w / 2 - 0.4, z - h / 2 - 0.4, x + w / 2 + 0.4, z + h / 2 + 0.4);
      };
      for (const lane of ['main', 'power']) {
        const b = P.bufs['SM:' + lane], stp = L.STOPS['SM:' + lane];
        if (b && stp) gauge('buf:' + b.id, stp.x + 4, stp.z, 6, 2.2, clamp(b.items.length / b.cap, 0, 1), b.items.length < 20);
      }
      for (const b of Object.values(P.bufs)) {
        if (!b.station || !L.STOPS[b.id]) continue;
        const stp = L.STOPS[b.id], lvl = b.items ? b.items.length : b.qty;
        gauge('buf:' + b.id, stp.x, stp.z, 0.8, 1.6, clamp(lvl / b.cap, 0, 1), lvl <= b.rop);
      }
      // finished goods, docks, trucks
      for (const sl of P.fgSlots) {
        const w = 2.1 * s;
        ctx.strokeStyle = C.border; ctx.lineWidth = 1; ctx.strokeRect(SX(sl.x) - w / 2, SZ(sl.z) - w / 2, w, w);
        if (sl.p) { ctx.fillStyle = sl.p.claimed ? C.brand : C.text3; ctx.fillRect(SX(sl.x) - w / 2 + 2, SZ(sl.z) - w / 2 + 2, w - 4, w - 4); }
      }
      for (const d of P.docks || []) {
        const x0 = d.x - 3, z0 = d.z - 1;
        ctx.strokeStyle = C.strong; ctx.lineWidth = 1; ctx.strokeRect(SX(x0), SZ(z0), 6 * s, 2 * s);
        const tr = d.truck;
        if (tr) {
          const k = tr.k != null ? tr.k : 1, z = d.z + (1 - k) * 8;
          rrect(SX(d.x - 1.6), SZ(z - 0.6), 3.2 * s, 7 * s, 3);
          const late = tr.order && P.t > tr.order.due;
          ctx.fillStyle = late ? alpha(C.bad, 0.2) : C.s3; ctx.fill(); ctx.strokeStyle = late ? C.bad : C.strong; ctx.stroke();
          const lf = tr.order ? clamp((tr.loaded || 0) / Math.max(1, tr.order.qty), 0, 1) : 0;
          ctx.fillStyle = C.text3; ctx.fillRect(SX(d.x - 1.2), SZ(z + 6.2) - lf * 6 * s, 2.4 * s, lf * 6 * s);
          hit('order:' + (tr.order ? tr.order.id : ''), d.x - 1.8, z - 0.8, d.x + 1.8, z + 6.6);
        }
        ctx.fillStyle = C.text3; ctx.font = `500 ${Math.min(11, fs)}px ${C.font}`; ctx.textAlign = 'center'; ctx.fillText(d.id, SX(d.x), SZ(d.z) - 10);
      }
      // utilities
      for (const a of P.util.assets) {
        const w = 3.4, x0 = a.x - w / 2, z0 = a.z - w / 2;
        rrect(SX(x0), SZ(z0), w * s, w * s, 4);
        const on = a.on !== false && a.kw > 8;
        ctx.fillStyle = overlay === 'energy' && on ? alpha(C.brand, 0.12 + Math.min(0.6, a.kw / 260)) : C.s3; ctx.fill();
        const forced = a.forced && a.forced > P.t;
        ctx.strokeStyle = forced ? C.warn : C.strong; ctx.lineWidth = forced ? 1.6 : 1; ctx.stroke();
        if (s > 6) { ctx.fillStyle = C.text2; ctx.font = `600 ${Math.min(11, s)}px ${C.font}`; ctx.textAlign = 'center'; ctx.fillText(Math.round(a.kw) + ' kW', SX(a.x), SZ(a.z)); }
        hit('util:' + a.id, x0, z0, x0 + w, z0 + w);
      }

      // AGVs, their routes, forklifts, people
      for (const a of P.agvs) {
        const r = live ? ease(a, a.x, a.z, dt, speed) : { x: a.x, z: a.z };
        if (a.path && (overlay === 'flow' || a.mission && a.mission.watched || selected === 'agv:' + a.id)) {
          ctx.strokeStyle = alpha(a.fault ? C.bad : C.brand, 0.55); ctx.lineWidth = 2; ctx.setLineDash([5, 4]);
          ctx.beginPath(); ctx.moveTo(SX(r.x), SZ(r.z));
          let acc = 0; for (let i = 1; i < a.path.length; i++) { acc += Math.hypot(a.path[i][0] - a.path[i - 1][0], a.path[i][1] - a.path[i - 1][1]); if (acc > a.s) ctx.lineTo(SX(a.path[i][0]), SZ(a.path[i][1])); }
          ctx.stroke(); ctx.setLineDash([]);
        }
        ctx.save(); ctx.translate(SX(r.x), SZ(r.z)); ctx.rotate(a.h || 0);
        const lw = 1.5 * s, ww = 1 * s;
        rrect(-lw / 2, -ww / 2, lw, ww, 2);
        ctx.fillStyle = a.fault ? C.bad : C.surface; ctx.fill();
        ctx.strokeStyle = a.fault ? C.bad : a.battery < 15 ? C.warn : C.text2; ctx.lineWidth = 1.4; ctx.stroke();
        if (a.load) { ctx.fillStyle = a.fault ? C.surface : C.text2; ctx.fillRect(-lw * 0.28, -ww * 0.28, lw * 0.56, ww * 0.56); }
        ctx.fillStyle = a.fault ? C.surface : C.text2; ctx.beginPath(); ctx.arc(lw / 2 - 2.5, 0, 1.6, 0, 7); ctx.fill();
        ctx.restore();
        if (s > 7) { ctx.fillStyle = a.fault ? C.text : C.text3; ctx.font = `600 ${Math.min(11, s * 0.9)}px ${C.font}`; ctx.textAlign = 'center'; ctx.fillText(a.id.replace('AGV-0', 'A'), SX(r.x), SZ(r.z) - ww - 5); }
        hit('agv:' + a.id, r.x - 1.3, r.z - 1.3, r.x + 1.3, r.z + 1.3);
      }
      for (const f of P.forklifts) {
        const r = live ? ease(f, f.x, f.z, dt, speed) : { x: f.x, z: f.z };
        ctx.save(); ctx.translate(SX(r.x), SZ(r.z)); ctx.rotate(f.h || 0);
        rrect(-0.9 * s, -0.6 * s, 1.8 * s, 1.2 * s, 2); ctx.fillStyle = C.surface; ctx.fill(); ctx.strokeStyle = C.text2; ctx.lineWidth = 1.4; ctx.stroke();
        ctx.fillStyle = C.text2; ctx.fillRect(0.9 * s, -0.45 * s, 0.7 * s, 0.15 * s); ctx.fillRect(0.9 * s, 0.3 * s, 0.7 * s, 0.15 * s);
        ctx.restore();
      }
      const showPeople = overlay === 'people';
      for (const p of P.people) {
        const r = live ? ease(p, p.x, p.z, dt, speed) : { x: p.x, z: p.z };
        const rad = Math.max(2.2, s * (showPeople ? 0.45 : 0.32));
        ctx.beginPath(); ctx.arc(SX(r.x), SZ(r.z), rad, 0, 7);
        ctx.fillStyle = p.intruding ? C.bad : showPeople ? (p.role === 'Technician' ? C.maint : C.brand) : C.text3; ctx.fill();
        if (p.intruding) { ctx.strokeStyle = alpha(C.bad, 0.5 + 0.5 * Math.sin(t * 8)); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(SX(r.x), SZ(r.z), rad + 5, 0, 7); ctx.stroke(); }
        if (showPeople && s > 8) { ctx.fillStyle = C.text2; ctx.font = `500 ${Math.min(11, s * 0.85)}px ${C.font}`; ctx.textAlign = 'left'; ctx.fillText(p.name.split(' ').slice(-2).join(' '), SX(r.x) + rad + 3, SZ(r.z)); }
      }

      // a case's cause path: numbered stops joined in order
      if (chain && chain.length) {
        const pts = chain.map(ref => posOf(P, ref)).filter(Boolean);
        if (pts.length) {
          ctx.strokeStyle = C.brand; ctx.lineWidth = 2.5; ctx.setLineDash([7, 5]); ctx.lineDashOffset = live ? -t * 18 : 0;
          ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(SX(p[0]), SZ(p[1])) : ctx.moveTo(SX(p[0]), SZ(p[1])))); ctx.stroke(); ctx.setLineDash([]); ctx.lineDashOffset = 0;
          pts.forEach((p, i) => {
            const x = SX(p[0]), y = SZ(p[1]);
            ctx.beginPath(); ctx.arc(x, y, 10, 0, 7); ctx.fillStyle = i === 0 ? C.bad : C.brand; ctx.fill();
            ctx.lineWidth = 2; ctx.strokeStyle = C.surface; ctx.stroke();
            ctx.fillStyle = '#fff'; ctx.font = `700 11px ${C.font}`; ctx.textAlign = 'center'; ctx.fillText(String(i + 1), x, y + 0.5);
          });
        }
      }
      // selection and hover outlines
      for (const [ref, cls] of [[hoverRef, 'hover'], [selected, 'sel']]) {
        if (!ref) continue;
        const h = hits.find(x => x[0] === ref); if (!h) continue;
        rrect(SX(h[1]) - 3, SZ(h[2]) - 3, (h[3] - h[1]) * s + 6, (h[4] - h[2]) * s + 6, 6);
        ctx.strokeStyle = cls === 'sel' ? C.brand : alpha(C.text, 0.4); ctx.lineWidth = cls === 'sel' ? 2.5 : 1.5; ctx.stroke();
      }
      if (o.replay) {
        ctx.fillStyle = alpha(C.warn, 0.9); ctx.font = `700 12px ${C.font}`; ctx.textAlign = 'left';
        rrect(10, 10, 168, 26, 13); ctx.fill(); ctx.fillStyle = '#111'; ctx.fillText(`Replay · ${PE.clockS(P.t)}`, 22, 23.5);
      }
    }

    /* where a ref sits on the plan */
    function posOf(P, ref) {
      if (!ref) return null;
      const [k, ...rest] = ref.split(':'); const id = rest.join(':');
      if (k === 'st' && P.byId[id]) return [P.byId[id].x, P.byId[id].z];
      if (k === 'line' && P.lines[id]) { const ss = P.lines[id].stations; const m = ss[Math.floor(ss.length / 2)]; return [m.x, m.z]; }
      if (k === 'buf') { const stp = P.layout.STOPS[id]; if (stp) return [id.startsWith('SM:') ? stp.x + 4 : stp.x, stp.z]; const b = P.bufs[id]; if (b && b.station && P.byId[b.station]) return [P.byId[b.station].x, P.byId[b.station].z]; return null; }
      if (k === 'agv') { const a = P.agvs.find(x => x.id === id); return a ? [a.x, a.z] : null; }
      if (k === 'util') { const a = P.util.assets.find(x => x.id === id); return a ? [a.x, a.z] : null; }
      if (k === 'order') { const o = P.orders.find(x => x.id === id); if (o && o.truck && o.truck.dock) return [o.truck.dock.x, o.truck.dock.z + 2]; return [52, 72]; }
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
        if (moved) { follow = null; view.cx = drag.cx - dx / view.scale; view.cz = drag.cz - dy / view.scale; canvas.style.cursor = 'grabbing'; }
        return;
      }
      const r = pick(e.offsetX, e.offsetY);
      if (r !== hoverRef) { hoverRef = r; emit('hover', r); }
      canvas.style.cursor = r ? 'pointer' : 'grab';
      if (r) emit('tip', { ref: r, x: e.clientX, y: e.clientY }); else emit('tip', null);
    });
    const end = e => {
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinch0 = null;
      if (drag && !moved && e.type === 'pointerup') { const r = pick(e.offsetX, e.offsetY); emit('select', r); }
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
      view.scale = clamp(view.scale * k, view.fit * 0.8, view.fit * 7);
      view.cx = x - (px - view.W / 2) / view.scale; view.cz = z - (pz - view.H / 2) / view.scale;
    }
    function fit() { follow = null; view.scale = view.fit; view.cx = 64; view.cz = 41.5; }
    function focus(P, ref, zoom = 3) {
      const p = posOf(P, ref); if (!p) return;
      view.scale = clamp(view.fit * zoom, view.fit, view.fit * 7); view.cx = p[0]; view.cz = p[1];
    }
    function zone(z) {
      const Z = z && window.Twin && Twin.E && Twin.E.P.layout.ZONES.find(x => x.id === z);
      if (!Z) return fit();
      follow = null;
      view.scale = clamp(Math.min(view.W / (Z.x1 - Z.x0 + 6), view.H / (Z.z1 - Z.z0 + 6)), view.fit, view.fit * 7);
      view.cx = (Z.x0 + Z.x1) / 2; view.cz = (Z.z0 + Z.z1) / 2;
    }

    return {
      draw, posOf, fit, focus, zone,
      zoom: k => zoomAt(view.W / 2, view.H / 2, k),
      on(fn) { listeners.push(fn); },
      setOverlay(o) { overlay = o; }, get overlay() { return overlay; },
      setChain(c) { chain = c; }, select(r) { selected = r; },
      setFollow(r) { follow = r; }
    };
  }
  return { create };
})();
