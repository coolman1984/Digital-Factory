/* Showroom · A · Product studio. The QLED 65 (assets/models, built by tools/assets) on a studio sweep:
   image-based light from soft boxes, a shadowed key, contact shadows, MSAA, GTAO, bloom only on the screen and the LED,
   a display-referred grade (DFLook), optional depth of field, art directions (realistic, product, cinematic, toon,
   anime, outlined), a materials board (DFMaterials), callouts anchored to parts, camera moves on GSAP driven by this
   loop (DFMotion), adaptive quality (DFPerf), and a path-traced still (three-gpu-pathtracer, on demand).
   The far LOD (41 KB) streams first, the near model (340 KB) replaces it when it arrives. */
(function () {
  const T = window.THREE, $ = s => document.querySelector(s);
  const canvas = $('#gl'); if (!T || !canvas) return;
  const wrap = canvas.parentElement, note = t => { $('#note').textContent = tr(t); };
  const tr = t => (window.DFI18N && DFI18N.ar && DFI18N.ar() && DFI18N.t(t)) || t;
  const BASE = DFLook.base;
  // ?pipeline=legacy renders the same model and poses with the factory's earlier pipeline (no contact shadows, no grade,
  // no studio light rig, the old finish pass), so the benchmark compares pipelines, not assets
  const LEGACY = /[?&]pipeline=legacy/.test(location.search);
  let renderer;
  try { renderer = new T.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false }); }
  catch (e) { note('This browser cannot start WebGL 2, so the studio shows its facts only.'); return; }
  canvas.tabIndex = 0;
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.NeutralToneMapping; renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
  window.__dfRenderer = () => renderer;
  DFMotion.drive();

  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(30, 1, 0.05, 60);
  const controls = new T.OrbitControls(camera, canvas);
  Object.assign(controls, { enableDamping: true, dampingFactor: 0.08, minDistance: 0.6, maxDistance: 7, maxPolarAngle: 1.5, rotateSpeed: 0.6, zoomSpeed: 0.9, enablePan: false });
  const CAMS = {
    hero: { pos: [1.55, 1.0, 2.4], look: [0, 0.5, 0] }, front: { pos: [0, 0.52, 2.75], look: [0, 0.5, 0] },
    side: { pos: [2.45, 0.62, 0.42], look: [0, 0.48, -0.04] }, back: { pos: [-0.95, 0.5, -1.45], look: [0.32, 0.3, -0.05] },
    stand: { pos: [0.62, 0.3, 0.8], look: [0, 0.08, -0.05] }, materials: { pos: [2.6, 0.82, 1.78], look: [2.6, 0.1, 0.28] }
  };
  camera.position.fromArray(CAMS.hero.pos); controls.target.fromArray(CAMS.hero.look);

  /* ---------- light: a studio of soft boxes for reflections, a key with shadows, a rim ---------- */
  function studio() {
    const s = new T.Scene(), PI = Math.PI;
    s.add(new T.Mesh(new T.BoxGeometry(30, 14, 30), new T.MeshBasicMaterial({ color: 0x3C4047, side: T.BackSide })));
    const box = (w, h, x, y, z, rx, ry, k, col = 0xffffff) => { const m = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ color: new T.Color(col).multiplyScalar(k), side: T.DoubleSide })); m.position.set(x, y, z); m.rotation.set(rx, ry, 0); s.add(m); };
    box(10, 4, 0, 6.8, 1, PI / 2, 0, 3.0);                 // overhead soft box
    box(1.2, 9, -7, 3.5, 2, 0, PI / 2, 6.0, 0xF2F6FF);      // a tall strip, left: the long highlight down the glass
    box(1.2, 9, 7, 3.5, -1.5, 0, -PI / 2, 4.0, 0xFFF1E0);   // a warm strip, right
    box(8, 2.5, 0, 2, 9, 0, PI, 1.4);                       // a low fill behind the camera
    box(30, 30, 0, -6.9, 0, -PI / 2, 0, 0.18);              // a dark floor bounce
    return s;
  }
  const pmrem = new T.PMREMGenerator(renderer);
  const envStudio = pmrem.fromScene(studio(), 0.02).texture;
  scene.environment = LEGACY ? pmrem.fromScene(new T.RoomEnvironment(), 0.04).texture : envStudio; scene.environmentIntensity = 1.0;
  const key = new T.DirectionalLight(0xFFF7EE, 2.2); key.position.set(-2.2, 3.6, 2.6); key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048); Object.assign(key.shadow.camera, { left: -2, right: 4, top: 2, bottom: -1.5, near: 0.5, far: 9 }); key.shadow.bias = -0.0002; key.shadow.normalBias = 0.02; key.shadow.radius = 5;
  const rim = new T.DirectionalLight(0xDDE8FF, 1.1); rim.position.set(2.5, 2.2, -3);
  scene.add(key, rim, new T.HemisphereLight(0xffffff, 0x30343a, 0.25));

  /* ---------- the sweep: floor curving into the wall, no horizon line ---------- */
  function sweep() {
    const prof = []; for (let i = 0; i <= 24; i++) prof.push([6 - i * (8 / 24), 0]);
    const R = 1.6; for (let i = 1; i <= 20; i++) { const a = (i / 20) * Math.PI / 2; prof.push([-2 - Math.sin(a) * R, R - Math.cos(a) * R]); }
    for (let i = 1; i <= 10; i++) prof.push([-2 - R, R + i * 0.4]);
    const nx = 40, W = 16, pos = [], nor = [], uv = [], idx = [];
    for (let j = 0; j < prof.length; j++) {
      const [z, y] = prof[j], p0 = prof[Math.max(0, j - 1)], p1 = prof[Math.min(prof.length - 1, j + 1)];
      const tz = p1[0] - p0[0], ty = p1[1] - p0[1], l = Math.hypot(tz, ty) || 1;   // normal: the profile tangent turned toward the camera side
      for (let i = 0; i <= nx; i++) { pos.push(-W / 2 + (i / nx) * W + 1.2, y, z); nor.push(0, -tz / l, ty / l); uv.push(i / nx, j / (prof.length - 1)); }
    }
    for (let j = 0; j < prof.length - 1; j++) for (let i = 0; i < nx; i++) { const a = j * (nx + 1) + i, b = a + nx + 1; idx.push(a, a + 1, b, b, a + 1, b + 1); }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new T.Float32BufferAttribute(nor, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
    return g;
  }
  const sweepMat = new T.MeshStandardMaterial({ color: 0xE6E9ED, roughness: 0.82 });
  const backdrop = new T.Mesh(sweep(), sweepMat); backdrop.receiveShadow = true; scene.add(backdrop);

  /* ---------- contact shadows: depth seen from under the floor, blurred twice (re-rendered only on change) ---------- */
  const CS = { w: 6.6, h: 2.4, x: 1.2, z: 0.05, res: 1024, dark: 1.15, blur: 2.2 };
  const csRT = new T.WebGLRenderTarget(CS.res, Math.round(CS.res * CS.h / CS.w)), csBlur = csRT.clone();
  const csPlane = new T.Mesh(new T.PlaneGeometry(CS.w, CS.h).rotateX(Math.PI / 2), new T.MeshBasicMaterial({ map: csRT.texture, transparent: true, opacity: 0.85, depthWrite: false }));
  csPlane.scale.y = -1; csPlane.position.set(CS.x, 0.0015, CS.z); csPlane.renderOrder = 1; scene.add(csPlane);
  const csCam = new T.OrthographicCamera(-CS.w / 2, CS.w / 2, CS.h / 2, -CS.h / 2, 0, 0.6); csCam.rotation.x = Math.PI / 2; csCam.position.set(CS.x, 0, CS.z);
  const csDepth = new T.MeshDepthMaterial(); csDepth.userData.dark = { value: CS.dark };
  csDepth.onBeforeCompile = sh => { sh.uniforms.dark = csDepth.userData.dark; sh.fragmentShader = 'uniform float dark;\n' + sh.fragmentShader.replace('gl_FragColor = vec4( vec3( 1.0 - fragCoordZ ), opacity );', 'gl_FragColor = vec4( vec3( 0.0 ), ( 1.0 - fragCoordZ ) * dark );'); };
  csDepth.depthTest = false; csDepth.depthWrite = false;
  let csBlurMesh = null, csDirty = true;
  function contactShadow() {
    if (!T.X || !csDirty || LEGACY) return; csDirty = false;
    if (!csBlurMesh) {
      csBlurMesh = new T.Mesh(new T.PlaneGeometry(CS.w, CS.h).rotateX(Math.PI / 2));
      csBlurMesh.userData.h = new T.ShaderMaterial(T.X.HorizontalBlurShader); csBlurMesh.userData.v = new T.ShaderMaterial(T.X.VerticalBlurShader);
      csBlurMesh.userData.h.depthTest = csBlurMesh.userData.v.depthTest = false; csBlurMesh.position.set(CS.x, 0, CS.z); csBlurMesh.visible = false; scene.add(csBlurMesh);
    }
    const bg = scene.background; scene.background = null; backdrop.visible = false; csPlane.visible = false; hotEl.hidden = true;
    const clear = renderer.getClearAlpha(); renderer.setClearAlpha(0);
    scene.overrideMaterial = csDepth; renderer.setRenderTarget(csRT); renderer.clear(); renderer.render(scene, csCam); scene.overrideMaterial = null;
    const pass = (amount) => {
      csBlurMesh.visible = true;
      const h = csBlurMesh.userData.h, v = csBlurMesh.userData.v;
      csBlurMesh.material = h; h.uniforms.tDiffuse.value = csRT.texture; h.uniforms.h.value = amount / 256; renderer.setRenderTarget(csBlur); renderer.render(csBlurMesh, csCam);
      csBlurMesh.material = v; v.uniforms.tDiffuse.value = csBlur.texture; v.uniforms.v.value = amount / 256; renderer.setRenderTarget(csRT); renderer.render(csBlurMesh, csCam);
      csBlurMesh.visible = false;
    };
    pass(CS.blur); pass(CS.blur * 0.4);
    renderer.setRenderTarget(null); renderer.setClearAlpha(clear);
    scene.background = bg; backdrop.visible = true; csPlane.visible = true; hotEl.hidden = false;
  }

  /* ---------- the screen: a demo picture drawn once (dusk over layered hills, no brand) ---------- */
  function demoTexture() {
    const c = document.createElement('canvas'); c.width = 1280; c.height = 720; const g = c.getContext('2d');
    const sky = g.createLinearGradient(0, 0, 0, 720); sky.addColorStop(0, '#0B1A6E'); sky.addColorStop(0.55, '#2D5BFF'); sky.addColorStop(0.82, '#FF9E6B'); sky.addColorStop(1, '#FFD9A8');
    g.fillStyle = sky; g.fillRect(0, 0, 1280, 720);
    const sun = g.createRadialGradient(860, 470, 10, 860, 470, 260); sun.addColorStop(0, 'rgba(255,244,214,1)'); sun.addColorStop(0.12, 'rgba(255,214,160,.95)'); sun.addColorStop(1, 'rgba(255,160,110,0)');
    g.fillStyle = sun; g.fillRect(0, 0, 1280, 720);
    let s = 7; const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    const hills = [['#1B2C7A', 470, 60], ['#14205C', 520, 48], ['#0D1640', 590, 36], ['#070B22', 650, 22]];
    for (const [col, base, amp] of hills) { g.fillStyle = col; g.beginPath(); g.moveTo(0, 720); let y = base; for (let x = 0; x <= 1280; x += 16) { y += (rnd() - 0.5) * amp * 0.45; y = Math.max(base - amp, Math.min(base + amp, y)); g.lineTo(x, y); } g.lineTo(1280, 720); g.closePath(); g.fill(); }
    const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 8;
    return t;
  }
  const demo = demoTexture();

  /* ---------- the materials board ---------- */
  const board = new T.Group(), BOARD = ['brushedAluminium', 'chrome', 'gold', 'tintedGlass', 'ceramic', 'fabric', 'velvet', 'plasticGloss', 'rubber', 'skin'];
  const NAMES = { brushedAluminium: 'Brushed aluminium', chrome: 'Chrome', gold: 'Gold', tintedGlass: 'Glass', ceramic: 'Ceramic', fabric: 'Fabric', velvet: 'Velvet', plasticGloss: 'Gloss plastic', rubber: 'Rubber', skin: 'Skin' };
  const sph = new T.SphereGeometry(0.075, 64, 40); sph.computeTangents();
  BOARD.forEach((name, i) => { const r = Math.floor(i / 5), c = i % 5; const m = new T.Mesh(sph, DFMaterials.make(T, name)); m.position.set(2.6 + (c - 2) * 0.2 + (r ? 0.1 : 0), 0.075, 0.42 - r * 0.26); m.castShadow = true; m.userData.label = NAMES[name]; board.add(m); });
  scene.add(board);

  /* ---------- the model: far LOD first, then the near one ---------- */
  const lod = new T.LOD(); scene.add(lod);
  let parts = {}, finishMat = null, glassMat = null;
  const FINISH = { graphite: { color: 0x2B2E33, metal: 1, rough: 0.34 }, silver: { color: 0xC9CDD2, metal: 1, rough: 0.28 }, pearl: { color: 0xEEEDE8, metal: 0, rough: 0.22, clearcoat: 0.8 } };
  let state = { cam: 'hero', finish: 'graphite', screen: 'on', look: 'realistic', dof: false, hot: true };
  function prep(root) {
    root.traverse(o => {
      if (!o.isMesh) return;
      o.castShadow = o.receiveShadow = true;
      const m = o.material;
      // instance-owned materials for the parts the viewer changes; textures stay shared
      if (m.name === 'anodised') { o.material = m.clone(); o.material.name = 'anodised'; }
      if (m.name === 'glass') { o.material = m.clone(); o.material.name = 'glass'; }
      parts[o.name] = o;
    });
    return root;
  }
  function applyVariant() {
    lod.traverse(o => {
      if (!o.isMesh) return;
      const m = o.material;
      if (m.name === 'anodised') {
        const F = FINISH[state.finish];
        if (!(m.isMeshPhysicalMaterial)) return;
        m.color.set(F.color); m.metalness = F.metal; m.roughness = F.rough; m.clearcoat = F.clearcoat || 0; m.anisotropy = F.metal ? 0.35 : 0;
      }
      if (m.name === 'glass') { const on = state.screen === 'on'; m.emissive.set(on ? 0xffffff : 0x000000); m.emissiveMap = on ? demo : null; m.emissiveIntensity = on ? 1.05 : 0; m.needsUpdate = true; }
    });
    csDirty = true;
  }
  async function loadModels() {
    try { await DFLook.extras(); }
    catch (e) { note('The model loader could not be fetched. Check the connection and reload.'); return; }
    const loader = new T.X.GLTFLoader(); loader.setMeshoptDecoder(T.X.MeshoptDecoder);
    const get = url => new Promise((res, rej) => loader.load(url, g => res(g.scene), undefined, rej));
    try {
      const far = prep(await get(BASE + 'assets/models/tv-qled65-lod1.glb'));
      lod.addLevel(far, 0); applyVariant(); ready = true; note('');
      // the near model streams in behind the far one; the far one stays as the level beyond 6 m
      const near = prep(await get(BASE + 'assets/models/tv-qled65.glb'));
      lod.levels[0].distance = 6; lod.addLevel(near, 0); applyVariant();
      buildComposer();
    } catch (e) { console.error(e); note('The model could not be loaded. Reload to try again.'); }
  }
  let ready = false;

  /* ---------- callouts anchored to parts (hidden when the part faces away) ---------- */
  const hotEl = $('#hot');
  const HOT = [
    { t: 'Quantum-dot panel', p: [0.36, 0.64, 0.016], n: [0, 0, 1] }, { t: 'Anodised frame, 6 mm', p: [0.725, 0.9, 0.0], n: [0.6, 0.6, 0.5] },
    { t: 'Fabric speaker', p: [-0.3, 0.083, 0.016], n: [0, 0, 1] }, { t: 'Brushed aluminium stand', p: [0.2, 0.016, 0.06], n: [0.3, 0.8, 0.5] },
    { t: 'Four HDMI ports', p: [0.39, 0.27, -0.052], n: [0, 0, -1] }
  ].concat(board.children.map(m => ({ t: m.userData.label, p: [m.position.x, 0.165, m.position.z], n: [0, 0.5, 0.86], board: true })));
  HOT.forEach(h => { const d = document.createElement('div'); d.className = 'h off'; d.innerHTML = `<span>${h.t}</span>`; hotEl.appendChild(d); h.el = d; h.v = new T.Vector3(...h.p); h.nv = new T.Vector3(...h.n).normalize(); });
  const v3 = new T.Vector3(), vd = new T.Vector3();
  function hotspots() {
    const r = wrap.getBoundingClientRect();
    for (const h of HOT) {
      let on = state.hot && !pt && ready && !DFLook.PROFILES[state.look].bars;
      if (on) { vd.copy(camera.position).sub(h.v); const dist = vd.length(); on = vd.normalize().dot(h.nv) > 0.15 && dist < (h.board ? 2.4 : 4.2) * camK; }
      if (on) { v3.copy(h.v).project(camera); on = v3.z < 1 && Math.abs(v3.x) < 0.95 && Math.abs(v3.y) < 0.95; }
      h.el.classList.toggle('off', !on);
      if (on) {
        // near the right edge the label sits on the left of its dot
        const x = (v3.x + 1) / 2 * r.width, y = (1 - v3.y) / 2 * r.height, flip = x > r.width - 230;
        if (!h.w || h.flip !== flip) { h.el.classList.toggle('l', flip); h.flip = flip; h.w = h.el.offsetWidth; }
        h.el.style.transform = `translate(${(flip ? x - h.w + 5 : x - 5).toFixed(1)}px, ${(y - 10).toFixed(1)}px)`;
      }
    }
  }

  /* ---------- post: quality levels × looks ---------- */
  const LEVELS = [{ id: 'high', dpr: 2, msaa: 4, ao: true, bloom: true }, { id: 'high-1.5', dpr: 1.5, msaa: 4, ao: true, bloom: true }, { id: 'medium', dpr: 1.25, msaa: 4, ao: false, bloom: true }, { id: 'low', dpr: 1, msaa: 0, ao: false, bloom: false }];
  const phone = matchMedia('(max-width: 899px)').matches || /Mobi|Android/i.test(navigator.userAgent);
  let composer = null, grade = null, edge = null, bokeh = null, gtao = null;
  const gov = DFPerf.governor({ levels: LEVELS, start: phone ? 2 : 0, budgetMs: 16.7, apply: () => buildComposer() });
  let W = 1, H = 1;
  function buildComposer() {
    DFLook.disposeComposer(composer); composer = null; edge = bokeh = gtao = null;
    const L = gov.level, P = DFLook.PROFILES[state.look];
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, L.dpr));
    renderer.setSize(W, H, false);
    const sz = renderer.getDrawingBufferSize(new T.Vector2());
    const rt = new T.WebGLRenderTarget(sz.x, sz.y, { type: T.HalfFloatType, samples: L.msaa });
    composer = new T.EffectComposer(renderer, rt);
    composer.addPass(new T.RenderPass(scene, camera));
    if (L.ao && P.art === 'realistic') {
      gtao = new T.GTAOPass(scene, camera, sz.x, sz.y);
      gtao.updateGtaoMaterial({ radius: 0.12, distanceExponent: 1.2, thickness: 0.06, scale: 1.0, samples: 12 });
      gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 4, rings: 2, samples: 12 });
      gtao.blendIntensity = 0.8; composer.addPass(gtao);
    }
    if (P.outline) composer.addPass(edge = DFLook.edgePass(T, scene, camera, sz.x, sz.y, { color: state.look === 'anime' ? 0x1b1530 : 0x15181d, thickness: Math.max(1.5, renderer.getPixelRatio() * (state.look === 'anime' ? 1.6 : 1.2)), strength: 1, depthK: 0.01, normalK: 0.3 }));
    if (state.dof && T.X && T.X.BokehPass) { bokeh = new T.X.BokehPass(scene, camera, { focus: 2.5, aperture: 0.0016, maxblur: 0.008 }); composer.addPass(bokeh); }
    if (L.bloom) composer.addPass(new T.UnrealBloomPass(new T.Vector2(sz.x / 2, sz.y / 2), 0.22, 0.4, 0.92));
    composer.addPass(new T.OutputPass());
    if (LEGACY) { composer.addPass(grade = DFShaders.finishPass(T, 0.45)); csPlane.visible = false; rim.visible = false; }
    else { composer.addPass(grade = DFLook.gradePass(T)); DFLook.applyGrade(grade, P); }
    composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(W, H);
    DFLook.setToon(T, scene, P.art === 'toon', { bands: P.bands, rim: P.rim });
    scene.environmentIntensity = P.art === 'toon' ? 0.75 : 1.0; renderer.toneMappingExposure = P.exposure || 1;
    csDirty = true;
  }
  function resize() { const r = wrap.getBoundingClientRect(); W = Math.max(1, r.width); H = Math.max(1, r.height); camera.aspect = W / H; camera.updateProjectionMatrix(); if (!userMoved && !move && !pt) setCam(state.cam, true); renderer.setSize(W, H, false); if (composer) { composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(W, H); } if (pt) pt.reset && pt.reset(); }
  new ResizeObserver(resize).observe(wrap);

  /* ---------- theme ---------- */
  function applyTheme() {
    const dark = document.documentElement.dataset.theme === 'dark';
    scene.background = new T.Color(dark ? 0x101216 : 0xE9ECEF); sweepMat.color.set(dark ? 0x1B1E24 : 0xE6E9ED);
    csPlane.material.opacity = dark ? 0.95 : 0.85; key.intensity = dark ? 1.8 : 2.2; csDirty = true;
  }
  new MutationObserver(applyTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  applyTheme();

  /* ---------- camera moves (GSAP, driven by this loop) and keys ---------- */
  let move = null;
  // narrow frames (phones, portrait) step the camera back so the product still fits
  let camK = 1;
  const framed = c => { const k = camK = Math.pow(Math.max(1, 1.45 / Math.max(0.3, camera.aspect)), 0.9); return { look: c.look, pos: c.look.map((v, i) => v + (c.pos[i] - v) * k) }; };
  let userMoved = false;
  controls.addEventListener('start', () => { userMoved = true; });
  function setCam(id, cut) {
    const c0 = CAMS[id]; if (!c0) return; state.cam = id; stopPT(); userMoved = false;
    const c = framed(c0);
    if (cut) { camera.position.fromArray(c.pos); controls.target.fromArray(c.look); press('[data-cam]', 'cam', id); return; }
    if (move) move.kill();
    controls.enabled = false;
    move = DFMotion.camera(camera, controls.target, c, { duration: 1.5, onComplete: () => { controls.enabled = true; move = null; } });
    press('[data-cam]', 'cam', id);
  }
  const sph2 = new T.Spherical();
  canvas.addEventListener('keydown', e => {
    const k = e.key; if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '=', '-', '_', '0'].includes(k)) return;
    e.preventDefault(); stopPT();
    if (k === '0') return setCam('hero');
    const off = camera.position.clone().sub(controls.target); sph2.setFromVector3(off);
    if (k === 'ArrowLeft') sph2.theta -= 0.12; if (k === 'ArrowRight') sph2.theta += 0.12;
    if (k === 'ArrowUp') sph2.phi = Math.max(0.2, sph2.phi - 0.08); if (k === 'ArrowDown') sph2.phi = Math.min(controls.maxPolarAngle, sph2.phi + 0.08);
    if (k === '+' || k === '=') sph2.radius = Math.max(controls.minDistance, sph2.radius * 0.88); if (k === '-' || k === '_') sph2.radius = Math.min(controls.maxDistance, sph2.radius * 1.12);
    camera.position.copy(controls.target).add(off.setFromSpherical(sph2));
  });

  /* ---------- path-traced still ---------- */
  let pt = null, ptLights = [], ptEnv = null, ptTarget = 600, ptSwap = [];
  async function startPT() {
    if (pt) return stopPT();
    if (!ready) return;
    note('Loading the path tracer…');
    try { await DFLook.load(BASE + 'assets/vendor/three/three-pathtracer.iife.min.js'); } catch (e) { note('The path tracer could not be fetched.'); return; }
    try {
      const X = T.X;
      DFLook.setToon(T, scene, false);
      ptEnv = new X.GradientEquirectTexture(); ptEnv.topColor.set(0xffffff); ptEnv.bottomColor.set(0x2a2d33); ptEnv.exponent = 2; ptEnv.update();
      scene.environment = ptEnv;
      const a1 = new T.RectAreaLight(0xffffff, 4, 3.2, 1.6); a1.position.set(0, 3.0, 1.2); a1.lookAt(0, 0.4, 0);
      const a2 = new T.RectAreaLight(0xF2F6FF, 6, 0.5, 2.6); a2.position.set(-2.4, 1.4, 1.2); a2.lookAt(0, 0.5, 0);
      ptLights = [a1, a2]; scene.add(a1, a2);
      csPlane.visible = false; board.visible = state.cam === 'materials';
      // the path tracer reads plain float vertices: swap the quantized (meshopt) attributes for float copies while it runs
      ptSwap = [];
      lod.levels.forEach((l, i) => { l.object.visible = i === 0; });
      lod.autoUpdate = false;
      scene.traverse(o => {
        if (!o.isMesh || !o.geometry) return;
        const g = o.geometry; if (!Object.values(g.attributes).some(a => a.normalized || a.isInterleavedBufferAttribute || !(a.array instanceof Float32Array))) return;
        const f = new T.BufferGeometry();
        for (const [k, a] of Object.entries(g.attributes)) { const n = a.count, sz = a.itemSize, arr = new Float32Array(n * sz); for (let i = 0; i < n; i++) for (let c = 0; c < sz; c++) arr[i * sz + c] = a.getComponent(i, c); f.setAttribute(k, new T.BufferAttribute(arr, sz)); }
        if (g.index) f.setIndex(new T.BufferAttribute(new Uint32Array(g.index.array), 1));
        ptSwap.push([o, g]); o.geometry = f;
      });
      pt = new X.WebGLPathTracer(renderer);
      pt.tiles.set(phone ? 3 : 2, phone ? 3 : 2); pt.renderScale = Math.min(1, gov.level.dpr / (window.devicePixelRatio || 1) * (phone ? 0.75 : 1)); pt.minSamples = 1; pt.fadeDuration = 300;
      pt.setScene(scene, camera);
      for (const h of HOT) h.el.classList.add('off');
      $('#ptBar').hidden = false; $('#ptBtn').textContent = tr('Back to live view'); note('');
    } catch (e) { console.error(e); stopPT(); note('This browser could not start the path tracer (it needs WebGL 2 float targets). The live view is unchanged.'); }
  }
  function stopPT() {
    if (!pt) return;
    try { pt.dispose(); } catch (e) { /* already gone */ }
    pt = null; for (const l of ptLights) { l.removeFromParent(); l.dispose && l.dispose(); } ptLights = [];
    for (const [o, g] of ptSwap) { o.geometry.dispose(); o.geometry = g; } ptSwap = []; lod.autoUpdate = true;
    if (ptEnv) { ptEnv.dispose(); ptEnv = null; }
    scene.environment = envStudio; csPlane.visible = true; board.visible = true;
    $('#ptBar').hidden = true; $('#ptBtn').textContent = tr('Render path-traced still');
    buildComposer();
  }
  controls.addEventListener('change', () => { if (pt) pt.updateCamera(); });

  /* ---------- controls in the panel ---------- */
  function press(sel, key, val) { document.querySelectorAll(sel).forEach(b => b.setAttribute('aria-pressed', String(b.dataset[key] === val))); }
  const looks = $('#looks');
  looks.innerHTML = Object.entries(DFLook.PROFILES).map(([id, p]) => `<button type="button" data-look="${id}" aria-pressed="${id === 'realistic'}">${p.label}</button>`).join('');
  document.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b || !b.closest('#stage-product')) return;
    if (b.dataset.cam) setCam(b.dataset.cam);
    else if (b.dataset.finish) { state.finish = b.dataset.finish; press('[data-finish]', 'finish', state.finish); stopPT(); applyVariant(); }
    else if (b.dataset.screen) { state.screen = b.dataset.screen; press('[data-screen]', 'screen', state.screen); stopPT(); applyVariant(); }
    else if (b.dataset.look) { state.look = b.dataset.look; press('[data-look]', 'look', state.look); const P = DFLook.PROFILES[state.look]; if (P.dof !== undefined) { state.dof = !!P.dof && state.look !== 'realistic'; $('#dof').setAttribute('aria-pressed', String(state.dof)); } stopPT(); buildComposer(); }
    else if (b.dataset.q) { if (b.dataset.q === 'auto') { gov.manual = false; } else gov.set(+b.dataset.q, true); press('[data-q]', 'q', b.dataset.q); buildComposer(); }
    else if (b.id === 'ptBtn') startPT();
  });
  $('#dof').addEventListener('click', e => { state.dof = !state.dof; e.currentTarget.setAttribute('aria-pressed', String(state.dof)); stopPT(); buildComposer(); });
  $('#hotOn').addEventListener('click', e => { state.hot = !state.hot; e.currentTarget.setAttribute('aria-pressed', String(state.hot)); });

  /* ---------- the loop (the only clock: GSAP, the governor and the frame share it) ---------- */
  let active = true, last = 0, frames = 0;
  const hud = DFPerf.hud(() => ({ renderer, level: gov.level.id + (gov.manual ? ' (manual)' : ''), backend: 'webgl2' + (pt ? ' · path tracer' : '') }));
  function frame(now) {
    requestAnimationFrame(frame);
    if (!active) { last = 0; return; }
    const dt = last ? now - last : 16.7; last = now; frames++;
    DFPerf.frame(now); DFMotion.tick(now);
    if (!pt) gov.tick(dt);
    controls.update();
    if (!composer) return;
    if (pt) {
      pt.renderSample();
      const n = Math.floor(pt.samples || 0); $('#ptFill').style.width = Math.min(100, n / ptTarget * 100).toFixed(1) + '%';
      $('#ptText').textContent = n >= ptTarget ? tr('Path-traced still ready') : `${tr('Path tracing')} · ${n} / ${ptTarget}`;
    } else {
      contactShadow();
      if (bokeh) { bokeh.uniforms.focus.value = camera.position.distanceTo(controls.target); bokeh.uniforms.aspect.value = camera.aspect; }
      if (grade.isGrade) DFLook.frameGrade(grade, camera, frames); else { grade.uniforms.frame.value = frames; grade.uniforms.aspect.value = camera.aspect; }
      composer.render(dt / 1000);
      hotspots();
    }
    if (hud) hud(now);
  }
  resize(); buildComposer(); requestAnimationFrame(frame);
  note('Loading the model…');
  loadModels();

  window.Showroom = Object.assign(window.Showroom || {}, {
    product: { renderer, scene, camera, controls, gov, state, setCam, setLook: id => { const b = document.querySelector(`[data-look="${id}"]`); if (b) b.click(); }, startPT, stopPT, get ready() { return ready; }, get frames() { return frames; }, get samples() { return pt ? pt.samples : 0; },
      edgeDebug(v) { if (edge) edge.uniforms.debug.value = v; },
      get passes() { return composer ? composer.passes.map(p => p.constructor.name + (p.isEdge ? ':edge' : p.isGrade ? ':grade' : '')) : []; },
      setActive(v) { active = !!v; window.__dfRenderer = v ? () => renderer : null; if (!v) stopPT(); }, snapshot() { if (composer) composer.render(0); return canvas; } }
  });
})();
