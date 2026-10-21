/* Digital Factory — Live plant, the 2D views: GMES boards for every line, SAP and the data flow, S&OP, MRP, the
   departments and the AI agents view (the crew, its simulated decisions and the ask box). Each view reads the engine (floor) and the enterprise layer (offices) and is
   redrawn about once a second; packets on the data-flow diagram move every frame. Shared helpers for the page live
   here too. All data is simulated. */
(function () {
  'use strict';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const icon = n => (typeof Icons !== 'undefined' ? Icons.get(n) : '');
  const fmt = n => Math.round(n).toLocaleString('en-US');
  const pct = (v, d = 1) => (v * 100).toFixed(d) + '%';
  const STATE = { run: 'Running', warn: 'Running slow', idle: 'Idle', starved: 'Starved', blocked: 'Blocked', down: 'Stopped', maint: 'Planned maintenance', micro: 'Short stop', changeover: 'Changeover', tripped: 'Tripped' };
  const SCLS = st => (st === 'down' || st === 'tripped' ? 'bad' : st === 'maint' ? 'maint' : st === 'warn' || st === 'starved' || st === 'micro' || st === 'changeover' ? 'warn' : '');
  const chip = (st, why) => `<span class="st ${SCLS(st)}"><i></i>${esc(STATE[st] || st)}${why ? ` · ${esc(why)}` : ''}</span>`;
  const link = (ref, text) => `<button type="button" class="lnk" data-ref="${esc(ref)}">${esc(text)}</button>`;
  const bar = (k, cls = '') => `<span class="bar ${cls}"><i style="width:${Math.max(0, Math.min(100, k * 100)).toFixed(1)}%"></i></span>`;
  // focus targets used by recommendations ('focus:<arg>') → a selectable reference
  function refFromFocus(a) {
    if (!a) return null;
    if (/^(IMP|LOC|INJ|PRS|PBA|SVC|SILO|HALL|LS|WIP):/.test(a)) return 'buf:' + a;
    if (a.startsWith('AGV')) return 'agv:' + a;
    if (a.startsWith('UTIL')) return 'util:' + a;
    if (a.startsWith('mrp:') || a === 'sop' || a.startsWith('order:') || a.startsWith('svc:')) return a;
    return 'st:' + a;
  }
  function spark(arr, o = {}) {
    if (!arr || arr.length < 2) return '';
    const w = o.w || 280, h = o.h || 46, a = arr.slice(-90);
    let lo = Math.min(...a), hi = Math.max(...a);
    if (o.lo !== undefined) lo = Math.min(lo, o.lo); if (o.hi !== undefined) hi = Math.max(hi, o.hi);
    if (o.limit !== undefined) { lo = Math.min(lo, o.limit); hi = Math.max(hi, o.limit); }
    if (hi - lo < 1e-6) { hi += 1; lo -= 1; }
    const Xp = i => (i / (a.length - 1)) * w, Y = v => h - 3 - ((v - lo) / (hi - lo)) * (h - 6);
    const d = a.map((v, i) => `${i ? 'L' : 'M'}${Xp(i).toFixed(1)} ${Y(v).toFixed(1)}`).join('');
    const lim = o.limit !== undefined ? `<line x1="0" x2="${w}" y1="${Y(o.limit).toFixed(1)}" y2="${Y(o.limit).toFixed(1)}" class="lim"/>` : '';
    return `<svg class="spark ${o.cls || ''}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true">${lim}<path d="${d}"/></svg>`;
  }
  // the agents' recommendation under a decision card: what they simulated and what they would do
  function agentLine(r) {
    const c = H.AG && H.AG.cards.get(r.key);
    if (!c || !c.best) return '';
    const b = c.best, d = b.f.packed - c.base.f.packed, dl = c.base.f.late - b.f.late;
    const gain = b === c.base ? '' : [d > 0 ? `+${fmt(d)} TVs` : '', dl > 0 ? `${dl} order${dl > 1 ? 's' : ''} saved` : ''].filter(Boolean).join(', ');
    return `<p class="rec-ai">${icon('sparkles')}<span><b>${esc(c.agentName)}</b> simulated ${c.options.length} option${c.options.length > 1 ? 's' : ''} over ${c.h / 60} h and recommends <b>${esc(b.label)}</b>${gain ? ` (${gain} against doing nothing)` : ''}${b.f.late ? `, ${b.f.late} order${b.f.late > 1 ? 's' : ''} still at risk` : ''}.${c.autoAt && !c.veto && !c.decided ? ` Low risk: goes ahead at ${clockOf(c.autoAt)} unless vetoed.` : ''}</span>${c.autoAt && !c.veto && !c.decided ? `<button type="button" class="btn btn-sm btn-ghost" data-veto="${esc(c.key)}" data-key="veto-${esc(c.key)}">Veto</button>` : ''}</p>`;
  }
  const clockOf = t => { const m = Math.floor(t / 60); return `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; };
  function recCards(list, X) {
    if (!list.length) return '';
    return list.map(r => {
      const dept = X ? X.DEPTS.find(d => d.id === (r.dept || X.deptOf(r.agent))) : null;
      return `<article class="rec ${r.level}"><p class="rec-who">${esc(dept ? dept.name : r.agent + ' agent')} · ${r.time}</p><h4>${esc(r.title)}</h4><p>${esc(r.body)}</p>${agentLine(r)}
      <div class="rec-act">${(r.actions || []).map((a, i) => `<button type="button" class="btn btn-sm ${i === 0 && !a.id.startsWith('focus') ? 'btn-primary' : 'btn-secondary'}" data-key="${esc(a.id)}" ${a.id.startsWith('focus') ? `data-ref="${esc(refFromFocus(a.id.slice(6)))}"` : `data-act="${esc(a.id)}"`}>${esc(a.label)}</button>`).join('')}
      <button type="button" class="btn btn-sm btn-ghost" data-dismiss="${esc(r.key)}" data-key="x-${esc(r.key)}">Dismiss</button></div></article>`;
    }).join('');
  }
  const H = { esc, icon, fmt, pct, STATE, SCLS, chip, link, bar, refFromFocus, recCards, spark, AG: null };

  /* small SVG charts */
  function lineChart(series, o = {}) {
    // series: [{ v: [...], cls, dash, bars }]; x labels in o.labels
    const w = o.w || 640, h = o.h || 220, pl = 46, pr = 12, pt = 12, pb = 26;
    const all = series.flatMap(s => s.v);
    const hi = Math.max(1, ...all) * 1.08, n = series[0].v.length;
    const X = i => pl + (i + 0.5) * (w - pl - pr) / n, Y = v => pt + (h - pt - pb) * (1 - v / hi);
    const bw = (w - pl - pr) / n * 0.56;
    let g = '';
    for (let k = 0; k <= 4; k++) { const v = hi * k / 4, y = Y(v); g += `<line x1="${pl}" x2="${w - pr}" y1="${y}" y2="${y}" class="gl"/><text x="${pl - 6}" y="${y + 4}" class="ax" text-anchor="end">${v >= 1000 ? Math.round(v / 1000) + 'k' : Math.round(v)}</text>`; }
    (o.labels || []).forEach((l, i) => { g += `<text x="${X(i)}" y="${h - 8}" class="ax" text-anchor="middle">${esc(l)}</text>`; });
    for (const s of series) {
      if (s.bars) g += s.v.map((v, i) => `<rect x="${X(i) - bw / 2}" y="${Y(v)}" width="${bw}" height="${Math.max(0, Y(0) - Y(v))}" rx="2" class="${s.cls}"><title>${esc(s.name)} ${esc(o.labels ? o.labels[i] : '')}: ${fmt(v)}</title></rect>`).join('');
      else g += `<path d="${s.v.map((v, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)} ${Y(v).toFixed(1)}`).join('')}" class="${s.cls}${s.dash ? ' dash' : ''}"/>` + s.v.map((v, i) => `<circle cx="${X(i)}" cy="${Y(v)}" r="2.6" class="${s.cls}"><title>${esc(s.name)} ${esc(o.labels ? o.labels[i] : '')}: ${fmt(v)}</title></circle>`).join('');
    }
    return `<svg class="chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(o.label || 'Chart')}">${g}</svg>`;
  }

  function createViews(root, E, X, ui) {
    const P = E.P, { mins, clock } = E;
    const MODELS = E.MODELS;
    const line = id => P.lines[id];
    const state = { mode: null, lossLine: 'ML1', skLine: 'ML3', draft: 'live', sopModel: 'all', sopScen: X.sop.approved || 'chase', mrpCode: 'OC-65', sapSel: null };
    const level = E.level;
    const kind = k => Object.values(P.lines).filter(L => L.kind === k);
    const lsCls = b => { const lv = level(b); return lv <= 0 ? 'bad' : lv <= b.rop * 0.5 ? 'warn' : ''; };

    /* ---------------- GMES: every line on one board ---------------- */
    function cell(s) { return `<button type="button" class="cell ${SCLS(s.state)} ${s.state === 'idle' || s.state === 'blocked' ? 'off' : ''}" data-ref="st:${esc(s.id)}" title="${esc(s.name)} · ${esc(STATE[s.state] || s.state)}${s.why ? ' · ' + esc(s.why) : ''}"><span>${esc(s.name)}</span></button>`; }
    function feeder(L, label) {
      if (!L) return '';
      return `<button type="button" class="fd ${SCLS(L.state)}" data-ref="line:${L.id}"><span>${esc(label)}</span><b>${fmt(L.tph)}/h</b><small>${esc(STATE[L.state] || L.state)}</small></button>`;
    }
    /* andon: every stop on a main, LCM or SMD line climbs the escalation ladder with time */
    const TIERS = [['Team leader', 0], ['Group leader', 60], ['Area manager', 300], ['Plant manager', 600]];
    function andon() {
      const calls = P.stations.filter(s => /^(ML|LCM|SMD)/.test(s.line) && (s.state === 'down' || (s.state === 'starved' && P.t - s.since > 120) || s.state === 'micro'))
        .map(s => ({ s, d: P.t - (s.since || P.t) })).sort((a, b) => b.d - a.d).slice(0, 8);
      const safe = H.AG ? H.AG.incidents.filter(i => P.t - i.t < 600) : [];
      const sRows = safe.map(i => `<li class="bad"><div><b>${esc(i.cam)}</b><small>Safety · ${esc(i.text)}</small></div><ol class="tiers" aria-label="Escalated to the area manager">${TIERS.map((t, k) => `<li class="${k <= 2 ? 'on' : ''}">${t[0]}</li>`).join('')}</ol><b>${mins(P.t - i.t)}</b></li>`).join('');
      if (!calls.length && !sRows) return '<p class="quiet">No andon call open. Every station on the main, LCM and SMD lines is running.</p>';
      return `<ol class="andon">${sRows}${calls.map(({ s, d }) => {
        const tier = TIERS.filter(t => d >= t[1]).length - 1, kindT = s.state === 'down' ? 'Breakdown' : s.state === 'micro' ? 'Short stop' : 'Material';
        return `<li class="${s.state === 'down' ? 'bad' : 'warn'}"><div>${link('st:' + s.id, s.name)}<small>${esc(line(s.line).name)} · ${kindT}${s.why ? ' · ' + esc(s.why) : ''}</small></div>
          <ol class="tiers" aria-label="Escalated to ${TIERS[tier][0]}">${TIERS.map((t, i) => `<li class="${i <= tier ? 'on' : ''}" title="${t[0]} after ${t[1] / 60} min">${t[0]}</li>`).join('')}</ol><b>${mins(d)}</b></li>`;
      }).join('')}</ol>`;
    }
    /* the OEE loss tree of a line: where the time of its constraint went since the model start */
    function lossTree(L) {
      const s = L.bn; if (!s) return '';
      const c = s.counters, el = Math.max(1, c.run + c.idle + c.starved + c.blocked + c.down), per = c.made ? c.std / c.made : MODELS[L.model].takt;
      const bad = L.stations.reduce((a, x) => a + x.counters.bad, 0) * per;
      const flow = c.starved + c.blocked + c.idle, speed = Math.max(0, c.run - c.std);
      const rows = [['Planned maintenance', c.pm, 'Planned stop, outside OEE'], ['Breakdowns', c.brk, 'Availability'], ['Setup and changeover', c.co, 'Availability'], ['Small stops', c.micro, 'Performance'], ['Starved or blocked', flow, 'Flow loss from other stations'], ['Reduced speed', speed, 'Performance'], ['Defects and rework', Math.min(bad, Math.max(0, c.std)), 'Quality']];
      let left = el; const out = [];
      out.push(`<li class="tot"><span>Last ${Math.round(el / 60)} min</span><i style="--l:0%;--w:100%"></i><b>${Math.round(el / 60)} min</b></li>`);
      for (const [t, v, g] of rows) { const w = v / el * 100; left -= v; out.push(`<li><span>${t}<small>${g}</small></span><i class="ls" style="--l:${(left / el * 100).toFixed(2)}%;--w:${w.toFixed(2)}%"></i><b>${(v / 60).toFixed(1)} min</b></li>`); }
      out.push(`<li class="ok"><span>Fully productive<small>OEE of the constraint</small></span><i style="--l:0%;--w:${Math.max(0, left / el * 100).toFixed(2)}%"></i><b>${pct(Math.max(0, left) / el, 0)}</b></li>`);
      const rs = {};
      for (const x of L.stations) { const add = (k, v) => { const [stt, why] = k.split('|'); const key = x.id + '|' + k; rs[key] = rs[key] || { st: x, state: stt, why: why || STATE[stt], v: 0 }; rs[key].v += v; }; for (const k in x.rs || {}) add(k, x.rs[k]); if (['down', 'maint', 'micro', 'changeover', 'starved', 'blocked'].includes(x.state)) add(x.state + '|' + (x.why || ''), P.t - x.since); }
      const top = Object.values(rs).sort((a, b) => b.v - a.v).slice(0, 6);
      const reasons = top.length ? `<h4 class="wf-h">Top reason codes on ${esc(L.name)}</h4><table class="tbl rc"><tbody>${top.map(r => `<tr><td>${link('st:' + r.st.id, r.st.name)}</td><td><span class="st ${SCLS(r.state)}"><i></i>${esc(STATE[r.state] || r.state)}</span><small>${esc(r.why)}</small></td><td>${(r.v / 60).toFixed(1)} min</td></tr>`).join('')}</tbody></table>` : '';
      return `<p class="quiet">Measured at ${link('st:' + s.id, s.name)}, the constraint of ${esc(L.name)}. Six big losses, plus the time it waited on the stations around it, since the model started.</p><ol class="wf">${out.join('')}</ol>${reasons}`;
    }
    /* APS: the next eight hours of every main line, with orders due and maintenance windows */
    function schedule() {
      const H8 = 8 * 3600, t0 = P.t, x = t => Math.max(0, Math.min(100, (t - t0) / H8 * 100));
      const late = new Set(H.AG && H.AG.base ? H.AG.base.lateList : []);
      const ticks = []; for (let h = Math.ceil(t0 / 3600); h * 3600 < t0 + H8; h++) ticks.push(`<span style="left:${x(h * 3600).toFixed(2)}%">${String(h % 24).padStart(2, '0')}:00</span>`);
      const shiftEnd = 14 * 3600, sb = shiftEnd > t0 && shiftEnd < t0 + H8 ? `<i class="shift" style="left:${x(shiftEnd)}%" title="Shift B starts 14:00"></i>` : '';
      const D = H.AG ? H.AG.drafts() : null, dr = D && state.draft !== 'live' ? D.list.find(x => x.id === state.draft) : null;
      const rows = kind('main').map(L => {
        const bars = [], rk = dr && dr.mods.rate ? (dr.mods.rate.find(r => r.id === L.id) || { k: 1 }).k : 1, co = dr && dr.mods.co ? dr.mods.co.find(c => c.id === L.id) : null;
        const rate = Math.max(30, L.tph || 3600 / MODELS[L.model].takt * 0.85) / 3600 * rk;
        let t = t0;
        if (co) { bars.push(`<i class="bk co dr" style="left:0;width:${x(t0 + co.dur * 60)}%" title="Draft: changeover to ${esc(MODELS[co.model].name)}"></i>`); t += co.dur * 60; }
        const dn = L.stations.filter(s => s.state === 'down' || s.state === 'maint' || s.state === 'changeover');
        if (dn.length) { const st = dn[0], d = Math.max(60, st.state === 'changeover' ? st.co : st.repair || 900); bars.push(`<i class="bk ${st.state === 'changeover' ? 'co' : st.state === 'maint' ? 'pm' : 'dn'}" style="left:0;width:${x(t0 + d)}%" title="${esc(st.name)} · ${esc(STATE[st.state])}"></i>`); t += d; }
        const o = X.pp.find(p => p.line === L.id && p.status !== 'TECO');
        let rem = o ? Math.max(0, o.qty - X.ppProgress(o)) : 0, n = o ? +o.id : 0, first = true, k = 0;
        while (t < t0 + H8) {
          const q = first ? rem : (o ? o.qty : 1500), d = q / rate;
          const mdl = co ? co.model : L.model, changed = rk !== 1 || co;
          bars.push(`<i class="bk ord ${first ? 'now' : ''} ${changed ? 'dr' : ''}" style="left:${x(t)}%;width:${(x(t + d) - x(t)).toFixed(2)}%" title="${co ? 'Draft: new order' : o ? `Order ${n + k}` : 'Planned order'} · ${fmt(q)} × ${esc(MODELS[mdl].name)}${rk !== 1 ? ` at ${Math.round(rk * 100)}% speed` : ''}"><span>${co ? `${MODELS[mdl].name} · draft order` : first ? `${o ? o.id : ''} · ${fmt(q)} left${rk !== 1 ? ` · ${Math.round(rk * 100)}%` : ''}` : `${MODELS[mdl].name} · next order`}</span></i>`);
          t += d; first = false; k++; if (bars.length > 6) break;
        }
        for (const w of P.wo.filter(w => w.status === 'Scheduled' && w.due && P.byId[w.st] && P.byId[w.st].line === L.id && w.due < t0 + H8)) bars.push(`<i class="bk pm" style="left:${x(w.due)}%;width:${Math.max(0.8, x(w.due + 1200) - x(w.due)).toFixed(2)}%" title="${esc(w.id)} · ${esc(w.why)}"></i>`);
        const due = P.orders.filter(od => (od.state === 'open' || od.state === 'loading') && od.model === L.model && od.due < t0 + H8).map(od => `<button type="button" class="due ${late.has(od.id) ? 'bad' : ''}" style="left:${x(od.due)}%" data-ref="order:${esc(od.id)}" title="Order ${esc(od.id)} · ${fmt(od.qty)} × ${esc(MODELS[od.model].name)} due ${clock(od.due)}${late.has(od.id) ? ' · forecast short' : ''}"><span class="sr-only">Order ${esc(od.id)} due ${clock(od.due)}</span></button>`).join('');
        return `<div class="gr"><button type="button" class="lnk" data-ref="line:${L.id}">${esc(L.name)}<small>${esc(MODELS[L.model].name)}</small></button><div class="gt">${bars.join('')}${due}${sb}</div></div>`;
      }).join('');
      const drafts = D ? `<div class="drafts"><div class="seg sm" role="group" aria-label="Plan">${D.list.map(d => `<button type="button" data-draft="${d.id}" aria-pressed="${(state.draft || 'live') === d.id}">${d.id === 'live' ? 'Live plan' : 'Draft ' + (d.id === 'AB' ? 'C' : d.id)}</button>`).join('')}</div>
        <div class="tblwrap"><table class="tbl dft"><thead><tr><th>Plan</th><th>TVs in ${D.h / 60} h</th><th>Orders late</th><th>Changeovers</th><th>Cost</th><th><span class="sr-only">Publish</span></th></tr></thead><tbody>${D.list.map(d => { const dp = d.f.packed - D.list[0].f.packed; return `<tr class="${d === D.best ? 'best' : ''} ${(state.draft || 'live') === d.id ? 'on' : ''}"><td><b>${esc(d.name)}</b>${d === D.best ? '<span class="tag">Recommended</span>' : ''}<small>${esc(d.note)}</small></td><td>${fmt(d.f.packed)}${d.id !== 'live' && dp ? `<small class="${dp > 0 ? 'up' : 'dn'}">${dp > 0 ? '+' : ''}${fmt(dp)}</small>` : ''}</td><td class="${d.f.late ? 'bad' : ''}">${d.f.late}</td><td>${d.co}</td><td>${d.cost ? 'EGP ' + fmt(d.cost / 1000) + 'k' : '—'}</td><td>${d.id === 'live' ? '<small>running</small>' : `<button type="button" class="btn btn-sm ${d === D.best ? 'btn-primary' : 'btn-secondary'}" data-publish="${d.id}" data-key="pub-${d.id}">Publish</button>`}</td></tr>`; }).join('')}</tbody></table></div></div>` : '';
      return `${drafts}<div class="gantt ${dr ? 'is-draft' : ''}"><div class="gr ax"><span></span><div class="gt">${ticks.join('')}</div></div>${rows}</div>
        <p class="legend2"><span class="k ord"></span>Production order (SAP PP) <span class="k pm"></span>Maintenance window (SAP PM) <span class="k co"></span>Changeover <span class="k dn"></span>Repair <span class="k due"></span>Truck due · red when the forecast is short</p>`;
    }
    function gmes() {
      const mains = kind('main');
      const k = P.kpi;
      const rows = mains.map((L, i) => {
        const n = i + 1, o = X.pp.find(p => p.line === L.id && p.status !== 'TECO');
        const done = o ? X.ppProgress(o) : 0;
        const ls = Object.entries(L.ls).map(([key, b]) => `<button type="button" class="lsb ${lsCls(b)}" data-ref="buf:${b.id}" title="${esc(b.label)} · ${fmt(level(b))} of ${fmt(b.cap)}"><span>${key}</span>${bar(level(b) / b.cap, lsCls(b))}</button>`).join('');
        return `<article class="gl-row">
          <header><button type="button" class="lnk ttl" data-ref="line:${L.id}">${esc(L.name)}</button><span class="mdl">${esc(MODELS[L.model].name)}</span>${chip(L.state)}</header>
          <div class="gl-nums"><div><b>${fmt(L.tph)}</b><small>TVs an hour</small></div><div><b>${pct(L.oee, 0)}</b><small>OEE</small></div><div><b>${fmt(done)}</b><small>of ${fmt(o ? o.qty : 0)} · order ${esc(o ? o.id : '—')}</small></div></div>
          <div class="chain">${L.stations.map(cell).join('<i class="ar" aria-hidden="true"></i>')}</div>
          <div class="gl-feed">${feeder(line('LCM' + n), `LCM line ${n}`)}${feeder(line('SMD' + n), `SMD ${n} · PBA ${line('SMD' + n).model.slice(1)}`)}${feeder(line('CUS' + n), `Cushion ${n}`)}<div class="lss">${ls}</div></div>
        </article>`;
      }).join('');
      const inj = P.lines.INJ.stations.map(s => `<button type="button" class="tile ${SCLS(s.state)}" data-ref="st:${s.id}"><b>${esc(s.id)}</b><span>${esc(s.part)}${s.spare ? ' · spare' : ''}</span><small>${esc(STATE[s.state] || s.state)}</small></button>`).join('');
      const press = kind('press').map(L => {
        const k2 = L.id.slice(2), st = L.stations;
        return `<tr><td>${link('line:' + L.id, L.name)}<small>Chassis ${L.size}"</small></td>${st.map(s => `<td>${link('st:' + s.id, s.name)}<small class="${SCLS(s.state)}">${esc(STATE[s.state] || s.state)}${s.kind === 'oven' ? ` · ${(s.sens.temp || 0).toFixed(0)} °C` : ''}</small></td>`).join('')}<td>${fmt(level(P.bufs[`WIP:PR${k2}:stamped`]))} · ${fmt(level(P.bufs[`WIP:PR${k2}:coated`]))}<small>stamped · coated</small></td></tr>`;
      }).join('');
      const store = (st, title) => `<div class="stc"><h4>${esc(title)}</h4>${Object.values(E.STORE[st]).map(b => { const k3 = level(b) / b.cap; return `<button type="button" class="srow" data-ref="buf:${b.id}"><span>${esc(b.code)}</span>${bar(k3, k3 < 0.12 ? 'bad' : k3 < 0.25 ? 'warn' : '')}<b>${fmt(level(b))}</b></button>`; }).join('')}</div>`;
      const veh = [...P.tuggers.map(t => [`tug:${t.id}`, t.id, t.routeName, t.plan ? `lap ${t.laps + 1} · ${t.plan.loads.length} drops` : 'waiting for its timetable']), ...P.agvs.map(a => [`agv:${a.id}`, a.id, 'PBA boards', a.fault ? 'fault' : a.mission ? `${a.mission.qty} × ${a.mission.buf.code} to ${P.byId[a.mission.buf.station].name} (${line(a.mission.buf.line).name})` : 'parked']), ...P.forklifts.map(f => [`fl:${f.id}`, f.id, f.role === 'fg' ? 'Finished goods' : 'Silos and halls', f.job ? (f.job.kind === 'store' ? 'storing a pallet' : 'loading ' + f.job.truck.id) : f.mission ? 'refilling ' + f.mission.buf.label.toLowerCase() : 'waiting'])];
      const docks = P.docks.map(d => `<li><b>${esc(d.id)}</b><span>${d.truck ? `${link('truck:' + d.truck.id, d.truck.id)} · ${fmt(d.truck.loaded)}/${fmt(d.truck.need)} × ${esc(MODELS[d.truck.model].name)} · order ${esc(d.truck.order.id)}` : 'free'}</span></li>`).join('');
      return `<header class="vh"><div><h2>GMES · shop floor</h2><p>${mains.filter(L => L.state === 'run' || L.state === 'warn').length} of 6 main lines running · ${fmt(k.units)} TVs packed against a plan of ${fmt(k.plan)} · OEE ${pct(k.oee || 0, 0)} · ${P.alarms.length} alarms</p></div></header>
        <section class="vs2 two"><div><h3>Andon <span>escalates to the group leader after 1 min, the area manager after 5, the plant manager after 10; safety events go straight to the area manager</span></h3>${andon()}</div>
          <div><h3>OEE loss tree</h3><div class="seg sm" role="group" aria-label="Line">${mains.map(L => `<button type="button" data-loss="${L.id}" aria-pressed="${state.lossLine === L.id}">${L.id.slice(2)}</button>`).join('')}</div>${lossTree(line(state.lossLine))}</div></section>
        <section class="vs2"><h3>Schedule · next eight hours <span>the live plan from SAP PP and PM, and the Scheduling agent's drafts, each simulated before a person publishes it</span></h3>${schedule()}</section>
        <section class="vs2"><h3>Main assembly lines and the sub-lines that feed them</h3><div class="gl-list">${rows}</div></section>
        <section class="vs2 two"><div><h3>Injection moulding · 20 machines</h3><div class="tiles">${inj}</div></div>
          <div><h3>Press, coating and sub-assembly</h3><table class="tbl"><thead><tr><th>Line</th><th>Press</th><th>Coating oven</th><th>Sub-assembly</th><th>WIP</th></tr></thead><tbody>${press}</tbody></table></div></section>
        <section class="vs2"><h3>Stores and supermarkets</h3><div class="stores">${store('IMP', 'Import warehouse')}${store('LOC', 'Local-vendor supermarket')}${store('INJ', 'Injection supermarket')}${store('PRS', 'Chassis supermarket')}${store('PBA', 'PBA supermarket (boards)')}${store('SVC', 'Service-parts store')}</div></section>
        <section class="vs2 two"><div><h3>Milk runs, AGVs and forklifts</h3><ul class="li">${veh.map(([r, id, what, now]) => `<li>${link(r, id)}<span>${esc(what)} · ${esc(now)}</span></li>`).join('')}</ul></div><div><h3>Shipping docks</h3><ul class="li">${docks}</ul></div></section>`;
    }

    /* ---------------- SAP and the data flow ---------------- */
    const NODES = (() => {
      const N = {};
      const col = (ids, x, y0, gap, w, h, grp) => ids.forEach(([id, t, s], i) => { N[id] = { id, t, s, x, y: y0 + i * gap, w, h, grp }; });
      col([['d:sales', 'Sales'], ['d:planning', 'Planning'], ['d:scm', 'SCM'], ['d:finance', 'Finance'], ['d:quality', 'Quality'], ['d:pe', 'PE'], ['d:bom', 'BOM team'], ['d:svc', 'SVC'], ['d:hr', 'HR']], 16, 22, 62, 128, 44, 'dept');
      col([['SAP-SD', 'SAP SD', 'Sales, delivery'], ['SOP', 'S&OP', 'Demand, supply'], ['SAP-PP', 'SAP PP', 'Orders, MRP'], ['SAP-MM', 'SAP MM', 'Purchasing, stock'], ['SAP-QM', 'SAP QM', 'Inspection'], ['SAP-FICO', 'SAP FI/CO', 'Finance'], ['SAP-PM', 'SAP PM', 'Maintenance']], 270, 40, 76, 150, 52, 'sap');
      col([['GMES', 'GMES', 'Every line'], ['WMS', 'WMS', 'Stores, AGVs'], ['PLM', 'PLM', 'BOM, firmware'], ['HR', 'HR system', 'Attendance']], 540, 70, 128, 140, 56, 'int');
      col([['f:main', 'Main lines 1–6'], ['f:lcm', 'LCM lines'], ['f:smd', 'SMD and PBA'], ['f:inj', 'Injection'], ['f:press', 'Press and coating'], ['f:cus', 'Cushions'], ['f:stores', 'Stores and milk runs'], ['f:docks', 'Docks and trucks']], 800, 22, 70, 170, 46, 'floor');
      return N;
    })();
    const EDGES = [['d:sales', 'SAP-SD'], ['d:svc', 'SAP-SD'], ['d:planning', 'SOP'], ['d:planning', 'SAP-PP'], ['d:scm', 'SAP-MM'], ['d:finance', 'SAP-FICO'], ['d:quality', 'SAP-QM'], ['d:pe', 'SAP-PM'], ['d:pe', 'PLM'], ['d:bom', 'PLM'], ['d:hr', 'HR'],
      ['SOP', 'SAP-PP'], ['SAP-SD', 'SAP-PP'], ['SAP-PP', 'SAP-MM'], ['SAP-MM', 'SAP-QM'], ['SAP-SD', 'SAP-FICO'], ['SAP-MM', 'SAP-FICO'],
      ['SAP-PP', 'GMES'], ['SAP-QM', 'GMES'], ['SAP-PM', 'GMES'], ['SAP-MM', 'WMS'], ['SAP-SD', 'WMS'], ['PLM', 'GMES'], ['HR', 'SAP-FICO'],
      ['GMES', 'f:main'], ['GMES', 'f:lcm'], ['GMES', 'f:smd'], ['GMES', 'f:inj'], ['GMES', 'f:press'], ['GMES', 'f:cus'], ['WMS', 'f:stores'], ['WMS', 'f:docks'], ['GMES', 'WMS']];
    const DEPT_OF_SYS = { 'SAP-SD': 'd:sales', SOP: 'd:planning', 'SAP-PP': 'd:planning', 'SAP-MM': 'd:scm', 'SAP-QM': 'd:quality', 'SAP-FICO': 'd:finance', 'SAP-PM': 'd:pe', PLM: 'd:pe', HR: 'd:hr' };
    function floorOf(m) {
      const r = m.ref || '', ln = m.line || (P.byId[r] ? P.byId[r].line : '');
      if (r.startsWith('order:') || r.startsWith('svc:')) return 'f:docks';
      if (/^(IMP|LOC|INJ|PRS|PBA|SVC|SILO|HALL|LS):/.test(r)) return 'f:stores';
      if (ln.startsWith('ML')) return 'f:main'; if (ln.startsWith('LCM')) return 'f:lcm'; if (ln.startsWith('SMD')) return 'f:smd';
      if (ln === 'INJ' || /^IM\d/.test(r)) return 'f:inj'; if (ln.startsWith('PR')) return 'f:press'; if (ln.startsWith('CUS')) return 'f:cus';
      return null;
    }
    const center = id => { const n = NODES[id]; return [n.x + n.w / 2, n.y + n.h / 2]; };
    const pk = [];   // packets on the diagram
    E.on((t, m) => {
      if (t !== 'msg' || state.mode !== 'sap' || pk.length > 70) return;
      const path = [];
      const f = NODES[m.from] ? m.from : null, to = NODES[m.to] ? m.to : null; if (!f || !to) return;
      const fl = floorOf(m);
      if (fl && (m.from === 'GMES' || m.from === 'WMS')) path.push(fl);
      else if (DEPT_OF_SYS[m.from] && !fl && Math.random() < 0.5) path.push(DEPT_OF_SYS[m.from]);
      path.push(f, to);
      if (fl && (m.to === 'GMES' || m.to === 'WMS') && path[0] !== fl) path.push(fl);
      pk.push({ path: path.map(center), t: 0, dur: 0.9 * (path.length - 1), m });
    });
    function sapDiagram() {
      const rect = n => `<g class="nd ${n.grp}" data-node="${n.id}"><rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="10"/><text x="${n.x + 12}" y="${n.y + (n.s ? 22 : n.h / 2 + 5)}" class="nt">${esc(n.t)}</text>${n.s ? `<text x="${n.x + 12}" y="${n.y + 40}" class="ns">${esc(n.s)}</text>` : ''}<text x="${n.x + n.w - 10}" y="${n.y + (n.s ? 22 : n.h / 2 + 5)}" class="nc" text-anchor="end" data-count="${n.id}"></text></g>`;
      const edge = ([a, b]) => { const A = center(a), B = center(b); const mx = (A[0] + B[0]) / 2; return `<path class="ed" d="M${A[0]} ${A[1]} C${mx} ${A[1]} ${mx} ${B[1]} ${B[0]} ${B[1]}"/>`; };
      const heads = [['Offices', 16], ['SAP', 270], ['Integration', 540], ['Shop floor', 800]].map(([t, x]) => `<text x="${x}" y="12" class="hd">${t}</text>`).join('');
      return `<svg class="flow" viewBox="0 0 990 600" role="img" aria-label="Data flow between the offices, SAP, GMES and the shop floor">${heads}${EDGES.map(edge).join('')}${Object.values(NODES).map(rect).join('')}<g id="pk"></g></svg>`;
    }
    function sap() {
      const so = P.orders.filter(o => o.state === 'open' || o.state === 'loading').slice(0, 8);
      const po = X.po.filter(p => p.status !== 'Closed').sort((a, b) => a.eta - b.eta).slice(0, 8);
      const pp = X.pp.filter(p => p.status !== 'TECO' && line(p.line) && line(p.line).kind === 'main');
      const log = X.msgs.slice(0, 16).map(m => `<tr><td>${esc(m.time)}</td><td><b>${esc(m.from)}</b> → ${esc(m.to)}</td><td>${esc(m.type)}${m.mvt ? ` <span class="mvt">${esc(m.mvt)}</span>` : ''}<small class="idoc">${esc(m.idoc || '')}</small></td><td>${m.ref ? link(m.ref.includes(':') ? (m.ref.startsWith('order:') || m.ref.startsWith('mrp:') || m.ref.startsWith('svc:') ? m.ref : 'buf:' + m.ref) : 'st:' + m.ref, m.text) : esc(m.text)}</td></tr>`).join('');
      return `<header class="vh"><div><h2>SAP and the data flow</h2><p>Every confirmation, goods movement, order and release travels through GMES to SAP and back. ${Math.round(X.stats.perMin)} messages a simulated minute.</p></div></header>
        <section class="vs2 flowwrap">${state.sapSvg || ''}</section>
        <section class="vs2"><h3>Live message log <span>newest first</span></h3><table class="tbl log"><thead><tr><th>Time</th><th>From → to</th><th>Message</th><th>Content</th></tr></thead><tbody>${log}</tbody></table>
          <p class="mvts"><b>Movement types:</b> <span class="mvt">101</span> goods receipt from production or a PO · <span class="mvt">261</span> issue to production (backflush) · <span class="mvt">311</span> transfer to line side · <span class="mvt">321</span> quality release · <span class="mvt">350</span> quality inspection to blocked · <span class="mvt">343</span> blocked to unrestricted · <span class="mvt">601</span> goods issue for delivery</p>
          <p class="mvts"><b>Interfaces (message type / basic type):</b> <span class="idoc">LOIPRO / LOIPRO01</span> production order to GMES · <span class="idoc">CONF21</span> confirmation · <span class="idoc">WMMBXY / WMMBID02</span> goods movement · <span class="idoc">ORDERS / ORDERS05</span> sales or purchase order · <span class="idoc">DESADV / DELVRY03</span> delivery · <span class="idoc">DELINS / DELFOR02</span> vendor call-off · <span class="idoc">WMTORD / WMTOID01</span> transfer order · <span class="idoc">SHPCON</span> goods issue · <span class="idoc">INVOIC / INVOIC02</span> invoice · <span class="idoc">ECMMAS + BOMMAT</span> engineering change and BOM · <span class="idoc">DOCMAS</span> firmware document. Notifications travel by API; MRP, QM and S&amp;OP post inside SAP.</p></section>
        <section class="vs2 three">
          <div><h3>Sales orders (SD)</h3><table class="tbl"><thead><tr><th>Order</th><th>Qty</th><th>Due</th><th>ATP</th></tr></thead><tbody>${so.map(o => `<tr><td>${link('order:' + o.id, o.id)}<small>${esc(o.customer)}</small></td><td>${fmt(o.qty)}<small>${esc(MODELS[o.model].name)}</small></td><td>${clock(o.due)}</td><td class="${o.atp && !o.atp.ok ? 'warn' : ''}">${o.state === 'loading' ? 'Loading' : o.atp && o.atp.ok ? 'Confirmed' : 'Short'}</td></tr>`).join('')}</tbody></table></div>
          <div><h3>Purchase orders (MM)</h3><table class="tbl"><thead><tr><th>PO</th><th>Material</th><th>ETA</th><th>Status</th></tr></thead><tbody>${po.map(p => `<tr><td>${link('po:' + p.id, p.id)}<small>${esc(p.vendor)}</small></td><td>${fmt(p.qty)}<small>${esc(p.code)}</small></td><td>${p.eta - P.t > 86400 ? `in ${Math.round((p.eta - P.t) / 86400)} d` : clock(p.eta)}</td><td class="${p.status === 'Held at port' ? 'bad' : ''}">${esc(p.status)}</td></tr>`).join('')}</tbody></table></div>
          <div><h3>Production orders (PP)</h3><table class="tbl"><thead><tr><th>Order</th><th>Line</th><th>Done</th></tr></thead><tbody>${pp.map(o => `<tr><td>${esc(o.id)}<small>${esc(MODELS[o.item] ? MODELS[o.item].name : o.item)}</small></td><td>${link('line:' + o.line, line(o.line).name)}</td><td>${fmt(X.ppProgress(o))}<small>of ${fmt(o.qty)}</small></td></tr>`).join('')}</tbody></table></div>
        </section>`;
    }
    function tickSap(dt) {
      const g = root.querySelector('#pk'); if (!g) { pk.length = 0; return; }
      let html = '';
      for (let i = pk.length - 1; i >= 0; i--) {
        const p = pk[i]; p.t += dt / p.dur; if (p.t >= 1) { pk.splice(i, 1); continue; }
        const n = p.path.length - 1, h = Math.min(n - 1, Math.floor(p.t * n)), k = p.t * n - h;
        const a = p.path[h], b = p.path[h + 1], mx = (a[0] + b[0]) / 2;
        // follow the same cubic as the edge
        const u = 1 - k, x = u * u * u * a[0] + 3 * u * u * k * mx + 3 * u * k * k * mx + k * k * k * b[0], y = u * u * u * a[1] + 3 * u * u * k * a[1] + 3 * u * k * k * b[1] + k * k * k * b[1];
        html += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4.5" class="pkt"/>`;
      }
      g.innerHTML = html;
    }
    function sapCounts() {
      const c = {};
      for (const m of X.msgs.slice(0, 120)) { c[m.from] = (c[m.from] || 0) + 1; c[m.to] = (c[m.to] || 0) + 1; const f = floorOf(m); if (f) c[f] = (c[f] || 0) + 1; }
      root.querySelectorAll('[data-count]').forEach(t => { const v = c[t.dataset.count]; t.textContent = v ? fmt(v) : ''; });
    }

    /* ---------------- S&OP ---------------- */
    function sop() {
      const S = X.sop, r = S.results[state.sopScen];
      const ms = state.sopModel === 'all' ? Object.keys(MODELS) : [state.sopModel];
      const sum = key => S.weeks.map((_, i) => ms.reduce((a, m) => a + r.models[m][key][i], 0));
      const chart = lineChart([{ name: 'Production', v: sum('prod'), cls: 'c-prod', bars: true }, { name: 'Demand', v: sum('demand'), cls: 'c-dem' }, { name: 'Capacity, no overtime', v: sum('cap'), cls: 'c-cap', dash: true }], { labels: S.weeks, label: 'Demand, production and capacity by week' });
      const invChart = lineChart([{ name: 'Finished-goods stock', v: sum('inv'), cls: 'c-inv' }, { name: 'Lost sales', v: sum('short'), cls: 'c-short', bars: true }], { labels: S.weeks, h: 150, label: 'Stock and lost sales by week' });
      const steps = S.steps.map((t, i) => `<li class="${i < S.step ? 'done' : i === S.step ? 'now' : ''}"><b>${i + 1}</b><span>${esc(t)}</span></li>`).join('');
      const card = sc => {
        const t = S.results[sc.id].tot, on = state.sopScen === sc.id, appr = S.approved === sc.id;
        return `<article class="scn ${on ? 'on' : ''}"><button type="button" class="scn-pick" data-scen="${sc.id}" aria-pressed="${on}"><h4>${esc(sc.name)}${appr ? ' <span class="tag">Approved plan</span>' : ''}</h4><p>${esc(sc.what)}</p></button>
          <dl class="kv"><div><dt>Service level</dt><dd class="${t.service < 0.95 ? 'warn' : ''}">${pct(t.service)}</dd></div><div><dt>Lost TVs</dt><dd>${fmt(t.lost)}</dd></div><div><dt>Overtime</dt><dd>${fmt(t.otH)} line-hours</dd></div><div><dt>Margin, 12 weeks</dt><dd>${X.egp(t.margin)}</dd></div><div><dt>Stock</dt><dd>${t.invDays.toFixed(1)} days of sales</dd></div></dl>
          ${S.step >= 3 && S.approved !== sc.id ? `<button type="button" class="btn btn-primary btn-sm" data-act="erp:sop:${sc.id}">Approve ${esc(sc.name)}</button>` : ''}</article>`;
      };
      const tbl = `<table class="tbl wk"><thead><tr><th></th>${S.weeks.map(w => `<th>${w}</th>`).join('')}</tr></thead><tbody>${[['Demand', 'demand'], ['Production', 'prod'], ['Stock at week end', 'inv'], ['Lost sales', 'short']].map(([t, k]) => `<tr><td>${t}</td>${sum(k).map(v => `<td class="${k === 'short' && v > 0 ? 'bad' : ''}">${fmt(v)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
      return `<header class="vh"><div><h2>S&amp;OP · sales and operations plan</h2><p>Twelve weeks of demand by model against six main lines. Sales brings the forecast, Planning and SCM the supply, Finance the money, and the plant leader approves one plan. The approved plan becomes the master schedule in SAP PP and drives MRP.</p></div></header>
        <section class="vs2"><ol class="steps">${steps}</ol>${S.step < 3 ? `<button type="button" class="btn btn-secondary btn-sm" data-act="erp:step">Complete step ${S.step + 1}</button>` : S.step === 3 ? '<p class="quiet">Executive meeting: approve one of the three plans below.</p>' : `<p class="quiet">Approved at ${clock(S.approvedAt)}: <b>${esc(S.scenarios.find(s => s.id === S.approved).name)}</b>. Master schedule released to SAP PP; MRP ran.</p>`}</section>
        <section class="vs2"><div class="scns">${S.scenarios.map(card).join('')}</div></section>
        <section class="vs2"><div class="segrow"><h3>${esc(S.scenarios.find(s => s.id === state.sopScen).name)} plan</h3><div class="seg" role="group" aria-label="Model">${[['all', 'All models'], ...Object.values(MODELS).map(m => [m.id, m.name])].map(([id, t]) => `<button type="button" data-sopm="${id}" aria-pressed="${state.sopModel === id}">${esc(t)}</button>`).join('')}</div></div>
          <p class="legend2"><span><i class="c-prod"></i>Production</span><span><i class="c-dem"></i>Demand</span><span><i class="c-cap"></i>Capacity without overtime</span></p>${chart}
          <p class="legend2"><span><i class="c-inv"></i>Finished-goods stock</span><span><i class="c-short"></i>Lost sales</span></p>${invChart}${tbl}</section>`;
    }

    /* ---------------- MRP ---------------- */
    function mrp() {
      const R = X.mrp, rows = Object.values(R.rows);
      const sel = R.rows[state.mrpCode] || rows[0];
      const exc = R.exc;
      const excFor = c => exc.filter(e => e.code === c);
      const list = ['import', 'local'].map(src => `<div class="ml"><h4>${src === 'import' ? 'Imported' : 'Local vendors'}</h4>${rows.filter(r => r.src === src).map(r => { const e = excFor(r.code); const lv = e.some(x => x.level === 'crit') ? 'bad' : e.length ? 'info' : ''; return `<button type="button" class="mi ${r.code === sel.code ? 'on' : ''}" data-mrp="${esc(r.code)}" aria-pressed="${r.code === sel.code}"><span>${esc(r.code)}</span>${e.length ? `<i class="${lv}">${e.length}</i>` : ''}</button>`; }).join('')}</div>`).join('');
      const W = R.weeks;
      const rowsT = [['Gross requirements', sel.gross], ['Scheduled receipts (open POs)', sel.sched], ['Planned order receipts', sel.planned], ['Projected available', sel.proj], ['Planned order releases', sel.release]];
      const table = `<table class="tbl wk md"><thead><tr><th>${esc(sel.unit === 'kg' ? 'kg' : 'pieces')}</th><th>Now</th>${W.map(w => `<th>${w}</th>`).join('')}</tr></thead><tbody>${rowsT.map(([t, v], i) => `<tr><td>${t}</td><td>${i === 3 ? fmt(sel.onHand) : ''}</td>${v.map(x => `<td class="${i === 3 ? (x < 0 ? 'bad' : x < sel.ss ? 'warn' : '') : ''}">${x ? fmt(x) : '·'}</td>`).join('')}</tr>`).join('')}<tr class="ss"><td>Safety stock</td><td></td>${W.map(() => `<td>${fmt(sel.ss)}</td>`).join('')}</tr></tbody></table>`;
      const chart = lineChart([{ name: 'Gross requirements', v: sel.gross, cls: 'c-dem', bars: true }, { name: 'Projected available', v: sel.proj.map(v => Math.max(0, v)), cls: 'c-prod' }, { name: 'Safety stock', v: W.map(() => sel.ss), cls: 'c-cap', dash: true }], { labels: W, h: 170, label: 'Requirements and projected stock' });
      const mps = `<table class="tbl wk"><thead><tr><th>Model</th>${W.map(w => `<th>${w}</th>`).join('')}</tr></thead><tbody>${Object.values(MODELS).map(m => `<tr><td>${esc(m.name)}</td>${X.mps[m.id].map(v => `<td>${fmt(v)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
      const excList = exc.length ? `<ul class="li exc">${exc.map(e => `<li class="${e.level}"><span><abbr class="md04" title="MD04 exception ${esc(e.md04)}: ${esc(e.md04t)}">${esc(e.md04 || '')}</abbr><b>${esc(e.kind)}</b> · ${esc(e.text)}</span><div>${e.act ? `<button type="button" class="btn btn-sm ${e.level === 'crit' ? 'btn-primary' : 'btn-secondary'}" data-act="${esc(e.act.id)}">${esc(e.act.label)}</button>` : ''}<button type="button" class="btn btn-sm btn-ghost" data-mrp="${esc(e.code)}">Open</button></div></li>`).join('')}</ul>` : '<p class="quiet">No exception messages.</p>';
      return `<header class="vh"><div><h2>MRP · material requirements</h2><p>The master schedule from the approved S&amp;OP plan, exploded through every bill of materials (TV → panel module → open cell and backlight; main board → bare PCB; back cover → resin; chassis → steel coil, paint and brackets; cushion → EPS), netted against stock and open purchase orders and offset by each vendor's lead time. Last run ${clock(R.t)}.</p></div><button type="button" class="btn btn-secondary btn-sm" data-act="erp:mrp">${icon('refresh')}Run MRP now</button></header>
        <section class="vs2"><h3>Master production schedule <span>TVs a week, from S&amp;OP (${esc(X.sop.scenarios.find(s => s.id === X.sop.approved).name)})</span></h3>${mps}</section>
        <section class="vs2 mrpgrid"><nav class="mlist" aria-label="Materials">${list}</nav>
          <div><div class="mh"><h3>${esc(sel.code)} · ${esc(sel.name)}</h3>${sel.held ? `<span class="st bad"><i></i>${esc(sel.held.reason)}</span>` : ''}</div>
          <dl class="kv kv4"><div><dt>Vendor</dt><dd>${esc(sel.vendor)}</dd></div><div><dt>Lead time</dt><dd>${sel.lt} days</dd></div><div><dt>Lot size</dt><dd>${fmt(sel.lot)} ${esc(sel.unit)}</dd></div><div><dt>On hand</dt><dd>${fmt(sel.plant)} in the plant · ${fmt(sel.wh)} in the warehouses</dd></div><div><dt>Used by</dt><dd>${sel.pegs.map(m => esc(MODELS[m].name)).join(', ')}</dd></div><div><dt>Plant stock</dt><dd>${link('buf:' + (E.MAT[sel.code].store) + ':' + sel.code, 'Show in the plant')}</dd></div></dl>
          ${table}${chart}${excFor(sel.code).map(e => e.act ? `<button type="button" class="btn btn-primary btn-sm" data-act="${esc(e.act.id)}">${esc(e.act.label)}</button>` : '').join(' ')}</div></section>
        <section class="vs2"><h3>Exception messages <span>${exc.length}</span></h3>${excList}</section>`;
    }

    /* ---------------- departments ---------------- */
    /* QM: an individuals control chart with limits from the signal's own normal behaviour */
    function spcChart(arr, title, unit, ref, key) {
      const a = (arr || []).filter(v => v > 0).slice(-150); if (a.length < 30) return '';
      const lim = (H.AG && H.AG.limits(key, a)) || (() => { const m = a.reduce((p, v) => p + v, 0) / a.length; return { mu: m, sd: Math.sqrt(a.reduce((p, v) => p + (v - m) ** 2, 0) / a.length) || 1e-6 }; })();
      const { mu, sd } = lim, ucl = mu + 3 * sd, lcl = mu - 3 * sd;
      const w = 520, h = 150, pl = 48, pr = 8, pt = 10, pb = 18;
      const lo = Math.min(lcl - sd, ...a), hi = Math.max(ucl + sd, ...a);
      const X2 = i => pl + i * (w - pl - pr) / (a.length - 1), Y = v => pt + (h - pt - pb) * (1 - (v - lo) / (hi - lo));
      const run = []; let side = 0, n = 0; a.forEach((v, i) => { const sg = Math.sign(v - mu); n = sg === side ? n + 1 : 1; side = sg; run.push(n); });
      const out = a.map((v, i) => (v > ucl || v < lcl || run[i] >= 9) ? `<circle cx="${X2(i).toFixed(1)}" cy="${Y(v).toFixed(1)}" r="3" class="oc"/>` : '').join('');
      const hl = (v, c, t) => `<line x1="${pl}" x2="${w - pr}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}" class="${c}"/><text x="${pl - 4}" y="${(Y(v) + 4).toFixed(1)}" class="ax" text-anchor="end">${t}</text>`;
      void unit;
      const nOut = a.filter(v => v > ucl || v < lcl).length;
      return `<div class="spcw"><h4>${link(ref, title)} <span>${nOut ? `${nOut} point${nOut > 1 ? 's' : ''} outside the limits` : run[run.length - 1] >= 9 ? 'Nelson rule 2: a run on one side' : 'in control'}</span></h4>
        <svg class="chart spc" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(title)} control chart: mean ${mu.toFixed(1)} ${unit}, limits ${lcl.toFixed(1)} to ${ucl.toFixed(1)}">${hl(ucl, 'cl', 'UCL')}${hl(mu, 'mu', mu.toFixed(0))}${hl(lcl, 'cl', 'LCL')}<path d="${a.map((v, i) => `${i ? 'L' : 'M'}${X2(i).toFixed(1)} ${Y(v).toFixed(1)}`).join('')}" class="sp"/>${out}</svg></div>`;
    }
    function quality() {
      const ov = P.byId[(P.scen.coating && P.scen.coating.line || 'PR4') + '-Coating'], im = P.byId.IM10;
      const ncr = X.ncr.slice(0, 8).map(n => `<tr><td><b>${esc(n.id)}</b><small>${clock(n.opened)}</small></td><td>${esc(n.code)}<small>${fmt(n.count)} found${n.line && line(n.line) ? ' · ' + esc(line(n.line).name) : ''}</small></td>
        <td><span class="d8" role="img" aria-label="${esc(X.D8[n.step])}">${X.D8.map((d, i) => `<i class="${i <= n.step ? 'on' : ''}" title="${esc(d)}"></i>`).join('')}</span><small>${esc(X.D8[n.step])}</small></td><td>${esc(n.cause)}<small>${esc(n.action)}</small></td></tr>`).join('');
      const pr = Object.entries(X.pareto || {}).map(([k, n]) => { const [code, st] = k.split('|'); return { code, st: P.byId[st], n }; }).sort((a, b) => b.n - a.n).slice(0, 7);
      const tot = pr.reduce((a, r) => a + r.n, 0); let cum = 0;
      const pareto = pr.length ? `<h4>Defects by code and station <span class="quiet">Pareto since the model started</span></h4><ol class="pareto">${pr.map(r => { cum += r.n; return `<li><span>${esc(r.code)}<small>${r.st ? link('st:' + r.st.id, `${r.st.name}, ${line(r.st.line) ? line(r.st.line).name : ''}`) : ''}</small></span><i style="--w:${(r.n / pr[0].n * 100).toFixed(1)}%"></i><b>${fmt(r.n)}</b><em>${pct(cum / tot, 0)}</em></li>`; }).join('')}</ol>` : '';
      return `<section class="vs2"><h3>Quality · SAP QM <span>statistical process control, a Pareto of defects, and nonconformance reports worked through the 8D steps</span></h3>${pareto}
        <div class="two">${spcChart(im.hist.press, `${im.name} injection pressure`, 'bar', 'st:' + im.id, 'IM10:press')}${spcChart(ov.hist.temp, `${line(ov.line).name} coating-oven temperature`, '°C', 'st:' + ov.id, ov.id + ':temp')}</div>
        ${ncr ? `<div class="tblwrap"><table class="tbl ncr"><thead><tr><th>NCR</th><th>Defect</th><th>8D progress</th><th>Root cause and action</th></tr></thead><tbody>${ncr}</tbody></table></div>` : '<p class="quiet">No nonconformance open. An NCR opens when final QA or the function test sees the same defect three times in 30 minutes, or a drill starts one.</p>'}</section>`;
    }
    function maintenance() {
      const done = P.wo.filter(w => w.type === 'Breakdown' && w.status === 'Completed' && w.closed);
      const mttr = done.length ? done.reduce((a, w) => a + (w.closed - w.opened), 0) / done.length : 0;
      const brk = P.wo.filter(w => w.type === 'Breakdown').length, el = Math.max(1, (P.t - P.c0) / 3600);
      const mtbf = brk ? P.stations.length * el / brk : 0;
      const rows = P.wo.slice(0, 12).map(w => { const st = P.byId[w.st]; return `<tr><td><b>${esc(w.id)}</b><small>P${w.prio}</small></td><td>${st ? link('st:' + st.id, st.name) : esc(w.st)}<small>${st && line(st.line) ? esc(line(st.line).name) : ''}</small></td><td>${esc(w.type)}<small>${esc(w.why || '')}</small></td>
        <td class="${w.status === 'Open' ? 'bad' : w.status === 'In progress' ? 'warn' : ''}">${esc(w.status)}<small>${w.status === 'Scheduled' ? 'at ' + clock(w.due) : w.status === 'Completed' ? `${Math.round((w.closed - w.opened) / 60)} min` : w.tech ? esc(w.tech) : 'waiting for a technician'}</small></td></tr>`; }).join('');
      return `<section class="vs2"><h3>Maintenance · SAP PM <span>work orders from breakdowns, predictive repairs and the preventive plan</span></h3>
        <div class="astats"><div><b>${fmt(P.wo.filter(w => w.status === 'Open' || w.status === 'In progress').length)}</b><span>work orders open</span></div><div><b>${mttr ? Math.round(mttr / 60) + ' min' : '—'}</b><span>mean time to repair</span></div><div><b>${mtbf ? Math.round(mtbf) + ' h' : '—'}</b><span>mean time between failures, per machine</span></div><div><b>${P.techs.filter(t => t.state === 'available').length} of ${P.techs.length}</b><span>technicians free</span></div></div>
        <div class="tblwrap"><table class="tbl"><thead><tr><th>Work order</th><th>Machine</th><th>Type</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table></div></section>`;
    }
    const ILUO = ['', 'I', 'L', 'U', 'O'], ILUOT = ['', 'In training', 'Works with help', 'Certified', 'Can train others'];
    function skills() {
      const L = line(state.skLine), m = X.skills(state.skLine);
      const rows = m.map(r => `<tr><td>${link('st:' + r.st.id, r.st.name)}<small>${r.crew.filter(c => c.present).length} of ${r.st.staff} present</small></td><td><div class="crewc">${r.crew.map(c => `<span class="op ${c.present ? '' : 'away'}" title="${esc(c.p.name)} · ${ILUOT[c.level]}${c.exp < 0 ? ' · certificate expired' : ` · certificate valid ${c.exp} more days`}${c.present ? '' : ' · absent'}${c.cover ? ' · covering: ' + esc(c.cover) : ''}"><b class="lv l${c.level}">${ILUO[c.level]}</b>${esc(c.p.name.split(' ')[0])}${c.exp < 0 ? '<i class="bad">expired</i>' : c.exp < 30 ? `<i class="warn">${c.exp} d</i>` : ''}</span>`).join('')}</div></td></tr>`).join('');
      return `<section class="vs2"><h3>HR · skills matrix <span>who is certified for which station (ILUO), and when the certificate runs out</span></h3>
        <div class="seg sm" role="group" aria-label="Line">${kind('main').map(x => `<button type="button" data-sk="${x.id}" aria-pressed="${state.skLine === x.id}">${esc(x.name)}</button>`).join('')}</div>
        <div class="tblwrap"><table class="tbl skills"><thead><tr><th>Station on ${esc(L.name)}</th><th>Operators</th></tr></thead><tbody>${rows}</tbody></table></div>
        <p class="legend2"><span><b class="lv l1">I</b> in training</span><span><b class="lv l2">L</b> works with help</span><span><b class="lv l3">U</b> certified</span><span><b class="lv l4">O</b> can train others</span></p></section>`;
    }
    function depts() {
      const k = P.kpi, f = X.finance();
      const open = P.orders.filter(o => o.state === 'open' || o.state === 'loading');
      const chainA = [['d:sales', 'Sales', `${open.length} open orders`], ['sop', 'S&OP and MPS', X.sop.scenarios.find(s => s.id === X.sop.approved).name + ' plan'], ['mode:mrp', 'MRP', `${X.mrp.exc.length} exceptions`], ['d:scm', 'Purchasing', `${X.po.filter(p => p.status === 'In transit').length} deliveries on the way`], ['zone:imp', 'Stores', `lowest cover ${pct(Math.min(...Object.values(E.STORE.IMP).concat(Object.values(E.STORE.LOC)).map(b2 => level(b2) / b2.cap)), 0)}`], ['zone:main', 'Production', `${fmt(k.tph)} TVs an hour`], ['d:quality', 'Quality', `FPY ${pct(k.fpy || 0.99)}`], ['zone:fg', 'Shipping', `${P.trucks.length} trucks at the docks`], ['d:finance', 'Finance', `${X.egp(f.revenue)} invoiced today`]];
      const chain = chainA.map(([ref, t, s]) => `<li><button type="button" class="ch" ${ref.startsWith('mode:') ? `data-mode="${ref.slice(5)}"` : `data-ref="${ref.startsWith('d:') ? 'dept:' + ref.slice(2) : ref}"`}><b>${esc(t)}</b><small>${esc(s)}</small></button></li>`).join('');
      const cards = X.DEPTS.map(d => {
        const now = X.deptNow(d.id);
        return `<article class="dc"><header><button type="button" class="lnk ttl" data-ref="dept:${d.id}">${esc(d.name)}</button>${now.recs ? `<b class="badge">${now.recs}</b>` : ''}</header>
          <p class="who">${esc(d.head)} · ${fmt(X.deptStaff(d.id))} people · ${d.systems.map(esc).join(', ')}</p><p class="owns">${esc(d.owns)}</p>
          <dl class="mini">${now.kpis.map(([a, b]) => `<div><dt>${esc(a)}</dt><dd>${esc(b)}</dd></div>`).join('')}</dl></article>`;
      }).join('');
      return `<header class="vh"><div><h2>Departments working as one</h2><p>Order to cash and plan to produce, end to end. Each department works in its own system; SAP and GMES keep them on the same numbers. Select a department to see its people, numbers, decisions and messages.</p></div></header>
        <section class="vs2"><h3>From the customer's order to the invoice</h3><ol class="chainx">${chain}</ol></section>
        <section class="vs2"><div class="dcs">${cards}</div></section>
        ${quality()}${maintenance()}${skills()}`;
    }

    /* ---------------- AI agents: the crew, its decisions, its reasoning ---------------- */
    const AUTON = [['advise', 'Advise'], ['approve', 'Approve'], ['auto', 'Auto']];
    const egpS = v => v >= 1e6 ? `EGP ${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `EGP ${Math.round(v / 1e3)}k` : `EGP ${fmt(v)}`;
    function crew(AG) {
      const open = {}; for (const c of AG.cards.values()) open[c.owner] = (open[c.owner] || 0) + 1;
      return `<div class="crew">${AG.AGENTS.map(a => `<article class="agent">
        <header><h4>${esc(a.name)}</h4><span class="dot ${open[a.id] ? 'on' : ''}" title="${open[a.id] ? 'Working on a decision' : 'Watching'}"></span></header>
        <p>${esc(a.role)}</p>
        <dl><div><dt>Signals</dt><dd>${fmt(a.signals)}</dd></div><div><dt>Open</dt><dd>${open[a.id] || 0}</dd></div><div><dt>Acted</dt><dd>${a.acted}</dd></div></dl>
        <div class="seg auton" role="group" aria-label="${esc(a.name)} autonomy">${AUTON.map(([v, l]) => `<button type="button" data-auto="${a.id}:${v}" data-key="auto-${a.id}-${v}" aria-pressed="${a.autonomy === v}">${l}</button>`).join('')}</div>
      </article>`).join('')}</div>`;
    }
    function optTable(c) {
      const base = c.base;
      const rows = c.options.map((o, i) => {
        const best = o === c.best, dp = o.f.packed - base.f.packed;
        return `<tr class="${best ? 'best' : ''}"><td><b>${esc(o.label)}</b>${best ? '<span class="tag">Recommended</span>' : ''}${o.note ? `<small>${esc(o.note)}</small>` : ''}</td>
          <td>${fmt(o.f.packed)}${o !== base && dp ? `<small class="${dp > 0 ? 'up' : 'dn'}">${dp > 0 ? '+' : ''}${fmt(dp)}</small>` : ''}</td>
          <td class="${o.f.late ? 'bad' : ''}">${o.f.late}${o.f.late ? `<small>${egpS(o.f.revDelayed)} delayed</small>` : ''}</td>
          <td>${o.f.starvedMin ? `${o.f.starvedMin} min` : '—'}</td>
          <td>${o.cost ? egpS(o.cost) : '—'}</td>
          <td>${o.lost ? egpS(o.lost) : '—'}</td>
          <td><button type="button" class="btn btn-sm ${best ? 'btn-primary' : 'btn-secondary'}" data-opt="${esc(c.key)}|${i}" data-key="opt-${esc(c.key)}-${i}">${best ? 'Approve' : 'Choose'}</button></td></tr>`;
      }).join('');
      return `<div class="tblwrap"><table class="tbl opts"><caption class="sr-only">Options simulated by the ${esc(c.agentName)}</caption><thead><tr><th>Option</th><th>TVs packed</th><th>Orders late</th><th>Starved</th><th>Direct cost</th><th>Output lost</th><th><span class="sr-only">Decide</span></th></tr></thead><tbody>${rows}</tbody></table></div>`;
    }
    function agentCard(r, c) {
      const ev = c.evidence.map(e => `<div class="ev"><span>${esc(e.label)}</span><b>${esc(e.value)}</b>${e.series ? spark(e.series, { limit: e.limit, h: 34, cls: r.level === 'crit' ? 'bad' : 'warn' }) : ''}</div>`).join('');
      const talk = c.talk.length ? `<ol class="talk" aria-label="How the agents agreed">${c.talk.map(t => `<li><b>${esc(t.from)}</b><span>${esc(t.text)}</span></li>`).join('')}</ol>` : '';
      return `<article class="ac ${r.level}">
        <p class="rec-who">${esc(c.agentName)} · ${esc(r.time)} · confidence ${Math.round(c.confidence * 100)}%</p>
        <h4>${esc(r.title)}</h4>
        ${ev ? `<div class="evs">${ev}</div>` : ''}
        <div class="ac-r"><div><h5>Why</h5><ul class="why">${c.why.map(w => `<li>${esc(w)}</li>`).join('')}</ul></div>${talk ? `<div><h5>How the agents agreed</h5>${talk}</div>` : ''}</div>
        <h5>Every option, simulated on the next ${c.h / 60} hours of the plant</h5>
        ${optTable(c)}
        ${c.autoAt && !c.veto && !c.decided ? `<p class="ac-auto">${icon('clock')}<span>Low risk and reversible: the ${esc(c.agentName)} goes ahead at <b>${clockOf(c.autoAt)}</b> unless someone vetoes it.</span><button type="button" class="btn btn-sm btn-secondary" data-veto="${esc(c.key)}" data-key="veto-${esc(c.key)}">Veto</button></p>` : ''}
        <dl class="ac-trace"><div><dt>Trigger</dt><dd>${esc(c.trigger)}</dd></div><div><dt>Approver</dt><dd>${c.decided ? esc(c.decided.by) : H.AG.AGENTS.find(a => a.id === c.owner).autonomy === 'auto' ? 'The agent (Auto), reversible actions only' : c.veto ? 'A person (vetoed auto-approval)' : 'A person (Approve)'}</dd></div><div><dt>Audit ID</dt><dd>${c.decided ? esc(c.decided.audit) : 'given when decided'}</dd></div></dl>
        <div class="rec-act">${(r.actions || []).filter(a => a.id.startsWith('focus')).map(a => `<button type="button" class="btn btn-sm btn-secondary" data-ref="${esc(refFromFocus(a.id.slice(6)))}" data-key="${esc(a.id)}">${esc(a.label)}</button>`).join('')}
          <button type="button" class="btn btn-sm btn-ghost" data-dismiss="${esc(r.key)}" data-key="x-${esc(r.key)}">Dismiss</button></div>
      </article>`;
    }
    function decisions() {
      const AG = H.AG;
      const log = P.audit.slice(0, 16).map(a => `<tr><td>${esc(a.time)}</td><td>${esc(a.who)}</td><td><b>${esc(a.action)}</b><small>${esc(a.detail)}</small></td></tr>`).join('');
      if (!AG) return `<header class="vh"><div><h2>Decisions</h2></div></header>${recCards(P.recs, X)}`;
      const cards = P.recs.map(r => { const c = AG.cards.get(r.key) || AG.card(r); return agentCard(r, c); }).join('');
      const b = AG.base || { packed: 0, late: 0, curve: [] };
      const plan = Object.values(P.lines).filter(L => L.kind === 'main').reduce((a, L) => a + 3600 / MODELS[L.model].takt * 0.85, 0) / 6;
      const chart = b.curve.length ? lineChart([{ name: 'Forecast, TVs packed', v: b.curve, cls: 'c-prod' }, { name: 'Plan at 85% OEE', v: b.curve.map((_, i) => Math.round(plan * (i + 1))), cls: 'c-cap', dash: true }], { labels: b.curve.map((_, i) => `+${(i + 1) * 10}`), h: 170, label: 'Forecast of TVs packed over the next two hours, against plan' }) : '';
      const feed = AG.feed.slice(0, 14).map(f => `<li class="${f.level}"><time>${esc(f.time)}</time><b>${esc(f.agent)}</b><span>${esc(f.text)}</span>${f.ref ? link(refFromFocus(f.ref), 'Show') : ''}</li>`).join('');
      const st = AG.stats;
      return `<header class="vh"><div><h2>AI agents</h2><p>Nine agents watch every machine, store, vehicle, order, kilowatt and camera. Before they recommend anything they simulate each option on a flow model of the whole plant for the next two hours (eight for material decisions), then the owner of the decision agrees it with the others. They act alone only on Auto and only when the action can be undone.</p></div></header>
        <div class="astats"><div><b>${fmt(st.decisions)}</b><span>decisions prepared</span></div><div><b>${fmt(st.simulated)}</b><span>plant simulations run</span></div><div><b>${fmt(st.auto)}</b><span>acted on Auto</span></div><div><b>${X.egp(P.saved)}</b><span>output protected</span></div></div>
        <section class="vs2"><h3>The crew <span>autonomy per agent: Advise informs; Approve asks a person, except low-risk reversible steps that go ahead after two minutes unless vetoed; Auto acts on reversible decisions</span></h3>${crew(AG)}</section>
        <section class="vs2"><h3>Open decisions <span>${P.recs.length}</span></h3>${cards || '<p class="quiet">Nothing waiting. Start a drill from the 3D factory and watch the agents work.</p>'}</section>
        <section class="vs2 two"><div><h3>Next two hours <span>${fmt(b.packed)} TVs, ${b.late ? `${b.late} order${b.late > 1 ? 's' : ''} at risk` : 'no order at risk'}</span></h3>${chart}</div>
          <div class="askwrap"></div></section>
        <section class="vs2"><h3>Recently decided <span>each with its audit ID, who approved it, and what the simulation promised</span></h3>${AG.decided.length ? `<div class="tblwrap"><table class="tbl"><thead><tr><th>Audit ID</th><th>Decision</th><th>Approver</th><th>Forecast</th></tr></thead><tbody>${AG.decided.slice(0, 8).map(d => `<tr><td><b>${esc(d.audit)}</b><small>${esc(d.time)}</small></td><td>${esc(d.label)}<small>${esc(d.title)}</small></td><td>${esc(d.by)}<small>${d.recommended ? 'followed the recommendation' : 'overrode the recommendation'}</small></td><td>${fmt(d.packed)} TVs in ${d.h / 60} h<small>${d.late} order${d.late === 1 ? '' : 's'} late</small></td></tr>`).join('')}</tbody></table></div>` : '<p class="quiet">Nothing decided yet.</p>'}</section>
        <section class="vs2"><h3>Safety and vision <span>stills from the camera feeds when the AI sees a hazard</span></h3>${AG.incidents.length ? `<div class="incs">${AG.incidents.slice(0, 6).map(i => `<figure class="inc">${i.img ? `<img src="${i.img}" alt="${esc(i.cam)} at ${esc(i.time)}: ${esc(i.text)}" width="240" height="135">` : '<div class="noimg">No still</div>'}<figcaption><b>${esc(i.id)} · ${esc(i.time)}</b><span>${esc(i.cam)}: ${esc(i.text)}</span></figcaption></figure>`).join('')}</div>` : '<p class="quiet">No hazard seen. Turn on Cameras in the 3D factory: the AI watches the four feeds for forklift near misses and missing safety glasses.</p>'}</section>
        <section class="vs2 two"><div><h3>Reasoning feed</h3>${feed ? `<ol class="afeed">${feed}</ol>` : '<p class="quiet">Quiet. The agents are watching.</p>'}</div>
          <div><h3>Decision log</h3>${log ? `<table class="tbl"><thead><tr><th>Time</th><th>Who</th><th>Decision</th></tr></thead><tbody>${log}</tbody></table>` : '<p class="quiet">No decision taken yet.</p>'}</div></section>`;
    }
    // the ask box lives outside the redrawn markup so typing is never lost
    const ask = document.createElement('div');
    ask.className = 'askwrap ask';
    ask.innerHTML = `<h3>Ask the crew</h3><form class="askf"><label class="sr-only" for="askq">Question for the agents</label><input id="askq" class="input" type="text" autocomplete="off" placeholder="Why is line 3 slow?"><button type="submit" class="btn btn-primary btn-sm">Ask</button></form>
      <div class="askchips">${['Shift summary', 'Orders at risk', 'Why is line 3 slow?', 'Material shortages', 'Energy peak'].map(q => `<button type="button" class="chipq" data-q="${q}">${q}</button>`).join('')}</div><div class="askout" aria-live="polite"></div>`;
    function refName(r) {
      const [k, id] = r.split(/:(.+)/);
      if (k === 'st' && P.byId[id]) { const s = P.byId[id]; return `${s.name}, ${line(s.line) ? line(s.line).name : s.line}`; }
      if (k === 'line' && line(id)) return line(id).name;
      if (k === 'buf' && P.bufs[id]) return `${P.bufs[id].code} at ${P.byId[P.bufs[id].station] ? P.byId[P.bufs[id].station].name : P.bufs[id].label}`;
      if (k === 'order') return 'Order ' + id;
      return id;
    }
    function answer(q) {
      if (!H.AG || !q.trim()) return;
      const a = H.AG.ask(q);
      ask.querySelector('.askout').innerHTML = `<p class="askq">${esc(q)}</p><p>${esc(a.text)}</p>${a.refs.length ? `<p class="askrefs">${a.refs.slice(0, 6).map(r => link(r, refName(r))).join('')}</p>` : ''}`;
    }
    ask.querySelector('form').addEventListener('submit', e => { e.preventDefault(); answer(ask.querySelector('input').value); });
    ask.addEventListener('click', e => { const b = e.target.closest('[data-q]'); if (b) { ask.querySelector('input').value = b.dataset.q; answer(b.dataset.q); } });

    /* ---------------- dispatch ---------------- */
    let last = '';
    function render(force) {
      const m = state.mode; if (!m || m === '3d') return;
      if (!force && ask.contains(document.activeElement)) return;   // hold the page still while someone types a question
      if (m === 'sap' && !state.sapSvg) state.sapSvg = sapDiagram();
      const html = m === 'gmes' ? gmes() : m === 'sap' ? sap() : m === 'sop' ? sop() : m === 'mrp' ? mrp() : m === 'depts' ? depts() : decisions();
      if (m === 'sap') {
        // keep the diagram node (its packets animate every frame); replace the rest
        if (!root.querySelector('svg.flow') || force) { root.innerHTML = html; last = ''; }
        else { const keep = root.querySelector('.flowwrap'); const tmp = document.createElement('div'); tmp.innerHTML = html; tmp.querySelector('.flowwrap').replaceWith(keep); root.replaceChildren(...tmp.childNodes); }
        sapCounts(); last = root.innerHTML;
      } else if (html !== last || force) {
        const focusKey = document.activeElement && root.contains(document.activeElement) ? (document.activeElement.dataset.key || document.activeElement.dataset.ref || document.activeElement.dataset.act || document.activeElement.dataset.mrp || document.activeElement.dataset.scen) : null;
        root.innerHTML = html; last = html;
        const slot = root.querySelector('.askwrap'); if (slot) slot.replaceWith(ask);
        if (focusKey) { const el = [...root.querySelectorAll('button')].find(b => [b.dataset.key, b.dataset.ref, b.dataset.act, b.dataset.mrp, b.dataset.scen].includes(focusKey)); if (el) el.focus(); }
      }
      if (window.Theme) Theme.icons(root);
    }
    root.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.scen) { state.sopScen = b.dataset.scen; render(true); return; }
      if (b.dataset.sopm) { state.sopModel = b.dataset.sopm; render(true); return; }
      if (b.dataset.loss) { state.lossLine = b.dataset.loss; render(true); return; }
      if (b.dataset.draft) { state.draft = b.dataset.draft; render(true); return; }
      if (b.dataset.publish && H.AG) { ui.publish(b.dataset.publish); state.draft = 'live'; return; }
      if (b.dataset.veto && H.AG) { H.AG.veto(b.dataset.veto); render(true); return; }
      if (b.dataset.sk) { state.skLine = b.dataset.sk; render(true); return; }
      if (b.dataset.auto && H.AG) { const [id, v] = b.dataset.auto.split(':'); H.AG.setAutonomy(id, v); render(true); return; }
      if (b.dataset.opt && H.AG) { const [key, i] = b.dataset.opt.split('|'); const c = H.AG.cards.get(key); if (c) ui.choose(c, c.options[+i]); return; }
      if (b.dataset.mrp) { state.mrpCode = b.dataset.mrp; render(true); ui.select('mrp:' + b.dataset.mrp, { fly: false }); return; }
    });
    return {
      state, H,
      setMode(m) { state.mode = m; last = ''; if (m !== 'sap') pk.length = 0; render(true); },
      render, tick(dt) { if (state.mode === 'sap') tickSap(dt); },
      showMrp(code) { state.mrpCode = code; }
    };
  }

  window.PlantViews = { create: createViews, H, lineChart };
})();
