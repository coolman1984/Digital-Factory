/* Digital Factory — command room view: readouts, the plant mimic, the detail panel, the value stream, the cases that
   need a person, the agents at work, the alarm summary, the event stream and today's orders. Simulated data. */
(function () {
  'use strict';
  const { $, $$, esc, icon, fmt, pct, money, signed, link, toRef, stChip, SEV, STATE, html, tween } = DF;
  const PE = window.PlantEngine;
  const T = window.Twin;
  const KINDN = { loader: 'Magazine loader', unloader: 'Magazine unloader', printer: 'Solder paste printer', spi: 'Solder paste inspection', mounter: 'Pick-and-place mounter', reflow: 'Reflow oven, 8 zones', aoi: 'Automated optical inspection', robot: 'Robot cell', bench: 'Manual workstation', bond: 'Display bonding', fct: 'Function tester', burnin: 'Burn-in racks', qc: 'Camera inspection booth', packer: 'Packing machine', palletizer: 'Palletizing robot', repair: 'Repair bench' };
  DF.KINDN = KINDN;

  /* ---------------- readouts (every page) ---------------- */
  DF.renderReadouts = function () {
    const P = DF.world(), k = P.kpi, H = P.hist;
    const set = (id, v, f) => tween($('#' + id), v, f);
    const cls = (id, c) => { const el = $('#' + id).closest('.ro'); el.classList.toggle('warn', c === 'warn'); el.classList.toggle('bad', c === 'bad'); };
    set('kOee', k.oee || 0, v => pct(v));
    $('#kOeeS').textContent = (k.oee || 0) >= 0.85 ? 'At or above the 85% benchmark' : '30-minute window · benchmark 85%';
    cls('kOee', (k.oee || 0) < 0.7 ? 'bad' : (k.oee || 0) < 0.8 ? 'warn' : '');
    html($('#kOeeT'), Viz.spark(H.oee.slice(-60), { lo: 0.6, hi: 1 }));
    set('kUnits', k.units || 0, fmt);
    const gap = (k.units || 0) - (k.plan || 0);
    $('#kUnitsS').textContent = `Plan ${fmt(k.plan)} · ${gap >= 0 ? fmt(gap) + ' ahead' : fmt(-gap) + ' behind'}`;
    cls('kUnits', gap < -40 ? 'warn' : '');
    html($('#kUnitsT'), Viz.spark(H.packed.slice(-60)));
    const f = DF.forecastNow();
    set('kFc', f.prob, v => Math.round(v * 100) + '%');
    $('#kFcS').textContent = f.sim ? `P50 ${fmt(f.p50)} at 14:00 · plan ${fmt(f.plan)}` : `Estimate from the current rate · plan ${fmt(f.plan)}`;
    cls('kFc', f.prob < 0.5 ? 'bad' : f.prob < 0.8 ? 'warn' : '');
    html($('#kFcT'), f.sim ? `<span class="muted small">${f.n} futures</span>` : '');
    set('kFpy', k.fpy || 0, v => pct(v));
    cls('kFpy', (k.fpy || 1) < 0.97 ? 'bad' : (k.fpy || 1) < 0.985 ? 'warn' : '');
    const open = P.alarms.filter(a => !(a.shelvedTo > P.t));
    const unack = open.filter(a => a.state === 'active').length, urgent = open.filter(a => a.prio <= 2).length;
    set('kAlarms', open.length, fmt);
    $('#kAlarmsS').textContent = `${unack} not acknowledged · ${P.alarmStats.rate10} in 10 min${P.alarmStats.flood ? ' · flood' : ''}`;
    cls('kAlarms', urgent ? 'bad' : open.length ? 'warn' : '');
    const A = window.Agents.S;
    set('kSaved', A.value, money);
    const acts = A.agents.reduce((a, g) => a + g.actions, 0), ver = A.agents.reduce((a, g) => a + g.verified, 0), acc = A.agents.reduce((a, g) => a + g.accurate, 0);
    $('#kSavedS').textContent = `${acts} action${acts === 1 ? '' : 's'} · ${ver ? Math.round(acc / ver * 100) + '% verified right' : 'verified against the twin'}`;
    // badges
    const nb = $('#navAlarms'); nb.hidden = !unack; nb.textContent = unack;
    const wait = window.Agents.waiting().length, na = $('#navAgents'); na.hidden = !wait; na.textContent = wait;
  };

  /* one sentence about the plant, at the top of every view */
  DF.renderSay = function () {
    const P = DF.world(), k = P.kpi;
    const down = P.stations.filter(s => s.state === 'down' || s.state === 'maint');
    const wait = window.Agents.waiting();
    const flood = P.alarmStats.flood;
    const f = DF.forecastNow();
    let s;
    if (DF.replay) s = `Replaying <b>${PE.clockS(P.t)}</b>. The live plant keeps running; this is the twin rebuilt from its own commands.`;
    else if (flood) s = `<span class="bad">Alarm flood:</span> ${P.alarmStats.rate10} alarms in 10 minutes. The agents folded them under ${DF.incidents(P).filter(i => i.open).length || 1} first-out cause${DF.incidents(P).filter(i => i.open).length === 1 ? '' : 's'}.`;
    else if (wait.length) { const c = wait.slice().sort((a, b) => (b.value || 0) - (a.value || 0))[0]; s = `<span class="warn">${wait.length} decision${wait.length > 1 ? 's' : ''} wait for you.</span> First: <b>${esc(c.title)}</b>${c.value > 0 ? `, worth ${money(c.value)} against doing nothing` : ''}.`; }
    else if (down.length) s = `<b>${esc(down[0].name)}</b> on ${esc(P.lines[down[0].line] ? P.lines[down[0].line].name : '')} is ${down[0].state === 'maint' ? 'in planned work' : '<span class="bad">stopped</span>'}: ${esc((down[0].why || '').toLowerCase())}.`;
    else s = `All lines running. <b>${fmt(k.units)}</b> packed against a plan of ${fmt(k.plan)}; ${Math.round(f.prob * 100)}% chance to hit ${fmt(f.plan)} by 14:00${f.sim ? ` across ${f.n} simulated futures` : ''}.`;
    html($('#viewSay'), s);
    const host = window.Agents.host;
    html($('#stamp'), `${esc(PE.clockS(P.t))} · shift A${T.peers || T.restored === 'tab' ? ' · in step with other tabs' : ''}<br>${host ? 'Agents run in this tab' : 'Agents run in another open tab'}`);
  };

  /* ---------------- the mimic ---------------- */
  let F = null;
  DF.initMimic = function () {
    F = Floor.create($('#floor'));
    DF.floor = F;
    const zs = $('#zoneSel');
    zs.innerHTML = '<option value="">Whole plant</option>' + T.E.P.layout.ZONES.map(z => `<option value="${z.id}">${esc(z.name)}</option>`).join('');
    zs.onchange = () => F.zone(zs.value);
    $$('[data-zoom]').forEach(b => { b.onclick = () => (b.dataset.zoom === 'fit' ? (F.fit(), zs.value = '') : F.zoom(b.dataset.zoom === 'in' ? 1.4 : 1 / 1.4)); });
    $$('#ovl .seg').forEach(b => {
      b.onclick = () => { $$('#ovl .seg').forEach(x => { x.classList.toggle('active', x === b); x.setAttribute('aria-pressed', String(x === b)); }); F.setOverlay(b.dataset.ovl); legend(); };
    });
    F.on((t, d) => {
      if (t === 'select') DF.select(d);
      if (t === 'tip') {
        if (!d) return Viz.hideTip();
        const P = DF.world(), r = d.ref, [k, ...rest] = r.split(':'), id = rest.join(':');
        let rows = [];
        if (k === 'st' && P.byId[id]) { const s = P.byId[id]; rows = [{ value: STATE[s.state] || s.state, label: s.why || KINDN[s.kind] || '', cls: 'cm' }]; if (s.sens.vib) rows.push({ value: s.sens.vib.toFixed(1) + ' mm/s', label: 'vibration', cls: 'cm' }); }
        else if (k === 'buf' && P.bufs[id]) { const b = P.bufs[id], lv = T.E.level(b); rows = [{ value: fmt(lv) + ' / ' + fmt(b.cap), label: b.unit || '', cls: 'cm' }]; const rw = T.E.runway(b); if (isFinite(rw)) rows.push({ value: PE.mins(rw), label: 'runway', cls: 'cm' }); }
        else if (k === 'agv') { const a = P.agvs.find(x => x.id === id); if (a) rows = [{ value: a.fault ? 'Fault' : a.state, label: a.mission ? a.mission.buf.label : 'no mission', cls: a.fault ? 'bad' : 'cm' }, { value: Math.round(a.battery) + '%', label: 'battery', cls: 'cm' }]; }
        else if (k === 'util') { const a = P.util.assets.find(x => x.id === id); if (a) rows = [{ value: Math.round(a.kw) + ' kW', label: a.on === false ? 'off' : 'on', cls: 'cm' }]; }
        else if (k === 'order') { const o = P.orders.find(x => x.id === id); if (o) rows = [{ value: `${fmt(o.shipped + (o.truck ? o.truck.loaded || 0 : 0))} / ${fmt(o.qty)}`, label: 'loaded', cls: 'cm' }]; }
        Viz.showTip(d.x, d.y, DF.refName(r), rows);
      }
    });
    legend();
  };
  function legend() {
    const o = F ? F.overlay : 'status';
    const L = {
      status: '<span><i></i>Normal</span><span><i class="warn"></i>Slow, starved or blocked</span><span><i class="bad"></i>Stopped</span><span><i class="maint"></i>Planned work or changeover</span><span><i class="dot"></i>Wearing</span>',
      flow: '<span><i class="flow"></i>Units and routes</span><span><i class="warn"></i>Conveyor nearly full</span><span>Dashed lines: AGV routes</span>',
      energy: '<span><i class="flow"></i>Darker means more kW</span><span>Utilities show kW now</span>',
      quality: '<span><i class="warn"></i>Reject share 1–3%</span><span><i class="bad"></i>Above 3%</span>',
      people: '<span><i class="flow" style="border-radius:50%"></i>Operators</span><span><i class="maint" style="border-radius:50%;border-style:solid;background:var(--indigo)"></i>Technicians</span><span><i class="bad" style="border-radius:50%"></i>Inside a robot cell</span>'
    };
    html($('#floorLegend'), L[o]);
  }
  DF.drawMimic = function () {
    if (!F) return;
    F.draw(DF.world(), { speed: T.speed, replay: !!DF.replay });
  };

  /* ---------------- selection and the detail panel ---------------- */
  DF.select = function (ref, o = {}) {
    DF.sel = ref || null;
    if (F) F.select(DF.sel);
    if (F && o.focus && ref) F.focus(DF.world(), ref, 3);
    renderInspector(true);
    vstream();
    if (o.scroll && matchMedia('(max-width: 1200px)').matches) $('#insp').scrollIntoView({ behavior: DF.reduce ? 'auto' : 'smooth', block: 'start' });
  };
  function casesFor(ref) {
    return window.Agents.S.cases.filter(c => c.state !== 'closed' && (c.ref === ref || (c.chain || []).includes(ref)));
  }
  const kv = list => `<dl class="kv">${list.filter(Boolean).map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${v}</dd></div>`).join('')}</dl>`;
  function caseLinks(ref) {
    const cs = casesFor(ref);
    if (!cs.length) return '';
    return `<section class="insp-sec"><h4>Open cases</h4>${cs.map(c => `<p class="small" style="margin:0 0 6px">${link('case:' + c.id, c.title)} · ${esc(CaseUI.agentName(c.agent))}</p>`).join('')}</section>`;
  }
  const acts = (ref, extra = '') => `<div class="acts">${extra}<a class="btn btn-secondary btn-sm" href="plant.html#${esc(ref)}"><span data-icon="layers"></span>Open in 3D</a><button type="button" class="btn btn-secondary btn-sm" data-ask="${esc(ref)}"><span data-icon="sparkles"></span>Ask the copilot</button></div>`;
  function plantNow(P) {
    const k = P.kpi;
    const lines = ['L1', 'L2', 'L3', 'L4', 'L5'].map(id => P.lines[id]);
    const bn = DF.bottleneck(P);
    const risky = P.stations.filter(s => s.degrade > 0 && s.state !== 'down').map(s => s.name);
    const late = P.orders.filter(o => (o.state === 'open' || o.state === 'loading') && o.risk > 300);
    return `<div class="plant-now"><p class="kind">Nothing selected</p><h3>The plant now</h3>
      <p>${lines.map(l => `${link('line:' + l.id, l.name)} ${stChip(l.state === 'stopped' ? 'stopped' : l.state)}`).join('<br>')}</p>
      <p>${bn ? `${bn.over > 1 ? '<span class="warn">Bottleneck:</span>' : 'Constraint:'} <b>${esc(bn.name)}</b> on ${esc(P.lines[bn.line].name)}, ${bn.ct.toFixed(0)} s a unit against a takt of ${T.E.TAKT[bn.line]} s${bn.over > 1 ? ', so the line runs below plan' : ''}.` : 'No assembly station is near its takt.'}</p>
      <p>${risky.length ? `Wearing: <b>${esc(risky.join(', '))}</b>.` : 'No machine shows a wear trend.'} ${late.length ? `Orders at risk: <b>${late.map(o => esc(o.id)).join(', ')}</b>.` : 'Every open order is on time at the current rate.'}</p>
      <p class="small muted">Select anything on the mimic or a step of the value stream. ${fmt(k.wip)} units in process · ${fmt(k.boards)} boards in the supermarket.</p></div>`;
  }
  function stationPanel(P, s) {
    const L = P.lines[s.line];
    const vib = s.hist.vib && s.hist.vib.length > 3;
    const series = vib ? s.hist.vib : s.hist.kw;
    const reg = vib ? window.Agents.linreg(s.hist.vib.slice(-36).filter(v => v > 0.6), 5 / 60) : null;
    return `<div class="row-top"><div><p class="kind">${esc(KINDN[s.kind] || s.kind)} · ${L ? link('line:' + L.id, L.name) : 'Support'}</p><h3>${esc(s.name)}</h3></div></div>
      <p>${stChip(s.state, s.why)} <span class="muted small">since ${esc(PE.clock(s.since))}</span></p>
      ${kv([
        ['Cycle now', `${(s.ctEma || 0).toFixed(1)} s <small>std ${s.base} s</small>`],
        ['Made today', `${fmt(s.counters.made)} <small>${s.counters.bad ? fmt(s.counters.bad) + ' rejected' : 'no rejects'}</small>`],
        s.kind !== 'bench' && s.kind !== 'burnin' && ['Health index', `${Math.round(s.health)} <small>/ 100</small>`],
        s.sens.vib != null && ['Vibration', `${s.sens.vib.toFixed(2)} <small>mm/s${reg ? ` · ${reg.slope > 0 ? '+' : ''}${(reg.slope * 60).toFixed(1)}/h` : ''}</small>`],
        s.sens.temp != null && ['Temperature', `${s.sens.temp.toFixed(1)} <small>°C</small>`],
        ['Power', `${(s.kwNow || 0).toFixed(1)} <small>kW</small>`],
        s.operator && ['Operator', esc(s.operator.name)],
        s.tech && ['Technician', esc(s.tech.name)]
      ])}
      ${series && series.length > 3 ? `<section class="insp-sec"><h4>${vib ? 'Vibration, last 15 min (mm/s)' : 'Power, last 15 min (kW)'}</h4><div class="spark-wide">${Viz.spark(series.slice(-90), { w: 320, h: 56, limit: vib ? 4.5 : undefined })}</div></section>` : ''}
      ${s.needs && s.needs.length ? `<section class="insp-sec"><h4>Material at this station</h4><ul class="list">${s.needs.map(n => { const b = n.b, lv = T.E.level(b); return `<li><span>${link('buf:' + b.id, b.label)}</span><span>${fmt(lv)} / ${fmt(b.cap)} · ${isFinite(T.E.runway(b)) ? PE.mins(T.E.runway(b)) : '—'}</span></li>`; }).join('')}</ul></section>` : ''}
      ${caseLinks('st:' + s.id)}${acts('st:' + s.id)}`;
  }
  function linePanel(P, L) {
    const bn = L.stations.filter(s => s.kind !== 'reflow' && s.kind !== 'burnin').sort((a, b) => (b.gapEma || b.ctEma || 0) - (a.gapEma || a.ctEma || 0))[0];
    return `<p class="kind">${esc(L.sub)}</p><h3>${esc(L.name)}</h3><p>${stChip(L.stopped ? 'stopped' : L.state)}</p>
      ${kv([['OEE', pct(L.oee)], ['Per hour', fmt(L.tph)], ['Availability', pct(L.avail)], ['Performance', pct(L.perf)], ['Quality', pct(L.qual, 2)], ['Speed', Math.round(L.speed * 100) + '%']])}
      <section class="insp-sec"><h4>Stations</h4><ul class="list">${L.stations.map(s => `<li><span>${link('st:' + s.id, s.name)}${bn === s && L.id !== 'L5' ? ' <small class="muted">· slowest</small>' : ''}</span><span>${stChip(s.state)}</span></li>`).join('')}</ul></section>
      ${caseLinks('line:' + L.id)}${acts('st:' + L.stations[0].id, `<a class="btn btn-secondary btn-sm" href="#control"><span data-icon="settings"></span>Control</a>`)}`;
  }
  function bufPanel(P, b) {
    const lv = T.E.level(b), rw = T.E.runway(b), m = b.mission;
    const at = b.station ? P.byId[b.station] : null;
    return `<p class="kind">${b.sm ? 'Board supermarket' : b.rm ? 'Raw-material warehouse' : 'Line-side stock'}</p><h3>${esc(b.label)}</h3>
      ${kv([['Level', `${fmt(lv)} <small>/ ${fmt(b.cap)} ${esc(b.unit || '')}</small>`], ['Runway', isFinite(rw) ? PE.mins(rw) : (b.rw ? PE.mins(b.rw) : 'Not being used')], !b.sm && !b.rm && ['Reorder at', fmt(b.rop)], at && ['Feeds', link('st:' + at.id, at.name)],
        b.sm && ['At the lines', fmt(b.lineSide || 0)], b.sm && ['Demand', `${fmt(b.demand || 0)} <small>/ h</small>`]])}
      <div style="margin-top:12px">${Viz.meter(lv / Math.max(1, b.cap), lv <= (b.rop || 0) ? 'warn' : '')}</div>
      ${m ? `<section class="insp-sec"><h4>Delivery</h4><p class="small">${m.agv ? `${link('agv:' + m.agv.id, m.agv.id)}${m.agv.fault ? ' <span class="st bad"><i></i>faulted</span>' : ''} · ETA ${esc(PE.clock(m.eta || P.t))}` : 'Waiting for a free AGV'} · ${esc(m.reason || 'Kanban')}</p></section>` : ''}
      ${b.lots && b.lots.length ? `<section class="insp-sec"><h4>Lots</h4><ul class="list">${b.lots.map(l => `<li><span>${esc(l.id)}</span><span>${fmt(l.qty)}${l.supplier ? ' · ' + esc(l.supplier) : ''}</span></li>`).join('')}</ul></section>` : ''}
      ${caseLinks('buf:' + b.id)}${acts('buf:' + b.id)}`;
  }
  function agvPanel(P, a) {
    const m = a.mission;
    return `<p class="kind">Automated guided vehicle</p><h3>${esc(a.id)}</h3><p>${a.fault ? `<span class="st bad"><i></i>Fault · ${esc(a.fault)}</span>` : `<span class="st"><i></i>${esc(a.state)}</span>`}</p>
      ${kv([['Battery', `${Math.round(a.battery)}%`], ['Distance today', `${a.km.toFixed(1)} <small>km</small>`], ['Mission', m ? `${esc(m.buf.label)} → ${esc(P.byId[m.buf.station] ? P.byId[m.buf.station].name : '')}` : 'None'], ['Load', a.load ? 'Carrying' : 'Empty']])}
      ${caseLinks('agv:' + a.id)}${acts('agv:' + a.id)}`;
  }
  function orderPanel(P, o) {
    const loaded = o.shipped + (o.truck ? o.truck.loaded || 0 : 0);
    return `<p class="kind">${esc(o.customer)} · ${o.product === 'tv' ? 'TVs' : 'Smartphones'}</p><h3>Order ${esc(o.id)}</h3>
      <p>${o.state === 'late' ? '<span class="st bad"><i></i>Shipped late</span>' : o.risk > 300 ? `<span class="st warn"><i></i>Heading ${esc(PE.mins(o.risk))} late</span>` : `<span class="st"><i></i>${esc(o.state)}</span>`}</p>
      ${kv([['Quantity', fmt(o.qty)], ['Loaded', fmt(loaded)], ['Due', esc(PE.clock(o.due))], ['Ready at current rate', o.eta ? esc(PE.clock(o.eta)) : '—'], o.truck && ['Truck', esc(o.truck.dock ? o.truck.dock.id : '')]])}
      ${caseLinks('order:' + o.id)}${acts('order:' + o.id)}`;
  }
  function utilPanel(P, a) {
    const amb = P.util.ambient;
    return `<p class="kind">Utilities</p><h3>${esc(a.name)}</h3><p><span class="st ${a.forced > P.t ? 'warn' : ''}"><i></i>${a.on === false ? 'Off' : 'On'}${a.forced > P.t ? ' · forced' : ''}${a.defer > P.t ? ' · start held' : ''}</span></p>
      ${kv([['Power now', `${Math.round(a.kw)} <small>kW</small>`], ['Target', `${Math.round(a.target || a.kw)} <small>kW</small>`], ['Ambient', `${(amb || 0).toFixed(1)} <small>°C</small>`], ['Tariff', esc(P.energy.tariff)]])}
      ${caseLinks('util:' + a.id)}${acts('util:' + a.id, '<a class="btn btn-secondary btn-sm" href="#energy"><span data-icon="live"></span>Energy</a>')}`;
  }
  function renderInspector(force) {
    const el = $('#inspBody'); if (!el || DF.view !== 'command') return;
    if (!force && el.contains(document.activeElement) && document.activeElement !== el) return;
    const P = DF.world(), r = DF.sel;
    let out = '';
    if (r) {
      const [k, ...rest] = r.split(':'); const id = rest.join(':');
      if (k === 'st' && P.byId[id]) out = stationPanel(P, P.byId[id]);
      else if (k === 'line' && P.lines[id]) out = linePanel(P, P.lines[id]);
      else if (k === 'buf' && P.bufs[id]) out = bufPanel(P, P.bufs[id]);
      else if (k === 'agv') { const a = P.agvs.find(x => x.id === id); if (a) out = agvPanel(P, a); }
      else if (k === 'order') { const o = P.orders.find(x => x.id === id); if (o) out = orderPanel(P, o); }
      else if (k === 'util') { const a = P.util.assets.find(x => x.id === id); if (a) out = utilPanel(P, a); }
    }
    if (!out) out = plantNow(P);
    if (r) out = `<button type="button" class="link-btn small" data-clear style="align-self:flex-start;margin-bottom:6px">← The plant now</button>` + out;
    html(el, out);
    if (typeof Theme !== 'undefined') Theme.icons(el);
  }
  DF.renderInspector = renderInspector;

  /* bottleneck: the assembly station furthest over its takt */
  // the constraint: the assembly station whose own cycle (not its waiting) is closest to, or over, the takt
  DF.bottleneck = function (P) {
    let best = null;
    for (const id of ['L3', 'L4']) for (const s of P.lines[id].stations) {
      const Ls = P.lines[id].state;
      if (Ls === 'down' || Ls === 'stopped' || P.lines[id].stopped || s.state === 'down' || s.state === 'maint') continue;
      const ct = (s.ctEma || s.base) * (P.lines[id].speed ? 1 / P.lines[id].speed : 1), over = ct / T.E.TAKT[id];
      if (!best || over > best.over) best = { id: s.id, name: s.name, line: id, ct, over };
    }
    if (best) best.over = best.over > 1 && best.over < 1.08 ? 1 : best.over;   // within 8% of takt is normal cycle variation
    return best && best.over > 0.9 ? best : null;
  };

  /* ---------------- value stream ---------------- */
  function vstream() {
    const P = DF.world(), el = $('#vstream'); if (!el) return;
    const SM = P.bufs['SM:main'], SP = P.bufs['SM:power'];
    const burn = P.byId['L5-Burnin'], qc = P.byId['L5-QC'], pack = P.byId['L5-Packing'];
    const bn = DF.bottleneck(P);
    const lineState = L => (L.stopped ? 'stopped' : L.state);
    const nextOrder = P.orders.filter(o => o.state === 'open' || o.state === 'loading').sort((a, b) => a.due - b.due)[0];
    const rackUsed = burn.rack ? burn.rack.filter(s => s.u).length : 0;
    const steps = [
      { ref: 'line:L1', name: 'SMT Line 1', st: lineState(P.lines.L1), num: fmt(P.lines.L1.tph), sub: 'main boards / h' },
      { ref: 'line:L2', name: 'SMT Line 2', st: lineState(P.lines.L2), num: fmt(P.lines.L2.tph), sub: (P.lines.L2.prodOverride ? 'main' : 'power') + ' boards / h' },
      { ref: 'buf:SM:main', name: 'Board supermarket', st: SM.items.length < 20 || SP.items.length < 20 ? 'warn' : 'run', num: `${fmt(SM.items.length)} · ${fmt(SP.items.length)}`, sub: `main · power · ${SM.rw ? PE.mins(SM.rw) : '—'} cover` },
      { ref: 'line:L3', name: 'Final Assembly A', st: lineState(P.lines.L3), num: fmt(P.lines.L3.tph), sub: `TVs / h · takt ${T.E.TAKT.L3} s`, bn: bn && bn.line === 'L3' && bn.over > 1 },
      { ref: 'line:L4', name: 'Final Assembly B', st: lineState(P.lines.L4), num: fmt(P.lines.L4.tph), sub: `phones / h · takt ${T.E.TAKT.L4} s`, bn: bn && bn.line === 'L4' && bn.over > 1 },
      { ref: 'st:L5-Burnin', name: 'Burn-in', st: burn.state, num: `${rackUsed} / ${burn.rack ? burn.rack.length : 0}`, sub: 'rack slots in use' },
      { ref: 'st:L5-QC', name: 'Final QC', st: qc.state, num: pct(P.kpi.fpy || 0), sub: 'first-pass yield' },
      { ref: 'st:L5-Packing', name: 'Pack and pallet', st: pack.state, num: fmt(P.lines.L5.tph), sub: 'units / h' },
      { ref: nextOrder ? 'order:' + nextOrder.id : 'line:L5', name: 'Shipping', st: nextOrder && nextOrder.risk > 300 ? 'warn' : 'run', num: nextOrder ? esc(PE.clock(nextOrder.due)) : '—', sub: nextOrder ? `next: ${esc(nextOrder.id)} · ${fmt(nextOrder.qty)}` : 'no open orders' }
    ];
    html(el, steps.map(s => `<li><button type="button" class="vs-step ${SEV(s.st) === 'bad' ? 'down' : ''} ${s.bn ? 'bn' : ''} ${DF.sel === s.ref ? 'sel' : ''}" data-ref="${esc(s.ref)}"><b>${esc(s.name)}</b>${stChip(s.st)}<span class="num">${s.num}</span><small>${s.sub}</small>${s.bn ? `<small class="bnl">Bottleneck · ${esc(bn.name)}</small>` : ''}</button></li>`).join(''));
  }

  /* ---------------- cases ---------------- */
  function needs() {
    const el = $('#needs'); if (!el) return;
    const w = window.Agents.waiting().slice().sort((a, b) => (b.value || 0) - (a.value || 0));
    const n = $('#needsN'); n.textContent = w.length; n.classList.toggle('on', w.length > 0);
    if (el.contains(document.activeElement) && document.activeElement.closest('.cs-dec')) return;
    html(el, w.length ? w.map(c => CaseUI.card(c, { decide: true, noLast: true })).join('') : '<p class="empty">Nothing waits for you. The agents are watching the plant and will ask when a decision is yours.</p>');
    if (typeof Theme !== 'undefined') Theme.icons(el);
  }
  function working() {
    const el = $('#working'); if (!el) return;
    const S = window.Agents.S;
    const open = S.cases.filter(c => c.state !== 'closed' && c.state !== 'awaiting' && c.state !== 'advise');
    const recent = S.cases.filter(c => c.state === 'closed').slice(0, Math.max(0, 3 - open.length));
    html(el, open.length || recent.length ? open.concat(recent).map(c => CaseUI.card(c)).join('') : '<p class="empty">The crew is watching. Start a drill to see an agent work a case from detection to verification.</p>');
  }
  DF.renderCases = function () { needs(); working(); };

  /* ---------------- alarms: ISA-18.2 grouping ---------------- */
  // first-out alarms (a stop, a trip, a person in a cell) gather the consequential alarms of their area raised within 4 minutes
  DF.incidents = function (P) {
    const alive = P.alarms.slice().sort((a, b) => a.t - b.t);
    const first = alive.filter(a => a.prio === 1 || /\.DOWN$|GRID\.DIP|\.CELL$/.test(a.key));
    const used = new Set();
    const out = [];
    for (const f of first) {
      if (used.has(f)) continue;
      const members = alive.filter(a => a !== f && !used.has(a) && (a.case && a.case === f.case || (a.area === f.area && a.t >= f.t - 20 && a.t - f.t < 240)));
      members.forEach(m => used.add(m)); used.add(f);
      const c = window.Agents.S.cases.find(x => x.state !== 'closed' && (x.ref === toRef(f.ref) || (f.case && x.id === f.case)));
      out.push({ open: true, first: f, members, case: c, title: f.msg, area: f.area });
    }
    const rest = alive.filter(a => !used.has(a));
    return out.concat(rest.length ? [{ open: false, members: rest, title: 'Other alarms', area: '' }] : []);
  };
  const prio = a => `<span class="prio p${a.prio}" aria-label="Priority ${a.prio}">P${a.prio}</span>`;
  DF.prio = prio;
  function alarmSum() {
    const el = $('#alarmSum'); if (!el) return;
    const P = DF.world();
    const inc = DF.incidents(P).filter(i => i.open);
    const live = P.alarms.filter(a => !(a.shelvedTo > P.t));
    const top = live.slice().sort((a, b) => a.prio - b.prio || b.t - a.t);
    let h = '';
    for (const i of inc.slice(0, 2)) h += `<div class="inc open"><div class="ih"><h3>${esc(i.title)}</h3><span class="n">${i.members.length + 1}<small>alarms</small></span></div><p>${i.members.length ? `${i.members.length} consequential alarm${i.members.length > 1 ? 's' : ''} folded under the first-out. ` : ''}${i.case ? `${link('case:' + i.case.id, i.case.id)} · ${esc(CaseUI.agentName(i.case.agent))}: ${esc(CaseUI.STATE[i.case.state] ? CaseUI.STATE[i.case.state][0] : i.case.state)}` : 'Waiting for an agent.'}</p></div>`;
    const shown = new Set(inc.flatMap(i => [i.first, ...i.members]));
    const others = top.filter(a => !shown.has(a)).slice(0, 5);
    h += others.map(a => `<div class="al-row ${a.state === 'active' ? 'unack' : ''}">${prio(a)}<div class="msg">${esc(a.msg)}<small>${esc(a.area || '')}</small></div><time>${esc(a.time)}</time></div>`).join('');
    if (!h) h = '<p class="empty">No active alarms. The alarm rate is inside the ISA-18.2 target.</p>';
    html(el, h);
    $('#alSumS').textContent = `${live.length} active · ${P.alarmStats.rate10} raised in 10 min${P.alarmStats.flood ? ' · flood' : ''}`;
  }

  /* ---------------- events ---------------- */
  let evFilter = 'all';
  function events() {
    const el = $('#events'); if (!el) return;
    const P = DF.world();
    let list = P.events.slice(0, 60);
    if (evFilter === 'warn') list = list.filter(e => e.level === 'warn' || e.level === 'crit');
    if (evFilter === 'agents') list = P.audit.slice(0, 60).map(a => ({ id: a.id, time: a.time, src: a.who, msg: `${a.action}${a.detail ? ' · ' + a.detail : ''}`, level: /agent/i.test(a.who) ? 'agent' : 'info' }));
    html(el, list.slice(0, 40).map(e => `<li class="${esc(e.level)}"><time>${esc(e.time)}</time><span class="src">${esc(e.src)}</span><span>${esc(e.msg)}${e.ref ? ' ' + link(toRef(e.ref), '›') : ''}</span></li>`).join('') || '<li><span></span><span></span><span class="muted">No events yet.</span></li>');
  }

  /* ---------------- orders ---------------- */
  function orders() {
    const el = $('#orders'); if (!el) return;
    const P = DF.world();
    const rows = P.orders.filter(o => o.state !== 'shipped' || P.t - (o.shippedAt || 0) < 3600).slice(0, 8);
    html(el, `<thead><tr><th>Order</th><th>Customer</th><th class="num">Qty</th><th class="num">Due</th><th class="num">Ready</th><th>State</th></tr></thead><tbody>${rows.map(o => {
      const st = o.state === 'shipped' ? '<span class="st"><i></i>Shipped</span>' : o.state === 'late' ? '<span class="st bad"><i></i>Shipped late</span>' : o.risk > 300 ? `<span class="st warn"><i></i>${esc(PE.mins(o.risk))} late</span>` : `<span class="st"><i></i>${o.state === 'loading' ? 'Loading' : 'On time'}</span>`;
      return `<tr><td>${link('order:' + o.id, o.id)}</td><td>${esc(o.customer)}<small>${o.product === 'tv' ? 'TVs' : 'Phones'}</small></td><td class="num">${fmt(o.qty)}</td><td class="num">${esc(PE.clock(o.due))}</td><td class="num">${o.eta && o.state !== 'shipped' && o.state !== 'late' ? esc(PE.clock(o.eta)) : '—'}</td><td>${st}</td></tr>`;
    }).join('')}</tbody>`);
  }

  DF.onView('command', force => { renderInspector(force); vstream(); needs(); working(); alarmSum(); events(); orders(); });

  /* clicks inside the command room: refs, the detail panel, ask buttons, case links */
  document.addEventListener('click', e => {
    const r = e.target.closest('[data-ref]');
    if (r) {
      const ref = r.dataset.ref;
      if (ref.startsWith('case:')) { DF.openCase(ref.slice(5)); return; }
      if (ref.startsWith('unit:')) { DF.go('rootcause'); setTimeout(() => DF.trace && DF.trace(ref.slice(5)), 30); return; }
      if (DF.view !== 'command') DF.go('command');
      DF.select(ref, { focus: true, scroll: true });
      return;
    }
    if (e.target.closest('[data-clear]')) { DF.select(null); if (F) F.fit(); return; }
    const ask = e.target.closest('[data-ask]');
    if (ask && window.Copilot) { Copilot.open(`Tell me about ${DF.refName(ask.dataset.ask)}: its state, what is driving it and what you would do.`); return; }
    const oc = e.target.closest('[data-open-case]');
    if (oc) DF.openCase(oc.dataset.openCase);
  });
  document.addEventListener('click', e => {
    const b = e.target.closest('#evFilter .seg'); if (!b) return;
    evFilter = b.dataset.f;
    $$('#evFilter .seg').forEach(x => { x.classList.toggle('active', x === b); x.setAttribute('aria-pressed', String(x === b)); });
    events();
  });
})();
