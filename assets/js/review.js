/* Digital Factory — presentation: review a time window of the live plant.
   Reads the shift recorded by the live plant (assets/js/plant/recorder.js), or builds a sample shift in a worker, and writes
   the three briefing slides for the window you choose: what happened and its numbers, what the AI agents and the people did
   minute by minute, and what changed by a later time (+30 min, +1 h, +2 h, or Play to move the clock forward).
   The "briefing agent" here is rule-based: it filters, de-duplicates and orders the logs and writes the sentences.
   It can also export the briefing as a PowerPoint file (PptxGenJS, loaded only on demand). All plant data is simulated. */
(function () {
  'use strict';
  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));
  const KEYS = { live: 'df-rec-live', sample: 'df-rec-sample', win: 'df-review' };
  const read = k => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } };
  const write = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fmt = n => Math.round(n).toLocaleString('en-US');
  const pct = (v, d = 1) => (v * 100).toFixed(d) + '%';
  const money = n => { const a = Math.abs(n); return (n < 0 ? '−' : '') + (a >= 1e6 ? 'EGP ' + (a / 1e6).toFixed(1) + 'M' : a >= 1e3 ? 'EGP ' + Math.round(a / 1e3) + 'k' : 'EGP ' + Math.round(a)); };
  const pad = n => String(n).padStart(2, '0');
  const hm = t => `${pad(Math.floor(t / 3600) % 24)}:${pad(Math.floor(t / 60) % 60)}`;
  const parseHm = v => { const m = /^(\d{1,2}):(\d{2})/.exec(v || ''); return m ? +m[1] * 3600 + +m[2] * 60 : null; };
  const signed = (v, f) => (v > 0 ? '+' : v < 0 ? '−' : '±') + f(Math.abs(v));
  const durTxt = s => s >= 3600 ? (s % 3600 ? `${(s / 3600).toFixed(1)} hours` : `${s / 3600} hour${s === 3600 ? '' : 's'}`) : `${Math.round(s / 60)} minutes`;

  // the window under review: source recording, from, to, then (end of the follow-up)
  let W = read(KEYS.win) || { source: 'live', from: null, to: null, then: null };
  let R = null, playing = null;
  const saveW = () => write(KEYS.win, W);

  function load() {
    const live = read(KEYS.live), sample = read(KEYS.sample);
    if (W.source === 'live' && !live && sample) W.source = 'sample';
    if (W.source === 'sample' && !sample && live) W.source = 'live';
    R = W.source === 'sample' ? sample : live;
    return R;
  }

  /* ---------- reading the logs ---------- */
  const DRILL = 'Started drill';
  const norm = m => String(m).replace(/\d+([:.,]\d+)*/g, '#').replace(/\s+/g, ' ').trim();
  const inWin = (t, a, b) => t >= a && t <= b;
  function frameAt(t) {
    const F = R.frames; let f = F[0];
    for (const x of F) { if (x.t <= t) f = x; else break; }
    return f;
  }
  function framesIn(a, b) { return R.frames.filter(f => inWin(f.t, a, b)); }
  function dedupe(arr, key) { const seen = new Set(); return arr.filter(x => { const k = key(x); if (seen.has(k)) return false; seen.add(k); return true; }); }
  const human = who => !/agent|\(auto\)/i.test(who);
  const RESULT = /avoided|back in production|restored|rolled back|on hold|shaved|re-flashed|delivered|recovered/i;

  function slice(a, b) {
    const ev = R.events.filter(e => inWin(e.t, a, b));
    const audit = R.audit.filter(e => inWin(e.t, a, b));
    const drills = audit.filter(x => x.action === DRILL);
    const decisions = audit.filter(x => x.action !== DRILL && x.action !== 'Agent autonomy');
    const problems = dedupe(ev.filter(e => (e.level === 'crit' || e.level === 'warn') && e.src !== 'AI'), e => norm(e.src + e.msg));
    const cards = dedupe(R.cards.filter(c => inWin(c.t, a, b)), c => c.key);
    const autos = (R.feed || []).filter(f => inWin(f.t, a, b) && /Acted on my own/.test(f.text));
    const results = dedupe(ev.filter(e => RESULT.test(e.msg)), e => norm(e.msg));
    return { a, b, ev, audit, drills, decisions, problems, cards, autos, results };
  }

  // what the window is about: a drill, else the first critical stop, else the first warning
  function problemOf(S) {
    if (S.drills.length) return { t: S.drills[0].t, text: S.drills[0].detail };
    const crit = S.problems.find(e => e.level === 'crit');
    const p = crit || S.problems[0];
    return p ? { t: p.t, text: `${p.src}: ${p.msg}` } : null;
  }
  // the cards that belong to the problem come first: machine, quality and people decisions before routine logistics
  const cardRank = c => (/^(rul|shot|coat|sw|absent|pba|erp)/.test(c.key) ? 0 : /^agent\.aps/.test(c.key) ? 1 : 2);

  function kpis(a, b) {
    const f0 = frameAt(a), f1 = frameAt(b), fs = framesIn(a, b);
    const avg = k => fs.length ? fs.reduce((s, f) => s + f[k], 0) / fs.length : f1[k];
    return {
      f0, f1, packed: f1.units - f0.units, planned: f1.plan - f0.plan, gap0: f0.units - f0.plan, gap1: f1.units - f1.plan,
      oeeAvg: avg('oee'), prob0: f0.prob, prob1: f1.prob, alarmsPeak: fs.reduce((m, f) => Math.max(m, f.alarms), f0.alarms),
      p1Peak: fs.reduce((m, f) => Math.max(m, f.p1 || 0), 0), saved: f1.saved - f0.saved, revenue: f1.revenue - f0.revenue
    };
  }

  /* ---------- the briefing agent: the story of a window ---------- */
  function story(a, b) {
    const S = slice(a, b), K = kpis(a, b), p = problemOf(S);
    const near = c => (p && c.t >= p.t - 60 ? 0 : 1);
    const cards = S.cards.slice().sort((x, y) => near(x) - near(y) || cardRank(x) - cardRank(y) || x.t - y.t);
    const people = S.decisions.filter(d => human(d.who)), agentActs = S.decisions.filter(d => !human(d.who));
    const head = `${hm(a)}–${hm(b)}: ${p ? p.text.replace(/\.$/, '') : 'a normal stretch of the shift'}.` +
      ` ${people.length ? `${people.length} decision${people.length > 1 ? 's' : ''} by people, ` : ''}${agentActs.length} action${agentActs.length === 1 ? '' : 's'} by agents${K.saved > 0 ? `, ${money(K.saved)} protected` : ''}.`;
    // the narrative: the problem, what the AI saw and recommended, what was decided, what came of it
    const lines = [], at = (t, x) => lines.push({ t, x: `At ${hm(t)} ${x}` });
    if (p) at(p.t, `${p.text.charAt(0).toLowerCase() + p.text.slice(1).replace(/\.$/, '')}.`);
    const firstCrit = p ? null : S.problems.find(e => e.level === 'crit');
    if (firstCrit) at(firstCrit.t, `${firstCrit.src} reported: ${firstCrit.msg.replace(/\.$/, '')}.`);
    for (const c of cards.slice(0, 1)) at(c.t, `the ${c.agent} raised “${c.title.replace(/\.$/, '')}”, simulated ${c.options.length} option${c.options.length === 1 ? '' : 's'} and recommended ${c.best.charAt(0).toLowerCase() + c.best.slice(1)}${c.confidence ? ` (confidence ${Math.round(c.confidence * 100)}%)` : ''}.`);
    for (const d of people.slice(0, 1)) at(d.t, `the ${d.who.toLowerCase() === 'you' ? 'team' : d.who.toLowerCase()} approved: ${d.action.toLowerCase()}, ${d.detail}.`);
    const res = S.results.find(r => /avoided/i.test(r.msg)) || S.results.find(r => !/back in production/i.test(r.msg));
    if (res) at(res.t, `${res.msg.replace(/\.$/, '')}.`);
    lines.sort((x, y) => x.t - y.t);
    if (agentActs.length) lines.push({ x: `On their own, inside their guardrails, the agents took ${agentActs.length} action${agentActs.length > 1 ? 's' : ''}, such as ${agentActs[0].action.toLowerCase()} (${agentActs[0].detail}).` });
    const lead = lines.map(l => l.x).join(' ') + ` Over the window the plant packed ${fmt(K.packed)} TVs against ${fmt(K.planned)} planned; the chance to hit the shift plan moved from ${pct(K.prob0, 0)} to ${pct(K.prob1, 0)}.`;
    const ask = p ? `What happened, minute by minute: ${hm(a)} to ${hm(b)}.` : `The window ${hm(a)} to ${hm(b)}, minute by minute.`;
    return { S, K, p, cards, people, agentActs, head, lead, ask };
  }

  function after(b, c) {
    const S = slice(b + 1, c), K0 = kpis(W.from, b), K = kpis(b, c), f0 = frameAt(b), f1 = frameAt(c);
    const lbl = durTxt(c - b);
    const d = f1.oee - f0.oee;
    const head = `${lbl.charAt(0).toUpperCase() + lbl.slice(1)} later (${hm(c)}): OEE ${pct(f0.oee, 0)} → ${pct(f1.oee, 0)}, chance to hit plan ${pct(f0.prob, 0)} → ${pct(f1.prob, 0)}.`;
    // decisions first, then results; repeated repairs of the same kind collapse into one line
    const reps = S.results.filter(r => /back in production/i.test(r.msg)), other = S.results.filter(r => !/back in production/i.test(r.msg));
    const done = dedupe(S.decisions, d => norm(d.action + d.detail)).sort((x, y) => (human(y.who) - human(x.who)) || x.t - y.t)
      .concat(other.map(r => ({ t: r.t, who: r.src, action: r.msg, detail: '' })))
      .concat(reps.length ? [{ t: reps[reps.length - 1].t, who: 'CMMS', action: `${reps.length} machine${reps.length > 1 ? 's' : ''} back in production after repair`, detail: dedupe(reps.map(r => r.msg.replace(/ back in production.*$/i, '')), x => x).slice(0, 3).join(' · ') + (reps.length > 3 ? ' …' : '') }] : []);
    const openNow = R.cards.filter(cd => cd.t > c - 900 && cd.t <= c).sort((x, y) => cardRank(x) - cardRank(y));
    let rec;
    if (f1.p1) rec = `${f1.p1} priority-1 alarm${f1.p1 > 1 ? 's are' : ' is'} still open at ${hm(c)}. Keep the response running and review again in 30 minutes.`;
    else if (openNow[0]) rec = `The problem from ${hm(W.from)} is handled. The open item now is “${openNow[0].title.replace(/\.$/, '')}”: the ${openNow[0].agent} recommends ${openNow[0].best.charAt(0).toLowerCase() + openNow[0].best.slice(1)}.`;
    else rec = `Nothing needs leadership now. The plant is back inside its limits and the agents keep watching.`;
    if (d < -0.03 && !f1.p1) rec += ` OEE is still ${pct(-d, 0)} points below where it was at ${hm(b)}; the main losses are on ${f1.lines.slice().sort((x, y) => x.oee - y.oee)[0].name}.`;
    const openTxt = f1.alarms ? `${f1.alarms} alarm${f1.alarms > 1 ? 's' : ''} open at ${hm(c)}${f1.p1 ? `, ${f1.p1} of priority 1` : ''}.` : `No alarm is open at ${hm(c)}.`;
    return { S, K, K0, f0, f1, head, done, rec, openTxt, lbl };
  }

  /* ---------- episodes worth reviewing, found in the recording ---------- */
  function episodes() {
    if (!R) return [];
    const out = [];
    const round5 = t => Math.round(t / 300) * 300;
    for (const d of R.audit.filter(x => x.action === DRILL)) out.push({ from: Math.max(R.from, round5(d.t - 120)), to: Math.min(R.to, round5(d.t + 1800)), label: d.detail });
    // the busiest half hour of stops that is not a drill
    const crit = R.events.filter(e => e.level === 'crit' && e.src !== 'AI');
    let best = null;
    for (const e of crit) { const n = crit.filter(x => x.t >= e.t && x.t < e.t + 1800).length; if (!best || n > best.n) best = { t: e.t, n }; }
    if (best && best.n >= 3 && !out.some(o => best.t >= o.from && best.t <= o.to)) out.push({ from: round5(best.t), to: Math.min(R.to, round5(best.t + 1800)), label: `${best.n} stops in 30 minutes` });
    return out.sort((x, y) => x.from - y.from);
  }

  /* ---------- the slides ---------- */
  const set = (k, v, html) => $$(`[data-b="${k}"]`).forEach(el => { html ? (el.innerHTML = v) : (el.textContent = v); });
  const LSTATE = { run: ['Running', 'ok'], idle: ['Running', 'ok'], warn: ['Attention', 'warn'], starved: ['Starved', 'warn'], changeover: ['Changeover', 'warn'], down: ['Stopped', 'bad'], tripped: ['Stopped', 'bad'] };
  const item = (t, b, s, e) => `<li><b>${esc(b)}</b><span>${t != null ? hm(t) + ' · ' : ''}${esc(s || '')}</span>${e ? `<em>${esc(e)}</em>` : ''}</li>`;
  const srcLine = () => `${R.source === 'sample' ? 'Sample shift' : 'Live plant recording'} · simulated plant data`;

  // the moment modes own these texts: keep the originals to give them back when the window review is left
  const ORIG = { heads: $$('[data-id="briefing-actions"] .brief-cols h3').map(h => h.textContent), notes: $$('.brief .sn').map(n => n.textContent) };
  function restore() {
    $$('[data-id="briefing-actions"] .brief-cols h3').forEach((h, i) => { h.textContent = ORIG.heads[i]; });
    $$('.brief .sn').forEach((n, i) => { n.textContent = ORIG.notes[i]; });
    if (playing) { clearInterval(playing); playing = null; }
  }

  function valid() { return R && W.from != null && W.to != null && W.to > W.from; }
  function render() {
    load();
    const ok = valid();
    $$('.brief').forEach(sl => {
      const on = ok && (sl.dataset.id !== 'briefing-after' || (W.then && W.then > W.to));
      sl.querySelector('[data-b-empty]').hidden = on; sl.querySelector('[data-b-full]').hidden = !on;
    });
    if (!ok) return;
    const st = story(W.from, W.to), K = st.K;
    set('stamp', `Review · ${hm(W.from)}–${hm(W.to)} plant time · ${srcLine()}`);
    set('headline', st.head); set('lead', st.lead);
    const cell = (v, l, sub, tone) => `<div class="ro${tone ? ' ' + tone : ''}"><b>${v}</b><span>${l}</span><small>${sub}</small></div>`;
    set('readouts', [
      cell(fmt(K.packed), 'TVs packed', `${signed(K.packed - K.planned, fmt)} against plan`, K.packed >= K.planned ? '' : 'warn'),
      cell(pct(K.oeeAvg), 'Main-line OEE', `${pct(K.f0.oee, 0)} → ${pct(K.f1.oee, 0)}`, K.oeeAvg >= 0.85 ? '' : K.oeeAvg >= 0.7 ? 'warn' : 'bad'),
      cell(pct(K.prob1, 0), 'Chance to hit plan', `from ${pct(K.prob0, 0)} at ${hm(W.from)}`, K.prob1 >= 0.8 ? '' : K.prob1 >= 0.5 ? 'warn' : 'bad'),
      cell(String(K.alarmsPeak), 'Alarms at the peak', K.p1Peak ? `${K.p1Peak} of priority 1` : 'None of priority 1', K.p1Peak ? 'bad' : K.alarmsPeak > 3 ? 'warn' : ''),
      cell(String(st.people.length + st.agentActs.length), 'Decisions taken', `${st.people.length} by people · ${st.agentActs.length} by agents`, ''),
      cell(money(K.saved), 'Value protected', 'by the decisions in the window', '')
    ].join(''), true);
    set('lines', K.f1.lines.map(l => { const [t, k] = LSTATE[l.state] || ['Running', 'ok']; return `<div class="bl"><b>${esc(l.name)}</b><span class="mk ${k}">${t} at ${hm(W.to)}</span><i style="--v:${Math.min(1, l.oee)}"></i><em>OEE ${pct(l.oee, 0)} · ${fmt(l.tph)}/h</em></div>`; }).join(''), true);

    // slide 2: the three columns of the timeline
    const sl2 = $('[data-id="briefing-actions"]');
    sl2.querySelector('[data-b="ask"]').textContent = st.ask;
    const heads = sl2.querySelectorAll('.brief-cols h3');
    heads[0].textContent = 'The problem'; heads[1].textContent = 'What the AI did'; heads[2].textContent = 'What was decided';
    const probItems = (st.S.drills.map(d => ({ t: d.t, b: d.detail, s: 'Drill started', e: '' })))
      .concat(st.S.problems.filter(e => e.level === 'crit').slice(0, 3).map(e => ({ t: e.t, b: e.msg, s: e.src, e: '' })))
      .concat(st.S.problems.filter(e => e.level === 'warn').slice(0, 2).map(e => ({ t: e.t, b: e.msg, s: e.src, e: '' })))
      .sort((x, y) => x.t - y.t).slice(0, 4);
    sl2.querySelector('[data-b="decisions"]').innerHTML = probItems.length ? probItems.map(x => item(x.t, x.b, x.s, x.e)).join('') : '<li class="none">No stop or warning in this window.</li>';
    const aiItems = st.cards.slice(0, 3).map(c => item(c.t, c.title, `${c.agent} · ${c.options.length} option${c.options.length === 1 ? '' : 's'} simulated`, `Recommended: ${c.best}`))
      .concat(st.agentActs.slice(0, st.cards.length > 2 ? 0 : 1).map(d => item(d.t, d.action, d.who, d.detail)));
    sl2.querySelector('[data-b="risks"]').innerHTML = aiItems.length ? aiItems.join('') : '<li class="none">The agents only watched: nothing needed a recommendation.</li>';
    const decided = st.people.slice(0, 4);
    sl2.querySelector('[data-b="rec"]').innerHTML = decided.length ? `<ul class="blist">${decided.map(d => item(d.t, d.action, d.who, d.detail)).join('')}</ul>` : 'No decision by people was needed: the agents handled the window inside their guardrails.';
    const res = st.S.results.filter(r => !/back in production/i.test(r.msg)).slice(0, 2).map(r => `${hm(r.t)} ${r.msg}`);
    const nrep = st.S.results.filter(r => /back in production/i.test(r.msg)).length;
    if (nrep) res.push(`${nrep} machine${nrep > 1 ? 's' : ''} back in production after repair`);
    sl2.querySelector('[data-b="done"]').textContent = res.length ? 'Results: ' + res.join(' · ') + '.' : '';

    // slide 3: some time later
    if (W.then && W.then > W.to) {
      const A = after(W.to, W.then);
      $$('[data-id="briefing-after"] [data-b="stamp"]').forEach(el => { el.textContent = `Then · ${hm(W.to)}–${hm(W.then)} plant time · ${srcLine()}`; });
      set('after-head', A.head);
      const row = (l, x, y) => `<tr><th scope="row">${l}</th><td>${x}</td><td>${y}</td></tr>`;
      set('after-table', `<tr><th></th><th scope="col">${hm(W.to)}</th><th scope="col">${hm(W.then)}</th></tr>` +
        row('TVs against plan', signed(A.f0.units - A.f0.plan, fmt), signed(A.f1.units - A.f1.plan, fmt)) +
        row('Main-line OEE', pct(A.f0.oee, 0), pct(A.f1.oee, 0)) +
        row('Chance to hit plan', pct(A.f0.prob, 0), pct(A.f1.prob, 0)) +
        row('Open alarms', String(A.f0.alarms), String(A.f1.alarms)) +
        row('Value protected today', money(A.f0.saved), money(A.f1.saved)) +
        row('Revenue today', money(A.f0.revenue), money(A.f1.revenue)), true);
      set('after-done', A.done.length ? A.done.slice(0, 4).map(d => item(d.t, d.action, d.who, d.detail)).join('') : '<li class="none">No further action was needed.</li>', true);
      set('after-rec', A.rec); set('after-open', A.openTxt);
    }
    // speaker notes follow the window
    const notes = $$('.brief .sn');
    if (notes[0]) notes[0].textContent = `${st.head} ${st.lead}`;
    if (notes[1]) notes[1].textContent = `Walk left to right: the problem, what the AI saw and recommended, what was decided. ${st.people.length ? 'Name who decided and when.' : 'Point out that no person had to step in.'}`;
    if (notes[2] && W.then > W.to) { const A = after(W.to, W.then); notes[2].textContent = `${A.head} ${A.rec} ${A.openTxt}`; }
    if (window.Deck && /^briefing/.test(Deck.current())) Deck.refresh();
  }

  /* ---------- the panel ---------- */
  function fill() {
    const live = read(KEYS.live), sample = read(KEYS.sample);
    load();
    const sel = $('#rvSource');
    const opt = (v, r, l) => `<option value="${v}"${W.source === v ? ' selected' : ''}${r ? '' : ' disabled'}>${l}${r ? ` · ${hm(r.from)}–${hm(r.to)}` : ' · not recorded yet'}</option>`;
    sel.innerHTML = opt('live', live, 'Live plant') + opt('sample', sample, 'Sample shift');
    $('#rvInfo').textContent = R ? `${R.source === 'sample' ? 'Sample shift' : 'Recorded on the live plant'}: ${hm(R.from)} to ${hm(R.to)} plant time, ${fmt(R.events.length)} events, ${R.cards.length} agent decisions, ${R.audit.length} actions.`
      : 'No recording yet. Open the live plant and let it run (speed 16× covers an hour in four minutes), or build a sample shift.';
    const eps = episodes();
    $('#rvFound').innerHTML = eps.length ? '<span>Problems found:</span>' + eps.map((e, k) => `<button type="button" class="chip-btn" data-ep="${k}">${hm(e.from)}–${hm(e.to)} · ${esc(e.label)}</button>`).join('') : '';
    const ins = [$('#rvFrom'), $('#rvTo')];
    ins.forEach(i => { i.disabled = !R; if (R) { i.min = hm(R.from); i.max = hm(R.to); } });
    if (R && (W.from == null || W.from < R.from || W.from > R.to)) { const e = eps[0]; W.from = e ? e.from : Math.max(R.from, R.to - 1800); W.to = e ? e.to : R.to; W.then = null; }
    if (R) { $('#rvFrom').value = hm(W.from); $('#rvTo').value = hm(W.to); }
    $('#rvThen').textContent = W.then && W.then > W.to ? `${hm(W.to)} → ${hm(W.then)} (${durTxt(W.then - W.to)})` : 'Not set';
    $$('[data-then]').forEach(b => { b.disabled = !R || W.to + +b.dataset.then > R.to + 59; });
    ['#rvShow', '#rvPlay', '#rvPptx'].forEach(s => { $(s).disabled = !valid(); });
    $('#rvPlay').disabled = !valid() || W.to >= R.to;
    $('#rvPlay').textContent = playing ? 'Pause' : 'Play';
    $('#rvPlay').setAttribute('aria-pressed', String(!!playing));
  }
  const apply = () => { saveW(); fill(); render(); };

  $('#rvSource').addEventListener('change', e => { W.source = e.target.value; W.from = W.to = W.then = null; apply(); });
  $('#rvFrom').addEventListener('change', e => { const v = parseHm(e.target.value); if (v != null) { W.from = v; if (W.to <= v) W.to = Math.min(R.to, v + 1800); W.then = null; apply(); } });
  $('#rvTo').addEventListener('change', e => { const v = parseHm(e.target.value); if (v != null && v > W.from) { W.to = Math.min(R.to, v); W.then = null; apply(); } });
  $('#rvFound').addEventListener('click', e => { const b = e.target.closest('[data-ep]'); if (!b) return; const ep = episodes()[+b.dataset.ep]; W.from = ep.from; W.to = ep.to; W.then = null; apply(); });
  $$('[data-then]').forEach(b => b.addEventListener('click', () => { W.then = Math.min(R.to, W.to + +b.dataset.then); apply(); if (window.Deck) Deck.go('briefing-after'); }));
  $('#rvShow').addEventListener('click', () => { Brief.open(false); if (window.Deck) Deck.go('briefing'); });

  // Play: the follow-up clock moves forward fifteen minutes every two seconds, and the third slide follows
  function play() {
    if (playing) { clearInterval(playing); playing = null; fill(); return; }
    if (!W.then || W.then <= W.to) W.then = W.to;
    if (window.Deck) Deck.go('briefing-after');
    playing = setInterval(() => {
      W.then = Math.min(R.to, W.then + 900); saveW(); render(); fill();
      if (W.then >= R.to) { clearInterval(playing); playing = null; fill(); }
    }, 2000);
    fill();
  }
  $('#rvPlay').addEventListener('click', play);

  // a sample shift, built off the main thread from the live-plant model (about half a minute)
  $('#rvBuild').addEventListener('click', () => {
    const b = $('#rvBuild'), prog = $('#rvProg');
    let w;
    try { w = new Worker('assets/js/plant/sample-shift.worker.js'); } catch (err) { $('#rvInfo').textContent = 'This browser cannot build the sample shift from a file: serve the folder or open the published site.'; return; }
    b.disabled = true; prog.hidden = false;
    const bar = prog.querySelector('i'), txt = prog.querySelector('span');
    w.onmessage = e => {
      const m = e.data;
      if (m.progress != null) { bar.style.width = Math.round(m.progress * 100) + '%'; txt.textContent = `Running the plant · ${m.clock}`; }
      if (m.error) { txt.textContent = 'Could not build the sample: ' + m.error; b.disabled = false; w.terminate(); }
      if (m.done) {
        w.terminate(); b.disabled = false; prog.hidden = true;
        if (!write(KEYS.sample, m.rec)) { $('#rvInfo').textContent = 'The sample is too large for this browser\'s storage.'; return; }
        W = { source: 'sample', from: null, to: null, then: null }; apply();
      }
    };
    w.onerror = () => { txt.textContent = 'The sample worker could not start here: serve the folder or open the published site.'; b.disabled = false; };
    w.postMessage({});
  });

  /* ---------- PowerPoint: the briefing slides as an editable file ---------- */
  function loadPptx() {
    if (window.PptxGenJS) return Promise.resolve();
    return new Promise((ok, no) => { const s = document.createElement('script'); s.src = 'assets/vendor/pptxgenjs/pptxgen.bundle.js'; s.onload = ok; s.onerror = no; document.head.append(s); });
  }
  async function exportPptx() {
    if (!valid()) return;
    const btn = $('#rvPptx'); btn.disabled = true; btn.textContent = 'Preparing…';
    try {
      await loadPptx();
      const pp = new PptxGenJS(); pp.layout = 'LAYOUT_WIDE'; pp.title = `Plant EG-01 review ${hm(W.from)}–${hm(W.to)}`;
      const INK = '0F1115', GREY = '4A5160', BLUE = '1428A0', F = 'Inter';
      const st = story(W.from, W.to), K = st.K;
      const base = (s, stamp, head) => {
        s.background = { color: 'F2F4F7' };
        s.addText(stamp, { x: 0.6, y: 0.35, w: 12, h: 0.3, fontFace: F, fontSize: 11, color: GREY });
        s.addText(head, { x: 0.6, y: 0.7, w: 12.1, h: 1.2, fontFace: F, fontSize: 26, bold: true, color: INK, valign: 'top' });
        s.addText('Digital Factory · Plant EG-01 (fictional) · simulated plant data', { x: 0.6, y: 7.05, w: 12, h: 0.3, fontFace: F, fontSize: 9, color: GREY });
      };
      // 1 · what happened
      let s = pp.addSlide();
      base(s, `Review · ${hm(W.from)}–${hm(W.to)} plant time · ${srcLine()}`, st.head);
      s.addText(st.lead, { x: 0.6, y: 1.95, w: 12.1, h: 2.0, fontFace: F, fontSize: 13, color: GREY, valign: 'top' });
      const ro = [[fmt(K.packed), 'TVs packed', `${signed(K.packed - K.planned, fmt)} against plan`], [pct(K.oeeAvg), 'Main-line OEE', `${pct(K.f0.oee, 0)} → ${pct(K.f1.oee, 0)}`], [pct(K.prob1, 0), 'Chance to hit plan', `from ${pct(K.prob0, 0)}`],
        [String(K.alarmsPeak), 'Alarms at the peak', K.p1Peak ? `${K.p1Peak} priority 1` : 'none priority 1'], [String(st.people.length + st.agentActs.length), 'Decisions', `${st.people.length} people · ${st.agentActs.length} agents`], [money(K.saved), 'Value protected', 'in the window']];
      ro.forEach(([v, l, sub], i) => {
        const x = 0.6 + i * 2.05;
        s.addShape(pp.ShapeType.line, { x, y: 4.15, w: 1.85, h: 0, line: { color: INK, width: 1.5 } });
        s.addText([{ text: v + '\n', options: { fontSize: 24, bold: true, color: INK } }, { text: l + '\n', options: { fontSize: 11, bold: true, color: INK } }, { text: sub, options: { fontSize: 9, color: GREY } }], { x, y: 4.25, w: 1.95, h: 1.4, fontFace: F, valign: 'top' });
      });
      s.addNotes(`${st.head}\n\n${st.lead}`);
      // 2 · minute by minute
      s = pp.addSlide();
      base(s, `Review · ${hm(W.from)}–${hm(W.to)} plant time · ${srcLine()}`, st.ask);
      const col = (x, title, rows) => {
        s.addShape(pp.ShapeType.line, { x, y: 1.95, w: 3.9, h: 0, line: { color: INK, width: 1.5 } });
        s.addText(title, { x, y: 2.0, w: 3.9, h: 0.4, fontFace: F, fontSize: 14, bold: true, color: INK });
        s.addText(rows.length ? rows.map(r => ({ text: r, options: { bullet: true, breakLine: true } })) : [{ text: 'Nothing in this window.' }], { x, y: 2.45, w: 3.9, h: 4.4, fontFace: F, fontSize: 11, color: GREY, valign: 'top', paraSpaceAfter: 6 });
      };
      col(0.6, 'The problem', st.S.drills.map(d => `${hm(d.t)} · drill: ${d.detail}`).concat(st.S.problems.slice(0, 4).map(e => `${hm(e.t)} · ${e.src}: ${e.msg}`)).slice(0, 6));
      col(4.75, 'What the AI did', st.cards.slice(0, 4).map(c => `${hm(c.t)} · ${c.agent}: ${c.title}. ${c.options.length} options simulated; recommended ${c.best}.`).concat(st.agentActs.slice(0, 2).map(d => `${hm(d.t)} · ${d.who}: ${d.action}`)));
      col(8.9, 'What was decided', st.people.slice(0, 4).map(d => `${hm(d.t)} · ${d.who}: ${d.action}, ${d.detail}`).concat(st.S.results.slice(0, 2).map(r => `${hm(r.t)} · result: ${r.msg}`)));
      s.addNotes('Walk left to right: the problem, what the AI saw and recommended, what was decided, and the results.');
      // 3 · then
      if (W.then && W.then > W.to) {
        const A = after(W.to, W.then);
        s = pp.addSlide();
        base(s, `Then · ${hm(W.to)}–${hm(W.then)} plant time · ${srcLine()}`, A.head);
        const hdr = { bold: true, color: INK, fill: { color: 'FFFFFF' } };
        s.addTable([[{ text: '', options: hdr }, { text: hm(W.to), options: hdr }, { text: hm(W.then), options: hdr }],
          ['TVs against plan', signed(A.f0.units - A.f0.plan, fmt), signed(A.f1.units - A.f1.plan, fmt)], ['Main-line OEE', pct(A.f0.oee, 0), pct(A.f1.oee, 0)],
          ['Chance to hit plan', pct(A.f0.prob, 0), pct(A.f1.prob, 0)], ['Open alarms', String(A.f0.alarms), String(A.f1.alarms)], ['Value protected today', money(A.f0.saved), money(A.f1.saved)]],
          { x: 0.6, y: 2.0, w: 5.6, fontFace: F, fontSize: 12, color: GREY, border: { type: 'solid', color: 'D2D8E1', pt: 0.75 } });
        s.addText([{ text: 'Done since\n', options: { bold: true, color: INK, fontSize: 14 } }].concat(A.done.slice(0, 6).map(d => ({ text: `${hm(d.t)} · ${d.who}: ${d.action}`, options: { bullet: true, breakLine: true } }))), { x: 6.6, y: 2.0, w: 6.1, h: 2.6, fontFace: F, fontSize: 11, color: GREY, valign: 'top' });
        s.addShape(pp.ShapeType.rect, { x: 6.6, y: 4.75, w: 6.1, h: 2.0, fill: { color: BLUE }, line: { color: BLUE } });
        s.addText([{ text: 'Briefing agent recommends\n', options: { bold: true, fontSize: 12 } }, { text: `${A.rec} ${A.openTxt}`, options: { fontSize: 12 } }], { x: 6.8, y: 4.85, w: 5.7, h: 1.8, fontFace: F, color: 'FFFFFF', valign: 'top' });
        s.addNotes(`${A.head}\n\n${A.rec} ${A.openTxt}`);
      }
      await pp.writeFile({ fileName: `PlantEG-01_review_${hm(W.from).replace(':', '')}-${hm(W.to).replace(':', '')}.pptx` });
    } catch (err) {
      $('#rvInfo').textContent = 'The PowerPoint file could not be made here: ' + (err && err.message ? err.message : err);
    }
    btn.textContent = 'Export PowerPoint'; btn.disabled = !valid();
  }
  $('#rvPptx').addEventListener('click', exportPptx);

  // a recording saved by the live plant in another tab
  addEventListener('storage', e => { if (e.key === KEYS.live || e.key === KEYS.sample) { if (Brief.mode() === 'window') { fill(); render(); } } });

  window.Review = { render, fill, restore, story, after, episodes, exportPptx };
  if (window.Brief && Brief.mode() === 'window') Brief.render();
})();
