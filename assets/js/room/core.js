/* Digital Factory — command room core (window.DF): helpers, words for plant states, refs (what a link points at),
   toasts, the confirm dialog, the router and the view registry. The plant is Plant EG-01, the same model as the 3D
   plant: the engine (assets/js/plant/engine.js), the enterprise layer (erp.js) and the agent crew (agents.js), booted by
   main.js and reachable here as DF.E, DF.X and DF.AG. All plant data is simulated. */
window.DF = (function () {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const icon = (n, cls) => (typeof Icons !== 'undefined' ? Icons.get(n, cls) : '');
  const fmt = n => (isFinite(n) ? Math.round(n).toLocaleString('en-US') : '—');
  const pct = (v, d = 1) => (isFinite(v) ? (v * 100).toFixed(d) + '%' : '—');
  const money = n => (api.X ? api.X.egp(n) : 'EGP ' + fmt(n));
  const signed = (n, f = fmt) => (n > 0 ? '+' : n < 0 ? '−' : '±') + f(Math.abs(n));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* words for plant states (ISA-101: normal is quiet, colour only for abnormal) */
  const STATE = { run: 'Running', warn: 'Running slow', idle: 'Idle', starved: 'Starved', blocked: 'Blocked', down: 'Stopped', maint: 'Planned work', micro: 'Short stop', changeover: 'Changeover', tripped: 'Tripped', stopped: 'Stopped by a person' };
  const SEV = st => (st === 'down' || st === 'tripped' || st === 'stopped' ? 'bad' : st === 'maint' || st === 'changeover' ? 'maint' : st === 'warn' || st === 'starved' || st === 'micro' || st === 'blocked' ? 'warn' : 'ok');
  const tag = (sev, label) => `<span class="st ${sev || ''}"><i></i>${esc(label)}</span>`;
  const stChip = (st, why) => `<span class="st ${SEV(st)}"><i></i>${esc(STATE[st] || st)}${why ? ` · ${esc(why)}` : ''}</span>`;

  /* refs, as in the 3D plant: 'st:ML1-Packing', 'line:ML3', 'buf:LS:ML1:CTN', 'agv:AGV-03', 'tug:T1', 'fl:FL-02', 'order:SO-…',
     'util:UTIL-CH2', 'unit:TV26…', 'po:…', 'dept:quality', 'card:<decision key>' */
  function refName(ref) {
    const P = api.E && api.E.P; if (!P || !ref) return ref || '';
    const i = ref.indexOf(':'), k = ref.slice(0, i), id = ref.slice(i + 1);
    if (k === 'st') { const s = P.byId[id]; return s ? s.name + (P.lines[s.line] ? ' · ' + P.lines[s.line].name : '') : id; }
    if (k === 'line') return P.lines[id] ? P.lines[id].name : id;
    if (k === 'buf') { const b = P.bufs[id]; return b ? (b.station && P.byId[b.station] ? `${b.code} at ${P.byId[b.station].name}${P.lines[b.line] ? ' · ' + P.lines[b.line].name : ''}` : b.label || b.code || id) : id; }
    if (k === 'agv' || k === 'tug' || k === 'fl') return id;
    if (k === 'order') return 'Order ' + id;
    if (k === 'util') { const a = P.util.assets.find(x => x.id === id); return a ? a.name : id; }
    if (k === 'unit') return id;
    if (k === 'dept') { const d = api.X && api.X.DEPTS.find(x => x.id === id); return d ? d.name : id; }
    if (k === 'zone') { const z = P.layout.ZONES.find(x => x.id === id); return z ? z.name : id; }
    if (k === 'person') { const p = P.people.find(x => x.id === id); return p ? `${p.name} · ${p.role}` : id; }
    if (k === 'inbound') return 'Inbound truck ' + id;
    if (k === 'card') { const c = api.AG && api.AG.cards.get(id); return c ? c.title : 'Decision'; }
    return ref;
  }
  const link = (ref, text) => `<button type="button" class="lnk" data-ref="${esc(ref)}">${esc(text != null ? text : refName(ref))}</button>`;
  // turn an engine 'ref' (station id, buffer id, vehicle id, utility id) into a ref
  function toRef(r) {
    if (!r) return null;
    if (/^(st|line|buf|agv|tug|fl|order|util|unit|po|dept|card|mrp|svc|zone|person|inbound):/.test(r)) return r;
    if (/^(IMP|LOC|INJ|PRS|PBA|SVC|SILO|HALL|LS|WIP|SM|RM):/.test(r)) return 'buf:' + r;
    if (/^AGV/.test(r)) return 'agv:' + r;
    if (/^FL-/.test(r)) return 'fl:' + r;
    if (/^Milk run/.test(r)) return 'tug:' + r;
    if (/^UTIL/.test(r)) return 'util:' + r;
    if (/^(ML|LCM|SMD|PR|CUS)\d$|^INJ$/.test(r)) return 'line:' + r;
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
    scenarios: 'Drills', autopilot: 'Autopilot', leadership: 'Leadership', maintenance: 'Maintenance', quality: 'Quality', energy: 'Energy', simulator: 'What-if lab'
  };
  const hooks = {};
  const api = {
    $, $$, esc, icon, fmt, pct, money, signed, clamp, reduce, STATE, SEV, stChip, tag, refName, link, toRef, toast, confirm: confirmBox, tween, html, VIEWS,
    view: 'command', sel: null, E: null, X: null, AG: null, boot: [],
    onView(name, fn) { (hooks[name] = hooks[name] || []).push(fn); },
    route() {
      let h = (location.hash || '#command').slice(1);
      if (h === 'copilot') { if (window.Copilot) Copilot.open(); h = api.view || 'command'; }
      if (h.startsWith('case:') || h.startsWith('card:')) { const id = h.slice(5); h = 'agents'; setTimeout(() => api.openCase && api.openCase(id), 0); }
      if (/^(st|line|buf|order|unit|util|agv|tug|fl):/.test(h)) { const r = h; h = 'command'; setTimeout(() => api.select && api.select(r), 0); }
      if (h === 'twin') h = 'command';
      if (!/^[a-z][a-z0-9-]*$/.test(h) || !$('#view-' + h)) h = 'command';
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
