/* Digital Factory — presentation controller: navigation, production-line progress, theme, ROI calculator */
(function () {
  'use strict';
  const $ = s => document.querySelector(s);
  const stage = $('#stage');
  const slides = Array.from(document.querySelectorAll('.slide'));
  let i = 0, ready = false;

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
  slides.forEach(s => s.querySelectorAll('h1, h2').forEach(h => {
    h.classList.remove('r');
    h.setAttribute('data-split', '');
    window.Motion && Motion.split(h);
    h.classList.add('in');
  }));

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
    slides.forEach((s, k) => { s.classList.toggle('active', k === n); s.classList.toggle('prev', k < n); });
    i = n;
    rail(n);
    $('#counter').textContent = `${n + 1} / ${slides.length}`;
    const s = slides[n];
    if (s.dataset.id === 'demo') {
      const f = $('#demoFrame');
      if (!f.src) { f.src = f.dataset.src; f.addEventListener('load', () => window.focus()); }
      requestAnimationFrame(fitDemo);
    }
    const note = s.querySelector('.sn');
    $('#notesTitle').textContent = `Speaker notes · ${n + 1}/${slides.length}`;
    $('#notesBody').textContent = note ? note.textContent.trim() : '';
    if (!fromHash && ready) history.replaceState(null, '', '#' + s.dataset.id);
  }
  const next = () => go(i + 1), prev = () => go(i - 1);

  /* ---------- theme: keep the embedded demo in step ---------- */
  addEventListener('themechange', e => {
    const f = $('#demoFrame');
    if (f && f.contentWindow && f.src) f.contentWindow.postMessage({ dfTheme: e.detail }, location.origin);
  });

  /* ---------- ROI calculator ---------- */
  const money = n => n >= 1e9 ? 'EGP ' + (n / 1e9).toFixed(2) + 'B' : n >= 1e6 ? 'EGP ' + (n / 1e6).toFixed(1) + 'M' : 'EGP ' + Math.round(n / 1e3) + 'k';
  function roi() {
    const v = id => Math.max(0, +$(id).value || 0);
    const down = v('#rLines') * v('#rDown') * 12 * v('#rCost') * 0.30;
    const scrap = v('#rScrap') * 12 * 0.20;
    const energy = v('#rEnergy') * 12 * 0.08;
    const total = down + scrap + energy;
    $('#oDown').textContent = money(down);
    $('#oScrap').textContent = money(scrap);
    $('#oEnergy').textContent = money(energy);
    $('#oTotal').textContent = money(total) + ' / year';
    const pay = total > 0 ? v('#rInv') / (total / 12) : Infinity;
    $('#oPay').textContent = !isFinite(pay) ? '—' : pay < 1 ? '< 1 month' : pay.toFixed(1) + ' months';
    $('#oNote').textContent = `About ${money(total * 3)} over three years. Conservative assumptions at the low end of published ranges.`;
  }
  document.querySelectorAll('#roiIn input').forEach(inp => inp.addEventListener('input', roi));
  roi();

  /* ---------- input ---------- */
  addEventListener('message', e => {
    if (e.origin !== location.origin || !e.data || !e.data.dfDeckKey) return;
    const k = e.data.dfDeckKey;
    if (k === 'ArrowRight' || k === 'PageDown') next();
    else if (k === 'ArrowLeft' || k === 'PageUp') prev();
    else if (k === 'f' || k === 'F') toggleFs();
    else if (k === 'n' || k === 'N') $('#notes').classList.toggle('open');
    window.focus();
  });
  addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT') return;
    if (['ArrowRight', 'PageDown', ' ', 'Enter'].includes(e.key)) { e.preventDefault(); next(); }
    else if (['ArrowLeft', 'PageUp', 'Backspace'].includes(e.key)) { e.preventDefault(); prev(); }
    else if (e.key === 'Home') go(0);
    else if (e.key === 'End') go(slides.length - 1);
    else if (e.key === 'f' || e.key === 'F') toggleFs();
    else if (e.key === 'n' || e.key === 'N') $('#notes').classList.toggle('open');
    else if ((e.key === 't' || e.key === 'T') && window.Theme) Theme.toggle();
  });
  $('#next').onclick = next; $('#prev').onclick = prev;
  $('#notesBtn').onclick = () => $('#notes').classList.toggle('open');
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
    if (Math.abs(dx) > 50) dx < 0 ? next() : prev();
  });

  addEventListener('resize', scale);
  addEventListener('hashchange', () => fromHash());
  function fromHash() {
    const id = location.hash.slice(1);
    const k = slides.findIndex(s => s.dataset.id === id);
    go(k >= 0 ? k : (/^\d+$/.test(id) ? +id - 1 : 0), true);
  }
  scale(); fromHash(); ready = true;
  setTimeout(() => { $('#help').style.opacity = 0; }, 4500);
})();
