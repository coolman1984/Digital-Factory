#!/usr/bin/env node
// Before/after table from two bench reports (same machine, same suite):
//   node tools/bench/compare.mjs <before/report.json> <after/report.json> [--map before-id=after-id,...]
// Rows pair runs by production, device and pose. --map pairs productions with different ids (a legacy run with its upgrade).
import { readFileSync } from 'node:fs';
const [, , bPath, aPath] = process.argv;
if (!bPath || !aPath) { console.error('usage: node compare.mjs <before.json> <after.json> [--map a=b,...]'); process.exit(2); }
const i = process.argv.indexOf('--map'), map = Object.fromEntries((i > 0 ? process.argv[i + 1] : '').split(',').filter(Boolean).map(p => p.split('=')));
const B = JSON.parse(readFileSync(bPath, 'utf8')), A = JSON.parse(readFileSync(aPath, 'utf8'));
const key = r => `${r.production}|${r.device}|${r.pose}`;
const after = new Map(A.runs.map(r => [key(r), r]));
const d = (a, b, lowerIsBetter = true) => (a == null || b == null) ? '' : (b === a ? '=' : `${b > a ? '+' : ''}${(((b - a) / (a || 1)) * 100).toFixed(0)}%`);
console.log(`Machine: ${A.machine.cpu} · ${A.machine.cpus} threads · ${A.machine.gpu}. Frame rates on a software GPU are only comparable with each other.\n`);
console.log('| Production · device · pose | Draw calls | Triangles | Programs | Textures | Heap MB | Frame p50 ms | Ready ms |');
console.log('|---|---|---|---|---|---|---|---|');
for (const b of B.runs) {
  const id = map[b.production] || b.production, a = after.get(`${id}|${b.device}|${b.pose}`);
  if (!a) continue;
  const cell = (x, y) => `${x ?? '–'} → ${y ?? '–'} ${d(x, y)}`.trim();
  console.log(`| ${id} · ${b.device} · ${b.pose} | ${cell(b.calls, a.calls)} | ${cell(b.triangles, a.triangles)} | ${cell(b.programs, a.programs)} | ${cell(b.textures, a.textures)} | ${cell(b.heapMB, a.heapMB)} | ${cell(b.p50, a.p50)} | ${cell(b.readyMs, a.readyMs)} |`);
}
