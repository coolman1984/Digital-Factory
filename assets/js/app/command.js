/* Digital Factory — command room: KPI strip, agent crew, decisions, top alarms, event stream, action buttons. */
(function () {
  'use strict';
  const { $, fmt, pct, money, esc, icon } = DF;
  const STATUS = { watching: 'Watching', thinking: 'Thinking', waiting: 'Needs approval', acting: 'Acting now' };

  DF.renderKpis = function () {
    const S = Sim.state;
    const snap = DF.replay != null ? S.history[DF.replay] : null;
    const oee = snap ? snap.oee : S.oee, fpy = snap ? snap.fpy : S.fpy;
    const kO = $('#kOee'); kO.textContent = pct(oee);
    kO.style.color = oee >= 0.85 ? 'var(--success)' : oee >= 0.75 ? 'var(--warning)' : 'var(--danger)';
    $('#kOeeS').textContent = oee >= 0.85 ? 'At benchmark (85%+)' : oee >= 0.75 ? 'Below 85% benchmark' : 'A line is stopped';
    const u = snap ? snap.units : Sim.unitsToday(), p = Sim.planToday();
    $('#kUnits').textContent = fmt(u);
    const d = (u / p - 1) * 100;
    $('#kUnitsS').innerHTML = `Plan ${fmt(p)} · <span class="${d >= 0 ? 'ok-text' : 'danger-text'}">${d >= 0 ? '+' : ''}${d.toFixed(1)}%</span>`;
    const f = Sim.forecast();
    const kF = $('#kFc'); kF.textContent = Math.round(f.prob * 100) + '%';
    kF.style.color = f.prob >= 0.8 ? 'var(--success)' : f.prob >= 0.5 ? 'var(--warning)' : 'var(--danger)';
    $('#kFcS').textContent = `chance to hit plan · P50 ${fmt(f.p50)}`;
    $('#kFpy').textContent = pct(fpy);
    $('#kFpy').style.color = fpy > 0.985 ? '' : 'var(--warning)';
    const open = S.alarms.filter(a => a.state !== 'cleared');
    const n = snap ? snap.alarms : open.length;
    $('#kAlarms').textContent = n;
    $('#kAlarms').style.color = open.some(a => a.prio === 1) ? 'var(--danger)' : '';
    const inc = S.incidents.filter(i => i.open).length;
    $('#kAlarmsS').textContent = inc ? `${inc} incident${inc > 1 ? 's' : ''} · AI grouped` : `${open.filter(a => a.state === 'active').length} not acknowledged`;
    $('#kSaved').textContent = money(S.saved);
    const acts = S.agents.reduce((a, g) => a + g.actions, 0);
    $('#kSavedS').textContent = `${acts} action${acts === 1 ? '' : 's'} by agents`;
    $('#clock').textContent = snap ? snap.clock : Sim.clock();
    const nb = $('#navAlarms'); const unack = open.filter(a => a.state === 'active' && a.prio <= 2).length;
    nb.hidden = !unack; nb.textContent = unack;
    const wait = S.agents.filter(a => a.status === 'waiting').length;
    const na = $('#navAgents'); na.hidden = !wait; na.textContent = wait;
  };

  DF.renderCrew = function () {
    $('#crew').innerHTML = Sim.state.agents.map(a => `
      <button type="button" class="crew-item ${a.status}" data-agent="${a.id}" title="${esc(a.log[0] ? a.log[0].text : a.scope)}">
        <span class="ci">${icon(a.icon)}<i class="dot"></i></span>
        <span style="min-width:0"><b>${esc(a.name.replace(' agent', ''))}</b><span class="s">${STATUS[a.status]}</span></span>
      </button>`).join('');
  };
  $('#crew').addEventListener('click', e => { if (e.target.closest('.crew-item')) DF.go('agents'); });

  DF.insightHtml = function (i, opts = {}) {
    const ag = i.agent ? Sim.agent(i.agent) : null;
    const acts = (i.actions || []).filter(a => !(opts.skip || []).includes(a.key));
    return `<div class="ins ${i.level}" data-id="${i.id}">
      <div class="it">${icon(i.icon || 'info')}<span>${esc(i.title)}</span><span class="conf">${esc(i.conf || '')}</span></div>
      <div class="ib">${esc(i.body)}</div>
      ${acts.length ? `<div class="ia">${acts.map(a => `<button type="button" class="btn btn-sm ${a.primary ? 'btn-primary' : 'btn-secondary'}" data-act="${a.key}" data-id="${i.id}">${esc(a.label)}</button>`).join('')}</div>` : ''}
      <div class="im">${i.time} · ${ag ? esc(ag.name) : 'AI engine'}${i.risk && i.level !== 'ok' ? ' · ' + money(i.risk) + ' at stake' : ''}</div>
    </div>`;
  };
  DF.renderInsights = function () {
    const list = Sim.state.insights;
    $('#insights').innerHTML = list.length ? list.map(i => DF.insightHtml(i)).join('') : '<div class="empty-row">All lines nominal. The agents are watching 31 machines and 2,400 signals.</div>';
    const waiting = list.filter(i => i.actions && i.actions.some(a => a.primary) && i.level !== 'ok').length;
    const c = $('#decCount'); c.textContent = waiting ? `${waiting} waiting` : 'none waiting';
    c.className = 'chip ' + (waiting ? 'chip-warning' : 'chip-success');
  };

  DF.alarmRow = a => `<div class="al-row ${a.state === 'active' ? 'active-unack' : ''}"><span class="prio p${a.prio}">P${a.prio}</span><span class="msg">${esc(a.msg)}<small>${a.time} · ${esc(a.area)} · ${esc(a.tag)}${a.incident ? ' · grouped' : ''}</small></span>${a.state === 'active' ? `<button type="button" class="btn btn-secondary btn-sm" data-ack="${a.id}">Ack</button>` : '<span class="chip chip-neutral">Ack</span>'}</div>`;
  DF.renderAlarmStrip = function () {
    const S = Sim.state;
    const open = S.alarms.filter(a => a.state !== 'cleared' && !a.shelved).sort((a, b) => a.prio - b.prio || b.real - a.real);
    const incs = S.incidents.filter(i => i.open);
    let html = '';
    incs.slice(0, 1).forEach(i => { html += `<div class="al-row" style="background:var(--danger-soft)"><span class="prio p1">${icon('layers', 'icon-xs')}</span><span class="msg"><b>${esc(i.title)}</b><small>${i.members.length + 1} alarms grouped · cause: ${esc(i.cause)}</small></span><button type="button" class="btn btn-secondary btn-sm" data-go="alarms">Open</button></div>`; });
    html += open.filter(a => !a.incident).slice(0, 4).map(DF.alarmRow).join('');
    $('#alarmStrip').innerHTML = html || '<div class="empty-row">No active alarms.</div>';
  };

  DF.addEvent = function (e) {
    const el = document.createElement('div');
    el.className = 'ev';
    const c = e.level === 'crit' ? 'danger-text' : e.level === 'warn' ? '' : '';
    el.innerHTML = `<span class="tm2">${e.time}</span><span class="src ${c}" style="${e.src === 'AI' ? 'color:var(--indigo)' : e.level === 'warn' ? 'color:var(--warning-text)' : e.level === 'crit' ? 'color:var(--danger-text)' : 'color:var(--brand-text)'}">${esc(e.src)}</span><span>${esc(e.msg)}</span>`;
    const list = $('#events'); list.prepend(el);
    while (list.children.length > 40) list.lastChild.remove();
  };

  // every action button in the app goes through here
  document.addEventListener('click', e => {
    const ack = e.target.closest('[data-ack]');
    if (ack) { Sim.ackAlarm(+ack.dataset.ack); return; }
    const go = e.target.closest('[data-go]');
    if (go) { DF.go(go.dataset.go); return; }
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const key = b.dataset.act, id = +b.dataset.id;
    const ins = Sim.state.insights.find(i => i.id === id);
    const nav = { quality: 'quality', energy: 'energy', alarms: 'alarms', rootcause: 'rootcause', simulator: 'simulator' };
    if (key === 'inspect') { if (ins && ins.station) { DF.go('command'); DF.selectStation(ins.station); } return; }
    if (nav[key]) { if (key === 'rootcause' && ins) DF.rcFocus = ins.scenario; DF.go(nav[key]); return; }
    b.disabled = true; b.textContent = 'Executing…';
    Sim.act(id, key, 'You');
  });
})();
