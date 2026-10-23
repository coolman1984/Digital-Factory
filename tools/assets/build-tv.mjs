#!/usr/bin/env node
// The asset pipeline for the showroom's hero product: a fictional 65-inch QLED TV built by Plant EG-01.
//   1. model: procedural hard-surface geometry in metres, Y up, origin at the centre of the base, every part named
//   2. textures: brushed-metal, fabric-weave and stipple normal maps and roughness maps drawn in code (PNG)
//   3. bake: ambient occlusion per vertex, by ray casting against the whole model (three-mesh-bvh), stored in COLOR_0
//   4. materials: glTF PBR plus KHR clearcoat, sheen, anisotropy, IOR and emissive strength
//   5. optimize: dedup, weld, reorder, quantize and meshopt compression (EXT_meshopt_compression), plus a simplified LOD
//   6. validate: the Khronos glTF validator, then our own asset checks (check-glb.mjs)
// Run from this folder: npm i && node build-tv.mjs   (writes ../../assets/models/tv-qled65*.glb and a report)
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeVertices, mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { MeshBVH } from 'three-mesh-bvh';
import { Document, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, KHRMaterialsClearcoat, KHRMaterialsSheen, KHRMaterialsAnisotropy, KHRMaterialsIOR, KHRMaterialsEmissiveStrength, EXTMeshoptCompression } from '@gltf-transform/extensions';
import { dedup, weld, unweld, tangents, reorder, quantize, prune, simplify } from '@gltf-transform/functions';
import { generateTangents } from 'mikktspace';
import { MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import { PNG } from 'pngjs';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url)), OUT = join(HERE, '..', '..', 'assets', 'models');
mkdirSync(OUT, { recursive: true });

/* ---------- seeded randomness (PCG): the same build gives the same bytes ---------- */
let seed = 0x9e3779b9 >>> 0;
const rnd = () => { seed = (seed * 747796405 + 2891336453) >>> 0; let w = ((seed >>> ((seed >>> 28) + 4)) ^ seed) * 277803737 >>> 0; return (((w >>> 22) ^ w) >>> 0) / 4294967296; };

/* ---------- 1. the model (metres) ---------- */
const W = 1.439, H = 0.809;          // a 65-inch 16:9 panel
const T = 0.026, BZ = 0.006;          // panel thickness, bezel width
const LIFT = 0.095;                   // panel bottom above the stand base
const parts = [];                     // { name, mat, geo }
// welded, with zero-area triangles (the poles of rounded corners) dropped from the index
const add = (name, mat, geo, m) => {
  if (m) geo.applyMatrix4(m);
  const g = geo.index ? geo : mergeVertices(geo), p = g.attributes.position, ix = g.index.array, keep = [];
  const A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3();
  for (let i = 0; i < ix.length; i += 3) { A.fromBufferAttribute(p, ix[i]); B.fromBufferAttribute(p, ix[i + 1]); C.fromBufferAttribute(p, ix[i + 2]); if (B.sub(A).cross(C.sub(A)).lengthSq() > 1e-16) keep.push(ix[i], ix[i + 1], ix[i + 2]); }
  g.setIndex(keep); parts.push({ name, mat, geo: g });
};
const at = (x, y, z, rx = 0, ry = 0, rz = 0) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(1, 1, 1));
const cy = LIFT + H / 2;
// frame: a rounded slab of anodised aluminium, the screen glass sits in it
add('frame', 'anodised', new RoundedBoxGeometry(W + 2 * BZ, H + 2 * BZ, T, 4, 0.004), at(0, cy, 0));
add('screen', 'glass', new THREE.PlaneGeometry(W, H), at(0, cy, T / 2 + 0.0006));
// back: a thicker housing behind the lower two thirds (power board and speakers), textured plastic
add('back-housing', 'plastic', new RoundedBoxGeometry(W * 0.86, H * 0.62, 0.034, 5, 0.012), at(0, LIFT + H * 0.36, -T / 2 - 0.016));
// connector bay: a recessed dark panel with ports
add('port-bay', 'rubber', new RoundedBoxGeometry(0.30, 0.09, 0.008, 2, 0.003), at(0.42, LIFT + H * 0.22, -T / 2 - 0.0335));
for (let i = 0; i < 4; i++) add('hdmi-' + (i + 1), 'chrome', new RoundedBoxGeometry(0.016, 0.006, 0.006, 1, 0.0015), at(0.31 + i * 0.03, LIFT + H * 0.22, -T / 2 - 0.0375));
// fabric speaker strip under the panel, front-facing
add('speaker-fabric', 'fabric', new RoundedBoxGeometry(W * 0.62, 0.026, 0.03, 4, 0.01), at(0, LIFT - 0.012, 0.0));
// pedestal stand: a brushed-aluminium neck and a thin base plate with rubber feet
const neck = new RoundedBoxGeometry(0.11, LIFT + H * 0.3, 0.016, 4, 0.006); add('stand-neck', 'brushed', neck, at(0, (LIFT + H * 0.3) / 2, -T / 2 - 0.042, -0.06));
const base = new RoundedBoxGeometry(0.56, 0.012, 0.29, 6, 0.006); add('stand-base', 'brushed', base, at(0, 0.006 + 0.004, -0.05));
for (const [x, z] of [[-0.25, 0.07], [0.25, 0.07], [-0.25, -0.17], [0.25, -0.17]]) add('foot', 'rubber', new THREE.CylinderGeometry(0.014, 0.016, 0.004, 20), at(x, 0.002, z));
// status light, a tiny emissive dot under the bezel
add('status-led', 'led', new THREE.SphereGeometry(0.0022, 12, 8), at(0.62, LIFT - BZ - 0.002, T / 2 - 0.002));

/* ---------- 2. textures (PNG, drawn in code) ---------- */
function png(size, fn) { const p = new PNG({ width: size, height: size }); for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) { const [r, g, b, a = 255] = fn(x, y, size); const i = (y * size + x) * 4; p.data[i] = r; p.data[i + 1] = g; p.data[i + 2] = b; p.data[i + 3] = a; } return PNG.sync.write(p); }
const enc = (nx, ny) => { const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny)); return [Math.round((nx * 0.5 + 0.5) * 255), Math.round((ny * 0.5 + 0.5) * 255), Math.round((nz * 0.5 + 0.5) * 255)]; };
// brushed metal: long horizontal grooves, a random phase per row
const rows = Array.from({ length: 512 }, () => rnd());
const brushedN = png(256, (x, y) => { const v = Math.sin((x / 512) * Math.PI * 2 * (3 + rows[y] * 2) + rows[y] * 40) * 0.5 + (rows[(y + 1) % 256] - rows[y]); return enc(0, Math.max(-0.35, Math.min(0.35, v * 0.22))); });
// fabric: a plain weave, warp over weft
const fabricN = png(256, (x, y) => { const cx = (x % 16) / 16, cy2 = (y % 16) / 16, warp = ((Math.floor(x / 16) + Math.floor(y / 16)) % 2) === 0; const s = Math.sin(cx * Math.PI), t = Math.sin(cy2 * Math.PI); return warp ? enc(Math.cos(cx * Math.PI) * 0.45 * t, 0) : enc(0, Math.cos(cy2 * Math.PI) * 0.45 * s); });
// plastic: a fine moulding stipple
const stip = Array.from({ length: 256 * 256 }, () => rnd());
const stippleN = png(256, (x, y) => { const h = i => stip[((y + 256) % 256) * 256 + ((x + i + 256) % 256)]; const gx = h(1) - h(-1), gy = stip[((y + 1) % 256) * 256 + x] - stip[((y + 255) % 256) * 256 + x]; return enc(gx * 0.18, gy * 0.18); });
// roughness for brushed metal: green channel (glTF metallicRoughness packs roughness in G, metalness in B)
const brushedMR = png(256, (x, y) => [0, Math.round((0.22 + rows[y * 2 % 512] * 0.12) * 255), 255]);

/* ---------- 3. bake ambient occlusion per vertex (cosine-weighted rays, 48 per vertex, reach 12 cm) ---------- */
const all = mergeGeometries(parts.map(p => { const g = p.geo.clone(); for (const k of Object.keys(g.attributes)) if (k !== 'position') g.deleteAttribute(k); return g.index ? g.toNonIndexed() : g; }));
const bvh = new MeshBVH(all), ray = new THREE.Ray(), RAYS = 48, REACH = 0.12;
const tmp = new THREE.Vector3(), nrm = new THREE.Vector3(), t1 = new THREE.Vector3(), t2 = new THREE.Vector3();
const dirs = Array.from({ length: RAYS }, (_, i) => { const u = (i + 0.5) / RAYS, v = (i * 0.618034) % 1, r = Math.sqrt(u), a = 2 * Math.PI * v; return [r * Math.cos(a), r * Math.sin(a), Math.sqrt(1 - u)]; });
let aoMin = 1, aoSum = 0, aoN = 0;
for (const p of parts) {
  if (p.mat === 'glass' || p.mat === 'led') continue;
  const g = p.geo; g.computeVertexNormals();
  const pos = g.attributes.position, nor = g.attributes.normal, col = new Float32Array(pos.count * 4);
  for (let i = 0; i < pos.count; i++) {
    tmp.fromBufferAttribute(pos, i); nrm.fromBufferAttribute(nor, i).normalize();
    t1.set(Math.abs(nrm.x) < 0.9 ? 1 : 0, Math.abs(nrm.x) < 0.9 ? 0 : 1, 0).cross(nrm).normalize(); t2.crossVectors(nrm, t1);
    let hit = 0;
    for (const [a, b2, c] of dirs) {
      ray.origin.copy(tmp).addScaledVector(nrm, 0.0008);
      ray.direction.copy(t1).multiplyScalar(a).addScaledVector(t2, b2).addScaledVector(nrm, c).normalize();
      const h = bvh.raycastFirst(ray, THREE.DoubleSide);
      if (h && h.distance < REACH) hit += 1 - h.distance / REACH;
    }
    const ao = Math.max(0.35, 1 - hit / RAYS * 1.4);
    col.set([ao, ao, ao, 1], i * 4); aoMin = Math.min(aoMin, ao); aoSum += ao; aoN++;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 4));
}

/* ---------- 4. the glTF document ---------- */
function toDoc(src, lodName, far) {
  const doc = new Document(); doc.createBuffer();
  const ext = {
    clear: doc.createExtension(KHRMaterialsClearcoat), sheen: doc.createExtension(KHRMaterialsSheen), aniso: doc.createExtension(KHRMaterialsAnisotropy),
    ior: doc.createExtension(KHRMaterialsIOR), emis: doc.createExtension(KHRMaterialsEmissiveStrength)
  };
  const tex = (name, bytes) => doc.createTexture(name).setImage(bytes).setMimeType('image/png');
  const TX = { brushedN: tex('brushed-normal', brushedN), fabricN: tex('fabric-normal', fabricN), stippleN: tex('stipple-normal', stippleN), brushedMR: tex('brushed-rough', brushedMR) };
  const M = {};
  const mat = (name, o) => { if (far) { o = Object.assign({}, o, { normal: null, mr: null }); if (name === 'brushed') o.rough = 0.28; } const m = doc.createMaterial(name).setBaseColorFactor(o.color).setMetallicFactor(o.metal ?? 0).setRoughnessFactor(o.rough ?? 0.5); if (o.normal) m.setNormalTexture(o.normal); if (o.mr) m.setMetallicRoughnessTexture(o.mr); if (o.emissive) m.setEmissiveFactor(o.emissive); M[name] = m; return m; };
  const lin = h => { const c = new THREE.Color(h); return [c.r, c.g, c.b, 1]; };   // THREE.Color stores linear values
  mat('glass', { color: lin(0x030406), rough: 0.06 }).setExtension('KHR_materials_clearcoat', ext.clear.createClearcoat().setClearcoatFactor(1).setClearcoatRoughnessFactor(0.03)).setExtension('KHR_materials_ior', ext.ior.createIOR().setIOR(1.52));
  mat('anodised', { color: lin(0x2B2E33), metal: 1, rough: 0.34 }).setExtension('KHR_materials_anisotropy', ext.aniso.createAnisotropy().setAnisotropyStrength(0.35));
  mat('plastic', { color: lin(0x1C1E22), rough: 0.62, normal: TX.stippleN });
  mat('brushed', { color: lin(0xC9CDD2), metal: 1, rough: 1, normal: TX.brushedN, mr: TX.brushedMR }).setExtension('KHR_materials_anisotropy', ext.aniso.createAnisotropy().setAnisotropyStrength(0.85).setAnisotropyRotation(0));
  mat('fabric', { color: lin(0x3A3D42), rough: 0.92, normal: TX.fabricN }).setExtension('KHR_materials_sheen', ext.sheen.createSheen().setSheenColorFactor([0.55, 0.57, 0.62]).setSheenRoughnessFactor(0.55));
  mat('rubber', { color: lin(0x121315), rough: 0.88 });
  mat('chrome', { color: lin(0xD8DCE0), metal: 1, rough: 0.12 });
  mat('led', { color: lin(0x000000), emissive: [1, 0.25, 0.18] }).setExtension('KHR_materials_emissive_strength', ext.emis.createEmissiveStrength().setEmissiveStrength(4));
    const scene = doc.createScene('QLED 65'), root = doc.createNode('tv-qled65' + (lodName || '')); scene.addChild(root);
  root.setExtras({ product: 'QLED 65', maker: 'Plant EG-01 (fictional)', units: 'metres', up: '+Y', front: '+Z', aoBaked: 'COLOR_0' });
  for (const p of src) {
    const g = p.geo, prim = doc.createPrimitive().setMaterial(M[p.mat]);
    const acc = (type, arr) => doc.createAccessor().setType(type).setArray(arr);
    prim.setAttribute('POSITION', acc('VEC3', new Float32Array(g.attributes.position.array)));
    if (!g.attributes.normal) g.computeVertexNormals();
    prim.setAttribute('NORMAL', acc('VEC3', new Float32Array(g.attributes.normal.array)));
    if (g.attributes.uv) prim.setAttribute('TEXCOORD_0', acc('VEC2', new Float32Array(g.attributes.uv.array)));
    if (g.attributes.color) prim.setAttribute('COLOR_0', acc('VEC4', new Float32Array(g.attributes.color.array)));
    prim.setIndices(acc('SCALAR', new Uint32Array(g.index.array)));
    root.addChild(doc.createNode(p.name).setMesh(doc.createMesh(p.name).addPrimitive(prim)));
  }
  return doc;
}

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': (await import('meshoptimizer')).MeshoptDecoder });
await MeshoptEncoder.ready; await MeshoptSimplifier.ready;
const report = { built: new Date().toISOString().slice(0, 10), parts: parts.length, ao: { rays: RAYS, reachM: REACH, min: +aoMin.toFixed(3), mean: +(aoSum / aoN).toFixed(3) }, files: {} };
for (const lod of [{ id: '', ratio: 1 }, { id: '-lod1', ratio: 0.25 }]) {
  const doc = toDoc(parts, lod.id, lod.ratio < 1);
  doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });
  // MikkTSpace tangents for every normal-mapped primitive (needs unwelded geometry), then weld again
  const steps = [dedup(), unweld(), tangents({ generateTangents, overwrite: true }), weld()];
  if (lod.ratio < 1) steps.push(simplify({ simplifier: MeshoptSimplifier, ratio: lod.ratio, error: 0.002 }));
  steps.push(prune({ keepAttributes: true }), reorder({ encoder: MeshoptEncoder }), quantize({ quantizeNormal: 10, quantizeTexcoord: 12, quantizeColor: 8 }));
  await doc.transform(...steps);
  const bytes = await io.writeBinary(doc);
  const file = `tv-qled65${lod.id}.glb`; writeFileSync(join(OUT, file), bytes);
  let tris = 0, verts = 0; for (const m of doc.getRoot().listMeshes()) for (const p of m.listPrimitives()) { tris += p.getIndices().getCount() / 3; verts += p.getAttribute('POSITION').getCount(); }
  report.files[file] = { bytes: bytes.byteLength, triangles: tris, vertices: verts, meshes: doc.getRoot().listMeshes().length, materials: doc.getRoot().listMaterials().length, textures: doc.getRoot().listTextures().length };
  console.log(file, report.files[file]);
}
writeFileSync(join(OUT, 'tv-qled65.build.json'), JSON.stringify(report, null, 2));
console.log('ao', report.ao);
