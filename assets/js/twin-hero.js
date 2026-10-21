/* Digital Factory — the live line drawn on the website.
   [data-twin="slot"]  a small running conveyor that sits inside the headline in place of the word "line"
   [data-twin="full"]  the same SMT line opened full width as a blueprint, with live readouts in [data-read]
   Simulated data. Pauses off-screen; with reduced motion it draws one still frame. */
(() => {
  'use strict';
  const heroRng = (typeof DFRng !== 'undefined' && DFRng.stream) ? DFRng.stream('twin-hero') : { range: (a, b) => a + Math.random() * (b - a) };
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  let C = {};
  const palette = () => {
    C = {
      text: css('--text'), text2: css('--text-2'), border: css('--border'), strong: css('--border-strong'),
      surface: css('--surface'), bg: css('--bg'), brand: css('--brand-2'), ok: css('--success'), warn: css('--warning'), bad: css('--danger')
    };
  };
  palette();
  addEventListener('themechange', () => { palette(); views.forEach(v => v.draw()); });

  /* one line model shared by every view: stations as fractions of the line length */
  const STATIONS = [
    { id: 'Printer', x: .09, t: .6 }, { id: 'SPI', x: .23, t: .5 }, { id: 'Mounter A', x: .38, t: .8 },
    { id: 'Mounter B', x: .53, t: .8, warn: true }, { id: 'Reflow', x: .70, t: 1.1 }, { id: 'AOI', x: .86, t: .5 }
  ];
  const HALF = .045;                 // half station width, as a fraction of the line
  const line = { units: [], made: 0, spawn: 0, belt: 0 };
  function stepLine(dt) {
    line.belt = (line.belt + dt * .05) % 1;
    line.spawn -= dt;
    const first = line.units[line.units.length - 1];
    if (line.spawn <= 0 && (!first || first.x > .06)) { line.units.push({ x: 0 }); line.spawn = 1.25; }
    for (let i = 0; i < line.units.length; i++) {
      const u = line.units[i];
      const inSt = STATIONS.find(s => Math.abs(u.x - s.x) < HALF);
      let v = inSt ? .045 / inSt.t : .11;
      const ahead = line.units[i - 1];
      if (ahead) v = Math.min(v, Math.max(0, (ahead.x - u.x - .035) / Math.max(dt, .001)));
      u.x += v * dt;
    }
    while (line.units.length && line.units[0].x > 1) { line.units.shift(); line.made++; dispatchEvent(new CustomEvent('twin:unit')); }
  }
  // start with a full line so the first frame already reads as running
  for (let t = 0; t < 40; t += 1 / 30) stepLine(1 / 30);

  function view(canvas) {
    const kind = canvas.dataset.twin, ctx = canvas.getContext('2d');
    let w = 0, h = 0;
    const size = () => {
      const r = canvas.getBoundingClientRect(), d = Math.min(devicePixelRatio || 1, 2);
      w = r.width; h = r.height;
      canvas.width = Math.round(w * d); canvas.height = Math.round(h * d);
      ctx.setTransform(d, 0, 0, d, 0, 0);
    };
    const drawSlot = () => {
      ctx.clearRect(0, 0, w, h);
      const y = h * .62, x0 = 0, x1 = w;
      ctx.strokeStyle = 'rgba(255,255,255,.45)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(x0, y + h * .1); ctx.lineTo(x1, y + h * .1); ctx.stroke();
      ctx.setLineDash([4, 6]); ctx.lineDashOffset = -line.belt * 400;
      ctx.beginPath(); ctx.moveTo(x0, y + h * .16); ctx.lineTo(x1, y + h * .16); ctx.stroke(); ctx.setLineDash([]);
      // the slot shows the middle of the line: Mounter A to Reflow
      const from = .3, to = .78, X = f => (f - from) / (to - from) * w;
      for (const s of STATIONS) {
        if (s.x < from - .05 || s.x > to + .05) continue;
        const sx = X(s.x - HALF), sw = X(s.x + HALF) - sx;
        ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.lineWidth = 1.5;
        ctx.strokeRect(sx, h * .22, sw, y - h * .22 + h * .06);
        ctx.fillStyle = s.warn ? C.warn : C.ok;
        ctx.beginPath(); ctx.arc(sx + sw / 2, h * .13, Math.max(2.5, h * .045), 0, 7); ctx.fill();
      }
      ctx.fillStyle = '#fff';
      for (const u of line.units) if (u.x > from - .05 && u.x < to + .05) ctx.fillRect(X(u.x) - h * .07, y - h * .02, h * .14, h * .08);
    };
    const drawFull = () => {
      ctx.clearRect(0, 0, w, h);
      // drafting grid
      const g = w < 700 ? 20 : 28;
      ctx.lineWidth = 1;
      for (let x = 0, i = 0; x <= w; x += g, i++) { ctx.strokeStyle = i % 5 ? C.border : C.strong; ctx.globalAlpha = i % 5 ? .55 : .8; ctx.beginPath(); ctx.moveTo(x + .5, 0); ctx.lineTo(x + .5, h); ctx.stroke(); }
      for (let y = 0, i = 0; y <= h; y += g, i++) { ctx.strokeStyle = i % 5 ? C.border : C.strong; ctx.globalAlpha = i % 5 ? .55 : .8; ctx.beginPath(); ctx.moveTo(0, y + .5); ctx.lineTo(w, y + .5); ctx.stroke(); }
      ctx.globalAlpha = 1;
      const L = w * .03, R = w * .97, X = f => L + f * (R - L), y = h * .62, sh = Math.min(h * .26, 120);
      // dimension line across the line
      const dy = y - sh - 46;
      ctx.strokeStyle = C.text2; ctx.fillStyle = C.text2; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(L, dy - 8); ctx.lineTo(L, dy + 8); ctx.moveTo(R, dy - 8); ctx.lineTo(R, dy + 8); ctx.moveTo(L, dy); ctx.lineTo(R, dy); ctx.stroke();
      for (const [x, s] of [[L, 1], [R, -1]]) { ctx.beginPath(); ctx.moveTo(x, dy); ctx.lineTo(x + 8 * s, dy - 4); ctx.lineTo(x + 8 * s, dy + 4); ctx.fill(); }
      ctx.font = '600 13px Inter, system-ui, sans-serif'; ctx.textAlign = 'center';
      const lbl = 'SMT Line 1  ·  6 stations  ·  38.4 m';
      const lw = ctx.measureText(lbl).width + 20;
      ctx.fillStyle = C.bg; ctx.fillRect((L + R) / 2 - lw / 2, dy - 10, lw, 20);
      ctx.fillStyle = C.text2; ctx.fillText(lbl, (L + R) / 2, dy + 4.5);
      // conveyor
      ctx.strokeStyle = C.text; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(L, y + 10); ctx.lineTo(R, y + 10); ctx.moveTo(L, y + 22); ctx.lineTo(R, y + 22); ctx.stroke();
      ctx.strokeStyle = C.text2; ctx.lineWidth = 1; ctx.setLineDash([2, 10]); ctx.lineDashOffset = -line.belt * 1200;
      ctx.beginPath(); ctx.moveTo(L, y + 16); ctx.lineTo(R, y + 16); ctx.stroke(); ctx.setLineDash([]);
      // stations
      for (const s of STATIONS) {
        const sx = X(s.x - HALF), sw = X(s.x + HALF) - sx, top = y - sh + 4;
        ctx.fillStyle = C.surface; ctx.fillRect(sx, top, sw, sh + 4);
        ctx.strokeStyle = s.warn ? C.warn : C.text; ctx.lineWidth = s.warn ? 2 : 1.5; ctx.strokeRect(sx + .5, top + .5, sw, sh + 4);
        // what the machine does, drawn like a schematic
        const cx = sx + sw / 2, ih = sh + 4;
        ctx.strokeStyle = C.text2; ctx.lineWidth = 1.2; ctx.beginPath();
        if (s.id === 'Printer') { ctx.moveTo(sx + sw * .2, top + ih * .3); ctx.lineTo(sx + sw * .8, top + ih * .3); ctx.moveTo(cx, top + ih * .3); ctx.lineTo(cx - sw * .12, top + ih * .62); }
        else if (s.id === 'SPI' || s.id === 'AOI') { ctx.rect(cx - sw * .12, top + ih * .18, sw * .24, ih * .16); ctx.moveTo(cx - sw * .12, top + ih * .34); ctx.lineTo(cx - sw * .3, top + ih * .7); ctx.moveTo(cx + sw * .12, top + ih * .34); ctx.lineTo(cx + sw * .3, top + ih * .7); }
        else if (s.id.startsWith('Mounter')) {
          const hx = cx + Math.sin(performance.now() / (s.warn ? 260 : 300) + s.x * 9) * sw * .26;
          ctx.moveTo(sx + sw * .1, top + ih * .2); ctx.lineTo(sx + sw * .9, top + ih * .2);
          ctx.rect(hx - sw * .08, top + ih * .2, sw * .16, ih * .16); ctx.moveTo(hx, top + ih * .36); ctx.lineTo(hx, top + ih * .62);
        } else if (s.id === 'Reflow') { for (let k = 1; k < 4; k++) { ctx.moveTo(sx + sw * k / 4, top + ih * .16); ctx.lineTo(sx + sw * k / 4, top + ih * .7); } }
        ctx.stroke();
        ctx.fillStyle = s.warn ? C.warn : C.ok;
        ctx.beginPath(); ctx.arc(sx + sw / 2, top - 12, 5, 0, 7); ctx.fill();
        if (w >= 700) { ctx.fillStyle = C.text; ctx.font = '600 13px Inter, system-ui, sans-serif'; ctx.fillText(s.id, sx + sw / 2, y + 48); }
        if (s.warn) { // reticle around the machine at risk
          const p = 14, a = 12, x0 = sx - p, y0 = top - 26, x1 = sx + sw + p, y1 = y + 30;
          ctx.strokeStyle = C.warn; ctx.lineWidth = 2; ctx.beginPath();
          for (const [cx, cy, dx, dy2] of [[x0, y0, 1, 1], [x1, y0, -1, 1], [x0, y1, 1, -1], [x1, y1, -1, -1]]) { ctx.moveTo(cx + a * dx, cy); ctx.lineTo(cx, cy); ctx.lineTo(cx, cy + a * dy2); }
          ctx.stroke();
        }
      }
      // boards
      ctx.fillStyle = C.brand;
      for (const u of line.units) ctx.fillRect(X(u.x) - 9, y - 2, 18, 10);
    };
    const v = { canvas, size, draw: () => (kind === 'slot' ? drawSlot : drawFull)(), on: true };
    size();
    new ResizeObserver(() => { size(); v.draw(); }).observe(canvas);
    new IntersectionObserver(es => { v.on = es[es.length - 1].isIntersecting; if (v.on && wake) wake(); }).observe(canvas);
    return v;
  }
  let wake = null;
  const views = [...document.querySelectorAll('canvas[data-twin]')].map(view);
  views.forEach(v => v.draw());

  /* live readouts (simulated, consistent with the command room demo) */
  const out = n => document.querySelectorAll(`[data-read="${n}"]`);
  const set = (n, t) => out(n).forEach(e => { e.textContent = t; });
  let units = 12480, oee = 86.4, risk = 72;
  const clock = () => set('clock', new Date().toLocaleTimeString('en-GB'));
  addEventListener('twin:unit', () => { units++; set('units', units.toLocaleString('en-US')); });
  set('units', units.toLocaleString('en-US')); clock();
  if (!reduce) setInterval(() => {
    if (!views.some(v => v.on)) return;   // nothing on screen to update
    clock();
    oee = Math.min(87.2, Math.max(85.6, oee + (heroRng.range(0, 1) - .5) * .3)); set('oee', oee.toFixed(1) + '%');
    risk = Math.min(76, Math.max(70, risk + (heroRng.range(0, 1) - .45) * .6)); set('risk', Math.round(risk) + '%');
  }, 1000);

  if (reduce) return;
  // the loop sleeps while no drawing is on screen, and the observer wakes it when one comes back
  let last = performance.now(), raf = 0;
  const loop = t => {
    raf = 0;
    const dt = Math.min(.05, (t - last) / 1000); last = t;
    if (!views.some(v => v.on)) return;
    stepLine(dt); views.forEach(v => v.on && v.draw());
    raf = requestAnimationFrame(loop);
  };
  wake = () => { if (!raf) { last = performance.now(); raf = requestAnimationFrame(loop); } };
  wake();
})();
