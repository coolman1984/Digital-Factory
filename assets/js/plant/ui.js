/* Digital Factory — Live plant page: wires the shop-floor engine, the enterprise layer (SAP, GMES, S&OP, MRP,
   departments), the 3D view and the 2D views to the readouts, the detail panel, the value stream, drills, the guided
   tour and the serial search. The page owns the frame loop. All plant data is simulated. */
(function () {
  'use strict';
  const $ = s => document.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const { esc, icon, fmt, pct, STATE, SCLS, chip, link, bar, refFromFocus, recCards } = PlantViews.H;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const narrow = matchMedia('(max-width: 900px)').matches;

  const E = PlantEngine.create();
  const X = PlantERP.create(E);
  const P = E.P;
  const { mins, clock, clockS } = E;
  const MODELS = E.MODELS;
  const line = id => P.lines[id];
  const egp = X.egp;
  let V = null;
  try { V = PlantScene.create($('#gl'), E, X, { lowPower: narrow }); } catch (err) { V = null; }
  const views = PlantViews.create($('#view2d'), E, X, { select: (r, o) => select(r, o) });

  const KINDN = { loader: 'Magazine loader', unloader: 'Magazine unloader', printer: 'Solder paste printer', spi: 'Solder paste inspection', mounter: 'Pick-and-place mounter', reflow: 'Reflow oven, 8 zones', aoi: 'Automated optical inspection', writer: 'Software download (firmware writer)', ict: 'In-circuit and function test', lcmload: 'Open-cell loading robot', blu: 'Backlight assembly (manual)', bond: 'Module bonding', lighting: 'Lighting test', robot: 'Robot cell', bench: 'Manual workstation', fct: 'Function test', aging: 'Aging rack, 20 minutes powered', wb: 'White-balance camera', qa: 'Final QA booth', packer: 'Packing station', palletizer: 'Palletizing robot', injection: 'Injection moulding machine', press: 'Stamping press', oven: 'Powder-coating oven', subassy: 'Chassis sub-assembly (manual)', cushion: 'EPS cushion moulding', repair: 'Repair bench' };

  /* ---------------- small charts and toasts ---------------- */
  function spark(arr, o = {}) {
    if (!arr || arr.length < 2) return '';
    const w = 280, h = o.h || 46, a = arr.slice(-90);
    let lo = Math.min(...a), hi = Math.max(...a);
    if (o.lo !== undefined) lo = Math.min(lo, o.lo); if (o.hi !== undefined) hi = Math.max(hi, o.hi);
    if (hi - lo < 1e-6) { hi += 1; lo -= 1; }
    const Xp = i => (i / (a.length - 1)) * w, Y = v => h - 3 - ((v - lo) / (hi - lo)) * (h - 6);
    const d = a.map((v, i) => `${i ? 'L' : 'M'}${Xp(i).toFixed(1)} ${Y(v).toFixed(1)}`).join('');
    const lim = o.limit !== undefined ? `<line x1="0" x2="${w}" y1="${Y(o.limit).toFixed(1)}" y2="${Y(o.limit).toFixed(1)}" class="lim"/>` : '';
    return `<svg class="spark ${o.cls || ''}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true">${lim}<path d="${d}"/></svg>`;
  }
  function toast(msg, level) {
    const type = level === 'error' || level === 'crit' ? 'error' : level === 'warning' || level === 'warn' ? 'warning' : level === 'info' ? 'info' : 'success';
    const root = $('#toast-root'), node = document.createElement('div');
    node.className = `toast toast-${type}`;
    node.innerHTML = `${icon(type === 'success' ? 'checkCircle' : type === 'error' ? 'xCircle' : type === 'warning' ? 'alert' : 'info')}<span class="toast-msg"></span><button class="toast-x" type="button" aria-label="Dismiss notification">${icon('x')}</button>`;
    node.querySelector('.toast-msg').textContent = msg;
    root.append(node); while (root.children.length > 3) root.firstChild.remove();
    requestAnimationFrame(() => node.classList.add('show'));
    const kill = () => { node.classList.remove('show'); setTimeout(() => node.remove(), 300); };
    node.querySelector('.toast-x').onclick = kill; setTimeout(kill, 5200);
  }
  E.on((t, d) => { if (t === 'toast') toast(d.msg, d.level); if (t === 'focus') { const r = refFromFocus(d); if (r) select(r, { focusPanel: true }); } });

  /* ---------------- modes: the 3D factory and the 2D views ---------------- */
  let mode = '3d';
  const tabs = $$('.modes [data-mode]');
  function setMode(m, o = {}) {
    if (m === '3d' && !V) m = 'gmes';
    mode = m;
    tabs.forEach(t => { const on = t.dataset.mode === m; t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1; });
    $('#view3d').hidden = m !== '3d';
    const v2 = $('#view2d'); v2.hidden = m === '3d';
    if (m !== '3d') { v2.setAttribute('aria-labelledby', 'tab-' + m); views.setMode(m); if (!o.keepScroll) v2.scrollTop = 0; }
    else if (V) V.resize();
    document.body.dataset.mode = m;
    if (o.focus) (m === '3d' ? $('#gl') : v2).focus({ preventScroll: true });
  }
  tabs.forEach(t => t.addEventListener('click', () => setMode(t.dataset.mode)));
  $('.modes').addEventListener('keydown', e => {
    const i = tabs.findIndex(t => t.dataset.mode === mode);
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); const n = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length]; setMode(n.dataset.mode); n.focus(); }
  });
  $('#view2d').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.mode) return setMode(b.dataset.mode);
    if (b.dataset.ref) return select(b.dataset.ref, { fly: false, focusPanel: true });
    if (b.dataset.act) { act(b.dataset.act); return; }
    if (b.dataset.dismiss) { E.dismiss(b.dataset.dismiss); views.render(true); }
  });
  function act(id) {
    E.apply(id);
    if (id.startsWith('erp:sop:')) toast('Plan approved. The master schedule is in SAP PP and MRP has run.', 'success');
    else if (id.startsWith('erp:convert')) toast('Planned order converted to a purchase order.', 'success');
    views.render(true); render(true);
  }

  /* ---------------- selection and the detail panel ---------------- */
  let sel = null, kpiView = null;
  function select(ref, o = {}) {
    if (ref && ref.startsWith('kpi:')) { kpiView = ref.slice(4); sel = null; if (V) V.select(null, { fly: false }); render(true); return; }
    if (ref === 'sop') { setMode('sop'); ref = null; }
    if (ref && ref.startsWith('mrp:')) { views.showMrp(ref.slice(4)); if (mode !== 'mrp') setMode('mrp'); else views.render(true); }
    kpiView = null; sel = ref;
    if (V && ref && mode === '3d') V.select(ref, o);
    else if (V && ref && o.fly !== false && V.refInfo(ref) && mode === '3d') V.select(ref, o);
    else if (V) V.select(ref, { fly: false });
    render(true);
    if (o.focusPanel && narrow) $('#insp').scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  }
  if (V) V.on((t, d) => {
    if (t === 'select') { if (d !== sel) { sel = d; kpiView = null; render(true); } }
    if (t === 'hover') hover(d);
  });

  const insp = $('#inspBody');
  let lastHtml = '', pressing = false;
  insp.addEventListener('pointerdown', () => { pressing = true; });
  addEventListener('pointerup', () => { if (pressing) { pressing = false; setTimeout(() => render(), 30); } });
  function render(force) {
    if (pressing && !force) return;
    const html = sel ? detail(sel) : kpiView ? kpiPanel(kpiView) : plantNow();
    if (html === lastHtml && !force) return;
    const focusKey = document.activeElement && insp.contains(document.activeElement) ? document.activeElement.dataset.key : null;
    insp.innerHTML = html; lastHtml = html;
    if (window.Theme) Theme.icons(insp);
    if (focusKey) { const el = insp.querySelector(`[data-key="${CSS.escape(focusKey)}"]`); if (el) el.focus(); }
  }
  insp.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.mode) return setMode(b.dataset.mode);
    if (b.dataset.ref) return select(b.dataset.ref, { fly: true });
    if (b.dataset.act) { act(b.dataset.act); return; }
    if (b.dataset.dismiss) { E.dismiss(b.dataset.dismiss); render(true); return; }
    if (b.dataset.back !== undefined) { select(null); return; }
    if (b.dataset.follow !== undefined && V) { if (mode !== '3d') setMode('3d'); V.setFollow(!V.follow); if (V.follow && sel) V.select(sel, { follow: true }); render(true); return; }
    if (b.dataset.show3d !== undefined && V && sel) { setMode('3d'); V.select(sel, { fly: true }); return; }
    if (b.dataset.kpi) return select('kpi:' + b.dataset.kpi);
  });

  const head = (title, sub, extra = '') => `<header class="ih"><button type="button" class="back" data-back data-key="back">${icon('chevronLeft')}<span>Plant now</span></button><h2>${esc(title)}</h2><p class="ih-sub">${sub}</p>${extra}</header>`;
  const kv = rows => `<dl class="kv">${rows.filter(Boolean).map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${v}</dd></div>`).join('')}</dl>`;
  const sect = (title, body, note = '') => body ? `<section class="is"><h3>${esc(title)}${note ? `<span>${note}</span>` : ''}</h3>${body}</section>` : '';
  const evRows = list => list.length ? `<ol class="ev">${list.map(e => `<li class="${e.level}"><time>${e.time}</time><span><b>${esc(e.src)}</b> ${esc(e.msg)}</span></li>`).join('')}</ol>` : '<p class="quiet">Nothing logged yet.</p>';
  const msgRows = list => list.length ? `<ol class="ev">${list.map(m => `<li><time>${m.time}</time><span><b>${esc(m.from)} → ${esc(m.to)}</b> ${esc(m.text)}</span></li>`).join('')}</ol>` : '<p class="quiet">No messages yet.</p>';
  const show3d = () => (V && mode !== '3d' ? `<div class="ia"><button type="button" class="btn btn-secondary btn-sm" data-show3d data-key="show3d">${icon('eye')}Show in 3D</button></div>` : '');
  const stLink = id => { const s = P.byId[id]; return s ? link('st:' + id, s.name) : esc(id); };
  const unitLink = u => (u ? link('unit:' + u.sn, u.sn) : '—');
  const where = u => {
    const l = u && u.loc;
    if (!l) return u && u.svcShipped ? `Shipped as a service part (order ${u.svcOrder})` : u && u.truck ? `Shipped on ${u.truck}` : u && u.usedIn ? `Built into ${u.usedIn}` : 'Archived';
    if (l.k === 'seg') return `On the conveyor to ${l.seg.to ? l.seg.to.name : 'the next station'}${l.seg.bridge ? ' (over the aisle bridge)' : ''}`;
    if (l.k === 'st') return `In ${l.st.name} (${line(l.st.line) ? line(l.st.line).name : ''})`;
    if (l.k === 'aging') return `Aging rack, ${line(l.st.line).name}`;
    if (l.k === 'store') return l.b.label + ' (store)';
    if (l.k === 'ls') return `Line-side stock at ${P.byId[l.b.station].name}`;
    if (l.k === 'veh') return `On ${l.a.id}`;
    if (l.k === 'pallet') return `On pallet ${l.p.id}`;
    if (l.k === 'repair') return l.st.name;
    return '—';
  };

  /* plant now: decisions, what happens next, orders, live events */
  function summary() {
    const down = P.stations.filter(s => s.state === 'down');
    const crit = P.recs.filter(r => r.level === 'crit');
    const parts = [];
    if (down.length) parts.push(`<b class="bad">${down.slice(0, 3).map(s => `${esc(s.name)} (${esc(line(s.line) ? line(s.line).name : s.id)})`).join(', ')}${down.length > 3 ? ` and ${down.length - 3} more` : ''} stopped.</b>`);
    if (P.preds[0] && P.preds[0].eta < 1800 && !P.preds[0].covered) parts.push(`${esc(P.preds[0].text)} in <b>${mins(P.preds[0].eta)}</b>.`);
    if (!parts.length) parts.push(`Six main lines and ${Object.values(P.lines).filter(L => L.kind !== 'main' && L.kind !== 'injection').length} sub-lines running. <b>${fmt(P.kpi.units)}</b> TVs packed today against a plan of ${fmt(P.kpi.plan)}.`);
    if (P.recs.length) parts.push(`${P.recs.length} ${P.recs.length === 1 ? 'decision is' : 'decisions are'} waiting${crit.length ? `, ${crit.length} urgent` : ''}.`);
    else parts.push('No decision waiting: the agents and the offices are watching every line, store and order.');
    return parts.join(' ');
  }
  function ordersTable(list) {
    return `<table class="tbl"><thead><tr><th>Order</th><th>Qty</th><th>Due</th><th>Status</th></tr></thead><tbody>${list.map(o => {
      const st = o.state === 'shipped' ? 'Shipped' : o.state === 'late' ? 'Shipped late' : o.state === 'partial' ? 'Part-shipped' : o.state === 'loading' ? `Loading ${o.truck ? o.truck.loaded : 0}/${o.truck ? o.truck.need : o.qty}` : o.atp && !o.atp.ok ? 'ATP short' : 'Confirmed';
      const cls = o.state === 'late' || o.state === 'partial' ? 'bad' : o.atp && !o.atp.ok && o.state === 'open' ? 'warn' : '';
      return `<tr><td>${link('order:' + o.id, o.id)}<small>${esc(o.customer)}</small></td><td>${fmt(o.qty)}<small>${esc(MODELS[o.model].name)}</small></td><td>${clock(o.due)}</td><td class="${cls}">${st}</td></tr>`;
    }).join('')}</tbody></table>`;
  }
  function plantNow() {
    const preds = P.preds.slice().sort((a, b) => a.eta - b.eta).slice(0, 6).map(p => `<li class="${p.covered ? '' : p.eta < 600 ? 'bad' : p.eta < 1800 ? 'warn' : ''}"><button type="button" class="lnk" data-ref="${esc(refFromFocus(p.ref))}">${esc(p.text)}</button><small>${esc(p.sub)}${p.covered ? ' · covered' : ''}</small><b>in ${mins(p.eta)}</b></li>`).join('');
    const open = P.orders.filter(o => o.state === 'open' || o.state === 'loading').sort((a, b) => a.due - b.due).slice(0, 6);
    return `<header class="ih home"><h2>Plant now</h2><p class="say">${summary()}</p></header>
      ${sect('Needs a decision', recCards(P.recs.slice(0, 4), X) + (P.recs.length > 4 ? `<button type="button" class="btn btn-secondary btn-sm" data-mode="decisions">All ${P.recs.length} decisions</button>` : '') || '<p class="quiet">Nothing to decide. Start a drill to see the departments and the agents at work.</p>')}
      ${sect('What happens next', preds ? `<ol class="next">${preds}</ol>` : '<p class="quiet">No stock-out or failure expected. Every line-side stock has its next milk run or AGV planned.</p>', 'if nobody acts')}
      ${sect('Next orders to ship', ordersTable(open))}
      ${sect('SAP and GMES', msgRows(X.msgs.slice(0, 6)), `${Math.round(X.stats.perMin)} a minute`)}
      ${sect('Live events', evRows(P.events.slice(0, 7)))}`;
  }

  /* station detail */
  function sensorsBlock(s) {
    const S = s.sens, Hh = s.hist, rows = [];
    const ro = (label, value, unit, chart = '') => `<div class="ro2"><span>${esc(label)}</span><b>${value}<small>${unit}</small></b>${chart}</div>`;
    if (s.kind === 'mounter') {
      rows.push(ro('Spindle vibration', (S.vib || 0).toFixed(2), ' mm/s', spark(Hh.vib, { limit: 4.5, cls: S.vib > 4.5 ? 'bad' : S.vib > 3 ? 'warn' : '' })));
      rows.push(ro('Placements', fmt(S.cph || 0), ' /h')); rows.push(ro('Health', s.health.toFixed(0), ' %', spark(Hh.health, { lo: 0, hi: 100 })));
    } else if (s.kind === 'reflow') {
      const z = S.zones || [];
      rows.push(`<div class="ro2 wide"><span>Zone temperatures · peak ${(S.peak || 0).toFixed(1)} °C (limit 248)</span><div class="zones">${z.map((t, i) => `<i style="height:${(t / 260 * 100).toFixed(0)}%"><b>${t.toFixed(0)}</b><small>Z${i + 1}</small></i>`).join('')}</div></div>`);
      rows.push(ro('Peak temperature', (S.peak || 0).toFixed(1), ' °C', spark(Hh.peak, { limit: 248 })));
    } else if (s.kind === 'printer') rows.push(ro('Squeegee pressure', (S.press || 0).toFixed(2), ' kg'), ro('Paste temperature', (S.paste || 0).toFixed(1), ' °C', spark(Hh.temp)));
    else if (s.kind === 'injection') rows.push(ro('Injection pressure', fmt(S.press || 0), ' bar', spark(Hh.press, { cls: S.press && S.press < 1050 ? 'bad' : '' })), ro('Cavity fill', (S.fill || 0).toFixed(1), ' %'), ro('Barrel', (S.temp || 0).toFixed(0), ' °C'), ro('Shots on this mould', fmt(s.shots || 0), ''));
    else if (s.kind === 'oven') rows.push(ro('Cure temperature', (S.temp || 0).toFixed(1), ' °C', spark(Hh.temp, { limit: 190, cls: S.temp < 190 ? 'bad' : '' })), ro('Parts in the oven', fmt(s.procs.length), ` of ${s.slots}`));
    else if (s.kind === 'press') rows.push(ro('Tonnage', fmt(S.tonnage || 0), ' t'), ro('Vibration', (S.vib || 0).toFixed(2), ' mm/s', spark(Hh.vib)));
    else if (s.kind === 'cushion') rows.push(ro('Steam', (S.steam || 0).toFixed(2), ' bar'), ro('Mould', (S.temp || 0).toFixed(0), ' °C'));
    else if (s.kind === 'aging') rows.push(ro('TVs ageing', fmt((s.rack || []).length), ` of ${s.slots}`, bar((s.rack || []).length / s.slots)), ro('Chamber', (S.temp || 0).toFixed(1), ' °C'));
    else if (s.kind === 'writer') rows.push(ro('Firmware', esc(P.sw['PBA-' + line(s.line).model.slice(1)].version), ''), ro('Boards written', fmt(s.counters.made), ''));
    rows.push(ro('Power', (s.kwNow || 0).toFixed(1), ' kW', spark(Hh.kw)));
    return `<div class="ros">${rows.join('')}</div>`;
  }
  function timeSplit(s) {
    const c = s.counters, tot = c.run + c.idle + c.starved + c.blocked + c.down || 1;
    const seg = (k, cls, lab) => c[k] ? `<i class="${cls}" style="width:${(c[k] / tot * 100).toFixed(1)}%" title="${lab} ${pct(c[k] / tot, 0)}"></i>` : '';
    return `<div class="split" aria-hidden="true">${seg('run', 'run', 'Running')}${seg('idle', 'idle', 'Idle')}${seg('starved', 'warn', 'Starved')}${seg('blocked', 'idle2', 'Blocked')}${seg('down', 'bad', 'Stopped')}</div>
      <p class="legend-s"><span><i class="run"></i>Running ${pct(c.run / tot, 0)}</span><span><i class="idle"></i>Idle ${pct(c.idle / tot, 0)}</span><span><i class="warn"></i>Starved ${pct(c.starved / tot, 0)}</span><span><i class="idle2"></i>Blocked ${pct(c.blocked / tot, 0)}</span><span><i class="bad"></i>Stopped ${pct(c.down / tot, 0)}</span></p>`;
  }
  function stationDetail(s) {
    const L = line(s.line);
    const prev = L && L.stations[L.stations.indexOf(s) - 1], next = L && L.stations[L.stations.indexOf(s) + 1];
    const feeds = (s.needs || []).map(n => { const b = n.b, lv = E.level(b); return `<li>${link('buf:' + b.id, b.label)}<span>${fmt(lv)} on hand · ${b.rate > 1e-4 ? 'lasts ' + mins(lv / b.rate) : 'not used now'} · ${b.feed === 'agv' ? 'AGV' : b.feed === 'conveyor' ? 'conveyor from the cushion machine' : 'milk run ' + b.feed}</span></li>`; }).join('');
    const now = s.batchOut ? '' : (s.kind === 'aging' ? (s.rack || []).slice(0, 8) : s.procs.map(p => p.u)).filter(Boolean).map(u => `<li>${unitLink(u)}<span>${esc(MODELS[u.model] ? MODELS[u.model].name : '')}</span></li>`).join('');
    const recs = P.recs.filter(r => r.ref === s.id);
    const evs = P.events.filter(e => e.ref === s.id).slice(0, 6);
    const rul = s.state === 'down' ? `<b class="bad">failed</b> · ${s.tech ? (s.tech.state === 'repairing' ? `repair ${mins(Math.max(0, s.repair))} left` : 'technician on the way') : 'waiting for a technician'}` : s.state === 'maint' ? `planned work · ${mins(Math.max(0, s.repair))} left` : s.degrade > 0 ? `<b class="bad">${mins((s.health - 22) / s.degrade)}</b>` : s.health < 60 ? '<b class="warn">service soon</b>' : 'no failure expected this shift';
    const who = [...(s.crew || []).map(p => `${esc(p.name)}${p.present ? '' : ' (absent)'}${p.cover ? ` · covering (${esc(p.cover)})` : ''}`), s.tech ? `${esc(s.tech.name)} · technician` : ''].filter(Boolean).join('<br>');
    const out = s.kind === 'injection' ? kv([['Part', `${esc(s.part)} · mould ${esc(s.mold)}`], ['Cycle', `${s.base} s · ${s.batchOut} ${s.batchOut > 1 ? 'parts' : 'part'} a shot`], ['Goes to', link('buf:INJ:' + s.part, 'Injection supermarket')]]) : '';
    return head(s.name, `${esc(L ? L.name : 'Support')} · ${esc(KINDN[s.kind] || s.kind)}`, `<p class="ih-st">${chip(s.state === 'idle' && L && L.tripped ? 'tripped' : s.state, s.why)} <small>for ${mins(P.t - s.since)}</small></p>`)
      + show3d()
      + (recs.length ? sect('Needs a decision', recCards(recs, X)) : '')
      + sect('Live signals', sensorsBlock(s))
      + (out ? sect('Moulding', out) : '')
      + sect('Condition', kv([['Health', `${s.health.toFixed(0)}%`], ['Failure forecast', rul], ['Short stops', fmt(s.stops || 0)]]))
      + sect('Output', kv([['Units done', fmt(s.counters.made)], ['Rejected here', fmt(s.counters.bad)], L && L.kind === 'main' ? ['Line OEE', `${pct(L.oee)} = ${pct(L.avail, 0)} × ${pct(L.perf, 0)} × ${pct(L.qual, 1)}`] : null]) + timeSplit(s))
      + (now ? sect('Now inside', `<ul class="li">${now}</ul>`) : '')
      + (feeds ? sect('Fed by', `<ul class="li">${feeds}</ul>`) : '')
      + sect('Linked to', kv([prev && ['Upstream', stLink(prev.id)], next && ['Downstream', stLink(next.id)], L && ['Line', link('line:' + L.id, L.name)], who && ['People', who]]))
      + sect('Events here', evRows(evs));
  }

  function lineDetail(L) {
    const n = L.id.replace(/\D/g, ''), o = X.pp.find(p => p.line === L.id && p.status !== 'TECO');
    const sts = L.stations.map(s => `<li>${stLink(s.id)}<span>${chip(s.state, s.why)}</span></li>`).join('');
    const feeders = L.kind === 'main' ? [line('LCM' + n), line('SMD' + n), line('CUS' + n)].map(f => `<li>${link('line:' + f.id, f.name)}<span>${chip(f.state)} · ${fmt(f.tph)}/h${f.kind === 'smd' ? ' · PBA ' + f.model.slice(1) + ' · firmware ' + esc(P.sw['PBA-' + f.model.slice(1)].version) : ''}</span></li>`).join('') : '';
    const ls = L.ls ? Object.values(L.ls).map(b => `<li>${link('buf:' + b.id, b.label)}<span>${fmt(E.level(b))} of ${fmt(b.cap)} ${bar(E.level(b) / b.cap, E.level(b) <= b.rop * 0.5 ? 'warn' : '')}</span></li>`).join('') : '';
    return head(L.name, `${L.model ? esc(MODELS[L.model] ? MODELS[L.model].name : L.model) : ''}${L.kind === 'press' ? 'Chassis ' + L.size + '"' : ''} · ${L.stations.length} stations`, `<p class="ih-st">${chip(L.state)} <small>${fmt(L.tph)} an hour</small></p>`)
      + show3d()
      + sect('Performance', kv([['OEE', `${pct(L.oee)} = ${pct(L.avail, 0)} × ${pct(L.perf, 0)} × ${pct(L.qual, 1)}`], ['Output today', fmt(L.kind === 'main' ? L.made + Math.round(P.base[L.model] / Object.values(P.lines).filter(x => x.kind === 'main' && x.model === L.model).length) : L.stations[L.stations.length - 1].counters.made)], o && ['SAP production order', `${esc(o.id)} · ${fmt(X.ppProgress(o))} of ${fmt(o.qty)} confirmed`]]))
      + (feeders ? sect('Sub-lines feeding it', `<ul class="li">${feeders}</ul>`) : '')
      + (ls ? sect('Line-side stock', `<ul class="li">${ls}</ul>`) : '')
      + sect('Stations', `<ul class="li">${sts}</ul>`)
      + (L.kind === 'main' ? `<div class="ia"><button type="button" class="btn btn-secondary btn-sm" data-act="boost:${L.id}" data-key="boost">Raise line speed to 108%</button></div>` : '');
  }

  function bufferDetail(id) {
    const b = P.bufs[id]; if (!b) return plantNow();
    const lv = E.level(b);
    const store = id.split(':')[0];
    const lots = b.lots && b.lots.length ? `<ul class="li">${b.lots.slice(0, 8).map(l => `<li><b>${esc(l.id)}</b><span>${fmt(l.qty)} ${esc(b.unit || 'pcs')} · ${esc(l.src || '')}${P.holds.has(l.id) ? ' · <b class="bad">on hold</b>' : ''}${l.concession ? ' · concession' : ''}</span></li>`).join('')}${b.lots.length > 8 ? `<li><span>+${b.lots.length - 8} more lots</span></li>` : ''}</ul>` : '';
    const items = b.items && b.items.length ? `<p class="sns">${b.items.slice(-8).reverse().map(unitLink).join(' ')}${b.items.length > 8 ? ` +${b.items.length - 8}` : ''}</p>` : '';
    const pos = X.po.filter(p => p.code === b.code && p.status !== 'Closed').map(p => `<li>${link('po:' + p.id, 'PO ' + p.id)}<span>${fmt(p.qty)} · ${esc(p.status)} · ${p.eta - P.t > 86400 ? `in ${Math.round((p.eta - P.t) / 86400)} days` : 'ETA ' + clock(p.eta)}</span></li>`).join('');
    const users = Object.values(E.LS).filter(x => x.src === id).map(x => `<li>${link('buf:' + x.id, P.byId[x.station].name + ' · ' + line(x.line).name)}<span>${fmt(E.level(x))} line-side · ${x.feed === 'agv' ? 'AGV' : 'milk run ' + x.feed}</span></li>`).join('');
    const blk = X.blocked.filter(x => x.buf === id).map(x => `<li><b class="bad">${fmt(x.qty)} blocked</b><span>${esc(x.reason)}</span></li>`).join('');
    if (id.startsWith('LS:')) {
      const st = P.byId[b.station], m = b.mission;
      return head(b.label, `Line-side stock at ${stLink(st.id)} · ${esc(line(st.line).name)}`)
        + show3d()
        + sect('Stock', kv([['On hand', `<b>${fmt(lv)}</b> of ${fmt(b.cap)}`], ['Lasts', b.rate > 1e-4 ? mins(lv / b.rate) : 'not used now'], ['Reorder point', `${fmt(b.rop)} · ${b.feed === 'agv' ? 'an AGV' : b.feed === 'conveyor' ? 'the conveyor' : 'milk run ' + b.feed} brings ${fmt(b.batch)}`], b.src !== 'conv' && ['Comes from', link('buf:' + b.src, P.bufs[b.src].label)]]) + bar(lv / b.cap, lv <= 0 ? 'bad' : lv <= b.rop ? 'warn' : ''))
        + sect('Delivery', m ? kv([['Mission', `${esc(m.id)} · ${esc(m.reason)}`], ['Vehicle', m.veh ? link('agv:' + m.veh.id, m.veh.id) : 'waiting for a free AGV']]) : b.pending ? `<p class="quiet">On the next milk-run lap: ${fmt(b.pending)} planned.</p>` : '<p class="quiet">No delivery needed yet.</p>')
        + (lots ? sect('Lots here', lots) : '') + (items ? sect('Boards here', items) : '');
    }
    const label = { IMP: 'Import warehouse', LOC: 'Local-vendor supermarket', INJ: 'Injection supermarket', PRS: 'Chassis supermarket', PBA: 'PBA supermarket', SVC: 'Service-parts store', SILO: 'Silo', HALL: 'Hall store', WIP: 'Work in process' }[store] || 'Store';
    const mt = E.MAT[b.code];
    return head(b.label || b.code, `${label}${mt && mt.vendor ? ' · ' + esc(mt.vendor) : ''}`)
      + show3d()
      + sect('Stock', kv([['On hand', `<b>${fmt(lv)}</b> ${esc(b.unit || 'pcs')} of ${fmt(b.cap)}`], ['Used today', fmt(b.used)], b.rw && isFinite(b.rw) && ['Covers', mins(b.rw) + ' of assembly'], mt && ['Value', egp(lv * mt.price)], mt && mt.lt !== undefined && ['Lead time', `${mt.lt} days`]]) + bar(lv / b.cap, lv / b.cap < 0.12 ? 'bad' : lv / b.cap < 0.25 ? 'warn' : ''))
      + (blk ? sect('Blocked stock', `<ul class="li">${blk}</ul>`) : '')
      + (pos ? sect('Purchase orders', `<ul class="li">${pos}</ul>`) : '')
      + (users ? sect('Feeds', `<ul class="li">${users}</ul>`) : '')
      + (mt && (mt.src === 'import' || mt.src === 'local') ? `<div class="ia"><button type="button" class="btn btn-secondary btn-sm" data-ref="mrp:${esc(b.code)}" data-key="mrp">Open ${esc(b.code)} in MRP</button></div>` : '')
      + (lots ? sect('Lots', lots) : '') + (items ? sect('Newest boards', items) : '');
  }

  function vehicleDetail(a) {
    if (a.kind === 'tugger') {
      const pl = a.plan;
      return head(a.id, `Milk-run train · ${esc(a.routeName)} · three carts`, `<p class="ih-st">${chip(a.fault ? 'down' : a.path ? 'run' : 'idle', a.path ? (a.phase === 'picking' ? 'Picking' : a.phase === 'delivering' ? 'Delivering' : 'Returning') : 'Waiting for its timetable')}</p>`)
        + show3d()
        + sect('This lap', pl ? `<ul class="li">${pl.loads.map(l => `<li>${link('buf:' + l.b.id, `${l.b.code} → ${P.byId[l.b.station].name} (${line(l.b.line).name})`)}<span>${l.got ? fmt(l.got.qty) + ' loaded' : fmt(l.need) + ' to pick at ' + esc(l.src.label)}</span></li>`).join('')}</ul>` : '<p class="quiet">Starts every 12 minutes, or earlier when a stop is urgent.</p>')
        + sect('Train', kv([['Laps today', fmt(a.laps)], ['Last lap', mins(a.lapLen)], ['Driven', `${a.km.toFixed(1)} km`], ['Driver', esc(a.driver ? a.driver.name : '—')]]))
        + `<div class="ia"><button type="button" class="btn btn-secondary btn-sm" data-follow data-key="follow">${icon('eye')}${V && V.follow ? 'Stop following' : 'Follow in 3D'}</button></div>`;
    }
    if (a.kind === 'forklift') {
      const j = a.job;
      return head(a.id, `Forklift · ${a.role === 'fg' ? 'finished goods and docks' : 'silos and hall stores'} · ${esc(a.driver ? a.driver.name : '')}`, `<p class="ih-st">${chip(a.path ? 'run' : 'idle', j ? (j.kind === 'store' ? 'Storing a pallet' : `Loading ${j.truck.id}`) : a.mission ? 'Refilling ' + a.mission.buf.label.toLowerCase() : 'Waiting')}</p>`)
        + show3d()
        + sect('Job', j ? kv([['Pallet', link('pal:' + j.pallet.id, j.pallet.id)], j.truck && ['Truck', link('truck:' + j.truck.id, j.truck.id)], ['Step', j.phase === 'toPallet' ? 'Going to the pallet' : j.phase === 'toSlot' ? 'Taking it to its bay' : 'Taking it to the truck']]) : a.mission ? kv([['Brings', `${fmt(a.mission.qty)} ${esc(a.mission.buf.code)}`], ['From', link('buf:' + a.mission.src.id, a.mission.src.label)], ['To', link('buf:' + a.mission.buf.id, a.mission.buf.label)]]) : '<p class="quiet">No job.</p>')
        + `<div class="ia"><button type="button" class="btn btn-secondary btn-sm" data-follow data-key="follow">${icon('eye')}${V && V.follow ? 'Stop following' : 'Follow in 3D'}</button></div>`;
    }
    const m = a.mission;
    return head(a.id, 'Automated guided vehicle · PBA boards', `<p class="ih-st">${chip(a.fault ? 'down' : a.state === 'idle' ? 'idle' : 'run', a.fault || (a.state === 'idle' ? 'Parked' : a.load ? 'Carrying' : 'Driving'))}</p>`)
      + show3d()
      + sect('Mission', m ? kv([['Brings', `${fmt(m.qty)} × ${esc(m.buf.code)}`], ['From', link('buf:' + m.src.id, m.src.label)], ['To', `${stLink(m.buf.station)} · ${esc(line(m.buf.line).name)}`], ['Why', esc(m.reason)], ['Arrives', m.eta ? clock(m.eta) : '—']]) : '<p class="quiet">No mission. Parked and ready.</p>')
      + sect('Vehicle', kv([['Battery', `${Math.round(a.battery)}% ${bar(a.battery / 100, a.battery < 25 ? 'warn' : '')}`], ['Driven today', `${a.km.toFixed(1)} km`]]))
      + `<div class="ia"><button type="button" class="btn btn-secondary btn-sm" data-follow data-key="follow">${icon('eye')}${V && V.follow ? 'Stop following' : 'Follow in 3D'}</button></div>`;
  }

  function unitDetail(sn) {
    const u = E.findUnit(sn);
    if (!u) return head('Not found', `No unit with serial ${esc(sn)} in today's records.`);
    const name = u.type === 'tv' ? 'TV' : u.type === 'lcm' ? 'Panel module (LCM)' : 'Main board (PBA)';
    const steps = u.steps.map(s => `<li class="${s.ok === false ? 'bad' : ''}"><time>${clock(s.t0)}</time><div><b>${P.byId[s.st] ? stLink(s.st) : esc(s.name)}</b>${s.t1 ? `<small>${Math.max(1, Math.round(s.t1 - s.t0))} s</small>` : '<small>in progress</small>'}${s.by ? `<small>${esc(s.by)}</small>` : ''}${s.note ? `<p>${esc(s.note)}</p>` : ''}</div></li>`).join('');
    const sub = p => p ? `<li>${unitLink(p)}<span>${p.type === 'pba' ? `Main board · ${esc(line(p.line) ? line(p.line).name : p.line)} · firmware ${esc(p.sw || '—')}${p.repaired ? ' · repaired once' : ''}` : `Panel module · ${esc(line(p.line) ? line(p.line).name : '')} · open cell lot ${esc(p.lots.oc || '—')}, BLU lot ${esc(p.lots.blu || '—')}`}</span></li>` : '';
    const lotRows = Object.entries(u.lots || {}).map(([k, l]) => `<li><b>${esc({ smps: 'Power board', bc: 'Back cover', chs: 'Chassis', std: 'Stand', cus: 'Cushion', ctn: 'Carton', acc: 'Accessories', oc: 'Open cell', blu: 'Backlight', pcb: 'Bare PCB' }[k] || k)}</b><span>lot ${esc(l)}${P.holds.has(l) ? ' · <b class="bad">on hold</b>' : ''}</span></li>`).join('');
    const ship = kv([u.pallet && ['Pallet', link('pal:' + u.pallet, u.pallet)], u.order && ['Order', link('order:' + u.order, u.order)], u.truck && ['Truck', esc(u.truck)], u.svcOrder && ['Service order', esc(u.svcOrder)]]);
    return head(`${name} ${u.sn}`, `${esc(MODELS[u.model] ? MODELS[u.model].name : '')} · started ${clock(u.born)}`, `<p class="ih-st">${u.defect ? chip('down', u.defect.code) : chip('run', u.packed ? 'Packed' : 'Good so far')} <small>${esc(where(u))}</small></p>`)
      + `<div class="ia"><button type="button" class="btn btn-secondary btn-sm" data-follow data-key="follow">${icon('eye')}${V && V.follow ? 'Stop following' : 'Follow in 3D'}</button></div>`
      + (u.defect ? sect('Defect', kv([['Found at', stLink(u.defect.at)], ['Cause', esc(u.defect.cause)]])) : '')
      + sect('Passport', `<ol class="pass">${steps || '<li>No steps yet</li>'}</ol>`, `${u.steps.length} records`)
      + (u.parts.lcm || u.parts.pba ? sect('Sub-assemblies and their history', `<ul class="li">${sub(u.parts.lcm)}${sub(u.parts.pba)}</ul>`) : '')
      + (lotRows ? sect('Material lots', `<ul class="li">${lotRows}</ul>`) : '')
      + (u.usedIn ? sect('Used in', kv([['Built into', link('unit:' + u.usedIn, u.usedIn)], ['At', clock(u.usedAt)]])) : '')
      + (ship.includes('<div>') ? sect('Shipping', ship) : '');
  }
  function orderDetail(id) {
    const o = P.orders.find(x => x.id === id); if (!o) return plantNow();
    const m = MODELS[o.model];
    return head(`Sales order ${o.id}`, `${esc(o.customer)} · ${esc(o.channel)} · ${fmt(o.qty)} × ${esc(m.name)}`)
      + show3d()
      + sect('Promise', kv([['Due', clock(o.due)], ['ATP at entry', o.atp ? `${fmt(o.atp.free)} free in finished goods + ${fmt(o.atp.plan)} planned · ${o.atp.ok ? 'confirmed' : '<b class="warn">short</b>'}` : '—'], ['Value', egp(o.value)], ['Delivery', esc(o.dlv)]]))
      + sect('Shipping', kv([['Status', esc(o.state)], ['Shipped', fmt(o.shipped)], ['Truck', o.truck ? link('truck:' + o.truck.id, `${o.truck.id} at ${o.truck.dock.id}`) : `arrives ${clock(o.due - 50 * 60)}`], o.truck && ['Loaded', `${fmt(o.truck.loaded)} of ${fmt(o.truck.need)} ${bar(o.truck.loaded / o.truck.need)}`]]))
      + sect('Messages', msgRows(X.msgs.filter(x => x.ref === 'order:' + o.id).slice(0, 6)));
  }
  function poDetail(id) {
    const p = X.po.find(x => x.id === id); if (!p) return plantNow();
    return head(`Purchase order ${p.id}`, `${esc(p.vendor)} · ${fmt(p.qty)} ${esc(E.MAT[p.code].unit)} ${esc(p.code)}`, `<p class="ih-st">${chip(p.status === 'Held at port' ? 'down' : p.status === 'In transit' ? 'run' : 'idle', p.status)}</p>`)
      + sect('Order', kv([['Material', link('buf:' + E.MAT[p.code].store + ':' + p.code, E.MAT[p.code].name)], ['Why', esc(p.why)], ['Value', egp(p.value)], ['ETA', p.eta - P.t > 86400 ? `in ${Math.round((p.eta - P.t) / 86400)} days` : clock(p.eta)], p.note && ['Note', esc(p.note)], p.truck && ['Truck', esc(p.truck.id)]]));
  }
  function deptDetail(id) {
    const d = X.DEPTS.find(x => x.id === id); if (!d) return plantNow();
    const now = X.deptNow(id), recs = P.recs.filter(r => (r.dept || X.deptOf(r.agent)) === id);
    const sys = new Set(d.systems);
    const msgs = X.msgs.filter(m => sys.has(m.from) || sys.has(m.to) || (sys.has('SAP') && m.from.startsWith('SAP'))).slice(0, 8);
    return head(d.name, `${esc(d.head)} · ${fmt(X.deptStaff(id))} people`)
      + show3d()
      + sect('Now', `<div class="ros">${now.kpis.map(([a, b]) => `<div class="ro2"><span>${esc(a)}</span><b>${esc(b)}</b></div>`).join('')}</div>`)
      + sect('Owns', `<p class="quiet">${esc(d.owns)}</p>`)
      + sect('Works in', `<p class="sns">${d.systems.map(s => link('sys:' + s, s)).join(' ')}</p>`)
      + sect('Decisions', recCards(recs, X) || '<p class="quiet">Nothing waiting for this department.</p>')
      + sect('Its messages', msgRows(msgs));
  }
  function sysDetail(id) {
    const s = X.SYSTEMS.find(x => x.id === id) || { name: id, sub: '' };
    const inn = X.msgs.filter(m => m.to === id || (id === 'SAP' && m.to.startsWith('SAP'))), out = X.msgs.filter(m => m.from === id || (id === 'SAP' && m.from.startsWith('SAP')));
    return head(s.name, esc(s.sub || 'System'))
      + sect('Traffic', kv([['Messages in', fmt(inn.length) + ' (last 400)'], ['Messages out', fmt(out.length)]]))
      + sect('Latest', msgRows(inn.concat(out).sort((a, b) => b.id - a.id).slice(0, 10)))
      + `<div class="ia"><button type="button" class="btn btn-secondary btn-sm" data-mode="sap" data-key="sap">Open SAP and data flow</button></div>`;
  }
  function detail(ref) {
    const [k, id] = ref.split(/:(.+)/);
    if (k === 'st') { const s = P.byId[id]; return s ? stationDetail(s) : plantNow(); }
    if (k === 'line') { const L = line(id); return L ? lineDetail(L) : plantNow(); }
    if (k === 'buf') return bufferDetail(id);
    if (k === 'agv' || k === 'tug' || k === 'fl') { const a = P.agvs.concat(P.tuggers, P.forklifts).find(x => x.id === id); return a ? vehicleDetail(a) : plantNow(); }
    if (k === 'unit') return unitDetail(id);
    if (k === 'order') return orderDetail(id);
    if (k === 'po') return poDetail(id);
    if (k === 'dept') return deptDetail(id);
    if (k === 'sys') return sysDetail(id);
    if (k === 'mrp') { const r = X.mrp.rows[id]; return r ? bufferDetail(E.MAT[id].store + ':' + id) : plantNow(); }
    if (k === 'truck') {
      const t = P.trucks.find(x => x.id === id); if (!t) return plantNow();
      return head(t.id, `${t.dock.id} · order ${esc(t.order.id)}`) + show3d()
        + sect('Loading', kv([['Order', link('order:' + t.order.id, `${t.order.id} · ${t.order.customer}`)], ['Loaded', `${fmt(t.loaded)} of ${fmt(t.need)} × ${esc(MODELS[t.model].name)}`], ['Pallets', fmt(t.pallets.length)], ['Arrived', clock(t.arrived)], ['Leaves', t.state === 'leaving' ? 'now' : `when full, or ${clock(t.order.due + 20 * 60)} at the latest`]]) + bar(t.loaded / t.need));
    }
    if (k === 'inbound') {
      const t = P.inbound.find(x => x.id === id); if (!t) return plantNow();
      return head(t.id, `${t.area === 'IMP' ? 'Import container' : 'Vendor truck'} · ${esc(t.po || '')}`) + show3d()
        + sect('Load', `<ul class="li">${t.lines.map(l => `<li>${link('buf:' + E.MAT[l.code].store + ':' + l.code, `${fmt(l.qty)} ${l.code}`)}<span>lot ${esc(l.lot)}</span></li>`).join('')}</ul>`)
        + sect('Progress', kv([['Status', t.state === 'unloading' ? `Unloading at ${esc(t.dock.id)}` : t.state === 'due' ? `Due ${clock(t.at)}` : 'Received'], ['Unloaded', `${Math.round(Math.min(1, t.k) * 100)}% ${bar(t.k)}`]]));
    }
    if (k === 'pal') {
      const p = P.pallets.find(x => x.id === id); if (!p) return plantNow();
      return head(`Pallet ${p.id}`, `${esc(MODELS[p.model].name)} · ${p.units.length} of ${p.cap} · ${esc(line(p.line).name)}`) + show3d()
        + sect('Where', kv([['Now', p.where === 'build' ? 'Being built at the palletizer' : p.where === 'pickup' ? 'Wrapped, waiting for a forklift' : p.where === 'fork' ? 'On a forklift' : p.where === 'fg' ? 'Finished-goods bay' : p.where === 'truck' ? `On ${p.truck ? p.truck.id : 'a truck'}` : p.where], ['Completed', p.built ? clock(p.built) : '—'], p.truck && ['Order', link('order:' + p.truck.order.id, p.truck.order.id)]]))
        + sect('TVs on it', `<p class="sns">${p.units.map(unitLink).join(' ')}</p>`);
    }
    if (k === 'person') {
      const p = P.people.find(x => x.id === id); if (!p) return plantNow();
      const st = P.byId[p.at];
      return head(p.name, esc(p.role)) + show3d() + sect('Now', kv([['Where', st ? stLink(st.id) : P.lines[p.at] ? link('line:' + p.at, P.lines[p.at].name) : p.rides ? esc(p.rides.id) : 'Maintenance shop'], ['Present', p.present ? (p.cover ? `yes · covering (${esc(p.cover)})` : 'yes') : '<b class="warn">absent today</b>'], p.role === 'Technician' && ['Doing', p.state === 'available' ? 'Available in the shop' : p.state === 'walking' ? `Walking to ${esc(p.job ? p.job.name : 'a machine')}` : p.state === 'repairing' ? `Repairing ${esc(p.job ? p.job.name : '')}` : 'Returning to the shop']]));
    }
    if (k === 'util') {
      const u = P.util.assets.find(x => x.id === id); if (!u) return plantNow();
      return head(u.name, 'Utilities') + show3d() + sect('Now', kv([['Power', `${u.kw.toFixed(0)} kW`], ['Outside air', `${P.util.ambient.toFixed(1)} °C`], ['Plant total', `${fmt(P.kpi.kw)} kW`]]) + spark(P.hist.kw));
    }
    if (k === 'zone') {
      const z = P.layout.ZONES.find(x => x.id === id); if (!z) return plantNow();
      const sts = P.stations.filter(s => s.x >= z.x0 && s.x <= z.x1 && s.z >= z.z0 && s.z <= z.z1);
      const lines = [...new Set(sts.map(s => s.line))].map(l => line(l)).filter(Boolean);
      return head(z.name, `${sts.length} stations`) + show3d() + sect('Lines here', lines.length ? `<ul class="li">${lines.map(L => `<li>${link('line:' + L.id, L.name)}<span>${chip(L.state)} · ${fmt(L.tph)}/h</span></li>`).join('')}</ul>` : '<p class="quiet">Stores, vehicles and docks: select one in the view.</p>');
    }
    return plantNow();
  }

  /* readout panels opened from the KPI strip */
  function kpiPanel(k) {
    const mains = Object.values(P.lines).filter(L => L.kind === 'main');
    if (k === 'oee' || k === 'overview' || k === 'forecast') {
      const rows = mains.map(L => `<tr><td>${link('line:' + L.id, L.name)}<small>${esc(MODELS[L.model].name)}</small></td><td>${pct(L.avail, 0)}</td><td>${pct(L.perf, 0)}</td><td>${pct(L.qual, 1)}</td><td><b>${pct(L.oee)}</b></td></tr>`).join('');
      const byM = Object.values(MODELS).map(m => `<li><b>${esc(m.name)}</b><span>${fmt(P.base[m.id] + P.made.byModel[m.id])} packed · ${fmt(X.fgQty(m.id))} in finished goods</span></li>`).join('');
      return head(k === 'forecast' ? 'Shift forecast' : 'Main-line performance', k === 'forecast' ? `End of shift A (14:00): <b>${fmt(P.kpi.fcst)}</b> forecast against a plan of ${fmt(P.kpi.planEnd)} · ${pct(P.kpi.prob, 0)} likely` : 'OEE = availability × performance × quality, last 30 minutes')
        + sect('By line', `<table class="tbl"><thead><tr><th>Line</th><th>Avail.</th><th>Perf.</th><th>Quality</th><th>OEE</th></tr></thead><tbody>${rows}</tbody></table>`)
        + sect('By model', `<ul class="li">${byM}</ul>`)
        + sect('Throughput', spark(P.hist.tph, { h: 70 }), 'TVs an hour') + sect('Work in process', kv([['TVs on the lines', fmt(P.kpi.wip)], ['Average lead time, panel to packed', mins(P.kpi.lead)]]));
    }
    if (k === 'energy') {
      const top = P.stations.slice().sort((a, b) => b.kwNow - a.kwNow).slice(0, 8).map(s => `<li>${stLink(s.id)}<span>${s.kwNow.toFixed(1)} kW · ${esc(line(s.line) ? line(s.line).name : '')}</span></li>`).join('');
      const util = P.util.assets.map(u => `<li>${link('util:' + u.id, u.name)}<span>${u.kw.toFixed(0)} kW</span></li>`).join('');
      return head('Energy', `${fmt(P.kpi.kw)} kW now · ${fmt(P.energy.kwh)} kWh since 09:12 · outside ${P.util.ambient.toFixed(1)} °C`)
        + sect('Plant demand', spark(P.hist.kw, { h: 70 })) + sect('Largest machine loads', `<ul class="li">${top}</ul>`) + sect('Utilities', `<ul class="li">${util}</ul>`);
    }
    if (k === 'orders') return head('Orders today', `${pct(P.kpi.otif, 0)} of shipped orders left on time`) + sect('Open', ordersTable(P.orders.filter(o => o.state === 'open' || o.state === 'loading').sort((a, b) => a.due - b.due))) + sect('Shipped', ordersTable(P.orders.filter(o => o.shippedAt).sort((a, b) => b.shippedAt - a.shippedAt).slice(0, 12)));
    if (k === 'finance') {
      const f = X.finance();
      return head('Finance today', 'Revenue, product cost and inventory from SAP FI/CO')
        + sect('Profit', kv([['Revenue', egp(f.revenue)], ['Cost of goods sold', egp(f.cogs)], ['Gross margin', `${egp(f.margin)} · ${pct(f.marginPct)}`], ['TVs invoiced', fmt(f.units)]]))
        + sect('Inventory', kv([['Materials and parts', egp(f.inventory)], ['Work in process', egp(f.wip)], ['Finished goods', egp(f.fg)], ['Total', `<b>${egp(f.total)}</b>`], ['Open purchase orders', egp(f.poOpen)]]))
        + sect('Cost of decisions', kv([['Expediting and fees', egp(f.expedite)], ['Overtime', egp(f.overtime)], ['Rework', egp(f.rework)], ['Output protected', egp(f.saved)]]));
    }
    if (k === 'alarms') {
      const rows = P.alarms.map(a => `<li class="p${a.prio}"><time>${a.time}</time><span><b>P${a.prio} · ${esc(a.area)}</b> ${esc(a.msg)}</span>${a.ref ? `<button type="button" class="lnk" data-ref="${esc(refFromFocus(a.ref))}">Show</button>` : ''}</li>`).join('');
      return head('Active alarms', 'ISA-18.2 priorities: P1 act now, P2 act soon, P3 and P4 plan it') + sect('Alarms', rows ? `<ol class="al">${rows}</ol>` : '<p class="quiet">No active alarms.</p>');
    }
    if (k === 'fpy') {
      const q = X.quality();
      const ins = P.stations.filter(s => s.kind === 'fct' || s.kind === 'qa').map(s => { const t = s.counters.made + s.counters.bad; return `<li>${stLink(s.id)}<span>${t ? pct(1 - s.counters.bad / t, 2) : '—'} pass · ${fmt(s.counters.bad)} rejected · ${esc(line(s.line).name)}</span></li>`; }).join('');
      const iqc = X.iqc.slice(0, 6).map(l => `<li><b>IQC ${esc(l.id)} · ${esc(l.code)}</b><span>${fmt(l.qty)} from ${esc(l.vendor)} · ${esc(l.state)}</span></li>`).join('');
      return head('Quality', 'First-pass yield, incoming inspection and holds') + sect('Now', kv([['First-pass yield', pct(P.kpi.fpy || 0.99, 2)], ['Defects per million', fmt(q.dppm)], ['Rework queue', fmt(q.rework)], ['PBA repair queue', fmt(q.smtRepair)], ['Holds', fmt(q.holds)], ['OQC audits passed', fmt(q.oqc)]]))
        + sect('Inspection points', `<ul class="li">${ins}</ul>`) + sect('Incoming inspection (IQC)', `<ul class="li">${iqc}</ul>`);
    }
    return plantNow();
  }

  /* ---------------- readouts ---------------- */
  function kpis() {
    const k = P.kpi;
    $('#clock').textContent = clockS(P.t);
    $('#kOut').textContent = fmt(k.units);
    const ahead = k.units - k.plan;
    $('#kOutS').innerHTML = `<span class="${ahead < -150 ? 'bad' : ahead < 0 ? 'warn' : ''}">${ahead >= 0 ? '+' : ''}${fmt(ahead)} vs plan</span> · ${fmt(k.tph)} an hour`;
    $('#kFc').textContent = fmt(k.fcst);
    $('#kFcS').innerHTML = `<span class="${k.prob < 0.5 ? 'bad' : k.prob < 0.8 ? 'warn' : ''}">${pct(k.prob, 0)} likely</span> to hit ${fmt(k.planEnd)}`;
    $('#kOee').textContent = pct(k.oee || 0);
    $('#kOee').className = (k.oee || 0) < 0.65 ? 'bad' : (k.oee || 0) < 0.78 ? 'warn' : '';
    $('#kFpy').textContent = pct(k.fpy, 2);
    const shipped = P.orders.filter(o => o.state === 'shipped' || o.state === 'late' || o.state === 'partial');
    $('#kOtif').textContent = shipped.length ? pct(k.otif, 0) : '—';
    const open = P.orders.filter(o => o.state === 'open' || o.state === 'loading');
    $('#kOtifS').textContent = `${shipped.length} shipped · ${open.length} open`;
    const f = X.finance();
    $('#kRev').textContent = egp(f.revenue);
    $('#kRevS').textContent = `margin ${pct(f.marginPct)} · stock ${egp(f.total)}`;
    $('#kKw').textContent = fmt(k.kw) + ' kW';
    $('#kKwS').textContent = `${fmt(P.energy.kwh)} kWh since 09:12`;
    $('#kAl').textContent = fmt(P.alarms.length);
    const p1 = P.alarms.filter(a => a.prio === 1).length, p2 = P.alarms.filter(a => a.prio === 2).length;
    $('#kAl').className = p1 ? 'bad' : p2 ? 'warn' : '';
    $('#kAlS').textContent = `${p1} P1 · ${p2} P2`;
    const h = Math.floor(P.t / 3600) % 24;
    $('#shift').textContent = h >= 6 && h < 14 ? 'Shift A · 06–14' : h >= 14 && h < 22 ? 'Shift B · 14–22' : 'Shift C · 22–06';
    const n = P.recs.length, crit = P.recs.filter(r => r.level === 'crit').length;
    const b = $('#decN'); b.textContent = n; b.className = 'badge' + (crit ? ' bad' : n ? ' warn' : '');
    const last = X.msgs[0];
    $('#sync span').textContent = last ? `SAP and GMES in sync · last message ${last.time}` : 'SAP and GMES in sync';
  }
  $$('.pl-kpis .ro').forEach(b => b.addEventListener('click', () => select('kpi:' + b.dataset.go)));

  /* ---------------- value stream: vendor to customer ---------------- */
  function vstream() {
    const lv = st => Object.values(E.STORE[st]).reduce((a, b) => a + (b.items ? b.items.length : 0) + (b.items ? 0 : b.qty / b.cap), 0);
    const cover = st => { const bs = Object.values(E.STORE[st]).filter(b => !b.items); return bs.length ? Math.min(...bs.map(b => b.qty / b.cap)) : 1; };
    const mains = Object.values(P.lines).filter(L => L.kind === 'main');
    const subs = k => Object.values(P.lines).filter(L => L.kind === k);
    const stateOf = ls => ls.some(L => L.state === 'down' || L.state === 'tripped') ? 'bad' : ls.some(L => L.state === 'starved' || L.state === 'warn' || L.state === 'changeover') ? 'warn' : '';
    const inb = X.po.filter(p => p.status === 'In transit' && p.eta - P.t < 3 * 3600).length, held = X.po.filter(p => p.status === 'Held at port').length;
    const pbaLow = Object.values(E.STORE.PBA).some(b => b.items.length < 25);
    const fgPal = P.pallets.filter(p => p.where === 'fg').length;
    const nodes = [
      { ref: 'buf:IMP:OC-55', t: 'Vendors', v: `${inb} trucks`, s: held ? `${held} held at port` : 'arriving in 3 h', cls: held ? 'bad' : '' },
      { ref: 'zone:imp', t: 'Stores', v: `${pct(cover('IMP'), 0)} · ${pct(cover('LOC'), 0)}`, s: 'lowest import · local', cls: cover('IMP') < 0.12 || cover('LOC') < 0.12 ? 'bad' : cover('IMP') < 0.25 || cover('LOC') < 0.25 ? 'warn' : '' },
      { ref: 'line:SMD1', t: 'SMD and PBA', v: `${fmt(subs('smd').reduce((a, L) => a + L.tph, 0))}/h`, s: pbaLow ? 'PBA supermarket low' : `${subs('smd').filter(L => L.state !== 'down').length} of 6 lines`, cls: stateOf(subs('smd')) || (pbaLow ? 'warn' : '') },
      { ref: 'line:LCM1', t: 'LCM lines', v: `${fmt(subs('lcm').reduce((a, L) => a + L.tph, 0))}/h`, s: 'panel modules', cls: stateOf(subs('lcm')) },
      { ref: 'zone:inj', t: 'Injection · press', v: `${P.lines.INJ.stations.filter(s => s.state === 'run' || s.state === 'warn').length} · ${subs('press').filter(L => L.state !== 'down').length}`, s: 'machines · press lines', cls: stateOf(subs('press')) || (P.lines.INJ.stations.some(s => s.state === 'down') ? 'warn' : '') },
      { ref: 'tug:' + P.tuggers[0].id, t: 'Milk runs', v: `${P.tuggers.filter(t => t.plan).length} of 5`, s: `${P.tuggers.reduce((a, t) => a + t.laps, 0)} laps today`, cls: '' },
      { ref: 'zone:main', t: 'Main lines', v: `${fmt(mains.reduce((a, L) => a + L.tph, 0))}/h`, s: `OEE ${pct(P.kpi.oee || 0, 0)}`, cls: stateOf(mains) },
      { ref: 'kpi:fpy', t: 'Quality', v: pct(P.kpi.fpy || 0.99, 1), s: `${P.rejects.rework.length} in rework`, cls: (P.kpi.fpy || 1) < 0.97 ? 'bad' : (P.kpi.fpy || 1) < 0.985 ? 'warn' : '' },
      { ref: 'zone:fg', t: 'Finished goods', v: `${fgPal} pallets`, s: `${fmt(Object.keys(MODELS).reduce((a, m) => a + X.fgQty(m), 0))} TVs`, cls: '' },
      { ref: 'kpi:orders', t: 'Customers', v: `${P.trucks.length} trucks`, s: `${pct(P.kpi.otif, 0)} on time`, cls: P.kpi.otif < 0.85 ? 'bad' : P.kpi.otif < 0.95 ? 'warn' : '' },
      { ref: 'kpi:finance', t: 'Invoiced', v: egp(X.fin.revenue), s: `${X.fin.shipments} shipments`, cls: '' }
    ];
    const html = nodes.map(n => `<li><button type="button" class="vs ${n.cls}" data-ref="${esc(n.ref)}"><span>${esc(n.t)}</span><b>${esc(n.v)}</b><small>${esc(n.s)}</small></button></li>`).join('');
    const el = $('#vstream'); if (el.innerHTML !== html && !el.matches(':hover')) el.innerHTML = html;
  }
  $('#vstream').addEventListener('click', e => { const b = e.target.closest('[data-ref]'); if (b) select(b.dataset.ref, { focusPanel: true }); });

  /* ---------------- labels over the 3D view ---------------- */
  const lab = $('#labels');
  const lineLabels = {}, pills = new Map(), lsPills = new Map(), roomLabels = {};
  const selLabel = (() => { const el = document.createElement('div'); el.className = 'lb lb-sel'; el.hidden = true; lab.append(el); return el; })();
  function mk(cls, text, ref) { const el = document.createElement(ref ? 'button' : 'div'); el.className = 'lb ' + cls; el.textContent = text; if (ref) { el.type = 'button'; el.dataset.ref = ref; el.tabIndex = -1; } lab.append(el); return el; }
  if (V) {
    for (const z of P.layout.ZONES) { const el = mk('lb-zone', z.name); V.label(el, () => [(z.x0 + z.x1) / 2, 0.2, z.z0 + 3], 0); }
    for (const L of Object.values(P.lines)) {
      if (!L.stations.length || L.kind === 'injection') continue;
      const s0 = L.stations[0], el = mk('lb-line', L.name, 'line:' + L.id); lineLabels[L.id] = el;
      const off = L.kind === 'smd' ? 1.4 : 2.6;
      V.label(el, () => [s0.x - s0.w / 2 - off - (L.kind === 'press' ? 2.8 : 0), 0.2, s0.z], L.kind === 'main' ? 1 : L.kind === 'cushion' ? 2 : d => d < 110);
    }
    for (const [id, r] of Object.entries(V.ROOMV)) { const d = X.DEPTS.find(x => x.id === id); const el = mk('lb-room', d ? d.name : id, 'dept:' + id); roomLabels[id] = el; V.label(el, () => [r.x, 3.4, r.z], d2 => d2 < 260); }
    for (const [id, t] of [['SAP-PP', 'SAP'], ['GMES', 'GMES'], ['WMS', 'WMS'], ['PLM', 'PLM']]) { const p = V.sysPos(id); const el = mk('lb-sys', t, 'sys:' + (id === 'SAP-PP' ? 'SAP-PP' : id)); V.label(el, () => [p[0], 3.2, p[2]], d => d < 90); }
    for (const s of P.stations) {
      const el = mk('lb-st', s.line === 'INJ' ? `${s.id} · ${s.part}` : s.name); V.label(el, () => [s.x, (s.h || 1) + 0.9, s.z], 2);
      const pill = mk('lb-pill', '', 'st:' + s.id); pill.hidden = true; pills.set(s.id, pill);
      V.label(pill, () => (pill.hidden ? null : [s.x, (s.h || 1) + 2.4, s.z]), () => true);
    }
    for (const b of Object.values(E.LS)) { if (b.feed === 'conveyor') continue; const pill = mk('lb-pill warn', '', 'buf:' + b.id); pill.hidden = true; lsPills.set(b.id, pill); V.label(pill, () => { if (pill.hidden) return null; const r = V.refInfo('buf:' + b.id); return r && [r.x, 1.9, r.z]; }, () => true); }
    for (const a of P.tuggers) { const el = mk('lb-agv', a.id.replace('Milk run ', 'Milk run ')); V.label(el, () => [a.x, 2.2, a.z], d => d < 110); }
    for (const a of P.agvs) { const el = mk('lb-agv', a.id); V.label(el, () => [a.x, 1.4, a.z], 2); }
    V.label(selLabel, () => { if (!sel || selLabel.hidden) return null; const r = V.refInfo(sel); return r && [r.x, (r.y || 0) + (r.h || 1) + 1.4, r.z]; }, () => true);
    lab.addEventListener('click', e => { const b = e.target.closest('[data-ref]'); if (b) select(b.dataset.ref, { focusPanel: true }); });
  }
  function labelsTick() {
    if (!V) return;
    for (const id in lineLabels) {
      const L = line(id), el = lineLabels[id];
      el.textContent = `${L.name}${L.kind === 'main' || L.kind === 'smd' ? ' · ' + (L.kind === 'smd' ? 'PBA ' + L.model.slice(1) : MODELS[L.model].name) : ''} · ${fmt(L.tph)}/h${L.state !== 'run' ? ' · ' + (STATE[L.state] || L.state).toLowerCase() : ''}`;
      el.className = 'lb lb-line ' + SCLS(L.state);
    }
    for (const id in roomLabels) { const n = P.recs.filter(r => (r.dept || X.deptOf(r.agent)) === id).length; const d = X.DEPTS.find(x => x.id === id); roomLabels[id].textContent = `${d ? d.name : id}${n ? ` · ${n} to decide` : ''}`; roomLabels[id].className = 'lb lb-room' + (n ? ' has' : ''); }
    for (const s of P.stations) {
      const pill = pills.get(s.id), long = P.t - s.since;
      const show = s.state === 'down' || s.state === 'maint' || (s.state === 'changeover' && s.line.startsWith('ML')) || (s.state === 'starved' && long > 90 && !s.line.startsWith('SMD')) || s.degrade > 0;
      pill.hidden = !show;
      if (show) { const st = s.degrade > 0 && s.state !== 'down' ? 'warn' : s.state; pill.textContent = `${s.line === 'INJ' ? s.id : s.name} · ${s.degrade > 0 && s.state !== 'down' ? 'failure in ' + mins((s.health - 22) / s.degrade) : (STATE[s.state] || s.state).toLowerCase()}`; pill.className = 'lb lb-pill ' + SCLS(st); }
    }
    for (const [id, pill] of lsPills) { const b = P.bufs[id], lv = E.level(b); const late = lv <= 0; pill.hidden = !late; if (late) { pill.textContent = `${b.code} · empty at ${P.byId[b.station].name}`; pill.className = 'lb lb-pill bad'; } }
    if (sel) { selLabel.hidden = false; selLabel.textContent = labelFor(sel); } else selLabel.hidden = true;
  }
  function labelFor(ref) {
    const [k, id] = ref.split(/:(.+)/);
    if (k === 'st') return P.byId[id] ? P.byId[id].name : id;
    if (k === 'buf') return P.bufs[id] ? (P.bufs[id].label || id) : id;
    if (k === 'dept') { const d = X.DEPTS.find(x => x.id === id); return d ? d.name : id; }
    if (k === 'line') return line(id) ? line(id).name : id;
    return id;
  }

  /* ---------------- hover tooltip ---------------- */
  const tip = $('#tip');
  function hover(h) {
    if (!h) { tip.hidden = true; return; }
    const [k, id] = h.ref.split(/:(.+)/);
    let extra = '';
    if (k === 'st' && P.byId[id]) { const s = P.byId[id]; extra = (STATE[s.state] || s.state) + (s.why ? ' · ' + s.why : ''); }
    if (k === 'agv') { const a = P.agvs.find(x => x.id === id); if (a) extra = a.fault ? 'Fault' : a.mission ? `Bringing ${a.mission.buf.code}` : 'Parked'; }
    if (k === 'buf' && P.bufs[id]) { const b = P.bufs[id]; extra = `${fmt(E.level(b))} of ${fmt(b.cap)}`; }
    if (k === 'unit') { const u = E.findUnit(id); if (u) extra = where(u); }
    if (k === 'dept') extra = 'Select for its numbers, decisions and messages';
    tip.innerHTML = `<b>${esc(h.name)}</b>${extra ? `<span>${esc(extra)}</span>` : ''}`;
    const r = $('#view3d').getBoundingClientRect();
    tip.style.transform = `translate(${Math.min(r.width - 240, h.x - r.left + 14)}px, ${h.y - r.top + 14}px)`;
    tip.hidden = false;
  }

  /* ---------------- views, overlays, speed ---------------- */
  $$('.pl-views [data-view]').forEach(b => b.addEventListener('click', () => {
    if (!V) return;
    $$('.pl-views [data-view]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    const v = b.dataset.view;
    if (v === 'overview') V.view('overview'); else { const z = P.layout.ZONES.find(x => x.id === v); V.view(z.view); }
  }));
  const LEGEND = {
    status: '<span><i class="ok"></i>Running</span><span><i class="warn"></i>Slow, short stop or starved</span><span><i class="bad"></i>Stopped</span><span><i class="maint"></i>Planned work</span>',
    flow: '<span><i class="info"></i>Moving material: conveyors, milk runs, AGVs and forklifts</span>',
    data: '<span><i class="info"></i>Messages between the floor, GMES, SAP and the offices</span>',
    energy: '<span class="ramp"><i></i>Machine power, low to high</span>',
    quality: '<span><i class="warn"></i>Inspection rejecting above normal</span><span><i class="bad"></i>Above 2%</span>',
    people: '<span><i class="warn"></i>Station short of operators, or a cover</span><span><i class="bad"></i>No operator</span>'
  };
  function setOverlay(m) {
    if (V) V.setOverlay(m);
    $$('.pl-overlay [data-overlay]').forEach(x => x.setAttribute('aria-pressed', String(x.dataset.overlay === m)));
    $('#legend').innerHTML = LEGEND[m];
  }
  $$('.pl-overlay [data-overlay]').forEach(b => b.addEventListener('click', () => setOverlay(b.dataset.overlay)));
  setOverlay('status');
  function setSpeed(v) {
    E.setSpeed(v);
    $$('.pl-speed [data-speed]').forEach(x => x.setAttribute('aria-pressed', String(+x.dataset.speed === v)));
  }
  $$('.pl-speed [data-speed]').forEach(b => b.addEventListener('click', () => setSpeed(+b.dataset.speed)));
  addEventListener('themechange', e => { if (V) V.setTheme(e.detail); });

  /* ---------------- walk the floor, fly-through, cameras, x-ray, the plant map ---------------- */
  const navBtns = $$('.pl-nav3d [data-nav]');
  const syncNav = () => { if (!V) return; const st = { walk: V.walking, cine: V.cinematic, cctv: V.cctv, xray: V.xray }; navBtns.forEach(b => b.setAttribute('aria-pressed', String(!!st[b.dataset.nav]))); };
  const coarse = matchMedia('(pointer: coarse)').matches;
  navBtns.forEach(b => b.addEventListener('click', () => {
    if (!V) return;
    const n = b.dataset.nav;
    if (n === 'walk') { if (V.walking) V.setWalk(false); else { const r = sel && V.refInfo(sel); V.setWalk(true, r ? [r.x, r.z + (r.d || 2) / 2 + 2] : null); } }
    if (n === 'cine') V.setCinematic(!V.cinematic);
    if (n === 'cctv') V.setCctv(!V.cctv);
    if (n === 'xray') V.setXray(!V.xray);
    syncNav();
  }));
  const walkHint = $('#walkHint'), joy = $('#joy');
  if (V) V.on((t, d) => {
    if (t === 'walk') {
      syncNav();
      walkHint.hidden = !d; joy.hidden = !d || !coarse;
      walkHint.textContent = coarse ? 'Drag the view to look around · use the pad to walk · select Walk again to leave' : 'Click the view to look with the mouse · W A S D or arrows to walk · Shift to run · Esc twice to leave';
      if (d) toast('Walking the floor at eye height. Machines and conveyors block the way, as on the real floor.', 'info');
    }
    if (t === 'cinematic' || t === 'cctv') syncNav();
  });
  // touch pad for walking on phones and tablets
  { let id = null; const knob = joy.querySelector('i');
    const set = e => { const r = joy.getBoundingClientRect(); let x = (e.clientX - r.left - r.width / 2) / (r.width / 2), y = (e.clientY - r.top - r.height / 2) / (r.height / 2); const m = Math.hypot(x, y); if (m > 1) { x /= m; y /= m; } knob.style.transform = `translate(${x * 28}px, ${y * 28}px)`; V.walkJoy(x, y); };
    joy.addEventListener('pointerdown', e => { id = e.pointerId; joy.setPointerCapture(id); set(e); });
    joy.addEventListener('pointermove', e => { if (e.pointerId === id) set(e); });
    const end = () => { id = null; knob.style.transform = ''; if (V) V.walkJoy(0, 0); };
    joy.addEventListener('pointerup', end); joy.addEventListener('pointercancel', end); }
  // CCTV captions sit over the camera tiles the 3D view draws
  const cctvBox = $('#cctvLabels');
  function cctvTick() {
    if (!V || !V.cctv) { if (cctvBox.childElementCount) cctvBox.innerHTML = ''; return; }
    const rects = V.cctvRects();
    if (cctvBox.childElementCount !== rects.length) cctvBox.innerHTML = rects.map(() => '<div class="cam"><b></b><span></span></div>').join('');
    rects.forEach((R, i) => { const el = cctvBox.children[i]; el.style.cssText = `left:${R.x}px;top:${R.y}px;width:${R.w}px;height:${R.h}px`; el.querySelector('b').textContent = R.c.name; el.querySelector('span').textContent = clockS(P.t); });
  }
  // the plant map: zones, lines and aisles drawn once; vehicles, alarms and the camera drawn live
  const mini = $('#minimap'), mctx = mini.getContext('2d');
  const MW = P.layout.W, MD = P.layout.D;
  let miniBase = null;
  function miniBaseDraw() {
    const c = document.createElement('canvas'); c.width = mini.width * 2; c.height = mini.height * 2; const g = c.getContext('2d'); g.scale(2 * mini.width / MW, 2 * mini.height / MD);
    const css = getComputedStyle(document.body), ink = css.getPropertyValue('--text-3').trim() || '#646B78', line = css.getPropertyValue('--border').trim() || '#ccc', bg = css.getPropertyValue('--surface').trim() || '#fff';
    g.fillStyle = bg; g.fillRect(0, 0, MW, MD);
    g.fillStyle = line; for (const z of P.layout.ZONES) g.fillRect(z.x0, z.z0, z.x1 - z.x0, z.z1 - z.z0);
    g.fillStyle = bg; for (const A of P.layout.AISLES) { const h = A.a[1] === A.b[1]; g.fillRect(Math.min(A.a[0], A.b[0]) - (h ? 0 : 1.2), Math.min(A.a[1], A.b[1]) - (h ? 1.2 : 0), h ? Math.abs(A.b[0] - A.a[0]) : 2.4, h ? 2.4 : Math.abs(A.b[1] - A.a[1])); }
    g.fillStyle = ink; for (const s of P.stations) g.fillRect(s.x - s.w / 2, s.z - s.d / 2, s.w, s.d);
    miniBase = c;
  }
  function miniTick() {
    if (!V || mode !== '3d') return;
    if (!miniBase) miniBaseDraw();
    const w = mini.width, h = mini.height, kx = w / MW, kz = h / MD;
    mctx.clearRect(0, 0, w, h); mctx.drawImage(miniBase, 0, 0, w, h);
    const css = getComputedStyle(document.body);
    mctx.fillStyle = css.getPropertyValue('--danger').trim() || '#E5383B';
    for (const s of P.stations) if (s.state === 'down') { mctx.fillRect(s.x * kx - 2.5, s.z * kz - 2.5, 5, 5); }
    mctx.fillStyle = css.getPropertyValue('--warning').trim() || '#E08A00';
    for (const s of P.stations) if (s.state === 'starved' || s.state === 'changeover') mctx.fillRect(s.x * kx - 1.5, s.z * kz - 1.5, 3, 3);
    mctx.fillStyle = css.getPropertyValue('--text').trim() || '#111';
    for (const a of P.agvs.concat(P.tuggers, P.forklifts)) mctx.fillRect(a.x * kx - 1, a.z * kz - 1, 2, 2);
    const c = V.camPos();
    mctx.save(); mctx.translate(c.x * kx, c.z * kz); mctx.rotate(c.yaw);
    mctx.fillStyle = css.getPropertyValue('--brand-2').trim() || '#2189FF';
    mctx.beginPath(); mctx.moveTo(0, -7); mctx.lineTo(5, 5); mctx.lineTo(0, 2.5); mctx.lineTo(-5, 5); mctx.closePath(); mctx.fill(); mctx.restore();
  }
  mini.addEventListener('click', e => {
    if (!V) return;
    const r = mini.getBoundingClientRect(), x = (e.clientX - r.left) / r.width * MW, z = (e.clientY - r.top) / r.height * MD;
    if (V.walking) V.walkTo(x, z); else V.view([x, z, 70]);
  });
  addEventListener('themechange', () => { miniBase = null; });

  /* ---------------- drills ---------------- */
  const drills = $('#drills'), drillBtn = $('#drillBtn');
  drills.innerHTML = `<p class="menu-h">Start a real-world drill. Watch the cause travel through the lines, the stores and the offices, and the departments respond.</p>` + E.SCENARIOS.map(s => `<button type="button" class="drill" data-drill="${s.id}"><b>${esc(s.title)}</b><span>${esc(s.what)}</span><small>${esc(s.area)} · ${esc(s.chain)}</small></button>`).join('')
    + `<div class="menu-f"><button type="button" class="btn btn-secondary btn-sm" data-ff="600">Fast-forward 10 min</button><button type="button" class="btn btn-secondary btn-sm" data-ff="1800">30 min</button></div>`;
  const openMenu = v => { drills.hidden = !v; drillBtn.setAttribute('aria-expanded', String(v)); if (v) drills.querySelector('button').focus(); };
  drillBtn.addEventListener('click', () => openMenu(drills.hidden));
  const DRILL_TARGET = { bearing: 'st:SMD4-MounterB', shortshot: 'st:IM10', coating: 'st:PR4-Coating', software: 'st:SMD1-SWdownload', container: 'buf:IMP:OC-65', carton: 'buf:LOC:CTN-55', absent: 'line:ML3', field: 'buf:SVC:PBA-55', power: 'util:UTIL-TX1' };
  function runDrill(id) {
    E.trigger(id);
    const sc = E.SCENARIOS.find(s => s.id === id);
    if (sc) toast(`Drill started: ${sc.title}`, 'info');
    select(DRILL_TARGET[id] || null, { focusPanel: true });
  }
  drills.addEventListener('click', e => {
    const d = e.target.closest('[data-drill]'), ff = e.target.closest('[data-ff]');
    if (d) { openMenu(false); runDrill(d.dataset.drill); }
    if (ff) { E.fastForward(+ff.dataset.ff); openMenu(false); toast(`Moved ${+ff.dataset.ff / 60} minutes ahead`, 'info'); render(true); views.render(true); }
  });
  document.addEventListener('click', e => { if (!drills.hidden && !e.target.closest('.pl-drill')) openMenu(false); });

  /* ---------------- serial search ---------------- */
  $('#find').addEventListener('submit', e => {
    e.preventDefault();
    const v = $('#findIn').value.trim(); if (!v) return;
    const u = E.findUnit(v);
    if (u) { if (mode !== '3d' && V) setMode('3d'); select('unit:' + u.sn, { focusPanel: true }); } else toast(`No unit ${v} found today`, 'warning');
  });

  /* ---------------- guided tour ---------------- */
  const cap = $('#caption');
  let tour = null;
  const zoneView = id => { if (mode !== '3d') setMode('3d'); if (V) V.view(P.layout.ZONES.find(z => z.id === id).view); };
  const TOUR = [
    { go: () => { setMode('3d'); if (V) V.view('overview'); select(null); }, t: 'Plant EG-01, live', s: 'Six main TV assembly lines and every line that feeds them: six LCM, six SMD with software download, twenty injection machines, six press and coating lines, six cushion machines. Stores, milk runs, AGVs, forklifts, docks and offices, all moving because the model moves.' },
    { go: () => zoneView('imp'), t: 'Import and local materials', s: 'Open cells, backlights and power boards come by container; boards, cartons, steel and paint from local vendors. Every rack level is a real stock level, every pallet a lot with its vendor.' },
    { go: () => zoneView('smd'), t: 'SMD and PBA', s: 'Six lines print, place, solder and inspect the main boards. The writer downloads the firmware PE released for that board, then ICT and FCT test it before the PBA supermarket.' },
    { go: () => zoneView('lcm'), t: 'LCM lines', s: 'Open cell and backlight become a panel module, bonded in clean air and lit for a test, then cross the aisle on a conveyor bridge into the main line.' },
    { go: () => { const u = [...P.units].find(x => x.type === 'tv' && x.loc && x.loc.k === 'seg' && x.line === 'ML2'); if (u && V) select('unit:' + u.sn, { follow: true }); else zoneView('main'); }, t: 'Follow one TV', s: 'Its passport links the panel module, the main board and its firmware, and the lot of every back cover, chassis, stand, cushion and carton: genealogy from vendor lot to customer truck.' },
    { go: () => { if (V) V.setFollow(false); zoneView('press'); }, t: 'Injection, press and coating', s: 'Back covers and stands are moulded, chassis are stamped, powder-coated and assembled. Milk-run trains take them to the main lines on a twelve-minute timetable.' },
    { go: () => { zoneView('office'); setOverlay('data'); }, t: 'Offices, SAP and GMES', s: 'Every confirmation, goods movement and order is a message. The blue packets fly between the lines, GMES, SAP and the department that owns them.' },
    { go: () => { setOverlay('status'); setMode('sap'); }, t: 'SAP and the data flow', s: 'Sales orders, purchase orders, production orders and every movement type, live: 101, 261, 311, 321, 601.' },
    { go: () => setMode('sop'), t: 'S&OP', s: 'Twelve weeks of demand against capacity. Three plans with their service level, overtime and margin; the approved plan becomes the master schedule.' },
    { go: () => setMode('mrp'), t: 'MRP', s: 'The master schedule exploded through every bill of materials, netted against stock and open orders, offset by each vendor’s lead time.' },
    { go: () => { setMode('3d'); runDrill('container'); }, t: 'Now a problem', s: 'The QLED 65 open-cell container is held at the port. Planning, SCM and the lines see it at once; the decision with both options and their cost is in the panel.', last: true }
  ];
  function tourStep(i) {
    if (!tour) return;
    tour.i = i; const st = TOUR[i];
    st.go();
    cap.innerHTML = `<p class="cap-n">${i + 1} / ${TOUR.length}</p><h2>${esc(st.t)}</h2><p>${esc(st.s)}</p><div class="cap-a">${st.last ? '' : '<button type="button" class="btn btn-primary btn-sm" data-tour="next">Next</button>'}<button type="button" class="btn btn-secondary btn-sm" data-tour="stop">${st.last ? 'Close' : 'Stop tour'}</button></div>`;
    cap.hidden = false;
    document.body.classList.add('touring');
    clearTimeout(tour.timer);
    if (!st.last) tour.timer = setTimeout(() => tourStep(i + 1), 10000);
  }
  function startTour() { tour = { i: 0 }; setSpeed(4); tourStep(0); }
  function stopTour() { if (tour) clearTimeout(tour.timer); tour = null; cap.hidden = true; document.body.classList.remove('touring'); if (V) V.setFollow(false); }
  $('#tourBtn').addEventListener('click', () => (tour ? stopTour() : startTour()));
  cap.addEventListener('click', e => { const b = e.target.closest('[data-tour]'); if (!b) return; if (b.dataset.tour === 'next' && tour) tourStep(Math.min(TOUR.length - 1, tour.i + 1)); else stopTour(); });
  // the caption sits over the 3D view; keep it visible in the 2D views as well
  $('.pl-stage').append(cap);

  /* ---------------- keyboard ---------------- */
  const embed = /[?&]embed=1/.test(location.search) && parent !== window;
  if (embed) document.body.classList.add('embed');
  addEventListener('keydown', e => {
    if (e.target.closest('input, textarea')) { if (e.key === 'Escape') e.target.blur(); return; }
    if (embed && ['ArrowRight', 'ArrowLeft', 'PageDown', 'PageUp', 'f', 'F', 'n', 'N', 'b', 'B'].includes(e.key)) { e.preventDefault(); parent.postMessage({ dfDeckKey: e.key }, location.origin); return; }
    if (e.target.closest('[role="tab"]') && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) return;
    // while walking the floor the keys move the walker; Escape (after leaving the mouse look) ends the walk
    if (V && V.walking) { if (e.key === 'Escape' && document.pointerLockElement !== $('#gl')) V.setWalk(false); return; }
    if (e.key === ' ' && !e.target.closest('button')) { e.preventDefault(); setSpeed(P.paused ? 1 : 0); }
    else if (e.key === '1') setSpeed(1); else if (e.key === '2') setSpeed(4); else if (e.key === '3') setSpeed(16);
    else if (e.key === 't' || e.key === 'T') window.Theme && Theme.toggle();
    else if (e.key === 'g' || e.key === 'G') tour ? stopTour() : startTour();
    else if (e.key === '/') { e.preventDefault(); $('#findIn').focus(); }
    else if (e.key === 'Escape') { if (!drills.hidden) openMenu(false); else if (tour) stopTour(); else select(null); }
  });

  /* ---------------- deep links: #st:ML1-Packing, #unit:TV26…, #drill:container, #mode:mrp, #tour ---------------- */
  function fromHash() {
    const h = decodeURIComponent(location.hash.slice(1));
    if (!h) return;
    if (h.startsWith('drill:')) { setTimeout(() => runDrill(h.slice(6)), 300); return; }
    if (h.startsWith('mode:')) { setMode(h.slice(5)); return; }
    if (h === 'tour') return startTour();
    if (/^(st|buf|agv|tug|fl|unit|order|zone|util|line|dept|sys|po|mrp):/.test(h)) setTimeout(() => select(h), 400);
  }

  /* ---------------- the frame loop ---------------- */
  let last = performance.now(), acc = 0, accR = 0, frameN = 0;
  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    E.run(dt);
    if (mode === '3d' && V) V.render(dt); else views.tick(dt);
    acc += dt; accR += dt;
    if (acc > 0.5) { acc = 0; kpis(); vstream(); labelsTick(); cctvTick(); }
    if (mode === '3d' && (frameN++ % 6 === 0)) miniTick();
    if (accR > 1) { accR = 0; render(); if (mode !== '3d') views.render(); }
    requestAnimationFrame(frame);
  }
  if (!V) { toast('3D is not available in this browser; showing the 2D views.', 'warning'); $('#tab-3d').disabled = true; }
  setMode(V ? '3d' : 'gmes');
  kpis(); vstream(); labelsTick(); render(true);
  requestAnimationFrame(frame);
  fromHash();
  addEventListener('hashchange', fromHash);
  window.Plant = { E, X, V, select, setMode };   // for the console and the presentation
})();
