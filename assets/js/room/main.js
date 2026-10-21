/* Digital Factory — command room wiring: boot the shared twin and the agent crew, the frame loop (twin clock, mimic,
   readouts, views), speed control, keyboard, menu and the embedded mode used by the presentation. Simulated data. */
(async function () {
  'use strict';
  const { $, $$ } = DF;
  const T = window.Twin, A = window.Agents, PE = window.PlantEngine;
  const embed = /[?&]embed=1/.test(location.search);
  if (embed) document.body.classList.add('embed');

  await T.start();
  let booted = false;
  T.on(t => { if (t === 'world' && booted) location.reload(); });   // re-synced from another tab: rebuild on the new world
  A.start();
  DF.initMimic();
  DF.briefingStart();
  addEventListener('hashchange', DF.route);

  /* ---------------- speed ---------------- */
  function speedUi() {
    const v = T.speed;
    $$('#speed button').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.speed === v)));
    DF.tmSync && DF.tmSync();
  }
  $$('#speed button').forEach(b => { b.onclick = () => { T.setSpeed(+b.dataset.speed); speedUi(); }; });
  T.on(t => { if (t === 'speed') speedUi(); });
  speedUi();

  /* ---------------- the frame loop ---------------- */
  let last = performance.now(), acc = 0, acc2 = 0, accTm = 0;
  let mimicOn = true;
  if ('IntersectionObserver' in window) new IntersectionObserver(es => { mimicOn = es[0].isIntersecting; }).observe($('#floor'));
  function frame(now) {
    const dt = Math.min(0.25, (now - last) / 1000); last = now;
    T.frame();
    if (DF.view === 'command' && mimicOn && !document.hidden) DF.drawMimic();
    acc += dt; acc2 += dt; accTm += dt;
    if (acc > 0.25) {
      acc = 0;
      DF.renderReadouts();
      const P = DF.world();
      $('#clock').textContent = PE.clockS(P.t);
      const k = (P.t - T.E.SHIFT_START) / (T.E.SHIFT_END - T.E.SHIFT_START);
      $('#shiftBar').style.width = (Math.max(0, Math.min(1, k)) * 100).toFixed(1) + '%';
      $('#shiftLabel').textContent = P.t < T.E.SHIFT_END ? 'Shift A' : 'After shift A';
    }
    if (acc2 > 1) {
      acc2 = 0;
      DF.renderSay();
      DF.refresh();
      DF.runForecast();
    }
    if (accTm > 0.5) { accTm = 0; DF.tmCapture(); if (!$('#tm').hidden) DF.tmSync(); }
    requestAnimationFrame(frame);
  }

  /* agents and plant events re-render the parts that show them, at most a few times a second */
  let pend = null;
  const soon = () => { if (pend) return; pend = setTimeout(() => { pend = null; if (DF.view === 'command') DF.renderCases(); DF.refresh(); }, 250); };
  A.on(t => { if (t === 'change' || t === 'case' || t === 'step' || t === 'awaiting' || t === 'acted' || t === 'closed' || t === 'host') soon(); });
  A.on((t, c) => {
    if (embed) return;
    if (t === 'awaiting') DF.toast(`${CaseUI.agentName(c.agent)} needs you: ${c.title}`, 'warning');
    if (t === 'acted' && c.autonomy === 'auto') DF.toast(`${CaseUI.agentName(c.agent)} acted on its own: ${c.decision.label}`, 'info');
    if (t === 'closed' && c.decision && c.outcome && c.outcome.ok) DF.toast(`${c.id} verified: ${c.outcome.verdict}`, 'success');
  });
  T.on(t => { if (t === 'alarms' || t === 'scenario') soon(); });
  T.on((t, n) => { if (t === 'catching') document.body.classList.toggle('catching', !!n); });

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
    else if (k === 'p') DF.pinMoment();
    else if (e.key === ' ' && e.target === document.body) { e.preventDefault(); T.setSpeed(T.paused ? 1 : 0); speedUi(); }
    else if (k === 'escape') { if (window.Copilot) Copilot.close(); if (DF.sel) DF.select(null); }
    else if (/^[1-9]$/.test(k)) DF.go(KEYS[+k - 1]);
  });
  addEventListener('themechange', () => requestAnimationFrame(() => DF.refresh(true)));

  /* ---------------- go ---------------- */
  DF.route();
  DF.renderReadouts(); DF.renderSay(); DF.renderCases();
  requestAnimationFrame(frame);
  setTimeout(() => DF.runForecast(true), 2500);
  booted = true;
  const boot = $('#boot');
  if (boot) { boot.classList.add('done'); setTimeout(() => boot.remove(), 600); }
  if (!embed) {
    if (T.restored === 'tab') DF.toast('Joined the plant already running in another tab', 'info');
    else if (T.restored === 'saved') DF.toast(`Continuing the plant from your last visit (${PE.clock(T.E.P.t)}). Drills → New shift starts over.`, 'info');
  }
  window.Room = { T, A, DF };   // for the console and tests
})();
