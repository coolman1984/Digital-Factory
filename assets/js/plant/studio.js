/* Digital Factory — Plant studio: design layout changes in the live 3D plant by talking to it, the way Spline for ChatGPT
   lets a chat build and edit a live 3D scene. A design layer sits on top of the twin (areas, machines, racks, conveyors,
   robot cells, walls, markers). Three ways to change it, on the same objects:
   - talk: a local assistant understands simple commands in Arabic and English with no key; with the viewer's own Anthropic
     key, Claude edits the layer through tools (read the scene, find free floor space, add, change, remove, look at). Like
     the Spline agent, it re-reads the scene before every change, so it builds on what a person changed by hand.
   - by hand: select an object, drag it on the floor, nudge it with the arrow keys, turn it with R, delete it, or edit its
     size, label and colour in the panel.
   - as a file: the layer is saved in this browser, and can be exported and imported as JSON.
   Every change is checked against the machines, the racks and the aisles of the plant; a clash is reported, never hidden.
   Undo and redo cover everything. The design layer never changes the simulation. Keys: D opens the studio. */
(function () {
  'use strict';
  const PL = window.Plant; if (!PL || !PL.V || !PL.V.studio) return;
  const S = PL.V.studio, T = S.T, E = PL.E, P = E.P, L = P.layout;
  const $ = s => document.querySelector(s);
  const ar = () => document.documentElement.lang === 'ar';
  const TT = (en, a) => (ar() ? a : en);
  const tr = s => (ar() && window.DFI18N && DFI18N.t(s)) || s;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const r1 = v => Math.round(v * 10) / 10, snap = v => Math.round(v * 2) / 2;
  const MODEL = 'claude-opus-5-5', SDK = 'assets/vendor/anthropic/anthropic.iife.min.js', KEY = 'df-claude-key', SAVE = 'df-studio';

  /* ---------- what can be placed ---------- */
  const KINDS = {
    zone: { w: 12, d: 8, h: 0.04, color: '#2D5BFF', en: 'Area', ar: 'منطقة' },
    machine: { w: 4, d: 3, h: 2.2, color: '#7C8698', en: 'Machine', ar: 'ماكينة' },
    rack: { w: 10, d: 1.4, h: 4, color: '#E08A00', en: 'Rack', ar: 'رف' },
    conveyor: { w: 14, d: 1, h: 0.9, color: '#4B5567', en: 'Conveyor', ar: 'سير ناقل' },
    robot: { w: 3, d: 3, h: 2.6, color: '#0B7A43', en: 'Robot cell', ar: 'خلية روبوت' },
    wall: { w: 10, d: 0.3, h: 3, color: '#B9C0CC', en: 'Wall', ar: 'حائط' },
    marker: { w: 1.2, d: 1.2, h: 4, color: '#C42B2E', en: 'Marker', ar: 'علامة' }
  };
  const ZONES = L.ZONES;
  const zoneName = z => tr(z.name);

  /* ---------- the design layer ---------- */
  let objs = [], seq = 0, sel = null;
  const undoS = [], redoS = [];
  const group = new T.Group(); group.name = 'studio'; S.world.add(group);
  const labelsEl = $('#labels');
  const lbs = new Map();   // id → label element
  function load() { try { const d = JSON.parse(localStorage.getItem(SAVE) || 'null'); if (d && Array.isArray(d.objs)) { objs = d.objs.filter(o => KINDS[o.kind]); seq = d.seq || objs.length; } } catch (e) { /* nothing saved */ } }
  function save() { try { localStorage.setItem(SAVE, JSON.stringify({ objs, seq })); } catch (e) { /* storage unavailable */ } }
  const snapshot = () => JSON.stringify({ objs, seq });
  function commit(before) { undoS.push(before); if (undoS.length > 80) undoS.shift(); redoS.length = 0; save(); draw(); paint(); }
  function undo() { if (!undoS.length) return false; redoS.push(snapshot()); const d = JSON.parse(undoS.pop()); objs = d.objs; seq = d.seq; if (sel && !get(sel)) sel = null; save(); draw(); paint(); return true; }
  function redo() { if (!redoS.length) return false; undoS.push(snapshot()); const d = JSON.parse(redoS.pop()); objs = d.objs; seq = d.seq; save(); draw(); paint(); return true; }
  const get = id => objs.find(o => o.id === id);

  function meshFor(o) {
    const k = KINDS[o.kind], col = new T.Color(o.color || k.color), g = new T.Group();
    const mat = (c, extra) => new T.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.55, metalness: 0.05 }, extra));
    if (o.kind === 'zone') {
      const m = new T.Mesh(new T.PlaneGeometry(o.w, o.d), new T.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.22, depthWrite: false }));
      m.rotation.x = -Math.PI / 2; m.position.y = 0.03; g.add(m);
      const e = new T.LineSegments(new T.EdgesGeometry(new T.BoxGeometry(o.w, 0.02, o.d)), new T.LineBasicMaterial({ color: col })); e.position.y = 0.04; g.add(e);
    } else if (o.kind === 'marker') {
      const pole = new T.Mesh(new T.CylinderGeometry(0.08, 0.08, o.h, 10), mat('#555')); pole.position.y = o.h / 2; g.add(pole);
      const head = new T.Mesh(new T.SphereGeometry(0.55, 18, 12), mat(col, { emissive: col, emissiveIntensity: 0.35 })); head.position.y = o.h; g.add(head);
    } else if (o.kind === 'robot') {
      const base = new T.Mesh(new T.BoxGeometry(o.w, 0.2, o.d), new T.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.25 })); base.position.y = 0.1; g.add(base);
      const ped = new T.Mesh(new T.CylinderGeometry(0.35, 0.45, 0.9, 16), mat(col)); ped.position.y = 0.45; g.add(ped);
      const arm = new T.Mesh(new T.BoxGeometry(0.25, 1.6, 0.25), mat(col)); arm.position.set(0.35, 1.5, 0); arm.rotation.z = -0.5; g.add(arm);
    } else {
      const box = new T.Mesh(new T.BoxGeometry(o.w, o.h, o.d), mat(col)); box.position.y = o.h / 2; g.add(box);
      if (o.kind === 'conveyor') { const belt = new T.Mesh(new T.BoxGeometry(o.w, 0.04, o.d * 0.8), mat('#22262E')); belt.position.y = o.h + 0.02; g.add(belt); }
      if (o.kind === 'rack') for (let i = 1; i < 4; i++) { const sh = new T.Mesh(new T.BoxGeometry(o.w + 0.05, 0.06, o.d + 0.05), mat('#3B4252')); sh.position.y = o.h * i / 4; g.add(sh); }
    }
    g.position.set(o.x, 0, o.z); g.rotation.y = -(o.rot || 0) * Math.PI / 180;
    g.traverse(c => { c.userData.studio = o.id; c.castShadow = c.isMesh && o.kind !== 'zone'; });
    if (o.id === sel) { const bh = new T.BoxHelper(g, 0x2D5BFF); bh.userData.studio = o.id; bh.raycast = () => {}; group.add(bh); }
    return g;
  }
  function draw() {
    for (const c of [...group.children]) { group.remove(c); c.traverse && c.traverse(x => { if (x.geometry) x.geometry.dispose(); if (x.material) x.material.dispose(); }); }
    for (const o of objs) group.add(meshFor(o));
    // labels: one per object, kept above it; removed objects hide theirs
    for (const [id, el] of lbs) if (!get(id)) { el.remove(); lbs.delete(id); }
    for (const o of objs) {
      let el = lbs.get(o.id);
      if (!el) { el = document.createElement('div'); el.className = 'lb lb-studio'; el.dataset.noI18n = ''; labelsEl && labelsEl.append(el); lbs.set(o.id, el); const id = o.id; PL.V.label(el, () => { const x = get(id); return x ? [x.x, (x.kind === 'zone' ? 0.5 : x.h + 0.8), x.z] : null; }, () => true); }
      el.textContent = o.label || `${TT(KINDS[o.kind].en, KINDS[o.kind].ar)} ${o.id}`;
      el.classList.toggle('on', o.id === sel);
    }
  }

  /* ---------- the plant's own floor: what a design must not sit on ---------- */
  const fp = o => { const a = ((o.rot || 0) % 180 + 180) % 180, turned = a > 45 && a < 135; const w = turned ? o.d : o.w, d = turned ? o.w : o.d; return [o.x - w / 2, o.z - d / 2, o.x + w / 2, o.z + d / 2]; };
  const meet = (a, b) => a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];
  function clashes(o) {
    if (o.kind === 'zone' || o.kind === 'marker') return [];
    const box = fp(o), out = [];
    for (const s of P.stations) if (meet(box, [s.x - s.w / 2, s.z - s.d / 2, s.x + s.w / 2, s.z + s.d / 2])) { out.push(TT(`machine ${s.name} (${s.line})`, `الماكينة ${tr(s.name)} (${s.line})`)); if (out.length > 3) break; }
    if (P.fgSlots.some(f => meet(box, [f.x - 1.15, f.z - 0.75, f.x + 1.15, f.z + 0.75]))) out.push(TT('the finished-goods racks', 'رفوف المنتجات التامة'));
    for (const A of L.AISLES) { const h = A.a[1] === A.b[1], a = h ? [Math.min(A.a[0], A.b[0]), A.a[1] - 1.5, Math.max(A.a[0], A.b[0]), A.a[1] + 1.5] : [A.a[0] - 1.5, Math.min(A.a[1], A.b[1]), A.a[0] + 1.5, Math.max(A.a[1], A.b[1])]; if (meet(box, a)) { out.push(TT('an aisle', 'ممر')); break; } }
    for (const x of objs) if (x.id !== o.id && x.kind !== 'zone' && x.kind !== 'marker' && meet(box, fp(x))) out.push(TT(`design object ${x.label || x.id}`, `عنصر التصميم ${x.label || x.id}`));
    if (box[0] < 0 || box[1] < 0 || box[2] > L.W || box[3] > L.D) out.push(TT('the plant walls', 'جدران المصنع'));
    return out;
  }
  // a free place of the given size inside an area: scanned on a 1 m grid from the area's centre outwards
  function freeSpot(zoneId, w, d, kind = 'machine') {
    const z = ZONES.find(x => x.id === zoneId); if (!z) return null;
    const cx = (z.x0 + z.x1) / 2, cz = (z.z0 + z.z1) / 2, cand = [];
    for (let x = z.x0 + w / 2 + 1; x <= z.x1 - w / 2 - 1; x += 1) for (let y = z.z0 + d / 2 + 1; y <= z.z1 - d / 2 - 1; y += 1) cand.push([x, y, Math.hypot(x - cx, y - cz)]);
    cand.sort((a, b) => a[2] - b[2]);
    for (const [x, y] of cand) if (!clashes({ id: '_', kind, x, z: y, w, d, rot: 0 }).length) return { x: snap(x), z: snap(y) };
    return null;
  }

  /* ---------- the operations (shared by the hand, the local assistant and Claude) ---------- */
  function add(o) {
    const k = KINDS[o.kind]; if (!k) return { error: `Unknown kind "${o.kind}". Use one of: ${Object.keys(KINDS).join(', ')}.` };
    const before = snapshot();
    const n = { id: 'D' + (++seq), kind: o.kind, label: (o.label || '').slice(0, 60), x: r1(+o.x), z: r1(+o.z), w: r1(+o.w || k.w), d: r1(+o.d || k.d), h: r1(+o.h || k.h), rot: Math.round(+o.rot || 0), color: /^#[0-9a-f]{6}$/i.test(o.color || '') ? o.color : k.color };
    if (!isFinite(n.x) || !isFinite(n.z)) return { error: 'x and z are required, in metres on the plant floor.' };
    objs.push(n); sel = n.id; commit(before);
    return { object: n, clashes: clashes(n) };
  }
  function update(id, patch) {
    const o = get(id); if (!o) return { error: `No design object ${id}.` };
    const before = snapshot();
    for (const k of ['label', 'x', 'z', 'w', 'd', 'h', 'rot', 'color']) if (patch[k] != null) o[k] = k === 'label' ? String(patch[k]).slice(0, 60) : k === 'color' ? (/^#[0-9a-f]{6}$/i.test(patch.color) ? patch.color : o.color) : r1(+patch[k]);
    sel = id; commit(before);
    return { object: o, clashes: clashes(o) };
  }
  function remove(id) { const o = get(id); if (!o) return { error: `No design object ${id}.` }; const before = snapshot(); objs = objs.filter(x => x !== o); if (sel === id) sel = null; commit(before); return { removed: id }; }
  function clear() { if (!objs.length) return { removed: 0 }; const before = snapshot(), n = objs.length; objs = []; sel = null; commit(before); return { removed: n }; }
  function lookAt(where) {
    const z = where.zone && ZONES.find(x => x.id === where.zone), o = where.id && get(where.id);
    if (z) { S.lookAt((z.x0 + z.x1) / 2, (z.z0 + z.z1) / 2, Math.max(z.x1 - z.x0, z.z1 - z.z0) * 1.15); return { looking_at: z.name }; }
    if (o) { S.lookAt(o.x, o.z, 36); return { looking_at: o.id }; }
    if (isFinite(where.x) && isFinite(where.z)) { S.lookAt(+where.x, +where.z, +where.distance || 50); return { looking_at: [where.x, where.z] }; }
    return { error: 'Give a zone id, a design object id, or x and z.' };
  }
  function readScene() {
    return {
      plant: { width_m: L.W, depth_m: L.D, axes: 'x runs west to east (0 to 264), z runs north to south (0 to 168)' },
      zones: ZONES.map(z => ({ id: z.id, name: z.name, x0: z.x0, z0: z.z0, x1: z.x1, z1: z.z1 })),
      lines: Object.values(P.lines).filter(Ln => Ln.stations.length).map(Ln => { const xs = Ln.stations.map(s => s.x), zs = Ln.stations.map(s => s.z); return { id: Ln.id, name: Ln.name, kind: Ln.kind, x0: Math.min(...xs), x1: Math.max(...xs), z: r1(zs.reduce((a, b) => a + b, 0) / zs.length), state: Ln.state }; }),
      kinds: Object.fromEntries(Object.entries(KINDS).map(([k, v]) => [k, { default_size_m: [v.w, v.d, v.h] }])),
      design_objects: objs.map(o => Object.assign({}, o, { clashes: clashes(o) })),
      selected: sel
    };
  }

  /* ---------- the local assistant: simple commands in Arabic and English, no key ---------- */
  const KW = {
    rack: /\b(racks?|shelf|shelves)\b|رف|رفوف|أرفف/i, zone: /\b(zones?|areas?|space)\b|منطقة|مساحة|مناطق/i, machine: /\b(machines?)\b|ماكينة|ماكينات|آلة/i,
    conveyor: /\b(conveyors?|belt)\b|سير|ناقل/i, robot: /\b(robots?|cobot|robot cell)\b|روبوت/i, wall: /\b(walls?|fence|partition)\b|حائط|سور|حاجز/i, marker: /\b(markers?|pins?|flag)\b|علامة|دبوس/i
  };
  const ZK = { imp: /import|استيراد/i, loc: /local|vendor|محلي|الموردين/i, smd: /\bsmd\b|\bpba\b/i, office: /office|مكاتب|المكاتب/i, inj: /inject|حقن/i, lcm: /\blcm\b/i, main: /main|assembly|تجميع/i, fg: /shipping|finished|ship|شحن|التامة|تامة/i, press: /press|coating|كبس|طلاء/i, util: /utilit|maintenance|lab|مرافق|صيانة|مختبر/i, svc: /service|spare|خدمة|غيار/i };
  const NUMW = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, 'واحد': 1, 'اثنين': 2, 'اتنين': 2, 'ثلاثة': 3, 'تلاتة': 3, 'أربعة': 4, 'اربعة': 4, 'خمسة': 5 };
  const toLatin = s => s.replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
  function local(q) {
    const s = toLatin(q.trim()), low = s.toLowerCase();
    const kind = Object.keys(KW).find(k => KW[k].test(s));
    const zone = Object.keys(ZK).find(k => ZK[k].test(s));
    const num = (() => { const m = /(\d+(?:\.\d+)?)\s*(m|metres?|meters?|متر|م)\b/i.exec(s); return m ? +m[1] : null; })();
    const count = (() => { const m = /\b(\d+)\s+(?=\D)/.exec(s); if (m && +m[1] < 10 && !/\d\s*(m|متر)/.test(s.slice(m.index, m.index + 6))) return +m[1]; for (const w in NUMW) if (new RegExp(`(^|\\s)${w}(\\s|$)`, 'i').test(low)) return NUMW[w]; return 1; })();
    const label = (() => { const m = /(?:called|named|label(?:led)?|اسمه|اسمها|باسم)\s+["“]?([^"”]+?)["”]?$/i.exec(s); return m ? m[1].trim() : ''; })();
    if (/^(undo|تراجع|رجوع|ارجع)/i.test(low)) return undo() ? TT('Undone.', 'تم التراجع.') : TT('Nothing to undo.', 'لا شيء للتراجع عنه.');
    if (/^(redo|أعد|اعد)/i.test(low)) return redo() ? TT('Redone.', 'تمت الإعادة.') : TT('Nothing to redo.', 'لا شيء لإعادته.');
    if (/(clear|delete|remove) (all|everything)|امسح الكل|احذف الكل|شيل الكل|امسح كل/i.test(s)) { const r = clear(); return TT(`Removed ${r.removed} design objects.`, `حُذف ${r.removed} من عناصر التصميم.`); }
    if (/^(delete|remove|احذف|امسح|شيل)/i.test(low)) { const id = (/\bD\d+\b/i.exec(s) || [])[0]; const t = id ? id.toUpperCase() : sel || (objs[objs.length - 1] || {}).id; if (!t) return TT('There is nothing to delete.', 'لا يوجد ما يُحذف.'); remove(t); return TT(`Deleted ${t}.`, `حُذف ${t}.`); }
    if (/^(move|shift|حرك|حرّك|انقل|زح|زحزح)/i.test(low)) {
      const t = ((/\bD\d+\b/i.exec(s) || [])[0] || sel || '').toUpperCase(); const o = get(t); if (!o) return TT('Select an object first, or name it (for example D3).', 'اختر عنصرًا أولًا، أو اذكر اسمه (مثل D3).');
      const dist = num || 2, dir = /left|west|يسار|غرب/i.test(s) ? [-1, 0] : /right|east|يمين|شرق/i.test(s) ? [1, 0] : /up|north|فوق|شمال/i.test(s) ? [0, -1] : /down|south|تحت|جنوب/i.test(s) ? [0, 1] : null;
      if (zone) { const sp = freeSpot(zone, o.w, o.d, o.kind); if (!sp) return TT('No free space of that size there.', 'لا توجد مساحة خالية بهذا الحجم هناك.'); const r = update(o.id, sp); return TT(`Moved ${o.id} into ${ZONES.find(z => z.id === zone).name}.`, `نُقل ${o.id} إلى ${zoneName(ZONES.find(z => z.id === zone))}.`) + clashText(r.clashes); }
      if (!dir) return TT('Which way? Left, right, up or down, and how many metres.', 'في أي اتجاه؟ يمين أو يسار أو فوق أو تحت، وكم مترًا.');
      const r = update(o.id, { x: o.x + dir[0] * dist, z: o.z + dir[1] * dist }); return TT(`Moved ${o.id} ${dist} m.`, `حُرّك ${o.id} مسافة ${dist} م.`) + clashText(r.clashes);
    }
    if (/^(rotate|turn|لف|دور|دوّر|اقلب)/i.test(low)) { const o = get(((/\bD\d+\b/i.exec(s) || [])[0] || sel || '').toUpperCase()); if (!o) return TT('Select an object first.', 'اختر عنصرًا أولًا.'); const deg = (/(\d+)\s*(°|deg|درجة)/i.exec(s) || [])[1] || 90; const r = update(o.id, { rot: (o.rot + +deg) % 360 }); return TT(`Turned ${o.id} by ${deg}°.`, `دُوّر ${o.id} بمقدار ${deg}°.`) + clashText(r.clashes); }
    if (/^(go|show|zoom|look|فرجني|وريني|اعرض|روح|اذهب|انتقل)/i.test(low) && zone) { lookAt({ zone }); return TT(`Showing ${ZONES.find(z => z.id === zone).name}.`, `يعرض ${zoneName(ZONES.find(z => z.id === zone))}.`); }
    if (/(add|create|put|place|build|new|أضف|ضيف|ضع|حط|اعمل|ابني|أنشئ|انشئ|عايز)/i.test(s) && kind) {
      const k = KINDS[kind], z = zone || 'fg', out = [];
      for (let i = 0; i < Math.min(count, 6); i++) {
        const w = kind === 'conveyor' || kind === 'rack' || kind === 'wall' || kind === 'zone' ? (num || k.w) : k.w, d = kind === 'zone' && num ? num * 0.6 : k.d;
        const sp = freeSpot(z, w, d, kind); if (!sp) { out.push(TT('No more free space there.', 'لا توجد مساحة خالية أخرى هناك.')); break; }
        const r = add({ kind, x: sp.x, z: sp.z, w, d, label: label ? (count > 1 ? `${label} ${i + 1}` : label) : '' });
        out.push(TT(`Added ${k.en.toLowerCase()} ${r.object.id} in ${ZONES.find(x => x.id === z).name} at ${r.object.x}, ${r.object.z} (${w} × ${d} m).`, `أُضيف ${k.ar} ${r.object.id} في ${zoneName(ZONES.find(x => x.id === z))} عند ${r.object.x}، ${r.object.z} (${w} × ${d} م).`));
      }
      if (!zone) out.push(TT('No area was named, so it went to finished goods and shipping. Say "in the injection hall", for example.', 'لم تُذكر منطقة، فوُضع في المنتجات التامة والشحن. قل مثلًا «في صالة الحقن».'));
      lookAt({ zone: z });
      return out.join(' ');
    }
    return TT('I understand: add (a rack, area, machine, conveyor, robot cell, wall or marker) in an area, move, turn, delete, undo, clear all, and show an area. For anything else, add your Anthropic key and Claude will do it.', 'أفهم: أضف (رفًا أو منطقة أو ماكينة أو سيرًا ناقلًا أو خلية روبوت أو حائطًا أو علامة) في منطقة، وحرّك، ودوّر، واحذف، وتراجع، وامسح الكل، واعرض منطقة. ولغير ذلك أضف مفتاح Anthropic وسيتولى Claude التنفيذ.');
  }
  const clashText = c => (c && c.length ? TT(` Careful: it overlaps ${c.join(', ')}.`, ` انتبه: يتداخل مع ${c.join('، ')}.`) : '');

  /* ---------- Claude: the same operations as tools, the viewer's own key ---------- */
  const keyStore = () => { try { return sessionStorage.getItem(KEY) || localStorage.getItem(KEY); } catch (e) { return null; } };
  let sdkP = null, client = null, toolsDef = null; const history = [];
  function loadSdk() { if (window.AnthropicSDK) return Promise.resolve(window.AnthropicSDK); if (!sdkP) sdkP = new Promise((res, rej) => { const s = document.createElement('script'); s.src = SDK; s.onload = () => res(window.AnthropicSDK); s.onerror = () => { s.remove(); sdkP = null; rej(new Error('sdk')); }; document.head.append(s); }); return sdkP; }
  const SYSTEM = `You are the layout designer of Plant EG-01, a fictional TV plant, working in its live 3D digital twin. You edit a design layer on top of the twin: areas (zone), machines, racks, conveyors, robot cells, walls and markers. The layer is for layout proposals; it never changes the simulation.
Rules:
- Call read_scene before every change, even in a follow-up: a person may have moved or deleted objects by hand since your last look. Build on what is there; never recreate what exists.
- Units are metres. x runs west to east (0 to 264), z north to south (0 to 168). Objects are axis-aligned unless rotated (degrees).
- Use find_free_spot to place things inside an area. Every add or update returns clashes with machines, the finished-goods racks, aisles, walls and other objects; fix clashes before you finish, or say plainly why one stays.
- Give objects short labels a plant manager would understand.
- When you finish, call look_at on the result, then reply in two or three short sentences in the user's language (Arabic or English): what you placed and where, and any trade-off.`;
  function defs(SDKm) {
    const sch = (props, req) => ({ type: 'object', properties: props, required: req || [], additionalProperties: false });
    const num = d => ({ type: 'number', description: d }), str = d => ({ type: 'string', description: d });
    const kind = { type: 'string', enum: Object.keys(KINDS), description: 'What to place' };
    const tool = (name, description, schema, run) => SDKm.betaTool({ name, description, inputSchema: schema, run: async inp => { try { const r = run(inp || {}); if (r && r.error) return JSON.stringify(r); log('tool', name, inp); return JSON.stringify(r); } catch (e) { return JSON.stringify({ error: String(e && e.message || e) }); } } });
    const list = [
      tool('read_scene', 'The plant size, its areas (zones with bounds), its production lines, the kinds you can place with default sizes, and every design object now in the layer with its clashes. Call before every change.', sch({}), () => readScene()),
      tool('find_free_spot', 'A free place of the given footprint inside an area, clear of machines, racks, aisles and design objects; null when none fits.', sch({ zone: str('Zone id from read_scene'), w: num('Width along x, m'), d: num('Depth along z, m'), kind }, ['zone', 'w', 'd']), i => ({ spot: freeSpot(i.zone, +i.w, +i.d, i.kind || 'machine') })),
      tool('add_object', 'Place a design object. Returns it with its id and any clashes.', sch({ kind, x: num('Centre x, m'), z: num('Centre z, m'), w: num('Width, m (optional)'), d: num('Depth, m (optional)'), h: num('Height, m (optional)'), rot: num('Rotation in degrees (optional)'), label: str('Short label (optional)'), color: str('Hex colour like #2D5BFF (optional)') }, ['kind', 'x', 'z']), i => add(i)),
      tool('update_object', 'Change a design object: position, size, rotation, label or colour. Returns it with any clashes.', sch({ id: str('Object id, like D3'), x: num('m'), z: num('m'), w: num('m'), d: num('m'), h: num('m'), rot: num('degrees'), label: str('label'), color: str('hex colour') }, ['id']), i => update(String(i.id).toUpperCase(), i)),
      tool('remove_object', 'Delete a design object.', sch({ id: str('Object id') }, ['id']), i => remove(String(i.id).toUpperCase())),
      tool('look_at', 'Move the 3D camera to a zone, a design object or a point.', sch({ zone: str('zone id'), id: str('object id'), x: num('m'), z: num('m'), distance: num('m') }), i => lookAt(i))
    ];
    list[list.length - 1].cache_control = { type: 'ephemeral' };
    return list;
  }
  let busy = false;
  async function claude(q) {
    const SDKm = await loadSdk();
    if (!client) client = new SDKm.Anthropic({ apiKey: keyStore(), dangerouslyAllowBrowser: true });
    if (!toolsDef) toolsDef = defs(SDKm);
    const before = history.length;
    history.push({ role: 'user', content: [{ type: 'text', text: q }] });
    const box = log('ai', '…');
    const runner = client.beta.messages.toolRunner({
      model: MODEL, max_tokens: 8000, stream: true, max_iterations: 16,
      system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
      tools: toolsDef, messages: history.slice(),
      thinking: { type: 'adaptive', display: 'summarized' }, output_config: { effort: 'medium' },
      betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default'
    });
    let final = null, text = '';
    try {
      for await (const stream of runner) {
        stream.on('text', d => { text += d; box.textContent = text; });
        final = await stream.finalMessage();
        if (final.stop_reason === 'refusal' || final.stop_reason === 'max_tokens') break;
      }
      if (final && final.stop_reason === 'refusal') { history.length = before; box.textContent = TT('The model declined this request. Try describing the layout change differently.', 'رفض النموذج هذا الطلب. جرّب وصف تغيير المخطط بطريقة أخرى.'); return; }
      const msgs = runner.params.messages;
      if (final && (!msgs.length || msgs[msgs.length - 1].role !== 'assistant')) msgs.push({ role: 'assistant', content: final.content });
      history.length = 0; history.push(...msgs);
      if (!text) box.textContent = TT('Done.', 'تم.');
    } catch (e) {
      history.length = before;
      const A = SDKm.Anthropic;
      box.textContent = A.AuthenticationError && e instanceof A.AuthenticationError ? TT('The API key was not accepted. Set it again in the command room copilot.', 'لم يُقبل مفتاح API. أعد إدخاله في المساعد الذكي بغرفة التحكم.')
        : A.RateLimitError && e instanceof A.RateLimitError ? TT('Rate limited by the API. Try again in a moment.', 'تجاوزت حد الطلبات. حاول بعد لحظة.')
          : A.APIConnectionError && e instanceof A.APIConnectionError ? TT('Could not reach the Anthropic API from this browser.', 'تعذر الوصول إلى Anthropic API من هذا المتصفح.')
            : TT('Something went wrong talking to the API.', 'حدث خطأ أثناء الاتصال بالـ API.');
      if (A.AuthenticationError && e instanceof A.AuthenticationError) client = null;
    }
  }

  /* ---------- the panel ---------- */
  const panel = document.createElement('section'); panel.className = 'st-panel'; panel.hidden = true; panel.dataset.noI18n = ''; panel.setAttribute('aria-label', 'Plant studio');
  const host = S.canvas.parentElement; host.append(panel);
  const chat = [];
  function log(who, text, extra) {
    if (who === 'tool') { chat.push({ who, text: `${text}${extra && extra.kind ? ' · ' + extra.kind : ''}${extra && extra.id ? ' · ' + extra.id : ''}` }); paintLog(); return null; }
    const m = { who, text }; chat.push(m); paintLog();
    return { set textContent(v) { m.text = v; paintLog(); } };
  }
  function paintLog() { const el = panel.querySelector('.st-log'); if (!el) return; el.innerHTML = chat.slice(-30).map(m => `<p class="st-m ${m.who}">${m.who === 'tool' ? `<code>${esc(m.text)}</code>` : esc(m.text)}</p>`).join(''); el.scrollTop = el.scrollHeight; }
  let open = false;
  function paint() {
    if (!open) return;
    const o = sel && get(sel), k = o && KINDS[o.kind], keyed = !!keyStore();
    panel.dir = ar() ? 'rtl' : 'ltr'; panel.lang = ar() ? 'ar' : 'en';
    const field = (f, l, v, t = 'number', step = '0.5') => `<label>${l}<input data-f="${f}" type="${t}" ${t === 'number' ? `step="${step}"` : ''} value="${esc(v)}"></label>`;
    panel.innerHTML = `<div class="st-head"><div><h2>${TT('Plant studio', 'استوديو المصنع')}</h2><p>${TT('Design layout changes by talking to the plant, or by hand. The design layer never changes the simulation.', 'صمّم تغييرات المخطط بالحديث مع المصنع أو بيدك. طبقة التصميم لا تغيّر المحاكاة.')}</p></div><button type="button" class="st-x" data-st="close" aria-label="${TT('Close the studio', 'أغلق الاستوديو')}">×</button></div>
      <div class="st-log" aria-live="polite"></div>
      <form class="st-ask"><input name="q" autocomplete="off" placeholder="${TT('e.g. add 3 racks in the shipping area', 'مثال: أضف 3 رفوف في منطقة الشحن')}" aria-label="${TT('Describe a change', 'صِف التغيير')}"><button class="btn btn-primary btn-sm" type="submit">${TT('Do it', 'نفّذ')}</button></form>
      <div class="st-sel">${o ? `<p class="st-k">${TT('Selected', 'المحدد')} · ${o.id} · ${TT(k.en, k.ar)}</p>
        <div class="st-f">${field('label', TT('Label', 'الاسم'), o.label, 'text')}${field('w', TT('Width m', 'العرض م'), o.w)}${field('d', TT('Depth m', 'العمق م'), o.d)}${o.kind !== 'zone' ? field('h', TT('Height m', 'الارتفاع م'), o.h) : ''}${field('rot', TT('Turn °', 'الدوران °'), o.rot, 'number', '15')}${field('color', TT('Colour', 'اللون'), o.color, 'color')}</div>
        ${clashes(o).length ? `<p class="st-warn">${esc(TT('Overlaps ', 'يتداخل مع ') + clashes(o).join(ar() ? '، ' : ', '))}</p>` : `<p class="st-ok">${TT('Clear of machines, racks and aisles.', 'خالٍ من التداخل مع الماكينات والرفوف والممرات.')}</p>`}
        <p class="quiet small">${TT('Drag it on the floor · arrows nudge 0.5 m · R turns 15° · Delete removes', 'اسحبه على الأرض · الأسهم تحرك 0.5 م · R يدوّر 15° · Delete يحذف')}</p>` : `<p class="quiet small">${TT('Select a design object in the 3D view to move or edit it.', 'اختر عنصر تصميم في العرض ثلاثي الأبعاد لتحريكه أو تعديله.')}</p>`}</div>
      <div class="st-list">${objs.length ? objs.map(x => `<button type="button" class="st-o ${x.id === sel ? 'on' : ''}" data-st-sel="${x.id}"><b>${x.id}</b> ${esc(x.label || TT(KINDS[x.kind].en, KINDS[x.kind].ar))}${clashes(x).length ? ' ⚠' : ''}</button>`).join('') : `<p class="quiet small">${TT('No design objects yet.', 'لا توجد عناصر تصميم بعد.')}</p>`}</div>
      <p class="st-mode">${keyed ? TT('Claude edits the layer with your key (set in the command room copilot).', 'يحرر Claude الطبقة بمفتاحك (المضبوط في المساعد الذكي بغرفة التحكم).') : TT('Local assistant, no key: simple commands. Add your Anthropic key in the command room copilot for free-form design.', 'مساعد محلي دون مفتاح: أوامر بسيطة. أضف مفتاح Anthropic في المساعد الذكي بغرفة التحكم لتصميم حر.')}</p>
      <div class="st-chips">${[[TT('Add 2 robot cells in the main assembly hall', 'أضف 2 خلية روبوت في صالة التجميع'), ''], [TT('Add a 20 m conveyor in shipping', 'أضف سيرًا ناقلًا 20 متر في الشحن'), ''], [TT('Mark the service-parts area', 'أضف علامة في مخزن قطع الغيار'), '']].map(([t]) => `<button type="button" class="chip" data-st-say="${esc(t)}">${esc(t)}</button>`).join('')}</div>
      <div class="st-foot">
        <button type="button" class="btn btn-secondary btn-sm" data-st="undo" ${undoS.length ? '' : 'disabled'}>${TT('Undo', 'تراجع')}</button>
        <button type="button" class="btn btn-secondary btn-sm" data-st="redo" ${redoS.length ? '' : 'disabled'}>${TT('Redo', 'إعادة')}</button>
        <button type="button" class="btn btn-secondary btn-sm" data-st="export">${TT('Export', 'تصدير')}</button>
        <label class="btn btn-secondary btn-sm st-imp">${TT('Import', 'استيراد')}<input type="file" accept="application/json,.json" data-st="import" hidden></label>
        <button type="button" class="btn btn-secondary btn-sm" data-st="clear" ${objs.length ? '' : 'disabled'}>${TT('Clear', 'مسح')}</button>
      </div>`;
    paintLog();
  }
  async function say(q) {
    if (!q || busy) return;
    log('you', q);
    if (keyStore()) { busy = true; try { await claude(q); } finally { busy = false; } }
    else log('ai', local(q));
    paint();
  }
  panel.addEventListener('submit', e => { e.preventDefault(); const i = panel.querySelector('input[name="q"]'); const q = i.value.trim(); i.value = ''; say(q); });
  panel.addEventListener('click', e => {
    const b = e.target.closest('[data-st],[data-st-sel],[data-st-say]'); if (!b) return;
    if (b.dataset.stSay) return say(b.dataset.stSay);
    if (b.dataset.stSel) { sel = b.dataset.stSel; draw(); paint(); const o = get(sel); if (o) S.lookAt(o.x, o.z, 36); return; }
    const a = b.dataset.st;
    if (a === 'close') setOpen(false); else if (a === 'undo') undo(); else if (a === 'redo') redo(); else if (a === 'clear') { clear(); }
    else if (a === 'export') { const blob = new Blob([JSON.stringify({ plant: 'EG-01', format: 'df-studio/1', objects: objs }, null, 2)], { type: 'application/json' }); const u = URL.createObjectURL(blob), l = document.createElement('a'); l.href = u; l.download = 'plant-eg01-layout.json'; l.click(); setTimeout(() => URL.revokeObjectURL(u), 1000); }
  });
  panel.addEventListener('change', e => {
    if (e.target.dataset.st === 'import' && e.target.files[0]) { e.target.files[0].text().then(t => { try { const d = JSON.parse(t), list = (d.objects || d.objs || []).filter(o => KINDS[o.kind]); const before = snapshot(); objs = []; seq = 0; sel = null; for (const o of list) { objs.push(Object.assign({}, o, { id: 'D' + (++seq) })); } commit(before); log('ai', TT(`Imported ${list.length} design objects.`, `استُورد ${list.length} من عناصر التصميم.`)); } catch (err) { log('ai', TT('That file is not a studio layout.', 'هذا الملف ليس مخطط استوديو.')); } }); return; }
    const f = e.target.dataset.f; if (f && sel) { const v = e.target.value; update(sel, { [f]: f === 'label' || f === 'color' ? v : +v }); }
  });

  /* ---------- by hand: select, drag, nudge, turn, delete ---------- */
  let drag = null;
  host.addEventListener('pointerdown', e => {
    if (!open || e.button > 0 || e.target !== S.canvas) return;
    const hitObj = S.pick(e.clientX, e.clientY, group.children); const id = hitObj && hitObj.userData.studio;
    if (!id) return;
    e.stopPropagation(); e.preventDefault();
    const o = get(id), p = S.groundAt(e.clientX, e.clientY);
    sel = id; drag = { id, dx: p ? o.x - p.x : 0, dz: p ? o.z - p.z : 0, before: snapshot(), moved: false };
    S.controls.enabled = false; draw(); paint();
  }, true);
  host.addEventListener('pointermove', e => {
    if (!drag) return; const p = S.groundAt(e.clientX, e.clientY); if (!p) return;
    const o = get(drag.id); if (!o) return;
    o.x = snap(p.x + drag.dx); o.z = snap(p.z + drag.dz); drag.moved = true;
    const g = group.children.find(c => c.userData.studio === o.id && !(c instanceof T.BoxHelper)); if (g) g.position.set(o.x, 0, o.z);
  }, true);
  const endDrag = e => { if (!drag) return; e.stopPropagation(); S.controls.enabled = true; const d = drag; drag = null; if (d.moved) commit(d.before); else { draw(); paint(); } };
  host.addEventListener('pointerup', endDrag, true); host.addEventListener('pointercancel', endDrag, true);
  addEventListener('keydown', e => {
    if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName) || e.target.isContentEditable) return;
    if ((e.key === 'd' || e.key === 'D') && !e.ctrlKey && !e.metaKey && !e.altKey && !PL.V.walking && (!document.body.dataset.mode || document.body.dataset.mode === '3d')) { setOpen(!open); return; }
    if (!open) return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); (e.shiftKey ? redo : undo)(); return; }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); return; }
    const o = sel && get(sel); if (!o) return;
    const mv = { ArrowLeft: [-0.5, 0], ArrowRight: [0.5, 0], ArrowUp: [0, -0.5], ArrowDown: [0, 0.5] }[e.key];
    if (mv) { e.preventDefault(); e.stopPropagation(); update(o.id, { x: o.x + mv[0], z: o.z + mv[1] }); }
    else if (e.key === 'r' || e.key === 'R') { e.preventDefault(); e.stopPropagation(); update(o.id, { rot: (o.rot + 15) % 360 }); }
    else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); remove(o.id); }
    else if (e.key === 'Escape') { sel = null; draw(); paint(); }
  }, true);

  /* ---------- open and close ---------- */
  const btn = document.createElement('button');
  btn.type = 'button'; btn.className = 'btn btn-secondary btn-sm'; btn.id = 'studioBtn'; btn.dataset.noI18n = '';
  const drillBtn = $('#drillBtn'); if (drillBtn) drillBtn.before(btn);
  function paintBtn() { btn.innerHTML = `${typeof Icons !== 'undefined' ? Icons.get('edit') : ''}<span class="hide-md">${TT('Studio', 'الاستوديو')}</span>`; btn.title = TT('Plant studio: design layout changes by talking to the plant (D)', 'استوديو المصنع: صمّم تغييرات المخطط بالحديث مع المصنع (D)'); btn.setAttribute('aria-pressed', String(open)); }
  function setOpen(v) {
    open = v; panel.hidden = !v; document.body.classList.toggle('studio', v); paintBtn();
    if (v) { if (!chat.length) log('ai', TT('Tell me what to change in the layout, for example "add 2 robot cells in the main assembly hall", or select an object and drag it.', 'قل لي ماذا أغيّر في المخطط، مثل «أضف 2 خلية روبوت في صالة التجميع»، أو اختر عنصرًا واسحبه.')); paint(); const i = panel.querySelector('input[name="q"]'); if (i) i.focus({ preventScroll: true }); }
    else { sel = null; draw(); }
  }
  btn.addEventListener('click', () => setOpen(!open));
  addEventListener('langchange', () => { if (chat.length === 1) chat.length = 0; paintBtn(); draw(); if (open) setOpen(true); });
  load(); draw(); paintBtn();
  // the same operations, for tests, other tools, or an MCP bridge later
  window.PlantStudio = { add, update, remove, clear, undo, redo, read: readScene, freeSpot, lookAt, local, open: setOpen, get objects() { return objs; } };
})();
