/* Digital Factory — spoken alerts (a voice andon): when switched on, the room says new priority 1 and 2 alarms and new
   urgent decisions out loud, in the page language, with the browser's own speech (no server, no key). Off by default; the
   choice is kept in this browser. Key V switches it. Plant data is simulated. */
(function () {
  'use strict';
  const DF = window.DF; if (!DF || !('speechSynthesis' in window)) return;
  const KEY = 'df-voice';
  const ar = () => document.documentElement.lang === 'ar';
  const T = (en, a) => (ar() ? (window.DFI18N && DFI18N.agree ? DFI18N.agree(a) : a) : en);   // Arabic counts agree with what they count (i18n.js)
  const tr = s => (ar() && window.DFI18N && DFI18N.t(s)) || s;
  let on = false; try { on = localStorage.getItem(KEY) === '1'; } catch (e) { /* storage unavailable */ }
  const said = new Set();

  function voiceFor(lang) {
    const vs = speechSynthesis.getVoices();
    return vs.find(v => v.lang && v.lang.toLowerCase().startsWith(lang)) || null;
  }
  function say(en, a) {
    if (!on) return;
    const wantAr = ar(), v = voiceFor(wantAr ? 'ar' : 'en');
    // without an Arabic voice on this device the English sentence is spoken rather than nothing
    const useAr = wantAr && v, u = new SpeechSynthesisUtterance(useAr ? a : en);
    u.lang = useAr ? (v.lang || 'ar-EG') : 'en-US'; if (useAr || (!wantAr && v)) u.voice = v; else { const e = voiceFor('en'); if (e) u.voice = e; }
    u.rate = 1; u.pitch = 1;
    speechSynthesis.speak(u);
  }

  // what is new since the last look: priority 1–2 alarms and urgent decisions
  function check() {
    const P = DF.P, A = DF.AG; if (!P || !A) return;
    for (const a of P.alarms) {
      if (a.prio > 2 || a.state === 'ack' || said.has('al' + a.id)) continue;
      said.add('al' + a.id);
      say(`Priority ${a.prio} alarm. ${a.msg}.`, `إنذار بالأولوية ${a.prio}. ${tr(a.msg)}.`);
    }
    for (const c of A.cards.values()) {
      if (c.decided || c.autoDone || c.level !== 'crit' || said.has('c' + c.key)) continue;
      said.add('c' + c.key);
      say(`Urgent decision. ${c.title}. The ${c.agentName} recommends ${c.best ? c.best.label : 'waiting'}.`,
        `قرار عاجل. ${tr(c.title)}. ويوصي ${tr(c.agentName)} بـ${tr(c.best ? c.best.label : 'Wait')}.`);
    }
  }
  // what is already there when the voice is switched on is not read out, only what comes after
  function prime() { const P = DF.P, A = DF.AG; if (!P || !A) return; P.alarms.forEach(a => said.add('al' + a.id)); for (const c of A.cards.values()) said.add('c' + c.key); }

  /* ---------- the switch, in the alarm list's header ---------- */
  const btn = document.createElement('button');
  btn.type = 'button'; btn.className = 'btn btn-secondary btn-sm'; btn.id = 'voiceBtn'; btn.dataset.noI18n = '';
  const head = document.querySelector('#alListH'); const row = head && head.closest('.card-head') && head.closest('.card-head').querySelector('.row-gap');
  if (row) row.prepend(btn);
  function paint() {
    btn.setAttribute('aria-pressed', String(on));
    btn.textContent = on ? T('Spoken alerts: on', 'التنبيه الصوتي: يعمل') : T('Spoken alerts: off', 'التنبيه الصوتي: متوقف');
    btn.title = T('Say new priority 1–2 alarms and urgent decisions out loud (V)', 'نطق الإنذارات الجديدة بالأولوية 1–2 والقرارات العاجلة بصوت مسموع (V)');
  }
  function set(v) {
    on = v; try { localStorage.setItem(KEY, v ? '1' : '0'); } catch (e) { /* storage unavailable */ }
    paint();
    if (v) { prime(); say('Spoken alerts are on.', 'التنبيه الصوتي يعمل.'); } else speechSynthesis.cancel();
    if (DF.toast) DF.toast(v ? T('Spoken alerts on: new urgent alarms and decisions will be read out.', 'التنبيه الصوتي يعمل: ستُقرأ الإنذارات والقرارات العاجلة الجديدة.') : T('Spoken alerts off.', 'التنبيه الصوتي متوقف.'), 'info');
  }
  btn.addEventListener('click', () => set(!on));
  addEventListener('keydown', e => {
    if ((e.key === 'v' || e.key === 'V') && !e.ctrlKey && !e.metaKey && !e.altKey && !/INPUT|TEXTAREA|SELECT/.test(e.target.tagName) && !document.querySelector('dialog[open]')) set(!on);
  });
  addEventListener('langchange', paint);
  paint();
  // the room boots first; anything already open then is not news
  setTimeout(() => { prime(); setInterval(check, 2000); }, 1500);
  DF.voice = { set, get on() { return on; } };
})();
