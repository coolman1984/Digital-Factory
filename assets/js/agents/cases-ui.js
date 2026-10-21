/* Digital Factory — how an agent case reads on screen (window.CaseUI). Shared by the command room and the live plant.
   A case card: what the agent saw, how sure it is, what it recommends and why, the simulated futures behind it, the
   policy it acts under, and the buttons a person uses to decide. The trace shows every step the agent took. */
(function () {
  'use strict';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const icon = n => (typeof Icons !== 'undefined' ? Icons.get(n) : '');
  const egp = n => (window.Agents ? Agents.egp(n) : 'EGP ' + Math.round(n));
  const sign = n => (n > 0 ? '+' : n < 0 ? '−' : '') + egp(Math.abs(n)).replace(/^−/, '');
  const pct = v => Math.round(v * 100) + '%';
  const STATE = {
    investigating: ['Investigating', 'info'], simulating: ['Simulating futures', 'info'], awaiting: ['Waiting for you', 'warn'], advise: ['Advice for you', 'warn'],
    acting: ['Acting', 'info'], verifying: ['Verifying', 'info'], closed: ['Closed', '']
  };
  const KIND = { observe: ['eye', 'Observed'], tool: ['layers', 'Tool'], think: ['sparkles', 'Reasoned'], memory: ['clock', 'Memory'], handoff: ['users', 'Hand-off'], sim: ['wand', 'Simulated'], decide: ['checkCircle', 'Decided'], orch: ['shield', 'Orchestrator'], act: ['play', 'Acted'], verify: ['check', 'Verified'] };
  const agentName = id => { const a = window.Agents && Agents.agent(id); return a ? a.name : id; };

  function chip(c) {
    const [t, cls] = STATE[c.state] || [c.state, ''];
    return `<span class="cs-chip ${cls}">${c.state === 'simulating' || c.state === 'investigating' ? '<i class="cs-spin"></i>' : ''}${esc(t)}</span>`;
  }
  function spark(values, o = {}) {
    if (!values || values.length < 2) return '';
    const w = o.w || 280, h = o.h || 48;
    let lo = Math.min(...values), hi = Math.max(...values);
    if (o.limit !== undefined) { lo = Math.min(lo, o.limit); hi = Math.max(hi, o.limit); }
    if (hi - lo < 1e-6) { hi += 1; lo -= 1; }
    const pad = (hi - lo) * 0.08; lo -= pad; hi += pad;
    const X = i => (i / (values.length - 1)) * w, Y = v => h - 2 - ((v - lo) / (hi - lo)) * (h - 4);
    const d = values.map((v, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)} ${Y(v).toFixed(1)}`).join('');
    const lim = o.limit !== undefined ? `<line x1="0" x2="${w}" y1="${Y(o.limit).toFixed(1)}" y2="${Y(o.limit).toFixed(1)}" class="lim"/>` : '';
    const lim2 = o.limit2 !== undefined && o.limit2 <= hi ? `<line x1="0" x2="${w}" y1="${Y(o.limit2).toFixed(1)}" y2="${Y(o.limit2).toFixed(1)}" class="lim2"/>` : '';
    return `<svg class="cs-spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true">${lim}${lim2}<path d="${d}"/></svg>`;
  }
  function bars(list) {
    const mx = Math.max(...list.map(b => Math.abs(b.v)), 1e-6);
    return `<ul class="cs-bars">${list.map(b => `<li><span>${esc(b.k)}</span><i style="width:${(Math.abs(b.v) / mx * 100).toFixed(0)}%" class="${b.v < 0 ? 'neg' : ''}"></i><b>${typeof b.v === 'number' ? (Math.abs(b.v) < 1 ? b.v.toFixed(2) : Math.round(b.v)) : esc(b.v)}</b></li>`).join('')}</ul>`;
  }
  function evidence(c) {
    if (!c.evidence || !c.evidence.length) return '';
    return c.evidence.map(e => e.kind === 'series'
      ? `<figure class="cs-ev"><figcaption>${esc(e.label)}</figcaption>${spark(e.values, { limit: e.limit, limit2: e.limit2 })}</figure>`
      : e.kind === 'bars' ? `<figure class="cs-ev"><figcaption>${esc(e.label)}</figcaption>${bars(e.bars)}</figure>` : '').join('');
  }
  // the comparison: every option against doing nothing, across the same simulated futures
  function compareChart(c) {
    const opts = (c.options || []).filter(o => o.series && o.series.t && o.series.t.length > 1);
    if (opts.length < 2) return '';
    const w = 300, h = 92, key = 'packed';
    const all = opts.flatMap(o => o.series[key]);
    let lo = Math.min(...all), hi = Math.max(...all); if (hi - lo < 1) hi = lo + 1;
    const n = opts[0].series.t.length, X = i => (i / (n - 1)) * w, Y = v => h - 14 - ((v - lo) / (hi - lo)) * (h - 22);
    const lines = opts.map((o, j) => `<path class="${o.id === 'none' ? 'base' : o.id === c.recommended ? 'best' : 'alt'}" d="${o.series[key].map((v, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)} ${Y(v).toFixed(1)}`).join('')}"/>`).join('');
    const end = Math.round(opts[0].series.t[n - 1] / 60);
    return `<figure class="cs-cmp"><figcaption>Units packed in the simulated futures · next ${end} min</figcaption><svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true">${lines}<text x="0" y="${h - 2}">now</text><text x="${w}" y="${h - 2}" text-anchor="end">+${end} min</text></svg>
      <p class="cs-cmp-l"><span class="best"><i></i>Recommended</span><span class="alt"><i></i>Other option</span><span class="base"><i></i>Do nothing</span></p></figure>`;
  }
  function optionsTable(c, o = {}) {
    if (!c.options || c.options.length < 2 || !c.options[0].value) return '';
    const base = c.options[0];
    const items = c.options.map(op => {
      const d = op.id === 'none' ? 0 : op.value.mean - base.value.mean;
      const lo = op.id === 'none' ? 0 : op.value.p10 - base.value.mean, hi = op.id === 'none' ? 0 : op.value.p90 - base.value.mean;
      const k = op.k || {};
      const rec = op.id === c.recommended;
      const pick = o.pick && op.id !== 'none' && (c.state === 'awaiting' || c.state === 'advise');
      const title = `${esc(op.label)}${rec ? ' <em>Recommended</em>' : ''}`;
      return `<li class="${rec ? 'rec' : ''} ${op.id === 'none' ? 'base' : ''}">
        <div class="cs-oh">${pick ? `<label><input type="radio" name="opt-${esc(c.id)}" value="${esc(op.id)}" ${rec ? 'checked' : ''}><span>${title}</span></label>` : `<span>${title}</span>`}
          <b class="cs-eff ${d > 0 ? 'pos' : d < 0 ? 'neg' : ''}">${op.id === 'none' ? 'Baseline' : sign(d)}</b></div>
        ${op.why ? `<p class="cs-why2">${esc(op.why)}</p>` : ''}
        <p class="cs-om">${op.id === 'none' ? '' : `<span>P10–P90 ${sign(lo)} to ${sign(hi)}</span><span>Better in ${pct(op.winRate || 0)} of futures</span>`}<span>${Math.round(k.packed || 0)} packed</span><span>${Math.round(k.downMin || 0)} min down</span>${k.lateMin ? `<span>${Math.round(k.lateMin)} min late</span>` : ''}${op.id === 'none' ? '' : `<span class="cs-pol ${op.polMax || ''}">${op.polMax === 'auto' ? 'Auto allowed' : op.polMax === 'approve' ? 'Needs approval' : op.polMax === 'advise' ? 'Advice only' : ''}</span>`}</p>
      </li>`;
    }).join('');
    return `<ol class="cs-opts">${items}</ol>`;
  }
  function trace(c, o = {}) {
    const steps = o.last ? c.steps.slice(-o.last) : c.steps;
    return `<ol class="cs-trace">${steps.map(s => {
      const [ic, lab] = KIND[s.kind] || ['info', s.kind];
      const who = s.kind === 'handoff' ? agentName(s.agent) : s.kind === 'orch' ? 'Plant orchestrator' : '';
      return `<li class="k-${s.kind}"><span class="cs-ic" aria-hidden="true">${icon(ic)}</span><div><p class="cs-st"><b>${esc(lab)}</b>${who ? ` · ${esc(who)}` : ''}<time>${esc(s.time)}</time></p><p class="cs-tt">${s.kind === 'tool' ? `<code>${esc(s.title)}</code>` : esc(s.title)}</p>${s.detail ? `<p class="cs-dd">${esc(s.detail)}</p>` : ''}</div></li>`;
    }).join('')}</ol>`;
  }
  function decideForm(c) {
    if (c.state !== 'awaiting' && c.state !== 'advise') return '';
    const rec = c.options.find(o => o.id === c.recommended);
    return `<form class="cs-dec" data-case="${esc(c.id)}">
      <label class="cs-why"><span>Reason for the record <small>(optional, kept in the ledger)</small></span><input type="text" name="why" maxlength="160" placeholder="${c.state === 'advise' ? 'e.g. Customer agreed by phone' : 'e.g. Shift lead agrees, spares on hand'}"></label>
      <div class="cs-btns"><button type="submit" class="btn btn-primary btn-sm" data-dec="approve">${icon('check')}${c.state === 'advise' ? 'Apply' : 'Approve'}${rec ? ': ' + esc(rec.label) : ''}</button><button type="button" class="btn btn-secondary btn-sm" data-dec="reject">Reject</button></div></form>`;
  }
  function verifyBlock(c) {
    if (!c.decision) return '';
    const o = c.outcome;
    return `<div class="cs-verify ${o ? (o.ok === false ? 'bad' : o.ok ? 'ok' : '') : ''}"><p><b>${c.decision.opt === 'none' ? 'Rejected' : 'Decision'}</b> · ${esc(c.decision.label)} · ${esc(c.decision.by)} · ${esc(c.decision.time)}</p>${c.decision.rationale ? `<p class="quiet">${esc(c.decision.rationale)}</p>` : ''}${o ? `<p>${o.ok === false ? icon('xCircle') : o.ok ? icon('checkCircle') : icon('info')} ${esc(o.verdict)}</p>` : c.state === 'verifying' ? '<p class="quiet">Checking the outcome against the prediction…</p>' : ''}</div>`;
  }
  function confidence(c) {
    if (c.confidence == null && !(c.diagnosis && c.diagnosis.confidence)) return '';
    const v = c.diagnosis && c.diagnosis.confidence != null ? c.diagnosis.confidence : c.confidence;
    return `<span class="cs-conf" title="How sure the agent is about the cause"><i style="--w:${Math.round(v * 100)}%"></i><b>${pct(v)} sure</b></span>`;
  }
  // compact card for lists
  function card(c, o = {}) {
    const rec = c.options && c.options.find(x => x.id === c.recommended);
    const last = c.steps[c.steps.length - 1];
    const gain = rec && c.options[0] && c.options[0].value ? rec.value.mean - c.options[0].value.mean : 0;
    return `<article class="cs-card sev-${esc(c.sev)} st-${esc(c.state)}" data-case="${esc(c.id)}">
      <header><p class="cs-who">${esc(agentName(c.agent))} · ${esc(c.id)} · ${esc(window.PlantEngine.clock(c.created))}</p>${chip(c)}</header>
      <h4><button type="button" class="cs-open" data-open-case="${esc(c.id)}">${esc(c.title)}</button></h4>
      ${c.diagnosis ? `<p class="cs-diag"><b>Cause:</b> ${esc(c.diagnosis.cause)} ${confidence(c)}</p>` : ''}
      ${rec && c.state !== 'closed' ? `<p class="cs-rec"><b>Recommend:</b> ${esc(rec.label)}${gain ? ` · <span class="${gain > 0 ? 'pos' : 'neg'}">${sign(gain)}</span> vs doing nothing` : ''}${c.sim ? ` <small>${c.sim.futures} futures</small>` : ''}</p>` : ''}
      ${c.state === 'closed' && c.outcome ? `<p class="cs-out">${c.outcome.ok === false ? icon('xCircle') : c.outcome.ok ? icon('checkCircle') : icon('info')} ${esc(c.outcome.verdict)}</p>` : ''}
      ${!o.noLast && last && c.state !== 'closed' && c.state !== 'awaiting' ? `<p class="cs-last"><span>${esc((KIND[last.kind] || ['', last.kind])[1])}</span> ${esc(last.title)}</p>` : ''}
      ${o.decide ? decideForm(c) : ''}
    </article>`;
  }
  function detail(c, o = {}) {
    return `<div class="cs-detail" data-case="${esc(c.id)}">
      <p class="cs-who">${esc(agentName(c.agent))} · ${esc(c.id)} · opened ${esc(window.PlantEngine.clock(c.created))} ${chip(c)}</p>
      ${o.noTitle ? '' : `<h3>${esc(c.title)}</h3>`}
      ${c.diagnosis ? `<p class="cs-diag"><b>Cause:</b> ${esc(c.diagnosis.cause)} ${confidence(c)}</p><p class="cs-dtext">${esc(c.diagnosis.text || '')}</p>` : ''}
      ${c.required ? `<p class="cs-req">${icon('shield')} ${esc(c.required)}</p>` : ''}
      ${decideForm(c)}
      ${verifyBlock(c)}
      ${evidence(c)}
      ${c.options && c.options.length > 1 ? `<section class="cs-sec"><h4>Options, played forward on the twin${c.sim ? ` <small>${c.sim.futures} futures · ${Math.round(c.sim.horizon / 60)} min · ${(c.sim.ms / 1000).toFixed(1)} s</small>` : ''}</h4>${optionsTable(c, { pick: true })}${compareChart(c)}<p class="quiet cs-note">EGP figures use the plant's sample cost model: contribution per unit, late-order penalties, energy and demand charges, repair and scrap costs, latent-defect risk.</p></section>` : ''}
      <section class="cs-sec"><h4>How the agent got here <small>${c.steps.length} steps</small></h4>${trace(c)}</section>
    </div>`;
  }
  // wire decisions inside a container (forms rendered by decideForm)
  function bind(root, onChange) {
    root.addEventListener('submit', e => {
      const f = e.target.closest('.cs-dec'); if (!f) return;
      e.preventDefault();
      const id = f.dataset.case, why = f.querySelector('input[name="why"]').value.trim();
      const pick = root.querySelector(`input[name="opt-${CSS.escape(id)}"]:checked`);
      Agents.approve(id, pick ? pick.value : undefined, why);
      if (onChange) onChange('approve', id);
    });
    root.addEventListener('click', e => {
      const b = e.target.closest('[data-dec="reject"]'); if (!b) return;
      const f = b.closest('.cs-dec'); const id = f.dataset.case, why = f.querySelector('input[name="why"]').value.trim();
      Agents.reject(id, why || 'Rejected without a reason');
      if (onChange) onChange('reject', id);
    });
  }
  window.CaseUI = { card, detail, trace, optionsTable, compareChart, evidence, spark, chip, bind, agentName, STATE, KIND, sign };
})();
