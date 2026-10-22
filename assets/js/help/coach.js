/* Digital Factory — the page guide.
   A "Guide" button on every page opens a panel with three parts: this screen (what it is for, how to read it, what to do, what
   each decision means and leads to, ideas to try), suggestions that follow the live state of the plant (each can take you there),
   and every control on the screen with what it does and why. "Explain mode" outlines the controls and, when the pointer rests on
   one, says what it does and what happens next. The content of each page is in assets/js/help/<page>.js (DFHelp.page). Keys:
   ? opens the guide, Escape closes it. Arabic and English follow the page language. */
(function () {
  'use strict';
  const ar = () => document.documentElement.lang === 'ar';
  const L = x => (x == null ? '' : typeof x === 'string' ? x : (ar() ? x.ar : x.en) || x.en || '');
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const T = (en, a) => (ar() ? a : en);
  let H = null, tab = 'screen', open = false, explain = false, lastSug = [];

  /* ---------- the button and the panel ---------- */
  const fab = document.createElement('button');
  fab.type = 'button'; fab.className = 'dg-fab'; fab.dataset.noI18n = ''; fab.dataset.noTerm = '';
  fab.setAttribute('aria-expanded', 'false'); fab.setAttribute('aria-controls', 'dgPanel');
  const panel = document.createElement('section');
  panel.className = 'dg-panel'; panel.id = 'dgPanel'; panel.hidden = true; panel.dataset.noI18n = '';
  panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-modal', 'false');
  const tip = document.createElement('div'); tip.className = 'dg-tip'; tip.hidden = true; tip.dataset.noI18n = ''; tip.dataset.noTerm = '';

  function screen() {
    if (!H) return null;
    for (const s of H.screens || []) { try { if (s.when && s.when()) return s; } catch (e) { /* not this one */ } }
    return (H.screens || [])[0] || null;
  }
  function suggestions() {
    const out = [];
    for (const f of (H && H.suggest) || []) { try { const r = f(); if (r) out.push(r); } catch (e) { /* skip */ } }
    return out;
  }
  const visible = el => !!(el && (el.offsetParent || el.getClientRects().length));
  function controls(sc) {
    const id = sc && sc.id;
    return ((H && H.controls) || []).filter(c => (!c.screen || c.screen === '*' || c.screen === id || (Array.isArray(c.screen) && c.screen.includes(id))) && [...document.querySelectorAll(c.sel)].some(visible));
  }
  const list = (items, tag = 'ul') => items && items.length ? `<${tag}>${items.map(i => `<li>${L(i)}</li>`).join('')}</${tag}>` : '';

  function paintFab() {
    const n = lastSug.length;
    fab.innerHTML = `<span class="dg-dot" aria-hidden="true">?</span><span class="dg-l">${T('Guide', 'المرشد')}</span><span class="dg-n"${n ? '' : ' hidden'}>${n}</span>`;
    fab.title = T('Page guide: what this screen is for, what each control does, and what to do next (?)', 'مرشد الصفحة: هدف هذه الشاشة، ووظيفة كل عنصر تحكم، والخطوة التالية (?)');
    fab.setAttribute('aria-label', T(`Page guide${n ? `, ${n} suggestions` : ''}`, `مرشد الصفحة${n ? `، ${n} اقتراحات` : ''}`));
  }
  function render() {
    if (!H) return;
    const sc = screen();
    panel.dir = ar() ? 'rtl' : 'ltr'; panel.lang = ar() ? 'ar' : 'en';
    lastSug = suggestions(); paintFab();
    let body = '';
    if (tab === 'screen') {
      body = (sc ? `<h3>${esc(L(sc.title))}</h3><p>${L(sc.purpose)}</p>` : '')
        + (sc && sc.read && sc.read.length ? `<h3>${T('How to read it', 'كيف تقرؤها')}</h3>${list(sc.read)}` : '')
        + (sc && sc.steps && sc.steps.length ? `<h3>${T('What to do', 'ماذا تفعل')}</h3>${list(sc.steps, 'ol')}` : '')
        + (sc && sc.decisions && sc.decisions.length ? `<h3>${T('Decisions and what follows', 'القرارات وما يترتب عليها')}</h3>${list(sc.decisions)}` : '')
        + (sc && sc.ideas && sc.ideas.length ? `<h3>${T('Ideas to try', 'أفكار للتجربة')}</h3>${list(sc.ideas)}` : '');
    } else if (tab === 'next') {
      body = `<h3>${T('Suggested now', 'مقترح الآن')}</h3>` + (lastSug.length
        ? `<div class="dg-sug">${lastSug.map((s, i) => s.go ? `<button type="button" data-sug="${i}"><b>${esc(L(s.title) || T('Go', 'انتقل'))}</b> ${L(s)}</button>` : `<div>${L(s)}</div>`).join('')}</div>`
        : `<p>${T('Nothing needs you right now. The ideas under “This screen” are good next steps.', 'لا شيء يحتاج إليك الآن. والأفكار في «هذه الشاشة» خطوات تالية مناسبة.')}</p>`)
        + (H.purpose ? `<h3>${T('About this page', 'عن هذه الصفحة')}</h3><p>${L(H.purpose)}</p>` : '')
        + `<h3>${T('Keys', 'المفاتيح')}</h3><p>${T('<kbd>?</kbd> this guide · <kbd>L</kbd> العربية / English · <kbd>T</kbd> light or dark', '<kbd>?</kbd> هذا المرشد · <kbd>L</kbd> العربية / English · <kbd>T</kbd> فاتح أو داكن')}</p>`;
    } else {
      const cs = controls(sc);
      body = `<h3>${T('Controls on this screen', 'عناصر التحكم في هذه الشاشة')}</h3>` + (cs.length ? `<div class="dg-ctl">${cs.map(c => `<div><b>${esc(L(c.label))}</b>${L(c.does)}${c.why ? `<span>${L(c.why)}</span>` : ''}</div>`).join('')}</div>` : `<p>${T('Turn on explain mode below and rest the pointer on any control.', 'شغّل وضع الشرح أدناه، ثم ضع المؤشر على أي عنصر تحكم.')}</p>`);
    }
    panel.innerHTML = `<div class="dg-head"><div><h2>${esc(L(H.title))}</h2><p>${sc ? esc(L(sc.title)) : ''}</p></div><button type="button" class="dg-x" data-dg-close aria-label="${T('Close the guide', 'أغلق المرشد')}">×</button></div>
      <div class="dg-tabs" role="tablist">${[['screen', T('This screen', 'هذه الشاشة')], ['next', T('Suggestions', 'اقتراحات') + (lastSug.length ? ` · ${lastSug.length}` : '')], ['controls', T('Controls', 'عناصر التحكم')]].map(([k, l]) => `<button type="button" role="tab" data-dg-tab="${k}" aria-selected="${tab === k}">${l}</button>`).join('')}</div>
      <div class="dg-body" role="tabpanel">${body}</div>
      <div class="dg-switch"><label><input type="checkbox" data-dg-explain${explain ? ' checked' : ''}> ${T('Explain mode: rest the pointer on any control to see what it does', 'وضع الشرح: ضع المؤشر على أي عنصر تحكم لترى وظيفته')}</label></div>`;
  }
  function setOpen(v) {
    open = v; panel.hidden = !v; fab.setAttribute('aria-expanded', String(v));
    if (v) { render(); const b = panel.querySelector(`[data-dg-tab="${tab}"]`); if (b) b.focus({ preventScroll: true }); }
  }
  panel.addEventListener('click', e => {
    const t = e.target.closest('[data-dg-tab]'); if (t) { tab = t.dataset.dgTab; render(); panel.querySelector(`[data-dg-tab="${tab}"]`).focus(); return; }
    if (e.target.closest('[data-dg-close]')) { setOpen(false); fab.focus(); return; }
    const s = e.target.closest('[data-sug]'); if (s) { const g = lastSug[+s.dataset.sug]; if (g && g.go) { try { g.go(); } catch (err) { /* nothing */ } setTimeout(render, 400); } }
  });
  panel.addEventListener('change', e => { if (e.target.matches('[data-dg-explain]')) setExplain(e.target.checked); });
  fab.addEventListener('click', () => setOpen(!open));
  addEventListener('keydown', e => {
    if (e.key === 'Escape' && open) { setOpen(false); fab.focus(); return; }
    if (e.key === '?' && !/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) && !e.target.isContentEditable) { e.preventDefault(); setOpen(!open); }
  });

  /* ---------- explain mode ---------- */
  function mark() {
    document.querySelectorAll('[data-dg]').forEach(el => el.removeAttribute('data-dg'));
    if (!explain || !H) return;
    (H.controls || []).forEach((c, i) => document.querySelectorAll(c.sel).forEach(el => { if (!el.closest('.dg-panel')) el.setAttribute('data-dg', i); }));
  }
  function setExplain(v) { explain = v; document.body.classList.toggle('dg-explain', v); mark(); if (!v) tip.hidden = true; }
  let tipFor = null;
  document.addEventListener('pointerover', e => {
    if (!explain) return;
    const el = e.target.closest && e.target.closest('[data-dg]'); if (!el || el === tipFor) return;
    const c = H.controls[+el.dataset.dg]; if (!c) return;
    tipFor = el;
    tip.dir = ar() ? 'rtl' : 'ltr'; tip.lang = ar() ? 'ar' : 'en';
    tip.innerHTML = `<b>${esc(L(c.label))}</b>${L(c.does)}${c.why ? `<span>${L(c.why)}</span>` : ''}`;
    tip.hidden = false;
    const r = el.getBoundingClientRect(), w = tip.offsetWidth, h = tip.offsetHeight;
    tip.style.left = Math.min(innerWidth - w - 12, Math.max(12, r.left + r.width / 2 - w / 2)) + 'px';
    tip.style.top = (r.bottom + 10 + h < innerHeight ? r.bottom + 10 : Math.max(12, r.top - h - 10)) + 'px';
  });
  document.addEventListener('pointerout', e => { if (explain && e.target.closest && e.target.closest('[data-dg]') && !(e.relatedTarget && e.relatedTarget.closest && e.relatedTarget.closest('[data-dg]') === tipFor)) { tip.hidden = true; tipFor = null; } });

  /* ---------- life ---------- */
  function tick() { if (!H) return; if (open && tab !== 'controls') render(); else { lastSug = suggestions(); paintFab(); } if (explain) mark(); }
  addEventListener('hashchange', () => setTimeout(tick, 300));
  addEventListener('langchange', () => { paintFab(); if (open) render(); });
  setInterval(tick, 4000);

  window.DFHelp = {
    page(o) {
      H = o;
      const go = () => { document.body.append(fab, panel, tip); if (o.fab) Object.assign(fab.style, o.fab); if (o.fab && o.fab.bottom) panel.style.bottom = `calc(${o.fab.bottom} + 56px)`; tick(); };
      if (document.body) go(); else addEventListener('DOMContentLoaded', go);
    },
    open: v => setOpen(v !== false), render
  };
})();
