#!/usr/bin/env node
// Asset quality gate for GLB files: the Khronos glTF validator, then the checks a technical artist runs before export
// (after the asset-QA checklist in EL4CTEO/blender-skills): real-world scale, origin on the floor, named nodes and
// materials, normals unit length, no degenerate or NaN geometry, UVs wherever a texture is mapped, budgets.
//   node check-glb.mjs <file.glb> [--max-tris 20000] [--max-kb 600] [--size 0.3,3]
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { getBounds } from '@gltf-transform/functions';
import { MeshoptDecoder } from 'meshoptimizer';
import validator from 'gltf-validator';

const file = process.argv[2];
if (!file) { console.error('usage: node check-glb.mjs <file.glb>'); process.exit(2); }
const opt = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const maxTris = +opt('max-tris', 20000), maxKB = +opt('max-kb', 600), [minM, maxM] = opt('size', '0.3,3').split(',').map(Number);
const bytes = readFileSync(file), out = [];
const fail = (rule, msg) => out.push(['FAIL', rule, msg]), warn = (rule, msg) => out.push(['WARN', rule, msg]), pass = (rule, msg) => out.push(['ok', rule, msg]);

// 1. Khronos validator
const v = await validator.validateBytes(new Uint8Array(bytes), { uri: basename(file), maxIssues: 50 });
const iss = v.issues;
if (iss.numErrors) fail('khronos', `${iss.numErrors} errors: ${iss.messages.filter(m => m.severity === 0).slice(0, 3).map(m => m.code + ' ' + m.pointer).join('; ')}`);
else pass('khronos', `0 errors, ${iss.numWarnings} warnings, ${iss.numInfos} infos`);
for (const m of iss.messages.filter(m => m.severity === 1).slice(0, 5)) warn('khronos', `${m.code} ${m.pointer || ''}`);

// 2. our checks
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
const doc = await io.readBinary(new Uint8Array(bytes));
const root = doc.getRoot(), scene = root.getDefaultScene() || root.listScenes()[0];
const { min, max } = getBounds(scene), size = max.map((x, i) => x - min[i]);
const big = Math.max(...size);
if (big < minM || big > maxM) fail('scale', `largest side ${big.toFixed(3)} m, expected ${minM}–${maxM} m (wrong units?)`); else pass('scale', `bounds ${size.map(x => x.toFixed(3)).join(' × ')} m`);
if (Math.abs(min[1]) > 0.005) fail('origin', `lowest point at y = ${min[1].toFixed(4)} m; the origin should sit on the floor`); else pass('origin', 'stands on y = 0');
const unnamed = root.listNodes().filter(n => !n.getName()).length + root.listMaterials().filter(m => !m.getName()).length;
if (unnamed) fail('names', `${unnamed} unnamed nodes or materials`); else pass('names', `${root.listNodes().length} nodes and ${root.listMaterials().length} materials named`);
let tris = 0, degenerate = 0, nan = 0, badNormals = 0, noUv = 0;
const a = [0, 0, 0], b = [0, 0, 0], c = [0, 0, 0], n = [0, 0, 0];
for (const mesh of root.listMeshes()) for (const p of mesh.listPrimitives()) {
  const pos = p.getAttribute('POSITION'), nor = p.getAttribute('NORMAL'), idx = p.getIndices(), mat = p.getMaterial();
  const count = idx ? idx.getCount() : pos.getCount(); tris += count / 3;
  for (let i = 0; i < pos.getCount(); i++) { pos.getElement(i, a); if (a.some(x => !Number.isFinite(x))) nan++; if (nor) { nor.getElement(i, n); const l = Math.hypot(n[0], n[1], n[2]); if (Math.abs(l - 1) > 0.02) badNormals++; } }
  for (let t = 0; t < count; t += 3) {
    const i0 = idx ? idx.getScalar(t) : t, i1 = idx ? idx.getScalar(t + 1) : t + 1, i2 = idx ? idx.getScalar(t + 2) : t + 2;
    pos.getElement(i0, a); pos.getElement(i1, b); pos.getElement(i2, c);
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], wx = c[0] - a[0], wy = c[1] - a[1], wz = c[2] - a[2];
    if (Math.hypot(uy * wz - uz * wy, uz * wx - ux * wz, ux * wy - uy * wx) < 1e-14) degenerate++;
  }
  if (mat && (mat.getBaseColorTexture() || mat.getNormalTexture() || mat.getMetallicRoughnessTexture()) && !p.getAttribute('TEXCOORD_0')) noUv++;
}
if (nan) fail('finite', `${nan} non-finite positions`); else pass('finite', 'all positions finite');
if (badNormals) fail('normals', `${badNormals} normals not unit length`); else pass('normals', 'unit length');
if (degenerate) warn('degenerate', `${degenerate} zero-area triangles`); else pass('degenerate', 'no zero-area triangles');
if (noUv) fail('uv', `${noUv} textured primitives without TEXCOORD_0`); else pass('uv', 'every textured primitive has UVs');
if (tris > maxTris) fail('budget-tris', `${tris} triangles > ${maxTris}`); else pass('budget-tris', `${tris} triangles ≤ ${maxTris}`);
const kb = bytes.length / 1024;
if (kb > maxKB) fail('budget-size', `${kb.toFixed(0)} KB > ${maxKB} KB`); else pass('budget-size', `${kb.toFixed(0)} KB ≤ ${maxKB} KB`);
const used = root.listExtensionsUsed().map(e => e.extensionName), req = root.listExtensionsRequired().map(e => e.extensionName);
pass('extensions', `used ${used.join(', ') || 'none'}; required ${req.join(', ') || 'none'}`);
for (const [s, r, m] of out) console.log(`${s.padEnd(4)}  ${r.padEnd(12)} ${m}`);
const fails = out.filter(x => x[0] === 'FAIL').length;
console.log(fails ? `${fails} FAIL` : 'PASS');
process.exit(fails ? 1 : 0);
