/* Digital Factory — the time machine. The twin is deterministic: the same world and the same commands at the same steps
   give the same plant. So the room keeps a copy of the world every two plant minutes and the log of every command the
   hub applied; any past moment is rebuilt by restoring the nearest earlier copy and replaying the commands up to it.
   "Branch from here" hands that past world to the what-if lab, so a person can ask "what if we had acted then?".
   Simulated data. */
(function () {
  'use strict';
  const { $, esc } = DF;
  const T = window.Twin, PE = window.PlantEngine;
  const EVERY = 1200;                                            // steps between copies (120 plant seconds)
  const KEEP = matchMedia('(max-width: 900px)').matches ? 8 : 15;   // 15 copies: the last 30 plant minutes
  const ring = [];
  let R = null;                                                  // the rebuilt past: { E, base, nextN }

  DF.replay = null;
  DF.E = () => (DF.replay ? DF.replay.E : T.E);
  DF.world = () => DF.E().P;

  function capture() {
    const E = T.E; if (!E || T.catching) return;
    const k = E.P.k;
    if (ring.length && k - ring[ring.length - 1].k < EVERY) return;
    ring.push({ k, t: E.P.t, n: T.logN, snap: E.snapshot({ lite: true }) });
    while (ring.length > KEEP) ring.shift();
  }
  DF.tmCapture = capture;
  DF._rebuild = k => rebuild(k);        // for tests: rebuild the world at step k
  T.on(t => { if (t === 'world') { ring.length = 0; R = null; } });

  function rebuild(k) {
    const base = ring.slice().reverse().find(r => r.k <= k) || ring[0];
    if (!base) return null;
    let E, nextN;
    if (R && R.base === base && R.E.P.k <= k) { E = R.E; nextN = R.nextN; }
    else { E = PE.restore(structuredClone(base.snap)); nextN = base.n + 1; }   // commands up to base.n are inside the copy
    const log = T.log;
    let i = log.findIndex(x => x.n >= nextN); if (i < 0) i = log.length;
    while (E.P.k < k) {
      while (i < log.length && log[i].k <= E.P.k) { E.exec(log[i].cmd); nextN = log[i].n + 1; i++; }
      E.step();
    }
    R = { E, base, nextN };
    return E;
  }

  /* ---------------- the bar ---------------- */
  const bar = $('#tm'), range = $('#tmRange'), label = $('#tmLabel'), btn = $('#tmBtn');
  const STEP = PE.STEP;
  function sync() {
    const E = T.E; if (!E) return;
    const t0 = ring.length ? ring[0].t : E.P.t, t1 = E.P.t;
    range.min = Math.floor(t0); range.max = Math.floor(t1);
    if (!DF.replay) range.value = range.max;
    const live = !DF.replay;
    const chip = $('#liveChip');
    chip.classList.toggle('replay', !live);
    chip.classList.toggle('paused', live && T.paused);
    $('#liveLabel').textContent = !live ? 'Replay' : T.paused ? 'Paused' : 'Live';
    label.textContent = live ? `Live · ${PE.clockS(t1)} · ${Math.round((t1 - t0) / 60)} min kept` : `Replaying ${PE.clockS(DF.replay.E.P.t)} · ${PE.mins(t1 - DF.replay.E.P.t)} ago`;
    $('#tmBranch').disabled = live;
  }
  DF.tmSync = sync;
  function open(o) {
    const show = o === undefined ? bar.hidden : o;
    bar.hidden = !show; btn.setAttribute('aria-expanded', String(show));
    if (!show) toLive();
    else { capture(); sync(); if (ring.length < 2) DF.toast('The time machine keeps the last 30 plant minutes. It fills as the plant runs; at 4× or 16× it fills faster.', 'info'); range.focus(); }
  }
  DF.tmOpen = open;
  function toLive() { DF.replay = null; R = null; sync(); DF.refresh(true); }
  let pending = null;
  range.addEventListener('input', () => {
    pending = +range.value;
    requestAnimationFrame(() => {
      if (pending == null) return;
      const t = pending; pending = null;
      const E = T.E;
      if (t >= E.P.t - 2 || !ring.length) { toLive(); return; }
      const k = Math.round(E.P.k - (E.P.t - t) / STEP);
      const RE = rebuild(Math.max(ring[0].k, k));
      DF.replay = RE ? { E: RE } : null;
      sync(); DF.refresh(true);
    });
  });
  btn.onclick = () => open();
  $('#tmLive').onclick = () => open(false);
  $('#tmBranch').onclick = () => {
    if (!DF.replay) return;
    const E = DF.replay.E, k0 = E.P.k, t0 = E.P.t;
    // the commands people and agents really gave after that moment, as what-if commands
    const actual = T.log.filter(x => x.k > k0 && x.cmd.type !== 'note').map(x => {
      const c = x.cmd, at = (x.k - k0) * STEP;
      if (c.type === 'at') return Object.assign({}, c.cmd, { at: Math.max(0.1, c.at - t0) });
      return Object.assign({}, c, { at: Math.max(0.1, at) });
    });
    const snap = E.snapshot({ lite: true });
    open(false);
    DF.branchFrom({ snap, t: t0, k: k0, actual });
    DF.toast(`Branching from ${PE.clockS(t0)}: choose options and play them against what really happened`, 'info');
  };
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && DF.replay) open(false); });
  void esc;
})();
