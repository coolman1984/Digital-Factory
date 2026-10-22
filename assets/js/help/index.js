/* Digital Factory — the page guide for the website (index.html). */
(function () {
  const seen = sel => { const el = document.querySelector(sel); if (!el) return false; const r = el.getBoundingClientRect(); return r.top < innerHeight * 0.55 && r.bottom > innerHeight * 0.3; };
  DFHelp.page({
    title: { en: 'Digital Factory, the website', ar: 'المصنع الرقمي، الموقع' },
    purpose: { en: 'The proposal for Plant EG-01 on one page: why the best plants already work this way, what Digital Factory adds on top of the machines you own, and the twelve-week plan to prove it. Every figure about the plant is simulated.', ar: 'مقترح المصنع EG-01 في صفحة واحدة: لماذا تعمل أفضل المصانع بهذه الطريقة، وما يضيفه المصنع الرقمي فوق الماكينات القائمة، وخطة الأسابيع الاثني عشر لإثبات النتيجة. وكل أرقام المصنع هنا محاكاة.' },
    screens: [
      { id: 'how', when: () => seen('#how'), title: { en: 'Four layers', ar: 'الطبقات الأربع' },
        purpose: { en: 'How the system sits on top of the plant without replacing anything: connect, see, predict, act.', ar: 'كيف يعمل النظام فوق المصنع دون استبدال أي شيء: الربط، ثم الرؤية، ثم التنبؤ، ثم التصرف.' },
        read: [{ en: 'Each step builds on the one before it; the live card beside them shows one machine passing through all four.', ar: 'تبني كل طبقة على التي قبلها، والبطاقة الحية بجوارها تُظهر ماكينة واحدة تمر بالطبقات الأربع.' },
          { en: 'The start is <b>read-only</b>: the system only listens to the machines, so production is never at risk.', ar: 'البداية <b>للقراءة فقط</b>: النظام يستمع إلى الماكينات فحسب، فلا يتعرض الإنتاج لأي خطر.' }],
        ideas: [{ en: 'Ask the guest which layer hurts most today: data scattered, no live picture, surprises, or slow decisions.', ar: 'اسأل الضيف: أي طبقة تؤلمه أكثر اليوم؟ بيانات متفرقة، أم غياب الصورة الحية، أم المفاجآت، أم بطء القرار؟' }] },
      { id: 'mandate', when: () => seen('#mandate'), title: { en: 'Why now', ar: 'لماذا الآن' },
        purpose: { en: 'The industry has set 2030 as the year smart plants become normal; this section argues Plant EG-01 can be ready first.', ar: 'حددت الصناعة عام 2030 موعدًا لتصبح المصانع الذكية هي القاعدة، ويوضح هذا القسم أن المصنع EG-01 يمكن أن يسبق الجميع.' } },
      { id: 'caps', when: () => seen('.caps'), title: { en: 'Ten capabilities', ar: 'القدرات العشر' },
        purpose: { en: 'Every card opens the matching screen in the command room, live, so nothing here is a promise you cannot check.', ar: 'كل بطاقة تفتح الشاشة المقابلة في غرفة التحكم مباشرة، فلا شيء هنا وعد لا يمكن التحقق منه.' },
        steps: [{ en: 'Pick the card closest to the guest\'s problem.', ar: 'اختر البطاقة الأقرب إلى مشكلة الضيف.' }, { en: 'In the command room, press <kbd>?</kbd> for the guide of that screen.', ar: 'في غرفة التحكم اضغط <kbd>?</kbd> لترى مرشد تلك الشاشة.' }] },
      { id: 'plan', when: () => seen('#plan'), title: { en: 'The twelve-week plan', ar: 'خطة الأسابيع الاثني عشر' },
        purpose: { en: 'A pilot on one line with a measured result, then the decision to scale. Each phase has a deliverable you can inspect.', ar: 'تجربة على خط واحد بنتيجة مقيسة، ثم قرار التوسع، ولكل مرحلة مخرَج يمكن فحصه.' },
        decisions: [{ en: '<b>Approve the pilot</b>: one line is connected read-only; after twelve weeks you compare OEE, downtime and scrap against today.', ar: '<b>اعتماد التجربة</b>: يُربط خط واحد للقراءة فقط، وبعد اثني عشر أسبوعًا تقارن OEE والتوقفات والهالك بالوضع الحالي.' }] },
      { id: 'top', when: () => true, title: { en: 'The opening', ar: 'الافتتاحية' },
        purpose: { en: 'The headline and the live drawing of the plant: a quick sense of what the system sees before any detail.', ar: 'العنوان والرسم الحي للمصنع: لمحة سريعة عما يراه النظام قبل الدخول في التفاصيل.' },
        read: [{ en: 'The drawing moves with the simulated plant; the numbers under it are samples, not measurements.', ar: 'يتحرك الرسم مع المصنع المحاكى، والأرقام أسفله أمثلة وليست قياسات.' },
          { en: 'Words with a dotted underline are technical terms: rest the pointer on one for its meaning and use.', ar: 'الكلمات ذات الخط المنقط أسفلها مصطلحات فنية؛ ضع المؤشر عليها لترى معناها واستخدامها.' }],
        steps: [{ en: 'Scroll to read the proposal, or open the command room to see it working.', ar: 'مرّر لقراءة المقترح، أو افتح غرفة التحكم لتراه يعمل.' }],
        ideas: [{ en: 'For a short meeting, open the presentation instead; it tells the same story in eleven slides.', ar: 'في الاجتماع القصير افتح العرض التقديمي بدلًا من ذلك؛ فهو يروي القصة نفسها في إحدى عشرة شريحة.' }] }
    ],
    controls: [
      { sel: '[data-theme-toggle]', screen: '*', label: { en: 'Light or dark', ar: 'فاتح أو داكن' }, does: { en: 'Switches the colours of every page; the choice is remembered.', ar: 'يبدّل ألوان كل الصفحات، ويُحفظ اختيارك.' }, why: { en: 'Dark reads better on a big screen in a dim room.', ar: 'الداكن أوضح على الشاشات الكبيرة في القاعات المعتمة.' } },
      { sel: '[data-lang-toggle]', screen: '*', label: { en: 'Arabic or English', ar: 'العربية أو الإنجليزية' }, does: { en: 'Changes the language of every page, right to left for Arabic. Key <kbd>L</kbd>.', ar: 'يغيّر لغة كل الصفحات، ومن اليمين إلى اليسار للعربية. المفتاح <kbd>L</kbd>.' } },
      { sel: 'a[href="app.html"].btn', screen: '*', label: { en: 'Open the command room', ar: 'افتح غرفة التحكم' }, does: { en: 'Opens the live plant with its nine AI agents.', ar: 'يفتح المصنع الحي مع وكلاء الذكاء الاصطناعي التسعة.' }, why: { en: 'The fastest proof: the guest sees decisions being prepared.', ar: 'أسرع دليل: يرى الضيف القرارات وهي تُعدّ أمامه.' } },
      { sel: 'a[href="deck.html"]', screen: '*', label: { en: 'Presentation', ar: 'العرض التقديمي' }, does: { en: 'Opens the eleven-slide deck with speaker notes.', ar: 'يفتح العرض المكون من إحدى عشرة شريحة مع ملاحظات المتحدث.' } },
      { sel: 'a[href="plant.html"]', screen: '*', label: { en: '3D plant', ar: 'المصنع ثلاثي الأبعاد' }, does: { en: 'Opens the plant in 3D: walk the floor, follow vehicles, start drills.', ar: 'يفتح المصنع بالأبعاد الثلاثة: تجوّل في أرضه، وتابع المركبات، وابدأ التمارين.' } },
      { sel: '.caps a[href^="app.html#"]', screen: 'caps', label: { en: 'Capability card', ar: 'بطاقة قدرة' }, does: { en: 'Opens that screen of the command room, live.', ar: 'يفتح تلك الشاشة في غرفة التحكم مباشرة.' } },
      { sel: '.links a', screen: '*', label: { en: 'Section links', ar: 'روابط الأقسام' }, does: { en: 'Jump to a part of the proposal.', ar: 'انتقل إلى جزء من المقترح.' } }
    ],
    suggest: [
      () => (scrollY < 200 ? { en: 'New here? Open the command room and press <kbd>?</kbd> there: the guide walks you through every screen.', ar: 'جديد هنا؟ افتح غرفة التحكم واضغط <kbd>?</kbd> هناك، وسيأخذك المرشد عبر كل شاشة.', title: { en: 'Start', ar: 'ابدأ' }, go: () => { location.href = 'app.html'; } } : null),
      () => (document.documentElement.lang !== 'ar' ? { en: 'The whole program is also in Arabic: press <kbd>L</kbd>.', ar: '', title: { en: 'العربية', ar: 'العربية' }, go: () => window.DFI18N && DFI18N.set('ar') } : null),
      () => ({ en: 'The reference guide explains every screen, decision and term in both languages.', ar: 'يشرح الدليل المرجعي كل شاشة وقرار ومصطلح باللغتين.', title: { en: 'Reference guide', ar: 'الدليل المرجعي' }, go: () => { location.href = 'guide.html'; } })
    ]
  });
})();
