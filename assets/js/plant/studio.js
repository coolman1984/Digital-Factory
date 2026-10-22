/* Digital Factory — Plant studio: design layout changes in the live 3D plant by talking to it, the way Spline for ChatGPT
   lets a chat build and edit a live 3D scene, and further: the objects know the plant they stand in.
   A design layer sits on top of the twin (areas, machines, racks, conveyors, robot cells, walls, markers), drawn by
   studio-models.js. Everyone changes it through one set of operations, apply({ op, by, baseRev, ... }):
   - by hand ("you"): select, drag on the floor, nudge with the arrows, turn with R, delete, edit in the panel;
   - by talking: a local assistant for simple commands in Arabic and English, or Claude with the viewer's own key;
   - coding agents (Claude Code, Codex, any MCP client) through the local bridge in tools/studio-bridge, live;
   - the layout file studio/layout.json, which any coding agent can edit; the page follows it.
   Every change has an author, a revision and an entry in the log. A write based on an old revision is refused with the
   current scene, so no one overwrites another's work (Spline asks its agent to re-read the scene; here it is enforced).
   Undo is per change and per author. Every object is checked against the machines, racks, aisles and walls; a clash is
   outlined on the floor and reported, never hidden. The design layer never changes the simulation. Key: D. */
(function () {
  'use strict';
  const PL = window.Plant, SM = window.StudioModels; if (!PL || !PL.V || !PL.V.studio || !SM) return;
  const S = PL.V.studio, T = S.T, E = PL.E, P = E.P, L = P.layout;
  const $ = s => document.querySelector(s);
  const ar = () => document.documentElement.lang === 'ar';
  const TT = (en, a) => (ar() ? (window.DFI18N && DFI18N.agree ? DFI18N.agree(a) : a) : en);
  const tr = s => (ar() && window.DFI18N && DFI18N.t(s)) || s;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const r1 = v => Math.round(v * 10) / 10, snap = v => Math.round(v * 2) / 2;
  const MODEL = 'claude-opus-5-5', SDK = 'assets/vendor/anthropic/anthropic.iife.min.js', KEY = 'df-claude-key', SAVE = 'df-studio';
  const FILE = 'studio/layout.json', FORMAT = 'df-studio/2';
  const QS = new URLSearchParams(location.search);
  // admin mode: agents, authors, revisions, the bridge and the layout file are for the programme's owner, never for a guest.
  // Turned on with ?admin=1 (off with ?admin=0) or Ctrl+Shift+A, and remembered in this browser.
  const ADMIN = 'df-admin';
  const isAdmin = () => { try { return localStorage.getItem(ADMIN) === '1'; } catch (e) { return false; } };
  const setAdmin = v => { try { v ? localStorage.setItem(ADMIN, '1') : localStorage.removeItem(ADMIN); } catch (e) { /* storage unavailable */ } document.body.classList.toggle('st-admin', !!v); };
  if (QS.has('admin')) setAdmin(QS.get('admin') !== '0'); else document.body.classList.toggle('st-admin', isAdmin());

  /* ---------- what can be placed ---------- */
  const KINDS = {
    zone: { w: 12, d: 8, h: 0.1, color: '#2D5BFF', en: 'Area', ar: 'منطقة' },
    machine: { w: 4, d: 3, h: 2.2, color: '#DCE1E8', en: 'Machine', ar: 'ماكينة' },
    rack: { w: 10, d: 1.4, h: 4, color: '#E07B00', en: 'Rack', ar: 'رف' },
    conveyor: { w: 14, d: 1, h: 0.9, color: '#2D5BFF', en: 'Conveyor', ar: 'سير ناقل' },
    robot: { w: 3, d: 3, h: 2.6, color: '#E8590C', en: 'Robot cell', ar: 'خلية روبوت' },
    wall: { w: 10, d: 0.3, h: 3, color: '#D5DAE1', en: 'Wall', ar: 'حائط' },
    marker: { w: 1.2, d: 1.2, h: 4, color: '#C42B2E', en: 'Marker', ar: 'علامة' }
  };
  const ZONES = L.ZONES;
  const zoneName = z => tr(z.name);
  const kindName = k => TT(KINDS[k].en, KINDS[k].ar);
  const nm = o => o.label || `${kindName(o.kind)} ${String(o.id).replace(/^D/, '')}`;

  /* ---------- who changes the layer: each author has a colour ---------- */
  const COLORS = { you: '#2D5BFF', claude: '#D97757', 'claude-code': '#C15F3C', codex: '#10A37F', file: '#7A5AF8' };
  const PALETTE = ['#0EA5E9', '#D946EF', '#84CC16', '#F59E0B', '#14B8A6', '#F43F5E'];
  const colorOf = by => COLORS[by] || PALETTE[[...String(by)].reduce((a, c) => a + c.charCodeAt(0), 0) % PALETTE.length];
  const whoName = by => (by === 'you' ? TT('You', 'أنت') : by === 'claude' ? 'Claude' : by === 'file' ? TT('Layout file', 'ملف المخطط') : by);
  const present = new Map();   // author → { at, id, verb }

  /* ---------- the design layer: state, revisions, log, undo ---------- */
  let objs = [], seq = 0, rev = 0, sel = null;
  let log = [];                // { rev, by, op, id, why, at }
  const undoS = [], redoS = [];   // { by, op, inv: [...], fwd: [...] } where each step is { put: obj } or { del: id }
  const get = id => objs.find(o => o.id === id);
  const clone = o => JSON.parse(JSON.stringify(o));
  function load() {
    try { const d = JSON.parse(localStorage.getItem(SAVE) || 'null'); if (d && Array.isArray(d.objs)) { objs = d.objs.filter(o => KINDS[o.kind]); seq = d.seq || objs.length; rev = d.rev || 0; log = Array.isArray(d.log) ? d.log.slice(-500) : []; } } catch (e) { /* nothing saved */ }
  }
  function save() { try { localStorage.setItem(SAVE, JSON.stringify({ objs, seq, rev, log: log.slice(-500) })); } catch (e) { /* storage unavailable */ } }
  function run(steps) { for (const s of steps) { if (s.put) { const i = objs.findIndex(o => o.id === s.put.id); if (i >= 0) objs[i] = clone(s.put); else objs.push(clone(s.put)); } else if (s.del) { objs = objs.filter(o => o.id !== s.del); if (sel === s.del) sel = null; } } }
  // one change: apply its steps, remember how to undo it, log it, tell everyone
  function change(by, op, id, why, fwd) {
    const inv = fwd.map(s => { if (s.put) { const old = get(s.put.id); return old ? { put: clone(old) } : { del: s.put.id }; } const old = get(s.del); return old ? { put: clone(old) } : null; }).filter(Boolean).reverse();
    run(fwd); rev++;
    undoS.push({ by, op, inv, fwd }); if (undoS.length > 200) undoS.shift(); redoS.length = 0;
    note(by, op, id, why);
  }
  function note(by, op, id, why) {
    log.push({ rev, by, op, id: id || null, why: why ? String(why).slice(0, 200) : undefined, at: new Date().toISOString() }); if (log.length > 500) log.shift();
    present.set(by, { at: performance.now(), id, verb: op });
    save(); sync(); paint(); emitChange();
  }
  function undo(scope, by) {
    let i = undoS.length - 1; if (scope === 'mine') while (i >= 0 && undoS[i].by !== by) i--;
    if (i < 0) return { ok: false, error: 'nothing to undo', rev };
    const e = undoS.splice(i, 1)[0]; run(e.inv); rev++; redoS.push(e);
    note(by, 'undo', (e.fwd[0] && (e.fwd[0].put ? e.fwd[0].put.id : e.fwd[0].del)) || null, `${e.op} by ${e.by}`);
    return { ok: true, rev, undone: { op: e.op, by: e.by } };
  }
  function redo(by) {
    const e = redoS.pop(); if (!e) return { ok: false, error: 'nothing to redo', rev };
    run(e.fwd); rev++; undoS.push(e);
    note(by, 'redo', null, `${e.op} by ${e.by}`);
    return { ok: true, rev };
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
    for (const x of objs) if (x.id !== o.id && x.kind !== 'zone' && x.kind !== 'marker' && meet(box, fp(x))) out.push(TT(`${nm(x)}`, `«${nm(x)}»`));
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
  function readScene() {
    return {
      rev,
      plant: { width_m: L.W, depth_m: L.D, axes: 'x runs west to east (0 to 264), z runs north to south (0 to 168)' },
      zones: ZONES.map(z => ({ id: z.id, name: z.name, x0: z.x0, z0: z.z0, x1: z.x1, z1: z.z1 })),
      lines: Object.values(P.lines).filter(Ln => Ln.stations.length).map(Ln => { const xs = Ln.stations.map(s => s.x), zs = Ln.stations.map(s => s.z); return { id: Ln.id, name: Ln.name, kind: Ln.kind, x0: Math.min(...xs), x1: Math.max(...xs), z: r1(zs.reduce((a, b) => a + b, 0) / zs.length), state: Ln.state }; }),
      kinds: Object.fromEntries(Object.entries(KINDS).map(([k, v]) => [k, { default_size_m: [v.w, v.d, v.h] }])),
      design_objects: objs.map(o => Object.assign({}, o, { clashes: clashes(o) })),
      selected: sel,
      recent_changes: log.slice(-12),
      present: [...present.entries()].filter(([, p]) => performance.now() - p.at < 120000).map(([by]) => by)
    };
  }

  /* ---------- the operations contract: everyone writes through here ---------- */
  const WRITES = new Set(['add', 'update', 'remove', 'clear', 'undo', 'redo', 'replace']);
  function apply(a) {
    a = a || {}; const by = String(a.by || 'you').slice(0, 40), op = a.op;
    if (WRITES.has(op) && a.baseRev != null && +a.baseRev !== rev) return { ok: false, error: 'stale', message: `The layer changed since revision ${a.baseRev} (now ${rev}). Read the scene again and retry on top of it.`, rev, scene: readScene() };
    if (op === 'read') return Object.assign({ ok: true }, readScene());
    if (op === 'find_free_spot') return { ok: true, rev, spot: freeSpot(a.zone, +a.w, +a.d, a.kind || 'machine') };
    if (op === 'look_at') return lookAt(a);
    if (op === 'select') { sel = get(a.id) ? a.id : null; sync(); paint(); return { ok: true, rev, selected: sel }; }
    if (op === 'add') {
      const k = KINDS[a.kind]; if (!k) return { ok: false, error: `Unknown kind "${a.kind}". Use one of: ${Object.keys(KINDS).join(', ')}.`, rev };
      const n = { id: 'D' + (seq + 1), kind: a.kind, label: String(a.label || '').slice(0, 60), x: r1(+a.x), z: r1(+a.z), w: r1(+a.w || k.w), d: r1(+a.d || k.d), h: r1(+a.h || k.h), rot: Math.round(+a.rot || 0), color: /^#[0-9a-f]{6}$/i.test(a.color || '') ? a.color : k.color, by };
      if (!isFinite(n.x) || !isFinite(n.z)) return { ok: false, error: 'x and z are required, in metres on the plant floor.', rev };
      if (n.w <= 0 || n.d <= 0 || n.h <= 0 || n.w > 120 || n.d > 120 || n.h > 12) return { ok: false, error: 'Sizes must be positive: up to 120 m across and 12 m high.', rev };
      if (locked(n.id, by)) return locked(n.id, by);
      seq++; if (by === 'you' || !sel) sel = n.id; change(by, 'add', n.id, a.why, [{ put: n }]);
      return { ok: true, rev, object: get(n.id), clashes: clashes(n) };
    }
    if (op === 'update') {
      const o = get(String(a.id || '').toUpperCase()); if (!o) return { ok: false, error: `No design object ${a.id}.`, rev };
      const lk = locked(o.id, by); if (lk) return lk;
      const p = a.patch || a, n = clone(o);
      for (const k of ['label', 'x', 'z', 'w', 'd', 'h', 'rot', 'color']) if (p[k] != null && p[k] !== '') n[k] = k === 'label' ? String(p[k]).slice(0, 60) : k === 'color' ? (/^#[0-9a-f]{6}$/i.test(p.color) ? p.color : o.color) : k === 'rot' ? Math.round(((+p[k] % 360) + 360) % 360) : r1(+p[k]);
      if (!(n.w > 0 && n.d > 0 && n.h > 0) || !isFinite(n.x) || !isFinite(n.z)) return { ok: false, error: 'Position and sizes must be numbers; sizes positive.', rev };
      n.by = by; change(by, 'update', o.id, a.why, [{ put: n }]);
      return { ok: true, rev, object: get(o.id), clashes: clashes(get(o.id)) };
    }
    if (op === 'remove') {
      const o = get(String(a.id || '').toUpperCase()); if (!o) return { ok: false, error: `No design object ${a.id}.`, rev };
      const lk = locked(o.id, by); if (lk) return lk;
      change(by, 'remove', o.id, a.why, [{ del: o.id }]); return { ok: true, rev, removed: o.id };
    }
    if (op === 'clear') { if (!objs.length) return { ok: true, rev, removed: 0 }; const n = objs.length; change(by, 'clear', null, a.why, objs.map(o => ({ del: o.id }))); return { ok: true, rev, removed: n }; }
    if (op === 'replace') {   // a whole layout at once (import, the layout file): one change, one undo
      const list = (a.objects || []).filter(o => KINDS[o.kind]);
      const steps = objs.filter(o => !list.some(x => x.id === o.id)).map(o => ({ del: o.id }));
      for (const o of list) { const k = KINDS[o.kind]; const n = { id: String(o.id || 'D' + (++seq)).toUpperCase(), kind: o.kind, label: String(o.label || '').slice(0, 60), x: r1(+o.x || 0), z: r1(+o.z || 0), w: r1(+o.w || k.w), d: r1(+o.d || k.d), h: r1(+o.h || k.h), rot: Math.round(+o.rot || 0), color: /^#[0-9a-f]{6}$/i.test(o.color || '') ? o.color : k.color, by: o.by || by }; const old = get(n.id); if (!old || JSON.stringify(old) !== JSON.stringify(n)) steps.push({ put: n }); const m = /^D(\d+)$/.exec(n.id); if (m) seq = Math.max(seq, +m[1]); }
      if (!steps.length) return { ok: true, rev, changed: 0 };
      change(by, 'replace', null, a.why, steps); return { ok: true, rev, changed: steps.length };
    }
    if (op === 'undo') return undo(a.scope === 'all' ? 'all' : 'mine', by);
    if (op === 'redo') return redo(by);
    return { ok: false, error: `Unknown operation "${op}".`, rev };
  }
  // while a person drags an object, nobody else may change it
  let drag = null;
  const locked = (id, by) => (drag && drag.id === id && by !== 'you' ? { ok: false, error: 'locked', message: `${id} is being moved by hand right now. Try again in a moment.`, rev } : null);
  function lookAt(where) {
    const z = where.zone && ZONES.find(x => x.id === where.zone), o = where.id && get(String(where.id).toUpperCase());
    if (z) { S.lookAt((z.x0 + z.x1) / 2, (z.z0 + z.z1) / 2, Math.max(z.x1 - z.x0, z.z1 - z.z0) * 1.15); return { ok: true, rev, looking_at: z.name }; }
    if (o) { S.lookAt(o.x, o.z, Math.max(22, Math.max(o.w, o.d) * 2.6)); return { ok: true, rev, looking_at: o.id }; }
    if (isFinite(where.x) && isFinite(where.z) && where.x !== '' && where.z !== '') { S.lookAt(+where.x, +where.z, +where.distance || 50); return { ok: true, rev, looking_at: [+where.x, +where.z] }; }
    return { ok: false, error: 'Give a zone id, a design object id, or x and z.', rev };
  }

  /* ---------- drawing: each object keeps its model; moves glide, new objects drop in, removed ones shrink away ---------- */
  const group = new T.Group(); group.name = 'studio'; S.world.add(group);
  const views = new Map();   // id → { g, sig, fp, fpState, born, dying }
  const labelsEl = $('#labels'), lbs = new Map();
  const sig = o => [o.kind, o.w, o.d, o.h, o.color].join('|');
  function sync() {
    for (const o of objs) {
      let v = views.get(o.id);
      if (!v || v.sig !== sig(o)) {
        const g = SM.build(o); g.traverse(c => { c.userData.studio = o.id; }); g.position.set(o.x, 0, o.z); g.rotation.y = -(o.rot || 0) * Math.PI / 180;
        if (v) { g.position.copy(v.g.position); g.rotation.y = v.g.rotation.y; group.remove(v.g); SM.dispose(v.g); }
        group.add(g); v = Object.assign(v || { born: performance.now() / 1000 }, { g, sig: sig(o), dying: 0 }); if (!views.has(o.id)) g.scale.setScalar(0.001); views.set(o.id, v);
      }
      v.dying = 0;
      const state = clashes(o).length ? (o.id === sel ? 'clash-sel' : 'clash') : o.id === sel ? 'sel' : null;
      if (state !== v.fpState || (v.fp && v.fpSize !== o.w + 'x' + o.d)) { if (v.fp) { v.g.remove(v.fp); SM.dispose(v.fp); v.fp = null; } if (state) { v.fp = SM.footprint(o.w, o.d, state); v.g.add(v.fp); } v.fpState = state; v.fpSize = o.w + 'x' + o.d; }
    }
    for (const [id, v] of views) if (!get(id) && !v.dying) v.dying = performance.now() / 1000;
    // labels: one per object, kept above it
    for (const [id, el] of lbs) if (!get(id)) { el.remove(); lbs.delete(id); }
    for (const o of objs) {
      let el = lbs.get(o.id);
      if (!el) { el = document.createElement('div'); el.className = 'lb lb-studio'; el.dataset.noI18n = ''; labelsEl && labelsEl.append(el); lbs.set(o.id, el); const id = o.id; PL.V.label(el, () => { const x = get(id); return x ? [x.x, (x.kind === 'zone' ? 0.5 : x.h + 0.9), x.z] : null; }, () => true); }
      el.textContent = nm(o);
      el.classList.toggle('on', o.id === sel);
      el.style.setProperty('--who', colorOf(o.by || 'you'));
    }
  }
  const ease = k => { const c = 1.6; return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); };   // a little overshoot as it lands
  let clock = 0;
  S.onFrame(dt => {
    clock += Math.min(dt || 0.016, 0.1);
    const now = performance.now() / 1000, f = 1 - Math.exp(-(dt || 0.016) * 14);
    for (const [id, v] of views) {
      const o = get(id), g = v.g;
      if (v.dying) { const k = Math.min(1, (now - v.dying) / 0.28); g.scale.setScalar(Math.max(0.001, 1 - k)); if (k >= 1) { group.remove(g); SM.dispose(g); views.delete(id); } continue; }
      const k = Math.min(1, (now - v.born) / 0.55); g.scale.setScalar(Math.max(0.001, ease(k)));
      if (o) {
        if (drag && drag.id === id) g.position.set(o.x, 0, o.z);
        else { g.position.x += (o.x - g.position.x) * f; g.position.z += (o.z - g.position.z) * f; }
        const tr0 = -(o.rot || 0) * Math.PI / 180; let dr = tr0 - g.rotation.y; dr = Math.atan2(Math.sin(dr), Math.cos(dr)); g.rotation.y += dr * f;
      }
      if (g.userData.tick) g.userData.tick(clock, dt);
      if (v.fp && v.fp.userData.tick) v.fp.userData.tick(clock);
    }
  });

  /* ---------- presence: who is working where ---------- */
  const tags = new Map();   // author → label element
  function tagFor(by) {
    let el = tags.get(by); if (el) return el;
    el = document.createElement('div'); el.className = 'lb lb-who'; el.dataset.noI18n = ''; labelsEl && labelsEl.append(el); tags.set(by, el);
    PL.V.label(el, () => { const p = present.get(by); const o = p && p.id && get(p.id); if (!o || performance.now() - p.at > 4500 || by === 'you' || !isAdmin()) return null; return [o.x, (o.kind === 'zone' ? 1.6 : o.h + 2.2), o.z]; }, () => true);
    return el;
  }
  const VERB = { add: ['placed', 'أضاف'], update: ['moved', 'عدّل'], remove: ['removed', 'حذف'], replace: ['updated the layout', 'حدّث المخطط'], undo: ['undid', 'تراجع'], redo: ['redid', 'أعاد'], clear: ['cleared', 'مسح'] };
  function paintTags() { for (const [by, p] of present) { if (by === 'you') continue; const el = tagFor(by); const v = VERB[p.verb] || [p.verb, p.verb]; el.textContent = `${whoName(by)} · ${TT(v[0], v[1])} ${p.id || ''}`; el.style.setProperty('--who', colorOf(by)); } }

  /* ---------- the layout file: coding agents edit studio/layout.json, the page follows it ---------- */
  let follow = QS.get('studio') === 'file', fileBase = null, fileTimer = 0, fileState = '';
  function layoutDoc() { return { format: FORMAT, plant: 'EG-01', rev, objects: objs.map(clone), log: log.slice(-100) }; }
  async function pollFile() {
    if (!follow) return;
    try {
      const r = await fetch(FILE + '?t=' + Date.now(), { cache: 'no-store' });
      if (!r.ok) { fileState = TT('No layout file yet (studio/layout.json).', 'لا يوجد ملف مخطط بعد (studio/layout.json).'); paint(); return; }
      const txt = await r.text(); if (txt === fileBase) return;
      const d = JSON.parse(txt), list = (d.objects || d.objs || []).filter(o => KINDS[o.kind]).map(o => Object.assign({}, o, { id: String(o.id || '').toUpperCase() }));
      // three-way: only what changed in the file since the last read is applied, so hand edits elsewhere survive
      const prev = fileBase ? (JSON.parse(fileBase).objects || []).map(o => Object.assign({}, o, { id: String(o.id || '').toUpperCase() })) : [];
      const author = (d.log && d.log.length && d.log[d.log.length - 1].by) || 'file';
      const steps = [];
      for (const o of list) { const p = prev.find(x => x.id === o.id); if (o.id && (!p || JSON.stringify(p) !== JSON.stringify(o))) steps.push(o); else if (!o.id) steps.push(o); }
      const gone = prev.filter(p => !list.some(o => o.id === p.id)).map(p => p.id);
      fileBase = txt; fileState = TT(`Following the layout file · revision ${d.rev || '?'}`, `يتابع ملف المخطط · المراجعة ${d.rev || '?'}`);
      if (steps.length || gone.length) {
        const keep = objs.filter(o => !gone.includes(o.id) && !steps.some(s => s.id === o.id));
        apply({ op: 'replace', by: author === 'you' ? 'file' : author, objects: keep.concat(steps), why: 'layout file' });
      }
      paint();
    } catch (e) { fileState = TT('The layout file could not be read as JSON.', 'تعذر قراءة ملف المخطط كـ JSON.'); paint(); }
  }
  function setFollow(v) { follow = !!v; clearInterval(fileTimer); fileBase = null; fileState = ''; if (follow) { pollFile(); fileTimer = setInterval(pollFile, 1500); } paint(); }

  /* ---------- the agent bridge: Claude Code, Codex or any MCP client, live, through tools/studio-bridge ---------- */
  const PORT = +(QS.get('bridge') || (/^(localhost|127\.0\.0\.1)$/.test(location.hostname) && location.port === '5174' ? 5174 : 0));
  let ws = null, wsState = 'off', agents = [], pushT = 0;
  function connect() {
    if (!PORT || (ws && ws.readyState < 2)) return;
    try { ws = new WebSocket(`ws://127.0.0.1:${PORT}/studio`); } catch (e) { wsState = 'off'; return; }
    wsState = 'connecting';
    ws.onopen = () => { wsState = 'on'; ws.send(JSON.stringify({ event: 'hello', page: 'plant', rev, layout: layoutDoc() })); paint(); };
    ws.onclose = () => { wsState = 'off'; agents = []; paint(); setTimeout(connect, 3000); };
    ws.onmessage = m => {
      let q; try { q = JSON.parse(m.data); } catch (e) { return; }
      if (q.event === 'agents') { agents = q.agents || []; paint(); return; }
      if (q.event === 'load' && q.layout) { apply({ op: 'replace', by: 'file', objects: q.layout.objects || [], why: 'loaded studio/layout.json from the bridge' }); return; }
      if (!q.id || !q.op) return;
      const by = String(q.by || 'agent').slice(0, 40);
      if (!open && q.op !== 'read') setOpen(true);
      let res; try { res = apply(Object.assign({}, q.args || {}, { op: q.op, by, baseRev: q.baseRev })); } catch (e) { res = { ok: false, error: String(e && e.message || e), rev }; }
      if (res && res.ok && WRITES.has(q.op) && isAdmin()) logChat('agent', `${whoName(by)} · ${q.op}${q.args && q.args.id ? ' ' + q.args.id : res.object ? ' ' + res.object.id : ''}${q.args && q.args.why ? ' — ' + q.args.why : ''}`, colorOf(by));
      if (res && res.ok && q.op === 'add' && res.object) lookAt({ id: res.object.id });
      ws.send(JSON.stringify({ id: q.id, result: res }));
    };
  }
  function emitChange() {
    paintTags();
    if (ws && ws.readyState === 1) { clearTimeout(pushT); pushT = setTimeout(() => ws.readyState === 1 && ws.send(JSON.stringify({ event: 'layout', layout: layoutDoc() })), 250); }
  }

  /* ---------- the local assistant: simple commands in Arabic and English, no key ---------- */
  const KW = {
    rack: /\b(racks?|shelf|shelves)\b|رف|رفوف|أرفف/i, zone: /\b(zones?|areas?|space)\b|منطقة|مساحة|مناطق/i, machine: /\b(machines?)\b|ماكينة|ماكينات|آلة/i,
    conveyor: /\b(conveyors?|belt)\b|سير|ناقل/i, robot: /\b(robots?|cobot|robot cell)\b|روبوت/i, wall: /\b(walls?|fence|partition)\b|حائط|سور|حاجز/i, marker: /\b(markers?|pins?|flag)\b|علامة|دبوس/i
  };
  const ZK = { imp: /import|استيراد/i, loc: /local|vendor|محلي|الموردين/i, smd: /\bsmd\b|\bpba\b/i, office: /office|مكاتب|المكاتب/i, inj: /inject|حقن/i, lcm: /\blcm\b/i, main: /main|assembly|تجميع/i, fg: /shipping|finished|ship|شحن|التامة|تامة/i, press: /press|coating|كبس|طلاء/i, util: /utilit|maintenance|lab|مرافق|صيانة|مختبر/i, svc: /service|spare|خدمة|غيار/i };
  const NUMW = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, 'واحد': 1, 'اثنين': 2, 'اتنين': 2, 'ثلاثة': 3, 'تلاتة': 3, 'أربعة': 4, 'اربعة': 4, 'خمسة': 5 };
  const toLatin = s => s.replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
  const A = a => apply(Object.assign({ by: 'you' }, a));
  function local(q) {
    const s = toLatin(q.trim()), low = s.toLowerCase();
    const kind = Object.keys(KW).find(k => KW[k].test(s));
    const zone = Object.keys(ZK).find(k => ZK[k].test(s));
    const num = (() => { const m = /(\d+(?:\.\d+)?)\s*(m|metres?|meters?|متر|م)\b/i.exec(s); return m ? +m[1] : null; })();
    const count = (() => { const m = /\b(\d+)\s+(?=\D)/.exec(s); if (m && +m[1] < 10 && !/\d\s*(m|متر)/.test(s.slice(m.index, m.index + 6))) return +m[1]; for (const w in NUMW) if (new RegExp(`(^|\\s)${w}(\\s|$)`, 'i').test(low)) return NUMW[w]; return 1; })();
    const label = (() => { const m = /(?:called|named|label(?:led)?|اسمه|اسمها|باسم)\s+["“]?([^"”]+?)["”]?$/i.exec(s); return m ? m[1].trim() : ''; })();
    const target = () => ((/\bD\d+\b/i.exec(s) || [])[0] || sel || '').toUpperCase();
    if (/^(undo|تراجع|رجوع|ارجع)/i.test(low)) return A({ op: 'undo' }).ok ? TT('Undone.', 'تم التراجع.') : TT('Nothing of yours to undo.', 'لا يوجد تعديل لك للتراجع عنه.');
    if (/^(redo|أعد|اعد)/i.test(low)) return A({ op: 'redo' }).ok ? TT('Redone.', 'تمت الإعادة.') : TT('Nothing to redo.', 'لا شيء لإعادته.');
    if (/(clear|delete|remove) (all|everything)|امسح الكل|احذف الكل|شيل الكل|امسح كل/i.test(s)) { const r = A({ op: 'clear' }); return TT(`Removed ${r.removed} design objects.`, `حُذف ${r.removed} من عناصر التصميم.`); }
    if (/^(delete|remove|احذف|امسح|شيل)/i.test(low)) { const t = target() || (objs[objs.length - 1] || {}).id; if (!t) return TT('There is nothing to delete.', 'لا يوجد ما يُحذف.'); const name = get(t) ? nm(get(t)) : t; const r = A({ op: 'remove', id: t }); return r.ok ? TT(`Deleted ${name}.`, `حُذفت «${name}».`) : r.message || r.error; }
    if (/^(move|shift|حرك|حرّك|انقل|زح|زحزح)/i.test(low)) {
      const o = get(target()); if (!o) return TT('Select an object first.', 'اختر عنصرًا أولًا.');
      const dist = num || 2, dir = /left|west|يسار|غرب/i.test(s) ? [-1, 0] : /right|east|يمين|شرق/i.test(s) ? [1, 0] : /up|north|فوق|شمال/i.test(s) ? [0, -1] : /down|south|تحت|جنوب/i.test(s) ? [0, 1] : null;
      if (zone) { const sp = freeSpot(zone, o.w, o.d, o.kind); if (!sp) return TT('No free space of that size there.', 'لا توجد مساحة خالية بهذا الحجم هناك.'); const r = A({ op: 'update', id: o.id, x: sp.x, z: sp.z }); lookAt({ id: o.id }); return TT(`Moved ${nm(o)} into ${ZONES.find(z => z.id === zone).name}.`, `نُقلت «${nm(o)}» إلى ${zoneName(ZONES.find(z => z.id === zone))}.`) + clashText(r.clashes); }
      if (!dir) return TT('Which way? Left, right, up or down, and how many metres.', 'في أي اتجاه؟ يمين أو يسار أو فوق أو تحت، وكم مترًا.');
      const r = A({ op: 'update', id: o.id, x: o.x + dir[0] * dist, z: o.z + dir[1] * dist }); return TT(`Moved ${nm(o)} ${dist} m.`, `حُرّكت «${nm(o)}» مسافة ${dist} م.`) + clashText(r.clashes);
    }
    if (/^(rotate|turn|لف|دور|دوّر|اقلب)/i.test(low)) { const o = get(target()); if (!o) return TT('Select an object first.', 'اختر عنصرًا أولًا.'); const deg = (/(\d+)\s*(°|deg|درجة)?/i.exec(s.replace(/\bD\d+\b/i, '')) || [])[1] || 90; const r = A({ op: 'update', id: o.id, rot: (o.rot + +deg) % 360 }); return TT(`Turned ${nm(o)} by ${deg}°.`, `دُوّرت «${nm(o)}» بزاوية ${deg}°.`) + clashText(r.clashes); }
    if (/^(go|show|zoom|look|فرجني|وريني|اعرض|روح|اذهب|انتقل)/i.test(low) && zone) { lookAt({ zone }); return TT(`Showing ${ZONES.find(z => z.id === zone).name}.`, `يعرض ${zoneName(ZONES.find(z => z.id === zone))}.`); }
    if (/(add|create|put|place|build|new|أضف|ضيف|ضع|حط|اعمل|ابني|أنشئ|انشئ|عايز)/i.test(s) && kind) {
      const k = KINDS[kind], z = zone || 'fg', out = []; let last = null;
      for (let i = 0; i < Math.min(count, 6); i++) {
        const w = kind === 'conveyor' || kind === 'rack' || kind === 'wall' || kind === 'zone' ? (num || k.w) : k.w, d = kind === 'zone' && num ? num * 0.6 : k.d;
        const sp = freeSpot(z, w, d, kind); if (!sp) { out.push(TT('No more free space there.', 'لا توجد مساحة خالية أخرى هناك.')); break; }
        const r = A({ op: 'add', kind, x: sp.x, z: sp.z, w, d, label: label ? (count > 1 ? `${label} ${i + 1}` : label) : '' }); last = r.object;
        out.push(TT(`Added ${nm(r.object).toLowerCase()} in ${ZONES.find(x => x.id === z).name} (${w} × ${d} m).`, `أُضيفت «${nm(r.object)}» في ${zoneName(ZONES.find(x => x.id === z))} (${w} × ${d} م).`));
      }
      if (!zone) out.push(TT('No area was named, so it went to finished goods and shipping. Say "in the injection hall", for example.', 'لم تُذكر منطقة، فوُضع في المنتجات التامة والشحن. قل مثلًا «في صالة الحقن».'));
      if (count > 1 || !last) lookAt({ zone: z }); else lookAt({ id: last.id });
      return out.join(' ');
    }
    return TT('I understand: add (a rack, area, machine, conveyor, robot cell, wall or marker) in an area, move, turn, delete, undo, clear all, and show an area. For anything else, add your Anthropic key and Claude will do it.', 'أفهم: أضف (رفًا أو منطقة أو ماكينة أو سيرًا ناقلًا أو خلية روبوت أو حائطًا أو علامة) في منطقة، وحرّك، ودوّر، واحذف، وتراجع، وامسح الكل، واعرض منطقة. ولغير ذلك أضف مفتاح Anthropic وسيتولى Claude التنفيذ.');
  }
  const clashText = c => (c && c.length ? TT(` Careful: it overlaps ${c.join(', ')}.`, ` انتبه: يتداخل مع ${c.join('، ')}.`) : '');

  /* ---------- Claude in the page: the same operations as tools, the viewer's own key ---------- */
  const keyStore = () => { try { return sessionStorage.getItem(KEY) || localStorage.getItem(KEY); } catch (e) { return null; } };
  let sdkP = null, client = null, toolsDef = null; const history = [];
  function loadSdk() { if (window.AnthropicSDK) return Promise.resolve(window.AnthropicSDK); if (!sdkP) sdkP = new Promise((res, rej) => { const s = document.createElement('script'); s.src = SDK; s.onload = () => res(window.AnthropicSDK); s.onerror = () => { s.remove(); sdkP = null; rej(new Error('sdk')); }; document.head.append(s); }); return sdkP; }
  const SYSTEM = `You are the layout designer of Plant EG-01, a fictional TV plant, working in its live 3D digital twin. You edit a design layer on top of the twin: areas (zone), machines, racks, conveyors, robot cells, walls and markers. The layer is for layout proposals; it never changes the simulation.
Rules:
- Call read_scene before you start and pass its rev as base_rev on every change; each change returns the new rev to use next. A person or another agent may change the layer while you work: if a change comes back "stale", read the scene again and build on what is there. Never recreate what exists.
- Units are metres. x runs west to east (0 to 264), z north to south (0 to 168). Objects are axis-aligned unless rotated (degrees).
- Use find_free_spot to place things inside an area. Every add or update returns clashes with machines, the finished-goods racks, aisles, walls and other objects; fix clashes before you finish, or say plainly why one stays.
- Give objects short labels a plant manager would understand, and a short "why" on each change.
- When you finish, call look_at on the result, then reply in two or three short sentences in the user's language (Arabic or English): what you placed and where, and any trade-off.`;
  function defs(SDKm) {
    const sch = (props, req) => ({ type: 'object', properties: props, required: req || [], additionalProperties: false });
    const num = d => ({ type: 'number', description: d }), str = d => ({ type: 'string', description: d });
    const kind = { type: 'string', enum: Object.keys(KINDS), description: 'What to place' };
    const base = num('The rev from read_scene or from your last change'), why = str('One short reason for this change');
    const tool = (name, op, description, schema) => SDKm.betaTool({ name, description, inputSchema: schema, run: async inp => { try { const i = inp || {}; const r = apply(Object.assign({}, i, { op, by: 'claude', baseRev: i.base_rev })); if (r && r.ok && WRITES.has(op) && isAdmin()) logChat('tool', `${op}${i.id ? ' ' + i.id : r.object ? ' ' + r.object.id : ''}`); return JSON.stringify(r); } catch (e) { return JSON.stringify({ ok: false, error: String(e && e.message || e) }); } } });
    const list = [
      tool('read_scene', 'read', 'The current rev, the plant size, its areas (zones with bounds), its production lines, the kinds you can place with default sizes, every design object with its clashes and author, and the recent changes. Call before you start and whenever a change comes back stale.', sch({})),
      tool('find_free_spot', 'find_free_spot', 'A free place of the given footprint inside an area, clear of machines, racks, aisles and design objects; null when none fits.', sch({ zone: str('Zone id from read_scene'), w: num('Width along x, m'), d: num('Depth along z, m'), kind }, ['zone', 'w', 'd'])),
      tool('add_object', 'add', 'Place a design object. Returns it with its id, any clashes and the new rev.', sch({ base_rev: base, kind, x: num('Centre x, m'), z: num('Centre z, m'), w: num('Width, m (optional)'), d: num('Depth, m (optional)'), h: num('Height, m (optional)'), rot: num('Rotation in degrees (optional)'), label: str('Short label (optional)'), color: str('Hex colour like #2D5BFF (optional)'), why }, ['base_rev', 'kind', 'x', 'z'])),
      tool('update_object', 'update', 'Change a design object: position, size, rotation, label or colour. Returns it with any clashes and the new rev.', sch({ base_rev: base, id: str('Object id, like D3'), x: num('m'), z: num('m'), w: num('m'), d: num('m'), h: num('m'), rot: num('degrees'), label: str('label'), color: str('hex colour'), why }, ['base_rev', 'id'])),
      tool('remove_object', 'remove', 'Delete a design object. Returns the new rev.', sch({ base_rev: base, id: str('Object id'), why }, ['base_rev', 'id'])),
      tool('look_at', 'look_at', 'Move the 3D camera to a zone, a design object or a point.', sch({ zone: str('zone id'), id: str('object id'), x: num('m'), z: num('m'), distance: num('m') }))
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
    const box = logChat('ai', '…');
    const runner = client.beta.messages.toolRunner({
      model: MODEL, max_tokens: 8000, stream: true, max_iterations: 18,
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
      const An = SDKm.Anthropic;
      box.textContent = An.AuthenticationError && e instanceof An.AuthenticationError ? TT('The API key was not accepted. Set it again in the command room copilot.', 'لم يُقبل مفتاح API. أعد إدخاله في المساعد الذكي بغرفة التحكم.')
        : An.RateLimitError && e instanceof An.RateLimitError ? TT('Rate limited by the API. Try again in a moment.', 'تجاوزت حد الطلبات. حاول بعد لحظة.')
          : An.APIConnectionError && e instanceof An.APIConnectionError ? TT('Could not reach the Anthropic API from this browser.', 'تعذر الوصول إلى Anthropic API من هذا المتصفح.')
            : TT('Something went wrong talking to the API.', 'حدث خطأ أثناء الاتصال بالـ API.');
      if (An.AuthenticationError && e instanceof An.AuthenticationError) client = null;
    }
  }

  /* ---------- the panel ---------- */
  const panel = document.createElement('section'); panel.className = 'st-panel'; panel.hidden = true; panel.dataset.noI18n = ''; panel.setAttribute('aria-label', 'Plant studio');
  const host = S.canvas.parentElement; host.append(panel);
  const chat = [];
  function logChat(who, text, color) { const m = { who, text, color }; chat.push(m); if (chat.length > 200) chat.shift(); paintLog(); return { set textContent(v) { m.text = v; paintLog(); } }; }
  function paintLog() { const el = panel.querySelector('.st-log'); if (!el) return; el.innerHTML = chat.slice(-40).map(m => `<p class="st-m ${m.who}"${m.color ? ` style="--who:${m.color}"` : ''}>${m.who === 'tool' ? `<code>${esc(m.text)}</code>` : esc(m.text)}</p>`).join(''); el.scrollTop = el.scrollHeight; }
  let open = false;
  function paint() {
    if (!open) return;
    const o = sel && get(sel), keyed = !!keyStore(), cl = o ? clashes(o) : [];
    panel.dir = ar() ? 'rtl' : 'ltr'; panel.lang = ar() ? 'ar' : 'en';
    const field = (f, l, v, t = 'number', step = '0.5') => `<label>${l}<input data-f="${f}" type="${t}" ${t === 'number' ? `step="${step}"` : ''} value="${esc(v)}"></label>`;
    const who = [...new Set(['you'].concat(agents, [...present.entries()].filter(([b, p]) => b !== 'you' && performance.now() - p.at < 120000).map(([b]) => b)))];
    const lastUndo = undoS[undoS.length - 1], admin = isAdmin();
    const focus = document.activeElement && panel.contains(document.activeElement) ? document.activeElement.name || document.activeElement.dataset.f : null;
    const qv = (panel.querySelector('input[name="q"]') || {}).value || '';
    panel.innerHTML = `<div class="st-head"><div><h2>${TT('Plant studio', 'استوديو المصنع')}</h2><p>${TT('Design layout changes by describing them or by hand, and see each one in the live plant. The design layer never changes production.', 'صمّم تغييرات المخطط بوصفها أو بيدك، وشاهد كل تغيير في المصنع الحي. طبقة التصميم لا تؤثر في الإنتاج.')}</p></div><button type="button" class="st-x" data-st="close" aria-label="${TT('Close the studio', 'أغلق الاستوديو')}">×</button></div>
      ${admin ? `<div class="st-who" aria-label="${TT('Working on the layer', 'يعمل على الطبقة')}">${who.map(b => `<span class="st-p" style="--who:${colorOf(b)}">${esc(whoName(b))}</span>`).join('')}<span class="st-rev">${TT('Revision', 'المراجعة')} ${rev}</span></div>` : ''}
      <div class="st-log" aria-live="polite"></div>
      <form class="st-ask"><input name="q" autocomplete="off" placeholder="${TT('e.g. add 3 racks in the shipping area', 'مثال: أضف 3 رفوف في منطقة الشحن')}" aria-label="${TT('Describe a change', 'صِف التغيير')}"><button class="btn btn-primary btn-sm" type="submit">${TT('Do it', 'نفّذ')}</button></form>
      <div class="st-sel">${o ? `<p class="st-k">${TT('Selected', 'المحدد')} · ${esc(nm(o))}${admin ? ` · ${o.id} <span class="st-by" style="--who:${colorOf(o.by || 'you')}">${esc(whoName(o.by || 'you'))}</span>` : ''}</p>
        <div class="st-f">${field('label', TT('Label', 'الاسم'), o.label, 'text')}${field('w', TT('Width m', 'العرض م'), o.w)}${field('d', TT('Depth m', 'العمق م'), o.d)}${o.kind !== 'zone' ? field('h', TT('Height m', 'الارتفاع م'), o.h) : ''}${field('rot', TT('Turn °', 'الدوران °'), o.rot, 'number', '15')}${field('color', TT('Colour', 'اللون'), o.color, 'color')}</div>
        ${cl.length ? `<p class="st-warn">${esc(TT('Overlaps ', 'يتداخل مع ') + cl.join(ar() ? '، ' : ', '))}</p>` : `<p class="st-ok">${TT('Clear of machines, racks and aisles.', 'خالٍ من التداخل مع الماكينات والرفوف والممرات.')}</p>`}
        <p class="quiet small">${TT('Drag it on the floor · arrows nudge 0.5 m · R turns 15° · Delete removes', 'اسحبه على الأرض · الأسهم تحرك 0.5 م · R يدوّر 15° · Delete يحذف')}</p>` : `<p class="quiet small">${TT('Select a design object in the 3D view to move or edit it.', 'اختر عنصر تصميم في العرض ثلاثي الأبعاد لتحريكه أو تعديله.')}</p>`}</div>
      <div class="st-list">${objs.length ? objs.map(x => `<button type="button" class="st-o ${x.id === sel ? 'on' : ''}" data-st-sel="${x.id}" style="--who:${colorOf(x.by || 'you')}">${esc(nm(x))}${clashes(x).length ? ' ⚠' : ''}</button>`).join('') : `<p class="quiet small">${TT('No design objects yet.', 'لا توجد عناصر تصميم بعد.')}</p>`}</div>
      <div class="st-chips">${[TT('Add 2 robot cells in the main assembly hall', 'أضف 2 خلية روبوت في صالة التجميع'), TT('Add a 20 m conveyor in shipping', 'أضف سيرًا ناقلًا 20 متر في الشحن'), TT('Add a rack in the service parts area', 'أضف رفًا في مخزن قطع الغيار')].map(t => `<button type="button" class="chip" data-st-say="${esc(t)}">${esc(t)}</button>`).join('')}</div>
      ${admin ? `<div class="st-links"><p class="st-k">${TT('Admin settings · visible only to you', 'إعدادات المسؤول · تظهر لك وحدك')}</p>
        <p class="st-mode">${keyed ? TT('Claude edits the layer with your key (set in the command room copilot).', 'يحرر Claude الطبقة بمفتاحك (المضبوط في المساعد الذكي بغرفة التحكم).') : TT('Local assistant, no key: simple commands. Add your Anthropic key in the command room copilot for free-form design.', 'مساعد محلي دون مفتاح: أوامر بسيطة. أضف مفتاح Anthropic في المساعد الذكي بغرفة التحكم لتصميم حر.')}</p>
        <p class="st-mode">${PORT ? (wsState === 'on' ? `<span class="st-dot on"></span>${TT(`Connected to the agent bridge${agents.length ? ': ' + agents.map(whoName).join(', ') : ', no agent yet'}.`, `متصل بجسر الوكلاء${agents.length ? ': ' + agents.map(whoName).join('، ') : '، لا يوجد وكيل بعد'}.`)}` : `<span class="st-dot"></span>${TT('Looking for the agent bridge on port ' + PORT + '…', 'يبحث عن جسر الوكلاء على المنفذ ' + PORT + '…')}`) : TT('Coding agents: run tools/studio-bridge and open this page from it, or let them edit studio/layout.json.', 'وكلاء البرمجة: شغّل tools/studio-bridge وافتح الصفحة منه، أو دعهم يعدّلون studio/layout.json.')}</p>
        <label class="st-sw"><input type="checkbox" data-st="follow" ${follow ? 'checked' : ''}> ${TT('Follow the layout file', 'تابع ملف المخطط')}</label>${follow && fileState ? `<p class="st-mode">${esc(fileState)}</p>` : ''}
        <p class="st-mode">${TT('Ctrl+Shift+A hides these settings again.', 'Ctrl+Shift+A يخفي هذه الإعدادات مجددًا.')}</p>
      </div>` : ''}
      <div class="st-foot">
        <button type="button" class="btn btn-secondary btn-sm" data-st="undo" ${lastUndo ? '' : 'disabled'} title="${lastUndo ? esc(admin ? TT('Undo the last change by ', 'تراجع عن آخر تعديل من ') + whoName(lastUndo.by) : TT('Undo the last change', 'تراجع عن آخر تعديل')) : ''}">${TT('Undo', 'تراجع')}${admin && lastUndo && lastUndo.by !== 'you' ? ` · ${esc(whoName(lastUndo.by))}` : ''}</button>
        <button type="button" class="btn btn-secondary btn-sm" data-st="redo" ${redoS.length ? '' : 'disabled'}>${TT('Redo', 'إعادة')}</button>
        <button type="button" class="btn btn-secondary btn-sm" data-st="export">${TT('Export', 'تصدير')}</button>
        <label class="btn btn-secondary btn-sm st-imp">${TT('Import', 'استيراد')}<input type="file" accept="application/json,.json" data-st="import" hidden></label>
        <button type="button" class="btn btn-secondary btn-sm" data-st="clear" ${objs.length ? '' : 'disabled'}>${TT('Clear', 'مسح')}</button>
      </div>`;
    const qi = panel.querySelector('input[name="q"]'); if (qi) qi.value = qv;
    if (focus) { const f = panel.querySelector(focus === 'q' ? 'input[name="q"]' : `[data-f="${focus}"]`); if (f) f.focus({ preventScroll: true }); }
    paintLog();
  }
  async function say(q) {
    if (!q || busy) return;
    logChat('you', q);
    if (keyStore()) { busy = true; try { await claude(q); } finally { busy = false; } }
    else logChat('ai', local(q));
    paint();
  }
  panel.addEventListener('submit', e => { e.preventDefault(); const i = panel.querySelector('input[name="q"]'); const q = i.value.trim(); i.value = ''; say(q); });
  panel.addEventListener('click', e => {
    const b = e.target.closest('[data-st],[data-st-sel],[data-st-say]'); if (!b) return;
    if (b.dataset.stSay) return say(b.dataset.stSay);
    if (b.dataset.stSel) { apply({ op: 'select', id: b.dataset.stSel }); lookAt({ id: b.dataset.stSel }); return; }
    const a = b.dataset.st;
    if (a === 'close') setOpen(false);
    else if (a === 'undo') A({ op: 'undo', scope: 'all' });
    else if (a === 'redo') A({ op: 'redo' });
    else if (a === 'clear') A({ op: 'clear' });
    else if (a === 'export') { const blob = new Blob([JSON.stringify(layoutDoc(), null, 2)], { type: 'application/json' }); const u = URL.createObjectURL(blob), l = document.createElement('a'); l.href = u; l.download = 'layout.json'; l.click(); setTimeout(() => URL.revokeObjectURL(u), 1000); }
  });
  panel.addEventListener('change', e => {
    if (e.target.dataset.st === 'follow') { setFollow(e.target.checked); return; }
    if (e.target.dataset.st === 'import' && e.target.files[0]) { e.target.files[0].text().then(t => { try { const d = JSON.parse(t), list = (d.objects || d.objs || []).filter(o => KINDS[o.kind]); const r = A({ op: 'replace', objects: list, why: 'imported a layout' }); logChat('ai', TT(`Imported ${list.length} design objects.`, `استُورد ${list.length} من عناصر التصميم.`)); return r; } catch (err) { logChat('ai', TT('That file is not a studio layout.', 'هذا الملف ليس مخطط استوديو.')); } }); return; }
    const f = e.target.dataset.f; if (f && sel) { const v = e.target.value; A({ op: 'update', id: sel, [f]: f === 'label' || f === 'color' ? v : +v }); }
  });

  /* ---------- by hand: select, drag, nudge, turn, delete ---------- */
  host.addEventListener('pointerdown', e => {
    if (!open || e.button > 0 || e.target !== S.canvas) return;
    const hit = S.pick(e.clientX, e.clientY, group.children); const id = hit && hit.userData.studio;
    if (!id || !get(id)) return;
    e.stopPropagation(); e.preventDefault();
    const o = get(id), p = S.groundAt(e.clientX, e.clientY);
    sel = id; drag = { id, dx: p ? o.x - p.x : 0, dz: p ? o.z - p.z : 0, from: clone(o), moved: false };
    S.controls.enabled = false; S.canvas.style.cursor = 'grabbing'; sync(); paint();
  }, true);
  host.addEventListener('pointermove', e => {
    if (!drag) { if (open && e.target === S.canvas && e.buttons === 0) { const hit = S.pick(e.clientX, e.clientY, group.children); S.canvas.style.cursor = hit && hit.userData.studio ? 'grab' : ''; } return; }
    const p = S.groundAt(e.clientX, e.clientY); if (!p) return;
    const o = get(drag.id); if (!o) return;
    o.x = snap(p.x + drag.dx); o.z = snap(p.z + drag.dz); drag.moved = true; sync();
  }, true);
  const endDrag = e => {
    if (!drag) return; e.stopPropagation(); S.controls.enabled = true; S.canvas.style.cursor = '';
    const d = drag; drag = null; const o = get(d.id);
    if (d.moved && o && (o.x !== d.from.x || o.z !== d.from.z)) { const to = { x: o.x, z: o.z }; Object.assign(o, { x: d.from.x, z: d.from.z }); A({ op: 'update', id: d.id, x: to.x, z: to.z }); }
    else { sync(); paint(); }
  };
  host.addEventListener('pointerup', endDrag, true); host.addEventListener('pointercancel', endDrag, true);
  addEventListener('keydown', e => {
    if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName) || e.target.isContentEditable) return;
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'a') { e.preventDefault(); setAdmin(!isAdmin()); sync(); paintTags(); paint(); return; }
    if ((e.key === 'd' || e.key === 'D') && !e.ctrlKey && !e.metaKey && !e.altKey && !PL.V.walking && (!document.body.dataset.mode || document.body.dataset.mode === '3d')) { setOpen(!open); return; }
    if (!open) return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); A(e.shiftKey ? { op: 'redo' } : { op: 'undo' }); return; }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); A({ op: 'redo' }); return; }
    const o = sel && get(sel); if (!o) return;
    const mv = { ArrowLeft: [-0.5, 0], ArrowRight: [0.5, 0], ArrowUp: [0, -0.5], ArrowDown: [0, 0.5] }[e.key];
    if (mv) { e.preventDefault(); e.stopPropagation(); A({ op: 'update', id: o.id, x: o.x + mv[0], z: o.z + mv[1] }); }
    else if (e.key === 'r' || e.key === 'R') { e.preventDefault(); e.stopPropagation(); A({ op: 'update', id: o.id, rot: (o.rot + 15) % 360 }); }
    else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); A({ op: 'remove', id: o.id }); }
    else if (e.key === 'Escape') { sel = null; sync(); paint(); }
  }, true);

  /* ---------- open and close ---------- */
  const btn = document.createElement('button');
  btn.type = 'button'; btn.className = 'btn btn-secondary btn-sm'; btn.id = 'studioBtn'; btn.dataset.noI18n = '';
  const drillBtn = $('#drillBtn'); if (drillBtn) drillBtn.before(btn);
  function paintBtn() { btn.innerHTML = `${typeof Icons !== 'undefined' ? Icons.get('edit') : ''}<span class="hide-md">${TT('Studio', 'الاستوديو')}</span>`; btn.title = TT('Plant studio: design layout changes by talking to the plant (D)', 'استوديو المصنع: صمّم تغييرات المخطط بالحديث مع المصنع (D)'); btn.setAttribute('aria-pressed', String(open)); }
  function setOpen(v) {
    open = v; panel.hidden = !v; document.body.classList.toggle('studio', v); paintBtn();
    if (v) { if (!chat.length) logChat('ai', TT('Tell me what to change in the layout, for example "add 2 robot cells in the main assembly hall", or select an object and drag it.', 'قل لي ماذا أغيّر في المخطط، مثل «أضف 2 خلية روبوت في صالة التجميع»، أو اختر عنصرًا واسحبه.')); paint(); const i = panel.querySelector('input[name="q"]'); if (i) i.focus({ preventScroll: true }); }
    else { sel = null; sync(); }
  }
  btn.addEventListener('click', () => setOpen(!open));
  addEventListener('langchange', () => { if (chat.length === 1) chat.length = 0; paintBtn(); sync(); paintTags(); if (open) setOpen(true); });
  setInterval(() => { if (open && present.size) paint(); }, 15000);
  load(); sync(); paintBtn();
  if (follow) { setOpen(true); setFollow(true); }
  if (PORT) { connect(); setOpen(true); }

  // the same operations, for tests, the bridge and any other tool
  window.PlantStudio = {
    apply, read: readScene, freeSpot, lookAt, local, open: setOpen, follow: setFollow, layout: layoutDoc,
    add: a => apply(Object.assign({ by: 'you' }, a, { op: 'add' })), update: (id, p) => apply(Object.assign({ by: 'you' }, p, { op: 'update', id })), remove: id => apply({ op: 'remove', id, by: 'you' }),
    clear: () => apply({ op: 'clear', by: 'you' }), undo: () => apply({ op: 'undo', by: 'you', scope: 'all' }), redo: () => apply({ op: 'redo', by: 'you' }),
    get objects() { return objs; }, get rev() { return rev; }, get log() { return log; }
  };
})();
