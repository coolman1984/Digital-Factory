/* Digital Factory — light / dark theme and kit icons.
   The first paint is set by a tiny inline script in each page <head>; this file wires the toggle buttons,
   fills [data-icon] placeholders from the kit's Icons API, and keeps open pages (and the deck's embedded demo) in sync. */
(function () {
  'use strict';
  const KEY = 'df-theme';
  const root = document.documentElement;
  const read = () => { try { return localStorage.getItem(KEY); } catch (e) { return null; } };
  const I = () => (typeof Icons !== 'undefined' ? Icons : null);
  const save = v => { try { localStorage.setItem(KEY, v); } catch (e) { /* storage unavailable */ } };

  function icons(scope) {
    if (!I()) return;
    (scope || document).querySelectorAll('[data-icon]').forEach(n => { if (!n.firstElementChild) n.innerHTML = I().get(n.dataset.icon); });
  }

  function paint() {
    const dark = root.dataset.theme === 'dark';
    document.querySelectorAll('[data-theme-toggle]').forEach(b => {
      b.setAttribute('aria-pressed', String(dark));
      b.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme');
      const ic = b.querySelector('.ti'), lb = b.querySelector('.tl');
      if (ic && I()) ic.innerHTML = I().get(dark ? 'moon' : 'sun');
      if (lb) lb.textContent = dark ? 'Dark' : 'Light';
    });
  }

  function set(theme, persist) {
    root.dataset.theme = theme === 'dark' ? 'dark' : 'light';
    if (persist !== false) save(root.dataset.theme);
    paint();
    window.dispatchEvent(new CustomEvent('themechange', { detail: root.dataset.theme }));
  }

  if (!root.dataset.theme) set(read() || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'), false);
  icons();
  paint();
  document.addEventListener('click', e => { if (e.target.closest('[data-theme-toggle]')) set(root.dataset.theme === 'dark' ? 'light' : 'dark'); });
  window.addEventListener('storage', e => { if (e.key === KEY && e.newValue) set(e.newValue, false); });
  window.addEventListener('message', e => { if (e.origin === location.origin && e.data && e.data.dfTheme) set(e.data.dfTheme, false); });

  window.Theme = { set, toggle: () => set(root.dataset.theme === 'dark' ? 'light' : 'dark'), get: () => root.dataset.theme, icons };
})();
