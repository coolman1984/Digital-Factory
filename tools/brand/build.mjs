#!/usr/bin/env node
// Builds the brand files from marks.mjs: SVG logo, glyph and module icons, PNG app icons (16 to 512, maskable),
// the social card, and the web app manifest. Run from the repo root: node tools/brand/build.mjs
// Uses the design pipeline's Chrome driver (set CHROME_PATH if Chrome is not found).
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as M from './marks.mjs';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..'), OUT = join(ROOT, 'assets', 'brand');
mkdirSync(OUT, { recursive: true });
const w = (f, s) => writeFileSync(join(OUT, f), s);
w('logo.svg', M.mark()); w('maskable.svg', M.maskable()); w('glyph.svg', M.glyphOnly('#000'));
for (const k of Object.keys(M.MODULES)) w(`mod-${k}.svg`, M.module(k));

const { Browser } = await import(pathToFileURL(join(ROOT, '.claude/skills/web-design-pipeline/scripts/lib/cdp.mjs')).href);
const browser = await Browser.launch({ extraArgs: process.getuid && process.getuid() === 0 ? ['--no-sandbox'] : [] });
async function png(svgOrHtml, file, wd, ht = wd, html = false) {
  const page = await browser.newPage({ width: wd, height: ht });
  await page.send('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } });
  const doc = html ? svgOrHtml : `<!doctype html><style>html,body{margin:0;background:transparent}img{display:block;width:${wd}px;height:${ht}px}</style><img src="data:image/svg+xml,${encodeURIComponent(svgOrHtml)}">`;
  await page.send('Page.navigate', { url: 'data:text/html;charset=utf-8,' + encodeURIComponent(doc) });
  await new Promise(r => setTimeout(r, 600));
  await page.screenshot({ path: join(OUT, file), format: file.endsWith('.jpg') ? 'jpeg' : 'png', quality: 88, clip: { x: 0, y: 0, width: wd, height: ht } });
  await page.close();
}
for (const s of [16, 32, 48, 180, 192, 512]) await png(M.mark(), `icon-${s}.png`, s);
await png(M.maskable(), 'maskable-512.png', 512);
for (const k of ['plant', 'room', 'present', 'guide']) await png(M.module(k), `mod-${k}-96.png`, 96);
// the social card (Open Graph, 1200 × 630): the mark, the name and the line, on the deep brand field
const svgUrl = s => 'data:image/svg+xml,' + encodeURIComponent(s);
await png(`<!doctype html><meta charset="utf-8"><style>
  html,body{margin:0;width:1200px;height:630px;overflow:hidden;font-family:Inter,'Segoe UI',Arial,sans-serif}
  body{background:radial-gradient(900px 520px at 78% 20%,#2D5BFF 0%,#1428A0 45%,#0B1024 100%);color:#fff;display:grid;align-content:center;padding:0 96px;box-sizing:border-box}
  .grid{position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.05) 1px,transparent 1px);background-size:48px 48px}
  img{width:132px;height:132px;border-radius:30px;box-shadow:0 30px 80px rgba(0,0,0,.35);position:relative}
  h1{font-size:82px;line-height:1;letter-spacing:-.035em;margin:44px 0 18px;font-weight:800;position:relative}
  p{font-size:32px;margin:0;color:#C9D6FF;font-weight:500;position:relative}
  b{color:#7FE4FF;font-weight:700}</style><div class="grid"></div><img src="${svgUrl(M.mark())}"><h1>Digital Factory</h1><p>A live digital twin of Plant EG-01 · <b>3D, AI agents, SAP and GMES</b></p>`, 'og.jpg', 1200, 630, true);
await browser.close();

// the web app manifest: installable, with shortcuts to the plant, the command room, the presentation and the guide
const icons = [16, 32, 48, 192, 512].map(s => ({ src: `icon-${s}.png`, sizes: `${s}x${s}`, type: 'image/png', purpose: 'any' }))
  .concat([{ src: 'maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }, { src: 'logo.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }]);
const sc = (name, url, k, description) => ({ name, short_name: name, url, description, icons: [{ src: `mod-${k}-96.png`, sizes: '96x96', type: 'image/png' }] });
w('site.webmanifest', JSON.stringify({
  name: 'Digital Factory · Plant EG-01', short_name: 'Digital Factory', description: 'A live digital twin of a fictional TV plant: 3D plant, command room, AI agents, SAP and GMES.',
  start_url: '../../index.html', scope: '../../', display: 'standalone', background_color: '#0B1024', theme_color: '#1428A0', icons,
  shortcuts: [sc('Live plant', '../../plant.html', 'plant', 'The whole plant running in 3D'), sc('Command room', '../../app.html', 'room', 'Lines, alarms, decisions and the agent crew'),
    sc('Present', '../../plant.html#present', 'present', 'The plant full screen, shot by shot'), sc('Guide', '../../guide.html', 'guide', 'Every screen and term, in Arabic and English')]
}, null, 2) + '\n');
// the pages: icon and manifest links, the social card, the logo glyph for CSS, the start-up splash.
// Each block sits between markers, so a rebuild replaces it in place.
import('node:fs').then(({ readFileSync }) => {
  const between = (file, a, b, text) => {
    const f = join(ROOT, file), src = readFileSync(f, 'utf8'), i = src.indexOf(a), j = src.indexOf(b);
    if (i < 0 || j < 0) throw new Error(`markers ${a} … ${b} missing in ${file}`);
    writeFileSync(f, src.slice(0, i + a.length) + text + src.slice(j));
  };
  const SITE = 'https://coolman1984.github.io/Digital-Factory/';
  for (const page of ['index', 'app', 'deck', 'guide', 'plant', 'showroom']) {
    const html = readFileSync(join(ROOT, page + '.html'), 'utf8'), title = (html.match(/<title>([^<]*)<\/title>/) || [])[1] || 'Digital Factory', desc = (html.match(/<meta name="description" content="([^"]*)"/) || [])[1] || '';
    between(page + '.html', '<!-- df-icons -->', '<!-- /df-icons -->', `
  <link rel="icon" href="assets/brand/logo.svg" type="image/svg+xml">
  <link rel="icon" href="assets/brand/icon-32.png" sizes="32x32" type="image/png">
  <link rel="apple-touch-icon" href="assets/brand/icon-180.png">
  <link rel="manifest" href="assets/brand/site.webmanifest">
  <meta name="theme-color" content="${M.C.b}">
  <meta name="application-name" content="Digital Factory">
  <meta name="apple-mobile-web-app-title" content="Digital Factory">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Digital Factory">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${desc}">
  <meta property="og:image" content="${SITE}assets/brand/og.jpg">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta name="twitter:card" content="summary_large_image">
  `);
  }
  // the glyph for the CSS lockup: white factory and cells, and the lit cell apart, so each can take its own colour
  const uri = svg => `url("data:image/svg+xml,${encodeURIComponent(svg).replace(/'/g, '%27')}")`;
  const white = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><path d="${M.FACTORY}"/>${M.CELLS.map(([x, y, o]) => `<rect x="${x}" y="${y}" width="3.4" height="3.4" rx=".7"${o < 1 ? ` opacity="${o}"` : ''}/>`).join('')}</svg>`;
  const live = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect x="${M.LIVE[0]}" y="${M.LIVE[1]}" width="3.4" height="3.4" rx=".7"/></svg>`;
  between('assets/css/theme.css', '/* df-brand:start */', '/* df-brand:end */', `\n:root { --df-glyph: ${uri(white)}; --df-live: ${uri(live)}; }\n`);
  // the splash: the mark drawn inline so its cells can light up one by one while the page starts
  const cells = M.CELLS.map(([x, y, o], i) => `<rect class="c c${i + 1}" x="${x}" y="${y}" width="3.4" height="3.4" rx=".7" fill="#fff"${o < 1 ? ` opacity="${o}"` : ''}/>`).join('');
  const svg = `<svg class="df-splash-mark" viewBox="0 0 32 32" aria-hidden="true"><defs><linearGradient id="dfSg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${M.C.a}"/><stop offset="1" stop-color="${M.C.b}"/></linearGradient></defs><rect width="32" height="32" rx="8" fill="url(#dfSg)"/><path class="f" fill="#fff" d="${M.FACTORY}"/>${cells}<rect class="c live" x="${M.LIVE[0]}" y="${M.LIVE[1]}" width="3.4" height="3.4" rx=".7" fill="${M.C.live}"/></svg>`;
  between('assets/js/brand.js', '// df-mark:start', '// df-mark:end', `\nwindow.DF_MARK = ${JSON.stringify({ factory: M.FACTORY, cells: M.CELLS, live: M.LIVE, colors: M.C })};\n`);
  for (const page of ['app', 'plant', 'showroom']) between(page + '.html', '<!-- df-splash -->', '<!-- /df-splash -->', `\n  ${svg}\n  `);
  console.log('brand files in', OUT, '· pages, theme.css and splashes updated');
});
