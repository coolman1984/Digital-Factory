/* Digital Factory — command room wiring: boot Plant EG-01 (the same engine, enterprise layer and agent crew as the 3D
   plant), the frame loop (plant clock, mimic, readouts, views), speed control, the time machine, keyboard, menu and the
   embedded mode used by the presentation. Simulated data. */
(function () {
  'use strict';
  const { $, $$, esc, fmt, pct, tween, html } = DF;
  const embed = /[?&]embed=1/.test(location.search);
  if (embed) document.body.classList.add('embed');

  /* ---------------- the plant ---------------- */
  const E = PlantEngine.create();
  const X = PlantERP.create(E);
  const AG = PlantAgents.create(E, X);
  const P = E.P;
  Object.assign(DF, { E, X, AG, P, world: () => P });
  addEventListener('hashchange', DF.route);

  /* ---------------- speed ---------------- */
  function speedUi() { $$('#speed button').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.speed === (P.paused ? 0 : P.speed)))); }
  function setSpeed(v) { if (tm && v > 0) tmStop(); E.setSpeed(v); speedUi(); }
  $$('#speed button').forEach(b => { b.onclick = () => setSpeed(+b.dataset.speed); });
  DF.setSpeed = setSpeed;

  /* ---------------- readouts and the live sentence ---------------- */
  const cls = (id, c) => { const el = $('#' + id).closest('.ro'); el.classList.toggle('warn', c === 'warn'); el.classList.toggle('bad', c === 'bad'); };
  DF.renderReadouts = function () {
    const k = P.kpi, H = P.hist, set = (id, v, f) => tween($('#' + id), v, f);
    set('kOee', k.oee || 0, v => pct(v));
    $('#kOeeS').textContent = (k.oee || 0) >= 0.85 ? 'Main lines · at or above the 85% benchmark' : 'Main lines · 30-minute window · benchmark 85%';
    cls('kOee', (k.oee || 0) < 0.7 ? 'bad' : (k.oee || 0) < 0.8 ? 'warn' : '');
    html($('#kOeeT'), Viz.spark(H.oee.slice(-60), { lo: 0.6, hi: 1 }));
    set('kUnits', k.units || 0, fmt);
    const gap = (k.units || 0) - (k.plan || 0);
    $('#kUnitsS').textContent = `TVs · plan ${fmt(k.plan)} · ${gap >= 0 ? fmt(gap) + ' ahead' : fmt(-gap) + ' behind'}`;
    cls('kUnits', gap < -150 ? 'warn' : '');
    html($('#kUnitsT'), Viz.spark(H.tph.slice(-60)));
    set('kFc', k.prob || 0, v => Math.round(v * 100) + '%');
    $('#kFcS').textContent = `Forecast ${fmt(k.fcst)} by ${E.clock(k.shiftEnd || 14 * 3600)} · plan ${fmt(k.planEnd)}`;
    cls('kFc', (k.prob || 0) < 0.5 ? 'bad' : (k.prob || 0) < 0.8 ? 'warn' : '');
    html($('#kFcT'), AG.base ? `<span class="muted small">${AG.base.late ? AG.base.late + ' order' + (AG.base.late > 1 ? 's' : '') + ' at risk' : 'no order at risk'}</span>` : '');
    set('kFpy', k.fpy || 0, v => pct(v, 2));
    cls('kFpy', (k.fpy || 1) < 0.97 ? 'bad' : (k.fpy || 1) < 0.985 ? 'warn' : '');
    const open = P.alarms.filter(a => !(a.shelvedTo > P.t)), unack = open.filter(a => a.state !== 'ack'), urgent = open.filter(a => a.prio <= 2);
    set('kAlarms', open.length, fmt);
    $('#kAlarmsS').textContent = `${unack.length} not acknowledged · ${urgent.length} priority 1–2`;
    cls('kAlarms', urgent.length ? 'bad' : open.length ? 'warn' : '');
    set('kSaved', P.saved || 0, v => X.egp(v));
    $('#kSavedS').textContent = `${fmt(P.audit.length)} decisions · ${fmt(AG.stats.auto)} by agents on their own`;
    const nb = $('#navAlarms'); nb.hidden = !unack.length; nb.textContent = unack.length;
    const na = $('#navAgents'); na.hidden = !P.recs.length; na.textContent = P.recs.length;
  };
  DF.renderSay = function () {
    const M = E.MODELS, k = P.kpi, mains = Object.values(P.lines).filter(L => L.kind === 'main');
    const down = P.stations.filter(s => s.state === 'down');
    let s;
    if (tm) s = `<span class="warn">Replaying ${E.clockS(P.t)}.</span> The plant waits until you go back to live.`;
    else if (P.recs.length) { const r = P.recs[0], c = AG.cards.get(r.key); s = `<span class="warn">${P.recs.length} decision${P.recs.length > 1 ? 's wait' : ' waits'} for you.</span> First: <b>${esc(r.title)}</b>${c && c.best ? `; the ${esc(c.agentName)} recommends ${esc(c.best.label.toLowerCase())}` : ''}.`; }
    else if (down.length) s = `<span class="bad">${esc(down[0].name)} on ${esc(P.lines[down[0].line] ? P.lines[down[0].line].name : down[0].line)} stopped</span>${down[0].why ? ': ' + esc(down[0].why) : ''}${down.length > 1 ? `, and ${down.length - 1} more` : ''}.`;
    else s = `${mains.filter(L => L.state === 'run' || L.state === 'warn').length} of 6 main lines running. <b>${fmt(k.units)}</b> TVs packed against a plan of ${fmt(k.plan)}; ${Math.round((k.prob || 0) * 100)}% chance to reach ${fmt(k.planEnd)} by ${E.clock(k.shiftEnd || 14 * 3600)}.`;
    html($('#viewSay'), s);
    $('#stamp').textContent = `${E.clockS(P.t)} · shift ${P.shift ? P.shift.name : 'A'} · ${mains.map(L => M[L.model].name).filter((v, i, a) => a.indexOf(v) === i).join(', ')}`;
  };

  /* ---------------- the time machine: machine states, vehicles and readouts of the last 45 minutes ---------------- */
  let tm = null;
  const tmBar = $('#tm'), tmR = $('#tmRange'), tmL = $('#tmLabel'), tmBtn = $('#tmBtn');
  const fleet = () => P.agvs.concat(P.tuggers, P.forklifts);
  DF.tmOpen = function () {
    if (tm) return tmStop();
    if (P.snaps.length < 2) { DF.toast('Nothing to replay yet: the plant keeps a snapshot every 20 seconds.', 'info'); return; }
    tm = { speed: P.speed, paused: P.paused, t: P.t, st: P.stations.map(s => [s.state, s.why, s.since]), veh: fleet().map(v => [v.x, v.z, v.h]), kpi: Object.assign({}, P.kpi), i: P.snaps.length - 1 };
    E.setSpeed(0); speedUi();
    tmR.max = String(P.snaps.length - 1); tmR.value = tmR.max;
    tmBar.hidden = false; tmBtn.setAttribute('aria-expanded', 'true'); document.body.classList.add('replaying');
    $('#liveLabel').textContent = 'Replay';
    tmShow(P.snaps.length - 1); tmR.focus();
  };
  function tmShow(i) {
    const sn = P.snaps[i]; if (!sn || !tm) return;
    tm.i = i; P.t = sn.t;
    P.stations.forEach((s, k) => { const v = sn.st[k]; if (v) { s.state = v[0]; s.why = v[1]; s.since = v[2]; } });
    fleet().forEach((v, k) => { const q = sn.veh[k]; if (q) { v.x = q[0]; v.z = q[1]; v.h = q[2]; } });
    Object.assign(P.kpi, sn.kpi);
    tmL.textContent = `Replaying ${E.clockS(sn.t)} · ${Math.round((tm.t - sn.t) / 60)} min ago`;
    DF.renderReadouts(); DF.renderSay(); DF.refresh(true);
  }
  function tmStop() {
    if (!tm) return;
    const R = tm; tm = null;
    P.t = R.t;
    P.stations.forEach((s, k) => { const v = R.st[k]; s.state = v[0]; s.why = v[1]; s.since = v[2]; });
    fleet().forEach((v, k) => { const q = R.veh[k]; if (q) { v.x = q[0]; v.z = q[1]; v.h = q[2]; } });
    Object.assign(P.kpi, R.kpi);
    tmBar.hidden = true; tmBtn.setAttribute('aria-expanded', 'false'); document.body.classList.remove('replaying');
    $('#liveLabel').textContent = 'Live';
    E.setSpeed(R.paused ? 0 : R.speed); speedUi();
    DF.renderReadouts(); DF.renderSay(); DF.refresh(true);
  }
  DF.tmStop = tmStop; DF.replaying = () => !!tm;
  tmBtn.onclick = DF.tmOpen;
  $('#tmLive').onclick = () => { tmStop(); tmBtn.focus(); };
  $('#tmBranch').onclick = () => { tmStop(); DF.go('simulator'); };
  tmR.addEventListener('input', () => tmShow(+tmR.value));
  tmBar.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); tmStop(); tmBtn.focus(); } });
  // anything that changes the plant leaves the replay first
  const apply0 = E.apply, trigger0 = E.trigger, hmi0 = E.hmi, ff0 = E.fastForward;
  E.apply = (...a) => { tmStop(); return apply0(...a); };
  E.trigger = (...a) => { tmStop(); return trigger0(...a); };
  E.hmi = (...a) => { tmStop(); return hmi0(...a); };
  E.fastForward = (...a) => { tmStop(); return ff0(...a); };

  /* ---------------- the frame loop ---------------- */
  let last = performance.now(), acc = 0, acc2 = 0;
  let mimicOn = true;
  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    if (!tm) E.run(dt);
    if (DF.view === 'command' && mimicOn && !document.hidden && DF.drawMimic) DF.drawMimic();
    acc += dt; acc2 += dt;
    if (acc > 0.25) {
      acc = 0;
      DF.renderReadouts();
      $('#clock').textContent = E.clockS(P.t);
      const sh = P.shift || { name: 'A', start: 6 * 3600 }, k = (P.t - sh.start) / (8 * 3600);
      $('#shiftBar').style.width = (Math.max(0, Math.min(1, k)) * 100).toFixed(1) + '%';
      $('#shiftLabel').textContent = 'Shift ' + sh.name;
    }
    if (acc2 > 1) { acc2 = 0; DF.renderSay(); DF.refresh(); }
    requestAnimationFrame(frame);
  }

  /* plant and agent events re-render the parts that show them, at most a few times a second */
  let pend = null;
  const soon = () => { if (pend) return; pend = setTimeout(() => { pend = null; DF.refresh(); }, 250); };
  let lastRecs = 0;
  E.on((t, d) => {
    if (t === 'recs' || t === 'alarms' || t === 'scenario' || t === 'audit' || t === 'hmi') soon();
    if (t === 'toast' && !embed) DF.toast(d.msg, d.level);
    if (t === 'recs' && !embed && P.recs.length > lastRecs) { const r = P.recs[P.recs.length - 1]; if (r) DF.toast(`${r.agent} agent needs you: ${r.title}`, r.level === 'crit' ? 'warning' : 'info'); }
    if (t === 'recs') lastRecs = P.recs.length;
    if (t === 'agentFeed' && d && /Acted on my own|Went ahead/.test(d.text) && !embed) DF.toast(`${d.agent}: ${d.text}`, 'info');
  });

  /* ---------------- menu, keyboard ---------------- */
  // the phone drawer: off-screen links stay out of the tab order until it opens; Escape or a link closes it
  const side = $('#side'), menuBtn = $('#menuBtn'), narrow = matchMedia('(max-width: 960px)');
  function drawer(open) {
    side.classList.toggle('open', open); $('#sideShade').hidden = !open;
    menuBtn.setAttribute('aria-expanded', String(open));
    side.inert = narrow.matches && !open;
    if (open) side.querySelector('a').focus();
  }
  menuBtn.setAttribute('aria-controls', 'side');
  drawer(false);
  narrow.addEventListener('change', () => drawer(false));
  menuBtn.onclick = () => drawer(true);
  $('#sideShade').onclick = () => { drawer(false); menuBtn.focus(); };
  side.addEventListener('click', e => { if (narrow.matches && e.target.closest('a')) drawer(false); });
  side.addEventListener('keydown', e => { if (e.key === 'Escape' && side.classList.contains('open')) { e.stopPropagation(); drawer(false); menuBtn.focus(); } });
  $('#btnCopilot').onclick = () => window.Copilot && Copilot.open();
  const KEYS = ['command', 'alarms', 'control', 'agents', 'predict', 'rootcause', 'simulator', 'scenarios', 'leadership'];
  addEventListener('keydown', e => {
    if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName) || e.metaKey || e.ctrlKey || e.altKey) return;
    if (document.querySelector('dialog[open]')) return;
    // inside the presentation, slide keys belong to the deck
    if (embed && parent !== window && ['ArrowRight', 'ArrowLeft', 'PageDown', 'PageUp', 'f', 'F', 'n', 'N', 'b', 'B'].includes(e.key)) {
      e.preventDefault(); parent.postMessage({ dfDeckKey: e.key }, location.origin); return;
    }
    const k = e.key.toLowerCase();
    if (k === 'c') { e.preventDefault(); window.Copilot && Copilot.open(); }
    else if (k === 't' && window.Theme) Theme.toggle();
    else if (k === 'm') DF.tmOpen();
    else if (k === 'p') DF.pinMoment && DF.pinMoment();
    else if (e.key === ' ' && e.target === document.body) { e.preventDefault(); setSpeed(P.paused ? 1 : 0); }
    else if (k === 'escape') { if (tm) tmStop(); else { if (window.Copilot) Copilot.close(); if (DF.sel && DF.select) DF.select(null); } }
    else if (/^[1-9]$/.test(k)) DF.go(KEYS[+k - 1]);
  });
  addEventListener('themechange', () => requestAnimationFrame(() => DF.refresh(true)));

  /* ---------------- go ---------------- */
  speedUi();
  DF.boot.forEach(f => f());
  if (DF.initMimic) DF.initMimic();
  if (DF.briefingStart) DF.briefingStart();
  if ('IntersectionObserver' in window && $('#floor')) new IntersectionObserver(es => { mimicOn = es[0].isIntersecting; }).observe($('#floor'));
  DF.route();
  DF.renderReadouts(); DF.renderSay();
  requestAnimationFrame(frame);
  const boot = $('#boot');
  if (boot) { boot.classList.add('done'); setTimeout(() => boot.remove(), 600); }
  window.Room = { E, X, AG, DF };   // for the console and tests
})();
