/* Digital Factory — the plant hub (window.Twin). Every page of the site runs the same Plant EG-01 twin through this hub.
   - One plant across tabs: each tab advances its engine to a step count derived from a shared wall-clock anchor, and every
     command is scheduled a few steps ahead and broadcast, so all tabs apply it at the same step (deterministic lockstep,
     no leader). A newly opened tab copies the world from a tab that is already running.
   - One plant across visits: the world is saved to IndexedDB and restored on the next visit (Reset starts a fresh shift).
   - What-if: forks of the live world are played forward in background workers (twin-worker.js).
   All data is simulated. */
(function () {
  'use strict';
  const PE = window.PlantEngine;
  const STEP = PE.STEP;
  const CHANNEL = 'df-twin-v2', DB = 'df-twin', STORE = 'kv', KEY = 'world-v2';
  const oid = Math.random().toString(36).slice(2, 10);    // this tab (only orders simultaneous commands; never enters the plant)
  const listeners = [];
  const emit = (t, d) => listeners.slice().forEach(f => { try { f(t, d); } catch (e) { console.error(e); } });
  const bc = 'BroadcastChannel' in window ? new BroadcastChannel(CHANNEL) : null;
  const now = () => Date.now();

  const T = {
    E: null, ready: null, oid, peers: 0, catching: false, restored: false,
    anchor: { wall: 0, k: 0, speed: 1 },          // plant step = anchor.k + (wall - anchor.wall) / 1000 * speed / STEP
    pending: [], seq: 0, lastSave: 0,
    log: [], logN: 0                              // commands as applied here: { k, cmd, n } (time machine replay)
  };

  const target = (w = now()) => Math.floor(T.anchor.k + Math.max(0, w - T.anchor.wall) / 1000 * T.anchor.speed / STEP + 1e-9);
  function lead() { return Math.ceil(0.15 * Math.max(1, T.anchor.speed) / STEP) + 2; }

  /* ---------------- persistence (IndexedDB) ---------------- */
  function idb() {
    return new Promise((res, rej) => {
      if (!('indexedDB' in window)) return rej(new Error('no indexedDB'));
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(STORE);
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
    });
  }
  async function dbGet(k) { try { const d = await idb(); return await new Promise((res, rej) => { const q = d.transaction(STORE).objectStore(STORE).get(k); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); }); } catch (e) { return null; } }
  async function dbPut(k, v) { try { const d = await idb(); await new Promise((res, rej) => { const t = d.transaction(STORE, 'readwrite'); t.objectStore(STORE).put(v, k); t.oncomplete = res; t.onerror = () => rej(t.error); }); return true; } catch (e) { return false; } }
  async function dbDel(k) { try { const d = await idb(); await new Promise(res => { const t = d.transaction(STORE, 'readwrite'); t.objectStore(STORE).delete(k); t.oncomplete = res; t.onerror = res; }); } catch (e) { /* ignore */ } }
  T.dbGet = dbGet; T.dbPut = dbPut;

  function save(force) {
    if (!T.E || T.catching) return;
    if (!force && (document.hidden || now() - T.lastSave < 20000)) return;
    T.lastSave = now();
    let snap;
    try { snap = T.E.snapshot(); } catch (e) { return; }
    dbPut(KEY, { v: 2, savedAt: now(), k: T.E.P.k, speed: T.anchor.speed, snap, pending: plainPending() });
  }

  /* ---------------- engine wiring ---------------- */
  function adopt(E) {
    T.E = E;
    E.on((t, d) => emit(t, d));
    emit('world', E);
  }

  /* ---------------- startup ---------------- */
  function hello() {
    return new Promise(res => {
      if (!bc) return res(null);
      let done = false;
      const onMsg = e => {
        const m = e.data;
        if (m && m.type === 'state' && m.to === oid && !done) { done = true; bc.removeEventListener('message', onMsg); res(m); }
      };
      bc.addEventListener('message', onMsg);
      bc.postMessage({ type: 'hello', oid });
      setTimeout(() => { if (!done) { done = true; bc.removeEventListener('message', onMsg); res(null); } }, 450);
    });
  }

  async function start(opts = {}) {
    const fresh = /[?&]fresh=1/.test(location.search) || opts.fresh;
    const st = fresh ? null : await hello();
    if (st && st.snap) {
      adopt(PE.restore(st.snap));
      T.anchor = st.anchor; T.pending = (st.pending || []).filter(p => p.k >= T.E.P.k);
      T.restored = 'tab';
    } else {
      const saved = fresh ? null : await dbGet(KEY);
      if (saved && saved.v === 2 && saved.snap && now() - saved.savedAt < 8 * 3600 * 1000) {
        try { adopt(PE.restore(saved.snap)); T.restored = 'saved'; T.pending = (saved.pending || []).filter(p => p.k >= T.E.P.k); } catch (e) { adopt(PE.create()); }
        T.anchor = { wall: now(), k: T.E.P.k, speed: saved.speed || 1 };
      } else {
        adopt(PE.create());
        T.anchor = { wall: now(), k: 0, speed: 1 };
      }
    }
    if (bc) bc.addEventListener('message', onMessage);
    document.addEventListener('visibilitychange', () => { if (document.hidden) save(true); });
    addEventListener('pagehide', () => save(true));
    setInterval(() => { save(false); }, 5000);
    // hidden tabs keep pace on a slow timer so they never fall far behind
    setInterval(() => { if (document.hidden) T.frame(); }, 1000);
    emit('ready', T.E);
    return T.E;
  }

  /* ---------------- messages from other tabs ---------------- */
  function onMessage(e) {
    const m = e.data; if (!m || m.oid === oid) return;
    if (m.type === 'hello') {
      if (!T.E) return;
      // answer with a copy of this world; tabs that are behind still answer (the joiner catches up itself)
      try { bc.postMessage({ type: 'state', to: m.oid, oid, snap: T.E.snapshot(), anchor: T.anchor, pending: plainPending() }); } catch (err) { console.warn('Twin: could not share the world', err); }
      T.peers++;
    } else if (m.type === 'cmd') {
      queue(m.p);
      emit('remote', m.p.cmd);
    } else if (m.type === 'anchor') {
      T.anchor = m.anchor; emit('speed', T.anchor.speed);
    } else if (m.type === 'digest') {
      if (T.E && T.E.P.k === m.k && T.E.digest() !== m.d && m.since < T.since) {
        // this tab drifted from an older tab: copy its world again
        console.warn('Twin: out of step with another tab, resyncing');
        resync();
      } else if (T.E && T.E.P.k < m.k) T.peerDigest = m;
    } else if (m.type === 'reset') {
      location.reload();
    } else if (m.type === 'bus') emit('bus', m.msg);
  }
  T.since = now();
  async function resync() {
    const st = await hello();
    if (st && st.snap) { adopt(PE.restore(st.snap)); T.anchor = st.anchor; T.pending = (st.pending || []).filter(p => p.k >= T.E.P.k); }
  }

  // pending commands without their local promise callbacks (those cannot leave this tab)
  const plainPending = () => T.pending.map(p => ({ k: p.k, cmd: p.cmd, oid: p.oid, seq: p.seq }));
  function queue(p) {
    T.pending.push(p);
    T.pending.sort((a, b) => (a.k - b.k) || (a.oid < b.oid ? -1 : a.oid > b.oid ? 1 : a.seq - b.seq));
  }

  /* ---------------- the clock ---------------- */
  function applyNext() {
    const p = T.pending.shift();
    T.log.push({ k: T.E.P.k, cmd: p.cmd, n: ++T.logN }); if (T.log.length > 1500) T.log.shift();
    const ok = T.E.exec(p.cmd);
    if (p.oid === oid && p.resolve) p.resolve(ok);
  }
  let lastDigestK = 0;
  T.frame = function () {
    const E = T.E; if (!E) return 0;
    const want = target();
    let n = 0;
    const max = 2400;
    const t0 = performance.now();
    while (E.P.k < want && n < max) {
      while (T.pending.length && T.pending[0].k <= E.P.k) applyNext();
      E.step(); n++;
      if ((n & 255) === 0 && performance.now() - t0 > 30) break;
    }
    while (T.pending.length && T.pending[0].k <= E.P.k) applyNext();
    const behind = want - E.P.k;
    const catching = behind > 600;
    if (catching !== T.catching) { T.catching = catching; emit('catching', catching ? behind : 0); }
    if (n) emit('tick', n);
    if (bc && E.P.k - lastDigestK >= 3000 && !T.catching) {
      lastDigestK = E.P.k - (E.P.k % 3000);
      if (E.P.k === lastDigestK) bc.postMessage({ type: 'digest', oid, k: E.P.k, d: E.digest(), since: T.since });
    }
    return n;
  };

  /* ---------------- commands ---------------- */
  T.exec = function (cmd) {
    if (!T.E) return Promise.resolve(false);
    const k = Math.max(T.E.P.k, target()) + lead();
    let resolve;
    const pr = new Promise(r => { resolve = r; });
    const p = { k, cmd: JSON.parse(JSON.stringify(cmd)), oid, seq: ++T.seq };
    if (bc) bc.postMessage({ type: 'cmd', oid, p });
    p.resolve = resolve;
    queue(p);
    return pr;
  };
  T.apply = (id, who) => T.exec({ type: 'apply', id, who });
  T.trigger = (id, who) => T.exec({ type: 'trigger', id, who });

  T.setSpeed = function (v) {
    const w = now(), k = target(w);
    T.anchor = { wall: w, k, speed: v };
    if (bc) bc.postMessage({ type: 'anchor', oid, anchor: T.anchor });
    emit('speed', v);
  };
  Object.defineProperty(T, 'speed', { get: () => T.anchor.speed });
  Object.defineProperty(T, 'paused', { get: () => T.anchor.speed === 0 });
  T.on = fn => { listeners.push(fn); return () => { const i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1); }; };
  T.broadcast = msg => { if (bc) bc.postMessage({ type: 'bus', oid, msg }); };
  T.reset = async function () {
    await dbDel(KEY);
    try { localStorage.removeItem('df-agents-v2'); } catch (e) { /* ignore */ }
    await dbDel('agents-v2');
    if (bc) bc.postMessage({ type: 'reset', oid });
    location.reload();
  };
  T.fastForward = function (sec) {
    // jump ahead for everyone: move the anchor so the target step jumps
    const w = now();
    T.anchor = { wall: w, k: target(w) + Math.round(sec / STEP), speed: T.anchor.speed };
    if (bc) bc.postMessage({ type: 'anchor', oid, anchor: T.anchor });
  };

  /* ---------------- what-if: a pool of background workers ---------------- */
  const pool = [];
  let reqSeq = 0;
  const waiting = new Map();
  function workers() {
    if (pool.length || !('Worker' in window)) return pool;
    const n = Math.max(1, Math.min(4, (navigator.hardwareConcurrency || 2) - 1));
    const base = (document.currentScript && document.currentScript.src) || '';
    void base;
    for (let i = 0; i < n; i++) {
      try {
        const w = new Worker('assets/js/twin/twin-worker.js');
        w.onmessage = e => { const j = waiting.get(e.data.id); if (j) j(e.data); };
        // a worker that fails to load would leave its jobs waiting forever: fail them and play futures on the page instead
        w.onerror = () => { for (const [id, j] of waiting) j({ id, error: 'worker failed' }); pool.length = 0; };
        pool.push(w);
      } catch (e) { break; }
    }
    return pool;
  }
  T.whatif = function (req) {
    const E = T.E;
    req = Object.assign({ horizon: 2700, seeds: 3 }, req);
    req.id = req.id || 'w' + (++reqSeq);
    // a what-if starts from the live plant, or from a given world (the time machine branches from the past)
    const snap = req.snap || E.snapshot({ lite: true });
    const from = req.snap ? req.snap.P : E.P;
    delete req.snap;
    const parts = window.WhatIf.plan(req);
    const ws = workers();
    const t0 = performance.now();
    if (!ws.length) return Promise.resolve(Object.assign(window.WhatIf.run(PE, snap, req), { ms: performance.now() - t0, at: from.t, k: from.k }));
    const chunks = ws.map(() => []);
    parts.forEach((p, i) => chunks[i % ws.length].push(p));
    const jobs = chunks.map((c, i) => c.length ? new Promise((res, rej) => {
      const id = req.id + ':' + i;
      waiting.set(id, d => { waiting.delete(id); if (d.error) rej(new Error(d.error)); else res(d.results); });
      ws[i].postMessage({ id, snap, req, parts: c });
    }) : Promise.resolve([]));
    return Promise.all(jobs).then(r => Object.assign(window.WhatIf.combine(req, r.flat()), { ms: Math.round(performance.now() - t0), at: from.t, k: from.k }));
  };

  T.ready = new Promise(res => { T._ready = res; });
  T.start = opts => { const p = start(opts); p.then(E => T._ready(E)); return p; };
  window.Twin = T;
})();
