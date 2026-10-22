/* Digital Factory — Arabic and English on every page.
   The pages are written in English. In Arabic, this file translates what the page shows, as it shows it: every text node and
   the title, aria-label, placeholder and alt attributes, including text the scripts write later (a MutationObserver follows
   every change). Translations come from dictionaries (assets/js/i18n/ar.js): exact strings, and patterns for sentences that
   carry numbers, times or names, whose parts are translated in turn. The page turns right-to-left in Arabic; charts, the 3D
   view and codes keep their own direction. The choice is shared by all pages and tabs (localStorage "df-lang"). */
(function () {
  'use strict';
  const KEY = 'df-lang';
  const root = document.documentElement;
  const read = () => { try { return localStorage.getItem(KEY) || localStorage.getItem('df-guide-lang'); } catch (e) { return null; } };
  const save = v => { try { localStorage.setItem(KEY, v); localStorage.setItem('df-guide-lang', v); } catch (e) { /* storage unavailable */ } };

  /* ---------- dictionaries ---------- */
  const exact = new Map(), pats = [], cache = new Map();
  function add(o) {
    for (const k in (o.exact || {})) exact.set(k, o.exact[k]);
    for (const [src, tpl, fl] of (o.patterns || [])) {
      try { pats.push([new RegExp(src, fl || ''), tpl, /[A-Za-z]{2}/.test(src.replace(/\(\?<[=!][^)]*\)|\\[a-zA-Z]|\[[^\]]*\]/g, ''))]); } catch (e) { console.warn('i18n: bad pattern', src); }
    }
    // shapes with words in them come first; bare shapes such as "a · b" or "a (b)" only when nothing more specific fits
    pats.sort((a, b) => b[2] - a[2]);
    cache.clear();
    if (lang === 'ar' && started) schedule(document.body);
  }
  const norm = s => s.replace(/\s+/g, ' ').trim();
  // the Arabic for one string, or null when there is none (the English then stays)
  function tr(s, depth = 0) {
    const k = norm(s);
    if (!k || !/[A-Za-z]/.test(k)) return null;
    if (cache.has(k)) return cache.get(k);
    let out = exact.has(k) ? exact.get(k) : null;
    if (out == null && depth < 5) {
      for (const [re, tpl] of pats) {
        const m = re.exec(k); if (!m) continue;
        let hit = /[\u0600-\u06FF]/.test(tpl);
        out = tpl.replace(/\$(\d)/g, (_, i) => { const c = m[+i] || ''; if (c === k) return c; let t = tr(c, depth + 1); if (t == null && /^[a-z]/.test(c)) t = tr(c[0].toUpperCase() + c.slice(1), depth + 1); if (t == null) return c; hit = true; return t; });
        if (!hit) { out = null; continue; }   // a general shape whose parts are all unknown gives way to the next pattern
        break;
      }
    }
    if (out == null && depth < 5 && /[.:]$/.test(k)) {
      // the same phrase closed by a full stop or a colon
      const t = tr(k.slice(0, -1), depth + 1); if (t != null) out = t + (k.endsWith(':') ? ':' : '.');
    }
    if (out == null && depth < 5) {
      // a list joined by " · " translates part by part
      const parts = k.split(' · ');
      if (parts.length > 1) { const t = parts.map(p => tr(p, depth + 1)); if (t.some(x => x != null)) out = t.map((x, i) => (x == null ? parts[i] : x)).join(' · '); }
    }
    if (out == null && depth < 5) {
      // a paragraph written by a script is several sentences: each translates on its own
      const sent = k.split(/(?<=[.!?])\s+(?=[A-Z0-9“"(+−-])/);
      if (sent.length > 1) { const t = sent.map(p => tr(p, depth + 1)); if (t.every(x => x != null)) out = t.join(' '); }
    }
    if (cache.size > 20000) cache.clear();
    cache.set(k, out);
    return out;
  }

  /* ---------- the page ---------- */
  const ATTRS = ['title', 'aria-label', 'placeholder', 'alt'];
  const SKIP = 'script,style,textarea,code,pre,[data-no-i18n],[contenteditable="true"],.ar,[lang="ar"]:not(html),.ws';
  const done = new Map();      // text node → { en, ar } while it shows Arabic
  const attrDone = new Map();  // element → { attr: { en, ar } }
  let lang = read() === 'ar' ? 'ar' : 'en', started = false;

  const skipped = el => !el || !!el.closest(SKIP);
  function textNode(n) {
    const v = n.nodeValue, d = done.get(n);
    if (d && v === d.ar) return;                          // our own Arabic
    let t = tr(v);
    // a number range or a time ("30–50%", "13:00–13:30") keeps its reading order inside right-to-left text
    if (t == null && /\d/.test(v) && /[–\-:/→]/.test(v) && !/[A-Za-z\u0600-\u06FF]/.test(v) && !/[\u2066\u2069]/.test(v)) t = '\u2066' + norm(v) + '\u2069';
    if (t == null) { if (d) done.delete(n); return; }
    const lead = v.match(/^\s*/)[0], tail = v.match(/\s*$/)[0];
    const ar = lead + t + tail;
    done.set(n, { en: v, ar });
    n.nodeValue = ar;
  }
  function attrs(el) {
    for (const a of ATTRS) {
      if (!el.hasAttribute(a)) continue;
      const v = el.getAttribute(a), rec = attrDone.get(el) || {}, d = rec[a];
      if (d && v === d.ar) continue;
      const t = tr(v); if (t == null) continue;
      rec[a] = { en: v, ar: t }; attrDone.set(el, rec);
      el.setAttribute(a, t);
    }
  }
  // a headline split into words for its entrance (motion.js) translates as one run, then splits again
  const wsDone = new Map();
  function words(el) {
    // a headline made of several runs (plain and highlighted) translates as one sentence when the whole is known
    const h = el.closest('[data-split-done]');
    if (h && blockDone.has(h)) return;
    const runs = h ? h.querySelectorAll('.ws[data-text]') : [];
    if (runs.length > 1) {
      const whole = tr(norm([...runs].map(r => r.dataset.text).join('')));
      if (whole != null) {
        blockDone.set(h, h.innerHTML);
        // after the walk that found it: rewriting the headline now would cut the walk short
        queueMicrotask(() => { if (blockDone.get(h) !== h.innerHTML) return; h.innerHTML = `<span class="ws">${whole.split(/\s+/).map((w, k) => `<span class="w" style="--i:${k}">${w.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))}</span>`).join(' ')}</span>`; });
        return;
      }
    }
    const t = tr(el.dataset.text || ''); if (t == null) return;
    const ar = ' ' + t + ' ';
    if (wsDone.has(el) && el.dataset.ar === ar) return;
    if (!wsDone.has(el)) wsDone.set(el, el.innerHTML);
    const i0 = el.firstElementChild ? +getComputedStyle(el.firstElementChild).getPropertyValue('--i') || 0 : 0;
    el.innerHTML = t.split(/\s+/).map((w, k) => `<span class="w" style="--i:${i0 + k}">${w.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))}</span>`).join(' ');
    el.dataset.ar = ar;
  }
  // a sentence with words in bold, links or term marks translates as one whole sentence, so the Arabic reads naturally;
  // the dictionary value may carry <b>, <em> and <kbd>. Elements whose parts are updated by a script are not touched.
  // links keep their own text (a whole-sentence translation would drop them), so a sentence with a link translates in parts
  const INLINE = /^(B|STRONG|EM|I|SPAN|SUP|SUB|KBD|MARK|SMALL|ABBR|BR|U)$/;
  const blockDone = new Map();
  function block(el) {
    if (!el.firstElementChild || el.matches('button,a,label,option,select,svg *')) return false;
    let text = false;
    for (const c of el.childNodes) {
      if (c.nodeType === 3) { if (/[A-Za-z]/.test(c.nodeValue)) text = true; }
      else if (c.nodeType === 1) { if (!INLINE.test(c.tagName) || c.id || c.querySelector('[id],a,input,button,select,canvas,svg,img,video,iframe,[data-read],[data-b],[data-icon]') || [...c.attributes].some(a => /^data-(?!term|icon)/.test(a.name)) || c.matches('[data-icon]')) return false; }
    }
    if (!text) return false;
    const src = norm(el.textContent);
    if (src.length > 1500) return false;
    const t = exact.get(src); if (t == null) return false;
    if (!blockDone.has(el)) blockDone.set(el, el.innerHTML);
    if (/</.test(t)) el.innerHTML = t; else el.textContent = t;
    return true;
  }
  function walk(n) {
    if (n.nodeType === 3) { if (!skipped(n.parentElement)) textNode(n); return; }
    if (n.nodeType !== 1) return;
    if (n.matches('.ws')) { if (!n.parentElement.closest('[data-no-i18n]')) words(n); return; }
    if (skipped(n)) return;
    attrs(n);
    if (block(n)) return;
    const it = document.createTreeWalker(n, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, { acceptNode: x => (x.nodeType === 1 && x.matches('.ws') ? (words(x), NodeFilter.FILTER_REJECT) : x.nodeType === 1 && x.matches(SKIP) ? NodeFilter.FILTER_REJECT : x.nodeType === 1 && block(x) ? (attrs(x), NodeFilter.FILTER_REJECT) : NodeFilter.FILTER_ACCEPT) });
    for (let x = it.nextNode(); x; x = it.nextNode()) { if (x.nodeType === 3) textNode(x); else attrs(x); }
  }
  // changes arrive in bursts (a panel re-rendered every second): they are gathered and translated once per frame
  const queue = new Set(); let raf = 0;
  function schedule(n) { queue.add(n); if (!raf) raf = requestAnimationFrame(flush); }
  function flush() {
    raf = 0;
    if (lang !== 'ar') { queue.clear(); return; }
    paused = true;
    for (const n of queue) if (n.isConnected) walk(n);
    queue.clear();
    obs.takeRecords(); paused = false;
    if (done.size > 6000) for (const [n] of done) if (!n.isConnected) done.delete(n);
    root.removeAttribute('data-i18n-wait');
    document.dispatchEvent(new CustomEvent('df:translated'));
  }
  let paused = false;
  const obs = new MutationObserver(ms => {
    if (paused || lang !== 'ar') return;
    for (const m of ms) {
      if (m.type === 'characterData') schedule(m.target);
      else if (m.type === 'attributes') schedule(m.target.nodeType === 1 ? m.target : m.target.parentElement);
      else m.addedNodes.forEach(schedule);
    }
  });
  // in English the page is exactly as written: every translated text and attribute goes back
  function restore() {
    paused = true;
    for (const [n, d] of done) if (n.isConnected && n.nodeValue === d.ar) n.nodeValue = d.en;
    done.clear();
    for (const [el, rec] of attrDone) for (const a in rec) if (el.getAttribute(a) === rec[a].ar) el.setAttribute(a, rec[a].en);
    attrDone.clear();
    for (const [el, html] of wsDone) if (el.isConnected) { el.innerHTML = html; delete el.dataset.ar; }
    for (const [el, html] of blockDone) if (el.isConnected) el.innerHTML = html;
    blockDone.clear();
    wsDone.clear();
    obs.takeRecords(); paused = false;
  }

  /* ---------- the switch ---------- */
  function apply() {
    window.dispatchEvent(new CustomEvent('beforelangchange', { detail: lang }));   // the term underlines step aside first
    root.lang = lang === 'ar' ? 'ar' : 'en';
    root.dir = lang === 'ar' ? 'rtl' : 'ltr';
    root.dataset.lang = lang;
    document.querySelectorAll('[data-lang-toggle]').forEach(b => {
      b.setAttribute('aria-pressed', String(lang === 'ar'));
      const lg = b.querySelector('.lg'), ll = b.querySelector('.ll');
      lg.textContent = lang === 'ar' ? 'EN' : 'ع'; ll.textContent = lang === 'ar' ? 'English' : 'العربية';
      lg.lang = ll.lang = lang === 'ar' ? 'en' : 'ar';
      b.title = lang === 'ar' ? 'Switch to English (L)' : 'التبديل إلى العربية (L)';
    });
    if (lang === 'ar') { obs.observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS }); queue.add(document.head); queue.add(document.body); cancelAnimationFrame(raf); flush(); }
    else { obs.disconnect(); restore(); root.removeAttribute('data-i18n-wait'); }
    window.dispatchEvent(new CustomEvent('langchange', { detail: lang }));
  }
  function set(l, persist = true) {
    l = l === 'ar' ? 'ar' : 'en';
    if (l === lang && started) return;
    lang = l; if (persist) save(l);
    if (started) apply();
  }
  // the button sits beside the theme switch in each page's header, in the same style
  function buttons() {
    document.querySelectorAll('[data-theme-toggle]').forEach(t => {
      if (t.previousElementSibling && t.previousElementSibling.matches('[data-lang-toggle]')) return;
      const b = document.createElement('button');
      b.type = 'button'; b.className = (t.className.replace(/\btheme-btn\b/, '') + ' lang-btn').trim(); b.dataset.langToggle = '';
      b.setAttribute('data-no-i18n', '');
      b.innerHTML = '<span class="lg" aria-hidden="true">ع</span><span class="ll">العربية</span>';
      t.before(b);
    });
  }
  function start() {
    if (started) return; started = true;
    buttons();
    apply();
  }
  document.addEventListener('click', e => { if (e.target.closest('[data-lang-toggle]')) set(lang === 'ar' ? 'en' : 'ar'); });
  addEventListener('keydown', e => {
    if ((e.key === 'l' || e.key === 'L') && !e.metaKey && !e.ctrlKey && !e.altKey && !/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) && !e.target.isContentEditable && !document.querySelector('dialog[open]')) set(lang === 'ar' ? 'en' : 'ar');
  });
  // every open page and the deck's embedded demo follow the choice
  addEventListener('storage', e => { if (e.key === KEY && e.newValue) set(e.newValue, false); });

  window.DFI18N = { add, t: tr, set, get lang() { return lang; }, ar: () => lang === 'ar' };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else queueMicrotask(start);
})();
