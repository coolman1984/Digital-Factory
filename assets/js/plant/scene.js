/* Digital Factory — the 3D view of the Plant EG-01 enterprise twin (three.js r170, vendored as window.THREE).
   A physically lit plant: image-based lighting, soft shadows, ambient occlusion and bloom on emissive lamps and screens.
   Machines are modelled procedurally per kind (mounters with feeder banks, injection machines with clamp, barrel and
   hopper, presses with flywheels, coating tunnels with an overhead chain, six-axis robots, aging racks with lit TVs)
   inside a steel building with trusses, high-bay lights, cable trays and line signs. Status colour appears only for
   an abnormal state (ISA-101). Data between the floor, GMES, SAP and the offices travels as packets on arcs.
   Navigation: orbit, fly-to, first-person walk on the floor with collision, a cinematic fly-through, CCTV feeds and an
   x-ray view. Static geometry is merged by material; everything that moves is instanced. The page calls render(dt). */
(function () {
  'use strict';
  const T = window.THREE;

  const PAL = {
    light: {
      bg: 0xD6DCE3, fog: 0xD6DCE3, floor: 0x969DA6, floorLine: 0xEEF1F4, zone: 0x8A919B, paint: 0xE4E8EC, paint2: 0xBFC6CF, frame: 0x313843,
      dark: 0x23272E, steel: 0xA9B1BC, alu: 0xC8CED6, rubber: 0x2B2F36, glass: 0xC9D8E6, rack: 0x5E6B7C, beam: 0x8A95A3,
      pcb: 0x2F6B4F, tv: 0x111317, carton: 0xC9A37A, pallet: 0xB98F60, tray: 0xCDD3DA, person: 0x2E3A4F, skin: 0xC8A58A, tech: 0x1565D8, office: 0x5C6778,
      agv: 0xF2F4F6, stripe: 0x1428A0, truck: 0xF0F2F4, cab: 0x4A5260, mag: 0x5C6573, plastic: 0x24282F, desk: 0xD9D4CC, carpet: 0x737C88,
      wall: 0xE9ECEF, pkt: 0x2D5BFF, net: 0x1428A0, env: 0.38, hemi: [0xFFFFFF, 0x8A929D, 0.55], sun: 2.6, amb: 0.04, exp: 0.95, bloom: 0.3, fixture: 2.2
    },
    dark: {
      bg: 0x07090D, fog: 0x07090D, floor: 0x24282F, floorLine: 0x59616D, zone: 0x2C3139, paint: 0x7D8590, paint2: 0x5B636E, frame: 0x1A1D23,
      dark: 0x0F1115, steel: 0x7D8794, alu: 0x9AA3AE, rubber: 0x1A1D22, glass: 0x4E6075, rack: 0x3E4856, beam: 0x3C4450,
      pcb: 0x2E7A57, tv: 0x07080A, carton: 0x9E7E5A, pallet: 0x8A6A46, tray: 0x4A515C, person: 0x8C9AB0, skin: 0xC8A58A, tech: 0x4DA3FF, office: 0x7A869A,
      agv: 0xCED4DB, stripe: 0x2189FF, truck: 0xBFC6CE, cab: 0x2F353F, mag: 0x3E4652, plastic: 0x15181D, desk: 0x3A3F48, carpet: 0x1C2027,
      wall: 0x2A2F37, pkt: 0x5AA8FF, net: 0x2189FF, env: 0.22, hemi: [0x8EA0BA, 0x07090D, 0.55], sun: 0.55, amb: 0.04, exp: 1.05, bloom: 0.7, fixture: 4.5
    }
  };
  const STATUS = {
    light: { ok: 0x0F9D58, warn: 0xE08A00, bad: 0xE5383B, maint: 0x3B4CCA, info: 0x2189FF, off: 0x8A929E },
    dark: { ok: 0x34C77B, warn: 0xFFB020, bad: 0xFF5A5F, maint: 0x8C9BFF, info: 0x4DA3FF, off: 0x3A414D }
  };
  const LOADC = { OC: 0x3C4350, BLU: 0xD9DDE3, SMPS: 0x8A94A3, PCB: 0x5B7F6A, CTN: 0xC9A37A, ACC: 0xB8BEC8, RESIN: 0xE8E4DA, EPS: 0xF2F2EE, COIL: 0x9AA3AE, PWD: 0x4A4F57, BRK: 0x7D8590, BC: 0x2B3038, STD: 0x3A3F48, CHS: 0x5C636E, PBA: 0x6A7382, CUS: 0xF4F4F0 };
  const ROOMS = [['sales', 0, 0], ['planning', 1, 0], ['scm', 2, 0], ['finance', 3, 0], ['hr', 4, 0], ['pe', 0, 1], ['bom', 1, 1], ['quality', 2, 1], ['svc', 3, 1], ['it', 4, 1]];
  const RX0 = 208, RW = 10.6;
  const roomBox = (c, r) => ({ x0: RX0 + c * RW, x1: RX0 + (c + 1) * RW, z0: r ? 21 : 3, z1: r ? 36 : 17 });
  const SYSPOS = { 'SAP-SD': [251.4, 27.6], 'SAP-PP': [251.4, 27.6], 'SAP-MM': [251.4, 27.6], 'SAP-QM': [251.4, 27.6], 'SAP-FICO': [251.4, 27.6], 'SAP-PM': [251.4, 27.6], GMES: [255.6, 27.6], WMS: [259.6, 27.6], PLM: [251.4, 33.2] };
  const ROOF = 11.5;   // underside of the roof trusses

  function create(canvas, E, X, opts = {}) {
    const P = E.P, L = P.layout;
    let theme = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
    let C = PAL[theme], S = STATUS[theme];
    const listeners = [];
    const emit = (t, d) => listeners.forEach(f => f(t, d));
    const low = !!opts.lowPower;

    /* ---------------- renderer, camera, controls ---------------- */
    const renderer = new T.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: !!opts.capture, stencil: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, low ? 1 : 1.5));
    renderer.outputColorSpace = T.SRGBColorSpace;
    renderer.toneMapping = T.NeutralToneMapping;
    renderer.toneMappingExposure = C.exp;
    renderer.shadowMap.enabled = !low;
    renderer.shadowMap.type = T.PCFSoftShadowMap;
    renderer.shadowMap.autoUpdate = false;
    const scene = new T.Scene();
    const camera = new T.PerspectiveCamera(32, 1, 0.3, 2600);
    const controls = new T.OrbitControls(camera, canvas);
    controls.enableDamping = true; controls.dampingFactor = 0.07;
    controls.maxPolarAngle = 1.42; controls.minDistance = 3; controls.maxDistance = 560;
    controls.screenSpacePanning = false; controls.zoomSpeed = 1.1; controls.rotateSpeed = 0.55;
    const CENTER = new T.Vector3(L.W / 2, 0, L.D / 2 + 4);
    const HOME = new T.Vector3(CENTER.x + 34, 205, CENTER.z + 196);
    const homePos = () => { const k = Math.max(1, 1.5 / Math.max(0.3, camera.aspect)); return CENTER.clone().add(HOME.clone().sub(CENTER).multiplyScalar(k)); };
    let moved = false;
    controls.target.copy(CENTER); camera.position.copy(HOME);

    // image-based light from a neutral studio room, plus sky light and a sun for shadows
    const pmrem = new T.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new T.RoomEnvironment(), 0.04).texture;
    const hemi = new T.HemisphereLight(C.hemi[0], C.hemi[1], C.hemi[2]); scene.add(hemi);
    const amb = new T.AmbientLight(0xffffff, C.amb); scene.add(amb);
    const sun = new T.DirectionalLight(0xfff6ea, C.sun);
    sun.position.set(CENTER.x - 110, 230, CENTER.z - 140); sun.target.position.copy(CENTER);
    sun.castShadow = !low;
    sun.shadow.mapSize.set(4096, 4096);
    Object.assign(sun.shadow.camera, { left: -175, right: 175, top: 125, bottom: -125, near: 20, far: 560 });
    sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.05; sun.shadow.radius = 3;
    scene.add(sun, sun.target);
    scene.fog = new T.Fog(C.fog, 340, 1100);   // atmospheric depth: far halls soften a little at overview distance

    /* ---------------- post-processing: MSAA, ambient occlusion, bloom, tone mapping ---------------- */
    let quality = low ? 'low' : 'high', composer = null, gtao = null, bloom = null, vig = null;
    function buildComposer() {
      if (quality === 'low') { composer = null; return; }
      const size = renderer.getDrawingBufferSize(new T.Vector2());
      const rt = new T.WebGLRenderTarget(Math.max(1, size.x), Math.max(1, size.y), { type: T.HalfFloatType, samples: 4 });
      composer = new T.EffectComposer(renderer, rt);
      composer.addPass(new T.RenderPass(scene, camera));
      if (quality === 'high') {
        gtao = new T.GTAOPass(scene, camera, size.x, size.y);
        gtao.updateGtaoMaterial({ radius: 0.9, distanceExponent: 1.4, thickness: 1.2, scale: 1.1, samples: 12 });
        gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 16 });
        gtao.blendIntensity = 0.85;
        composer.addPass(gtao);
      } else gtao = null;
      bloom = new T.UnrealBloomPass(new T.Vector2(size.x / 2, size.y / 2), C.bloom, 0.55, 1.45);
      composer.addPass(bloom);
      composer.addPass(new T.OutputPass());
      // a quiet vignette after tone mapping keeps the eye on the middle of the floor
      composer.addPass(vig = new T.ShaderPass({
        uniforms: { tDiffuse: { value: null }, amount: { value: theme === 'dark' ? 0.38 : 0.22 } },
        vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: 'uniform sampler2D tDiffuse; uniform float amount; varying vec2 vUv; void main() { vec4 c = texture2D(tDiffuse, vUv); vec2 d = vUv - 0.5; float v = smoothstep(0.85, 0.25, length(d * vec2(1.0, 0.8))); gl_FragColor = vec4(c.rgb * mix(1.0 - amount, 1.0, v), c.a); }'
      }));
    }
    // adaptive quality: drop to a cheaper pipeline when frames get slow
    let ftAvg = 16, ftN = 0, autoQ = true;

    /* ---------------- textures ---------------- */
    const cv = (w, h, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4; return t; };
    // polished epoxy floor: soft mottling and saw-cut joints every 6 m
    const floorTex = cv(512, 512, (g, w, h) => {
      g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 2600; i++) { const x = Math.random() * w, y = Math.random() * h, r = 2 + Math.random() * 14; g.fillStyle = `rgba(0,0,0,${0.006 + Math.random() * 0.02})`; g.beginPath(); g.arc(x, y, r, 0, 6.3); g.fill(); }
      g.strokeStyle = 'rgba(0,0,0,0.22)'; g.lineWidth = 2; g.strokeRect(0, 0, w, h);
    });
    floorTex.wrapS = floorTex.wrapT = T.RepeatWrapping; floorTex.repeat.set((L.W + 140) / 6, (L.D + 120) / 6); floorTex.colorSpace = T.SRGBColorSpace;
    // words painted in the plant (signs, floor names, screens) follow the page language; Arabic is set right to left
    const tt = t => (window.DFI18N && DFI18N.ar() && DFI18N.t(t)) || t;
    const isAr = t => /[\u0600-\u06FF]/.test(t);
    const FONT = "Inter, 'IBM Plex Sans Arabic', Arial";
    function say(g, text, x, y, w) { if (isAr(text)) { g.direction = 'rtl'; g.textAlign = 'right'; g.fillText(text, w - x, y); g.direction = 'ltr'; g.textAlign = 'left'; } else g.fillText(text, x, y); }
    const hmiDraw = (g, w, h) => {
      g.fillStyle = '#0B1220'; g.fillRect(0, 0, w, h); g.fillStyle = '#1E3A6E'; g.fillRect(0, 0, w, 22);
      g.fillStyle = '#9FC1FF'; g.font = `bold 13px ${FONT}`; say(g, tt('GMES · STATION'), 8, 15, w);
      for (let i = 0; i < 4; i++) { g.fillStyle = '#16233A'; g.fillRect(10, 34 + i * 28, 140, 18); g.fillStyle = ['#3DDC97', '#7FB2FF', '#3DDC97', '#7FB2FF'][i]; g.fillRect(10, 34 + i * 28, 60 + i * 18, 18); }
      g.strokeStyle = '#7FB2FF'; g.lineWidth = 2; g.beginPath(); for (let x = 0; x < 80; x++) g.lineTo(165 + x, 120 - Math.sin(x / 9) * 18 - x * 0.3); g.stroke();
    };
    const hmiTex = cv(256, 160, hmiDraw);
    const patternTex = cv(256, 144, (g) => {
      ['#C0C0C0', '#C0C000', '#00C0C0', '#00C000', '#C000C0', '#C00000', '#0000C0'].forEach((b, i) => { g.fillStyle = b; g.fillRect(i * 256 / 7, 0, 256 / 7 + 1, 104); });
      const grd = g.createLinearGradient(0, 0, 256, 0); grd.addColorStop(0, '#000'); grd.addColorStop(1, '#fff'); g.fillStyle = grd; g.fillRect(0, 104, 256, 40);
    });
    const sopDraw = (g, w, h) => {
      g.fillStyle = '#0B1220'; g.fillRect(0, 0, w, h); g.fillStyle = '#9FC1FF'; g.font = `bold 22px ${FONT}`; say(g, tt('S&OP · 12 WEEKS'), 18, 34, w);
      for (let i = 0; i < 12; i++) { const v = 60 + Math.sin(i * 0.9) * 30 + (i === 4 || i === 5 ? 50 : 0); g.fillStyle = '#2A4A80'; g.fillRect(24 + i * 38, h - 24 - v, 24, v); }
      g.strokeStyle = '#E8EEFF'; g.lineWidth = 3; g.beginPath(); for (let i = 0; i < 12; i++) g.lineTo(36 + i * 38, h - 40 - (70 + Math.sin(i * 0.9) * 26 + (i === 4 || i === 5 ? 64 : 0))); g.stroke();
    };
    const sopTex = cv(512, 256, sopDraw);
    // English names are set in capitals; a translated name keeps its own letters
    const caps = t => { const a = tt(t); return isAr(a) ? a : a.toUpperCase(); };
    function signTex(text, sub) {
      return cv(512, 96, (g, w, h) => {
        g.fillStyle = '#10151E'; g.fillRect(0, 0, w, h); g.fillStyle = '#2D5BFF'; g.fillRect(0, 0, 10, h);
        g.fillStyle = '#FFFFFF'; g.font = `bold 40px ${FONT}`; say(g, caps(text), 28, 50, w);
        if (sub) { g.fillStyle = '#9AA6B8'; g.font = `600 24px ${FONT}`; say(g, caps(sub), 30, 82, w); }
      });
    }
    function floorWord(text) {
      return cv(1024, 160, (g, w, h) => { g.clearRect(0, 0, w, h); g.fillStyle = 'rgba(255,255,255,0.9)'; g.font = `800 92px ${FONT}`; g.textBaseline = 'middle'; say(g, caps(text), 10, h / 2, w); });
    }
    const signSub = Ln => (Ln.kind === 'press' ? `Chassis ${Ln.size}"` : Ln.kind === 'smd' && Ln.model ? 'PBA ' + Ln.model.slice(1) : Ln.model && E.MODELS[Ln.model] ? E.MODELS[Ln.model].name : '');

    /* ---------------- materials (rethemed in place) ---------------- */
    const std = (c, o = {}) => new T.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.6, metalness: 0 }, o));
    const M = {
      floor: std(C.floor, { map: floorTex, roughness: 0.42, metalness: 0.0 }),
      zone: std(C.zone, { roughness: 0.5, transparent: true, opacity: 0.55, depthWrite: false }),
      floorLine: new T.MeshBasicMaterial({ color: C.floorLine }),
      paint: std(C.paint, { roughness: 0.38, metalness: 0.05 }), paint2: std(C.paint2, { roughness: 0.45 }),
      frame: std(C.frame, { roughness: 0.55, metalness: 0.2 }), dark: std(C.dark, { roughness: 0.5, metalness: 0.2 }),
      steel: std(C.steel, { roughness: 0.32, metalness: 0.85 }), alu: std(C.alu, { roughness: 0.28, metalness: 0.9 }),
      rubber: std(C.rubber, { roughness: 0.85 }), rack: std(C.rack, { roughness: 0.5, metalness: 0.4 }), beam: std(C.beam, { roughness: 0.5, metalness: 0.6 }),
      glass: std(C.glass, { roughness: 0.04, metalness: 0.1, transparent: true, opacity: 0.12, depthWrite: false, envMapIntensity: 1.8 }),
      pcb: std(C.pcb, { roughness: 0.4 }), tv: std(C.tv, { roughness: 0.18, metalness: 0.3 }), carton: std(C.carton, { roughness: 0.9 }), pallet: std(C.pallet, { roughness: 0.85 }),
      tray: std(C.tray, { roughness: 0.5 }), agv: std(C.agv, { roughness: 0.35 }), stripe: std(C.stripe, { roughness: 0.4 }), truck: std(C.truck, { roughness: 0.4, metalness: 0.2 }),
      cab: std(C.cab, { roughness: 0.4, metalness: 0.3 }), mag: std(C.mag, { roughness: 0.5 }), plastic: std(C.plastic, { roughness: 0.35 }), desk: std(C.desk, { roughness: 0.5 }),
      carpet: std(C.carpet, { roughness: 1 }), wall: std(C.wall, { roughness: 0.7 }), load: std(0xffffff, { roughness: 0.7 }), skin: std(C.skin, { roughness: 0.7 }),
      person: std(0xffffff, { roughness: 0.8 }),
      hmi: new T.MeshStandardMaterial({ color: 0x000000, emissive: 0xffffff, emissiveMap: hmiTex, emissiveIntensity: 1.25, roughness: 0.2 }),
      screen: new T.MeshStandardMaterial({ color: 0x000000, emissive: 0xffffff, emissiveMap: patternTex, emissiveIntensity: 1.4, roughness: 0.2 }),
      sop: new T.MeshStandardMaterial({ color: 0x000000, emissive: 0xffffff, emissiveMap: sopTex, emissiveIntensity: 1.3 }),
      white: new T.MeshStandardMaterial({ color: 0x000000, emissive: 0xEEF4FF, emissiveIntensity: 2.2 }),
      fixture: new T.MeshStandardMaterial({ color: 0x000000, emissive: 0xFFF7EC, emissiveIntensity: C.fixture }),
      lights: new T.MeshStandardMaterial({ color: 0x000000, emissive: 0xFFF7EC, emissiveIntensity: C.fixture, transparent: true }),
      roof: std(C.beam, { roughness: 0.5, metalness: 0.6, transparent: true }),
      lamp: new T.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }),
      flat: new T.MeshBasicMaterial({ color: 0xffffff, side: T.DoubleSide, transparent: true, opacity: 0.9, depthWrite: false }),
      wrap: std(0xffffff, { transparent: true, opacity: 0.32, roughness: 0.1, depthWrite: false }),
      sel: new T.MeshBasicMaterial({ color: S.info, side: T.DoubleSide, toneMapped: false }),
      route: new T.LineBasicMaterial({ color: S.info, transparent: true, opacity: 0.9 }),
      pkt: new T.MeshBasicMaterial({ color: C.pkt, toneMapped: false }), net: new T.LineBasicMaterial({ color: C.net, transparent: true, opacity: 0.4 }),
      hit: new T.MeshBasicMaterial({ visible: false })
    };
    const XRAY = ['paint', 'paint2', 'frame', 'wall', 'glass'];

    /* ---------------- static geometry, merged by material ---------------- */
    const BAG = {};
    const mtx = new T.Matrix4(), q = new T.Quaternion(), eul = new T.Euler(), pos = new T.Vector3(), scl = new T.Vector3(1, 1, 1);
    const place = (g, x, y, z, ry = 0, rx = 0, rz = 0) => { eul.set(rx, ry, rz); q.setFromEuler(eul); mtx.compose(pos.set(x, y, z), q, scl.set(1, 1, 1)); g.applyMatrix4(mtx); return g; };
    const strip = g => { for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') g.deleteAttribute(k); return g.index ? g : g; };
    const push = (key, g) => { (BAG[key] = BAG[key] || []).push(strip(g)); };
    // a box; rounded boxes for machine bodies so the light catches their edges
    function sbox(key, w, h, d, x, y, z, o = {}) {
      const r = o.r && !low ? Math.min(o.r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001) : 0;
      const g = r > 0.005 ? new T.RoundedBoxGeometry(w, h, d, 2, r) : new T.BoxGeometry(w, h, d);
      push(key, place(g, x, y + h / 2, z, o.ry || 0, o.rx || 0, o.rz || 0));
    }
    function scyl(key, r, h, x, y, z, o = {}) {
      const g = new T.CylinderGeometry(r, o.r2 !== undefined ? o.r2 : r, h, o.seg || 18, 1, !!o.open);
      push(key, place(g, x, y + (o.rx || o.rz ? 0 : h / 2), z, o.ry || 0, o.rx || 0, o.rz || 0));
    }
    function storus(key, R, r, x, y, z, o = {}) { push(key, place(new T.TorusGeometry(R, r, 8, 24), x, y, z, o.ry || 0, o.rx || 0, o.rz || 0)); }
    function splane(key, w, h, x, y, z, ry = 0, rx = 0) { push(key, place(new T.PlaneGeometry(w, h), x, y, z, ry, rx)); }
    const world = new T.Group(); scene.add(world);
    function finalize() {
      for (const key in BAG) {
        const list = BAG[key]; if (!list.length) continue;
        const idx = list.filter(g => g.index), non = list.filter(g => !g.index);
        for (const set of [idx, non]) for (let i = 0; i < set.length; i += 3000) {
          const g = T.mergeGeometries(set.slice(i, i + 3000), false); if (!g) continue;
          const m = new T.Mesh(g, M[key]);
          m.castShadow = !['glass', 'zone', 'floorLine', 'screen', 'white', 'hmi', 'sop', 'fixture', 'lights', 'carpet', 'roof'].includes(key); m.receiveShadow = !['glass', 'fixture'].includes(key);
          m.raycast = () => {};
          if (key === 'glass' || key === 'zone') m.renderOrder = 2;
          world.add(m);
        }
        list.forEach(g => g.dispose()); BAG[key] = [];
      }
    }
    function lines(parent, pts, mat, y = 0.02) {
      const g = new T.BufferGeometry(), a = new Float32Array(pts.length * 3);
      pts.forEach((p, i) => { a[i * 3] = p[0]; a[i * 3 + 1] = p[2] !== undefined ? p[2] : y; a[i * 3 + 2] = p[1]; });
      g.setAttribute('position', new T.BufferAttribute(a, 3));
      const l = new T.LineSegments(g, mat); l.raycast = () => {}; parent.add(l); return l;
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
    const PICK = [];
    function inst(geo, mat, n, o = {}) {
      const m = new T.InstancedMesh(geo, mat, n); m.count = 0; m.frustumCulled = false;
      m.castShadow = !!o.shadow; m.receiveShadow = !!o.receive;
      if (o.color) m.instanceColor = new T.InstancedBufferAttribute(new Float32Array(n * 3), 3);
      m.userData.refs = []; if (o.pick) PICK.push(m); else m.raycast = () => {};
      if (o.order) m.renderOrder = o.order;
      world.add(m); return m;
    }
    const col = new T.Color();
    function put(m, x, y, z, sx = 1, sy = 1, sz = 1, ry = 0, rx = 0, rz = 0, ref, c) {
      const i = m.count; if (i >= m.instanceMatrix.count) return -1;
      eul.set(rx, ry, rz, 'YXZ'); q.setFromEuler(eul); mtx.compose(pos.set(x, y, z), q, scl.set(sx, sy, sz));
      m.setMatrixAt(i, mtx); if (ref !== undefined) m.userData.refs[i] = ref;
      if (c !== undefined && m.instanceColor) m.setColorAt(i, typeof c === 'number' ? col.set(c) : c);
      m.count = i + 1; return i;
    }
    const putM = (m, matrix, c) => { const i = m.count; if (i >= m.instanceMatrix.count) return; m.setMatrixAt(i, matrix); if (c !== undefined && m.instanceColor) m.setColorAt(i, col.set(c)); m.count = i + 1; };
    const done = (...ms) => ms.forEach(m => { m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; });
    const unitBox = new T.BoxGeometry(1, 1, 1);
    const unitBoxB = new T.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);

    /* ---------------- the building: floor, markings, walls, steel, roof trusses, lights ---------------- */
    const floor = new T.Mesh(new T.PlaneGeometry(L.W + 140, L.D + 120), M.floor);
    floor.rotation.x = -Math.PI / 2; floor.position.set(L.W / 2, -0.01, L.D / 2); floor.receiveShadow = true; world.add(floor);
    for (const z of L.ZONES) {
      const w = z.x1 - z.x0, d = z.z1 - z.z0;
      const g = new T.PlaneGeometry(w, d); g.rotateX(-Math.PI / 2); g.translate(z.x0 + w / 2, 0.006, z.z0 + d / 2); push('zone', g);
      // the zone's name painted on the floor
      const word = new T.Mesh(new T.PlaneGeometry(Math.min(w - 4, 30), Math.min(w - 4, 30) * 0.156), new T.MeshBasicMaterial({ map: floorWord(z.name), transparent: true, opacity: theme === 'dark' ? 0.22 : 0.55, depthWrite: false }));
      word.userData.zoneName = z.name;
      word.rotation.x = -Math.PI / 2; word.position.set(z.x0 + 2 + Math.min(w - 4, 30) / 2, 0.02, z.z1 - 2.2); word.raycast = () => {}; word.userData.floorWord = true; world.add(word);
    }
    // walkway edges: white lines either side of every aisle
    for (const A of L.AISLES) {
      const h = A.a[1] === A.b[1];
      const len = h ? Math.abs(A.b[0] - A.a[0]) + 2.6 : Math.abs(A.b[1] - A.a[1]) + 2.6;
      const cx = (A.a[0] + A.b[0]) / 2, cz = (A.a[1] + A.b[1]) / 2;
      for (const s of [-1.25, 1.25]) { const g = new T.PlaneGeometry(h ? len : 0.1, h ? 0.1 : len); g.rotateX(-Math.PI / 2); g.translate(cx + (h ? 0 : s), 0.012, cz + (h ? s : 0)); push('floorLine', g); }
    }
    {
      const H = 1.4, t = 0.3;
      const run = (a, b, gaps, fn) => { let s = a; for (const [g0, g1] of gaps.concat([[b, b]]).sort((p, q2) => p[0] - q2[0])) { if (g0 > s) fn(s, g0); s = Math.max(s, g1); } };
      const doorsN = L.INDOCK.filter(d => d.side === 'n').map(d => [d.x - 2.4, d.x + 2.4]);
      const doorsW = L.INDOCK.filter(d => d.side === 'w').map(d => [d.z - 2.4, d.z + 2.4]);
      const docksE = P.docks.map(d => [d.z - 2.2, d.z + 2.2]);
      run(0, L.W, doorsN, (a, b) => sbox('wall', b - a, H, t, (a + b) / 2, 0, 0));
      run(0, L.W, [], (a, b) => sbox('wall', b - a, H, t, (a + b) / 2, 0, L.D));
      run(0, L.D, doorsW, (a, b) => sbox('wall', t, H, b - a, 0, 0, (a + b) / 2));
      run(0, L.D, docksE, (a, b) => sbox('wall', t, H, b - a, L.W, 0, (a + b) / 2));
      for (const d of P.docks) { sbox('steel', 1.6, 1.15, 3.8, L.W + 0.9, 0, d.z); sbox('rubber', 0.3, 3.6, 0.4, L.W + 0.2, 0, d.z - 2.0); sbox('rubber', 0.3, 3.6, 0.4, L.W + 0.2, 0, d.z + 2.0); sbox('rubber', 0.3, 0.5, 4.4, L.W + 0.2, 3.3, d.z); }
      for (const d of L.INDOCK) if (d.side === 'w') sbox('steel', 1.4, 1.1, 3.6, -0.8, 0, d.z); else sbox('steel', 3.6, 1.1, 1.4, d.x, 0, -0.8);
    }
    // steel columns on a 24 × 21 m grid, roof trusses and high-bay lights (the roof itself is cut away)
    const COLX = [], COLZ = [];
    for (let x = 0; x <= L.W + 0.1; x += 24) COLX.push(Math.min(x, L.W));
    for (let z = 0; z <= L.D + 0.1; z += 21) COLZ.push(Math.min(z, L.D));
    const colAt = new Set();
    // a column never stands in an aisle, in the finished-goods pallet rows, on a store or dock apron, or in a machine:
    // where the grid point is taken it moves up to 3.5 m along the grid line, and if no spot is free it is left out
    const nearAisle = (x, z) => L.AISLES.some(A => A.a[1] === A.b[1]
      ? Math.abs(z - A.a[1]) < 2.4 && x > Math.min(A.a[0], A.b[0]) - 2.4 && x < Math.max(A.a[0], A.b[0]) + 2.4
      : Math.abs(x - A.a[0]) < 2.4 && z > Math.min(A.a[1], A.b[1]) - 2.4 && z < Math.max(A.a[1], A.b[1]) + 2.4);
    const blocked = (x, z) => P.stations.some(s => Math.abs(s.x - x) < s.w / 2 + 0.8 && Math.abs(s.z - z) < s.d / 2 + 0.8)
      || nearAisle(x, z) || P.fgSlots.some(f => Math.abs(f.x - x) < 1.4 && Math.abs(f.z - z) < 1.3)
      || Object.values(L.POS).some(p => Math.hypot(p[0] - x, p[1] - z) < 3) || L.DOCKS.some(d => Math.abs(d.z - z) < 3 && x > L.W - 8);
    const edge = (v, max) => v < 0.1 || v > max - 0.1;
    for (const x0 of COLX) for (const z0 of COLZ) {
      let at = null;
      for (const d of [0, 2.5, -2.5, 3.5, -3.5]) {
        for (const [x, z] of [[x0, z0 + d], [x0 + d, z0]]) if (!at && !(edge(x0, L.W) && x !== x0) && !(edge(z0, L.D) && z !== z0) && !blocked(x, z)) at = [x, z];
        if (at) break;
      }
      // the outer wall keeps its columns: they stand in the wall line, outside the aisles' clearance
      if (!at && (edge(x0, L.W) || edge(z0, L.D)) && !P.stations.some(s => Math.abs(s.x - x0) < s.w / 2 + 0.6 && Math.abs(s.z - z0) < s.d / 2 + 0.6)) at = [x0, z0];
      if (!at) continue;
      const [x, z] = at;
      colAt.add(x + ',' + z);
      sbox('beam', 0.42, ROOF, 0.12, x, 0, z - 0.17); sbox('beam', 0.42, ROOF, 0.12, x, 0, z + 0.17); sbox('beam', 0.08, ROOF, 0.3, x, 0, z);
      sbox('frame', 0.7, 0.25, 0.7, x, 0, z);
    }
    for (const z of COLZ) { sbox('roof', L.W, 0.5, 0.18, L.W / 2, ROOF, z); sbox('roof', L.W, 0.12, 0.3, L.W / 2, ROOF + 1.6, z); for (let x = 3; x < L.W; x += 6) sbox('roof', 0.08, 1.6, 0.08, x, ROOF + 0.25, z, { rz: (x / 6 | 0) % 2 ? 0.5 : -0.5 }); }
    for (const x of COLX) sbox('roof', 0.18, 0.4, L.D, x, ROOF, L.D / 2);
    for (let x = 12; x < L.W; x += 12) for (let z = 10.5; z < L.D; z += 10.5) { sbox('roof', 1.2, 0.12, 0.5, x, ROOF - 1.6, z); sbox('lights', 1.1, 0.03, 0.4, x, ROOF - 1.64, z); }

    /* ---------------- machines ---------------- */
    const ANIM = { gantry: [], arm: [], platen: [], ram: [], fan: [] };
    const SV = new Map();
    const topOf = s => ({ robot: 2.2, bench: 1.7, subassy: 1.7, repair: 1.7, blu: 1.7, aging: 3.2, oven: 3.4, press: 5.2, injection: 2.9, cushion: 3.6, palletizer: 2.5, lcmload: 2.2 }[s.kind] || s.h);
    function buildStation(s) {
      const W = s.w, D = s.d, H = s.h, X0 = s.x, Z0 = s.z;
      const b = (k, w, h, d, x, y, z, o) => sbox(k, w, h, d, X0 + x, y, Z0 + z, o);
      const c = (k, r, h, x, y, z, o) => scyl(k, r, h, X0 + x, y, Z0 + z, o);
      const plinth = (w = W, d = D) => b('frame', w - 0.08, 0.14, d - 0.08, 0, 0, 0);
      // a machine cabinet: dark plinth, painted rounded body, seam lines, HMI screen on the operator side
      const cabinet = (w, h, d, x = 0, z = 0, o = {}) => {
        b('frame', w - 0.06, 0.12, d - 0.06, x, 0, z);
        b(o.k || 'paint', w, h - 0.12, d, x, 0.12, z, { r: 0.06 });
        b('dark', w + 0.01, 0.025, d + 0.01, x, h * 0.62, z);
        if (o.hmi !== false) { b('dark', 0.5, 0.36, 0.05, x + w * 0.28, h * 0.5, z + d / 2 + 0.03); splane('hmi', 0.44, 0.3, X0 + x + w * 0.28, h * 0.5 + 0.18, Z0 + z + d / 2 + 0.06); }
      };
      const fence = (w, d, h = 2.0) => {
        for (const [px, pz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) b('frame', 0.07, h, 0.07, px * w / 2, 0, pz * d / 2);
        b('glass', w, h - 0.2, 0.03, 0, 0.2, -d / 2); b('glass', w, h - 0.2, 0.03, 0, 0.2, d / 2); b('glass', 0.03, h - 0.2, d, -w / 2, 0.2, 0);
        b('frame', w, 0.05, 0.05, 0, h, -d / 2); b('frame', w, 0.05, 0.05, 0, h, d / 2);
      };
      const bench = (w, d) => {
        b('paint2', w, 0.05, d, 0, 0.86, 0, { r: 0.02 }); b('rubber', w - 0.1, 0.01, d - 0.1, 0, 0.91, 0);
        for (const [px, pz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) b('frame', 0.06, 0.86, 0.06, px * (w / 2 - 0.08), 0, pz * (d / 2 - 0.08));
        b('frame', 0.05, 0.9, 0.05, -w * 0.45, 0.9, -d / 2 + 0.1); b('frame', 0.05, 0.9, 0.05, w * 0.45, 0.9, -d / 2 + 0.1);
        b('paint2', w * 0.94, 0.05, 0.3, 0, 1.78, -d / 2 + 0.2); b('fixture', w * 0.8, 0.02, 0.12, 0, 1.76, -d / 2 + 0.22);
        b('dark', 0.5, 0.32, 0.04, w * 0.28, 0.98, -d / 2 + 0.3); splane('hmi', 0.46, 0.28, X0 + w * 0.28, 1.14, Z0 - d / 2 + 0.33);
      };
      switch (s.kind) {
        case 'loader': case 'unloader':
          cabinet(W, H * 0.62, D, 0, 0, { hmi: false });
          for (const px of [-0.4, 0.4]) b('frame', 0.05, H * 0.4, D * 0.7, px * W, H * 0.62, 0);
          for (let i = 0; i < 5; i++) b('mag', W * 0.78, 0.05, D * 0.66, 0, H * 0.64 + i * 0.09, 0);
          break;
        case 'printer': case 'spi': case 'aoi':
          cabinet(W, H * 0.7, D);
          b('glass', W * 0.96, H * 0.28, D * 0.94, 0, H * 0.7, 0, { r: 0.04 });
          if (s.kind === 'printer') ANIM.gantry.push({ s, y: H * 0.72, len: D * 0.8, amp: W * 0.34, rate: 1.6 });
          else c('dark', 0.13, 0.22, 0, H * 0.84, 0);
          break;
        case 'mounter':
          cabinet(W, H * 0.58, D);
          b('glass', W * 0.98, H * 0.36, D * 0.96, 0, H * 0.58, 0, { r: 0.08 });
          for (const pz of [-1, 1]) b('frame', W, 0.06, 0.06, 0, H * 0.94, pz * D * 0.46);
          for (const sz of [-1, 1]) {
            b('paint2', W * 0.9, H * 0.4, 0.36, 0, 0.2, sz * (D / 2 + 0.18), { r: 0.03 });
            for (let i = 0; i < 6; i++) c('dark', 0.13, 0.04, -W * 0.36 + i * W * 0.145, H * 0.66, sz * (D / 2 + 0.22), { rx: Math.PI / 2 });
          }
          ANIM.gantry.push({ s, y: H * 0.86, len: D * 0.86, amp: W * 0.3, rate: 2.1 });
          break;
        case 'reflow':
          plinth();
          b('paint', W * 0.84, H * 0.5, D, 0, 0.14, 0, { r: 0.06 });
          b('paint2', W * 0.84, H * 0.3, D * 0.96, 0, 0.14 + H * 0.5, 0, { r: 0.1 });
          for (let i = 0; i < 8; i++) { c('dark', 0.16, 0.04, -W * 0.36 + i * W * 0.103, 0.14 + H * 0.8, 0); ANIM.fan.push({ s, x: X0 - W * 0.36 + i * W * 0.103, y: 0.14 + H * 0.84, z: Z0 }); }
          b('alu', W * 0.08, H * 0.42, D * 0.75, -W * 0.46, 0.14, 0); b('alu', W * 0.08, H * 0.42, D * 0.75, W * 0.46, 0.14, 0);
          b('dark', 0.5, 0.32, 0.05, W * 0.3, H * 0.42, D / 2 + 0.03); splane('hmi', 0.44, 0.28, X0 + W * 0.3, H * 0.42 + 0.16, Z0 + D / 2 + 0.06);
          break;
        case 'writer':
          cabinet(W, H * 0.55, D);
          for (let i = 0; i < 4; i++) { b('dark', W * 0.18, 0.12, D * 0.5, -W * 0.33 + i * W * 0.22, H * 0.55, 0); b('fixture', W * 0.03, 0.02, 0.03, -W * 0.33 + i * W * 0.22 + W * 0.06, H * 0.55 + 0.12, D * 0.2); }
          b('dark', 0.6, 0.4, 0.05, 0, H * 0.75, -D / 2 + 0.1); splane('hmi', 0.56, 0.36, X0, H * 0.75 + 0.2, Z0 - D / 2 + 0.13);
          break;
        case 'ict':
          cabinet(W, H * 0.5, D);
          for (const [px, pz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) c('steel', 0.04, 0.9, px * W * 0.38, H * 0.5, pz * D * 0.32);
          b('frame', W * 0.8, 0.16, D * 0.7, 0, H * 0.5 + 0.9, 0, { r: 0.03 });
          break;
        case 'lcmload':
          plinth(); b('paint2', W, 0.7, D, 0, 0.12, 0, { r: 0.05 }); b('rack', 1.2, 1.8, D * 0.9, -W / 2 + 0.6, 0, 0);
          for (let i = 0; i < 6; i++) b('tv', 1.0, 0.03, D * 0.8, -W / 2 + 0.6, 0.2 + i * 0.27, 0);
          fence(W, D, 2.0); ANIM.arm.push({ s, x: X0 + 0.4, y: 0.82, z: Z0, k: 1.3, rate: 0.8 });
          break;
        case 'blu': case 'bench': case 'subassy': case 'repair': bench(W, D); break;
        case 'bond':
          cabinet(W, H * 0.55, D);
          b('glass', W, H * 0.4, D, 0, H * 0.55, 0, { r: 0.06 }); for (const pz of [-1, 1]) b('frame', W, 0.05, 0.05, 0, H * 0.95, pz * D * 0.46);
          ANIM.gantry.push({ s, y: H * 0.86, len: D * 0.8, amp: W * 0.28, rate: 1.2 });
          break;
        case 'lighting':
          cabinet(W, 0.9, D, 0, 0, { hmi: false }); b('dark', W, H - 0.9, D * 0.92, 0, 0.9, 0, { r: 0.05 });
          splane('white', W * 0.6, 0.5, X0, 1.4, Z0 + D * 0.46 + 0.02);
          break;
        case 'robot':
          plinth(); b('paint2', W - 0.2, 0.72, D - 0.2, 0, 0.12, 0, { r: 0.05 });
          fence(W, D, 2.1); ANIM.arm.push({ s, x: X0 - W * 0.12, y: 0.84, z: Z0 - D * 0.3, k: 1.3, rate: 0.9 });
          b('dark', 0.5, 0.36, 0.05, W * 0.3, 1.1, D / 2 + 0.05); splane('hmi', 0.46, 0.32, X0 + W * 0.3, 1.28, Z0 + D / 2 + 0.08);
          break;
        case 'fct':
          cabinet(W, H * 0.46, D);
          b('dark', W * 0.9, H * 0.5, 0.14, 0, H * 0.46, -D * 0.32, { r: 0.03 });
          splane('screen', W * 0.8, H * 0.4, X0, H * 0.71, Z0 - D * 0.32 + 0.08);
          break;
        case 'aging':
          plinth();
          for (let i = 0; i <= 10; i++) for (const pz of [-1, 1]) b('frame', 0.08, 3.0, 0.08, -W / 2 + i * W / 10, 0.14, pz * (D / 2 - 0.05));
          for (const y of [0.3, 1.25, 2.2]) for (const pz of [-1, 1]) b('paint2', W, 0.05, 0.7, 0, y, pz * 1.0);
          for (const pz of [-1, 1]) b('frame', W, 0.08, 0.08, 0, 3.1, pz * (D / 2 - 0.05));
          for (let i = 0; i < 10; i++) b('fixture', W / 10 * 0.8, 0.02, 0.2, -W / 2 + (i + 0.5) * W / 10, 3.08, 0);
          break;
        case 'wb':
          cabinet(W, 0.9, D, 0, 0, { hmi: false }); b('dark', W, H - 0.9, D * 0.92, 0, 0.9, 0, { r: 0.05 });
          c('steel', 0.04, 0.8, 0, H, 0); b('dark', 0.25, 0.2, 0.3, 0, H + 0.8, 0);
          break;
        case 'qa':
          b('dark', W, H, 0.1, 0, 0, -D / 2); b('dark', W, 0.12, D, 0, H, 0); b('fixture', W * 0.8, 0.03, D * 0.7, 0, H - 0.04, 0);
          b('paint2', W * 0.7, 0.86, D * 0.6, 0, 0, 0, { r: 0.04 });
          break;
        case 'packer':
          cabinet(W, H * 0.6, D); b('glass', W, H * 0.4, D, 0, H * 0.6, 0, { r: 0.05 });
          for (let i = 0; i < 4; i++) b('carton', 1.5, 0.12, 0.9, -W / 2 - 0.95, i * 0.13, D * 0.2);
          b('rubber', 0.5, 0.2, 0.2, W * 0.1, H * 0.62, 0);
          break;
        case 'palletizer':
          b('paint2', W, 0.12, D, 0, 0, 0); fence(W, D, 2.4); b('paint', 0.8, 0.9, 0.8, 0, 0.12, 0, { r: 0.05 });
          ANIM.arm.push({ s, x: X0, y: 1.0, z: Z0, k: 1.7, rate: 0.7 });
          break;
        case 'injection': {
          // base, clamp unit with tie bars and moving platen, barrel with heater bands, hopper dryer, sprue robot, guards
          plinth(W, D);
          b('paint', W, 0.85, D, 0, 0.14, 0, { r: 0.06 });
          b('paint2', W * 0.1, 1.55, D * 0.94, -W * 0.46, 0.99, 0, { r: 0.04 });
          b('paint2', W * 0.1, 1.55, D * 0.94, -W * 0.08, 0.99, 0, { r: 0.04 });
          for (const pz of [-0.34, 0.34]) for (const py of [1.25, 2.3]) c('steel', 0.06, W * 0.4, -W * 0.27, py, pz * D, { rz: Math.PI / 2 });
          c('steel', 0.2, W * 0.42, W * 0.18, 1.5, 0, { rz: Math.PI / 2 });
          for (let i = 0; i < 5; i++) storus('dark', 0.22, 0.04, X0 + W * 0.04 + i * W * 0.07, 1.5, Z0, { ry: Math.PI / 2 });
          b('paint', W * 0.22, 0.7, D * 0.7, W * 0.36, 0.99, 0, { r: 0.05 });
          c('paint2', 0.34, 0.65, W * 0.16, 1.72, 0, { r2: 0.13 }); c('paint2', 0.34, 0.36, W * 0.16, 2.37, 0); c('steel', 0.36, 0.05, W * 0.16, 2.73, 0);
          b('glass', W * 0.38, 1.5, 0.04, -W * 0.27, 0.99, D / 2 + 0.05);
          b('frame', 0.08, 1.4, 0.08, -W * 0.46, 1.5, 0); b('frame', 0.08, 1.4, 0.08, -W * 0.08, 1.5, 0); b('frame', W * 0.42, 0.1, 0.1, -W * 0.27, 2.85, 0);
          b('rack', 0.9, 0.9, 0.9, -W * 0.27, 0, D / 2 + 0.75);
          b('dark', 0.55, 0.4, 0.06, W * 0.36, 1.4, D / 2 + 0.03); splane('hmi', 0.5, 0.34, X0 + W * 0.36, 1.6, Z0 + D / 2 + 0.07);
          ANIM.platen.push({ s, x: X0 - W * 0.27, y: 1.05, z: Z0, w: 0.24, h: 1.4, d: D * 0.82, amp: W * 0.11 });
          ANIM.gantry.push({ s, y: 2.75, len: 0.3, amp: W * 0.12, rate: 1.1, offX: -W * 0.27 });
          break;
        }
        case 'press':
          plinth();
          b('paint', W, 0.7, D, 0, 0.14, 0, { r: 0.06 });
          for (const px of [-1, 1]) b('paint', 0.62, 3.2, D * 0.9, px * (W / 2 - 0.34), 0.84, 0, { r: 0.05 });
          b('paint', W, 1.1, D * 0.9, 0, 4.0, 0, { r: 0.08 });
          c('dark', 0.75, 0.32, W * 0.3, 4.6, D * 0.5, { rx: Math.PI / 2, seg: 28 }); c('steel', 0.12, 0.5, W * 0.3, 4.6, D * 0.5, { rx: Math.PI / 2 });
          b('steel', 1.4, 0.3, 1.4, -W / 2 - 1.4, 0, 0); c('steel', 0.7, 0.95, -W / 2 - 1.4, 1.0, 0, { rx: Math.PI / 2, seg: 28 }); c('dark', 0.3, 1.0, -W / 2 - 1.4, 1.0, 0, { rx: Math.PI / 2 });
          b('paint2', 0.9, 1.0, 0.8, -W / 2 - 0.3, 0.14, 0, { r: 0.04 });
          b('dark', 0.55, 0.4, 0.06, W * 0.2, 1.4, D / 2 + 0.03); splane('hmi', 0.5, 0.34, X0 + W * 0.2, 1.6, Z0 + D / 2 + 0.07);
          ANIM.ram.push({ s, x: X0, y: 1.3, z: Z0, w: W - 1.4, h: 0.55, d: D * 0.78, amp: 1.0 });
          break;
        case 'oven':
          b('frame', W, 0.4, D, 0, 0, 0);
          b('paint', W, 2.3, D + 0.3, 0, 0.4, 0, { r: 0.12 });
          for (let i = 0; i < 4; i++) { c('steel', 0.24, 1.6, -W * 0.35 + i * W * 0.23, 2.7, 0); c('dark', 0.28, 0.1, -W * 0.35 + i * W * 0.23, 4.3, 0); }
          b('paint2', 2.2, 1.6, 1.6, W * 0.2, 2.7, 0, { r: 0.06 });
          b('steel', W + 7, 0.08, 0.1, 0, 2.85, 0);
          for (const px of [-W / 2 - 3.4, W / 2 + 3.4]) b('frame', 0.1, 2.85, 0.1, px, 0, 0);
          b('dark', 0.55, 0.4, 0.06, -W * 0.42, 1.4, D / 2 + 0.18); splane('hmi', 0.5, 0.34, X0 - W * 0.42, 1.6, Z0 + D / 2 + 0.22);
          break;
        case 'cushion':
          plinth(); b('paint', W, 1.2, D, 0, 0.14, 0, { r: 0.06 }); b('paint', W * 0.5, 1.8, D * 0.9, -W * 0.2, 1.3, 0, { r: 0.06 });
          c('paint2', 0.48, 1.1, W * 0.32, 1.3, 0, { r2: 0.2 }); c('steel', 0.08, 2.4, W * 0.32, 2.4, 0);
          b('glass', W * 0.5, 1.4, 0.04, -W * 0.2, 1.4, D / 2);
          for (let i = 0; i < 3; i++) c('steel', 0.05, 1.4, -W * 0.45, 1.3 + i * 0.1, -D * 0.3 + i * 0.3, { rz: Math.PI / 2 });
          b('dark', 0.5, 0.36, 0.06, W * 0.3, 1.0, D / 2 + 0.03); splane('hmi', 0.46, 0.32, X0 + W * 0.3, 1.18, Z0 + D / 2 + 0.07);
          ANIM.platen.push({ s, x: X0 - W * 0.2, y: 1.5, z: Z0, w: 0.2, h: 1.2, d: D * 0.8, amp: 0.35 });
          break;
        default: cabinet(W, H, D);
      }
      SV.set(s.id, { s, top: topOf(s) });
    }
    P.stations.forEach(buildStation);
    // clean booths around the LCM lines; overhead cable trays and line signs above every line
    const SIGNS = [];
    for (const Ln of Object.values(P.lines)) {
      if (!Ln.stations.length || Ln.kind === 'injection') continue;
      const xs = Ln.stations.map(s => s.x), x0 = Math.min(...Ln.stations.map(s => s.x - s.w / 2)), x1 = Math.max(...Ln.stations.map(s => s.x + s.w / 2)), z = Ln.stations[0].z;
      if (Ln.kind === 'lcm') { sbox('glass', x1 - x0 + 2, 2.7, 4.4, (x0 + x1) / 2, 0, z); sbox('frame', x1 - x0 + 2, 0.08, 0.08, (x0 + x1) / 2, 2.7, z - 2.2); sbox('frame', x1 - x0 + 2, 0.08, 0.08, (x0 + x1) / 2, 2.7, z + 2.2); sbox('fixture', x1 - x0, 0.03, 0.3, (x0 + x1) / 2, 2.66, z); }
      if (Ln.kind === 'main' || Ln.kind === 'smd' || Ln.kind === 'lcm' || Ln.kind === 'press') {
        const ty = Ln.kind === 'smd' ? 3.6 : 4.6, tz = z + (Ln.kind === 'smd' ? 0 : -2.6);
        sbox('alu', x1 - x0, 0.08, 0.5, (x0 + x1) / 2, ty, tz);
        for (let x = x0 + 2; x < x1; x += 6) sbox('frame', 0.04, ROOF - ty, 0.04, x, ty, tz);
        void xs;
      }
      if (Ln.kind === 'main' || Ln.kind === 'lcm' || Ln.kind === 'press' || Ln.kind === 'smd') {
        const sw = Ln.kind === 'smd' ? 3.2 : 4.2, sh = sw * 0.1875;
        const sx = x0 - 1.2, sy = Ln.kind === 'smd' ? 2.9 : 4.0;
        const mat = new T.MeshStandardMaterial({ color: 0x000000, emissive: 0xffffff, emissiveMap: signTex(Ln.name, signSub(Ln)), emissiveIntensity: 0.9 });
        const sign = new T.Mesh(new T.PlaneGeometry(sw, sh), mat); sign.position.set(sx + sw / 2, sy, z - (Ln.kind === 'smd' ? 1.4 : 2.4)); sign.raycast = () => {}; world.add(sign);
        const back = new T.Mesh(new T.BoxGeometry(sw + 0.06, sh + 0.06, 0.05), M.frame); back.position.copy(sign.position); back.position.z -= 0.04; back.raycast = () => {}; world.add(back);
        sbox('frame', 0.03, ROOF - sy, 0.03, sx + 0.2, sy, sign.position.z); sbox('frame', 0.03, ROOF - sy, 0.03, sx + sw - 0.2, sy, sign.position.z);
        SIGNS.push({ L: Ln, mesh: sign, mat, model: Ln.model });
      }
    }

    /* ---------------- conveyors (the LCM ones over a bridge) ---------------- */
    const segBase = sg => { const k = sg.from && P.lines[sg.from.line] ? P.lines[sg.from.line].kind : 'main'; return k === 'smd' ? 0.9 : k === 'lcm' ? 0.85 : 0.8; };
    const segW = sg => { const k = sg.from && P.lines[sg.from.line] ? P.lines[sg.from.line].kind : 'main'; return k === 'smd' ? 0.4 : 1.25; };
    const BR = 3.2, RAMP = 4;
    function segY(sg, x) {
      const y0 = segBase(sg);
      if (!sg.bridge) return y0;
      const a = sg.bridge[0], b2 = sg.bridge[1];
      if (x < a - RAMP || x > b2 + RAMP) return y0;
      if (x < a) return y0 + (BR - y0) * (x - (a - RAMP)) / RAMP;
      if (x > b2) return y0 + (BR - y0) * ((b2 + RAMP) - x) / RAMP;
      return BR;
    }
    const BELTS = [];
    for (const sg of P.segs) {
      const w = segW(sg);
      for (let i = 1; i < sg.path.length; i++) {
        const a = sg.path[i - 1], c2 = sg.path[i];
        const xs = [a[0]];
        if (sg.bridge) for (const k of [sg.bridge[0] - RAMP, sg.bridge[0], sg.bridge[1], sg.bridge[1] + RAMP]) if (k > Math.min(a[0], c2[0]) && k < Math.max(a[0], c2[0])) xs.push(k);
        xs.push(c2[0]);
        for (let j = 1; j < xs.length; j++) {
          const x0 = xs[j - 1], x1 = xs[j];
          const z0 = a[1] + (c2[1] - a[1]) * ((x0 - a[0]) / ((c2[0] - a[0]) || 1)), z1 = a[1] + (c2[1] - a[1]) * ((x1 - a[0]) / ((c2[0] - a[0]) || 1));
          const y0 = segY(sg, x0), y1 = segY(sg, x1);
          const len = Math.hypot(x1 - x0, y1 - y0, z1 - z0); if (len < 0.01) continue;
          const ang = Math.atan2(z1 - z0, x1 - x0), pitch = Math.atan2(y1 - y0, Math.hypot(x1 - x0, z1 - z0));
          const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2, my = (y0 + y1) / 2;
          const belt = new T.BoxGeometry(len, 0.05, w * 0.92); belt.rotateZ(pitch); belt.rotateY(-ang); belt.translate(mx, my - 0.1, mz); push('rubber', belt);
          for (const s of [-1, 1]) { const rail = new T.BoxGeometry(len, 0.14, 0.05); rail.rotateZ(pitch); rail.rotateY(-ang); rail.translate(mx - Math.sin(ang) * s * w / 2, my - 0.08, mz + Math.cos(ang) * s * w / 2); push('alu', rail); }
          BELTS.push({ x0, x1, z0, z1, y0, y1, w });
          for (let k = 0; k <= Math.floor(len / 2.4); k++) {
            const t = Math.min(1, (k * 2.4 + 0.4) / len), yy = y0 + (y1 - y0) * t;
            sbox('frame', 0.06, yy - 0.16, w * 0.9, x0 + (x1 - x0) * t, 0, z0 + (z1 - z0) * t, { ry: -ang });
          }
        }
      }
    }

    /* ---------------- stores, supermarkets, silos, line-side stock ---------------- */
    const BV = {};
    const fam = code => (code || '').split('-')[0];
    const loadsI = inst(unitBoxB, M.load, 2600, { color: true, shadow: true });
    const palletsI = inst(unitBox, M.pallet, 1200, { shadow: true });
    function rackBlock(id, x, z, lenX, depZ, levels, bays, deep, kind) {
      const lh = kind === 'pallet' ? 1.45 : 0.62;
      if (kind !== 'floor') {
        for (let i = 0; i <= bays; i++) for (const pz of [-1, 1]) sbox('rack', 0.09, levels * lh + 0.3, 0.09, x - lenX / 2 + i * lenX / bays, 0, z + pz * (depZ / 2 - 0.05));
        for (let l = 0; l < levels; l++) for (const pz of [-1, 1]) sbox(kind === 'pallet' ? 'stripe' : 'rack', lenX, 0.1, 0.07, x, 0.1 + l * lh, z + pz * (depZ / 2 - 0.05));
        for (let i = 0; i <= bays; i++) for (let l = 1; l <= levels; l++) sbox('rack', 0.03, 0.03, depZ, x - lenX / 2 + i * lenX / bays, l * lh - 0.5, z, { rx: 0 });
      }
      const slots = [];
      for (let l = 0; l < levels; l++) for (let i = 0; i < bays; i++) for (let k = 0; k < deep; k++) slots.push({ x: x - lenX / 2 + (i + 0.5) * lenX / bays, y: 0.19 + l * lh, z: z - depZ / 2 + (k + 0.5) * depZ / deep });
      slots.sort((a, b2) => a.y - b2.y || a.x - b2.x || a.z - b2.z);
      BV[id] = { id, x, z, w: lenX, d: depZ, h: levels * lh + 0.3, slots, kind, cw: lenX / bays * 0.86, cd: depZ / deep * 0.86, ch: lh * 0.7 };
    }
    const POS = L.POS;
    for (const id in POS) {
      const [x, z] = POS[id];
      if (id.startsWith('IMP:')) rackBlock(id, x, z + (z < 19 ? -2.6 : 2.6), 5.2, 4.6, 3, 2, 2, 'pallet');
      else if (id.startsWith('LOC:')) rackBlock(id, x, z + (z < 22 ? -2.6 : 2.6), 6.4, 4.6, 3, 2, 2, 'pallet');
      else if (id.startsWith('INJ:')) rackBlock(id, x + 2.2, z, 2.0, 9.6, 3, 1, 6, 'bin');
      else if (id.startsWith('PRS:')) rackBlock(id, x, z + 1.6, 6.2, 1.6, 3, 6, 1, 'bin');
      else if (id.startsWith('PBA:')) rackBlock(id, x, z - 0.9, 6.2, 1.4, 3, 8, 1, 'mag');
      else if (id.startsWith('SVC:')) rackBlock(id, x, z + (z < 140 ? -2.2 : 2.2), 7.6, 2.0, 3, 6, 1, 'bin');
      else if (id === 'HALL:COIL') rackBlock(id, x - 1.5, z - 0.8, 5.0, 1.6, 1, 4, 1, 'floor');
      else if (id === 'HALL:PWD') rackBlock(id, x, z - 0.8, 4.0, 1.6, 1, 4, 1, 'floor');
      else if (id === 'HALL:BRK') rackBlock(id, x - 3.5, z - 0.8, 3.0, 1.4, 2, 3, 1, 'bin');
    }
    const SILOV = {};
    for (const [id, x, z, r, h] of [['SILO:RESIN', 26.4, 43.6, 1.7, 7.2], ['SILO:EPS', 152, 130.6, 1.8, 6.2]]) {
      scyl('alu', r, h, x, 1.3, z, { seg: 32 });
      scyl('alu', r, 0.9, x, 1.3 + h, z, { r2: 0.35, seg: 32 }); scyl('alu', 0.35, 1.3, x, 0, z, { r2: r * 0.2 });
      for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + 0.78; scyl('frame', 0.1, 1.8, x + Math.cos(a) * r * 0.85, 0, z + Math.sin(a) * r * 0.85); }
      for (let i = 0; i < 6; i++) storus('steel', r + 0.02, 0.03, x, 1.5 + i * h / 6, z, { rx: Math.PI / 2 });
      // a level gauge strip on the silo face
      sbox('dark', 0.16, h * 0.9, 0.05, x, 1.6, z + r + 0.03);
      const fill = new T.Mesh(new T.BoxGeometry(0.1, 1, 0.03).translate(0, 0.5, 0), new T.MeshStandardMaterial({ color: 0x000000, emissive: 0x7FB2FF, emissiveIntensity: 1.6 }));
      fill.position.set(x, 1.6, z + r + 0.07); fill.raycast = () => {}; world.add(fill);
      SILOV[id] = { fill, h: h * 0.9, x, z, r };
      BV[id] = { id, x, z, w: r * 2, d: r * 2, h: h + 2, slots: [], kind: 'silo' };
    }
    {
      const y = 5.4, xs = 186.8;
      scyl('steel', 0.13, 130.6 - 48, 152, y, (130.6 + 48) / 2, { rx: Math.PI / 2 });
      scyl('steel', 0.13, xs - 152, (152 + xs) / 2, y, 48, { rz: Math.PI / 2 });
      scyl('steel', 0.13, 118 - 48, xs, y, (118 + 48) / 2, { rx: Math.PI / 2 });
      for (const z of L.LINE_Z) scyl('steel', 0.09, y - 3.4, xs, 3.4, z + 3.6);
      for (let z = 52; z < 130; z += 12) sbox('frame', 0.1, y, 0.1, 152.4, 0, z);
    }
    for (const b of Object.values(E.LS)) {
      if (b.feed === 'conveyor') { BV[b.id] = { id: b.id, x: POS[b.id][0], z: POS[b.id][1], w: 1.4, d: 1.0, h: 1, slots: [], kind: 'conv' }; continue; }
      const [x, z] = POS[b.id];
      // a flow rack with rollers, tilted toward the station
      sbox('rack', 1.5, 0.06, 1.0, x, 0.1, z); sbox('rack', 1.5, 0.06, 1.0, x, 0.75, z);
      for (const [px, pz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) sbox('rack', 0.05, 1.4, 0.05, x + px * 0.72, 0, z + pz * 0.47);
      BV[b.id] = { id: b.id, x, z, w: 1.6, d: 1.1, h: 1.4, slots: [], kind: 'ls' };
    }
    for (let k = 1; k <= 6; k++) {
      const z = L.PRESS_Z[k - 1];
      BV[`WIP:PR${k}:stamped`] = { id: `WIP:PR${k}:stamped`, x: 14.9, z, w: 1.4, d: 1.2, h: 1.2, slots: [], kind: 'wip' };
      BV[`WIP:PR${k}:coated`] = { id: `WIP:PR${k}:coated`, x: 57.2, z, w: 1.4, d: 1.2, h: 1.2, slots: [], kind: 'wip' };
      for (const x of [14.9, 57.2]) sbox('pallet', 1.3, 0.14, 1.1, x, 0, z);
    }
    for (const s of P.fgSlots) { const g = new T.PlaneGeometry(2.3, 1.5); g.rotateX(-Math.PI / 2); g.translate(s.x, 0.011, s.z); push('zone', g); }
    for (const k in L.STOPS) {
      const sp = L.STOPS[k];
      if (k.startsWith('PARK-A')) { sbox('paint2', 0.5, 0.9, 0.3, sp.x, 0, sp.z + 1.1, { r: 0.04 }); sbox('fixture', 0.3, 0.05, 0.02, sp.x, 0.7, sp.z + 0.94); }
    }

    /* ---------------- utilities, maintenance shop, offices ---------------- */
    for (const u of P.util.assets) {
      const x = u.x, z = u.z;
      if (u.kind === 'transformer') { sbox('paint2', 3.0, 2.2, 2.0, x, 0, z, { r: 0.05 }); for (let i = 0; i < 7; i++) sbox('dark', 0.05, 1.8, 2.3, x - 1.2 + i * 0.4, 0.2, z); for (let i = 0; i < 3; i++) scyl('alu', 0.08, 0.6, x - 0.8 + i * 0.8, 2.2, z); }
      else if (u.kind === 'compressor') { sbox('paint', 3.2, 1.8, 1.7, x, 0, z, { r: 0.08 }); scyl('paint2', 0.48, 2.4, x, 2.3, z, { rz: Math.PI / 2 }); }
      else if (u.kind === 'chiller') { sbox('paint', 5.0, 2.0, 2.6, x, 0, z, { r: 0.08 }); for (let i = 0; i < 3; i++) { scyl('dark', 0.62, 0.12, x - 1.6 + i * 1.6, 2.0, z); ANIM.fan.push({ s: null, x: x - 1.6 + i * 1.6, y: 2.14, z, big: true }); } }
      else if (u.kind === 'boiler') { scyl('paint', 1.25, 4.2, x, 0, z, { seg: 28 }); scyl('steel', 0.22, 6.5, x + 1.6, 0, z); sbox('paint2', 2.2, 1.2, 1.6, x - 2, 0, z, { r: 0.05 }); }
      BV['util:' + u.id] = { id: u.id, x, z, w: 5, d: 3, h: 2.5, slots: [], kind: 'util' };
    }
    { sbox('paint2', 4, 0.9, 1.4, 160, 0, 150.5, { r: 0.04 }); sbox('paint2', 4, 0.9, 1.4, 165, 0, 150.5, { r: 0.04 }); sbox('rack', 6, 2.2, 1, 162.5, 0, 153); sbox('glass', 12, 2.4, 0.05, 162, 0, 155); }
    const ROOMV = {};
    {
      sbox('carpet', 54.4, 0.05, 34, 234.6, 0, 19.5);
      for (const [c, r] of ROOMS.map(r2 => [r2[1], r2[2]])) {
        const B = roomBox(c, r), w = B.x1 - B.x0, d = B.z1 - B.z0, cx = (B.x0 + B.x1) / 2, cz = (B.z0 + B.z1) / 2;
        for (const [ax, az, lw, ld] of [[cx, B.z0, w, 0.15], [cx, B.z1, w, 0.15], [B.x0, cz, 0.15, d], [B.x1, cz, 0.15, d]]) {
          const door = (az === B.z1 && !r) || (az === B.z0 && r);
          if (door) { sbox('wall', lw / 2 - 0.9, 1.0, ld, ax - lw / 4 - 0.45, 0.05, az); sbox('wall', lw / 2 - 0.9, 1.0, ld, ax + lw / 4 + 0.45, 0.05, az); }
          else sbox('wall', lw, 1.0, ld, ax, 0.05, az);
          sbox('glass', lw, 2.0, ld * 0.4, ax, 1.05, az);
          sbox('frame', lw, 0.06, ld * 0.6, ax, 3.05, az);
        }
        sbox('fixture', w * 0.6, 0.03, 0.4, cx, 3.0, cz);
      }
      const desk = (x, z) => { sbox('desk', 1.5, 0.05, 0.8, x, 0.73, z); sbox('frame', 1.4, 0.7, 0.05, x, 0.03, z); sbox('dark', 0.62, 0.4, 0.04, x, 0.84, z - 0.25); splane('hmi', 0.58, 0.36, x, 1.04, z - 0.22); sbox('plastic', 0.55, 0.5, 0.55, x, 0, z + 0.62, { r: 0.05 }); };
      for (const [id, c, r] of ROOMS) {
        const B = roomBox(c, r), cx = (B.x0 + B.x1) / 2, cz = (B.z0 + B.z1) / 2;
        const seats = [];
        if (id === 'it') {
          for (const [x, z] of [[251.4, 27.6], [255.6, 27.6], [259.6, 27.6], [251.4, 33.2]]) { sbox('dark', 0.8, 2.2, 1.1, x, 0.05, z, { r: 0.02 }); }
          for (let i = 0; i < 2; i++) { desk(B.x0 + 2.2, B.z0 + 3 + i * 3.4); seats.push([B.x0 + 2.2, B.z0 + 3.6 + i * 3.4]); }
        } else if (id === 'planning') {
          sbox('desk', 6.2, 0.06, 2.2, cx, 0.74, cz + 1, { r: 0.02 }); sbox('frame', 5.8, 0.72, 0.1, cx, 0.03, cz + 1);
          sbox('dark', 4.2, 1.6, 0.08, cx, 1.1, B.z0 + 0.4); splane('sop', 3.9, 1.3, cx, 1.9, B.z0 + 0.45);
          for (let i = 0; i < 5; i++) for (const s2 of [-1, 1]) seats.push([cx - 2.4 + i * 1.2, cz + 1 + s2 * 1.6]);
        } else if (id === 'quality') {
          for (let i = 0; i < 3; i++) { sbox('paint2', 3.2, 0.9, 1.0, B.x0 + 2.4, 0.05, B.z0 + 2.4 + i * 3.6, { r: 0.03 }); seats.push([B.x0 + 2.4, B.z0 + 3.4 + i * 3.6]); }
          sbox('frame', 0.1, 0.9, 0.1, B.x1 - 3, 0.05, cz); sbox('tv', 1.4, 0.82, 0.05, B.x1 - 3, 0.95, cz); splane('screen', 1.32, 0.74, B.x1 - 3, 1.36, cz + 0.03);
          for (let i = 0; i < 2; i++) { desk(B.x1 - 3 + (i ? 0 : -2.5), B.z1 - 2.2); seats.push([B.x1 - 3 + (i ? 0 : -2.5), B.z1 - 1.6]); }
        } else {
          for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) { const x = B.x0 + 2.2 + i * 3.1, z = B.z0 + 4 + j * (B.z1 - B.z0 - 7); desk(x, z); seats.push([x, z + 0.6]); }
          sbox('dark', 2.6, 1.3, 0.06, cx, 1.0, r ? B.z1 - 0.3 : B.z0 + 0.3); splane('hmi', 2.4, 1.1, cx, 1.65, r ? B.z1 - 0.34 : B.z0 + 0.34, r ? Math.PI : 0);
        }
        ROOMV[id] = { id, x: cx, z: cz, w: B.x1 - B.x0, d: B.z1 - B.z0, seats, B };
        BV['dept:' + id] = { id: 'dept:' + id, x: cx, z: cz, w: B.x1 - B.x0, d: B.z1 - B.z0, h: 3, slots: [], kind: 'room' };
      }
    }
    { sbox('paint2', 3.2, 0.9, 1.2, 252, 0, 160, { r: 0.04 }); sbox('carton', 0.6, 0.4, 0.5, 251.5, 0.9, 160); }
    finalize();

    /* ---------------- dynamic machine parts (instanced) ---------------- */
    const NST = P.stations.length;
    const lampGeo = new T.CylinderGeometry(0.075, 0.075, 0.1, 14);
    const stackI = inst(lampGeo, M.lamp, NST * 3, { color: true });
    const poleI = inst(new T.CylinderGeometry(0.022, 0.022, 1, 6).translate(0, 0.5, 0), M.steel, NST);
    const stripI = inst(new T.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), M.flat, NST * 4 + 400, { color: true, order: 3 });
    const tileI = inst(new T.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), M.flat, NST + 80, { color: true, order: 2 });
    const beamI = inst(unitBox, M.frame, ANIM.gantry.length * 2, { shadow: true });
    const baseI = inst(new T.CylinderGeometry(0.2, 0.26, 1, 20).translate(0, 0.5, 0), M.frame, ANIM.arm.length, { shadow: true });
    const turretI = inst(new T.CylinderGeometry(0.17, 0.17, 1, 16).translate(0, 0.5, 0), M.paint, ANIM.arm.length, { shadow: true });
    const linkI = inst(new T.BoxGeometry(0.24, 1, 0.27).translate(0, 0.5, 0), M.paint2, ANIM.arm.length * 2, { shadow: true });
    const jointI = inst(new T.SphereGeometry(0.17, 14, 10), M.frame, ANIM.arm.length * 3, { shadow: true });
    const toolI = inst(new T.BoxGeometry(0.22, 0.16, 0.22), M.frame, ANIM.arm.length, { shadow: true });
    const platenI = inst(unitBox, M.steel, ANIM.platen.length + ANIM.ram.length, { shadow: true });
    const fanI = inst(new T.BoxGeometry(1, 0.02, 0.06), M.dark, ANIM.fan.length * 2);
    const hangI = inst(new T.BoxGeometry(0.06, 0.9, 0.7).translate(0, -0.45, 0), M.plastic, 700);
    const hitI = inst(unitBox, M.hit, NST + 400, { pick: true });
    const rackLedI = inst(new T.BoxGeometry(0.03, 0.03, 0.02), M.lamp, 4 * 24, { color: true });

    /* ---------------- units and pallets (instanced) ---------------- */
    const U = {
      board: inst(new T.BoxGeometry(0.3, 0.02, 0.22), M.pcb, 900, { pick: true }),
      carrier: inst(unitBox, M.tray, 420, { pick: true }),
      panel: inst(unitBox, M.tv, 900, { pick: true }),
      screen: inst(new T.PlaneGeometry(1, 1), M.screen, 420),
      carton: inst(unitBox, M.carton, 300, { pick: true }),
      palBase: inst(unitBox, M.pallet, 420, { pick: true }),
      palLoad: inst(unitBoxB, M.carton, 420, { pick: true }),
      palWrap: inst(unitBoxB, M.wrap, 420)
    };
    const modelOf = m => E.MODELS[m] || E.MODELS.M55;
    const unitPos = new Map();
    function polyAt(p, s) {
      for (let i = 1; i < p.length; i++) {
        const d = Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]);
        if (s <= d || i === p.length - 1) { const k = d ? Math.min(1, Math.max(0, s / d)) : 0; return [p[i - 1][0] + (p[i][0] - p[i - 1][0]) * k, p[i - 1][1] + (p[i][1] - p[i - 1][1]) * k, Math.atan2(p[i][1] - p[i - 1][1], p[i][0] - p[i - 1][0])]; }
        s -= d;
      }
      return [p[0][0], p[0][1], 0];
    }
    function drawUnit(u, x, y, z, onLine) {
      unitPos.set(u, [x, y, z]);
      const ref = 'unit:' + u.sn;
      if (u.type === 'pba') { put(U.board, x, y + 0.01, z, 1, 1, 1, 0, 0, 0, ref); return; }
      const m = modelOf(u.model);
      if (u.type === 'lcm') { put(U.panel, x, y + 0.03, z, m.h, 0.03, m.w, 0, 0, 0, ref); return; }
      if (u.packed) { put(U.carton, x, y + 0.14, z, m.h + 0.16, 0.24, m.w + 0.16, 0, 0, 0, ref); return; }
      if (onLine) put(U.carrier, x, y + 0.02, z, Math.max(1.0, m.h + 0.1), 0.05, Math.min(1.3, m.w * 0.82), 0, 0, 0, ref);
      put(U.panel, x, y + 0.08, z, m.h, 0.06, m.w, 0, 0, 0, ref);
    }
    function drawUnits() {
      for (const k in U) U[k].count = 0;
      unitPos.clear();
      for (const sg of P.segs) for (const it of sg.items) { const p = polyAt(sg.path, it.s); drawUnit(it.u, p[0], segY(sg, p[0]) - 0.06, p[1], true); }
      for (const s of P.stations) {
        if (s.kind === 'aging') {
          (s.rack || []).forEach((u, i) => {
            const side = i % 2 ? 1 : -1, k = Math.floor(i / 2), bay = k % 10, tier = Math.floor(k / 10);
            const m = modelOf(u.model), x = s.x - s.w / 2 + (bay + 0.5) * s.w / 10, y = 0.36 + tier * 0.95 + m.h * 0.5, z = s.z + side * 1.0;
            const sc = Math.min(1, 1.5 / m.w);
            put(U.panel, x, y, z, m.w * sc, m.h * sc, 0.06, 0, 0, 0, 'unit:' + u.sn);
            put(U.screen, x, y, z + side * 0.035, m.w * sc * 0.96, m.h * sc * 0.94, 1, side > 0 ? 0 : Math.PI);
            unitPos.set(u, [x, y, z]);
          });
          continue;
        }
        if (!s.procs.length || s.batchOut) continue;
        const y = s.kind === 'reflow' ? 0.86 : s.kind === 'bench' || s.kind === 'blu' || s.kind === 'repair' ? 0.92 : s.kind === 'robot' || s.kind === 'lcmload' ? 0.84 : Math.min(0.95, s.h * 0.5);
        s.procs.forEach((pr, i) => {
          let x = s.x;
          if (s.kind === 'reflow') { const tot = s.base * s.slots; x = s.x - s.w * 0.42 + s.w * 0.84 * (1 - Math.max(0, pr.left) / tot); }
          else if (s.slots > 1) x += (i - (s.procs.length - 1) / 2) * (s.w / (s.slots + 1));
          if (pr.u) drawUnit(pr.u, x, y, s.z, s.kind !== 'bench' && s.kind !== 'blu');
        });
      }
      for (const p of P.pallets) {
        if (p.where === 'truck') continue;
        let x = p.x, z = p.z, y = 0, yaw = 0;
        if (p.where === 'fork') { const f = P.forklifts.find(f2 => f2.load === p); if (f) { x = f.x + Math.cos(f.h) * 1.3; z = f.z + Math.sin(f.h) * 1.3; y = 0.25; yaw = -f.h; } }
        else if (p.where === 'fg' && p.slot) { x = p.slot.x; z = p.slot.z; }
        const m = modelOf(p.model), layers = Math.ceil(p.units.length / 2), h = layers * (m.h + 0.16) * 0.5 + 0.02;
        const ref = 'pal:' + p.id;
        put(U.palBase, x, y + 0.07, z, 1.2, 0.14, 1.0, yaw, 0, 0, ref);
        if (p.units.length) put(U.palLoad, x, y + 0.14, z, Math.min(1.5, m.w * 0.62 + 0.1), Math.min(2.2, h), 1.0, yaw, 0, 0, ref);
        if (p.where !== 'build' && p.units.length >= p.cap) put(U.palWrap, x, y + 0.14, z, Math.min(1.54, m.w * 0.62 + 0.14), Math.min(2.24, h + 0.03), 1.04, yaw);
        unitPos.set(p, [x, y + 0.8, z]);
      }
      for (const k in U) done(U[k]);
    }

    /* ---------------- vehicles ---------------- */
    function model(parts) {
      const g = new T.Group(), by = {};
      for (const [mat, geo] of parts) (by[mat] = by[mat] || []).push(strip(geo));
      for (const k in by) { const idx = by[k].filter(x => x.index), non = by[k].filter(x => !x.index); for (const set of [idx, non]) { if (!set.length) continue; const m = new T.Mesh(T.mergeGeometries(set, false), M[k]); m.castShadow = true; m.receiveShadow = true; g.add(m); } }
      world.add(g); return g;
    }
    const gb = (w, h, d, x, y, z, r) => (r && !low ? new T.RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001)) : new T.BoxGeometry(w, h, d)).translate(x, y + h / 2, z);
    const gc = (r, h, x, y, z, rx = 0) => { const c2 = new T.CylinderGeometry(r, r, h, 16); if (rx) c2.rotateX(rx); return c2.translate(x, y, z); };
    const VEH = new Map();
    const tagV = (g, ref) => g.traverse(o => { if (o.isMesh) { o.userData.ref = ref; PICK.push(o); } });
    for (const a of P.agvs) {
      const g = model([['agv', gb(1.12, 0.3, 0.74, 0, 0.07, 0, 0.06)], ['stripe', gb(1.13, 0.04, 0.75, 0, 0.2, 0)], ['dark', gc(0.07, 0.07, 0.42, 0.42, 0)], ['rubber', gc(0.08, 0.06, 0.35, 0.08, 0.39, Math.PI / 2)], ['rubber', gc(0.08, 0.06, -0.35, 0.08, 0.39, Math.PI / 2)], ['rubber', gc(0.08, 0.06, 0.35, 0.08, -0.39, Math.PI / 2)], ['rubber', gc(0.08, 0.06, -0.35, 0.08, -0.39, Math.PI / 2)]]);
      const load = new T.Mesh(new T.BoxGeometry(0.9, 0.5, 0.6).translate(0, 0.63, 0), M.mag); load.castShadow = true; g.add(load);
      tagV(g, 'agv:' + a.id); VEH.set(a.id, { g, load, v: a });
    }
    for (const t of P.tuggers) {
      const parts = [['cab', gb(1.5, 0.9, 0.95, 0, 0.18, 0, 0.08)], ['dark', gb(0.5, 0.55, 0.62, -0.3, 1.08, 0, 0.05)], ['frame', gb(0.06, 1.25, 0.9, 0.55, 1.08, 0)], ['frame', gb(1.3, 0.05, 0.95, 0, 2.3, 0)]];
      for (const [px, pz] of [[-0.5, 0.42], [-0.5, -0.42], [0.5, 0.42], [0.5, -0.42]]) parts.push(['rubber', gc(0.2, 0.15, px, 0.2, pz, Math.PI / 2)]);
      const g = model(parts); tagV(g, 'tug:' + t.id);
      const carts = [];
      for (let i = 0; i < 3; i++) {
        const cp = [['frame', gb(1.9, 0.05, 0.95, 0, 0.35, 0)], ['frame', gb(1.9, 0.05, 0.95, 0, 0.95, 0)]];
        for (const [px, pz] of [[-0.92, -0.45], [0.92, 0.45], [0.92, -0.45], [-0.92, 0.45]]) cp.push(['rack', gb(0.05, 1.0, 0.05, px, 0.25, pz)]);
        cp.push(['rubber', gc(0.14, 0.1, -0.6, 0.14, 0.45, Math.PI / 2)], ['rubber', gc(0.14, 0.1, 0.6, 0.14, -0.45, Math.PI / 2)], ['rubber', gc(0.14, 0.1, -0.6, 0.14, -0.45, Math.PI / 2)], ['rubber', gc(0.14, 0.1, 0.6, 0.14, 0.45, Math.PI / 2)]);
        const cg = model(cp);
        const ld = new T.Mesh(new T.BoxGeometry(1.7, 0.5, 0.8).translate(0, 0.4 + 0.25, 0), M.carton); ld.castShadow = true; cg.add(ld);
        tagV(cg, 'tug:' + t.id); carts.push({ g: cg, ld });
      }
      VEH.set(t.id, { g, carts, v: t, trail: [] });
    }
    for (const f of P.forklifts) {
      const parts = [['cab', gb(1.3, 1.0, 0.95, -0.2, 0.18, 0, 0.08)], ['frame', gb(0.9, 0.06, 0.95, -0.2, 2.1, 0)], ['dark', gb(1.2, 0.05, 0.12, 1.1, 0.12, -0.25)], ['dark', gb(1.2, 0.05, 0.12, 1.1, 0.12, 0.25)], ['dark', gb(0.5, 0.45, 0.9, -0.75, 0.6, 0, 0.05)]];
      for (const pz of [-0.42, 0.42]) parts.push(['frame', gb(0.05, 1.95, 0.05, -0.62, 0.15, pz)], ['steel', gb(0.07, 2.4, 0.08, 0.5, 0, pz * 0.8)]);
      for (const [px, pz] of [[-0.6, -0.45], [-0.6, 0.45], [0.3, -0.45], [0.3, 0.45]]) parts.push(['rubber', gc(0.18, 0.13, px, 0.18, pz, Math.PI / 2)]);
      const g = model(parts);
      const load = new T.Mesh(new T.BoxGeometry(1.0, 0.9, 1.0).translate(1.1, 0.62, 0), M.load); load.castShadow = true; g.add(load);
      tagV(g, 'fl:' + f.id); VEH.set(f.id, { g, load, v: f });
    }
    function truckModel(len, ref) {
      const parts = [['truck', gb(len, 2.7, 2.5, 0, 1.05, 0, 0.05)], ['cab', gb(2.3, 2.4, 2.4, len / 2 + 1.35, 0.6, 0, 0.12)], ['glass', gb(0.05, 0.9, 2.2, len / 2 + 2.5, 1.9, 0)], ['frame', gb(len, 0.25, 2.2, 0, 0.75, 0)]];
      for (const px of [-len / 2 + 1.2, -len / 2 + 2.6, len / 2 + 1.0]) for (const pz of [-1.05, 1.05]) parts.push(['rubber', gc(0.5, 0.32, px, 0.5, pz, Math.PI / 2)]);
      const g = model(parts); tagV(g, ref); return g;
    }
    const TRK = new Map(), INB = new Map();

    /* ---------------- people (instanced) ---------------- */
    const bodyI = inst(new T.CapsuleGeometry(0.2, 0.78, 4, 10), M.person, 900, { color: true, pick: true, shadow: true });
    const headI = inst(new T.SphereGeometry(0.12, 12, 8), M.skin, 900, { shadow: true });
    const OFFICE = [];
    {
      let k = 0;
      for (const d of X.DEPTS) {
        const r = ROOMV[d.id]; if (!r) continue;
        const n = Math.min(r.seats.length, Math.max(2, Math.round(d.staff / 3)));
        for (let i = 0; i < n; i++) OFFICE.push({ id: 'O' + (++k), dept: d.id, x: r.seats[i][0], z: r.seats[i][1] });
      }
    }

    /* ---------------- data packets between the floor, GMES, SAP and the offices ---------------- */
    const pktI = inst(new T.SphereGeometry(0.34, 10, 6), M.pkt, 900, { order: 4 });
    const packets = [];
    let pktSkip = 0;
    function posOfRef(ref) {
      if (!ref) return null;
      if (P.byId[ref]) { const s = P.byId[ref]; return [s.x, (SV.get(ref) || { top: 2 }).top + 0.6, s.z]; }
      if (ref.startsWith('order:')) { const o = P.orders.find(o2 => o2.id === ref.slice(6)); if (o && o.truck) return [o.truck.dock.x - 1, 3, o.truck.dock.z]; return [234, 2, 82]; }
      if (ref.startsWith('svc:')) return [234, 2, 146];
      if (ref.startsWith('mrp:') || ref === 'sop') return [ROOMV.planning.x, 2, ROOMV.planning.z];
      if (BV[ref]) return [BV[ref].x, BV[ref].h + 0.4, BV[ref].z];
      return null;
    }
    const sysPos = id => {
      if (SYSPOS[id]) return [SYSPOS[id][0], 2.6, SYSPOS[id][1]];
      if (id === 'SOP') return [ROOMV.planning.x, 2.2, ROOMV.planning.z];
      if (id === 'HR') return [ROOMV.hr.x, 2.2, ROOMV.hr.z];
      return [255, 2.6, 28];
    };
    function arc(a, b2) {
      const d = Math.hypot(b2[0] - a[0], b2[2] - a[2]), top = Math.max(a[1], b2[1]), lift = 3 + d * 0.06;
      return t => [a[0] + (b2[0] - a[0]) * t, a[1] + (b2[1] - a[1]) * t + 4 * lift * t * (1 - t) + 0 * top, a[2] + (b2[2] - a[2]) * t];
    }
    function packet(m) {
      if (packets.length > 160) return;
      if (overlay !== 'data' && (++pktSkip % 2)) return;
      const hops = [];
      const src = posOfRef(m.ref) || (m.line && P.lines[m.line] ? (() => { const s = P.lines[m.line].stations[0]; return [s.x, 2.5, s.z]; })() : null);
      const f = sysPos(m.from), t = sysPos(m.to);
      if (src && (m.from === 'GMES' || m.from === 'WMS' || (m.from === 'PLM' && m.to === 'GMES'))) {
        if (m.from === 'PLM' && m.to === 'GMES') hops.push(arc(f, t), arc(t, src));
        else { hops.push(arc(src, f)); if (f[0] !== t[0] || f[2] !== t[2]) hops.push(arc(f, t)); }
      } else {
        hops.push(arc(f, t));
        if (src && (m.to === 'GMES' || m.to === 'WMS')) hops.push(arc(t, src));
      }
      packets.push({ hops, t: 0, dur: 1.4 + hops.length * 0.7 });
    }
    E.on((type, d) => { if (type === 'msg') packet(d); });
    const netLines = (() => {
      const pts = [], hub = [255.6, 27.6];
      for (const z of L.ZONES) { if (z.id === 'office') continue; const cx = (z.x0 + z.x1) / 2, cz = (z.z0 + z.z1) / 2; pts.push([hub[0], hub[1], 8], [hub[0], cz, 8], [hub[0], cz, 8], [cx, cz, 8], [cx, cz, 8], [cx, cz, 0.1]); }
      const l = lines(world, pts, M.net, 8); l.visible = false; return l;
    })();

    /* ---------------- selection reticle, route line, flow chevrons ---------------- */
    const reticle = new T.Mesh(cornersGeo(1, 1, 0.35, 0.09), M.sel); reticle.position.y = 0.05; reticle.visible = false; world.add(reticle);
    let retW = 0, retD = 0;
    function setReticle(info) {
      retW = info.w; retD = info.d;
      const w = info.w + 1.2, d = info.d + 1.2, len = Math.min(w, d) * 0.28 + 0.3, t = Math.max(0.12, Math.min(0.45, Math.max(w, d) * 0.03));
      reticle.geometry.dispose(); reticle.geometry = cornersGeo(w, d, len, t);
    }
    let routeLine = null;
    const chev = (() => {
      const s = new T.Shape(); s.moveTo(0.45, 0); s.lineTo(-0.25, 0.28); s.lineTo(-0.1, 0); s.lineTo(-0.25, -0.28); s.lineTo(0.45, 0);
      const g = new T.ShapeGeometry(s); g.rotateX(-Math.PI / 2);
      const m = new T.InstancedMesh(g, new T.MeshBasicMaterial({ color: S.info, transparent: true, opacity: 0.9, side: T.DoubleSide, depthWrite: false, toneMapped: false }), 2400);
      m.count = 0; m.frustumCulled = false; m.renderOrder = 3; m.raycast = () => {}; world.add(m); return m;
    })();

    /* ---------------- theme ---------------- */
    let xray = false;
    function applyTheme() {
      C = PAL[theme]; S = STATUS[theme];
      scene.background = new T.Color(C.bg); scene.fog.color.set(C.fog); if (vig) vig.uniforms.amount.value = theme === 'dark' ? 0.38 : 0.22;
      scene.environmentIntensity = C.env;
      hemi.color.set(C.hemi[0]); hemi.groundColor.set(C.hemi[1]); hemi.intensity = C.hemi[2]; sun.intensity = C.sun; amb.intensity = C.amb;
      renderer.toneMappingExposure = C.exp;
      for (const k of ['floor', 'zone', 'paint', 'paint2', 'frame', 'dark', 'steel', 'alu', 'rubber', 'rack', 'beam', 'glass', 'pcb', 'tv', 'carton', 'pallet', 'tray', 'agv', 'stripe', 'truck', 'cab', 'mag', 'plastic', 'desk', 'carpet', 'wall', 'skin']) M[k].color.set(C[k]);
      M.floorLine.color.set(C.floorLine); M.fixture.emissiveIntensity = C.fixture; M.lights.emissiveIntensity = C.fixture; M.roof.color.set(C.beam);
      M.sel.color.set(S.info); M.route.color.set(S.info); chev.material.color.set(S.info); M.pkt.color.set(C.pkt); M.net.color.set(C.net);
      world.traverse(o => { if (o.userData && o.userData.floorWord) o.material.opacity = theme === 'dark' ? 0.22 : 0.55; });
      if (bloom) bloom.strength = C.bloom;
      setXray(xray);
    }
    function setXray(v) {
      xray = !!v;
      for (const k of XRAY) { const m = M[k]; if (k === 'glass') continue; m.transparent = xray; m.opacity = xray ? 0.16 : 1; m.depthWrite = !xray; m.needsUpdate = true; }
    }

    /* ---------------- per-frame view ---------------- */
    let overlay = 'status';
    const STATE_C = st => (st === 'down' ? S.bad : st === 'maint' ? S.maint : st === 'micro' || st === 'warn' || st === 'starved' || st === 'changeover' ? S.warn : null);
    const dim = new T.Color(), lit = new T.Color();
    function ramp(k) { const a = new T.Color(theme === 'dark' ? 0x2A2F38 : 0xDDE2E8), b2 = new T.Color(theme === 'dark' ? 0x2189FF : 0x1428A0); return a.lerp(b2, Math.max(0, Math.min(1, k))).getHex(); }
    function frameAround(x, z, w, d, c, t = 0.22) {
      put(stripI, x, 0.035, z - d / 2, w + t, 1, t, 0, 0, 0, undefined, c); put(stripI, x, 0.035, z + d / 2, w + t, 1, t, 0, 0, 0, undefined, c);
      put(stripI, x - w / 2, 0.035, z, t, 1, d, 0, 0, 0, undefined, c); put(stripI, x + w / 2, 0.035, z, t, 1, d, 0, 0, 0, undefined, c);
    }
    let tAnim = 0;
    const KWMAX = { injection: 60, oven: 95, reflow: 46, press: 40, cushion: 32 };
    const m4 = new T.Matrix4(), m5 = new T.Matrix4(), m6 = new T.Matrix4(), v3 = new T.Vector3();
    function updateMachines(dt) {
      tAnim += dt;
      stackI.count = poleI.count = stripI.count = tileI.count = hitI.count = 0;
      for (const s of P.stations) {
        const v = SV.get(s.id), st = s.state;
        // a three-lamp stack light: red, amber, green; the lit lamp glows (bloom), the others stay dark glass
        const ax = s.x + s.w / 2 - 0.18, az = s.z - s.d / 2 + 0.18;
        put(poleI, ax, v.top, az, 1, 0.42, 1);
        const red = st === 'down', amber = st === 'warn' || st === 'micro' || st === 'starved' || st === 'changeover' || st === 'maint', green = st === 'run';
        const blink = (red || amber) ? (Math.sin(tAnim * 6) > -0.2 ? 1 : 0.15) : 1;
        put(stackI, ax, v.top + 0.48, az, 1, 1, 1, 0, 0, 0, undefined, lit.set(st === 'maint' ? S.maint : S.bad).multiplyScalar(red ? 3.2 * blink : 0.12));
        put(stackI, ax, v.top + 0.6, az, 1, 1, 1, 0, 0, 0, undefined, lit.set(S.warn).multiplyScalar(amber ? 3.0 * blink : 0.12));
        put(stackI, ax, v.top + 0.72, az, 1, 1, 1, 0, 0, 0, undefined, lit.set(S.ok).multiplyScalar(green ? 2.4 : 0.12));
        const sc = STATE_C(st);
        if (sc && overlay !== 'energy') frameAround(s.x, s.z, s.w + 0.9, s.d + 0.9, sc, Math.min(0.5, 0.18 + Math.max(s.w, s.d) * 0.004));
        if (overlay === 'energy') put(tileI, s.x, 0.03, s.z, s.w + 0.8, 1, s.d + 0.8, 0, 0, 0, undefined, ramp((s.kwNow || 0) / (KWMAX[s.kind] || 8)));
        else if (overlay === 'quality' && (s.kind === 'aoi' || s.kind === 'fct' || s.kind === 'qa' || s.kind === 'ict' || s.kind === 'lighting')) {
          const tot = s.counters.made + s.counters.bad, r = tot ? s.counters.bad / tot : 0;
          if (r > 0.006) put(tileI, s.x, 0.03, s.z, s.w + 0.8, 1, s.d + 0.8, 0, 0, 0, undefined, r > 0.02 ? S.bad : S.warn);
        } else if (overlay === 'people' && s.manual) {
          const miss = s.crew.filter(p => !p.present).length;
          if (miss) put(tileI, s.x, 0.03, s.z, s.w + 0.8, 1, s.d + 0.8, 0, 0, 0, undefined, miss >= s.staff ? S.bad : S.warn);
        }
        put(hitI, s.x, s.h / 2, s.z, s.w, Math.max(1, s.h), s.d, 0, 0, 0, 'st:' + s.id);
      }
      for (const id in BV) { const b = BV[id]; put(hitI, b.x, b.h / 2, b.z, b.w, b.h, b.d, 0, 0, 0, b.kind === 'room' ? id : b.kind === 'util' ? 'util:' + b.id : 'buf:' + id); }
      beamI.count = baseI.count = turretI.count = linkI.count = jointI.count = toolI.count = platenI.count = fanI.count = 0;
      const on = s => s && (s.state === 'run' || s.state === 'warn');
      for (const a of ANIM.gantry) {
        const s = a.s, t = on(s) ? tAnim * a.rate * (s.state === 'warn' ? 0.6 : 1) : 0;
        const bx = s.x + (a.offX || 0) + Math.sin(t + s.x) * a.amp;
        put(beamI, bx, a.y, s.z, 0.12, 0.08, a.len); put(beamI, bx, a.y - 0.14, s.z + Math.sin(t * 2.4 + s.z) * a.len * 0.38, 0.2, 0.2, 0.2);
      }
      // six-axis robots by forward kinematics: base → turret (yaw) → upper arm (shoulder) → forearm (elbow) → tool
      for (const a of ANIM.arm) {
        const s = a.s, t = on(s) ? tAnim * a.rate + s.x * 0.37 : s.x * 0.37, k = a.k;
        const yaw = Math.sin(t) * 1.4, sh = -0.55 + Math.sin(t * 1.3) * 0.35, el = 1.2 + Math.sin(t * 1.7 + 1) * 0.35;
        put(baseI, a.x, a.y, a.z, k, 0.18 * k, k);
        put(turretI, a.x, a.y + 0.18 * k, a.z, k, 0.28 * k, k, yaw);
        m4.makeRotationY(yaw).setPosition(a.x, a.y + 0.42 * k, a.z);
        m5.makeRotationZ(sh); m4.multiply(m5);
        putM(jointI, m6.copy(m4).multiply(new T.Matrix4().makeScale(k, k, k)));
        putM(linkI, m6.copy(m4).multiply(new T.Matrix4().makeScale(k, 0.85 * k, k)));
        m5.makeTranslation(0, 0.85 * k, 0); m4.multiply(m5); m5.makeRotationZ(-el); m4.multiply(m5);
        putM(jointI, m6.copy(m4).multiply(new T.Matrix4().makeScale(0.85 * k, 0.85 * k, 0.85 * k)));
        putM(linkI, m6.copy(m4).multiply(new T.Matrix4().makeScale(0.85 * k, 0.75 * k, 0.85 * k)));
        m5.makeTranslation(0, 0.75 * k, 0); m4.multiply(m5);
        putM(jointI, m6.copy(m4).multiply(new T.Matrix4().makeScale(0.6 * k, 0.6 * k, 0.6 * k)));
        m5.makeRotationZ(sh * 0.5 + el * 0.5 - 0.6); m4.multiply(m5); m5.makeTranslation(0, 0.12 * k, 0); m4.multiply(m5);
        putM(toolI, m6.copy(m4).multiply(new T.Matrix4().makeScale(k, k, k)));
      }
      for (const a of ANIM.platen) { const t = on(a.s) ? tAnim * (a.s.kind === 'injection' ? 0.9 : 0.6) + a.s.z : a.s.z; put(platenI, a.x + (0.5 + 0.5 * Math.sin(t)) * a.amp, a.y + a.h / 2, a.z, a.w, a.h, a.d); }
      for (const a of ANIM.ram) { const t = on(a.s) ? tAnim * 1.8 + a.s.z : 1.6; put(platenI, a.x, a.y + (0.5 + 0.5 * Math.cos(t)) * a.amp + a.h / 2, a.z, a.w, a.h, a.d); }
      for (const a of ANIM.fan) { const sp = !a.s || on(a.s) ? tAnim * (a.big ? 6 : 9) : 0, r = a.big ? 1.1 : 0.3; put(fanI, a.x, a.y, a.z, r, 1, 1, sp); put(fanI, a.x, a.y, a.z, r, 1, 1, sp + Math.PI / 2); }
      hangI.count = 0;
      for (const s of P.stations) if (s.kind === 'oven') {
        const tot = s.base * s.slots;
        for (const pr of s.procs) { const k = 1 - Math.max(0, pr.left) / tot; put(hangI, s.x - s.w / 2 + s.w * k, 2.8, s.z, 1, 1, 1); }
      }
      // server racks: blinking network and disk lights
      rackLedI.count = 0;
      for (const [rx, rz] of [[251.4, 27.6], [255.6, 27.6], [259.6, 27.6], [251.4, 33.2]]) for (let i = 0; i < 24; i++) {
        const on2 = Math.sin(tAnim * (3 + (i % 5)) + i * 1.7 + rx) > 0.2;
        put(rackLedI, rx - 0.25 + (i % 4) * 0.16, 0.4 + Math.floor(i / 4) * 0.3, rz + 0.57, 1, 1, 1, 0, 0, 0, undefined, lit.set(i % 7 === 3 ? S.warn : S.ok).multiplyScalar(on2 ? 2.4 : 0.15));
      }
      done(stackI, poleI, stripI, tileI, hitI, beamI, baseI, turretI, linkI, jointI, toolI, platenI, fanI, hangI, rackLedI);
      void dim; void v3;
    }
    function updateStock() {
      loadsI.count = 0; palletsI.count = 0;
      const dk = theme === 'dark' ? 0.55 : 1;
      const lc = code => col.set(LOADC[fam(code)] || 0xB8BEC8).multiplyScalar(dk).getHex();
      for (const id in BV) {
        const v = BV[id], b = P.bufs[id]; if (!b) continue;
        const lvl = E.level(b), k = Math.max(0, Math.min(1, lvl / (b.cap || 1)));
        if (v.kind === 'pallet' || v.kind === 'bin' || v.kind === 'mag' || v.kind === 'floor') {
          const n = Math.round(k * v.slots.length); const c = v.kind === 'mag' ? col.set(C.mag).getHex() : lc(b.code);
          for (let i = 0; i < n; i++) {
            const s = v.slots[i];
            if (v.kind === 'pallet') put(palletsI, s.x, s.y + 0.07, s.z, v.cw, 0.13, v.cd * 0.95);
            put(loadsI, s.x, s.y + (v.kind === 'pallet' ? 0.14 : 0.02), s.z, v.cw * 0.95, v.ch, v.cd * 0.9, 0, 0, 0, undefined, c);
          }
        } else if (v.kind === 'ls' || v.kind === 'wip' || v.kind === 'conv') {
          const h = Math.max(0.03, k * (v.kind === 'wip' ? 1.0 : 0.6));
          if (lvl > 0) put(loadsI, v.x, v.kind === 'conv' ? 0 : 0.16, v.z, v.kind === 'conv' ? 1.2 : 1.3, h, 0.85, 0, 0, 0, undefined, lc(b.code));
          if (v.kind === 'ls' && overlay !== 'energy') { const late = lvl <= 0 ? S.bad : lvl <= b.rop * 0.5 && !b.pending ? S.warn : null; if (late) frameAround(v.x, v.z, 1.8, 1.3, late, 0.14); }
        } else if (v.kind === 'silo') { const sv = SILOV[id]; sv.fill.scale.y = Math.max(0.02, k * sv.h); }
      }
      done(loadsI, palletsI, stripI);
    }
    function trailPush(v, x, z) { const tr = v.trail; const l = tr[tr.length - 1]; if (!l || Math.hypot(l[0] - x, l[1] - z) > 0.25) { tr.push([x, z]); if (tr.length > 80) tr.shift(); } }
    function trailAt(v, dist) {
      const tr = v.trail; let d = 0;
      for (let i = tr.length - 1; i > 0; i--) { const s = Math.hypot(tr[i][0] - tr[i - 1][0], tr[i][1] - tr[i - 1][1]); if (d + s >= dist) { const k = (dist - d) / s; return [tr[i][0] + (tr[i - 1][0] - tr[i][0]) * k, tr[i][1] + (tr[i - 1][1] - tr[i][1]) * k, Math.atan2(tr[i][1] - tr[i - 1][1], tr[i][0] - tr[i - 1][0])]; } d += s; }
      const v0 = v.v; return [v0.x - Math.cos(v0.h) * dist, v0.z - Math.sin(v0.h) * dist, v0.h];
    }
    function updateMovers() {
      for (const v of VEH.values()) {
        const a = v.v;
        v.g.position.set(a.x, 0, a.z); v.g.rotation.y = -a.h;
        if (v.load) { v.load.visible = !!a.load; if (a.kind === 'forklift' && a.load) v.load.material = a.load.units ? M.carton : M.load; }
        if (v.carts) {
          trailPush(v, a.x, a.z);
          const loaded = a.plan ? a.plan.loads.filter(l => l.got).length : 0;
          v.carts.forEach((c2, i) => { const p = trailAt(v, 2.1 + i * 2.25); c2.g.position.set(p[0], 0, p[1]); c2.g.rotation.y = -p[2]; c2.ld.visible = loaded > i * 2; });
        }
      }
      for (const tr of P.trucks) {
        let v = TRK.get(tr.id);
        if (!v) { v = { g: truckModel(12, 'truck:' + tr.id) }; TRK.set(tr.id, v); }
        v.g.rotation.y = 0; v.g.position.set(L.W + 0.6 + 6 + (1 - tr.k) * 34, 0, tr.dock.z);
      }
      for (const [id, v] of TRK) if (!P.trucks.some(t => t.id === id)) { world.remove(v.g); TRK.delete(id); }
      for (const tr of P.inbound) {
        let v = INB.get(tr.id);
        const show = tr.state === 'unloading';
        if (show && !v) { v = { g: truckModel(tr.area === 'IMP' ? 12 : 8, 'inbound:' + tr.id) }; INB.set(tr.id, v); }
        if (!show && v) { world.remove(v.g); INB.delete(tr.id); continue; }
        if (!v) continue;
        const k = Math.min(1, tr.k * 14), d = tr.dock, len = tr.area === 'IMP' ? 12 : 8;
        if (d.side === 'w') { v.g.rotation.y = Math.PI; v.g.position.set(-0.6 - len / 2 - (1 - k) * 28, 0, d.z); }
        else { v.g.rotation.y = Math.PI / 2; v.g.position.set(d.x, 0, -0.6 - len / 2 - (1 - k) * 28); }
      }
      for (const [id, v] of INB) if (!P.inbound.some(t => t.id === id)) { world.remove(v.g); INB.delete(id); }
      bodyI.count = headI.count = 0;
      const tint = { Operator: C.person, 'Line leader': C.dark, Technician: C.tech, 'Rework technician': C.person, 'Milk-run driver': C.cab, 'Forklift driver': C.cab };
      for (const p of P.people) {
        if (p.present === false) continue;
        const walking = !!p.path, ride = p.rides;
        if (ride && walk.ride === ride) continue;   // your seat while you ride along
        const y = ride ? (ride.kind === 'forklift' ? 0.95 : 0.75) : 0;
        const bob = walking ? Math.abs(Math.sin(tAnim * 9 + p.x)) * 0.05 : Math.sin(tAnim * 1.3 + p.x) * 0.01;
        const tc = overlay === 'people' && p.cover ? S.warn : tint[p.role] || C.person;
        put(bodyI, p.x, y + 0.6 + bob, p.z, 1, ride ? 0.7 : 1, 1, 0, 0, 0, 'person:' + p.id, tc);
        put(headI, p.x, y + (ride ? 1.1 : 1.32) + bob, p.z);
      }
      for (const o of OFFICE) { put(bodyI, o.x, 0.5, o.z, 1, 0.82, 1, 0, 0, 0, 'dept:' + o.dept, C.office); put(headI, o.x, 1.18 + Math.sin(tAnim * 0.8 + o.x) * 0.01, o.z); }
      done(bodyI, headI);
    }
    function updatePackets(dt) {
      pktI.count = 0;
      for (let i = packets.length - 1; i >= 0; i--) {
        const p = packets[i]; p.t += dt / p.dur;
        if (p.t >= 1) { packets.splice(i, 1); continue; }
        const n = p.hops.length;
        for (let tr = 0; tr < (overlay === 'data' ? 5 : 2); tr++) {
          const tt = p.t - tr * 0.016; if (tt < 0) continue;
          const h = Math.min(n - 1, Math.floor(tt * n)), lt = tt * n - h;
          const pt = p.hops[h](lt);
          const sc = (overlay === 'data' ? 1.25 : 0.9) * (1 - tr * 0.18);
          put(pktI, pt[0], pt[1], pt[2], sc, sc, sc);
        }
      }
      done(pktI);
      netLines.visible = overlay === 'data';
    }
    function updateFlow() {
      chev.count = 0;
      if (overlay !== 'flow') return;
      let i = 0;
      const add = (path, yf, speed, spacing) => {
        let len = 0; for (let k = 1; k < path.length; k++) len += Math.hypot(path[k][0] - path[k - 1][0], path[k][1] - path[k - 1][1]);
        const off = (tAnim * speed) % spacing;
        for (let s = off; s < len && i < 2400; s += spacing) { const p = polyAt(path, s); eul.set(0, -p[2], 0); q.setFromEuler(eul); mtx.compose(pos.set(p[0], yf(p[0]), p[1]), q, scl.set(1, 1, 1)); chev.setMatrixAt(i++, mtx); }
      };
      for (const sg of P.segs) if (sg.items.length) add(sg.path, x => segY(sg, x) + 0.06, 1.2, 1.6);
      for (const a of P.agvs.concat(P.tuggers, P.forklifts)) if (a.path) add(a.path, () => 0.06, 2, 2.6);
      chev.count = i; chev.instanceMatrix.needsUpdate = true;
    }
    function updateSigns(all) {
      for (const sg of SIGNS) if (all || (sg.L.model !== sg.model && sg.L.kind !== 'press')) {
        sg.model = sg.L.model; const old = sg.mat.emissiveMap;
        sg.mat.emissiveMap = signTex(sg.L.name, signSub(sg.L)); sg.mat.needsUpdate = true; old.dispose();
      }
    }
    // a new language repaints every sign, floor name and screen in the plant
    addEventListener('langchange', () => {
      updateSigns(true);
      world.traverse(o => { if (o.userData.zoneName) { const old = o.material.map; o.material.map = floorWord(o.userData.zoneName); o.material.needsUpdate = true; old.dispose(); } });
      for (const [k, draw, w, h] of [['hmi', hmiDraw, 256, 160], ['sop', sopDraw, 512, 256]]) { const old = M[k].emissiveMap; M[k].emissiveMap = cv(w, h, draw); M[k].needsUpdate = true; old.dispose(); }
    });

    /* ---------------- selection ---------------- */
    let selRef = null, follow = false;
    function refInfo(ref) {
      if (!ref) return null;
      const [k, id] = ref.split(/:(.+)/);
      if (k === 'st') { const s = P.byId[id]; return s && { x: s.x, y: 0, z: s.z, w: s.w, d: s.d, h: s.h, r: Math.max(s.w, s.d, 3) }; }
      if (k === 'agv' || k === 'tug' || k === 'fl') { const a = P.agvs.concat(P.tuggers, P.forklifts).find(a2 => a2.id === id); return a && { x: a.x, y: 0, z: a.z, w: k === 'tug' ? 2 : 1.6, d: 1.2, h: 1.5, r: 3, moving: true }; }
      if (k === 'person') { const p = P.people.find(p2 => p2.id === id); return p && { x: p.x, y: 0, z: p.z, w: 0.8, d: 0.8, h: 1.6, r: 1.5, moving: true }; }
      if (k === 'truck') { const t = P.trucks.find(t2 => t2.id === id); return t && { x: L.W + 6.6 + (1 - t.k) * 34, y: 0, z: t.dock.z, w: 15, d: 3, h: 3, r: 9, moving: true }; }
      if (k === 'inbound') { const v = INB.get(id); return v ? { x: v.g.position.x, y: 0, z: v.g.position.z, w: 13, d: 3, h: 3, r: 9 } : { x: 6, y: 0, z: 18, w: 8, d: 8, h: 3, r: 12 }; }
      if (k === 'buf') { const v = BV[id]; return v && { x: v.x, y: 0, z: v.z, w: v.w, d: v.d, h: v.h, r: Math.max(v.w, v.d, 3) }; }
      if (k === 'util') { const v = BV['util:' + id]; return v && { x: v.x, y: 0, z: v.z, w: v.w, d: v.d, h: v.h, r: 5 }; }
      if (k === 'dept') { const r = ROOMV[id]; return r && { x: r.x, y: 0, z: r.z, w: r.w, d: r.d, h: 3, r: 9 }; }
      if (k === 'sys') { const p = sysPos(id); return { x: p[0], y: 0, z: p[2], w: 1.6, d: 1.6, h: 2.4, r: 4 }; }
      if (k === 'unit') { const u = E.findUnit(id); const p = u && unitPos.get(u); if (p) return { x: p[0], y: p[1], z: p[2], w: 1.8, d: 1.4, h: 0.6, r: 2, moving: true }; return u ? locOf(u) : null; }
      if (k === 'pal') { const p = P.pallets.find(p2 => p2.id === id); const at = p && unitPos.get(p); return at && { x: at[0], y: 0, z: at[2], w: 1.6, d: 1.4, h: 1.6, r: 2, moving: true }; }
      if (k === 'zone') { const z = L.ZONES.find(z2 => z2.id === id); return z && { x: (z.x0 + z.x1) / 2, y: 0, z: (z.z0 + z.z1) / 2, w: z.x1 - z.x0, d: z.z1 - z.z0, h: 1, r: Math.max(z.x1 - z.x0, z.z1 - z.z0) * 0.6, zone: z }; }
      if (k === 'line') { const Ln = P.lines[id]; if (!Ln || !Ln.stations.length) return null; const xs = Ln.stations.map(s => s.x), x0 = Math.min(...xs), x1 = Math.max(...xs), zs = Ln.stations.map(s => s.z); const z0 = Math.min(...zs), z1 = Math.max(...zs); return { x: (x0 + x1) / 2, y: 0, z: (z0 + z1) / 2, w: x1 - x0 + 6, d: z1 - z0 + 5, h: 2, r: (x1 - x0) * 0.42 + 4 }; }
      if (k === 'order') { const o = P.orders.find(o2 => o2.id === id); if (o && o.truck) return refInfo('truck:' + o.truck.id); return { x: 234, y: 0, z: 82, w: 54, d: 78, h: 1, r: 40 }; }
      return null;
    }
    function locOf(u) {
      const l = u.loc; if (!l) return null;
      if (l.k === 'ls' || l.k === 'store') return refInfo('buf:' + l.b.id);
      if (l.k === 'veh') return refInfo('agv:' + l.a.id);
      if (l.k === 'pallet') return refInfo('pal:' + l.p.id);
      if (l.k === 'repair' || l.k === 'st' || l.k === 'aging') return refInfo('st:' + l.st.id);
      return null;
    }
    function select(ref, o2 = {}) {
      selRef = ref; follow = !!o2.follow;
      const info = refInfo(ref);
      reticle.visible = !!info;
      if (info) { setReticle(info); if (o2.fly !== false && !walk.on) flyTo(info); }
      emit('select', ref);
    }
    function updateSelection() {
      if (routeLine) { world.remove(routeLine); routeLine.geometry.dispose(); routeLine = null; }
      if (!selRef) return;
      const info = refInfo(selRef);
      if (!info) { reticle.visible = false; return; }
      reticle.visible = true; reticle.position.set(info.x, 0.05, info.z);
      if (Math.abs(info.w - retW) > 0.01 || Math.abs(info.d - retD) > 0.01) setReticle(info);
      const [k, id] = selRef.split(/:(.+)/);
      const mover = (k === 'agv' || k === 'fl' || k === 'tug') ? P.agvs.concat(P.tuggers, P.forklifts).find(a => a.id === id) : null;
      if (mover && mover.path) { const pts = [], p = mover.path; for (let i = 1; i < p.length; i++) pts.push([p[i - 1][0], p[i - 1][1]], [p[i][0], p[i][1]]); routeLine = lines(world, pts, M.route, 0.06); }
      if (follow && info.moving && !walk.on) { const d = new T.Vector3(info.x, 0, info.z).sub(controls.target); controls.target.add(d.multiplyScalar(0.12)); camera.position.add(d); }
    }

    /* ---------------- camera moves: fly-to, views, the cinematic fly-through ---------------- */
    let fly = null;
    const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
    function flyTo(info, dist) {
      moved = true;
      const r = dist || Math.max(14, (info.r || 4) * 3.4);
      const to = new T.Vector3(info.x, (info.y || 0) * 0.5 + 0.6, info.z);
      const dir = camera.position.clone().sub(controls.target).normalize();
      if (dir.y < 0.42) { dir.y = 0.5; dir.normalize(); }
      if (dir.y > 0.86) { dir.y = 0.72; dir.normalize(); }
      fly = { t: 0, dur: 1.4, p0: camera.position.clone(), t0: controls.target.clone(), p1: to.clone().add(dir.multiplyScalar(r)), t1: to };
    }
    function view(v) {
      if (walk.on) setWalk(false);
      if (v === 'overview') { fly = { t: 0, dur: 1.6, p0: camera.position.clone(), t0: controls.target.clone(), p1: homePos(), t1: CENTER.clone() }; return; }
      moved = true;
      const to = new T.Vector3(v[0], 0, v[1]);
      fly = { t: 0, dur: 1.5, p0: camera.position.clone(), t0: controls.target.clone(), p1: to.clone().add(new T.Vector3(v[2] * 0.22, v[2] * 0.62, v[2] * 0.78)), t1: to };
    }
    function stepFly() {
      if (!fly) return;
      // wall-clock timing, so a slow frame never stretches a camera move
      const now = performance.now(); if (!fly.start) fly.start = now;
      fly.t = Math.min(1, (now - fly.start) / 1000 / fly.dur);
      const k = ease(fly.t);
      // arc slightly upward on long moves so the camera does not cut through machines
      const lift = Math.sin(k * Math.PI) * Math.min(40, fly.p0.distanceTo(fly.p1) * 0.18);
      camera.position.lerpVectors(fly.p0, fly.p1, k); camera.position.y += lift; controls.target.lerpVectors(fly.t0, fly.t1, k);
      if (fly.t >= 1) fly = null;
    }
    controls.addEventListener('start', () => { moved = true; fly = null; if (follow) follow = false; if (cine.on) setCinematic(false); });
    // the cinematic: a slow fly-through along the material flow, from receiving to shipping and the offices
    const cine = { on: false, t: 0 };
    const CINE_P = [[-30, 60, 18], [20, 14, 18], [50, 9, 30], [80, 7, 12], [120, 6, 20], [150, 8, 16], [104, 4.5, 70], [130, 3.2, 63], [168, 3.4, 63], [192, 5, 70], [232, 9, 82], [262, 8, 60], [234, 14, 30], [150, 18, 128], [40, 14, 150], [20, 26, 82], [-30, 60, 18]].map(p => new T.Vector3(p[0], p[1], p[2]));
    const CINE_T = [[50, 0, 14], [40, 0, 25], [90, 0, 18], [120, 0, 25], [160, 0, 20], [180, 0, 40], [120, 1, 62], [150, 1, 62], [185, 1, 66], [215, 0, 80], [250, 0, 90], [240, 0, 50], [240, 0, 18], [100, 0, 145], [30, 0, 140], [60, 0, 80], [50, 0, 14]].map(p => new T.Vector3(p[0], p[1], p[2]));
    const cineP = new T.CatmullRomCurve3(CINE_P, false, 'centripetal'), cineT = new T.CatmullRomCurve3(CINE_T, false, 'centripetal');
    function setCinematic(v) { cine.on = !!v; cine.t = 0; if (v) { if (walk.on) setWalk(false); fly = null; follow = false; } emit('cinematic', cine.on); }
    function stepCinematic(dt) {
      if (!cine.on) return;
      cine.t = Math.min(1, cine.t + dt / 110);
      const k = cine.t < 0.02 ? cine.t : cine.t;
      camera.position.copy(cineP.getPointAt(k)); controls.target.copy(cineT.getPointAt(k));
      camera.lookAt(controls.target);
      if (cine.t >= 1) setCinematic(false);
    }

    /* ---------------- walk the floor: first person at eye height, with collision ---------------- */
    const GRID = 0.5, GW = Math.ceil((L.W + 4) / GRID), GD = Math.ceil((L.D + 4) / GRID);
    const solid = new Uint8Array(GW * GD);
    const block = (x0, z0, x1, z1) => { for (let gx = Math.max(0, Math.floor(x0 / GRID)); gx <= Math.min(GW - 1, Math.floor(x1 / GRID)); gx++) for (let gz = Math.max(0, Math.floor(z0 / GRID)); gz <= Math.min(GD - 1, Math.floor(z1 / GRID)); gz++) solid[gz * GW + gx] = 1; };
    for (const s of P.stations) block(s.x - s.w / 2 - 0.1, s.z - s.d / 2 - 0.1, s.x + s.w / 2 + 0.1, s.z + s.d / 2 + 0.1);
    for (const id in BV) { const b = BV[id]; if (b.kind === 'room' || b.kind === 'conv' || b.kind === 'util') { if (b.kind === 'util') block(b.x - 2.5, b.z - 1.4, b.x + 2.5, b.z + 1.4); continue; } block(b.x - b.w / 2, b.z - b.d / 2, b.x + b.w / 2, b.z + b.d / 2); }
    for (const bl of BELTS) if (Math.min(bl.y0, bl.y1) < 2) block(Math.min(bl.x0, bl.x1), Math.min(bl.z0, bl.z1) - bl.w / 2, Math.max(bl.x0, bl.x1), Math.max(bl.z0, bl.z1) + bl.w / 2);
    for (const k of colAt) { const [x, z] = k.split(',').map(Number); block(x - 0.3, z - 0.3, x + 0.3, z + 0.3); }
    const free = (x, z) => x > 0.6 && z > 0.6 && x < L.W - 0.6 && z < L.D - 0.6 && !solid[Math.floor(z / GRID) * GW + Math.floor(x / GRID)];
    const walk = { on: false, x: 107, z: 40, yaw: 0, pitch: -0.05, keys: new Set(), vx: 0, vz: 0, joy: [0, 0], look: null,
      guide: null, guideRef: null, guideLine: null, auto: false, ride: null, rideH: 0, lookRef: null, lookT: 0, warnT: 0 };
    const EYE = 1.68, FOV_ORBIT = camera.fov, FOV_WALK = 64;
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const VEHS = () => P.agvs.concat(P.tuggers, P.forklifts);
    const vref = a => (a.kind === 'tugger' ? 'tug:' : a.kind === 'forklift' ? 'fl:' : 'agv:') + a.id;
    const vhalf = a => (a.kind === 'tugger' ? 2.9 : a.kind === 'forklift' ? 1.3 : 0.85);
    // distance from a floor point to a vehicle's body (a segment along its heading, about 1.2 m wide)
    const vdist = (a, x, z) => { const c = Math.cos(a.h), s2 = Math.sin(a.h), dx = x - a.x, dz = z - a.z; const t = Math.max(-vhalf(a), Math.min(vhalf(a), dx * c + dz * s2)); return Math.hypot(dx - c * t, dz - s2 * t) - 0.6; };
    const clear = (x, z) => free(x, z) && !VEHS().some(a => Math.abs(a.x - x) < 5 && Math.abs(a.z - z) < 5 && vdist(a, x, z) < 0.35);
    function nearestFree(x, z) {
      if (free(x, z)) return [x, z];
      for (let r = 0.5; r < 14; r += 0.5) for (let i = 0; i < 24; i++) { const q = i / 24 * Math.PI * 2, px = x + Math.cos(q) * r, pz = z + Math.sin(q) * r; if (free(px, pz)) return [px, pz]; }
      return null;
    }
    function setWalk(v, at) {
      walk.on = !!v;
      walk.ride = null; walk.auto = false; clearGuide();
      if (walk.on) {
        if (cine.on) setCinematic(false);
        fly = null; follow = false;
        let p = at || [controls.target.x, controls.target.z];
        // start on the nearest free spot of an aisle
        if (!free(p[0], p[1])) { let best = null; for (const A of L.AISLES) { const h = A.a[1] === A.b[1]; const x = h ? Math.max(Math.min(A.a[0], A.b[0]), Math.min(Math.max(A.a[0], A.b[0]), p[0])) : A.a[0]; const z = h ? A.a[1] : Math.max(Math.min(A.a[1], A.b[1]), Math.min(Math.max(A.a[1], A.b[1]), p[1])); const d = Math.hypot(x - p[0], z - p[1]); if (free(x, z) && (!best || d < best.d)) best = { x, z, d }; } if (best) p = [best.x, best.z]; }
        walk.x = p[0]; walk.z = p[1]; walk.vx = walk.vz = 0;
        const dir = controls.target.clone().sub(camera.position); walk.yaw = Math.atan2(dir.x, -dir.z); walk.pitch = -0.08;
        controls.enabled = false;
      } else {
        controls.enabled = true;
        const fwd = new T.Vector3(Math.sin(walk.yaw), 0, -Math.cos(walk.yaw));
        controls.target.set(walk.x + fwd.x * 8, 0.5, walk.z + fwd.z * 8);
        camera.position.set(walk.x - fwd.x * 10, 9, walk.z - fwd.z * 10);
        if (document.pointerLockElement === canvas) document.exitPointerLock();
        P.walker = null; walk.lookRef = null; emit('look', null); emit('walkwarn', null);
      }
      emit('walk', walk.on);
    }

    /* a route on the floor to what you chose, along the free cells of the walking grid (A*, 8 directions, no corner cutting) */
    function findPath(x0, z0, x1, z1) {
      const s0 = Math.floor(z0 / GRID) * GW + Math.floor(x0 / GRID), g = Math.floor(z1 / GRID) * GW + Math.floor(x1 / GRID);
      const gx = g % GW, gz = (g / GW) | 0, H = i => Math.hypot(i % GW - gx, ((i / GW) | 0) - gz);
      const cost = new Float32Array(GW * GD).fill(Infinity), from = new Int32Array(GW * GD).fill(-1), shut = new Uint8Array(GW * GD);
      const heap = [], push = (i, f) => { heap.push([f, i]); let c = heap.length - 1; while (c) { const p2 = (c - 1) >> 1; if (heap[p2][0] <= heap[c][0]) break; [heap[p2], heap[c]] = [heap[c], heap[p2]]; c = p2; } };
      const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let c = 0; for (;;) { const l = c * 2 + 1, r = l + 1; let m = c; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === c) break; [heap[m], heap[c]] = [heap[c], heap[m]]; c = m; } } return top[1]; };
      const ok = (cx, cz) => cx > 1 && cz > 1 && cx < GW - 2 && cz < GD - 2 && !solid[cz * GW + cx];
      cost[s0] = 0; push(s0, H(s0));
      let n = 0;
      while (heap.length && n++ < 260000) {
        const i = pop(); if (i === g) break; if (shut[i]) continue; shut[i] = 1;
        const cx = i % GW, cz = (i / GW) | 0;
        for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
          if (!dx && !dz) continue;
          const nx = cx + dx, nz = cz + dz; if (!ok(nx, nz) || (dx && dz && (!ok(cx + dx, cz) || !ok(cx, cz + dz)))) continue;
          const j = nz * GW + nx, c2 = cost[i] + (dx && dz ? 1.414 : 1);
          if (c2 < cost[j]) { cost[j] = c2; from[j] = i; push(j, c2 + H(j)); }
        }
      }
      if (from[g] < 0 && g !== s0) return null;
      const cells = []; for (let i = g; i >= 0; i = i === s0 ? -1 : from[i]) cells.unshift(i);
      const pts = cells.map(i => [(i % GW + 0.5) * GRID, (((i / GW) | 0) + 0.5) * GRID]);
      // keep only the turns that line of sight needs, so the walk is smooth
      const sight = (a2, b2) => { const d = Math.hypot(b2[0] - a2[0], b2[1] - a2[1]), n2 = Math.ceil(d / (GRID * 0.5)); for (let k2 = 1; k2 < n2; k2++) { const t = k2 / n2; if (!free(a2[0] + (b2[0] - a2[0]) * t, a2[1] + (b2[1] - a2[1]) * t)) return false; } return true; };
      const out = [[x0, z0]]; let k = 0;
      while (k < pts.length - 1) { let j = pts.length - 1; while (j > k + 1 && !sight(out[out.length - 1], pts[j])) j--; out.push(pts[j]); k = j; }
      return out;
    }
    const GUIDE_M = new T.MeshBasicMaterial({ color: 0x2189FF, transparent: true, opacity: 0.8, side: T.DoubleSide, depthWrite: false });
    function clearGuide() { if (walk.guideLine) { world.remove(walk.guideLine); walk.guideLine.geometry.dispose(); walk.guideLine = null; } walk.guide = null; walk.guideRef = null; walk.auto = false; }
    function drawGuide() {
      if (walk.guideLine) { world.remove(walk.guideLine); walk.guideLine.geometry.dispose(); walk.guideLine = null; }
      const g = walk.guide; if (!g) return;
      // a ribbon on the floor, 40 cm wide, from where you stand to the spot in front of the target
      const pts = [[walk.x, walk.z]].concat(g.pts.slice(g.i)), pos = [];
      for (let i = 1; i < pts.length; i++) {
        const [x0, z0] = pts[i - 1], [x1, z1] = pts[i], l = Math.hypot(x1 - x0, z1 - z0) || 1, nx = -(z1 - z0) / l * 0.2, nz = (x1 - x0) / l * 0.2;
        pos.push(x0 + nx, 0.035, z0 + nz, x0 - nx, 0.035, z0 - nz, x1 + nx, 0.035, z1 + nz, x0 - nx, 0.035, z0 - nz, x1 - nx, 0.035, z1 - nz, x1 + nx, 0.035, z1 + nz);
      }
      const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
      walk.guideLine = new T.Mesh(geo, GUIDE_M); world.add(walk.guideLine);
    }
    // "take me there": the route is drawn on the floor and the walker follows it; any walking key takes over again
    function walkGuide(ref, auto = true) {
      const info = refInfo(ref); if (!info || !walk.on) return false;
      if (walk.ride) leaveRide();
      // stand in front of it: the free spot nearest to its edge on the walker's side
      const ex = Math.max(info.x - (info.w || 1) / 2 - 0.9, Math.min(info.x + (info.w || 1) / 2 + 0.9, walk.x));
      const ez = Math.max(info.z - (info.d || 1) / 2 - 0.9, Math.min(info.z + (info.d || 1) / 2 + 0.9, walk.z));
      const goal = nearestFree(ex, ez) || nearestFree(info.x, info.z); if (!goal) return false;
      const pts = findPath(walk.x, walk.z, goal[0], goal[1]); if (!pts) return false;
      walk.guide = { pts, i: 1, target: [info.x, info.z] }; walk.guideRef = ref; walk.auto = auto;
      drawGuide(); emit('guide', { ref, m: pts.reduce((m, p, i) => m + (i ? Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) : 0), 0) });
      return true;
    }
    // ride along: sit in the cab of a forklift or milk-run train (or on top of an AGV) and look around while it works
    function rideOn(ref) {
      const [k, id] = String(ref || '').split(/:(.+)/);
      const a = (k === 'agv' || k === 'fl' || k === 'tug') && VEHS().find(v => v.id === id); if (!a || !walk.on) return false;
      clearGuide(); walk.ride = a; walk.rideH = a.h; walk.yaw = a.h + Math.PI / 2; walk.pitch = -0.12; P.walker = null;
      emit('ride', vref(a)); return true;
    }
    function leaveRide() {
      const a = walk.ride; if (!a) return;
      walk.ride = null;
      // step down beside the vehicle, on its right, onto free floor
      const sx = a.x - Math.sin(a.h) * 1.6, sz = a.z + Math.cos(a.h) * 1.6, p = nearestFree(sx, sz) || nearestFree(a.x, a.z);
      if (p) { walk.x = p[0]; walk.z = p[1]; }
      walk.vx = walk.vz = 0; emit('ride', null);
    }
    const wrap = v => Math.atan2(Math.sin(v), Math.cos(v));
    function stepFov(dt) {
      const want = walk.on ? FOV_WALK : FOV_ORBIT;
      if (Math.abs(camera.fov - want) > 0.05) { camera.fov += (want - camera.fov) * Math.min(1, dt * 5); camera.updateProjectionMatrix(); }
    }
    function stepWalk(dt) {
      stepFov(dt);
      if (!walk.on) return;
      const k = walk.keys, run = k.has('ShiftLeft') || k.has('ShiftRight');
      let f = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0) - walk.joy[1];
      let s = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0) + walk.joy[0];
      if (k.has('KeyQ')) walk.yaw -= dt * 1.4; if (k.has('KeyE')) walk.yaw += dt * 1.4;
      const manual = Math.abs(f) > 0.05 || Math.abs(s) > 0.05;
      if (walk.ride) {
        if (manual) leaveRide();
        else {
          const a = walk.ride, seat = a.kind === 'tugger' ? [1.9, 2.05] : a.kind === 'forklift' ? [-0.35, 2.15] : [0, 1.15];
          walk.yaw += wrap(a.h - walk.rideH); walk.rideH = a.h;
          walk.x = a.x + Math.cos(a.h) * seat[0]; walk.z = a.z + Math.sin(a.h) * seat[0];
          const cp = Math.cos(walk.pitch);
          camera.position.set(walk.x, seat[1], walk.z);
          camera.lookAt(walk.x + Math.sin(walk.yaw) * cp, seat[1] + Math.sin(walk.pitch), walk.z - Math.cos(walk.yaw) * cp);
          lookAround(dt); return;
        }
      }
      if (manual && walk.auto) { walk.auto = false; emit('guide', { ref: walk.guideRef, manual: true }); }
      const g = walk.guide;
      if (g && walk.auto) {
        // follow the route: turn toward the next point and walk; the last point is the spot in front of the target
        let p = g.pts[g.i];
        while (p && Math.hypot(p[0] - walk.x, p[1] - walk.z) < 0.5) { g.i++; p = g.pts[g.i]; }
        if (!p) {
          walk.yaw += wrap(Math.atan2(g.target[0] - walk.x, -(g.target[1] - walk.z)) - walk.yaw);
          const ref = walk.guideRef; clearGuide(); emit('arrive', ref);
        } else {
          const want = Math.atan2(p[0] - walk.x, -(p[1] - walk.z)), d = wrap(want - walk.yaw);
          walk.yaw += Math.max(-dt * 2.6, Math.min(dt * 2.6, d));
          f = Math.abs(d) < 0.9 ? 1 : 0.25; s = 0;
        }
      }
      if (g && frames % 10 === 0) drawGuide();
      const sp = run ? 4.2 : walk.auto ? 2.2 : 1.9;
      // forward (sin yaw, −cos yaw) and right (cos yaw, sin yaw) on the floor
      const fx = Math.sin(walk.yaw), fz = -Math.cos(walk.yaw), rx = Math.cos(walk.yaw), rz = Math.sin(walk.yaw);
      const tx = (fx * f + rx * s) * sp, tz = (fz * f + rz * s) * sp;
      walk.vx += (tx - walk.vx) * Math.min(1, dt * 8); walk.vz += (tz - walk.vz) * Math.min(1, dt * 8);
      // machines, conveyors, columns and vehicles block the way; a vehicle that drives into you is the one that waits
      const nx = walk.x + walk.vx * dt, nz = walk.z + walk.vz * dt;
      if (clear(nx, walk.z)) walk.x = nx; else walk.vx = 0;
      if (clear(walk.x, nz)) walk.z = nz; else walk.vz = 0;
      if (!free(walk.x, walk.z)) { const q = nearestFree(walk.x, walk.z); if (q) { walk.x = q[0]; walk.z = q[1]; } }
      P.walker = { id: 'You', kind: 'person', x: walk.x, z: walk.z, h: 0, path: null, v: 0 };
      const bob = !still && Math.hypot(walk.vx, walk.vz) > 0.3 ? Math.sin(tAnim * 9) * 0.025 : 0;
      camera.position.set(walk.x, EYE + bob, walk.z);
      const cp = Math.cos(walk.pitch);
      camera.lookAt(walk.x + Math.sin(walk.yaw) * cp, EYE + Math.sin(walk.pitch), walk.z - Math.cos(walk.yaw) * cp);
      lookAround(dt);
    }
    // what is in the middle of the view (within 18 m), and any vehicle heading toward you
    function lookAround(dt) {
      walk.lookT += dt;
      if (walk.lookT < 0.15) return;
      walk.lookT = 0;
      ndc.set(0, 0); ray.setFromCamera(ndc, camera); ray.far = 18;
      let ref = null;
      for (const h of ray.intersectObjects(PICK, false)) { const o = h.object; const r = o.isInstancedMesh ? o.userData.refs[h.instanceId] : o.userData.ref; if (r && (!walk.ride || r !== vref(walk.ride))) { ref = r; break; } }
      ray.far = Infinity;
      if (ref !== walk.lookRef) { walk.lookRef = ref; emit('look', ref ? { ref, name: NAME(ref) } : null); }
      if (walk.ride) { if (walk.warn) { walk.warn = null; emit('walkwarn', null); } return; }
      let warn = null;
      for (const a of VEHS()) {
        if (!a.path || a.v < 0.2 || Math.abs(a.x - walk.x) > 9 || Math.abs(a.z - walk.z) > 9) continue;
        const dx = walk.x - a.x, dz = walk.z - a.z, ahead = dx * Math.cos(a.h) + dz * Math.sin(a.h), lat = -dx * Math.sin(a.h) + dz * Math.cos(a.h);
        const d = vdist(a, walk.x, walk.z);
        if (ahead > 0 && Math.abs(lat) < 2.2 && d < 7 && (!warn || d < warn.d)) warn = { ref: vref(a), name: NAME(vref(a)), d };
      }
      if ((warn && warn.ref) !== (walk.warn && walk.warn.ref) || (warn && Math.abs(warn.d - walk.warn.d) > 0.8)) { walk.warn = warn; emit('walkwarn', warn); }
    }
    addEventListener('keydown', e => {
      if (!walk.on || e.target.closest('input, textarea, select') || !canvas.offsetParent) return;
      // Space and Enter on a focused button press that button, they do not walk or select
      if ((e.code === 'Space' || e.code === 'Enter') && e.target.closest('button, a')) return;
      walk.keys.add(e.code);
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
      if (e.repeat) return;
      // F or Enter: details of what you look at · G: walk to the selection · R: ride the vehicle you look at, or get off
      if ((e.code === 'KeyF' || e.code === 'Enter') && walk.lookRef) select(walk.lookRef);
      if (e.code === 'KeyG' && selRef) walkGuide(selRef);
      if (e.code === 'KeyR') { if (walk.ride) leaveRide(); else { const r = [walk.lookRef, selRef].find(x => /^(agv|fl|tug):/.test(x || '')); if (r) rideOn(r); } }
    });
    addEventListener('keyup', e => walk.keys.delete(e.code));
    addEventListener('blur', () => walk.keys.clear());
    document.addEventListener('mousemove', e => { if (walk.on && document.pointerLockElement === canvas) { walk.yaw += e.movementX * 0.0022; walk.pitch = Math.max(-1.2, Math.min(1.0, walk.pitch - e.movementY * 0.0022)); } });

    /* ---------------- CCTV: fixed cameras rendered into the corner of the view ---------------- */
    const CCTV = [
      { id: 'cam1', name: 'CAM 01 · Main line 2 · packing', pos: [192, 4.2, 57.5], look: [182, 0.8, 62] },
      { id: 'cam2', name: 'CAM 02 · SMD hall', pos: [110, 4.0, 3], look: [130, 0.8, 18] },
      { id: 'cam3', name: 'CAM 03 · LCM bridge', pos: [100, 4.5, 44], look: [108, 2, 62] },
      { id: 'cam4', name: 'CAM 04 · Docks', pos: [250, 6, 44], look: [262, 1, 80] }
    ].map(c2 => { const cam = new T.PerspectiveCamera(48, 16 / 9, 0.3, 400); cam.position.set(...c2.pos); cam.lookAt(...c2.look); return Object.assign(c2, { cam }); });
    let cctvOn = false, cctvFrame = 0;
    const cctvRects = () => { const w = Math.round(Math.min(280, Wd * 0.2)), h = Math.round(w * 9 / 16), gap = 6; return CCTV.map((c2, i) => ({ c: c2, x: Wd - (2 - (i % 2)) * (w + gap) - 8, y: Ht - (2 - Math.floor(i / 2)) * (h + gap) - 8, w, h })); };

    /* ---------------- picking ---------------- */
    const ray = new T.Raycaster(), ndc = new T.Vector2();
    const NAME = ref => {
      const [k, id] = ref.split(/:(.+)/);
      if (k === 'st') { const s = P.byId[id]; return s ? `${s.name}${P.lines[s.line] && s.line !== 'INJ' ? ' · ' + P.lines[s.line].name : ''}` : id; }
      if (k === 'buf') { const b = P.bufs[id]; return b ? (b.label || b.code) + (id.startsWith('LS:') ? ` · ${P.byId[b.station] ? P.byId[b.station].name : ''}` : '') : id; }
      if (k === 'dept') { const d = X.DEPTS.find(d2 => d2.id === id); return d ? d.name : id; }
      if (k === 'unit') { const u = E.findUnit(id); return u ? `${u.type === 'tv' ? 'TV' : u.type === 'lcm' ? 'Panel module' : 'Main board'} ${u.sn}` : id; }
      if (k === 'pal') return 'Pallet ' + id;
      if (k === 'person') { const p = P.people.find(p2 => p2.id === id); return p ? `${p.name} · ${p.role}` : id; }
      if (k === 'util') { const u = P.util.assets.find(u2 => u2.id === id); return u ? u.name : id; }
      return id;
    };
    function hit(cx, cy) {
      const r = canvas.getBoundingClientRect();
      if (walk.on && document.pointerLockElement === canvas) ndc.set(0, 0); else ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      const hits = ray.intersectObjects(PICK, false);
      for (const h of hits) { const o = h.object; const ref = o.isInstancedMesh ? o.userData.refs[h.instanceId] : o.userData.ref; if (ref) return { ref, name: NAME(ref) }; }
      return null;
    }
    let down = null;
    canvas.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY }; if (walk.on && e.pointerType !== 'mouse') walk.look = { x: e.clientX, y: e.clientY, id: e.pointerId }; });
    canvas.addEventListener('pointermove', e => {
      if (walk.on && walk.look && walk.look.id === e.pointerId) { walk.yaw += (e.clientX - walk.look.x) * 0.004; walk.pitch = Math.max(-1.2, Math.min(1, walk.pitch - (e.clientY - walk.look.y) * 0.004)); walk.look.x = e.clientX; walk.look.y = e.clientY; }
    });
    canvas.addEventListener('pointerup', e => {
      if (walk.look && walk.look.id === e.pointerId) walk.look = null;
      if (!down) return;
      const moved2 = Math.hypot(e.clientX - down.x, e.clientY - down.y); down = null;
      if (moved2 > 6) return;
      if (walk.on && e.pointerType === 'mouse' && document.pointerLockElement !== canvas) { canvas.requestPointerLock && canvas.requestPointerLock(); return; }
      const h = hit(e.clientX, e.clientY);
      if (h) select(h.ref); else { selRef = null; reticle.visible = false; emit('select', null); }
    });
    let hoverT = 0;
    canvas.addEventListener('pointermove', e => {
      if (e.pointerType !== 'mouse' || walk.on) return;
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
    // labels never sit on top of each other: the more important one wins (selection and alerts first, then systems,
    // departments, lines, zones, stations, vehicles) and the others hide until the camera moves closer
    const RANK = [['lb-sel', 0], ['lb-pill', 1], ['lb-sys', 2], ['lb-room', 3], ['lb-line', 4], ['lb-zone', 5], ['lb-st', 6], ['lb-agv', 7]];
    const rankOf = el => { for (const [c, r] of RANK) if (el.classList.contains(c)) return r; return 8; };
    const ANCHOR = { 'lb-zone': [0.5, 0.5], 'lb-line': [1, 0.5] };
    let measureAt = 0;
    function projectLabels(w, h) {
      const dist = walk.on ? 20 : camera.position.distanceTo(controls.target);
      const cand = [];
      for (const Lb of labels) {
        const p = Lb.getPos();
        let tierOk = p && (Lb.tier === 0 ? dist > 120 && !walk.on : Lb.tier === 1 ? dist < 260 : Lb.tier === 2 ? dist < 70 : typeof Lb.tier === 'function' ? Lb.tier(dist) : true);
        if (tierOk && walk.on) tierOk = Math.hypot(p[0] - walk.x, p[2] - walk.z) < 26;
        if (tierOk) tmp.set(p[0], p[1], p[2]).project(camera);
        const vis = tierOk && tmp.z < 1 && tmp.x > -1.05 && tmp.x < 1.05 && tmp.y > -1.05 && tmp.y < 1.05;
        if (!vis) { if (Lb.shown !== false) { Lb.el.style.display = 'none'; Lb.shown = false; } continue; }
        if (Lb.rank == null) { Lb.rank = rankOf(Lb.el); const k = Object.keys(ANCHOR).find(c => Lb.el.classList.contains(c)); Lb.anchor = k ? ANCHOR[k] : [0.5, 1]; }
        cand.push({ Lb, x: (tmp.x + 1) / 2 * w, y: (1 - tmp.y) / 2 * h, z: tmp.z });
      }
      // sizes are measured when a label first shows and about once a second after that (texts change)
      const now = performance.now(), remeasure = now - measureAt > 1000;
      if (remeasure) measureAt = now;
      cand.sort((a, b) => a.Lb.rank - b.Lb.rank || a.z - b.z);
      const taken = [];
      for (const c of cand) {
        const Lb = c.Lb;
        if (Lb.w == null || (remeasure && Lb.shown === true)) { if (Lb.shown !== true) { Lb.el.style.display = ''; Lb.shown = true; } Lb.w = Lb.el.offsetWidth; Lb.h = Lb.el.offsetHeight; }
        const x0 = c.x - Lb.w * Lb.anchor[0];
        let y0 = c.y - Lb.h * Lb.anchor[1], r = [x0 - 3, y0 - 3, x0 + Lb.w + 3, y0 + Lb.h + 3];
        const over = () => Lb.w > 0 && taken.some(t => r[0] < t[2] && r[2] > t[0] && r[1] < t[3] && r[3] > t[1]);
        // alerts are never hidden: one that lands on another stacks above it
        if (Lb.rank <= 1) for (let k = 0; k < 6 && over(); k++) { y0 -= Lb.h + 6; r = [x0 - 3, y0 - 3, x0 + Lb.w + 3, y0 + Lb.h + 3]; }
        else if (over()) { Lb.el.style.display = 'none'; Lb.shown = false; continue; }
        c.y = y0 + Lb.h * Lb.anchor[1];
        if (Lb.shown !== true) { Lb.el.style.display = ''; Lb.shown = true; }
        if (Lb.w > 0) taken.push(r);
        Lb.el.style.transform = `translate3d(${c.x.toFixed(1)}px, ${c.y.toFixed(1)}px, 0)`;
      }
    }

    /* ---------------- render ---------------- */
    let Wd = 0, Ht = 0, frames = 0, acc = 0;
    function resize() {
      const r = canvas.parentElement.getBoundingClientRect();
      Wd = Math.max(1, r.width); Ht = Math.max(1, r.height);
      renderer.setSize(Wd, Ht, false); camera.aspect = Wd / Ht; camera.updateProjectionMatrix();
      if (composer) { composer.setSize(Wd, Ht); composer.setPixelRatio(renderer.getPixelRatio()); }
      if (!moved && !fly) camera.position.copy(homePos());
    }
    new ResizeObserver(resize).observe(canvas.parentElement);
    buildComposer(); resize();
    applyTheme();
    function setQuality(qv, manual) {
      if (manual !== undefined) autoQ = !manual;
      if (qv === quality) return;
      quality = qv; if (composer) composer.dispose && composer.dispose(); buildComposer(); resize();
      renderer.shadowMap.enabled = qv !== 'low'; sun.castShadow = qv !== 'low';
      scene.traverse(o => { if (o.material) o.material.needsUpdate = true; });
      emit('quality', quality);
    }
    function render(dt) {
      const t0 = performance.now();
      stepFly(); stepCinematic(dt); stepWalk(dt);
      acc += dt;
      updateMachines(dt);
      if (acc > 0.2 || frames < 2) { acc = 0; updateStock(); updateSigns(); }
      updateMovers(); drawUnits(); updateFlow(); updatePackets(dt); updateSelection();
      if (!walk.on && !cine.on) controls.update();
      const dist = camera.position.distanceTo(controls.target);
      if (gtao) gtao.enabled = walk.on || cine.on || dist < 170;
      // the roof steel fades out as the camera rises above it, so the plant stays readable from the top
      const ro = Math.max(0, Math.min(1, (60 - camera.position.y) / 30));
      M.roof.opacity = ro; M.lights.opacity = ro; M.roof.visible = M.lights.visible = ro > 0.02; M.roof.depthWrite = ro > 0.98;
      renderer.setScissorTest(false); renderer.setViewport(0, 0, Wd, Ht);
      if (renderer.shadowMap.enabled && frames % 3 === 0) renderer.shadowMap.needsUpdate = true;
      if (composer) composer.render(dt); else renderer.render(scene, camera);
      // CCTV feeds: one camera redrawn per frame, the rest keep their last image
      if (cctvOn) {
        const rects = cctvRects();
        renderer.autoClear = false; renderer.setScissorTest(true);
        for (let i = 0; i < rects.length; i++) {
          const R = rects[i], y = Ht - R.y - R.h;
          if (i !== cctvFrame % rects.length && frames > 4) { /* draw all each frame; scissor keeps cost low */ }
          renderer.setViewport(R.x, y, R.w, R.h); renderer.setScissor(R.x, y, R.w, R.h);
          R.c.cam.aspect = R.w / R.h; R.c.cam.updateProjectionMatrix();
          renderer.clear(); renderer.render(scene, R.c.cam);
        }
        renderer.setScissorTest(false); renderer.autoClear = true; renderer.setViewport(0, 0, Wd, Ht); cctvFrame++;
      }
      projectLabels(Wd, Ht);
      frames++;
      // adaptive quality
      const ft = performance.now() - t0; ftAvg = ftAvg * 0.95 + ft * 0.05; ftN++;
      if (autoQ && ftN > 90) {
        if (ftAvg > 26 && quality === 'high') { setQuality('medium'); ftN = 0; }
        else if (ftAvg > 30 && quality === 'medium') { setQuality('low'); ftN = 0; }
      }
    }

    return {
      THREE: T, scene, camera, controls, renderer, ROOMV, BV, CCTV,
      on(fn) { listeners.push(fn); },
      render, resize, select, view, flyTo: info => flyTo(info), refInfo, label, posOfRef, sysPos,
      setOverlay(m) { overlay = m; emit('overlay', m); },
      get overlay() { return overlay; },
      setTheme(t) { theme = t === 'dark' ? 'dark' : 'light'; applyTheme(); },
      setFollow(v) { follow = v; },
      get follow() { return follow; },
      get selected() { return selRef; },
      setWalk, get walking() { return walk.on; }, walkJoy(x, y) { walk.joy[0] = x; walk.joy[1] = y; }, walkTo(x, z) { const p = nearestFree(x, z); if (p) { if (walk.ride) leaveRide(); clearGuide(); walk.x = p[0]; walk.z = p[1]; } },
      walkGuide, rideOn, leaveRide, clearGuide, get walkState() { return { ride: walk.ride ? vref(walk.ride) : null, guide: walk.guideRef, auto: walk.auto, look: walk.lookRef }; },
      get walkPos() { return { x: walk.x, z: walk.z, yaw: walk.yaw }; },
      camPos() { return walk.on ? { x: walk.x, z: walk.z, yaw: walk.yaw } : { x: controls.target.x, z: controls.target.z, yaw: Math.atan2(controls.target.x - camera.position.x, -(controls.target.z - camera.position.z)), dist: camera.position.distanceTo(controls.target) }; },
      setCinematic, get cinematic() { return cine.on; },
      setCctv(v) { cctvOn = !!v; emit('cctv', cctvOn); }, get cctv() { return cctvOn; }, cctvRects,
      setXray, get xray() { return xray; },
      setQuality, get quality() { return quality; },
      unitPos, frames: () => frames
    };
  }

  window.PlantScene = { create };
})();
