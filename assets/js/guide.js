/* Digital Factory — the reference guide: language (Arabic, English, both), contents and reading position,
   the glossary chapter and the searchable side panel of terms, and the icon gallery. No data leaves the page. */
(function () {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const root = document.documentElement;
  const KEY = 'df-guide-lang';
  const TERMS = window.GUIDE_TERMS || [];
  const CATS = {
    all: ['All terms', 'كل المصطلحات'], production: ['Production and performance', 'الإنتاج والأداء'], electronics: ['Electronics manufacturing', 'تصنيع الإلكترونيات'],
    systems: ['Systems and data', 'الأنظمة والبيانات'], standards: ['Standards and alarms', 'المعايير والإنذارات'], ai: ['AI and analytics', 'الذكاء الاصطناعي والتحليلات'],
    units: ['Units and measures', 'الوحدات والقياسات'], demo: ['Names used in the demo', 'أسماء ومعرّفات العرض']
  };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const icon = n => (typeof Icons !== 'undefined' ? Icons.get(n) : '');
  const read = () => { try { return localStorage.getItem(KEY); } catch (e) { return null; } };
  const save = v => { try { localStorage.setItem(KEY, v); } catch (e) { /* storage unavailable */ } };
  const lang = () => root.dataset.lang;
  const pick = (en, ar) => lang() === 'en' ? en : ar;

  /* ---------- language ---------- */
  function setLang(l) {
    root.dataset.lang = l;
    root.lang = l === 'en' ? 'en' : 'ar';
    root.dir = l === 'ar' ? 'rtl' : 'ltr';
    save(l);
    $$('.langs button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.lang === l)));
    buildToc(); renderDrawer(); renderCats();
    $('#drSearch').placeholder = pick('Search a term or an abbreviation…', 'ابحث عن مصطلح أو اختصار…');
    $('#drTitle').textContent = pick('Terms and abbreviations', 'المصطلحات والاختصارات');
    document.title = pick('Digital Factory · Reference guide', 'المصنع الرقمي · الدليل المرجعي');
  }
  $$('.langs button').forEach(b => b.addEventListener('click', () => setLang(b.dataset.lang)));

  /* ---------- contents, built from the chapters in the current language ---------- */
  function titleOf(el) {
    const part = lang() === 'en' ? el.querySelector('.en') : el.querySelector('.ar');
    const h = part ? part.querySelector('h2, h3') : el.querySelector('h2, h3');
    return h ? h.textContent.trim() : '';
  }
  function buildToc() {
    const ol = $('#tocList'); if (!ol) return;
    ol.innerHTML = $$('.ch').map((ch, k) => {
      const subs = $$('.sub', ch).map(s => `<li><a href="#${s.id}">${esc(titleOf(s))}</a></li>`).join('');
      return `<li><a href="#${ch.id}"><span class="n">${k + 1}</span>${esc(titleOf(ch.querySelector('.ch-head') || ch))}</a>${subs ? `<ol>${subs}</ol>` : ''}</li>`;
    }).join('');
    $('#tocTitle').textContent = pick('Contents', 'المحتويات');
    spy();
  }
  let spyT = null;
  function spy() {
    const marks = $$('.ch, .sub');
    let cur = marks[0];
    for (const m of marks) if (m.getBoundingClientRect().top < 140) cur = m;
    let on = null;
    $$('#tocList a').forEach(a => { const v = cur && a.getAttribute('href') === '#' + cur.id; a.classList.toggle('on', v); if (v) on = a; });
    // keep the current entry in view inside the contents column
    const toc = $('.toc');
    if (on && toc && getComputedStyle(toc).position === 'sticky') {
      const r = on.getBoundingClientRect(), t = toc.getBoundingClientRect();
      if (r.top < t.top + 40 || r.bottom > t.bottom - 40) toc.scrollTop += r.top - t.top - t.height / 3;
    }
  }
  addEventListener('hashchange', () => setTimeout(spy, 120));
  addEventListener('load', () => setTimeout(spy, 200));
  addEventListener('scroll', () => { clearTimeout(spyT); spyT = setTimeout(spy, 60); }, { passive: true });

  /* ---------- glossary: the chapter and the side panel share one data set ---------- */
  const letters = t => t.letters && t.letters.length ? `<div class="letters" aria-label="Letters">${t.letters.map(([l, w]) => `<span><b>${esc(l)}</b> ${esc(w)}</span>`).join('')}</div>` : '';
  const body = (t, full) => {
    const en = `<div class="en" lang="en" dir="ltr"><p>${t.en.def}</p>${t.en.use ? `<p class="use"><b>In industry.</b> ${t.en.use}</p>` : ''}${full && t.en.where ? `<p class="where"><b>In this project.</b> ${t.en.where}</p>` : ''}</div>`;
    const ar = `<div class="ar" lang="ar" dir="rtl"><p>${t.ar.def}</p>${t.ar.use ? `<p class="use"><b>في الصناعة.</b> ${t.ar.use}</p>` : ''}${full && t.ar.where ? `<p class="where"><b>في هذا المشروع.</b> ${t.ar.where}</p>` : ''}</div>`;
    return `<div class="bi">${ar}${en}</div>`;
  };
  let cat = 'all';
  function renderCats() {
    const box = $('#glCats'); if (!box) return;
    box.innerHTML = Object.keys(CATS).map(k => `<button type="button" class="gl-cat" data-cat="${k}" aria-pressed="${k === cat}">${esc(pick(CATS[k][0], CATS[k][1]))}${k === 'all' ? ` · ${TERMS.length}` : ` · ${TERMS.filter(t => t.cat === k).length}`}</button>`).join('');
  }
  function renderGlossary() {
    const box = $('#glossaryFull'); if (!box) return;
    const list = TERMS.filter(t => cat === 'all' || t.cat === cat).slice().sort((a, b) => a.abbr.localeCompare(b.abbr, 'en', { sensitivity: 'base' }));
    box.innerHTML = list.map(t => `<div class="term" id="g-${t.id}">
      <div class="term-h"><span class="abbr">${esc(t.abbr)}</span>${t.full && t.full !== t.abbr ? `<span class="full">${esc(t.full)}</span>` : ''}<span class="arn" lang="ar">${esc(t.arName)}</span><span class="cat">${esc(pick(CATS[t.cat][0], CATS[t.cat][1]))}</span></div>
      ${letters(t)}${body(t, true)}</div>`).join('');
  }
  document.addEventListener('click', e => { const b = e.target.closest('.gl-cat'); if (b) { cat = b.dataset.cat; renderCats(); renderGlossary(); } });

  const drawer = $('#drawer'), shade = $('#shade');
  function renderDrawer(q) {
    q = (q == null ? $('#drSearch').value : q).trim().toLowerCase();
    const norm = s => String(s).toLowerCase().replace(/[ً-ْ]/g, '');
    const hits = TERMS.filter(t => !q || [t.abbr, t.full, t.arName, t.en.def, t.ar.def, ...(t.alias || [])].some(v => norm(v || '').includes(norm(q))))
      .sort((a, b) => a.abbr.localeCompare(b.abbr, 'en', { sensitivity: 'base' }));
    $('#drList').innerHTML = hits.map(t => `<div class="dr-item" data-id="${t.id}">
      <button type="button" aria-expanded="false"><b>${esc(t.abbr)}</b><span>${esc(t.full && t.full !== t.abbr ? t.full + ' · ' : '')}<span lang="ar">${esc(t.arName)}</span></span><i>${icon('chevronDown')}</i></button>
      <div class="dr-body">${letters(t)}${body(t, true)}<p><a href="#g-${t.id}" data-close>${esc(pick('Open in the glossary chapter', 'افتح في فصل المصطلحات'))}</a></p></div></div>`).join('');
    $('#drCount').textContent = pick(`${hits.length} of ${TERMS.length} terms`, `${hits.length} من ${TERMS.length} مصطلحًا`);
  }
  function openDrawer(v, id) {
    const o = v === undefined ? !drawer.classList.contains('open') : v;
    drawer.classList.toggle('open', o); drawer.setAttribute('aria-hidden', String(!o)); shade.hidden = !o;
    $('#termsBtn').setAttribute('aria-expanded', String(o));
    if (o && id) {
      $('#drSearch').value = ''; renderDrawer('');
      const it = $(`.dr-item[data-id="${id}"]`);
      if (it) { it.classList.add('open', 'hit'); it.querySelector('button').setAttribute('aria-expanded', 'true'); setTimeout(() => it.scrollIntoView({ block: 'start' }), 60); }
    }
    if (o) setTimeout(() => (id ? $(`.dr-item[data-id="${id}"] button`) : $('#drSearch'))?.focus({ preventScroll: true }), 350);
    else $('#termsBtn').focus({ preventScroll: true });
  }
  $('#termsBtn').addEventListener('click', () => openDrawer());
  $('#drClose').addEventListener('click', () => openDrawer(false));
  shade.addEventListener('click', () => openDrawer(false));
  $('#drSearch').addEventListener('input', () => renderDrawer());
  $('#drList').addEventListener('click', e => {
    if (e.target.closest('[data-close]')) { openDrawer(false); const id = e.target.closest('a').getAttribute('href').slice(1); setTimeout(() => flash(id), 400); return; }
    const b = e.target.closest('.dr-item > button'); if (!b) return;
    const it = b.parentElement, o = !it.classList.contains('open');
    it.classList.toggle('open', o); b.setAttribute('aria-expanded', String(o));
  });
  addEventListener('keydown', e => {
    if (e.key === 'Escape' && drawer.classList.contains('open')) openDrawer(false);
    if (e.key === '/' && !/INPUT|TEXTAREA/.test(e.target.tagName)) { e.preventDefault(); openDrawer(true); }
  });
  // every underlined term in the text opens its entry in the side panel
  document.addEventListener('click', e => {
    const t = e.target.closest('.t[data-term]'); if (!t) return;
    e.preventDefault(); openDrawer(true, t.dataset.term);
  });
  function flash(id) { const el = document.getElementById(id); if (!el) return; el.scrollIntoView({ block: 'start' }); el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); }

  /* ---------- icon gallery ---------- */
  function renderIcons() {
    const box = $('#iconGallery'); if (!box || !window.GUIDE_ICONS) return;
    box.innerHTML = window.GUIDE_ICONS.map(([n, en, ar]) => `<div><span class="ic" aria-hidden="true">${icon(n)}</span><b class="en" lang="en">${esc(en[0])}</b><span class="en" lang="en">${esc(en[1])}</span><b class="ar" lang="ar">${esc(ar[0])}</b><span class="ar" lang="ar">${esc(ar[1])}</span></div>`).join('');
  }

  // terms written in the text as <a class="t" data-term="oee">OEE</a> get a link target and an accessible hint
  $$('.t[data-term]').forEach(a => { a.setAttribute('href', '#g-' + a.dataset.term); a.setAttribute('role', 'button'); });

  renderIcons(); renderGlossary();
  setLang(read() || 'ar');
  if (location.hash.startsWith('#g-')) setTimeout(() => flash(location.hash.slice(1)), 200);
})();
