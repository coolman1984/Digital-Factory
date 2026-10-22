/* Digital Factory — Plant studio models: the 3D objects of the design layer, built in code, no downloads.
   Each kind is modelled the way it looks on a real floor, with physical materials (clear-coated paint, brushed aluminium,
   rubber, glass that reflects the studio light) and quiet motion so the scene reads as alive: the robot picks and places,
   the belt runs and carries cartons, the stack light breathes, the marker floats over a pulsing ring.
   build(o) returns a THREE.Group whose userData.tick(t, dt) animates it; footprint(o, state) draws the selection and clash
   outline on the floor. Materials and textures are shared and cached; geometry belongs to its object. */
(function () {
  'use strict';
  const T = window.THREE; if (!T) return;
  const PI = Math.PI;

  /* ---------- shared textures ---------- */
  const cv = (w, h, draw, srgb = true) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new T.CanvasTexture(c); if (srgb) t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4; return t; };
  const TX = {};
  const tex = (k, f) => TX[k] || (TX[k] = f());
  // a machine HMI: dark glass with a header, gauges and a trend line
  const hmiTex = () => tex('hmi', () => cv(256, 160, (g, w, h) => {
    const bg = g.createLinearGradient(0, 0, 0, h); bg.addColorStop(0, '#0E1726'); bg.addColorStop(1, '#070B12'); g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.fillStyle = '#2D5BFF'; g.fillRect(0, 0, w, 18); g.fillStyle = '#CFE0FF'; g.font = 'bold 11px Inter, Arial'; g.fillText('EG-01 · CELL', 8, 13);
    for (let i = 0; i < 3; i++) { g.strokeStyle = '#1C2A44'; g.lineWidth = 8; g.beginPath(); g.arc(40 + i * 62, 64, 22, PI * 0.75, PI * 2.25); g.stroke(); g.strokeStyle = ['#3DDC97', '#7FB2FF', '#FFC24D'][i]; g.beginPath(); g.arc(40 + i * 62, 64, 22, PI * 0.75, PI * (0.75 + 1.5 * [0.82, 0.64, 0.4][i])); g.stroke(); }
    g.strokeStyle = '#7FB2FF'; g.lineWidth = 2; g.beginPath(); for (let x = 0; x < 236; x++) g.lineTo(10 + x, 136 - Math.sin(x / 13) * 10 - Math.sin(x / 5) * 3); g.stroke();
    g.fillStyle = '#3DDC97'; g.fillRect(214, 26, 30, 8);
  }));
  // the inside of a machine seen through its door: lit from the top, a spindle and a fixture in silhouette
  const chamberTex = () => tex('chamber', () => cv(256, 192, (g, w, h) => {
    const bg = g.createLinearGradient(0, 0, 0, h); bg.addColorStop(0, '#DCE8F7'); bg.addColorStop(0.35, '#7E93AE'); bg.addColorStop(1, '#1F2A38'); g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,0.9)'; g.fillRect(16, 6, w - 32, 6);
    g.fillStyle = '#2A3442'; g.fillRect(w / 2 - 14, 12, 28, 70); g.fillStyle = '#4A5568'; g.fillRect(w / 2 - 6, 82, 12, 28);
    g.fillStyle = '#3A4658'; g.fillRect(40, 140, w - 80, 16); g.fillStyle = '#566377'; g.fillRect(70, 118, w - 140, 22);
    g.fillStyle = 'rgba(127,178,255,0.8)'; g.fillRect(w / 2 - 2, 110, 4, 8);
  }));
  // the belt: rubber with fine cross ribs, repeats along the conveyor and scrolls
  const beltTex = () => tex('belt', () => { const t = cv(64, 64, (g, w, h) => { g.fillStyle = '#1B1E23'; g.fillRect(0, 0, w, h); for (let x = 0; x < w; x += 8) { g.fillStyle = '#2A2E35'; g.fillRect(x, 0, 3, h); } }); t.wrapS = t.wrapT = T.RepeatWrapping; return t; });
  // safety fence mesh: a fine square grid used as an alpha map
  const fenceTex = () => tex('fence', () => { const t = cv(64, 64, (g, w, h) => { g.fillStyle = '#000'; g.fillRect(0, 0, w, h); g.strokeStyle = '#fff'; g.lineWidth = 3; for (let i = 0; i <= w; i += 16) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, h); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(w, i); g.stroke(); } }, false); t.wrapS = t.wrapT = T.RepeatWrapping; return t; });
  // hazard tape: yellow and black diagonal bands
  const hazardTex = () => tex('hazard', () => { const t = cv(128, 32, (g, w, h) => { g.fillStyle = '#F2B705'; g.fillRect(0, 0, w, h); g.fillStyle = '#16181C'; for (let x = -h; x < w + h; x += 32) { g.beginPath(); g.moveTo(x, h); g.lineTo(x + 16, h); g.lineTo(x + 16 + h, 0); g.lineTo(x + h, 0); g.fill(); } }); t.wrapS = t.wrapT = T.RepeatWrapping; return t; });
  // zone fill: soft diagonal hatching
  const hatchTex = () => tex('hatch', () => { const t = cv(64, 64, (g, w, h) => { g.fillStyle = 'rgba(255,255,255,0.55)'; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(255,255,255,1)'; g.lineWidth = 10; for (let x = -h; x < w + h; x += 32) { g.beginPath(); g.moveTo(x, h); g.lineTo(x + h, 0); g.stroke(); } }, false); t.wrapS = t.wrapT = T.RepeatWrapping; return t; });
  const cartonTex = () => tex('carton', () => cv(128, 128, (g, w, h) => { g.fillStyle = '#C9A37A'; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(0,0,0,0.08)'; for (let i = 0; i < 40; i++) g.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 2, 8 + Math.random() * 20); g.fillStyle = '#B48C62'; g.fillRect(0, h / 2 - 6, w, 12); g.fillStyle = '#2B2F36'; g.font = 'bold 16px Inter, Arial'; g.fillText('EG-01', 10, 30); g.strokeStyle = '#2B2F36'; g.lineWidth = 2; g.strokeRect(84, 82, 30, 30); }));

  /* ---------- shared materials ---------- */
  const MC = new Map();
  function mat(key, make) { if (!MC.has(key)) MC.set(key, make()); return MC.get(key); }
  const paint = c => mat('paint' + c, () => new T.MeshPhysicalMaterial({ color: c, roughness: 0.34, metalness: 0.05, clearcoat: 0.85, clearcoatRoughness: 0.12 }));
  const satin = c => mat('satin' + c, () => new T.MeshPhysicalMaterial({ color: c, roughness: 0.55, metalness: 0.1, clearcoat: 0.3, clearcoatRoughness: 0.4 }));
  const alu = () => mat('alu', () => new T.MeshPhysicalMaterial({ color: 0xC9CFD7, roughness: 0.28, metalness: 0.92 }));
  const steel = () => mat('steel', () => new T.MeshPhysicalMaterial({ color: 0x8C949F, roughness: 0.36, metalness: 0.88 }));
  const dark = () => mat('dark', () => new T.MeshPhysicalMaterial({ color: 0x23272E, roughness: 0.5, metalness: 0.3, clearcoat: 0.4, clearcoatRoughness: 0.3 }));
  const rubber = () => mat('rubber', () => new T.MeshStandardMaterial({ color: 0x1A1D22, roughness: 0.9 }));
  const glass = () => mat('glass', () => new T.MeshPhysicalMaterial({ color: 0xD8E6F5, roughness: 0.04, metalness: 0, ior: 1.5, specularIntensity: 1, transparent: true, opacity: 0.22, envMapIntensity: 2.2, depthWrite: false }));
  const glow = (c, k = 2) => mat('glow' + c + k, () => new T.MeshStandardMaterial({ color: 0x000000, emissive: c, emissiveIntensity: k, roughness: 0.3 }));
  const screen = () => mat('screen', () => new T.MeshStandardMaterial({ color: 0x000000, emissive: 0xffffff, emissiveMap: hmiTex(), emissiveIntensity: 1.3, roughness: 0.15 }));
  const yellow = () => mat('yellow', () => new T.MeshPhysicalMaterial({ color: 0xF2B705, roughness: 0.4, clearcoat: 0.6, clearcoatRoughness: 0.2 }));
  const wood = () => mat('wood', () => new T.MeshStandardMaterial({ color: 0xB98F60, roughness: 0.85 }));
  const carton = () => mat('carton', () => new T.MeshStandardMaterial({ map: cartonTex(), roughness: 0.9 }));
  const wrap = () => mat('wrap', () => new T.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.15, transparent: true, opacity: 0.28, clearcoat: 1, depthWrite: false }));

  /* ---------- geometry helpers (each object owns its geometry) ---------- */
  function rbox(w, h, d, r) { r = Math.max(0, Math.min(r, w / 2 - 0.002, h / 2 - 0.002, d / 2 - 0.002)); return r > 0.004 ? new T.RoundedBoxGeometry(w, h, d, 3, r) : new T.BoxGeometry(w, h, d); }
  function add(g, geo, m, x, y, z, o = {}) { const mesh = new T.Mesh(geo, m); mesh.position.set(x, y, z); if (o.rx) mesh.rotation.x = o.rx; if (o.ry) mesh.rotation.y = o.ry; if (o.rz) mesh.rotation.z = o.rz; mesh.castShadow = o.shadow !== false; mesh.receiveShadow = true; g.add(mesh); return mesh; }
  const box = (g, w, h, d, m, x, y, z, r = 0, o) => add(g, rbox(w, h, d, r), m, x, y + h / 2, z, o);   // y is the bottom
  const cyl = (g, rt, rb, h, m, x, y, z, seg = 24, o) => add(g, new T.CylinderGeometry(rt, rb, h, seg), m, x, y + h / 2, z, o);
  const hash = s => { let h = 2166136261; for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return () => ((h = Math.imul(h ^ (h >>> 15), 2246822507) ^ Math.imul(h ^ (h >>> 13), 3266489909)) >>> 0) / 4294967296; };
  const tint = (c, k) => { const x = new T.Color(c); const hsl = {}; x.getHSL(hsl); x.setHSL(hsl.h, hsl.s, Math.max(0, Math.min(1, hsl.l * k))); return '#' + x.getHexString(); };

  /* ---------- the kinds ---------- */
  const B = {};

  // a machine: plinth, clear-coated housing, a glass door onto a lit chamber, an HMI pod on an arm, a stack light
  B.machine = (g, o) => {
    const { w, d, h } = o, c = o.color, body = paint(c), H = h * 0.8;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) cyl(g, 0.07, 0.09, 0.1, steel(), sx * (w / 2 - 0.25), 0, sz * (d / 2 - 0.25), 12);
    box(g, w - 0.06, 0.16, d - 0.06, dark(), 0, 0.08, 0, 0.04);
    box(g, w - 0.1, H, d - 0.1, body, 0, 0.24, 0, 0.1);
    box(g, w - 0.02, 0.1, d - 0.02, satin(tint(c, 1.18)), 0, 0.24 + H, 0, 0.05);
    // the door: a recessed dark chamber behind glass, lit by a strip in the brand colour
    const dw = Math.min(w * 0.55, w - 0.8), dh = H * 0.62, fz = d / 2 - 0.04;
    box(g, dw + 0.12, dh + 0.12, 0.05, dark(), -w * 0.12, 0.24 + H * 0.2, fz, 0.03);
    add(g, new T.PlaneGeometry(dw, dh), mat('chamber', () => new T.MeshStandardMaterial({ color: 0x000000, emissive: 0xffffff, emissiveMap: chamberTex(), emissiveIntensity: 0.9 })), -w * 0.12, 0.24 + H * 0.2 + 0.06 + dh / 2, fz + 0.028, { shadow: false });
    box(g, dw, dh, 0.03, glass(), -w * 0.12, 0.24 + H * 0.2 + 0.06, fz + 0.03, 0.02, { shadow: false });
    box(g, dw * 0.9, 0.04, 0.02, glow(0x7FB2FF, 2.4), -w * 0.12, 0.24 + H * 0.2 + dh - 0.02, fz + 0.005, 0, { shadow: false });
    box(g, 0.05, dh * 0.6, 0.06, alu(), -w * 0.12 + dw / 2 - 0.12, 0.24 + H * 0.4, fz + 0.06, 0.02);
    // the accent line around the housing
    box(g, w - 0.08, 0.035, d - 0.08, glow(0x2D5BFF, 1.6), 0, 0.24 + H * 0.86, 0, 0, { shadow: false });
    // vents on the side
    for (let i = 0; i < 6; i++) box(g, 0.02, 0.05, d * 0.4, dark(), w / 2 - 0.04, 0.24 + H * 0.35 + i * 0.09, 0, 0, { shadow: false });
    // the HMI pod on its arm, angled toward the operator
    const px = w / 2 - 0.35, pz = d / 2 + 0.25;
    cyl(g, 0.03, 0.03, 0.5, alu(), px, 0.24 + H * 0.55, d / 2 - 0.05, 10, { rx: PI / 2 });
    const pod = new T.Group(); pod.position.set(px, 0.24 + H * 0.62, pz); pod.rotation.x = -0.35; g.add(pod);
    box(pod, 0.62, 0.42, 0.07, dark(), 0, -0.21, 0, 0.03);
    add(pod, new T.PlaneGeometry(0.54, 0.34), screen(), 0, 0, 0.037, { shadow: false });
    // the stack light
    const sx = -w / 2 + 0.3, sz = -d / 2 + 0.3, sy = 0.34 + H;
    cyl(g, 0.025, 0.025, 0.35, alu(), sx, sy, sz, 10);
    const seg = ['#E5383B', '#F2B705', '#0F9D58'].map((col, i) => cyl(g, 0.065, 0.065, 0.11, glow(new T.Color(col).getHex(), i === 2 ? 2.2 : 0.25), sx, sy + 0.35 + (2 - i) * 0.12, sz, 18, { shadow: false }));
    cyl(g, 0.07, 0.07, 0.03, dark(), sx, sy + 0.71, sz, 18);
    const green = seg[2].material = seg[2].material.clone();
    g.userData.tick = t => { green.emissiveIntensity = 1.6 + Math.sin(t * 2.2) * 0.7; };
  };

  // a robot cell: hazard-taped floor, posts and mesh fence, a six-axis arm that picks from a feeder and places on a fixture
  B.robot = (g, o) => {
    const { w, d } = o, c = o.color;
    for (const [len, x, z, ry] of [[w, 0, d / 2, 0], [w, 0, -d / 2, 0], [d, w / 2, 0, PI / 2], [d, -w / 2, 0, PI / 2]]) {
      const t = hazardTex().clone(); t.needsUpdate = true; t.repeat.set(len / 0.5, 1);
      add(g, new T.PlaneGeometry(len, 0.16), new T.MeshStandardMaterial({ map: t, roughness: 0.6 }), x, 0.012, z, { rx: -PI / 2, rz: ry, shadow: false });
    }
    // fence on three sides, open at the front for the operator
    const fm = new T.MeshPhysicalMaterial({ color: 0x2B2F36, metalness: 0.6, roughness: 0.4, alphaMap: fenceTex().clone(), transparent: true, side: T.DoubleSide, depthWrite: false });
    fm.alphaMap.needsUpdate = true; fm.alphaMap.repeat.set(w * 4, 7);
    const FH = 1.9;
    for (const [len, x, z, ry] of [[w, 0, -d / 2, 0], [d, w / 2, 0, PI / 2], [d, -w / 2, 0, PI / 2]]) {
      add(g, new T.PlaneGeometry(len, FH - 0.15), fm, x, 0.1 + FH / 2, z, { ry, shadow: false });
      box(g, len, 0.04, 0.04, yellow(), x, FH, z, 0, { ry });
    }
    for (const [x, z] of [[-w / 2, -d / 2], [w / 2, -d / 2], [-w / 2, d / 2], [w / 2, d / 2], [0, -d / 2]]) box(g, 0.07, FH + 0.04, 0.07, yellow(), x, 0, z, 0.015);
    // the plinth and the arm
    cyl(g, 0.55, 0.6, 0.08, steel(), 0, 0, -0.15, 32);
    const base = new T.Group(); base.position.set(0, 0.08, -0.15); g.add(base);
    cyl(base, 0.32, 0.38, 0.38, paint(c), 0, 0, 0, 32);
    const j1 = new T.Group(); j1.position.y = 0.38; base.add(j1);
    cyl(j1, 0.3, 0.3, 0.16, dark(), 0, 0, 0, 32);
    box(j1, 0.42, 0.36, 0.36, paint(c), 0, 0.12, 0, 0.12);
    const j2 = new T.Group(); j2.position.set(0, 0.36, 0); j1.add(j2);
    cyl(j2, 0.17, 0.17, 0.5, dark(), 0, -0.25, 0, 24, { rx: PI / 2 });
    add(j2, new T.CapsuleGeometry(0.13, 0.75, 6, 18), paint(c), 0, 0.42, 0);
    const j3 = new T.Group(); j3.position.set(0, 0.85, 0); j2.add(j3);
    cyl(j3, 0.13, 0.13, 0.36, dark(), 0, -0.18, 0, 24, { rx: PI / 2 });
    add(j3, new T.CapsuleGeometry(0.095, 0.6, 6, 16), satin(tint(c, 1.15)), 0.36, 0, 0, { rz: -PI / 2 });
    const j4 = new T.Group(); j4.position.set(0.74, 0, 0); j3.add(j4);
    cyl(j4, 0.08, 0.08, 0.12, dark(), 0, -0.06, 0, 18);
    cyl(j4, 0.06, 0.06, 0.16, alu(), 0, -0.2, 0, 18);
    const f1 = box(j4, 0.03, 0.12, 0.05, alu(), -0.05, -0.34, 0), f2 = box(j4, 0.03, 0.12, 0.05, alu(), 0.05, -0.34, 0);
    cyl(j4, 0.012, 0.012, 0.02, glow(0x7FB2FF, 3), 0, -0.25, 0.065, 8, { rx: PI / 2, shadow: false });
    // the feeder and the fixture
    for (const tx of [-0.95, 0.95]) {   // feeder and fixture tables: a brushed top on four legs
      box(g, 0.72, 0.05, 0.52, alu(), tx, 0.7, 0.5, 0.015);
      for (const lx of [-0.31, 0.31]) for (const lz of [-0.21, 0.21]) box(g, 0.04, 0.7, 0.04, satin('#3B4252'), tx + lx, 0, 0.5 + lz, 0.01);
      box(g, 0.64, 0.03, 0.44, satin('#3B4252'), tx, 0.2, 0.5, 0.01);
    }
    const part = box(g, 0.2, 0.12, 0.2, carton(), -0.95, 0.75, 0.5, 0.01); part.position.y = 0.81;
    g.userData.tick = t => {
      const k = (t * 0.32) % 1, s = 0.5 - 0.5 * Math.cos(k * PI * 2);   // a slow pick, swing, place, return
      j1.rotation.y = -2.54 + s * 1.94;   // from the feeder to the fixture
      j2.rotation.z = -0.35 - Math.sin(k * PI * 4) * 0.12;
      j3.rotation.z = -0.95 + Math.sin(k * PI * 4) * 0.18;
      const grip = 0.03 + Math.abs(Math.sin(k * PI * 2)) * 0.03; f1.position.x = -grip; f2.position.x = grip;
      part.position.x = s > 0.5 ? 0.95 : -0.95;
    };
  };

  // a conveyor: aluminium side rails on legs, a running rubber belt with end drums, a drive box, cartons riding on it
  B.conveyor = (g, o) => {
    const { w, d, h } = o, c = o.color, top = h;
    const legs = Math.max(2, Math.round(w / 2.2) + 1);
    for (let i = 0; i < legs; i++) { const x = -w / 2 + 0.3 + i * (w - 0.6) / (legs - 1); for (const sz of [-1, 1]) { box(g, 0.06, top - 0.12, 0.06, alu(), x, 0, sz * (d / 2 - 0.05), 0.01); cyl(g, 0.06, 0.07, 0.04, rubber(), x, 0, sz * (d / 2 - 0.05), 12); } box(g, 0.05, 0.05, d - 0.1, alu(), x, 0.2, 0); }
    for (const sz of [-1, 1]) box(g, w, 0.16, 0.07, alu(), 0, top - 0.16, sz * (d / 2 - 0.035), 0.02);
    const bt = beltTex().clone(); bt.needsUpdate = true; bt.repeat.set(w / 0.5, 1); bt.wrapS = bt.wrapT = T.RepeatWrapping;
    const belt = add(g, new T.BoxGeometry(w - 0.1, 0.04, d - 0.16), new T.MeshStandardMaterial({ map: bt, roughness: 0.8 }), 0, top - 0.04, 0);
    for (const sx of [-1, 1]) cyl(g, 0.09, 0.09, d - 0.16, steel(), sx * (w / 2 - 0.05), top - 0.13, 0, 24, { rx: PI / 2 });
    box(g, 0.55, 0.42, 0.42, paint(c), -w / 2 + 0.6, top - 0.75, d / 2 + 0.2, 0.05);
    cyl(g, 0.02, 0.02, 0.02, glow(0x3DDC97, 3), -w / 2 + 0.45, top - 0.45, d / 2 + 0.42, 10, { rx: PI / 2, shadow: false });
    // guard rails along the top
    for (const sz of [-1, 1]) box(g, w - 0.2, 0.03, 0.03, satin(c), 0, top + 0.08, sz * (d / 2 - 0.02), 0.01);
    const n = Math.max(1, Math.floor(w / 3)), boxes = [];
    for (let i = 0; i < n; i++) boxes.push(box(g, 0.5, 0.36, Math.min(0.5, d - 0.3), carton(), 0, top, 0, 0.015));
    g.userData.tick = t => {
      bt.offset.x = -(t * 0.6) % 1;
      boxes.forEach((b, i) => { b.position.x = -w / 2 + 0.4 + (((t * 0.3) / (w - 0.8) + i / n) % 1) * (w - 0.8); });
    };
  };

  // pallet racking: orange uprights with bracing, blue beams, wire decks, pallets of cartons, column guards
  B.rack = (g, o) => {
    const { w, d, h } = o, c = o.color, rnd = hash(o.id + w + h);
    const bays = Math.max(1, Math.round(w / 2.7)), bw = w / bays, levels = Math.max(2, Math.round(h / 1.3));
    for (let i = 0; i <= bays; i++) {
      const x = -w / 2 + i * bw;
      for (const sz of [-1, 1]) { box(g, 0.09, h, 0.07, paint(c), x, 0, sz * d / 2, 0.01); box(g, 0.22, 0.4, 0.2, yellow(), x, 0, sz * d / 2, 0.03); }
      for (let k = 0; 0.1 + (k + 1) * 1.1 <= h; k++) add(g, new T.BoxGeometry(0.025, Math.hypot(d, 1.1), 0.025), steel(), x, 0.65 + k * 1.1, 0, { rx: (k % 2 ? 1 : -1) * Math.atan2(d, 1.1), shadow: false });
    }
    for (let l = 1; l <= levels; l++) {
      const y = (h - 0.1) * l / levels - 0.08;
      for (const sz of [-1, 1]) box(g, w, 0.12, 0.06, paint('#1E4FD8'), 0, y, sz * (d / 2 - 0.02), 0.01);
      box(g, w - 0.05, 0.02, d - 0.05, steel(), 0, y + 0.1, 0, 0, { shadow: false });
      if (l === levels) continue;
      for (let b = 0; b < bays; b++) for (let p = 0; p < 2; p++) {
        if (rnd() < 0.18) continue;
        const px = -w / 2 + (b + 0.25 + p * 0.5) * bw, py = y + 0.12, ph = 0.55 + rnd() * 0.35;
        box(g, bw * 0.42, 0.13, d * 0.85, wood(), px, py, 0, 0.005);
        box(g, bw * 0.4, ph, d * 0.8, carton(), px, py + 0.13, 0, 0.02);
        box(g, bw * 0.41, ph * 0.98, d * 0.81, wrap(), px, py + 0.13, 0, 0.02, { shadow: false });
      }
    }
  };

  // a partition wall: sandwich panels with a glazed band above, aluminium mullions, a kick plate and a cap
  B.wall = (g, o) => {
    const { w, d, h } = o, c = o.color, panels = Math.max(1, Math.round(w / 1.25)), pw = w / panels, low = h * 0.62;
    box(g, w, 0.14, d + 0.02, dark(), 0, 0, 0, 0.02);
    for (let i = 0; i < panels; i++) box(g, pw - 0.04, low - 0.14, d, satin(c), -w / 2 + pw * (i + 0.5), 0.14, 0, 0.03);
    box(g, w - 0.02, h - low - 0.08, d * 0.3, glass(), 0, low, 0, 0.01, { shadow: false });
    for (let i = 0; i <= panels; i++) box(g, 0.06, h - low, d * 0.7, alu(), -w / 2 + pw * i, low, 0, 0.01);
    box(g, w, 0.07, d + 0.04, alu(), 0, low - 0.035, 0, 0.015);
    box(g, w + 0.04, 0.08, d + 0.06, alu(), 0, h - 0.08, 0, 0.02);
  };

  // an area: hatched tint on the floor, crisp tape on its edges and brighter corner brackets
  B.zone = (g, o) => {
    const { w, d } = o, c = new T.Color(o.color);
    const ht = hatchTex().clone(); ht.needsUpdate = true; ht.repeat.set(w / 1.2, d / 1.2);
    add(g, new T.PlaneGeometry(w, d), new T.MeshBasicMaterial({ color: c, alphaMap: ht, transparent: true, opacity: 0.3, depthWrite: false }), 0, 0.015, 0, { rx: -PI / 2, shadow: false });
    const tape = new T.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.35, roughness: 0.4 });
    for (const [len, x, z, rot] of [[w, 0, -d / 2, 0], [w, 0, d / 2, 0], [d, -w / 2, 0, PI / 2], [d, w / 2, 0, PI / 2]]) add(g, new T.BoxGeometry(len, 0.012, 0.1), tape, x, 0.02, z, { ry: rot, shadow: false });
    const k = Math.min(1.4, Math.min(w, d) * 0.2), cm = glow(c.getHex(), 1.3);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) { add(g, new T.BoxGeometry(k, 0.02, 0.2), cm, sx * (w / 2 - k / 2), 0.03, sz * d / 2, { shadow: false }); add(g, new T.BoxGeometry(0.2, 0.02, k), cm, sx * w / 2, 0.03, sz * (d / 2 - k / 2), { shadow: false }); }
  };

  // a marker: a glossy pin floating over the spot, a beam to the floor, a ring that pulses outward
  B.marker = (g, o) => {
    const c = new T.Color(o.color), h = o.h;
    const pts = []; for (let i = 0; i <= 24; i++) { const a = i / 24; const y = a < 0.55 ? a / 0.55 * 0.9 : 0.9 + Math.sin((a - 0.55) / 0.45 * PI / 2) * 0.55; const r = a < 0.55 ? Math.pow(a / 0.55, 0.8) * 0.42 : Math.cos((a - 0.55) / 0.45 * PI / 2) * 0.42; pts.push(new T.Vector2(Math.max(0.0001, r), y)); }
    const pin = new T.Group(); g.add(pin);
    add(pin, new T.LatheGeometry(pts, 40), paint('#' + c.getHexString()), 0, 0, 0);
    add(pin, new T.SphereGeometry(0.16, 24, 16), mat('pearl', () => new T.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.15, clearcoat: 1, sheen: 1 })), 0, 1.02, 0.36, { shadow: false });
    const beam = add(g, new T.CylinderGeometry(0.02, 0.02, h - 0.5, 8), new T.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.45, depthWrite: false }), 0, (h - 0.5) / 2, 0, { shadow: false });
    const dot = add(g, new T.CircleGeometry(0.35, 40), new T.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.6, depthWrite: false }), 0, 0.02, 0, { rx: -PI / 2, shadow: false });
    const ringM = new T.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.5, depthWrite: false, side: T.DoubleSide });
    const ring = add(g, new T.RingGeometry(0.45, 0.55, 48), ringM, 0, 0.025, 0, { rx: -PI / 2, shadow: false });
    g.userData.tick = t => {
      pin.position.y = h - 1.1 + Math.sin(t * 1.6) * 0.12; pin.rotation.y = t * 0.6;
      const k = (t * 0.6) % 1; ring.scale.setScalar(1 + k * 2.4); ringM.opacity = 0.55 * (1 - k);
      beam.visible = dot.visible = true;
    };
  };

  /* ---------- building, selection and clash outlines ---------- */
  function build(o) {
    const g = new T.Group(); (B[o.kind] || B.machine)(g, o);
    g.userData.kind = o.kind;
    return g;
  }
  // a rounded rectangle on the floor around the footprint; blue when selected, amber when it clashes
  function footprint(w, d, state) {
    const col = state === 'clash' ? 0xF2A007 : state === 'clash-sel' ? 0xFF5A1F : 0x2D5BFF;
    const sh = new T.Shape(), x = -w / 2 - 0.3, z = -d / 2 - 0.3, W = w + 0.6, D = d + 0.6, r = Math.min(0.5, W / 4, D / 4);
    sh.moveTo(x + r, z); sh.lineTo(x + W - r, z); sh.quadraticCurveTo(x + W, z, x + W, z + r); sh.lineTo(x + W, z + D - r); sh.quadraticCurveTo(x + W, z + D, x + W - r, z + D); sh.lineTo(x + r, z + D); sh.quadraticCurveTo(x, z + D, x, z + D - r); sh.lineTo(x, z + r); sh.quadraticCurveTo(x, z, x + r, z);
    const hole = new T.Path(), t = 0.12; hole.moveTo(x + t + r, z + t); hole.lineTo(x + W - t - r, z + t); hole.quadraticCurveTo(x + W - t, z + t, x + W - t, z + t + r); hole.lineTo(x + W - t, z + D - t - r); hole.quadraticCurveTo(x + W - t, z + D - t, x + W - t - r, z + D - t); hole.lineTo(x + t + r, z + D - t); hole.quadraticCurveTo(x + t, z + D - t, x + t, z + D - t - r); hole.lineTo(x + t, z + t + r); hole.quadraticCurveTo(x + t, z + t, x + t + r, z + t);
    sh.holes.push(hole);
    const geo = new T.ShapeGeometry(sh, 6); geo.rotateX(PI / 2);
    const m = new T.Mesh(geo, new T.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.95, depthWrite: false, toneMapped: false, side: T.DoubleSide }));
    m.position.y = 0.035; m.renderOrder = 4; m.raycast = () => {};
    const fill = new T.Mesh(new T.PlaneGeometry(W, D).rotateX(-PI / 2), new T.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.08, depthWrite: false, toneMapped: false }));
    fill.position.y = 0.03; fill.raycast = () => {}; m.add(fill);
    m.userData.tick = tt => { m.material.opacity = 0.7 + Math.sin(tt * 4) * 0.25; };
    return m;
  }
  function dispose(g) { g.traverse(x => { if (x.geometry) x.geometry.dispose(); if (x.material && ![...MC.values()].includes(x.material)) { if (x.material.map && !Object.values(TX).includes(x.material.map)) x.material.map.dispose(); if (x.material.alphaMap && !Object.values(TX).includes(x.material.alphaMap)) x.material.alphaMap.dispose(); x.material.dispose(); } }); }

  window.StudioModels = { build, footprint, dispose };
})();
