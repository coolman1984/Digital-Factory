/* Digital Factory — the production copilot of the command room (window.Copilot), on Plant EG-01.
   Two modes on the same plant, forecast and commands the agents use:
   - Local: answers from the live plant in this browser with the agents' own reader; no key, nothing leaves the browser.
   - Claude: the viewer's own Anthropic API key, the official TypeScript SDK (vendored, loaded on demand), the tool runner
     with streaming, adaptive thinking with summaries shown, and server-side fallbacks. Every change to the plant goes
     through propose_action or decide, which waits for a person to press Approve in the chat.
   The key stays in this browser (session storage unless "remember" is ticked) and requests go straight to the API.
   All plant data is simulated. */
(function () {
  'use strict';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const icon = n => (typeof Icons !== 'undefined' ? Icons.get(n) : '');
  const fmt = n => (isFinite(n) ? Math.round(n).toLocaleString('en-US') : '—');
  const pct = (v, d = 1) => (v * 100).toFixed(d) + '%';
  const MODEL = 'claude-opus-5-5';
  const KEY = 'df-claude-key';
  const SDK = 'assets/vendor/anthropic/anthropic.iife.min.js';
  const E = () => DF.E, P = () => DF.P, AG = () => DF.AG;

  /* ---------------- the drawer ---------------- */
  const shade = document.createElement('div'); shade.className = 'cp-shade'; shade.hidden = true;
  const root = document.createElement('aside');
  root.className = 'cp'; root.id = 'copilot'; root.setAttribute('aria-labelledby', 'cpTitle'); root.setAttribute('role', 'dialog'); root.inert = true;
  root.innerHTML = `
    <div class="cp-head"><span class="logo-mark" aria-hidden="true"></span><div><h2 id="cpTitle">Production copilot</h2><p>Reads Plant EG-01 with the agents' tools</p></div>
      <button type="button" class="btn-icon cp-x" aria-label="Close copilot">${icon('x')}</button></div>
    <div class="cp-mode" id="cpMode"></div>
    <form class="cp-key" id="cpKey" hidden autocomplete="off">
      <label for="cpKeyIn"><b>Your Anthropic API key</b></label>
      <div class="row"><input id="cpKeyIn" type="password" placeholder="sk-ant-…" spellcheck="false" required><button class="btn btn-primary btn-sm" type="submit">Connect</button></div>
      <label class="check-inline"><input type="checkbox" id="cpRemember"> Remember on this device</label>
      <span>The key stays in this browser and requests go straight to the Anthropic API; usage is billed to your account. Fallbacks are on: if the model declines a request, the API retries it on its recommended fallback model.</span>
    </form>
    <div class="cp-log" id="cpLog" role="log" aria-live="polite" aria-relevant="additions"></div>
    <div class="cp-sugg" id="cpSugg"></div>
    <form class="cp-form" id="cpForm"><label for="cpIn" class="sr-only">Ask the copilot</label>
      <textarea id="cpIn" rows="1" placeholder="Ask about any line, machine, alarm, order or forecast…"></textarea>
      <button class="btn btn-primary" type="submit" id="cpSend" aria-label="Send">${icon('arrowRight')}</button></form>`;
  document.body.append(shade, root);
  const $ = s => root.querySelector(s);
  const log = $('#cpLog'), input = $('#cpIn'), sugg = $('#cpSugg');
  let opener = null;
  function open(prefill) {
    opener = document.activeElement;
    shade.hidden = false; root.inert = false;
    requestAnimationFrame(() => { shade.classList.add('open'); root.classList.add('open'); });
    if (!log.children.length) hello();
    if (prefill) { input.value = prefill; send(); } else setTimeout(() => input.focus(), 50);
  }
  function close() {
    if (root.inert) return;
    shade.classList.remove('open'); root.classList.remove('open'); root.inert = true;
    setTimeout(() => { shade.hidden = true; }, 320);
    if (opener && opener.focus) opener.focus();
  }
  $('.cp-x').onclick = close; shade.onclick = close;
  root.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); close(); } });
  input.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } });
  input.addEventListener('input', () => { input.style.height = 'auto'; input.style.height = Math.min(140, input.scrollHeight) + 'px'; });
  $('#cpForm').addEventListener('submit', e => { e.preventDefault(); send(); });

  /* ---------------- messages ---------------- */
  function msg(who, html) {
    const d = document.createElement('div');
    d.className = 'cp-msg ' + who; d.innerHTML = html;
    log.append(d); log.scrollTop = log.scrollHeight;
    if (typeof Theme !== 'undefined') Theme.icons(d);
    return d;
  }
  const inline = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/`([^`]+)`/g, '<code>$1</code>');
  const para = s => s.split(/\n{2,}/).map(p => /^\s*[-•]/.test(p) ? `<ul>${p.split(/\n/).map(l => `<li>${inline(l.replace(/^\s*[-•]\s*/, ''))}</li>`).join('')}</ul>` : `<p>${inline(p).replace(/\n/g, '<br>')}</p>`).join('');
  function hello() {
    msg('ai', `<p>I read the same live plant the agents work on: the six main lines and every line feeding them, machines, stores, AGVs, milk runs, orders, energy, alarms and the agents' decisions. I can also run any option on the two-hour forecast before you decide.</p><p class="muted small">${claude() ? 'Claude mode: your key, your account.' : 'Local mode: answers from the plant in this browser. Switch to Claude for open questions.'}</p>`);
    suggestions();
  }
  function suggestions() {
    const w = DF.waiting ? DF.waiting() : [];
    const s = ['Will we hit the plan today?', w.length ? 'Should I approve the first decision?' : 'Which machine is most at risk?', 'Why is line 2 slow?', 'Which orders are at risk?', 'What if main line 6 runs at 108%?', 'How is energy against the contract?'];
    sugg.innerHTML = s.map(x => `<button type="button">${esc(x)}</button>`).join('');
  }
  sugg.addEventListener('click', e => { const b = e.target.closest('button'); if (b) { input.value = b.textContent; send(); } });

  /* ---------------- modes ---------------- */
  let mem = null;
  const store = { get() { try { return sessionStorage.getItem(KEY) || localStorage.getItem(KEY); } catch (e) { return null; } },
    set(k, remember) { try { sessionStorage.setItem(KEY, k); if (remember) localStorage.setItem(KEY, k); else localStorage.removeItem(KEY); } catch (e) { /* storage blocked: the key lives in memory only */ } mem = k; },
    clear() { try { sessionStorage.removeItem(KEY); localStorage.removeItem(KEY); } catch (e) { /* ignore */ } mem = null; } };
  const claude = () => !!(mem || store.get());
  function modeBar() {
    $('#cpMode').innerHTML = claude()
      ? `Mode <b>Claude</b> · ${esc(MODEL)} · tools on the live plant <button type="button" class="lnk" data-cp="local">Use local mode</button>`
      : `Mode <b>Local</b> · answers from the plant, no key <button type="button" class="lnk" data-cp="key">Use Claude with my key</button>`;
  }
  modeBar();
  root.addEventListener('click', e => {
    const b = e.target.closest('[data-cp]'); if (!b) return;
    if (b.dataset.cp === 'key') { $('#cpKey').hidden = false; $('#cpKeyIn').focus(); }
    if (b.dataset.cp === 'local') { store.clear(); client = null; history.length = 0; modeBar(); msg('ai', '<p>Back to local mode. Your key was removed from this browser.</p>'); }
  });
  $('#cpKeyIn').addEventListener('input', e => e.target.setCustomValidity(''));
  $('#cpKey').addEventListener('submit', e => {
    e.preventDefault();
    const k = $('#cpKeyIn').value.trim();
    if (!/^sk-ant-/.test(k)) { $('#cpKeyIn').setCustomValidity('An Anthropic key starts with sk-ant-'); $('#cpKeyIn').reportValidity(); return; }
    store.set(k, $('#cpRemember').checked); $('#cpKeyIn').value = ''; $('#cpKey').hidden = true;
    client = null; history.length = 0; modeBar();
    msg('ai', '<p>Claude mode is on. Ask anything about the plant; I read it with tools and ask you before changing anything.</p>');
    input.focus();
  });

  /* ---------------- tools on the plant ---------------- */
  const MAINS = ['ML1', 'ML2', 'ML3', 'ML4', 'ML5', 'ML6'];
  const lineName = id => (P().lines[id] ? P().lines[id].name : id);
  // commands a person may let the copilot run: the same ones as the Control view and the agents
  function action(id) {
    const p = P(), M = E().MODELS;
    let m = /^boost:(ML[1-6])$/.exec(id);
    if (m) return p.lines[m[1]].speed >= 1.08 ? null : { label: `${lineName(m[1])} to 108%`, mods: { rate: [{ id: m[1], k: 1.08 }] }, run: who => E().apply(id, who) };
    m = /^co:(ML[1-6]):(M43|M55|M65|M75)$/.exec(id);
    if (m) return p.lines[m[1]].model === m[2] ? null : { label: `${lineName(m[1])} changeover to ${M[m[2]].name}`, mods: { co: [{ id: m[1], at: 0, dur: 15, model: m[2] }] }, run: who => E().changeover(+m[1].slice(2), m[2], who) };
    if (id === 'shave') return { label: 'Shave the demand peak for 30 minutes (utilities only)', mods: {}, run: who => E().apply('agent:shave', who) };
    m = /^planRepair:(.+)$/.exec(id);
    if (m && p.byId[m[1]] && p.byId[m[1]].degrade > 0) { const s = p.byId[m[1]], L = p.lines[s.line], t = L.kind === 'lcm' ? 'ML' + L.id.slice(3) : L.kind === 'injection' ? s.id : L.id; return { label: `Planned repair of ${s.name} (${L.name}) now`, mods: { noFail: [t], down: [{ id: t, at: 0, dur: 8 }] }, run: who => E().apply(id, who) }; }
    return null;
  }
  const commandIds = () => MAINS.map(l => 'boost:' + l).concat(MAINS.flatMap(l => ['M43', 'M55', 'M65', 'M75'].map(m => `co:${l}:${m}`)), ['shave'], P().stations.filter(s => s.degrade > 0).map(s => 'planRepair:' + s.id));
  function simulate(options, h = 120) {
    const S = AG().snapshot(Math.max(30, Math.min(480, h))), base = AG().forecast({}, S);
    const one = (label, f) => ({ label, packed: f.packed, late_orders: f.late, late_list: f.lateList, revenue_delayed_egp: Math.round(f.revDelayed), minutes_short_of_material: f.starvedMin, margin_egp: Math.round(f.margin) });
    return { horizon_min: S.h, from: E().clock(P().t), options: [one('Live plan (do nothing)', base)].concat(options.map(o => { const mods = { rate: [], co: [], noFail: [], down: [] }; for (const c of o.commands) { const a = action(c); if (a) for (const k in a.mods) mods[k] = (mods[k] || []).concat(a.mods[k]); } return one(o.label, AG().forecast(mods, S)); })) };
  }
  const T = {
    plant_overview() {
      const p = P(), k = p.kpi, M = E().MODELS;
      return { time: E().clockS(p.t), packed: k.units, plan_so_far: k.plan, shift: k.shift || 'A', shift_ends: E().clock(k.shiftEnd || 14 * 3600), forecast_at_shift_end: k.fcst, plan_at_shift_end: k.planEnd, chance_to_hit_plan: +(k.prob || 0).toFixed(2), oee: +(k.oee || 0).toFixed(3), fpy: +(k.fpy || 0).toFixed(4), kw: Math.round(k.kw), tvs_in_process: k.wip, active_alarms: p.alarms.filter(a => !(a.shelvedTo > p.t)).length,
        main_lines: MAINS.map(id => { const L = p.lines[id]; return { id, model: M[L.model].name, state: L.state, per_hour: Math.round(L.tph), oee: +L.oee.toFixed(3), speed: L.speed }; }),
        stopped_machines: p.stations.filter(s => s.state === 'down' || s.state === 'maint').map(s => `${s.id} (${s.why})`),
        decisions_waiting: (DF.waiting ? DF.waiting() : []).map(c => ({ key: c.key, title: c.title, recommended: c.best ? c.best.label : null })) };
    },
    line_status({ line }) {
      const L = P().lines[line]; if (!L) return { error: 'Unknown line ' + line + '. Lines: ML1-6, LCM1-6, SMD1-6, PR1-6, CUS1-6, INJ.' };
      return { id: L.id, name: L.name, kind: L.kind, model: L.model, state: L.state, speed: L.speed, per_hour: Math.round(L.tph), oee: +L.oee.toFixed(3), availability: +L.avail.toFixed(3), performance: +L.perf.toFixed(3), quality: +L.qual.toFixed(4), constraint: L.bn ? L.bn.id : null,
        stations: L.stations.map(s => ({ id: s.id, name: s.name, state: s.state, why: s.why, health: Math.round(s.health) })), line_side: L.ls ? Object.values(L.ls).map(b => ({ id: b.id, code: b.code, level: E().level(b), cap: b.cap, runway_min: isFinite(E().runway(b)) ? Math.round(E().runway(b) / 60) : null })) : [] };
    },
    station({ id }) {
      const s = P().byId[id]; if (!s) return { error: 'Unknown station ' + id + '. Ids look like ML1-Packing, SMD4-MounterB, IM10, PR4-Coating.' };
      const lost = Object.entries(s.rs || {}).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, v]) => ({ reason: k.replace('|', ': '), minutes: +(v / 60).toFixed(1) }));
      return { id: s.id, name: s.name, line: s.line, kind: s.kind, state: s.state, why: s.why, since: E().clock(s.since), health: Math.round(s.health), failure_in_min: s.degrade > 0 ? Math.round((s.health - 22) / s.degrade / 60) : null, repair_planned: !!s.planned, sensors: s.sens, made: s.counters.made, rejected: s.counters.bad, kw: +(s.kwNow || 0).toFixed(1), speed: +(1 / (s.speedMul || 1)).toFixed(2), lockout: !!s.loto, time_lost: lost };
    },
    alarms() { const p = P(); return { active: p.alarms.filter(a => !(a.shelvedTo > p.t)).map(a => ({ prio: a.prio, time: a.time, area: a.area, msg: a.msg, state: a.state, ref: a.ref })), raised_last_10_min: DF.alarmRate ? DF.alarmRate() : null }; },
    decisions() { return (DF.waiting ? DF.waiting() : []).map(c => ({ key: c.key, agent: c.agentName, title: c.title, recommended: c.best ? c.best.label : null, auto_at: c.autoAt && !c.veto ? E().clock(c.autoAt) : null })); },
    decision_detail({ key }) {
      const c = AG().cards.get(key); if (!c) return { error: 'No open decision ' + key + '. Use decisions() to list them.' };
      return { key: c.key, agent: c.agentName, title: c.title, confidence: c.confidence, why: c.why, evidence: c.evidence.map(e => `${e.label}: ${e.value}`), discussion: c.talk.map(t => `${t.from}: ${t.text}`), horizon_min: c.h,
        options: c.options.map((o, i) => ({ index: i, label: o.label, recommended: o === c.best, cost_egp: o.cost, reversible: o.reversible, note: o.note || null, packed: o.f.packed, late_orders: o.f.late, revenue_delayed_egp: Math.round(o.f.revDelayed) })), decided: c.decided || null };
    },
    orders() { const p = P(), late = AG().base ? AG().base.lateList : []; return p.orders.filter(o => o.state === 'open' || o.state === 'loading' || p.t - (o.shippedAt || 0) < 3600).map(o => ({ id: o.id, customer: o.customer, model: E().MODELS[o.model].name, qty: o.qty, due: E().clock(o.due), state: o.state, loaded: o.truck ? o.truck.loaded : null, forecast_short: late.includes(o.id) })); },
    stock({ id }) {
      if (id) { const b = P().bufs[id]; if (!b) return { error: 'Unknown buffer ' + id }; return { id, label: b.label, code: b.code, level: E().level(b), cap: b.cap, runway_min: isFinite(E().runway(b)) ? Math.round(E().runway(b) / 60) : null, lots: (b.lots || []).slice(0, 6) }; }
      return Object.values(E().LS).filter(b => b.feed !== 'conveyor').map(b => ({ id: b.id, code: b.code, at: `${P().byId[b.station].name} · ${lineName(b.line)}`, level: E().level(b), runway_min: isFinite(E().runway(b)) ? Math.round(E().runway(b) / 60) : null, feed: b.feed })).filter(x => x.runway_min != null).sort((a, b) => a.runway_min - b.runway_min).slice(0, 12);
    },
    fleet() { const p = P(); return p.agvs.concat(p.tuggers, p.forklifts).map(v => ({ id: v.id, kind: v.kind, state: v.fault ? 'fault: ' + v.fault : v.path ? 'moving' : 'parked', battery: v.battery != null ? Math.round(v.battery) : null, mission: v.mission && v.mission.buf ? v.mission.buf.code + ' to ' + v.mission.buf.station : null })); },
    genealogy({ serial }) {
      const u = E().findUnit(serial); if (!u) return { error: 'No unit ' + serial };
      return { serial: u.sn, type: u.type, model: u.model, born: E().clock(u.born), defect: u.defect, order: u.order || null, lots: u.lots, parts: Object.fromEntries(Object.entries(u.parts || {}).map(([k, v]) => [k, v && v.sn ? v.sn : v])), steps: u.steps.map(s => ({ at: E().clock(s.t0), station: s.name, ok: s.ok !== false, note: s.note || null })) };
    },
    quality() { const X = DF.X, q = X.quality(); return Object.assign(q, { pareto: X.pareto, ncr: X.ncr.slice(0, 6).map(n => ({ id: n.id, code: n.code, step: X.D8[n.step], cause: n.cause, count: n.count })) }); },
    maintenance() { const p = P(); return { wearing: p.stations.filter(s => s.degrade > 0).map(s => ({ id: s.id, name: s.name, line: s.line, health: Math.round(s.health), failure_in_min: Math.round((s.health - 22) / s.degrade / 60), planned: !!s.planned })), technicians: p.techs.map(t => ({ name: t.name, state: t.state, job: t.job ? t.job.id : null })), work_orders: p.wo.slice(0, 10).map(w => ({ id: w.id, station: w.st, type: w.type, status: w.status, why: w.why })) }; },
    energy() { const p = P(), A = AG().energy; return { kw_now: Math.round(p.kpi.kw), avg_15min: Math.round(A.avg), forecast_peak: Math.round(A.peak), contract_kw: 4000, shaving: !!(p.shave && p.t < p.shave.until), kwh_since_0912: Math.round(p.energy.kwh), utilities: p.util.assets.map(a => ({ name: a.name, kw: Math.round(a.kw) })) }; }
  };

  /* an approval card in the chat: resolves true when a person approves */
  function approval(title, body) {
    return new Promise(res => {
      const d = msg('ai', `<div class="cp-prop"><p><b>${esc(title)}</b></p>${body ? `<p class="muted small">${esc(body)}</p>` : ''}<div class="cs-btns"><button type="button" class="btn btn-primary btn-sm" data-ok>${icon('check')}Approve</button><button type="button" class="btn btn-secondary btn-sm" data-no>Decline</button></div></div>`);
      const done = v => { d.querySelectorAll('button').forEach(b => { b.disabled = true; }); d.querySelector('.cp-prop').insertAdjacentHTML('beforeend', `<p class="small">${v ? 'Approved by you.' : 'Declined.'}</p>`); res(v); };
      d.querySelector('[data-ok]').onclick = () => done(true);
      d.querySelector('[data-no]').onclick = () => done(false);
      d.querySelector('[data-ok]').focus();
    });
  }
  function apply(id, label) { const a = action(id); if (!a) return false; a.run('You (via copilot)'); DF.refresh(true); msg('ai', `<p>Done: ${esc(label || a.label)}. Logged as ${esc(P().audit[0].id)}.</p>`); return true; }
  function decide(key, i) { const c = AG().cards.get(key); if (!c || c.decided) return null; const op = c.options[i]; if (!op) return null; const d = AG().decide(c, op, 'You (via copilot)'); DF.refresh(true); return d; }

  /* ---------------- local mode ---------------- */
  async function local(q) {
    const t = q.toLowerCase(), used = [];
    const tool = (name, args) => { used.push(name + '(' + (args ? Object.values(args).map(v => JSON.stringify(v)).join(', ') : '') + ')'); return T[name](args || {}); };
    const ar = /[؀-ۿ]/.test(q);
    const serial = (q.match(/\b(TV|LM|PB)26\d{7}\b/i) || [])[0];
    const lm = t.match(/(?:main\s*)?line\s*(\d)|ml\s*(\d)/), line = lm ? 'ML' + (lm[1] || lm[2]) : null;
    let out = '';
    if (serial) {
      const g = tool('genealogy', { serial: serial.toUpperCase() });
      out = g.error ? g.error + '.' : `**${g.serial}** (${g.type}${g.model ? ', ' + E().MODELS[g.model].name : ''}) started ${g.born}${g.defect ? `, defect **${g.defect.code}**` : ''}. Its last steps:\n\n` + g.steps.slice(-8).map(s => `- ${s.at} ${s.station}: ${s.ok ? 'pass' : 'FAIL'}${s.note ? ' · ' + s.note : ''}`).join('\n');
    } else if (/what if|simulate|108|faster|boost|changeover|ماذا لو/.test(t)) {
      const L = line && MAINS.includes(line) ? line : 'ML6';
      const cmd = /shave|peak/.test(t) ? 'shave' : 'boost:' + L, a = action(cmd);
      if (!a) out = `${lineName(L)} already runs at 108%.`;
      else {
        used.push(`simulate(${JSON.stringify(a.label)})`);
        const r = simulate([{ label: a.label, commands: [cmd] }]), b = r.options[0], o = r.options[1], d = o.packed - b.packed;
        out = `I ran **${a.label}** against the live plan on the ${r.horizon_min / 60}-hour forecast from ${r.from}.\n\n- TVs packed: **${fmt(o.packed)}** against ${fmt(b.packed)} (${d >= 0 ? '+' : ''}${fmt(d)})\n- Late orders: ${o.late_orders} against ${b.late_orders}\n- Minutes short of material: ${o.minutes_short_of_material} against ${b.minutes_short_of_material}\n\n${d > 10 || o.late_orders < b.late_orders ? 'It pays off. You can apply it here or from Control.' : 'It does not beat the live plan by a clear margin, so I would not do it now.'}`;
        if (d > 10 || o.late_orders < b.late_orders) { render(out, used, ar); out = null; if (await approval(`Apply: ${a.label}?`, 'Runs on the live plant and goes to the audit trail under your name.')) apply(cmd); }
      }
    } else if (/approve|recommend|decision|waiting|should i|قرار|أوافق|اوافق/.test(t)) {
      const w = tool('decisions');
      if (!w.length) out = 'No decision is waiting for you. The agents are watching the plant.';
      else {
        const d = tool('decision_detail', { key: w[0].key }), rec = d.options.find(o => o.recommended);
        out = `**${d.title}** (${d.agent}, ${Math.round(d.confidence * 100)}% sure).\n\n${d.why.slice(0, 2).join(' ')}\n\nOptions simulated over ${d.horizon_min / 60} h:\n` + d.options.map(o => `- ${o.label}: ${fmt(o.packed)} TVs, ${o.late_orders} late, cost ${DF.X.egp(o.cost_egp)}${o.recommended ? ' · **recommended**' : ''}`).join('\n');
        render(out, used, ar); out = null;
        if (rec && await approval(`Decide: ${rec.label}?`, 'Applied by the plant and written to the audit trail under your name.')) { const r = decide(d.key, rec.index); msg('ai', `<p>${r ? `Done. Logged as ${esc(r.audit)}.` : 'That decision closed before you approved it.'}</p>`); }
      }
    } else if (/plan|forecast|hit|on track|الخطة|توقع/.test(t) && !line) {
      const o = tool('plant_overview');
      out = `At ${o.time}, **${fmt(o.packed)}** TVs are packed against a plan of ${fmt(o.plan_so_far)} so far. The forecast reaches **${fmt(o.forecast_at_shift_end)}** by ${o.shift_ends} against ${fmt(o.plan_at_shift_end)}: about a **${Math.round(o.chance_to_hit_plan * 100)}%** chance to hit it.\n\nMain-line OEE ${pct(o.oee)}, first-pass yield ${pct(o.fpy, 2)}. ${o.main_lines.filter(l => l.state !== 'run').map(l => `${lineName(l.id)} is ${DF.STATE[l.state] ? DF.STATE[l.state].toLowerCase() : l.state}`).join('; ') || 'All six main lines are running.'}`;
    } else if (/alarm|flood|إنذار|انذار/.test(t)) {
      const a = tool('alarms'), by = {};
      a.active.forEach(x => { by[x.area] = (by[x.area] || 0) + 1; });
      out = a.active.length ? `${a.active.length} active alarm${a.active.length > 1 ? 's' : ''}, ${a.raised_last_10_min} raised in the last 10 minutes${a.raised_last_10_min > 10 ? ' — **a flood** (ISA-18.2 limit 10)' : ''}.\n\n` + Object.entries(by).sort((x, y) => y[1] - x[1]).map(([k, v]) => `- ${k}: ${v}`).join('\n') + `\n\nMost urgent: **${a.active.slice().sort((x, y) => x.prio - y.prio)[0].msg}**.` : 'No active alarms. The alarm rate is inside the ISA-18.2 target.';
    } else if (/energy|power|kw|peak|demand|طاقة|كهرب/.test(t)) {
      const e = tool('energy');
      out = `Plant power **${fmt(e.kw_now)} kW**; 15-minute average ${fmt(e.avg_15min)} kW, forecast peak **${fmt(e.forecast_peak)} kW** against the 4,000 kW contract${e.shaving ? '. Peak shaving is on' : ''}. Since 09:12: ${fmt(e.kwh_since_0912)} kWh.\n\n` + e.utilities.map(x => `- ${x.name}: ${x.kw} kW`).join('\n');
    } else if (/risk|wear|vibration|maintenance|fail|bearing|صيانة|اهتزاز/.test(t) && !line) {
      const m = tool('maintenance');
      out = m.wearing.length ? m.wearing.map(w => `- **${w.name}** (${lineName(w.line)}): health ${w.health}, fails in about ${w.failure_in_min} min${w.planned ? ' · repair planned' : ''}`).join('\n') : `No machine shows a wear trend right now. ${m.technicians.filter(x => x.state === 'available').length} of ${m.technicians.length} technicians are free.`;
    } else {
      const r = AG().ask(q);
      used.push(`ask(${JSON.stringify(q.slice(0, 40))})`);
      out = r.text;
    }
    if (out) render(out, used, ar);
  }
  function render(text, used, ar) {
    msg('ai', `${used && used.length ? `<p class="cp-tools">${used.map(u => `<code>${esc(u)}</code>`).join('')}</p>` : ''}${ar ? '<p class="muted small" lang="ar" dir="rtl">الوضع المحلي يجيب بالإنجليزية؛ فعّل وضع Claude للإجابة بالعربية.</p>' : ''}${para(text)}`);
  }

  /* ---------------- Claude mode ---------------- */
  let client = null, SDKp = null, busy = false, stopFlag = false, current = null, TOOLS_DEF = null;
  const history = [];
  function loadSdk() {
    if (window.AnthropicSDK) return Promise.resolve(window.AnthropicSDK);
    if (!SDKp) SDKp = new Promise((res, rej) => { const s = document.createElement('script'); s.src = SDK; s.onload = () => res(window.AnthropicSDK); s.onerror = () => { s.remove(); rej(new Error('Could not load the SDK')); }; document.head.append(s); }).catch(err => { SDKp = null; throw err; });
    return SDKp;
  }
  const SYSTEM = `You are the production copilot of Plant EG-01, a fictional TV plant: six main assembly lines (ML1-ML6) fed by six LCM lines (panel modules), six SMD lines (main boards, firmware download and test), twenty injection machines (back covers and stands), six press, coating and sub-assembly lines (chassis), six cushion machines, the import warehouse, the local-vendor supermarket, milk-run trains, AGVs, forklifts, finished goods, docks, SAP and GMES, and nine AI agents. Every number comes from a live, simulated plant; never invent plant data - read it with the tools, and say which tool a number came from when it matters. Plant time is in the user's message.

How to work:
- Start from plant_overview or the most specific tool, then dig in.
- Before recommending a change, run it with simulate against the live plan (the two-hour flow forecast the agents use) and report TVs packed, late orders and material shortage. Money is EGP from the plant's sample cost model.
- You may not change the plant yourself. To change anything, call propose_action, or decide for an agent's decision; a person approves or declines in the chat. Never claim an action happened unless the tool result says it was approved and applied.
- Be brief and concrete: lead with the answer, then 2-5 supporting facts with numbers. Short bullet lists. No headings.
- Reply in the user's language (Arabic or English).`;
  const Sch = (props, req) => ({ type: 'object', properties: props, required: req || [], additionalProperties: false });
  const str = d => ({ type: 'string', description: d });
  const bad = m => JSON.stringify({ error: m });
  const isStr = v => typeof v === 'string' && v.length > 0 && v.length < 200;
  function defs(SDKm) {
    const tool = (name, description, schema, run) => Object.assign(SDKm.betaTool({ name, description, inputSchema: schema, run: async inp => { try { const r = await run(inp || {}); return typeof r === 'string' ? r : JSON.stringify(r); } catch (e) { return bad(String(e && e.message || e)); } } }), { eager_input_streaming: true });
    const list = [
      tool('plant_overview', 'Plant now: time, TVs packed against plan, the end-of-shift forecast and the chance to hit it, OEE, yield, power, alarms, the six main lines, stopped machines and decisions waiting.', Sch({}), () => T.plant_overview()),
      tool('line_status', 'One line: state, speed, OEE split into availability, performance and quality, rate, constraint station, its stations and line-side stock.', Sch({ line: str('ML1-ML6 main lines, LCM1-6, SMD1-6, PR1-6 press lines, CUS1-6 cushion machines, INJ injection') }, ['line']), i => (isStr(i.line) ? T.line_status({ line: i.line.toUpperCase() }) : bad('line is required'))),
      tool('station', 'One machine: state, reason, sensors, health, failure forecast, counts, power, speed, lockout and time lost by reason code.', Sch({ id: str('Station id, e.g. ML1-Packing, SMD4-MounterB, IM10, PR4-Coating, LCM2-Modulebonding') }, ['id']), i => (isStr(i.id) ? T.station({ id: i.id }) : bad('id is required'))),
      tool('alarms', 'Active alarms with priority (1 most urgent), area, time and state; alarms raised in the last 10 minutes.', Sch({}), () => T.alarms()),
      tool('decisions', "Decisions the agents want a person to take: key, agent, title, recommendation, and when a low-risk one goes ahead on its own.", Sch({}), () => T.decisions()),
      tool('decision_detail', 'One decision in full: evidence, reasons, the agents discussion, and every option it simulated with TVs packed, late orders, cost and whether it can be undone.', Sch({ key: str('Decision key from decisions()') }, ['key']), i => (isStr(i.key) ? T.decision_detail({ key: i.key }) : bad('key is required'))),
      tool('orders', "Today's open and recent sales orders: customer, model, quantity, due time, truck loading and whether the forecast finds them short.", Sch({}), () => T.orders()),
      tool('stock', 'Line-side stock with the shortest runway, or one buffer by id (e.g. LS:ML1:CTN, PBA:PBA-55, IMP:OC-65).', Sch({ id: str('Optional buffer id') }), i => T.stock(isStr(i.id) ? { id: i.id } : {})),
      tool('fleet', 'Every AGV, milk-run train and forklift: state, battery, mission.', Sch({}), () => T.fleet()),
      tool('genealogy', 'One TV, panel module or main board by serial: parts, lots, firmware, order and every station it passed.', Sch({ serial: str('Serial such as TV260518…') }, ['serial']), i => (isStr(i.serial) ? T.genealogy({ serial: i.serial }) : bad('serial is required'))),
      tool('quality', 'First-pass yield, defects per million, holds, rework, incoming inspection, defect counts by code and station, and the 8D nonconformance reports.', Sch({}), () => T.quality()),
      tool('maintenance', 'Machines wearing with their failure forecast, technicians and SAP PM work orders.', Sch({}), () => T.maintenance()),
      tool('energy', 'Power now, 15-minute average, forecast peak against the 4,000 kW contract, peak shaving, energy since the model started and each utility asset.', Sch({}), () => T.energy()),
      tool('simulate', `Run up to 3 options on the two-hour flow forecast (or another horizon) against the live plan. Each option is a list of command ids. Allowed now: ${commandIds().join(', ')}.`, Sch({ options: { type: 'array', minItems: 1, maxItems: 3, items: Sch({ label: str('Short name'), commands: { type: 'array', minItems: 1, maxItems: 3, items: { type: 'string' } } }, ['label', 'commands']) }, horizon_minutes: { type: 'number', minimum: 30, maximum: 480 } }, ['options']),
        i => {
          if (!Array.isArray(i.options) || !i.options.length || i.options.length > 3) return bad('options must be 1 to 3 items');
          for (const o of i.options) { if (!isStr(o.label) || !Array.isArray(o.commands) || !o.commands.length) return bad('each option needs a label and commands'); for (const c of o.commands) if (!action(c)) return bad('command not possible now: ' + c); }
          return simulate(i.options, +i.horizon_minutes || 120);
        }),
      tool('propose_action', 'Ask the person to approve one change to the live plant. Shows Approve and Decline buttons in the chat and waits for the answer. Use a command id from simulate.', Sch({ command: str('Command id'), reason: str('One sentence: why, with the simulated result if you ran it') }, ['command', 'reason']),
        async i => {
          const a = isStr(i.command) && action(i.command); if (!a) return bad('command not possible now: ' + i.command);
          if (!(await approval(`Apply: ${a.label}?`, String(i.reason || '').slice(0, 300)))) return { approved: false, note: 'The person declined. Do not retry the same action unless they ask.' };
          apply(i.command);
          return { approved: true, applied: true, audit: P().audit[0].id, note: 'Applied to the live plant and written to the audit trail.' };
        }),
      tool('decide', "Ask the person to take one option of an agent's decision. Waits for the person.", Sch({ key: str('Decision key'), option_index: { type: 'number', description: 'Index from decision_detail; omit for the recommended option' }, reason: str('One sentence for the record') }, ['key', 'reason']),
        async i => {
          const c = isStr(i.key) && AG().cards.get(i.key); if (!c) return bad('no open decision ' + i.key);
          if (c.decided) return bad('already decided: ' + c.decided.label);
          const idx = i.option_index != null ? +i.option_index : c.options.indexOf(c.best), op = c.options[idx]; if (!op) return bad('unknown option ' + i.option_index);
          if (!(await approval(`Decide: ${op.label}?`, String(i.reason || '').slice(0, 300)))) return { done: false, note: 'The person declined.' };
          const d = decide(c.key, idx);
          return d ? { done: true, audit: d.audit } : { done: false, note: 'The decision closed before it was approved.' };
        })
    ];
    list[list.length - 1].cache_control = { type: 'ephemeral' };
    return list;
  }
  async function ask(q) {
    const SDKm = await loadSdk();
    const key = mem || store.get();
    if (!client) client = new SDKm.Anthropic({ apiKey: key, dangerouslyAllowBrowser: true });
    if (!TOOLS_DEF) TOOLS_DEF = defs(SDKm);
    const before = history.length;
    history.push({ role: 'user', content: [{ type: 'text', text: `[Plant time ${E().clockS(P().t)}]\n${q}` }] });
    const box = msg('ai', '<p class="cp-dots" aria-label="Thinking"><i></i><i></i><i></i></p>');
    let cur = null, think = null, tools = null, final = null;
    const ensureText = () => { if (!cur) { const d = box.querySelector('.cp-dots'); if (d) d.remove(); cur = document.createElement('div'); cur._t = ''; box.append(cur); } return cur; };
    const runner = client.beta.messages.toolRunner({
      model: MODEL, max_tokens: 8000, stream: true, max_iterations: 14,
      system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
      tools: TOOLS_DEF, messages: history.slice(),
      thinking: { type: 'adaptive', display: 'summarized' },
      output_config: { effort: 'medium' },
      betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default'
    });
    try {
      for await (const stream of runner) {
        current = stream; cur = null; think = null; tools = null;
        stream.on('thinking', d => { const x = box.querySelector('.cp-dots'); if (x) x.remove(); if (!think) { think = document.createElement('p'); think.className = 'cp-think'; think._t = ''; box.append(think); } think._t += d; think.textContent = think._t; log.scrollTop = log.scrollHeight; });
        stream.on('text', d => { const c = ensureText(); c._t += d; c.innerHTML = para(c._t); log.scrollTop = log.scrollHeight; });
        stream.on('contentBlock', b => { if (b.type === 'tool_use') { if (!tools) { tools = document.createElement('p'); tools.className = 'cp-tools'; box.append(tools); } const c = document.createElement('code'); c.textContent = b.name + '(' + Object.values(b.input || {}).map(v => typeof v === 'object' ? '…' : JSON.stringify(v)).join(', ') + ')'; tools.append(c); think = null; cur = null; } });
        final = await stream.finalMessage();
        if (stopFlag || final.stop_reason === 'refusal') break;
        if (final.stop_reason === 'max_tokens') { box.insertAdjacentHTML('beforeend', '<p class="muted small">The answer was cut at its length limit.</p>'); break; }
      }
      const d = box.querySelector('.cp-dots'); if (d) d.remove();
      if (final && final.stop_reason === 'refusal') { history.length = before; box.insertAdjacentHTML('beforeend', '<p>The model declined this request, also on its fallback. Try rephrasing it as a question about the plant.</p>'); }
      else if (stopFlag) { history.length = before; box.insertAdjacentHTML('beforeend', '<p class="muted small">Stopped.</p>'); }
      else {
        const msgs = runner.params.messages;
        if (final && (!msgs.length || msgs[msgs.length - 1].role !== 'assistant')) msgs.push({ role: 'assistant', content: final.content });
        history.length = 0; history.push(...msgs);
      }
    } catch (e) {
      history.length = before;
      const d = box.querySelector('.cp-dots'); if (d) d.remove();
      const A = SDKm.Anthropic;
      let m = 'Something went wrong talking to the API.';
      if (A.AuthenticationError && e instanceof A.AuthenticationError) { m = 'The API key was not accepted. Check it, or go back to local mode.'; store.clear(); client = null; modeBar(); }
      else if (A.PermissionDeniedError && e instanceof A.PermissionDeniedError) m = 'This key has no access to the model.';
      else if (A.RateLimitError && e instanceof A.RateLimitError) m = 'Rate limited by the API. Wait a moment and ask again.';
      else if (A.APIConnectionError && e instanceof A.APIConnectionError) m = 'Could not reach the Anthropic API from this browser (network or content-security settings).';
      else if (A.APIUserAbortError && e instanceof A.APIUserAbortError) m = 'Stopped.';
      else if (A.APIError && e instanceof A.APIError) m = `The API returned an error (${e.status || ''}): ${e.message}`;
      else if (e && e.message) m = e.message;
      box.insertAdjacentHTML('beforeend', `<p>${esc(m)}</p>`);
    }
    current = null;
  }

  /* ---------------- send ---------------- */
  async function send() {
    const q = input.value.trim();
    if (busy) { if (current && current.abort) { stopFlag = true; current.abort(); } return; }
    if (!q) return;
    input.value = ''; input.style.height = 'auto';
    msg('you', `<p>${esc(q)}</p>`);
    busy = true; stopFlag = false;
    const sendBtn = $('#cpSend'); sendBtn.setAttribute('aria-label', 'Stop'); sendBtn.innerHTML = icon('stop');
    try { if (claude()) await ask(q); else await local(q); }
    catch (e) { console.error(e); msg('ai', `<p>${esc(e.message || String(e))}</p>`); }
    busy = false; stopFlag = false;
    sendBtn.setAttribute('aria-label', 'Send'); sendBtn.innerHTML = icon('arrowRight');
    suggestions();
  }

  window.Copilot = { open, close, ask: q => { open(); input.value = q; send(); } };
})();
