/* DFPerf: measuring and holding frame rate on every three.js / PixiJS page.
   - frame(): call once per rendered frame with the frame's start time; it keeps the last 240 frame intervals.
   - governor: adaptive quality on the real signal (the interval between frames, which includes GPU time), not on
     the time spent in JavaScript. It steps down a ladder after 2 s over budget and back up after 10 s well under it,
     waits out the shader-compile stall after each change, and never runs while the tab is hidden or the user chose a
     level by hand. A ladder lowers pixel ratio before it removes effects.
   - hud: ?perf=1 shows fps, p50 / p95 frame time, draw calls, triangles, GPU resources, heap, level and backend.
   - reduceMotion(): the user's motion preference, live. */
(function () {
  const ft = new Float32Array(240); let n = 0, last = 0;
  function frame(now) { if (last) { ft[n % ft.length] = now - last; n++; } last = now; }
  function stats() {
    const k = Math.min(n, ft.length); if (!k) return { fps: 0, p50: 0, p95: 0 };
    const a = Array.from(ft.subarray(0, k)).sort((x, y) => x - y), mean = a.reduce((s, x) => s + x, 0) / k;
    return { fps: 1000 / mean, p50: a[Math.floor(k * 0.5)], p95: a[Math.min(k - 1, Math.floor(k * 0.95))], frames: n };
  }

  function governor(o) {
    // o: { levels: [...], start: index, apply(level, index), budgetMs: 16.7 }
    const g = { i: o.start || 0, manual: false, ema: o.budgetMs || 16.7, over: 0, under: 0, hold: 0, changes: 0 };
    const budget = o.budgetMs || 16.7;
    g.set = (i, manual) => { i = Math.max(0, Math.min(o.levels.length - 1, i)); if (manual !== undefined) g.manual = !!manual; if (i === g.i) return; g.i = i; g.hold = 3000; g.over = g.under = 0; g.changes++; o.apply(o.levels[i], i); };
    g.tick = (dt) => {
      if (document.hidden || dt > 1000) return;           // a hidden tab or a breakpoint is not a slow GPU
      g.ema += (dt - g.ema) * 0.05;
      if (g.manual) return;
      if (g.hold > 0) { g.hold -= dt; return; }          // the stall after a change compiles shaders
      if (g.ema > budget * 1.3) { g.over += dt; g.under = 0; if (g.over > 2000) g.set(g.i + 1); }
      else if (g.ema < budget * 0.75) { g.under += dt; g.over = 0; if (g.under > 10000) g.set(g.i - 1); }
      else { g.over = Math.max(0, g.over - dt); g.under = Math.max(0, g.under - dt); }
    };
    Object.defineProperty(g, 'level', { get: () => o.levels[g.i] });
    return g;
  }

  function hud(get) {
    if (!/[?&]perf=1/.test(location.search)) return null;
    const el = document.createElement('pre');
    el.setAttribute('aria-hidden', 'true');
    el.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:9999;margin:0;padding:8px 10px;border-radius:8px;background:rgba(10,12,16,.82);color:#cfe3ff;font:12px/1.45 ui-monospace,Menlo,Consolas,monospace;pointer-events:none;white-space:pre';
    document.body.appendChild(el);
    let t = 0;
    return now => {
      if (now - t < 500) return; t = now;
      const s = stats(), x = get() || {}, r = x.renderer, i = r && r.info;
      el.textContent = `fps ${s.fps.toFixed(0)} · p50 ${s.p50.toFixed(1)} · p95 ${s.p95.toFixed(1)} ms\n`
        + (i ? `calls ${i.render.calls} · tris ${(i.render.triangles / 1000).toFixed(0)}k\ngeo ${i.memory.geometries} · tex ${i.memory.textures} · prog ${(i.programs || []).length}\n` : '')
        + (performance.memory ? `heap ${(performance.memory.usedJSHeapSize / 1048576).toFixed(0)} MB\n` : '')
        + `${x.level ? 'level ' + x.level + ' · ' : ''}dpr ${(r && r.getPixelRatio ? r.getPixelRatio() : devicePixelRatio).toFixed(2)} · ${x.backend || 'webgl2'}`;
    };
  }

  const mq = matchMedia('(prefers-reduced-motion: reduce)');
  const reduceMotion = () => mq.matches;
  const onMotionChange = fn => mq.addEventListener ? mq.addEventListener('change', () => fn(mq.matches)) : mq.addListener(() => fn(mq.matches));

  window.DFPerf = { frame, stats, governor, hud, reduceMotion, onMotionChange };
})();
