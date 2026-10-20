/* Digital Factory — the 3D view of the Plant EG-01 twin (three.js r170, vendored as window.THREE).
   A physically based model of the plant: image-based light from a generated room environment, soft shadows, ground-truth
   ambient occlusion, bloom for emitted light only (andon lenses, screens, oven heaters, LEDs), selection outline, SMAA.
   Every machine is a detailed procedural model whose moving parts follow its state and cycle in the twin: mounter heads
   pick and place, oven heater zones glow with their measured temperature, robots run their cycle, AGVs scan, forklifts
   lift, people walk. Colour stays disciplined (ISA-101): status colour only for an abnormal state, brand blue for selection.
   Reads the engine every frame; owns nothing of the plant's state. */
(function () {
  'use strict';
  const T = window.THREE;
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, k) => a + (b - a) * k;
  const ease = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

  const PAL = {
    light: {
      bg: 0xD5DAE0, fog: 0xD5DAE0, floor: 0xB4BAC1, floorTint: 0xA9B0B8, zone: 0xB1B8C0, joint: 0xB4BBC3, lineY: 0xD3A12E, lineW: 0xF2F4F6, zoneLine: 0x9AA4B0,
      paint: 0xDEDDD8, paintB: 0xC9CED4, graphite: 0x30353D, dark: 0x1C2027, steel: 0xAEB5BE, alu: 0xC6CCD3, rubber: 0x17191D, belt: 0x2B2E34, glass: 0x8FA6BC,
      rackUp: 0x3D4A5C, rackBeam: 0x97A3B3, pcb: 0x1E6A47, tv: 0x0D0F12, carton: 0xB98E5E, pallet: 0xA27C4B, wrap: 0xF5F7FA,
      skin: 0xC69A7C, cover: 0x33435E, coverTech: 0x1F5CB8, vest: 0xC7D15B, hatOp: 0xF1F2F3, hatTech: 0x1565D8, hatLead: 0xE3BE43,
      agv: 0xF2F3F5, stripe: 0x1428A0, truck: 0xECEEF1, cab: 0x3A4250, wall: 0xD9DCE0, cap: 0xBFC4CA, concrete: 0xB7BCC2,
      hemi: [0xFFFFFF, 0x8E98A4, 0.4], sun: 2.4, env: 0.45, exposure: 0.95, bloom: 0.55
    },
    dark: {
      bg: 0x0A0C10, fog: 0x0A0C10, floor: 0x1A1D22, floorTint: 0x16191E, zone: 0x1D2127, joint: 0x23272E, lineY: 0x8C6A22, lineW: 0x4A515C, zoneLine: 0x3A4250,
      paint: 0x3B4049, paintB: 0x2E333B, graphite: 0x1F232A, dark: 0x111318, steel: 0x6F7782, alu: 0x7D8590, rubber: 0x0D0E10, belt: 0x1E2126, glass: 0x5D6F84,
      rackUp: 0x2A3442, rackBeam: 0x56616F, pcb: 0x1E6A47, tv: 0x08090B, carton: 0x8E6D49, pallet: 0x7A5D38, wrap: 0xB9C1CC,
      skin: 0xB88C70, cover: 0x2A3850, coverTech: 0x1D58B0, vest: 0x9EA64A, hatOp: 0xC9CDD2, hatTech: 0x2A7BEA, hatLead: 0xC7A33A,
      agv: 0xC9CED6, stripe: 0x2189FF, truck: 0xB8BEC7, cab: 0x2A3039, wall: 0x262A31, cap: 0x30353D, concrete: 0x2A2E35,
      hemi: [0xA9B6CC, 0x0A0C10, 0.3], sun: 1.0, env: 0.32, exposure: 1.05, bloom: 0.9
    }
  };
  const STATUS = {
    light: { ok: 0x12A05C, warn: 0xE58E00, bad: 0xE5383B, maint: 0x3B4CCA, info: 0x2189FF, off: 0x8A929D },
    dark: { ok: 0x34C77B, warn: 0xFFB020, bad: 0xFF5A5F, maint: 0x8C9BFF, info: 0x4DA3FF, off: 0x3A414C }
  };

  /* ---------------- procedural textures ---------------- */
  function canvasTex(w, h, draw, o = {}) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new T.CanvasTexture(c);
    t.colorSpace = o.linear ? T.NoColorSpace : T.SRGBColorSpace;
    t.anisotropy = 4;
    if (o.repeat) { t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(o.repeat[0], o.repeat[1]); }
    return t;
  }
  function noise(g, w, h, a, base) {
    const img = g.getImageData(0, 0, w, h), d = img.data;
    let s = 12345;
    for (let i = 0; i < d.length; i += 4) { s = (s * 1103515245 + 12345) & 0x7fffffff; const n = ((s >> 8) & 255) / 255 - 0.5; const v = base + n * a; d[i] = d[i + 1] = d[i + 2] = clamp(v, 0, 255); d[i + 3] = 255; }
    g.putImageData(img, 0, 0);
  }
  const TEX = {};
  function textures() {
    // concrete floor: fine noise and soft blotches (used as a roughness-like albedo variation)
    TEX.floor = canvasTex(512, 512, (g, w, h) => {
      noise(g, w, h, 26, 200);
      for (let i = 0; i < 70; i++) { const x = Math.random() * w, y = Math.random() * h, r = 20 + Math.random() * 80; const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(120,120,120,0.07)'); gr.addColorStop(1, 'rgba(120,120,120,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); }
    }, { repeat: [24, 16] });
    // conveyor belt: ribbed rubber
    TEX.belt = canvasTex(64, 64, (g, w, h) => { g.fillStyle = '#3a3d43'; g.fillRect(0, 0, w, h); g.fillStyle = '#26292e'; for (let i = 0; i < 8; i++) g.fillRect(0, i * 8, w, 3); }, { repeat: [1, 1] });
    TEX.belt.wrapS = TEX.belt.wrapT = T.RepeatWrapping;
    // PCB: green board with parts
    TEX.pcb = canvasTex(128, 96, (g, w, h) => {
      g.fillStyle = '#1d6b47'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#c9a646'; for (let i = 0; i < 40; i++) g.fillRect(Math.random() * w, Math.random() * h, 3, 2);
      g.fillStyle = '#15171a'; g.fillRect(40, 30, 34, 34); g.fillRect(90, 12, 18, 12); g.fillRect(12, 60, 22, 14); g.fillRect(84, 60, 26, 18);
      g.fillStyle = '#d9dde2'; for (let i = 0; i < 18; i++) g.fillRect(8 + i * 6, 86, 3, 5);
    });
    // test pattern for TV screens (bars + ramp: a common aging pattern)
    TEX.pattern = canvasTex(256, 144, (g) => {
      const bars = ['#C0C0C0', '#C0C000', '#00C0C0', '#00C000', '#C000C0', '#C00000', '#0000C0'];
      bars.forEach((b, i) => { g.fillStyle = b; g.fillRect(i * 256 / 7, 0, 256 / 7 + 1, 104); });
      const grd = g.createLinearGradient(0, 0, 256, 0); grd.addColorStop(0, '#000'); grd.addColorStop(1, '#fff');
      g.fillStyle = grd; g.fillRect(0, 104, 256, 40);
    });
    // machine HMI screen
    TEX.hmi = canvasTex(160, 100, (g, w, h) => {
      g.fillStyle = '#0d1a2b'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#1e3a5f'; g.fillRect(0, 0, w, 14);
      g.fillStyle = '#7fb4ff'; g.fillRect(6, 4, 40, 6);
      g.fillStyle = '#2a5fa8'; for (let i = 0; i < 5; i++) g.fillRect(8, 22 + i * 14, 50 + (i * 23) % 70, 8);
      g.strokeStyle = '#4da3ff'; g.lineWidth = 2; g.beginPath(); for (let x = 0; x < 70; x++) { const y = 70 - Math.sin(x / 9) * 14 - x * 0.2; x ? g.lineTo(84 + x, y) : g.moveTo(84, y); } g.stroke();
    });
    // floor glow for an abnormal state (radial falloff, multiplied by the state colour)
    TEX.glow = canvasTex(128, 128, (g, w, h) => { const gr = g.createRadialGradient(w / 2, h / 2, 6, w / 2, h / 2, w / 2); gr.addColorStop(0, 'rgba(255,255,255,0.85)'); gr.addColorStop(0.55, 'rgba(255,255,255,0.32)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
    // hazard stripes for column guards
    TEX.hazard = canvasTex(64, 64, (g, w, h) => { g.fillStyle = '#d3a12e'; g.fillRect(0, 0, w, h); g.fillStyle = '#1b1d21'; for (let i = -2; i < 4; i++) { g.beginPath(); g.moveTo(i * 22, 0); g.lineTo(i * 22 + 11, 0); g.lineTo(i * 22 + 11 + h, h); g.lineTo(i * 22 + h, h); g.fill(); } }, { repeat: [2, 1] });
    // trailer ribs
    TEX.ribs = canvasTex(128, 64, (g, w, h) => { g.fillStyle = '#eceef1'; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(0,0,0,0.08)'; for (let i = 0; i < 16; i++) g.fillRect(i * 8, 0, 2, h); }, { repeat: [6, 1] });
    // carton with tape
    TEX.carton = canvasTex(64, 64, (g, w, h) => { g.fillStyle = '#b98e5e'; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(80,50,20,0.18)'; for (let i = 0; i < 30; i++) g.fillRect(Math.random() * w, Math.random() * h, 8, 1); g.fillStyle = '#d6c3a0'; g.fillRect(w / 2 - 6, 0, 12, h); });
    // flow chevron dash for the cause path
    TEX.dash = canvasTex(64, 8, (g, w, h) => { g.fillStyle = 'rgba(255,255,255,0)'; g.fillRect(0, 0, w, h); g.fillStyle = '#fff'; g.fillRect(0, 0, w * 0.55, h); }, { repeat: [1, 1] });
    TEX.dash.wrapS = T.RepeatWrapping;
  }
  function stencil(text, w = 1024, h = 128, color = 'rgba(40,50,64,0.20)') {
    return canvasTex(w, h, (g) => { g.clearRect(0, 0, w, h); g.fillStyle = color; g.font = `800 ${Math.round(h * 0.62)}px Inter, system-ui, sans-serif`; g.textBaseline = 'middle'; g.textAlign = 'center'; g.fillText(text.toUpperCase(), w / 2, h / 2 + 4); });
  }

  /* ---------------- geometry builder: static parts of a model merge into one mesh per material ---------------- */
  const GEO = new Map();
  const ni = g => (g.index ? g.toNonIndexed() : g);
  const rbox = (w, h, d, r) => { const k = `rb${w.toFixed(3)}|${h.toFixed(3)}|${d.toFixed(3)}|${r}`; if (!GEO.has(k)) GEO.set(k, ni(new T.RoundedBoxGeometry(w, h, d, 2, Math.max(1e-3, Math.min(r, w / 2 - 1e-3, h / 2 - 1e-3, d / 2 - 1e-3))))); return GEO.get(k); };
  const bx = (w, h, d) => { const k = `b${w}|${h}|${d}`; if (!GEO.has(k)) GEO.set(k, ni(new T.BoxGeometry(w, h, d))); return GEO.get(k); };
  const cy = (r1, r2, h, seg = 20) => { const k = `c${r1}|${r2}|${h}|${seg}`; if (!GEO.has(k)) GEO.set(k, ni(new T.CylinderGeometry(r1, r2, h, seg))); return GEO.get(k); };
  const mtx = new T.Matrix4(), q = new T.Quaternion(), eul = new T.Euler(), pos = new T.Vector3(), scl = new T.Vector3(1, 1, 1);
  function builder() {
    const parts = new Map();
    const add = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => {
      eul.set(rx, ry, rz); q.setFromEuler(eul); pos.set(x, y, z); scl.set(sx, sy, sz); mtx.compose(pos, q, scl);
      const g = geo.clone(); g.applyMatrix4(mtx);
      if (!parts.has(mat)) parts.set(mat, []);
      parts.get(mat).push(g);
    };
    return {
      // boxes and cylinders stand on y (base) unless c is set
      box(mat, w, h, d, x, y, z, o = {}) { add(o.r ? rbox(w, h, d, o.r) : bx(w, h, d), mat, x, o.c ? y : y + h / 2, z, o.rx || 0, o.ry || 0, o.rz || 0); },
      cyl(mat, r1, r2, h, x, y, z, o = {}) { add(cy(r1, r2, h, o.seg || 20), mat, x, o.c ? y : y + h / 2, z, o.rx || 0, o.ry || 0, o.rz || 0); },
      geo(geo, mat, x, y, z, rx, ry, rz) { add(ni(geo), mat, x, y, z, rx, ry, rz); },
      finish(group, o = {}) {
        const out = [];
        for (const [mat, list] of parts) {
          const g = T.mergeGeometries(list, false);
          if (!g) continue;
          const m = new T.Mesh(g, mat);
          m.castShadow = o.cast !== false && !mat.transparent; m.receiveShadow = o.receive !== false;
          group.add(m); out.push(m);
          list.forEach(x => x.dispose());
        }
        parts.clear();
        return out;
      }
    };
  }

  function create(canvas, E, opts = {}) {
    const P = E.P;
    const L = P.layout;
    let theme = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
    let C = PAL[theme], S = STATUS[theme];
    const listeners = [];
    const emit = (t, d) => listeners.forEach(f => f(t, d));
    if (!TEX.floor) textures();

    /* ---------------- renderer, camera, controls ---------------- */
    const lowPower = !!opts.lowPower;
    const renderer = new T.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: !!opts.capture, stencil: false });
    let dprMax = Math.min(window.devicePixelRatio || 1, lowPower ? 1.25 : 2);
    renderer.setPixelRatio(dprMax);
    renderer.outputColorSpace = T.SRGBColorSpace;
    renderer.toneMapping = T.NeutralToneMapping;
    renderer.toneMappingExposure = C.exposure;
    renderer.shadowMap.enabled = !lowPower;
    renderer.shadowMap.type = T.PCFSoftShadowMap;
    const scene = new T.Scene();
    const camera = new T.PerspectiveCamera(32, 1, 0.3, 900);
    const controls = new T.OrbitControls(camera, canvas);
    controls.enableDamping = true; controls.dampingFactor = 0.075;
    controls.maxPolarAngle = 1.42; controls.minDistance = 2.5; controls.maxDistance = 300;
    controls.screenSpacePanning = false; controls.zoomSpeed = 1.1; controls.rotateSpeed = 0.55;
    const CENTER = new T.Vector3(L.W / 2, 0, L.D / 2 + 2);
    controls.target.copy(CENTER);
    camera.position.set(CENTER.x + 26, 78, CENTER.z + 92);

    const pmrem = new T.PMREMGenerator(renderer);
    const envTex = pmrem.fromScene(new T.RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;
    const hemi = new T.HemisphereLight(C.hemi[0], C.hemi[1], C.hemi[2]); scene.add(hemi);
    const sun = new T.DirectionalLight(0xFFF6EC, C.sun);
    sun.position.set(CENTER.x - 46, 110, CENTER.z - 62); sun.target.position.copy(CENTER);
    sun.castShadow = !lowPower;
    sun.shadow.mapSize.set(lowPower ? 1024 : 4096, lowPower ? 1024 : 4096);
    Object.assign(sun.shadow.camera, { left: -86, right: 86, top: 64, bottom: -64, near: 20, far: 300 });
    sun.shadow.bias = -0.00025; sun.shadow.normalBias = 0.035; sun.shadow.radius = 3;
    scene.add(sun, sun.target);

    /* ---------------- post-processing ---------------- */
    let composer = null, gtao = null, bloom = null, outline = null, smaa = null;
    let quality = lowPower ? 'low' : (opts.quality || 'high');
    function buildComposer() {
      if (composer) { composer.dispose(); composer = null; }
      if (quality === 'low') return;
      composer = new T.EffectComposer(renderer);
      composer.setPixelRatio(renderer.getPixelRatio());
      composer.addPass(new T.RenderPass(scene, camera));
      if (quality === 'high') {
        gtao = new T.GTAOPass(scene, camera, 1, 1);
        gtao.updateGtaoMaterial({ radius: 0.9, distanceExponent: 1.4, thickness: 2.4, scale: 1.15, samples: 12, distanceFallOff: 1 });
        gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 12 });
        gtao.blendIntensity = theme === 'dark' ? 0.7 : 1.0;
        composer.addPass(gtao);
      } else gtao = null;
      bloom = new T.UnrealBloomPass(new T.Vector2(256, 256), C.bloom, 0.35, 2.2);
      composer.addPass(bloom);
      outline = new T.OutlinePass(new T.Vector2(256, 256), scene, camera, []);
      Object.assign(outline, { edgeStrength: 4.2, edgeGlow: 0.25, edgeThickness: 1.4, pulsePeriod: 0 });
      outline.visibleEdgeColor.set(S.info); outline.hiddenEdgeColor.set(S.info).multiplyScalar(0.35);
      composer.addPass(outline);
      smaa = new T.SMAAPass(1, 1);
      composer.addPass(smaa);
      composer.addPass(new T.OutputPass());
      resize();
    }

    /* ---------------- materials ---------------- */
    const std = (c, o = {}) => new T.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.6, metalness: 0.0, envMapIntensity: C.env }, o));
    const M = {
      floor: std(C.floor, { map: TEX.floor, roughness: 0.62 }),
      zone: std(C.zone, { roughness: 0.7 }),
      paint: std(C.paint, { roughness: 0.42, metalness: 0.04 }), paintB: std(C.paintB, { roughness: 0.48 }),
      graphite: std(C.graphite, { roughness: 0.5, metalness: 0.15 }), dark: std(C.dark, { roughness: 0.55 }),
      steel: std(C.steel, { roughness: 0.32, metalness: 0.85 }), alu: std(C.alu, { roughness: 0.4, metalness: 0.7 }), rubber: std(C.rubber, { roughness: 0.92 }),
      belt: std(0xffffff, { map: TEX.belt, roughness: 0.85, color: C.belt }),
      glass: std(C.glass, { roughness: 0.08, metalness: 0.0, transparent: true, opacity: 0.1, depthWrite: false, envMapIntensity: 0.8 }),
      rackUp: std(C.rackUp, { roughness: 0.5, metalness: 0.35 }), rackBeam: std(C.rackBeam, { roughness: 0.45, metalness: 0.4 }),
      pcb: std(0xffffff, { map: TEX.pcb, roughness: 0.5 }), tv: std(C.tv, { roughness: 0.25, metalness: 0.2 }),
      carton: std(0xffffff, { map: TEX.carton, roughness: 0.85 }), pallet: std(C.pallet, { roughness: 0.85 }),
      wrap: std(C.wrap, { roughness: 0.15, transparent: true, opacity: 0.38, depthWrite: false }),
      skin: std(C.skin, { roughness: 0.7 }), cover: std(C.cover, { roughness: 0.8 }), coverTech: std(C.coverTech, { roughness: 0.8 }), vest: std(C.vest, { roughness: 0.7 }),
      hatOp: std(C.hatOp, { roughness: 0.35 }), hatTech: std(C.hatTech, { roughness: 0.35 }), hatLead: std(C.hatLead, { roughness: 0.35 }),
      agv: std(C.agv, { roughness: 0.38 }), stripe: std(C.stripe, { roughness: 0.4 }), truck: std(0xffffff, { map: TEX.ribs, roughness: 0.5 }), cab: std(C.cab, { roughness: 0.38, metalness: 0.3 }),
      wall: std(C.wall, { roughness: 0.85 }), cap: std(C.cap, { roughness: 0.7 }), concrete: std(C.concrete, { roughness: 0.9 }), hazard: std(0xffffff, { map: TEX.hazard, roughness: 0.6 }),
      lineY: new T.MeshBasicMaterial({ color: C.lineY }), lineW: new T.MeshBasicMaterial({ color: C.lineW }), zoneLine: new T.LineBasicMaterial({ color: C.zoneLine, transparent: true, opacity: 0.7 }),
      hmi: new T.MeshStandardMaterial({ color: 0x0d1a2b, emissive: 0xffffff, emissiveMap: TEX.hmi, emissiveIntensity: 1.6, roughness: 0.2 }),
      screen: new T.MeshBasicMaterial({ map: TEX.pattern, toneMapped: false, color: new T.Color(1.6, 1.6, 1.6) }),
      phoneScreen: new T.MeshBasicMaterial({ color: new T.Color(1.4, 1.5, 1.7), toneMapped: false }),
      led: new T.MeshBasicMaterial({ color: new T.Color(0.2, 0.5, 2.5), toneMapped: false }),
      lamp: new T.MeshBasicMaterial({ color: new T.Color(2.2, 2.2, 2.0), toneMapped: false }),
      sel: new T.MeshBasicMaterial({ color: S.info, side: T.DoubleSide, transparent: true, opacity: 0.95, depthWrite: false }),
      route: new T.MeshBasicMaterial({ color: S.info, transparent: true, opacity: 0.85, depthWrite: false })
    };
    M.floor.color.set(C.floor);
    const lens = c => new T.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0, roughness: 0.25 });

    const world = new T.Group(); scene.add(world);
    const pick = [];
    const tag = (obj, ref, name) => { obj.userData.ref = ref; obj.userData.name = name; obj.traverse(o => { if (o.isMesh) { o.userData.ref = ref; o.userData.name = name; if (!o.userData.nopick) pick.push(o); } }); };

    /* ---------------- floor, markings, walls, columns ---------------- */
    {
      const fl = new T.Mesh(new T.PlaneGeometry(L.W + 90, L.D + 90), M.floor);
      fl.rotation.x = -Math.PI / 2; fl.position.set(L.W / 2, 0, L.D / 2); fl.receiveShadow = true; world.add(fl); fl.userData.ref = 'floor';
      // the building slab, slightly lighter than the yard
      const slab = new T.Mesh(new T.PlaneGeometry(L.W, L.D), std(C.floorTint, { map: TEX.floor, roughness: 0.48 }));
      slab.material.color.set(C.floorTint); M.slab = slab.material;
      slab.rotation.x = -Math.PI / 2; slab.position.set(L.W / 2, 0.004, L.D / 2); slab.receiveShadow = true; world.add(slab);
      // slab joints every 8 m
      const pts = [];
      for (let x = 8; x < L.W; x += 8) pts.push(x, 0.008, 0, x, 0.008, L.D);
      for (let z = 8; z < L.D; z += 8) pts.push(0, 0.008, z, L.W, 0.008, z);
      const jg = new T.BufferGeometry(); jg.setAttribute('position', new T.Float32BufferAttribute(pts, 3));
      M.joint = new T.LineBasicMaterial({ color: C.joint, transparent: true, opacity: 0.55 });
      const jl = new T.LineSegments(jg, M.joint); jl.raycast = () => {}; world.add(jl);
      // zones: soft tint, outline and a floor stencil with the zone's name
      for (const z of L.ZONES) {
        const w = z.x1 - z.x0, d = z.z1 - z.z0;
        const m = new T.Mesh(new T.PlaneGeometry(w, d), M.zone); m.rotation.x = -Math.PI / 2; m.position.set(z.x0 + w / 2, 0.01, z.z0 + d / 2); m.receiveShadow = true; m.material.transparent = true; m.material.opacity = 0.55; world.add(m);
        const lg = new T.BufferGeometry(); lg.setAttribute('position', new T.Float32BufferAttribute([z.x0, 0.016, z.z0, z.x1, 0.016, z.z0, z.x1, 0.016, z.z0, z.x1, 0.016, z.z1, z.x1, 0.016, z.z1, z.x0, 0.016, z.z1, z.x0, 0.016, z.z1, z.x0, 0.016, z.z0], 3));
        const ll = new T.LineSegments(lg, M.zoneLine); ll.raycast = () => {}; world.add(ll);
        if (w > 12) {
          const tw = Math.min(w * 0.7, 22), th = tw / 8;
          const st = new T.Mesh(new T.PlaneGeometry(tw, th), new T.MeshBasicMaterial({ map: stencil(z.name, 1024, 128, 'rgba(40,50,64,0.12)'), transparent: true, depthWrite: false }));
          st.rotation.x = -Math.PI / 2; st.position.set(z.x0 + w / 2, 0.02, z.z1 - th * 0.8); st.userData.stencil = true; world.add(st);
        }
      }
      // AGV aisles: a lighter lane with safety-yellow edge lines
      const yb = builder();
      for (const A of L.AISLES) {
        const h = A.a[1] === A.b[1];
        const len = h ? Math.abs(A.b[0] - A.a[0]) + 2.4 : Math.abs(A.b[1] - A.a[1]) + 2.4;
        const cx = (A.a[0] + A.b[0]) / 2, cz = (A.a[1] + A.b[1]) / 2;
        for (const side of [-1, 1]) yb.box(M.lineY, h ? len : 0.1, 0.004, h ? 0.1 : len, h ? cx : cx + side * 1.2, 0.012, h ? cz + side * 1.2 : cz, { c: true });
      }
      // walkway along the lines and dock zone hatches (white)
      for (const d of L.DOCKS) for (let i = 0; i < 6; i++) yb.box(M.lineW, 0.3, 0.004, 2.4, d.x - 1.8 + i * 0.72, 0.012, L.D - 2.2, { c: true, ry: 0.6 });
      yb.finish(world, { cast: false });
      // perimeter wall cut away at 1.6 m, concrete cap, door gaps (west receiving, south docks)
      const wb = builder();
      const H = 1.6, t = 0.28;
      const gapsS = L.DOCKS.map(d => [d.x - 2.2, d.x + 2.2]);
      const gapsW = [[11.5, 16.5], [27.5, 32.5]];
      const run = (a, b, gaps, fn) => { let s = a; for (const [g0, g1] of gaps.concat([[b, b]])) { if (g0 > s) fn(s, g0); s = g1; } };
      const wall = (x, z, w, d) => { wb.box(M.wall, w, H, d, x, 0, z); wb.box(M.cap, w + 0.06, 0.08, d + 0.06, x, H, z); };
      run(0, L.W, [], (a, b) => wall((a + b) / 2, 0, b - a, t));
      run(0, L.W, gapsS, (a, b) => wall((a + b) / 2, L.D, b - a, t));
      run(0, L.D, gapsW, (a, b) => wall(0, (a + b) / 2, t, b - a));
      run(0, L.D, [], (a, b) => wall(L.W, (a + b) / 2, t, b - a));
      // steel columns on a 16 m grid with hazard guards, kept short so they never hide the floor
      for (let x = 16; x < L.W; x += 16) for (const z of [0.35, L.D - 0.35]) {
        wb.box(M.graphite, 0.36, 3.2, 0.36, x, 0, z); wb.box(M.hazard, 0.46, 0.9, 0.46, x, 0, z);
      }
      // dock levelers and bumpers, receiving doors
      for (const d of L.DOCKS) { wb.box(M.steel, 3.4, 0.9, 1.4, d.x, 0, L.D + 0.8); for (const s of [-1, 1]) wb.box(M.rubber, 0.3, 0.5, 0.25, d.x + s * 1.5, 0.5, L.D + 1.6); }
      wb.finish(world);
    }

    /* ---------------- small parts ---------------- */
    function signalTower(g, x, y, z) {
      const b = builder();
      b.cyl(M.steel, 0.022, 0.022, 0.38, x, y, z, { seg: 10 });
      b.cyl(M.graphite, 0.05, 0.05, 0.05, x, y + 0.38, z, { seg: 16 });
      b.finish(g, { cast: false });
      const mk = (c, yy) => { const m = new T.Mesh(cy(0.048, 0.048, 0.07, 16), lens(c)); m.position.set(x, y + 0.43 + yy + 0.035, z); g.add(m); return m; };
      return { gr: mk(S.ok, 0), a: mk(S.warn, 0.075), r: mk(S.bad, 0.15) };
    }
    function hmiScreen(b, x, y, z, ry = 0, w = 0.32, h = 0.22) {
      b.box(M.graphite, w + 0.04, h + 0.04, 0.035, x, y, z, { c: true, ry, r: 0.01 });
      const m = new T.Mesh(new T.PlaneGeometry(w, h), M.hmi);
      m.position.set(x + Math.sin(ry) * 0.019, y, z + Math.cos(ry) * 0.019); m.rotation.y = ry;
      return m;
    }
    function frameGeo(w, d, t) {
      const s = new T.Shape(); s.moveTo(-w / 2, -d / 2); s.lineTo(w / 2, -d / 2); s.lineTo(w / 2, d / 2); s.lineTo(-w / 2, d / 2); s.lineTo(-w / 2, -d / 2);
      const h = new T.Shape(); const a = w / 2 - t, c = d / 2 - t; h.moveTo(-a, -c); h.lineTo(-a, c); h.lineTo(a, c); h.lineTo(a, -c); h.lineTo(-a, -c);
      s.holes.push(h);
      const g = new T.ShapeGeometry(s); g.rotateX(-Math.PI / 2); return g;
    }
    function cornersGeo(w, d, len, t) {
      const parts = [];
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        const x = sx * w / 2, z = sz * d / 2;
        const a = new T.PlaneGeometry(len, t); a.rotateX(-Math.PI / 2); a.translate(x - sx * len / 2, 0, z); parts.push(a);
        const b = new T.PlaneGeometry(t, len); b.rotateX(-Math.PI / 2); b.translate(x, 0, z - sz * len / 2); parts.push(b);
      }
      return T.mergeGeometries(parts);
    }
    // an articulated arm: base, turret (yaw), shoulder, upper arm, elbow, forearm, wrist, tool
    function robotArm(g, x, y, z, s = 1, mat = M.paint) {
      const b = builder();
      b.cyl(M.graphite, 0.26 * s, 0.3 * s, 0.16 * s, x, y, z, { seg: 24 });
      b.finish(g);
      const yaw = new T.Group(); yaw.position.set(x, y + 0.16 * s, z); g.add(yaw);
      const by = builder(); by.cyl(mat, 0.2 * s, 0.22 * s, 0.26 * s, 0, 0, 0, { seg: 24 }); by.box(mat, 0.3 * s, 0.26 * s, 0.36 * s, 0, 0.18 * s, 0, { r: 0.04 * s }); by.finish(yaw);
      const sh = new T.Group(); sh.position.y = 0.36 * s; yaw.add(sh);
      const bs = builder(); bs.box(mat, 0.16 * s, 0.82 * s, 0.2 * s, 0, 0, 0, { r: 0.06 * s }); bs.cyl(M.graphite, 0.11 * s, 0.11 * s, 0.24 * s, 0, 0, 0, { rx: Math.PI / 2, c: true, seg: 18 }); bs.finish(sh);
      const el = new T.Group(); el.position.y = 0.82 * s; sh.add(el);
      const be = builder(); be.cyl(M.graphite, 0.09 * s, 0.09 * s, 0.22 * s, 0, 0, 0, { rx: Math.PI / 2, c: true, seg: 18 }); be.box(mat, 0.62 * s, 0.13 * s, 0.15 * s, 0.3 * s, -0.065 * s, 0, { r: 0.05 * s }); be.finish(el);
      const wr = new T.Group(); wr.position.set(0.62 * s, 0, 0); el.add(wr);
      const bw = builder(); bw.cyl(M.graphite, 0.06 * s, 0.06 * s, 0.16 * s, 0, -0.16 * s, 0, { seg: 14 }); bw.cyl(M.steel, 0.025 * s, 0.012 * s, 0.14 * s, 0, -0.3 * s, 0, { seg: 10 }); bw.finish(wr);
      return { yaw, sh, el, wr };
    }

    /* ---------------- machines ---------------- */
    const ST = new Map();
    const GLOW = new T.PlaneGeometry(1, 1); GLOW.rotateX(-Math.PI / 2);
    function buildStation(s) {
      const g = new T.Group(); g.position.set(s.x, 0, s.z); if (s.flip) g.rotation.y = Math.PI;
      const W = s.w, D = s.d, H = s.h;
      const paint = M.paint.clone();
      const v = { s, g, kind: s.kind, paint, anim: {}, screens: [] };
      const b = builder();
      const tower = (x, y, z) => { v.andon = signalTower(g, x, y, z); };
      switch (s.kind) {
        case 'loader': case 'unloader': {
          b.box(paint, W, H * 0.55, D, 0, 0, 0, { r: 0.03 });
          b.box(M.dark, W * 0.98, 0.06, D * 0.98, 0, 0, 0);
          for (const [px, pz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) b.box(M.alu, 0.05, H * 0.5, 0.05, px * (W / 2 - 0.06), H * 0.55, pz * (D / 2 - 0.06));
          b.box(M.alu, W, 0.05, D, 0, H * 1.05, 0);
          const el = new T.Group(); el.position.y = H * 0.6; g.add(el);
          const be = builder(); for (let i = 0; i < 2; i++) { be.box(M.graphite, W * 0.78, 0.36, D * 0.72, 0, i * 0.38, 0, { r: 0.015 }); for (let k = 0; k < 6; k++) be.box(M.steel, W * 0.8, 0.012, D * 0.7, 0, i * 0.38 + 0.05 + k * 0.05, 0); }
          be.finish(el); v.anim.elev = el;
          g.add(hmiScreen(b, W * 0.25, H * 0.42, D / 2 + 0.02, 0, 0.26, 0.18));
          tower(W / 2 - 0.08, H * 1.08, -D / 2 + 0.08);
          break;
        }
        case 'printer': case 'spi': case 'aoi': {
          const hb = H * 0.6;
          b.box(paint, W, hb, D, 0, 0, 0, { r: 0.04 });
          b.box(M.dark, W * 0.98, 0.07, D * 0.98, 0, 0, 0);
          b.box(M.paintB, W * 0.9, 0.02, D * 0.9, 0, hb, 0);
          // hood: frame and glass
          for (const [px, pz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) b.box(M.graphite, 0.05, H - hb, 0.05, px * (W / 2 - 0.04), hb, pz * (D / 2 - 0.04));
          b.box(M.graphite, W, 0.06, D, 0, H - 0.06, 0, { r: 0.02 });
          b.box(M.glass, W * 0.96, H - hb - 0.06, D * 0.96, 0, hb, 0);
          if (s.kind === 'printer') {
            b.box(M.steel, W * 0.8, 0.03, D * 0.7, 0, hb + 0.08, 0);      // stencil frame
            const sq = new T.Group(); sq.position.y = hb + 0.14; g.add(sq);
            const bq = builder(); bq.box(M.graphite, 0.12, 0.08, D * 0.78, 0, 0, 0); bq.box(M.steel, 0.02, 0.06, D * 0.76, 0.05, -0.05, 0); bq.finish(sq);
            v.anim.squeegee = sq;
          } else {
            const gy = new T.Group(); gy.position.y = H - 0.22; g.add(gy);
            const bg = builder(); bg.box(M.graphite, 0.12, 0.08, D * 0.86, 0, 0, 0); bg.finish(gy);
            const head = new T.Group(); gy.add(head);
            const bh = builder(); bh.box(M.dark, 0.2, 0.18, 0.2, 0, -0.18, 0, { r: 0.02 }); bh.cyl(M.graphite, 0.07, 0.07, 0.08, 0, -0.26, 0, { seg: 16 }); bh.finish(head);
            const ring = new T.Mesh(new T.TorusGeometry(0.09, 0.012, 8, 24), new T.MeshBasicMaterial({ color: new T.Color(0.3, 0.3, 0.3), toneMapped: false }));
            ring.rotation.x = Math.PI / 2; ring.position.y = -0.27; head.add(ring);
            v.anim.scan = { gy, head, ring };
          }
          g.add(hmiScreen(b, W * 0.28, hb * 0.78, D / 2 + 0.02));
          tower(W / 2 - 0.08, H, -D / 2 + 0.08);
          break;
        }
        case 'mounter': case 'bond': {
          const hb = H * 0.5;
          b.box(paint, W, hb, D, 0, 0, 0, { r: 0.04 });
          b.box(M.dark, W * 0.98, 0.07, D * 0.98, 0, 0, 0);
          for (const [px, pz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) b.box(paint, 0.08, H - hb, 0.08, px * (W / 2 - 0.05), hb, pz * (D / 2 - 0.05));
          b.box(paint, W, 0.08, D, 0, H - 0.08, 0, { r: 0.02 });
          b.box(M.glass, W * 0.95, H - hb - 0.08, D * 0.95, 0, hb, 0);
          if (s.kind === 'mounter') {
            // feeder trolleys with tape reels on both sides
            for (const sz of [-1, 1]) {
              b.box(M.graphite, W * 0.86, hb * 0.9, 0.34, 0, 0.08, sz * (D / 2 + 0.17), { r: 0.02 });
              for (let i = 0; i < 14; i++) {
                const rx = -W * 0.4 + i * W * 0.8 / 13;
                const colorMat = i % 5 === 0 ? M.paintB : i % 3 === 0 ? M.steel : M.dark;
                b.cyl(colorMat, 0.17, 0.17, 0.035, rx, hb * 0.9 + 0.22, sz * (D / 2 + 0.2), { rx: Math.PI / 2, c: true, seg: 20 });
              }
            }
          } else {
            const uv = new T.Mesh(bx(0.5, 0.04, 0.3), new T.MeshBasicMaterial({ color: new T.Color(0.3, 0.4, 2.2), toneMapped: false }));
            uv.position.set(W * 0.25, H - 0.16, 0); g.add(uv); v.anim.uv = uv;
          }
          // two X gantries with heads that run between the feeders and the board
          const gants = [];
          for (const gx of [-0.25, 0.25]) {
            const beam = new T.Group(); beam.position.set(gx * W, H - 0.22, 0); g.add(beam);
            const bb = builder(); bb.box(M.alu, 0.14, 0.1, D * 0.9, 0, 0, 0); bb.finish(beam);
            const head = new T.Group(); beam.add(head);
            const bh = builder(); bh.box(M.graphite, 0.24, 0.22, 0.18, 0, -0.2, 0, { r: 0.02 }); for (let n = 0; n < 4; n++) bh.cyl(M.steel, 0.012, 0.012, 0.1, -0.08 + n * 0.055, -0.34, 0, { seg: 8 }); bh.finish(head);
            gants.push({ beam, head, gx: gx * W });
          }
          v.anim.gants = gants;
          g.add(hmiScreen(b, W * 0.32, hb * 0.78, D / 2 + 0.02));
          tower(W / 2 - 0.1, H, -D / 2 + 0.1);
          break;
        }
        case 'reflow': {
          b.box(paint, W * 0.86, H * 0.62, D, 0, 0, 0, { r: 0.05 });
          b.box(M.dark, W * 0.86, 0.08, D * 0.98, 0, 0, 0);
          b.box(M.paintB, W * 0.86, H * 0.28, D * 0.96, 0, H * 0.62, 0, { r: 0.05 });     // the lifting hood
          b.box(M.graphite, W * 0.06, H * 0.5, D * 0.7, -W * 0.46, 0, 0); b.box(M.graphite, W * 0.06, H * 0.5, D * 0.7, W * 0.46, 0, 0);
          for (const ex of [-0.22, 0.12]) { b.cyl(M.steel, 0.12, 0.12, 0.5, ex * W, H * 0.9, 0, { seg: 18 }); b.cyl(M.steel, 0.16, 0.16, 0.05, ex * W, H * 0.9 + 0.5, 0, { seg: 18 }); }
          for (let i = 0; i < 9; i++) b.box(M.graphite, 0.012, H * 0.28, D * 0.97, -W * 0.43 + i * W * 0.86 / 8, H * 0.62, 0);
          // heater zones: a glowing slot along the front, one segment per zone, coloured from its temperature
          v.anim.zones = [];
          for (let i = 0; i < 8; i++) {
            const zm = new T.MeshBasicMaterial({ color: new T.Color(0.2, 0.05, 0), toneMapped: false });
            const z = new T.Mesh(bx(W * 0.86 / 8 - 0.05, 0.07, 0.02), zm);
            z.position.set(-W * 0.43 + (i + 0.5) * W * 0.86 / 8, H * 0.45, D / 2 + 0.006); g.add(z); v.anim.zones.push(zm);
          }
          g.add(hmiScreen(b, W * 0.36, H * 0.3, D / 2 + 0.02));
          tower(W * 0.42, H * 0.9, -D / 2 + 0.1);
          break;
        }
        case 'robot': {
          b.box(paint, W, 0.78, D, 0, 0, 0, { r: 0.04 });
          b.box(M.dark, W * 0.99, 0.06, D * 0.99, 0, 0, 0);
          // light fence: posts, a top rail and guard panels on three sides
          for (const [px, pz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) b.box(M.graphite, 0.06, 1.5, 0.06, px * (W / 2 - 0.04), 0.78, pz * (D / 2 - 0.04));
          b.box(M.graphite, W, 0.04, 0.05, 0, 2.28, -D / 2 + 0.04); b.box(M.graphite, W, 0.04, 0.05, 0, 2.28, D / 2 - 0.04);
          b.box(M.glass, W * 0.98, 1.4, 0.02, 0, 0.84, -D / 2 + 0.04); b.box(M.glass, 0.02, 1.4, D * 0.98, -W / 2 + 0.04, 0.84, 0); b.box(M.glass, 0.02, 1.4, D * 0.98, W / 2 - 0.04, 0.84, 0);
          b.box(M.paintB, W * 0.36, 0.04, D * 0.4, W * 0.18, 0.78, -D * 0.12);      // work table
          v.anim.arm = robotArm(g, -W * 0.18, 0.78, -D * 0.1, 1.05);
          g.add(hmiScreen(b, -W * 0.36, 1.18, D / 2 + 0.03));
          tower(W / 2 - 0.06, 2.3, -D / 2 + 0.06);
          break;
        }
        case 'bench': case 'repair': {
          b.box(M.paintB, W, 0.05, D * 0.7, 0, 0.86, -D * 0.1, { r: 0.015 });
          for (const [px, pz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) b.box(M.alu, 0.05, 0.86, 0.05, px * (W / 2 - 0.08), 0, pz * (D * 0.33) - D * 0.1);
          b.box(M.alu, W * 0.94, 0.04, 0.34, 0, 1.52, -D * 0.38);
          for (const px of [-1, 1]) b.box(M.alu, 0.04, 0.66, 0.04, px * W * 0.45, 0.9, -D * 0.38);
          for (let i = 0; i < 6; i++) b.box(i % 2 ? M.paintB : M.graphite, 0.32, 0.16, 0.26, -W * 0.38 + i * W * 0.15, 1.56, -D * 0.38, { r: 0.02 });
          b.cyl(M.graphite, 0.02, 0.02, 0.5, W * 0.38, 0.91, -D * 0.28, { seg: 8 }); b.box(M.graphite, 0.42, 0.03, 0.12, W * 0.28, 1.41, -D * 0.28);
          g.add(hmiScreen(b, -W * 0.25, 1.15, -D * 0.33, 0, 0.36, 0.22));
          const lamp = new T.Mesh(bx(0.4, 0.012, 0.1), M.lamp); lamp.position.set(W * 0.28, 1.39, -D * 0.28); g.add(lamp);
          tower(W / 2 - 0.12, 1.55, -D / 2 + 0.2);
          break;
        }
        case 'fct': {
          b.box(paint, W, H * 0.46, D, 0, 0, 0, { r: 0.04 });
          b.box(M.dark, W * 0.99, 0.07, D * 0.99, 0, 0, 0);
          b.box(M.graphite, W * 0.92, H * 0.52, 0.16, 0, H * 0.46, -D * 0.32, { r: 0.03 });
          const scr = new T.Mesh(new T.PlaneGeometry(W * 0.78, H * 0.38), M.screen); scr.position.set(0, H * 0.72, -D * 0.32 + 0.085); g.add(scr);
          const lid = new T.Group(); lid.position.set(0, H * 0.46, D * 0.1); g.add(lid);
          const bl = builder(); bl.box(M.paintB, W * 0.6, 0.12, D * 0.42, 0, 0.3, 0, { r: 0.02 }); for (const px of [-1, 1]) bl.box(M.steel, 0.03, 0.3, 0.03, px * W * 0.27, 0, 0); bl.finish(lid);
          v.anim.lid = lid;
          tower(W / 2 - 0.08, H, -D / 2 + 0.08);
          break;
        }
        case 'qc': {
          b.box(M.graphite, W, H, 0.14, 0, 0, -D / 2 + 0.07, { r: 0.03 }); b.box(M.graphite, W, H, 0.14, 0, 0, D / 2 - 0.07, { r: 0.03 });
          b.box(M.graphite, W, 0.16, D, 0, H - 0.16, 0, { r: 0.03 });
          b.box(paint, W * 0.32, H * 0.38, D * 0.55, 0, 0, 0, { r: 0.03 });
          const lights = [];
          for (const sz of [-1, 1]) { const lm = new T.MeshBasicMaterial({ color: new T.Color(0.6, 0.6, 0.6), toneMapped: false }); const l = new T.Mesh(bx(W * 0.86, 0.5, 0.02), lm); l.position.set(0, H * 0.62, sz * (D / 2 - 0.15)); g.add(l); lights.push(lm); }
          const top = new T.MeshBasicMaterial({ color: new T.Color(0.6, 0.6, 0.6), toneMapped: false }); const tl = new T.Mesh(bx(W * 0.86, 0.02, D * 0.6), top); tl.position.set(0, H - 0.17, 0); g.add(tl); lights.push(top);
          v.anim.qc = lights;
          g.add(hmiScreen(b, W / 2 - 0.4, 1.3, D / 2 + 0.01));
          tower(W / 2 - 0.1, H, -D / 2 + 0.1);
          break;
        }
        case 'packer': {
          b.box(paint, W, H * 0.55, D, 0, 0, 0, { r: 0.04 });
          b.box(M.dark, W * 0.99, 0.07, D * 0.99, 0, 0, 0);
          for (const [px, pz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) b.box(paint, 0.08, H * 0.45, 0.08, px * (W / 2 - 0.05), H * 0.55, pz * (D / 2 - 0.05));
          b.box(paint, W, 0.08, D, 0, H - 0.08, 0, { r: 0.02 });
          b.box(M.glass, W * 0.96, H * 0.45 - 0.08, D * 0.96, 0, H * 0.55, 0);
          for (let i = 0; i < 5; i++) b.box(M.carton, 1.3, 0.12, 0.85, -W / 2 - 0.9, i * 0.13, D * 0.15);
          const press = new T.Group(); press.position.set(W * 0.1, H - 0.2, 0); g.add(press);
          const bp = builder(); bp.box(M.graphite, 0.9, 0.08, 0.7, 0, -0.1, 0, { r: 0.02 }); bp.box(M.steel, 0.06, 0.35, 0.06, 0, 0, 0); bp.finish(press);
          v.anim.press = press;
          g.add(hmiScreen(b, W * 0.3, H * 0.42, D / 2 + 0.02));
          tower(W / 2 - 0.1, H, -D / 2 + 0.1);
          break;
        }
        case 'palletizer': {
          b.box(M.paintB, W, 0.12, D, 0, 0, 0);
          for (const [px, pz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) b.box(M.graphite, 0.07, 2.2, 0.07, px * (W / 2 - 0.05), 0.12, pz * (D / 2 - 0.05));
          b.box(M.graphite, W, 0.05, 0.06, 0, 2.3, -D / 2 + 0.05); b.box(M.graphite, 0.06, 0.05, D, -W / 2 + 0.05, 2.3, 0);
          b.box(paint, 0.9, 0.85, 0.9, 0, 0.12, 0, { r: 0.04 });
          v.anim.arm = robotArm(g, 0, 0.97, 0, 1.55);
          tower(W / 2 - 0.08, 2.35, -D / 2 + 0.08);
          break;
        }
        default: break;
      }
      for (const m of b.finish(g)) { if (m.material === paint) v.body = m; }
      g.traverse(o => { if (o.isMesh && o.material === M.hmi) v.screens.push(o); });
      if (s.kind !== 'burnin') {
        // abnormal state: a glow on the floor and a crisp frame
        const gm = new T.MeshBasicMaterial({ color: S.bad, map: TEX.glow, transparent: true, opacity: 0, depthWrite: false, blending: T.AdditiveBlending, toneMapped: false });
        v.glow = new T.Mesh(GLOW, gm); v.glow.scale.set(W + 2.4, 1, D + 2.4); v.glow.position.y = 0.025; v.glow.userData.nopick = true; g.add(v.glow);
        v.frame = new T.Mesh(frameGeo(W + 0.9, D + 0.9, 0.14), new T.MeshBasicMaterial({ color: S.bad, side: T.DoubleSide, transparent: true, opacity: 0.95, depthWrite: false }));
        v.frame.position.y = 0.03; v.frame.visible = false; v.frame.userData.nopick = true; g.add(v.frame);
      }
      world.add(g);
      tag(g, 'st:' + s.id, s.name);
      ST.set(s.id, v);
      return v;
    }
    P.stations.forEach(buildStation);

    /* burn-in racks: three TV rows and two phone rows, lit test patterns glow at night */
    {
      const B0 = E.BURN, g = new T.Group(); world.add(g);
      const b = builder();
      for (let r = 0; r < 3; r++) {
        const z = 32 + r * 3.4, x0 = 101 - 0.8, x1 = 101 + 11 * 1.45 + 0.8;
        b.box(M.paintB, x1 - x0, 0.45, 0.7, (x0 + x1) / 2, 0, z, { r: 0.02 });
        b.box(M.graphite, x1 - x0, 0.06, 0.08, (x0 + x1) / 2, 1.58, z - 0.3);
        for (let i = 0; i <= 12; i++) b.box(M.alu, 0.05, 1.13, 0.05, x0 + i * (x1 - x0) / 12, 0.45, z - 0.3);
        b.box(M.dark, x1 - x0, 0.02, 0.6, (x0 + x1) / 2, 0.45, z);
      }
      for (let r = 0; r < 2; r++) {
        const z = 43.5 + r * 2.6, x0 = 101 - 0.6, x1 = 101 + 23 * 0.72 + 0.6;
        b.box(M.paintB, x1 - x0, 0.85, 1.0, (x0 + x1) / 2, 0, z, { r: 0.02 });
        for (let i = 0; i < 24; i++) b.box(M.dark, 0.5, 0.01, 0.8, 101 + i * 0.72, 0.85, z);
      }
      b.finish(g);
      tag(g, 'st:' + B0.id, 'Burn-in');
      ST.set(B0.id, { s: B0, g, kind: 'burnin', anim: {}, screens: [] });
    }

    /* ---------------- conveyors ---------------- */
    const SMTLINE = sg => sg.from && (sg.from.line === 'L1' || sg.from.line === 'L2');
    const SEGY = sg => (SMTLINE(sg) ? 0.9 : 0.86);
    const SEGW = sg => (SMTLINE(sg) ? 0.36 : sg.from && sg.from.line === 'L4' ? 0.5 : 1.2);
    {
      const b = builder();
      const beltB = builder();
      for (const sg of P.segs) {
        const y = SEGY(sg), w = SEGW(sg);
        for (let i = 1; i < sg.path.length; i++) {
          const a = sg.path[i - 1], c = sg.path[i];
          const len = Math.hypot(c[0] - a[0], c[1] - a[1]); if (len < 0.01) continue;
          const ang = Math.atan2(c[1] - a[1], c[0] - a[0]);
          const mx = (a[0] + c[0]) / 2, mz = (a[1] + c[1]) / 2;
          const ext = i < sg.path.length - 1 ? w / 2 : 0;
          const sx = -Math.sin(ang), sz = Math.cos(ang);
          for (const side of [-1, 1]) b.box(M.alu, len + ext, 0.08, 0.05, mx + sx * side * (w / 2 + 0.02), y - 0.12, mz + sz * side * (w / 2 + 0.02), { ry: -ang });
          if (!SMTLINE(sg)) beltB.box(M.belt, len + ext, 0.03, w, mx, y - 0.1, mz, { ry: -ang });
          else for (const side of [-1, 1]) b.box(M.dark, len + ext, 0.03, 0.03, mx + sx * side * (w / 2 - 0.02), y - 0.08, mz + sz * side * (w / 2 - 0.02), { ry: -ang });
          const n = Math.max(1, Math.floor(len / 1.6));
          for (let k = 0; k <= n; k++) {
            const t = Math.min(1, (k / n) * 0.92 + 0.04);
            const lx = a[0] + (c[0] - a[0]) * t, lz = a[1] + (c[1] - a[1]) * t;
            for (const side of [-1, 1]) b.box(M.alu, 0.05, y - 0.12, 0.05, lx + sx * side * (w / 2), 0, lz + sz * side * (w / 2), { ry: -ang });
          }
        }
      }
      b.finish(world);
      const belts = beltB.finish(world);
      belts.forEach(m => { m.userData.nopick = true; });
    }

    /* ---------------- supermarket, line-side stock, warehouse ---------------- */
    const SMV = {};
    const magGeo = rbox(0.36, 0.5, 0.95, 0.02);
    for (const [lane, z] of [['main', 10.6], ['power', 19.4]]) {
      const g = new T.Group(); g.position.set(73, 0, z); world.add(g);
      const b = builder();
      for (let lv = 0; lv <= 3; lv++) b.box(M.rackBeam, 5.2, 0.05, 1.3, 0, 0.04 + lv * 0.62, 0);
      for (const px of [-2.55, 2.55]) for (const pz of [-0.6, 0.6]) b.box(M.rackUp, 0.07, 2.1, 0.07, px, 0, pz);
      b.finish(g);
      const mag = new T.InstancedMesh(magGeo, M.graphite, 24); mag.castShadow = true; mag.count = 0; g.add(mag);
      tag(g, 'buf:SM:' + lane, (lane === 'main' ? 'Main' : 'Power') + '-board supermarket');
      SMV[lane] = { g, mag };
    }
    const LSV = {};
    const MATC = { pcbMain: M.pcb, pcbPower: M.pcb, reel: M.dark, panel: M.paintB, main: M.graphite, power: M.graphite, cover: M.dark, housing: M.paintB, display: M.dark, carton: M.carton };
    for (const b0 of Object.values(E.LS)) {
      const st = P.byId[b0.station], sp = L.STOPS[b0.id];
      const g = new T.Group();
      const dz = Math.sign(st.z - sp.z) || 1;
      g.position.set(sp.x, 0, sp.z + dz * 0.65); world.add(g);
      const b = builder(); b.box(M.alu, 0.95, 0.1, 0.75, 0, 0.12, 0); for (const [px, pz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) b.box(M.rubber, 0.07, 0.12, 0.07, px * 0.4, 0, pz * 0.3); b.finish(g);
      const fill = new T.Mesh(rbox(0.82, 1, 0.62, 0.02), MATC[b0.mat] || M.paintB); fill.castShadow = true; g.add(fill);
      const fr = new T.Mesh(frameGeo(1.4, 1.2, 0.12), new T.MeshBasicMaterial({ color: S.warn, side: T.DoubleSide, depthWrite: false })); fr.position.y = 0.03; fr.visible = false; fr.userData.nopick = true; g.add(fr);
      tag(g, 'buf:' + b0.id, `${b0.label} at ${st.name}`);
      LSV[b0.id] = { g, fill, fr, b: b0 };
    }
    const RMV = { bays: [] };
    {
      const rows = [4.5, 7.6, 13.2, 16.3, 22.4];
      const b = builder();
      for (const x of rows) {
        for (let i = 0; i <= 17; i++) { const z = 6 + i * 2.6; for (const dx of [-0.55, 0.55]) b.box(M.rackUp, 0.09, 4.4, 0.09, x + dx, 0, z); }
        for (const y of [0.15, 1.6, 3.05]) for (const dx of [-0.55, 0.55]) b.box(M.rackBeam, 0.1, 0.12, 17 * 2.6, x + dx, y, 6 + 17 * 1.3);
        for (let i = 0; i < 17; i++) for (const lv of [0, 1, 2]) RMV.bays.push({ x, z: 6 + i * 2.6 + 1.3, y: 0.27 + lv * 1.45, mat: null });
      }
      b.finish(world);
      const mats = Object.keys(E.RM);
      for (const bay of RMV.bays) {
        let best = null;
        for (const k of mats) { const sp = L.STOPS['RM:' + k]; const d = Math.abs(sp.z - bay.z) + (bay.x > 20 ? 0 : 3); if (!best || d < best.d) best = { d, k }; }
        bay.mat = best.k;
      }
      RMV.byMat = {}; for (const k of mats) RMV.byMat[k] = RMV.bays.filter(b2 => b2.mat === k).sort((a, b2) => (b2.x - a.x) || (a.y - b2.y));
      RMV.base = new T.InstancedMesh(bx(1.0, 0.14, 1.2), M.pallet, RMV.bays.length);
      RMV.load = new T.InstancedMesh(rbox(0.95, 1.0, 1.15, 0.03), std(0xffffff, { roughness: 0.7 }), RMV.bays.length);
      RMV.base.castShadow = RMV.load.castShadow = true; RMV.base.receiveShadow = RMV.load.receiveShadow = true;
      world.add(RMV.base, RMV.load);
      for (const k of mats) {
        const bays = RMV.byMat[k]; const zs = bays.map(b2 => b2.z);
        const g = new T.Group(); const z0 = Math.min(...zs) - 1.3, z1 = Math.max(...zs) + 1.3;
        const hit = new T.Mesh(bx(19.5, 4.4, z1 - z0), new T.MeshBasicMaterial({ visible: false })); hit.position.set(13.5, 2.2, (z0 + z1) / 2); g.add(hit);
        world.add(g); tag(g, 'buf:RM:' + k, E.RM[k].label + ' · raw-material warehouse');
      }
      RMV.color = new T.Color();
    }
    // finished-goods floor bays
    {
      const pts = [];
      for (const s of P.fgSlots) { const x = s.x, z = s.z; pts.push(x - 0.75, 0.02, z - 0.65, x + 0.75, 0.02, z - 0.65, x + 0.75, 0.02, z - 0.65, x + 0.75, 0.02, z + 0.65, x + 0.75, 0.02, z + 0.65, x - 0.75, 0.02, z + 0.65, x - 0.75, 0.02, z + 0.65, x - 0.75, 0.02, z - 0.65); }
      const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pts, 3));
      const l = new T.LineSegments(g, M.zoneLine); l.raycast = () => {}; world.add(l);
    }

    /* ---------------- utilities and the shop ---------------- */
    const UTV = new Map();
    for (const u of P.util.assets) {
      const g = new T.Group(); g.position.set(u.x, 0, u.z); world.add(g);
      const b = builder(); const v = { u, g };
      if (u.kind === 'transformer') { b.box(M.paintB, 2.4, 2.0, 1.6, 0, 0, 0, { r: 0.04 }); for (let i = 0; i < 9; i++) b.box(M.graphite, 0.04, 1.6, 2.0, -1.0 + i * 0.25, 0.2, 0); for (let i = 0; i < 3; i++) b.cyl(M.steel, 0.08, 0.1, 0.5, -0.6 + i * 0.6, 2.0, 0, { seg: 12 }); }
      if (u.kind === 'compressor') { b.box(M.paint, 2.6, 1.7, 1.5, 0, 0, 0, { r: 0.05 }); b.box(M.dark, 2.6, 0.08, 1.5, 0, 0, 0); b.cyl(M.paintB, 0.45, 0.45, 2.2, 0.2, 2.2, -0.2, { rz: Math.PI / 2, c: true }); for (let i = 0; i < 6; i++) b.box(M.graphite, 0.5, 0.02, 0.03, -0.9, 0.5 + i * 0.12, 0.76); g.add(hmiScreen(b, 0.7, 1.15, 0.76, 0, 0.26, 0.18)); }
      if (u.kind === 'chiller') {
        b.box(M.paint, 4.4, 1.9, 2.4, 0, 0, 0, { r: 0.06 }); b.box(M.dark, 4.4, 0.1, 2.4, 0, 0, 0);
        for (let i = 0; i < 12; i++) b.box(M.graphite, 0.02, 1.4, 2.42, -2.0 + i * 0.36, 0.3, 0);
        v.fans = [];
        for (let i = 0; i < 3; i++) {
          b.cyl(M.graphite, 0.62, 0.62, 0.12, -1.4 + i * 1.4, 1.9, 0, { seg: 28 });
          const fan = new T.Group(); fan.position.set(-1.4 + i * 1.4, 2.04, 0); g.add(fan);
          const bf = builder(); for (let k = 0; k < 4; k++) bf.box(M.dark, 0.95, 0.015, 0.16, 0, 0, 0, { ry: k * Math.PI / 4, c: true }); bf.cyl(M.steel, 0.08, 0.08, 0.05, 0, 0, 0, { c: true, seg: 12 }); bf.finish(fan, { cast: false });
          v.fans.push(fan);
        }
      }
      b.finish(g);
      tag(g, 'util:' + u.id, u.name);
      UTV.set(u.id, v);
    }
    {
      // pipe rack from utilities along the north wall (compressed air and chilled water)
      const b = builder();
      for (let x = 34; x < 100; x += 6) { b.box(M.graphite, 0.12, 4.2, 0.12, x, 0, 1.4); b.box(M.graphite, 0.12, 0.08, 1.2, x, 4.2, 1.4); }
      for (const [zz, r, mat] of [[1.1, 0.12, M.steel], [1.45, 0.16, M.paintB], [1.8, 0.1, M.alu]]) b.cyl(mat, r, r, 70, 66, 4.32 + r, zz, { rz: Math.PI / 2, c: true, seg: 14 });
      b.finish(world);
      const g = new T.Group(); world.add(g);
      const s2 = builder(); s2.box(M.paintB, 3.4, 0.9, 1.2, 92.5, 0, 5.2, { r: 0.03 }); s2.box(M.graphite, 3.4, 1.8, 0.6, 96.2, 0, 4.6, { r: 0.03 }); for (let i = 0; i < 4; i++) s2.box(M.steel, 3.3, 0.02, 0.55, 96.2, 0.4 + i * 0.4, 4.6); s2.finish(g);
      tag(g, 'zone:shop', 'Maintenance shop');
    }

    /* ---------------- moving things ---------------- */
    function ledMat() { return new T.MeshBasicMaterial({ color: new T.Color(0.3, 0.5, 1.8), toneMapped: false }); }
    const AGV = new Map();
    for (const a of P.agvs) {
      const g = new T.Group(); world.add(g);
      const b = builder();
      b.box(M.graphite, 1.12, 0.08, 0.74, 0, 0.02, 0, { r: 0.02 });
      b.box(M.agv, 1.08, 0.22, 0.7, 0, 0.1, 0, { r: 0.06 });
      b.box(M.stripe, 1.1, 0.03, 0.72, 0, 0.21, 0, { r: 0.01 });
      b.box(M.rubber, 0.06, 0.1, 0.6, 0.57, 0.06, 0, { r: 0.02 });
      b.finish(g);
      const led = new T.Mesh(rbox(1.115, 0.025, 0.725, 0.012), ledMat()); led.position.y = 0.12; g.add(led);
      const lid = new T.Group(); lid.position.set(0.38, 0.32, 0); g.add(lid);
      const bl = builder(); bl.cyl(M.dark, 0.07, 0.08, 0.06, 0, 0, 0, { seg: 18 }); bl.box(M.graphite, 0.05, 0.03, 0.12, 0, 0.06, 0); bl.finish(lid, { cast: false });
      const deck = new T.Group(); deck.position.y = 0.32; g.add(deck);
      const bd = builder(); bd.box(M.steel, 0.86, 0.03, 0.6, -0.06, 0, 0); bd.finish(deck);
      const load = new T.Mesh(rbox(0.86, 0.5, 0.58, 0.02), M.carton); load.position.set(-0.06, 0.28, 0); load.castShadow = true; deck.add(load);
      const fr = new T.Mesh(frameGeo(1.8, 1.4, 0.16), new T.MeshBasicMaterial({ color: S.bad, side: T.DoubleSide, depthWrite: false })); fr.position.y = 0.03; fr.visible = false; fr.userData.nopick = true; g.add(fr);
      tag(g, 'agv:' + a.id, a.id);
      AGV.set(a.id, { g, led, lid, deck, load, fr });
    }
    // people: articulated figures (legs and arms swing when walking)
    function person(role) {
      const g = new T.Group();
      const coverM = role === 'Technician' ? M.coverTech : M.cover;
      const hatM = role === 'Technician' ? M.hatTech : role === 'Line leader' ? M.hatLead : M.hatOp;
      const legs = [], arms = [];
      for (const s of [-1, 1]) {
        const leg = new T.Group(); leg.position.set(0, 0.86, s * 0.1); g.add(leg);
        const lm = new T.Mesh(new T.CapsuleGeometry(0.075, 0.68, 4, 8), coverM); lm.position.y = -0.42; lm.castShadow = true; leg.add(lm);
        const boot = new T.Mesh(bx(0.24, 0.08, 0.12), M.rubber); boot.position.set(0.05, -0.84, 0); leg.add(boot);
        legs.push(leg);
      }
      const torso = new T.Mesh(rbox(0.26, 0.56, 0.4, 0.08), coverM); torso.position.y = 1.16; torso.castShadow = true; g.add(torso);
      if (role !== 'Forklift') { const vest = new T.Mesh(rbox(0.28, 0.36, 0.42, 0.06), M.vest); vest.position.y = 1.2; g.add(vest); }
      for (const s of [-1, 1]) {
        const arm = new T.Group(); arm.position.set(0, 1.38, s * 0.24); g.add(arm);
        const am = new T.Mesh(new T.CapsuleGeometry(0.06, 0.5, 4, 8), coverM); am.position.y = -0.3; am.castShadow = true; arm.add(am);
        const hand = new T.Mesh(new T.SphereGeometry(0.055, 10, 8), M.skin); hand.position.y = -0.6; arm.add(hand);
        arms.push(arm);
      }
      const head = new T.Mesh(new T.SphereGeometry(0.12, 18, 14), M.skin); head.position.y = 1.58; head.castShadow = true; g.add(head);
      const hat = new T.Mesh(new T.SphereGeometry(0.135, 18, 10, 0, TAU, 0, Math.PI / 2), hatM); hat.position.y = 1.62; g.add(hat);
      const brim = new T.Mesh(cy(0.17, 0.17, 0.015, 18), hatM); brim.position.set(0.04, 1.625, 0); g.add(brim);
      return { g, legs, arms, phase: Math.random() * TAU };
    }
    const PEOPLE = new Map();
    for (const p of P.people) {
      if (p.role === 'Forklift') continue;
      const v = person(p.role); world.add(v.g); v.p = p; v.last = [p.x, p.z];
      tag(v.g, 'person:' + p.id, p.name);
      PEOPLE.set(p.id, v);
    }
    const FL = new Map();
    for (const f of P.forklifts) {
      const g = new T.Group(); world.add(g);
      const b = builder();
      b.box(M.cab, 1.35, 0.7, 0.98, -0.25, 0.2, 0, { r: 0.08 });
      b.box(M.graphite, 0.4, 0.62, 0.98, -0.85, 0.2, 0, { r: 0.08 });          // counterweight
      for (const [px, pz] of [[-0.75, -0.42], [-0.75, 0.42], [0.2, -0.42], [0.2, 0.42]]) b.box(M.graphite, 0.05, 1.25, 0.05, px, 0.9, pz);
      b.box(M.graphite, 1.0, 0.04, 0.9, -0.28, 2.13, 0);
      b.box(M.dark, 0.42, 0.08, 0.5, -0.4, 0.9, 0, { r: 0.03 }); b.box(M.dark, 0.08, 0.5, 0.5, -0.6, 0.9, 0, { r: 0.03 });
      for (const pz of [-0.32, 0.32]) b.box(M.steel, 0.08, 2.4, 0.08, 0.55, 0.0, pz);
      for (const [px, pz, r] of [[-0.62, -0.46, 0.22], [-0.62, 0.46, 0.22], [0.32, -0.46, 0.26], [0.32, 0.46, 0.26]]) b.cyl(M.rubber, r, r, 0.18, px, r, pz, { rx: Math.PI / 2, c: true, seg: 18 });
      b.finish(g);
      const car = new T.Group(); car.position.set(0.62, 0.08, 0); g.add(car);
      const bc = builder(); bc.box(M.graphite, 0.06, 0.62, 0.8, 0, 0, 0); for (const pz of [-0.25, 0.25]) bc.box(M.steel, 1.15, 0.05, 0.12, 0.58, 0, pz); bc.finish(car);
      const beacon = new T.Mesh(cy(0.06, 0.06, 0.08, 14), new T.MeshBasicMaterial({ color: new T.Color(2.4, 1.2, 0), toneMapped: false })); beacon.position.set(-0.6, 2.2, 0); g.add(beacon);
      const drv = person('Forklift'); drv.g.scale.setScalar(0.92); drv.g.position.set(-0.42, 0.32, 0); drv.legs.forEach(l => { l.rotation.z = 1.3; }); g.add(drv.g);
      tag(g, 'fl:' + f.id, f.id);
      FL.set(f.id, { g, car, beacon });
    }
    function truckModel() {
      const g = new T.Group();
      const b = builder();
      b.box(M.truck, 12, 2.7, 2.48, 0, 1.15, 0);
      b.box(M.graphite, 12, 0.22, 2.3, 0, 0.95, 0);
      b.box(M.cab, 2.3, 2.3, 2.42, 7.3, 0.7, 0, { r: 0.18 });
      b.box(M.glass, 0.04, 0.9, 2.1, 8.46, 1.95, 0);
      b.box(M.graphite, 0.1, 0.5, 2.0, 8.46, 0.9, 0);
      for (const px of [-4.6, -3.4, 6.9]) for (const pz of [-1.08, 1.08]) b.cyl(M.rubber, 0.5, 0.5, 0.34, px, 0.5, pz, { rx: Math.PI / 2, c: true, seg: 22 });
      b.finish(g);
      for (const pz of [-0.95, 0.95]) { const l = new T.Mesh(bx(0.03, 0.12, 0.28), new T.MeshBasicMaterial({ color: new T.Color(2.2, 2.1, 1.8), toneMapped: false })); l.position.set(8.48, 0.95, pz); g.add(l); }
      world.add(g); return g;
    }
    const TRK = new Map(), INB = new Map();

    /* ---------------- units (instanced) ---------------- */
    function inst(geo, mat, n, shadow = false) { const m = new T.InstancedMesh(geo, mat, n); m.castShadow = shadow; m.receiveShadow = false; m.count = 0; m.frustumCulled = false; world.add(m); m.userData.units = []; pick.push(m); return m; }
    const U = {
      pcb: inst(bx(0.24, 0.016, 0.17), M.pcb, 500),
      carrier: inst(rbox(1.42, 0.05, 0.88, 0.02), M.paintB, 200),
      tv: inst(rbox(1.24, 0.045, 0.72, 0.01), M.tv, 300, true),
      screen: inst(new T.PlaneGeometry(1.18, 0.66), M.screen, 120),
      tray: inst(bx(0.36, 0.03, 0.24), M.paintB, 250),
      phone: inst(rbox(0.16, 0.012, 0.078, 0.004), M.tv, 300),
      pscreen: inst(new T.PlaneGeometry(0.14, 0.066), M.phoneScreen, 120),
      cartonTv: inst(bx(1.42, 0.24, 0.86), M.carton, 120, true),
      cartonPh: inst(bx(0.22, 0.08, 0.12), M.carton, 200),
      palBase: inst(bx(1.2, 0.14, 1.0), M.pallet, 120, true),
      palLoad: inst(bx(1.18, 1, 0.98), M.carton, 120, true),
      palWrap: inst(bx(1.22, 1, 1.02), M.wrap, 120)
    };
    U.screen.userData.units = []; U.pscreen.userData.units = [];
    function put(mesh, u, x, y, z, yaw = 0, sx = 1, sy = 1, sz = 1, pitch = 0) {
      const i = mesh.count; if (i >= mesh.instanceMatrix.count) return;
      eul.set(pitch, yaw, 0, 'YXZ'); q.setFromEuler(eul); pos.set(x, y, z); scl.set(sx, sy, sz);
      mtx.compose(pos, q, scl); mesh.setMatrixAt(i, mtx); mesh.userData.units[i] = u; mesh.count = i + 1;
    }
    const polyAt = window.PlantEngine.polyAt;
    const unitPos = new Map();
    function drawUnit(u, x, y, z, yaw, onLine) {
      unitPos.set(u, [x, y, z]);
      if (u.type === 'main' || u.type === 'power') { put(U.pcb, u, x, y + 0.01, z, yaw); return; }
      if (u.type === 'tv') {
        if (u.packed) { put(U.cartonTv, u, x, y + 0.12, z, yaw); return; }
        if (onLine) put(U.carrier, u, x, y, z, yaw);
        put(U.tv, u, x, y + 0.05, z, yaw); return;
      }
      if (u.type === 'phone') {
        if (u.packed) { put(U.cartonPh, u, x, y + 0.04, z, yaw); return; }
        put(U.tray, u, x, y + 0.015, z, yaw); put(U.phone, u, x, y + 0.036, z, yaw);
      }
    }
    function drawUnits() {
      for (const k in U) U[k].count = 0;
      unitPos.clear();
      for (const sg of P.segs) {
        const y = SEGY(sg) - 0.06;
        for (const it of sg.items) { const p = polyAt(sg.path, it.s); drawUnit(it.u, p[0], y, p[1], -p[2], true); }
      }
      for (const s of P.stations) {
        if (!s.procs.length || s === E.BURN) continue;
        s.procs.forEach((pr, i) => {
          let x = s.x, y = s.kind === 'reflow' || s.line === 'L1' || s.line === 'L2' ? 0.86 : 0.84, z = s.z;
          if (s.kind === 'reflow') { const k = 1 - Math.max(0, pr.left) / (pr.tot || 1); x = s.x - s.w * 0.42 + s.w * 0.84 * k; }
          else if (s.slots > 1) x += (i - (s.procs.length - 1) / 2) * 0.9;
          if (s.kind === 'bench' || s.kind === 'repair') y = 0.92;
          if (s.kind === 'robot') y = 0.82;
          if (s.kind === 'fct' || s.kind === 'packer' || s.kind === 'qc' || s.kind === 'bond') y = s.kind === 'qc' ? 0.9 : s.h * (s.kind === 'bond' ? 0.5 : 0.46) + 0.02;
          drawUnit(pr.u, x, y, z, s.flip ? Math.PI : 0, s.kind !== 'bench');
        });
      }
      for (const r of E.BURN.rack) {
        if (!r.u) continue;
        unitPos.set(r.u, [r.x, 1.1, r.z]);
        if (r.kind === 'tv') { put(U.tv, r.u, r.x, 0.47 + 0.39, r.z, 0, 1, 1, 1, Math.PI / 2); put(U.screen, r.u, r.x, 0.47 + 0.39, r.z + 0.026, 0); }
        else { put(U.tray, r.u, r.x, 0.86, r.z, Math.PI / 2); put(U.phone, r.u, r.x, 0.88, r.z, Math.PI / 2); put(U.pscreen, r.u, r.x, 0.888, r.z, Math.PI / 2, 1, 1, 1, -Math.PI / 2); }
      }
      for (const p of P.pallets) {
        let x = p.x, z = p.z, y = 0, yaw = 0;
        if (p.where === 'fork') { const f = P.forklifts.find(f2 => f2.load === p); if (f) { x = f.x + Math.cos(f.h) * 1.2; z = f.z + Math.sin(f.h) * 1.2; y = 0.12 + f.lift * 0.6; yaw = -f.h; } }
        else if (p.where === 'truck' && p.truck) { if (!TRK.get(p.truck.id)) continue; const i = p.truck.pallets.indexOf(p); const d = p.truck.dock; x = d.x + (i % 2 ? 0.62 : -0.62); z = L.D + 1.6 + Math.floor(i / 2) * 1.1 + (1 - p.truck.k) * 30; y = 1.25; }
        else if (p.where === 'fg' && p.slot) { x = p.slot.x; z = p.slot.z; }
        const fill = p.units.length / p.cap;
        const h = p.product === 'tv' ? 0.25 * Math.ceil(p.units.length / 2) : 0.08 * Math.ceil(p.units.length / 10) * 1.6;
        put(U.palBase, p, x, y + 0.07, z, yaw);
        if (p.units.length) put(U.palLoad, p, x, y + 0.14 + h / 2, z, yaw, 1, h, 1);
        if (p.where !== 'build' && fill >= 1) put(U.palWrap, p, x, y + 0.14 + h / 2, z, yaw, 1, h + 0.02, 1);
        unitPos.set(p, [x, y + 0.6, z]);
      }
      for (const k in U) U[k].instanceMatrix.needsUpdate = true;
    }

    /* ---------------- selection reticle, routes, flow chevrons, energy columns, cause path ---------------- */
    const reticle = new T.Mesh(cornersGeo(1, 1, 0.35, 0.09), M.sel); reticle.position.y = 0.045; reticle.visible = false; reticle.renderOrder = 4; world.add(reticle);
    let retW = 0, retD = 0;
    function setReticle(info) {
      retW = info.w; retD = info.d;
      const w = info.w + 1.2, d = info.d + 1.2, len = Math.min(w, d) * 0.28 + 0.3, t = Math.max(0.12, Math.min(0.35, Math.max(w, d) * 0.03));
      reticle.geometry.dispose(); reticle.geometry = cornersGeo(w, d, len, t);
    }
    let routeLine = null;
    function ribbon(path, y, w) {
      // a flat ribbon along a polyline
      const pts = [];
      for (let i = 1; i < path.length; i++) {
        const a = path[i - 1], c = path[i]; const len = Math.hypot(c[0] - a[0], c[1] - a[1]); if (len < 0.01) continue;
        const gg = new T.PlaneGeometry(len, w); gg.rotateX(-Math.PI / 2); gg.rotateY(-Math.atan2(c[1] - a[1], c[0] - a[0])); gg.translate((a[0] + c[0]) / 2, y, (a[1] + c[1]) / 2); pts.push(gg);
      }
      return pts.length ? T.mergeGeometries(pts) : null;
    }
    const chev = (() => {
      const s = new T.Shape(); s.moveTo(0.35, 0); s.lineTo(-0.2, 0.22); s.lineTo(-0.08, 0); s.lineTo(-0.2, -0.22); s.lineTo(0.35, 0);
      const g = new T.ShapeGeometry(s); g.rotateX(-Math.PI / 2);
      const m = new T.InstancedMesh(g, new T.MeshBasicMaterial({ color: S.info, transparent: true, opacity: 0.95, side: T.DoubleSide, depthWrite: false, toneMapped: false }), 900);
      m.count = 0; m.frustumCulled = false; m.renderOrder = 3; world.add(m); return m;
    })();
    const ecol = (() => {
      const g = bx(0.5, 1, 0.5); g.translate(0, 0.5, 0);
      const m = new T.InstancedMesh(g, new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.82, toneMapped: false }), 80);
      m.instanceColor = new T.InstancedBufferAttribute(new Float32Array(80 * 3), 3);
      m.count = 0; m.frustumCulled = false; world.add(m); return m;
    })();
    // the cause of an incident drawn through the plant: arcs from the root cause to what it affects
    const chain = { g: new T.Group(), mat: new T.MeshBasicMaterial({ color: S.bad, map: TEX.dash, transparent: true, opacity: 0.95, depthWrite: false, toneMapped: false }), rings: [], pts: [] };
    world.add(chain.g);
    function showChain(refs, color) {
      chain.g.clear(); chain.rings = []; chain.pts = [];
      if (!refs || refs.length < 1) return [];
      chain.mat.color.set(color || S.bad);
      const pts = refs.map(r => { const i = refInfo(r); return i ? new T.Vector3(i.x, (i.h || 1) + 0.6, i.z) : null; }).filter(Boolean);
      chain.pts = pts;
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1], c = pts[i];
        const mid = a.clone().add(c).multiplyScalar(0.5); mid.y += Math.max(2.5, a.distanceTo(c) * 0.28);
        const curve = new T.QuadraticBezierCurve3(a, mid, c);
        const tube = new T.Mesh(new T.TubeGeometry(curve, 48, 0.07, 6, false), chain.mat); tube.userData.nopick = true;
        chain.g.add(tube);
      }
      pts.forEach((p, i) => {
        const r = new T.Mesh(new T.RingGeometry(i === 0 ? 0.55 : 0.4, i === 0 ? 0.75 : 0.52, 32), new T.MeshBasicMaterial({ color: chain.mat.color, transparent: true, opacity: 0.9, side: T.DoubleSide, depthWrite: false, toneMapped: false }));
        r.rotation.x = -Math.PI / 2; r.position.set(p.x, 0.06, p.z); r.userData.nopick = true; chain.g.add(r); chain.rings.push(r);
      });
      return pts;
    }

    /* ---------------- theme ---------------- */
    function applyTheme() {
      C = PAL[theme]; S = STATUS[theme];
      scene.background = new T.Color(C.bg);
      scene.fog = new T.Fog(C.fog, 320, 700);
      hemi.color.set(C.hemi[0]); hemi.groundColor.set(C.hemi[1]); hemi.intensity = C.hemi[2]; sun.intensity = C.sun;
      renderer.toneMappingExposure = C.exposure;
      const set = (k, c) => { if (M[k]) M[k].color.set(c); };
      set('floor', C.floor); if (M.slab) M.slab.color.set(C.floorTint); set('zone', C.zone); set('paint', C.paint); set('paintB', C.paintB); set('graphite', C.graphite); set('dark', C.dark); set('steel', C.steel); set('alu', C.alu);
      set('rubber', C.rubber); set('belt', C.belt); set('glass', C.glass); set('rackUp', C.rackUp); set('rackBeam', C.rackBeam); set('tv', C.tv); set('pallet', C.pallet); set('wrap', C.wrap);
      set('skin', C.skin); set('cover', C.cover); set('coverTech', C.coverTech); set('vest', C.vest); set('hatOp', C.hatOp); set('hatTech', C.hatTech); set('hatLead', C.hatLead);
      set('agv', C.agv); set('stripe', C.stripe); set('cab', C.cab); set('wall', C.wall); set('cap', C.cap); set('concrete', C.concrete); set('lineY', C.lineY); set('lineW', C.lineW);
      M.zoneLine.color.set(C.zoneLine); if (M.joint) M.joint.color.set(C.joint);
      M.truck.color.set(theme === 'dark' ? 0x9AA2AD : 0xffffff); M.carton.color.set(theme === 'dark' ? 0x9A8A78 : 0xffffff); M.pcb.color.set(theme === 'dark' ? 0xB0B8B4 : 0xffffff);
      for (const k in M) if (M[k].isMeshStandardMaterial) M[k].envMapIntensity = k === 'glass' ? 0.8 : C.env;
      for (const v of ST.values()) if (v.paint) { v.paint.color.set(C.paint); v.paint.envMapIntensity = C.env; }
      M.sel.color.set(S.info); M.route.color.set(S.info); chev.material.color.set(S.info);
      if (bloom) bloom.strength = C.bloom;
      if (gtao) gtao.blendIntensity = theme === 'dark' ? 0.7 : 1.0;
      if (outline) { outline.visibleEdgeColor.set(S.info); outline.hiddenEdgeColor.set(S.info).multiplyScalar(0.35); }
      world.traverse(o => { if (o.userData.stencil) o.material.opacity = theme === 'dark' ? 0.45 : 1; });
    }
    applyTheme();

    /* ---------------- per-frame view of the plant ---------------- */
    let overlay = 'status';
    const color = new T.Color(), cBody = new T.Color();
    const STATE_C = st => (st === 'down' ? S.bad : st === 'maint' ? S.maint : st === 'micro' || st === 'warn' || st === 'starved' || st === 'changeover' ? S.warn : null);
    let tAnim = 0;
    const lensOn = (mesh, on, c) => { const m = mesh.material; m.emissive.set(c); m.emissiveIntensity = on ? 9 : 0.02; m.color.set(on ? c : 0x2a2d33); };
    const progress = s => { const p = s.procs[0]; return p ? clamp(1 - Math.max(0, p.left) / (p.tot || 1), 0, 1) : 0; };
    function updateMachines(dt) {
      tAnim += dt;
      const speed = window.Twin ? Math.max(0.25, Math.min(4, window.Twin.speed || 1)) : 1;
      for (const v of ST.values()) {
        const s = v.s, st = s.state, on = st === 'run' || st === 'warn';
        if (v.andon) {
          lensOn(v.andon.gr, st === 'run', S.ok);
          lensOn(v.andon.a, st === 'warn' || st === 'micro' || st === 'starved' || st === 'changeover' || st === 'maint', st === 'maint' ? S.maint : S.warn);
          lensOn(v.andon.r, st === 'down' && (Math.sin(tAnim * 6) > -0.2), S.bad);
        }
        const sc = STATE_C(st);
        if (v.glow) {
          const want = sc && overlay !== 'energy' ? (st === 'down' ? 0.9 : 0.55) : 0;
          v.glow.material.opacity = lerp(v.glow.material.opacity, want * (st === 'down' ? 0.75 + 0.25 * Math.sin(tAnim * 4) : 1), Math.min(1, dt * 6));
          if (sc) v.glow.material.color.set(sc);
          v.frame.visible = !!sc && overlay !== 'energy'; if (sc) v.frame.material.color.set(sc);
        }
        if (v.paint) {
          if (overlay === 'quality' && (s.kind === 'aoi' || s.kind === 'fct' || s.kind === 'qc')) {
            const tot = s.counters.made + s.counters.bad, r = tot ? s.counters.bad / tot : 0;
            v.paint.emissive.set(r > 0.03 ? S.bad : S.warn); v.paint.emissiveIntensity = Math.min(0.6, r / 0.03 * 0.6);
          } else if (st === 'down') { v.paint.emissive.set(S.bad); v.paint.emissiveIntensity = 0.12; }
          else v.paint.emissiveIntensity = 0;
        }
        for (const scr of v.screens) scr.visible = st !== 'down' || Math.sin(tAnim * 3) > 0;
        const A = v.anim, p = progress(s), tt = tAnim * speed;
        if (A.elev) A.elev.position.y = lerp(A.elev.position.y, s.h * 0.6 + (on ? 0.12 * Math.sin(tt * 0.6 + s.x) : 0), Math.min(1, dt * 2));
        if (A.squeegee) A.squeegee.position.x = on ? Math.sin(p * Math.PI * 2) * s.w * 0.34 : A.squeegee.position.x * 0.95;
        if (A.scan) {
          const sx = on ? Math.sin(tt * 2.2 + s.x) * s.w * 0.32 : 0, sz = on ? ((Math.floor(tt * 1.6) % 5) / 4 - 0.5) * s.d * 0.6 : 0;
          A.scan.gy.position.x = lerp(A.scan.gy.position.x, sx, Math.min(1, dt * 6)); A.scan.head.position.z = lerp(A.scan.head.position.z, sz, Math.min(1, dt * 8));
          const k = on && s.procs.length ? 3 : 0.15; A.scan.ring.material.color.setRGB(k, k, k * 1.1);
        }
        if (A.gants) A.gants.forEach((gt, i) => {
          if (!on) return;
          const ph = tt * (2.4 + i * 0.3) + i * 1.7 + s.x;
          const cyc = (ph / TAU) % 1;   // pick at a feeder, travel, place on the board
          const toFeeder = cyc < 0.35, z = toFeeder ? (i ? 1 : -1) * s.d * 0.36 * Math.sin(cyc / 0.35 * Math.PI / 2) : (i ? 1 : -1) * s.d * 0.36 * Math.cos((cyc - 0.35) / 0.65 * Math.PI / 2);
          gt.beam.position.x = gt.gx + Math.sin(ph * 0.5) * s.w * 0.12;
          gt.head.position.z = z;
          gt.head.position.y = Math.abs(Math.sin(ph * 3)) > 0.92 ? -0.05 : 0;
        });
        if (A.uv) A.uv.material.color.setRGB(0.3, 0.4, on && s.procs.length && p > 0.6 ? 2.6 : 0.2);
        if (A.zones && s.sens.zones) A.zones.forEach((zm, i) => {
          const tz = s.sens.zones[i] || 20, k = clamp((tz - 120) / 140, 0, 1.2);
          zm.color.setRGB(0.25 + k * 5.2, 0.05 + k * k * 1.9, k * k * 0.25);
        });
        if (A.arm) {
          const a = A.arm, big = s.kind === 'palletizer';
          if (on) {
            const ph = s.procs.length ? p : (tt * 0.3) % 1;
            const k = Math.sin(ph * TAU);
            a.yaw.rotation.y = (big ? 1.4 : 1.1) * Math.sin(ph * TAU * 0.5 + s.x);
            a.sh.rotation.z = -0.5 + 0.35 * k; a.el.rotation.z = -1.1 + 0.45 * Math.cos(ph * TAU); a.wr.rotation.z = 0.4 * Math.sin(ph * TAU * 2);
          }
          if (s.safe) { a.yaw.rotation.y *= 0.98; }
        }
        if (A.lid) A.lid.position.y = lerp(A.lid.position.y, s.h * 0.46 + (on && s.procs.length && p > 0.1 && p < 0.9 ? -0.16 : 0.12), Math.min(1, dt * 4));
        if (A.qc) { const k = on && s.procs.length ? (Math.sin(tt * 18) > 0.6 ? 3.4 : 1.6) : 0.35; A.qc.forEach(m => m.color.setRGB(k, k, k)); }
        if (A.press) A.press.position.y = lerp(A.press.position.y, s.h - 0.2 - (on && s.procs.length && p > 0.4 && p < 0.7 ? 0.45 : 0), Math.min(1, dt * 6));
      }
      for (const lane of ['main', 'power']) {
        const m = SMV[lane].mag, n = Math.min(24, Math.ceil(E.SM[lane].items.length / 10));
        m.count = n;
        for (let i = 0; i < n; i++) { const lv = Math.floor(i / 8), k = i % 8; mtx.makeTranslation(-2.2 + k * 0.62, 0.32 + lv * 0.62, 0); m.setMatrixAt(i, mtx); }
        m.instanceMatrix.needsUpdate = true;
      }
      for (const v of Object.values(LSV)) {
        const b0 = v.b, lvl = E.level(b0), k = Math.max(0.02, Math.min(1, lvl / b0.cap));
        v.fill.scale.y = k * 0.9; v.fill.position.y = 0.22 + k * 0.45;
        const late = lvl <= 0 ? S.bad : (lvl <= b0.rop && (!b0.mission || !b0.mission.agv || (b0.mission.agv && b0.mission.agv.fault))) ? S.warn : null;
        v.fr.visible = !!late && overlay !== 'energy'; if (late) v.fr.material.color.set(late);
      }
      let n = 0;
      for (const k in RMV.byMat) {
        const bays = RMV.byMat[k], b0 = E.RM[k];
        const filled = Math.round(Math.min(1, b0.qty / b0.cap) * bays.length);
        for (let i = 0; i < filled; i++) {
          const bay = bays[i];
          mtx.makeTranslation(bay.x, bay.y + 0.07, bay.z); RMV.base.setMatrixAt(n, mtx);
          const h = k === 'panel' ? 1.15 : k === 'reel' ? 0.8 : 1.0;
          mtx.compose(pos.set(bay.x, bay.y + 0.14 + h / 2, bay.z), q.identity(), scl.set(1, h, 1)); RMV.load.setMatrixAt(n, mtx);
          RMV.load.setColorAt(n, RMV.color.set(k === 'carton' ? C.carton : k === 'pcbMain' || k === 'pcbPower' ? C.pcb : k === 'reel' || k === 'display' || k === 'cover' ? C.graphite : C.paintB));
          n++;
        }
      }
      RMV.base.count = RMV.load.count = n; RMV.base.instanceMatrix.needsUpdate = RMV.load.instanceMatrix.needsUpdate = true;
      if (RMV.load.instanceColor) RMV.load.instanceColor.needsUpdate = true;
      for (const v of UTV.values()) if (v.fans) { const sp = clamp((v.u.kw || 0) / 90, 0.1, 2.2); v.fans.forEach((f, i) => { f.rotation.y += dt * sp * (8 + i); }); }
      // energy overlay: a column over each machine, height and colour from its draw
      ecol.count = 0;
      if (overlay === 'energy') {
        const kwMax = Math.max(...P.stations.map(s => s.kwNow || 0), 1);
        let i = 0;
        for (const s of P.stations) {
          if (!s.kwNow || i >= 80) continue;
          const k = s.kwNow / kwMax, h = 0.4 + k * 6;
          mtx.compose(pos.set(s.x, s.h + 0.2, s.z), q.identity(), scl.set(Math.max(0.6, Math.min(2.4, s.w * 0.4)), h, Math.max(0.6, Math.min(2.4, s.d * 0.4)))); ecol.setMatrixAt(i, mtx);
          color.set(theme === 'dark' ? 0x2189FF : 0x1428A0).lerp(cBody.set(0xFFB020), Math.max(0, k - 0.6) / 0.4).multiplyScalar(theme === 'dark' ? 1.6 : 1.1);
          ecol.setColorAt(i, color); i++;
        }
        for (const u of P.util.assets) { if (i >= 80 || !u.kw) continue; const k = u.kw / 150; mtx.compose(pos.set(u.x, 2.3, u.z), q.identity(), scl.set(1.6, 0.4 + k * 6, 1.6)); ecol.setMatrixAt(i, mtx); color.set(theme === 'dark' ? 0x2189FF : 0x1428A0).lerp(cBody.set(0xFFB020), Math.max(0, k - 0.6)); ecol.setColorAt(i, color); i++; }
        ecol.count = i; ecol.instanceMatrix.needsUpdate = true; ecol.instanceColor.needsUpdate = true;
      }
      // the cause path flows from the root cause outwards
      if (chain.g.children.length) { TEX.dash.offset.x -= dt * 0.9; TEX.dash.repeat.x = 12; chain.rings.forEach((r, i) => { const k = 1 + 0.18 * Math.sin(tAnim * 3 - i * 0.7); r.scale.set(k, k, k); }); }
      // belts run
      TEX.belt.offset.y -= dt * 0.35 * speed;
    }
    function updateMovers(dt) {
      const speed = window.Twin ? Math.max(0.25, Math.min(4, window.Twin.speed || 1)) : 1;
      for (const a of P.agvs) {
        const v = AGV.get(a.id);
        v.g.position.set(a.x, 0, a.z); v.g.rotation.y = -a.h;
        v.load.visible = !!a.load;
        if (a.load) v.load.material = MATC[a.load.mat] || M.carton;
        v.deck.position.y = lerp(v.deck.position.y, a.load ? 0.36 : 0.32, Math.min(1, dt * 3));
        v.lid.rotation.y += dt * (a.fault ? 0 : 9);
        const c = a.fault ? [6, 0.4, 0.4] : a.state === 'charging' ? [5, 2.6, 0.2] : a.path ? [0.5, 1.6, 9] : [0.4, 2.8, 1.1];
        const pulse = a.fault ? (Math.sin(tAnim * 8) > 0 ? 1 : 0.2) : 1;
        v.led.material.color.setRGB(c[0] * pulse, c[1] * pulse, c[2] * pulse);
        v.fr.visible = !!a.fault; v.fr.material.color.set(S.bad);
      }
      for (const f of P.forklifts) {
        const v = FL.get(f.id); v.g.position.set(f.x, 0, f.z); v.g.rotation.y = -f.h;
        v.car.position.y = 0.08 + f.lift * 0.62;
        const blink = f.path && Math.sin(tAnim * 9) > 0;
        v.beacon.material.color.setRGB(blink ? 5 : 0.3, blink ? 2.4 : 0.15, 0);
      }
      for (const tr of P.trucks) {
        let v = TRK.get(tr.id);
        if (!v) { v = { g: truckModel() }; TRK.set(tr.id, v); tag(v.g, 'truck:' + tr.id, tr.id); }
        v.g.rotation.y = Math.PI / 2;
        v.g.position.set(tr.dock.x, 0, L.D + 0.9 + 6 + (1 - tr.k) * 30);
      }
      for (const [id, v] of TRK) if (!P.trucks.some(t => t.id === id)) { world.remove(v.g); TRK.delete(id); }
      for (const tr of P.inbound) {
        let v = INB.get(tr.id);
        const show = tr.state === 'unloading';
        if (show && !v) { v = { g: truckModel() }; INB.set(tr.id, v); tag(v.g, 'inbound:' + tr.id, tr.id); }
        if (!show && v) { world.remove(v.g); INB.delete(tr.id); continue; }
        if (v) { v.g.rotation.y = 0; const k = Math.min(1, tr.k * 20); v.g.position.set(-0.9 - 8.6 - (1 - k) * 25, 0, tr.door === 0 ? 14 : 30); }
      }
      for (const v of PEOPLE.values()) {
        const p = v.p;
        const dx = p.x - v.last[0], dz = p.z - v.last[1], moved = Math.hypot(dx, dz);
        v.last = [p.x, p.z];
        v.g.position.set(p.x, 0, p.z);
        if (moved > 1e-4) v.g.rotation.y = lerp(v.g.rotation.y, -Math.atan2(dz, dx), 0.3);
        else if (p.h !== undefined && !p.path) v.g.rotation.y = lerp(v.g.rotation.y, -(p.h || -Math.PI / 2), 0.05);
        const walking = moved > 1e-4 || !!p.path;
        if (walking) v.phase += moved * 5.5;
        else v.phase += dt * 1.6 * speed;
        const sw = walking ? Math.sin(v.phase) * 0.55 : 0;
        v.legs[0].rotation.z = sw; v.legs[1].rotation.z = -sw;
        if (walking) { v.arms[0].rotation.z = -sw * 0.8; v.arms[1].rotation.z = sw * 0.8; v.arms[0].rotation.x = v.arms[1].rotation.x = 0; }
        else { const w = Math.sin(v.phase) * 0.18; v.arms[0].rotation.z = -0.7 + w; v.arms[1].rotation.z = -0.6 - w; }
        v.g.position.y = walking ? Math.abs(Math.sin(v.phase)) * 0.03 : 0;
      }
    }

    function updateFlow() {
      chev.count = 0;
      if (overlay !== 'flow') return;
      let i = 0;
      const add = (path, y, speed, spacing) => {
        let len = 0; for (let k = 1; k < path.length; k++) len += Math.hypot(path[k][0] - path[k - 1][0], path[k][1] - path[k - 1][1]);
        const off = (tAnim * speed) % spacing;
        for (let s = off; s < len && i < 900; s += spacing) { const p = polyAt(path, s); eul.set(0, -p[2], 0); q.setFromEuler(eul); mtx.compose(pos.set(p[0], y, p[1]), q, scl.set(1, 1, 1)); chev.setMatrixAt(i++, mtx); }
      };
      for (const sg of P.segs) if (sg.items.length) add(sg.path, SEGY(sg) + 0.06, 1.2, 1.4);
      for (const a of P.agvs) if (a.path) add(a.path, 0.06, 1.6, 2.2);
      for (const f of P.forklifts) if (f.path) add(f.path, 0.06, 1.6, 2.2);
      chev.count = i; chev.instanceMatrix.needsUpdate = true;
    }

    /* ---------------- selection ---------------- */
    let selRef = null, follow = false;
    function refInfo(ref) {
      if (!ref) return null;
      const [k, id] = ref.split(/:(.+)/);
      if (k === 'st') { const s = P.byId[id]; return s && { x: s.x, y: 0, z: s.z, w: s.kind === 'burnin' ? 20 : s.w, d: s.kind === 'burnin' ? 18 : s.d, h: s.kind === 'burnin' ? 1.6 : s.h, r: Math.max(s.w, s.d) }; }
      if (k === 'line') { const l = P.lines[id]; if (!l) return null; const xs = l.stations.map(s => s.x), zs = l.stations.map(s => s.z); const x0 = Math.min(...xs), x1 = Math.max(...xs), z0 = Math.min(...zs), z1 = Math.max(...zs); return { x: (x0 + x1) / 2, y: 0, z: (z0 + z1) / 2, w: x1 - x0 + 4, d: Math.max(4, z1 - z0 + 4), h: 1.6, r: (x1 - x0) / 2 + 4 }; }
      if (k === 'agv') { const a = P.agvs.find(a2 => a2.id === id); return a && { x: a.x, y: 0, z: a.z, w: 1.3, d: 1.0, h: 0.8, r: 2, moving: true }; }
      if (k === 'fl') { const f = P.forklifts.find(f2 => f2.id === id); return f && { x: f.x, y: 0, z: f.z, w: 2.2, d: 1.2, h: 2.2, r: 2.5, moving: true }; }
      if (k === 'person') { const p = P.people.find(p2 => p2.id === id); return p && { x: p.x, y: 0, z: p.z, w: 0.8, d: 0.8, h: 1.7, r: 1.5, moving: true }; }
      if (k === 'truck') { const t = P.trucks.find(t2 => t2.id === id); return t && { x: t.dock.x, y: 0, z: L.D + 7 + (1 - t.k) * 30, w: 3, d: 15, h: 3.5, r: 8, moving: true }; }
      if (k === 'inbound') { const t = P.inbound.find(t2 => t2.id === id); return t && { x: -9, y: 0, z: t.door === 0 ? 14 : 30, w: 15, d: 3, h: 3.5, r: 8 }; }
      if (k === 'buf') {
        if (id.startsWith('SM:')) return { x: 73, y: 0, z: id.endsWith('main') ? 10.6 : 19.4, w: 5.6, d: 1.6, h: 2.1, r: 4 };
        if (id.startsWith('RM:')) { const bays = RMV.byMat[id.slice(3)]; if (!bays) return null; const zs = bays.map(b2 => b2.z); const z0 = Math.min(...zs), z1 = Math.max(...zs); return { x: 13.5, y: 0, z: (z0 + z1) / 2, w: 20, d: z1 - z0 + 2.6, h: 4.4, r: 12 }; }
        const v = LSV[id]; return v && { x: v.g.position.x, y: 0, z: v.g.position.z, w: 1.4, d: 1.2, h: 1.1, r: 2 };
      }
      if (k === 'util') { const u = P.util.assets.find(u2 => u2.id === id); return u && { x: u.x, y: 0, z: u.z, w: 4.6, d: 2.8, h: 2.2, r: 4 }; }
      if (k === 'unit') { const u = E.findUnit(id); const p = u && unitPos.get(u); if (p) return { x: p[0], y: p[1], z: p[2], w: 1.6, d: 1.2, h: 0.6, r: 1.8, moving: true }; return u ? locOf(u) : null; }
      if (k === 'pal') { const p = P.pallets.find(p2 => p2.id === id); const at = p && unitPos.get(p); return at && { x: at[0], y: 0, z: at[2], w: 1.6, d: 1.4, h: 1.6, r: 2, moving: true }; }
      if (k === 'zone') { const z = L.ZONES.find(z2 => z2.id === id); return z && { x: (z.x0 + z.x1) / 2, y: 0, z: (z.z0 + z.z1) / 2, w: z.x1 - z.x0, d: z.z1 - z.z0, h: 1, r: Math.max(z.x1 - z.x0, z.z1 - z.z0) * 0.6, zone: z }; }
      if (k === 'order') { const o = P.orders.find(o2 => o2.id === id); if (o && o.truck) return refInfo('truck:' + o.truck.id); return { x: 52, y: 0, z: 74, w: 30, d: 8, h: 1.5, r: 18 }; }
      return null;
    }
    function locOf(u) {
      const l = u.loc; if (!l) return null;
      if (l.k === 'sm') return refInfo('buf:SM:' + (u.type === 'main' ? 'main' : 'power'));
      if (l.k === 'ls') return refInfo('buf:' + l.b.id);
      if (l.k === 'agv') return refInfo('agv:' + l.a.id);
      if (l.k === 'pallet') return refInfo('pal:' + l.p.id);
      if (l.k === 'repair') return refInfo('st:' + l.st.id);
      return null;
    }
    function objFor(ref) {
      if (!ref) return null;
      const [k, id] = ref.split(/:(.+)/);
      if (k === 'st') { const v = ST.get(id); return v && v.g; }
      if (k === 'agv') { const v = AGV.get(id); return v && v.g; }
      if (k === 'fl') { const v = FL.get(id); return v && v.g; }
      if (k === 'person') { const v = PEOPLE.get(id); return v && v.g; }
      if (k === 'util') { const v = UTV.get(id); return v && v.g; }
      if (k === 'truck') { const v = TRK.get(id); return v && v.g; }
      if (k === 'buf' && LSV[id]) return LSV[id].g;
      if (k === 'buf' && id.startsWith('SM:')) return SMV[id.endsWith('main') ? 'main' : 'power'].g;
      return null;
    }
    function select(ref, o2 = {}) {
      selRef = ref; follow = !!o2.follow;
      const info = refInfo(ref);
      reticle.visible = !!info;
      if (info) { setReticle(info); if (o2.fly !== false) flyTo(info); }
      if (outline) { const ob = objFor(ref); outline.selectedObjects = ob ? [ob] : []; }
      if (routeLine) { world.remove(routeLine); routeLine.geometry.dispose(); routeLine = null; }
      emit('select', ref);
    }
    function updateSelection() {
      if (!selRef) return;
      const info = refInfo(selRef);
      if (!info) { reticle.visible = false; return; }
      reticle.visible = true; reticle.position.set(info.x, 0.045, info.z);
      if (Math.abs(info.w - retW) > 0.01 || Math.abs(info.d - retD) > 0.01) setReticle(info);
      const [k, id] = selRef.split(/:(.+)/);
      const mover = k === 'agv' ? P.agvs.find(a => a.id === id) : k === 'fl' ? P.forklifts.find(f => f.id === id) : null;
      if (mover && mover.path && tAnim - (routeLine ? routeLine.userData.t : -1) > 0.25) {
        if (routeLine) { world.remove(routeLine); routeLine.geometry.dispose(); routeLine = null; }
        const g = ribbon([[mover.x, mover.z]].concat(mover.path.slice(1)), 0.03, 0.22);
        if (g) { routeLine = new T.Mesh(g, M.route); routeLine.renderOrder = 3; routeLine.userData.t = tAnim; world.add(routeLine); }
      } else if ((!mover || !mover.path) && routeLine) { world.remove(routeLine); routeLine.geometry.dispose(); routeLine = null; }
      if (outline && !outline.selectedObjects.length) { const ob = objFor(selRef); if (ob) outline.selectedObjects = [ob]; }
      if (follow && info.moving) {
        const d = new T.Vector3(info.x, 0, info.z).sub(controls.target);
        controls.target.add(d.multiplyScalar(0.12)); camera.position.add(d);
      }
    }

    /* ---------------- camera moves: eased arcs ---------------- */
    let fly = null;
    function flyTo(info, dist) {
      const r = dist || Math.max(14, (info.r || 4) * 4);
      const to = new T.Vector3(info.x, (info.y || 0) * 0.5 + (info.h || 1) * 0.3, info.z);
      const dir = camera.position.clone().sub(controls.target).normalize();
      if (dir.y < 0.42) { dir.y = 0.5; dir.normalize(); }
      if (dir.y > 0.86) { dir.y = 0.74; dir.normalize(); }
      const toPos = to.clone().add(dir.multiplyScalar(r));
      fly = { t: 0, dur: 1.25, p0: camera.position.clone(), t0: controls.target.clone(), p1: toPos, t1: to };
    }
    function view(v) {
      if (v === 'overview') { fly = { t: 0, dur: 1.4, p0: camera.position.clone(), t0: controls.target.clone(), p1: new T.Vector3(CENTER.x + 26, 78, CENTER.z + 92), t1: CENTER.clone() }; return; }
      const to = new T.Vector3(v[0], 0, v[1]);
      const p1 = to.clone().add(new T.Vector3(v[2] * 0.28, v[2] * 0.66, v[2] * 0.74));
      fly = { t: 0, dur: 1.3, p0: camera.position.clone(), t0: controls.target.clone(), p1, t1: to };
    }
    function stepFly(dt) {
      if (!fly) return;
      fly.t = Math.min(1, fly.t + dt / fly.dur);
      const k = ease(fly.t);
      camera.position.lerpVectors(fly.p0, fly.p1, k); controls.target.lerpVectors(fly.t0, fly.t1, k);
      // lift the camera through the middle of a long move, so it arcs over the plant instead of sliding through it
      const span = fly.p0.distanceTo(fly.p1);
      camera.position.y += Math.sin(fly.t * Math.PI) * Math.min(18, span * 0.12);
      if (fly.t >= 1) fly = null;
    }
    controls.addEventListener('start', () => { fly = null; if (follow) follow = false; idle = 0; });
    let cinematic = false, idle = 0;

    /* ---------------- picking ---------------- */
    const ray = new T.Raycaster(), ndc = new T.Vector2();
    function hit(cx, cy) {
      const r = canvas.getBoundingClientRect();
      ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      const hits = ray.intersectObjects(pick, false);
      for (const h of hits) {
        const o = h.object;
        if (o.isInstancedMesh) {
          const u = o.userData.units && o.userData.units[h.instanceId]; if (!u) continue;
          if (u.sn) return { ref: 'unit:' + u.sn, name: `${u.type === 'tv' ? 'TV' : u.type === 'phone' ? 'Phone' : u.type === 'main' ? 'Main board' : 'Power board'} ${u.sn}` };
          if (u.id && String(u.id).startsWith('PAL')) return { ref: 'pal:' + u.id, name: `Pallet ${u.id}` };
          continue;
        }
        if (o.userData.ref) return { ref: o.userData.ref, name: o.userData.name };
      }
      return null;
    }
    let down = null;
    canvas.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY }; idle = 0; });
    canvas.addEventListener('pointerup', e => {
      if (!down) return;
      const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
      down = null;
      if (moved > 6) return;
      const h = hit(e.clientX, e.clientY);
      if (h) select(h.ref); else { selRef = null; reticle.visible = false; if (outline) outline.selectedObjects = []; emit('select', null); }
    });
    let hoverT = 0;
    canvas.addEventListener('pointermove', e => {
      if (e.pointerType !== 'mouse') return;
      const now = performance.now(); if (now - hoverT < 60) return; hoverT = now;
      const h = hit(e.clientX, e.clientY);
      canvas.style.cursor = h ? 'pointer' : '';
      emit('hover', h ? { name: h.name, ref: h.ref, x: e.clientX, y: e.clientY } : null);
    });
    canvas.addEventListener('pointerleave', () => emit('hover', null));

    /* ---------------- labels (HTML, projected) ---------------- */
    const labels = [];
    const tmp = new T.Vector3();
    function label(el, getPos, tier) { labels.push({ el, getPos, tier }); }
    function projectLabels(w, h) {
      const dist = camera.position.distanceTo(controls.target);
      for (const Lb of labels) {
        const p = Lb.getPos();
        if (!p) { if (Lb.shown !== false) { Lb.el.style.display = 'none'; Lb.shown = false; } continue; }
        tmp.set(p[0], p[1], p[2]).project(camera);
        const vis = tmp.z < 1 && tmp.x > -1.1 && tmp.x < 1.1 && tmp.y > -1.1 && tmp.y < 1.1 && (Lb.tier === 0 || (Lb.tier === 1 && dist < 170) || (Lb.tier === 2 && dist < 60) || (typeof Lb.tier === 'function' && Lb.tier(dist)));
        if (!vis) { if (Lb.shown !== false) { Lb.el.style.display = 'none'; Lb.shown = false; } continue; }
        if (Lb.shown !== true) { Lb.el.style.display = ''; Lb.shown = true; }
        Lb.el.style.transform = `translate3d(${((tmp.x + 1) / 2 * w).toFixed(1)}px, ${((1 - tmp.y) / 2 * h).toFixed(1)}px, 0)`;
      }
    }

    /* ---------------- loop, adaptive quality ---------------- */
    let W = 0, H = 0;
    function resize() {
      const r = canvas.parentElement.getBoundingClientRect();
      W = Math.max(1, r.width); H = Math.max(1, r.height);
      renderer.setSize(W, H, false); camera.aspect = W / H; camera.updateProjectionMatrix();
      if (composer) {
        composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(W, H);
        const pr = renderer.getPixelRatio();
        if (gtao) gtao.setSize(W * pr, H * pr);
        if (bloom) bloom.setSize(W * pr / 2, H * pr / 2);
        if (outline) outline.setSize(W * pr, H * pr);
        if (smaa) smaa.setSize(W * pr, H * pr);
      }
    }
    new ResizeObserver(resize).observe(canvas.parentElement);
    buildComposer(); resize();
    let last = performance.now(), running = true, frames = 0, slow = 0, avg = 16;
    function setQuality(qv) {
      if (qv === quality) return;
      quality = qv;
      if (quality === 'low') { renderer.setPixelRatio(Math.min(1.25, window.devicePixelRatio || 1)); }
      else renderer.setPixelRatio(dprMax);
      buildComposer();
      emit('quality', quality);
    }
    function frame(now) {
      if (!running) return;
      const dt = Math.min(0.1, (now - last) / 1000); last = now;
      if (opts.tick) opts.tick(dt);
      stepFly(dt);
      if (cinematic && !fly && !selRef) { idle += dt; if (idle > 6) { const a = dt * 0.05; const off = camera.position.clone().sub(controls.target); off.applyAxisAngle(new T.Vector3(0, 1, 0), a); camera.position.copy(controls.target).add(off); } }
      updateMachines(dt); updateMovers(dt); drawUnits(); updateFlow(); updateSelection();
      controls.update();
      if (composer) composer.render(dt); else renderer.render(scene, camera);
      projectLabels(W, H);
      frames++;
      // adaptive quality: step down when frames stay slow
      avg = avg * 0.95 + (dt * 1000) * 0.05;
      if (!document.hidden && frames > 120 && !opts.fixedQuality) {
        if (avg > 34) slow += dt; else slow = Math.max(0, slow - dt * 0.5);
        if (slow > 3) { slow = 0; if (quality === 'high') setQuality('medium'); else if (quality === 'medium') setQuality('low'); }
      }
      emit('frame', dt);
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
    if (document.fonts) document.fonts.ready.then(() => emit('ready'));

    return {
      THREE: T, scene, camera, controls, renderer,
      on(fn) { listeners.push(fn); },
      select, view, flyTo: info => flyTo(info), refInfo, label, showChain,
      setOverlay(m) { overlay = m; emit('overlay', m); },
      get overlay() { return overlay; },
      setTheme(t) { theme = t === 'dark' ? 'dark' : 'light'; applyTheme(); },
      setFollow(v) { follow = v; },
      get follow() { return follow; },
      get selected() { return selRef; },
      setQuality, get quality() { return quality; },
      get passes() { return { gtao, bloom, outline, smaa, composer }; },
      setCinematic(v) { cinematic = !!v; idle = 0; }, get cinematic() { return cinematic; },
      unitPos, frames: () => frames,
      stop() { running = false; }
    };
  }

  window.PlantScene = { create };
})();
