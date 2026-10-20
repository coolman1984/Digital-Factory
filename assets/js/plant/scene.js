/* Digital Factory — the 3D view of the Plant EG-01 twin (three.js, vendored as window.THREE).
   A white architectural model drawn with ink edges on the blueprint grid. Colour appears only for an abnormal state
   (ISA-101): amber for slow, short-stopped or starved, red for stopped, indigo for planned maintenance.
   Reads the engine every frame; owns nothing of the plant's state. */
(function () {
  'use strict';
  const T = window.THREE;
  const TAU = Math.PI * 2;

  const PAL = {
    light: {
      bg: 0xE9EDF2, floor: 0xF1F3F6, grid: 0xDCE1E8, grid2: 0xC9D0DA, zone: 0xE6EAF0, zoneLine: 0xAEB7C4, aisle: 0xFFFFFF, aisleLine: 0xB9C2CE,
      body: 0xFFFFFF, body2: 0xF2F4F7, edge: 0x1B2029, edgeOp: 0.42, glass: 0xA9BBCD, dark: 0x2C323C, belt: 0x4A515D, metal: 0xB3BAC4, rack: 0x8C96A4,
      wall: 0xFFFFFF, pcb: 0x2F6B4F, tv: 0x16191F, carton: 0xC9A37A, pallet: 0xB98F60, tray: 0xD8DDE4, person: 0x46546A, skin: 0xC8A58A,
      tech: 0x1565D8, agv: 0xFFFFFF, stripe: 0x1428A0, truck: 0xFFFFFF, cab: 0x5A6270, mag: 0x6A7382, load2: 0x9AA3B0, sky: 0xFFFFFF, ground: 0xD7DCE3,
      hemi: [0xFFFFFF, 0xD7DCE3, 1.25], sun: 1.35, amb: 0.25
    },
    dark: {
      bg: 0x0A0B0F, floor: 0x0F1217, grid: 0x171B22, grid2: 0x222833, zone: 0x12161C, zoneLine: 0x3A4352, aisle: 0x161A21, aisleLine: 0x2C3440,
      body: 0x262B35, body2: 0x1E222A, edge: 0xA9B3C4, edgeOp: 0.38, glass: 0x5A6B80, dark: 0x0F1115, belt: 0x353B46, metal: 0x5C6573, rack: 0x6B7585,
      wall: 0x1E222A, pcb: 0x2E7A57, tv: 0x07080A, carton: 0x9E7E5A, pallet: 0x8A6A46, tray: 0x3A414D, person: 0x8C9AB0, skin: 0xC8A58A,
      tech: 0x4DA3FF, agv: 0xE8EBF0, stripe: 0x2189FF, truck: 0xD9DEE6, cab: 0x3A414D, mag: 0x4A5361, load2: 0x4A5361, sky: 0x2A3140, ground: 0x07080A,
      hemi: [0xC9D3E3, 0x0A0B0F, 0.75], sun: 0.95, amb: 0.2
    }
  };
  const STATUS = {
    light: { ok: 0x0F9D58, warn: 0xE08A00, bad: 0xE5383B, maint: 0x3B4CCA, info: 0x2189FF, off: 0x9AA2AE },
    dark: { ok: 0x34C77B, warn: 0xFFB020, bad: 0xFF5A5F, maint: 0x8C9BFF, info: 0x4DA3FF, off: 0x4A5260 }
  };

  function create(canvas, E, opts = {}) {
    const P = E.P;
    const L = P.layout;
    let theme = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
    let C = PAL[theme], S = STATUS[theme];
    const listeners = [];
    const emit = (t, d) => listeners.forEach(f => f(t, d));

    /* ---------------- renderer, camera, controls ---------------- */
    const renderer = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: !!opts.capture });
    const dpr = Math.min(window.devicePixelRatio || 1, opts.lowPower ? 1.25 : 2);
    renderer.setPixelRatio(dpr);
    renderer.outputColorSpace = T.SRGBColorSpace;
    renderer.shadowMap.enabled = !opts.lowPower;
    renderer.shadowMap.type = T.PCFSoftShadowMap;
    const scene = new T.Scene();
    const camera = new T.PerspectiveCamera(30, 1, 0.5, 1500);
    const controls = new T.OrbitControls(camera, canvas);
    controls.enableDamping = true; controls.dampingFactor = 0.08;
    controls.maxPolarAngle = 1.36; controls.minDistance = 4; controls.maxDistance = 320;
    controls.screenSpacePanning = false; controls.zoomSpeed = 1.1; controls.rotateSpeed = 0.6;
    const CENTER = new T.Vector3(L.W / 2, 0, L.D / 2 + 2);
    controls.target.copy(CENTER);
    camera.position.set(CENTER.x + 22, 84, CENTER.z + 88);

    const hemi = new T.HemisphereLight(C.hemi[0], C.hemi[1], C.hemi[2]); scene.add(hemi);
    const amb = new T.AmbientLight(0xffffff, C.amb); scene.add(amb);
    const sun = new T.DirectionalLight(0xffffff, C.sun);
    sun.position.set(CENTER.x - 50, 120, CENTER.z - 70); sun.target.position.copy(CENTER);
    sun.castShadow = true;
    sun.shadow.mapSize.set(4096, 4096);
    Object.assign(sun.shadow.camera, { left: -90, right: 90, top: 70, bottom: -70, near: 10, far: 320 });
    sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.02;
    scene.add(sun, sun.target);

    /* ---------------- materials (rethemed in place) ---------------- */
    const std = (c, o = {}) => new T.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.88, metalness: 0.0 }, o));
    const M = {
      floor: std(C.floor, { roughness: 1 }), body: std(C.body), body2: std(C.body2), dark: std(C.dark, { roughness: 0.6 }), belt: std(C.belt, { roughness: 0.7 }),
      metal: std(C.metal, { roughness: 0.5, metalness: 0.3 }), rack: std(C.rack, { roughness: 0.6, metalness: 0.2 }), wall: std(C.wall),
      glass: std(C.glass, { transparent: true, opacity: 0.28, roughness: 0.1, depthWrite: false }),
      pcb: std(C.pcb, { roughness: 0.5 }), tv: std(C.tv, { roughness: 0.35 }), carton: std(C.carton), pallet: std(C.pallet), tray: std(C.tray),
      person: std(C.person), skin: std(C.skin), tech: std(C.tech), agv: std(C.agv, { roughness: 0.6 }), stripe: std(C.stripe, { roughness: 0.5 }),
      truck: std(C.truck), cab: std(C.cab, { roughness: 0.5 }), mag: std(C.mag), zone: new T.MeshBasicMaterial({ color: C.zone }),
      aisle: new T.MeshBasicMaterial({ color: C.aisle }),
      edge: new T.LineBasicMaterial({ color: C.edge, transparent: true, opacity: C.edgeOp }),
      edgeSoft: new T.LineBasicMaterial({ color: C.edge, transparent: true, opacity: C.edgeOp * 0.45 }),
      grid: new T.LineBasicMaterial({ color: C.grid }), grid2: new T.LineBasicMaterial({ color: C.grid2 }),
      zoneLine: new T.LineBasicMaterial({ color: C.zoneLine, transparent: true, opacity: 0.9 }), aisleLine: new T.LineBasicMaterial({ color: C.aisleLine }),
      wrap: new T.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.32, roughness: 0.2, depthWrite: false }),
      sel: new T.MeshBasicMaterial({ color: S.info, side: T.DoubleSide }), route: new T.LineBasicMaterial({ color: S.info, transparent: true, opacity: 0.9 })
    };
    M.zone.side = T.DoubleSide;

    // TV test pattern for the burn-in wall (bars + a white window: a common aging pattern)
    function pattern() {
      const c = document.createElement('canvas'); c.width = 256; c.height = 144;
      const g = c.getContext('2d');
      const bars = ['#C0C0C0', '#C0C000', '#00C0C0', '#00C000', '#C000C0', '#C00000', '#0000C0'];
      bars.forEach((b, i) => { g.fillStyle = b; g.fillRect(i * 256 / 7, 0, 256 / 7 + 1, 104); });
      const grd = g.createLinearGradient(0, 0, 256, 0); grd.addColorStop(0, '#000'); grd.addColorStop(1, '#fff');
      g.fillStyle = grd; g.fillRect(0, 104, 256, 40);
      const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t;
    }
    const screenTex = pattern();
    M.screen = new T.MeshBasicMaterial({ map: screenTex, toneMapped: false });
    M.phoneScreen = new T.MeshBasicMaterial({ color: 0xDDE6F2, toneMapped: false });

    /* ---------------- helpers ---------------- */
    const geoCache = new Map();
    const boxG = (w, h, d) => { const k = `b${w}|${h}|${d}`; if (!geoCache.has(k)) geoCache.set(k, new T.BoxGeometry(w, h, d)); return geoCache.get(k); };
    const edgeCache = new Map();
    const edgeG = g => { if (!edgeCache.has(g.uuid)) edgeCache.set(g.uuid, new T.EdgesGeometry(g, 25)); return edgeCache.get(g.uuid); };
    function box(parent, w, h, d, mat, x, y, z, o = {}) {
      const g = boxG(w, h, d);
      const m = new T.Mesh(g, mat);
      m.position.set(x, y + h / 2, z);
      if (o.ry) m.rotation.y = o.ry;
      m.castShadow = o.shadow !== false; m.receiveShadow = true;
      parent.add(m);
      if (o.edge !== false) { const e = new T.LineSegments(edgeG(g), o.soft ? M.edgeSoft : M.edge); e.position.copy(m.position); e.rotation.copy(m.rotation); e.raycast = () => {}; parent.add(e); m.userData.edges = e; }
      return m;
    }
    function cyl(parent, r, h, mat, x, y, z, o = {}) {
      const g = new T.CylinderGeometry(r, o.r2 !== undefined ? o.r2 : r, h, o.seg || 20);
      const m = new T.Mesh(g, mat); m.position.set(x, y + h / 2, z);
      if (o.rx) m.rotation.x = o.rx; if (o.rz) m.rotation.z = o.rz;
      m.castShadow = o.shadow !== false; m.receiveShadow = true; parent.add(m);
      if (o.edge) { const e = new T.LineSegments(new T.EdgesGeometry(g, 40), M.edgeSoft); e.position.copy(m.position); e.rotation.copy(m.rotation); e.raycast = () => {}; parent.add(e); }
      return m;
    }
    function lines(parent, pts, mat, y = 0.02) {
      const g = new T.BufferGeometry();
      const a = new Float32Array(pts.length * 3);
      pts.forEach((p, i) => { a[i * 3] = p[0]; a[i * 3 + 1] = p[2] !== undefined ? p[2] : y; a[i * 3 + 2] = p[1]; });
      g.setAttribute('position', new T.BufferAttribute(a, 3));
      const l = new T.LineSegments(g, mat); l.raycast = () => {}; parent.add(l); return l;
    }
    // a flat frame (outline with real width) lying on the floor
    function frameGeo(w, d, t) {
      const s = new T.Shape(); s.moveTo(-w / 2, -d / 2); s.lineTo(w / 2, -d / 2); s.lineTo(w / 2, d / 2); s.lineTo(-w / 2, d / 2); s.lineTo(-w / 2, -d / 2);
      const h = new T.Shape(); const a = w / 2 - t, b = d / 2 - t; h.moveTo(-a, -b); h.lineTo(-a, b); h.lineTo(a, b); h.lineTo(a, -b); h.lineTo(-a, -b);
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

    const world = new T.Group(); scene.add(world);
    const pick = [];             // meshes that can be clicked (userData.ref)
    const tag = (obj, ref, name) => { obj.userData.ref = ref; obj.userData.name = name; obj.traverse(o => { if (o.isMesh) { o.userData.ref = ref; o.userData.name = name; pick.push(o); } }); };

    /* ---------------- floor, grid, zones, aisles, walls ---------------- */
    const floor = new T.Mesh(new T.PlaneGeometry(L.W + 70, L.D + 70), M.floor);
    floor.rotation.x = -Math.PI / 2; floor.position.set(L.W / 2, 0, L.D / 2); floor.receiveShadow = true; world.add(floor);
    floor.userData.ref = 'floor';
    {
      const minor = [], major = [];
      for (let x = 0; x <= L.W; x += 2) (x % 10 ? minor : major).push([x, 0], [x, L.D]);
      for (let z = 0; z <= L.D; z += 2) (z % 10 ? minor : major).push([0, z], [L.W, z]);
      lines(world, minor, M.grid, 0.004); lines(world, major, M.grid2, 0.006);
    }
    for (const z of L.ZONES) {
      const w = z.x1 - z.x0, d = z.z1 - z.z0;
      const m = new T.Mesh(new T.PlaneGeometry(w, d), M.zone); m.rotation.x = -Math.PI / 2; m.position.set(z.x0 + w / 2, 0.008, z.z0 + d / 2); m.receiveShadow = true; world.add(m);
      lines(world, [[z.x0, z.z0], [z.x1, z.z0], [z.x1, z.z0], [z.x1, z.z1], [z.x1, z.z1], [z.x0, z.z1], [z.x0, z.z1], [z.x0, z.z0]], M.zoneLine, 0.012);
    }
    for (const A of L.AISLES) {
      const h = A.a[1] === A.b[1];
      const len = h ? Math.abs(A.b[0] - A.a[0]) + 2.4 : Math.abs(A.b[1] - A.a[1]) + 2.4;
      const cx = (A.a[0] + A.b[0]) / 2, cz = (A.a[1] + A.b[1]) / 2;
      const m = new T.Mesh(new T.PlaneGeometry(h ? len : 2.4, h ? 2.4 : len), M.aisle); m.rotation.x = -Math.PI / 2; m.position.set(cx, 0.014, cz); m.receiveShadow = true; world.add(m);
      const e = h ? [[cx - len / 2, cz - 1.2], [cx + len / 2, cz - 1.2], [cx - len / 2, cz + 1.2], [cx + len / 2, cz + 1.2]] : [[cx - 1.2, cz - len / 2], [cx - 1.2, cz + len / 2], [cx + 1.2, cz - len / 2], [cx + 1.2, cz + len / 2]];
      lines(world, e, M.aisleLine, 0.018);
    }
    // perimeter wall, cut away to 1.4 m, with door gaps (west receiving, south docks)
    {
      const H = 1.4, t = 0.3;
      const gapsS = L.DOCKS.map(d => [d.x - 2.2, d.x + 2.2]);
      const gapsW = [[11.5, 16.5], [27.5, 32.5]];
      const run = (a, b, gaps, fn) => { let s = a; for (const [g0, g1] of gaps.concat([[b, b]])) { if (g0 > s) fn(s, g0); s = g1; } };
      run(0, L.W, [], (a, b) => box(world, b - a, H, t, M.wall, (a + b) / 2, 0, 0, { soft: true }));
      run(0, L.W, gapsS, (a, b) => box(world, b - a, H, t, M.wall, (a + b) / 2, 0, L.D, { soft: true }));
      run(0, L.D, gapsW, (a, b) => box(world, t, H, b - a, M.wall, 0, 0, (a + b) / 2, { soft: true }));
      run(0, L.D, [], (a, b) => box(world, t, H, b - a, M.wall, L.W, 0, (a + b) / 2, { soft: true }));
      // steel columns on a 16 m grid, short so they never hide the floor
      for (let x = 16; x < L.W; x += 16) for (const z of [0.3, L.D - 0.3]) box(world, 0.45, 2.6, 0.45, M.metal, x, 0, z, { soft: true });
      // dock levelers outside the doors
      for (const d of L.DOCKS) box(world, 3.4, 0.9, 1.2, M.metal, d.x, 0, L.D + 0.75, { soft: true });
    }

    /* ---------------- machines ---------------- */
    const ST = new Map();          // station id → view record
    function andon(g, x, y, z) {
      const pole = cyl(g, 0.025, 0.55, M.metal, x, y, z, { shadow: false });
      const mk = (yy) => { const m = new T.Mesh(new T.CylinderGeometry(0.06, 0.06, 0.08, 14), new T.MeshBasicMaterial({ color: S.off })); m.position.set(x, y + 0.55 + yy, z); g.add(m); return m; };
      void pole;
      return { r: mk(0.2), a: mk(0.12), gr: mk(0.04) };
    }
    function robotArm(g, x, z, scale = 1, mat = M.body) {
      const base = cyl(g, 0.24 * scale, 0.3 * scale, M.dark, x, 0.8 * scale, z, { edge: true });
      const yaw = new T.Group(); yaw.position.set(x, 1.1 * scale, z); g.add(yaw);
      const sh = new T.Group(); sh.position.y = 0.12 * scale; yaw.add(sh);
      const up = box(sh, 0.16 * scale, 0.85 * scale, 0.2 * scale, mat, 0, 0, 0);
      const el = new T.Group(); el.position.y = 0.85 * scale; sh.add(el);
      const fo = box(el, 0.7 * scale, 0.13 * scale, 0.15 * scale, mat, 0.32 * scale, -0.06 * scale, 0);
      box(el, 0.08 * scale, 0.22 * scale, 0.08 * scale, M.dark, 0.68 * scale, -0.28 * scale, 0, { soft: true });
      void base; void up; void fo;
      return { yaw, sh, el };
    }
    function gantry(g, W, D, y) {
      const beam = box(g, 0.1, 0.08, D * 0.9, M.dark, 0, y, 0, { soft: true });
      const head = box(g, 0.2, 0.22, 0.18, M.metal, 0, y - 0.18, 0, { soft: true });
      return { beam, head, W, D };
    }
    function buildStation(s) {
      const g = new T.Group(); g.position.set(s.x, 0, s.z); if (s.flip) g.rotation.y = Math.PI;
      const W = s.w, D = s.d, H = s.h;
      const v = { s, g, anim: null, kind: s.kind, body: [] };
      const body = M.body.clone(); v.bodyMat = body;
      const b = (w, h, d, x, y, z, mat = body, o) => { const m = box(g, w, h, d, mat, x, y, z, o); if (mat === body) v.body.push(m); return m; };
      switch (s.kind) {
        case 'loader': case 'unloader':
          b(W, H * 0.6, D, 0, 0, 0);
          b(W * 0.8, H * 0.38, D * 0.7, 0, H * 0.6, 0, M.mag, { soft: true });
          for (let i = 0; i < 6; i++) box(g, W * 0.82, 0.015, D * 0.72, M.metal, 0, H * 0.62 + i * 0.06, 0, { edge: false, shadow: false });
          break;
        case 'printer':
          b(W, H * 0.72, D, 0, 0, 0);
          box(g, W * 0.96, H * 0.24, D * 0.94, M.glass, 0, H * 0.72, 0, { soft: true, shadow: false });
          box(g, 0.34, 0.24, 0.04, M.dark, W * 0.3, H * 0.72, D / 2 + 0.02, { soft: true });
          v.anim = { kind: 'squeegee', m: box(g, W * 0.12, 0.05, D * 0.8, M.metal, 0, H * 0.72 + 0.05, 0, { soft: true }) };
          break;
        case 'spi': case 'aoi':
          b(W, H * 0.74, D, 0, 0, 0);
          box(g, W * 0.9, H * 0.18, D * 0.9, M.glass, 0, H * 0.74, 0, { soft: true, shadow: false });
          cyl(g, 0.16, 0.22, M.dark, 0, H * 0.92, 0, { edge: true });
          break;
        case 'mounter': case 'bond': {
          b(W, H * 0.55, D, 0, 0, 0);
          box(g, W, H * 0.4, D, M.glass, 0, H * 0.55, 0, { soft: true, shadow: false });
          if (s.kind === 'mounter') for (const sz of [-1, 1]) box(g, W * 0.86, H * 0.36, 0.3, M.body2, 0, H * 0.18, sz * (D / 2 + 0.15), { soft: true });
          const gt = gantry(g, W, D, H * 0.9);
          v.anim = { kind: 'gantry', gt };
          break;
        }
        case 'reflow': {
          b(W * 0.84, H * 0.8, D, 0, 0, 0);
          b(W * 0.08, H * 0.55, D * 0.75, -W * 0.46, 0, 0); b(W * 0.08, H * 0.55, D * 0.75, W * 0.46, 0, 0);
          for (let i = 0; i < 8; i++) box(g, W * 0.07, 0.04, D * 0.55, M.dark, -W * 0.36 + i * W * 0.103, H * 0.8, 0, { soft: true, shadow: false });
          box(g, 0.32, 0.22, 0.04, M.dark, W * 0.3, H * 0.45, D / 2 + 0.02, { soft: true });
          break;
        }
        case 'robot': {
          b(W, 0.8, D, 0, 0, 0, M.body2 === body ? body : body, { soft: true });
          // light fence posts at the corners
          for (const [px, pz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) box(g, 0.05, 1.6, 0.05, M.metal, px * (W / 2 - 0.05), 0.8, pz * (D / 2 - 0.05), { soft: true, shadow: false });
          lines(g, [[-W / 2, -D / 2, 2.4], [W / 2, -D / 2, 2.4], [W / 2, -D / 2, 2.4], [W / 2, D / 2, 2.4], [-W / 2, D / 2, 2.4], [-W / 2, -D / 2, 2.4]], M.edgeSoft);
          v.anim = { kind: 'arm', arm: robotArm(g, -W * 0.15, 0, 1) };
          break;
        }
        case 'bench': case 'repair': {
          b(W, 0.06, D, 0, 0.86, 0, body, { soft: false });
          for (const [px, pz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) box(g, 0.05, 0.86, 0.05, M.metal, px * (W / 2 - 0.08), 0, pz * (D / 2 - 0.08), { soft: true, shadow: false });
          box(g, W * 0.92, 0.04, 0.32, M.body2, 0, 1.55, -D / 2 + 0.2, { soft: true });
          for (const px of [-1, 1]) box(g, 0.04, 0.72, 0.04, M.metal, px * W * 0.45, 0.9, -D / 2 + 0.2, { soft: true, shadow: false });
          box(g, 0.42, 0.28, 0.03, M.dark, W * 0.3, 0.98, -D / 2 + 0.3, { soft: true });
          break;
        }
        case 'fct': {
          b(W, H * 0.48, D, 0, 0, 0);
          box(g, W * 0.9, H * 0.5, 0.12, M.dark, 0, H * 0.48, -D * 0.3, { soft: true });
          box(g, W * 0.78, H * 0.38, 0.02, M.screen, 0, H * 0.54, -D * 0.3 + 0.07, { edge: false, shadow: false });
          break;
        }
        case 'qc': {
          box(g, W, H, 0.12, M.dark, 0, 0, -D / 2, { soft: true }); box(g, W, H, 0.12, M.dark, 0, 0, D / 2, { soft: true });
          box(g, W, 0.12, D, M.dark, 0, H, 0, { soft: true });
          v.body.push(b(W * 0.3, H * 0.4, D * 0.6, 0, 0, 0));
          cyl(g, 0.14, 0.3, M.metal, 0, H - 0.3, 0, { edge: true });
          break;
        }
        case 'packer': {
          b(W, H * 0.6, D, 0, 0, 0);
          box(g, W, H * 0.4, D, M.glass, 0, H * 0.6, 0, { soft: true, shadow: false });
          for (let i = 0; i < 4; i++) box(g, 1.3, 0.12, 0.85, M.carton, -W / 2 - 0.9, i * 0.13, D * 0.15, { soft: true });
          break;
        }
        case 'palletizer': {
          box(g, W, 0.12, D, M.body2, 0, 0, 0, { soft: true });
          for (const [px, pz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) box(g, 0.06, 2.0, 0.06, M.metal, px * (W / 2 - 0.05), 0.12, pz * (D / 2 - 0.05), { soft: true, shadow: false });
          v.body.push(b(0.8, 0.9, 0.8, 0, 0, 0));
          v.anim = { kind: 'arm', arm: robotArm(g, 0, 0, 1.6) };
          break;
        }
        default:
          if (s.kind !== 'burnin') b(W, H, D, 0, 0, 0);
      }
      if (s.kind !== 'burnin') {
        const ax = s.kind === 'bench' || s.kind === 'repair' ? W / 2 - 0.15 : W / 2 - 0.12;
        v.andon = andon(g, ax, s.kind === 'bench' || s.kind === 'repair' ? 1.6 : s.kind === 'robot' ? 2.4 : H, -D / 2 + 0.12);
        // abnormal-state frame on the floor
        v.frame = new T.Mesh(frameGeo(W + 0.9, D + 0.9, 0.22), new T.MeshBasicMaterial({ color: S.bad, side: T.DoubleSide, transparent: true, opacity: 0.95 }));
        v.frame.position.y = 0.03; v.frame.visible = false; g.add(v.frame);
      }
      world.add(g);
      tag(g, 'st:' + s.id, s.name);
      ST.set(s.id, v);
      return v;
    }
    P.stations.forEach(buildStation);

    /* burn-in racks: three TV rows and two phone rows */
    {
      const B = E.BURN;
      const g = new T.Group(); world.add(g);
      for (let r = 0; r < 3; r++) {
        const z = 32 + r * 3.4, x0 = 101 - 0.8, x1 = 101 + 11 * 1.45 + 0.8;
        box(g, x1 - x0, 0.45, 0.7, M.body2, (x0 + x1) / 2, 0, z, { soft: true });
        box(g, x1 - x0, 0.06, 0.08, M.metal, (x0 + x1) / 2, 1.55, z - 0.3, { soft: true });
        for (let i = 0; i <= 12; i++) box(g, 0.05, 1.1, 0.05, M.metal, x0 + i * (x1 - x0) / 12, 0.45, z - 0.3, { soft: true, shadow: false });
      }
      for (let r = 0; r < 2; r++) {
        const z = 43.5 + r * 2.6, x0 = 101 - 0.6, x1 = 101 + 23 * 0.72 + 0.6;
        box(g, x1 - x0, 0.85, 1.0, M.body2, (x0 + x1) / 2, 0, z, { soft: true });
      }
      tag(g, 'st:' + B.id, 'Burn-in');
      const v = { s: B, g, body: [], kind: 'burnin' }; ST.set(B.id, v);
    }

    /* ---------------- conveyors ---------------- */
    const SEGY = sg => (sg.from && (sg.from.line === 'L1' || sg.from.line === 'L2') ? 0.9 : 0.86);
    const SEGW = sg => (sg.from && (sg.from.line === 'L1' || sg.from.line === 'L2') ? 0.36 : sg.from && sg.from.line === 'L4' || sg === undefined ? 0.5 : 1.2);
    for (const sg of P.segs) {
      const y = SEGY(sg), w = SEGW(sg);
      for (let i = 1; i < sg.path.length; i++) {
        const a = sg.path[i - 1], c = sg.path[i];
        const len = Math.hypot(c[0] - a[0], c[1] - a[1]); if (len < 0.01) continue;
        const ang = Math.atan2(c[1] - a[1], c[0] - a[0]);
        const mx = (a[0] + c[0]) / 2, mz = (a[1] + c[1]) / 2;
        const ext = i < sg.path.length - 1 ? w / 2 : 0;
        const m = box(world, len + ext, 0.06, w, M.belt, mx, y - 0.08, mz, { ry: -ang, soft: true });
        for (const side of [-1, 1]) {
          const r = box(world, len + ext, 0.07, 0.04, M.metal, mx - Math.sin(ang) * side * (w / 2), y - 0.08, mz + Math.cos(ang) * side * (w / 2), { ry: -ang, edge: false, shadow: false });
          void r;
        }
        for (let k = 0; k <= Math.floor(len / 2.2); k++) {
          const t = Math.min(1, (k * 2.2 + 0.4) / len);
          box(world, 0.05, y - 0.08, w * 0.9, M.metal, a[0] + (c[0] - a[0]) * t, 0, a[1] + (c[1] - a[1]) * t, { ry: -ang, edge: false, shadow: false });
        }
        void m;
      }
    }

    /* ---------------- supermarket, line-side stock, warehouse racks ---------------- */
    const SMV = {};
    for (const [lane, z] of [['main', 10.6], ['power', 19.4]]) {
      const g = new T.Group(); g.position.set(73, 0, z); world.add(g);
      box(g, 5.2, 0.06, 1.3, M.rack, 0, 0.02, 0, { soft: true });
      for (let lv = 1; lv <= 3; lv++) box(g, 5.2, 0.05, 1.3, M.rack, 0, lv * 0.62, 0, { soft: true, shadow: false });
      for (const px of [-2.55, 2.55]) for (const pz of [-0.6, 0.6]) box(g, 0.06, 2.0, 0.06, M.rack, px, 0, pz, { soft: true, shadow: false });
      const mag = new T.InstancedMesh(boxG(0.36, 0.5, 0.95), M.mag, 24); mag.castShadow = true; g.add(mag);
      tag(g, 'buf:SM:' + lane, (lane === 'main' ? 'Main' : 'Power') + '-board supermarket');
      SMV[lane] = { g, mag };
    }
    const LSV = {};
    const MATC = { pcbMain: M.pcb, pcbPower: M.pcb, reel: M.dark, panel: M.tray, main: M.mag, power: M.mag, cover: M.dark, housing: M.tray, display: M.dark, carton: M.carton };
    for (const b of Object.values(E.LS)) {
      const st = P.byId[b.station], sp = L.STOPS[b.id];
      const g = new T.Group();
      // stand the stock between the drop point and the station
      const dz = Math.sign(st.z - sp.z) || 1;
      g.position.set(sp.x, 0, sp.z + dz * 0.65); world.add(g);
      box(g, 0.9, 0.12, 0.7, M.metal, 0, 0.06, 0, { soft: true });
      const fill = new T.Mesh(boxG(0.8, 1, 0.6), MATC[b.mat] || M.tray); fill.castShadow = true; g.add(fill);
      const fe = new T.LineSegments(edgeG(fill.geometry), M.edgeSoft); g.add(fe);
      const fr = new T.Mesh(frameGeo(1.4, 1.2, 0.16), new T.MeshBasicMaterial({ color: S.warn, side: T.DoubleSide })); fr.position.y = 0.03; fr.visible = false; g.add(fr);
      tag(g, 'buf:' + b.id, `${b.label} at ${st.name}`);
      LSV[b.id] = { g, fill, fe, fr, b };
    }
    // raw-material racks: five rows, three levels, bays of 2.6 m; each material owns the bays nearest its pick point
    const RMV = { pallets: null, bays: [] };
    {
      const rows = [4.5, 7.6, 13.2, 16.3, 22.4];
      const parts = [];
      for (const x of rows) {
        for (let i = 0; i <= 17; i++) { const z = 6 + i * 2.6; for (const dx of [-0.55, 0.55]) { const u = new T.BoxGeometry(0.08, 4.4, 0.08); u.translate(x + dx, 2.2, z); parts.push(u); } }
        for (const y of [0.15, 1.6, 3.05]) { const be = new T.BoxGeometry(0.1, 0.1, 17 * 2.6); be.translate(x - 0.55, y, 6 + 17 * 1.3); parts.push(be); const be2 = be.clone(); be2.translate(1.1, 0, 0); parts.push(be2); }
        for (let i = 0; i < 17; i++) for (const lv of [0, 1, 2]) RMV.bays.push({ x, z: 6 + i * 2.6 + 1.3, y: 0.2 + lv * 1.45, mat: null });
      }
      const rack = new T.Mesh(T.mergeGeometries(parts), M.rack); rack.castShadow = true; rack.receiveShadow = true; world.add(rack);
      // assign bays to materials by nearest pick point (z)
      const mats = Object.keys(E.RM);
      for (const bay of RMV.bays) {
        let best = null;
        for (const k of mats) { const sp = L.STOPS['RM:' + k]; const d = Math.abs(sp.z - bay.z) + (bay.x > 20 ? 0 : 3); if (!best || d < best.d) best = { d, k }; }
        bay.mat = best.k;
      }
      RMV.byMat = {}; for (const k of mats) RMV.byMat[k] = RMV.bays.filter(b => b.mat === k).sort((a, b) => (b.x - a.x) || (a.y - b.y));
      RMV.base = new T.InstancedMesh(boxG(1.0, 0.13, 2.2), M.pallet, RMV.bays.length);
      RMV.load = new T.InstancedMesh(boxG(0.95, 1.0, 2.1), std(0xffffff), RMV.bays.length);
      RMV.load.instanceColor = null;
      RMV.base.castShadow = RMV.load.castShadow = true;
      world.add(RMV.base, RMV.load);
      const zones = new T.Group(); world.add(zones);
      for (const k of mats) {
        const bays = RMV.byMat[k]; const zs = bays.map(b => b.z);
        const g = new T.Group(); const z0 = Math.min(...zs) - 1.3, z1 = Math.max(...zs) + 1.3;
        const hit = new T.Mesh(boxG(19.5, 4.4, z1 - z0), new T.MeshBasicMaterial({ visible: false })); hit.position.set(13.5, 2.2, (z0 + z1) / 2); g.add(hit);
        zones.add(g); tag(g, 'buf:RM:' + k, E.RM[k].label + ' · raw-material warehouse');
      }
      RMV.color = new T.Color();
    }
    // finished-goods floor bays
    {
      const pts = [];
      for (const s of P.fgSlots) { const x = s.x, z = s.z; pts.push([x - 0.75, z - 0.65], [x + 0.75, z - 0.65], [x + 0.75, z - 0.65], [x + 0.75, z + 0.65], [x + 0.75, z + 0.65], [x - 0.75, z + 0.65], [x - 0.75, z + 0.65], [x - 0.75, z - 0.65]); }
      lines(world, pts, M.zoneLine, 0.02);
    }

    /* ---------------- utilities and the shop ---------------- */
    for (const u of P.util.assets) {
      const g = new T.Group(); g.position.set(u.x, 0, u.z); world.add(g);
      if (u.kind === 'transformer') { box(g, 2.6, 2.0, 1.8, M.body, 0, 0, 0); for (let i = 0; i < 6; i++) box(g, 0.05, 1.6, 2.1, M.metal, -1.0 + i * 0.4, 0.2, 0, { soft: true, shadow: false }); }
      if (u.kind === 'compressor') { box(g, 2.8, 1.6, 1.6, M.body, 0, 0, 0); cyl(g, 0.45, 2.4, M.body2, 0, 1.6 + 0.0, 0, { rz: Math.PI / 2, edge: true }); }
      if (u.kind === 'chiller') { box(g, 4.4, 1.9, 2.4, M.body, 0, 0, 0); for (let i = 0; i < 3; i++) cyl(g, 0.55, 0.12, M.dark, -1.4 + i * 1.4, 1.9, 0, { edge: true }); }
      tag(g, 'util:' + u.id, u.name);
      u.view = g;
    }
    {
      const g = new T.Group(); world.add(g);
      box(g, 3.4, 0.9, 1.2, M.body, 92.5, 0, 5.2); box(g, 3.4, 1.8, 0.6, M.body2, 96.2, 0, 4.6, { soft: true });
      tag(g, 'zone:shop', 'Maintenance shop');
    }

    /* ---------------- moving things: AGVs, forklifts, trucks, people ---------------- */
    const AGV = new Map();
    for (const a of P.agvs) {
      const g = new T.Group(); world.add(g);
      box(g, 1.1, 0.32, 0.72, M.agv, 0, 0.06, 0);
      box(g, 1.12, 0.06, 0.74, M.stripe, 0, 0.22, 0, { edge: false });
      cyl(g, 0.08, 0.08, M.dark, 0.42, 0.38, 0, { edge: false });
      const load = new T.Mesh(boxG(0.92, 0.55, 0.62), M.carton); load.position.y = 0.38 + 0.275; load.castShadow = true; g.add(load);
      const le = new T.LineSegments(edgeG(load.geometry), M.edgeSoft); le.position.copy(load.position); g.add(le);
      const fr = new T.Mesh(frameGeo(1.8, 1.4, 0.2), new T.MeshBasicMaterial({ color: S.bad, side: T.DoubleSide })); fr.position.y = 0.03; fr.visible = false; g.add(fr);
      tag(g, 'agv:' + a.id, a.id);
      AGV.set(a.id, { g, load, le, fr });
    }
    const FL = new Map();
    for (const f of P.forklifts) {
      const g = new T.Group(); world.add(g);
      box(g, 1.3, 1.0, 0.95, M.cab, -0.2, 0.15, 0);
      box(g, 0.9, 0.06, 0.95, M.metal, -0.2, 2.1, 0, { soft: true });
      for (const pz of [-0.42, 0.42]) { box(g, 0.05, 1.95, 0.05, M.metal, -0.62, 0.15, pz, { soft: true, shadow: false }); box(g, 0.05, 2.4, 0.07, M.dark, 0.5, 0.0, pz * 0.8, { soft: true }); }
      for (const pz of [-0.25, 0.25]) box(g, 1.2, 0.05, 0.12, M.dark, 1.1, 0.12, pz, { soft: true });
      for (const [px, pz] of [[-0.6, -0.45], [-0.6, 0.45], [0.3, -0.45], [0.3, 0.45]]) cyl(g, 0.17, 0.12, M.dark, px, 0.17, pz, { rx: Math.PI / 2, edge: false });
      const person = new T.Mesh(new T.CapsuleGeometry(0.18, 0.45, 4, 10), M.person); person.position.set(-0.2, 1.5, 0); g.add(person);
      tag(g, 'fl:' + f.id, f.id);
      FL.set(f.id, { g });
    }
    function truckModel(len = 12) {
      const g = new T.Group();
      box(g, len, 2.7, 2.5, M.truck, 0, 1.0, 0);
      box(g, 2.3, 2.4, 2.4, M.cab, len / 2 + 1.35, 0.55, 0);
      box(g, 0.05, 0.9, 2.2, M.glass, len / 2 + 2.5, 1.9, 0, { soft: true, shadow: false });
      for (const px of [-len / 2 + 1.2, -len / 2 + 2.6, len / 2 + 1.0]) for (const pz of [-1.05, 1.05]) cyl(g, 0.48, 0.3, M.dark, px, 0.48, pz, { rx: Math.PI / 2 });
      world.add(g); return g;
    }
    const TRK = new Map(), INB = new Map();
    const PEOPLE = new Map();
    for (const p of P.people) {
      if (p.role === 'Forklift') continue;
      const g = new T.Group(); world.add(g);
      const bodyM = p.role === 'Technician' ? M.tech : M.person;
      const b = new T.Mesh(new T.CapsuleGeometry(0.21, 0.78, 4, 12), bodyM); b.position.y = 0.65; b.castShadow = true; g.add(b);
      const h = new T.Mesh(new T.SphereGeometry(0.13, 14, 10), M.skin); h.position.y = 1.32; h.castShadow = true; g.add(h);
      tag(g, 'person:' + p.id, p.name);
      PEOPLE.set(p.id, { g, b, h, p });
    }

    /* ---------------- units (instanced) ---------------- */
    function inst(geo, mat, n, shadow = false) { const m = new T.InstancedMesh(geo, mat, n); m.castShadow = shadow; m.receiveShadow = false; m.count = 0; m.frustumCulled = false; world.add(m); m.userData.units = []; pick.push(m); return m; }
    const U = {
      pcb: inst(boxG(0.24, 0.018, 0.17), M.pcb, 500),
      carrier: inst(boxG(1.42, 0.05, 0.88), M.tray, 200),
      tv: inst(boxG(1.24, 0.045, 0.72), M.tv, 300, true),
      screen: inst(new T.PlaneGeometry(1.18, 0.66), M.screen, 120),
      tray: inst(boxG(0.36, 0.03, 0.24), M.tray, 250),
      phone: inst(boxG(0.16, 0.012, 0.078), M.tv, 300),
      pscreen: inst(new T.PlaneGeometry(0.14, 0.066), M.phoneScreen, 120),
      cartonTv: inst(boxG(1.42, 0.24, 0.86), M.carton, 120, true),
      cartonPh: inst(boxG(0.22, 0.08, 0.12), M.carton, 200),
      palBase: inst(boxG(1.2, 0.14, 1.0), M.pallet, 120, true),
      palLoad: inst(boxG(1.18, 1, 0.98), M.carton, 120, true),
      palWrap: inst(boxG(1.22, 1, 1.02), M.wrap, 120),
      boardInOven: null
    };
    U.screen.userData.units = []; U.pscreen.userData.units = [];
    const mtx = new T.Matrix4(), q = new T.Quaternion(), pos = new T.Vector3(), scl = new T.Vector3(1, 1, 1), up = new T.Vector3(0, 1, 0), eul = new T.Euler();
    function put(mesh, u, x, y, z, yaw = 0, sx = 1, sy = 1, sz = 1, pitch = 0) {
      const i = mesh.count; if (i >= mesh.instanceMatrix.count) return;
      eul.set(pitch, yaw, 0, 'YXZ'); q.setFromEuler(eul); pos.set(x, y, z); scl.set(sx, sy, sz);
      mtx.compose(pos, q, scl); mesh.setMatrixAt(i, mtx); mesh.userData.units[i] = u; mesh.count = i + 1;
    }
    function polyAt(p, s) {
      for (let i = 1; i < p.length; i++) {
        const d = Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]);
        if (s <= d || i === p.length - 1) { const k = d ? Math.min(1, Math.max(0, s / d)) : 0; return [p[i - 1][0] + (p[i][0] - p[i - 1][0]) * k, p[i - 1][1] + (p[i][1] - p[i - 1][1]) * k, Math.atan2(p[i][1] - p[i - 1][1], p[i][0] - p[i - 1][0])]; }
        s -= d;
      }
      return [p[0][0], p[0][1], 0];
    }
    const unitPos = new Map();     // unit → [x, y, z] this frame (for follow and selection)
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
      for (const k in U) if (U[k]) { U[k].count = 0; }
      unitPos.clear();
      for (const sg of P.segs) {
        const y = SEGY(sg) - 0.02;
        for (const it of sg.items) { const p = polyAt(sg.path, it.s); drawUnit(it.u, p[0], y, p[1], -p[2], true); }
      }
      for (const s of P.stations) {
        if (!s.procs.length || s === E.BURN) continue;
        const flip = s.flip ? -1 : 1;
        s.procs.forEach((pr, i) => {
          let x = s.x, y = s.kind === 'reflow' || s.line === 'L1' || s.line === 'L2' ? 0.88 : 0.84, z = s.z;
          if (s.kind === 'reflow') { const tot = s.base * s.slots; const k = 1 - Math.max(0, pr.left) / tot; x = s.x - s.w * 0.42 + s.w * 0.84 * k; }
          else if (s.slots > 1) { x += (i - (s.procs.length - 1) / 2) * 0.9; }
          if (s.kind === 'bench' || s.kind === 'repair') y = 0.93;
          if (s.kind === 'robot') y = 0.82;
          if (s.kind === 'fct' || s.kind === 'packer' || s.kind === 'qc' || s.kind === 'bond') y = s.kind === 'qc' ? 0.9 : s.h * 0.48 + 0.02;
          drawUnit(pr.u, x, y, z, s.flip ? Math.PI : 0, s.kind !== 'bench');
          void flip;
        });
      }
      // burn-in racks: TVs stand with the test pattern on; phones lie in trays with lit screens
      for (const r of E.BURN.rack) {
        if (!r.u) continue;
        unitPos.set(r.u, [r.x, 1.1, r.z]);
        if (r.kind === 'tv') {
          put(U.tv, r.u, r.x, 0.45 + 0.39, r.z, 0, 1, 1, 1, Math.PI / 2);
          put(U.screen, r.u, r.x, 0.45 + 0.39, r.z + 0.03, 0);
        } else {
          put(U.tray, r.u, r.x, 0.86, r.z, Math.PI / 2); put(U.phone, r.u, r.x, 0.88, r.z, Math.PI / 2);
          put(U.pscreen, r.u, r.x, 0.888, r.z, Math.PI / 2, 1, 1, 1, -Math.PI / 2);
        }
      }
      // pallets wherever they are: building, pick-up, on a fork, in finished goods, in a truck
      for (const p of P.pallets) {
        let x = p.x, z = p.z, y = 0, yaw = 0;
        if (p.where === 'fork') { const f = P.forklifts.find(f => f.load === p); if (f) { x = f.x + Math.cos(f.h) * 1.2; z = f.z + Math.sin(f.h) * 1.2; y = 0.2; yaw = -f.h; } }
        else if (p.where === 'truck' && p.truck) { const tv = TRK.get(p.truck.id); if (!tv) continue; const i = p.truck.pallets.indexOf(p); const d = p.truck.dock; x = d.x + (i % 2 ? 0.62 : -0.62); z = L.D + 1.6 + Math.floor(i / 2) * 1.1 + (1 - p.truck.k) * 30; y = 1.05; }
        else if (p.where === 'fg' && p.slot) { x = p.slot.x; z = p.slot.z; }
        const fill = p.units.length / p.cap;
        const h = p.product === 'tv' ? 0.25 * Math.ceil(p.units.length / 2) : 0.08 * Math.ceil(p.units.length / 10) * 1.6;
        put(U.palBase, p, x, y + 0.07, z, yaw);
        if (p.units.length) put(U.palLoad, p, x, y + 0.14 + h / 2, z, yaw, 1, h, 1);
        if (p.where !== 'build' && fill >= 1) put(U.palWrap, p, x, y + 0.14 + h / 2, z, yaw, 1, h + 0.02, 1);
        unitPos.set(p, [x, y + 0.6, z]);
      }
      for (const k in U) if (U[k]) U[k].instanceMatrix.needsUpdate = true;
    }

    /* ---------------- selection reticle, route line, flow chevrons ---------------- */
    const reticle = new T.Mesh(cornersGeo(1, 1, 0.35, 0.09), M.sel); reticle.position.y = 0.04; reticle.visible = false; world.add(reticle);
    let retW = 0, retD = 0;
    function setReticle(info) {
      retW = info.w; retD = info.d;
      const w = info.w + 1.2, d = info.d + 1.2, len = Math.min(w, d) * 0.28 + 0.3, t = Math.max(0.12, Math.min(0.35, Math.max(w, d) * 0.03));
      reticle.geometry.dispose(); reticle.geometry = cornersGeo(w, d, len, t);
    }
    let routeLine = null;
    const chev = (() => {
      const s = new T.Shape(); s.moveTo(0.35, 0); s.lineTo(-0.2, 0.22); s.lineTo(-0.08, 0); s.lineTo(-0.2, -0.22); s.lineTo(0.35, 0);
      const g = new T.ShapeGeometry(s); g.rotateX(-Math.PI / 2);
      const m = new T.InstancedMesh(g, new T.MeshBasicMaterial({ color: S.info, transparent: true, opacity: 0.9, side: T.DoubleSide, depthWrite: false }), 900);
      m.count = 0; m.frustumCulled = false; m.renderOrder = 3; world.add(m); return m;
    })();

    /* ---------------- theme ---------------- */
    function applyTheme() {
      C = PAL[theme]; S = STATUS[theme];
      scene.background = new T.Color(C.bg);
      scene.fog = null;
      hemi.color.set(C.hemi[0]); hemi.groundColor.set(C.hemi[1]); hemi.intensity = C.hemi[2]; sun.intensity = C.sun; amb.intensity = C.amb;
      const set = (m, c) => m.color.set(c);
      set(M.floor, C.floor); set(M.body, C.body); set(M.body2, C.body2); set(M.dark, C.dark); set(M.belt, C.belt); set(M.metal, C.metal); set(M.rack, C.rack);
      set(M.wall, C.wall); set(M.glass, C.glass); set(M.pcb, C.pcb); set(M.tv, C.tv); set(M.carton, C.carton); set(M.pallet, C.pallet); set(M.tray, C.tray);
      set(M.person, C.person); set(M.tech, C.tech); set(M.agv, C.agv); set(M.stripe, C.stripe); set(M.truck, C.truck); set(M.cab, C.cab); set(M.mag, C.mag);
      set(M.zone, C.zone); set(M.aisle, C.aisle); set(M.grid, C.grid); set(M.grid2, C.grid2); set(M.zoneLine, C.zoneLine); set(M.aisleLine, C.aisleLine);
      M.edge.color.set(C.edge); M.edge.opacity = C.edgeOp; M.edgeSoft.color.set(C.edge); M.edgeSoft.opacity = C.edgeOp * 0.45;
      M.sel.color.set(S.info); M.route.color.set(S.info); chev.material.color.set(S.info);
      for (const v of ST.values()) if (v.bodyMat) v.bodyMat.color.set(C.body);
    }
    applyTheme();

    /* ---------------- per-frame view of the plant ---------------- */
    let overlay = 'status';
    const color = new T.Color();
    const STATE_C = st => (st === 'down' ? S.bad : st === 'maint' ? S.maint : st === 'micro' || st === 'warn' || st === 'starved' || st === 'changeover' ? S.warn : null);
    function ramp(k) {   // sequential: body colour → brand blue (energy), never decorative
      const a = new T.Color(C.body), b = new T.Color(theme === 'dark' ? 0x2189FF : 0x1428A0);
      return a.lerp(b, Math.max(0, Math.min(1, k)));
    }
    let tAnim = 0;
    function updateMachines(dt) {
      tAnim += dt;
      const kwMax = Math.max(...P.stations.map(s => s.kwNow || 0), 1);
      for (const v of ST.values()) {
        const s = v.s, st = s.state;
        if (v.andon) {
          const lit = st === 'run' ? 'gr' : st === 'down' ? 'r' : st === 'maint' ? null : st === 'idle' || st === 'blocked' ? null : 'a';
          v.andon.r.material.color.set(lit === 'r' ? S.bad : S.off);
          v.andon.a.material.color.set(lit === 'a' ? S.warn : st === 'maint' ? S.maint : S.off);
          v.andon.gr.material.color.set(lit === 'gr' ? S.ok : S.off);
        }
        const sc = STATE_C(st);
        if (v.frame) { v.frame.visible = !!sc && overlay !== 'energy'; if (sc) v.frame.material.color.set(sc); }
        if (v.bodyMat) {
          if (overlay === 'energy') v.bodyMat.color.copy(ramp((s.kwNow || 0) / kwMax));
          else if (overlay === 'quality' && (s.kind === 'aoi' || s.kind === 'fct' || s.kind === 'qc')) {
            const tot = s.counters.made + s.counters.bad, r = tot ? s.counters.bad / tot : 0;
            v.bodyMat.color.copy(new T.Color(C.body).lerp(new T.Color(r > 0.03 ? S.bad : S.warn), Math.min(1, r / 0.03)));
          } else v.bodyMat.color.set(st === 'down' ? new T.Color(C.body).lerp(new T.Color(S.bad), 0.35) : C.body);
        }
        const on = st === 'run' || st === 'warn';
        if (v.anim && on) {
          const t = tAnim * (st === 'warn' ? 0.6 : 1);
          if (v.anim.kind === 'gantry') { const g = v.anim.gt; g.beam.position.x = Math.sin(t * 2.1 + s.x) * s.w * 0.3; g.head.position.x = g.beam.position.x; g.head.position.z = Math.sin(t * 5.3 + s.x * 2) * s.d * 0.32; }
          if (v.anim.kind === 'arm') { const a = v.anim.arm; a.yaw.rotation.y = Math.sin(t * 0.9 + s.x) * 1.4; a.sh.rotation.z = -0.35 + Math.sin(t * 1.3 + s.x) * 0.25; a.el.rotation.z = -0.9 + Math.sin(t * 1.7) * 0.35; }
          if (v.anim.kind === 'squeegee') v.anim.m.position.x = Math.sin(t * 1.6) * s.w * 0.36;
        }
      }
      // supermarket magazines: one magazine per 10 boards
      for (const lane of ['main', 'power']) {
        const m = SMV[lane].mag, n = Math.min(24, Math.ceil(E.SM[lane].items.length / 10));
        m.count = n;
        for (let i = 0; i < n; i++) { const lv = Math.floor(i / 8), k = i % 8; mtx.makeTranslation(-2.2 + k * 0.62, 0.32 + lv * 0.62, 0); m.setMatrixAt(i, mtx); }
        m.instanceMatrix.needsUpdate = true;
      }
      // line-side stock: height follows the level; amber when below reorder point with no AGV coming, red when empty
      for (const v of Object.values(LSV)) {
        const b = v.b, lvl = E.level(b), k = Math.max(0.02, Math.min(1, lvl / b.cap));
        v.fill.scale.y = k * 0.9; v.fill.position.y = 0.12 + k * 0.45; v.fe.scale.y = v.fill.scale.y; v.fe.position.y = v.fill.position.y;
        const late = lvl <= 0 ? S.bad : (lvl <= b.rop && (!b.mission || !b.mission.agv || (b.mission.agv && b.mission.agv.fault))) ? S.warn : null;
        v.fr.visible = !!late && overlay !== 'energy'; if (late) v.fr.material.color.set(late);
      }
      // warehouse pallets: as many bays filled as the stock allows
      let n = 0;
      for (const k in RMV.byMat) {
        const bays = RMV.byMat[k], b = E.RM[k];
        const filled = Math.round(Math.min(1, b.qty / b.cap) * bays.length);
        for (let i = 0; i < filled; i++) {
          const bay = bays[i];
          mtx.makeTranslation(bay.x, bay.y + 0.065, bay.z); RMV.base.setMatrixAt(n, mtx);
          const h = k === 'panel' ? 1.15 : k === 'reel' ? 0.8 : 1.0;
          mtx.compose(pos.set(bay.x, bay.y + 0.13 + h / 2, bay.z), q.identity(), scl.set(1, h, 1)); RMV.load.setMatrixAt(n, mtx);
          RMV.load.setColorAt(n, RMV.color.set(k === 'carton' ? C.carton : k === 'pcbMain' || k === 'pcbPower' ? C.pcb : k === 'reel' || k === 'display' || k === 'cover' ? C.load2 : C.tray));
          n++;
        }
      }
      RMV.base.count = RMV.load.count = n; RMV.base.instanceMatrix.needsUpdate = RMV.load.instanceMatrix.needsUpdate = true;
      if (RMV.load.instanceColor) RMV.load.instanceColor.needsUpdate = true;
    }
    function updateMovers(dt) {
      for (const a of P.agvs) {
        const v = AGV.get(a.id);
        v.g.position.set(a.x, 0, a.z); v.g.rotation.y = -a.h;
        v.load.visible = v.le.visible = !!a.load;
        if (a.load) v.load.material = MATC[a.load.mat] || M.carton;
        v.fr.visible = !!a.fault; v.fr.material.color.set(S.bad);
      }
      for (const f of P.forklifts) { const v = FL.get(f.id); v.g.position.set(f.x, 0, f.z); v.g.rotation.y = -f.h; }
      for (const tr of P.trucks) {
        let v = TRK.get(tr.id);
        if (!v) { v = { g: truckModel(12) }; TRK.set(tr.id, v); tag(v.g, 'truck:' + tr.id, tr.id); }
        v.g.rotation.y = Math.PI / 2;
        v.g.position.set(tr.dock.x, 0, L.D + 0.9 + 6 + (1 - tr.k) * 30);
      }
      for (const [id, v] of TRK) if (!P.trucks.some(t => t.id === id)) { world.remove(v.g); TRK.delete(id); }
      for (const tr of P.inbound) {
        let v = INB.get(tr.id);
        const show = tr.state === 'unloading';
        if (show && !v) { v = { g: truckModel(12) }; INB.set(tr.id, v); tag(v.g, 'inbound:' + tr.id, tr.id); }
        if (!show && v) { world.remove(v.g); INB.delete(tr.id); continue; }
        if (v) { v.g.rotation.y = 0; const k = Math.min(1, tr.k * 20); v.g.position.set(-0.9 - 6 - (1 - k) * 25, 0, tr.door === 0 ? 14 : 30); }
      }
      for (const v of PEOPLE.values()) {
        const p = v.p;
        v.g.position.set(p.x, 0, p.z);
        if (p.h !== undefined && p.path) v.g.rotation.y = -p.h;
        const walking = !!p.path;
        v.b.position.y = 0.65 + (walking ? Math.abs(Math.sin(tAnim * 9)) * 0.05 : Math.sin(tAnim * 1.3 + p.x) * 0.01);
        v.h.position.y = v.b.position.y + 0.67;
      }
    }

    /* ---------------- flow overlay: chevrons along conveyors and active AGV routes ---------------- */
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
      for (const a of P.agvs) if (a.path) add(a.path.slice(Math.max(0, 0)), 0.06, 1.6, 2.2);
      for (const f of P.forklifts) if (f.path) add(f.path, 0.06, 1.6, 2.2);
      chev.count = i; chev.instanceMatrix.needsUpdate = true;
    }

    /* ---------------- selection ---------------- */
    let selRef = null, follow = false;
    function refInfo(ref) {
      if (!ref) return null;
      const [k, id] = ref.split(/:(.+)/);
      if (k === 'st') { const s = P.byId[id]; return s && { x: s.x, y: 0, z: s.z, w: s.kind === 'burnin' ? 20 : s.w, d: s.kind === 'burnin' ? 18 : s.d, h: s.h, r: Math.max(s.w, s.d) }; }
      if (k === 'agv') { const a = P.agvs.find(a => a.id === id); return a && { x: a.x, y: 0, z: a.z, w: 1.3, d: 1.0, h: 0.8, r: 2, moving: true }; }
      if (k === 'fl') { const f = P.forklifts.find(f => f.id === id); return f && { x: f.x, y: 0, z: f.z, w: 2.2, d: 1.2, h: 2, r: 2.5, moving: true }; }
      if (k === 'person') { const p = P.people.find(p => p.id === id); return p && { x: p.x, y: 0, z: p.z, w: 0.8, d: 0.8, h: 1.6, r: 1.5, moving: true }; }
      if (k === 'truck') { const t = P.trucks.find(t => t.id === id); return t && { x: t.dock.x, y: 0, z: L.D + 7 + (1 - t.k) * 30, w: 3, d: 15, h: 3, r: 8, moving: true }; }
      if (k === 'inbound') { const t = P.inbound.find(t => t.id === id); return t && { x: -7, y: 0, z: t.door === 0 ? 14 : 30, w: 15, d: 3, h: 3, r: 8 }; }
      if (k === 'buf') {
        if (id.startsWith('SM:')) return { x: 73, y: 0, z: id.endsWith('main') ? 10.6 : 19.4, w: 5.6, d: 1.6, h: 2, r: 4 };
        if (id.startsWith('RM:')) { const bays = RMV.byMat[id.slice(3)]; const zs = bays.map(b => b.z); const z0 = Math.min(...zs), z1 = Math.max(...zs); return { x: 13.5, y: 0, z: (z0 + z1) / 2, w: 20, d: z1 - z0 + 2.6, h: 4.4, r: 12 }; }
        const v = LSV[id]; return v && { x: v.g.position.x, y: 0, z: v.g.position.z, w: 1.4, d: 1.2, h: 1, r: 2 };
      }
      if (k === 'util') { const u = P.util.assets.find(u => u.id === id); return u && { x: u.x, y: 0, z: u.z, w: 4.6, d: 2.8, h: 2, r: 4 }; }
      if (k === 'unit') { const u = E.findUnit(id); const p = u && unitPos.get(u); if (p) return { x: p[0], y: p[1], z: p[2], w: 1.6, d: 1.2, h: 0.6, r: 1.8, moving: true }; const loc = u && locOf(u); return loc; }
      if (k === 'pal') { const p = P.pallets.find(p => p.id === id); const at = p && unitPos.get(p); return at && { x: at[0], y: 0, z: at[2], w: 1.6, d: 1.4, h: 1.6, r: 2, moving: true }; }
      if (k === 'zone') { const z = L.ZONES.find(z => z.id === id); return z && { x: (z.x0 + z.x1) / 2, y: 0, z: (z.z0 + z.z1) / 2, w: z.x1 - z.x0, d: z.z1 - z.z0, h: 1, r: Math.max(z.x1 - z.x0, z.z1 - z.z0) * 0.6, zone: z }; }
      if (k === 'order') { const o = P.orders.find(o => o.id === id); if (o && o.truck) return refInfo('truck:' + o.truck.id); return { x: 52, y: 0, z: 70, w: 34, d: 18, h: 1, r: 20 }; }
      return null;
    }
    // where a unit is when it is not drawn individually (in a buffer, an AGV, a pallet)
    function locOf(u) {
      const l = u.loc; if (!l) return null;
      if (l.k === 'sm') return refInfo('buf:SM:' + (u.type === 'main' ? 'main' : 'power'));
      if (l.k === 'ls') return refInfo('buf:' + l.b.id);
      if (l.k === 'agv') return refInfo('agv:' + l.a.id);
      if (l.k === 'pallet') return refInfo('pal:' + l.p.id);
      if (l.k === 'repair') return refInfo('st:' + l.st.id);
      return null;
    }
    function select(ref, opts2 = {}) {
      selRef = ref; follow = !!opts2.follow;
      const info = refInfo(ref);
      reticle.visible = !!info;
      if (info) {
        setReticle(info);
        if (opts2.fly !== false) flyTo(info);
      }
      if (routeLine) { world.remove(routeLine); routeLine = null; }
      emit('select', ref);
    }
    function updateSelection() {
      if (!selRef) return;
      const info = refInfo(selRef);
      if (!info) { reticle.visible = false; return; }
      reticle.visible = true; reticle.position.set(info.x, 0.04, info.z);
      if (Math.abs(info.w - retW) > 0.01 || Math.abs(info.d - retD) > 0.01) setReticle(info);
      // route line for a moving AGV or forklift
      const [k, id] = selRef.split(/:(.+)/);
      const mover = k === 'agv' ? P.agvs.find(a => a.id === id) : k === 'fl' ? P.forklifts.find(f => f.id === id) : null;
      if (routeLine) { world.remove(routeLine); routeLine.geometry.dispose(); routeLine = null; }
      if (mover && mover.path) {
        const pts = [];
        const p = mover.path; for (let i = 1; i < p.length; i++) pts.push([p[i - 1][0], p[i - 1][1]], [p[i][0], p[i][1]]);
        routeLine = lines(world, pts, M.route, 0.05);
      }
      if (follow && info.moving) {
        const d = new T.Vector3(info.x, 0, info.z).sub(controls.target);
        controls.target.add(d.multiplyScalar(0.12)); camera.position.add(d);
      }
    }

    /* ---------------- camera moves ---------------- */
    let fly = null;
    const ease = t => 1 - Math.pow(1 - t, 3);
    function flyTo(info, dist) {
      const r = dist || Math.max(18, (info.r || 4) * 4.2);
      const to = new T.Vector3(info.x, (info.y || 0) * 0.5, info.z);
      const dir = camera.position.clone().sub(controls.target).normalize();
      if (dir.y < 0.5) { dir.y = 0.62; dir.normalize(); }
      if (dir.y > 0.86) { dir.y = 0.78; dir.normalize(); }
      const toPos = to.clone().add(dir.multiplyScalar(r));
      fly = { t: 0, dur: 1.1, p0: camera.position.clone(), t0: controls.target.clone(), p1: toPos, t1: to };
    }
    function view(v) {
      // v: [x, z, distance] from the zone list, or 'overview'
      if (v === 'overview') { fly = { t: 0, dur: 1.3, p0: camera.position.clone(), t0: controls.target.clone(), p1: new T.Vector3(CENTER.x + 22, 84, CENTER.z + 88), t1: CENTER.clone() }; return; }
      const to = new T.Vector3(v[0], 0, v[1]);
      const p1 = to.clone().add(new T.Vector3(v[2] * 0.25, v[2] * 0.72, v[2] * 0.72));
      fly = { t: 0, dur: 1.2, p0: camera.position.clone(), t0: controls.target.clone(), p1, t1: to };
    }
    function stepFly(dt) {
      if (!fly) return;
      fly.t = Math.min(1, fly.t + dt / fly.dur);
      const k = ease(fly.t);
      camera.position.lerpVectors(fly.p0, fly.p1, k); controls.target.lerpVectors(fly.t0, fly.t1, k);
      if (fly.t >= 1) fly = null;
    }
    controls.addEventListener('start', () => { fly = null; if (follow) follow = false; });

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
          const u = o.userData.units[h.instanceId]; if (!u) continue;
          if (u.sn) return { ref: 'unit:' + u.sn, name: `${u.type === 'tv' ? 'TV' : u.type === 'phone' ? 'Phone' : u.type === 'main' ? 'Main board' : 'Power board'} ${u.sn}` };
          if (u.id && u.id.startsWith('PAL')) return { ref: 'pal:' + u.id, name: `Pallet ${u.id}` };
          continue;
        }
        if (o.userData.ref) return { ref: o.userData.ref, name: o.userData.name };
      }
      return null;
    }
    let down = null;
    canvas.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; });
    canvas.addEventListener('pointerup', e => {
      if (!down) return;
      const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
      down = null;
      if (moved > 6) return;
      const h = hit(e.clientX, e.clientY);
      if (h) select(h.ref); else emit('select', null), (selRef = null, reticle.visible = false);
    });
    let hoverT = 0;
    canvas.addEventListener('pointermove', e => {
      if (e.pointerType !== 'mouse') return;
      const now = performance.now(); if (now - hoverT < 50) return; hoverT = now;
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
      for (const L of labels) {
        const p = L.getPos();
        if (!p) { L.el.style.display = 'none'; continue; }
        tmp.set(p[0], p[1], p[2]).project(camera);
        const vis = tmp.z < 1 && tmp.x > -1.1 && tmp.x < 1.1 && tmp.y > -1.1 && tmp.y < 1.1 && (L.tier === 0 || (L.tier === 1 && dist < 170) || (L.tier === 2 && dist < 60) || (typeof L.tier === 'function' && L.tier(dist)));
        if (!vis) { if (L.shown !== false) { L.el.style.display = 'none'; L.shown = false; } continue; }
        if (L.shown !== true) { L.el.style.display = ''; L.shown = true; }
        L.el.style.transform = `translate3d(${((tmp.x + 1) / 2 * w).toFixed(1)}px, ${((1 - tmp.y) / 2 * h).toFixed(1)}px, 0)`;
      }
    }

    /* ---------------- loop ---------------- */
    let W = 0, H = 0;
    function resize() {
      const r = canvas.parentElement.getBoundingClientRect();
      W = Math.max(1, r.width); H = Math.max(1, r.height);
      renderer.setSize(W, H, false); camera.aspect = W / H; camera.updateProjectionMatrix();
    }
    new ResizeObserver(resize).observe(canvas.parentElement); resize();
    let last = performance.now(), running = true, frames = 0;
    function frame(now) {
      if (!running) return;
      const dt = Math.min(0.1, (now - last) / 1000); last = now;
      E.run(dt);
      stepFly(dt);
      updateMachines(dt); updateMovers(dt); drawUnits(); updateFlow(); updateSelection();
      controls.update();
      renderer.render(scene, camera);
      projectLabels(W, H);
      frames++;
      emit('frame', dt);
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
    if (document.fonts) document.fonts.ready.then(() => emit('ready'));

    return {
      THREE: T, scene, camera, controls, renderer,
      on(fn) { listeners.push(fn); },
      select, view, flyTo: info => flyTo(info), refInfo, label,
      setOverlay(m) { overlay = m; emit('overlay', m); },
      get overlay() { return overlay; },
      setTheme(t) { theme = t === 'dark' ? 'dark' : 'light'; applyTheme(); },
      setFollow(v) { follow = v; },
      get follow() { return follow; },
      get selected() { return selRef; },
      unitPos, frames: () => frames,
      stop() { running = false; }
    };
  }

  window.PlantScene = { create };
})();
