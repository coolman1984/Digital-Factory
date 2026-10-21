/* Digital Factory — Live plant page: wires the plant hub (the shared twin), the agent crew and the 3D view to the readouts,
   the detail panel, the value stream, drills, the guided tour and the serial search. All plant data is simulated. */
(async function () {
  'use strict';
  const $ = s => document.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const icon = n => (typeof Icons !== 'undefined' ? Icons.get(n) : '');
  const fmt = n => Math.round(n).toLocaleString('en-US');
  const pct = (v, d = 1) => (v * 100).toFixed(d) + '%';
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const T = window.Twin;
  const boot = $('#boot');
  await T.start();
  const E = T.E;
  const P = E.P;
  let booted = false;
  T.on(t => { if (t === 'world' && booted) location.reload(); });   // re-synced from another tab: rebuild the view on the new world
  window.Agents.start();
  const narrow = matchMedia('(max-width: 900px)').matches;
  const qm = location.search.match(/[?&]q=(low|medium|high)/);
  const V = PlantScene.create($('#gl'), E, { lowPower: narrow || (qm && qm[1] === 'low'), quality: qm ? qm[1] : undefined, tick: () => T.frame() });
  const { mins, clock, clockS } = E;
  const A = window.Agents;
  const line = id => P.lines[id];

  /* ---------------- words for states and kinds ---------------- */
  const STATE = { run: 'Running', warn: 'Running slow', idle: 'Idle', starved: 'Starved', blocked: 'Blocked', down: 'Stopped', maint: 'Planned maintenance', micro: 'Short stop', changeover: 'Changeover', tripped: 'Tripped' };
  const SCLS = st => (st === 'down' || st === 'tripped' ? 'bad' : st === 'maint' ? 'maint' : st === 'warn' || st === 'starved' || st === 'micro' || st === 'changeover' ? 'warn' : '');
  const KINDN = { loader: 'Magazine loader', unloader: 'Magazine unloader', printer: 'Solder paste printer', spi: 'Solder paste inspection', mounter: 'Pick-and-place mounter', reflow: 'Reflow oven, 8 zones', aoi: 'Automated optical inspection', robot: 'Robot cell', bench: 'Manual workstation', bond: 'Display bonding', fct: 'Function tester', burnin: 'Burn-in racks', qc: 'Camera inspection booth', packer: 'Packing machine', palletizer: 'Palletizing robot', repair: 'Repair bench' };
  const chip = (st, why) => `<span class="st ${SCLS(st)}"><i></i>${esc(STATE[st] || st)}${why ? ` · ${esc(why)}` : ''}</span>`;

  /* ---------------- small charts ---------------- */
  function spark(arr, o = {}) {
    if (!arr || arr.length < 2) return '';
    const w = 280, h = o.h || 46, a = arr.slice(-90);
    let lo = Math.min(...a), hi = Math.max(...a);
    if (o.lo !== undefined) lo = Math.min(lo, o.lo); if (o.hi !== undefined) hi = Math.max(hi, o.hi);
    if (hi - lo < 1e-6) { hi += 1; lo -= 1; }
    const X = i => (i / (a.length - 1)) * w, Y = v => h - 3 - ((v - lo) / (hi - lo)) * (h - 6);
    const d = a.map((v, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)} ${Y(v).toFixed(1)}`).join('');
    const lim = o.limit !== undefined ? `<line x1="0" x2="${w}" y1="${Y(o.limit).toFixed(1)}" y2="${Y(o.limit).toFixed(1)}" class="lim"/>` : '';
    return `<svg class="spark ${o.cls || ''}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true">${lim}<path d="${d}"/></svg>`;
  }
  const bar = (k, cls = '') => `<span class="bar ${cls}"><i style="width:${Math.max(0, Math.min(100, k * 100)).toFixed(1)}%"></i></span>`;

  /* ---------------- toasts ---------------- */
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
  A.on((t, c) => {
    if (t === 'awaiting') toast(`${CaseUI.agentName(c.agent)} needs you: ${c.title}`, 'warning');
    if (t === 'acted' && c.autonomy === 'auto') toast(`${CaseUI.agentName(c.agent)} acted on its own: ${c.decision.label}`, 'info');
    if (t === 'closed' && c.decision && c.outcome && c.outcome.ok) toast(`${c.id} verified: ${c.outcome.verdict}`, 'success');
  });

  /* ---------------- refs: what a link points at ---------------- */
  function focusRef(arg) {
    if (!arg) return;
    if (arg.startsWith('ORD:')) return select('order:' + arg.slice(4));
    if (arg.startsWith('SM:') || arg.startsWith('RM:') || arg.startsWith('LS:')) return select('buf:' + arg);
    if (arg.startsWith('AGV')) return select('agv:' + arg);
    if (arg.startsWith('UTIL')) return select('util:' + arg);
    return select('st:' + arg);
  }
  const link = (ref, text) => `<button type="button" class="lnk" data-ref="${esc(ref)}">${esc(text)}</button>`;
  const stLink = id => { const s = P.byId[id]; return s ? link('st:' + id, s.name) : esc(id); };
  const unitLink = u => (u ? link('unit:' + u.sn, u.sn) : '—');
  const where = u => {
    const l = u && u.loc;
    if (!l) return u && u.scrap ? 'Scrapped' : u && u.truck ? `Shipped on ${u.truck}` : 'Archived';
    if (l.k === 'seg') return `On the conveyor to ${l.seg.to ? l.seg.to.name : 'the next station'}`;
    if (l.k === 'st') return `In ${l.st.name} (${line(l.st.line) ? line(l.st.line).name : ''})`;
    if (l.k === 'rack') return `Burn-in rack, row ${l.slot.row + 1}`;
    if (l.k === 'sm') return 'Board supermarket';
    if (l.k === 'ls') return `Line-side stock at ${P.byId[l.b.station].name}`;
    if (l.k === 'agv') return `On ${l.a.id}`;
    if (l.k === 'pallet') return `On pallet ${l.p.id}`;
    if (l.k === 'repair') return l.st.name;
    return '—';
  };

  /* ---------------- selection and the detail panel ---------------- */
  let sel = null, kpiView = null;
  let chainCase = null;
  function showCase(c) {
    chainCase = c ? c.id : null;
    const pts = c && c.chain && c.chain.length ? V.showChain(c.chain, c.state === 'closed' ? null : undefined) : V.showChain(null);
    if (c && c.chain && c.chain[0]) { const info = V.refInfo(c.chain[0]); if (info) V.flyTo(Object.assign({}, info, { r: Math.max(10, (pts && pts.length > 2 ? 9 : 5)) })); }
  }
  function select(ref, o = {}) {
    if (ref && ref.startsWith('kpi:')) { kpiView = ref.slice(4); sel = null; V.select(null, { fly: false }); render(true); return; }
    if (ref && ref.startsWith('case:')) { kpiView = null; sel = ref; V.select(null, { fly: false }); showCase(A.caseById(ref.slice(5))); render(true); if (narrow) $('#insp').scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' }); return; }
    kpiView = null; sel = ref;
    if (chainCase && ref) { const c = A.caseById(chainCase); if (!c || !(c.chain || []).includes(ref)) showCase(null); }
    V.select(ref, o);
    render(true);
    if (o.focusPanel && narrow) $('#insp').scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  }
  V.on((t, d) => {
    if (t === 'select') { if (d !== sel && !(sel && sel.startsWith('case:') && !d)) { sel = d; kpiView = null; render(true); } }
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
    if (b.dataset.ref) return select(b.dataset.ref, { fly: true });
    if (b.dataset.openCase) return select('case:' + b.dataset.openCase);
    if (b.dataset.chain) { const c = A.caseById(b.dataset.chain); if (c) showCase(c); return; }
    if (b.dataset.back !== undefined) { showCase(null); select(null); V.select(null, { fly: false }); return; }
    if (b.dataset.follow !== undefined) { V.setFollow(!V.follow); if (V.follow && sel) V.select(sel, { follow: true }); render(true); return; }
    if (b.dataset.kpi) return select('kpi:' + b.dataset.kpi);
  });

  const head = (title, sub, extra = '') => `<header class="ih"><button type="button" class="back" data-back data-key="back">${icon('chevronLeft')}<span>Plant now</span></button><h2>${esc(title)}</h2><p class="ih-sub">${sub}</p>${extra}</header>`;
  const kv = rows => `<dl class="kv">${rows.filter(Boolean).map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${v}</dd></div>`).join('')}</dl>`;
  const sect = (title, body, note = '') => body ? `<section class="is"><h3>${esc(title)}${note ? `<span>${note}</span>` : ''}</h3>${body}</section>` : '';
  const evRows = list => list.length ? `<ol class="ev">${list.map(e => `<li class="${e.level}"><time>${e.time}</time><span><b>${esc(e.src)}</b> ${esc(e.msg)}</span></li>`).join('')}</ol>` : '<p class="quiet">Nothing logged yet.</p>';
  const caseCards = (list, o = {}) => list.map(c => CaseUI.card(c, o)).join('');
  const casesFor = ref => A.S.cases.filter(c => c.state !== 'closed' && (c.ref === ref || (c.chain || [])[0] === ref));
  function refFromFocus(a) {
    if (a.startsWith('ORD:')) return 'order:' + a.slice(4);
    if (a.startsWith('SM:') || a.startsWith('RM:') || a.startsWith('LS:')) return 'buf:' + a;
    if (a.startsWith('AGV')) return 'agv:' + a;
    if (a.startsWith('UTIL')) return 'util:' + a;
    return 'st:' + a;
  }

  /* plant now: what needs a decision, what happens next, orders, live events */
  function summary() {
    const down = P.stations.filter(s => s.state === 'down');
    const wait = A.waiting(), work = A.open().filter(c => c.state !== 'awaiting' && c.state !== 'advise');
    const parts = [];
    if (down.length) parts.push(`<b class="bad">${down.map(s => `${esc(s.name)} (${esc(line(s.line) ? line(s.line).name : '')})`).join(', ')} stopped.</b>`);
    if (P.preds[0] && P.preds[0].eta < 1800) parts.push(`${esc(P.preds[0].text)} in <b>${mins(P.preds[0].eta)}</b>.`);
    if (!parts.length) parts.push(`All five lines running. <b>${fmt(P.kpi.units)}</b> units packed today against a plan of ${fmt(P.kpi.plan)}.`);
    if (wait.length) parts.push(`${wait.length} ${wait.length === 1 ? 'decision waits' : 'decisions wait'} for you${wait.some(c => c.sev === 'crit') ? ', urgent' : ''}.`);
    if (work.length) parts.push(`The agents are working on ${work.length} ${work.length === 1 ? 'case' : 'cases'}.`);
    if (!wait.length && !work.length) parts.push('No decision waiting: six agents are watching the plant.');
    return parts.join(' ');
  }
  function ordersTable(list = P.orders) {
    return `<table class="tbl"><thead><tr><th>Order</th><th>Qty</th><th>Due</th><th>Status</th></tr></thead><tbody>${list.map(o => {
      const st = o.state === 'shipped' ? 'Shipped' : o.state === 'late' ? 'Shipped late' : o.state === 'partial' ? 'Part-shipped' : o.state === 'loading' ? `Loading ${o.truck ? o.truck.loaded : 0}/${o.truck ? o.truck.need : o.qty}` : o.risk > 120 ? `Late ~${mins(o.risk)}` : 'On track';
      const cls = o.state === 'late' || (o.state !== 'shipped' && o.risk > 1200) ? 'bad' : o.risk > 120 && o.state !== 'shipped' ? 'warn' : '';
      return `<tr><td>${link('order:' + o.id, o.id)}<small>${esc(o.customer)}</small></td><td>${fmt(o.qty)} ${o.product === 'tv' ? 'TVs' : 'phones'}</td><td>${clock(o.due)}</td><td class="${cls}">${st}</td></tr>`;
    }).join('')}</tbody></table>`;
  }
  function plantNow() {
    const preds = P.preds.slice(0, 6).map(p => `<li class="${p.late || p.eta < 600 ? 'bad' : p.eta < 1800 ? 'warn' : ''}"><button type="button" class="lnk" data-ref="${esc(p.ref)}">${esc(p.text)}</button><small>${esc(p.sub)}</small><b>in ${mins(p.eta)}</b></li>`).join('');
    const wait = A.waiting(), work = A.open().filter(c => c.state !== 'awaiting' && c.state !== 'advise');
    const done = A.S.cases.filter(c => c.state === 'closed').slice(0, 3);
    return `<header class="ih home"><h2>Plant now</h2><p class="say">${summary()}</p></header>
      ${sect('Needs you', wait.length ? caseCards(wait, { decide: true, noLast: true }) : '<p class="quiet">Nothing to decide. Start a drill, or wait: the agents also find real problems on their own.</p>')}
      ${work.length ? sect('Agents at work', caseCards(work), `${work.length} open`) : ''}
      ${sect('What happens next', preds ? `<ol class="next">${preds}</ol>` : '<p class="quiet">No stock-out or late order expected. Every line-side stock has its next AGV delivery planned.</p>', 'if nobody acts')}
      ${done.length ? sect('Recently closed', caseCards(done)) : ''}
      ${sect('Orders today', ordersTable())}
      ${sect('Live events', evRows(P.events.slice(0, 9)))}`;
  }

  /* station detail */
  function sensorsBlock(s) {
    const S = s.sens, H = s.hist, rows = [];
    const ro = (label, value, unit, chart = '') => `<div class="ro2"><span>${esc(label)}</span><b>${value}<small>${unit}</small></b>${chart}</div>`;
    if (s.kind === 'mounter') {
      rows.push(ro('Spindle vibration', (S.vib || 0).toFixed(2), ' mm/s', spark(H.vib, { limit: 4.5, cls: S.vib > 4.5 ? 'bad' : S.vib > 3 ? 'warn' : '' })));
      rows.push(ro('Nozzle vacuum', (S.vac || 0).toFixed(0), ' kPa'));
      rows.push(ro('Placements', fmt(S.cph || 0), ' /h'));
      rows.push(ro('Health', s.health.toFixed(0), ' %', spark(H.health, { lo: 0, hi: 100 })));
    } else if (s.kind === 'reflow') {
      const z = S.zones || [];
      const mx = 260;
      rows.push(`<div class="ro2 wide"><span>Zone temperatures · peak ${(S.peak || 0).toFixed(1)} °C (limit 248)</span><div class="zones">${z.map((t, i) => `<i style="height:${(t / mx * 100).toFixed(0)}%" class="${i === 4 && t > 232 ? 'warn' : ''}"><b>${t.toFixed(0)}</b><small>Z${i + 1}</small></i>`).join('')}</div></div>`);
      rows.push(ro('Peak temperature', (S.peak || 0).toFixed(1), ' °C', spark(H.peak, { limit: 248, cls: S.peak > 248 ? 'bad' : '' })));
      rows.push(ro('Oxygen', fmt(S.o2 || 0), ' ppm'));
      rows.push(ro('Conveyor', (S.conv || 0).toFixed(2), ' m/min'));
    } else if (s.kind === 'printer') {
      rows.push(ro('Squeegee pressure', (S.press || 0).toFixed(2), ' kg')); rows.push(ro('Paste temperature', (S.paste || 0).toFixed(1), ' °C', spark(H.temp)));
    } else if (s.kind === 'spi') rows.push(ro('Paste volume', (S.vol || 0).toFixed(0), ' %'));
    else if (s.kind === 'aoi') rows.push(ro('Reject rate', fmt(S.ppm || 0), ' ppm'));
    else if (s.kind === 'robot' || s.kind === 'palletizer') { rows.push(ro('Screw torque', (S.torque || 0).toFixed(2), ' N·m')); rows.push(ro('Joint temperature', (S.temp || 0).toFixed(1), ' °C', spark(H.temp))); }
    else if (s.kind === 'burnin') {
      const tv = s.rack.filter(r => r.u && r.kind === 'tv').length, ph = s.rack.filter(r => r.u && r.kind === 'phone').length;
      rows.push(ro('TVs ageing', `${tv}`, ' / 36', bar(tv / 36))); rows.push(ro('Phones ageing', `${ph}`, ' / 48', bar(ph / 48)));
      rows.push(ro('Ageing time', 'TV 18 · phone 10', ' min'));
    }
    if (s.kind !== 'burnin') rows.push(ro('Power', (s.kwNow || 0).toFixed(1), ' kW', spark(H.kw)));
    else rows.push(ro('Power (TVs on test)', (s.kwNow || 0).toFixed(1), ' kW', spark(H.kw)));
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
    const feeds = s.needs.map(n => { const b = n.b; const lv = E.level(b); const m = b.mission; return `<li>${link('buf:' + b.id, b.label)}<span>${n.frac ? Math.round(lv) + '%' : fmt(lv)} ${n.frac ? 'reel left' : 'on hand'} · ${b.rate > 1e-4 ? 'lasts ' + mins((n.frac ? lv : lv) / b.rate) : 'not used now'}${m ? ` · ${m.agv ? `${m.agv.id} bringing ${m.qty}` : 'AGV requested'}` : ''}</span></li>`; }).join('');
    const now = s.kind === 'burnin' ? '' : s.procs.map(p => `<li>${unitLink(p.u)}<span>${p.done ? 'done, waiting to move on' : `${Math.max(0, p.left).toFixed(0)} s left`}</span></li>`).join('');
    const recs = casesFor('st:' + s.id);
    const evs = P.events.filter(e => e.ref === s.id).slice(0, 6);
    const wear = A.S.cases.find(c => c.kind === 'wear' && c.station === s.id && c.state !== 'closed' && c.diagnosis && c.diagnosis.rul);
    const rul = s.state === 'down' ? `<b class="bad">failed${s.fault ? ' at ' + clock(s.fault.at) : ''}</b> · ${s.tech ? (s.tech.state === 'repairing' ? `repair ${mins(Math.max(0, s.repair))} left` : 'technician on the way') : 'waiting for a technician'}` : s.state === 'maint' ? `planned work · ${mins(Math.max(0, s.repair))} left` : wear ? `<b class="warn">about ${mins(wear.diagnosis.rul.p50 * 60)}</b> <small>P10 ${mins(wear.diagnosis.rul.p10 * 60)} · Maintenance agent</small>` : 'no failure predicted by the Maintenance agent';
    const who = [s.operator ? `${esc(s.operator.name)} · ${esc(s.operator.role || 'Operator')}` : '', s.tech ? `${esc(s.tech.name)} · ${s.tech.state === 'walking' ? 'on the way' : 'repairing'}` : ''].filter(Boolean).join('<br>');
    const cyc = s.kind === 'burnin' ? '18 min TV · 10 min phone' : s.kind === 'reflow' ? `${s.base} s per board (${s.slots} in the oven)` : `${s.base} s nominal${L && L.speed !== 1 ? ` · line at ${Math.round(L.speed * 100)}%` : ''}`;
    return head(s.name, `${esc(L ? L.name : 'Support')} · ${esc(KINDN[s.kind] || s.kind)}`, `<p class="ih-st">${chip(s.state === 'idle' && L && L.tripped ? 'tripped' : s.state, s.why)} <small>for ${mins(P.t - s.since)}</small></p>`)
      + (recs.length ? sect('Agent cases', caseCards(recs, { decide: true })) : '')
      + sect('Live signals', sensorsBlock(s))
      + sect('Condition', kv([['Condition index', `${s.health.toFixed(0)}%`], ['Failure forecast', rul], ['Short stops this shift', fmt(s.stops || 0)], ['Repairs this shift', fmt(s.repairs || 0)]]))
      + sect('Output', kv([['Cycle', cyc], ['Units done', fmt(s.counters.made)], ['Rejected here', fmt(s.counters.bad)], ['Line OEE', L ? `${pct(L.oee)} = ${pct(L.avail, 0)} × ${pct(L.perf, 0)} × ${pct(L.qual, 1)}` : '—']]) + timeSplit(s), 'since 08:17')
      + (now ? sect('Now inside', `<ul class="li">${now}</ul>`) : '')
      + (feeds ? sect('Fed by', `<ul class="li">${feeds}</ul>`) : '')
      + sect('Linked to', kv([prev && ['Upstream', stLink(prev.id)], next && ['Downstream', stLink(next.id)], who && ['People', who]]))
      + sect('Events here', evRows(evs));
  }

  function bufferDetail(id) {
    const b = P.bufs[id]; if (!b) return plantNow();
    const lv = E.level(b);
    if (b.sm) {
      const lane = id.endsWith('main') ? 'main' : 'power';
      const feeders = ['L1', 'L2'].filter(l => (line(l).prodOverride || line(l).product) === lane);
      const last = b.items.slice(-5).reverse().map(unitLink).join(' ');
      return head(`${b.label} supermarket`, 'Between the SMT lines and assembly · first in, first out')
        + sect('Stock', kv([['Boards', `<b>${fmt(lv)}</b> of ${fmt(b.cap)}`], ['At the assembly lines', fmt(b.lineSide || 0)], ['Covers', b.rw && isFinite(b.rw) ? mins(b.rw) + ' of assembly' : '—'], ['Fed by', feeders.map(l => link('st:' + line(l).stations[0].id, line(l).name)).join(', ') + ` (${feeders.map(l => STATE[line(l).state] || line(l).state).join(', ')})`], ['Used by', lane === 'main' ? `${link('st:L3-Boardfit', 'Final Assembly A')} and ${link('st:L4-Boardfit', 'Final Assembly B')}` : link('st:L3-Boardfit', 'Final Assembly A')]]) + bar(lv / b.cap, lv < 20 ? 'bad' : lv < 40 ? 'warn' : ''))
        + sect('Newest boards in', `<p class="sns">${last || '—'}</p>`)
        + sect('Missions from here', `<ul class="li">${E.missions.filter(m => m.src === b).map(m => `<li>${m.agv ? link('agv:' + m.agv.id, m.agv.id) : 'Waiting for an AGV'}<span>${m.qty} boards to ${esc(P.byId[m.buf.station].name)} (${esc(line(m.buf.line).name)})</span></li>`).join('') || '<li>None open</li>'}</ul>`);
    }
    if (b.rm) {
      const k = id.slice(3);
      const lots = b.lots ? `<ul class="li">${b.lots.map(l => `<li><b>${esc(l.id)}</b><span>${fmt(l.qty)} panels · ${esc(l.supplier || '')}${P.scen.lot && P.scen.lot.lot === l.id ? (P.scen.lot.quarantined ? ' · quarantined' : ' · <b class="bad">failing QC</b>') : ''}</span></li>`).join('')}</ul>` : '';
      const inb = P.inbound.filter(t => (t.mat === 'panel') === (k === 'panel') && t.state !== 'done').map(t => `<li>${esc(t.id)}<span>${t.state === 'unloading' ? `unloading at door ${t.door + 1}` : `due ${clock(t.at)}`}</span></li>`).join('');
      return head(b.label, 'Raw-material warehouse · racked pallets')
        + sect('Stock', kv([['On hand', `<b>${fmt(b.qty)}</b> ${esc(b.unit)} of ${fmt(b.cap)}`], ['Used today', fmt(b.used)]]) + bar(b.qty / b.cap))
        + (lots ? sect('Lots', lots) : '') + (inb ? sect('Inbound trucks', `<ul class="li">${inb}</ul>`) : '');
    }
    const st = P.byId[b.station], m = b.mission;
    const lots = b.lots && b.lots.length ? `<ul class="li">${b.lots.map(l => `<li><b>${esc(l.id)}</b><span>${fmt(l.qty)} panels${P.scen.lot && P.scen.lot.lot === l.id && !P.scen.lot.quarantined ? ' · <b class="bad">suspect lot</b>' : ''}</span></li>`).join('')}</ul>` : '';
    const items = b.items && b.items.length ? `<p class="sns">${b.items.slice(0, 6).map(unitLink).join(' ')}${b.items.length > 6 ? ` +${b.items.length - 6}` : ''}</p>` : '';
    return head(`${b.label}`, `Line-side stock at ${stLink(st.id)} · ${esc(line(st.line).name)}`)
      + sect('Stock', kv([['On hand', `<b>${b.per ? Math.round(lv) + '%' : fmt(lv)}</b> ${b.per ? 'of a reel set' : esc(b.unit)}`], ['Lasts', b.rate > 1e-4 ? mins(lv / b.rate) : 'not used now'], ['Reorder point', `${fmt(b.rop)} · an AGV brings ${fmt(b.batch)}`], ['Comes from', b.src.startsWith('SM') ? link('buf:' + b.src, 'Board supermarket') : link('buf:' + b.src, 'Raw-material warehouse')]]) + bar(lv / b.cap, lv <= 0 ? 'bad' : lv <= b.rop ? 'warn' : ''))
      + sect('Delivery', m ? kv([['Mission', `${esc(m.id)} · ${esc(m.reason)}`], ['AGV', m.agv ? link('agv:' + m.agv.id, m.agv.id) + (m.agv.fault ? ' <b class="bad">fault</b>' : ` · ${m.agv.phase === 'toPick' ? 'going to pick' : 'on the way here'}`) : 'Waiting for a free AGV'], ['Expected', m.agv && m.eta ? clock(m.eta) : '—']]) : '<p class="quiet">No delivery needed yet.</p>')
      + (lots ? sect('Panel lots here', lots) : '') + (items ? sect('Boards here', items) : '');
  }

  function agvDetail(a) {
    const m = a.mission;
    return head(a.id, 'Automated guided vehicle · 400 kg payload', `<p class="ih-st">${chip(a.fault ? 'down' : a.state === 'idle' ? 'idle' : 'run', a.fault || (a.state === 'charging' ? 'Charging' : a.state === 'idle' ? 'Parked' : a.load ? 'Carrying' : 'Driving'))}</p>`)
      + sect('Mission', m ? kv([['Brings', `${fmt(m.qty)} ${esc(m.buf.label.toLowerCase())}`], ['From', link('buf:' + m.src.id, m.src.label)], ['To', `${stLink(m.buf.station)} · ${esc(line(m.buf.line).name)}`], ['Why', esc(m.reason)], ['Arrives', m.eta ? clock(m.eta) : '—']]) : '<p class="quiet">No mission. Parked and ready.</p>')
      + sect('Vehicle', kv([['Battery', `${Math.round(a.battery)}% ${bar(a.battery / 100, a.battery < 25 ? 'warn' : '')}`], ['Speed', `${a.v.toFixed(1)} m/s`], ['Driven today', `${a.km.toFixed(1)} km`], ['Load', a.load ? `${fmt(a.load.qty)} ${esc(a.load.label.toLowerCase())}` : 'Empty']]))
      + `<div class="ia"><button type="button" class="btn btn-secondary btn-sm" data-follow data-key="follow">${icon('eye')}${V.follow ? 'Stop following' : 'Follow in 3D'}</button></div>`;
  }
  function unitDetail(sn) {
    const u = E.findUnit(sn);
    if (!u) return head('Not found', `No unit with serial ${esc(sn)} in today's records.`);
    const name = u.type === 'tv' ? 'TV' : u.type === 'phone' ? 'Smartphone' : u.type === 'main' ? 'Main board' : 'Power board';
    const steps = u.steps.map(s => `<li class="${s.ok === false ? 'bad' : ''}"><time>${clock(s.t0)}</time><div><b>${P.byId[s.st] ? stLink(s.st) : esc(s.name)}</b>${s.t1 ? `<small>${Math.max(1, Math.round(s.t1 - s.t0))} s</small>` : '<small>in progress</small>'}${s.by ? `<small>${esc(s.by)}</small>` : ''}${s.note ? `<p>${esc(s.note)}</p>` : ''}</div></li>`).join('');
    const board = b => b ? `<li>${unitLink(b)}<span>${esc(b.type === 'main' ? 'Main board' : 'Power board')} · ${esc(line(b.line) ? line(b.line).name : '')} · ${b.steps.filter(x => /Reflow|AOI|Printer/.test(x.name)).map(x => esc(x.note || '')).filter(Boolean).join(' · ')}${b.repaired ? ' · repaired once' : ''}</span></li>` : '';
    const parts = [board(u.parts.main), board(u.parts.power), u.lot ? `<li>${link('buf:RM:panel', u.lot)}<span>TV panel lot${P.scen.lot && P.scen.lot.lot === u.lot ? (P.scen.lot.quarantined ? ' · quarantined lot' : ' · <b class="bad">suspect lot</b>') : ''}</span></li>` : ''].join('');
    const used = u.usedIn ? kv([['Built into', link('unit:' + u.usedIn, u.usedIn)], ['At', clock(u.usedAt)]]) : '';
    const ship = kv([u.pallet && ['Pallet', link('pal:' + u.pallet, u.pallet)], u.order && ['Order', link('order:' + u.order, u.order)], u.truck && ['Truck', esc(u.truck)]]);
    return head(`${name} ${u.sn}`, `${esc(u.model || (u.type === 'main' ? 'Main board MB-55' : u.type === 'power' ? 'Power board PB-55' : ''))} · started ${clock(u.born)}`, `<p class="ih-st">${u.defect ? chip('down', u.defect.code) : chip('run', u.packed ? 'Packed' : 'Good so far')} <small>${esc(where(u))}</small></p>`)
      + `<div class="ia"><button type="button" class="btn btn-secondary btn-sm" data-follow data-key="follow">${icon('eye')}${V.follow ? 'Stop following' : 'Follow in 3D'}</button></div>`
      + (u.defect ? sect('Defect', kv([['Found at', stLink(u.defect.at)], ['Cause', esc(u.defect.cause)]])) : '')
      + sect('Passport', `<ol class="pass">${steps || '<li>No steps yet</li>'}</ol>`, `${u.steps.length} records`)
      + (parts ? sect('Parts and their history', `<ul class="li">${parts}</ul>`) : '') + (used ? sect('Used in', used) : '') + (ship.includes('<div>') ? sect('Shipping', ship) : '');
  }
  function orderDetail(id) {
    const o = P.orders.find(o => o.id === id); if (!o) return plantNow();
    const pals = P.pallets.filter(p => p.truck && p.truck.order === o).length;
    const recs = casesFor('order:' + o.id);
    return head(`Order ${o.id}`, `${esc(o.customer)} · ${fmt(o.qty)} ${o.product === 'tv' ? 'TVs (TV-55 UHD)' : 'phones (Phone X6)'}`)
      + (recs.length ? sect('Agent cases', caseCards(recs, { decide: true })) : '')
      + sect('Delivery', kv([['Due', clock(o.due)], ['Ready (forecast)', o.eta ? clock(o.eta) : '—'], ['Status', esc(o.state === 'open' ? (o.risk > 120 ? `late by about ${mins(o.risk)}` : 'on track') : o.state)], ['Shipped', fmt(o.shipped)], ['Truck', o.truck ? link('truck:' + o.truck.id, `${o.truck.id} at ${o.truck.dock.id}`) : `arrives ${clock(o.due - 75 * 60)}`], ['Pallets loaded', fmt(pals)]]));
  }
  function truckDetail(t) {
    return head(t.id, `${t.dock.id} · order ${esc(t.order.id)}`)
      + sect('Loading', kv([['Order', link('order:' + t.order.id, `${t.order.id} · ${t.order.customer}`)], ['Loaded', `${fmt(t.loaded)} of ${fmt(t.need)} ${t.product === 'tv' ? 'TVs' : 'phones'}`], ['Pallets', fmt(t.pallets.length)], ['Arrived', clock(t.arrived)], ['Leaves', t.state === 'leaving' ? 'now' : `when full, or ${clock(t.order.due + 20 * 60)} at the latest`]]) + bar(t.loaded / t.need))
      + sect('Pallets on board', `<p class="sns">${t.pallets.map(p => link('pal:' + p.id, p.id)).join(' ') || '—'}</p>`);
  }
  function palletDetail(p) {
    return head(`Pallet ${p.id}`, `${p.product === 'tv' ? 'TVs' : 'Phones'} · ${p.units.length} of ${p.cap}`)
      + sect('Where', kv([['Now', p.where === 'build' ? 'Being built at the palletizer' : p.where === 'pickup' ? 'Wrapped, waiting for a forklift' : p.where === 'fork' ? 'On a forklift' : p.where === 'fg' ? 'Finished-goods bay' : p.where === 'truck' ? `On ${p.truck ? p.truck.id : 'a truck'}` : p.where], ['Completed', p.built ? clock(p.built) : '—'], p.truck && ['Order', link('order:' + p.truck.order.id, p.truck.order.id)]]))
      + sect('Units on it', `<p class="sns">${p.units.slice(0, 12).map(unitLink).join(' ')}${p.units.length > 12 ? ` +${p.units.length - 12}` : ''}</p>`);
  }
  function caseDetail(id) {
    const c = A.caseById(id); if (!c) return plantNow();
    return head(c.title, `${esc(CaseUI.agentName(c.agent))} · case ${esc(c.id)}`, c.chain && c.chain.length > 1 ? `<div class="ia"><button type="button" class="btn btn-secondary btn-sm" data-chain="${esc(c.id)}" data-key="chain">${icon('layers')}Show the cause path in 3D</button></div>` : '') + CaseUI.detail(c, { noTitle: true });
  }
  function detail(ref) {
    const [k, id] = ref.split(/:(.+)/);
    if (k === 'case') return caseDetail(id);
    if (k === 'st') { const s = P.byId[id]; return s ? stationDetail(s) : plantNow(); }
    if (k === 'buf') return bufferDetail(id);
    if (k === 'agv') { const a = P.agvs.find(a => a.id === id); return a ? agvDetail(a) : plantNow(); }
    if (k === 'unit') return unitDetail(id);
    if (k === 'order') return orderDetail(id);
    if (k === 'truck') { const t = P.trucks.find(t => t.id === id); return t ? truckDetail(t) : plantNow(); }
    if (k === 'pal') { const p = P.pallets.find(p => p.id === id); return p ? palletDetail(p) : plantNow(); }
    if (k === 'fl') {
      const f = P.forklifts.find(f => f.id === id); if (!f) return plantNow();
      const j = f.job;
      return head(f.id, `Forklift · driver ${esc(f.driver ? f.driver.name : '—')}`, `<p class="ih-st">${chip(f.path ? 'run' : 'idle', j ? (j.kind === 'store' ? 'Storing a pallet' : 'Loading a truck') : 'Waiting')}</p>`)
        + sect('Job', j ? kv([['Pallet', link('pal:' + j.pallet.id, j.pallet.id)], j.truck && ['Truck', link('truck:' + j.truck.id, j.truck.id)], ['Step', j.phase === 'toPallet' ? 'Going to the pallet' : j.phase === 'toSlot' ? 'Taking it to its bay' : 'Taking it to the truck']]) : '<p class="quiet">No job. Next: store the newest pallet, or load the truck at the dock.</p>');
    }
    if (k === 'inbound') { const t = P.inbound.find(t => t.id === id); return t ? head(t.id, `Inbound truck · receiving door ${t.door + 1}`) + sect('Unloading', kv([['Load', t.mat === 'panel' ? `${fmt(t.qty)} TV panels` : 'PCBs, reels, covers, housings, displays, cartons'], ['Progress', `${Math.round(t.k * 100)}% ${bar(t.k)}`]])) : plantNow(); }
    if (k === 'person') {
      const p = P.people.find(p => p.id === id); if (!p) return plantNow();
      const st = P.byId[p.at] || (p.job);
      return head(p.name, esc(p.role)) + sect('Now', kv([['Where', st ? stLink(st.id) : p.role === 'Line leader' ? esc(p.at === 'L3' ? 'Assembly hall' : 'SMT hall') : 'Maintenance shop'], ['Doing', p.role === 'Technician' ? (p.state === 'available' ? 'Available in the shop' : p.state === 'walking' ? `Walking to ${esc(p.job ? p.job.name : 'a machine')}` : p.state === 'repairing' ? `Repairing ${esc(p.job ? p.job.name : '')}` : 'Returning to the shop') : 'Working at the station']]));
    }
    if (k === 'util') {
      const u = P.util.assets.find(u => u.id === id); if (!u) return plantNow();
      return head(u.name, 'Utilities') + sect('Now', kv([['Power', `${u.kw.toFixed(0)} kW`], ['Outside air', `${P.util.ambient.toFixed(1)} °C`], ['Plant total', `${fmt(P.kpi.kw)} kW`]]) + spark(P.hist.kw));
    }
    if (k === 'zone') {
      const z = P.layout.ZONES.find(z => z.id === id); if (!z) return plantNow();
      const sts = P.stations.filter(s => s.x >= z.x0 && s.x <= z.x1 && s.z >= z.z0 && s.z <= z.z1);
      return head(z.name, `${sts.length} stations`) + sect('Stations', `<ul class="li">${sts.map(s => `<li>${stLink(s.id)}<span>${chip(s.state, '')}</span></li>`).join('')}</ul>`);
    }
    return plantNow();
  }

  /* readout panels opened from the KPI strip */
  function kpiPanel(k) {
    const back = (t, sub) => head(t, sub);
    if (k === 'oee' || k === 'overview' || k === 'forecast' || k === 'wip') {
      const rows = Object.values(P.lines).map(L => `<tr><td>${link('st:' + L.stations[0].id, L.name)}<small>${esc(L.sub)}</small></td><td>${pct(L.avail, 0)}</td><td>${pct(L.perf, 0)}</td><td>${pct(L.qual, 1)}</td><td><b>${pct(L.oee)}</b></td></tr>`).join('');
      return back(k === 'forecast' ? 'Shift forecast' : k === 'wip' ? 'Units in process' : 'Line performance', k === 'forecast' ? `End of shift A (14:00): <b>${fmt(P.kpi.fcst)}</b> forecast against a plan of ${fmt(P.kpi.planEnd)} · ${pct(P.kpi.prob, 0)} likely` : `OEE = availability × performance × quality, last 30 minutes`)
        + sect('By line', `<table class="tbl"><thead><tr><th>Line</th><th>Avail.</th><th>Perf.</th><th>Quality</th><th>OEE</th></tr></thead><tbody>${rows}</tbody></table>`)
        + sect('Throughput', spark(P.hist.tph, { h: 70 }), 'units an hour, last 15 min')
        + sect('Work in process', kv([['Units between panel load and packing', fmt(P.kpi.wip)], ['Boards in the supermarket', fmt(P.kpi.boards)], ['Average lead time, panel to packed', mins(P.kpi.lead)]]));
    }
    if (k === 'energy') {
      const top = P.stations.slice().sort((a, b) => b.kwNow - a.kwNow).slice(0, 8).map(s => `<li>${stLink(s.id)}<span>${s.kwNow.toFixed(1)} kW · ${esc(line(s.line) ? line(s.line).name : '')}</span></li>`).join('');
      const util = P.util.assets.map(u => `<li>${link('util:' + u.id, u.name)}<span>${u.kw.toFixed(0)} kW</span></li>`).join('');
      return back('Energy', `${fmt(P.kpi.kw)} kW now · ${fmt(P.energy.kwh)} kWh since 09:12 · outside ${P.util.ambient.toFixed(1)} °C`)
        + sect('Plant demand', spark(P.hist.kw, { h: 70 }), 'last 15 min') + sect('Largest machine loads', `<ul class="li">${top}</ul>`) + sect('Utilities', `<ul class="li">${util}</ul>`);
    }
    if (k === 'orders') return back('Orders today', `${pct(P.kpi.otif, 0)} of shipped orders left on time`) + sect('Orders', ordersTable());
    if (k === 'alarms') {
      const rows = P.alarms.map(a => `<li class="p${a.prio}"><time>${a.time}</time><span><b>P${a.prio} · ${esc(a.area)}</b> ${esc(a.msg)}</span>${a.ref ? `<button type="button" class="lnk" data-ref="${esc(refFromFocus(a.ref))}">Show</button>` : ''}</li>`).join('');
      return back('Active alarms', 'ISA-18.2 priorities: P1 act now, P2 act soon, P3 and P4 plan it') + sect('Alarms', rows ? `<ol class="al">${rows}</ol>` : '<p class="quiet">No active alarms.</p>');
    }
    if (k === 'fpy') {
      const ins = P.stations.filter(s => s.kind === 'aoi' || s.kind === 'fct' || s.kind === 'qc').map(s => { const t = s.counters.made + s.counters.bad; return `<li>${stLink(s.id)}<span>${t ? pct(1 - s.counters.bad / t, 2) : '—'} pass · ${fmt(s.counters.bad)} rejected · ${esc(line(s.line).name)}</span></li>`; }).join('');
      return back('First-pass yield', 'Units that pass every test the first time') + sect('Inspection points', `<ul class="li">${ins}</ul>`) + sect('Repair queues', kv([['SMT repair bench', `${fmt(P.rejects.smtRepair.length)} boards`], ['Rework bench', `${fmt(P.rejects.rework.length)} units`]]));
    }
    return plantNow();
  }

  /* ---------------- readouts ---------------- */
  function kpis() {
    const k = P.kpi;
    $('#clock').textContent = clockS(P.t);
    $('#kOut').textContent = fmt(k.units);
    const ahead = k.units - k.plan;
    $('#kOutS').innerHTML = `<span class="${ahead < -40 ? 'bad' : ahead < 0 ? 'warn' : ''}">${ahead >= 0 ? '+' : ''}${fmt(ahead)} vs plan</span> · ${fmt(k.tv)} TVs · ${fmt(k.phone)} phones`;
    $('#kFc').textContent = fmt(k.fcst);
    $('#kFcS').innerHTML = `<span class="${k.prob < 0.5 ? 'bad' : k.prob < 0.8 ? 'warn' : ''}">${pct(k.prob, 0)} likely</span> to hit ${fmt(k.planEnd)}`;
    $('#kOee').textContent = pct(k.oee || 0);
    $('#kOee').className = (k.oee || 0) < 0.75 ? 'bad' : (k.oee || 0) < 0.85 ? 'warn' : '';
    $('#kFpy').textContent = pct(k.fpy, 2);
    $('#kWip').textContent = fmt(k.wip);
    $('#kWipS').textContent = `lead time ${mins(k.lead)} · ${fmt(k.boards)} boards in stock`;
    $('#kKw').textContent = fmt(k.kw) + ' kW';
    $('#kKwS').textContent = `${fmt(P.energy.kwh)} kWh since 09:12`;
    const shipped = P.orders.filter(o => o.state === 'shipped' || o.state === 'late' || o.state === 'partial');
    $('#kOtif').textContent = shipped.length ? pct(k.otif, 0) : '—';
    const atRisk = P.orders.filter(o => (o.state === 'open' || o.state === 'loading') && o.risk > 120).length;
    $('#kOtifS').innerHTML = `${shipped.length} shipped · <span class="${atRisk ? 'warn' : ''}">${atRisk} at risk</span>`;
    $('#kAl').textContent = fmt(P.alarms.length);
    const p1 = P.alarms.filter(a => a.prio === 1).length, p2 = P.alarms.filter(a => a.prio === 2).length;
    $('#kAl').className = p1 ? 'bad' : p2 ? 'warn' : '';
    $('#kAlS').textContent = `${p1} P1 · ${p2} P2 · ${A.waiting().length} decisions`;
    const h = Math.floor(P.t / 3600) % 24;
    $('#shift').textContent = h >= 6 && h < 14 ? 'Shift A · 06–14' : h >= 14 && h < 22 ? 'Shift B · 14–22' : 'Shift C · 22–06';
  }
  $$('.pl-kpis .ro').forEach(b => b.addEventListener('click', () => select('kpi:' + b.dataset.go)));

  /* ---------------- value stream ---------------- */
  function vstream() {
    const SM = E.SM, B = E.BURN;
    const tvB = B.rack.filter(r => r.u && r.kind === 'tv').length, phB = B.rack.filter(r => r.u && r.kind === 'phone').length;
    const panelsH = (E.RM.panel.qty + E.level(E.LS.L3panel)) / 95;
    const fgTv = P.pallets.filter(p => p.where === 'fg' && p.product === 'tv').length, fgPh = P.pallets.filter(p => p.where === 'fg' && p.product === 'phone').length;
    const nextTruck = P.trucks.find(t => t.state === 'loading') || null;
    const nextOrder = P.orders.find(o => o.state === 'open' || o.state === 'loading');
    const lnode = id => { const L = line(id); return { cls: SCLS(L.state), v: `${fmt(L.tph)}/h`, s: (STATE[L.state] || L.state) + (L.prodOverride ? ' · main boards' : '') }; };
    const nodes = [
      { ref: 'buf:RM:panel', t: 'Raw materials', v: `${panelsH.toFixed(1)} h`, s: 'TV panels cover', cls: panelsH < 1.5 ? 'bad' : panelsH < 3 ? 'warn' : '' },
      Object.assign({ ref: 'st:L1-Loader', t: 'SMT Line 1' }, lnode('L1')),
      Object.assign({ ref: 'st:L2-Loader', t: 'SMT Line 2' }, lnode('L2')),
      { ref: 'buf:SM:main', t: 'Supermarket', v: `${fmt(SM.main.items.length)} · ${fmt(SM.power.items.length)}`, s: `main · power boards${SM.main.rw < 1800 ? ` · ${mins(SM.main.rw)}` : ''}`, cls: SM.main.items.length < 20 || SM.power.items.length < 15 ? 'warn' : '' },
      Object.assign({ ref: 'st:L3-Panelload', t: 'Assembly A · TVs' }, lnode('L3')),
      Object.assign({ ref: 'st:L4-Housingfit', t: 'Assembly B · phones' }, lnode('L4')),
      { ref: 'st:L5-Burnin', t: 'Burn-in', v: `${tvB} · ${phB}`, s: 'TVs · phones ageing', cls: '' },
      Object.assign({ ref: 'st:L5-QC', t: 'Final QC & pack' }, lnode('L5')),
      { ref: 'zone:fg', t: 'Finished goods', v: `${fgTv} · ${fgPh}`, s: 'TV · phone pallets', cls: '' },
      { ref: nextTruck ? 'truck:' + nextTruck.id : nextOrder ? 'order:' + nextOrder.id : 'zone:fg', t: 'Shipping', v: nextTruck ? `${fmt(nextTruck.loaded)}/${fmt(nextTruck.need)}` : nextOrder ? clock(nextOrder.due) : '—', s: nextTruck ? `${nextTruck.order.id} loading` : nextOrder ? `next: ${nextOrder.id}` : 'no truck', cls: nextOrder && nextOrder.risk > 1200 ? 'bad' : nextOrder && nextOrder.risk > 120 ? 'warn' : '' }
    ];
    const html = nodes.map(n => `<li><button type="button" class="vs ${n.cls}" data-ref="${esc(n.ref)}"><span>${esc(n.t)}</span><b>${esc(n.v)}</b><small>${esc(n.s)}</small></button></li>`).join('');
    const el = $('#vstream'); if (el.innerHTML !== html && !el.matches(':hover')) el.innerHTML = html;
  }
  $('#vstream').addEventListener('click', e => { const b = e.target.closest('[data-ref]'); if (b) select(b.dataset.ref, { focusPanel: true }); });

  /* ---------------- labels over the 3D view ---------------- */
  const lab = $('#labels');
  function mk(cls, text, ref) { const el = document.createElement(ref ? 'button' : 'div'); el.className = 'lb ' + cls; el.textContent = text; if (ref) { el.type = 'button'; el.dataset.ref = ref; el.tabIndex = -1; } lab.append(el); return el; }
  for (const z of P.layout.ZONES) { const el = mk('lb-zone', z.name); V.label(el, () => [(z.x0 + z.x1) / 2, 0.1, z.z0 + 1.6], 0); }
  const lineLabels = {};
  for (const id of ['L1', 'L2', 'L3', 'L4']) { const L = line(id), s0 = L.stations[0]; const el = mk('lb-line', L.name); lineLabels[id] = el; V.label(el, () => [s0.x - s0.w / 2 - 2.6, 0.1, s0.z], 1); }
  { const el = mk('lb-line', 'Test & Pack'); lineLabels.L5 = el; V.label(el, () => [E.QC.x + 3.5, 0.1, E.QC.z + 3], 1); }
  const pills = new Map();
  for (const s of P.stations) {
    const el = mk('lb-st', s.name); V.label(el, () => [s.x, (s.h || 1) + 0.9, s.z], 2);
    const pill = mk('lb-pill', '', 'st:' + s.id); pill.hidden = true; pills.set(s.id, pill);
    V.label(pill, () => (pill.hidden ? null : [s.x, (s.kind === 'burnin' ? 2.6 : s.h || 1) + 2.2, s.z]), 0);
  }
  const agvPills = new Map();
  for (const a of P.agvs) {
    const el = mk('lb-agv', a.id); V.label(el, () => [a.x, 1.4, a.z], 2);
    const pill = mk('lb-pill bad', `${a.id} · fault`, 'agv:' + a.id); pill.hidden = true; agvPills.set(a.id, pill); V.label(pill, () => (pill.hidden ? null : [a.x, 2.2, a.z]), 0);
  }
  const people = [];
  for (const p of P.people) { if (p.role === 'Forklift') continue; const el = mk('lb-person', p.name.replace('Eng. ', '')); people.push(el); V.label(el, () => [p.x, 2.0, p.z], d => V.overlay === 'people' && d < 140); }
  const lsPills = new Map();
  for (const b of Object.values(E.LS)) { const pill = mk('lb-pill warn', '', 'buf:' + b.id); pill.hidden = true; lsPills.set(b.id, pill); V.label(pill, () => { if (pill.hidden) return null; const r = V.refInfo('buf:' + b.id); return r && [r.x, 1.8, r.z]; }, 0); }
  const selLabel = mk('lb-sel', ''); selLabel.hidden = true;
  V.label(selLabel, () => { if (!sel || selLabel.hidden) return null; const r = V.refInfo(sel); return r && [r.x, (r.y || 0) + (r.h || 1) + 1.4, r.z]; }, 0);
  lab.addEventListener('click', e => { const b = e.target.closest('[data-ref]'); if (b) select(b.dataset.ref, { focusPanel: true }); });
  function labelsTick() {
    for (const id in lineLabels) { const L = line(id); lineLabels[id].textContent = `${L.name} · ${fmt(L.tph)}/h${L.state !== 'run' ? ' · ' + (STATE[L.state] || L.state).toLowerCase() : ''}`; lineLabels[id].className = 'lb lb-line ' + SCLS(L.state); }
    for (const s of P.stations) {
      const pill = pills.get(s.id), long = P.t - s.since;
      // what the agents know, not the model's hidden truth: a wear case shows its own remaining-life estimate
      const wc = A.S.cases.find(c => c.kind === 'wear' && c.station === s.id && c.state !== 'closed');
      const vib = s.sens.vib && s.sens.vib > 4.5;
      const show = s.state === 'down' || s.state === 'maint' || s.state === 'changeover' || (s.state === 'starved' && long > 45) || (s.state === 'micro' && long > 60) || !!wc || vib;
      pill.hidden = !show;
      if (show) {
        const early = (wc || vib) && s.state !== 'down' && s.state !== 'maint';
        pill.textContent = `${s.name} · ${early ? (wc && wc.diagnosis && wc.diagnosis.rul ? 'failure in about ' + mins(wc.diagnosis.rul.p50 * 60) : 'vibration ' + (s.sens.vib || 0).toFixed(1) + ' mm/s') : (STATE[s.state] || s.state).toLowerCase()}`;
        pill.className = 'lb lb-pill ' + SCLS(early ? 'warn' : s.state);
      }
    }
    for (const a of P.agvs) agvPills.get(a.id).hidden = !a.fault;
    for (const b of Object.values(E.LS)) {
      const pill = lsPills.get(b.id), lv = E.level(b);
      const late = lv <= 0 || (lv <= b.rop * 0.5 && (!b.mission || !b.mission.agv || b.mission.agv.fault));
      pill.hidden = !late; if (late) { pill.textContent = `${b.label} · ${lv <= 0 ? 'empty' : 'low'}`; pill.className = 'lb lb-pill ' + (lv <= 0 ? 'bad' : 'warn'); }
    }
    if (sel) { selLabel.hidden = false; selLabel.textContent = labelFor(sel); } else selLabel.hidden = true;
  }
  function labelFor(ref) {
    const [k, id] = ref.split(/:(.+)/);
    if (k === 'st') return P.byId[id] ? P.byId[id].name : id;
    if (k === 'buf') return P.bufs[id] ? P.bufs[id].label : id;
    if (k === 'unit') return id;
    return id;
  }

  /* ---------------- hover tooltip ---------------- */
  const tip = $('#tip');
  function hover(h) {
    if (!h) { tip.hidden = true; return; }
    const [k, id] = h.ref.split(/:(.+)/);
    let extra = '';
    if (k === 'st' && P.byId[id]) { const s = P.byId[id]; extra = (STATE[s.state] || s.state) + (s.why ? ' · ' + s.why : ''); }
    if (k === 'agv') { const a = P.agvs.find(a => a.id === id); if (a) extra = a.fault ? 'Fault' : a.mission ? `Bringing ${a.mission.buf.label.toLowerCase()}` : 'Parked'; }
    if (k === 'unit') { const u = E.findUnit(id); if (u) extra = where(u); }
    tip.innerHTML = `<b>${esc(h.name)}</b>${extra ? `<span>${esc(extra)}</span>` : ''}`;
    const r = $('#view3d').getBoundingClientRect();
    tip.style.transform = `translate(${Math.min(r.width - 240, h.x - r.left + 14)}px, ${h.y - r.top + 14}px)`;
    tip.hidden = false;
  }

  /* ---------------- views, overlays, speed ---------------- */
  $$('.pl-views [data-view]').forEach(b => b.addEventListener('click', () => {
    $$('.pl-views [data-view]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    const v = b.dataset.view;
    if (v === 'overview') V.view('overview'); else { const z = P.layout.ZONES.find(z => z.id === v); V.view(z.view); }
  }));
  const LEGEND = {
    status: '<span><i class="ok"></i>Running</span><span><i class="warn"></i>Slow, short stop or starved</span><span><i class="bad"></i>Stopped</span><span><i class="maint"></i>Planned work</span>',
    flow: '<span><i class="info"></i>Moving material: conveyors, AGV and forklift routes</span>',
    energy: '<span class="ramp"><i></i>Machine power, low to high</span>',
    quality: '<span><i class="warn"></i>Inspection rejecting above normal</span><span><i class="bad"></i>Above 3%</span>',
    people: '<span><i class="person"></i>Operators</span><span><i class="info"></i>Technicians</span>'
  };
  function setOverlay(m) {
    V.setOverlay(m);
    $$('.pl-overlay [data-overlay]').forEach(x => x.setAttribute('aria-pressed', String(x.dataset.overlay === m)));
    $('#legend').innerHTML = LEGEND[m];
  }
  $$('.pl-overlay [data-overlay]').forEach(b => b.addEventListener('click', () => setOverlay(b.dataset.overlay)));
  setOverlay('status');
  function setSpeed(v) { T.setSpeed(v); }
  const speedUi = v => $$('.pl-speed [data-speed]').forEach(x => x.setAttribute('aria-pressed', String(+x.dataset.speed === v)));
  T.on((t, d) => { if (t === 'speed') speedUi(d); if (t === 'catching') { $('#sync').hidden = !d; } });
  speedUi(T.speed);
  $$('.pl-speed [data-speed]').forEach(b => b.addEventListener('click', () => setSpeed(+b.dataset.speed)));
  addEventListener('themechange', e => V.setTheme(e.detail));

  /* ---------------- drills ---------------- */
  const drills = $('#drills'), drillBtn = $('#drillBtn');
  drills.innerHTML = `<p class="menu-h">Start a real-world drill. The agents are not told: they find it in the plant's data, simulate the options and come to you.</p>` + E.SCENARIOS.map(s => `<button type="button" class="drill" data-drill="${s.id}"><b>${esc(s.title)}</b><span>${esc(s.what)}</span><small>${esc(s.chain)}</small></button>`).join('')
    + `<div class="menu-f"><button type="button" class="btn btn-secondary btn-sm" data-ff="600">Fast-forward 10 min</button><button type="button" class="btn btn-secondary btn-sm" data-ff="1800">30 min</button><button type="button" class="btn btn-ghost btn-sm" data-reset>New shift (reset)</button></div>
      <div class="menu-f menu-q" role="group" aria-label="Graphics"><span>Graphics</span>${['high', 'medium', 'low'].map(q => `<button type="button" class="btn btn-ghost btn-sm" data-q="${q}" aria-pressed="${V.quality === q}">${q === 'high' ? 'Best' : q === 'medium' ? 'Balanced' : 'Fast'}</button>`).join('')}<button type="button" class="btn btn-ghost btn-sm" data-cine aria-pressed="false">Cinematic</button></div>`;
  const openMenu = v => { drills.hidden = !v; drillBtn.setAttribute('aria-expanded', String(v)); if (v) drills.querySelector('button').focus(); };
  drillBtn.addEventListener('click', () => openMenu(drills.hidden));
  drills.addEventListener('click', e => {
    const d = e.target.closest('[data-drill]'), ff = e.target.closest('[data-ff]'), qb = e.target.closest('[data-q]');
    if (d) {
      T.trigger(d.dataset.drill); openMenu(false);
      const sc = E.SCENARIOS.find(s => s.id === d.dataset.drill);
      toast(`Drill started: ${sc.title}. Watch the agents pick it up.`, 'info');
      const target = { bearing: 'st:L1-MounterB', agv: null, lot: 'st:L3-Panelload', reflow: 'st:L2-Reflow', robot: 'st:L4-Screwrobot', inbound: 'buf:RM:panel', power: 'util:UTIL-TX', peak: 'util:UTIL-CH2', heat: 'util:UTIL-CH1', safety: 'st:L4-Screwrobot', rush: null, absent: 'st:L3-Backcover' }[sc.id];
      if (sc.id === 'agv') setTimeout(() => { const a = P.agvs.find(x => x.fault); select(a ? 'agv:' + a.id : null); }, 400);
      else if (target) select(target, { focusPanel: true }); else select(null);
    }
    if (ff) { T.fastForward(+ff.dataset.ff); openMenu(false); toast(`Moving ${+ff.dataset.ff / 60} minutes ahead`, 'info'); }
    if (e.target.closest('[data-reset]')) T.reset();
    if (qb) { V.setQuality(qb.dataset.q); $$('[data-q]', drills).forEach(x => x.setAttribute('aria-pressed', String(x === qb))); }
    if (e.target.closest('[data-cine]')) { const b = e.target.closest('[data-cine]'); V.setCinematic(!V.cinematic); b.setAttribute('aria-pressed', String(V.cinematic)); }
  });
  document.addEventListener('click', e => { if (!drills.hidden && !e.target.closest('.pl-drill')) openMenu(false); });

  /* ---------------- serial search ---------------- */
  $('#find').addEventListener('submit', e => {
    e.preventDefault();
    const v = $('#findIn').value.trim(); if (!v) return;
    const u = E.findUnit(v);
    if (u) select('unit:' + u.sn, { focusPanel: true }); else toast(`No unit ${v} found today`, 'warning');
  });

  /* ---------------- guided tour ---------------- */
  const cap = $('#caption');
  let tour = null;
  const TOUR = [
    { go: () => { V.view('overview'); select(null); }, t: 'Plant EG-01, live', s: 'Six zones, five lines, six AGVs, two forklifts and thirteen people. Everything moves because the plant model moves: no video, no loops.' },
    { go: () => V.view(P.layout.ZONES[0].view), t: 'Raw materials', s: 'Every pallet in these racks is a real stock level: TV panels by supplier lot, bare boards, reels, covers, housings, displays and cartons.' },
    { go: () => V.view(P.layout.ZONES[1].view), t: 'SMT hall', s: 'Two lines print, place, solder and inspect boards. Each board gets a serial with its paste temperature, oven peak and AOI result.' },
    { go: () => select('buf:SM:main'), t: 'Board supermarket', s: 'SMT fills it; when a line-side stock reaches its reorder point, an AGV brings the next batch. Pull, not push.' },
    { go: () => { const u = [...P.units].find(u => u.type === 'tv' && u.loc && u.loc.k === 'seg' && u.loc.seg.from && u.loc.seg.from.line === 'L3'); if (u) select('unit:' + u.sn, { follow: true }); else V.view(P.layout.ZONES[2].view); }, t: 'Follow one TV', s: 'Its passport records every station, operator, part serial and test result, from the panel lot to the truck.' },
    { go: () => { V.setFollow(false); V.view(P.layout.ZONES[3].view); }, t: 'Burn-in and final QC', s: 'Every TV shows a test pattern for 18 minutes, every phone runs a battery cycle for 10, then a camera checks the screen.' },
    { go: () => V.view(P.layout.ZONES[4].view), t: 'Finished goods and docks', s: 'Forklifts store pallets and load the truck for each order. The AI forecasts when every order will be ready.' },
    { go: () => { T.trigger('bearing'); select('st:L1-MounterB'); }, t: 'Now a problem', s: 'Mounter B’s spindle bearing starts to wear. Nobody tells the agents: the Maintenance agent finds the vibration trend, plays three options forward on copies of this plant and brings you its recommendation.', last: true }
  ];
  function tourStep(i) {
    if (!tour) return;
    tour.i = i; const st = TOUR[i];
    st.go();
    cap.innerHTML = `<p class="cap-n">${i + 1} / ${TOUR.length}</p><h2>${esc(st.t)}</h2><p>${esc(st.s)}</p><div class="cap-a">${st.last ? '' : '<button type="button" class="btn btn-primary btn-sm" data-tour="next">Next</button>'}<button type="button" class="btn btn-secondary btn-sm" data-tour="stop">${st.last ? 'Close' : 'Stop tour'}</button></div>`;
    cap.hidden = false;
    clearTimeout(tour.timer);
    if (!st.last) tour.timer = setTimeout(() => tourStep(i + 1), 9000);
  }
  function startTour() { tour = { i: 0 }; setSpeed(4); tourStep(0); }
  function stopTour() { if (tour) clearTimeout(tour.timer); tour = null; cap.hidden = true; V.setFollow(false); }
  $('#tourBtn').addEventListener('click', () => (tour ? stopTour() : startTour()));
  cap.addEventListener('click', e => { const b = e.target.closest('[data-tour]'); if (!b) return; if (b.dataset.tour === 'next' && tour) tourStep(Math.min(TOUR.length - 1, tour.i + 1)); else stopTour(); });

  /* ---------------- keyboard ---------------- */
  const embed = /[?&]embed=1/.test(location.search) && parent !== window;
  if (embed) document.body.classList.add('embed');
  addEventListener('keydown', e => {
    if (e.target.closest('input, textarea')) { if (e.key === 'Escape') e.target.blur(); return; }
    if (embed && ['ArrowRight', 'ArrowLeft', 'PageDown', 'PageUp', 'f', 'F', 'n', 'N', 'b', 'B'].includes(e.key)) { e.preventDefault(); parent.postMessage({ dfDeckKey: e.key }, location.origin); return; }
    if (e.key === ' ' && !e.target.closest('button')) { e.preventDefault(); setSpeed(T.paused ? 1 : 0); }
    else if (e.key === '1') setSpeed(1); else if (e.key === '2') setSpeed(4); else if (e.key === '3') setSpeed(16);
    else if (e.key === 't' || e.key === 'T') window.Theme && Theme.toggle();
    else if (e.key === 'g' || e.key === 'G') tour ? stopTour() : startTour();
    else if (e.key === '/') { e.preventDefault(); $('#findIn').focus(); }
    else if ((e.key === 'c' || e.key === 'C') && !e.metaKey && !e.ctrlKey && window.Copilot) { e.preventDefault(); Copilot.open(); }
    else if (e.key === 'Escape') { if (!drills.hidden) openMenu(false); else if (tour) stopTour(); else select(null); }
  });

  /* ---------------- deep links: plant.html#st:L1-MounterB, #unit:TV26-…, #drill:bearing ---------------- */
  function fromHash() {
    const h = decodeURIComponent(location.hash.slice(1));
    if (!h) return;
    if (h.startsWith('drill:')) { T.trigger(h.slice(6)); return; }
    if (h === 'tour') return startTour();
    if (/^(st|buf|agv|unit|order|zone|util|case):/.test(h)) setTimeout(() => select(h), 600);
  }

  /* ---------------- loop ---------------- */
  let acc = 0, accR = 0;
  V.on((t, dt) => {
    if (t !== 'frame') return;
    acc += dt; accR += dt;
    if (acc > 0.5) { acc = 0; kpis(); vstream(); labelsTick(); }
    if (accR > 0.9) { accR = 0; render(); }
  });
  A.on(t => { if (t === 'change' || t === 'step' || t === 'awaiting' || t === 'closed') { if (sel && sel.startsWith('case:')) render(); } });
  CaseUI.bind(insp, () => setTimeout(() => render(true), 60));
  kpis(); vstream(); labelsTick(); render(true);
  const cpb = $('#btnCopilot'); if (cpb) cpb.onclick = () => window.Copilot && Copilot.open(sel && !sel.startsWith('kpi:') ? `Tell me about ${sel.replace(/^\w+:/, '')}: its state, what drives it and what you would do.` : undefined);
  fromHash();
  addEventListener('hashchange', fromHash);
  booted = true;
  if (boot) { boot.classList.add('done'); setTimeout(() => boot.remove(), 600); }
  if (T.restored === 'tab') toast('Joined the plant already running in another tab', 'info');
  else if (T.restored === 'saved') toast(`Continuing the plant from your last visit (${clock(P.t)}). Drills menu → New shift to start over.`, 'info');
  window.Plant = { E, V, select, T, A };   // for the console and the presentation
})();
