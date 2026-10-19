/* Tiny dependency-free canvas chart helpers */
(function (g) {
  'use strict';

  function fit(canvas) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    }
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, w, h };
  }

  function hexA(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`;
  }

  /**
   * series: [{ data:number[], color:'#hex', dash?:[], fill?:bool, offset?:int (x offset in points) }]
   * opts: { min, max, n (total x points), threshold:{v,color}, grid:bool, pad:{l,r,t,b}, yFmt, xLabels:[...] }
   */
  function line(canvas, series, opts = {}) {
    const { ctx, w, h } = fit(canvas);
    ctx.clearRect(0, 0, w, h);
    const pad = Object.assign({ l: 6, r: 6, t: 8, b: 6 }, opts.pad || {});
    const all = series.flatMap(s => s.data);
    if (!all.length) return;
    let min = opts.min ?? Math.min(...all), max = opts.max ?? Math.max(...all);
    if (max - min < 1e-6) { max += 1; min -= 1; }
    const n = opts.n ?? Math.max(...series.map(s => s.data.length + (s.offset || 0)));
    const X = i => pad.l + (i / Math.max(1, n - 1)) * (w - pad.l - pad.r);
    const Y = v => pad.t + (1 - (v - min) / (max - min)) * (h - pad.t - pad.b);

    if (opts.grid) {
      ctx.strokeStyle = 'rgba(120,170,255,0.08)'; ctx.lineWidth = 1;
      ctx.fillStyle = '#6a7fa6'; ctx.font = '10px ' + getComputedStyle(document.body).fontFamily;
      for (let k = 0; k <= 4; k++) {
        const v = min + (max - min) * k / 4, y = Y(v);
        ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(w - pad.r, y); ctx.stroke();
        if (opts.yFmt) ctx.fillText(opts.yFmt(v), 2, y - 3);
      }
      if (opts.xLabels) {
        opts.xLabels.forEach(([i, t]) => { ctx.fillText(t, Math.min(w - 40, X(i)), h - 2); });
      }
    }
    if (opts.band) { // shaded x-band [from,to,color]
      opts.band.forEach(([a, b, c]) => { ctx.fillStyle = c; ctx.fillRect(X(a), pad.t, X(b) - X(a), h - pad.t - pad.b); });
    }
    if (opts.threshold) {
      const y = Y(opts.threshold.v);
      ctx.strokeStyle = opts.threshold.color || '#f87171'; ctx.setLineDash([]); ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(w - pad.r, y); ctx.stroke();
      if (opts.threshold.label) { ctx.fillStyle = opts.threshold.color || '#f87171'; ctx.font = '600 10px sans-serif'; ctx.fillText(opts.threshold.label, w - pad.r - ctx.measureText(opts.threshold.label).width - 2, y - 4); }
    }
    for (const s of series) {
      if (!s.data.length) continue;
      const off = s.offset || 0;
      ctx.beginPath();
      s.data.forEach((v, i) => { const x = X(i + off), y = Y(v); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
      if (s.fill) {
        const grd = ctx.createLinearGradient(0, pad.t, 0, h);
        grd.addColorStop(0, hexA(s.color, 0.35)); grd.addColorStop(1, hexA(s.color, 0));
        ctx.save(); ctx.lineTo(X(off + s.data.length - 1), h - pad.b); ctx.lineTo(X(off), h - pad.b); ctx.closePath();
        ctx.fillStyle = grd; ctx.fill(); ctx.restore();
        ctx.beginPath(); s.data.forEach((v, i) => { const x = X(i + off), y = Y(v); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
      }
      ctx.setLineDash(s.dash || []); ctx.strokeStyle = s.color; ctx.lineWidth = s.width || 2; ctx.lineJoin = 'round';
      ctx.shadowColor = s.color; ctx.shadowBlur = s.glow ? 8 : 0;
      ctx.stroke(); ctx.shadowBlur = 0; ctx.setLineDash([]);
      if (s.dot) { const i = s.data.length - 1; ctx.fillStyle = s.color; ctx.beginPath(); ctx.arc(X(i + off), Y(s.data[i]), 3.5, 0, 7); ctx.fill(); }
    }
  }

  g.Charts = { fit, line, hexA };
})(window);
