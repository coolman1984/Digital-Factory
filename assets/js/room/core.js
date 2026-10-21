/* Digital Factory — command room core (window.DF): helpers, words for plant states, refs (what a link points at),
   toasts, the confirm dialog, the router and the view registry. The plant itself comes from the hub (window.Twin);
   the agents from window.Agents. All plant data is simulated. */
window.DF = (function () {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const icon = (n, cls) => (typeof Icons !== 'undefined' ? Icons.get(n, cls) : '');
  const fmt = n => (isFinite(n) ? Math.round(n).toLocaleString('en-US') : '—');
  const pct = (v, d = 1) => (isFinite(v) ? (v * 100).toFixed(d) + '%' : '—');
  const money = n => (window.Agents ? Agents.egp(n) : 'EGP ' + fmt(n));
  const signed = (n, f = fmt) => (n > 0 ? '+' : n < 0 ? '−' : '±') + f(Math.abs(n));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* words for plant states (ISA-101: normal is quiet, colour only for abnormal) */
  const STATE = { run: 'Running', warn: 'Running slow', idle: 'Idle', starved: 'Starved', blocked: 'Blocked', down: 'Stopped', maint: 'Planned work', micro: 'Short stop', changeover: 'Changeover', tripped: 'Tripped', stopped: 'Stopped by a person' };
  const SEV = st => (st === 'down' || st === 'tripped' || st === 'stopped' ? 'bad' : st === 'maint' || st === 'changeover' ? 'maint' : st === 'warn' || st === 'starved' || st === 'micro' || st === 'blocked' ? 'warn' : 'ok');
  const stChip = (st, why) => `<span class="st ${SEV(st)}"><i></i>${esc(STATE[st] || st)}${why ? ` · ${esc(why)}` : ''}</span>`;

  /* refs: 'st:L1-MounterB', 'line:L3', 'buf:SM:main', 'agv:AGV-03', 'order:EX-2210', 'util:UTIL-CH2', 'case:C-104', 'unit:TV26-…' */
  function refName(ref) {
    const T = window.Twin, P = T && T.E && T.E.P; if (!P || !ref) return ref || '';
    const [k, ...rest] = ref.split(':'); const id = rest.join(':');
    if (k === 'st') return P.byId[id] ? P.byId[id].name + (P.lines[P.byId[id].line] ? ' · ' + P.lines[P.byId[id].line].name : '') : id;
    if (k === 'line') return P.lines[id] ? P.lines[id].name : id;
    if (k === 'buf') { const b = P.bufs[id]; return b ? (b.sm ? b.label + ' supermarket' : b.rm ? b.label + ' · warehouse' : `${b.label} at ${P.byId[b.station] ? P.byId[b.station].name : ''}`) : id; }
    if (k === 'agv') return id;
    if (k === 'order') return 'Order ' + id;
    if (k === 'util') { const a = P.util.assets.find(x => x.id === id); return a ? a.name : id; }
    if (k === 'case') return id;
    if (k === 'unit') return id;
    return ref;
  }
  const link = (ref, text) => `<button type="button" class="lnk" data-ref="${esc(ref)}">${esc(text != null ? text : refName(ref))}</button>`;
  // turn an engine 'ref' (station id, buffer id, AGV id, utility id) into a ref
  function toRef(r) {
    if (!r) return null;
    if (/^(st|line|buf|agv|order|util|case|unit):/.test(r)) return r;
    if (/^(SM|RM|LS):/.test(r)) return 'buf:' + r;
    if (/^AGV/.test(r)) return 'agv:' + r;
    if (/^UTIL/.test(r)) return 'util:' + r;
    if (/^L\d$/.test(r)) return 'line:' + r;
    return 'st:' + r;
  }

  function toast(msg, level) {
    const type = level === 'crit' || level === 'error' ? 'error' : level === 'warning' || level === 'warn' ? 'warning' : level === 'info' ? 'info' : 'success';
    const root = $('#toast-root'); if (!root) return;
    const node = document.createElement('div');
    node.className = `toast toast-${type}`;
    node.innerHTML = `${icon(type === 'success' ? 'checkCircle' : type === 'error' ? 'xCircle' : type === 'warning' ? 'alert' : 'info')}<span class="toast-msg"></span><button class="toast-x" type="button" aria-label="Dismiss notification">${icon('x')}</button>`;
    node.querySelector('.toast-msg').textContent = msg;
    root.append(node);
    while (root.children.length > 3) root.firstChild.remove();
    requestAnimationFrame(() => node.classList.add('show'));
    const kill = () => { node.classList.remove('show'); setTimeout(() => node.remove(), 300); };
    node.querySelector('.toast-x').onclick = kill;
    setTimeout(kill, 5200);
  }

  function confirmBox({ title, html, yes = 'Apply', busy }) {
    const d = $('#confirm');
    $('#cfTitle').textContent = title;
    $('#cfBody').innerHTML = html;
    const y = $('#cfYes'); y.textContent = yes; y.disabled = !!busy;
    return new Promise(res => {
      let done = false;
      const close = v => { if (done) return; done = true; if (d.open) d.close(); y.onclick = $('#cfNo').onclick = null; res(v); };
      y.onclick = () => close(true);
      $('#cfNo').onclick = () => close(false);
      d.onclose = () => close(false);
      if (d.showModal) d.showModal(); else res(window.confirm(title));
    });
  }

  /* a number that eases to its new value (transform-free text, reduced-motion safe) */
  const tweens = new WeakMap();
  function tween(el, to, f) {
    if (!el) return;
    if (reduce || !isFinite(to)) { el.textContent = f(to); return; }
    const cur = tweens.get(el);
    const from = cur ? cur.v : to;
    if (cur && Math.abs(cur.to - to) < 1e-9) return;
    const t0 = performance.now(), dur = 600;
    const st = { v: from, to };
    tweens.set(el, st);
    const tick = now => {
      if (tweens.get(el) !== st) return;
      const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      st.v = from + (to - from) * e;
      el.textContent = f(st.v);
      if (k < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
  // only touch the DOM when the markup changed (keeps focus, selection and hover)
  function html(el, s) { if (el && el._h !== s) { el._h = s; el.innerHTML = s; } }

  const VIEWS = {
    command: 'Command room', alarms: 'Alarms', control: 'Control', agents: 'AI agents', predict: 'Predictions', rootcause: 'Root cause',
    scenarios: 'Drills', leadership: 'Leadership', maintenance: 'Maintenance', quality: 'Quality', energy: 'Energy', simulator: 'What-if lab'
  };
  const hooks = {};
  const api = {
    $, $$, esc, icon, fmt, pct, money, signed, clamp, reduce, STATE, SEV, stChip, refName, link, toRef, toast, confirm: confirmBox, tween, html, VIEWS,
    view: 'command', sel: null,
    onView(name, fn) { (hooks[name] = hooks[name] || []).push(fn); },
    route() {
      let h = (location.hash || '#command').slice(1);
      if (h === 'copilot') { if (window.Copilot) Copilot.open(); h = api.view || 'command'; }
      if (h.startsWith('case:')) { const id = h.slice(5); h = 'agents'; setTimeout(() => api.openCase && api.openCase(id), 0); }
      if (h === 'twin') h = 'command';
      if (!$('#view-' + h)) h = 'command';
      const changed = api.view !== h;
      api.view = h;
      $$('.view').forEach(v => { v.hidden = v.id !== 'view-' + h; });
      $$('.nav a[data-view]').forEach(a => { const on = a.dataset.view === h; a.classList.toggle('active', on); if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
      $('#crumbView').textContent = VIEWS[h];
      $('#viewTitle').textContent = VIEWS[h];
      document.title = `${VIEWS[h]} · Digital Factory`;
      $('#side').classList.remove('open'); $('#sideShade').hidden = true;
      if (changed) scrollTo({ top: 0 });
      (hooks[h] || []).forEach(f => f(true));
      if (typeof Theme !== 'undefined') Theme.icons($('#view-' + h));
    },
    go(h) { if (location.hash === '#' + h) api.route(); else location.hash = h; },
    refresh(force) { (hooks[api.view] || []).forEach(f => f(!!force)); }
  };
  return api;
})();
