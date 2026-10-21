/* Digital Factory — wiring: view hooks, simulation events, render loop, time machine, keyboard, mobile menu. */
(function () {
  'use strict';
  const { $ } = DF;
  if (/[?&]embed=1/.test(location.search)) document.body.classList.add('embed');

  DF.onView('command', () => { DF.renderInsights(); DF.renderCrew(); DF.renderAlarmStrip(); DF.renderStation(true); });
  DF.onView('leadership', rebuild => DF.renderLeadership(rebuild));
  DF.onView('agents', () => { DF.renderAgents(); DF.renderAudit(); });
  DF.onView('alarms', () => DF.renderAlarms());
  DF.onView('predict', () => DF.renderPredict());
  DF.onView('rootcause', () => DF.renderRootCause());
  DF.onView('scenarios', () => DF.renderScenarios());
  DF.onView('control', rebuild => { DF.renderControl(rebuild); DF.renderAudit(); });
  DF.onView('maintenance', rebuild => { DF.renderMachines(rebuild); DF.renderWorkOrders(); });
  DF.onView('quality', () => DF.renderPareto());
  DF.onView('energy', () => DF.renderEnergy());
  DF.onView('simulator', () => DF.runSim());
  addEventListener('hashchange', DF.route);

  Sim.on(e => {
    switch (e.type) {
      case 'log': DF.addEvent(e); break;
      case 'toast': DF.toast(e.msg, e.level); break;
      case 'insight': case 'resolve': case 'reset':
        DF.renderInsights();
        if (e.type === 'reset') { DF.renderWorkOrders(); DF.renderPareto(); DF.renderCrew(); DF.renderAlarmStrip(); }
        if (['leadership', 'rootcause', 'energy', 'scenarios'].includes(DF.view)) DF.refresh();
        break;
      case 'workorders': DF.renderWorkOrders(); break;
      case 'agents': DF.renderCrew(); if (DF.view === 'agents') DF.renderAgents(); break;
      case 'alarms': DF.renderAlarmStrip(); if (DF.view === 'alarms') DF.renderAlarms(); break;
      case 'audit': DF.renderAudit(); break;
      case 'control': if (DF.view === 'control') DF.renderControl(); break;
    }
  });

  let t = 0, acc = 0, acc2 = 0, acc3 = 0;
  Sim.on(e => {
    if (e.type !== 'tick') return;
    t += e.dt; acc += e.dt; acc2 += e.dt; acc3 += e.dt;
    if (DF.view === 'command') DF.drawFloor(t);
    if (DF.view === 'quality') DF.drawVision(e.dt);
    if (DF.view === 'maintenance' && acc3 > 0.05) { acc3 = 0; DF.drawAcoustic(); }
    if (acc > 0.25) {
      acc = 0; DF.renderKpis();
      if (DF.view === 'command') DF.renderStation();
      if (DF.view === 'quality') $('#qInspected').textContent = DF.fmt(1840 + Sim.line('L1').produced + Sim.line('L2').produced);
      tmSync();
    }
    if (acc2 > 1) {
      acc2 = 0;
      if (DF.view === 'control') DF.renderControl(false, true);
      else if (['leadership', 'predict', 'energy', 'scenarios'].includes(DF.view)) DF.refresh();
      if (DF.view === 'maintenance') DF.renderMachines();
    }
  });

  /* time machine: replay the last minutes of the plant */
  const tm = $('#tm'), range = $('#tmRange');
  function tmSync() {
    const H = Sim.state.history;
    range.max = Math.max(0, H.length - 1);
    if (DF.replay == null) range.value = range.max;
    const live = DF.replay == null;
    $('#liveChip').classList.toggle('replay', !live);
    $('#liveChip').classList.toggle('chip-success', live);
    $('#liveLabel').textContent = live ? 'Live' : 'Replay';
    const s = H[DF.replay != null ? DF.replay : H.length - 1];
    $('#tmLabel').textContent = s ? (live ? `Live · ${s.clock}` : `Replaying ${s.clock} · ${H.length - 1 - DF.replay} s ago`) : '--:--';
  }
  function tmToggle(open) {
    const o = open === undefined ? tm.hidden : open;
    tm.hidden = !o;
    if (!o) DF.replay = null;
    else { DF.go('command'); DF.toast('Time machine: drag the slider to replay the last minutes of the plant', 'info'); }
    tmSync();
  }
  $('#tmBtn').onclick = () => tmToggle();
  $('#tmLive').onclick = () => { DF.replay = null; tmToggle(false); };
  range.addEventListener('input', () => { const v = +range.value; DF.replay = v >= Sim.state.history.length - 1 ? null : v; tmSync(); DF.renderKpis(); });

  /* mobile menu */
  $('#menuBtn').onclick = () => { $('#side').classList.add('open'); $('#sideShade').hidden = false; };
  $('#sideShade').onclick = () => { $('#side').classList.remove('open'); $('#sideShade').hidden = true; };

  /* keyboard */
  const KEYS = ['command', 'alarms', 'control', 'agents', 'predict', 'rootcause', 'scenarios', 'leadership', 'maintenance'];
  addEventListener('keydown', e => {
    if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName) || e.metaKey || e.ctrlKey || e.altKey) return;
    // inside the presentation, slide keys belong to the deck
    if (document.body.classList.contains('embed') && ['ArrowRight', 'ArrowLeft', 'PageDown', 'PageUp', 'f', 'F', 'n', 'N', 'b', 'B'].includes(e.key) && parent !== window) {
      e.preventDefault(); parent.postMessage({ dfDeckKey: e.key }, location.origin); return;
    }
    const k = e.key.toLowerCase();
    if (k === 'c') DF.openCopilot();
    else if (k === 't' && window.Theme) Theme.toggle();
    else if (k === 'm') tmToggle();
    else if (k === 'escape') { DF.openCopilot(false); }
    else if (/^[1-9]$/.test(k)) DF.go(KEYS[+k - 1]);
  });

  addEventListener('themechange', () => requestAnimationFrame(() => DF.refresh()));

  const simSpeed = $('#simSpeed');
  if (simSpeed) {
    simSpeed.addEventListener('click', e => {
      const b = e.target.closest('[data-simspeed]');
      if (!b) return;
      const sp = +b.dataset.simspeed;
      Sim.setSpeed(sp);
      simSpeed.querySelectorAll('[data-simspeed]').forEach(btn => {
        const on = +btn.dataset.simspeed === sp;
        btn.classList.toggle('on', on);
        btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
    });
    simSpeed.querySelectorAll('[data-simspeed]').forEach(btn => {
      const on = btn.classList.contains('on');
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    Sim.on(e => {
      if (e.type !== 'speed') return;
      simSpeed.querySelectorAll('[data-simspeed]').forEach(btn => {
        const on = +btn.dataset.simspeed === e.speed;
        btn.classList.toggle('on', on);
        btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
    });
  }

  Sim.start();
  DF.renderInsights(); DF.renderWorkOrders(); DF.renderPareto(); DF.renderCrew(); DF.renderAlarmStrip(); DF.renderAudit();
  DF.route();
  DF.selectStation('L1-MounterB', true);
})();
