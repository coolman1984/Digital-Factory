/* Digital Factory — customer show: one button runs the command room as a presentation. Ten steps, about two minutes: the
   plant live, the mimic, the value stream, a real problem started on purpose, the decision the agents prepare, its evidence and
   options, the approval with its audit ID, the forecast, the value in pounds, then the 3D plant tour. A light picks out the part
   of the screen each step talks about; the caption follows the page language. Keys: S starts or stops, → and ← move,
   Space pauses, Escape ends. The plant is simulated. */
(function () {
  'use strict';
  const DF = window.DF; if (!DF) return;
  const $ = s => document.querySelector(s);
  const ar = () => document.documentElement.lang === 'ar';
  const L = o => (typeof o === 'string' ? o : ar() ? o.ar : o.en);
  const s = (en, a) => ({ en, ar: a });
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const tr = t => (window.DFI18N && DFI18N.ar() && DFI18N.t(t)) || t;
  const card = sel => { const el = $(sel); return el && (el.closest('.card') || el); };
  const open = () => [...DF.AG.cards.values()].filter(c => !c.decided && !c.autoDone);
  let caseKey = null;

  // the problem we start on purpose, and the decision the agents prepare for it
  function startProblem() {
    DF.E.trigger('bearing'); if (DF.startedDrills) DF.startedDrills.bearing = DF.P.t;
    DF.setSpeed(4);
  }
  function findCase() {
    // the plant runs ahead until the Maintenance agent has its decision ready (at most twenty plant minutes)
    const pick = () => open().find(c => /Mounter B/.test(c.title));
    let c = pick();
    for (let n = 0; !c && n < 40; n++) { DF.E.fastForward(30); c = pick(); }
    c = c || open()[0];
    if (c) { caseKey = c.key; DF.refresh(true); }
    return c;
  }

  const STEPS = [
    { view: 'command', at: '#kpis', t: s('Plant EG-01, live', 'المصنع EG-01، مباشرة'),
      b: s('Six main TV lines and every line that feeds them, in one room. These numbers come from the plant every second: TVs packed against plan, the forecast for 14:00, OEE, yield, alarms and the money the decisions saved.',
        'ستة خطوط رئيسية لتجميع التلفزيونات وكل خط يغذيها، في غرفة واحدة. هذه الأرقام تأتي من المصنع كل ثانية: الأجهزة المعبأة مقابل الخطة، وتوقع الساعة 14:00، والفعالية، والعائد، والإنذارات، والمال الذي وفّرته القرارات.') },
    { view: 'command', at: '#floor', t: s('Every machine, store and vehicle', 'كل ماكينة ومخزن ومركبة'),
      b: s('The plant from above. Green runs, amber is slow or waiting for material, red is stopped. The trains and AGVs you see moving carry the parts to the lines right now.',
        'المصنع من أعلى. الأخضر يعمل، والكهرماني بطيء أو ينتظر المواد، والأحمر متوقف. والقطارات والمركبات الذاتية التي تتحرك أمامك تنقل القطع إلى الخطوط الآن.') },
    { view: 'command', at: '#vstream', t: s('From the stores to the truck', 'من المخزن إلى الشاحنة'),
      b: s('The value stream reads the plant left to right. Each step shows its state, its rate and what waits in front of it, so the bottleneck is visible at a glance.',
        'يقرأ مسار القيمة المصنع من البداية إلى النهاية. تُظهر كل خطوة حالتها ومعدلها وما ينتظر أمامها، فيظهر عنق الزجاجة من النظرة الأولى.') },
    { view: 'command', at: '#floor', go: startProblem, dur: 13, t: s('Now a real problem', 'والآن مشكلة حقيقية'),
      b: s('We start one on purpose: the spindle bearing of Mounter B on SMD line 4 begins to wear. Vibration rises. Without AI, the line would stop in the middle of the shift. Watch the agents pick it up.',
        'نبدأ مشكلة عن قصد: يبدأ محمل عمود الدوران في ماكينة التركيب B على خط SMD 4 في التآكل، ويرتفع الاهتزاز. ودون ذكاء اصطناعي كان الخط سيتوقف في منتصف الوردية. تابع الوكلاء وهم يلتقطونها.') },
    { view: 'command', at: '#needs', go: findCase, t: s('A decision, prepared', 'قرار جاهز'),
      b: s('Before anyone asks, the Maintenance agent has simulated every option on a two-hour forecast of the whole plant and put the best one first. A person decides.',
        'قبل أن يسأل أحد، حاكى وكيل الصيانة كل خيار على توقع الساعتين القادمتين للمصنع كله، ووضع أفضلها أولًا. والقرار لشخص.') },
    { view: 'command', at: '#needs', dur: 16, t: s('The evidence and the options', 'الأدلة والخيارات'),
      b: s('Why the agent thinks so, with the numbers, and what each option does to output, orders and cost.', 'لماذا يرى الوكيل ذلك بالأرقام، وماذا يفعل كل خيار بالإنتاج والطلبيات والتكلفة.'),
      extra: () => { const c = caseKey && DF.AG.cards.get(caseKey); return c ? DF.Dec.detail(c) : ''; } },
    { view: 'agents', at: '#ledger', go: () => { const c = caseKey && DF.AG.cards.get(caseKey); if (c && !c.decided && c.best) DF.Dec.decide(c.key, c.options.indexOf(c.best)); DF.refresh(true); },
      t: s('Approved, and on record', 'اعتُمد وسُجّل'),
      b: s('One click carries it out on the plant. It gets an audit ID, who approved it and what the simulation promised, the way a regulated plant traces every change.',
        'نقرة واحدة تنفّذه على المصنع، ويحصل على رقم تدقيق، ومن اعتمده، وما وعدت به المحاكاة، كما يتتبع المصنع المنظَّم كل تغيير.') },
    { view: 'predict', at: '#fcChart', t: s('The next two hours', 'الساعتان القادمتان'),
      b: s('The forecast the agents use, refreshed every minute: TVs packed against plan, with the chance of hitting it. Problems show here before they reach the line.',
        'التوقع الذي يعمل به الوكلاء، ويُحدَّث كل دقيقة: الأجهزة المعبأة مقابل الخطة، مع احتمال تحقيقها. وتظهر المشكلات هنا قبل أن تصل إلى الخط.') },
    { view: 'leadership', at: '#value', t: s('Decided in pounds, not percent', 'القرار بالجنيه لا بالنسبة المئوية'),
      b: s('Revenue shipped, contribution, rework and scrap, and the value the decisions protected today, in a sample cost model of the plant.',
        'الإيرادات المشحونة، والمساهمة، وإعادة التشغيل والهالك، والقيمة التي حمتها القرارات اليوم، وفق نموذج تكلفة توضيحي للمصنع.') },
    { view: 'command', at: '#kpis', dur: 0, last: true, t: s('Walk it in 3D', 'تجوّل فيه بالأبعاد الثلاثة'),
      b: s('The same plant, the same agents, in three dimensions: follow one TV, ride a forklift, watch the cameras. Or ask the copilot anything about what you just saw.',
        'المصنع نفسه والوكلاء أنفسهم بالأبعاد الثلاثة: تابع جهازًا واحدًا، أو اركب رافعة شوكية، أو شاهد الكاميرات. أو اسأل المساعد الذكي أي سؤال عما رأيته.') }
  ];

  /* ---------- the light and the caption ---------- */
  const spot = document.createElement('div'); spot.className = 'sh-spot'; spot.hidden = true; spot.setAttribute('aria-hidden', 'true');
  const cap = document.createElement('section'); cap.className = 'sh-cap'; cap.hidden = true; cap.dataset.noI18n = '';
  cap.setAttribute('role', 'dialog'); cap.setAttribute('aria-live', 'polite'); cap.setAttribute('aria-label', 'Customer show');
  document.body.append(spot, cap);
  let i = -1, timer = 0, paused = false, target = null, raf = 0;

  function place() {
    if (!target || spot.hidden) return;
    const r = target.getBoundingClientRect(), m = 8;
    Object.assign(spot.style, { left: r.left - m + 'px', top: r.top - m + 'px', width: r.width + m * 2 + 'px', height: Math.min(r.height + m * 2, innerHeight - r.top + m) + 'px' });
    // the caption moves to the top when the part it explains sits low on the screen
    cap.classList.toggle('up', r.top + Math.min(r.height, innerHeight) / 2 > innerHeight * 0.52);
  }
  const follow = () => { place(); raf = requestAnimationFrame(follow); };

  function paint() {
    const st = STEPS[i], extra = st.extra ? st.extra() : '';
    cap.dir = ar() ? 'rtl' : 'ltr'; cap.lang = ar() ? 'ar' : 'en';
    const T = (en, a) => (ar() ? a : en);
    cap.innerHTML = `<div class="sh-top"><span class="sh-n">${T('Customer show', 'عرض للعميل')} · ${i + 1} / ${STEPS.length}</span>
        <button type="button" class="sh-x" data-sh="stop" aria-label="${T('End the show', 'أنهِ العرض')}">×</button></div>
      <h2>${esc(L(st.t))}</h2><p>${esc(L(st.b))}</p>
      ${extra ? `<div class="sh-extra">${extra}</div>` : ''}
      ${st.last ? `<div class="sh-end"><a class="btn btn-primary btn-sm" href="plant.html#tour">${T('Open the 3D plant tour', 'افتح جولة المصنع ثلاثي الأبعاد')}</a>
        <button type="button" class="btn btn-secondary btn-sm" data-sh="copilot">${T('Ask the copilot', 'اسأل المساعد الذكي')}</button></div>` : ''}
      <div class="sh-bar"><i style="animation-duration:${st.dur === 0 ? 0 : st.dur || 11}s"></i></div>
      <div class="sh-nav">
        <button type="button" class="btn btn-secondary btn-sm" data-sh="prev" ${i ? '' : 'disabled'}>${T('Back', 'السابق')}</button>
        <button type="button" class="btn btn-secondary btn-sm" data-sh="pause" aria-pressed="${paused}">${paused ? T('Play', 'تشغيل') : T('Pause', 'إيقاف مؤقت')}</button>
        ${st.last ? `<button type="button" class="btn btn-primary btn-sm" data-sh="stop">${T('Finish', 'إنهاء')}</button>` : `<button type="button" class="btn btn-primary btn-sm" data-sh="next">${T('Next', 'التالي')}</button>`}
      </div>`;
    cap.classList.toggle('paused', paused);
    if (typeof Theme !== 'undefined' && Theme.icons) Theme.icons(cap);
  }

  function go(n) {
    clearTimeout(timer);
    i = Math.max(0, Math.min(STEPS.length - 1, n));
    const st = STEPS[i];
    if (DF.view !== st.view) DF.go(st.view);
    // the view draws first, then the step acts on it and the light finds its part
    setTimeout(() => {
      if (i < 0) return;
      try { if (st.go) st.go(); } catch (e) { /* a step that cannot act still shows its caption */ }
      target = card(st.at);
      if (target) target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
      spot.hidden = !target;
      paint();
      if (!paused && st.dur !== 0 && !st.last) timer = setTimeout(() => go(i + 1), (st.dur || 11) * 1000);
    }, DF.view === st.view ? 60 : 450);
  }
  function start() {
    if (i >= 0) return;
    if (window.Copilot && Copilot.close) Copilot.close();
    paused = false; caseKey = null; document.body.classList.add('showing');
    cap.hidden = false; follow(); go(0);
  }
  function stop() {
    clearTimeout(timer); cancelAnimationFrame(raf);
    i = -1; target = null; spot.hidden = true; cap.hidden = true; document.body.classList.remove('showing');
    DF.setSpeed(1);
  }
  function pause(v) { paused = v; clearTimeout(timer); const st = STEPS[i]; paint(); if (!paused && !st.last && st.dur !== 0) timer = setTimeout(() => go(i + 1), (st.dur || 11) * 1000); }

  cap.addEventListener('click', e => {
    const b = e.target.closest('[data-sh]'); if (!b) return;
    const a = b.dataset.sh;
    if (a === 'next') go(i + 1); else if (a === 'prev') go(i - 1); else if (a === 'pause') pause(!paused);
    else if (a === 'copilot') { stop(); if (window.Copilot) Copilot.open(); } else stop();
  });
  // while the show runs its keys come first, so Space pauses the show and not the plant
  addEventListener('keydown', e => {
    if (e.ctrlKey || e.metaKey || e.altKey || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName) || document.querySelector('dialog[open]')) return;
    if (i < 0) { if ((e.key === 's' || e.key === 'S') && !e.repeat) { e.preventDefault(); start(); } return; }
    const k = e.key, rtl = ar();
    if (k === 'Escape' || k === 's' || k === 'S') stop();
    else if (k === (rtl ? 'ArrowLeft' : 'ArrowRight') || k === 'PageDown') go(i + 1);
    else if (k === (rtl ? 'ArrowRight' : 'ArrowLeft') || k === 'PageUp') go(i - 1);
    else if (k === ' ') pause(!paused);
    else return;
    e.preventDefault(); e.stopImmediatePropagation();
  }, true);
  addEventListener('langchange', () => { if (i >= 0) paint(); });
  addEventListener('resize', place);

  const btn = $('#showBtn');
  if (btn) btn.addEventListener('click', () => (i < 0 ? start() : stop()));
  DF.show = { start, stop, go: n => { if (i < 0) start(); go(n); }, get on() { return i >= 0; } };
})();
