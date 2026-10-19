/* Digital Factory — page motion. Adapted from the Animation studio's web kit (studio/web/motion/motion.js).
   Opt-in by data attributes; respects prefers-reduced-motion; the page stays complete and readable without it.
     data-reveal        rise from blur when it enters the view
     data-split         headline words enter one by one (split on spaces, so Arabic letters stay joined)
     data-count="90"    count-up once visible (only for sourced numbers) · data-prefix / data-suffix
     data-steps         sticky scrollytelling: marks the [data-step] in view and mirrors it on the section
     data-magnetic      buttons lean toward the pointer
     .progress-top      reading progress bar */
(() => {
  'use strict';
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  document.documentElement.classList.add('js');

  const split = el => {
    if (el.dataset.splitDone) return;
    el.dataset.splitDone = '1';
    // keep inline markup (e.g. gradient spans) by splitting text nodes only
    let i = 0;
    const walk = node => {
      for (const n of [...node.childNodes]) {
        if (n.nodeType === 3) {
          const parts = n.textContent.split(/(\s+)/);
          const frag = document.createDocumentFragment();
          for (const p of parts) {
            if (!p) continue;
            if (/^\s+$/.test(p)) { frag.append(' '); continue; }
            const s = document.createElement('span'); s.className = 'w'; s.style.setProperty('--i', i++); s.textContent = p; frag.append(s);
          }
          n.replaceWith(frag);
        } else if (n.nodeType === 1 && n.tagName !== 'BR') walk(n);
      }
    };
    walk(el);
  };
  $$('[data-split]').forEach(split);

  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -10% 0px' });
  for (const el of $$('[data-reveal], [data-split]')) reduce ? el.classList.add('in') : io.observe(el);

  const cio = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return; cio.unobserve(e.target);
    const el = e.target, end = +el.dataset.count, pre = el.dataset.prefix || '', suf = el.dataset.suffix || '';
    if (reduce) { el.textContent = pre + end + suf; return; }
    const t0 = performance.now(), dur = 1400;
    const tick = t => { const u = Math.min(1, (t - t0) / dur), k = 1 - Math.pow(1 - u, 3); el.textContent = pre + Math.round(end * k) + suf; if (u < 1) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  }), { threshold: 0.5 });
  for (const el of $$('[data-count]')) cio.observe(el);

  for (const sec of $$('[data-steps]')) {
    const items = $$('[data-step]', sec);
    const sio = new IntersectionObserver(es => es.forEach(e => {
      if (!e.isIntersecting) return;
      items.forEach(x => x.classList.toggle('on', x === e.target));
      sec.dataset.active = e.target.dataset.step;
    }), { rootMargin: '-45% 0px -45% 0px' });
    items.forEach(x => sio.observe(x));
    if (items[0]) { items[0].classList.add('on'); sec.dataset.active = items[0].dataset.step; }
  }

  const bar = document.querySelector('.progress-top');
  if (bar) {
    let ticking = false;
    const upd = () => { ticking = false; const h = document.documentElement.scrollHeight - innerHeight; bar.style.transform = `scaleX(${h > 0 ? scrollY / h : 0})`; };
    addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(upd); } }, { passive: true });
    upd();
  }

  if (!reduce && matchMedia('(pointer: fine)').matches) for (const b of $$('[data-magnetic]')) {
    b.addEventListener('pointermove', e => { const r = b.getBoundingClientRect(); b.style.transform = `translate(${((e.clientX - r.left - r.width / 2) * 0.18).toFixed(1)}px, ${((e.clientY - r.top - r.height / 2) * 0.25).toFixed(1)}px)`; });
    b.addEventListener('pointerleave', () => { b.style.transform = ''; });
  }

  window.Motion = { split, reduce };
})();
