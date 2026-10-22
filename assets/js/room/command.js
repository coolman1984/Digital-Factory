/* Digital Factory — the command room view: the value stream of Plant EG-01, the decisions that need a person, the
   agents at work, what happens next if nobody acts, the event stream and the orders to ship. Also the decision card
   (DF.Dec) shared by every view: what the agent saw, the options it simulated on the two-hour forecast, what it
   recommends, and the buttons a person uses to decide. Simulated data. */
(function () {
  'use strict';
  const { $, $$, esc, icon, fmt, pct, link, toRef, stChip, SEV, html } = DF;
  const mins = s => DF.E.mins(s), clock = t => DF.E.clock(t);

  /* ================= decision cards ================= */
  const sevOf = l => (l === 'crit' ? 'crit' : l === 'warn' ? 'warn' : 'info');
  function chip(c) {
    const P = DF.P;
    if (c.decided) return `<span class="cs-chip">${esc(c.decided.how === 'person' ? 'Decided' : 'Done by the agent')}</span>`;
    if (c.autoAt && !c.veto && P.t < c.autoAt) return `<span class="cs-chip info">Goes ahead at ${esc(clock(c.autoAt))}</span>`;
    return `<span class="cs-chip warn">Waiting for you</span>`;
  }
  const signed = n => (n > 0 ? '+' : n < 0 ? '−' : '±') + fmt(Math.abs(n));
  function effect(c, op) {
    const b = c.base && c.base.f, f = op.f;
    if (!b || !f) return '';
    const d = f.packed - b.packed, l = f.late - b.late;
    return `<span class="${d > 0 ? 'pos' : d < 0 ? 'neg' : ''}">${signed(d)} TVs</span>${l ? ` · <span class="${l < 0 ? 'pos' : 'neg'}">${signed(l)} late order${Math.abs(l) > 1 ? 's' : ''}</span>` : ''}`;
  }
  // compact card for lists
  function card(c, o = {}) {
    const best = c.best;
    return `<article class="cs-card sev-${sevOf(c.level)}" data-card="${esc(c.key)}">
      <header><p class="cs-who">${esc(c.agentName)} · ${esc(clock(c.at))}</p>${chip(c)}</header>
      <h4><button type="button" class="cs-open" data-open-case="${esc(c.key)}">${esc(c.title)}</button></h4>
      ${best && !c.decided ? `<p class="cs-rec"><b>Recommend:</b> ${esc(best.label)}${best !== c.base ? ` · ${effect(c, best)} vs ${esc(c.base.label.toLowerCase())}` : ''} <small>${c.options.length} options simulated · ${Math.round(c.h / 60)} h</small></p>` : ''}
      ${c.decided ? `<p class="cs-out">${icon('checkCircle')} ${esc(c.decided.label)} · ${esc(c.decided.by)} · ${esc(c.decided.audit)}</p>` : ''}
      ${o.decide && !c.decided ? `<div class="cs-btns">${best ? `<button type="button" class="btn btn-primary btn-sm" data-decide="${esc(c.key)}" data-opt="${c.options.indexOf(best)}">${icon('check')}${best.id ? 'Approve' : esc(best.label)}</button>` : ''}<button type="button" class="btn btn-secondary btn-sm" data-open-case="${esc(c.key)}">Options</button>${c.autoAt && !c.veto ? `<button type="button" class="btn btn-ghost btn-sm" data-veto="${esc(c.key)}">Veto</button>` : ''}</div>` : ''}
    </article>`;
  }
  // the comparison chart: TVs packed over the horizon, every option on the same snapshot
  function compare(c) {
    const ops = c.options.filter(op => op.f && op.f.curve && op.f.curve.length > 1);
    if (ops.length < 2) return '';
    const w = 300, h = 92, all = ops.flatMap(op => op.f.curve);
    let lo = Math.min(...all), hi = Math.max(...all); if (hi - lo < 1) hi = lo + 1;
    const n = ops[0].f.curve.length, X = i => (i / (n - 1)) * w, Y = v => h - 14 - ((v - lo) / (hi - lo)) * (h - 22);
    const lines = ops.map(op => `<path class="${op === c.base ? 'base' : op === c.best ? 'best' : 'alt'}" d="${op.f.curve.map((v, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)} ${Y(v).toFixed(1)}`).join('')}"/>`).join('');
    return `<figure class="cs-cmp"><figcaption>TVs packed in the forecast · next ${Math.round(c.h / 60)} h</figcaption><svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true">${lines}<text x="0" y="${h - 2}">now</text><text x="${w}" y="${h - 2}" text-anchor="end">+${Math.round(c.h / 60)} h</text></svg>
      <p class="cs-cmp-l"><span class="best"><i></i>Recommended</span><span class="alt"><i></i>Other option</span><span class="base"><i></i>${esc(c.base.label)}</span></p></figure>`;
  }
  function options(c, pick) {
    return `<ol class="cs-opts">${c.options.map((op, i) => {
      const rec = op === c.best;
      const title = `${esc(op.label)}${rec ? ' <em>Recommended</em>' : ''}`;
      return `<li class="${rec ? 'rec' : ''} ${op === c.base ? 'base' : ''}">
        <div class="cs-oh">${pick ? `<label><input type="radio" name="opt-${esc(c.key)}" value="${i}" ${rec ? 'checked' : ''}><span>${title}</span></label>` : `<span>${title}</span>`}
          <b class="cs-eff">${op === c.base ? 'Baseline' : effect(c, op)}</b></div>
        ${op.note ? `<p class="cs-why2">${esc(op.note)}</p>` : ''}
        <p class="cs-om"><span>${fmt(op.f.packed)} TVs packed</span><span>${op.f.late} order${op.f.late === 1 ? '' : 's'} late</span>${op.f.revDelayed ? `<span>${esc(DF.X.egp(op.f.revDelayed))} revenue delayed</span>` : ''}${op.f.starvedMin ? `<span>${fmt(op.f.starvedMin)} min short of material</span>` : ''}<span>Cost ${esc(DF.X.egp(op.cost))}</span><span class="cs-pol">${op.reversible ? 'Can be undone' : 'Cannot be undone'}</span></p>
      </li>`;
    }).join('')}</ol>`;
  }
  function evidence(c) {
    const ev = c.evidence || [];
    if (!ev.length) return '';
    return `<dl class="kv cs-kv">${ev.filter(e => !e.series).map(e => `<div><dt>${esc(e.label)}</dt><dd>${esc(e.value)}</dd></div>`).join('')}</dl>`
      + ev.filter(e => e.series && e.series.length > 3).map(e => `<figure class="cs-ev"><figcaption>${esc(e.label)} · ${esc(e.value)}</figcaption>${Viz.spark(e.series, { w: 300, h: 48, limit: e.limit })}</figure>`).join('');
  }
  function detail(c) {
    const P = DF.P;
    return `<div class="cs-detail" data-card="${esc(c.key)}">
      <p class="cs-who">${esc(c.agentName)} · ${esc(c.trigger)} ${chip(c)}</p>
      <p class="cs-diag"><b>Confidence:</b> <span class="cs-conf"><i style="--w:${Math.round(c.confidence * 100)}%"></i><b>${Math.round(c.confidence * 100)}% sure</b></span></p>
      ${c.decided ? `<div class="cs-verify ok"><p><b>Decided</b> · ${esc(c.decided.label)} · ${esc(c.decided.by)} · ${esc(clock(c.decided.t))} · ${esc(c.decided.audit)}</p></div>` : `<form class="cs-dec" data-card="${esc(c.key)}">
        <p class="small">${c.autoAt && !c.veto && P.t < c.autoAt ? `Low risk and reversible: the agent goes ahead with the recommendation at <b>${esc(clock(c.autoAt))}</b> unless you decide or veto.` : 'Choose an option and confirm. It goes to the audit trail with your name.'}</p>
        ${options(c, true)}
        <div class="cs-btns"><button type="submit" class="btn btn-primary btn-sm">${icon('check')}Apply the chosen option</button>${c.autoAt && !c.veto ? `<button type="button" class="btn btn-secondary btn-sm" data-veto="${esc(c.key)}">Veto the automatic step</button>` : ''}</div></form>`}
      ${c.decided ? `<section class="cs-sec"><h4>Options it simulated</h4>${options(c, false)}</section>` : ''}
      ${compare(c)}
      ${c.evidence && c.evidence.length ? `<section class="cs-sec"><h4>What the agent sees</h4>${evidence(c)}</section>` : ''}
      ${c.why && c.why.length ? `<section class="cs-sec"><h4>Why</h4><ul class="cs-why-l">${c.why.map(w => `<li>${esc(w)}</li>`).join('')}</ul></section>` : ''}
      ${c.talk && c.talk.length ? `<section class="cs-sec"><h4>The agents discuss it</h4><ol class="cs-talk">${c.talk.map(t => `<li><b>${esc(t.from)}</b><span>${esc(t.text)}</span></li>`).join('')}</ol></section>` : ''}
      <p class="quiet cs-note">The forecast is a flow model of the six main lines and everything feeding them. Money uses the plant's sample cost model in EGP.</p>
    </div>`;
  }
  function decide(key, i, why) {
    const c = DF.AG.cards.get(key); if (!c || c.decided) return;
    const op = c.options[i]; if (!op) return;
    const d = DF.AG.decide(c, op, 'You');
    DF.toast(`${op.label}: done. Logged as ${d.audit}.`, 'success');
    DF.refresh(true);
  }
  DF.Dec = { card, detail, decide, chip };
  // decisions anywhere in the room
  document.addEventListener('click', e => {
    const d = e.target.closest('[data-decide]');
    if (d) { decide(d.dataset.decide, +d.dataset.opt); return; }
    const v = e.target.closest('[data-veto]');
    if (v) { DF.AG.veto(v.dataset.veto); DF.toast('Vetoed: the agent waits for a person to decide.', 'info'); DF.refresh(true); if (DF.openCase && $('#caseDlg').open) DF.openCase(v.dataset.veto); return; }
    const oc = e.target.closest('[data-open-case]');
    if (oc && DF.openCase) DF.openCase(oc.dataset.openCase);
  });
  document.addEventListener('submit', e => {
    const f = e.target.closest('.cs-dec'); if (!f) return;
    e.preventDefault();
    const key = f.dataset.card, pick = f.querySelector(`input[name="opt-${CSS.escape(key)}"]:checked`);
    decide(key, pick ? +pick.value : 0);
    if ($('#caseDlg').open) $('#caseDlg').close();
  });
  // the cards waiting for a person, most urgent first
  DF.waiting = () => DF.P.recs.map(r => DF.AG.cards.get(r.key)).filter(c => c && !c.decided);

  /* ================= the value stream ================= */
  const RANK = { down: 4, tripped: 4, stopped: 4, maint: 3, changeover: 3, starved: 2, warn: 2, micro: 2, blocked: 1, idle: 1, run: 0 };
  const worst = arr => arr.reduce((w, x) => ((RANK[x] || 0) > (RANK[w] || 0) ? x : w), 'run');
  function vstream() {
    const P = DF.P, E = DF.E, el = $('#vstream'); if (!el) return;
    const lines = k => Object.values(P.lines).filter(L => L.kind === k);
    const sum = (arr, f) => arr.reduce((a, x) => a + f(x), 0);
    const mains = lines('main'), smd = lines('smd'), lcm = lines('lcm'), press = lines('press'), inj = P.lines.INJ.stations;
    const storeLow = Object.values(E.STORE.IMP).concat(Object.values(E.STORE.LOC)).filter(b => E.level(b) / b.cap < 0.12);
    const fleet = P.agvs.concat(P.tuggers, P.forklifts), faults = fleet.filter(v => v.fault);
    const lanes = Object.values(E.STORE.PBA).filter(b => isFinite(b.rw)).sort((a, b) => a.rw - b.rw);
    const lane = lanes[0];
    const test = P.stations.filter(s => /fct|aging|wb|qa/.test(s.kind) && P.lines[s.line].kind === 'main');
    const pack = P.stations.filter(s => /packer|palletizer/.test(s.kind));
    const pick = arr => arr.slice().sort((a, b) => (RANK[b.state] || 0) - (RANK[a.state] || 0))[0];
    const next = P.orders.filter(o => o.state === 'open' || o.state === 'loading').sort((a, b) => a.due - b.due)[0];
    const atRisk = DF.AG.base ? DF.AG.base.lateList.length : 0;
    const bn = mains.filter(L => L.state === 'starved' || L.state === 'down');
    const steps = [
      { ref: 'zone:imp', name: 'Stores', st: storeLow.length ? 'warn' : 'run', num: storeLow.length ? `${storeLow.length} low` : 'OK', sub: 'import warehouse and local-vendor supermarket' },
      { ref: faults.length ? (faults[0].kind === 'agv' ? 'agv:' : faults[0].kind === 'tugger' ? 'tug:' : 'fl:') + faults[0].id : 'tug:' + P.tuggers[0].id, name: 'Milk runs and AGVs', st: faults.length ? 'down' : 'run', num: `${fleet.filter(v => v.path).length} / ${fleet.length}`, sub: faults.length ? `${faults.length} vehicle fault${faults.length > 1 ? 's' : ''}` : 'vehicles moving' },
      { ref: 'zone:smd', name: 'SMD and PBA', st: worst(smd.map(L => L.state)), num: fmt(sum(smd, L => L.tph)), sub: `boards an hour · ${smd.filter(L => L.state === 'run' || L.state === 'warn').length} of 6 lines` },
      { ref: lane ? 'buf:' + lane.id : 'zone:smd', name: 'PBA supermarket', st: lane && lane.rw < 900 ? 'down' : lane && lane.rw < 2700 ? 'warn' : 'run', num: lane ? mins(lane.rw).replace(' min', '') : '—', sub: lane ? `lowest cover · ${lane.code}` : 'boards for the main lines' },
      { ref: 'zone:lcm', name: 'LCM lines', st: worst(lcm.map(L => L.state)), num: fmt(sum(lcm, L => L.tph)), sub: 'panel modules an hour' },
      { ref: 'line:INJ', name: 'Injection', st: worst(inj.filter(s => !s.spare).map(s => s.state)), num: `${inj.filter(s => s.state === 'run' || s.state === 'warn').length} / ${inj.length}`, sub: 'machines moulding' },
      { ref: 'zone:press', name: 'Press and coating', st: worst(press.map(L => L.state)), num: fmt(sum(press, L => L.tph)), sub: 'chassis sets an hour' },
      { ref: 'zone:main', name: 'Main assembly', st: worst(mains.map(L => L.state)), num: fmt(sum(mains, L => L.tph)), sub: `TVs an hour · ${mains.filter(L => L.state === 'run' || L.state === 'warn').length} of 6 lines`, bn: bn.length ? bn.map(L => L.id).join(', ') : '' },
      { ref: 'st:' + pick(test).id, name: 'Test, aging and QA', st: worst(test.map(s => s.state)), num: pct(P.kpi.fpy || 0, 1), sub: 'first-pass yield' },
      { ref: 'st:' + pick(pack).id, name: 'Pack and pallet', st: worst(pack.map(s => s.state)), num: fmt(DF.X.fgQty ? Object.keys(E.MODELS).reduce((a, m) => a + DF.X.fgQty(m), 0) : 0), sub: 'TVs in finished goods' },
      { ref: next ? 'order:' + next.id : 'zone:fg', name: 'Shipping', st: atRisk ? 'warn' : 'run', num: next ? clock(next.due) : '—', sub: next ? `next: ${next.id} · ${fmt(next.qty)} TVs${atRisk ? ` · ${atRisk} at risk` : ''}` : 'no open orders' }
    ];
    html(el, steps.map(s => `<li><button type="button" class="vs-step ${SEV(s.st) === 'bad' ? 'down' : ''} ${s.bn ? 'bn' : ''} ${DF.sel === s.ref ? 'sel' : ''}" data-ref="${esc(s.ref)}"><b>${esc(s.name)}</b>${stChip(s.st)}<span class="num">${esc(s.num)}</span><small>${esc(s.sub)}</small>${s.bn ? `<small class="bnl">Held up: ${esc(s.bn)}</small>` : ''}</button></li>`).join(''));
  }
  DF.vstream = vstream;

  /* ================= needs you, agents at work, what happens next ================= */
  function needs() {
    const el = $('#needs'); if (!el) return;
    const w = DF.waiting();
    const n = $('#needsN'); n.textContent = w.length; n.classList.toggle('on', w.length > 0);
    if (el.contains(document.activeElement) && document.activeElement.closest('.cs-btns')) return;
    html(el, w.length ? w.map(c => card(c, { decide: true })).join('') : '<p class="empty">Nothing waits for you. Nine agents watch every line, store and order and will ask when a decision is yours. Start a drill to see them work.</p>');
    if (typeof Theme !== 'undefined') Theme.icons(el);
  }
  function working() {
    const el = $('#working'); if (!el) return;
    const F = DF.AG.feed.slice(0, 7);
    html(el, F.length ? `<ol class="events small-ev">${F.map(e => `<li class="${esc(e.level)}"><time>${esc(e.time)}</time><span class="src">${esc(e.agent.replace(' agent', ''))}</span><span>${esc(e.text)}${e.ref ? ' ' + link(toRef(e.ref), '›') : ''}</span></li>`).join('')}</ol>` : '<p class="empty">The crew is watching. Start a drill to see an agent detect, simulate and recommend.</p>');
  }
  function nextUp() {
    const el = $('#nextUp'); if (!el) return;
    const P = DF.P;
    const preds = P.preds.slice().sort((a, b) => a.eta - b.eta).slice(0, 6);
    html(el, preds.length ? preds.map(p => `<div class="rw ${p.covered ? '' : p.eta < 600 ? 'bad' : p.eta < 1800 ? 'warn' : ''}"><span>${link(toRef(p.ref), p.text)}</span><span class="v">in ${esc(mins(p.eta))}</span><small>${esc(p.sub)}${p.covered ? ' · repair planned' : ''}</small></div>`).join('')
      : '<p class="empty">No stock-out or failure expected. Every line-side stock has its next milk run or AGV planned and no machine shows a wear trend.</p>');
  }

  /* ================= events and orders ================= */
  let evFilter = 'all';
  function events() {
    const el = $('#events'); if (!el) return;
    const P = DF.P;
    let list = P.events.slice(0, 80);
    if (evFilter === 'warn') list = list.filter(e => e.level === 'warn' || e.level === 'crit');
    if (evFilter === 'agents') list = DF.AG.feed.slice(0, 60).map(e => ({ time: e.time, src: e.agent.replace(' agent', ''), msg: e.text, level: e.level, ref: e.ref }));
    html(el, list.slice(0, 40).map(e => `<li class="${esc(e.level)}"><time>${esc(e.time)}</time><span class="src">${esc(e.src)}</span><span>${esc(e.msg)}${e.ref ? ' ' + link(toRef(e.ref), '›') : ''}</span></li>`).join('') || '<li><span></span><span></span><span class="muted">No events yet.</span></li>');
  }
  $$('#evFilter .seg').forEach(b => {
    b.onclick = () => { evFilter = b.dataset.f; $$('#evFilter .seg').forEach(x => { x.classList.toggle('active', x === b); x.setAttribute('aria-pressed', String(x === b)); }); events(); };
  });
  function orders() {
    const el = $('#orders'); if (!el) return;
    const P = DF.P, M = DF.E.MODELS, late = DF.AG.base ? DF.AG.base.lateList : [];
    const open = P.orders.filter(o => o.state === 'open' || o.state === 'loading').sort((a, b) => a.due - b.due).slice(0, 7);
    const done = P.orders.filter(o => !(o.state === 'open' || o.state === 'loading') && P.t - (o.shippedAt || 0) < 3600).slice(-3).reverse();
    const rows = open.concat(done);
    html(el, `<thead><tr><th>Order</th><th>Customer</th><th class="num">TVs</th><th class="num">Due</th><th class="num">Loaded</th><th>State</th></tr></thead><tbody>${rows.map(o => {
      const st = o.state === 'shipped' ? DF.tag('', 'Shipped') : o.state === 'late' ? DF.tag('bad', 'Shipped late') : o.state === 'partial' ? DF.tag('warn', 'Part-shipped') : late.includes(o.id) ? DF.tag('warn', 'Forecast short') : DF.tag('', o.state === 'loading' ? 'Loading' : 'On time');
      return `<tr><td>${link('order:' + o.id, o.id)}</td><td>${esc(o.customer)}<small>${esc(o.channel || '')}</small></td><td class="num">${fmt(o.qty)}<small>${esc(M[o.model].name)}</small></td><td class="num">${esc(clock(o.due))}</td><td class="num">${o.truck ? `${fmt(o.truck.loaded)}<small>${esc(o.truck.dock.id)}</small>` : o.shipped ? fmt(o.shipped) : '—'}</td><td>${st}</td></tr>`;
    }).join('')}</tbody>`);
  }

  DF.onView('command', force => { DF.renderInspector(force); vstream(); needs(); working(); nextUp(); events(); orders(); });
})();
