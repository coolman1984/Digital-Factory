/* Digital Factory — deck controller: navigation, EN / Arabic, production-line progress, ROI calculator */
(function () {
  'use strict';
  const $ = s => document.querySelector(s);
  const stage = $('#stage');
  const slides = Array.from(document.querySelectorAll('.slide'));
  const translatable = Array.from(document.querySelectorAll('[data-ar]'));
  translatable.forEach(el => { el._en = el.innerHTML; });
  let i = 0, lang = 'en', ready = false;

  /* ---------- layout ---------- */
  function scale() {
    const k = Math.min(innerWidth / 1600, innerHeight / 900);
    stage.style.transform = `scale(${k})`;
    fitDemo();
  }
  function fitDemo() {
    const wrap = $('#demoWrap'), f = $('#demoFrame');
    if (!wrap) return;
    const k = Math.min(wrap.clientWidth / 1600, wrap.clientHeight / 900);
    f.style.width = wrap.clientWidth / k + 'px';
    f.style.height = wrap.clientHeight / k + 'px';
    f.style.transform = `scale(${k})`;
  }

  /* ---------- headlines enter word by word ---------- */
  function splitHeadlines() {
    slides.forEach(s => s.querySelectorAll('h1, h2').forEach(h => {
      h.classList.remove('r');
      h.setAttribute('data-split', '');
      delete h.dataset.splitDone;
      window.Motion && Motion.split(h);
      h.classList.add('in');
    }));
  }

  /* ---------- production-line progress ---------- */
  const stations = $('#railStations');
  slides.forEach((_, k) => {
    const d = document.createElement('span');
    d.style.left = (k / (slides.length - 1) * 100) + '%';
    stations.append(d);
  });
  function rail(n) {
    const f = n / (slides.length - 1) * 100;
    $('#piece').style.left = f + '%';
    $('#railFill').style.width = f + '%';
    Array.from(stations.children).forEach((d, k) => d.classList.toggle('done', k <= n));
  }

  /* ---------- navigation ---------- */
  function go(n, fromHash) {
    n = Math.max(0, Math.min(slides.length - 1, n));
    slides.forEach((s, k) => {
      s.classList.toggle('active', k === n);
      s.classList.toggle('prev', k < n);
    });
    i = n;
    rail(n);
    $('#counter').textContent = `${n + 1} / ${slides.length}`;
    const s = slides[n];
    if (s.dataset.id === 'demo') {
      const f = $('#demoFrame');
      if (!f.src) f.src = f.dataset.src;
      requestAnimationFrame(fitDemo);
    }
    const note = s.querySelector('.sn');
    $('#notesTitle').textContent = `SPEAKER NOTES · ${n + 1}/${slides.length}`;
    $('#notesBody').textContent = note ? note.textContent.trim() : '';
    if (!fromHash) history.replaceState(null, '', '#' + s.dataset.id + (lang === 'ar' ? '?ar' : ''));
  }
  const next = () => go(i + 1), prev = () => go(i - 1);

  /* ---------- language ---------- */
  function setLang(l) {
    lang = l === 'ar' ? 'ar' : 'en';
    stage.dir = lang === 'ar' ? 'rtl' : 'ltr';
    stage.lang = lang;
    document.documentElement.lang = lang;
    translatable.forEach(el => { el.innerHTML = lang === 'ar' ? el.dataset.ar : el._en; });
    splitHeadlines();
    rebindRoi();
    roi();
    const b = $('#langBtn');
    b.textContent = lang === 'ar' ? 'EN' : 'ع';
    b.lang = lang === 'ar' ? 'en' : 'ar';
    try { localStorage.setItem('df-deck-lang', lang); } catch (e) { /* storage unavailable */ }
    if (ready) history.replaceState(null, '', '#' + slides[i].dataset.id + (lang === 'ar' ? '?ar' : ''));
    requestAnimationFrame(fitDemo);
  }
  function initialLang() {
    if (/[?&]ar\b|lang=ar/.test(location.hash + location.search)) return 'ar';
    if (/lang=en/.test(location.search)) return 'en';
    try { return localStorage.getItem('df-deck-lang') || 'en'; } catch (e) { return 'en'; }
  }

  /* ---------- ROI calculator ---------- */
  const roiVals = {};
  const money = n => {
    if (lang === 'ar') return n >= 1e9 ? (n / 1e9).toFixed(2) + ' مليار جنيه' : n >= 1e6 ? (n / 1e6).toFixed(1) + ' مليون جنيه' : Math.round(n / 1e3) + ' ألف جنيه';
    return n >= 1e9 ? 'EGP ' + (n / 1e9).toFixed(2) + 'B' : n >= 1e6 ? 'EGP ' + (n / 1e6).toFixed(1) + 'M' : 'EGP ' + Math.round(n / 1e3) + 'k';
  };
  function rebindRoi() {
    // inputs are re-created when the language changes: carry the typed values over
    document.querySelectorAll('#roiIn input').forEach(inp => {
      if (roiVals[inp.id] !== undefined) inp.value = roiVals[inp.id];
      inp.oninput = () => { roiVals[inp.id] = inp.value; roi(); };
    });
  }
  function roi() {
    const v = id => Math.max(0, +($(id) && $(id).value) || 0);
    const down = v('#rLines') * v('#rDown') * 12 * v('#rCost') * 0.30;
    const scrap = v('#rScrap') * 12 * 0.20;
    const energy = v('#rEnergy') * 12 * 0.08;
    const total = down + scrap + energy;
    $('#oDown').textContent = money(down);
    $('#oScrap').textContent = money(scrap);
    $('#oEnergy').textContent = money(energy);
    $('#oTotal').textContent = money(total) + (lang === 'ar' ? ' سنويًا' : ' / year');
    const pay = total > 0 ? v('#rInv') / (total / 12) : Infinity;
    $('#oPay').textContent = !isFinite(pay) ? '—' : lang === 'ar' ? (pay < 1 ? 'أقل من شهر' : pay.toFixed(1) + ' شهر') : (pay < 1 ? '< 1 month' : pay.toFixed(1) + ' months');
    $('#oNote').textContent = lang === 'ar'
      ? `≈ ${money(total * 3)} على 3 سنوات · افتراضات متحفظة عند الحد الأدنى للنطاقات المنشورة.`
      : `≈ ${money(total * 3)} over 3 years · conservative assumptions, lower end of published ranges.`;
  }

  /* ---------- input ---------- */
  addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT') return;
    if (['ArrowRight', 'PageDown', ' ', 'Enter'].includes(e.key)) { e.preventDefault(); lang === 'ar' && e.key === 'ArrowRight' ? prev() : next(); }
    else if (['ArrowLeft', 'PageUp', 'Backspace'].includes(e.key)) { e.preventDefault(); lang === 'ar' && e.key === 'ArrowLeft' ? next() : prev(); }
    else if (e.key === 'Home') go(0);
    else if (e.key === 'End') go(slides.length - 1);
    else if (e.key === 'f' || e.key === 'F') toggleFs();
    else if (e.key === 'n' || e.key === 'N') $('#notes').classList.toggle('open');
    else if (e.key === 'l' || e.key === 'L') setLang(lang === 'ar' ? 'en' : 'ar');
  });
  $('#next').onclick = next; $('#prev').onclick = prev;
  $('#notesBtn').onclick = () => $('#notes').classList.toggle('open');
  $('#langBtn').onclick = () => setLang(lang === 'ar' ? 'en' : 'ar');
  $('#fs').onclick = toggleFs;
  function toggleFs() {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen && document.documentElement.requestFullscreen().catch(() => {});
    else document.exitFullscreen();
  }
  let tx = null;
  addEventListener('touchstart', e => { tx = e.touches[0].clientX; }, { passive: true });
  addEventListener('touchend', e => {
    if (tx === null) return;
    const dx = e.changedTouches[0].clientX - tx; tx = null;
    if (Math.abs(dx) > 50) ((dx < 0) !== (lang === 'ar')) ? next() : prev();
  });

  addEventListener('resize', scale);
  addEventListener('hashchange', () => fromHash());
  function fromHash() {
    const id = location.hash.slice(1).split('?')[0];
    const k = slides.findIndex(s => s.dataset.id === id);
    go(k >= 0 ? k : (/^\d+$/.test(id) ? +id - 1 : 0), true);
  }
  setLang(initialLang());
  scale(); fromHash(); ready = true;
  setTimeout(() => { $('#help').style.opacity = 0; }, 4500);
})();
