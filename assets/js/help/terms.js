/* Digital Factory — technical terms explained where they appear.
   Every technical term in the text (OEE, takt, kanban, digital twin…, in English or Arabic) gets a fine dotted underline; resting
   the pointer on it, focusing it or tapping it opens a card: what the letters stand for, what it means, how industry uses it,
   where it appears in this project, and a link to its entry in the reference guide. The terms are the guide's glossary
   (assets/js/guide-terms.js), loaded once the page is idle. Buttons, links, inputs, charts and the 3D labels are left alone. */
(function () {
  'use strict';
  const SKIP = 'button,a,input,select,textarea,label,option,script,style,code,kbd,pre,svg,canvas,h1,h2,[role="tab"],[role="button"],[role="dialog"] .df-x,.df-term,.df-card,.dg-tip,.lb,.t,[data-no-term],[contenteditable="true"],.brand,.logo,.tl,.ll,.lg';
  let T = null, reEn = null, reEnCi = null, reAr = null;
  const byKey = new Map();
  const ar = () => document.documentElement.lang === 'ar';
  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // aliases that are ordinary words would underline half the page; only distinctive ones are kept
  const COMMON = new Set(['plan', 'moment', 'pin', 'line', 'shift', 'order', 'stock', 'lot', 'case', 'agent', 'agents', 'alarm', 'alarms', 'drill', 'review', 'play', 'then', 'record', 'recording', 'walk', 'ride', 'crosshair', 'compass', 'time window', 'first person', 'walk me to', 'ride along', 'sample shift', 'export powerpoint', 'pptx', '+1 h', 'send to deck', 'briefing agent', 'quality', 'energy', 'power', 'cost', 'value', 'risk', 'health', 'speed', 'yield', 'scrap', 'plan drafts']);

  function build() {
    T = window.GUIDE_TERMS || [];
    const caps = [], words = [], arab = [];
    for (const t of T) {
      const add = (k, list) => { if (!k || byKey.has(list === arab ? k : list === caps ? k : k.toLowerCase())) return; byKey.set(list === arab ? k : list === caps ? k : k.toLowerCase(), t); list.push(k); };
      if (t.abbr && /^[A-Z0-9&/·\- ]{2,12}$/.test(t.abbr) && /[A-Z]/.test(t.abbr)) add(t.abbr, caps);
      else if (t.abbr && t.abbr.length >= 4 && !COMMON.has(t.abbr.toLowerCase())) add(t.abbr, words);
      if (t.full && t.full.length >= 6 && t.full !== t.abbr) add(t.full, words);
      for (const a of t.alias || []) {
        if (/[؀-ۿ]/.test(a)) { if (a.length >= 5) add(a, arab); continue; }
        if (/^[A-Z0-9&/\-]{2,10}$/.test(a)) add(a, caps);
        else if (a.length >= 6 && !COMMON.has(a.toLowerCase())) add(a, words);
      }
      if (t.arName) add(t.arName.split(' (')[0].split(' ووكيل')[0].trim(), arab);
    }
    const alt = l => l.sort((a, b) => b.length - a.length).map(esc).join('|');
    reEn = caps.length ? new RegExp(`(?<![A-Za-z0-9])(${alt(caps)})(?![A-Za-z0-9])`, 'g') : null;
    reEnCi = words.length ? new RegExp(`(?<![A-Za-z])(${alt(words)})(?![A-Za-z])`, 'gi') : null;
    reAr = arab.length ? new RegExp(`(?<![\\u0600-\\u06FF])(${alt(arab)})(?![\\u0600-\\u06FF])`, 'g') : null;
  }
  const termOf = m => byKey.get(m) || byKey.get(m.toLowerCase());

  /* ---------- underline ---------- */
  const wrapped = new WeakMap();     // wrapper → the original text node (put back before the language changes)
  const wrappers = new Set();
  function annotate(node) {
    const v = node.nodeValue; if (!v || v.length < 2 || !/\S/.test(v)) return;
    const hits = [];
    for (const re of [reEn, reEnCi, reAr]) {
      if (!re) continue; re.lastIndex = 0;
      for (let m; (m = re.exec(v));) { const t = termOf(m[1]); if (t && !hits.some(h => h.t === t || (m.index < h.i + h.len && m.index + m[1].length > h.i))) hits.push({ i: m.index, len: m[1].length, t }); }
    }
    if (!hits.length) return;
    hits.sort((a, b) => a.i - b.i);
    const span = document.createElement('span'); span.className = 'df-tw';
    let at = 0;
    for (const h of hits) {
      if (h.i > at) span.append(v.slice(at, h.i));
      const e = document.createElement('span'); e.className = 'df-term'; e.dataset.term = h.t.id; e.tabIndex = 0; e.textContent = v.slice(h.i, h.i + h.len);
      span.append(e); at = h.i + h.len;
    }
    if (at < v.length) span.append(v.slice(at));
    node.replaceWith(span); wrapped.set(span, node); wrappers.add(span);
  }
  function scan(root) {
    if (!T) return;
    const el = root.nodeType === 1 ? root : root.parentElement;
    if (!el || !el.isConnected || el.closest(SKIP) || el.closest('.df-tw')) return;
    if (root.nodeType === 3) { annotate(root); return; }
    const it = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, { acceptNode: n => (n.parentElement && !n.parentElement.closest(SKIP) && !n.parentElement.closest('.df-tw') ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT) });
    const list = []; for (let n = it.nextNode(); n; n = it.nextNode()) list.push(n);
    list.forEach(annotate);
  }
  // before the language changes, the text goes back exactly as it was, so the translation can switch it cleanly
  function unwrap() {
    for (const w of wrappers) { const n = wrapped.get(w); if (w.isConnected && n) w.replaceWith(n); }
    wrappers.clear();
  }
  const pending = new Set(); let timer = 0;
  // marked in the same task as the change (after the translation), so a panel that re-renders never shows its words without the line
  function later(n) { pending.add(n); if (!timer) { timer = 1; queueMicrotask(() => { timer = 0; const l = [...pending]; pending.clear(); paused = true; l.forEach(scan); obs.takeRecords(); paused = false; }); } }
  let paused = false;
  const obs = new MutationObserver(ms => { if (paused) return; for (const m of ms) { if (m.type === 'characterData') later(m.target); else m.addedNodes.forEach(n => { if (n.nodeType !== 1 || !n.classList.contains('df-tw')) later(n); }); } });

  /* ---------- the card ---------- */
  const card = document.createElement('div'); card.className = 'df-card'; card.hidden = true; card.setAttribute('role', 'tooltip'); card.id = 'dfTermCard'; card.dataset.noI18n = ''; card.dataset.noTerm = '';
  let showT = 0, hideT = 0, owner = null;
  const CAT = { production: ['Production and performance', 'الإنتاج والأداء'], quality: ['Quality', 'الجودة'], maintenance: ['Maintenance', 'الصيانة'], ai: ['AI and data', 'الذكاء الاصطناعي والبيانات'], systems: ['Systems', 'الأنظمة'], logistics: ['Logistics', 'اللوجستيات'], energy: ['Energy', 'الطاقة'], electronics: ['Electronics manufacturing', 'تصنيع الإلكترونيات'], safety: ['Safety', 'السلامة'], business: ['Business', 'الأعمال'], units: ['Units and measures', 'الوحدات والقياسات'] };
  function fill(t) {
    const A = ar(), L = A ? t.ar : t.en, k = (en, a) => `<b class="k">${A ? a : en}</b>`;
    const cat = CAT[t.cat] ? CAT[t.cat][A ? 1 : 0] : '';
    card.dir = A ? 'rtl' : 'ltr'; card.lang = A ? 'ar' : 'en';
    card.innerHTML = `<div class="dc-h"><span class="dc-abbr" dir="ltr">${t.abbr}</span>${t.full && t.full !== t.abbr ? `<span class="dc-full" dir="ltr">${t.full}</span>` : ''}<span class="dc-ar" lang="ar">${t.arName}</span>${cat ? `<span class="dc-cat">${cat}</span>` : ''}</div>`
      + (t.letters && t.letters.length ? `<ul class="dc-letters" aria-label="${A ? 'الحروف' : 'Letters'}">${t.letters.map(([l, w]) => `<li><b>${l}</b> ${w}</li>`).join('')}</ul>` : '')
      + `<div class="dc-sec">${k('What it means', 'المعنى')}<p>${L.def}</p></div>`
      + (L.use ? `<div class="dc-sec">${k('In industry, and why it matters', 'في الصناعة، ولماذا يهم')}<p>${L.use}</p></div>` : '')
      + (L.where ? `<div class="dc-sec">${k('Where you see it here', 'أين تجده هنا')}<p>${L.where}</p></div>` : '')
      + `<a class="dc-more" href="guide.html#g-${t.id}" target="_blank" rel="noopener">${A ? 'افتح في الدليل المرجعي' : 'Open in the reference guide'}</a>`;
  }
  function place(el) {
    const r = el.getBoundingClientRect(), w = card.offsetWidth, h = card.offsetHeight, m = 10;
    let x = Math.min(innerWidth - w - 12, Math.max(12, (ar() ? r.right - w : r.left)));
    let y = r.bottom + m; if (y + h > innerHeight - 12) y = Math.max(12, r.top - h - m);
    card.style.left = x + 'px'; card.style.top = y + 'px';
  }
  function show(el) {
    const t = T && T.find(x => x.id === el.dataset.term); if (!t) return;
    clearTimeout(hideT); owner = el;
    fill(t); card.hidden = false; place(el); requestAnimationFrame(() => card.classList.add('on'));
    el.setAttribute('aria-describedby', card.id);
  }
  function hide(now) {
    clearTimeout(showT); clearTimeout(hideT);
    const go = () => { card.classList.remove('on'); card.hidden = true; if (owner) owner.removeAttribute('aria-describedby'); owner = null; };
    if (now) go(); else hideT = setTimeout(go, 160);
  }
  document.addEventListener('pointerover', e => {
    const el = e.target.closest && e.target.closest('.df-term');
    if (el && e.pointerType === 'mouse') { clearTimeout(showT); clearTimeout(hideT); showT = setTimeout(() => show(el), owner ? 60 : 280); }
    else if (e.target.closest && e.target.closest('.df-card')) clearTimeout(hideT);
  });
  document.addEventListener('pointerout', e => { if (e.target.closest && (e.target.closest('.df-term') || e.target.closest('.df-card'))) { clearTimeout(showT); hide(); } });
  document.addEventListener('click', e => { const el = e.target.closest && e.target.closest('.df-term'); if (el) { e.preventDefault(); owner === el && !card.hidden ? hide(true) : show(el); } else if (!e.target.closest('.df-card')) hide(true); });
  document.addEventListener('focusin', e => { const el = e.target.closest && e.target.closest('.df-term'); if (el) show(el); });
  document.addEventListener('focusout', e => { if (e.target.closest && e.target.closest('.df-term')) hide(); });
  addEventListener('keydown', e => { if (e.key === 'Escape' && !card.hidden) hide(true); });
  addEventListener('scroll', () => { if (!card.hidden) hide(true); }, true);

  /* ---------- start ---------- */
  function start() {
    build(); document.body.append(card);
    scan(document.body);
    obs.observe(document.body, { subtree: true, childList: true, characterData: true });
  }
  addEventListener('beforelangchange', () => { paused = true; obs.takeRecords(); unwrap(); hide(true); paused = false; });
  addEventListener('langchange', () => { paused = true; scan(document.body); obs.takeRecords(); paused = false; });
  function load() {
    if (window.__dfNoTerms) return;   // tools that read the page's own text switch the underlines off
    if (window.GUIDE_TERMS) return start();
    const s = document.createElement('script'); s.src = 'assets/js/guide-terms.js'; s.onload = start; document.head.append(s);
  }
  const idle = window.requestIdleCallback || (f => setTimeout(f, 600));
  if (document.readyState === 'complete') idle(load); else addEventListener('load', () => idle(load));
  window.DFTerms = { scan, unwrap, get terms() { return T; } };
})();
