/* Digital Factory — command room views for operators: alarms (ISA-18.2 grouping, shelving, rates) and control
   (every change previewed on forks of the twin before a person confirms it). Simulated data. */
(function () {
  'use strict';
  const { $, $$, esc, fmt, pct, money, signed, link, toRef, html } = DF;
  const PE = window.PlantEngine;
  const T = window.Twin;

  /* ---------------- alarms ---------------- */
  let alFilter = 'all';
  const stat = (v, label, sub, cls = '') => `<div class="stat ${cls}"><b>${v}</b><span>${esc(label)}</span>${sub ? `<small>${sub}</small>` : ''}</div>`;
  DF.stat = stat;
  function alarms() {
    const P = DF.world(), S = P.alarmStats;
    const live = P.alarms.filter(a => !(a.shelvedTo > P.t)), shelved = P.alarms.filter(a => a.shelvedTo > P.t);
    const unack = live.filter(a => a.state === 'active');
    const log = P.alarmLog || [];
    const hi = log.filter(x => x[1] <= 2).length;
    html($('#alKpis'), [
      stat(fmt(live.length), 'Active', `${unack.length} not acknowledged`, unack.some(a => a.prio <= 2) ? 'bad' : live.length ? 'warn' : ''),
      stat(fmt(S.rate10), 'Raised in 10 min', S.flood ? 'Flood: above 10 (ISA-18.2)' : 'Target about 1 · flood above 10', S.flood ? 'bad' : S.rate10 > 5 ? 'warn' : ''),
      stat(fmt(S.raised), 'Raised this shift', `Peak ${fmt(S.peak10)} in 10 min · ${fmt(S.floods)} flood${S.floods === 1 ? '' : 's'}`),
      stat(log.length ? Math.round(hi / log.length * 100) + '%' : '—', 'Priority 1–2 share', 'Guide: about 20% or less', log.length && hi / log.length > 0.3 ? 'warn' : ''),
      stat(fmt(shelved.length), 'Shelved', 'Hidden for 20 min, logged')
    ].join(''));
    // incidents
    const inc = DF.incidents(P);
    html($('#incidents'), inc.length ? inc.map(i => i.open ? `<article class="inc open"><div class="ih"><h3>${esc(i.title)}</h3><span class="n">${i.members.length + 1}<small>alarms</small></span></div>
        <p>First out at ${esc(i.first.time)} in ${esc(i.area || 'the plant')}${i.first.ref ? ' · ' + link(toRef(i.first.ref)) : ''}. ${i.members.length ? `${i.members.length} consequential alarm${i.members.length > 1 ? 's follow' : ' follows'} from it and ${i.members.length > 1 ? 'are' : 'is'} folded here.` : ''}</p>
        ${i.case ? `<p>${link('case:' + i.case.id, i.case.id + ' · ' + i.case.title)}</p>` : ''}
        ${i.members.length ? `<ul>${i.members.slice(0, 8).map(a => `<li>${DF.prio(a)}<span>${esc(a.msg)}</span></li>`).join('')}${i.members.length > 8 ? `<li><span class="muted">and ${i.members.length - 8} more</span></li>` : ''}</ul>` : ''}
        <div class="row-gap" style="margin-top:10px"><button type="button" class="btn btn-secondary btn-sm" data-ack-inc="${esc(i.first.key)}">Acknowledge incident</button></div></article>`
      : `<article class="inc"><div class="ih"><h3>Other alarms</h3><span class="n">${i.members.length}<small>alarms</small></span></div><p>Not linked to a first-out cause.</p></article>`).join('')
      : '<p class="empty">No incidents. When a machine stops, its follow-on alarms fold under it here.</p>');
    // list
    let rows = P.alarms.slice().sort((a, b) => a.prio - b.prio || b.t - a.t);
    if (alFilter === 'p12') rows = rows.filter(a => a.prio <= 2 && !(a.shelvedTo > P.t));
    else if (alFilter === 'unack') rows = rows.filter(a => a.state === 'active' && !(a.shelvedTo > P.t));
    else if (alFilter === 'shelved') rows = rows.filter(a => a.shelvedTo > P.t);
    else rows = rows.filter(a => !(a.shelvedTo > P.t));
    const tb = $('#alarmTable');
    if (!tb.contains(document.activeElement)) html(tb, `<thead><tr><th>Priority</th><th>Raised</th><th>Alarm</th><th>State</th><th class="num"><span class="sr-only">Actions</span></th></tr></thead><tbody>${rows.map(a => `<tr class="${a.state === 'active' ? 'unack' : ''} ${a.shelvedTo > P.t ? 'shelved' : ''}">
        <td>${DF.prio(a)}</td><td class="num">${esc(a.time)}</td><td>${esc(a.msg)}<small>${esc(a.area || '')}${a.tag && a.tag !== a.key ? ' · ' + esc(a.tag) : ''}</small></td>
        <td>${a.shelvedTo > P.t ? `Shelved to ${esc(PE.clock(a.shelvedTo))}` : a.state === 'active' ? '<b>New</b>' : 'Acknowledged'}</td>
        <td><div class="acts">${a.state === 'active' ? `<button type="button" class="btn btn-secondary btn-sm" data-ack="${esc(a.key)}">Acknowledge</button>` : ''}${a.shelvedTo > P.t ? '' : `<button type="button" class="btn btn-ghost btn-sm" data-shelve="${esc(a.key)}">Shelve</button>`}</div></td></tr>`).join('') || '<tr><td colspan="5" class="muted">No alarms in this filter.</td></tr>'}</tbody>`);
    // rate per 10 minutes since the model started
    const t0 = Math.floor((PE.START - 600) / 600) * 600, now = P.t;
    const bins = [];
    for (let t = t0; t <= now; t += 600) bins.push({ t, n: 0 });
    for (const [t] of log) { const i = Math.floor((t - t0) / 600); if (bins[i]) bins[i].n++; }
    Viz.columns($('#alRate'), { label: 'Alarms raised per 10 minutes this shift', height: 170, unit: 'alarms', series: 'raised in 10 min', items: bins.slice(-30).map(b => ({ k: PE.clock(b.t), v: b.n, cls: b.n > 10 ? 'bad' : b.n > 5 ? 'warn' : 'c1' })), rule: { y: 10, label: 'Flood limit 10', cls: 'bad' }, fmt: v => String(Math.round(v)) });
  }
  DF.onView('alarms', alarms);
  document.addEventListener('click', e => {
    const f = e.target.closest('#alarmFilter .seg');
    if (f) { alFilter = f.dataset.f; $$('#alarmFilter .seg').forEach(x => { x.classList.toggle('active', x === f); x.setAttribute('aria-pressed', String(x === f)); }); alarms(); return; }
    // the list is not redrawn while focus is inside it, so release focus before the redraw that shows the new state
    const a = e.target.closest('[data-ack]'); if (a) { a.blur(); T.exec({ type: 'ack', id: a.dataset.ack }).then(() => DF.refresh(true)); return; }
    const s = e.target.closest('[data-shelve]'); if (s) { s.blur(); T.exec({ type: 'shelve', id: s.dataset.shelve }).then(() => { DF.toast('Alarm shelved for 20 minutes and logged', 'info'); DF.refresh(true); }); return; }
    const ai = e.target.closest('[data-ack-inc]');
    if (ai) {
      const P = DF.world(), i = DF.incidents(P).find(x => x.open && x.first.key === ai.dataset.ackInc);
      if (i) Promise.all([i.first, ...i.members].filter(x => x.state === 'active').map(x => T.exec({ type: 'ack', id: x.key }))).then(() => DF.refresh(true));
    }
    if (e.target.closest('#ackAll')) T.exec({ type: 'ackAll' }).then(ok => { if (ok) DF.toast('All alarms acknowledged', 'success'); DF.refresh(true); });
  });

  /* ---------------- control ---------------- */
  // every change: play it forward on forks of the plant against "no change", then a person confirms
  async function preview(cmds, label, horizon = 1800) {
    const res = await T.whatif({ horizon, seeds: 4, options: [{ id: 'none', label: 'No change', cmds: [] }, { id: 'chg', label, cmds }] });
    const b = res.options.find(o => o.id === 'none'), c = res.options.find(o => o.id === 'chg');
    return { res, b, c, d: k => c.S[k].mean - b.S[k].mean, value: c.S.value.mean - b.S.value.mean, win: c.winRate };
  }
  DF.preview = preview;
  const pvHtml = r => `<div class="pv" aria-live="polite">
      <div><b class="${r.d('packed') > 0.5 ? 'pos' : r.d('packed') < -0.5 ? 'neg' : ''}">${signed(r.d('packed'))}</b>units packed</div>
      <div><b class="${r.d('lateMin') < -0.5 ? 'pos' : r.d('lateMin') > 0.5 ? 'neg' : ''}">${signed(r.d('lateMin'))} min</b>order lateness</div>
      <div><b class="${r.value > 500 ? 'pos' : r.value < -500 ? 'neg' : ''}">${signed(r.value, money)}</b>vs no change</div></div>
      <p class="muted small" style="margin:0">Next ${Math.round(r.res.horizon / 60)} min, ${r.res.seeds} futures each, ${(r.res.ms / 1000).toFixed(1)} s · better in ${Math.round(r.win * 100)}% of futures</p>`;

  const ctlState = {};             // line id → { speed, preview, busy }
  function controls() {
    const P = DF.world(), el = $('#controls');
    if (el.contains(document.activeElement) && document.activeElement.type === 'range') return;
    const lines = ['L1', 'L2', 'L3', 'L4', 'L5'].map(id => P.lines[id]);
    const card = L => {
      const s = ctlState[L.id] || (ctlState[L.id] = { speed: Math.round(L.speed * 100) });
      if (!s.dirty) s.speed = Math.round(L.speed * 100);
      return `<article class="card ctrl" data-line="${L.id}">
        <div class="ch"><div><h3>${esc(L.name)}</h3><small>${esc(L.sub)} · OEE ${pct(L.oee)} · ${fmt(L.tph)} / h</small></div>${DF.stChip(L.stopped ? 'stopped' : L.state)}</div>
        <label class="sp"><span>Line speed <b>${s.speed}%</b></span><input type="range" min="80" max="110" step="5" value="${s.speed}" data-speed-line="${L.id}" aria-label="${esc(L.name)} speed"></label>
        <div class="ca">
          <button type="button" class="btn btn-secondary btn-sm" data-preview="${L.id}" ${s.busy ? 'disabled' : ''}>${s.busy ? 'Playing futures…' : 'Preview on the twin'}</button>
          <button type="button" class="btn btn-primary btn-sm" data-apply="${L.id}" ${s.preview && !s.busy ? '' : 'disabled'}>Apply</button>
          <button type="button" class="btn btn-ghost btn-sm" data-startstop="${L.id}">${L.stopped ? 'Start line' : 'Stop line'}</button>
        </div>
        ${s.preview ? pvHtml(s.preview) : `<p class="muted small" style="margin:0">Move the speed, then preview: the twin plays the next 30 minutes with and without the change.</p>`}
      </article>`;
    };
    const U = P.util.assets, held = U[2].defer > P.t || U[4].defer > P.t, pre = P.util.precool && P.util.precool.until > P.t;
    const sup = ctlState.SUP || (ctlState.SUP = {});
    const extra = `<article class="card ctrl" data-line="SUP">
        <div class="ch"><div><h3>Utilities and process</h3><small>${Math.round(P.kpi.kw || 0)} kW now · contract ${P.energy.contract} kW · ${esc(P.energy.tariff)} tariff</small></div></div>
        <div class="ca" style="flex-direction:column;align-items:stretch">
          <button type="button" class="btn btn-secondary btn-sm" data-util="stagger" ${held ? 'disabled' : ''}>${held ? 'Compressor 2 and Chiller 2 held' : 'Hold Compressor 2 and Chiller 2 for 20 min'}</button>
          <button type="button" class="btn btn-secondary btn-sm" data-util="precool" ${pre ? 'disabled' : ''}>${pre ? 'Pre-cooling until ' + esc(PE.clock(P.util.precool.until)) : 'Pre-cool the chillers for 3 h'}</button>
          <button type="button" class="btn btn-secondary btn-sm" data-util="${P.lines.L2.prodOverride ? 'switchBack' : 'switchL2'}">${P.lines.L2.prodOverride ? 'Return SMT Line 2 to power boards' : 'Change SMT Line 2 over to main boards'}</button>
        </div>
        ${sup.busy ? '<p class="muted small" style="margin:0">Playing futures…</p>' : sup.preview ? `<p class="small" style="margin:0"><b>${esc(sup.label)}</b></p>${pvHtml(sup.preview)}<div class="ca"><button type="button" class="btn btn-primary btn-sm" data-util-apply>Apply</button><button type="button" class="btn btn-ghost btn-sm" data-util-clear>Discard</button></div>` : '<p class="muted small" style="margin:0">Choose a change to preview it.</p>'}
      </article>`;
    html(el, lines.map(card).join('') + extra);
  }
  function audit() {
    const P = DF.world(), el = $('#audit');
    html(el, `<thead><tr><th class="num">Time</th><th>Who</th><th>Action</th><th>Detail</th></tr></thead><tbody>${P.audit.slice(0, 40).map(a => `<tr><td class="num">${esc(a.time)}</td><td>${esc(a.who)}</td><td>${esc(a.action)}</td><td>${esc(a.detail || '')}</td></tr>`).join('') || '<tr><td colspan="4" class="muted">No changes yet this shift.</td></tr>'}</tbody>`);
  }
  DF.onView('control', () => { controls(); audit(); });
  document.addEventListener('input', e => {
    const r = e.target.closest('[data-speed-line]'); if (!r) return;
    const s = ctlState[r.dataset.speedLine]; s.speed = +r.value; s.dirty = true; s.preview = null;
    r.closest('.sp').querySelector('b').textContent = r.value + '%';
    const ap = r.closest('.ctrl').querySelector('[data-apply]'); if (ap) ap.disabled = true;
  });
  document.addEventListener('change', e => { const r = e.target.closest('[data-speed-line]'); if (r) setTimeout(() => controls(), 0); });
  document.addEventListener('click', async e => {
    const pv = e.target.closest('[data-preview]');
    if (pv) {
      const id = pv.dataset.preview, s = ctlState[id], L = DF.world().lines[id];
      s.busy = true; controls();
      try { s.preview = await preview([{ type: 'apply', id: `speed:${id}@${(s.speed / 100).toFixed(2)}` }], `${L.name} at ${s.speed}%`); s.cmd = `speed:${id}@${(s.speed / 100).toFixed(2)}`; }
      catch (err) { DF.toast('The preview could not run: ' + err.message, 'error'); }
      s.busy = false; controls(); return;
    }
    const ap = e.target.closest('[data-apply]');
    if (ap) {
      const id = ap.dataset.apply, s = ctlState[id], L = DF.world().lines[id];
      if (!s.preview) return;
      const ok = await DF.confirm({ title: `Set ${L.name} to ${s.speed}%?`, yes: 'Apply change', html: `<p>The twin predicts, over the next 30 minutes:</p>${pvHtml(s.preview)}<p class="muted small">Recorded in the audit trail under your name.</p>` });
      if (!ok) return;
      await T.apply(s.cmd, 'You');
      s.preview = null; s.dirty = false;
      DF.toast(`${L.name} set to ${s.speed}%`, 'success'); controls(); audit(); return;
    }
    const ss = e.target.closest('[data-startstop]');
    if (ss) {
      const id = ss.dataset.startstop, L = DF.world().lines[id];
      if (L.stopped) { await T.apply('start:' + id, 'You'); DF.toast(`${L.name} started`, 'success'); controls(); audit(); return; }
      ss.disabled = true; ss.textContent = 'Playing futures…';
      let r = null; try { r = await preview([{ type: 'apply', id: 'stop:' + id }], `Stop ${L.name}`); } catch (err) { /* shown below without numbers */ }
      const ok = await DF.confirm({ title: `Stop ${L.name}?`, yes: 'Stop the line', html: r ? `<p>Stopping it until someone starts it again, over the next 30 minutes:</p>${pvHtml(r)}` : '<p>The preview could not run.</p>' });
      if (ok) { await T.apply('stop:' + id, 'You'); DF.toast(`${L.name} stopped`, 'warning'); }
      controls(); audit(); return;
    }
    const u = e.target.closest('[data-util]');
    if (u) {
      const id = u.dataset.util, labels = { stagger: 'Hold Compressor 2 and Chiller 2 for 20 min', precool: 'Pre-cool the chillers for 3 h', switchL2: 'Change SMT Line 2 over to main boards', switchBack: 'Return SMT Line 2 to power boards' };
      const sup = ctlState.SUP; sup.busy = true; sup.label = labels[id]; sup.cmd = id + ':x'; controls();
      try { sup.preview = await preview([{ type: 'apply', id: id + ':x' }], labels[id], id === 'precool' ? 3600 : 1800); } catch (err) { DF.toast('The preview could not run: ' + err.message, 'error'); }
      sup.busy = false; controls(); return;
    }
    if (e.target.closest('[data-util-apply]')) {
      const sup = ctlState.SUP;
      const ok = await DF.confirm({ title: sup.label + '?', yes: 'Apply change', html: `${pvHtml(sup.preview)}<p class="muted small">Recorded in the audit trail under your name.</p>` });
      if (ok) { await T.apply(sup.cmd, 'You'); DF.toast(sup.label + ': applied', 'success'); sup.preview = null; }
      controls(); audit(); return;
    }
    if (e.target.closest('[data-util-clear]')) { ctlState.SUP.preview = null; controls(); }
  });
})();
