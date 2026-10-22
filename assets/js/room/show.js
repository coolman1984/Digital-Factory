/* Digital Factory — customer show: one button runs the command room as a presentation of about four minutes. Nineteen steps
   walk through every screen, each saying what it is and how it helps the guest's plant: the plant live, the mimic, the value
   stream, a real problem started on purpose, the decision the agents prepare, its evidence and approval, alarms, control,
   predictions, root cause, the what-if lab, drills, maintenance, quality, energy and carbon, the lighthouse scorecard, and
   then autopilot: the Orchestrator takes the plant over and keeps running it after the show. A light picks out the part of
   the screen each step talks about; the caption follows the page language. Keys: S starts or stops, → and ← move, Space
   pauses, Escape ends. The plant is simulated. */
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

  // every step: what the screen is (t, b) and how it helps the guest's plant (v)
  const STEPS = [
    { view: 'command', at: '#kpis', t: s('Plant EG-01, live', 'المصنع EG-01، مباشرة'),
      b: s('Six main TV lines and every line that feeds them, in one room. These numbers come from the plant every second: TVs packed against plan, the forecast for 14:00, OEE, yield, alarms and the money the decisions saved.', 'ستة خطوط رئيسية لتجميع التلفزيونات وكل خط يغذيها، في غرفة واحدة. هذه الأرقام تأتي من المصنع كل ثانية: الأجهزة المعبأة مقابل الخطة، وتوقع الساعة 14:00، والفعالية، والعائد، والإنذارات، والمال الذي وفّرته القرارات.'),
      v: s('One version of the truth for the plant manager, the engineers and the operators: no morning report, no arguing about numbers.', 'نسخة واحدة من الحقيقة لمدير المصنع والمهندسين والمشغلين: لا تقرير صباحي ولا خلاف على الأرقام.') },
    { view: 'command', at: '#floor', t: s('Every machine, store and vehicle', 'كل ماكينة ومخزن ومركبة'),
      b: s('The plant from above. Green runs, amber is slow or waiting for material, red is stopped. The trains and AGVs you see moving carry the parts to the lines right now.', 'المصنع من أعلى. الأخضر يعمل، والكهرماني بطيء أو ينتظر المواد، والأحمر متوقف. والقطارات والمركبات الموجهة آليًا التي تتحرك أمامك تنقل القطع إلى الخطوط الآن.'),
      v: s('You see a stop the second it happens and exactly where, instead of hearing about it at the end of the shift.', 'ترى التوقف لحظة حدوثه ومكانه بالضبط، بدلًا من أن تسمع عنه في نهاية الوردية.') },
    { view: 'command', at: '#vstream', t: s('From the stores to the truck', 'من المخزن إلى الشاحنة'),
      b: s('The value stream reads the plant left to right. Each step shows its state, its rate and what waits in front of it.', 'يقرأ مسار القيمة المصنع من البداية إلى النهاية، وتُظهر كل خطوة حالتها ومعدلها وما ينتظر أمامها.'),
      v: s('The bottleneck is visible at a glance, so improvement money goes where it raises output.', 'يظهر عنق الزجاجة من النظرة الأولى، فتذهب أموال التحسين إلى حيث ترفع الإنتاج.') },
    { view: 'command', at: '#floor', go: startProblem, dur: 13, t: s('Now a real problem', 'والآن مشكلة حقيقية'),
      b: s('We start one on purpose: the spindle bearing of Mounter B on SMD line 4 begins to wear. Vibration rises. Watch the agents pick it up.', 'نبدأ مشكلة عن قصد: يبدأ محمل عمود الدوران في ماكينة التركيب B على خط SMD 4 في التآكل، ويرتفع الاهتزاز. تابع الوكلاء وهم يلتقطونها.'),
      v: s('Without AI this line would stop in the middle of the shift; here it is caught while it is still cheap to fix.', 'دون ذكاء اصطناعي كان هذا الخط سيتوقف في منتصف الوردية، وهنا تُكتشف المشكلة وإصلاحها ما زال رخيصًا.') },
    { view: 'command', at: '#needs', go: findCase, t: s('A decision, prepared', 'قرار جاهز'),
      b: s('Before anyone asks, the Maintenance agent has simulated every option on a two-hour forecast of the whole plant and put the best one first.', 'قبل أن يسأل أحد، حاكى وكيل الصيانة كل خيار على توقع الساعتين القادمتين للمصنع كله، ووضع أفضلها أولًا.'),
      v: s('Hours of analysis by engineers become seconds; your people decide instead of searching.', 'ساعات من تحليل المهندسين تصبح ثواني، ويتفرغ فريقك للقرار بدلًا من البحث.') },
    { view: 'command', at: '#needs', dur: 16, t: s('The evidence and the options', 'الأدلة والخيارات'),
      b: s('Why the agent thinks so, with the numbers, and what each option does to output, orders and cost.', 'لماذا يرى الوكيل ذلك بالأرقام، وماذا يفعل كل خيار بالإنتاج والطلبيات والتكلفة.'),
      v: s('Every decision is made on evidence you can check, not on who speaks loudest in the meeting.', 'يُتخذ كل قرار على أدلة يمكنك فحصها، لا على من يرفع صوته في الاجتماع.'),
      extra: () => { const c = caseKey && DF.AG.cards.get(caseKey); return c ? DF.Dec.detail(c) : ''; } },
    { view: 'agents', at: '#ledger', go: () => { const c = caseKey && DF.AG.cards.get(caseKey); if (c && !c.decided && c.best) DF.Dec.decide(c.key, c.options.indexOf(c.best)); DF.refresh(true); },
      t: s('Approved, and on record', 'اعتُمد وسُجّل'),
      b: s('One click carries it out on the plant. It gets an audit ID, who approved it and what the simulation promised.', 'نقرة واحدة تنفّذه على المصنع، ويحصل على رقم تدقيق، ومن اعتمده، وما وعدت به المحاكاة.'),
      v: s('Full traceability for auditors and customers, and the agents learn which decisions worked.', 'تتبع كامل للمدققين والعملاء، ويتعلم الوكلاء أي القرارات نجحت.') },
    { view: 'alarms', at: '#alarmTable', t: s('Alarms that mean something', 'إنذارات لها معنى'),
      b: s('Alarms ranked by priority the ISA-18.2 way, grouped by area, with the first cause on top. Spoken alerts can read the urgent ones out loud.', 'إنذارات مرتبة حسب الأولوية وفق ISA-18.2، ومجمعة حسب المنطقة، والسبب الأول في الأعلى. ويمكن للتنبيه الصوتي أن ينطق العاجل منها.'),
      v: s('Operators stop drowning in alarm floods and act on the one that matters first.', 'لا يغرق المشغلون في سيل الإنذارات، ويتصرفون في الأهم أولًا.') },
    { view: 'control', at: '#controls', t: s('Control, with a safety net', 'التحكم مع شبكة أمان'),
      b: s('Stop, start, speed and lockout on any machine, each checked against its interlocks and simulated on the forecast before you confirm.', 'إيقاف وتشغيل وسرعة وعزل لأي ماكينة، وكل أمر يُتحقق من أقفاله البينية ويُحاكى على التوقع قبل أن تؤكد.'),
      v: s('Changes on the floor are safe and their cost is known before anyone presses the button.', 'التغييرات في أرض المصنع آمنة، وتكلفتها معروفة قبل أن يضغط أحد الزر.') },
    { view: 'predict', at: '#fcChart', t: s('The next two hours', 'الساعتان القادمتان'),
      b: s('The forecast the agents use, refreshed every minute: TVs packed against plan, the chance of hitting it, stock-outs and failures ahead.', 'التوقع الذي يعمل به الوكلاء، ويُحدَّث كل دقيقة: الأجهزة المعبأة مقابل الخطة، واحتمال تحقيقها، وحالات النفاد والأعطال القادمة.'),
      v: s('Problems show here before they reach the line, so the plan is protected instead of rescued.', 'تظهر المشكلات هنا قبل أن تصل إلى الخط، فتُحمى الخطة بدلًا من إنقاذها.') },
    { view: 'rootcause', at: '#rcPath', t: s('From symptom to first cause', 'من العَرَض إلى السبب الأول'),
      b: s('The cause path, the genealogy of any TV or board, SPC charts and the 8D reports, linked together.', 'مسار السبب، وسجل نسب أي جهاز أو لوحة، وخرائط الضبط الإحصائي، وتقارير 8D، كلها مترابطة.'),
      v: s('Find the cause in minutes and hold only the lots that are really affected, not the whole warehouse.', 'اعرف السبب في دقائق، وأوقف الدفعات المتأثرة فعلًا فقط، لا المستودع كله.') },
    { view: 'simulator', at: '#labOpts', t: s('Try it before you do it', 'جرّب قبل أن تنفّذ'),
      b: s('The What-if lab runs your idea on a copy of the live plant and compares it with the plan.', 'يشغّل مختبر ماذا لو فكرتك على نسخة من المصنع الحي ويقارنها بالخطة.'),
      v: s('Speed changes, overtime or a new sequence are tested with zero risk to real production.', 'تُختبر تغييرات السرعة أو العمل الإضافي أو التسلسل الجديد دون أي خطر على الإنتاج الحقيقي.') },
    { view: 'scenarios', at: '#scenarios', t: s('Drills for the real world', 'تمارين للعالم الحقيقي'),
      b: s('Nine disruptions you can start on purpose: a held container, a faulty firmware, absent operators, a voltage dip.', 'تسعة اضطرابات تبدأها عن قصد: حاوية محتجزة، وبرمجيات معيبة، ومشغلون غائبون، وانخفاض في الجهد.'),
      v: s('Your team rehearses the bad day before it comes, and you see how the plant responds.', 'يتدرب فريقك على اليوم الصعب قبل أن يأتي، وترى كيف يستجيب المصنع.') },
    { view: 'maintenance', at: '#machines', t: s('Maintenance that predicts', 'صيانة تتنبأ'),
      b: s('Machine health ranked by risk, vibration trends, technicians and their work orders.', 'صحة الماكينات مرتبة حسب الخطر، واتجاهات الاهتزاز، والفنيون وأوامر عملهم.'),
      v: s('Repairs happen on your schedule, not when the machine decides; fewer breakdowns, fewer spare parts rushed in.', 'يتم الإصلاح في موعدك لا عندما تقرر الماكينة: أعطال أقل وقطع غيار عاجلة أقل.') },
    { view: 'quality', at: '#pchart', t: s('Quality before the defect', 'الجودة قبل العيب'),
      b: s('SPC with Nelson rules on the process signals, defects by code and station, holds and rework.', 'ضبط إحصائي بقواعد نيلسون على إشارات العملية، والعيوب حسب الرمز والمحطة، والإيقافات وإعادة التشغيل.'),
      v: s('A drifting process is caught before it makes scrap, and escapes to customers fall.', 'تُكتشف العملية المنحرفة قبل أن تنتج هالكًا، ويقل ما يتسرب إلى العملاء.') },
    { view: 'energy', at: '#kwChart', t: s('Energy and carbon', 'الطاقة والكربون'),
      b: s('Plant power against the 4,000 kW contract, the peak forecast, and energy and carbon per TV.', 'قدرة المصنع مقابل التعاقد البالغ 4,000 كيلوواط، والذروة المتوقعة، والطاقة والكربون لكل جهاز.'),
      v: s('Demand charges are avoided without touching output, and you can show customers the carbon of every TV.', 'تتجنب رسوم الطلب الأقصى دون المساس بالإنتاج، ويمكنك أن تُري العملاء كربون كل جهاز.') },
    { view: 'leadership', at: '#lighthouse', t: s('Measured like the best plants', 'مقيس مثل أفضل المصانع'),
      b: s('The lighthouse scorecard rates the plant live on the five dimensions the World Economic Forum uses for the world\'s best factories.', 'تقيّم بطاقة معايير المصانع المنارة المصنع مباشرة على الأبعاد الخمسة التي يستخدمها المنتدى الاقتصادي العالمي لأفضل مصانع العالم.'),
      v: s('Leadership sees where the plant stands against world class and what the next step is, every day.', 'ترى الإدارة موقع المصنع من المستوى العالمي والخطوة التالية، كل يوم.') },
    { view: 'autopilot', at: '.ap-log', go: () => { if (DF.autopilot && !DF.autopilot.on) DF.autopilot.start(); }, dur: 22, t: s('Autopilot: the plant runs itself', 'التشغيل الذاتي: المصنع يدير نفسه'),
      b: s('Now the Orchestrator leads the nine agents: it sees the whole plant, chooses which problem comes first, weighs every option against plant rules, decides, explains why and on what evidence, and checks the result.', 'الآن يقود الوكيل القائد الوكلاء التسعة: يرى المصنع كله، ويختار أي مشكلة أولًا، ويزن كل خيار مقابل قواعد المصنع، ويقرر، ويشرح لماذا وبناءً على أي دليل، ثم يتحقق من النتيجة.'),
      v: s('Nights, weekends and busy hours stay under control within the rules you set, and every decision can be read and audited.', 'تبقى الليالي وعطلات نهاية الأسبوع وساعات الذروة تحت السيطرة ضمن القواعد التي تضعها، ويمكن قراءة كل قرار وتدقيقه.') },
    { view: 'autopilot', at: '.ap-tiles', dur: 0, last: true, t: s('Walk it in 3D', 'تجوّل فيه بالأبعاد الثلاثة'),
      b: s('The Orchestrator keeps running the plant. The same plant and agents are in 3D: follow one TV, ride a forklift, watch the cameras. Or ask the copilot anything you just saw.', 'يواصل الوكيل القائد إدارة المصنع. والمصنع نفسه والوكلاء أنفسهم بالأبعاد الثلاثة: تابع جهازًا، أو اركب رافعة شوكية، أو شاهد الكاميرات. أو اسأل المساعد الذكي عن أي شيء رأيته.'),
      v: s('Twelve weeks on one line turn this into a measured result in your own plant.', 'اثنا عشر أسبوعًا على خط واحد تحوّل هذا إلى نتيجة مقيسة في مصنعك.') }
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
    const T = (en, a) => (ar() ? (window.DFI18N && DFI18N.agree ? DFI18N.agree(a) : a) : en);   // Arabic counts agree with what they count (i18n.js)
    cap.innerHTML = `<div class="sh-top"><span class="sh-n">${T('Customer show', 'عرض للعميل')} · ${i + 1} / ${STEPS.length}</span>
        <button type="button" class="sh-x" data-sh="stop" aria-label="${T('End the show', 'أنهِ العرض')}">×</button></div>
      <h2>${esc(L(st.t))}</h2><p>${esc(L(st.b))}</p>
      ${st.v ? `<p class="sh-v"><b>${T('How it helps you', 'كيف يفيدك')}</b> ${esc(L(st.v))}</p>` : ''}
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
    // the plant keeps the pace the Orchestrator set when the show hands over to it
    if (!(DF.autopilot && DF.autopilot.on)) DF.setSpeed(1);
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
