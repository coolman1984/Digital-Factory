/* Digital Factory — the plant measured the way the World Economic Forum's Global Lighthouse Network assesses a site: five
   dimensions (productivity, supply-chain resilience, sustainability, customer centricity, talent), each with live numbers from
   Plant EG-01, where it stands, what lighthouse sites do, and the next step here. Also energy and carbon per TV on the energy
   view. Written in both languages (the card follows the page language itself). Plant data is simulated; the grid emission
   factor is a sample value. */
(function () {
  'use strict';
  const DF = window.DF; if (!DF) return;
  const $ = s => document.querySelector(s);
  const ar = () => document.documentElement.lang === 'ar';
  const T = (en, a) => (ar() ? a : en);
  const n0 = v => Math.round(v).toLocaleString('en-US'), p0 = v => Math.round(v * 100) + '%', p1 = v => (v * 100).toFixed(1) + '%';
  const GRID = 0.47;   // kg CO2e per kWh, a sample factor for a gas-heavy grid
  const P = () => DF.P, E = () => DF.E, X = () => DF.X || (window.Room && Room.X), AG = () => DF.AG;

  /* ---------- the numbers ---------- */
  function measure() {
    const p = P(), k = p.kpi, made = Object.values(p.made.byModel).reduce((a, b) => a + b, 0);
    const shiftH = Math.max(0.25, (p.t - 6 * 3600) / 3600);   // the shift started at 06:00
    const ops = p.people.filter(x => x.role === 'Operator' || x.role === 'Line leader');
    const present = ops.filter(x => x.present).length || 1;
    const opsLv = p.people.filter(x => x.role === 'Operator');
    const certified = opsLv.filter(x => (x.level || 3) >= 3).length / Math.max(1, opsLv.length);
    const cross = opsLv.filter(x => x.cross && x.cross.length).length / Math.max(1, opsLv.length);
    const expired = opsLv.filter(x => x.certExp < 0).length;
    const preds = p.preds || [], open = preds.filter(x => !x.covered);
    const late = (AG().base && AG().base.late) || 0;
    const kwh = p.energy.kwh, perTv = made ? kwh / made : 0;
    const x = X(), svc = x && x.svc ? x.svc : { backorders: 0 };
    const A = AG(), dec = A ? A.stats : { decisions: 0, auto: 0, simulated: 0 };
    return {
      oee: k.oee || 0, tvPerOpH: (k.units || 0) / present / shiftH, made,
      openRisks: open.length, risks: preds.length, late, simulated: dec.simulated || 0, decisions: dec.decisions || 0,
      kwh, perTv, co2Tv: perTv * GRID, co2: kwh * GRID / 1000, peak: (A && A.energy && A.energy.peak) || 0,
      otif: k.otif == null ? 1 : k.otif, dppm: Math.max(0, 1 - (k.fpy || 1)) * 1e6, back: svc.backorders || 0,
      certified, cross, expired, overtime: (x && x.fin && x.fin.overtimeH) || 0
    };
  }
  const chip = (st, en, a) => `<span class="lh-st ${st}">${T(en, a)}</span>`;
  const st3 = (good, watch) => (good ? 'good' : watch ? 'watch' : 'gap');
  const LBL = { good: ['Lighthouse level', 'بمستوى المنارة'], watch: ['Close', 'قريب'], gap: ['Gap', 'فجوة'] };

  function rows(m) {
    const prod = st3(m.oee >= 0.85, m.oee >= 0.75), res = st3(m.openRisks === 0 && m.late === 0, m.late === 0);
    const sus = st3(m.co2Tv > 0 && m.co2Tv <= 4.5 && m.peak <= 4000, m.peak <= 4200), cus = st3(m.otif >= 0.98 && m.dppm < 3000, m.otif >= 0.9);
    const tal = st3(m.certified >= 0.9 && m.expired === 0, m.certified >= 0.8);
    return [
      { id: 'productivity', go: 'leadership', st: prod, h: T('Productivity', 'الإنتاجية'),
        now: T(`Main-line OEE <b>${p1(m.oee)}</b> · <b>${m.tvPerOpH.toFixed(1)}</b> TVs per operator hour`, `فعالية خطوط التجميع <b>${p1(m.oee)}</b> · <b>${m.tvPerOpH.toFixed(1)}</b> جهاز لكل ساعة عمل مشغل`),
        lh: T('The 2025 lighthouse cohort raised labour productivity by 53% on average and cut conversion cost by 26%; world-class OEE is about 85%.', 'رفعت مصانع المنارة في دفعة 2025 إنتاجية العمل بنسبة 53% في المتوسط، وخفضت تكلفة التحويل بنسبة 26%، والفعالية العالمية نحو 85%.'),
        next: T('Attack the biggest loss on the OEE loss tree of the constraint machine.', 'هاجم أكبر خسارة في شجرة خسائر OEE لماكينة عنق الزجاجة.') },
      { id: 'resilience', go: 'predict', st: res, h: T('Supply-chain resilience', 'مرونة سلسلة الإمداد'),
        now: T(`<b>${m.openRisks}</b> uncovered stock-out or failure risks · <b>${m.late}</b> orders forecast late · <b>${n0(m.simulated)}</b> plant simulations run`, `<b>${m.openRisks}</b> مخاطر نفاد أو عطل غير مغطاة · <b>${m.late}</b> طلبيات متوقع تأخرها · <b>${n0(m.simulated)}</b> محاكاة للمصنع`),
        lh: T('Lighthouses see a disruption early and test the response on a digital twin before they act.', 'ترى مصانع المنارة الاضطراب مبكرًا، وتختبر الاستجابة على التوأم الرقمي قبل أن تتصرف.'),
        next: T('Run the drills one by one and keep the agents on Approve until every response is trusted.', 'شغّل التمارين واحدًا تلو الآخر، وأبقِ الوكلاء على وضع «بالموافقة» حتى تثق في كل استجابة.') },
      { id: 'sustainability', go: 'energy', st: sus, h: T('Sustainability', 'الاستدامة'),
        now: T(`<b>${m.perTv.toFixed(2)}</b> kWh and <b>${m.co2Tv.toFixed(2)}</b> kg CO₂e per TV · ${n0(m.co2 * 1000)} kg CO₂e since 09:12 · peak forecast ${n0(m.peak)} kW of 4,000`, `<b>${m.perTv.toFixed(2)}</b> كيلوواط ساعة و<b>${m.co2Tv.toFixed(2)}</b> كجم مكافئ ثاني أكسيد الكربون لكل جهاز · ${n0(m.co2 * 1000)} كجم منذ 09:12 · الذروة المتوقعة ${n0(m.peak)} من 4,000 كيلوواط`),
        lh: T('Sustainability is one of the five lighthouse dimensions: energy and carbon are measured per unit and cut without losing output.', 'الاستدامة أحد أبعاد المنارة الخمسة: تُقاس الطاقة والكربون لكل وحدة، وتُخفض دون خسارة الإنتاج.'),
        next: T('Keep the Energy agent on Auto for peak shaving; next, schedule compressors and chillers by the plan.', 'أبقِ وكيل الطاقة على الوضع التلقائي لخفض الذروة، ثم جدول الضواغط والمبردات وفق الخطة.') },
      { id: 'customer', go: 'quality', st: cus, h: T('Customer centricity', 'التركيز على العميل'),
        now: T(`On time in full <b>${p0(m.otif)}</b> · <b>${n0(m.dppm)}</b> defects per million at test and QA · <b>${m.back}</b> service back orders`, `التسليم في الموعد وبالكامل <b>${p0(m.otif)}</b> · <b>${n0(m.dppm)}</b> عيبًا لكل مليون في الاختبار والجودة · <b>${m.back}</b> طلبيات خدمة مؤجلة`),
        lh: T('The first TV-industry lighthouse (Hisense, Qingdao, 2026) feeds customer voice into design and build: NPS 84%, R&D cycles 34% shorter.', 'أول منارة في صناعة التلفزيون (هايسنس، تشينغداو، 2026) تُدخل صوت العميل في التصميم والتصنيع: مؤشر رضا 84%، ودورات تطوير أقصر بنسبة 34%.'),
        next: T('Link field failures from service back to the station and lot that made them (genealogy is already here).', 'اربط أعطال الميدان من الخدمة بالمحطة والدفعة التي صنعتها، فسجل النسب موجود بالفعل.') },
      { id: 'talent', go: 'leadership', st: tal, h: T('Talent', 'المواهب'),
        now: T(`<b>${p0(m.certified)}</b> of operators certified · <b>${p0(m.cross)}</b> cross-trained on another line · <b>${m.expired}</b> certificates expired`, `<b>${p0(m.certified)}</b> من المشغلين معتمدون · <b>${p0(m.cross)}</b> مدربون على خط آخر · <b>${m.expired}</b> شهادات منتهية`),
        lh: T('Lighthouses grow skills with the technology: shorter training, more cross-skilled people, decisions made on the floor.', 'تنمّي مصانع المنارة المهارات مع التقنية: تدريب أقصر، وأفراد متعددو المهارات، وقرارات تُتخذ في أرض المصنع.'),
        next: T('Renew the expired certificates first; use the 3D walk to train new operators on the real layout.', 'جدّد الشهادات المنتهية أولًا، واستخدم السير ثلاثي الأبعاد لتدريب المشغلين الجدد على المخطط الحقيقي.') }
    ];
  }

  /* ---------- the scorecard on the leadership view ---------- */
  const card = document.createElement('section');
  card.className = 'card lh-card'; card.id = 'lighthouse'; card.dataset.noI18n = ''; card.setAttribute('aria-labelledby', 'lhH');
  const lead = $('#view-leadership'); if (lead) lead.insertBefore(card, lead.children[1] || null);
  let last = '';
  function render() {
    if (!lead || lead.hidden) return;
    const m = measure(), R = rows(m), good = R.filter(r => r.st === 'good').length;
    const html = `<div class="card-head"><div><h2 class="h3" id="lhH">${T('Lighthouse scorecard', 'بطاقة معايير المصانع المنارة')}</h2>
      <p class="muted small">${T('Plant EG-01 on the five dimensions the World Economic Forum\'s Global Lighthouse Network assesses, live', 'المصنع EG-01 على الأبعاد الخمسة التي تقيّم بها شبكة المصانع المنارة التابعة للمنتدى الاقتصادي العالمي، مباشرة')}</p></div>
      <span class="lh-sum">${T(`${good} of 5 at lighthouse level`, `${good} من 5 بمستوى المنارة`)}</span></div>
      <div class="lh-rows">${R.map(r => `<div class="lh-row ${r.st}"><div class="lh-h"><b>${r.h}</b>${chip(r.st, ...LBL[r.st])}</div>
        <p class="lh-now">${r.now}</p><p class="lh-lh"><span class="lh-k">${T('Lighthouses', 'المصانع المنارة')}</span> ${r.lh}</p>
        <p class="lh-next"><span class="lh-k">${T('Next here', 'الخطوة التالية هنا')}</span> ${r.next} <button type="button" class="lnk" data-lh-go="${r.go}">${T('Open', 'افتح')}</button></p></div>`).join('')}</div>
      <p class="quiet small">${T('Thresholds: OEE 85%, on time in full 98%, certified operators 90%, peak inside the 4,000 kW contract. Carbon uses a sample grid factor of 0.47 kg CO₂e per kWh. Lighthouse figures: World Economic Forum, 2025–2026.', 'الحدود: فعالية 85%، والتسليم في الموعد وبالكامل 98%، والمشغلون المعتمدون 90%، والذروة ضمن تعاقد 4,000 كيلوواط. ويُحسب الكربون بمعامل توضيحي للشبكة قدره 0.47 كجم لكل كيلوواط ساعة. أرقام المصانع المنارة: المنتدى الاقتصادي العالمي، 2025–2026.')}</p>`;
    if (html !== last) { last = html; card.innerHTML = html; }
  }
  card.addEventListener('click', e => { const b = e.target.closest('[data-lh-go]'); if (b) DF.go(b.dataset.lhGo); });

  /* ---------- energy and carbon per TV on the energy view ---------- */
  const eCard = document.createElement('section');
  eCard.className = 'card lh-card'; eCard.dataset.noI18n = ''; eCard.setAttribute('aria-labelledby', 'co2H');
  const ev = $('#view-energy'); if (ev) ev.insertBefore(eCard, ev.children[1] || null);
  let lastE = '';
  function renderE() {
    if (!ev || ev.hidden) return;
    const m = measure();
    const html = `<div class="card-head"><div><h2 class="h3" id="co2H">${T('Energy and carbon per TV', 'الطاقة والكربون لكل جهاز')}</h2>
      <p class="muted small">${T('Since the model started at 09:12; sample grid factor 0.47 kg CO₂e per kWh', 'منذ بدء النموذج عند 09:12، بمعامل توضيحي للشبكة 0.47 كجم لكل كيلوواط ساعة')}</p></div></div>
      <div class="lh-kpis">
        <div><b>${m.perTv.toFixed(2)}</b><span>${T('kWh per TV', 'كيلوواط ساعة لكل جهاز')}</span></div>
        <div><b>${m.co2Tv.toFixed(2)}</b><span>${T('kg CO₂e per TV', 'كجم مكافئ CO₂ لكل جهاز')}</span></div>
        <div><b>${n0(m.kwh)}</b><span>${T('kWh used', 'كيلوواط ساعة مستهلكة')}</span></div>
        <div><b>${n0(m.co2 * 1000)}</b><span>${T('kg CO₂e', 'كجم مكافئ CO₂')}</span></div>
        <div><b>${n0(m.made)}</b><span>${T('TVs made', 'جهاز مصنّع')}</span></div>
      </div>`;
    if (html !== lastE) { lastE = html; eCard.innerHTML = html; }
  }

  DF.onView('leadership', render); DF.onView('energy', renderE);
  addEventListener('langchange', () => { last = lastE = ''; render(); renderE(); });
  setInterval(() => { render(); renderE(); }, 2000);
  DF.lighthouse = { measure, rows };
})();
