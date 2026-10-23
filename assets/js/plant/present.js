/* Presentation mode and picture modes for the live plant.
   - Picture modes: Ultra (for a meeting room screen: up to 2 device pixels, finer ambient occlusion, haze in the light,
     depth of field in the hero shots), Standard (the governor holds the frame rate, from high down to low) and Light
     (low, for weak devices). Chosen from the picture menu; the choice is remembered on this device.
   - Presentation: the 3D view fills the screen without the panels, in the cinematic grade, and runs a guided story of
     hero shots, one area of the plant each, built from where the stations really stand. Each shot eases in, then
     drifts slowly while its caption reads; the last one goes to the most urgent live problem the agents have raised.
     Arrow keys or the buttons step, Space pauses, Esc leaves. With reduced motion the moves become cuts.
   It only moves the camera and changes how the view draws; it never writes to the plant. */
(function () {
  const $ = s => document.querySelector(s);
  const tt = t => (window.DFI18N && DFI18N.ar && DFI18N.ar() && DFI18N.t(t)) || t;
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const HOLD = 9;   // seconds a shot is held, the move included

  function start() {
    const PL = window.Plant; if (!PL || !PL.V || !PL.V.camTo) return setTimeout(start, 400);
    const { E, V } = PL, P = E.P, LW = P.layout.W, LD = P.layout.D;
    const stations = V.stationsPos;
    const st = (kind, pick) => { const a = stations.filter(s => s.kind === kind && (!pick || pick(s))); return a[Math.floor(a.length / 2)] || a[0]; };
    const lineKind = s => (P.lines[s.line] || {}).kind;

    /* ---------------- picture modes ---------------- */
    const qBtn = $('#qualBtn'), qMenu = $('#qualMenu'), qName = $('#qualName');
    const MODES = [['ultra', 'Ultra', 'For presentations: the finest picture, haze in the light, depth of field'], ['standard', 'Standard', 'Balanced: holds the frame rate on this device'], ['light', 'Light', 'For weaker devices and phones: no shadows or effects']];
    const sync = () => { const m = V.mode; if (qName) qName.textContent = tt(MODES.find(x => x[0] === m)[1]); if (qMenu) qMenu.querySelectorAll('[data-mode]').forEach(b => b.setAttribute('aria-checked', String(b.dataset.mode === m))); };
    if (qBtn && qMenu) {
      qMenu.innerHTML = `<p class="menu-h">${tt('Picture quality')}</p>` + MODES.map(([id, n, d]) => `<button type="button" role="menuitemradio" class="drill" data-mode="${id}" aria-checked="false"><b>${tt(n)}</b><span>${tt(d)}</span></button>`).join('');
      const open = v => { const inside = qMenu.contains(document.activeElement); qMenu.hidden = !v; qBtn.setAttribute('aria-expanded', String(v)); if (v) (qMenu.querySelector('[aria-checked="true"]') || qMenu.querySelector('button')).focus(); else if (inside) qBtn.focus(); };
      qBtn.addEventListener('click', e => { e.stopPropagation(); const d = $('#drills'); if (d && !d.hidden) $('#drillBtn').click(); open(qMenu.hidden); });
      qMenu.addEventListener('click', e => { const b = e.target.closest('[data-mode]'); if (!b) return; V.setMode(b.dataset.mode); try { localStorage.setItem('df-picture', b.dataset.mode); } catch (er) { /* private mode */ } sync(); open(false); });
      qMenu.addEventListener('keydown', e => {
        const bs = [...qMenu.querySelectorAll('[data-mode]')], i = bs.indexOf(document.activeElement);
        if (e.key === 'Escape') { e.stopPropagation(); open(false); }
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); bs[(i + (e.key === 'ArrowDown' ? 1 : bs.length - 1)) % bs.length].focus(); }
      });
      document.addEventListener('click', e => { if (!qMenu.hidden && !e.target.closest('#qualMenu') && e.target !== qBtn) open(false); });
    }
    try { const m = localStorage.getItem('df-picture'); if (m === 'ultra' || m === 'light') V.setMode(m); } catch (er) { /* private mode */ }
    V.on(t => { if (t === 'mode' || t === 'quality') sync(); });
    sync();

    /* ---------------- the story: hero shots from the real layout ---------------- */
    // each shot: [camera from, target from, camera to, target to] in metres, a lens, and a caption
    function shots() {
      const list = [];
      const add = (id, title, text, s, f, fov = 32) => { if (!s) return; const k = f(s); list.push({ id, title, text, from: [k[0], k[1]], to: [k[2], k[3]], fov }); };
      add('plant', 'Plant EG-01, live', 'One model of the whole plant: six main lines fed by LCM, SMD, injection, press and cushion lines. Every machine, vehicle and person moves with the simulation.', { x: LW / 2, z: LD / 2, y: 0 },
        s => [[s.x + 70, 128, s.z + 170], [s.x, 0, s.z + 4], [s.x + 40, 96, s.z + 128], [s.x, 0, s.z]], 30);
      add('smd', 'SMD: main boards', 'Boards are printed with solder paste, inspected, populated by the mounters from their feeder banks, reflow-soldered and checked by optical inspection.', st('mounter'),
        s => [[s.x - 7, s.y + 2.1, s.z + 3.4], [s.x + 9, s.y + 1.0, s.z - 0.4], [s.x - 3.5, s.y + 1.9, s.z + 3.1], [s.x + 10, s.y + 1.0, s.z - 0.4]], 40);
      add('robot', 'Robot cells', 'Six-axis robots load panel modules behind welded-mesh guarding. Each move eases in and out, and a stopped cell holds its pose.', st('robot') || st('lcmload'),
        s => [[s.x + 3.6, s.y + 1.2, s.z + 3.6], [s.x - 0.3, s.y + 1.5, s.z], [s.x + 2.2, s.y + 1.1, s.z + 4.3], [s.x - 0.3, s.y + 1.5, s.z]], 38);
      add('injection', 'Injection moulding', 'Back covers and stands are moulded on site: clamp, barrel and hopper dryer, with the sprue robot over the mould.', st('injection'),
        s => [[s.x + s.w * 0.7 + 3, 2.6, s.z + s.d + 4.5], [s.x, 1.3, s.z], [s.x + s.w * 0.4 + 2, 2.3, s.z + s.d + 5.5], [s.x - 0.6, 1.3, s.z]], 36);
      add('press', 'Press and coating', 'Chassis are stamped on the presses, then coated and cured in the oven tunnel before they go to the main lines.', st('press'),
        s => [[s.x + s.w * 0.5 + 6, 2.2, s.z + s.d / 2 + 9], [s.x, 2.6, s.z], [s.x + s.w * 0.5 + 3.5, 2.0, s.z + s.d / 2 + 10], [s.x, 2.6, s.z]], 36);
      add('main', 'Main lines', 'Operators build the TV at each station: main board, panel module, back cover and stand, with parts in totes at hand and the work instruction in view.', st('bench', s => lineKind(s) === 'main'),
        s => [[s.x - 9, 1.75, s.z + 2.8], [s.x + 10, 1.1, s.z], [s.x - 4.5, 1.7, s.z + 2.6], [s.x + 12, 1.1, s.z]], 42);
      add('aging', 'Aging and test', 'Every set runs lit on the aging racks, then the function test and the final quality check decide whether it ships or goes to rework.', st('aging'),
        s => [[s.x + s.w / 2 + 3.5, s.y + 2.3, s.z + 4.2], [s.x, s.y + 1.5, s.z], [s.x + s.w / 2 + 1.5, s.y + 2.0, s.z + 4.8], [s.x - 1, s.y + 1.5, s.z]], 36);
      add('ship', 'Packing and shipping', 'Packed sets are palletised, wrapped and loaded at the docks against the customer orders.', st('palletizer'),
        s => [[s.x + 7, 3.8, s.z + 7], [s.x, 1.2, s.z], [s.x + 5, 3.2, s.z + 8], [s.x, 1.2, s.z]], 36);
      // the most urgent live problem, if any, with its cause and its fix drawn on the floor
      const r = P.recs.find(x => x.level === 'crit') || P.recs.find(x => x.level === 'warn'), p = r && V.posOfRef(r.ref);
      if (p) list.push({ id: 'problem', title: 'A live problem, and its fix', text: tt(r.title) + ' · ' + tt('The agents raised it; the ring marks it, the arc shows the cause, the green route shows the fix on its way.'), from: [[p[0] + 13, Math.min(p[1] + 7, 9.5), p[2] + 15], [p[0], p[1] - 1.5, p[2]]], to: [[p[0] + 9, Math.min(p[1] + 5, 8.5), p[2] + 12], [p[0], p[1] - 1.5, p[2]]], fov: 34, raw: true });
      return list;
    }

    /* ---------------- presentation ---------------- */
    const view = $('#view3d');
    const ui = document.createElement('div'); ui.className = 'pl-present'; ui.hidden = true; ui.setAttribute('role', 'region'); ui.setAttribute('aria-label', tt('Presentation'));
    ui.innerHTML = `<span class="pp-brand" aria-hidden="true"><span class="logo-mark"></span><b>Digital Factory</b><small>Plant EG-01</small></span><div class="pp-cap"><span class="pp-n"></span><h2 class="pp-t"></h2><p class="pp-x"></p><div class="pp-bar" aria-hidden="true"><i></i></div></div>
      <div class="pp-ctl">
        <button type="button" class="btn btn-secondary btn-sm" data-pp="prev"><span data-icon="skip" class="flip"></span><span class="sr-only">${tt('Previous shot')}</span></button>
        <button type="button" class="btn btn-secondary btn-sm" data-pp="play" aria-pressed="true"><span data-icon="pause"></span><span class="sr-only">${tt('Pause')}</span></button>
        <button type="button" class="btn btn-secondary btn-sm" data-pp="next"><span data-icon="skip"></span><span class="sr-only">${tt('Next shot')}</span></button>
        <button type="button" class="btn btn-primary btn-sm" data-pp="exit"><span data-icon="minimize"></span>${tt('Leave')}</button>
      </div><p class="sr-only pp-live" aria-live="polite"></p>`;
    view.appendChild(ui);
    const ICON = n => (typeof Icons !== 'undefined' ? Icons.get(n) : '');
    ui.querySelectorAll('[data-icon]').forEach(n => { n.innerHTML = ICON(n.dataset.icon); });
    const S = { on: false, i: 0, t: 0, list: [], playing: true, prevMode: null, prevOverlay: null, timer: 0, last: 0 };
    const cap = { n: ui.querySelector('.pp-n'), t: ui.querySelector('.pp-t'), x: ui.querySelector('.pp-x'), bar: ui.querySelector('.pp-bar i'), live: ui.querySelector('.pp-live') };
    const playBtn = ui.querySelector('[data-pp="play"]');

    function show(i) {
      S.i = (i + S.list.length) % S.list.length; S.t = 0;
      const sh = S.list[S.i];
      V.camTo(sh.from[0], sh.from[1], still ? 0.01 : 2.6, sh.fov);
      S.drift = false;
      cap.n.textContent = `${String(S.i + 1).padStart(2, '0')} / ${String(S.list.length).padStart(2, '0')}`;
      cap.t.textContent = tt(sh.title); cap.x.textContent = sh.raw ? sh.text : tt(sh.text);
      ui.querySelector('.pp-cap').classList.remove('in'); void ui.offsetWidth; ui.querySelector('.pp-cap').classList.add('in');
      cap.live.textContent = cap.t.textContent + '. ' + cap.x.textContent;
    }
    function tick(now) {
      if (!S.on) return;
      const dt = S.last ? Math.min(0.1, (now - S.last) / 1000) : 0; S.last = now;
      if (S.playing) {
        S.t += dt;
        const sh = S.list[S.i];
        // after the move in, drift slowly to the second framing while the caption reads
        if (!S.drift && S.t > (still ? 0.1 : 2.7)) { S.drift = true; if (!still) V.camTo(sh.to[0], sh.to[1], HOLD - 2.7); }
        if (S.t >= HOLD) show(S.i + 1);
      }
      cap.bar.style.transform = `scaleX(${Math.min(1, S.t / HOLD)})`;
      S.timer = requestAnimationFrame(tick);
    }
    function setPlaying(v) { S.playing = v; playBtn.setAttribute('aria-pressed', String(v)); const ic = playBtn.querySelector('[data-icon]'); ic.dataset.icon = v ? 'pause' : 'play'; ic.innerHTML = ICON(ic.dataset.icon); playBtn.querySelector('.sr-only').textContent = tt(v ? 'Pause' : 'Play'); }
    function enter() {
      if (S.on) return;
      if (V.cinematic) V.setCinematic(false); if (V.walking) V.setWalk(false);
      S.on = true; S.list = shots(); S.prevMode = V.mode; S.prevOverlay = V.overlay;
      document.body.classList.add('pl-presenting'); ui.hidden = false;
      if (V.overlay !== 'status') V.setOverlay('status');
      // a meeting-room screen: Ultra unless the device is a phone (the Light mode stays light)
      if (S.prevMode === 'standard' && !matchMedia('(pointer: coarse)').matches) V.setMode('ultra');
      V.setPresent(true); V.resize();
      try { if (document.fullscreenEnabled && !document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {}); } catch (er) { /* no fullscreen */ }
      setPlaying(true); S.last = 0; show(0); S.timer = requestAnimationFrame(tick);
      ui.querySelector('[data-pp="next"]').focus();
      emit();
    }
    function leave() {
      if (!S.on) return;
      S.on = false; cancelAnimationFrame(S.timer);
      document.body.classList.remove('pl-presenting'); ui.hidden = true;
      V.setPresent(false); V.setFov(); if (S.prevMode && V.mode !== S.prevMode) V.setMode(S.prevMode); if (S.prevOverlay && S.prevOverlay !== V.overlay) V.setOverlay(S.prevOverlay);
      V.view('overview'); V.resize();
      try { if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); } catch (er) { /* no fullscreen */ }
      const b = document.querySelector('[data-nav="present"]'); if (b) b.focus();
      emit();
    }
    const emit = () => { const b = document.querySelector('[data-nav="present"]'); if (b) b.setAttribute('aria-pressed', String(S.on)); };
    ui.addEventListener('click', e => {
      const b = e.target.closest('[data-pp]'); if (!b) return;
      const k = b.dataset.pp;
      if (k === 'exit') leave(); else if (k === 'next') show(S.i + 1); else if (k === 'prev') show(S.i - 1); else if (k === 'play') setPlaying(!S.playing);
    });
    document.addEventListener('keydown', e => {
      if (!S.on) return;
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); leave(); }
      else if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); e.stopPropagation(); show(S.i + (document.dir === 'rtl' && e.key === 'ArrowRight' ? -1 : 1)); }
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); e.stopPropagation(); show(S.i + (document.dir === 'rtl' && e.key === 'ArrowLeft' ? 1 : -1)); }
      else if (e.key === ' ' && !e.target.closest('button')) { e.preventDefault(); e.stopPropagation(); setPlaying(!S.playing); }
      else if (/^(w|a|s|d|f|g|r|c|x|\?|[1-9])$/i.test(e.key)) e.stopPropagation();   // the page's shortcuts wait until the presentation ends
    }, true);
    document.addEventListener('fullscreenchange', () => { if (S.on) V.resize(); });
    window.PlantPresent = { enter, leave, toggle: () => (S.on ? leave() : enter()), get on() { return S.on; }, get shot() { return S.on ? S.list[S.i].id : null; }, go: i => S.on && show(i), shots };
  }
  start();
})();
