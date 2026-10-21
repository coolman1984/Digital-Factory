/* Digital Factory — the production copilot (window.Copilot), shared by the command room and the live plant.
   Two modes on the same tools the agents use (Agents.TOOLS, the what-if futures and the plant's commands):
   - Local: answers from the live twin with a rule-based reader; no key, nothing leaves the browser.
   - Claude: the viewer's own Anthropic API key, the official TypeScript SDK (vendored, loaded on demand), the tool runner
     with streaming, adaptive thinking with summaries shown, and server-side fallbacks. Every change to the plant goes
     through propose_action or decide_case, which waits for a person to press Approve in the chat.
   The key stays in this browser (session storage unless "remember" is ticked) and requests go straight to the API.
   All plant data is simulated. */
(function () {
  'use strict';
  const T = window.Twin, A = window.Agents, PE = window.PlantEngine;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const icon = n => (typeof Icons !== 'undefined' ? Icons.get(n) : '');
  const fmt = n => (isFinite(n) ? Math.round(n).toLocaleString('en-US') : '—');
  const pct = (v, d = 1) => (v * 100).toFixed(d) + '%';
  const egp = n => A.egp(n);
  const sgn = n => (n > 0 ? '+' : '') + egp(n);
  const MODEL = 'claude-opus-5-5';
  const KEY = 'df-claude-key';
  const SDK = 'assets/vendor/anthropic/anthropic.iife.min.js';

  /* ---------------- the drawer ---------------- */
  const shade = document.createElement('div'); shade.className = 'cp-shade'; shade.hidden = true;
  const root = document.createElement('aside');
  root.className = 'cp'; root.id = 'copilot'; root.setAttribute('aria-labelledby', 'cpTitle'); root.setAttribute('role', 'dialog'); root.inert = true;
  root.innerHTML = `
    <div class="cp-head"><span class="logo-mark" aria-hidden="true"></span><div><h2 id="cpTitle">Production copilot</h2><p>Reads the live twin with the agents' tools</p></div>
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
  const para = s => s.split(/\n{2,}/).map(p => /^\s*[-•]/.test(p) ? `<ul>${p.split(/\n/).map(l => `<li>${inline(l.replace(/^\s*[-•]\s*/, ''))}</li>`).join('')}</ul>` : `<p>${inline(p).replace(/\n/g, '<br>')}</p>`).join('');
  const inline = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/`([^`]+)`/g, '<code>$1</code>');
  function hello() {
    msg('ai', `<p>I read the same live twin the agents work on: lines, machines, buffers, AGVs, orders, energy, alarms and the agents' cases. I can also play options forward on the twin before you decide.</p><p class="muted small">${claude() ? 'Claude mode: your key, your account.' : 'Local mode: answers from the twin in this browser. Switch to Claude for open questions.'}</p>`);
    suggestions();
  }
  function suggestions() {
    const w = A.waiting();
    const s = [
      'Will we hit the plan today?',
      w.length ? `Should I approve ${w[0].id}?` : 'Which machine is most at risk?',
      'Why are alarms high?',
      'Which orders are at risk?',
      'What if Final Assembly B runs at 110%?',
      'How is energy against the contract?'
    ];
    sugg.innerHTML = s.map(x => `<button type="button">${esc(x)}</button>`).join('');
  }
  sugg.addEventListener('click', e => { const b = e.target.closest('button'); if (b) { input.value = b.textContent; send(); } });

  /* ---------------- modes ---------------- */
  const store = { get() { try { return sessionStorage.getItem(KEY) || localStorage.getItem(KEY); } catch (e) { return null; } },
    set(k, remember) { try { sessionStorage.setItem(KEY, k); if (remember) localStorage.setItem(KEY, k); else localStorage.removeItem(KEY); } catch (e) { /* storage blocked: key lives in memory only */ } mem = k; },
    clear() { try { sessionStorage.removeItem(KEY); localStorage.removeItem(KEY); } catch (e) { /* ignore */ } mem = null; } };
  let mem = null;
  const claude = () => !!(mem || store.get());
  function modeBar() {
    $('#cpMode').innerHTML = claude()
      ? `Mode <b>Claude</b> · ${esc(MODEL)} · tools on the live twin <button type="button" class="lnk" data-cp="local">Use local mode</button>`
      : `Mode <b>Local</b> · answers from the twin, no key <button type="button" class="lnk" data-cp="key">Use Claude with my key</button>`;
  }
  modeBar();
  root.addEventListener('click', e => {
    const b = e.target.closest('[data-cp]'); if (!b) return;
    if (b.dataset.cp === 'key') { $('#cpKey').hidden = false; $('#cpKeyIn').focus(); }
    if (b.dataset.cp === 'local') { store.clear(); client = null; history.length = 0; modeBar(); msg('ai', '<p>Back to local mode. Your key was removed from this browser.</p>'); }
  });
  $('#cpKey').addEventListener('submit', async e => {
    e.preventDefault();
    const k = $('#cpKeyIn').value.trim();
    if (!/^sk-ant-/.test(k)) { $('#cpKeyIn').setCustomValidity('An Anthropic key starts with sk-ant-'); $('#cpKeyIn').reportValidity(); return; }
    $('#cpKeyIn').setCustomValidity('');
    store.set(k, $('#cpRemember').checked); $('#cpKeyIn').value = ''; $('#cpKey').hidden = true;
    client = null; history.length = 0; modeBar();
    msg('ai', '<p>Claude mode is on. Ask anything about the plant; I will read the twin with tools and ask you before changing anything.</p>');
    input.focus();
  });

  /* ---------------- shared helpers ---------------- */
  const P = () => T.E.P;
  const lineName = id => (P().lines[id] ? P().lines[id].name : id);
  const forecast = () => (window.DF && DF.forecastNow ? DF.forecastNow() : { sim: false, prob: P().kpi.prob, p50: P().kpi.fcst, plan: P().kpi.planEnd });
  // what a person may let the copilot do (same commands as the control room and the agents)
  const ACTIONS = {
    'boost:L3': 'Final Assembly A to 110%', 'boost:L4': 'Final Assembly B to 110%', 'slowAssembly': 'Both assembly lines to 88%',
    'switchL2': 'SMT Line 2 changeover to main boards', 'switchBack': 'SMT Line 2 back to power boards',
    'planRepair:L1-MounterB': 'Planned bearing change on Mounter B', 'derate:L1-MounterB': 'Derate Mounter B to 85%',
    'stagger': 'Hold Compressor 2 and Chiller 2 for 20 min', 'precool': 'Pre-cool the chillers', 'reflowProfile': 'Lower both reflow profiles 3 °C',
    'stop:L1': 'Stop SMT Line 1', 'stop:L2': 'Stop SMT Line 2', 'stop:L3': 'Stop Final Assembly A', 'stop:L4': 'Stop Final Assembly B',
    'start:L1': 'Start SMT Line 1', 'start:L2': 'Start SMT Line 2', 'start:L3': 'Start Final Assembly A', 'start:L4': 'Start Final Assembly B',
    'expediteTruck': 'Book the alternative carrier for TV panels (EGP 18k)', 'cover': 'Move Laila Mostafa to Back cover', 'quarantine': 'Quarantine the suspect panel lot'
  };
  function actionLabel(id) {
    if (ACTIONS[id]) return ACTIONS[id];
    const po = /^prioritize:(.+)$/.exec(id);
    if (po && T.E && P().orders.some(o => o.id === po[1])) return `Load order ${po[1]} first`;
    const m = /^speed:(L[1-5])@([0-9.]+)$/.exec(id);
    if (m) { const v = +m[2]; if (v >= 0.8 && v <= 1.1) return `${lineName(m[1])} to ${Math.round(v * 100)}%`; }
    return null;
  }
  async function whatif(options, horizonMin = 45, seeds = 4) {
    const req = { horizon: Math.round(Math.max(10, Math.min(120, horizonMin)) * 60), seeds: Math.max(2, Math.min(8, Math.round(seeds))), options: [{ id: 'none', label: 'Do nothing', cmds: [] }].concat(options.map((o, i) => ({ id: 'o' + (i + 1), label: o.label, cmds: o.commands.map(id => ({ type: 'apply', id })) }))) };
    const r = await T.whatif(req);
    const base = r.options.find(o => o.id === 'none');
    return {
      horizon_min: Math.round(r.horizon / 60), futures_per_option: r.seeds, from: PE.clockS(r.at), ms: r.ms,
      options: r.options.map(o => ({ label: o.label, value_vs_nothing_egp: Math.round(o.S.value.mean - base.S.value.mean), value_p10_p90: [Math.round(o.S.value.p10 - base.S.value.mean), Math.round(o.S.value.p90 - base.S.value.mean)], better_in_share_of_futures: o.id === 'none' ? null : +o.winRate.toFixed(2), packed: Math.round(o.S.packed.mean), late_min: Math.round(o.S.lateMin.mean), down_min: Math.round(o.S.downMin.mean), peak_kw: Math.round(o.S.kwPeak.mean), fpy: o.S.fpy ? +o.S.fpy.mean.toFixed(4) : null }))
    };
  }
  function caseDetail(id) {
    const c = A.caseById(id); if (!c) return { error: 'No case ' + id + '. Use cases() to list them.' };
    const base = c.options && c.options[0];
    return { id: c.id, agent: A.agent(c.agent).name, title: c.title, state: c.state, opened: PE.clock(c.created), diagnosis: c.diagnosis ? { cause: c.diagnosis.cause, text: c.diagnosis.text, confidence: c.diagnosis.confidence } : null,
      required: c.required || null, recommended: c.recommended, chain: c.chain,
      options: (c.options || []).map(o => ({ id: o.id, label: o.label, why: o.why, value_vs_nothing_egp: base && o.value ? Math.round(o.value.mean - base.value.mean) : null, better_in_share: o.winRate != null ? +o.winRate.toFixed(2) : null, policy: o.polMax, risk: o.polRisk, packed: o.k ? Math.round(o.k.packed) : null, late_min: o.k ? Math.round(o.k.lateMin) : null })),
      decision: c.decision || null, outcome: c.outcome || null, steps: c.steps.slice(-12).map(s => `${s.time} ${s.kind}: ${s.title}${s.detail ? ' — ' + s.detail.slice(0, 220) : ''}`) };
  }

  /* an approval card in the chat: resolves true when a person approves */
  function approval(title, body) {
    return new Promise(res => {
      const d = msg('ai', `<div class="cp-prop"><p><b>${esc(title)}</b></p>${body ? `<p class="muted small">${esc(body)}</p>` : ''}<div class="cs-btns"><button type="button" class="btn btn-primary btn-sm" data-ok>${icon('check')}Approve</button><button type="button" class="btn btn-secondary btn-sm" data-no>Decline</button></div></div>`);
      const done = v => { d.querySelectorAll('button').forEach(b => { b.disabled = true; }); d.querySelector('.cp-prop').insertAdjacentHTML('beforeend', `<p class="small" style="margin:8px 0 0">${v ? 'Approved by you.' : 'Declined.'}</p>`); res(v); };
      d.querySelector('[data-ok]').onclick = () => done(true);
      d.querySelector('[data-no]').onclick = () => done(false);
      d.querySelector('[data-ok]').focus();
    });
  }

  /* ---------------- local mode: read the twin, answer in plain words ---------------- */
  const STN = () => P().stations.map(s => ({ s, key: s.name.toLowerCase() }));
  function findStations(q) {
    const t = q.toLowerCase();
    const hits = STN().filter(x => t.includes(x.key) || t.includes(x.s.id.toLowerCase()));
    const line = (t.match(/\bl([1-5])\b/) || [])[1];
    const pick = hits.filter(x => !line || x.s.line === 'L' + line);
    return (pick.length ? pick : hits).map(x => x.s);
  }
  function findLine(q) {
    const t = q.toLowerCase(), m = t.match(/\bl([1-5])\b|line ([1-5])\b/);
    if (m) return 'L' + (m[1] || m[2]);
    if (/smt line 1|smt 1/.test(t)) return 'L1'; if (/smt line 2|smt 2/.test(t)) return 'L2';
    if (/assembly a|tv line|tvs?\b/.test(t)) return 'L3'; if (/assembly b|phone line|phones?\b|smartphone/.test(t)) return 'L4';
    if (/test (&|and) pack|packing/.test(t)) return 'L5';
    return null;
  }
  async function local(q) {
    const t = q.toLowerCase(), used = [];
    const tool = (name, args) => { used.push(name + '(' + (args ? Object.values(args).map(v => JSON.stringify(v)).join(', ') : '') + ')'); return name === 'case_detail' ? caseDetail(args.id) : A.TOOLS[name](args || {}); };
    let out = '';
    const ar = /[؀-ۿ]/.test(q);
    const caseId = (q.match(/\bC-\d+\b/i) || [])[0];
    const serial = (q.match(/\b(TV|PH|MB|PB)26-\d{6}\b/i) || [])[0];
    const order = (q.match(/\b(SO|EX)-\d{4}(-B)?\b/i) || [])[0];
    const sts = findStations(q), line = findLine(q);
    if (serial) {
      const g = tool('genealogy', { serial: serial.toUpperCase() });
      out = g.error ? g.error + '.' : `**${g.serial}** (${g.model || g.type}) started ${g.born}${g.lot ? `, panel lot ${g.lot}` : ''}. It passed ${g.steps.length} steps:\n\n` + g.steps.slice(-8).map(s => `- ${s.at} ${s.station}: ${s.ok ? 'pass' : 'FAIL'}${s.note ? ' · ' + s.note : ''}`).join('\n');
    } else if (/what if|simulate|play.*forward|110|faster|boost|احاك|ماذا لو/.test(t)) {
      const L = line || (/phone|assembly b/.test(t) ? 'L4' : 'L3');
      const opt = /slow|88/.test(t) ? { label: ACTIONS.slowAssembly, commands: ['slowAssembly'] } : /stagger|chiller|compressor|peak/.test(t) ? { label: ACTIONS.stagger, commands: ['stagger'] } : /bearing|mounter b|repair/.test(t) ? { label: ACTIONS['planRepair:L1-MounterB'], commands: ['planRepair:L1-MounterB'] } : { label: ACTIONS['boost:' + L], commands: ['boost:' + L] };
      used.push(`simulate(${JSON.stringify(opt.label)})`);
      const think = msg('ai', '<p class="cp-think">Playing 4 futures of each option on forks of the live plant…</p>');
      const r = await whatif([opt], 45, 4);
      think.remove();
      const o = r.options[1], b = r.options[0];
      out = `I played **${opt.label}** against doing nothing, ${r.futures_per_option} futures each, ${r.horizon_min} minutes from ${r.from} (${(r.ms / 1000).toFixed(1)} s).\n\n- Value: **${sgn(o.value_vs_nothing_egp)}** against doing nothing (P10–P90 ${sgn(o.value_p10_p90[0])} to ${sgn(o.value_p10_p90[1])}), better in ${Math.round(o.better_in_share_of_futures * 100)}% of futures\n- Packed: ${fmt(o.packed)} against ${fmt(b.packed)}\n- Late: ${o.late_min} min against ${b.late_min} min · peak ${fmt(o.peak_kw)} kW against ${fmt(b.peak_kw)} kW\n\n${o.value_vs_nothing_egp > 2500 && o.better_in_share_of_futures >= 0.6 ? 'It pays off across the futures. You can apply it from Control, or approve it here.' : 'It does not beat doing nothing by a clear margin, so I would not do it now.'}`;
      if (o.value_vs_nothing_egp > 2500 && o.better_in_share_of_futures >= 0.6) {
        render(out, used, ar); out = null;
        const ok = await approval(`Apply: ${opt.label}?`, 'Runs on the live twin and goes to the audit trail under your name.');
        if (ok) { await T.exec({ type: 'apply', id: opt.commands[0], who: 'You (via copilot)' }); msg('ai', `<p>Done: ${esc(opt.label)}. It is in the audit trail.</p>`); }
      }
    } else if (caseId || /approve|recommend|decision|waiting|should i|قرار|اوافق|أوافق/.test(t)) {
      const c = caseId ? A.caseById(caseId.toUpperCase()) : A.waiting()[0];
      if (!c) out = A.waiting().length ? 'Name a case, for example ' + A.waiting()[0].id + '.' : 'No decision is waiting for you. The agents are watching the plant.';
      else {
        const d = tool('case_detail', { id: c.id });
        const rec = d.options.find(o => o.id === d.recommended);
        out = `**${d.id} · ${d.title}** (${d.agent}, ${d.state}).\n\n${d.diagnosis ? `Cause: **${d.diagnosis.cause}**${d.diagnosis.confidence ? `, ${Math.round(d.diagnosis.confidence * 100)}% sure` : ''}. ${d.diagnosis.text || ''}\n\n` : ''}${d.options.length > 1 ? 'Options the agent played forward:\n' + d.options.map(o => `- ${o.label}: ${o.id === 'none' ? 'baseline' : sgn(o.value_vs_nothing_egp) + ' vs doing nothing, better in ' + Math.round((o.better_in_share || 0) * 100) + '% of futures'}`).join('\n') : ''}${rec && rec.id !== 'none' ? `\n\nI agree with **${rec.label}**: it has the best expected result and the futures agree on it.` : ''}`;
        if ((c.state === 'awaiting' || c.state === 'advise') && rec && rec.id !== 'none') {
          render(out, used, ar); out = null;
          const ok = await approval(`Approve ${c.id}: ${rec.label}?`, 'The agent acts now and then verifies the outcome against its prediction.');
          if (ok) { A.approve(c.id, rec.id, 'Approved in the copilot'); msg('ai', `<p>Approved. ${esc(A.agent(c.agent).name)} acts now and verifies the result.</p>`); }
        }
      }
    } else if (/plan|forecast|shift|hit|on track|الخطة|توقع/.test(t)) {
      const o = tool('plant_overview'), f = forecast();
      out = `At ${o.time}, **${fmt(o.packed)}** units are packed against a plan of ${fmt(o.plan)} so far. ${f.sim ? `Across ${f.n} simulated futures to 14:00 the shift ends at about **${fmt(f.p50)}** (P10 ${fmt(f.p10)}, P90 ${fmt(f.p90)}) against a plan of ${fmt(f.plan)}: a **${Math.round(f.prob * 100)}%** chance to hit it.` : `At the current rate the shift ends at about ${fmt(o.forecast)} against ${fmt(o.planEnd)}.`}\n\nPlant OEE ${pct(o.oee)}, first-pass yield ${pct(o.fpy)}. ${o.lines.filter(l => l.state !== 'run').map(l => `${l.name} is ${l.state}`).join('; ') || 'All lines are running.'}`;
    } else if (/alarm|flood|إنذار|انذار/.test(t)) {
      const a = tool('alarms');
      const by = {}; a.active.forEach(x => { by[x.area] = (by[x.area] || 0) + 1; });
      out = a.active.length ? `${a.active.length} active alarms, ${a.rate10min} raised in the last 10 minutes${a.flood ? ' — **a flood** (ISA-18.2 limit 10)' : ''}.\n\n` + Object.entries(by).sort((x, y) => y[1] - x[1]).map(([k, v]) => `- ${k}: ${v}`).join('\n') + `\n\nMost urgent: **${a.active.slice().sort((x, y) => x.prio - y.prio)[0].msg}**.${a.active.some(x => x.case) ? ' The agents grouped related alarms into their case; open it from Alarms.' : ''}` : 'No active alarms. The alarm rate is inside the ISA-18.2 target.';
    } else if (order || /order|late|ship|customer|طلب/.test(t)) {
      const os = tool('orders');
      const list = order ? os.filter(o => o.id.toUpperCase() === order.toUpperCase()) : os;
      out = list.length ? list.map(o => `- **${o.id}** ${o.customer}: ${fmt(o.qty)} ${o.product === 'tv' ? 'TVs' : 'phones'} due ${o.due}, ready about ${o.readyEta || '—'}${o.lateMin > 5 ? ` · **${o.lateMin} min late**` : ' · on time'}`).join('\n') : 'No order with that number today.';
    } else if (/energy|power|kw|peak|tariff|demand|طاقة|كهرب/.test(t)) {
      const e = tool('energy');
      const En = P().energy;
      out = `Plant power **${fmt(e.kw)} kW** in the ${e.tariff} tariff (EGP ${e.price}/kWh). This 15-minute interval is heading to **${fmt(En.proj)} kW** against a contract of ${fmt(e.contract)} kW${En.proj > e.contract ? ' — **over**: the energy agent should stagger Compressor 2 and Chiller 2' : ''}. Today: ${fmt(e.kwhToday)} kWh, ${egp(e.costToday)}, peak ${fmt(e.peakToday)} kW. Ambient ${e.ambient} °C.\n\n` + e.assets.map(x => `- ${x.name}: ${x.kw} kW${x.on ? '' : ' (off)'}`).join('\n');
    } else if (/stock|material|runway|run out|supermarket|مخزون/.test(t)) {
      const s = tool('stock').filter(x => x.runwayMin != null).sort((a, b) => a.runwayMin - b.runwayMin).slice(0, 6);
      out = 'Shortest runways at the current rate:\n\n' + s.map(x => `- ${x.label} at ${x.at}: **${x.runwayMin} min** (${x.level} of ${x.cap})${x.delivery ? ' · ' + x.delivery : ''}`).join('\n');
    } else if (/agv/.test(t)) {
      const f = tool('agv_fleet');
      out = f.map(a => `- **${a.id}** ${a.fault ? 'FAULT: ' + a.fault : a.state} · battery ${a.battery}%${a.mission ? ' · ' + a.mission : ''}`).join('\n');
    } else if (/quality|aoi|defect|yield|reject|fpy|جودة/.test(t)) {
      const l1 = tool('aoi_analysis', { line: 'L1', boards: 120 }), l2 = tool('aoi_analysis', { line: 'L2', boards: 120 }), ta = tool('test_analysis', { minutes: 40 });
      out = `AOI, last 120 boards: SMT Line 1 ${pct(l1.rate)} rejected, SMT Line 2 ${pct(l2.rate)}. ${l2.factors && l2.factors.z5 && Math.abs(l2.factors.z5.r) > 0.2 ? `On Line 2 rejects correlate with oven zone 5 (r = ${l2.factors.z5.r}).` : ''}\n\nTV test, last 40 min: ${ta.failed} of ${ta.tested} failed.${ta.byLot[0] && ta.byLot[0].failed ? ` Worst lot ${ta.byLot[0].lot}: ${ta.byLot[0].failed} of ${ta.byLot[0].tested}.` : ''}`;
    } else if (/risk|wear|vibration|maintenance|fail|bearing|صيانة|اهتزاز/.test(t) && !sts.length) {
      const rot = P().stations.filter(s => s.hist.vib && s.hist.vib.length > 10 && (s.kind === 'mounter' || s.kind === 'robot' || s.kind === 'palletizer'));
      const rows = rot.map(s => { const r = A.linreg(s.hist.vib.slice(-36).filter(v => v > 0.6), 5 / 60); return { s, r }; }).sort((a, b) => b.r.slope - a.r.slope);
      used.push('history(vib) × ' + rows.length);
      const top = rows[0];
      out = top && top.r.slope > 0.004 && top.r.r2 > 0.3 ? `**${top.s.name}** on ${lineName(top.s.line)} is the one to watch: vibration ${top.s.sens.vib.toFixed(2)} mm/s, rising ${(top.r.slope * 60).toFixed(2)} mm/s per hour (r² ${top.r.r2.toFixed(2)}), about ${PE.mins(Math.max(0, 7.1 - top.r.last) / top.r.slope * 60)} to zone D.` : 'No rotating machine shows a wear trend right now. Highest vibration: ' + rows.slice().sort((a, b) => b.s.sens.vib - a.s.sens.vib).slice(0, 3).map(x => `${x.s.name} ${x.s.sens.vib.toFixed(1)} mm/s`).join(', ') + '.';
    } else if (sts.length) {
      out = sts.slice(0, 2).map(s => {
        const d = tool('station', { id: s.id });
        return `**${d.name}** (${d.line}) is **${d.state}**${d.why ? ' · ' + d.why : ''} since ${d.since}. Cycle ${d.cycleS} s, made ${fmt(d.made)}, rejected ${fmt(d.rejected)}.${d.sensors.vib != null ? ` Vibration ${d.sensors.vib} mm/s${d.vibrationTrendPerHour != null ? `, ${d.vibrationTrendPerHour > 0 ? '+' : ''}${d.vibrationTrendPerHour}/h` : ''}.` : ''}${d.fault ? ` Fault: ${d.fault}.` : ''}`;
      }).join('\n\n');
    } else if (line) {
      const l = tool('line_status', { line });
      out = `**${l.name}** (${l.product}) is ${l.state} at ${Math.round(l.speed * 100)}% speed: OEE ${pct(l.oee)} (availability ${pct(l.availability)}, performance ${pct(l.performance)}, quality ${pct(l.quality, 2)}), ${fmt(l.perHour)} per hour.\n\n` + l.stations.filter(s => s.state !== 'run').map(s => `- ${s.name}: ${s.state}${s.why ? ' · ' + s.why : ''}`).join('\n');
    } else {
      const o = tool('plant_overview');
      out = `At ${o.time}: ${fmt(o.packed)} packed (plan ${fmt(o.plan)}), OEE ${pct(o.oee)}, ${o.activeAlarms} active alarms, ${fmt(o.kw)} kW. ${o.openCases.length ? `Open cases: ${o.openCases.map(c => `${c.id} ${c.title}`).join('; ')}.` : 'No open cases.'}\n\nAsk about a machine, a line, an order, a serial, alarms, energy, quality, or "what if…". Claude mode answers open questions.`;
    }
    if (out) render(out, used, ar);
  }
  function render(text, used, ar) {
    msg('ai', `${used && used.length ? `<p class="cp-tools">${used.map(u => `<code>${esc(u)}</code>`).join('')}</p>` : ''}${ar ? '<p class="muted small" lang="ar" dir="rtl">الوضع المحلي يجيب بالإنجليزية؛ فعّل وضع Claude للإجابة بالعربية.</p>' : ''}${para(text)}`);
  }

  /* ---------------- Claude mode ---------------- */
  let client = null, SDKp = null, busy = false, stopFlag = false, current = null;
  const history = [];
  function loadSdk() {
    if (window.AnthropicSDK) return Promise.resolve(window.AnthropicSDK);
    if (!SDKp) SDKp = new Promise((res, rej) => { const s = document.createElement('script'); s.src = SDK; s.onload = () => res(window.AnthropicSDK); s.onerror = () => rej(new Error('Could not load the SDK')); document.head.append(s); });
    return SDKp;
  }
  const SYSTEM = `You are the production copilot of Plant EG-01, a fictional electronics plant (SMT lines 1-2, final assembly A for TVs and B for smartphones, burn-in, final QC, packing, AGVs, utilities). Every number comes from a live, simulated digital twin; never invent plant data - read it with the tools, and say which tool a number came from when it matters. Plant time is in the user's message.

How to work:
- Start from plant_overview or the most specific tool, then dig in (station, history, alarms, case_detail, orders, stock, energy, aoi_analysis, test_analysis, genealogy).
- Before recommending a change, play it forward with simulate against doing nothing and report the value range (P10-P90) and how often it wins. Money is EGP from the plant's sample cost model.
- You may not change the plant yourself. To change anything, call propose_action (or decide_case for an agent's case); a person approves or declines in the chat. Never claim an action happened unless the tool result says it was approved and applied.
- Be brief and concrete: lead with the answer, then 2-5 supporting facts with numbers. Use short bullet lists. No headings.
- Reply in the user's language (Arabic or English).`;
  const S = (props, req) => ({ type: 'object', properties: props, required: req || [], additionalProperties: false });
  const str = d => ({ type: 'string', description: d });
  const LINES = ['L1', 'L2', 'L3', 'L4', 'L5'];
  const bad = m => JSON.stringify({ error: m });
  const isStr = v => typeof v === 'string' && v.length > 0 && v.length < 200;
  function defs(SDKm) {
    const tool = (name, description, schema, run) => Object.assign(SDKm.betaTool({ name, description, inputSchema: schema, run: async inp => { try { const r = await run(inp || {}); return typeof r === 'string' ? r : JSON.stringify(r); } catch (e) { return bad(String(e && e.message || e)); } } }), { eager_input_streaming: true });
    const stationIds = P().stations.map(s => s.id).join(', ');
    const list = [
      tool('plant_overview', 'Plant now: time, output against plan, OEE, yield, power, alarms, every line, open agent cases.', S({}), () => A.TOOLS.plant_overview()),
      tool('line_status', 'One line: state, speed, OEE split into availability, performance and quality, rate, and its stations.', S({ line: { type: 'string', enum: LINES, description: 'L1 SMT Line 1, L2 SMT Line 2, L3 Final Assembly A (TVs), L4 Final Assembly B (phones), L5 Test & Pack' } }, ['line']), i => (LINES.includes(i.line) ? A.TOOLS.line_status(i) : bad('line must be one of ' + LINES.join(', ')))),
      tool('station', `One station: state, reason, sensors, vibration trend, counts, fault. Station ids: ${stationIds}.`, S({ id: str('Station id') }, ['id']), i => (isStr(i.id) ? A.TOOLS.station(i) : bad('id is required'))),
      tool('history', 'Recent history of one sensor on a station, sampled every 5 plant seconds, with a linear trend.', S({ id: str('Station id'), series: { type: 'string', enum: ['vib', 'temp', 'kw', 'vac', 'ct', 'z5'] }, minutes: { type: 'number', minimum: 1, maximum: 15 } }, ['id', 'series']), i => (isStr(i.id) && ['vib', 'temp', 'kw', 'vac', 'ct', 'z5'].includes(i.series) ? A.TOOLS.history({ id: i.id, series: i.series, minutes: Math.max(1, Math.min(15, +i.minutes || 15)) }) : bad('id and a valid series are required'))),
      tool('alarms', 'Active alarms with priority (1 most urgent), area, time, state, and the agent case they were grouped into; alarm rate and flood flag.', S({}), () => A.TOOLS.alarms()),
      tool('cases', "The agents' cases: id, agent, title, state, recommendation, value.", S({}), () => A.TOOLS.cases()),
      tool('case_detail', 'One case in full: diagnosis, evidence-based cause, the options the agent simulated with their value against doing nothing, policy, decision, verification and the last steps.', S({ id: str('Case id, e.g. C-104') }, ['id']), i => (isStr(i.id) ? caseDetail(i.id.toUpperCase()) : bad('id is required'))),
      tool('orders', "Today's open and recent orders: quantity, due, ready time at the current rate, lateness.", S({}), () => A.TOOLS.orders()),
      tool('stock', 'Buffers: line-side stock, the board supermarket and the warehouse, with level, runway in minutes and the next delivery. Optional id narrows to one buffer.', S({ id: str('Buffer id such as LS:L3cover, SM:main, RM:panel') }), i => A.TOOLS.stock(isStr(i.id) ? { id: i.id } : {})),
      tool('agv_fleet', 'Every AGV: state, battery, mission, fault.', S({}), () => A.TOOLS.agv_fleet()),
      tool('genealogy', 'One unit by serial: parts, lot, pallet, order and every station it passed.', S({ serial: str('Serial such as TV26-041900') }, ['serial']), i => (isStr(i.serial) ? A.TOOLS.genealogy(i) : bad('serial is required'))),
      tool('aoi_analysis', 'AOI results for an SMT line: reject rate, defect codes and how strongly process factors (oven zone 5, reflow peak, SPI, paste, mounter vibration) separate rejected from passed boards.', S({ line: { type: 'string', enum: ['L1', 'L2'] }, boards: { type: 'number', minimum: 20, maximum: 400 } }, ['line']), i => (['L1', 'L2'].includes(i.line) ? A.TOOLS.aoi_analysis({ line: i.line, boards: Math.max(20, Math.min(400, +i.boards || 120)) }) : bad('line must be L1 or L2'))),
      tool('test_analysis', 'TV function-test and final-QC results by panel lot over the last minutes.', S({ minutes: { type: 'number', minimum: 5, maximum: 120 } }), i => A.TOOLS.test_analysis({ minutes: Math.max(5, Math.min(120, +i.minutes || 40)) })),
      tool('lot_location', 'Where a panel lot is: line side, warehouse, in process, packed.', S({ lot: str('Lot id such as PL-220712') }, ['lot']), i => (isStr(i.lot) ? A.TOOLS.lot_location(i) : bad('lot is required'))),
      tool('spares', 'Spare-part stock for a part name.', S({ part: str('Part name, e.g. Spindle bearing 6204-2RS') }, ['part']), i => (isStr(i.part) ? A.TOOLS.spares(i) : bad('part is required'))),
      tool('technicians', 'Maintenance technicians and what they are doing.', S({}), () => A.TOOLS.technicians()),
      tool('energy', 'Power now, contract demand, tariff and price, energy and cost today, ambient temperature and each utility asset.', S({}), () => Object.assign(A.TOOLS.energy(), { projected15minKw: Math.round(P().energy.proj), overContractKwToday: Math.round(P().energy.over) })),
      tool('simulate', `Play up to 3 options forward on copies of the live plant against doing nothing. Each option is a list of command ids. Allowed command ids: ${Object.keys(ACTIONS).join(', ')}, prioritize:<order id>, and speed:<line>@<0.80-1.10>.`, S({ options: { type: 'array', minItems: 1, maxItems: 3, items: S({ label: str('Short name'), commands: { type: 'array', minItems: 1, maxItems: 3, items: { type: 'string' } } }, ['label', 'commands']) }, horizon_minutes: { type: 'number', minimum: 10, maximum: 120 }, futures: { type: 'number', minimum: 2, maximum: 8 } }, ['options']),
        async i => {
          if (!Array.isArray(i.options) || !i.options.length || i.options.length > 3) return bad('options must be 1 to 3 items');
          for (const o of i.options) { if (!isStr(o.label) || !Array.isArray(o.commands) || !o.commands.length) return bad('each option needs a label and commands'); for (const c of o.commands) if (!actionLabel(c)) return bad('unknown command id ' + c); }
          return whatif(i.options, +i.horizon_minutes || 45, +i.futures || 4);
        }),
      tool('propose_action', 'Ask the person to approve one change to the live plant. Shows Approve and Decline buttons in the chat and waits for the answer. Use a command id from simulate.', S({ command: str('Command id'), reason: str('One sentence: why, with the simulated value if you ran it') }, ['command', 'reason']),
        async i => {
          const label = isStr(i.command) && actionLabel(i.command); if (!label) return bad('unknown command id ' + i.command);
          const ok = await approval(`Apply: ${label}?`, String(i.reason || '').slice(0, 300));
          if (!ok) return { approved: false, note: 'The person declined. Do not retry the same action unless they ask.' };
          const done = await T.exec({ type: 'apply', id: i.command, who: 'You (via copilot)' });
          return { approved: true, applied: !!done, note: done ? 'Applied to the live twin and written to the audit trail.' : 'The plant rejected the command (not possible in its current state).' };
        }),
      tool('decide_case', "Ask the person to approve or reject an agent's recommendation on a case that waits for a decision. Waits for the person.", S({ case_id: str('Case id'), decision: { type: 'string', enum: ['approve', 'reject'] }, option_id: str('Option id to approve; omit for the recommended one'), reason: str('One sentence for the ledger') }, ['case_id', 'decision', 'reason']),
        async i => {
          const c = isStr(i.case_id) && A.caseById(i.case_id.toUpperCase()); if (!c) return bad('no case ' + i.case_id);
          if (c.state !== 'awaiting' && c.state !== 'advise') return bad(`${c.id} is ${c.state}, not waiting for a decision`);
          if (!['approve', 'reject'].includes(i.decision)) return bad('decision must be approve or reject');
          const opt = c.options.find(o => o.id === (i.option_id || c.recommended));
          if (i.decision === 'approve' && !opt) return bad('unknown option ' + i.option_id);
          const ok = await approval(i.decision === 'approve' ? `Approve ${c.id}: ${opt.label}?` : `Reject ${c.id}?`, String(i.reason || '').slice(0, 300));
          if (!ok) return { done: false, note: 'The person declined.' };
          if (i.decision === 'approve') A.approve(c.id, opt.id, String(i.reason || 'Approved in the copilot').slice(0, 160)); else A.reject(c.id, String(i.reason || 'Rejected in the copilot').slice(0, 160));
          return { done: true, note: i.decision === 'approve' ? 'The agent acts now and verifies the outcome.' : 'Rejected and written to the ledger.' };
        })
    ];
    list[list.length - 1].cache_control = { type: 'ephemeral' };     // cache the tool definitions and the system prompt
    return list;
  }
  let TOOLS_DEF = null;
  async function ask(q) {
    const SDKm = await loadSdk();
    const key = mem || store.get();
    if (!client) client = new SDKm.Anthropic({ apiKey: key, dangerouslyAllowBrowser: true });
    if (!TOOLS_DEF) TOOLS_DEF = defs(SDKm);       // declared once per conversation: the tools stay byte-identical
    const before = history.length;
    history.push({ role: 'user', content: [{ type: 'text', text: `[Plant time ${PE.clockS(P().t)}]\n${q}` }] });
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
        if (stopFlag) break;
        if (final.stop_reason === 'refusal') break;
        if (final.stop_reason === 'max_tokens') { box.insertAdjacentHTML('beforeend', '<p class="muted small">The answer was cut at its length limit.</p>'); break; }
      }
      const d = box.querySelector('.cp-dots'); if (d) d.remove();
      if (final && final.stop_reason === 'refusal') {
        history.length = before;
        box.insertAdjacentHTML('beforeend', '<p>The model declined this request, also on its fallback. Try rephrasing it as a question about the plant.</p>');
      } else if (stopFlag) {
        history.length = before;
        box.insertAdjacentHTML('beforeend', '<p class="muted small">Stopped.</p>');
      } else {
        const msgs = runner.params.messages;
        if (final && (!msgs.length || msgs[msgs.length - 1].role !== 'assistant')) msgs.push({ role: 'assistant', content: final.content });
        history.length = 0; history.push(...msgs);       // the whole turn, thinking blocks included, replayed verbatim next time
      }
    } catch (e) {
      history.length = before;
      const d = box.querySelector('.cp-dots'); if (d) d.remove();
      const E = SDKm.Anthropic;
      let m = 'Something went wrong talking to the API.';
      if (E.AuthenticationError && e instanceof E.AuthenticationError) { m = 'The API key was not accepted. Check it, or go back to local mode.'; store.clear(); client = null; modeBar(); }
      else if (E.PermissionDeniedError && e instanceof E.PermissionDeniedError) m = 'This key has no access to the model.';
      else if (E.RateLimitError && e instanceof E.RateLimitError) m = 'Rate limited by the API. Wait a moment and ask again.';
      else if (E.APIConnectionError && e instanceof E.APIConnectionError) m = 'Could not reach the Anthropic API from this browser (network or content-security settings).';
      else if (E.APIUserAbortError && e instanceof E.APIUserAbortError) m = 'Stopped.';
      else if (E.APIError && e instanceof E.APIError) m = `The API returned an error (${e.status || ''}): ${e.message}`;
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
