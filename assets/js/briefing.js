/* Digital Factory — live briefing, presentation side.
   Builds the two briefing slides from one moment of the command room (written by assets/js/room/briefing.js):
   follow the plant live, or pin a moment so every number stays fixed for the meeting.
   The "briefing agent" is rule-based: it ranks what needs leadership attention and writes the sentences. Simulated data. */
(function () {
  'use strict';
  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));
  const KEYS = { live: 'df-live', moments: 'df-moments', pinned: 'df-pinned', mode: 'df-brief-mode' };
  const read = k => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } };
  const write = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fmt = n => Math.round(n).toLocaleString('en-US');
  const pct = (v, d = 1) => (v * 100).toFixed(d) + '%';
  const money = n => n >= 1e6 ? 'EGP ' + (n / 1e6).toFixed(2) + 'M' : n >= 1e3 ? 'EGP ' + Math.round(n / 1e3) + 'k' : 'EGP ' + Math.round(n);
  const ago = t => { const s = Math.max(0, Math.round((Date.now() - t) / 1000)); return s < 60 ? s + ' s ago' : s < 3600 ? Math.round(s / 60) + ' min ago' : Math.round(s / 3600) + ' h ago'; };
  const when = t => new Date(t).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

  let mode = read(KEYS.mode) || 'pinned';

  /* ---------- the briefing agent: what to say about a moment ---------- */
  function narrate(s) {
    const d = s.decisions || [], inc = s.incidents || [], prob = Math.round(s.fc.prob * 100);
    let head;
    if (inc.length) head = `${inc[0].n} alarms, one cause: ${inc[0].cause.replace(/\.$/, '')}.`;
    else if (d.length) head = `${d.length} decision${d.length > 1 ? 's wait' : ' waits'} for you${s.atRisk ? `, ${money(s.atRisk)} at stake` : ''}.`;
    else if (s.alarms.urgent) head = `${s.alarms.urgent} urgent alarm${s.alarms.urgent > 1 ? 's are' : ' is'} not yet acknowledged.`;
    else if (s.risks && s.risks[0] && s.risks[0].risk >= 0.3) head = `${s.risks[0].name} on ${s.risks[0].line} is wearing: failure risk ${Math.round(s.risks[0].risk * 100)}% in 24 hours.`;
    else head = 'All lines are running inside their limits.';
    head += ` Shift ${s.shift} is ${prob}% likely to hit plan.`;
    const delta = (s.units / Math.max(1, s.plan) - 1) * 100;
    const lead = `Output is ${fmt(s.units)} units against a plan of ${fmt(s.plan)} (${delta >= 0 ? '+' : ''}${delta.toFixed(1)}%). Plant OEE is ${pct(s.oee)}, ${s.oee >= 0.85 ? 'at or above' : 'below'} the 85% benchmark, and first-pass yield is ${pct(s.fpy)}. ` +
      (s.actions ? `The AI agents have taken ${s.actions} action${s.actions > 1 ? 's' : ''} today${s.saved ? ` and saved ${money(s.saved)}` : ''}.` : 'The AI agents are watching; no action was needed yet today.');
    let ask, rec;
    if (d.length) {
      ask = `One decision protects ${money(d[0].risk)}.`;
      rec = `Approve “${d[0].action}”. ${d[0].title}: ${d[0].body}`;
      if (d.length > 1) ask = `${d.length} decisions wait. The first protects ${money(d[0].risk)}.`;
    } else if (inc.length) {
      ask = `An incident is open. The response is already running.`;
      rec = `No approval is needed. The agents grouped the alarm flood into one incident (${inc[0].title}) and dispatched the repair. Watch the restore time against the usual time for this fault.`;
    } else {
      ask = 'Nothing waits for a decision.';
      const top = (s.risks || [])[0];
      rec = top && top.risk >= 0.3
        ? `No approval is needed yet. Watch ${top.name} on ${top.line}: failure risk ${Math.round(top.risk * 100)}% in the next 24 hours. The maintenance agent raises a work order as soon as the trend crosses its limit.`
        : 'Keep the agents on their current autonomy. Every machine is inside its limits; the highest risks are listed in the middle column.';
    }
    return { head, lead, ask, rec };
  }

  /* ---------- which moment the slides show ---------- */
  function current() {
    if (mode === 'live') { const l = read(KEYS.live); return l ? { snap: l, kind: 'live' } : null; }
    const p = read(KEYS.pinned); return p ? { snap: p, kind: 'pinned' } : null;
  }
  function stampOf(c) {
    const s = c.snap;
    return c.kind === 'live'
      ? `Live · following the command room · plant time ${s.clock} · updated ${ago(s.at)} · simulated plant data`
      : `Pinned moment · plant time ${s.clock}, shift ${s.shift} · captured ${when(s.pinnedAt || s.at)} · simulated plant data`;
  }

  // the speaker notes as written in deck.html, kept before any briefing replaces them
  $$('.brief .sn').forEach(x => { x.dataset.orig = x.textContent; });
  const LSTATE = { run: ['Running', 'ok'], attn: ['Attention', 'warn'], down: ['Interrupted', 'bad'] };
  function render() {
    // a time window is written by the review (assets/js/review.js)
    if (mode === 'window') { if (window.Review) Review.render(); return; }
    if (window.Review) Review.restore();
    const c = current();
    $$('.brief').forEach(sl => { const on = !!c && sl.dataset.id !== 'briefing-after'; sl.querySelector('[data-b-empty]').hidden = on; sl.querySelector('[data-b-full]').hidden = !on; });
    if (!c) {
      // nothing pinned: the slides show their explanation, and the notes go back to the written ones
      $$('.brief .sn').forEach(x => { if (x.dataset.orig != null) x.textContent = x.dataset.orig; });
      if (window.Deck && /^briefing/.test(Deck.current())) Deck.refresh();
      return;
    }
    const s = c.snap, n = narrate(s), set = (k, v, html) => $$(`[data-b="${k}"]`).forEach(el => { html ? (el.innerHTML = v) : (el.textContent = v); });
    set('stamp', stampOf(c));
    set('headline', n.head); set('lead', n.lead); set('ask', n.ask); set('rec', n.rec);
    const prob = Math.round(s.fc.prob * 100);
    const cell = (v, l, sub, tone) => `<div class="ro${tone ? ' ' + tone : ''}"><b>${v}</b><span>${l}</span><small>${sub}</small></div>`;
    set('readouts', [
      cell(pct(s.oee), 'Plant OEE', s.oee >= 0.85 ? 'At benchmark (85%+)' : 'Below the 85% benchmark', s.oee >= 0.85 ? '' : s.oee >= 0.75 ? 'warn' : 'bad'),
      cell(fmt(s.units), 'Units today', `Plan ${fmt(s.plan)}`, s.units >= s.plan ? '' : 'warn'),
      cell(prob + '%', 'Chance to hit plan', `P50 ${fmt(s.fc.p50)} at ${s.shiftEnd || '14:00'}`, prob >= 80 ? '' : prob >= 50 ? 'warn' : 'bad'),
      cell(pct(s.fpy), 'First-pass yield', 'AI vision and test', s.fpy > 0.985 ? '' : 'warn'),
      cell(String(s.alarms.open), 'Open alarms', `${s.incidents.length} incident${s.incidents.length === 1 ? '' : 's'} · ${s.alarms.unack} not acknowledged`, s.incidents.length ? 'bad' : s.alarms.urgent ? 'warn' : ''),
      cell(money(s.saved), 'Saved by AI today', s.atRisk ? `${money(s.atRisk)} at stake now` : 'Nothing at stake now', s.atRisk ? 'warn' : '')
    ].join(''), true);
    set('lines', s.lines.map(l => { const [t, k] = LSTATE[l.status]; return `<div class="bl"><b>${esc(l.name)}</b><span class="mk ${k}">${t}</span><i style="--v:${Math.min(1, l.oee)}"></i><em>OEE ${pct(l.oee, 0)} · yield ${pct(l.fpy)} · ${fmt(l.tph)}/h</em></div>`; }).join(''), true);
    set('decisions', (s.decisions.length ? s.decisions.slice(0, 3).map(d => `<li><b>${esc(d.title)}</b><span>${esc(d.agent)} · ${d.risk ? money(d.risk) + ' at stake' : 'no money at stake'}</span><em>${esc(d.action)}</em></li>`).join('') : '<li class="none">No decision is waiting. The agents are handling routine work.</li>'), true);
    const risks = (s.incidents || []).map(i => `<li><b>${esc(i.title)}</b><span>${i.n} alarms grouped · ${Math.round(i.conf * 100)}% confidence</span><em>${esc(i.cause)}</em></li>`)
      .concat(s.risks.slice(0, Math.max(1, 3 - s.incidents.length)).map(m => `<li><b>${esc(m.name)} · ${esc(m.line)}</b><span>Failure risk ${Math.round(m.risk * 100)}% in 24 h</span><em>${m.state === 'down' ? 'Stopped' : (m.rul > 2000 ? 'More than 2,000 h' : fmt(m.rul) + ' h') + ' of useful life left'}</em></li>`));
    set('risks', risks.join(''), true);
    set('done', s.resolved && s.resolved.length ? 'Already handled today: ' + s.resolved.map(r => r.title).join(' · ') + '.' : '');
    // the speaker notes follow the moment too
    const notes = $$('.brief .sn');
    if (notes[0]) notes[0].textContent = `${n.head} ${n.lead} Read the headline first, then the six readouts, then the line with the weakest mark.`;
    if (notes[1]) notes[1].textContent = `${n.ask} ${n.rec}`;
    if (window.Deck && /^briefing/.test(Deck.current())) Deck.refresh();
  }
  // the third briefing slide belongs to the time-window review; in the other modes it keeps its explanation

  /* ---------- the panel ---------- */
  const panel = $('#bpanel'), btn = $('#briefBtn');
  function fill() {
    const live = read(KEYS.live), pinned = read(KEYS.pinned), ring = (read(KEYS.moments) || []).slice().reverse();
    $('#bpLive').textContent = live ? `Plant time ${live.clock} · ${ago(live.at)}` : 'Not running. Read the plant now, or open the command room.';
    $('#bpPinLive').disabled = !live;
    $('#bpPinned').textContent = pinned ? `Plant time ${pinned.clock} · captured ${when(pinned.pinnedAt || pinned.at)}` : 'Nothing pinned yet';
    $('#bpClear').disabled = !pinned;
    const sel = $('#bpMoments');
    sel.innerHTML = `<option value="">${ring.length ? ring.length + ' stored moments' : 'No stored moments yet'}</option>` +
      ring.map((m, k) => `<option value="${k}">${m.clock} · OEE ${pct(m.oee)} · ${m.decisions.length} decision${m.decisions.length === 1 ? '' : 's'}${m.incidents.length ? ' · incident' : ''}</option>`).join('');
    sel.disabled = !ring.length;
    $$('input[name="bpMode"]').forEach(r => { r.checked = r.value === mode; });
    $('#bpMoment').hidden = mode === 'window'; $('#bpWindow').hidden = mode !== 'window';
    if (mode === 'window' && window.Review) Review.fill();
  }
  function open(v) {
    const o = v === undefined ? panel.hidden : v;
    panel.hidden = !o; btn.setAttribute('aria-expanded', String(o));
    if (o) { fill(); $('#bpClose').focus(); } else btn.focus({ preventScroll: true });
  }
  function pin(snap) { write(KEYS.pinned, Object.assign({}, snap, { pinnedAt: Date.now() })); setMode('pinned'); }
  function setMode(m) { mode = m; write(KEYS.mode, m); fill(); render(); }

  // start the embedded command room in the background, wait for its first snapshot, then pin it
  function readNow() {
    const b = $('#bpRead'); b.disabled = true; b.textContent = 'Reading the plant…';
    $$('[data-b-read]').forEach(x => { x.disabled = true; });
    const before = (read(KEYS.live) || {}).at || 0;
    const f = window.Deck && Deck.loadDemo();
    let tries = 0;
    const t = setInterval(() => {
      const l = read(KEYS.live);
      if ((l && l.at > before && Date.now() - l.at < 8000) || ++tries > 40) {
        clearInterval(t); b.disabled = false; b.textContent = 'Read the plant now';
        $$('[data-b-read]').forEach(x => { x.disabled = false; });
        if (l && l.at > before) { pin(l); if (window.Deck && !/^briefing/.test(Deck.current())) Deck.go('briefing'); }
      }
    }, 250);
    return f;
  }

  btn.addEventListener('click', () => open());
  $('#bpClose').addEventListener('click', () => open(false));
  $('#bpPinLive').addEventListener('click', () => { const l = read(KEYS.live); if (l) pin(l); });
  $('#bpMoments').addEventListener('change', e => { const ring = (read(KEYS.moments) || []).slice().reverse(); const m = ring[+e.target.value]; if (m) pin(m); });
  $('#bpClear').addEventListener('click', () => { write(KEYS.pinned, null); fill(); render(); });
  $('#bpRead').addEventListener('click', readNow);
  $('#bpGo').addEventListener('click', () => { open(false); window.Deck && Deck.go('briefing'); });
  $$('input[name="bpMode"]').forEach(r => r.addEventListener('change', () => setMode(r.value)));
  // in the time-window mode the slide buttons open the panel: reading the plant now would leave that mode
  $$('[data-b-read]').forEach(b => b.addEventListener('click', () => (mode === 'window' ? open(true) : readNow())));
  $$('[data-b-open]').forEach(b => b.addEventListener('click', () => open(true)));
  panel.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); open(false); } });
  // keep slide keys away from the panel's own controls
  panel.addEventListener('keydown', e => { if (['ArrowLeft', 'ArrowRight', ' ', 'Enter', 'Home', 'End', 'PageUp', 'PageDown', 'Backspace', 'b', 'B', 't', 'T', 'f', 'F', 'n', 'N'].includes(e.key) && e.target !== panel) e.stopPropagation(); });

  // another tab (the command room) pinned a moment or wrote a newer live snapshot
  addEventListener('storage', e => {
    if (e.key === KEYS.pinned || (e.key === KEYS.live && mode === 'live')) render();
    if (!panel.hidden && Object.values(KEYS).includes(e.key)) fill();
  });
  // the embedded demo shares this tab, so storage events do not fire for it: poll while live
  setInterval(() => { if (mode === 'live') render(); if (!panel.hidden && mode !== 'window') fill(); }, 3000);

  window.Brief = { toggle: () => open(), open, render, narrate, setMode, mode: () => mode };
  render();
})();
