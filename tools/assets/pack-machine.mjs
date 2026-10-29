#!/usr/bin/env node
// Packs a machine exported from Blender (tools/blender/<kind>.py --glb) for the browser: dedup, weld, reorder,
// quantize and meshopt compression (EXT_meshopt_compression). Node names and extras (part_id, role, explode, shell,
// anchor) are kept, because the inspection studio reads them; nothing is merged across parts.
//   node pack-machine.mjs <raw.glb> <out.glb>
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression } from '@gltf-transform/extensions';
import { dedup, weld, reorder, quantize, prune } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';
import { statSync } from 'node:fs';

const [src, dst] = process.argv.slice(2);
if (!src || !dst) { console.error('usage: node pack-machine.mjs <raw.glb> <out.glb>'); process.exit(2); }
await MeshoptEncoder.ready; await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
const doc = await io.read(src);
await doc.transform(
  prune({ keepLeaves: true, keepAttributes: false, keepExtras: true }),   // empties are assemblies: keep them
  dedup(),
  weld(),
  reorder({ encoder: MeshoptEncoder }),
  quantize({ quantizePosition: 14, quantizeNormal: 10 })
);
doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.FILTER });
await io.write(dst, doc);
console.log(`${src} ${(statSync(src).size / 1024).toFixed(0)} KB -> ${dst} ${(statSync(dst).size / 1024).toFixed(0)} KB`);
