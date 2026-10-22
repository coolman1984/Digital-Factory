/* Digital Factory — Autopilot: the plant runs on its own under a lead agent, the Orchestrator. The nine agents keep watching
   their own areas and propose decisions with every option simulated; the Orchestrator sees the whole plant at once, decides
   which problem comes first, weighs the options against plant-wide rules (orders first, safety, reversible when it costs
   little more), takes the decision, says why and on what evidence, and ten plant minutes later checks whether the forecast
   came true. Optionally it brings in real-world disruptions so a guest sees it work. Everything it does is in the audit
   trail as "Orchestrator". Key A switches it. Bilingual: the view follows the page language itself. Simulated data. */
(function () {
  'use strict';
  const DF = window.DF; if (!DF) return;
  const $ = s => document.querySelector(s);
  const ar = () => document.documentElement.lang === 'ar';
  const T = (en, a) => (ar() ? (window.DFI18N && DFI18N.agree ? DFI18N.agree(a) : a) : en);   // Arabic counts agree with what they count (i18n.js)
  const tr = s => (ar() && window.DFI18N && DFI18N.t(s)) || s;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const n0 = v => Math.round(v).toLocaleString('en-US');
  const money = v => (ar() ? `${n0(v)} جنيه` : `EGP ${n0(v)}`);
  const ORDERS_FIRST = 40000;   // EGP: a choice that keeps more orders on time may cost up to this much more
  const UNDO_FIRST = 0.15;      // a reversible option within 15% of the best score is preferred to an irreversible one
  const DRILLS = ['bearing', 'shortshot', 'coating', 'software', 'carton', 'absent', 'field', 'power', 'container'];

  let on = false, inject = true, saved = null, speed0 = 1, lastDecision = 0, lastDrill = 0, drillAt = {};
  const log = [], checks = [], stats = { decisions: 0, protected: 0, verified: 0, kept: 0, drills: 0 };

  /* ---------- seeing the whole plant ---------- */
  function picture() {
    const P = DF.P, A = DF.AG, k = P.kpi;
    const open = [...A.cards.values()].filter(c => !c.decided && !c.autoDone);
    const risks = (P.preds || []).filter(x => !x.covered);
    return { k, open, risks, late: (A.base && A.base.late) || 0, peak: (A.energy && A.energy.peak) || 0, alarms: P.alarms.filter(a => a.prio <= 2 && a.state !== 'ack').length };
  }
  // which problem first: safety, then how urgent, then how much is at stake
  function priority(c) {
    const lvl = c.level === 'crit' ? 100 : c.level === 'warn' ? 50 : 20, safety = c.owner === 'safety' ? 200 : 0;
    const sorted = c.options.slice().sort((a, b) => a.score - b.score), worst = sorted[sorted.length - 1], stake = worst ? (worst.score - sorted[0].score) : 0;
    const m = /in (\d+):(\d+) min|in about (\d+):(\d+) min/.exec(c.title), mins = m ? +(m[1] || m[3]) : 60;
    return { score: safety + lvl + Math.max(0, 60 - mins) + Math.min(80, stake / 2500), mins, stake };
  }
  // the option: the agents' best by score, then the plant-wide rules
  function choose(c) {
    const sorted = c.options.slice().sort((a, b) => a.score - b.score);
    let pick = sorted[0]; const rules = [];
    const minLate = Math.min(...sorted.map(o => o.f.late));
    if (pick.f.late > minLate) {
      const alt = sorted.find(o => o.f.late === minLate);
      if (alt && alt.score - pick.score <= ORDERS_FIRST) { rules.push(T(`Orders first: "${alt.label}" keeps ${pick.f.late - minLate} more order${pick.f.late - minLate > 1 ? 's' : ''} on time for ${money(alt.score - pick.score)} more, inside the ${money(ORDERS_FIRST)} the rule allows.`, `الطلبيات أولًا: «${tr(alt.label)}» يُبقي ${pick.f.late - minLate} طلبية إضافية في موعدها بتكلفة أعلى قدرها ${money(alt.score - pick.score)}، ضمن الحد المسموح ${money(ORDERS_FIRST)}.`)); pick = alt; }
    }
    if (!pick.reversible) {
      const alt = sorted.find(o => o.reversible && o.score <= pick.score * (1 + UNDO_FIRST) + 2000);
      if (alt && alt !== pick) { rules.push(T(`Reversible first: "${alt.label}" can be undone and costs within 15% of "${pick.label}".`, `القابل للتراجع أولًا: «${tr(alt.label)}» يمكن التراجع عنه، وتكلفته في حدود 15% من «${tr(pick.label)}».`)); pick = alt; }
    }
    if (c.owner === 'safety') rules.push(T('Safety first: a safety decision is always taken before any other.', 'السلامة أولًا: يُتخذ قرار السلامة دائمًا قبل أي قرار آخر.'));
    const runner = sorted.find(o => o !== pick);
    return { pick, runner, rules, sorted };
  }

  /* ---------- deciding ---------- */
  function decideNext() {
    const pic = picture(); if (!pic.open.length) return;
    const ranked = pic.open.map(c => ({ c, p: priority(c) })).sort((a, b) => b.p.score - a.p.score);
    const { c, p } = ranked[0];
    const ch = choose(c), op = ch.pick, h = Math.round(c.h / 60) || 2;
    const k = DF.P.kpi, base = c.options.find(o => !o.id) || ch.sorted[ch.sorted.length - 1];
    const d = DF.AG.decide(c, op, 'Orchestrator', 'auto');
    const saved = Math.max(0, (base ? base.score : op.score) - op.score);
    stats.decisions++; stats.protected += saved;
    const e = {
      t: DF.E.clock(DF.P.t), title: c.title, agent: c.agentName, audit: d.audit, label: op.label, conf: c.confidence,
      waiting: ranked.length - 1, others: ranked.slice(1, 3).map(x => x.c.title),
      why1: p, ev: (c.evidence || []).slice(0, 3).map(x => [x.label, x.value]), opts: ch.sorted.slice(0, 4).map(o => ({ label: o.label, packed: o.f.packed, late: o.f.late, cost: o.cost, rev: o.reversible, chosen: o === op })),
      runner: ch.runner && { label: ch.runner.label, dp: op.f.packed - ch.runner.f.packed, late: ch.runner.f.late, cost: ch.runner.cost }, op: { packed: op.f.packed, late: op.f.late, cost: op.cost, rev: op.reversible }, rules: ch.rules, h, saved,
      check: null
    };
    log.unshift(e); if (log.length > 14) log.pop();
    // ten plant minutes on: did the plant run at the rate the forecast promised, and did the problem clear?
    checks.push({ e, key: c.key, t0: DF.P.t, u0: k.units, rate: op.f.packed / Math.max(30, c.h) });
    lastDecision = performance.now();
    DF.refresh(true);
  }
  function verify() {
    const P = DF.P;
    for (let i = checks.length - 1; i >= 0; i--) {
      const x = checks[i]; if (P.t - x.t0 < 600) continue;
      const got = P.kpi.units - x.u0, want = x.rate * (P.t - x.t0) / 60, cleared = !P.recs.some(r => r.key === x.key);
      x.e.check = { got: Math.round(got), want: Math.round(want), ok: got >= want * 0.9, cleared };
      stats.verified++; if (x.e.check.ok) stats.kept++;
      checks.splice(i, 1);
    }
  }
  // real-world disruptions, one at a time, so a guest sees the Orchestrator handle them
  function maybeDrill() {
    if (!inject || performance.now() - lastDrill < 75000 || picture().open.length > 1) return;
    const P = DF.P, done = DF.startedDrills || {};
    const id = DRILLS.find(x => !(done[x] && P.t - done[x] < 3600) && !(drillAt[x] && P.t - drillAt[x] < 3600)); if (!id) return;
    DF.E.trigger(id, 'Orchestrator'); done[id] = drillAt[id] = P.t; lastDrill = performance.now(); stats.drills++;
    const s = DF.E.SCENARIOS.find(x => x.id === id);
    log.unshift({ drill: true, t: DF.E.clock(P.t), title: s ? s.title : id }); if (log.length > 14) log.pop();
  }

  let timer = 0;
  function tick() {
    if (!on) return;
    try { verify(); maybeDrill(); if (performance.now() - lastDecision > 6000) decideNext(); } catch (err) { console.warn('autopilot', err); }
    render();
  }
  function start() {
    if (on) return; on = true;
    const A = DF.AG; saved = A.AGENTS.map(a => [a.id, a.autonomy]);
    // the agents propose and the Orchestrator decides: nobody acts on their own while it leads
    A.AGENTS.forEach(a => { a.autonomy = 'approve'; });
    speed0 = DF.P.paused ? 1 : DF.P.speed || 1; DF.setSpeed(4);
    DF.E.audit('Orchestrator', 'Autopilot on', 'The agents propose, the Orchestrator decides');
    lastDrill = performance.now() - 60000; lastDecision = 0;
    clearInterval(timer); timer = setInterval(tick, 1000);
    paint(); tick();
  }
  function stop() {
    if (!on) return; on = false; clearInterval(timer);
    const A = DF.AG; if (saved) for (const [id, v] of saved) { const a = A.AGENTS.find(x => x.id === id); if (a) a.autonomy = v; }
    DF.setSpeed(speed0 || 1);
    DF.E.audit('Orchestrator', 'Autopilot off', 'Decisions are back with people and the agents\' own autonomy');
    paint(); render();
  }

  /* ---------- the view ---------- */
  const root = $('#autopilot');
  let last = '';
  function tile(v, l, s, cls = '') { return `<div class="ap-t ${cls}"><b>${v}</b><span class="ap-l">${l}</span>${s ? `<small>${s}</small>` : ''}</div>`; }
  function entry(e) {
    if (e.drill) return `<article class="ap-e drill"><p class="ap-when">${e.t} · ${T('Disruption', 'اضطراب')}</p><h3>${esc(tr(e.title))}</h3><p class="ap-why">${T('Brought in on purpose, as in a real shift. The agents see it first; the Orchestrator decides.', 'أُدخل عن قصد كما يحدث في وردية حقيقية. يرصده الوكلاء أولًا، ويقرر الوكيل القائد.')}</p></article>`;
    const r = e.runner, dp = r ? r.dp : 0;
    const why = r ? T(`Chosen over "${r.label}": ${dp >= 0 ? '+' : ''}${n0(dp)} TVs packed in ${e.h} h, ${e.op.late} against ${r.late} late orders, cost ${money(e.op.cost)} against ${money(r.cost)}.`,
      `اختير بدلًا من «${tr(r.label)}»: ${dp >= 0 ? '+' : ''}${n0(dp)} جهازًا معبأ خلال ${e.h} ساعة، و${e.op.late} طلبيات متأخرة مقابل ${r.late}، والتكلفة ${money(e.op.cost)} مقابل ${money(r.cost)}.`) : T('The only option on the table.', 'الخيار الوحيد المتاح.');
    const first = T(`Taken first of ${e.waiting + 1}: ${e.why1.mins === 0 ? 'the impact is already here, ' : e.why1.mins < 60 ? `about ${e.why1.mins} min to impact, ` : ''}${n0(e.why1.stake) !== '0' ? `${money(e.why1.stake)} between the best and worst option` : 'the most urgent on the plant'}.`,
      `أول ما عولج من ${e.waiting + 1}: ${e.why1.mins === 0 ? 'التأثير بدأ بالفعل، و' : e.why1.mins < 60 ? `نحو ${e.why1.mins} دقيقة قبل التأثير، و` : ''}${n0(e.why1.stake) !== '0' ? `${money(e.why1.stake)} بين أفضل خيار وأسوئه` : 'الأكثر إلحاحًا في المصنع'}.`);
    const chk = e.check ? `<p class="ap-chk ${e.check.ok ? 'ok' : 'bad'}"><span class="ap-k">${T('Checked 10 plant minutes later', 'تحقق بعد 10 دقائق من وقت المصنع')}</span>${T(`${n0(e.check.got)} TVs packed against ${n0(e.check.want)} forecast: ${e.check.ok ? 'forecast kept' : 'below forecast, the agents re-plan'}${e.check.cleared ? '; the problem is cleared' : '; the problem is still open'}.`, `${n0(e.check.got)} جهازًا معبأ مقابل ${n0(e.check.want)} في التوقع: ${e.check.ok ? 'تحقق التوقع' : 'أقل من التوقع، ويعيد الوكلاء التخطيط'}${e.check.cleared ? '، وزالت المشكلة' : '، والمشكلة ما زالت مفتوحة'}.`)}</p>` : `<p class="ap-chk wait"><span class="ap-k">${T('Check', 'التحقق')}</span>${T('in 10 plant minutes: did the plant run as the forecast promised?', 'بعد 10 دقائق من وقت المصنع: هل سار المصنع كما وعد التوقع؟')}</p>`;
    return `<article class="ap-e"><p class="ap-when">${e.t} · ${esc(tr(e.agent))} ${T('proposed', 'اقترح')} · ${e.audit}</p>
      <h3>${esc(tr(e.title))}</h3>
      <p class="ap-dec"><span class="ap-k">${T('Decision', 'القرار')}</span><b>${esc(tr(e.label))}</b> · ${T('confidence', 'الثقة')} ${Math.round((e.conf || 0.8) * 100)}%${e.saved ? ` · ${T('protects', 'يحمي')} ${money(e.saved)}` : ''}</p>
      <p class="ap-why"><span class="ap-k">${T('Why this one', 'لماذا هذا القرار')}</span>${esc(why)}${e.rules.map(x => `<br>${esc(x)}`).join('')}</p>
      <p class="ap-why"><span class="ap-k">${T('Why first', 'لماذا أولًا')}</span>${esc(first)}</p>
      <div class="ap-based"><span class="ap-k">${T('Based on', 'بناءً على')}</span><ul>${e.ev.map(([l, v]) => `<li>${esc(tr(l))}: <b>${esc(tr(String(v)))}</b></li>`).join('')}<li>${T(`a forecast of the whole plant for the next ${e.h} h, run for each option`, `توقع للمصنع كله للساعات الـ${e.h} القادمة، شُغّل لكل خيار`)}</li></ul></div>
      <table class="ap-opts"><tr><th>${T('Option', 'الخيار')}</th><th>${T(`TVs in ${e.h} h`, `أجهزة خلال ${e.h} ساعة`)}</th><th>${T('Late orders', 'طلبيات متأخرة')}</th><th>${T('Cost', 'التكلفة')}</th></tr>
        ${e.opts.map(o => `<tr class="${o.chosen ? 'on' : ''}"><td>${o.chosen ? '✓ ' : ''}${esc(tr(o.label))}${o.rev ? '' : ` <small>${T('cannot be undone', 'لا يمكن التراجع')}</small>`}</td><td>${n0(o.packed)}</td><td>${o.late}</td><td>${money(o.cost)}</td></tr>`).join('')}</table>
      ${chk}</article>`;
  }
  function render() {
    if (!root || ($('#view-autopilot') && $('#view-autopilot').hidden)) return;
    const P = DF.P, A = DF.AG, pic = picture(), k = pic.k;
    const behind = (k.units || 0) - (k.plan || 0);
    const crew = A.AGENTS.map(a => { const mine = pic.open.filter(c => c.owner === a.id).length; return `<li class="${mine ? 'busy' : ''}"><b>${esc(tr(a.name))}</b><span>${mine ? T(`${mine} proposal${mine > 1 ? 's' : ''} waiting`, `${mine} اقتراح بانتظار القرار`) : T('watching', 'يراقب')}</span></li>`; }).join('');
    const html = `<div class="ap-head card">
        <div class="ap-intro"><h2 class="h3">${T('Autopilot: the Orchestrator leads the agents', 'التشغيل الذاتي: الوكيل القائد يقود الوكلاء')}</h2>
          <p class="muted">${T('The nine agents watch their areas and propose; the Orchestrator sees the whole plant, chooses which problem comes first, weighs every simulated option against plant-wide rules, decides, explains why, and checks the result ten plant minutes later. Everything is in the audit trail as "Orchestrator".', 'يراقب الوكلاء التسعة مناطقهم ويقترحون، ويرى الوكيل القائد المصنع كله، فيختار أي مشكلة أولًا، ويزن كل خيار محاكى مقابل قواعد المصنع، ويقرر، ويشرح السبب، ثم يتحقق من النتيجة بعد 10 دقائق من وقت المصنع. وكل ما يفعله مسجل في سجل التدقيق باسم «الوكيل القائد».')}</p>
          <p class="ap-rules"><b>${T('Rules it decides by', 'القواعد التي يقرر بها')}</b> ${T(`1 safety first · 2 orders first (up to ${money(ORDERS_FIRST)} more to keep an order on time) · 3 the lowest total cost over the forecast · 4 reversible first when it costs within 15% more`, `1 السلامة أولًا · 2 الطلبيات أولًا (حتى ${money(ORDERS_FIRST)} إضافية لإبقاء طلبية في موعدها) · 3 أقل تكلفة إجمالية على مدى التوقع · 4 القابل للتراجع أولًا إذا كانت تكلفته أعلى بما لا يتجاوز 15%`)}</p></div>
        <div class="ap-ctl">
          <button type="button" class="btn ${on ? 'btn-secondary' : 'btn-primary'}" data-ap="toggle">${on ? T('Stop autopilot', 'أوقف التشغيل الذاتي') : T('Start autopilot', 'ابدأ التشغيل الذاتي')}</button>
          <label class="ap-sw"><input type="checkbox" data-ap="inject" ${inject ? 'checked' : ''}> ${T('Bring in real-world problems', 'أدخل مشكلات واقعية')}</label>
          <p class="quiet small">${on ? T('Running at 4× · key A stops it', 'يعمل بسرعة 4× · المفتاح A يوقفه') : T('Key A starts it. The plant runs at 4×; when it stops, decisions go back to people.', 'المفتاح A يبدؤه. يعمل المصنع بسرعة 4×، وعند الإيقاف تعود القرارات إلى الأفراد.')}</p>
        </div></div>
      <div class="ap-tiles">
        ${tile(n0(k.units || 0), T('TVs packed today', 'أجهزة معبأة اليوم'), T(`${behind >= 0 ? '+' : ''}${n0(behind)} against plan`, `${behind >= 0 ? '+' : ''}${n0(behind)} مقابل الخطة`), behind < -150 ? 'warn' : '')}
        ${tile(((k.oee || 0) * 100).toFixed(1) + '%', T('Main-line OEE', 'فعالية خطوط التجميع'), T('benchmark 85%', 'المعيار 85%'))}
        ${tile(pic.open.length, T('Proposals waiting', 'اقتراحات بانتظار القرار'), T(`${pic.risks.length} risks ahead`, `${pic.risks.length} مخاطر قادمة`), pic.open.length > 2 ? 'warn' : '')}
        ${tile(pic.late, T('Orders forecast late', 'طلبيات متوقع تأخرها'), '', pic.late ? 'bad' : '')}
        ${tile(n0(pic.peak), T('Power peak forecast, kW', 'ذروة القدرة المتوقعة، كيلوواط'), T('contract 4,000 kW', 'التعاقد 4,000 كيلوواط'), pic.peak > 4000 ? 'warn' : '')}
        ${tile(stats.decisions, T('Decisions by the Orchestrator', 'قرارات الوكيل القائد'), T(`${money(stats.protected)} protected · ${stats.kept}/${stats.verified} forecasts kept`, `${money(stats.protected)} محمية · ${stats.kept}/${stats.verified} توقعات تحققت`))}
      </div>
      <div class="ap-grid">
        <section class="card"><div class="card-head"><div><h2 class="h3">${T('How it decided', 'كيف قرر')}</h2><p class="muted small">${T('Newest first: the problem, the decision, why, on what evidence, the options weighed, and the check', 'الأحدث أولًا: المشكلة، والقرار، والسبب، والأدلة، والخيارات التي وُزنت، والتحقق')}</p></div></div>
          <div class="ap-log">${log.length ? log.map(entry).join('') : `<p class="empty">${on ? T('Watching the plant. The first proposal from an agent will appear here with the reasoning.', 'يراقب المصنع. سيظهر هنا أول اقتراح من أحد الوكلاء مع منطق القرار.') : T('Start autopilot to watch the Orchestrator run the plant.', 'ابدأ التشغيل الذاتي لتشاهد الوكيل القائد يدير المصنع.')}</p>`}</div></section>
        <section class="card"><div class="card-head"><div><h2 class="h3">${T('The crew it leads', 'الفريق الذي يقوده')}</h2><p class="muted small">${T('Each agent watches its area and proposes', 'يراقب كل وكيل منطقته ويقترح')}</p></div></div>
          <ul class="ap-crew">${crew}</ul>
          <p class="quiet small">${T('While autopilot runs the agents are set to propose only; their own autonomy comes back when it stops.', 'أثناء التشغيل الذاتي يقتصر دور الوكلاء على الاقتراح، وتعود استقلاليتهم عند الإيقاف.')}</p></section>
      </div>`;
    if (html !== last) { last = html; root.innerHTML = html; }
  }
  function paint() { const b = $('#navAuto'); if (b) { b.hidden = !on; b.textContent = T('on', 'يعمل'); } document.body.classList.toggle('autopilot', on); }
  if (root) root.addEventListener('click', e => { const b = e.target.closest('[data-ap="toggle"]'); if (b) (on ? stop : start)(); });
  if (root) root.addEventListener('change', e => { if (e.target.matches('[data-ap="inject"]')) { inject = e.target.checked; last = ''; render(); } });
  addEventListener('keydown', e => {
    if ((e.key === 'a' || e.key === 'A') && !e.ctrlKey && !e.metaKey && !e.altKey && !/INPUT|TEXTAREA|SELECT/.test(e.target.tagName) && !document.querySelector('dialog[open]')) (on ? stop : start)();
  });
  addEventListener('langchange', () => { last = ''; paint(); render(); });
  DF.onView('autopilot', () => render());
  setInterval(render, 1500);
  DF.autopilot = { start, stop, get on() { return on; }, log, stats };
})();
