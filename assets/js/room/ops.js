/* Digital Factory — the Alarms and Control views of the command room, on Plant EG-01.
   Alarms follow ISA-18.2: priorities, acknowledge, shelve (logged), grouping by area with the oldest alarm as the likely
   first-out, and the alarm rate against the flood threshold. Control: each main line's speed and model, any machine's
   HMI with its interlocks, and the utilities; every change is simulated on the two-hour forecast first, confirmed by
   a person and written to the audit trail. Simulated data. */
(function () {
  'use strict';
  const { $, $$, esc, icon, fmt, pct, link, toRef, stChip, tag, html } = DF;
  const mins = s => DF.E.mins(s), clock = t => DF.E.clock(t);
  const prio = a => `<span class="prio p${a.prio}" aria-label="Priority ${a.prio}">P${a.prio}</span>`;
  DF.prio = prio;

  /* ================= alarms ================= */
  // every alarm raised, kept for the rate chart (the engine keeps only the open ones)
  const raised = [], seen = new Set();
  DF.boot.push(() => {
    const track = () => { for (const a of DF.P.alarms) { const k = a.key + '@' + a.t; if (!seen.has(k)) { seen.add(k); raised.push(a.t); } } };
    track();
    DF.E.on(t => { if (t === 'second' || t === 'alarms') track(); });
  });
  DF.alarmRate = () => { const t = DF.P.t; return raised.filter(x => t - x < 600).length; };
  let alFilter = 'all';
  function alarms() {
    const P = DF.P, open = P.alarms.filter(a => !(a.shelvedTo > P.t)), shelved = P.alarms.filter(a => a.shelvedTo > P.t);
    const unack = open.filter(a => a.state !== 'ack'), urgent = open.filter(a => a.prio <= 2), rate = DF.alarmRate();
    html($('#alKpis'), [
      [fmt(open.length), 'Active', 'not shelved'],
      [fmt(unack.length), 'Not acknowledged', unack.length ? 'oldest ' + clock(Math.min(...unack.map(a => a.t))) : 'all seen'],
      [fmt(urgent.length), 'Priority 1–2', urgent.length ? 'act now' : 'none'],
      [fmt(shelved.length), 'Shelved', 'come back after 20 minutes'],
      [fmt(rate), 'Raised in 10 minutes', rate > 10 ? 'flood: above the ISA-18.2 limit of 10' : 'target: about 1']
    ].map(([v, l, s]) => `<div class="stat"><b>${v}</b><span>${esc(l)}</span><small>${esc(s)}</small></div>`).join(''));
    // by area: the oldest open alarm in each area is the likely first-out
    const groups = {};
    for (const a of open) (groups[a.area || 'Plant'] = groups[a.area || 'Plant'] || []).push(a);
    const gl = Object.entries(groups).map(([area, list]) => ({ area, list: list.sort((a, b) => a.t - b.t) })).sort((a, b) => Math.min(...a.list.map(x => x.prio)) - Math.min(...b.list.map(x => x.prio)) || b.list.length - a.list.length);
    html($('#incidents'), gl.length ? gl.map(g => {
      const f = g.list[0], dec = P.recs.find(r => r.ref && (r.ref === f.ref || toRef(r.ref) === toRef(f.ref)));
      return `<div class="inc ${f.prio <= 2 ? 'open' : ''}"><div class="ih"><h3>${esc(g.area)}</h3><span class="n">${g.list.length}<small>alarm${g.list.length > 1 ? 's' : ''}</small></span></div>
        <p>First: ${f.ref ? link(toRef(f.ref), f.msg) : esc(f.msg)} · ${esc(f.time)}</p>
        ${g.list.length > 1 ? `<ul>${g.list.slice(1, 5).map(a => `<li>${prio(a)}<span>${esc(a.msg)}</span></li>`).join('')}${g.list.length > 5 ? `<li><span>and ${g.list.length - 5} more</span></li>` : ''}</ul>` : ''}
        ${dec ? `<p>${link('card:' + dec.key, dec.title)} · ${esc(dec.agent)} agent</p>` : ''}</div>`;
    }).join('') : '<p class="empty">No active alarms. The alarm rate is inside the ISA-18.2 target.</p>');
    // the list
    let list = P.alarms.slice().sort((a, b) => a.prio - b.prio || b.t - a.t);
    if (alFilter === 'p12') list = list.filter(a => a.prio <= 2 && !(a.shelvedTo > P.t));
    else if (alFilter === 'unack') list = list.filter(a => a.state !== 'ack' && !(a.shelvedTo > P.t));
    else if (alFilter === 'shelved') list = list.filter(a => a.shelvedTo > P.t);
    else list = list.filter(a => !(a.shelvedTo > P.t));
    const tb = $('#alarmTable');
    if (!(tb.contains(document.activeElement) && document.activeElement.tagName === 'BUTTON')) html(tb, `<thead><tr><th>Priority</th><th>Time</th><th>Alarm</th><th>Area</th><th>State</th><th><span class="sr-only">Actions</span></th></tr></thead><tbody>${list.map(a => {
      const sh = a.shelvedTo > P.t;
      return `<tr class="${a.state !== 'ack' && !sh ? 'unack' : ''}"><td>${prio(a)}</td><td class="num">${esc(a.time)}</td><td>${a.ref ? link(toRef(a.ref), a.msg) : esc(a.msg)}</td><td>${esc(a.area || '')}</td><td>${sh ? tag('', 'Shelved to ' + clock(a.shelvedTo)) : a.state === 'ack' ? tag('', 'Acknowledged') : tag(a.prio <= 2 ? 'bad' : 'warn', 'Active')}</td>
        <td class="acts-c">${a.state !== 'ack' && !sh ? `<button type="button" class="btn btn-secondary btn-sm" data-ack="${esc(a.key)}">Acknowledge</button>` : ''}${!sh ? `<button type="button" class="btn btn-ghost btn-sm" data-shelve="${esc(a.key)}">Shelve</button>` : ''}</td></tr>`;
    }).join('') || '<tr><td colspan="6" class="muted">No alarms in this filter.</td></tr>'}</tbody>`);
    $('#ackAll').disabled = !unack.length;
    // the rate: alarms raised per 10 minutes since the shift model started
    const t0 = 9 * 3600 + 10 * 60, n = Math.max(1, Math.ceil((P.t - t0) / 600));
    const items = Array.from({ length: Math.min(n, 30) }, (_, i) => { const a = t0 + (n - Math.min(n, 30) + i) * 600; const v = raised.filter(x => x >= a && x < a + 600).length; return { k: clock(a), v, cls: v > 10 ? 'bad' : v > 5 ? 'warn' : 'c1' }; });
    Viz.columns($('#alRate'), { items, rule: { y: 10, label: 'Flood · 10', cls: 'bad' }, label: 'Alarms raised per 10 minutes', unit: 'alarms', height: 170 });
  }
  $$('#alarmFilter .seg').forEach(b => {
    b.onclick = () => { alFilter = b.dataset.f; $$('#alarmFilter .seg').forEach(x => { x.classList.toggle('active', x === b); x.setAttribute('aria-pressed', String(x === b)); }); alarms(); };
  });
  $('#ackAll').onclick = () => { const n = DF.E.ackAll('You'); DF.toast(`${n} alarm${n === 1 ? '' : 's'} acknowledged.`, 'success'); alarms(); };
  document.addEventListener('click', e => {
    const a = e.target.closest('[data-ack]'); if (a) { DF.E.ackAlarm(a.dataset.ack, 'You'); DF.refresh(true); return; }
    const s = e.target.closest('[data-shelve]'); if (s) { DF.E.shelveAlarm(s.dataset.shelve, 20, 'You'); DF.toast('Shelved for 20 minutes and logged.', 'info'); DF.refresh(true); }
  });
  DF.onView('alarms', alarms);

  /* ================= control ================= */
  const base = () => DF.AG.forecast({});
  const effectHtml = (f, b, what) => {
    const d = f.packed - b.packed, l = f.late - b.late;
    return `<div class="pv"><div><b class="${d > 0 ? 'pos' : d < 0 ? 'neg' : ''}">${d > 0 ? '+' : ''}${fmt(d)}</b>TVs in ${Math.round(f.h / 60)} h</div><div><b class="${l > 0 ? 'neg' : l < 0 ? 'pos' : ''}">${l > 0 ? '+' : ''}${l}</b>late orders</div><div><b>${fmt(f.packed)}</b>TVs packed</div></div><p class="small muted">${esc(what)}</p>`;
  };
  async function preview(title, mods, what, yes, run) {
    const b = base(), f = DF.AG.forecast(mods);
    const ok = await DF.confirm({ title, html: `<p>Simulated on the two-hour forecast of the six main lines and everything feeding them:</p>${effectHtml(f, b, what)}`, yes });
    if (ok) { const au = run(); DF.toast(`${title}: done${au && au.id ? '. Logged as ' + au.id : ''}.`, 'success'); DF.refresh(true); }
  }
  function lines() {
    const P = DF.P, M = DF.E.MODELS, el = $('#controls');
    if (el.contains(document.activeElement) && document.activeElement.tagName === 'SELECT') return;
    html(el, Object.values(P.lines).filter(L => L.kind === 'main').map(L => {
      const n = L.id.slice(2);
      return `<section class="card ctrl"><div class="card-head"><div><h2 class="h3">${link('line:' + L.id, L.name)}</h2><p class="muted small">${esc(M[L.model].name)} · takt ${M[L.model].takt} s · LCM ${n}, SMD ${n}, cushion ${n}</p></div>${stChip(L.state)}</div>
        ${DF.kv([['Output', `${fmt(L.tph)} <small>an hour</small>`], ['OEE', pct(L.oee || 0)], ['Speed', `${Math.round(L.speed * 100)}%`], ['Constraint', L.bn ? link('st:' + L.bn.id, L.bn.name) : '—']])}
        <div class="ctl-acts">
          <button type="button" class="btn btn-secondary btn-sm" data-boost="${L.id}" ${L.speed >= 1.08 ? 'disabled' : ''}>${L.speed >= 1.08 ? 'At 108%' : 'Raise speed to 108%'}</button>
          <label class="field inline"><span class="sr-only">New model for ${esc(L.name)}</span><select data-co-sel="${L.id}">${Object.values(M).map(m => `<option value="${m.id}" ${m.id === L.model ? 'selected' : ''}>${esc(m.name)}</option>`).join('')}</select></label>
          <button type="button" class="btn btn-secondary btn-sm" data-co="${L.id}">Change model</button>
        </div></section>`;
    }).join(''));
  }
  /* the machine HMI: interlocks first, then the simulated effect, then the command */
  const HMI = { stop: 'Stop machine', start: 'Start machine', slower: 'Speed −10%', faster: 'Speed +5%', loto: 'Lock out (LOTO)', unloto: 'Remove lockout' };
  function checks(s, cmd) {
    const P = DF.P, L = P.lines[s.line], S = s.sens || {}, hold = P.scen.shortshot && P.scen.shortshot.st === s.id && !P.scen.shortshot.fixed;
    const c = [];
    if (cmd === 'start') c.push(['No lockout on the machine', !s.loto], ['No fault waiting for repair', s.state !== 'down'], ['No quality hold on its output', !hold], ['Line supply on (no trip)', !(L && L.tripped)]);
    if (cmd === 'loto') c.push(['Machine stopped from the HMI', !!s.hold], [s.batchOut || s.kind === 'aging' ? 'Batch inside held in the machine' : 'No unit left inside (it finishes first)', !!(s.batchOut || s.kind === 'aging') || !(s.procs && s.procs.length)], ['Isolation points: main breaker, air valve', true], ['Permit to work by the area supervisor', true]);
    if (cmd === 'unloto') c.push(['Technician out of the guarded area', !(s.tech && s.tech.state === 'repairing')], ['Guards closed and interlocked', true], ['Lock removed by the person who applied it', true]);
    if (cmd === 'faster') c.push(['Health above 70%', s.health > 70], ['Vibration below 3 mm/s', !(S.vib > 3)], ['Line first-pass quality above 97%', !L || (L.qual || 1) > 0.97], ['Below 108% of rated speed', (s.speedMul || 1) > 0.93]);
    if (cmd === 'stop') c.push(['A stop is always allowed (safety first)', true]);
    if (cmd === 'slower') c.push(['Slowing down is always allowed', true]);
    return c;
  }
  function hmiForecast(s, cmd) {
    const L = DF.P.lines[s.line]; if (!L) return { note: 'This machine is not in the two-hour flow model.' };
    const tgt = L.kind === 'main' ? L.id : L.kind === 'lcm' ? 'ML' + L.id.slice(3) : (L.kind === 'smd' || L.kind === 'press') ? L.id : L.kind === 'injection' ? s.id : null;
    if (!tgt) return { note: 'This machine is not in the two-hour flow model; its buffer covers short stops.' };
    const constraint = L.bn === s || L.kind !== 'main';
    const mods = cmd === 'stop' ? { down: [{ id: tgt, at: 0, dur: 10 }] } : cmd === 'loto' ? { down: [{ id: tgt, at: 0, dur: 30 }] } : cmd === 'slower' && constraint ? { rate: [{ id: tgt, k: 0.9 }] } : cmd === 'faster' && constraint && L.kind === 'main' ? { rate: [{ id: tgt, k: 1.05 }] } : {};
    const b = base(), f = DF.AG.forecast(mods);
    return { d: f.packed - b.packed, late: f.late - b.late, assume: cmd === 'stop' ? 'a 10-minute stop' : cmd === 'loto' ? 'a 30-minute lockout' : '', constraint };
  }
  let pending = null;
  function hmiOptions() {
    const P = DF.P, sel = $('#hmiSel');
    if (sel.options.length) return;
    const groups = Object.values(P.lines).filter(L => L.stations.length);
    sel.innerHTML = groups.map(L => `<optgroup label="${esc(L.name)}">${L.stations.map(s => `<option value="${esc(s.id)}">${esc(s.name)}${L.kind === 'injection' ? '' : ' · ' + esc(L.name)}</option>`).join('')}</optgroup>`).join('');
    sel.value = 'ML1-Packing';
    sel.onchange = () => { pending = null; DF.hmiTarget = null; hmi(true); };
  }
  function hmi(force) {
    const P = DF.P, sel = $('#hmiSel');
    hmiOptions();
    if (DF.hmiTarget && P.byId[DF.hmiTarget]) { sel.value = DF.hmiTarget; DF.hmiTarget = null; pending = null; }
    const s = P.byId[sel.value]; if (!s) return;
    const el = $('#hmiBody');
    if (!force && el.contains(document.activeElement) && pending) return;
    const L = P.lines[s.line];
    const mode = s.loto ? 'Locked out' : s.hold ? 'Stopped from the HMI' : DF.STATE[s.state] || s.state;
    const cmds = s.loto ? ['unloto'] : s.hold ? ['start', 'loto'] : ['stop', 'slower', 'faster'];
    let pend = '';
    if (pending && pending.st === s.id) {
      const cmd = pending.cmd, cs = checks(s, cmd), okAll = cs.every(c => c[1]), f = pending.f;
      const eff = f.note ? `<p class="muted small">${esc(f.note)}</p>` : `<p class="hmi-eff"><b class="${f.d < 0 ? 'neg' : f.d > 0 ? 'pos' : ''}">${f.d > 0 ? '+' : ''}${fmt(f.d)} TVs</b> in the next two hours${f.late > 0 ? `, <b class="neg">${f.late} more order${f.late > 1 ? 's' : ''} late</b>` : ''}${f.assume ? `, assuming ${esc(f.assume)}` : ''}.${(cmd === 'faster' || cmd === 'slower') && !f.constraint ? ' This machine is not the constraint of its line, so its speed does not change the output.' : ''}</p>`;
      pend = `<div class="hmi-pre" role="group" aria-label="Confirm ${esc(HMI[cmd])}"><h4>${esc(HMI[cmd])} · check first</h4>
        <ul class="ilk">${cs.map(([t, ok]) => `<li class="${ok ? 'ok' : 'bad'}">${icon(ok ? 'check' : 'x')}<span>${esc(t)}</span></li>`).join('')}</ul>
        <h5>Simulated effect</h5>${eff}
        <div class="ctl-acts"><button type="button" class="btn btn-sm btn-primary" data-hmigo="${esc(cmd)}" ${okAll ? '' : 'disabled'}>${okAll ? 'Confirm' : 'Blocked by an interlock'}</button><button type="button" class="btn btn-sm btn-ghost" data-hmix>Cancel</button></div></div>`;
    }
    html(el, `<p>${link('st:' + s.id, s.name)} · ${L ? esc(L.name) : 'Support'} · ${stChip(s.state === 'idle' && L && L.tripped ? 'tripped' : s.state, s.why)}</p>
      ${DF.kv([['Mode', esc(mode)], ['Speed', `${Math.round(100 / (s.speedMul || 1))}% <small>of rated</small>`], ['Health', `${Math.round(s.health)} <small>/ 100</small>`], L && L.bn ? ['Constraint of the line', L.bn === s ? 'yes' : 'no'] : null])}
      <div class="ctl-acts">${cmds.map(c => `<button type="button" class="btn btn-sm btn-secondary ${c === 'stop' || c === 'loto' ? 'danger-o' : ''}" data-hmi="${c}" aria-pressed="${!!(pending && pending.st === s.id && pending.cmd === c)}">${esc(HMI[c])}</button>`).join('')}</div>${pend}`);
    if (typeof Theme !== 'undefined') Theme.icons(el);
  }
  function utilities() {
    const P = DF.P, A = DF.AG.energy, shaving = P.shave && P.t < P.shave.until;
    html($('#utilBody'), `<div class="rows">${P.util.assets.map(a => `<div class="rw"><span>${link('util:' + a.id, a.name)}${shaving && P.shave.assets[a.id] !== undefined ? ' · staged down' : ''}</span><span class="v">${a.kind === 'transformer' ? fmt(P.kpi.kw / 2) + ' kW load' : fmt(a.kw) + ' kW'}</span></div>`).join('')}</div>
      ${DF.kv([['Plant now', `${fmt(P.kpi.kw)} <small>kW</small>`], ['15-minute average', `${fmt(A.avg)} <small>kW</small>`], ['Forecast peak', `<span class="${A.peak > 4000 ? 'bad' : A.peak > 3900 ? 'warn' : ''}">${fmt(A.peak)}</span> <small>kW · contract 4,000</small>`], ['Peak shaving', shaving ? `on until ${esc(clock(P.shave.until))}` : 'off']])}
      <div class="ctl-acts"><button type="button" class="btn btn-secondary btn-sm" id="shaveBtn" ${shaving ? 'disabled' : ''}>Shave the peak for 30 min</button></div>`);
  }
  function audit() {
    const P = DF.P;
    html($('#audit'), `<thead><tr><th>Audit ID</th><th>Time</th><th>Who</th><th>Action</th><th>Detail</th></tr></thead><tbody>${P.audit.slice(0, 40).map(a => `<tr><td class="num">${esc(a.id)}</td><td class="num">${esc(a.time)}</td><td>${esc(a.who)}</td><td>${esc(a.action)}</td><td>${esc(a.detail || '')}</td></tr>`).join('') || '<tr><td colspan="5" class="muted">No changes yet. Every decision and command lands here with its audit ID.</td></tr>'}</tbody>`);
  }
  document.addEventListener('click', e => {
    const P = DF.P, M = DF.E.MODELS;
    const bo = e.target.closest('[data-boost]');
    if (bo) { const L = P.lines[bo.dataset.boost]; preview(`Raise ${L.name} to 108%`, { rate: [{ id: L.id, k: 1.08 }] }, 'A slightly higher short-stop rate. The line keeps its model.', 'Raise speed', () => { DF.E.apply('boost:' + L.id, 'You'); return P.audit[0]; }); return; }
    const co = e.target.closest('[data-co]');
    if (co) {
      const L = P.lines[co.dataset.co], m = $(`[data-co-sel="${L.id}"]`).value;
      if (m === L.model) { DF.toast(`${L.name} already builds ${M[m].name}. Choose another model first.`, 'info'); return; }
      preview(`${L.name}: ${M[L.model].name} → ${M[m].name}`, { co: [{ id: L.id, at: 0, dur: 15, model: m }] }, `A 15-minute changeover; LCM line ${L.id.slice(2)} and cushion machine ${L.id.slice(2)} follow. Line-side stock goes back to the stores.`, 'Change model', () => { DF.E.changeover(+L.id.slice(2), m, 'You'); return P.audit[0]; });
      return;
    }
    const h = e.target.closest('[data-hmi]');
    if (h) { const s = P.byId[$('#hmiSel').value]; pending = { st: s.id, cmd: h.dataset.hmi, f: hmiForecast(s, h.dataset.hmi) }; hmi(true); return; }
    const go = e.target.closest('[data-hmigo]');
    if (go && pending) { const s = P.byId[pending.st]; DF.E.hmi(s.id, pending.cmd, 'You'); DF.toast(`${HMI[pending.cmd]}: ${s.name}. Logged as ${P.audit[0].id}.`, 'success'); pending = null; DF.refresh(true); return; }
    if (e.target.closest('[data-hmix]')) { pending = null; hmi(true); return; }
    if (e.target.closest('#shaveBtn')) preview('Shave the demand peak', {}, 'Compressor 3 staged off, chiller 2 setpoint +2 °C and the boiler on low fire for 30 minutes: about 190 kW off the demand. Takt does not change, so the forecast does not either.', 'Shave the peak', () => { DF.E.apply('agent:shave', 'You'); return P.audit[0]; });
  });
  DF.onView('control', force => { lines(); hmi(force); utilities(); audit(); });
})();
