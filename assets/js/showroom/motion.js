/* Showroom · C · Motion studio (PixiJS 8, WebGPU when the browser has it, WebGL 2 otherwise).
   A brand reel built from layers: parallax backdrops with a liquid displacement, vector flow lines, the product picture
   handed over from the 3D studio (the reel opens on the exact frame the product studio showed), a title set letter by
   letter (word by word in Arabic, so the script stays joined) with a glow, and a field of sparks that follow the
   pointer and burst on a tap. Pixi's ticker is the only loop; GSAP is advanced from it (DFMotion.drive / tick).
   The app is created when the studio opens and destroyed with all its GPU resources when it closes. */
(function () {
  const $ = s => document.querySelector(s);
  const host = $('#pixi'); if (!host) return;
  const tr = t => (window.DFI18N && DFI18N.ar && DFI18N.ar() && DFI18N.t(t)) || t;
  const isAr = () => document.documentElement.lang === 'ar';
  // canvas text has no page direction: embed Arabic right-to-left (RLE … PDF) so punctuation and Latin runs fall in place
  const rtl = t => (isAr() ? '\u202B' + t + '\u202C' : t);
  const REELS = {
    launch: { bg: [0x0B1A6E, 0x1428A0, 0x2189FF], ink: 0xFFFFFF, spark: 0xFFE4C4, glow: 0x6FB1FF, line: 0x8FB8FF, title: 'Made to be seen.', sub: 'QLED 65 · built on Plant EG-01' },
    night: { bg: [0x05070C, 0x111827, 0x3A2A12], ink: 0xFFF4E0, spark: 0xFFB020, glow: 0xFF9E3D, line: 0xC98A3A, title: 'Night shift.', sub: 'Six main lines, on time' },
    clean: { light: true, bg: [0xF2F4F7, 0xE4E9F0, 0xC9D8F5], ink: 0x0F1115, spark: 0x1428A0, glow: 0x9CC7FF, line: 0x1428A0, title: 'Clean room.', sub: 'Dust-free bonding for every panel' }
  };
  let app = null, reel = 'launch', paused = false, tl = null, built = null, opening = null;

  // a soft, seamless noise picture for the liquid displacement (value noise, drawn once)
  function noiseCanvas(n = 256) {
    const c = document.createElement('canvas'); c.width = c.height = n; const g = c.getContext('2d'), img = g.createImageData(n, n);
    let s = 1; const r = () => (s = (s * 16807) % 2147483647) / 2147483647, G = 16, grid = Array.from({ length: G * G }, r);
    const at = (x, y) => grid[((y % G) + G) % G * G + ((x % G) + G) % G];
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const fx = x / n * G, fy = y / n * G, ix = Math.floor(fx), iy = Math.floor(fy), u = fx - ix, v = fy - iy, su = u * u * (3 - 2 * u), sv = v * v * (3 - 2 * v);
      const val = (at(ix, iy) * (1 - su) + at(ix + 1, iy) * su) * (1 - sv) + (at(ix, iy + 1) * (1 - su) + at(ix + 1, iy + 1) * su) * sv;
      const i = (y * n + x) * 4; img.data[i] = img.data[i + 1] = Math.round(val * 255); img.data[i + 2] = 128; img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0); return c;
  }
  function blobCanvas(colors, w, h, seed) {
    const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
    let s = seed; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
    const hex = n => '#' + n.toString(16).padStart(6, '0');
    g.fillStyle = hex(colors[0]); g.fillRect(0, 0, w, h);
    for (let i = 0; i < 9; i++) { const x = r() * w, y = r() * h, rad = (0.25 + r() * 0.5) * Math.max(w, h); const gr = g.createRadialGradient(x, y, 0, x, y, rad); const col = hex(colors[1 + (i % 2)]); gr.addColorStop(0, col + 'cc'); gr.addColorStop(1, col + '00'); g.fillStyle = gr; g.fillRect(0, 0, w, h); }
    return c;
  }
  function sparkCanvas() { const c = document.createElement('canvas'); c.width = 32; c.height = 8; const g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 32, 0); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.8, 'rgba(255,255,255,.9)'); gr.addColorStop(1, 'rgba(255,255,255,1)'); g.fillStyle = gr; g.beginPath(); g.ellipse(16, 4, 16, 3, 0, 0, Math.PI * 2); g.fill(); return c; }

  async function start() {
    if (app || !window.PIXI) return;
    const P = window.PIXI;
    app = new P.Application();
    try {
      await app.init({ resizeTo: host, preference: /[?&]pipeline=legacy/.test(location.search) ? 'canvas' : 'webgpu', antialias: true, autoDensity: true, resolution: Math.min(window.devicePixelRatio || 1, 2), background: REELS[reel].bg[0], powerPreference: 'high-performance' });
    } catch (e) { app = null; $('#mnote').textContent = tr('This browser could not start the 2D renderer.'); return; }
    host.appendChild(app.canvas); app.canvas.setAttribute('aria-hidden', 'true');
    window.__dfBackend = 'pixi-' + app.renderer.name;
    $('#backend').textContent = tr(app.renderer.name === 'webgpu' ? 'PixiJS 8 on WebGPU.' : 'PixiJS 8 on WebGL 2 (this browser has no WebGPU).');
    app.ticker.add(t => { const now = performance.now(); DFPerf.frame(now); DFMotion.tick(now); step(t.deltaMS); if (hud) hud(now); });
    try { await document.fonts.load('800 96px Inter'); } catch (e) { /* system font then */ }
    build();
  }
  // every tween that may still hold a display object of a reel (GSAP renders zero-duration sets from the root)
  function killAll(B) { if (B && B.ctx) { B.ctx.kill(); B.ctx = null; } }
  function stop() {
    if (!app) return;
    if (tl) { tl.kill(); tl = null; }
    if (built) killAll(built);
    app.destroy({ removeView: true, releaseGlobalResources: true }, { children: true, texture: true, textureSource: true });
    app = null; built = null; window.__dfBackend = null;
  }

  function build() {
    const P = window.PIXI, R = REELS[reel], W = app.screen.width, H = app.screen.height;
    app.renderer.background.color = R.bg[0];
    if (tl) { tl.kill(); tl = null; }
    if (built) { killAll(built); built.root.destroy({ children: true, texture: true, textureSource: true }); }
    const root = new P.Container(); app.stage.addChild(root);
    // 1. three parallax backdrops, liquid-displaced
    const back = new P.Container(); root.addChild(back);
    const layers = [0.015, 0.04, 0.08].map((depth, i) => { const s = new P.Sprite(P.Texture.from(blobCanvas(R.bg, 512, 320, 11 + i * 7))); s.anchor.set(0.5); s.width = W * 1.25; s.height = H * 1.25; s.x = W / 2; s.y = H / 2; s.alpha = i ? 0.55 : 1; s.blendMode = i ? 'screen' : 'normal'; back.addChild(s); return { s, depth }; });
    const nTex = P.Texture.from(noiseCanvas()); nTex.source.addressMode = 'repeat';
    const nSprite = new P.Sprite(nTex); nSprite.width = W; nSprite.height = H; nSprite.alpha = 0; root.addChild(nSprite);
    const liquid = new P.DisplacementFilter({ sprite: nSprite, scale: 38 });
    if (app.renderer.name !== 'canvas') back.filters = [liquid];
    // 2. vector flow lines: the conveyors of the plant as long curves, crisp at any resolution
    const lines = new P.Graphics(); root.addChild(lines);
    for (let i = 0; i < 7; i++) { const y = H * (0.58 + i * 0.055); lines.moveTo(-20, y); lines.bezierCurveTo(W * 0.3, y - 60 - i * 8, W * 0.6, y + 40 + i * 6, W + 20, y - 30); }
    lines.stroke({ width: 1.2, color: R.line, alpha: 0.35 });
    // layout: title on one side, the product on the other (mirrored in Arabic), stacked on narrow screens
    const narrow = W < 700, ar = isAr();
    const Lx = { tx: ar ? W * 0.93 : W * 0.07, ty: narrow ? H * 0.24 : H * 0.44, tmax: narrow ? W * 0.86 : W * 0.44, cx: narrow ? W * 0.5 : (ar ? W * 0.29 : W * 0.71), cy: narrow ? H * 0.66 : H * 0.5, cw: narrow ? W * 0.94 : W * 0.54 };
    // 3. the product picture handed over from the 3D studio, dissolving into the backdrop through a soft mask
    const pic = new P.Container(); root.addChild(pic);
    const soft = document.createElement('canvas'); soft.width = soft.height = 256; { const g = soft.getContext('2d'), gr = g.createRadialGradient(128, 128, 40, 128, 128, 128); gr.addColorStop(0, '#fff'); gr.addColorStop(0.62, 'rgba(255,255,255,.95)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 256, 256); }
    if (opening) {
      // the studio's white sweep takes the reel's colour: multiplied once on a 2D canvas (a multiply blend under a mask draws black in Pixi)
      const tint = document.createElement('canvas'); tint.width = opening.width; tint.height = opening.height;
      { const g = tint.getContext('2d'); g.drawImage(opening, 0, 0); g.globalCompositeOperation = 'multiply'; g.fillStyle = '#' + R.bg[R.light ? 0 : 2].toString(16).padStart(6, '0'); g.fillRect(0, 0, tint.width, tint.height); }
      const sp = new P.Sprite(P.Texture.from(tint)); sp.anchor.set(0.5);
      const cover = Math.max(W / opening.width, H / opening.height), fit = Lx.cw / opening.width;
      const m = new P.Sprite(P.Texture.from(soft)); m.anchor.set(0.5); pic.addChild(sp, m); sp.mask = m;
      pic.userData = { sp, m, cover, fit, mw0: W * 2.2, mh0: H * 2.2, mw1: Lx.cw * 1.15, mh1: Lx.cw * opening.height / opening.width * 1.25 };
      sp.scale.set(cover); m.width = pic.userData.mw0; m.height = pic.userData.mh0; pic.x = W / 2; pic.y = H / 2;
    } else {
      // no frame from the 3D studio yet (the reel was opened directly): the same TV as a vector drawing, sharp at any size
      const w = Lx.cw * 0.82, h = w * 0.5625, g = new P.Graphics();
      const sky = new P.FillGradient({ type: 'linear', start: { x: 0, y: 0 }, end: { x: 0, y: 1 }, colorStops: [{ offset: 0, color: 0x0B1A6E }, { offset: 0.55, color: 0x2D5BFF }, { offset: 0.85, color: 0xFF9E6B }, { offset: 1, color: 0xFFD9A8 }], textureSpace: 'local' });
      g.roundRect(-w / 2 - 5, -h / 2 - 5, w + 10, h + 10, 6).fill(0x1C1F24);
      g.rect(-w / 2, -h / 2, w, h).fill(sky);
      g.circle(w * 0.16, h * 0.18, h * 0.09).fill({ color: 0xFFF1D0, alpha: 0.95 });
      const hills = [[0x14205C, 0.18], [0x0D1640, 0.3], [0x070B22, 0.4]];
      for (const [c, k] of hills) { g.moveTo(-w / 2, h / 2); for (let i = 0; i <= 24; i++) { const x = -w / 2 + (i / 24) * w; g.lineTo(x, h * (k - 0.06 * Math.sin(i * 1.7 + k * 9) - 0.05 * Math.sin(i * 0.6))); } g.lineTo(w / 2, h / 2).closePath().fill(c); }
      g.roundRect(-w * 0.04, h / 2 + 5, w * 0.08, h * 0.16, 3).fill(0x9AA1AA);
      g.roundRect(-w * 0.2, h / 2 + 5 + h * 0.16, w * 0.4, h * 0.035, 3).fill(0xC9CDD2);
      pic.addChild(g); pic.x = Lx.cx; pic.y = Lx.cy; pic.alpha = 0;
    }
    // 4. title with a glow, set letter by letter (word by word in Arabic) — and a subtitle
    const size = Math.max(36, Math.min(W * 0.085, H * 0.16)), style = new P.TextStyle({ fontFamily: 'Inter, system-ui, sans-serif', fontWeight: '800', fontSize: size, fill: R.ink, letterSpacing: isAr() ? 0 : -size * 0.03 });
    const title = new P.Container(), glow = new P.Container(); root.addChild(glow, title);
    const text = tr(R.title), units = isAr() ? text.split(' ') : Array.from(text), gap = isAr() ? size * 0.28 : 0;
    const ms = units.map(u => P.CanvasTextMetrics.measureText(u === ' ' ? ' ' : rtl(u), style).width);
    const total = ms.reduce((a, b) => a + b, 0) + gap * (units.length - 1);
    let x = 0; const y0 = Lx.ty;
    title.position.set(Lx.tx, y0); glow.position.copyFrom(title.position);
    const letters = units.map((u, i) => {
      const t = new P.Text({ text: u === ' ' ? ' ' : rtl(u), style }); t.anchor.set(isAr() ? 1 : 0, 1);
      t.x = x; t.y = 0; x += (isAr() ? -1 : 1) * (ms[i] + gap); title.addChild(t);
      const gs = style.clone(); gs.fill = 0xffffff; const g = new P.Text({ text: t.text, style: gs }); g.anchor.copyFrom(t.anchor); g.position.copyFrom(t.position); g.tint = R.glow; glow.addChild(g);
      return [t, g];
    });
    if (app.renderer.name !== 'canvas') glow.filters = [new P.BlurFilter({ strength: size * 0.22, quality: 4 })]; else glow.visible = false; glow.blendMode = R.light ? 'normal' : 'add'; glow.alpha = R.light ? 0.35 : 0.55;
    // a line that mixes Arabic and Latin (QLED 65, EG-01): embedded right to left, with a wider space where the scripts meet
    // (canvas text with a fallback Arabic face can run the two together)
    const mixed = t => (isAr() ? t.replace(/([\u0600-\u06FF])\s+([A-Za-z0-9])/g, '$1\u2003$2').replace(/([A-Za-z0-9])\s+([\u0600-\u06FF])/g, '$1\u2003$2') : t);
    const sub = new P.Text({ text: rtl(mixed(tr(R.sub))), style: new P.TextStyle({ fontFamily: 'Inter, system-ui, sans-serif', fontWeight: '600', fontSize: Math.max(15, size * 0.24), fill: R.ink }) });
    sub.anchor.set(isAr() ? 1 : 0, 0); sub.x = Lx.tx; sub.y = y0 + size * 0.18; sub.alpha = 0.85; root.addChild(sub);
    if (total > Lx.tmax) { const k = Lx.tmax / total; title.scale.set(k); glow.scale.set(k); }
    // 5. sparks: one batched particle container, additive
    const spTex = P.Texture.from(sparkCanvas());
    const sparks = new P.ParticleContainer({ dynamicProperties: { position: true, rotation: true, color: true, vertex: false, uvs: false } });
    sparks.blendMode = R.light ? 'normal' : 'add'; root.addChild(sparks);
    const N = DFPerf.reduceMotion() ? 0 : (W * H > 900000 ? 1400 : 700), parts = [];
    for (let i = 0; i < N; i++) { const p = new P.Particle({ texture: spTex, x: Math.random() * W, y: Math.random() * H, scaleX: 0.4 + Math.random() * 0.8, scaleY: 0.5, anchorX: 1, anchorY: 0.5, tint: R.spark, alpha: 0.1 + Math.random() * 0.6 }); sparks.addParticle(p); parts.push({ p, vx: 0, vy: 0, life: Math.random() }); }
    built = { Lx, root, back, layers, nSprite, liquid, lines, pic, title, glow, letters, sub, sparks, parts, W, H, mx: W / 2, my: H / 2, px: 0, py: 0, t: 0 };
    play();
  }

  function play() {
    if (!built) return;
    if (tl) tl.kill();
    killAll(built);
    const B = built, Ls = B.letters.map(l => l[0]), Gs = B.letters.map(l => l[1]);
    // a GSAP context owns every tween of this reel, including the zero-duration start states, so a rebuild kills them all
    B.ctx = gsap.context(() => {
    tl = gsap.timeline();
    if (B.pic.userData && B.pic.userData.m) {
      // from the full 3D frame to its place in the composition: the hand-over between the two studios
      const u = B.pic.userData;
      tl.fromTo(B.pic, { x: B.W / 2, y: B.H / 2 }, { x: B.Lx.cx, y: B.Lx.cy, duration: 1.4, ease: DFMotion.EASE.move }, 0);
      tl.fromTo(u.sp.scale, { x: u.cover, y: u.cover }, { x: u.fit, y: u.fit, duration: 1.4, ease: DFMotion.EASE.move }, 0);
      tl.fromTo(u.m, { width: u.mw0, height: u.mh0 }, { width: u.mw1, height: u.mh1, duration: 1.4, ease: DFMotion.EASE.move }, 0);
    } else tl.fromTo(B.pic, { alpha: 0, x: B.Lx.cx + 30 }, { alpha: 1, x: B.Lx.cx, duration: 1.0, ease: DFMotion.EASE.enter }, 0);
    tl.add(DFMotion.cascade(Ls, null, { from: { alpha: 0, y: '+=' + 60 }, to: { y: '-=' + 60, duration: 0.9, stagger: 0.04 } }), 0.5);
    tl.add(DFMotion.cascade(Gs, null, { from: { alpha: 0, y: '+=' + 60 }, to: { y: '-=' + 60, duration: 0.9, stagger: 0.04 } }), 0.5);
    tl.fromTo(B.sub, { alpha: 0, y: B.sub.y + 16 }, { alpha: 0.85, y: B.sub.y, duration: 0.8, ease: DFMotion.EASE.enter }, 1.0);
    tl.fromTo(B.lines, { alpha: 0 }, { alpha: 1, duration: 1.4, ease: 'sine.inOut' }, 0.2);
    tl.fromTo(B.glow, { alpha: 0 }, { alpha: 0.55, duration: 1.2, ease: 'sine.inOut' }, 1.0);
    if (DFMotion.reduce()) tl.progress(1);
    });
  }

  // the field: a cheap curl-like flow, the pointer pulls, a tap bursts
  function step(ms) {
    const B = built; if (!B) return;
    const dt = Math.min(0.05, ms / 1000); if (!paused) B.t += dt;
    // parallax eases toward the pointer
    B.px += ((B.mx / B.W - 0.5) - B.px) * 0.06; B.py += ((B.my / B.H - 0.5) - B.py) * 0.06;
    for (const L of B.layers) { L.s.x = B.W / 2 - B.px * B.W * L.depth * 2; L.s.y = B.H / 2 - B.py * B.H * L.depth * 2; }
    B.pic.pivot.set(B.px * 14, B.py * 10); B.title.pivot.set(B.px * -8, B.py * -6); B.glow.pivot.copyFrom(B.title.pivot);
    if (!paused) { B.nSprite.x -= dt * 22; B.nSprite.y -= dt * 9; }
    if (paused || !B.parts.length) return;
    const t = B.t;
    for (const q of B.parts) {
      const p = q.p, a = Math.sin(p.x * 0.004 + t * 0.4) * 1.6 + Math.cos(p.y * 0.005 - t * 0.3) * 1.6;
      q.vx += Math.cos(a) * 18 * dt; q.vy += Math.sin(a) * 18 * dt - 4 * dt;
      const dx = B.mx - p.x, dy = B.my - p.y, d2 = dx * dx + dy * dy + 900; q.vx += dx / d2 * 2600 * dt; q.vy += dy / d2 * 2600 * dt;
      q.vx *= 0.985; q.vy *= 0.985; p.x += q.vx * dt * 30; p.y += q.vy * dt * 30;
      p.rotation = Math.atan2(q.vy, q.vx); p.scaleX = 0.3 + Math.min(1.6, Math.hypot(q.vx, q.vy) * 0.25);
      q.life -= dt * 0.12; if (q.life <= 0 || p.x < -40 || p.x > B.W + 40 || p.y < -40 || p.y > B.H + 40) { p.x = Math.random() * B.W; p.y = B.H + 10; q.vx = 0; q.vy = -2; q.life = 1; }
      p.alpha = Math.max(0, Math.min(0.85, q.life * 1.2));
    }
  }
  function burst(x, y) { const B = built; if (!B || !B.parts.length) return; for (let i = 0; i < 160; i++) { const q = B.parts[(Math.random() * B.parts.length) | 0], a = Math.random() * Math.PI * 2, v = 4 + Math.random() * 8; q.p.x = x; q.p.y = y; q.vx = Math.cos(a) * v; q.vy = Math.sin(a) * v; q.life = 1; } }

  host.addEventListener('pointermove', e => { if (!built) return; const r = host.getBoundingClientRect(); built.mx = e.clientX - r.left; built.my = e.clientY - r.top; });
  host.addEventListener('pointerdown', e => { if (!built) return; const r = host.getBoundingClientRect(); burst(e.clientX - r.left, e.clientY - r.top); });
  const hud = DFPerf.hud(() => ({ renderer: null, level: 'motion', backend: window.__dfBackend || '' }));

  /* ---------- tabs: one studio runs at a time ---------- */
  const tabs = [$('#tab-product'), $('#tab-motion')];
  async function show(which) {
    tabs.forEach(t => { const on = t.id === 'tab-' + which; t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1; });
    $('#stage-product').hidden = which !== 'product'; $('#stage-motion').hidden = which !== 'motion';
    const prod = window.Showroom && Showroom.product;
    if (which === 'motion') {
      // keep the product frame the viewer just saw, to open the reel on it
      if (prod && prod.ready) { try { const g = prod.snapshot(), c = document.createElement('canvas'); c.width = g.width; c.height = g.height; c.getContext('2d').drawImage(g, 0, 0); opening = c; } catch (e) { opening = null; } }
      if (prod) prod.setActive(false);
      if (!window.PIXI) { $('#mnote').textContent = tr('Loading the 2D renderer…'); try { await DFLook.load(DFLook.base + 'assets/vendor/pixi/pixi.min.js'); } catch (e) { $('#mnote').textContent = tr('The 2D renderer could not be fetched.'); return; } $('#mnote').textContent = ''; }
      if (app) build(); else await start();
    } else { stop(); if (prod) prod.setActive(true); }
    try { history.replaceState(null, '', which === 'motion' ? '#motion' : location.pathname + location.search); } catch (e) { /* file:// */ }
  }
  tabs.forEach(t => t.addEventListener('click', () => show(t.id.slice(4))));
  document.querySelector('.sr-tabs').addEventListener('keydown', e => { if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return; const i = tabs.indexOf(document.activeElement); if (i < 0) return; const n = tabs[(i + 1) % 2]; n.focus(); n.click(); });
  document.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b || !b.closest('#stage-motion')) return;
    if (b.dataset.reel) { reel = b.dataset.reel; document.querySelectorAll('[data-reel]').forEach(x => x.setAttribute('aria-pressed', String(x === b))); const R = REELS[reel]; $('#reelCopy').textContent = tr(R.title) + ' ' + tr(R.sub) + '.'; if (app) build(); }
    if (b.id === 'replay') { paused = false; $('#mpause').setAttribute('aria-pressed', 'false'); play(); }
    if (b.id === 'mpause') { paused = !paused; b.setAttribute('aria-pressed', String(paused)); if (tl) tl.paused(paused); }
  });
  let rz = 0; new ResizeObserver(() => { if (!app || !built) return; clearTimeout(rz); rz = setTimeout(() => { if (app && (Math.abs(app.screen.width - built.W) > 2 || Math.abs(app.screen.height - built.H) > 2)) build(); }, 150); }).observe(host);
  if (location.hash === '#motion') show('motion');
  window.Showroom = Object.assign(window.Showroom || {}, { motion: { show, get app() { return app; }, get built() { return built; }, play } });
})();
