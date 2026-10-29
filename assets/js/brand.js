/* The start-up splash: the Digital Factory mark builds itself while a heavy page starts, then gives way.
   The page's splash names what it waits for (data-ready): the plant's first frames, the showroom's model, or, for the
   command room, its own boot (main.js lifts it). It never stays longer than 12 s. The caption follows the page
   language at once, before the translation layer runs. */
// df-mark:start
window.DF_MARK = {"factory":"M7 23.8V9.4a.7.7 0 0 1 1.1-.57L11.5 11.3V9.4a.7.7 0 0 1 1.1-.57L16 11.3v12.5z","cells":[[17.2,20.4,1],[21.4,20.4,1],[17.2,16.2,1],[21.4,16.2,0.72],[17.2,12,0.72]],"live":[21.4,12],"colors":{"a":"#2D5BFF","b":"#1428A0","ink":"#0B1024","live":"#7FE4FF","white":"#FFFFFF"}};
// df-mark:end
(function () {
  let ar = false; try { ar = localStorage.getItem('df-lang') === 'ar'; } catch (e) { /* storage off */ }
  for (const el of document.querySelectorAll('.df-splash')) {
    if (ar) el.querySelectorAll('[data-ar]').forEach(n => { n.textContent = n.dataset.ar; n.setAttribute('lang', 'ar'); n.dir = 'rtl'; });
    el.querySelectorAll('p, b').forEach(n => { n.dataset.noI18n = ''; });
    const kind = el.dataset.ready; if (!kind) continue;
    const t0 = Date.now();
    const ready = () => {
      try {
        if (kind === 'plant') return !!(window.Plant && Plant.V && (Plant.V.ready ?? Plant.V.frames() > 1));
        if (kind === 'showroom') return !!(window.Showroom && Showroom.product && Showroom.product.ready);
        if (kind === 'inspect') return !!(window.Inspect && Inspect.ready);
        if (kind === 'line') return !!(window.Line && Line.ready);
      } catch (e) { return true; }
      return document.readyState === 'complete';
    };
    // at least 0.9 s, so the mark finishes building; at most 12 s
    const tick = () => { if ((ready() && Date.now() - t0 > 900) || Date.now() - t0 > 12000) { el.classList.add('done'); setTimeout(() => el.remove(), 600); } else setTimeout(tick, 150); };
    setTimeout(tick, 150);
  }
})();
