/* Machine studio (inspect.html): one machine of Plant EG-01 in a white studio, from its Blender asset.
   The asset (assets/models/machines/<kind>/<kind>.glb, built by tools/blender and packed by tools/assets) carries every
   part as a named node with glTF extras: part_id, role, explode (an offset), shell (a cover) and anchor (a label point).
   The manifest (parts.json) adds the Arabic and English names. This page:
     · takes the machine apart along the authored offsets, staged, and back to the exact assembled transforms
     · turns the covers to an X-ray outline, or cuts them with a movable section whose caps are drawn with the stencil
       buffer, so a cut never shows hollow skins
     · names and selects every part, frames it, shows only it, and plays an illustrative pick-and-place cycle
     · runs a customer tour through all of it.
   It reads no plant state and writes none: inspection never changes production or its audit trail.
   Blender is Z up: an authored vector (x, y, z) is (x, z, −y) here. */
(function () {
  const T = window.THREE, $ = s => document.querySelector(s);
  const canvas = $('#gl'); if (!T || !canvas) return;
  const wrap = canvas.parentElement;
  const ar = () => !!(window.DFI18N && DFI18N.ar && DFI18N.ar());
  const tr = t => (ar() && window.DFI18N && DFI18N.t(t)) || t;
  const note = t => { $('#note').textContent = tr(t); };
  const KIND = (location.search.match(/[?&]m=([a-z0-9-]+)/) || [, 'mounter'])[1];
  const URL_GLB = `${DFLook.base}assets/models/machines/${KIND}/${KIND}.glb`, URL_PARTS = `${DFLook.base}assets/models/machines/${KIND}/parts.json`;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const bl = v => new T.Vector3(v[0], v[2], -v[1]);

  let renderer;
  try { renderer = new T.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: true }); }
  catch (e) { note('This browser cannot start WebGL 2, so the studio lists the parts only.'); return; }
  canvas.tabIndex = 0;
  renderer.outputColorSpace = T.SRGBColorSpace; renderer.toneMapping = T.NeutralToneMapping; renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
  renderer.localClippingEnabled = true;
  window.__dfRenderer = () => renderer;
  DFMotion.drive();

  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(30, 1, 0.05, 80);
  const controls = new T.OrbitControls(camera, canvas);
  Object.assign(controls, { enableDamping: true, dampingFactor: 0.08, minDistance: 0.5, maxDistance: 14, maxPolarAngle: 1.52, rotateSpeed: 0.6, zoomSpeed: 0.9, screenSpacePanning: true });
  const CAMS = {
    hero: { pos: [3.45, 2.45, 4.35], look: [0, 0.95, 0.05] }, front: { pos: [0, 1.45, 6.0], look: [0, 0.95, 0] },
    side: { pos: [6.2, 1.45, 0], look: [0, 0.95, 0] }, top: { pos: [0.01, 6.6, 0.9], look: [0, 0.9, 0] },
    head: { pos: [0.95, 1.55, 1.75], look: [-0.1, 1.08, 0.0] }, apart: { pos: [4.9, 3.7, 6.1], look: [0, 1.35, 0.1] },
    inside: { pos: [2.5, 1.35, 3.6], look: [0.05, 0.7, 0] }
  };

  /* ---------- light: the showroom's soft-box environment, a shadowed key, a rim ---------- */
  function studio() {
    const s = new T.Scene(), PI = Math.PI;
    s.add(new T.Mesh(new T.BoxGeometry(30, 14, 30), new T.MeshBasicMaterial({ color: 0x3C4047, side: T.BackSide })));
    const box = (w, h, x, y, z, rx, ry, k, col = 0xffffff) => { const m = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ color: new T.Color(col).multiplyScalar(k), side: T.DoubleSide })); m.position.set(x, y, z); m.rotation.set(rx, ry, 0); s.add(m); };
    box(10, 4, 0, 6.8, 1, PI / 2, 0, 3.0); box(1.2, 9, -7, 3.5, 2, 0, PI / 2, 6.0, 0xF2F6FF); box(1.2, 9, 7, 3.5, -1.5, 0, -PI / 2, 4.0, 0xFFF1E0);
    box(8, 2.5, 0, 2, 9, 0, PI, 1.4); box(30, 30, 0, -6.9, 0, -PI / 2, 0, 0.18);
    return s;
  }
  const pmrem = new T.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(studio(), 0.02).texture;
  const key = new T.DirectionalLight(0xFFF7EE, 2.3); key.position.set(-3.6, 5.4, 4.2); key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048); Object.assign(key.shadow.camera, { left: -3.4, right: 3.4, top: 3.4, bottom: -3.4, near: 1, far: 16 });
  key.shadow.bias = -0.0003; key.shadow.normalBias = 0.02; key.shadow.radius = 6;
  const rim = new T.DirectionalLight(0xDDE8FF, 1.0); rim.position.set(3.5, 3.2, -4.5);
  scene.add(key, rim, new T.HemisphereLight(0xffffff, 0x30343a, 0.3));

  /* ---------- the sweep: floor curving into the wall ---------- */
  function sweep() {
    const prof = []; for (let i = 0; i <= 30; i++) prof.push([9 - i * (12 / 30), 0]);
    const R = 2.4; for (let i = 1; i <= 24; i++) { const a = (i / 24) * Math.PI / 2; prof.push([-3 - Math.sin(a) * R, R - Math.cos(a) * R]); }
    for (let i = 1; i <= 12; i++) prof.push([-3 - R, R + i * 0.6]);
    const nx = 48, W = 44, pos = [], nor = [], idx = [];
    for (let j = 0; j < prof.length; j++) {
      const [z, y] = prof[j], p0 = prof[Math.max(0, j - 1)], p1 = prof[Math.min(prof.length - 1, j + 1)];
      const tz = p1[0] - p0[0], ty = p1[1] - p0[1], l = Math.hypot(tz, ty) || 1;
      for (let i = 0; i <= nx; i++) { pos.push(-W / 2 + (i / nx) * W, y, z); nor.push(0, -tz / l, ty / l); }
    }
    for (let j = 0; j < prof.length - 1; j++) for (let i = 0; i < nx; i++) { const a = j * (nx + 1) + i, b = a + nx + 1; idx.push(a, a + 1, b, b, a + 1, b + 1); }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new T.Float32BufferAttribute(nor, 3)); g.setIndex(idx);
    return g;
  }
  const sweepMat = new T.MeshStandardMaterial({ color: 0xE6E9ED, roughness: 0.85 });
  const backdrop = new T.Mesh(sweep(), sweepMat); backdrop.receiveShadow = true; scene.add(backdrop);

  /* ---------- the machine ---------- */
  const machine = new T.Group(); scene.add(machine);
  const byId = {};          // part_id -> Object3D (assemblies and parts)
  let manifest = null, ready = false;
  const exploders = [];     // { o, home, vec, delay }
  const shells = [];        // meshes of covers
  const meshes = [];        // every mesh, for picking and isolation
  const S = { explode: 0, xray: false, cut: false, cutPos: 0.45, motion: false, sel: null, isolate: false, cam: 'hero' };

  const ghostMat = new T.ShaderMaterial({
    uniforms: { color: { value: new T.Color(0x2189FF) } }, transparent: true, depthWrite: false, side: T.DoubleSide,
    vertexShader: 'varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = -mv.xyz; gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'uniform vec3 color; varying vec3 vN; varying vec3 vV; void main(){ float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.2); gl_FragColor = vec4(color, 0.05 + 0.6 * f); }'
  });

  // the section: keep z ≤ c (the machine's front faces +z); caps fill the cut through every cover
  const plane = new T.Plane(new T.Vector3(0, 0, -1), 10);
  const capMat = new T.MeshStandardMaterial({ color: 0xE0512B, roughness: 0.6, metalness: 0, stencilWrite: true, stencilRef: 0, stencilFunc: T.NotEqualStencilFunc, stencilFail: T.ReplaceStencilOp, stencilZFail: T.ReplaceStencilOp, stencilZPass: T.ReplaceStencilOp });
  const cap = new T.Mesh(new T.PlaneGeometry(8, 8), capMat); cap.renderOrder = 2; cap.visible = false;
  cap.onAfterRender = r => r.clearStencil();
  scene.add(cap);
  const stencilBack = new T.MeshBasicMaterial({ depthWrite: false, depthTest: false, colorWrite: false, stencilWrite: true, stencilFunc: T.AlwaysStencilFunc, side: T.BackSide, clippingPlanes: [plane], stencilFail: T.IncrementWrapStencilOp, stencilZFail: T.IncrementWrapStencilOp, stencilZPass: T.IncrementWrapStencilOp });
  const stencilFront = stencilBack.clone(); stencilFront.side = T.FrontSide; stencilFront.clippingPlanes = [plane];
  stencilFront.stencilFail = stencilFront.stencilZFail = stencilFront.stencilZPass = T.DecrementWrapStencilOp;
  const stencilMeshes = [];

  const shellCopy = new Map();
  function prep(root) {
    root.traverse(o => {
      const x = o.userData || {};
      if (x.part_id) { byId[x.part_id] = o; o.userData.home = o.position.clone(); }
      if (x.explode && (x.explode[0] || x.explode[1] || x.explode[2])) exploders.push({ o, home: o.position.clone(), vec: bl(x.explode) });
      if (!o.isMesh) return;
      o.castShadow = o.receiveShadow = true;
      if (o.material.transmission > 0) {
        // glass and translucent reels: plain alpha instead of a transmission pass (one render, no artefacts on weak GPUs)
        const m = o.material, glass = m.name === 'glass';
        m.transmission = 0; m.transparent = true; m.opacity = glass ? 0.14 : 0.62; m.depthWrite = !glass; m.roughness = Math.min(m.roughness, 0.12);
        if (glass) { m.color.set(0xEAF2F8); m.envMapIntensity = 1.4; }
        o.castShadow = !glass; o.userData.glass = glass;
      }
      o.userData.mat = o.material; meshes.push(o);
      let p = o; while (p && !(p.userData && p.userData.part_id)) p = p.parent;
      o.userData.part = p ? p.userData.part_id : null;
      if (p && p.userData.shell) {
        // covers get their own copy of each shared material, so the section clips covers only (not the frame or the arm)
        const src = o.material; o.material = shellCopy.get(src) || shellCopy.set(src, src.clone()).get(src); o.userData.mat = o.material;
        shells.push(o);
      }
    });
    // stage the explosion: the farthest-travelling assemblies leave first, as a technician would lift the hood first
    exploders.sort((a, b) => b.vec.length() - a.vec.length()).forEach((e, i, all) => { e.delay = 0.45 * i / Math.max(1, all.length - 1); });
    // clipped covers write the stencil from inside: front faces count down, back faces count up
    for (const m of shells) {
      const b = new T.Mesh(m.geometry, stencilBack), f = new T.Mesh(m.geometry, stencilFront);
      b.renderOrder = f.renderOrder = 1; b.visible = f.visible = false; b.raycast = f.raycast = () => {};
      m.add(b, f); stencilMeshes.push(b, f);
    }
  }

  const smooth = t => t * t * (3 - 2 * t);
  function applyExplode() {
    const t = S.explode;
    for (const e of exploders) {
      const k = smooth(Math.min(1, Math.max(0, (t - e.delay) / (1 - 0.45))));
      e.o.position.copy(e.home).addScaledVector(e.vec, k);
    }
    // the front trolley rolls out of the way of the section
    const tf = byId['MNT.feeders_front'];
    if (tf) { if (!exploders.some(e => e.o === tf)) tf.position.copy(tf.userData.home); tf.position.z += trolleyOut; }
    applyMotion();
  }
  let trolleyOut = 0;

  function applyLook() {
    for (const m of meshes) {
      const isShell = shells.includes(m);
      m.material = S.xray && isShell ? ghostMat : (m.userData.sel ? m.userData.selMat : m.userData.mat);
      m.castShadow = !(S.xray && isShell) && !m.userData.glass;
      m.visible = !S.isolate || !S.sel || m.userData.part === S.sel;
    }
    const clip = S.cut ? [plane] : null;
    for (const m of shells) {
      const mats = [m.userData.mat, m.userData.selMat].filter(Boolean);
      for (const mt of mats) { if (mt.clippingPlanes !== clip) { mt.clippingPlanes = clip; mt.clipShadows = true; mt.needsUpdate = true; } }
    }
    for (const s of stencilMeshes) s.visible = S.cut && !S.isolate;
    cap.visible = S.cut && !S.isolate;
  }
  function setCut(on) {
    S.cut = on; if (on && S.xray) setXray(false);
    $('#cut').setAttribute('aria-pressed', String(on)); $('#cutRow').hidden = !on;
    // the front trolley is undocked and wheeled out of the picture, then hidden; it comes back when the cut closes
    const tf = byId['MNT.feeders_front'];
    if (tf && on) tweenNum('trolley', trolleyOut, 2.6, v => { trolleyOut = v; applyExplode(); if (v > 2.5) tf.visible = false; }, 0.9);
    if (tf && !on) { tf.visible = true; tweenNum('trolley', trolleyOut, 0, v => { trolleyOut = v; applyExplode(); }, 0.9); }
    if (tf && on && reduce) tf.visible = false;
    placePlane(); applyLook();
  }
  function setXray(on) {
    S.xray = on; if (on && S.cut) setCut(false);
    $('#xray').setAttribute('aria-pressed', String(on)); applyLook();
  }
  function placePlane() {
    const c = 0.95 - S.cutPos * 1.9;     // from the front face (z 0.95) to the back (z −0.95)
    plane.constant = S.cut ? c : 10;
    cap.position.set(0, 1.4, c - 0.0005); cap.lookAt(0, 1.4, c + 1);
  }

  /* ---------- an illustrative pick-and-place cycle (not a timing study) ---------- */
  // offsets from the authored pose: gantry along z (toward the front feeders is +z), head along x, nozzles down
  const CYCLE = [[0, 0, 0, 0], [0.25, 0, 0, 1], [0.45, 0, 0, 0], [1.25, 0.73, -0.32, 0], [1.45, 0.73, -0.32, 1], [1.65, 0.73, -0.32, 0], [2.15, 0.52, 0.44, 0], [2.35, 0.52, 0.44, 0], [2.95, 0, 0.06, 0], [3.15, 0, 0.06, 1], [3.35, 0, 0.06, 0], [3.9, 0, 0, 0]];
  let cyc = 0;
  function cycleAt(t) {
    t %= CYCLE[CYCLE.length - 1][0];
    for (let i = 0; i < CYCLE.length - 1; i++) {
      const a = CYCLE[i], b = CYCLE[i + 1];
      if (t <= b[0]) { const k = smooth((t - a[0]) / (b[0] - a[0])); return [a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k, a[3] + (b[3] - a[3]) * k]; }
    }
    return [0, 0, 0];
  }
  function applyMotion() {
    const g = byId['MNT.gantry'], h = byId['MNT.head'], sp = byId['MNT.head.spindles'], nz = byId['MNT.head.nozzles'];
    if (!g || !h) return;
    const [gz, hx, dip] = S.motion || cyc ? cycleAt(cyc) : [0, 0, 0];
    // the cycle rides on top of the exploded pose, so the head can work while the machine is apart
    for (const [o, ax, v] of [[g, 'z', gz], [h, 'x', hx]]) {
      const e = exploders.find(q => q.o === o);
      o.position.copy(o.userData.home);
      if (e) o.position.addScaledVector(e.vec, smooth(Math.min(1, Math.max(0, (S.explode - e.delay) / 0.55))));
      o.position[ax] += v;
    }
    for (const n of [sp, nz]) if (n) { n.position.copy(n.userData.home); n.position.y -= 0.012 * dip; }
  }

  /* ---------- names, the parts list and selection ---------- */
  const NAME = id => { const p = manifest && manifest.parts.find(q => q.id === id); return p ? (ar() ? p.name_ar || p.name_en : p.name_en || id) : id; };
  const ALT = id => { const p = manifest && manifest.parts.find(q => q.id === id); return p ? (ar() ? p.name_en : p.name_ar) : ''; };
  function ABOUT(id) {
    const p = manifest.parts.find(q => q.id === id); if (!p) return '';
    if (ar()) { if (p.about_ar) return p.about_ar; const a = manifest.parts.find(q => q.id === p.parent); return a && a.about_ar ? `${tr('Part of')} ${a.name_ar}: ${a.about_ar}` : ''; }
    return p.role || '';
  }
  function buildList() {
    const ul = $('#partList'); ul.innerHTML = '';
    for (const a of manifest.parts.filter(p => p.kind === 'assembly' && p.parent)) {
      const kids = manifest.parts.filter(p => p.kind === 'part' && p.parent === a.id && byId[p.id]);
      if (!kids.length) continue;
      const g = document.createElement('li'); g.className = 'grp'; g.textContent = NAME(a.id); ul.appendChild(g);
      for (const p of kids) {
        const li = document.createElement('li'), b = document.createElement('button');
        b.type = 'button'; b.dataset.part = p.id; b.textContent = NAME(p.id); b.setAttribute('aria-pressed', String(S.sel === p.id));
        li.appendChild(b); ul.appendChild(li);
      }
    }
    buildHot();
  }
  function select(id, frame) {
    for (const m of meshes) { m.userData.sel = false; }
    S.sel = id || null;
    if (S.sel) for (const m of meshes) if (m.userData.part === S.sel) {
      if (!m.userData.selMat) { const mt = m.userData.mat.clone(); if ('emissive' in mt) { mt.emissive = new T.Color(0x2189FF); mt.emissiveIntensity = 0.35; } m.userData.selMat = mt; }
      m.userData.sel = true;
    }
    if (!S.sel) { S.isolate = false; $('#isolate').setAttribute('aria-pressed', 'false'); }
    document.querySelectorAll('#partList [data-part]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.part === S.sel)));
    const card = $('#partCard'); card.hidden = !S.sel;
    if (S.sel) { $('#partName').textContent = NAME(S.sel); $('#partAlt').textContent = ALT(S.sel); $('#partAbout').textContent = ABOUT(S.sel); }
    applyLook(); refreshHot();
    if (S.sel && frame) frameOn(S.sel);
    if (S.sel) history.replaceState(null, '', '#part:' + S.sel); else history.replaceState(null, '', location.pathname + location.search);
  }
  function frameOn(id) {
    const o = byId[id]; if (!o) return;
    const box = new T.Box3().setFromObject(o), c = box.getCenter(new T.Vector3()), r = Math.max(0.12, box.getSize(new T.Vector3()).length() * 0.5);
    const dir = camera.position.clone().sub(controls.target).normalize();
    const d = r / Math.sin(T.MathUtils.degToRad(camera.fov / 2)) * 1.15;
    fly({ pos: c.clone().addScaledVector(dir, d).toArray(), look: c.toArray() });
  }

  /* ---------- callouts: the showroom's hairline labels, anchored to authored points ---------- */
  const hotEl = $('#hot'); let HOT = [];
  const HOT_DEFAULT = ['MNT.head.spindles', 'MNT.feeders_front.feeders', 'MNT.conveyor.rails', 'MNT.hood.tower', 'MNT.controls.vacuum', 'MNT.controls.pc', 'MNT.gantry.beam'];
  function buildHot() {
    hotEl.innerHTML = ''; HOT = [];
    for (const id of manifest.parts.filter(p => p.kind === 'part').map(p => p.id)) {
      const o = byId[id]; if (!o) continue;
      const d = document.createElement('div'); d.className = 'h off'; d.innerHTML = `<span></span>`; d.firstChild.textContent = NAME(id);
      hotEl.appendChild(d); HOT.push({ id, o, el: d, a: o.userData.anchor ? bl(o.userData.anchor) : null });
    }
  }
  function refreshHot() { for (const h of HOT) { h.el.classList.toggle('sel', h.id === S.sel); h.w = 0; } }
  const v3 = new T.Vector3(), ray = new T.Raycaster();
  function hotspots() {
    const r = wrap.getBoundingClientRect();
    for (const h of HOT) {
      // narrow frames (phones) show only the selected part's label, so the labels never pile up
      const room = r.width >= 700;
      const want = state.hot && !tour.on ? (S.sel ? h.id === S.sel : room && HOT_DEFAULT.includes(h.id) && (h.id.startsWith('MNT.controls') ? S.xray || S.cut : true)) : (tour.on && (room || tour.hot[0] === h.id) && tour.hot.includes(h.id));
      let on = want && ready && h.a && (!S.isolate || h.id === S.sel);
      if (on) { v3.copy(h.a); h.o.parent.localToWorld(v3); v3.project(camera); on = v3.z < 1 && Math.abs(v3.x) < 0.94 && Math.abs(v3.y) < 0.92; }
      h.el.classList.toggle('off', !on);
      if (on) {
        const x = (v3.x + 1) / 2 * r.width, y = (1 - v3.y) / 2 * r.height, flip = x > r.width - 240;
        if (!h.w || h.flip !== flip) { h.el.classList.toggle('l', flip); h.flip = flip; h.w = h.el.offsetWidth; }
        h.el.style.transform = `translate(${(flip ? x - h.w + 5 : x - 5).toFixed(1)}px, ${(y - 10).toFixed(1)}px)`;
      }
    }
  }
  const state = { hot: true };

  /* ---------- picking: a click (not a drag) selects the part under the pointer ---------- */
  let down = null;
  canvas.addEventListener('pointerdown', e => { down = [e.clientX, e.clientY]; });
  canvas.addEventListener('pointerup', e => {
    if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 5 || !ready) return;
    const r = canvas.getBoundingClientRect();
    ray.setFromCamera(new T.Vector2((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
    if (S.cut) ray.params.clip = plane;
    const hits = ray.intersectObjects(meshes.filter(m => m.visible), false).filter(h => !(S.cut && shells.includes(h.object) && plane.distanceToPoint(h.point) < 0) && !(S.xray && shells.includes(h.object)));
    select(hits.length ? hits[0].object.userData.part : null, false);
  });

  /* ---------- post: the showroom's quality ladder and grade ---------- */
  const LEVELS = [{ id: 'high', dpr: 2, msaa: 4, ao: true }, { id: 'high-1.5', dpr: 1.5, msaa: 4, ao: true }, { id: 'medium', dpr: 1.25, msaa: 4, ao: false }, { id: 'low', dpr: 1, msaa: 0, ao: false }];
  const phone = matchMedia('(max-width: 899px)').matches || /Mobi|Android/i.test(navigator.userAgent);
  let composer = null, grade = null, W = 1, H = 1;
  const gov = DFPerf.governor({ levels: LEVELS, start: phone ? 2 : 0, budgetMs: 16.7, apply: () => buildComposer() });
  const qp = location.search.match(/[?&]q=([0-3])/); if (qp) gov.set(+qp[1], true);   // ?q=0..3 pins a quality level (tests, slow GPUs)
  function buildComposer() {
    DFLook.disposeComposer(composer); composer = null;
    const L = gov.level;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, L.dpr)); renderer.setSize(W, H, false);
    const sz = renderer.getDrawingBufferSize(new T.Vector2());
    const rt = new T.WebGLRenderTarget(sz.x, sz.y, { type: T.HalfFloatType, samples: L.msaa, stencilBuffer: true });
    composer = new T.EffectComposer(renderer, rt);
    composer.addPass(new T.RenderPass(scene, camera));
    if (L.ao) {
      const g = new T.GTAOPass(scene, camera, sz.x, sz.y);
      g.updateGtaoMaterial({ radius: 0.18, distanceExponent: 1.2, thickness: 0.08, scale: 1.0, samples: 12 });
      g.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 4, rings: 2, samples: 12 });
      g.blendIntensity = 0.75; composer.addPass(g);
    }
    composer.addPass(new T.OutputPass());
    composer.addPass(grade = DFLook.gradePass(T)); DFLook.applyGrade(grade, DFLook.PROFILES.product);
    composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(W, H);
  }
  let camK = 1;
  const framed = c => { const k = camK = Math.pow(Math.max(1, 1.45 / Math.max(0.3, camera.aspect)), 0.9); return { look: c.look, pos: c.look.map((v, i) => v + (c.pos[i] - v) * k) }; };
  let userMoved = false; controls.addEventListener('start', () => { userMoved = true; if (tour.on) stopTour(); });
  // the vertical field of view follows the Blender photos (30° at 16:10, shown with object-fit: cover), so at rest a
  // photo and the live view line up exactly: wider frames keep the photo's horizontal angle
  const fovFor = a => (a >= 1.6 ? 2 * Math.atan(Math.tan(T.MathUtils.degToRad(15)) * 1.6 / a) * 180 / Math.PI : 30);
  function resize() { const r = wrap.getBoundingClientRect(); W = Math.max(1, r.width); H = Math.max(1, r.height); camera.aspect = W / H; camera.fov = fovFor(camera.aspect); camera.updateProjectionMatrix(); if (!userMoved && !move) setCam(S.cam, true); renderer.setSize(W, H, false); if (composer) { composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(W, H); } }
  new ResizeObserver(resize).observe(wrap);

  function applyTheme() {
    const dark = document.documentElement.dataset.theme === 'dark';
    scene.background = new T.Color(dark ? 0x101216 : 0xB7BCC1); sweepMat.color.set(dark ? 0x1B1E24 : 0xC6CACE);   // light: the grey of the Blender studio, so a photo fades in without a jump key.intensity = dark ? 1.8 : 2.3;
    ghostMat.uniforms.color.value.set(dark ? 0x4DA3FF : 0x2189FF);
  }
  new MutationObserver(applyTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  applyTheme();

  /* ---------- camera moves and number tweens (GSAP, driven by this loop) ---------- */
  let move = null;
  function fly(c, dur = 1.4, done) {
    if (move) move.kill(); controls.enabled = false;
    move = DFMotion.camera(camera, controls.target, c, { duration: reduce ? 0 : dur, onComplete: () => { controls.enabled = true; move = null; done && done(); } });
  }
  function setCam(id, cut) {
    const c0 = CAMS[id]; if (!c0) return; S.cam = id; userMoved = false;
    const c = framed(c0);
    document.querySelectorAll('[data-cam]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.cam === id)));
    if (cut || reduce) { camera.position.fromArray(c.pos); controls.target.fromArray(c.look); return; }
    fly(c);
  }
  const tweens = {};
  function tweenNum(name, from, to, set, dur = 0.9) {
    if (tweens[name]) tweens[name].kill();
    if (reduce || !window.gsap) { set(to); return; }
    const o = { v: from }; tweens[name] = gsap.to(o, { v: to, duration: dur, ease: 'power2.inOut', onUpdate: () => set(o.v) });
  }
  function setExplode(v, animate) {
    v = Math.min(1, Math.max(0, v));
    const put = x => { S.explode = x; $('#explode').value = Math.round(x * 100); $('#explode').setAttribute('aria-valuetext', `${Math.round(x * 100)} %`); applyExplode(); };
    if (animate) tweenNum('explode', S.explode, v, put, 1.8); else put(v);
  }

  /* ---------- the customer tour ---------- */
  const TOUR = [
    { t: 'The machine', s: 'An SMD placement machine: it picks tiny parts from tape reels and places them on the board, hundreds a minute.', cam: 'hero', dur: 5, hot: ['MNT.head.spindles', 'MNT.feeders_front.feeders', 'MNT.conveyor.rails'] },
    { t: 'Taken apart', s: 'Every assembly lifts out along its own path: hood, gantry, head, axes, conveyor, feeders and cabinet.', cam: 'apart', dur: 6, explode: 1, hot: ['MNT.hood.frame', 'MNT.gantry.beam', 'MNT.head.spindles', 'MNT.feeders_front.feeders'] },
    { t: 'Back together', s: 'And it returns exactly to its assembled place.', cam: 'hero', dur: 4, explode: 0, hot: [] },
    { t: 'Seen through', s: 'The covers turn to outlines: the gantry, the head and the control bay below stay solid.', cam: 'hero', dur: 5, xray: true, hot: ['MNT.controls.vacuum', 'MNT.controls.pc', 'MNT.controls.servo_rack'] },
    { t: 'Cut open', s: 'A section through the covers. The red faces are the cut; behind them the vacuum pump, the drives and the computer.', cam: 'inside', dur: 6, cut: true, sweep: true, hot: ['MNT.controls.vacuum', 'MNT.controls.pc', 'MNT.bed.casting'] },
    { t: 'The head at work', s: 'The gantry carries the head to a feeder, a nozzle picks a part, the camera checks it, and the head places it on the board.', cam: 'head', dur: 8, motion: true, hot: ['MNT.head.nozzles', 'MNT.head.camera', 'MNT.board.pcb'] },
    { t: 'Plant EG-01, line SMD-4', s: 'One of 18 placement machines in the plant. An illustrative reconstruction, built in Blender.', cam: 'hero', dur: 5, hot: [] }
  ];
  const tour = { on: false, i: 0, t0: 0, hot: [] };
  function stepTour(i) {
    const st = TOUR[i]; tour.i = i; tour.t0 = performance.now(); tour.hot = st.hot;
    $('#tourTitle').textContent = tr(st.t); $('#tourText').textContent = tr(st.s);
    if (st.xray !== undefined || i === 0 || i === TOUR.length - 1) setXray(!!st.xray);
    if (st.cut !== undefined || i === 0 || i === TOUR.length - 1) { setCut(!!st.cut); if (st.cut) { S.cutPos = 0.2; $('#cutPos').value = 20; placePlane(); if (st.sweep) tweenNum('cutpos', 0.2, 0.55, v => { S.cutPos = v; $('#cutPos').value = Math.round(v * 100); placePlane(); }, 4); } }
    if (st.explode !== undefined) setExplode(st.explode, true);
    setMotion(!!st.motion);
    if (st.xray === undefined && st.cut === undefined && i > 0 && i < TOUR.length - 1) { setXray(false); setCut(false); }
    setCam(st.cam);
  }
  function startTour() { select(null); tour.on = true; $('#tourCap').hidden = false; $('#tourBtn').setAttribute('aria-pressed', 'true'); $('#tourLbl').textContent = tr('Stop the tour'); setExplode(0); stepTour(0); }
  function stopTour() { tour.on = false; $('#tourCap').hidden = true; $('#tourBtn').setAttribute('aria-pressed', 'false'); $('#tourLbl').textContent = tr('Customer tour'); setMotion(false); }
  function tourTick(now) {
    if (!tour.on) return;
    const st = TOUR[tour.i], k = (now - tour.t0) / (st.dur * 1000);
    $('#tourFill').style.width = (Math.min(1, (tour.i + Math.min(1, k)) / TOUR.length) * 100).toFixed(1) + '%';
    if (k >= 1) { if (tour.i + 1 < TOUR.length) stepTour(tour.i + 1); else { stopTour(); setXray(false); setCut(false); setExplode(0, true); } }
  }

  function setMotion(on) { S.motion = on; $('#motion').setAttribute('aria-pressed', String(on)); if (!on) { cyc = 0; applyMotion(); } }
  function reset() { stopTour(); select(null); setXray(false); setCut(false); setMotion(false); setExplode(0, true); S.cutPos = 0.45; $('#cutPos').value = 45; setCam('hero'); }

  /* ---------- controls ---------- */
  document.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b || !b.closest('#controls')) return;
    if (b.dataset.cam) { if (tour.on) stopTour(); setCam(b.dataset.cam); }
    else if (b.dataset.part) select(b.dataset.part === S.sel ? null : b.dataset.part, true);
    else if (b.id === 'xray') setXray(!S.xray);
    else if (b.id === 'cut') setCut(!S.cut);
    else if (b.id === 'motion') setMotion(!S.motion);
    else if (b.id === 'photos') { photoOn = !photoOn; b.setAttribute('aria-pressed', String(photoOn)); }
    else if (b.id === 'tourBtn') tour.on ? stopTour() : startTour();
    else if (b.id === 'resetBtn') reset();
    else if (b.id === 'isolate') { S.isolate = !S.isolate; b.setAttribute('aria-pressed', String(S.isolate)); applyLook(); if (S.isolate) frameOn(S.sel); }
    else if (b.id === 'frameBtn') frameOn(S.sel);
    else if (b.id === 'clearSel') select(null);
  });
  $('#explode').addEventListener('input', e => { if (tour.on) stopTour(); if (tweens.explode) tweens.explode.kill(); setExplode(e.target.value / 100); });
  $('#cutPos').addEventListener('input', e => { if (tweens.cutpos) tweens.cutpos.kill(); S.cutPos = e.target.value / 100; placePlane(); });
  const sph = new T.Spherical();
  document.addEventListener('keydown', e => {
    if (e.target.closest('input, textarea, select') || e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key;
    if (k === 'e' || k === 'E') { setExplode(S.explode > 0.5 ? 0 : 1, true); return; }
    if (k === 'x' || k === 'X') { setXray(!S.xray); return; }
    if (k === 'c' || k === 'C') { setCut(!S.cut); return; }
    if (k === 't' || k === 'T') { tour.on ? stopTour() : startTour(); return; }
    if (k === ' ' && document.activeElement && document.activeElement.tagName !== 'BUTTON') { e.preventDefault(); setMotion(!S.motion); return; }
    if (k === 'Escape') { if (tour.on) stopTour(); else select(null); return; }
    if (document.activeElement !== canvas) return;
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '=', '-', '_', '0'].includes(k)) return;
    e.preventDefault();
    if (k === '0') return reset();
    const off = camera.position.clone().sub(controls.target); sph.setFromVector3(off);
    if (k === 'ArrowLeft') sph.theta -= 0.12; if (k === 'ArrowRight') sph.theta += 0.12;
    if (k === 'ArrowUp') sph.phi = Math.max(0.2, sph.phi - 0.08); if (k === 'ArrowDown') sph.phi = Math.min(controls.maxPolarAngle, sph.phi + 0.08);
    if (k === '+' || k === '=') sph.radius = Math.max(controls.minDistance, sph.radius * 0.88); if (k === '-' || k === '_') sph.radius = Math.min(controls.maxDistance, sph.radius * 1.12);
    camera.position.copy(controls.target).add(off.setFromSpherical(sph));
  });
  window.addEventListener('langchange', () => setTimeout(() => {
    station(); if (!manifest) return; buildList(); select(S.sel, false);
    if (tour.on) { $('#tourTitle').textContent = tr(TOUR[tour.i].t); $('#tourText').textContent = tr(TOUR[tour.i].s); $('#tourLbl').textContent = tr('Stop the tour'); }
  }, 0));

  /* ---------- Blender photos at rest: at a preset pose and a settled state, the Cycles render of that exact view
     fades in over the live view (same camera, from shots.json); any interaction returns to live 3D ---------- */
  let PHOTOS = [], photoOn = true, shown = null;
  const URL_SHOTS = `${DFLook.base}assets/models/machines/${KIND}/shots.json`;
  const photoEl = document.createElement('img'); photoEl.className = 'photo'; photoEl.alt = ''; photoEl.setAttribute('aria-hidden', 'true');
  const photoTag = document.createElement('span'); photoTag.className = 'photo-tag'; photoTag.textContent = 'Photo rendered in Blender';
  wrap.insertBefore(photoEl, hotEl); wrap.insertBefore(photoTag, hotEl);
  const imgs = {};
  const busy = () => Object.values(tweens).some(t => t && t.isActive && t.isActive());
  function photoWanted() {
    if (!ready || !photoOn || !PHOTOS.length || document.documentElement.dataset.theme === 'dark' || camera.aspect < 1.45) return null;
    if (userMoved || move || busy() || S.sel || S.isolate || S.motion) return null;
    const st = S.cut ? 'cut' : S.xray ? 'ghost' : S.explode >= 0.999 ? 'exploded' : S.explode <= 0.001 ? 'assembled' : null;
    return st && PHOTOS.find(p => p.shot === S.cam && p.state === st && (st !== 'cut' || Math.abs(S.cutPos - p.cutPos) < 0.006)) || null;
  }
  function photos() {
    const p = photoWanted();
    if (p && !imgs[p.id]) { const im = new Image(); im.decoding = 'async'; im.src = `${DFLook.base}assets/models/machines/${KIND}/photos/${p.id}.webp`; imgs[p.id] = im; im.onload = () => { im.ok = true; }; }
    const want = p && imgs[p.id].ok ? p.id : null;
    if (want !== shown) {
      if (want) photoEl.src = imgs[want].src;
      photoEl.classList.toggle('on', !!want); photoTag.classList.toggle('on', !!want); shown = want;
    }
  }
  const resting = () => shown && photoEl.classList.contains('on') && !reduce ? performance.now() - shownAt > 600 : !!shown;
  let shownAt = 0; new MutationObserver(() => { shownAt = performance.now(); }).observe(photoEl, { attributes: true, attributeFilter: ['class'] });

  /* ---------- the station this studio was opened from (plant.html passes a snapshot in the address) ---------- */
  const Q = new URLSearchParams(location.search), ST = Q.get('st');
  const STATE = { run: 'Running', warn: 'Running slow', idle: 'Idle', starved: 'Starved', blocked: 'Blocked', down: 'Stopped', maint: 'Planned maintenance', micro: 'Short stop', changeover: 'Changeover', tripped: 'Tripped' };
  const clock = t => { t = Math.max(0, +t || 0); const h = Math.floor(t / 3600) % 24, m = Math.floor(t / 60) % 60; return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`; };
  function station() {
    if (!ST) return;
    const name = Q.get('name') || ST, line = Q.get('line') || '', st = Q.get('state') || '';
    const cls = st === 'down' || st === 'tripped' ? 'bad' : ['warn', 'starved', 'micro', 'changeover', 'blocked'].includes(st) ? 'warn' : '';
    const row = (k, v) => `<div><dt>${tr(k)}</dt><dd>${v}</dd></div>`;
    const esc = x => String(x).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    $('#plantInfo').innerHTML = row('Machine', esc(name)) + row('Line', esc(line)) + (st ? row('State', `<span class="st ${cls}"><i></i>${esc(tr(STATE[st] || st))}</span>`) : '')
      + (Q.get('health') ? row('Health', esc(Q.get('health')) + ' %') : '') + (Q.get('made') ? row('Units done', esc(Q.get('made'))) : '') + (Q.get('t') ? row('Plant time', clock(Q.get('t'))) : '');
    $('#backPlant').href = 'plant.html#st:' + encodeURIComponent(ST);
    document.querySelectorAll('a[href^="plant.html#line"]').forEach(a => { a.href = 'plant.html#st:' + encodeURIComponent(ST); });
    $('#plantSec').hidden = false;
    $('.sr-sub').textContent = `${name} · ${line} · ${tr('illustrative reconstruction')}`;
  }
  // the nameplate text is modelled for Mounter B of line SMD-4; on any other mounter it is left off rather than wrong
  function nameplate() { if (ST && ST !== 'SMD4-MounterB') machine.traverse(o => { if (/^MNT\.text\./.test(o.name)) o.visible = false; }); }

  /* ---------- load ---------- */
  async function load() {
    note('Loading the machine…');
    try { await DFLook.extras(); } catch (e) { note('The model loader could not be fetched. Check the connection and reload.'); return; }
    try {
      const [gl, mf] = await Promise.all([
        new Promise((res, rej) => { const l = new T.X.GLTFLoader(); l.setMeshoptDecoder(T.X.MeshoptDecoder); l.load(URL_GLB, g => res(g.scene), undefined, rej); }),
        fetch(URL_PARTS).then(r => { if (!r.ok) throw new Error('parts ' + r.status); return r.json(); })
      ]);
      fetch(URL_SHOTS).then(r => r.ok ? r.json() : null).then(j => { if (!j) return; for (const [k, v] of Object.entries(j.shots)) CAMS[k] = { pos: v.pos, look: v.look }; PHOTOS = j.photos || []; }).catch(() => {});
      manifest = mf; prep(gl); machine.add(gl);
      buildList(); applyLook(); placePlane(); nameplate(); ready = true; note('');
      const m = location.hash.match(/^#part:([\w.]+)/); if (m && byId[m[1]]) select(m[1], true);
      if (/^#tour/.test(location.hash)) startTour();
    } catch (err) { console.error(err); note('The machine could not be loaded. Reload to try again.'); }
  }

  /* ---------- the loop ---------- */
  let last = 0, frames = 0;
  const hud = DFPerf.hud(() => ({ renderer, level: gov.level.id + (gov.manual ? ' (manual)' : ''), backend: 'webgl2' }));
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = last ? now - last : 16.7; last = now; frames++;
    DFPerf.frame(now); DFMotion.tick(now); gov.tick(dt);
    if (S.motion) { cyc += dt / 1000; applyMotion(); }
    tourTick(now);
    controls.update();
    if (!composer) return;
    if (grade && grade.isGrade) DFLook.frameGrade(grade, camera, frames);
    photos();
    if (!resting()) composer.render(dt / 1000);   // a photo at rest covers the frame: the GPU can idle
    hotspots();
    if (hud) hud(now);
  }
  resize(); buildComposer(); requestAnimationFrame(frame); station(); load();

  window.Inspect = { get ready() { return ready; }, get frames() { return frames; }, S, byId, setExplode, setXray, setCut, setMotion, select, setCam, startTour, stopTour, reset, renderer, scene, camera, controls,
    setCutPos(v) { S.cutPos = v; $('#cutPos').value = Math.round(v * 100); placePlane(); } };
})();
