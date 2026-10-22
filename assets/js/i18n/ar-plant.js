/* Digital Factory — Arabic for the plant itself, shared by the live plant (plant.html), the command room (app.html) and the
   presentation: machine and material names, people, states and reasons, the drills, the agents and what they write, the
   log lines of GMES, CMMS, SAP and the warehouses. Sentences with numbers and names are patterns; each name inside them is
   translated again from this file. */
DFI18N.add({
  exact: {
    // agents
    'Maintenance agent': 'وكيل الصيانة', 'Quality agent': 'وكيل الجودة', 'Scheduling agent': 'وكيل الجدولة', 'Material agent': 'وكيل المواد', 'Logistics agent': 'وكيل اللوجستيات',
    'Energy agent': 'وكيل الطاقة', 'People agent': 'وكيل الأفراد', 'Service agent': 'وكيل الخدمة', 'Safety and vision agent': 'وكيل السلامة والرؤية', 'Planning agent': 'وكيل التخطيط', 'Briefing agent': 'وكيل الإحاطة',
    'Logistics agent (Auto)': 'وكيل اللوجستيات (تلقائي)', 'Energy agent (Auto)': 'وكيل الطاقة (تلقائي)', 'Maintenance agent (Auto)': 'وكيل الصيانة (تلقائي)', 'Quality agent (Auto)': 'وكيل الجودة (تلقائي)', 'Scheduling agent (Auto)': 'وكيل الجدولة (تلقائي)',
    'Scheduling agent (low risk, not vetoed)': 'وكيل الجدولة (منخفض المخاطر، دون اعتراض)', 'Maintenance agent (low risk, not vetoed)': 'وكيل الصيانة (منخفض المخاطر، دون اعتراض)', 'Logistics agent (low risk, not vetoed)': 'وكيل اللوجستيات (منخفض المخاطر، دون اعتراض)',
    'Advise': 'استشاري', 'Advise only': 'استشاري فقط', 'Ask first': 'يستأذن أولًا', 'Auto': 'تلقائي', 'Watching. Nothing to report.': 'في وضع المراقبة، ولا مستجدات.', 'Watch': 'مراقبة', 'Active': 'نشط', 'Waiting for you': 'بانتظار قرارك', 'Needs you': 'بانتظار قرارك',
    'Predicts failures from vibration, temperature and health trends; picks the cheapest repair window; checks technicians and spare parts.': 'يتنبأ بالأعطال من اتجاهات الاهتزاز والحرارة والصحة، ويختار أقل نافذة إصلاح تكلفة، ويتحقق من توافر الفنيين وقطع الغيار.',
    'Runs SPC with Nelson rules on process signals, traces defects to a machine, a lot or a firmware through genealogy, and contains them.': 'يطبّق ضبط العمليات الإحصائي بقواعد نيلسون على إشارات العملية، ويتتبع العيوب إلى ماكينة أو دفعة أو إصدار برمجيات عبر سجل النسب، ويحتويها.',
    'Forecasts every order against the lines, re-sequences or re-balances lines when an order is at risk, and weighs overtime and changeovers.': 'يتوقع موقف كل طلبية مقابل الخطوط، ويعيد ترتيب التسلسل أو موازنة الخطوط عندما تتعرض طلبية للخطر، ويوازن بين العمل الإضافي وتغيير الموديلات.',
    'Projects the runway of every store and line-side stock against inbound deliveries and the milk-run timetable; resolves shortages.': 'يقدّر مدة كفاية كل مخزن ومخزون جانب الخط مقابل التوريدات الواردة وجدول قطارات الإمداد، ويعالج النقص.',
    'Dispatches AGVs, milk runs and forklifts; sends hot runs; watches docks and vehicle faults.': 'يوجّه المركبات الموجهة آليًا وقطارات الإمداد والرافعات الشوكية، ويرسل الإمداد العاجل، ويراقب الأرصفة وأعطال المركبات.',
    'Forecasts the 15-minute demand peak against the 4,000 kW contract and shaves it without touching takt.': 'يتوقع ذروة الطلب على مدى 15 دقيقة مقابل التعاقد البالغ 4,000 كيلوواط، ويخفضها دون المساس بزمن الإيقاع.',
    'Matches certified operators to stations, covers absences, approves overtime within policy.': 'يطابق المشغلين المعتمدين مع المحطات، ويغطي الغياب، ويعتمد العمل الإضافي في حدود السياسة.',
    'Balances spare parts for customers against production needs.': 'يوازن قطع الغيار المخصصة للعملاء مقابل احتياجات الإنتاج.',
    'Watches the camera feeds with AI vision: people, vehicles, forklift near misses and missing PPE. Feeds the andon and keeps the safety log with a still of each incident.': 'يراقب بث الكاميرات بالرؤية الآلية: الأفراد، والمركبات، والحوادث الوشيكة مع الرافعات الشوكية، وغياب معدات الوقاية الشخصية. ويغذي لوحة الأندون، ويحفظ سجل السلامة مع صورة لكل حادثة.',
    // drills
    'Bearing wear on SMD 4 Mounter B': 'تآكل المحمل في ماكينة التركيب B بخط SMD 4', 'Short shots on injection machine IM10': 'نقص الحقن في ماكينة الحقن IM10', 'Coating oven temperature drop': 'انخفاض حرارة فرن الطلاء',
    'Faulty software release for PBA 55': 'إصدار برمجيات معيب للوحة PBA 55', 'Open-cell container held at port': 'حاوية الخلايا المفتوحة محتجزة في الميناء', 'Local carton vendor late': 'تأخر مورد الكراتين المحلي',
    'Eight operators absent on main line 3': 'غياب ثمانية مشغلين عن خط التجميع الرئيسي 3', 'Field failures: 55" main boards': 'أعطال لدى العملاء: اللوحات الرئيسية 55 بوصة', 'Grid voltage dip': 'انخفاض جهد الشبكة',
    'The spindle bearing on a mounter of SMD line 4 starts to wear. Vibration climbs.': 'يبدأ محمل عمود الدوران في إحدى ماكينات التركيب بخط SMD 4 في التآكل، ويرتفع الاهتزاز.',
    'Mounter B → SMD 4 → PBA 65 supermarket → main lines 4 and 5 → orders': 'ماكينة التركيب B ← SMD 4 ← سوبر ماركت PBA 65 ← خطا التجميع 4 و5 ← الطلبيات',
    'A worn check ring makes IM10 mould incomplete 65" back covers. Final QA starts rejecting them.': 'تآكل حلقة عدم الرجوع يجعل IM10 تنتج أغطية خلفية 65 بوصة غير مكتملة، فيبدأ فحص الجودة النهائي في رفضها.',
    'IM10 → back-cover lots → main lines 4 and 5 → final QA → rework': 'IM10 ← دفعات الأغطية الخلفية ← خطا التجميع 4 و5 ← فحص الجودة النهائي ← إعادة التشغيل',
    'A burner fault drops the line 4 coating oven 18 °C below its cure temperature.': 'عطل في الموقد يخفض حرارة فرن الطلاء في الخط 4 بمقدار 18 درجة مئوية عن حرارة المعالجة.',
    'Oven → under-cured chassis → paint adhesion → main lines 4 and 5': 'الفرن ← هياكل غير مكتملة المعالجة ← التصاق الطلاء ← خطا التجميع 4 و5',
    'PE releases firmware v3.2.0 for the 55" main board. Its HDMI-CEC handling fails the function test.': 'تُصدر هندسة الإنتاج البرمجيات v3.2.0 للوحة الرئيسية 55 بوصة، فتفشل معالجتها لـ HDMI-CEC في الاختبار الوظيفي.',
    'PE release → PBA writers → boards → function test on main lines 1 and 2': 'إصدار هندسة الإنتاج ← وحدات تحميل البرمجيات ← اللوحات ← الاختبار الوظيفي في خطي التجميع 1 و2',
    'The 65" open-cell container is held at the port for 5 days.': 'تُحتجز حاوية الخلايا المفتوحة 65 بوصة في الميناء خمسة أيام.',
    'Import container → OC-65 stock → LCM lines 4 and 5 → main lines 4 and 5 → orders': 'حاوية الاستيراد ← مخزون OC-65 ← خطا LCM 4 و5 ← خطا التجميع 4 و5 ← الطلبيات',
    'The 55" carton truck from the local vendor is 3 hours late.': 'تتأخر شاحنة الكراتين 55 بوصة من المورد المحلي ثلاث ساعات.',
    'Vendor truck → carton supermarket → packing on main lines 1 and 2': 'شاحنة المورد ← سوبر ماركت الكراتين ← التعبئة في خطي التجميع 1 و2',
    'Eight operators did not come in for shift A on main line 3.': 'لم يحضر ثمانية مشغلين للوردية A في خط التجميع الرئيسي 3.', 'Attendance → manual stations → line 3 takt → orders': 'الحضور ← المحطات اليدوية ← زمن إيقاع الخط 3 ← الطلبيات',
    'Service centres report a spike of 55" main-board failures and order 60 spare PBAs.': 'تُبلغ مراكز الخدمة عن ارتفاع مفاجئ في أعطال اللوحات الرئيسية 55 بوصة، وتطلب 60 لوحة PBA احتياطية.',
    'Chain: Customers → SVC → spare PBA stock → production PBA supermarket': 'السلسلة: العملاء ← الخدمة ← مخزون PBA الاحتياطي ← سوبر ماركت PBA للإنتاج',
    'An 18% voltage dip for 400 ms trips the SMD lines and the coating ovens.': 'انخفاض في الجهد بنسبة 18% لمدة 400 مللي ثانية يفصل خطوط SMD وأفران الطلاء.',
    'Chain: Grid → SMD reflow ovens and coating ovens → boards and chassis in the ovens': 'السلسلة: الشبكة ← أفران إعادة الصهر وأفران الطلاء ← اللوحات والهياكل داخل الأفران',
    'Started drill': 'بدأ التمرين', 'Start drill': 'بدء التمرين', 'Drills on Plant EG-01': 'التمارين على المصنع EG-01', 'Skip 10 min': 'تقديم 10 دقائق', 'Watch in 3D': 'المشاهدة بالأبعاد الثلاثية',
    'Start a real-world disruption and watch the agents and the offices detect it, trace it and propose what to do. Nothing touches a real plant.': 'ابدأ اضطرابًا من الواقع، وراقب الوكلاء والإدارات وهم يكتشفونه ويتتبعونه ويقترحون ما يجب فعله. ولا يمس ذلك أي مصنع حقيقي.',
    // recommendations and options
    'Send a hot run': 'إرسال إمداد عاجل', 'Hot run': 'إمداد عاجل', 'Wait for the next delivery': 'انتظار التوريد التالي', 'Wait for the SMD repair': 'انتظار إصلاح خط SMD', 'Wait for the source to refill': 'انتظار إعادة ملء المصدر',
    'Repair now (8 min)': 'الإصلاح فورًا (8 دقائق)', 'Planned repair': 'إصلاح مخطط', 'Peak shaved': 'خُفّضت الذروة', 'Peak shaving': 'خفض الذروة', 'Shave the peak for 30 min': 'خفض الذروة لمدة 30 دقيقة',
    'Stage compressor 3 off and raise chiller 2 setpoint for 30 min': 'إيقاف الضاغط 3 مرحليًا ورفع نقطة ضبط المبرد 2 لمدة 30 دقيقة',
    'Compressor 3 staged off, chiller 2 setpoint +2 °C, boiler low fire for 30 min': 'إيقاف الضاغط 3 مرحليًا، ورفع ضبط المبرد 2 بمقدار درجتين مئويتين، وتشغيل الغلاية على لهب منخفض لمدة 30 دقيقة',
    'Hold lots and move BC-65 to IM20': 'حجز الدفعات ونقل BC-65 إلى IM20', 'Held lots and moved mould': 'حُجزت الدفعات ونُقل القالب', 'Repair burner and hold lots': 'إصلاح الموقد وحجز الدفعات',
    'Roll back to v3.1.4': 'الرجوع إلى الإصدار v3.1.4', 'Release 1,200 panels from the bonded warehouse': 'الإفراج عن 1,200 لوحة عرض من المستودع الجمركي', 'Order 1,500 from the backup vendor': 'طلب 1,500 من المورد الاحتياطي',
    'Expedite by air': 'الاستعجال بالشحن الجوي', 'Air freight': 'شحن جوي', 'Move 6 operators from line 6 and 2 h overtime': 'نقل 6 مشغلين من الخط 6 مع ساعتي عمل إضافي', 'Moved operators': 'نُقل المشغلون',
    'Take 39 boards from production': 'سحب 39 لوحة من الإنتاج', 'Do nothing': 'عدم التدخل', 'Raise speed to 108%': 'رفع السرعة إلى 108%', 'Change model': 'تغيير الموديل',
    'More QLED 75, the model with the least cover': 'زيادة QLED 75، الموديل الأقل تغطية',
    'Back-cover short shots traced to IM10': 'نقص حقن الأغطية الخلفية مصدره IM10', 'Paint peeling traced to the Press line 4 coating oven': 'تقشر الطلاء مصدره فرن الطلاء في خط الكبس 4', 'Firmware v3.2.0 fails the function test': 'البرمجيات v3.2.0 تفشل في الاختبار الوظيفي',
    'Breakdown avoided on Mounter B. About EGP 1.9M protected.': 'تُجنّب عطل في ماكينة التركيب B، وحُمي إنتاج بقيمة 1.9 مليون جنيه تقريبًا.',
    // states and reasons
    'Vacuum loss': 'فقد التفريغ', 'Servo overload': 'حمل زائد على المحرك المؤازر', 'Hydraulic pressure low': 'ضغط هيدروليكي منخفض', 'Sensor fault': 'عطل في الحساس',
    'vision retry': 'إعادة محاولة الرؤية', 'jam at infeed': 'انحشار عند المدخل', 'sensor blocked': 'حساس محجوب', 'part fit issue': 'مشكلة في تركيب القطعة', 'operator waiting for help': 'المشغل ينتظر المساعدة',
    'feeder splice': 'وصل شريط المغذي', 'robot pick retry': 'إعادة محاولة الالتقاط الآلي', 'part stuck in mould': 'قطعة عالقة في القالب', 'waiting for coated parts': 'بانتظار القطع المطلية',
    'Coating oven stopped': 'توقف فرن الطلاء', 'No machine is stopped.': 'لا توجد ماكينة متوقفة.', 'Repairing': 'قيد الإصلاح', 'Available': 'متاح', 'Maintenance shop': 'ورشة الصيانة', 'Wearing': 'يتآكل', 'Normal': 'طبيعي',
    'Breakdown': 'عطل مفاجئ', 'Preventive': 'وقائية', 'Predictive': 'تنبؤية', 'Corrective': 'تصحيحية', 'Completed': 'مكتمل', 'Scheduled': 'مجدول', 'In progress': 'قيد التنفيذ', 'Under investigation': 'قيد التحقيق',
    'Shipped': 'شُحن', 'Loading': 'جارٍ التحميل', 'Receiving': 'جارٍ الاستلام', 'On time': 'في الموعد', 'Late': 'متأخر', 'Off': 'متوقف', 'Loaded': 'محمّل', 'Due': 'الاستحقاق',
    'Spindle bearing change (vibration trend)': 'تغيير محمل عمود الدوران (اتجاه الاهتزاز)', 'Nozzle and feeder clean (weekly)': 'تنظيف الفوهات والمغذيات (أسبوعي)', 'Mould cooling-circuit flush (monthly)': 'غسل دائرة تبريد القالب (شهري)',
    'Die lubrication and bolt torque check (weekly)': 'تزييت القالب وفحص عزم ربط المسامير (أسبوعي)', 'Screwdriver torque calibration (quarterly)': 'معايرة عزم المفكات (ربع سنوي)',
    'Solder bridge': 'جسر لحام', 'No Wi-Fi': 'لا يعمل Wi-Fi', 'Firmware v3.2.0 HDMI-CEC handling': 'معالجة HDMI-CEC في البرمجيات v3.2.0', 'Burner fault on the press line 4 coating oven': 'عطل الموقد في فرن الطلاء بخط الكبس 4', 'Worn check ring on IM10': 'تآكل حلقة عدم الرجوع في IM10',
    'Chassis paint peeling': 'تقشر طلاء الهيكل', 'Back cover short shot': 'نقص حقن الغطاء الخلفي', 'Missing component': 'مكوّن ناقص', 'HDMI-CEC handshake fail': 'فشل مصافحة HDMI-CEC', 'Scratch on bezel': 'خدش في الإطار', 'Gap at back cover': 'فجوة عند الغطاء الخلفي',
    // people
    'You': 'أنت', 'Plant manager': 'مدير المصنع', 'Operator': 'مشغل', 'Line leader': 'قائد الخط', 'Technician': 'فني', 'Rework technician': 'فني إعادة التشغيل', 'Milk-run driver': 'سائق قطار الإمداد', 'Forklift driver': 'سائق رافعة شوكية',
    'Tarek Samir': 'طارق سمير', 'Hany Zaki': 'هاني زكي', 'Tarek Reda': 'طارق رضا', 'Nour Kamal': 'نور كمال', 'Amr Saad': 'عمرو سعد', 'Hossam Ehab': 'حسام إيهاب',
    // utilities, areas, customers, systems
    'Compressor 1': 'الضاغط 1', 'Compressor 2': 'الضاغط 2', 'Compressor 3': 'الضاغط 3', 'Chiller 1': 'المبرد 1', 'Chiller 2': 'المبرد 2', 'Transformer T1': 'المحول T1', 'Transformer T2': 'المحول T2', 'Steam boiler (cushions)': 'غلاية البخار (الوسائد)',
    'Cushions': 'الوسائد', 'Lighting, offices, IT': 'الإنارة والمكاتب وتقنية المعلومات', 'Offices': 'المكاتب', 'Press, coating and sub-assembly': 'الكبس والطلاء والتجميع الفرعي', 'Main assembly': 'التجميع الرئيسي', 'Test, aging and QA': 'الاختبار والتعتيق والجودة', 'Pack and pallet': 'التعبئة والرصّ',
    'Open cell load': 'تحميل الخلايا المفتوحة', 'BLU assembly': 'تجميع الإضاءة الخلفية', 'ICT and FCT': 'ICT وFCT', 'Function test and final QC': 'الاختبار الوظيفي والفحص النهائي', 'Import': 'الاستيراد', 'Local': 'محلي',
    'Bluepeak Stores': 'متاجر بلوبيك', 'Horizon Electronics': 'هورايزن للإلكترونيات', 'Northline Retail': 'نورثلاين للتجزئة', 'Eastgate Trading': 'إيستغيت للتجارة', 'Retail chain': 'سلسلة تجزئة', 'Distributor': 'موزع', 'Export': 'تصدير', 'B2B projects': 'مشروعات الشركات',
    'IoT': 'إنترنت الأشياء', 'HR': 'الموارد البشرية', 'PE': 'هندسة الإنتاج', 'IQC': 'فحص الوارد', 'EMS': 'نظام إدارة الطاقة', 'Vision': 'الرؤية الآلية', 'AI': 'الذكاء الاصطناعي'
  },
  patterns: [
    ['^(.+): (vision retry|jam at infeed|sensor blocked|part fit issue|operator waiting for help|feeder splice|robot pick retry|part stuck in mould|waiting for coated parts)$', '$1: $2'],
    ['^(.+?)(Stopped|Running|Starved|Blocked|Idle)$', '$1 · $2'],
    ['^(.+) stopped$', 'توقف $1'], ['^(.+) restarted$', 'استُؤنف تشغيل $1'],
    ['^(.+) \\((.+)\\) back in production after unplanned repair$', 'عادت $1 ($2) إلى الإنتاج بعد إصلاح غير مخطط'],
    ['^(.+) \\((.+)\\) back in production after planned repair$', 'عادت $1 ($2) إلى الإنتاج بعد إصلاح مخطط'],
    ['^(.+) on site at (.+)$', 'وصل $1 إلى $2'], ['^(.+) dispatched to (.+)$', 'أُرسل $1 إلى $2'],
    ['^(.+ agent) needs you: (.+)$', '$1 بانتظار قرارك: $2'], ['^(.+ agent): (.+)$', '$1: $2'], ['^· (.+ agent)$', '· $1'],
    ['^([^:;]+) on (.+) runs out of (.+) in ([\\d:]+) min$', 'سينفد مخزون $3 في محطة $1 ب$2 خلال $4 دقيقة'],
    ['^([^:;]+) on (.+) runs out of (.+) in ([\\d:]+) min: (.+)$', 'سينفد مخزون $3 في محطة $1 ب$2 خلال $4 دقيقة: $5'],
    ['^([^:;]+) on (.+) runs out of (.+) in ([\\d:]+) min(.+ agent)$', 'سينفد مخزون $3 في محطة $1 ب$2 خلال $4 دقيقة · $5'],
    ['^([^:;]+) runs out of (.+) in ([\\d:]+) min$', 'سينفد مخزون $2 في محطة $1 خلال $3 دقيقة'], ['^([^:;]+) runs out of (\\S+)$', 'سينفد مخزون $2 في محطة $1'], ['^([^:;]+) on (.+) runs out of (\\S+) in ([\\d:]+) min\\. (.+)$', 'سينفد مخزون $3 في محطة $1 ب$2 خلال $4 دقيقة. $5'], ['^([^:;]+) runs out for assembly$', 'سينفد مخزون $1 اللازم للتجميع'], ['^([^:;]+) runs out for assembly in$', 'سينفد مخزون $1 اللازم للتجميع خلال'],
    ['^; (.+) runs out of (.+) in$', '؛ وسينفد مخزون $2 في محطة $1 خلال'], ['^; (.+) runs out for assembly in$', '؛ وسينفد مخزون $1 اللازم للتجميع خلال'],
    ['^Next if nobody acts: (.+) runs out of (.+) in$', 'المتوقع إن لم يُتخذ إجراء: سينفد مخزون $2 في محطة $1 خلال'], ['^Next if nobody acts: (.+) runs out for assembly in$', 'المتوقع إن لم يُتخذ إجراء: سينفد مخزون $1 اللازم للتجميع خلال'],
    ['^the PBA supermarket is empty too$', 'كما أن سوبر ماركت PBA فارغ'],
    ['^([^:;]+) runs out for (.+) in ([\\d:]+) min$', 'سينفد مخزون $1 اللازم ل$2 خلال $3 دقيقة'],
    ['^(.+) packing runs out of cartons in (\\d+) h (\\d+) min$', 'ستنفد كراتين التعبئة في $1 خلال $2 ساعة و$3 دقيقة'],
    ['^(.+) panels run out in (\\d+) h (\\d+) min: the container is held at the port$', 'ستنفد لوحات العرض $1 خلال $2 ساعة و$3 دقيقة؛ فالحاوية محتجزة في الميناء'],
    ['^(.+) on (.+) will fail in about ([\\d:]+) min$', 'يُتوقع تعطل $1 في $2 خلال نحو $3 دقيقة'],
    ['^Demand peak forecast ([\\d,]+) kW against the ([\\d,]+) kW contract$', 'ذروة الطلب المتوقعة $1 كيلوواط مقابل تعاقد $2 كيلوواط'],
    ['^Main line (\\d) is short of (\\d+) operators$', 'يحتاج خط التجميع الرئيسي $1 إلى $2 مشغل إضافي'],
    ['^Service centres wait for (\\d+) (.+) boards; the service store has (\\d+)$', 'تنتظر مراكز الخدمة $1 لوحة $2، وفي مخزن الخدمة $3'],
    ['^MRP: (.+): needed in (W\\d+) but the (\\d+)-day lead time cannot be met$', 'MRP: $1 مطلوب في الأسبوع $2، ولا يمكن الوفاء بزمن التوريد البالغ $3 يومًا'],
    ['^SMD line (\\d) Mounter B vibration trend changed slope$', 'تغيّر ميل اتجاه اهتزاز ماكينة التركيب B في خط SMD $1'],
    ['^(\\d+) operators absent on main line (\\d) \\(shift (\\w)\\)$', 'غياب $1 مشغل عن خط التجميع الرئيسي $2 (الوردية $3)'],
    ['^Simulated (\\d+) options? over the next (\\d+) h; recommending: (.+)\\.$', 'حاكى الوكيل $1 خيار على مدى $2 ساعة، ويوصي بـ«$3».'],
    ['^Acted on my own \\(Auto\\): (.+)\\. Logged as (AUD-\\d+)\\.$', 'نفّذتُ من تلقاء نفسي (الوضع التلقائي): $1. وسُجّل الإجراء برقم $2.'],
    ['^Went ahead with "(.+)" after two minutes without a veto\\. Logged as (AUD-\\d+)\\.$', 'مضيتُ في تنفيذ «$1» بعد دقيقتين دون اعتراض، وسُجّل برقم $2.'],
    ['^Low risk and reversible: I will go ahead with "(.+)" at ([\\d:]+) unless someone vetoes it\\.$', 'إجراء منخفض المخاطر وقابل للتراجع: سأمضي في «$1» عند $2 ما لم يعترض أحد.'],
    ['^Logistics agent sent (AGV-\\d+) on a hot run: (\\d+) (.+) to (.+)$', 'أرسل وكيل اللوجستيات $1 في مهمة إمداد عاجل: $2 من $3 إلى $4'],
    ['^(.+) is already bringing (.+) to (.+)$', '$1 في طريقه بالفعل بحمولة $2 إلى $3'], ['^Enough (.+) is already on its way to (.+)$', 'كمية كافية من $1 في طريقها بالفعل إلى $2'],
    ['^(.+) to (Back cover|PBA and SMPS|Screw and stand|LCM input|Packing)$', '$1 إلى $2'],
    ['^Breakdown avoided on (.+): about (\\d+) minutes of downtime and (.+) of output protected$', 'تجنّب عطل في $1: حماية نحو $2 دقيقة من التوقف و$3 من الإنتاج'],
    ['^(.+) \\((.+)\\) bearing change now, (\\d+) min$', 'تغيير محمل $1 ($2) فورًا، $3 دقيقة'],
    ['^(\\d+) lots of (.+) held · (.+) on (.+)$', 'حجز $1 دفعة من $2 · $3 في $4'],
    ['^(.+) received into the (.+)$', 'استُلمت $1 في $2'], ['^(.+) leaves (.+) \\(most cover\\) after a (\\d+)-minute changeover$', 'يترك $1 الموديل $2 (الأعلى تغطية) بعد تغيير موديل مدته $3 دقيقة'],
    ['^(.+) to (\\d+)%$', '$1 إلى $2%'], ['^(.+) to (QLED|UHD) (\\d+)$', '$1 إلى $2 $3'], ['^New model for (.+)$', 'موديل جديد ل$1'],
    ['^(.+) stops for (\\d+) minutes$', 'يتوقف $1 لمدة $2 دقيقة'], ['^Main line (\\d) short of (\\d+) operators$', 'نقص $2 مشغل في خط التجميع الرئيسي $1'],
    ['^(SMD|LCM) lines? (\\d) and (\\d) restarted$', 'أُعيد تشغيل خطي $1 $2 و$3'],
    ['^Back cover: waiting for back cover (\\d+)"$', 'الغطاء الخلفي: بانتظار غطاء خلفي $1 بوصة'],
    ['^(IM\\d+) injection pressure \\((\\d+)" back covers\\)$', 'ضغط الحقن في $1 (أغطية خلفية $2 بوصة)'],
    ['^Main board assembly \\(PBA\\) (\\d+)"$', 'تجميع اللوحة الرئيسية (PBA) $1 بوصة'],
    ['^AGV-(\\d+) on its way$', 'المركبة AGV-$1 في الطريق'], ['^Held up: (.+)$', 'تأخير: $1'],
    ['^([\\d,]+) kW load$', 'حمل $1 كيلوواط'], ['^([\\d.,]+) kW$', '$1 كيلوواط'], ['^([\\d.,]+) kWh$', '$1 كيلوواط ساعة'], ['^([\\d.,]+) mm/s$', '$1 مم/ث'],
    ['^Health (\\d+)$', 'الصحة $1'], ['^Priority (\\d)$', 'الأولوية $1'], ['^Step (\\d+)$', 'الخطوة $1'], ['^(\\d+) open$', '$1 مفتوحة'], ['^(\\d+) waiting$', '$1 بانتظار القرار'], ['^(\\d+) low$', '$1 منخفضة المخزون'],
    ['^([+−-]?\\d+) TVs$', '$1 جهاز'], ['^±0 TVs$', '±0 جهاز'], ['^([+−-]\\d+) late orders?$', '$1 طلبية متأخرة'],
    ['^in ([\\d:]+) min$', 'خلال $1 دقيقة'], ['^outside air ([\\d.]+) °C$', 'الهواء الخارجي $1 °م'], ['^([\\d.]+) kWh a TV packed$', '$1 كيلوواط ساعة لكل جهاز معبأ'],
    ['^(\\d+) on the next lap$', '$1 في الجولة التالية'], ['^milk run (T\\d)$', 'قطار الإمداد $1'], ['^· (\\d+) × (.+)$', '· $1 × $2'],
    ['^(\\d+)signals$', '$1 إشارة'], ['^(\\d+)acted alone$', '$1 تصرّف منفرد']
  ]
});
/* the 3D plant's own panels: views, departments, SAP and data flow, S&OP, MRP, stores, vehicles, the drill cases and the escalation */
DFI18N.add({
  exact: {
    // views and controls
    'Walk': 'السير', 'Fly-through': 'الطيران عبر المصنع', 'Cameras': 'الكاميرات', 'X-ray': 'الأشعة', 'Play the replay': 'شغّل إعادة العرض', 'Time in the replay': 'الوقت في إعادة العرض', 'Data': 'البيانات',
    'Walk the floor at eye height': 'تجوّل في أرض المصنع بمستوى العين', 'Fly through the plant': 'حلّق عبر المصنع', 'Camera feeds': 'بث الكاميرات', 'See inside the machines': 'انظر داخل الماكينات', 'Find a serial number': 'ابحث عن رقم تسلسلي',
    '3D factory': 'المصنع ثلاثي الأبعاد', 'SAP and data flow': 'SAP وتدفق البيانات', 'Departments': 'الإدارات', 'Function test and final QA': 'الاختبار الوظيفي وفحص الجودة النهائي', 'What the colours show': 'ماذا تعني الألوان',
    'Ways to see the plant': 'طرق رؤية المصنع', 'Walk actions': 'إجراءات السير', 'Real time (1)': 'الوقت الحقيقي (1)', 'Four times (2)': 'أربعة أضعاف (2)', 'Sixteen times (3)': 'ستة عشر ضعفًا (3)', 'Replay the last 45 minutes (R)': 'أعد عرض آخر 45 دقيقة (R)',
    'Find a serial, e.g. TV26-…': 'ابحث عن رقم تسلسلي، مثل TV26-…', 'Guided tour (G)': 'جولة إرشادية (G)', 'Plant views': 'عروض المصنع', 'Plant map. Select a point to go there.': 'خريطة المصنع، اختر نقطة للانتقال إليها.', 'Plant clock': 'ساعة المصنع', 'Simulation speed': 'سرعة المحاكاة', 'Views of the plant': 'عروض المصنع',
    '3D view of Plant EG-01. Select any machine, store, vehicle, person, office or unit; the panel beside the view describes it.': 'عرض ثلاثي الأبعاد للمصنع EG-01. اختر أي ماكينة أو مخزن أو مركبة أو شخص أو مكتب أو وحدة، وستصفه اللوحة المجاورة.',
    'Material and information flow, vendor to customer': 'تدفق المواد والمعلومات، من المورد إلى العميل', 'Fast-forward 10 min': 'تقديم 10 دقائق', 'Stop tour': 'إيقاف الجولة', 'Leave walk': 'الخروج من وضع السير', 'F or click for details': 'اضغط F أو انقر للتفاصيل',
    'Start a real-world drill. Watch the cause travel through the lines, the stores and the offices, and the departments respond.': 'ابدأ تمرينًا واقعيًا، وتابع السبب وهو ينتقل عبر الخطوط والمخازن والمكاتب، واستجابة الإدارات له.',
    'Walking the floor at eye height. Machines, conveyors and vehicles block the way, and vehicles stop for you.': 'تتجول في أرض المصنع بمستوى العين؛ الماكينات والسيور والمركبات تعترض الطريق، والمركبات تتوقف لك.',
    'Aisle': 'الممر', 'Walk me to Mounter B': 'خذني إلى ماكينة التركيب B', 'Select for its details': 'اختر لترى تفاصيله', 'Show in 3D': 'العرض بالأبعاد الثلاثية', 'Follow in 3D': 'المتابعة بالأبعاد الثلاثية', 'Show in the plant': 'العرض في المصنع', 'Plant EG-01, live': 'المصنع EG-01، مباشرة',
    'Six main TV assembly lines and every line that feeds them: six LCM, six SMD with software download, twenty injection machines, six press and coating lines, six cushion machines. Stores, milk runs, AGVs, forklifts, docks and offices, all moving because the model moves.': 'ستة خطوط رئيسية لتجميع أجهزة التلفزيون وكل خط يغذيها: ستة خطوط LCM، وستة خطوط SMD مع تحميل البرمجيات، وعشرون ماكينة حقن، وستة خطوط كبس وطلاء، وست ماكينات وسائد. المخازن وقطارات الإمداد والمركبات الموجهة آليًا والرافعات الشوكية والأرصفة والمكاتب، كلها تتحرك لأن النموذج يتحرك.',
    'Nine agents watch every machine, store, vehicle, order, kilowatt and camera. Before they recommend anything they simulate each option on a flow model of the whole plant for the next two hours (eight for material decisions), then the owner of the decision agrees it with the others. They act alone only on Auto and only when the action can be undone.': 'يراقب تسعة وكلاء كل ماكينة ومخزن ومركبة وطلبية وكيلوواط وكاميرا. وقبل أن يوصوا بشيء يحاكون كل خيار على نموذج تدفق للمصنع كله للساعتين القادمتين (وثماني ساعات لقرارات المواد)، ثم يتفق صاحب القرار عليه مع الآخرين. ولا يتصرفون وحدهم إلا في الوضع التلقائي وحين يكون الإجراء قابلًا للتراجع.',
    // escalation and andon
    'Team leader': 'قائد الفريق', 'Group leader': 'قائد المجموعة', 'Area manager': 'مدير المنطقة', 'Plant manager': 'مدير المصنع', 'Andon': 'الأندون', 'Approver': 'المعتمِد', 'A person (Approve)': 'شخص (بالموافقة)', 'The agent (Auto), reversible actions only': 'الوكيل (تلقائي)، للإجراءات القابلة للتراجع فقط',
    'escalates to the group leader after 1 min, the area manager after 5, the plant manager after 10; safety events go straight to the area manager': 'يُصعَّد إلى قائد المجموعة بعد دقيقة، ثم مدير المنطقة بعد 5 دقائق، ثم مدير المصنع بعد 10؛ وأحداث السلامة تذهب مباشرة إلى مدير المنطقة',
    // panels and labels
    'Signals': 'الإشارات', 'Acted': 'نفّذ', 'Watching': 'يراقب', 'free': 'متاح', 'Confirmed': 'مؤكد', 'Finance': 'المالية', 'Sales': 'المبيعات', 'BOM team': 'فريق قوائم المواد', 'GMES and IT': 'GMES وتقنية المعلومات', 'Planning': 'التخطيط', 'Production': 'الإنتاج', 'Purchasing': 'المشتريات', 'Integration': 'التكامل',
    'Orders late': 'الطلبيات المتأخرة', 'Slow, short stop or starved': 'بطء أو توقف قصير أو نقص مواد', 'Planned work': 'عمل مخطط', 'Live signals': 'الإشارات الحية', 'Failure forecast': 'توقع العطل', 'Short stops': 'التوقفات القصيرة', 'Units done': 'الوحدات المنجزة',
    'Rejected here': 'المرفوض في هذه المحطة', 'Linked to': 'مرتبط بـ', 'Events here': 'أحداث هذه المحطة', 'no failure expected this shift': 'لا يُتوقع عطل في هذه الوردية', 'Choose': 'اختيار', 'Documents': 'المستندات', 'SAP, GMES and decisions': 'SAP وGMES والقرارات', 'Downstream': 'المرحلة اللاحقة', 'Upstream': 'المرحلة السابقة',
    'Show supermarket': 'عرض السوبر ماركت', 'MRP': 'تخطيط احتياجات المواد MRP', 'Direct cost': 'التكلفة المباشرة', 'Output lost': 'الإنتاج الضائع', 'Decide': 'اتخاذ القرار', 'Trigger': 'المُطلِق', 'given when decided': 'يُمنح عند القرار', 'panel modules': 'وحدات عرض', '100% on time': '100% في الموعد',
    'Time lost here': 'الوقت الضائع في هذه المحطة', 'by reason code': 'حسب رمز السبب', 'Nothing logged yet.': 'لم يُسجَّل شيء بعد.', 'Now inside': 'بالداخل حاليًا', 'Breakdown': 'عطل', 'Vacuum loss': 'فقدان التفريغ', 'Working on a decision': 'يعمل على قرار', 'PLM': 'إدارة دورة حياة المنتج PLM',
    'PBA repair bench': 'منضدة إصلاح PBA', 'Rework benches': 'مناضد إعادة التشغيل', 'How the agents agreed': 'كيف توافق الوكلاء', 'Injection supermarket': 'سوبر ماركت الحقن', 'Options simulated by the Scheduling agent': 'الخيارات التي حاكاها وكيل الجدولة', 'Service-parts store': 'مخزن قطع الخدمة',
    'followed the recommendation': 'اتبع التوصية', 'Chassis supermarket': 'سوبر ماركت الهياكل', 'Main-line use': 'استهلاك خطوط التجميع', 'The SMD line that makes these boards is stopped; the supermarket will run dry before it restarts.': 'خط SMD الذي يصنع هذه اللوحات متوقف، وسينفد السوبر ماركت قبل أن يعود للعمل.',
    '10-minute changeover': 'تغيير موديل في 10 دقائق', 'OEE loss tree': 'شجرة خسائر OEE', 'Measured at': 'مقيسة عند', 'Top reason codes on Main line 1': 'أهم رموز الأسباب في خط التجميع الرئيسي 1',
    ', the constraint of Main line 1. Six big losses, plus the time it waited on the stations around it, since the model started.': '، عنق الزجاجة في خط التجميع الرئيسي 1. الخسائر الست الكبرى، إضافة إلى وقت انتظاره للمحطات المحيطة به، منذ بدء النموذج.',
    'Planned maintenance': 'صيانة مخططة', 'Planned stop, outside OEE': 'توقف مخطط، خارج حساب OEE', 'Breakdowns': 'الأعطال', 'Availability': 'الإتاحة', 'Setup and changeover': 'الإعداد وتغيير الموديل', 'Small stops': 'التوقفات الصغيرة', 'Performance': 'الأداء',
    'Starved or blocked': 'نقص في المواد أو امتلاء في المرحلة التالية', 'Flow loss from other stations': 'خسارة تدفق من محطات أخرى', 'Reduced speed': 'السرعة المنخفضة', 'Defects and rework': 'العيوب وإعادة التشغيل', 'Quality': 'الجودة', 'Fully productive': 'إنتاج كامل', 'OEE of the constraint': 'OEE لعنق الزجاجة',
    'Draft A': 'المسودة أ', 'Draft B': 'المسودة ب', 'Draft C': 'المسودة ج', 'Changeovers': 'تغييرات الموديل', 'Speed and changeover together': 'السرعة وتغيير الموديل معًا', 'Main assembly lines and the sub-lines that feed them': 'خطوط التجميع الرئيسية والخطوط الفرعية التي تغذيها',
    'WIP': 'الإنتاج تحت التشغيل', 'Stores and supermarkets': 'المخازن والسوبر ماركت', 'PBA supermarket (boards)': 'سوبر ماركت PBA (اللوحات)', 'Milk runs, AGVs and forklifts': 'قطارات الإمداد والمركبات الموجهة آليًا والرافعات الشوكية', 'Shipping docks': 'أرصفة الشحن',
    'Hydraulic pressure low': 'ضغط هيدروليكي منخفض', 'D1 Team': 'D1 الفريق', 'D2 Describe': 'D2 الوصف', 'D3 Contain': 'D3 الاحتواء', 'D5 Corrective action': 'D5 الإجراء التصحيحي', 'D6 Verify': 'D6 التحقق', 'D7 Prevent recurrence': 'D7 منع التكرار', 'D8 Close': 'D8 الإغلاق',
    'Jam at infeed': 'انحشار عند المدخل', 'Servo overload': 'حمل زائد على المحرك المؤازر', 'Sensor blocked': 'حساس محجوب', 'Sensor fault': 'عطل في الحساس', 'Output today': 'إنتاج اليوم', 'Stations': 'المحطات', 'Question for the agents': 'سؤال للوكلاء', 'SAP production order': 'أمر إنتاج SAP',
    'Used today': 'المستهلك اليوم', '1 held at port': 'حاوية واحدة محتجزة في الميناء', 'Needs a decision': 'بانتظار قرار', 'Qty': 'الكمية', '30 production orders released for shift A': 'أُصدر 30 أمر إنتاج للوردية A', 'What happens next': 'ما يُتوقع بعد ذلك', 'if nobody acts': 'إن لم يُتخذ إجراء',
    'Next orders to ship': 'الطلبيات التالية للشحن', 'SAP and GMES': 'SAP وGMES', 'Live events': 'الأحداث الحية', 'decisions prepared': 'قرارات أُعدّت', 'plant simulations run': 'عمليات محاكاة للمصنع', 'acted on Auto': 'إجراء تلقائي', 'output protected': 'إنتاج محمي', 'Open decisions': 'القرارات المفتوحة', 'Next two hours': 'الساعتان القادمتان',
    'Forecast of TVs packed over the next two hours, against plan': 'توقع الأجهزة المعبأة خلال الساعتين القادمتين، مقابل الخطة', 'Recently decided': 'ما تقرر مؤخرًا', 'each with its audit ID, who approved it, and what the simulation promised': 'كل منها برقم تدقيقه، ومن اعتمده، وما وعدت به المحاكاة',
    'Safety and vision': 'السلامة والرؤية', 'stills from the camera feeds when the AI sees a hazard': 'لقطات من بث الكاميرات عندما يرصد الذكاء الاصطناعي خطرًا',
    'No hazard seen. Turn on Cameras in the 3D factory: the AI watches the four feeds for forklift near misses and missing safety glasses.': 'لم يُرصد خطر. شغّل الكاميرات في المصنع ثلاثي الأبعاد، وسيراقب الذكاء الاصطناعي البث الأربعة بحثًا عن حوادث وشيكة للرافعات الشوكية وغياب نظارات السلامة.',
    'Reasoning feed': 'سجل الاستدلال', 'Decision log': 'سجل القرارات', 'Line-side stock': 'مخزون جانب الخط', 'Chase plan': 'خطة الملاحقة', 'Materials': 'المواد', 'IQC on receipts, IPQC on the lines, OQC before shipping, the lab, holds': 'فحص الوارد عند الاستلام، وفحص أثناء التشغيل على الخطوط، وفحص قبل الشحن، والمختبر، والإيقافات',
    'DPPM': 'العيوب لكل مليون DPPM', 'IQC lots open': 'دفعات فحص الوارد المفتوحة', 'Customers, order book, ATP promises, demand forecast': 'العملاء ودفتر الطلبيات ووعود التوافر وتوقع الطلب', 'Open orders': 'الطلبيات المفتوحة', 'Open value': 'القيمة المفتوحة', 'ATP short': 'نقص في التوافر',
    'S&OP, master production schedule, MRP, line loading': 'تخطيط المبيعات والعمليات، وجدول الإنتاج الرئيسي، وتخطيط احتياجات المواد، وتحميل الخطوط', 'Plan attainment': 'تحقيق الخطة', 'MRP exceptions': 'استثناءات MRP',
    'Purchase orders, import and local vendors, warehouses, milk runs, AGVs': 'أوامر الشراء، وموردو الاستيراد والموردون المحليون، والمستودعات، وقطارات الإمداد، والمركبات الموجهة آليًا', 'Deliveries on the way': 'التوريدات في الطريق', 'Held at port': 'محتجز في الميناء', 'Milk-run laps': 'دورات قطار الإمداد', 'AGV missions': 'مهام المركبات الموجهة آليًا',
    'Electrical, mechanical and software engineers; machines, jigs, firmware releases, maintenance': 'مهندسو الكهرباء والميكانيكا والبرمجيات؛ الماكينات والتجهيزات وإصدارات البرمجيات والصيانة', 'Machines down': 'ماكينات متوقفة', 'Technicians busy': 'فنيون مشغولون', 'Open ECNs': 'إشعارات التغيير الهندسي المفتوحة', 'PBA 55 firmware': 'برمجيات PBA 55',
    'Bills of materials, engineering-change effectivity, material master': 'قوائم المواد، وسريان التغييرات الهندسية، والبيانات الرئيسية للمواد', 'Active BOMs': 'قوائم المواد السارية', 'Pending effectivity': 'سريان معلق', 'BOM accuracy': 'دقة قوائم المواد',
    'Spare parts for service centres and customers, field-failure feedback': 'قطع الغيار لمراكز الخدمة والعملاء، وملاحظات أعطال الميدان', 'Service orders': 'أوامر الخدمة', 'Back orders': 'الطلبيات المؤجلة', 'PBA 55 in store': 'PBA 55 في المخزن',
    'Attendance, skills matrix, overtime, hiring and training': 'الحضور ومصفوفة المهارات والعمل الإضافي والتوظيف والتدريب', 'On the floor': 'في أرض المصنع', 'Absent': 'غائب', 'Headcount': 'عدد العاملين', 'Overtime today': 'العمل الإضافي اليوم',
    'Revenue, product cost, inventory value, budgets, approvals': 'الإيرادات وتكلفة المنتج وقيمة المخزون والموازنات والاعتمادات', 'Gross margin': 'هامش الربح الإجمالي', 'Inventory value': 'قيمة المخزون', 'Protected by decisions': 'محمي بالقرارات',
    'Six main assembly lines and all sub-lines, shifts, output': 'ستة خطوط تجميع رئيسية وكل الخطوط الفرعية والورديات والإنتاج', 'Lines running': 'الخطوط العاملة', 'TVs in process': 'أجهزة قيد التصنيع', 'GMES, SAP interfaces, networks, data': 'GMES وواجهات SAP والشبكات والبيانات',
    'Messages a minute': 'رسائل في الدقيقة', 'Interfaces up': 'الواجهات العاملة', 'Lines online': 'الخطوط المتصلة', 'Last SAP sync': 'آخر مزامنة مع SAP', 'Accessory kit (remote, cables, manual)': 'طقم الملحقات (جهاز التحكم والكابلات والدليل)', 'Feeds': 'يغذّي', 'Delivery': 'التوريد',
    'Options simulated by the Quality agent': 'الخيارات التي حاكاها وكيل الجودة', 'Stops the defects at the source': 'يوقف العيوب من مصدرها', 'Keep running and sort at final QA': 'الاستمرار والفرز عند فحص الجودة النهائي', 'Rework cost and escape risk rise': 'ترتفع تكلفة إعادة التشغيل وخطر تسرب العيوب',
    'Departments working as one': 'إدارات تعمل كفريق واحد', "From the customer's order to the invoice": 'من طلبية العميل إلى الفاتورة', 'S&OP and MPS': 'تخطيط المبيعات والعمليات وجدول الإنتاج الرئيسي',
    'Order to cash and plan to produce, end to end. Each department works in its own system; SAP and GMES keep them on the same numbers. Select a department to see its people, numbers, decisions and messages.': 'من الطلبية إلى التحصيل ومن الخطة إلى الإنتاج، من البداية إلى النهاية. تعمل كل إدارة في نظامها، ويبقيها SAP وGMES على الأرقام نفسها. اختر إدارة لترى أفرادها وأرقامها وقراراتها ورسائلها.',
    'statistical process control, a Pareto of defects, and nonconformance reports worked through the 8D steps': 'ضبط العمليات الإحصائي، وتحليل باريتو للعيوب، وتقارير عدم المطابقة المعالجة بخطوات 8D', 'IM10 injection pressure': 'ضغط الحقن في IM10', 'Press line 4 coating-oven temperature': 'حرارة فرن الطلاء في خط الكبس 4',
    'work orders open': 'أوامر عمل مفتوحة', 'mean time to repair': 'متوسط زمن الإصلاح', 'mean time between failures, per machine': 'متوسط الزمن بين الأعطال، لكل ماكينة', 'technicians free': 'فنيون متاحون', 'Work order': 'أمر العمل', 'Station on Main line 3': 'محطة في خط التجميع الرئيسي 3', 'Operators': 'المشغلون',
    'expired': 'منتهية', 'I in training': 'I قيد التدريب', 'L works with help': 'L يعمل بمساعدة', 'U certified': 'U معتمد', 'O can train others': 'O يمكنه تدريب غيره', 'Injection pressure': 'ضغط الحقن', 'Cavity fill': 'امتلاء التجويف', 'Purchase orders': 'أوامر الشراء', 'Show IM10': 'عرض IM10', 'Show stock': 'عرض المخزون', 'Service order': 'أمر الخدمة',
    'Cure temperature': 'حرارة المعالجة', 'Spindle vibration': 'اهتزاز عمود الدوران', 'Placements': 'عمليات التركيب', 'Preventive': 'وقائية', 'Predictive': 'تنبؤية', 'Nozzle and feeder clean (weekly)': 'تنظيف الفوهات والمغذيات (أسبوعي)', 'Spindle bearing change (vibration trend)': 'تغيير محمل عمود الدوران (اتجاه الاهتزاز)',
    'Mould cooling-circuit flush (monthly)': 'غسل دائرة تبريد القالب (شهري)', 'Die lubrication and bolt torque check (weekly)': 'تزييت القالب وفحص عزم المسامير (أسبوعي)', 'Screwdriver torque calibration (quarterly)': 'معايرة عزم المفكات (ربع سنوي)',
    'Line-side stock at': 'مخزون جانب الخط عند', 'Reorder point': 'نقطة إعادة الطلب', 'Fed by': 'تغذّيه', 'Comes from': 'المصدر', 'Lots here': 'الدفعات في هذه المحطة', 'Show oven': 'عرض الفرن', 'In transit': 'في الطريق', 'Defects by code and station': 'العيوب حسب الرمز والمحطة', 'Pareto since the model started': 'باريتو منذ بدء النموذج',
    '8D progress': 'تقدم خطوات 8D', 'Root cause and action': 'السبب الجذري والإجراء', 'Show function test': 'عرض الاختبار الوظيفي', 'Vision retry': 'إعادة محاولة الرؤية', 'No delivery needed yet.': 'لا حاجة إلى توريد بعد.', 'bar': 'بار', 'In progress': 'قيد التنفيذ',
    'Stand set, small': 'طقم القاعدة، صغير', 'Stand set, large': 'طقم القاعدة، كبير', 'yes: its speed sets the line output': 'نعم: سرعتها تحدد إنتاج الخط', 'Parts in the oven': 'القطع داخل الفرن', 'Show station': 'عرض المحطة', 'in control': 'تحت السيطرة', 'Barrel': 'الأسطوانة', 'Shots on this mould': 'الحقنات على هذا القالب',
    'Moulding': 'الحقن', 'Cycle': 'الدورة', 'Goes to': 'الوجهة', 'Sub-lines feeding it': 'الخطوط الفرعية التي تغذيه', 'Owns': 'المسؤوليات', 'Works in': 'مكان العمل', 'Its messages': 'الرسائل', 'Nothing waiting for this department.': 'لا يوجد ما ينتظر هذه الإدارة.', 'Order from backup vendor': 'الطلب من المورد الاحتياطي', 'Release under concession': 'الإفراج بتنازل جودة',
    'Robot pick retry': 'إعادة محاولة التقاط الروبوت', 'Hold the IM10 lots and move the mould to IM20.': 'حجز دفعات IM10 ونقل القالب إلى IM20.', 'IM20 needs 40 minutes for the mould change; the injection supermarket covers BC-65 for about that long.': 'تحتاج IM20 إلى 40 دقيقة لتغيير القالب، ويغطي سوبر ماركت الحقن BC-65 نحو تلك المدة.',
    'Genealogy: every TV rejected for a short shot carries a back-cover lot from IM10 (3 lots).': 'سجل النسب: كل جهاز رُفض لنقص الحقن يحمل دفعة أغطية خلفية من IM10 (3 دفعات).', 'No messages yet.': 'لا توجد رسائل بعد.', 'Options simulated by the Logistics agent': 'الخيارات التي حاكاها وكيل اللوجستيات',
    'Every chassis that peeled at final QA was coated in this oven during the drop.': 'كل هيكل تقشر طلاؤه عند فحص الجودة النهائي طُلي في هذا الفرن أثناء الانخفاض.', 'Service level': 'مستوى الخدمة', 'Lost TVs': 'الأجهزة الضائعة', 'Overtime': 'العمل الإضافي', 'Margin, 12 weeks': 'الهامش، 12 أسبوعًا', 'Lost sales': 'المبيعات الضائعة',
    'Firmware': 'البرمجيات', 'Boards written': 'اللوحات المبرمجة', 'Firmware on PBA 55 writers': 'البرمجيات على أجهزة برمجة PBA 55', 'Function-test fails with it': 'إخفاقات الاختبار الوظيفي معها', 'All HDMI-CEC fails share firmware v3.2.0; boards with v3.1.4 pass. Released by PE today (ECN).': 'كل إخفاقات HDMI-CEC تشترك في البرمجيات v3.2.0، واللوحات ذات الإصدار v3.1.4 تنجح. أصدرتها هندسة الإنتاج اليوم (إشعار تغيير هندسي).',
    'Roll back the writers and re-flash the boards in stock.': 'إعادة أجهزة البرمجة إلى الإصدار السابق وإعادة برمجة اللوحات المخزنة.', 'Writers can switch image without stopping the SMD lines.': 'يمكن لأجهزة البرمجة تبديل الإصدار دون إيقاف خطوط SMD.', 'OC-65 on hand': 'OC-65 المتوفر', 'Container': 'الحاوية',
    'Lines 4 and 5 use about 260 open cells an hour; the next container is 5 days away.': 'يستهلك الخطان 4 و5 نحو 260 خلية مفتوحة في الساعة، والحاوية التالية بعد 5 أيام.', '1,200 panels sit in the bonded warehouse; customs release takes 2 hours.': 'توجد 1,200 لوحة عرض في المستودع الجمركي، والإفراج الجمركي يستغرق ساعتين.',
    'Or move line 5 to UHD 55: QLED 65 orders slip, UHD 55 orders are pulled in.': 'أو انقل الخط 5 إلى UHD 55: تتأخر طلبيات QLED 65 وتتقدم طلبيات UHD 55.', 'Bonded release costs EGP 38k; a slipped QLED 65 order delays about EGP 2.6M of revenue.': 'يكلف الإفراج الجمركي 38 ألف جنيه، بينما تؤخر طلبية QLED 65 المتأخرة نحو 2.6 مليون جنيه من الإيرادات.',
    'Wait for the container': 'انتظار الحاوية', 'SAP and GMES in sync': 'SAP وGMES متزامنان', 'No nonconformance open. An NCR opens when final QA or the function test sees the same defect three times in 30 minutes, or a drill starts one.': 'لا يوجد عدم مطابقة مفتوح. يُفتح تقرير عندما يرصد فحص الجودة النهائي أو الاختبار الوظيفي العيب نفسه ثلاث مرات خلال 30 دقيقة، أو يبدأ تمرين.',
    'Newest boards': 'أحدث اللوحات', 'Blocked stock': 'المخزون المحجوز', 'IQC: crush strength 18% below spec': 'فحص الوارد: مقاومة السحق أقل من المواصفة بنسبة 18%', 'CTN-55 usable': 'CTN-55 الصالح للاستخدام', 'Blocked by IQC': 'محجوز بفحص الوارد', 'Use, UHD 55 lines': 'الاستهلاك، خطوط UHD 55', 'Vendor truck': 'شاحنة المورد', '3 h late': 'متأخرة 3 ساعات',
    'The backup vendor can deliver 1,500 in about 70 minutes.': 'يستطيع المورد الاحتياطي توريد 1,500 خلال نحو 70 دقيقة.', 'A concession is acceptable with corner protectors, but crush strength is 18% low: some transit damage is likely.': 'التنازل مقبول مع واقيات الأركان، لكن مقاومة السحق أقل بنسبة 18%، فبعض تلف النقل محتمل.',
    'Either way lines 1 and 2 keep running; waiting starves packing within the hour.': 'في الحالتين يستمر الخطان 1 و2 في العمل، أما الانتظار فيوقف التعبئة لنقص المواد خلال ساعة.', 'Release the blocked lot under concession': 'الإفراج عن الدفعة المحجوزة بتنازل جودة', 'Small transit-damage risk': 'خطر بسيط لتلف النقل', 'Wait for the vendor truck': 'انتظار شاحنة المورد',
    'Outside air': 'الهواء الخارجي', 'Plant total': 'إجمالي المصنع', 'Riding with FL-01. Move to get off, or press R.': 'تركب مع FL-01، تحرك للنزول أو اضغط R.', 'Power vendor (Asia)': 'مورد لوحات القدرة (آسيا)', 'PCB vendor (local)': 'مورد اللوحات المطبوعة (محلي)', 'BLU vendor (Asia)': 'مورد الإضاءة الخلفية (آسيا)', 'Panel vendor (Asia)': 'مورد لوحات العرض (آسيا)', 'Carton vendor (local)': 'مورد الكراتين (محلي)',
    'Capacity without overtime': 'الطاقة دون عمل إضافي', 'Finished-goods stock': 'مخزون المنتجات التامة', 'Work in process': 'الإنتاج تحت التشغيل', 'Traffic': 'حركة الرسائل', 'Messages in': 'الرسائل الواردة', 'Messages out': 'الرسائل الصادرة', 'Latest': 'الأحدث', 'Open SAP and data flow': 'فتح SAP وتدفق البيانات', 'Promise': 'الوعد', 'ATP at entry': 'التوافر عند الإدخال', 'shipped': 'مشحونة', 'Messages': 'الرسائل',
    'More UHD 55, the model with the least cover': 'مزيد من UHD 55، الموديل الأقل تغطية', 'MD04 exception 05: Opening date in the past': 'استثناء MD04 رقم 05: تاريخ الفتح في الماضي', 'Convert': 'تحويل', 'Convert to PO': 'التحويل إلى أمر شراء', 'Feeder splice': 'وصل شريط المغذي', 'Stamped parts': 'القطع المكبوسة', 'not used now': 'غير مستخدم الآن',
    'Mission': 'المهمة', 'Vehicle': 'المركبة', 'Battery': 'البطارية', 'Driven today': 'المسافة المقطوعة اليوم', 'Present': 'حاضر', 'Service store PBA-55': 'مخزن الخدمة PBA-55', 'Service centres waiting': 'مراكز الخدمة المنتظرة', 'Production lane PBA-55': 'مسار الإنتاج PBA-55',
    'Customers have been without a TV for days; the service level is at risk.': 'بقي العملاء دون تلفزيون لأيام، ومستوى الخدمة معرض للخطر.', 'Taking the boards leaves main lines 1 and 2 enough cover until SMD 1 and 2 refill the lane.': 'أخذ اللوحات يترك لخطي التجميع 1 و2 تغطية كافية حتى يعيد خطا SMD 1 و2 ملء المسار.',
    'Options simulated by the Service agent': 'الخيارات التي حاكاها وكيل الخدمة', 'Customers served today': 'العملاء الذين خُدموا اليوم', 'Run SMD 3 on PBA 55 for 30 min': 'تشغيل SMD 3 على PBA 55 لمدة 30 دقيقة', 'Ship to service centres tomorrow': 'الشحن إلى مراكز الخدمة غدًا', 'Customer complaints and service-level penalty': 'شكاوى العملاء وغرامة مستوى الخدمة', 'Show service store': 'عرض مخزن الخدمة',
    // SAP and data flow
    'SAP and the data flow': 'SAP وتدفق البيانات', 'Data flow between the offices, SAP, GMES and the shop floor': 'تدفق البيانات بين المكاتب وSAP وGMES وأرض المصنع', 'SCM': 'سلسلة الإمداد', 'SVC': 'خدمة ما بعد البيع', 'Sales, delivery': 'المبيعات والتسليم', 'Demand, supply': 'الطلب والإمداد', 'Orders, MRP': 'الطلبيات وMRP', 'Purchasing, stock': 'المشتريات والمخزون',
    'Inspection': 'الفحص', 'Every line': 'كل خط', 'Stores, AGVs': 'المخازن والمركبات الموجهة آليًا', 'BOM, firmware': 'قوائم المواد والبرمجيات', 'HR system': 'نظام الموارد البشرية', 'Attendance': 'الحضور', 'Main lines 1–6': 'خطوط التجميع 1–6', 'Stores and milk runs': 'المخازن وقطارات الإمداد', 'Docks and trucks': 'الأرصفة والشاحنات',
    'Live message log': 'سجل الرسائل الحي', 'newest first': 'الأحدث أولًا', 'From → to': 'من ← إلى', 'Message': 'الرسالة', 'Content': 'المحتوى', 'Order release': 'إصدار الأمر', 'Movement types:': 'أنواع الحركة:', 'goods issue for delivery': 'صرف بضاعة للتسليم', 'Interfaces (message type / basic type):': 'الواجهات (نوع الرسالة / النوع الأساسي):',
    'firmware document. Notifications travel by API; MRP, QM and S&OP post inside SAP.': 'مستند البرمجيات. تنتقل الإشعارات عبر واجهة برمجية، بينما تُرحَّل MRP وQM وS&OP داخل SAP.', 'Sales orders (SD)': 'طلبيات البيع (SD)', 'ATP': 'التوافر للوعد ATP', 'Online marketplace': 'متجر إلكتروني', 'Purchase orders (MM)': 'أوامر الشراء (MM)', 'PO': 'أمر شراء', 'ETA': 'موعد الوصول', 'Production orders (PP)': 'أوامر الإنتاج (PP)',
    'Production orders, MRP': 'أوامر الإنتاج وMRP', 'Shop floor: every line': 'أرض المصنع: كل خط', 'Stores, AGVs, milk runs': 'المخازن والمركبات الموجهة آليًا وقطارات الإمداد', 'BOMs, ECNs, firmware': 'قوائم المواد وإشعارات التغيير والبرمجيات',
    // S&OP and MRP
    'Twelve weeks of demand by model against six main lines. Sales brings the forecast, Planning and SCM the supply, Finance the money, and the plant leader approves one plan. The approved plan becomes the master schedule in SAP PP and drives MRP.': 'اثنا عشر أسبوعًا من الطلب لكل موديل مقابل ستة خطوط تجميع. تقدم المبيعات التوقع، والتخطيط وسلسلة الإمداد الإمداد، والمالية الأرقام المالية، ويعتمد قائد المصنع خطة واحدة تصبح الجدول الرئيسي في SAP PP وتقود تخطيط احتياجات المواد.',
    'Complete step 2': 'إكمال الخطوة 2', 'Level': 'خطة الإنتاج المتساوي', 'Same output every week; stock is built before the promotions and runs down after them.': 'إنتاج ثابت كل أسبوع؛ يُبنى المخزون قبل العروض الترويجية وينخفض بعدها.', 'Chase': 'الملاحقة', 'Approved plan': 'الخطة المعتمدة', 'Output follows demand week by week; Saturdays are worked in the peak weeks.': 'يتبع الإنتاج الطلب أسبوعًا بأسبوع، ويُعمل أيام السبت في أسابيع الذروة.',
    'Supply-constrained': 'مقيد بالإمداد', 'The open-cell vendor allocates at most 11,500 QLED 65 panels a week; output and promises follow that limit.': 'يخصص مورد الخلايا المفتوحة 11,500 لوحة QLED 65 أسبوعيًا كحد أقصى، ويتبع الإنتاج والوعود هذا الحد.', 'All models': 'كل الموديلات', 'Demand, production and capacity by week': 'الطلب والإنتاج والطاقة حسب الأسبوع', 'Stock and lost sales by week': 'المخزون والمبيعات الضائعة حسب الأسبوع', 'Stock at week end': 'المخزون في نهاية الأسبوع',
    'Import and local materials': 'المواد المستوردة والمحلية', 'Open cells, backlights and power boards come by container; boards, cartons, steel and paint from local vendors. Every rack level is a real stock level, every pallet a lot with its vendor.': 'تصل الخلايا المفتوحة والإضاءة الخلفية ولوحات القدرة في حاويات، واللوحات والكراتين والصلب والطلاء من موردين محليين. كل مستوى في الرف مستوى مخزون حقيقي، وكل منصة دفعة بمورّدها.',
    'Run MRP now': 'تشغيل MRP الآن', 'Master production schedule': 'جدول الإنتاج الرئيسي', 'TVs a week, from S&OP (Chase)': 'أجهزة في الأسبوع، من تخطيط المبيعات والعمليات (الملاحقة)', 'Imported': 'مستورد', 'Local vendors': 'موردون محليون', 'Vendor': 'المورد', 'Lot size': 'حجم الدفعة', 'Used by': 'يستخدمه', 'Plant stock': 'مخزون المصنع', 'pieces': 'قطعة',
    'Gross requirements': 'الاحتياجات الإجمالية', 'Scheduled receipts (open POs)': 'الاستلامات المجدولة (أوامر الشراء المفتوحة)', 'Planned order receipts': 'استلامات الأوامر المخططة', 'Projected available': 'المتاح المتوقع', 'Planned order releases': 'إصدارات الأوامر المخططة', 'Safety stock': 'مخزون الأمان', 'Requirements and projected stock': 'الاحتياجات والمخزون المتوقع', 'Exception messages': 'رسائل الاستثناء',
    // process signals, vehicles, people
    'Squeegee pressure': 'ضغط الممسحة', 'kg': 'كجم', 'Paste temperature': 'حرارة المعجون', 'Steam': 'البخار', 'TVs ageing': 'أجهزة قيد التعتيق', 'Chamber': 'الغرفة', 'Peak temperature': 'الحرارة القصوى', 'No mission. Parked and ready.': 'لا توجد مهمة؛ في الموقف وجاهزة.', 'This lap': 'هذه الدورة', 'Train': 'القطار', 'Laps today': 'الدورات اليوم', 'Last lap': 'آخر دورة', 'Driven': 'المسافة المقطوعة', 'Driver': 'السائق', 'Job': 'المهمة',
    'Runway': 'مدة الكفاية', 'Source': 'المصدر', 'Boards here': 'اللوحات في هذه المحطة', 'Brings': 'الحمولة', 'Arrives': 'موعد الوصول', 'Pallet': 'المنصة', 'Taking it to its bay': 'في الطريق إلى موقع التخزين', 'No job.': 'لا توجد مهمة.', 'Main-line performance': 'أداء خطوط التجميع', 'OEE = availability × performance × quality, last 30 minutes': 'OEE = الإتاحة × الأداء × الجودة، آخر 30 دقيقة',
    'By line': 'حسب الخط', 'Avail.': 'الإتاحة', 'Perf.': 'الأداء', 'By model': 'حسب الموديل', 'Throughput': 'الإنتاجية', 'TVs an hour': 'أجهزة في الساعة', 'TVs on the lines': 'أجهزة على الخطوط', 'Average lead time, panel to packed': 'متوسط زمن الدورة، من اللوحة إلى التعبئة', 'First-pass yield, incoming inspection and holds': 'عائد المرور الأول وفحص الوارد والإيقافات',
    'Rework queue': 'طابور إعادة التشغيل', 'PBA repair queue': 'طابور إصلاح PBA', 'OQC audits passed': 'تدقيقات ما قبل الشحن الناجحة', 'Inspection points': 'نقاط الفحص', 'Incoming inspection (IQC)': 'فحص الوارد (IQC)', 'ISA-18.2 priorities: P1 act now, P2 act soon, P3 and P4 plan it': 'أولويات ISA-18.2: P1 تصرّف الآن، وP2 تصرّف قريبًا، وP3 وP4 خطط لها',
    'The feeding line or supplier must recover first': 'يجب أن يتعافى الخط المغذي أو المورد أولًا', 'Show the source': 'عرض المصدر', '15-minute average now': 'متوسط 15 دقيقة الآن', 'Contract limit': 'حد التعاقد', 'Chillers and compressors are rising with the afternoon heat; cushions and injection run at full load.': 'ترتفع أحمال المبردات والضواغط مع حرارة الظهيرة، وتعمل ماكينات الوسائد والحقن بالحمل الكامل.',
    'Options simulated by the Energy agent': 'الخيارات التي حاكاها وكيل الطاقة', 'Accept the peak': 'قبول الذروة', 'Demand charge for the month': 'رسوم الطلب الأقصى للشهر', 'Show chillers': 'عرض المبردات', 'One AGV trip, about 2–3 min': 'رحلة واحدة لمركبة موجهة آليًا، نحو 2–3 دقائق',
    'Aya Farouk': 'آية فاروق', 'Hana Saad': 'هنا سعد', 'Sara Salem': 'سارة سالم', 'Tarek Hassan': 'طارق حسن', 'Amr Salem': 'عمرو سالم', 'Karim Saad': 'كريم سعد', 'Sara Reda': 'سارة رضا', 'Aya Fouad': 'آية فؤاد', 'Mai Hany': 'مي هاني', 'Eman Fouad': 'إيمان فؤاد', 'Hany Ali': 'هاني علي', 'Dina Farouk': 'دينا فاروق', 'Omar Hassan': 'عمر حسن', 'Mahmoud Mostafa': 'محمود مصطفى',
    'Heba Fouad': 'هبة فؤاد', 'Yara Hany': 'يارا هاني', 'Salma Hassan': 'سلمى حسن', 'Mona Fouad': 'منى فؤاد', 'Mahmoud Gamal': 'محمود جمال', 'Hossam Nabil': 'حسام نبيل', 'Mostafa Hassan': 'مصطفى حسن', 'Mai Kamal': 'مي كمال', 'Rania Hassan': 'رانيا حسن', 'Amr Zaki': 'عمرو زكي', 'Reem Farouk': 'ريم فاروق', 'Dina Samir': 'دينا سمير',
    'Nour': 'نور', 'Mostafa': 'مصطفى', 'Reem': 'ريم', 'Youssef': 'يوسف', 'Ali': 'علي', 'Aya': 'آية'
  },
  patterns: [
    ['^(Team leader|Group leader|Area manager|Plant manager) after (\\d+) min$', '$1 بعد $2 دقيقة'], ['^Escalated to (.+)$', 'صُعّد إلى $1'], ['^Shift ([AB]) starts ([\\d:]+)$', 'تبدأ الوردية $1 عند $2'],
    ['^Order (\\d+) due ([\\d:]+)$', 'الطلبية $1 مستحقة عند $2'], ['^Sales order (\\d+)$', 'طلبية البيع $1'], ['^Cushion (\\d)$', 'الوسائد $1'], ['^(Chassis|Carton|Back cover|Back chassis set|Cushion set|Bare main board|Backlight unit kit|Open cell panel) (\\d+)"$', '$1 $2 بوصة'],
    ['^Power board \\(SMPS\\) (\\d+)"$', 'لوحة القدرة (SMPS) $1 بوصة'], ['^Forecast, TVs packed \\+(\\d+): ([\\d,]+)$', 'التوقع، الأجهزة المعبأة +$1: $2'], ['^Plan at 85% OEE \\+(\\d+): ([\\d,]+)$', 'الخطة عند OEE ‏85% ‏+$1: $2'],
    ['^([+−-]?[\\d,]+) vs plan$', '$1 مقابل الخطة'], ['^· ([\\d,]+) an hour$', '· $1 في الساعة'], ['^(\\d+)% likely$', 'احتمال $1%'], ['^to hit ([\\d,]+)$', 'لتحقيق $1'], ['^([\\d,]+) kWh since ([\\d:]+)$', '$1 كيلوواط ساعة منذ $2'], ['^(\\d+)% of rated$', '$1% من المقنن'],
    ['^for ([\\d:]+) min$', 'لمدة $1 دقيقة'], ['^simulated (\\d+) options? over (\\d+) h and recommends$', 'حاكى $1 خيار على مدى $2 ساعة، ويوصي بخيار:'], ['^Switch (SMD line \\d) to (PBA \\d+)$', 'حوّل $1 إلى $2'], ['^Every option, simulated on the next (\\d+) hours of the plant$', 'كل خيار محاكى على الساعات الـ$1 القادمة للمصنع'],
    ['^(\\d) of 6 lines$', '$1 من 6 خطوط'], ['^(\\d+) laps today$', '$1 دورة اليوم'], ['^OEE ([\\d.]+%)$', 'OEE ‏$1'], ['^(\\d+) in rework$', '$1 في إعادة التشغيل'], ['^(\\d+) shipments$', '$1 شحنة'], ['^([\\d,]+) TVs in 2 h$', '$1 جهازًا خلال ساعتين'], ['^(\\d+) orders late$', '$1 طلبية متأخرة'],
    ['^(\\d+) of (\\d+) present$', 'الحاضرون $1 من $2'], ['^at ([\\d:]+)$', 'عند $1'], ['^arriving in (\\d+) h$', 'يصل خلال $1 ساعة'], ['^of ([\\d,]+)$', 'من $1'], ['^(PBA \\d+) on hand$', '$1 المتوفر'], ['^Last (\\d+) min$', 'آخر $1 دقيقة'],
    ['^\\(\\+(\\d+) TVs against doing nothing\\)\\.$', '(+$1 جهاز مقارنةً بعدم التدخل).'], ['^\\(\\+([\\d,]+) TVs, (\\d+) orders saved against doing nothing\\), (\\d+) orders still at risk\\.$', '(+$1 جهاز و$2 طلبية أُنقذت مقارنةً بعدم التدخل)، ولا تزال $3 طلبية معرضة للتأخير.'],
    ['^pcs of ([\\d,]+)$', 'قطعة من $1'], ['^kg of ([\\d,]+)$', 'كجم من $1'], ['^(\\d+) points outside the limits$', '$1 نقطة خارج الحدود'], ['^Loading (\\d+)/(\\d+)$', 'التحميل $1/$2'], ['^(\\d+) a minute$', '$1 في الدقيقة'], ['^EGP ([\\d.]+)M delayed$', '$1 مليون جنيه مؤجلة'],
    ['^([\\d,]+) TVs, no order at risk$', '$1 جهازًا، لا طلبية معرضة للخطر'], ['^(Production|Demand|Capacity, no overtime|Finished-goods stock|Lost sales|Gross requirements|Projected available|Safety stock) (W\\d+): ([\\d,]+)$', '$1 $2: $3'], ['^Capacity, no overtime$', 'الطاقة دون عمل إضافي'], ['^Demand$', 'الطلب'],
    ['^(\\d+) open orders$', '$1 طلبية مفتوحة'], ['^(\\d+) exceptions$', '$1 استثناء'], ['^(\\d+) deliveries on the way$', '$1 توريد في الطريق'], ['^lowest cover (\\d+%)$', 'أدنى تغطية $1'], ['^([\\d,]+) TVs an hour$', '$1 جهازًا في الساعة'], ['^FPY ([\\d.]+%)$', 'عائد المرور الأول $1'], ['^(\\d+) trucks at the docks$', '$1 شاحنة على الأرصفة'], ['^EGP ([\\d.]+)M invoiced today$', '$1 مليون جنيه مفوترة اليوم'],
    ['^(.+) control chart: mean ([\\d.]+) (bar|°C), limits ([\\d.]+) to ([\\d.]+)$', 'خريطة ضبط $1: المتوسط $2 $3، والحدود من $4 إلى $5'], ['^(\\d+) loaded$', '$1 محمّلة'], ['^(.+) stopped\\.$', 'توقف عن العمل: $1.'], ['^(.+), (.+) and (\\d+) more stopped\\.$', 'توقف عن العمل: $1 و$2 و$3 غيرها.'],
    ['^\\. (\\d+) decisions are waiting, (\\d+) urgent\\.$', '. هناك $1 قرار بانتظارك، العاجل منها: $2.'], ['^(\\d+) decisions are waiting, (\\d+) urgent\\.$', 'هناك $1 قرار بانتظارك، العاجل منها: $2.'], ['^(\\d+) decisions are waiting\\.$', 'هناك $1 قرار بانتظارك.'], ['^All (\\d+) decisions$', 'كل القرارات الـ$1'],
    ['^Riding (FL-\\d+)$', 'تركب $1'], ['^Get off (FL-\\d+)$', 'انزل من $1'], ['^· facing ([NSEW]+)$', '· الاتجاه $1'], ['^Open (.+) in MRP$', 'افتح $1 في MRP'], ['^(\\d+) bar$', '$1 بار'],
    ['^SPC on IM10 pressure: mean ([\\d,]+) bar, LCL ([\\d,]+)\\.$', 'ضبط إحصائي لضغط IM10: المتوسط $1 بار، والحد الأدنى $2.'], ['^SPC on the oven: mean ([\\d.]+) °C, LCL ([\\d.]+) °C\\.$', 'ضبط إحصائي للفرن: المتوسط $1 °م، والحد الأدنى $2 °م.'],
    ['^Nelson Rule 1: a point beyond 3σ; Rule 2: 9 points on one side of the mean; Rule 5: 2 of 3 beyond 2σ\\.$', 'قاعدة نيلسون 1: نقطة خارج 3σ؛ والقاعدة 2: تسع نقاط في جانب واحد من المتوسط؛ والقاعدة 5: نقطتان من ثلاث خارج 2σ.'],
    ['^(\\d+) line-hours$', '$1 ساعة خط'], ['^EGP ([\\d.]+)B$', '$1 مليار جنيه'], ['^([\\d.]+) days of sales$', '$1 يوم مبيعات'], ['^(\\d+) h (\\d+) min$', '$1 ساعة و$2 دقيقة'], ['^([\\d.]+) km$', '$1 كم'], ['^(\\d+) blocked$', '$1 محجوزة'], ['^(\\d+) cartons$', '$1 كرتونة'], ['^(\\d+) \\(crush −(\\d+)%\\)$', '$1 (السحق −$2%)'],
    ['^\\+(\\d+) more lots$', '+$1 دفعة أخرى'], ['^(\\d+) \\(last 400\\)$', '$1 (من آخر 400)'], ['^arrives ([\\d:]+)$', 'يصل $1'], ['^Drill started: (.+)$', 'بدأ التمرين: $1'], ['^On the next milk-run lap: (\\d+) planned\\.$', 'في دورة قطار الإمداد التالية: $1 مخطط.'],
    ['^Take (\\d+) boards from production$', 'خذ $1 لوحة من الإنتاج'], ['^Route to (.+): (\\d+) m, about (\\d+) min on foot\\. Any walking key takes over\\.$', 'الطريق إلى $1: $2 م، نحو $3 دقيقة سيرًا. أي مفتاح سير يتولى التحكم.'],
    ['^Every confirmation, goods movement, order and release travels through GMES to SAP and back\\. ([\\d,]+) messages a simulated minute\\.$', 'كل تأكيد وحركة بضاعة وأمر وإصدار ينتقل عبر GMES إلى SAP ويعود. $1 رسالة في كل دقيقة محاكاة.'],
    ['^· (.+): planned order of ([\\d,]+) (pcs|kg) must be released this week$', '· $1: يجب إصدار الأمر المخطط بكمية $2 $3 هذا الأسبوع'], ['^Waiting for (.+)$', 'بانتظار $1'], ['^for (\\d+) h (\\d+) min$', 'لمدة $1 ساعة و$2 دقيقة'], ['^· (\\d+) stations$', '· $1 محطة'], ['^(\\d+) × (.+)$', '$1 × $2'],
    ['^(.+) at the station$', '$1 عند المحطة'], ['^(\\d+) at (.+)$', '$1 عند $2'], ['^(\\d+) (.+) left at the source\\. The feeding line or the supplier is the real problem; see What happens next\\.$', 'بقي $1 من $2 عند المصدر؛ المشكلة الحقيقية في الخط المغذي أو المورد، راجع «ما الذي سيحدث بعد ذلك».'],
    ['^Milk run (T\\d) \\((.+)\\) reaches it in about ([\\d:]+) min\\. Send a hot run with an AGV straight from (.+)\\.$', 'يصل قطار الإمداد $1 ($2) إلى المحطة خلال نحو $3 دقيقة، ويمكن إرسال إمداد عاجل بمركبة موجهة آليًا مباشرةً من مخزن $4.'], ['^Next delivery in about (\\d+) min$', 'التوريد التالي خلال نحو $1 دقيقة'],
    ['^(\\d+) left$', 'تبقّى $1'], ['^(\\d+) pcs$', '$1 قطعة'],
    ['^(\\d+) TVs failed final QA with incomplete back covers; every one carries a lot from IM10 \\(fill ([\\d.]+%), injection pressure down (\\d+) bar: check-ring wear\\)\\. Hold its (\\d) lots, stop IM10 for the check ring, and run BC-65 on the spare machine IM20 \\(40-minute mould change\\)\\.$',
      'أخفق $1 جهازًا في فحص الجودة النهائي بأغطية خلفية ناقصة، وكلها تحمل دفعة من IM10 (الامتلاء $2، وضغط الحقن أقل بمقدار $3 بار: تآكل حلقة عدم الرجوع). أوقف دفعاتها الـ$4، وأوقف IM10 لتغيير الحلقة، وشغّل BC-65 على الماكينة الاحتياطية IM20 (تغيير قالب في 40 دقيقة).'],
    ['^(\\d+) TVs failed final QA with peeling chassis paint\\. The oven ran at (\\d+) °C against a 200 °C cure\\. Repair the burner and hold the under-cured chassis lots \\((\\d)\\)\\.$', 'أخفق $1 جهازًا في فحص الجودة النهائي بسبب تقشر طلاء الهيكل؛ عمل الفرن عند $2 °م بدلًا من 200 °م للمعالجة. أصلح الموقد وأوقف دفعات الهياكل غير المكتملة المعالجة ($3).'],
    ['^(\\d+) TVs on main lines 1 and 2 failed HDMI-CEC; every failed board carries firmware v3\\.2\\.0, released by PE today\\. (\\d+) boards with it are still in stock\\. Roll the writers back to v3\\.1\\.4, re-flash those boards, and send the release back to PE\\.$', 'أخفق $1 جهازًا على خطي التجميع 1 و2 في اختبار HDMI-CEC، وكل لوحة مخفقة تحمل البرمجيات v3.2.0 التي أصدرتها هندسة الإنتاج اليوم. لا تزال $2 لوحة بها في المخزن. أعد أجهزة البرمجة إلى v3.1.4، وأعد برمجة تلك اللوحات، وأعد الإصدار إلى هندسة الإنتاج.'],
    ['^IQC blocked (\\d+) cartons \\(crush strength (\\d+)% below spec\\) and the vendor truck is (\\d+) h late\\. Option 1: order ([\\d,]+) from the backup carton vendor \\(arrives in about (\\d+) min, (\\d+)% dearer\\)\\. Option 2: release the blocked lot under a quality concession with corner protectors \\(Quality signs off, small transit-damage risk\\)\\.$', 'حجز فحص الوارد $1 كرتونة (مقاومة السحق أقل من المواصفة بنسبة $2%)، وشاحنة المورد متأخرة $3 ساعات. الخيار 1: طلب $4 من مورد الكراتين الاحتياطي (تصل خلال نحو $5 دقيقة، وبتكلفة أعلى $6%). الخيار 2: الإفراج عن الدفعة المحجوزة بتنازل جودة مع واقيات الأركان (توقّع الجودة، مع خطر بسيط لتلف النقل).'],
    ['^Customers are waiting with failed TVs\\. Option 1: take (\\d+) boards from the production supermarket now \\(it holds (\\d+); main lines 1 and 2 use about (\\d+) an hour, so SMD 1 and 2 refill it in about (\\d+) minutes\\)\\. Option 2: run SMD 3 on PBA 55 for 30 minutes for the service order \\(UHD 43 boards cover the change\\)\\.$', 'ينتظر العملاء بأجهزة معطلة. الخيار 1: أخذ $1 لوحة من سوبر ماركت الإنتاج الآن (يحوي $2، ويستهلك خطا التجميع 1 و2 نحو $3 في الساعة، فيعيد خطا SMD 1 و2 ملأه خلال نحو $4 دقيقة). الخيار 2: تشغيل SMD 3 على PBA 55 لمدة 30 دقيقة لأمر الخدمة (تغطي لوحات UHD 43 فترة التغيير).'],
    ['^The master schedule from the approved S&OP plan, exploded through every bill of materials \\(.+\\), netted against stock and open purchase orders and offset by each vendor\'s lead time\\. Last run ([\\d:]+)\\.$', 'الجدول الرئيسي من خطة تخطيط المبيعات والعمليات المعتمدة، مفككًا عبر كل قائمة مواد (الجهاز ← وحدة العرض ← الخلية المفتوحة والإضاءة الخلفية؛ اللوحة الرئيسية ← اللوحة المطبوعة؛ الغطاء الخلفي ← الراتنج؛ الهيكل ← لفائف الصلب والطلاء والدعامات؛ الوسائد ← EPS)، بعد خصم المخزون وأوامر الشراء المفتوحة وتقديمه بزمن توريد كل مورد. آخر تشغيل $1.'],
    ['^Service centres wait for (\\d+) PBA 55 boards; the service store has (\\d+)\\.$', 'تنتظر مراكز الخدمة $1 لوحة PBA 55، ومخزن الخدمة به $2.'], ['^Firmware v3\\.2\\.0 fails the function test\\.$', 'البرمجيات v3.2.0 تخفق في الاختبار الوظيفي.'],
    ['^(.+) traced to (.+)\\.$', 'تُتبّع $1 إلى $2.'], ['^Back-cover short shots$', 'نقص حقن الأغطية الخلفية'], ['^Paint peeling$', 'تقشر الطلاء'], ['^Demand peak forecast ([\\d,]+) kW against the 4,000 kW contract\\.$', 'ذروة الطلب المتوقعة $1 كيلوواط مقابل التعاقد البالغ 4,000 كيلوواط.'],
    ['^QLED 65 panels run out in (\\d+) h (\\d+) min: the container is held at the port\\.$', 'ستنفد لوحات العرض QLED 65 خلال $1 ساعة و$2 دقيقة؛ فالحاوية محتجزة في الميناء.'], ['^MRP: (.+): needed in (W\\d+) but the (\\d+)-day lead time cannot be met\\.$', 'MRP: ‏$1 مطلوب في $2، لكن زمن التوريد البالغ $3 يومًا لا يمكن الوفاء به.'],
    ['^(Main line \\d) is short of (\\d+) operators\\.$', 'يحتاج $1 إلى $2 مشغل إضافي.'], ['^(.+) on (SMD line \\d) will fail in about ([\\d:]+) min\\.$', 'يُتوقع تعطل $1 في $2 خلال نحو $3 دقيقة.']
  ]
});
DFI18N.add({
  exact: { 'Hany Ehab': 'هاني إيهاب', 'Hany Mostafa': 'هاني مصطفى', 'Eman Saad': 'إيمان سعد', 'Karim Adel': 'كريم عادل', 'Ali Hany': 'علي هاني', 'Yara Kamal': 'يارا كمال', 'Ali Farouk': 'علي فاروق', 'Ali Salem': 'علي سالم', 'Aya Salem': 'آية سالم', 'Mai Hassan': 'مي حسن', 'Karim Ehab': 'كريم إيهاب', 'Sara Farouk': 'سارة فاروق',
    'Mostafa Reda': 'مصطفى رضا', 'Ali Fathy': 'علي فتحي', 'Khaled Adel': 'خالد عادل', 'Mahmoud Hassan': 'محمود حسن', 'Mona Nabil': 'منى نبيل', 'Nada Salem': 'ندى سالم', 'Ali Adel': 'علي عادل', 'Hossam Saad': 'حسام سعد', 'NE': 'شمال شرق', 'SE': 'جنوب شرق', 'SW': 'جنوب غرب', 'NW': 'شمال غرب' },
  patterns: [['^(.+) agent autonomy$', 'استقلالية وكيل $1'], ['^Step (\\d) of (\\d)$', 'الخطوة $1 من $2'], ['^· ((?:Main|SMD|LCM) line \\d)$', '· $1'], ['^PO (\\d+)$', 'أمر الشراء $1']]
});
DFI18N.add({
  exact: { 'Stop guiding': 'أوقف الإرشاد', 'Clear the route': 'امسح الطريق', 'Tap for details': 'انقر للتفاصيل', 'There is no way through to it from here on foot.': 'لا يوجد طريق للوصول إليه سيرًا من هنا.', 'F or click for details · R to ride along': 'اضغط F أو انقر للتفاصيل · R للركوب' },
  patterns: [['^Walk me to (.+)$', 'خذني إلى $1'], ['^Ride (.+)$', 'اركب $1'], ['^(.+) · (\\d+) m · coming toward you$', '$1 · $2 م · تقترب منك']]
});
DFI18N.add({ exact: { 'Shift A running': 'الوردية A قيد التشغيل', '6 main lines, 6 LCM, 6 SMD, 20 injection, 6 press and coating, 6 cushion machines': '6 خطوط تجميع رئيسية، و6 خطوط LCM، و6 خطوط SMD، و20 ماكينة حقن، و6 خطوط كبس وطلاء، و6 ماكينات وسائد' } });
DFI18N.add({ exact: { 'Press & coating': 'الكبس والطلاء', 'HR': 'الموارد البشرية', 'PE': 'هندسة الإنتاج', 'IMP': 'مخزن الاستيراد', 'LOC': 'مخزن الموردين المحليين', 'SMD hall': 'صالة SMD', 'Utilities': 'المرافق', 'Import': 'الاستيراد', 'Local': 'المحلي' } });
DFI18N.add({
  exact: { 'GMES · lines': 'GMES · الخطوط', 'Plant now': 'حالة المصنع الآن', 'Flow': 'التدفق', 'People': 'الأفراد', '30-minute window': 'نافذة 30 دقيقة', 'machines · press lines': 'ماكينات · خطوط كبس', 'Injection · press': 'الحقن · الكبس', 'boards': 'لوحات', 'supermarket': 'السوبر ماركت', 'in the': 'في',
    'Service centre East': 'مركز خدمة الشرق', 'Service centre North': 'مركز خدمة الشمال', 'Service centre South': 'مركز خدمة الجنوب', 'Service centre West': 'مركز خدمة الغرب', 'Repair partner · online': 'شريك إصلاح · عبر الإنترنت', 'Service centres · all regions': 'مراكز الخدمة · كل المناطق', 'An SMD line': 'أحد خطوط SMD', 'Purchasing and logistics': 'المشتريات واللوجستيات' },
  patterns: [
    ['^margin ([\\d.]+%) · stock EGP ([\\d.]+)M$', 'الهامش $1 · المخزون $2 مليون جنيه'], ['^(.+) · empty at (.+)$', '$1 · ينفد عند $2'], ['^Service order (\\d+)$', 'أمر الخدمة $1'], ['^(\\d+) × (.+)$', '$1 × $2'], ['^shipped$', 'شُحن'],
    ['^(.+) is not feeding\\. (\\d+) boards in the supermarket and (\\d+) at the lines for (\\d+) an hour\\. Switch (.+) from PBA (\\d+) \\(stock covers ([\\d:]+ min)\\) to PBA (\\d+): a 10-minute changeover, then about (\\d+) boards an hour\\.$', '$1 متوقف عن التغذية. توجد $2 لوحة في السوبر ماركت و$3 عند الخطوط مقابل استهلاك $4 في الساعة. حوّل $5 من PBA $6 (يغطي مخزونها $7) إلى PBA $8: تغيير موديل في 10 دقائق، ثم نحو $9 لوحة في الساعة.'],
    ['^(.+) is not feeding\\. (\\d+) boards in the supermarket and (\\d+) at the lines for (\\d+) an hour\\.$', '$1 متوقف عن التغذية. توجد $2 لوحة في السوبر ماركت و$3 عند الخطوط مقابل استهلاك $4 في الساعة.'],
    ['^Main-line OEE ([\\d.]+%): (.+)\\. Open GMES · lines and select a line for its loss tree\\.$', 'فعالية خطوط التجميع $1: $2. افتح «GMES · الخطوط» واختر خطًا لترى شجرة خسائره.']
  ]
});
DFI18N.add({ exact: { 'Person': 'شخص', 'Forklift': 'رافعة شوكية', 'AGV': 'مركبة موجهة آليًا AGV', 'No safety glasses': 'دون نظارات سلامة', 'Milk run': 'قطار الإمداد', 'Chassis': 'الهيكل' } });
DFI18N.add({
  exact: { 'fictional TV plant': 'مصنع تلفزيونات افتراضي', 'simulated': 'محاكاة', 'boards an hour': 'لوحة في الساعة', 'SAP and GMES in sync': 'SAP وGMES متزامنان' },
  patterns: [['^last message ([\\d:]+)$', 'آخر رسالة $1'], ['^(\\d+) to decide$', '$1 بانتظار القرار'], ['^Next if nobody acts: (.+) in$', 'المتوقع إن لم يُتخذ إجراء: $1 خلال'], ['^; (.+) in$', '؛ $1 خلال']]
});
DFI18N.add({ patterns: [
  ['^Logistics agent sent (\\S+) on a hot run: (\\d+) (\\S+) to (.+)$', 'أرسل وكيل اللوجستيات $1 في مهمة إمداد عاجل: $2 من $3 إلى $4'],
  ['^Moment ([\\d:]+) sent to the presentation briefing$', 'أُرسلت لحظة $1 إلى إحاطة العرض التقديمي']
] });
DFI18N.add({ patterns: [['^(Main line \\d) and (Main line \\d)$', '$1 و$2'], ['^(.+): done\\. Logged as (AUD-\\d+)\\.$', '$1: تم التنفيذ، وسُجّل برقم $2.']] });
/* the alert pills over the 3D plant: "<machine> · <state in small letters>" */
DFI18N.add({ patterns: [
  ['^(.+) · (running|running slow|idle|starved|blocked|stopped|planned maintenance|short stop|changeover|tripped)$', '$1 · $2', 'i'],
  ['^(.+) · failure in ([\\d:]+ min|\\d+ h \\d+ min)$', '$1 · عطل خلال $2'],
  ['^([^:;]+) runs out of (\\S+) in$', 'سينفد مخزون $2 في محطة $1 خلال']
] });

/* professional wording: entries the earlier dictionaries did not have */
DFI18N.add({
  exact: {
    'Hold': 'حجز'
  },
  patterns: [

  ]
});
/* the remaining labels of the plant panels, the GMES and SAP views and the departments */
DFI18N.add({
  exact: {
    'stamped': 'مكبوسة', 'coated': 'مطلية', 'storing a pallet': 'يخزّن منصة', 'Silos and halls': 'الصوامع والصالات', 'both': 'كلاهما', 'Outfeed full': 'مخرج المحطة ممتلئ',
    'PE · Production engineering': 'هندسة الإنتاج', 'Production engineering': 'هندسة الإنتاج', 'Pick error · nozzle retry': 'خطأ التقاط · إعادة محاولة الفوهة', 'Pick error': 'خطأ التقاط', 'nozzle retry': 'إعادة محاولة الفوهة',
    'MRP · material requirements': 'تخطيط احتياجات المواد (MRP)', 'S&OP · sales and operations plan': 'تخطيط المبيعات والعمليات (S&OP)', 'GMES · shop floor': 'GMES · أرض المصنع',
    'HR · skills matrix': 'الموارد البشرية · مصفوفة المهارات', 'skills matrix': 'مصفوفة المهارات', 'Maintenance · SAP PM': 'الصيانة · SAP PM',
    'work orders from breakdowns, predictive repairs and the preventive plan': 'أوامر العمل الناتجة عن الأعطال والإصلاحات التنبؤية وخطة الصيانة الوقائية',
    'who is certified for which station (ILUO), and when the certificate runs out': 'من المعتمد لكل محطة وفق مستويات ILUO، ومتى تنتهي صلاحية اعتماده',
    'Schedule · next eight hours': 'الجدول · الساعات الثماني القادمة',
    "the live plan from SAP PP and PM, and the Scheduling agent's drafts, each simulated before a person publishes it": 'الخطة الحية من SAP PP وPM، ومسودات وكيل الجدولة، وكل منها محاكى قبل أن يعتمد أحد المسؤولين نشره',
    'Production order (SAP PP)': 'أمر إنتاج (SAP PP)', 'Maintenance window (SAP PM)': 'نافذة صيانة (SAP PM)', 'Repair': 'إصلاح', 'Draft: new order': 'مسودة: أمر جديد',
    'Truck due · red when the forecast is short': 'موعد الشاحنة · باللون الأحمر إذا قصر التوقع عن الكمية',
    'Demand review · Sales': 'مراجعة الطلب · المبيعات', 'Supply review · Planning and SCM': 'مراجعة الإمداد · التخطيط وسلسلة الإمداد', 'Pre-S&OP · Finance': 'ما قبل S&OP · المالية', 'Executive S&OP · plant leader': 'S&OP التنفيذي · قائد المصنع',
    'Lead time': 'زمن التوريد', 'Lot size': 'حجم الدفعة', 'Covers': 'يغطي', 'spare': 'احتياطية', 'Repair partner · online': 'شريك إصلاح · عبر الإنترنت', 'waiting for its timetable': 'بانتظار موعد دورته',
    'Movement types:': 'أنواع الحركة:', 'goods receipt from production or a PO': 'استلام بضاعة من الإنتاج أو أمر شراء', 'issue to production (backflush)': 'صرف للإنتاج (خصم تلقائي)', 'transfer to line side': 'تحويل إلى جانب الخط',
    'quality release': 'إفراج الجودة', 'quality inspection to blocked': 'من فحص الجودة إلى المحجوز', 'blocked to unrestricted': 'من المحجوز إلى غير المقيد', 'goods issue for delivery': 'صرف بضاعة للتسليم',
    'Changeover': 'تغيير الموديل', 'Stamped parts': 'القطع المكبوسة'
  },
  patterns: [
    ['^Logistics agent sent (\\S+) on a hot run: (\\d+) (\\S+) to (.+)$', 'أرسل وكيل اللوجستيات $1 في مهمة إمداد عاجل: $2 من $3 إلى محطة $4'],
    ['^(.+) · next delivery in ([\\d:]+ min|\\d+ h \\d+ min)$', '$1 · التوريد التالي خلال $2'],
    ['^(\\S+) delivered ([\\d,]+) (\\S+) · (.+) → line side · (\\d+)$', 'سلّمت $1 كمية $2 من $3 · من $4 إلى جانب الخط · $5'],
    ['^from (.+) · 15 minutes · (.+) has the least cover$', 'من $1 · 15 دقيقة · $2 هو الأقل تغطية'],
    ['^(.+) · next order$', '$1 · الأمر التالي'], ['^Order (\\d+)$', 'الأمر $1'],
    ['^lap (\\d+) · (\\d+) drops$', 'الدورة $1 · $2 نقطة تسليم'],
    ['^(\\d+) wearing · (\\d+) stopped$', '$1 قيد التآكل · $2 متوقفة'],
    ['^(.+) · ([\\d,]+) people · (.+)$', '$1 · $2 موظفًا · $3'],
    ['^(\\d+) machines$', '$1 ماكينة'], ['^([\\d,]+) TVs$', '$1 جهاز'], ['^(.+) · (\\d+) late$', '$1 · $2 متأخرة'],
    ['^next: (\\d+) · ([\\d,]+) TVs$', 'التالية: $1 · $2 جهاز'], ['^next: (\\d+) · ([\\d,]+) TVs · (.+)$', 'التالية: $1 · $2 جهاز · $3'],
    ['^of ([\\d,]+) · order (\\d+)$', 'من $1 · الأمر $2'],
    ['^(\\S+): planned order of ([\\d,]+) (pcs|kg) must be released this week$', '$1: يجب إصدار الأمر المخطط بكمية $2 $3 هذا الأسبوع'],
    ['^([\\d,]+) kW · contract ([\\d,]+)$', '$1 كيلوواط · التعاقد $2'],
    ['^(\\d) of 6 main lines running · ([\\d,]+) TVs packed against a plan of ([\\d,]+) · OEE (\\d+%) · (.+)$', '$1 من 6 خطوط تجميع رئيسية قيد التشغيل · عُبّئ $2 جهاز مقابل خطة $3 · OEE ‏$4 · $5'],
    ['^([\\d,]+) in the plant · ([\\d,]+) in the warehouses$', '$1 في المصنع · $2 في المستودعات'],
    ['^(.+) · Open cell panel (\\d+)"$', '$1 · خلية عرض مفتوحة $2 بوصة'],
    ['^Service order (\\d+) · (.+) · (.+) · shipped$', 'أمر الخدمة $1 · $2 · $3 · شُحن']
  ]
});
DFI18N.add({ exact: { 'pcs': 'قطعة', 'Sherif Gamal': 'شريف جمال', 'Rania Kamal': 'رانيا كمال', 'Omar Reda': 'عمر رضا', 'Nadia Fathy': 'نادية فتحي', 'Mai Lotfy': 'مي لطفي',
  'Eng. Youssef Salem': 'م. يوسف سالم', 'Eng. Tarek Samir': 'م. طارق سمير', 'Dr. Laila Hassan': 'د. ليلى حسن', 'Orchestrator': 'الوكيل القائد' } });
DFI18N.add({
  exact: { 'SMD lines': 'خطوط SMD' },
  patterns: [
    ['^Logistics agent sent (\\S+) on a hot run: (\\d+) (\\S+) to (Back cover|PBA and SMPS|Screw and stand|LCM input|Packing)$', 'أرسل وكيل اللوجستيات $1 في مهمة إمداد عاجل: $2 من $3 إلى محطة $4'],
    ['^lap (\\d+)$', 'الدورة $1'], ['^(\\d+) drops$', '$1 نقطة تسليم'], ['^contract ([\\d,]+)$', 'التعاقد $1'],
    ['^(.+?) delivered ([\\d,]+) (\\S+) · (.+) → line side · (\\d+)$', 'سلّم $1 كمية $2 من $3 · من $4 إلى جانب الخط · $5']
  ]
});
