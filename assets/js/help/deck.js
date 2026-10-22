/* Digital Factory — the page guide for the presentation (deck.html). */
(function () {
  const s = (en, ar) => ({ en, ar });
  const cur = () => { try { return window.Deck ? Deck.current() : ''; } catch (e) { return ''; } };
  const at = (...ids) => () => ids.includes(cur());
  const pinned = () => { try { return !!localStorage.getItem('df-pinned'); } catch (e) { return false; } };
  DFHelp.page({
    title: s('Presentation', 'العرض التقديمي'),
    purpose: s('The proposal in slides with speaker notes, plus a live briefing that reads the plant and writes its own slides. <kbd>→</kbd> and <kbd>←</kbd> move, <kbd>N</kbd> shows the notes, <kbd>F</kbd> full screen, <kbd>B</kbd> the live briefing.', 'المقترح في شرائح مع ملاحظات المتحدث، وإحاطة حية تقرأ المصنع وتكتب شرائحها بنفسها. <kbd>→</kbd> و<kbd>←</kbd> للتنقل، و<kbd>N</kbd> لملاحظات المتحدث، و<kbd>F</kbd> لملء الشاشة، و<kbd>B</kbd> للإحاطة الحية.'),
    screens: [
      { id: 'briefing', when: at('briefing', 'briefing-actions', 'briefing-after'), title: s('Live briefing', 'الإحاطة الحية'),
        purpose: s('Three slides written from the plant itself: what is happening, what the agents recommend, and what happened after. Read it now, or choose a time window to review.', 'ثلاث شرائح مكتوبة من المصنع نفسه: ما يحدث، وما يوصي به الوكلاء، وما حدث بعد ذلك. اقرأها الآن، أو اختر نافذة زمنية لمراجعتها.'),
        steps: [s('Press <b>Read the plant now</b>, or pin a moment from the command room with <kbd>P</kbd>.', 'اضغط <b>اقرأ المصنع الآن</b>، أو ثبّت لحظة من غرفة التحكم بالمفتاح <kbd>P</kbd>.'), s('For a review, choose the window and press Build.', 'للمراجعة، اختر النافذة الزمنية واضغط «ابنِ».'), s('Export to PowerPoint to send it after the meeting.', 'صدّره إلى PowerPoint لترسله بعد الاجتماع.')],
        decisions: [s('<b>Then +30 min, +1 h, +2 h</b>: the third slide shows what really happened that long after, against what the agents forecast.', '<b>ثم +30 دقيقة، +1 ساعة، +2 ساعة</b>: تُظهر الشريحة الثالثة ما حدث فعلًا بعد تلك المدة، مقابل ما توقعه الوكلاء.')],
        ideas: [s('Pin the moment a drill starts, then show “after” to prove the forecast came true.', 'ثبّت لحظة بدء تمرين، ثم اعرض «بعد ذلك» لتثبت أن التوقع تحقق.')] },
      { id: 'demo', when: at('demo'), title: s('The live demo', 'العرض الحي'), purpose: s('The command room or the 3D plant inside the slide, running. Use it as you would the real page.', 'غرفة التحكم أو المصنع ثلاثي الأبعاد داخل الشريحة، يعملان. استخدمهما كما تستخدم الصفحة الحقيقية.'), read: [s('Slide keys still move the deck while the demo has focus.', 'تظل مفاتيح الشرائح تنقل العرض حتى أثناء التفاعل مع العرض الحي.')] },
      { id: 'value', when: at('value', 'plan', 'next'), title: s('Value and plan', 'القيمة والخطة'), purpose: s('What the pilot is worth in EGP and how twelve weeks prove it; end with the decision you ask for.', 'قيمة التجربة بالجنيه، وكيف تثبتها الأسابيع الاثنا عشر، ثم القرار الذي تطلبه في الختام.'), ideas: [s('Ask for one line and twelve weeks, not the whole plant.', 'اطلب خطًا واحدًا واثني عشر أسبوعًا، لا المصنع كله.')] },
      { id: 'slides', when: () => true, title: s('The story', 'القصة'), purpose: s('Each slide makes one point; the notes (<kbd>N</kbd>) hold what to say and the numbers behind it.', 'كل شريحة تقدم فكرة واحدة، وتحمل الملاحظات (<kbd>N</kbd>) ما تقوله والأرقام التي تدعمه.'),
        steps: [s('Open the notes on a second screen if you can.', 'افتح الملاحظات على شاشة ثانية إن أمكن.'), s('Go full screen with <kbd>F</kbd>.', 'املأ الشاشة بالمفتاح <kbd>F</kbd>.')],
        ideas: [s('Start with the live briefing: a slide the plant wrote this morning is a strong opening.', 'ابدأ بالإحاطة الحية؛ فشريحة كتبها المصنع هذا الصباح افتتاحية قوية.')] }
    ],
    controls: [
      { sel: '#prev, #next', screen: '*', label: s('Previous or next slide', 'الشريحة السابقة أو التالية'), does: s('Moves through the deck; the arrow keys do the same.', 'ينقلك بين الشرائح، ومفاتيح الأسهم تؤدي الوظيفة نفسها.') },
      { sel: '#notesBtn', screen: '*', label: s('Speaker notes', 'ملاحظات المتحدث'), does: s('Shows what to say on this slide. Key <kbd>N</kbd>.', 'يعرض ما تقوله في هذه الشريحة. المفتاح <kbd>N</kbd>.') },
      { sel: '#fs', screen: '*', label: s('Full screen', 'ملء الشاشة'), does: s('Fills the screen for presenting. Key <kbd>F</kbd>.', 'يملأ الشاشة للعرض. المفتاح <kbd>F</kbd>.') },
      { sel: '#briefBtn', screen: '*', label: s('Live briefing', 'الإحاطة الحية'), does: s('Opens the panel that reads the plant, pins a moment or reviews a time window. Key <kbd>B</kbd>.', 'يفتح لوحة تقرأ المصنع أو تثبّت لحظة أو تراجع نافذة زمنية. المفتاح <kbd>B</kbd>.') },
      { sel: '#bpRead, [data-b-read]', screen: '*', label: s('Read the plant now', 'اقرأ المصنع الآن'), does: s('Takes the plant\'s state this second and writes the briefing slides from it.', 'يأخذ حالة المصنع في هذه اللحظة ويكتب منها شرائح الإحاطة.') },
      { sel: '#bpPinLive', screen: '*', label: s('Use the pinned moment', 'استخدم اللحظة المثبتة'), does: s('Uses the moment sent from the command room with <kbd>P</kbd>.', 'يستخدم اللحظة المرسلة من غرفة التحكم بالمفتاح <kbd>P</kbd>.') },
      { sel: '#bpClear', screen: '*', label: s('Clear', 'امسح'), does: s('Forgets the pinned moment; the briefing goes back to the sample.', 'ينسى اللحظة المثبتة، وتعود الإحاطة إلى المثال.') },
      { sel: '#bpGo', screen: '*', label: s('Go to the briefing', 'انتقل إلى الإحاطة'), does: s('Closes the panel and opens the first briefing slide.', 'يغلق اللوحة ويفتح أول شريحة إحاطة.') },
      { sel: '#rvBuild, #rvShow', screen: '*', label: s('Build the review', 'ابنِ المراجعة'), does: s('Writes the briefing for the chosen time window from the plant recording.', 'يكتب الإحاطة للنافذة الزمنية المختارة من تسجيل المصنع.') },
      { sel: '#rvPlay', screen: '*', label: s('Play', 'تشغيل'), does: s('Plays the window back so you can narrate it.', 'يعيد تشغيل النافذة لتعلّق عليها.') },
      { sel: '#rvPptx', screen: '*', label: s('Export PowerPoint', 'صدّر إلى PowerPoint'), does: s('Downloads the briefing slides as a .pptx file.', 'ينزّل شرائح الإحاطة كملف .pptx.') },
      { sel: '[data-then]', screen: '*', label: s('Then', 'ثم'), does: s('Shows what happened 30 minutes, one hour or two hours later.', 'يعرض ما حدث بعد 30 دقيقة أو ساعة أو ساعتين.') },
      { sel: '[data-demo]', screen: 'demo', label: s('Demo', 'العرض الحي'), does: s('Chooses the command room or the 3D plant for the live slide.', 'يختار غرفة التحكم أو المصنع ثلاثي الأبعاد للشريحة الحية.') }
    ],
    suggest: [
      () => (!pinned() && cur() === 'title' ? { title: s('Briefing', 'الإحاطة'), en: 'Open with a slide the plant writes itself: read the plant now.', ar: 'افتتح بشريحة يكتبها المصنع بنفسه: اقرأ المصنع الآن.', go: () => window.Brief && Brief.open(true) } : null),
      () => (!document.fullscreenElement ? { title: s('Full screen', 'ملء الشاشة'), en: 'Presenting? Go full screen with F and open the notes with N.', ar: 'تقدّم العرض؟ املأ الشاشة بالمفتاح F وافتح الملاحظات بالمفتاح N.' } : null)
    ]
  });
})();
