#!/usr/bin/env node
// web-design-pipeline / qa: test pages in a real browser at phone, tablet and desktop widths, in light and dark themes.
//
//   node qa.mjs <page.html | url> [more pages…] [--root DIR] [--widths 390,820,1440] [--themes light,dark]
//                [--theme-attr data-theme] [--theme-key localStorageKey] [--out DIR] [--full] [--json]
//
// Checks (FAIL blocks delivery, WARN must be read):
//   FAIL  sideways scroll · text contrast under WCAG AA · content hidden by motion · script errors · images without alt
//         · missing title/lang/viewport · motion still running or content hidden with prefers-reduced-motion
//   WARN  text under 14 px · tap targets under 44 px on touch widths · heading level skips · page weight · LCP · CLS
// Writes screenshots, report.json and report.html (a contact sheet to LOOK at) to --out (default .design-pipeline/qa).
// Exit code 0 = no FAIL. Zero dependencies: drives an installed Chrome / Edge / Chromium. Node 22+.
// The in-page probe is adapted from the Animation studio web gate (coolman1984/animation, studio/web/lib/check.mjs).
import { existsSync, mkdirSync, writeFileSync, statSync, createReadStream } from 'node:fs';
import { resolve, join, extname, sep, relative, dirname } from 'node:path';
import { createServer } from 'node:http';
import { Browser, sleep, findChrome } from './lib/cdp.mjs';
import { readdirSync } from 'node:fs';
import { homedir } from 'node:os';

// Also accept a Playwright-managed Chromium when no system Chrome / Edge is installed.
if (!process.env.CHROME_PATH && !findChrome()) {
  const roots = [process.env.PLAYWRIGHT_BROWSERS_PATH, join(homedir(), '.cache', 'ms-playwright'), process.env.LOCALAPPDATA && join(process.env.LOCALAPPDATA, 'ms-playwright'), join(homedir(), 'Library', 'Caches', 'ms-playwright')].filter(Boolean);
  outer: for (const r of roots) {
    if (!existsSync(r)) continue;
    for (const d of readdirSync(r).filter(n => /^chromium-\d+$/.test(n)).sort().reverse()) {
      for (const exe of [['chrome-linux', 'chrome'], ['chrome-win', 'chrome.exe'], ['chrome-mac', 'Chromium.app', 'Contents', 'MacOS', 'Chromium']]) {
        const f = join(r, d, ...exe);
        if (existsSync(f)) { process.env.CHROME_PATH = f; break outer; }
      }
    }
  }
}

const argv = process.argv.slice(2);
const opt = (name, def) => { const i = argv.indexOf('--' + name); if (i === -1) return def; const v = argv[i + 1]; argv.splice(i, 2); return v; };
const has = (name) => { const i = argv.indexOf('--' + name); if (i === -1) return false; argv.splice(i, 1); return true; };
const outDir = resolve(opt('out', '.design-pipeline/qa'));
const widths = opt('widths', '390,820,1440').split(',').map(Number).filter(Boolean);
const themes = opt('themes', 'light,dark').split(',').filter(Boolean);
const themeAttr = opt('theme-attr', 'data-theme');
const themeKey = opt('theme-key', '');
const root = resolve(opt('root', '.'));
const full = has('full');
const asJson = has('json');
const targets = argv.filter(a => !a.startsWith('--'));
if (!targets.length) { console.error('usage: node qa.mjs <page.html | url> [more…] [--root DIR] [--widths 390,820,1440] [--themes light,dark] [--out DIR] [--full] [--json]'); process.exit(2); }
const HEIGHT = { 390: 844, 820: 1180, 1440: 900 };

// ---------- local files are served over http so relative assets behave as when hosted ----------
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.avif': 'image/avif', '.gif': 'image/gif', '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.mp4': 'video/mp4', '.webm': 'video/webm', '.txt': 'text/plain; charset=utf-8', '.md': 'text/plain; charset=utf-8' };
let server = null, base = '';
if (targets.some(t => !/^https?:\/\//.test(t))) {
  server = createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    let f = resolve(join(root, p));
    if (!f.startsWith(root)) { res.writeHead(403); return res.end(); }
    if (existsSync(f) && statSync(f).isDirectory()) f = join(f, 'index.html');
    if (!existsSync(f)) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'content-type': MIME[extname(f).toLowerCase()] || 'application/octet-stream', 'cache-control': 'no-store' });
    createReadStream(f).pipe(res);
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}/`;
}
const urlOf = t => /^https?:\/\//.test(t) ? t : base + relative(root, resolve(t)).split(sep).join('/');

// ---------- runs inside the page ----------
const PERF_INIT = `(() => {
  window.__dp = { lcp: 0, cls: 0 };
  try { new PerformanceObserver(l => { for (const e of l.getEntries()) window.__dp.lcp = e.startTime; }).observe({ type: 'largest-contentful-paint', buffered: true }); } catch (e) {}
  try { new PerformanceObserver(l => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__dp.cls += e.value; }).observe({ type: 'layout-shift', buffered: true }); } catch (e) {}
})();`;
const themeInit = theme => `(() => { try { ${themeKey ? `localStorage.setItem(${JSON.stringify(themeKey)}, ${JSON.stringify(theme)});` : ''} } catch (e) {}
  const set = () => { if (!document.documentElement) return; ${themeAttr ? `document.documentElement.setAttribute(${JSON.stringify(themeAttr)}, ${JSON.stringify(theme)});` : ''} };
  set(); document.addEventListener('DOMContentLoaded', set); })();`;
const PROBE = `(async () => {
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const H = () => document.documentElement.scrollHeight;
  for (let y = 0; y <= H(); y += innerHeight * 0.6) { scrollTo({ top: y, behavior: 'instant' }); await wait(120); }
  scrollTo({ top: H(), behavior: 'instant' }); await wait(450);
  const clipped = el => { for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) { const o = getComputedStyle(p); if (/(hidden|clip|auto|scroll)/.test(o.overflowX + o.overflow)) return true; } return false; };
  const solid = c => { const m = c.match(/[\\d.]+/g); if (!m) return null; const k = /^color\\(srgb/.test(c) ? 255 : 1; const a = c.includes('/') ? +m[3] : m[3]; return a === undefined || +a > 0.9 ? m.slice(0, 3).map(v => +v * k) : null; };
  const bgOf = el => { for (let p = el; p; p = p.parentElement) { const cs = getComputedStyle(p); if (cs.backgroundImage !== 'none' && !p.matches('body, html')) return null; const s = solid(cs.backgroundColor); if (s) return s; } return solid(getComputedStyle(document.body).backgroundColor) || [255, 255, 255]; };
  const lum = c => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  const VW = document.documentElement.clientWidth;
  const out = { overflowPx: Math.max(document.documentElement.scrollWidth - VW, Math.round(innerWidth - (visualViewport?.width || innerWidth))), wide: [], noAlt: [], small: [], lowContrast: [], tiny: [], hidden: [], h1: document.querySelectorAll('h1').length, headingSkips: [] };
  const visible = el => { for (let p = el; p && p !== document.documentElement; p = p.parentElement) { const s = getComputedStyle(p); if (s.visibility === 'hidden' || s.display === 'none' || p.hidden || p.getAttribute('aria-hidden') === 'true' || p.inert) return false; } return true; };
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect(); if (!r.width || !r.height) continue;
    const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || cs.display === 'none') continue;
    if ((r.right > VW + 1 || r.left < -1) && r.left < VW && r.right > 0 && !clipped(el) && cs.position !== 'fixed') out.wide.push(el.tagName.toLowerCase() + (el.id ? '#' + el.id : el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : ''));
    const own = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
    if (own && visible(el) && +cs.opacity > 0.05) {
      const fs = parseFloat(cs.fontSize), color = solid(cs.color), bg = bgOf(el), text = el.textContent.trim().replace(/\\s+/g, ' ').slice(0, 40);
      if (fs < 14) out.small.push(text + ' (' + fs + 'px)');
      if (color && bg) { const c = ratio(color, bg), need = fs >= 24 || (fs >= 18.66 && +cs.fontWeight >= 700) ? 3 : 4.5; if (c < need) out.lowContrast.push(text + ' ' + c.toFixed(2) + ':1 (needs ' + need + ')'); }
      if (+cs.opacity < 0.5 && el.closest('[data-reveal], [data-split], .reveal, [data-animate]')) out.hidden.push(text);
    }
    if (el.matches('a, button, summary, [role=button], input, select') && VW < 900 && visible(el) && r.right > 0 && r.left < VW && (r.height < 44 || r.width < 44) && !el.closest('p, li > a:only-child') ) out.tiny.push((el.textContent.trim() || el.getAttribute('aria-label') || el.tagName).slice(0, 30) + ' ' + Math.round(r.width) + '×' + Math.round(r.height));
  }
  for (const img of document.images) if (!img.hasAttribute('alt')) out.noAlt.push(img.src.split('/').pop());
  let last = 0; for (const h of document.querySelectorAll('h1, h2, h3, h4, h5, h6')) { if (!visible(h)) continue; const l = +h.tagName[1]; if (last && l > last + 1) out.headingSkips.push(h.textContent.trim().slice(0, 40)); last = l; }
  scrollTo({ top: 0, behavior: 'instant' }); await wait(600);
  for (const el of document.querySelectorAll('[data-reveal], [data-split] .w, .reveal')) { const r = el.getBoundingClientRect(); if (r.top >= 0 && r.bottom <= innerHeight && r.height && +getComputedStyle(el).opacity < 0.9 && visible(el)) out.hidden.push('first screen: ' + (el.textContent.trim().slice(0, 40) || el.tagName)); }
  out.meta = { title: document.title, description: document.querySelector('meta[name=description]')?.content || '', lang: document.documentElement.lang, viewport: !!document.querySelector('meta[name=viewport]') };
  out.running = document.getAnimations().filter(a => a.playState === 'running' && a.effect?.getComputedTiming?.().iterations === Infinity).length;
  const nav = performance.getEntriesByType('navigation')[0], res = performance.getEntriesByType('resource');
  out.perf = { domMs: Math.round(nav?.domContentLoadedEventEnd || 0), loadMs: Math.round(nav?.loadEventEnd || 0), requests: res.length + 1,
    bytes: [nav, ...res].reduce((s, e) => s + (e?.transferSize || e?.encodedBodySize || e?.decodedBodySize || 0), 0), lcp: Math.round(window.__dp?.lcp || 0), cls: +(window.__dp?.cls || 0).toFixed(3) };
  return out;
})()`;

// ---------- run ----------
mkdirSync(outDir, { recursive: true });
// Chrome refuses to start as root (containers, CI) without --no-sandbox; desktops keep the sandbox.
const browser = await Browser.launch({ extraArgs: process.getuid?.() === 0 ? ['--no-sandbox'] : [] });
const findings = [], shots = [], runs = [];
const add = (level, id, page, where, message) => findings.push({ level, id, page, where, message });
const uniq = a => [...new Set(a)];
for (const t of targets) {
  const url = urlOf(t), name = t.replace(/^https?:\/\//, '').replace(/[^\w.-]+/g, '_');
  for (const theme of themes) for (const w of widths) {
    const h = HEIGHT[w] || Math.round(w * 0.65);
    const page = await browser.newPage({ width: w, height: h, mobile: w < 900 });
    await page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: theme }] });
    await page.send('Page.addScriptToEvaluateOnNewDocument', { source: PERF_INIT + themeInit(theme) });
    await page.goto(url, { timeoutMs: 30000, settleMs: 900 });
    await page.eval('document.fonts.ready.then(() => true)').catch(() => {});
    const m = await page.eval(PROBE);
    const where = `${w}px ${theme}`;
    const file = join(outDir, `${name}-${theme}-${w}.jpg`);
    await page.screenshot({ path: file, quality: 80, fullPage: full });
    shots.push({ page: t, theme, width: w, file: relative(outDir, file) });
    runs.push({ page: t, theme, width: w, perf: m.perf, errors: page.consoleErrors.slice(0, 5) });
    if (m.overflowPx > 1) add('FAIL', 'sideways-scroll', t, where, `${m.overflowPx}px wider than the screen${m.wide.length ? ': ' + uniq(m.wide).slice(0, 4).join(', ') : ''}`);
    if (m.lowContrast.length) add('FAIL', 'contrast', t, where, uniq(m.lowContrast).slice(0, 6).join(' · '));
    if (m.hidden.length) add('FAIL', 'hidden-by-motion', t, where, uniq(m.hidden).slice(0, 4).join(' · '));
    if (page.consoleErrors.length) add('FAIL', 'script-errors', t, where, uniq(page.consoleErrors.map(e => e.split('\n')[0])).slice(0, 3).join(' · '));
    if (m.noAlt.length) add('FAIL', 'image-alt', t, where, m.noAlt.slice(0, 5).join(', '));
    if (m.small.length) add('WARN', 'small-text', t, where, `${m.small.length} text nodes under 14px, e.g. ${uniq(m.small).slice(0, 4).join(' · ')}`);
    if (m.tiny.length) add('WARN', 'tap-targets', t, where, uniq(m.tiny).slice(0, 5).join(' · '));
    if (theme === themes[0] && w === widths[widths.length - 1]) {
      const meta = m.meta, miss = [!meta.title && 'title', !meta.lang && 'lang', !meta.viewport && 'viewport'].filter(Boolean);
      if (miss.length) add('FAIL', 'meta', t, where, 'missing ' + miss.join(', '));
      if (!meta.description) add('WARN', 'meta-description', t, where, 'no meta description');
      if (m.h1 !== 1) add('WARN', 'h1', t, where, `${m.h1} h1 elements`);
      if (m.headingSkips.length) add('WARN', 'heading-skips', t, where, uniq(m.headingSkips).slice(0, 4).join(' · '));
      const kb = Math.round(m.perf.bytes / 1024);
      if (kb > 3000) add('FAIL', 'weight', t, where, `${kb} KB transferred`); else if (kb > 1500) add('WARN', 'weight', t, where, `${kb} KB transferred`);
      if (m.perf.lcp > 2500) add('WARN', 'lcp', t, where, `largest paint ${m.perf.lcp} ms (local server; target ≤ 2500 ms)`);
      if (m.perf.cls > 0.1) add('WARN', 'cls', t, where, `layout shift ${m.perf.cls} (target ≤ 0.1)`);
    }
    await page.close();
  }
  // reduced motion: a still, complete page
  const rp = await browser.newPage({ width: widths[0], height: HEIGHT[widths[0]] || 844, mobile: true, reducedMotion: true });
  await rp.goto(url, { timeoutMs: 30000, settleMs: 900 });
  const r = await rp.eval(PROBE);
  if (r.running) add('WARN', 'reduced-motion', t, 'reduced motion', `${r.running} infinite animation(s) still running`);
  if (r.hidden.length) add('FAIL', 'reduced-motion', t, 'reduced motion', `content hidden: ${uniq(r.hidden).slice(0, 3).join(' · ')}`);
  await rp.close();
}
await browser.close();
server?.close();

// ---------- report ----------
const fails = findings.filter(f => f.level === 'FAIL').length, warns = findings.length - fails;
const verdict = fails ? `NOT READY · ${fails} FAIL, ${warns} WARN` : warns ? `READY · read ${warns} WARN` : 'READY';
writeFileSync(join(outDir, 'report.json'), JSON.stringify({ verdict, findings, runs, shots }, null, 2));
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
writeFileSync(join(outDir, 'report.html'), `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>QA report</title>
<style>body{font:14px/1.5 system-ui,sans-serif;margin:24px;background:#f4f5f7;color:#111}h1{font-size:22px}table{border-collapse:collapse;width:100%;background:#fff;margin:12px 0 28px}td,th{border-bottom:1px solid #e3e5ea;padding:8px;text-align:left;vertical-align:top}.FAIL{color:#b42318;font-weight:700}.WARN{color:#8a5a00;font-weight:700}.g{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px}figure{margin:0;background:#fff;border:1px solid #e3e5ea;border-radius:10px;overflow:hidden}figure img{width:100%;display:block}figcaption{padding:6px 10px;font-size:12px;color:#555}</style>
<h1>${esc(verdict)}</h1><table><tr><th>Level</th><th>Check</th><th>Page</th><th>Where</th><th>Detail</th></tr>${findings.map(f => `<tr><td class="${f.level}">${f.level}</td><td>${esc(f.id)}</td><td>${esc(f.page)}</td><td>${esc(f.where)}</td><td>${esc(f.message)}</td></tr>`).join('') || '<tr><td colspan=5>No findings.</td></tr>'}</table>
<div class="g">${shots.map(s => `<figure><img src="${esc(s.file)}" alt="${esc(s.page)} at ${s.width}px, ${s.theme} theme" loading="lazy"><figcaption>${esc(s.page)} · ${s.width}px · ${s.theme}</figcaption></figure>`).join('')}</div>`);
if (asJson) console.log(JSON.stringify({ verdict, findings, runs }, null, 2));
else {
  console.log(verdict);
  for (const f of findings) console.log(`  ${f.level}  ${f.id.padEnd(17)} ${f.page} @ ${f.where}: ${f.message}`);
  for (const r of runs.filter(r => r.width === widths[widths.length - 1] && r.theme === themes[0])) console.log(`  perf  ${r.page}: ${Math.round(r.perf.bytes / 1024)} KB, ${r.perf.requests} requests, LCP ${r.perf.lcp} ms, CLS ${r.perf.cls}`);
  console.log(`  screenshots + contact sheet: ${relative(process.cwd(), join(outDir, 'report.html'))}`);
}
process.exit(fails ? 1 : 0);
