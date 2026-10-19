/* Digital Factory — command room core: helpers, theme palette for canvas, toasts, confirm dialog, router. */
window.DF = (function () {
  'use strict';
  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));
  const fmt = n => Math.round(n).toLocaleString('en-US');
  const pct = (v, d = 1) => (v * 100).toFixed(d) + '%';
  const money = n => n >= 1e6 ? 'EGP ' + (n / 1e6).toFixed(2) + 'M' : n >= 1e3 ? 'EGP ' + Math.round(n / 1e3) + 'k' : 'EGP ' + Math.round(n);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const icon = (n, cls) => (typeof Icons !== 'undefined' ? Icons.get(n, cls) : '');
  const STATE_LABEL = { run: 'Running', warn: 'Warning', down: 'Stopped', maint: 'Planned work' };
  const STATE_CHIP = { run: 'chip-success', warn: 'chip-warning', down: 'chip-danger', maint: 'chip-info' };

  // canvas colours follow the kit tokens of the current theme
  const P = {};
  function readPalette() {
    const cs = getComputedStyle(document.documentElement);
    const v = n => cs.getPropertyValue(n).trim();
    Object.assign(P, {
      text: v('--text'), text2: v('--text-2'), text3: v('--text-3'), border: v('--border'), borderStrong: v('--border-strong'),
      surface: v('--surface'), surface2: v('--surface-2'), surface3: v('--surface-3'), bg: v('--bg'),
      brand: v('--brand'), brand2: v('--brand-2'), success: v('--success'), warning: v('--warning'), danger: v('--danger'),
      indigo: v('--indigo'), lane: v('--lane'), dark: document.documentElement.dataset.theme === 'dark'
    });
    P.state = { run: P.success, warn: P.warning, down: P.danger, maint: P.indigo };
  }
  readPalette();
  addEventListener('themechange', () => requestAnimationFrame(readPalette));

  function toast(msg, level) {
    const type = level === 'crit' || level === 'error' ? 'error' : level === 'warning' || level === 'warn' ? 'warning' : level === 'info' ? 'info' : 'success';
    const root = $('#toast-root');
    const node = document.createElement('div');
    node.className = `toast toast-${type}`;
    node.innerHTML = `${icon(type === 'success' ? 'checkCircle' : type === 'error' ? 'xCircle' : type === 'warning' ? 'alert' : 'info')}<span class="toast-msg"></span><button class="toast-x" type="button" aria-label="Dismiss notification">${icon('x')}</button>`;
    node.querySelector('.toast-msg').textContent = msg;
    root.append(node);
    while (root.children.length > 3) root.firstChild.remove();
    requestAnimationFrame(() => node.classList.add('show'));
    const kill = () => { node.classList.remove('show'); setTimeout(() => node.remove(), 300); };
    node.querySelector('.toast-x').onclick = kill;
    setTimeout(kill, 4800);
  }

  function confirmBox({ title, html, yes = 'Apply' }) {
    const d = $('#confirm');
    $('#cfTitle').textContent = title;
    $('#cfBody').innerHTML = html;
    $('#cfYes').textContent = yes;
    return new Promise(res => {
      const close = v => { d.close(); $('#cfYes').onclick = $('#cfNo').onclick = null; res(v); };
      $('#cfYes').onclick = () => close(true);
      $('#cfNo').onclick = () => close(false);
      d.onclose = () => res(false);
      if (d.showModal) d.showModal(); else res(window.confirm(title));
    });
  }

  const VIEW_NAMES = { command: 'Command room', alarms: 'Alarms', control: 'Control', agents: 'AI agents', predict: 'Predictions', rootcause: 'Root cause', scenarios: 'Scenarios', leadership: 'Leadership', maintenance: 'Maintenance', quality: 'Quality', energy: 'Energy', simulator: 'What-if' };
  const hooks = {};
  const api = {
    $, $$, fmt, pct, money, esc, icon, P, STATE_LABEL, STATE_CHIP, toast, confirm: confirmBox,
    view: 'command', replay: null, selected: 'L1-MounterB', selMachine: null,
    onView(name, fn) { hooks[name] = fn; },
    route() {
      let h = (location.hash || '#command').slice(1);
      if (h === 'copilot') { api.openCopilot && api.openCopilot(true); h = 'command'; }
      if (h === 'twin') h = 'command';
      if (!$('#view-' + h)) h = 'command';
      api.view = h;
      $$('.view').forEach(v => { v.hidden = v.id !== 'view-' + h; });
      $$('.nav a[data-view]').forEach(a => a.classList.toggle('active', a.dataset.view === h));
      $('#crumbView').textContent = VIEW_NAMES[h];
      $('#side').classList.remove('open'); $('#sideShade').hidden = true;
      if (api._last !== h) scrollTo({ top: 0 }); api._last = h;
      if (hooks[h]) hooks[h](true);
      if (typeof Theme !== 'undefined') Theme.icons(document.getElementById('view-' + h));
    },
    go(h) { if (location.hash === '#' + h) api.route(); else location.hash = h; },
    refresh() { if (hooks[api.view]) hooks[api.view](false); }
  };
  return api;
})();
