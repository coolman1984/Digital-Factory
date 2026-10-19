/* Digital Factory — production copilot: answers from live plant data (rule-based in this demo). */
(function () {
  'use strict';
  const { $, fmt, pct, money, esc, STATE_LABEL } = DF;
  const chat = $('#chat');
  const CHIPS = ['Summarize this shift', 'Will we hit the plan?', 'What should I decide now?', 'Why is OEE not higher?', 'What are the alarms about?', 'Write the shift handover'];
  $('#chips').innerHTML = CHIPS.map(c => `<button type="button" class="chip-btn">${c}</button>`).join('');
  $('#chips').addEventListener('click', e => { const c = e.target.closest('.chip-btn'); if (c) ask(c.textContent); });
  $('#chatForm').addEventListener('submit', e => { e.preventDefault(); const v = $('#chatInput').value.trim(); if (v) { ask(v); $('#chatInput').value = ''; } });

  function open(o) {
    const d = $('#copilot');
    const v = o === undefined ? !d.classList.contains('open') : o;
    d.classList.toggle('open', v); d.setAttribute('aria-hidden', String(!v));
    if (v && !chat.children.length) bot('<b>Hello. I am the production copilot.</b><br>I read live data from every line, machine, alarm and AI agent in the plant. Ask me anything in plain language.', 'connected · 5 lines · 31 machines · 6 agents');
    if (v) setTimeout(() => $('#chatInput').focus({ preventScroll: true }), 300);
  }
  DF.openCopilot = open;
  $('#btnCopilot').onclick = () => open();
  $('#closeCopilot').onclick = () => open(false);

  function user(t) { const m = document.createElement('div'); m.className = 'msg user'; m.textContent = t; chat.append(m); chat.scrollTop = chat.scrollHeight; }
  function bot(html, src) {
    const m = document.createElement('div'); m.className = 'msg bot';
    m.innerHTML = html + (src ? `<div class="src">Sources: ${src}</div>` : '');
    chat.append(m); chat.scrollTop = chat.scrollHeight;
  }
  function ask(q) {
    user(q);
    const t = document.createElement('div'); t.className = 'msg bot'; t.innerHTML = '<span class="typing"><i></i><i></i><i></i></span>';
    chat.append(t); chat.scrollTop = chat.scrollHeight;
    setTimeout(() => { t.remove(); const a = answer(q); bot(a.html, a.src); }, 600 + Math.random() * 500);
  }
  DF.ask = ask;

  const worst = () => Sim.state.lines.slice().sort((a, b) => a.oee - b.oee)[0];
  function issues(l) {
    const out = [];
    l.stations.forEach(s => {
      if (s.state === 'down') out.push(`<b>${s.name}</b> is stopped`);
      else if (s.state === 'maint') out.push(`<b>${s.name}</b> is in a planned repair`);
      else if (s.state === 'warn') out.push(`<b>${s.name}</b> is running slowly (cycle ${s.cycle.toFixed(1)} s against ${(3600 / l.rate).toFixed(1)} s)`);
    });
    if (l.starved) out.push('the line is <b>out of material</b>');
    if (l.stopped) out.push('it was <b>stopped by an operator</b>');
    if (l.paused) out.push('it is <b>restarting after a power dip</b>');
    if (l.defectMult > 1.5) out.push(`defects are <b>${l.defectMult.toFixed(1)}× normal</b>`);
    return out;
  }
  function waiting() { return Sim.state.insights.filter(i => i.level !== 'ok' && i.actions && i.actions.some(a => a.primary)).sort((a, b) => (b.risk || 0) - (a.risk || 0)); }

  function answer(q) {
    const S = Sim.state, s = q.toLowerCase();
    const u = Sim.unitsToday(), p = Sim.planToday(), f = Sim.forecast();
    const open = S.alarms.filter(a => a.state !== 'cleared');
    const stn = Sim.allStations().find(x => s.includes(x.name.toLowerCase()) && s.includes(Sim.line(x.line).name.toLowerCase()));
    if (stn) {
      const l = Sim.line(stn.line), r = Sim.rulHours(stn);
      return { src: `${l.id} PLC · vibration sensor · remaining-life model`, html: `<b>${stn.name} (${l.name})</b> is <b>${STATE_LABEL[stn.state].toLowerCase()}</b>. Health ${Math.round(stn.health)}/100, vibration ${stn.vib.toFixed(2)} mm/s (alarm at 7.1), temperature ${stn.temp.toFixed(1)} °C.${stn.machine ? `<br>Remaining useful life: <b>${stn.state === 'down' ? '0 h, failed' : fmt(r) + ' h'}</b>. Failure risk in the next 24 h: <b>${Math.round(Sim.failureRisk(stn) * 100)}%</b>.` : ''}${stn.degrade > 0 ? '<br>The vibration trend is accelerating. I recommend approving the planned repair.' : ''}` };
    }
    if (/handover|hand over|hand-over/.test(s)) {
      const done = S.audit.slice(0, 5);
      return { src: 'MES · CMMS · alarm system · audit trail', html: `<b>Shift A handover · ${Sim.clock()}</b><ol><li><b>Output:</b> ${fmt(u)} units against a plan of ${fmt(p)}. Forecast at 14:00: ${fmt(f.p50)} (${Math.round(f.prob * 100)}% chance to hit plan).</li><li><b>Quality:</b> first-pass yield ${pct(S.fpy)}.</li><li><b>Open alarms:</b> ${open.length}${open.length ? ', top: ' + esc(open.sort((a, b) => a.prio - b.prio)[0].msg) : ''}.</li><li><b>Decisions waiting:</b> ${waiting().length ? waiting().map(i => esc(i.title)).join('; ') : 'none'}.</li><li><b>Actions taken:</b> ${done.length ? done.map(d => `${d.time} ${esc(d.who)}: ${esc(d.action)}`).join('; ') : 'none yet'}.</li><li><b>Value saved by AI:</b> ${money(S.saved)}.</li></ol>` };
    }
    if (/summar|shift|report|brief|status|today/.test(s)) {
      const best = S.lines.slice().sort((a, b) => b.oee - a.oee)[0], wl = worst();
      return { src: 'MES · CMMS · vision AI · EMS · agents', html: `<b>Shift A summary · ${Sim.clock()}</b><ul><li>Output <b>${fmt(u)}</b> units against a plan of ${fmt(p)} (<span class="${u >= p ? 'ok-text' : 'danger-text'}">${u >= p ? '+' : ''}${((u / p - 1) * 100).toFixed(1)}%</span>)</li><li>Plant OEE <b>${pct(S.oee)}</b>, yield <b>${pct(S.fpy)}</b></li><li>Best line: ${best.name} (${pct(best.oee, 0)}). Weakest: ${wl.name} (${pct(wl.oee, 0)})</li><li>Agents took <b>${S.agents.reduce((a, g) => a + g.actions, 0)}</b> actions and saved <b class="ok-text">${money(S.saved)}</b></li><li>${waiting().length ? 'Needs your decision: <b>' + esc(waiting()[0].title) + '</b>' : 'Nothing needs your decision right now.'}</li></ul>` };
    }
    if (/plan|forecast|hit|target|end of shift|predict/.test(s)) {
      return { src: 'Forecast model · MES · alarm system', html: `At 14:00 I expect <b>${fmt(f.p50)}</b> units (range ${fmt(f.p10)}–${fmt(f.p90)}) against a plan of <b>${fmt(f.plan)}</b>.<br>Chance to hit the plan: <b>${Math.round(f.prob * 100)}%</b>.${f.risks ? `<br>${f.risks} open risk${f.risks > 1 ? 's are' : ' is'} widening the range. Clearing them raises the chance.` : ''} <a href="#predict">Open predictions</a>` };
    }
    if (/decide|decision|approve|fix first|priorit|focus|what should/.test(s)) {
      const w = waiting();
      if (!w.length) return { src: 'Agents · CMMS · EMS', html: 'Nothing is waiting for your decision. The agents are handling routine work. The next planned maintenance is the reflow fan on SMT Line 2 (about 1,100 h left).' };
      return { src: 'Agents · cost model', html: `<b>${w.length} decision${w.length > 1 ? 's' : ''} waiting, ranked by value at stake:</b><ol>${w.map(i => `<li><b>${esc(i.title)}</b>${i.risk ? ` (${money(i.risk)})` : ''}<br><span class="muted">${esc(i.body)}</span></li>`).join('')}</ol>You can approve them in Leadership or in the Decisions panel.` };
    }
    if (/alarm|incident|flood/.test(s)) {
      const inc = S.incidents.filter(i => i.open);
      return { src: 'Alarm system (ISA-18.2) · AI correlation', html: `${open.length} active alarm${open.length === 1 ? '' : 's'}.${inc.length ? `<br>They come from <b>${inc.length} root cause${inc.length > 1 ? 's' : ''}</b>: ${inc.map(i => `<b>${esc(i.title)}</b> (${i.members.length + 1} alarms, cause: ${esc(i.cause)})`).join('; ')}.` : open.length ? `<br>Most important: <b>${esc(open.sort((a, b) => a.prio - b.prio)[0].msg)}</b>.` : ' The plant is quiet.'} <a href="#alarms">Open alarms</a>` };
    }
    if (/agent|autonom|ai doing/.test(s)) {
      return { src: 'Agent runtime · audit trail', html: S.agents.map(a => `<b>${esc(a.name)}</b> (${a.autonomy === 'auto' ? 'Auto' : a.autonomy === 'approve' ? 'Approve' : 'Advise'}): ${esc(a.log[0] ? a.log[0].text : 'watching')}`).join('<br>') + ' <br><a href="#agents">Open AI agents</a>' };
    }
    if (/oee|slow|why|drop|down|stop|perform/.test(s)) {
      const wl = worst(), iss = issues(wl), loss = (0.85 - S.oee) * 100;
      return { src: `${wl.id} PLC · MES · root-cause model`, html: `Plant OEE is <b>${pct(S.oee)}</b>${loss > 0 ? `, ${loss.toFixed(1)} points below world-class` : ', above world-class'}.<br>The biggest drag is <b>${wl.name}</b> at ${pct(wl.oee, 0)} OEE${iss.length ? ', because ' + iss.join(' and ') : ''}.<br>${iss.length ? (waiting()[0] ? `Action: approve “${esc(waiting()[0].title)}”.` : 'The line is already recovering.') : 'No active faults. The remaining gap is short stops; I can rank them by station.'}` };
    }
    if (/demand|capacity|order|season|export|handle|\+/.test(s)) {
      const m = s.match(/(\d{1,3})\s*%/); const d = m ? 100 + +m[1] : 120;
      const r = DF.model({ demand: d, shifts: 2, speed: 100, pdm: true, vision: true, energy: true }), r0 = DF.model({ demand: d, shifts: 2, speed: 100, pdm: false, vision: false, energy: false });
      const short = r.lines.filter(l => l.cap < l.req);
      return { src: 'Digital twin · what-if engine', html: `I simulated <b>${d}% demand</b> on the twin:<ul><li>With Digital Factory: on-time delivery <b>${pct(Math.min(1, r.otd))}</b></li><li>Without it: <b>${pct(Math.min(1, r0.otd))}</b></li><li>${short.length ? `Bottleneck: <b>${short.map(l => l.name).join(', ')}</b>. A third shift there closes the gap.` : 'No line is short. No extra shift is needed.'}</li></ul><a href="#simulator">Open what-if</a>` };
    }
    if (/quality|defect|yield|fpy|scrap|reject/.test(s)) {
      const top = Object.entries(S.defects).sort((a, b) => b[1] - a[1]), tot = top.reduce((a, [, v]) => a + v, 0);
      const wl = S.lines.slice().sort((a, b) => a.fpyNow - b.fpyNow)[0];
      return { src: 'Vision AI · AOI · functional test', html: `Plant yield is <b>${pct(S.fpy)}</b>. Lowest: <b>${wl.name}</b> (${pct(wl.fpyNow)}).<br>Top defects today: ${top.slice(0, 3).map(([k, v]) => `<b>${k}</b> ${Math.round(v / tot * 100)}%`).join(', ')}.<br>${S.active.solder ? 'The root cause on Line 2 is printer pressure drift. A one-click fix is ready.' : 'Bridges cluster on fine-pitch chips. A stencil review is recommended.'} <a href="#quality">Open quality</a>` };
    }
    if (/energy|power|kw|electric|co2|carbon|bill|heat/.test(s)) {
      return { src: 'EMS · smart meters · weather feed', html: `Plant demand is <b>${fmt(S.kw)} kW</b> (${S.tariff} tariff), <b>${(S.kw / S.tph).toFixed(2)} kWh per unit</b>. Ambient ${S.ambient} °C.<br>Savings already identified: about <b>EGP 80k a month</b> (peak staggering, oven setback during breaks, an air leak). <a href="#energy">Open energy</a>` };
    }
    if (/maint|machine|health|fail|bearing|risk/.test(s)) {
      const ms = Sim.machines().slice().sort((a, b) => Sim.failureRisk(b) - Sim.failureRisk(a)).slice(0, 3);
      return { src: 'IoT sensors · remaining-life model', html: `<b>Machines with the highest failure risk (next 24 h):</b><ul>${ms.map(m => `<li>${m.name} (${Sim.line(m.line).name}): <b>${Math.round(Sim.failureRisk(m) * 100)}%</b>, ${m.state === 'down' ? 'failed' : fmt(Sim.rulHours(m)) + ' h left'}</li>`).join('')}</ul><a href="#maintenance">Open maintenance</a>` };
    }
    return { src: 'copilot', html: 'I can answer questions about output, the plan, alarms, decisions, machines, quality, energy, capacity and the AI agents. For example: <i>“Will we hit the plan?”</i> or <i>“Write the shift handover.”</i>' };
  }
})();
