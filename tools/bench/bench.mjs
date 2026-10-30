#!/usr/bin/env node
// Visual-factory benchmark: loads each production at fixed viewpoints and records load time, frame time
// (p50 / p95 / fps), draw calls, triangles, GPU resources (renderer.info) and JS heap, plus a screenshot per pose.
// Cross-platform (Node only, no shell); uses the design pipeline's Chrome driver. Run from the repo root:
//   node tools/bench/bench.mjs [--suite tools/bench/suite.json] [--out .design-pipeline/bench/run] [--only plant]
// Numbers depend on the machine: compare runs from the same machine only, and say which machine it was.
import { createServer } from 'node:http';
import { existsSync, createReadStream, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, extname, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import os from 'node:os';

const HERE = dirname(fileURLToPath(import.meta.url)), ROOT = resolve(HERE, '..', '..');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const suite = JSON.parse(readFileSync(resolve(ROOT, arg('suite', 'tools/bench/suite.json')), 'utf8'));
const OUT = resolve(ROOT, arg('out', '.design-pipeline/bench/' + new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')));
const only = arg('only', '');
mkdirSync(OUT, { recursive: true });
const { Browser, sleep } = await import(pathToFileURL(join(ROOT, '.claude/skills/web-design-pipeline/scripts/lib/cdp.mjs')).href);

const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript', '.svg': 'image/svg+xml', '.json': 'application/json', '.glb': 'model/gltf-binary', '.wasm': 'application/wasm', '.woff2': 'font/woff2', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp' };
const srv = createServer((q, r) => { const f = join(ROOT, decodeURIComponent(new URL(q.url, 'http://x').pathname)); if (!f.startsWith(ROOT) || !existsSync(f)) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': MIME[extname(f)] || 'application/octet-stream' }); createReadStream(f).pipe(r); });
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${srv.address().port}/`;

// in-page probe: whole-frame renderer.info (all passes), frame-time distribution, heap
const PROBE = `window.__dfProbe = function (ms) {
  return new Promise(function (done) {
    var r = (window.__dfRenderer && window.__dfRenderer()) || (window.Plant && Plant.V && Plant.V.renderer) || null;
    if (r && r.info) { r.info.autoReset = false; r.info.reset(); }
    var ft = [], calls = 0, tris = 0, n = 0, t0 = performance.now(), last = t0;
    function f(t) {
      ft.push(t - last); last = t; n++;
      if (r && r.info) { calls += r.info.render.calls; tris += r.info.render.triangles; r.info.reset(); }
      if (t - t0 < ms) return requestAnimationFrame(f);
      if (r && r.info) r.info.autoReset = true;
      ft.shift(); ft.sort(function (a, b) { return a - b; });
      var q = function (p) { return ft.length ? +ft[Math.min(ft.length - 1, Math.floor(p * ft.length))].toFixed(1) : null; };
      var mean = ft.reduce(function (a, b) { return a + b; }, 0) / Math.max(1, ft.length);
      done({ frames: ft.length, fps: +(1000 / mean).toFixed(1), p50: q(0.5), p95: q(0.95), worst: q(1),
        calls: n ? Math.round(calls / n) : null, triangles: n ? Math.round(tris / n) : null,
        geometries: r && r.info ? r.info.memory.geometries : null, textures: r && r.info ? r.info.memory.textures : null, programs: r && r.info && r.info.programs ? r.info.programs.length : null,
        heapMB: performance.memory ? +(performance.memory.usedJSHeapSize / 1048576).toFixed(1) : null,
        pixelRatio: r ? r.getPixelRatio() : devicePixelRatio, backend: r ? (r.isWebGPURenderer ? 'webgpu' : 'webgl2') : (window.__dfBackend || 'n/a') });
    }
    requestAnimationFrame(f);
  });
};`;

// --gpu: use the machine's real graphics card (ANGLE on D3D11 on Windows) instead of SwiftShader, so frame times mean something
const GPU = process.argv.includes('--gpu');
const glArgs = GPU ? ['--use-gl=angle', '--use-angle=' + (process.platform === 'win32' ? 'd3d11' : 'default'), '--enable-gpu-rasterization']
  : ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
const b = await Browser.launch({ extraArgs: ['--no-sandbox', ...glArgs, '--enable-precise-memory-info', '--ignore-gpu-blocklist'] });
const report = { at: new Date().toISOString(), machine: { platform: process.platform, cpus: os.cpus().length, cpu: (os.cpus()[0] || {}).model, memGB: Math.round(os.totalmem() / 1073741824), gpu: GPU ? 'real GPU (filled from WebGL below)' : 'SwiftShader (software WebGL in headless Chrome)' }, runs: [] };
const GL_NAME = `(function(){var c=document.createElement('canvas').getContext('webgl2');var e=c&&c.getExtension('WEBGL_debug_renderer_info');return c?(e?c.getParameter(e.UNMASKED_RENDERER_WEBGL):c.getParameter(c.RENDERER)):'no webgl2'})()`;
for (const prod of suite.productions) {
  if (only && prod.id !== only) continue;
  for (const dev of suite.devices) {
    const p = await b.newPage({ width: dev.width, height: dev.height, dsf: dev.dsf || 1, mobile: !!dev.mobile, reducedMotion: !!prod.reducedMotion });
    const t0 = Date.now();
    await p.goto(base + prod.url, { settleMs: 200, timeoutMs: 60000 });
    // ready: the page says so, or the renderer has drawn a few frames
    let ready = null;
    for (let i = 0; i < 240; i++) { const ok = await p.eval(prod.ready || 'true').catch(() => false); if (ok) { ready = Date.now() - t0; break; } await sleep(250); }
    const nav = await p.eval('JSON.stringify((function(){var n=performance.getEntriesByType("navigation")[0]||{};return {dcl:Math.round(n.domContentLoadedEventEnd||0),load:Math.round(n.loadEventEnd||0),bytes:performance.getEntriesByType("resource").reduce(function(a,r){return a+(r.transferSize||r.encodedBodySize||0)},0)+(n.transferSize||n.encodedBodySize||0)}})())').then(JSON.parse).catch(() => ({}));
    await p.eval(PROBE);
    if (GPU && report.machine.gpu.startsWith('real')) report.machine.gpu = await p.eval(GL_NAME).catch(() => 'unknown');
    if (prod.setup) await p.eval(prod.setup).catch(e => console.warn('setup', prod.id, e.message));
    for (const pose of prod.poses) {
      if (pose.js) await p.eval(pose.js).catch(e => console.warn('pose', pose.id, e.message));
      await sleep(pose.settle || 2500);
      const m = await p.eval(`window.__dfProbe(${suite.sampleMs || 5000}).then(function(x){return JSON.stringify(x)})`).then(JSON.parse).catch(e => ({ error: e.message }));
      const shot = `${prod.id}-${dev.id}-${pose.id}.jpg`;
      await p.screenshot({ path: join(OUT, shot), quality: 80 });
      const run = { production: prod.id, device: dev.id, pose: pose.id, readyMs: ready, ...nav, ...m, shot, errors: (p.consoleErrors || []).slice(0, 3) };
      report.runs.push(run);
      console.log([prod.id, dev.id, pose.id, 'ready', ready, 'ms · fps', m.fps, '· p95', m.p95, 'ms · calls', m.calls, '· tris', m.triangles, '· heap', m.heapMB, 'MB'].join(' '));
    }
    await p.close();
  }
}
writeFileSync(join(OUT, 'report.json'), JSON.stringify(report, null, 2));
console.log('report:', join(OUT, 'report.json'));
await b.close(); srv.close();
