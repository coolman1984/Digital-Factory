/* Digital Factory — command room charts (window.Viz). Plain SVG, sized to its box, coloured by CSS classes so light and
   dark mode follow the theme without a redraw. Marks: 2px lines, a ~10% wash for bands, hairline grid, one y-axis,
   end labels on the series the story is about, a crosshair readout on hover and keyboard focus, and a hidden data
   table for screen readers. Series hues come from a validated categorical order (.c1 … .c4); status hues stay reserved. */
window.Viz = (function () {
  'use strict';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const nice = (lo, hi, n = 4) => {
    if (!isFinite(lo) || !isFinite(hi)) { lo = 0; hi = 1; }
    if (hi - lo < 1e-9) { hi = lo + 1; }
    const span = hi - lo, step0 = span / n, mag = Math.pow(10, Math.floor(Math.log10(step0)));
    const err = step0 / mag, step = (err >= 7.5 ? 10 : err >= 3.5 ? 5 : err >= 1.5 ? 2 : 1) * mag;
    const a = Math.floor(lo / step) * step, b = Math.ceil(hi / step) * step;
    const ticks = []; for (let v = a; v <= b + step * 1e-6; v += step) ticks.push(+v.toFixed(10));
    return { lo: a, hi: b, ticks, step };
  };
  const compact = v => { const a = Math.abs(v); return a >= 1e6 ? (v / 1e6).toFixed(a >= 1e7 ? 0 : 1) + 'M' : a >= 1e3 ? (v / 1e3).toFixed(a >= 1e4 ? 0 : 1).replace(/\.0$/, '') + 'k' : String(Math.round(v * 100) / 100); };

  /* one tooltip for the page */
  let tip = null;
  function tipEl() {
    if (!tip) { tip = document.createElement('div'); tip.className = 'vz-tip'; tip.setAttribute('role', 'status'); tip.hidden = true; document.body.append(tip); }
    return tip;
  }
  function showTip(x, y, head, rows) {
    const t = tipEl();
    t.textContent = '';
    const h = document.createElement('p'); h.className = 'vz-th'; h.textContent = head; t.append(h);
    for (const r of rows) {
      const p = document.createElement('p'); p.className = 'vz-tr';
      const k = document.createElement('i'); k.className = 'vz-key ' + (r.cls || ''); p.append(k);
      const b = document.createElement('b'); b.textContent = r.value; p.append(b);
      const s = document.createElement('span'); s.textContent = r.label; p.append(s);
      t.append(p);
    }
    t.hidden = false;
    const w = t.offsetWidth, hh = t.offsetHeight;
    const left = Math.min(innerWidth - w - 12, Math.max(12, x + 14)), top = Math.min(innerHeight - hh - 12, Math.max(12, y - hh - 10));
    t.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
  }
  const hideTip = () => { if (tip) tip.hidden = true; };

  /* ------- line / area chart ------- */
  // spec: { label, height, x: { min, max, fmt, ticks }, y: { min, max, fmt, ticks, unit }, series: [{ key, label, cls, pts: [[x, y]], dash, area, end, endLabel }],
  //         bands: [{ cls, pts: [[x, lo, hi]], label }], rules: [{ y, label, cls }], marks: [{ x, label, cls }], legend: bool }
  function chart(el, spec) {
    if (!el) return;
    // a reader exploring the chart with the keyboard keeps a still picture until they leave it
    if (el._spec && el.contains(document.activeElement) && document.activeElement !== el) { el._spec = spec; return; }
    const W = Math.max(240, Math.round(el.clientWidth || el.getBoundingClientRect().width || 600));
    const H = spec.height || 220;
    const fx = spec.x.fmt || (v => compact(v)), fy = (spec.y && spec.y.fmt) || compact;
    const allY = [];
    (spec.series || []).forEach(s => s.pts.forEach(p => isFinite(p[1]) && allY.push(p[1])));
    (spec.bands || []).forEach(b => b.pts.forEach(p => { if (isFinite(p[1])) allY.push(p[1]); if (isFinite(p[2])) allY.push(p[2]); }));
    (spec.rules || []).forEach(r => isFinite(r.y) && allY.push(r.y));
    let ylo = spec.y && spec.y.min != null ? spec.y.min : Math.min(...allY), yhi = spec.y && spec.y.max != null ? spec.y.max : Math.max(...allY);
    if (!allY.length) { ylo = 0; yhi = 1; }
    if (spec.y && spec.y.pad !== false && (spec.y.min == null || spec.y.max == null)) { const pd = (yhi - ylo) * 0.08 || 1; if (spec.y.min == null) ylo -= pd; if (spec.y.max == null) yhi += pd; }
    const ny = nice(ylo, yhi, spec.y && spec.y.ticks || 4);
    if (spec.y && spec.y.min != null) ny.lo = spec.y.min;
    if (spec.y && spec.y.max != null) ny.hi = spec.y.max;
    ny.ticks = ny.ticks.filter(v => v >= ny.lo - 1e-9 && v <= ny.hi + 1e-9);
    const tickW = Math.max(...ny.ticks.map(v => fy(v).length)) * 7 + 10;
    const endW = (spec.series || []).some(s => s.end) ? Math.min(120, Math.max(...spec.series.filter(s => s.end).map(s => (s.endLabel || '').length)) * 6.6 + 18) : 8;
    const m = { l: tickW, r: endW, t: 10, b: 26 };
    const iw = W - m.l - m.r, ih = H - m.t - m.b;
    const xlo = spec.x.min, xhi = spec.x.max;
    const X = v => m.l + ((v - xlo) / Math.max(1e-9, xhi - xlo)) * iw;
    const Y = v => m.t + ih - ((v - ny.lo) / Math.max(1e-9, ny.hi - ny.lo)) * ih;
    const path = pts => pts.filter(p => isFinite(p[1])).map((p, i) => `${i ? 'L' : 'M'}${X(p[0]).toFixed(1)} ${Y(p[1]).toFixed(1)}`).join('');
    let g = '';
    // grid and y ticks
    for (const v of ny.ticks) g += `<line class="vz-grid" x1="${m.l}" x2="${W - m.r}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}"/><text class="vz-yt" x="${m.l - 8}" y="${(Y(v) + 4).toFixed(1)}" text-anchor="end">${esc(fy(v))}</text>`;
    // x ticks
    const xt = spec.x.ticksAt || (() => { const n = spec.x.ticks || Math.max(2, Math.min(6, Math.floor(iw / 110))); const a = []; for (let i = 0; i <= n; i++) a.push(xlo + (xhi - xlo) * i / n); return a; })();
    xt.forEach((v, i) => g += `<text class="vz-xt" x="${X(v).toFixed(1)}" y="${H - 8}" text-anchor="${i === 0 ? 'start' : i === xt.length - 1 ? 'end' : 'middle'}">${esc(fx(v))}</text>`);
    // bands
    for (const b of spec.bands || []) {
      const p = b.pts.filter(q => isFinite(q[1]) && isFinite(q[2]));
      if (p.length < 2) continue;
      const d = p.map((q, i) => `${i ? 'L' : 'M'}${X(q[0]).toFixed(1)} ${Y(q[2]).toFixed(1)}`).join('') + p.slice().reverse().map(q => `L${X(q[0]).toFixed(1)} ${Y(q[1]).toFixed(1)}`).join('') + 'Z';
      g += `<path class="vz-band ${b.cls || 'c1'}" d="${d}"/>`;
    }
    // rules (limits, plan) and vertical marks (now)
    for (const r of spec.rules || []) if (r.y >= ny.lo && r.y <= ny.hi) g += `<line class="vz-rule ${r.cls || ''}" x1="${m.l}" x2="${W - m.r}" y1="${Y(r.y).toFixed(1)}" y2="${Y(r.y).toFixed(1)}"/>${r.label ? `<text class="vz-rl" x="${m.l + 6}" y="${(Y(r.y) - 5).toFixed(1)}">${esc(r.label)}</text>` : ''}`;
    for (const k of spec.marks || []) if (k.x >= xlo && k.x <= xhi) g += `<line class="vz-mark ${k.cls || ''}" x1="${X(k.x).toFixed(1)}" x2="${X(k.x).toFixed(1)}" y1="${m.t}" y2="${m.t + ih}"/>${k.label ? `<text class="vz-ml" x="${(X(k.x) + 5).toFixed(1)}" y="${m.t + 11}">${esc(k.label)}</text>` : ''}`;
    // areas then lines
    for (const s of spec.series || []) if (s.area && s.pts.length > 1) {
      const p = s.pts.filter(q => isFinite(q[1]));
      g += `<path class="vz-area ${s.cls || 'c1'}" d="${path(p)}L${X(p[p.length - 1][0]).toFixed(1)} ${Y(ny.lo).toFixed(1)}L${X(p[0][0]).toFixed(1)} ${Y(ny.lo).toFixed(1)}Z"/>`;
    }
    for (const s of spec.series || []) if (s.pts.length > 1) g += `<path class="vz-line ${s.cls || 'c1'}${s.dash ? ' dash' : ''}" d="${path(s.pts)}"/>`;
    // end dots and labels (labels in text ink, the dot carries identity)
    const ends = [];
    for (const s of spec.series || []) {
      if (!s.end || !s.pts.length) continue;
      const p = s.pts.filter(q => isFinite(q[1])).slice(-1)[0]; if (!p) continue;
      ends.push({ s, x: X(p[0]), y: Y(p[1]) });
    }
    ends.sort((a, b) => a.y - b.y);
    for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < 14) ends[i].ly = (ends[i - 1].ly || ends[i - 1].y) + 14;
    for (const e of ends) {
      g += `<circle class="vz-dot ${e.s.cls || 'c1'}" cx="${e.x.toFixed(1)}" cy="${e.y.toFixed(1)}" r="4"/>`;
      if (e.s.endLabel) g += `<text class="vz-el" x="${(e.x + 8).toFixed(1)}" y="${((e.ly || e.y) + 4).toFixed(1)}">${esc(e.s.endLabel)}</text>`;
    }
    const legend = (spec.legend !== false && ((spec.series || []).length + (spec.bands || []).filter(b => b.label).length) > 1)
      ? `<p class="vz-legend">${(spec.series || []).map(s => `<span><i class="vz-lk ${s.cls || 'c1'}${s.dash ? ' dash' : ''}"></i>${esc(s.label)}</span>`).join('')}${(spec.bands || []).filter(b => b.label).map(b => `<span><i class="vz-bk ${b.cls || 'c1'}"></i>${esc(b.label)}</span>`).join('')}${(spec.rules || []).filter(r => r.legend).map(r => `<span><i class="vz-lk rule ${r.cls || ''}"></i>${esc(r.legend)}</span>`).join('')}</p>` : '';
    // a data table for screen readers (the chart's values without hovering)
    const xs = [...new Set((spec.series || []).flatMap(s => s.pts.map(p => p[0])))].sort((a, b) => a - b);
    const step = Math.max(1, Math.ceil(xs.length / 12));
    const rows = xs.filter((_, i) => i % step === 0 || i === xs.length - 1);
    const table = `<table class="sr-only"><caption>${esc(spec.label || 'Chart data')}</caption><thead><tr><th>${esc(spec.x.name || 'Time')}</th>${(spec.series || []).map(s => `<th>${esc(s.label)}</th>`).join('')}</tr></thead><tbody>${rows.map(x => `<tr><th>${esc(fx(x))}</th>${(spec.series || []).map(s => { const p = s.pts.find(q => q[0] === x); return `<td>${p && isFinite(p[1]) ? esc(fy(p[1])) : '—'}</td>`; }).join('')}</tr>`).join('')}</tbody></table>`;
    el.innerHTML = `<svg class="vz" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(spec.label || '')}">${g}<line class="vz-cross" x1="0" x2="0" y1="${m.t}" y2="${m.t + ih}" visibility="hidden"/><g class="vz-hov"></g><rect class="vz-hit" x="${m.l}" y="${m.t}" width="${iw}" height="${ih}" tabindex="0" aria-label="Explore ${esc(spec.label || 'chart')} values"/></svg>${legend}${table}`;
    // hover: crosshair snaps to the nearest x, readout lists every series at that x
    const svg = el.firstElementChild, cross = svg.querySelector('.vz-cross'), hov = svg.querySelector('.vz-hov'), hit = svg.querySelector('.vz-hit');
    const nearest = (pts, x) => { let b = null, bd = Infinity; for (const p of pts) { const d = Math.abs(p[0] - x); if (d < bd && isFinite(p[1])) { bd = d; b = p; } } return b; };
    function at(xv, cx, cy) {
      if (!xs.length && !(spec.bands || []).length) return;
      const pool = xs.length ? xs : spec.bands[0].pts.map(p => p[0]);
      const snap = pool.reduce((a, b) => (Math.abs(b - xv) < Math.abs(a - xv) ? b : a), pool[0]);
      el._hx = snap;
      cross.setAttribute('x1', X(snap)); cross.setAttribute('x2', X(snap)); cross.setAttribute('visibility', 'visible');
      let dots = '';
      const rowsT = [];
      for (const s of spec.series || []) { const p = nearest(s.pts, snap); if (!p || Math.abs(p[0] - snap) > (xhi - xlo) / 40) continue; dots += `<circle class="vz-dot ${s.cls || 'c1'}" cx="${X(p[0]).toFixed(1)}" cy="${Y(p[1]).toFixed(1)}" r="4"/>`; rowsT.push({ cls: s.cls || 'c1', value: fy(p[1]) + (spec.y && spec.y.unit ? ' ' + spec.y.unit : ''), label: s.label }); }
      for (const b of spec.bands || []) { if (!b.label) continue; const p = b.pts.reduce((a, q) => (Math.abs(q[0] - snap) < Math.abs(a[0] - snap) ? q : a), b.pts[0]); if (p) rowsT.push({ cls: (b.cls || 'c1') + ' band', value: `${fy(p[1])}–${fy(p[2])}`, label: b.label }); }
      hov.innerHTML = dots;
      if (cx != null) showTip(cx, cy, fx(snap), rowsT);
      else { const r = svg.getBoundingClientRect(); showTip(r.left + X(snap) * r.width / W, r.top + m.t + 10, fx(snap), rowsT); }
    }
    const clear = () => { el._hx = null; cross.setAttribute('visibility', 'hidden'); hov.innerHTML = ''; hideTip(); };
    hit.addEventListener('pointermove', e => { const r = svg.getBoundingClientRect(); const px = (e.clientX - r.left) * W / r.width; at(xlo + (px - m.l) / iw * (xhi - xlo), e.clientX, e.clientY); });
    hit.addEventListener('pointerleave', clear);
    hit.addEventListener('blur', clear);
    hit.addEventListener('focus', () => at(xs.length ? xs[xs.length - 1] : xhi));
    hit.addEventListener('keydown', e => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault();
      const i = Math.max(0, xs.indexOf(el._hx != null ? el._hx : xs[xs.length - 1]));
      at(xs[Math.max(0, Math.min(xs.length - 1, i + (e.key === 'ArrowRight' ? 1 : -1)))]);
    });
    if (el._hx != null && el.matches(':hover')) at(el._hx);
    if (!el._ro && 'ResizeObserver' in window) {
      let w0 = W;
      el._ro = new ResizeObserver(() => { const w = Math.round(el.clientWidth); if (Math.abs(w - w0) > 4 && el._spec) { w0 = w; chart(el, el._spec); } });
      el._ro.observe(el);
    }
    el._spec = spec;
  }

  /* ------- columns (one category axis, one value axis) ------- */
  // spec: { label, height, items: [{ k, v, cls, tip }], rule: { y, label, cls }, fmt }
  function columns(el, spec) {
    if (!el) return;
    if (el._spec && el.contains(document.activeElement) && document.activeElement !== el) { el._spec = spec; return; }
    const W = Math.max(240, Math.round(el.clientWidth || 600)), H = spec.height || 180;
    const fy = spec.fmt || compact;
    const vals = spec.items.map(i => i.v).concat(spec.rule ? [spec.rule.y] : []);
    const ny = nice(0, Math.max(1, ...vals) * 1.08, 4);
    const tickW = Math.max(...ny.ticks.map(v => fy(v).length)) * 7 + 10;
    const m = { l: tickW, r: 8, t: 10, b: 24 }, iw = W - m.l - m.r, ih = H - m.t - m.b;
    const n = Math.max(1, spec.items.length), band = iw / n, bw = Math.min(24, Math.max(3, band - 2));
    const Y = v => m.t + ih - (v / ny.hi) * ih;
    let g = '';
    for (const v of ny.ticks) g += `<line class="vz-grid" x1="${m.l}" x2="${W - m.r}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}"/><text class="vz-yt" x="${m.l - 8}" y="${(Y(v) + 4).toFixed(1)}" text-anchor="end">${esc(fy(v))}</text>`;
    spec.items.forEach((it, i) => {
      const x = m.l + band * i + (band - bw) / 2, y = Y(it.v), h = Math.max(0, m.t + ih - y), r = Math.min(4, bw / 2, h);
      const d = `M${x.toFixed(1)} ${(m.t + ih).toFixed(1)}V${(y + r).toFixed(1)}q0 ${-r} ${r} ${-r}h${(bw - 2 * r).toFixed(1)}q${r} 0 ${r} ${r}V${(m.t + ih).toFixed(1)}Z`;
      g += `<path class="vz-col ${it.cls || 'c1'}" d="${d}" data-i="${i}"/><rect class="vz-colhit" x="${(m.l + band * i).toFixed(1)}" y="${m.t}" width="${band.toFixed(1)}" height="${ih}" data-i="${i}" tabindex="${i === spec.items.length - 1 ? 0 : -1}"/>`;
      const every = Math.ceil(n / Math.max(2, Math.floor(iw / 64)));
      if (i % every === 0 || i === n - 1) g += `<text class="vz-xt" x="${(m.l + band * i + band / 2).toFixed(1)}" y="${H - 7}" text-anchor="middle">${esc(it.k)}</text>`;
    });
    if (spec.rule) g += `<line class="vz-rule ${spec.rule.cls || ''}" x1="${m.l}" x2="${W - m.r}" y1="${Y(spec.rule.y).toFixed(1)}" y2="${Y(spec.rule.y).toFixed(1)}"/><text class="vz-rl" x="${m.l + 6}" y="${(Y(spec.rule.y) - 5).toFixed(1)}">${esc(spec.rule.label || '')}</text>`;
    const table = `<table class="sr-only"><caption>${esc(spec.label || '')}</caption><tbody>${spec.items.map(it => `<tr><th>${esc(it.k)}</th><td>${esc(fy(it.v))}</td></tr>`).join('')}</tbody></table>`;
    el.innerHTML = `<svg class="vz" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(spec.label || '')}">${g}</svg>${spec.legend || ''}${table}`;
    const svg = el.firstElementChild;
    const on = (i, cx, cy) => {
      const it = spec.items[i]; if (!it) return;
      svg.querySelectorAll('.vz-col').forEach(c => c.classList.toggle('hot', +c.dataset.i === i));
      const r = svg.getBoundingClientRect();
      showTip(cx != null ? cx : r.left + (m.l + band * i + band / 2) * r.width / W, cy != null ? cy : r.top + Y(it.v) * r.height / H, it.k, [{ cls: it.cls || 'c1', value: fy(it.v) + (spec.unit ? ' ' + spec.unit : ''), label: it.tip || spec.series || '' }]);
    };
    const off = () => { svg.querySelectorAll('.vz-col.hot').forEach(c => c.classList.remove('hot')); hideTip(); };
    svg.querySelectorAll('.vz-colhit').forEach(h => {
      h.addEventListener('pointermove', e => on(+h.dataset.i, e.clientX, e.clientY));
      h.addEventListener('pointerleave', off);
      h.addEventListener('focus', () => on(+h.dataset.i));
      h.addEventListener('blur', off);
      h.addEventListener('keydown', e => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); const j = +h.dataset.i + (e.key === 'ArrowRight' ? 1 : -1); const nx = svg.querySelector(`.vz-colhit[data-i="${j}"]`); if (nx) nx.focus(); } });
    });
    if (!el._ro && 'ResizeObserver' in window) {
      let w0 = W;
      el._ro = new ResizeObserver(() => { const w = Math.round(el.clientWidth); if (Math.abs(w - w0) > 4 && el._spec) { w0 = w; columns(el, el._spec); } });
      el._ro.observe(el);
    }
    el._spec = spec;
  }

  /* ------- a sparkline for stat tiles: history in the quiet hue, the latest point in the accent ------- */
  function spark(values, o = {}) {
    const v = (values || []).filter(isFinite);
    if (v.length < 2) return '';
    const w = o.w || 120, h = o.h || 28;
    let lo = Math.min(...v), hi = Math.max(...v);
    if (o.lo != null) lo = Math.min(lo, o.lo); if (o.hi != null) hi = Math.max(hi, o.hi);
    if (hi - lo < 1e-9) { hi += 1; lo -= 1; }
    const X = i => 2 + (i / (v.length - 1)) * (w - 6), Y = x => h - 3 - ((x - lo) / (hi - lo)) * (h - 6);
    const d = v.map((x, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)} ${Y(x).toFixed(1)}`).join('');
    const lim = o.limit != null ? `<line class="vz-sl ${o.limitCls || ''}" x1="0" x2="${w}" y1="${Y(o.limit).toFixed(1)}" y2="${Y(o.limit).toFixed(1)}"/>` : '';
    return `<svg class="vz-spark ${o.cls || ''}" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true">${lim}<path d="${d}"/><circle cx="${X(v.length - 1).toFixed(1)}" cy="${Y(v[v.length - 1]).toFixed(1)}" r="2.6"/></svg>`;
  }

  /* ------- a meter: the fill carries severity, the track is a lighter step ------- */
  const meter = (k, sev = '') => `<span class="vz-meter ${sev}"><i style="width:${(Math.max(0, Math.min(1, k)) * 100).toFixed(1)}%"></i></span>`;

  return { chart, columns, spark, meter, nice, compact, showTip, hideTip };
})();
