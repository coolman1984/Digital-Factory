/* Line ML-3 slice (line.html): one stretch of a TV assembly line, from its Blender asset (assets/models/areas/ml3).
   The static scene (cells, conveyors, stations, robot, test, packing, QA room, building) comes from the GLB as it is; the
   moving pieces are cloned from the templates the asset carries (AREA.tpl.*) and driven by one deterministic clock:
     · the main line indexes every T seconds: each set and its pallet move one station on in M seconds, and the work of a
       station is added half-way through the dwell (the next assembly state of the set);
     · after the last station the set is lifted and turned upright onto the test conveyor; empty pallets drop to the return
       run and come back under the line to the start;
     · after two test positions the set is laid down and bagged, travels down the transfer, is lowered into its carton under
       the lift assist; the carton is taped at the taping machine, strapped, and leaves through the wall.
   Every position is a function of time, so a frame at time t is always the same (the walkthrough video is rendered
   frame by frame). Nothing teleports: a piece changes its mesh only while it stands still at a station.
   The motion is illustrative, not a timing study. The page reads no plant state and writes none.
   Blender is Z up: an authored point (x, y, z) is (x, z, −y) here. */
(function () {
  const T = window.THREE, $ = s => document.querySelector(s);
  const canvas = $('#gl'); if (!T || !canvas) return;
  const wrap = canvas.parentElement;
  const ar = () => !!(window.DFI18N && DFI18N.ar && DFI18N.ar());
  const tr = t => (ar() && window.DFI18N && DFI18N.t(t)) || t;
  const note = t => { $('#note').textContent = tr(t); };
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const B = (x, y, z) => new T.Vector3(x, z, -y);              // Blender point → three
  const URL_GLB = `${DFLook.base}assets/models/areas/ml3/slice.glb`;

  let renderer;
  try { renderer = new T.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' }); }
  catch (e) { note('This browser cannot start WebGL 2, so the line is described beside it only.'); return; }
  canvas.tabIndex = 0;
  renderer.outputColorSpace = T.SRGBColorSpace; renderer.toneMapping = T.NeutralToneMapping; renderer.toneMappingExposure = 1.2;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
  window.__dfRenderer = () => renderer;
  DFMotion.drive();

  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(36, 1, 0.1, 200);
  const controls = new T.OrbitControls(camera, canvas);
  Object.assign(controls, { enableDamping: true, dampingFactor: 0.08, minDistance: 1.0, maxDistance: 40, maxPolarAngle: 1.5, rotateSpeed: 0.6, zoomSpeed: 0.9, screenSpacePanning: true });
  // views in three axes (x along the line, y up, z toward the visitor's side)
  const CAMS = {
    overview: { pos: [12.5, 5.0, 10.5], look: [1.0, 0.8, 0.5] },
    eye: { pos: [-4.1, 1.62, 1.85], look: [-2.9, 1.0, -0.2] },          // standing between the operators of stations 1 and 2
    cell: { pos: [-1.4, 3.4, 8.2], look: [-1.8, 0.8, 3.9] },
    robot: { pos: [0.1, 2.15, 2.35], look: [-1.0, 1.05, -0.5] },
    test: { pos: [8.4, 1.75, 3.4], look: [5.8, 1.1, 0.0] },
    pack: { pos: [12.3, 3.0, 6.9], look: [9.8, 0.9, 3.0] }
  };

  /* ---------- light: a bright hall: soft-box environment, a shadowed key from the roof, a pale sky fill ---------- */
  function studio() {
    const s = new T.Scene(), PI = Math.PI;
    s.add(new T.Mesh(new T.BoxGeometry(30, 14, 30), new T.MeshBasicMaterial({ color: 0x4A4F57, side: T.BackSide })));
    const box = (w, h, x, y, z, rx, ry, k) => { const m = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ color: new T.Color(0xffffff).multiplyScalar(k), side: T.DoubleSide })); m.position.set(x, y, z); m.rotation.set(rx, ry, 0); s.add(m); };
    for (let i = -2; i <= 2; i++) box(3, 1.2, i * 5, 6.8, 0, PI / 2, 0, 3.2);
    box(1.2, 9, -7, 3.5, 2, 0, PI / 2, 3.0); box(1.2, 9, 7, 3.5, -1.5, 0, -PI / 2, 2.5); box(30, 30, 0, -6.9, 0, -PI / 2, 0, 0.35);
    return s;
  }
  const pmrem = new T.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(studio(), 0.02).texture; scene.environmentIntensity = 1.35;
  const sun = new T.DirectionalLight(0xFFF7EE, 1.6); sun.position.set(-6, 14, 9); sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096); Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 12, bottom: -12, near: 1, far: 40 });
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03; sun.shadow.radius = 4;
  sun.target.position.set(1, 0, 0); scene.add(sun, sun.target, new T.HemisphereLight(0xffffff, 0xA9B0B8, 1.1));

  /* ---------- the asset ---------- */
  const world = new T.Group(); scene.add(world);
  const byId = {}, TPL = {};
  let ready = false;
  function prep(root) {
    root.traverse(o => {
      const x = o.userData || {};
      if (x.part_id) byId[x.part_id] = o;
      if (!o.isMesh) return;
      o.castShadow = o.receiveShadow = true;
      const m = o.material;
      if (m.anisotropy) m.anisotropy = 0;                       // no tangents in the asset: anisotropy would shade NaN
      if (m.map && !o.geometry.attributes.uv) m.map = null;
      if (m.transmission > 0) { const glass = m.name === 'glass'; m.transmission = 0; m.transparent = true; m.opacity = glass ? 0.14 : 0.6; m.depthWrite = !glass; if (glass) { m.color.set(0xEAF2F8); o.castShadow = false; } }
    });
    // the moving pieces leave the static scene: templates are cloned, the authored stills are hidden
    for (const id of ['AREA.units.pallets', 'AREA.units.tvs', 'AREA.test.sets', 'AREA.test.screen_52', 'AREA.test.screen_67', 'AREA.pack.cartons', 'AREA.pack.set']) if (byId[id]) byId[id].visible = false;
    for (const id of Object.keys(byId)) if (id.startsWith('AREA.tpl.')) { TPL[id.slice(9)] = byId[id]; byId[id].visible = false; }
    // the test picture: the material of an authored test screen, on a plane each upright set carries
    const scr = byId['AREA.test.screen_52']; let scrMat = null; if (scr) scr.traverse(o => { if (o.isMesh && !scrMat) scrMat = o.material; });
    TPL._screen = scrMat;
  }
  // a clone of a template, recentred: templates stand at Blender y = −14 (three z = +14), x = 0
  function clone(name) {
    const g = new T.Group(), src = TPL[name]; if (!src) return g;
    const c = src.clone(true); c.visible = true; c.position.z -= 14; c.traverse(o => { if (o.isMesh) { o.castShadow = o.receiveShadow = true; } });
    // the upright set pivots about its centre, like the flat set it turns from (flat at rx is upright at rx + 90°)
    if (name === 'tv_up') c.position.y -= 0.42;
    g.add(c); g.userData.kind = name;
    if (name === 'tv_up' && TPL._screen) {        // a lit test picture on the screen side (three +z is the visitor's side)
      const p = new T.Mesh(new T.PlaneGeometry(1.42, 0.81), TPL._screen); p.position.set(0, 0, 0.033); g.add(p);
    }
    world.add(g); return g;
  }

  /* ---------- the clock and the choreography (all times in seconds) ---------- */
  const TC = 8, MV = 2;                                         // cycle time, index move time
  const SX = [-5, -3, -1, 1, 3], ZT = 0.82;                    // stations (Blender x) and conveyor top
  const STATE_IN = [0, 1, 1, 1, 2], STATE_OUT = [1, 1, 1, 2, 3];
  const TEST = [5.2, 6.7], ZTEST = 1.14;                    // fixture top 0.72 + half the set's height
  const PK_Y = -3.0, ZPK = 0.77, JX = 9.0, TAPE = 10.7, STRAP = 11.9;
  // keyframes: [t, x, y, z, rx(deg), mesh]; a piece shows from its first key to its last
  function unitKeys(b) {
    const tv = [], pal = [], ctn = [];
    // the set arrives on station 1: lowered onto its pallet from the incoming conveyor
    tv.push([b - 1.0, SX[0], 0, ZT + 0.35, 0, 'tv0']); tv.push([b, SX[0], 0, ZT, 0, 'tv0']);
    for (let i = 0; i < 5; i++) {
      const a = b + i * TC;
      tv.push([a + (TC - MV) / 2, SX[i], 0, ZT, 0, 'tv' + STATE_IN[i]]); tv.push([a + (TC - MV) / 2 + 0.01, SX[i], 0, ZT, 0, 'tv' + STATE_OUT[i]]);
      tv.push([a + TC - MV, SX[i], 0, ZT, 0, 'tv' + STATE_OUT[i]]);
      if (i < 4) tv.push([a + TC, SX[i + 1], 0, ZT, 0, 'tv' + STATE_OUT[i]]);
    }
    // up-ender: lift, turn upright and set onto the first test fixture
    const u0 = b + 5 * TC - MV;
    tv.push([u0 + 0.5, SX[4] + 0.3, 0, ZT + 0.5, -30, 'tv3']); tv.push([u0 + 1.2, SX[4] + 1.2, 0, ZT + 0.45, -75, 'tv3']);
    tv.push([u0 + 1.21, SX[4] + 1.2, 0, ZT + 0.45, -75, 'tv_up_flat']);
    tv.push([b + 5 * TC, TEST[0], 0, ZTEST, -90, 'tv_up']);
    tv.push([b + 6 * TC - MV, TEST[0], 0, ZTEST, -90, 'tv_up']); tv.push([b + 6 * TC, TEST[1], 0, ZTEST, -90, 'tv_up']);
    // laid down and bagged at the transfer, down the transfer, along the packing line to the lift
    const d0 = b + 7 * TC - MV;
    tv.push([d0, TEST[1], 0, ZTEST, -90, 'tv_up']); tv.push([d0 + 1.2, 7.5, -0.3, ZPK + 0.3, -20, 'tv3']);
    tv.push([b + 7 * TC, 7.7, -0.35, ZPK, 0, 'tv3']); tv.push([b + 7 * TC + 0.01, 7.7, -0.35, ZPK, 0, 'bagged']);
    tv.push([b + 7 * TC + MV, 7.7, PK_Y, ZPK, 0, 'bagged']);
    tv.push([b + 7 * TC + 2 * MV, JX, PK_Y, ZPK + 0.25, 0, 'bagged']);                        // raised by the lift over the carton
    tv.push([b + 7 * TC + 2 * MV + 1.2, JX, PK_Y, ZPK + 0.06, 0, 'bagged']);                  // lowered in; hidden by the carton walls
    // the pallet: rises from the return run at the start, rides the line, drops at the end, returns underneath
    const RET = 0.36;
    pal.push([b - 1.5, SX[0], 0, RET, 0, 'pallet']); pal.push([b - 0.5, SX[0], 0, ZT, 0, 'pallet']);
    for (let i = 0; i < 5; i++) { const a = b + i * TC; pal.push([a + TC - MV, SX[i], 0, ZT, 0, 'pallet']); if (i < 4) pal.push([a + TC, SX[i + 1], 0, ZT, 0, 'pallet']); }
    pal.push([u0 + 1.5, SX[4], 0, ZT, 0, 'pallet']); pal.push([u0 + 2.5, SX[4], 0, RET, 0, 'pallet']);
    pal.push([b + 6 * TC - 1.5, SX[0], 0, RET, 0, 'pallet']);                                 // becomes the pallet of the set six cycles on
    // the carton: in from the flat-carton stack, waits open under the lift, taped, strapped, out through the wall
    const c0 = b + 7 * TC + 2 * MV - 5;
    ctn.push([c0, 7.7, PK_Y, ZPK, 0, 'carton_open']); ctn.push([c0 + 2, JX, PK_Y, ZPK, 0, 'carton_open']);
    const cl = b + 7 * TC + 2 * MV + 1.4;
    ctn.push([cl, JX, PK_Y, ZPK, 0, 'carton_open']); ctn.push([cl + MV, TAPE, PK_Y, ZPK, 0, 'carton_open']);
    ctn.push([cl + MV + 1.0, TAPE, PK_Y, ZPK, 0, 'carton_open']); ctn.push([cl + MV + 1.01, TAPE, PK_Y, ZPK, 0, 'carton_closed']);
    ctn.push([cl + MV + 2.0, TAPE, PK_Y, ZPK, 0, 'carton_closed']); ctn.push([cl + 2 * MV + 2.0, STRAP, PK_Y, ZPK, 0, 'carton_closed']);
    ctn.push([cl + 2 * MV + 3.0, STRAP, PK_Y, ZPK, 0, 'carton_closed']); ctn.push([cl + 3 * MV + 4.0, 13.4, PK_Y, ZPK, 0, 'carton_closed']);
    return { tv, pal, ctn };
  }
  const ease = t => t * t * (3 - 2 * t);
  function sample(keys, t) {
    if (t < keys[0][0] || t > keys[keys.length - 1][0]) return null;
    for (let i = 0; i < keys.length - 1; i++) {
      const a = keys[i], b = keys[i + 1];
      if (t <= b[0]) { const k = b[0] > a[0] ? ease((t - a[0]) / (b[0] - a[0])) : 1; return { x: a[1] + (b[1] - a[1]) * k, y: a[2] + (b[2] - a[2]) * k, z: a[3] + (b[3] - a[3]) * k, rx: a[4] + (b[4] - a[4]) * k, mesh: a[5] }; }
    }
    const l = keys[keys.length - 1]; return { x: l[1], y: l[2], z: l[3], rx: l[4], mesh: l[5] };
  }
  // pools of clones by mesh name, reused frame to frame
  const pool = {}; let used = {};
  function take(mesh) {
    const key = mesh === 'tv_up_flat' ? 'tv_up' : mesh;
    const list = pool[key] = pool[key] || []; used[key] = (used[key] || 0) + 1;
    if (list.length < used[key]) list.push(clone(key));
    const g = list[used[key] - 1]; g.visible = true; return g;
  }
  let simT = 120;                                              // the line starts full: two minutes in
  function place(s) {
    if (!s) return;
    const g = take(s.mesh), p = B(s.x, s.y, s.z);
    g.position.copy(p); g.rotation.set(s.mesh === 'tv_up' || s.mesh === 'tv_up_flat' ? T.MathUtils.degToRad(s.rx + 90) : T.MathUtils.degToRad(s.rx), 0, 0);
  }
  function animate(t) {
    used = {};
    for (const k in pool) for (const g of pool[k]) g.visible = false;
    const k0 = Math.floor((t - 9 * TC) / TC), k1 = Math.ceil((t + 2) / TC);
    for (let k = k0; k <= k1; k++) {
      const U = unitKeys(k * TC);
      place(sample(U.tv, t)); place(sample(U.pal, t)); place(sample(U.ctn, t));
    }
    // the robot drives screws while a set stands at station 3
    const arm = byId['AREA.robot.arm'];
    if (arm) { const ph = ((t % TC) + TC) % TC, on = ph > 0.8 && ph < TC - MV - 0.6; arm.position.y = on ? -0.03 * (0.5 + 0.5 * Math.sin(ph * 5.5)) : 0; }
  }

  /* ---------- labels anchored to the stations ---------- */
  const LABELS = [
    { id: 'cell', t: 'Sub-assembly cell', p: B(-4.2, -4.15, 2.2) },
    { id: 's1', t: 'Boards fitted', p: B(-5, -0.6, 2.35) },
    { id: 's3', t: 'Robot fastens the screws', p: B(-1, 0.9, 1.75) },
    { id: 's4', t: 'Speakers and cables', p: B(1, -0.6, 2.35) },
    { id: 's5', t: 'Back cover', p: B(3, -0.6, 2.35) },
    { id: 'test', t: 'Functional test', p: B(5.9, 0, 1.75) },
    { id: 'pack', t: 'Bag and carton', p: B(9.0, -3.0, 2.2) },
    { id: 'tape', t: 'Taping and strapping', p: B(11.3, -3.0, 1.9) },
    { id: 'qa', t: 'QA aging room', p: B(10.5, 3.0, 1.6) }
  ];
  const hotEl = $('#hot'); let showLabels = true;
  for (const l of LABELS) { const d = document.createElement('div'); d.className = 'h off'; d.innerHTML = '<span></span>'; d.firstChild.textContent = tr(l.t); hotEl.appendChild(d); l.el = d; }
  const v3 = new T.Vector3();
  function hotspots() {
    const r = wrap.getBoundingClientRect(), room = r.width >= 700;
    for (const l of LABELS) {
      v3.copy(l.p).project(camera);
      const on = showLabels && ready && !tour.on && room && v3.z < 1 && Math.abs(v3.x) < 0.95 && Math.abs(v3.y) < 0.92 && camera.position.distanceTo(l.p) < 24;
      l.el.classList.toggle('off', !on);
      if (on) {
        const x = (v3.x + 1) / 2 * r.width, y = (1 - v3.y) / 2 * r.height, flip = x > r.width - 220;
        if (!l.w || l.flip !== flip) { l.el.classList.toggle('l', flip); l.flip = flip; l.w = l.el.offsetWidth; }
        l.el.style.transform = `translate(${(flip ? x - l.w + 5 : x - 5).toFixed(1)}px, ${(y - 10).toFixed(1)}px)`;
      }
    }
  }
  function buildStations() {
    const ul = $('#stations'); ul.innerHTML = '';
    for (const l of LABELS) {
      const li = document.createElement('li'), b = document.createElement('button'); b.type = 'button'; b.dataset.goto = l.id; b.textContent = tr(l.t);
      li.appendChild(b); ul.appendChild(li);
    }
  }

  /* ---------- cameras, the walkthrough ---------- */
  let move = null, userMoved = false, camK = 1;
  const framed = c => { const k = camK = Math.pow(Math.max(1, 1.45 / Math.max(0.3, camera.aspect)), 0.9); return { look: c.look, pos: c.look.map((v, i) => v + (c.pos[i] - v) * k) }; };
  controls.addEventListener('start', () => { userMoved = true; if (tour.on) stopTour(); });
  function setCam(id, cut) {
    const c0 = CAMS[id]; if (!c0) return; const c = framed(c0);
    document.querySelectorAll('[data-cam]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.cam === id)));
    if (cut || reduce) { camera.position.fromArray(c.pos); controls.target.fromArray(c.look); return; }
    if (move) move.kill(); controls.enabled = false;
    move = DFMotion.camera(camera, controls.target, c, { duration: 1.5, onComplete: () => { controls.enabled = true; move = null; } });
  }
  function flyTo(p) {
    const dir = camera.position.clone().sub(controls.target).normalize(), to = p.clone().setY(Math.max(0.9, p.y - 0.9));
    if (move) move.kill(); controls.enabled = false;
    move = DFMotion.camera(camera, controls.target, { pos: to.clone().addScaledVector(dir, 6).toArray(), look: to.toArray() }, { duration: reduce ? 0 : 1.4, onComplete: () => { controls.enabled = true; move = null; } });
  }
  // the walkthrough: a camera path through the slice in 30 s, with a caption per stretch
  const PATH = [
    [0, [-9.5, 4.2, 9.5], [-3.0, 0.8, 2.5], 'The cell', 'Operators stand one behind another in a U-shaped cell and build sub-assemblies; parts come in from flow racks fed from the aisle.'],
    [5, [-6.2, 1.8, 3.4], [-4.2, 1.0, 0.0], 'The line', 'Sets lie face down on padded pallets. Every 8 seconds the line moves one station on.'],
    [10, [0.6, 1.9, 2.0], [-1.0, 1.05, -0.4], 'People place, the robot fastens', 'Operators fit boards, speakers and cables; a robot drives the screws.'],
    [15, [2.6, 1.8, 2.6], [3.4, 1.0, 0.0], 'Back cover, then upright', 'The back cover goes on, and the set is turned upright for test.'],
    [20, [8.4, 1.75, 3.4], [5.8, 1.1, 0.0], 'Functional test', 'Each set shows test patterns while it is checked.'],
    [25, [12.3, 3.0, 6.9], [9.8, 0.9, 3.0], 'Packing', 'The set is bagged, lowered into its carton with cushions, taped and strapped.'],
    [30, [12.4, 5.4, 11.5], [2.0, 0.8, 0.0], 'Line ML-3, Plant EG-01', 'An illustrative reconstruction, built in Blender from photos of real TV lines.']
  ];
  const tour = { on: false, t0: 0, step: -1 };
  function camAt(t) {
    t = Math.max(0, Math.min(30, t));
    let i = 0; while (i < PATH.length - 2 && t > PATH[i + 1][0]) i++;
    const a = PATH[i], b = PATH[i + 1], k = ease((t - a[0]) / (b[0] - a[0]));
    const lerp = (p, q) => p.map((v, j) => v + (q[j] - v) * k);
    return { pos: lerp(a[1], b[1]), look: lerp(a[2], b[2]), step: k > 0.5 && i + 1 === PATH.length - 1 ? i + 1 : i };
  }
  function tourFrame(t) {
    const c = camAt(t); camera.position.fromArray(c.pos); controls.target.fromArray(c.look); camera.lookAt(controls.target);
    if (c.step !== tour.step) { tour.step = c.step; $('#tourTitle').textContent = tr(PATH[c.step][3]); $('#tourText').textContent = tr(PATH[c.step][4]); }
    $('#tourFill').style.width = (t / 30 * 100).toFixed(1) + '%';
  }
  function startTour() { tour.on = true; tour.t0 = performance.now(); tour.step = -1; controls.enabled = false; $('#tourCap').hidden = false; $('#tourBtn').setAttribute('aria-pressed', 'true'); $('#tourLbl').textContent = tr('Stop the walk'); }
  function stopTour() { tour.on = false; controls.enabled = true; $('#tourCap').hidden = true; $('#tourBtn').setAttribute('aria-pressed', 'false'); $('#tourLbl').textContent = tr('Walk the line'); }

  /* ---------- post: the shared quality ladder and grade ---------- */
  const LEVELS = [{ id: 'high', dpr: 1.5, msaa: 4, ao: true }, { id: 'medium', dpr: 1.25, msaa: 4, ao: false }, { id: 'medium-1', dpr: 1, msaa: 4, ao: false }, { id: 'low', dpr: 1, msaa: 0, ao: false }];
  const phone = matchMedia('(max-width: 899px)').matches || /Mobi|Android/i.test(navigator.userAgent);
  let composer = null, grade = null, W = 1, H = 1;
  const gov = DFPerf.governor({ levels: LEVELS, start: phone ? 2 : 0, budgetMs: 16.7, apply: () => buildComposer() });
  const qp = location.search.match(/[?&]q=([0-3])/); if (qp) gov.set(+qp[1], true);
  function buildComposer() {
    DFLook.disposeComposer(composer); composer = null;
    const L = gov.level;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, L.dpr)); renderer.setSize(W, H, false);
    const sz = renderer.getDrawingBufferSize(new T.Vector2());
    composer = new T.EffectComposer(renderer, new T.WebGLRenderTarget(sz.x, sz.y, { type: T.HalfFloatType, samples: L.msaa }));
    composer.addPass(new T.RenderPass(scene, camera));
    if (L.ao) { const g = new T.GTAOPass(scene, camera, sz.x, sz.y); g.updateGtaoMaterial({ radius: 0.25, distanceExponent: 1.2, thickness: 0.1, scale: 1.0, samples: 12 }); g.blendIntensity = 0.7; composer.addPass(g); }
    composer.addPass(new T.OutputPass());
    composer.addPass(grade = DFLook.gradePass(T)); DFLook.applyGrade(grade, DFLook.PROFILES.realistic);
    composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(W, H);
  }
  function resize() { const r = wrap.getBoundingClientRect(); W = Math.max(1, r.width); H = Math.max(1, r.height); camera.aspect = W / H; camera.updateProjectionMatrix(); if (!userMoved && !move && !tour.on) setCam('overview', true); renderer.setSize(W, H, false); if (composer) { composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(W, H); } }
  new ResizeObserver(resize).observe(wrap);
  function applyTheme() { const dark = document.documentElement.dataset.theme === 'dark'; scene.background = new T.Color(dark ? 0x15181D : 0xCDD2D8); scene.environmentIntensity = dark ? 0.8 : 1.35; }
  new MutationObserver(applyTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] }); applyTheme();

  /* ---------- controls ---------- */
  let playing = !reduce, speed = 1;
  if (reduce) { $('#playBtn').setAttribute('aria-pressed', 'false'); $('#playBtn').textContent = tr('Play'); }
  document.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b || !b.closest('#controls')) return;
    if (b.dataset.cam) { if (tour.on) stopTour(); userMoved = false; setCam(b.dataset.cam); }
    else if (b.dataset.speed) { speed = +b.dataset.speed; document.querySelectorAll('[data-speed]').forEach(x => x.setAttribute('aria-pressed', String(x === b))); }
    else if (b.dataset.goto) { const l = LABELS.find(q => q.id === b.dataset.goto); if (l) { if (tour.on) stopTour(); flyTo(l.p); } }
    else if (b.id === 'playBtn') { playing = !playing; b.setAttribute('aria-pressed', String(playing)); b.textContent = tr(playing ? 'Pause' : 'Play'); }
    else if (b.id === 'tourBtn') tour.on ? stopTour() : startTour();
    else if (b.id === 'labels') { showLabels = !showLabels; b.setAttribute('aria-pressed', String(showLabels)); }
  });
  const sph = new T.Spherical();
  document.addEventListener('keydown', e => {
    if (e.target.closest('input, textarea, select') || e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key;
    if (k === ' ' && (!document.activeElement || document.activeElement.tagName !== 'BUTTON')) { e.preventDefault(); $('#playBtn').click(); return; }
    if (k === 't' || k === 'T') { tour.on ? stopTour() : startTour(); return; }
    if (k === 'Escape' && tour.on) { stopTour(); return; }
    if (document.activeElement !== canvas) return;
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '=', '-', '_', '0'].includes(k)) return;
    e.preventDefault(); if (k === '0') return setCam('overview');
    const off = camera.position.clone().sub(controls.target); sph.setFromVector3(off);
    if (k === 'ArrowLeft') sph.theta -= 0.1; if (k === 'ArrowRight') sph.theta += 0.1;
    if (k === 'ArrowUp') sph.phi = Math.max(0.2, sph.phi - 0.07); if (k === 'ArrowDown') sph.phi = Math.min(controls.maxPolarAngle, sph.phi + 0.07);
    if (k === '+' || k === '=') sph.radius = Math.max(controls.minDistance, sph.radius * 0.88); if (k === '-' || k === '_') sph.radius = Math.min(controls.maxDistance, sph.radius * 1.12);
    camera.position.copy(controls.target).add(off.setFromSpherical(sph));
  });
  window.addEventListener('langchange', () => setTimeout(() => { for (const l of LABELS) { l.el.firstChild.textContent = tr(l.t); l.w = 0; } buildStations(); }, 0));

  /* ---------- load ---------- */
  async function load() {
    note('Loading the line…');
    try { await DFLook.extras(); } catch (e) { note('The model loader could not be fetched. Check the connection and reload.'); return; }
    try {
      const g = await new Promise((res, rej) => { const l = new T.X.GLTFLoader(); l.setMeshoptDecoder(T.X.MeshoptDecoder); l.load(URL_GLB, x => res(x.scene), undefined, rej); });
      prep(g); world.add(g); buildStations(); animate(simT); ready = true; note('');
      if (/^#walk/.test(location.hash)) startTour();
    } catch (err) { console.error(err); note('The line could not be loaded. Reload to try again.'); }
  }

  /* ---------- the loop ---------- */
  let last = 0, frames = 0, manual = false;
  const hud = DFPerf.hud(() => ({ renderer, level: gov.level.id + (gov.manual ? ' (manual)' : ''), backend: 'webgl2' }));
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = last ? Math.min(100, now - last) : 16.7; last = now; frames++;
    DFPerf.frame(now); DFMotion.tick(now); if (!manual) gov.tick(dt);
    if (ready && !manual) {
      if (playing) { simT += dt / 1000 * speed; animate(simT); }
      if (tour.on) { const t = (now - tour.t0) / 1000; if (t > 30) stopTour(); else tourFrame(t); }
    }
    if (!tour.on) controls.update();
    if (!composer) return;
    if (grade && grade.isGrade) DFLook.frameGrade(grade, camera, frames);
    composer.render(dt / 1000); hotspots(); if (hud) hud(now);
  }
  resize(); buildComposer(); requestAnimationFrame(frame); load();

  window.Line = {
    get ready() { return ready; }, get frames() { return frames; }, renderer, scene, camera, setCam, startTour, stopTour, byId,
    // deterministic capture: freeze the loop, put the clock and the camera at t, render one frame
    capture(t, walkT) {
      manual = true; tour.on = false; animate(simT = t);
      if (walkT !== undefined) { tourFrame(walkT); $('#tourCap').hidden = false; } else controls.update();
      camera.updateMatrixWorld(); composer.render(0.016); hotspots(); return true;
    },
    release() { manual = false; }
  };
})();
