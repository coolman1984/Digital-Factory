/* Digital Factory — the 3D view of the Plant EG-01 enterprise twin (three.js, vendored as window.THREE).
   A white architectural model drawn with ink edges. Colour appears only for an abnormal state (ISA-101): amber for slow,
   short-stopped or starved, red for stopped, indigo for planned maintenance. Data travelling between the floor, GMES,
   SAP and the offices is drawn as small packets along arcs. Static buildings and machines are merged into a few meshes;
   everything that moves is instanced. Reads the engine and the enterprise layer; owns none of their state.
   The page calls render(dt) from its own frame loop. */
(function () {
  'use strict';
  const T = window.THREE;

  const PAL = {
    light: {
      bg: 0xE9EDF2, floor: 0xF1F3F6, grid: 0xDCE1E8, grid2: 0xC9D0DA, zone: 0xE5E9EF, zoneLine: 0xAEB7C4, aisle: 0xFFFFFF, aisleLine: 0xB9C2CE,
      body: 0xFFFFFF, body2: 0xEEF1F5, edge: 0x1B2029, edgeOp: 0.38, glass: 0xA9BBCD, dark: 0x2C323C, belt: 0x4A515D, metal: 0xB3BAC4, rack: 0x8C96A4,
      wall: 0xFFFFFF, pcb: 0x2F6B4F, tv: 0x16191F, carton: 0xC9A37A, pallet: 0xB98F60, tray: 0xD8DDE4, person: 0x46546A, skin: 0xC8A58A,
      tech: 0x1565D8, office: 0x6B778A, agv: 0xFFFFFF, stripe: 0x1428A0, truck: 0xFFFFFF, cab: 0x5A6270, mag: 0x6A7382, plastic: 0x2B3038, steel: 0x9EA6B1,
      desk: 0xF7F8FA, carpet: 0xE2E6EC, pkt: 0x1428A0, net: 0x1428A0,
      hemi: [0xFFFFFF, 0xD7DCE3, 1.25], sun: 1.35, amb: 0.25
    },
    dark: {
      bg: 0x0A0B0F, floor: 0x0F1217, grid: 0x171B22, grid2: 0x222833, zone: 0x12161C, zoneLine: 0x3A4352, aisle: 0x161A21, aisleLine: 0x2C3440,
      body: 0x262B35, body2: 0x1E222A, edge: 0xA9B3C4, edgeOp: 0.34, glass: 0x5A6B80, dark: 0x0F1115, belt: 0x353B46, metal: 0x5C6573, rack: 0x6B7585,
      wall: 0x1E222A, pcb: 0x2E7A57, tv: 0x07080A, carton: 0x9E7E5A, pallet: 0x8A6A46, tray: 0x3A414D, person: 0x8C9AB0, skin: 0xC8A58A,
      tech: 0x4DA3FF, office: 0x7A869A, agv: 0xE8EBF0, stripe: 0x2189FF, truck: 0xD9DEE6, cab: 0x3A414D, mag: 0x4A5361, plastic: 0x15181D, steel: 0x6B7380,
      desk: 0x2A2F38, carpet: 0x161A20, pkt: 0x4DA3FF, net: 0x2189FF,
      hemi: [0xC9D3E3, 0x0A0B0F, 0.75], sun: 0.95, amb: 0.2
    }
  };
  const STATUS = {
    light: { ok: 0x0F9D58, warn: 0xE08A00, bad: 0xE5383B, maint: 0x3B4CCA, info: 0x2189FF, off: 0x9AA2AE },
    dark: { ok: 0x34C77B, warn: 0xFFB020, bad: 0xFF5A5F, maint: 0x8C9BFF, info: 0x4DA3FF, off: 0x4A5260 }
  };
  // load colours by material family (neutral, so status colour keeps its meaning)
  const LOADC = { OC: 0x3C4350, BLU: 0xD9DDE3, SMPS: 0x8A94A3, PCB: 0x5B7F6A, CTN: 0xC9A37A, ACC: 0xB8BEC8, RESIN: 0xE8E4DA, EPS: 0xF2F2EE, COIL: 0x9AA3AE, PWD: 0x4A4F57, BRK: 0x7D8590, BC: 0x2B3038, STD: 0x3A3F48, CHS: 0x5C636E, PBA: 0x6A7382, CUS: 0xF4F4F0 };
  // where the systems live in the server room, and the rooms of the office block
  const ROOMS = [
    ['sales', 0, 0], ['planning', 1, 0], ['scm', 2, 0], ['finance', 3, 0], ['hr', 4, 0],
    ['pe', 0, 1], ['bom', 1, 1], ['quality', 2, 1], ['svc', 3, 1], ['it', 4, 1]
  ];
  const RX0 = 208, RW = 10.6;
  const roomBox = (c, r) => ({ x0: RX0 + c * RW, x1: RX0 + (c + 1) * RW, z0: r ? 21 : 3, z1: r ? 36 : 17 });
  const SYSPOS = { 'SAP-SD': [251.4, 27.6], 'SAP-PP': [251.4, 27.6], 'SAP-MM': [251.4, 27.6], 'SAP-QM': [251.4, 27.6], 'SAP-FICO': [251.4, 27.6], 'SAP-PM': [251.4, 27.6], GMES: [255.6, 27.6], WMS: [259.6, 27.6], PLM: [251.4, 33.2] };

  function create(canvas, E, X, opts = {}) {
    const P = E.P;
    const L = P.layout;
    let theme = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
    let C = PAL[theme], S = STATUS[theme];
    const listeners = [];
    const emit = (t, d) => listeners.forEach(f => f(t, d));
    const low = !!opts.lowPower;

    /* ---------------- renderer, camera, controls ---------------- */
    const renderer = new T.WebGLRenderer({ canvas, antialias: !low, powerPreference: 'high-performance', preserveDrawingBuffer: !!opts.capture });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, low ? 1 : 1.75));
    renderer.outputColorSpace = T.SRGBColorSpace;
    renderer.shadowMap.enabled = !low;
    renderer.shadowMap.type = T.PCFSoftShadowMap;
    const scene = new T.Scene();
    const camera = new T.PerspectiveCamera(30, 1, 0.5, 2400);
    const controls = new T.OrbitControls(camera, canvas);
    controls.enableDamping = true; controls.dampingFactor = 0.08;
    controls.maxPolarAngle = 1.36; controls.minDistance = 4; controls.maxDistance = 560;
    controls.screenSpacePanning = false; controls.zoomSpeed = 1.1; controls.rotateSpeed = 0.6;
    const CENTER = new T.Vector3(L.W / 2, 0, L.D / 2 + 4);
    const HOME = new T.Vector3(CENTER.x + 34, 205, CENTER.z + 196);
    controls.target.copy(CENTER); camera.position.copy(HOME);

    const hemi = new T.HemisphereLight(C.hemi[0], C.hemi[1], C.hemi[2]); scene.add(hemi);
    const amb = new T.AmbientLight(0xffffff, C.amb); scene.add(amb);
    const sun = new T.DirectionalLight(0xffffff, C.sun);
    sun.position.set(CENTER.x - 90, 220, CENTER.z - 120); sun.target.position.copy(CENTER);
    sun.castShadow = !low;
    sun.shadow.mapSize.set(4096, 4096);
    Object.assign(sun.shadow.camera, { left: -175, right: 175, top: 120, bottom: -120, near: 20, far: 520 });
    sun.shadow.bias = -0.0008; sun.shadow.normalBias = 0.04;
    scene.add(sun, sun.target);

    /* ---------------- materials (rethemed in place) ---------------- */
    const std = (c, o = {}) => new T.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.88, metalness: 0 }, o));
    const M = {
      floor: std(C.floor, { roughness: 1 }), body: std(C.body), body2: std(C.body2), dark: std(C.dark, { roughness: 0.6 }), belt: std(C.belt, { roughness: 0.7 }),
      metal: std(C.metal, { roughness: 0.5, metalness: 0.3 }), rack: std(C.rack, { roughness: 0.6, metalness: 0.2 }), wall: std(C.wall),
      glass: std(C.glass, { transparent: true, opacity: 0.22, roughness: 0.1, depthWrite: false }),
      pcb: std(C.pcb, { roughness: 0.5 }), tv: std(C.tv, { roughness: 0.35 }), carton: std(C.carton), pallet: std(C.pallet), tray: std(C.tray),
      person: std(0xffffff), skin: std(C.skin), agv: std(C.agv, { roughness: 0.6 }), stripe: std(C.stripe, { roughness: 0.5 }),
      truck: std(C.truck), cab: std(C.cab, { roughness: 0.5 }), mag: std(C.mag), plastic: std(C.plastic, { roughness: 0.45 }), steel: std(C.steel, { roughness: 0.4, metalness: 0.4 }),
      desk: std(C.desk), carpet: new T.MeshStandardMaterial({ color: C.carpet, roughness: 1 }), load: std(0xffffff),
      zone: new T.MeshBasicMaterial({ color: C.zone, side: T.DoubleSide }), aisle: new T.MeshBasicMaterial({ color: C.aisle }),
      edge: new T.LineBasicMaterial({ color: C.edge, transparent: true, opacity: C.edgeOp }),
      grid: new T.LineBasicMaterial({ color: C.grid }), grid2: new T.LineBasicMaterial({ color: C.grid2 }),
      zoneLine: new T.LineBasicMaterial({ color: C.zoneLine, transparent: true, opacity: 0.9 }), aisleLine: new T.LineBasicMaterial({ color: C.aisleLine }),
      wrap: new T.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.3, roughness: 0.2, depthWrite: false }),
      sel: new T.MeshBasicMaterial({ color: S.info, side: T.DoubleSide }), route: new T.LineBasicMaterial({ color: S.info, transparent: true, opacity: 0.9 }),
      lamp: new T.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }), flat: new T.MeshBasicMaterial({ color: 0xffffff, side: T.DoubleSide, transparent: true, opacity: 0.92, depthWrite: false }),
      pkt: new T.MeshBasicMaterial({ color: C.pkt, toneMapped: false }), net: new T.LineBasicMaterial({ color: C.net, transparent: true, opacity: 0.35 }),
      hit: new T.MeshBasicMaterial({ visible: false })
    };
    // TV test pattern for the aging racks and the test stations
    function pattern() {
      const c = document.createElement('canvas'); c.width = 256; c.height = 144;
      const g = c.getContext('2d');
      ['#C0C0C0', '#C0C000', '#00C0C0', '#00C000', '#C000C0', '#C00000', '#0000C0'].forEach((b, i) => { g.fillStyle = b; g.fillRect(i * 256 / 7, 0, 256 / 7 + 1, 104); });
      const grd = g.createLinearGradient(0, 0, 256, 0); grd.addColorStop(0, '#000'); grd.addColorStop(1, '#fff');
      g.fillStyle = grd; g.fillRect(0, 104, 256, 40);
      const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t;
    }
    M.screen = new T.MeshBasicMaterial({ map: pattern(), toneMapped: false });
    M.white = new T.MeshBasicMaterial({ color: 0xEEF2F8, toneMapped: false });

    /* ---------------- static geometry, merged by material ---------------- */
    const BAG = {}, EDG = [];
    const mtx = new T.Matrix4(), q = new T.Quaternion(), eul = new T.Euler(), pos = new T.Vector3(), scl = new T.Vector3(1, 1, 1);
    const place = (g, x, y, z, ry = 0, rx = 0, rz = 0) => { eul.set(rx, ry, rz); q.setFromEuler(eul); mtx.compose(pos.set(x, y, z), q, scl.set(1, 1, 1)); g.applyMatrix4(mtx); return g; };
    const edgeBase = new Map();
    function sbox(key, w, h, d, x, y, z, o = {}) {
      const g = place(new T.BoxGeometry(w, h, d), x, y + h / 2, z, o.ry || 0, o.rx || 0, o.rz || 0);
      (BAG[key] = BAG[key] || []).push(g);
      if (o.edge !== false) {
        const k = `${w}|${h}|${d}`;
        if (!edgeBase.has(k)) edgeBase.set(k, new T.EdgesGeometry(new T.BoxGeometry(w, h, d)));
        EDG.push(place(edgeBase.get(k).clone(), x, y + h / 2, z, o.ry || 0, o.rx || 0, o.rz || 0));
      }
    }
    function scyl(key, r, h, x, y, z, o = {}) {
      const g = new T.CylinderGeometry(r, o.r2 !== undefined ? o.r2 : r, h, o.seg || 16);
      (BAG[key] = BAG[key] || []).push(place(g, x, y + (o.rx || o.rz ? 0 : h / 2), z, 0, o.rx || 0, o.rz || 0));
      if (o.edge) EDG.push(place(new T.EdgesGeometry(new T.CylinderGeometry(r, o.r2 !== undefined ? o.r2 : r, h, o.seg || 16), 40), x, y + (o.rx || o.rz ? 0 : h / 2), z, 0, o.rx || 0, o.rz || 0));
    }
    function splane(key, w, h, x, y, z, ry = 0) { (BAG[key] = BAG[key] || []).push(place(new T.PlaneGeometry(w, h), x, y, z, ry)); }
    const world = new T.Group(); scene.add(world);
    function finalize() {
      for (const key in BAG) {
        const list = BAG[key]; if (!list.length) continue;
        const groups = [];
        for (let i = 0; i < list.length; i += 4000) groups.push(T.mergeGeometries(list.slice(i, i + 4000), false));
        for (const g of groups) {
          const m = new T.Mesh(g, M[key]);
          m.castShadow = !['glass', 'zone', 'aisle', 'screen', 'white', 'carpet', 'floor'].includes(key); m.receiveShadow = key !== 'glass';
          m.raycast = () => {};
          if (key === 'glass') m.renderOrder = 2;
          world.add(m);
        }
        list.forEach(g => g.dispose()); BAG[key] = [];
      }
      if (EDG.length) { const e = new T.LineSegments(T.mergeGeometries(EDG, false), M.edge); e.raycast = () => {}; world.add(e); EDG.forEach(g => g.dispose()); EDG.length = 0; }
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
    // instanced helper: unit geometry, scaled per instance
    function inst(geo, mat, n, o = {}) {
      const m = new T.InstancedMesh(geo, mat, n); m.count = 0; m.frustumCulled = false;
      m.castShadow = !!o.shadow; m.receiveShadow = !!o.receive;
      if (o.color) m.instanceColor = new T.InstancedBufferAttribute(new Float32Array(n * 3), 3);
      m.userData.refs = []; if (o.pick) PICK.push(m); else m.raycast = () => {};
      if (o.order) m.renderOrder = o.order;
      world.add(m); return m;
    }
    const PICK = [];
    const col = new T.Color();
    function put(m, x, y, z, sx = 1, sy = 1, sz = 1, ry = 0, rx = 0, rz = 0, ref, c) {
      const i = m.count; if (i >= m.instanceMatrix.count) return -1;
      eul.set(rx, ry, rz, 'YXZ'); q.setFromEuler(eul); mtx.compose(pos.set(x, y, z), q, scl.set(sx, sy, sz));
      m.setMatrixAt(i, mtx); if (ref !== undefined) m.userData.refs[i] = ref;
      if (c !== undefined && m.instanceColor) m.setColorAt(i, col.set(c));
      m.count = i + 1; return i;
    }
    const done = (...ms) => ms.forEach(m => { m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; });
    const unitBox = new T.BoxGeometry(1, 1, 1);
    const unitBoxB = new T.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);   // grows up from its base

    /* ---------------- floor, grid, zones, aisles, walls ---------------- */
    const floor = new T.Mesh(new T.PlaneGeometry(L.W + 140, L.D + 120), M.floor);
    floor.rotation.x = -Math.PI / 2; floor.position.set(L.W / 2, -0.01, L.D / 2); floor.receiveShadow = true; world.add(floor);
    {
      const minor = [], major = [];
      for (let x = 0; x <= L.W; x += 4) (x % 20 ? minor : major).push([x, 0], [x, L.D]);
      for (let z = 0; z <= L.D; z += 4) (z % 20 ? minor : major).push([0, z], [L.W, z]);
      lines(world, minor, M.grid, 0.004); lines(world, major, M.grid2, 0.006);
    }
    for (const z of L.ZONES) {
      const w = z.x1 - z.x0, d = z.z1 - z.z0;
      splane('zone', w, d, z.x0 + w / 2, 0.008, z.z0 + d / 2);
      BAG.zone[BAG.zone.length - 1].rotateX(0);
      lines(world, [[z.x0, z.z0], [z.x1, z.z0], [z.x1, z.z0], [z.x1, z.z1], [z.x1, z.z1], [z.x0, z.z1], [z.x0, z.z1], [z.x0, z.z0]], M.zoneLine, 0.012);
    }
    // planes are authored upright: lay the zone planes flat
    BAG.zone = BAG.zone.map(g => { const c = new T.Vector3(); g.computeBoundingBox(); g.boundingBox.getCenter(c); g.translate(-c.x, -c.y, -c.z); g.rotateX(-Math.PI / 2); g.translate(c.x, c.y, c.z); return g; });
    {
      const al = [];
      for (const A of L.AISLES) {
        const h = A.a[1] === A.b[1];
        const len = h ? Math.abs(A.b[0] - A.a[0]) + 2.4 : Math.abs(A.b[1] - A.a[1]) + 2.4;
        const cx = (A.a[0] + A.b[0]) / 2, cz = (A.a[1] + A.b[1]) / 2;
        const g = new T.PlaneGeometry(h ? len : 2.4, h ? 2.4 : len); g.rotateX(-Math.PI / 2); g.translate(cx, 0.014, cz); (BAG.aisle = BAG.aisle || []).push(g);
        if (h) al.push([cx - len / 2, cz - 1.2], [cx + len / 2, cz - 1.2], [cx - len / 2, cz + 1.2], [cx + len / 2, cz + 1.2]);
        else al.push([cx - 1.2, cz - len / 2], [cx - 1.2, cz + len / 2], [cx + 1.2, cz - len / 2], [cx + 1.2, cz + len / 2]);
      }
      lines(world, al, M.aisleLine, 0.018);
    }
    // perimeter wall, cut away to 1.4 m, with the receiving doors (west, north) and the shipping docks (east)
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
      for (let x = 24; x < L.W; x += 24) for (const z of [0.3, L.D - 0.3]) sbox('metal', 0.5, 3.2, 0.5, x, 0, z);
      for (const d of P.docks) { sbox('metal', 1.4, 1.1, 3.6, L.W + 0.8, 0, d.z); sbox('dark', 0.2, 3.4, 3.8, L.W + 0.05, 0, d.z - 2.05, { edge: false }); }
      for (const d of L.INDOCK) if (d.side === 'w') sbox('metal', 1.4, 1.1, 3.6, -0.8, 0, d.z); else sbox('metal', 3.6, 1.1, 1.4, d.x, 0, -0.8);
    }

    /* ---------------- machines ---------------- */
    const ANIM = { gantry: [], arm: [], platen: [], ram: [] };
    const SV = new Map();     // station id → view record
    const topOf = s => ({ robot: 2.4, bench: 1.6, subassy: 1.6, repair: 1.6, blu: 1.6, aging: 3.1, oven: 3.0, press: 4.4, injection: 2.6, cushion: 3.4 }[s.kind] || s.h);
    function buildStation(s) {
      const W = s.w, D = s.d, H = s.h, X0 = s.x, Z0 = s.z;
      const b = (k, w, h, d, x, y, z, o) => sbox(k, w, h, d, X0 + x, y, Z0 + z, o);
      const c = (k, r, h, x, y, z, o) => scyl(k, r, h, X0 + x, y, Z0 + z, o);
      const posts = (w, d, h, y = 0) => { for (const [px, pz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) b('metal', 0.06, h, 0.06, px * (w / 2 - 0.05), y, pz * (d / 2 - 0.05), { edge: false }); };
      const table = (w, d, top = 0.86) => { b('body', w, 0.06, d, 0, top, 0); posts(w, d, top); };
      switch (s.kind) {
        case 'loader': case 'unloader': b('body', W, H * 0.6, D, 0, 0, 0); b('mag', W * 0.8, H * 0.38, D * 0.7, 0, H * 0.6, 0); break;
        case 'printer': b('body', W, H * 0.72, D, 0, 0, 0); b('glass', W * 0.96, H * 0.26, D * 0.94, 0, H * 0.72, 0, { edge: false }); ANIM.gantry.push({ s, y: H * 0.72 + 0.05, len: D * 0.8, amp: W * 0.36, rate: 1.6 }); break;
        case 'spi': case 'aoi': b('body', W, H * 0.74, D, 0, 0, 0); b('glass', W * 0.9, H * 0.18, D * 0.9, 0, H * 0.74, 0, { edge: false }); c('dark', 0.14, 0.2, 0, H * 0.92, 0); break;
        case 'mounter': b('body', W, H * 0.55, D, 0, 0, 0); b('glass', W, H * 0.4, D, 0, H * 0.55, 0, { edge: false }); for (const sz of [-1, 1]) b('body2', W * 0.86, H * 0.36, 0.3, 0, H * 0.18, sz * (D / 2 + 0.15)); ANIM.gantry.push({ s, y: H * 0.86, len: D * 0.86, amp: W * 0.3, rate: 2.1 }); break;
        case 'reflow':
          b('body', W * 0.84, H * 0.8, D, 0, 0, 0); b('body2', W * 0.08, H * 0.55, D * 0.75, -W * 0.46, 0, 0); b('body2', W * 0.08, H * 0.55, D * 0.75, W * 0.46, 0, 0);
          for (let i = 0; i < 8; i++) b('dark', W * 0.07, 0.04, D * 0.55, -W * 0.36 + i * W * 0.103, H * 0.8, 0, { edge: false });
          break;
        case 'writer': b('body', W, H * 0.55, D, 0, 0, 0); for (let i = 0; i < 4; i++) b('dark', W * 0.18, 0.12, D * 0.5, -W * 0.33 + i * W * 0.22, H * 0.55, 0); b('dark', 0.5, 0.36, 0.05, W * 0.25, H * 0.75, -D / 2 + 0.1); break;
        case 'ict': b('body', W, H * 0.5, D, 0, 0, 0); posts(W * 0.9, D * 0.8, 0.9, H * 0.5); b('dark', W * 0.8, 0.16, D * 0.7, 0, H * 0.5 + 0.9, 0); break;
        case 'lcmload': b('body', W, 0.8, D, 0, 0, 0); b('rack', 1.2, 1.7, D * 0.9, -W / 2 + 0.6, 0, 0); ANIM.arm.push({ s, x: X0 + 0.4, y: 0.8, z: Z0, k: 1.1, rate: 0.8 }); break;
        case 'blu': case 'bench': case 'subassy': case 'repair':
          table(W, D); b('body2', W * 0.92, 0.04, 0.32, 0, 1.55, -D / 2 + 0.2); for (const px of [-1, 1]) b('metal', 0.04, 0.7, 0.04, px * W * 0.45, 0.88, -D / 2 + 0.2, { edge: false });
          b('dark', 0.42, 0.28, 0.03, W * 0.3, 0.98, -D / 2 + 0.3);
          break;
        case 'bond': b('body', W, H * 0.55, D, 0, 0, 0); b('glass', W, H * 0.4, D, 0, H * 0.55, 0, { edge: false }); ANIM.gantry.push({ s, y: H * 0.86, len: D * 0.8, amp: W * 0.28, rate: 1.2 }); break;
        case 'lighting': b('body', W, 0.9, D, 0, 0, 0); b('dark', W, H - 0.9, D * 0.9, 0, 0.9, 0); splane('white', W * 0.6, 0.5, X0, 1.35, Z0 - D * 0.45 - 0.01, Math.PI); break;
        case 'robot': b('body2', W, 0.8, D, 0, 0, 0); posts(W, D, 1.6, 0.8); ANIM.arm.push({ s, x: X0 - W * 0.15, y: 0.8, z: Z0, k: 1, rate: 0.9 }); break;
        case 'fct': b('body', W, H * 0.48, D, 0, 0, 0); b('dark', W * 0.9, H * 0.5, 0.12, 0, H * 0.48, -D * 0.3); splane('screen', W * 0.78, H * 0.38, X0, H * 0.73, Z0 - D * 0.3 + 0.07); break;
        case 'aging':
          // a three-tier aging rack: TVs stand powered on both faces for twenty minutes
          for (let i = 0; i <= 10; i++) for (const pz of [-1, 1]) b('metal', 0.07, 3.0, 0.07, -W / 2 + i * W / 10, 0, pz * (D / 2 - 0.05), { edge: false });
          for (const y of [0.3, 1.25, 2.2]) b('body2', W, 0.05, D, 0, y, 0);
          b('body', W, 0.12, D, 0, 3.0, 0);
          break;
        case 'wb': b('body', W, 0.9, D, 0, 0, 0); b('dark', W, H - 0.9, D * 0.9, 0, 0.9, 0); b('metal', 0.08, 0.9, 0.08, 0, H, 0); break;
        case 'qa': b('dark', W, H, 0.12, 0, 0, -D / 2); b('dark', W, 0.12, D, 0, H, 0); b('body', W * 0.7, 0.85, D * 0.6, 0, 0, 0); break;
        case 'packer': b('body', W, H * 0.6, D, 0, 0, 0); b('glass', W, H * 0.4, D, 0, H * 0.6, 0, { edge: false }); for (let i = 0; i < 3; i++) b('carton', 1.5, 0.12, 0.9, -W / 2 - 0.9, i * 0.13, D * 0.2); break;
        case 'palletizer': b('body2', W, 0.12, D, 0, 0, 0); posts(W, D, 2.2, 0.12); b('body', 0.8, 0.9, 0.8, 0, 0, 0); ANIM.arm.push({ s, x: X0, y: 0.9, z: Z0, k: 1.5, rate: 0.7 }); break;
        case 'injection':
          b('body', W, 0.9, D, 0, 0, 0);
          b('body', W * 0.36, 1.5, D * 0.92, -W * 0.27, 0.9, 0);                    // clamp unit
          for (const pz of [-0.32, 0.32]) for (const py of [1.25, 2.05]) c('steel', 0.05, W * 0.36, -W * 0.27, py, pz * D, { rz: Math.PI / 2 });
          c('steel', 0.18, W * 0.42, W * 0.18, 1.45, 0, { rz: Math.PI / 2 });     // barrel
          c('body2', 0.34, 0.6, W * 0.16, 1.6, 0, { r2: 0.12 }); c('body2', 0.34, 0.25, W * 0.16, 2.2, 0); // hopper
          b('glass', W * 0.38, 1.4, 0.04, -W * 0.27, 0.95, D / 2 + 0.05, { edge: false });
          b('rack', 0.9, 0.9, 0.9, -W * 0.27, 0, D / 2 + 0.75);                     // parts bin
          ANIM.platen.push({ s, x: X0 - W * 0.27, y: 1.0, z: Z0, w: 0.22, h: 1.3, d: D * 0.82, amp: W * 0.1 });
          ANIM.arm.push({ s, x: X0 - W * 0.27, y: 2.4, z: Z0 + 0.2, k: 0.7, rate: 1.1 });
          break;
        case 'press':
          b('body', W, 0.6, D, 0, 0, 0);
          for (const px of [-1, 1]) b('body', 0.55, 3.0, D * 0.9, px * (W / 2 - 0.3), 0.6, 0);
          b('body', W, 0.9, D * 0.9, 0, 3.6, 0);
          b('steel', 1.4, 0.3, 1.4, -W / 2 - 1.2, 0, 0); c('steel', 0.65, 0.9, -W / 2 - 1.2, 0.95, 0, { rx: Math.PI / 2 });  // coil uncoiler
          ANIM.ram.push({ s, x: X0, y: 1.1, z: Z0, w: W - 1.3, h: 0.5, d: D * 0.8, amp: 0.9 });
          break;
        case 'oven': {
          // the coating tunnel: an insulated box with exhaust stacks; parts hang from a chain that runs through it
          b('body', W, 2.2, D, 0, 0.4, 0); for (let i = 0; i < 4; i++) c('metal', 0.22, 1.3, -W * 0.35 + i * W * 0.23, 2.6, 0);
          for (let i = 0; i <= 8; i++) b('metal', 0.06, 0.4, 0.06, -W / 2 + i * W / 8, 0, 0, { edge: false });
          b('steel', W + 6, 0.06, 0.08, 0, 2.75, 0, { edge: false });
          for (const px of [-W / 2 - 3, W / 2 + 3]) b('metal', 0.08, 2.75, 0.08, px, 0, 0, { edge: false });
          break;
        }
        case 'cushion':
          b('body', W, 1.2, D, 0, 0, 0); b('body', W * 0.5, 1.6, D * 0.9, -W * 0.2, 1.2, 0); c('body2', 0.45, 1.0, W * 0.32, 1.2, 0, { r2: 0.2 });
          b('glass', W * 0.5, 1.2, 0.04, -W * 0.2, 1.3, D / 2, { edge: false });
          ANIM.platen.push({ s, x: X0 - W * 0.2, y: 1.4, z: Z0, w: 0.2, h: 1.1, d: D * 0.8, amp: 0.35 });
          break;
        default: b('body', W, H, D, 0, 0, 0);
      }
      const v = { s, top: topOf(s) };
      SV.set(s.id, v);
    }
    P.stations.forEach(buildStation);
    // clean booths around the LCM lines (panels are bonded in clean air)
    for (const Lc of Object.values(P.lines).filter(l => l.kind === 'lcm')) {
      const a = Lc.stations[0], z = a.z;
      sbox('glass', 40, 2.6, 4.2, 77, 0, z, { edge: false });
      for (const [x, d] of [[57, 4.2], [97, 4.2]]) sbox('metal', 0.08, 2.6, d, x, 0, z, { edge: false });
      sbox('metal', 40, 0.08, 0.08, 77, 2.6, z - 2.1, { edge: false }); sbox('metal', 40, 0.08, 0.08, 77, 2.6, z + 2.1, { edge: false });
    }

    /* ---------------- conveyors (one for every pair of stations, the LCM ones over a bridge) ---------------- */
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
          const g = new T.BoxGeometry(len, 0.07, w); g.rotateZ(pitch); g.rotateY(-ang); g.translate(mx, my - 0.1, mz); (BAG.belt = BAG.belt || []).push(g);
          for (let k = 0; k <= Math.floor(len / 2.4); k++) {
            const t = Math.min(1, (k * 2.4 + 0.4) / len);
            const yy = y0 + (y1 - y0) * t;
            sbox('metal', 0.06, yy - 0.12, w * 0.9, x0 + (x1 - x0) * t, 0, z0 + (z1 - z0) * t, { edge: false, ry: -ang });
          }
        }
      }
    }

    /* ---------------- stores, supermarkets, silos, line-side stock ---------------- */
    const BV = {};        // buffer id → view record (for fill and selection)
    const fam = code => (code || '').split('-')[0];
    const loadsI = inst(unitBoxB, M.load, 2600, { color: true, shadow: true });
    const palletsI = inst(unitBox, M.pallet, 1200, { shadow: true });
    function rackBlock(id, x, z, lenX, depZ, levels, bays, deep, kind) {
      // a pallet rack: uprights, beams and bays; kind 'pallet' | 'bin' | 'mag' | 'floor'
      const lh = kind === 'pallet' ? 1.45 : 0.62;
      if (kind !== 'floor') {
        for (let i = 0; i <= bays; i++) for (const pz of [-1, 1]) sbox('rack', 0.08, levels * lh + 0.3, 0.08, x - lenX / 2 + i * lenX / bays, 0, z + pz * (depZ / 2 - 0.04), { edge: false });
        for (let l = 0; l < levels; l++) for (const pz of [-1, 1]) sbox('rack', lenX, 0.09, 0.09, x, 0.1 + l * lh, z + pz * (depZ / 2 - 0.05), { edge: false });
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
    // silos with a level gauge (the inner fill is drawn each frame)
    const SILOV = {};
    for (const [id, x, z, r, h] of [['SILO:RESIN', 26.4, 43.6, 1.7, 7.2], ['SILO:EPS', 152, 130.6, 1.8, 6.2]]) {
      scyl('glass', r, h, x, 1.2, z, { seg: 24 });
      scyl('body', r, 0.6, x, 1.2 + h, z, { r2: 0.3, seg: 24, edge: true });
      scyl('body', r, 1.2, x, 0, z, { r2: 0.35, seg: 24, edge: true });
      for (const [px, pz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) sbox('metal', 0.12, 1.4, 0.12, x + px * r * 0.7, 0, z + pz * r * 0.7, { edge: false });
      const fill = new T.Mesh(new T.CylinderGeometry(r * 0.94, r * 0.94, 1, 24).translate(0, 0.5, 0), M.body2); fill.position.set(x, 1.22, z); fill.castShadow = true; fill.raycast = () => {}; world.add(fill);
      SILOV[id] = { fill, h, x, z, r };
      BV[id] = { id, x, z, w: r * 2, d: r * 2, h: h + 2, slots: [], kind: 'silo' };
    }
    // EPS beads are blown to the cushion machines through an overhead pipe
    {
      const y = 5.4, xs = 186.8;
      sbox('steel', 0.24, 0.24, 130.6 - 48 + 0.24, 152, y, (130.6 + 48) / 2, { edge: false });
      sbox('steel', xs - 152, 0.24, 0.24, (152 + xs) / 2, y, 48, { edge: false });
      sbox('steel', 0.24, 0.24, 118 - 48, xs, y, (118 + 48) / 2, { edge: false });
      for (const z of L.LINE_Z) { sbox('steel', 0.16, y - 3.4, 0.16, xs, 3.4, z + 3.6, { edge: false }); }
      for (let z = 52; z < 130; z += 12) sbox('metal', 0.1, y, 0.1, 152.4, 0, z, { edge: false });
    }
    // line-side flow racks next to every station that consumes material
    for (const b of Object.values(E.LS)) {
      if (b.feed === 'conveyor') { BV[b.id] = { id: b.id, x: POS[b.id][0], z: POS[b.id][1], w: 1.4, d: 1.0, h: 1, slots: [], kind: 'conv' }; continue; }
      const [x, z] = POS[b.id];
      sbox('rack', 1.5, 0.1, 1.0, x, 0.0, z, { edge: false }); for (const [px, pz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) sbox('rack', 0.05, 1.3, 0.05, x + px * 0.72, 0, z + pz * 0.47, { edge: false });
      BV[b.id] = { id: b.id, x, z, w: 1.6, d: 1.1, h: 1.3, slots: [], kind: 'ls' };
    }
    // work-in-process between press, oven and sub-assembly
    for (let k = 1; k <= 6; k++) {
      const z = L.PRESS_Z[k - 1];
      BV[`WIP:PR${k}:stamped`] = { id: `WIP:PR${k}:stamped`, x: 14.9, z, w: 1.4, d: 1.2, h: 1.2, slots: [], kind: 'wip' };
      BV[`WIP:PR${k}:coated`] = { id: `WIP:PR${k}:coated`, x: 57.2, z, w: 1.4, d: 1.2, h: 1.2, slots: [], kind: 'wip' };
      for (const x of [14.9, 57.2]) sbox('pallet', 1.3, 0.14, 1.1, x, 0, z, { edge: false });
    }
    // finished-goods bays and dock lanes
    {
      const pts = [];
      for (const s of P.fgSlots) { const x = s.x, z = s.z; pts.push([x - 1.1, z - 0.7], [x + 1.1, z - 0.7], [x + 1.1, z - 0.7], [x + 1.1, z + 0.7], [x + 1.1, z + 0.7], [x - 1.1, z + 0.7], [x - 1.1, z + 0.7], [x - 1.1, z - 0.7]); }
      lines(world, pts, M.zoneLine, 0.02);
    }
    // parking: AGV chargers, milk-run bays, forklift bays
    for (const k in L.STOPS) {
      const sp = L.STOPS[k];
      if (k.startsWith('PARK-A')) sbox('body2', 0.5, 0.9, 0.3, sp.x, 0, sp.z + 1.1);
      else if (k.startsWith('PARK-T') || k.startsWith('PARK-F') || k.startsWith('PARK-W')) lines(world, [[sp.x - 1.3, sp.z - 1], [sp.x + 1.3, sp.z - 1], [sp.x - 1.3, sp.z + 1], [sp.x + 1.3, sp.z + 1]], M.zoneLine, 0.02);
    }

    /* ---------------- utilities, maintenance shop, offices ---------------- */
    for (const u of P.util.assets) {
      const x = u.x, z = u.z;
      if (u.kind === 'transformer') { sbox('body', 3.0, 2.2, 2.0, x, 0, z); for (let i = 0; i < 7; i++) sbox('metal', 0.05, 1.8, 2.3, x - 1.2 + i * 0.4, 0.2, z, { edge: false }); }
      else if (u.kind === 'compressor') { sbox('body', 3.2, 1.7, 1.7, x, 0, z); scyl('body2', 0.45, 2.4, x, 2.2, z, { rz: Math.PI / 2, edge: true }); }
      else if (u.kind === 'chiller') { sbox('body', 5.0, 2.0, 2.6, x, 0, z); for (let i = 0; i < 3; i++) scyl('dark', 0.6, 0.12, x - 1.6 + i * 1.6, 2.0, z, { edge: true }); }
      else if (u.kind === 'boiler') { scyl('body', 1.2, 4.2, x, 0, z, { rz: 0, seg: 24, edge: true }); scyl('metal', 0.2, 5.5, x + 1.6, 0, z); sbox('body2', 2.2, 1.2, 1.6, x - 2, 0, z); }
      BV['util:' + u.id] = { id: u.id, x, z, w: 5, d: 3, h: 2.5, slots: [], kind: 'util' };
    }
    // maintenance shop and spare-parts cage beside the technicians' home
    { sbox('body', 4, 0.9, 1.4, 160, 0, 150.5); sbox('body', 4, 0.9, 1.4, 165, 0, 150.5); sbox('rack', 6, 2.2, 1, 162.5, 0, 153); sbox('glass', 12, 2.4, 0.05, 162, 0, 155, { edge: false }); }
    // QA lab and SVC packing benches are part of the office and SVC zones; the office block:
    const ROOMV = {};
    {
      const y0 = 0.05;
      sbox('carpet', 54.4, 0.05, 34, 234.6, 0, 19.5, { edge: false });
      for (const [c, r] of ROOMS.map(r => [r[1], r[2]])) {
        const B = roomBox(c, r), w = B.x1 - B.x0, d = B.z1 - B.z0, cx = (B.x0 + B.x1) / 2, cz = (B.z0 + B.z1) / 2;
        // low solid wall plus glass to 3 m
        for (const [ax, az, lw, ld] of [[cx, B.z0, w, 0.15], [cx, B.z1, w, 0.15], [B.x0, cz, 0.15, d], [B.x1, cz, 0.15, d]]) {
          const door = (az === B.z1 && !r) || (az === B.z0 && r);
          if (door) { sbox('wall', lw / 2 - 0.9, 1.0, ld, ax - lw / 4 - 0.45, y0, az); sbox('wall', lw / 2 - 0.9, 1.0, ld, ax + lw / 4 + 0.45, y0, az); }
          else sbox('wall', lw, 1.0, ld, ax, y0, az);
          sbox('glass', lw, 2.0, ld * 0.4, ax, 1.05, az, { edge: false });
        }
      }
      // furniture: desk clusters with monitors; a meeting table in Planning; benches in Quality; racks in IT
      const desk = (x, z, ry = 0) => { sbox('desk', 1.5, 0.05, 0.8, x, 0.73, z, { ry }); sbox('metal', 1.4, 0.7, 0.05, x, 0.03, z, { ry, edge: false }); sbox('dark', 0.6, 0.38, 0.04, x, 0.85, z - 0.25, { ry }); };
      for (const [id, c, r] of ROOMS) {
        const B = roomBox(c, r), cx = (B.x0 + B.x1) / 2, cz = (B.z0 + B.z1) / 2;
        const seats = [];
        if (id === 'it') {
          for (let i = 0; i < 3; i++) sbox('dark', 0.8, 2.2, 1.1, [251.4, 255.6, 259.6][i], 0.05, 27.6);
          sbox('dark', 0.8, 2.2, 1.1, 251.4, 0.05, 33.2);
          for (let i = 0; i < 2; i++) { desk(B.x0 + 2.2, B.z0 + 3 + i * 3.4); seats.push([B.x0 + 2.2, B.z0 + 3.6 + i * 3.4]); }
        } else if (id === 'planning') {
          sbox('desk', 6.2, 0.06, 2.2, cx, 0.74, cz + 1, {}); sbox('metal', 5.8, 0.72, 0.1, cx, 0.03, cz + 1, { edge: false });
          sbox('dark', 4.2, 1.6, 0.08, cx, 1.1, B.z0 + 0.4); splane('white', 3.9, 1.3, cx, 1.9, B.z0 + 0.45);
          for (let i = 0; i < 5; i++) for (const s2 of [-1, 1]) seats.push([cx - 2.4 + i * 1.2, cz + 1 + s2 * 1.6]);
        } else if (id === 'quality') {
          for (let i = 0; i < 3; i++) { sbox('body', 3.2, 0.9, 1.0, B.x0 + 2.4 + i * 0, 0.05, B.z0 + 2.4 + i * 3.6); seats.push([B.x0 + 2.4, B.z0 + 3.4 + i * 3.6]); }
          sbox('metal', 0.1, 0.9, 0.1, B.x1 - 3, 0.05, cz); sbox('tv', 1.4, 0.82, 0.05, B.x1 - 3, 0.95, cz); splane('screen', 1.32, 0.74, B.x1 - 3, 1.36, cz + 0.03);
          for (let i = 0; i < 2; i++) { desk(B.x1 - 3 + (i ? 0 : -2.5), B.z1 - 2.2); seats.push([B.x1 - 3 + (i ? 0 : -2.5), B.z1 - 1.6]); }
        } else {
          for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) { const x = B.x0 + 2.2 + i * 3.1, z = B.z0 + 4 + j * (B.z1 - B.z0 - 7); desk(x, z); seats.push([x, z + 0.6]); }
          sbox('dark', 2.6, 1.3, 0.06, cx, 1.0, r ? B.z1 - 0.3 : B.z0 + 0.3);
        }
        ROOMV[id] = { id, x: cx, z: cz, w: B.x1 - B.x0, d: B.z1 - B.z0, seats, B };
        BV['dept:' + id] = { id: 'dept:' + id, x: cx, z: cz, w: B.x1 - B.x0, d: B.z1 - B.z0, h: 3, slots: [], kind: 'room' };
      }
    }
    // service-parts warehouse: packing bench and a parcel dock
    { sbox('body', 3.2, 0.9, 1.2, 252, 0, 160); sbox('carton', 0.6, 0.4, 0.5, 251.5, 0.9, 160); }
    finalize();

    /* ---------------- dynamic machine parts (instanced) ---------------- */
    const andonI = inst(new T.CylinderGeometry(0.11, 0.11, 0.16, 12), M.lamp, P.stations.length, { color: true });
    const poleI = inst(new T.CylinderGeometry(0.025, 0.025, 1, 6).translate(0, 0.5, 0), M.metal, P.stations.length);
    const stripI = inst(new T.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), M.flat, P.stations.length * 4 + 400, { color: true, order: 3 });
    const tileI = inst(new T.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), M.flat, P.stations.length + 80, { color: true, order: 2 });
    const beamI = inst(unitBox, M.dark, ANIM.gantry.length * 2);
    const colI = inst(new T.CylinderGeometry(0.12, 0.16, 1, 10).translate(0, 0.5, 0), M.body, ANIM.arm.length, { shadow: true });
    const boomI = inst(new T.BoxGeometry(1, 0.14, 0.16).translate(0.5, 0, 0), M.body, ANIM.arm.length * 2, { shadow: true });
    const platenI = inst(unitBox, M.steel, ANIM.platen.length + ANIM.ram.length, { shadow: true });
    const hangI = inst(new T.BoxGeometry(0.06, 0.9, 0.7).translate(0, -0.45, 0), M.plastic, 700);
    const hitI = inst(unitBox, M.hit, P.stations.length + 400, { pick: true });

    /* ---------------- units and pallets (instanced) ---------------- */
    const U = {
      board: inst(new T.BoxGeometry(0.3, 0.02, 0.22), M.pcb, 900, { pick: true }),
      carrier: inst(unitBox, M.tray, 420, { pick: true }),
      panel: inst(unitBox, M.tv, 900, { pick: true, shadow: true }),
      screen: inst(new T.PlaneGeometry(1, 1), M.screen, 420),
      carton: inst(unitBox, M.carton, 300, { pick: true, shadow: true }),
      palBase: inst(unitBox, M.pallet, 420, { pick: true, shadow: true }),
      palLoad: inst(unitBoxB, M.carton, 420, { pick: true, shadow: true }),
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
          // standing in the rack, screens on: ten bays, three tiers, both faces
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
        const y = s.kind === 'reflow' ? 0.86 : s.kind === 'bench' || s.kind === 'blu' || s.kind === 'repair' ? 0.92 : s.kind === 'robot' || s.kind === 'lcmload' ? 0.82 : Math.min(0.95, s.h * 0.5);
        s.procs.forEach((pr, i) => {
          let x = s.x;
          if (s.kind === 'reflow') { const tot = s.base * s.slots; x = s.x - s.w * 0.42 + s.w * 0.84 * (1 - Math.max(0, pr.left) / tot); }
          else if (s.slots > 1) x += (i - (s.procs.length - 1) / 2) * (s.w / (s.slots + 1));
          if (pr.u) drawUnit(pr.u, x, y, s.z, s.kind !== 'bench' && s.kind !== 'blu');
        });
      }
      // pallets wherever they are: building, pick-up, on a fork, in finished goods
      for (const p of P.pallets) {
        if (p.where === 'truck') continue;
        let x = p.x, z = p.z, y = 0, yaw = 0;
        if (p.where === 'fork') { const f = P.forklifts.find(f2 => f2.load === p); if (f) { x = f.x + Math.cos(f.h) * 1.3; z = f.z + Math.sin(f.h) * 1.3; y = 0.25; yaw = -f.h; } }
        else if (p.where === 'fg' && p.slot) { x = p.slot.x; z = p.slot.z; }
        const m = modelOf(p.model), per = 2, layers = Math.ceil(p.units.length / per), h = layers * (m.h + 0.16) * 0.5 + 0.02;
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
      // parts: [mat, geometry] in local coordinates → a group with one mesh per material
      const g = new T.Group(), by = {};
      for (const [mat, geo] of parts) (by[mat] = by[mat] || []).push(geo);
      for (const k in by) { const m = new T.Mesh(T.mergeGeometries(by[k], false), M[k]); m.castShadow = true; m.receiveShadow = true; g.add(m); }
      world.add(g); return g;
    }
    const gb = (w, h, d, x, y, z) => new T.BoxGeometry(w, h, d).translate(x, y + h / 2, z);
    const gc = (r, h, x, y, z, rx = 0) => { const c2 = new T.CylinderGeometry(r, r, h, 14); if (rx) c2.rotateX(rx); return c2.translate(x, y, z); };
    const VEH = new Map();
    const tagV = (g, ref) => g.traverse(o => { if (o.isMesh) { o.userData.ref = ref; PICK.push(o); } });
    for (const a of P.agvs) {
      const g = model([['agv', gb(1.1, 0.32, 0.72, 0, 0.06, 0)], ['stripe', gb(1.12, 0.06, 0.74, 0, 0.22, 0)], ['dark', gc(0.08, 0.08, 0.42, 0.42, 0)]]);
      const load = new T.Mesh(new T.BoxGeometry(0.9, 0.5, 0.6).translate(0, 0.63, 0), M.mag); load.castShadow = true; g.add(load);
      tagV(g, 'agv:' + a.id); VEH.set(a.id, { g, load, v: a });
    }
    for (const t of P.tuggers) {
      const g = model([['cab', gb(1.5, 0.9, 0.95, 0, 0.15, 0)], ['dark', gb(0.5, 0.6, 0.6, -0.3, 1.05, 0)], ['metal', gb(0.06, 1.3, 0.9, 0.55, 1.05, 0)], ['dark', gc(0.2, 0.15, -0.5, 0.2, 0.42, Math.PI / 2)], ['dark', gc(0.2, 0.15, -0.5, 0.2, -0.42, Math.PI / 2)], ['dark', gc(0.2, 0.15, 0.5, 0.2, 0.42, Math.PI / 2)], ['dark', gc(0.2, 0.15, 0.5, 0.2, -0.42, Math.PI / 2)]]);
      tagV(g, 'tug:' + t.id);
      const carts = [];
      for (let i = 0; i < 3; i++) {
        const cg = model([['metal', gb(1.9, 0.05, 0.95, 0, 0.35, 0)], ['metal', gb(1.9, 0.05, 0.95, 0, 0.95, 0)], ['rack', gb(0.05, 1.0, 0.05, -0.92, 0.25, -0.45)], ['rack', gb(0.05, 1.0, 0.05, 0.92, 0.25, 0.45)], ['rack', gb(0.05, 1.0, 0.05, 0.92, 0.25, -0.45)], ['rack', gb(0.05, 1.0, 0.05, -0.92, 0.25, 0.45)], ['dark', gc(0.14, 0.1, -0.6, 0.14, 0.45, Math.PI / 2)], ['dark', gc(0.14, 0.1, 0.6, 0.14, -0.45, Math.PI / 2)]]);
        const ld = new T.Mesh(new T.BoxGeometry(1.7, 0.5, 0.8).translate(0, 0.4 + 0.25, 0), M.carton); ld.castShadow = true; cg.add(ld);
        tagV(cg, 'tug:' + t.id); carts.push({ g: cg, ld });
      }
      VEH.set(t.id, { g, carts, v: t, trail: [] });
    }
    for (const f of P.forklifts) {
      const parts = [['cab', gb(1.3, 1.0, 0.95, -0.2, 0.15, 0)], ['metal', gb(0.9, 0.06, 0.95, -0.2, 2.1, 0)], ['dark', gb(1.2, 0.05, 0.12, 1.1, 0.12, -0.25)], ['dark', gb(1.2, 0.05, 0.12, 1.1, 0.12, 0.25)]];
      for (const pz of [-0.42, 0.42]) parts.push(['metal', gb(0.05, 1.95, 0.05, -0.62, 0.15, pz)], ['dark', gb(0.05, 2.4, 0.07, 0.5, 0, pz * 0.8)]);
      for (const [px, pz] of [[-0.6, -0.45], [-0.6, 0.45], [0.3, -0.45], [0.3, 0.45]]) parts.push(['dark', gc(0.17, 0.12, px, 0.17, pz, Math.PI / 2)]);
      const g = model(parts);
      const load = new T.Mesh(new T.BoxGeometry(1.0, 0.9, 1.0).translate(1.1, 0.62, 0), M.load); load.castShadow = true; g.add(load);
      tagV(g, 'fl:' + f.id); VEH.set(f.id, { g, load, v: f });
    }
    function truckModel(len, ref) {
      const parts = [['truck', gb(len, 2.7, 2.5, 0, 1.0, 0)], ['cab', gb(2.3, 2.4, 2.4, len / 2 + 1.35, 0.55, 0)], ['glass', gb(0.05, 0.9, 2.2, len / 2 + 2.5, 1.9, 0)]];
      for (const px of [-len / 2 + 1.2, -len / 2 + 2.6, len / 2 + 1.0]) for (const pz of [-1.05, 1.05]) parts.push(['dark', gc(0.48, 0.3, px, 0.48, pz, Math.PI / 2)]);
      const g = model(parts); tagV(g, ref); return g;
    }
    const TRK = new Map(), INB = new Map();

    /* ---------------- people (instanced) ---------------- */
    const bodyI = inst(new T.CapsuleGeometry(0.21, 0.78, 4, 10), M.person, 900, { color: true, pick: true, shadow: true });
    const headI = inst(new T.SphereGeometry(0.13, 12, 8), M.skin, 900, { shadow: true });
    const OFFICE = [];
    {
      let k = 0;
      for (const d of X.DEPTS) {
        const r = ROOMV[d.id]; if (!r) continue;
        const n = Math.min(r.seats.length, Math.max(2, Math.round(d.staff / 3)));
        for (let i = 0; i < n; i++) OFFICE.push({ id: 'O' + (++k), dept: d.id, x: r.seats[i][0], z: r.seats[i][1], seated: true });
      }
    }

    /* ---------------- data packets between the floor, GMES, SAP and the offices ---------------- */
    const pktI = inst(new T.SphereGeometry(0.4, 6, 4), M.pkt, 900, { order: 4 });
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
      const d = Math.hypot(b2[0] - a[0], b2[2] - a[2]), peak = Math.max(a[1], b2[1]) + 3 + d * 0.07;
      return t => [a[0] + (b2[0] - a[0]) * t, a[1] + (b2[1] - a[1]) * t + 4 * (peak - Math.max(a[1], b2[1])) * t * (1 - t) + (Math.max(a[1], b2[1]) - a[1]) * 0, a[2] + (b2[2] - a[2]) * t];
    }
    function packet(m) {
      if (packets.length > 160) return;
      if (overlay !== 'data' && (++pktSkip % 2)) return;
      const hops = [];
      const src = posOfRef(m.ref) || (m.line && P.lines[m.line] ? (() => { const s = P.lines[m.line].stations[0]; return [s.x, 2.5, s.z]; })() : null);
      const f = sysPos(m.from), t = sysPos(m.to);
      if (src && (m.from === 'GMES' || m.from === 'WMS' || m.from === 'PLM' && m.to === 'GMES')) {
        if (m.from === 'PLM' && m.to === 'GMES') { hops.push(arc(f, t), arc(t, src)); }
        else { hops.push(arc(src, f)); if (f[0] !== t[0] || f[2] !== t[2]) hops.push(arc(f, t)); }
      } else {
        hops.push(arc(f, t));
        if (src && (m.to === 'GMES' || m.to === 'WMS')) hops.push(arc(t, src));
      }
      packets.push({ hops, t: 0, dur: 1.4 + hops.length * 0.7 });
    }
    E.on((type, d) => { if (type === 'msg') packet(d); });
    // the GMES network: backbone from the server room to every hall (shown with the Data overlay)
    const netLines = (() => {
      const pts = [], hub = [255.6, 27.6];
      for (const z of L.ZONES) { if (z.id === 'office') continue; const cx = (z.x0 + z.x1) / 2, cz = (z.z0 + z.z1) / 2; pts.push([hub[0], hub[1], 6], [hub[0], cz, 6], [hub[0], cz, 6], [cx, cz, 6], [cx, cz, 6], [cx, cz, 0.1]); }
      const l = lines(world, pts, M.net, 6); l.visible = false; return l;
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
      const m = new T.InstancedMesh(g, new T.MeshBasicMaterial({ color: S.info, transparent: true, opacity: 0.9, side: T.DoubleSide, depthWrite: false }), 2400);
      m.count = 0; m.frustumCulled = false; m.renderOrder = 3; m.raycast = () => {}; world.add(m); return m;
    })();

    /* ---------------- theme ---------------- */
    function applyTheme() {
      C = PAL[theme]; S = STATUS[theme];
      scene.background = new T.Color(C.bg);
      hemi.color.set(C.hemi[0]); hemi.groundColor.set(C.hemi[1]); hemi.intensity = C.hemi[2]; sun.intensity = C.sun; amb.intensity = C.amb;
      for (const k of ['floor', 'body', 'body2', 'dark', 'belt', 'metal', 'rack', 'wall', 'glass', 'pcb', 'tv', 'carton', 'pallet', 'tray', 'agv', 'stripe', 'truck', 'cab', 'mag', 'plastic', 'steel', 'desk', 'carpet', 'zone', 'aisle', 'grid', 'grid2', 'zoneLine', 'aisleLine']) M[k].color.set(C[k]);
      M.edge.color.set(C.edge); M.sel.color.set(S.info); M.route.color.set(S.info); chev.material.color.set(S.info); M.pkt.color.set(C.pkt); M.net.color.set(C.net);
      M.skin.color.set(C.skin);
    }
    applyTheme();

    /* ---------------- per-frame view ---------------- */
    let overlay = 'status';
    const STATE_C = st => (st === 'down' ? S.bad : st === 'maint' ? S.maint : st === 'micro' || st === 'warn' || st === 'starved' || st === 'changeover' ? S.warn : null);
    const LAMP = st => (st === 'run' ? S.ok : st === 'down' ? S.bad : st === 'maint' ? S.maint : st === 'warn' || st === 'micro' || st === 'starved' || st === 'changeover' ? S.warn : S.off);
    function ramp(k) { const a = new T.Color(C.body2), b2 = new T.Color(theme === 'dark' ? 0x2189FF : 0x1428A0); return a.lerp(b2, Math.max(0, Math.min(1, k))).getHex(); }
    function frameAround(x, z, w, d, c, t = 0.22) {
      put(stripI, x, 0.035, z - d / 2, w + t, 1, t, 0, 0, 0, undefined, c); put(stripI, x, 0.035, z + d / 2, w + t, 1, t, 0, 0, 0, undefined, c);
      put(stripI, x - w / 2, 0.035, z, t, 1, d, 0, 0, 0, undefined, c); put(stripI, x + w / 2, 0.035, z, t, 1, d, 0, 0, 0, undefined, c);
    }
    let tAnim = 0;
    const KWMAX = { injection: 60, oven: 95, reflow: 46, press: 40, cushion: 32 };
    function updateMachines(dt) {
      tAnim += dt;
      andonI.count = poleI.count = stripI.count = tileI.count = hitI.count = 0;
      for (const s of P.stations) {
        const v = SV.get(s.id), st = s.state;
        const ax = s.x + s.w / 2 - 0.2, az = s.z - s.d / 2 + 0.2;
        put(poleI, ax, v.top, az, 1, 0.5, 1);
        put(andonI, ax, v.top + 0.58, az, 1, 1, 1, 0, 0, 0, undefined, LAMP(st));
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
      // animations: only machines that are running move
      beamI.count = colI.count = boomI.count = platenI.count = 0;
      const on = s => s.state === 'run' || s.state === 'warn';
      for (const a of ANIM.gantry) {
        const s = a.s, t = on(a.s) ? tAnim * a.rate * (s.state === 'warn' ? 0.6 : 1) : 0;
        const bx = s.x + Math.sin(t + s.x) * a.amp;
        put(beamI, bx, a.y, s.z, 0.12, 0.08, a.len); put(beamI, bx, a.y - 0.14, s.z + Math.sin(t * 2.4 + s.z) * a.len * 0.38, 0.22, 0.2, 0.2);
      }
      for (const a of ANIM.arm) {
        const s = a.s, t = on(s) ? tAnim * a.rate + s.x * 0.37 : s.x * 0.37;
        const yaw = Math.sin(t) * 1.3, h = 0.95 * a.k, pitch = -0.35 + Math.sin(t * 1.4) * 0.25;
        put(colI, a.x, a.y, a.z, a.k, h, a.k, yaw);
        eul.set(0, yaw, pitch, 'YZX'); q.setFromEuler(eul); mtx.compose(pos.set(a.x, a.y + h, a.z), q, scl.set(0.75 * a.k, a.k, a.k)); boomI.setMatrixAt(boomI.count++, mtx);
        const ex = a.x + Math.cos(yaw) * Math.cos(pitch) * 0.75 * a.k, ez = a.z - Math.sin(yaw) * Math.cos(pitch) * 0.75 * a.k, ey = a.y + h + Math.sin(pitch) * 0.75 * a.k;
        eul.set(0, yaw, -0.9 + Math.sin(t * 1.7) * 0.35, 'YZX'); q.setFromEuler(eul); mtx.compose(pos.set(ex, ey, ez), q, scl.set(0.6 * a.k, a.k, a.k)); boomI.setMatrixAt(boomI.count++, mtx);
      }
      for (const a of ANIM.platen) { const t = on(a.s) ? tAnim * (a.s.kind === 'injection' ? 0.9 : 0.6) + a.s.z : a.s.z; put(platenI, a.x + (0.5 + 0.5 * Math.sin(t)) * a.amp, a.y + a.h / 2, a.z, a.w, a.h, a.d); }
      for (const a of ANIM.ram) { const t = on(a.s) ? tAnim * 1.8 + a.s.z : 1.6; put(platenI, a.x, a.y + (0.5 + 0.5 * Math.cos(t)) * a.amp + a.h / 2, a.z, a.w, a.h, a.d); }
      // chassis parts hanging from the oven chain
      hangI.count = 0;
      for (const s of P.stations) if (s.kind === 'oven') {
        const tot = s.base * s.slots;
        for (const pr of s.procs) { const k = 1 - Math.max(0, pr.left) / tot; put(hangI, s.x - s.w / 2 + s.w * k, 2.7, s.z, 1, 1, 1); }
      }
      done(andonI, poleI, stripI, tileI, hitI, beamI, colI, boomI, platenI, hangI);
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
          const h = Math.max(0.03, k * (v.kind === 'wip' ? 1.0 : 0.95));
          if (lvl > 0) put(loadsI, v.x, v.kind === 'conv' ? 0 : 0.12, v.z, v.kind === 'conv' ? 1.2 : 1.3, h, 0.85, 0, 0, 0, undefined, lc(b.code));
          // a starved line-side rack is outlined: amber below the reorder point, red when empty
          if (v.kind === 'ls' && overlay !== 'energy') { const late = lvl <= 0 ? S.bad : lvl <= b.rop * 0.5 && !b.pending ? S.warn : null; if (late) frameAround(v.x, v.z, 1.8, 1.3, late, 0.14); }
        } else if (v.kind === 'silo') {
          const sv = SILOV[id]; sv.fill.scale.y = Math.max(0.02, k * sv.h);
        }
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
      // outbound trucks back onto the east docks; inbound containers and vendor trucks at the west and north doors
      for (const tr of P.trucks) {
        let v = TRK.get(tr.id);
        if (!v) { v = { g: truckModel(12, 'truck:' + tr.id) }; TRK.set(tr.id, v); }
        v.g.rotation.y = 0; v.g.position.set(L.W + 0.6 + 6 + (1 - tr.k) * 34, 0, tr.dock.z);
      }
      for (const [id, v] of TRK) if (!P.trucks.some(t => t.id === id)) { world.remove(v.g); TRK.delete(id); }
      for (const tr of P.inbound) {
        let v = INB.get(tr.id);
        const show = tr.state === 'unloading';
        if (show && !v) { v = { g: truckModel(tr.area === 'IMP' ? 12 : 8, 'inbound:' + tr.id), t: 0 }; INB.set(tr.id, v); }
        if (!show && v) { world.remove(v.g); INB.delete(tr.id); continue; }
        if (!v) continue;
        const k = Math.min(1, tr.k * 14), d = tr.dock, len = tr.area === 'IMP' ? 12 : 8;
        if (d.side === 'w') { v.g.rotation.y = Math.PI; v.g.position.set(-0.6 - len / 2 - (1 - k) * 28, 0, d.z); }
        else { v.g.rotation.y = Math.PI / 2; v.g.position.set(d.x, 0, -0.6 - len / 2 - (1 - k) * 28); }
      }
      for (const [id, v] of INB) if (!P.inbound.some(t => t.id === id)) { world.remove(v.g); INB.delete(id); }
      // people: floor crews, technicians, drivers; office staff at their desks
      bodyI.count = headI.count = 0;
      const tint = { Operator: C.person, 'Line leader': C.dark, Technician: C.tech, 'Rework technician': C.person, 'Milk-run driver': C.cab, 'Forklift driver': C.cab };
      for (const p of P.people) {
        if (p.present === false) continue;
        const walking = !!p.path, ride = p.rides;
        const y = ride ? (ride.kind === 'forklift' ? 0.95 : 0.75) : 0;
        const bob = walking ? Math.abs(Math.sin(tAnim * 9 + p.x)) * 0.05 : Math.sin(tAnim * 1.3 + p.x) * 0.01;
        const tc = overlay === 'people' && p.cover ? S.warn : tint[p.role] || C.person;
        put(bodyI, p.x, y + 0.6 + bob, p.z, 1, ride ? 0.7 : 1, 1, 0, 0, 0, 'person:' + p.id, tc);
        put(headI, p.x, y + (ride ? 1.1 : 1.32) + bob, p.z);
      }
      for (const o of OFFICE) {
        put(bodyI, o.x, 0.5, o.z, 1, 0.82, 1, 0, 0, 0, 'dept:' + o.dept, C.office);
        put(headI, o.x, 1.18 + Math.sin(tAnim * 0.8 + o.x) * 0.01, o.z);
      }
      done(bodyI, headI);
    }
    function updatePackets(dt) {
      pktI.count = 0;
      for (let i = packets.length - 1; i >= 0; i--) {
        const p = packets[i]; p.t += dt / p.dur;
        if (p.t >= 1) { packets.splice(i, 1); continue; }
        const n = p.hops.length;
        for (let tr = 0; tr < (overlay === 'data' ? 4 : 2); tr++) {
          const tt = p.t - tr * 0.018; if (tt < 0) continue;
          const h = Math.min(n - 1, Math.floor(tt * n)), lt = tt * n - h;
          const pt = p.hops[h](lt);
          const sc = (overlay === 'data' ? 1.25 : 0.9) * (1 - tr * 0.22);
          put(pktI, pt[0], pt[1], pt[2], sc, sc, sc, tAnim * 2);
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
      if (info) { setReticle(info); if (o2.fly !== false) flyTo(info); }
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
      if (follow && info.moving) { const d = new T.Vector3(info.x, 0, info.z).sub(controls.target); controls.target.add(d.multiplyScalar(0.12)); camera.position.add(d); }
    }

    /* ---------------- camera moves ---------------- */
    let fly = null;
    const ease = t => 1 - Math.pow(1 - t, 3);
    function flyTo(info, dist) {
      const r = dist || Math.max(16, (info.r || 4) * 3.6);
      const to = new T.Vector3(info.x, (info.y || 0) * 0.5, info.z);
      const dir = camera.position.clone().sub(controls.target).normalize();
      if (dir.y < 0.5) { dir.y = 0.62; dir.normalize(); }
      if (dir.y > 0.86) { dir.y = 0.78; dir.normalize(); }
      fly = { t: 0, dur: 1.1, p0: camera.position.clone(), t0: controls.target.clone(), p1: to.clone().add(dir.multiplyScalar(r)), t1: to };
    }
    function view(v) {
      if (v === 'overview') { fly = { t: 0, dur: 1.3, p0: camera.position.clone(), t0: controls.target.clone(), p1: HOME.clone(), t1: CENTER.clone() }; return; }
      const to = new T.Vector3(v[0], 0, v[1]);
      fly = { t: 0, dur: 1.2, p0: camera.position.clone(), t0: controls.target.clone(), p1: to.clone().add(new T.Vector3(v[2] * 0.22, v[2] * 0.74, v[2] * 0.7)), t1: to };
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
    const NAME = ref => {
      const [k, id] = ref.split(/:(.+)/);
      if (k === 'st') { const s = P.byId[id]; return s ? `${s.name}${P.lines[s.line] && s.line !== 'INJ' ? ' · ' + P.lines[s.line].name : ''}` : id; }
      if (k === 'buf') { const b = P.bufs[id]; return b ? (b.label || b.code) + (id.startsWith('LS:') ? ` · ${P.byId[b.station] ? P.byId[b.station].name : ''}` : '') : id; }
      if (k === 'dept') { const d = X.DEPTS.find(d2 => d2.id === id); return d ? d.name : id; }
      if (k === 'unit') { const u = E.findUnit(id); return u ? `${u.type === 'tv' ? 'TV' : u.type === 'lcm' ? 'Panel module' : 'Main board'} ${u.sn}` : id; }
      if (k === 'pal') return 'Pallet ' + id;
      if (k === 'person') { const p = P.people.find(p2 => p2.id === id); return p ? `${p.name} · ${p.role}` : id; }
      if (k === 'util') { const u = P.util.assets.find(u2 => u2.id === id); return u ? u.name : id; }
      if (k === 'tug') return id;
      return id;
    };
    function hit(cx, cy) {
      const r = canvas.getBoundingClientRect();
      ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      const hits = ray.intersectObjects(PICK, false);
      for (const h of hits) {
        const o = h.object;
        const ref = o.isInstancedMesh ? o.userData.refs[h.instanceId] : o.userData.ref;
        if (!ref) continue;
        return { ref, name: NAME(ref) };
      }
      return null;
    }
    let down = null;
    canvas.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY }; });
    canvas.addEventListener('pointerup', e => {
      if (!down) return;
      const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y); down = null;
      if (moved > 6) return;
      const h = hit(e.clientX, e.clientY);
      if (h) select(h.ref); else { selRef = null; reticle.visible = false; emit('select', null); }
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
        const tierOk = p && (Lb.tier === 0 ? dist > 120 : Lb.tier === 1 ? dist < 260 : Lb.tier === 2 ? dist < 70 : typeof Lb.tier === 'function' ? Lb.tier(dist) : true);
        if (tierOk) tmp.set(p[0], p[1], p[2]).project(camera);
        const vis = tierOk && tmp.z < 1 && tmp.x > -1.05 && tmp.x < 1.05 && tmp.y > -1.05 && tmp.y < 1.05;
        if (!vis) { if (Lb.shown !== false) { Lb.el.style.display = 'none'; Lb.shown = false; } continue; }
        if (Lb.shown !== true) { Lb.el.style.display = ''; Lb.shown = true; }
        Lb.el.style.transform = `translate3d(${((tmp.x + 1) / 2 * w).toFixed(1)}px, ${((1 - tmp.y) / 2 * h).toFixed(1)}px, 0)`;
      }
    }

    /* ---------------- render ---------------- */
    let Wd = 0, Ht = 0, frames = 0, acc = 0;
    function resize() {
      const r = canvas.parentElement.getBoundingClientRect();
      Wd = Math.max(1, r.width); Ht = Math.max(1, r.height);
      renderer.setSize(Wd, Ht, false); camera.aspect = Wd / Ht; camera.updateProjectionMatrix();
    }
    new ResizeObserver(resize).observe(canvas.parentElement); resize();
    function render(dt) {
      stepFly(dt);
      acc += dt;
      updateMachines(dt);
      // stock levels change slowly: redraw them five times a second
      if (acc > 0.2 || frames < 2) { acc = 0; updateStock(); } else { /* keep the strips from line-side racks */ }
      updateMovers(); drawUnits(); updateFlow(); updatePackets(dt); updateSelection();
      const dist = camera.position.distanceTo(controls.target);
      M.edge.opacity = C.edgeOp * Math.max(0.25, Math.min(1, 1.5 - dist / 260));
      controls.update();
      renderer.render(scene, camera);
      projectLabels(Wd, Ht);
      frames++;
    }

    return {
      THREE: T, scene, camera, controls, renderer, ROOMV, BV,
      on(fn) { listeners.push(fn); },
      render, resize, select, view, flyTo: info => flyTo(info), refInfo, label, posOfRef, sysPos,
      setOverlay(m) { overlay = m; emit('overlay', m); },
      get overlay() { return overlay; },
      setTheme(t) { theme = t === 'dark' ? 'dark' : 'light'; applyTheme(); },
      setFollow(v) { follow = v; },
      get follow() { return follow; },
      get selected() { return selRef; },
      unitPos, frames: () => frames
    };
  }

  window.PlantScene = { create };
})();
